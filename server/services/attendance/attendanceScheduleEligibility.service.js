/**
 * Chọn lịch trong ngày đủ điều kiện để giảng viên thực hiện check-in.
 */
const AttendanceLog = require('../../models/attendanceLog.model');
const Schedule = require('../../models/schedule.model');
const AuditLog = require('../../models/auditLog.model');
const { processScheduleAttendanceCheck } = require('../cron.service');
const { getVietnamTime, getVietnamDayRange, timeStringToMinutes } = require('../../utils/attendanceTime.utils');

const mongoose = require('mongoose');
const { isScheduleActiveOnDate } = require('../../utils/scheduleDate.utils');

/**
 * Đánh giá lịch hôm nay và gọi luồng hiện có để xử lý vắng mặt khi ca đã quá hạn điểm danh.
 */
const evaluateUserScheduleForCheckIn = async (userId, specificShiftId = null, userObj = null) => {
  const nowVN = getVietnamTime();
  const currentWeekday = nowVN.getDay();
  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const dayRange = getVietnamDayRange(nowVN);
  const { startOfDay, endOfDay } = dayRange;

  // Lấy thông tin họ tên & vai trò của cán bộ / giảng viên đang chấm công
  let user = userObj && (userObj.fullName || userObj.ho_ten) ? userObj : null;
  if (!user && userId && mongoose.isValidObjectId(userId)) {
    const User = require('../../models/user.model');
    user = await User.findById(userId).select('fullName ho_ten role vai_tro_chinh').lean();
  }
  const userName = user?.fullName || user?.ho_ten || 'Cán bộ';
  const userRole = (user?.role || user?.vai_tro_chinh || '').toLowerCase();
  const prefix = userRole === 'giangvien' ? 'Giảng viên' : 'Cán bộ';

  const query = {
    userId,
    weekday: currentWeekday,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  };

  // Chỉ gán shiftId nếu specificShiftId là một ObjectId hợp lệ (tránh nhận nhầm Date object)
  if (specificShiftId && mongoose.isValidObjectId(specificShiftId) && !(specificShiftId instanceof Date)) {
    query.shiftId = specificShiftId;
  }

  const schedules = await Schedule.find(query)
    .populate('shiftId')
    .populate('userId', 'fullName email role')
    .sort({ startTime: 1 });

  // 1. Nếu không có bất kỳ lịch nào hôm nay
  if (!schedules || schedules.length === 0) {
    return {
      canCheckIn: false,
      status: 'NO_SCHEDULE',
      message: `${prefix} ${userName} hôm nay không có lịch phân công giảng dạy hoặc ca làm việc nào trên hệ thống.`,
    };
  }

  const cancelledSchedules = [];
  const absentSchedules = [];
  let eligibleSchedule = null;
  let upcomingSchedule = null;
  let alreadyCheckedInLog = null;

  for (const sch of schedules) {
    const shift = sch.shiftId;
    if (!shift) continue;

    // Bỏ qua nếu hôm nay không nằm trong tuần học áp dụng hoặc rơi vào ngoại lệ ngày nghỉ
    if (!isScheduleActiveOnDate(sch, nowVN)) {
      continue;
    }

    const shiftStartStr = sch.startTime || shift.startTime;
    const shiftEndStr = sch.endTime || shift.endTime;
    const startMinutes = timeStringToMinutes(shiftStartStr);
    const lateThreshold = shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15;

    // Kiểm tra xem ca này hôm nay đã có bản ghi chấm công nào chưa
    const existingLog = await AttendanceLog.findOne({
      userId,
      scheduleId: sch._id,
      $or: [
        { checkInTime: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });

    if (existingLog) {
      if (existingLog.status === 'ABSENT' || existingLog.status === 'EXCUSED_ABSENCE') {
        // Ca này đã bị hủy/đánh vắng trước đó -> Lưu vết để thông báo đúng, không báo nhầm "hoàn thành ca"
        absentSchedules.push({
          schedule: sch,
          shift,
          shiftStartStr,
          shiftEndStr,
          lateThreshold,
          status: existingLog.status,
          log: existingLog,
        });
        continue;
      }
      if (existingLog.checkOutTime) {
        // Ca này đã hoàn thành cả vào và ra -> Bỏ qua, xét ca tiếp theo
        continue;
      }
      if (existingLog.checkInTime && !existingLog.checkOutTime) {
        // Ca này đang mở (đã check-in chưa check-out)
        alreadyCheckedInLog = existingLog;
        continue;
      }
    }

    // Chưa có bản ghi chấm công cho ca này:
    // Tình huống A: Đã muộn quá ngưỡng cho phép của ca (currentMinutes > startMinutes + lateThreshold)
    if (currentMinutes > startMinutes + lateThreshold) {
      const absentResult = await processScheduleAttendanceCheck(sch, dayRange);
      cancelledSchedules.push({
        scheduleId: sch._id,
        shiftName: shift.name,
        startTime: shiftStartStr,
        endTime: shiftEndStr,
        lateThreshold,
        absentResult,
      });

      // Ghi Audit Log hủy lịch tự động
      AuditLog.create({
        actor: userId,
        action: 'SCHEDULE_AUTO_CANCELLED_LATE',
        targetId: sch._id.toString(),
        targetType: 'Schedule',
        details: {
          shiftName: shift.name,
          startTime: shiftStartStr,
          currentMinutes,
          lateMinutes: currentMinutes - startMinutes,
          lateThreshold,
          reason: `Quá hạn check-in (muộn quá ${lateThreshold} phút). Tự động hủy lịch và đánh vắng.`,
        },
        timestamp: new Date(),
      }).catch((error) => {
        console.error('[AttendanceService] Không thể ghi audit log hủy lịch quá hạn:', error);
      });

      // Tiếp tục vòng lặp để kiểm tra xem có ca tiếp theo trong ngày không
      continue;
    }

    // Tình huống B: Chưa đến giờ check-in (chỉ cho phép điểm danh trước giờ bắt đầu tối đa 30 phút)
    const earlyLimitMinutes = Math.max(0, startMinutes - 30);
    if (currentMinutes < earlyLimitMinutes) {
      if (!upcomingSchedule) {
        const openH = Math.floor(earlyLimitMinutes / 60).toString().padStart(2, '0');
        const openM = (earlyLimitMinutes % 60).toString().padStart(2, '0');
        upcomingSchedule = {
          scheduleId: sch._id,
          shiftName: shift.name,
          startTime: shiftStartStr,
          endTime: shiftEndStr,
          openCheckInTime: `${openH}:${openM}`,
        };
      }
      continue;
    }

    // Tình huống C: Hợp lệ để check-in!
    // Trong vòng 30 phút trước ca hoặc muộn trong ngưỡng cho phép của ca
    const status = currentMinutes > startMinutes ? 'LATE' : 'ON_TIME';
    const lateMinutes = status === 'LATE' ? currentMinutes - startMinutes : 0;

    eligibleSchedule = {
      schedule: sch,
      shift,
      status,
      lateMinutes,
      shiftStartStr,
      shiftEndStr,
    };
    break; // Đã tìm thấy ca hợp lệ nhất để thực hiện check-in
  }

  // Nếu tìm thấy ca hợp lệ để check-in
  if (eligibleSchedule) {
    return {
      canCheckIn: true,
      selectedSchedule: eligibleSchedule.schedule,
      shift: eligibleSchedule.shift,
      status: eligibleSchedule.status,
      lateMinutes: eligibleSchedule.lateMinutes,
      cancelledSchedules,
    };
  }

  // Nếu người dùng đã check-in ca này rồi và đang mở
  if (alreadyCheckedInLog) {
    return {
      canCheckIn: false,
      status: 'ALREADY_CHECKED_IN',
      existingLog: alreadyCheckedInLog,
      message: `${prefix} ${userName} đã thực hiện điểm danh vào ca làm việc hôm nay rồi.`,
    };
  }

  // Nếu có ca bị hủy do muộn quá ngưỡng cho phép của ca đó
  if (cancelledSchedules.length > 0) {
    const c = cancelledSchedules[0];
    const thresholdText = c.lateThreshold ? `${c.lateThreshold} phút` : '15 phút';
    if (upcomingSchedule) {
      const openTimeText = upcomingSchedule.openCheckInTime ? ` (Mở điểm danh từ ${upcomingSchedule.openCheckInTime})` : '';
      return {
        canCheckIn: false,
        status: 'SCHEDULE_CANCELLED_LATE',
        message: `Lịch dạy/Ca làm việc ${c.shiftName} (${c.startTime}) của ${prefix} ${userName} đã quá hạn điểm danh (quá ${thresholdText}) và đã tự động ghi nhận vắng mặt. Ca tiếp theo: ${upcomingSchedule.shiftName} (${upcomingSchedule.startTime})${openTimeText} chưa đến giờ điểm danh.`,
        cancelledSchedules,
        upcomingSchedule,
      };
    }
    return {
      canCheckIn: false,
      status: 'SCHEDULE_CANCELLED_LATE',
      message: `Lịch dạy/Ca làm việc ${c.shiftName} (${c.startTime} - ${c.endTime}) của ${prefix} ${userName} đã quá hạn điểm danh (quá ${thresholdText}) và đã tự động ghi nhận vắng mặt.`,
      cancelledSchedules,
    };
  }

  // Nếu chưa đến giờ ca tiếp theo
  if (upcomingSchedule) {
    const openTimeText = upcomingSchedule.openCheckInTime ? ` (Mở điểm danh từ ${upcomingSchedule.openCheckInTime})` : '';
    return {
      canCheckIn: false,
      status: 'TOO_EARLY',
      message: `Chưa đến giờ điểm danh của ${prefix} ${userName}. Ca làm việc/lịch dạy tiếp theo: ${upcomingSchedule.shiftName} (${upcomingSchedule.startTime} - ${upcomingSchedule.endTime})${openTimeText}. Bạn chỉ có thể điểm danh trước giờ bắt đầu tối đa 30 phút.`,
      upcomingSchedule,
    };
  }

  // Nếu có ca hôm nay đã bị ghi nhận vắng mặt hoặc nghỉ có phép, thông báo chính xác
  if (absentSchedules.length > 0) {
    const lastAbsent = absentSchedules[absentSchedules.length - 1];
    const shiftName = lastAbsent.shift?.name || 'Ca làm việc';
    const statusText = lastAbsent.status === 'EXCUSED_ABSENCE' ? 'nghỉ có phép' : 'vắng mặt (do quá hạn điểm danh)';
    const thresholdText = lastAbsent.lateThreshold ? ` (quá ${lastAbsent.lateThreshold} phút)` : '';
    return {
      canCheckIn: false,
      status: 'SCHEDULE_ABSENT_RECORDED',
      message: `Lịch dạy/Ca làm việc ${shiftName} (${lastAbsent.shiftStartStr} - ${lastAbsent.shiftEndStr}) của ${prefix} ${userName} đã quá hạn điểm danh${thresholdText} và đã bị ghi nhận ${statusText}.`,
      absentSchedules,
    };
  }

  // Tất cả các ca hôm nay đã hoàn thành hoặc đã xử lý
  return {
    canCheckIn: false,
    status: 'ALL_SCHEDULES_COMPLETED',
    message: `${prefix} ${userName} đã hoàn thành tất cả các ca làm việc/lịch dạy trong ngày hôm nay.`,
  };
};

/**
 * Đánh giá trạng thái khi Check-out:
 * - So sánh giờ check-out thực tế với endTime của ca làm việc
 * - Nếu về trước endTime:
 *   + Nếu trạng thái ban đầu là ON_TIME -> Chuyển thành EARLY_LEAVE
 *   + Nếu trạng thái ban đầu là LATE -> Giữ nguyên LATE
 * @param {Date} checkOutTime 
 * @param {Object} shiftConfig 
 * @param {String} initialStatus - 'ON_TIME' | 'LATE'
 * @returns {Object} { finalStatus, isEarlyLeave, earlyMinutes }
 */

module.exports = { evaluateUserScheduleForCheckIn, isScheduleActiveOnDate };
