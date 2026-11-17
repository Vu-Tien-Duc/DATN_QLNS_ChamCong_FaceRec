// Bộ đệm Redis kèm dự phòng In-Memory: ưu tiên Redis khi online; tự chuyển In-Memory TTL khi offline
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || null;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;

let redisClient = null;
let isConnected = false;
let hasLoggedConnection = false;

// Bộ nhớ dự phòng trong RAM khi Redis chưa sẵn sàng
const memoryStore = new Map();

// Dọn các khóa bộ nhớ tạm đã hết hạn
const cleanExpiredMemory = () => {
  const now = Date.now();
  for (const [key, item] of memoryStore.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
};

if (process.env.NODE_ENV !== 'test') {
  const memInterval = setInterval(cleanExpiredMemory, 30000);
  if (memInterval.unref) memInterval.unref();
}

// Khởi tạo kết nối Redis hoặc tự động chuyển sang bộ nhớ cục bộ nếu lỗi
const initRedis = () => {
  if (process.env.DISABLE_REDIS === 'true') {
    return null;
  }

  try {
    const options = {
      retryStrategy: (times) => {
        if (process.env.NODE_ENV === 'test' || (!REDIS_URL && times > 1) || times > 3) {
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
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
      if (!hasLoggedConnection) {
        console.warn(`[Redis Cache] Không thể kết nối Redis (${err.code || err.message}). Tự động kích hoạt cơ chế In-Memory Fallback.`);
        hasLoggedConnection = true;
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

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

// Kiểm tra Redis đang sẵn sàng
const isRedisReady = () => isConnected && redisClient && redisClient.status === 'ready';

// Đọc chuỗi từ Redis (fallback về RAM nếu Redis offline)
const redisGet = async (key) => {
  if (isRedisReady()) {
    try {
      return await redisClient.get(key);
    } catch (_) {}
  }
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
};

// Ghi chuỗi vào Redis hoặc RAM kèm thời hạn TTL
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

  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value: strVal, expiresAt });
  return true;
};

// Xóa khóa khỏi Redis và RAM
const redisDel = async (key) => {
  if (isRedisReady()) {
    try {
      await redisClient.del(key);
    } catch (_) {}
  }
  memoryStore.delete(key);
  return true;
};

// Đọc dữ liệu JSON từ Redis hoặc RAM
const redisGetJson = async (key) => {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

// Lưu dữ liệu JSON vào Redis hoặc RAM kèm thời hạn TTL
const redisSetJson = async (key, data, ttlSeconds = null) => {
  return redisSet(key, JSON.stringify(data), ttlSeconds);
};

// Cooldown chống quét chấm công lặp trong N giây (mặc định 60s)
const COOLDOWN_PREFIX = 'ATTENDANCE_COOLDOWN:';

// Kiểm tra và đặt thời gian chờ (cooldown) chống quét lặp
const checkAndSetCooldown = async (userId, cooldownSeconds = 60) => {
  const key = `${COOLDOWN_PREFIX}${userId}`;
  const now = Date.now();

  if (isRedisReady()) {
    try {
      const result = await redisClient.set(key, now.toString(), 'EX', cooldownSeconds, 'NX');
      if (result === 'OK') {
        return { allowed: true, remainingSeconds: 0 };
      }
      const ttl = await redisClient.ttl(key);
      const remainingSeconds = ttl > 0 ? ttl : cooldownSeconds;
      return { allowed: false, remainingSeconds };
    } catch (_) {}
  }

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

// Lấy số giây cooldown còn lại của người dùng
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

// Xóa trạng thái cooldown của người dùng
const resetCooldown = async (userId) => {
  const key = `${COOLDOWN_PREFIX}${userId}`;
  return redisDel(key);
};

// Lưu tạm cặp token mới trong 15s khi xoay vòng Refresh Token (tránh race condition đa request)
const GRACE_PREFIX = 'TOKEN_GRACE:';

// Lưu cặp token mới trong grace period để tránh lỗi khi gửi nhiều request làm mới song song
const setGraceToken = async (hashedToken, data, graceSeconds = 15) => {
  const key = `${GRACE_PREFIX}${hashedToken}`;
  return redisSetJson(key, data, graceSeconds);
};

// Lấy cặp token đang nằm trong grace period
const getGraceToken = async (hashedToken) => {
  const key = `${GRACE_PREFIX}${hashedToken}`;
  return redisGetJson(key);
};

// Xóa token khỏi grace period
const deleteGraceToken = async (hashedToken) => {
  if (!hashedToken) return false;
  const key = `${GRACE_PREFIX}${hashedToken}`;
  return redisDel(key);
};

// Khóa phân tán Redis dùng SET NX EX và Lua script để mở khóa đúng chủ sở hữu
const LOCK_PREFIX = 'DIST_LOCK:';

const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

// Giành khóa phân tán trên Redis
const acquireRedisLock = async (lockKey, ttlSeconds = 60, workerId) => {
  if (!isRedisReady()) return null;
  const key = `${LOCK_PREFIX}${lockKey.toUpperCase().trim()}`;
  try {
    const res = await redisClient.set(key, workerId, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  } catch (err) {
    console.warn(`[Redis Lock] Lỗi khi giành khóa '${lockKey}':`, err.message);
    return null;
  }
};

// Giải phóng khóa phân tán đúng chủ sở hữu qua Lua script
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

// Cache vector khuôn mặt phục vụ nhận diện
const FACE_CACHE_KEY = 'FACE_TEMPLATES_CACHE:ACTIVE';

// Lưu cache danh sách vector khuôn mặt vào Redis
const cacheFaceVectors = async (templates, ttlSeconds = 1800) => {
  return redisSetJson(FACE_CACHE_KEY, templates, ttlSeconds);
};

// Đọc cache danh sách vector khuôn mặt từ Redis
const getCachedFaceVectors = async () => {
  return redisGetJson(FACE_CACHE_KEY);
};

// Xóa cache vector khuôn mặt
const invalidateFaceCache = async () => {
  return redisDel(FACE_CACHE_KEY);
};

// Đóng kết nối Redis và dọn bộ nhớ tạm
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

// Xóa sạch dữ liệu trong bộ nhớ tạm (dùng cho test)
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
  deleteGraceToken,
  acquireRedisLock,
  releaseRedisLock,
  cacheFaceVectors,
  getCachedFaceVectors,
  invalidateFaceCache,
  closeRedis,
  clearAllMemoryStore,
};
