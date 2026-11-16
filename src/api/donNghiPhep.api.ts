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
  cap: number;
  nguoi_duyet?: {
    _id: string;
    fullName?: string;
    email?: string;
    role?: string;
    avatar?: string;
  };
  vai_tro?: string;
  hanh_dong: 'approved' | 'rejected';
  ghi_chu?: string;
  thoi_gian: string;
}

export interface LeaveRequestData {
  _id: string;
  userId:
    | {
        _id: string;
        fullName: string;
        email: string;
        role?: string;
        departmentId?: any;
        avatar?: string;
        staffCode?: string;
      }
    | string;
  type: BackendLeaveType;
  loai_don?: string;
  reason: string;
  ly_do?: string;
  startDate: string;
  ngay_bat_dau?: string;
  endDate: string;
  ngay_ket_thuc?: string;
  numberOfDays?: number;
  so_ngay?: number;
  totalDays?: number;
  scheduleId?: any;
  makeupDate?: string;
  attachmentUrl?: string;
  status: BackendLeaveStatus;
  trang_thai?: string;
  requiredLevels?: number;
  currentLevel?: number;
  approvedBy?: any;
  approvalNote?: string;
  rejectionReason?: string;
  approvalHistory?: ApprovalHistoryItem[];
  lich_su_duyet?: ApprovalHistoryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalanceData {
  userId: string;
  year: number;
  annualLeaveQuota: number;
  daysUsed: number;
  pendingDays: number;
  pendingAnnualLeaveDays: number;
  pendingRequestsCount: number;
  remainingDays: number;
  availableDays: number;
  isAdmin?: boolean;
  message?: string;
}

export interface CreateLeavePayload {
  type: string;
  reason: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  scheduleId?: string;
  makeupDate?: string;
  attachmentUrl?: string;
  file?: File;
}

export const leaveRequestApi = {
  getLeaveRequests: async (params?: {
    status?: string;
    type?: string;
    userId?: string;
    limit?: number;
    page?: number;
  }) => {
    const mappedParams = params
      ? {
          trang_thai: params.status,
          loai_don: params.type,
          nguoi_dung_id: params.userId,
          gioi_han: params.limit,
          trang: params.page,
        }
      : undefined;
    const res = await apiClient.get('/don-nghi-phep', { params: mappedParams });
    return res.data;
  },

  getLeaveBalance: async (userId?: string) => {
    const res = await apiClient.get('/don-nghi-phep/so-du', {
      params: userId ? { nguoi_dung_id: userId } : undefined,
    });
    const raw = res.data?.data || res.data;
    if (!raw || typeof raw !== 'object') return raw;

    const quota = raw.annualLeaveQuota !== undefined ? raw.annualLeaveQuota : (raw.han_muc_phep_nam !== undefined ? raw.han_muc_phep_nam : 12);
    const used = raw.daysUsed !== undefined ? raw.daysUsed : (raw.so_ngay_da_nghi !== undefined ? raw.so_ngay_da_nghi : 0);
    const pending = raw.pendingAnnualLeaveDays !== undefined ? raw.pendingAnnualLeaveDays : (raw.so_ngay_cho_duyet !== undefined ? raw.so_ngay_cho_duyet : 0);
    const available = raw.availableDays !== undefined ? raw.availableDays : (raw.so_ngay_kha_dung !== undefined ? raw.so_ngay_kha_dung : Math.max(0, quota - used - pending));
    const remaining = raw.remainingDays !== undefined ? raw.remainingDays : (raw.so_ngay_con_lai !== undefined ? raw.so_ngay_con_lai : Math.max(0, quota - used));
    const year = raw.year || raw.nam || new Date().getFullYear();
    const isAdmin = Boolean(raw.isAdmin ?? raw.is_admin);

    return {
      ...raw,
      annualLeaveQuota: quota,
      han_muc_phep_nam: quota,
      daysUsed: used,
      so_ngay_da_nghi: used,
      pendingAnnualLeaveDays: pending,
      so_ngay_cho_duyet: pending,
      availableDays: available,
      so_ngay_kha_dung: available,
      remainingDays: remaining,
      so_ngay_con_lai: remaining,
      year,
      nam: year,
      isAdmin,
      is_admin: isAdmin,
    };
  },

  getLeaveRequestById: async (id: string) => {
    const res = await apiClient.get(`/don-nghi-phep/${id}`);
    return res.data?.data || res.data;
  },

  createLeaveRequest: async (payload: CreateLeavePayload) => {
    if (payload.file) {
      const formData = new FormData();
      formData.append('loai_don', payload.type);
      formData.append('ly_do', payload.reason);
      formData.append('ngay_bat_dau', payload.startDate);
      formData.append('ngay_ket_thuc', payload.endDate);
      if (payload.isHalfDay) formData.append('nua_ngay', 'true');
      if (payload.scheduleId) formData.append('lich_trinh_id', payload.scheduleId);
      if (payload.makeupDate) formData.append('ngay_day_bu', payload.makeupDate);
      formData.append('file', payload.file);

      const res = await apiClient.post('/don-nghi-phep', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }

    const res = await apiClient.post('/don-nghi-phep', {
      loai_don: payload.type,
      ly_do: payload.reason,
      ngay_bat_dau: payload.startDate,
      ngay_ket_thuc: payload.endDate,
      nua_ngay: payload.isHalfDay,
      lich_trinh_id: payload.scheduleId,
      ngay_day_bu: payload.makeupDate,
      tep_dinh_kem: payload.attachmentUrl,
    });
    return res.data;
  },

  approveLeaveRequest: async (id: string, approvalNote?: string) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/phe-duyet`, {
      ghi_chu_duyet: approvalNote || 'Đã phê duyệt đơn.',
    });
    return res.data;
  },

  rejectLeaveRequest: async (id: string, rejectionReason: string) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/tu-choi`, {
      ly_do_tu_choi: rejectionReason,
    });
    return res.data;
  },

  cancelLeaveRequest: async (id: string) => {
    const res = await apiClient.put(`/don-nghi-phep/${id}/huy`);
    return res.data;
  },
};
