import { apiClient } from './apiClient';

export interface PhuCapItem {
  id?: string;
  loai_phu_cap?: string;
  he_so_hoac_ty_le?: number;
  so_tien?: number;
}

export interface GiamTruItem {
  id?: string;
  ly_do?: string;
  so_tien?: number;
}

export interface KhoanDieuChinhItem {
  reason: string;
  amount: number;
}

export interface TeachingHoursData {
  baseQuota?: number;
  reductionRatio?: number;
  adjustedQuota?: number;
  accumulatedStandardHours?: number;
  overQuotaHours?: number;
  hourlyRate?: number;
  overQuotaRemuneration?: number;
  advancedPayment?: number;
}

export interface InsuranceData {
  socialInsurance?: number;
  healthInsurance?: number;
  unemploymentInsurance?: number;
  totalInsurance?: number;
  bhxh?: number;
  bhyt?: number;
  bhtn?: number;
  tong_bao_hiem?: number;
}

export interface TaxTncnData {
  personalDeduction?: number;
  dependentDeduction?: number;
  taxableIncome?: number;
  taxAmount?: number;
  giam_tru_ban_than?: number;
  giam_tru_phu_thuoc?: number;
  thu_nhap_tinh_thue?: number;
  tien_thue?: number;
}

export interface PayrollRecord {
  id?: string;
  nguoi_dung_id?: string;
  thang?: number;
  nam?: number;
  nguoi_lap_id?: string;
  nguoi_duyet_id?: string | null;
  thoi_gian_duyet?: string | null;
  luong_co_ban?: number;
  he_so_luong?: number;
  so_cong_chuan?: number;
  so_cong_thuc_te?: number;
  so_tiet_nghia_vu?: number;
  so_tiet_thuc_day?: number;
  so_tiet_vuot_gio?: number;
  don_gia_tiet_vuot?: number;
  tien_vuot_gio?: number;
  tong_phu_cap?: number;
  tong_giam_tru?: number;
  dong_bao_hiem?: number;
  thue_thu_nhap_ca_nhan?: number;
  thuc_linh?: number;
  trang_thai?: 'nhap' | 'cho_duyet' | 'da_duyet' | 'da_chi_tra' | string;
  ghi_chu?: string;
  tao_luc?: string;
  cap_nhat_luc?: string;
  nguoi_dung?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    ma_can_bo?: string;
    vai_tro_chinh?: string;
    anh_dai_dien?: string | null;
    don_vi_chinh_id?: string | null;
    don_vi_chinh?: {
      id?: string;
      ten_phong_ban?: string;
      loai_don_vi?: string;
    } | null;
    ho_so?: {
      hoc_ham?: string;
      hoc_vi?: string;
      chuc_vu?: string;
      he_so_luong?: number;
      so_nguoi_phu_thuoc?: number;
      loai_hop_dong?: string;
      ngach_luong?: string;
    } | null;
  } | null;
  nguoi_lap?: {
    id?: string;
    ho_ten?: string;
    email?: string;
  } | null;
  nguoi_duyet?: {
    id?: string;
    ho_ten?: string;
    email?: string;
  } | null;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng nguoi_dung hoặc nguoi_dung_id */
  userId: {
    id?: string;
    _id: string;
    ho_ten?: string;
    fullName: string;
    email: string;
    ma_can_bo?: string;
    staffCode?: string;
    vai_tro_chinh?: string;
    role?: string;
    anh_dai_dien?: string;
    avatar?: string;
    hoc_ham?: string;
    academicRank?: string;
    hoc_vi?: string;
    degree?: string;
    chuc_vu?: string;
    position?: string;
    don_vi_chinh_id?: string;
    departmentId?: {
      _id: string;
      name: string;
      code?: string;
    } | string;
  };
  /** @deprecated Dùng thang */
  month: number;
  /** @deprecated Dùng nam */
  year: number;
  /** @deprecated Dùng he_so_luong */
  salaryCoefficient: number;
  /** @deprecated Dùng luong_co_ban */
  baseSalary: number;
  primarySalary: number;
  positionAllowance?: number;
  seniorityAllowance?: number;
  vocationalAllowance?: number;
  allowances?: PhuCapItem[];
  deductions?: GiamTruItem[];
  /** @deprecated Dùng tong_giam_tru */
  totalDeductions?: number;
  bonusItems?: KhoanDieuChinhItem[];
  deductionItems?: KhoanDieuChinhItem[];
  teachingHours?: TeachingHoursData;
  grossIncome: number;
  /** @deprecated Dùng so_cong_chuan */
  standardWorkDays?: number;
  /** @deprecated Dùng so_cong_thuc_te */
  actualWorkDays?: number;
  createdByUser?: {
    _id?: string;
    fullName?: string;
    email?: string;
  };
  approvedByUser?: {
    _id?: string;
    fullName?: string;
    email?: string;
  };
  /** @deprecated Dùng thoi_gian_duyet */
  approvedAt?: string | null;
  /** @deprecated Dùng ghi_chu */
  notes?: string;
  insurance?: InsuranceData;
  personalIncomeTax?: TaxTncnData;
  thue_tncn?: TaxTncnData;
  /** @deprecated Dùng thuc_linh */
  netSalary: number;
  /** @deprecated Dùng trang_thai */
  status: 'nhap' | 'cho_duyet' | 'da_duyet' | 'da_chi_tra' | string;
  isLocked?: boolean;
  lockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollSummaryData {
  month: number;
  year: number;
  totalRecords: number;
  totalNetSalary: number;
  totalGrossSalary: number;
  totalTax: number;
  totalInsurance: number;
  totalOvertimePay: number;
  isLocked: boolean;
}

export interface PayrollQueryParams {
  thang?: number;
  nam?: number;
  don_vi_id?: string;
  trang_thai?: string;
  nguoi_dung_id?: string;
}

export interface GeneratePayrollPayload {
  thang: number;
  nam: number;
  don_vi_id?: string;
}

export interface LockPayrollPayload {
  thang: number;
  nam: number;
  don_vi_id?: string;
  id?: string;
}

export interface UnlockPayrollPayload {
  thang: number;
  nam: number;
  ly_do: string;
  don_vi_id?: string;
  id?: string;
}

export const payrollApi = {
  /**
   * Lấy danh sách bảng lương tháng theo quyền hạn và bộ lọc
   */
  async getPayrolls(params?: PayrollQueryParams): Promise<PayrollRecord[]> {
    const res = await apiClient.get<any>('/phieu-luong', { params });
    const data = res.data?.data || res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.records)) return data.records;
    if (Array.isArray(data?.payrolls)) return data.payrolls;
    return [];
  },

  /**
   * Lấy chi tiết phiếu lương cá nhân theo ID
   */
  async getPayrollById(id: string): Promise<PayrollRecord> {
    const res = await apiClient.get<any>(`/phieu-luong/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Lấy phiếu lương của chính người dùng đăng nhập trong tháng/năm
   */
  async getMyPayroll(month?: number, year?: number): Promise<PayrollRecord | null> {
    const query = new URLSearchParams();
    if (month) query.append('thang', String(month));
    if (year) query.append('nam', String(year));

    const qs = query.toString();
    const url = `/phieu-luong/cua-toi${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<any>(url);
    return res.data?.data || res.data || null;
  },

  /**
   * Lấy số liệu thống kê tổng hợp quỹ lương tháng (Admin, Hiệu trưởng, Trưởng khoa)
   */
  async getPayrollSummary(month: number, year: number, departmentId?: string): Promise<PayrollSummaryData> {
    const query = new URLSearchParams({
      thang: String(month),
      nam: String(year),
    });
    if (departmentId) query.append('don_vi_id', departmentId);
    const res = await apiClient.get<any>(`/phieu-luong/tong-hop?${query.toString()}`);
    return (
      res.data?.data ||
      res.data || {
        month,
        year,
        totalRecords: 0,
        totalNetSalary: 0,
        totalGrossSalary: 0,
        totalTax: 0,
        totalInsurance: 0,
        totalOvertimePay: 0,
        isLocked: false,
      }
    );
  },

  /**
   * Khởi tạo & Tính toán bảng lương dự thảo cho toàn trường hoặc theo khoa
   */
  async generatePayroll(payload: GeneratePayrollPayload): Promise<any> {
    const res = await apiClient.post<any>('/phieu-luong/khoi-tao', payload);
    return res.data?.data || res.data;
  },

  /**
   * Khóa sổ lương tháng & chốt công không cho sửa đổi
   */
  async lockPayroll(payload: LockPayrollPayload): Promise<any> {
    const url = payload.id ? `/phieu-luong/${payload.id}/khoa` : '/phieu-luong/khoa';
    const res = payload.id
      ? await apiClient.put<any>(url, payload)
      : await apiClient.post<any>(url, payload);
    return res.data?.data || res.data;
  },

  /**
   * Mở khóa sổ lương tháng (Admin/BGH - bắt buộc có lý do giải trình)
   */
  async unlockPayroll(payload: UnlockPayrollPayload): Promise<any> {
    const url = payload.id ? `/phieu-luong/${payload.id}/mo-khoa` : '/phieu-luong/mo-khoa';
    const res = payload.id
      ? await apiClient.put<any>(url, payload)
      : await apiClient.post<any>(url, payload);
    return res.data?.data || res.data;
  },

  /**
   * Trích xuất dữ liệu bảng lương định dạng Excel
   */
  async exportExcel(month: number, year: number, departmentId?: string): Promise<any> {
    const query = new URLSearchParams();
    query.append('thang', String(month));
    query.append('nam', String(year));
    if (departmentId) query.append('don_vi_id', departmentId);

    const res = await apiClient.get<any>(`/phieu-luong/xuat-excel?${query.toString()}`);
    return res.data?.data || res.data;
  },

  /**
   * Trích xuất dữ liệu phiếu lương in ấn PDF
   */
  async exportPdf(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/phieu-luong/${id}/xuat-pdf`);
    return res.data?.data || res.data;
  },
};
