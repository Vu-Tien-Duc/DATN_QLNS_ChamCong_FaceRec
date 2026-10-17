/**
 * Nhận yêu cầu tra cứu nhật ký kiểm toán và ánh xạ kết quả hoặc lỗi sang HTTP response.
 */
const {
  getAuditLogs: fetchAuditLogs,
  verifyAuditLogIntegrity,
} = require('../services/auditLog.service');
const ServiceError = require('../utils/serviceError');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await fetchAuditLogs(req.query);
    return sendSuccess(res, 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.', result);
  } catch (error) {
    if (error instanceof ServiceError || error.statusCode) {
      return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
    }
    return next(error);
  }
};

const verifyAuditIntegrity = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;
    const result = await verifyAuditLogIntegrity(limit);
    const message = result.isValid
      ? 'Đối soát toàn vẹn chuỗi Hash (SHA-256) thành công: Dữ liệu kiểm toán an toàn 100%.'
      : 'Cảnh báo đối soát chuỗi Hash: Phát hiện bất thường hoặc bản ghi bị can thiệp!';
    return sendSuccess(res, message, result);
  } catch (error) {
    if (error instanceof ServiceError || error.statusCode) {
      return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
    }
    return next(error);
  }
};

module.exports = {
  getAuditLogs,
  verifyAuditIntegrity,
};
