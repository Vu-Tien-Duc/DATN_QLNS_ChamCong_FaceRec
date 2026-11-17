// Client gọi API tới Python FastAPI Face Service (InsightFace 512D, Liveness) và tự đồng bộ lại FAISS RAM cache
const { Op } = require('sequelize');
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001';
const {
  cacheFaceVectors,
  getCachedFaceVectors,
  invalidateFaceCache,
} = require('../../config/redis');
const { getConfigSync } = require('../heThong/cauHinhHeThong.service');

// Lấy ngưỡng so khớp khuôn mặt hiệu lực từ tham số truyền vào hoặc cấu hình hệ thống
const getEffectiveThreshold = (explicitThreshold) => {
  if (Number.isFinite(Number(explicitThreshold))) {
    return Number(explicitThreshold);
  }
  const configured = Number(getConfigSync('FACE_MATCH_THRESHOLD', 0.45));
  return Number.isFinite(configured) ? configured : 0.45;
};

// Đọc phản hồi HTTP và parse JSON an toàn
const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Gọi HTTP request tới dịch vụ Python FastAPI Face Service kèm timeout và API key nội bộ
const callFaceService = async ({ path, method = 'GET', body = null, headers = {}, timeoutMs = 20000 }) => {
  const apiKey = process.env.FACE_SERVICE_API_KEY;
  const mergedHeaders = {
    ...(apiKey ? { 'x-internal-api-key': apiKey } : {}),
    ...headers,
  };
  let response;
  try {
    response = await fetch(`${FACE_SERVICE_URL}${path}`, {
      method,
      headers: mergedHeaders,
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

// Trích xuất vector khuôn mặt 512 chiều từ 1 ảnh
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

// Phát hiện góc nghiêng đầu và tư thế khuôn mặt từ ảnh
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

// Gửi 5 ảnh góc mặt để đăng ký đa góc sang Face Service
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

// Nhận diện khuôn mặt 1:N kèm kiểm tra liveness và chất lượng ảnh
const recognizeFace = async ({
  imageBuffer,
  threshold,
  checkLiveness = true,
  checkQuality = true,
  mimeType = 'image/jpeg',
  fileName = 'attendance.jpg',
}) => {
  const effectiveThreshold = getEffectiveThreshold(threshold);
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);

  return callFaceService({
    path: `/v1/face/recognize?threshold=${effectiveThreshold}&check_liveness=${checkLiveness}&check_quality=${checkQuality}`,
    method: 'POST',
    body: formData,
    timeoutMs: 8000,
  });
};

// Xác minh khuôn mặt 1:1 theo mã cán bộ
const verifyFace = async ({
  imageBuffer,
  employeeId,
  threshold,
  checkLiveness = true,
  mimeType = 'image/jpeg',
  fileName = 'verify.jpg',
}) => {
  const effectiveThreshold = getEffectiveThreshold(threshold);
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), fileName);
  formData.append('employee_id', employeeId);

  return callFaceService({
    path: `/v1/face/verify?threshold=${effectiveThreshold}&check_liveness=${checkLiveness}`,
    method: 'POST',
    body: formData,
    timeoutMs: 8000,
  });
};

// Đồng bộ toàn bộ danh sách mẫu khuôn mặt vào chỉ mục FAISS RAM
const syncFaissTemplates = async (templates) => {
  return callFaceService({
    path: '/v1/faiss/sync',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templates }),
    timeoutMs: 15000,
  });
};

// Thêm hoặc cập nhật vector khuôn mặt của một nhân sự vào FAISS RAM
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

// Xóa vector khuôn mặt của một nhân sự khỏi FAISS RAM
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

// Lấy thống kê bộ nhớ FAISS của Face Service
const getFaissStats = async () => {
  return callFaceService({
    path: '/v1/faiss/stats',
    method: 'GET',
    timeoutMs: 5000,
  });
};

// Tự đồng bộ vector từ SQL Server lên FAISS RAM khi Face Service vừa khởi động lại hoặc lệch số lượng
const ensureRamCacheWarm = async (force = false) => {
  try {
    const raw = await getFaissStats();
    const stats = raw?.data || raw || {};
    const totalVectors = typeof stats.total_vectors === 'number' ? stats.total_vectors : 0;
    const totalUsers = typeof stats.total_users === 'number' ? stats.total_users : 0;

    const { MauKhuonMat, NguoiDung } = require('../../models');
    const activeUserInclude = {
      model: NguoiDung,
      as: 'nguoi_dung',
      attributes: ['id', 'ho_ten', 'ma_can_bo'],
      where: {
        kich_hoat: true,
        trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
      },
      required: true,
    };
    const dbTemplateCount = await MauKhuonMat.count({
      where: { mac_dinh: true },
      include: [{ model: NguoiDung, as: 'nguoi_dung', attributes: [], where: activeUserInclude.where, required: true }],
    });

    const needsSync = force || (totalVectors === 0 && dbTemplateCount > 0) || (totalUsers !== dbTemplateCount);

    if (needsSync) {
      console.log(`[Face AI Self-Healing] Đồng bộ RAM Index với SQL Server (RAM: ${totalUsers} users, DB: ${dbTemplateCount} templates)...`);

      if (dbTemplateCount === 0) {
        await syncFaissTemplates([]);
        await invalidateFaceCache().catch(() => {});
        return { healed: true, count: 0, source: 'sqlserver_empty' };
      }

      const templates = await MauKhuonMat.findAll({
        where: { mac_dinh: true },
        include: [activeUserInclude],
      });

      const payload = [];
      for (const t of templates) {
        const u = t.nguoi_dung || {};
        const resolvedUserId = String(u.id || t.nguoi_dung_id || '');
        const fullName = u.ho_ten || 'Cán bộ';
        const staffCode = u.ma_can_bo || resolvedUserId;
        const avg = t.vector_trung_binh;
        const allVecs = t.vector_dac_trung || [];

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
      console.log(`[Face AI Self-Healing] Đã đồng bộ thành công ${payload.length} vector cho ${dbTemplateCount} nhân sự từ SQL Server lên RAM.`);
      return { healed: true, count: payload.length, source: 'sqlserver' };
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

// Alias nhận diện khuôn mặt qua FAISS
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
