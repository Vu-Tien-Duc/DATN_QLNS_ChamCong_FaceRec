// Quản lý tính lương tháng, khóa/mở sổ lương và xuất phiếu lương Excel/PDF
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

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

// POST /api/phieu-luong/khoi-tao - Khởi tạo/tính toán bảng lương tháng
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

// POST /api/phieu-luong/khoa | PUT /api/phieu-luong/:id/khoa - Khóa lương tháng và chốt công
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

// POST /api/phieu-luong/mo-khoa | PUT /api/phieu-luong/:id/mo-khoa - Mở khóa lương tháng đã chốt
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

// GET /api/phieu-luong - Danh sách bảng lương theo tháng / năm / đơn vị
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

// GET /api/phieu-luong/:id - Xem chi tiết phiếu lương cá nhân
const getPayrollById = async (req, res, next) => {
  try {
    const payroll = await fetchPayrollById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết phiếu lương thành công.', payroll);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/phieu-luong/cua-toi - Xem phiếu lương của chính mình
const getMyPayroll = async (req, res, next) => {
  try {
    const role = String(req.user?.vai_tro_chinh || '').toLowerCase();
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

// GET /api/phieu-luong/tong-hop - Thống kê tổng quỹ lương tháng
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

// GET /api/phieu-luong/xuat-excel - Xuất bảng lương Excel
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

// GET /api/phieu-luong/:id/xuat-pdf - Trích xuất dữ liệu in ấn phiếu lương PDF
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
