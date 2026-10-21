/**
 * AuthContext.tsx - React Context + Zustand Bootstrap
 *
 * Luồng Bootstrap khi app load:
 * 1. configureApiClient() chạy NGAY LẬP TỨC (không cần useEffect)
 * 2. bootstrap() gọi /auth/refresh với cookie → lấy access token mới
 * 3. setAccessToken() + setUser() → isAuthenticated = true
 * 4. ProtectedRoute thấy isInitialized=true → cho phép render
 */

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import axios from 'axios';
import { useAuthStore, AuthUser } from '../store/useAuthStore';
import { apiClient, configureApiClient } from '../api/apiClient';

// Helper: Chỉ redirect nếu chưa ở trang đích
const safeRedirect = (path: string) => {
  if (window.location.pathname !== path) {
    window.location.href = path;
  }
};

// ─── Kết nối apiClient với Zustand NGAY KHI MODULE LOAD ──
configureApiClient(
  // Force logout handler (bị admin thu hồi)
  () => {
    useAuthStore.getState().clearSession();
    alert('⚡ Phiên đăng nhập của bạn đã bị thu hồi bởi quản trị viên.\n\nVui lòng đăng nhập lại.');
    safeRedirect('/login');
  },
  // Refresh failed handler - chỉ redirect nếu chưa ở /login
  () => {
    useAuthStore.getState().clearSession();
    safeRedirect('/login');
  }
);

// ─── Context Type ─────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (
    email: string,
    password: string,
    locationData?: { latitude?: number; longitude?: number; address?: string }
  ) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
  can: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  // ── Bootstrap: Khôi phục phiên làm việc khi app load ──
  const bootstrap = useCallback(async () => {
    // Đang ở trang login → không cần bootstrap, đánh dấu initialized luôn
    if (window.location.pathname === '/login') {
      useAuthStore.setState({ loading: false, isInitialized: true });
      return;
    }

    useAuthStore.setState({ loading: true });

    try {
      // Dùng axios thô (bypass interceptor) để tránh vòng lặp refresh
      const refreshRes = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true, timeout: 10000 }
      );
      const newToken = refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;

      if (!newToken) {
        useAuthStore.getState().clearSession();
        return;
      }

      // Lưu access token vào Zustand RAM
      useAuthStore.getState().setAccessToken(newToken);

      // Lấy thông tin user (apiClient giờ có token trong store rồi)
      const res = await apiClient.get('/auth/me');
      const userData = res.data.data || res.data;
      const permissions = userData.role?.permissions || userData.permissions || [];
      const normalizedUser: AuthUser = { ...userData, permissions };
      useAuthStore.getState().setUser(normalizedUser);

    } catch (err: any) {
      console.info('[Auth] Không tìm thấy phiên hợp lệ, yêu cầu đăng nhập.');
      useAuthStore.getState().clearSession();
      // Không redirect ở đây — ProtectedRoute sẽ xử lý
    } finally {
      useAuthStore.setState({ loading: false, isInitialized: true });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // ── Login với GPS location ──
  const login = useCallback(async (
    email: string,
    password: string,
    locationData?: { latitude?: number; longitude?: number; address?: string }
  ) => {
    const res = await apiClient.post('/auth/login', { email, password, ...locationData });
    const responseData = res.data.data || res.data;
    const { user: u, accessToken } = responseData;

    if (!accessToken) throw new Error('Server không trả về mã truy cập (Token)');

    // ✅ Access token → RAM (Zustand) - KHÔNG localStorage
    // ✅ Refresh token → httpOnly cookie (server đã set tự động)
    useAuthStore.getState().setAccessToken(accessToken);

    const permissions = u.role?.permissions || u.permissions || [];
    const userWithPerms: AuthUser = { ...u, permissions };
    useAuthStore.getState().setUser(userWithPerms);
    useAuthStore.setState({ isInitialized: true, loading: false });
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      // Clear httpOnly cookie trên server
      await apiClient.post('/auth/logout', {}, { withCredentials: true });
    } catch (_) {}
    useAuthStore.getState().clearSession();
    window.location.href = '/login';
  }, []);

  // ── Context Value ──
  const contextValue = useMemo<AuthContextType>(() => ({
    user: store.user,
    loading: store.loading,
    isAuthenticated: store.isAuthenticated,
    isInitialized: store.isInitialized,
    login,
    logout,
    hasRole: store.hasRole,
    can: store.can
  }), [store.user, store.loading, store.isAuthenticated, store.isInitialized, login, logout, store.hasRole, store.can]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}