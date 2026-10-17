/**
 * Schedule Management Service (server/services/scheduleManagement.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Quản lý Thời khóa biểu học kỳ (Collection 6 - Schedule / lich_giang_day).
 * - Thuật toán chống xung đột 2 chiều: Xung đột Giảng viên & Xung đột Phòng học.
 * - Công thức chồng lấn khoảng tiết: max(Start_1, Start_2) <= min(End_1, End_2).
 * - So khớp tuần học chung (weekNumbers) và chuẩn hóa tên phòng học (isSameRoom).
 * - Hỗ trợ xếp lịch dạy bù (DAY_BU) và quản lý ngoại lệ buổi học (ngoai_le[]).
 * - Phân quyền quản trị: Giảng viên chỉ xem lịch bản thân; Trưởng khoa xem/quản lý trong khoa; Admin toàn quyền.
 */
const mongoose = require('mongoose');
const Schedule = require('../models/schedule.model');
const ShiftConfig = require('../models/shiftConfig.model');
const User = require('../models/user.model');
const Subject = require('../models/subject.model');
const AuditLog = require('../models/auditLog.model');
const { getDeanDepartmentIds } = require('../utils/deanScope');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * 1. Chuyển đổi chuỗi giờ 'HH:mm' thành tổng số phút trong ngày
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * 2. Chuẩn hóa tên phòng học / giảng đường để so khớp chống trùng lịch
 */
const normalizeRoomKey = (room) => {
  if (!room || typeof room !== 'string') return '';
  return room
    .toLowerCase()
    .trim()
    .replace(/^(phòng\s*học|phòng|giảng\s*đường|hội\s*trường|khu|p\.)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isSameRoom = (room1, room2) => {
  if (!room1 || !room2) return false;
  const r1 = room1.trim().toLowerCase();
  const r2 = room2.trim().toLowerCase();
  if (r1 === r2) return true;
  const n1 = normalizeRoomKey(r1);
  const n2 = normalizeRoomKey(r2);
  return Boolean(n1 && n2 && n1 === n2);
};

/**
 * 3. Kiểm tra xem 2 lịch có bị xung đột thời gian (tiết học hoặc khung giờ) không
 */
const checkPeriodOrTimeOverlap = (schedA, schedB) => {
  // Ưu tiên so sánh khoảng tiết nếu có
  const startA = schedA.startPeriod || schedA.tiet_bat_dau;
  const countA = schedA.periodCount || schedA.so_tiet;
  const startB = schedB.startPeriod || schedB.tiet_bat_dau;
  const countB = schedB.periodCount || schedB.so_tiet;

  if (startA && countA && startB && countB) {
    const endA = startA + countA - 1;
    const endB = startB + countB - 1;
    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  // Fallback so sánh khung giờ HH:mm
  const aStartMin = timeStringToMinutes(schedA.startTime || schedA.gio_bat_dau);
  const aEndMin = timeStringToMinutes(schedA.endTime || schedA.gio_ket_thuc);
  const bStartMin = timeStringToMinutes(schedB.startTime || schedB.gio_bat_dau);
  const bEndMin = timeStringToMinutes(schedB.endTime || schedB.gio_ket_thuc);

  return Math.max(aStartMin, bStartMin) < Math.min(aEndMin, bEndMin);
};

/**
 * 4. Kiểm tra có ít nhất một tuần học chung giữa 2 mảng tuần
 */
const hasCommonWeek = (weeksA, weeksB) => {
  if (!Array.isArray(weeksA) || !Array.isArray(weeksB)) return true;
  if (weeksA.length === 0 || weeksB.length === 0) return true;
  const setB = new Set(weeksB.map(Number));
  return weeksA.some((w) => setB.has(Number(w)));
};

/**
 * 5. Thuật toán phát hiện xung đột lịch (Lecturer Conflict & Room Conflict)
 */
const detectScheduleConflicts = async ({
  userId,
  roomId,
  weekday,
  startPeriod,
  periodCount,
  startTime,
  endTime,
  weekNumbers = [],
  academicYear,
  semester,
  scheduleType = 'CHINH_KHOA',
  makeupDate = null,
  excludeScheduleId = null,
}) => {
  const query = {
    _id: { $ne: excludeScheduleId },
    isActive: { $ne: false },
  };

  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = Number(semester);

  // Nếu là lịch dạy bù: so sánh theo ngày bù
  if (scheduleType === 'DAY_BU' && makeupDate) {
    const targetDate = new Date(makeupDate);
    const startOfTarget = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfTarget = new Date(targetDate.setHours(23, 59, 59, 999));

    query.$or = [
      { makeupDate: { $gte: startOfTarget, $lte: endOfTarget } },
      { ngay_day_bu: { $gte: startOfTarget, $lte: endOfTarget } },
      { weekday: targetDate.getDay() },
    ];
  } else {
    query.weekday = Number(weekday);
  }

  const existingSchedules = await Schedule.find(query).populate('userId', 'fullName email staffCode');

  const incomingSched = {
    startPeriod: Number(startPeriod),
    periodCount: Number(periodCount),
    startTime,
    endTime,
    weekNumbers,
  };

  for (const exist of existingSchedules) {
    // Bỏ qua các buổi đã hủy
    const isCancelled = Array.isArray(exist.exceptions) && exist.exceptions.some((ex) => ex.trang_thai === 'HUY');
    if (isCancelled) continue;

    // Kiểm tra tuần học chung
    const existWeeks = exist.weekNumbers || exist.danh_sach_tuan || [];
    if (!hasCommonWeek(weekNumbers, existWeeks)) continue;

    // Kiểm tra chồng lấn tiết học
    const isOverlapping = checkPeriodOrTimeOverlap(incomingSched, exist);
    if (!isOverlapping) continue;

    // 1. Kiểm tra xung đột Giảng viên
    const sameLecturer = String(exist.userId?._id || exist.userId) === String(userId);
    if (sameLecturer) {
      const lecturerName = exist.userId?.fullName || 'Giảng viên';
      throw new ServiceError(
        `Xung đột lịch Giảng viên: ${lecturerName} đã có lịch giảng dạy khác vào ${
          exist.startTime || `tiết ${exist.startPeriod}`
        } (Thứ ${weekday})!`,
        409,
        'SCHEDULE_LECTURER_CONFLICT',
        { conflictingScheduleId: exist._id }
      );
    }

    // 2. Kiểm tra xung đột Phòng học
    const existRoom = exist.roomId || exist.phong_hoc;
    if (roomId && existRoom && isSameRoom(roomId, existRoom)) {
      throw new ServiceError(
        `Xung đột Phòng học: ${roomId} đã được bố trí cho lớp học khác vào ${
          exist.startTime || `tiết ${exist.startPeriod}`
        } (Thứ ${weekday})!`,
        409,
        'SCHEDULE_ROOM_CONFLICT',
        { conflictingScheduleId: exist._id, room: roomId }
      );
    }
  }

  return true;
};

/**
 * 6. Lấy danh sách lịch giảng dạy / công tác (Phân quyền & Lọc)
 */
const fetchSchedules = async ({
  userId,
  shiftId,
  weekday,
  startDate,
  endDate,
  date,
  academicYear,
  semester,
  page = 1,
  limit = 20,
  currentUser,
}) => {
  const query = {};
  const userRole = (currentUser.role || currentUser.vai_tro || '').toLowerCase();

  if (userRole === 'giangvien' || userRole === 'nhanvien') {
    query.userId = currentUser.id || currentUser._id;
  } else if (userRole === 'truongkhoa') {
    const departmentIds = await getDeanDepartmentIds(currentUser);
    const scopedUserIds = await User.find({
      $or: [{ departmentId: { $in: departmentIds } }, { ma_don_vi: { $in: departmentIds } }],
    }).distinct('_id');

    if (userId) {
      if (!scopedUserIds.map(String).includes(String(userId))) {
        throw new ServiceError('Bạn chỉ có quyền xem lịch của giảng viên thuộc khoa mình.', 403);
      }
      query.userId = userId;
    } else {
      query.userId = { $in: scopedUserIds };
    }
  } else if (userId) {
    query.userId = userId;
  }

  if (shiftId) query.shiftId = shiftId;
  if (weekday !== undefined && weekday !== '') query.weekday = Number(weekday);
  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = Number(semester);

  if (startDate && endDate) {
    query.startDate = { $lte: new Date(endDate) };
    query.endDate = { $gte: new Date(startDate) };
  } else if (date) {
    const targetDate = new Date(date);
    query.startDate = { $lte: targetDate };
    query.endDate = { $gte: targetDate };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, schedules] = await Promise.all([
    Schedule.countDocuments(query),
    Schedule.find(query)
      .populate('userId', 'fullName ho_ten email staffCode ma_can_bo role departmentId')
      .populate('shiftId', 'name startTime endTime')
      .populate('subjectId', 'name ten_mon code ma_mon credits so_tin_chi departmentId')
      .sort({ weekday: 1, startPeriod: 1, startTime: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    schedules,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * 7. Lấy chi tiết lịch
 */
const fetchScheduleById = async (scheduleId, currentUser) => {
  if (!mongoose.isValidObjectId(scheduleId)) {
    throw new ServiceError('Mã lịch không hợp lệ.', 400);
  }

  const schedule = await Schedule.findById(scheduleId)
    .populate('userId', 'fullName ho_ten email staffCode role departmentId')
    .populate('shiftId', 'name startTime endTime')
    .populate('subjectId', 'name ten_mon code ma_mon credits');

  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch giảng dạy/công tác.', 404);
  }

  const userRole = (currentUser.role || currentUser.vai_tro || '').toLowerCase();
  if (userRole === 'giangvien' && String(schedule.userId?._id || schedule.userId) !== String(currentUser.id)) {
    throw new ServiceError('Bạn không có quyền truy cập lịch của người khác.', 403);
  }

  return schedule;
};

/**
 * 8. Tạo mới Thời khóa biểu học kỳ
 */
const createNewSchedule = async (data, currentUser) => {
  const {
    userId,
    shiftId,
    startTime,
    endTime,
    startPeriod,
    periodCount,
    roomId,
    subjectId,
    weekday,
    isRecurring = true,
    startDate,
    endDate,
    scheduleType = 'CHINH_KHOA',
    makeupDate,
    weekNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    academicYear = '2026-2027',
    semester = 1,
  } = data;

  if (!userId || !roomId || weekday === undefined) {
    throw new ServiceError('Vui lòng cung cấp đầy đủ: Giảng viên, Phòng học, Thứ trong tuần.', 400);
  }

  // 1. Kiểm tra chống xung đột lịch
  await detectScheduleConflicts({
    userId,
    roomId,
    weekday,
    startPeriod,
    periodCount,
    startTime,
    endTime,
    weekNumbers,
    academicYear,
    semester,
    scheduleType,
    makeupDate,
  });

  // 2. Khởi tạo bản ghi Schedule
  const newSchedule = await Schedule.create({
    userId,
    ma_nguoi_dung: userId,
    shiftId: shiftId || null,
    ma_ca: shiftId || null,
    startTime: startTime || '07:00',
    gio_bat_dau: startTime || '07:00',
    endTime: endTime || '09:30',
    gio_ket_thuc: endTime || '09:30',
    startPeriod: Number(startPeriod) || 1,
    tiet_bat_dau: Number(startPeriod) || 1,
    periodCount: Number(periodCount) || 3,
    so_tiet: Number(periodCount) || 3,
    roomId,
    phong_hoc: roomId,
    subjectId: subjectId || null,
    ma_mon: subjectId || null,
    weekday: Number(weekday),
    thu_trong_tuan: Number(weekday),
    isRecurring: Boolean(isRecurring),
    startDate: startDate ? new Date(startDate) : new Date('2026-09-01'),
    endDate: endDate ? new Date(endDate) : new Date('2026-12-31'),
    scheduleType,
    loai_lich: scheduleType,
    makeupDate: makeupDate ? new Date(makeupDate) : null,
    ngay_day_bu: makeupDate ? new Date(makeupDate) : null,
    weekNumbers,
    danh_sach_tuan: weekNumbers,
    academicYear,
    nam_hoc: academicYear,
    semester: Number(semester),
    hoc_ky: Number(semester),
    exceptions: [],
    ngoai_le: [],
  });

  // 3. Ghi Audit Log
  AuditLog.create({
    actor: currentUser.id || currentUser._id,
    actorType: 'USER',
    action: 'CREATE_SCHEDULE',
    targetId: newSchedule._id.toString(),
    targetType: 'Schedule',
    details: { roomId, weekday, startPeriod, scheduleType },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return newSchedule;
};

/**
 * 9. Cập nhật Thời khóa biểu
 */
const updateExistingSchedule = async (scheduleId, data, currentUser) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch cần cập nhật.', 404);
  }

  const nextUserId = data.userId || schedule.userId;
  const nextRoomId = data.roomId || schedule.roomId;
  const nextWeekday = data.weekday !== undefined ? data.weekday : schedule.weekday;
  const nextStartPeriod = data.startPeriod !== undefined ? data.startPeriod : schedule.startPeriod;
  const nextPeriodCount = data.periodCount !== undefined ? data.periodCount : schedule.periodCount;
  const nextStartTime = data.startTime || schedule.startTime;
  const nextEndTime = data.endTime || schedule.endTime;
  const nextWeekNumbers = data.weekNumbers || schedule.weekNumbers;
  const nextAcademicYear = data.academicYear || schedule.academicYear;
  const nextSemester = data.semester || schedule.semester;
  const nextScheduleType = data.scheduleType || schedule.scheduleType;
  const nextMakeupDate = data.makeupDate || schedule.makeupDate;

  // Kiểm tra xung đột trừ chính nó
  await detectScheduleConflicts({
    userId: nextUserId,
    roomId: nextRoomId,
    weekday: nextWeekday,
    startPeriod: nextStartPeriod,
    periodCount: nextPeriodCount,
    startTime: nextStartTime,
    endTime: nextEndTime,
    weekNumbers: nextWeekNumbers,
    academicYear: nextAcademicYear,
    semester: nextSemester,
    scheduleType: nextScheduleType,
    makeupDate: nextMakeupDate,
    excludeScheduleId: schedule._id,
  });

  Object.assign(schedule, data);
  if (data.startPeriod) schedule.tiet_bat_dau = data.startPeriod;
  if (data.periodCount) schedule.so_tiet = data.periodCount;
  if (data.roomId) schedule.phong_hoc = data.roomId;
  if (data.weekday !== undefined) schedule.thu_trong_tuan = data.weekday;
  if (data.academicYear) schedule.nam_hoc = data.academicYear;
  if (data.semester) schedule.hoc_ky = data.semester;
  if (data.weekNumbers) schedule.danh_sach_tuan = data.weekNumbers;

  await schedule.save();

  AuditLog.create({
    actor: currentUser.id || currentUser._id,
    actorType: 'USER',
    action: 'UPDATE_SCHEDULE',
    targetId: schedule._id.toString(),
    targetType: 'Schedule',
    details: { updatedFields: Object.keys(data) },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return schedule;
};

/**
 * 10. Xóa Thời khóa biểu
 */
const removeSchedule = async (scheduleId, currentUser) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch để xóa.', 404);
  }

  await Schedule.findByIdAndDelete(scheduleId);

  AuditLog.create({
    actor: currentUser.id || currentUser._id,
    actorType: 'USER',
    action: 'DELETE_SCHEDULE',
    targetId: scheduleId,
    targetType: 'Schedule',
    details: { roomId: schedule.roomId, weekday: schedule.weekday },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đã xóa lịch giảng dạy/công tác thành công.' };
};

/**
 * 11. Thêm ngoại lệ buổi học (Nghỉ, Hủy, Dạy bù)
 */
const addScheduleException = async ({ scheduleId, date, reason, status = 'NGHI', makeupDate, currentUser }) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch giảng dạy.', 404);
  }

  const exceptionItem = {
    ngay: new Date(date),
    ly_do: reason || 'Giảng viên có lý do công tác',
    trang_thai: status,
    ngay_day_bu: makeupDate ? new Date(makeupDate) : null,
  };

  if (!Array.isArray(schedule.exceptions)) schedule.exceptions = [];
  schedule.exceptions.push(exceptionItem);
  if (!Array.isArray(schedule.ngoai_le)) schedule.ngoai_le = [];
  schedule.ngoai_le.push(exceptionItem);

  await schedule.save();

  return schedule;
};

/**
 * 12. Lấy lịch làm việc hôm nay của người dùng
 */
const fetchTodaySchedules = async ({ userId, date, currentUser }) => {
  const targetDate = date ? new Date(date) : new Date();
  const currentWeekday = targetDate.getDay();

  const query = {
    userId: userId || currentUser.id || currentUser._id,
    weekday: currentWeekday,
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate },
    isActive: { $ne: false },
  };

  return Schedule.find(query)
    .populate('shiftId', 'name startTime endTime')
    .populate('subjectId', 'name code credits')
    .sort({ startPeriod: 1, startTime: 1 })
    .lean();
};

module.exports = {
  ServiceError,
  timeStringToMinutes,
  normalizeRoomKey,
  isSameRoom,
  checkPeriodOrTimeOverlap,
  hasCommonWeek,
  detectScheduleConflicts,
  fetchSchedules,
  fetchScheduleById,
  createNewSchedule,
  updateExistingSchedule,
  removeSchedule,
  addScheduleException,
  fetchTodaySchedules,
};
