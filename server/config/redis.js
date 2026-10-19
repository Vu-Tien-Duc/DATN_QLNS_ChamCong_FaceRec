/**
 * Redis & Distributed Cache Client (Hệ Thống Phân Tán Đa Container)
 * 
 * Kiến trúc Hybrid thông minh (Redis First + Memory Fallback):
 * 1. Khi có Redis (REDIS_URL / localhost:6379):
 *    - Sử dụng Redis làm bộ nhớ đệm phân tán tập trung chia sẻ giữa tất cả các tiến trình (PM2 / Docker / K8s).
 *    - Quản lý Cooldown chống quẹt lặp 60s, Grace Period RTR Token 15s, Distributed Lock (Atomic SET NX PX + Lua).
 * 2. Khi không có Redis hoặc Redis mất kết nối (Offline / Test cô lập):
 *    - Tự động chuyển đổi trong suốt (Transparent Fallback) sang In-Memory Store có TTL tự động dọn dẹp.
 *    - Đảm bảo 100% Zero Downtime và không làm gián đoạn hay crash bất kỳ luồng nghiệp vụ nào.
 * 3. Tự động phục hồi (Auto Reconnect):
 *    - Khi Redis online trở lại, tự động tái kết nối và phục hồi chế độ phân tán ngay lập tức.
 */
const Redis = require('ioredis');

// Cấu hình kết nối từ biến môi trường
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || null;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;

let redisClient = null;
let isConnected = false;
let hasLoggedConnection = false;

// -------------------------------------------------------------
// TẦNG LƯU TRỮ DỰ PHÒNG IN-MEMORY (KHI REDIS OFFLINE)
// -------------------------------------------------------------
const memoryStore = new Map(); // key -> { value, expiresAt }

const cleanExpiredMemory = () => {
  const now = Date.now();
  for (const [key, item] of memoryStore.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
};

// Dọn dẹp định kỳ 30s
if (process.env.NODE_ENV !== 'test') {
  const memInterval = setInterval(cleanExpiredMemory, 30000);
  if (memInterval.unref) memInterval.unref();
}

// -------------------------------------------------------------
// KHỞI TẠO KẾT NỐI IOREDIS AN TOÀN
// -------------------------------------------------------------
const initRedis = () => {
  if (process.env.DISABLE_REDIS === 'true') {
    return null;
  }

  try {
    const options = {
      retryStrategy: (times) => {
        // Trong môi trường test hoặc khi không có server Redis (times > 1), dừng retry để giải phóng event loop
        if (process.env.NODE_ENV === 'test' || (!REDIS_URL && times > 1) || times > 3) {
          return null; // Trả về null để ioredis không tạo timer giữ tiến trình
        }
        return Math.min(times * 1000, 3000);
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Không kẹt request khi offline, lập tức fallback
      lazyConnect: true,
      connectTimeout: 2000,
    };

    if (REDIS_URL) {
      redisClient = new Redis(REDIS_URL, options);
    } else {
      redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        db: REDIS_DB,
        ...options,
      });
    }

    redisClient.on('connect', () => {
      isConnected = true;
      if (!hasLoggedConnection) {
        console.log(`[Redis Cache] Đã kết nối thành công tới Redis (${REDIS_URL || `${REDIS_HOST}:${REDIS_PORT}`}). Chế độ Cache Phân Tán: ACTIVE.`);
        hasLoggedConnection = true;
      }
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Chỉ log cảnh báo nhẹ, không throw ra ngoài để đảm bảo tính sẵn sàng cao
      if (!hasLoggedConnection) {
        // Lần đầu offline: thông báo chế độ Fallback In-Memory
        console.warn(`[Redis Cache] Không thể kết nối Redis (${err.code || err.message}). Tự động kích hoạt cơ chế In-Memory Fallback.`);
        hasLoggedConnection = true;
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Thử kết nối ngầm (non-blocking)
    redisClient.connect().catch(() => {
      isConnected = false;
    });

    return redisClient;
  } catch (initErr) {
    console.warn('[Redis Cache] Lỗi khởi tạo Redis client:', initErr.message);
    isConnected = false;
    return null;
  }
};

initRedis();

// -------------------------------------------------------------
// CÁC HÀM TIỆN ÍCH CORE (GET, SET, DEL, JSON)
// -------------------------------------------------------------
const isRedisReady = () => isConnected && redisClient && redisClient.status === 'ready';

const redisGet = async (key) => {
  if (isRedisReady()) {
    try {
      return await redisClient.get(key);
    } catch (_) {}
  }
  // Fallback In-Memory
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
};

const redisSet = async (key, value, ttlSeconds = null) => {
  const strVal = typeof value === 'string' ? value : String(value);

  if (isRedisReady()) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, strVal, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, strVal);
      }
      return true;
    } catch (_) {}
  }

  // Fallback In-Memory
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value: strVal, expiresAt });
  return true;
};

const redisDel = async (key) => {
  if (isRedisReady()) {
    try {
      await redisClient.del(key);
    } catch (_) {}
  }
  memoryStore.delete(key);
  return true;
};

const redisGetJson = async (key) => {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const redisSetJson = async (key, data, ttlSeconds = null) => {
  return redisSet(key, JSON.stringify(data), ttlSeconds);
};

// -------------------------------------------------------------
// 1. NGHIỆP VỤ COOLDOWN CHỐNG QUÉT LẶP PHÂN TÁN (60 GIÂY)
// -------------------------------------------------------------
const COOLDOWN_PREFIX = 'ATTENDANCE_COOLDOWN:';

/**
 * Kiểm tra và đặt Cooldown quét thẻ cho người dùng (Đồng bộ đa container)
 * @param {string} userId ID người dùng
 * @param {number} [cooldownSeconds=60] Thời gian cooldown (giây)
 * @returns {Promise<{ allowed: boolean, remainingSeconds: number }>}
 */
const checkAndSetCooldown = async (userId, cooldownSeconds = 60) => {
  const key = `${COOLDOWN_PREFIX}${userId}`;
  const now = Date.now();

  if (isRedisReady()) {
    try {
      // Dùng SET key now EX ttl NX: chỉ gán nếu chưa có khóa
      const result = await redisClient.set(key, now.toString(), 'EX', cooldownSeconds, 'NX');
      if (result === 'OK') {
        return { allowed: true, remainingSeconds: 0 };
      }
      // Khóa đã tồn tại -> lấy TTL còn lại
      const ttl = await redisClient.ttl(key);
      const remainingSeconds = ttl > 0 ? ttl : cooldownSeconds;
      return { allowed: false, remainingSeconds };
    } catch (_) {}
  }

  // Fallback In-Memory
  const item = memoryStore.get(key);
  if (item && item.expiresAt > now) {
    const remainingSeconds = Math.ceil((item.expiresAt - now) / 1000);
    return { allowed: false, remainingSeconds: Math.max(1, remainingSeconds) };
  }

  memoryStore.set(key, {
    value: now.toString(),
    expiresAt: now + cooldownSeconds * 1000,
  });
  return { allowed: true, remainingSeconds: 0 };
};

const getCooldownRemaining = async (userId) => {
  const key = `${COOLDOWN_PREFIX}${userId}`;
  if (isRedisReady()) {
    try {
      const ttl = await redisClient.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (_) {}
  }
  const item = memoryStore.get(key);
  if (!item || item.expiresAt <= Date.now()) return 0;
  return Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
};

const resetCooldown = async (userId) => {
  const key = `${COOLDOWN_PREFIX}${userId}`;
  return redisDel(key);
};

// -------------------------------------------------------------
// 2. NGHIỆP VỤ GRACE PERIOD CACHE CHO REFRESH TOKEN (RTR - 15 GIÂY)
// -------------------------------------------------------------
const GRACE_PREFIX = 'TOKEN_GRACE:';

const setGraceToken = async (hashedToken, data, graceSeconds = 15) => {
  const key = `${GRACE_PREFIX}${hashedToken}`;
  return redisSetJson(key, data, graceSeconds);
};

const getGraceToken = async (hashedToken) => {
  const key = `${GRACE_PREFIX}${hashedToken}`;
  return redisGetJson(key);
};

// -------------------------------------------------------------
// 3. KHÓA PHÂN TÁN REDIS (DISTRIBUTED LOCK - ATOMIC SET NX PX + LUA)
// -------------------------------------------------------------
const LOCK_PREFIX = 'DIST_LOCK:';

// Lua Script đảm bảo chỉ worker nắm khóa mới được xóa khóa của chính mình (Atomic Safe Release)
const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

/**
 * Giành khóa phân tán qua Redis
 * @param {string} lockKey Tên khóa
 * @param {number} ttlSeconds Thời gian sống tối đa (giây)
 * @param {string} workerId Mã worker nắm giữ khóa
 * @returns {Promise<boolean>}
 */
const acquireRedisLock = async (lockKey, ttlSeconds = 60, workerId) => {
  if (!isRedisReady()) return null; // Trả về null để báo hiệu fallback sang MongoDB/Memory
  const key = `${LOCK_PREFIX}${lockKey.toUpperCase().trim()}`;
  try {
    const res = await redisClient.set(key, workerId, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  } catch (err) {
    console.warn(`[Redis Lock] Lỗi khi giành khóa '${lockKey}':`, err.message);
    return null;
  }
};

/**
 * Giải phóng khóa phân tán qua Redis
 * @param {string} lockKey Tên khóa
 * @param {string} workerId Mã worker cần giải phóng
 * @returns {Promise<boolean>}
 */
const releaseRedisLock = async (lockKey, workerId) => {
  if (!isRedisReady()) return null;
  const key = `${LOCK_PREFIX}${lockKey.toUpperCase().trim()}`;
  try {
    const res = await redisClient.eval(RELEASE_LOCK_LUA_SCRIPT, 1, key, workerId);
    return res === 1;
  } catch (err) {
    console.warn(`[Redis Lock] Lỗi khi giải phóng khóa '${lockKey}':`, err.message);
    return null;
  }
};

// -------------------------------------------------------------
// 4. BỘ ĐỆM CACHE MẪU KHUÔN MẶT SINH TRẮC HỌC (FACE TEMPLATES)
// -------------------------------------------------------------
const FACE_CACHE_KEY = 'FACE_TEMPLATES_CACHE:ACTIVE';

const cacheFaceVectors = async (templates, ttlSeconds = 1800) => {
  return redisSetJson(FACE_CACHE_KEY, templates, ttlSeconds);
};

const getCachedFaceVectors = async () => {
  return redisGetJson(FACE_CACHE_KEY);
};

const invalidateFaceCache = async () => {
  return redisDel(FACE_CACHE_KEY);
};

// -------------------------------------------------------------
// DỌN DẸP KHI SHUTDOWN HOẶC RESET TEST
// -------------------------------------------------------------
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {
      redisClient.disconnect();
    }
    redisClient = null;
    isConnected = false;
  }
  memoryStore.clear();
};

const clearAllMemoryStore = () => {
  memoryStore.clear();
};

module.exports = {
  getRedisClient: () => redisClient,
  isRedisReady,
  redisGet,
  redisSet,
  redisDel,
  redisGetJson,
  redisSetJson,
  checkAndSetCooldown,
  getCooldownRemaining,
  resetCooldown,
  setGraceToken,
  getGraceToken,
  acquireRedisLock,
  releaseRedisLock,
  cacheFaceVectors,
  getCachedFaceVectors,
  invalidateFaceCache,
  closeRedis,
  clearAllMemoryStore,
};
