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
