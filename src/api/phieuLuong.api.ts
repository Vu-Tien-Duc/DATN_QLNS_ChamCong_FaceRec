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

export interface GioGiangData {
  dinh_muc_goc?: number;
  gio_quy_doi_tich_luy?: number;
  gio_vuot_dinh_muc?: number;
  don_gia_gio_chuan?: number;
  thu_lao_vuot_gio?: number;
}

export interface BaoHiemData {
  bhxh?: number;
  bhyt?: number;
  bhtn?: number;
  tong_bao_hiem?: number;
}

export interface ThueTncnData {
  giam_tru_ban_than?: number;
  giam_tru_phu_thuoc?: number;
  thu_nhap_tinh_thue?: number;
  tien_thue?: number;
}

export interface PayrollRecord {
  id: string;
  nguoi_dung_id: string;
  thang: number;
  nam: number;
  nguoi_lap_id?: string;
  nguoi_duyet_id?: string | null;
  thoi_gian_duyet?: string | null;
  luong_co_ban: number;
  luong_co_so?: number;
  he_so_luong: number;
  luong_chinh?: number;
  phu_cap_chuc_vu?: number;
  phu_cap_tham_nien?: number;
  phu_cap_uu_dai_nghe?: number;
  so_cong_chuan: number;
  so_cong_thuc_te: number;
  so_tiet_nghia_vu: number;
  so_tiet_thuc_day: number;
  so_tiet_vuot_gio: number;
  don_gia_tiet_vuot: number;
  tien_vuot_gio: number;
  tong_phu_cap: number;
  tong_giam_tru: number;
  dong_bao_hiem: number;
  thue_thu_nhap_ca_nhan: number;
  tong_thu_nhap_gross?: number;
  thuc_linh: number;
  thuc_linh_net?: number;
  trang_thai: 'nhap' | 'cho_duyet' | 'da_duyet' | 'da_chi_tra';
  da_khoa?: boolean;
  ghi_chu?: string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
  danh_sach_phu_cap?: PhuCapItem[];
  cac_khoan_giam_tru?: GiamTruItem[];
  gio_giang?: GioGiangData;
  bao_hiem?: BaoHiemData;
  thue_tncn?: ThueTncnData;
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
      loai_nhan_su?: string;
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
}

export interface PayrollSummaryData {
  thang: number;
  nam: number;
  tong_ban_ghi: number;
  tong_thuc_linh: number;
  tong_thu_nhap: number;
  tong_thue_tncn: number;
  tong_bao_hiem: number;
  tong_vuot_gio: number;
  so_phieu_da_khoa?: number;
  da_khoa: boolean;
  da_khoa_mot_phan?: boolean;
}

export interface PayrollExcelExportData {
  tieu_de: string;
  thang: number;
  nam: number;
  tong_nhan_su: number;
  headers: Array<{ key: string; label: string }>;
  rows: Array<Record<string, any>>;
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
    if (res.data && Object.prototype.hasOwnProperty.call(res.data, 'data')) {
      return res.data.data ?? null;
    }
    return res.data || null;
  },

  /**
   * Lấy số liệu thống kê tổng hợp quỹ lương tháng (Admin, BGH, Kế toán, Trưởng khoa)
   */
  async getPayrollSummary(month: number, year: number, departmentId?: string): Promise<PayrollSummaryData> {
    const query = new URLSearchParams({
      thang: String(month),
      nam: String(year),
    });
    if (departmentId) query.append('don_vi_id', departmentId);
    const res = await apiClient.get<any>(`/phieu-luong/tong-hop?${query.toString()}`);
    if (res.data && Object.prototype.hasOwnProperty.call(res.data, 'data') && res.data.data) {
      return res.data.data;
    }
    return (
      res.data || {
        thang: month,
        nam: year,
        tong_ban_ghi: 0,
        tong_thuc_linh: 0,
        tong_thu_nhap: 0,
        tong_thue_tncn: 0,
        tong_bao_hiem: 0,
        tong_vuot_gio: 0,
        so_phieu_da_khoa: 0,
        da_khoa: false,
        da_khoa_mot_phan: false,
      }
    );
  },

  /**
   * Khởi tạo & Tính toán bảng lương dự thảo cho toàn trường hoặc theo khoa
   */
  async generatePayroll(payload: GeneratePayrollPayload): Promise<any> {
    const res = await apiClient.post<any>('/phieu-luong/khoi-tao', payload);
    return res.data?.data ?? res.data;
  },

  /**
   * Khóa sổ lương tháng & chốt công không cho sửa đổi
   */
  async lockPayroll(payload: LockPayrollPayload): Promise<any> {
    const url = payload.id ? `/phieu-luong/${payload.id}/khoa` : '/phieu-luong/khoa';
    const res = payload.id
      ? await apiClient.put<any>(url, payload)
      : await apiClient.post<any>(url, payload);
    return res.data?.data ?? res.data;
  },

  /**
   * Mở khóa sổ lương tháng (Admin/BGH/Kế toán - bắt buộc có lý do giải trình)
   */
  async unlockPayroll(payload: UnlockPayrollPayload): Promise<any> {
    const url = payload.id ? `/phieu-luong/${payload.id}/mo-khoa` : '/phieu-luong/mo-khoa';
    const res = payload.id
      ? await apiClient.put<any>(url, payload)
      : await apiClient.post<any>(url, payload);
    return res.data?.data ?? res.data;
  },

  /**
   * Trích xuất dữ liệu bảng lương định dạng Excel
   */
  async exportExcel(month: number, year: number, departmentId?: string): Promise<PayrollExcelExportData> {
    const query = new URLSearchParams();
    query.append('thang', String(month));
    query.append('nam', String(year));
    if (departmentId) query.append('don_vi_id', departmentId);

    const res = await apiClient.get<any>(`/phieu-luong/xuat-excel?${query.toString()}`);
    return res.data?.data ?? res.data;
  },

  /**
   * Trích xuất dữ liệu phiếu lương in ấn PDF
   */
  async exportPdf(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/phieu-luong/${id}/xuat-pdf`);
    return res.data?.data ?? res.data;
  },
};
