import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import {
    Clock, LogIn, LogOut, Calendar, MapPin, Loader2, RefreshCcw
} from 'lucide-react';
import { cn } from '../utils/cn';

const SHIFT_OPTIONS = [
    { id: 'Morning', label: 'Ca Sáng (09:00 - 12:00)' },
    { id: 'Afternoon', label: 'Ca Chiều (14:00 - 17:00)' },
    { id: 'Evening', label: 'Ca Tối (18:00 - 21:00)' },
];

export default function ShiftAttendance() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedShift, setSelectedShift] = useState('Morning');
    const [actionLoading, setActionLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const { user } = useAuth();
    const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name) || '';
    const isAdmin = roleName.toLowerCase() === 'admin';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (isAdmin) {
                const today = new Date().toISOString().split('T')[0];
                res = await apiClient.get(`/shift-attendance/all?startDate=${today}&endDate=${today}`);
            } else {
                res = await apiClient.get('/shift-attendance/my');
            }
            
            if (res.data.success) {
                setLogs(res.data.data);
            }
        } catch (error) {
            toast.error("Không thể tải lịch sử điểm danh");
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const getAddressFromCoords = async (lat: number, lon: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            return data.display_name || "Không xác định được địa chỉ";
        } catch (error) {
            return "Không lấy được địa chỉ (Lỗi kết nối)";
        }
    };

    const handleAction = async (type: 'check-in' | 'check-out') => {
        if (!navigator.geolocation) {
            toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS");
            return;
        }

        setActionLoading(true);
        const toastId = toast.loading("Đang lấy vị trí GPS...");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                toast.loading("Đang phân tích địa chỉ...", { id: toastId });
                
                const address = await getAddressFromCoords(latitude, longitude);

                toast.loading(`Đang gửi yêu cầu ${type}...`, { id: toastId });

                try {
                    const res = await apiClient.post(`/shift-attendance/${type}`, {
                        shift: selectedShift,
                        lat: latitude,
                        long: longitude,
                        address
                    });

                    if (res.data.success) {
                        toast.success(res.data.message || "Thành công!", { id: toastId });
                        fetchLogs();
                    }
                } catch (error: any) {
                    toast.error(error.response?.data?.message || "Lỗi thao tác", { id: toastId });
                } finally {
                    setActionLoading(false);
                }
            },
            (error) => {
                setActionLoading(false);
                let msg = "Không thể lấy vị trí.";
                if (error.code === 1) msg = "Bạn đã từ chối quyền truy cập vị trí.";
                else if (error.code === 2) msg = "Vị trí hiện tại không khả dụng.";
                else if (error.code === 3) msg = "Quá thời gian lấy vị trí.";
                toast.error(msg, { id: toastId });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Điểm danh Ca làm</h1>
                    <p className="text-slate-500 text-sm italic">Ghi nhận giờ vào ra có xác định vị trí GPS.</p>
                </div>
                <button onClick={fetchLogs} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-400 transition-all">
                    <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* CHECK-IN BOX */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-emerald-500">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                        <div className="relative z-10 space-y-8">
                            <div className="text-center">
                                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Giờ hệ thống</p>
                                <h2 className="text-6xl font-black tracking-tighter tabular-nums">
                                    {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </h2>
                                <p className="text-slate-400 text-sm mt-4 font-bold flex items-center justify-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' })}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chọn Ca làm việc</label>
                                <select 
                                    value={selectedShift} 
                                    onChange={e => setSelectedShift(e.target.value)}
                                    className="w-full bg-slate-800 text-white border-none rounded-2xl p-4 font-black outline-none focus:ring-2 ring-emerald-500"
                                >
                                    {SHIFT_OPTIONS.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    disabled={actionLoading}
                                    onClick={() => handleAction('check-in')}
                                    className="py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
                                >
                                    {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
                                    Check In
                                </button>
                                <button
                                    disabled={actionLoading}
                                    onClick={() => handleAction('check-out')}
                                    className="py-5 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50 transition-all"
                                >
                                    {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
                                    Check Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HISTORY */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-8 border-b border-slate-50">
                            <h3 className="text-xl font-black text-slate-900">
                                {isAdmin ? 'Lịch sử điểm danh toàn bộ (Hôm nay)' : 'Lịch sử điểm danh (Gần nhất)'}
                            </h3>
                        </div>
                        <div className="overflow-y-auto flex-1 p-4 custom-scrollbar max-h-[600px]">
                            {loading ? (
                                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                            ) : logs.length === 0 ? (
                                <div className="text-center p-10 text-slate-400 font-bold">Chưa có dữ liệu điểm danh</div>
                            ) : (
                                <div className="space-y-4">
                                    {logs.map((log: any) => (
                                        <div key={log._id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-3">
                                                    {isAdmin && log.staff && (
                                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg mr-1">
                                                            {log.staff.fullName}
                                                        </span>
                                                    )}
                                                    <span className="text-sm font-black text-slate-900">{new Date(log.date).toLocaleDateString('vi-VN')}</span>
                                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-black uppercase">
                                                        {SHIFT_OPTIONS.find(o => o.id === log.shift)?.label || log.shift}
                                                    </span>
                                                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                                                        log.status === 'On Time' ? "bg-emerald-100 text-emerald-700" :
                                                        log.status === 'Late' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                                    )}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {log.checkIn && (
                                                        <div className="flex items-start gap-2 text-xs bg-white p-2 rounded-xl border border-slate-100">
                                                            <LogIn className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-bold text-slate-700">{new Date(log.checkIn.time).toLocaleTimeString()}</span>
                                                                <p className="text-slate-500 mt-1 line-clamp-2" title={log.checkIn.address}><MapPin className="w-3 h-3 inline mr-1 text-slate-400" />{log.checkIn.address}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.checkOut && (
                                                        <div className="flex items-start gap-2 text-xs bg-white p-2 rounded-xl border border-slate-100">
                                                            <LogOut className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-bold text-slate-700">{new Date(log.checkOut.time).toLocaleTimeString()}</span>
                                                                <p className="text-slate-500 mt-1 line-clamp-2" title={log.checkOut.address}><MapPin className="w-3 h-3 inline mr-1 text-slate-400" />{log.checkOut.address}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
