// Giới hạn tần suất gọi API (Rate Limit): dùng Redis khi cấu hình REDIS_URL và tự fallback sang MemoryStore
const rateLimit = require('express-rate-limit');
const { MemoryStore } = rateLimit;
const net = require('net');

// Lấy địa chỉ IP gốc của client
const extractClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

// Chuẩn hóa địa chỉ IP (chuyển IPv4-mapped hoặc gom subnet IPv6 /64) để tính rate limit
const getRateLimitIp = (req) => {
  const ip = extractClientIp(req);
  if (/^::ffff:\d{1,3}(?:\.\d{1,3}){3}$/i.test(ip)) {
    return ip.slice(7);
  }
  if (!net.isIPv6(ip)) {
    return ip;
  }

  const [left, right = ''] = ip.toLowerCase().split('::');
  const leftGroups = left ? left.split(':') : [];
  const rightGroups = right ? right.split(':') : [];
  const missingGroups = 8 - leftGroups.length - rightGroups.length;
  const groups = [...leftGroups, ...Array(missingGroups).fill('0'), ...rightGroups];
  return `${groups.slice(0, 4).join(':')}::/64`;
};

// Kiểm tra request có xuất phát từ môi trường local hoặc dev/test
const isLocalOrDev = (req) => {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return true;
  const ip = getRateLimitIp(req);
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
};

let redisClientInitialized = false;
let sharedRedisClient = null;
let RedisStoreCtor = null;
let redisStoreHealthy = true;
const rateLimitStores = new Map();

const initRateLimitRedisClient = () => {
  if (redisClientInitialized) return sharedRedisClient;
  redisClientInitialized = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const { RedisStore } = require('rate-limit-redis');
    RedisStoreCtor = RedisStore;
    let client;
    try {
      const { createClient } = require('redis');
      client = createClient({ url: redisUrl });
      if (typeof client.on === 'function') {
        client.on('error', () => { redisStoreHealthy = false; });
        client.on('ready', () => { redisStoreHealthy = true; });
      }
      client.connect().catch((err) => {
        redisStoreHealthy = false;
        console.warn('[RateLimiter] Cảnh báo kết nối Redis server, fallback sang MemoryStore:', err.message);
      });
    } catch {
      const Redis = require('ioredis');
      client = new Redis(redisUrl, { lazyConnect: true });
      if (typeof client.on === 'function') {
        client.on('error', () => { redisStoreHealthy = false; });
        client.on('ready', () => { redisStoreHealthy = true; });
      }
    }
    sharedRedisClient = client;
    console.log('[RateLimiter] Đã khởi tạo thành công Redis Client phân tán cho Rate Limiter.');
    return sharedRedisClient;
  } catch {
    console.info('[RateLimiter] Driver Redis Store không khả dụng trong môi trường này, chuyển sang MemoryStore (In-Memory).');
    return null;
  }
};

// Tạo Redis Store độc lập kèm fallback tự động sang MemoryStore khi Redis lỗi kết nối
const getRateLimitStore = (scope = 'default') => {
  const client = initRateLimitRedisClient();
  if (!client || !RedisStoreCtor) {
    return undefined;
  }
  const normalizedScope = String(scope || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (rateLimitStores.has(normalizedScope)) {
    return rateLimitStores.get(normalizedScope);
  }
  const fallbackMemoryStore = new MemoryStore();
  const redisStore = new RedisStoreCtor({
    sendCommand: (...args) =>
      typeof client.sendCommand === 'function' ? client.sendCommand(args) : client.call(...args),
    prefix: `rl:${normalizedScope}:`,
  });
  const resilientStore = {
    prefix: redisStore.prefix,
    init(options) {
      if (typeof fallbackMemoryStore.init === 'function') fallbackMemoryStore.init(options);
      if (typeof redisStore.init === 'function') redisStore.init(options);
    },
    async increment(key) {
      if (!redisStoreHealthy) return fallbackMemoryStore.increment(key);
      try {
        return await redisStore.increment(key);
      } catch {
        return fallbackMemoryStore.increment(key);
      }
    },
    async decrement(key) {
      if (!redisStoreHealthy) return fallbackMemoryStore.decrement(key);
      try {
        return await redisStore.decrement(key);
      } catch {
        return fallbackMemoryStore.decrement(key);
      }
    },
    async resetKey(key) {
      if (!redisStoreHealthy) return fallbackMemoryStore.resetKey(key);
      try {
        return await redisStore.resetKey(key);
      } catch {
        return fallbackMemoryStore.resetKey(key);
      }
    },
  };
  rateLimitStores.set(normalizedScope, resilientStore);
  return resilientStore;
};

// Khóa giới hạn đăng nhập theo cặp IP + định danh đăng nhập (email hoặc mã cán bộ)
const getLoginRateKey = (req) => {
  const ip = getRateLimitIp(req);
  const rawIdentifier = req.body?.email || req.body?.ma_can_bo || '';
  const identifier = rawIdentifier ? String(rawIdentifier).toLowerCase().trim().slice(0, 254) : 'anonymous';
  return `login_${ip}_${identifier}`;
};

// Khóa giới hạn AI chat ưu tiên theo ID người dùng đang đăng nhập
const getAiChatRateKey = (req) => {
  const userId = req.user?.id || req.user?.ma_can_bo;
  if (userId) return `ai_chat_user_${userId}`;
  return `ai_chat_ip_${getRateLimitIp(req)}`;
};

// Giới hạn quét khuôn mặt: tối đa 30 lượt/phút (dev/local: 200)
const faceCheckInRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 200 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('face_checkin'),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Máy chấm công Face ID đã vượt giới hạn quét/phút. Vui lòng thử lại sau ít phút.',
      errorCode: 'FACE_CHECKIN_RATE_LIMIT_EXCEEDED',
      data: null,
    }),
});

// Giới hạn riêng cho luồng phát hiện tư thế đầu 3D realtime (không dùng chung quota chấm công)
const facePoseRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 1500 : 600),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('face_pose'),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Luồng phân tích tư thế khuôn mặt đang quá tải, vui lòng chờ giây lát.',
      errorCode: 'FACE_POSE_RATE_LIMIT_EXCEEDED',
      data: null,
    }),
});

// Giới hạn đăng nhập sai: tối đa 5 lần / 15 phút (dev/local: 50), không đếm lần đăng nhập đúng
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 50 : 5),
  skipSuccessfulRequests: true,
  keyGenerator: getLoginRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('login'),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Tài khoản này đã đăng nhập sai quá số lần quy định (5 lần). Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

// Giới hạn hỏi Trợ lý AI: tối đa 30 câu / phút (dev/local: 100)
const aiChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 100 : 30),
  keyGenerator: getAiChatRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('ai_chat'),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã gửi yêu cầu quá nhanh tới Trợ lý AI (vượt ngưỡng 30 câu hỏi/phút). Vui lòng chờ 1 phút.',
      errorCode: 'AI_CHAT_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

// Giới hạn tải tệp lên: tối đa 30 tệp / phút (dev/local: 200)
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 200 : 30),
  keyGenerator: (req) => (req.user?.id ? `upload_user_${req.user.id}` : `upload_ip_${getRateLimitIp(req)}`),
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('file_upload'),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn tải tệp lên quá nhanh. Vui lòng thử lại sau ít phút.',
      errorCode: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

// Giới hạn đổi mật khẩu / OTP: tối đa 5 lần / 15 phút (dev/local: 30)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 30 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('password_reset'),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thực hiện thao tác đổi mật khẩu quá số lần cho phép. Vui lòng thử lại sau 15 phút.',
      errorCode: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

// Giới hạn chung toàn API: tối đa 300 request / 15 phút trên mỗi IP (dev/local: 3000)
const apiGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 3000 : 300),
  skip: (req) => req.path === '/khuon-mat/phat-hien-tu-the',
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('api_general'),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Lưu lượng yêu cầu từ mạng của bạn vượt mức cho phép. Vui lòng thử lại sau ít phút.',
      errorCode: 'API_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

module.exports = {
  getRateLimitIp,
  getRateLimitStore,
  isLocalOrDev,
  loginLimiter,
  faceCheckInRateLimit,
  facePoseRateLimit,
  aiChatRateLimit,
  uploadRateLimit,
  passwordResetLimiter,
  apiGeneralLimiter,
};
