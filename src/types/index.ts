// =============================================================================
// TYPES CHUẨN CHO FRONTEND DỰ ÁN QLNS & CHẤM CÔNG FACE RECOGNITION (CSDL v2.5)
// =============================================================================

export type RoleType =
  | 'ADMIN'
  | 'BGH'
  | 'TRUONG_KHOA'
  | 'PHO_KHOA'
  | 'TRUONG_BO_MON'
  | 'GIANG_VIEN'
  | 'NHAN_VIEN'
  | 'KE_TOAN'
  | 'QUAN_LY_XE';

export type UserRoleLegacy =
  | 'admin'
  | 'bgh'
  | 'truong_khoa'
  | 'pho_khoa'
  | 'giang_vien'
  | 'nhan_vien'
  | 'ke_toan';

export interface UserRoleItem {
  role: RoleType | string;
  scope: 'TOAN_TRUONG' | 'KHOA' | 'BO_MON' | 'PHONG_BAN';
  departmentId?: string;
  startDate?: string;
  endDate?: string;
}

export type AcademicRankType = 'GIAO_SU' | 'PHO_GIAO_SU' | 'KHONG';
export type DegreeType = 'TIEN_SI' | 'THAC_SI' | 'CU_NHAN' | 'KY_SU' | 'KHAC';
export type StaffType = 'GIANG_VIEN' | 'HANH_CHINH';
export type ContractType =
  | 'TOAN_THOI_GIAN'
  | 'BAN_THOI_GIAN'
  | 'THU_VIEC'
  | 'KHONG_XAC_DINH_THOI_HAN'
  | 'XAC_DINH_THOI_HAN';
export type EmploymentStatusType = 'DANG_LAM_VIEC' | 'DA_NGHI_VIEC' | 'TAM_HOAN';
export type GenderType = 'NAM' | 'NU' | 'KHAC';

export interface UserProfile {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  role: UserRoleLegacy | string;
  primaryRole?: string;
  roles?: UserRoleItem[];
  departmentId?: {
    _id: string;
    name: string;
    code?: string;
    type?: string;
  } | string | null;
  departmentName?: string;
  staffCode?: string;
  position?: string;
  academicRank?: AcademicRankType;
  degree?: DegreeType;
  staffType?: StaffType;
  contractType?: ContractType;
  salaryScale?: string;
  salaryCoefficient?: number;
  dependentsCount?: number;
  annualLeaveQuota?: number;
  gender?: GenderType;
  dateOfBirth?: string;
  startDate?: string;
  address?: string;
  employmentStatus?: EmploymentStatusType;
  isActive: boolean;
  isFaceRegistered: boolean;
  faceRegisteredAt?: string | null;
  facePhoto?: string | null;
  sampleCount?: number;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserQueryParams {
  role?: string;
  departmentId?: string;
  isActive?: boolean | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  staffCode: string;
  role: string;
  departmentId?: string | null;
  phoneNumber?: string;
  position?: string;
  academicRank?: AcademicRankType;
  degree?: DegreeType;
  staffType?: StaffType;
  contractType?: ContractType;
  salaryScale?: string;
  salaryCoefficient?: number;
  dependentsCount?: number;
  annualLeaveQuota?: number;
  gender?: GenderType;
  dateOfBirth?: string;
  startDate?: string;
  address?: string;
  employmentStatus?: EmploymentStatusType;
  avatar?: string | null;
}

export type UpdateUserPayload = Partial<CreateUserPayload> & {
  isActive?: boolean;
};

export type DepartmentType = 'khoa' | 'bomon' | 'phongban';

export interface DepartmentManagerRef {
  _id: string;
  fullName: string;
  email?: string;
  staffCode?: string;
  role?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface DepartmentParentRef {
  _id: string;
  name: string;
  type?: DepartmentType | string;
}

export interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
  type: DepartmentType | string;
  parentId?: DepartmentParentRef | string | null;
  managerId?: DepartmentManagerRef | string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  location?: {
    lat: number | null;
    lng: number | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  memberCount?: number;
  subjectCount?: number;
  children?: DepartmentItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDepartmentPayload {
  name: string;
  type: DepartmentType;
  parentId?: string | null;
  managerId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  location?: {
    lat: number | null;
    lng: number | null;
  };
}

export type UpdateDepartmentPayload = Partial<CreateDepartmentPayload>;

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

// =============================================================================
// TYPES THỜI KHÓA BIỂU & PHÂN CÔNG GIẢNG DẠY (SCHEDULE - CSDL v2.5)
// =============================================================================

export type ScheduleType = 'CHINH_KHOA' | 'DAY_BU';
export type ScheduleExceptionStatus = 'NGHI' | 'HUY' | 'DAY_BU';

export interface ScheduleExceptionItem {
  _id?: string;
  date?: string;
  ngay?: string;
  reason?: string;
  ly_do?: string;
  status?: ScheduleExceptionStatus;
  trang_thai?: ScheduleExceptionStatus;
  makeupDate?: string;
}

export interface ShiftItem {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  description?: string;
  isActive?: boolean;
}

export interface SubjectItem {
  _id: string;
  name: string;
  code: string;
  credits?: number;
  departmentId?: string | { _id: string; name: string };
}

export interface ScheduleItem {
  _id: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    staffCode?: string;
    role?: string;
    avatarUrl?: string;
    departmentId?: string | { _id: string; name: string };
  };
  shiftId?: ShiftItem | string;
  subjectId?: SubjectItem | string;
  roomId: string;
  weekday: number; // 0: CN, 1: T2, ..., 6: T7
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startPeriod?: number; // 1-12
  periodCount?: number; // 1-6
  isRecurring: boolean;
  startDate: string;
  endDate: string;
  scheduleType?: ScheduleType;
  makeupDate?: string | null;
  weekNumbers?: number[];
  academicYear?: string;
  semester?: number;
  exceptions?: ScheduleExceptionItem[];
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleQueryParams {
  userId?: string;
  shiftId?: string;
  weekday?: number | string;
  academicYear?: string;
  semester?: number | string;
  startDate?: string;
  endDate?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface CreateSchedulePayload {
  userId: string;
  shiftId?: string;
  subjectId?: string;
  roomId: string;
  weekday: number;
  startTime?: string;
  endTime?: string;
  startPeriod?: number;
  periodCount?: number;
  isRecurring?: boolean;
  startDate: string;
  endDate: string;
  scheduleType?: ScheduleType;
  makeupDate?: string;
  weekNumbers?: number[];
  academicYear?: string;
  semester?: number;
}

