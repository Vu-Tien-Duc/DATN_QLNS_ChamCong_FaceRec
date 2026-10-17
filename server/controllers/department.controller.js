/**
 * Tiếp nhận API quản lý khoa/phòng ban, chuyển dữ liệu và ánh xạ kết quả nghiệp vụ sang HTTP.
 */
const departmentService = require('../services/department.service');
const { ServiceError } = departmentService;
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  if (error.code === 11000) {
    return sendError(res, 'Đơn vị mang tên này đã tồn tại trong cùng cấp phân cấp tổ chức.', null, 409);
  }
  next(error);
};

/**
 * @desc Lấy danh sách Khoa / Phòng ban (hỗ trợ cây phân cấp hoặc danh sách phẳng)
 * @route GET /api/v1/departments
 */
const getAllDepartments = async (req, res, next) => {
  try {
    const { type, parentId, tree = 'true', page, limit } = req.query;
    const result = await departmentService.getAllDepartments({ type, parentId, tree, page, limit });

    if (result.isTree) {
      return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban dạng cây thành công.', result.data);
    }
    return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban thành công.', result.data);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * @desc Lấy chi tiết Khoa / Phòng ban theo ID
 * @route GET /api/v1/departments/:id
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    return sendSuccess(res, 'Lấy thông tin Khoa / Phòng ban thành công.', department);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * @desc Tạo mới Khoa / Phòng ban
 * @route POST /api/v1/departments
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, type, parentId, managerId, location } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const department = await departmentService.createDepartment({
      name,
      type,
      parentId,
      managerId,
      location,
      actorId: req.user.id,
      ipAddress,
    });

    return sendSuccess(res, 'Tạo mới Khoa / Phòng ban thành công.', department, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * @desc Cập nhật Khoa / Phòng ban
 * @route PUT /api/v1/departments/:id
 */
const updateDepartment = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const department = await departmentService.updateDepartment({
      id: req.params.id,
      body: req.body,
      actorId: req.user.id,
      ipAddress,
    });

    return sendSuccess(res, 'Cập nhật Khoa / Phòng ban thành công.', department);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * @desc Xóa Khoa / Phòng ban
 * @route DELETE /api/v1/departments/:id
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await departmentService.deleteDepartment({
      id: req.params.id,
      actorId: req.user.id,
      ipAddress,
    });

    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
