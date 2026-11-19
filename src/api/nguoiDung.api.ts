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

const USER_QUERY_KEY_MAP: Record<string, string> = {
  role: 'vai_tro',
  departmentId: 'don_vi_id',
  isActive: 'kich_hoat',
  dang_hoat_dong: 'kich_hoat',
  search: 'tim_kiem',
  page: 'trang',
  limit: 'gioi_han',
};

const mapUserQueryParams = (params?: UserQueryParams): Record<string, any> | undefined => {
  if (!params) return undefined;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(params as Record<string, any>)) {
    if (value === undefined) continue;
    const targetKey = USER_QUERY_KEY_MAP[key] || key;
    if (out[targetKey] === undefined) {
      out[targetKey] = value;
    }
  }
  return out;
};

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
  uploadAvatar: async (file: File): Promise<ApiResponse<{ fileUrl: string; fullUrl: string; url: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.post<ApiResponse<{ fileUrl: string; fullUrl: string; url: string }>>(
      '/tai-tep',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },
};
