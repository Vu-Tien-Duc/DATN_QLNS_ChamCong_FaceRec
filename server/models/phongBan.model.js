const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, trimmedString, decimalColumn } = require('./modelHelpers');

const LOAI_DON_VI = ['khoa', 'bo_mon', 'phong_ban'];

/** Bảng phong_ban: Khoa / Bộ môn / Phòng ban (cây đệ quy qua don_vi_cha_id). */
class PhongBan extends Model {}

PhongBan.init(
  {
    id: uuidPk(),
    ten_phong_ban: trimmedString('ten_phong_ban', 150, {
      allowNull: false,
      validate: { notEmpty: { msg: 'Tên đơn vị là bắt buộc' } },
    }),
    loai_don_vi: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { isIn: { args: [LOAI_DON_VI], msg: 'Loại đơn vị không hợp lệ' } },
    },
    don_vi_cha_id: uuidFk(true),
    truong_don_vi_id: uuidFk(true),
    vi_do: decimalColumn('vi_do', 10, 8, null, true),
    kinh_do: decimalColumn('kinh_do', 11, 8, null, true),
    ban_kinh_met: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 200,
      validate: { min: 1 },
    },
  },
  {
    sequelize,
    modelName: 'PhongBan',
    tableName: 'phong_ban',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      khongTuLamCha() {
        if (this.id && this.don_vi_cha_id && String(this.id) === String(this.don_vi_cha_id)) {
          throw new Error('Đơn vị không thể là cha của chính nó');
        }
      },
    },
    indexes: [{ fields: ['don_vi_cha_id'] }],
  }
);

module.exports = PhongBan;
module.exports.LOAI_DON_VI = LOAI_DON_VI;
