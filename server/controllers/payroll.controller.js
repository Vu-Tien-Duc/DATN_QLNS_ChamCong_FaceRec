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
    const month = req.body?.month;
    const year = req.body?.year;
    const departmentId = req.body?.departmentId;
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
 * 2. Khóa lương tháng & chốt công (Hỗ trợ cả POST /lock và PUT /:id/lock)
 * @route POST /api/payrolls/lock hoặc PUT /api/payrolls/:id/lock
 */
const lockPayroll = async (req, res, next) => {
  try {
    let month = req.body?.month;
    let year = req.body?.year;
    if (req.params?.id && (!month || !year)) {
      const p = await fetchPayrollById(req.params.id, req.user);
      if (p) {
        month = p.month;
        year = p.year;
      }
    }
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
 * 3. Mở khóa lương tháng (Hỗ trợ cả POST /unlock và PUT /:id/unlock)
 * @route POST /api/payrolls/unlock hoặc PUT /api/payrolls/:id/unlock
 */
const unlockPayroll = async (req, res, next) => {
  try {
    let month = req.body?.month;
    let year = req.body?.year;
    let reason = req.body?.reason || 'Mở khóa bảng lương theo yêu cầu điều chỉnh.';
    if (req.params?.id && (!month || !year)) {
      const p = await fetchPayrollById(req.params.id, req.user);
      if (p) {
        month = p.month;
        year = p.year;
      }
    }
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
    const month = req.query.month;
    const year = req.query.year;
    const departmentId = req.query.departmentId;
    const status = req.query.status;
    const userId = req.query.userId;
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
 * 6. Xem phiếu lương của chính mình
 * @route GET /api/payrolls/my-payroll
 */
const getMyPayroll = async (req, res, next) => {
  try {
    const role = String(req.user?.role || req.user?.primaryRole || '').toLowerCase();
    if (role === 'admin') {
      return sendError(
        res,
        'Tài khoản Quản trị viên IT (Admin) không có phiếu lương cá nhân.',
        null,
        403,
        'ADMIN_NO_PERSONAL_PAYROLL'
      );
    }

    const now = new Date();
    const month = req.query.month || (now.getMonth() + 1);
    const year = req.query.year || now.getFullYear();
    const payrolls = await fetchPayrolls({
      month,
      year,
      userId: req.user.id || req.user._id,
      currentUser: req.user,
    });
    const myPayroll = payrolls[0] || null;
    return sendSuccess(res, 'Lấy phiếu lương cá nhân thành công.', myPayroll);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Tổng hợp thống kê quỹ lương tháng
 * @route GET /api/payrolls/summary
 */
const getPayrollSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const month = Number(req.query.month || (now.getMonth() + 1));
    const year = Number(req.query.year || now.getFullYear());
    const payrolls = await fetchPayrolls({
      month,
      year,
      currentUser: req.user,
    });
    let totalNetSalary = 0;
    let totalGrossSalary = 0;
    let totalTax = 0;
    let totalInsurance = 0;
    let totalOvertimePay = 0;
    for (const p of payrolls) {
      totalNetSalary += Number(p.netSalary || 0);
      totalGrossSalary += Number(p.grossIncome || 0);
      totalTax += Number(p.personalIncomeTax || 0);
      totalInsurance += Number(p.socialInsuranceDeduction || 0);
      totalOvertimePay += Number(p.overtimePay || 0);
    }
    return sendSuccess(res, `Tổng hợp quỹ lương tháng ${month}/${year}.`, {
      month,
      year,
      totalRecords: payrolls.length,
      totalNetSalary,
      totalGrossSalary,
      totalTax,
      totalInsurance,
      totalOvertimePay,
      isLocked: payrolls.some((p) => p.status === 'da_khoa' || p.isLocked),
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 8. Xuất dữ liệu bảng lương định dạng Excel
 * @route GET /api/payrolls/export/excel
 */
const exportPayrollExcel = async (req, res, next) => {
  try {
    const month = req.query.month;
    const year = req.query.year;
    const departmentId = req.query.departmentId;
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
 * 9. Trích xuất dữ liệu in ấn phiếu lương PDF
 * @route GET /api/payrolls/:id/export/pdf hoặc GET /api/payrolls/export/pdf?id=...
 */
const exportPayrollPdf = async (req, res, next) => {
  try {
    const id = req.params?.id || req.query?.id;
    if (!id) {
      return sendError(res, 'Vui lòng cung cấp mã phiếu lương (id) qua path hoặc query param.', null, 400);
    }
    const pdfData = await exportPayrollPdfData(id, req.user);
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
  getMyPayroll,
  getPayrollSummary,
  exportPayrollExcel,
  exportPayrollPdf,
};
