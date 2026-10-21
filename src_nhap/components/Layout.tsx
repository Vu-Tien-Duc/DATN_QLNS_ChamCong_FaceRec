import { ReactNode, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  GraduationCap,
  HeartHandshake,
  UserSquare2,
  BarChart3,
  LogOut,
  Menu,
  X,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Wallet,
  Receipt,
  ClipboardCheck,
  FolderOpen,
  Settings,
  ShieldCheck,
  ChevronDown,
  UserPlus,
  Building2,
  Presentation,
  Layers,
  Award,
  Landmark,
  CalendarCheck,
  Newspaper,
  MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Modal } from './Modal';
import { PERMISSIONS } from '../constants/permissions'; // Import hằng số quyền

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  permission?: string; // Bổ sung trường này (optional)
}

interface NavGroup {
  title: string;
  items: NavItem[];
}



// 2. Gán mã quyền cho từng Item
const navGroups: NavGroup[] = [
  {
    title: 'Tổng quan & Truyền thông',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD.VIEW },
      { name: 'Bản tin doanh nghiệp', path: '/newsfeed', icon: Newspaper, permission: PERMISSIONS.POSTS.VIEW },
    ]
  },
  {
    title: 'CRM & Marketing',
    items: [
      { name: 'Marketing & Leads', path: '/leads', icon: Users, permission: PERMISSIONS.LEADS.VIEW },
      { name: 'Lịch hẹn khách hàng', path: '/appointments', icon: Calendar, permission: PERMISSIONS.APPOINTMENTS.VIEW },
      { name: 'Ghi danh & Nhập học', path: '/enrollments', icon: UserCheck, permission: PERMISSIONS.ENROLLMENTS.VIEW },
      { name: 'Chăm sóc khách hàng', path: '/cskh', icon: HeartHandshake, permission: PERMISSIONS.CSKH.VIEW },
      { name: 'Cấu hình Nguồn', path: '/lead-sources', icon: Settings2, permission: PERMISSIONS.LEAD_SOURCES.MANAGE },
    ]
  },
  {
    title: 'Học vụ',
    items: [
      { name: 'Học viên', path: '/students', icon: GraduationCap, permission: PERMISSIONS.STUDENTS.VIEW },
      { name: 'Khóa học', path: '/courses', icon: BookOpen, permission: PERMISSIONS.COURSES.VIEW },
      { name: 'Khung chương trình', path: '/syllabus', icon: Layers, permission: PERMISSIONS.SYLLABUS.VIEW },
      { name: 'Lớp học', path: '/classes', icon: Presentation, permission: PERMISSIONS.CLASSES.VIEW },
      { name: 'Bảng điểm', path: '/grades', icon: Award, permission: PERMISSIONS.GRADES.VIEW },
      { name: 'Lịch giảng dạy', path: '/schedule', icon: Calendar, permission: PERMISSIONS.SCHEDULE.VIEW },
      { name: 'Giảng viên', path: '/teachers', icon: UserSquare2, permission: PERMISSIONS.TEACHERS.VIEW },
      { name: 'Tự chấm công GV', path: '/teacher-self-attendance', icon: CalendarCheck, permission: PERMISSIONS.TEACHER_SELF_ATTENDANCE.VIEW },
      { name: 'Điểm danh', path: '/attendance', icon: ClipboardCheck, permission: PERMISSIONS.ATTENDANCE.VIEW },
      { name: 'Tài liệu', path: '/resources', icon: FolderOpen, permission: PERMISSIONS.RESOURCES.MANAGE },
    ]
  },
  {
    title: 'Tài chính',
    items: [
      { name: 'Thu học phí', path: '/tuition', icon: Wallet, permission: PERMISSIONS.TUITION.VIEW },
      { name: 'Phiếu thu/chi', path: '/transactions', icon: Receipt, permission: PERMISSIONS.TRANSACTIONS.VIEW },
      { name: 'Tài khoản ngân hàng', path: '/bank-accounts', icon: Landmark, permission: PERMISSIONS.TRANSACTIONS.VIEW },
    ]
  },
  // {
  //   title: 'Nhân sự',
  //   items: [
  //     { name: 'Hồ sơ nhân viên', path: '/employees', icon: UserSquare2, permission: PERMISSIONS.EMPLOYEES.VIEW },
  //     { name: 'Lịch làm việc', path: '/work-schedule', icon: Calendar, permission: PERMISSIONS.WORK_SCHEDULE.VIEW },
  //     { name: 'Tài khoản hệ thống', path: '/users', icon: ShieldCheck, permission: PERMISSIONS.USERS.MANAGE },
  //   ]
  // },

  {
    title: 'Nhân sự & Vận hành',
    items: [
      { name: 'Hồ sơ nhân viên', path: '/employees', icon: UserSquare2, permission: PERMISSIONS.EMPLOYEES.VIEW },
      { name: 'Tài khoản hệ thống', path: '/users', icon: ShieldCheck, permission: PERMISSIONS.USERS.MANAGE },
      { name: 'Nhật ký đăng nhập', path: '/login-logs', icon: MapPin, permission: PERMISSIONS.USERS.MANAGE },

      { name: 'Đăng ký lịch làm', path: '/work-schedule', icon: Calendar, permission: PERMISSIONS.WORK_SCHEDULE.VIEW },
      { name: 'Lịch trực Team', path: '/team-schedule', icon: Users, permission: PERMISSIONS.WORK_SCHEDULE.MANAGE },
      { name: 'Chấm công nhân viên', path: '/employee-attendance', icon: UserCheck, permission: PERMISSIONS.EMPLOYEES.VIEW },
      { name: 'Chấm công Lễ tân', path: '/receptionist-attendance', icon: UserCheck, permission: PERMISSIONS.EMPLOYEES.VIEW },
      { name: 'Chấm công (Check-in GPS)', path: '/timekeeping', icon: ClipboardCheck, permission: PERMISSIONS.TIMEKEEPING.VIEW },
      { name: 'Quản lý sự kiện', path: '/events', icon: CalendarCheck, permission: PERMISSIONS.SUPER_ADMIN },
    ]
  },
  {
    title: 'Nhân sự thời vụ',
    items: [
      { name: 'Lịch làm việc của tôi', path: '/shift-worker/my-schedule', icon: Calendar, permission: PERMISSIONS.SHIFT_ATTENDANCE.VIEW },
      { name: 'Check-in / Check-out', path: '/shift-worker/attendance', icon: MapPin, permission: PERMISSIONS.SHIFT_ATTENDANCE.VIEW },
      { name: 'Báo cáo cá nhân', path: '/shift-worker/my-report', icon: BarChart3, permission: PERMISSIONS.SHIFT_ATTENDANCE.VIEW },
      { name: 'Phê duyệt & Quản lý (Admin)', path: '/shift-worker/manage', icon: ShieldCheck, permission: PERMISSIONS.SHIFT_ATTENDANCE.MANAGE },
    ]
  },
  {
    title: 'Báo cáo',
    items: [
      { name: 'Báo cáo tổng hợp', path: '/reports', icon: BarChart3, permission: PERMISSIONS.DASHBOARD.REPORTS_GENERAL },
      { name: 'Báo cáo học viên', path: '/student-report', icon: GraduationCap, permission: PERMISSIONS.DASHBOARD.REPORTS_STUDENT },
      { name: 'Chấm công Giảng viên', path: '/teacher-attendance-report', icon: UserCheck, permission: PERMISSIONS.ATTENDANCE.VIEW },
      { name: 'Bảng Lương & Ca làm', path: '/payroll-report', icon: Wallet, permission: PERMISSIONS.ATTENDANCE.VIEW },
      { name: 'Chi phí Vận hành', path: '/operating-expense-report', icon: Receipt, permission: PERMISSIONS.ATTENDANCE.VIEW },
    ]
  },
  {
    title: 'Cài đặt',
    items: [
      { name: 'Cơ sở & Phòng học', path: '/campuses', icon: Building2, permission: PERMISSIONS.CAMPUSES.MANAGE },
      { name: 'Cấu hình hệ thống', path: '/settings', icon: Settings, permission: PERMISSIONS.SETTINGS.EDIT },
      { name: 'Phân quyền', path: '/permissions', icon: ShieldCheck, permission: PERMISSIONS.PERMISSIONS.MANAGE },
    ]
  },
  {
    title: 'Dự án & Công việc',
    items: [
      { name: 'Dự án', path: '/projects', icon: Layers, permission: PERMISSIONS.PROJECTS.VIEW },
      { name: 'Công việc của tôi', path: '/tasks', icon: ClipboardCheck, permission: PERMISSIONS.TASKS.VIEW },
      { name: 'Phòng ban & Nhóm', path: '/departments', icon: Building2, permission: PERMISSIONS.DEPARTMENTS.VIEW },
    ]
  }
];



const getRoleDisplayName = (user: any): string => {
  if (!user) return 'Chưa đăng nhập';

  const roleNames: string[] = [];

  if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
    user.roles.forEach((r: any) => {
      const name = typeof r === 'object' ? r?.name : r;
      if (name && !roleNames.includes(String(name))) roleNames.push(String(name));
    });
  } else if (user.roleNames && Array.isArray(user.roleNames) && user.roleNames.length > 0) {
    user.roleNames.forEach((name: string) => {
      if (name && !roleNames.includes(String(name))) roleNames.push(String(name));
    });
  } else if (user.role) {
    const name = typeof user.role === 'object' ? user.role?.name : user.role;
    if (name) roleNames.push(String(name));
  }

  if (roleNames.length === 0) return 'Nhân sự';

  const displayList = roleNames.map(rawRole => {
    const roleLower = String(rawRole).toLowerCase().trim();
    switch (roleLower) {
      case 'parent':
      case 'phụ huynh':
        return 'Phụ huynh học viên';
      case 'admin':
      case 'superadmin':
        return 'Quản trị viên (Admin)';
      case 'teacher':
      case 'giảng viên':
        return 'Giảng viên';
      case 'receptionist':
      case 'lễ tân':
        return 'Lễ tân / Tiếp đón';
      case 'counselor':
      case 'sale':
      case 'sales':
        return 'Tư vấn viên (Sale)';
      case 'academic':
      case 'giáo vụ':
        return 'Quản lý Giáo vụ';
      case 'accountant':
      case 'kế toán':
        return 'Kế toán';
      case 'manager':
        return 'Quản lý (Manager)';
      case 'investor':
      case 'shareholder':
      case 'nhà đầu tư':
      case 'cổ đông':
        return 'Nhà đầu tư / Cổ đông';
      default:
        return rawRole;
    }
  });

  return displayList.join(' · ');
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can, loading } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(navGroups.map(g => g.title));

  const filteredNavGroups = useMemo(() => {
    // Nếu đang load hoặc chưa có user, trả về mảng rỗng
    if (loading || !user) return [];

    console.group("🔐 [RBAC Debug] Sidebar Filtering");
    console.log("User:", user.fullName);
    console.log("Role:", user.role?.name || "N/A");
    console.log("Permissions:", user.permissions);

    const filtered = navGroups
      .map(group => {
        const allowedItems = group.items.filter(item => {
          const isParent = user.department === 'parent' || 
            (user.role && (typeof user.role === 'object' ? user.role.name : user.role)?.toLowerCase() === 'parent') ||
            (user.roles && user.roles.some((r: any) => (typeof r === 'object' ? r.name : r)?.toLowerCase() === 'parent'));
          
          if (isParent && (item.path === '/teacher-attendance-report' || item.path === '/payroll-report' || item.path === '/operating-expense-report')) {
            return false;
          }

          // Nếu item không yêu cầu quyền, cho hiện luôn
          if (!item.permission) return true;
          // Sử dụng hàm can để kiểm tra quyền
          const isAllowed = can(item.permission);
          
          if (!isAllowed) {
            console.log(`🚫 Denied: [${group.title} > ${item.name}] - Needs: ${item.permission}`);
          } else {
            console.log(`✅ Allowed: [${group.title} > ${item.name}]`);
          }
          
          return isAllowed;
        }).map(item => {
          const isParent = user.department === 'parent' || 
            (user.role && (typeof user.role === 'object' ? user.role.name : user.role)?.toLowerCase() === 'parent') ||
            (user.roles && user.roles.some((r: any) => (typeof r === 'object' ? r.name : r)?.toLowerCase() === 'parent'));
          
          if (isParent && item.path === '/attendance') {
            return { ...item, name: 'Điểm danh & Lịch học' };
          }
          return item;
        });

        return {
          ...group,
          items: allowedItems
        };
      })
      // Chỉ giữ lại những nhóm có ít nhất 1 item được phép xem
      .filter(group => group.items.length > 0);

    console.groupEnd();
    return filtered;
  }, [user, loading, can]);


  const toggleGroup = (title: string) => {
    setExpandedGroups(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Xác nhận đăng xuất"
      >
        <div className="space-y-6">
          <p className="text-slate-600">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống EduCRM không?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              onClick={confirmLogout}
              className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </Modal>

      {/* Sidebar Desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out relative",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-12 bg-emerald-500 text-white rounded-full p-1 shadow-lg hover:bg-emerald-600 transition-colors z-50"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={cn("p-6 transition-all duration-300", isCollapsed ? "px-4" : "px-6")}>
          <h1 className={cn("font-bold tracking-tight text-emerald-400 transition-all duration-300", isCollapsed ? "text-xl text-center" : "text-2xl")}>
            {isCollapsed ? "EC" : "EduCRM"}
          </h1>
          {!isCollapsed && (
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold animate-in fade-in duration-500">
              Management System
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden sidebar-scrollbar font-sans">
          {filteredNavGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center justify-between w-full px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors group/header"
                >
                  {group.title}
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    expandedGroups.includes(group.title) ? "" : "-rotate-90"
                  )} />
                </button>
              )}

              {(isCollapsed || expandedGroups.includes(group.title)) && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={isCollapsed ? item.name : ""}
                        className={cn(
                          "flex items-center py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group",
                          isCollapsed ? "px-0 justify-center" : "px-4",
                          isActive
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        )}
                      >
                        <Icon className={cn("w-5 h-5 transition-all", isCollapsed ? "" : "mr-3")} />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User Profile Summary */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className={cn("flex items-center mb-2 transition-all duration-300", isCollapsed ? "justify-center" : "px-3 py-2.5")}>
            <div className={cn("rounded-full bg-emerald-500 text-white flex items-center justify-center font-black transition-all shrink-0 shadow-md shadow-emerald-500/20", isCollapsed ? "w-10 h-10 text-sm" : "w-9 h-9 mr-3 text-xs")}>
              {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
                <p className="text-sm font-extrabold text-white truncate leading-tight" title={user?.fullName}>{user?.fullName || 'Người dùng'}</p>
                <div className="mt-1">
                  <span className="inline-block text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30 truncate max-w-full">
                    {getRoleDisplayName(user)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogoutClick}
            title={isCollapsed ? "Đăng xuất" : ""}
            className={cn(
              "flex items-center w-full py-2 text-sm font-medium text-slate-400 rounded-xl hover:bg-slate-800 hover:text-white transition-all",
              isCollapsed ? "justify-center" : "px-3"
            )}
          >
            <LogOut className={cn("w-4 h-4 transition-all text-slate-400", isCollapsed ? "" : "mr-2.5")} />
            {!isCollapsed && <span className="animate-in fade-in duration-300 text-xs font-semibold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header & Content logic... giữ nguyên như cũ */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold text-emerald-400">EduCRM</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900 z-40 pt-16 overflow-y-auto">
          <nav className="p-4 space-y-6">
            {filteredNavGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center px-4 py-3 text-base font-medium rounded-xl transition-all",
                          isActive ? "bg-emerald-500 text-white shadow-lg" : "text-slate-300"
                        )}
                      >
                        <Icon className="w-5 h-5 mr-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
