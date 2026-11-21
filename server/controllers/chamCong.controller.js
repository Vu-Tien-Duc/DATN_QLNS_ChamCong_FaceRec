// Điều phối điểm danh đa phương thức (Khuôn mặt, QR động, GPS), hàng đợi BullMQ và lịch sử chấm công
const crypto = require('crypto');
const {
  processFaceAttendance,
  performCheckIn,
  performCheckOut,
  getAttendanceHistory: fetchAttendanceHistory,
  getAttendanceById: fetchAttendanceById,
  getAttendanceEvidence: fetchAttendanceEvidence,
  updateAttendanceByAdmin: modifyAttendanceByAdmin,
  processScanQRCode,
  generateDynamicQRCode,
  getCampusConfig,
} = require('../services/chamCong');
const { getFaissStats, ensureRamCacheWarm } = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const { runDailyAbsentCheck } = require('../services/heThong/tacVuDinhKy.service');
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');
const { ServiceError } = require('../utils/thoiGianChamCong.utils');
const { isUserInDeanScope } = require('../utils/phamViTruongKhoa');
const { hasAnyActiveRole } = require('../utils/vaiTro.utils');
const { redisGet, redisSet } = require('../config/redis');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

// Xác định người dùng mục tiêu và kiểm tra phạm vi lãnh đạo đơn vị khi xem/chấm công hộ
const resolveAttendanceTarget = async (req, requestedUserId) => {
  const isTopAdmin = hasAnyActiveRole(req.user, ['admin', 'bgh']);
  const isAdminOrLeader = isTopAdmin || hasAnyActiveRole(req.user, ['truong_khoa']);
  const selfUserId = req.user.id;
  const targetUserId = (isAdminOrLeader && requestedUserId) ? requestedUserId : selfUserId;

  if (requestedUserId && isAdminOrLeader && String(targetUserId) !== String(selfUserId) && !isTopAdmin) {
    const inScope = await isUserInDeanScope(req.user, targetUserId);
    if (!inScope) {
      throw new ServiceError('Bạn chỉ có quyền chấm công hộ cho nhân sự trong phạm vi đơn vị quản lý.', 403);
    }
  }

  return { targetUserId, isAdminOrLeader };
};

// Chuẩn hóa tọa độ GPS từ req.body (hỗ trợ vi_do/kinh_do rời hoặc toa_do dạng object / chuỗi JSON)
const parseCoordinatesFromBody = (body = {}) => {
  let toaDoObj = body?.toa_do ?? null;
  if (typeof toaDoObj === 'string') {
    const trimmed = toaDoObj.trim();
    if (trimmed) {
      try {
        toaDoObj = JSON.parse(trimmed);
      } catch {
        toaDoObj = null;
      }
    } else {
      toaDoObj = null;
    }
  }
  const hasToaDoObj = toaDoObj && typeof toaDoObj === 'object' && !Array.isArray(toaDoObj);
  const rawLat = body?.vi_do !== undefined && body?.vi_do !== '' ? body.vi_do : (hasToaDoObj ? toaDoObj.vi_do : undefined);
  const rawLng = body?.kinh_do !== undefined && body?.kinh_do !== '' ? body.kinh_do : (hasToaDoObj ? toaDoObj.kinh_do : undefined);
  const rawAcc = body?.do_chinh_xac !== undefined && body?.do_chinh_xac !== ''
    ? body.do_chinh_xac
    : (hasToaDoObj ? toaDoObj.do_chinh_xac : undefined);

  const lat = rawLat !== undefined && rawLat !== null ? Number(rawLat) : undefined;
  const lng = rawLng !== undefined && rawLng !== null ? Number(rawLng) : undefined;
  const accuracy = rawAcc !== undefined && rawAcc !== null ? Number(rawAcc) : undefined;

  return {
    vi_do: Number.isFinite(lat) ? lat : null,
    kinh_do: Number.isFinite(lng) ? lng : null,
    do_chinh_xac: Number.isFinite(accuracy) ? accuracy : null,
    location: Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, ...(Number.isFinite(accuracy) ? { accuracy } : {}) }
      : null,
  };
};

// POST /api/cham-cong/khuon-mat - Điểm danh khuôn mặt trên tài khoản đang đăng nhập (khuôn mặt phải khớp chính chủ)
const faceRecognizeAttendance = async (req, res, next) => {
  try {
    const callerId = req.user?.id;
    if (!callerId) {
      return sendError(res, 'Vui lòng đăng nhập để chấm công bằng khuôn mặt.', null, 401);
    }
    if (NON_ATTENDANCE_ROLES.includes(getReqUserRole(req))) {
      return sendError(
        res,
        'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện chấm công cá nhân.',
        null,
        403,
        'ATTENDANCE_ROLE_FORBIDDEN'
      );
    }

    let imageBuffer = null;

    if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
    } else if (req.body?.image) {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    const { location } = parseCoordinatesFromBody(req.body);

    const deviceId = req.body?.thiet_bi_id || 'MAY_CHAM_CONG_CAMERA';
    const reqIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const useQueue = req.query?.bat_dong_bo === 'true' || req.body?.dung_hang_doi === true;
    const verifyOnly = req.body?.xac_thuc_chi_xem === true || req.body?.xac_thuc_chi_xem === 'true';
    const requestedAction =
      req.body?.loai_thao_tac ||
      (req.originalUrl?.includes('tan-ca') || req.path?.includes('tan-ca')
        ? 'check_out'
        : req.originalUrl?.includes('vao-ca') || req.path?.includes('vao-ca')
        ? 'check_in'
        : null);

    const livenessTicket = String(req.body?.livenessTicket || req.body?.ve_mat_that || '').trim();
    if (livenessTicket) {
      if (!livenessTicket.includes('.')) {
        return sendError(res, 'Vé xác thực Liveness không hợp lệ.', null, 400, 'INVALID_LIVENESS_TICKET');
      }
      const [ticketB64, ticketSig] = livenessTicket.split('.');
      const expectedTicketSig = crypto.createHmac('sha256', getLivenessSecret()).update(ticketB64).digest('hex');
      const sigBuf = Buffer.from(ticketSig || '');
      const expBuf = Buffer.from(expectedTicketSig);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return sendError(res, 'Chữ ký vé Liveness không hợp lệ.', null, 400, 'INVALID_LIVENESS_TICKET');
      }
      let ticketData;
      try {
        ticketData = JSON.parse(Buffer.from(ticketB64, 'base64url').toString('utf8'));
      } catch {
        return sendError(res, 'Nội dung vé Liveness không hợp lệ.', null, 400, 'INVALID_LIVENESS_TICKET');
      }
      if (!ticketData?.exp || Date.now() > Number(ticketData.exp)) {
        return sendError(res, 'Vé xác thực Liveness đã hết hạn.', null, 400, 'LIVENESS_TICKET_EXPIRED');
      }
      if (String(ticketData.userId || '') !== String(callerId)) {
        return sendError(res, 'Vé Liveness không khớp với tài khoản đang đăng nhập.', null, 403, 'LIVENESS_USER_MISMATCH');
      }
      const ticketRedisKey = `liveness_ticket:${ticketData.nonce}`;
      const storedTicketOwner = await redisGet(ticketRedisKey);
      if (storedTicketOwner && String(storedTicketOwner) !== String(callerId)) {
        return sendError(res, 'Vé Liveness đã bị sử dụng hoặc không hợp lệ.', null, 409, 'LIVENESS_TICKET_REPLAY');
      }
      if (storedTicketOwner === 'USED') {
        return sendError(res, 'Vé Liveness đã được sử dụng.', null, 409, 'LIVENESS_TICKET_REPLAY');
      }
      await redisSet(ticketRedisKey, 'USED', 150).catch(() => {});
    }

    const result = await processFaceAttendance({
      imageBuffer,
      location,
      deviceId,
      reqIp,
      verifyOnly,
      useQueue,
      requestedAction,
      expectedUserId: String(callerId),
    });

    if (result.matched === false || result.success === false) {
      return res.status(200).json({
        success: false,
        message: result.message || 'Không khớp khuôn mặt.',
        data: result,
        errorCode: result.errorCode || 'FACE_NOT_MATCHED',
      });
    }

    return sendSuccess(res, result.message, result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/hang-doi/thong-ke - Thống kê hàng đợi chấm công BullMQ
const getQueueStats = async (req, res, next) => {
  try {
    const { getPunchQueueStats } = require('../queues/hangDoiChamCong');
    const stats = await getPunchQueueStats();
    return sendSuccess(res, 'Thống kê hàng đợi điểm danh BullMQ giờ cao điểm.', stats, 200);
  } catch (error) {
    next(error);
  }
};


const NON_ATTENDANCE_ROLES = ['admin'];
const KIOSK_QR_ROLES = [
  'admin',
  'bgh',
  'tccb',
  'dao_tao',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
];

const getReqUserRole = (req) =>
  String(req.user?.vai_tro_chinh || '').trim().toLowerCase();

// POST /api/cham-cong/vao-ca - Check-in theo ca hoặc lịch làm việc
const checkIn = async (req, res, next) => {
  try {
    const {
      ca_id: resolvedCaId,
      lich_trinh_id: resolvedLichTrinhId,
      thiet_bi_id: resolvedThietBiId = 'MOBILE_APP',
      phuong_thuc,
      nguoi_dung_id,
    } = req.body || {};

    const { targetUserId, isAdminOrLeader } = await resolveAttendanceTarget(req, nguoi_dung_id);

    const callerRole = getReqUserRole(req);
    const isSelfCheckIn = String(targetUserId) === String(req.user?.id || '');
    if (isSelfCheckIn && NON_ATTENDANCE_ROLES.includes(callerRole)) {
      return sendError(
        res,
        'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện chấm công cá nhân.',
        null,
        403,
        'ATTENDANCE_ROLE_FORBIDDEN'
      );
    }

    const { vi_do: resolvedViDo, kinh_do: resolvedKinhDo, do_chinh_xac: resolvedDoChinhXac } = parseCoordinatesFromBody(req.body);
    const rawMethod = String(phuong_thuc || '').trim().toLowerCase();
    const isManualAdmin = isAdminOrLeader && rawMethod === 'thu_cong_admin';
    const resolvedPhuongThuc = isManualAdmin ? 'thu_cong_admin' : 'gps_mobile';

    const result = await performCheckIn({
      nguoi_dung_id: targetUserId,
      ca_id: resolvedCaId,
      lich_trinh_id: resolvedLichTrinhId,
      thiet_bi_id: resolvedThietBiId,
      vi_do: resolvedViDo,
      kinh_do: resolvedKinhDo,
      do_chinh_xac: resolvedDoChinhXac,
      phuong_thuc: resolvedPhuongThuc,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
      allowManual: isManualAdmin,
    });
    return sendSuccess(res, result.message, result, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/cham-cong/tan-ca - Check-out ra về
const checkOut = async (req, res, next) => {
  try {
    const {
      ca_id: resolvedCaId,
      cham_cong_id: resolvedChamCongId,
      thiet_bi_id: resolvedThietBiId = 'MOBILE_APP',
      phuong_thuc,
      nguoi_dung_id,
    } = req.body || {};

    const { targetUserId, isAdminOrLeader } = await resolveAttendanceTarget(req, nguoi_dung_id);

    const callerRole = getReqUserRole(req);
    const isSelfCheckOut = String(targetUserId) === String(req.user?.id || '');
    if (isSelfCheckOut && NON_ATTENDANCE_ROLES.includes(callerRole)) {
      return sendError(
        res,
        'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện chấm công cá nhân.',
        null,
        403,
        'ATTENDANCE_ROLE_FORBIDDEN'
      );
    }

    const { vi_do: resolvedViDo, kinh_do: resolvedKinhDo, do_chinh_xac: resolvedDoChinhXac } = parseCoordinatesFromBody(req.body);
    const rawMethod = String(phuong_thuc || '').trim().toLowerCase();
    const isManualAdmin = isAdminOrLeader && rawMethod === 'thu_cong_admin';
    const resolvedPhuongThuc = isManualAdmin ? 'thu_cong_admin' : 'gps_mobile';

    const result = await performCheckOut({
      nguoi_dung_id: targetUserId,
      ca_id: resolvedCaId,
      cham_cong_id: resolvedChamCongId,
      thiet_bi_id: resolvedThietBiId,
      vi_do: resolvedViDo,
      kinh_do: resolvedKinhDo,
      do_chinh_xac: resolvedDoChinhXac,
      phuong_thuc: resolvedPhuongThuc,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
      allowManual: isManualAdmin,
    });
    return sendSuccess(res, result.message, result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/lich-su - Lịch sử chấm công toàn hệ thống/đơn vị (có phân trang & bộ lọc)
const getAttendanceHistory = async (req, res, next) => {
  try {
    const nguoi_dung_id = req.query?.nguoi_dung_id;
    const don_vi_id = req.query?.don_vi_id;
    const trang_thai = req.query?.trang_thai;
    const tu_ngay = req.query?.tu_ngay;
    const den_ngay = req.query?.den_ngay;
    const phuong_thuc = req.query?.phuong_thuc;
    const co_gian_lan = req.query?.co_gian_lan;
    const page = req.query?.trang || 1;
    const limit = req.query?.gioi_han || 20;

    const result = await fetchAttendanceHistory({
      vai_tro: req.user?.vai_tro_chinh,
      nguoi_dung_id,
      currentUserId: req.user?.id,
      don_vi_chinh_id: don_vi_id,
      trang_thai,
      phuong_thuc,
      co_gian_lan,
      tu_ngay,
      den_ngay,
      page,
      limit,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy lịch sử chấm công thành công.', result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/lich-su-cua-toi - Lịch sử chấm công của chính người dùng đang đăng nhập
const getMyAttendanceHistory = async (req, res, next) => {
  try {
    const trang_thai = req.query?.trang_thai;
    const tu_ngay = req.query?.tu_ngay;
    const den_ngay = req.query?.den_ngay;
    const phuong_thuc = req.query?.phuong_thuc;
    const co_gian_lan = req.query?.co_gian_lan;
    const page = req.query?.trang || 1;
    const limit = req.query?.gioi_han || 20;

    const currentId = req.user?.id;
    const result = await fetchAttendanceHistory({
      vai_tro: 'giang_vien', // Ép buộc xem cá nhân
      nguoi_dung_id: currentId,
      currentUserId: currentId,
      trang_thai,
      phuong_thuc,
      co_gian_lan,
      tu_ngay,
      den_ngay,
      page,
      limit,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy lịch sử chấm công cá nhân thành công.', result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/:id - Chi tiết bản ghi chấm công
const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await fetchAttendanceById({ id, currentUser: req.user });
    return sendSuccess(res, 'Lấy chi tiết chấm công thành công.', log, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/:id/minh-chung - Ảnh minh chứng điểm danh bảo mật
const getAttendanceEvidence = async (req, res, next) => {
  try {
    const evidence = await fetchAttendanceEvidence({ id: req.params.id, currentUser: req.user });
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': evidence.contentType,
    });
    return res.status(200).send(evidence.buffer);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/cham-cong/:id/dieu-chinh - Điều chỉnh bản ghi chấm công (Admin/BGH/Lãnh đạo khoa)
const updateAttendanceByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      trang_thai,
      thoi_gian_vao,
      thoi_gian_ra,
      don_tu_id,
      co_gian_lan,
      ly_do_ghi_de,
    } = req.body || {};

    const updated = await modifyAttendanceByAdmin({
      id,
      nguoi_thuc_hien_id: req.user.id,
      currentUser: req.user,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
      trang_thai,
      thoi_gian_vao,
      thoi_gian_ra,
      don_tu_id,
      co_gian_lan,
      ly_do_ghi_de,
    });
    return sendSuccess(res, 'Cập nhật bản ghi chấm công thành công.', updated, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/cham-cong/qr/quet-ma - Chấm công bằng mã QR động TOTP
const scanQRCode = async (req, res, next) => {
  try {
    const callerRole = getReqUserRole(req);
    if (NON_ATTENDANCE_ROLES.includes(callerRole)) {
      return sendError(
        res,
        'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện quét mã QR chấm công cá nhân.',
        null,
        403,
        'ATTENDANCE_ROLE_FORBIDDEN'
      );
    }

    const {
      ma_qr: resolvedToken,
      thiet_bi_id: resolvedThietBiId = 'MOBILE_APP_QR',
    } = req.body || {};

    const { vi_do: resolvedViDo, kinh_do: resolvedKinhDo, do_chinh_xac: resolvedDoChinhXac } = parseCoordinatesFromBody(req.body);

    const result = await processScanQRCode({
      nguoi_dung_id: req.user.id,
      qrToken: resolvedToken,
      vi_do: resolvedViDo,
      kinh_do: resolvedKinhDo,
      do_chinh_xac: resolvedDoChinhXac,
      thiet_bi_id: resolvedThietBiId,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, result.message, result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/qr/tao-ma - Sinh mã QR động cho ca làm việc hoặc phòng học
const getDynamicQRCode = async (req, res, next) => {
  try {
    // Nếu gọi bằng JWT người dùng (không phải máy Kiosk dùng x-terminal-key) thì chỉ cấp Quản trị / Lãnh đạo được phát mã QR
    if (req.user) {
      const callerRole = getReqUserRole(req);
      if (!KIOSK_QR_ROLES.includes(callerRole)) {
        return sendError(
          res,
          'Bạn không có quyền phát mã QR điểm danh động.',
          null,
          403,
          'QR_GENERATE_FORBIDDEN'
        );
      }
    }

    const {
      ca_id: shiftId,
      lich_trinh_id: scheduleId,
      phong_hoc: roomId,
    } = req.query;
    const qrResult = await generateDynamicQRCode({ shiftId, scheduleId, roomId, user: req.user });
    return sendSuccess(res, 'Sinh mã QR động thành công.', qrResult, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/cau-hinh-khuon-vien - Cấu hình Geofence khuôn viên trường
const getCampusConfigInfo = async (req, res, next) => {
  try {
    await systemConfigService.loadConfigsIntoCache().catch(() => {});
    const config = getCampusConfig();
    return sendSuccess(res, 'Lấy cấu hình Geofence thành công.', config, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/chi-so-vector/thong-ke - Trạng thái RAM Vector Index & Self-Healing
const getRamIndexStats = async (req, res, next) => {
  try {
    await ensureRamCacheWarm();
    const stats = await getFaissStats();
    return sendSuccess(res, 'Lấy thông tin RAM Vector Index thành công.', stats, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// Đồng bộ lại toàn bộ vector khuôn mặt vào RAM FAISS của Face Service
const syncFaissIndexController = async (req, res, next) => {
  try {
    const syncResult = await ensureRamCacheWarm(true);
    const stats = await getFaissStats();
    return sendSuccess(res, 'Đồng bộ lại RAM Vector Index từ SQL Server thành công.', { syncResult, stats }, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// Cập nhật tọa độ và bán kính hàng rào địa lý khuôn viên trường (lưu chuẩn GEOFENCE_TRUONG)
const updateCampusLocationConfig = async (req, res, next) => {
  try {
    const { updateCampusConfig } = require('../utils/hoTroChamCong');
    const updatedCampus = updateCampusConfig(req.body || {});
    const geofencePayload = {
      ten_co_so: updatedCampus.name,
      toa_do: [updatedCampus.lng, updatedCampus.lat],
      ban_kinh_met: updatedCampus.radiusMeters,
    };
    await systemConfigService.updateConfig(
      'GEOFENCE_TRUONG',
      geofencePayload,
      req.user || null,
      req
    );
    const canonicalResponse = {
      ten_co_so: geofencePayload.ten_co_so,
      vi_do: updatedCampus.lat,
      kinh_do: updatedCampus.lng,
      ban_kinh_met: updatedCampus.radiusMeters,
    };
    return sendSuccess(res, 'Cập nhật cấu hình khuôn viên thành công.', canonicalResponse, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

const LIVENESS_CHALLENGES = ['LOOK_UP', 'LOOK_DOWN', 'TURN_LEFT', 'TURN_RIGHT'];
const FALLBACK_LIVENESS_SECRET = crypto.randomBytes(32).toString('hex');
// Lấy khóa bí mật dùng ký token thử thách liveness
const getLivenessSecret = () => process.env.JWT_SECRET || process.env.QR_SECRET || FALLBACK_LIVENESS_SECRET;

const POSE_SYNONYMS = {
  LOOK_UP: ['LOOK_UP', 'UP', 'NGUA', 'NGUOC'],
  LOOK_DOWN: ['LOOK_DOWN', 'DOWN', 'CUI'],
  TURN_LEFT: ['TURN_LEFT', 'LEFT', 'TRAI', 'QUAY_TRAI'],
  TURN_RIGHT: ['TURN_RIGHT', 'RIGHT', 'PHAI', 'QUAY_PHAI'],
  STRAIGHT: ['STRAIGHT', 'FRONT', 'CENTER', 'CHINH_DIEN'],
};

// Kiểm tra tư thế khuôn mặt từ AI có khớp với yêu cầu thử thách liveness
const normalizePoseMatchesChallenge = (challenge, poseRes) => {
  if (!challenge) return Boolean(poseRes?.face_detected ?? true);
  const rawPoseObj = poseRes?.pose || poseRes?.data?.pose;
  const candidates = [
    poseRes?.detectedPose,
    typeof rawPoseObj === 'string' ? rawPoseObj : rawPoseObj?.pose_en,
    typeof rawPoseObj === 'object' ? rawPoseObj?.pose : null,
    typeof rawPoseObj === 'object' ? rawPoseObj?.pose_vi : null,
  ]
    .filter(Boolean)
    .map((val) => String(val).trim().toUpperCase());

  const acceptedTokens = POSE_SYNONYMS[challenge] || [challenge];
  return candidates.some((cand) => acceptedTokens.some((tok) => cand === tok || cand.includes(tok)));
};

// Tạo thử thách quay/ngẩng/cúi mặt ngẫu nhiên kèm chữ ký HMAC gắn userId (hạn 120s)
const getLivenessChallengeController = (req, res) => {
  const challenge = LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
  const nonce = crypto.randomBytes(12).toString('hex');
  const exp = Date.now() + 120 * 1000;
  const userId = req.user?.id ? String(req.user.id) : '';
  const payloadBase64 = Buffer.from(JSON.stringify({ challenge, nonce, exp, userId })).toString('base64url');
  const sig = crypto.createHmac('sha256', getLivenessSecret()).update(payloadBase64).digest('hex');
  const challengeToken = `${payloadBase64}.${sig}`;
  return sendSuccess(res, 'Liveness challenge', { challenge, challengeToken, expiresInSeconds: 120 });
};

// Xác thực ảnh người dùng thực hiện đúng thử thách liveness và cấp vé tạm thời gắn userId
const verifyLivenessChallengeController = async (req, res, next) => {
  try {
    const challengeToken = String(req.body?.challengeToken || '').trim();
    if (!challengeToken || !challengeToken.includes('.')) {
      return sendError(res, 'Thiếu hoặc sai định dạng challengeToken xác thực Liveness.', null, 400);
    }

    const [payloadBase64, sig] = challengeToken.split('.');
    const expectedSig = crypto.createHmac('sha256', getLivenessSecret()).update(payloadBase64).digest('hex');
    const sigBuf = Buffer.from(sig || '');
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return sendError(res, 'Chữ ký challengeToken không hợp lệ.', null, 400);
    }

    let tokenPayload;
    try {
      tokenPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    } catch {
      return sendError(res, 'Nội dung challengeToken không hợp lệ.', null, 400);
    }

    if (tokenPayload?.userId && String(tokenPayload.userId) !== String(req.user?.id || '')) {
      return sendError(res, 'Thử thách Liveness không thuộc về tài khoản hiện tại.', null, 403, 'LIVENESS_USER_MISMATCH');
    }

    if (!tokenPayload?.exp || Date.now() > Number(tokenPayload.exp)) {
      return sendError(res, 'Thử thách Liveness đã hết hạn. Vui lòng lấy thử thách mới.', null, 400);
    }

    const nonceKey = `liveness_nonce:${tokenPayload.nonce}`;
    if (await redisGet(nonceKey)) {
      return sendError(res, 'Thử thách Liveness đã được sử dụng. Vui lòng lấy thử thách mới.', null, 409);
    }
    await redisSet(nonceKey, '1', 150);

    const expectedChallenge = String(tokenPayload.challenge || '').toUpperCase();
    let imageBuffer = req.file?.buffer || null;
    if (!imageBuffer && req.body?.image) {
      const base64Data = String(req.body.image).replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    if (!imageBuffer) {
      return sendError(res, 'Vui lòng cung cấp ảnh để xác thực Liveness.', null, 400);
    }

    const { detectFacePose: callPose } = require('../services/khuonMat/ketNoiDichVuKhuonMat');
    const poseRes = await callPose({ imageBuffer });
    const detectedPose =
      typeof poseRes?.pose === 'object'
        ? poseRes.pose.pose_en || poseRes.pose.pose || ''
        : poseRes?.detectedPose || poseRes?.pose || poseRes?.data?.pose || '';

    const faceDetected = poseRes?.status ? poseRes.status === 'face_detected' : Boolean(poseRes?.face_detected ?? true);
    const passed = faceDetected && normalizePoseMatchesChallenge(expectedChallenge, poseRes);

    let livenessTicket = null;
    if (passed && req.user?.id) {
      const ticketNonce = crypto.randomBytes(12).toString('hex');
      const ticketPayloadB64 = Buffer.from(
        JSON.stringify({ nonce: ticketNonce, userId: String(req.user.id), exp: Date.now() + 120 * 1000 })
      ).toString('base64url');
      const ticketSig = crypto.createHmac('sha256', getLivenessSecret()).update(ticketPayloadB64).digest('hex');
      livenessTicket = `${ticketPayloadB64}.${ticketSig}`;
      await redisSet(`liveness_ticket:${ticketNonce}`, String(req.user.id), 150).catch(() => {});
    }

    return sendSuccess(
      res,
      passed ? 'Xác thực Liveness thành công.' : 'Tư thế khuôn mặt chưa khớp thử thách.',
      {
        passed,
        detectedPose: String(detectedPose || '').toUpperCase(),
        expectedChallenge,
        ...(livenessTicket ? { livenessTicket } : {}),
      }
    );
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// Kích hoạt thủ công tiến trình quét vắng mặt theo ngày
const triggerDailyAbsentCheck = async (req, res, next) => {
  try {
    const rawDate = req.body?.ngay ?? req.query?.ngay;
    let targetDate = new Date();
    if (rawDate !== undefined && rawDate !== null && rawDate !== '') {
      targetDate = new Date(rawDate);
      if (Number.isNaN(targetDate.getTime())) {
        return sendError(res, 'Ngày kiểm tra vắng mặt không hợp lệ.', null, 400);
      }
    }
    const result = await runDailyAbsentCheck(targetDate);
    return sendSuccess(res, 'Kích hoạt kiểm tra vắng mặt thành công.', result, 200);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/cham-cong/khoi-hom-nay – Danh sách khối ca hôm nay của người dùng (dùng trên màn hình quét mặt)
const getKhoiHomNay = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    const { evaluateUserScheduleForCheckIn } = require('../services/chamCong/dieuKienLichChamCong.service');
    const evalResult = await evaluateUserScheduleForCheckIn(userId, null, req.user, new Date(), { readOnly: true });
    return sendSuccess(res, 'Lấy danh sách khối ca hôm nay thành công.', {
      co_the_check_in: evalResult.canCheckIn,
      trang_thai: evalResult.status,
      thong_bao: evalResult.message,
      khoi: evalResult.khoi || null,
      lich_trinh_chon: evalResult.selectedSchedule || null,
      ca: evalResult.shift ? {
        id: evalResult.shift.id,
        ten_ca: evalResult.shift.ten_ca,
        gio_bat_dau: evalResult.shift.gio_bat_dau,
        gio_ket_thuc: evalResult.shift.gio_ket_thuc,
      } : null,
      lich_trinh_sap_toi: evalResult.upcomingSchedule || null,
      ds_lich_bi_huy: evalResult.cancelledSchedules || [],
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  faceRecognizeAttendance,
  checkIn,
  checkOut,
  getAttendanceHistory,
  getMyAttendanceHistory,
  getAttendanceById,
  getAttendanceEvidence,
  updateAttendanceByAdmin,
  scanQRCode,
  getDynamicQRCode,
  getCampusConfigInfo,
  updateCampusLocationConfig,
  getLivenessChallengeController,
  verifyLivenessChallengeController,
  syncFaissIndexController,
  triggerDailyAbsentCheck,
  getRamIndexStats,
  getQueueStats,
  getKhoiHomNay,
};

