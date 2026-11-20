// Mô hình bảng don_nghi_phep: lưu đơn nghỉ phép, dạy bù, đổi ca và giải trình công.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, decimalColumn } = require('./modelHelpers');

const LOAI_DON = ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng', 'giai_trinh_cong', 'giai_trinh_thieu_check_out'];
const TRANG_THAI_DON = ['pending', 'pending_dean', 'pending_bgh', 'approved', 'rejected', 'cancelled'];

class DonNghiPhep extends Model {}

DonNghiPhep.init(
  {
    id: uuidPk(),
    nguoi_dung_id: uuidFk(false),
    loai_don: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { isIn: { args: [LOAI_DON], msg: 'Loại đơn không hợp lệ' } },
    },
    ly_do: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: { notEmpty: { msg: 'Lý do xin nghỉ/đổi ca là bắt buộc' } },
      set(val) {
        this.setDataValue('ly_do', typeof val === 'string' ? val.trim() : val);
      },
    },
    ngay_bat_dau: { type: DataTypes.DATEONLY, allowNull: false },
    ngay_ket_thuc: { type: DataTypes.DATEONLY, allowNull: false },
    so_ngay: { ...decimalColumn('so_ngay', 4, 1, 1.0), validate: { min: 0 } },
    so_tiet_nghi: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    lich_trinh_id: uuidFk(true),
    ca_thay_the_id: uuidFk(true),
    giang_vien_day_thay_id: uuidFk(true),
    ngay_day_bu: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    tep_dinh_kem: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    // Giải trình thiếu check-out: ID bản ghi nhật ký và số tiết xác nhận của người duyệt
    nhat_ky_id: uuidFk(true),
    so_tiet_xac_nhan: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, validate: { min: 0 } },
    trang_thai: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: { args: [TRANG_THAI_DON], msg: 'Trạng thái đơn không hợp lệ' } },
    },
    nguoi_duyet_id: uuidFk(true),
    thoi_gian_duyet: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    ly_do_tu_choi: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'DonNghiPhep',
    tableName: 'don_nghi_phep',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    validate: {
      thoiGianHopLe() {
        if (this.ngay_bat_dau && this.ngay_ket_thuc && String(this.ngay_ket_thuc) < String(this.ngay_bat_dau)) {
          throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
        }
      },
    },
    indexes: [{ fields: ['nguoi_dung_id', 'trang_thai'] }],
  }
);

module.exports = DonNghiPhep;
module.exports.LOAI_DON = LOAI_DON;
module.exports.TRANG_THAI_DON = TRANG_THAI_DON;
