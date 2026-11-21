// Định tuyến API tra cứu nhật ký kiểm toán và kiểm tra toàn vẹn chuỗi băm SHA-256 (/api/nhat-ky-kiem-toan)
const express = require('express');
const router = express.Router();
const { getAuditLogs, verifyAuditIntegrity } = require('../controllers/nhatKyKiemToan.controller');
const { verifyToken, verifyRole } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

// Chỉ Admin và Ban Giám Hiệu mới được tra cứu nhật ký kiểm toán hệ thống
router.get('/xac-minh-toan-ven', verifyRole(['admin', 'bgh']), verifyAuditIntegrity);
router.get('/', verifyRole(['admin', 'bgh']), getAuditLogs);

module.exports = router;
