import { create } from 'zustand';
import toast from 'react-hot-toast';
import { UserProfile, UserRoleLegacy } from '../types';
import { authApi, LoginPayload } from '../api/auth.api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  switchDemoRole: (role: UserRoleLegacy) => void;
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

const getStoredRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

const getStoredUser = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
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
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user, isAuthenticated: !!user });
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
    }
    set({ token, isAuthenticated: !!token });
  },

  login: async (payload: LoginPayload) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(payload);
      if (res.success && res.data) {
        const { token, accessToken, refreshToken, user } = res.data;
        const finalToken = accessToken || token;

        localStorage.setItem('accessToken', finalToken);
        localStorage.setItem('token', finalToken);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(user));

        set({
          user,
          token: finalToken,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
        });

        toast.success(`Chào mừng ${user.fullName} đăng nhập thành công!`);
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
      if (res.success && res.data?.user) {
        const user = res.data.user;
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true });
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      toast.success('Đã đăng xuất khỏi hệ thống.');
    }
  },

  switchDemoRole: (role: UserRoleLegacy) => {
    const roleProfiles: Record<UserRoleLegacy, Partial<UserProfile>> = {
      bgh: {
        fullName: 'GS. TS. Nguyễn Văn An',
        email: 'hieutruong@university.edu.vn',
        role: 'bgh',
        departmentName: 'Ban Giám Hiệu',
        roles: [{ role: 'BGH', scope: 'TOAN_TRUONG' }],
      },
      admin: {
        fullName: 'Quản Trị Viên Hệ Thống (IT Admin)',
        email: 'admin@university.edu.vn',
        role: 'admin',
        departmentName: 'Phòng Quản Trị Công Nghệ',
        roles: [{ role: 'ADMIN_IT', scope: 'TOAN_TRUONG' }],
      },
      truong_khoa: {
        fullName: 'PGS. TS. Lê Hoàng Nam',
        email: 'truongkhoa.cntt@university.edu.vn',
        role: 'truong_khoa',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'TRUONG_KHOA', scope: 'KHOA' }],
      },
      giang_vien: {
        fullName: 'TS. Trần Thị Bích',
        email: 'giangvien.bich@university.edu.vn',
        role: 'giang_vien',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'GIANG_VIEN', scope: 'BO_MON' }],
      },
      nhan_vien: {
        fullName: 'Đỗ Thu Hà',
        email: 'nhanvien.ha@university.edu.vn',
        role: 'nhan_vien',
        departmentName: 'Phòng Đào Tạo',
        roles: [{ role: 'NHAN_VIEN', scope: 'PHONG_BAN' }],
      },
      ke_toan: {
        fullName: 'ThS. Nguyễn Thị Mai',
        email: 'admin.hr@university.edu.vn',
        role: 'ke_toan',
        departmentName: 'Phòng Hành Chính - Tổng Hợp',
        roles: [{ role: 'ADMIN', scope: 'TOAN_TRUONG' }],
      },
      pho_khoa: {
        fullName: 'TS. Đặng Tiến Hưng',
        email: 'phokhoa.cntt@university.edu.vn',
        role: 'pho_khoa',
        departmentName: 'Khoa Công Nghệ Thông Tin & CĐS',
        roles: [{ role: 'PHO_TRUONG_KHOA', scope: 'KHOA' }],
      },
      it_admin: {
        fullName: 'Kỹ sư Quản trị Server',
        email: 'it.support@university.edu.vn',
        role: 'it_admin',
        departmentName: 'Phòng Quản Trị Công Nghệ',
        roles: [{ role: 'ADMIN_IT', scope: 'TOAN_TRUONG' }],
      },
    };

    const currentUser = get().user;
    const updated = currentUser ? { ...currentUser, ...(roleProfiles[role] || {}) } : (roleProfiles[role] as UserProfile);
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
    toast.success(`Đã chuyển thử nghiệm sang vai trò: ${role.toUpperCase()}`);
  },
}));
