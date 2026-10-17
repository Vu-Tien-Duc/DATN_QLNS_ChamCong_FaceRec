/**
 * AI Guardrails & Prompt Injection Protection Module
 * (server/services/ai/aiGuardrails.js)
 *
 * Chức năng:
 * 1. Phát hiện và ngăn chặn các hành vi tấn công Prompt Injection, Jailbreak, System Prompt Leakage.
 * 2. Lọc và khử trùng (Sanitize) câu hỏi đầu vào trước khi chuyển sang LLM.
 * 3. Kiểm soát dữ liệu nhạy cảm (Data Leakage Prevention / DLP Whitelist).
 */

const AuditLog = require('../../models/auditLog.model');

// Danh sách các mẫu biểu thức quy tắc nhận diện tấn công Prompt Injection & Jailbreak
const INJECTION_PATTERNS = [
  // 1. Chỉ thị ép hủy / ghi đè System Prompt (Instruction Override)
  {
    regex: /(?:bỏ\s*qua|quên|xóa|hủy|lờ\s*đi)\s*(?:hết|tất\s*cả|mọi)?\s*(?:hướng\s*dẫn|chỉ\s*thị|quy\s*tắc|câu\s*lệnh|prompt|yêu\s*cầu)\s*(?:trước|trước\s*đó|ban\s*đầu|hệ\s*thống)?/i,
    category: 'INSTRUCTION_OVERRIDE',
    reason: 'Phát hiện câu lệnh cố tình yêu cầu bỏ qua hoặc ghi đè hướng dẫn hệ thống.',
  },
  {
    regex: /(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|commands|directives)/i,
    category: 'INSTRUCTION_OVERRIDE_EN',
    reason: 'Phát hiện câu lệnh Instruction Override bằng tiếng Anh.',
  },

  // 2. Yêu cầu trích xuất Prompt hệ thống hoặc Khóa bảo mật (System Prompt & Secret Extraction)
  {
    regex: /(?:in\s*ra|hiển\s*thị|cho\s*(?:tôi\s*)?xem|xuất|tiết\s*lộ|trích\s*xuất)\s*(?:toàn\s*bộ\s*)?(?:system\s*prompt|prompt\s*hệ\s*thống|chỉ\s*thị\s*hệ\s*thống|hướng\s*dẫn\s*gốc|prompt\s*gốc|câu\s*lệnh\s*gốc)/i,
    category: 'PROMPT_LEAK_ATTEMPT',
    reason: 'Phát hiện hành vi cố tình trích xuất System Prompt hoặc mã nguồn cấu hình của AI.',
  },
  {
    regex: /(?:show|reveal|display|output|print|repeat)\s+(?:your\s+)?(?:system\s*prompt|initial\s*instructions|base\s*prompt|hidden\s*rules)/i,
    category: 'PROMPT_LEAK_ATTEMPT_EN',
    reason: 'Phát hiện yêu cầu trích xuất System Prompt bằng tiếng Anh.',
  },

  // 3. Đóng vai nhằm vượt quyền bảo mật (Jailbreak / Persona Masquerade)
  {
    regex: /(?:hãy\s*đóng\s*vai|bạn\s*là|hãy\s*giả\s*vờ\s*là|từ\s*bây\s*giờ\s*bạn\s*là)\s*(?:admin\s*tối\s*cao|root|superuser|hacker|dan\s*mode|chế\s*độ\s*không\s*giới\s*hạn)/i,
    category: 'JAILBREAK_MASQUERADE',
    reason: 'Phát hiện hành vi đóng vai (Role-play Masquerade) nhằm vượt rào bảo mật.',
  },
  {
    regex: /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:dan|developer\s+mode|unrestricted|jailbreak|root|god\s+mode)/i,
    category: 'JAILBREAK_MASQUERADE_EN',
    reason: 'Phát hiện mẫu Jailbreak / DAN mode bằng tiếng Anh.',
  },

  // 4. Dò tìm mật khẩu băm, mã token, khóa bí mật hoặc dữ liệu tuyệt mật
  {
    regex: /(?:mật\s*khẩu|password|pass_hash|mat_khau|jwt_secret|api_key|private_key|token_family|refresh_token)\s*(?:của|của\s*tất\s*cả|của\s*người\s*dùng|của\s*admin|của\s*hiệu\s*trưởng)/i,
    category: 'SENSITIVE_CREDENTIAL_SEEKING',
    reason: 'Phát hiện hành vi dò hỏi mật khẩu, khóa bảo mật hoặc mã token của người dùng khác.',
  },

  // 5. Thẻ điều khiển mô hình (LLM Control Tokens Injection)
  {
    regex: /(?:<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>)/i,
    category: 'CONTROL_TOKEN_INJECTION',
    reason: 'Phát hiện thẻ điều khiển đặc biệt của LLM (Control Tokens Injection).',
  },

  // 6. NoSQL Injection dạng $where hoặc toán tử truy vấn MongoDB
  {
    regex: /(?:\$where|\$regex|\$gt|\$ne|\$nin|\$expr)\s*:/i,
    category: 'NOSQL_INJECTION_PATTERN',
    reason: 'Phát hiện mẫu toán tử NoSQL Injection.',
  },
];

/**
 * Kiểm tra xem câu hỏi có chứa dấu hiệu tấn công Prompt Injection hoặc Jailbreak hay không
 * @param {string} text
 * @returns {{ isSuspicious: boolean, category?: string, reason?: string, matchedPattern?: string }}
 */
const detectPromptInjection = (text = '') => {
  if (!text || typeof text !== 'string') {
    return { isSuspicious: false };
  }

  const clean = text.trim();

  for (const item of INJECTION_PATTERNS) {
    if (item.regex.test(clean)) {
      return {
        isSuspicious: true,
        category: item.category,
        reason: item.reason,
      };
    }
  }

  return { isSuspicious: false };
};

/**
 * Khử trùng dữ liệu văn bản đầu vào của người dùng trước khi ghép vào prompt
 * @param {string} text
 * @returns {string} Chuỗi văn bản đã được làm sạch
 */
const sanitizePromptInput = (text = '') => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<\|.*?\|>/g, '') // Xóa control tokens
    .replace(/\[\/?INST\]/gi, '') // Xóa thẻ Llama instruction
    .replace(/<<\/?SYS>>/gi, '') // Xóa thẻ Llama system
    .trim();
};

/**
 * Lọc và bảo vệ dữ liệu (Data Leakage Prevention / DLP Whitelist)
 * Chỉ giữ lại các trường an toàn trước khi đưa vào context thống kê cho LLM
 * @param {Object} data Dữ liệu thống kê hoặc danh sách người dùng
 * @returns {Object} Dữ liệu đã loại bỏ hoàn toàn các trường nhạy cảm
 */
const sanitizeContextData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const FORBIDDEN_FIELDS = [
    'password',
    'mat_khau',
    'passwordResetToken',
    'refreshToken',
    'token',
    'phien_ban_token',
    'faceDescriptors',
    'vector_trung_binh',
    'du_lieu_ma_hoa',
    'vector_trung_binh_ma_hoa',
    'so_cccd',
    'tai_khoan_ngan_hang',
    'ngan_hang',
    'jwtSecret',
    'apiKey',
  ];

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContextData(item));
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_FIELDS.includes(key)) {
      continue; // Bỏ qua trường cấm
    }
    if (value && typeof value === 'object') {
      clean[key] = sanitizeContextData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

/**
 * Ghi vết Audit Log khi phát hiện tấn công Prompt Injection
 * @param {Object} params
 */
const logPromptInjectionAttempt = async ({ user, question, detectionResult, ip = null, userAgent = null }) => {
  try {
    await AuditLog.create({
      actor: user?._id || user?.id || null,
      actorType: user ? 'USER' : 'SYSTEM',
      action: 'SECURITY_ALERT_PROMPT_INJECTION',
      targetType: 'AiSecurityGuardrail',
      targetId: 'AI_PROMPT_INJECTION_BLOCKED',
      status: 'FAILED',
      ipAddress: ip,
      userAgent,
      details: {
        category: detectionResult.category,
        reason: detectionResult.reason,
        attemptedQuery: question ? question.substring(0, 300) : '',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Không làm sập ứng dụng nếu ghi audit log lỗi
    console.error('[AiGuardrails] Ghi nhật ký bảo mật thất bại:', err.message);
  }
};

module.exports = {
  detectPromptInjection,
  sanitizePromptInput,
  sanitizeContextData,
  logPromptInjectionAttempt,
};
