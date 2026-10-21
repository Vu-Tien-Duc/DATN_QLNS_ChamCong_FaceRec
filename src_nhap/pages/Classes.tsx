import React, { useState, useEffect, useCallback } from 'react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Save,
  AlertTriangle, RefreshCcw
} from 'lucide-react';
// Thêm hàm này vào để fix lỗi ts(2304)
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import {
  Plus, Search, Calendar, Users, User, BookOpen,
  Clock, MapPin, ChevronRight, Trash2, Edit2, Loader2,
  CheckCircle2, Timer, Sparkles, Building2, DoorOpen, ListChecks, Info,
  Phone
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const dayNames = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 0, label: 'Chủ Nhật' },
];

export default function Classes() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  // Thêm state này vào component chính
  const [shouldRegenerate, setShouldRegenerate] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchStudent, setSearchStudent] = useState('');

  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleViewOpen, setIsScheduleViewOpen] = useState(false);
  const [currentClassSchedules, setCurrentClassSchedules] = useState<any[]>([]);

  const [editingClass, setEditingClass] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Builder Lịch học (Giữ nguyên dạng mảng để khớp với Model mới)
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedCampusId, setSelectedCampusId] = useState('');


  // Thêm state vào component Classes
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [classMembers, setClassMembers] = useState<any[]>([]);
  const [selectedClassForMembers, setSelectedClassForMembers] = useState<any>(null);


  const [formData, setFormData] = useState({
    name: '',
    course: '',
    teacher: '',
    campus: '',
    room: '',
    startDate: '',
    capacity: 20,
    status: 'Open'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resClasses, resCourses, resTeachers, resCampuses, resRooms] = await Promise.all([
        apiClient.get('/classes'),
        apiClient.get('/courses'),
        apiClient.get('/teachers'),
        apiClient.get('/campuses'),
        apiClient.get('/rooms')
      ]);

      if (resClasses.data.success) {
        const rawClasses = resClasses.data.data || [];
        console.log("🔍 [Classes] Current User:", user?.email);
        console.log("✅ [Classes] Total Classes loaded:", rawClasses.length);
        setClasses(rawClasses);
      }
      if (resCourses.data.success) setCourses(resCourses.data.data);
      if (resTeachers.data.success) setTeachers(resTeachers.data.data);
      if (resCampuses.data.success) setCampuses(resCampuses.data.data);
      if (resRooms.data.success) setRooms(resRooms.data.data);
    } catch (error) {
      toast.error("Lỗi tải dữ liệu hệ thống");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- LOGIC TỰ ĐỘNG SINH LỊCH DẠY (SESSIONS) ---
  const autoGenerateSchedules = async (classId: string, classInfo: any, courseInfo: any) => {
    const toastId = toast.loading(`Đang khởi tạo ${courseInfo.totalSessions} buổi học...`);
    try {
      let currentDate = new Date(classInfo.startDate);
      let sessionCount = 0;
      const selectedDays = weeklySchedule.map(s => s.day);

      while (sessionCount < courseInfo.totalSessions) {
        const dayOfWeek = currentDate.getDay();
        if (selectedDays.includes(dayOfWeek)) {
          sessionCount++;
          const timeInfo = weeklySchedule.find(s => s.day === dayOfWeek);

          const start = new Date(currentDate);
          const [sh, sm] = timeInfo.startTime.split(':').map(Number);
          start.setHours(sh, sm, 0);

          const end = new Date(currentDate);
          const [eh, em] = timeInfo.endTime.split(':').map(Number);
          end.setHours(eh, em, 0);

          await apiClient.post('/schedules', {
            class: classId,
            sessionNumber: sessionCount,
            title: `Buổi ${sessionCount}: ${courseInfo.name}`,
            teacher: classInfo.teacher,
            startTime: start,
            endTime: end,
            room: rooms.find(r => r._id === classInfo.room)?.name || 'Phòng học'
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      toast.success("Đã đồng bộ lịch dạy chi tiết!", { id: toastId });
    } catch (error) {
      toast.error("Lỗi khi sinh lịch học", { id: toastId });
    }
  };

  // --- XEM CHI TIẾT LỊCH DẠY ---
  const handleViewSchedules = async (cls: any) => {
    try {
      setEditingClass(cls);
      const res = await apiClient.get(`/schedules/class/${cls._id}`);
      if (res.data.success) {
        setCurrentClassSchedules(res.data.data);
        setIsScheduleViewOpen(true);
      }
    } catch (error) {
      toast.error("Không thể lấy lịch dạy");
    }
  };

  // 1. Lấy danh sách học viên trong lớp
  const handleViewMembers = async (cls: any) => {
    setSelectedClassForMembers(cls);
    try {
      const res = await apiClient.get(`/classes/${cls._id}/students`);
      if (res.data.success) {
        setClassMembers(res.data.data);
        setIsMembersModalOpen(true);
      }
    } catch (error) { toast.error("Không thể tải danh sách học viên"); }
  };

  // 2. Thêm học viên vào lớp (Logic này gọi API mới đã viết ở bước trước)
  const addStudentToClass = async (studentId: string) => {
    try {
      const res = await apiClient.post(`/classes/${selectedClassForMembers._id}/students`, { studentId });
      if (res.data.success) {
        toast.success("Đã thêm học viên vào lớp!");
        handleViewMembers(selectedClassForMembers); // Refresh danh sách
        setSearchStudent(''); // Clear search
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi thêm học viên");
    }
  };

  // 3. Load danh sách học viên toàn hệ thống để tìm kiếm
  useEffect(() => {
    if (isMembersModalOpen) {
      apiClient.get('/students').then(res => setAllStudents(res.data.data));
    }
  }, [isMembersModalOpen]);

  const [saving, setSaving] = useState<Boolean>(false);

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. NGĂN CHẶN GỌI TRÙNG LẶP (Lock)
    if (saving) return;

    if (weeklySchedule.length === 0) return toast.error("Vui lòng thiết lập lịch tuần");

    setSaving(true); // Khóa nút bấm ngay lập tức

    const payload = {
      ...formData,
      schedule: weeklySchedule,
      regenerateSchedule: shouldRegenerate
    };

    try {
      const isEdit = !!editingClass;
      const url = isEdit ? `/classes/${editingClass._id}` : '/classes';
      const method = isEdit ? 'put' : 'post';

      const res = await apiClient[method](url, payload);

      if (res.data.success) {
        // 2. CHỈ GỌI KHI CẦN THIẾT
        // Kiểm tra xem đã có lịch chưa trước khi tự động sinh lịch (nếu cần)
        if (!isEdit || shouldRegenerate) {
          // Đảm bảo chỉ gọi 1 lần bằng cách truyền thẳng classId vừa tạo/update
          await autoGenerateSchedules(res.data.data._id, payload, selectedCourse);
        }

        toast.success(isEdit ? "Cập nhật thành công" : "Đã kích hoạt lớp học");
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false); // Mở khóa
    }
  };


  const handleEditClick = (cls: any) => {
    setEditingClass(cls);

    setShouldRegenerate(false); // Quan trọng: Mặc định không reset lịch
    const course = courses.find(c => c._id === (cls.course?._id || cls.course));
    setSelectedCourse(course);
    setSelectedCampusId(cls.campus?._id || cls.campus || '');

    setFormData({
      name: cls.name,
      course: course?._id || '',
      teacher: cls.teacher?._id || cls.teacher,
      campus: cls.campus?._id || cls.campus,
      room: cls.room?._id || cls.room,
      startDate: cls.startDate ? new Date(cls.startDate).toISOString().split('T')[0] : '',
      capacity: cls.capacity,
      status: cls.status
    });

    // LẤY TRỰC TIẾP MẢNG TỪ DATABASE, KHÔNG CẦN PARSE
    setWeeklySchedule(cls.schedule || []);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setShouldRegenerate(true); // Khi tạo mới thì hiển thị mặc định

    setSelectedCourse(null);
    setSelectedCampusId('');
    setWeeklySchedule([]);
    setFormData({ name: '', course: '', teacher: '', campus: '', room: '', startDate: '', capacity: 20, status: 'Open' });
    setIsModalOpen(true);
  };


  const handleDeleteClass = async (id: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp [${className}]? \nLưu ý: Toàn bộ lịch dạy chi tiết của lớp này cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.`)) {
      return;
    }

    const toastId = toast.loading("Đang xóa dữ liệu lớp học...");
    try {
      // Gọi API xóa lớp học (Backend sẽ xử lý xóa schedule trong service)
      const res = await apiClient.delete(`/classes/${id}`);

      if (res.data.success) {
        toast.success("Đã xóa lớp học và lịch dạy liên quan!", { id: toastId });
        fetchData(); // Tải lại danh sách lớp
      }
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa lớp học", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Lớp học</h1>
          <p className="text-slate-500 text-sm">Hệ thống quản lý lộ trình và tự động hóa lịch giảng dạy chi tiết.</p>
        </div>
        <button onClick={handleOpenCreate} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
          <Plus className="w-5 h-5" /> Mở lớp học mới
        </button>
      </header>


      {loading ? (
        /* TRẠNG THÁI ĐANG TẢI DỮ LIỆU */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Đang đồng bộ danh sách lớp học...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classes.map((cls) => (
            <div key={cls._id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group border-b-4 border-b-transparent hover:border-b-indigo-500">
              <div className="p-7">
                {/* 1. HEADER: TRẠNG THÁI & TÊN LỚP */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black rounded-lg uppercase border shadow-sm",
                        cls.status === 'Open' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          cls.status === 'Running' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400'
                      )}>
                        {cls.status === 'Open' ? 'Đang tuyển sinh' : cls.status === 'Running' ? 'Đang giảng dạy' : 'Đã kết thúc'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">ID: {cls._id?.slice(-6)}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-indigo-500 font-bold uppercase mt-1 tracking-wide">
                      {cls.course?.name || 'Chưa gán khóa học'}
                    </p>
                  </div>

                  {/* Nút Sửa nhanh */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(cls)}
                      className="p-3 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm"
                      title="Chỉnh sửa lớp học"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDeleteClass(cls._id, cls.name)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* 2. GRID THÔNG TIN CHI TIẾT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Giảng viên */}
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-slate-200 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-500">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Giảng viên chính</p>
                      <p className="text-sm font-bold text-slate-700 truncate">{cls.teacher?.fullName || 'Chưa gán'}</p>
                    </div>
                  </div>

                  {/* Sĩ số thực tế (Cảnh báo nếu đầy) */}
                  <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-4 border transition-all shadow-sm",
                    (cls.studentCount >= cls.capacity)
                      ? "bg-rose-50 border-rose-100 ring-2 ring-rose-100"
                      : "bg-slate-50 border-transparent hover:border-slate-200"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm",
                      (cls.studentCount >= cls.capacity) ? "text-rose-500" : "text-slate-400"
                    )}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Sĩ số thực tế</p>
                      <p className={cn(
                        "text-sm font-black",
                        (cls.studentCount >= cls.capacity) ? "text-rose-600" : "text-slate-700"
                      )}>
                        {cls.studentCount || 0} / {cls.capacity}
                      </p>
                    </div>
                  </div>

                  {/* Cơ sở / Địa điểm */}
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-slate-200 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-500">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Cơ sở & Phòng</p>
                      <p className="text-sm font-bold text-slate-700 truncate">
                        {cls.campus?.name || 'N/A'} - {cls.room?.name || '---'}
                      </p>
                    </div>
                  </div>

                  {/* Tiến độ học tập */}
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-slate-200 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-500">
                      <ListChecks className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tiến độ buổi học</p>
                      <p className="text-sm font-bold text-slate-700">
                        {cls.completedSessions || 0} / {cls.course?.totalSessions || '--'} buổi
                      </p>
                    </div>
                  </div>

                  {/* Ngày khai giảng */}
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-transparent hover:border-slate-200 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-500">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Ngày bắt đầu</p>
                      <p className="text-sm font-bold text-slate-700">
                        {cls.startDate ? new Date(cls.startDate).toLocaleDateString('vi-VN') : 'Chưa định ngày'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. LỊCH HỌC CỐ ĐỊNH TRONG TUẦN */}
                <div className="mt-6 p-5 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-indigo-500 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Lịch học hàng tuần</p>
                    <div className="flex flex-wrap gap-2">
                      {cls.schedule && cls.schedule.length > 0 ? (
                        cls.schedule.map((s: any, i: number) => (
                          <div key={i} className="bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-600">
                              {dayNames.find(d => d.value === s.day)?.label || 'Thứ ?'}:
                            </span>
                            <span className="text-xs font-bold text-slate-600">{s.startTime} - {s.endTime}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Chưa thiết lập lịch tuần cụ thể</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. FOOTER: NHÓM HỌC VIÊN & LINK CHI TIẾT */}
              <div className="px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center group/footer">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5 overflow-hidden">
                    {Array.from({ length: Math.min(cls.studentCount || 0, 4) }).map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-200 flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm">
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                    {(cls.studentCount > 4) && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-800 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                        +{cls.studentCount - 4}
                      </div>
                    )}
                  </div>
                  {cls.studentCount > 0 ? (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Học viên đang theo học</p>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-300 uppercase italic">Lớp chưa có học viên</p>
                  )}
                </div>

                <button
                  onClick={() => handleViewMembers(cls)}
                  className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:text-indigo-800 hover:gap-3 transition-all"
                >
                  Danh sách học viên
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM TẠO/SỬA */}


      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? "Cập nhật lớp học" : "Thiết lập lớp học & Sinh lịch tự động"}
      >
        <form onSubmit={handleSaveClass} className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* 1. THÔNG TIN CƠ BẢN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full space-y-1">
              <label className="text-sm font-bold text-slate-700">Tên lớp học</label>
              <input required className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="VD: Lớp Web Fullstack J24" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Khóa học</label>
              <select required className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none" value={formData.course} onChange={(e) => {
                const course = courses.find(c => c._id === e.target.value);
                setSelectedCourse(course);
                setFormData({ ...formData, course: e.target.value });
                if (!editingClass) setWeeklySchedule([]);
              }}>
                <option value="">-- Chọn khóa học --</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.name} ({c.totalSessions} buổi)</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Giảng viên</label>
              <select required className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none" value={formData.teacher} onChange={e => setFormData({ ...formData, teacher: e.target.value })}>
                <option value="">-- Chọn giảng viên --</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.fullName}</option>)}
              </select>
            </div>
          </div>

          {/* 2. ĐỊA ĐIỂM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xs border border-slate-200">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /> Cơ sở đào tạo</label>
              <select required className="w-full px-4 py-2.5 bg-white border rounded-xl outline-none" value={selectedCampusId} onChange={(e) => {
                setSelectedCampusId(e.target.value);
                setFormData({ ...formData, campus: e.target.value, room: '' });
              }}>
                <option value="">-- Chọn cơ sở --</option>
                {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><DoorOpen className="w-4 h-4 text-slate-400" /> Phòng học</label>
              <select required disabled={!selectedCampusId} className="w-full px-4 py-2.5 bg-white border rounded-xl disabled:bg-slate-100 outline-none" value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })}>
                <option value="">-- Chọn phòng --</option>
                {rooms.filter(r => (r.campus?._id || r.campus) === selectedCampusId).map(r => (
                  <option key={r._id} value={r._id}>{r.name} (Sức chứa: {r.capacity})</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. TÙY CHỌN RESET LỊCH (CHỈ HIỆN KHI EDIT) */}
          {editingClass && (
            <div className={cn(
              "p-4 rounded-2xl border-2 transition-all",
              shouldRegenerate ? "bg-rose-50 border-rose-200" : "bg-indigo-50 border-indigo-100"
            )}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  checked={shouldRegenerate}
                  onChange={(e) => setShouldRegenerate(e.target.checked)}
                />
                <div>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCcw className={cn("w-4 h-4", shouldRegenerate && "animate-spin")} />
                    Thiết lập lại toàn bộ lịch dạy cho lớp
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tích chọn nếu bạn muốn xóa lịch cũ và tạo lại {selectedCourse?.totalSessions} buổi học mới dựa trên lịch tuần bên dưới.
                  </p>
                  {shouldRegenerate && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> Cảnh báo: Toàn bộ dữ liệu ĐIỂM DANH của lớp này sẽ bị XÓA VĨNH VIỄN.
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}

          {/* 4. BUILDER LỊCH HỌC (ARRAY BASED) */}
          <div className={cn(
            "p-5 rounded-xs text-white space-y-4 shadow-2xl transition-all duration-300",
            (shouldRegenerate || !editingClass) ? "bg-slate-900 opacity-100" : "bg-slate-700 opacity-40 grayscale pointer-events-none"
          )}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-400">
                <Sparkles className="w-4 h-4" /> {editingClass ? "Lịch tuần mới" : "Lịch tuần"}
              </div>
              <div className="flex gap-1">
                {dayNames.map(day => (
                  <button key={day.value} type="button" onClick={() => {
                    if (!selectedCourse) return toast.error("Chọn khóa học trước");
                    const startTime = "18:30";
                    const [h, m] = startTime.split(':').map(Number);
                    const hours = selectedCourse.hoursPerSession || 2;
                    const totalMin = h * 60 + m + (hours * 60);
                    const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                    setWeeklySchedule([...weeklySchedule, { day: day.value, startTime, endTime }]);
                  }} className="w-8 h-8 rounded-lg bg-slate-800 text-[10px] font-bold hover:bg-emerald-500 transition-all">
                    {day.label.replace('Thứ ', 'T')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {weeklySchedule.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-800 rounded-2xl animate-in zoom-in-95">
                  <span className="text-xs font-bold text-emerald-400 w-16">{dayNames.find(d => d.value === item.day)?.label}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <input type="time" value={item.startTime} onChange={(e) => {
                      const start = e.target.value;
                      const [h, m] = start.split(':').map(Number);
                      const hours = selectedCourse?.hoursPerSession || 2;
                      const totalMin = h * 60 + m + (hours * 60);
                      const end = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                      const temp = [...weeklySchedule];
                      temp[index] = { ...temp[index], startTime: start, endTime: end };
                      setWeeklySchedule(temp);
                    }} className="bg-slate-700 text-white px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                    <span className="text-xs text-slate-400">đến</span>
                    <span className="text-xs font-bold text-slate-300">{item.endTime}</span>
                  </div>
                  <button type="button" onClick={() => setWeeklySchedule(weeklySchedule.filter((_, i) => i !== index))} className="text-rose-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {weeklySchedule.length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-2">Bấm các Thứ phía trên để thiết lập lịch học</p>}
            </div>
          </div>

          {/* 5. PHẦN CHÂN FORM */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Ngày khai giảng</label>
              <input required type="date" className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Sĩ số tối đa</label>
              <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t py-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
            <button
              type="submit"
              className={cn(
                "flex-[2] py-3 text-white rounded-2xl font-black shadow-xl transition-all uppercase tracking-widest text-xs",
                shouldRegenerate ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {editingClass
                ? (shouldRegenerate ? "GHI ĐÈ & TẠO MỚI LỊCH" : "LƯU THÔNG TIN LỚP")
                : "Kích hoạt & Sinh lịch dạy"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL XEM CHI TIẾT SESSIONS */}
      <Modal isOpen={isScheduleViewOpen} onClose={() => setIsScheduleViewOpen(false)} title={`Lịch dạy: ${editingClass?.name}`}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {currentClassSchedules.map((s) => (
            <div key={s._id} className="flex gap-4 items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
              <div className="w-10 h-10 bg-white rounded-xl flex flex-col items-center justify-center border shadow-sm">
                <span className="text-[8px] font-black text-slate-400 uppercase leading-none">B.</span>
                <span className="text-sm font-black text-indigo-600">{s.sessionNumber}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-xs">
                  {new Date(s.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h4>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                  <Clock className="w-3 h-3" /> {new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${s.status === 'Scheduled' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {s.status === 'Scheduled' ? 'Sắp dạy' : 'Đã dạy'}
                </span>
                <p className="text-[9px] text-slate-400 font-bold mt-1 flex items-center justify-end gap-1 uppercase">
                  <MapPin className="w-2.5 h-2.5" /> {s.room}
                </p>
              </div>
            </div>
          ))}
          {currentClassSchedules.length === 0 && (
            <div className="py-20 text-center">
              <Info className="w-12 h-12 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 italic">Chưa có lịch dạy chi tiết cho lớp học này.</p>
            </div>
          )}
        </div>
      </Modal>


      <Modal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        title={`Học viên lớp: ${selectedClassForMembers?.name}`}
      >
        <div className="space-y-6">
          {/* Khu vực tìm kiếm & thêm học viên */}
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <label className="text-[10px] font-black uppercase text-indigo-400 mb-2 block">Thêm học viên mới</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-indigo-300" />
              <input
                placeholder="Tìm tên hoặc email học viên..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-indigo-200 outline-none text-sm"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
              />
            </div>

            {/* Dropdown kết quả tìm kiếm */}
            {searchStudent && (
              <div className="mt-2 bg-white rounded-xl shadow-lg border border-slate-100 max-h-40 overflow-y-auto">
                {allStudents
                  .filter(s => s.fullName.toLowerCase().includes(searchStudent.toLowerCase()))
                  .map(s => (
                    <button
                      key={s._id}
                      onClick={() => addStudentToClass(s._id)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors border-b last:border-0"
                    >
                      {s.fullName} - <span className="text-slate-400 text-xs">{s.email}</span>
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          {/* Danh sách học viên hiện tại */}
          <div className="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {classMembers.map((student: any) => (
              <div key={student._id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                    {student.fullName?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
                    <p className="text-[10px] text-slate-400 mb-1">
                      {student.email}
                      <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold">
                        Tổng khóa: {selectedClassForMembers?.course?.totalSessions || '--'} buổi
                      </span>
                    </p>
                    {/* Thống kê điểm danh & Thanh tiến độ */}
                    <div className="mt-2 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                        <span className="text-slate-400">Tỷ lệ AF (Nghỉ / Tổng khóa)</span>
                        <span className={cn(
                          "font-bold",
                          ((student.attendance.absentCount || 0) / (selectedClassForMembers?.course?.totalSessions || 1) * 100) > 10
                            ? "text-rose-600"
                            : "text-indigo-600"
                        )}>
                          {selectedClassForMembers?.course?.totalSessions > 0
                            ? Math.round(((student.attendance.absentCount || 0) / selectedClassForMembers.course.totalSessions) * 100)
                            : 0}%
                          {((student.attendance.absentCount || 0) / (selectedClassForMembers?.course?.totalSessions || 1) * 100) > 10 && " ⚠️"}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            ((student.attendance.absentCount || 0) / (selectedClassForMembers?.course?.totalSessions || 1) * 100) > 10
                              ? "bg-rose-500"
                              : "bg-indigo-500"
                          )}
                          style={{
                            width: `${selectedClassForMembers?.course?.totalSessions > 0
                              ? ((student.attendance.absentCount || 0) / selectedClassForMembers.course.totalSessions) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold border border-emerald-100">
                          Đi học: {(student.attendance.presentCount || 0) + (student.attendance.lateCount || 0)}
                        </span>
                        <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md font-bold border border-rose-100">
                          Vắng: {student.attendance?.absentCount || 0}
                        </span>
                        <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-bold border border-amber-100">
                          Muộn: {student.attendance?.lateCount || 0}
                        </span>
                        {student.attendance?.excusedCount > 0 && (
                          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold border border-blue-100">
                            Phép: {student.attendance?.excusedCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await apiClient.delete(`/classes/${selectedClassForMembers._id}/students`, { data: { studentId: student._id } });
                    handleViewMembers(selectedClassForMembers);
                    toast.success("Đã xóa học viên");
                  }}
                  className="text-slate-300 hover:text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}