import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Building2,
  BookOpen,
  Trash2,
  Edit,
  Eye,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  ListFilter,
  RefreshCw,
  X,
  MapPin,
  Sparkles,
  Info,
  Layers,
  AlertCircle,
  HelpCircle,
  CalendarCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { scheduleApi, ScheduleListResponse } from '../api/schedule.api';
import {
  ScheduleItem,
  ShiftItem,
  SubjectItem,
  UserProfile,
  ScheduleType,
  ScheduleExceptionStatus,
} from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// =============================================================================
// CONSTANTS & HELPERS
// =============================================================================

const WEEKDAYS = [
  { value: 1, label: 'Thứ Hai', short: 'T2' },
  { value: 2, label: 'Thứ Ba', short: 'T3' },
  { value: 3, label: 'Thứ Tư', short: 'T4' },
  { value: 4, label: 'Thứ Năm', short: 'T5' },
  { value: 5, label: 'Thứ Sáu', short: 'T6' },
  { value: 6, label: 'Thứ Bảy', short: 'T7' },
  { value: 0, label: 'Chủ Nhật', short: 'CN' },
];

const SHIFT_SESSIONS = [
  {
    id: 'MORNING',
    label: 'Ca Sáng',
    subLabel: 'Tiết 1 - 5',
    timeRange: '07:00 - 11:30',
    accentBg: 'bg-amber-50/70 dark:bg-amber-950/20',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    dotClass: 'bg-amber-500',
  },
  {
    id: 'AFTERNOON',
    label: 'Ca Chiều',
    subLabel: 'Tiết 6 - 10',
    timeRange: '12:30 - 17:00',
    accentBg: 'bg-sky-50/70 dark:bg-sky-950/20',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/50',
    dotClass: 'bg-sky-500',
  },
  {
    id: 'EVENING',
    label: 'Ca Tối',
    subLabel: 'Tiết 11 - 12',
    timeRange: '17:30 - 21:00',
    accentBg: 'bg-indigo-50/70 dark:bg-indigo-950/20',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
    dotClass: 'bg-indigo-500',
  },
] as const;

function getSessionBucket(item: ScheduleItem): 'MORNING' | 'AFTERNOON' | 'EVENING' {
  if (item.startPeriod) {
    if (item.startPeriod <= 5) return 'MORNING';
    if (item.startPeriod <= 10) return 'AFTERNOON';
    return 'EVENING';
  }
  const hour = parseInt((item.startTime || '07:00').split(':')[0], 10);
  if (hour < 12) return 'MORNING';
  if (hour < 17) return 'AFTERNOON';
  return 'EVENING';
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is 1, Sunday is 0
  date.setDate(date.getDate() + diff);
  return date;
}

function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function getInitials(name?: string): string {
  if (!name) return 'GV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '07:00', end: '07:45' },
  2: { start: '07:50', end: '08:35' },
  3: { start: '08:45', end: '09:30' },
  4: { start: '09:40', end: '10:25' },
  5: { start: '10:30', end: '11:15' },
  6: { start: '12:30', end: '13:15' },
  7: { start: '13:20', end: '14:05' },
  8: { start: '14:15', end: '15:00' },
  9: { start: '15:10', end: '15:55' },
  10: { start: '16:00', end: '16:45' },
  11: { start: '17:30', end: '18:15' },
  12: { start: '18:20', end: '19:05' },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function formatDateDisplay(d?: string | Date): string {
  if (!d) return '--/--/----';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '--/--/----';
  return dateObj.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPeriodRange(start?: number, count?: number): string {
  if (!start) return '';
  const c = count || 1;
  const end = start + c - 1;
  return start === end ? `Tiết ${start}` : `Tiết ${start} - ${end}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Schedules: React.FC = () => {
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toLowerCase();
  const isAdminOrDean = ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truongkhoa'].includes(userRole);

  // View mode
  const [viewMode, setViewMode] = useState<'timetable' | 'calendar' | 'table'>('timetable');
  const [weeklySubMode, setWeeklySubMode] = useState<'session' | 'lecturer'>('session');
  const [weekRefDate, setWeekRefDate] = useState<Date>(() => new Date());
  const [strictWeekFilter, setStrictWeekFilter] = useState<boolean>(false);

  // Table Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // State data
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [lecturers, setLecturers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2025-2026');
  const [selectedWeekday, setSelectedWeekday] = useState<string>('');

  // Calendar View month/year state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState<boolean>(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    userId: '',
    shiftId: '',
    subjectId: '',
    roomId: '',
    weekday: 1,
    startPeriod: 1,
    periodCount: 3,
    startTime: '07:00',
    endTime: '09:30',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0],
    isRecurring: true,
    scheduleType: 'CHINH_KHOA' as ScheduleType,
    makeupDate: '',
    weekNumbers: Array.from({ length: 15 }, (_, i) => i + 1),
    academicYear: '2025-2026',
    semester: 1,
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Exception Form State
  const [exceptionData, setExceptionData] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'NGHI' as ScheduleExceptionStatus,
    reason: '',
    makeupDate: '',
  });
  const [exceptionSubmitting, setExceptionSubmitting] = useState<boolean>(false);

  // Conflict Error Alert Message
  const [conflictError, setConflictError] = useState<string | null>(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: 200,
        academicYear: selectedAcademicYear || undefined,
        semester: selectedSemester ? Number(selectedSemester) : undefined,
      };

      if (selectedLecturerId) {
        params.userId = selectedLecturerId;
      }
      if (selectedWeekday !== '') {
        params.weekday = Number(selectedWeekday);
      }

      const res = await scheduleApi.getSchedules(params);
      let list: ScheduleItem[] = [];
      if (res.data) {
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if ('schedules' in res.data && Array.isArray((res.data as ScheduleListResponse).schedules)) {
          list = (res.data as ScheduleListResponse).schedules;
        }
      }
      setSchedules(list);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      toast.error('Không thể tải danh sách thời khóa biểu');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear, selectedSemester, selectedLecturerId, selectedWeekday]);

  const loadTodaySchedules = useCallback(async () => {
    try {
      const res = await scheduleApi.getTodaySchedules();
      if (res.data && Array.isArray(res.data)) {
        setTodaySchedules(res.data);
      }
    } catch (err) {
      console.error('Error fetching today schedules:', err);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [shiftsRes, subjectsRes, usersRes] = await Promise.all([
        scheduleApi.getShifts().catch(() => ({ data: [] })),
        scheduleApi.getSubjects().catch(() => ({ data: [] })),
        isAdminOrDean ? scheduleApi.getUsers({ limit: 100 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      if (shiftsRes?.data && Array.isArray(shiftsRes.data)) {
        setShifts(shiftsRes.data);
      }
      if (subjectsRes?.data && Array.isArray(subjectsRes.data)) {
        setSubjects(subjectsRes.data);
      }
      if (usersRes?.data && Array.isArray(usersRes.data)) {
        setLecturers(usersRes.data);
      }
    } catch (err) {
      console.error('Error fetching meta:', err);
    }
  }, [isAdminOrDean]);

  useEffect(() => {
    loadMeta();
    loadTodaySchedules();
  }, [loadMeta, loadTodaySchedules]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // =============================================================================
  // FORM HANDLERS & COMPUTED
  // =============================================================================

  const handlePeriodChange = (start: number, count: number) => {
    const s = Math.max(1, Math.min(12, start));
    const c = Math.max(1, Math.min(6, count));
    const end = Math.min(12, s + c - 1);

    const sTime = PERIOD_TIMES[s]?.start || '07:00';
    const eTime = PERIOD_TIMES[end]?.end || '11:15';

    setFormData((prev) => ({
      ...prev,
      startPeriod: s,
      periodCount: c,
      startTime: sTime,
      endTime: eTime,
    }));
  };

  const handleShiftSelect = (shiftId: string) => {
    setFormData((prev) => ({ ...prev, shiftId }));
    const s = shifts.find((item) => item._id === shiftId);
    if (s) {
      setFormData((prev) => ({
        ...prev,
        startTime: s.startTime || prev.startTime,
        endTime: s.endTime || prev.endTime,
      }));
    }
  };

  const toggleWeek = (weekNum: number) => {
    setFormData((prev) => {
      const exists = prev.weekNumbers.includes(weekNum);
      const next = exists ? prev.weekNumbers.filter((w) => w !== weekNum) : [...prev.weekNumbers, weekNum].sort((a, b) => a - b);
      return { ...prev, weekNumbers: next };
    });
  };

  const setPresetWeeks = (type: 'all' | 'even' | 'odd' | 'first10' | 'clear') => {
    let weeks: number[] = [];
    if (type === 'all') weeks = Array.from({ length: 15 }, (_, i) => i + 1);
    else if (type === 'even') weeks = Array.from({ length: 15 }, (_, i) => i + 1).filter((w) => w % 2 === 0);
    else if (type === 'odd') weeks = Array.from({ length: 15 }, (_, i) => i + 1).filter((w) => w % 2 !== 0);
    else if (type === 'first10') weeks = Array.from({ length: 10 }, (_, i) => i + 1);
    else if (type === 'clear') weeks = [];

    setFormData((prev) => ({ ...prev, weekNumbers: weeks }));
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedSchedule(null);
    setConflictError(null);
    setFormData({
      userId: user?._id || '',
      shiftId: shifts[0]?._id || '',
      subjectId: subjects[0]?._id || '',
      roomId: '',
      weekday: 1,
      startPeriod: 1,
      periodCount: 3,
      startTime: '07:00',
      endTime: '09:30',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0],
      isRecurring: true,
      scheduleType: 'CHINH_KHOA',
      makeupDate: '',
      weekNumbers: Array.from({ length: 15 }, (_, i) => i + 1),
      academicYear: selectedAcademicYear || '2025-2026',
      semester: selectedSemester ? Number(selectedSemester) : 1,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setIsEditing(true);
    setSelectedSchedule(item);
    setConflictError(null);

    const uId = typeof item.userId === 'object' ? item.userId?._id : item.userId;
    const shId = typeof item.shiftId === 'object' ? item.shiftId?._id : item.shiftId;
    const subId = typeof item.subjectId === 'object' ? item.subjectId?._id : item.subjectId;

    setFormData({
      userId: uId || user?._id || '',
      shiftId: shId || '',
      subjectId: subId || '',
      roomId: item.roomId || '',
      weekday: item.weekday ?? 1,
      startPeriod: item.startPeriod || 1,
      periodCount: item.periodCount || 3,
      startTime: item.startTime || '07:00',
      endTime: item.endTime || '09:30',
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      isRecurring: item.isRecurring ?? true,
      scheduleType: item.scheduleType || 'CHINH_KHOA',
      makeupDate: item.makeupDate ? new Date(item.makeupDate).toISOString().split('T')[0] : '',
      weekNumbers: item.weekNumbers && item.weekNumbers.length > 0 ? item.weekNumbers : Array.from({ length: 15 }, (_, i) => i + 1),
      academicYear: item.academicYear || selectedAcademicYear || '2025-2026',
      semester: item.semester || (selectedSemester ? Number(selectedSemester) : 1),
    });
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!formData.userId) {
      toast.error('Vui lòng chọn giảng viên phụ trách');
      return;
    }
    if (!formData.roomId.trim()) {
      toast.error('Vui lòng nhập tên phòng học / giảng đường');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Vui lòng chọn ngày bắt đầu và kết thúc');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload: any = {
        userId: formData.userId,
        shiftId: formData.shiftId || undefined,
        subjectId: formData.subjectId || undefined,
        roomId: formData.roomId.trim(),
        weekday: Number(formData.weekday),
        startPeriod: Number(formData.startPeriod),
        periodCount: Number(formData.periodCount),
        startTime: formData.startTime,
        endTime: formData.endTime,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isRecurring: formData.isRecurring,
        scheduleType: formData.scheduleType,
        makeupDate: formData.makeupDate || undefined,
        weekNumbers: formData.weekNumbers,
        academicYear: formData.academicYear,
        semester: Number(formData.semester),
      };

      if (isEditing && selectedSchedule) {
        await scheduleApi.updateSchedule(selectedSchedule._id, payload);
        toast.success('Cập nhật lịch giảng dạy thành công');
      } else {
        await scheduleApi.createSchedule(payload);
        toast.success('Tạo mới lịch phân công thành công');
      }

      setIsFormModalOpen(false);
      loadSchedules();
      loadTodaySchedules();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lưu lịch thất bại';
      const code = err.response?.data?.errorCode;
      if (code === 'SCHEDULE_LECTURER_CONFLICT' || code === 'SCHEDULE_ROOM_CONFLICT' || code === 'SCHEDULE_002') {
        setConflictError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch phân công giảng dạy này không?')) return;

    try {
      await scheduleApi.deleteSchedule(id);
      toast.success('Đã xóa lịch giảng dạy');
      if (selectedSchedule?._id === id) {
        setIsDetailModalOpen(false);
      }
      loadSchedules();
      loadTodaySchedules();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Xóa lịch thất bại';
      toast.error(msg);
    }
  };

  const openExceptionModal = (item: ScheduleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSchedule(item);
    setExceptionData({
      date: new Date().toISOString().split('T')[0],
      status: 'NGHI',
      reason: '',
      makeupDate: '',
    });
    setIsExceptionModalOpen(true);
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    setExceptionSubmitting(true);
    try {
      await scheduleApi.addException(selectedSchedule._id, {
        date: exceptionData.date,
        status: exceptionData.status,
        reason: exceptionData.reason || 'Báo nghỉ / bù từ giao diện quản lý',
        makeupDate: exceptionData.status === 'DAY_BU' ? exceptionData.makeupDate : undefined,
      });

      toast.success('Ghi nhận ngoại lệ buổi học thành công');
      setIsExceptionModalOpen(false);
      loadSchedules();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Ghi nhận ngoại lệ thất bại';
      toast.error(msg);
    } finally {
      setExceptionSubmitting(false);
    }
  };

  // =============================================================================
  // FILTERED DATA
  // =============================================================================

  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase().trim();
      result = result.filter((item) => {
        const subName = typeof item.subjectId === 'object' ? item.subjectId?.name : '';
        const subCode = typeof item.subjectId === 'object' ? item.subjectId?.code : '';
        const userName = typeof item.userId === 'object' ? item.userId?.fullName : '';
        const userCode = typeof item.userId === 'object' ? item.userId?.staffCode : '';
        const room = item.roomId || '';

        return (
          subName?.toLowerCase().includes(kw) ||
          subCode?.toLowerCase().includes(kw) ||
          userName?.toLowerCase().includes(kw) ||
          userCode?.toLowerCase().includes(kw) ||
          room.toLowerCase().includes(kw)
        );
      });
    }

    return result;
  }, [schedules, searchKeyword]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedLecturerId, selectedSemester, selectedAcademicYear, selectedWeekday]);

  // Compute Monday -> Sunday dates for the selected week
  const weekDaysWithDates = useMemo(() => {
    const monday = getMondayOfWeek(weekRefDate);
    const todayStr = toIsoDateString(new Date());
    return WEEKDAYS.map((w, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const dateStr = toIsoDateString(d);
      const shortDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        ...w,
        dateObj: d,
        dateStr,
        shortDate,
        isToday: dateStr === todayStr,
      };
    });
  }, [weekRefDate]);

  // Group schedules by weekday (and filter by week date if strictWeekFilter is enabled)
  const timetableByWeekday = useMemo(() => {
    const map: Record<number, ScheduleItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      0: [],
    };

    filteredSchedules.forEach((item) => {
      const day = item.weekday !== undefined ? item.weekday : 1;
      const dayMeta = weekDaysWithDates.find((d) => d.value === day);

      if (strictWeekFilter && dayMeta) {
        // Check if makeup date matches exact date in week
        if (item.scheduleType === 'DAY_BU' && item.makeupDate) {
          const mStr = toIsoDateString(new Date(item.makeupDate));
          if (mStr === dayMeta.dateStr) {
            map[day].push(item);
          }
          return;
        }
        // Check if dayMeta.dateObj is within [startDate, endDate]
        const sDate = item.startDate ? new Date(item.startDate) : null;
        const eDate = item.endDate ? new Date(item.endDate) : null;
        const inRange =
          (!sDate || dayMeta.dateObj >= new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate())) &&
          (!eDate || dayMeta.dateObj <= new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate(), 23, 59, 59));
        if (!inRange) return;
      }

      if (!map[day]) map[day] = [];
      map[day].push(item);
    });

    // Sort each day by startPeriod, then startTime
    Object.keys(map).forEach((k) => {
      const numKey = Number(k);
      map[numKey].sort((a, b) => {
        const pa = a.startPeriod || 0;
        const pb = b.startPeriod || 0;
        if (pa !== pb) return pa - pb;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    });

    return map;
  }, [filteredSchedules, weekDaysWithDates, strictWeekFilter]);

  // Group weekly schedules by Lecturer for "Ma trận Giảng viên" sub-mode (like TeamSchedule in src_nhap)
  const weeklyLecturerRows = useMemo(() => {
    const rowMap = new Map<
      string,
      {
        lecturerId: string;
        fullName: string;
        staffCode: string;
        avatarUrl: string | null;
        totalSessions: number;
        totalPeriods: number;
        byDay: Record<number, ScheduleItem[]>;
      }
    >();

    Object.entries(timetableByWeekday).forEach(([dayStr, dayItems]) => {
      const dayNum = Number(dayStr);
      dayItems.forEach((item) => {
        const uObj = typeof item.userId === 'object' ? item.userId : null;
        const lecId = uObj?._id || (typeof item.userId === 'string' ? item.userId : 'unassigned');
        const fullName = uObj?.fullName || 'Chưa phân giảng viên';
        const staffCode = uObj?.staffCode || '';
        const avatarUrl = resolveAvatarUrl(uObj?.avatarUrl);

        if (!rowMap.has(lecId)) {
          rowMap.set(lecId, {
            lecturerId: lecId,
            fullName,
            staffCode,
            avatarUrl,
            totalSessions: 0,
            totalPeriods: 0,
            byDay: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] },
          });
        }
        const entry = rowMap.get(lecId)!;
        entry.byDay[dayNum].push(item);
        entry.totalSessions += 1;
        entry.totalPeriods += item.periodCount || 3;
      });
    });

    return Array.from(rowMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }, [timetableByWeekday]);

  // Paginated schedules for Table View
  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / pageSize));
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage, pageSize]);

  // Calendar mapping for current month
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth); // 0 = CN, 1 = T2,...
    const daysArray: {
      dateNumber: number;
      dateString: string;
      dayOfWeek: number;
      isToday: boolean;
      items: ScheduleItem[];
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();

      const matchedItems = filteredSchedules.filter((s) => {
        // If makeup date matches
        if (s.makeupDate) {
          const mDate = new Date(s.makeupDate).toISOString().split('T')[0];
          if (mDate === dateStr) return true;
        }

        // Check regular recurrence
        if (s.weekday === dayOfWeek) {
          const start = s.startDate ? new Date(s.startDate) : null;
          const end = s.endDate ? new Date(s.endDate) : null;
          const inRange =
            (!start || dateObj >= new Date(start.getFullYear(), start.getMonth(), start.getDate())) &&
            (!end || dateObj <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
          return inRange;
        }
        return false;
      });

      daysArray.push({
        dateNumber: d,
        dateString: dateStr,
        dayOfWeek,
        isToday: dateStr === todayStr,
        items: matchedItems,
      });
    }

    return { daysArray, firstDay };
  }, [currentYear, currentMonth, filteredSchedules]);

  // Statistics KPI
  const stats = useMemo(() => {
    const total = schedules.length;
    const todayCount = todaySchedules.length;
    const makeupCount = schedules.filter((s) => s.scheduleType === 'DAY_BU').length;
    const exceptionCount = schedules.reduce((acc, curr) => acc + (curr.exceptions?.length || 0), 0);
    return { total, todayCount, makeupCount, exceptionCount };
  }, [schedules, todaySchedules]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Thời Khóa Biểu & Lịch Công Tác
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Quản lý phân công giảng dạy, phòng học, phát hiện xung đột và lịch dạy bù theo CSDL v2.5.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => {
              loadSchedules();
              loadTodaySchedules();
            }}
          >
            Làm mới
          </Button>

          {isAdminOrDean && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Thêm Lịch Giảng Dạy
            </Button>
          )}
        </div>
      </div>

      {/* =========================================================================
          KPI METRIC CARDS
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng Lịch Phân Công</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">Học kỳ {selectedSemester}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lịch Dạy Hôm Nay</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.todayCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thứ {new Date().getDay() === 0 ? 'CN' : new Date().getDay() + 1} ({formatDateDisplay(new Date())})
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Buổi Dạy Bù (Make-up)</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.makeupCount}</p>
              <p className="text-xs text-indigo-500">Kế hoạch bổ sung</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ngoại Lệ / Báo Nghỉ</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.exceptionCount}</p>
              <p className="text-xs text-amber-500">Đã cập nhật ngoại lệ</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          CONTROL & FILTER BAR
         ========================================================================= */}
      <Card className="border-slate-200/80 dark:border-slate-800/80">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm môn học, mã môn, phòng học, tên giảng viên..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('timetable')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'timetable'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Thời Khóa Biểu Tuần
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Lịch Tháng
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Dạng Bảng
              </button>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Năm học */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Năm học:</span>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
              >
                <option value="2025-2026">2025 - 2026</option>
                <option value="2026-2027">2026 - 2027</option>
                <option value="2024-2025">2024 - 2025</option>
              </select>
            </div>

            {/* Học kỳ */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Học kỳ:</span>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
              >
                <option value="1">Học kỳ 1</option>
                <option value="2">Học kỳ 2</option>
                <option value="3">Học kỳ Hè</option>
                <option value="">Tất cả học kỳ</option>
              </select>
            </div>

            {/* Giảng viên (Admin / Trưởng khoa) */}
            {isAdminOrDean && lecturers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Giảng viên:</span>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="max-w-[200px] truncate px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                >
                  <option value="">Tất cả giảng viên</option>
                  {lecturers.map((lec) => (
                    <option key={lec._id} value={lec._id}>
                      {lec.fullName} ({lec.staffCode || lec.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Thứ trong tuần */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Thứ:</span>
              <select
                value={selectedWeekday}
                onChange={(e) => setSelectedWeekday(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
              >
                <option value="">Cả tuần</option>
                {WEEKDAYS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            {(searchKeyword || selectedLecturerId || selectedWeekday !== '') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-rose-500 hover:text-rose-600"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedLecturerId('');
                  setSelectedWeekday('');
                }}
              >
                Đặt lại bộ lọc
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          VIEW 1: THỜI KHÓA BIỂU TUẦN (WEEKLY TIMETABLE MATRIX VIEW)
         ========================================================================= */}
      {viewMode === 'timetable' && (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <CardContent className="p-0">
            {/* Weekly Navigation & Sub-Mode Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = new Date(weekRefDate);
                      prev.setDate(prev.getDate() - 7);
                      setWeekRefDate(prev);
                    }}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Tuần trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekRefDate(new Date())}
                    className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Tuần hiện tại
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(weekRefDate);
                      next.setDate(next.getDate() + 7);
                      setWeekRefDate(next);
                    }}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Tuần sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/60 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                  <CalendarRange className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>
                    {formatDateDisplay(weekDaysWithDates[0]?.dateObj)} — {formatDateDisplay(weekDaysWithDates[6]?.dateObj)}
                  </span>
                </div>

                {/* Strict date range filter toggle */}
                <button
                  type="button"
                  onClick={() => setStrictWeekFilter((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    strictWeekFilter
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                  title="Chuyển đổi giữa hiển thị toàn bộ thời khóa biểu định kỳ học kỳ hoặc chỉ các lớp còn hiệu lực trong tuần đang chọn"
                >
                  {strictWeekFilter ? 'Đang lọc theo ngày tuần này' : 'Hiển thị chuẩn toàn học kỳ'}
                </button>
              </div>

              {/* Right: Sub-Mode Switcher (Theo Ca Học vs Theo Giảng Viên) & Legend */}
              <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-brand-500 inline-block" />
                    Chính khóa
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                    Dạy bù
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    Có ngoại lệ
                  </span>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setWeeklySubMode('session')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      weeklySubMode === 'session'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Theo Ca Học (Sáng / Chiều / Tối)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklySubMode('lecturer')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      weeklySubMode === 'lecturer'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Theo Giảng Viên ({weeklyLecturerRows.length})
                  </button>
                </div>
              </div>
            </div>

            {/* SUB-MODE A: MA TRẬN CA HỌC × THỨ TRONG TUẦN (Tham khảo src_old & chuẩn Thời khóa biểu Đại học) */}
            {weeklySubMode === 'session' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1060px] table-fixed">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                      <th className="w-36 p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                        Ca / Thứ
                      </th>
                      {weekDaysWithDates.map((day) => {
                        const dayTotal = (timetableByWeekday[day.value] || []).length;
                        return (
                          <th
                            key={day.value}
                            className={`p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800 transition-colors ${
                              day.isToday
                                ? 'bg-brand-50/90 dark:bg-brand-950/40'
                                : day.value === 0
                                ? 'bg-rose-50/30 dark:bg-rose-950/10'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`text-xs font-bold ${
                                  day.isToday
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : day.value === 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {day.label}
                              </span>
                              {day.isToday && (
                                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-brand-600 text-white">
                                  Hôm nay
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-center gap-1.5">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {day.shortDate}
                              </span>
                              {dayTotal > 0 && (
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300">
                                  {dayTotal} ca
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {SHIFT_SESSIONS.map((session) => (
                      <tr key={session.id} className="group/row">
                        {/* Left Session Header Cell */}
                        <td
                          className={`p-3.5 align-top border-r border-slate-200 dark:border-slate-800 ${session.accentBg}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${session.dotClass}`} />
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {session.label}
                            </span>
                          </div>
                          <div className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${session.badgeClass}`}>
                            {session.subLabel}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{session.timeRange}</span>
                          </div>
                        </td>

                        {/* 7 Day Cells for this Session */}
                        {weekDaysWithDates.map((day) => {
                          const cellItems = (timetableByWeekday[day.value] || []).filter(
                            (item) => getSessionBucket(item) === session.id
                          );

                          return (
                            <td
                              key={`${session.id}-${day.value}`}
                              className={`p-2 align-top border-r last:border-r-0 border-slate-200/80 dark:border-slate-800/80 min-h-[150px] transition-colors ${
                                day.isToday
                                  ? 'bg-brand-50/15 dark:bg-brand-950/10'
                                  : 'bg-white dark:bg-slate-900/40 hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
                              }`}
                            >
                              <div className="space-y-2 min-h-[130px] flex flex-col">
                                {cellItems.length === 0 ? (
                                  <div className="flex-1 flex flex-col items-center justify-center py-6 opacity-0 hover:opacity-100 transition-opacity">
                                    {isAdminOrDean ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openCreateModal();
                                          setFormData((prev) => ({
                                            ...prev,
                                            weekday: day.value,
                                            startPeriod:
                                              session.id === 'MORNING' ? 1 : session.id === 'AFTERNOON' ? 6 : 11,
                                            startTime:
                                              session.id === 'MORNING'
                                                ? '07:00'
                                                : session.id === 'AFTERNOON'
                                                ? '12:30'
                                                : '17:30',
                                            endTime:
                                              session.id === 'MORNING'
                                                ? '09:30'
                                                : session.id === 'AFTERNOON'
                                                ? '15:00'
                                                : '19:05',
                                          }));
                                        }}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-400 transition-all"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Thêm lịch
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-slate-300 dark:text-slate-700">—</span>
                                    )}
                                  </div>
                                ) : (
                                  cellItems.map((item) => {
                                    const subName =
                                      typeof item.subjectId === 'object' ? item.subjectId?.name : 'Chưa xếp môn';
                                    const subCode =
                                      typeof item.subjectId === 'object' ? item.subjectId?.code : '';
                                    const uObj = typeof item.userId === 'object' ? item.userId : null;
                                    const lecName = uObj?.fullName || 'Chưa phân giảng viên';
                                    const lecAvatar = resolveAvatarUrl(uObj?.avatarUrl);
                                    const isMakeup = item.scheduleType === 'DAY_BU';
                                    const hasExceptions = (item.exceptions?.length || 0) > 0;
                                    const exceptionOnThisDate = item.exceptions?.find((ex) => {
                                      const exD = ex.date || ex.ngay;
                                      return exD && toIsoDateString(new Date(exD)) === day.dateStr;
                                    });

                                    const borderAccent = exceptionOnThisDate
                                      ? 'border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/60'
                                      : isMakeup
                                      ? 'border-l-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/25 border-indigo-200/80 dark:border-indigo-800/60'
                                      : 'border-l-brand-500 bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/70 hover:border-brand-400';

                                    return (
                                      <div
                                        key={item._id}
                                        onClick={() => {
                                          setSelectedSchedule(item);
                                          setIsDetailModalOpen(true);
                                        }}
                                        className={`group/card relative p-2.5 rounded-xl border border-l-4 shadow-2xs hover:shadow-md transition-all cursor-pointer text-left ${borderAccent}`}
                                      >
                                        {/* Top Row: Time pill & Room badge */}
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200">
                                            <Clock className="w-2.5 h-2.5 text-brand-500" />
                                            {formatPeriodRange(item.startPeriod, item.periodCount)}
                                          </span>
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/50">
                                            <Building2 className="w-2.5 h-2.5" />
                                            {item.roomId}
                                          </span>
                                        </div>

                                        {/* Subject Title & Code */}
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                                          {subName}
                                        </h4>
                                        <div className="flex items-center justify-between gap-1 mt-0.5">
                                          {subCode ? (
                                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                              {subCode}
                                            </span>
                                          ) : (
                                            <span />
                                          )}
                                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                            {item.startTime} - {item.endTime}
                                          </span>
                                        </div>

                                        {/* Exception or Makeup Pill */}
                                        {(isMakeup || hasExceptions) && (
                                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                            {isMakeup && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                Dạy bù
                                              </span>
                                            )}
                                            {exceptionOnThisDate ? (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                Ngoại lệ {day.shortDate}: {exceptionOnThisDate.status || exceptionOnThisDate.trang_thai}
                                              </span>
                                            ) : hasExceptions ? (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                                {item.exceptions?.length} ngoại lệ
                                              </span>
                                            ) : null}
                                          </div>
                                        )}

                                        {/* Bottom Row: Lecturer Avatar + Name + Quick Hover Actions */}
                                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {lecAvatar ? (
                                              <img
                                                src={lecAvatar}
                                                alt={lecName}
                                                className="w-4 h-4 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                                              />
                                            ) : (
                                              <span className="w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                                                {getInitials(lecName)}
                                              </span>
                                            )}
                                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                                              {lecName}
                                            </span>
                                          </div>

                                          {isAdminOrDean && (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
                                              <button
                                                type="button"
                                                title="Ghi nhận ngoại lệ / báo nghỉ"
                                                onClick={(e) => openExceptionModal(item, e)}
                                                className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                              >
                                                <AlertTriangle className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Sửa lịch"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openEditModal(item);
                                                }}
                                                className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                                              >
                                                <Edit className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Xóa lịch"
                                                onClick={(e) => handleDeleteSchedule(item._id, e)}
                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUB-MODE B: MA TRẬN GIẢNG VIÊN × THỨ TRONG TUẦN (Tham khảo TeamSchedule / WorkSchedule) */}
            {weeklySubMode === 'lecturer' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1060px] table-fixed">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                      <th className="w-56 p-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                        Giảng viên / Khối lượng
                      </th>
                      {weekDaysWithDates.map((day) => (
                        <th
                          key={day.value}
                          className={`p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                            day.isToday ? 'bg-brand-50/90 dark:bg-brand-950/40' : ''
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{day.label}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {day.shortDate}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {weeklyLecturerRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                          Không có dữ liệu phân công giảng viên trong bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      weeklyLecturerRows.map((row) => (
                        <tr
                          key={row.lecturerId}
                          className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors"
                        >
                          {/* Lecturer Info Cell */}
                          <td className="p-3.5 align-top border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                            <div className="flex items-center gap-2.5">
                              {row.avatarUrl ? (
                                <img
                                  src={row.avatarUrl}
                                  alt={row.fullName}
                                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                  {getInitials(row.fullName)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {row.fullName}
                                </p>
                                {row.staffCode && (
                                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    {row.staffCode}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300">
                                {row.totalSessions} buổi/tuần
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                {row.totalPeriods} tiết
                              </span>
                            </div>
                          </td>

                          {/* 7 Day Cells for this Lecturer */}
                          {weekDaysWithDates.map((day) => {
                            const items = row.byDay[day.value] || [];
                            return (
                              <td
                                key={`${row.lecturerId}-${day.value}`}
                                className={`p-2 align-top border-r last:border-r-0 border-slate-200/80 dark:border-slate-800/80 ${
                                  day.isToday ? 'bg-brand-50/15 dark:bg-brand-950/10' : ''
                                }`}
                              >
                                <div className="space-y-1.5 min-h-[76px]">
                                  {items.map((item) => {
                                    const subName =
                                      typeof item.subjectId === 'object' ? item.subjectId?.name : 'Lớp học';
                                    const isMakeup = item.scheduleType === 'DAY_BU';
                                    return (
                                      <div
                                        key={item._id}
                                        onClick={() => {
                                          setSelectedSchedule(item);
                                          setIsDetailModalOpen(true);
                                        }}
                                        className={`p-2 rounded-lg border border-l-4 text-left cursor-pointer transition-all hover:shadow-xs ${
                                          isMakeup
                                            ? 'border-l-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50'
                                            : 'border-l-brand-500 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                                          <span>{formatPeriodRange(item.startPeriod, item.periodCount)}</span>
                                          <span className="px-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                                            {item.roomId}
                                          </span>
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 line-clamp-1 mt-0.5">
                                          {subName}
                                        </p>
                                        <p className="text-[10px] font-mono text-slate-400">
                                          {item.startTime} - {item.endTime}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          VIEW 2: LỊCH THÁNG (MONTHLY CALENDAR VIEW - UPGRADED)
         ========================================================================= */}
      {viewMode === 'calendar' && (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <CardContent className="p-0">
            {/* Calendar Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMonth === 1) {
                        setCurrentMonth(12);
                        setCurrentYear((y) => y - 1);
                      } else {
                        setCurrentMonth((m) => m - 1);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCurrentYear(now.getFullYear());
                      setCurrentMonth(now.getMonth() + 1);
                    }}
                    className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Tháng này
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMonth === 12) {
                        setCurrentMonth(1);
                        setCurrentYear((y) => y + 1);
                      } else {
                        setCurrentMonth((m) => m + 1);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Tháng sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Month / Year Selectors */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-brand-500 inline-block" />
                    Chính khóa
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                    Dạy bù
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    Ngoại lệ / Báo nghỉ
                  </span>
                </div>

                <span className="px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200/60 dark:border-brand-800/50">
                  {calendarDays.daysArray.reduce((sum, d) => sum + d.items.length, 0)} buổi trong tháng
                </span>
              </div>
            </div>

            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-center py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((d, idx) => (
                <div key={idx} className={idx === 0 ? 'text-rose-600 dark:text-rose-400' : ''}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid (src_old style gap-px grid) */}
            <div className="grid grid-cols-7 bg-slate-200/80 dark:bg-slate-800 gap-px">
              {/* Offset empty cells before 1st of month */}
              {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
                <div
                  key={`offset-${i}`}
                  className="min-h-[138px] bg-slate-50/70 dark:bg-slate-950/60 p-2"
                />
              ))}

              {calendarDays.daysArray.map((day) => {
                const isSunday = day.dayOfWeek === 0;
                return (
                  <div
                    key={day.dateString}
                    className={`group/day min-h-[138px] p-2 flex flex-col transition-colors ${
                      day.isToday
                        ? 'bg-brand-50/35 dark:bg-brand-950/25'
                        : isSunday
                        ? 'bg-rose-50/15 dark:bg-slate-900/85 hover:bg-slate-50 dark:hover:bg-slate-900'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Day Cell Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                            day.isToday
                              ? 'bg-brand-600 text-white shadow-xs ring-2 ring-brand-500/30'
                              : isSunday
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {day.dateNumber}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] font-extrabold uppercase tracking-tight text-brand-600 dark:text-brand-400">
                            Hôm nay
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {day.items.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/50">
                            {day.items.length} ca
                          </span>
                        )}
                        {isAdminOrDean && (
                          <button
                            type="button"
                            title="Thêm lịch vào ngày này"
                            onClick={() => {
                              openCreateModal();
                              setFormData((prev) => ({
                                ...prev,
                                weekday: day.dayOfWeek,
                                startDate: day.dateString,
                              }));
                            }}
                            className="opacity-0 group-hover/day:opacity-100 p-0.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-opacity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Day Schedule Mini-Cards */}
                    <div className="space-y-1.5 overflow-y-auto max-h-[105px] pr-0.5 flex-1">
                      {day.items.map((item) => {
                        const subName =
                          typeof item.subjectId === 'object' ? item.subjectId?.name : 'Lớp học';
                        const lecName =
                          typeof item.userId === 'object' ? item.userId?.fullName : '';
                        const isMakeup = item.scheduleType === 'DAY_BU';
                        const exceptionOnDay = item.exceptions?.find((ex) => {
                          const exD = ex.date || ex.ngay;
                          return exD && toIsoDateString(new Date(exD)) === day.dateString;
                        });

                        const cardStyle = exceptionOnDay
                          ? 'border-l-amber-500 bg-amber-50/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200/70 dark:border-amber-800/60'
                          : isMakeup
                          ? 'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 border-indigo-200/70 dark:border-indigo-800/60'
                          : 'border-l-brand-500 bg-slate-50/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200/70 dark:border-slate-700/70 hover:border-brand-400';

                        return (
                          <div
                            key={`${day.dateString}-${item._id}`}
                            onClick={() => {
                              setSelectedSchedule(item);
                              setIsDetailModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg border border-l-3 text-[10px] cursor-pointer transition-all hover:shadow-xs ${cardStyle}`}
                            title={`${subName} | Phòng ${item.roomId} | ${item.startTime} - ${item.endTime}${
                              lecName ? ` | GV: ${lecName}` : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 font-bold">
                              <span className="font-mono text-[9px] opacity-85">
                                {item.startTime} - {item.endTime}
                              </span>
                              <span className="px-1 rounded bg-white/80 dark:bg-slate-900/80 text-[9px] font-bold">
                                {item.roomId}
                              </span>
                            </div>
                            <p className="font-bold truncate mt-0.5 leading-tight">{subName}</p>
                            {lecName && (
                              <p className="text-[9px] opacity-75 truncate mt-0.5">{lecName}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          VIEW 3: DẠNG BẢNG DANH SÁCH (ENTERPRISE TABLE LIST VIEW + PAGINATION)
         ========================================================================= */}
      {viewMode === 'table' && (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Thứ & Ca giảng dạy</th>
                  <th className="py-3.5 px-4">Học phần / Môn học</th>
                  <th className="py-3.5 px-4">Giảng viên phụ trách</th>
                  <th className="py-3.5 px-4">Phòng học</th>
                  <th className="py-3.5 px-4">Tuần áp dụng</th>
                  <th className="py-3.5 px-4">Thời gian hiệu lực</th>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {paginatedSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CalendarIcon className="w-8 h-8 opacity-30" />
                        <span>Không tìm thấy lịch phân công giảng dạy phù hợp.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSchedules.map((item) => {
                    const subName =
                      typeof item.subjectId === 'object' ? item.subjectId?.name : 'Chưa xếp môn';
                    const subCode =
                      typeof item.subjectId === 'object' ? item.subjectId?.code : '';
                    const subCredits =
                      typeof item.subjectId === 'object' ? item.subjectId?.credits : undefined;
                    const uObj = typeof item.userId === 'object' ? item.userId : null;
                    const lecName = uObj?.fullName || 'Chưa phân giảng viên';
                    const lecCode = uObj?.staffCode || '';
                    const lecAvatar = resolveAvatarUrl(uObj?.avatarUrl);
                    const dayObj = WEEKDAYS.find((w) => w.value === item.weekday);
                    const isMakeup = item.scheduleType === 'DAY_BU';
                    const sessionBucket = getSessionBucket(item);

                    return (
                      <tr
                        key={item._id}
                        onClick={() => {
                          setSelectedSchedule(item);
                          setIsDetailModalOpen(true);
                        }}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        {/* Thứ & Ca giảng dạy */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                item.weekday === 0
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {dayObj ? dayObj.label : `Thứ ${item.weekday}`}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                sessionBucket === 'MORNING'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  : sessionBucket === 'AFTERNOON'
                                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                              }`}
                            >
                              {sessionBucket === 'MORNING'
                                ? 'Ca Sáng'
                                : sessionBucket === 'AFTERNOON'
                                ? 'Ca Chiều'
                                : 'Ca Tối'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-semibold mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {formatPeriodRange(item.startPeriod, item.periodCount)} ({item.startTime} -{' '}
                              {item.endTime})
                            </span>
                          </div>
                        </td>

                        {/* Môn học */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {subName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {subCode && (
                              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {subCode}
                              </span>
                            )}
                            {subCredits && (
                              <span className="text-[11px] text-slate-400">{subCredits} TC</span>
                            )}
                          </div>
                        </td>

                        {/* Giảng viên (with Avatar) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {lecAvatar ? (
                              <img
                                src={lecAvatar}
                                alt={lecName}
                                className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                                {getInitials(lecName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {lecName}
                              </div>
                              {lecCode && (
                                <div className="text-slate-400 font-mono text-[11px]">{lecCode}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phòng học */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-xl bg-brand-50/80 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/50">
                            <Building2 className="w-3.5 h-3.5 text-brand-500" />
                            {item.roomId}
                          </span>
                        </td>

                        {/* Tuần áp dụng */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block max-w-[160px] truncate px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                            {item.weekNumbers && item.weekNumbers.length > 0
                              ? item.weekNumbers.length >= 15
                                ? 'Toàn bộ 15 tuần'
                                : `Tuần ${item.weekNumbers[0]} → ${
                                    item.weekNumbers[item.weekNumbers.length - 1]
                                  } (${item.weekNumbers.length} tuần)`
                              : 'Tất cả tuần'}
                          </span>
                        </td>

                        {/* Thời gian hiệu lực */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono">
                          <div>Từ: {formatDateDisplay(item.startDate)}</div>
                          <div>Đến: {formatDateDisplay(item.endDate)}</div>
                        </td>

                        {/* Loại lịch */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={isMakeup ? 'purple' : 'info'} size="sm">
                              {isMakeup ? 'Dạy bù' : 'Chính khóa'}
                            </Badge>
                            {(item.exceptions?.length || 0) > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" />
                                {item.exceptions?.length} ngoại lệ
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Thao tác */}
                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Xem chi tiết"
                              onClick={() => {
                                setSelectedSchedule(item);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isAdminOrDean && (
                              <>
                                <button
                                  type="button"
                                  title="Ghi nhận ngoại lệ / báo nghỉ"
                                  onClick={(e) => openExceptionModal(item, e)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Sửa lịch"
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Xóa lịch"
                                  onClick={(e) => handleDeleteSchedule(item._id, e)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredSchedules.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <span>
                  Hiển thị{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.min(currentPage * pageSize, filteredSchedules.length)}
                  </strong>{' '}
                  trên tổng số{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {filteredSchedules.length}
                  </strong>{' '}
                  lịch phân công
                </span>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      (p >= currentPage - 1 && p <= currentPage + 1)
                  )
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-slate-400">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          currentPage === p
                            ? 'bg-brand-600 text-white shadow-xs'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          MODAL 1: THÊM / CHỈNH SỬA LỊCH GIẢNG DẠY
         ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? 'Chỉnh Sửa Lịch Giảng Dạy' : 'Thêm Mới Lịch Phân Công'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hệ thống tự động phát hiện xung đột Giảng viên và Phòng học
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {/* Conflict Error Message Alert */}
              {conflictError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <h5 className="font-bold">Cảnh Báo Xung Đột Lịch Trình</h5>
                    <p className="mt-0.5 leading-relaxed">{conflictError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Giảng viên */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Giảng viên phụ trách <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {lecturers.map((lec) => (
                      <option key={lec._id} value={lec._id}>
                        {lec.fullName} ({lec.staffCode || lec.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Môn học */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    Học phần / Môn học
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">-- Chọn môn học --</option>
                    {subjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phòng học */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Phòng học / Giảng đường <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    placeholder="VD: Giảng đường A2-301, Lab CNTT 01..."
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {/* Thứ trong tuần */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    Thứ trong tuần <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.weekday}
                    onChange={(e) => setFormData({ ...formData, weekday: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tiết bắt đầu & Số tiết */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Tiết bắt đầu (1 - 12)
                  </label>
                  <select
                    value={formData.startPeriod}
                    onChange={(e) => handlePeriodChange(Number(e.target.value), formData.periodCount)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>
                        Tiết {p} ({PERIOD_TIMES[p]?.start})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Số tiết giảng dạy
                  </label>
                  <select
                    value={formData.periodCount}
                    onChange={(e) => handlePeriodChange(formData.startPeriod, Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <option key={c} value={c}>
                        {c} tiết ({c * 45} phút)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Giờ bắt đầu & Giờ kết thúc */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ bắt đầu (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ kết thúc (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {/* Ca làm việc liên kết */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ca chuẩn chấm công
                  </label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => handleShiftSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">-- Tự do theo tiết --</option>
                    {shifts.map((shift) => (
                      <option key={shift._id} value={shift._id}>
                        {shift.name} ({shift.startTime} - {shift.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loại lịch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Loại lịch phân công
                  </label>
                  <select
                    value={formData.scheduleType}
                    onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as ScheduleType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="CHINH_KHOA">Chính khóa (Định kỳ)</option>
                    <option value="DAY_BU">Dạy bù (Bổ sung)</option>
                  </select>
                </div>

                {/* Ngày bắt đầu & Ngày kết thúc */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày bắt đầu hiệu lực <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày kết thúc hiệu lực <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Dạy bù -> Chọn ngày diễn ra buổi dạy bù */}
              {formData.scheduleType === 'DAY_BU' && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    Ngày tổ chức buổi dạy bù cụ thể
                  </label>
                  <input
                    type="date"
                    value={formData.makeupDate}
                    onChange={(e) => setFormData({ ...formData, makeupDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Tuần học áp dụng (1 -> 15) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Các tuần học áp dụng ({formData.weekNumbers.length} tuần đã chọn):
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPresetWeeks('all')}
                      className="px-2 py-0.5 rounded text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetWeeks('odd')}
                      className="px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Tuần lẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetWeeks('even')}
                      className="px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Tuần chẵn
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetWeeks('clear')}
                      className="px-2 py-0.5 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-1.5">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => {
                    const isSelected = formData.weekNumbers.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => toggleWeek(w)}
                        className={`py-1.5 text-center text-xs font-semibold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        T{w}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" isLoading={formSubmitting}>
                  {isEditing ? 'Lưu Thay Đổi' : 'Xác Nhận Tạo Lịch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: GHI NHẬN NGOẠI LỆ BUỔI HỌC (BÁO NGHỈ / DẠY BÙ)
         ========================================================================= */}
      {isExceptionModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Ghi Nhận Ngoại Lệ Buổi Học
                  </h3>
                  <p className="text-xs text-slate-500">
                    Báo nghỉ, hoãn buổi hoặc chỉ định lịch dạy bù cho ca học
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExceptionModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {typeof selectedSchedule.subjectId === 'object' ? selectedSchedule.subjectId?.name : 'Môn học'}
                </p>
                <p className="text-slate-500">
                  Phòng: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedSchedule.roomId}</span> | Thứ{' '}
                  {selectedSchedule.weekday} ({selectedSchedule.startTime} - {selectedSchedule.endTime})
                </p>
              </div>

              {/* Ngày ngoại lệ */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ngày áp dụng ngoại lệ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={exceptionData.date}
                  onChange={(e) => setExceptionData({ ...exceptionData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Trạng thái ngoại lệ */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hình thức ngoại lệ
                </label>
                <select
                  value={exceptionData.status}
                  onChange={(e) =>
                    setExceptionData({ ...exceptionData, status: e.target.value as ScheduleExceptionStatus })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NGHI">Nghỉ dạy (Báo nghỉ)</option>
                  <option value="HUY">Hủy buổi học</option>
                  <option value="DAY_BU">Chuyển sang dạy bù</option>
                </select>
              </div>

              {/* Ngày dạy bù nếu chọn DAY_BU */}
              {exceptionData.status === 'DAY_BU' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày tổ chức dạy bù dự kiến
                  </label>
                  <input
                    type="date"
                    value={exceptionData.makeupDate}
                    onChange={(e) => setExceptionData({ ...exceptionData, makeupDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              {/* Lý do */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Lý do chi tiết
                </label>
                <textarea
                  rows={3}
                  value={exceptionData.reason}
                  onChange={(e) => setExceptionData({ ...exceptionData, reason: e.target.value })}
                  placeholder="VD: Đi công tác theo kế hoạch nhà trường, nghỉ ốm, hội nghị khoa học..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Danh sách ngoại lệ đã có */}
              {selectedSchedule.exceptions && selectedSchedule.exceptions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Lịch sử ngoại lệ đã ghi nhận ({selectedSchedule.exceptions.length}):
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {selectedSchedule.exceptions.map((ex, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDateDisplay(ex.date || ex.ngay)}
                          </span>
                          : <span className="text-slate-500">{ex.reason || ex.ly_do || 'Không có lý do'}</span>
                        </div>
                        <Badge
                          variant={
                            ex.status === 'DAY_BU' || ex.trang_thai === 'DAY_BU'
                              ? 'purple'
                              : ex.status === 'HUY' || ex.trang_thai === 'HUY'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {ex.status || ex.trang_thai || 'NGHI'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExceptionModalOpen(false)}
                  disabled={exceptionSubmitting}
                >
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" isLoading={exceptionSubmitting}>
                  Lưu Ngoại Lệ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: CHI TIẾT LỊCH PHÂN CÔNG GIẢNG DẠY
         ========================================================================= */}
      {isDetailModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Chi Tiết Lịch Phân Công
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thông tin định danh học phần & thiết lập chấm công
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Main Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={selectedSchedule.scheduleType === 'DAY_BU' ? 'purple' : 'info'}
                    size="sm"
                  >
                    {selectedSchedule.scheduleType === 'DAY_BU' ? 'Lịch Dạy Bù' : 'Lịch Chính Khóa'}
                  </Badge>
                  <span className="font-mono text-slate-400 text-[11px]">
                    ID: {selectedSchedule._id}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {typeof selectedSchedule.subjectId === 'object'
                    ? selectedSchedule.subjectId?.name
                    : 'Học phần chưa liên kết'}
                </h4>
                {typeof selectedSchedule.subjectId === 'object' && selectedSchedule.subjectId?.code && (
                  <p className="font-mono text-slate-500">
                    Mã môn: {selectedSchedule.subjectId.code} ({selectedSchedule.subjectId.credits || 3} tín chỉ)
                  </p>
                )}
              </div>

              {/* Grid attributes */}
              <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Giảng viên:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {typeof selectedSchedule.userId === 'object'
                      ? selectedSchedule.userId?.fullName
                      : 'Chưa cập nhật'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Phòng học:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    {selectedSchedule.roomId}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Thời gian ca:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatPeriodRange(selectedSchedule.startPeriod, selectedSchedule.periodCount)}
                    <br />
                    {selectedSchedule.startTime} - {selectedSchedule.endTime}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Ngày trong tuần:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {WEEKDAYS.find((w) => w.value === selectedSchedule.weekday)?.label || `Thứ ${selectedSchedule.weekday}`}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Khoảng thời gian:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateDisplay(selectedSchedule.startDate)} → {formatDateDisplay(selectedSchedule.endDate)}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-slate-400 block text-[11px]">Học kỳ & Năm:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    HK{selectedSchedule.semester || 1} / {selectedSchedule.academicYear || '2025-2026'}
                  </span>
                </div>
              </div>

              {/* Tuần áp dụng */}
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                <span className="text-slate-400 block text-[11px]">Tuần học áp dụng:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedSchedule.weekNumbers && selectedSchedule.weekNumbers.length > 0
                    ? `Tuần: ${selectedSchedule.weekNumbers.join(', ')}`
                    : 'Toàn bộ kỳ học'}
                </span>
              </div>

              {/* Ngoại lệ đã ghi nhận */}
              {selectedSchedule.exceptions && selectedSchedule.exceptions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-slate-400 block text-[11px] font-semibold">
                    Ngoại lệ buổi học ({selectedSchedule.exceptions.length}):
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {selectedSchedule.exceptions.map((ex, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between"
                      >
                        <span>
                          <strong className="text-amber-800 dark:text-amber-300">
                            {formatDateDisplay(ex.date || ex.ngay)}:
                          </strong>{' '}
                          {ex.reason || ex.ly_do}
                        </span>
                        <Badge variant="warning" size="sm">
                          {ex.status || ex.trang_thai}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {isAdminOrDean ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openEditModal(selectedSchedule);
                      }}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={(e) => handleDeleteSchedule(selectedSchedule._id, e)}
                    >
                      Xóa
                    </Button>
                  </div>
                ) : (
                  <div />
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Schedules;
