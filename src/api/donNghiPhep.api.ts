import { apiClient } from './apiClient';

export type BackendLeaveType =
  | 'nghi_phep'
  | 'day_bu'
  | 'doi_ca'
  | 'nghi_om'
  | 'viec_rieng'
  | 'giai_trinh_cong';

export type BackendLeaveStatus =
  | 'pending'
  | 'pending_dean'
  | 'pending_bgh'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ApprovalHistoryItem {
  level?: 'khoa' | 'bgh' | number | string;
  cap_duyet?: 'khoa' | 'bgh' | string;
  cap?: number;
  approver?: {
    _id: string;
    fullName?: string;
    email?: string;
    role?: string;
    avatar?: string;
  };
  nguoi_duyet?: {
    id?: string;
    _id?: string;
    ho_ten?: string;
    fullName?: string;
    email?: string;
    vai_tro_chinh?: string;
    role?: string;
    anh_dai_dien?: string;
    avatar?: string;
  };
  vai_tro?: string;
  action?: 'approved' | 'rejected' | string;
  hanh_dong?: 'approved' | 'rejected' | string;
  comment?: string;
  ghi_chu?: string;
  timestamp?: string;
  thoi_gian?: string;
}

export interface LeaveRequestData {
  id?: string;
  nguoi_dung_id?: string;
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
  nguoi_duyet?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    vai_tro_chinh?: string;
  } | null;
  giang_vien_day_thay?: {
    id?: string;
    ho_ten?: string;
    ma_can_bo?: string;
  } | null;
  ca_thay_the?: {
    id?: string;
    ten_ca?: string;
    gio_bat_dau?: string;
    gio_ket_thuc?: string;
  } | null;
  lich_trinh?: {
    id?: string;
    phong_hoc?: string;
    thu_trong_tuan?: number;
    mon_hoc?: {
      id?: string;
      ten_mon?: string;
      ma_mon?: string;
    } | null;
  } | null;
  loai_don?: BackendLeaveType | string;
  ly_do?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  so_ngay?: number;
  nua_ngay?: boolean;
  ngay_day_bu?: string | null;
  so_tiet_nghi?: number;
  tep_dinh_kem?: string | null;
  trang_thai?: BackendLeaveStatus | string;
  ghi_chu_duyet?: string | null;
  ly_do_tu_choi?: string | null;
  phien_ban?: number;
  lich_su_duyet?: ApprovalHistoryItem[];
  tao_luc?: string;
  cap_nhat_luc?: string;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng nguoi_dung hoặc nguoi_dung_id */
  userId:
    | {
        id?: string;
        _id: string;
        ho_ten?: string;
        fullName: string;
        email: string;
        vai_tro_chinh?: string;
        role?: string;
        don_vi_chinh_id?: any;
        departmentId?: any;
        anh_dai_dien?: string;
        avatar?: string;
        ma_can_bo?: string;
        staffCode?: string;
      }
    | string;
  /** @deprecated Dùng loai_don */
  type: BackendLeaveType;
  /** @deprecated Dùng ly_do */
  reason: string;
  /** @deprecated Dùng ngay_bat_dau */
  startDate: string;
  /** @deprecated Dùng ngay_ket_thuc */
  endDate: string;
  numberOfDays?: number;
  /** @deprecated Dùng so_ngay */
  totalDays?: number;
  isHalfDay?: boolean;
  scheduleId?: any;
  schedule?: any;
  makeupDate?: string;
  leavePeriods?: number;
  substituteShiftId?: any;
  substituteTeacherId?: any;
  attachmentUrl?: string;
  /** @deprecated Dùng trang_thai */
  status: BackendLeaveStatus;
  requiredLevels?: number;
  currentLevel?: number;
  approvedBy?: any;
  approvalNote?: string;
  rejectionReason?: string;
  /** @deprecated Dùng lich_su_duyet */
  approvalHistory?: ApprovalHistoryItem[];
  /** @deprecated Dùng tao_luc */
  createdAt?: string;
  /** @deprecated Dùng cap_nhat_luc */
  updatedAt?: string;
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
}

export const leaveRequestApi = {
  getLeaveRequests: async (params?: {
    trang_thai?: string;
    loai_don?: string;
    nguoi_dung_id?: string;
    gioi_han?: number;
    trang?: number;
  }) => {
    const res = await apiClient.get('/don-nghi-phep', { params });
    return res.data;
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
      formData.append('file', payload.file);

      const res = await apiClient.post('/don-nghi-phep', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }

    const res = await apiClient.post('/don-nghi-phep', payload);
    return res.data;
  },

  approveLeaveRequest: async (id: string, approvalNote?: string, expectedVersion?: number) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/phe-duyet`, {
      ghi_chu_duyet: approvalNote || 'Đã phê duyệt đơn.',
      ...(expectedVersion !== undefined ? { phien_ban: expectedVersion } : {}),
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
