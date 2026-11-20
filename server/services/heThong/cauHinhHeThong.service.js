// Quản lý cấu hình hệ thống tập trung kèm bộ nhớ đệm và nhật ký kiểm toán.
const { CauHinhHeThong, NhatKyKiemToan } = require('../../models');
const { CAU_HINH_MAC_DINH } = require('../../models/cauHinhHeThong.model');
const ServiceError = require('../../utils/loiNghiepVu');

const cache = new Map();
let isInitialized = false;
let lastLoadedTime = 0;
let defaultSeeded = false;
const CACHE_TTL_MS = 60000;

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

// Lấy danh sách toàn bộ tham số cấu hình hệ thống
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
    return obj;
  });
};

// Kiểm tra ngưỡng hợp lệ trước khi lưu giá trị cấu hình
const validateConfigValue = (key, value) => {
  const upperKey = key.toUpperCase();
  switch (upperKey) {
    case 'FACE_MATCH_THRESHOLD': {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0.1 || num > 0.9) {
        throw new ServiceError(
          'Ngưỡng nhận diện khuôn mặt (FACE_MATCH_THRESHOLD) phải là số thực từ 0.10 đến 0.90.',
          400,
          'INVALID_CONFIG_VALUE'
        );
      }
      return num;
    }
    case 'LIVENESS_CONFIDENCE_THRESHOLD': {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0.1 || num > 1.0) {
        throw new ServiceError(
          'Ngưỡng chống giả mạo (LIVENESS_CONFIDENCE_THRESHOLD) phải là số thực từ 0.10 đến 1.00.',
          400,
          'INVALID_CONFIG_VALUE'
        );
      }
      return num;
    }
    case 'CAMPUS_GPS_RADIUS_METERS': {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 10 || num > 10000) {
        throw new ServiceError(
          'Bán kính GPS hợp lệ (CAMPUS_GPS_RADIUS_METERS) phải từ 10 đến 10,000 mét.',
          400,
          'INVALID_CONFIG_VALUE'
        );
      }
      return Math.round(num);
    }
    case 'CAMPUS_GEOFENCE': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ServiceError('Cấu hình khuôn viên (CAMPUS_GEOFENCE) phải là đối tượng JSON hợp lệ.', 400, 'INVALID_CONFIG_VALUE');
      }
      const lat = Number(value.lat);
      const lng = Number(value.lng);
      const radiusMeters = Math.round(Number(value.radiusMeters ?? 500));
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new ServiceError('Tọa độ khuôn viên (lat/lng) không hợp lệ.', 400, 'INVALID_CONFIG_VALUE');
      }
      if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 100000) {
        throw new ServiceError('Bán kính khuôn viên (radiusMeters) phải từ 10 đến 100,000 mét.', 400, 'INVALID_CONFIG_VALUE');
      }
      return {
        name: String(value.name || 'Khuôn viên Cơ sở chính - Trường Đại học').trim(),
        lat,
        lng,
        radiusMeters,
      };
    }
    case 'DEFAULT_LATE_THRESHOLD_MINUTES':
    case 'DEFAULT_EARLY_THRESHOLD_MINUTES': {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || num > 180) {
        throw new ServiceError(
          'Phút cho phép muộn/sớm phải là số nguyên từ 0 đến 180 phút.',
          400,
          'INVALID_CONFIG_VALUE'
        );
      }
      return Math.round(num);
    }
    case 'SYSTEM_MAINTENANCE_MODE':
      return Boolean(value);
    default:
      return value;
  }
};

// Cập nhật một cấu hình hệ thống, làm mới cache và ghi nhật ký kiểm toán
const updateConfig = async (key, rawValue, currentUser = null, req = null) => {
  if (!key || typeof key !== 'string') {
    throw new ServiceError('Khóa cấu hình không hợp lệ.', 400, 'KEY_REQUIRED');
  }

  const upperKey = key.trim().toUpperCase();
  let configDoc = await CauHinhHeThong.findOne({ where: { khoa_cau_hinh: upperKey } });
  if (!configDoc && (upperKey === 'CAMPUS_GEOFENCE' || upperKey === 'CAMPUS_GPS_RADIUS_METERS')) {
    const validatedInitial = validateConfigValue(upperKey, rawValue);
    configDoc = await CauHinhHeThong.create({
      khoa_cau_hinh: upperKey,
      gia_tri: validatedInitial,
      nhom: 'cham_cong',
      mo_ta: upperKey === 'CAMPUS_GEOFENCE' ? 'Tọa độ và bán kính khuôn viên trường' : 'Bán kính GPS khuôn viên trường (mét)',
    });
    cache.set(upperKey, toCacheEntry(configDoc));
    return configDoc;
  }
  if (!configDoc) {
    throw new ServiceError(`Không tìm thấy khóa cấu hình "${upperKey}".`, 404, 'CONFIG_NOT_FOUND');
  }

  const validatedValue = validateConfigValue(upperKey, rawValue);
  const oldValue = configDoc.gia_tri;

  configDoc.gia_tri = validatedValue;
  await configDoc.save();

  cache.set(upperKey, toCacheEntry(configDoc));

  try {
    await NhatKyKiemToan.create({
      nguoi_thuc_hien_id: currentUser?.id || null,
      loai_chu_the: 'user',
      hanh_dong: 'UPDATE_SYSTEM_CONFIG',
      doi_tuong_id: upperKey,
      loai_doi_tuong: 'cau_hinh_he_thong',
      dia_chi_ip: req?.ip || req?.connection?.remoteAddress || '127.0.0.1',
      chi_tiet: {
        khoa_cau_hinh: upperKey,
        gia_tri_cu: oldValue,
        gia_tri_moi: validatedValue,
        nhom: configDoc.nhom,
        mo_ta: configDoc.mo_ta,
      },
    });
  } catch (auditErr) {
    console.error('[SystemConfig] Lỗi ghi nhật ký kiểm toán:', auditErr.message);
  }

  const resObj = configDoc.toJSON();
  resObj.gia_tri = validatedValue;
  return resObj;
};

// Cập nhật hàng loạt nhiều cấu hình hệ thống
const bulkUpdateConfigs = async (configs = [], currentUser = null, req = null) => {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new ServiceError('Dữ liệu cấu hình cập nhật phải là một mảng không rỗng.', 400);
  }

  const results = [];
  for (const item of configs) {
    const key = item.khoa_cau_hinh || item.key;
    const value = item.gia_tri !== undefined ? item.gia_tri : item.value;
    if (key) {
      const upperKey = String(key).trim().toUpperCase();
      const existing = await CauHinhHeThong.findOne({ where: { khoa_cau_hinh: upperKey } });
      if (existing) {
        results.push(await updateConfig(upperKey, value, currentUser, req));
      } else {
        const validatedValue = validateConfigValue(upperKey, value);
        const created = await CauHinhHeThong.create({
          khoa_cau_hinh: upperKey,
          gia_tri: validatedValue,
          nhom: item.nhom || item.group || 'SYSTEM',
          mo_ta: item.mo_ta || item.description || `Tham số hệ thống ${upperKey}`,
        });
        cache.set(upperKey, toCacheEntry(created));
        results.push(created.toJSON());
      }
    }
  }

  return results;
};

module.exports = {
  loadConfigsIntoCache,
  getConfig,
  getConfigSync,
  getAllConfigs,
  updateConfig,
  bulkUpdateConfigs,
};
