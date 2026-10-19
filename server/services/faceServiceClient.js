/**
 * Client giao tiếp RESTful với Python FastAPI Face Service (InsightFace Microservice)
 * Chuẩn CSDL v2.5: Đa góc ArcFace 512D, Margin Top 1-2, Liveness & Tự phục hồi RAM Cache.
 */
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001';
const {
  cacheFaceVectors,
  getCachedFaceVectors,
  invalidateFaceCache,
} = require('../config/redis');

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const callFaceService = async ({ path, method = 'GET', body = null, headers = {}, timeoutMs = 20000 }) => {
  let response;
  try {
    response = await fetch(`${FACE_SERVICE_URL}${path}`, {
      method,
      headers: { ...headers },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const error = new Error(
      cause.name === 'TimeoutError'
        ? 'Face Service quá thời gian phản hồi (Timeout).'
        : 'Không thể kết nối Face Service. Vui lòng kiểm tra dịch vụ Python FastAPI đang chạy.'
    );
    error.status = cause.name === 'TimeoutError' ? 504 : 503;
    error.statusCode = error.status;
    error.errorCode = cause.name === 'TimeoutError' ? 'FACE_SERVICE_TIMEOUT' : 'FACE_SERVICE_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }

  const data = await safeJson(response);
  if (!response.ok) {
    const message = typeof data === 'object' && data && data.detail ? data.detail : 'Yêu cầu Face Service thất bại';
    const error = new Error(message);
    error.status = response.status;
    error.statusCode = response.status;
    error.errorCode = 'FACE_SERVICE_ERROR';
    error.payload = data;
    throw error;
  }

  return data;
};

/**
 * Trích xuất vector đặc trưng ArcFace 512 chiều từ 1 ảnh
 */
const extractFaceEmbedding = async ({ imageBuffer, mimeType = 'image/jpeg', fileName = 'capture.jpg' }) => {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);

  return callFaceService({
    path: '/v1/faces/extract',
    method: 'POST',
    body: formData,
    timeoutMs: 8000,
  });
};

/**
 * Ước lượng tư thế đầu 3D (Euler Yaw, Pitch, Roll) và kiểm tra Liveness
 */
const detectFacePose = async ({ imageBuffer, mimeType = 'image/jpeg', fileName = 'capture.jpg' }) => {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);

  return callFaceService({
    path: '/v1/face/detect-pose',
    method: 'POST',
    body: formData,
    timeoutMs: 5000,
  });
};

/**
 * Đăng ký 5 góc chụp đa chiều (Chính diện, Trái, Phải, Ngửa, Cúi)
 */
const enrollMultiAngle = async ({ files, employeeId, fullName, department }) => {
  const formData = new FormData();
  if (employeeId) formData.append('employee_id', employeeId);
  if (fullName) formData.append('full_name', fullName);
  if (department) formData.append('department', department);

  const angleMap = [
    ['image_straight', 'image_straight'],
    ['image_left',     'image_left'],
    ['image_right',    'image_right'],
    ['image_up',       'image_up'],
    ['image_down',     'image_down'],
    ['straight',       'image_straight'],
    ['left',           'image_left'],
    ['right',          'image_right'],
    ['up',             'image_up'],
    ['down',           'image_down'],
    ['image',          'image_straight'],
  ];

  if (files) {
    const added = new Set();
    for (const [field, outField] of angleMap) {
      if (files[field] && files[field][0] && !added.has(outField)) {
        const f = files[field][0];
        const buffer = f.buffer || require('fs').readFileSync(f.path);
        formData.append(outField, new Blob([buffer], { type: f.mimetype || 'image/jpeg' }), `${outField}.jpg`);
        added.add(outField);
      }
    }
  }

  return callFaceService({
    path: '/v1/face/enroll-multi-angle',
    method: 'POST',
    body: formData,
    timeoutMs: 30000,
  });
};

/**
 * Nhận diện 1:N trên RAM Vector Index (kèm Margin Top 1-2 và Liveness)
 */
const recognizeFace = async ({
  imageBuffer,
  threshold = 0.45,
  checkLiveness = true,
  checkQuality = true,
  mimeType = 'image/jpeg',
  fileName = 'attendance.jpg',
}) => {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);

  return callFaceService({
    path: `/v1/face/recognize?threshold=${threshold}&check_liveness=${checkLiveness}&check_quality=${checkQuality}`,
    method: 'POST',
    body: formData,
    timeoutMs: 8000,
  });
};

/**
 * Xác thực 1:1 khuôn mặt theo mã nhân viên
 */
const verifyFace = async ({
  imageBuffer,
  employeeId,
  threshold = 0.45,
  checkLiveness = true,
  mimeType = 'image/jpeg',
  fileName = 'verify.jpg',
}) => {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);
  formData.append('employee_id', employeeId);

  return callFaceService({
    path: `/v1/face/verify?threshold=${threshold}&check_liveness=${checkLiveness}`,
    method: 'POST',
    body: formData,
    timeoutMs: 8000,
  });
};

/**
 * Đồng bộ danh sách template vector lên RAM Index
 */
const syncFaissTemplates = async (templates) => {
  return callFaceService({
    path: '/v1/faiss/sync',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templates }),
    timeoutMs: 15000,
  });
};

const addFaissTemplate = async ({ userId, embedding, embeddings }) => {
  const result = await callFaceService({
    path: '/v1/faiss/add',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, embedding, embeddings }),
    timeoutMs: 8000,
  });
  await invalidateFaceCache().catch(() => {});
  return result;
};

const removeFaissTemplate = async (userId) => {
  const result = await callFaceService({
    path: '/v1/faiss/remove',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
    timeoutMs: 8000,
  });
  await invalidateFaceCache().catch(() => {});
  return result;
};

const getFaissStats = async () => {
  return callFaceService({
    path: '/v1/faiss/stats',
    method: 'GET',
    timeoutMs: 5000,
  });
};

/**
 * Cơ chế Tự phục hồi RAM Cache (Auto Self-Healing on Service Restart)
 * Kiểm tra RAM Index, nếu rỗng (total_vectors == 0) tự động nạp từ Redis Cache hoặc MongoDB
 */
const ensureRamCacheWarm = async () => {
  try {
    const stats = await getFaissStats();
    if (stats && (stats.total_vectors === 0 || stats.total_users === 0)) {
      console.log('[Face AI Self-Healing] Phát hiện RAM Index rỗng, đang tự phục hồi đồng bộ...');

      // 1. Thử nạp từ Redis Distributed Cache
      const cached = await getCachedFaceVectors().catch(() => null);
      if (Array.isArray(cached) && cached.length > 0) {
        await syncFaissTemplates(cached);
        console.log(`[Face AI Self-Healing] Tự phục hồi thành công ${cached.length} mẫu khuôn mặt từ Redis Cache lên RAM.`);
        return { healed: true, count: cached.length, source: 'redis' };
      }

      // 2. Nếu Redis chưa có cache, nạp từ MongoDB
      const FaceTemplate = require('../models/faceTemplate.model');
      const templates = await FaceTemplate.find({ isActive: { $ne: false } })
        .populate('userId', 'fullName staffCode')
        .lean();

      const payload = templates
        .map((t) => {
          const u = (t.userId && typeof t.userId === 'object') ? t.userId : {};
          const avg = t.averageEmbedding;
          const allVecs = t.faceDescriptors || [];
          const resolvedUserId = (u._id || t.userId || '').toString();
          return {
            userId: resolvedUserId,
            employeeId: u.staffCode || resolvedUserId,
            fullName: u.fullName || 'User',
            embedding: avg || (allVecs.length > 0 ? allVecs[0] : null),
          };
        })
        .filter((item) => item.embedding && item.userId);

      if (payload.length > 0) {
        await syncFaissTemplates(payload);
        await cacheFaceVectors(payload, 1800).catch(() => {});
        console.log(`[Face AI Self-Healing] Tự phục hồi thành công ${payload.length} mẫu khuôn mặt từ MongoDB lên RAM & lưu Redis Cache.`);
      }
      return { healed: true, count: payload.length, source: 'mongodb' };
    }
    return { healed: false, count: stats.total_vectors };
  } catch (err) {
    console.warn('[Face AI Self-Healing] Thông báo tự phục hồi RAM Index:', err.message);
    return { healed: false, error: err.message };
  }
};

// Aliases tương thích ngược
const identifyFaceWithTemplates = async ({ imageBuffer, templates }) => {
  return recognizeFace({ imageBuffer });
};

const identifyFaceFaiss = async ({ imageBuffer }) => {
  return recognizeFace({ imageBuffer });
};

module.exports = {
  FACE_SERVICE_URL,
  callFaceService,
  extractFaceEmbedding,
  detectFacePose,
  enrollMultiAngle,
  recognizeFace,
  verifyFace,
  syncFaissTemplates,
  addFaissTemplate,
  removeFaissTemplate,
  getFaissStats,
  ensureRamCacheWarm,
  identifyFaceWithTemplates,
  identifyFaceFaiss,
};
