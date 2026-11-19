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
  nguoi_dung_id?: string;
  ma_can_bo?: string;
  ho_ten?: string;
  email: string;
  don_vi_id?: any;
  ten_phong_ban?: string;
  vai_tro_chinh?: string;
  anh_dai_dien?: string | null;
  tong_so_ca?: number;
  so_lan_dung_gio?: number;
  so_lan_di_muon?: number;
  so_lan_ve_som?: number;
  so_lan_vang_mat?: number;
  so_lan_co_phep?: number;
  ty_le_chuyen_can?: number;
  /** @deprecated Dùng nguoi_dung_id */
  userId: string;
  /** @deprecated Dùng ma_can_bo */
  staffCode?: string;
  /** @deprecated Dùng ho_ten */
  fullName: string;
  /** @deprecated Dùng don_vi_id */
  departmentId?: any;
  /** @deprecated Dùng ten_phong_ban */
  departmentName?: string;
  /** @deprecated Dùng vai_tro_chinh */
  role?: string;
  /** @deprecated Dùng tong_so_ca */
  totalShifts: number;
  /** @deprecated Dùng so_lan_dung_gio */
  onTime: number;
  /** @deprecated Dùng so_lan_di_muon */
  late: number;
  /** @deprecated Dùng so_lan_ve_som */
  early: number;
  /** @deprecated Dùng so_lan_vang_mat */
  absent: number;
  /** @deprecated Dùng so_lan_co_phep */
  excused: number;
  /** @deprecated Dùng ty_le_chuyen_can */
  attendanceRate: number;
}

export interface MonthlyReportResponse {
  month: number;
  year: number;
  totalUsers: number;
  report: MonthlyUserReportItem[];
  weeklyTrend: WeeklyTrendItem[];
  pagination?: {
    total?: number;
    totalUsers?: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ExportOverviewData {
  ky_bao_cao: string;
  don_vi: string;
  tong_so_nhan_su: number;
  tong_so_ca: number;
  so_lan_dung_gio: number;
  so_lan_di_muon: number;
  so_lan_ve_som: number;
  so_lan_vang_mat: number;
  so_lan_co_phep: number;
  ty_le_chuyen_can: number;
  so_ngay_nghi_phep_da_duyet: number;
  thoi_diem_xuat: string;
}

export interface ExportReportDataResponse {
  tong_quan: ExportOverviewData;
  nhat_ky_cham_cong: any[];
  don_nghi_phep: any[];
  thong_ke_nhan_su: any[];
  thong_ke_theo_ngay: any[];
}

export const reportApi = {
  /**
   * 1. Thống kê tổng hợp chấm công theo khoảng thời gian và khoa
   */
  async getAttendanceReport(params?: {
    nguoi_dung_id?: string;
    don_vi_id?: string;
    tu_ngay?: string;
    den_ngay?: string;
  }): Promise<AttendanceReportSummary> {
    const res = await apiClient.get<any>('/bao-cao/cham-cong', { params });
    return res.data?.data || res.data;
  },

  /**
   * 2. Báo cáo tổng hợp theo tháng dành cho cấp quản lý
   */
  async getMonthlyReport(params?: {
    thang?: number;
    nam?: number;
    don_vi_id?: string;
    trang?: number;
    gioi_han?: number;
  }): Promise<MonthlyReportResponse> {
    const res = await apiClient.get<any>('/bao-cao/hang-thang', { params });
    return res.data?.data || res.data;
  },

  /**
   * 3. Trích xuất toàn bộ dữ liệu 5 Sheets phục vụ xuất Excel
   */
  async getExportReportData(params?: {
    thang?: number;
    nam?: number;
    tu_ngay?: string;
    den_ngay?: string;
    don_vi_id?: string;
    nguoi_dung_id?: string;
  }): Promise<ExportReportDataResponse> {
    const res = await apiClient.get<any>('/bao-cao/du-lieu-xuat', { params });
    return res.data?.data || res.data;
  },
};
