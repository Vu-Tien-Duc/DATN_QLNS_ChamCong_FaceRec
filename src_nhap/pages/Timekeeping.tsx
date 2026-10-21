import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import {
    Clock, LogIn, LogOut, Calendar,
    Loader2, CheckCircle2, RefreshCcw, Users, User,
    ShieldCheck, Filter, Search, Eye, AlertCircle,
    X, MapPin, Phone, Mail, ChevronLeft, ChevronRight,
    TrendingUp, Award, Building2, BarChart3
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuthStore } from '../store/useAuthStore';
import { FaceAttendanceScannerModal } from '../components/FaceAttendanceScannerModal';

// Helper map phòng ban nhân sự
const DEPT_MAP: Record<string, string> = {
    sales: 'Kinh doanh',
    training: 'Đào tạo',
    accounting: 'Kế toán',
    marketing: 'Marketing',
    operation: 'Vận hành',
    'boad of director': 'Ban giám đốc',
    'board of director': 'Ban giám đốc',
    'board of directors': 'Ban giám đốc',
    teacher: 'Giảng viên',
    parent: 'Phụ huynh'
};

// Helper nhận diện tài khoản là Học viên (Student) để bỏ qua trong bảng chấm công công ty
export const isStudentUser = (user: any): boolean => {
    if (!user) return false;

    // 1. Kiểm tra phòng ban
    const dept = String(user.department || '').toLowerCase().trim();
    if (dept === 'student' || dept.includes('học viên') || dept.includes('hoc vien')) {
        return true;
    }

    // 2. Kiểm tra vai trò đơn (role)
    const singleRoleName = typeof user.role === 'object' ? (user.role?.name || '') : String(user.role || '');
    const sRoleLower = String(singleRoleName).toLowerCase().trim();
    if (sRoleLower.includes('student') || sRoleLower.includes('học viên') || sRoleLower.includes('hoc vien')) {
        return true;
    }

    // 3. Kiểm tra danh sách roles
    if (Array.isArray(user.roles)) {
        const hasStudent = user.roles.some((r: any) => {
            const name = typeof r === 'object' ? (r?.name || '') : String(r || '');
            const itemLower = name.toLowerCase().trim();
            return itemLower.includes('student') || itemLower.includes('học viên') || itemLower.includes('hoc vien');
        });
        if (hasStudent) return true;
    }

    // 4. Kiểm tra danh sách roleNames
    if (Array.isArray(user.roleNames)) {
        const hasStudent = user.roleNames.some((r: any) => {
            const itemLower = String(r || '').toLowerCase().trim();
            return itemLower.includes('student') || itemLower.includes('học viên') || itemLower.includes('hoc vien');
        });
        if (hasStudent) return true;
    }

    return false;
};

// Component Avatar thông minh với icon mặc định
function StaffAvatar({
    avatar,
    name,
    className = "w-10 h-10 rounded-xl",
    iconSize = "w-5 h-5"
}: {
    avatar?: string;
    name?: string;
    className?: string;
    iconSize?: string;
}) {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [avatar]);

    const getAvatarUrl = (av?: string) => {
        if (!av) return '';
        if (av.startsWith('http://') || av.startsWith('https://') || av.startsWith('data:')) return av;
        if (av.startsWith('/')) return av;
        if (/^[0-9a-fA-F]{24}$/.test(av)) return `/api/images/${av}`;
        return `/uploads/${av}`;
    };

    const url = getAvatarUrl(avatar);

    return (
        <div className={`relative shrink-0 ${className}`}>
            {url && !hasError ? (
                <img
                    src={url}
                    alt={name || 'Avatar'}
                    onError={() => setHasError(true)}
                    className="w-full h-full object-cover"
                    style={{ borderRadius: 'inherit' }}
                />
            ) : (
                <div
                    className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/70 border border-slate-200/80 text-slate-400 shadow-inner"
                    style={{ borderRadius: 'inherit' }}
                >
                    <User className={`${iconSize} stroke-[1.8] text-slate-400`} />
                </div>
            )}
        </div>
    );
}

// Helper tính khoảng thời gian làm việc giữa in và out
const calculateDuration = (checkInStr?: string, checkOutStr?: string) => {
    if (!checkInStr) return '--';
    if (!checkOutStr) return 'Đang trong ca';
    const inDate = new Date(checkInStr).getTime();
    const outDate = new Date(checkOutStr).getTime();
    if (outDate <= inDate) return '0h 0p';
    const diffMs = outDate - inDate;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}p`;
};

// Helper so khớp ngày linh hoạt hỗ trợ múi giờ
const isMatchDate = (dateVal: any, targetISO: string) => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    const local = d.toLocaleDateString('en-CA');
    if (local === targetISO) return true;
    try {
        const iso = d.toISOString().slice(0, 10);
        if (iso === targetISO) return true;
    } catch (_) {}
    return false;
};

export default function Timekeeping() {
    const { user, hasRole, can } = useAuthStore();

    // Xác định quyền Quản trị / Lãnh đạo
    const isAdmin = useMemo(() => {
        const roleRaw: any = user?.role;
        const roleStr = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : (roleRaw?.name?.toLowerCase() || '');
        const roleArrayNames = (user?.roles || []).map((r: any) => (typeof r === 'object' ? r?.name : String(r))).filter(Boolean).map((s: string) => s.toLowerCase());
        const roleNamesList = (user?.roleNames || []).map((r: any) => String(r).toLowerCase());
        const allRoleNames = [roleStr, ...roleArrayNames, ...roleNamesList];

        const hasAdminRoleName = allRoleNames.some(r => 
            r.includes('admin') || 
            r.includes('director') || 
            r.includes('manager') || 
            r.includes('quản trị') || 
            r.includes('giám đốc') || 
            r.includes('trưởng phòng')
        );

        return (
            hasRole('admin') ||
            hasRole('director') ||
            hasRole('manager') ||
            hasRole('quản trị viên') ||
            hasRole('quản trị') ||
            hasRole('giám đốc') ||
            can('timekeeping.manage') ||
            can('work-schedule.manage') ||
            user?.permissions?.includes('all') ||
            user?.permissions?.includes('*') ||
            hasAdminRoleName
        );
    }, [user, hasRole, can]);

    // Tab chuyển đổi (Cá nhân hoặc Quản lý)
    const [activeTab, setActiveTab] = useState<'personal' | 'admin'>('personal');

    // State phần Cá nhân
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayRecord, setTodayRecord] = useState<any>(null);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    const [faceModalMode, setFaceModalMode] = useState<'check-in' | 'check-out' | null>(null);
    const [isUserFaceRegistered, setIsUserFaceRegistered] = useState<boolean | null>(null);

    // Kiểm tra trạng thái đã đăng ký khuôn mặt của tài khoản hiện tại
    useEffect(() => {
        let isCancelled = false;
        const checkFaceRegistration = async () => {
            if (!user?._id) return;
            try {
                const res = await apiClient.get(`/face/registration-status/${user._id}`);
                if (isCancelled) return;
                if (res.data?.success) {
                    setIsUserFaceRegistered(Boolean(res.data.isRegistered));
                    return;
                }
            } catch (_) {}
            if (isCancelled) return;
            setIsUserFaceRegistered(Boolean(user?.isFaceRegistered || (user as any)?.facePhoto));
        };
        checkFaceRegistration();
        return () => { isCancelled = true; };
    }, [user?._id, user?.isFaceRegistered]);

    // Xử lý mở Modal Chấm công bằng khuôn mặt (Chỉ cho phép nếu tài khoản đã đăng ký khuôn mặt)
    const handleStartFaceAttendance = async (mode: 'check-in' | 'check-out') => {
        if (isUserFaceRegistered === false) {
            toast.error('Tài khoản của bạn chưa đăng ký khuôn mặt! Vui lòng đăng ký khuôn mặt trước khi điểm danh.', {
                duration: 4500,
                icon: '⚠️'
            });
            return;
        }

        try {
            setActionLoading(true);
            const empId = user?._id;
            const res = await apiClient.get(`/face/registration-status${empId ? `/${empId}` : ''}`);
            if (res.data?.success && res.data.isRegistered === false) {
                setIsUserFaceRegistered(false);
                toast.error('Tài khoản của bạn chưa đăng ký khuôn mặt! Vui lòng đăng ký khuôn mặt trước khi điểm danh.', {
                    duration: 4500,
                    icon: '⚠️'
                });
                return;
            }
            setIsUserFaceRegistered(true);
        } catch (_) {
            if (!user?.isFaceRegistered && !(user as any)?.facePhoto) {
                setIsUserFaceRegistered(false);
                toast.error('Tài khoản của bạn chưa đăng ký khuôn mặt! Vui lòng đăng ký khuôn mặt trước khi điểm danh.', {
                    duration: 4500,
                    icon: '⚠️'
                });
                return;
            }
        } finally {
            setActionLoading(false);
        }

        setFaceModalMode(mode);
    };

    // State phần Quản lý (Admin)
    const [adminSubTab, setAdminSubTab] = useState<'daily' | 'monthly'>('daily');
    const [adminDailyDate, setAdminDailyDate] = useState(new Date().toISOString().slice(0, 10));
    const [adminMonth, setAdminMonth] = useState(new Date().toISOString().slice(0, 7));
    const [allStaff, setAllStaff] = useState<any[]>([]);
    const [adminLogs, setAdminLogs] = useState<any[]>([]);
    const [adminLoading, setAdminLoading] = useState(false);

    // Bộ lọc admin
    const [adminSearch, setAdminSearch] = useState('');
    const [adminDeptFilter, setAdminDeptFilter] = useState('all');
    const [adminStatusFilter, setAdminStatusFilter] = useState('all');

    // Modal xem chi tiết lịch sử 1 nhân sự theo tháng
    const [selectedStaffForDetail, setSelectedStaffForDetail] = useState<any>(null);

    // 1. Cập nhật đồng hồ thời gian thực
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 2. Tải dữ liệu cá nhân
    const fetchPersonalLogs = useCallback(async () => {
        setLoading(true);
        try {
            const start = `${filterMonth}-01`;
            const todayISO = new Date().toLocaleDateString('en-CA');

            // Chỉ lấy dữ liệu chấm công của chính tài khoản hiện tại (staffId=me)
            const resLogs = await apiClient.get(`/timekeeping/history?startDate=${start}&staffId=me`);
            if (resLogs.data.success) {
                const rawLogs = resLogs.data.data || [];
                setLogs(rawLogs);

                // Tìm và tổng hợp bản ghi của ngày hôm nay (giờ vào sớm nhất, giờ ra muộn nhất)
                const todayLogs = rawLogs.filter(
                    (l: any) => new Date(l.date).toLocaleDateString('en-CA') === todayISO
                );

                if (todayLogs.length > 0) {
                    let earliestIn = todayLogs[0].checkIn;
                    let latestOut = todayLogs[0].checkOut;
                    let combinedStatus = todayLogs[0].status;

                    for (const tl of todayLogs) {
                        if (tl.checkIn && (!earliestIn || new Date(tl.checkIn) < new Date(earliestIn))) {
                            earliestIn = tl.checkIn;
                        }
                        if (tl.checkOut && (!latestOut || new Date(tl.checkOut) > new Date(latestOut))) {
                            latestOut = tl.checkOut;
                        }
                        if (tl.status === 'Normal') combinedStatus = 'Normal';
                    }

                    setTodayRecord({
                        ...todayLogs[0],
                        checkIn: earliestIn,
                        checkOut: latestOut,
                        status: combinedStatus
                    });
                } else {
                    setTodayRecord(null);
                }
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu chấm công:", error);
            toast.error("Không thể tải dữ liệu chấm công cá nhân");
        } finally {
            setLoading(false);
        }
    }, [filterMonth]);

    useEffect(() => {
        fetchPersonalLogs();
    }, [fetchPersonalLogs]);

    // 3. Tải dữ liệu Admin (Toàn bộ nhân sự & logs tháng của công ty)
    const fetchAdminData = useCallback(async () => {
        if (!isAdmin) return;
        setAdminLoading(true);
        try {
            const startMonth = `${adminMonth}-01`;
            const [y, m] = adminMonth.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const endMonth = `${adminMonth}-${String(lastDay).padStart(2, '0')}`;

            const [resStaffResult, resLogsResult] = await Promise.allSettled([
                apiClient.get('/users'),
                apiClient.get(`/timekeeping/history?startDate=${startMonth}&endDate=${endMonth}&excludeStudents=true`)
            ]);

            if (resStaffResult.status === 'fulfilled') {
                const rawStaff = resStaffResult.value.data;
                const staffList = Array.isArray(rawStaff?.data) ? rawStaff.data : Array.isArray(rawStaff) ? rawStaff : [];
                // Bỏ qua các bạn là Học viên
                const nonStudentStaff = staffList.filter((s: any) => !isStudentUser(s));
                setAllStaff(nonStudentStaff);
            } else {
                console.warn("Could not fetch users list:", resStaffResult.reason);
            }

            if (resLogsResult.status === 'fulfilled') {
                const rawLogs = resLogsResult.value.data;
                const logList = Array.isArray(rawLogs?.data) ? rawLogs.data : Array.isArray(rawLogs) ? rawLogs : [];
                // Bỏ qua các log điểm danh của Học viên
                const nonStudentLogs = logList.filter((l: any) => !isStudentUser(l.staff));
                setAdminLogs(nonStudentLogs);
            } else {
                console.error("Could not fetch timekeeping history:", resLogsResult.reason);
                toast.error("Không thể tải lịch sử chấm công");
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu quản trị chấm công:", error);
            toast.error("Lỗi tải dữ liệu quản trị chấm công");
        } finally {
            setAdminLoading(false);
        }
    }, [isAdmin, adminMonth]);

    useEffect(() => {
        if (isAdmin && activeTab === 'admin') {
            fetchAdminData();
        }
    }, [isAdmin, activeTab, fetchAdminData]);

    // Thay đổi ngày xem Daily: đồng bộ tự động sang tháng tương ứng nếu khác tháng
    const handleDailyDateChange = (newDate: string) => {
        setAdminDailyDate(newDate);
        const dateMonth = newDate.slice(0, 7);
        if (dateMonth !== adminMonth) {
            setAdminMonth(dateMonth);
        }
    };

    // 4. Xử lý Check-in / Check-out cá nhân
    const handleTimekeepingAction = async (actionType?: 'check-in' | 'check-out') => {
        const type = actionType || (!todayRecord?.checkIn ? 'check-in' : 'check-out');

        setActionLoading(true);
        try {
            const res = await apiClient.post(`/timekeeping/${type}`);
            if (res.data.success) {
                if (type === 'check-in') {
                    toast.success(res.data.message || "Check-in thành công (Giữ giờ vào sớm nhất)!");
                } else {
                    toast.success(
                        todayRecord?.checkOut
                            ? "Đã cập nhật giờ Check-out lần cuối cùng thành công!"
                            : "Tạm biệt! Check-out thành công."
                    );
                }
                await fetchPersonalLogs();
                if (isAdmin) fetchAdminData();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Thao tác thất bại");
        } finally {
            setActionLoading(false);
        }
    };

    // ── XỬ LÝ DỮ LIỆU ĐIỂM DANH TRONG NGÀY (DAILY VIEW) ────────────────────────
    const dailyAttendanceData = useMemo(() => {
        // Lấy nguồn danh sách nhân sự (ưu tiên allStaff, fallback trích xuất từ adminLogs, loại bỏ học viên)
        const staffSource = (allStaff.length > 0 ? allStaff : (() => {
            const map = new Map<string, any>();
            adminLogs.forEach(l => {
                if (l.staff && typeof l.staff === 'object' && l.staff._id) {
                    if (!isStudentUser(l.staff)) {
                        map.set(String(l.staff._id), l.staff);
                    }
                }
            });
            return Array.from(map.values());
        })()).filter((s: any) => !isStudentUser(s));

        if (!staffSource.length) return [];

        return staffSource.map(staff => {
            // Tìm log của nhân viên đó trong ngày đang chọn
            const logToday = adminLogs.find(l => {
                const sId = typeof l.staff === 'object' ? l.staff?._id : l.staff;
                if (String(sId) !== String(staff._id)) return false;
                return isMatchDate(l.date, adminDailyDate) || isMatchDate(l.checkIn, adminDailyDate);
            });

            return {
                staff,
                log: logToday || null,
                hasCheckedIn: !!logToday?.checkIn,
                checkIn: logToday?.checkIn || null,
                checkOut: logToday?.checkOut || null,
                status: logToday ? logToday.status : 'NotCheckedIn',
                duration: logToday ? calculateDuration(logToday.checkIn, logToday.checkOut) : '--'
            };
        });
    }, [allStaff, adminLogs, adminDailyDate]);

    // Lọc theo bộ tìm kiếm & phòng ban cho Daily view
    const filteredDailyData = useMemo(() => {
        return dailyAttendanceData.filter(item => {
            const { staff, status } = item;
            // 1. Text Search
            if (adminSearch.trim()) {
                const q = adminSearch.toLowerCase().trim();
                const matchName = staff.fullName?.toLowerCase().includes(q);
                const matchEmail = staff.email?.toLowerCase().includes(q);
                const matchPhone = staff.phone?.toLowerCase().includes(q);
                if (!matchName && !matchEmail && !matchPhone) return false;
            }
            // 2. Department
            if (adminDeptFilter !== 'all' && staff.department !== adminDeptFilter) {
                return false;
            }
            // 3. Status filter
            if (adminStatusFilter !== 'all') {
                if (adminStatusFilter === 'checkedIn' && !item.hasCheckedIn) return false;
                if (adminStatusFilter === 'notCheckedIn' && item.hasCheckedIn) return false;
                if (adminStatusFilter === 'late' && status !== 'Late') return false;
                if (adminStatusFilter === 'earlyLeave' && status !== 'Early-Leave') return false;
            }
            return true;
        });
    }, [dailyAttendanceData, adminSearch, adminDeptFilter, adminStatusFilter]);

    // KPI thống kê ngày được chọn
    const dailyStats = useMemo(() => {
        const total = dailyAttendanceData.length;
        const checkedInCount = dailyAttendanceData.filter(d => d.hasCheckedIn).length;
        const notCheckedInCount = total - checkedInCount;
        const lateCount = dailyAttendanceData.filter(d => d.status === 'Late').length;
        const earlyLeaveCount = dailyAttendanceData.filter(d => d.status === 'Early-Leave').length;
        return { total, checkedInCount, notCheckedInCount, lateCount, earlyLeaveCount };
    }, [dailyAttendanceData]);

    // ── XỬ LÝ DỮ LIỆU TỔNG HỢP THEO THÁNG TOÀN CÔNG TY (MONTHLY VIEW) ─────────
    const monthlySummaryData = useMemo(() => {
        const staffSource = (allStaff.length > 0 ? allStaff : (() => {
            const map = new Map<string, any>();
            adminLogs.forEach(l => {
                if (l.staff && typeof l.staff === 'object' && l.staff._id) {
                    if (!isStudentUser(l.staff)) {
                        map.set(String(l.staff._id), l.staff);
                    }
                }
            });
            return Array.from(map.values());
        })()).filter((s: any) => !isStudentUser(s));

        if (!staffSource.length) return [];

        return staffSource.map(staff => {
            // Lấy tất cả các ca chấm công của nhân viên này trong tháng
            const staffMonthLogs = adminLogs.filter(l => {
                const sId = typeof l.staff === 'object' ? l.staff?._id : l.staff;
                return String(sId) === String(staff._id);
            });

            const totalCheckIns = staffMonthLogs.filter(l => l.checkIn).length;
            const onTimeCount = staffMonthLogs.filter(l => l.status === 'Normal').length;
            const lateCount = staffMonthLogs.filter(l => l.status === 'Late').length;
            const earlyLeaveCount = staffMonthLogs.filter(l => l.status === 'Early-Leave').length;

            return {
                staff,
                logs: staffMonthLogs,
                totalCheckIns, // Số ca/ngày check-in
                onTimeCount,
                lateCount,
                earlyLeaveCount,
                attendanceRate: totalCheckIns > 0 ? Math.round((onTimeCount / totalCheckIns) * 100) : 0
            };
        });
    }, [allStaff, adminLogs]);

    // Lọc cho bảng monthly
    const filteredMonthlyData = useMemo(() => {
        return monthlySummaryData.filter(item => {
            const { staff } = item;
            if (adminSearch.trim()) {
                const q = adminSearch.toLowerCase().trim();
                const matchName = staff.fullName?.toLowerCase().includes(q);
                const matchEmail = staff.email?.toLowerCase().includes(q);
                if (!matchName && !matchEmail) return false;
            }
            if (adminDeptFilter !== 'all' && staff.department !== adminDeptFilter) {
                return false;
            }
            return true;
        });
    }, [monthlySummaryData, adminSearch, adminDeptFilter]);

    // Bảng công cá nhân: gộp nhóm theo ngày để đảm bảo mỗi ngày luôn chỉ có DUY NHẤT 1 dòng (vào sớm nhất, ra cuối cùng)
    const personalDisplayLogs = useMemo(() => {
        const dayMap = new Map<string, any>();

        logs.forEach((item: any) => {
            if (!item || !item.date) return;
            const dayKey = new Date(item.date).toLocaleDateString('en-CA');

            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, { ...item });
            } else {
                const existing = dayMap.get(dayKey);
                // Giờ vào sớm nhất
                if (item.checkIn) {
                    if (!existing.checkIn || new Date(item.checkIn) < new Date(existing.checkIn)) {
                        existing.checkIn = item.checkIn;
                    }
                }
                // Giờ ra muộn nhất
                if (item.checkOut) {
                    if (!existing.checkOut || new Date(item.checkOut) > new Date(existing.checkOut)) {
                        existing.checkOut = item.checkOut;
                    }
                }
                // Trạng thái đúng giờ nếu có ca đúng giờ
                if (item.status === 'Normal') {
                    existing.status = 'Normal';
                }
            }
        });

        return Array.from(dayMap.values()).sort(
            (a, b) => new Date(b.date || b.checkIn || 0).getTime() - new Date(a.date || a.checkIn || 0).getTime()
        );
    }, [logs]);

    // Logs chi tiết của nhân sự được chọn xem lịch sử tháng (Admin modal)
    const staffDetailLogs = useMemo(() => {
        if (!selectedStaffForDetail) return [];
        const raw = adminLogs.filter(l => {
            const sId = typeof l.staff === 'object' ? l.staff?._id : l.staff;
            return String(sId) === String(selectedStaffForDetail._id);
        });

        const dayMap = new Map<string, any>();
        raw.forEach(item => {
            if (!item || !item.date) return;
            const dayKey = new Date(item.date).toLocaleDateString('en-CA');
            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, { ...item });
            } else {
                const existing = dayMap.get(dayKey);
                if (item.checkIn && (!existing.checkIn || new Date(item.checkIn) < new Date(existing.checkIn))) {
                    existing.checkIn = item.checkIn;
                }
                if (item.checkOut && (!existing.checkOut || new Date(item.checkOut) > new Date(existing.checkOut))) {
                    existing.checkOut = item.checkOut;
                }
                if (item.status === 'Normal') existing.status = 'Normal';
            }
        });

        return Array.from(dayMap.values()).sort(
            (a, b) => new Date(b.date || b.checkIn || 0).getTime() - new Date(a.date || a.checkIn || 0).getTime()
        );
    }, [selectedStaffForDetail, adminLogs]);

    // Kiểm tra nếu tài khoản là học viên
    const isStudent = useMemo(() => isStudentUser(user), [user]);

    if (isStudent) {
        return (
            <div className="max-w-xl mx-auto my-16 bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center border border-amber-200">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Không áp dụng cho Học viên</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                    Mục <strong>Điểm danh & Chấm công (Check-in / Check-out)</strong> chỉ áp dụng cho đội ngũ cán bộ công nhân viên và giảng viên của công ty.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
            {/* ── HEADER CHÍNH & TAB ĐIỀU HƯỚNG ───────────────────────── */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Chấm công nhân sự
                        {isAdmin && (
                            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Quản trị viên
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {activeTab === 'personal'
                            ? "Ghi nhận giờ vào sớm nhất và lần check-out cuối cùng trong ngày của bạn."
                            : "Theo dõi điểm danh realtime trong ngày và tổng hợp số ca làm theo tháng của toàn bộ nhân sự công ty."}
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Nút Tab chuyển đổi nếu là Admin */}
                    {isAdmin && (
                        <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center">
                            <button
                                onClick={() => setActiveTab('personal')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                                    activeTab === 'personal'
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <User className="w-4 h-4" /> Chấm công của tôi
                            </button>
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                                    activeTab === 'admin'
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <Users className="w-4 h-4" /> Quản lý điểm danh công ty
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            if (activeTab === 'personal') fetchPersonalLogs();
                            else fetchAdminData();
                        }}
                        className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-400 transition-all cursor-pointer"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCcw className={cn("w-5 h-5", (loading || adminLoading) && "animate-spin")} />
                    </button>
                </div>
            </header>

            {/* ════════════════════════════════════════════════════════════════════
                TAB 1: CHẤM CÔNG CÁ NHÂN (PERSONAL TIMEKEEPING)
               ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'personal' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* CỘT TRÁI: KHU VỰC BẤM GIỜ THỜI GIAN THỰC */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />

                            <div className="relative z-10 space-y-8">
                                <div className="text-center">
                                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Giờ hệ thống</p>
                                    <h2 className="text-6xl font-black tracking-tighter tabular-nums">
                                        {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-4 font-bold flex items-center justify-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' })}
                                    </p>
                                </div>

                                {/* Banner cảnh báo tài khoản chưa đăng ký khuôn mặt */}
                                {isUserFaceRegistered === false && (
                                    <div className="bg-amber-500/15 border border-amber-500/30 p-3.5 rounded-2xl flex items-start gap-2.5 text-amber-300 text-xs">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                        <div className="leading-relaxed">
                                            <strong className="block text-amber-200 font-bold mb-0.5">Chưa đăng ký khuôn mặt</strong>
                                            Tài khoản chưa có dữ liệu khuôn mặt. Hệ thống yêu cầu đăng ký khuôn mặt trước khi có thể Time in / Time out.
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 space-y-3">
                                    {!todayRecord?.checkIn ? (
                                        /* Chưa check-in lần nào trong ngày */
                                        <button
                                            disabled={actionLoading}
                                            onClick={() => handleStartFaceAttendance('check-in')}
                                            className="w-full py-8 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm flex flex-col items-center justify-center gap-3 transition-all shadow-2xl active:scale-95 disabled:opacity-50 cursor-pointer bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25 text-white"
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="w-8 h-8 animate-spin" />
                                            ) : (
                                                <>
                                                    <LogIn className="w-8 h-8" />
                                                    <span>Bắt đầu vào ca (Check-in)</span>
                                                </>
                                            )}
                                        </button>
                                    ) : !todayRecord?.checkOut ? (
                                        /* Đã check-in nhưng chưa check-out lần nào */
                                        <button
                                            disabled={actionLoading}
                                            onClick={() => handleStartFaceAttendance('check-out')}
                                            className="w-full py-8 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm flex flex-col items-center justify-center gap-3 transition-all shadow-2xl active:scale-95 disabled:opacity-50 cursor-pointer bg-rose-500 hover:bg-rose-400 shadow-rose-500/25 text-white"
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="w-8 h-8 animate-spin" />
                                            ) : (
                                                <>
                                                    <LogOut className="w-8 h-8" />
                                                    <span>Kết thúc tan ca (Check-out)</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        /* Đã check-in và đã check-out: Cho phép cập nhật Check-out lần cuối */
                                        <div className="space-y-3">
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-center">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/40">
                                                    <CheckCircle2 className="w-6 h-6 text-white" />
                                                </div>
                                                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Đã chấm công hôm nay</p>
                                                <p className="text-[11px] text-slate-300 mt-1">
                                                    Giờ ra lần cuối: <strong className="text-white font-black">{new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                                </p>
                                            </div>

                                            <button
                                                disabled={actionLoading}
                                                onClick={() => handleStartFaceAttendance('check-out')}
                                                className="w-full py-4 px-4 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                                                title="Bấm để cập nhật giờ về mới nhất nếu bạn tiếp tục làm việc"
                                            >
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                                <span>Cập nhật Check-out (Lần cuối)</span>
                                            </button>
                                        </div>
                                    )}
                                </div>


                                {/* HIỂN THỊ GIỜ VÀO SỚM NHẤT & GIỜ RA LẦN CUỐI */}
                                {todayRecord?.checkIn && (
                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                                        <div className="text-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giờ vào (Sớm nhất)</p>
                                            <p className="text-xl font-black text-emerald-400 mt-1">
                                                {new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="text-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giờ ra (Lần cuối)</p>
                                            <p className="text-xl font-black text-rose-400 mt-1">
                                                {todayRecord.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Ghi chú nguyên tắc */}
                                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 leading-relaxed text-center font-medium">
                                    💡 <strong>Quy tắc tính công:</strong> Hệ thống tự động ghi nhận giờ Check-in <strong>sớm nhất</strong> và lần Check-out <strong>cuối cùng</strong> trong ngày.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI: LỊCH SỬ CHẤM CÔNG CÁ NHÂN */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[3rem] border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
                            <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Bảng công cá nhân</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Lịch sử check-in sớm nhất và check-out lần cuối của bạn trong tháng.</p>
                                </div>
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-indigo-600 outline-none cursor-pointer"
                                />
                            </div>

                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/80">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/80">
                                            <th className="px-8 py-5">Ngày</th>
                                            <th className="px-4 py-5 text-center">Giờ vào (Sớm nhất)</th>
                                            <th className="px-4 py-5 text-center">Giờ ra (Lần cuối)</th>
                                            <th className="px-4 py-5 text-center">Thời lượng</th>
                                            <th className="px-4 py-5 text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {personalDisplayLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                                                    Chưa có dữ liệu chấm công trong tháng {filterMonth}
                                                </td>
                                            </tr>
                                        ) : (
                                            personalDisplayLogs.map((log: any) => (
                                                <tr key={log._id || log.date} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-800">
                                                        {new Date(log.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                    </td>
                                                    <td className="px-4 py-5 text-center text-emerald-600 font-bold text-xs">
                                                        {log.checkIn ? new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </td>
                                                    <td className="px-4 py-5 text-center text-rose-500 font-bold text-xs">
                                                        {log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </td>
                                                    <td className="px-4 py-5 text-center text-slate-600 font-medium text-xs">
                                                        {calculateDuration(log.checkIn, log.checkOut)}
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <span className={cn(
                                                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                                                            log.status === 'Normal' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                                            log.status === 'Late' ? "bg-amber-50 text-amber-600 border border-amber-200" :
                                                            log.status === 'Early-Leave' ? "bg-orange-50 text-orange-600 border border-orange-200" :
                                                            "bg-slate-100 text-slate-600"
                                                        )}>
                                                            {log.status === 'Normal' ? 'Đúng giờ' : log.status === 'Late' ? 'Đi muộn' : log.status === 'Early-Leave' ? 'Về sớm' : log.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 2: QUẢN LÝ ĐIỂM DANH NHÂN SỰ DÀNH CHO ADMIN
               ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6">
                    {/* BẬT TẮT 2 CHẾ ĐỘ XEM TRONG TAB QUẢN TRỊ */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setAdminSubTab('daily')}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                                    adminSubTab === 'daily'
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                                )}
                            >
                                <Clock className="w-4 h-4" /> 1. Điểm danh theo ngày
                            </button>
                            <button
                                onClick={() => setAdminSubTab('monthly')}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                                    adminSubTab === 'monthly'
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                                )}
                            >
                                <BarChart3 className="w-4 h-4" /> 2. Tổng hợp số ca toàn công ty theo tháng
                            </button>
                        </div>

                        {/* Chọn thời gian */}
                        <div className="flex items-center gap-2">
                            {adminSubTab === 'daily' ? (
                                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                    <button
                                        onClick={() => {
                                            const prev = new Date(adminDailyDate);
                                            prev.setDate(prev.getDate() - 1);
                                            handleDailyDateChange(prev.toISOString().slice(0, 10));
                                        }}
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-500 cursor-pointer"
                                        title="Ngày hôm trước"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="date"
                                        value={adminDailyDate}
                                        onChange={(e) => handleDailyDateChange(e.target.value)}
                                        className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer px-1"
                                    />
                                    <button
                                        onClick={() => {
                                            const next = new Date(adminDailyDate);
                                            next.setDate(next.getDate() + 1);
                                            handleDailyDateChange(next.toISOString().slice(0, 10));
                                        }}
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-500 cursor-pointer"
                                        title="Ngày tiếp theo"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDailyDateChange(new Date().toISOString().slice(0, 10))}
                                        className="px-2.5 py-1 bg-white text-indigo-600 font-bold text-[11px] rounded-lg shadow-2xs border border-slate-200 hover:bg-indigo-50 cursor-pointer"
                                    >
                                        Hôm nay
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500">Chọn tháng:</span>
                                    <input
                                        type="month"
                                        value={adminMonth}
                                        onChange={(e) => setAdminMonth(e.target.value)}
                                        className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-indigo-600 outline-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BỘ LỌC TÌM KIẾM CHO ADMIN */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên nhân viên, email, số điện thoại..."
                                value={adminSearch}
                                onChange={(e) => setAdminSearch(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none"
                            />
                            {adminSearch && (
                                <button
                                    onClick={() => setAdminSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Lọc phòng ban */}
                        <select
                            value={adminDeptFilter}
                            onChange={(e) => setAdminDeptFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer shrink-0"
                        >
                            <option value="all">Tất cả phòng ban</option>
                            {Object.entries(DEPT_MAP).map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </select>

                        {/* Lọc trạng thái (khi ở subTab daily) */}
                        {adminSubTab === 'daily' && (
                            <select
                                value={adminStatusFilter}
                                onChange={(e) => setAdminStatusFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer shrink-0"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="checkedIn">Đã vào ca</option>
                                <option value="notCheckedIn">Chưa vào ca</option>
                                <option value="late">Đi muộn</option>
                                <option value="earlyLeave">Về sớm</option>
                            </select>
                        )}
                    </div>

                    {/* ──────────────────────────────────────────────────────────
                        MỤC 1: ĐIỂM DANH THEO NGÀY (DAILY VIEW)
                       ────────────────────────────────────────────────────────── */}
                    {adminSubTab === 'daily' && (
                        <div className="space-y-6">
                            {/* KPI Metrics trong ngày */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng nhân sự</p>
                                    <p className="text-2xl font-black text-slate-900 mt-1">{dailyStats.total}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Đã vào ca</p>
                                    <p className="text-2xl font-black text-emerald-600 mt-1">{dailyStats.checkedInCount}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chưa vào ca</p>
                                    <p className="text-2xl font-black text-slate-500 mt-1">{dailyStats.notCheckedInCount}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Đi muộn</p>
                                    <p className="text-2xl font-black text-amber-600 mt-1">{dailyStats.lateCount}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Về sớm</p>
                                    <p className="text-2xl font-black text-orange-600 mt-1">{dailyStats.earlyLeaveCount}</p>
                                </div>
                            </div>

                            {/* BẢNG ĐIỂM DANH THEO NGÀY */}
                            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">
                                            Danh sách điểm danh ngày {new Date(adminDailyDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Hiển thị giờ check-in sớm nhất và giờ check-out lần cuối cùng của từng nhân sự trong ngày.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500">
                                        Hiển thị {filteredDailyData.length} / {dailyAttendanceData.length} nhân sự
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                <th className="px-6 py-4">Nhân sự</th>
                                                <th className="px-4 py-4">Phòng ban</th>
                                                <th className="px-4 py-4 text-center">Giờ vào (Sớm nhất)</th>
                                                <th className="px-4 py-4 text-center">Giờ ra (Lần cuối)</th>
                                                <th className="px-4 py-4 text-center">Thời gian làm việc</th>
                                                <th className="px-4 py-4 text-center">Trạng thái</th>
                                                <th className="px-6 py-4 text-right">Lịch sử tháng</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                                                        Đang tải dữ liệu điểm danh...
                                                    </td>
                                                </tr>
                                            ) : filteredDailyData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                                        Không tìm thấy nhân sự phù hợp
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredDailyData.map(({ staff, log, hasCheckedIn, checkIn, checkOut, duration, status }) => (
                                                    <tr key={staff._id} className="hover:bg-slate-50/70 transition-colors">
                                                        {/* Nhân sự */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <StaffAvatar
                                                                    avatar={staff.avatar}
                                                                    name={staff.fullName}
                                                                    className="w-10 h-10 rounded-xl"
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-slate-900 text-sm">{staff.fullName || 'Chưa đặt tên'}</p>
                                                                    <p className="text-[11px] text-slate-400">{staff.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Phòng ban */}
                                                        <td className="px-4 py-4">
                                                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-bold border border-slate-200">
                                                                {DEPT_MAP[staff.department] || staff.department || 'Khác'}
                                                            </span>
                                                        </td>

                                                        {/* Giờ vào sớm nhất */}
                                                        <td className="px-4 py-4 text-center">
                                                            {checkIn ? (
                                                                <span className="font-black text-emerald-600 text-xs">
                                                                    {new Date(checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300 font-bold">--:--</span>
                                                            )}
                                                        </td>

                                                        {/* Giờ ra lần cuối */}
                                                        <td className="px-4 py-4 text-center">
                                                            {checkOut ? (
                                                                <span className="font-black text-rose-500 text-xs">
                                                                    {new Date(checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            ) : hasCheckedIn ? (
                                                                <span className="text-amber-500 text-[11px] font-bold">Đang làm việc</span>
                                                            ) : (
                                                                <span className="text-slate-300 font-bold">--:--</span>
                                                            )}
                                                        </td>

                                                        {/* Thời gian làm việc */}
                                                        <td className="px-4 py-4 text-center font-bold text-slate-700">
                                                            {duration}
                                                        </td>

                                                        {/* Trạng thái */}
                                                        <td className="px-4 py-4 text-center">
                                                            {status === 'Normal' && (
                                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full font-bold uppercase text-[10px]">
                                                                    Đúng giờ
                                                                </span>
                                                            )}
                                                            {status === 'Late' && (
                                                                <span className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-bold uppercase text-[10px]">
                                                                    Đi muộn
                                                                </span>
                                                            )}
                                                            {status === 'Early-Leave' && (
                                                                <span className="px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-full font-bold uppercase text-[10px]">
                                                                    Về sớm
                                                                </span>
                                                            )}
                                                            {status === 'NotCheckedIn' && (
                                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-full font-bold uppercase text-[10px]">
                                                                    Chưa vào ca
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Thao tác xem lịch sử tháng của nhân sự đó */}
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => setSelectedStaffForDetail(staff)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                                                title="Xem chi tiết lịch sử chấm công cả tháng của nhân sự này"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" /> Xem lịch sử
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────────────
                        MỤC 2: TỔNG HỢP TOÀN CÔNG TY THEO THÁNG (MONTHLY VIEW)
                       ────────────────────────────────────────────────────────── */}
                    {adminSubTab === 'monthly' && (
                        <div className="space-y-6">
                            {/* KPI tổng quan tháng */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số ca check-in tháng</p>
                                        <p className="text-2xl font-black text-indigo-600 mt-1">
                                            {adminLogs.filter(l => l.checkIn).length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ca đúng giờ</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">
                                            {adminLogs.filter(l => l.status === 'Normal').length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Lượt đi muộn</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">
                                            {adminLogs.filter(l => l.status === 'Late').length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Lượt về sớm</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">
                                            {adminLogs.filter(l => l.status === 'Early-Leave').length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                        <LogOut className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* BẢNG TỔNG HỢP SỐ CA CHECK-IN THEO THÁNG CỦA TOÀN BỘ NHÂN SỰ */}
                            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">
                                            Bảng tổng hợp công tháng {adminMonth} của toàn bộ nhân sự
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Thống kê tổng số ca/ngày check-in, số lần đúng giờ, đi muộn, về sớm của từng nhân viên.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500">
                                        {filteredMonthlyData.length} nhân viên
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                <th className="px-6 py-4">Nhân sự</th>
                                                <th className="px-4 py-4">Phòng ban</th>
                                                <th className="px-4 py-4 text-center">Số ca / ngày Check-in</th>
                                                <th className="px-4 py-4 text-center">Đúng giờ</th>
                                                <th className="px-4 py-4 text-center">Đi muộn</th>
                                                <th className="px-4 py-4 text-center">Về sớm</th>
                                                <th className="px-4 py-4 text-center">Tỷ lệ đúng giờ</th>
                                                <th className="px-6 py-4 text-right">Chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                                                        Đang tổng hợp dữ liệu tháng...
                                                    </td>
                                                </tr>
                                            ) : filteredMonthlyData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                                        Không tìm thấy nhân sự phù hợp
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredMonthlyData.map(({ staff, totalCheckIns, onTimeCount, lateCount, earlyLeaveCount, attendanceRate }) => (
                                                    <tr key={staff._id} className="hover:bg-slate-50/70 transition-colors">
                                                        {/* Nhân sự */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <StaffAvatar
                                                                    avatar={staff.avatar}
                                                                    name={staff.fullName}
                                                                    className="w-10 h-10 rounded-xl"
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-slate-900 text-sm">{staff.fullName || 'Chưa đặt tên'}</p>
                                                                    <p className="text-[11px] text-slate-400">{staff.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Phòng ban */}
                                                        <td className="px-4 py-4">
                                                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-bold border border-slate-200">
                                                                {DEPT_MAP[staff.department] || staff.department || 'Khác'}
                                                            </span>
                                                        </td>

                                                        {/* Tổng số ca/ngày check in */}
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-xl border border-indigo-200 text-xs">
                                                                {totalCheckIns} ca / ngày
                                                            </span>
                                                        </td>

                                                        {/* Đúng giờ */}
                                                        <td className="px-4 py-4 text-center font-bold text-emerald-600">
                                                            {onTimeCount}
                                                        </td>

                                                        {/* Đi muộn */}
                                                        <td className="px-4 py-4 text-center font-bold text-amber-600">
                                                            {lateCount}
                                                        </td>

                                                        {/* Về sớm */}
                                                        <td className="px-4 py-4 text-center font-bold text-orange-600">
                                                            {earlyLeaveCount}
                                                        </td>

                                                        {/* Tỷ lệ đúng giờ */}
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="font-black text-slate-700 text-xs">{attendanceRate}%</span>
                                                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full",
                                                                            attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 50 ? "bg-amber-500" : "bg-rose-500"
                                                                        )}
                                                                        style={{ width: `${attendanceRate}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Nút xem chi tiết lịch sử */}
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => setSelectedStaffForDetail(staff)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────────────
                        MODAL / POPUP CHI TIẾT LỊCH SỬ CHẤM CÔNG CỦA TỪNG NGƯỜI THEO THÁNG
                       ────────────────────────────────────────────────────────── */}
                    {selectedStaffForDetail && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
                                {/* Header Modal */}
                                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <StaffAvatar
                                            avatar={selectedStaffForDetail.avatar}
                                            name={selectedStaffForDetail.fullName}
                                            className="w-14 h-14 rounded-2xl shadow-sm border border-slate-200"
                                            iconSize="w-6 h-6"
                                        />
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 leading-tight">
                                                Lịch sử chấm công: {selectedStaffForDetail.fullName}
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                                                <span>{selectedStaffForDetail.email}</span>
                                                {selectedStaffForDetail.phone && <span>• SĐT: {selectedStaffForDetail.phone}</span>}
                                                <span>• Phòng ban: <strong>{DEPT_MAP[selectedStaffForDetail.department] || selectedStaffForDetail.department || 'Khác'}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedStaffForDetail(null)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Body Modal: Bảng chi tiết từng ngày */}
                                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-500">
                                            Chi tiết các lần chấm công trong tháng <strong className="text-indigo-600 font-black">{adminMonth}</strong>:
                                        </p>
                                        <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                                            Tổng cộng: {staffDetailLogs.length} ca / ngày
                                        </span>
                                    </div>

                                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                                                    <th className="px-5 py-3.5">Ngày</th>
                                                    <th className="px-4 py-3.5 text-center">Giờ vào (Sớm nhất)</th>
                                                    <th className="px-4 py-3.5 text-center">Giờ ra (Lần cuối)</th>
                                                    <th className="px-4 py-3.5 text-center">Thời lượng làm</th>
                                                    <th className="px-4 py-3.5 text-center">Trạng thái</th>
                                                    <th className="px-5 py-3.5 text-right">Thiết bị / IP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {staffDetailLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="py-10 text-center text-slate-400">
                                                            Nhân sự này chưa có ca chấm công nào trong tháng {adminMonth}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    staffDetailLogs.map((log: any) => (
                                                        <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                                                            <td className="px-5 py-3.5 font-bold text-slate-800">
                                                                {new Date(log.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center font-black text-emerald-600">
                                                                {log.checkIn ? new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center font-black text-rose-500">
                                                                {log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                                                                {calculateDuration(log.checkIn, log.checkOut)}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center">
                                                                <span className={cn(
                                                                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                                    log.status === 'Normal' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                                                    log.status === 'Late' ? "bg-amber-50 text-amber-600 border border-amber-200" :
                                                                    log.status === 'Early-Leave' ? "bg-orange-50 text-orange-600 border border-orange-200" :
                                                                    "bg-slate-100 text-slate-600"
                                                                )}>
                                                                    {log.status === 'Normal' ? 'Đúng giờ' : log.status === 'Late' ? 'Đi muộn' : log.status === 'Early-Leave' ? 'Về sớm' : log.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-right text-slate-400 text-[10px] truncate max-w-[150px]">
                                                                {log.ipAddress || log.device || '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Footer Modal */}
                                <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                                    <button
                                        onClick={() => setSelectedStaffForDetail(null)}
                                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Quét Khuôn Mặt Chấm Công (Check-in & Check-out) */}
            <FaceAttendanceScannerModal
                isOpen={!!faceModalMode}
                mode={faceModalMode || 'check-in'}
                onClose={() => setFaceModalMode(null)}
                onSuccess={() => {
                    fetchPersonalLogs();
                    if (isAdmin) fetchAdminData();
                }}
            />
        </div>
    );
}