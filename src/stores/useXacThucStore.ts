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

        const displayName = user.fullName || user.ho_ten || 'Quý Thầy/Cô';
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
      admin: 'admin@truong.edu.vn',
      giang_vien: 'gv01@truong.edu.vn',
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
        fullName: 'GS. TS. Nguyễn Văn An',
        email: 'hieutruong@university.edu.vn',
        role: 'bgh',
        departmentName: 'Ban Giám Hiệu',
        roles: [{ role: 'bgh', scope: 'toan_truong' }],
      },
      admin: {
        fullName: 'Quản Trị Viên Hệ Thống (Admin)',
        email: 'admin@university.edu.vn',
        role: 'admin',
        departmentName: 'Phòng Quản Trị Công Nghệ',
        roles: [{ role: 'admin', scope: 'toan_truong' }],
      },
      truong_khoa: {
        fullName: 'PGS. TS. Lê Hoàng Nam',
        email: 'truongkhoa.cntt@university.edu.vn',
        role: 'truong_khoa',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'truong_khoa', scope: 'khoa' }],
      },
      giang_vien: {
        fullName: 'TS. Trần Thị Bích',
        email: 'giangvien.bich@university.edu.vn',
        role: 'giang_vien',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'giang_vien', scope: 'bo_mon' }],
      },
      nhan_vien: {
        fullName: 'Đỗ Thu Hà',
        email: 'nhanvien.ha@university.edu.vn',
        role: 'nhan_vien',
        departmentName: 'Phòng Đào Tạo',
        roles: [{ role: 'nhan_vien', scope: 'phong_ban' }],
      },
      ke_toan: {
        fullName: 'ThS. Nguyễn Thị Mai',
        email: 'admin.hr@university.edu.vn',
        role: 'ke_toan',
        departmentName: 'Phòng Hành Chính - Tổng Hợp',
        roles: [{ role: 'ke_toan', scope: 'toan_truong' }],
      },
      pho_khoa: {
        fullName: 'TS. Đặng Tiến Hưng',
        email: 'phokhoa.cntt@university.edu.vn',
        role: 'pho_khoa',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'pho_khoa', scope: 'khoa' }],
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
