// Utility types cho toàn bộ hệ thống QLNS Chấm công

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}

export interface UserBasic {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string;
  phone?: string;
  role?: { _id: string; name: string } | string;
  department?: { _id: string; name: string } | string;
  isActive?: boolean;
  isFaceRegistered?: boolean;
  facePhoto?: string;
}

export interface ShiftConfig {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes?: number;
  description?: string;
  isActive?: boolean;
}

export interface Schedule {
  _id: string;
  userId?: UserBasic;
  shiftId?: ShiftConfig;
  date: string;
  status?: string;
  note?: string;
}

export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'ABSENT'
  | 'EARLY_LEAVE'
  | 'EXCUSED_ABSENCE'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'PRESENT';

export type CheckInMethod = 'face' | 'qr' | 'manual' | 'gps' | 'fingerprint';

export interface AttendanceLog {
  _id: string;
  userId?: UserBasic;
  shiftId?: ShiftConfig | string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: AttendanceStatus;
  method?: CheckInMethod;
  note?: string;
  date?: string;
  createdAt: string;
  faceSnapshotUrl?: string;
  similarity?: number;
}

export interface Department {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  headId?: UserBasic | string;
  memberCount?: number;
  isActive?: boolean;
}

export interface Subject {
  _id: string;
  name: string;
  code?: string;
  credits?: number;
  description?: string;
  departmentId?: Department | string;
  isActive?: boolean;
}

export type LeaveType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MATERNITY' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  _id: string;
  userId?: UserBasic;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
  createdAt: string;
}

export interface PhuCapItem {
  loai_phu_cap?: string;
  he_so_hoac_ty_le?: number;
  so_tien?: number;
}

export interface KhoanDieuChinh {
  ly_do?: string;
  so_tien?: number;
}

export interface Payroll {
  _id: string;
  userId?: UserBasic | any;
  nguoi_dung_id?: UserBasic | any;
  month: number;
  thang: number;
  year: number;
  nam: number;
  salaryCoefficient?: number;
  he_so_luong?: number;
  baseSalary?: number;
  luong_co_so?: number;
  primarySalary?: number;
  luong_chinh?: number;
  positionAllowance?: number;
  phu_cap_chuc_vu?: number;
  seniorityAllowance?: number;
  phu_cap_tham_nien?: number;
  vocationalAllowance?: number;
  phu_cap_uu_dai_nghe?: number;
  phu_cap?: PhuCapItem[];
  khoan_thuong?: KhoanDieuChinh[];
  khau_tru?: KhoanDieuChinh[];
  gio_giang?: {
    dinh_muc_goc?: number;
    ty_le_giam_dinh_muc?: number;
    dinh_muc_sau_giam?: number;
    gio_quy_doi_tich_luy?: number;
    gio_vuot_dinh_muc?: number;
    don_gia_gio_chuan?: number;
    thu_lao_vuot_gio?: number;
    da_tam_ung?: number;
  };
  grossIncome?: number;
  tong_thu_nhap_gross?: number;
  bao_hiem?: {
    bhxh?: number;
    bhyt?: number;
    bhtn?: number;
    tong_bao_hiem?: number;
  };
  thue_tncn?: {
    giam_tru_ban_than?: number;
    giam_tru_phu_thuoc?: number;
    thu_nhap_tinh_thue?: number;
    tien_thue?: number;
  };
  netSalary?: number;
  thuc_linh_net?: number;
  status?: 'DU_THAO' | 'CHO_DUYET' | 'DA_DUYET' | 'DA_KHOA' | 'DA_THANH_TOAN';
  trang_thai?: string;
  isLocked?: boolean;
  lockedAt?: string;
  khoa_luc?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Holiday {
  _id: string;
  ten_ngay_le?: string;
  name?: string;
  ngay_bat_dau: string;
  startDate?: string;
  ngay_ket_thuc: string;
  endDate?: string;
  so_ngay_nghi?: number;
  daysCount?: number;
  mo_ta?: string;
  description?: string;
  nam?: number;
  year?: number;
  ap_dung_toan_truong?: boolean;
  createdAt?: string;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  agentMode?: 'attendance' | 'policy' | 'academic';
  provider?: string;
  data?: any;
}

