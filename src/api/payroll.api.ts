import { apiClient } from './apiClient';

export interface PhuCapItem {
  type: string;
  rate?: number;
  amount: number;
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
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    email: string;
    staffCode?: string;
    role?: string;
    avatar?: string;
    academicRank?: string;
    degree?: string;
    position?: string;
    departmentId?: {
      _id: string;
      name: string;
      code?: string;
    } | string;
  };
  month: number;
  year: number;
  salaryCoefficient: number;
  baseSalary: number;
  primarySalary: number;
  positionAllowance?: number;
  seniorityAllowance?: number;
  vocationalAllowance?: number;
  allowances?: PhuCapItem[];
  bonusItems?: KhoanDieuChinhItem[];
  deductionItems?: KhoanDieuChinhItem[];
  teachingHours?: TeachingHoursData;
  grossIncome: number;
  insurance?: InsuranceData;
  personalIncomeTax?: TaxTncnData;
  thue_tncn?: TaxTncnData;
  netSalary: number;
  status: 'du_thao' | 'cho_duyet' | 'da_duyet' | 'da_khoa' | 'da_thanh_toan' | string;
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
  month?: number;
  year?: number;
  departmentId?: string;
  status?: string;
  userId?: string;
}

export interface GeneratePayrollPayload {
  month: number;
  year: number;
  departmentId?: string;
}

export interface LockPayrollPayload {
  month: number;
  year: number;
  id?: string;
}

export interface UnlockPayrollPayload {
  month: number;
  year: number;
  reason: string;
  id?: string;
}

export const payrollApi = {
  /**
   * Lấy danh sách bảng lương tháng theo quyền hạn và bộ lọc
   */
  async getPayrolls(params?: PayrollQueryParams): Promise<PayrollRecord[]> {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', String(params.month));
    if (params?.year) query.append('year', String(params.year));
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.status) query.append('status', params.status);
    if (params?.userId) query.append('userId', params.userId);

    const qs = query.toString();
    const url = `/payrolls${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<any>(url);
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
    const res = await apiClient.get<any>(`/payrolls/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Lấy phiếu lương của chính người dùng đăng nhập trong tháng/năm
   */
  async getMyPayroll(month?: number, year?: number): Promise<PayrollRecord | null> {
    const query = new URLSearchParams();
    if (month) query.append('month', String(month));
    if (year) query.append('year', String(year));

    const qs = query.toString();
    const url = `/payrolls/my-payroll${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<any>(url);
    return res.data?.data || res.data || null;
  },

  /**
   * Lấy số liệu thống kê tổng hợp quỹ lương tháng (Admin, Hiệu trưởng, Trưởng khoa)
   */
  async getPayrollSummary(month: number, year: number): Promise<PayrollSummaryData> {
    const res = await apiClient.get<any>(`/payrolls/summary?month=${month}&year=${year}`);
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
    const res = await apiClient.post<any>('/payrolls/generate', payload);
    return res.data?.data || res.data;
  },

  /**
   * Khóa sổ lương tháng & chốt công không cho sửa đổi
   */
  async lockPayroll(payload: LockPayrollPayload): Promise<any> {
    const res = await apiClient.post<any>('/payrolls/lock', payload);
    return res.data?.data || res.data;
  },

  /**
   * Mở khóa sổ lương tháng (Admin/BGH - bắt buộc có lý do giải trình)
   */
  async unlockPayroll(payload: UnlockPayrollPayload): Promise<any> {
    const res = await apiClient.post<any>('/payrolls/unlock', payload);
    return res.data?.data || res.data;
  },

  /**
   * Trích xuất dữ liệu bảng lương định dạng Excel
   */
  async exportExcel(month: number, year: number, departmentId?: string): Promise<any> {
    const query = new URLSearchParams();
    query.append('month', String(month));
    query.append('year', String(year));
    if (departmentId) query.append('departmentId', departmentId);

    const res = await apiClient.get<any>(`/payrolls/export/excel?${query.toString()}`);
    return res.data?.data || res.data;
  },

  /**
   * Trích xuất dữ liệu phiếu lương in ấn PDF
   */
  async exportPdf(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/payrolls/${id}/export/pdf`);
    return res.data?.data || res.data;
  },
};
