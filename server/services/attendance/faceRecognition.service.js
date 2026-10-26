/**
 * Service Điểm Danh Nhận Diện Khuôn Mặt (Face Recognition Attendance Service)
 * Mã nguồn sạch chuẩn CSDL v2.5: Động cơ 1:N RAM Index, Bộ lọc Margin Top 1-2 >= 0.05,
 * Cooldown 60s chống quét lặp, Geofence GPS Haversine và Lưu vết Audit/PunchLog.
 */
const mongoose = require('mongoose');
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const Schedule = require('../../models/schedule.model');
const ShiftConfig = require('../../models/shiftConfig.model');
const User = require('../../models/user.model');
const AuditLog = require('../../models/auditLog.model');
const { recognizeFace, ensureRamCacheWarm } = require('../faceServiceClient');
const { validateGeofence } = require('../../utils/attendanceHelpers');
const { storeAttendanceEvidence } = require('../../utils/attendanceEvidence');
const { evaluateUserScheduleForCheckIn } = require('./attendanceScheduleEligibility.service');
const {
  ServiceError,
  getVietnamTime,
  getVietnamDayRange,
  timeStringToMinutes,
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
  requestedAction = null,
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
    let errorCode = 'FACE_NOT_MATCHED';
    let message = primaryReason;

    if (primaryReason.includes('AMBIGUOUS_MATCH')) {
      errorCode = 'AMBIGUOUS_MATCH';
      message = 'Nhận diện mơ hồ: Độ chênh lệch giữa 2 ứng viên tương đồng nhất nhỏ hơn 0.05. Hệ thống từ chối để chống nhận diện nhầm.';
    } else if (primaryReason.includes('SPOOF_DETECTED')) {
      errorCode = 'LIVENESS_FAILED';
      message = 'Phát hiện dấu hiệu giả mạo sinh trắc học (ảnh in hoặc màn hình kỹ thuật số).';
    } else if (primaryReason.includes('MULTIPLE_FACES')) {
      errorCode = 'MULTIPLE_FACES';
      message = 'Phát hiện nhiều người trong khung hình. Vui lòng chấm công từng người.';
    }

    return {
      success: false,
      matched: false,
      message,
      errorCode,
      similarity: aiResult.similarity || 0,
    };
  }

  const rawUserId = aiResult.userId || aiResult.employee_id;
  let user = null;
  if (rawUserId) {
    if (mongoose.Types.ObjectId.isValid(rawUserId)) {
      user = await User.findById(rawUserId);
    }
    if (!user) {
      user = await User.findOne({
        $or: [
          { staffCode: rawUserId },
          { employeeCode: rawUserId },
          { ma_nhan_vien: rawUserId },
          { ma_can_bo: rawUserId },
          { email: rawUserId },
        ],
      });
    }
  }

  if (!user || user.isActive === false) {
    throw new ServiceError('Tài khoản người dùng không tồn tại hoặc đã bị khóa.', 403);
  }

  const userId = user._id;

  // Nếu là chế độ verifyOnly: Chỉ trả về thông tin nhận diện để hiển thị popup xác nhận
  if (verifyOnly) {
    let departmentName = '';
    if (user.departmentId) {
      try {
        const Department = require('../../models/department.model');
        const dept = await Department.findById(user.departmentId);
        if (dept) departmentName = dept.name || dept.ten_phong_ban || '';
      } catch (_) {}
    }

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
        staffCode: user.staffCode || user.employeeCode || user.ma_nhan_vien || '',
        department: departmentName || user.departmentName || '',
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
  })
    .populate('ca_id')
    .populate('shiftId')
    .populate('subjectId');

  // Tra cứu bản ghi chấm công trong ngày hôm nay của người dùng
  const todayLog = await AttendanceLog.findOne({
    userId,
    $or: [
      { workDate: workDateStr },
      { ngay_cong: workDateStr },
      { checkInTime: { $gte: startOfDay, $lte: endOfDay } },
    ],
  })
    .populate('ca_id')
    .populate('shiftId');

  // Bản ghi chấm công đang mở (đã Check-in nhưng chưa Check-out)
  let openLog = todayLog && todayLog.checkInTime && !todayLog.checkOutTime ? todayLog : null;

  // Quyết định hành động: CHECK_IN hay CHECK_OUT
  let actionType = 'CHECK_IN';

  if (requestedAction === 'CHECK_IN') {
    if (todayLog) {
      const inTimeStr = todayLog.checkInTime
        ? new Date(todayLog.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

      if (todayLog.checkOutTime) {
        const outTimeStr = new Date(todayLog.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        throw new ServiceError(
          `Cán bộ ${user.fullName} đã hoàn thành điểm danh cả vào ca (${inTimeStr}) và tan ca (${outTimeStr}) hôm nay rồi.`,
          409,
          'ATTENDANCE_COMPLETED_TODAY'
        );
      } else {
        throw new ServiceError(
          `Cán bộ ${user.fullName} đã điểm danh vào ca hôm nay lúc ${inTimeStr} rồi. Vui lòng chuyển sang 'Tan Ca' nếu muốn check-out.`,
          409,
          'ATTENDANCE_ALREADY_CHECKED_IN'
        );
      }
    }
    actionType = 'CHECK_IN';
  } else if (requestedAction === 'CHECK_OUT') {
    if (!openLog) {
      if (todayLog && todayLog.checkOutTime) {
        const outTimeStr = new Date(todayLog.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        throw new ServiceError(
          `Cán bộ ${user.fullName} đã thực hiện tan ca hôm nay lúc ${outTimeStr} rồi.`,
          409,
          'ATTENDANCE_ALREADY_CHECKED_OUT'
        );
      } else {
        throw new ServiceError(
          `Không tìm thấy lượt vào ca nào hôm nay của cán bộ ${user.fullName} để tan ca. Vui lòng điểm danh vào ca trước.`,
          404,
          'ATTENDANCE_NO_OPEN_RECORD'
        );
      }
    }
    actionType = 'CHECK_OUT';
  } else {
    // Chế độ Tự Động (Auto-detect): Nếu có lượt vào đang mở -> Thực hiện Tan Ca; nếu đã hoàn thành cả ngày -> Thông báo; nếu chưa -> Vào Ca
    if (openLog) {
      actionType = 'CHECK_OUT';
    } else if (todayLog && todayLog.checkOutTime) {
      const inTimeStr = todayLog.checkInTime
        ? new Date(todayLog.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      const outTimeStr = new Date(todayLog.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      throw new ServiceError(
        `Cán bộ ${user.fullName} đã hoàn thành điểm danh cả vào ca (${inTimeStr}) và tan ca (${outTimeStr}) hôm nay rồi.`,
        409,
        'ATTENDANCE_COMPLETED_TODAY'
      );
    } else {
      actionType = 'CHECK_IN';
    }
  }

  // Lưu ảnh minh chứng điểm danh an toàn
  const storedEvidencePath = await storeAttendanceEvidence(imageBuffer);

  let attendanceRecord = null;

  if (actionType === 'CHECK_OUT' && openLog) {
    // 6. Thực hiện CHECK-OUT
    const checkOutTime = new Date();
    openLog.checkOutTime = checkOutTime;
    if (storedEvidencePath) openLog.capturedImage = storedEvidencePath;

    let shiftConfig = openLog.shiftId || openLog.ca_id;
    if (
      shiftConfig &&
      (!shiftConfig.endTime || typeof shiftConfig === 'string' || shiftConfig instanceof mongoose.Types.ObjectId)
    ) {
      const shiftDoc = await ShiftConfig.findById(shiftConfig._id || shiftConfig);
      if (shiftDoc) shiftConfig = shiftDoc;
    }
    if (!shiftConfig || !shiftConfig.endTime) {
      shiftConfig = await ShiftConfig.findOne({ isActive: true });
    }

    // Tính thời lượng làm việc (phút và giờ công)
    if (openLog.checkInTime) {
      const diffMs = checkOutTime.getTime() - new Date(openLog.checkInTime).getTime();
      const durationMins = Math.max(0, Math.round(diffMs / 60000));
      openLog.workDurationMinutes = durationMins;
      openLog.workHours = Number((durationMins / 60).toFixed(2));
    }

    const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      shiftConfig,
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
    // 7. Thực hiện CHECK-IN: Bắt buộc kiểm tra Lịch phân công giảng dạy / ca làm việc hôm nay
    const scheduleEval = await evaluateUserScheduleForCheckIn(userId, null, user);
    if (!scheduleEval || !scheduleEval.canCheckIn) {
      const userPrefix = (user.role || '').toLowerCase() === 'giangvien' ? 'Giảng viên' : 'Cán bộ';
      throw new ServiceError(
        scheduleEval?.message || `${userPrefix} ${user.fullName} hôm nay không có lịch phân công giảng dạy hoặc ca làm việc nào trên hệ thống. Không thể chấm công.`,
        400,
        scheduleEval?.status || 'NO_SCHEDULE'
      );
    }

    const checkInTime = new Date();
    const selectedSchedule = scheduleEval.selectedSchedule;
    const selectedShift = scheduleEval.shift;
    const selectedScheduleId = selectedSchedule?._id || null;
    const calculatedStatus = scheduleEval.status || 'ON_TIME';
    const lateMinutes = scheduleEval.lateMinutes || 0;

    try {
      attendanceRecord = await AttendanceLog.create({
        userId,
        shiftId: selectedShift?._id || null,
        scheduleId: selectedScheduleId,
        workDate: workDateStr,
        checkInTime,
        lateMinutes,
        method: 'FACE_AI',
        status: calculatedStatus,
        confidenceScore: aiResult.similarity,
        capturedImage: storedEvidencePath,
        location: location || { lat: null, lng: null },
        isFraudulent: geoCheck.isFraud,
        fraudReason: geoCheck.fraudReason,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        throw new ServiceError(
          `Cán bộ ${user.fullName} đã có bản ghi điểm danh ca làm việc ngày hôm nay rồi.`,
          409,
          'ATTENDANCE_RECORD_EXISTS'
        );
      }
      throw createErr;
    }

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
