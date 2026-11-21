// Điểm gắn tập trung 18 nhóm API chính dưới tiền tố /api và endpoint kiểm tra sức khỏe hệ thống
const express = require('express');
const router = express.Router();

const authRoutes = require('./xacThuc.routes');
const userRoutes = require('./nguoiDung.routes');
const departmentRoutes = require('./phongBan.routes');
const shiftConfigRoutes = require('./caLamViec.routes');
const scheduleRoutes = require('./lichTrinh.routes');
const subjectRoutes = require('./monHoc.routes');
const attendanceRoutes = require('./chamCong.routes');
const leaveRequestRoutes = require('./donNghiPhep.routes');
const auditLogRoutes = require('./nhatKyKiemToan.routes');
const reportRoutes = require('./baoCao.routes');
const uploadRoutes = require('./taiTep.routes');
const notificationRoutes = require('./thongBao.routes');
const holidayRoutes = require('./ngayNghiLe.routes');
const systemConfigRoutes = require('./cauHinhHeThong.routes');
const faceRoutes = require('./khuonMat.routes');
const payrollRoutes = require('./phieuLuong.routes');
const aiRoutes = require('./troLyAi.routes');
const publicFacultyRoutes = require('./public_giangvien/giangVien.routes');

const { sequelize } = require('../config/db');

// Kiểm tra sức khỏe máy chủ an toàn (không rò rỉ danh sách bảng CSDL hay thông tin nội bộ)
const healthCheckHandler = async (req, res) => {
  let dbStatus = 'CONNECTING_OR_DISCONNECTED';
  try {
    await sequelize.authenticate();
    dbStatus = 'CONNECTED';
  } catch (_) {
    dbStatus = 'DISCONNECTED';
  }
  return res.status(dbStatus === 'CONNECTED' ? 200 : 503).json({
    status: dbStatus === 'CONNECTED' ? 'OK' : 'DEGRADED',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

router.get('/suc-khoe', healthCheckHandler);

// Gắn các phân hệ API chuẩn hóa 100% tiếng Việt (không dùng alias)
router.use('/xac-thuc', authRoutes);
router.use('/nguoi-dung', userRoutes);
router.use('/phong-ban', departmentRoutes);
router.use('/ca-lam-viec', shiftConfigRoutes);
router.use('/lich-trinh', scheduleRoutes);
router.use('/mon-hoc', subjectRoutes);
router.use('/cham-cong', attendanceRoutes);
router.use('/don-nghi-phep', leaveRequestRoutes);
router.use('/nhat-ky-kiem-toan', auditLogRoutes);
router.use('/bao-cao', reportRoutes);
router.use('/tai-tep', uploadRoutes);
router.use('/thong-bao', notificationRoutes);
router.use('/ngay-nghi-le', holidayRoutes);
router.use('/he-thong', systemConfigRoutes);
router.use('/khuon-mat', faceRoutes);
router.use('/phieu-luong', payrollRoutes);
router.use('/tro-ly-ai', aiRoutes);
router.use('/cong-khai/giang-vien', publicFacultyRoutes);

module.exports = router;
module.exports.healthCheckHandler = healthCheckHandler;
