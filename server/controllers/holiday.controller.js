/**
 * Controller quản lý ngày nghỉ lễ (Holidays)
 */
const holidayService = require('../services/holiday.service');
const ServiceError = require('../utils/serviceError');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const getHolidays = async (req, res, next) => {
  try {
    const holidays = await holidayService.getHolidays(req.query);
    return sendSuccess(res, 'Lấy danh sách ngày nghỉ lễ thành công.', holidays);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const getHolidayById = async (req, res, next) => {
  try {
    const holiday = await holidayService.getHolidayById(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết ngày nghỉ lễ thành công.', holiday);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const createHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.createHoliday(req.body, req.user);
    return sendSuccess(res, 'Tạo mới ngày nghỉ lễ thành công.', holiday, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const updateHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.updateHoliday(req.params.id, req.body, req.user);
    return sendSuccess(res, 'Cập nhật ngày nghỉ lễ thành công.', holiday);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.deleteHoliday(req.params.id);
    return sendSuccess(res, `Đã xóa ngày nghỉ lễ "${holiday.ten_ngay_le}" thành công.`, holiday);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
