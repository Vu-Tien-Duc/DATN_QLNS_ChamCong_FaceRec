/**
 * LeaveRequest Controller (server/controllers/leaveRequest.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Tiếp nhận và xử lý HTTP cho quy trình duyệt đơn nhiều cấp (Khoa -> BGH).
 * - Chặn tự duyệt đơn và chống xung đột phiên bản (Optimistic Locking).
 * - Kích hoạt hồi tố và hoàn tác công (Retroactive Sync & Rollback).
 */
const {
  ServiceError,
  createLeaveRequestDomain,
  fetchLeaveRequests,
  fetchLeaveRequestById,
  fetchLeaveBalance,
  approveLeaveRequestDomain,
  rejectLeaveRequestDomain,
  cancelLeaveRequestDomain,
} = require('../services/leaveRequest.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Xử lý lỗi từ tầng Service đồng bộ mã lỗi & HTTP status code
 */
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

/**
 * 1. Tạo đơn xin nghỉ phép / dạy bù / đổi ca
 * @route POST /api/leave-requests
 */
const createLeaveRequest = async (req, res, next) => {
  try {
    const { type, reason, startDate, endDate, attachmentUrl, scheduleId, makeupDate, isHalfDay } = req.body;
    const leaveRequest = await createLeaveRequestDomain({
      type,
      reason,
      startDate,
      endDate,
      attachmentUrl,
      scheduleId,
      makeupDate,
      isHalfDay,
      file: req.file,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Gửi đơn thành công.', leaveRequest, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Lấy danh sách đơn xin nghỉ phép/dạy bù
 * @route GET /api/leave-requests
 */
const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, type, userId } = req.query;
    const requests = await fetchLeaveRequests({
      status,
      type,
      userId,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách đơn thành công.', requests);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Lấy chi tiết đơn theo ID
 * @route GET /api/leave-requests/:id
 */
const getLeaveRequestById = async (req, res, next) => {
  try {
    const request = await fetchLeaveRequestById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết đơn thành công.', request);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 4. Xem số ngày phép còn lại (Leave Balance)
 * @route GET /api/leave-requests/balance
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const balance = await fetchLeaveBalance(req.query.userId, req.user);
    return sendSuccess(res, balance.message, balance);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Phê duyệt đơn (Hỗ trợ Optimistic Locking qua body.version)
 * @route PUT /api/leave-requests/:id/approve
 */
const approveLeaveRequest = async (req, res, next) => {
  try {
    const { approvalNote, version, expectedVersion } = req.body;
    const updated = await approveLeaveRequestDomain({
      id: req.params.id,
      approvalNote,
      expectedVersion: version !== undefined ? version : expectedVersion,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, 'Phê duyệt đơn thành công.', updated);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Từ chối đơn xin nghỉ phép/dạy bù
 * @route PUT /api/leave-requests/:id/reject
 */
const rejectLeaveRequest = async (req, res, next) => {
  try {
    const { rejectionReason, reason, version, expectedVersion } = req.body;
    const finalReason = rejectionReason || reason;
    const updated = await rejectLeaveRequestDomain({
      id: req.params.id,
      rejectionReason: finalReason,
      expectedVersion: version !== undefined ? version : expectedVersion,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, 'Từ chối đơn thành công.', updated);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Hủy đơn xin nghỉ phép/dạy bù & Hoàn tác công
 * @route PUT /api/leave-requests/:id/cancel
 */
const cancelLeaveRequest = async (req, res, next) => {
  try {
    const { version, expectedVersion } = req.body;
    const cancelled = await cancelLeaveRequestDomain({
      id: req.params.id,
      expectedVersion: version !== undefined ? version : expectedVersion,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, 'Hủy đơn và hoàn tác công thành công.', cancelled);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveBalance,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
};
