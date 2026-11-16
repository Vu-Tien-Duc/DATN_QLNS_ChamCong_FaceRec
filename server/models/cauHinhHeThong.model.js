const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Bảng giá trị cấu hình mặc định tham chiếu chuẩn hệ thống.
 */
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
    { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.28 },
    { bac: 5, tu: 100000000, den: null, thue_suat: 0.35 }
  ],
  DON_GIA_GIO: 120000,
  DINH_MUC_GIO_CHUAN: 135,
  TY_LE_UU_DAI: { giang_vien: 0.30, hanh_chinh: 0.00 },
  CHUC_VU: [
    { ma_chuc_vu: 'hieu_truong', he_so_phu_cap: 1.0, ty_le_giam_dinh_muc: 0.80 },
    { ma_chuc_vu: 'truong_khoa', he_so_phu_cap: 0.7, ty_le_giam_dinh_muc: 0.30 },
    { ma_chuc_vu: 'truong_bo_mon', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.20 },
    { ma_chuc_vu: 'truong_phong', he_so_phu_cap: 0.6, ty_le_giam_dinh_muc: 0.00 },
    { ma_chuc_vu: 'pho_khoa', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.20 },
    { ma_chuc_vu: 'pho_phong', he_so_phu_cap: 0.4, ty_le_giam_dinh_muc: 0.00 }
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
  CRON_LAST_RUN: { thoi_gian_chay: null, trang_thai: 'chua_chay' }
};

class CauHinhHeThong extends Model {
  /**
   * Phương thức tĩnh lấy cấu hình với fallback an toàn.
   */
  static async layGiaTri(key, fallback = null) {
    try {
      const doc = await CauHinhHeThong.findOne({
        where: { khoa_cau_hinh: String(key).trim().toUpperCase() },
      });
      if (doc && doc.gia_tri !== undefined && doc.gia_tri !== null) {
        return doc.gia_tri;
      }
    } catch (_) {
      // Fallback khi bảng chưa đồng bộ hoặc lỗi truy vấn
    }
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    return CAU_HINH_MAC_DINH[key] !== undefined ? CAU_HINH_MAC_DINH[key] : null;
  }

  static getValue(key, fallback = null) {
    return this.layGiaTri(key, fallback);
  }
}

CauHinhHeThong.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    khoa_cau_hinh: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Khóa cấu hình là bắt buộc' },
      },
      set(val) {
        this.setDataValue('khoa_cau_hinh', val ? String(val).trim().toUpperCase() : val);
      },
    },
    gia_tri: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const raw = this.getDataValue('gia_tri');
        if (!raw) return raw;
        try {
          return JSON.parse(raw);
        } catch (_) {
          return raw;
        }
      },
      set(val) {
        if (val !== null && val !== undefined) {
          this.setDataValue('gia_tri', typeof val === 'string' ? val : JSON.stringify(val));
        } else {
          this.setDataValue('gia_tri', null);
        }
      },
      validate: {
        notNull: { msg: 'Giá trị cấu hình là bắt buộc' },
      },
    },
    nhom: {
      type: DataTypes.STRING(50),
      defaultValue: 'SYSTEM',
      allowNull: false,
    },
    mo_ta: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'CauHinhHeThong',
    tableName: 'cau_hinh_he_thong',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
    indexes: [
      { unique: true, fields: ['khoa_cau_hinh'] },
      { fields: ['nhom'] },
    ],
  }
);

module.exports = CauHinhHeThong;
module.exports.CAU_HINH_MAC_DINH = CAU_HINH_MAC_DINH;
