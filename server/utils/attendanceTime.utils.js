/**
 * Tiện ích dùng chung về thời gian, trạng thái chấm công, ảnh minh chứng và lỗi nghiệp vụ.
 */
const ServiceError = require('./serviceError');

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
  if (!shift || !shift.startTime || !shift.endTime) return null;
  const startMinutes = timeStringToMinutes(shift.startTime);
  const endMinutes = timeStringToMinutes(shift.endTime);
  const lateThreshold = shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15;
  return {
    startMinutes,
    endMinutes,
    windowStartMinutes: Math.max(0, startMinutes - 30),
    windowEndMinutes: startMinutes + lateThreshold,
  };
};

/**
 * Tính toán trạng thái chấm công dựa vào thời điểm check-in và cấu hình ca:
 * - Check-in trước hoặc đúng startTime -> 'ON_TIME' (Đúng giờ)
 * - Check-in sau startTime -> 'LATE' (Đi muộn)
 * @param {Date} checkInTime 
 * @param {Object} shiftConfig 
 * @param {Date} [date=new Date()] (ngày áp dụng)
 * @returns {String} 'ON_TIME' | 'LATE'
 */
const calculateAttendanceStatus = (checkInTime, shiftConfig, date = new Date()) => {
  if (!shiftConfig || !shiftConfig.startTime) return 'ON_TIME';

  const vnDate = getVietnamTime(checkInTime || date);
  const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const startMinutes = timeStringToMinutes(shiftConfig.startTime);

  if (currentMinutes > startMinutes) {
    return 'LATE';
  }
  return 'ON_TIME';
};

const calculateCheckOutStatus = (checkOutTime, shiftConfig, initialStatus = 'ON_TIME') => {
  if (!shiftConfig || !shiftConfig.endTime) {
    return { finalStatus: initialStatus, isEarlyLeave: false, earlyMinutes: 0 };
  }

  const vnDate = getVietnamTime(checkOutTime);
  const checkOutMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const shiftEndMinutes = timeStringToMinutes(shiftConfig.endTime);

  const isEarlyLeave = checkOutMinutes < shiftEndMinutes;
  const earlyMinutes = isEarlyLeave ? shiftEndMinutes - checkOutMinutes : 0;

  // Quy tắc nghiệp vụ: Nếu ban đầu ON_TIME mà về sớm -> EARLY_LEAVE. Nếu ban đầu đã LATE -> giữ nguyên LATE
  let finalStatus = initialStatus;
  if (isEarlyLeave && initialStatus === 'ON_TIME') {
    finalStatus = 'EARLY_LEAVE';
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
  const cond = {};
  let startStr = null;
  let endStr = null;

  if (startDate) {
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      startStr = startDate;
      cond.$gte = new Date(`${startDate}T00:00:00.000+07:00`);
    } else {
      const d = new Date(startDate);
      cond.$gte = d;
      const vnD = new Date(d.getTime() + 7 * 3600 * 1000);
      startStr = vnD.toISOString().slice(0, 10);
    }
  }
  if (endDate) {
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      endStr = endDate;
      cond.$lte = new Date(`${endDate}T23:59:59.999+07:00`);
    } else {
      const d = new Date(endDate);
      cond.$lte = d;
      const vnD = new Date(d.getTime() + 7 * 3600 * 1000);
      endStr = vnD.toISOString().slice(0, 10);
    }
  }

  const workDateCond = {};
  if (startStr) workDateCond.$gte = startStr;
  if (endStr) workDateCond.$lte = endStr;

  return {
    $or: [
      { checkInTime: cond },
      { workDate: workDateCond },
      { checkInTime: null, createdAt: cond },
    ],
  };
};

/**
 * Hàm DUY NHẤT để tính toán lại toàn bộ dữ liệu tổng hợp chấm công (AttendanceLog) từ dữ liệu gốc (PunchLog)
 * Đảm bảo:
 * 1. Single Source of Truth là bảng `luot_quet` (PunchLog)
 * 2. `trang_thai` được suy diễn hoàn toàn từ `di_muon_phut`, `ve_som_phut` và `don_nghi_id`, không cho phép nhập tay lệch trạng thái
 * 3. Khi một lượt quét được thêm/xóa/ghi đè bởi Admin, gọi hàm này để đồng bộ lại
 * @param {string|mongoose.Types.ObjectId} attendanceLogId
 * @returns {Promise<Object>}
 */
const recalculateAttendanceSummary = async (attendanceLogId) => {
  const mongoose = require('mongoose');
  const AttendanceLog = mongoose.models.AttendanceLog || require('../models/attendanceLog.model');
  const PunchLog = mongoose.models.PunchLog || require('../models/punchLog.model');

  const attendanceLog = await AttendanceLog.findById(attendanceLogId).populate('shiftId');
  if (!attendanceLog) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công tổng hợp.', 404);
  }

  // 1. Lấy tất cả lượt quét gốc của phiên chấm công này
  const punches = await PunchLog.find({ cham_cong_id: attendanceLog._id }).sort({ thoi_gian_quet: 1 });

  const checkIns = punches.filter((p) => p.loai_quet === 'CHECK_IN');
  const checkOuts = punches.filter((p) => p.loai_quet === 'CHECK_OUT');

  const earliestCheckIn = checkIns.length > 0 ? checkIns[0].thoi_gian_quet : null;
  const latestCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].thoi_gian_quet : null;

  const shift = attendanceLog.shiftId;
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let workingMinutes = 0;
  let status = 'ON_TIME';

  // 2. Nếu có đơn nghỉ phép
  const hasLeave = Boolean(attendanceLog.don_nghi_id || attendanceLog.leaveRequestId);

  if (hasLeave) {
    status = 'EXCUSED_ABSENCE';
  } else if (!earliestCheckIn) {
    status = 'ABSENT';
  } else {
    // 3. Tính toán đi muộn
    if (shift && shift.startTime) {
      const vnCheckIn = getVietnamTime(earliestCheckIn);
      const checkInMinutes = vnCheckIn.getHours() * 60 + vnCheckIn.getMinutes();
      const shiftStartMinutes = timeStringToMinutes(shift.startTime);
      lateMinutes = Math.max(0, checkInMinutes - shiftStartMinutes);
    }

    // 4. Tính toán về sớm
    if (latestCheckOut && shift && shift.endTime) {
      const vnCheckOut = getVietnamTime(latestCheckOut);
      const checkOutMinutes = vnCheckOut.getHours() * 60 + vnCheckOut.getMinutes();
      const shiftEndMinutes = timeStringToMinutes(shift.endTime);
      earlyMinutes = Math.max(0, shiftEndMinutes - checkOutMinutes);
    }

    // 5. Tính thời lượng làm việc thực tế
    if (earliestCheckIn && latestCheckOut) {
      const diffMs = new Date(latestCheckOut).getTime() - new Date(earliestCheckIn).getTime();
      workingMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    // 6. Suy diễn trạng thái chặt chẽ theo phút (Strict State Derivation)
    if (lateMinutes > 0) {
      status = 'LATE';
    } else if (earlyMinutes > 0) {
      status = 'EARLY_LEAVE';
    } else {
      status = 'ON_TIME';
    }
  }

  // Cập nhật lại snapshot tổng hợp
  attendanceLog.thoi_gian_vao = earliestCheckIn;
  attendanceLog.thoi_gian_ra = latestCheckOut;
  attendanceLog.di_muon_phut = lateMinutes;
  attendanceLog.ve_som_phut = earlyMinutes;
  attendanceLog.thoi_luong_lam_viec_phut = workingMinutes;
  attendanceLog.trang_thai = status;

  await attendanceLog.save();
  return attendanceLog;
};

module.exports = {
  ServiceError,
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
