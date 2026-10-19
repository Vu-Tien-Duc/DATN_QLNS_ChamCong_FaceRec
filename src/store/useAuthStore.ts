/**
 * useAuthStore - Zustand Store quản lý xác thực & phân quyền
 *
 * Bảo mật Token:
 * ✅ Access Token  → RAM (Zustand) - KHÔNG lưu localStorage
 * ✅ Refresh Token → httpOnly Cookie (server set)
 * ✅ User info     → sessionStorage (chỉ tab hiện tại, không chứa secret)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────
export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string;
  role?: string | {
    _id: string;
    name: string;
    permissions: string[];
  };
  roles?: string[];
  roleNames?: string[];
  department?: string | { _id: string; name: string };
  permissions: string[];
  isFaceRegistered?: boolean;
  facePhoto?: string;
  faceRegisteredAt?: string | Date;
  isActive?: boolean;
  staffCode?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;

  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (v: boolean) => void;
  clearSession: () => void;

  hasRole: (roleName: string) => boolean;
  can: (permissionCode: string) => boolean;
}

// ─── SessionStorage helpers ────────────────────────────────────────────────
const SESSION_KEY = 'qlns_session_user';

const saveSessionUser = (user: AuthUser | null) => {
  if (user) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (_) {}
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
};

const loadSessionUser = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ─── Store ────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    user: loadSessionUser(),
    accessToken: null,
    isAuthenticated: false,
    isInitialized: false,
    loading: true,

    setAccessToken: (token) => {
      set({
        accessToken: token,
        isAuthenticated: !!(token && get().user),
      });
    },

    setUser: (user) => {
      saveSessionUser(user);
      set({
        user,
        isAuthenticated: !!(get().accessToken && user),
      });
    },

    setLoading: (loading) => set({ loading }),
    setInitialized: (v) => set({ isInitialized: v }),

    clearSession: () => {
      saveSessionUser(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isInitialized: true,
        loading: false,
      });
    },

    // ── Role Check ──
    hasRole: (roleName: string): boolean => {
      const { user } = get();
      if (!user) return false;
      const target = roleName.toLowerCase().trim();

      const primaryRoleName =
        typeof user.role === 'object' ? user.role?.name : user.role;
      if (primaryRoleName && String(primaryRoleName).toLowerCase().trim() === target) return true;

      if (user.roles && Array.isArray(user.roles)) {
        if (user.roles.some((r: string) => String(r).toLowerCase().trim() === target)) return true;
      }

      if (user.roleNames && Array.isArray(user.roleNames)) {
        if (user.roleNames.some((r: string) => String(r).toLowerCase().trim() === target)) return true;
      }

      return false;
    },

    // ── Permission Check ──
    can: (permissionCode: string): boolean => {
      const { user, hasRole } = get();
      if (!user) return false;

      if (hasRole('admin') || user.permissions?.includes('all') || user.permissions?.includes('*')) return true;

      // Giảng viên và nhân viên đều có quyền chấm công cơ bản
      if (permissionCode === 'attendance.checkin') {
        const isAdmin = hasRole('admin') || hasRole('truongkhoa');
        return !isAdmin; // Tất cả trừ admin mới cần chấm công thủ công
      }

      if (!user.permissions || !Array.isArray(user.permissions)) return false;
      return user.permissions.includes(permissionCode);
    },
  })),
);
