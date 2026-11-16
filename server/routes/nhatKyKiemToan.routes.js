const express = require('express');
const router = express.Router();
const { getAuditLogs, verifyAuditIntegrity } = require('../controllers/nhatKyKiemToan.controller');
const { verifyToken, verifyRole } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

// Chỉ Admin, Ban Giám Hiệu và Kiểm toán mới được tra cứu nhật ký kiểm toán hệ thống
router.get('/xac-minh-toan-ven', verifyRole(['admin', 'bgh', 'kiem_toan']), verifyAuditIntegrity);
router.get('/', verifyRole(['admin', 'bgh', 'kiem_toan']), getAuditLogs);

module.exports = router;
