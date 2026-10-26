const express = require('express');
const router = express.Router();
const {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holiday.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// GET /api/holidays?year=2026 - Lấy danh sách ngày nghỉ lễ (Tất cả cán bộ đã đăng nhập đều được xem)
router.get('/', getHolidays);
router.get('/:id', getHolidayById);

// POST /api/holidays - Tạo ngày nghỉ lễ mới (Admin & BGH)
router.post('/', authorizeRoles('admin', 'bgh'), createHoliday);

// PUT /api/holidays/:id - Cập nhật ngày nghỉ lễ
router.put('/:id', authorizeRoles('admin', 'bgh'), updateHoliday);

// DELETE /api/holidays/:id - Xóa ngày nghỉ lễ
router.delete('/:id', authorizeRoles('admin', 'bgh'), deleteHoliday);

module.exports = router;
