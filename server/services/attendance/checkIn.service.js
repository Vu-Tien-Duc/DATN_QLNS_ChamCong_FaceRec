/**
 * Check-In Service (server/services/attendance/checkIn.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Lưu bản ghi sự kiện quẹt vào PunchLog (Collection 4 - nhat_ky_quet_the) với GeoJSON Point [lng, lat].
 * - Khởi tạo hoặc cập nhật bản ghi tổng hợp AttendanceLog (Collection 3 - bang_cham_cong_tong_hop).
 * - Xác thực Geofence khuôn viên trường (150m) & phòng học (30m) qua công thức Haversine.
 * - Tự động đánh dấu cờ gian lận (isFraud, fraudReason) khi quẹt ngoài bán kính cho phép.
 * - Tính toán trạng thái đúng giờ (ON_TIME) / đi muộn (LATE) theo ca hoặc thời khóa biểu.
 */
const mongoose = require('mongoose');
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const Schedule = require('../../models/schedule.model');
const ShiftConfig = require('../../models/shiftConfig.model');
const User = require('../../models/user.model');
const { sendCheckInNotificationEmail } = require('../email.service');
const { calculateDistanceMeters, validateGeofence } = require('../../utils/attendanceHelpers');
const {
  ServiceError,
  getVietnamTime,
  getVietnamDayRange,
  timeStringToMinutes,
  calculateAttendanceStatus,
} = require('../../utils/attendanceTime.utils');
const { evaluateUserScheduleForCheckIn } = require('./attendanceScheduleEligibility.service');

/**
 * 1. Thực hiện Check-In chấm công
 */
const performCheckIn = async ({
  userId,
  deviceId,
  deviceInfo,
  location,
  latitude,
  longitude,
  accuracy,
  method = 'gps',
  shiftId,
  scheduleId,
  ip,
}) => {
  if (!userId) {
    throw new ServiceError('Thiếu thông tin người dùng (userId).', 400);
  }

  // Chặn điểm danh thủ công cũ
  if (method === 'manual') {
    throw new ServiceError(
      'Phương thức điểm danh thủ công đã bị vô hiệu hóa. Vui lòng sử dụng Định vị GPS, Quét mã QR hoặc Nhận diện khuôn mặt Face ID.',
      400,
      'MANUAL_ATTENDANCE_DISABLED'
    );
  }

  const finalDeviceId = deviceId || deviceInfo || 'MOBILE_APP';
  const lat = latitude !== undefined ? latitude : location?.lat;
  const lng = longitude !== undefined ? longitude : location?.lng;
  const hasCoordinates = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  let isFraud = false;
  let fraudReason = null;
  let validatedLocationName = 'Khuôn viên trường';
  let geofenceMeta = null;

  // 1. Kiểm tra Geofence GPS Haversine & Mạng trường đối soát chéo
  if (method === 'gps' || hasCoordinates) {
    if (accuracy !== undefined && accuracy !== null) {
      if (typeof accuracy === 'number' && accuracy > 150) {
        throw new ServiceError(
          `Độ chính xác GPS không đủ tin cậy (sai số ${accuracy}m vượt ngưỡng cho phép <= 150m). Vui lòng di chuyển ra nơi thoáng.`,
          400,
          'GPS_ACCURACY_UNRELIABLE',
          { accuracy }
        );
      }
    }

    if (hasCoordinates) {
      const geofenceResult = validateGeofence({ lat, lng }, [], null, ip);
      geofenceMeta = geofenceResult;
      if (!geofenceResult.valid) {
        isFraud = true;
        fraudReason = geofenceResult.fraudReason || `Tọa độ GPS nằm ngoài bán kính cho phép (${Math.round(geofenceResult.distance)}m so với tâm trường).`;
      } else {
        validatedLocationName = geofenceResult.closest?.name || 'Khuôn viên Đại học';
      }
    }
  }

  const nowVN = getVietnamTime();
  const { startOfDay, endOfDay } = getVietnamDayRange();

  const workDateStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, '0')}-${String(nowVN.getDate()).padStart(2, '0')}`;

  // 2. Kiểm tra xem hôm nay đã có lượt check-in chưa
  let attendance = await AttendanceLog.findOne({
    userId,
    workDate: workDateStr,
  });

  if (attendance && attendance.checkInTime) {
    throw new ServiceError(
      'Bạn đã thực hiện check-in cho ngày hôm nay rồi.',
      400,
      'ATTENDANCE_ALREADY_CHECKED_IN',
      { checkInTime: attendance.checkInTime }
    );
  }

  // 3. Đánh giá ca làm việc hoặc thời khóa biểu hôm nay
  let effectiveShift = null;
  let calculatedStatus = 'on_time';
  let lateMinutes = 0;

  if (shiftId) {
    effectiveShift = await ShiftConfig.findById(shiftId);
  }

  if (!effectiveShift) {
    const evalResult = await evaluateUserScheduleForCheckIn(userId);
    if (!evalResult || !evalResult.canCheckIn) {
      throw new ServiceError(
        evalResult?.message || 'Hôm nay bạn không có lịch phân công làm việc hoặc giảng dạy trên hệ thống. Không thể thực hiện chấm công.',
        400,
        evalResult?.status || 'NO_SCHEDULE'
      );
    }
    effectiveShift = evalResult.shift;
    scheduleId = evalResult.selectedSchedule?._id || null;
    calculatedStatus = evalResult.status || 'on_time';
    lateMinutes = evalResult.lateMinutes || 0;
  } else {
    const statusInfo = calculateAttendanceStatus(nowVN, effectiveShift);
    calculatedStatus = statusInfo.status;
    lateMinutes = statusInfo.lateMinutes || 0;
  }

  // 4. Khởi tạo ID AttendanceLog và tạo bản ghi PunchLog (Collection 4 - nhat_ky_quet_the)
  const attendanceId = attendance?._id || new mongoose.Types.ObjectId();
  const finalShiftId = shiftId || effectiveShift?._id || null;

  const punchPayload = {
    attendanceLogId: attendanceId,
    userId,
    punchTime: nowVN,
    punchType: 'check_in',
    method: method.toLowerCase(),
    deviceId: finalDeviceId,
    clientIp: ip || null,
    isCampusNetwork: geofenceMeta ? geofenceMeta.isCampusNetwork : null,
    isSuspicious: Boolean(geofenceMeta?.isSuspicious),
    suspiciousReason: geofenceMeta?.suspiciousReason || null,
    verificationMethod: geofenceMeta?.verificationMethod || null,
    locationName: validatedLocationName,
    isFraud: isFraud,
    fraudReason,
    shiftId: finalShiftId,
    scheduleId: scheduleId || null,
  };

  if (hasCoordinates) {
    punchPayload.gpsCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: accuracy || null,
    };
  }

  const punchLog = await PunchLog.create(punchPayload);

  // 5. Khởi tạo / Cập nhật AttendanceLog (Collection 3 - bang_cham_cong_tong_hop)
  if (!attendance) {
    attendance = new AttendanceLog({
      _id: attendanceId,
      userId,
      workDate: workDateStr,
      checkInTime: nowVN,
      status: calculatedStatus,
      method: method.toLowerCase(),
      deviceId: finalDeviceId,
      shiftId: finalShiftId,
      scheduleId: scheduleId || null,
      lateMinutes,
      isFraud,
      fraudReason,
      location: hasCoordinates ? { lat, lng, address: validatedLocationName } : null,
      punchLogIds: [punchLog._id],
    });
  } else {
    attendance.checkInTime = nowVN;
    attendance.status = calculatedStatus;
    attendance.method = method.toLowerCase();
    attendance.deviceId = finalDeviceId;
    attendance.lateMinutes = lateMinutes;
    if (isFraud) {
      attendance.isFraud = true;
      attendance.fraudReason = fraudReason;
    }
    if (hasCoordinates) {
      attendance.location = { lat, lng, address: validatedLocationName };
    }
    if (!Array.isArray(attendance.punchLogIds)) attendance.punchLogIds = [];
    attendance.punchLogIds.push(punchLog._id);
  }

  await attendance.save();

  // Gửi email thông báo không đồng bộ
  User.findById(userId)
    .select('email fullName')
    .then((user) => {
      if (user && user.email) {
        sendCheckInNotificationEmail(user.email, user.fullName, nowVN, calculatedStatus).catch(
          () => {}
        );
      }
    })
    .catch(() => {});

  return {
    success: true,
    message: isFraud
      ? `Check-in thành công có cảnh báo: ${fraudReason}`
      : 'Check-in chấm công thành công.',
    attendanceLog: attendance,
    punchLog,
    status: calculatedStatus,
    lateMinutes,
    isFraud,
    fraudReason,
  };
};

module.exports = { performCheckIn };
