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
  ho_ten?: string;
  email: string;
  phoneNumber?: string;
  so_dien_thoai?: string;
  avatar?: string;
  anh_dai_dien?: string | null;
  role: UserRoleLegacy | string;
  vai_tro_chinh?: string;
  primaryRole?: string;
  roles?: UserRoleItem[];
  departmentId?: {
    _id: string;
    name: string;
    code?: string;
    type?: string;
    ten_phong_ban?: string;
    loai_don_vi?: string;
  } | string | null;
  don_vi_chinh_id?: any;
  departmentName?: string;
  ten_phong_ban?: string;
  staffCode?: string;
  ma_can_bo?: string;
  position?: string;
  chuc_vu?: string;
  academicRank?: AcademicRankType;
  hoc_ham?: AcademicRankType;
  degree?: DegreeType;
  hoc_vi?: DegreeType;
  staffType?: StaffType;
  loai_nhan_su?: StaffType;
  contractType?: ContractType;
  loai_hop_dong?: ContractType;
  salaryScale?: string;
  ngach_luong?: string;
  salaryCoefficient?: number;
  he_so_luong?: number;
  dependentsCount?: number;
  so_nguoi_phu_thuoc?: number;
  annualLeaveQuota?: number;
  han_muc_phep_nam?: number;
  gender?: GenderType;
  gioi_tinh?: GenderType;
  dateOfBirth?: string;
  ngay_sinh?: string;
  startDate?: string;
  ngay_vao_lam?: string;
  address?: string;
  dia_chi?: string;
  employmentStatus?: EmploymentStatusType;
  trang_thai_lam_viec?: EmploymentStatusType;
  isActive: boolean;
  kich_hoat?: boolean;
  isFaceRegistered: boolean;
  da_dang_ky_face?: boolean;
  faceRegisteredAt?: string | null;
  ngay_dang_ky_face?: string | null;
  facePhoto?: string | null;
  anh_khuon_mat?: string | null;
  sampleCount?: number;
  so_luong_mau?: number;
  lastLogin?: string;
  lan_dang_nhap_cuoi?: string;
  createdAt?: string;
  tao_luc?: string;
  updatedAt?: string;
  cap_nhat_luc?: string;
}

export interface UserQueryParams {
  role?: string;
  vai_tro?: string;
  departmentId?: string;
  don_vi_id?: string;
  isActive?: boolean | string;
  kich_hoat?: boolean | string;
  dang_hoat_dong?: boolean | string;
  search?: string;
  tim_kiem?: string;
  page?: number;
  trang?: number;
  limit?: number;
  gioi_han?: number;
}

export interface CreateUserPayload {
  fullName: string;
  ho_ten?: string;
  email: string;
  password: string;
  mat_khau?: string;
  staffCode: string;
  ma_can_bo?: string;
  role: string;
  vai_tro_chinh?: string;
  departmentId?: string | null;
  don_vi_chinh_id?: string | null;
  phoneNumber?: string;
  so_dien_thoai?: string;
  position?: string;
  chuc_vu?: string;
  academicRank?: AcademicRankType;
  hoc_ham?: AcademicRankType;
  degree?: DegreeType;
  hoc_vi?: DegreeType;
  staffType?: StaffType;
  loai_nhan_su?: StaffType;
  contractType?: ContractType;
  loai_hop_dong?: ContractType;
  salaryScale?: string;
  ngach_luong?: string;
  salaryCoefficient?: number;
  he_so_luong?: number;
  dependentsCount?: number;
  so_nguoi_phu_thuoc?: number;
  annualLeaveQuota?: number;
  han_muc_phep_nam?: number;
  gender?: GenderType;
  gioi_tinh?: GenderType;
  dateOfBirth?: string;
  ngay_sinh?: string;
  startDate?: string;
  ngay_vao_lam?: string;
  address?: string;
  dia_chi?: string;
  employmentStatus?: EmploymentStatusType;
  trang_thai_lam_viec?: EmploymentStatusType;
  avatar?: string | null;
  anh_dai_dien?: string | null;
  tieu_su?: string;
  bio?: string;
  huong_nghien_cuu?: string[];
  researchInterests?: string[];
  phong_lam_viec?: string;
  officeRoom?: string;
  hoc_phan_giang_day?: string[];
}

export type UpdateUserPayload = Partial<CreateUserPayload> & {
  isActive?: boolean;
  tieu_su?: string;
  huong_nghien_cuu?: string[];
  phong_lam_viec?: string;
  hoc_phan_giang_day?: string[];
};

export type DepartmentType = 'khoa' | 'bo_mon' | 'phong_ban' | (string & {});

export interface DepartmentManagerRef {
  _id: string;
  ho_ten?: string;
  fullName?: string;
  email?: string;
  ma_can_bo?: string;
  staffCode?: string;
  vai_tro_chinh?: string;
  role?: string;
  anh_dai_dien?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface DepartmentParentRef {
  _id: string;
  name: string;
  ten_phong_ban?: string;
  loai_don_vi?: DepartmentType | string;
  type?: DepartmentType | string;
}

export interface DepartmentItem {
  _id: string;
  ten_phong_ban: string;
  name: string;
  code?: string;
  loai_don_vi: DepartmentType | string;
  don_vi_cha_id?: DepartmentParentRef | string | null;
  truong_don_vi_id?: DepartmentManagerRef | string | null;
  toa_do?: {
    vi_do?: number | null;
    kinh_do?: number | null;
  };
  ban_kinh_met?: number;
  so_luong_thanh_vien?: number;
  so_luong_mon_hoc?: number;
  danh_sach_con?: DepartmentItem[];
  tao_luc?: string;
  cap_nhat_luc?: string;

  // Thuộc tính tương thích chuyển tiếp:
  type?: DepartmentType | string;
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
  ten_phong_ban?: string;
  loai_don_vi?: DepartmentType;
  don_vi_cha_id?: string | null;
  truong_don_vi_id?: string | null;
  toa_do?: {
    vi_do?: number | null;
    kinh_do?: number | null;
  };
  ban_kinh_met?: number;

  name?: string;
  type?: DepartmentType;
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

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'nghi_phep' | 'day_bu' | 'doi_ca' | 'nghi_om' | 'viec_rieng';

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
  ngay_day_bu?: string;
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

export interface SubjectItem {
  _id: string;
  name: string;
  ten_mon?: string;
  code: string;
  ma_mon?: string;
  credits?: number;
  so_tin_chi?: number;
  departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
  phong_ban_id?: string | { _id: string; name: string; ten_phong_ban?: string };
  description?: string;
  mo_ta?: string;
  isActive?: boolean;
  kich_hoat?: boolean;
}

export interface ScheduleItem {
  _id: string;
  userId?: {
    _id: string;
    fullName: string;
    ho_ten?: string;
    email: string;
    staffCode?: string;
    ma_can_bo?: string;
    role?: string;
    avatarUrl?: string;
    departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
    don_vi_chinh_id?: string | { _id: string; name: string; ten_phong_ban?: string };
  };
  nguoi_dung_id?: any;
  shiftId?: ShiftItem | string;
  ca_id?: ShiftItem | string;
  subjectId?: SubjectItem | string;
  mon_hoc_id?: SubjectItem | string;
  roomId: string;
  phong_hoc?: string;
  weekday: number; // 0: CN, 1: T2, ..., 6: T7
  thu_trong_tuan?: number;
  startTime: string; // HH:mm
  gio_bat_dau?: string;
  endTime: string; // HH:mm
  gio_ket_thuc?: string;
  startPeriod?: number; // 1-12
  tiet_bat_dau?: number;
  periodCount?: number; // 1-6
  so_tiet?: number;
  isRecurring: boolean;
  lap_lai_hang_tuan?: boolean;
  startDate: string;
  ngay_bat_dau?: string;
  endDate: string;
  ngay_ket_thuc?: string;
  scheduleType?: ScheduleType;
  loai_lich?: ScheduleType;
  makeupDate?: string | null;
  ngay_day_bu?: string | null;
  weekNumbers?: number[];
  danh_sach_tuan?: number[];
  academicYear?: string;
  nam_hoc?: string;
  semester?: number;
  hoc_ky?: number;
  exceptions?: ScheduleExceptionItem[];
  ngoai_le?: ScheduleExceptionItem[];
  latitude?: number | null;
  vi_do?: number | null;
  longitude?: number | null;
  kinh_do?: number | null;
  radiusMeters?: number;
  ban_kinh_met?: number;
  createdAt?: string;
  tao_luc?: string;
  updatedAt?: string;
  cap_nhat_luc?: string;
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
