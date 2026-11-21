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
const { verifyToken, requirePermission, requireAnyPermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

router.get('/', getSchedules);
router.get('/hom-nay', getTodaySchedules);
router.get('/:id', getScheduleById);
router.post('/', requirePermission(PERMISSIONS.LICH_XEP_LICH), createSchedule);
router.put('/:id', requirePermission(PERMISSIONS.LICH_XEP_LICH), updateSchedule);
router.delete('/:id', requirePermission(PERMISSIONS.LICH_XEP_LICH), deleteSchedule);
router.post(
  '/:id/ngoai-le',
  requireAnyPermission(
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LICH_XEP_LICH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_BAN_THAN
  ),
  addException
);

module.exports = router;
