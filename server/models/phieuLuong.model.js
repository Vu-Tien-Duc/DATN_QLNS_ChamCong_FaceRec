// Mô hình bảng phieu_luong: lưu chứng từ lương chốt theo kỳ của nhân sự.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, moneyColumn, decimalColumn } = require('./modelHelpers');

const TRANG_THAI_LUONG = ['nhap', 'cho_duyet', 'da_duyet', 'da_chi_tra'];

class PhieuLuong extends Model {}

PhieuLuong.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    thang: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 12 } },
    nam: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 2000 } },
    nguoi_lap_id: uuidFk(false),
    nguoi_duyet_id: uuidFk(true),
    thoi_gian_duyet: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    luong_co_ban: moneyColumn('luong_co_ban'),
    he_so_luong: { ...decimalColumn('he_so_luong', 5, 2, 1.0), validate: { min: 0 } },
    so_cong_chuan: { ...decimalColumn('so_cong_chuan', 5, 2, 22), validate: { min: 0 } },
    so_cong_thuc_te: { ...decimalColumn('so_cong_thuc_te', 5, 2, 0), validate: { min: 0 } },
    so_tiet_nghia_vu: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    so_tiet_thuc_day: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    so_tiet_vuot_gio: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    don_gia_tiet_vuot: moneyColumn('don_gia_tiet_vuot'),
    tien_vuot_gio: moneyColumn('tien_vuot_gio'),
    tong_phu_cap: moneyColumn('tong_phu_cap'),
    tong_giam_tru: moneyColumn('tong_giam_tru'),
    dong_bao_hiem: moneyColumn('dong_bao_hiem'),
    thue_thu_nhap_ca_nhan: moneyColumn('thue_thu_nhap_ca_nhan'),
    thuc_linh: moneyColumn('thuc_linh'),
    trang_thai: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'nhap',
      validate: { isIn: { args: [TRANG_THAI_LUONG], msg: 'Trạng thái phiếu lương không hợp lệ' } },
    },
    ghi_chu: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'PhieuLuong',
    tableName: 'phieu_luong',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    indexes: [
      { unique: true, name: 'UQ_phieu_luong_user_ky', fields: ['nguoi_dung_id', 'thang', 'nam'] },
    ],
  }
);

module.exports = PhieuLuong;
module.exports.TRANG_THAI_LUONG = TRANG_THAI_LUONG;
