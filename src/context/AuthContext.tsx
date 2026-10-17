/**
 * AuthContext.tsx - React Context + Zustand Bootstrap
 *
 * Luồng Bootstrap:
 * 1. configureApiClient() chạy ngay khi module load
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
  ReactNode,
} from 'react';
import axios from 'axios';
import { useAuthStore, AuthUser } from '../store/useAuthStore';
import { apiClient, configureApiClient } from '../api/apiClient';

const safeRedirect = (path: string) => {
  if (window.location.pathname !== path) {
    window.location.href = path;
  }
};

// ─── Connect apiClient với Zustand NGAY KHI MODULE LOAD ───────────────────
configureApiClient(
  () => {
    useAuthStore.getState().clearSession();
    alert('⚡ Phiên đăng nhập của bạn đã bị thu hồi.\n\nVui lòng đăng nhập lại.');
    safeRedirect('/login');
  },
  () => {
    useAuthStore.getState().clearSession();
    safeRedirect('/login');
  },
);

// ─── Context Type ──────────────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (
    email: string,
    password: string,
    locationData?: { latitude?: number; longitude?: number; address?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
  can: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  const bootstrap = useCallback(async () => {
    if (window.location.pathname === '/login') {
      useAuthStore.setState({ loading: false, isInitialized: true });
      return;
    }

    useAuthStore.setState({ loading: true });

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

      if (!newToken) {
        useAuthStore.getState().clearSession();
        return;
      }

      useAuthStore.getState().setAccessToken(newToken);

      const res = await apiClient.get('/auth/me');
      const userData = res.data.data || res.data;
      const permissions =
        (typeof userData.role === 'object' && userData.role?.permissions) ||
        userData.permissions ||
        (userData.role === 'admin' ? ['*'] : []);
      const normalizedUser: AuthUser = { ...userData, permissions };
      useAuthStore.getState().setUser(normalizedUser);
    } catch (err) {
      console.info('[Auth] Không tìm thấy phiên hợp lệ.');
      useAuthStore.getState().clearSession();
    } finally {
      useAuthStore.setState({ loading: false, isInitialized: true });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      locationData?: { latitude?: number; longitude?: number; address?: string },
    ) => {
      const res = await apiClient.post('/auth/login', {
        email,
        password,
        ...locationData,
      });
      const responseData = res.data.data || res.data;
      const u = responseData.user;
      const accessToken = responseData.token || responseData.accessToken;

      if (!accessToken) throw new Error('Server không trả về mã truy cập');

      useAuthStore.getState().setAccessToken(accessToken);

      const permissions =
        (typeof u?.role === 'object' && u?.role?.permissions) ||
        u?.permissions ||
        (u?.role === 'admin' ? ['*'] : []);
      const userWithPerms: AuthUser = { ...u, permissions };
      useAuthStore.getState().setUser(userWithPerms);
      useAuthStore.setState({ isInitialized: true, loading: false });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {}, { withCredentials: true });
    } catch (_) {}
    useAuthStore.getState().clearSession();
    window.location.href = '/login';
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: store.user,
      loading: store.loading,
      isAuthenticated: store.isAuthenticated,
      isInitialized: store.isInitialized,
      login,
      logout,
      hasRole: store.hasRole,
      can: store.can,
    }),
    [
      store.user,
      store.loading,
      store.isAuthenticated,
      store.isInitialized,
      login,
      logout,
      store.hasRole,
      store.can,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
