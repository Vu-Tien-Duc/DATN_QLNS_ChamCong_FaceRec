const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk } = require('./modelHelpers');

/** Bảng ma_lam_moi: Refresh Token Rotation (nhóm token chống Replay Attack). */
class MaLamMoi extends Model {
  daHetHan(at = new Date()) {
    return new Date(this.het_han_luc).getTime() <= at.getTime();
  }
}

MaLamMoi.init(
  {
    id: uuidPk(),
    chuoi_token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: { notEmpty: { msg: 'Chuỗi token là bắt buộc' } },
    },
    ma_nhom_token: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    da_su_dung: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    thoi_diem_su_dung: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    thiet_bi: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    dia_chi_ip: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    nguoi_dung_id: uuidFk(false),
    het_han_luc: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: { notNull: { msg: 'Thời điểm hết hạn là bắt buộc' } },
    },
  },
  {
    sequelize,
    modelName: 'MaLamMoi',
    tableName: 'ma_lam_moi',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['chuoi_token'] },
      { fields: ['nguoi_dung_id'] },
      { fields: ['het_han_luc'] },
    ],
  }
);

module.exports = MaLamMoi;
