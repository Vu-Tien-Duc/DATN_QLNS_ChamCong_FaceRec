import React, { useState } from 'react';
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
  GraduationCap,
  BookOpen,
  Sparkles,
  Layers,
  LogOut,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Badge } from '../ui/Badge';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavGroup {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    roles?: string[];
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const userRole = user?.role || 'giang_vien';

  const navGroups: NavGroup[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        { name: 'Bảng Điều Khiển', path: '/', icon: LayoutDashboard },
        { name: 'Điểm Danh AI Live', path: '/face-attendance', icon: Camera, badge: 'Live' },
      ],
    },
    {
      title: 'CHẤM CÔNG & NGHỈ PHÉP',
      items: [
        { name: 'Chấm Công Cá Nhân', path: '/attendance-me', icon: Clock },
        {
          name: 'Quản Lý Điểm Danh',
          path: '/attendance-manage',
          icon: Layers,
          roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa'],
        },
        { name: 'Đơn Nghỉ Phép', path: '/leave-requests', icon: FileText, badge: '2' },
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
          roles: ['admin', 'bgh', 'truong_khoa'],
        },
        {
          name: 'Khoa & Phòng Ban',
          path: '/departments',
          icon: Building2,
          roles: ['admin', 'bgh', 'truong_khoa'],
        },
        { name: 'Danh Mục Môn Học', path: '/subjects', icon: BookOpen },
        { name: 'Bảng Lương 2026', path: '/payroll', icon: DollarSign },
        {
          name: 'Báo Cáo & Thống Kê',
          path: '/reports',
          icon: BarChart3,
          roles: ['admin', 'bgh', 'ke_toan', 'truong_khoa'],
        },
      ],
    },
    {
      title: 'HỆ THỐNG & AI',
      items: [
        {
          name: 'Mẫu Face ID 512D',
          path: '/face-templates',
          icon: Sparkles,
          roles: ['admin', 'bgh'],
        },
        {
          name: 'Ca Làm Việc & Giờ',
          path: '/shifts',
          icon: Clock,
          roles: ['admin', 'bgh'],
        },
        {
          name: 'Nhật Ký Kiểm Toán',
          path: '/audit-logs',
          icon: ShieldCheck,
          roles: ['admin', 'bgh'],
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

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'bgh':
        return 'Ban Giám Hiệu';
      case 'admin':
        return 'Quản Trị Hệ Thống';
      case 'truong_khoa':
        return 'Trưởng Khoa';
      case 'pho_khoa':
        return 'Phó Khoa';
      case 'giang_vien':
        return 'Giảng Viên';
      case 'ke_toan':
        return 'Kế Toán';
      default:
        return 'Cán Bộ Nhân Viên';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 ease-in-out lg:static ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Logo Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                  ĐH CÔNG NGHỆ
                </span>
                <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  FaceID Smart HR
                </span>
              </div>
            )}
          </div>

          {/* Close button for Mobile */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse Toggle for Desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group, gIdx) => {
            // Lọc các item theo quyền của user
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(userRole)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!isCollapsed && (
                  <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
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
                      onClick={onMobileClose}
                      title={isCollapsed ? item.name : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                      } ${isCollapsed ? 'justify-center' : ''}`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-600 rounded-r-full dark:bg-brand-400" />
                      )}

                      <Icon
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                          isActive
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}
                      />

                      {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}

                      {!isCollapsed && item.badge && (
                        <Badge
                          variant={item.badge === 'Live' ? 'danger' : 'brand'}
                          size="sm"
                          dot={item.badge === 'Live'}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-sm">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.fullName || 'Người Dùng'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {getRoleDisplayName(userRole)}
                </p>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
