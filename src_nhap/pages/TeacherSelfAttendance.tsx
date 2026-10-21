import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Search, 
  ShieldCheck, 
  User as UserIcon, 
  FileText, 
  Loader2, 
  Trash2, 
  AlertCircle,
  Sparkles,
  Check,
  X,
  BookOpen,
  Code,
  Tag
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../constants/permissions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Campus {
  _id: string;
  name: string;
  code?: string;
}

interface ClassItem {
  _id: string;
  name: string;
  code?: string;
}

interface SlotOption {
  slotId: string;
  name: string;
  shift: string;
  timeRange: string;
}

const AVAILABLE_SLOTS: SlotOption[] = [
  { slotId: 'slot_1', name: 'Slot 1', shift: 'Ca sáng', timeRange: '08:00 - 12:00' },
  { slotId: 'slot_2', name: 'Slot 2', shift: 'Ca chiều', timeRange: '13:30 - 17:30' },
  { slotId: 'slot_3', name: 'Slot 3', shift: 'Ca tối', timeRange: '18:00 - 21:00' }
];

// Preset STEAM/STEM subjects
const PRESET_SUBJECTS = [
  'Roblox Studio',
  'C / C++',
  'Scratch',
  'Python',
  'Lập trình Web',
  'Robotics / STEM',
  'Thiết kế 3D',
  'Minecraft Education'
];

export default function TeacherSelfAttendance() {
  const { user, can, hasRole } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'my-logs' | 'admin-approval'>('my-logs');

  // Master Data
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Form State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  
  // Multi-Class & Multi-Subject State
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('');

  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Logs List State
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Filter State
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCampus, setFilterCampus] = useState<string>('all');
  const [searchTeacher, setSearchTeacher] = useState<string>('');

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Check Admin / Academic Manager Role (Chỉ Admin / Quản lý mới thấy Tab Phê duyệt)
  const userRole = (user?.role?.name || '').toLowerCase();
  const isAdminOrManager = can(PERMISSIONS.TEACHER_SELF_ATTENDANCE.MANAGE) || 
                           hasRole('admin') || 
                           hasRole('academic') || 
                           hasRole('manager') || 
                           hasRole('director') || 
                           hasRole('superadmin') ||
                           ['admin', 'manager', 'director', 'superadmin', 'academic'].includes(userRole);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, filterMonth, filterYear, filterStatus, filterCampus]);

  const fetchMasterData = async () => {
    setLoadingMasterData(true);
    try {
      const [campusRes, classRes] = await Promise.all([
        apiClient.get('/campuses'),
        apiClient.get('/classes')
      ]);

      const campusList = campusRes.data?.data || campusRes.data || [];
      const classList = classRes.data?.data || classRes.data || [];

      setCampuses(campusList);
      setClasses(classList);

      if (campusList.length > 0) {
        setSelectedCampusId(campusList[0]._id);
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải dữ liệu cơ sở & lớp học');
    } finally {
      setLoadingMasterData(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params: any = {
        month: filterMonth,
        year: filterYear,
        status: filterStatus,
        campusId: filterCampus
      };

      const res = await apiClient.get('/teacher-self-attendance', { params });
      if (res.data.success) {
        setLogs(res.data.data || []);
      }
    } catch (err: any) {
      toast.error('Không thể tải lịch sử tự chấm công');
    } finally {
      setLoadingLogs(false);
    }
  };

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const toggleSubject = (subjectName: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectName) ? prev.filter(s => s !== subjectName) : [...prev, subjectName]
    );
  };

  const handleAddCustomSubject = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = customSubjectInput.trim();
    if (trimmed && !selectedSubjects.includes(trimmed)) {
      setSelectedSubjects(prev => [...prev, trimmed]);
      setCustomSubjectInput('');
    }
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      toast.error('Vui lòng chọn ngày giảng dạy');
      return;
    }
    if (!selectedCampusId) {
      toast.error('Vui lòng chọn cơ sở giảng dạy');
      return;
    }
    if (selectedSlotIds.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 Slot giảng dạy');
      return;
    }

    const payloadSlots = AVAILABLE_SLOTS
      .filter(s => selectedSlotIds.includes(s.slotId))
      .map(s => ({
        slotId: s.slotId,
        name: s.name,
        shift: s.shift
      }));

    const selectedClassObjects = classes.filter(c => selectedClassIds.includes(c._id));
    const classNamesList = selectedClassObjects.map(c => c.name);

    setSubmitting(true);
    try {
      const res = await apiClient.post('/teacher-self-attendance', {
        date: selectedDate,
        campusId: selectedCampusId,
        slots: payloadSlots,
        classIds: selectedClassIds,
        classNames: classNamesList,
        subjects: selectedSubjects,
        note
      });

      if (res.data.success) {
        toast.success('Gửi tích công thành công! Vui lòng chờ Admin phê duyệt.');
        setSelectedSlotIds([]);
        setSelectedClassIds([]);
        setSelectedSubjects([]);
        setNote('');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('Lỗi khi gửi tích công: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected', reason?: string) => {
    setActionLoadingId(id);
    try {
      const res = await apiClient.put(`/teacher-self-attendance/${id}/status`, {
        status: newStatus,
        rejectReason: reason || ''
      });

      if (res.data.success) {
        toast.success(newStatus === 'Approved' ? 'Đã phê duyệt công giảng dạy!' : 'Đã từ chối công giảng dạy.');
        fetchLogs();
        setRejectingItem(null);
        setRejectReason('');
      }
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lượt tích công này không?')) return;

    setActionLoadingId(id);
    try {
      const res = await apiClient.delete(`/teacher-self-attendance/${id}`);
      if (res.data.success) {
        toast.success('Đã xóa lượt tích công');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter logs for display
  const filteredLogs = logs.filter(item => {
    if (!searchTeacher) return true;
    const nameStr = item.teacherName || item.user?.fullName || '';
    return nameStr.toLowerCase().includes(searchTeacher.toLowerCase());
  });

  // Calculate Statistics for Admin
  const totalCount = filteredLogs.length;
  const pendingCount = filteredLogs.filter(l => l.status === 'Pending').length;
  const approvedCount = filteredLogs.filter(l => l.status === 'Approved').length;
  const rejectedCount = filteredLogs.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/20">
            <Sparkles className="w-3.5 h-3.5" />
            Giảng viên STEAM / STEM tự chấm công
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Tích công Giảng dạy Multi-Class</h1>
          <p className="text-blue-200/80 text-sm mt-1 max-w-2xl">
            Hỗ trợ 1 giảng viên dạy đồng thời nhiều lớp / nhiều môn (Roblox, C++, Scratch...) trong cùng 1 buổi. Đăng ký & gửi Admin phê duyệt.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="relative z-10 flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('my-logs')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
              activeTab === 'my-logs' 
                ? "bg-white text-slate-900 shadow-md" 
                : "text-blue-100 hover:bg-white/10"
            )}
          >
            <UserIcon className="w-4 h-4" />
            Tự tích công
          </button>
          
          {isAdminOrManager && (
            <button
              onClick={() => setActiveTab('admin-approval')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 relative",
                activeTab === 'admin-approval' 
                  ? "bg-white text-slate-900 shadow-md" 
                  : "text-blue-100 hover:bg-white/10"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Duyệt chấm công
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-extrabold bg-amber-500 text-white rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'my-logs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Card */}
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Đăng ký tích công ca dạy
              </h2>
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold">Chờ duyệt</span>
            </div>

            <form onSubmit={handleSubmitLog} className="space-y-5">
              {/* Date & Campus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày giảng dạy <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cơ sở <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  >
                    {campuses.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Slot Options Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tích chọn Ca / Slot giảng dạy <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {AVAILABLE_SLOTS.map(slot => {
                    const isChecked = selectedSlotIds.includes(slot.slotId);
                    return (
                      <div
                        key={slot.slotId}
                        onClick={() => toggleSlot(slot.slotId)}
                        className={cn(
                          "cursor-pointer flex flex-col justify-between p-3 rounded-2xl border transition-all duration-200 select-none",
                          isChecked 
                            ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-sm" 
                            : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-sm text-slate-900">{slot.name}</span>
                          <div className={cn(
                            "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                            isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-blue-700">
                          {slot.shift}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 mt-1">
                          {slot.timeRange}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Subject / Môn học take care */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Môn học / Nội dung STEAM take care cùng lúc
                </label>
                <p className="text-xs text-slate-500">
                  Chọn hoặc thêm các môn học/chương trình bạn đồng thời hướng dẫn trong ca này (Roblox, C++, Scratch...):
                </p>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SUBJECTS.map(subj => {
                    const isSelected = selectedSubjects.includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleSubject(subj)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        )}
                      >
                        <Code className="w-3.5 h-3.5" />
                        {subj}
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom subject input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customSubjectInput}
                    onChange={e => setCustomSubjectInput(e.target.value)}
                    onKeyDown={handleAddCustomSubject}
                    placeholder="Nhập môn học khác và ấn Enter..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSubject}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  >
                    + Thêm môn
                  </button>
                </div>
              </div>

              {/* Multi-Class Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chọn các Lớp học tương ứng (Nhiều lớp)
                </label>
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có danh sách lớp trên hệ thống</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-2xl p-2.5 bg-slate-50/50 space-y-1.5">
                    {classes.map(cl => {
                      const isChecked = selectedClassIds.includes(cl._id);
                      return (
                        <div
                          key={cl._id}
                          onClick={() => toggleClass(cl._id)}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all border select-none",
                            isChecked 
                              ? "bg-blue-50 border-blue-400 text-blue-900 font-bold" 
                              : "bg-white border-slate-100 text-slate-700 hover:border-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-4 h-4 rounded flex items-center justify-center border",
                              isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                            )}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span>{cl.name} {cl.code ? `(${cl.code})` : ''}</span>
                          </div>
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ghi chú chi tiết công việc
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ví dụ: Phụ trách hỗ trợ 3 học viên làm project Roblox và 2 học viên thực hành C++..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Gửi Đăng ký Tích công Giảng dạy
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Personal Logs Table */}
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lịch sử tích công cá nhân</h2>
                <p className="text-xs text-slate-500">Danh sách các ca dạy đã đăng ký</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>

                <select
                  value={filterYear}
                  onChange={e => setFilterYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Chưa có bản ghi tích công nào</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng điền form bên trái để tạo đăng ký đầu tiên</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {filteredLogs.map(log => (
                  <div key={log._id} className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {new Date(log.date).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {log.campus?.name || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {log.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 animate-pulse" />
                            Chờ duyệt
                          </span>
                        )}
                        {log.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã duyệt
                          </span>
                        )}
                        {log.status === 'Rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Từ chối
                          </span>
                        )}

                        {log.status === 'Pending' && (
                          <button
                            onClick={() => handleDeleteLog(log._id)}
                            disabled={actionLoadingId === log._id}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                            title="Xóa bản ghi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Slots Badges */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ca / Slot:</span>
                      <div className="flex flex-wrap gap-1">
                        {log.slots?.map((s: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            {s.name} ({s.shift})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Subjects Badges */}
                    {log.subjects && log.subjects.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Môn học take care:</span>
                        <div className="flex flex-wrap gap-1">
                          {log.subjects.map((sub: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                              <Code className="w-3 h-3" />
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Classes Badges */}
                    {((log.classes && log.classes.length > 0) || (log.classNames && log.classNames.length > 0) || log.className) && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Lớp phụ trách:</span>
                        <div className="flex flex-wrap gap-1">
                          {log.classes && log.classes.length > 0 ? (
                            log.classes.map((cl: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {cl.name}
                              </span>
                            ))
                          ) : log.classNames && log.classNames.length > 0 ? (
                            log.classNames.map((cnName: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {cnName}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {log.className}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {log.note && (
                      <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 italic">
                        "{log.note}"
                      </div>
                    )}

                    {log.status === 'Rejected' && log.rejectReason && (
                      <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                        Lý do từ chối: <strong>{log.rejectReason}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Admin Approval Tab */
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Tổng số yêu cầu</p>
                <p className="text-2xl font-black text-slate-900">{totalCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-amber-800 font-semibold uppercase">Chờ phê duyệt</p>
                <p className="text-2xl font-black text-amber-900">{pendingCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-emerald-800 font-semibold uppercase">Đã chấp thuận</p>
                <p className="text-2xl font-black text-emerald-900">{approvedCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-rose-800 font-semibold uppercase">Từ chối</p>
                <p className="text-2xl font-black text-rose-900">{rejectedCount}</p>
              </div>
            </div>
          </div>

          {/* Approval Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên giảng viên..."
                  value={searchTeacher}
                  onChange={e => setSearchTeacher(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Pending">Chờ phê duyệt</option>
                <option value="Approved">Đã chấp thuận</option>
                <option value="Rejected">Từ chối</option>
              </select>

              <select
                value={filterCampus}
                onChange={e => setFilterCampus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="all">Tất cả cơ sở</option>
                {campuses.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Admin Approval Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-semibold">Không tìm thấy bản ghi chấm công nào</p>
                <p className="text-slate-400 text-xs mt-1">Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-4 px-4">Giảng viên</th>
                      <th className="py-4 px-4">Ngày dạy & Cơ sở</th>
                      <th className="py-4 px-4">Slot & Môn/Lớp phụ trách</th>
                      <th className="py-4 px-4">Ghi chú</th>
                      <th className="py-4 px-4">Trạng thái</th>
                      <th className="py-4 px-4 text-center">Xác nhận Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Teacher Info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                              {(log.teacherName || log.user?.fullName || 'GV').charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">
                                {log.teacherName || log.user?.fullName || 'N/A'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {log.user?.email || ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date & Campus */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800">
                            {new Date(log.date).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-xs text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5" />
                            {log.campus?.name || 'N/A'}
                          </div>
                        </td>

                        {/* Slots, Subjects & Classes */}
                        <td className="py-4 px-4 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {log.slots?.map((s: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                {s.name} ({s.shift})
                              </span>
                            ))}
                          </div>

                          {log.subjects && log.subjects.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {log.subjects.map((sub: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  ⚡ {sub}
                                </span>
                              ))}
                            </div>
                          )}

                          {((log.classes && log.classes.length > 0) || (log.classNames && log.classNames.length > 0) || log.className) && (
                            <div className="flex flex-wrap gap-1">
                              {log.classes && log.classes.length > 0 ? (
                                log.classes.map((cl: any, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    📘 {cl.name}
                                  </span>
                                ))
                              ) : log.classNames && log.classNames.length > 0 ? (
                                log.classNames.map((cnName: string, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    📘 {cnName}
                                  </span>
                                ))
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  📘 {log.className}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Note */}
                        <td className="py-4 px-4 max-w-xs">
                          <span className="text-xs text-slate-600 line-clamp-2">
                            {log.note ? log.note : <em className="text-slate-400">Không có ghi chú</em>}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {log.status === 'Pending' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              Chờ duyệt
                            </span>
                          )}
                          {log.status === 'Approved' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đã duyệt
                              </span>
                              {log.approvedBy?.fullName && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Bởi: {log.approvedBy.fullName}
                                </div>
                              )}
                            </div>
                          )}
                          {log.status === 'Rejected' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5" />
                                Từ chối
                              </span>
                              {log.rejectReason && (
                                <div className="text-[11px] text-rose-600 mt-0.5 italic">
                                  Lý do: {log.rejectReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {log.status !== 'Approved' && (
                              <button
                                onClick={() => handleUpdateStatus(log._id, 'Approved')}
                                disabled={actionLoadingId === log._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Phê duyệt
                              </button>
                            )}

                            {log.status !== 'Rejected' && (
                              <button
                                onClick={() => {
                                  setRejectingItem(log);
                                  setRejectReason('');
                                }}
                                disabled={actionLoadingId === log._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Từ chối
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Từ chối chấm công giảng dạy
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Nhập lý do từ chối bản ghi chấm công của giảng viên{' '}
              <strong className="text-slate-900">{rejectingItem.teacherName || rejectingItem.user?.fullName}</strong>:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Chưa khớp sĩ số học viên thực tế..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingItem._id, 'Rejected', rejectReason)}
                disabled={actionLoadingId === rejectingItem._id}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors flex items-center gap-2"
              >
                {actionLoadingId === rejectingItem._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Xác nhận từ chối'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
