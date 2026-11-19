export type AttendanceStatus =
  | 'on_time'
  | 'late'
  | 'early_leave'
  | 'absent'
  | 'excused_absence'
  | 'HOLIDAY';

export type CheckInMethod = 'FACE_RECOGNITION' | 'GPS' | 'qr_code' | 'MANUAL';

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
  /** @deprecated Dùng id */
  _id?: string;
  /** @deprecated Dùng ngay_cong */
  date?: string;
  /** @deprecated Dùng ngay_cong */
  workDate?: string;
  /** @deprecated Dùng thoi_gian_vao */
  checkInTime?: string;
  /** @deprecated Dùng thoi_gian_ra */
  checkOutTime?: string;
  /** @deprecated Dùng trang_thai */
  status?: AttendanceStatus;
  /** @deprecated Dùng ten_ca */
  shiftName?: string;
  /** @deprecated Dùng phuong_thuc */
  method?: CheckInMethod;
  /** @deprecated Dùng di_muon_phut */
  lateMinutes?: number;
  /** @deprecated Dùng ve_som_phut */
  earlyMinutes?: number;
  /** @deprecated Dùng thoi_luong_lam_viec_phut */
  workingMinutes?: number;
  similarityScore?: number;
  faceConfidence?: number;
  isApproved?: boolean;
}

export interface ShiftItem {
  id?: string;
  ten_ca?: string;
  gio_bat_dau?: string;
  gio_ket_thuc?: string;
  nguong_di_muon_phut?: number;
  mo_ta?: string;
  kich_hoat?: boolean;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ten_ca */
  name: string;
  /** @deprecated Dùng gio_bat_dau */
  startTime: string;
  /** @deprecated Dùng gio_ket_thuc */
  endTime: string;
  /** @deprecated Dùng nguong_di_muon_phut */
  lateThresholdMinutes?: number;
  /** @deprecated Dùng mo_ta */
  description?: string;
  /** @deprecated Dùng kich_hoat */
  isActive?: boolean;
}
