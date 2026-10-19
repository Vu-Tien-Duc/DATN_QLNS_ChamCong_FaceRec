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
  month: number;
  year: number;
  salaryCoefficient?: number;
  baseSalary?: number;
  primarySalary?: number;
  positionAllowance?: number;
  seniorityAllowance?: number;
  vocationalAllowance?: number;
  allowances?: PhuCapItem[];
  bonusItems?: KhoanDieuChinh[];
  deductionItems?: KhoanDieuChinh[];
  teachingHours?: {
    baseQuota?: number;
    reductionRatio?: number;
    adjustedQuota?: number;
    accumulatedStandardHours?: number;
    overQuotaHours?: number;
    hourlyRate?: number;
    overQuotaRemuneration?: number;
    advancedPayment?: number;
  };
  grossIncome?: number;
  insurance?: {
    socialInsurance?: number;
    healthInsurance?: number;
    unemploymentInsurance?: number;
    totalInsurance?: number;
  };
  personalIncomeTax?: {
    personalDeduction?: number;
    dependentDeduction?: number;
    taxableIncome?: number;
    taxAmount?: number;
  };
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
  status?: 'DU_THAO' | 'CHO_DUYET' | 'DA_DUYET' | 'DA_KHOA' | 'DA_THANH_TOAN';
  isLocked?: boolean;
  lockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Holiday {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  daysCount?: number;
  description?: string;
  year?: number;
  isPaid?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

