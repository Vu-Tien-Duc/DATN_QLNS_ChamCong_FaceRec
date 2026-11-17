// Mô hình bảng ngoai_le_lich_trinh: ngày nghỉ, hủy, dạy bù hoặc đổi ca của một lịch trình.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk } = require('./modelHelpers');

const TRANG_THAI_NGOAI_LE = ['nghi', 'huy', 'day_bu', 'doi_ca'];

class NgoaiLeLichTrinh extends Model {}

NgoaiLeLichTrinh.init(
  {
    id: uuidPk(),
    lich_trinh_id: uuidFk(false),
    ngay: { type: DataTypes.DATEONLY, allowNull: false },
    ly_do: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    trang_thai: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'nghi',
      validate: { isIn: { args: [TRANG_THAI_NGOAI_LE], msg: 'Trạng thái ngoại lệ không hợp lệ' } },
    },
    ngay_day_bu: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'NgoaiLeLichTrinh',
    tableName: 'ngoai_le_lich_trinh',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['lich_trinh_id', 'ngay'] }],
  }
);

module.exports = NgoaiLeLichTrinh;
module.exports.TRANG_THAI_NGOAI_LE = TRANG_THAI_NGOAI_LE;
