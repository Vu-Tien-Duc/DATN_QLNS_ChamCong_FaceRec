import { apiClient, ApiResponse } from './apiClient';

export interface SubjectItem {
  _id: string;
  code: string;
  name: string;
  credits: number;
  departmentId?: {
    _id: string;
    name: string;
    type?: string;
    parentId?: any;
  } | string | null;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubjectQueryParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean | string;
  credits?: number | string;
  page?: number;
  limit?: number;
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
  code: string;
  name: string;
  credits?: number;
  departmentId?: string | null;
  description?: string;
  isActive?: boolean;
}

export interface UpdateSubjectPayload {
  code?: string;
  name?: string;
  credits?: number;
  departmentId?: string | null;
  description?: string;
  isActive?: boolean;
}

export const subjectApi = {
  /**
   * 1. Lấy danh sách môn học (hỗ trợ phân trang, tìm kiếm và lọc theo khoa, số tín chỉ)
   */
  async getSubjects(
    params?: SubjectQueryParams
  ): Promise<{ subjects: SubjectItem[]; total: number; page: number; totalPages: number; availableCredits?: number[] }> {
    const res = await apiClient.get<any>('/subjects', { params });
    const raw = res.data?.data || res.data;

    if (Array.isArray(raw)) {
      const distinctCredits = Array.from(
        new Set(raw.map((s: any) => Number(s.credits)).filter((n: number) => !isNaN(n) && n > 0))
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
          new Set(subjects.map((s: any) => Number(s.credits)).filter((n: number) => !isNaN(n) && n > 0))
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
    const res = await apiClient.get<any>(`/subjects/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * 3. Thêm mới môn học (Admin & Trưởng khoa)
   */
  async createSubject(payload: CreateSubjectPayload): Promise<SubjectItem> {
    const res = await apiClient.post<any>('/subjects', payload);
    return res.data?.data || res.data;
  },

  /**
   * 4. Cập nhật môn học (Admin & Trưởng khoa)
   */
  async updateSubject(id: string, payload: UpdateSubjectPayload): Promise<SubjectItem> {
    const res = await apiClient.put<any>(`/subjects/${id}`, payload);
    return res.data?.data || res.data;
  },

  /**
   * 5. Xóa môn học (Chỉ Admin)
   */
  async deleteSubject(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/subjects/${id}`);
    return res.data?.data || res.data;
  },
};
