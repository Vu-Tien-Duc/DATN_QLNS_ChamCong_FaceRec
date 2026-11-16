/**
 * Nhận tham số báo cáo từ HTTP, gọi service tổng hợp và trả dữ liệu báo cáo cho client.
 * Chuẩn hóa 100% CSDL v2.5 tiếng Việt snake_case
 */
const {
  ServiceError,
  getAttendanceReportData,
  getMonthlyReportData,
  getExportReportDataForUser,
} = require('../services/baoCao/baoCao.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const normalizeReportQuery = (query = {}) => {
  return {
    nguoi_dung_id: query?.nguoi_dung_id,
    don_vi_id: query?.don_vi_id,
    tu_ngay: query?.tu_ngay,
    den_ngay: query?.den_ngay,
    thang: query?.thang,
    nam: query?.nam,
    page: query?.trang || 1,
    limit: query?.gioi_han || 20,
  };
};

const getAttendanceReport = async (req, res, next) => {
  try {
    const summary = await getAttendanceReportData({
      ...normalizeReportQuery(req.query),
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy báo cáo thống kê chấm công thành công.', summary);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const { month, year, result } = await getMonthlyReportData({
      ...normalizeReportQuery(req.query),
      currentUser: req.user,
    });
    return sendSuccess(res, `Lấy báo cáo tổng hợp tháng ${month}/${year} thành công.`, {
      month,
      year,
      totalUsers: result.totalUsers,
      report: result.report,
      weeklyTrend: result.weeklyTrend,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleError(res, error, next);
  }
};

const getExportReportData = async (req, res, next) => {
  try {
    const exportData = await getExportReportDataForUser({
      query: normalizeReportQuery(req.query),
      currentUser: req.user,
    });
    return sendSuccess(res, 'Trích xuất dữ liệu báo cáo Excel thành công.', exportData);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = { getAttendanceReport, getMonthlyReport, getExportReportData };
