const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    chuoi_token: {
      type: String,
      alias: 'token',
      required: [true, 'Chuỗi token là bắt buộc'],
      unique: true,
      trim: true,
    },
    ma_ho: {
      type: String,
      alias: 'familyId',
      default: null, // Token Family UUID phục vụ chống Replay Attack
    },
    da_su_dung: {
      type: Boolean,
      alias: 'isUsed',
      default: false,
    },
    thoi_diem_su_dung: {
      type: Date,
      alias: 'usedAt',
      default: null, // Hỗ trợ Grace Period 15s cho request đồng thời
    },
    thiet_bi: {
      type: String,
      alias: 'device',
      default: null,
    },
    dia_chi_ip: {
      type: String,
      alias: 'ipAddress',
      default: null,
    },
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Chủ sở hữu token (userId / nguoi_dung_id) là bắt buộc'],
    },
    het_han_luc: {
      type: Date,
      alias: 'expiresAt',
      required: [true, 'Thời điểm hết hạn (expiresAt / het_han_luc) là bắt buộc'],
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'ma_lam_moi',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

refreshTokenSchema.aliases = {
  token: 'chuoi_token',
  familyId: 'ma_ho',
  isUsed: 'da_su_dung',
  usedAt: 'thoi_diem_su_dung',
  device: 'thiet_bi',
  ipAddress: 'dia_chi_ip',
  userId: 'nguoi_dung_id',
  expiresAt: 'het_han_luc',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};



const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
refreshTokenSchema.plugin(schemaAliasPlugin);

refreshTokenSchema.index({ het_han_luc: 1 }, { expireAfterSeconds: 0 }); // TTL index tự hủy khi hết hạn
refreshTokenSchema.index({ nguoi_dung_id: 1 });
refreshTokenSchema.index({ ma_ho: 1 }, { sparse: true });

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema, 'ma_lam_moi');

if (!mongoose.models.MaLamMoi) {
  mongoose.model('MaLamMoi', refreshTokenSchema, 'ma_lam_moi');
}

module.exports = RefreshToken;

