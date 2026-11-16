const { sequelize, Sequelize } = require('../config/db');

// Import toàn bộ 24 mô hình CSDL (chuẩn 3NF - docs/schema_3nf_sqlserver.sql)
const CauHinhHeThong = require('./cauHinhHeThong.model');
const NgayNghiLe = require('./ngayNghiLe.model');
const CaLamViec = require('./caLamViec.model');
const PhongBan = require('./phongBan.model');
const NguoiDung = require('./nguoiDung.model');
const HoSoCanBo = require('./hoSoCanBo.model');
const VaiTroNguoiDung = require('./vaiTroNguoiDung.model');
const XacThucOtp = require('./xacThucOtp.model');
const MauKhuonMat = require('./mauKhuonMat.model');
const MonHoc = require('./monHoc.model');
const LichTrinh = require('./lichTrinh.model');
const LichTrinhTuan = require('./lichTrinhTuan.model');
const NgoaiLeLichTrinh = require('./ngoaiLeLichTrinh.model');
const NhatKyChamCong = require('./nhatKyChamCong.model');
const LuotQuetChamCong = require('./luotQuetChamCong.model');
const DonNghiPhep = require('./donNghiPhep.model');
const LichSuDuyetDon = require('./lichSuDuyetDon.model');
const PhieuLuong = require('./phieuLuong.model');
const PhuCapLuong = require('./phuCapLuong.model');
const GiamTruLuong = require('./giamTruLuong.model');
const MaLamMoi = require('./maLamMoi.model');
const NhatKyKiemToan = require('./nhatKyKiemToan.model');
const TaiLieuRag = require('./taiLieuRag.model');
const PhanDoanTaiLieu = require('./phanDoanTaiLieu.model');

// =========================================================================
// ASSOCIATIONS: khóa ngoại khớp 1-1 với DDL. SQL Server cấm nhiều đường CASCADE nên mọi FK dùng
// NO ACTION; chỉ các bảng con thuần túy (hồ sơ, vai trò, OTP, tuần học, chi tiết lương...) dùng CASCADE.
// Ứng dụng KHÔNG gọi sequelize.sync(): CSDL được tạo bằng docs/schema_3nf_sqlserver.sql.
// =========================================================================

const noAction = { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' };
const cascade = { onDelete: 'CASCADE', onUpdate: 'NO ACTION' };

// ---- Tổ chức & tài khoản ----
PhongBan.hasMany(PhongBan, { foreignKey: 'don_vi_cha_id', as: 'don_vi_con', ...noAction });
PhongBan.belongsTo(PhongBan, { foreignKey: 'don_vi_cha_id', as: 'don_vi_cha', ...noAction });
PhongBan.belongsTo(NguoiDung, { foreignKey: 'truong_don_vi_id', as: 'truong_don_vi', constraints: false });

PhongBan.hasMany(NguoiDung, { foreignKey: 'don_vi_chinh_id', as: 'nhan_su', ...noAction });
NguoiDung.belongsTo(PhongBan, { foreignKey: 'don_vi_chinh_id', as: 'don_vi_chinh', ...noAction });

NguoiDung.hasOne(HoSoCanBo, { foreignKey: 'nguoi_dung_id', as: 'ho_so', ...cascade });
HoSoCanBo.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...cascade });

// Alias `danh_sach_vai_tro` được config/permissions.js sử dụng để tính quyền hiệu lực
NguoiDung.hasMany(VaiTroNguoiDung, { foreignKey: 'nguoi_dung_id', as: 'danh_sach_vai_tro', ...cascade });
VaiTroNguoiDung.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...cascade });
VaiTroNguoiDung.belongsTo(PhongBan, { foreignKey: 'don_vi_id', as: 'don_vi', ...noAction });

NguoiDung.hasMany(XacThucOtp, { foreignKey: 'nguoi_dung_id', as: 'danh_sach_otp', ...cascade });
XacThucOtp.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...cascade });

NguoiDung.hasMany(MauKhuonMat, { foreignKey: 'nguoi_dung_id', as: 'mau_khuon_mat', ...cascade });
MauKhuonMat.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...cascade });

NguoiDung.hasMany(MaLamMoi, { foreignKey: 'nguoi_dung_id', as: 'ma_lam_moi', ...cascade });
MaLamMoi.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...cascade });

// ---- Đào tạo & lịch trình ----
PhongBan.hasMany(MonHoc, { foreignKey: 'phong_ban_id', as: 'mon_hoc', ...noAction });
MonHoc.belongsTo(PhongBan, { foreignKey: 'phong_ban_id', as: 'phong_ban', ...noAction });

NguoiDung.hasMany(LichTrinh, { foreignKey: 'nguoi_dung_id', as: 'lich_trinh', ...noAction });
LichTrinh.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'giang_vien', ...noAction });
CaLamViec.hasMany(LichTrinh, { foreignKey: 'ca_id', as: 'lich_trinh', ...noAction });
LichTrinh.belongsTo(CaLamViec, { foreignKey: 'ca_id', as: 'ca', ...noAction });
MonHoc.hasMany(LichTrinh, { foreignKey: 'mon_hoc_id', as: 'lich_trinh', ...noAction });
LichTrinh.belongsTo(MonHoc, { foreignKey: 'mon_hoc_id', as: 'mon_hoc', ...noAction });

LichTrinh.hasMany(LichTrinhTuan, { foreignKey: 'lich_trinh_id', as: 'tuan_hoc', ...cascade });
LichTrinhTuan.belongsTo(LichTrinh, { foreignKey: 'lich_trinh_id', as: 'lich_trinh', ...cascade });

// Alias `ngoai_le` được utils/scheduleDate.utils.js sử dụng
LichTrinh.hasMany(NgoaiLeLichTrinh, { foreignKey: 'lich_trinh_id', as: 'ngoai_le', ...cascade });
NgoaiLeLichTrinh.belongsTo(LichTrinh, { foreignKey: 'lich_trinh_id', as: 'lich_trinh', ...cascade });

// ---- Chấm công ----
NguoiDung.hasMany(NhatKyChamCong, { foreignKey: 'nguoi_dung_id', as: 'nhat_ky_cham_cong', ...noAction });
NhatKyChamCong.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...noAction });
NhatKyChamCong.belongsTo(NguoiDung, { foreignKey: 'nguoi_ghi_de_id', as: 'nguoi_ghi_de', ...noAction });
CaLamViec.hasMany(NhatKyChamCong, { foreignKey: 'ca_id', as: 'nhat_ky_cham_cong', ...noAction });
NhatKyChamCong.belongsTo(CaLamViec, { foreignKey: 'ca_id', as: 'ca', ...noAction });
LichTrinh.hasMany(NhatKyChamCong, { foreignKey: 'lich_trinh_id', as: 'nhat_ky_cham_cong', ...noAction });
NhatKyChamCong.belongsTo(LichTrinh, { foreignKey: 'lich_trinh_id', as: 'lich_trinh', ...noAction });
NhatKyChamCong.belongsTo(DonNghiPhep, { foreignKey: 'don_tu_id', as: 'don_tu', ...noAction });

NguoiDung.hasMany(LuotQuetChamCong, { foreignKey: 'nguoi_dung_id', as: 'luot_quet', ...noAction });
LuotQuetChamCong.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...noAction });
NhatKyChamCong.hasMany(LuotQuetChamCong, { foreignKey: 'cham_cong_id', as: 'luot_quet', ...noAction });
LuotQuetChamCong.belongsTo(NhatKyChamCong, { foreignKey: 'cham_cong_id', as: 'cham_cong', ...noAction });

// ---- Đơn từ & phê duyệt ----
NguoiDung.hasMany(DonNghiPhep, { foreignKey: 'nguoi_dung_id', as: 'don_nghi_phep', ...noAction });
DonNghiPhep.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...noAction });
DonNghiPhep.belongsTo(NguoiDung, { foreignKey: 'nguoi_duyet_id', as: 'nguoi_duyet', ...noAction });
DonNghiPhep.belongsTo(NguoiDung, { foreignKey: 'giang_vien_day_thay_id', as: 'giang_vien_day_thay', ...noAction });
DonNghiPhep.belongsTo(LichTrinh, { foreignKey: 'lich_trinh_id', as: 'lich_trinh', ...noAction });
DonNghiPhep.belongsTo(CaLamViec, { foreignKey: 'ca_thay_the_id', as: 'ca_thay_the', ...noAction });

DonNghiPhep.hasMany(LichSuDuyetDon, { foreignKey: 'don_nghi_phep_id', as: 'lich_su_duyet', ...cascade });
LichSuDuyetDon.belongsTo(DonNghiPhep, { foreignKey: 'don_nghi_phep_id', as: 'don_nghi_phep', ...cascade });
LichSuDuyetDon.belongsTo(NguoiDung, { foreignKey: 'nguoi_duyet_id', as: 'nguoi_duyet', ...noAction });

// ---- Tiền lương ----
NguoiDung.hasMany(PhieuLuong, { foreignKey: 'nguoi_dung_id', as: 'phieu_luong', ...noAction });
PhieuLuong.belongsTo(NguoiDung, { foreignKey: 'nguoi_dung_id', as: 'nguoi_dung', ...noAction });
PhieuLuong.belongsTo(NguoiDung, { foreignKey: 'nguoi_lap_id', as: 'nguoi_lap', ...noAction });
PhieuLuong.belongsTo(NguoiDung, { foreignKey: 'nguoi_duyet_id', as: 'nguoi_duyet', ...noAction });

PhieuLuong.hasMany(PhuCapLuong, { foreignKey: 'phieu_luong_id', as: 'danh_sach_phu_cap', ...cascade });
PhuCapLuong.belongsTo(PhieuLuong, { foreignKey: 'phieu_luong_id', as: 'phieu_luong', ...cascade });
PhieuLuong.hasMany(GiamTruLuong, { foreignKey: 'phieu_luong_id', as: 'cac_khoan_giam_tru', ...cascade });
GiamTruLuong.belongsTo(PhieuLuong, { foreignKey: 'phieu_luong_id', as: 'phieu_luong', ...cascade });

// ---- Kiểm toán & AI RAG ----
NguoiDung.hasMany(NhatKyKiemToan, { foreignKey: 'nguoi_thuc_hien_id', as: 'nhat_ky_kiem_toan', ...noAction });
NhatKyKiemToan.belongsTo(NguoiDung, { foreignKey: 'nguoi_thuc_hien_id', as: 'nguoi_thuc_hien', ...noAction });

NguoiDung.hasMany(TaiLieuRag, { foreignKey: 'nguoi_tai_id', as: 'tai_lieu_rag', ...noAction });
TaiLieuRag.belongsTo(NguoiDung, { foreignKey: 'nguoi_tai_id', as: 'nguoi_tai', ...noAction });
TaiLieuRag.hasMany(PhanDoanTaiLieu, { foreignKey: 'tai_lieu_id', as: 'cac_doan', ...cascade });
PhanDoanTaiLieu.belongsTo(TaiLieuRag, { foreignKey: 'tai_lieu_id', as: 'tai_lieu', ...cascade });

module.exports = {
  sequelize,
  Sequelize,
  CauHinhHeThong,
  NgayNghiLe,
  CaLamViec,
  PhongBan,
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  XacThucOtp,
  MauKhuonMat,
  MonHoc,
  LichTrinh,
  LichTrinhTuan,
  NgoaiLeLichTrinh,
  NhatKyChamCong,
  LuotQuetChamCong,
  DonNghiPhep,
  LichSuDuyetDon,
  PhieuLuong,
  PhuCapLuong,
  GiamTruLuong,
  MaLamMoi,
  NhatKyKiemToan,
  TaiLieuRag,
  PhanDoanTaiLieu,
};
