// =============================================================================
// TYPES CHUẨN CHO FRONTEND DỰ ÁN QLNS & CHẤM CÔNG FACE RECOGNITION (CSDL v2.5)
// =============================================================================

export type RoleType =
  | 'BGH'
  | 'TRUONG_KHOA'
  | 'PHO_KHOA'
  | 'TRUONG_BO_MON'
  | 'GIANG_VIEN'
  | 'NHAN_VIEN'
  | 'ADMIN_IT'
  | 'KE_TOAN'
  | 'QUAN_LY_XE';

export type UserRoleLegacy =
  | 'admin'
  | 'bgh'
  | 'truong_khoa'
  | 'pho_khoa'
  | 'giang_vien'
  | 'nhan_vien'
  | 'it_admin'
  | 'ke_toan';

export interface UserRoleItem {
  role: RoleType | string;
  scope: 'TOAN_TRUONG' | 'KHOA' | 'BO_MON' | 'PHONG_BAN';
  departmentId?: string;
  startDate?: string;
  endDate?: string;
}

export interface UserProfile {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRoleLegacy;
  roles?: UserRoleItem[];
  departmentId?: {
    _id: string;
    name: string;
    code?: string;
  } | string;
  departmentName?: string;
  employeeCode?: string;
  isActive: boolean;
  isFaceRegistered: boolean;
  annualLeaveQuota?: number;
  lastLogin?: string;
}

export interface DepartmentItem {
  _id: string;
  name: string;
  code: string;
  type?: string;
  managerId?: UserProfile | string;
  memberCount?: number;
}

export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'ABSENT'
  | 'EXCUSED_ABSENCE'
  | 'HOLIDAY';

export type CheckInMethod = 'FACE_RECOGNITION' | 'GPS' | 'QR_CODE' | 'MANUAL';

export interface AttendanceToday {
  _id?: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  shiftName?: string;
  method?: CheckInMethod;
  similarityScore?: number;
  faceConfidence?: number;
  isApproved?: boolean;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'ANNUAL' | 'SICK' | 'MATERNITY' | 'UNPAID' | 'BUSINESS';

export interface LeaveRequestItem {
  _id: string;
  userId: UserProfile | string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approverId?: UserProfile | string;
  approverComment?: string;
  createdAt: string;
}

export interface StatMetric {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  iconName: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  badge?: string | number;
  allowedRoles?: (UserRoleLegacy | string)[];
  children?: NavigationItem[];
}
