export type DepartmentType = 'khoa' | 'bo_mon' | 'phong_ban' | (string & {});

export interface DepartmentManagerRef {
  id?: string;
  ho_ten?: string;
  email?: string;
  ma_can_bo?: string;
  vai_tro_chinh?: string;
  anh_dai_dien?: string | null;
  kich_hoat?: boolean;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ho_ten */
  fullName?: string;
  /** @deprecated Dùng ma_can_bo */
  staffCode?: string;
  /** @deprecated Dùng vai_tro_chinh */
  role?: string;
  /** @deprecated Dùng anh_dai_dien */
  avatarUrl?: string | null;
  /** @deprecated Dùng kich_hoat */
  isActive?: boolean;
}

export interface DepartmentParentRef {
  id?: string;
  ten_phong_ban?: string;
  loai_don_vi?: DepartmentType | string;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ten_phong_ban */
  name?: string;
  /** @deprecated Dùng loai_don_vi */
  type?: DepartmentType | string;
}

export interface DepartmentItem {
  id?: string;
  ten_phong_ban: string;
  ma_phong_ban?: string;
  loai_don_vi: DepartmentType | string;
  don_vi_cha_id?: DepartmentParentRef | string | null;
  don_vi_cha?: DepartmentParentRef | null;
  truong_don_vi_id?: DepartmentManagerRef | string | null;
  truong_don_vi?: DepartmentManagerRef | null;
  vi_do?: number | null;
  kinh_do?: number | null;
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
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ten_phong_ban */
  name?: string;
  /** @deprecated Dùng ma_phong_ban */
  code?: string;
  /** @deprecated Dùng loai_don_vi */
  type?: DepartmentType | string;
  /** @deprecated Dùng don_vi_cha_id */
  parentId?: DepartmentParentRef | string | null;
  /** @deprecated Dùng truong_don_vi_id */
  managerId?: DepartmentManagerRef | string | null;
  /** @deprecated Dùng toa_do.vi_do */
  latitude?: number | null;
  /** @deprecated Dùng toa_do.kinh_do */
  longitude?: number | null;
  /** @deprecated Dùng ban_kinh_met */
  radiusMeters?: number;
  location?: {
    lat: number | null;
    lng: number | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  /** @deprecated Dùng so_luong_thanh_vien */
  memberCount?: number;
  /** @deprecated Dùng so_luong_mon_hoc */
  subjectCount?: number;
  /** @deprecated Dùng danh_sach_con */
  children?: DepartmentItem[];
  /** @deprecated Dùng tao_luc */
  createdAt?: string;
  /** @deprecated Dùng cap_nhat_luc */
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
