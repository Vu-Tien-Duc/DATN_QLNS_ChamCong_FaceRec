// Tra cứu nhật ký kiểm toán hệ thống và kiểm tra tính toàn vẹn chuỗi băm SHA-256
const {
  getAuditLogs: fetchAuditLogs,
  verifyAuditLogIntegrity,
} = require('../services/heThong/nhatKyKiemToan.service');
const ServiceError = require('../utils/loiNghiepVu');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Tra cứu danh sách nhật ký kiểm toán theo bộ lọc và phân trang
const getAuditLogs = async (req, res, next) => {
  try {
    const nguoi_thuc_hien_id = req.query?.nguoi_thuc_hien_id || req.query?.nguoi_dung_id;
    const hanh_dong = req.query?.hanh_dong;
    const loai_doi_tuong = req.query?.loai_doi_tuong;
    const ket_qua = req.query?.ket_qua;
    const tim_kiem = req.query?.tim_kiem;
    const tu_ngay = req.query?.tu_ngay;
    const den_ngay = req.query?.den_ngay;
    const page = req.query?.trang || 1;
    const limit = req.query?.gioi_han || 20;

    const result = await fetchAuditLogs({
      nguoi_thuc_hien_id,
      hanh_dong,
      loai_doi_tuong,
      ket_qua,
      tim_kiem,
      tu_ngay,
      den_ngay,
      page,
      limit,
    });
    return sendSuccess(res, 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.', result);
  } catch (error) {
    if (error instanceof ServiceError || error.statusCode) {
      return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
    }
    return next(error);
  }
};

// Kiểm tra tính toàn vẹn chuỗi băm SHA-256 của nhật ký kiểm toán
const verifyAuditIntegrity = async (req, res, next) => {
  try {
    const limit = req.query.gioi_han ? parseInt(req.query.gioi_han, 10) : 1000;
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
