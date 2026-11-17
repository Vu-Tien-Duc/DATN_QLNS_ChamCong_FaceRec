// Điều phối nghiệp vụ đơn xin nghỉ phép / dạy bù / đổi ca (quy trình duyệt Khoa -> BGH và hoàn tác công)
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

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

// POST /api/don-nghi-phep - Tạo đơn xin nghỉ phép / dạy bù / đổi ca / giải trình công
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

// GET /api/don-nghi-phep - Danh sách đơn xin nghỉ phép / dạy bù
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

// GET /api/don-nghi-phep/:id - Chi tiết đơn theo ID
const getLeaveRequestById = async (req, res, next) => {
  try {
    const request = await fetchLeaveRequestById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết đơn thành công.', request);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/don-nghi-phep/so-du - Xem số ngày phép năm còn lại
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

// PUT /api/don-nghi-phep/:id/phe-duyet - Phê duyệt đơn (kiểm tra phien_ban chống xung đột)
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

// PUT /api/don-nghi-phep/:id/tu-choi - Từ chối đơn xin nghỉ phép / dạy bù
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

// PUT /api/don-nghi-phep/:id/huy - Hủy đơn và hoàn tác công liên quan
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
