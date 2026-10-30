import { apiClient } from './apiClient';

export type BackendLeaveType =
  | 'nghi_phep'
  | 'day_bu'
  | 'doi_ca'
  | 'nghi_om'
  | 'viec_rieng';

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
    const res = await apiClient.get('/leave-requests', { params });
    return res.data;
  },

  getLeaveBalance: async (userId?: string) => {
    const res = await apiClient.get('/leave-requests/balance', {
      params: userId ? { userId } : undefined,
    });
    return res.data?.data || res.data;
  },

  getLeaveRequestById: async (id: string) => {
    const res = await apiClient.get(`/leave-requests/${id}`);
    return res.data?.data || res.data;
  },

  createLeaveRequest: async (payload: CreateLeavePayload) => {
    if (payload.file) {
      const formData = new FormData();
      formData.append('type', payload.type);
      formData.append('reason', payload.reason);
      formData.append('startDate', payload.startDate);
      formData.append('endDate', payload.endDate);
      if (payload.isHalfDay) formData.append('isHalfDay', 'true');
      if (payload.scheduleId) formData.append('scheduleId', payload.scheduleId);
      if (payload.makeupDate) formData.append('makeupDate', payload.makeupDate);
      formData.append('file', payload.file);

      const res = await apiClient.post('/leave-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }

    const res = await apiClient.post('/leave-requests', {
      type: payload.type,
      reason: payload.reason,
      startDate: payload.startDate,
      endDate: payload.endDate,
      isHalfDay: payload.isHalfDay,
      scheduleId: payload.scheduleId,
      makeupDate: payload.makeupDate,
      attachmentUrl: payload.attachmentUrl,
    });
    return res.data;
  },

  approveLeaveRequest: async (id: string, approvalNote?: string) => {
    const res = await apiClient.put(`/leave-requests/${id}/approve`, {
      approvalNote: approvalNote || 'Đã phê duyệt đơn.',
    });
    return res.data;
  },

  rejectLeaveRequest: async (id: string, rejectionReason: string) => {
    const res = await apiClient.put(`/leave-requests/${id}/reject`, {
      rejectionReason,
    });
    return res.data;
  },

  cancelLeaveRequest: async (id: string) => {
    const res = await apiClient.put(`/leave-requests/${id}/cancel`);
    return res.data;
  },
};
