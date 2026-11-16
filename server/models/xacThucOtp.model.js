const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk } = require('./modelHelpers');

const LOAI_OTP = ['forgot_password', 'verify_email'];

/** Bảng xac_thuc_otp: mã OTP băm SHA-256 (64 ký tự hex), vòng đời ngắn, tách khỏi nguoi_dung. */
class XacThucOtp extends Model {
  conHieuLuc(at = new Date()) {
    return !this.da_su_dung && new Date(this.het_han_luc).getTime() > at.getTime();
  }
}

XacThucOtp.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    loai_otp: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { isIn: { args: [LOAI_OTP], msg: 'Loại OTP không hợp lệ' } },
    },
    ma_otp: { type: DataTypes.STRING(64), allowNull: false },
    het_han_luc: { type: DataTypes.DATE, allowNull: false },
    so_lan_thu: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    da_su_dung: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    gui_luc: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'XacThucOtp',
    tableName: 'xac_thuc_otp',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    indexes: [{ fields: ['nguoi_dung_id', 'loai_otp', 'da_su_dung'] }],
  }
);

module.exports = XacThucOtp;
module.exports.LOAI_OTP = LOAI_OTP;
