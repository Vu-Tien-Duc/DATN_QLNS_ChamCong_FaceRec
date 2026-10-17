const express = require('express');
const router = express.Router();
const { getAuditLogs, verifyAuditIntegrity } = require('../controllers/auditLog.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Chỉ Admin và Ban Giám Hiệu (Hiệu trưởng, Hiệu phó) mới được tra cứu nhật ký kiểm toán hệ thống
router.get('/verify-integrity', verifyRole(['admin', 'hieutruong', 'hieupho']), verifyAuditIntegrity);
router.get('/', verifyRole(['admin', 'hieutruong', 'hieupho']), getAuditLogs);

module.exports = router;
