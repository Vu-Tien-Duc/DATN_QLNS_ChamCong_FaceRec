/**
 * Nhận tham số báo cáo từ HTTP, gọi service tổng hợp và trả dữ liệu báo cáo cho client.
 */
const {
  ServiceError,
  getAttendanceReportData,
  getMonthlyReportData,
  getExportReportDataForUser,
} = require('../services/report.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const getAttendanceReport = async (req, res, next) => {
  try {
    const summary = await getAttendanceReportData({
      ...req.query,
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
      ...req.query,
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
    const exportData = await getExportReportDataForUser({ query: req.query, currentUser: req.user });
    return sendSuccess(res, 'Trích xuất dữ liệu báo cáo Excel thành công.', exportData);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = { getAttendanceReport, getMonthlyReport, getExportReportData };
