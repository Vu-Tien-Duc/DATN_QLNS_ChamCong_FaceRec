import { UserProfile } from './nguoiDung.types';

export type LeaveStatus = 'pending' | 'pending_dean' | 'pending_bgh' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'nghi_phep' | 'day_bu' | 'doi_ca' | 'nghi_om' | 'viec_rieng' | 'giai_trinh_cong';

export interface LeaveRequestItem {
  id?: string;
  nguoi_dung_id?: UserProfile | string;
  loai_don?: LeaveType;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  so_ngay?: number;
  ly_do?: string;
  trang_thai?: LeaveStatus;
  nguoi_duyet_id?: UserProfile | string;
  ghi_chu_duyet?: string;
  tao_luc?: string;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng nguoi_dung_id */
  userId?: UserProfile | string;
  /** @deprecated Dùng loai_don */
  type?: LeaveType;
  /** @deprecated Dùng ngay_bat_dau */
  startDate?: string;
  /** @deprecated Dùng ngay_ket_thuc */
  endDate?: string;
  /** @deprecated Dùng so_ngay */
  totalDays?: number;
  /** @deprecated Dùng ly_do */
  reason?: string;
  /** @deprecated Dùng trang_thai */
  status?: LeaveStatus;
  /** @deprecated Dùng nguoi_duyet_id */
  approverId?: UserProfile | string;
  /** @deprecated Dùng ghi_chu_duyet */
  approverComment?: string;
  /** @deprecated Dùng tao_luc */
  createdAt?: string;
}
