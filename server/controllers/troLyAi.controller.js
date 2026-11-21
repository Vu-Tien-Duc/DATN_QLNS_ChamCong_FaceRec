// Trợ lý AI: trò chuyện kèm ảnh/tài liệu (OCR, PDF, Word), truy xuất RAG và quản lý kho tài liệu
const { generateAIResponse, getGeminiChatModelChain, sanitizeModelName } = require('../services/ai/nhaCungCapAi.service');
const { buildAIContext, SUPPORTED_MODES } = require('../services/ai/nguCanhAi.service');
const { extractTextFromBuffer } = require('../services/ai/docTaiLieuAi.service');
const {
  ingestDocument,
  searchRelevantChunks,
  listDocuments,
  getDocumentById,
  deleteDocument,
  canManageSchoolDocuments,
} = require('../services/ai/khoTriThucRag.service');
const { loadConfigsIntoCache, getConfigSync } = require('../services/heThong/cauHinhHeThong.service');
const { NhatKyKiemToan } = require('../models');
const { hasAnyActiveRole, ROLES } = require('../utils/vaiTro.utils');

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

const syncAiRuntimeConfig = async () => {
  try {
    await loadConfigsIntoCache();
    for (const k of AI_CONFIG_KEYS) {
      const val = getConfigSync(k, undefined);
      if (val === undefined) {
        continue;
      }
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

const isAiAdminUser = (user) => hasAnyActiveRole(user, [ROLES.ADMIN, ROLES.BGH]);

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

  // Giới hạn tổng ký tự lịch sử (giữ các lượt gần nhất)
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

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

// Chuyển chuỗi JSON hoặc mảng thành mảng an toàn
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

// Khôi phục UTF-8 cho tên file upload bị Multer giải mã theo Latin-1
const decodeOriginalFilename = (name = 'tai_lieu') => {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
};

// POST /api/tro-ly-ai/tro-chuyen - Trò chuyện AI (hỗ trợ JSON và ảnh / PDF / Word đính kèm)
const chat = async (req, res) => {
  try {
    await syncAiRuntimeConfig();
    const body = req.body || {};
    const {
      tin_nhan: message,
      che_do: mode = 'hr_work',
      lich_su: history = [],
      nha_cung_cap: provider = null,
      mo_hinh: model = null,
      danh_sach_tai_lieu_id: documentIds = [],
      dung_rag: useRag = false,
    } = body;

    const uploadedFile = req.file || null;
    const rawMessage = typeof message === 'string' ? message.trim() : '';

    if (!rawMessage && !uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.',
      });
    }

    if (rawMessage.length > 3000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn vượt quá giới hạn cho phép (tối đa 3000 ký tự).',
      });
    }

    let safeProvider = null;
    if (provider !== null && provider !== undefined && String(provider).trim() !== '') {
      safeProvider = String(provider).trim().toLowerCase();
      if (!VALID_AI_PROVIDERS.has(safeProvider)) {
        return res.status(400).json({
          success: false,
          message: 'Nhà cung cấp AI (nha_cung_cap) không hợp lệ.',
        });
      }
    }

    let safeModel = null;
    if (model !== null && model !== undefined && String(model).trim() !== '') {
      safeModel = sanitizeModelName(model, null);
    }

    const userId = req.user?.id;
    const isAdmin = isAiAdminUser(req.user);
    const parsedHistory = sanitizeChatHistory(history);
    const parsedDocIds = parseJsonArray(documentIds);
    const shouldQueryRag =
      parsedDocIds.length > 0 ||
      useRag === true ||
      useRag === 'true' ||
      (mode === 'rag_doc' && !uploadedFile);

    let effectiveMessage = rawMessage;
    const attachments = [];
    let hasImageAttachment = false;
    let inlineDocument = null;
    let attachmentMeta = null;

    if (uploadedFile) {
      const safeFileName = decodeOriginalFilename(uploadedFile.originalname);
      const mime = String(uploadedFile.mimetype || '').toLowerCase();

      if (IMAGE_MIME_TYPES.has(mime)) {
        hasImageAttachment = true;
        attachments.push({
          mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
          data: uploadedFile.buffer.toString('base64'),
        });
        if (!effectiveMessage) {
          effectiveMessage =
            'Hãy đọc toàn bộ văn bản trong hình ảnh này và chuyển/dịch nội dung sang Tiếng Việt rõ ràng, dễ hiểu.';
        }
        attachmentMeta = {
          type: 'image',
          fileName: safeFileName,
          mimeType: mime,
          size: uploadedFile.size || uploadedFile.buffer.length,
        };
      } else {
        let parsedDoc;
        try {
          parsedDoc = await extractTextFromBuffer(uploadedFile.buffer, {
            originalname: safeFileName,
            mimetype: mime,
          });
        } catch (parseErr) {
          return res.status(400).json({
            success: false,
            message: parseErr.message || 'Không thể đọc tệp đính kèm. Tệp có thể bị hỏng hoặc sai định dạng.',
          });
        }

        if (parsedDoc.isLikelyScanned) {
          attachments.push({
            mimeType: 'application/pdf',
            data: uploadedFile.buffer.toString('base64'),
          });
          inlineDocument = {
            fileName: safeFileName,
            fileType: 'pdf',
            text: '',
            isScannedPdf: true,
          };
        } else {
          if (!parsedDoc.text || parsedDoc.text.length < 5) {
            return res.status(400).json({
              success: false,
              message: 'Không trích xuất được nội dung văn bản từ tệp đính kèm.',
            });
          }
          inlineDocument = {
            fileName: safeFileName,
            fileType: parsedDoc.fileType,
            text: parsedDoc.text,
            isScannedPdf: false,
          };
        }

        if (!effectiveMessage) {
          effectiveMessage =
            'Hãy phân tích nội dung tài liệu đính kèm và rút gọn những ý chính quan trọng nhất bằng Tiếng Việt.';
        }

        attachmentMeta = {
          type: 'document',
          fileName: safeFileName,
          fileType: parsedDoc.fileType,
          size: uploadedFile.size || uploadedFile.buffer.length,
          charCount: parsedDoc.text.length,
          isScannedPdf: parsedDoc.isLikelyScanned,
        };
      }
    }

    let ragChunks = [];
    if (shouldQueryRag) {
      ragChunks = await searchRelevantChunks({
        query: effectiveMessage,
        userId,
        documentIds: parsedDocIds,
        topK: 4,
      });
    }

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
      history: parsedHistory,
      attachments,
      provider: safeProvider,
      model: safeModel,
      mode: selectedMode,
      mockContext,
      ragChunks,
      inlineDocument,
      hasImageAttachment,
    });

    const sources = ragChunks.map((c) => ({
      documentId: c.documentId,
      title: c.title,
      page: c.so_trang_uoc_luong ?? null,
      chunkIndex: c.thu_tu,
      score: c.score,
    }));

    const responseData = {
      reply: aiResponse.text,
      mode: selectedMode,
      modeMeta,
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokens: aiResponse.tokens,
      sources,
      attachmentMeta,
    };
    if (isAdmin) {
      responseData.fallbackErrors = aiResponse.fallbackErrors || [];
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi khi xử lý chat:', error);
    const status = error.statusCode || error.status || 500;
    const isAdmin = isAiAdminUser(req.user);
    return res.status(status).json({
      success: false,
      message:
        status >= 500 && !isAdmin
          ? 'Có lỗi xảy ra khi xử lý phản hồi từ Trợ lý AI. Vui lòng thử lại sau.'
          : error.message || 'Có lỗi xảy ra khi xử lý phản hồi từ Trợ lý AI.',
      ...(isAdmin ? { error: error.message } : {}),
    });
  }
};

// GET /api/tro-ly-ai/che-do - Danh sách chế độ trợ lý AI
const getModes = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      modes: Object.values(SUPPORTED_MODES),
      quickPrompts: QUICK_PROMPTS,
      defaultMode: 'hr_work',
    },
  });
};

// GET /api/tro-ly-ai/nha-cung-cap - Danh sách mô hình/nhà cung cấp AI khả dụng
const getProviders = async (req, res) => {
  await syncAiRuntimeConfig();
  const providers = [
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
  ];

  return res.status(200).json({
    success: true,
    data: {
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'gemini',
      providers,
    },
  });
};

// GET /api/tro-ly-ai/tai-lieu - Danh sách tài liệu RAG được phép truy cập
const getDocuments = async (req, res) => {
  try {
    const documents = await listDocuments(req.user?.id);
    return res.status(200).json({
      success: true,
      data: {
        documents,
        canUploadSchoolWide: canManageSchoolDocuments(req.user),
      },
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi tải danh sách tài liệu RAG:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách tài liệu RAG.',
    });
  }
};

// POST /api/tro-ly-ai/tai-lieu - Tải lên và nạp tài liệu vào Kho tri thức RAG
const uploadDocument = async (req, res) => {
  try {
    await syncAiRuntimeConfig();
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn tệp tài liệu (PDF, DOCX, DOC, TXT, MD) cần tải lên.',
      });
    }

    const safeFileName = decodeOriginalFilename(req.file.originalname);
    const { tieu_de: title, pham_vi: scope = 'ca_nhan' } = req.body || {};

    const { document, isDuplicate } = await ingestDocument({
      buffer: req.file.buffer,
      originalname: safeFileName,
      mimetype: req.file.mimetype,
      title,
      scope,
      user: req.user,
    });

    if (!isDuplicate) {
      NhatKyKiemToan.create({
        nguoi_thuc_hien_id: req.user?.id || null,
        loai_chu_the: 'user',
        hanh_dong: 'UPLOAD_RAG_DOCUMENT',
        doi_tuong_id: String(document.id),
        loai_doi_tuong: 'tai_lieu_rag',
        dia_chi_ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        chi_tiet: {
          tieu_de: document.tieu_de,
          pham_vi: document.pham_vi,
          tong_so_doan: document.tong_so_doan,
          mo_hinh_embedding: document.mo_hinh_embedding,
        },
      }).catch((err) => console.error('[AI Controller] Lỗi ghi audit upload RAG:', err.message));
    }

    return res.status(isDuplicate ? 200 : 201).json({
      success: true,
      message: isDuplicate
        ? `Tài liệu "${document.tieu_de}" đã có sẵn trong Kho tri thức AI.`
        : 'Đã đọc và nạp tài liệu vào Kho tri thức AI thành công.',
      data: document,
      isDuplicate,
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi nạp tài liệu RAG:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể xử lý tài liệu tải lên.',
    });
  }
};

// GET /api/tro-ly-ai/tai-lieu/:id - Chi tiết tài liệu RAG
const getDocumentDetail = async (req, res) => {
  try {
    const limit = req.query?.gioi_han;
    const detail = await getDocumentById(req.params.id, req.user, { limit });
    return res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể lấy chi tiết tài liệu.',
    });
  }
};

// DELETE /api/tro-ly-ai/tai-lieu/:id - Xóa tài liệu khỏi kho tri thức RAG
const removeDocument = async (req, res) => {
  try {
    const deleted = await deleteDocument(req.params.id, req.user);
    NhatKyKiemToan.create({
      nguoi_thuc_hien_id: req.user?.id || null,
      loai_chu_the: 'user',
      hanh_dong: 'DELETE_RAG_DOCUMENT',
      doi_tuong_id: String(deleted.deletedId),
      loai_doi_tuong: 'tai_lieu_rag',
      dia_chi_ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      chi_tiet: { tieu_de: deleted.tieu_de },
    }).catch((err) => console.error('[AI Controller] Lỗi ghi audit delete RAG:', err.message));

    return res.status(200).json({
      success: true,
      message: `Đã xóa tài liệu "${deleted.tieu_de}" khỏi kho tri thức AI.`,
      data: deleted,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể xóa tài liệu.',
    });
  }
};

module.exports = {
  chat,
  getModes,
  getProviders,
  getDocuments,
  uploadDocument,
  getDocumentDetail,
  removeDocument,
};
