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
    ma_nguoi_dung: userId,
    userId,
    thoi_diem_quet: nowVN,
    punchTime: nowVN,
    loai_quet: 'RA',
    punchType: 'RA',
    phuong_thuc: method.toUpperCase(),
    method: method.toUpperCase(),
    thiet_bi_id: finalDeviceId,
    deviceId: finalDeviceId,
    dia_chi_ip: ip || null,
    clientIp: ip || null,
    ipAddress: ip || null,
    mang_noi_bo_truong: geofenceMeta ? geofenceMeta.isCampusNetwork : null,
    isCampusNetwork: geofenceMeta ? geofenceMeta.isCampusNetwork : null,
    nghi_van_gia_mao: Boolean(geofenceMeta?.isSuspicious),
    isSuspicious: Boolean(geofenceMeta?.isSuspicious),
    ly_do_nghi_van: geofenceMeta?.suspiciousReason || null,
    suspiciousReason: geofenceMeta?.suspiciousReason || null,
    phuong_thuc_xac_thuc_vi_tri: geofenceMeta?.verificationMethod || null,
    verificationMethod: geofenceMeta?.verificationMethod || null,
    dia_diem: validatedLocationName,
    locationName: validatedLocationName,
    co_gian_lan: isFraud,
    isFraud,
    ly_do_gian_lan: fraudReason,
    fraudReason,
    ma_ca: openLog.shiftId?._id || null,
    shiftId: openLog.shiftId?._id || null,
  };

  if (hasCoordinates) {
    punchPayload.toa_do_gps = {
      type: 'Point',
      coordinates: [lng, lat],
    };
    punchPayload.gpsCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: accuracy || null,
    };
  }

  const punchLog = await PunchLog.create(punchPayload);

  // 3. Cập nhật AttendanceLog (Collection 3 - bang_cham_cong_tong_hop)
  openLog.checkOutTime = nowVN;
  openLog.phuong_thuc_ra = method.toUpperCase();

  // Tính số phút về sớm và cập nhật trạng thái
  const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
    nowVN,
    openLog.shiftId,
    openLog.status
  );

  openLog.status = finalStatus;
  openLog.ve_som_phut = earlyMinutes || 0;
  openLog.earlyMinutes = earlyMinutes || 0;

  // Tính tổng giờ làm việc thực tế
  if (openLog.checkInTime) {
    const diffMs = nowVN.getTime() - new Date(openLog.checkInTime).getTime();
    const hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
    openLog.workHours = hours;
    openLog.tong_gio_lam = hours;
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
    .select('email fullName ho_ten')
    .then((user) => {
      if (user && user.email) {
        sendCheckOutNotificationEmail(user.email, user.fullName || user.ho_ten, nowVN, finalStatus).catch(() => {});
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
