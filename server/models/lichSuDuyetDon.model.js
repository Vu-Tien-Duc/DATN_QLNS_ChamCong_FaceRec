const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk } = require('./modelHelpers');

/** Bảng lich_su_duyet_don: mỗi bước phê duyệt đa cấp của một đơn (chỉ có thoi_diem). */
class LichSuDuyetDon extends Model {}

LichSuDuyetDon.init(
  {
    id: uuidPk(),
    don_nghi_phep_id: uuidFk(false),
    nguoi_duyet_id: uuidFk(false),
    cap_duyet: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
    hanh_dong: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
    y_kien: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    thoi_diem: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'LichSuDuyetDon',
    tableName: 'lich_su_duyet_don',
    timestamps: false,
    indexes: [{ fields: ['don_nghi_phep_id'] }],
  }
);

module.exports = LichSuDuyetDon;
