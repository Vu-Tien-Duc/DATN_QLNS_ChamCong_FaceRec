const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, trimmedString } = require('./modelHelpers');

/**
 * Bảng ngay_nghi_le. Năm suy diễn từ ngay_bat_dau (không lưu cột dư thừa theo 3NF).
 */
class NgayNghiLe extends Model {
  get nam() {
    return this.ngay_bat_dau ? Number(String(this.ngay_bat_dau).slice(0, 4)) : null;
  }
}

NgayNghiLe.init(
  {
    id: uuidPk(),
    ten_ngay_le: trimmedString('ten_ngay_le', 150, {
      allowNull: false,
      validate: { notEmpty: { msg: 'Tên ngày nghỉ lễ là bắt buộc' } },
    }),
    ngay_bat_dau: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: { isDate: { msg: 'Ngày bắt đầu phải có định dạng YYYY-MM-DD' } },
    },
    ngay_ket_thuc: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: { isDate: { msg: 'Ngày kết thúc phải có định dạng YYYY-MM-DD' } },
    },
    huong_luong: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    mo_ta: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'NgayNghiLe',
    tableName: 'ngay_nghi_le',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      thoiGianHopLe() {
        if (this.ngay_bat_dau && this.ngay_ket_thuc && this.ngay_ket_thuc < this.ngay_bat_dau) {
          throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
        }
      },
    },
    indexes: [{ fields: ['ngay_bat_dau', 'ngay_ket_thuc'] }],
  }
);

module.exports = NgayNghiLe;
