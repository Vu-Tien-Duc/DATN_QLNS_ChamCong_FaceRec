// =============================================================================
// TYPES CHUẨN CHO FRONTEND DỰ ÁN QLNS & CHẤM CÔNG FACE RECOGNITION (CSDL v2.5)
// =============================================================================

export type RoleType =
  | 'admin'
  | 'bgh'
  | 'tccb'
  | 'dao_tao'
  | 'ke_toan'
  | 'kiem_toan'
  | 'truong_khoa'
  | 'pho_khoa'
  | 'truong_bo_mon'
  | 'pho_bo_mon'
  | 'truong_phong'
  | 'pho_phong'
  | 'giang_vien'
  | 'chuyen_vien'
  | 'nhan_vien'
  | 'quan_ly_xe';

export type UserRoleLegacy = RoleType;

export interface UserRoleItem {
  role: RoleType | string;
  scope: 'toan_truong' | 'khoa' | 'bo_mon' | 'phong_ban';
  departmentId?: string;
  startDate?: string;
  endDate?: string;
}

export type AcademicRankType = 'giao_su' | 'pho_giao_su' | 'khong';
export type DegreeType = 'tien_si' | 'thac_si' | 'cu_nhan' | 'ky_su' | 'khac';
export type StaffType = 'giang_vien' | 'hanh_chinh';
export type ContractType =
  | 'toan_thoi_gian'
  | 'ban_thoi_gian'
  | 'thu_viec'
  | 'khong_xac_dinh_thoi_han'
  | 'xac_dinh_thoi_han';
export type EmploymentStatusType = 'dang_lam_viec' | 'da_nghi_viec' | 'tam_hoan';
export type GenderType = 'nam' | 'nu' | 'khac';

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

export type DepartmentType = 'khoa' | 'bo_mon' | 'bomon' | 'phong_ban' | 'phongban' | (string & {});

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
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  shiftName?: string;
  method?: CheckInMethod;
  similarityScore?: number;
  faceConfidence?: number;
  isApproved?: boolean;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'nghi_phep' | 'day_bu' | 'doi_ca' | 'nghi_om' | 'viec_rieng';

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

export type ScheduleType = 'chinh_khoa' | 'day_bu';
export type ScheduleExceptionStatus = 'nghi' | 'huy' | 'day_bu';

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

