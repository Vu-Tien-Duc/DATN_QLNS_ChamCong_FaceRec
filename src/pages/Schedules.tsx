import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  BookOpen,
  User,
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  CheckCircle2,
  LayoutGrid,
  Users,
  Table as TableIcon,
  CalendarDays,
  Filter,
  Search,
  RotateCcw,
  Sparkles,
  GraduationCap,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scheduleApi } from '../api/schedule.api';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { hasRole } from '../utils/rbac';
import { Portal } from '../components/ui/Portal';

// =============================================================================
// TYPES & DATA STRUCTURES
// =============================================================================

export type ScheduleType = 'CHINH_KHOA' | 'DAY_BU';
export type ScheduleExceptionStatus = 'NGHI' | 'DAY_BU' | 'HUY';
export type ViewMode = 'matrix' | 'lecturer' | 'table' | 'calendar';

interface ScheduleItem {
  _id: string;
  userId?: {
    _id: string;
    fullName?: string;
    email?: string;
    staffCode?: string;
    departmentName?: string;
    departmentId?: any;
    role?: string;
    position?: string;
  } | string;
  shiftId?: {
    _id: string;
    name?: string;
    ten_ca?: string;
    startTime?: string;
    gio_bat_dau?: string;
    endTime?: string;
    gio_ket_thuc?: string;
    lateThresholdMinutes?: number;
    nguong_di_muon_phut?: number;
  } | string;
  subjectId?: {
    _id: string;
    name?: string;
    ten_mon?: string;
    code?: string;
    ma_mon?: string;
    credits?: number;
    so_tin_chi?: number;
  } | string;
  roomId?: string;
  phong_hoc?: string;
  weekday: number;
  thu_trong_tuan?: number;
  startTime?: string;
  gio_bat_dau?: string;
  endTime?: string;
  gio_ket_thuc?: string;
  startDate?: string;
  ngay_bat_dau?: string;
  endDate?: string;
  ngay_ket_thuc?: string;
  startPeriod?: number;
  tiet_bat_dau?: number;
  periodCount?: number;
  so_tiet?: number;
  isRecurring?: boolean;
  lap_lai_hang_tuan?: boolean;
  scheduleType?: ScheduleType;
  loai_lich?: string;
  makeupDate?: string;
  ngay_day_bu?: string;
  academicYear?: string;
  nam_hoc?: string;
  semester?: number;
  hoc_ky?: number;
  exceptions?: any[];
  ngoai_le?: any[];
  weekNumbers?: number[];
  danh_sach_tuan?: number[];
  latitude?: number;
  vi_do?: number;
  longitude?: number;
  kinh_do?: number;
  radiusMeters?: number;
  ban_kinh_met?: number;
  location?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
}

interface ShiftItem {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  isActive?: boolean;
}

interface SubjectItem {
  _id: string;
  name?: string;
  ten_mon?: string;
  code?: string;
  ma_mon?: string;
  credits?: number;
  so_tin_chi?: number;
}

interface UserProfile {
  _id: string;
  fullName: string;
  email: string;
  staffCode?: string;
  departmentName?: string;
  departmentId?: any;
  role?: string;
  position?: string;
}

interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
}

// 7 Days of week in chronological order Monday -> Sunday
const WEEKDAYS = [
  { value: 1, label: 'THỨ HAI', shortLabel: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'THỨ BA', shortLabel: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'THỨ TƯ', shortLabel: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'THỨ NĂM', shortLabel: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'THỨ SÁU', shortLabel: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'THỨ BẢY', shortLabel: 'Thứ 7', short: 'T7' },
  { value: 0, label: 'CHỦ NHẬT', shortLabel: 'Chủ Nhật', short: 'CN' },
] as const;

// Danh mục Học kỳ chuẩn kèm mốc ngày bắt đầu (Tuần 1)
export const SEMESTER_OPTIONS = [
  { key: '1_2026-2027', semester: 1, academicYear: '2026-2027', label: 'Học kỳ 1 (2026 - 2027)', defaultStartDate: '2026-09-07' },
  { key: '2_2026-2027', semester: 2, academicYear: '2026-2027', label: 'Học kỳ 2 (2026 - 2027)', defaultStartDate: '2027-01-18' },
  { key: '3_2026-2027', semester: 3, academicYear: '2026-2027', label: 'Học kỳ Hè (2026 - 2027)', defaultStartDate: '2027-06-07' },
  { key: '1_2025-2026', semester: 1, academicYear: '2025-2026', label: 'Học kỳ 1 (2025 - 2026)', defaultStartDate: '2025-09-08' },
  { key: '2_2025-2026', semester: 2, academicYear: '2025-2026', label: 'Học kỳ 2 (2025 - 2026)', defaultStartDate: '2026-01-19' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is 1, Sunday is 0
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayMonth(d?: string | Date): string {
  if (!d) return '--/--';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '--/--';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatDateFull(d?: string | Date): string {
  if (!d) return '--/--/----';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '--/--/----';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function resolveSubject(
  subjectRaw: any,
  subjectList: SubjectItem[] = []
): { name: string; code: string; credits?: number } | null {
  if (!subjectRaw) return null;
  let target: any = null;

  if (typeof subjectRaw === 'object' && subjectRaw !== null) {
    if (subjectRaw.name || subjectRaw.ten_mon) {
      target = subjectRaw;
    } else {
      const sId = subjectRaw._id || subjectRaw.id;
      if (sId) {
        target = subjectList.find((s) => String(s._id) === String(sId));
      }
    }
  } else if (typeof subjectRaw === 'string') {
    target = subjectList.find((s) => String(s._id) === String(subjectRaw));
  }

  if (!target) return null;
  const name = target.name || target.ten_mon || '';
  const code = target.code || target.ma_mon || '';
  const credits = target.credits || target.so_tin_chi;

  if (!name && !code) return null;
  return { name, code, credits };
}

function getWeekDateString(startDateStr: string, weekNum: number): string {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function calculateEndDateFromWeeks(startDateStr: string, weekNumbers: number[]): string {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return '';
  const maxWeek = weekNumbers && weekNumbers.length > 0 ? Math.max(...weekNumbers) : 15;
  d.setDate(d.getDate() + (maxWeek - 1) * 7 + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function matchScheduleToShift(item: ScheduleItem, shift: ShiftItem): boolean {
  // 1. Direct shiftId match (Bắt buộc phải ưu tiên tuyệt đối nếu có shiftId)
  const itemShiftId = typeof item.shiftId === 'object' ? item.shiftId?._id : item.shiftId;
  if (itemShiftId) {
    return String(itemShiftId) === String(shift._id);
  }

  // 2. Name & Time Matching (Chỉ dùng khi item KHÔNG có shiftId)
  const shiftNameLower = (shift.name || '').toLowerCase();
  const sStart = item.startTime || '07:00';
  const startHour = parseInt(sStart.split(':')[0], 10) || 7;

  if (item.startTime === shift.startTime && item.endTime === shift.endTime) return true;

  // Administrative shift: 08:00 to 17:00
  if (shiftNameLower.includes('hành chính') || shiftNameLower.includes('hanh chinh')) {
    if (startHour === 8 && item.endTime === '17:00') return true;
    return false;
  }

  // Evening shift (ưu tiên xét ca tối trước)
  if (shiftNameLower.includes('tối') || shiftNameLower.includes('toi')) {
    if (startHour >= 17) return true;
    if (item.startPeriod && item.startPeriod >= 9) return true;
    return false;
  }

  // Afternoon shift
  if (shiftNameLower.includes('chiều') || shiftNameLower.includes('chieu')) {
    if (startHour >= 12 && startHour < 17) return true;
    if (item.startPeriod && item.startPeriod >= 5 && item.startPeriod <= 8) return true;
    return false;
  }

  // Morning shift
  if (shiftNameLower.includes('sáng') || shiftNameLower.includes('sang')) {
    if (startHour < 12 && startHour !== 8) return true;
    if (item.startPeriod && item.startPeriod <= 4 && startHour < 12) return true;
    return false;
  }

  return false;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Schedules: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminOrDean = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'truongkhoa', 'phokhoa', 'daotao']);
  }, [user]);

  // 1. View Mode: 'matrix' (Thời khóa biểu tuần) | 'lecturer' (Theo giảng viên) | 'table' (Dạng bảng) | 'calendar' (Lịch tháng)
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  // 2. Filters State: Ca, Ngành/Khoa, Giảng viên, Từ khóa tìm kiếm
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [selectedLecturerFilter, setSelectedLecturerFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 3. Width mode for matrix: 'fit' (vừa màn hình) vs 'scroll' (cuộn rộng)
  const [widthMode, setWidthMode] = useState<'fit' | 'scroll'>('fit');

  // 4. Day filter: 'all' (7 ngày) or specific weekday (1 to 6, 0 for Sunday)
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | number>('all');

  // 5. Semester & Year
  const [selectedSemesterYear, setSelectedSemesterYear] = useState<string>('1_2026-2027');

  // 6. Week navigation (for matrix & lecturer views)
  const [weekRefDate, setWeekRefDate] = useState<Date>(() => new Date());

  // 7. Month navigation (for calendar view)
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => new Date());

  // 8. Table View Pagination
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(10);

  // Data states
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [lecturers, setLecturers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
    periodCount: 4,
    startTime: '07:00',
    endTime: '11:30',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0],
    isRecurring: true,
    scheduleType: 'CHINH_KHOA' as ScheduleType,
    makeupDate: '',
    weekNumbers: Array.from({ length: 15 }, (_, i) => i + 1),
    academicYear: '2026-2027',
    semester: 1,
    latitude: 20.9752,
    longitude: 105.7628,
    radiusMeters: 100,
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Exception Form State
  const [exceptionData, setExceptionData] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'NGHI' as ScheduleExceptionStatus,
    reason: '',
    makeupDate: '',
  });
  const [exceptionSubmitting, setExceptionSubmitting] = useState<boolean>(false);

  // Parse Semester and Academic Year from dropdown value
  const { semesterNum, academicYearVal } = useMemo(() => {
    const parts = selectedSemesterYear.split('_');
    return {
      semesterNum: Number(parts[0]) || 1,
      academicYearVal: parts[1] || '2026-2027',
    };
  }, [selectedSemesterYear]);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: 500,
        academicYear: academicYearVal,
        semester: semesterNum,
      };

      const res = await scheduleApi.getSchedules(params);
      const list = extractArray<ScheduleItem>(res);
      setSchedules(list);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      toast.error('Không thể tải danh sách thời khóa biểu');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearVal, semesterNum]);

  const loadMeta = useCallback(async () => {
    try {
      const [shiftsRes, subjectsRes, usersRes, deptsRes] = await Promise.all([
        scheduleApi.getShifts().catch(() => ({ data: [] })),
        scheduleApi.getSubjects().catch(() => ({ data: [] })),
        scheduleApi.getUsers({ limit: 200 }).catch(() => ({ data: [] })),
        apiClient.get('/departments').catch(() => ({ data: [] })),
      ]);

      const shiftList = extractArray<ShiftItem>(shiftsRes);
      if (shiftList.length > 0) setShifts(shiftList);

      const subjectList = extractArray<SubjectItem>(subjectsRes);
      if (subjectList.length > 0) setSubjects(subjectList);

      const userList = extractArray<UserProfile>(usersRes);
      if (userList.length > 0) setLecturers(userList);

      const deptList = extractArray<DepartmentItem>(deptsRes);
      if (deptList.length > 0) setDepartments(deptList);
    } catch (err) {
      console.error('Error fetching meta:', err);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Department mapping lookup
  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => {
      if (d._id) map.set(d._id, d.name);
    });
    return map;
  }, [departments]);

  // Helper to resolve user's department name
  const getUserDepartmentName = useCallback(
    (u?: any): string => {
      if (!u) return 'Khoa Công Nghệ Thông Tin';
      if (typeof u === 'string') return 'Khoa Công Nghệ Thông Tin';
      if (u.departmentName) return u.departmentName;
      if (u.departmentId) {
        if (typeof u.departmentId === 'object' && u.departmentId?.name) {
          return u.departmentId.name;
        }
        const deptId = typeof u.departmentId === 'string' ? u.departmentId : u.departmentId?._id;
        if (deptId && departmentMap.has(deptId)) {
          return departmentMap.get(deptId)!;
        }
      }
      return 'Khoa Công Nghệ Thông Tin';
    },
    [departmentMap]
  );

  // Sort shifts in logical sequence matching the design:
  // 1. Ca Sáng (07:00 - 11:30)
  // 2. Ca Hành Chính Cố Định (08:00 - 17:00)
  // 3. Ca Chiều (12:30 - 17:00)
  // 4. Ca Tối (17:30 - 21:00)
  const sortedShifts = useMemo(() => {
    const orderRank = (name: string) => {
      const n = (name || '').toLowerCase();
      if (n.includes('sáng') || n.includes('sang')) return 1;
      if (n.includes('hành chính') || n.includes('hanh chinh')) return 2;
      if (n.includes('chiều') || n.includes('chieu')) return 3;
      if (n.includes('tối') || n.includes('toi')) return 4;
      return 5;
    };
    return [...shifts].sort((a, b) => orderRank(a.name) - orderRank(b.name));
  }, [shifts]);

  // Filtered Shifts to display in the Matrix view
  const displayedShifts = useMemo(() => {
    if (!selectedShiftFilter || selectedShiftFilter === 'all') {
      return sortedShifts;
    }
    return sortedShifts.filter((s) => s._id === selectedShiftFilter);
  }, [sortedShifts, selectedShiftFilter]);

  // Cascaded Lecturers based on Department Filter
  const filteredLecturerOptions = useMemo(() => {
    if (!selectedDepartmentFilter || selectedDepartmentFilter === 'all') {
      return lecturers;
    }
    const targetDept = departments.find((d) => d._id === selectedDepartmentFilter);
    return lecturers.filter((lec) => {
      const deptId = typeof lec.departmentId === 'object' ? lec.departmentId?._id : lec.departmentId;
      const deptName = getUserDepartmentName(lec);
      if (deptId === selectedDepartmentFilter) return true;
      if (targetDept && deptName.toLowerCase() === targetDept.name.toLowerCase()) return true;
      return false;
    });
  }, [lecturers, selectedDepartmentFilter, departments, getUserDepartmentName]);

  // Reset Lecturer filter if current selected lecturer is not in the filtered department
  useEffect(() => {
    if (selectedDepartmentFilter !== 'all' && selectedLecturerFilter !== 'all') {
      const exists = filteredLecturerOptions.some((l) => l._id === selectedLecturerFilter);
      if (!exists) {
        setSelectedLecturerFilter('all');
      }
    }
  }, [selectedDepartmentFilter, selectedLecturerFilter, filteredLecturerOptions]);

  // =============================================================================
  // FILTERED SCHEDULES (Applied across all view modes)
  // =============================================================================

  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      // 1. Filter by Shift
      if (selectedShiftFilter && selectedShiftFilter !== 'all') {
        const targetShift = shifts.find((s) => s._id === selectedShiftFilter);
        if (targetShift && !matchScheduleToShift(item, targetShift)) {
          return false;
        }
      }

      // 2. Filter by Department / Ngành
      if (selectedDepartmentFilter && selectedDepartmentFilter !== 'all') {
        const lec = typeof item.userId === 'object' ? item.userId : null;
        if (!lec) return false;
        const deptId = typeof lec.departmentId === 'object' ? lec.departmentId?._id : lec.departmentId;
        const deptName = getUserDepartmentName(lec);
        const targetDept = departments.find((d) => d._id === selectedDepartmentFilter);
        if (targetDept) {
          const matchId = deptId === selectedDepartmentFilter;
          const matchName = deptName.toLowerCase() === targetDept.name.toLowerCase();
          if (!matchId && !matchName) return false;
        }
      }

      // 3. Filter by Lecturer
      if (selectedLecturerFilter && selectedLecturerFilter !== 'all') {
        const uId = typeof item.userId === 'object' ? item.userId?._id : item.userId;
        if (uId !== selectedLecturerFilter) return false;
      }

      // 4. Keyword Search (Course name, course code, teacher name, staff code, room)
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const sub = typeof item.subjectId === 'object' ? item.subjectId : null;
        const lec = typeof item.userId === 'object' ? item.userId : null;
        const subName = (sub?.name || '').toLowerCase();
        const subCode = (sub?.code || '').toLowerCase();
        const lecName = (lec?.fullName || '').toLowerCase();
        const lecCode = (lec?.staffCode || '').toLowerCase();
        const room = (item.roomId || '').toLowerCase();

        const match =
          subName.includes(q) ||
          subCode.includes(q) ||
          lecName.includes(q) ||
          lecCode.includes(q) ||
          room.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [
    schedules,
    selectedShiftFilter,
    selectedDepartmentFilter,
    selectedLecturerFilter,
    searchKeyword,
    shifts,
    departments,
    getUserDepartmentName,
  ]);

  const hasActiveFilters =
    (selectedShiftFilter && selectedShiftFilter !== 'all') ||
    (selectedDepartmentFilter && selectedDepartmentFilter !== 'all') ||
    (selectedLecturerFilter && selectedLecturerFilter !== 'all') ||
    Boolean(searchKeyword.trim());

  const handleResetFilters = () => {
    setSelectedShiftFilter('all');
    setSelectedDepartmentFilter('all');
    setSelectedLecturerFilter('all');
    setSearchKeyword('');
    setTablePage(1);
  };

  // =============================================================================
  // WEEKDAYS COMPUTATION
  // =============================================================================

  const monday = useMemo(() => getMondayOfWeek(weekRefDate), [weekRefDate]);

  const weekDaysList = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const weekday = d.getDay(); // 0: CN, 1: T2, ..., 6: T7
      const isToday = toIsoDateString(d) === toIsoDateString(new Date());
      const wObj = WEEKDAYS.find((w) => w.value === weekday);
      return {
        date: d,
        isoDate: toIsoDateString(d),
        dayNumber: String(d.getDate()).padStart(2, '0'),
        monthNumber: String(d.getMonth() + 1).padStart(2, '0'),
        weekday,
        label: wObj?.label || 'THỨ',
        shortLabel: wObj?.shortLabel || 'Thứ',
        short: wObj?.short || 'T',
        isToday,
      };
    });
  }, [monday]);

  // Days to display based on selectedDayFilter
  const displayedDays = useMemo(() => {
    if (selectedDayFilter === 'all') return weekDaysList;
    return weekDaysList.filter((d) => d.weekday === selectedDayFilter);
  }, [weekDaysList, selectedDayFilter]);

  // Week navigation handlers
  const handlePrevWeek = () => {
    setWeekRefDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekRefDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleTodayWeek = () => {
    setWeekRefDate(new Date());
  };

  const handleSemesterYearChange = (val: string) => {
    setSelectedSemesterYear(val);
  };

  // =============================================================================
  // MONTH CALENDAR COMPUTATION
  // =============================================================================

  const calendarDays = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 1 is Monday...
    const startOffset = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() + startOffset);

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 35; i++) {
      const isCurrentMonth = current.getMonth() === month;
      const isToday = toIsoDateString(current) === toIsoDateString(new Date());
      const weekday = current.getDay();
      days.push({
        date: new Date(current),
        isoDate: toIsoDateString(current),
        dayNumber: current.getDate(),
        isCurrentMonth,
        isToday,
        weekday,
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [calendarMonthDate]);

  const handlePrevMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    setCalendarMonthDate(new Date());
  };

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  const openCreateModal = (initWeekday?: number, initShift?: ShiftItem, initUserId?: string) => {
    setIsEditing(false);
    setSelectedSchedule(null);
    setConflictError(null);

    const weekdayVal = initWeekday !== undefined ? initWeekday : 1;
    const targetShift = initShift || sortedShifts[0];

    const sTime = targetShift?.startTime || '07:00';
    const eTime = targetShift?.endTime || '11:30';
    const sHour = parseInt(sTime.split(':')[0], 10) || 7;
    let initialStartPeriod = 1;
    let initialPeriodCount = 4;
    if (sHour >= 17) {
      initialStartPeriod = 9;
      initialPeriodCount = 4;
    } else if (sHour >= 12) {
      initialStartPeriod = 5;
      initialPeriodCount = 4;
    }

    const currentSemOpt = SEMESTER_OPTIONS.find((s) => s.key === selectedSemesterYear) || SEMESTER_OPTIONS[0];
    const defaultStartDate = currentSemOpt.defaultStartDate;
    const defaultWeeks = Array.from({ length: 15 }, (_, i) => i + 1);
    const defaultEndDate = calculateEndDateFromWeeks(defaultStartDate, defaultWeeks);

    setFormData({
      userId: initUserId || filteredLecturerOptions[0]?._id || lecturers[0]?._id || user?._id || '',
      shiftId: targetShift?._id || '',
      subjectId: subjects[0]?._id || '',
      roomId: 'Giảng đường CNTT A2-301',
      weekday: weekdayVal,
      startPeriod: initialStartPeriod,
      periodCount: initialPeriodCount,
      startTime: sTime,
      endTime: eTime,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      isRecurring: true,
      scheduleType: 'CHINH_KHOA',
      makeupDate: '',
      weekNumbers: defaultWeeks,
      academicYear: currentSemOpt.academicYear,
      semester: currentSemOpt.semester,
      latitude: 20.9752,
      longitude: 105.7628,
      radiusMeters: 100,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setSelectedSchedule(item);
    setConflictError(null);

    const uId = typeof item.userId === 'object' ? item.userId?._id : item.userId;
    const shId = typeof item.shiftId === 'object' ? item.shiftId?._id : item.shiftId;
    const subId = typeof item.subjectId === 'object' ? item.subjectId?._id : item.subjectId;

    const editWeeks =
      item.weekNumbers && item.weekNumbers.length > 0
        ? item.weekNumbers
        : Array.from({ length: 15 }, (_, i) => i + 1);
    const editStartDate = item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const editEndDate = item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : calculateEndDateFromWeeks(editStartDate, editWeeks);

    setFormData({
      userId: uId || user?._id || '',
      shiftId: shId || '',
      subjectId: subId || '',
      roomId: item.roomId || item.phong_hoc || '',
      weekday: item.weekday ?? item.thu_trong_tuan ?? 1,
      startPeriod: item.startPeriod || item.tiet_bat_dau || 1,
      periodCount: item.periodCount || item.so_tiet || 4,
      startTime: item.startTime || item.gio_bat_dau || '07:00',
      endTime: item.endTime || item.gio_ket_thuc || '11:30',
      startDate: editStartDate,
      endDate: editEndDate,
      isRecurring: item.isRecurring ?? item.lap_lai_hang_tuan ?? true,
      scheduleType: (item.scheduleType || item.loai_lich || 'CHINH_KHOA') as ScheduleType,
      makeupDate: item.makeupDate ? new Date(item.makeupDate).toISOString().split('T')[0] : '',
      weekNumbers: editWeeks,
      academicYear: item.academicYear || item.nam_hoc || academicYearVal,
      semester: item.semester || item.hoc_ky || semesterNum,
      latitude: item.latitude ?? item.vi_do ?? 20.9752,
      longitude: item.longitude ?? item.kinh_do ?? 105.7628,
      radiusMeters: item.radiusMeters ?? item.ban_kinh_met ?? 100,
    });
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  const openDetailModal = (item: ScheduleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSchedule(item);
    setIsDetailModalOpen(true);
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
    setIsDetailModalOpen(false);
    setIsExceptionModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!formData.userId) {
      toast.error('Vui lòng chọn nhân sự / giảng viên phụ trách');
      return;
    }
    if (!formData.roomId.trim()) {
      toast.error('Vui lòng nhập tên phòng / giảng đường');
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
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        radiusMeters: Number(formData.radiusMeters),
      };

      if (isEditing && selectedSchedule) {
        await scheduleApi.updateSchedule(selectedSchedule._id, payload);
        toast.success('Cập nhật lịch phân công thành công');
      } else {
        await scheduleApi.createSchedule(payload);
        toast.success('Tạo mới lịch phân công thành công');
      }

      setIsFormModalOpen(false);
      const currentFilterKey = `${semesterNum}_${academicYearVal}`;
      const savedKey = `${formData.semester}_${formData.academicYear}`;
      if (savedKey !== currentFilterKey) {
        setSelectedSemesterYear(savedKey);
      } else {
        loadSchedules();
      }
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
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch phân công này?')) return;

    try {
      await scheduleApi.deleteSchedule(id);
      toast.success('Đã xóa lịch phân công');
      if (selectedSchedule?._id === id) {
        setIsDetailModalOpen(false);
      }
      loadSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Xóa lịch thất bại');
    }
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    setExceptionSubmitting(true);
    try {
      await scheduleApi.addException(selectedSchedule._id, {
        date: exceptionData.date,
        status: exceptionData.status,
        reason: exceptionData.reason || 'Báo nghỉ / bù từ giao diện lịch trình',
        makeupDate: exceptionData.status === 'DAY_BU' ? exceptionData.makeupDate : undefined,
      });

      toast.success('Ghi nhận ngoại lệ buổi học thành công');
      setIsExceptionModalOpen(false);
      loadSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ghi nhận ngoại lệ thất bại');
    } finally {
      setExceptionSubmitting(false);
    }
  };

  // Card theme generator based on shift name and status
  const getCardStyle = (shiftName: string) => {
    const sName = (shiftName || '').toLowerCase();
    if (sName.includes('sáng') || sName.includes('sang')) {
      return {
        bg: 'bg-blue-50/70 border-blue-200/90 dark:bg-blue-950/25 dark:border-blue-900/60',
        tagBg: 'bg-white/90 text-blue-700 dark:bg-slate-900/90 dark:text-blue-300 border-blue-200/60',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
        hoverBorder: 'hover:border-blue-400',
      };
    }
    if (sName.includes('hành chính') || sName.includes('hanh chinh')) {
      return {
        bg: 'bg-emerald-50/70 border-emerald-200/90 dark:bg-emerald-950/25 dark:border-emerald-900/60',
        tagBg: 'bg-white/90 text-rose-700 dark:bg-slate-900/90 dark:text-rose-300 border-rose-200/60',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
        hoverBorder: 'hover:border-emerald-400',
      };
    }
    if (sName.includes('chiều') || sName.includes('chieu')) {
      return {
        bg: 'bg-amber-50/60 border-amber-200/90 dark:bg-amber-950/25 dark:border-amber-900/60',
        tagBg: 'bg-white/90 text-amber-700 dark:bg-slate-900/90 dark:text-amber-300 border-amber-200/60',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
        hoverBorder: 'hover:border-amber-400',
      };
    }
    return {
      bg: 'bg-purple-50/60 border-purple-200/90 dark:bg-purple-950/25 dark:border-purple-900/60',
      tagBg: 'bg-white/90 text-purple-700 dark:bg-slate-900/90 dark:text-purple-300 border-purple-200/60',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
      hoverBorder: 'hover:border-purple-400',
    };
  };

  // =============================================================================
  // SUB-RENDERER 1: MATRIX VIEW (THỜI KHÓA BIỂU TUẦN MẪU GỐC)
  // =============================================================================

  const renderMatrixView = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className={`overflow-x-auto custom-scrollbar ${widthMode === 'scroll' ? 'min-w-[1300px]' : 'w-full'}`}>
        <table className="w-full border-collapse text-left table-fixed">
          {/* Table Header: CA GIẢNG DẠY + 7 Days */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {/* Column 1: Header CA GIẢNG DẠY */}
              <th className="w-[180px] p-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800">
                CA GIẢNG DẠY
              </th>

              {/* 7 Day Headers */}
              {displayedDays.map((day) => {
                return (
                  <th
                    key={day.isoDate}
                    className="p-2 border-r border-slate-200/80 dark:border-slate-800 last:border-r-0 text-center"
                  >
                    {day.isToday ? (
                      /* Highlighted Box for Today (matching the design) */
                      <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded-xl py-2 px-2 shadow-2xs flex flex-col items-center justify-center">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {day.label}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                          {day.dayNumber}/{day.monthNumber}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white shadow-xs uppercase tracking-wider mt-1">
                          HÔM NAY
                        </span>
                      </div>
                    ) : (
                      /* Standard Day Header */
                      <div className="py-2 px-2 flex flex-col items-center justify-center">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {day.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          {day.dayNumber}/{day.monthNumber}
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body: Shift Rows */}
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={displayedDays.length + 1} className="p-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Đang tải lịch trình giảng dạy...</span>
                  </div>
                </td>
              </tr>
            ) : displayedShifts.length === 0 ? (
              <tr>
                <td colSpan={displayedDays.length + 1} className="p-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <span className="text-xs font-medium">Không tìm thấy ca làm việc phù hợp với bộ lọc hiện tại.</span>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs font-bold text-blue-600 hover:underline mt-1"
                    >
                      Đặt lại bộ lọc
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              displayedShifts.map((shift) => {
                const cardStyle = getCardStyle(shift.name);

                return (
                  <tr key={shift._id} className="divide-x divide-slate-200/80 dark:divide-slate-800">
                    {/* Left Cell: Shift Info */}
                    <td className="p-3.5 bg-slate-50/50 dark:bg-slate-850/40 align-top">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {shift.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 font-mono">
                        <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                      <div className="mt-2">
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                          Trễ {shift.lateThresholdMinutes || 15}p
                        </span>
                      </div>
                    </td>

                    {/* 7 Day Cells */}
                    {displayedDays.map((day) => {
                      // Filtered schedules for this day of week and this shift
                      const cellSchedules = filteredSchedules.filter((item) => {
                        const w = item.weekday ?? item.thu_trong_tuan ?? 1;
                        if (w !== day.weekday) return false;
                        return matchScheduleToShift(item, shift);
                      });

                      return (
                        <td
                          key={day.isoDate}
                          className={`p-2.5 align-top min-h-[140px] transition-colors ${
                            day.isToday ? 'bg-blue-50/15 dark:bg-blue-950/10' : ''
                          }`}
                        >
                          {cellSchedules.length === 0 ? (
                            /* Empty Cell: Centered "Trống" + Hover Add Button */
                            <div
                              onClick={() => openCreateModal(day.weekday, shift)}
                              title={`Thêm lịch vào ${day.label} (${shift.name})`}
                              className="h-full min-h-[110px] flex flex-col items-center justify-center text-center p-2 rounded-xl border border-transparent hover:border-dashed hover:border-blue-300 dark:hover:border-blue-700/60 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 cursor-pointer group/empty transition-all"
                            >
                              <span className="text-xs font-medium text-slate-400 group-hover/empty:hidden">
                                Trống
                              </span>
                              <div className="hidden group-hover/empty:flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 py-1 px-3 rounded-lg shadow-2xs">
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Thêm</span>
                              </div>
                            </div>
                          ) : (
                            /* Occupied Cell: Stacked Cards */
                            <div className="space-y-2">
                              {cellSchedules.map((item) => {
                                const subInfo = resolveSubject(item.subjectId, subjects);
                                const subName = subInfo?.name;
                                const subCode = subInfo?.code;
                                const lec = typeof item.userId === 'object' ? item.userId : null;
                                const teacherName = lec?.fullName || 'Vũ Tiến Đức';
                                const deptName = getUserDepartmentName(lec);
                                const roomName = item.roomId || 'Phòng học';

                                return (
                                  <div
                                    key={item._id}
                                    onClick={(e) => openDetailModal(item, e)}
                                    className={`rounded-2xl p-2.5 border transition-all text-xs cursor-pointer shadow-2xs hover:shadow-md relative group/card ${cardStyle.bg} ${cardStyle.hoverBorder}`}
                                  >
                                    {/* Quick Actions Overlay (hiện mượt khi hover góc trên phải) */}
                                    {isAdminOrDean && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute top-1.5 right-1.5 z-20 hidden group-hover/card:flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/95 rounded-lg p-0.5 shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur-xs transition-all"
                                      >
                                        <button
                                          type="button"
                                          title="Xem chi tiết"
                                          onClick={(e) => openDetailModal(item, e)}
                                          className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          title="Sửa lịch"
                                          onClick={(e) => openEditModal(item, e)}
                                          className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          title="Xóa lịch"
                                          onClick={(e) => handleDeleteSchedule(item._id, e)}
                                          className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}

                                    {/* Top Row: Location Tag */}
                                    <div className="flex items-center gap-1 mb-1.5 pr-1">
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${cardStyle.tagBg} truncate max-w-full`}
                                        title={roomName}
                                      >
                                        <MapPin className="w-2.5 h-2.5 shrink-0 text-rose-500" />
                                        <span className="truncate">{roomName}</span>
                                      </span>
                                    </div>

                                    {/* Teacher Name (Bold) */}
                                    <div className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate leading-snug" title={teacherName}>
                                      {teacherName}
                                    </div>

                                    {/* Department */}
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate mt-0.5" title={deptName}>
                                      <Building2 className="w-3 h-3 shrink-0 opacity-70" />
                                      <span className="truncate">{deptName}</span>
                                    </div>

                                    {/* Subject (Blue Text) */}
                                    {subInfo ? (
                                      <div
                                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate mt-1 flex items-center gap-1"
                                        title={`${subCode ? `[${subCode}] ` : ''}${subName}`}
                                      >
                                        <BookOpen className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{subCode ? `[${subCode}] ` : ''}{subName}</span>
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-400 italic mt-1 flex items-center gap-1">
                                        <BookOpen className="w-3 h-3 shrink-0 opacity-40" />
                                        <span>(Chưa gắn môn học)</span>
                                      </div>
                                    )}

                                    {/* Bottom: Time & Recurring Badge (Không bao giờ rớt dòng) */}
                                    <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 text-[10px] whitespace-nowrap overflow-hidden">
                                      <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold text-[10px] tracking-tight shrink-0 whitespace-nowrap">
                                        {item.startTime} - {item.endTime}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold whitespace-nowrap shrink-0 ${cardStyle.badgeColor}`}>
                                        {item.scheduleType === 'DAY_BU' ? 'Dạy bù' : 'Cả kỳ'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Bottom Cell Action: "+ Thêm" Button */}
                              {isAdminOrDean && (
                                <button
                                  type="button"
                                  onClick={() => openCreateModal(day.weekday, shift)}
                                  className="w-full py-1 px-2 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-2xs mt-1.5"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Thêm</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =============================================================================
  // SUB-RENDERER 2: LECTURER VIEW (THEO GIẢNG VIÊN / PHÂN CÔNG CÁN BỘ)
  // =============================================================================

  const renderLecturerView = () => {
    // Only show lecturers matching department filter or keyword, or having scheduled items
    const relevantLecturers = filteredLecturerOptions.filter((lec) => {
      if (selectedLecturerFilter !== 'all' && lec._id !== selectedLecturerFilter) return false;
      return true;
    });

    return (
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <span className="text-xs text-slate-500">Đang tải phân công theo giảng viên...</span>
          </div>
        ) : relevantLecturers.length === 0 ? (
          <div className="p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy giảng viên phù hợp</h4>
            <p className="text-xs text-slate-500 mt-1">Vui lòng điều chỉnh lại bộ lọc ngành hoặc từ khóa tìm kiếm.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 text-xs font-bold text-blue-600 hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {relevantLecturers.map((lec) => {
              // Get schedules for this lecturer
              const lecSchedules = filteredSchedules.filter((item) => {
                const uId = typeof item.userId === 'object' ? item.userId?._id : item.userId;
                return uId === lec._id;
              });

              const deptName = getUserDepartmentName(lec);
              const initials = (lec.fullName || 'GV')
                .split(' ')
                .map((n) => n[0])
                .slice(-2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={lec._id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Header: Lecturer Profile */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{lec.fullName}</h3>
                          {lec.staffCode && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {lec.staffCode}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {lec.role || 'Giảng viên'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <Building2 className="w-3.5 h-3.5 opacity-70" />
                          <span>{deptName}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span>{lec.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                        {lecSchedules.length} buổi giảng dạy
                      </span>
                      {isAdminOrDean && (
                        <button
                          type="button"
                          onClick={() => openCreateModal(1, undefined, lec._id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Giao lịch mới
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 7-Day Horizontal Schedule Strip */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {weekDaysList.map((day) => {
                      const daySchedules = lecSchedules.filter((item) => {
                        const w = item.weekday ?? item.thu_trong_tuan ?? 1;
                        return w === day.weekday;
                      });

                      return (
                        <div
                          key={day.isoDate}
                          className={`rounded-xl border p-2.5 min-h-[110px] flex flex-col justify-between ${
                            day.isToday
                              ? 'bg-blue-50/25 border-blue-300 dark:bg-blue-950/20 dark:border-blue-700'
                              : 'bg-slate-50/40 border-slate-200/70 dark:bg-slate-800/20 dark:border-slate-800'
                          }`}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {day.shortLabel}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {day.dayNumber}/{day.monthNumber}
                            </span>
                          </div>

                          {/* Day Content */}
                          <div className="space-y-1.5 flex-1">
                            {daySchedules.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-center">
                                <span className="text-[11px] text-slate-400 italic">Nghỉ</span>
                              </div>
                            ) : (
                              daySchedules.map((item) => {
                                const subInfo = resolveSubject(item.subjectId, subjects);
                                const subName = subInfo?.name || 'Phân công công tác';
                                const roomName = item.roomId || item.phong_hoc || 'Phòng học';
                                const sh = typeof item.shiftId === 'object' ? item.shiftId : null;
                                const shName = sh?.name || (sh as any)?.ten_ca || 'Ca học';
                                const cardStyle = getCardStyle(shName);

                                return (
                                  <div
                                    key={item._id}
                                    onClick={() => openDetailModal(item)}
                                    className={`p-1.5 rounded-lg border text-[11px] cursor-pointer shadow-2xs transition-all hover:scale-[1.02] ${cardStyle.bg} ${cardStyle.hoverBorder}`}
                                    title="Nhấp để xem chi tiết"
                                  >
                                    <div className="font-bold truncate text-slate-800 dark:text-slate-100">
                                      {subInfo?.code ? `[${subInfo.code}] ` : ''}{subName}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 truncate">
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">{roomName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] mt-1 text-slate-400 font-mono">
                                      <span>{item.startTime} - {item.endTime}</span>
                                      <span className="font-sans font-bold text-blue-600">{shName}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Quick Add Button */}
                          {isAdminOrDean && (
                            <button
                              type="button"
                              onClick={() => openCreateModal(day.weekday, undefined, lec._id)}
                              className="mt-2 w-full py-0.5 text-[10px] font-semibold text-slate-400 hover:text-blue-600 border border-dashed border-slate-200 hover:border-blue-300 rounded flex items-center justify-center gap-0.5"
                            >
                              <Plus className="w-2.5 h-2.5" /> Thêm
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =============================================================================
  // SUB-RENDERER 3: TABLE VIEW (DẠNG BẢNG DANH SÁCH QUẢN TRỊ CHI TIẾT)
  // =============================================================================

  const paginatedSchedules = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredSchedules.slice(start, start + tablePageSize);
  }, [filteredSchedules, tablePage, tablePageSize]);

  const totalPages = Math.ceil(filteredSchedules.length / tablePageSize) || 1;

  const renderTableView = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[11px]">
              <th className="p-3.5 w-12 text-center">#</th>
              <th className="p-3.5">Học phần / Môn học</th>
              <th className="p-3.5">Giảng viên / Cán bộ</th>
              <th className="p-3.5">Ngành / Đơn vị</th>
              <th className="p-3.5">Lịch giảng dạy</th>
              <th className="p-3.5">Ca làm việc</th>
              <th className="p-3.5">Địa điểm</th>
              <th className="p-3.5 text-center">Loại lịch</th>
              <th className="p-3.5 text-right w-28">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-16 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  Đang tải bảng danh sách...
                </td>
              </tr>
            ) : paginatedSchedules.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-16 text-center text-slate-400">
                  <TableIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy phân công lịch nào</p>
                  <p className="text-xs text-slate-400 mt-1">Vui lòng thử tìm kiếm khác hoặc xóa bộ lọc.</p>
                </td>
              </tr>
            ) : (
              paginatedSchedules.map((item, idx) => {
                const subInfo = resolveSubject(item.subjectId, subjects);
                const lec = typeof item.userId === 'object' ? item.userId : null;
                const sh = typeof item.shiftId === 'object' ? item.shiftId : null;
                const teacherName = lec?.fullName || 'Vũ Tiến Đức';
                const deptName = getUserDepartmentName(lec);
                const roomName = item.roomId || 'Phòng học';
                const subName = subInfo?.name || 'Phân công công tác chung';
                const subCode = subInfo?.code;
                const shiftName = sh?.name || 'Ca học tiêu chuẩn';
                const weekdayObj = WEEKDAYS.find((w) => w.value === (item.weekday ?? item.thu_trong_tuan));

                return (
                  <tr
                    key={item._id}
                    onClick={() => openDetailModal(item)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 text-center font-mono text-slate-400 font-bold">
                      {(tablePage - 1) * tablePageSize + idx + 1}
                    </td>

                    {/* Subject */}
                    <td className="p-3.5">
                      <div className="font-bold text-blue-600 dark:text-blue-400">{subName}</div>
                      {subCode && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">Mã: {subCode}</div>
                      )}
                    </td>

                    {/* Lecturer */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{teacherName}</div>
                      {lec?.staffCode && (
                        <div className="text-[10px] font-mono text-slate-400">{lec.staffCode}</div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {deptName}
                      </span>
                    </td>

                    {/* Day & Time */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {weekdayObj?.label || 'THỨ HAI'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        {item.startTime} - {item.endTime}
                      </div>
                    </td>

                    {/* Shift */}
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {shiftName}
                      </span>
                    </td>

                    {/* Room */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        {roomName}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.scheduleType === 'DAY_BU'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        }`}
                      >
                        {item.scheduleType === 'DAY_BU' ? 'Dạy bù' : 'Chính khóa'}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {isAdminOrDean && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Chỉnh sửa"
                            onClick={(e) => openEditModal(item, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Báo nghỉ / bù"
                            onClick={(e) => openExceptionModal(item, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Xóa"
                            onClick={(e) => handleDeleteSchedule(item._id, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={tablePageSize}
            onChange={(e) => {
              setTablePageSize(Number(e.target.value));
              setTablePage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>/ trang • Tổng số <strong>{filteredSchedules.length}</strong> bản ghi</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={tablePage <= 1}
            onClick={() => setTablePage((p) => Math.max(1, p - 1))}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Trước
          </button>
          <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
            Trang {tablePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={tablePage >= totalPages}
            onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // SUB-RENDERER 4: CALENDAR VIEW (LỊCH THÁNG TRỰC QUAN)
  // =============================================================================

  const renderCalendarView = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
      {/* Calendar Header Month Navigator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Tháng {calendarMonthDate.getMonth() + 1} / {calendarMonthDate.getFullYear()}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleTodayMonth}
            className="px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar 7 Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs uppercase tracking-wider text-slate-500 py-1">
        {WEEKDAYS.map((w) => (
          <div key={w.value} className="py-1">
            {w.shortLabel}
          </div>
        ))}
      </div>

      {/* Calendar Grid 35 Cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((cd) => {
          // Schedules matching this day of week
          const daySchedules = filteredSchedules.filter((item) => {
            const w = item.weekday ?? item.thu_trong_tuan ?? 1;
            return w === cd.weekday;
          });

          return (
            <div
              key={cd.isoDate}
              className={`rounded-xl border p-2 min-h-[110px] flex flex-col justify-between transition-all ${
                !cd.isCurrentMonth
                  ? 'opacity-40 bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-850'
                  : cd.isToday
                  ? 'bg-blue-50/30 border-blue-400 dark:bg-blue-950/30 dark:border-blue-700 shadow-2xs'
                  : 'bg-white dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${
                    cd.isToday
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cd.dayNumber}
                </span>

                {isAdminOrDean && cd.isCurrentMonth && (
                  <button
                    type="button"
                    onClick={() => openCreateModal(cd.weekday)}
                    title="Thêm lịch vào ngày này"
                    className="opacity-0 hover:opacity-100 p-0.5 rounded text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Schedules inside calendar cell */}
              <div className="space-y-1 flex-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                {daySchedules.slice(0, 3).map((item) => {
                  const subInfo = resolveSubject(item.subjectId, subjects);
                  const sh = typeof item.shiftId === 'object' ? item.shiftId : null;
                  const shName = sh?.name || 'Ca';
                  const cardStyle = getCardStyle(shName);

                  return (
                    <div
                      key={item._id}
                      onClick={() => openDetailModal(item)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate cursor-pointer transition-transform hover:scale-[1.02] ${cardStyle.bg} ${cardStyle.hoverBorder}`}
                      title={`${subInfo?.name || 'Lịch'} (${item.startTime} - ${item.endTime})`}
                    >
                      <span className="font-mono">{item.startTime}</span> {subInfo?.name || 'Công tác'}
                    </div>
                  );
                })}

                {daySchedules.length > 3 && (
                  <div className="text-[9px] font-bold text-blue-600 pl-1">
                    +{daySchedules.length - 3} lịch khác...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RETURN JSX
  // =============================================================================

  return (
    <div className="space-y-3 font-sans pb-12 select-none">
      {/* =========================================================================
          BAR 1: HEADER & VIEW MODE SELECTOR (4 MODES)
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: View Mode Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'matrix'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Thời khóa biểu tuần</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('lecturer')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'lecturer'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Theo giảng viên</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-slate-700'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Dạng bảng quản trị</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Lịch tháng</span>
          </button>
        </div>

        {/* Right: Semester & Create Schedule Action */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          {/* Học kỳ Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 shadow-2xs">
            <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Học kỳ:</span>
            <select
              value={selectedSemesterYear}
              onChange={(e) => handleSemesterYearChange(e.target.value)}
              className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
            >
              {SEMESTER_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Create Button */}
          {isAdminOrDean && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm lịch</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          BAR 2: ADVANCED FILTER TOOLBAR (LỌC THEO CA, THEO NGÀNH, GIẢNG VIÊN, TỪ KHÓA)
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Filter Icon & Label */}
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 pl-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold">Lọc theo:</span>
          </div>

          {/* Filter 1: LỌC THEO CA */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Tất cả các ca</option>
              {sortedShifts.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: LỌC THEO NGÀNH / KHOA */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Tất cả ngành / khoa</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: LỌC THEO GIẢNG VIÊN */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-xs">
            <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={selectedLecturerFilter}
              onChange={(e) => setSelectedLecturerFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Tất cả giảng viên</option>
              {filteredLecturerOptions.map((lec) => (
                <option key={lec._id} value={lec._id}>
                  {lec.fullName} {lec.staffCode ? `(${lec.staffCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: TÌM KIẾM TỪ KHÓA (Môn học, Giảng viên, Phòng) */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm môn học, phòng, cán bộ..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset Filter Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="Đặt lại bộ lọc"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>

        {/* Counter Badge */}
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 pr-1">
          Hiển thị <strong className="text-blue-600 dark:text-blue-400">{filteredSchedules.length}</strong> / {schedules.length} phân công
        </div>
      </div>

      {/* =========================================================================
          BAR 3: WEEK NAVIGATION & DAY TABS (Used for 'matrix' and 'lecturer')
         ========================================================================= */}
      {(viewMode === 'matrix' || viewMode === 'lecturer') && (
        <div className="space-y-2">
          {/* Week Navigator & Width Toggles */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevWeek}
                title="Tuần trước"
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/80">
                Tuần: {formatDayMonth(weekDaysList[0].date)} - {formatDayMonth(weekDaysList[6].date)}/{weekDaysList[6].date.getFullYear()}
              </span>

              <button
                type="button"
                onClick={handleNextWeek}
                title="Tuần sau"
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTodayWeek}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 transition-colors"
              >
                Tuần này
              </button>
            </div>

            {/* Matrix Width Toggles */}
            {viewMode === 'matrix' && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setWidthMode('fit')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    widthMode === 'fit'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Vừa màn hình (7 ngày)
                </button>
                <button
                  type="button"
                  onClick={() => setWidthMode('scroll')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    widthMode === 'scroll'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Cuộn rộng
                </button>
              </div>
            )}
          </div>

          {/* "Xem ngày:" Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-xs flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0 pl-1">
              Xem ngày:
            </span>

            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedDayFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-slate-700'
              }`}
            >
              Tất cả (7 ngày)
            </button>

            {weekDaysList.map((day) => {
              const isSelected = selectedDayFilter === day.weekday;
              return (
                <button
                  key={day.isoDate}
                  type="button"
                  onClick={() => setSelectedDayFilter(day.weekday)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{day.shortLabel}</span>
                  <span className="opacity-80">({day.dayNumber}/{day.monthNumber})</span>
                  {day.isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'} animate-pulse`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN CONTENT AREA ACCORDING TO VIEW MODE
         ========================================================================= */}
      {viewMode === 'matrix' && renderMatrixView()}
      {viewMode === 'lecturer' && renderLecturerView()}
      {viewMode === 'table' && renderTableView()}
      {viewMode === 'calendar' && renderCalendarView()}

      {/* =========================================================================
          MODAL 1: CREATE / EDIT SCHEDULE FORM
         ========================================================================= */}
      {isFormModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  {isEditing ? 'Cập Nhật Lịch Phân Công' : 'Thêm Lịch Phân Công Mới'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điền thông tin nhân sự, môn học, ca làm việc và phòng học giảng dạy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {conflictError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Xung đột lịch học:</strong> {conflictError}
                  </div>
                </div>
              )}

              {/* Kế hoạch Đào tạo: Năm học & Học kỳ */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-slate-800/90 dark:to-indigo-950/40 border border-blue-200/70 dark:border-blue-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Kế hoạch Đào tạo (Năm học & Học kỳ)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/50">
                    Phân chia theo kỳ học
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Áp dụng cho kỳ:</span>
                    <select
                      value={`${formData.semester}_${formData.academicYear}`}
                      onChange={(e) => {
                        const targetKey = e.target.value;
                        const semOpt = SEMESTER_OPTIONS.find((s) => s.key === targetKey);
                        if (semOpt) {
                          const newStart = semOpt.defaultStartDate;
                          const newEnd = calculateEndDateFromWeeks(newStart, formData.weekNumbers);
                          setFormData({
                            ...formData,
                            semester: semOpt.semester,
                            academicYear: semOpt.academicYear,
                            startDate: newStart,
                            endDate: newEnd,
                          });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                    >
                      {SEMESTER_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-center px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-400">Khai giảng kỳ (Tuần 1):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatDateFull(formData.startDate)}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Đã tự động khớp 15 tuần theo kỳ
                    </span>
                  </div>
                </div>
              </div>

              {/* Nhân sự / Giảng viên */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nhân sự / Giảng viên phụ trách <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {lecturers.map((lec) => (
                    <option key={lec._id} value={lec._id}>
                      {lec.fullName} ({lec.staffCode || 'N/A'}) - {getUserDepartmentName(lec)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ca làm việc & Thứ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ca làm việc <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => {
                      const sh = shifts.find((s) => s._id === e.target.value);
                      const sTime = sh?.startTime || formData.startTime;
                      const sHour = parseInt((sTime || '07:00').split(':')[0], 10) || 7;
                      let sp = 1;
                      if (sHour >= 17) sp = 9;
                      else if (sHour >= 12) sp = 5;

                      setFormData({
                        ...formData,
                        shiftId: e.target.value,
                        startTime: sTime,
                        endTime: sh?.endTime || formData.endTime,
                        startPeriod: sp,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chọn ca làm việc --</option>
                    {sortedShifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Thứ trong tuần <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.weekday}
                    onChange={(e) => setFormData({ ...formData, weekday: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label} ({w.shortLabel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phòng học & Môn học */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Phòng học / Địa điểm <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    placeholder="Ví dụ: Giảng đường CNTT A2-301, Văn phòng Đào Tạo"
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Môn học (nếu có)
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Không gắn môn học (Hành chính / Sinh hoạt) --</option>
                    {subjects.map((sub) => {
                      const sName = sub.name || sub.ten_mon || 'Môn học';
                      const sCode = sub.code || sub.ma_mon;
                      const sCredits = sub.credits || sub.so_tin_chi || 3;
                      return (
                        <option key={sub._id} value={sub._id}>
                          {sCode ? `[${sCode}] ` : ''}{sName} ({sCredits} TC)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Tọa độ GPS & Bán kính điểm danh (Geofence NTU) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Tọa độ GPS & Bán kính điểm danh (Geofence NTU)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Mặc định: 28A Lê Trọng Tấn, Hà Đông
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Vĩ độ (Lat):</span>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Kinh độ (Lng):</span>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Bán kính hợp lệ (mét):</span>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={formData.radiusMeters}
                      onChange={(e) => setFormData({ ...formData, radiusMeters: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Giờ bắt đầu & Kết thúc */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Hiệu lực ngày & Tự động đồng bộ theo tuần học */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Hiệu lực từ ngày (Bắt đầu Tuần 1) <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setFormData({
                        ...formData,
                        startDate: newStart,
                        endDate: calculateEndDateFromWeeks(newStart, formData.weekNumbers),
                      });
                    }}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Mốc tính tuần học kỳ (Tuần 1: {getWeekDateString(formData.startDate, 1) || '--/--'})
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Đến ngày
                    </label>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Tự động tính theo tuần
                    </span>
                  </div>
                  <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-mono flex items-center justify-between">
                    <span className="font-bold">{formatDateFull(formData.endDate)}</span>
                    <span className="text-[10px] font-medium text-slate-500">
                      (Hết Tuần {formData.weekNumbers.length > 0 ? Math.max(...formData.weekNumbers) : 15})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tự động co giãn theo tuần học cuối cùng được chọn
                  </p>
                </div>
              </div>

              {/* Tuần học áp dụng (Cấu trúc lại trực quan, thông minh) */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      <span>Tuần học áp dụng</span>
                    </label>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Đã chọn: {formData.weekNumbers.length} / 15 tuần
                    </span>
                  </div>

                  {/* Nút Preset chọn nhanh */}
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const weeks = Array.from({ length: 15 }, (_, i) => i + 1);
                        setFormData({
                          ...formData,
                          weekNumbers: weeks,
                          endDate: calculateEndDateFromWeeks(formData.startDate, weeks),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 transition-colors"
                    >
                      Tất cả (1-15)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const weeks = Array.from({ length: 15 }, (_, i) => i + 1).filter((w) => w % 2 !== 0);
                        setFormData({
                          ...formData,
                          weekNumbers: weeks,
                          endDate: calculateEndDateFromWeeks(formData.startDate, weeks),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                    >
                      Tuần lẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const weeks = Array.from({ length: 15 }, (_, i) => i + 1).filter((w) => w % 2 === 0);
                        setFormData({
                          ...formData,
                          weekNumbers: weeks,
                          endDate: calculateEndDateFromWeeks(formData.startDate, weeks),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                    >
                      Tuần chẵn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const weeks = Array.from({ length: 8 }, (_, i) => i + 1);
                        setFormData({
                          ...formData,
                          weekNumbers: weeks,
                          endDate: calculateEndDateFromWeeks(formData.startDate, weeks),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                    >
                      Nửa đầu (1-8)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const weeks = Array.from({ length: 7 }, (_, i) => i + 9);
                        setFormData({
                          ...formData,
                          weekNumbers: weeks,
                          endDate: calculateEndDateFromWeeks(formData.startDate, weeks),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                    >
                      Nửa cuối (9-15)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          weekNumbers: [],
                          endDate: calculateEndDateFromWeeks(formData.startDate, []),
                        });
                      }}
                      className="text-[10px] px-2 py-1 font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Khối chọn tuần phân chia 2 giai đoạn kèm ngày cụ thể */}
                <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                  {/* Giai đoạn 1: Tuần 1 -> 8 */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Giai đoạn 1 (Tuần 1 - 8)
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((wNum) => {
                        const isSelected = formData.weekNumbers.includes(wNum);
                        const weekDate = getWeekDateString(formData.startDate, wNum);
                        return (
                          <button
                            key={wNum}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? formData.weekNumbers.filter((w) => w !== wNum)
                                : [...formData.weekNumbers, wNum].sort((a, b) => a - b);
                              setFormData({
                                ...formData,
                                weekNumbers: updated,
                                endDate: calculateEndDateFromWeeks(formData.startDate, updated),
                              });
                            }}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs scale-[1.02]'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                            }`}
                          >
                            <span>T{wNum}</span>
                            <span className={`text-[9px] font-mono leading-none ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {weekDate}
                            </span>
                            <span className={`text-[8.5px] px-1 rounded font-semibold ${
                              isSelected ? 'bg-blue-500/80 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}>
                              {isSelected ? 'Học' : 'Nghỉ'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Giai đoạn 2: Tuần 9 -> 15 */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Giai đoạn 2 (Tuần 9 - 15)
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {Array.from({ length: 7 }, (_, i) => i + 9).map((wNum) => {
                        const isSelected = formData.weekNumbers.includes(wNum);
                        const weekDate = getWeekDateString(formData.startDate, wNum);
                        return (
                          <button
                            key={wNum}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? formData.weekNumbers.filter((w) => w !== wNum)
                                : [...formData.weekNumbers, wNum].sort((a, b) => a - b);
                              setFormData({
                                ...formData,
                                weekNumbers: updated,
                                endDate: calculateEndDateFromWeeks(formData.startDate, updated),
                              });
                            }}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs scale-[1.02]'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                            }`}
                          >
                            <span>T{wNum}</span>
                            <span className={`text-[9px] font-mono leading-none ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {weekDate}
                            </span>
                            <span className={`text-[8.5px] px-1 rounded font-semibold ${
                              isSelected ? 'bg-blue-500/80 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}>
                              {isSelected ? 'Học' : 'Nghỉ'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {formData.weekNumbers.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Vui lòng chọn ít nhất 1 tuần áp dụng cho lịch giảng dạy này.</span>
                  </p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  isLoading={formSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {isEditing ? 'Lưu thay đổi' : 'Tạo lịch phân công'}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL 2: SCHEDULE DETAIL MODAL (CHI TIẾT LỊCH GIẢNG DẠY RÕ RÀNG, ĐẦY ĐỦ)
         ========================================================================= */}
      {isDetailModalOpen && selectedSchedule && (() => {
        const subInfo = resolveSubject(selectedSchedule.subjectId, subjects);

        const lec = typeof selectedSchedule.userId === 'object'
          ? selectedSchedule.userId
          : lecturers.find((l) => l._id === selectedSchedule.userId);

        const sh = typeof selectedSchedule.shiftId === 'object'
          ? selectedSchedule.shiftId
          : shifts.find((s) => s._id === selectedSchedule.shiftId);

        const wVal = selectedSchedule.weekday ?? selectedSchedule.thu_trong_tuan ?? 1;
        const wObj = WEEKDAYS.find((w) => w.value === wVal) || WEEKDAYS[0];

        const startP = selectedSchedule.startPeriod || selectedSchedule.tiet_bat_dau || 1;
        const countP = selectedSchedule.periodCount || selectedSchedule.so_tiet || 4;
        const endP = startP + countP - 1;

        const startDate = selectedSchedule.startDate || selectedSchedule.ngay_bat_dau;
        const endDate = selectedSchedule.endDate || selectedSchedule.ngay_ket_thuc;
        const isMakeup = selectedSchedule.scheduleType === 'DAY_BU';
        const makeupDate = selectedSchedule.makeupDate || selectedSchedule.ngay_day_bu;

        const weeks = selectedSchedule.weekNumbers && selectedSchedule.weekNumbers.length > 0
          ? selectedSchedule.weekNumbers
          : (selectedSchedule.danh_sach_tuan && selectedSchedule.danh_sach_tuan.length > 0
            ? selectedSchedule.danh_sach_tuan
            : Array.from({ length: 15 }, (_, i) => i + 1));

        const exceptions = selectedSchedule.exceptions || selectedSchedule.ngoai_le || [];
        const isRecurring = selectedSchedule.isRecurring ?? selectedSchedule.lap_lai_hang_tuan ?? true;
        const acadYear = selectedSchedule.academicYear || selectedSchedule.nam_hoc || academicYearVal;
        const sem = selectedSchedule.semester || selectedSchedule.hoc_ky || semesterNum;

        return (
          <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/60 dark:bg-slate-900/60">
                  <div className="space-y-1.5 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isMakeup
                          ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                      }`}>
                        {isMakeup ? 'Lịch Dạy Bù' : 'Lịch Chính Khóa'}
                      </span>
                      {sh && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                          {sh.name || (sh as any).ten_ca} ({sh.startTime || (sh as any).gio_bat_dau} - {sh.endTime || (sh as any).gio_ket_thuc})
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                        {wObj.label}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {subInfo?.name || 'Phân công công tác / Hành chính'}
                      {subInfo?.code && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono font-semibold">
                          {subInfo.code}
                        </span>
                      )}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Đóng"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content - Scrollable */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
                  {/* Khối Giảng viên & Đơn vị */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {lec?.fullName || 'Chưa phân công'}
                          </span>
                          {(lec?.staffCode) && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Mã CB: {lec.staffCode}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{getUserDepartmentName(selectedSchedule.userId)}</span>
                          {lec?.email && (
                            <>
                              <span>•</span>
                              <span>{lec.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Khối Lưới Thông tin Lịch trình */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Thẻ Thời gian & Tiết */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Thời gian & Tiết học</span>
                      </div>
                      <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Khung giờ:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {selectedSchedule.startTime} - {selectedSchedule.endTime}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tiết giảng dạy:</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            Tiết {startP} - {endP} ({countP} tiết)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ca phân công:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {sh?.name || 'Theo khung giờ'}
                          </span>
                        </div>
                        {sh?.lateThresholdMinutes !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Ngang trễ tối đa:</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {sh.lateThresholdMinutes} phút
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Thẻ Địa điểm & Phòng học */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Địa điểm & Học phần</span>
                      </div>
                      <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Phòng học:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {selectedSchedule.roomId || selectedSchedule.phong_hoc || 'Chưa xếp phòng'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Số tín chỉ:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {subInfo?.credits ? `${subInfo.credits} Tín chỉ` : '3 Tín chỉ'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Hình thức lặp:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {isRecurring ? 'Lặp lại hàng tuần' : 'Một lần duy nhất'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tọa độ GPS Geofence:</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {selectedSchedule.latitude ?? selectedSchedule.vi_do ?? 20.9752},{' '}
                            {selectedSchedule.longitude ?? selectedSchedule.kinh_do ?? 105.7628} (R: {selectedSchedule.radiusMeters ?? selectedSchedule.ban_kinh_met ?? 100}m)
                          </span>
                        </div>
                        {isMakeup && makeupDate && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Ngày học bù:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {formatDateFull(makeupDate)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Khối Kế hoạch Học kỳ & Tuần áp dụng (Cấu trúc lại trực quan theo 2 giai đoạn) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-3.5">
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Kế hoạch Đào tạo & Tuần áp dụng</span>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                        {acadYear} • Học kỳ {sem}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 text-[11px]">
                      <div>
                        <span className="text-slate-400">Thời gian hiệu lực: </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateFull(startDate)} → {formatDateFull(endDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="text-slate-400">Tần suất học: </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {weeks.length === 15
                            ? 'Cả học kỳ (15/15 tuần)'
                            : weeks.every((w: number) => w % 2 !== 0)
                            ? `Cách tuần (Tuần lẻ: ${weeks.length} tuần)`
                            : weeks.every((w: number) => w % 2 === 0)
                            ? `Cách tuần (Tuần chẵn: ${weeks.length} tuần)`
                            : `Tùy chọn ${weeks.length} / 15 tuần`}
                        </span>
                      </div>
                    </div>

                    {/* Lưới tuần áp dụng 2 giai đoạn */}
                    <div className="space-y-2.5 pt-1">
                      {/* Giai đoạn 1 */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Giai đoạn 1 (Tuần 1 - 8)
                        </span>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                          {Array.from({ length: 8 }, (_, i) => i + 1).map((wNum) => {
                            const isActive = weeks.includes(wNum);
                            const wDateStr = getWeekDateString(startDate, wNum);
                            return (
                              <div
                                key={wNum}
                                className={`py-1.5 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 border transition-all ${
                                  isActive
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700/60 opacity-60'
                                }`}
                                title={isActive ? `Tuần ${wNum} (${wDateStr}): Có lịch giảng dạy` : `Tuần ${wNum} (${wDateStr}): Nghỉ`}
                              >
                                <span className="text-[11px] font-bold">T{wNum}</span>
                                {wDateStr && (
                                  <span className={`text-[8.5px] font-mono leading-none ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {wDateStr}
                                  </span>
                                )}
                                <span className="text-[9px] font-medium leading-none">
                                  {isActive ? 'Học' : 'Nghỉ'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Giai đoạn 2 */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Giai đoạn 2 (Tuần 9 - 15)
                        </span>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                          {Array.from({ length: 7 }, (_, i) => i + 9).map((wNum) => {
                            const isActive = weeks.includes(wNum);
                            const wDateStr = getWeekDateString(startDate, wNum);
                            return (
                              <div
                                key={wNum}
                                className={`py-1.5 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 border transition-all ${
                                  isActive
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700/60 opacity-60'
                                }`}
                                title={isActive ? `Tuần ${wNum} (${wDateStr}): Có lịch giảng dạy` : `Tuần ${wNum} (${wDateStr}): Nghỉ`}
                              >
                                <span className="text-[11px] font-bold">T{wNum}</span>
                                {wDateStr && (
                                  <span className={`text-[8.5px] font-mono leading-none ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {wDateStr}
                                  </span>
                                )}
                                <span className="text-[9px] font-medium leading-none">
                                  {isActive ? 'Học' : 'Nghỉ'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Chú thích (Legend) */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">Có lịch học ({weeks.length} tuần)</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                          <span className="text-slate-400 font-medium">Nghỉ ({15 - weeks.length} tuần)</span>
                        </span>
                      </div>
                      <span className="italic">{isRecurring ? 'Chu kỳ lặp hàng tuần' : 'Lịch phát sinh'}</span>
                    </div>
                  </div>

                  {/* Ngoại lệ buổi học (nếu có) */}
                  {exceptions.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Ngoại lệ buổi học đã ghi nhận ({exceptions.length})</span>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {exceptions.map((ex: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-amber-100 dark:border-amber-900/30 last:border-0">
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatDateFull(ex.date || ex.ngay)}
                              </span>
                              <span className="mx-2 text-slate-300">•</span>
                              <span className="text-slate-600 dark:text-slate-400">{ex.reason || ex.ly_do || 'Không rõ lý do'}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              {ex.status || ex.trang_thai || 'NGHI'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    {isAdminOrDean && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDeleteSchedule(selectedSchedule._id, e)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Xóa lịch
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdminOrDean && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => openExceptionModal(selectedSchedule, e)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 dark:border-amber-900/60"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          Báo nghỉ / bù
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => openEditModal(selectedSchedule, e)}
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Chỉnh sửa
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}

      {/* =========================================================================
          MODAL 3: EXCEPTION MODAL (BÁO NGHỈ / DẠY BÙ)
         ========================================================================= */}
      {isExceptionModalOpen && selectedSchedule && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Ghi Nhận Báo Nghỉ / Bù
              </h3>
              <button
                type="button"
                onClick={() => setIsExceptionModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ngày áp dụng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={exceptionData.date}
                  onChange={(e) => setExceptionData({ ...exceptionData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Trạng thái ngoại lệ
                </label>
                <select
                  value={exceptionData.status}
                  onChange={(e) => setExceptionData({ ...exceptionData, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  <option value="NGHI">Báo Nghỉ (Tạm hoãn buổi học)</option>
                  <option value="DAY_BU">Xếp Lịch Học Bù</option>
                  <option value="HUY">Hủy Bỏ Buổi Học Này</option>
                </select>
              </div>

              {exceptionData.status === 'DAY_BU' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày học bù dự kiến <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={exceptionData.makeupDate}
                    onChange={(e) => setExceptionData({ ...exceptionData, makeupDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Lý do ghi nhận
                </label>
                <textarea
                  value={exceptionData.reason}
                  onChange={(e) => setExceptionData({ ...exceptionData, reason: e.target.value })}
                  rows={2}
                  placeholder="Nhập lý do giảng viên bận công tác / lịch bù..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExceptionModalOpen(false)}
                  disabled={exceptionSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  isLoading={exceptionSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Xác nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default Schedules;
