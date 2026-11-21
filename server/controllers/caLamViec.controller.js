// Quản lý danh mục ca làm việc (giờ vào, giờ ra, ngưỡng đi muộn)
const shiftService = require('../services/nhanSu/caLamViec.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleError = (res, error, next) => {
  if (error instanceof shiftService.ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

// Lọc các trường hợp lệ của ca làm việc từ request body
const mapShiftBodyToCanonical = (body) => {
  if (!body || typeof body !== 'object') return {};
  const { ten_ca, gio_bat_dau, gio_ket_thuc, nguong_di_muon_phut, kich_hoat } = body;
  const res = {};
  if (ten_ca !== undefined) res.ten_ca = ten_ca;
  if (gio_bat_dau !== undefined) res.gio_bat_dau = gio_bat_dau;
  if (gio_ket_thuc !== undefined) res.gio_ket_thuc = gio_ket_thuc;
  if (nguong_di_muon_phut !== undefined) res.nguong_di_muon_phut = nguong_di_muon_phut;
  if (kich_hoat !== undefined) res.kich_hoat = kich_hoat;
  return res;
};

// Lấy danh sách toàn bộ ca làm việc
const getAllShiftConfigs = async (req, res, next) => {
  try {
    const shifts = await shiftService.getAllShiftConfigs();
    return sendSuccess(res, 'Lấy danh sách ca làm việc thành công.', shifts);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Lấy chi tiết một ca làm việc theo ID
const getShiftConfigById = async (req, res, next) => {
  try {
    const shift = await shiftService.getShiftConfigById(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết ca làm việc thành công.', shift);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Tạo ca làm việc mới
const createShiftConfig = async (req, res, next) => {
  try {
    const shift = await shiftService.createShiftConfig(mapShiftBodyToCanonical(req.body), req.user);
    return sendSuccess(res, 'Tạo mới ca làm việc thành công.', shift, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Cập nhật thông tin ca làm việc
const updateShiftConfig = async (req, res, next) => {
  try {
    const shift = await shiftService.updateShiftConfig(req.params.id, mapShiftBodyToCanonical(req.body), req.user);
    return sendSuccess(res, 'Cập nhật ca làm việc thành công.', shift);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Xóa ca làm việc
const deleteShiftConfig = async (req, res, next) => {
  try {
    await shiftService.deleteShiftConfig(req.params.id, req.user);
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
