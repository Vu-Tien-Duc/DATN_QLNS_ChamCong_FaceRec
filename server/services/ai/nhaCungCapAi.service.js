/**
 * Multi-Model AI Provider Adapter (AI Gateway)
 * Hỗ trợ đa mô hình AI: Google Gemini, Groq (Llama 3), DeepSeek, cùng cơ chế tự phục hồi (Failover).
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính - ĐH Nguyễn Trãi
 */

const DEFAULT_TIMEOUT_MS = 25000;

const getGeminiChatModelChain = (explicitModel = null) =>
  Array.from(
    new Set(
      [
        explicitModel,
        process.env.GEMINI_MODEL,
        'gemini-2.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
      ].filter(Boolean)
    )
  );

const getDefaultEmbeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

/**
 * 1. Gọi Google Gemini API (Hỗ trợ đa phương thức Ảnh/PDF Vision qua attachments inline_data)
 */
const callGemini = async ({
  prompt,
  systemInstruction = '',
  history = [],
  attachments = [],
  apiKey,
  model = getGeminiChatModelChain()[0],
  temperature = 0.7,
  maxTokens = 2048,
}) => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY.');
  }

  // Sử dụng endpoint REST và truyền key qua header x-goog-api-key (hỗ trợ cả key dạng mới AQ.* và key AIzaSy*)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Chuẩn hóa contents theo cấu trúc Gemini REST API
  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      const text = msg.content || msg.text || '';
      if (text.trim()) {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  const userParts = [{ text: prompt }];
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      if (att?.mimeType && att?.data) {
        userParts.push({
          inline_data: {
            mime_type: att.mimeType,
            data: att.data,
          },
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: userParts,
  });

  const requestBody = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemInstruction && systemInstruction.trim()) {
    requestBody.system_instruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(attachments?.length > 0 ? 45000 : DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi Gemini API (${response.status}): ${response.statusText}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.provider = 'gemini';
    throw err;
  }

  const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!replyText) {
    throw new Error('Gemini API không trả về nội dung hợp lệ.');
  }

  return {
    text: replyText.trim(),
    provider: 'gemini',
    model,
    tokens: data?.usageMetadata?.totalTokenCount || null,
  };
};

/**
 * 1.1. Tạo vector nhúng văn bản qua Gemini Embedding API (mặc định: gemini-embedding-001)
 * Trả về mảng số hoặc null nếu chưa cấu hình API key / gặp lỗi kết nối (an toàn cho fallback từ khóa)
 */
const embedTextWithGemini = async ({ text, apiKey, model } = {}) => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key || !text || !String(text).trim()) {
    return null;
  }

  const targetModel = model || getDefaultEmbeddingModel();
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:embedContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        model: `models/${targetModel}`,
        content: {
          parts: [{ text: String(text).slice(0, 8000) }],
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn(
        `[AI Embedding Warning] Model ${targetModel} trả mã ${response.status}: ${errData?.error?.message || response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) && values.length > 0 ? values : null;
  } catch (err) {
    console.warn(`[AI Embedding Warning] Lỗi kết nối khi gọi ${targetModel}:`, err.message);
    return null;
  }
};

/**
 * Tạo vector hàng loạt cho các đoạn văn bản RAG (đồng bộ 100% hoặc fallback đồng nhất về keyword_only)
 */
const embedBatchWithGemini = async (texts = [], { apiKey, model, maxChunks = 250 } = {}) => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const targetModel = model || getDefaultEmbeddingModel();

  if (!key || !Array.isArray(texts) || texts.length === 0 || texts.length > maxChunks) {
    return {
      embeddings: texts.map(() => null),
      modelUsed: 'keyword_only',
    };
  }

  const results = new Array(texts.length).fill(null);
  const concurrency = 4;

  for (let i = 0; i < texts.length; i += concurrency) {
    const slice = texts.slice(i, i + concurrency);
    const batchEmbeddings = await Promise.all(
      slice.map((t) => embedTextWithGemini({ text: t, apiKey: key, model: targetModel }))
    );
    for (let j = 0; j < batchEmbeddings.length; j += 1) {
      results[i + j] = batchEmbeddings[j];
    }
    // Nếu có đoạn thất bại (lỗi key/hết quota), dừng sớm và giữ đồng nhất keyword_only cho cả tài liệu
    if (batchEmbeddings.some((v) => !Array.isArray(v) || v.length === 0)) {
      return {
        embeddings: texts.map(() => null),
        modelUsed: 'keyword_only',
      };
    }
  }

  return {
    embeddings: results,
    modelUsed: targetModel,
  };
};

/**
 * 2. Gọi Groq Cloud API (Llama-3.3-70b-versatile / Llama-3.1-8b-instant)
 */
const callGroq = async ({ prompt, systemInstruction = '', history = [], apiKey, model = 'llama-3.3-70b-versatile', temperature = 0.7, maxTokens = 2048 }) => {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Chưa cấu hình GROQ_API_KEY.');
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [];
  if (systemInstruction && systemInstruction.trim()) {
    messages.push({ role: 'system', content: systemInstruction.trim() });
  }

  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      const role = msg.role === 'model' ? 'assistant' : (msg.role || 'user');
      const content = msg.content || msg.text || '';
      if (content.trim()) {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: 'user', content: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi Groq API (${response.status}): ${response.statusText}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.provider = 'groq';
    throw err;
  }

  const replyText = data?.choices?.[0]?.message?.content;
  if (!replyText) {
    throw new Error('Groq API không trả về nội dung hợp lệ.');
  }

  return {
    text: replyText.trim(),
    provider: 'groq',
    model,
    tokens: data?.usage?.total_tokens || null,
  };
};

/**
 * 3. Gọi DeepSeek / OpenRouter API
 */
const callDeepSeek = async ({ prompt, systemInstruction = '', history = [], apiKey, model = 'deepseek-chat', temperature = 0.7, maxTokens = 2048 }) => {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error('Chưa cấu hình DEEPSEEK_API_KEY.');
  }

  const endpoint = 'https://api.deepseek.com/chat/completions';

  const messages = [];
  if (systemInstruction && systemInstruction.trim()) {
    messages.push({ role: 'system', content: systemInstruction.trim() });
  }

  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      const role = msg.role === 'model' ? 'assistant' : (msg.role || 'user');
      const content = msg.content || msg.text || '';
      if (content.trim()) {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: 'user', content: prompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi DeepSeek API (${response.status}): ${response.statusText}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.provider = 'deepseek';
    throw err;
  }

  const replyText = data?.choices?.[0]?.message?.content;
  if (!replyText) {
    throw new Error('DeepSeek API không trả về nội dung hợp lệ.');
  }

  return {
    text: replyText.trim(),
    provider: 'deepseek',
    model,
    tokens: data?.usage?.total_tokens || null,
  };
};

/**
 * 4. Phản hồi thông minh dự phòng khi Offline / Dev Mode
 */
const callOfflineMock = ({
  prompt,
  systemInstruction = '',
  mode = 'hr_work',
  mockContext = null,
  ragChunks = [],
  inlineDocument = null,
  hasImageAttachment = false,
}) => {
  let reply = '';
  try {
    const { getSmartMockReply } = require('./nguCanhAi.service');
    reply = getSmartMockReply({
      prompt,
      mode,
      mockContext,
      ragChunks,
      inlineDocument,
      hasImageAttachment,
    });
  } catch (err) {
    const lower = prompt.toLowerCase();
    if (lower.includes('lịch') || lower.includes('tiết') || lower.includes('phòng')) {
      reply = 'Dạ thưa Thầy/Cô, hệ thống ghi nhận Thầy/Cô có lịch giảng dạy trong ngày tại phòng học được phân công. Vui lòng kiểm tra mục Thời khóa biểu trên thanh menu để xem chi tiết từng tiết học.';
    } else if (lower.includes('phép') || lower.includes('nghỉ')) {
      reply = 'Dạ thưa Thầy/Cô, hạn mức nghỉ phép năm của cán bộ/giảng viên được quy định là 12 ngày/năm. Thầy/Cô có thể tạo đơn nghỉ phép trực tuyến tại mục Đơn nghỉ phép để Trưởng khoa phê duyệt.';
    } else if (lower.includes('lương') || lower.includes('thuế')) {
      reply = 'Dạ bảng lương của Thầy/Cô được tổng hợp tự động hàng tháng dựa trên hệ số lương, phụ cấp chức vụ, thù lao vượt giờ giảng và biểu thuế TNCN 5 bậc năm 2026.';
    } else {
      reply = `Dạ chào Thầy/Cô! Em là Trợ lý ảo Đại học Nguyễn Trãi. Em đã nhận được câu hỏi: "${prompt}". Hệ thống sẵn sàng hỗ trợ Thầy/Cô tra cứu thông tin công tác, soạn thảo bài giảng và nghiên cứu khoa học.`;
    }
  }

  return {
    text: reply,
    provider: 'offline_mock',
    model: 'rule-based-v1',
    tokens: 0,
  };
};

/**
 * 5. Bộ điều phối chính tự động phục hồi lỗi (Automatic Failover Gateway)
 * Thứ tự ưu tiên: Provider được chỉ định -> Gemini -> Groq -> DeepSeek -> Offline Mock
 * Lưu ý: Nếu có đính kèm Ảnh hoặc PDF Scan (attachments), tự động ưu tiên Gemini Multimodal Vision.
 */
const generateAIResponse = async ({
  prompt,
  systemInstruction = '',
  history = [],
  attachments = [],
  provider = null,
  model = null,
  mode = 'hr_work',
  mockContext = null,
  ragChunks = [],
  inlineDocument = null,
  hasImageAttachment = false,
  temperature = 0.7,
  maxTokens = 2048,
}) => {
  const hasMultimodalAttachments = Array.isArray(attachments) && attachments.length > 0;
  const preferred = hasMultimodalAttachments
    ? 'gemini'
    : provider || process.env.AI_DEFAULT_PROVIDER || 'gemini';
  const availableProviders = [];

  // Xác định các provider có sẵn key
  if (preferred === 'gemini' || process.env.GEMINI_API_KEY) availableProviders.push('gemini');
  if (!hasMultimodalAttachments && (preferred === 'groq' || process.env.GROQ_API_KEY)) {
    availableProviders.push('groq');
  }
  if (!hasMultimodalAttachments && (preferred === 'deepseek' || process.env.DEEPSEEK_API_KEY)) {
    availableProviders.push('deepseek');
  }

  // Đưa provider ưu tiên lên đầu danh sách (bỏ trùng)
  const executionOrder = Array.from(new Set([preferred, ...availableProviders]));

  const errors = [];

  for (const currentProvider of executionOrder) {
    try {
      if (currentProvider === 'gemini' && process.env.GEMINI_API_KEY) {
        const geminiModels = getGeminiChatModelChain(model);
        let lastGeminiErr = null;
        for (const candidateModel of geminiModels) {
          try {
            return await callGemini({
              prompt,
              systemInstruction,
              history,
              attachments,
              model: candidateModel,
              temperature,
              maxTokens,
            });
          } catch (geminiErr) {
            lastGeminiErr = geminiErr;
            // Nếu khóa API sai/hết quyền (401/403), không cần thử tiếp các model Gemini khác
            if (geminiErr.status === 401 || geminiErr.status === 403) {
              throw geminiErr;
            }
            console.warn(
              `[AI Gateway Warning] Model Gemini "${candidateModel}" gặp lỗi (${geminiErr.message}), thử model dự phòng...`
            );
          }
        }
        if (lastGeminiErr) throw lastGeminiErr;
      }
      if (!hasMultimodalAttachments && currentProvider === 'groq' && process.env.GROQ_API_KEY) {
        return await callGroq({ prompt, systemInstruction, history, model: model || 'llama-3.3-70b-versatile', temperature, maxTokens });
      }
      if (!hasMultimodalAttachments && currentProvider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
        return await callDeepSeek({ prompt, systemInstruction, history, model: model || 'deepseek-chat', temperature, maxTokens });
      }
    } catch (err) {
      console.warn(`[AI Gateway Warning] Nhà cung cấp ${currentProvider} gặp lỗi (${err.message}). Đang chuyển đổi dự phòng...`);
      errors.push({ provider: currentProvider, error: err.message });
    }
  }

  // Nếu tất cả provider thất bại hoặc chưa có API Key -> Kích hoạt chế độ Offline Mock
  console.log('[AI Gateway] Tất cả kết nối API ngoài không khả dụng, chuyển sang chế độ dự phòng Offline Mock.');
  const mockResult = callOfflineMock({
    prompt,
    systemInstruction,
    mode,
    mockContext,
    ragChunks,
    inlineDocument,
    hasImageAttachment,
  });
  mockResult.fallbackErrors = errors;
  return mockResult;
};

module.exports = {
  getGeminiChatModelChain,
  getDefaultEmbeddingModel,
  callGemini,
  embedTextWithGemini,
  embedBatchWithGemini,
  callGroq,
  callDeepSeek,
  callOfflineMock,
  generateAIResponse,
};

