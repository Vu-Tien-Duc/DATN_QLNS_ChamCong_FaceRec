// Mô hình bảng lich_trinh_tuan: danh sách các tuần học áp dụng của một lịch trình.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidFk } = require('./modelHelpers');

class LichTrinhTuan extends Model {}

LichTrinhTuan.init(
  {
    lich_trinh_id: { ...uuidFk(false), primaryKey: true },
    tuan_thu: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      validate: { min: 1, max: 53 },
    },
  },
  {
    sequelize,
    modelName: 'LichTrinhTuan',
    tableName: 'lich_trinh_tuan',
    timestamps: false,
  }
);

module.exports = LichTrinhTuan;
