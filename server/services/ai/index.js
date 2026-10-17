/**
 * Điểm tập hợp và xuất các thành phần phân tích, thống kê và tạo phản hồi của trợ lý AI.
 */
const intentParser = require('./aiIntentParser');
const analyticsService = require('./aiAnalytics.service');
const responseService = require('./aiResponse.service');
const aiGuardrails = require('./aiGuardrails');

module.exports = {
  // 1. NLU / Intent Parsing
  INTENTS: intentParser.INTENTS,
  parseIntent: intentParser.parseIntent,
  intentParser,

  // 2. Data Engine & RBAC Analytics
  checkUserPermission: analyticsService.checkUserPermission,
  checkDepartmentPermission: analyticsService.checkDepartmentPermission,
  resolveUser: analyticsService.resolveUser,
  resolveDepartment: analyticsService.resolveDepartment,
  getAttendanceSummary: analyticsService.getAttendanceSummary,
  getTopLateUsers: analyticsService.getTopLateUsers,
  getLeaveRequestSummary: analyticsService.getLeaveRequestSummary,
  countTeachingSessions: analyticsService.countTeachingSessions,
  countTeachersWithScheduleOnDate: analyticsService.countTeachersWithScheduleOnDate,
  analyticsService,

  // 3. NLG & Response Generation
  generateAiResponse: responseService.generateAiResponse,
  generateFallbackResponse: responseService.generateFallbackResponse,
  generateDirectAgentResponse: responseService.generateDirectAgentResponse,
  responseService,

  // 4. Security & Guardrails
  aiGuardrails,
  detectPromptInjection: aiGuardrails.detectPromptInjection,
  sanitizePromptInput: aiGuardrails.sanitizePromptInput,
  sanitizeContextData: aiGuardrails.sanitizeContextData,
};
