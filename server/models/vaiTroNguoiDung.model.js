// Mô hình bảng vai_tro_nguoi_dung: gán nhiều vai trò phân quyền theo từng phạm vi đơn vị.
const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { normalizeRole } = require('../utils/vaiTro.utils');
const { uuidPk, uuidFk } = require('./modelHelpers');

const PHAM_VI = ['toan_truong', 'khoa', 'bo_mon', 'phong_ban'];

class VaiTroNguoiDung extends Model {
  // Kiểm tra vai trò còn trong khoảng thời gian hiệu lực
  conHieuLuc(at = new Date()) {
    const day = (d) => String(d).slice(0, 10);
    const today = day(at.toISOString());
    if (this.tu_ngay && day(this.tu_ngay) > today) return false;
    if (this.den_ngay && day(this.den_ngay) < today) return false;
    return true;
  }
}

VaiTroNguoiDung.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    ma_vai_tro: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { notEmpty: { msg: 'Mã vai trò là bắt buộc' } },
      set(val) {
        this.setDataValue('ma_vai_tro', val ? normalizeRole(val) : val);
      },
    },
    pham_vi: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'toan_truong',
      validate: { isIn: { args: [PHAM_VI], msg: 'Phạm vi vai trò không hợp lệ' } },
    },
    don_vi_id: uuidFk(true),
    duoc_uy_quyen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    tu_ngay: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    den_ngay: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'VaiTroNguoiDung',
    tableName: 'vai_tro_nguoi_dung',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    validate: {
      thoiGianHopLe() {
        if (this.den_ngay && this.tu_ngay && String(this.den_ngay) < String(this.tu_ngay)) {
          throw new Error('Ngày kết thúc vai trò phải sau ngày bắt đầu');
        }
      },
    },
    indexes: [
      { fields: ['nguoi_dung_id'] },
      { fields: ['ma_vai_tro'] },
      { unique: true, name: 'UX_vai_tro_toan_truong', fields: ['nguoi_dung_id', 'ma_vai_tro'], where: { don_vi_id: { [Op.is]: null } } },
      { unique: true, name: 'UX_vai_tro_theo_don_vi', fields: ['nguoi_dung_id', 'ma_vai_tro', 'don_vi_id'], where: { don_vi_id: { [Op.ne]: null } } },
    ],
  }
);

module.exports = VaiTroNguoiDung;
module.exports.PHAM_VI = PHAM_VI;
