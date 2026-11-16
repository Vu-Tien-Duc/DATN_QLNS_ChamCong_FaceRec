/**
 * Quản lý nghiệp vụ ngày nghỉ lễ (Holidays) trên SQL Server (Sequelize).
 */
const { Op } = require('sequelize');
const { NgayNghiLe } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid } = require('../../utils/hoTroSequelize');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getHolidays = async (query = {}) => {
  const year = query.nam;
  const where = {};
  if (year !== undefined && year !== null && String(year).trim() !== '') {
    const yearNum = Number(year);
    if (!Number.isNaN(yearNum)) {
      where.ngay_bat_dau = { [Op.between]: [`${yearNum}-01-01`, `${yearNum}-12-31`] };
    }
  }

  return NgayNghiLe.findAll({
    where,
    order: [['ngay_bat_dau', 'ASC']],
  });
};

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

const createHoliday = async (data = {}) => {
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta } = data;

  const name = (ten_ngay_le || '').trim();
  const startDate = (ngay_bat_dau || '').trim();
  const endDate = (ngay_ket_thuc || '').trim();
  const isPaid = huong_luong !== undefined ? Boolean(huong_luong) : true;
  const description = mo_ta !== undefined && mo_ta !== null ? String(mo_ta).trim() : null;

  if (!name) {
    throw new ServiceError('Tên ngày nghỉ lễ là bắt buộc.', 400, 'HOLIDAY_NAME_REQUIRED');
  }
  if (!startDate || !DATE_REGEX.test(startDate)) {
    throw new ServiceError('Ngày bắt đầu phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_START_DATE_INVALID');
  }
  if (!endDate || !DATE_REGEX.test(endDate)) {
    throw new ServiceError('Ngày kết thúc phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_END_DATE_INVALID');
  }
  if (startDate > endDate) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400, 'HOLIDAY_DATE_RANGE_INVALID');
  }

  return NgayNghiLe.create({
    ten_ngay_le: name,
    ngay_bat_dau: startDate,
    ngay_ket_thuc: endDate,
    huong_luong: isPaid,
    mo_ta: description,
  });
};

const updateHoliday = async (id, data = {}) => {
  const holiday = await getHolidayById(id);
  const { ten_ngay_le, ngay_bat_dau, ngay_ket_thuc, huong_luong, mo_ta } = data;

  if (ten_ngay_le !== undefined) {
    const trimmedName = String(ten_ngay_le).trim();
    if (!trimmedName) {
      throw new ServiceError('Tên ngày nghỉ lễ không được để trống.', 400, 'HOLIDAY_NAME_REQUIRED');
    }
    holiday.ten_ngay_le = trimmedName;
  }

  const nextStart = ngay_bat_dau !== undefined ? String(ngay_bat_dau).trim() : holiday.ngay_bat_dau;
  const nextEnd = ngay_ket_thuc !== undefined ? String(ngay_ket_thuc).trim() : holiday.ngay_ket_thuc;

  if (ngay_bat_dau !== undefined) {
    if (!DATE_REGEX.test(nextStart)) {
      throw new ServiceError('Ngày bắt đầu phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_START_DATE_INVALID');
    }
    holiday.ngay_bat_dau = nextStart;
  }

  if (ngay_ket_thuc !== undefined) {
    if (!DATE_REGEX.test(nextEnd)) {
      throw new ServiceError('Ngày kết thúc phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_END_DATE_INVALID');
    }
    holiday.ngay_ket_thuc = nextEnd;
  }

  if (nextStart > nextEnd) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400, 'HOLIDAY_DATE_RANGE_INVALID');
  }

  if (huong_luong !== undefined) holiday.huong_luong = Boolean(huong_luong);
  if (mo_ta !== undefined) holiday.mo_ta = mo_ta ? String(mo_ta).trim() : null;

  await holiday.save();
  return holiday;
};

const deleteHoliday = async (id) => {
  const holiday = await getHolidayById(id);
  await holiday.destroy();
  return holiday;
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
