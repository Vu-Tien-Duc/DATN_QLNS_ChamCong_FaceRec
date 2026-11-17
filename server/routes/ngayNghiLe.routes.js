// Định tuyến API quản lý danh mục ngày nghỉ lễ trong năm (/api/ngay-nghi-le)
const express = require('express');
const router = express.Router();
const {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/ngayNghiLe.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

// Tra cứu ngày nghỉ lễ (toàn bộ cán bộ đã đăng nhập đều được xem)
router.get('/', getHolidays);
router.get('/:id', getHolidayById);

// Thêm, sửa, xóa ngày nghỉ lễ (Admin & BGH)
router.post('/', authorizeRoles('admin', 'bgh'), createHoliday);
router.put('/:id', authorizeRoles('admin', 'bgh'), updateHoliday);
router.delete('/:id', authorizeRoles('admin', 'bgh'), deleteHoliday);

module.exports = router;
