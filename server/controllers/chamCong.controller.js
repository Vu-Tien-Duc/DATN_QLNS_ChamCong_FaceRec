// Điều phối điểm danh đa phương thức (Khuôn mặt, QR động, GPS), hàng đợi BullMQ và lịch sử chấm công
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
const {
  issueLivenessChallenge,
  verifyLivenessChallenge,
  consumeLivenessTicket,
} = require('../services/khuonMat/thuThachLiveness.service');
const { getFaissStats, ensureRamCacheWarm } = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const { runDailyAbsentCheck } = require('../services/heThong/tacVuDinhKy.service');
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');
const { ServiceError } = require('../utils/thoiGianChamCong.utils');
const { isUserInDeanScope } = require('../utils/phamViTruongKhoa');
const { hasAnyActiveRole, UNIT_LEADER_ROLES } = require('../utils/vaiTro.utils');

const NON_ATTENDANCE_ROLES = ['admin'];
const KIOSK_QR_ROLES = ['admin'];

// Xác định người dùng mục tiêu và kiểm tra phạm vi lãnh đạo đơn vị khi xem/chấm công hộ
const resolveAttendanceTarget = async (req, requestedUserId) => {
  const isTopAdmin = hasAnyActiveRole(req.user, ['admin', 'bgh']);
  const isAdminOrLeader = isTopAdmin || hasAnyActiveRole(req.user, UNIT_LEADER_ROLES);
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

const extractImageBuffer = (req) => {
  if (req.file && req.file.buffer) return req.file.buffer;
  if (req.body?.image) {
    const base64Data = String(req.body.image).replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
  return null;
};

// POST /api/cham-cong/khuon-mat - Điểm danh khuôn mặt trên tài khoản đang đăng nhập (khuôn mặt phải khớp chính chủ)
const faceRecognizeAttendance = async (req, res) => {
  const callerId = req.user?.id;
  if (!callerId) {
    return sendError(res, 'Vui lòng đăng nhập để chấm công bằng khuôn mặt.', null, 401);
  }
  if (hasAnyActiveRole(req.user, NON_ATTENDANCE_ROLES)) {
    return sendError(
      res,
      'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện chấm công cá nhân.',
      null,
      403,
      'ATTENDANCE_ROLE_FORBIDDEN'
    );
  }

  const imageBuffer = extractImageBuffer(req);
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

  if (!verifyOnly) {
    await consumeLivenessTicket(req.body?.livenessTicket || req.body?.ve_mat_that, callerId);
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
};

// GET /api/cham-cong/hang-doi/thong-ke - Thống kê hàng đợi chấm công BullMQ
const getQueueStats = async (req, res) => {
  const { getPunchQueueStats } = require('../queues/hangDoiChamCong');
  const stats = await getPunchQueueStats();
  return sendSuccess(res, 'Thống kê hàng đợi điểm danh BullMQ giờ cao điểm.', stats, 200);
};

// POST /api/cham-cong/vao-ca - Check-in theo ca hoặc lịch làm việc
const checkIn = async (req, res) => {
  const {
    ca_id: resolvedCaId,
    lich_trinh_id: resolvedLichTrinhId,
    thiet_bi_id: resolvedThietBiId = 'MOBILE_APP',
    phuong_thuc,
    nguoi_dung_id,
  } = req.body || {};

  const { targetUserId, isAdminOrLeader } = await resolveAttendanceTarget(req, nguoi_dung_id);

  if (String(targetUserId) === String(req.user?.id || '') && hasAnyActiveRole(req.user, NON_ATTENDANCE_ROLES)) {
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

  const result = await performCheckIn({
    nguoi_dung_id: targetUserId,
    ca_id: resolvedCaId,
    lich_trinh_id: resolvedLichTrinhId,
    thiet_bi_id: resolvedThietBiId,
    vi_do: resolvedViDo,
    kinh_do: resolvedKinhDo,
    do_chinh_xac: resolvedDoChinhXac,
    phuong_thuc: isManualAdmin ? 'thu_cong_admin' : 'gps_mobile',
    dia_chi_ip: req.ip || req.connection?.remoteAddress,
    allowManual: isManualAdmin,
  });
  return sendSuccess(res, result.message, result, 201);
};

// POST /api/cham-cong/tan-ca - Check-out ra về
const checkOut = async (req, res) => {
  const {
    ca_id: resolvedCaId,
    cham_cong_id: resolvedChamCongId,
    thiet_bi_id: resolvedThietBiId = 'MOBILE_APP',
    phuong_thuc,
    nguoi_dung_id,
  } = req.body || {};

  const { targetUserId, isAdminOrLeader } = await resolveAttendanceTarget(req, nguoi_dung_id);

  if (String(targetUserId) === String(req.user?.id || '') && hasAnyActiveRole(req.user, NON_ATTENDANCE_ROLES)) {
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

  const result = await performCheckOut({
    nguoi_dung_id: targetUserId,
    ca_id: resolvedCaId,
    cham_cong_id: resolvedChamCongId,
    thiet_bi_id: resolvedThietBiId,
    vi_do: resolvedViDo,
    kinh_do: resolvedKinhDo,
    do_chinh_xac: resolvedDoChinhXac,
    phuong_thuc: isManualAdmin ? 'thu_cong_admin' : 'gps_mobile',
    dia_chi_ip: req.ip || req.connection?.remoteAddress,
    allowManual: isManualAdmin,
  });
  return sendSuccess(res, result.message, result, 200);
};

// GET /api/cham-cong/lich-su - Lịch sử chấm công toàn hệ thống/đơn vị (có phân trang & bộ lọc)
const getAttendanceHistory = async (req, res) => {
  const {
    nguoi_dung_id,
    don_vi_id,
    trang_thai,
    tu_ngay,
    den_ngay,
    phuong_thuc,
    co_gian_lan,
    trang = 1,
    gioi_han = 20,
  } = req.query || {};

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
    page: trang,
    limit: gioi_han,
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy lịch sử chấm công thành công.', result, 200);
};

// GET /api/cham-cong/lich-su-cua-toi - Lịch sử chấm công của chính người dùng đang đăng nhập
const getMyAttendanceHistory = async (req, res) => {
  if (hasAnyActiveRole(req.user, NON_ATTENDANCE_ROLES)) {
    return sendError(
      res,
      'Tài khoản Quản trị viên IT / Kiểm toán không có dữ liệu chấm công cá nhân.',
      null,
      403,
      'AUTH_FORBIDDEN'
    );
  }
  const { trang_thai, tu_ngay, den_ngay, phuong_thuc, co_gian_lan, trang = 1, gioi_han = 20 } = req.query || {};
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
    page: trang,
    limit: gioi_han,
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy lịch sử chấm công cá nhân thành công.', result, 200);
};

// GET /api/cham-cong/:id - Chi tiết bản ghi chấm công
const getAttendanceById = async (req, res) => {
  const log = await fetchAttendanceById({ id: req.params.id, currentUser: req.user });
  return sendSuccess(res, 'Lấy chi tiết chấm công thành công.', log, 200);
};

// GET /api/cham-cong/:id/minh-chung - Ảnh minh chứng điểm danh bảo mật
const getAttendanceEvidence = async (req, res) => {
  const evidence = await fetchAttendanceEvidence({ id: req.params.id, currentUser: req.user });
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': evidence.contentType,
  });
  return res.status(200).send(evidence.buffer);
};

// PUT /api/cham-cong/:id/dieu-chinh - Điều chỉnh bản ghi chấm công (Admin/BGH/Lãnh đạo khoa)
const updateAttendanceByAdmin = async (req, res) => {
  const { trang_thai, thoi_gian_vao, thoi_gian_ra, don_tu_id, co_gian_lan, ly_do_ghi_de } = req.body || {};
  const updated = await modifyAttendanceByAdmin({
    id: req.params.id,
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
};

// POST /api/cham-cong/qr/quet-ma - Chấm công bằng mã QR động TOTP
const scanQRCode = async (req, res) => {
  if (hasAnyActiveRole(req.user, NON_ATTENDANCE_ROLES)) {
    return sendError(
      res,
      'Tài khoản Quản trị viên IT / Kiểm toán không thực hiện quét mã QR chấm công cá nhân.',
      null,
      403,
      'ATTENDANCE_ROLE_FORBIDDEN'
    );
  }

  const { ma_qr: resolvedToken, thiet_bi_id: resolvedThietBiId = 'MOBILE_APP_QR' } = req.body || {};
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
};

// GET /api/cham-cong/qr/tao-ma - Sinh mã QR động cho ca làm việc hoặc phòng học
const getDynamicQRCode = async (req, res) => {
  if (req.user && !hasAnyActiveRole(req.user, KIOSK_QR_ROLES)) {
    return sendError(
      res,
      'Bạn không có quyền phát mã QR điểm danh động.',
      null,
      403,
      'QR_GENERATE_FORBIDDEN'
    );
  }

  const { ca_id: shiftId, lich_trinh_id: scheduleId, phong_hoc: roomId } = req.query;
  const qrResult = await generateDynamicQRCode({ shiftId, scheduleId, roomId, user: req.user });
  return sendSuccess(res, 'Sinh mã QR động thành công.', qrResult, 200);
};

// GET /api/cham-cong/cau-hinh-khuon-vien - Cấu hình Geofence khuôn viên trường
const getCampusConfigInfo = async (req, res) => {
  await systemConfigService.loadConfigsIntoCache().catch(() => {});
  return sendSuccess(res, 'Lấy cấu hình Geofence thành công.', getCampusConfig(), 200);
};

// GET /api/cham-cong/chi-so-vector/thong-ke - Trạng thái RAM Vector Index & Self-Healing
const getRamIndexStats = async (req, res) => {
  await ensureRamCacheWarm();
  const stats = await getFaissStats();
  return sendSuccess(res, 'Lấy thông tin RAM Vector Index thành công.', stats, 200);
};

// Đồng bộ lại toàn bộ vector khuôn mặt vào RAM FAISS của Face Service
const syncFaissIndexController = async (req, res) => {
  const syncResult = await ensureRamCacheWarm(true);
  const stats = await getFaissStats();
  return sendSuccess(res, 'Đồng bộ lại RAM Vector Index từ SQL Server thành công.', { syncResult, stats }, 200);
};

// Cập nhật tọa độ và bán kính hàng rào địa lý khuôn viên trường (lưu chuẩn GEOFENCE_TRUONG)
const updateCampusLocationConfig = async (req, res) => {
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
  return sendSuccess(
    res,
    'Cập nhật cấu hình khuôn viên thành công.',
    {
      ten_co_so: geofencePayload.ten_co_so,
      vi_do: updatedCampus.lat,
      kinh_do: updatedCampus.lng,
      ban_kinh_met: updatedCampus.radiusMeters,
    },
    200
  );
};

// Tạo thử thách quay/ngẩng/cúi mặt ngẫu nhiên kèm chữ ký HMAC gắn userId (hạn 120s)
const getLivenessChallengeController = (req, res) => {
  const data = issueLivenessChallenge(req.user?.id);
  return sendSuccess(res, 'Liveness challenge', data);
};

// Xác thực ảnh người dùng thực hiện đúng thử thách liveness và cấp vé tạm thời gắn userId
const verifyLivenessChallengeController = async (req, res) => {
  const result = await verifyLivenessChallenge({
    challengeToken: req.body?.challengeToken,
    userId: req.user?.id,
    imageBuffer: extractImageBuffer(req),
  });
  return sendSuccess(
    res,
    result.passed ? 'Xác thực Liveness thành công.' : 'Tư thế khuôn mặt chưa khớp thử thách.',
    result
  );
};

// Kích hoạt thủ công tiến trình quét vắng mặt theo ngày
const triggerDailyAbsentCheck = async (req, res) => {
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
};

// GET /api/cham-cong/khoi-hom-nay – Danh sách khối ca hôm nay của người dùng (dùng trên màn hình quét mặt)
const getKhoiHomNay = async (req, res) => {
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
