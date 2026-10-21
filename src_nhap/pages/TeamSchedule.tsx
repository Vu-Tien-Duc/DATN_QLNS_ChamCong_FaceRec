

// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { apiClient } from '../api/apiClient';
// import {
//     ChevronLeft, ChevronRight, Users, Clock, Search,
//     Loader2, CheckCircle2, XCircle, AlertCircle, MapPin,
//     LogIn, LogOut, CalendarDays
// } from 'lucide-react';
// import { cn } from '../utils/cn';
// import { toast } from 'react-hot-toast';

// // Helper tính ngày Thứ 2 của tuần
// const getMonday = (d: Date) => {
//     const date = new Date(d);
//     const day = date.getDay();
//     const diff = date.getDate() - day + (day === 0 ? -6 : 1);
//     const monday = new Date(date.setDate(diff));
//     monday.setHours(0, 0, 0, 0);
//     return monday;
// };

// const DAY_LABELS =['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

// export default function TeamSchedule() {
//     const [loading, setLoading] = useState(true);
//     const [users, setUsers] = useState<any[]>([]);
//     const [schedules, setSchedules] = useState<any[]>([]);
//     const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
//     const [weekStart, setWeekStart] = useState(getMonday(new Date()));
//     const [searchTerm, setSearchTerm] = useState('');

//     // 1. Tạo danh sách 7 ngày trong tuần đang xem
//     const weekDays = useMemo(() => {
//         return Array.from({ length: 7 }, (_, i) => {
//             const d = new Date(weekStart);
//             d.setDate(weekStart.getDate() + i);
//             return d;
//         });
//     }, [weekStart]);

//     const fetchData = useCallback(async () => {
//         setLoading(true);

//         // Tạo nhóm log lớn để dễ theo dõi trong Console
//         console.group("🚀 [TeamSchedule] Bắt đầu tải dữ liệu tổng hợp");

//         try {
//             const weekEnd = new Date(weekStart);
//             weekEnd.setDate(weekStart.getDate() + 6);
//             weekEnd.setHours(23, 59, 59);

//             console.log("📅 Tham số thời gian:", {
//                 weekStart_ISO: weekStart.toISOString(),
//                 weekStart_Local: weekStart.toLocaleDateString('vi-VN'),
//                 weekEnd_ISO: weekEnd.toISOString()
//             });

//             // Gọi đồng thời 3 API
//             const[resUsers, resSchedules, resAttendance] = await Promise.all([
//                 apiClient.get('/users'),
//                 apiClient.get(`/work-schedules/all?weekStart=${weekStart.toISOString()}`),
//                 apiClient.get(`/timekeeping/history?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`)
//             ]);

//             // LOG DỮ LIỆU NHÂN VIÊN
//             console.group("👤 1. Dữ liệu Users (Nhân sự gốc)");
//             console.log("Raw Response:", resUsers.data);
//             if (resUsers.data.success) {
//                 // Tiền xử lý: Lọc bỏ những user có role là Student hoặc Teacher
//                 const filteredStaff = resUsers.data.data.filter((u: any) => {
//                     const roleName = (typeof u.role === 'object' ? u.role?.name : u.role) || '';
//                     const lowerRole = roleName.toLowerCase();
//                     return lowerRole !== 'student' && lowerRole !== 'teacher';
//                 });

//                 console.log(`Số lượng nhân sự sau khi lọc (ẩn Student/Teacher): ${filteredStaff.length}`);
//                 setUsers(filteredStaff);
//             }
//             console.groupEnd();

//             // LOG DỮ LIỆU ĐĂNG KÝ LỊCH TUẦN
//             console.group("📅 2. Dữ liệu Weekly Schedules (Lịch đã đăng ký)");
//             console.log("Raw Response:", resSchedules.data);
//             if (resSchedules.data.success) {
//                 console.log(`Số lượng bản ghi tuần: ${resSchedules.data.data.length}`);
//                 // Log thử bản ghi đầu tiên để check cấu trúc staff._id
//                 if (resSchedules.data.data.length > 0) {
//                     console.log("Cấu trúc bản ghi lịch mẫu:", resSchedules.data.data[0]);
//                 }
//                 setSchedules(resSchedules.data.data);
//             }
//             console.groupEnd();

//             // LOG DỮ LIỆU CHẤM CÔNG THỰC TẾ
//             console.group("🕒 3. Dữ liệu Timekeeping (Check-in/Out thực tế)");
//             console.log("Raw Response:", resAttendance.data);
//             if (resAttendance.data.success) {
//                 console.log(`Số lượng log chấm công trong tuần: ${resAttendance.data.data.length}`);
//                 setAttendanceLogs(resAttendance.data.data);
//             }
//             console.groupEnd();

//         } catch (error: any) {
//             console.error("❌ Lỗi nghiêm trọng khi fetch dữ liệu:");
//             if (error.response) {
//                 console.error("Dữ liệu lỗi từ Backend:", error.response.data);
//                 console.error("Mã lỗi HTTP:", error.response.status);
//             } else {
//                 console.error("Lỗi kết nối/Code:", error.message);
//             }
//             toast.error("Không thể tải dữ liệu điều phối");
//         } finally {
//             setLoading(false);
//             console.groupEnd(); // Kết thúc nhóm log lớn
//         }
//     }, [weekStart]);

//     useEffect(() => { fetchData(); },[fetchData]);

//     // 2. Hàm định dạng thời gian
//     const formatTime = (dateStr: string | null) => {
//         if (!dateStr) return '';
//         return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
//     };

//     // 3. Logic tìm kiếm nhân sự
//     const filteredUsers = useMemo(() => {
//         return users.filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
//     },[users, searchTerm]);

//     const navigateWeek = (offset: number) => {
//         const newDate = new Date(weekStart);
//         newDate.setDate(newDate.getDate() + (offset * 7));
//         setWeekStart(newDate);
//     };

//     return (
//         <div className="space-y-6 pb-10">
//             <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
//                 <div>
//                     <h1 className="text-3xl font-black text-slate-900 tracking-tight">Điều phối & Chấm công</h1>
//                     <p className="text-slate-500 text-sm italic">Theo dõi lịch đăng ký và tình hình có mặt thực tế của nhân sự.</p>
//                 </div>
//             </header>

//             {/* Toolbar & Filter */}
//             <div className="bg-white p-4  border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
//                 <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
//                     <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
//                     <div className="text-center min-w-[180px]">
//                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tuần đang xem</p>
//                         <p className="text-xs font-black text-indigo-600">
//                             {weekStart.toLocaleDateString('vi-VN')} - {weekDays[6].toLocaleDateString('vi-VN')}
//                         </p>
//                     </div>
//                     <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ChevronRight className="w-5 h-5" /></button>
//                 </div>

//                 <div className="relative w-full lg:w-96">
//                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
//                     <input
//                         type="text"
//                         placeholder="Tìm theo tên nhân viên..."
//                         className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
//                         value={searchTerm}
//                         onChange={e => setSearchTerm(e.target.value)}
//                     />
//                 </div>
//             </div>

//             {/* Matrix Table */}
//             <div className="bg-white  border border-slate-100 overflow-hidden shadow-sm border-b-8 border-b-orange-600">
//                 <div className="overflow-x-auto">
//                     <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
//                         <thead>
//                             <tr className="bg-emerald-600 text-white">
//                                 <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] sticky left-0 bg-emerald-600 z-20 w-64 border-r border-white/5">Nhân sự</th>
//                                 {weekDays.map((date, idx) => (
//                                     <th key={idx} className="p-4 text-center border-l border-white/5">
//                                         <p className="text-[10px] font-black uppercase tracking-widest text-white">{DAY_LABELS[idx]}</p>
//                                         <p className="text-sm font-black">{date.getDate()}/{date.getMonth() + 1}</p>
//                                     </th>
//                                 ))}
//                             </tr>
//                         </thead>

//                         <tbody className="divide-y divide-slate-50">
//                             {loading ? (
//                                 <tr>
//                                     <td colSpan={8} className="py-20 text-center">
//                                         <Loader2 className="animate-spin mx-auto text-indigo-500" />
//                                     </td>
//                                 </tr>
//                             ) : filteredUsers.map((u) => {
//                                 // 1. Tìm bản ghi đăng ký tuần của User này (So sánh ID an toàn)
//                                 const staffSchedule = schedules.find(s =>
//                                     (s.staff?._id || s.staff) === u._id
//                                 );

//                                 return (
//                                     <tr key={u._id} className="hover:bg-slate-50/50 transition-colors group">
//                                         {/* Cột Tên nhân sự */}
//                                         <td className="p-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-sm">
//                                             <div className="flex items-center gap-3">
//                                                 <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-orange-600 flex items-center justify-center font-black text-xs border border-indigo-100">
//                                                     {u.fullName?.charAt(0)}
//                                                 </div>
//                                                 <div className="min-w-0">
//                                                     <p className="font-black text-slate-800 text-sm truncate">{u.fullName}</p>
//                                                     {/* u.role có thể là object (name) hoặc string tùy vào populate */}
//                                                     <p className="text-[9px] text-slate-400 font-bold uppercase">
//                                                         {typeof u.role === 'object' ? u.role.name : (u.role || 'Nhân viên')}
//                                                     </p>
//                                                 </div>
//                                             </div>
//                                         </td>

//                                         {/* 7 Cột ngày trong tuần */}
//                                         {weekDays.map((date, dayIdx) => {
//                                             // Chuyển ngày hiện tại đang render sang dạng YYYY-MM-DD
//                                             const dateStr = date.toISOString().split('T')[0];

//                                             // 1. Tìm xem ngày này có đăng ký ca làm không
//                                             const registeredDay = staffSchedule?.days?.find((d: any) => {
//                                                 if (!d.date) return false;
//                                                 return new Date(d.date).toISOString().split('T')[0] === dateStr;
//                                             });
//                                             const shift = registeredDay?.shift || 'Off';

//                                             // 2. Tìm bản ghi chấm công (Check-in) thực tế
//                                             const checkInLog = attendanceLogs.find(l => {
//                                                 const logStaffId = l.staff?._id || l.staff;
//                                                 const logDate = new Date(l.date).toISOString().split('T')[0];
//                                                 return logStaffId === u._id && logDate === dateStr;
//                                             });

//                                             // 3. Xác định trạng thái thời gian
//                                             const todayObj = new Date();
//                                             todayObj.setHours(0, 0, 0, 0);
//                                             const cellDateObj = new Date(dateStr);

//                                             const isToday = cellDateObj.getTime() === todayObj.getTime();
//                                             const isPast = cellDateObj.getTime() < todayObj.getTime();

//                                             // 4. Logic UI
//                                             let cellBg = "bg-white";
//                                             let borderStyle = "border-slate-100";

//                                             if (shift === 'Off') {
//                                                 cellBg = "bg-slate-50/50 text-slate-300";
//                                                 borderStyle = "border-transparent";
//                                             } else {
//                                                 // CÓ ĐĂNG KÝ ĐI LÀM
//                                                 borderStyle = "border-dashed border-indigo-200";
//                                                 if (checkInLog) {
//                                                     // Đã đi làm
//                                                     cellBg = checkInLog.status === 'Late' ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
//                                                     borderStyle = "border-solid";
//                                                 } else if (isPast) {
//                                                     // Quá khứ: Đăng ký nhưng không đi (Vắng)
//                                                     cellBg = "bg-rose-50 border-rose-200";
//                                                 } else if (isToday) {
//                                                     // Hôm nay: Đang chờ đến
//                                                     cellBg = "bg-indigo-50 border-indigo-200 animate-pulse";
//                                                 } else {
//                                                     // Tương lai
//                                                     cellBg = "bg-white border-slate-200";
//                                                 }
//                                             }

//                                             return (
//                                                 <td key={dayIdx} className="p-2 border-l border-slate-50 align-top">
//                                                     <div className={cn(
//                                                         "h-full min-h-[90px]  border-2 p-2 flex flex-col justify-between transition-all shadow-sm",
//                                                         cellBg,
//                                                         borderStyle
//                                                     )}>
//                                                         <div className="flex justify-between items-start">
//                                                             <span className={cn(
//                                                                 "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
//                                                                 shift === 'Morning' ? "bg-blue-100 text-blue-600" :
//                                                                     shift === 'Afternoon' ? "bg-teal-100 text-teal-600" :
//                                                                         shift === 'Evening' ? "bg-purple-100 text-purple-600" :
//                                                                             shift === 'Full-day' ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
//                                                             )}>
//                                                                 {shift === 'Off' ? 'Nghỉ' : shift}
//                                                             </span>

//                                                             {/* Icon trạng thái */}
//                                                             {checkInLog ? (
//                                                                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
//                                                             ) : (
//                                                                 shift !== 'Off' && isPast && <XCircle className="w-3.5 h-3.5 text-rose-400" />
//                                                             )}
//                                                         </div>

//                                                         {/* Thông tin giờ giấc */}
//                                                         {checkInLog ? (
//                                                             <div className="mt-2 space-y-1">
//                                                                 <div className="flex items-center gap-1 text-[9px] font-black text-emerald-700">
//                                                                     <LogIn className="w-2.5 h-2.5" /> {formatTime(checkInLog.checkIn)}
//                                                                 </div>
//                                                                 {checkInLog.checkOut && (
//                                                                     <div className="flex items-center gap-1 text-[9px] font-black text-rose-600">
//                                                                         <LogOut className="w-2.5 h-2.5" /> {formatTime(checkInLog.checkOut)}
//                                                                     </div>
//                                                                 )}
//                                                                 {checkInLog.status === 'Late' && (
//                                                                     <div className="flex items-center gap-1 text-[7px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black uppercase w-fit">
//                                                                         <AlertCircle className="w-2 h-2" /> Muộn
//                                                                     </div>
//                                                                 )}
//                                                             </div>
//                                                         ) : (
//                                                             shift !== 'Off' && (
//                                                                 <div className="mt-auto text-center pb-1">
//                                                                     <p className={cn(
//                                                                         "text-[9px] font-black uppercase tracking-tighter",
//                                                                         isPast ? "text-rose-500" : "text-slate-400"
//                                                                     )}>
//                                                                         {isPast ? "Vắng mặt" : isToday ? "Chờ ca..." : "Sắp tới"}
//                                                                     </p>
//                                                                 </div>
//                                                             )
//                                                         )}
//                                                     </div>
//                                                 </td>
//                                             );
//                                         })}
//                                     </tr>
//                                 );
//                             })}
//                         </tbody>

//                     </table>
//                 </div>
//             </div>

//             {/* Chú thích màu sắc (Legend) */}
//             <div className="flex flex-wrap gap-4 justify-center p-6 bg-slate-50 rounded-xs border border-slate-200">
//                 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
//                     <div className="w-3 h-3 bg-white border-2 border-slate-200 rounded-full" /> Không lịch
//                 </div>
//                 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500">
//                     <div className="w-3 h-3 bg-indigo-50 border-2 border-indigo-200 rounded-full" /> Có lịch (Chưa đến)
//                 </div>
//                 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600">
//                     <div className="w-3 h-3 bg-emerald-50 border-2 border-emerald-200 rounded-full" /> Đã có mặt
//                 </div>
//                 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-600">
//                     <div className="w-3 h-3 bg-rose-50 border-2 border-rose-200 rounded-full" /> Vắng mặt (Có lịch)
//                 </div>
//                 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-600">
//                     <div className="w-3 h-3 bg-amber-50 border-2 border-amber-200 rounded-full" /> Đi muộn
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

// Helper lấy chuỗi YYYY-MM-DD chuẩn múi giờ địa phương (Tránh lỗi timezone)
const getLocalDateStr = (d: Date | string) => {
    if (!d) return '';
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
            if (resUsers.data.success) {
                // Tiền xử lý: Lọc bỏ những user có role là Student hoặc Teacher
                const filteredStaff = resUsers.data.data.filter((u: any) => {
                    const roleName = (typeof u.role === 'object' ? u.role?.name : u.role) || '';
                    const lowerRole = roleName.toLowerCase();
                    return lowerRole !== 'student' && lowerRole !== 'teacher';
                });

                console.log(`Số lượng nhân sự sau khi lọc (ẩn Student/Teacher): ${filteredStaff.length}`);
                setUsers(filteredStaff);
            }
            console.groupEnd();

            // LOG DỮ LIỆU ĐĂNG KÝ LỊCH TUẦN
            console.group("📅 2. Dữ liệu Weekly Schedules (Lịch đã đăng ký)");
            if (resSchedules.data.success) {
                console.log(`Số lượng bản ghi tuần: ${resSchedules.data.data.length}`);
                setSchedules(resSchedules.data.data);
            }
            console.groupEnd();

            // LOG DỮ LIỆU CHẤM CÔNG THỰC TẾ
            console.group("🕒 3. Dữ liệu Timekeeping (Check-in/Out thực tế)");
            if (resAttendance.data.success) {
                console.log(`Số lượng log chấm công trong tuần: ${resAttendance.data.data.length}`);
                setAttendanceLogs(resAttendance.data.data);
            }
            console.groupEnd();

        } catch (error: any) {
            console.error("❌ Lỗi nghiêm trọng khi fetch dữ liệu:");
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
            <div className="bg-white p-4 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
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
            <div className="bg-white border border-slate-100 overflow-hidden shadow-sm border-b-8 border-b-orange-600">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                        <thead>
                            <tr className="bg-emerald-600 text-white">
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] sticky left-0 bg-emerald-600 z-20 w-64 border-r border-white/5">Nhân sự</th>
                                {weekDays.map((date, idx) => (
                                    <th key={idx} className="p-4 text-center border-l border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{DAY_LABELS[idx]}</p>
                                        <p className="text-sm font-black">{date.getDate()}/{date.getMonth() + 1}</p>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 w-8 h-8" />
                                        <p className="text-sm text-slate-400 mt-2">Đang tải dữ liệu chấm công...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.map((u) => {
                                return (
                                    <tr key={u._id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* Cột Tên nhân sự */}
                                        <td className="p-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-orange-600 flex items-center justify-center font-black text-xs border border-indigo-100">
                                                    {u.fullName?.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-sm truncate">{u.fullName}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">
                                                        {typeof u.role === 'object' ? u.role.name : (u.role || 'Nhân viên')}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7 Cột ngày trong tuần */}
                                        {weekDays.map((date, dayIdx) => {
                                            const dateStr = getLocalDateStr(date);
                                            const todayStr = getLocalDateStr(new Date());

                                            // 1. Tìm xem user CÓ ĐĂNG KÝ lịch vào ngày này không
                                            // Hỗ trợ cả 2 định dạng data: API trả về mảng trực tiếp có date, hoặc mảng days gộp theo staff
                                            let shifts: string[] = [];

                                            // Format 1: Từng bản ghi lẻ (Giống WorkSchedule)
                                            const daySchedule = schedules.find(s => {
                                                const sStaffId = s.staff?._id || s.staff;
                                                const sDate = s.date ? getLocalDateStr(s.date) : '';
                                                return sStaffId === u._id && sDate === dateStr;
                                            });

                                            if (daySchedule && daySchedule.shifts) {
                                                shifts = daySchedule.shifts;
                                            } else {
                                                // Format 2: Group theo staff (Giống logic cũ của bạn)
                                                const staffSchedAgg = schedules.find(s => (s.staff?._id || s.staff) === u._id);
                                                if (staffSchedAgg && staffSchedAgg.days) {
                                                    const regDay = staffSchedAgg.days.find((d: any) => getLocalDateStr(d.date) === dateStr);
                                                    if (regDay && regDay.shift && regDay.shift !== 'Off') {
                                                        // Đưa vào mảng để dùng chung logic giao diện
                                                        shifts = [regDay.shift];
                                                    }
                                                }
                                            }

                                            const hasShift = shifts.length > 0;

                                            // 2. Tìm xem user CÓ CHECK-IN (chấm công) vào ngày này không
                                            const checkInLog = attendanceLogs.find(l => {
                                                const lStaffId = l.staff?._id || l.staff;
                                                const lDate = getLocalDateStr(l.date);
                                                return lStaffId === u._id && lDate === dateStr;
                                            });

                                            // 3. Xác định thời gian
                                            const isToday = dateStr === todayStr;
                                            const isPast = dateStr < todayStr;

                                            // 4. XÁC ĐỊNH TRẠNG THÁI (STATE MACHINE)
                                            let state = 'UNREGISTERED';

                                            if (hasShift) {
                                                if (checkInLog) {
                                                    state = checkInLog.status === 'Late' ? 'LATE' : 'ON_TIME';
                                                } else {
                                                    if (isPast) state = 'ABSENT';
                                                    else if (isToday) state = 'WAITING';
                                                    else state = 'FUTURE';
                                                }
                                            } else {
                                                if (checkInLog) state = 'UNSCHEDULED_WORK';
                                            }

                                            // 5. Setup UI Class
                                            let cellBg = "bg-white";
                                            let borderStyle = "border-slate-100";
                                            let statusText = "";

                                            switch (state) {
                                                case 'UNREGISTERED':
                                                    cellBg = "bg-slate-50/30";
                                                    borderStyle = "border-transparent";
                                                    statusText = "Không có lịch";
                                                    break;
                                                case 'FUTURE':
                                                    cellBg = "bg-white";
                                                    borderStyle = "border-dashed border-slate-200";
                                                    statusText = "Sắp tới";
                                                    break;
                                                case 'WAITING':
                                                    cellBg = "bg-indigo-50/50";
                                                    borderStyle = "border-dashed border-indigo-300 animate-pulse";
                                                    statusText = "Chờ vào ca";
                                                    break;
                                                case 'ON_TIME':
                                                    cellBg = "bg-emerald-50/70";
                                                    borderStyle = "border-solid border-emerald-300";
                                                    break;
                                                case 'LATE':
                                                    cellBg = "bg-amber-50/70";
                                                    borderStyle = "border-solid border-amber-300";
                                                    break;
                                                case 'ABSENT':
                                                    cellBg = "bg-rose-50/70";
                                                    borderStyle = "border-solid border-rose-300";
                                                    statusText = "Vắng mặt";
                                                    break;
                                                case 'UNSCHEDULED_WORK':
                                                    cellBg = "bg-teal-50/70";
                                                    borderStyle = "border-solid border-teal-300";
                                                    break;
                                            }

                                            return (
                                                <td key={dayIdx} className="p-2 border-l border-slate-50 align-top">
                                                    <div className={cn(
                                                        "h-full min-h-[100px] border-[1.5px] p-2.5 rounded-xl flex flex-col justify-between transition-all shadow-sm",
                                                        cellBg,
                                                        borderStyle
                                                    )}>
                                                        {/* Dòng 1: Tags ca làm việc & Icon Trạng thái */}
                                                        <div className="flex justify-between items-start gap-1">
                                                            <div className="flex flex-wrap gap-1">
                                                                {shifts.map((shift: string) => (
                                                                    <span key={shift} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-white shadow-sm tracking-tighter">
                                                                        {shift === 'Morning' ? 'Sáng' : shift === 'Afternoon' ? 'Chiều' : shift === 'Evening' ? 'Tối' : shift === 'Full-day' ? 'Cả ngày' : shift}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            {/* Icons bên góc phải */}
                                                            {state === 'ON_TIME' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                                                            {state === 'LATE' && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                                                            {state === 'ABSENT' && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                                                            {state === 'UNSCHEDULED_WORK' && <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />}
                                                        </div>

                                                        {/* Dòng 2: Nội dung Log giờ / Thông báo */}
                                                        <div className="mt-3">
                                                            {(state === 'ON_TIME' || state === 'LATE' || state === 'UNSCHEDULED_WORK') ? (
                                                                <div className="space-y-1 bg-white/60 p-1.5 rounded-lg border border-white">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700">
                                                                        <LogIn className="w-3 h-3 text-emerald-600" /> {formatTime(checkInLog.checkIn)}
                                                                    </div>
                                                                    {checkInLog.checkOut && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700">
                                                                            <LogOut className="w-3 h-3 text-rose-500" /> {formatTime(checkInLog.checkOut)}
                                                                        </div>
                                                                    )}
                                                                    {/* Badge nếu đi muộn / Hoặc đi làm ngoài lịch */}
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {state === 'LATE' && (
                                                                            <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Muộn</span>
                                                                        )}
                                                                        {state === 'UNSCHEDULED_WORK' && (
                                                                            <span className="text-[8px] bg-teal-500 text-white px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Làm ngoài lịch</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className={cn(
                                                                    "text-[9px] font-black uppercase tracking-widest text-center mt-4",
                                                                    state === 'UNREGISTERED' ? "text-slate-300" :
                                                                        state === 'ABSENT' ? "text-rose-500" :
                                                                            state === 'WAITING' ? "text-indigo-400" : "text-slate-400"
                                                                )}>
                                                                    {statusText}
                                                                </p>
                                                            )}
                                                        </div>
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
            <div className="flex flex-wrap gap-4 justify-center p-6 bg-slate-50 rounded-[2rem] border border-slate-200 mt-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <div className="w-4 h-4 bg-slate-100 rounded-lg" /> Không đăng ký
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <div className="w-4 h-4 bg-white border-2 border-dashed border-slate-300 rounded-lg" /> Có lịch sắp tới
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    <div className="w-4 h-4 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-lg" /> Chờ đi làm
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    <div className="w-4 h-4 bg-emerald-50 border-2 border-solid border-emerald-300 rounded-lg" /> Đi làm đúng giờ
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600">
                    <div className="w-4 h-4 bg-amber-50 border-2 border-solid border-amber-300 rounded-lg" /> Đi muộn
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600">
                    <div className="w-4 h-4 bg-rose-50 border-2 border-solid border-rose-300 rounded-lg" /> Vắng mặt (Có lịch)
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-600">
                    <div className="w-4 h-4 bg-teal-50 border-2 border-solid border-teal-300 rounded-lg" /> Tăng ca (Không lịch)
                </div>
            </div>
        </div>
    );
}