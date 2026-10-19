const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const departmentRoutes = require('./department.routes');
const shiftConfigRoutes = require('./shiftConfig.routes');
const scheduleRoutes = require('./schedule.routes');
const subjectRoutes = require('./subject.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRequestRoutes = require('./leaveRequest.routes');
const auditLogRoutes = require('./auditLog.routes');
const reportRoutes = require('./report.routes');
const uploadRoutes = require('./upload.routes');
const aiRoutes = require('./ai.routes');
const notificationRoutes = require('./notification.routes');
const holidayRoutes = require('./holiday.routes');
const systemConfigRoutes = require('./systemConfig.routes');
const faceRoutes = require('./face.routes');
const payrollRoutes = require('./payroll.routes');

const mongoose = require('mongoose');

/**
 * Health check endpoint - Chuẩn hóa 14 Collections CSDL v2.5
 */
router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING_OR_DISCONNECTED';
  res.status(200).json({
    status: 'OK',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    collectionsCount: 14,
    collections: [
      'nguoi_dung',
      'mau_khuon_mat',
      'phong_ban',
      'ca_lam_viec',
      'mon_hoc',
      'lich_trinh',
      'ngay_nghi_le',
      'luot_quet_cham_cong',
      'nhat_ky_cham_cong',
      'don_nghi_phep',
      'phieu_luong',
      'ma_lam_moi',
      'cau_hinh_he_thong',
      'nhat_ky_kiem_toan',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Gắn các submodule routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/shifts', shiftConfigRoutes); // Chuẩn theo mục 3.3
router.use('/shift-configs', shiftConfigRoutes); // Alias hỗ trợ tên cũ
router.use('/schedules', scheduleRoutes);
router.use('/subjects', subjectRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/reports', reportRoutes);
router.use('/upload', uploadRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/holidays', holidayRoutes);
router.use('/system', systemConfigRoutes);
router.use('/face', faceRoutes);
router.use('/payrolls', payrollRoutes);

module.exports = router;
