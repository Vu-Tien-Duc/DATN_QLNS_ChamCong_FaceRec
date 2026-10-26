import { apiClient, ApiResponse } from './apiClient';
import { UserProfile } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

export const authApi = {
  /**
   * Đăng nhập hệ thống (POST /api/auth/login)
   */
  login: async (payload: LoginPayload): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', payload);
    return response.data;
  },

  /**
   * Lấy thông tin cá nhân của phiên đăng nhập hiện tại (GET /api/auth/me)
   */
  getMe: async (): Promise<ApiResponse<UserProfile | { user: UserProfile }>> => {
    const response = await apiClient.get<ApiResponse<UserProfile | { user: UserProfile }>>('/auth/me');
    return response.data;
  },

  /**
   * Làm mới token (POST /api/auth/refresh-token)
   */
  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken: string }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; refreshToken: string }>>(
      '/auth/refresh-token',
      { refreshToken }
    );
    return response.data;
  },

  /**
   * Đăng xuất hệ thống (POST /api/auth/logout)
   */
  logout: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  /**
   * Đổi mật khẩu tài khoản (PUT /api/auth/change-password)
   */
  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/auth/change-password', payload);
    return response.data;
  },

  /**
   * Cập nhật ảnh đại diện cá nhân (PUT /api/auth/avatar)
   * Hỗ trợ gửi FormData (file ảnh) hoặc JSON { avatar: string } / { avatarBase64: string }
   */
  updateAvatar: async (
    data: FormData | { avatar?: string | null; avatarBase64?: string }
  ): Promise<ApiResponse<{ avatar: string }>> => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<ApiResponse<{ avatar: string }>>('/auth/avatar', data, { headers });
    return response.data;
  },
};
