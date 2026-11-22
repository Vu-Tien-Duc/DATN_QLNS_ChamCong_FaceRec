// Hàng đợi xử lý điểm danh giờ cao điểm (BullMQ + Redis), tự động fallback xử lý đồng bộ khi Redis offline

const { Queue, Worker, UnrecoverableError } = require('bullmq');
const { getRedisClient, isRedisReady } = require('../config/redis');

const QUEUE_NAME = 'attendance-punch-queue';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_URL = process.env.REDIS_URL || null;

// Cấu hình connection riêng cho BullMQ (yêu cầu maxRetriesPerRequest: null)
const getQueueConnectionOptions = () => {
  if (REDIS_URL) {
    try {
      const parsed = new URL(REDIS_URL);
      const dbStr = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      const parsedDb = dbStr && /^\d+$/.test(dbStr) ? parseInt(dbStr, 10) : undefined;
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || process.env.REDIS_PASSWORD || undefined,
        ...(parsedDb !== undefined ? { db: parsedDb } : {}),
        ...(parsed.protocol === 'rediss:' || process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 1000,
      };
    } catch (_) {}
  }

  const parsedEnvDb = process.env.REDIS_DB !== undefined && /^\d+$/.test(String(process.env.REDIS_DB))
    ? parseInt(process.env.REDIS_DB, 10)
    : undefined;

  return {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
    ...(parsedEnvDb !== undefined ? { db: parsedEnvDb } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 1000,
  };
};

let punchQueue = null;
let punchWorker = null;
let isQueueOnline = false;

// Khởi tạo hàng đợi BullMQ (trả về null khi tắt hoặc Redis offline để dùng fallback đồng bộ)
const getPunchQueue = () => {
  if (punchQueue) return punchQueue;

  if (process.env.DISABLE_BULLMQ === 'true' || !isRedisReady()) {
    isQueueOnline = false;
    return null;
  }

  try {
    const connection = getQueueConnectionOptions();
    punchQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    punchQueue.on('error', (err) => {
      isQueueOnline = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ Queue Error]: ${err.message}. Kích hoạt chế độ Fallback Đồng bộ.`);
      }
    });

    isQueueOnline = true;
  } catch (error) {
    isQueueOnline = false;
    punchQueue = null;
  }

  return punchQueue;
};

// Xử lý 1 lượt điểm danh: ủy quyền cho lõi thucThiQuetChamCong dùng chung, lỗi nghiệp vụ ném UnrecoverableError
const processPunchJobData = async (jobData) => {
  const {
    type,
    userId,
    nguoi_dung_id,
    punchType,
    requestedAction,
    punchTime,
    location,
    reqIp,
    deviceId,
    aiResult,
    evidenceRef,
  } = jobData;

  const { preparePunchContext, executePunchPersistence } = require('../services/chamCong/thucThiQuetChamCong.service');
  const { normalizeAttendanceMethod } = require('../utils/thoiGianChamCong.utils');
  const effectiveUserId = nguoi_dung_id || userId;
  const canonicalMethod = normalizeAttendanceMethod(type || 'face_ai');
  const makeUnrecoverable = (msg) => new UnrecoverableError(msg);

  const context = await preparePunchContext({
    userId: effectiveUserId,
    user: null,
    requestedAction: requestedAction || punchType || null,
    punchTime: punchTime ? new Date(punchTime) : new Date(),
    location,
    reqIp,
    makeError: makeUnrecoverable,
  });

  const { actionType, attendanceRecord, geoCheck } = await executePunchPersistence({
    userId: effectiveUserId,
    user: null,
    context,
    method: canonicalMethod,
    aiResult,
    evidenceRef,
    location,
    deviceId,
    reqIp,
    auditActionPrefix: 'ATTENDANCE_QUEUE',
    auditExtra: {
      phuong_thuc: canonicalMethod,
      xu_ly_qua: 'BULLMQ_ASYNC_PIPELINE',
    },
    makeError: makeUnrecoverable,
  });

  return {
    success: true,
    action: actionType,
    recordId: attendanceRecord.id,
    userId: effectiveUserId,
    isFraud: geoCheck.isFraud,
    processedAt: new Date(),
  };
};

// Đưa lượt điểm danh vào hàng đợi BullMQ; nếu Redis offline thì xử lý đồng bộ ngay
const addPunchJob = async (jobData) => {
  const queue = getPunchQueue();

  if (queue) {
    let timeoutId = null;
    const jobUserId = jobData?.nguoi_dung_id || jobData?.userId || 'unknown';
    const jobPromise = queue.add(
      `punch-${jobUserId}-${Date.now()}`,
      jobData,
      jobData?.idempotencyKey ? { jobId: String(jobData.idempotencyKey) } : undefined
    );
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Queue add timed out')), 1500);
      });
      const job = await Promise.race([jobPromise, timeoutPromise]);
      try {
        const { emitQueueStats } = require('../config/socket');
        getPunchQueueStats().then((stats) => emitQueueStats(stats)).catch(() => {});
      } catch (_) {}
      return {
        success: true,
        queued: true,
        jobId: job.id,
        message: 'Lượt quét điểm danh đã được đưa vào hàng đợi xử lý bất đồng bộ thành công.',
        status: 'QUEUED',
      };
    } catch (queueError) {
      jobPromise.then((lateJob) => lateJob?.remove().catch(() => {})).catch(() => {});
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ] Không thể đẩy job vào hàng đợi: ${queueError.message}. Kích hoạt xử lý đồng bộ Fallback.`);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Xử lý đồng bộ trực tiếp khi BullMQ không khả dụng
  try {
    const syncResult = await processPunchJobData(jobData);
    return {
      success: true,
      queued: false,
      jobId: `sync-${Date.now()}`,
      message: 'Điểm danh thành công (Xử lý đồng bộ Fallback).',
      status: 'PROCESSED_SYNC',
      result: syncResult,
    };
  } catch (err) {
    return {
      success: false,
      queued: false,
      jobId: `sync-${Date.now()}`,
      message: `Xử lý điểm danh đồng bộ thất bại: ${err.message}`,
      status: 'FAILED_SYNC',
      result: { fallbackProcessed: false, error: err.message },
    };
  }
};

// Khởi động Worker xử lý nền hàng đợi điểm danh (mặc định 5 luồng đồng thời)
const startPunchWorker = (concurrency = 5) => {
  if (punchWorker) return punchWorker;

  if (process.env.DISABLE_BULLMQ === 'true' || !isRedisReady()) {
    return null;
  }

  try {
    const connection = getQueueConnectionOptions();
    punchWorker = new Worker(
      QUEUE_NAME,
      async (job) => {
        return await processPunchJobData(job.data);
      },
      {
        connection,
        concurrency,
      }
    );

    punchWorker.on('completed', () => {});

    punchWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker Failed] Job ${job?.id} thất bại: ${err.message}`);
    });

    punchWorker.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ Worker Error]: ${err.message}`);
      }
    });

    return punchWorker;
  } catch (error) {
    punchWorker = null;
    return null;
  }
};

// Thống kê số lượng job hiện có trong hàng đợi
const getPunchQueueStats = async () => {
  const queue = getPunchQueue();
  if (!queue) {
    return {
      status: 'OFFLINE',
      mode: 'SYNC_FALLBACK',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  try {
    const countsPromise = queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Job counts timed out')), 1500)
    );
    const counts = await Promise.race([countsPromise, timeoutPromise]);
    return {
      status: 'ONLINE',
      mode: 'BULLMQ_ASYNC',
      ...counts,
    };
  } catch (error) {
    return {
      status: 'OFFLINE',
      mode: 'SYNC_FALLBACK',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      error: error.message,
    };
  }
};

// Đóng worker và hàng đợi an toàn khi tắt server
const closePunchQueue = async () => {
  if (punchWorker) {
    try {
      await punchWorker.close();
    } catch (_) {}
    punchWorker = null;
  }
  if (punchQueue) {
    try {
      await punchQueue.close();
    } catch (_) {}
    punchQueue = null;
  }
  isQueueOnline = false;
};

module.exports = {
  getPunchQueue,
  addPunchJob,
  startPunchWorker,
  processPunchJobData,
  getPunchQueueStats,
  closePunchQueue,
  QUEUE_NAME,
};
