import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  Camera,
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
  GraduationCap,
  Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { ThemeToggle } from '../chung/NutChuyenGiaoDien';
import { ModalCaiDatGiaoDien } from '../chung/ModalCaiDatGiaoDien';
import { UserAvatar } from '../chung/AnhDaiDienNguoiDung';
import { hasRole, getRoleLabel } from '../../utils/phanQuyen';
import { attendanceApi, AttendanceHistoryItem } from '../../api/chamCong.api';
import { leaveRequestApi } from '../../api/donNghiPhep.api';
import { thongBaoApi } from '../../api/thongBao.api';
import { useSocketEvent } from '../../api/socket';

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
  roles?: string[];
  excludeRoles?: string[];
}

const SEARCH_ITEMS: QuickSearchItem[] = [
  {
    id: 'public-faculty',
    title: 'Website Giới Thiệu & Danh Bạ Giảng Viên (ĐH Nguyễn Trãi - NTU)',
    category: 'Trang Chức Năng',
    path: '/giang-vien',
    icon: GraduationCap,
    description: 'Website giới thiệu trường, đào tạo, tuyển sinh và danh bạ giảng viên công khai',
  },
  {
    id: 'face-att',
    title: 'Điểm Danh AI Live (Kiosk)',
    category: 'Trang Chức Năng',
    path: '/diem-danh-khuon-mat',
    icon: Camera,
    description: 'Trạm camera điểm danh nhận diện khuôn mặt 512D & GPS Geofence',
  },
  {
    id: 'att-manage',
    title: 'Quản Lý Bảng Chấm Công',
    category: 'Trang Chức Năng',
    path: '/quan-ly-cham-cong',
    icon: Clock,
    description: 'Bảng tổng hợp công tháng, đi muộn, về sớm toàn trường & theo khoa',
    roles: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong', 'tccb', 'ke_toan'],
  },
  {
    id: 'profile',
    title: 'Hồ Sơ Cá Nhân (HRM & Bảo Mật)',
    category: 'Trang Chức Năng',
    path: '/ho-so',
    icon: User,
    description: 'Thông tin nhân sự, chức danh, sinh trắc học Face ID và đổi mật khẩu',
  },
  {
    id: 'att-me',
    title: 'Chấm Công Cá Nhân Của Tôi',
    category: 'Trang Chức Năng',
    path: '/cham-cong-ca-nhan',
    icon: Clock,
    description: 'Lịch sử vào - ra, ngày công cá nhân và gửi đơn giải trình công',
    excludeRoles: ['admin'],
  },
  {
    id: 'users',
    title: 'Danh Sách Cán Bộ & Giảng Viên',
    category: 'Trang Chức Năng',
    path: '/nguoi-dung',
    icon: UsersIcon,
    description: 'Hồ sơ nhân sự, mã cán bộ, học hàm, học vị và ảnh sinh trắc học',
    roles: ['admin', 'bgh', 'tccb', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong'],
  },
  {
    id: 'depts',
    title: 'Cơ Cấu Tổ Chức & Phòng Ban',
    category: 'Trang Chức Năng',
    path: '/phong-ban',
    icon: FolderTree,
    description: 'Cây thư mục phân cấp Khoa đào tạo, Bộ môn và Phòng ban chức năng',
  },
  {
    id: 'schedules',
    title: 'Thời Khóa Biểu & Lịch Giảng Dạy',
    category: 'Trang Chức Năng',
    path: '/lich-trinh',
    icon: Calendar,
    description: 'Lịch phân công giảng dạy tuần, tháng, phòng học và tiết học',
  },
  {
    id: 'leaves',
    title: 'Quản Lý Đơn Xin Nghỉ Phép',
    category: 'Trang Chức Năng',
    path: '/don-nghi-phep',
    icon: FileText,
    description: 'Quy trình gửi đơn và phê duyệt nghỉ phép 2 cấp',
  },
  {
    id: 'settings',
    title: 'Cài Đặt Hệ Thống & Tham Số AI',
    category: 'Trang Chức Năng',
    path: '/cai-dat',
    icon: Settings,
    description: 'Cấu hình ngưỡng nhận diện, Geofence trường học và máy chủ MinIO',
    roles: ['admin'],
  },
];

export const Navbar: React.FC<NavbarProps> = ({ onMobileOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Dropdown & Modal States
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Notifications State (từ GET /api/thong-bao)
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      detail: string;
      time: string;
      path: string;
      type: 'attendance' | 'leave' | 'schedule';
    }>
  >([]);

  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const dropdownGroupRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const lastReadAt = localStorage.getItem('ntu_notif_read_at') || undefined;
      const result = await thongBaoApi.getNotifications(lastReadAt);
      const mapped = result.danh_sach_thong_bao.map((item, idx) => {
        const rawType = String(item.loai || 'cham_cong');
        const type: 'attendance' | 'leave' | 'schedule' = rawType.includes('don')
          ? 'leave'
          : rawType.includes('lich')
          ? 'schedule'
          : 'attendance';
        const defaultPath = type === 'leave' ? '/don-nghi-phep' : type === 'schedule' ? '/lich-trinh' : '/cham-cong-ca-nhan';
        return {
          id: String(item.id || `tb-${idx}`),
          title: item.tieu_de || 'Thông báo hệ thống',
          detail: item.noi_dung || '',
          time: item.thoi_gian
            ? new Date(item.thoi_gian).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
            : '',
          path: item.duong_dan || defaultPath,
          type,
        };
      });
      setNotifications(mapped);
      setUnreadCount(result.so_chua_doc);
    } catch {
      // Bỏ qua lỗi mạng khi tải thông báo nền
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const intervalId = setInterval(loadNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [user, loadNotifications]);

  useSocketEvent('leave:status-changed', loadNotifications);
  useSocketEvent('attendance:new-punch', loadNotifications);
  useSocketEvent('attendance:update', loadNotifications);
  useSocketEvent('security:fraud-alert', loadNotifications);

  // Real-time Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Escape & click outside dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (dropdownGroupRef.current && !dropdownGroupRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

  // Filtered search results (lọc theo quyền truy cập thực tế của user)
  const canManageAttendance = hasRole(user, [
    'admin',
    'bgh',
    'truong_khoa',
    'pho_khoa',
    'truong_bo_mon',
    'pho_bo_mon',
    'truong_phong',
    'pho_phong',
    'tccb',
    'ke_toan',
  ]);
  const roleLabel = getRoleLabel(user?.vai_tro_chinh);

  const filteredSearchItems = SEARCH_ITEMS.filter((item) => {
    if (!hasRole(user, item.roles, item.excludeRoles)) return false;
    if (!searchQuery.trim()) return true;
    const kw = searchQuery.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(kw) ||
      item.description.toLowerCase().includes(kw) ||
      item.category.toLowerCase().includes(kw)
    );
  });

  const handleSelectSearchItem = (path: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/dang-nhap');
  };

  const markAllNotificationsRead = () => {
    try {
      localStorage.setItem('ntu_notif_read_at', new Date().toISOString());
    } catch {
      // ignore storage errors
    }
    setUnreadCount(0);
    toast.success('Đã đánh dấu đã đọc tất cả thông báo');
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* ===================================================================
              LEFT SECTION: MOBILE HAMBURGER + FLUX PILL SEARCH BAR
             =================================================================== */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onMobileOpen}
              className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Simple Search Bar */}
            <div
              ref={searchBoxRef}
              className="hidden sm:flex items-center relative flex-1 min-w-0 max-w-sm lg:max-w-md"
            >
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="Tìm kiếm chức năng..."
                className="h-9 pl-10 pr-8 w-full rounded-xl text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-brand-400 dark:focus:border-brand-600 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Xóa từ khóa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {showSearchDropdown && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-lg max-h-72 overflow-y-auto p-1.5 z-50 text-xs">
                  {filteredSearchItems.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">
                      Không tìm thấy kết quả phù hợp
                    </div>
                  ) : (
                    filteredSearchItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSearchItem(item.path)}
                          className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ===================================================================
              RIGHT SECTION: CLOCK, NEW ACTION CTA, THEME, NOTIFS, USER
             =================================================================== */}
          <div ref={dropdownGroupRef} className="flex items-center gap-2 shrink-0">
            {/* Quick Action Button (Flux Style New Action Button) */}
            <button
              type="button"
              onClick={() => navigate('/diem-danh-khuon-mat')}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs hover:shadow-brand-500/25 transition-all cursor-pointer shrink-0"
              title="Mở trạm điểm danh AI"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>+ Điểm danh</span>
            </button>
            {/* 1. Realtime Digital Clock */}
            <div className="hidden xl:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 text-xs whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {formatTime(currentTime)}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                {formatDate(currentTime)}
              </span>
            </div>

            {/* 2. Liên kết tới Website Giới Thiệu & Danh Bạ Giảng Viên Công Khai */}
            <a
              href="/giang-vien"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              title="Mở Website Giới Thiệu & Danh Bạ Giảng Viên NTU (tab mới)"
            >
              <GraduationCap className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="hidden lg:inline">Website Giảng Viên</span>
              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
            </a>

            {/* 3. Dark / Light Mode Switcher & Appearance Settings Popup Trigger */}
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => {
                  setShowThemeSettings(true);
                  setShowNotifications(false);
                  setShowUserMenu(false);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                title="Tùy chỉnh bảng màu, nền & cỡ chữ giao diện"
                aria-label="Tùy chỉnh giao diện và màu sắc"
              >
                <Palette className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-slate-900 shrink-0" />
              </button>
            </div>

            {/* 4. Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                className="relative w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Thông báo hệ thống"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white rounded-full text-[10px] font-semibold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
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
                        navigate(canManageAttendance ? '/quan-ly-cham-cong' : '/cham-cong-ca-nhan');
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
            <div className="relative pl-2 sm:pl-2.5 border-l border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left whitespace-nowrap"
                title="Tài khoản cá nhân & Tùy chọn"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[145px]">
                    {user?.ho_ten || 'Quản Trị Viên'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[145px] mt-0.5">
                    {user?.ma_can_bo ? `${user.ma_can_bo} • ` : ''}
                    {roleLabel}
                  </div>
                </div>

                <UserAvatar
                  user={user}
                  name={user?.ho_ten || 'Quản Trị Viên'}
                  avatarUrl={user?.anh_dai_dien}
                  staffCode={user?.ma_can_bo || user?.id}
                  size="md"
                  shape="circle"
                />
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
                      navigate('/ho-so');
                    }}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group"
                    title="Nhấn để xem trang Hồ sơ cá nhân chi tiết"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 transition-colors">
                        {user?.ho_ten || 'Quản Trị Viên Hệ Thống'}
                      </p>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user?.email || 'admin@university.edu.vn'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {roleLabel}
                      </span>
                      {user?.ma_can_bo && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {user.ma_can_bo}
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
                        navigate('/ho-so');
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
                    {user?.vai_tro_chinh !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/cham-cong-ca-nhan');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                      >
                        <Clock className="w-4 h-4 text-emerald-500" />
                        Chấm công của tôi
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/lich-trinh');
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
                        navigate('/don-nghi-phep');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-amber-500" />
                      Đơn xin nghỉ phép
                    </button>
                    {user?.vai_tro_chinh === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/cai-dat');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        Cài đặt hệ thống
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowThemeSettings(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                    >
                      <Palette className="w-4 h-4 text-brand-500" />
                      Tùy chỉnh giao diện &amp; màu sắc
                    </button>
                    <a
                      href="/giang-vien"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full px-3 py-2 rounded-xl text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <GraduationCap className="w-4 h-4 text-indigo-500" />
                        Website Giảng Viên NTU
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
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

      {/* Popup Cài Đặt Giao Diện & Màu Sắc */}
      <ModalCaiDatGiaoDien
        isOpen={showThemeSettings}
        onClose={() => setShowThemeSettings(false)}
      />
    </>
  );
};

export default Navbar;
