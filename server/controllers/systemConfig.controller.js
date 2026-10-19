/**
 * Controller quản lý cấu hình hệ thống (SystemConfig)
 */
const systemConfigService = require('../services/systemConfig.service');
const ServiceError = require('../utils/serviceError');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

/**
 * GET /api/system/configs
 * Lấy toàn bộ danh sách cấu hình hệ thống
 */
const getSystemConfigs = async (req, res, next) => {
  try {
    const configs = await systemConfigService.getAllConfigs();
    return sendSuccess(res, 'Lấy danh sách cấu hình hệ thống thành công.', configs);
  } catch (error) {
    return handleError(res, error, next);
  }
};

/**
 * PUT /api/system/configs
 * Cập nhật giá trị cấu hình theo key (hỗ trợ cả đơn lẻ và hàng loạt)
 */
const updateSystemConfig = async (req, res, next) => {
  try {
    const { key, value, configs } = req.body;

    if (Array.isArray(configs)) {
      const results = await systemConfigService.bulkUpdateConfigs(configs, req.user, req);
      return sendSuccess(res, 'Cập nhật danh sách cấu hình hệ thống thành công.', results);
    }

    if (key !== undefined && value !== undefined) {
      const result = await systemConfigService.updateConfig(key, value, req.user, req);
      return sendSuccess(res, `Cập nhật cấu hình "${result.key}" thành công.`, result);
    }

    // Nếu truyền object map { KEY1: val1, KEY2: val2 }
    if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
      const entries = Object.entries(req.body).filter(([k]) => k !== 'key' && k !== 'value');
      if (entries.length > 0) {
        const batch = entries.map(([k, v]) => ({ key: k, value: v }));
        const results = await systemConfigService.bulkUpdateConfigs(batch, req.user, req);
        return sendSuccess(res, 'Cập nhật cấu hình hệ thống thành công.', results);
      }
    }

    return sendError(res, 'Vui lòng cung cấp khóa cấu hình (key) và giá trị mới (value).', null, 400);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = {
  getSystemConfigs,
  updateSystemConfig,
};
