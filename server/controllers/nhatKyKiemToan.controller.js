// Tra cứu nhật ký kiểm toán hệ thống và kiểm tra tính toàn vẹn chuỗi băm SHA-256
const {
  getAuditLogs: fetchAuditLogs,
  verifyAuditLogIntegrity,
} = require('../services/heThong/nhatKyKiemToan.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

// Tra cứu danh sách nhật ký kiểm toán theo bộ lọc và phân trang
const getAuditLogs = async (req, res) => {
  const {
    nguoi_thuc_hien_id,
    hanh_dong,
    loai_doi_tuong,
    ket_qua,
    tim_kiem,
    tu_ngay,
    den_ngay,
    trang = 1,
    gioi_han = 20,
  } = req.query || {};

  const result = await fetchAuditLogs({
    nguoi_thuc_hien_id,
    hanh_dong,
    loai_doi_tuong,
    ket_qua,
    tim_kiem,
    tu_ngay,
    den_ngay,
    trang,
    gioi_han,
  });
  return sendSuccess(res, 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.', result);
};

// Kiểm tra tính toàn vẹn chuỗi băm SHA-256 của nhật ký kiểm toán
const verifyAuditIntegrity = async (req, res) => {
  const limit = req.query.gioi_han ? parseInt(req.query.gioi_han, 10) : 1000;
  const result = await verifyAuditLogIntegrity(limit);
  const message = result.isValid
    ? 'Đối soát toàn vẹn chuỗi Hash (SHA-256) thành công: Dữ liệu kiểm toán an toàn 100%.'
    : 'Cảnh báo đối soát chuỗi Hash: Phát hiện bất thường hoặc bản ghi bị can thiệp!';
  return sendSuccess(res, message, result);
};

module.exports = {
  getAuditLogs,
  verifyAuditIntegrity,
};
