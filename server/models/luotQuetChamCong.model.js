// Mô hình bảng luot_quet_cham_cong: nhật ký thô từng lượt quét khuôn mặt, QR hoặc GPS.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, decimalColumn } = require('./modelHelpers');

const LOAI_QUET = ['check_in', 'check_out', 'unknown'];
const PHUONG_THUC = ['face_ai', 'qr_code', 'gps_mobile', 'thu_cong_admin', 'system_auto'];

const unitInterval = (extra = {}) => ({
  type: DataTypes.FLOAT,
  allowNull: true,
  defaultValue: null,
  validate: { min: 0, max: 1 },
  ...extra,
});

class LuotQuetChamCong extends Model {}

LuotQuetChamCong.init(
  {
    id: uuidPk(),
    cham_cong_id: uuidFk(true),
    nguoi_dung_id: uuidFk(false),
    loai_quet: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: { args: [LOAI_QUET], msg: 'Loại quét không hợp lệ' } },
    },
    thoi_gian_quet: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    phuong_thuc: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'face_ai',
      validate: { isIn: { args: [PHUONG_THUC], msg: 'Phương thức chấm công không hợp lệ' } },
    },
    do_tin_cay_ai: unitInterval(),
    diem_mat_that: unitInterval(),
    goc_mat_nhan_dien: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    anh_minh_chung: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    vi_do: decimalColumn('vi_do', 10, 8, null, true),
    kinh_do: decimalColumn('kinh_do', 11, 8, null, true),
    do_chinh_xac_gps: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
    vi_tri_gia_lap: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    khoang_cach_met: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null, validate: { min: 0 } },
    hop_le: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ly_do_khong_hop_le: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    ma_thiet_bi: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'LuotQuetChamCong',
    tableName: 'luot_quet_cham_cong',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    indexes: [
      { fields: ['nguoi_dung_id', 'thoi_gian_quet'] },
      { fields: ['cham_cong_id'] },
    ],
  }
);

module.exports = LuotQuetChamCong;
module.exports.LOAI_QUET = LOAI_QUET;
module.exports.PHUONG_THUC = PHUONG_THUC;
