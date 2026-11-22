// Điểm danh bằng khuôn mặt Realtime (Face Service + FAISS), đối chiếu chính chủ tài khoản đăng nhập, chống quét lặp 60s, kiểm tra GPS và lưu log chấm công
const { Op } = require('sequelize');
const { NguoiDung, PhongBan } = require('../../models');
const { recognizeFace, ensureRamCacheWarm } = require('../khuonMat/ketNoiDichVuKhuonMat');
const { storeAttendanceEvidence, removeAttendanceEvidence } = require('../../utils/anhMinhChungChamCong');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { ServiceError } = require('../../utils/thoiGianChamCong.utils');
const { checkAndSetCooldown, getCooldownRemaining, resetCooldown } = require('../../config/redis');
const { addPunchJob } = require('../../queues/hangDoiChamCong');
const { preparePunchContext, executePunchPersistence } = require('./thucThiQuetChamCong.service');

// Bộ nhớ cục bộ chống quét lặp 60 giây (dùng song song với Redis)
const scanCooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000;

const mapAiMismatchResponse = (aiResult) => {
  const primaryReason = (aiResult.reasons && aiResult.reasons[0]) || 'Khuôn mặt không khớp với hồ sơ nhân sự nào.';
  let errorCode = 'FACE_NOT_MATCHED';
  let message = primaryReason;

  if (primaryReason.includes('AMBIGUOUS_MATCH')) {
    errorCode = 'AMBIGUOUS_MATCH';
    message =
      'Nhận diện mơ hồ: Độ chênh lệch giữa 2 ứng viên tương đồng nhất nhỏ hơn 0.05. Hệ thống từ chối để chống nhận diện nhầm.';
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
};

// Xử lý điểm danh khuôn mặt Realtime (hỗ trợ cả verifyOnly và đẩy hàng đợi BullMQ)
const processFaceAttendance = async ({
  imageBuffer,
  location = null,
  deviceId = 'MAY_CHAM_CONG_CAMERA',
  reqIp = '127.0.0.1',
  verifyOnly = false,
  useQueue = false,
  requestedAction = null,
  expectedUserId = null,
}) => {
  if (!imageBuffer) {
    throw new ServiceError('Vui lòng cung cấp hình ảnh khuôn mặt từ camera.', 400);
  }

  await ensureRamCacheWarm();
  const aiResult = await recognizeFace({ imageBuffer });
  if (!aiResult.matched) {
    return mapAiMismatchResponse(aiResult);
  }

  const rawUserId = aiResult.userId || aiResult.employee_id;
  const userInclude = [{ model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban'] }];
  let user = null;
  if (rawUserId && isValidUuid(String(rawUserId))) {
    user = await NguoiDung.findByPk(String(rawUserId), { include: userInclude });
  }
  if (!user && rawUserId) {
    user = await NguoiDung.findOne({
      where: { [Op.or]: [{ ma_can_bo: String(rawUserId) }, { email: String(rawUserId) }] },
      include: userInclude,
    });
  }

  if (!user || user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
    throw new ServiceError('Tài khoản người dùng không tồn tại, đã bị khóa hoặc đã nghỉ việc.', 403);
  }

  const userId = user.id;
  const publicUserSummary = {
    id: userId,
    ho_ten: user.ho_ten,
    ma_can_bo: user.ma_can_bo,
    vai_tro_chinh: user.vai_tro_chinh,
    anh_dai_dien: user.anh_dai_dien,
  };

  if (expectedUserId && String(userId) !== String(expectedUserId)) {
    return {
      success: false,
      matched: false,
      message: 'Khuôn mặt không khớp với tài khoản đang đăng nhập. Chỉ chính chủ mới được chấm công.',
      errorCode: 'FACE_USER_MISMATCH',
      similarity: aiResult.similarity || 0,
    };
  }

  if (verifyOnly) {
    return {
      success: true,
      khop_khuon_mat: true,
      nguoi_dung_id: userId,
      user: {
        ...publicUserSummary,
        email: user.email,
        ma_can_bo: user.ma_can_bo || '',
        don_vi_chinh: user.don_vi_chinh
          ? { id: user.don_vi_chinh.id, ten_phong_ban: user.don_vi_chinh.ten_phong_ban }
          : null,
      },
      diem_tin_cay: aiResult.similarity,
      diem_nguoi_that: aiResult.liveness_score,
      message: `Đã nhận diện: ${user.ho_ten}`,
    };
  }

  const userKey = String(userId);
  return withDistributedLock(`attendance_punch:${userKey}`, 15, async () => {
    const redisRemaining = await getCooldownRemaining(userKey);
    const lastScanTime = scanCooldownMap.get(userKey);
    const memoryRemaining =
      lastScanTime && Date.now() - lastScanTime < COOLDOWN_MS
        ? Math.ceil((COOLDOWN_MS - (Date.now() - lastScanTime)) / 1000)
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

    const now = new Date();
    const context = await preparePunchContext({
      userId,
      user,
      requestedAction,
      punchTime: now,
      location,
      reqIp,
    });

    const rollbackCooldownAndEvidence = async (evidencePath) => {
      scanCooldownMap.delete(userKey);
      await resetCooldown(userKey).catch(() => {});
      await removeAttendanceEvidence(evidencePath).catch(() => {});
    };

    scanCooldownMap.set(userKey, Date.now());
    const storedEvidencePath = await storeAttendanceEvidence(imageBuffer);

    if (useQueue) {
      await checkAndSetCooldown(userKey, 60).catch(() => {});
      const queueResponse = await addPunchJob({
        type: 'face_ai',
        userId,
        requestedAction: context.actionType,
        punchTime: now,
        location,
        reqIp,
        deviceId,
        aiResult: {
          similarity: aiResult.similarity,
          liveness_score: aiResult.liveness_score,
          pose: aiResult.pose || aiResult.angle || null,
        },
        evidenceRef: storedEvidencePath,
      });

      if (queueResponse.success === false || queueResponse.status === 'FAILED_SYNC') {
        await rollbackCooldownAndEvidence(storedEvidencePath);
        throw new ServiceError(
          queueResponse.message || 'Xử lý điểm danh qua hàng đợi thất bại.',
          400,
          'ATTENDANCE_QUEUE_FAILED'
        );
      }

      return {
        success: true,
        action: queueResponse.queued ? context.actionType : queueResponse.result?.action || context.actionType,
        hanh_dong: queueResponse.queued ? 'QUEUED' : queueResponse.result?.action || context.actionType,
        da_vao_hang_doi: queueResponse.queued,
        ma_cong_viec: queueResponse.jobId,
        message: queueResponse.message,
        user: publicUserSummary,
        diem_tin_cay: aiResult.similarity,
        diem_nguoi_that: aiResult.liveness_score,
        co_gian_lan: context.geoCheck.isFraud,
        ly_do_gian_lan: context.geoCheck.fraudReason,
        ket_qua: queueResponse.result,
      };
    }

    let persisted;
    try {
      persisted = await executePunchPersistence({
        userId,
        user,
        context,
        method: 'face_ai',
        aiResult,
        evidenceRef: storedEvidencePath,
        location,
        deviceId,
        reqIp,
        auditActionPrefix: 'ATTENDANCE_FACE',
        auditExtra: { diem_mat_that: aiResult.liveness_score },
      });
    } catch (err) {
      await rollbackCooldownAndEvidence(storedEvidencePath);
      throw err;
    }

    scanCooldownMap.set(userKey, Date.now());
    await checkAndSetCooldown(userKey, 60).catch(() => {});

    return {
      success: true,
      action: persisted.actionType,
      message: `${persisted.actionType === 'check_in' ? 'Check-in (Điểm danh vào)' : 'Check-out (Ra về)'} thành công: ${user.ho_ten}`,
      user: publicUserSummary,
      co_gian_lan: persisted.geoCheck.isFraud,
      ly_do_gian_lan: persisted.geoCheck.fraudReason,
      diem_tin_cay: aiResult.similarity,
      diem_nguoi_that: aiResult.liveness_score,
      record: persisted.attendanceRecord,
    };
  });
};

module.exports = {
  processFaceAttendance,
  scanCooldownMap,
  resetCooldown,
};
