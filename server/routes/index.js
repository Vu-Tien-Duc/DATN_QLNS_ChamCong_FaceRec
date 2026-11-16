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

/**
 * Health check endpoint - Chuẩn hóa 16 Bảng CSDL SQL Server v2.5
 */
router.get('/suc-khoe', async (req, res) => {
  let dbStatus = 'CONNECTING_OR_DISCONNECTED';
  try {
    await sequelize.authenticate();
    dbStatus = 'CONNECTED';
  } catch (_) {
    dbStatus = 'DISCONNECTED';
  }
  res.status(200).json({
    status: 'OK',
    database: dbStatus,
    databaseEngine: 'Microsoft SQL Server',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    tablesCount: 24,
    tables: [
      'cau_hinh_he_thong',
      'ngay_nghi_le',
      'ca_lam_viec',
      'phong_ban',
      'nguoi_dung',
      'ho_so_can_bo',
      'vai_tro_nguoi_dung',
      'xac_thuc_otp',
      'mau_khuon_mat',
      'mon_hoc',
      'lich_trinh',
      'lich_trinh_tuan',
      'ngoai_le_lich_trinh',
      'nhat_ky_cham_cong',
      'luot_quet_cham_cong',
      'don_nghi_phep',
      'lich_su_duyet_don',
      'phieu_luong',
      'phu_cap_luong',
      'giam_tru_luong',
      'ma_lam_moi',
      'nhat_ky_kiem_toan',
      'tai_lieu_rag',
      'phan_doan_tai_lieu',
    ],
    timestamp: new Date().toISOString(),
  });
});

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
