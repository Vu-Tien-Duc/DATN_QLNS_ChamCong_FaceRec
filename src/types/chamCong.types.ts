export type AttendanceStatus =
  | 'on_time'
  | 'late'
  | 'early_leave'
  | 'thieu_check_out'
  | 'absent'
  | 'excused_absence';

export type CheckInMethod =
  | 'face_ai'
  | 'qr_code'
  | 'gps_mobile'
  | 'thu_cong_admin'
  | 'system_auto';

export interface AttendanceToday {
  id?: string;
  ngay_cong?: string;
  thoi_gian_vao?: string;
  thoi_gian_ra?: string;
  trang_thai?: AttendanceStatus;
  ten_ca?: string;
  ca_id?: any;
  phuong_thuc?: CheckInMethod | string;
  di_muon_phut?: number;
  ve_som_phut?: number;
  thoi_luong_lam_viec_phut?: number;
  co_gian_lan?: boolean;
  da_chot?: boolean;
}

export interface ShiftItem {
  id?: string;
  ten_ca?: string;
  gio_bat_dau?: string;
  gio_ket_thuc?: string;
  nguong_di_muon_phut?: number;
  mo_ta?: string;
  kich_hoat?: boolean;
}
