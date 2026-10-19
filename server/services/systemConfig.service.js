/**
 * Quản lý cấu hình hệ thống tập trung (SystemConfig) với bộ đệm (In-memory Cache) & Audit Log
 */
const SystemConfig = require('../models/systemConfig.model');
const AuditLog = require('../models/auditLog.model');
const ServiceError = require('../utils/serviceError');

// In-memory cache lưu trữ các khóa cấu hình để tăng tốc tối đa
const cache = new Map();
let isInitialized = false;
let lastLoadedTime = 0;
const CACHE_TTL_MS = 60000; // 60s tự động refresh

/**
 * Nạp toàn bộ cấu hình từ Database vào bộ đệm RAM
 */
const loadConfigsIntoCache = async (force = false) => {
  const now = Date.now();
  if (isInitialized && !force && now - lastLoadedTime < CACHE_TTL_MS) {
    return;
  }

  const configs = await SystemConfig.find().lean();
  cache.clear();
  for (const cfg of configs) {
    const key = (cfg.key || '').toUpperCase();
    if (key) {
      cache.set(key, {
        id: cfg._id,
        key: cfg.key,
        value: cfg.value,
        group: cfg.group || 'SYSTEM',
        description: cfg.description || null,
        updatedAt: cfg.updatedAt,
        updatedBy: cfg.updatedBy,
      });
    }
  }

  isInitialized = true;
  lastLoadedTime = now;
};

/**
 * Đọc giá trị cấu hình đồng bộ từ Cache (hoặc giá trị mặc định)
 */
const getConfigSync = (key, defaultValue = null) => {
  if (!key) return defaultValue;
  const upperKey = String(key).toUpperCase();
  if (cache.has(upperKey)) {
    return cache.get(upperKey).value;
  }
  return defaultValue;
};

/**
 * Đọc giá trị cấu hình bất đồng bộ (tự nạp cache nếu chưa có)
 */
const getConfig = async (key, defaultValue = null) => {
  if (!isInitialized || Date.now() - lastLoadedTime > CACHE_TTL_MS) {
    await loadConfigsIntoCache();
  }
  return getConfigSync(key, defaultValue);
};

/**
 * Lấy toàn bộ danh sách cấu hình hệ thống
 */
const getAllConfigs = async () => {
  await loadConfigsIntoCache(true);
  const configs = await SystemConfig.find()
    .sort({ group: 1, key: 1 })
    .populate('updatedBy', 'fullName email role');

  return configs;
};

/**
 * Xác thực kiểu dữ liệu và giới hạn cho các khóa cấu hình nhạy cảm
 */
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
    case 'SYSTEM_MAINTENANCE_MODE': {
      return Boolean(value);
    }
    default:
      return value;
  }
};

/**
 * Cập nhật một cấu hình theo khóa (Key) kèm ghi Audit Log
 */
const updateConfig = async (key, rawValue, currentUser = null, req = null) => {
  if (!key || typeof key !== 'string') {
    throw new ServiceError('Khóa cấu hình không hợp lệ.', 400, 'KEY_REQUIRED');
  }

  const upperKey = key.trim().toUpperCase();
  const configDoc = await SystemConfig.findOne({ key: upperKey });
  if (!configDoc) {
    throw new ServiceError(`Không tìm thấy khóa cấu hình "${upperKey}".`, 404, 'CONFIG_NOT_FOUND');
  }

  const validatedValue = validateConfigValue(upperKey, rawValue);
  const oldValue = configDoc.value;

  configDoc.value = validatedValue;
  configDoc.updatedBy = currentUser?._id || currentUser?.id || null;
  await configDoc.save();

  // Cập nhật bộ đệm RAM
  cache.set(upperKey, {
    id: configDoc._id,
    key: configDoc.key,
    value: validatedValue,
    group: configDoc.group,
    description: configDoc.description,
    updatedAt: configDoc.updatedAt,
    updatedBy: configDoc.updatedBy,
  });

  // Ghi nhật ký kiểm toán (Audit Log)
  try {
    await AuditLog.create({
      actor: currentUser?._id || currentUser?.id || null,
      actorType: 'USER',
      action: 'UPDATE_SYSTEM_CONFIG',
      targetId: upperKey,
      targetType: 'SystemConfig',
      ipAddress: req?.ip || req?.connection?.remoteAddress || '127.0.0.1',
      userAgent: req?.headers?.['user-agent'] || 'SystemConfigAdmin',
      status: 'SUCCESS',
      timestamp: new Date(),
      details: {
        key: upperKey,
        oldValue,
        newValue: validatedValue,
        group: configDoc.group,
        description: configDoc.description,
      },
    });
  } catch (auditErr) {
    console.error('[SystemConfig] Lỗi ghi nhật ký kiểm toán:', auditErr.message);
  }

  return configDoc;
};

/**
 * Cập nhật nhiều cấu hình cùng lúc
 */
const bulkUpdateConfigs = async (configs = [], currentUser = null, req = null) => {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new ServiceError('Dữ liệu cấu hình cập nhật phải là một mảng không rỗng.', 400);
  }

  const results = [];
  for (const item of configs) {
    const key = item.key;
    const value = item.value;
    if (key) {
      const updated = await updateConfig(key, value, currentUser, req);
      results.push(updated);
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
