/**
 * Controller quản lý ngày nghỉ lễ (Holidays)
 */
const holidayService = require('../services/nhanSu/ngayNghiLe.service');
const ServiceError = require('../utils/loiNghiepVu');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const mapHolidayBodyToCanonical = (body) => {
  if (!body || typeof body !== 'object') return {};
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta, nam } = body;
  const res = {};
  if (ten_ngay_le !== undefined) res.ten_ngay_le = ten_ngay_le;
  if (ngay_bat_dau !== undefined) res.ngay_bat_dau = ngay_bat_dau;
  if (ngay_ket_thuc !== undefined) res.ngay_ket_thuc = ngay_ket_thuc;
  if (huong_luong !== undefined) res.huong_luong = huong_luong;
  if (mo_ta !== undefined) res.mo_ta = mo_ta;
  if (nam !== undefined) res.nam = nam;
  return res;
};

const getHolidays = async (req, res, next) => {
  try {
    const nam = req.query?.nam;
    const holidays = await holidayService.getHolidays({ nam });
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
    const holiday = await holidayService.createHoliday(mapHolidayBodyToCanonical(req.body), req.user);
    return sendSuccess(res, 'Tạo mới ngày nghỉ lễ thành công.', holiday, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const updateHoliday = async (req, res, next) => {
  try {
    const holiday = await holidayService.updateHoliday(req.params.id, mapHolidayBodyToCanonical(req.body), req.user);
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
