// Tổng hợp và xuất dữ liệu báo cáo chấm công theo kỳ, theo đơn vị hoặc cá nhân
const {
  getAttendanceReportData,
  getMonthlyReportData,
  getExportReportDataForUser,
} = require('../services/baoCao/baoCao.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

// Chuẩn hóa tham số lọc báo cáo từ query string
const normalizeReportQuery = (query = {}) => ({
  nguoi_dung_id: query?.nguoi_dung_id,
  don_vi_id: query?.don_vi_id,
  tu_ngay: query?.tu_ngay,
  den_ngay: query?.den_ngay,
  thang: query?.thang,
  nam: query?.nam,
  page: query?.trang || 1,
  limit: query?.gioi_han || 20,
});

// Lấy báo cáo thống kê chấm công tổng hợp theo khoảng thời gian
const getAttendanceReport = async (req, res) => {
  const summary = await getAttendanceReportData({
    ...normalizeReportQuery(req.query),
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy báo cáo thống kê chấm công thành công.', summary);
};

// Lấy báo cáo chấm công tổng hợp theo tháng và xu hướng từng tuần
const getMonthlyReport = async (req, res) => {
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
};

// Trích xuất dữ liệu phục vụ xuất báo cáo Excel
const getExportReportData = async (req, res) => {
  const exportData = await getExportReportDataForUser({
    query: normalizeReportQuery(req.query),
    currentUser: req.user,
  });
  return sendSuccess(res, 'Trích xuất dữ liệu báo cáo Excel thành công.', exportData);
};

module.exports = { getAttendanceReport, getMonthlyReport, getExportReportData };
