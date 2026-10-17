/**
 * Tiếp nhận các API tra cứu và quản lý cấu hình ca làm việc, trả kết quả theo chuẩn HTTP.
 */
const shiftService = require('../services/shiftConfig.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleError = (res, error, next) => {
  if (error instanceof shiftService.ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const getAllShiftConfigs = async (req, res, next) => {
  try {
    const shifts = await shiftService.getAllShiftConfigs();
    return sendSuccess(res, 'Lấy danh sách ca làm việc thành công.', shifts);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const getShiftConfigById = async (req, res, next) => {
  try {
    const shift = await shiftService.getShiftConfigById(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết ca làm việc thành công.', shift);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const createShiftConfig = async (req, res, next) => {
  try {
    const shift = await shiftService.createShiftConfig(req.body);
    return sendSuccess(res, 'Tạo mới ca làm việc thành công.', shift, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const updateShiftConfig = async (req, res, next) => {
  try {
    const shift = await shiftService.updateShiftConfig(req.params.id, req.body);
    return sendSuccess(res, 'Cập nhật ca làm việc thành công.', shift);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const deleteShiftConfig = async (req, res, next) => {
  try {
    await shiftService.deleteShiftConfig(req.params.id);
    return sendSuccess(res, 'Xóa ca làm việc thành công.');
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
};
