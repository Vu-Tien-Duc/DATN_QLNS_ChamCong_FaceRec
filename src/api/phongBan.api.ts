import { apiClient, ApiResponse } from './apiClient';
import {
  DepartmentItem,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from '../types';

export interface DepartmentPaginatedResponse {
  departments: DepartmentItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const departmentApi = {
  /**
   * 1. Lấy danh sách phẳng toàn bộ Khoa / Bộ môn / Phòng ban (cay=false)
   */
  getDepartmentsFlat: async (params?: {
    loai_don_vi?: string;
    don_vi_cha_id?: string;
  }): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/phong-ban', {
      params: {
        loai_don_vi: params?.loai_don_vi,
        don_vi_cha_id: params?.don_vi_cha_id,
        cay: 'false',
      },
    });
    return res.data;
  },

  /**
   * 2. Lấy sơ đồ cây phân cấp Khoa -> Bộ môn và Phòng ban
   */
  getDepartmentsTree: async (): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/phong-ban/cay', {
      params: { cay: 'true' },
    });
    return res.data;
  },

  /**
   * 3. Lấy chi tiết một Khoa / Bộ môn / Phòng ban theo ID
   */
  getDepartmentById: async (id: string): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem>>(`/phong-ban/${id}`);
    return res.data;
  },

  /**
   * 4. Thêm mới Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   */
  createDepartment: async (
    payload: CreateDepartmentPayload
  ): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.post<ApiResponse<DepartmentItem>>('/phong-ban', payload);
    return res.data;
  },

  /**
   * 5. Cập nhật thông tin Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   */
  updateDepartment: async (
    id: string,
    payload: UpdateDepartmentPayload
  ): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.put<ApiResponse<DepartmentItem>>(`/phong-ban/${id}`, payload);
    return res.data;
  },

  /**
   * 6. Xóa Khoa / Bộ môn / Phòng ban (Chỉ Admin - chặn xóa nếu còn nhân sự hoặc bộ môn con)
   */
  deleteDepartment: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/phong-ban/${id}`);
    return res.data;
  },
};
