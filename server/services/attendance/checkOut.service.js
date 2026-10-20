/**
 * Check-Out Service (server/services/attendance/checkOut.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Lưu bản ghi sự kiện quẹt ra PunchLog (Collection 4 - nhat_ky_quet_the) với GeoJSON Point [lng, lat].
 * - Cập nhật AttendanceLog (Collection 3 - bang_cham_cong_tong_hop): Đóng phiên làm việc.
 * - Tính toán chính xác tổng giờ làm việc thực tế (workHours) và số phút về sớm (earlyMinutes).
 * - Kiểm tra Geofence GPS Haversine và đánh dấu cờ gian lận nếu quẹt ngoài vị trí.
 */
const mongoose = require('mongoose');
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const User = require('../../models/user.model');
const { sendCheckOutNotificationEmail } = require('../email.service');
const { validateGeofence } = require('../../utils/attendanceHelpers');
const {
  ServiceError,
  getVietnamTime,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/attendanceTime.utils');

/**
 * 1. Thực hiện Check-Out chấm công
 */
const performCheckOut = async ({
  userId,
  shiftId,
  attendanceId,
  deviceId,
  deviceInfo,
  location,
  latitude,
  longitude,
  accuracy,
  method = 'gps',
  ip,
}) => {
  if (!userId) {
    throw new ServiceError('Thiếu thông tin người dùng (userId).', 400);
  }

  const finalDeviceId = deviceId || deviceInfo || 'MOBILE_APP';
  const lat = latitude !== undefined ? latitude : location?.lat;
  const lng = longitude !== undefined ? longitude : location?.lng;
  const hasCoordinates = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  let isFraud = false;
  let fraudReason = null;
  let validatedLocationName = 'Khuôn viên trường';
  let geofenceMeta = null;

  if (method === 'gps' || hasCoordinates) {
    if (hasCoordinates) {
      const geofenceResult = validateGeofence({ lat, lng }, [], null, ip);
      geofenceMeta = geofenceResult;
      if (!geofenceResult.valid) {
        isFraud = true;
        fraudReason = geofenceResult.fraudReason || `Tọa độ GPS check-out nằm ngoài bán kính cho phép (${Math.round(geofenceResult.distance)}m so với tâm trường).`;
      } else {
        validatedLocationName = geofenceResult.closest?.name || 'Khuôn viên Đại học';
      }
    }
  }

  const { startOfDay, endOfDay } = getVietnamDayRange();
  const nowVN = getVietnamTime();

  // 1. Tìm bản ghi check-in đang mở trong ngày hôm nay
  const query = {
    userId,
    date: { $gte: startOfDay, $lte: endOfDay },
    checkInTime: { $ne: null },
    checkOutTime: null,
  };

  if (attendanceId && mongoose.isValidObjectId(attendanceId)) {
    query._id = attendanceId;
  } else if (shiftId && mongoose.isValidObjectId(shiftId)) {
    query.shiftId = shiftId;
  }

  let openLog = await AttendanceLog.findOne(query).populate('shiftId');

  // Fallback: Tìm bản ghi check-in mở gần nhất nếu chưa đóng
  if (!openLog) {
    openLog = await AttendanceLog.findOne({
      userId,
      checkInTime: { $ne: null },
      checkOutTime: null,
    })
      .sort({ checkInTime: -1 })
      .populate('shiftId');
  }

  if (!openLog) {
    throw new ServiceError(
      'Không tìm thấy lượt check-in nào đang mở cần check-out trong ngày hôm nay.',
      404,
      'ATTENDANCE_NO_OPEN_RECORD'
    );
  }

  // 2. Tạo bản ghi PunchLog (Collection 4 - nhat_ky_quet_the)
  const punchPayload = {
    cham_cong_id: openLog._id,
    attendanceLogId: openLog._id,
    userId,
    punchTime: nowVN,
    punchType: 'CHECK_OUT',
    method: method.toUpperCase(),
    deviceId: finalDeviceId,
    clientIp: ip || null,
    isCampusNetwork: geofenceMeta ? geofenceMeta.isCampusNetwork : null,
    isSuspicious: Boolean(geofenceMeta?.isSuspicious),
    suspiciousReason: geofenceMeta?.suspiciousReason || null,
    verificationMethod: geofenceMeta?.verificationMethod || null,
    locationName: validatedLocationName,
    isFraudulent: isFraud,
    fraudReason,
    shiftId: openLog.shiftId?._id || null,
  };

  if (hasCoordinates) {
    punchPayload.gpsCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: accuracy || null,
    };
  }

  const punchLog = await PunchLog.create(punchPayload);

  // 3. Cập nhật AttendanceLog (Collection 3 - bang_cham_cong_tong_hop)
  openLog.checkOutTime = nowVN;

  // Tính số phút về sớm và cập nhật trạng thái
  const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
    nowVN,
    openLog.shiftId,
    openLog.status
  );

  openLog.status = finalStatus;
  openLog.earlyMinutes = earlyMinutes || 0;

  // Tính tổng giờ làm việc thực tế
  if (openLog.checkInTime) {
    const diffMs = nowVN.getTime() - new Date(openLog.checkInTime).getTime();
    const hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
    openLog.workHours = hours;
  }

  if (isFraud) {
    openLog.isFraud = true;
    openLog.fraudReason = openLog.fraudReason
      ? `${openLog.fraudReason}; ${fraudReason}`
      : fraudReason;
  }

  if (!Array.isArray(openLog.punchLogIds)) openLog.punchLogIds = [];
  openLog.punchLogIds.push(punchLog._id);

  await openLog.save();

  // Gửi email thông báo
  User.findById(userId)
    .select('email fullName')
    .then((user) => {
      if (user && user.email) {
        sendCheckOutNotificationEmail(user.email, user.fullName, nowVN, finalStatus).catch(() => {});
      }
    })
    .catch(() => {});

  return {
    success: true,
    message: isFraud
      ? `Check-out thành công có cảnh báo: ${fraudReason}`
      : 'Check-out hoàn tất phiên làm việc thành công.',
    attendanceLog: openLog,
    punchLog,
    status: finalStatus,
    workHours: openLog.workHours,
    earlyMinutes: openLog.earlyMinutes,
    isFraud,
    fraudReason,
  };
};

module.exports = { performCheckOut };
