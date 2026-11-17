// Mô hình bảng nguoi_dung: tài khoản đăng nhập, danh bạ và vai trò chính của nhân sự.
const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { ALL_ROLES, normalizeRole } = require('../utils/vaiTro.utils');
const { hasPermission, getEffectivePermissions } = require('../config/permissions');
const { uuidPk, uuidFk, trimmedString } = require('./modelHelpers');

const TRANG_THAI_LAM_VIEC = ['dang_lam_viec', 'tam_nghi', 'da_nghi_viec'];

class NguoiDung extends Model {
  // Kiểm tra người dùng có quyền cụ thể hay không
  hasPermission(permission) {
    return hasPermission(this, permission);
  }

  // Lấy toàn bộ danh sách quyền hiệu lực của người dùng
  getPermissions() {
    return Array.from(getEffectivePermissions(this));
  }

  // Tăng phien_ban_token để vô hiệu hóa toàn bộ phiên đăng nhập cũ
  async revokeAllSessions() {
    this.phien_ban_token = (this.phien_ban_token || 1) + 1;
    return this.save();
  }

  // Ẩn mật khẩu băm và chuẩn hóa đường dẫn ảnh đại diện khi serialize JSON
  toJSON() {
    const values = { ...this.get() };
    delete values.mat_khau_ma_hoa;

    if (typeof values.anh_dai_dien === 'string') {
      let cleaned = values.anh_dai_dien;
      if (cleaned.startsWith('http://chamcongdh.io.vn')) {
        cleaned = cleaned.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
      }
      if (cleaned.startsWith('/uploads/faces/')) {
        cleaned = `/api/tai-tep/tep/${cleaned.slice('/uploads/faces/'.length)}`;
      } else if (cleaned.startsWith('/uploads/')) {
        cleaned = `/api/tai-tep/tep/${cleaned.slice('/uploads/'.length)}`;
      } else if (cleaned.includes('chamcongdh.io.vn/uploads/faces/')) {
        cleaned = cleaned.replace('chamcongdh.io.vn/uploads/faces/', 'chamcongdh.io.vn/api/tai-tep/tep/');
      } else if (cleaned.includes('chamcongdh.io.vn/uploads/')) {
        cleaned = cleaned.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/tai-tep/tep/');
      }
      values.anh_dai_dien = cleaned;
    }
    return values;
  }
}

NguoiDung.init(
  {
    id: uuidPk(),
    ho_ten: trimmedString('ho_ten', 100, {
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Họ tên hiển thị là bắt buộc' },
        len: { args: [2, 100], msg: 'Họ tên phải có độ dài từ 2 đến 100 ký tự' },
      },
    }),
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { isEmail: { msg: 'Định dạng email không hợp lệ' } },
      set(val) {
        this.setDataValue('email', val ? String(val).toLowerCase().trim() : val);
      },
    },
    ma_can_bo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      set(val) {
        this.setDataValue('ma_can_bo', val ? String(val).toUpperCase().trim() : null);
      },
    },
    mat_khau_ma_hoa: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    so_dien_thoai: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
      set(val) {
        this.setDataValue('so_dien_thoai', val ? String(val).trim() : null);
      },
    },
    anh_dai_dien: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    don_vi_chinh_id: uuidFk(true),
    vai_tro_chinh: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'giang_vien',
      validate: { isIn: { args: [ALL_ROLES], msg: 'Vai trò không hợp lệ' } },
      set(val) {
        this.setDataValue('vai_tro_chinh', val ? normalizeRole(val) : val);
      },
    },
    trang_thai_lam_viec: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'dang_lam_viec',
      validate: { isIn: { args: [TRANG_THAI_LAM_VIEC], msg: 'Trạng thái làm việc không hợp lệ' } },
    },
    kich_hoat: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    phien_ban_token: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    doi_mat_khau_luc: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    lan_dang_nhap_cuoi: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'NguoiDung',
    tableName: 'nguoi_dung',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    // Mặc định không trả về mật khẩu; dùng NguoiDung.scope('withPassword') khi cần đối chiếu đăng nhập.
    defaultScope: { attributes: { exclude: ['mat_khau_ma_hoa'] } },
    scopes: { withPassword: {} },
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['ma_can_bo'], where: { ma_can_bo: { [Op.ne]: null } } },
      { fields: ['don_vi_chinh_id'] },
      { fields: ['trang_thai_lam_viec'] },
    ],
  }
);

module.exports = NguoiDung;
module.exports.TRANG_THAI_LAM_VIEC = TRANG_THAI_LAM_VIEC;
