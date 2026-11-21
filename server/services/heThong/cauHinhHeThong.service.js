// Quản lý cấu hình hệ thống tập trung kèm bộ nhớ đệm và nhật ký kiểm toán.
const { CauHinhHeThong, NhatKyKiemToan } = require('../../models');
const { CAU_HINH_MAC_DINH } = require('../../models/cauHinhHeThong.model');
const { runInTransaction } = require('../../utils/giaoDichDb');
const ServiceError = require('../../utils/loiNghiepVu');

const cache = new Map();
let isInitialized = false;
let lastLoadedTime = 0;
let defaultSeeded = false;
const CACHE_TTL_MS = 60000;

const SECRET_CONFIG_KEYS = new Set(['GEMINI_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY']);
const DEDICATED_AI_CONFIG_KEYS = new Set([
  'AI_DEFAULT_PROVIDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
]);
const ALLOWED_CONFIG_KEYS = new Set([
  ...Object.keys(CAU_HINH_MAC_DINH || {}),
  ...DEDICATED_AI_CONFIG_KEYS,
]);

const maskSecretValue = (val) => {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
};

const isMaskedSecretPlaceholder = (val) => {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && (/^\*+$/.test(trimmed) || /\*{4}/.test(trimmed));
};

const sanitizeConfigOutput = (obj) => {
  if (!obj) return obj;
  const upperKey = String(obj.khoa_cau_hinh || '').toUpperCase();
  if (SECRET_CONFIG_KEYS.has(upperKey)) {
    return {
      ...obj,
      gia_tri: maskSecretValue(typeof obj.gia_tri === 'string' ? obj.gia_tri : String(obj.gia_tri || '')),
    };
  }
  return obj;
};

const CANONICAL_CONFIG_META = {
  HOC_KY: { nhom: 'DAO_TAO', mo_ta: 'Thông tin năm học, học kỳ hiện hành, ngày bắt đầu và số tuần học' },
  DINH_MUC_GIO_CHUAN: { nhom: 'DAO_TAO', mo_ta: 'Định mức giờ chuẩn giảng dạy trong một học kỳ (tiết)' },
  HE_SO_QUY_DOI_GIO: { nhom: 'DAO_TAO', mo_ta: 'Hệ số quy đổi giờ chuẩn theo hình thức học, hệ đào tạo và sĩ số lớp' },
  GEOFENCE_TRUONG: { nhom: 'GPS', mo_ta: 'Tọa độ tâm khuôn viên trường và bán kính Geofence GPS (mét)' },
  DANH_SACH_PHONG_HOC: { nhom: 'GPS', mo_ta: 'Danh mục phòng học kèm tọa độ GPS và bán kính điểm danh' },
  LUONG_CO_SO: { nhom: 'TIEN_LUONG', mo_ta: 'Mức lương cơ sở áp dụng tính lương ngạch bậc (VNĐ)' },
  TY_LE_BAO_HIEM: { nhom: 'TIEN_LUONG', mo_ta: 'Tỷ lệ trích đóng BHXH (8%), BHYT (1.5%), BHTN (1%) của người lao động' },
  DON_GIA_GIO: { nhom: 'TIEN_LUONG', mo_ta: 'Đơn giá thanh toán 1 tiết giảng dạy vượt giờ định mức (VNĐ)' },
  TY_LE_UU_DAI: { nhom: 'TIEN_LUONG', mo_ta: 'Tỷ lệ phụ cấp ưu đãi nghề đối với giảng viên và khối hành chính' },
  GIAM_TRU: { nhom: 'THUE', mo_ta: 'Mức giảm trừ gia cảnh bản thân và người phụ thuộc khi tính thuế TNCN (VNĐ)' },
  BIEU_THUE_5_BAC: { nhom: 'THUE', mo_ta: 'Biểu thuế lũy tiến từng phần 5 bậc tính thuế Thu nhập cá nhân' },
  CHUC_VU: { nhom: 'CHUC_VU', mo_ta: 'Danh mục hệ số phụ cấp chức vụ và tỷ lệ giảm định mức giờ giảng' },
  NGUONG_AI: { nhom: 'AI', mo_ta: 'Mô hình AI nhận diện khuôn mặt 512D, ngưỡng khớp Cosine và Liveness tối thiểu' },
  MARGIN_TOP1_TOP2: { nhom: 'AI', mo_ta: 'Biên độ chênh lệch tối thiểu giữa kết quả giống nhất (Top-1) và thứ hai (Top-2)' },
  COOLDOWN_QUET_GIAY: { nhom: 'CHAM_CONG', mo_ta: 'Thời gian chờ tối thiểu giữa 2 lần quét khuôn mặt liên tiếp (giây)' },
  QUY_TAC_DIEM_DANH: { nhom: 'CHAM_CONG', mo_ta: 'Quy tắc mở cửa sổ check-in sớm, tỷ lệ đủ giờ, nửa giờ và làm tròn tiết' },
  RETENTION_ANH_NAM: { nhom: 'HE_THONG', mo_ta: 'Thời hạn lưu trữ ảnh minh chứng chấm công sinh trắc học (năm)' },
  RETENTION_METADATA_NAM: { nhom: 'HE_THONG', mo_ta: 'Thời hạn lưu trữ nhật ký chấm công và kiểm toán an ninh (năm)' },
  CRON_LAST_RUN: { nhom: 'HE_THONG', mo_ta: 'Trạng thái và thời điểm chạy gần nhất của tiến trình tự động (Cron Job)' },
};

const normalizeConfigGroup = (key, rawGroup) => {
  const upperKey = String(key || '').toUpperCase();
  if (CANONICAL_CONFIG_META[upperKey]) {
    return CANONICAL_CONFIG_META[upperKey].nhom;
  }
  const g = String(rawGroup || 'SYSTEM').toUpperCase();
  if (g === 'PAYROLL' || g === 'LUONG') return 'TIEN_LUONG';
  if (g === 'FACE_AI') return 'AI';
  if (g === 'CHAM_CONG') return 'CHAM_CONG';
  if (g === 'HE_THONG') return 'HE_THONG';
  return g;
};

// Chuyển bản ghi Sequelize cấu hình sang object lưu cache RAM
const toCacheEntry = (cfg) => ({
  id: cfg.id,
  khoa_cau_hinh: cfg.khoa_cau_hinh,
  gia_tri: cfg.gia_tri,
  nhom: normalizeConfigGroup(cfg.khoa_cau_hinh, cfg.nhom),
  mo_ta: cfg.mo_ta || CANONICAL_CONFIG_META[cfg.khoa_cau_hinh]?.mo_ta || null,
  cap_nhat_luc: cfg.cap_nhat_luc,
});

// Nạp toàn bộ cấu hình hệ thống từ DB vào cache RAM (TTL 60 giây) và tự bổ sung đủ 19 tham số chuẩn
const loadConfigsIntoCache = async (force = false) => {
  const now = Date.now();
  if (isInitialized && !force && now - lastLoadedTime < CACHE_TTL_MS) {
    return;
  }

  let configs = await CauHinhHeThong.findAll();
  if (!defaultSeeded && CAU_HINH_MAC_DINH) {
    const existingMap = new Map(configs.map((c) => [String(c.khoa_cau_hinh || '').toUpperCase(), c]));
    let changedAny = false;
    for (const [k, defaultVal] of Object.entries(CAU_HINH_MAC_DINH)) {
      const existing = existingMap.get(k);
      if (!existing) {
        const meta = CANONICAL_CONFIG_META[k] || { nhom: 'HE_THONG', mo_ta: `Tham số hệ thống ${k}` };
        try {
          await CauHinhHeThong.create({
            khoa_cau_hinh: k,
            gia_tri: defaultVal,
            nhom: meta.nhom,
            mo_ta: meta.mo_ta,
          });
          changedAny = true;
        } catch {
          // ignore race condition
        }
      } else if (
        defaultVal &&
        typeof defaultVal === 'object' &&
        !Array.isArray(defaultVal) &&
        existing.gia_tri &&
        typeof existing.gia_tri === 'object' &&
        !Array.isArray(existing.gia_tri)
      ) {
        // Tự động bổ sung các sub-key mặc định mới (vd: nguong_gop_khoi_phut trong QUY_TAC_DIEM_DANH)
        const missingKeys = Object.keys(defaultVal).filter((subKey) => existing.gia_tri[subKey] === undefined);
        if (missingKeys.length > 0) {
          try {
            existing.gia_tri = { ...defaultVal, ...existing.gia_tri };
            await existing.save();
            changedAny = true;
          } catch {
            // ignore concurrent update
          }
        }
      }
    }
    defaultSeeded = true;
    if (changedAny) {
      configs = await CauHinhHeThong.findAll();
    }
  }
  cache.clear();
  for (const cfg of configs) {
    const key = (cfg.khoa_cau_hinh || '').toUpperCase();
    if (key) {
      cache.set(key, toCacheEntry(cfg));
    }
  }

  isInitialized = true;
  lastLoadedTime = now;
};

// Đọc đồng bộ một giá trị cấu hình từ cache RAM
const getConfigSync = (key, defaultValue = null) => {
  if (!key) return defaultValue;
  const upperKey = String(key).toUpperCase();
  if (cache.has(upperKey)) {
    return cache.get(upperKey).gia_tri;
  }
  return defaultValue;
};

// Đọc một giá trị cấu hình (tự nạp cache nếu hết hạn)
const getConfig = async (key, defaultValue = null) => {
  if (!isInitialized || Date.now() - lastLoadedTime > CACHE_TTL_MS) {
    await loadConfigsIntoCache();
  }
  return getConfigSync(key, defaultValue);
};

// Lấy danh sách toàn bộ tham số cấu hình hệ thống (tự động che dấu các khóa API bí mật)
const getAllConfigs = async () => {
  await loadConfigsIntoCache(true);
  const configs = await CauHinhHeThong.findAll({
    order: [['nhom', 'ASC'], ['khoa_cau_hinh', 'ASC']],
  });
  return configs.map((doc) => {
    const obj = doc.toJSON();
    obj.gia_tri = doc.gia_tri;
    obj.nhom = normalizeConfigGroup(doc.khoa_cau_hinh, doc.nhom);
    obj.mo_ta = doc.mo_ta || CANONICAL_CONFIG_META[doc.khoa_cau_hinh]?.mo_ta || null;
    return sanitizeConfigOutput(obj);
  });
};

const assertPlainObject = (val, label) => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new ServiceError(`${label} phải là đối tượng JSON hợp lệ.`, 400, 'INVALID_CONFIG_VALUE');
  }
};

const assertFiniteNumberInRange = (val, min, max, label, integer = false) => {
  const num = Number(val);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new ServiceError(`${label} phải là số trong khoảng [${min}, ${max}].`, 400, 'INVALID_CONFIG_VALUE');
  }
  if (integer && !Number.isInteger(num)) {
    throw new ServiceError(`${label} phải là số nguyên.`, 400, 'INVALID_CONFIG_VALUE');
  }
  return num;
};

// Kiểm tra hợp lệ cho tất cả 19 khóa cấu hình chuẩn và các khóa AI
const validateConfigValue = (key, value) => {
  const upperKey = String(key || '').trim().toUpperCase();
  switch (upperKey) {
    case 'LUONG_CO_SO':
      return Math.round(assertFiniteNumberInRange(value, 100000, 100000000, 'LUONG_CO_SO'));
    case 'DON_GIA_GIO':
      return Math.round(assertFiniteNumberInRange(value, 10000, 10000000, 'DON_GIA_GIO'));
    case 'DINH_MUC_GIO_CHUAN':
      return assertFiniteNumberInRange(value, 1, 1000, 'DINH_MUC_GIO_CHUAN');
    case 'MARGIN_TOP1_TOP2':
      return assertFiniteNumberInRange(value, 0, 0.5, 'MARGIN_TOP1_TOP2');
    case 'COOLDOWN_QUET_GIAY':
      return assertFiniteNumberInRange(value, 0, 3600, 'COOLDOWN_QUET_GIAY', true);
    case 'RETENTION_ANH_NAM':
    case 'RETENTION_METADATA_NAM':
      return assertFiniteNumberInRange(value, 1, 50, upperKey, true);
    case 'NGUONG_AI': {
      assertPlainObject(value, 'NGUONG_AI');
      const mo_hinh = String(value.mo_hinh || 'buffalo_s').trim();
      if (!mo_hinh) {
        throw new ServiceError('NGUONG_AI.mo_hinh không được để trống.', 400, 'INVALID_CONFIG_VALUE');
      }
      const so_chieu = assertFiniteNumberInRange(value.so_chieu ?? 512, 64, 4096, 'NGUONG_AI.so_chieu', true);
      const cosine_min = assertFiniteNumberInRange(value.cosine_min ?? 0.45, 0.1, 0.99, 'NGUONG_AI.cosine_min');
      const liveness_min = assertFiniteNumberInRange(value.liveness_min ?? 0.85, 0.1, 1.0, 'NGUONG_AI.liveness_min');
      return { mo_hinh, so_chieu, cosine_min, liveness_min };
    }
    case 'GEOFENCE_TRUONG': {
      assertPlainObject(value, 'GEOFENCE_TRUONG');
      if (!Array.isArray(value.toa_do) || value.toa_do.length < 2) {
        throw new ServiceError('GEOFENCE_TRUONG.toa_do phải là mảng [kinh_do, vi_do].', 400, 'INVALID_CONFIG_VALUE');
      }
      const lng = assertFiniteNumberInRange(value.toa_do[0], -180, 180, 'GEOFENCE_TRUONG.toa_do[0] (kinh_do)');
      const lat = assertFiniteNumberInRange(value.toa_do[1], -90, 90, 'GEOFENCE_TRUONG.toa_do[1] (vi_do)');
      const ban_kinh_met = assertFiniteNumberInRange(value.ban_kinh_met ?? 150, 10, 100000, 'GEOFENCE_TRUONG.ban_kinh_met', true);
      return {
        ten_co_so: String(value.ten_co_so || 'Trường Đại học Nguyễn Trãi').trim(),
        toa_do: [lng, lat],
        ban_kinh_met,
      };
    }
    case 'DANH_SACH_PHONG_HOC': {
      if (!Array.isArray(value)) {
        throw new ServiceError('DANH_SACH_PHONG_HOC phải là mảng các phòng học.', 400, 'INVALID_CONFIG_VALUE');
      }
      return value.map((room, idx) => {
        assertPlainObject(room, `DANH_SACH_PHONG_HOC[${idx}]`);
        const ma_phong = String(room.ma_phong || '').trim();
        if (!ma_phong) {
          throw new ServiceError(`DANH_SACH_PHONG_HOC[${idx}].ma_phong không được để trống.`, 400, 'INVALID_CONFIG_VALUE');
        }
        if (!Array.isArray(room.toa_do) || room.toa_do.length < 2) {
          throw new ServiceError(`DANH_SACH_PHONG_HOC[${idx}].toa_do phải là mảng [kinh_do, vi_do].`, 400, 'INVALID_CONFIG_VALUE');
        }
        const lng = assertFiniteNumberInRange(room.toa_do[0], -180, 180, `Phòng ${ma_phong} kinh_do`);
        const lat = assertFiniteNumberInRange(room.toa_do[1], -90, 90, `Phòng ${ma_phong} vi_do`);
        const ban_kinh_met = assertFiniteNumberInRange(room.ban_kinh_met ?? 30, 5, 5000, `Phòng ${ma_phong} ban_kinh_met`, true);
        return { ...room, ma_phong, toa_do: [lng, lat], ban_kinh_met };
      });
    }
    case 'GIAM_TRU': {
      assertPlainObject(value, 'GIAM_TRU');
      return {
        ban_than: Math.round(assertFiniteNumberInRange(value.ban_than, 0, 100000000, 'GIAM_TRU.ban_than')),
        phu_thuoc: Math.round(assertFiniteNumberInRange(value.phu_thuoc, 0, 100000000, 'GIAM_TRU.phu_thuoc')),
      };
    }
    case 'TY_LE_BAO_HIEM': {
      assertPlainObject(value, 'TY_LE_BAO_HIEM');
      return {
        bhxh: assertFiniteNumberInRange(value.bhxh, 0, 0.5, 'TY_LE_BAO_HIEM.bhxh'),
        bhyt: assertFiniteNumberInRange(value.bhyt, 0, 0.5, 'TY_LE_BAO_HIEM.bhyt'),
        bhtn: assertFiniteNumberInRange(value.bhtn, 0, 0.5, 'TY_LE_BAO_HIEM.bhtn'),
      };
    }
    case 'TY_LE_UU_DAI': {
      assertPlainObject(value, 'TY_LE_UU_DAI');
      const normalized = {};
      for (const [k, v] of Object.entries(value)) {
        normalized[k] = assertFiniteNumberInRange(v, 0, 2, `TY_LE_UU_DAI.${k}`);
      }
      return normalized;
    }
    case 'BIEU_THUE_5_BAC': {
      if (!Array.isArray(value) || value.length === 0) {
        throw new ServiceError('BIEU_THUE_5_BAC phải là mảng bậc thuế không rỗng.', 400, 'INVALID_CONFIG_VALUE');
      }
      return value.map((tier, idx) => {
        assertPlainObject(tier, `BIEU_THUE_5_BAC[${idx}]`);
        const bac = assertFiniteNumberInRange(tier.bac ?? idx + 1, 1, 20, `Bậc thuế #${idx + 1}`, true);
        const tu = assertFiniteNumberInRange(tier.tu, 0, 10000000000, `Bậc ${bac} (tu)`);
        const den = tier.den === null || tier.den === undefined || tier.den === ''
          ? null
          : assertFiniteNumberInRange(tier.den, tu + 1, 100000000000, `Bậc ${bac} (den)`);
        const thue_suat = assertFiniteNumberInRange(tier.thue_suat, 0, 1, `Bậc ${bac} (thue_suat)`);
        return { bac, tu, den, thue_suat };
      });
    }
    case 'CHUC_VU': {
      if (!Array.isArray(value)) {
        throw new ServiceError('CHUC_VU phải là mảng danh mục chức vụ.', 400, 'INVALID_CONFIG_VALUE');
      }
      return value.map((item, idx) => {
        assertPlainObject(item, `CHUC_VU[${idx}]`);
        const ma_chuc_vu = String(item.ma_chuc_vu || '').trim();
        if (!ma_chuc_vu) {
          throw new ServiceError(`CHUC_VU[${idx}].ma_chuc_vu không được để trống.`, 400, 'INVALID_CONFIG_VALUE');
        }
        return {
          ...item,
          ma_chuc_vu,
          he_so_phu_cap: assertFiniteNumberInRange(item.he_so_phu_cap ?? 0, 0, 10, `CHUC_VU.${ma_chuc_vu}.he_so_phu_cap`),
          ty_le_giam_dinh_muc: assertFiniteNumberInRange(
            item.ty_le_giam_dinh_muc ?? 0,
            0,
            1,
            `CHUC_VU.${ma_chuc_vu}.ty_le_giam_dinh_muc`
          ),
        };
      });
    }
    case 'HE_SO_QUY_DOI_GIO': {
      assertPlainObject(value, 'HE_SO_QUY_DOI_GIO');
      assertPlainObject(value.hinh_thuc, 'HE_SO_QUY_DOI_GIO.hinh_thuc');
      assertPlainObject(value.he_dao_tao, 'HE_SO_QUY_DOI_GIO.he_dao_tao');
      if (!Array.isArray(value.si_so)) {
        throw new ServiceError('HE_SO_QUY_DOI_GIO.si_so phải là mảng ngưỡng sĩ số.', 400, 'INVALID_CONFIG_VALUE');
      }
      return value;
    }
    case 'QUY_TAC_DIEM_DANH': {
      assertPlainObject(value, 'QUY_TAC_DIEM_DANH');
      const lam_tron_tiet = String(value.lam_tron_tiet || 'FLOOR').toUpperCase();
      if (!['FLOOR', 'ROUND', 'CEIL'].includes(lam_tron_tiet)) {
        throw new ServiceError('QUY_TAC_DIEM_DANH.lam_tron_tiet chỉ chấp nhận FLOOR, ROUND hoặc CEIL.', 400, 'INVALID_CONFIG_VALUE');
      }
      return {
        cua_so_checkin_truoc_phut: assertFiniteNumberInRange(
          value.cua_so_checkin_truoc_phut ?? 30,
          0,
          180,
          'cua_so_checkin_truoc_phut',
          true
        ),
        nguong_gop_khoi_phut: assertFiniteNumberInRange(
          value.nguong_gop_khoi_phut ?? 15,
          0,
          120,
          'nguong_gop_khoi_phut',
          true
        ),
        ty_le_du_gio: assertFiniteNumberInRange(value.ty_le_du_gio ?? 0.8, 0.1, 1.0, 'ty_le_du_gio'),
        ty_le_nua_gio: assertFiniteNumberInRange(value.ty_le_nua_gio ?? 0.5, 0.1, 1.0, 'ty_le_nua_gio'),
        lam_tron_tiet,
      };
    }
    case 'HOC_KY': {
      assertPlainObject(value, 'HOC_KY');
      const nam_hoc = String(value.nam_hoc || '').trim();
      const ngay_bat_dau = String(value.ngay_bat_dau || '').trim();
      if (!nam_hoc || !/^\d{4}-\d{2}-\d{2}$/.test(ngay_bat_dau)) {
        throw new ServiceError('HOC_KY phải có nam_hoc và ngay_bat_dau định dạng YYYY-MM-DD.', 400, 'INVALID_CONFIG_VALUE');
      }
      return {
        nam_hoc,
        hoc_ky: assertFiniteNumberInRange(value.hoc_ky ?? 1, 1, 3, 'HOC_KY.hoc_ky', true),
        ngay_bat_dau,
        so_tuan: assertFiniteNumberInRange(value.so_tuan ?? 18, 1, 52, 'HOC_KY.so_tuan', true),
      };
    }
    case 'CRON_LAST_RUN':
      assertPlainObject(value, 'CRON_LAST_RUN');
      return value;
    case 'AI_DEFAULT_PROVIDER': {
      const p = String(value || '').trim().toLowerCase();
      if (!['gemini', 'groq', 'deepseek', 'offline_mock'].includes(p)) {
        throw new ServiceError('AI_DEFAULT_PROVIDER chỉ chấp nhận gemini, groq, deepseek hoặc offline_mock.', 400, 'INVALID_CONFIG_VALUE');
      }
      return p;
    }
    case 'GEMINI_MODEL':
    case 'GROQ_MODEL':
    case 'DEEPSEEK_MODEL': {
      const m = String(value || '').trim();
      if (!m || !/^[a-zA-Z0-9._-]{1,100}$/.test(m) || m.includes('..')) {
        throw new ServiceError(`${upperKey} chứa tên mô hình không hợp lệ.`, 400, 'INVALID_CONFIG_VALUE');
      }
      return m;
    }
    case 'GEMINI_API_KEY':
    case 'GROQ_API_KEY':
    case 'DEEPSEEK_API_KEY': {
      const strVal = typeof value === 'string' ? value.trim() : '';
      if (isMaskedSecretPlaceholder(strVal)) {
        throw new ServiceError(
          `Không được lưu chuỗi che dấu (****) cho khóa bí mật ${upperKey}.`,
          400,
          'INVALID_SECRET_VALUE'
        );
      }
      return strVal;
    }
    default:
      throw new ServiceError(`Khóa cấu hình "${upperKey}" không nằm trong danh mục được hỗ trợ.`, 400, 'UNSUPPORTED_CONFIG_KEY');
  }
};

// Cập nhật một cấu hình hệ thống trong DB (bên trong transaction tùy chọn), chuẩn bị cache và audit payload
const applySingleConfigUpdate = async ({ key, rawValue, group, description, currentUser, req, transaction }) => {
  const upperKey = String(key || '').trim().toUpperCase();
  if (!upperKey || !ALLOWED_CONFIG_KEYS.has(upperKey)) {
    throw new ServiceError(`Khóa cấu hình "${upperKey || ''}" không hợp lệ hoặc không được phép tạo mới.`, 400, 'UNSUPPORTED_CONFIG_KEY');
  }

  const validatedValue = validateConfigValue(upperKey, rawValue);
  let configDoc = await CauHinhHeThong.findOne({ where: { khoa_cau_hinh: upperKey }, transaction });
  const isNew = !configDoc;
  const oldValue = isNew ? null : configDoc.gia_tri;

  if (isNew) {
    const meta = CANONICAL_CONFIG_META[upperKey] || {
      nhom: normalizeConfigGroup(upperKey, group || 'AI'),
      mo_ta: description || `Tham số hệ thống ${upperKey}`,
    };
    configDoc = await CauHinhHeThong.create(
      {
        khoa_cau_hinh: upperKey,
        gia_tri: validatedValue,
        nhom: normalizeConfigGroup(upperKey, group || meta.nhom),
        mo_ta: description || meta.mo_ta,
      },
      { transaction }
    );
  } else {
    configDoc.gia_tri = validatedValue;
    await configDoc.save({ transaction });
  }

  const isSecret = SECRET_CONFIG_KEYS.has(upperKey);
  await NhatKyKiemToan.create(
    {
      nguoi_thuc_hien_id: currentUser?.id || null,
      loai_chu_the: 'user',
      hanh_dong: isNew ? 'CREATE_SYSTEM_CONFIG' : 'UPDATE_SYSTEM_CONFIG',
      doi_tuong_id: upperKey,
      loai_doi_tuong: 'cau_hinh_he_thong',
      dia_chi_ip: req?.ip || req?.connection?.remoteAddress || '127.0.0.1',
      chi_tiet: {
        khoa_cau_hinh: upperKey,
        gia_tri_cu: isSecret ? maskSecretValue(oldValue) : oldValue,
        gia_tri_moi: isSecret ? maskSecretValue(validatedValue) : validatedValue,
        nhom: configDoc.nhom,
        mo_ta: configDoc.mo_ta,
      },
    },
    { transaction }
  );

  const cacheEntry = toCacheEntry(configDoc);
  const resObj = sanitizeConfigOutput({ ...configDoc.toJSON(), gia_tri: validatedValue });
  return { upperKey, cacheEntry, resObj };
};

// Cập nhật một cấu hình hệ thống, làm mới cache và ghi nhật ký kiểm toán
const updateConfig = async (key, rawValue, currentUser = null, req = null) => {
  if (!key || typeof key !== 'string') {
    throw new ServiceError('Khóa cấu hình không hợp lệ.', 400, 'KEY_REQUIRED');
  }

  const upperKey = key.trim().toUpperCase();
  if (!ALLOWED_CONFIG_KEYS.has(upperKey)) {
    throw new ServiceError(`Không tìm thấy khóa cấu hình "${upperKey}".`, 404, 'CONFIG_NOT_FOUND');
  }

  if (CAU_HINH_MAC_DINH[upperKey] !== undefined && !isInitialized) {
    await loadConfigsIntoCache();
  }

  const applied = await runInTransaction((transaction) =>
    applySingleConfigUpdate({ key: upperKey, rawValue, currentUser, req, transaction })
  );

  cache.set(applied.upperKey, applied.cacheEntry);
  return applied.resObj;
};

// Cập nhật hàng loạt nhiều cấu hình hệ thống nguyên tử trong 1 transaction
const bulkUpdateConfigs = async (configs = [], currentUser = null, req = null) => {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new ServiceError('Dữ liệu cấu hình cập nhật phải là một mảng không rỗng.', 400);
  }

  const normalizedItems = configs.map((item) => {
    const key = item?.khoa_cau_hinh;
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new ServiceError('Mỗi mục cấu hình bắt buộc phải có khoa_cau_hinh.', 400, 'KEY_REQUIRED');
    }
    return {
      key: key.trim().toUpperCase(),
      rawValue: item.gia_tri,
      group: item.nhom,
      description: item.mo_ta,
    };
  });

  const appliedList = await runInTransaction(async (transaction) => {
    const items = [];
    for (const item of normalizedItems) {
      items.push(
        await applySingleConfigUpdate({
          key: item.key,
          rawValue: item.rawValue,
          group: item.group,
          description: item.description,
          currentUser,
          req,
          transaction,
        })
      );
    }
    return items;
  });

  // Chỉ ghi đè cache RAM sau khi toàn bộ transaction DB đã commit thành công
  for (const applied of appliedList) {
    cache.set(applied.upperKey, applied.cacheEntry);
  }

  return appliedList.map((a) => a.resObj);
};

module.exports = {
  SECRET_CONFIG_KEYS,
  ALLOWED_CONFIG_KEYS,
  maskSecretValue,
  isMaskedSecretPlaceholder,
  loadConfigsIntoCache,
  getConfig,
  getConfigSync,
  getAllConfigs,
  updateConfig,
  bulkUpdateConfigs,
};
