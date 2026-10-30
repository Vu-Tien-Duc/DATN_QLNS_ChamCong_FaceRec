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

  const angleFields = [
    'image_straight',
    'image_left',
    'image_right',
    'image_up',
    'image_down',
  ];

  if (files) {
    for (const field of angleFields) {
      if (files[field] && files[field][0]) {
        const f = files[field][0];
        const buffer = f.buffer || require('fs').readFileSync(f.path);
        formData.append(field, new Blob([buffer], { type: f.mimetype || 'image/jpeg' }), `${field}.jpg`);
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

const addFaissTemplate = async ({ userId, embedding, embeddings, fullName, employeeId }) => {
  const result = await callFaceService({
    path: '/v1/faiss/add',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, embedding, embeddings, fullName, employeeId }),
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
 * Kiểm tra RAM Index, nếu rỗng hoặc số lượng lệch với MongoDB thì tự động nạp đồng bộ
 */
const ensureRamCacheWarm = async (force = false) => {
  try {
    const raw = await getFaissStats();
    const stats = raw?.data || raw || {};
    const totalVectors = typeof stats.total_vectors === 'number' ? stats.total_vectors : 0;
    const totalUsers = typeof stats.total_users === 'number' ? stats.total_users : 0;

    const FaceTemplate = require('../models/faceTemplate.model');
    const dbTemplateCount = await FaceTemplate.countDocuments();

    // Tự động đồng bộ lại nếu:
    // 1. Tham số force = true
    // 2. RAM Index rỗng trong khi DB có dữ liệu
    // 3. Số lượng người dùng trong RAM lệch với số lượng mẫu thực tế trong MongoDB (chống lệch dữ liệu người bị từ chối/xóa)
    const needsSync = force || (totalVectors === 0 && dbTemplateCount > 0) || (totalUsers !== dbTemplateCount);

    if (needsSync) {
      console.log(`[Face AI Self-Healing] Đồng bộ RAM Index với MongoDB (RAM: ${totalUsers} users, DB: ${dbTemplateCount} templates)...`);

      if (dbTemplateCount === 0) {
        await syncFaissTemplates([]);
        await invalidateFaceCache().catch(() => {});
        console.log('[Face AI Self-Healing] Cơ sở dữ liệu FaceTemplate rỗng. Đã làm sạch RAM Vector Store.');
        return { healed: true, count: 0, source: 'mongodb_empty' };
      }

      // Nạp từ MongoDB
      const templates = await FaceTemplate.find()
        .select('+vector_dac_trung +vector_trung_binh')
        .populate('userId', 'fullName staffCode')
        .lean();

      const payload = [];
      for (const t of templates) {
        const u = t.userId || {};
        const resolvedUserId = (u._id || t.userId || '').toString();
        const fullName = u.fullName || 'Cán bộ';
        const staffCode = u.staffCode || resolvedUserId;
        const avg = t.averageDescriptor || t.vector_trung_binh;
        const allVecs = t.descriptors || t.vector_dac_trung || [];

        if (Array.isArray(avg) && avg.length === 512) {
          payload.push({ userId: resolvedUserId, employeeId: staffCode, fullName, embedding: avg });
        }
        if (Array.isArray(allVecs)) {
          allVecs.forEach((vec) => {
            if (Array.isArray(vec) && vec.length === 512) {
              payload.push({ userId: resolvedUserId, employeeId: staffCode, fullName, embedding: vec });
            }
          });
        }
      }

      await syncFaissTemplates(payload);
      await cacheFaceVectors(payload, 1800).catch(() => {});
      console.log(`[Face AI Self-Healing] Đã đồng bộ thành công ${payload.length} vector cho ${dbTemplateCount} nhân sự từ MongoDB lên RAM.`);
      return { healed: true, count: payload.length, source: 'mongodb' };
    }
    return { healed: false, count: totalVectors };
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
