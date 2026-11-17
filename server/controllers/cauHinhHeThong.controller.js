// Xem và cập nhật tham số cấu hình hệ thống tập trung (ngưỡng AI, lương, chấm công)
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');
const ServiceError = require('../utils/loiNghiepVu');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

// GET /api/he-thong/cau-hinh - Lấy toàn bộ danh sách cấu hình hệ thống
const getSystemConfigs = async (req, res, next) => {
  try {
    const configs = await systemConfigService.getAllConfigs();
    return sendSuccess(res, 'Lấy danh sách cấu hình hệ thống thành công.', configs);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// PUT /api/he-thong/cau-hinh - Cập nhật giá trị cấu hình theo khóa (đơn lẻ hoặc hàng loạt)
const updateSystemConfig = async (req, res, next) => {
  try {
    const key = req.body?.khoa_cau_hinh || req.body?.khoa;
    const value = req.body?.gia_tri;
    const configs = req.body?.danh_sach_cau_hinh;

    if (Array.isArray(configs)) {
      const results = await systemConfigService.bulkUpdateConfigs(
        configs.map((c) => ({ key: c.khoa_cau_hinh || c.khoa || c.key, value: c.gia_tri !== undefined ? c.gia_tri : c.value })),
        req.user,
        req
      );
      return sendSuccess(res, 'Cập nhật danh sách cấu hình hệ thống thành công.', results);
    }

    if (key !== undefined && value !== undefined) {
      const result = await systemConfigService.updateConfig(key, value, req.user, req);
      return sendSuccess(res, `Cập nhật cấu hình "${result.khoa_cau_hinh}" thành công.`, result);
    }

    // Nếu truyền object map { KEY1: val1, KEY2: val2 }
    if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
      const entries = Object.entries(req.body).filter(([k]) => !['khoa_cau_hinh', 'khoa', 'gia_tri', 'danh_sach_cau_hinh'].includes(k));
      if (entries.length > 0) {
        const batch = entries.map(([k, v]) => ({ key: k, value: v }));
        const results = await systemConfigService.bulkUpdateConfigs(batch, req.user, req);
        return sendSuccess(res, 'Cập nhật cấu hình hệ thống thành công.', results);
      }
    }

    return sendError(res, 'Vui lòng cung cấp khóa cấu hình (khoa_cau_hinh) và giá trị mới (gia_tri).', null, 400);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = {
  getSystemConfigs,
  updateSystemConfig,
};
