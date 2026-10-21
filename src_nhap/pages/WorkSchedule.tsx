
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, Calendar as CalendarIcon, CheckCircle2, XCircle,
    Clock, User, Filter, Loader2, Save, ArrowLeft, MoreHorizontal,
    Check, ChevronLeft, ChevronRight, Users, Building2, Search,
    AlertCircle, CalendarDays, Ban, LayoutGrid, List, Trash2, TrendingUp,
    ShieldCheck, ShieldAlert
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const getMonday = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(date.setDate(diff));
};

const getDaysInWeek = (monday) => {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
};

const SHIFT_OPTIONS = [
    { id: 'Morning', label: 'Sáng', color: 'bg-blue-500', text: 'text-blue-600', icon: <Clock className="w-3 h-3" /> },
    { id: 'Afternoon', label: 'Chiều', color: 'bg-emerald-500', text: 'text-emerald-600', icon: <Clock className="w-3 h-3" /> },
    { id: 'Evening', label: 'Tối', color: 'bg-indigo-500', text: 'text-indigo-600', icon: <Clock className="w-3 h-3" /> },
];

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export default function WorkSchedule() {
    const { user } = useAuth();

    const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name) || '';
    const isManager = ['manager', 'admin'].includes(roleName.toLowerCase());

    const [activeTab, setActiveTab] = useState<'my' | 'manage'>('my');
    const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('grid');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [schedules, setSchedules] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [staffFilter, setStaffFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');

    const [regWeekMonday, setRegWeekMonday] = useState(getMonday(new Date(new Date().setDate(new Date().getDate() + 7))));
    const [weeklyPayload, setWeeklyPayload] = useState<Record<string, string[]>>({});
    const [isPopupLoading, setIsPopupLoading] = useState(false);

    const dateRange = useMemo(() => {
        const ref = new Date(referenceDate);
        if (viewMode === 'week') {
            const start = getMonday(ref);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        } else {
            const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
            const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start, end };
        }
    }, [referenceDate, viewMode]);

    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = (isManager && activeTab === 'manage') ? '/work-schedules/all' : '/work-schedules/my';
            const params: any = {
                startDate: dateRange.start.toISOString(),
                endDate: dateRange.end.toISOString(),
                staffId: staffFilter || undefined,
                department: deptFilter || undefined
            };
            const res = await apiClient.get(endpoint, { params });
            if (res.data.success) setSchedules(res.data.data);
        } catch (error) {
            toast.error("Lỗi tải lịch làm việc");
        } finally {
            setLoading(false);
        }
    }, [activeTab, dateRange, staffFilter, deptFilter, isManager]);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

    // --- LẤY DANH SÁCH NGƯỜI DÙNG CHO DROPDOWN LỌC ---
    useEffect(() => {
        if (isManager) {
            apiClient.get('/users').then(res => {
                if (res.data.success) {
                    setUsersList(res.data.data);
                }
            });
        }
    }, [isManager]);

    // --- LỌC LỊCH LÀM VIỆC ---
    const filteredSchedules = useMemo(() => {
        return schedules;
    }, [schedules]);

    const attendanceStats = useMemo(() => {
        if (!isManager || activeTab !== 'manage') return [];
        const stats = new Map();
        
        filteredSchedules.forEach(s => {
            const userId = s.staff?._id || s.staff;
            if (!stats.has(userId)) {
                stats.set(userId, {
                    user: s.staff || { _id: userId, fullName: 'Unknown' },
                    totalSlots: 0,
                    approvedSlots: 0,
                    pendingSlots: 0,
                    rejectedSlots: 0,
                    days: new Set()
                });
            }
            const stat = stats.get(userId);
            const shiftCount = s.shifts?.length || 0;
            stat.totalSlots += shiftCount;
            if (s.status === 'Approved') stat.approvedSlots += shiftCount;
            else if (s.status === 'Pending') stat.pendingSlots += shiftCount;
            else if (s.status === 'Rejected') stat.rejectedSlots += shiftCount;
            stat.days.add(s.date.split('T')[0]);
        });
        
        return Array.from(stats.values()).sort((a, b) => b.totalSlots - a.totalSlots);
    }, [filteredSchedules, isManager, activeTab]);

    const targetSlots = viewMode === 'week' ? 6 : 24;

    const loadPopupData = useCallback(async () => {
        setIsPopupLoading(true);
        try {
            const end = new Date(regWeekMonday);
            end.setDate(regWeekMonday.getDate() + 6);
            end.setHours(23, 59, 59);
            const res = await apiClient.get('/work-schedules/my', {
                params: { startDate: regWeekMonday.toISOString(), endDate: end.toISOString() }
            });
            const newPayload: Record<string, string[]> = {};
            getDaysInWeek(regWeekMonday).forEach(d => newPayload[d.toISOString().split('T')[0]] = []);
            if (res.data.success && res.data.data) {
                res.data.data.forEach((item: any) => {
                    const dateKey = item.date.split('T')[0];
                    newPayload[dateKey] = item.shifts || [];
                });
            }
            setWeeklyPayload(newPayload);
        } catch (error) { console.error("Lỗi load dữ liệu cũ"); }
        finally { setIsPopupLoading(false); }
    }, [regWeekMonday]);

    useEffect(() => {
        if (isModalOpen) loadPopupData();
    }, [isModalOpen, loadPopupData]);

    const toggleShiftSelection = (dateStr: string, shiftId: string) => {
        setWeeklyPayload(prev => {
            const current = prev[dateStr] || [];
            const updated = current.includes(shiftId)
                ? current.filter(id => id !== shiftId)
                : [...current, shiftId];
            return { ...prev, [dateStr]: updated };
        });
    };

    const handleBulkRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading("Đang đồng bộ lịch tuần...");
        try {
            const entries = Object.entries(weeklyPayload);
            await Promise.all(entries.map(([date, shifts]) =>
                apiClient.post('/work-schedules', { date, shifts, note: 'Cập nhật lịch tuần' })
            ));
            toast.success("Đã cập nhật thành công!", { id: toastId });
            setIsModalOpen(false);
            fetchSchedules();
        } catch (error) { toast.error("Lỗi khi gửi dữ liệu", { id: toastId }); }
    };

    const handleApprove = async (id: string, status: string) => {
        try {
            const res = await apiClient.put(`/work-schedules/${id}/status`, { status });
            if (res.data.success) {
                toast.success(`Đã cập nhật trạng thái`);
                fetchSchedules();
            }
        } catch (error) { toast.error("Thao tác thất bại"); }
    };

    const handleApproveAll = async () => {
        const pendingIds = filteredSchedules.filter(s => s.status === 'Pending').map(s => s._id);
        if (pendingIds.length === 0) {
            toast.error("Không có lịch nào đang chờ duyệt");
            return;
        }
        if (!window.confirm(`Bạn có chắc chắn muốn phê duyệt toàn bộ ${pendingIds.length} lịch đang chờ?`)) return;
        const toastId = toast.loading("Đang phê duyệt hàng loạt...");
        try {
            const res = await apiClient.put('/work-schedules/approve-all', { scheduleIds: pendingIds });
            if (res.data.success) {
                toast.success(res.data.message || "Đã phê duyệt tất cả", { id: toastId });
                fetchSchedules();
            }
        } catch (error) {
            toast.error("Lỗi khi phê duyệt hàng loạt", { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn muốn hủy lịch đăng ký ngày này?")) return;
        try {
            const res = await apiClient.delete(`/work-schedules/${id}`);
            if (res.data.success) {
                toast.success("Đã xóa lịch");
                fetchSchedules();
            }
        } catch (error) { toast.error("Không thể xóa"); }
    };

    return (
        <div className="space-y-6 pb-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kế hoạch làm việc</h1>
                    <p className="text-slate-500 text-sm">Quản lý lịch trực và theo dõi chuyên cần.</p>
                </div>
                {isManager && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                        <button onClick={() => setActiveTab('my')} className={cn("px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'my' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Cá nhân</button>
                        <button onClick={() => setActiveTab('manage')} className={cn("px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'manage' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Quản lý</button>
                    </div>
                )}
            </header>

            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 items-center">
                <div className="w-full xl:w-auto flex items-center justify-between bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                    <button onClick={() => setReferenceDate(new Date(referenceDate.setDate(referenceDate.getDate() - (viewMode === 'week' ? 7 : 30))))} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="text-center px-4">
                        <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className="text-[9px] font-black text-emerald-500 uppercase bg-transparent outline-none cursor-pointer block w-full text-center mb-1">
                            <option value="week">Tuần</option><option value="month">Tháng</option>
                        </select>
                        <p className="text-xs font-black text-slate-800 whitespace-nowrap">
                            {dateRange.start.toLocaleDateString('vi-VN')} - {dateRange.end.toLocaleDateString('vi-VN')}
                        </p>
                    </div>
                    <button onClick={() => setReferenceDate(new Date(referenceDate.setDate(referenceDate.getDate() + (viewMode === 'week' ? 7 : 30))))} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all"><ChevronRight className="w-5 h-5" /></button>
                </div>

                <div className="flex flex-1 items-center justify-between w-full">
                    <div className="flex gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={() => setDisplayMode('grid')} className={cn("p-2 rounded-lg transition-all", displayMode === 'grid' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setDisplayMode('table')} className={cn("p-2 rounded-lg transition-all", displayMode === 'table' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}><List className="w-4 h-4" /></button>
                        </div>
                        {isManager && activeTab === 'manage' && (
                            <div className="hidden md:flex gap-2">
                                <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 ring-orange-500 min-w-[150px]">
                                    <option value="">Nhân sự</option>
                                    {usersList.map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
                                </select>
                                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 ring-orange-500 min-w-[150px]">
                                    <option value="">Phòng ban</option>
                                    <option value="sales">Sales</option>
                                    <option value="training">Đào tạo</option>
                                    <option value="operation">Vận hành</option>
                                </select>
                            </div>
                        )}
                        {isManager && activeTab === 'manage' && (
                            <button
                                onClick={handleApproveAll}
                                className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Duyệt nhanh
                            </button>
                        )}
                    </div>
                    {activeTab === 'my' && (
                        <button onClick={() => { setRegWeekMonday(getMonday(new Date())); setIsModalOpen(true); }} className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Đăng ký tuần
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>
            ) : (
                <>
                    {/* BẢNG THỐNG KÊ CHI TIẾT (Tab Quản lý) */}
                    {isManager && activeTab === 'manage' && (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Báo cáo chuyên cần {viewMode === 'week' ? 'tuần' : 'tháng'}</h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase">Mục tiêu tối thiểu: {targetSlots} ca</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Tổng nhân sự</p>
                                        <p className="text-xl font-black text-slate-900">{attendanceStats.length}</p>
                                    </div>
                                </div>
                            </div>

                            {viewMode === 'week' && displayMode === 'grid' ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {attendanceStats.map((stat: any) => {
                                        const isLow = stat.approvedSlots < targetSlots;
                                        return (
                                            <div key={stat.user._id} className={cn(
                                                "p-5 rounded-[1.5rem] border transition-all",
                                                isLow ? "bg-rose-50 border-rose-100 shadow-sm" : "bg-slate-50 border-slate-100"
                                            )}>
                                                <p className="text-[10px] font-black text-slate-400 uppercase truncate mb-2">{stat.user.fullName}</p>
                                                <div className="flex items-end justify-between">
                                                    <span className={cn("text-2xl font-black", isLow ? "text-rose-600" : "text-slate-900")}>
                                                        {stat.approvedSlots}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase pb-1">/ {targetSlots}</span>
                                                </div>
                                                {isLow && (
                                                    <div className="mt-2 flex items-center gap-1 text-[8px] font-black text-rose-500 uppercase italic">
                                                        <AlertCircle className="w-3 h-3" /> Thiếu {targetSlots - stat.approvedSlots}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="pb-4 text-left">Nhân sự</th>
                                                <th className="pb-4 text-center">Tổng đăng ký</th>
                                                <th className="pb-4 text-center">Đã duyệt (Đi làm)</th>
                                                <th className="pb-4 text-center">Chờ duyệt</th>
                                                <th className="pb-4 text-center">Nghỉ (Từ chối)</th>
                                                <th className="pb-4 text-right">Đánh giá</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {attendanceStats.map((stat: any) => {
                                                const isLow = stat.approvedSlots < targetSlots;
                                                return (
                                                    <tr key={stat.user._id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs uppercase">{stat.user.fullName?.charAt(0)}</div>
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-800">{stat.user.fullName}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{stat.user.department}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 text-center font-black text-slate-600">{stat.totalSlots}</td>
                                                        <td className="py-5 text-center">
                                                            <span className={cn("px-3 py-1 rounded-lg font-black text-xs", isLow ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                                                                {stat.approvedSlots} ca
                                                            </span>
                                                        </td>
                                                        <td className="py-5 text-center text-amber-500 font-bold">{stat.pendingSlots}</td>
                                                        <td className="py-5 text-center text-rose-400 font-bold">{stat.rejectedSlots}</td>
                                                        <td className="py-5 text-right">
                                                            {isLow ? (
                                                                <div className="flex items-center justify-end gap-2 text-rose-500 font-black text-[10px] uppercase">
                                                                    <ShieldAlert className="w-4 h-4" /> Không đạt ({stat.approvedSlots}/{targetSlots})
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2 text-emerald-500 font-black text-[10px] uppercase">
                                                                    <ShieldCheck className="w-4 h-4" /> Đạt yêu cầu
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {displayMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                            {filteredSchedules.map((item) => (
                                <div key={item._id} className="bg-white rounded-[2rem] border border-slate-100 p-7 shadow-sm hover:shadow-xl transition-all group relative">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner", item.status === 'Approved' ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-600")}>
                                                <CalendarIcon className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-base font-black text-slate-900 leading-none mb-2">{new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</p>
                                                <span className={cn("text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border",
                                                    item.status === 'Approved' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                        item.status === 'Rejected' ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"
                                                )}>{item.status}</span>
                                            </div>
                                        </div>
                                        {((isManager && activeTab === 'manage' && item.status === 'Pending') || (roleName.toLowerCase() === 'admin' && activeTab === 'my' && item.status === 'Pending')) ? (
                                            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <button onClick={() => handleApprove(item._id, 'Approved')} className="p-2.5 bg-white text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => handleApprove(item._id, 'Rejected')} className="p-2.5 bg-white text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Ban className="w-4 h-4" /></button>
                                            </div>
                                        ) : activeTab === 'my' && item.status === 'Pending' && (
                                            <button onClick={() => handleDelete(item._id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {item.shifts?.map((s: string) => (
                                            <span key={s} className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-tighter">
                                                {SHIFT_OPTIONS.find(opt => opt.id === s)?.label || s}
                                            </span>
                                        ))}
                                    </div>
                                    {isManager && activeTab === 'manage' && (
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-[10px] uppercase">{item.staff?.fullName?.charAt(0)}</div>
                                            <span className="text-xs font-bold text-slate-600">{item.staff?.fullName}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                        <th className="px-8 py-5">Ngày làm việc</th>
                                        {isManager && activeTab === 'manage' && <th className="px-8 py-5">Nhân sự</th>}
                                        <th className="px-8 py-5">Ca trực</th>
                                        <th className="px-8 py-5 text-center">Trạng thái</th>
                                        <th className="px-8 py-5 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredSchedules.map((item) => (
                                        <tr key={item._id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-4">
                                                <span className="text-sm font-bold text-slate-800">{new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                            </td>
                                            {isManager && activeTab === 'manage' && (
                                                <td className="px-8 py-4">
                                                    <span className="text-xs font-medium text-slate-600">{item.staff?.fullName}</span>
                                                </td>
                                            )}
                                            <td className="px-8 py-4">
                                                <div className="flex gap-1">
                                                    {item.shifts?.map((s: string) => (
                                                        <span key={s} className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase text-white", SHIFT_OPTIONS.find(o => o.id === s)?.color)}>
                                                            {SHIFT_OPTIONS.find(o => o.id === s)?.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-center text-[10px] font-bold uppercase">{item.status}</td>
                                            <td className="px-8 py-4 text-right">
                                                {((isManager && activeTab === 'manage') || (roleName.toLowerCase() === 'admin' && activeTab === 'my')) && item.status === 'Pending' ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleApprove(item._id, 'Approved')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleApprove(item._id, 'Rejected')} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Ban className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ) : <MoreHorizontal className="w-4 h-4 text-slate-300 ml-auto" />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lập lịch làm việc tuần">
                <form onSubmit={handleBulkRegister} className="space-y-6 relative">
                    {isPopupLoading && (
                        <div className="absolute inset-0 bg-white/60 z-50 backdrop-blur-sm flex items-center justify-center">
                            <Loader2 className="animate-spin text-indigo-600" />
                        </div>
                    )}
                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex items-center justify-between">
                        <button type="button" onClick={() => setRegWeekMonday(new Date(regWeekMonday.setDate(regWeekMonday.getDate() - 7)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft /></button>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Chu kỳ đăng ký</p>
                            <h3 className="text-lg font-black">{regWeekMonday.toLocaleDateString('vi-VN')} - {new Date(new Date(regWeekMonday).setDate(regWeekMonday.getDate() + 6)).toLocaleDateString('vi-VN')}</h3>
                        </div>
                        <button type="button" onClick={() => setRegWeekMonday(new Date(regWeekMonday.setDate(regWeekMonday.getDate() + 7)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronRight /></button>
                    </div>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {getDaysInWeek(regWeekMonday).map((dateObj, idx) => {
                            const dateStr = dateObj.toISOString().split('T')[0];
                            return (
                                <div key={dateStr} className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-black text-slate-800 uppercase">{DAY_LABELS[idx]} — {dateObj.toLocaleDateString('vi-VN')}</span>
                                        {(weeklyPayload[dateStr] || []).length > 0 && <span className="text-[9px] font-black text-emerald-600 uppercase">Có lịch</span>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {SHIFT_OPTIONS.map(opt => {
                                            const isSelected = weeklyPayload[dateStr]?.includes(opt.id);
                                            return (
                                                <button key={opt.id} type="button" onClick={() => toggleShiftSelection(dateStr, opt.id)} className={cn("py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 flex flex-col items-center gap-1", isSelected ? `${opt.color} text-white border-transparent shadow-lg` : "bg-white text-slate-300 border-slate-100")}>{opt.label}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-600 uppercase tracking-widest text-[10px]">Cập nhật & Gửi lịch tuần này</button>
                </form>
            </Modal>
        </div>
    );
}