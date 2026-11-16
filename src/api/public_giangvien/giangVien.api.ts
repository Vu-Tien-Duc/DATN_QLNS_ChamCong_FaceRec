import { apiClient, ApiResponse } from '../apiClient';

export interface PublicFacultyItem {
  _id: string;
  ho_ten: string;
  email: string;
  danh_hieu: string; // GS.TS, PGS.TS, TS, ThS...
  hoc_ham: string;
  hoc_vi: string;
  chuc_vu: string;
  khoa: string;
  khoa_id?: string | null;
  anh_dai_dien?: string | null;
  huong_nghien_cuu: string[];
  phong_lam_viec: string;
  hoc_phan_giang_day: string[];
  tieu_su: string;
}

export interface SubjectTaught {
  _id: string;
  ma_mon: string;
  ten_mon: string;
  so_tin_chi: number;
  mo_ta?: string;
}

export interface PublicFacultyDetail extends PublicFacultyItem {
  cac_mon_chi_tiet?: SubjectTaught[];
  ngay_bat_dau_giang_day?: string | null;
}

export interface DepartmentSummary {
  _id: string;
  ten_khoa: string;
}

export interface FacultyStats {
  tong_so_giang_vien: number;
  so_luong_gs: number;
  so_luong_pgs: number;
  so_luong_ts: number;
  so_luong_gs_pgs_ts: number;
  ty_le_tien_si_tro_len: number;
  danh_sach_khoa: DepartmentSummary[];
}

export interface FacultyQueryParams {
  search?: string;
  phong_ban_id?: string;
  hoc_ham?: string;
  hoc_vi?: string;
  page?: number;
  limit?: number;
}

export interface FacultyListResponse {
  success: boolean;
  data: PublicFacultyItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const publicFacultyApi = {
  // Lấy danh bạ giảng viên (hỗ trợ phân trang, tìm kiếm từ khóa, lọc theo khoa và học vị)
  getList: async (params?: FacultyQueryParams): Promise<FacultyListResponse> => {
    const res = await apiClient.get<FacultyListResponse>('/cong-khai/giang-vien', { params });
    return res.data;
  },

  // Lấy chi tiết hồ sơ khoa học giảng viên theo ID
  getById: async (id: string): Promise<ApiResponse<PublicFacultyDetail>> => {
    const res = await apiClient.get<ApiResponse<PublicFacultyDetail>>(`/cong-khai/giang-vien/${id}`);
    return res.data;
  },

  // Lấy thống kê tổng quan (dành cho Hero section và dropdown khoa viện)
  getStats: async (): Promise<ApiResponse<FacultyStats>> => {
    const res = await apiClient.get<ApiResponse<FacultyStats>>('/cong-khai/giang-vien/thong-ke');
    return res.data;
  },
};
