// Định tuyến API quản lý bảng lương tháng, khóa/mở sổ lương và xuất phiếu lương Excel/PDF
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
} = require('../controllers/phieuLuong.controller');
const { verifyToken, verifyRole, requirePermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

// 1. Xem phiếu lương của chính mình
router.get('/cua-toi', requirePermission(PERMISSIONS.LUONG_XEM_BAN_THAN), getMyPayroll);

// 2. Thống kê tổng hợp quỹ lương tháng
router.get('/tong-hop', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), getPayrollSummary);

// 3. Xuất dữ liệu báo cáo bảng lương Excel
router.get('/xuat-excel', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), exportPayrollExcel);

// Xuất dữ liệu phiếu lương PDF theo ID

router.get('/:id/xuat-pdf', exportPayrollPdf);

// 5. Khởi tạo & Tính toán bảng lương dự thảo
router.post('/khoi-tao', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), generatePayroll);

// Khóa sổ lương tháng & chốt công (POST /khoa hoặc PUT /:id/khoa)
router.post('/khoa', requirePermission(PERMISSIONS.LUONG_KHOA), verifyRole(['admin', 'bgh', 'ke_toan']), lockPayroll);
router.put('/:id/khoa', requirePermission(PERMISSIONS.LUONG_KHOA), verifyRole(['admin', 'bgh', 'ke_toan']), lockPayroll);

// Mở khóa sổ lương tháng (POST /mo-khoa hoặc PUT /:id/mo-khoa)
router.post('/mo-khoa', requirePermission(PERMISSIONS.LUONG_KHOA), verifyRole(['admin', 'bgh', 'ke_toan']), unlockPayroll);
router.put('/:id/mo-khoa', requirePermission(PERMISSIONS.LUONG_KHOA), verifyRole(['admin', 'bgh', 'ke_toan']), unlockPayroll);

// 8. Tra cứu danh sách bảng lương
router.get('/', getPayrolls);

// 9. Xem chi tiết phiếu lương theo ID
router.get('/:id', getPayrollById);

module.exports = router;

