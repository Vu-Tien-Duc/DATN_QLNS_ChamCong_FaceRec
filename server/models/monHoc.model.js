const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, trimmedString } = require('./modelHelpers');

/** Bảng mon_hoc: danh mục môn học / học phần. */
class MonHoc extends Model {}

MonHoc.init(
  {
    id: uuidPk(),
    ma_mon: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { notEmpty: { msg: 'Mã môn học là bắt buộc' } },
      set(val) {
        this.setDataValue('ma_mon', val ? String(val).trim().toUpperCase() : val);
      },
    },
    ten_mon: trimmedString('ten_mon', 150, {
      allowNull: false,
      validate: { notEmpty: { msg: 'Tên môn học là bắt buộc' } },
    }),
    so_tin_chi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: { min: 1 },
    },
    phong_ban_id: uuidFk(true),
    mo_ta: { type: DataTypes.STRING(500), allowNull: true, defaultValue: '' },
    kich_hoat: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'MonHoc',
    tableName: 'mon_hoc',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    indexes: [
      { unique: true, fields: ['ma_mon'] },
      { fields: ['phong_ban_id'] },
    ],
  }
);

module.exports = MonHoc;
