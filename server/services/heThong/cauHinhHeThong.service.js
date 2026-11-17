// Quản lý cấu hình hệ thống tập trung kèm bộ nhớ đệm và nhật ký kiểm toán.
const { CauHinhHeThong, NhatKyKiemToan } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');

const cache = new Map();
let isInitialized = false;
let lastLoadedTime = 0;
const CACHE_TTL_MS = 60000;

// Chuyển bản ghi Sequelize cấu hình sang object lưu cache RAM
const toCacheEntry = (cfg) => ({
  id: cfg.id,
  khoa_cau_hinh: cfg.khoa_cau_hinh,
  gia_tri: cfg.gia_tri,
  nhom: cfg.nhom || 'SYSTEM',
  mo_ta: cfg.mo_ta || null,
  cap_nhat_luc: cfg.cap_nhat_luc,
});

// Nạp toàn bộ cấu hình hệ thống từ DB vào cache RAM (TTL 60 giây)
const loadConfigsIntoCache = async (force = false) => {
  const now = Date.now();
  if (isInitialized && !force && now - lastLoadedTime < CACHE_TTL_MS) {
    return;
  }

  const configs = await CauHinhHeThong.findAll();
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
