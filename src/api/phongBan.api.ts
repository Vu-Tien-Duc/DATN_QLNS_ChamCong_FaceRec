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

const mapDepartmentPayload = (payload: CreateDepartmentPayload | UpdateDepartmentPayload) => {
  const { name, type, ...rest } = payload as any;
  const out: Record<string, any> = { ...rest };
  if (name !== undefined) out.ten_phong_ban = name;
  if (type !== undefined) out.loai_don_vi = type;
  return out;
};

export const departmentApi = {
  /**
   * 1. Lấy danh sách phẳng toàn bộ Khoa / Bộ môn / Phòng ban (cay=false)
   */
  getDepartmentsFlat: async (params?: {
    type?: string;
    parentId?: string;
  }): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/phong-ban', {
      params: {
        loai_don_vi: params?.type,
        don_vi_cha_id: params?.parentId,
        cay: 'false',
      },
    });
    return res.data;
  },

  /**
   * 2. Lấy sơ đồ cây phân cấp Khoa -> Bộ môn và Phòng ban
   */
  getDepartmentsTree: async (): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/phong-ban/cay');
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
    const res = await apiClient.post<ApiResponse<DepartmentItem>>('/phong-ban', mapDepartmentPayload(payload));
    return res.data;
  },

  /**
   * 5. Cập nhật thông tin Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   */
  updateDepartment: async (
    id: string,
    payload: UpdateDepartmentPayload
  ): Promise<ApiResponse<DepartmentItem>> => {
    const res = await apiClient.put<ApiResponse<DepartmentItem>>(`/phong-ban/${id}`, mapDepartmentPayload(payload));
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
