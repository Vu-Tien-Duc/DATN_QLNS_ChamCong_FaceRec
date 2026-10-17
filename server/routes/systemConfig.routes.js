const express = require('express');
const router = express.Router();
const {
  getSystemConfigs,
  updateSystemConfig,
} = require('../controllers/systemConfig.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.use(authorizeRoles('admin'));

// GET /api/system/configs - Lấy danh sách cấu hình hệ thống
router.get('/configs', getSystemConfigs);

// PUT /api/system/configs - Cập nhật giá trị cấu hình (có ghi audit log)
router.put('/configs', updateSystemConfig);

module.exports = router;
