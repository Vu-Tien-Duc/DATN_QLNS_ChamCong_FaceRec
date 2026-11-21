export type DepartmentType = 'khoa' | 'bo_mon' | 'phong_ban' | (string & {});

export interface DepartmentManagerRef {
  id: string;
  ho_ten: string;
  email?: string;
  ma_can_bo?: string;
  vai_tro_chinh?: string;
  anh_dai_dien?: string | null;
  kich_hoat?: boolean;
}

export interface DepartmentParentRef {
  id: string;
  ten_phong_ban: string;
  loai_don_vi?: DepartmentType | string;
}

export interface DepartmentItem {
  id: string;
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
}

export interface CreateDepartmentPayload {
  ten_phong_ban: string;
  loai_don_vi: DepartmentType;
  don_vi_cha_id?: string | null;
  truong_don_vi_id?: string | null;
  toa_do?: {
    vi_do?: number | null;
    kinh_do?: number | null;
  };
  ban_kinh_met?: number;
}

export type UpdateDepartmentPayload = Partial<CreateDepartmentPayload>;
