/**
 * Service Điểm Danh Nhận Diện Khuôn Mặt (Face Recognition Attendance Service)
 * Mã nguồn sạch chuẩn CSDL v2.5: Động cơ 1:N RAM Index, Bộ lọc Margin Top 1-2 >= 0.05,
 * Cooldown 60s chống quét lặp, Geofence GPS Haversine và Lưu vết Audit/PunchLog.
 */
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const Schedule = require('../../models/schedule.model');
const ShiftConfig = require('../../models/shiftConfig.model');
const User = require('../../models/user.model');
const AuditLog = require('../../models/auditLog.model');
const { recognizeFace, ensureRamCacheWarm } = require('../faceServiceClient');
const { validateGeofence } = require('../../utils/attendanceHelpers');
const { storeAttendanceEvidence } = require('../../utils/attendanceEvidence');
const {
  ServiceError,
  getVietnamTime,
  getVietnamDayRange,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
} = require('../../utils/attendanceTime.utils');

// In-memory Map quản lý Cooldown chống quét lặp 60 giây (COOLDOWN_QUET_GIAY = 60)
const scanCooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000;

/**
 * Xử lý luồng Điểm danh Khuôn mặt Realtime (1:N qua Face Service)
 */
const processFaceAttendance = async ({
  imageBuffer,
  location = null,
  deviceId = 'MAY_CHAM_CONG_CAMERA',
  reqIp = '127.0.0.1',
  verifyOnly = false,
}) => {
  if (!imageBuffer) {
    throw new ServiceError('Vui lòng cung cấp hình ảnh khuôn mặt từ camera.', 400);
  }

  // 1. Tự phục hồi RAM Cache nếu Face Service vừa khởi động lại
  await ensureRamCacheWarm();

  // 2. Gọi Face Service nhận diện 1:N trên RAM Vector Store
  const aiResult = await recognizeFace({ imageBuffer });

  if (!aiResult.matched) {
    const primaryReason = (aiResult.reasons && aiResult.reasons[0]) || 'Khuôn mặt không khớp với hồ sơ nhân sự nào.';

    // Phân loại mã lỗi từ AI
    if (primaryReason.includes('AMBIGUOUS_MATCH')) {
      throw new ServiceError(
        'Nhận diện mơ hồ: Độ chênh lệch giữa 2 ứng viên tương đồng nhất nhỏ hơn 0.05. Hệ thống từ chối để chống nhận diện nhầm.',
        409,
        'AMBIGUOUS_MATCH'
      );
    }
    if (primaryReason.includes('SPOOF_DETECTED')) {
      throw new ServiceError(
        'Phát hiện dấu hiệu giả mạo sinh trắc học (ảnh in hoặc màn hình kỹ thuật số).',
        403,
        'LIVENESS_FAILED'
      );
    }
    if (primaryReason.includes('MULTIPLE_FACES')) {
      throw new ServiceError('Phát hiện nhiều người trong khung hình. Vui lòng chấm công từng người.', 400, 'MULTIPLE_FACES');
    }

    throw new ServiceError(primaryReason, 404, 'FACE_NOT_MATCHED');
  }

  const userId = aiResult.userId;
  const user = await User.findById(userId);
  if (!user || user.isActive === false || user.trang_thai_hoat_dong === false) {
    throw new ServiceError('Tài khoản người dùng không tồn tại hoặc đã bị khóa.', 403);
  }

  // Nếu là chế độ verifyOnly: Chỉ trả về thông tin nhận diện để hiển thị popup xác nhận
  if (verifyOnly) {
    return {
      success: true,
      matched: true,
      userId: user._id,
      user: {
        _id: user._id,
        fullName: user.fullName || user.ho_ten,
        email: user.email,
        role: user.role || user.vai_tro,
        avatar: user.avatar || user.facePhoto,
        department: user.departmentId,
      },
      similarity: aiResult.similarity,
      confidence: aiResult.confidence,
      message: `Đã nhận diện: ${user.fullName || user.ho_ten}`,
    };
  }

  // 3. Kiểm tra Cooldown 60 giây chống quét lặp liên tiếp
  const userKey = userId.toString();
  const lastScanTime = scanCooldownMap.get(userKey);
  const nowMs = Date.now();
  if (lastScanTime && (nowMs - lastScanTime) < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (nowMs - lastScanTime)) / 1000);
    throw new ServiceError(
      `Bạn vừa quét chấm công thành công cách đây chưa đầy 60 giây. Vui lòng chờ ${remainingSeconds}s để tránh trùng lặp.`,
      409,
      'RECENTLY_SCANNED',
      { retryAfterSeconds: remainingSeconds }
    );
  }

  // 4. Xác thực Geofence GPS & Mạng trường (Đối soát chéo chống Fake GPS)
  const geoCheck = validateGeofence(location, null, null, reqIp);

  const nowVN = getVietnamTime();
  const { startOfDay, endOfDay } = getVietnamDayRange();
  const workDateStr = nowVN.toISOString().slice(0, 10);

  // 5. Tìm kiếm Lịch giảng dạy / Ca làm việc trong ngày của người dùng
  const todayWeekday = nowVN.getDay() === 0 ? 0 : nowVN.getDay(); // 0: CN, 1-6: T2-T7
  const activeSchedules = await Schedule.find({
    userId,
    weekday: todayWeekday,
    trang_thai: 'HOAT_DONG',
  }).populate('shiftId').populate('subjectId');

  // Tìm bản ghi chấm công đang mở (chưa Check-out) hôm nay
  const openLog = await AttendanceLog.findOne({
    userId,
    workDate: workDateStr,
    checkInTime: { $gte: startOfDay, $lte: endOfDay },
    checkOutTime: null,
  }).populate('shiftId');

  // Lưu ảnh minh chứng điểm danh an toàn
  const storedEvidencePath = await storeAttendanceEvidence(imageBuffer);

  let actionType = 'CHECK_IN';
  let attendanceRecord = null;

  if (openLog) {
    // 6. Thực hiện CHECK-OUT nếu đã có lượt Check-in trước đó
    actionType = 'CHECK_OUT';
    const checkOutTime = new Date();
    openLog.checkOutTime = checkOutTime;
    openLog.gio_ra = checkOutTime;
    if (storedEvidencePath) openLog.anh_minh_chung = storedEvidencePath;

    const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      openLog.shiftId,
      openLog.status
    );

    openLog.status = finalStatus;
    openLog.trang_thai = finalStatus;
    openLog.ve_som_phut = earlyMinutes || 0;
    openLog.co_ve_som = isEarlyLeave;
    openLog.quen_quet_ra = false;
    await openLog.save();
    attendanceRecord = openLog;

    // Ghi PunchLog lượt ra
    await PunchLog.create({
      attendanceLogId: openLog._id,
      userId,
      punchType: 'CHECK_OUT',
      loai_quet: 'CHECK_OUT',
      scanTime: checkOutTime,
      thoi_gian_quet: checkOutTime,
      method: 'face',
      phuong_thuc: 'face',
      confidenceScore: aiResult.similarity,
      do_tin_cay_ai: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      diem_mat_that: aiResult.liveness_score,
      anh_minh_chung: storedEvidencePath,
      location: location || { lat: null, lng: null },
      toa_do_gps: location?.lat ? { type: 'Point', coordinates: [location.lng, location.lat] } : undefined,
      deviceId,
      ma_thiet_bi: deviceId,
      isFraud: geoCheck.isFraud,
      co_gian_lan: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      ly_do_gian_lan: geoCheck.fraudReason,
      clientIp: reqIp,
      dia_chi_ip: reqIp,
      isCampusNetwork: geoCheck.isCampusNetwork,
      mang_noi_bo_truong: geoCheck.isCampusNetwork,
      isSuspicious: Boolean(geoCheck.isSuspicious),
      nghi_van_gia_mao: Boolean(geoCheck.isSuspicious),
      suspiciousReason: geoCheck.suspiciousReason,
      ly_do_nghi_van: geoCheck.suspiciousReason,
      verificationMethod: geoCheck.verificationMethod,
      phuong_thuc_xac_thuc_vi_tri: geoCheck.verificationMethod,
    });
  } else {
    // 7. Thực hiện CHECK-IN
    actionType = 'CHECK_IN';
    const checkInTime = new Date();

    // Xác định ca làm việc phù hợp nhất (theo lịch hoặc ca hành chính)
    let selectedShift = activeSchedules[0]?.shiftId;
    let selectedScheduleId = activeSchedules[0]?._id || null;

    if (!selectedShift) {
      selectedShift = await ShiftConfig.findOne({ isActive: true });
    }

    const calculatedStatus = calculateAttendanceStatus(checkInTime, selectedShift, nowVN);

    attendanceRecord = await AttendanceLog.create({
      userId,
      nguoi_dung_id: userId,
      shiftId: selectedShift?._id || null,
      ca_id: selectedShift?._id || null,
      scheduleId: selectedScheduleId,
      lich_trinh_id: selectedScheduleId,
      workDate: workDateStr,
      ngay_cong: workDateStr,
      checkInTime,
      gio_vao: checkInTime,
      method: 'face',
      phuong_thuc: 'face',
      status: calculatedStatus,
      trang_thai: calculatedStatus,
      confidenceScore: aiResult.similarity,
      do_tin_cay_ai: aiResult.similarity,
      capturedImage: storedEvidencePath,
      anh_minh_chung: storedEvidencePath,
      location: location || { lat: null, lng: null },
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
    });

    // Ghi PunchLog lượt vào
    await PunchLog.create({
      attendanceLogId: attendanceRecord._id,
      userId,
      punchType: 'CHECK_IN',
      loai_quet: 'CHECK_IN',
      scanTime: checkInTime,
      thoi_gian_quet: checkInTime,
      method: 'face',
      phuong_thuc: 'face',
      confidenceScore: aiResult.similarity,
      do_tin_cay_ai: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      diem_mat_that: aiResult.liveness_score,
      anh_minh_chung: storedEvidencePath,
      location: location || { lat: null, lng: null },
      toa_do_gps: location?.lat ? { type: 'Point', coordinates: [location.lng, location.lat] } : undefined,
      deviceId,
      ma_thiet_bi: deviceId,
      isFraud: geoCheck.isFraud,
      co_gian_lan: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      ly_do_gian_lan: geoCheck.fraudReason,
      clientIp: reqIp,
      dia_chi_ip: reqIp,
      isCampusNetwork: geoCheck.isCampusNetwork,
      mang_noi_bo_truong: geoCheck.isCampusNetwork,
      isSuspicious: Boolean(geoCheck.isSuspicious),
      nghi_van_gia_mao: Boolean(geoCheck.isSuspicious),
      suspiciousReason: geoCheck.suspiciousReason,
      ly_do_nghi_van: geoCheck.suspiciousReason,
      verificationMethod: geoCheck.verificationMethod,
      phuong_thuc_xac_thuc_vi_tri: geoCheck.verificationMethod,
    });
  }

  // 8. Cập nhật mốc thời gian Cooldown 60s
  scanCooldownMap.set(userKey, Date.now());

  // Ghi AuditLog
  AuditLog.create({
    actor: userId,
    actorType: 'USER',
    action: `ATTENDANCE_FACE_${actionType}`,
    targetId: attendanceRecord._id.toString(),
    targetType: 'AttendanceLog',
    ipAddress: reqIp,
    details: {
      similarity: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      isFraud: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    success: true,
    action: actionType,
    message: `${actionType === 'CHECK_IN' ? 'Check-in (Điểm danh vào)' : 'Check-out (Ra về)'} thành công: ${user.fullName || user.ho_ten}`,
    user: {
      _id: user._id,
      fullName: user.fullName || user.ho_ten,
      staffCode: user.staffCode || user.ma_can_bo,
      role: user.role,
      avatar: user.avatar,
    },
    similarity: aiResult.similarity,
    livenessScore: aiResult.liveness_score,
    isFraud: geoCheck.isFraud,
    fraudReason: geoCheck.fraudReason,
    record: attendanceRecord,
  };
};

module.exports = {
  processFaceAttendance,
  scanCooldownMap,
};
