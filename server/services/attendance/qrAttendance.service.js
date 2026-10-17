/**
 * QR Attendance Service (server/services/attendance/qrAttendance.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Xác minh mã QR động (TOTP / HMAC Dynamic QR) theo thời gian thực.
 * - Bắt buộc kiểm tra định vị GPS để chống gian lận chụp ảnh mã QR gửi từ xa.
 * - Tự động nhận diện chu trình Check-in (nếu chưa vào) hoặc Check-out (nếu đã vào).
 * - Lưu vết đầy đủ vào PunchLog (Collection 4 - nhat_ky_quet_the) & AttendanceLog (Collection 3).
 */
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const User = require('../../models/user.model');
const AuditLog = require('../../models/auditLog.model');
const { sendCheckInNotificationEmail, sendCheckOutNotificationEmail } = require('../email.service');
const { validateGeofence, verifyDynamicQRCode } = require('../../utils/attendanceHelpers');
const {
  ServiceError,
  getVietnamTime,
  getVietnamDayRange,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
} = require('../../utils/attendanceTime.utils');
const { evaluateUserScheduleForCheckIn } = require('./attendanceScheduleEligibility.service');

/**
 * 1. Xử lý quét mã QR điểm danh (Hỗ trợ cả Check-in và Check-out)
 */
const processScanQRCode = async ({
  userId,
  qrToken,
  location,
  latitude,
  longitude,
  deviceId,
  ip,
}) => {
  if (!qrToken) {
    throw new ServiceError('Mã qrToken là bắt buộc.', 400);
  }

  // 1. Xác minh tính hợp lệ và thời hạn của Dynamic QR Token
  const verifyResult = verifyDynamicQRCode(qrToken);
  if (!verifyResult.valid) {
    throw new ServiceError(verifyResult.message || 'Mã QR không hợp lệ hoặc đã hết hạn.', 400);
  }

  const finalDeviceId = deviceId || 'MOBILE_APP_QR';
  const lat = latitude !== undefined ? latitude : location?.lat;
  const lng = longitude !== undefined ? longitude : location?.lng;

  // 2. Bắt buộc kiểm tra GPS chống gian lận quét QR từ xa
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    throw new ServiceError(
      'Điểm danh bằng mã QR bắt buộc phải bật định vị GPS để xác thực bạn đang có mặt tại trường.',
      400,
      'ATTENDANCE_GPS_REQUIRED'
    );
  }

  let isFraud = false;
  let fraudReason = null;
  const geofenceResult = validateGeofence({ lat, lng }, [], null, ip);
  if (!geofenceResult.valid) {
    isFraud = true;
    fraudReason = geofenceResult.fraudReason || `Quét mã QR nhưng GPS nằm ngoài khuôn viên trường (${Math.round(geofenceResult.distance)}m).`;
  }
  const locationName = geofenceResult.closest?.name || 'Khuôn viên Đại học';

  const nowVN = getVietnamTime();
  const { startOfDay, endOfDay } = getVietnamDayRange();

  // 3. Tra cứu bản ghi chấm công hôm nay của nhân sự
  let attendance = await AttendanceLog.findOne({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay },
  }).populate('shiftId');

  // TRƯỜNG HỢP 1: CHƯA CHECK-IN -> THỰC HIỆN CHECK-IN BẰNG QR
  if (!attendance || !attendance.checkInTime) {
    let effectiveShift = null;
    let calculatedStatus = 'ON_TIME';
    let lateMinutes = 0;

    try {
      const evalResult = await evaluateUserScheduleForCheckIn(userId, nowVN);
      if (evalResult && evalResult.shift) {
        effectiveShift = evalResult.shift;
        const statusInfo = calculateAttendanceStatus(nowVN, effectiveShift);
        calculatedStatus = statusInfo.status;
        lateMinutes = statusInfo.lateMinutes || 0;
      }
    } catch (_) {}

    // Tạo PunchLog (Collection 4 - nhat_ky_quet_the)
    const punchLog = await PunchLog.create({
      ma_nguoi_dung: userId,
      userId,
      thoi_diem_quet: nowVN,
      punchTime: nowVN,
      loai_quet: 'VAO',
      punchType: 'VAO',
      phuong_thuc: 'QR',
      method: 'QR',
      thiet_bi_id: finalDeviceId,
      deviceId: finalDeviceId,
      dia_chi_ip: ip || null,
      clientIp: ip || null,
      ipAddress: ip || null,
      mang_noi_bo_truong: geofenceResult ? geofenceResult.isCampusNetwork : null,
      isCampusNetwork: geofenceResult ? geofenceResult.isCampusNetwork : null,
      nghi_van_gia_mao: Boolean(geofenceResult?.isSuspicious),
      isSuspicious: Boolean(geofenceResult?.isSuspicious),
      ly_do_nghi_van: geofenceResult?.suspiciousReason || null,
      suspiciousReason: geofenceResult?.suspiciousReason || null,
      phuong_thuc_xac_thuc_vi_tri: geofenceResult?.verificationMethod || null,
      verificationMethod: geofenceResult?.verificationMethod || null,
      dia_diem: locationName,
      locationName,
      toa_do_gps: { type: 'Point', coordinates: [lng, lat] },
      gpsCoordinates: { latitude: lat, longitude: lng },
      co_gian_lan: isFraud,
      isFraud,
      ly_do_gian_lan: fraudReason,
      fraudReason,
      ma_ca: effectiveShift?._id || null,
      shiftId: effectiveShift?._id || null,
    });

    if (!attendance) {
      attendance = new AttendanceLog({
        userId,
        date: startOfDay,
        checkInTime: nowVN,
        status: calculatedStatus,
        method: 'QR',
        phuong_thuc_vao: 'QR',
        deviceId: finalDeviceId,
        shiftId: effectiveShift?._id || null,
        di_muon_phut: lateMinutes,
        lateMinutes,
        isFraud,
        fraudReason,
        location: { lat, lng, address: locationName },
        punchLogIds: [punchLog._id],
      });
    } else {
      attendance.checkInTime = nowVN;
      attendance.status = calculatedStatus;
      attendance.method = 'QR';
      attendance.phuong_thuc_vao = 'QR';
      attendance.deviceId = finalDeviceId;
      attendance.di_muon_phut = lateMinutes;
      attendance.lateMinutes = lateMinutes;
      if (isFraud) {
        attendance.isFraud = true;
        attendance.fraudReason = fraudReason;
      }
      attendance.location = { lat, lng, address: locationName };
      if (!Array.isArray(attendance.punchLogIds)) attendance.punchLogIds = [];
      attendance.punchLogIds.push(punchLog._id);
    }

    await attendance.save();

    return {
      type: 'CHECK_IN',
      message: isFraud
        ? `Quét QR Check-in thành công có cảnh báo: ${fraudReason}`
        : 'Quét mã QR Check-in thành công.',
      status: calculatedStatus,
      checkInTime: nowVN,
      isFraud,
      fraudReason,
      attendanceLog: attendance,
      punchLog,
    };
  }

  // TRƯỜNG HỢP 2: ĐÃ CHECK-IN NHƯNG CHƯA CHECK-OUT -> THỰC HIỆN CHECK-OUT BẰNG QR
  if (attendance.checkInTime && !attendance.checkOutTime) {
    const punchLog = await PunchLog.create({
      ma_nguoi_dung: userId,
      userId,
      thoi_diem_quet: nowVN,
      punchTime: nowVN,
      loai_quet: 'RA',
      punchType: 'RA',
      phuong_thuc: 'QR',
      method: 'QR',
      thiet_bi_id: finalDeviceId,
      deviceId: finalDeviceId,
      dia_chi_ip: ip || null,
      clientIp: ip || null,
      ipAddress: ip || null,
      mang_noi_bo_truong: geofenceResult ? geofenceResult.isCampusNetwork : null,
      isCampusNetwork: geofenceResult ? geofenceResult.isCampusNetwork : null,
      nghi_van_gia_mao: Boolean(geofenceResult?.isSuspicious),
      isSuspicious: Boolean(geofenceResult?.isSuspicious),
      ly_do_nghi_van: geofenceResult?.suspiciousReason || null,
      suspiciousReason: geofenceResult?.suspiciousReason || null,
      phuong_thuc_xac_thuc_vi_tri: geofenceResult?.verificationMethod || null,
      verificationMethod: geofenceResult?.verificationMethod || null,
      dia_diem: locationName,
      locationName,
      toa_do_gps: { type: 'Point', coordinates: [lng, lat] },
      gpsCoordinates: { latitude: lat, longitude: lng },
      co_gian_lan: isFraud,
      isFraud,
      ly_do_gian_lan: fraudReason,
      fraudReason,
      ma_ca: attendance.shiftId?._id || null,
      shiftId: attendance.shiftId?._id || null,
    });

    attendance.checkOutTime = nowVN;
    attendance.phuong_thuc_ra = 'QR';

    const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
      nowVN,
      attendance.shiftId,
      attendance.status
    );

    attendance.status = finalStatus;
    attendance.ve_som_phut = earlyMinutes || 0;
    attendance.earlyMinutes = earlyMinutes || 0;

    const diffMs = nowVN.getTime() - new Date(attendance.checkInTime).getTime();
    const hours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
    attendance.workHours = hours;
    attendance.tong_gio_lam = hours;

    if (isFraud) {
      attendance.isFraud = true;
      attendance.fraudReason = attendance.fraudReason
        ? `${attendance.fraudReason}; ${fraudReason}`
        : fraudReason;
    }

    if (!Array.isArray(attendance.punchLogIds)) attendance.punchLogIds = [];
    attendance.punchLogIds.push(punchLog._id);

    await attendance.save();

    return {
      type: 'CHECK_OUT',
      message: isFraud
        ? `Quét QR Check-out thành công có cảnh báo: ${fraudReason}`
        : 'Quét mã QR Check-out thành công.',
      status: finalStatus,
      checkOutTime: nowVN,
      workHours: attendance.workHours,
      earlyMinutes: attendance.earlyMinutes,
      isFraud,
      fraudReason,
      attendanceLog: attendance,
      punchLog,
    };
  }

  // TRƯỜNG HỢP 3: ĐÃ CẢ CHECK-IN VÀ CHECK-OUT
  throw new ServiceError(
    'Bạn đã hoàn thành đủ cả lượt Check-in và Check-out trong ngày hôm nay rồi.',
    400,
    'ATTENDANCE_COMPLETED_TODAY'
  );
};

module.exports = { processScanQRCode };
