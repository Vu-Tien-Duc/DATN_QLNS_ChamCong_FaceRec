import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import {
    BarChart3, Calendar, Loader2, TrendingUp, RefreshCcw, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { cn } from '../utils/cn';

const SHIFT_OPTIONS = [
    { id: 'Morning', label: 'Ca Sáng' },
    { id: 'Afternoon', label: 'Ca Chiều' },
    { id: 'Evening', label: 'Ca Tối' },
];

export default function ShiftReport() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/shift-attendance/my');
            if (res.data.success) {
                setLogs(res.data.data);
            }
        } catch (error) {
            toast.error("Không thể tải báo cáo");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => log.date.startsWith(filterMonth));
    }, [logs, filterMonth]);

    const stats = useMemo(() => {
        let total = filteredLogs.length;
        let onTime = 0;
        let late = 0;
        let missing = 0;

        filteredLogs.forEach(log => {
            if (log.status === 'On Time') onTime++;
            else if (log.status === 'Late') late++;
            else missing++;
        });

        return { total, onTime, late, missing };
    }, [filteredLogs]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Báo cáo cá nhân</h1>
                    <p className="text-slate-500 text-sm italic">Tổng hợp chuyên cần nhân sự thời vụ.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-600 font-bold px-4 py-3 rounded-2xl outline-none focus:ring-2 ring-indigo-500"
                    />
                    <button onClick={fetchLogs} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-400 transition-all">
                        <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-indigo-500 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">Tổng Ca Làm</p>
                                <h3 className="text-4xl font-black">{stats.total}</h3>
                            </div>
                            <Calendar className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-600/30 rotate-12" />
                        </div>
                        <div className="bg-emerald-500 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-emerald-200 text-xs font-black uppercase tracking-widest mb-1">Đúng Giờ</p>
                                <h3 className="text-4xl font-black">{stats.onTime}</h3>
                            </div>
                            <CheckCircle2 className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-600/30 rotate-12" />
                        </div>
                        <div className="bg-amber-500 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-amber-200 text-xs font-black uppercase tracking-widest mb-1">Đi Muộn / Sớm</p>
                                <h3 className="text-4xl font-black">{stats.late}</h3>
                            </div>
                            <Clock className="absolute -right-4 -bottom-4 w-24 h-24 text-amber-600/30 rotate-12" />
                        </div>
                        <div className="bg-rose-500 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-rose-200 text-xs font-black uppercase tracking-widest mb-1">Bất Thường</p>
                                <h3 className="text-4xl font-black">{stats.missing}</h3>
                            </div>
                            <AlertCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-rose-600/30 rotate-12" />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-500" /> Chi tiết công tháng
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-8 py-5">Ngày</th>
                                        <th className="px-6 py-5">Ca trực</th>
                                        <th className="px-6 py-5">Giờ vào</th>
                                        <th className="px-6 py-5">Giờ ra</th>
                                        <th className="px-8 py-5 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-slate-400 font-bold">Không có dữ liệu trong tháng này</td></tr>
                                    ) : filteredLogs.map((log) => (
                                        <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4">
                                                <span className="text-sm font-bold text-slate-800">{new Date(log.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black uppercase">
                                                    {SHIFT_OPTIONS.find(o => o.id === log.shift)?.label || log.shift}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.checkIn ? (
                                                    <span className="text-emerald-600 font-bold text-sm">{new Date(log.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                ) : <span className="text-slate-300">--:--</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.checkOut ? (
                                                    <span className="text-rose-500 font-bold text-sm">{new Date(log.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                ) : <span className="text-slate-300">--:--</span>}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                                    log.status === 'On Time' ? "bg-emerald-100 text-emerald-600" :
                                                    log.status === 'Late' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                                                )}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
