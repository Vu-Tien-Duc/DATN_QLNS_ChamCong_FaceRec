// Mô hình bảng lich_trinh: thời khóa biểu giảng dạy chính khóa và dạy bù.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, timeColumn, decimalColumn, trimmedString } = require('./modelHelpers');

const LOAI_LICH = ['chinh_khoa', 'day_bu'];

class LichTrinh extends Model {
  // Lấy danh sách số tuần học từ association tuan_hoc
  layDanhSachTuan() {
    return (this.tuan_hoc || []).map((w) => w.tuan_thu).sort((a, b) => a - b);
  }
}

LichTrinh.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    ca_id: uuidFk(true),
    mon_hoc_id: uuidFk(true),
    phong_hoc: trimmedString('phong_hoc', 100, { allowNull: false, defaultValue: '' }),
    co_so: trimmedString('co_so', 100, { allowNull: false, defaultValue: '' }),
    vi_do: decimalColumn('vi_do', 10, 8, null, true),
    kinh_do: decimalColumn('kinh_do', 11, 8, null, true),
    ban_kinh_met: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100, validate: { min: 1 } },
    thu_trong_tuan: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 6 },
    },
    gio_bat_dau: timeColumn('gio_bat_dau'),
    gio_ket_thuc: timeColumn('gio_ket_thuc'),
    ngay_bat_dau: { type: DataTypes.DATEONLY, allowNull: false },
    ngay_ket_thuc: { type: DataTypes.DATEONLY, allowNull: false },
    tiet_bat_dau: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
    so_tiet: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, validate: { min: 1 } },
    lap_lai_hang_tuan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    loai_lich: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'chinh_khoa',
      validate: { isIn: { args: [LOAI_LICH], msg: 'Loại lịch không hợp lệ' } },
    },
    nam_hoc: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '2025-2026' },
    hoc_ky: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1, max: 3 } },
    la_truc_tuyen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'LichTrinh',
    tableName: 'lich_trinh',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      thoiGianHopLe() {
        if (this.ngay_bat_dau && this.ngay_ket_thuc && String(this.ngay_ket_thuc) < String(this.ngay_bat_dau)) {
          throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
        }
        if (this.gio_bat_dau && this.gio_ket_thuc && this.gio_ket_thuc <= this.gio_bat_dau) {
          throw new Error('Giờ kết thúc phải sau giờ bắt đầu');
        }
      },
    },
    indexes: [
      { fields: ['nguoi_dung_id', 'thu_trong_tuan'] },
      { fields: ['ngay_bat_dau', 'ngay_ket_thuc'] },
    ],
  }
);

module.exports = LichTrinh;
module.exports.LOAI_LICH = LOAI_LICH;
