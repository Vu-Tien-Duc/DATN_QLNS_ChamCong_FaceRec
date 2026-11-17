export type AttendanceStatus =
  | 'on_time'
  | 'late'
  | 'early_leave'
  | 'absent'
  | 'excused_absence'
  | 'HOLIDAY';

export type CheckInMethod = 'FACE_RECOGNITION' | 'GPS' | 'qr_code' | 'MANUAL';

export interface AttendanceToday {
  _id?: string;
  date: string;
  workDate?: string;
  ngay_cong?: string;
  checkInTime?: string;
  thoi_gian_vao?: string;
  checkOutTime?: string;
  thoi_gian_ra?: string;
  status: AttendanceStatus;
  trang_thai?: AttendanceStatus;
  shiftName?: string;
  ten_ca?: string;
  ca_id?: any;
  method?: CheckInMethod;
  phuong_thuc?: CheckInMethod;
  lateMinutes?: number;
  di_muon_phut?: number;
  earlyMinutes?: number;
  ve_som_phut?: number;
  workingMinutes?: number;
  thoi_luong_lam_viec_phut?: number;
  similarityScore?: number;
  faceConfidence?: number;
  isApproved?: boolean;
}

export interface ShiftItem {
  _id: string;
  name: string;
  ten_ca?: string;
  startTime: string;
  gio_bat_dau?: string;
  endTime: string;
  gio_ket_thuc?: string;
  lateThresholdMinutes?: number;
  nguong_di_muon_phut?: number;
  description?: string;
  isActive?: boolean;
  kich_hoat?: boolean;
}
