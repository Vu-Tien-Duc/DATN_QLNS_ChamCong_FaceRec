/**
 * Tiện ích tính ngày phép năm & định dạng đơn từ (server/services/donNghiPhep/tinhPhepNam.helper.js)
 */
const { Op } = require('sequelize');
const { DonNghiPhep, LichSuDuyetDon, NguoiDung, PhongBan, NgayNghiLe } = require('../../models');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

const getVietnamDateKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));

const getLeaveOccurrenceDates = (startDate, endDate, weekday) => {
  const startKey = getVietnamDateKey(startDate);
  const endKey = getVietnamDateKey(endDate);
  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const occurrences = [];

  while (cursor <= end) {
    if (cursor.getUTCDay() === Number(weekday)) {
      occurrences.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

const calculateLeaveDays = (startDate, endDate, isHalfDay = false, holidayDates = null) => {
  if (isHalfDay) return 0.5;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return 0;
  }
  const startKey = getVietnamDateKey(s);
  const endKey = getVietnamDateKey(e);
  if (endKey < startKey) return 0;

  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  let count = 0;
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    const isHoliday = holidayDates instanceof Set && holidayDates.has(key);
    if (cur.getUTCDay() !== 0 && !isHoliday) {
      count += 1;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
};

const getHolidayDateSet = async (startDate, endDate, { transaction } = {}) => {
  const startKey = getVietnamDateKey(startDate);
  const endKey = getVietnamDateKey(endDate);
  const holidays = await NgayNghiLe.findAll({
    where: {
      ngay_bat_dau: { [Op.lte]: endKey },
      ngay_ket_thuc: { [Op.gte]: startKey },
    },
    attributes: ['ngay_bat_dau', 'ngay_ket_thuc'],
    transaction,
  });
  const dateSet = new Set();
  for (const h of holidays) {
    const cur = new Date(`${String(h.ngay_bat_dau).slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${String(h.ngay_ket_thuc).slice(0, 10)}T00:00:00Z`);
    while (cur <= end) {
      dateSet.add(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return dateSet;
};

const getLeaveStatsByYear = async (userId, year, { transaction } = {}) => {
  const targetYear = Number(year) || new Date().getFullYear();
  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;

  const requests = await DonNghiPhep.findAll({
    where: {
      nguoi_dung_id: userId,
      trang_thai: { [Op.in]: ['approved', 'pending', 'pending_dean', 'pending_bgh'] },
      ngay_bat_dau: { [Op.lte]: yearEnd },
      ngay_ket_thuc: { [Op.gte]: yearStart },
    },
    transaction,
  });

  let daysUsed = 0;
  let pendingDays = 0;
  let pendingAnnualLeaveDays = 0;
  let pendingRequestsCount = 0;

  const hasCrossYearRequest = requests.some((req) => {
    const startKey = String(req.ngay_bat_dau).slice(0, 10);
    const endKey = String(req.ngay_ket_thuc).slice(0, 10);
    return startKey < yearStart || endKey > yearEnd;
  });
  const yearHolidaySet = hasCrossYearRequest
    ? await getHolidayDateSet(yearStart, yearEnd, { transaction })
    : null;

  for (const req of requests) {
    const isAnnualLeave = req.loai_don === 'nghi_phep';
    const reqStartKey = String(req.ngay_bat_dau).slice(0, 10);
    const reqEndKey = String(req.ngay_ket_thuc).slice(0, 10);

    let days = Number(req.so_ngay ?? 1);
    if (reqStartKey < yearStart || reqEndKey > yearEnd) {
      const clampedStart = reqStartKey < yearStart ? yearStart : reqStartKey;
      const clampedEnd = reqEndKey > yearEnd ? yearEnd : reqEndKey;
      const isHalfDay = days === 0.5 && reqStartKey === reqEndKey;
      days = calculateLeaveDays(clampedStart, clampedEnd, isHalfDay, yearHolidaySet);
    }

    const status = String(req.trang_thai || '').toLowerCase();

    if (status === 'approved') {
      if (isAnnualLeave) daysUsed += days;
    } else if (['pending', 'pending_dean', 'pending_bgh'].includes(status)) {
      pendingDays += days;
      pendingRequestsCount += 1;
      if (isAnnualLeave) pendingAnnualLeaveDays += days;
    }
  }

  return {
    daysUsed,
    pendingDays,
    pendingAnnualLeaveDays,
    pendingRequestsCount,
  };
};

const formatLeaveRequestDoc = (doc) => {
  if (!doc) return null;
  const raw = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  const soCapDuyet = Number(raw.so_ngay || 1) > 3 ? 2 : 1;
  const capDuyetHienTai = raw.trang_thai === 'pending_bgh' ? 2 : 1;
  return {
    ...raw,
    cap_duyet_hien_tai: capDuyetHienTai,
    so_cap_duyet: soCapDuyet,
  };
};

const leaveInclude = [
  {
    model: NguoiDung,
    as: 'nguoi_dung',
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'ma_can_bo', 'don_vi_chinh_id', 'anh_dai_dien'],
    include: [{ model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] }],
  },
  {
    model: NguoiDung,
    as: 'nguoi_duyet',
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'anh_dai_dien', 'ma_can_bo'],
  },
  {
    model: LichSuDuyetDon,
    as: 'lich_su_duyet',
    include: [
      {
        model: NguoiDung,
        as: 'nguoi_duyet',
        attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'anh_dai_dien', 'ma_can_bo'],
      },
    ],
  },
];

module.exports = {
  ServiceError,
  getVietnamDateKey,
  getLeaveOccurrenceDates,
  calculateLeaveDays,
  getHolidayDateSet,
  getLeaveStatsByYear,
  formatLeaveRequestDoc,
  leaveInclude,
};
