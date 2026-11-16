/**
 * Tiện ích dùng chung về thời gian, trạng thái chấm công, ảnh minh chứng và lỗi nghiệp vụ.
 */
const ServiceError = require('./loiNghiepVu');

const getAttendanceEvidenceUrl = (log) =>
  log?.capturedImage ? `/attendance/${log._id}/evidence` : null;

const presentAttendanceEvidence = (log) => {
  if (log?.capturedImage) {
    log.capturedImage = getAttendanceEvidenceUrl(log);
  }
  return log;
};

/**
 * Chuyển đổi mốc thời gian về múi giờ chuẩn Asia/Ho_Chi_Minh (UTC+7)
 * Khắc phục triệt để lỗi lệch 7 tiếng của server runtime trên VPS (UTC) hoặc Local (UTC+7)
 * Đảm bảo các hàm .getHours(), .getMinutes(), .getDay(), .toISOString().slice(0, 10) luôn trả về giờ VN
 * @param {Date|string|number} [date=new Date()]
 * @returns {Date}
 */
const getVietnamTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(validDate);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1;
  const day = parseInt(map.day, 10);
  const hours = parseInt(map.hour, 10) % 24;
  const minutes = parseInt(map.minute, 10);
  const seconds = parseInt(map.second, 10);

  const vnDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  vnDate.getHours = () => hours;
  vnDate.getMinutes = () => minutes;
  vnDate.getSeconds = () => seconds;
  vnDate.getDay = () => vnDate.getUTCDay();
  vnDate.getDate = () => day;
  vnDate.getMonth = () => month;
  vnDate.getFullYear = () => year;
  vnDate._isVietnamTime = true;

  return vnDate;
};

/**
 * Xác định khoảng thời gian đầu ngày và cuối ngày [00:00:00.000, 23:59:59.999] theo chuẩn múi giờ UTC+7 (Asia/Ho_Chi_Minh)
 * @param {Date} [date=new Date()]
 * @returns {{ startOfDay: Date, endOfDay: Date, dateStr: string }}
 */
const getVietnamDayRange = (date = new Date()) => {
  let dateStr;
  if (date && date._isVietnamTime) {
    // Nếu đối tượng đã được chuẩn hóa qua getVietnamTime, lấy trực tiếp ngày tháng năm VN để tránh bị cộng lệch thêm 7 tiếng
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  } else {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const validDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(date || Date.now());
    dateStr = formatter.format(validDate); // Định dạng YYYY-MM-DD
  }
  const startOfDay = new Date(`${dateStr}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { startOfDay, endOfDay, dateStr };
};

/**
 * Bóc tách chuỗi "HH:mm" thành tổng số phút trong ngày tính từ 00:00 để so sánh toán học
 * @param {string} timeStr - Chuỗi định dạng "HH:mm"
 * @returns {number} Số phút từ 00:00
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Xác định khung giờ check-in hợp lệ cho ca làm việc:
 * - Sớm tối đa 30 phút trước giờ bắt đầu ca (startMinutes - 30)
 * - Muộn tối đa theo thời gian cho phép của ca (startMinutes + shift.lateThresholdMinutes)
 * @param {Object} shift - Bản ghi ca làm việc (chứa startTime, endTime, lateThresholdMinutes)
 * @returns {Object|null} { startMinutes, endMinutes, windowStartMinutes, windowEndMinutes }
 */
const getTodayScheduleWindow = (shift) => {
  const startTime = shift?.gio_bat_dau || shift?.startTime;
  const endTime = shift?.gio_ket_thuc || shift?.endTime;
  if (!shift || !startTime || !endTime) return null;
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  const lateThreshold = shift.nguong_di_muon_phut !== undefined ? shift.nguong_di_muon_phut : (shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15);
  return {
    startMinutes,
    endMinutes,
    windowStartMinutes: Math.max(0, startMinutes - 30),
    windowEndMinutes: startMinutes + lateThreshold,
  };
};

/**
 * Tính toán trạng thái chấm công dựa vào thời điểm check-in và cấu hình ca:
 * - Check-in trước hoặc đúng startTime -> 'on_time' (Đúng giờ)
 * - Check-in sau startTime -> 'late' (Đi muộn)
 * @param {Date} checkInTime 
 * @param {Object} shiftConfig 
 * @param {Date} [date=new Date()] (ngày áp dụng)
 * @returns {String} 'on_time' | 'late'
 */
const calculateAttendanceStatus = (checkInTime, shiftConfig, date = new Date()) => {
  const startTime = shiftConfig?.gio_bat_dau || shiftConfig?.startTime;
  if (!startTime) return 'on_time';

  const vnDate = getVietnamTime(checkInTime || date);
  const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const startMinutes = timeStringToMinutes(startTime);

  if (currentMinutes > startMinutes) {
    return 'late';
  }
  return 'on_time';
};

const calculateCheckOutStatus = (checkOutTime, shiftConfig, initialStatus = 'on_time') => {
  const endTime = shiftConfig?.gio_ket_thuc || shiftConfig?.endTime;
  if (!endTime) {
    return { finalStatus: initialStatus, isEarlyLeave: false, earlyMinutes: 0 };
  }

  const vnDate = getVietnamTime(checkOutTime);
  const checkOutMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const shiftEndMinutes = timeStringToMinutes(endTime);

  const isEarlyLeave = checkOutMinutes < shiftEndMinutes;
  const earlyMinutes = isEarlyLeave ? shiftEndMinutes - checkOutMinutes : 0;

  // Quy tắc nghiệp vụ: Nếu ban đầu ON_TIME mà về sớm -> EARLY_LEAVE. Nếu ban đầu đã LATE -> giữ nguyên LATE
  let finalStatus = initialStatus;
  if (isEarlyLeave && initialStatus === 'on_time') {
    finalStatus = 'early_leave';
  }

  return {
    finalStatus,
    isEarlyLeave,
    earlyMinutes,
  };
};

/**
 * Tạo điều kiện truy vấn thời gian chấm công:
 * Bao gồm cả checkInTime và createdAt (cho các bản ghi ABSENT/EXCUSED_ABSENCE do Cron tạo khi checkInTime = null)
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Object}
 */
const buildAttendanceDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const { Op } = require('sequelize');
  const cond = {};
  let startStr = null;
  let endStr = null;

  if (startDate) {
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      startStr = startDate;
      cond[Op.gte] = new Date(`${startDate}T00:00:00.000+07:00`);
    } else {
      const d = new Date(startDate);
      cond[Op.gte] = d;
      startStr = new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    }
  }
  if (endDate) {
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      endStr = endDate;
      cond[Op.lte] = new Date(`${endDate}T23:59:59.999+07:00`);
    } else {
      const d = new Date(endDate);
      cond[Op.lte] = d;
      endStr = new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    }
  }

  const workDateCond = {};
  if (startStr) workDateCond[Op.gte] = startStr;
  if (endStr) workDateCond[Op.lte] = endStr;

  return {
    [Op.or]: [
      { thoi_gian_vao: cond },
      { ngay_cong: workDateCond },
      { thoi_gian_vao: null, tao_luc: cond },
    ],
  };
};

const recalculateAttendanceSummary = async (attendanceLogId) => {
  const { NhatKyChamCong, LuotQuetChamCong, CaLamViec } = require('../models');

  const attendanceLog = await NhatKyChamCong.findByPk(attendanceLogId, {
    include: [{ model: CaLamViec, as: 'ca' }],
  });
  if (!attendanceLog) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công tổng hợp.', 404);
  }

  const punches = await LuotQuetChamCong.findAll({
    where: { cham_cong_id: attendanceLog.id, hop_le: true },
    order: [['thoi_gian_quet', 'ASC']],
  });

  const checkIns = punches.filter((p) => p.loai_quet === 'check_in');
  const checkOuts = punches.filter((p) => p.loai_quet === 'check_out');

  const earliestCheckIn = checkIns.length > 0 ? checkIns[0].thoi_gian_quet : null;
  const latestCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].thoi_gian_quet : null;

  const shift = attendanceLog.ca;
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let workingMinutes = 0;
  let status = 'on_time';

  if (attendanceLog.don_tu_id) {
    status = 'excused_absence';
  } else if (!earliestCheckIn) {
    status = 'absent';
  } else {
    const shiftStartTime = shift?.gio_bat_dau;
    if (shiftStartTime) {
      const vnCheckIn = getVietnamTime(earliestCheckIn);
      const checkInMinutes = vnCheckIn.getHours() * 60 + vnCheckIn.getMinutes();
      lateMinutes = Math.max(0, checkInMinutes - timeStringToMinutes(shiftStartTime));
    }

    const shiftEndTime = shift?.gio_ket_thuc;
    if (latestCheckOut && shiftEndTime) {
      const vnCheckOut = getVietnamTime(latestCheckOut);
      const checkOutMinutes = vnCheckOut.getHours() * 60 + vnCheckOut.getMinutes();
      earlyMinutes = Math.max(0, timeStringToMinutes(shiftEndTime) - checkOutMinutes);
    }

    if (earliestCheckIn && latestCheckOut) {
      const diffMs = new Date(latestCheckOut).getTime() - new Date(earliestCheckIn).getTime();
      workingMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    if (lateMinutes > 0) status = 'late';
    else if (earlyMinutes > 0) status = 'early_leave';
    else status = 'on_time';
  }

  attendanceLog.thoi_gian_vao = earliestCheckIn;
  attendanceLog.thoi_gian_ra = latestCheckOut;
  attendanceLog.di_muon_phut = lateMinutes;
  attendanceLog.ve_som_phut = earlyMinutes;
  attendanceLog.thoi_luong_lam_viec_phut = workingMinutes;
  attendanceLog.trang_thai = status;

  await attendanceLog.save();
  return attendanceLog;
};

const normalizeAttendanceMethod = (method) => {
  const raw = String(method || 'gps_mobile').trim().toLowerCase();
  const METHOD_MAP = {
    face_ai: 'face_ai',
    face: 'face_ai',
    qr_code: 'qr_code',
    qr: 'qr_code',
    gps_mobile: 'gps_mobile',
    gps: 'gps_mobile',
    thu_cong_admin: 'thu_cong_admin',
    manual: 'thu_cong_admin',
    thu_cong: 'thu_cong_admin',
    admin_manual: 'thu_cong_admin',
    system_auto: 'system_auto',
  };
  return METHOD_MAP[raw] || 'gps_mobile';
};

const calculateActualTeachingPeriods = async ({ lichTrinhId, workingMinutes = 0, earlyMinutes = 0 }, LichTrinhModel) => {
  if (lichTrinhId && LichTrinhModel) {
    const sch = await LichTrinhModel.findByPk(lichTrinhId, { attributes: ['so_tiet'] });
    const plannedPeriods = sch && sch.so_tiet ? Number(sch.so_tiet) : 3;
    if ((earlyMinutes || 0) > 45) {
      const remainingRatio = Math.max(0.5, workingMinutes / (plannedPeriods * 45));
      return Math.min(plannedPeriods, Math.round(plannedPeriods * remainingRatio));
    }
    return plannedPeriods;
  }
  return Math.round(Math.max(0, workingMinutes) / 45);
};

module.exports = {
  ServiceError,
  normalizeAttendanceMethod,
  calculateActualTeachingPeriods,
  getAttendanceEvidenceUrl,
  presentAttendanceEvidence,
  getVietnamTime,
  getVietnamDayRange,
  timeStringToMinutes,
  getTodayScheduleWindow,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
  buildAttendanceDateFilter,
  recalculateAttendanceSummary,
};
