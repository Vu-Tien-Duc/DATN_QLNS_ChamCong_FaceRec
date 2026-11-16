/**
 * Cơ chế Khóa Phân Tán (Distributed Lock) cho Hệ thống Quản lý Chấm công & Nhân sự
 * Thứ tự ưu tiên: 1. Redis (Redlock) -> 2. SQL Server (CauHinhHeThong) -> 3. In-Memory Fallback
 */
const { sequelize, CauHinhHeThong } = require('../models');
const { acquireRedisLock, releaseRedisLock, isRedisReady, redisGet } = require('../config/redis');

const generateWorkerId = () =>
  `worker_${process.pid}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

const DEFAULT_WORKER_ID = generateWorkerId();
const memoryLocks = new Map();

const resetMemoryLocks = () => {
  memoryLocks.clear();
};

const isSqlDbAvailable = async () => {
  if (process.env.NODE_ENV === 'test') return false;
  try {
    await sequelize.authenticate();
    return true;
  } catch (_) {
    return false;
  }
};

const acquireMemoryLock = (normalizedKey, now, expiresAt, workerId) => {
  const existing = memoryLocks.get(normalizedKey);
  if (existing && existing.isLocked && existing.expiresAt > now && existing.lockedBy !== workerId) {
    return false;
  }
  memoryLocks.set(normalizedKey, {
    isLocked: true,
    lockedBy: workerId,
    acquiredAt: now,
    expiresAt,
  });
  return true;
};

const acquireLock = async (lockKey, ttlSeconds = 60, workerId = DEFAULT_WORKER_ID) => {
  if (!lockKey || typeof lockKey !== 'string') {
    throw new Error('[DistributedLock] lockKey phải là chuỗi ký tự hợp lệ.');
  }

  if (isRedisReady()) {
    const redisAcquired = await acquireRedisLock(lockKey, ttlSeconds, workerId);
    if (redisAcquired !== null) return redisAcquired;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;

  if (!(await isSqlDbAvailable())) {
    return acquireMemoryLock(normalizedKey, now, expiresAt, workerId);
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      const existing = await CauHinhHeThong.findOne({
        where: { khoa_cau_hinh: normalizedKey },
        transaction,
      });

      const newLockVal = {
        isLocked: true,
        lockedBy: workerId,
        acquiredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      if (existing) {
        const val = existing.gia_tri || {};
        const exp = val.expiresAt ? new Date(val.expiresAt) : null;
        const canSteal = !val.isLocked || val.lockedBy === workerId || (exp && exp <= now);
        if (!canSteal) return false;

        existing.gia_tri = newLockVal;
        await existing.save({ transaction });
        return true;
      }

      await CauHinhHeThong.create(
        {
          khoa_cau_hinh: normalizedKey,
          gia_tri: newLockVal,
          nhom: 'SYSTEM',
          mo_ta: `Khóa phân tán cho tiến trình nền (${lockKey})`,
        },
        { transaction }
      );
      return true;
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return false;
    return acquireMemoryLock(normalizedKey, now, expiresAt, workerId);
  }
};

const releaseLock = async (lockKey, workerId = DEFAULT_WORKER_ID) => {
  if (!lockKey || typeof lockKey !== 'string') return false;

  if (isRedisReady()) {
    const redisReleased = await releaseRedisLock(lockKey, workerId);
    if (redisReleased !== null) return redisReleased;
  }

  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;
  const now = new Date();

  if (!(await isSqlDbAvailable())) {
    const existing = memoryLocks.get(normalizedKey);
    if (existing && existing.lockedBy === workerId) {
      memoryLocks.set(normalizedKey, {
        isLocked: false,
        lockedBy: null,
        releasedAt: now,
        expiresAt: now,
      });
      return true;
    }
    return false;
  }

  try {
    const existing = await CauHinhHeThong.findOne({ where: { khoa_cau_hinh: normalizedKey } });
    if (!existing) return false;
    const val = existing.gia_tri || {};
    if (val.lockedBy !== workerId) return false;

    existing.gia_tri = {
      ...val,
      isLocked: false,
      releasedAt: now.toISOString(),
    };
    await existing.save();
    return true;
  } catch (error) {
    console.error(`[DistributedLock] Lỗi khi giải phóng khóa '${lockKey}':`, error.message);
    return false;
  }
};

const withDistributedLock = async (lockKey, ttlSeconds, taskFn, options = {}) => {
  const workerId = options.workerId || DEFAULT_WORKER_ID;
  const prefix = options.logPrefix || '[DistributedLock]';

  const acquired = await acquireLock(lockKey, ttlSeconds, workerId);
  if (!acquired) {
    if (options.throwOnBusy) {
      const err = new Error(`Khóa phân tán '${lockKey}' đang được tiến trình khác xử lý.`);
      err.code = 'DISTRIBUTED_LOCK_BUSY';
      throw err;
    }
    console.log(`${prefix} Khóa '${lockKey}' đang được tiến trình khác xử lý hoặc chưa hết hạn TTL. Bỏ qua lượt chạy này.`);
    return null;
  }

  try {
    return await taskFn();
  } finally {
    try {
      await releaseLock(lockKey, workerId);
    } catch (releaseErr) {
      console.warn(`${prefix} Cảnh báo khi giải phóng khóa '${lockKey}':`, releaseErr.message);
    }
  }
};

const getLockStatus = async (lockKey) => {
  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;
  const now = new Date();

  if (isRedisReady()) {
    const redisWorkerId = await redisGet(`DIST_LOCK:${lockKey.toUpperCase().trim()}`);
    if (redisWorkerId) {
      return { isLocked: true, lockedBy: redisWorkerId, storage: 'redis' };
    }
  }

  if (!(await isSqlDbAvailable())) {
    const mem = memoryLocks.get(normalizedKey);
    if (!mem) return { isLocked: false, exists: false, storage: 'memory' };
    const isExpired = mem.expiresAt && mem.expiresAt <= now;
    return {
      isLocked: mem.isLocked && !isExpired,
      lockedBy: mem.lockedBy,
      expiresAt: mem.expiresAt,
      isExpired,
      storage: 'memory',
    };
  }

  const doc = await CauHinhHeThong.findOne({ where: { khoa_cau_hinh: normalizedKey } });
  if (!doc || !doc.gia_tri) {
    return { isLocked: false, exists: false, storage: 'sqlserver' };
  }

  const val = doc.gia_tri;
  const expiresAt = val.expiresAt ? new Date(val.expiresAt) : null;
  const isExpired = expiresAt && expiresAt <= now;

  return {
    isLocked: Boolean(val.isLocked) && !isExpired,
    lockedBy: val.lockedBy || null,
    acquiredAt: val.acquiredAt || null,
    expiresAt,
    isExpired,
    storage: 'sqlserver',
  };
};

module.exports = {
  DEFAULT_WORKER_ID,
  generateWorkerId,
  acquireLock,
  releaseLock,
  withDistributedLock,
  getLockStatus,
  resetMemoryLocks,
};
