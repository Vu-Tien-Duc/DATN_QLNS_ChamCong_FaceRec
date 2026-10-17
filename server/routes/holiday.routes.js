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
router.use(authorizeRoles('admin'));

// GET /api/holidays?year=2026 - Lấy danh sách ngày nghỉ lễ
router.get('/', getHolidays);
router.get('/:id', getHolidayById);

// POST /api/holidays - Tạo ngày nghỉ lễ mới
router.post('/', createHoliday);

// PUT /api/holidays/:id - Cập nhật ngày nghỉ lễ
router.put('/:id', updateHoliday);

// DELETE /api/holidays/:id - Xóa ngày nghỉ lễ
router.delete('/:id', deleteHoliday);

module.exports = router;
