import { apiClient } from './apiClient';

export interface WeeklyTrendItem {
  label: string;
  subLabel?: string;
  rate: number;
  lateRate?: number;
  total: number;
  onTime: number;
  late: number;
}

export interface AttendanceReportSummary {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedAbsenceCount: number;
  approvedLeaveDays: number;
  weeklyTrend: WeeklyTrendItem[];
}

export interface MonthlyUserReportItem {
  userId: string;
  staffCode?: string;
  fullName: string;
  email: string;
  departmentId?: any;
  departmentName?: string;
  role?: string;
  totalShifts: number;
  onTime: number;
  late: number;
  early: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

export interface MonthlyReportResponse {
  month: number;
  year: number;
  totalUsers: number;
  report: MonthlyUserReportItem[];
  weeklyTrend: WeeklyTrendItem[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ExportOverviewData {
  period: string;
  department: string;
  totalUsers: number;
  totalShifts: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedAbsenceCount: number;
  overallAttendanceRate: number;
  approvedLeaveDays: number;
  exportedAt: string;
}

export interface ExportReportDataResponse {
  overview: ExportOverviewData;
  attendanceLogs: any[];
  leaveRequests: any[];
  staffStats: any[];
  dailyStats: any[];
}

export const reportApi = {
  /**
   * 1. Thống kê tổng hợp chấm công theo khoảng thời gian và khoa
   */
  async getAttendanceReport(params?: {
    userId?: string;
    departmentId?: string;
    from?: string;
    to?: string;
  }): Promise<AttendanceReportSummary> {
    const res = await apiClient.get<any>('/reports/attendance', { params });
    return res.data?.data || res.data;
  },

  /**
   * 2. Báo cáo tổng hợp theo tháng dành cho cấp quản lý
   */
  async getMonthlyReport(params?: {
    month?: number;
    year?: number;
    departmentId?: string;
    page?: number;
    limit?: number;
  }): Promise<MonthlyReportResponse> {
    const res = await apiClient.get<any>('/reports/monthly', { params });
    return res.data?.data || res.data;
  },

  /**
   * 3. Trích xuất toàn bộ dữ liệu 5 Sheets phục vụ xuất Excel
   */
  async getExportReportData(params?: {
    month?: number;
    year?: number;
    from?: string;
    to?: string;
    departmentId?: string;
    userId?: string;
  }): Promise<ExportReportDataResponse> {
    const res = await apiClient.get<any>('/reports/export-data', { params });
    return res.data?.data || res.data;
  },
};
