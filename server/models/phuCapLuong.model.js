const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, moneyColumn, decimalColumn } = require('./modelHelpers');

/** Bảng phu_cap_luong: từng khoản phụ cấp của một phiếu lương. */
class PhuCapLuong extends Model {}

PhuCapLuong.init(
  {
    id: uuidPk(),
    phieu_luong_id: uuidFk(false),
    loai_phu_cap: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
    he_so_hoac_ty_le: decimalColumn('he_so_hoac_ty_le', 5, 2, 0),
    so_tien: moneyColumn('so_tien'),
  },
  {
    sequelize,
    modelName: 'PhuCapLuong',
    tableName: 'phu_cap_luong',
    timestamps: false,
    indexes: [{ fields: ['phieu_luong_id'] }],
  }
);

module.exports = PhuCapLuong;
