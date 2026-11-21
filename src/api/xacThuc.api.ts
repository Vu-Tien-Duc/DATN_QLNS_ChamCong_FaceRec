import { apiClient, ApiResponse } from './apiClient';
import { UserProfile } from '../types';

export interface LoginPayload {
  email: string;
  mat_khau: string;
}

export interface LoginResponseData {
  token: string;
  ma_lam_moi: string;
  nguoi_dung: UserProfile;
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
  getMe: async (): Promise<ApiResponse<UserProfile>> => {
    const response = await apiClient.get<ApiResponse<UserProfile>>('/xac-thuc/ho-so');
    return response.data;
  },

  /**
   * Làm mới token (POST /api/xac-thuc/lam-moi-token)
   */
  refreshToken: async (maLamMoi: string): Promise<ApiResponse<{ token: string; ma_lam_moi: string }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; ma_lam_moi: string }>>(
      '/xac-thuc/lam-moi-token',
      { ma_lam_moi: maLamMoi }
    );
    return response.data;
  },

  /**
   * Đăng xuất hệ thống (POST /api/xac-thuc/dang-xuat)
   */
  logout: async (maLamMoi?: string | null, accessToken?: string | null): Promise<ApiResponse<null>> => {
    const tokenToRevoke =
      maLamMoi !== undefined
        ? maLamMoi
        : typeof window !== 'undefined'
        ? sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken')
        : null;
    const response = await apiClient.post<ApiResponse<null>>(
      '/xac-thuc/dang-xuat',
      tokenToRevoke ? { ma_lam_moi: tokenToRevoke } : {},
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
    );
    return response.data;
  },

  /**
   * Đổi mật khẩu tài khoản (PUT /api/xac-thuc/doi-mat-khau)
   */
  changePassword: async (payload: { mat_khau_hien_tai: string; mat_khau_moi: string }): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/xac-thuc/doi-mat-khau', payload);
    return response.data;
  },

  /**
   * Cập nhật ảnh đại diện cá nhân (PUT /api/xac-thuc/anh-dai-dien)
   */
  updateAvatar: async (
    data: FormData | { anh_dai_dien?: string | null; anh_dai_dien_base64?: string }
  ): Promise<ApiResponse<{ anh_dai_dien: string | null }>> => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<ApiResponse<{ anh_dai_dien: string | null }>>(
      '/xac-thuc/anh-dai-dien',
      data,
      { headers }
    );
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
