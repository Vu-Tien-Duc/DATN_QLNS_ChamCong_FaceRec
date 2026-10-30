/**
 * AI Chat Service (server/services/ai/aiChat.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Điều phối hội thoại AI thông minh 2 chế độ: Tra cứu chấm công & Giải đáp quy chế nhà trường.
 * - Hỗ trợ đa nhà cung cấp LLM: Google Gemini, Anthropic Claude, DeepSeek, Local LLM/Ollama.
 * - Kiểm soát chặt chẽ phân quyền dữ liệu RBAC (Cá nhân, Khoa, Toàn trường).
 */
const Department = require('../../models/department.model');
const { normalizeRole } = require('../../utils/roleUtils');
const {
  detectPromptInjection,
  sanitizePromptInput,
  sanitizeContextData,
  logPromptInjectionAttempt,
} = require('./aiGuardrails');
const {
  parseIntent,
  getAttendanceSummary,
  getTopLateUsers,
  getLeaveRequestSummary,
  countTeachingSessions,
  countTeachersWithScheduleOnDate,
  generateAiResponse,
  generateDirectAgentResponse,
} = require('./index');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Kiểm tra xem câu hỏi có phải là câu hỏi tra cứu quy chế nhà trường không
 */
const isRegulationQuestion = (text) => {
  const lower = (text || '').toLowerCase();
  const keywords = [
    'quy chế',
    'quy định',
    'chính sách',
    'tiêu chuẩn',
    'hạn mức phép',
    'định mức giờ',
    'lương cơ sở',
    'thuế tncn',
    'giảm trừ',
    'biểu thuế',
    'khung giờ',
    'ca sáng',
    'ca chiều',
    'bán kính',
    'face ai',
    '5 góc',
    'cooldown',
    'quét lặp',
    'thù lao vượt giờ',
  ];
  return keywords.some((kw) => lower.includes(kw));
};

/**
 * Xử lý yêu cầu trò chuyện AI
 */
const handleAiChat = async ({
  message,
  question: questionInput,
  agentMode = 'attendance',
  provider = 'auto',
  model,
  apiKey,
  currentUser,
  ip = null,
  userAgent = null,
}) => {
  const rawInput = message || questionInput;
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new ServiceError('Vui lòng cung cấp câu hỏi cho Trợ lý AI.', 400);
  }

  const question = rawInput.trim();

  // 0. BẢO VỆ AN TOÀN AI: PHÁT HIỆN & CHẶN PROMPT INJECTION / JAILBREAK
  const guardrail = detectPromptInjection(question);
  if (guardrail.isSuspicious) {
    await logPromptInjectionAttempt({
      user: currentUser,
      question,
      detectionResult: guardrail,
      ip,
      userAgent,
    });

    const safeAnswer = `### 🛡️ Cảnh Báo An Toàn & Bảo Mật Hệ Thống\n\nYêu cầu của bạn đã bị từ chối do vi phạm chính sách an toàn thông tin (${guardrail.reason}).\n\n*Hệ thống Trợ lý AI tuân thủ nghiêm ngặt quy định bảo mật dữ liệu nhân sự của Nhà trường và không chấp nhận các câu lệnh can thiệp chỉ thị hệ thống hoặc truy xuất thông tin nhạy cảm.*`;

    return {
      message: 'Yêu cầu bị từ chối do vi phạm rào chắn an toàn AI (Guardrails).',
      data: {
        question,
        answer: safeAnswer,
        blocked: true,
        guardrailViolation: guardrail.category,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Khử trùng các thẻ điều khiển LLM
  const sanitizedQuestion = sanitizePromptInput(question);

  // 1. Chế độ giải đáp Quy chế Nhà trường hoặc Học thuật
  if (agentMode === 'academic' || agentMode === 'policy' || isRegulationQuestion(sanitizedQuestion)) {
    const answer = await generateDirectAgentResponse({
      question: sanitizedQuestion,
      agentMode: agentMode === 'attendance' ? 'policy' : agentMode,
      provider,
      model,
      apiKey,
      user: currentUser,
    });
    return {
      message: 'Phản hồi từ Trợ lý AI thành công.',
      data: {
        question: sanitizedQuestion,
        answer,
        agentMode: 'policy',
        provider,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 2. Chế độ tra cứu dữ liệu Chấm công & Hoạt động giảng dạy thực tế
  const parsed = await parseIntent(sanitizedQuestion, currentUser);
  const { intent, dateRange, targetUser, department, leaveType, status, isAmbiguousUser, matches } = parsed;

  // Trường hợp tên người dùng mơ hồ (trùng tên nhiều người)
  if (isAmbiguousUser) {
    const answer = await generateAiResponse({
      intent,
      question,
      dateRange,
      isAmbiguous: true,
      ambiguousMatches: matches,
      apiKey,
      provider,
      model,
    });
    return {
      message: 'Yêu cầu làm rõ danh tính người dùng.',
      data: {
        question,
        answer,
        intent,
        dateRange,
        isAmbiguous: true,
        matches,
        timestamp: new Date().toISOString(),
      },
    };
  }

  let statistics = null;
  let unauthorizedReason = null;
  const fromDate = dateRange?.fromDate;
  const toDate = dateRange?.toDate;
  const userId = targetUser?._id;
  let departmentId = department?._id;
  let effectiveDepartment = department;

  const role = normalizeRole(currentUser?.role || currentUser?.primaryRole || currentUser?.vai_tro_chinh);
  if (!departmentId && ['truong_khoa', 'pho_khoa'].includes(role) && currentUser?.departmentId) {
    departmentId = currentUser.departmentId;
  }
  if (!effectiveDepartment && departmentId) {
    effectiveDepartment = await Department.findById(departmentId);
  }

  const applyResult = (result, transform = (value) => value) => {
    if (result.unauthorized) unauthorizedReason = result.reason;
    else statistics = transform(result);
  };

  switch (intent) {
    case 'ATTENDANCE_USER_LATE':
    case 'ATTENDANCE_USER_ON_TIME':
    case 'ATTENDANCE_USER_ABSENT':
    case 'ATTENDANCE_USER_TOTAL':
    case 'ATTENDANCE_USER_SUMMARY': {
      const summaryResult = await getAttendanceSummary({ userId, fromDate, toDate, currentUser });
      applyResult(summaryResult);
      break;
    }

    case 'ATTENDANCE_PRESENT_COUNT': {
      const presentResult = await getAttendanceSummary({ fromDate, toDate, currentUser });
      applyResult(presentResult, (r) => ({
        presentUserCount: r.presentUserCount,
        total: r.total,
        onTime: r.onTime,
        late: r.late,
        absent: r.absent,
      }));
      break;
    }

    case 'TOP_LATE_USERS': {
      const topLateResult = await getTopLateUsers({ departmentId, fromDate, toDate, currentUser });
      applyResult(topLateResult);
      break;
    }

    case 'LEAVE_SUMMARY': {
      const leaveResult = await getLeaveRequestSummary({
        userId,
        departmentId,
        fromDate,
        toDate,
        leaveType,
        status,
        currentUser,
      });
      applyResult(leaveResult);
      break;
    }

    case 'COUNT_TEACHING_SESSIONS': {
      const sessionsResult = await countTeachingSessions({
        userId,
        departmentId,
        fromDate,
        toDate,
        currentUser,
      });
      applyResult(sessionsResult);
      break;
    }

    case 'COUNT_TEACHERS_ON_DATE': {
      const teachersResult = await countTeachersWithScheduleOnDate({
        departmentId,
        date: fromDate || new Date(),
        currentUser,
      });
      applyResult(teachersResult);
      break;
    }

    default: {
      statistics = { note: 'Tra cứu thông tin theo yêu cầu.' };
      break;
    }
  }

  const cleanStatistics = sanitizeContextData(statistics);

  const answer = await generateAiResponse({
    intent,
    question: sanitizedQuestion,
    dateRange,
    targetUser,
    department: effectiveDepartment,
    statistics: cleanStatistics,
    unauthorizedReason,
    apiKey,
    provider,
    model,
  });

  return {
    message: 'Phản hồi từ Trợ lý AI thành công.',
    data: {
      question: sanitizedQuestion,
      answer,
      intent,
      dateRange,
      targetUser: targetUser ? { fullName: targetUser.fullName, email: targetUser.email } : null,
      department: effectiveDepartment ? { name: effectiveDepartment.name } : null,
      unauthorized: Boolean(unauthorizedReason),
      timestamp: new Date().toISOString(),
    },
  };
};

module.exports = {
  ServiceError,
  handleAiChat,
};
