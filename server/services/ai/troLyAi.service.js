// Điều phối nghiệp vụ Trợ lý AI: đồng bộ cấu hình runtime, xử lý trò chuyện đa phương thức và quản lý kho RAG
const { generateAIResponse, getGeminiChatModelChain, sanitizeModelName } = require('./nhaCungCapAi.service');
const { buildAIContext, SUPPORTED_MODES } = require('./nguCanhAi.service');
const { extractTextFromBuffer } = require('./docTaiLieuAi.service');
const {
  ingestDocument,
  searchRelevantChunks,
  listDocuments,
  getDocumentById,
  deleteDocument,
  canManageSchoolDocuments,
} = require('./khoTriThucRag.service');
const { loadConfigsIntoCache, getConfigSync } = require('../heThong/cauHinhHeThong.service');
const { NhatKyKiemToan } = require('../../models');
const { hasAnyActiveRole, ROLES } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');

const AI_CONFIG_KEYS = [
  'AI_DEFAULT_PROVIDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
];

const VALID_AI_PROVIDERS = new Set(['gemini', 'groq', 'deepseek', 'offline_mock']);
const INITIAL_ENV_AI_CONFIG = Object.fromEntries(AI_CONFIG_KEYS.map((k) => [k, process.env[k] || '']));
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const QUICK_PROMPTS = {
  hr_work: [
    'Hôm nay tôi có lịch dạy những ca nào?',
    'Tôi còn lại bao nhiêu ngày phép năm?',
    'Xem giờ chấm công hôm nay của tôi',
    'Quy định về thời gian đi muộn và về sớm của trường',
  ],
  research: [
    'Gợi ý đề tài NCKH ngành CNTT ứng dụng Trí tuệ Nhân tạo',
    'Soạn đề cương chi tiết học phần Lập trình Web Hiện đại',
    'Tạo 5 câu hỏi trắc nghiệm thang đo Bloom bậc Vận dụng cao',
    'Hướng dẫn cấu trúc trích dẫn tài liệu học thuật chuẩn APA 7th',
  ],
  survey: [
    'Soạn bảng hỏi khảo sát chất lượng giảng dạy thang đo Likert 5 mức độ',
    'Thiết kế form lấy ý kiến sinh viên về cơ sở vật chất phòng thực hành',
    'Khảo sát nhu cầu đào tạo kỹ năng AI ứng dụng cho sinh viên năm cuối',
  ],
  rag_doc: [
    'Tóm tắt các quy định quan trọng nhất trong tài liệu đã chọn',
    'Rút gọn 5 ý chính của tài liệu vừa tải lên',
    'Trích xuất các mốc thời gian và điều kiện áp dụng trong tài liệu',
  ],
  general: [
    'Giải thích sự khác biệt giữa MongoDB và MySQL khi xử lý dữ liệu lớn',
    'Viết hàm xử lý debounce và throttle chuẩn TypeScript',
    'Gợi ý cách phân bổ thời gian hiệu quả giữa giảng dạy và nghiên cứu',
  ],
};

const isAiAdminUser = (user) => hasAnyActiveRole(user, [ROLES.ADMIN, ROLES.BGH]);

const syncAiRuntimeConfig = async () => {
  try {
    await loadConfigsIntoCache();
    for (const k of AI_CONFIG_KEYS) {
      const val = getConfigSync(k, undefined);
      if (val === undefined) continue;
      if (typeof val === 'string' && val.trim()) {
        process.env[k] = val.trim();
      } else if (INITIAL_ENV_AI_CONFIG[k]) {
        process.env[k] = INITIAL_ENV_AI_CONFIG[k];
      } else {
        delete process.env[k];
      }
    }
  } catch {
    // Bỏ qua nếu DB chưa sẵn sàng
  }
};

const parseJsonArray = (input) => {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const sanitizeChatHistory = (rawHistory) => {
  const MAX_TURNS = 10;
  const MAX_ITEM_CHARS = 2000;
  const MAX_TOTAL_CHARS = 12000;

  const recent = parseJsonArray(rawHistory).slice(-MAX_TURNS);
  const normalized = [];
  for (const item of recent) {
    if (!item || typeof item !== 'object') continue;
    const rawContent = typeof item.content === 'string' ? item.content : typeof item.text === 'string' ? item.text : '';
    const trimmed = rawContent.trim().slice(0, MAX_ITEM_CHARS);
    if (!trimmed) continue;
    const role = item.role === 'assistant' || item.role === 'model' ? 'assistant' : 'user';
    normalized.push({ role, content: trimmed });
  }

  let totalChars = 0;
  const bounded = [];
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const entry = normalized[i];
    if (totalChars + entry.content.length > MAX_TOTAL_CHARS) break;
    bounded.unshift(entry);
    totalChars += entry.content.length;
  }
  return bounded;
};

const decodeOriginalFilename = (name = 'tai_lieu') => {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
};

const prepareChatAttachment = async (uploadedFile, initialMessage) => {
  if (!uploadedFile) {
    return { effectiveMessage: initialMessage, attachments: [], hasImageAttachment: false, inlineDocument: null, attachmentMeta: null };
  }

  const safeFileName = decodeOriginalFilename(uploadedFile.originalname);
  const mime = String(uploadedFile.mimetype || '').toLowerCase();

  if (IMAGE_MIME_TYPES.has(mime)) {
    return {
      effectiveMessage:
        initialMessage ||
        'Hãy đọc toàn bộ văn bản trong hình ảnh này và chuyển/dịch nội dung sang Tiếng Việt rõ ràng, dễ hiểu.',
      attachments: [{ mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime, data: uploadedFile.buffer.toString('base64') }],
      hasImageAttachment: true,
      inlineDocument: null,
      attachmentMeta: {
        type: 'image',
        fileName: safeFileName,
        mimeType: mime,
        size: uploadedFile.size || uploadedFile.buffer.length,
      },
    };
  }

  let parsedDoc;
  try {
    parsedDoc = await extractTextFromBuffer(uploadedFile.buffer, { originalname: safeFileName, mimetype: mime });
  } catch (parseErr) {
    throw new ServiceError(parseErr.message || 'Không thể đọc tệp đính kèm. Tệp có thể bị hỏng hoặc sai định dạng.', 400);
  }

  if (!parsedDoc.isLikelyScanned && (!parsedDoc.text || parsedDoc.text.length < 5)) {
    throw new ServiceError('Không trích xuất được nội dung văn bản từ tệp đính kèm.', 400);
  }

  return {
    effectiveMessage:
      initialMessage ||
      'Hãy phân tích nội dung tài liệu đính kèm và rút gọn những ý chính quan trọng nhất bằng Tiếng Việt.',
    attachments: parsedDoc.isLikelyScanned
      ? [{ mimeType: 'application/pdf', data: uploadedFile.buffer.toString('base64') }]
      : [],
    hasImageAttachment: false,
    inlineDocument: {
      fileName: safeFileName,
      fileType: parsedDoc.isLikelyScanned ? 'pdf' : parsedDoc.fileType,
      text: parsedDoc.isLikelyScanned ? '' : parsedDoc.text,
      isScannedPdf: parsedDoc.isLikelyScanned,
    },
    attachmentMeta: {
      type: 'document',
      fileName: safeFileName,
      fileType: parsedDoc.fileType,
      size: uploadedFile.size || uploadedFile.buffer.length,
      charCount: parsedDoc.text.length,
      isScannedPdf: parsedDoc.isLikelyScanned,
    },
  };
};

// Xử lý lượt trò chuyện AI hoàn chỉnh (tin nhắn + đính kèm + RAG)
const processAiChat = async ({ body = {}, file = null, user }) => {
  await syncAiRuntimeConfig();
  const {
    tin_nhan: message,
    che_do: mode = 'hr_work',
    lich_su: history = [],
    nha_cung_cap: provider = null,
    mo_hinh: model = null,
    danh_sach_tai_lieu_id: documentIds = [],
    dung_rag: useRag = false,
  } = body;

  const rawMessage = typeof message === 'string' ? message.trim() : '';
  if (!rawMessage && !file) {
    throw new ServiceError('Nội dung tin nhắn không được để trống.', 400);
  }
  if (rawMessage.length > 3000) {
    throw new ServiceError('Nội dung tin nhắn vượt quá giới hạn cho phép (tối đa 3000 ký tự).', 400);
  }

  let safeProvider = null;
  if (provider !== null && provider !== undefined && String(provider).trim() !== '') {
    safeProvider = String(provider).trim().toLowerCase();
    if (!VALID_AI_PROVIDERS.has(safeProvider)) {
      throw new ServiceError('Nhà cung cấp AI (nha_cung_cap) không hợp lệ.', 400);
    }
  }

  const safeModel =
    model !== null && model !== undefined && String(model).trim() !== ''
      ? sanitizeModelName(model, null)
      : null;

  const userId = user?.id;
  const parsedDocIds = parseJsonArray(documentIds);
  const shouldQueryRag =
    parsedDocIds.length > 0 || useRag === true || useRag === 'true' || (mode === 'rag_doc' && !file);

  const { effectiveMessage, attachments, hasImageAttachment, inlineDocument, attachmentMeta } =
    await prepareChatAttachment(file, rawMessage);

  const ragChunks = shouldQueryRag
    ? await searchRelevantChunks({ query: effectiveMessage, userId, documentIds: parsedDocIds, topK: 4 })
    : [];

  const {
    mode: selectedMode,
    modeMeta,
    systemInstruction,
    enrichedPrompt,
    mockContext,
  } = await buildAIContext({
    userId,
    mode,
    prompt: effectiveMessage,
    ragChunks,
    inlineDocument,
    hasImageAttachment,
  });

  const aiResponse = await generateAIResponse({
    prompt: enrichedPrompt,
    systemInstruction,
    history: sanitizeChatHistory(history),
    attachments,
    provider: safeProvider,
    model: safeModel,
    mode: selectedMode,
    mockContext,
    ragChunks,
    inlineDocument,
    hasImageAttachment,
  });

  const responseData = {
    reply: aiResponse.text,
    mode: selectedMode,
    modeMeta,
    provider: aiResponse.provider,
    model: aiResponse.model,
    tokens: aiResponse.tokens,
    sources: ragChunks.map((c) => ({
      documentId: c.documentId,
      title: c.title,
      page: c.so_trang_uoc_luong ?? null,
      chunkIndex: c.thu_tu,
      score: c.score,
    })),
    attachmentMeta,
  };
  if (isAiAdminUser(user)) {
    responseData.fallbackErrors = aiResponse.fallbackErrors || [];
  }
  return responseData;
};

const getAvailableModes = () => ({
  modes: Object.values(SUPPORTED_MODES),
  quickPrompts: QUICK_PROMPTS,
  defaultMode: 'hr_work',
});

const getAvailableProviders = async () => {
  await syncAiRuntimeConfig();
  return {
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'gemini',
    providers: [
      {
        id: 'gemini',
        name: 'Google Gemini',
        model: getGeminiChatModelChain()[0],
        isConfigured: !!process.env.GEMINI_API_KEY,
        description: 'Mô hình AI đa phương thức của Google (hỗ trợ cả ảnh OCR & PDF scan)',
      },
      {
        id: 'groq',
        name: 'Groq Cloud',
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        isConfigured: !!process.env.GROQ_API_KEY,
        description: 'Suy luận tốc độ cao với mô hình Llama 3 mã nguồn mở',
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        isConfigured: !!process.env.DEEPSEEK_API_KEY,
        description: 'Mô hình lập trình và suy luận chi phí siêu tiết kiệm',
      },
      {
        id: 'offline_mock',
        name: 'Offline Mock Engine',
        model: 'rule-based-v1',
        isConfigured: true,
        description: 'Động cơ dự phòng nội bộ đối soát CSDL và trích lục tài liệu khi ngoại tuyến',
      },
    ],
  };
};

const getRagDocumentList = async (user) => ({
  documents: await listDocuments(user?.id),
  canUploadSchoolWide: canManageSchoolDocuments(user),
});

const uploadRagDocument = async ({ file, title, scope = 'ca_nhan', user, ipAddress }) => {
  await syncAiRuntimeConfig();
  if (!file) {
    throw new ServiceError('Vui lòng chọn tệp tài liệu (PDF, DOCX, DOC, TXT, MD) cần tải lên.', 400);
  }

  const { document, isDuplicate } = await ingestDocument({
    buffer: file.buffer,
    originalname: decodeOriginalFilename(file.originalname),
    mimetype: file.mimetype,
    title,
    scope,
    user,
  });

  if (!isDuplicate) {
    NhatKyKiemToan.create({
      nguoi_thuc_hien_id: user?.id || null,
      loai_chu_the: 'user',
      hanh_dong: 'UPLOAD_RAG_DOCUMENT',
      doi_tuong_id: String(document.id),
      loai_doi_tuong: 'tai_lieu_rag',
      dia_chi_ip: ipAddress || '127.0.0.1',
      chi_tiet: {
        tieu_de: document.tieu_de,
        pham_vi: document.pham_vi,
        tong_so_doan: document.tong_so_doan,
        mo_hinh_embedding: document.mo_hinh_embedding,
      },
    }).catch((err) => console.error('[AI Service] Lỗi ghi audit upload RAG:', err.message));
  }

  return { document, isDuplicate };
};

const removeRagDocument = async ({ id, user, ipAddress }) => {
  const deleted = await deleteDocument(id, user);
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user?.id || null,
    loai_chu_the: 'user',
    hanh_dong: 'DELETE_RAG_DOCUMENT',
    doi_tuong_id: String(deleted.deletedId),
    loai_doi_tuong: 'tai_lieu_rag',
    dia_chi_ip: ipAddress || '127.0.0.1',
    chi_tiet: { tieu_de: deleted.tieu_de },
  }).catch((err) => console.error('[AI Service] Lỗi ghi audit delete RAG:', err.message));

  return deleted;
};

module.exports = {
  isAiAdminUser,
  processAiChat,
  getAvailableModes,
  getAvailableProviders,
  getRagDocumentList,
  uploadRagDocument,
  getRagDocumentDetail: getDocumentById,
  removeRagDocument,
};
