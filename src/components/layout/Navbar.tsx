import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  CheckCircle2,
  Camera,
  Shield,
  ChevronDown,
  User,
  Clock,
  LogOut,
  Settings,
  Calendar,
  FileText,
  Users as UsersIcon,
  FolderTree,
  Building2,
  Sparkles,
  ExternalLink,
  X,
  ArrowRight,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Portal } from '../ui/Portal';
import { UserRoleLegacy } from '../../types';
import { attendanceApi, AttendanceHistoryItem } from '../../api/attendance.api';
import { leaveRequestApi } from '../../api/leaveRequest.api';

interface NavbarProps {
  onMobileOpen: () => void;
}

interface QuickSearchItem {
  id: string;
  title: string;
  category: 'Trang Chức Năng' | 'Nhân Sự & Đơn Vị';
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SEARCH_ITEMS: QuickSearchItem[] = [
  {
    id: 'face-att',
    title: 'Điểm Danh AI Live (Kiosk)',
    category: 'Trang Chức Năng',
    path: '/face-attendance',
    icon: Camera,
    description: 'Trạm camera điểm danh nhận diện khuôn mặt 512D & GPS Geofence',
  },
  {
    id: 'att-manage',
    title: 'Quản Lý Bảng Chấm Công',
    category: 'Trang Chức Năng',
    path: '/attendance-manage',
    icon: Clock,
    description: 'Bảng tổng hợp công tháng, đi muộn, về sớm toàn trường & theo khoa',
  },
  {
    id: 'profile',
    title: 'Hồ Sơ Cá Nhân (HRM & Bảo Mật)',
    category: 'Trang Chức Năng',
    path: '/profile',
    icon: User,
    description: 'Thông tin nhân sự, chức danh, sinh trắc học Face ID và đổi mật khẩu',
  },
  {
    id: 'att-me',
    title: 'Chấm Công Cá Nhân Của Tôi',
    category: 'Trang Chức Năng',
    path: '/attendance-me',
    icon: Clock,
    description: 'Lịch sử vào - ra, ngày công cá nhân và gửi đơn giải trình công',
  },
  {
    id: 'users',
    title: 'Danh Sách Cán Bộ & Giảng Viên',
    category: 'Trang Chức Năng',
    path: '/users',
    icon: UsersIcon,
    description: 'Hồ sơ nhân sự, mã cán bộ, học hàm, học vị và ảnh sinh trắc học',
  },
  {
    id: 'depts',
    title: 'Cơ Cấu Tổ Chức & Phòng Ban',
    category: 'Trang Chức Năng',
    path: '/departments',
    icon: FolderTree,
    description: 'Cây thư mục phân cấp Khoa đào tạo, Bộ môn và Phòng ban chức năng',
  },
  {
    id: 'schedules',
    title: 'Thời Khóa Biểu & Lịch Giảng Dạy',
    category: 'Trang Chức Năng',
    path: '/schedules',
    icon: Calendar,
    description: 'Lịch phân công giảng dạy tuần, tháng, phòng học và tiết học',
  },
  {
    id: 'leaves',
    title: 'Quản Lý Đơn Xin Nghỉ Phép',
    category: 'Trang Chức Năng',
    path: '/leave-requests',
    icon: FileText,
    description: 'Quy trình gửi đơn và phê duyệt nghỉ phép 2 cấp',
  },
  {
    id: 'settings',
    title: 'Cài Đặt Hệ Thống & Tham Số AI',
    category: 'Trang Chức Năng',
    path: '/settings',
    icon: Settings,
    description: 'Cấu hình ngưỡng nhận diện, Geofence trường học và máy chủ MinIO',
  },
];

export const Navbar: React.FC<NavbarProps> = ({ onMobileOpen }) => {
  const navigate = useNavigate();
  const { user, switchDemoRole, logout } = useAuthStore();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Dropdown & Modal States
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [switchingRole, setSwitchingRole] = useState(false);

  // Dynamic Notifications State
  const [unreadCount, setUnreadCount] = useState(2);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      detail: string;
      time: string;
      path: string;
      type: 'attendance' | 'leave' | 'schedule';
    }>
  >([
    {
      id: 'notif-1',
      title: 'Điểm danh Face ID thành công',
      detail: 'Hệ thống đã ghi nhận check-in ca sáng (07:12:05)',
      time: 'Vừa xong',
      path: '/attendance-me',
      type: 'attendance',
    },
    {
      id: 'notif-2',
      title: 'Đơn xin nghỉ phép cần duyệt',
      detail: 'TS. Lê Thị Bích gửi đơn nghỉ phép 1 ngày',
      time: '15 phút trước',
      path: '/leave-requests',
      type: 'leave',
    },
    {
      id: 'notif-3',
      title: 'Lịch giảng dạy hôm nay',
      detail: 'Học phần Lập trình Web tại Phòng 402 lúc 13:30',
      time: '1 giờ trước',
      path: '/schedules',
      type: 'schedule',
    },
  ]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut listener for Global Search (Cmd+K / Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowRoleMenu(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when search modal opens
  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [showSearchModal]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const rolesList: { role: UserRoleLegacy; label: string; sub: string }[] = [
    { role: 'bgh', label: 'Ban Giám Hiệu', sub: 'GS. TS. Nguyễn Văn An (Hiệu Trưởng)' },
    { role: 'admin', label: 'Quản Trị Viên (IT Admin)', sub: 'Toàn quyền cấu hình hệ thống' },
    { role: 'truong_khoa', label: 'Trưởng Khoa CNTT', sub: 'PGS. TS. Lê Hoàng Nam' },
    { role: 'giang_vien', label: 'Giảng Viên Chuyên Môn', sub: 'TS. Trần Thị Bích (Bộ môn KTPM)' },
    { role: 'nhan_vien', label: 'Chuyên Viên Phòng Ban', sub: 'Đỗ Thu Hà (Phòng Đào Tạo)' },
  ];

  // Filtered search results
  const filteredSearchItems = SEARCH_ITEMS.filter((item) => {
    if (!searchQuery.trim()) return true;
    const kw = searchQuery.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(kw) ||
      item.description.toLowerCase().includes(kw) ||
      item.category.toLowerCase().includes(kw)
    );
  });

  const handleSelectSearchItem = (path: string) => {
    setShowSearchModal(false);
    navigate(path);
  };

  const handleRoleChange = async (role: UserRoleLegacy) => {
    setSwitchingRole(true);
    setShowRoleMenu(false);
    try {
      await switchDemoRole(role);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/login');
  };

  const markAllNotificationsRead = () => {
    setUnreadCount(0);
    toast.success('Đã đánh dấu đã đọc tất cả thông báo');
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* ===================================================================
              LEFT SECTION: MOBILE HAMBURGER + GLOBAL SEARCH BAR (COMMAND PALETTE)
             =================================================================== */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMobileOpen}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Interactive Search Bar Trigger */}
            <div
              onClick={() => setShowSearchModal(true)}
              className="hidden sm:flex items-center relative cursor-pointer group"
              title="Nhấn để mở hộp tìm kiếm nhanh (Ctrl+K / ⌘K)"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-brand-500 absolute left-3.5 pointer-events-none transition-colors" />
              <input
                type="text"
                readOnly
                placeholder="Tìm kiếm cán bộ, ca làm việc, môn học..."
                className="pl-9 pr-14 py-2 w-64 md:w-80 rounded-xl text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 group-hover:border-brand-500/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 cursor-pointer focus:outline-none transition-all shadow-2xs"
              />
              <kbd className="absolute right-3 text-[10px] bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-2xs group-hover:border-brand-500/50 transition-colors pointer-events-none">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* ===================================================================
              RIGHT SECTION: CLOCK, AI CAMERA LIVE PILL, THEME, ROLE, NOTIFS, USER
             =================================================================== */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 1. Realtime Digital Clock */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs shadow-2xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {formatTime(currentTime)}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                {formatDate(currentTime)}
              </span>
            </div>

            {/* 2. AI Camera Live Status Pill (Interactive Click -> Go to Face Attendance) */}
            <button
              type="button"
              onClick={() => navigate('/face-attendance')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:shadow-xs transition-all active:scale-95"
              title="Nhấp để vào màn hình Trạm Điểm Danh AI Trực Tiếp (/face-attendance)"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Camera AI: Sẵn sàng</span>
              <span className="sm:hidden">AI Live</span>
            </button>

            {/* 3. Dark / Light Mode Switcher */}
            <ThemeToggle />

            {/* 4. Role Switcher Dropdown (Kiểm thử phân quyền RBAC CSDL v2.5) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowRoleMenu(!showRoleMenu);
                  setShowNotifications(false);
                  setShowUserMenu(false);
                }}
                disabled={switchingRole}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors shadow-2xs"
                title="Chuyển đổi vai trò để kiểm thử phân quyền giao diện"
              >
                <Shield className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-normal">
                  Vai trò:
                </span>
                <span className="font-bold text-brand-600 dark:text-brand-400 uppercase">
                  {user?.role ? user.role.toUpperCase() : 'ADMIN'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showRoleMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200/80 dark:border-slate-700 py-2 z-50 animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-700/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Chuyển Vai Trò Kiểm Thử</span>
                    <span className="text-brand-600 font-mono">RBAC v2.5</span>
                  </div>
                  <div className="p-1 space-y-0.5">
                    {rolesList.map((r) => {
                      const isActive = (user?.role || '').toLowerCase() === r.role.toLowerCase();
                      return (
                        <button
                          key={r.role}
                          type="button"
                          onClick={() => handleRoleChange(r.role)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            isActive
                              ? 'font-bold text-brand-600 dark:text-brand-400 bg-brand-50/80 dark:bg-brand-950/50'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{r.label}</p>
                            <p className="text-[10px] text-slate-400">{r.sub}</p>
                          </div>
                          {isActive && (
                            <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowRoleMenu(false);
                  setShowUserMenu(false);
                }}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Thông báo hệ thống"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200/80 dark:border-slate-700 p-3 z-50 animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span>Thông Báo Hoạt Động</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-[10px]">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                      >
                        Đã đọc tất cả
                      </button>
                    )}
                  </div>

                  <div className="py-2 space-y-1.5 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(n.path);
                        }}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors cursor-pointer flex items-start gap-2.5"
                      >
                        <div
                          className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                            n.type === 'attendance'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                              : n.type === 'leave'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                              : 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400'
                          }`}
                        >
                          {n.type === 'attendance' ? (
                            <Camera className="w-3.5 h-3.5" />
                          ) : n.type === 'leave' ? (
                            <FileText className="w-3.5 h-3.5" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {n.detail}
                          </p>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {n.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/attendance-manage');
                      }}
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                    >
                      Xem toàn bộ lịch sử điểm danh <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. User Profile Dropdown Menu */}
            <div className="relative pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowRoleMenu(false);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                title="Tài khoản cá nhân & Tùy chọn"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[140px]">
                    {user?.fullName || 'Quản Trị Viên'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px]">
                    {user?.staffCode ? `${user.staffCode} • ` : ''}
                    {user?.role ? user.role.toUpperCase() : 'ADMIN'}
                  </div>
                </div>

                {user?.avatar ? (
                  <img
                    src={
                      user.avatar.startsWith('http') || user.avatar.startsWith('/api/')
                        ? user.avatar
                        : `/api/upload/file/${user.avatar}`
                    }
                    alt={user?.fullName || 'User'}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-brand-500/30 shadow-xs"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-linear-to-tr from-brand-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 ring-brand-500/20">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
              </button>

              {/* User Menu Popup */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200/80 dark:border-slate-700 p-2 z-50 animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* User Profile Header (Click to view Profile) */}
                  <div
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/profile');
                    }}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group"
                    title="Nhấn để xem trang Hồ sơ cá nhân chi tiết"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 transition-colors">
                        {user?.fullName || 'Quản Trị Viên Hệ Thống'}
                      </p>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user?.email || 'admin@university.edu.vn'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {user?.role ? user.role.toUpperCase() : 'ADMIN'}
                      </span>
                      {user?.staffCode && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {user.staffCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2.5 font-semibold text-brand-600 dark:text-brand-400">
                        <User className="w-4 h-4 text-brand-500" />
                        Hồ sơ cá nhân
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-bold">
                        HRM
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/attendance-me');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-emerald-500" />
                      Chấm công của tôi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/schedules');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      Lịch giảng dạy & Công tác
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/leave-requests');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-amber-500" />
                      Đơn xin nghỉ phép
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/settings');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        Cài đặt hệ thống
                      </button>
                    )}
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-700/80">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-3 py-2 rounded-xl text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors text-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất tài khoản
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          GLOBAL SEARCH COMMAND PALETTE MODAL (SPOTLIGHT ⌘K / CTRL+K)
         ========================================================================= */}
      {showSearchModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <Search className="w-5 h-5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm trang chức năng, cán bộ, môn học, ca dạy..."
                className="w-full text-sm font-medium bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Results List */}
            <div className="p-2 max-h-80 overflow-y-auto space-y-1 text-xs">
              {filteredSearchItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Không tìm thấy kết quả nào phù hợp với từ khóa "{searchQuery}"
                </div>
              ) : (
                filteredSearchItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSearchItem(item.path)}
                      className="p-3 rounded-2xl hover:bg-brand-50/70 dark:hover:bg-brand-950/40 hover:border-brand-300 dark:hover:border-brand-700/60 border border-transparent cursor-pointer flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-brand-600 group-hover:text-white transition-colors flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Keyboard Hints */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Điều hướng nhanh toàn hệ thống</span>
              <div className="flex items-center gap-2">
                <span>Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-[10px]">ESC</kbd> để đóng</span>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
};

export default Navbar;
