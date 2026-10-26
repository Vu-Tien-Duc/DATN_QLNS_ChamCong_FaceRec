import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Clock,
  Calendar,
  FileText,
  Users,
  Building2,
  DollarSign,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Layers,
  LogOut,
  X,
  CalendarDays,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../api/apiClient';
import { Badge } from '../ui/Badge';
import { UserAvatar } from '../ui/UserAvatar';
import { hasRole, getRoleLabel } from '../../utils/rbac';
import { cameraManager } from '../../utils/cameraManager';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'brand' | 'danger' | 'warning' | 'info' | 'success';
  roles?: string[];
  excludeRoles?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  onMobileClose,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number | null>(null);

  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Reset avatar error when user changes
  useEffect(() => {
    setAvatarLoadError(false);
  }, [user?._id, user?.avatar, user?.facePhoto]);

  // Fetch real count of pending leave requests from backend
  useEffect(() => {
    let isMounted = true;
    const fetchPendingLeave = async () => {
      try {
        const res = await apiClient.get('/leave-requests', {
          params: { status: 'PENDING' },
        });
        const raw = res.data?.data || res.data;
        const list = Array.isArray(raw) ? raw : raw?.items || raw?.leaveRequests || [];
        if (isMounted) {
          setPendingLeaveCount(list.length);
        }
      } catch {
        // Quiet fail if user does not have permission or server is offline
      }
    };

    if (user) {
      fetchPendingLeave();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Resolve user's actual photo URL from backend
  const userAvatarUrl = useMemo(() => {
    if (avatarLoadError || !user) return null;
    const raw =
      user.avatar ||
      user.facePhoto ||
      (user as any).anh_dai_dien ||
      (user as any).anh_khuon_mat;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/api/')) return raw;
    if (raw.startsWith('/uploads/')) return `/api${raw}`;
    if (raw.startsWith('uploads/')) return `/api/${raw}`;
    return `/api/upload/file/${raw}`;
  }, [user, avatarLoadError]);

  // Check if current user has access to a menu item based on allowed & excluded roles
  const hasRoleAccess = (allowedRoles?: string[], excludeRoles?: string[]): boolean => {
    return hasRole(user, allowedRoles, excludeRoles);
  };

  // Human-readable Role Display Name matching CSDL v2.5
  const getRoleDisplayName = (role?: string) => {
    return getRoleLabel(role);
  };

  // Nav Groups perfectly aligned with Backend Routes (14 Collections & Modules)
  const navGroups: NavGroup[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        { name: 'Bảng Điều Khiển', path: '/', icon: LayoutDashboard },
        { name: 'Điểm Danh AI Live', path: '/face-attendance', icon: Camera, badge: 'Live', badgeVariant: 'danger' },
      ],
    },
    {
      title: 'CHẤM CÔNG & NGHỈ PHÉP',
      items: [
        {
          name: 'Chấm Công Cá Nhân',
          path: '/attendance-me',
          icon: Clock,
          excludeRoles: ['admin'],
        },
        {
          name: 'Đăng Ký Face ID (5 Góc)',
          path: '/face-registration',
          icon: Sparkles,
          roles: ['admin', 'bgh'],
        },
        {
          name: 'Quản Lý Điểm Danh',
          path: '/attendance-manage',
          icon: Layers,
          roles: ['admin', 'bgh', 'truongkhoa', 'phokhoa', 'tccb'],
        },
        {
          name: 'Đơn Nghỉ Phép',
          path: '/leave-requests',
          icon: FileText,
          badge: pendingLeaveCount && pendingLeaveCount > 0 ? String(pendingLeaveCount) : undefined,
          badgeVariant: 'warning',
        },
        { name: 'Thời Khóa Biểu & Lịch', path: '/schedules', icon: Calendar },
      ],
    },
    {
      title: 'NHÂN SỰ & TÀI CHÍNH',
      items: [
        {
          name: 'Danh Sách Cán Bộ',
          path: '/users',
          icon: Users,
          roles: ['admin', 'bgh', 'truongkhoa', 'tccb'],
        },
        {
          name: 'Khoa & Phòng Ban',
          path: '/departments',
          icon: Building2,
        },
        {
          name: 'Danh Mục Môn Học',
          path: '/subjects',
          icon: BookOpen,
          roles: ['admin', 'bgh', 'truongkhoa', 'daotao'],
        },
        {
          name: 'Bảng Lương 2026',
          path: '/payroll',
          icon: DollarSign,
        },
        {
          name: 'Báo Cáo & Thống Kê',
          path: '/reports',
          icon: BarChart3,
          roles: ['admin', 'bgh', 'ketoan', 'truongkhoa'],
        },
      ],
    },
    {
      title: 'HỆ THỐNG & QUẢN TRỊ',
      items: [
        {
          name: 'Lịch Nghỉ Lễ & Tết',
          path: '/holidays',
          icon: CalendarDays,
        },
        {
          name: 'Ca Làm Việc & Giờ',
          path: '/shifts',
          icon: Clock,
          roles: ['admin', 'bgh', 'daotao'],
        },
        {
          name: 'Nhật Ký Kiểm Toán',
          path: '/audit-logs',
          icon: ShieldCheck,
          roles: ['admin', 'bgh', 'kiemtoan'],
        },
        {
          name: 'Cấu Hình Tham Số',
          path: '/settings',
          icon: Settings,
          roles: ['admin'],
        },
      ],
    },
  ];

  const displayRoleTitle =
    user?.position || getRoleDisplayName(user?.role || (user as any)?.primaryRole || 'giangvien');

  // ─── Shared inner content (used by both desktop & mobile sidebar) ───────────
  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* ── Brand / Logo Header — matches Navbar h-16 ── */}
      <div
        className={`h-16 shrink-0 border-b border-slate-200/60 dark:border-slate-800/60 ${
          isCollapsed && !isMobile
            ? 'px-2 flex items-center justify-center relative'
            : 'px-4 flex items-center justify-between'
        }`}
      >
        {isCollapsed && !isMobile ? (
          <>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-sm hover:border-brand-500 hover:shadow-md transition-all cursor-pointer group/logo"
              title="Mở rộng menu điều hướng"
            >
              <img
                src="/logo.png"
                alt="NTU Logo"
                className="w-full h-full object-contain group-hover/logo:scale-105 transition-transform"
              />
            </button>

            {/* Floating expand button on right edge */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all cursor-pointer"
              title="Mở rộng menu"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <img src="/logo.png" alt="NTU Logo" className="w-full h-full object-contain" />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                  ĐH NGUYỄN TRÃI
                </span>
                <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  NTU Smart HR
                </span>
              </div>
            </div>

            {/* Close button for Mobile */}
            {isMobile && (
              <button
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Collapse Toggle for Desktop */}
            {!isMobile && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Thu gọn menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Navigation Menu List ── */}
      <nav
        className={`flex-1 overflow-y-auto no-scrollbar ${
          isCollapsed && !isMobile ? 'px-2 py-3 space-y-2' : 'px-3 py-4 space-y-5'
        }`}
      >
        {navGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item: any) => hasRoleAccess(item.roles, item.excludeRoles));
          if (visibleItems.length === 0) return null;

          const showCollapsed = isCollapsed && !isMobile;

          return (
            <div key={gIdx} className={showCollapsed ? 'space-y-1' : 'space-y-0.5'}>
              {/* Divider between groups */}
              {showCollapsed && gIdx > 0 && (
                <div className="w-8 h-px bg-slate-200/80 dark:bg-slate-700/60 mx-auto my-2" />
              )}

              {!showCollapsed && (
                <h4 className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80 select-none">
                  {group.title}
                </h4>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (item.path !== '/face-attendance') {
                        cameraManager.stopAllStreams();
                      }
                      onMobileClose();
                    }}
                    title={showCollapsed ? item.name : undefined}
                    className={`flex items-center transition-all duration-200 group relative ${
                      showCollapsed
                        ? 'w-11 h-11 mx-auto justify-center rounded-xl'
                        : 'gap-3 px-3 py-2 rounded-xl text-[13px]'
                    } ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold ring-1 ring-brand-500/20 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    {/* Active indicator bar */}
                    {isActive && !showCollapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-600 rounded-r-full dark:bg-brand-400" />
                    )}
                    {isActive && showCollapsed && (
                      <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full dark:bg-brand-400" />
                    )}

                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />

                    {!showCollapsed && <span className="truncate flex-1">{item.name}</span>}

                    {/* Badge when expanded */}
                    {!showCollapsed && item.badge && (
                      <Badge
                        variant={item.badgeVariant || (item.badge === 'Live' ? 'danger' : 'brand')}
                        size="sm"
                        dot={item.badge === 'Live'}
                      >
                        {item.badge}
                      </Badge>
                    )}

                    {/* Notification dot when collapsed */}
                    {showCollapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── User Profile Footer ── */}
      <div className="shrink-0 p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/60">
        {isCollapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/profile"
              className="relative shrink-0 cursor-pointer group"
              title={`${user?.fullName || 'Người Dùng'} (${displayRoleTitle}) - Xem Hồ Sơ`}
            >
              <UserAvatar
                user={user}
                name={user?.fullName}
                avatarUrl={user?.avatar}
                staffCode={user?.staffCode || user?._id}
                size="md"
                shape="rounded"
                showStatusDot={true}
                statusColor="bg-emerald-500"
              />
            </Link>

            <button
              type="button"
              onClick={logout}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors">
            <Link
              to="/profile"
              onClick={() => {
                cameraManager.stopAllStreams();
                if (isMobile) onMobileClose();
              }}
              className="flex items-center gap-3 flex-1 min-w-0 group"
              title="Xem Hồ sơ cá nhân & Đổi mật khẩu"
            >
              <div className="relative shrink-0 cursor-pointer">
                <UserAvatar
                  user={user}
                  name={user?.fullName}
                  avatarUrl={user?.avatar}
                  staffCode={user?.staffCode || user?._id}
                  size="md"
                  shape="rounded"
                  showStatusDot={true}
                  statusColor="bg-emerald-500"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-600 transition-colors">
                    {user?.fullName || 'Người Dùng'}
                  </p>
                  {user?.staffCode && (
                    <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      {user.staffCode}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {displayRoleTitle}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR — regular flex child inside h-screen parent.
          Takes full viewport height, nav section scrolls internally.
          NO sticky, NO fixed — just a normal flex column.
         ══════════════════════════════════════════════════════════════════ */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 transition-[width] duration-300 ease-in-out z-30 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE SIDEBAR — fixed overlay, slides in from left.
          Completely independent from desktop flow.
         ══════════════════════════════════════════════════════════════════ */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
      />

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
};

export default Sidebar;
