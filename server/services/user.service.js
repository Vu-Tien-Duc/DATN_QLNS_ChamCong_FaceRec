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
    query.role = role;
  }

  if (isActive !== undefined) {
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
      .populate('departmentId', 'name code type location')
      .select('-passwordHash')
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
    .populate('departmentId', 'name code type location')
    .select('-passwordHash');

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  // Kiểm tra quyền hạn nếu là Trưởng khoa
  const viewerRole = (currentUser.role || '').toLowerCase();
  if (viewerRole === 'truongkhoa') {
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
    roles,
  } = data;

  const finalName = (fullName || '').trim();
  const finalEmail = (email || '').trim().toLowerCase();
  const finalStaffCode = (staffCode || '').trim();
  const finalRole = (role || 'giangvien').toLowerCase();
  const finalDeptId = departmentId;

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
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    fullName: finalName,
    email: finalEmail,
    passwordHash: hashedPassword,
    staffCode: finalStaffCode,
    role: finalRole,
    departmentId: finalDeptId || null,
    phoneNumber: phoneNumber || null,
    position: position || null,
    roles: roles || [{ role: finalRole, departmentId: finalDeptId || null }],
    isActive: true,
    tokenVersion: 0,
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

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  // Kiểm tra quyền hạn Trưởng khoa
  const editorRole = (currentUser.role || '').toLowerCase();
  if (editorRole === 'truongkhoa') {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map((id) => String(id));
    const userDeptId = String(user.departmentId?._id || user.departmentId || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài khoa của mình.', 403);
    }
    // Trưởng khoa không được đổi vai trò hay chuyển khoa của nhân sự
    delete data.role;
    delete data.departmentId;
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
    const code = staffCode.trim();
    const existing = await User.findOne({
      staffCode: code,
      _id: { $ne: userId },
    });
    if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    user.staffCode = code;
  }

  if (role) {
    user.role = role.toLowerCase();
  }

  if (departmentId !== undefined) {
    user.departmentId = departmentId || null;
  }

  if (phoneNumber !== undefined) {
    user.phoneNumber = phoneNumber || null;
  }

  if (position !== undefined) {
    user.position = position || null;
  }

  if (roles !== undefined) user.roles = roles;

  if (isActive !== undefined) {
    user.isActive = Boolean(isActive);
    if (!user.isActive) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
  }

  // Cập nhật mật khẩu nếu có truyền
  if (password) {
    if (password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    user.passwordHash = hashed;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
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
