import { create } from 'zustand';
import toast from 'react-hot-toast';
import { UserProfile, UserRoleLegacy } from '../types';
import { authApi, LoginPayload } from '../api/xacThuc.api';
import { normalizeBackendData } from '../utils/chuanHoaDuLieu';

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
    return raw ? normalizeBackendData<UserProfile>(JSON.parse(raw)) : null;
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
    } else {
      clearAllAuthStorage();
    }
    set({ token, isAuthenticated: !!token });
  },

  checkIdleTimeout: () => {
    if (!get().isAuthenticated) return false;
    if (isSessionIdleExpired()) {
      clearAllAuthStorage();
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
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
        const { token, refreshToken, user } = res.data;

        clearAllAuthStorage();
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
      const userData = ((res.data as any)?.user || res.data) as UserProfile;
      if (res.success && userData && (userData._id || (userData as any).id || userData.email)) {
        getActiveAuthStorage().setItem('user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true });
      }
    } catch (error) {
      console.warn('Lỗi khi lấy thông tin người dùng hiện tại:', error);
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      clearAllAuthStorage();

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
      giang_vien: 'ducvt.gv@ntu.edu.vn',
      tccb: 'tccb@ntu.edu.vn',
      ke_toan: 'ketoan@ntu.edu.vn',
    };

    const targetEmail = roleEmails[role];
    if (targetEmail) {
      const ok = await get().login({ email: targetEmail, password: '123456' });
      if (ok) {
        toast.success(`Đã đăng nhập xác thực thành công vai trò: ${role.toUpperCase()}`);
        return;
      }
    }

    const roleProfiles: Partial<Record<UserRoleLegacy, Partial<UserProfile>>> = {
      bgh: {
        ho_ten: 'PGS.TS. Nguyễn Văn Hiệu',
        email: 'hieutruong@ntu.edu.vn',
        vai_tro_chinh: 'bgh',
        ten_phong_ban: 'Ban Giám Hiệu',
        danh_sach_vai_tro: [{ ma_vai_tro: 'bgh', pham_vi: 'toan_truong' }],
      },
      admin: {
        ho_ten: 'Quản trị viên Hệ thống',
        email: 'admin@ntu.edu.vn',
        vai_tro_chinh: 'admin',
        ten_phong_ban: 'Ban Giám Hiệu',
        danh_sach_vai_tro: [{ ma_vai_tro: 'admin', pham_vi: 'toan_truong' }],
      },
      truong_khoa: {
        ho_ten: 'TS. Trần Minh Tuấn',
        email: 'truongkhoa.cntt@ntu.edu.vn',
        vai_tro_chinh: 'truong_khoa',
        ten_phong_ban: 'Khoa Công nghệ Thông tin',
        danh_sach_vai_tro: [{ ma_vai_tro: 'truong_khoa', pham_vi: 'khoa' }],
      },
      giang_vien: {
        ho_ten: 'ThS. Vũ Tiến Đức',
        email: 'ducvt.gv@ntu.edu.vn',
        vai_tro_chinh: 'giang_vien',
        ten_phong_ban: 'Khoa Công nghệ Thông tin',
        danh_sach_vai_tro: [{ ma_vai_tro: 'giang_vien', pham_vi: 'khoa' }],
      },
      tccb: {
        ho_ten: 'Lê Thị Hương',
        email: 'tccb@ntu.edu.vn',
        vai_tro_chinh: 'tccb',
        ten_phong_ban: 'Phòng Tổ chức Cán bộ',
        danh_sach_vai_tro: [{ ma_vai_tro: 'tccb', pham_vi: 'toan_truong' }],
      },
      ke_toan: {
        ho_ten: 'Phạm Thu Hà',
        email: 'ketoan@ntu.edu.vn',
        vai_tro_chinh: 'ke_toan',
        ten_phong_ban: 'Phòng Kế toán - Tài chính',
        danh_sach_vai_tro: [{ ma_vai_tro: 'ke_toan', pham_vi: 'toan_truong' }],
      },
    };

    const currentUser = get().user;
    const updated = currentUser
      ? { ...currentUser, ...(roleProfiles[role] || {}) }
      : (roleProfiles[role] as UserProfile);
    getActiveAuthStorage().setItem('user', JSON.stringify(updated));
    set({ user: updated });
    toast.success(`Đã chuyển thử nghiệm sang vai trò: ${role.toUpperCase()}`);
  },
}));
