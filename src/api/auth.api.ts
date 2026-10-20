import { apiClient, ApiResponse } from './apiClient';
import { UserProfile } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  accessToken?: string;
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
  getMe: async (): Promise<ApiResponse<{ user: UserProfile }>> => {
    const response = await apiClient.get<ApiResponse<{ user: UserProfile }>>('/auth/me');
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
};
