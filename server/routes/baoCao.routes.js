// Định tuyến API tổng hợp báo cáo chấm công, báo cáo tháng và xuất dữ liệu Excel (/api/bao-cao)
const express = require('express');
const router = express.Router();
const { getAttendanceReport, getMonthlyReport, getExportReportData } = require('../controllers/baoCao.controller');
const { verifyToken, verifyRole } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

// Báo cáo tổng hợp chấm công: Cá nhân xem của mình, Trưởng khoa xem của khoa, BGH/Admin/Kế toán xem toàn trường
router.get('/cham-cong', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien']), getAttendanceReport);

// Báo cáo chi tiết theo tháng: Dành cho Admin, BGH, Kế toán và Trưởng khoa
router.get('/hang-thang', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']), getMonthlyReport);

// Dữ liệu trích xuất báo cáo Excel 5 Sheets
router.get('/du-lieu-xuat', verifyRole(['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien']), getExportReportData);

module.exports = router;

