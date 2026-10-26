import { apiClient, ApiResponse } from './apiClient';
import {
  UserProfile,
  UserQueryParams,
  CreateUserPayload,
  UpdateUserPayload,
  DepartmentItem,
} from '../types';

export interface UserListResponse {
  users: UserProfile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const userApi = {
  /**
   * 1. Lấy danh sách cán bộ, giảng viên (Phân trang, tìm kiếm, lọc theo khoa/vai trò/trạng thái)
   */
  getUsers: async (params?: UserQueryParams): Promise<ApiResponse<UserListResponse | UserProfile[]>> => {
    const res = await apiClient.get<ApiResponse<UserListResponse | UserProfile[]>>('/users', {
      params,
    });
    return res.data;
  },

  /**
   * 2. Lấy chi tiết thông tin một cán bộ theo ID
   */
  getUserById: async (id: string): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.get<ApiResponse<UserProfile>>(`/users/${id}`);
    return res.data;
  },

  /**
   * 3. Thêm mới tài khoản cán bộ / giảng viên (Admin / BGH / TCCB)
   */
  createUser: async (payload: CreateUserPayload): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.post<ApiResponse<UserProfile>>('/users', payload);
    return res.data;
  },

  /**
   * 4. Cập nhật thông tin hồ sơ nhân sự (Admin / BGH / TCCB / Trưởng khoa)
   */
  updateUser: async (id: string, payload: UpdateUserPayload): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.put<ApiResponse<UserProfile>>(`/users/${id}`, payload);
    return res.data;
  },

  /**
   * 5. Vô hiệu hóa tài khoản cán bộ (Soft Delete: isActive = false + thu hồi phiên token)
   */
  deleteUser: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/users/${id}`);
    return res.data;
  },

  /**
   * 6. Xóa dữ liệu sinh trắc học Face ID 512D của cán bộ
   */
  deleteFaceDescriptor: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/users/${id}/face-descriptor`);
    return res.data;
  },

  /**
   * 7. Lấy danh sách Khoa / Bộ môn / Phòng ban trực thuộc nhà trường (danh sách phẳng)
   */
  getDepartments: async (): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/departments', {
      params: { tree: 'false' },
    });
    return res.data;
  },

  /**
   * 8. Tải lên ảnh đại diện (Avatar) lên MinIO Object Storage
   */
  uploadAvatar: async (file: File): Promise<ApiResponse<{ fileUrl: string; fullUrl: string; url: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post<ApiResponse<{ fileUrl: string; fullUrl: string; url: string }>>(
      '/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },
};
