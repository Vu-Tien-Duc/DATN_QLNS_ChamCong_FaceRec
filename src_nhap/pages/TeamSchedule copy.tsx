// import React, { useState, useEffect, useCallback } from 'react';
// import { apiClient } from '../api/apiClient';
// import { ChevronLeft, ChevronRight, Users, Clock, Filter, Loader2, Search } from 'lucide-react';
// import { cn } from '../utils/cn'; // Hàm cn đã viết ở trên

// export default function TeamSchedule() {
//     const [loading, setLoading] = useState(true);
//     const [schedules, setSchedules] = useState<any[]>([]);
//     const [weekStart, setWeekStart] = useState(new Date()); // Logic getMonday...
//     const [searchTerm, setSearchTerm] = useState('');

//     const fetchTeamSchedules = useCallback(async () => {
//         setLoading(true);
//         try {
//             const res = await apiClient.get('/work-schedules/all', {
//                 params: { weekStart: weekStart.toISOString() }
//             });
//             setSchedules(res.data.data || []);
//         } finally { setLoading(false); }
//     }, [weekStart]);

//     useEffect(() => { fetchTeamSchedules(); }, [fetchTeamSchedules]);

//     return (
//         <div className="space-y-6">
//             <header>
//                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lịch trực toàn Team</h1>
//                 <p className="text-slate-500 text-sm">Tổng hợp lịch làm việc của tất cả nhân sự trong tuần.</p>
//             </header>

//             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
//                 <div className="flex gap-4 items-center">
//                    <button onClick={() => {/* logic lùi tuần */}} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft/></button>
//                    <span className="font-black text-indigo-600 uppercase text-xs tracking-widest">Tuần hiện tại</span>
//                    <button onClick={() => {/* logic tiến tuần */}} className="p-2 bg-slate-50 rounded-xl"><ChevronRight/></button>
//                 </div>
//                 <div className="relative w-64">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//                     <input type="text" placeholder="Tìm tên nhân sự..." className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
//                 </div>
//             </div>

//             <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
//                 <div className="overflow-x-auto">
//                     <table className="w-full text-left border-collapse">
//                         <thead className="bg-slate-900 text-white">
//                             <tr>
//                                 <th className="p-5 text-[10px] font-black uppercase sticky left-0 bg-slate-900 z-10">Nhân sự</th>
//                                 {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
//                                     <th key={d} className="p-5 text-[10px] font-black uppercase text-center border-l border-white/10">{d}</th>
//                                 ))}
//                             </tr>
//                         </thead>
//                         <tbody className="divide-y divide-slate-50">
//                             {schedules.map((staffSchedule) => (
//                                 <tr key={staffSchedule._id} className="hover:bg-slate-50/50 transition-colors">
//                                     <td className="p-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
//                                         <p className="font-bold text-slate-800 text-sm">{staffSchedule.staff?.fullName}</p>
//                                         <p className="text-[9px] text-slate-400 font-bold uppercase">{staffSchedule.staff?.department}</p>
//                                     </td>
//                                     {/* Giả định days là mảng 7 ngày */}
//                                     {staffSchedule.days?.map((day: any, i: number) => (
//                                         <td key={i} className="p-2 border-l border-slate-50">
//                                             <div className={cn(
//                                                 "py-2 rounded-xl text-[9px] font-black text-center uppercase transition-all",
//                                                 day.shift === 'Morning' ? "bg-blue-100 text-blue-600" :
//                                                 day.shift === 'Afternoon' ? "bg-emerald-100 text-emerald-600" :
//                                                 day.shift === 'Evening' ? "bg-indigo-100 text-indigo-600" : "text-slate-300"
//                                             )}>
//                                                 {day.shift !== 'Off' ? day.shift : '-'}
//                                             </div>
//                                         </td>
//                                     ))}
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         </div>
//     );
// }


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../api/apiClient';
import {
    ChevronLeft, ChevronRight, Users, Clock, Search,
    Loader2, CheckCircle2, XCircle, AlertCircle, MapPin,
    LogIn, LogOut, CalendarDays
} from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'react-hot-toast';

// Helper tính ngày Thứ 2 của tuần
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

const DAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

export default function TeamSchedule() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [weekStart, setWeekStart] = useState(getMonday(new Date()));
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Tạo danh sách 7 ngày trong tuần đang xem
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });
    }, [weekStart]);

    // const fetchData = useCallback(async () => {
    //     setLoading(true);
    //     try {
    //         const weekEnd = new Date(weekStart);
    //         weekEnd.setDate(weekStart.getDate() + 6);
    //         weekEnd.setHours(23, 59, 59);

    //         const [resUsers, resSchedules, resAttendance] = await Promise.all([
    //             apiClient.get('/users'),
    //             apiClient.get(`/work-schedules/all?weekStart=${weekStart.toISOString()}`),
    //             apiClient.get(`/timekeeping/history?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`)
    //         ]);

    //         if (resUsers.data.success) setUsers(resUsers.data.data);
    //         if (resSchedules.data.success) setSchedules(resSchedules.data.data);
    //         if (resAttendance.data.success) setAttendanceLogs(resAttendance.data.data);
    //     } catch (error) {
    //         toast.error("Không thể tải dữ liệu điều phối");
    //     } finally {
    //         setLoading(false);
    //     }
    // }, [weekStart]);


    const fetchData = useCallback(async () => {
        setLoading(true);

        // Tạo nhóm log lớn để dễ theo dõi trong Console
        console.group("🚀 [TeamSchedule] Bắt đầu tải dữ liệu tổng hợp");

        try {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59);

            console.log("📅 Tham số thời gian:", {
                weekStart_ISO: weekStart.toISOString(),
                weekStart_Local: weekStart.toLocaleDateString('vi-VN'),
                weekEnd_ISO: weekEnd.toISOString()
            });

            // Gọi đồng thời 3 API
            const [resUsers, resSchedules, resAttendance] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get(`/work-schedules/all?weekStart=${weekStart.toISOString()}`),
                apiClient.get(`/timekeeping/history?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`)
            ]);

            // LOG DỮ LIỆU NHÂN VIÊN
            console.group("👤 1. Dữ liệu Users (Nhân sự gốc)");
            console.log("Raw Response:", resUsers.data);
            if (resUsers.data.success) {
                console.log(`Số lượng nhân sự: ${resUsers.data.data.length}`);
                setUsers(resUsers.data.data);
            }
            console.groupEnd();

            // LOG DỮ LIỆU ĐĂNG KÝ LỊCH TUẦN
            console.group("📅 2. Dữ liệu Weekly Schedules (Lịch đã đăng ký)");
            console.log("Raw Response:", resSchedules.data);
            if (resSchedules.data.success) {
                console.log(`Số lượng bản ghi tuần: ${resSchedules.data.data.length}`);
                // Log thử bản ghi đầu tiên để check cấu trúc staff._id
                if (resSchedules.data.data.length > 0) {
                    console.log("Cấu trúc bản ghi lịch mẫu:", resSchedules.data.data[0]);
                }
                setSchedules(resSchedules.data.data);
            }
            console.groupEnd();

            // LOG DỮ LIỆU CHẤM CÔNG THỰC TẾ
            console.group("🕒 3. Dữ liệu Timekeeping (Check-in/Out thực tế)");
            console.log("Raw Response:", resAttendance.data);
            if (resAttendance.data.success) {
                console.log(`Số lượng log chấm công trong tuần: ${resAttendance.data.data.length}`);
                setAttendanceLogs(resAttendance.data.data);
            }
            console.groupEnd();

        } catch (error: any) {
            console.error("❌ Lỗi nghiêm trọng khi fetch dữ liệu:");
            if (error.response) {
                console.error("Dữ liệu lỗi từ Backend:", error.response.data);
                console.error("Mã lỗi HTTP:", error.response.status);
            } else {
                console.error("Lỗi kết nối/Code:", error.message);
            }
            toast.error("Không thể tải dữ liệu điều phối");
        } finally {
            setLoading(false);
            console.groupEnd(); // Kết thúc nhóm log lớn
        }
    }, [weekStart]);
    useEffect(() => { fetchData(); }, [fetchData]);

    // 2. Hàm định dạng thời gian
    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    // 3. Logic tìm kiếm nhân sự
    const filteredUsers = useMemo(() => {
        return users.filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [users, searchTerm]);

    const navigateWeek = (offset: number) => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setWeekStart(newDate);
    };

    return (
        <div className="space-y-6 pb-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Điều phối & Chấm công</h1>
                    <p className="text-slate-500 text-sm italic">Theo dõi lịch đăng ký và tình hình có mặt thực tế của nhân sự.</p>
                </div>
            </header>

            {/* Toolbar & Filter */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="text-center min-w-[180px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tuần đang xem</p>
                        <p className="text-xs font-black text-indigo-600">
                            {weekStart.toLocaleDateString('vi-VN')} - {weekDays[6].toLocaleDateString('vi-VN')}
                        </p>
                    </div>
                    <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronRight className="w-5 h-5" /></button>
                </div>

                <div className="relative w-full lg:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên nhân viên..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm border-b-8 border-b-indigo-600">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] sticky left-0 bg-slate-900 z-20 w-64 border-r border-white/5">Nhân sự</th>
                                {weekDays.map((date, idx) => (
                                    <th key={idx} className="p-4 text-center border-l border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{DAY_LABELS[idx]}</p>
                                        <p className="text-sm font-black">{date.getDate()}/{date.getMonth() + 1}</p>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></td></tr>
                            ) : filteredUsers.map((u) => {
                                // Tìm dữ liệu đăng ký tuần của User này
                                const staffSchedule = schedules.find(s => s.staff?._id === u._id);

                                return (
                                    <tr key={u._id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* Cột Tên nhân sự */}
                                        <td className="p-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs border border-indigo-100">
                                                    {u.fullName?.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-sm truncate">{u.fullName}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{u.role?.name || 'Nhân viên'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7 Cột ngày trong tuần */}
                                        {weekDays.map((date, dayIdx) => {
                                            const dateStr = date.toISOString().split('T')[0];

                                            // 1. Lấy thông tin ca làm việc đã đăng ký
                                            const registeredDay = staffSchedule?.days?.find((d: any) => d.date.startsWith(dateStr));
                                            const shift = registeredDay?.shift || 'Off';

                                            // 2. Lấy thông tin chấm công thực tế
                                            const checkInLog = attendanceLogs.find(l =>
                                                l.staff?._id === u._id &&
                                                new Date(l.date).toISOString().split('T')[0] === dateStr
                                            );

                                            // 3. Logic màu sắc & Trạng thái
                                            const isToday = dateStr === new Date().toISOString().split('T')[0];
                                            const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));

                                            let cellBg = "bg-white";
                                            let statusText = "";

                                            if (shift === 'Off') {
                                                cellBg = "bg-slate-50 text-slate-300";
                                                statusText = "Nghỉ";
                                            } else {
                                                // Có đăng ký đi làm
                                                if (checkInLog) {
                                                    cellBg = checkInLog.status === 'Late' ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
                                                } else if (isPast) {
                                                    cellBg = "bg-rose-50 border-rose-200"; // Đăng ký mà không đi (Vắng)
                                                } else if (isToday) {
                                                    cellBg = "bg-indigo-50 border-indigo-200 animate-pulse"; // Đang chờ đến
                                                }
                                            }

                                            return (
                                                <td key={dayIdx} className="p-2 border-l border-slate-50 align-top">
                                                    <div className={cn(
                                                        "h-full min-h-[80px] rounded-2xl border-2 p-2 flex flex-col justify-between transition-all",
                                                        cellBg,
                                                        shift === 'Off' ? "border-transparent" : "border-dashed"
                                                    )}>
                                                        <div className="flex justify-between items-start">
                                                            <span className={cn(
                                                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                                                shift === 'Morning' ? "bg-blue-100 text-blue-600" :
                                                                    shift === 'Afternoon' ? "bg-teal-100 text-teal-600" :
                                                                        shift === 'Evening' ? "bg-purple-100 text-purple-600" :
                                                                            shift === 'Full-day' ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
                                                            )}>
                                                                {shift}
                                                            </span>
                                                            {checkInLog && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                                            {shift !== 'Off' && !checkInLog && isPast && <XCircle className="w-3 h-3 text-rose-400" />}
                                                        </div>

                                                        {checkInLog ? (
                                                            <div className="mt-2 space-y-0.5">
                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                                                                    <LogIn className="w-2.5 h-2.5" /> {formatTime(checkInLog.checkIn)}
                                                                </div>
                                                                {checkInLog.checkOut && (
                                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-600">
                                                                        <LogOut className="w-2.5 h-2.5" /> {formatTime(checkInLog.checkOut)}
                                                                    </div>
                                                                )}
                                                                {checkInLog.status === 'Late' && (
                                                                    <span className="text-[7px] bg-amber-500 text-white px-1 rounded-sm font-black uppercase">Muộn</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            shift !== 'Off' && (
                                                                <div className="mt-auto text-center">
                                                                    <p className={cn(
                                                                        "text-[8px] font-black uppercase",
                                                                        isPast ? "text-rose-500" : "text-slate-400"
                                                                    )}>
                                                                        {isPast ? "Vắng mặt" : "Chưa tới"}
                                                                    </p>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chú thích màu sắc (Legend) */}
            <div className="flex flex-wrap gap-4 justify-center p-6 bg-slate-50 rounded-xs border border-slate-200">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                    <div className="w-3 h-3 bg-white border-2 border-slate-200 rounded-full" /> Không lịch
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500">
                    <div className="w-3 h-3 bg-indigo-50 border-2 border-indigo-200 rounded-full" /> Có lịch (Chưa đến)
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600">
                    <div className="w-3 h-3 bg-emerald-50 border-2 border-emerald-200 rounded-full" /> Đã có mặt
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-600">
                    <div className="w-3 h-3 bg-rose-50 border-2 border-rose-200 rounded-full" /> Vắng mặt (Có lịch)
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-600">
                    <div className="w-3 h-3 bg-amber-50 border-2 border-amber-200 rounded-full" /> Đi muộn
                </div>
            </div>
        </div>
    );
}