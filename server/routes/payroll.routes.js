/**
 * Payroll Routes (server/routes/payroll.routes.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * Định tuyến API quản lý bảng lương Snapshot 2026, khóa lương và xuất báo cáo.
 */
const express = require('express');
const router = express.Router();
const {
  generatePayroll,
  lockPayroll,
  unlockPayroll,
  getPayrolls,
  getPayrollById,
  getMyPayroll,
  getPayrollSummary,
  exportPayrollExcel,
  exportPayrollPdf,
} = require('../controllers/payroll.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// 1. Xem phiếu lương của chính mình
router.get('/my-payroll', getMyPayroll);

// 2. Thống kê tổng hợp quỹ lương tháng
router.get('/summary', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), getPayrollSummary);

// 3. Xuất dữ liệu báo cáo bảng lương Excel
router.get('/export/excel', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), exportPayrollExcel);

// 4. Trích xuất dữ liệu phiếu lương PDF (Hỗ trợ cả :id/export/pdf và /export/pdf?id=...)
router.get('/export/pdf', exportPayrollPdf);
router.get('/:id/export/pdf', exportPayrollPdf);

// 5. Khởi tạo & Tính toán bảng lương dự thảo
router.post('/generate', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), generatePayroll);

// 6. Khóa sổ lương tháng & chốt công (Hỗ trợ cả POST /lock và PUT /:id/lock)
router.post('/lock', verifyRole(['admin', 'bgh', 'ke_toan']), lockPayroll);
router.put('/:id/lock', verifyRole(['admin', 'bgh', 'ke_toan']), lockPayroll);

// 7. Mở khóa sổ lương tháng (Admin/BGH - Hỗ trợ cả POST /unlock và PUT /:id/unlock)
router.post('/unlock', verifyRole(['admin', 'bgh', 'ke_toan']), unlockPayroll);
router.put('/:id/unlock', verifyRole(['admin', 'bgh', 'ke_toan']), unlockPayroll);

// 8. Tra cứu danh sách bảng lương
router.get('/', getPayrolls);

// 9. Xem chi tiết phiếu lương theo ID
router.get('/:id', getPayrollById);

module.exports = router;

