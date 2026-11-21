// Quản lý danh sách ngày nghỉ lễ trong năm.
const { Op } = require('sequelize');
const { NgayNghiLe, NhatKyKiemToan } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid } = require('../../utils/hoTroSequelize');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Kiểm tra ngày lịch dương lịch thực sự tồn tại (chặn 2026-02-30, 2026-04-31...)
const isValidCalendarDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value.trim())) return false;
  const [y, m, d] = value.trim().split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
};

const recordHolidayAudit = (currentUser, action, holidayId, detail) => {
  if (!currentUser?.id) return;
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: action,
    doi_tuong_id: String(holidayId),
    loai_doi_tuong: 'ngay_nghi_le',
    chi_tiet: detail,
  }).catch((err) => console.error('[AuditLog Error]:', err.message));
};

// Lấy danh sách ngày nghỉ lễ (hỗ trợ lọc theo năm, bao gồm kỳ nghỉ vắt qua 2 năm)
const getHolidays = async (query = {}) => {
  const year = query.nam;
  const where = {};
  if (year !== undefined && year !== null && String(year).trim() !== '') {
    const yearNum = Number(String(year).trim());
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      throw new ServiceError('Tham số năm (nam) không hợp lệ.', 400, 'INVALID_YEAR');
    }
    where.ngay_bat_dau = { [Op.lte]: `${yearNum}-12-31` };
    where.ngay_ket_thuc = { [Op.gte]: `${yearNum}-01-01` };
  }

  return NgayNghiLe.findAll({
    where,
    order: [['ngay_bat_dau', 'ASC']],
  });
};

// Lấy chi tiết một ngày nghỉ lễ theo ID
const getHolidayById = async (id) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('ID ngày nghỉ lễ không hợp lệ.', 400, 'INVALID_ID');
  }
  const holiday = await NgayNghiLe.findByPk(id);
  if (!holiday) {
    throw new ServiceError('Không tìm thấy ngày nghỉ lễ yêu cầu.', 404, 'HOLIDAY_NOT_FOUND');
  }
  return holiday;
};

const assertNoOverlappingHoliday = async (startDate, endDate, excludeId = null) => {
  const overlap = await NgayNghiLe.findOne({
    where: {
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      ngay_bat_dau: { [Op.lte]: endDate },
      ngay_ket_thuc: { [Op.gte]: startDate },
    },
  });
  if (overlap) {
    throw new ServiceError(
      `Khoảng ngày nghỉ lễ trùng với kỳ nghỉ "${overlap.ten_ngay_le}" (${overlap.ngay_bat_dau} → ${overlap.ngay_ket_thuc}).`,
      409,
      'HOLIDAY_OVERLAP'
    );
  }
};

// Tạo mới ngày nghỉ lễ sau khi kiểm tra định dạng ngày và trùng lặp
const createHoliday = async (data = {}, currentUser = null) => {
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta } = data;

  const name = typeof ten_ngay_le === 'string' ? ten_ngay_le.trim() : '';
  const startDate = typeof ngay_bat_dau === 'string' ? ngay_bat_dau.trim() : '';
  const endDate = typeof ngay_ket_thuc === 'string' ? ngay_ket_thuc.trim() : '';
  const isPaid = huong_luong !== undefined ? Boolean(huong_luong) : true;
  const description = mo_ta !== undefined && mo_ta !== null && String(mo_ta).trim() ? String(mo_ta).trim() : null;

  if (!name) {
    throw new ServiceError('Tên ngày nghỉ lễ là bắt buộc.', 400, 'HOLIDAY_NAME_REQUIRED');
  }
  if (!startDate || !isValidCalendarDate(startDate)) {
    throw new ServiceError('Ngày bắt đầu không hợp lệ (yêu cầu YYYY-MM-DD tồn tại trong lịch).', 400, 'HOLIDAY_START_DATE_INVALID');
  }
  if (!endDate || !isValidCalendarDate(endDate)) {
    throw new ServiceError('Ngày kết thúc không hợp lệ (yêu cầu YYYY-MM-DD tồn tại trong lịch).', 400, 'HOLIDAY_END_DATE_INVALID');
  }
  if (startDate > endDate) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400, 'HOLIDAY_DATE_RANGE_INVALID');
  }

  await assertNoOverlappingHoliday(startDate, endDate);

  const created = await NgayNghiLe.create({
    ten_ngay_le: name,
    ngay_bat_dau: startDate,
    ngay_ket_thuc: endDate,
    huong_luong: isPaid,
    mo_ta: description,
  });
  recordHolidayAudit(currentUser, 'CREATE_HOLIDAY', created.id, {
    ten_ngay_le: created.ten_ngay_le,
    ngay_bat_dau: created.ngay_bat_dau,
    ngay_ket_thuc: created.ngay_ket_thuc,
  });
  return created;
};

// Cập nhật thông tin ngày nghỉ lễ
const updateHoliday = async (id, data = {}, currentUser = null) => {
  const holiday = await getHolidayById(id);
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta } = data;

  if (ten_ngay_le !== undefined) {
    const trimmedName = typeof ten_ngay_le === 'string' ? ten_ngay_le.trim() : '';
    if (!trimmedName) {
      throw new ServiceError('Tên ngày nghỉ lễ không được để trống.', 400, 'HOLIDAY_NAME_REQUIRED');
    }
    holiday.ten_ngay_le = trimmedName;
  }

  const nextStart = ngay_bat_dau !== undefined ? String(ngay_bat_dau).trim() : String(holiday.ngay_bat_dau).slice(0, 10);
  const nextEnd = ngay_ket_thuc !== undefined ? String(ngay_ket_thuc).trim() : String(holiday.ngay_ket_thuc).slice(0, 10);

  if (ngay_bat_dau !== undefined) {
    if (!isValidCalendarDate(nextStart)) {
      throw new ServiceError('Ngày bắt đầu không hợp lệ (yêu cầu YYYY-MM-DD tồn tại trong lịch).', 400, 'HOLIDAY_START_DATE_INVALID');
    }
    holiday.ngay_bat_dau = nextStart;
  }

  if (ngay_ket_thuc !== undefined) {
    if (!isValidCalendarDate(nextEnd)) {
      throw new ServiceError('Ngày kết thúc không hợp lệ (yêu cầu YYYY-MM-DD tồn tại trong lịch).', 400, 'HOLIDAY_END_DATE_INVALID');
    }
    holiday.ngay_ket_thuc = nextEnd;
  }

  if (nextStart > nextEnd) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400, 'HOLIDAY_DATE_RANGE_INVALID');
  }

  await assertNoOverlappingHoliday(nextStart, nextEnd, id);

  if (huong_luong !== undefined) holiday.huong_luong = Boolean(huong_luong);
  if (mo_ta !== undefined) holiday.mo_ta = mo_ta && String(mo_ta).trim() ? String(mo_ta).trim() : null;

  await holiday.save();
  recordHolidayAudit(currentUser, 'UPDATE_HOLIDAY', holiday.id, { updatedFields: Object.keys(data) });
  return holiday;
};

// Xóa ngày nghỉ lễ
const deleteHoliday = async (id, currentUser = null) => {
  const holiday = await getHolidayById(id);
  await holiday.destroy();
  recordHolidayAudit(currentUser, 'DELETE_HOLIDAY', id, { ten_ngay_le: holiday.ten_ngay_le });
  return holiday;
};

module.exports = {
  ServiceError,
  isValidCalendarDate,
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
