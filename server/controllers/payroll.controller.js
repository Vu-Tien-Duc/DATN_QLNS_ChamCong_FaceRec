/**
 * Payroll Controller (server/controllers/payroll.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Tiếp nhận HTTP cho khởi tạo, tính toán bảng lương snapshot 2026.
 * - Khóa lương (isLocked) và mở khóa lương có lưu vết AuditLog.
 * - Trích xuất xuất dữ liệu bảng tính Excel và phiếu lương in ấn PDF.
 */
const {
  ServiceError,
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
  fetchPayrolls,
  fetchPayrollById,
  exportPayrollExcelData,
  exportPayrollPdfData,
} = require('../services/payroll.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

/**
 * 1. Khởi tạo/tính toán bảng lương tháng
 * @route POST /api/payrolls/generate
 */
const generatePayroll = async (req, res, next) => {
  try {
    const { month, year, departmentId } = req.body;
    if (!month || !year) {
      return sendError(res, 'Tháng (month) và năm (year) là bắt buộc.', null, 400);
    }
    const result = await generateMonthlyPayroll({
      month,
      year,
      departmentId,
      currentUser: req.user,
    });
    return sendSuccess(res, `Khởi tạo bảng lương tháng ${month}/${year} thành công.`, result, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Khóa lương tháng & chốt công
 * @route POST /api/payrolls/lock
 */
const lockPayroll = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return sendError(res, 'Tháng (month) và năm (year) là bắt buộc.', null, 400);
    }
    const result = await lockMonthlyPayroll({
      month,
      year,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, result.message, result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Mở khóa lương tháng
 * @route POST /api/payrolls/unlock
 */
const unlockPayroll = async (req, res, next) => {
  try {
    const { month, year, reason } = req.body;
    if (!month || !year) {
      return sendError(res, 'Tháng (month) và năm (year) là bắt buộc.', null, 400);
    }
    const result = await unlockMonthlyPayroll({
      month,
      year,
      reason,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, result.message, result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 4. Lấy danh sách bảng lương
 * @route GET /api/payrolls
 */
const getPayrolls = async (req, res, next) => {
  try {
    const { month, year, departmentId, status, userId } = req.query;
    const payrolls = await fetchPayrolls({
      month,
      year,
      departmentId,
      status,
      userId,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách bảng lương thành công.', payrolls);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Xem chi tiết phiếu lương cá nhân
 * @route GET /api/payrolls/:id
 */
const getPayrollById = async (req, res, next) => {
  try {
    const payroll = await fetchPayrollById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết phiếu lương thành công.', payroll);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Xem phiếu lương của chính mình trong tháng hiện tại
 * @route GET /api/payrolls/me/current
 */
const getMyCurrentPayroll = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month || (now.getMonth() + 1);
    const year = req.query.year || now.getFullYear();
    const payrolls = await fetchPayrolls({
      month,
      year,
      userId: req.user.id,
      currentUser: req.user,
    });
    const currentPayroll = payrolls[0] || null;
    return sendSuccess(res, 'Lấy phiếu lương cá nhân thành công.', currentPayroll);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Xuất dữ liệu bảng lương định dạng Excel
 * @route GET /api/payrolls/export/excel
 */
const exportPayrollExcel = async (req, res, next) => {
  try {
    const { month, year, departmentId } = req.query;
    if (!month || !year) {
      return sendError(res, 'Tháng (month) và năm (year) là bắt buộc.', null, 400);
    }
    const exportData = await exportPayrollExcelData({
      month,
      year,
      departmentId,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Trích xuất dữ liệu bảng lương Excel thành công.', exportData);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 8. Trích xuất dữ liệu in ấn phiếu lương PDF
 * @route GET /api/payrolls/:id/export/pdf
 */
const exportPayrollPdf = async (req, res, next) => {
  try {
    const pdfData = await exportPayrollPdfData(req.params.id, req.user);
    return sendSuccess(res, 'Trích xuất dữ liệu in phiếu lương PDF thành công.', pdfData);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  generatePayroll,
  lockPayroll,
  unlockPayroll,
  getPayrolls,
  getPayrollById,
  getMyCurrentPayroll,
  exportPayrollExcel,
  exportPayrollPdf,
};
