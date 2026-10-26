const mongoose = require('mongoose');
require('./user.model');

const systemConfigSchema = new mongoose.Schema(
  {
    khoa_cau_hinh: {
      type: String,
      alias: 'key',
      required: [true, 'Khóa cấu hình là bắt buộc'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [100, 'Khóa cấu hình không vượt quá 100 ký tự'],
    },
    gia_tri: {
      type: mongoose.Schema.Types.Mixed,
      alias: 'value',
      required: [true, 'Giá trị cấu hình là bắt buộc'],
    },
    nhom: {
      type: String,
      alias: 'group',
      enum: [
        'AI', 'GPS', 'DEVICE', 'ATTENDANCE', 'SYSTEM', 'HE_THONG',
        'DAO_TAO', 'TIEN_LUONG', 'THUE', 'CHUC_VU', 'CHAM_CONG', 'RETENTION'
      ],
      default: 'SYSTEM',
      index: true,
    },
    mo_ta: {
      type: String,
      alias: 'description',
      trim: true,
      default: null,
    },
    nguoi_cap_nhat_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'updatedBy',
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'cau_hinh_he_thong',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

systemConfigSchema.aliases = {
  key: 'khoa_cau_hinh',
  value: 'gia_tri',
  group: 'nhom',
  description: 'mo_ta',
  updatedBy: 'nguoi_cap_nhat_id',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

// Bảng giá trị cấu hình mặc định tham chiếu chuẩn từ Mục 3 Đặc tả:
const CAU_HINH_MAC_DINH = {
  HOC_KY: { nam_hoc: '2026-2027', hoc_ky: 1, ngay_bat_dau: '2026-09-07', so_tuan: 18 },
  GEOFENCE_TRUONG: { ten_co_so: 'Trường Đại học Nguyễn Trãi - 28A Lê Trọng Tấn, Hà Đông', toa_do: [105.7628, 20.9752], ban_kinh_met: 150 },
  DANH_SACH_PHONG_HOC: [
    { ma_phong: 'A101', toa_do: [105.76281, 20.97521], ban_kinh_met: 30 },
    { ma_phong: 'B202', toa_do: [105.76290, 20.97530], ban_kinh_met: 30 }
  ],
  LUONG_CO_SO: 2530000,
  GIAM_TRU: { ban_than: 15500000, phu_thuoc: 6200000 },
  TY_LE_BAO_HIEM: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  BIEU_THUE_5_BAC: [
    { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05 },
    { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.10 },
    { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.20 },
    { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.30 },
    { bac: 5, tu: 100000000, den: null, thue_suat: 0.35 }
  ],
  DON_GIA_GIO: 120000,
  DINH_MUC_GIO_CHUAN: 135,
  TY_LE_UU_DAI: { GIANG_VIEN: 0.30, HANH_CHINH: 0.00 },
  CHUC_VU: [
    { ma_chuc_vu: 'HIEU_TRUONG', he_so_phu_cap: 1.0, ty_le_giam_dinh_muc: 0.80 },
    { ma_chuc_vu: 'TRUONG_KHOA', he_so_phu_cap: 0.7, ty_le_giam_dinh_muc: 0.30 },
    { ma_chuc_vu: 'TRUONG_BO_MON', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.20 },
    { ma_chuc_vu: 'TRUONG_PHONG', he_so_phu_cap: 0.6, ty_le_giam_dinh_muc: 0.00 },
    { ma_chuc_vu: 'PHO_TRUONG_KHOA', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.20 },
    { ma_chuc_vu: 'PHO_TRUONG_PHONG', he_so_phu_cap: 0.4, ty_le_giam_dinh_muc: 0.00 }
  ],
  HE_SO_QUY_DOI_GIO: {
    hinh_thuc: { LY_THUYET: 1.0, THUC_HANH: 0.7 },
    he_dao_tao: { CHINH_QUY: 1.0, CHAT_LUONG_CAO: 1.2, VUA_LAM_VUA_HOC: 1.1, SAU_DAI_HOC: 1.5 },
    si_so: [{ den: 40, he_so: 1.0 }, { den: 80, he_so: 1.1 }, { den: 999, he_so: 1.2 }]
  },
  NGUONG_AI: { mo_hinh: 'buffalo_s', so_chieu: 512, cosine_min: 0.45, liveness_min: 0.85 },
  MARGIN_TOP1_TOP2: 0.05,
  COOLDOWN_QUET_GIAY: 60,
  QUY_TAC_DIEM_DANH: { cua_so_checkin_truoc_phut: 30, ty_le_du_gio: 0.80, ty_le_nua_gio: 0.50, lam_tron_tiet: 'FLOOR' },
  RETENTION_ANH_NAM: 1,
  RETENTION_METADATA_NAM: 5,
  CRON_LAST_RUN: null
};

// Phương thức tĩnh lấy cấu hình với fallback an toàn (không buffer khi chưa kết nối DB):
systemConfigSchema.statics.layGiaTri = async function (key, fallback = null) {
  if (mongoose.connection.readyState !== 1) {
    if (fallback !== null && fallback !== undefined) return fallback;
    return CAU_HINH_MAC_DINH[key] !== undefined ? CAU_HINH_MAC_DINH[key] : null;
  }
  try {
    const doc = await this.findOne({ khoa_cau_hinh: key }).lean();
    if (doc && doc.gia_tri !== undefined && doc.gia_tri !== null) {
      return doc.gia_tri;
    }
  } catch (err) {
    // fallback an toàn nếu truy vấn lỗi
  }
  if (fallback !== null && fallback !== undefined) {
    return fallback;
  }
  return CAU_HINH_MAC_DINH[key] !== undefined ? CAU_HINH_MAC_DINH[key] : null;
};

systemConfigSchema.statics.getValue = function (key, fallback = null) {
  return this.layGiaTri(key, fallback);
};

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
systemConfigSchema.plugin(schemaAliasPlugin);

const SystemConfig = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema, 'cau_hinh_he_thong');

if (!mongoose.models.CauHinhHeThong) {
  mongoose.model('CauHinhHeThong', systemConfigSchema, 'cau_hinh_he_thong');
}

module.exports = SystemConfig;

