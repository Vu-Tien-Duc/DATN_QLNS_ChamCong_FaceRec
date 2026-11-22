export type RoleType =
  | 'admin'
  | 'bgh'
  | 'tccb'
  | 'dao_tao'
  | 'ke_toan'
  | 'truong_khoa'
  | 'pho_khoa'
  | 'truong_bo_mon'
  | 'pho_bo_mon'
  | 'truong_phong'
  | 'pho_phong'
  | 'giang_vien'
  | 'nhan_vien';

export type UserRoleLegacy = RoleType;

export type RoleScopeType = 'toan_truong' | 'khoa' | 'bo_mon' | 'phong_ban';

export interface UserRoleItem {
  id?: string;
  ma_vai_tro: RoleType | string;
  pham_vi?: RoleScopeType;
  don_vi_id?: string | { id: string; ten_phong_ban?: string; loai_don_vi?: string } | null;
  don_vi?: { id: string; ten_phong_ban?: string; loai_don_vi?: string } | null;
  tu_ngay?: string;
  den_ngay?: string | null;
  duoc_uy_quyen?: boolean;
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

export interface UserDepartmentRef {
  id: string;
  ten_phong_ban: string;
  ma_phong_ban?: string;
  loai_don_vi?: string;
  don_vi_cha_id?: string | null;
  vi_do?: number | null;
  kinh_do?: number | null;
  ban_kinh_met?: number;
}

export interface UserProfile {
  id: string;
  ho_ten: string;
  email: string;
  so_dien_thoai?: string;
  anh_dai_dien?: string | null;
  vai_tro_chinh: string;
  danh_sach_vai_tro?: UserRoleItem[];
  don_vi_chinh_id?: UserDepartmentRef | string | null;
  don_vi_chinh?: UserDepartmentRef | null;
  ten_phong_ban?: string;
  ma_can_bo?: string;
  chuc_vu?: string;
  hoc_ham?: AcademicRankType;
  hoc_vi?: DegreeType;
  loai_nhan_su?: StaffType;
  loai_hop_dong?: ContractType;
  ngach_luong?: string;
  he_so_luong?: number;
  so_nguoi_phu_thuoc?: number;
  han_muc_phep_nam?: number;
  gioi_tinh?: GenderType;
  ngay_sinh?: string;
  ngay_vao_lam?: string;
  dia_chi?: string;
  trang_thai_lam_viec?: EmploymentStatusType;
  kich_hoat: boolean;
  da_dang_ky_face: boolean;
  ngay_dang_ky_face?: string | null;
  anh_khuon_mat?: string | null;
  so_luong_mau?: number;
  mo_hinh_ai?: string | null;
  so_chieu_vector?: number | null;
  mac_dinh?: boolean;
  trang_thai_khuon_mat?: string | null;
  ngay_het_han_hop_dong?: string | null;
  ngay_bat_dau_giang_day?: string | null;
  tham_nien_nam?: number;
  so_cccd?: string | null;
  ma_so_thue?: string | null;
  so_tai_khoan_ngan_hang?: string | null;
  ten_ngan_hang?: string | null;
  chi_nhanh_ngan_hang?: string | null;
  tieu_su?: string | null;
  huong_nghien_cuu?: string[];
  phong_lam_viec?: string | null;
  hoc_phan_giang_day?: string[];
  lan_dang_nhap_cuoi?: string | null;
  doi_mat_khau_luc?: string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
}

export interface UserQueryParams {
  vai_tro?: string;
  don_vi_id?: string;
  kich_hoat?: boolean | string;
  tim_kiem?: string;
  trang?: number;
  gioi_han?: number;
}

export interface CreateUserPayload {
  ho_ten: string;
  email: string;
  mat_khau?: string;
  ma_can_bo?: string;
  vai_tro_chinh?: string;
  don_vi_chinh_id?: string | null;
  so_dien_thoai?: string;
  chuc_vu?: string;
  hoc_ham?: AcademicRankType;
  hoc_vi?: DegreeType;
  loai_nhan_su?: StaffType;
  loai_hop_dong?: ContractType;
  ngach_luong?: string;
  he_so_luong?: number;
  so_nguoi_phu_thuoc?: number;
  han_muc_phep_nam?: number;
  gioi_tinh?: GenderType;
  ngay_sinh?: string;
  ngay_vao_lam?: string;
  dia_chi?: string;
  trang_thai_lam_viec?: EmploymentStatusType;
  anh_dai_dien?: string | null;
  ngay_het_han_hop_dong?: string | null;
  ngay_bat_dau_giang_day?: string | null;
  so_cccd?: string | null;
  ma_so_thue?: string | null;
  so_tai_khoan_ngan_hang?: string | null;
  ten_ngan_hang?: string | null;
  chi_nhanh_ngan_hang?: string | null;
  tieu_su?: string;
  huong_nghien_cuu?: string[];
  phong_lam_viec?: string;
  hoc_phan_giang_day?: string[];
  danh_sach_vai_tro?: UserRoleAssignmentPayload[];
}

export type UpdateUserPayload = Partial<CreateUserPayload> & {
  kich_hoat?: boolean;
};

export interface ImportUsersExcelRowError {
  rowNumber: number;
  ma_can_bo?: string;
  email?: string;
  message: string;
}

export interface ImportUsersExcelResult {
  totalCreated: number;
  users: UserProfile[];
}
