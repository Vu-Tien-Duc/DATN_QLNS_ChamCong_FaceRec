import { create } from 'zustand';
import toast from 'react-hot-toast';
import { UserProfile, UserRoleLegacy } from '../types';
import { clearApiClientAuthHeader, FORCE_LOGOUT_MESSAGE_KEY } from '../api/apiClient';
import { authApi, LoginPayload } from '../api/xacThuc.api';
import { disconnectSocket, updateSocketAuthToken } from '../api/socket';

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'ntu_last_activity';

export const getActiveAuthStorage = (): Storage => {
  if (typeof window === 'undefined') return localStorage;
  return sessionStorage.getItem('token') || sessionStorage.getItem('accessToken')
    ? sessionStorage
    : localStorage;
};

export const clearAllAuthStorage = () => {
  if (typeof window === 'undefined') return;
  for (const st of [sessionStorage, localStorage]) {
    st.removeItem('accessToken');
    st.removeItem('token');
    st.removeItem('refreshToken');
    st.removeItem('user');
    st.removeItem(LAST_ACTIVITY_KEY);
  }
};

export const touchSessionActivity = () => {
  if (typeof window === 'undefined') return;
  const storage = getActiveAuthStorage();
  if (storage.getItem('token') || storage.getItem('accessToken')) {
    storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }
};

export const isSessionIdleExpired = (): boolean => {
  if (typeof window === 'undefined') return false;
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY) || localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts > SESSION_IDLE_TIMEOUT_MS;
};

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  checkIdleTimeout: () => boolean;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  switchDemoRole: (role: UserRoleLegacy) => Promise<void>;
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  if (isSessionIdleExpired()) {
    clearAllAuthStorage();
    return null;
  }
  return (
    sessionStorage.getItem('accessToken') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token')
  );
};

const getStoredRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
};

const getStoredUser = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  if (isSessionIdleExpired()) {
    clearAllAuthStorage();
    return null;
  }
  try {
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  refreshToken: getStoredRefreshToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,

  setUser: (user) => {
    const storage = getActiveAuthStorage();
    if (user) {
      storage.setItem('user', JSON.stringify(user));
    } else {
      clearAllAuthStorage();
    }
    set({ user, isAuthenticated: !!user });
  },

  setToken: (token) => {
    const storage = getActiveAuthStorage();
    if (token) {
      storage.setItem('token', token);
      storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      updateSocketAuthToken(token);
    } else {
      disconnectSocket();
      clearAllAuthStorage();
      clearApiClientAuthHeader();
    }
    set({ token, isAuthenticated: !!token });
  },

  checkIdleTimeout: () => {
    if (!get().isAuthenticated) return false;
    if (isSessionIdleExpired()) {
      const staleRefreshToken = getStoredRefreshToken();
      const staleAccessToken =
        get().token ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('accessToken') ||
            sessionStorage.getItem('token') ||
            localStorage.getItem('accessToken') ||
            localStorage.getItem('token')
          : null);
      disconnectSocket();
      clearAllAuthStorage();
      clearApiClientAuthHeader();
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      if (staleRefreshToken || staleAccessToken) {
        authApi.logout(staleRefreshToken, staleAccessToken).catch(() => {});
      }
      toast.error('Phiên đăng nhập đã hết hạn sau 15 phút không thao tác. Vui lòng đăng nhập lại.', {
        id: 'idle-timeout',
      });
      return true;
    }
    touchSessionActivity();
    return false;
  },

  login: async (payload: LoginPayload, rememberMe = false) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(payload);
      if (res.success && res.data) {
        const token = res.data.token;
        const refreshToken = res.data.ma_lam_moi;
        const user = res.data.nguoi_dung;

        clearAllAuthStorage();
        clearApiClientAuthHeader();
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', token);
        if (refreshToken) {
          storage.setItem('refreshToken', refreshToken);
        }
        storage.setItem('user', JSON.stringify(user));
        storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

        set({
          user,
          token,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
        });
        updateSocketAuthToken(token);

        const displayName = user.ho_ten || 'Quý Thầy/Cô';
        toast.success(`Chào mừng ${displayName} đăng nhập thành công!`);
        return true;
      } else {
        toast.error(res.message || 'Đăng nhập không thành công.');
        set({ isLoading: false });
        return false;
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
      toast.error(errMsg);
      set({ isLoading: false });
      return false;
    }
  },

  fetchMe: async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      const res = await authApi.getMe();
      const userData = res.data;
      if (res.success && userData && (userData.id || userData.email)) {
        getActiveAuthStorage().setItem('user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true });
      }
    } catch (error) {
      console.warn('Lỗi khi lấy thông tin người dùng hiện tại:', error);
    }
  },

  logout: async () => {
    const currentRefreshToken = getStoredRefreshToken() || get().refreshToken;
    // Ngắt Socket trước khi gọi API logout để tab hiện tại không tự nhận sự kiện force-logout
    disconnectSocket();
    try {
      sessionStorage.removeItem(FORCE_LOGOUT_MESSAGE_KEY);
    } catch {
      // Bỏ qua lỗi storage
    }
    try {
      await authApi.logout(currentRefreshToken);
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      disconnectSocket();
      clearAllAuthStorage();
      try {
        sessionStorage.removeItem(FORCE_LOGOUT_MESSAGE_KEY);
      } catch {
        // Bỏ qua lỗi storage
      }
      clearApiClientAuthHeader();
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      toast.success('Đã đăng xuất khỏi hệ thống.');
    }
  },

  switchDemoRole: async (role: UserRoleLegacy) => {
    const roleEmails: Partial<Record<UserRoleLegacy, string>> = {
      admin: 'admin@ntu.edu.vn',
      bgh: 'hieutruong@ntu.edu.vn',
      truong_khoa: 'truongkhoa.cntt@ntu.edu.vn',
      pho_khoa: 'phokhoa.cntt@ntu.edu.vn',
      truong_bo_mon: 'truongbomon.cnpm@ntu.edu.vn',
      giang_vien: 'ducvt.gv@ntu.edu.vn',
      tccb: 'tccb@ntu.edu.vn',
      dao_tao: 'daotao@ntu.edu.vn',
      ke_toan: 'ketoan@ntu.edu.vn',
    };

    const targetEmail = roleEmails[role];
    if (!targetEmail) {
      toast.error(`Không tìm thấy tài khoản thử nghiệm cho vai trò ${role}.`);
      return;
    }

    const ok = await get().login({ email: targetEmail, mat_khau: '123456' });
    if (ok) {
      toast.success(`Đã đăng nhập xác thực thành công vai trò: ${role.toUpperCase()}`);
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('auth:tokens-updated', (event: Event) => {
    const detail = (event as CustomEvent<{ token?: string; refreshToken?: string }>).detail;
    if (detail?.token) {
      updateSocketAuthToken(detail.token);
      useAuthStore.setState({
        token: detail.token,
        ...(detail.refreshToken ? { refreshToken: detail.refreshToken } : {}),
        isAuthenticated: true,
      });
    }
  });

  window.addEventListener('auth:session-cleared', () => {
    disconnectSocket();
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });
}
