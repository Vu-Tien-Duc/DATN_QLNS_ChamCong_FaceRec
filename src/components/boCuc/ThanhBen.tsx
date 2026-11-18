import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
import { useAuthStore } from '../../stores/useXacThucStore';
import { apiClient } from '../../api/apiClient';
import { hasRole } from '../../utils/phanQuyen';
import { cameraManager } from '../../utils/quanLyCamera';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavChildItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles?: string[];
  excludeRoles?: string[];
}

interface SidebarEntry {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  badge?: string;
  roles?: string[];
  excludeRoles?: string[];
  children?: NavChildItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  onMobileClose,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Fetch real count of pending leave requests from backend
  useEffect(() => {
    let isMounted = true;
    const fetchPendingLeave = async () => {
      try {
        const res = await apiClient.get('/don-nghi-phep', {
          params: { trang_thai: 'pending' },
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

  // Check if current user has access to a menu item based on allowed & excluded roles
  const hasRoleAccess = (allowedRoles?: string[], excludeRoles?: string[]): boolean => {
    return hasRole(user, allowedRoles, excludeRoles);
  };

  // Gọn nhẹ kiểu cây đóng/mở (2 mục truy cập nhanh + 5 nhóm có mũi tên)
  const menuEntries: SidebarEntry[] = [
    {
      id: 'dashboard',
      name: 'Bảng Điều Khiển',
      path: '/',
      icon: LayoutDashboard,
    },
    {
      id: 'face-kiosk',
      name: 'Điểm Danh AI',
      path: '/diem-danh-khuon-mat',
      icon: Camera,
    },
    {
      id: 'attendance-leave',
      name: 'Chấm công & Nghỉ phép',
      icon: Clock,
      badge: pendingLeaveCount && pendingLeaveCount > 0 ? String(pendingLeaveCount) : undefined,
      children: [
        {
          name: 'Chấm Công Cá Nhân',
          path: '/cham-cong-ca-nhan',
          icon: Clock,
          excludeRoles: ['admin'],
        },
        {
          name: 'Đăng Ký Face ID',
          path: '/dang-ky-khuon-mat',
          icon: Sparkles,
          roles: ['admin', 'bgh', 'tccb'],
        },
        {
          name: 'Quản Lý Điểm Danh',
          path: '/quan-ly-cham-cong',
          icon: Layers,
          roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong', 'tccb'],
        },
        {
          name: 'Đơn Nghỉ Phép',
          path: '/don-nghi-phep',
          icon: FileText,
          badge: pendingLeaveCount && pendingLeaveCount > 0 ? String(pendingLeaveCount) : undefined,
        },
      ],
    },
    {
      id: 'hr-org',
      name: 'Nhân sự & Tổ chức',
      icon: Users,
      children: [
        {
          name: 'Danh Sách Cán Bộ',
          path: '/nguoi-dung',
          icon: Users,
          roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'tccb'],
        },
        {
          name: 'Khoa & Phòng Ban',
          path: '/phong-ban',
          icon: Building2,
        },
      ],
    },
    {
      id: 'schedule-training',
      name: 'Lịch & Đào tạo',
      icon: Calendar,
      children: [
        { name: 'Thời Khóa Biểu & Lịch', path: '/lich-trinh', icon: Calendar },
        {
          name: 'Danh Mục Môn Học',
          path: '/mon-hoc',
          icon: BookOpen,
          roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao'],
        },
        {
          name: 'Ca Làm Việc & Giờ',
          path: '/ca-lam-viec',
          icon: Clock,
          roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'dao_tao'],
        },
        {
          name: 'Lịch Nghỉ Lễ & Tết',
          path: '/ngay-nghi-le',
          icon: CalendarDays,
        },
      ],
    },
    {
      id: 'finance-reports',
      name: 'Tài chính & Báo cáo',
      icon: DollarSign,
      children: [
        {
          name: 'Bảng Lương 2026',
          path: '/phieu-luong',
          icon: DollarSign,
        },
        {
          name: 'Báo Cáo & Thống Kê',
          path: '/bao-cao',
          icon: BarChart3,
          roles: ['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa'],
        },
      ],
    },
    {
      id: 'system-admin',
      name: 'Hệ thống',
      icon: Settings,
      children: [
        {
          name: 'Nhật Ký Kiểm Toán',
          path: '/nhat-ky-kiem-toan',
          icon: ShieldCheck,
          roles: ['admin', 'bgh', 'kiem_toan'],
        },
        {
          name: 'Cấu Hình Tham Số',
          path: '/cai-dat',
          icon: Settings,
          roles: ['admin'],
        },
      ],
    },
  ];

  // Tự động mở nhóm chứa trang đang truy cập
  useEffect(() => {
    const activeGroup = menuEntries.find((entry) =>
      entry.children?.some((child) => child.path === location.pathname)
    );
    if (activeGroup) {
      setExpandedGroups((prev) => (prev[activeGroup.id] ? prev : { ...prev, [activeGroup.id]: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // ─── Shared inner content (used by both desktop & mobile sidebar) ───────────
  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* ── Brand / Logo Header — matches Navbar h-16 ── */}
      <div
        className={`h-16 shrink-0 border-b border-slate-200 dark:border-slate-700/80 ${
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
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
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
          isCollapsed && !isMobile ? 'px-2 py-3 space-y-1.5' : 'px-3 py-4 space-y-1.5'
        }`}
      >
        {!(isCollapsed && !isMobile) && (
          <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
            Danh mục chức năng
          </div>
        )}

        {menuEntries.map((entry) => {
          const showCollapsed = isCollapsed && !isMobile;
          const EntryIcon = entry.icon;

          // Case 1: Mục 1 chạm (không có menu con)
          if (!entry.children) {
            if (!hasRoleAccess(entry.roles, entry.excludeRoles) || !entry.path) return null;
            const isActive = location.pathname === entry.path;

            return (
              <NavLink
                key={entry.id}
                to={entry.path}
                onClick={() => {
                  if (entry.path !== '/diem-danh-khuon-mat') {
                    cameraManager.stopAllStreams();
                  }
                  onMobileClose();
                }}
                title={showCollapsed ? entry.name : undefined}
                className={`flex items-center transition-colors group relative ${
                  showCollapsed
                    ? 'w-11 h-11 mx-auto justify-center rounded-xl'
                    : 'gap-3 px-3 py-2.5 rounded-xl text-sm'
                } ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {isActive && !showCollapsed && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-brand-600 rounded-r-full dark:bg-brand-400" />
                )}
                {isActive && showCollapsed && (
                  <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full dark:bg-brand-400" />
                )}

                <EntryIcon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}
                />

                {!showCollapsed && <span className="truncate flex-1">{entry.name}</span>}
              </NavLink>
            );
          }

          // Case 2: Nhóm cha có mục con đóng/mở
          const visibleChildren = entry.children.filter((child) =>
            hasRoleAccess(child.roles, child.excludeRoles)
          );
          if (visibleChildren.length === 0) return null;

          // Khi sidebar thu gọn thành thanh icon: hiển thị icon các trang con để truy cập nhanh
          if (showCollapsed) {
            return (
              <div key={entry.id} className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                {visibleChildren.map((child) => {
                  const ChildIcon = child.icon;
                  const isActive = location.pathname === child.path;
                  return (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      onClick={() => {
                        if (child.path !== '/diem-danh-khuon-mat') {
                          cameraManager.stopAllStreams();
                        }
                        onMobileClose();
                      }}
                      title={child.name}
                      className={`flex items-center w-11 h-11 mx-auto justify-center rounded-xl transition-colors group relative ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full dark:bg-brand-400" />
                      )}
                      <ChildIcon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          isActive
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        }`}
                      />
                    </NavLink>
                  );
                })}
              </div>
            );
          }

          const hasActiveChild = visibleChildren.some((c) => location.pathname === c.path);
          const isExpanded = Boolean(expandedGroups[entry.id]);

          return (
            <div key={entry.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(entry.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer group ${
                  hasActiveChild
                    ? 'text-slate-900 dark:text-white font-semibold bg-slate-100/80 dark:bg-slate-800/60'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <EntryIcon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    hasActiveChild
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate flex-1 text-left">{entry.name}</span>

                {entry.badge && !isExpanded && (
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {entry.badge}
                  </span>
                )}

                <ChevronLeft
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isExpanded ? '-rotate-90 text-slate-600 dark:text-slate-300' : 'rotate-0'
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-1 py-0.5">
                  {visibleChildren.map((child) => {
                    const ChildIcon = child.icon;
                    const isActive = location.pathname === child.path;

                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={() => {
                          if (child.path !== '/diem-danh-khuon-mat') {
                            cameraManager.stopAllStreams();
                          }
                          onMobileClose();
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors group relative ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                        }`}
                      >
                        <ChildIcon
                          className={`w-[17px] h-[17px] shrink-0 ${
                            isActive
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                          }`}
                        />
                        <span className="truncate flex-1">{child.name}</span>
                        {child.badge && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {child.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Compact System & Logout Footer ── */}
      <div className="shrink-0 p-2.5 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-850/70">
        {isCollapsed && !isMobile ? (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={logout}
              className="w-10 h-10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer"
              title="Đăng xuất tài khoản"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-1.5 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                CSDL v2.5 • NTU HR
              </span>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
              title="Đăng xuất tài khoản"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
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
        className={`hidden lg:flex flex-col shrink-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/80 transition-[width] duration-300 ease-in-out z-30 ${
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
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/80 shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
};

export default Sidebar;
