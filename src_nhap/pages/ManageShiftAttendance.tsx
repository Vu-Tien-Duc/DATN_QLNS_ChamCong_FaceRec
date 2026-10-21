import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import {
    BarChart3, Loader2, RefreshCcw, Search, MapPin, CheckCircle2, ShieldCheck, Calendar
} from 'lucide-react';
import { cn } from '../utils/cn';

const SHIFT_OPTIONS = [
    { id: 'Morning', label: 'Ca Sáng' },
    { id: 'Afternoon', label: 'Ca Chiều' },
    { id: 'Evening', label: 'Ca Tối' },
];

export default function ManageShiftAttendance() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/shift-attendance/all');
            if (res.data.success) {
                setLogs(res.data.data);
            }
        } catch (error) {
            toast.error("Không thể tải báo cáo hệ thống");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const inMonth = log.date.startsWith(filterMonth);
            const nameMatch = log.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
            return inMonth && (searchTerm === '' || nameMatch);
        });
    }, [logs, filterMonth, searchTerm]);

    const stats = useMemo(() => {
        const uniqueUsers = new Set(filteredLogs.map(l => l.user?._id)).size;
        const totalShifts = filteredLogs.length;
        let onTime = 0;
        let late = 0;
        filteredLogs.forEach(l => {
            if (l.status === 'On Time') onTime++;
            else if (l.status === 'Late') late++;
        });
        return { uniqueUsers, totalShifts, onTime, late };
    }, [filteredLogs]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quản lý & Phê duyệt Ca</h1>
                    <p className="text-slate-500 text-sm italic">Theo dõi báo cáo và chuyên cần của tất cả nhân sự thời vụ.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm tên nhân sự..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 ring-indigo-500 text-sm font-bold w-64"
                        />
                    </div>
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
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><ShieldCheck className="w-7 h-7" /></div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-400">Nhân sự tham gia</p>
                                <h3 className="text-2xl font-black text-slate-900">{stats.uniqueUsers}</h3>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center"><Calendar className="w-7 h-7" /></div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-400">Tổng ca đã làm</p>
                                <h3 className="text-2xl font-black text-slate-900">{stats.totalShifts}</h3>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-400">Đúng giờ</p>
                                <h3 className="text-2xl font-black text-slate-900">{stats.onTime}</h3>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center"><BarChart3 className="w-7 h-7" /></div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-400">Đi muộn/sớm</p>
                                <h3 className="text-2xl font-black text-slate-900">{stats.late}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-8 py-5">Nhân sự</th>
                                        <th className="px-6 py-5">Ngày & Ca</th>
                                        <th className="px-6 py-5">Check In</th>
                                        <th className="px-6 py-5">Check Out</th>
                                        <th className="px-8 py-5 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-slate-400 font-bold">Không có dữ liệu</td></tr>
                                    ) : filteredLogs.map((log) => (
                                        <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm uppercase">
                                                        {log.user?.fullName?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{log.user?.fullName}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">{log.user?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-sm text-slate-800">{new Date(log.date).toLocaleDateString('vi-VN')}</p>
                                                <span className="px-2 py-0.5 mt-1 inline-block bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase">
                                                    {SHIFT_OPTIONS.find(o => o.id === log.shift)?.label || log.shift}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.checkIn ? (
                                                    <div>
                                                        <span className="text-emerald-600 font-black text-sm">{new Date(log.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <p className="text-[9px] text-slate-400 w-32 truncate mt-1" title={log.checkIn.address}><MapPin className="w-3 h-3 inline mr-0.5"/>{log.checkIn.address}</p>
                                                    </div>
                                                ) : <span className="text-slate-300">--:--</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.checkOut ? (
                                                    <div>
                                                        <span className="text-rose-500 font-black text-sm">{new Date(log.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <p className="text-[9px] text-slate-400 w-32 truncate mt-1" title={log.checkOut.address}><MapPin className="w-3 h-3 inline mr-0.5"/>{log.checkOut.address}</p>
                                                    </div>
                                                ) : <span className="text-slate-300">--:--</span>}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                                    log.status === 'On Time' ? "bg-emerald-100 text-emerald-700" :
                                                    log.status === 'Late' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
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
