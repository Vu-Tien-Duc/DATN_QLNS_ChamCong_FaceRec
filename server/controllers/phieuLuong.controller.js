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
} = require('../services/phieuLuong/phieuLuong.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

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
    const thang = req.body?.thang;
    const nam = req.body?.nam;
    const don_vi_id = req.body?.don_vi_id;
    if (!thang || !nam) {
      return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
    }
    const result = await generateMonthlyPayroll({
      thang,
      nam,
      don_vi_id,
      currentUser: req.user,
    });
    return sendSuccess(res, `Khởi tạo bảng lương tháng ${thang}/${nam} thành công.`, result, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Khóa lương tháng & chốt công (Hỗ trợ cả POST /khoa và PUT /:id/khoa)
 * @route POST /api/phieu-luong/khoa hoặc PUT /api/phieu-luong/:id/khoa
 */
const lockPayroll = async (req, res, next) => {
  try {
    let month = req.body?.thang;
    let year = req.body?.nam;
    if (req.params?.id && (!month || !year)) {
      const p = await fetchPayrollById(req.params.id, req.user);
      if (p) {
        month = p.thang;
        year = p.nam;
      }
    }
    if (!month || !year) {
      return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
    }
    const result = await lockMonthlyPayroll({
      month,
      year,
      departmentId: req.body?.don_vi_id || null,
      currentUser: req.user,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return sendSuccess(res, result.message, result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Mở khóa lương tháng (Hỗ trợ cả POST /mo-khoa và PUT /:id/mo-khoa)
 * @route POST /api/phieu-luong/mo-khoa hoặc PUT /api/phieu-luong/:id/mo-khoa
 */
const unlockPayroll = async (req, res, next) => {
  try {
    let month = req.body?.thang;
    let year = req.body?.nam;
    let reason = req.body?.ly_do || 'Mở khóa bảng lương theo yêu cầu điều chỉnh.';
    if (req.params?.id && (!month || !year)) {
      const p = await fetchPayrollById(req.params.id, req.user);
      if (p) {
        month = p.thang;
        year = p.nam;
      }
    }
    if (!month || !year) {
      return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
    }
    const result = await unlockMonthlyPayroll({
      month,
      year,
      departmentId: req.body?.don_vi_id || null,
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
 * @route GET /api/phieu-luong
 */
const getPayrolls = async (req, res, next) => {
  try {
    const thang = req.query?.thang;
    const nam = req.query?.nam;
    const don_vi_id = req.query?.don_vi_id;
    const trang_thai = req.query?.trang_thai;
    const nguoi_dung_id = req.query?.nguoi_dung_id;
    const payrolls = await fetchPayrolls({
      thang,
      nam,
      don_vi_id,
      trang_thai,
      nguoi_dung_id,
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
    const thang = req.query?.thang || (now.getMonth() + 1);
    const nam = req.query?.nam || now.getFullYear();
    const payrolls = await fetchPayrolls({
      thang,
      nam,
      nguoi_dung_id: req.user._id,
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
 * @route GET /api/phieu-luong/tong-hop
 */
const getPayrollSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const thang = Number(req.query?.thang || (now.getMonth() + 1));
    const nam = Number(req.query?.nam || now.getFullYear());
    const payrolls = await fetchPayrolls({
      thang,
      nam,
      currentUser: req.user,
    });
    let totalNetSalary = 0;
    let totalGrossSalary = 0;
    let totalTax = 0;
    let totalInsurance = 0;
    let totalOvertimePay = 0;
    for (const p of payrolls) {
      totalNetSalary += Number(p.thuc_linh_net || 0);
      totalGrossSalary += Number(p.tong_thu_nhap_gross || 0);
      totalTax += Number(p.thue_tncn?.tien_thue ?? (typeof p.thue_tncn === 'number' ? p.thue_tncn : 0));
      totalInsurance += Number(p.bao_hiem?.tong_bao_hiem ?? p.tong_bao_hiem ?? 0);
      totalOvertimePay += Number(p.gio_giang?.thu_lao_vuot_gio ?? p.thu_lao_vuot_gio ?? 0);
    }
    return sendSuccess(res, `Tổng hợp quỹ lương tháng ${thang}/${nam}.`, {
      thang,
      nam,
      tong_ban_ghi: payrolls.length,
      tong_thuc_linh: totalNetSalary,
      tong_thu_nhap: totalGrossSalary,
      tong_thue_tncn: totalTax,
      tong_bao_hiem: totalInsurance,
      tong_vuot_gio: totalOvertimePay,
      da_khoa: payrolls.some((p) => p.da_khoa === true || p.trang_thai === 'da_khoa'),
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 8. Xuất dữ liệu bảng lương định dạng Excel
 * @route GET /api/phieu-luong/xuat-excel
 */
const exportPayrollExcel = async (req, res, next) => {
  try {
    const thang = req.query?.thang;
    const nam = req.query?.nam;
    const don_vi_id = req.query?.don_vi_id;
    if (!thang || !nam) {
      return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
    }
    const exportData = await exportPayrollExcelData({
      thang,
      nam,
      don_vi_id,
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
