// Khởi tạo dữ liệu mẫu ban đầu cho các bảng hệ thống trong SQL Server.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  CauHinhHeThong,
  NgayNghiLe,
  CaLamViec,
  PhongBan,
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  MonHoc,
} = require('../models');
const { runInTransaction } = require('./giaoDichDb');

// Chạy khởi tạo dữ liệu mẫu ban đầu trong transaction
const seedDatabase = async ({ silent = false } = {}) => {
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('[Seeder] Bắt đầu khởi tạo dữ liệu mẫu SQL Server 3NF...');

  return runInTransaction(async (transaction) => {
    // 1. Cấu hình hệ thống
    const defaultConfigs = [
      { khoa_cau_hinh: 'LUONG_CO_SO', gia_tri: 2530000, nhom: 'luong', mo_ta: 'Lương cơ sở 2026 (VNĐ)' },
      { khoa_cau_hinh: 'GIAM_TRU', gia_tri: { ban_than: 15500000, phu_thuoc: 6200000 }, nhom: 'luong', mo_ta: 'Giảm trừ gia cảnh TNCN' },
      { khoa_cau_hinh: 'TY_LE_BAO_HIEM', gia_tri: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 }, nhom: 'luong', mo_ta: 'Tỷ lệ bảo hiểm NLĐ đóng' },
      { khoa_cau_hinh: 'DON_GIA_GIO_VUOT', gia_tri: 120000, nhom: 'luong', mo_ta: 'Đơn giá giờ giảng vượt định mức' },
      { khoa_cau_hinh: 'DINH_MUC_GIO_CHUAN', gia_tri: 135, nhom: 'luong', mo_ta: 'Định mức giờ chuẩn học kỳ' },
      { khoa_cau_hinh: 'DEFAULT_LATE_THRESHOLD_MINUTES', gia_tri: 15, nhom: 'cham_cong', mo_ta: 'Ngưỡng đi muộn mặc định (phút)' },
      { khoa_cau_hinh: 'CAMPUS_GPS_RADIUS_METERS', gia_tri: 500, nhom: 'cham_cong', mo_ta: 'Bán kính GPS khuôn viên trường (mét)' },
      {
        khoa_cau_hinh: 'CAMPUS_GEOFENCE',
        gia_tri: {
          name: process.env.CAMPUS_NAME || 'Khuôn viên Cơ sở chính - Trường Đại học',
          lat: Number(process.env.CAMPUS_LAT || '20.965483'),
          lng: Number(process.env.CAMPUS_LNG || '105.729905'),
          radiusMeters: Number(process.env.CAMPUS_RADIUS_METERS || '500'),
        },
        nhom: 'cham_cong',
        mo_ta: 'Tọa độ và bán kính khuôn viên trường',
      },
      { khoa_cau_hinh: 'SYSTEM_MAINTENANCE_MODE', gia_tri: false, nhom: 'he_thong', mo_ta: 'Chế độ bảo trì hệ thống' },
    ];

    for (const cfg of defaultConfigs) {
      await CauHinhHeThong.findOrCreate({
        where: { khoa_cau_hinh: cfg.khoa_cau_hinh },
        defaults: cfg,
        transaction,
      });
    }

    // 2. Ca làm việc
    const defaultShifts = [
      { ten_ca: 'Ca Sáng (Tiết 1-5)', gio_bat_dau: '07:00', gio_ket_thuc: '11:30', nguong_di_muon_phut: 15, kich_hoat: true },
      { ten_ca: 'Ca Chiều (Tiết 6-10)', gio_bat_dau: '13:00', gio_ket_thuc: '17:30', nguong_di_muon_phut: 15, kich_hoat: true },
      { ten_ca: 'Ca Tối (Tiết 11-14)', gio_bat_dau: '18:00', gio_ket_thuc: '21:00', nguong_di_muon_phut: 15, kich_hoat: true },
    ];

    for (const s of defaultShifts) {
      await CaLamViec.findOrCreate({
        where: { ten_ca: s.ten_ca },
        defaults: s,
        transaction,
      });
    }

    // 3. Phòng ban / Khoa (loai_don_vi chỉ chấp nhận: khoa, bo_mon, phong_ban)
    const [bghDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Ban Giám Hiệu' },
      defaults: { ten_phong_ban: 'Ban Giám Hiệu', loai_don_vi: 'phong_ban' },
      transaction,
    });
    const [cnttDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Khoa Công nghệ Thông tin' },
      defaults: { ten_phong_ban: 'Khoa Công nghệ Thông tin', loai_don_vi: 'khoa' },
      transaction,
    });
    await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Khoa Kinh tế' },
      defaults: { ten_phong_ban: 'Khoa Kinh tế', loai_don_vi: 'khoa' },
      transaction,
    });
    const [tccbDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Phòng Tổ chức Cán bộ' },
      defaults: { ten_phong_ban: 'Phòng Tổ chức Cán bộ', loai_don_vi: 'phong_ban' },
      transaction,
    });
    const [ktDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Phòng Kế toán - Tài chính' },
      defaults: { ten_phong_ban: 'Phòng Kế toán - Tài chính', loai_don_vi: 'phong_ban' },
      transaction,
    });

    // 4. Người dùng + Hồ sơ cán bộ + Vai trò
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const seedUsers = [
      {
        ma_can_bo: 'ADMIN01',
        ho_ten: 'Quản trị viên Hệ thống',
        email: 'admin@ntu.edu.vn',
        vai_tro_chinh: 'admin',
        pham_vi: 'toan_truong',
        don_vi_chinh_id: bghDept.id,
        chuc_vu: 'Quản trị hệ thống',
        loai_nhan_su: 'nhan_vien',
      },
      {
        ma_can_bo: 'BGH01',
        ho_ten: 'PGS.TS. Nguyễn Văn Hiệu',
        email: 'hieutruong@ntu.edu.vn',
        vai_tro_chinh: 'bgh',
        pham_vi: 'toan_truong',
        don_vi_chinh_id: bghDept.id,
        chuc_vu: 'Hiệu trưởng',
        hoc_ham: 'pho_giao_su',
        hoc_vi: 'tien_si',
        loai_nhan_su: 'can_bo_quan_ly',
      },
      {
        ma_can_bo: 'TK_CNTT01',
        ho_ten: 'TS. Trần Minh Tuấn',
        email: 'truongkhoa.cntt@ntu.edu.vn',
        vai_tro_chinh: 'truong_khoa',
        pham_vi: 'khoa',
        don_vi_chinh_id: cnttDept.id,
        chuc_vu: 'Trưởng khoa CNTT',
        hoc_vi: 'tien_si',
        loai_nhan_su: 'giang_vien',
      },
      {
        ma_can_bo: 'GV_CNTT01',
        ho_ten: 'ThS. Vũ Tiến Đức',
        email: 'ducvt.gv@ntu.edu.vn',
        vai_tro_chinh: 'giang_vien',
        pham_vi: 'khoa',
        don_vi_chinh_id: cnttDept.id,
        chuc_vu: 'Giảng viên',
        hoc_vi: 'thac_si',
        loai_nhan_su: 'giang_vien',
      },
      {
        ma_can_bo: 'TCCB01',
        ho_ten: 'Lê Thị Hương',
        email: 'tccb@ntu.edu.vn',
        vai_tro_chinh: 'tccb',
        pham_vi: 'toan_truong',
        don_vi_chinh_id: tccbDept.id,
        chuc_vu: 'Chuyên viên TCCB',
        loai_nhan_su: 'chuyen_vien',
      },
      {
        ma_can_bo: 'KT01',
        ho_ten: 'Phạm Thu Hà',
        email: 'ketoan@ntu.edu.vn',
        vai_tro_chinh: 'ke_toan',
        pham_vi: 'toan_truong',
        don_vi_chinh_id: ktDept.id,
        chuc_vu: 'Kế toán trưởng',
        loai_nhan_su: 'nhan_vien',
      },
    ];

    for (const u of seedUsers) {
      const [user, created] = await NguoiDung.findOrCreate({
        where: { email: u.email },
        defaults: {
          ma_can_bo: u.ma_can_bo,
          ho_ten: u.ho_ten,
          email: u.email,
          mat_khau_ma_hoa: hashedPassword,
          vai_tro_chinh: u.vai_tro_chinh,
          don_vi_chinh_id: u.don_vi_chinh_id,
          kich_hoat: true,
        },
        transaction,
      });

      if (created) {
        await HoSoCanBo.create(
          {
            nguoi_dung_id: user.id,
            chuc_vu: u.chuc_vu || null,
            hoc_ham: u.hoc_ham || 'khong',
            hoc_vi: u.hoc_vi || 'cu_nhan',
            loai_nhan_su: u.loai_nhan_su || 'giang_vien',
            he_so_luong: 3.0,
            han_muc_phep_nam: 12,
          },
          { transaction }
        );

        await VaiTroNguoiDung.create(
          {
            nguoi_dung_id: user.id,
            ma_vai_tro: u.vai_tro_chinh,
            pham_vi: u.pham_vi,
            don_vi_id: u.pham_vi === 'toan_truong' ? null : u.don_vi_chinh_id,
          },
          { transaction }
        );
      }
    }

    // 5. Môn học
    const defaultSubjects = [
      { ma_mon: 'IT301', ten_mon: 'Lập trình Web Nâng cao', so_tin_chi: 3, phong_ban_id: cnttDept.id },
      { ma_mon: 'IT402', ten_mon: 'Thị giác Máy tính & AI', so_tin_chi: 3, phong_ban_id: cnttDept.id },
      { ma_mon: 'IT205', ten_mon: 'Hệ quản trị Cơ sở dữ liệu', so_tin_chi: 3, phong_ban_id: cnttDept.id },
    ];
    for (const sub of defaultSubjects) {
      await MonHoc.findOrCreate({
        where: { ma_mon: sub.ma_mon },
        defaults: sub,
        transaction,
      });
    }

    // 6. Ngày nghỉ lễ
    const currentYear = new Date().getFullYear();
    const defaultHolidays = [
      { ten_ngay_le: 'Ngày Giải phóng miền Nam & Quốc tế Lao động', ngay_bat_dau: `${currentYear}-04-30`, ngay_ket_thuc: `${currentYear}-05-01`, huong_luong: true },
      { ten_ngay_le: 'Ngày Quốc khánh 2/9', ngay_bat_dau: `${currentYear}-09-02`, ngay_ket_thuc: `${currentYear}-09-02`, huong_luong: true },
    ];
    for (const h of defaultHolidays) {
      await NgayNghiLe.findOrCreate({
        where: { ngay_bat_dau: h.ngay_bat_dau, ngay_ket_thuc: h.ngay_ket_thuc },
        defaults: h,
        transaction,
      });
    }

    log('[Seeder] Hoàn tất khởi tạo dữ liệu mẫu.');
    return { success: true };
  });
};

if (require.main === module) {
  const { sequelize } = require('../config/db');
  seedDatabase()
    .then(() => {
      console.log('[Seeder] Thành công!');
      return sequelize.close();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seeder] Lỗi:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
