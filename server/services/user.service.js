/**
 * User Management Service (server/services/user.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Quản lý danh sách cán bộ, giảng viên, nhân viên nhà trường.
 * - Phân quyền quản lý theo Khoa/Phòng ban (Trưởng khoa chỉ xem/sửa nhân sự khoa mình).
 * - Tạo mới, cập nhật, khóa/vô hiệu hóa tài khoản (Soft delete + tăng phien_ban_token).
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
  const userRole = (currentUser.role || currentUser.vai_tro || '').toLowerCase();
  if (userRole === 'truongkhoa') {
    if (!currentUser.departmentId && !currentUser.ma_don_vi) {
      throw new ServiceError('Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.', 403);
    }
    const departmentIds = await getDeanDepartmentIds(currentUser);
    query.$or = [
      { departmentId: { $in: departmentIds } },
      { ma_don_vi: { $in: departmentIds } },
    ];
  } else if (departmentId) {
    const validId = typeof departmentId === 'string' && mongoose.isValidObjectId(departmentId)
      ? new mongoose.Types.ObjectId(departmentId)
      : departmentId;
    query.$or = [{ departmentId: validId }, { ma_don_vi: validId }];
  }

  if (role) {
    query.$or = [{ role }, { vai_tro: role }];
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { fullName: { $regex: safeSearch, $options: 'i' } },
      { ho_ten: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
      { staffCode: { $regex: safeSearch, $options: 'i' } },
      { ma_can_bo: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query)
      .populate('departmentId', 'name code type location ten_don_vi ma_khoa')
      .select('-mat_khau_ma_hoa -passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
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
    .populate('departmentId', 'name code type location ten_don_vi ma_khoa')
    .select('-mat_khau_ma_hoa -passwordHash');

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  // Kiểm tra quyền hạn nếu là Trưởng khoa
  const viewerRole = (currentUser.role || currentUser.vai_tro || '').toLowerCase();
  if (viewerRole === 'truongkhoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || user.ma_don_vi || '');
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
    ho_ten,
    email,
    password,
    role,
    vai_tro,
    departmentId,
    ma_don_vi,
    staffCode,
    ma_can_bo,
    phoneNumber,
    so_dien_thoai,
    position,
    chuc_vu,
    he_so_luong,
    phu_cap_chuc_vu,
    danh_sach_vai_tro,
  } = data;

  const finalName = (fullName || ho_ten || '').trim();
  const finalEmail = (email || '').trim().toLowerCase();
  const finalStaffCode = (staffCode || ma_can_bo || '').trim();
  const finalRole = (role || vai_tro || 'giangvien').toLowerCase();
  const finalDeptId = departmentId || ma_don_vi;

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
  const existingStaffCode = await User.findOne({
    $or: [{ staffCode: finalStaffCode }, { ma_can_bo: finalStaffCode }],
  });
  if (existingStaffCode) {
    throw new ServiceError('Mã cán bộ này đã tồn tại trên hệ thống.', 409);
  }

  // Kiểm tra khoa/phòng ban nếu có truyền
  if (finalDeptId) {
    const dept = await Department.findById(finalDeptId);
    if (!dept) throw new ServiceError('Khoa/Phòng ban không tồn tại trên hệ thống.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    fullName: finalName,
    ho_ten: finalName,
    email: finalEmail,
    mat_khau_ma_hoa: hashedPassword,
    passwordHash: hashedPassword,
    staffCode: finalStaffCode,
    ma_can_bo: finalStaffCode,
    role: finalRole,
    vai_tro: finalRole,
    departmentId: finalDeptId || null,
    ma_don_vi: finalDeptId || null,
    phoneNumber: phoneNumber || so_dien_thoai || null,
    so_dien_thoai: so_dien_thoai || phoneNumber || null,
    position: position || chuc_vu || null,
    chuc_vu: chuc_vu || position || null,
    he_so_luong: he_so_luong || 2.34,
    phu_cap_chuc_vu: phu_cap_chuc_vu || 0,
    danh_sach_vai_tro: danh_sach_vai_tro || [{ vai_tro: finalRole, don_vi_id: finalDeptId || null }],
    isActive: true,
    trang_thai: 'HOAT_DONG',
    phien_ban_token: 0,
  });

  AuditLog.create({
    actor: currentUser._id,
    actorType: 'USER',
    action: 'CREATE_USER',
    targetId: newUser._id.toString(),
    targetType: 'User',
    ipAddress,
    details: { fullName: finalName, email: finalEmail, role: finalRole, staffCode: finalStaffCode },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const result = newUser.toObject();
  delete result.mat_khau_ma_hoa;
  delete result.passwordHash;
  return result;
};

/**
 * 4. Cập nhật thông tin tài khoản
 */
const updateExistingUser = async (userId, data, currentUser, ipAddress = null) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  const user = await User.findById(userId).select('+mat_khau_ma_hoa +passwordHash');
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  // Kiểm tra quyền hạn Trưởng khoa
  const editorRole = (currentUser.role || currentUser.vai_tro || '').toLowerCase();
  if (editorRole === 'truongkhoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || user.ma_don_vi || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài khoa của mình.', 403);
    }
    // Trưởng khoa không được đổi vai trò hay chuyển khoa của nhân sự
    delete data.role;
    delete data.vai_tro;
    delete data.departmentId;
    delete data.ma_don_vi;
  }

  const {
    fullName,
    ho_ten,
    email,
    password,
    role,
    vai_tro,
    departmentId,
    ma_don_vi,
    staffCode,
    ma_can_bo,
    phoneNumber,
    so_dien_thoai,
    position,
    chuc_vu,
    he_so_luong,
    phu_cap_chuc_vu,
    isActive,
    trang_thai,
    danh_sach_vai_tro,
  } = data;

  if (fullName || ho_ten) {
    user.fullName = (fullName || ho_ten).trim();
    user.ho_ten = user.fullName;
  }

  if (email && email !== user.email) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
    if (existing) throw new ServiceError('Email này đã được tài khoản khác sử dụng.', 409);
    user.email = normalizedEmail;
  }

  if (staffCode || ma_can_bo) {
    const code = (staffCode || ma_can_bo).trim();
    const existing = await User.findOne({
      $or: [{ staffCode: code }, { ma_can_bo: code }],
      _id: { $ne: userId },
    });
    if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    user.staffCode = code;
    user.ma_can_bo = code;
  }

  if (role || vai_tro) {
    user.role = (role || vai_tro).toLowerCase();
    user.vai_tro = user.role;
  }

  if (departmentId !== undefined || ma_don_vi !== undefined) {
    user.departmentId = departmentId || ma_don_vi || null;
    user.ma_don_vi = user.departmentId;
  }

  if (phoneNumber !== undefined || so_dien_thoai !== undefined) {
    user.phoneNumber = phoneNumber || so_dien_thoai || null;
    user.so_dien_thoai = user.phoneNumber;
  }

  if (position !== undefined || chuc_vu !== undefined) {
    user.position = position || chuc_vu || null;
    user.chuc_vu = user.position;
  }

  if (he_so_luong !== undefined) user.he_so_luong = he_so_luong;
  if (phu_cap_chuc_vu !== undefined) user.phu_cap_chuc_vu = phu_cap_chuc_vu;
  if (danh_sach_vai_tro !== undefined) user.danh_sach_vai_tro = danh_sach_vai_tro;

  if (isActive !== undefined) {
    user.isActive = Boolean(isActive);
    user.trang_thai = user.isActive ? 'HOAT_DONG' : 'KHOA';
    if (!user.isActive) {
      user.phien_ban_token = (user.phien_ban_token || 0) + 1;
    }
  }

  if (trang_thai !== undefined) {
    user.trang_thai = trang_thai;
    user.isActive = trang_thai !== 'KHOA';
    if (trang_thai === 'KHOA') {
      user.phien_ban_token = (user.phien_ban_token || 0) + 1;
    }
  }

  // Cập nhật mật khẩu nếu có truyền
  if (password) {
    if (password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    user.mat_khau_ma_hoa = hashed;
    user.passwordHash = hashed;
    user.passwordChangedAt = new Date();
    user.phien_ban_token = (user.phien_ban_token || 0) + 1;
  }

  await user.save();

  AuditLog.create({
    actor: currentUser._id,
    actorType: 'USER',
    action: 'UPDATE_USER',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress,
    details: { updatedFields: Object.keys(data) },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const result = user.toObject();
  delete result.mat_khau_ma_hoa;
  delete result.passwordHash;
  return result;
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

  user.isActive = false;
  user.trang_thai = 'KHOA';
  user.phien_ban_token = (user.phien_ban_token || 0) + 1; // Thu hồi toàn bộ token của user
  await user.save();

  // Hủy toàn bộ refresh token trong DB
  await RefreshToken.updateMany(
    { $or: [{ ma_nguoi_dung: user._id }, { userId: user._id }] },
    { $set: { da_su_dung: true, isUsed: true, trang_thai: 'DA_THU_HOI' } }
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
