import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  Search,
  CheckCircle2,
  Camera,
  Shield,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UserRoleLegacy } from '../../types';

interface NavbarProps {
  onMobileOpen: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileOpen }) => {
  const { user, switchDemoRole } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const rolesList: { role: UserRoleLegacy; label: string }[] = [
    { role: 'bgh', label: 'Ban Giám Hiệu (Hiệu Trưởng)' },
    { role: 'admin', label: 'Quản Trị Viên (IT Admin)' },
    { role: 'truong_khoa', label: 'Trưởng Khoa CNTT' },
    { role: 'giang_vien', label: 'Giảng Viên (TS. Bích)' },
    { role: 'nhan_vien', label: 'Chuyên Viên Đào Tạo' },
    { role: 'ke_toan', label: 'Kế Toán Trưởng' },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left Section: Mobile Menu + Breadcrumb / Search */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileOpen}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar with keyboard shortcut hint */}
          <div className="hidden sm:flex items-center relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm cán bộ, ca làm việc, môn học..."
              className="pl-9 pr-14 py-2 w-64 md:w-80 rounded-xl text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-brand-500/50 dark:focus:border-brand-500/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
            />
            <kbd className="absolute right-3 text-[10px] bg-white dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-xs pointer-events-none">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right Section: Realtime Status, ThemeToggle, Role Switcher, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Realtime Clock & Status Indicators */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {formatTime(currentTime)}
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">{formatDate(currentTime)}</span>
          </div>

          {/* AI Camera Live Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-[11px] text-emerald-700 dark:text-emerald-300">
            <Camera className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-medium">Camera AI: Sẵn sàng</span>
          </div>

          {/* Theme Toggle (Dark / Light) */}
          <ThemeToggle />

          {/* Role Switcher Demo Dropdown (Cực tiện cho đồ án) */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
              title="Đổi vai trò để kiểm thử phân quyền giao diện"
            >
              <Shield className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="hidden sm:inline">Vai trò:</span>
              <span className="font-semibold text-brand-600 dark:text-brand-400 uppercase">
                {user?.role || 'BGH'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200/80 dark:border-slate-700 py-1.5 z-50 animate-fade-in"
                onClick={() => setShowRoleMenu(false)}
              >
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Chuyển vai trò thử nghiệm
                </div>
                {rolesList.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => switchDemoRole(r.role)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 ${
                      user?.role === r.role
                        ? 'font-bold text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/30'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{r.label}</span>
                    {user?.role === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Thông báo hệ thống"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
            </button>

            {showNotifications && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200/80 dark:border-slate-700 p-3 z-50 animate-fade-in"
                onClick={() => setShowNotifications(false)}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Thông Báo Gần Đây</span>
                  <span className="text-[10px] text-brand-600 cursor-pointer">Đã đọc tất cả</span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors cursor-pointer">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      Điểm danh thành công ca sáng
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Vừa xong • Check-in InsightFace 512D</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors cursor-pointer">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      Đơn nghỉ phép mới cần phê duyệt
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">10 phút trước • TS. Lê Thị Bích</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar Mini */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-semibold flex items-center justify-center text-xs shadow-sm">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
