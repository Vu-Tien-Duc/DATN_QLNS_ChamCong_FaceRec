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
   * Đăng nhập hệ thống (POST /api/xac-thuc/dang-nhap)
   */
  login: async (payload: LoginPayload): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/xac-thuc/dang-nhap', payload);
    return response.data;
  },

  /**
   * Lấy thông tin cá nhân của phiên đăng nhập hiện tại (GET /api/xac-thuc/ho-so)
   */
  getMe: async (): Promise<ApiResponse<UserProfile | { user: UserProfile }>> => {
    const response = await apiClient.get<ApiResponse<UserProfile | { user: UserProfile }>>('/xac-thuc/ho-so');
    return response.data;
  },

  /**
   * Làm mới token (POST /api/xac-thuc/lam-moi-token)
   */
  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken: string }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; refreshToken: string }>>(
      '/xac-thuc/lam-moi-token',
      { ma_lam_moi: refreshToken }
    );
    return response.data;
  },

  /**
   * Đăng xuất hệ thống (POST /api/xac-thuc/dang-xuat)
   */
  logout: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/xac-thuc/dang-xuat');
    return response.data;
  },

  /**
   * Đổi mật khẩu tài khoản (PUT /api/xac-thuc/doi-mat-khau)
   */
  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/xac-thuc/doi-mat-khau', payload);
    return response.data;
  },

  /**
   * Cập nhật ảnh đại diện cá nhân (PUT /api/xac-thuc/anh-dai-dien)
   */
  updateAvatar: async (
    data: FormData | { avatar?: string | null; avatarBase64?: string }
  ): Promise<ApiResponse<{ avatar: string }>> => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<ApiResponse<{ avatar: string; anh_dai_dien?: string }>>(
      '/xac-thuc/anh-dai-dien',
      data,
      { headers }
    );
    if (response.data?.data && response.data.data.avatar === undefined) {
      response.data.data.avatar = response.data.data.anh_dai_dien || '';
    }
    return response.data;
  },

  /**
   * Yêu cầu gửi mã OTP quên mật khẩu (POST /api/xac-thuc/quen-mat-khau)
   */
  forgotPassword: async (email: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/xac-thuc/quen-mat-khau', { email });
    return response.data;
  },

  /**
   * Đặt lại mật khẩu bằng mã OTP (POST /api/xac-thuc/dat-lai-mat-khau)
   */
  resetPassword: async (payload: {
    email: string;
    ma_otp: string;
    mat_khau_moi: string;
  }): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/xac-thuc/dat-lai-mat-khau', payload);
    return response.data;
  },
};
