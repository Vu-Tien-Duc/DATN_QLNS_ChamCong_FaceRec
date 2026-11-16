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
} = require('../services/donNghiPhep/donNghiPhep.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

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
 * @route POST /api/don-nghi-phep
 */
const createLeaveRequest = async (req, res, next) => {
  try {
    const {
      loai_don,
      ly_do,
      ngay_bat_dau,
      ngay_ket_thuc,
      tep_dinh_kem,
      lich_trinh_id,
      ngay_day_bu,
      nua_ngay,
      so_tiet_nghi,
      ca_thay_the_id,
      giang_vien_day_thay_id,
    } = req.body || {};

    const leaveRequest = await createLeaveRequestDomain({
      loai_don,
      ly_do,
      ngay_bat_dau,
      ngay_ket_thuc,
      tep_dinh_kem,
      lich_trinh_id,
      ngay_day_bu,
      isHalfDay: nua_ngay,
      so_tiet_nghi,
      ca_thay_the_id,
      giang_vien_day_thay_id,
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
 * @route GET /api/don-nghi-phep
 */
const getLeaveRequests = async (req, res, next) => {
  try {
    const trang_thai = req.query?.trang_thai;
    const loai_don = req.query?.loai_don;
    const nguoi_dung_id = req.query?.nguoi_dung_id;
    const requests = await fetchLeaveRequests({
      trang_thai,
      loai_don,
      nguoi_dung_id,
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
 * 4. Xem số ngày phép còn lại
 * @route GET /api/don-nghi-phep/so-du
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const nguoi_dung_id = req.query?.nguoi_dung_id;
    const nam = req.query?.nam;
    const balance = await fetchLeaveBalance(nguoi_dung_id, req.user, nam);
    return sendSuccess(res, balance.message, balance);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Phê duyệt đơn (Hỗ trợ Optimistic Locking qua phien_ban)
 * @route PUT /api/don-nghi-phep/:id/phe-duyet
 */
const approveLeaveRequest = async (req, res, next) => {
  try {
    const ghi_chu_duyet = req.body?.ghi_chu_duyet || 'Đã phê duyệt đơn.';
    const phien_ban = req.body?.phien_ban;
    const updated = await approveLeaveRequestDomain({
      id: req.params.id,
      ghi_chu_duyet,
      phien_ban_ky_vong: phien_ban,
      currentUser: req.user,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, 'Phê duyệt đơn thành công.', updated);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Từ chối đơn xin nghỉ phép/dạy bù
 * @route PUT /api/don-nghi-phep/:id/tu-choi
 */
const rejectLeaveRequest = async (req, res, next) => {
  try {
    const ly_do_tu_choi = req.body?.ly_do_tu_choi || 'Từ chối đơn.';
    const phien_ban = req.body?.phien_ban;
    const updated = await rejectLeaveRequestDomain({
      id: req.params.id,
      ly_do_tu_choi,
      phien_ban_ky_vong: phien_ban,
      currentUser: req.user,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, 'Từ chối đơn thành công.', updated);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Hủy đơn xin nghỉ phép/dạy bù & Hoàn tác công
 * @route PUT /api/don-nghi-phep/:id/huy
 */
const cancelLeaveRequest = async (req, res, next) => {
  try {
    const phien_ban = req.body?.phien_ban;
    const cancelled = await cancelLeaveRequestDomain({
      id: req.params.id,
      phien_ban_ky_vong: phien_ban,
      currentUser: req.user,
      dia_chi_ip: req.ip || req.connection?.remoteAddress,
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
