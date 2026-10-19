/**
 * Quản lý nghiệp vụ ngày nghỉ lễ (Holidays)
 */
const Holiday = require('../models/holiday.model');
const ServiceError = require('../utils/serviceError');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lấy danh sách ngày nghỉ lễ theo năm (hoặc tất cả)
 */
const getHolidays = async ({ year } = {}) => {
  const filter = {};
  if (year !== undefined && year !== null && String(year).trim() !== '') {
    const yearNum = Number(year);
    if (!Number.isNaN(yearNum)) {
      filter.$or = [
        { year: yearNum },
        { startDate: { $regex: `^${yearNum}` } },
      ];
    }
  }

  const holidays = await Holiday.find(filter)
    .sort({ startDate: 1 })
    .populate('createdBy', 'fullName email role');

  return holidays;
};

/**
 * Lấy chi tiết một ngày nghỉ lễ theo ID
 */
const getHolidayById = async (id) => {
  const holiday = await Holiday.findById(id).populate('createdBy', 'fullName email role');
  if (!holiday) {
    throw new ServiceError('Không tìm thấy ngày nghỉ lễ yêu cầu.', 404, 'HOLIDAY_NOT_FOUND');
  }
  return holiday;
};

/**
 * Tạo mới ngày nghỉ lễ
 */
const createHoliday = async (data = {}, currentUser = null) => {
  const name = (data.name || '').trim();
  const startDate = (data.startDate || '').trim();
  const endDate = (data.endDate || '').trim();
  const isPaid = data.isPaid !== undefined ? Boolean(data.isPaid) : true;
  const description = (data.description || '').trim() || null;

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

  const year = data.year || Number(startDate.slice(0, 4));

  const holiday = await Holiday.create({
    name,
    startDate,
    endDate,
    year: Number(year),
    isPaid,
    description,
    createdBy: currentUser?._id || currentUser?.id || null,
  });

  return holiday;
};

/**
 * Cập nhật ngày nghỉ lễ
 */
const updateHoliday = async (id, data = {}, currentUser = null) => {
  const holiday = await Holiday.findById(id);
  if (!holiday) {
    throw new ServiceError('Không tìm thấy ngày nghỉ lễ cần cập nhật.', 404, 'HOLIDAY_NOT_FOUND');
  }

  const name = data.name;
  const startDate = data.startDate;
  const endDate = data.endDate;
  const isPaid = data.isPaid;
  const description = data.description;

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ServiceError('Tên ngày nghỉ lễ không được để trống.', 400, 'HOLIDAY_NAME_REQUIRED');
    }
    holiday.name = trimmedName;
  }

  const nextStart = startDate !== undefined ? String(startDate).trim() : holiday.startDate;
  const nextEnd = endDate !== undefined ? String(endDate).trim() : holiday.endDate;

  if (startDate !== undefined) {
    if (!DATE_REGEX.test(nextStart)) {
      throw new ServiceError('Ngày bắt đầu phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_START_DATE_INVALID');
    }
    holiday.startDate = nextStart;
    holiday.year = Number(nextStart.slice(0, 4));
  }

  if (endDate !== undefined) {
    if (!DATE_REGEX.test(nextEnd)) {
      throw new ServiceError('Ngày kết thúc phải có định dạng YYYY-MM-DD.', 400, 'HOLIDAY_END_DATE_INVALID');
    }
    holiday.endDate = nextEnd;
  }

  if (nextStart > nextEnd) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400, 'HOLIDAY_DATE_RANGE_INVALID');
  }

  if (isPaid !== undefined) {
    holiday.isPaid = Boolean(isPaid);
  }

  if (description !== undefined) {
    holiday.description = description ? String(description).trim() : null;
  }

  await holiday.save();
  return holiday;
};

/**
 * Xóa ngày nghỉ lễ
 */
const deleteHoliday = async (id) => {
  const holiday = await Holiday.findById(id);
  if (!holiday) {
    throw new ServiceError('Không tìm thấy ngày nghỉ lễ cần xóa.', 404, 'HOLIDAY_NOT_FOUND');
  }

  await Holiday.deleteOne({ _id: id });
  return holiday;
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
