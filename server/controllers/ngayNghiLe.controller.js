// Quản lý danh mục ngày nghỉ lễ trong năm để loại trừ khi tính phép và chấm công
const holidayService = require('../services/nhanSu/ngayNghiLe.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

// Lọc các trường hợp lệ của ngày nghỉ lễ từ request body
const mapHolidayBodyToCanonical = (body) => {
  if (!body || typeof body !== 'object') return {};
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta } = body;
  const res = {};
  if (ten_ngay_le !== undefined) res.ten_ngay_le = ten_ngay_le;
  if (ngay_bat_dau !== undefined) res.ngay_bat_dau = ngay_bat_dau;
  if (ngay_ket_thuc !== undefined) res.ngay_ket_thuc = ngay_ket_thuc;
  if (huong_luong !== undefined) res.huong_luong = huong_luong;
  if (mo_ta !== undefined) res.mo_ta = mo_ta;
  return res;
};

// Lấy danh sách ngày nghỉ lễ theo năm
const getHolidays = async (req, res) => {
  const holidays = await holidayService.getHolidays({ nam: req.query?.nam });
  return sendSuccess(res, 'Lấy danh sách ngày nghỉ lễ thành công.', holidays);
};

// Lấy chi tiết một ngày nghỉ lễ theo ID
const getHolidayById = async (req, res) => {
  const holiday = await holidayService.getHolidayById(req.params.id);
  return sendSuccess(res, 'Lấy chi tiết ngày nghỉ lễ thành công.', holiday);
};

// Tạo ngày nghỉ lễ mới
const createHoliday = async (req, res) => {
  const holiday = await holidayService.createHoliday(mapHolidayBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Tạo mới ngày nghỉ lễ thành công.', holiday, 201);
};

// Cập nhật thông tin ngày nghỉ lễ
const updateHoliday = async (req, res) => {
  const holiday = await holidayService.updateHoliday(req.params.id, mapHolidayBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Cập nhật ngày nghỉ lễ thành công.', holiday);
};

// Xóa ngày nghỉ lễ
const deleteHoliday = async (req, res) => {
  const holiday = await holidayService.deleteHoliday(req.params.id, req.user);
  return sendSuccess(res, `Đã xóa ngày nghỉ lễ "${holiday.ten_ngay_le}" thành công.`, holiday);
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
