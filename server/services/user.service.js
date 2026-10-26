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

const ADMIN_ROLE = 'admin';
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const normalizePrimaryRole = (roleInput) => {
  const raw = String(roleInput || 'giangvien').trim().toLowerCase();
  const map = {
    truong_khoa: 'truongkhoa',
    pho_khoa: 'phokhoa',
    pho_truong_khoa: 'phokhoa',
    truong_bo_mon: 'truongbomon',
    pho_bo_mon: 'phobomon',
    giang_vien: 'giangvien',
    nhan_vien: 'nhanvien',
    chuyen_vien: 'nhanvien',
  };
  return map[raw] || raw;
};

const buildDefaultRolesArray = (roleStr, departmentId = null) => {
  const norm = normalizePrimaryRole(roleStr);
  let rbacRole = 'GIANG_VIEN';
  let scope = departmentId ? 'KHOA' : 'TOAN_TRUONG';

  if (norm === 'admin') {
    rbacRole = 'ADMIN';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'bgh') {
    rbacRole = 'BGH';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'tccb') {
    rbacRole = 'TCCB';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'dao_tao') {
    rbacRole = 'DAO_TAO';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'ke_toan') {
    rbacRole = 'KE_TOAN';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'kiem_toan') {
    rbacRole = 'KIEM_TOAN';
    scope = 'TOAN_TRUONG';
  } else if (norm === 'truongkhoa') {
    rbacRole = 'TRUONG_KHOA';
    scope = 'KHOA';
  } else if (norm === 'phokhoa') {
    rbacRole = 'PHO_TRUONG_KHOA';
    scope = 'KHOA';
  } else if (norm === 'truongbomon') {
    rbacRole = 'TRUONG_BO_MON';
    scope = 'BO_MON';
  } else if (norm === 'nhanvien') {
    rbacRole = 'CHUYEN_VIEN';
    scope = departmentId ? 'PHONG_BAN' : 'TOAN_TRUONG';
  } else {
    rbacRole = 'GIANG_VIEN';
    scope = departmentId ? 'KHOA' : 'TOAN_TRUONG';
  }

  return [{ role: rbacRole, scope, departmentId: departmentId || null }];
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

  // Giới hạn phạm vi quyền Trưởng khoa
  const userRole = (currentUser.role || '').toLowerCase();
  if (userRole === 'truongkhoa') {
    if (!currentUser.departmentId) {
      throw new ServiceError('Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.', 403);
    }
    const departmentIds = await getDeanDepartmentIds(currentUser);
    query.departmentId = { $in: departmentIds };
  } else if (departmentId) {
    const validId = typeof departmentId === 'string' && mongoose.isValidObjectId(departmentId)
      ? new mongoose.Types.ObjectId(departmentId)
      : departmentId;
    query.departmentId = validId;
  }

  if (role) {
    query.primaryRole = normalizePrimaryRole(role);
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
    $or: [{ nguoi_dung_id: { $in: userIds } }, { userId: { $in: userIds } }],
  }).select('nguoi_dung_id userId ngay_dang_ky so_luong_mau').lean();

  const templateMap = new Map();
  for (const t of templates) {
    const uid = (t.nguoi_dung_id || t.userId)?.toString();
    if (uid) templateMap.set(uid, t);
  }

  const mappedUsers = users.map((u) => {
    const t = templateMap.get(u._id.toString());
    const isFaceReg =
      Boolean(t) ||
      Boolean(u.da_dang_ky_face) ||
      Boolean(u.isFaceRegistered);

    const deptObj =
      u.departmentId && typeof u.departmentId === 'object'
        ? u.departmentId
        : u.don_vi_chinh_id && typeof u.don_vi_chinh_id === 'object'
          ? u.don_vi_chinh_id
          : null;

    const departmentName = deptObj ? (deptObj.name || deptObj.ten_phong_ban || '') : '';
    const staffCode = u.staffCode || u.ma_can_bo || '';
    const roleVal = u.role || u.primaryRole || u.vai_tro_chinh || 'giangvien';
    const avatarVal = u.anh_dai_dien || u.avatar || u.anh_khuon_mat || u.facePhoto || null;
    const facePhotoVal = u.anh_khuon_mat || u.facePhoto || null;

    return {
      ...u,
      fullName: u.fullName || u.ho_ten || '',
      role: roleVal,
      primaryRole: roleVal,
      staffCode,
      phoneNumber: u.phoneNumber || u.so_dien_thoai || '',
      position: u.position || u.chuc_vu || '',
      academicRank: u.academicRank || u.hoc_ham || 'KHONG',
      degree: u.degree || u.hoc_vi || 'CU_NHAN',
      staffType: u.staffType || u.loai_nhan_su || 'GIANG_VIEN',
      contractType: u.contractType || u.loai_hop_dong || 'TOAN_THOI_GIAN',
      salaryScale: u.salaryScale || u.ngach_luong || 'V.07.01.03',
      salaryCoefficient: u.salaryCoefficient ?? u.he_so_luong ?? 2.34,
      dependentsCount: u.dependentsCount ?? u.so_nguoi_phu_thuoc ?? 0,
      annualLeaveQuota: u.annualLeaveQuota ?? u.so_ngay_phep_nam ?? 12,
      gender: u.gender || u.gioi_tinh || 'NAM',
      employmentStatus: u.employmentStatus || u.trang_thai_lam_viec || 'DANG_LAM_VIEC',
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
  const viewerRole = (currentUser.role || '').toLowerCase();
  if (!isSelf && viewerRole === 'truongkhoa') {
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
  const finalRole = normalizePrimaryRole(role || 'giangvien');
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
    if (['truongkhoa', 'phokhoa'].includes(finalRole) && dept.type !== 'khoa') {
      throw new ServiceError('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.', 400);
    }
    if (finalRole === 'truongbomon' && dept.type !== 'bomon') {
      throw new ServiceError('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
    }
    if (finalRole === 'giangvien' && dept.type !== 'bomon') {
      throw new ServiceError('Giảng viên bắt buộc phải trực thuộc một Bộ Môn cụ thể.', 400);
    }
    if (finalRole === 'admin' && (dept.type === 'khoa' || dept.type === 'bomon')) {
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
    academicRank: academicRank || 'KHONG',
    degree: degree || 'CU_NHAN',
    staffType: staffType || (finalRole === 'giangvien' ? 'GIANG_VIEN' : 'HANH_CHINH'),
    contractType: contractType || 'TOAN_THOI_GIAN',
    salaryScale: salaryScale || 'V.07.01.03',
    salaryCoefficient: salaryCoefficient !== undefined ? Number(salaryCoefficient) : 2.34,
    dependentsCount: dependentsCount !== undefined ? Number(dependentsCount) : 0,
    annualLeaveQuota: annualLeaveQuota !== undefined ? Number(annualLeaveQuota) : 12,
    gender: gender || 'NAM',
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    startDate: startDate ? new Date(startDate) : new Date(),
    address: address || '',
    employmentStatus: employmentStatus || 'DANG_LAM_VIEC',
    avatar: avatar || null,
    roles: Array.isArray(roles) && roles.length > 0 ? roles : buildDefaultRolesArray(finalRole, finalDeptId),
    isActive: true,
    isVerified: true,
    tokenVersion: 1,
  });

  AuditLog.create({
    actor: currentUser._id || currentUser.id,
    actorType: 'USER',
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
  const editorRole = (currentUser.role || '').toLowerCase();
  const isElevated = ['admin', 'bgh', 'tccb'].includes(editorRole);

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
  } else if (editorRole === 'truongkhoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài khoa của mình.', 403);
    }
    // Trưởng khoa không được đổi vai trò hay chuyển khoa của nhân sự
    delete data.role;
    delete data.departmentId;
  }

  const targetRole = normalizePrimaryRole(user.role || user.primaryRole);
  const currentRole = normalizePrimaryRole(currentUser.role || currentUser.primaryRole);

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
    const normRole = normalizePrimaryRole(role);
    user.role = normRole;
    user.primaryRole = normRole;
    if (roles === undefined) {
      user.roles = buildDefaultRolesArray(normRole, user.departmentId);
    }
  }

  // Xác thực tính nhất quán giữa vai trò và đơn vị khi cập nhật
  if (user.departmentId) {
    const dept = await Department.findById(user.departmentId);
    if (dept) {
      const isBghDept = (dept.name || '').toLowerCase().includes('giám hiệu');
      if (user.role === 'bgh' && !isBghDept) {
        throw new ServiceError('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.', 400);
      }
      if (['truongkhoa', 'phokhoa'].includes(user.role) && dept.type !== 'khoa') {
        throw new ServiceError('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.', 400);
      }
      if (user.role === 'truongbomon' && dept.type !== 'bomon') {
        throw new ServiceError('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
      }
      if (user.role === 'giangvien' && dept.type !== 'bomon') {
        throw new ServiceError('Giảng viên bắt buộc phải trực thuộc một Bộ Môn cụ thể.', 400);
      }
      if (user.role === 'admin' && (dept.type === 'khoa' || dept.type === 'bomon')) {
        throw new ServiceError('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU, không thuộc Khoa/Bộ môn đào tạo.', 400);
      }
      if (isBghDept && !['bgh', 'admin'].includes(user.role)) {
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
    actorType: 'USER',
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
    { $set: { isUsed: true, da_su_dung: true } }
  );

  AuditLog.create({
    actor: currentUser._id,
    actorType: 'USER',
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
