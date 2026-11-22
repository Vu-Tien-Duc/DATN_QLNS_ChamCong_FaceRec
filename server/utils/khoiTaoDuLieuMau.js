// Khởi tạo dữ liệu mẫu ban đầu cho các bảng hệ thống trong SQL Server (đồng bộ 100% schema 3NF & 19 tham số chuẩn).
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
const { CAU_HINH_MAC_DINH } = require('../models/cauHinhHeThong.model');
const { CANONICAL_CONFIG_META } = require('../services/heThong/cauHinhHeThong.service');
const { runInTransaction } = require('./giaoDichDb');

// Lấy ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD)
const getTodayVietnamDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Chạy khởi tạo dữ liệu mẫu ban đầu trong transaction
const seedDatabase = async ({ silent = false } = {}) => {
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('[Seeder] Bắt đầu khởi tạo dữ liệu mẫu SQL Server 3NF...');

  const todayVn = getTodayVietnamDate();
  const currentYear = Number(todayVn.slice(0, 4));

  return runInTransaction(async (transaction) => {
    // 1. Cấu hình hệ thống (đủ 19 khóa chuẩn trong CAU_HINH_MAC_DINH & ALLOWED_CONFIG_KEYS)
    const defaultGeofence = {
      ...CAU_HINH_MAC_DINH.GEOFENCE_TRUONG,
      ...(process.env.CAMPUS_NAME ? { ten_co_so: process.env.CAMPUS_NAME } : {}),
      ...(process.env.CAMPUS_LAT && process.env.CAMPUS_LNG
        ? { toa_do: [Number(process.env.CAMPUS_LNG), Number(process.env.CAMPUS_LAT)] }
        : {}),
      ...(process.env.CAMPUS_RADIUS_METERS ? { ban_kinh_met: Number(process.env.CAMPUS_RADIUS_METERS) } : {}),
    };

    for (const [key, defaultVal] of Object.entries(CAU_HINH_MAC_DINH)) {
      const meta = CANONICAL_CONFIG_META[key] || { nhom: 'HE_THONG', mo_ta: `Tham số hệ thống ${key}` };
      const value = key === 'GEOFENCE_TRUONG' ? defaultGeofence : defaultVal;
      await CauHinhHeThong.findOrCreate({
        where: { khoa_cau_hinh: key },
        defaults: {
          khoa_cau_hinh: key,
          gia_tri: value,
          nhom: meta.nhom,
          mo_ta: meta.mo_ta,
        },
        transaction,
      });
    }

    // 2. Ca làm việc & ca giảng dạy
    const defaultShifts = [
      { ten_ca: 'Ca Sáng (Tiết 1-5)', gio_bat_dau: '07:00', gio_ket_thuc: '11:30', nguong_di_muon_phut: 15, kich_hoat: true },
      { ten_ca: 'Ca Hành chính', gio_bat_dau: '08:00', gio_ket_thuc: '17:00', nguong_di_muon_phut: 15, kich_hoat: true },
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

    // 3. Cơ cấu tổ chức 3 cấp: Khoa -> Bộ môn và các Phòng/Ban chức năng
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
    const [cnpmDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Bộ môn Công nghệ Phần mềm' },
      defaults: { ten_phong_ban: 'Bộ môn Công nghệ Phần mềm', loai_don_vi: 'bo_mon', don_vi_cha_id: cnttDept.id },
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
    const [dtDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Phòng Đào tạo' },
      defaults: { ten_phong_ban: 'Phòng Đào tạo', loai_don_vi: 'phong_ban' },
      transaction,
    });
    const [ktDept] = await PhongBan.findOrCreate({
      where: { ten_phong_ban: 'Phòng Kế toán - Tài chính' },
      defaults: { ten_phong_ban: 'Phòng Kế toán - Tài chính', loai_don_vi: 'phong_ban' },
      transaction,
    });

    // 4. Tài khoản người dùng, hồ sơ cán bộ (1:1) & phân quyền RBAC
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
        he_so_luong: 3.0,
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
        he_so_luong: 5.08,
      },
      {
        ma_can_bo: 'TK_CNTT01',
        ho_ten: 'TS. Trần Minh Tuấn',
        email: 'truongkhoa.cntt@ntu.edu.vn',
        vai_tro_chinh: 'truong_khoa',
        pham_vi: 'khoa',
        don_vi_chinh_id: cnttDept.id,
        managedDept: cnttDept,
        chuc_vu: 'Trưởng khoa CNTT',
        hoc_vi: 'tien_si',
        loai_nhan_su: 'giang_vien',
        he_so_luong: 4.4,
      },
      {
        ma_can_bo: 'PK_CNTT01',
        ho_ten: 'TS. Nguyễn Hoàng Nam',
        email: 'phokhoa.cntt@ntu.edu.vn',
        vai_tro_chinh: 'pho_khoa',
        pham_vi: 'khoa',
        don_vi_chinh_id: cnttDept.id,
        duoc_uy_quyen: true,
        chuc_vu: 'Phó Trưởng khoa CNTT',
        hoc_vi: 'tien_si',
        loai_nhan_su: 'giang_vien',
        he_so_luong: 3.99,
      },
      {
        ma_can_bo: 'TBM_CNPM01',
        ho_ten: 'ThS. Phạm Minh Khang',
        email: 'truongbomon.cnpm@ntu.edu.vn',
        vai_tro_chinh: 'truong_bo_mon',
        pham_vi: 'bo_mon',
        don_vi_chinh_id: cnpmDept.id,
        managedDept: cnpmDept,
        chuc_vu: 'Trưởng Bộ môn CNPM',
        hoc_vi: 'thac_si',
        loai_nhan_su: 'giang_vien',
        he_so_luong: 3.33,
      },
      {
        ma_can_bo: 'GV_CNTT01',
        ho_ten: 'ThS. Vũ Tiến Đức',
        email: 'ducvt.gv@ntu.edu.vn',
        vai_tro_chinh: 'giang_vien',
        pham_vi: 'bo_mon',
        don_vi_chinh_id: cnpmDept.id,
        chuc_vu: 'Giảng viên',
        hoc_vi: 'thac_si',
        loai_nhan_su: 'giang_vien',
        he_so_luong: 2.34,
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
        he_so_luong: 3.0,
      },
      {
        ma_can_bo: 'DAOTAO01',
        ho_ten: 'Nguyễn Minh Anh',
        email: 'daotao@ntu.edu.vn',
        vai_tro_chinh: 'dao_tao',
        pham_vi: 'toan_truong',
        don_vi_chinh_id: dtDept.id,
        chuc_vu: 'Chuyên viên Đào tạo',
        loai_nhan_su: 'chuyen_vien',
        he_so_luong: 3.0,
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
        he_so_luong: 3.33,
      },
    ];

    for (const u of seedUsers) {
      const [user] = await NguoiDung.findOrCreate({
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

      await HoSoCanBo.findOrCreate({
        where: { nguoi_dung_id: user.id },
        defaults: {
          nguoi_dung_id: user.id,
          chuc_vu: u.chuc_vu || '',
          hoc_ham: u.hoc_ham || 'khong',
          hoc_vi: u.hoc_vi || 'cu_nhan',
          loai_nhan_su: u.loai_nhan_su || 'giang_vien',
          loai_hop_dong: 'toan_thoi_gian',
          ngay_vao_lam: todayVn,
          he_so_luong: u.he_so_luong ?? 2.34,
          han_muc_phep_nam: 12,
        },
        transaction,
      });

      const roleDeptId = u.pham_vi === 'toan_truong' ? null : u.don_vi_chinh_id;
      await VaiTroNguoiDung.findOrCreate({
        where: {
          nguoi_dung_id: user.id,
          ma_vai_tro: u.vai_tro_chinh,
          don_vi_id: roleDeptId,
        },
        defaults: {
          nguoi_dung_id: user.id,
          ma_vai_tro: u.vai_tro_chinh,
          pham_vi: u.pham_vi,
          don_vi_id: roleDeptId,
          duoc_uy_quyen: Boolean(u.duoc_uy_quyen),
          tu_ngay: todayVn,
        },
        transaction,
      });

      // Đồng bộ truong_don_vi_id trên bảng phong_ban
      if (u.managedDept && !u.managedDept.truong_don_vi_id) {
        u.managedDept.truong_don_vi_id = user.id;
        await u.managedDept.save({ transaction });
      }
    }

    // 5. Môn học (gắn trực tiếp Khoa & Bộ môn con để kiểm chứng lọc cây đơn vị)
    const defaultSubjects = [
      { ma_mon: 'IT301', ten_mon: 'Lập trình Web Nâng cao', so_tin_chi: 3, phong_ban_id: cnpmDept.id },
      { ma_mon: 'IT402', ten_mon: 'Thị giác Máy tính & AI', so_tin_chi: 3, phong_ban_id: cnpmDept.id },
      { ma_mon: 'IT205', ten_mon: 'Hệ quản trị Cơ sở dữ liệu', so_tin_chi: 3, phong_ban_id: cnttDept.id },
    ];
    for (const sub of defaultSubjects) {
      await MonHoc.findOrCreate({
        where: { ma_mon: sub.ma_mon },
        defaults: sub,
        transaction,
      });
    }

    // 6. Ngày nghỉ lễ chuẩn trong năm (theo lịch Việt Nam)
    const defaultHolidays = [
      { ten_ngay_le: 'Tết Dương lịch', ngay_bat_dau: `${currentYear}-01-01`, ngay_ket_thuc: `${currentYear}-01-01`, huong_luong: true },
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
