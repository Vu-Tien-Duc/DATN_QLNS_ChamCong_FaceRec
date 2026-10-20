import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon, Plus, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Clock, User, Building2, Check, X, Trash2, BookOpen
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface ScheduleEntry {
  _id: string;
  userId?: { _id: string; fullName: string; email: string; avatar?: string; role?: string };
  shiftId?: { _id: string; name: string; startTime: string; endTime: string };
  subjectId?: { _id: string; name: string; code?: string };
  weekday?: number; // 0: CN, 1: T2, ..., 6: T7
  startTime?: string;
  endTime?: string;
  roomId?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  note?: string;
  status?: string;
}

interface ShiftConfig {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface UserBasic {
  _id: string;
  fullName: string;
  email: string;
  role?: string;
}

interface SubjectBasic {
  _id: string;
  name: string;
  code?: string;
}

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export default function Schedules() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [subjects, setSubjects] = useState<SubjectBasic[]>([]);
  const [loading, setLoading] = useState(true);

  // New schedule modal
  const [showForm, setShowForm] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formShiftId, setFormShiftId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formWeekday, setFormWeekday] = useState(1); // Default T2
  const [formStartTime, setFormStartTime] = useState('07:30');
  const [formEndTime, setFormEndTime] = useState('11:30');
  const [formRoomId, setFormRoomId] = useState('');
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [formEndDate, setFormEndDate] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return end.toISOString().split('T')[0];
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/schedules', {
        params: { limit: 500 },
      });
      const data = extractArray<ScheduleEntry>(res.data?.data ?? res.data);
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [shiftsRes, usersRes, subjectsRes] = await Promise.all([
          apiClient.get('/shifts').catch(() => ({ data: [] })),
          isAdmin ? apiClient.get('/users').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          apiClient.get('/subjects').catch(() => ({ data: [] })),
        ]);
        setShifts(extractArray<ShiftConfig>(shiftsRes.data?.data ?? shiftsRes.data));
        setUsers(extractArray<UserBasic>(usersRes.data?.data ?? usersRes.data));
        setSubjects(extractArray<SubjectBasic>(subjectsRes.data?.data ?? subjectsRes.data));
        if (!isAdmin && user?._id) setFormUserId(user._id);
      } catch (_) {}
    };
    fetchMeta();
  }, [isAdmin, user?._id]);

  const handleShiftSelect = (shiftId: string) => {
    setFormShiftId(shiftId);
    const selected = shifts.find((s) => s._id === shiftId);
    if (selected) {
      if (selected.startTime) setFormStartTime(selected.startTime);
      if (selected.endTime) setFormEndTime(selected.endTime);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserId = formUserId || user?._id;
    if (!finalUserId || !formShiftId || !formStartDate || !formEndDate) {
      toast.error('Vui lòng điền đầy đủ: Nhân sự, Ca làm việc, Ngày bắt đầu, Ngày kết thúc');
      return;
    }
    setFormLoading(true);
    try {
      await apiClient.post('/schedules', {
        userId: finalUserId,
        shiftId: formShiftId,
        subjectId: formSubjectId || undefined,
        weekday: Number(formWeekday),
        startTime: formStartTime,
        endTime: formEndTime,
        roomId: formRoomId || undefined,
        startDate: formStartDate,
        endDate: formEndDate,
        isRecurring: true,
      });
      toast.success('Đã thêm lịch phân công mới');
      setShowForm(false);
      fetchSchedules();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Lưu thất bại');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xoá lịch phân công này?')) return;
    try {
      await apiClient.delete(`/schedules/${id}`);
      toast.success('Đã xoá lịch phân công');
      fetchSchedules();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xoá thất bại');
    }
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Group schedules by date in current month (YYYY-MM-DD)
  const scheduleByDate: Record<string, ScheduleEntry[]> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(viewYear, viewMonth - 1, day);
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = currentDate.getDay(); // 0: CN, 1: T2, ..., 6: T7

    schedules.forEach((s) => {
      // 1. Nếu có date cụ thể
      if (s.date) {
        try {
          const sDate = new Date(s.date).toISOString().split('T')[0];
          if (sDate === dateStr) {
            if (!scheduleByDate[dateStr]) scheduleByDate[dateStr] = [];
            scheduleByDate[dateStr].push(s);
          }
        } catch (_) {}
        return;
      }

      // 2. Nếu là lịch theo tuần (weekday + startDate + endDate)
      if (s.weekday !== undefined && s.weekday === dayOfWeek) {
        try {
          const start = s.startDate ? new Date(s.startDate) : null;
          const end = s.endDate ? new Date(s.endDate) : null;
          const inRange =
            (!start || currentDate >= new Date(start.getFullYear(), start.getMonth(), start.getDate())) &&
            (!end || currentDate <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
          if (inRange) {
            if (!scheduleByDate[dateStr]) scheduleByDate[dateStr] = [];
            scheduleByDate[dateStr].push(s);
          }
        } catch (_) {}
      }
    });
  }

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lịch phân công</h1>
          <p className="text-slate-500 text-sm mt-1">Xem và quản lý lịch làm việc, giảng dạy định kỳ</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Thêm lịch phân công
          </button>
        )}
      </div>

      {/* Calendar Header */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button onClick={prevMonth} className="btn-ghost p-2" title="Tháng trước">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">
              Tháng {viewMonth} / {viewYear}
            </h2>
          </div>
          <button onClick={nextMonth} className="btn-ghost p-2" title="Tháng sau">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAY_NAMES.map((d, idx) => (
            <div
              key={d}
              className={`py-2.5 text-center text-xs font-semibold ${
                idx === 0 ? 'text-red-500' : 'text-slate-600'
              }`}
            >
              {d === 'CN' ? 'Chủ nhật' : d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm text-slate-400">Đang tải lịch phân công...</span>
          </div>
        ) : (
          <div className="grid grid-cols-7 bg-slate-100 gap-px">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/60 p-2" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const daySchedules = scheduleByDate[dateStr] || [];
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() + 1 === viewMonth &&
                today.getDate() === day;

              return (
                <div
                  key={day}
                  className={`min-h-[100px] p-2 bg-white flex flex-col justify-between transition-colors ${
                    isToday ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-400' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                        {daySchedules.length} ca
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[85px]">
                    {daySchedules.slice(0, 3).map((s) => {
                      const shiftName = s.shiftId?.name || 'Ca làm';
                      const timeStr = s.startTime || s.shiftId?.startTime || '';
                      const userName = s.userId?.fullName || 'Chưa gán';
                      const roomStr = s.roomId ? `• P.${s.roomId}` : '';

                      return (
                        <div
                          key={s._id}
                          className="group relative text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-800 rounded px-1.5 py-1 flex items-center justify-between gap-1 transition-all border border-blue-200/50"
                          title={`${userName} - ${shiftName} (${timeStr}) ${roomStr}`}
                        >
                          <div className="truncate flex-1">
                            <span className="font-semibold">{userName}</span>
                            <span className="text-[10px] text-slate-500 block">
                              {timeStr} {roomStr}
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={(e) => handleDelete(s._id, e)}
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5 transition-opacity"
                              title="Xoá lịch"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <p className="text-[10px] text-slate-400 px-1 font-medium">
                        +{daySchedules.length - 3} lịch khác...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Thêm lịch phân công mới</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {isAdmin && (
                <div className="form-group">
                  <label className="form-label">Nhân sự / Giảng viên *</label>
                  <select
                    className="form-input"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn nhân sự --</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Ca làm việc *</label>
                  <select
                    className="form-input"
                    value={formShiftId}
                    onChange={(e) => handleShiftSelect(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn ca --</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Thứ trong tuần *</label>
                  <select
                    className="form-input"
                    value={formWeekday}
                    onChange={(e) => setFormWeekday(Number(e.target.value))}
                    required
                  >
                    <option value={1}>Thứ Hai</option>
                    <option value={2}>Thứ Ba</option>
                    <option value={3}>Thứ Tư</option>
                    <option value={4}>Thứ Năm</option>
                    <option value={5}>Thứ Sáu</option>
                    <option value={6}>Thứ Bảy</option>
                    <option value={0}>Chủ Nhật</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Giờ bắt đầu</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Giờ kết thúc</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Phòng học / Vị trí</label>
                  <input
                    className="form-input"
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                    placeholder="Ví dụ: A1-302, B2-Lab"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Môn học (nếu có)</label>
                  <select
                    className="form-input"
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                  >
                    <option value="">-- Không gắn môn học --</option>
                    {subjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.name} {sub.code ? `(${sub.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Hiệu lực từ ngày *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến ngày *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  {formLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Lưu phân công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
