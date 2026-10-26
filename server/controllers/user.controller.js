/**
 * User Management Controller (server/controllers/user.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Lấy danh sách nhân sự (getAllUsers).
 * - Lấy chi tiết thông tin cá nhân (getUserById).
 * - Thêm mới cán bộ / giảng viên (createUser).
 * - Cập nhật hồ sơ nhân sự (updateUser).
 * - Vô hiệu hóa tài khoản (deleteUser - Soft delete).
 * - Đăng ký / Xóa Face ID đồng bộ FAISS RAM (registerFaceDescriptor, deleteFaceDescriptor).
 */
const {
  ServiceError,
  fetchUsers,
  fetchUserById,
  createNewUser,
  updateExistingUser,
  softDeleteUser,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
} = require('../services/user.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

/**
 * 1. Lấy danh sách người dùng
 * @route GET /api/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, departmentId, isActive, search, page, limit } = req.query;
    const result = await fetchUsers({
      role,
      departmentId,
      isActive,
      search,
      page,
      limit,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Lấy chi tiết người dùng
 * @route GET /api/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await fetchUserById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết người dùng thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Tạo mới tài khoản
 * @route POST /api/users
 */
const createUser = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const newUser = await createNewUser(req.body, req.user, ipAddress);
    return sendSuccess(res, 'Thêm mới tài khoản người dùng thành công.', newUser, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 4. Cập nhật tài khoản
 * @route PUT /api/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const updatedUser = await updateExistingUser(req.params.id, req.body, req.user, ipAddress);
    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', updatedUser);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Khóa / Vô hiệu hóa tài khoản (Soft delete)
 * @route DELETE /api/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const result = await softDeleteUser(req.params.id, req.user, ipAddress);
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Đăng ký vector Face ID cho người dùng
 * @route POST /api/users/:id/face-descriptor
 */
const registerFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { faceDescriptor, force, sampleAngles, aiModel } = req.body;
    const files = req.files || (req.file ? [req.file] : []);

    let result;
    if (files.length > 0) {
      result = await registerFaceImagesForUser({
        id,
        files,
        sampleAngles,
        force: force === 'true' || force === true,
        currentUser: req.user,
        ip: req.ip,
      });
    } else {
      result = await registerFaceDescriptorForUser({
        id,
        descriptor: faceDescriptor,
        force,
        sampleAngles,
        aiModel,
        currentUser: req.user,
        ip: req.ip,
      });
    }

    return sendSuccess(res, 'Đăng ký nhận diện khuôn mặt thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Xóa dữ liệu Face ID của người dùng
 * @route DELETE /api/users/:id/face-descriptor hoặc DELETE /api/users/:id/face
 */
const deleteFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await removeFaceDescriptorForUser({
      id,
      currentUser: req.user,
      ip: req.ip,
    });
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  registerFaceDescriptor,
  deleteFaceDescriptor,
};
