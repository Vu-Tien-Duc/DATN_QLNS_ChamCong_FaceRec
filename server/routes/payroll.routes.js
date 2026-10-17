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
  getMyCurrentPayroll,
  exportPayrollExcel,
  exportPayrollPdf,
} = require('../controllers/payroll.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// 1. Xem phiếu lương của chính mình
router.get('/me/current', getMyCurrentPayroll);

// 2. Xuất dữ liệu báo cáo bảng lương Excel
router.get('/export/excel', verifyRole(['admin', 'hieutruong', 'hieupho', 'truongkhoa']), exportPayrollExcel);

// 3. Trích xuất dữ liệu phiếu lương PDF cá nhân
router.get('/:id/export/pdf', exportPayrollPdf);

// 4. Khởi tạo & Tính toán bảng lương dự thảo
router.post('/generate', verifyRole(['admin', 'hieutruong', 'hieupho', 'truongkhoa']), generatePayroll);

// 5. Khóa sổ lương tháng & chốt công
router.post('/lock', verifyRole(['admin', 'hieutruong', 'hieupho']), lockPayroll);

// 6. Mở khóa sổ lương tháng (Admin/BGH)
router.post('/unlock', verifyRole(['admin', 'hieutruong', 'hieupho']), unlockPayroll);

// 7. Tra cứu danh sách bảng lương
router.get('/', getPayrolls);

// 8. Xem chi tiết phiếu lương theo ID
router.get('/:id', getPayrollById);

module.exports = router;
