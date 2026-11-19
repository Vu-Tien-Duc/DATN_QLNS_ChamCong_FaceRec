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

export type RoleScopeType = 'toan_truong' | 'khoa' | 'bo_mon' | 'phong_ban';

export interface UserRoleItem {
  id?: string;
  ma_vai_tro?: RoleType | string;
  pham_vi?: RoleScopeType;
  don_vi_id?: string | null;
  tu_ngay?: string;
  den_ngay?: string | null;
  duoc_uy_quyen?: boolean;
  /** @deprecated Dùng ma_vai_tro */
  role?: RoleType | string;
  /** @deprecated Dùng pham_vi */
  scope?: RoleScopeType;
  /** @deprecated Dùng don_vi_id */
  departmentId?: string | null;
  /** @deprecated Dùng tu_ngay */
  startDate?: string;
  /** @deprecated Dùng den_ngay */
  endDate?: string | null;
}

export interface UserRoleAssignmentPayload {
  ma_vai_tro: string;
  pham_vi: RoleScopeType;
  don_vi_id: string | null;
  duoc_uy_quyen: boolean;
  tu_ngay: string;
  den_ngay: string | null;
}

export type AcademicRankType = 'giao_su' | 'pho_giao_su' | 'khong';
export type DegreeType = 'tien_si' | 'thac_si' | 'cu_nhan' | 'ky_su' | 'khac';
export type StaffType = 'giang_vien' | 'can_bo_quan_ly' | 'chuyen_vien' | 'nhan_vien';
export type ContractType =
  | 'toan_thoi_gian'
  | 'ban_thoi_gian'
  | 'thinh_giang'
  | 'hop_dong_vu_viec';
export type EmploymentStatusType = 'dang_lam_viec' | 'tam_nghi' | 'da_nghi_viec';
export type GenderType = 'nam' | 'nu' | 'khac';

export interface UserProfile {
  id?: string;
  ho_ten?: string;
  email: string;
  so_dien_thoai?: string;
  anh_dai_dien?: string | null;
  vai_tro_chinh?: string;
  danh_sach_vai_tro?: UserRoleItem[];
  don_vi_chinh_id?: any;
  ten_phong_ban?: string;
  ma_can_bo?: string;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ho_ten */
  fullName: string;
  /** @deprecated Dùng so_dien_thoai */
  phoneNumber?: string;
  /** @deprecated Dùng anh_dai_dien */
  avatar?: string;
  /** @deprecated Dùng vai_tro_chinh */
  role: UserRoleLegacy | string;
  /** @deprecated Dùng vai_tro_chinh */
  primaryRole?: string;
  /** @deprecated Dùng danh_sach_vai_tro */
  roles?: UserRoleItem[];
  /** @deprecated Dùng don_vi_chinh_id */
  departmentId?: {
    _id: string;
    name: string;
    code?: string;
    type?: string;
    ten_phong_ban?: string;
    loai_don_vi?: string;
  } | string | null;
  /** @deprecated Dùng ten_phong_ban */
  departmentName?: string;
  /** @deprecated Dùng ma_can_bo */
  staffCode?: string;
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
  mo_hinh_ai?: string | null;
  ngay_het_han_hop_dong?: string | null;
  ngay_bat_dau_giang_day?: string | null;
  tham_nien_nam?: number;
  so_cccd?: string | null;
  ma_so_thue?: string | null;
  so_tai_khoan_ngan_hang?: string | null;
  ten_ngan_hang?: string | null;
  chi_nhanh_ngan_hang?: string | null;
  lastLogin?: string;
  lastLoginAt?: string | null;
  lan_dang_nhap_cuoi?: string | null;
  passwordChangedAt?: string | null;
  doi_mat_khau_luc?: string | null;
  vectorDimension?: number | null;
  isDefaultFace?: boolean;
  faceStatus?: string | null;
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
  fullName?: string;
  ho_ten?: string;
  email: string;
  password?: string;
  mat_khau?: string;
  staffCode?: string;
  ma_can_bo?: string;
  role?: string;
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
  ngay_het_han_hop_dong?: string | null;
  ngay_bat_dau_giang_day?: string | null;
  so_cccd?: string | null;
  ma_so_thue?: string | null;
  so_tai_khoan_ngan_hang?: string | null;
  ten_ngan_hang?: string | null;
  chi_nhanh_ngan_hang?: string | null;
  tieu_su?: string;
  bio?: string;
  huong_nghien_cuu?: string[];
  researchInterests?: string[];
  phong_lam_viec?: string;
  officeRoom?: string;
  hoc_phan_giang_day?: string[];
  danh_sach_vai_tro?: UserRoleAssignmentPayload[];
}

export type UpdateUserPayload = Partial<CreateUserPayload> & {
  isActive?: boolean;
  kich_hoat?: boolean;
  tieu_su?: string;
  huong_nghien_cuu?: string[];
  phong_lam_viec?: string;
  hoc_phan_giang_day?: string[];
};
