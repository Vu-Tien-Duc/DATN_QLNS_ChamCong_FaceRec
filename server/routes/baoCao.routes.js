// Định tuyến API tổng hợp báo cáo chấm công, báo cáo tháng và xuất dữ liệu Excel (/api/bao-cao)
const express = require('express');
const router = express.Router();
const { getAttendanceReport, getMonthlyReport, getExportReportData } = require('../controllers/baoCao.controller');
const { verifyToken, requireAnyPermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

// Báo cáo tổng hợp chấm công: Cá nhân xem của mình, lãnh đạo đơn vị xem đơn vị, BGH/Admin/TCCB/Kế toán/Kiểm toán xem toàn trường
router.get(
  '/cham-cong',
  requireAnyPermission(
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_XEM_TOAN_TRUONG
  ),
  getAttendanceReport
);

// Báo cáo chi tiết theo tháng: Dành cho cấp quản lý đơn vị và quản trị cấp trường
router.get(
  '/hang-thang',
  requireAnyPermission(PERMISSIONS.CONG_XEM_DON_VI, PERMISSIONS.CONG_XEM_TOAN_TRUONG),
  getMonthlyReport
);

// Dữ liệu trích xuất báo cáo Excel 5 Sheets
router.get(
  '/du-lieu-xuat',
  requireAnyPermission(
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_XEM_TOAN_TRUONG
  ),
  getExportReportData
);

module.exports = router;
