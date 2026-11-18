import { UserProfile } from './nguoiDung.types';

export type LeaveStatus = 'pending' | 'pending_dean' | 'pending_bgh' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'nghi_phep' | 'day_bu' | 'doi_ca' | 'nghi_om' | 'viec_rieng' | 'giai_trinh_cong';

export interface LeaveRequestItem {
  _id: string;
  userId: UserProfile | string;
  nguoi_dung_id?: UserProfile | string;
  type: LeaveType;
  loai_don?: LeaveType;
  startDate: string;
  ngay_bat_dau?: string;
  endDate: string;
  ngay_ket_thuc?: string;
  totalDays: number;
  so_ngay?: number;
  reason: string;
  ly_do?: string;
  status: LeaveStatus;
  trang_thai?: LeaveStatus;
  approverId?: UserProfile | string;
  nguoi_duyet_id?: UserProfile | string;
  approverComment?: string;
  ghi_chu_duyet?: string;
  createdAt: string;
  tao_luc?: string;
}
