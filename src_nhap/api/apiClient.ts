/**
 * apiClient.ts - Axios instance bảo mật
 *
 * Token Strategy:
 * • Access Token  → Lấy từ Zustand store (RAM) - không từ localStorage
 * • Refresh Token → Gửi tự động qua httpOnly cookie (withCredentials: true)
 * • Khi 401 + FORCE_LOGGED_OUT → clear store + redirect login
 * • Khi 401 bình thường → thử refresh token qua cookie → lấy access token mới
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// ─── Callbacks từ AuthContext ──────────────────────────────────────
let _onForceLogout: (() => void) | null = null;
let _onRefreshFailed: (() => void) | null = null;

export function configureApiClient(
  onForceLogout: () => void,
  onRefreshFailed: () => void
) {
  _onForceLogout = onForceLogout;
  _onRefreshFailed = onRefreshFailed;
}

// ─── Axios Instance ───────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,  // Tự động gửi httpOnly cookie (refresh token)
});

// ─── Request Interceptor ──────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Lấy access token từ Zustand RAM - KHÔNG từ localStorage
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const data = error.response?.data;

    // ── 1. Force Logout (Admin thu hồi session) ──
    if (status === 401 && data?.code === 'FORCE_LOGGED_OUT') {
      _onForceLogout?.();
      return Promise.reject(error);
    }

    // ── 2. Auto Refresh Token ──
    if (status === 401 && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true, timeout: 10000 }
        );

        const newAccessToken = refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;
        if (!newAccessToken) throw new Error('Không nhận được access token mới');

        // Cập nhật vào Zustand RAM
        useAuthStore.getState().setAccessToken(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return apiClient(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        _onRefreshFailed?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);