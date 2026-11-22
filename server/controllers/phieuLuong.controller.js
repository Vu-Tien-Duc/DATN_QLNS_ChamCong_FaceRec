// Quản lý tính lương tháng, khóa/mở sổ lương và xuất phiếu lương Excel/PDF
const {
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
  markPayrollAsPaid,
  fetchPayrolls,
  fetchPayrollById,
  exportPayrollExcelData,
  exportPayrollPdfData,
} = require('../services/phieuLuong/phieuLuong.service');
const { hasAnyActiveRole } = require('../utils/vaiTro.utils');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// POST /api/phieu-luong/khoi-tao - Khởi tạo/tính toán bảng lương tháng
const generatePayroll = async (req, res) => {
  const { thang, nam, don_vi_id } = req.body || {};
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
};

// POST /api/phieu-luong/khoa | PUT /api/phieu-luong/:id/khoa - Khóa lương tháng và chốt công
const lockPayroll = async (req, res) => {
  const payrollId = req.params?.id || null;
  const month = req.body?.thang;
  const year = req.body?.nam;
  if (!payrollId && (!month || !year)) {
    return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
  }
  const result = await lockMonthlyPayroll({
    month,
    year,
    departmentId: req.body?.don_vi_id || null,
    payrollId,
    currentUser: req.user,
    ip: req.ip || req.connection?.remoteAddress,
  });
  return sendSuccess(res, result.thong_bao, result);
};

// POST /api/phieu-luong/mo-khoa | PUT /api/phieu-luong/:id/mo-khoa - Mở khóa lương tháng đã chốt
const unlockPayroll = async (req, res) => {
  const payrollId = req.params?.id || null;
  const month = req.body?.thang;
  const year = req.body?.nam;
  if (!payrollId && (!month || !year)) {
    return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
  }
  const result = await unlockMonthlyPayroll({
    month,
    year,
    departmentId: req.body?.don_vi_id || null,
    payrollId,
    reason: req.body?.ly_do,
    currentUser: req.user,
    ip: req.ip || req.connection?.remoteAddress,
  });
  return sendSuccess(res, result.thong_bao, result);
};

// POST /api/phieu-luong/chi-tra | PUT /api/phieu-luong/:id/chi-tra - Đánh dấu đã chi trả lương (da_duyet -> da_chi_tra)
const markPayrollPaid = async (req, res) => {
  const payrollId = req.params?.id || null;
  const month = req.body?.thang;
  const year = req.body?.nam;
  if (!payrollId && (!month || !year)) {
    return sendError(res, 'Tháng (thang) và năm (nam) là bắt buộc.', null, 400);
  }
  const result = await markPayrollAsPaid({
    month,
    year,
    departmentId: req.body?.don_vi_id || null,
    payrollId,
    currentUser: req.user,
    ip: req.ip || req.connection?.remoteAddress,
  });
  return sendSuccess(res, result.thong_bao, result);
};

// GET /api/phieu-luong - Danh sách bảng lương theo tháng / năm / đơn vị
const getPayrolls = async (req, res) => {
  const { thang, nam, don_vi_id, trang_thai, nguoi_dung_id } = req.query || {};
  const payrolls = await fetchPayrolls({
    thang,
    nam,
    don_vi_id,
    trang_thai,
    nguoi_dung_id,
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy danh sách bảng lương thành công.', payrolls);
};

// GET /api/phieu-luong/:id - Xem chi tiết phiếu lương cá nhân
const getPayrollById = async (req, res) => {
  const payroll = await fetchPayrollById(req.params.id, req.user);
  return sendSuccess(res, 'Lấy chi tiết phiếu lương thành công.', payroll);
};

// GET /api/phieu-luong/cua-toi - Xem phiếu lương của chính mình
const getMyPayroll = async (req, res) => {
  if (!req.user?.id) {
    return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
  }
  if (hasAnyActiveRole(req.user, ['admin', 'bgh'])) {
    return sendError(
      res,
      'Tài khoản Quản trị viên IT / Ban Giám Hiệu không áp dụng phiếu lương cá nhân.',
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
    nguoi_dung_id: req.user.id,
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy phiếu lương cá nhân thành công.', payrolls[0] || null);
};

// GET /api/phieu-luong/tong-hop - Thống kê tổng quỹ lương tháng
const getPayrollSummary = async (req, res) => {
  const now = new Date();
  const thang = Number(req.query?.thang || (now.getMonth() + 1));
  const nam = Number(req.query?.nam || now.getFullYear());
  const payrolls = await fetchPayrolls({
    thang,
    nam,
    don_vi_id: req.query?.don_vi_id,
    currentUser: req.user,
  });
  let totalNetSalary = 0;
  let totalGrossSalary = 0;
  let totalTax = 0;
  let totalInsurance = 0;
  let totalOvertimePay = 0;
  let lockedCount = 0;
  for (const p of payrolls) {
    totalNetSalary += Number(p.thuc_linh_net || 0);
    totalGrossSalary += Number(p.tong_thu_nhap_gross || 0);
    totalTax += Number(p.thue_tncn?.tien_thue ?? (typeof p.thue_tncn === 'number' ? p.thue_tncn : 0));
    totalInsurance += Number(p.bao_hiem?.tong_bao_hiem ?? p.tong_bao_hiem ?? 0);
    totalOvertimePay += Number(p.gio_giang?.thu_lao_vuot_gio ?? p.thu_lao_vuot_gio ?? 0);
    if (p.da_khoa === true || ['da_duyet', 'da_chi_tra'].includes(p.trang_thai)) {
      lockedCount += 1;
    }
  }
  const isFullyLocked = payrolls.length > 0 && lockedCount === payrolls.length;
  const isPartiallyLocked = lockedCount > 0 && lockedCount < payrolls.length;
  return sendSuccess(res, `Tổng hợp quỹ lương tháng ${thang}/${nam}.`, {
    thang,
    nam,
    tong_ban_ghi: payrolls.length,
    tong_thuc_linh: totalNetSalary,
    tong_thu_nhap: totalGrossSalary,
    tong_thue_tncn: totalTax,
    tong_bao_hiem: totalInsurance,
    tong_vuot_gio: totalOvertimePay,
    so_phieu_da_khoa: lockedCount,
    da_khoa: isFullyLocked,
    da_khoa_mot_phan: isPartiallyLocked,
  });
};

// GET /api/phieu-luong/xuat-excel - Xuất bảng lương Excel
const exportPayrollExcel = async (req, res) => {
  const { thang, nam, don_vi_id } = req.query || {};
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
};

// GET /api/phieu-luong/:id/xuat-pdf - Trích xuất dữ liệu in ấn phiếu lương PDF
const exportPayrollPdf = async (req, res) => {
  const id = req.params?.id || req.query?.id;
  if (!id) {
    return sendError(res, 'Vui lòng cung cấp mã phiếu lương (id) qua path hoặc query param.', null, 400);
  }
  const pdfData = await exportPayrollPdfData(id, req.user);
  return sendSuccess(res, 'Trích xuất dữ liệu in phiếu lương PDF thành công.', pdfData);
};

module.exports = {
  generatePayroll,
  lockPayroll,
  unlockPayroll,
  markPayrollPaid,
  getPayrolls,
  getPayrollById,
  getMyPayroll,
  getPayrollSummary,
  exportPayrollExcel,
  exportPayrollPdf,
};
