/**
 * Tổng hợp thông báo của người dùng từ các sự kiện chấm công, lịch và đơn nghỉ.
 */
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Schedule = require('../models/schedule.model');
const User = require('../models/user.model');
const { getDeanScopedUserIds } = require('../utils/deanScope');
const { getVietnamTime, getVietnamDayRange } = require('../utils/attendanceTime.utils');

const formatDateTimeVN = (date) =>
  date
    ? new Date(date).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

const formatTimeVN = (date) =>
  date
    ? new Date(date).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const formatDateVN = (date) =>
  date
    ? new Date(date).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

const getNotifications = async ({ userId, lastReadAt: lastReadAtInput }) => {
  const user = await User.findById(userId).lean();
  if (!user) return [];

  const notifications = [];
  const recentAttendances = await AttendanceLog.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(4)
    .populate('shiftId', 'name startTime endTime')
    .lean();

  recentAttendances.forEach((attendance) => {
    const shiftName = attendance.shiftId?.name || 'Ca làm việc';
    if (attendance.checkOutTime) {
      notifications.push({
        id: `att-out-${attendance._id}`,
        title: `Đã check-out: ${shiftName}`,
        message: `Check-out thành công lúc ${formatTimeVN(attendance.checkOutTime)}. Email biên nhận điểm danh đã gửi về ${user.email}.`,
        type: 'attendance',
        status: 'success',
        timestamp: attendance.checkOutTime,
        link: '/attendance/history',
      });
    } else if (attendance.checkInTime) {
      const isLate = attendance.status === 'LATE';
      notifications.push({
        id: `att-in-${attendance._id}`,
        title: `Điểm danh thành công (${isLate ? 'Đến muộn' : 'Đúng giờ'}): ${shiftName}`,
        message: `Ghi nhận check-in lúc ${formatTimeVN(attendance.checkInTime)} (Phương thức: ${attendance.method?.toUpperCase()}). Đã đồng bộ vào hệ thống & gửi email.`,
        type: 'attendance',
        status: isLate ? 'warning' : 'success',
        timestamp: attendance.checkInTime,
        link: '/attendance/history',
      });
    } else if (attendance.status === 'ABSENT') {
      notifications.push({
        id: `att-absent-${attendance._id}`,
        title: `Cảnh báo vắng mặt: ${shiftName}`,
        message: `Hệ thống ghi nhận vắng mặt ngày ${formatDateVN(attendance.createdAt)}. Thông báo cảnh báo đã được gửi về email cá nhân.`,
        type: 'attendance',
        status: 'danger',
        timestamp: attendance.createdAt,
        link: '/leave/create',
      });
    }
  });

  if (user.role === 'giangvien' || user.role === 'nhanvien') {
    const requests = await LeaveRequest.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(3).lean();
    requests.forEach((leave) => {
      const date = `từ ${formatDateVN(leave.startDate)} đến ${formatDateVN(leave.endDate)}`;
      if (leave.status === 'APPROVED') {
        notifications.push({
          id: `leave-${leave._id}`,
          title: 'Đơn xin nghỉ phép đã được duyệt',
          message: `Đơn nghỉ ${date} đã được phê duyệt. Thông báo xác nhận đã gửi về email.`,
          type: 'leave',
          status: 'success',
          timestamp: leave.updatedAt || leave.createdAt,
          link: '/leave/my-requests',
        });
      } else if (leave.status === 'REJECTED') {
        notifications.push({
          id: `leave-${leave._id}`,
          title: 'Đơn xin nghỉ phép bị từ chối',
          message: `Đơn nghỉ từ ${formatDateVN(leave.startDate)} bị từ chối${leave.rejectionReason ? `: "${leave.rejectionReason}"` : ''}.`,
          type: 'leave',
          status: 'danger',
          timestamp: leave.updatedAt || leave.createdAt,
          link: '/leave/my-requests',
        });
      } else if (leave.status === 'PENDING') {
        notifications.push({
          id: `leave-${leave._id}`,
          title: 'Đơn xin nghỉ phép đang chờ duyệt',
          message: `Đơn xin nghỉ gửi lúc ${formatDateTimeVN(leave.createdAt)} đang chờ Trưởng khoa xem xét và duyệt.`,
          type: 'leave',
          status: 'info',
          timestamp: leave.createdAt,
          link: '/leave/my-requests',
        });
      }
    });
  } else if (user.role === 'truongkhoa' || user.role === 'admin') {
    const pendingQuery = { status: 'PENDING' };
    if (user.role === 'truongkhoa') {
      pendingQuery.userId = { $in: await getDeanScopedUserIds(user) };
    }
    const pendingLeaves = await LeaveRequest.find(pendingQuery)
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'fullName email')
      .lean();
    if (pendingLeaves.length) {
      notifications.push({
        id: 'leave-pending-summary',
        title: `Hộp duyệt đơn: ${pendingLeaves.length} đơn cần xử lý`,
        message: `Có đơn xin nghỉ phép từ ${pendingLeaves.map((leave) => leave.userId?.fullName || 'cán bộ').join(', ')} đang chờ phê duyệt.`,
        type: 'leave',
        status: 'warning',
        timestamp: pendingLeaves[0].createdAt,
        link: '/leave/approvals',
      });
    }
  }

  const nowVN = getVietnamTime();
  const { startOfDay, endOfDay } = getVietnamDayRange(nowVN);
  const todaySchedules = await Schedule.find({
    userId: user._id,
    weekday: nowVN.getDay(),
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  })
    .populate('shiftId', 'name startTime endTime')
    .lean();

  if (todaySchedules.length) {
    notifications.push({
      id: 'schedule-today',
      title: `Lịch giảng dạy hôm nay (${todaySchedules.length} ca)`,
      message: `Hôm nay bạn có lịch: ${todaySchedules.map((schedule) => `${schedule.shiftId?.name || 'Ca dạy'} (${schedule.startTime || schedule.shiftId?.startTime || ''} - ${schedule.endTime || schedule.shiftId?.endTime || ''})`).join(', ')}. Vui lòng thực hiện điểm danh đúng khung giờ.`,
      type: 'schedule',
      status: 'info',
      timestamp: startOfDay,
      link: '/schedules',
    });
  }

  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const lastReadAt = lastReadAtInput ? new Date(lastReadAtInput) : null;
  const unreadCount =
    lastReadAt && !Number.isNaN(lastReadAt.getTime())
      ? notifications.filter((notification) => new Date(notification.timestamp).getTime() > lastReadAt.getTime()).length
      : notifications.length > 0
        ? 1
        : 0;

  return {
    total: notifications.length,
    unreadCount,
    notifications: notifications.slice(0, 10),
  };
};

module.exports = { getNotifications };
