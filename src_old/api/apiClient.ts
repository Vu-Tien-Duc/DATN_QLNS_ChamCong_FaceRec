/**
 * apiClient.ts - Axios instance với auto refresh token
 *
 * Token Strategy:
 * • Access Token  → Zustand RAM (không dùng localStorage)
 * • Refresh Token → httpOnly cookie (withCredentials: true)
 * • 401 + FORCE_LOGGED_OUT → clear + redirect /login
 * • 401 bình thường → gọi /auth/refresh → lấy token mới
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// ─── Callbacks từ AuthContext ──────────────────────────────────────────────
let _onForceLogout: (() => void) | null = null;
let _onRefreshFailed: (() => void) | null = null;

export function configureApiClient(
  onForceLogout: () => void,
  onRefreshFailed: () => void,
) {
  _onForceLogout = onForceLogout;
  _onRefreshFailed = onRefreshFailed;
}

// ─── Axios Instance ────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 20000,
  withCredentials: true,
});

// ─── Request Interceptor ───────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;
    const data = error.response?.data;

    // ── Force Logout ──
    if (status === 401 && data?.code === 'FORCE_LOGGED_OUT') {
      _onForceLogout?.();
      return Promise.reject(error);
    }

    // ── Auto Refresh ──
    if (status === 401 && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true, timeout: 10000 },
        );
        const newToken =
          refreshRes.data?.data?.token ||
          refreshRes.data?.data?.accessToken ||
          refreshRes.data?.token ||
          refreshRes.data?.accessToken;
        if (!newToken) throw new Error('Không nhận được access token mới');

        useAuthStore.getState().setAccessToken(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
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
  },
);

/**
 * Helper an toàn để bóc tách mảng từ các định dạng response khác nhau của backend:
 * - res.data (mảng thuần)
 * - res.data.data (mảng thuần)
 * - res.data.data.records (phân trang: { total, records: [...] })
 * - res.data.data.logs, users, departments, v.v...
 */
export function extractArray<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.records)) return p.records as T[];
  if (Array.isArray(p.data)) return p.data as T[];
  if (Array.isArray(p.logs)) return p.logs as T[];
  if (Array.isArray(p.users)) return p.users as T[];
  if (Array.isArray(p.departments)) return p.departments as T[];
  if (Array.isArray(p.items)) return p.items as T[];
  if (p.data && typeof p.data === 'object') {
    const sub = p.data as Record<string, unknown>;
    if (Array.isArray(sub.records)) return sub.records as T[];
    if (Array.isArray(sub.data)) return sub.data as T[];
    if (Array.isArray(sub.logs)) return sub.logs as T[];
    if (Array.isArray(sub.users)) return sub.users as T[];
    if (Array.isArray(sub.departments)) return sub.departments as T[];
    if (Array.isArray(sub.items)) return sub.items as T[];
  }
  return [];
}
