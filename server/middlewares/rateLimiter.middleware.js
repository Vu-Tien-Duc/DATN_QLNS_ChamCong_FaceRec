/**
 * Middleware Giới Hạn Tần Suất Yêu Cầu (Adaptive Rate Limiter)
 * Hỗ trợ linh hoạt đa môi trường:
 * - Khi có REDIS_URL và thư viện kết nối: Tự động dùng RedisStore phân tán (Multi-Instance/Cluster).
 * - Khi không có REDIS_URL hoặc lỗi kết nối: Tự động Graceful Fallback sang In-Memory Store,
 *   đảm bảo hệ thống vận hành trơn tru 100% trong môi trường dev, test và demo bảo vệ đồ án.
 */
const rateLimit = require('express-rate-limit');
const net = require('net');

const extractClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

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

const isLocalOrDev = (req) => {
  if (process.env.NODE_ENV === 'development') return true;
  const ip = getRateLimitIp(req);
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
};

/**
 * Tạo Store cho Rate Limiter:
 * - Nếu có REDIS_URL và thư viện hỗ trợ: Tạo RedisStore phân tán.
 * - Ngược lại: Tự động dùng MemoryStore mặc định.
 */
let redisStoreInstance = null;
let redisInitialized = false;

const getRateLimitStore = () => {
  if (redisInitialized) return redisStoreInstance;
  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return undefined; // Mặc định MemoryStore
  }

  try {
    const { RedisStore } = require('rate-limit-redis');
    let client;
    try {
      const { createClient } = require('redis');
      client = createClient({ url: redisUrl });
      client.connect().catch((err) => {
        console.warn('[RateLimiter] Cảnh báo kết nối Redis server, fallback sang MemoryStore:', err.message);
      });
    } catch {
      const Redis = require('ioredis');
      client = new Redis(redisUrl, { lazyConnect: true });
    }

    redisStoreInstance = new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
      prefix: 'rl:',
    });
    console.log('[RateLimiter] Đã khởi tạo thành công Redis Store phân tán cho Rate Limiter.');
    return redisStoreInstance;
  } catch (err) {
    console.info('[RateLimiter] Driver Redis Store không khả dụng trong môi trường này, chuyển sang MemoryStore (In-Memory).');
    return undefined;
  }
};

/**
 * Key generator cho xác thực đăng nhập:
 * Kết hợp IP và email để không bị chặn lẫn nhau khi nhiều cán bộ/giảng viên dùng chung mạng/máy tính
 */
const getLoginRateKey = (req) => {
  const ip = getRateLimitIp(req);
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim().slice(0, 254) : 'anonymous';
  return `login_${ip}_${email}`;
};

/**
 * Key generator cho Trợ lý AI:
 * Định danh ưu tiên theo UserId đã xác thực, nếu là khách thì dùng IP
 */
const getAiChatRateKey = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.staffCode;
  if (userId) return `ai_chat_user_${userId}`;
  return `ai_chat_ip_${getRateLimitIp(req)}`;
};

/**
 * 1. Giới hạn request theo IP để bảo vệ endpoint nhận diện khuôn mặt:
 * Tối đa 15 lần quét / phút (chống spam camera stream hoặc brute-force vector).
 */
const faceCheckInRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore(),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Máy chấm công Face ID đã vượt giới hạn 15 lần quét/phút. Vui lòng thử lại sau ít phút.',
      errorCode: 'FACE_CHECKIN_RATE_LIMIT_EXCEEDED',
      data: null,
    }),
});

/**
 * 2. Giới hạn đăng nhập: Tối đa 5 lần ĐĂNG NHẬP SAI trong vòng 15 phút.
 * - skipSuccessfulRequests: true -> Đăng nhập thành công KHÔNG bị tính là lần thử thất bại.
 * - keyGenerator: Phân biệt theo tài khoản email để tránh chặn nhầm người dùng khác trên cùng mạng LAN/NAT.
 * - Môi trường localhost / dev cho phép tối đa 50 lần để thuận tiện kiểm thử.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 50 : 5),
  skipSuccessfulRequests: true,
  keyGenerator: getLoginRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore(),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Tài khoản này đã đăng nhập sai quá số lần quy định (5 lần). Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * 3. Giới hạn gọi Trợ lý AI (AI Chat & Analytics):
 * Bảo vệ quota Token LLM (Gemini/Claude/DeepSeek) và chống spam DoS API AI.
 * Tối đa 30 câu hỏi / phút (Dev: 100 câu / phút).
 */
const aiChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 100 : 30),
  keyGenerator: getAiChatRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore(),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã gửi yêu cầu quá nhanh tới Trợ lý AI (vượt ngưỡng 30 câu hỏi/phút). Vui lòng chờ 1 phút.',
      errorCode: 'AI_CHAT_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * 4. Giới hạn đổi mật khẩu / Khôi phục tài khoản:
 * Tối đa 5 lần / 15 phút để chống tấn công dò mật khẩu cũ.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 30 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore(),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thực hiện thao tác đổi mật khẩu quá số lần cho phép. Vui lòng thử lại sau 15 phút.',
      errorCode: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * 5. Giới hạn bảo vệ chung API (General Limiter):
 * Tối đa 300 requests / 15 phút trên mỗi IP (Dev: 3000 requests / 15 phút).
 */
const apiGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 3000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  store: getRateLimitStore(),
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
  isLocalOrDev,
  loginLimiter,
  faceCheckInRateLimit,
  aiChatRateLimit,
  passwordResetLimiter,
  apiGeneralLimiter,
};
