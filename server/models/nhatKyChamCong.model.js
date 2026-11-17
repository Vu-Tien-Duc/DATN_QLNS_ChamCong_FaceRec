// Mô hình bảng nhat_ky_cham_cong: tổng hợp chấm công theo ngày và ca làm việc.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk } = require('./modelHelpers');

// Tính số giờ công và cờ ghi đè thủ công từ dữ liệu có sẵn
class NhatKyChamCong extends Model {
  get so_gio_cong() {
    return Number((Number(this.thoi_luong_lam_viec_phut || 0) / 60).toFixed(2));
  }

  get ghi_de_thu_cong() {
    return Boolean(this.nguoi_ghi_de_id);
  }
}

NhatKyChamCong.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    ca_id: uuidFk(false),
    lich_trinh_id: uuidFk(true),
    ngay_cong: { type: DataTypes.DATEONLY, allowNull: false, validate: { isDate: true } },
    thoi_gian_vao: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    thoi_gian_ra: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    thoi_luong_lam_viec_phut: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    di_muon_phut: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    ve_som_phut: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    so_tiet_thuc_day: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    trang_thai: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'on_time',
      validate: { notEmpty: true },
    },
    don_tu_id: uuidFk(true),
    co_gian_lan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    da_chot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    nguoi_ghi_de_id: uuidFk(true),
    ly_do_ghi_de: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'NhatKyChamCong',
    tableName: 'nhat_ky_cham_cong',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      thoiGianHopLe() {
        if (this.thoi_gian_vao && this.thoi_gian_ra
          && new Date(this.thoi_gian_ra).getTime() < new Date(this.thoi_gian_vao).getTime()) {
          throw new Error('Thời điểm ra không thể trước thời điểm vào');
        }
      },
    },
    indexes: [
      { unique: true, name: 'UQ_nhat_ky_cham_cong', fields: ['nguoi_dung_id', 'ngay_cong', 'ca_id'] },
      { fields: ['nguoi_dung_id', 'ngay_cong'] },
      { fields: ['trang_thai'] },
    ],
  }
);

module.exports = NhatKyChamCong;
