/**
 * Tiếp nhận yêu cầu trò chuyện AI, chuyển ngữ cảnh người dùng sang service và trả kết quả HTTP.
 */
const { ServiceError, handleAiChat: runAiChat } = require('../services/ai/aiChat.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleAiChat = async (req, res, next) => {
  try {
    const result = await runAiChat({
      ...req.body,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      userAgent: req.headers ? req.headers['user-agent'] : null,
    });
    return sendSuccess(res, result.message, result.data);
  } catch (error) {
    if (error instanceof ServiceError || error.statusCode) {
      return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
    }
    return next(error);
  }
};

module.exports = { handleAiChat };
