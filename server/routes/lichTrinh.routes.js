// Định tuyến API quản lý thời khóa biểu giảng dạy, lịch hôm nay và ngoại lệ buổi học (/api/lich-trinh)
const express = require('express');
const router = express.Router();
const {
  getSchedules,
  getTodaySchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  addException,
} = require('../controllers/lichTrinh.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

router.get('/', getSchedules);
router.get('/hom-nay', getTodaySchedules);
router.get('/:id', getScheduleById);
router.post('/', authorizeRoles('admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao'), createSchedule);
router.put('/:id', authorizeRoles('admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao'), updateSchedule);
router.delete('/:id', authorizeRoles('admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao'), deleteSchedule);
router.post('/:id/ngoai-le', authorizeRoles('admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao', 'giang_vien', 'nhan_vien'), addException);

module.exports = router;
