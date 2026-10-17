/**
 * AI Response Service (server/services/ai/aiResponse.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Hỗ trợ đa nhà cung cấp LLM: Google Gemini, Anthropic Claude, DeepSeek, Local LLM / Ollama.
 * - Cơ sở tri thức Quy chế Nhà trường & Nghiệp vụ đào tạo đại học năm 2026 (RAG & Knowledge Base).
 * - Tự động dự phòng thông minh (Fallback) sang Knowledge Engine nội bộ khi không có API key hoặc mất mạng.
 */
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * 1. BỘ TRI THỨC QUY CHẾ NHÀ TRƯỜNG & ĐÀO TẠO ĐẠI HỌC (CHUẨN NĂM 2026)
 */
const UNIVERSITY_POLICY_KNOWLEDGE = {
  cham_cong: {
    title: 'Quy Chế Chấm Công & Ca Làm Việc',
    noi_dung: [
      '- **Ca Sáng (Hành chính / Giảng dạy):** Khung giờ chuẩn 07:00 - 11:30. Check-in hợp lệ từ 06:45 đến 07:15. Sau 07:15 tính là Đi Muộn. Check-out hợp lệ sau 11:30. Trước 11:30 tính là Về Sớm.',
      '- **Ca Chiều (Hành chính / Giảng dạy):** Khung giờ chuẩn 13:00 - 17:00. Check-in hợp lệ từ 12:45 đến 13:15. Sau 13:15 tính là Đi Muộn. Check-out hợp lệ sau 17:00. Trước 17:00 tính là Về Sớm.',
      '- **Quên Check-out:** Hệ thống tự động ghi nhận cờ `isMissingCheckOut = true`, không làm mất số phút đi muộn ban đầu.',
      '- **Bán kính GPS hợp lệ:** Trụ sở chính trường $150\\text{m}$ (`GEOFENCE_TRUONG`), phòng học cụ thể $30\\text{m}$ (`DANH_SACH_PHONG_HOC`). Vi phạm bán kính sẽ bị đánh dấu cờ gian lận `isFraud = true`.',
    ],
  },
  nghi_phep: {
    title: 'Quy Chế Nghỉ Phép & Phê Duyệt Đa Cấp',
    noi_dung: [
      '- **Hạn mức phép năm:** 12 ngày phép hưởng nguyên lương/năm cho cán bộ, giảng viên tiêu chuẩn. Mỗi 5 năm thâm niên được cộng thêm 1 ngày.',
      '- **Phân cấp phê duyệt:**',
      '  + Nghỉ từ **1 đến 3 ngày:** Trưởng khoa (hoặc Phó trưởng khoa được ủy quyền) phê duyệt Cấp 1 (`APPROVED`).',
      '  + Nghỉ **trên 3 ngày:** Bắt buộc duyệt 2 cấp (Cấp 1: Trưởng khoa sơ duyệt -> Cấp 2: Ban Giám Hiệu phê duyệt cuối cùng).',
      '  + Đơn của Trưởng khoa/Phó khoa: Chuyển thẳng lên Ban Giám Hiệu (Hiệu trưởng/Hiệu phó) phê duyệt.',
      '- **Chặn tự duyệt đơn:** Bất kỳ ai làm đơn (kể cả Trưởng khoa hay BGH) đều tuyệt đối không được tự phê duyệt đơn của chính mình.',
      '- **Đăng ký dạy bù:** Giảng viên nghỉ tiết dạy chính khóa bắt buộc phải nộp đơn dạy bù (`day_bu`) nêu rõ ngày dạy bù (`makeupDate`).',
    ],
  },
  gio_giang: {
    title: 'Quy Định Định Mức Giờ Chuẩn Giảng Dạy & Giờ Vượt',
    noi_dung: [
      '- **Định mức chuẩn:** 135 giờ chuẩn/học kỳ (tương đương 45 giờ chuẩn/tháng đối với giảng viên chuẩn).',
      '- **Đơn giá giờ vượt:** 120.000 VNĐ/giờ chuẩn vượt định mức (`DON_GIA_GIO_VUOT`).',
      '- **Giảm trừ định mức chức vụ:** Trưởng khoa giảm 30%, Phó trưởng khoa giảm 25%, Trưởng bộ môn giảm 20% định mức giờ giảng.',
    ],
  },
  tien_luong_thue: {
    title: 'Quy Định Tiền Lương & Thuế TNCN Năm 2026',
    noi_dung: [
      '- **Lương cơ sở năm 2026:** 2.530.000 VNĐ (`LUONG_CO_SO`). Lương chính = Hệ số lương $\\times$ 2.530.000đ.',
      '- **Phụ cấp chức vụ:** Hiệu trưởng 1.3, Hiệu phó 1.1, Trưởng khoa 0.9, Phó khoa 0.7, Trưởng bộ môn 0.5.',
      '- **Phụ cấp ưu đãi nghề giáo dục:** 30% tính trên tổng (Lương chính + Phụ cấp chức vụ).',
      '- **Bảo hiểm bắt buộc (10.5%):** BHXH 8%, BHYT 1.5%, BHTN 1%.',
      '- **Giảm trừ gia cảnh:** Bản thân 15.500.000 VNĐ/tháng, người phụ thuộc 6.200.000 VNĐ/tháng/người.',
      '- **Biểu thuế TNCN lũy tiến 5 bậc:** Bậc 1 (đến 10tr: 5%), Bậc 2 (10-30tr: 10% - 500k), Bậc 3 (30-60tr: 20% - 3.5tr), Bậc 4 (60-100tr: 28% - 8.3tr), Bậc 5 (trên 100tr: 35% - 15.3tr).',
      '- **Khóa lương:** Khi bảng lương được khóa sổ (`DA_KHOA`), hệ thống tự động khóa bảng chấm công (`da_chot = true`), cấm mọi hành vi sửa đổi lương hay giờ công.',
    ],
  },
  face_ai: {
    title: 'Tiêu Chuẩn Công Nghệ Nhận Diện Khuôn Mặt (Face AI)',
    noi_dung: [
      '- **Mô hình AI:** ArcFace InsightFace (`buffalo_s`) trích xuất đặc trưng vector 512 chiều.',
      '- **Đăng ký 5 góc chuẩn hóa L2:** 5 tư thế quay đầu (Chính diện, Nghiêng trái, Nghiêng phải, Ngửa lên, Cúi xuống).',
      '- **Bộ lọc chênh lệch (Margin Top 1 - Top 2):** Khi so khớp $1:N$, biên độ tương đồng $\\text{Sim}(\\text{Top 1}) - \\text{Sim}(\\text{Top 2}) \\ge 0.05$. Nếu nhỏ hơn $0.05$, hệ thống từ chối với lý do `AMBIGUOUS_MATCH`.',
      '- **Cooldown chống quét lặp:** 60 giây (`COOLDOWN_QUET_GIAY = 60`), ngăn chặn đứng trước camera quét nhiều lần sinh nhiều log thừa.',
      '- **Kiểm tra Liveness:** Đo góc Euler 3D (Yaw, Pitch, Roll) và phát hiện ảnh giả mạo qua màn hình điện thoại/video.',
    ],
  },
};

/**
 * Tra cứu tri thức quy chế nhà trường tự động dựa trên từ khóa câu hỏi
 */
const lookupUniversityRegulation = (question) => {
  const q = (question || '').toLowerCase();
  const matched = [];

  if (q.includes('chấm công') || q.includes('đi muộn') || q.includes('về sớm') || q.includes('quên') || q.includes('ca sáng') || q.includes('ca chiều') || q.includes('gps') || q.includes('bán kính')) {
    matched.push(UNIVERSITY_POLICY_KNOWLEDGE.cham_cong);
  }
  if (q.includes('nghỉ') || q.includes('phép') || q.includes('duyệt') || q.includes('dạy bù') || q.includes('đổi ca') || q.includes('hạn mức')) {
    matched.push(UNIVERSITY_POLICY_KNOWLEDGE.nghi_phep);
  }
  if (q.includes('giờ giảng') || q.includes('định mức') || q.includes('vượt giờ') || q.includes('thù lao') || q.includes('tiết dạy')) {
    matched.push(UNIVERSITY_POLICY_KNOWLEDGE.gio_giang);
  }
  if (q.includes('lương') || q.includes('thuế') || q.includes('thu nhập') || q.includes('bảo hiểm') || q.includes('phụ cấp') || q.includes('bhxh') || q.includes('giảm trừ')) {
    matched.push(UNIVERSITY_POLICY_KNOWLEDGE.tien_luong_thue);
  }
  if (q.includes('khuôn mặt') || q.includes('nhận diện') || q.includes('face') || q.includes('camera') || q.includes('cooldown') || q.includes('5 góc') || q.includes('margin')) {
    matched.push(UNIVERSITY_POLICY_KNOWLEDGE.face_ai);
  }

  if (matched.length === 0) {
    // Nếu hỏi chung chung về quy chế, trả về tổng quan
    return Object.values(UNIVERSITY_POLICY_KNOWLEDGE);
  }
  return matched;
};

/**
 * 2. KẾT NỐI ĐA NHÀ CUNG CẤP LLM (GEMINI, CLAUDE, DEEPSEEK, LOCAL LLM/OLLAMA)
 */

// A. Google Gemini
const callGemini = async ({ prompt, systemPrompt, model = 'gemini-1.5-flash', apiKey }) => {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    return null;
  }
};

// B. DeepSeek API (OpenAI Compatible)
const callDeepSeek = async ({ prompt, systemPrompt, model = 'deepseek-chat', apiKey }) => {
  const activeKey = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!activeKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    return null;
  }
};

// C. Anthropic Claude API
const callClaude = async ({ prompt, systemPrompt, model = 'claude-3-5-sonnet-20241022', apiKey }) => {
  const activeKey = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!activeKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': activeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data?.content?.[0]?.text || null;
  } catch (err) {
    return null;
  }
};

// D. Local LLM / Ollama (OpenAI Compatible Endpoint)
const callLocalLlm = async ({ prompt, systemPrompt, endpoint, model = 'llama3:8b' }) => {
  const localUrl = endpoint || process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    return null;
  }
};

/**
 * Bộ định tuyến LLM đa nhà cung cấp (Multi-Provider Router)
 */
const routeLlmRequest = async ({ prompt, systemPrompt, provider = 'auto', model, apiKey }) => {
  const targetProvider = provider.toLowerCase();

  if (targetProvider === 'deepseek') {
    const res = await callDeepSeek({ prompt, systemPrompt, model: model || 'deepseek-chat', apiKey });
    if (res) return { text: res, provider: 'DeepSeek' };
  } else if (targetProvider === 'claude' || targetProvider === 'anthropic') {
    const res = await callClaude({ prompt, systemPrompt, model: model || 'claude-3-5-sonnet-20241022', apiKey });
    if (res) return { text: res, provider: 'Claude' };
  } else if (targetProvider === 'local' || targetProvider === 'ollama') {
    const res = await callLocalLlm({ prompt, systemPrompt, model: model || 'llama3:8b' });
    if (res) return { text: res, provider: 'Local LLM (Ollama)' };
  } else if (targetProvider === 'gemini') {
    const res = await callGemini({ prompt, systemPrompt, model: model || 'gemini-1.5-flash', apiKey });
    if (res) return { text: res, provider: 'Google Gemini' };
  } else {
    // Mode 'auto': Thử lần lượt các API Key có sẵn trong môi trường
    if (process.env.DEEPSEEK_API_KEY) {
      const res = await callDeepSeek({ prompt, systemPrompt, model: 'deepseek-chat', apiKey });
      if (res) return { text: res, provider: 'DeepSeek' };
    }
    if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) {
      const res = await callClaude({ prompt, systemPrompt, model: 'claude-3-5-sonnet-20241022', apiKey });
      if (res) return { text: res, provider: 'Claude' };
    }
    if (process.env.GEMINI_API_KEY || apiKey) {
      const res = await callGemini({ prompt, systemPrompt, model: model || 'gemini-1.5-flash', apiKey });
      if (res) return { text: res, provider: 'Google Gemini' };
    }
    // Thử Local LLM nếu có
    const localRes = await callLocalLlm({ prompt, systemPrompt, model });
    if (localRes) return { text: localRes, provider: 'Local LLM (Ollama)' };
  }

  return null;
};

/**
 * 3. FALLBACK ENGINE: TRẢ LỜI SỐ LIỆU CHẤM CÔNG CĂN CỨ VÀO MONGODB
 */
const generateFallbackResponse = ({
  intent,
  question,
  dateRange,
  targetUser,
  department,
  statistics,
  error,
  unauthorizedReason,
  isAmbiguous,
  ambiguousMatches,
}) => {
  if (unauthorizedReason) {
    return `### ⛔ Từ Chối Quyền Truy Cập\n\n${unauthorizedReason}\n\n*Hệ thống quản lý áp dụng phân quyền ma trận 10 vai trò trường đại học để bảo mật dữ liệu nhân sự.*`;
  }

  if (isAmbiguous && ambiguousMatches && ambiguousMatches.length > 0) {
    return (
      `### 🔍 Yêu Cầu Xác Nhận Danh Tính\n\nTôi tìm thấy **${ambiguousMatches.length} người** phù hợp với tên bạn vừa hỏi. Vui lòng nêu rõ họ tên đầy đủ hoặc mã nhân sự:\n\n` +
      ambiguousMatches
        .map((m, i) => `${i + 1}. **${m.fullName}** (${m.email}) - Đơn vị: *${m.departmentName}* [Vai trò: \`${m.role}\`]`)
        .join('\n')
    );
  }

  if (error === 'USER_NOT_FOUND') {
    return `### ⚠️ Không Tìm Thấy Người Dùng\n\nKhông tìm thấy thông tin cán bộ hoặc giảng viên trong hệ thống. Vui lòng kiểm tra lại họ tên hoặc đơn vị công tác.`;
  }

  const timeLabel = dateRange?.label || 'khoảng thời gian yêu cầu';
  const userName = targetUser?.fullName || 'Người dùng';

  switch (intent) {
    case 'ATTENDANCE_USER_LATE': {
      const lateCount = statistics?.late || 0;
      if (statistics?.total === 0) {
        return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** không có bản ghi chấm công nào trong hệ thống.`;
      }
      if (lateCount === 0) {
        return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** **không đi trễ lần nào** (0 ngày). Đạt tỷ lệ đúng giờ 100%!`;
      }
      return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** đã **đi trễ ${lateCount} ngày** (trên tổng số ${statistics.total} lượt chấm công ghi nhận).`;
    }

    case 'ATTENDANCE_USER_ON_TIME': {
      const onTimeCount = statistics?.onTime || 0;
      return `### 📋 Thống Kê Đúng Giờ\n\nTrong ${timeLabel}, **${userName}** đã chấm công **đúng giờ ${onTimeCount} ngày** (trên tổng số ${statistics?.total || 0} lượt chấm công).`;
    }

    case 'ATTENDANCE_USER_ABSENT': {
      const absentCount = statistics?.absent || 0;
      const excusedCount = statistics?.excusedAbsent || 0;
      return `### 📋 Thống Kê Vắng Mặt\n\nTrong ${timeLabel}, **${userName}** có:\n- **Vắng không phép (ABSENT):** ${absentCount} ngày\n- **Vắng có phép (EXCUSED_ABSENCE):** ${excusedCount} ngày`;
    }

    case 'ATTENDANCE_USER_SUMMARY': {
      const { total, onTime, late, earlyLeave, absent, excusedAbsent } = statistics || {};
      return (
        `### 📋 Báo Cáo Chấm Công: ${userName}\n\nTrong ${timeLabel}, hệ thống ghi nhận tổng cộng **${total || 0} lượt** chấm công của **${userName}**:\n\n` +
        `- ✅ **Đúng giờ:** ${onTime || 0} ngày\n` +
        `- ⚠️ **Đi trễ:** ${late || 0} ngày\n` +
        `- 🚪 **Về sớm:** ${earlyLeave || 0} ngày\n` +
        `- 📩 **Vắng có phép:** ${excusedAbsent || 0} ngày\n` +
        `- ❌ **Vắng không phép:** ${absent || 0} ngày`
      );
    }

    case 'ATTENDANCE_PRESENT_COUNT': {
      const count = statistics?.presentUserCount || 0;
      return `### 👥 Thống Kê Người Đi Làm\n\nTrong ${timeLabel}, hệ thống ghi nhận **${count} người** đã chấm công đi làm.`;
    }

    default:
      return (
        `### 📊 Dữ Liệu Chấm Công & Công Tác\n\n` +
        `Yêu cầu của bạn về "${question}" trong ${timeLabel} đã được tra cứu thành công trên cơ sở dữ liệu MongoDB v2.5.`
      );
  }
};

/**
 * 4. TRỰC TIẾP TRẢ LỜI CÂU HỎI QUY CHẾ & HỌC THUẬT (CHẾ ĐỘ AGENT ACADEMIC / POLICY)
 */
const generateDirectAgentResponse = async ({ question, agentMode = 'policy', provider = 'auto', model, apiKey }) => {
  const matchedPolicies = lookupUniversityRegulation(question);
  const policyContextText = matchedPolicies
    .map((p) => `### ${p.title}\n${p.noi_dung.join('\n')}`)
    .join('\n\n');

  const systemPrompt = `Bạn là Trợ lý AI Thông minh & Thanh Tra Đào Tạo của Trường Đại học.
Dưới đây là Bộ Quy Chế Nhà Trường Chuẩn Năm 2026:
${policyContextText}

QUY TẮC PHẢN HỒI (NGHIÊM NGẶT):
1. VÀO THẲNG VẤN ĐỀ, trả lời trực diện ngay dòng đầu tiên. Không chào hỏi xã giao rườm rà.
2. Trích dẫn chính xác các điều khoản, định mức giờ chuẩn (135h/kỳ), lương cơ sở (2.530.000đ), giảm trừ gia cảnh (15.5tr/6.2tr), phụ cấp ưu đãi nghề (30%), biểu thuế 5 bậc và quy định phê duyệt đơn (<= 3 ngày Khoa duyệt, > 3 ngày BGH duyệt).
3. Trình bày dạng Markdown mạch lạc, có bullet points.`;

  // Thử gọi các LLM bên ngoài (DeepSeek, Claude, Gemini, Local LLM)
  const llmResult = await routeLlmRequest({
    prompt: question,
    systemPrompt,
    provider,
    model,
    apiKey,
  });

  if (llmResult?.text) {
    return `${llmResult.text}\n\n*(Phản hồi được cung cấp bởi mô hình AI: ${llmResult.provider})*`;
  }

  // FALLBACK NỘI BỘ NẾU KHÔNG CÓ KẾT NỐI INTERNET HOẶC THIẾU API KEY:
  // Xuất trực tiếp từ Knowledge Base cục bộ
  let responseMarkdown = `### 🎓 Giải Đáp Quy Chế Nhà Trường (Hệ Thống Nội Bộ 2026)\n\n`;
  responseMarkdown += `Căn cứ theo Quy chế Đào tạo & Quản lý Nhân sự Đại học năm 2026, câu hỏi **"${question}"** được quy định như sau:\n\n`;

  for (const pol of matchedPolicies) {
    responseMarkdown += `#### 📌 ${pol.title}\n`;
    responseMarkdown += `${pol.noi_dung.join('\n')}\n\n`;
  }

  responseMarkdown += `*(Lưu ý: Dữ liệu được trích xuất trực tiếp từ Cơ sở Tri thức Quy chế Đào tạo v2.5).*`;
  return responseMarkdown;
};

/**
 * 5. HÀM TỔNG HỢP XỬ LÝ PHẢN HỒI AI
 */
const generateAiResponse = async (context) => {
  if (context?.unauthorizedReason) {
    return generateFallbackResponse(context);
  }

  // Thử diễn giải qua LLM nếu có API key
  const prompt = `Câu hỏi của người dùng: "${context.question}".
Dữ liệu thống kê thực tế từ MongoDB: ${JSON.stringify(context.statistics || {})}.
Hãy trả lời trực diện bằng tiếng Việt theo số liệu trên.`;

  const llmResult = await routeLlmRequest({
    prompt,
    systemPrompt: 'Bạn là Trợ lý AI chấm công trường Đại học. Trả lời ngắn gọn, chuẩn xác dựa trên số liệu cung cấp.',
    provider: context.provider || 'auto',
    model: context.model,
    apiKey: context.apiKey,
  });

  if (llmResult?.text) {
    return `${llmResult.text}\n\n*(Nguồn số liệu: CSDL MongoDB v2.5 | Động cơ AI: ${llmResult.provider})*`;
  }

  return generateFallbackResponse(context);
};

module.exports = {
  UNIVERSITY_POLICY_KNOWLEDGE,
  lookupUniversityRegulation,
  routeLlmRequest,
  generateAiResponse,
  generateFallbackResponse,
  generateDirectAgentResponse,
};
