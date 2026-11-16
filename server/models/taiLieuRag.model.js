const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, trimmedString } = require('./modelHelpers');

const LOAI_TEP = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'pptx'];

/**
 * Bảng tai_lieu_rag: tài liệu nạp vào trợ lý AI (RAG).
 * Số đoạn (chunk) suy diễn từ bảng phan_doan_tai_lieu => dùng TaiLieuRag.demSoDoan().
 */
class TaiLieuRag extends Model {
  async demSoDoan(options = {}) {
    const PhanDoanTaiLieu = require('./phanDoanTaiLieu.model');
    return PhanDoanTaiLieu.count({ where: { tai_lieu_id: this.id }, ...options });
  }
}

TaiLieuRag.init(
  {
    id: uuidPk(),
    tieu_de: trimmedString('tieu_de', 200, {
      allowNull: false,
      validate: { notEmpty: { msg: 'Tiêu đề tài liệu là bắt buộc' } },
    }),
    ten_tep_goc: { type: DataTypes.STRING(255), allowNull: false },
    loai_tep: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: { args: [LOAI_TEP], msg: 'Loại tệp không được hỗ trợ' } },
      set(val) {
        this.setDataValue('loai_tep', val ? String(val).toLowerCase().replace(/^\./, '').trim() : val);
      },
    },
    mime_type: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'application/octet-stream' },
    kich_thuoc_byte: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    ma_bam_sha256: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    nguoi_tai_id: uuidFk(false),
    pham_vi: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'ca_nhan' },
    tom_tat: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    trang_thai: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'san_sang' },
    thong_bao_loi: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    duong_dan: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    modelName: 'TaiLieuRag',
    tableName: 'tai_lieu_rag',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    indexes: [{ fields: ['nguoi_tai_id'] }],
  }
);

module.exports = TaiLieuRag;
module.exports.LOAI_TEP = LOAI_TEP;
