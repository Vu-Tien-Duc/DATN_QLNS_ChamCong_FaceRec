/**
 * Attendance Admin Service (server/services/attendance/attendanceAdmin.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Điều chỉnh bản ghi chấm công bởi Quản trị viên / Trưởng khoa có lưu vết kiểm toán AuditLog.
 * - Cho phép cập nhật trạng thái (status), giờ vào (checkInTime), giờ ra (checkOutTime), cờ gian lận (isFraud).
 * - Tự động tính toán lại tổng giờ làm việc thực tế (workHours).
 * - Cập nhật đồng bộ cấu hình khuôn viên trường (Campus Geofence).
 */
const mongoose = require('mongoose');
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const AuditLog = require('../../models/auditLog.model');
const { updateCampusConfig } = require('../../utils/attendanceHelpers');
const { ServiceError } = require('../../utils/attendanceTime.utils');

/**
 * 1. Quản trị viên cập nhật hoặc hiệu chỉnh bản ghi chấm công
 */
const updateAttendanceByAdmin = async ({
  id,
  actorId,
  ip,
  status,
  checkInTime,
  checkOutTime,
  leaveRequestId,
  isFraud,
  fraudReason,
}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng mã bản ghi chấm công không hợp lệ.', 400);
  }

  const log = await AttendanceLog.findById(id);
  if (!log) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công cần điều chỉnh.', 404);
  }

  const previousData = {
    status: log.status,
    checkInTime: log.checkInTime,
    checkOutTime: log.checkOutTime,
    method: log.method,
    isManualOverride: log.isManualOverride,
    isFraud: log.isFraud,
    fraudReason: log.fraudReason,
    leaveRequestId: log.leaveRequestId,
  };

  const nextCheckInTime = checkInTime !== undefined ? new Date(checkInTime) : log.checkInTime;
  const nextCheckOutTime = checkOutTime !== undefined ? new Date(checkOutTime) : log.checkOutTime;

  if (checkInTime !== undefined && Number.isNaN(nextCheckInTime.getTime())) {
    throw new ServiceError('Thời điểm check-in không hợp lệ.', 400);
  }
  if (checkOutTime !== undefined && Number.isNaN(nextCheckOutTime.getTime())) {
    throw new ServiceError('Thời điểm check-out không hợp lệ.', 400);
  }
  if (nextCheckInTime && nextCheckOutTime && nextCheckOutTime < nextCheckInTime) {
    throw new ServiceError('Thời điểm check-out không thể diễn ra trước thời điểm check-in.', 400);
  }

  if (status !== undefined) log.status = status;
  if (checkInTime !== undefined) log.checkInTime = nextCheckInTime;
  if (checkOutTime !== undefined) log.checkOutTime = nextCheckOutTime;
  if (leaveRequestId !== undefined) log.leaveRequestId = leaveRequestId;
  if (isFraud !== undefined) log.isFraud = Boolean(isFraud);
  if (fraudReason !== undefined) log.fraudReason = fraudReason;

  log.method = 'admin_override';
  log.isManualOverride = true;

  // Tính lại tổng giờ làm nếu có đủ giờ vào và giờ ra
  if (log.checkInTime && log.checkOutTime) {
    const diffMs = log.checkOutTime.getTime() - log.checkInTime.getTime();
    const hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
    log.workHours = hours;
  }

  await log.save();

  // Ghi Audit Log toàn diện
  AuditLog.create({
    actor: actorId,
    actorType: 'user',
    action: 'ADMIN_OVERRIDE_ATTENDANCE',
    targetId: log._id.toString(),
    targetType: 'AttendanceLog',
    ipAddress: ip || null,
    details: {
      userId: log.userId,
      previous: previousData,
      updated: {
        status: log.status,
        checkInTime: log.checkInTime,
        checkOutTime: log.checkOutTime,
        isFraud: log.isFraud,
        fraudReason: log.fraudReason,
        workHours: log.workHours,
      },
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return log;
};

module.exports = {
  updateAttendanceByAdmin,
  updateCampusConfig,
};
