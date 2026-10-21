import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter,
  Search, Clock, MapPin, User, BookOpen, Loader2,
  CheckCircle2, XCircle, Building2, DoorOpen,
  RefreshCcw,
  Trash2
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Portal } from '../components/Portal';
import { Modal } from '../components/Modal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TimeSlot = 'Morning' | 'Afternoon' | 'Evening';

const timeSlots: { label: string, value: TimeSlot, range: string }[] = [
  { label: 'Sáng', value: 'Morning', range: '08:00 - 12:00' },
  { label: 'Chiều', value: 'Afternoon', range: '13:00 - 17:00' },
  { label: 'Tối', value: 'Evening', range: '18:00 - 22:00' }
];

// Helper: Chuyển Date object sang chuỗi YYYY-MM-DD chuẩn địa phương (VN)
const getLocalDateFormat = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Schedule() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'list'>('day');
  const [selectedDate, setSelectedDate] = useState(getLocalDateFormat(new Date()));
  const [startDate, setStartDate] = useState(getLocalDateFormat(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getLocalDateFormat(d);
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('all');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Dữ liệu nền
  // const fetchMetadata = useCallback(async () => {
  //   try {
  //     const [resC, resT, resR] = await Promise.all([
  //       apiClient.get('/campuses'),
  //       apiClient.get('/users'),
  //       apiClient.get('/rooms')
  //     ]);
  //     if (resC.data.success) setCampuses(resC.data.data);
  //     if (resT.data.success) setTeachers(resT.data.data.filter((u: any) => u.role?.name?.toLowerCase().includes('teacher') || (u.roles && u.roles.includes('teacher'))));
  //     if (resR.data.success) setRooms(resR.data.data);
  //   } catch (error) {
  //     console.error("Metadata error:", error);
  //   }
  // }, []);


  // Thêm state
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // State cho Modal chỉnh sửa
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Cập nhật fetchMetadata để lấy danh sách lớp
  const fetchMetadata = useCallback(async () => {
    try {
      const [resC, resT, resR, resCls] = await Promise.all([
        apiClient.get('/campuses'),
        apiClient.get('/teachers'),
        apiClient.get('/rooms'),
        apiClient.get('/classes') // Thêm API lấy classes
      ]);
      setCampuses(resC.data.data);
      setTeachers(resT.data.data);
      setRooms(resR.data.data);
      setClasses(resCls.data.data); // Lưu list lớp
    } catch (error) { toast.error("Lỗi tải Metadata"); }
  }, []);



  // 1. Fetch Dữ liệu nền (Cơ sở, Giảng viên, Phòng học)
  // const fetchMetadata = useCallback(async () => {
  //   try {
  //     // Gọi đồng thời các API để tối ưu tốc độ
  //     const [resC, resT, resR] = await Promise.all([
  //       apiClient.get('/campuses'),
  //       apiClient.get('/teachers'), // Gọi trực tiếp API quản lý giảng viên
  //       apiClient.get('/rooms')
  //     ]);

  //     // Cập nhật danh sách cơ sở
  //     if (resC.data.success) {
  //       setCampuses(resC.data.data);
  //     }

  //     // Cập nhật danh sách giảng viên (Lấy toàn bộ từ bảng Teacher)
  //     if (resT.data.success) {
  //       console.log("📊 Đã tải danh sách giảng viên:", resT.data.data.length);
  //       setTeachers(resT.data.data);
  //     }

  //     // Cập nhật danh sách phòng học
  //     if (resR.data.success) {
  //       setRooms(resR.data.data);
  //     }
  //   } catch (error) {
  //     console.error("❌ Lỗi tải Metadata:", error);
  //     toast.error("Không thể tải thông tin cấu hình bộ lọc");
  //   }
  // }, []);

  // 2. Fetch Lịch học
  // const fetchSchedules = useCallback(async () => {
  //   try {
  //     setLoading(true);
  //     // Gọi API lấy toàn bộ, logic lọc sẽ thực hiện ở useMemo để mượt mà hơn
  //     const res = await apiClient.get('/schedules');
  //     if (res.data.success) {
  //       setSchedules(res.data.data);
  //     }
  //   } catch (error) {
  //     toast.error("Không thể tải lịch giảng dạy");
  //   } finally {
  //     setLoading(false);
  //   }
  // }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/schedules');
      if (res.data.success) {
        console.log("Dữ liệu thô từ API:", res.data.data); // Kiểm tra log này xem có lặp không
        setSchedules(res.data.data);
      }
    } catch (error) {
      toast.error("Không thể tải lịch giảng dạy");
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => {
    fetchMetadata();
    fetchSchedules();
  }, [fetchMetadata, fetchSchedules]);

  // --- Logic Helpers ---
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // const getSlotFromDate = (dateStr: string): TimeSlot => {
  //   const hour = new Date(dateStr).getHours();
  //   if (hour < 12) return 'Morning';
  //   if (hour < 18) return 'Afternoon';
  //   return 'Evening';
  // };

  const getSlotFromDate = (dateStr: string): TimeSlot => {
    const date = new Date(dateStr);
    const hour = date.getHours() + date.getMinutes() / 60;
    if (hour < 12.5) return 'Morning';
    if (hour < 17.5) return 'Afternoon';
    return 'Evening';
  };

  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: getLocalDateFormat(d),
        label: d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      };
    });
  }, [selectedDate]);

  // 3. LỌC DỮ LIỆU CHÍNH (Sửa lỗi hiển thị)
  const filteredSchedules = useMemo(() => {
    console.group("🔍 Chẩn đoán lọc lịch");
    const result = schedules.filter((s) => {


      const sDateStr = getLocalDateFormat(new Date(s.startTime));

      // Lọc theo Ngày/Tuần/Danh sách
      if (viewMode === 'day') {
        if (sDateStr !== selectedDate) return false;
      } else if (viewMode === 'week') {
        if (!weekDays.some(wd => wd.date === sDateStr)) return false;
      } else if (viewMode === 'list') {
        if (sDateStr < startDate || sDateStr > endDate) return false;
      }

      // Lọc theo khung giờ
      if (selectedTimeSlot !== 'all') {
        if (getSlotFromDate(s.startTime) !== selectedTimeSlot) return false;
      }

      // Lọc theo Tìm kiếm
      const searchContent = `${s.class?.name || ''} ${s.title || ''} ${s.teacher?.fullName || ''}`.toLowerCase();
      if (searchTerm && !searchContent.includes(searchTerm.toLowerCase())) return false;

      // Lọc theo Giảng viên
      if (selectedTeacher !== 'all' && (s.teacher?._id || s.teacher) !== selectedTeacher) return false;

      // Lọc theo Cơ sở (Campus)
      if (selectedCampus !== 'all') {
        const sCampusId = s.class?.campus?._id || s.class?.campus || s.campus?._id || s.campus;
        if (sCampusId !== selectedCampus) return false;
      }

      // Lọc theo Class ID
      if (selectedClassId !== 'all') {
        const sClassId = s.class?._id || s.class;
        if (sClassId !== selectedClassId) return false;
      }
      return true;
    });

    console.log("Dữ liệu sau khi lọc:", result.length);
    console.groupEnd();
    return result;
  }, [schedules, selectedDate, startDate, endDate, searchTerm, selectedTeacher, selectedCampus, selectedTimeSlot, viewMode, weekDays, selectedClassId]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => selectedCampus === 'all' || (r.campus?._id || r.campus) === selectedCampus);
  }, [rooms, selectedCampus]);



  const handleDeleteAllByClass = async () => {
    const selectedClassName = classes.find(c => c._id === selectedClassId)?.name;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa TOÀN BỘ lịch giảng dạy của lớp: ${selectedClassName}?`)) return;

    try {
      const res = await apiClient.delete(`/schedules/class/${selectedClassId}`);
      if (res.data.success) {
        toast.success("Đã xóa toàn bộ lịch của lớp!");
        fetchSchedules(); // Refresh lịch
      }
    } catch (error) {
      toast.error("Lỗi khi xóa lịch");
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (direction === 'next' ? (viewMode === 'day' ? 1 : 7) : (viewMode === 'day' ? -1 : -7)));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleEditClick = (schedule: any) => {
    setEditingSchedule(schedule);
    setIsEditModalOpen(true);
  };

  const handleUpdateSchedule = async (updatedData: any) => {
    try {
      setIsUpdating(true);
      const res = await apiClient.put(`/schedules/${editingSchedule._id}`, updatedData);
      if (res.data.success) {
        toast.success("Cập nhật lịch thành công");
        setIsEditModalOpen(false);
        fetchSchedules();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi khi cập nhật lịch");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch giảng dạy</h1>
          <p className="text-slate-500 text-sm italic">Quản lý điều phối phòng học và giáo viên toàn hệ thống.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('day')} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'day' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>Ngày</button>
            <button onClick={() => setViewMode('week')} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'week' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>Tuần</button>
            <button onClick={() => setViewMode('list')} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>Danh sách</button>
          </div>
          {viewMode !== 'list' ? (
            <div className="flex items-center gap-1 border-l pl-4">
              <button onClick={() => navigateDate('prev')} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft className="w-5 h-5" /></button>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="font-bold text-slate-700 text-sm outline-none cursor-pointer" />
              <button onClick={() => navigateDate('next')} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronRight className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l pl-4">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="font-bold text-slate-700 text-sm outline-none cursor-pointer bg-transparent" />
              <span className="text-slate-400">-</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-bold text-slate-700 text-sm outline-none cursor-pointer bg-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-4 rounded-xs shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="relative col-span-1 md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Tìm lớp..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>

        <select value={selectedCampus} onChange={(e) => { setSelectedCampus(e.target.value); setSelectedRoom('all'); }} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">Tất cả cơ sở</option>
          {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">Tất cả phòng</option>
          {rooms.filter(r => selectedCampus === 'all' || (r.campus?._id || r.campus) === selectedCampus).map(r => (
            <option key={r._id} value={r._id}>{r.name}</option>
          ))}
        </select>

        <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">Tất cả giảng viên</option>
          {teachers.map(t => <option key={t._id} value={t._id}>{t.fullName}</option>)}
        </select>

        <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">Tất cả thời gian</option>
          <option value="Morning">Sáng (08:00 - 12:00)</option>
          <option value="Afternoon">Chiều (13:00 - 17:00)</option>
          <option value="Evening">Tối (18:00 - 22:00)</option>
        </select>

        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">Tất cả lớp</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        {/* Nút Xóa lịch lớp học */}
        {selectedClassId !== 'all' && (
          <button
            onClick={handleDeleteAllByClass}
            className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all border border-rose-200"
          >
            <Trash2 className="w-4 h-4" /> Xóa lịch lớp này
          </button>
        )}

        <button className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
          <Filter className="w-4 h-4" /> Lọc
        </button>
      </div>

      {/* Schedule Grid Matrix */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">

        <div className="overflow-x-auto overflow-y-visible pt-24 -mt-24 custom-scrollbar">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Đang tải dữ liệu lịch học...</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="p-4">
              {filteredSchedules.length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-medium">Không tìm thấy lịch học nào phù hợp.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest rounded-tl-xl">Ngày học</th>
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Lớp học</th>
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Giảng viên</th>
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Phòng / Cơ sở</th>
                        <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest rounded-tr-xl">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(s => (
                        <tr key={s._id} onClick={() => handleEditClick(s)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group">
                          <td className="p-4">
                            <span className="text-sm font-bold text-slate-700">{new Date(s.startTime).toLocaleDateString('vi-VN')}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                              {formatTime(s.startTime)} - {formatTime(s.endTime)}
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{s.class?.name || s.title}</p>
                            {s.sessionNumber && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Buổi {s.sessionNumber}</p>}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                              </div>
                              <span className="text-sm font-semibold text-slate-700">{s.teacher?.fullName || 'Chưa gán'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-sm font-bold text-slate-700">{s.room || 'N/A'}</p>
                                <p className="text-[11px] font-semibold text-slate-400">{s.class?.campus?.name || s.campus?.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider",
                              s.status === 'Completed' ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                s.status === 'Cancelled' ? "bg-rose-100 text-rose-700 border border-rose-200" :
                                  "bg-amber-100 text-amber-700 border border-amber-200"
                            )}>
                              {s.status === 'Scheduled' ? 'Chưa học' : s.status === 'Completed' ? 'Đã xong' : 'Đã hủy'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-48">
                      {viewMode === 'day' ? 'Ca học \\ Phòng' : 'Phòng \\ Ngày'}
                    </th>
                    {viewMode === 'day' ? (
                      filteredRooms.map(room => (
                        <th key={room._id} className="p-4 text-center border-r border-slate-100 min-w-[220px]">
                          <span className="text-slate-900 font-black text-sm">{room.name}</span>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{room.campus?.name}</p>
                        </th>
                      ))
                    ) : (
                      weekDays.map(day => (
                        <th key={day.date} className={cn("p-4 text-center border-r border-slate-100 min-w-[180px]", day.date === new Date().toISOString().split('T')[0] && "bg-indigo-50")}>
                          <span className="text-slate-900 font-black text-sm">{day.label}</span>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {viewMode === 'day' ? (
                    timeSlots.map((slot) => (
                      <tr key={slot.value} className="border-b border-slate-100">
                        <td className="sticky left-0 z-10 bg-slate-50 p-4 border-r border-slate-100">
                          <span className="font-black text-slate-700 text-sm">{slot.label}</span>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{slot.range}</p>
                        </td>

                        {filteredRooms.map(room => {
                          // FIX: Thêm điều kiện so sánh getSlotFromDate(s.startTime) === slot.value
                          const cellItems = filteredSchedules.filter(s => {
                            const sRoomId = s.room?._id || s.room;
                            const currentRoomId = room._id || room.id;
                            const matchRoom = (sRoomId === currentRoomId) || (s.room === room.name);
                            const matchSlot = getSlotFromDate(s.startTime) === slot.value;
                            return matchRoom && matchSlot;
                          });

                          return (
                            <td key={`${room._id}-${slot.value}`} className="p-2 border-r border-slate-100 align-top">
                              <div className="space-y-2">
                                {cellItems.map(s => (
                                  <ScheduleCard
                                    key={s._id}
                                    s={s}
                                    formatTime={formatTime}
                                    onClick={() => handleEditClick(s)}
                                  />
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    filteredRooms.flatMap(room =>
                      timeSlots.map(slot => (
                        <tr key={`${room._id}-${slot.value}`} className="border-b border-slate-100 group">
                          <td className="sticky left-0 z-10 bg-slate-50 p-4 border-r border-slate-100 min-w-[150px]">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">{room.name}</span>
                              <span className={cn(
                                "text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-lg w-fit shadow-sm",
                                slot.value === 'Morning' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                                  slot.value === 'Afternoon' ? "bg-sky-100 text-sky-700 border border-sky-200" :
                                    "bg-indigo-100 text-indigo-700 border border-indigo-200"
                              )}>
                                {slot.label}
                              </span>
                            </div>
                          </td>
                          {weekDays.map(day => {
                            const cellItems = filteredSchedules.filter(s => {
                              const sRoomId = s.room?._id || s.room;
                              const matchRoom = (sRoomId === room._id) || (s.room === room.name);
                              const matchDate = getLocalDateFormat(new Date(s.startTime)) === day.date;
                              const matchSlot = getSlotFromDate(s.startTime) === slot.value;
                              return matchRoom && matchDate && matchSlot;
                            });
                            return (
                              <td key={`${room._id}-${slot.value}-${day.date}`} className={cn("p-2 border-r border-slate-100 align-top min-h-[80px]", day.date === new Date().toISOString().split('T')[0] && "bg-indigo-50/30")}>
                                <div className="space-y-1.5">
                                  {cellItems.map(s => (
                                    <ScheduleCard
                                      key={s._id}
                                      s={s}
                                      formatTime={formatTime}
                                      compact
                                      onClick={() => handleEditClick(s)}
                                    />
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )
                  )}
                </tbody>

              </table>
            </div>
          )}
        </div>
      </div>
      {/* Modal chỉnh sửa lịch học */}
      <EditScheduleModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        schedule={editingSchedule}
        onSave={handleUpdateSchedule}
        loading={isUpdating}
        teachers={teachers}
        rooms={rooms}
      />
    </div>
  );
}

function EditScheduleModal({ isOpen, onClose, schedule, onSave, loading, teachers, rooms }: any) {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    teacher: '',
    room: '',
    status: '',
    note: ''
  });

  useEffect(() => {
    if (schedule) {
      const start = new Date(schedule.startTime);
      const end = new Date(schedule.endTime);

      setFormData({
        date: getLocalDateFormat(start),
        startTime: start.toTimeString().slice(0, 5),
        endTime: end.toTimeString().slice(0, 5),
        teacher: schedule.teacher?._id || schedule.teacher || '',
        room: schedule.room || '',
        status: schedule.status || 'Scheduled',
        note: schedule.note || ''
      });
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Ghép ngày và giờ
    const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

    onSave({
      ...formData,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString()
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa buổi học">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-1">Ngày học</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
            <input
              type="time"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Giờ kết thúc</label>
            <input
              type="time"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Giảng viên</label>
            <select
              value={formData.teacher}
              onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">Chưa gán</option>
              {teachers.map((t: any) => (
                <option key={t._id} value={t._id}>{t.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Phòng học</label>
            <select
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">Chưa chọn</option>
              {rooms.map((r: any) => (
                <option key={r._id} value={r.name}>{r.name} ({r.campus?.name})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Trạng thái</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="Scheduled">Chưa học</option>
              <option value="Completed">Đã hoàn thành</option>
              <option value="Cancelled">Đã hủy</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none h-24 resize-none"
            placeholder="Ghi chú cho buổi học..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleCard({ s, formatTime, compact = false, onClick }: any) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const isCompleted = s.status === 'Completed';
  const config = {
    accent: isCompleted ? "border-l-emerald-500" : "border-l-indigo-500",
    tag: isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700",
    icon: isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-indigo-500" />
  };

  // Tính toán vị trí khi Hover
  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      setShowTooltip(true);
    }
  };

  return (
    <>
      {/* CARD CHÍNH - Giữ nguyên giao diện cũ */}
      <div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
        className={cn(
          "flex flex-col bg-white border border-slate-200/80 rounded-2xl p-3.5",
          "transition-all duration-300 shadow-sm relative",
          "hover:shadow-xl hover:-translate-y-1 cursor-pointer border-l-4",
          config.accent,
          compact ? "p-2 gap-1" : "gap-3"
        )}
      >
        <div className="flex items-center justify-between">
          <div className={cn("px-2 py-0.5 rounded-lg font-black text-[9px] uppercase", config.tag)}>
            {formatTime(s.startTime)} - {formatTime(s.endTime)}
          </div>
          {config.icon}
        </div>
        <h4 className={cn("font-bold text-slate-800 leading-tight truncate", compact ? "text-[10px]" : "text-[13px]")}>
          {s.class?.name || s.title}
        </h4>
      </div>

      {/* TOOLTIP SỬ DỤNG PORTAL - Bay trên mọi Grid */}
      {showTooltip && (
        <Portal>
          <div
            className="fixed z-9999 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={{
              top: coords.top - 10, // Hiển thị phía trên card 10px
              left: coords.left + (coords.width / 2),
              transform: 'translate(-100%, -100%)' // Căn giữa và đẩy lên trên
            }}
          >
            <div className="w-72 bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-[2rem] shadow-[0_25px_70px_rgba(0,0,0,0.5)] border border-slate-700/50">
              <div className="flex justify-between items-start mb-4">
                <div className="pr-4">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Chi tiết buổi học</p>
                  <h5 className="font-bold text-sm leading-snug">{s.class?.name || s.title}</h5>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-[9px] font-black uppercase">
                  {s.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <User className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Giảng viên</p>
                    <p className="text-xs font-semibold">{s.teacher?.fullName || 'Chưa gán'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Lộ trình</p>
                    <p className="text-xs font-semibold">Buổi {s.sessionNumber} - {s.class?.course?.name || '---'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                    <MapPin className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Phòng học</p>
                    <p className="text-xs font-semibold">{s.room || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {s.note && (
                <div className="mt-4 pt-4 border-t border-white/10 italic text-[11px] text-slate-300 leading-relaxed">
                  "{s.note}"
                </div>
              )}

              {/* Mũi tên trỏ xuống */}
              <div className="absolute top-[98%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-slate-900/95"></div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}