/**
 * User Management Service (server/services/user.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Quản lý danh sách cán bộ, giảng viên, nhân viên nhà trường.
 * - Phân quyền quản lý theo Khoa/Phòng ban (Trưởng khoa chỉ xem/sửa nhân sự khoa mình).
 * - Tạo mới, cập nhật, khóa/vô hiệu hóa tài khoản (Soft delete + tăng tokenVersion).
 * - Tích hợp quản lý dữ liệu Face ID thông qua faceTemplate.service.
 * - Ghi Audit Log toàn diện cho các thao tác quản trị.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const AuditLog = require('../models/auditLog.model');
const RefreshToken = require('../models/refreshToken.model');
const {
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
} = require('./faceTemplate.service');
const { getDeanDepartmentIds } = require('../utils/deanScope');
const { ROLES, ALL_ROLES, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole } = require('../utils/roleUtils');

const ADMIN_ROLE = ROLES.ADMIN;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const buildDefaultRolesArray = (roleStr, departmentId = null) => {
  const norm = normalizeRole(roleStr);
  let scope = departmentId ? 'khoa' : 'toan_truong';

  if (GLOBAL_ADMIN_ROLES.includes(norm) || ['dao_tao'].includes(norm)) {
    scope = 'toan_truong';
  } else if (['truong_khoa', 'pho_khoa'].includes(norm)) {
    scope = 'khoa';
  } else if (['truong_bo_mon', 'pho_bo_mon'].includes(norm)) {
    scope = 'bo_mon';
  } else if (['truong_phong', 'pho_phong', 'chuyen_vien', 'nhan_vien'].includes(norm)) {
    scope = departmentId ? 'phong_ban' : 'toan_truong';
  } else {
    scope = departmentId ? 'khoa' : 'toan_truong';
  }

  return [{ role: norm, scope, departmentId: departmentId || null }];
};

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * 1. Lấy danh sách người dùng (Phân trang, tìm kiếm, lọc theo khoa và vai trò)
 */
const fetchUsers = async ({ role, departmentId, isActive, search, page = 1, limit = 20, currentUser }) => {
  const query = {};

  // Giới hạn phạm vi quyền Trưởng khoa / Lãnh đạo đơn vị
  const userRole = normalizeRole(currentUser.role || currentUser.primaryRole || currentUser.vai_tro_chinh);
  if (UNIT_LEADER_ROLES.includes(userRole)) {
    const departmentIds = await getDeanDepartmentIds(currentUser);
    if (!departmentIds.length) {
      throw new ServiceError('Tài khoản Lãnh đạo đơn vị chưa được gán mã khoa / phòng ban trực thuộc.', 403);
    }
    query.$or = [
      { don_vi_chinh_id: { $in: departmentIds } },
      { departmentId: { $in: departmentIds } },
      { 'danh_sach_vai_tro.don_vi_id': { $in: departmentIds } },
    ];
  } else if (departmentId) {
    const validId = typeof departmentId === 'string' && mongoose.isValidObjectId(departmentId)
      ? new mongoose.Types.ObjectId(departmentId)
      : departmentId;
    query.$or = [
      { don_vi_chinh_id: validId },
      { departmentId: validId },
      { 'danh_sach_vai_tro.don_vi_id': validId },
    ];
  }

  if (role) {
    query.primaryRole = normalizeRole(role);
  }

  if (isActive !== undefined && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { fullName: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
      { staffCode: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query)
      .populate({
        path: 'don_vi_chinh_id',
        select: 'ten_phong_ban loai_don_vi don_vi_cha_id',
      })
      .populate({
        path: 'departmentId',
        select: 'ten_phong_ban loai_don_vi don_vi_cha_id name type',
      })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(query),
  ]);

  const FaceTemplate = require('../models/faceTemplate.model');
  const userIds = users.map((u) => u._id);
  const templates = await FaceTemplate.find({
    userId: { $in: userIds },
  }).select('userId ngay_dang_ky so_luong_mau').lean();

  const templateMap = new Map();
  for (const t of templates) {
    const uid = t.userId?.toString();
    if (uid) templateMap.set(uid, t);
  }

  const mappedUsers = users.map((u) => {
    const t = templateMap.get(u._id.toString());
    const isFaceReg =
      Boolean(t) ||
      Boolean(u.isFaceRegistered);

    const deptObj =
      u.departmentId && typeof u.departmentId === 'object'
        ? u.departmentId
        : null;

    const departmentName = deptObj?.name || '';
    const staffCode = u.staffCode || '';
    const roleVal = normalizeRole(u.role);
    const avatarVal = u.avatar || u.facePhoto || null;
    const facePhotoVal = u.facePhoto || null;

    return {
      ...u,
      fullName: u.fullName || '',
      role: roleVal,
      primaryRole: roleVal,
      staffCode,
      phoneNumber: u.phoneNumber || '',
      position: u.position || '',
      academicRank: u.academicRank || 'khong',
      degree: u.degree || 'cu_nhan',
      staffType: u.staffType || 'giang_vien',
      contractType: u.contractType || 'toan_thoi_gian',
      salaryScale: u.salaryScale || 'V.07.01.03',
      salaryCoefficient: u.salaryCoefficient ?? 2.34,
      dependentsCount: u.dependentsCount ?? 0,
      annualLeaveQuota: u.annualLeaveQuota ?? u.so_ngay_phep_nam ?? 12,
      gender: u.gender || u.gioi_tinh || 'nam',
      employmentStatus: u.employmentStatus || u.trang_thai_lam_viec || 'dang_lam_viec',
      isActive: u.isActive ?? u.kich_hoat ?? true,
      departmentId: deptObj || u.departmentId || u.don_vi_chinh_id || null,
      departmentName,
      avatar: avatarVal,
      isFaceRegistered: isFaceReg,
      faceRegisteredAt: t?.ngay_dang_ky || u.ngay_dang_ky_face || u.faceRegisteredAt || null,
      facePhoto: facePhotoVal,
      sampleCount: t?.so_luong_mau || t?.sampleCount || 0,
    };
  });

  return {
    users: mappedUsers,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * 2. Xem chi tiết người dùng
 */
const fetchUserById = async (userId, currentUser) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  const user = await User.findById(userId)
    .populate({
      path: 'don_vi_chinh_id',
      select: 'ten_phong_ban loai_don_vi don_vi_cha_id',
    })
    .populate({
      path: 'departmentId',
      select: 'ten_phong_ban loai_don_vi don_vi_cha_id name type',
    })
    .select('-passwordHash');

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  // Kiểm tra quyền hạn nếu là Trưởng khoa
  const isSelf = String(currentUser._id || currentUser.id) === String(userId);
  const viewerRole = normalizeRole(currentUser.role || currentUser.primaryRole);
  if (!isSelf && viewerRole === 'truong_khoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền xem thông tin nhân sự ngoài phạm vi quản lý của khoa.', 403);
    }
  }

  return user;
};

/**
 * 3. Tạo mới tài khoản cán bộ / giảng viên
 */
const createNewUser = async (data, currentUser, ipAddress = null) => {
  const {
    fullName,
    email,
    password,
    role,
    departmentId,
    staffCode,
    phoneNumber,
    position,
    academicRank,
    degree,
    staffType,
    contractType,
    salaryScale,
    salaryCoefficient,
    dependentsCount,
    annualLeaveQuota,
    gender,
    dateOfBirth,
    startDate,
    address,
    employmentStatus,
    avatar,
    roles,
  } = data;

  const finalName = (fullName || '').trim();
  const finalEmail = (email || '').trim().toLowerCase();
  const finalStaffCode = (staffCode || '').trim().toUpperCase();
  const finalRole = normalizeRole(role || 'giang_vien');
  const finalDeptId = departmentId || null;

  if (!finalName) throw new ServiceError('Họ tên không được để trống.', 400);
  if (!finalEmail || !EMAIL_REGEX.test(finalEmail)) throw new ServiceError('Địa chỉ email không hợp lệ.', 400);
  if (!finalStaffCode) throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
  if (!password || password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);

  // Kiểm tra trùng email
  const existingEmail = await User.findOne({ email: finalEmail });
  if (existingEmail) {
    throw new ServiceError('Email này đã được đăng ký trên hệ thống.', 409);
  }

  // Kiểm tra trùng mã cán bộ
  const existingStaffCode = await User.findOne({ staffCode: finalStaffCode });
  if (existingStaffCode) {
    throw new ServiceError('Mã cán bộ này đã tồn tại trên hệ thống.', 409);
  }

  // Kiểm tra khoa/phòng ban nếu có truyền
  if (finalDeptId) {
    const dept = await Department.findById(finalDeptId);
    if (!dept) throw new ServiceError('Khoa/Phòng ban không tồn tại trên hệ thống.', 400);

    const isBghDept = (dept.name || '').toLowerCase().includes('giám hiệu');
    if (finalRole === 'bgh' && !isBghDept) {
      throw new ServiceError('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.', 400);
    }
    if (['truong_khoa', 'pho_khoa'].includes(finalRole) && dept.type !== 'khoa') {
      throw new ServiceError('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.', 400);
    }
    if (['truong_bo_mon', 'pho_bo_mon'].includes(finalRole) && dept.type !== 'bo_mon' && dept.type !== 'bomon') {
      throw new ServiceError('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
    }
    if (finalRole === 'giang_vien' && dept.type !== 'bo_mon' && dept.type !== 'bomon') {
      throw new ServiceError('Giảng viên bắt buộc phải trực thuộc một Bộ Môn cụ thể.', 400);
    }
    if (finalRole === 'admin' && (dept.type === 'khoa' || dept.type === 'bo_mon' || dept.type === 'bomon')) {
      throw new ServiceError('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU, không thuộc Khoa/Bộ môn đào tạo.', 400);
    }
    if (isBghDept && !['bgh', 'admin'].includes(finalRole)) {
      throw new ServiceError('Đơn vị Ban Giám Hiệu chỉ dành cho nhân sự thuộc Ban Giám Hiệu hoặc Quản trị viên.', 400);
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    fullName: finalName,
    email: finalEmail,
    passwordHash: hashedPassword,
    staffCode: finalStaffCode,
    role: finalRole,
    primaryRole: finalRole,
    departmentId: finalDeptId,
    don_vi_chinh_id: finalDeptId,
    phoneNumber: phoneNumber || undefined,
    position: position || undefined,
    academicRank: academicRank || 'khong',
    degree: degree || 'cu_nhan',
    staffType: staffType || (finalRole === 'giang_vien' ? 'giang_vien' : 'hanh_chinh'),
    contractType: contractType || 'toan_thoi_gian',
    salaryScale: salaryScale || 'V.07.01.03',
    salaryCoefficient: salaryCoefficient !== undefined ? Number(salaryCoefficient) : 2.34,
    dependentsCount: dependentsCount !== undefined ? Number(dependentsCount) : 0,
    annualLeaveQuota: annualLeaveQuota !== undefined ? Number(annualLeaveQuota) : 12,
    gender: gender || 'nam',
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    startDate: startDate ? new Date(startDate) : new Date(),
    address: address || '',
    employmentStatus: employmentStatus || 'dang_lam_viec',
    avatar: avatar || null,
    roles: Array.isArray(roles) && roles.length > 0 ? roles : buildDefaultRolesArray(finalRole, finalDeptId),
    isActive: true,
    isVerified: true,
    tokenVersion: 1,
  });

  AuditLog.create({
    actor: currentUser._id || currentUser.id,
    actorType: 'user',
    action: 'CREATE_USER',
    targetId: newUser._id.toString(),
    targetType: 'User',
    ipAddress,
    details: { fullName: finalName, email: finalEmail, role: finalRole, staffCode: finalStaffCode },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const populated = await User.findById(newUser._id)
    .populate('departmentId', 'name code type location')
    .select('-passwordHash')
    .lean();

  return populated || newUser.toObject();
};

/**
 * 4. Cập nhật thông tin tài khoản
 */
const updateExistingUser = async (userId, data, currentUser, ipAddress = null) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  // Kiểm tra quyền hạn
  const isSelf = String(currentUser._id || currentUser.id) === String(userId);
  const editorRole = normalizeRole(currentUser.role || currentUser.primaryRole);
  const isElevated = GLOBAL_ADMIN_ROLES.includes(editorRole);

  if (isSelf && !isElevated) {
    // Cán bộ/Giảng viên tự cập nhật hồ sơ cá nhân: Không được tự nâng quyền, đổi lương, đổi mã CB hay chuyển khoa
    delete data.role;
    delete data.departmentId;
    delete data.staffCode;
    delete data.salaryCoefficient;
    delete data.salaryScale;
    delete data.annualLeaveQuota;
    delete data.isActive;
    delete data.roles;
    delete data.employmentStatus;
    delete data.startDate;
  } else if (editorRole === 'truong_khoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài khoa của mình.', 403);
    }
    // Trưởng khoa không được đổi vai trò hay chuyển khoa của nhân sự
    delete data.role;
    delete data.departmentId;
  }

  const targetRole = normalizeRole(user.role || user.primaryRole);
  const currentRole = normalizeRole(currentUser.role || currentUser.primaryRole);

  if (!isSelf) {
    // 1. Bảo vệ cấp trên: Chỉ Ban Giám Hiệu mới có quyền đổi trạng thái kích hoạt hoặc vai trò của BGH
    if (targetRole === 'bgh' && currentRole !== 'bgh') {
      if (data.isActive !== undefined || data.role !== undefined) {
        throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi trạng thái hoặc vai trò của tài khoản Ban Giám Hiệu.', 403);
      }
    }
    // 2. Bảo vệ ngang hàng: Admin không được tự ý đổi trạng thái kích hoạt hoặc vai trò của Admin cùng cấp
    if (targetRole === 'admin' && currentRole === 'admin') {
      if (data.isActive !== undefined || data.role !== undefined) {
        throw new ServiceError('Quản trị viên không thể tự ý thay đổi trạng thái hoặc vai trò của Quản trị viên cùng cấp. Thao tác này cần Ban Giám Hiệu thực hiện.', 403);
      }
    }
  }

  const {
    fullName,
    email,
    password,
    role,
    departmentId,
    staffCode,
    phoneNumber,
    position,
    academicRank,
    degree,
    staffType,
    contractType,
    salaryScale,
    salaryCoefficient,
    dependentsCount,
    annualLeaveQuota,
    gender,
    dateOfBirth,
    startDate,
    address,
    employmentStatus,
    avatar,
    isActive,
    roles,
  } = data;

  if (fullName) {
    user.fullName = fullName.trim();
  }

  if (email && email !== user.email) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
    if (existing) throw new ServiceError('Email này đã được tài khoản khác sử dụng.', 409);
    user.email = normalizedEmail;
  }

  if (staffCode) {
    const code = staffCode.trim().toUpperCase();
    const existing = await User.findOne({
      staffCode: code,
      _id: { $ne: userId },
    });
    if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    user.staffCode = code;
  }

  if (departmentId !== undefined) {
    user.departmentId = departmentId || null;
    user.don_vi_chinh_id = departmentId || null;
  }

  if (role) {
    const normRole = normalizeRole(role);
    user.role = normRole;
    user.primaryRole = normRole;
    user.vai_tro_chinh = normRole;
    if (roles === undefined) {
      user.roles = buildDefaultRolesArray(normRole, user.departmentId);
    }
  }

  // Xác thực tính nhất quán giữa vai trò và đơn vị khi cập nhật
  if (user.departmentId) {
    const dept = await Department.findById(user.departmentId);
    if (dept) {
      const isBghDept = (dept.name || '').toLowerCase().includes('giám hiệu');
      const uRole = normalizeRole(user.role);
      if (uRole === 'bgh' && !isBghDept) {
        throw new ServiceError('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.', 400);
      }
      if (['truong_khoa', 'pho_khoa'].includes(uRole) && dept.type !== 'khoa') {
        throw new ServiceError('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.', 400);
      }
      if (['truong_bo_mon', 'pho_bo_mon'].includes(uRole) && dept.type !== 'bo_mon' && dept.type !== 'bomon') {
        throw new ServiceError('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
      }
      if (uRole === 'giang_vien' && dept.type !== 'bo_mon' && dept.type !== 'bomon') {
        throw new ServiceError('Giảng viên bắt buộc phải trực thuộc một Bộ Môn cụ thể.', 400);
      }
      if (uRole === 'admin' && (dept.type === 'khoa' || dept.type === 'bo_mon' || dept.type === 'bomon')) {
        throw new ServiceError('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU, không thuộc Khoa/Bộ môn đào tạo.', 400);
      }
      if (isBghDept && !['bgh', 'admin'].includes(uRole)) {
        throw new ServiceError('Đơn vị Ban Giám Hiệu chỉ dành cho nhân sự thuộc Ban Giám Hiệu hoặc Quản trị viên.', 400);
      }
    }
  }

  if (phoneNumber !== undefined) {
    user.phoneNumber = phoneNumber || undefined;
  }

  if (position !== undefined) {
    user.position = position || '';
  }

  if (academicRank !== undefined) user.academicRank = academicRank;
  if (degree !== undefined) user.degree = degree;
  if (staffType !== undefined) user.staffType = staffType;
  if (contractType !== undefined) user.contractType = contractType;
  if (salaryScale !== undefined) user.salaryScale = salaryScale;
  if (salaryCoefficient !== undefined) user.salaryCoefficient = Number(salaryCoefficient);
  if (dependentsCount !== undefined) user.dependentsCount = Number(dependentsCount);
  if (annualLeaveQuota !== undefined) user.annualLeaveQuota = Number(annualLeaveQuota);
  if (gender !== undefined) user.gender = gender;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (startDate !== undefined) user.startDate = startDate ? new Date(startDate) : user.startDate;
  if (address !== undefined) user.address = address;
  if (employmentStatus !== undefined) user.employmentStatus = employmentStatus;
  if (avatar !== undefined) user.avatar = avatar || null;

  if (roles !== undefined) user.roles = roles;

  if (isActive !== undefined) {
    user.isActive = Boolean(isActive);
    if (!user.isActive) {
      user.tokenVersion = (user.tokenVersion || 1) + 1;
    }
  }

  // Cập nhật mật khẩu nếu có truyền
  if (password) {
    if (password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    user.passwordHash = hashed;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 1) + 1;
  }

  await user.save();

  AuditLog.create({
    actor: currentUser._id || currentUser.id,
    actorType: 'user',
    action: 'UPDATE_USER',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress,
    details: { updatedFields: Object.keys(data) },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const populated = await User.findById(user._id)
    .populate('departmentId', 'name code type location')
    .select('-passwordHash')
    .lean();

  return populated || user.toObject();
};

/**
 * 5. Khóa / Vô hiệu hóa tài khoản (Soft delete)
 */
const softDeleteUser = async (userId, currentUser, ipAddress = null) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  if (String(userId) === String(currentUser._id)) {
    throw new ServiceError('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const targetRole = normalizePrimaryRole(user.role || user.primaryRole);
  const currentRole = normalizePrimaryRole(currentUser.role || currentUser.primaryRole);

  // 1. Bảo vệ cấp trên: Tuyệt đối không ai được khóa Ban Giám Hiệu (BGH) ngoại trừ chính cấp BGH
  if (targetRole === 'bgh' && currentRole !== 'bgh') {
    throw new ServiceError('Chỉ Lãnh đạo Ban Giám Hiệu mới có quyền vô hiệu hóa tài khoản Ban Giám Hiệu.', 403);
  }

  // 2. Bảo vệ ngang hàng (Peer Protection): Admin không được tự ý khóa tài khoản Admin khác
  if (targetRole === 'admin' && currentRole === 'admin') {
    throw new ServiceError('Quản trị viên không thể tự ý khóa tài khoản Quản trị viên cùng cấp. Thao tác này cần Ban Giám Hiệu thực hiện.', 403);
  }

  user.isActive = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // Thu hồi toàn bộ token của user
  await user.save();

  // Hủy toàn bộ refresh token trong DB
  await RefreshToken.updateMany(
    { userId: user._id },
    { $set: { isUsed: true } }
  );

  AuditLog.create({
    actor: currentUser._id,
    actorType: 'user',
    action: 'SOFT_DELETE_USER',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress,
    details: { message: `Vô hiệu hóa tài khoản: ${user.email}` },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đã vô hiệu hóa tài khoản thành công.' };
};

module.exports = {
  ServiceError,
  fetchUsers,
  fetchUserById,
  createNewUser,
  updateExistingUser,
  softDeleteUser,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
};
