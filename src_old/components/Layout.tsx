import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  Clock,
  ClipboardList,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  ScanFace,
  Shield,
  FileText,
  Briefcase,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  PieChart,
  GraduationCap,
  Sparkles,
  User as UserIcon,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface SidebarMenuItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  requiredRole?: string[];
}

interface SidebarMenuGroup {
  groupId: string;
  groupTitle: string;
  items: SidebarMenuItem[];
}

const SIDEBAR_GROUPS: SidebarMenuGroup[] = [
  {
    groupId: 'overview',
    groupTitle: 'Tổng Quan',
    items: [
      {
        label: 'Bảng Điều Khiển',
        path: '/',
        icon: LayoutDashboard,
      },
      {
        label: 'Trợ Lý AI Chatbot',
        path: '/ai-chat',
        icon: Sparkles,
        badge: 'AI v2.5',
      },
    ],
  },
  {
    groupId: 'attendance_teaching',
    groupTitle: 'Giảng Dạy & Chấm Công',
    items: [
      {
        label: 'Lịch Dạy & Công Tác',
        path: '/schedules',
        icon: Calendar,
      },
      {
        label: 'Chấm Công Của Tôi',
        path: '/attendance/me',
        icon: UserCheck,
      },
      {
        label: 'Lịch Sử Chấm Công',
        path: '/attendance/history',
        icon: ClipboardList,
      },
      {
        label: 'Quản Lý Chấm Công',
        path: '/attendance/manage',
        icon: CalendarCheck,
        badge: 'Quản lý',
        requiredRole: ['admin', 'truongkhoa'],
      },
    ],
  },
  {
    groupId: 'leave_payroll',
    groupTitle: 'Đơn Từ & Lương',
    items: [
      {
        label: 'Quản Lý Nghỉ Phép',
        path: '/leave-requests',
        icon: FileText,
      },
      {
        label: 'Bảng Lương & Thu Nhập',
        path: '/payroll',
        icon: DollarSign,
      },
    ],
  },
  {
    groupId: 'organization',
    groupTitle: 'Quản Trị Tổ Chức',
    items: [
      {
        label: 'Cơ Cấu Tổ Chức (Khoa/PB)',
        path: '/departments',
        icon: Building2,
        requiredRole: ['admin', 'truongkhoa'],
      },
      {
        label: 'Quản Lý Cán Bộ & GV',
        path: '/users',
        icon: Users,
        requiredRole: ['admin', 'truongkhoa'],
      },
      {
        label: 'Danh Mục Ca Làm Việc',
        path: '/shifts',
        icon: Clock,
        requiredRole: ['admin'],
      },
      {
        label: 'Danh Mục Môn Học',
        path: '/subjects',
        icon: BookOpen,
      },
      {
        label: 'Lịch Ngày Nghỉ Lễ',
        path: '/holidays',
        icon: CalendarDays,
      },
    ],
  },
  {
    groupId: 'reports_audit',
    groupTitle: 'Báo Cáo & Kiểm Toán',
    items: [
      {
        label: 'Báo Cáo & Thống Kê',
        path: '/reports/attendance',
        icon: BarChart3,
        requiredRole: ['admin', 'truongkhoa'],
      },
      {
        label: 'Nhật Ký Kiểm Toán',
        path: '/reports/audit',
        icon: Shield,
        requiredRole: ['admin'],
      },
    ],
  },
  {
    groupId: 'system',
    groupTitle: 'Hệ Thống',
    items: [
      {
        label: 'Cài Đặt Hệ Thống',
        path: '/settings',
        icon: Settings,
        requiredRole: ['admin'],
      },
    ],
  },
];

const ROLE_INFO: Record<string, { label: string; badgeClass: string }> = {
  admin: {
    label: 'Quản trị viên',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-100',
  },
  truongkhoa: {
    label: 'Trưởng khoa / Bộ môn',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-100',
  },
  giangvien: {
    label: 'Giảng viên',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  },
  nhanvien: {
    label: 'Cán bộ / Chuyên viên',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
  },
};

function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout, hasRole } = useAuth();
  const roleKey = typeof user?.role === 'object' ? user?.role?.name : user?.role;
  const currentRole = ROLE_INFO[roleKey ?? ''] || { label: 'Cán bộ', badgeClass: 'bg-slate-100 text-slate-700' };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Đã đăng xuất');
    } catch {
      toast.error('Đăng xuất thất bại');
    }
  };

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith('http') || user.avatar.startsWith('/')
      ? user.avatar
      : `/uploads/${user.avatar}`
    : null;

  return (
    <aside
      className={`flex flex-col h-full bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out border-r border-slate-800 select-none ${
        open ? 'w-64' : 'w-[72px]'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 text-white ring-2 ring-white/10">
          <GraduationCap size={22} />
        </div>
        {open && (
          <div className="overflow-hidden animate-fade-in min-w-0">
            <h1 className="text-white font-extrabold text-sm leading-tight tracking-wide truncate">
              QLNS & CHẤM CÔNG
            </h1>
            <p className="text-blue-400 text-[11px] font-medium flex items-center gap-1 truncate">
              <Sparkles size={11} className="text-amber-400 shrink-0" />
              <span>Thị giác máy tính AI</span>
            </p>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto sidebar-scrollbar py-4 px-3 space-y-5">
        {SIDEBAR_GROUPS.map((group) => {
          // Lọc các item mà user có quyền truy cập
          const visibleItems = group.items.filter((item) => {
            if (!item.requiredRole) return true;
            return item.requiredRole.some((r) => hasRole(r));
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupId} className="space-y-1">
              {open && (
                <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  {group.groupTitle}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                      }`
                    }
                    title={!open ? item.label : undefined}
                  >
                    <Icon size={18} className="shrink-0 group-hover:scale-105 transition-transform" />
                    {open && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {open && item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer User Info */}
      <div className="border-t border-slate-800 p-3 bg-slate-950/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 overflow-hidden text-blue-300 font-bold text-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.fullName} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.fullName?.[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>
          {open && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold truncate leading-tight">
                {user?.fullName || 'Người dùng'}
              </p>
              <p className="text-slate-400 text-[11px] truncate leading-tight mt-0.5">
                {currentRole.label}
              </p>
            </div>
          )}
          {open && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function Header({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const navigate = useNavigate();

  const roleKey = typeof user?.role === 'object' ? user?.role?.name : user?.role;
  const currentRole = ROLE_INFO[roleKey ?? ''] || {
    label: 'Cán bộ',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const todayStr = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith('http') || user.avatar.startsWith('/')
      ? user.avatar
      : `/uploads/${user.avatar}`
    : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
          title="Thu gọn / Mở rộng thanh điều hướng"
        >
          <Menu size={20} />
        </button>

        <div className="hidden md:flex flex-col">
          <span className="text-xs font-bold text-slate-800 capitalize leading-snug">
            {todayStr}
          </span>
          <span className="text-[11px] text-slate-400">
            Hệ thống Quản lý Nhân sự & Chấm công Đại học
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${currentRole.badgeClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {currentRole.label}
        </span>

        {/* User Pill Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl hover:bg-slate-100 transition-all border border-slate-200/80 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{user?.fullName?.[0]?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                {user?.fullName || 'Tài khoản'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                {user?.email}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user?.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{user?.fullName?.[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {currentRole.label}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 space-y-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      navigate('/attendance/me');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <UserCheck size={15} className="text-slate-500" />
                    <span>Chấm công của tôi</span>
                  </button>

                  <button
                    onClick={async () => {
                      setShowUserDropdown(false);
                      await logout();
                      toast.success('Đã đăng xuất tài khoản');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-64 relative">
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 z-10 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
          >
            <X size={16} />
          </button>
          <Sidebar open={true} onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar open={sidebarOpen} onClose={() => {}} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => {
            setSidebarOpen((s) => !s);
            setMobileOpen((m) => !m);
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
