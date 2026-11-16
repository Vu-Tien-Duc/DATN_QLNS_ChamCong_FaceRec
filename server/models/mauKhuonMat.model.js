const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, encryptedJsonText } = require('./modelHelpers');

const SO_CHIEU_VECTOR = 512;

/**
 * Bảng mau_khuon_mat: hồ sơ sinh trắc khuôn mặt (vector ArcFace 512 chiều).
 * Mỗi người dùng có thể có nhiều bản ghi (lịch sử đăng ký) nhưng tối đa 1 bản mac_dinh = 1
 * (Filtered Unique Index UX_mau_khuon_mat_mac_dinh chống Race Condition).
 */
class MauKhuonMat extends Model {}

MauKhuonMat.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    vector_dac_trung: encryptedJsonText('vector_dac_trung', []),
    vector_trung_binh: encryptedJsonText('vector_trung_binh', null),
    so_chieu_vector: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: SO_CHIEU_VECTOR,
      validate: { isIn: { args: [[SO_CHIEU_VECTOR]], msg: `Vector phải có ${SO_CHIEU_VECTOR} chiều` } },
    },
    mo_hinh_ai: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'buffalo_s' },
    anh_dai_dien: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    so_luong_mau: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
    mac_dinh: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    trang_thai: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'da_kich_hoat',
      validate: { notEmpty: true },
    },
    ngay_dang_ky: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'MauKhuonMat',
    tableName: 'mau_khuon_mat',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    indexes: [
      { fields: ['nguoi_dung_id', 'mac_dinh'] },
      { unique: true, name: 'UX_mau_khuon_mat_mac_dinh', fields: ['nguoi_dung_id'], where: { mac_dinh: true } },
    ],
  }
);

module.exports = MauKhuonMat;
module.exports.SO_CHIEU_VECTOR = SO_CHIEU_VECTOR;
