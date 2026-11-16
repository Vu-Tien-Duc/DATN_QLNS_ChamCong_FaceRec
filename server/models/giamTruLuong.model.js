const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, moneyColumn } = require('./modelHelpers');

/** Bảng giam_tru_luong: từng khoản giảm trừ của một phiếu lương. */
class GiamTruLuong extends Model {}

GiamTruLuong.init(
  {
    id: uuidPk(),
    phieu_luong_id: uuidFk(false),
    ly_do: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
    so_tien: moneyColumn('so_tien'),
  },
  {
    sequelize,
    modelName: 'GiamTruLuong',
    tableName: 'giam_tru_luong',
    timestamps: false,
    indexes: [{ fields: ['phieu_luong_id'] }],
  }
);

module.exports = GiamTruLuong;
