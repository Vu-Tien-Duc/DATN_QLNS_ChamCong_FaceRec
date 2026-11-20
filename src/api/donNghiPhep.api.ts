import { apiClient } from './apiClient';

export type BackendLeaveType =
  | 'nghi_phep'
  | 'day_bu'
  | 'doi_ca'
  | 'nghi_om'
  | 'viec_rieng'
  | 'giai_trinh_cong'
  | 'giai_trinh_thieu_check_out';

export type BackendLeaveStatus =
  | 'pending'
  | 'pending_bgh'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ApprovalHistoryItem {
  id?: string;
  don_nghi_phep_id?: string;
  nguoi_duyet_id?: string;
  cap_duyet?: 'khoa' | 'bgh' | string;
  hanh_dong?: 'approved' | 'rejected' | string;
  y_kien?: string | null;
  thoi_diem?: string;
  nguoi_duyet?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    vai_tro_chinh?: string;
    anh_dai_dien?: string | null;
    ma_can_bo?: string;
  } | null;
}

export interface LeaveRequestData {
  id: string;
  nguoi_dung_id: string;
  nguoi_dung?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    vai_tro_chinh?: string;
    don_vi_chinh_id?: string | null;
    don_vi_chinh?: {
      id?: string;
      ten_phong_ban?: string;
      loai_don_vi?: string;
    } | null;
    anh_dai_dien?: string | null;
    ma_can_bo?: string;
  } | null;
  nguoi_duyet_id?: string | null;
  nguoi_duyet?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    vai_tro_chinh?: string;
    anh_dai_dien?: string | null;
    ma_can_bo?: string;
  } | null;
  giang_vien_day_thay_id?: string | null;
  giang_vien_day_thay?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    ma_can_bo?: string;
  } | null;
  ca_thay_the_id?: string | null;
  ca_thay_the?: {
    id?: string;
    ten_ca?: string;
    gio_bat_dau?: string;
    gio_ket_thuc?: string;
  } | null;
  lich_trinh_id?: string | null;
  lich_trinh?: {
    id?: string;
    phong_hoc?: string;
    thu_trong_tuan?: number;
    tiet_bat_dau?: number;
    so_tiet?: number;
    gio_bat_dau?: string;
    gio_ket_thuc?: string;
    mon_hoc?: {
      id?: string;
      ten_mon?: string;
      ma_mon?: string;
    } | null;
  } | null;
  loai_don: BackendLeaveType | string;
  ly_do: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  so_ngay: number;
  so_tiet_nghi?: number;
  nhat_ky_id?: string | null;
  nhat_ky?: {
    id?: string;
    ngay_cong?: string;
    thoi_gian_vao?: string | null;
    thoi_gian_ra?: string | null;
    trang_thai?: string;
    di_muon_phut?: number;
    lich_trinh_id?: string | null;
    ca_id?: string | null;
  } | null;
  so_tiet_xac_nhan?: number | null;
  ngay_day_bu?: string | null;
  tep_dinh_kem?: string | null;
  trang_thai: BackendLeaveStatus | string;
  thoi_gian_duyet?: string | null;
  ly_do_tu_choi?: string | null;
  cap_duyet_hien_tai?: number;
  so_cap_duyet?: number;
  lich_su_duyet?: ApprovalHistoryItem[];
  tao_luc?: string;
  cap_nhat_luc?: string;
}

export interface LeaveBalanceData {
  nguoi_dung_id?: string;
  nam: number;
  han_muc_phep_nam: number;
  so_ngay_da_nghi: number;
  so_ngay_cho_duyet: number;
  so_ngay_con_lai: number;
  so_ngay_kha_dung: number;
  is_admin?: boolean;
  message?: string;
}

export interface CreateLeavePayload {
  loai_don: string;
  ly_do: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  nua_ngay?: boolean;
  so_tiet_nghi?: number;
  lich_trinh_id?: string;
  ca_thay_the_id?: string;
  giang_vien_day_thay_id?: string;
  ngay_day_bu?: string;
  tep_dinh_kem?: string;
  file?: File;
  /** ID bản ghi nhật ký (chỉ dùng cho giai_trinh_thieu_check_out) */
  nhat_ky_id?: string;
}

export const leaveRequestApi = {
  getLeaveRequests: async (params?: {
    trang_thai?: string;
    loai_don?: string;
    nguoi_dung_id?: string;
  }) => {
    const res = await apiClient.get('/don-nghi-phep', { params });
    return res.data;
  },

  getSubstituteLecturers: async (): Promise<
    Array<{
      id: string;
      ho_ten: string;
      ma_can_bo?: string;
      vai_tro_chinh?: string;
      don_vi_chinh_id?: string | null;
    }>
  > => {
    const res = await apiClient.get('/don-nghi-phep/giang-vien-day-thay');
    return res.data?.data || res.data || [];
  },

  getLeaveBalance: async (nguoi_dung_id?: string): Promise<LeaveBalanceData> => {
    const res = await apiClient.get('/don-nghi-phep/so-du', {
      params: nguoi_dung_id ? { nguoi_dung_id } : undefined,
    });
    return res.data?.data || res.data;
  },

  getLeaveRequestById: async (id: string) => {
    const res = await apiClient.get(`/don-nghi-phep/${id}`);
    return res.data?.data || res.data;
  },

  createLeaveRequest: async (payload: CreateLeavePayload) => {
    if (payload.file) {
      const formData = new FormData();
      formData.append('loai_don', payload.loai_don);
      formData.append('ly_do', payload.ly_do);
      formData.append('ngay_bat_dau', payload.ngay_bat_dau);
      formData.append('ngay_ket_thuc', payload.ngay_ket_thuc);
      if (payload.nua_ngay) formData.append('nua_ngay', 'true');
      if (payload.so_tiet_nghi !== undefined && payload.so_tiet_nghi > 0) {
        formData.append('so_tiet_nghi', String(payload.so_tiet_nghi));
      }
      if (payload.lich_trinh_id) formData.append('lich_trinh_id', payload.lich_trinh_id);
      if (payload.ca_thay_the_id) formData.append('ca_thay_the_id', payload.ca_thay_the_id);
      if (payload.giang_vien_day_thay_id) formData.append('giang_vien_day_thay_id', payload.giang_vien_day_thay_id);
      if (payload.ngay_day_bu) formData.append('ngay_day_bu', payload.ngay_day_bu);
      if (payload.nhat_ky_id) formData.append('nhat_ky_id', payload.nhat_ky_id);
      formData.append('file', payload.file);

      const res = await apiClient.post('/don-nghi-phep', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }

    const res = await apiClient.post('/don-nghi-phep', payload);
    return res.data;
  },

  approveLeaveRequest: async (id: string, approvalNote?: string, expectedVersion?: number, soTietXacNhan?: number) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/phe-duyet`, {
      ghi_chu_duyet: approvalNote || 'Đã phê duyệt đơn.',
      ...(expectedVersion !== undefined ? { phien_ban: expectedVersion } : {}),
      ...(soTietXacNhan !== undefined ? { so_tiet_xac_nhan: soTietXacNhan } : {}),
    });
    return res.data;
  },

  rejectLeaveRequest: async (id: string, rejectionReason: string, expectedVersion?: number) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/tu-choi`, {
      ly_do_tu_choi: rejectionReason,
      ...(expectedVersion !== undefined ? { phien_ban: expectedVersion } : {}),
    });
    return res.data;
  },

  cancelLeaveRequest: async (id: string, expectedVersion?: number) => {
    const res = await apiClient.put(
      `/don-nghi-phep/${id}/huy`,
      expectedVersion !== undefined ? { phien_ban: expectedVersion } : undefined
    );
    return res.data;
  },
};
