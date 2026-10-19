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
const {
  checkAndSetCooldown,
  getCooldownRemaining,
  resetCooldown,
} = require('../../config/redis');
const { addPunchJob } = require('../../queues/punchQueue');

// In-memory Map quản lý Cooldown chống quét lặp 60 giây (Fallback song song cùng Redis)
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
  useQueue = false,
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
  if (!user || user.isActive === false) {
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
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        department: user.departmentId,
      },
      similarity: aiResult.similarity,
      confidence: aiResult.confidence,
      message: `Đã nhận diện: ${user.fullName}`,
    };
  }

  // 3. Kiểm tra Cooldown 60 giây chống quét lặp liên tiếp (Đồng bộ đa container qua Redis + Memory Fallback)
  const userKey = userId.toString();
  const redisRemaining = await getCooldownRemaining(userKey);
  const lastScanTime = scanCooldownMap.get(userKey);
  const nowMs = Date.now();
  const memoryRemaining = lastScanTime && (nowMs - lastScanTime) < COOLDOWN_MS
    ? Math.ceil((COOLDOWN_MS - (nowMs - lastScanTime)) / 1000)
    : 0;

  const remainingSeconds = Math.max(redisRemaining, memoryRemaining);
  if (remainingSeconds > 0) {
    throw new ServiceError(
      `Bạn vừa quét chấm công thành công cách đây chưa đầy 60 giây. Vui lòng chờ ${remainingSeconds}s để tránh trùng lặp.`,
      409,
      'RECENTLY_SCANNED',
      { retryAfterSeconds: remainingSeconds }
    );
  }

  // 4. Xác thực Geofence GPS & Mạng trường (Đối soát chéo chống Fake GPS)
  const geoCheck = validateGeofence(location, null, null, reqIp);

  // Nếu người dùng yêu cầu xử lý qua Hàng đợi (Giờ cao điểm Fast Ingestion < 50ms)
  if (useQueue) {
    const storedEvidencePath = await storeAttendanceEvidence(imageBuffer);
    scanCooldownMap.set(userKey, Date.now());
    await checkAndSetCooldown(userKey, 60).catch(() => {});

    const queueResponse = await addPunchJob({
      type: 'FACE_AI',
      userId,
      punchTime: new Date(),
      location,
      reqIp,
      deviceId,
      aiResult: {
        similarity: aiResult.similarity,
        liveness_score: aiResult.liveness_score,
      },
      evidenceRef: storedEvidencePath,
    });

    return {
      success: true,
      action: 'QUEUED',
      queued: queueResponse.queued,
      jobId: queueResponse.jobId,
      message: queueResponse.message,
      user: {
        _id: user._id,
        fullName: user.fullName,
        staffCode: user.staffCode,
        role: user.role,
        avatar: user.avatar,
      },
      similarity: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      isFraud: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      result: queueResponse.result,
    };
  }

  const nowVN = getVietnamTime();
  const { startOfDay, endOfDay } = getVietnamDayRange();
  const workDateStr = nowVN.toISOString().slice(0, 10);

  // 5. Tìm kiếm Lịch giảng dạy / Ca làm việc trong ngày của người dùng
  const todayWeekday = nowVN.getDay() === 0 ? 0 : nowVN.getDay(); // 0: CN, 1-6: T2-T7
  const activeSchedules = await Schedule.find({
    userId,
    weekday: todayWeekday,
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
    if (storedEvidencePath) openLog.capturedImage = storedEvidencePath;

    const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      openLog.shiftId,
      openLog.status
    );

    openLog.status = finalStatus;
    openLog.earlyExitMinutes = earlyMinutes || 0;
    openLog.isEarlyLeave = isEarlyLeave;
    openLog.isMissingCheckOut = false;
    await openLog.save();
    attendanceRecord = openLog;

    // Ghi PunchLog lượt ra
    await PunchLog.create({
      attendanceLogId: openLog._id,
      userId,
      punchType: 'CHECK_OUT',
      punchTime: checkOutTime,
      method: 'FACE_AI',
      confidenceScore: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      evidenceImage: storedEvidencePath,
      location: location || { lat: null, lng: null },
      deviceId,
      isFraudulent: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      clientIp: reqIp,
      isCampusNetwork: geoCheck.isCampusNetwork,
      isSuspicious: Boolean(geoCheck.isSuspicious),
      suspiciousReason: geoCheck.suspiciousReason,
      verificationMethod: geoCheck.verificationMethod,
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
      shiftId: selectedShift?._id || null,
      scheduleId: selectedScheduleId,
      workDate: workDateStr,
      checkInTime,
      method: 'FACE_AI',
      status: calculatedStatus,
      confidenceScore: aiResult.similarity,
      capturedImage: storedEvidencePath,
      location: location || { lat: null, lng: null },
      isFraudulent: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
    });

    // Ghi PunchLog lượt vào
    await PunchLog.create({
      attendanceLogId: attendanceRecord._id,
      userId,
      punchType: 'CHECK_IN',
      punchTime: checkInTime,
      method: 'FACE_AI',
      confidenceScore: aiResult.similarity,
      livenessScore: aiResult.liveness_score,
      evidenceImage: storedEvidencePath,
      location: location || { lat: null, lng: null },
      deviceId,
      isFraudulent: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      clientIp: reqIp,
      isCampusNetwork: geoCheck.isCampusNetwork,
      isSuspicious: Boolean(geoCheck.isSuspicious),
      suspiciousReason: geoCheck.suspiciousReason,
      verificationMethod: geoCheck.verificationMethod,
    });
  }

  // 8. Cập nhật mốc thời gian Cooldown 60s đồng bộ đa container qua Redis và Memory
  scanCooldownMap.set(userKey, Date.now());
  await checkAndSetCooldown(userKey, 60).catch(() => {});

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

  // Phát sự kiện Realtime Socket.IO tới Admin Dashboard & Trưởng khoa
  try {
    const { emitNewPunch } = require('../../config/socket');
    emitNewPunch({
      _id: attendanceRecord._id,
      userId,
      userName: user.fullName || 'Cán bộ',
      staffCode: user.staffCode,
      avatar: user.avatar,
      departmentId: user.departmentId,
      punchType: actionType,
      method: 'FACE_AI',
      scanTime: new Date(),
      status: attendanceRecord.status,
      confidenceScore: aiResult.similarity,
      isFraud: geoCheck.isFraud,
      fraudReason: geoCheck.fraudReason,
      evidenceUrl: storedEvidencePath,
    });
  } catch (_) {}

  return {
    success: true,
    action: actionType,
    message: `${actionType === 'CHECK_IN' ? 'Check-in (Điểm danh vào)' : 'Check-out (Ra về)'} thành công: ${user.fullName}`,
    user: {
      _id: user._id,
      fullName: user.fullName,
      staffCode: user.staffCode,
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
  resetCooldown,
};
