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
   * 1. Lấy danh sách phẳng toàn bộ Khoa / Bộ môn / Phòng ban (tree=false)
   */
  getDepartmentsFlat: async (params?: {
    type?: string;
    parentId?: string;
  }): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/departments', {
      params: { ...params, tree: 'false' },
    });
    return res.data;
  },

  /**
   * 2. Lấy sơ đồ cây phân cấp Khoa -> Bộ môn và Phòng ban (tree=true)
   */
  getDepartmentsTree: async (): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/departments', {
      params: { tree: 'true' },
    });
    return res.data;
  },

  /**
   * 3. Lấy chi tiết một Khoa / Bộ môn / Phòng ban theo ID
   */
  getDepartmentById: async (id: string): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem>>(`/departments/${id}`);
    return res.data;
  },

  /**
   * 4. Thêm mới Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   */
  createDepartment: async (
    payload: CreateDepartmentPayload
  ): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.post<ApiResponse<DepartmentItem>>('/departments', payload);
    return res.data;
  },

  /**
   * 5. Cập nhật thông tin Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   */
  updateDepartment: async (
    id: string,
    payload: UpdateDepartmentPayload
  ): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.put<ApiResponse<DepartmentItem>>(`/departments/${id}`, payload);
    return res.data;
  },

  /**
   * 6. Xóa Khoa / Bộ môn / Phòng ban (Chỉ Admin - chặn xóa nếu còn nhân sự hoặc bộ môn con)
   */
  deleteDepartment: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/departments/${id}`);
    return res.data;
  },
};
