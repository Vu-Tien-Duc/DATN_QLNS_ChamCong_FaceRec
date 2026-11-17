// Định tuyến API xem và cập nhật cấu hình hệ thống tập trung (/api/he-thong)
const express = require('express');
const router = express.Router();
const {
  getSystemConfigs,
  updateSystemConfig,
} = require('../controllers/cauHinhHeThong.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);
router.use(authorizeRoles('admin'));

// GET /api/he-thong/cau-hinh - Lấy danh sách cấu hình hệ thống
router.get('/cau-hinh', getSystemConfigs);

// PUT /api/he-thong/cau-hinh - Cập nhật giá trị cấu hình (có ghi audit log)
router.put('/cau-hinh', updateSystemConfig);

module.exports = router;
