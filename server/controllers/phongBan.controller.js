// Quản lý cơ cấu Khoa, Bộ môn, Phòng ban (danh sách phẳng, cây phân cấp, thêm/sửa/xóa)
const departmentService = require('../services/nhanSu/phongBan.service');
const { ServiceError } = departmentService;
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  if (error.code === 11000) {
    return sendError(res, 'Đơn vị mang tên này đã tồn tại trong cùng cấp phân cấp tổ chức.', null, 409);
  }
  next(error);
};

// GET /api/phong-ban - Danh sách Khoa / Phòng ban (phẳng hoặc dạng cây)
const getAllDepartments = async (req, res, next) => {
  try {
    const { loai_don_vi: type, don_vi_cha_id: parentId, cay: tree = 'false', trang: page, gioi_han: limit } = req.query;
    const result = await departmentService.getAllDepartments({ type, parentId, tree, page, limit });

    if (result.isTree) {
      return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban dạng cây thành công.', result.data);
    }
    return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban thành công.', result.data);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/phong-ban/:id - Chi tiết Khoa / Phòng ban
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    return sendSuccess(res, 'Lấy thông tin Khoa / Phòng ban thành công.', department);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/phong-ban - Tạo mới Khoa / Phòng ban
const createDepartment = async (req, res, next) => {
  try {
    const {
      ten_phong_ban: resolvedName,
      loai_don_vi: resolvedType,
      don_vi_cha_id: resolvedParentId,
      truong_don_vi_id: resolvedManagerId,
      toa_do,
      vi_do,
      kinh_do,
      ban_kinh_met,
    } = req.body || {};

    const resolvedRadius = ban_kinh_met !== undefined ? ban_kinh_met : 200;
    const resolvedLat = toa_do?.vi_do ?? vi_do ?? null;
    const resolvedLng = toa_do?.kinh_do ?? kinh_do ?? null;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const department = await departmentService.createDepartment({
      name: resolvedName,
      type: resolvedType,
      parentId: resolvedParentId,
      managerId: resolvedManagerId,
      location: toa_do || { lat: resolvedLat, lng: resolvedLng },
      latitude: resolvedLat,
      longitude: resolvedLng,
      radiusMeters: resolvedRadius,
      actorId: req.user._id,
      ipAddress,
    });

    return sendSuccess(res, 'Tạo mới Khoa / Phòng ban thành công.', department, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/phong-ban/:id - Cập nhật Khoa / Phòng ban
const updateDepartment = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const department = await departmentService.updateDepartment({
      id: req.params.id,
      body: req.body,
      actorId: req.user._id,
      ipAddress,
    });

    return sendSuccess(res, 'Cập nhật Khoa / Phòng ban thành công.', department);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// DELETE /api/phong-ban/:id - Xóa Khoa / Phòng ban
const deleteDepartment = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await departmentService.deleteDepartment({
      id: req.params.id,
      actorId: req.user._id,
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
