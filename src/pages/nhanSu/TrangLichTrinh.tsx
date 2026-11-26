import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { DepartmentSelect } from '../../components/chung/ChonDonVi';
import { scheduleApi } from '../../api/lichTrinh.api';
import { holidayApi, HolidayItem } from '../../api/ngayNghiLe.api';
import { apiClient, extractArray } from '../../api/apiClient';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { hasRole, isSuperAdmin, canManageSubjects } from '../../utils/phanQuyen';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
import { ModalNgoaiLeLichTrinh } from './components/ModalNgoaiLeLichTrinh';
import { SearchInput } from '../../components/chung/OTimKiem';
import {
  buildSearchIndexEntry,
  matchesSearchEntry,
  parseSearchQuery,
  SearchIndexEntry,
} from '../../utils/timKiem';
import {
  ScheduleItem,
  ScheduleType,
  ScheduleExceptionStatus,
  ShiftItem,
  SubjectItem,
  UserProfile,
  DepartmentItem,
} from '../../types/index';

// =============================================================================
// TYPES & DATA STRUCTURES
// =============================================================================

export type { ScheduleType, ScheduleExceptionStatus };
export type ViewMode = 'matrix' | 'lecturer' | 'table' | 'calendar';

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

// Đã bỏ phân loại theo Học kỳ

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

function parseIsoDateOnly(val?: string | Date): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toSafeIsoDateOnly(val?: string | Date | null): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = parseIsoDateOnly(val);
  return d ? toIsoDateString(d) : '';
}

function sanitizeExcelCell(val: unknown): string | number {
  if (typeof val === 'number') return val;
  if (val === null || val === undefined) return '';
  const str = String(val);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function getScheduleLecturer(item: ScheduleItem, lecturers: UserProfile[] = []): any {
  if (item.giang_vien && typeof item.giang_vien === 'object') return item.giang_vien;
  if (item.nguoi_dung && typeof item.nguoi_dung === 'object') return item.nguoi_dung;
  if (item.nguoi_dung_id && typeof item.nguoi_dung_id === 'object') return item.nguoi_dung_id;
  if (typeof item.nguoi_dung_id === 'string') {
    return lecturers.find((l) => String(l.id) === String(item.nguoi_dung_id)) || null;
  }
  return null;
}

function getScheduleLecturerId(item: ScheduleItem): string {
  if (typeof item.nguoi_dung_id === 'string') return item.nguoi_dung_id;
  if (item.nguoi_dung_id && typeof item.nguoi_dung_id === 'object') return item.nguoi_dung_id.id || '';
  return item.giang_vien?.id || item.nguoi_dung?.id || '';
}

function getScheduleShift(item: ScheduleItem, shifts: ShiftItem[] = []): ShiftItem | null {
  if (item.ca && typeof item.ca === 'object') return item.ca;
  if (item.ca_id && typeof item.ca_id === 'object') return item.ca_id;
  if (typeof item.ca_id === 'string') {
    return shifts.find((s) => String(s.id) === String(item.ca_id)) || null;
  }
  return null;
}

function formatDayMonth(d?: string | Date): string {
  const dateObj = parseIsoDateOnly(d);
  if (!dateObj) return '--/--';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatDateFull(d?: string | Date): string {
  const dateObj = parseIsoDateOnly(d);
  if (!dateObj) return '--/--/----';
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
    if (subjectRaw.ten_mon) {
      target = subjectRaw;
    } else if (subjectRaw.id) {
      target = subjectList.find((s) => String(s.id) === String(subjectRaw.id));
    }
  } else if (typeof subjectRaw === 'string') {
    target = subjectList.find((s) => String(s.id) === String(subjectRaw));
  }

  if (!target) return null;
  const name = target.ten_mon || '';
  const code = target.ma_mon || '';
  const credits = target.so_tin_chi;

  if (!name && !code) return null;
  return { name, code, credits };
}

function toMinutesOfDay(hhmm?: string): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatSemesterLabel(semester?: number | null): string {
  if (Number(semester) === 3) return 'Học kỳ Hè';
  if (Number(semester) === 2) return 'Học kỳ 2';
  return 'Học kỳ 1';
}

function matchScheduleToShift(item: ScheduleItem, shift: ShiftItem): boolean {
  // 1. Direct ca_id match (Ưu tiên tuyệt đối nếu có ca_id / ca.id)
  const itemShiftId =
    typeof item.ca === 'object' && item.ca?.id
      ? item.ca.id
      : typeof item.ca_id === 'object'
      ? item.ca_id?.id
      : item.ca_id;
  const shiftIdVal = shift.id;
  if (itemShiftId && shiftIdVal) {
    return String(itemShiftId) === String(shiftIdVal);
  }

  // 2. So khớp khung giờ khi item không có ca_id
  const sStart = (item.gio_bat_dau || '07:00').slice(0, 5);
  const sEnd = (item.gio_ket_thuc || '11:30').slice(0, 5);
  const shiftStartTime = String((shift as any).gio_bat_dau || shift.gio_bat_dau || '').slice(0, 5);
  const shiftEndTime = String((shift as any).gio_ket_thuc || shift.gio_ket_thuc || '').slice(0, 5);

  if (sStart === shiftStartTime && sEnd === shiftEndTime) return true;
  if (shiftStartTime && shiftEndTime) {
    const aStart = toMinutesOfDay(sStart);
    const aEnd = toMinutesOfDay(sEnd);
    const bStart = toMinutesOfDay(shiftStartTime);
    const bEnd = toMinutesOfDay(shiftEndTime);
    if (bEnd > bStart && aStart >= bStart && aEnd <= bEnd) return true;
  }

  const shiftNameLower = (shift.ten_ca || '').toLowerCase();
  const startHour = parseInt(sStart.split(':')[0], 10) || 7;
  if (shiftNameLower.includes('hành chính') || shiftNameLower.includes('hanh chinh')) {
    return startHour === 8 && sEnd === '17:00';
  }
  if (shiftNameLower.includes('tối') || shiftNameLower.includes('toi')) {
    return startHour >= 17 || (item.tiet_bat_dau ? item.tiet_bat_dau >= 9 : false);
  }
  if (shiftNameLower.includes('chiều') || shiftNameLower.includes('chieu')) {
    return (startHour >= 12 && startHour < 17) || (item.tiet_bat_dau ? item.tiet_bat_dau >= 5 && item.tiet_bat_dau <= 8 : false);
  }
  if (shiftNameLower.includes('sáng') || shiftNameLower.includes('sang')) {
    return startHour < 12 || (item.tiet_bat_dau ? item.tiet_bat_dau <= 4 && startHour < 12 : false);
  }

  return false;
}

interface ScheduleActiveStatus {
  active: boolean;
  isException?: boolean;
  exceptionReason?: string;
  isMakeup?: boolean;
}

function isScheduleActiveOnDate(
  item: ScheduleItem,
  targetIsoDate: string,
  targetWeekday: number,
  holidayDatesSet?: Set<string>
): ScheduleActiveStatus {
  if (holidayDatesSet && holidayDatesSet.has(targetIsoDate)) {
    return { active: false, isException: true, exceptionReason: 'Ngày nghỉ lễ toàn trường' };
  }

  const exceptions = item.ngoai_le || [];

  // 1. Ngoại lệ dạy bù vào đúng ngày targetIsoDate
  const makeupExc = exceptions.find((e: any) => {
    if (e.trang_thai !== 'day_bu') return false;
    const mDate = e.ngay_day_bu || e.ngay;
    return mDate ? toSafeIsoDateOnly(mDate) === targetIsoDate : false;
  });
  if (makeupExc) {
    return { active: true, isMakeup: true, exceptionReason: makeupExc.ly_do || 'Dạy bù' };
  }

  // 2. Nếu là Lịch Dạy Bù (day_bu): hiển thị đúng vào ngày bù hoặc khoảng [startDate, endDate]
  const sType = item.loai_lich;
  if (sType === 'day_bu') {
    const makeupIso = toSafeIsoDateOnly(item.ngay_day_bu);
    if (makeupIso) {
      return makeupIso === targetIsoDate ? { active: true, isMakeup: true } : { active: false };
    }
    const startIsoOnly = toSafeIsoDateOnly(item.ngay_bat_dau);
    const endIsoOnly = toSafeIsoDateOnly(item.ngay_ket_thuc) || startIsoOnly;
    const itemWeekdayOnly = item.thu_trong_tuan ?? 1;
    if (startIsoOnly && targetIsoDate >= startIsoOnly && targetIsoDate <= endIsoOnly && itemWeekdayOnly === targetWeekday) {
      return { active: true, isMakeup: true };
    }
    return { active: false };
  }

  // 3. Kiểm tra ngoại lệ gốc vào ngày targetIsoDate (Nghỉ, Hủy, Dạy bù dời sang ngày khác, Đổi ca dời ngày)
  const exc = exceptions.find((e: any) => toSafeIsoDateOnly(e.ngay) === targetIsoDate);
  if (exc) {
    const excStatus = exc.trang_thai;
    const excMakeup = toSafeIsoDateOnly(exc.ngay_day_bu);
    if (excStatus === 'nghi' || excStatus === 'huy') {
      return { active: false, isException: true, exceptionReason: exc.ly_do || 'Báo nghỉ' };
    }
    if (excStatus === 'day_bu' && excMakeup && excMakeup !== targetIsoDate) {
      return { active: false, isException: true, exceptionReason: exc.ly_do || 'Đã dời sang ngày dạy bù' };
    }
    if (excStatus === 'doi_ca' && excMakeup && excMakeup !== targetIsoDate) {
      return { active: false, isException: true, exceptionReason: exc.ly_do || 'Đã đổi ca sang ngày khác' };
    }
  }

  // 4. Lịch Chính Khóa: Thứ trong tuần phải khớp
  const itemWeekday = item.thu_trong_tuan ?? 1;
  if (itemWeekday !== targetWeekday) {
    return { active: false };
  }

  // 5. Kiểm tra khoảng ngày hiệu lực [startDate, endDate]
  const startIso = toSafeIsoDateOnly(item.ngay_bat_dau);
  const endIso = toSafeIsoDateOnly(item.ngay_ket_thuc);

  if (startIso && targetIsoDate < startIso) {
    return { active: false };
  }
  if (endIso && targetIsoDate > endIso) {
    return { active: false };
  }

  return { active: true };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Schedules: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminOrDean = useMemo(() => canManageSubjects(user), [user]);

  // 1. View Mode: 'matrix' (Thời khóa biểu tuần) | 'lecturer' (Theo giảng viên) | 'table' (Dạng bảng) | 'calendar' (Lịch tháng)
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  // 2. Filters State: Ca, Ngành/Khoa, Giảng viên, Từ khóa tìm kiếm
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [selectedLecturerFilter, setSelectedLecturerFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 3. Width mode for matrix: 'fit' (vừa màn hình) vs 'scroll' (cuộn rộng)
  const [widthMode, setWidthMode] = useState<'fit' | 'scroll'>('fit');
  const matrixScrollRef = useRef<HTMLDivElement | null>(null);

  // 4. Day filter: 'all' (7 ngày) or specific weekday (1 to 6, 0 for Sunday)
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | number>('all');

  // Shift dropdown filter state
  const [isShiftFilterOpen, setIsShiftFilterOpen] = useState<boolean>(false);

  // Searchable department dropdown filter state
  const [isDepartmentFilterOpen, setIsDepartmentFilterOpen] = useState<boolean>(false);
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState<string>('');

  // Searchable lecturer dropdown filter state
  const [isLecturerFilterOpen, setIsLecturerFilterOpen] = useState<boolean>(false);
  const [lecturerSearchQuery, setLecturerSearchQuery] = useState<string>('');

  // Form Lecturer Search state
  const [isFormLecturerOpen, setIsFormLecturerOpen] = useState<boolean>(false);
  const [formLecturerSearch, setFormLecturerSearch] = useState<string>('');

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
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState<boolean>(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<{
    userId: string;
    shiftId: string;
    subjectId: string;
    roomId: string;
    co_so: string;
    weekday: number | '';
    startPeriod: number | '';
    periodCount: number | '';
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    isRecurring: boolean;
    scheduleType: ScheduleType;
    makeupDate: string;
    academicYear: string;
    semester: number | '';
    latitude: number;
    longitude: number;
    radiusMeters: number;
    la_truc_tuyen: boolean;
  }>({
    userId: '',
    shiftId: '',
    subjectId: '',
    roomId: '',
    co_so: '',
    weekday: '',
    startPeriod: '',
    periodCount: '',
    startTime: '',
    endTime: '',
    startDate: '',
    endDate: '',
    isRecurring: true,
    scheduleType: 'chinh_khoa' as ScheduleType,
    makeupDate: '',
    academicYear: '',
    semester: '',
    latitude: 20.9752,
    longitude: 105.7628,
    radiusMeters: 100,
    la_truc_tuyen: false,
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  // Exception Form State
  const [exceptionData, setExceptionData] = useState({
    date: toIsoDateString(new Date()),
    status: 'nghi' as ScheduleExceptionStatus,
    reason: '',
    makeupDate: '',
    substituteLecturerId: '',
    replacementShiftId: '',
  });
  const [exceptionSubmitting, setExceptionSubmitting] = useState<boolean>(false);

  // =============================================================================
  // DATA FETCHING (Tải toàn bộ lịch phân công không phụ thuộc học kỳ)
  // =============================================================================

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduleApi.getSchedules({ gioi_han: 1000 });
      const list = extractArray<ScheduleItem>(res);
      setSchedules(list);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      toast.error('Không thể tải danh sách thời khóa biểu');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const canFetchUsers = hasRole(user, ['admin', 'bgh', 'tccb', 'dao_tao', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon']);
      const [shiftsRes, subjectsRes, usersRes, deptsRes, holidaysList] = await Promise.all([
        scheduleApi.getShifts().catch(() => ({ data: [] })),
        scheduleApi.getSubjects().catch(() => ({ data: [] })),
        canFetchUsers ? scheduleApi.getUsers({ gioi_han: 500 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        apiClient.get('/phong-ban').catch(() => ({ data: [] })),
        holidayApi.getHolidays().catch(() => []),
      ]);

      const shiftList = extractArray<ShiftItem>(shiftsRes);
      if (shiftList.length > 0) setShifts(shiftList);

      const subjectList = extractArray<SubjectItem>(subjectsRes);
      if (subjectList.length > 0) setSubjects(subjectList);

      const userList = extractArray<UserProfile>(usersRes);
      if (userList.length > 0) {
        // Ẩn tài khoản Quản trị hệ thống (admin) và Ban Giám Hiệu (bgh) khỏi danh sách phân công lịch giảng dạy
        setLecturers(userList.filter((u) => !isSuperAdmin(u) && u.kich_hoat !== false));
      }

      const deptList = extractArray<DepartmentItem>(deptsRes);
      if (deptList.length > 0) setDepartments(deptList);

      if (Array.isArray(holidaysList)) setHolidays(holidaysList);
    } catch (err) {
      console.error('Error fetching meta:', err);
    }
  }, [user]);

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
      if (d.id) map.set(d.id, d.ten_phong_ban);
    });
    return map;
  }, [departments]);

  // Tập các ngày nghỉ lễ dạng YYYY-MM-DD để ẩn tiết dạy trên lịch tuần/tháng
  const holidayDatesSet = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((h) => {
      const start = parseIsoDateOnly(h.ngay_bat_dau);
      const end = parseIsoDateOnly(h.ngay_ket_thuc);
      if (!start || !end || start > end) return;
      const cur = new Date(start);
      let guard = 0;
      while (cur <= end && guard < 90) {
        set.add(toIsoDateString(cur));
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    });
    return set;
  }, [holidays]);

  // Kiểm tra 1 đơn vị có nằm trong cây đơn vị được chọn (hỗ trợ đa cấp Khoa -> Bộ môn -> Tổ)
  const isDepartmentInTargetTree = useCallback(
    (deptIdRaw: any, targetDeptId: string): boolean => {
      if (!deptIdRaw || !targetDeptId) return false;
      let curId: string | null = typeof deptIdRaw === 'object' ? deptIdRaw?.id || null : String(deptIdRaw);
      const visited = new Set<string>();
      while (curId && !visited.has(curId)) {
        if (curId === targetDeptId) return true;
        visited.add(curId);
        const dept = departments.find((d) => String(d.id) === curId);
        const rawParent = dept?.don_vi_cha_id;
        curId = rawParent
          ? typeof rawParent === 'object' && 'id' in rawParent
            ? String((rawParent as any).id)
            : String(rawParent)
          : null;
      }
      return false;
    },
    [departments]
  );

  // Helper to resolve user's department name
  const getUserDepartmentName = useCallback(
    (u?: any): string => {
      if (!u || typeof u === 'string') return 'Chưa phân đơn vị';
      if (u.ten_phong_ban) return u.ten_phong_ban;
      if (u.don_vi_chinh && typeof u.don_vi_chinh === 'object' && u.don_vi_chinh.ten_phong_ban) {
        return u.don_vi_chinh.ten_phong_ban;
      }
      if (u.don_vi_chinh_id) {
        if (typeof u.don_vi_chinh_id === 'object' && u.don_vi_chinh_id?.ten_phong_ban) {
          return u.don_vi_chinh_id.ten_phong_ban;
        }
        const deptId = typeof u.don_vi_chinh_id === 'string' ? u.don_vi_chinh_id : u.don_vi_chinh_id?.id;
        if (deptId && departmentMap.has(deptId)) {
          return departmentMap.get(deptId)!;
        }
      }
      return 'Chưa phân đơn vị';
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
    return [...shifts].sort((a, b) => orderRank(a.ten_ca || '') - orderRank(b.ten_ca || ''));
  }, [shifts]);

  // Filtered Shifts to display in the Matrix view
  const displayedShifts = useMemo(() => {
    if (!selectedShiftFilter || selectedShiftFilter === 'all') {
      return sortedShifts;
    }
    return sortedShifts.filter((s) => s.id === selectedShiftFilter);
  }, [sortedShifts, selectedShiftFilter]);

  // Cascaded Lecturers based on Department Filter
  const filteredLecturerOptions = useMemo(() => {
    if (!selectedDepartmentFilter || selectedDepartmentFilter === 'all') {
      return lecturers;
    }
    const targetDept = departments.find((d) => d.id === selectedDepartmentFilter);
    return lecturers.filter((lec) => {
      const deptId = typeof lec.don_vi_chinh_id === 'object' ? lec.don_vi_chinh_id?.id : lec.don_vi_chinh_id;
      const deptName = getUserDepartmentName(lec);
      if (isDepartmentInTargetTree(deptId, selectedDepartmentFilter)) return true;
      if (targetDept && deptName.toLowerCase() === targetDept.ten_phong_ban.toLowerCase()) return true;
      return false;
    });
  }, [lecturers, selectedDepartmentFilter, departments, getUserDepartmentName, isDepartmentInTargetTree]);

  // Reset Lecturer filter if current selected lecturer is not in the filtered department
  useEffect(() => {
    if (selectedDepartmentFilter !== 'all' && selectedLecturerFilter !== 'all') {
      const exists = filteredLecturerOptions.some((l) => l.id === selectedLecturerFilter);
      if (!exists) {
        setSelectedLecturerFilter('all');
      }
    }
  }, [selectedDepartmentFilter, selectedLecturerFilter, filteredLecturerOptions]);

  // =============================================================================
  // FILTERED SCHEDULES (Applied across all view modes)
  // =============================================================================

  // Pre-index O(1) tìm kiếm cho toàn bộ lịch trình (tính 1 lần khi dữ liệu đổi, không cấp phát rác khi gõ)
  const scheduleSearchIndex = useMemo(() => {
    const map = new Map<string, SearchIndexEntry>();
    schedules.forEach((item) => {
      const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
      const lec = getScheduleLecturer(item, lecturers);
      map.set(
        item.id,
        buildSearchIndexEntry([
          subInfo?.name,
          subInfo?.code,
          lec?.ho_ten,
          lec?.ma_can_bo,
          item.phong_hoc,
        ])
      );
    });
    return map;
  }, [schedules, subjects, lecturers]);

  const parsedSearchQuery = useMemo(() => parseSearchQuery(searchKeyword), [searchKeyword]);

  const filteredSchedules = useMemo(() => {
    const targetShift =
      selectedShiftFilter && selectedShiftFilter !== 'all'
        ? shifts.find((s) => s.id === selectedShiftFilter)
        : null;
    const targetDept =
      selectedDepartmentFilter && selectedDepartmentFilter !== 'all'
        ? departments.find((d) => d.id === selectedDepartmentFilter)
        : null;
    const targetDeptLower = targetDept ? targetDept.ten_phong_ban.toLowerCase() : '';

    return schedules.filter((item) => {
      // 1. Filter by Shift
      if (targetShift && !matchScheduleToShift(item, targetShift)) {
        return false;
      }

      // 2. Filter by Department / Ngành
      if (selectedDepartmentFilter && selectedDepartmentFilter !== 'all') {
        const lec = getScheduleLecturer(item, lecturers);
        if (!lec) return false;
        const deptId = typeof lec.don_vi_chinh_id === 'object' ? lec.don_vi_chinh_id?.id : lec.don_vi_chinh_id;
        const deptName = getUserDepartmentName(lec);
        const matchTree = isDepartmentInTargetTree(deptId, selectedDepartmentFilter);
        const matchName = targetDeptLower ? deptName.toLowerCase() === targetDeptLower : false;

        if (!matchTree && !matchName) return false;
      }

      // 3. Filter by Lecturer
      if (selectedLecturerFilter && selectedLecturerFilter !== 'all') {
        const uId = getScheduleLecturerId(item);
        if (uId !== selectedLecturerFilter) return false;
      }

      // 4. Keyword Search O(1) qua chỉ mục dựng sẵn (hỗ trợ cả có dấu & không dấu Tiếng Việt)
      if (parsedSearchQuery.accented) {
        if (!matchesSearchEntry(scheduleSearchIndex.get(item.id), parsedSearchQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [
    schedules,
    selectedShiftFilter,
    selectedDepartmentFilter,
    selectedLecturerFilter,
    parsedSearchQuery,
    scheduleSearchIndex,
    shifts,
    departments,
    lecturers,
    getUserDepartmentName,
    isDepartmentInTargetTree,
  ]);

  const scheduleStats = useMemo(() => {
    const total = filteredSchedules.length;
    const makeupCount = filteredSchedules.filter((s) => s.loai_lich === 'day_bu').length;
    const regularCount = total - makeupCount;
    const lecturerIds = new Set(
      filteredSchedules
        .map((s) => getScheduleLecturerId(s))
        .filter(Boolean)
    );
    const regularRate = total > 0 ? Math.round((regularCount / total) * 100) : 0;
    return {
      total,
      regularCount,
      makeupCount,
      lecturerCount: lecturerIds.size,
      regularRate,
    };
  }, [filteredSchedules]);

  const hasActiveFilters =
    (selectedShiftFilter && selectedShiftFilter !== 'all') ||
    (selectedDepartmentFilter && selectedDepartmentFilter !== 'all') ||
    (selectedLecturerFilter && selectedLecturerFilter !== 'all') ||
    Boolean(searchKeyword.trim());

  const handleResetFilters = () => {
    setSelectedShiftFilter('all');
    setSelectedDepartmentFilter('all');
    setSelectedLecturerFilter('all');
    setIsShiftFilterOpen(false);
    setIsDepartmentFilterOpen(false);
    setIsLecturerFilterOpen(false);
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

  // Đã bỏ handleSemesterYearChange

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
    if (!isAdminOrDean) return;
    setIsEditing(false);
    setSelectedSchedule(null);
    setConflictError(null);
    setFormValidationErrors([]);

    setIsFormLecturerOpen(false);
    setFormLecturerSearch('');

    setFormData({
      userId: initUserId || '',
      shiftId: initShift?.id || '',
      subjectId: '',
      roomId: '',
      co_so: '',
      weekday: initWeekday !== undefined ? initWeekday : '',
      startPeriod: '',
      periodCount: '',
      startTime: initShift?.gio_bat_dau || '',
      endTime: initShift?.gio_ket_thuc || '',
      startDate: '',
      endDate: '',
      isRecurring: true,
      scheduleType: 'chinh_khoa',
      makeupDate: '',
      academicYear: '',
      semester: '',
      latitude: 20.9752,
      longitude: 105.7628,
      radiusMeters: 100,
      la_truc_tuyen: false,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setSelectedSchedule(item);
    setConflictError(null);
    setFormValidationErrors([]);

    const uId = getScheduleLecturerId(item);
    const shId = getScheduleShift(item, shifts)?.id || (typeof item.ca_id === 'string' ? item.ca_id : item.ca_id?.id);
    const subId = item.mon_hoc?.id || (typeof item.mon_hoc_id === 'object' ? item.mon_hoc_id?.id : item.mon_hoc_id);

    const editStartDate = toSafeIsoDateOnly(item.ngay_bat_dau) || toIsoDateString(new Date());
    const editEndDate = toSafeIsoDateOnly(item.ngay_ket_thuc) || editStartDate;

    setFormData({
      userId: uId || user?.id || '',
      shiftId: shId || '',
      subjectId: subId || '',
      roomId: item.phong_hoc || '',
      co_so: item.co_so || '',
      weekday: item.thu_trong_tuan ?? 1,
      startPeriod: item.tiet_bat_dau || 1,
      periodCount: item.so_tiet || 4,
      startTime: item.gio_bat_dau || '07:00',
      endTime: item.gio_ket_thuc || '11:30',
      startDate: editStartDate,
      endDate: editEndDate,
      isRecurring: item.lap_lai_hang_tuan ?? true,
      scheduleType: (item.loai_lich || 'chinh_khoa') as ScheduleType,
      makeupDate: toSafeIsoDateOnly(item.ngay_day_bu),
      academicYear: item.nam_hoc || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      semester: item.hoc_ky || 1,
      latitude: item.vi_do ?? 20.9752,
      longitude: item.kinh_do ?? 105.7628,
      radiusMeters: item.ban_kinh_met ?? 100,
      la_truc_tuyen: item.la_truc_tuyen ?? false,
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
      date: toIsoDateString(new Date()),
      status: 'nghi',
      reason: '',
      makeupDate: '',
      substituteLecturerId: '',
      replacementShiftId: '',
    });
    setIsDetailModalOpen(false);
    setIsExceptionModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);
    setFormValidationErrors([]);

    const missingErrors: string[] = [];
    if (!formData.userId) missingErrors.push('Nhân sự / Giảng viên phụ trách');
    if (!formData.shiftId) missingErrors.push('Ca làm việc');
    if (formData.weekday === '' || formData.weekday === null || formData.weekday === undefined) {
      missingErrors.push('Thứ trong tuần');
    }
    if (!formData.roomId.trim()) missingErrors.push('Phòng học / Địa điểm');
    if (!formData.startTime) missingErrors.push('Giờ bắt đầu');
    if (!formData.endTime) missingErrors.push('Giờ kết thúc');
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      missingErrors.push('Giờ bắt đầu phải trước giờ kết thúc');
    }
    if (formData.startPeriod === '' || !Number.isInteger(Number(formData.startPeriod)) || Number(formData.startPeriod) < 1) {
      missingErrors.push('Tiết bắt đầu (số nguyên từ 1 trở lên)');
    }
    if (formData.periodCount === '' || !Number.isInteger(Number(formData.periodCount)) || Number(formData.periodCount) < 1) {
      missingErrors.push('Số tiết (số nguyên từ 1 trở lên)');
    }
    if (!String(formData.academicYear || '').trim()) missingErrors.push('Năm học');
    if (formData.semester === '' || ![1, 2, 3].includes(Number(formData.semester))) {
      missingErrors.push('Học kỳ');
    }
    if (formData.scheduleType === 'day_bu' && !formData.makeupDate) {
      missingErrors.push('Ngày dạy bù');
    }
    if (!formData.startDate) missingErrors.push('Hiệu lực từ ngày');
    if (!formData.endDate) missingErrors.push('Đến hết ngày');
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      missingErrors.push('Ngày bắt đầu không được lớn hơn ngày kết thúc');
    }

    if (missingErrors.length > 0) {
      setFormValidationErrors(missingErrors);
      toast.error(`Chưa điền đầy đủ thông tin bắt buộc: ${missingErrors[0]}`);
      return;
    }

    setFormSubmitting(true);
    try {
      const payload: any = {
        nguoi_dung_id: formData.userId,
        ca_id: formData.shiftId || undefined,
        mon_hoc_id: formData.subjectId || undefined,
        phong_hoc: formData.roomId.trim(),
        co_so: formData.co_so.trim(),
        thu_trong_tuan: Number(formData.weekday),
        tiet_bat_dau: Number(formData.startPeriod),
        so_tiet: Number(formData.periodCount),
        gio_bat_dau: formData.startTime,
        gio_ket_thuc: formData.endTime,
        ngay_bat_dau: formData.startDate,
        ngay_ket_thuc: formData.endDate,
        lap_lai_hang_tuan: formData.isRecurring,
        loai_lich: formData.scheduleType,
        ngay_day_bu: formData.makeupDate || undefined,
        nam_hoc: formData.academicYear,
        hoc_ky: Number(formData.semester),
        vi_do: Number(formData.latitude),
        kinh_do: Number(formData.longitude),
        ban_kinh_met: Number(formData.radiusMeters),
        la_truc_tuyen: Boolean(formData.la_truc_tuyen),
      };

      if (isEditing && selectedSchedule) {
        await scheduleApi.updateSchedule(selectedSchedule.id, payload);
        toast.success('Cập nhật lịch phân công thành công');
      } else {
        await scheduleApi.createSchedule(payload);
        toast.success('Tạo mới lịch phân công thành công');
      }

      setIsFormModalOpen(false);
      loadSchedules();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lưu lịch thất bại';
      const code = err.response?.data?.errorCode;
      if (
        err.response?.status === 409 ||
        code === 'SCHEDULE_LECTURER_CONFLICT' ||
        code === 'SCHEDULE_ROOM_CONFLICT' ||
        code === 'SCHEDULE_HOLIDAY_CONFLICT' ||
        code === 'SCHEDULE_002'
      ) {
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
      if (selectedSchedule?.id === id) {
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

    const statusLower = String(exceptionData.status).toLowerCase();
    if (
      statusLower === 'doi_ca' &&
      !exceptionData.substituteLecturerId &&
      !exceptionData.replacementShiftId &&
      !exceptionData.makeupDate
    ) {
      toast.error('Vui lòng chọn ít nhất Giảng viên dạy thay, Ca thay thế hoặc Ngày đổi ca.');
      return;
    }

    setExceptionSubmitting(true);
    try {
      await scheduleApi.addException(selectedSchedule.id, {
        ngay: exceptionData.date,
        trang_thai: exceptionData.status,
        ly_do:
          exceptionData.reason ||
          (statusLower === 'doi_ca'
            ? 'Đổi ca / phân công giảng viên dạy thay'
            : 'Báo nghỉ / bù từ giao diện lịch trình'),
        ngay_day_bu:
          statusLower === 'day_bu' || (statusLower === 'doi_ca' && exceptionData.makeupDate)
            ? exceptionData.makeupDate
            : undefined,
        giang_vien_day_thay_id:
          statusLower === 'doi_ca' && exceptionData.substituteLecturerId
            ? exceptionData.substituteLecturerId
            : null,
        ca_thay_the_id:
          statusLower === 'doi_ca' && exceptionData.replacementShiftId
            ? exceptionData.replacementShiftId
            : null,
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

  // =============================================================================
  // XUẤT THỜI KHÓA BIỂU RA FILE EXCEL (.XLSX)
  // =============================================================================
  const handleExportScheduleExcel = () => {
    if (!filteredSchedules.length) {
      toast.error('Không có dữ liệu thời khóa biểu để xuất file');
      return;
    }
    try {
      // 1. Sheet 1: Danh Sách Chi Tiết Phân Công
      const detailRows = filteredSchedules.map((item, idx) => {
        const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
        const lec = getScheduleLecturer(item, lecturers);
        const shiftObj = getScheduleShift(item, shifts);
        const shiftName = shiftObj?.ten_ca || 'Ca học';
        const wObj = WEEKDAYS.find((w) => w.value === item.thu_trong_tuan);

        return {
          'STT': idx + 1,
          'Thứ Trong Tuần': sanitizeExcelCell(wObj?.label || `Thứ ${item.thu_trong_tuan}`),
          'Ca Giảng Dạy': sanitizeExcelCell(shiftName),
          'Khung Giờ': sanitizeExcelCell(`${item.gio_bat_dau || ''} - ${item.gio_ket_thuc || ''}`),
          'Tiết Học': sanitizeExcelCell(`Tiết ${item.tiet_bat_dau || 1} - ${(item.tiet_bat_dau || 1) + (item.so_tiet || 4) - 1}`),
          'Môn Học': sanitizeExcelCell(subInfo?.name || 'Hành chính / Sinh hoạt'),
          'Mã Môn': sanitizeExcelCell(subInfo?.code || '--'),
          'Số Tín Chỉ': subInfo?.credits || 0,
          'Giảng Viên / Cán Bộ': sanitizeExcelCell(lec?.ho_ten || 'Chưa phân công'),
          'Mã Cán Bộ': sanitizeExcelCell(lec?.ma_can_bo || '--'),
          'Email': sanitizeExcelCell(lec?.email || '--'),
          'Khoa / Phòng Ban': sanitizeExcelCell(getUserDepartmentName(lec)),
          'Phòng Học': sanitizeExcelCell(item.phong_hoc || '--'),
          'Ngày Bắt Đầu': sanitizeExcelCell(formatDateFull(item.ngay_bat_dau)),
          'Ngày Kết Thúc': sanitizeExcelCell(formatDateFull(item.ngay_ket_thuc)),
          'Loại Lịch': item.loai_lich === 'day_bu' ? 'Dạy bù' : 'Chính khóa',
          'Ngày Bù (nếu có)': sanitizeExcelCell(item.ngay_day_bu ? formatDateFull(item.ngay_day_bu) : ''),
        };
      });

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 28 },
        { wch: 12 },
        { wch: 10 },
        { wch: 24 },
        { wch: 14 },
        { wch: 28 },
        { wch: 24 },
        { wch: 24 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
      ];

      // 2. Sheet 2: Ma Trận Thời Khóa Biểu Tuần Hiện Tại
      const matrixHeaders = ['Ca Giảng Dạy', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
      const matrixRows: any[][] = [];
      matrixRows.push(matrixHeaders);

      sortedShifts.forEach((sh) => {
        const row = [sanitizeExcelCell(sh.ten_ca)];
        weekDaysList.forEach((day) => {
          const cellSchedules = filteredSchedules.filter((item) => {
            const { active } = isScheduleActiveOnDate(item, day.isoDate, day.weekday, holidayDatesSet);
            if (!active) return false;
            return matchScheduleToShift(item, sh);
          });

          if (cellSchedules.length === 0) {
            row.push('-');
          } else {
            const desc = cellSchedules.map((item) => {
              const sub = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
              const lec = getScheduleLecturer(item, lecturers);
              return `${sub?.name || 'Lớp học'} (${lec?.ho_ten || 'GV'}) [${item.phong_hoc || 'Phòng'}]`;
            }).join('\n---\n');
            row.push(sanitizeExcelCell(desc));
          }
        });
        matrixRows.push(row);
      });

      const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
      wsMatrix['!cols'] = [
        { wch: 22 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi Tiết Phân Công');
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Ma Trận TKB Tuần');

      XLSX.writeFile(wb, `Thoi_Khoa_Bieu_${toIsoDateString(new Date())}.xlsx`);
      toast.success('Đã xuất Thời khóa biểu (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Thời khóa biểu:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
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

  const renderMatrixView = () => {
    const isSingleDay = displayedDays.length === 1;
    const isHorizontalScroll = !isSingleDay && widthMode === 'scroll';

    return (
      <div className="w-full">
        {isHorizontalScroll && (
          <div className="px-3.5 py-1.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Chế độ cuộn rộng (7 ngày) — Kéo thanh trượt bên dưới hoặc bấm mũi tên để xem các ngày bên phải</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => matrixScrollRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:text-brand-600 text-slate-600 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
                title="Cuộn sang trái"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trái</span>
              </button>
              <button
                type="button"
                onClick={() => matrixScrollRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:text-brand-600 text-slate-600 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
                title="Cuộn sang phải"
              >
                <span>Phải</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <div
          ref={matrixScrollRef}
          className={`w-full ${isHorizontalScroll ? 'overflow-x-scroll' : 'overflow-x-auto'} custom-scrollbar pb-1`}
        >
          <table
            className={`w-full border-collapse text-left table-fixed ${
              isHorizontalScroll ? 'min-w-[1620px]' : ''
            }`}
          >
          {/* Table Header: CA GIẢNG DẠY + 7 Days (hoặc 1 ngày chi tiết) */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {/* Column 1: Header CA GIẢNG DẠY */}
              <th
                className={`w-[180px] p-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 ${
                  isHorizontalScroll ? 'sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)]' : ''
                }`}
              >
                CA GIẢNG DẠY
              </th>

              {/* Day Headers */}
              {displayedDays.map((day) => {
                const dayScheduleCount = isSingleDay
                  ? filteredSchedules.filter((item) =>
                      isScheduleActiveOnDate(item, day.isoDate, day.weekday, holidayDatesSet).active
                    ).length
                  : 0;

                return (
                  <th
                    key={day.isoDate}
                    className={`p-2 border-r border-slate-200/80 dark:border-slate-800 last:border-r-0 ${
                      isSingleDay ? 'text-left px-4' : 'text-center'
                    }`}
                  >
                    {isSingleDay ? (
                      <div
                        className={`rounded-xl py-2 px-3.5 flex items-center justify-between gap-3 ${
                          day.isToday
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700'
                            : 'bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`text-xs font-extrabold uppercase tracking-wider ${
                              day.isToday
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {day.label}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                            {day.dayNumber}/{day.monthNumber}/{day.isoDate.slice(0, 4)}
                          </span>
                          {day.isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white uppercase tracking-wider">
                              HÔM NAY
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          {dayScheduleCount} buổi học
                        </span>
                      </div>
                    ) : day.isToday ? (
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
                const cardStyle = getCardStyle(shift.ten_ca || '');

                return (
                  <tr key={shift.id} className="divide-x divide-slate-200/80 dark:divide-slate-800">
                    {/* Left Cell: Shift Info */}
                    <td
                      className={`p-3.5 bg-slate-50 dark:bg-slate-900 align-top ${
                        isHorizontalScroll ? 'sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)]' : ''
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {shift.ten_ca}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 font-mono">
                        <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span>{shift.gio_bat_dau} - {shift.gio_ket_thuc}</span>
                      </div>
                      <div className="mt-2">
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                          Trễ {shift.nguong_di_muon_phut || 15}p
                        </span>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {displayedDays.map((day) => {
                      // Filtered schedules for this day of week and this shift
                      const cellSchedules = filteredSchedules.filter((item) => {
                        const { active } = isScheduleActiveOnDate(item, day.isoDate, day.weekday, holidayDatesSet);
                        if (!active) return false;
                        return matchScheduleToShift(item, shift);
                      });

                      return (
                        <td
                          key={day.isoDate}
                          className={`${isSingleDay ? 'p-3.5' : 'p-2.5'} align-top min-h-[140px] transition-colors ${
                            day.isToday ? 'bg-blue-50/15 dark:bg-blue-950/10' : ''
                          }`}
                        >
                          {cellSchedules.length === 0 ? (
                            /* Empty Cell: Chỉ cấp quản lý mới có nút Thêm lịch khi rê chuột/click */
                            <div
                              onClick={isAdminOrDean ? () => openCreateModal(day.weekday, shift) : undefined}
                              title={isAdminOrDean ? `Thêm lịch vào ${day.label} (${shift.ten_ca})` : undefined}
                              className={`h-full ${
                                isSingleDay ? 'min-h-[72px] flex-row gap-3 px-4' : 'min-h-[110px] flex-col p-2'
                              } flex items-center justify-center text-center rounded-xl ${
                                isAdminOrDean
                                  ? 'hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer group/empty'
                                  : ''
                              } transition-all`}
                            >
                              <span className={`text-xs font-medium text-slate-400 ${isAdminOrDean ? 'group-hover/empty:hidden' : ''}`}>
                                {isSingleDay ? 'Chưa có lịch giảng dạy trong ca này' : 'Trống'}
                              </span>
                              {isAdminOrDean && (
                                <div className="hidden group-hover/empty:flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 py-1 px-3 rounded-lg shadow-2xs">
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isSingleDay ? 'Thêm lịch vào ca này' : '+ Thêm'}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Occupied Cell: Grid 2-3 cột gọn đẹp khi xem 1 ngày, Stacked Cards khi xem 7 ngày */
                            <div className={isSingleDay ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch' : 'space-y-2'}>
                              {cellSchedules.map((item) => {
                                const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
                                const subName = subInfo?.name;
                                const subCode = subInfo?.code;
                                const lec = getScheduleLecturer(item, lecturers);
                                const teacherName = lec?.ho_ten || 'Chưa phân công';
                                const deptName = getUserDepartmentName(lec);
                                const roomName = item.phong_hoc || 'Phòng học';
                                const dateStatus = isScheduleActiveOnDate(item, day.isoDate, day.weekday, holidayDatesSet);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={(e) => openDetailModal(item, e)}
                                    className={`rounded-2xl p-2.5 border transition-all text-xs cursor-pointer shadow-2xs hover:shadow-md relative group/card ${
                                      dateStatus.isException
                                        ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800 opacity-80'
                                        : cardStyle.bg
                                    } ${cardStyle.hoverBorder}`}
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
                                          onClick={(e) => handleDeleteSchedule(item.id, e)}
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
                                        {item.gio_bat_dau} - {item.gio_ket_thuc}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {Array.isArray(item.ngoai_le) && item.ngoai_le.length > 0 && (
                                          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-bold">
                                            {item.ngoai_le.length} NL
                                          </span>
                                        )}
                                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold whitespace-nowrap shrink-0 ${cardStyle.badgeColor}`}>
                                          {item.loai_lich === 'day_bu'
                                            ? 'Dạy bù'
                                            : item.lap_lai_hang_tuan === false
                                              ? '1 buổi'
                                              : 'Chính khóa'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Bottom Cell Action: "+ Thêm" Button */}
                              {isAdminOrDean && (
                                <button
                                  type="button"
                                  onClick={() => openCreateModal(day.weekday, shift)}
                                  className={
                                    isSingleDay
                                      ? 'min-h-[118px] p-3 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer'
                                      : 'w-full py-1 px-2 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-2xs mt-1.5 cursor-pointer'
                                  }
                                >
                                  <Plus className={isSingleDay ? 'w-4 h-4' : 'w-3 h-3'} />
                                  <span>{isSingleDay ? 'Thêm lịch vào ca này' : 'Thêm'}</span>
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
  };

  // =============================================================================
  // SUB-RENDERER 2: LECTURER VIEW (THEO GIẢNG VIÊN / PHÂN CÔNG CÁN BỘ)
  // =============================================================================

  const renderLecturerView = () => {
    // Only show lecturers matching department filter or keyword, or having scheduled items
    const relevantLecturers = filteredLecturerOptions.filter((lec) => {
      if (selectedLecturerFilter !== 'all' && lec.id !== selectedLecturerFilter) return false;
      return true;
    });

    return (
      <div className="p-4 space-y-4">
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
                return getScheduleLecturerId(item) === lec.id;
              });

              const deptName = getUserDepartmentName(lec);
              const initials = (lec.ho_ten || 'GV')
                .split(' ')
                .map((n) => n[0])
                .slice(-2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={lec.id}
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
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{lec.ho_ten}</h3>
                          {lec.ma_can_bo && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {lec.ma_can_bo}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {lec.vai_tro_chinh || 'Giảng viên'}
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
                          onClick={() => openCreateModal(1, undefined, lec.id)}
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
                        const { active } = isScheduleActiveOnDate(item, day.isoDate, day.weekday, holidayDatesSet);
                        return active;
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
                                const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
                                const subName = subInfo?.name || 'Phân công công tác';
                                const roomName = item.phong_hoc || 'Phòng học';
                                const sh = getScheduleShift(item, shifts);
                                const shName = sh?.ten_ca || 'Ca học';
                                const cardStyle = getCardStyle(shName);

                                return (
                                  <div
                                    key={item.id}
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
                                      <span>{item.gio_bat_dau} - {item.gio_ket_thuc}</span>
                                      <span className="font-sans font-bold text-blue-600 truncate">
                                        {shName}
                                        {Array.isArray(item.ngoai_le) && item.ngoai_le.length > 0 ? ` • ${item.ngoai_le.length} NL` : ''}
                                      </span>
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
                              onClick={() => openCreateModal(day.weekday, undefined, lec.id)}
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
    <div className="w-full overflow-hidden">
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
                const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
                const lec = getScheduleLecturer(item, lecturers);
                const sh = getScheduleShift(item, shifts);
                const teacherName = lec?.ho_ten || 'Chưa phân công';
                const deptName = getUserDepartmentName(lec);
                const roomName = item.phong_hoc || 'Phòng học';
                const subName = subInfo?.name || 'Phân công công tác chung';
                const subCode = subInfo?.code;
                const shiftName = sh?.ten_ca || 'Ca học tiêu chuẩn';
                const weekdayObj = WEEKDAYS.find((w) => w.value === (item.thu_trong_tuan));

                return (
                  <tr
                    key={item.id}
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
                      {lec?.ma_can_bo && (
                        <div className="text-[10px] font-mono text-slate-400">{lec.ma_can_bo}</div>
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
                        {item.gio_bat_dau} - {item.gio_ket_thuc}
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
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.loai_lich === 'day_bu'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          }`}
                        >
                          {item.loai_lich === 'day_bu' ? 'Dạy bù' : 'Chính khóa'}
                        </span>
                        {Array.isArray(item.ngoai_le) && item.ngoai_le.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {item.ngoai_le.length} ngoại lệ
                          </span>
                        )}
                      </div>
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
                            onClick={(e) => handleDeleteSchedule(item.id, e)}
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
      <ThanhPhanTrang
        currentPage={tablePage}
        totalPages={totalPages}
        totalItems={filteredSchedules.length}
        pageSize={tablePageSize}
        pageSizeOptions={[10, 25, 50]}
        itemLabel="lịch phân công"
        onPageChange={setTablePage}
        onPageSizeChange={(newSize) => {
          setTablePageSize(newSize);
          setTablePage(1);
        }}
      />
    </div>
  );

  // =============================================================================
  // SUB-RENDERER 4: CALENDAR VIEW (LỊCH THÁNG TRỰC QUAN)
  // =============================================================================

  const renderCalendarView = () => (
    <div className="p-4 space-y-3">
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
            const { active } = isScheduleActiveOnDate(item, cd.isoDate, cd.weekday, holidayDatesSet);
            return active;
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
                  const subInfo = resolveSubject(item.mon_hoc || item.mon_hoc_id, subjects);
                  const sh = getScheduleShift(item, shifts);
                  const shName = sh?.ten_ca || 'Ca';
                  const cardStyle = getCardStyle(shName);

                  return (
                    <div
                      key={item.id}
                      onClick={() => openDetailModal(item)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate cursor-pointer transition-transform hover:scale-[1.02] ${cardStyle.bg} ${cardStyle.hoverBorder}`}
                      title={`${subInfo?.name || 'Lịch'} (${item.gio_bat_dau} - ${item.gio_ket_thuc})`}
                    >
                      <span className="font-mono">{item.gio_bat_dau}</span> {subInfo?.name || 'Công tác'}
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
    <div className="space-y-4 font-sans pb-12 select-none">
      {/* =========================================================================
          PAGE HEADER + ACTIONS
         ========================================================================= */}
      <PageHeader
        title="Lịch Giảng Dạy & Thời Khóa Biểu"
        subtitle="Thời khóa biểu học kỳ, phân bổ phòng học và giảng viên phụ trách."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportScheduleExcel}
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất Thời Khóa Biểu ra file Excel (.xlsx)"
            >
              Xuất Excel
            </Button>

            {isAdminOrDean && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => openCreateModal()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Thêm lịch
              </Button>
            )}
          </div>
        }
      />

      {/* =========================================================================
          KPI SUMMARY CARDS
         ========================================================================= */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng lịch giảng dạy',
            value: scheduleStats.total,
            unit: 'lịch',
            subtext: hasActiveFilters ? 'Theo bộ lọc hiện tại' : 'Toàn học kỳ',
            tone: 'neutral',
          },
          {
            label: 'Lịch chính khóa',
            value: scheduleStats.regularCount,
            badge: `${scheduleStats.regularRate}%`,
            progress: scheduleStats.regularRate,
            tone: 'brand',
          },
          {
            label: 'Lịch dạy bù',
            value: scheduleStats.makeupCount,
            unit: 'buổi',
            subtext: 'Bù lịch nghỉ / đổi ca',
            tone: 'warning',
          },
          {
            label: 'Giảng viên phụ trách',
            value: scheduleStats.lecturerCount,
            unit: 'GV',
            subtext: 'Đang có lịch phân công',
            tone: 'success',
          },
        ]}
      />

      {/* =========================================================================
          UNIFIED SCHEDULE WORKSPACE CARD (TABS + FILTERS + WEEK/DAY NAV + VIEW)
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Hàng 1: Chế độ xem + Điều hướng tuần + Độ rộng */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>TKB tuần</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('lecturer')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'lecturer'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Theo giảng viên</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Dạng bảng</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Lịch tháng</span>
            </button>
          </div>

          {(viewMode === 'matrix' || viewMode === 'lecturer') && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevWeek}
                  title="Tuần trước"
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="h-8 flex items-center gap-1.5 px-3 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    Tuần: {formatDayMonth(weekDaysList[0].date)}/{weekDaysList[0].date.getFullYear()} - {formatDayMonth(weekDaysList[6].date)}/{weekDaysList[6].date.getFullYear()}
                  </span>
                  <label title="Chọn ngày để chuyển tuần" className="cursor-pointer ml-0.5 flex items-center text-brand-600 dark:text-brand-400 hover:text-brand-700">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <input
                      type="date"
                      value={toIsoDateString(weekRefDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setWeekRefDate(new Date(e.target.value));
                        }
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleNextWeek}
                  title="Tuần sau"
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleTodayWeek}
                  className="h-8 px-2.5 rounded-full text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer"
                >
                  Tuần này
                </button>
              </div>

              {viewMode === 'matrix' && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-full border border-slate-200/70 dark:border-slate-700/70">
                  <button
                    type="button"
                    onClick={() => setWidthMode('fit')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      widthMode === 'fit'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Vừa màn hình</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWidthMode('scroll');
                      if (selectedDayFilter !== 'all') {
                        setSelectedDayFilter('all');
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      widthMode === 'scroll'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Cuộn rộng</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hàng 2: Thanh lọc Ca, Khoa, Giảng viên, Từ khóa */}
        <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Filter Icon & Label */}
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 pl-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold">Lọc theo:</span>
          </div>

          {/* Filter 1: LỌC THEO CA (Custom Dropdown) */}
          <div className="relative">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setIsShiftFilterOpen((prev) => !prev);
                  setIsDepartmentFilterOpen(false);
                  setIsLecturerFilterOpen(false);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <span>
                  {selectedShiftFilter === 'all'
                    ? 'Tất cả các ca'
                    : (() => {
                        const sel = sortedShifts.find((s) => s.id === selectedShiftFilter);
                        return sel ? `${sel.ten_ca} (${sel.gio_bat_dau} - ${sel.gio_ket_thuc})` : 'Ca đã chọn';
                      })()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {selectedShiftFilter !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShiftFilter('all');
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  title="Bỏ chọn ca"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Shift Dropdown Popup */}
            {isShiftFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsShiftFilterOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-40 p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShiftFilter('all');
                      setIsShiftFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      selectedShiftFilter === 'all'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>Tất cả các ca ({sortedShifts.length} ca)</span>
                    {selectedShiftFilter === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>

                  {sortedShifts.map((s) => {
                    const isSelected = selectedShiftFilter === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedShiftFilter(s.id || 'all');
                          setIsShiftFilterOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{s.ten_ca}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {s.gio_bat_dau} - {s.gio_ket_thuc}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Filter 2: LỌC THEO KHOA / BỘ MÔN (DepartmentSelect Phân Cấp) */}
          <div className="min-w-[200px] max-w-[260px]">
            <DepartmentSelect
              departments={departments}
              value={selectedDepartmentFilter === 'all' ? '' : selectedDepartmentFilter}
              onChange={(val) => {
                setSelectedDepartmentFilter(val || 'all');
                setSelectedLecturerFilter('all');
              }}
              allowAll={true}
              allLabel="Tất cả khoa / ban"
              placeholder="Chọn đơn vị trực thuộc"
              size="sm"
            />
          </div>

          {/* Filter 3: LỌC THEO GIẢNG VIÊN (Searchable Combobox) */}
          <div className="relative">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 text-xs">
              <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setIsLecturerFilterOpen((prev) => !prev);
                  setIsShiftFilterOpen(false);
                  setIsDepartmentFilterOpen(false);
                  setLecturerSearchQuery('');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <span>
                  {selectedLecturerFilter === 'all'
                    ? 'Tất cả giảng viên'
                    : (() => {
                        const sel = lecturers.find((l) => l.id === selectedLecturerFilter);
                        return sel ? `${sel.ho_ten} (${sel.ma_can_bo || 'GV'})` : 'Giảng viên đã chọn';
                      })()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {selectedLecturerFilter !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLecturerFilter('all');
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  title="Bỏ chọn giảng viên"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Dropdown Popup */}
            {isLecturerFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsLecturerFilterOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-40 p-2 space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={lecturerSearchQuery}
                      onChange={(e) => setLecturerSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên hoặc mã GV..."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLecturerFilter('all');
                        setIsLecturerFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                        selectedLecturerFilter === 'all'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>Tất cả giảng viên</span>
                      {selectedLecturerFilter === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>

                    {filteredLecturerOptions
                      .filter((lec) => {
                        if (!lecturerSearchQuery.trim()) return true;
                        const q = lecturerSearchQuery.toLowerCase();
                        const name = (lec.ho_ten || '').toLowerCase();
                        const code = (lec.ma_can_bo || '').toLowerCase();
                        return name.includes(q) || code.includes(q);
                      })
                      .map((lec) => {
                        const isSelected = selectedLecturerFilter === lec.id;
                        return (
                          <button
                            key={lec.id}
                            type="button"
                            onClick={() => {
                              setSelectedLecturerFilter(lec.id);
                              setIsLecturerFilterOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {lec.ho_ten}
                              </span>
                              {lec.ma_can_bo && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                                  {lec.ma_can_bo}
                                </span>
                              )}
                              <div className="text-[10px] text-slate-400 truncate">
                                {getUserDepartmentName(lec)}
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filter 4: TÌM KIẾM TỪ KHÓA (Môn học, Giảng viên, Phòng) */}
          <SearchInput
            value={searchKeyword}
            onChange={(next) => {
              setSearchKeyword(next);
              setTablePage(1);
            }}
            debounceMs={180}
            placeholder="Tìm môn học, phòng, cán bộ..."
            className="relative min-w-[200px] flex-1 max-w-xs"
          />

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
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 pr-1">
          Hiển thị <strong className="text-brand-600 dark:text-brand-400">{filteredSchedules.length}</strong> / {schedules.length} phân công
        </div>
      </div>

      {/* Hàng 3 (nếu cần): Xem nhanh theo ngày */}
      {(viewMode === 'matrix' || viewMode === 'lecturer') && (
        <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
            Xem ngày:
          </span>

          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedDayFilter === 'all'
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
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
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <span>{day.shortLabel}</span>
                <span className="opacity-80">({day.dayNumber}/{day.monthNumber})</span>
                {day.isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-600'} animate-pulse`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MAIN CONTENT AREA ACCORDING TO VIEW MODE
         ========================================================================= */}
      {viewMode === 'matrix' && renderMatrixView()}
      {viewMode === 'lecturer' && renderLecturerView()}
      {viewMode === 'table' && renderTableView()}
      {viewMode === 'calendar' && renderCalendarView()}
      </div>

      {/* =========================================================================
          MODAL 1: CREATE / EDIT SCHEDULE FORM
         ========================================================================= */}
      {isFormModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
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
            <form noValidate onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formValidationErrors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Vui lòng kiểm tra và điền đầy đủ thông tin bắt buộc:</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {formValidationErrors.map((errMsg, idx) => (
                        <li key={idx}>{errMsg}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {conflictError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Xung đột lịch học:</strong> {conflictError}
                  </div>
                </div>
              )}

              {/* Nhân sự / Giảng viên phụ trách (Searchable Combobox) */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nhân sự / Giảng viên phụ trách <span className="text-rose-500">*</span>
                </label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormLecturerOpen((prev) => !prev);
                      setFormLecturerSearch('');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex items-center justify-between text-left focus:ring-2 focus:ring-blue-500/20"
                  >
                    <span>
                      {(() => {
                        const sel = lecturers.find((l) => l.id === formData.userId);
                        return sel
                          ? `${sel.ho_ten} (${sel.ma_can_bo || 'N/A'}) - ${getUserDepartmentName(sel)}`
                          : '-- Chọn nhân sự / giảng viên --';
                      })()}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {isFormLecturerOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsFormLecturerOpen(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-40 p-2 space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={formLecturerSearch}
                            onChange={(e) => setFormLecturerSearch(e.target.value)}
                            placeholder="Nhập tên hoặc mã giảng viên..."
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                          {lecturers
                            .filter((lec) => {
                              if (isSuperAdmin(lec) || lec.kich_hoat === false) return false;
                              if (!formLecturerSearch.trim()) return true;
                              const q = formLecturerSearch.toLowerCase();
                              return (
                                (lec.ho_ten || '').toLowerCase().includes(q) ||
                                (lec.ma_can_bo || '').toLowerCase().includes(q)
                              );
                            })
                            .map((lec) => {
                              const isSelected = formData.userId === lec.id;
                              return (
                                <button
                                  key={lec.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, userId: lec.id });
                                    setIsFormLecturerOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {lec.ho_ten}
                                      {lec.ma_can_bo && (
                                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                                          {lec.ma_can_bo}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {getUserDepartmentName(lec)} {lec.email ? `• ${lec.email}` : ''}
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                      const sh = shifts.find((s) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        shiftId: e.target.value,
                        startTime: sh?.gio_bat_dau || formData.startTime,
                        endTime: sh?.gio_ket_thuc || formData.endTime,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chọn ca làm việc --</option>
                    {sortedShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ten_ca} ({s.gio_bat_dau} - {s.gio_ket_thuc})
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weekday: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chọn thứ trong tuần --</option>
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
                    Cơ sở (dùng để gom ca liền nhau khi chấm công)
                  </label>
                  <input
                    type="text"
                    value={formData.co_so}
                    onChange={(e) => setFormData({ ...formData, co_so: e.target.value })}
                    placeholder="Ví dụ: Gia Lâm, Láng (để trống nếu chỉ có một cơ sở)"
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
                      const sName = sub.ten_mon || 'Môn học';
                      const sCode = sub.ma_mon;
                      const sCredits = sub.so_tin_chi || 3;
                      return (
                        <option key={sub.id} value={sub.id}>
                          {sCode ? `[${sCode}] ` : ''}{sName} ({sCredits} TC)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* A2: Cờ lịch trực tuyến */}
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="la_truc_tuyen_cb"
                  checked={Boolean(formData.la_truc_tuyen)}
                  onChange={(e) => setFormData({ ...formData, la_truc_tuyen: e.target.checked })}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <label htmlFor="la_truc_tuyen_cb" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Lịch dạy trực tuyến (online) – bỏ qua kiểm tra GPS khi chấm công
                </label>
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

              {/* Giờ bắt đầu, Kết thúc & Tiết học */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Giờ kết thúc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tiết bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="VD: 1"
                    value={formData.startPeriod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startPeriod: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Số tiết <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    placeholder="VD: 3"
                    value={formData.periodCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        periodCount: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
              {formData.startPeriod !== '' && formData.periodCount !== '' && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">
                  {(() => {
                    const sMin = toMinutesOfDay(formData.startTime);
                    const eMin = toMinutesOfDay(formData.endTime);
                    const mins = formData.startTime && formData.endTime && eMin > sMin ? eMin - sMin : 0;
                    const endPeriod = Number(formData.startPeriod) + Number(formData.periodCount) - 1;
                    return `Khung tiết: Tiết ${formData.startPeriod} – ${endPeriod} (${formData.periodCount} tiết)${mins > 0 ? ` • Thời lượng ca: ${mins} phút` : ''}`;
                  })()}
                </div>
              )}

              {/* Năm học & Học kỳ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Năm học <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    placeholder="VD: 2026-2027"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Học kỳ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        semester: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chọn học kỳ --</option>
                    <option value={1}>Học kỳ 1</option>
                    <option value={2}>Học kỳ 2</option>
                    <option value={3}>Học kỳ Hè</option>
                  </select>
                </div>
              </div>

              {/* Loại lịch & Ngày dạy bù (nếu có) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Loại phân công <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.scheduleType}
                    onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as ScheduleType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="chinh_khoa">Lịch chính khóa (Hàng tuần)</option>
                    <option value="day_bu">Lịch dạy bù (Một ngày cụ thể)</option>
                  </select>
                </div>

                {formData.scheduleType === 'day_bu' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Ngày dạy bù <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.makeupDate}
                      onChange={(e) => {
                        const mDate = e.target.value;
                        const d = new Date(mDate);
                        const wd = !isNaN(d.getTime()) ? d.getDay() : formData.weekday;
                        setFormData({
                          ...formData,
                          makeupDate: mDate,
                          weekday: wd,
                          startDate: mDate,
                          endDate: mDate,
                        });
                      }}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                ) : (
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Lặp lại hàng tuần theo thứ đã chọn</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Hiệu lực ngày */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hiệu lực từ ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Đến hết ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditing ? 'Lưu Thay Đổi' : 'Tạo Phân Công'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}

    {/* =========================================================================
        MODAL 2: SCHEDULE DETAIL MODAL
       ========================================================================= */}
    {isDetailModalOpen && selectedSchedule && (() => {
      const subInfo = resolveSubject(selectedSchedule.mon_hoc || selectedSchedule.mon_hoc_id, subjects);
      const lec = getScheduleLecturer(selectedSchedule, lecturers);
      const sh = getScheduleShift(selectedSchedule, shifts);
      const wObj = WEEKDAYS.find((w) => w.value === (selectedSchedule.thu_trong_tuan ?? 1)) || WEEKDAYS[0];

      const startP = selectedSchedule.tiet_bat_dau || 1;
      const countP = selectedSchedule.so_tiet || 4;
      const endP = startP + countP - 1;

      const startDate = selectedSchedule.ngay_bat_dau;
      const endDate = selectedSchedule.ngay_ket_thuc;
      const isMakeup = selectedSchedule.loai_lich === 'day_bu';
      const makeupDate = selectedSchedule.ngay_day_bu;
      const isRecurring = selectedSchedule.lap_lai_hang_tuan ?? true;
      const exceptions = selectedSchedule.ngoai_le || [];

      return (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
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
                        {sh.ten_ca} ({sh.gio_bat_dau} - {sh.gio_ket_thuc})
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                {/* Giảng viên & Khung giờ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Cán bộ / Giảng viên</span>
                    </div>
                    <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Họ và tên:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{lec?.ho_ten || 'Chưa phân công'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mã cán bộ:</span>
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{lec?.ma_can_bo || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Khoa / Phòng:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{getUserDepartmentName(lec)}</span>
                      </div>
                      {lec?.email && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">{lec.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Thời gian & Ca học</span>
                    </div>
                    <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Khung giờ:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {selectedSchedule.gio_bat_dau} - {selectedSchedule.gio_ket_thuc}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tiết học:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Tiết {startP} - {endP} ({countP} tiết)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ca phân công:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{sh?.ten_ca || 'Theo khung giờ'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phòng học & Địa điểm GPS */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Địa điểm & Phòng học</span>
                  </div>
                  <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phòng học:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedSchedule.phong_hoc || 'Chưa xếp phòng'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tín chỉ:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{subInfo?.credits ? `${subInfo.credits} Tín chỉ` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tọa độ GPS Geofence:</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {selectedSchedule.vi_do ?? 20.9752}, {selectedSchedule.kinh_do ?? 105.7628} (R: {selectedSchedule.ban_kinh_met ?? 100}m)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối Thời gian áp dụng & Chu kỳ */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Kế hoạch Giảng dạy & Hiệu lực</span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                      {isRecurring ? 'Lặp lại hàng tuần' : 'Một lần'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 text-xs">
                    <div>
                      <span className="text-slate-400">Hiệu lực từ ngày: </span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatDateFull(startDate)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Đến hết ngày: </span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatDateFull(endDate)}</strong>
                    </div>
                    {(selectedSchedule.nam_hoc || selectedSchedule.hoc_ky) && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">Năm học / Học kỳ: </span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {selectedSchedule.nam_hoc || '—'}{selectedSchedule.hoc_ky ? ` • ${formatSemesterLabel(selectedSchedule.hoc_ky)}` : ''}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Ngày tạo: </span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        {selectedSchedule.tao_luc ? new Date(selectedSchedule.tao_luc).toLocaleString('vi-VN') : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Cập nhật gần nhất: </span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        {selectedSchedule.cap_nhat_luc ? new Date(selectedSchedule.cap_nhat_luc).toLocaleString('vi-VN') : '—'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Lịch Ngoại lệ */}
                {exceptions.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Lịch Ngoại lệ / Báo nghỉ / Dạy bù ({exceptions.length})</span>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {exceptions.map((ex: any, idx: number) => {
                        const exDate = ex.ngay;
                        const exStatus = String(ex.trang_thai || '').toLowerCase();
                        const exMakeupDate = ex.ngay_day_bu;
                        const exReason = ex.ly_do;
                        const subLecturerName =
                          ex.giang_vien_day_thay?.ho_ten ||
                          (ex.giang_vien_day_thay_id
                            ? lecturers.find((l) => String(l.id) === String(ex.giang_vien_day_thay_id))?.ho_ten
                            : null);
                        const repShiftName =
                          ex.ca_thay_the?.ten_ca ||
                          (ex.ca_thay_the_id
                            ? shifts.find((s) => String(s.id) === String(ex.ca_thay_the_id))?.ten_ca
                            : null);
                        return (
                          <div key={ex.id || idx} className="text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 flex-wrap">
                            <span>
                              Ngày {formatDateFull(exDate)}:{' '}
                              <strong>
                                {exStatus === 'nghi'
                                  ? 'Nghỉ'
                                  : exStatus === 'day_bu'
                                    ? 'Dạy bù'
                                    : exStatus === 'doi_ca'
                                      ? 'Đổi ca / Dạy thay'
                                      : exStatus === 'huy'
                                        ? 'Hủy buổi'
                                        : exStatus}
                              </strong>{' '}
                              {exMakeupDate ? `→ ${exStatus === 'doi_ca' ? 'Đổi sang' : 'Bù ngày'} ${formatDateFull(exMakeupDate)} ` : ''}
                              {subLecturerName ? `• GV dạy thay: ${subLecturerName} ` : ''}
                              {repShiftName ? `• Ca mới: ${repShiftName} ` : ''}
                              {exReason ? `(${exReason})` : ''}
                            </span>
                            {ex.tao_luc && (
                              <span className="text-[10px] font-mono text-amber-700/80 dark:text-amber-300/80">
                                Ghi nhận: {new Date(ex.tao_luc).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    {isAdminOrDean && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDeleteSchedule(selectedSchedule.id, e)}
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

      <ModalNgoaiLeLichTrinh
        isOpen={Boolean(isExceptionModalOpen && selectedSchedule)}
        exceptionData={exceptionData}
        submitting={exceptionSubmitting}
        lecturers={lecturers}
        shifts={shifts}
        currentLecturerId={
          selectedSchedule
            ? typeof selectedSchedule.nguoi_dung_id === 'object'
              ? selectedSchedule.nguoi_dung_id?.id || ''
              : String(selectedSchedule.nguoi_dung_id || '')
            : ''
        }
        onChange={(next) => setExceptionData(next as any)}
        onClose={() => setIsExceptionModalOpen(false)}
        onSubmit={handleExceptionSubmit}
      />
    </div>
  );
};

export default Schedules;
