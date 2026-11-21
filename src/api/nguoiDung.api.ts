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
    const res = await apiClient.get<ApiResponse<UserListResponse | UserProfile[]>>('/nguoi-dung', {
      params,
    });
    return res.data;
  },

  /**
   * 2. Lấy chi tiết thông tin một cán bộ theo ID
   */
  getUserById: async (id: string): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.get<ApiResponse<UserProfile>>(`/nguoi-dung/${id}`);
    return res.data;
  },

  /**
   * 3. Thêm mới tài khoản cán bộ / giảng viên (Admin / BGH / TCCB)
   */
  createUser: async (payload: CreateUserPayload): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.post<ApiResponse<UserProfile>>('/nguoi-dung', payload);
    return res.data;
  },

  /**
   * 4. Cập nhật thông tin hồ sơ nhân sự (Admin / BGH / TCCB / Trưởng khoa)
   */
  updateUser: async (id: string, payload: UpdateUserPayload): Promise<ApiResponse<UserProfile>> => {
    const res = await apiClient.put<ApiResponse<UserProfile>>(`/nguoi-dung/${id}`, payload);
    return res.data;
  },

  /**
   * 5. Vô hiệu hóa tài khoản cán bộ (Soft Delete: isActive = false + thu hồi phiên token)
   */
  deleteUser: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/nguoi-dung/${id}`);
    return res.data;
  },

  /**
   * 6. Xóa dữ liệu sinh trắc học Face ID 512D của cán bộ
   */
  deleteFaceDescriptor: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/nguoi-dung/${id}/khuon-mat`);
    return res.data;
  },

  /**
   * 7. Lấy danh sách Khoa / Bộ môn / Phòng ban trực thuộc nhà trường (danh sách phẳng)
   */
  getDepartments: async (): Promise<ApiResponse<DepartmentItem[]>> => {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/phong-ban', {
      params: { cay: 'false' },
    });
    return res.data;
  },

  /**
   * 8. Tải lên ảnh đại diện (Avatar) lên MinIO Object Storage
   */
  uploadAvatar: async (file: File): Promise<ApiResponse<{ ten_tep: string; duong_dan_tep: string; duong_dan_day_du: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post<ApiResponse<{ ten_tep: string; duong_dan_tep: string; duong_dan_day_du: string }>>(
      '/tai-tep',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },
};
