const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, timeColumn, trimmedString } = require('./modelHelpers');

/** Bảng ca_lam_viec: khung giờ ca làm việc / ca giảng dạy. */
class CaLamViec extends Model {}

CaLamViec.init(
  {
    id: uuidPk(),
    ten_ca: trimmedString('ten_ca', 100, {
      allowNull: false,
      validate: { notEmpty: { msg: 'Tên ca làm việc là bắt buộc' } },
    }),
    gio_bat_dau: timeColumn('gio_bat_dau'),
    gio_ket_thuc: timeColumn('gio_ket_thuc'),
    nguong_di_muon_phut: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
      validate: { min: 0 },
    },
    kich_hoat: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'CaLamViec',
    tableName: 'ca_lam_viec',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
  }
);

module.exports = CaLamViec;
