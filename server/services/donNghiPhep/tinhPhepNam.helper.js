// Tính số ngày nghỉ hợp lệ (loại trừ Chủ nhật, ngày lễ), thống kê quỹ phép năm và định dạng dữ liệu đơn từ
const { Op } = require('sequelize');
const { DonNghiPhep, LichSuDuyetDon, NguoiDung, PhongBan, NgayNghiLe, CaLamViec, LichTrinh, LichTrinhTuan, MonHoc, NhatKyChamCong } = require('../../models');
const { detectScheduleConflicts } = require('../nhanSu/lichTrinh.service');
const ServiceError = require('../../utils/loiNghiepVu');

const PENDING_LEAVE_STATUSES = ['pending', 'pending_bgh'];

// Chuyển mốc thời gian sang chuỗi YYYY-MM-DD theo múi giờ Việt Nam
const getVietnamDateKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));

// Liệt kê các ngày trong khoảng thời gian trùng với thứ học của lịch trình
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

// Tính số ngày nghỉ thực tế (loại trừ Chủ nhật và ngày nghỉ lễ)
const calculateLeaveDays = (startDate, endDate, isHalfDay = false, holidayDates = null) => {
  const s = new Date(startDate);
  if (Number.isNaN(s.getTime())) {
    return 0;
  }
  const startKey = getVietnamDateKey(s);

  if (isHalfDay) {
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const halfDayUtc = new Date(Date.UTC(sy, sm - 1, sd));
    const isHoliday = holidayDates instanceof Set && holidayDates.has(startKey);
    return halfDayUtc.getUTCDay() === 0 || isHoliday ? 0 : 0.5;
  }

  const e = new Date(endDate);
  if (Number.isNaN(e.getTime()) || e < s) {
    return 0;
  }
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

// Lấy tập hợp các ngày nghỉ lễ (YYYY-MM-DD) giao với khoảng thời gian truyền vào
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

// Thống kê số ngày phép năm đã dùng và đang chờ duyệt trong năm
const getLeaveStatsByYear = async (userId, year, { transaction } = {}) => {
  const targetYear = Number(year) || new Date().getFullYear();
  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;

  const requests = await DonNghiPhep.findAll({
    where: {
      nguoi_dung_id: userId,
      trang_thai: { [Op.in]: ['approved', ...PENDING_LEAVE_STATUSES] },
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
    } else if (PENDING_LEAVE_STATUSES.includes(status)) {
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

// Định dạng bản ghi đơn nghỉ phép kèm thông tin cấp duyệt và lịch sử duyệt theo thời gian
const formatLeaveRequestDoc = (doc) => {
  if (!doc) return null;
  const raw = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (Array.isArray(raw.lich_su_duyet)) {
    raw.lich_su_duyet = [...raw.lich_su_duyet].sort(
      (a, b) => new Date(a?.thoi_diem || 0).getTime() - new Date(b?.thoi_diem || 0).getTime()
    );
  }
  const hasBghStep = Array.isArray(raw.lich_su_duyet) && raw.lich_su_duyet.some((h) => h?.cap_duyet === 'bgh');
  const capDuyetHienTai = raw.trang_thai === 'pending_bgh' ? 2 : 1;
  const soCapDuyet = Number(raw.so_ngay || 1) > 3 || capDuyetHienTai === 2 || hasBghStep ? 2 : 1;
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
    model: NguoiDung,
    as: 'giang_vien_day_thay',
    attributes: ['id', 'ho_ten', 'email', 'ma_can_bo'],
  },
  {
    model: CaLamViec,
    as: 'ca_thay_the',
    attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'],
  },
  {
    model: LichTrinh,
    as: 'lich_trinh',
    attributes: ['id', 'phong_hoc', 'thu_trong_tuan', 'tiet_bat_dau', 'so_tiet', 'gio_bat_dau', 'gio_ket_thuc'],
    include: [{ model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon'] }],
  },
  {
    model: NhatKyChamCong,
    as: 'nhat_ky',
    attributes: ['id', 'ngay_cong', 'thoi_gian_vao', 'thoi_gian_ra', 'trang_thai', 'di_muon_phut', 'lich_trinh_id', 'ca_id'],
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

// Kiểm tra đường dẫn tệp đính kèm dạng chuỗi hợp lệ (chống javascript: hoặc path traversal)
const isValidAttachmentUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('..')) return false;
  if (trimmed.startsWith('/api/tai-tep/tep/') && trimmed.length > '/api/tai-tep/tep/'.length) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Kiểm tra xung đột lịch giảng viên dạy thay / phòng học cho đơn dạy bù hoặc đổi ca
const validateLeaveScheduleConflict = async ({
  targetSchedule,
  substituteShiftId = null,
  substituteLecturerId = null,
  conflictDateStr,
  applicantId,
}) => {
  if (!targetSchedule || !conflictDateStr) return;

  if (substituteLecturerId) {
    if (String(substituteLecturerId) === String(applicantId)) {
      throw new ServiceError('Không thể tự chỉ định chính mình làm giảng viên dạy thay.', 400);
    }
    const subUser = await NguoiDung.findByPk(substituteLecturerId, {
      attributes: ['id', 'ho_ten', 'kich_hoat'],
    });
    if (!subUser || subUser.kich_hoat === false) {
      throw new ServiceError('Giảng viên dạy thay không tồn tại hoặc đang bị khóa.', 404);
    }
  }

  let targetStartTime = targetSchedule.gio_bat_dau;
  let targetEndTime = targetSchedule.gio_ket_thuc;
  let usingNewShift = false;
  if (substituteShiftId) {
    const subShift = await CaLamViec.findByPk(substituteShiftId);
    if (!subShift) {
      throw new ServiceError('Không tìm thấy ca làm việc thay thế được chọn.', 404);
    }
    targetStartTime = subShift.gio_bat_dau;
    targetEndTime = subShift.gio_ket_thuc;
    usingNewShift = true;
  }

  const weeks = Array.isArray(targetSchedule.tuan_hoc)
    ? targetSchedule.tuan_hoc.map((w) => Number(w.tuan_thu))
    : [];
  const conflictWeekday = new Date(`${conflictDateStr}T12:00:00+07:00`).getDay();

  await detectScheduleConflicts({
    nguoi_dung_id: substituteLecturerId || applicantId,
    phong_hoc: targetSchedule.phong_hoc,
    thu_trong_tuan: conflictWeekday,
    tiet_bat_dau: usingNewShift ? null : targetSchedule.tiet_bat_dau,
    so_tiet: targetSchedule.so_tiet,
    gio_bat_dau: targetStartTime,
    gio_ket_thuc: targetEndTime,
    ngay_bat_dau: conflictDateStr,
    ngay_ket_thuc: conflictDateStr,
    danh_sach_tuan: weeks,
    nam_hoc: targetSchedule.nam_hoc,
    hoc_ky: targetSchedule.hoc_ky,
    excludeScheduleId: targetSchedule.id,
  });
};

module.exports = {
  ServiceError,
  PENDING_LEAVE_STATUSES,
  getVietnamDateKey,
  getLeaveOccurrenceDates,
  calculateLeaveDays,
  getHolidayDateSet,
  getLeaveStatsByYear,
  formatLeaveRequestDoc,
  leaveInclude,
  isValidAttachmentUrl,
  validateLeaveScheduleConflict,
};
