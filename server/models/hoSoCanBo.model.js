const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, decimalColumn } = require('./modelHelpers');

const GIOI_TINH = ['nam', 'nu', 'khac'];
const LOAI_NHAN_SU = ['giang_vien', 'can_bo_quan_ly', 'chuyen_vien', 'nhan_vien'];
const LOAI_HOP_DONG = ['toan_thoi_gian', 'ban_thoi_gian', 'thinh_giang', 'hop_dong_vu_viec'];

const enumColumn = (name, values, defaultValue, length, msg) => ({
  type: DataTypes.STRING(length),
  allowNull: false,
  defaultValue,
  validate: { isIn: { args: [values], msg } },
  set(val) {
    this.setDataValue(name, val ? String(val).toLowerCase().trim() : defaultValue);
  },
});

/**
 * Bảng ho_so_can_bo: hồ sơ nhân sự / học thuật / lương / thuế / ngân hàng (1:1 với nguoi_dung).
 * Thâm niên được tính động từ ngay_bat_dau_giang_day (không lưu cột tham_nien_nam dư thừa).
 */
class HoSoCanBo extends Model {
  get tham_nien_nam() {
    const start = this.ngay_bat_dau_giang_day;
    if (!start) return 0;
    const years = (Date.now() - new Date(start).getTime()) / (365.25 * 24 * 3600 * 1000);
    return Math.max(0, Math.floor(years));
  }
}

HoSoCanBo.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    gioi_tinh: enumColumn('gioi_tinh', GIOI_TINH, 'nam', 20, 'Giới tính không hợp lệ'),
    ngay_sinh: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    dia_chi: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    chuc_vu: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    loai_nhan_su: enumColumn('loai_nhan_su', LOAI_NHAN_SU, 'giang_vien', 50, 'Loại nhân sự không hợp lệ'),
    loai_hop_dong: enumColumn('loai_hop_dong', LOAI_HOP_DONG, 'toan_thoi_gian', 50, 'Loại hợp đồng không hợp lệ'),
    ngay_vao_lam: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    ngay_het_han_hop_dong: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    hoc_ham: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'khong',
      set(val) {
        this.setDataValue('hoc_ham', val ? String(val).toLowerCase().trim() : 'khong');
      },
    },
    hoc_vi: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'cu_nhan',
      set(val) {
        this.setDataValue('hoc_vi', val ? String(val).toLowerCase().trim() : 'cu_nhan');
      },
    },
    ngach_luong: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'V.07.01.03' },
    he_so_luong: { ...decimalColumn('he_so_luong', 5, 2, 2.34), validate: { min: 0.01 } },
    ngay_bat_dau_giang_day: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    so_nguoi_phu_thuoc: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    so_cccd: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    ma_so_thue: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    so_tai_khoan_ngan_hang: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    ten_ngan_hang: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    chi_nhanh_ngan_hang: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    han_muc_phep_nam: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12, validate: { min: 0 } },
  },
  {
    sequelize,
    modelName: 'HoSoCanBo',
    tableName: 'ho_so_can_bo',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      hanHopDongHopLe() {
        if (this.ngay_het_han_hop_dong && this.ngay_vao_lam
          && String(this.ngay_het_han_hop_dong) < String(this.ngay_vao_lam)) {
          throw new Error('Ngày hết hạn hợp đồng phải sau ngày vào làm');
        }
      },
    },
    indexes: [{ unique: true, fields: ['nguoi_dung_id'] }],
  }
);

module.exports = HoSoCanBo;
module.exports.GIOI_TINH = GIOI_TINH;
module.exports.LOAI_NHAN_SU = LOAI_NHAN_SU;
module.exports.LOAI_HOP_DONG = LOAI_HOP_DONG;
