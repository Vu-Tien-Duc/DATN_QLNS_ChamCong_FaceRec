/**
 * Cơ chế Khóa Phân Tán (Distributed Lock) cho Hệ thống Quản lý Chấm công & Nhân sự
 * Hỗ trợ hoạt động chuẩn xác trong môi trường đa container (Docker Cluster / PM2 / Kubernetes).
 * 
 * Nguyên lý hoạt động:
 * 1. Lưu trữ trạng thái khóa trong collection SystemConfig ('cau_hinh_he_thong') với tiền tố 'LOCK_'.
 * 2. Đảm bảo tính nguyên tử (Atomic Compare-and-Swap) bằng Mongoose findOneAndUpdate.
 * 3. Hỗ trợ thời gian hết hạn TTL (Time-To-Live): Nếu worker nắm khóa bị crash đột ngột,
 *    khóa sẽ tự động hết hạn, cho phép các worker khác tiếp quản mà không gây nghẽn hệ thống.
 * 4. Tự động giải phóng khóa an toàn trong khối finally thông qua hàm bọc withDistributedLock.
 * 5. Tự động Fallback sang In-Memory Lock khi CSDL MongoDB chưa kết nối (phục vụ Unit Test cô lập).
 */
const mongoose = require('mongoose');
const SystemConfig = require('../models/systemConfig.model');

// Sinh định danh Worker ngẫu nhiên duy nhất cho instance hiện tại
const generateWorkerId = () =>
  `worker_${process.pid}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

const DEFAULT_WORKER_ID = generateWorkerId();

// Bộ lưu trữ In-Memory phục vụ fallback khi không có kết nối MongoDB
const memoryLocks = new Map();

/**
 * Xóa bộ nhớ đệm lock (dùng khi reset test)
 */
const resetMemoryLocks = () => {
  memoryLocks.clear();
};

/**
 * Thử giành khóa phân tán (Acquire Lock)
 * 
 * @param {string} lockKey Tên định danh của khóa (ví dụ: 'CRON_PERIODIC_ABSENT_SCAN')
 * @param {number} [ttlSeconds=60] Thời gian sống tối đa của khóa (giây) trước khi tự hết hạn
 * @param {string} [workerId=DEFAULT_WORKER_ID] Mã định danh worker yêu cầu khóa
 * @returns {Promise<boolean>} true nếu giành khóa thành công, false nếu khóa đang bị giữ bởi worker khác
 */
const acquireLock = async (lockKey, ttlSeconds = 60, workerId = DEFAULT_WORKER_ID) => {
  if (!lockKey || typeof lockKey !== 'string') {
    throw new Error('[DistributedLock] lockKey phải là chuỗi ký tự hợp lệ.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;

  // 1. Chế độ Fallback In-Memory khi MongoDB chưa kết nối (Standalone / Unit Tests)
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    const existing = memoryLocks.get(normalizedKey);
    if (existing && existing.isLocked && existing.expiresAt > now && existing.lockedBy !== workerId) {
      return false;
    }
    memoryLocks.set(normalizedKey, {
      isLocked: true,
      lockedBy: workerId,
      acquiredAt: now,
      expiresAt: expiresAt,
    });
    return true;
  }

  // 2. Chế độ MongoDB Atomic Compare-and-Swap
  try {
    // Thử cập nhật bản ghi khóa hiện có nếu:
    // - Khóa đã hết hạn (expiresAt <= now)
    // - Khóa đã được giải phóng (isLocked === false)
    // - Khóa đang do chính worker này nắm giữ (re-entrant / renew)
    const updated = await SystemConfig.findOneAndUpdate(
      {
        khoa_cau_hinh: normalizedKey,
        $or: [
          { 'gia_tri.expiresAt': { $lte: now } },
          { 'gia_tri.isLocked': false },
          { 'gia_tri.lockedBy': workerId },
        ],
      },
      {
        $set: {
          'gia_tri.isLocked': true,
          'gia_tri.lockedBy': workerId,
          'gia_tri.acquiredAt': now,
          'gia_tri.expiresAt': expiresAt,
          nhom: 'SYSTEM',
          cap_nhat_luc: now,
        },
      },
      { new: true }
    );

    if (updated) {
      return true;
    }

    // Nếu không cập nhật được, kiểm tra xem bản ghi đã tồn tại trong CSDL chưa
    const existingDoc = await SystemConfig.findOne({ khoa_cau_hinh: normalizedKey }).select('_id gia_tri').lean();
    if (existingDoc) {
      // Bản ghi tồn tại và đang bị worker khác nắm giữ hợp lệ (chưa hết hạn)
      return false;
    }

    // Nếu bản ghi chưa từng tồn tại, tạo mới khóa lần đầu tiên
    try {
      await SystemConfig.create({
        khoa_cau_hinh: normalizedKey,
        gia_tri: {
          isLocked: true,
          lockedBy: workerId,
          acquiredAt: now,
          expiresAt: expiresAt,
        },
        nhom: 'SYSTEM',
        mo_ta: `Khóa phân tán cho tiến trình nền (${lockKey})`,
      });
      return true;
    } catch (insertError) {
      // Mã lỗi E11000: Có worker khác vừa tạo khóa đồng thời
      if (insertError.code === 11000) {
        return false;
      }
      throw insertError;
    }
  } catch (error) {
    console.error(`[DistributedLock] Lỗi khi giành khóa '${lockKey}':`, error.message);
    return false;
  }
};

/**
 * Giải phóng khóa phân tán (Release Lock)
 * Chỉ cho phép worker đang nắm giữ khóa giải phóng khóa của chính mình
 * 
 * @param {string} lockKey Tên định danh của khóa
 * @param {string} [workerId=DEFAULT_WORKER_ID] Mã worker yêu cầu giải phóng
 * @returns {Promise<boolean>} true nếu giải phóng thành công
 */
const releaseLock = async (lockKey, workerId = DEFAULT_WORKER_ID) => {
  if (!lockKey || typeof lockKey !== 'string') return false;
  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;
  const now = new Date();

  // 1. Chế độ Fallback In-Memory
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
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

  // 2. Chế độ MongoDB
  try {
    const res = await SystemConfig.updateOne(
      {
        khoa_cau_hinh: normalizedKey,
        'gia_tri.lockedBy': workerId,
      },
      {
        $set: {
          'gia_tri.isLocked': false,
          'gia_tri.releasedAt': now,
          cap_nhat_luc: now,
        },
      }
    );
    return res.modifiedCount > 0;
  } catch (error) {
    console.error(`[DistributedLock] Lỗi khi giải phóng khóa '${lockKey}':`, error.message);
    return false;
  }
};

/**
 * Wrapper thực thi tác vụ an toàn với Khóa Phân Tán
 * Tự động giành khóa -> Thực thi hàm tác vụ -> Tự động giải phóng khóa trong khối finally
 * 
 * @param {string} lockKey Tên định danh khóa
 * @param {number} ttlSeconds Thời gian khóa tối đa (giây)
 * @param {Function} taskFn Hàm async thực thi nghiệp vụ
 * @param {object} [options={}] Tùy chọn cấu hình ({ logPrefix, throwOnBusy, workerId })
 * @returns {Promise<any>} Kết quả trả về của taskFn, hoặc null nếu khóa đang bận
 */
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

/**
 * Lấy thông tin trạng thái khóa hiện tại
 * 
 * @param {string} lockKey 
 * @returns {Promise<object>}
 */
const getLockStatus = async (lockKey) => {
  const normalizedKey = `LOCK_${lockKey.toUpperCase().trim()}`;
  const now = new Date();

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
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

  const doc = await SystemConfig.findOne({ khoa_cau_hinh: normalizedKey }).lean();
  if (!doc || !doc.gia_tri) {
    return { isLocked: false, exists: false, storage: 'mongodb' };
  }

  const val = doc.gia_tri;
  const expiresAt = val.expiresAt ? new Date(val.expiresAt) : null;
  const isExpired = expiresAt && expiresAt <= now;

  return {
    isLocked: Boolean(val.isLocked) && !isExpired,
    lockedBy: val.lockedBy || null,
    acquiredAt: val.acquiredAt || null,
    expiresAt: expiresAt,
    isExpired,
    storage: 'mongodb',
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
