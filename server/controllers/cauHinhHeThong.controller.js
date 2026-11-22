// Xem và cập nhật tham số cấu hình hệ thống tập trung (ngưỡng AI, lương, chấm công)
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// GET /api/he-thong/cau-hinh - Lấy toàn bộ danh sách cấu hình hệ thống
const getSystemConfigs = async (req, res) => {
  const configs = await systemConfigService.getAllConfigs();
  return sendSuccess(res, 'Lấy danh sách cấu hình hệ thống thành công.', configs);
};

// PUT /api/he-thong/cau-hinh - Cập nhật giá trị cấu hình theo khóa (đơn lẻ hoặc hàng loạt)
const updateSystemConfig = async (req, res) => {
  const key = req.body?.khoa_cau_hinh;
  const value = req.body?.gia_tri;
  const configs = req.body?.danh_sach_cau_hinh;

  if (Array.isArray(configs)) {
    const results = await systemConfigService.bulkUpdateConfigs(
      configs.map((c) => ({
        khoa_cau_hinh: c?.khoa_cau_hinh,
        gia_tri: c?.gia_tri,
        nhom: c?.nhom,
        mo_ta: c?.mo_ta,
      })),
      req.user,
      req
    );
    return sendSuccess(res, 'Cập nhật danh sách cấu hình hệ thống thành công.', results);
  }

  if (key !== undefined && value !== undefined) {
    const result = await systemConfigService.updateConfig(key, value, req.user, req);
    return sendSuccess(res, `Cập nhật cấu hình "${result.khoa_cau_hinh}" thành công.`, result);
  }

  // Nếu truyền object map { KEY1: val1, KEY2: val2 } -> chỉ cho phép khóa nằm trong danh mục chuẩn
  if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
    const entries = Object.entries(req.body).filter(
      ([k]) => !['khoa_cau_hinh', 'gia_tri', 'danh_sach_cau_hinh'].includes(k)
    );
    if (entries.length > 0) {
      const batch = entries.map(([k, v]) => ({ khoa_cau_hinh: k, gia_tri: v }));
      const results = await systemConfigService.bulkUpdateConfigs(batch, req.user, req);
      return sendSuccess(res, 'Cập nhật cấu hình hệ thống thành công.', results);
    }
  }

  return sendError(res, 'Vui lòng cung cấp khóa cấu hình (khoa_cau_hinh) và giá trị mới (gia_tri).', null, 400);
};

module.exports = {
  getSystemConfigs,
  updateSystemConfig,
};
