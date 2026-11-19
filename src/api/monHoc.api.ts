import { apiClient, ApiResponse } from './apiClient';

export interface SubjectItem {
  id: string;
  ma_mon: string;
  ten_mon: string;
  so_tin_chi: number;
  phong_ban_id?: {
    id?: string;
    _id?: string;
    ten_phong_ban?: string;
    name?: string;
    loai_don_vi?: string;
    type?: string;
  } | string | null;
  phong_ban?: {
    id: string;
    ten_phong_ban: string;
    loai_don_vi?: string;
  } | null;
  mo_ta?: string;
  kich_hoat: boolean;
  tao_luc?: string;
  cap_nhat_luc?: string;
}

export interface SubjectQueryParams {
  tim_kiem?: string;
  phong_ban_id?: string;
  kich_hoat?: boolean | string;
  so_tin_chi?: number | string;
  trang?: number;
  gioi_han?: number;
}

export interface SubjectPaginatedResponse {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  subjects: SubjectItem[];
  availableCredits?: number[];
}

export interface CreateSubjectPayload {
  ma_mon: string;
  ten_mon: string;
  so_tin_chi?: number;
  phong_ban_id?: string | null;
  mo_ta?: string;
  kich_hoat?: boolean;
}

export interface UpdateSubjectPayload {
  ma_mon?: string;
  ten_mon?: string;
  so_tin_chi?: number;
  phong_ban_id?: string | null;
  mo_ta?: string;
  kich_hoat?: boolean;
}

export const subjectApi = {
  /**
   * 1. Lấy danh sách môn học (hỗ trợ phân trang, tìm kiếm và lọc theo khoa, số tín chỉ)
   */
  async getSubjects(
    params?: SubjectQueryParams
  ): Promise<{ subjects: SubjectItem[]; total: number; page: number; totalPages: number; availableCredits?: number[] }> {
    const res = await apiClient.get<any>('/mon-hoc', { params });
    const raw = res.data?.data || res.data;

    if (Array.isArray(raw)) {
      const distinctCredits = Array.from(
        new Set(raw.map((s: any) => Number(s.so_tin_chi)).filter((n: number) => !isNaN(n) && n > 0))
      ).sort((a: number, b: number) => a - b);

      return {
        subjects: raw,
        total: raw.length,
        page: 1,
        totalPages: 1,
        availableCredits: distinctCredits,
      };
    }

    const subjects = Array.isArray(raw?.subjects) ? raw.subjects : [];
    const availableCredits = Array.isArray(raw?.availableCredits)
      ? raw.availableCredits
      : Array.from(
          new Set(subjects.map((s: any) => Number(s.so_tin_chi)).filter((n: number) => !isNaN(n) && n > 0))
        ).sort((a: number, b: number) => a - b);

    return {
      subjects,
      total: raw?.total || subjects.length,
      page: raw?.page || 1,
      totalPages: raw?.totalPages || 1,
      availableCredits,
    };
  },

  /**
   * 2. Lấy thông tin chi tiết một môn học theo ID
   */
  async getSubjectById(id: string): Promise<SubjectItem> {
    const res = await apiClient.get<any>(`/mon-hoc/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * 3. Thêm mới môn học (Admin & Trưởng khoa)
   */
  async createSubject(payload: CreateSubjectPayload): Promise<SubjectItem> {
    const res = await apiClient.post<any>('/mon-hoc', payload);
    return res.data?.data || res.data;
  },

  /**
   * 4. Cập nhật môn học (Admin & Trưởng khoa)
   */
  async updateSubject(id: string, payload: UpdateSubjectPayload): Promise<SubjectItem> {
    const res = await apiClient.put<any>(`/mon-hoc/${id}`, payload);
    return res.data?.data || res.data;
  },

  /**
   * 5. Xóa môn học (Chỉ Admin)
   */
  async deleteSubject(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/mon-hoc/${id}`);
    return res.data?.data || res.data;
  },
};
