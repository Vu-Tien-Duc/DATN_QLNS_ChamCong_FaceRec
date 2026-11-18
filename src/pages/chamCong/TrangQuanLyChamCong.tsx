import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ScanFace,
  QrCode,
  MapPin,
  Search,
  Filter,
  Download,
  Edit3,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  PlayCircle,
  FilePlus,
  Camera,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DepartmentSelect } from '../../components/chung/ChonDonVi';
import { KhungAnhMinhChung } from './components/KhungAnhMinhChung';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import {
  attendanceApi,
  AttendanceHistoryItem,
} from '../../api/chamCong.api';
import { departmentApi } from '../../api/phongBan.api';
import { userApi } from '../../api/nguoiDung.api';
import { DepartmentItem, UserProfile } from '../../types/index';
import { useSocketEvent, useSocketStatus } from '../../api/socket';
import { hasRole } from '../../utils/phanQuyen';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function formatDateVN(dateStr?: string | Date): string {
  if (!dateStr) return '--/--/----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortDate(dateStr?: string | Date): string {
  if (!dateStr) return '--/--/----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeVN(dateStr?: string | Date): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatShortTime(dateStr?: string | Date): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDatetimeInput(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatMinutes(minutes?: number): string {
  if (!minutes || minutes <= 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function resolveMediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const filename = path.split('/').pop()?.split('\\').pop() || '';
  if (!filename) return '';
  return `http://localhost:5000/uploads/${filename}`;
}

function getUserInitials(name?: string): string {
  if (!name) return 'CB';
  // Chuẩn hóa và loại bỏ các học hàm, học vị, chức danh tiền tố tiếng Việt (GS., PGS., TS., ThS., CN., KS., v.v.)
  const cleaned = name
    .replace(/^(GS\.|PGS\.|TS\.|ThS\.|CN\.|KS\.|Đ\/c|Thầy|Cô|GS|PGS|TS|ThS)\s+/gi, '')
    .replace(/^(GS\.|PGS\.|TS\.|ThS\.|CN\.|KS\.|Đ\/c|Thầy|Cô|GS|PGS|TS|ThS)\s+/gi, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (cleaned.substring(0, 2) || 'CB').toUpperCase();
}

// =============================================================================
// STATUS & METHOD CONFIGURATIONS
// =============================================================================

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    dotColor: string;
    badgeCls: string;
    bgSoft: string;
    icon: any;
  }
> = {
  on_time: {
    label: 'Đúng Giờ',
    dotColor: 'bg-emerald-500',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: CheckCircle2,
  },
  late: {
    label: 'Đi Muộn',
    dotColor: 'bg-amber-500',
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/30',
    icon: Clock,
  },
  early_leave: {
    label: 'Về Sớm',
    dotColor: 'bg-orange-500',
    badgeCls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    bgSoft: 'bg-orange-50 dark:bg-orange-950/30',
    icon: Clock,
  },
  excused_absence: {
    label: 'Nghỉ Có Phép',
    dotColor: 'bg-blue-500',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    bgSoft: 'bg-blue-50 dark:bg-blue-950/30',
    icon: CheckCircle2,
  },
  absent: {
    label: 'Vắng Mặt',
    dotColor: 'bg-rose-500',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/30',
    icon: XCircle,
  },
};

const METHOD_LABELS: Record<string, { label: string; icon: any; cls: string }> = {
  face_ai: {
    label: 'Face ID AI',
    icon: ScanFace,
    cls: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800',
  },
  FACE: {
    label: 'Face ID AI',
    icon: ScanFace,
    cls: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800',
  },
  face: {
    label: 'Face ID AI',
    icon: ScanFace,
    cls: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800',
  },
  qr_code: {
    label: 'Mã QR TOTP',
    icon: QrCode,
    cls: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800',
  },
  QR: {
    label: 'Mã QR TOTP',
    icon: QrCode,
    cls: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800',
  },
  MANUAL: {
    label: 'Cổng Web / Thủ Công',
    icon: Edit3,
    cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800',
  },
  manual: {
    label: 'Cổng Web / Thủ Công',
    icon: Edit3,
    cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800',
  },
  ADMIN_OVERRIDE: {
    label: 'Quản Trị Điều Chỉnh',
    icon: ShieldCheck,
    cls: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800',
  },
  admin_override: {
    label: 'Quản Trị Điều Chỉnh',
    icon: ShieldCheck,
    cls: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800',
  },
  system_auto: {
    label: 'Hệ Thống Tự Động',
    icon: Sparkles,
    cls: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
  },
  SYSTEM: {
    label: 'Hệ Thống Tự Động',
    icon: Sparkles,
    cls: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
  },
  GPS: {
    label: 'Định Vị GPS',
    icon: MapPin,
    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800',
  },
};

// =============================================================================
// MAIN COMPONENT: AttendanceManage
// =============================================================================

export const AttendanceManage: React.FC = () => {
  const { user } = useAuthStore();
  const isSocketConnected = useSocketStatus();

  // Danh sách dữ liệu & Phân trang
  const [records, setRecords] = useState<AttendanceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Danh mục Khoa/Phòng ban và Danh sách Cán bộ
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);

  // Bộ lọc
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [onlyFraud, setOnlyFraud] = useState<boolean>(false);
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // State các Modals
  const [selectedDetailLog, setSelectedDetailLog] = useState<AttendanceHistoryItem | null>(null);
  const [adjustingLog, setAdjustingLog] = useState<AttendanceHistoryItem | null>(null);
  const [isAbsentCronModalOpen, setIsAbsentCronModalOpen] = useState<boolean>(false);
  const [isManualPunchModalOpen, setIsManualPunchModalOpen] = useState<boolean>(false);

  // Tracking ảnh đại diện và minh chứng không load được / không tồn tại
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});
  const [brokenEvidence, setBrokenEvidence] = useState<Record<string, boolean>>({});

  // Form state cho Adjust Modal
  const [adjustStatus, setAdjustStatus] = useState<string>('on_time');
  const [adjustCheckIn, setAdjustCheckIn] = useState<string>('');
  const [adjustCheckOut, setAdjustCheckOut] = useState<string>('');
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [adjustIsFraud, setAdjustIsFraud] = useState<boolean>(false);
  const [adjustFraudReason, setAdjustFraudReason] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState<boolean>(false);

  // Form state cho Absent Cron Modal
  const [cronDate, setCronDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [cronResult, setCronResult] = useState<any>(null);
  const [isRunningCron, setIsRunningCron] = useState<boolean>(false);

  // Form state cho Manual Punch Modal
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualPunchType, setManualPunchType] = useState<'check_in' | 'check_out'>('check_in');
  const [manualNote, setManualNote] = useState<string>('');
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false);

  // ===========================================================================
  // DATE RANGE RESOLUTION
  // ===========================================================================

  const { resolvedFrom, resolvedTo } = useMemo(() => {
    if (dateRangePreset === 'all') {
      return { resolvedFrom: '', resolvedTo: '' };
    }
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (dateRangePreset === 'today') {
      const s = toIso(today);
      return { resolvedFrom: s, resolvedTo: s };
    }
    if (dateRangePreset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = toIso(y);
      return { resolvedFrom: s, resolvedTo: s };
    }
    if (dateRangePreset === 'week') {
      const start = new Date(today);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      return { resolvedFrom: toIso(start), resolvedTo: toIso(today) };
    }
    if (dateRangePreset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { resolvedFrom: toIso(start), resolvedTo: toIso(today) };
    }
    return { resolvedFrom: customFrom, resolvedTo: customTo };
  }, [dateRangePreset, customFrom, customTo]);

  // ===========================================================================
  // LOAD DEPARTMENTS & USERS
  // ===========================================================================

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [deptRes, usersRes] = await Promise.all([
          departmentApi.getDepartmentsFlat().catch(() => ({ data: [] })),
          userApi.getUsers({ limit: 1000 }).catch(() => ({ data: [] })),
        ]);

        const rawDepts = deptRes.data || [];
        setDepartments(Array.isArray(rawDepts) ? rawDepts : []);

        const rawUsers = (usersRes.data as any)?.users || usersRes.data || [];
        setUserList(Array.isArray(rawUsers) ? rawUsers : []);
      } catch (err) {
        console.error('Lỗi khi tải metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // ===========================================================================
  // FETCH ATTENDANCE RECORDS
  // ===========================================================================

  const fetchAttendanceList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit,
      };
      if (resolvedFrom) params.from = resolvedFrom;
      if (resolvedTo) params.to = resolvedTo;
      if (selectedDeptId) params.departmentId = selectedDeptId;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedMethod) params.method = selectedMethod;
      if (onlyFraud) params.isFraud = true;

      const res = await attendanceApi.getAttendanceHistory(params);
      const rawRecords = res.records || [];
      setRecords(rawRecords);

      if (res.pagination) {
        setTotalCount(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      } else {
        setTotalCount(rawRecords.length);
        setTotalPages(Math.ceil(rawRecords.length / limit) || 1);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách điểm danh:', err);
      toast.error(err.response?.data?.message || 'Không thể tải lịch sử điểm danh toàn trường.');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, resolvedFrom, resolvedTo, selectedDeptId, selectedStatus, selectedMethod, onlyFraud]);

  useEffect(() => {
    fetchAttendanceList();
  }, [fetchAttendanceList]);

  // Realtime Socket events
  useSocketEvent('attendance:new-punch', (punchData: any) => {
    const punchName = punchData?.user?.fullName || punchData?.fullName || 'Một cán bộ';
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-xs">
            ✓
          </div>
          <div className="text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{punchName}</span> vừa điểm danh!
            <div className="text-[10px] text-slate-500">Cập nhật ngay vào bảng điều hành</div>
          </div>
        </div>
      ),
      { duration: 3000 }
    );
    fetchAttendanceList();
  });

  useSocketEvent('security:fraud-alert', (alertData: any) => {
    toast.error(
      `Cảnh báo an ninh: ${alertData?.reason || 'Phát hiện lượt quẹt thẻ vi phạm GPS / giả mạo!'}`,
      { duration: 5000 }
    );
    fetchAttendanceList();
  });

  // Client-side search keyword
  const filteredRecords = useMemo(() => {
    if (!searchKeyword.trim()) return records;
    const kw = searchKeyword.toLowerCase();
    return records.filter((r) => {
      const name = r.userId?.fullName?.toLowerCase() || '';
      const email = r.userId?.email?.toLowerCase() || '';
      const code = r.userId?.staffCode?.toLowerCase() || '';
      const dept =
        typeof r.userId?.departmentId === 'object'
          ? (r.userId?.departmentId?.name || '').toLowerCase()
          : '';
      const shift = r.shiftId?.name?.toLowerCase() || '';
      return (
        name.includes(kw) ||
        email.includes(kw) ||
        code.includes(kw) ||
        dept.includes(kw) ||
        shift.includes(kw)
      );
    });
  }, [records, searchKeyword]);

  // Tính toán KPI Stats
  const stats = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let early = 0;
    let absent = 0;
    let excused = 0;
    let fraudCount = 0;
    let totalLateMinutes = 0;

    filteredRecords.forEach((r) => {
      if (r.status === 'on_time') onTime++;
      else if (r.status === 'late') {
        late++;
        totalLateMinutes += r.lateMinutes || 0;
      } else if (r.status === 'early_leave') early++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'excused_absence') excused++;

      if (r.isFraud) fraudCount++;
    });

    const total = filteredRecords.length;
    const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;

    return {
      total,
      onTime,
      onTimeRate,
      late,
      early,
      absent,
      excused,
      fraudCount,
      totalLateMinutes,
    };
  }, [filteredRecords]);

  // Xuất file Excel (.xlsx) điểm danh toàn trường chuyên nghiệp
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error('Không có dữ liệu điểm danh để xuất file Excel.');
      return;
    }

    try {
      const dataRows = filteredRecords.map((r, idx) => {
        const deptName =
          typeof r.userId?.departmentId === 'object'
            ? r.userId?.departmentId?.name || ''
            : '';
        const statusLabel = STATUS_CONFIG[r.status]?.label || r.status || 'Chưa rõ';
        const methodLabel = METHOD_LABELS[r.method]?.label || r.method || 'Chưa rõ';
        const isFraudText = r.isFraud ? 'Phát hiện nghi vấn' : 'Bình thường';

        return {
          'STT': idx + 1,
          'Mã Cán Bộ': r.userId?.staffCode || '--',
          'Họ Và Tên': r.userId?.fullName || '--',
          'Email Công Vụ': r.userId?.email || '--',
          'Khoa / Phòng Ban': deptName || '--',
          'Ngày Chấm Công': formatShortDate(r.workDate),
          'Ca Làm Việc': r.shiftId?.name || 'Hành chính',
          'Giờ Check-in': formatShortTime(r.checkInTime),
          'Giờ Check-out': formatShortTime(r.checkOutTime),
          'Đi Muộn (Phút)': r.lateMinutes || 0,
          'Thời Lượng (Giờ)': r.workHours || 0,
          'Số Tiết Dạy': r.actualTeachingPeriods || 0,
          'Trạng Thái': statusLabel,
          'Phương Thức Điểm Danh': methodLabel,
          'An Ninh / Gian Lận': isFraudText,
          'Lý Do / Chi Tiết': r.fraudReason || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 28 },
        { wch: 26 },
        { wch: 16 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 16 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 20 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dữ Liệu Điểm Danh');

      const dateTag = resolvedFrom || resolvedTo ? `_${resolvedFrom || 'Start'}_${resolvedTo || 'End'}` : `_${new Date().toISOString().slice(0, 10)}`;
      const fileName = `Bao_Cao_Diem_Danh_NTU${dateTag}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Báo cáo điểm danh (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất tệp Excel:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // Adjust Handlers
  const handleOpenAdjustModal = (item: AttendanceHistoryItem) => {
    setAdjustingLog(item);
    setAdjustStatus(item.status || 'on_time');
    setAdjustCheckIn(toLocalDatetimeInput(item.checkInTime));
    setAdjustCheckOut(toLocalDatetimeInput(item.checkOutTime));
    setAdjustNote((item as any).notes || (item as any).note || '');
    setAdjustIsFraud(Boolean(item.isFraud));
    setAdjustFraudReason(item.fraudReason || '');
  };

  const handleSaveAdjust = async () => {
    if (!adjustingLog) return;
    setIsSubmittingAdjust(true);
    try {
      await attendanceApi.updateAttendance(adjustingLog._id, {
        status: adjustStatus,
        checkInTime: adjustCheckIn ? new Date(adjustCheckIn).toISOString() : undefined,
        checkOutTime: adjustCheckOut ? new Date(adjustCheckOut).toISOString() : undefined,
        note: adjustNote,
        isFraud: adjustIsFraud,
        fraudReason: adjustFraudReason,
      });
      toast.success('Hiệu chỉnh bản ghi điểm danh thành công!');
      setAdjustingLog(null);
      fetchAttendanceList();
    } catch (err: any) {
      console.error('Lỗi hiệu chỉnh bản ghi:', err);
      toast.error(err.response?.data?.message || 'Không thể hiệu chỉnh bản ghi.');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Absent Cron Handler
  const handleRunAbsentCron = async () => {
    setIsRunningCron(true);
    try {
      const res = await attendanceApi.triggerAbsentCron(cronDate);
      setCronResult(res.data || res);
      toast.success('Quét vắng tự động hoàn tất!');
      fetchAttendanceList();
    } catch (err: any) {
      console.error('Lỗi quét vắng tự động:', err);
      toast.error(err.response?.data?.message || 'Quét vắng tự động thất bại.');
    } finally {
      setIsRunningCron(false);
    }
  };

  // Manual Punch Handler
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId) {
      toast.error('Vui lòng chọn cán bộ / giảng viên.');
      return;
    }
    setIsSubmittingManual(true);
    try {
      if (manualPunchType === 'check_in') {
        await (attendanceApi.manualCheckIn as any)({
          userId: manualUserId,
          notes: manualNote,
          method: 'manual',
          deviceId: 'WEB_ADMIN_PORTAL',
        });
      } else {
        await (attendanceApi.manualCheckOut as any)({
          userId: manualUserId,
          notes: manualNote,
          method: 'manual',
          deviceId: 'WEB_ADMIN_PORTAL',
        });
      }
      toast.success('Điểm danh bổ sung thành công!');
      setIsManualPunchModalOpen(false);
      setManualUserId('');
      setManualNote('');
      fetchAttendanceList();
    } catch (err: any) {
      console.error('Lỗi điểm danh bổ sung:', err);
      toast.error(err.response?.data?.message || 'Không thể tạo bản ghi điểm danh.');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-4 pb-12 animate-fade-in">
      {/* =====================================================================
          1. PAGE HEADER + ACTION BUTTONS
      ===================================================================== */}
      <PageHeader
        title="Nhật Ký Điểm Danh Toàn Trường"
        subtitle="Theo dõi nhật ký điểm danh, đối soát ca làm việc và tổng hợp công nhật."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={fetchAttendanceList}
              disabled={isLoading}
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              title="Làm mới dữ liệu"
            >
              Làm mới
            </Button>

            <Button
              onClick={handleExportExcel}
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất dữ liệu điểm danh ra file Excel (.xlsx)"
            >
              Xuất Excel
            </Button>

            {hasRole(user, ['admin', 'bgh']) && (
              <Button
                onClick={() => {
                  setCronResult(null);
                  setIsAbsentCronModalOpen(true);
                }}
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<PlayCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              >
                Quét vắng
              </Button>
            )}

            {hasRole(user, ['admin', 'bgh', 'truong_khoa', 'pho_khoa']) && (
              <Button
                onClick={() => setIsManualPunchModalOpen(true)}
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<FilePlus className="w-3.5 h-3.5" />}
              >
                Điểm danh bổ sung
              </Button>
            )}
          </div>
        }
      />

      {/* =====================================================================
          2. UNIFIED ATTENDANCE WORKSPACE: KPI STRIP + TOOLBAR + DATA TABLE
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col w-full">
        <CompactStatsBar
          embedded
          items={[
            { label: 'Tổng lượt chấm', value: stats.total, unit: 'lượt', tone: 'brand' },
            { label: 'Đúng giờ', value: stats.onTime, badge: `${stats.onTimeRate}%`, tone: 'success' },
            { label: 'Đi muộn / sớm', value: stats.late + stats.early, unit: 'ca', tone: 'warning' },
            {
              label: 'Vắng mặt',
              value: stats.absent,
              badge: stats.fraudCount > 0 ? `${stats.fraudCount} nghi vấn` : undefined,
              tone: 'danger',
            },
          ]}
        />
        {/* Compact 1-Row Table Toolbar */}
        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo họ tên, mã CB, email, ca học..."
                className="w-full h-9 pl-9 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-colors"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Date Preset */}
            <div className="relative h-9">
              <select
                value={dateRangePreset}
                onChange={(e) => {
                  setDateRangePreset(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-9 appearance-none pl-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer"
                aria-label="Khoảng thời gian"
              >
                <option value="all">Tất cả ngày</option>
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="custom">Tùy chọn ngày...</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick Status Select */}
            <div className="relative h-9">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 appearance-none pl-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer"
                aria-label="Trạng thái điểm danh"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="on_time">Đúng giờ</option>
                <option value="late">Đi muộn</option>
                <option value="early_leave">Về sớm</option>
                <option value="excused_absence">Nghỉ có phép</option>
                <option value="absent">Vắng mặt</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Advanced Filters Toggle */}
            {(() => {
              const extraCount = (selectedDeptId ? 1 : 0) + (selectedMethod ? 1 : 0) + (onlyFraud ? 1 : 0);
              const isOpen = showAdvancedFilters || dateRangePreset === 'custom';
              return (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    isOpen || extraCount > 0
                      ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-800'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Bộ lọc</span>
                  {extraCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-brand-600 text-white text-[10px] font-semibold">
                      {extraCount}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Right: Record Count & Page Size */}
            <div className="flex items-center gap-2 ml-auto text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium whitespace-nowrap">
                {filteredRecords.length} / {totalCount} bản ghi
              </span>
              <div className="relative">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 appearance-none bg-slate-50 dark:bg-slate-800 pl-2.5 pr-6 rounded-lg text-slate-700 dark:text-slate-200 font-medium text-xs border border-slate-200/80 dark:border-slate-700 outline-none cursor-pointer"
                  aria-label="Số bản ghi mỗi trang"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                  <option value={100}>100 / trang</option>
                </select>
                <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Expandable Secondary Filters */}
          {(showAdvancedFilters || dateRangePreset === 'custom') && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs animate-fade-in">
              <div className="w-full sm:w-56">
                <DepartmentSelect
                  departments={departments}
                  value={selectedDeptId}
                  onChange={(deptId) => {
                    setSelectedDeptId(deptId);
                    setCurrentPage(1);
                  }}
                  allowAll={true}
                  allLabel="-- Tất cả Khoa / Đơn vị --"
                  placeholder="Chọn Khoa / Đơn vị..."
                  size="sm"
                />
              </div>

              <div className="relative w-full sm:w-48">
                <select
                  value={selectedMethod}
                  onChange={(e) => {
                    setSelectedMethod(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 appearance-none px-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="">-- Tất cả phương thức --</option>
                  <option value="face_ai">Face ID AI</option>
                  <option value="system_auto">Hệ thống Tự động</option>
                  <option value="qr_code">Mã QR Động</option>
                  <option value="GPS">Mobile GPS</option>
                  <option value="MANUAL">Thủ công</option>
                  <option value="ADMIN_OVERRIDE">Quản trị Điều chỉnh</option>
                </select>
                <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <label
                htmlFor="fraud-filter"
                className="h-9 inline-flex items-center gap-2 px-3 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none"
              >
                <input
                  id="fraud-filter"
                  type="checkbox"
                  checked={onlyFraud}
                  onChange={(e) => {
                    setOnlyFraud(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-0 cursor-pointer accent-rose-600"
                />
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-200 font-medium">Nghi vấn gian lận</span>
              </label>

              {dateRangePreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs"
                  />
                  <span className="text-slate-400">→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(1);
                      fetchAttendanceList();
                    }}
                    className="h-9 text-xs"
                  >
                    Áp dụng
                  </Button>
                </div>
              )}

              {(selectedDeptId || selectedStatus || selectedMethod || onlyFraud || dateRangePreset !== 'all' || searchKeyword) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    setSelectedDeptId('');
                    setSelectedStatus('');
                    setSelectedMethod('');
                    setOnlyFraud(false);
                    setDateRangePreset('all');
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline ml-auto"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fixed Width Zero-Scroll Table */}
        <div className="w-full overflow-hidden">
          <table className="w-full text-left table-fixed border-collapse">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200/70 dark:border-slate-800 font-semibold">
                <th className="py-3 px-3 font-semibold truncate">Cán Bộ / Giảng Viên</th>
                <th className="py-3 px-3 font-semibold truncate">Ngày &amp; Ca Học</th>
                <th className="py-3 px-3 font-semibold truncate">Giờ Vào (IN)</th>
                <th className="py-3 px-3 font-semibold truncate">Giờ Ra (OUT)</th>
                <th className="py-3 px-3 font-semibold truncate">Thời Lượng</th>
                <th className="py-3 px-3 font-semibold truncate">Trạng Thái</th>
                <th className="py-3 px-3 font-semibold truncate">Minh Chứng</th>
                <th className="py-3 px-3 text-center font-semibold truncate">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-brand-600" />
                    Đang tải nhật ký điểm danh toàn trường từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    Không tìm thấy bản ghi chấm công nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const statusObj = STATUS_CONFIG[item.status] || STATUS_CONFIG.absent;
                  const methodKey = item.method || '';
                  const methodObj =
                    METHOD_LABELS[methodKey] ||
                    METHOD_LABELS[methodKey.toUpperCase()] || {
                      label: methodKey || 'Chưa rõ',
                      icon: Clock,
                      cls: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
                    };
                  const MethodIcon = methodObj.icon;
                  const isFraud = item.isFraud;
                  const deptName =
                    typeof item.userId?.departmentId === 'object'
                      ? item.userId?.departmentId?.name || ''
                      : '';
                  const snapshot =
                    item.capturedImage ||
                    item.evidencePhoto ||
                    (item.punchLogIds && item.punchLogIds[0]?.evidenceImage);

                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group ${
                        isFraud ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Cột 1: Cán bộ / Giảng viên (18%) */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={item.userId?.fullName}
                            avatarUrl={item.userId?.avatar}
                            staffCode={item.userId?.staffCode || item.userId?._id}
                            size="sm"
                            shape="rounded"
                          />
                          <div className="flex flex-col min-w-0 leading-snug">
                            <span
                              className="text-sm text-slate-900 dark:text-slate-100 truncate font-semibold"
                              title={item.userId?.fullName || 'Chưa định danh'}
                            >
                              {item.userId?.fullName || 'Chưa định danh'}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                              <span className="font-medium text-brand-600 dark:text-brand-400 tabular-nums">
                                {item.userId?.staffCode || '--'}
                              </span>
                              <span>•</span>
                              <span className="truncate">{deptName || 'Nhân sự'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Ngày & Ca Học (14%) */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col leading-snug">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {formatDateVN(item.workDate)}
                          </span>
                          <span className="text-xs text-brand-600 dark:text-brand-400 font-medium truncate">
                            {item.shiftId?.name || 'Ca Hành Chính'}
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Giờ Vào (IN) (14%) */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start leading-snug">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`tabular-nums text-sm font-semibold ${
                                item.checkInTime
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-400 font-normal'
                              }`}
                            >
                              {formatTimeVN(item.checkInTime)}
                            </span>
                            {item.lateMinutes && item.lateMinutes > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-xs tabular-nums">
                                +{item.lateMinutes}p
                              </span>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                            <MethodIcon className="w-3 h-3" />
                            {methodObj.label}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Giờ Ra (OUT) (11%) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`tabular-nums text-sm whitespace-nowrap ${
                              item.checkOutTime
                                ? 'font-semibold text-slate-900 dark:text-slate-100'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatTimeVN(item.checkOutTime)}
                          </span>
                          {item.earlyExitMinutes && item.earlyExitMinutes > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-semibold text-xs tabular-nums">
                              -{item.earlyExitMinutes}p
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Cột 5: Thời Lượng (10%) */}
                      <td className="py-3 px-3">
                        <span className="text-sm text-slate-800 dark:text-slate-200 font-medium tabular-nums">
                          {item.workHours
                            ? `${item.workHours} giờ`
                            : formatMinutes(item.workDurationMinutes)}
                        </span>
                      </td>

                      {/* Cột 6: Trạng Thái (12%) */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border ${statusObj.badgeCls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dotColor}`} />
                          {statusObj.label}
                        </span>
                      </td>

                      {/* Cột 7: Minh Chứng (13%) */}
                      <td className="py-3 px-3">
                        {snapshot && !brokenEvidence[item._id] ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              onClick={() => setSelectedDetailLog(item)}
                              className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all flex items-center justify-center"
                              title="Xem ảnh chụp đối soát"
                            >
                              <img
                                className="w-full h-full object-cover"
                                alt="Biometric camera snapshot"
                                src={resolveMediaUrl(snapshot)}
                                onError={() => {
                                  setBrokenEvidence((prev) => ({ ...prev, [item._id]: true }));
                                }}
                              />
                            </div>
                            <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Match
                            </span>
                          </div>
                        ) : item.status === 'excused_absence' ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate">
                            #NP-Đã duyệt
                          </span>
                        ) : item.method === 'GPS' || item.method === 'gps_mobile' ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Định vị GPS
                          </span>
                        ) : item.method === 'RFID' || item.method === 'CARD' ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Quẹt cổng
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400 truncate">
                            --
                          </span>
                        )}
                      </td>

                      {/* Cột 8: Thao Tác (8%) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedDetailLog(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600 transition-colors"
                            title="Xem chi tiết"
                            type="button"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasRole(user, ['admin', 'bgh', 'truong_khoa', 'pho_khoa']) && (
                            <button
                              onClick={() => handleOpenAdjustModal(item)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600 transition-colors"
                              title="Duyệt bù / Hiệu chỉnh"
                              type="button"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
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

        {/* Table Pagination Footer */}
        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200/70 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Trang <span className="font-semibold text-slate-900 dark:text-slate-100">{currentPage}</span> / {totalPages}{' '}
            (Tổng cộng <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span> bản ghi)
          </span>

          {/* Pagination Buttons */}
          <div className="flex items-center gap-1 self-end sm:self-auto text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 rounded-lg font-mono font-medium flex items-center justify-center transition-colors ${
                    currentPage === p
                      ? 'bg-brand-600 text-white shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  type="button"
                >
                  {p}
                </button>
              );
            })}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400 font-mono">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-lg font-mono font-medium flex items-center justify-center transition-colors ${
                    currentPage === totalPages
                      ? 'bg-brand-600 text-white shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  type="button"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: CHI TIẾT BẢN GHI & ĐỐI SOÁT MINH CHỨNG
      ===================================================================== */}
      {selectedDetailLog && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4 animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 flex items-center justify-center">
                    <ScanFace className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Đối Soát Minh Chứng Sinh Trắc Học
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mã bản ghi: <span className="font-mono">{selectedDetailLog._id}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailLog(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thông tin Cán bộ */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <UserAvatar
                  name={selectedDetailLog.userId?.fullName}
                  avatarUrl={selectedDetailLog.userId?.avatar}
                  staffCode={selectedDetailLog.userId?.staffCode || selectedDetailLog.userId?._id}
                  size="lg"
                  shape="rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {selectedDetailLog.userId?.fullName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    Mã CB: <span className="font-semibold">{selectedDetailLog.userId?.staffCode || '--'}</span> | Email: {selectedDetailLog.userId?.email}
                  </div>
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5 truncate">
                    Khoa/Bộ môn:{' '}
                    {typeof selectedDetailLog.userId?.departmentId === 'object'
                      ? selectedDetailLog.userId?.departmentId?.name
                      : '--'}
                  </div>
                </div>
              </div>

              {/* Ảnh chụp Snapshot camera đối soát */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Ảnh Chụp Snapshot Thời Điểm Quẹt Thẻ
                </label>
                <KhungAnhMinhChung
                  logId={selectedDetailLog._id || (selectedDetailLog as any).id}
                  initialUrl={selectedDetailLog.capturedImage || selectedDetailLog.evidencePhoto}
                  checkInTimeText={formatTimeVN(selectedDetailLog.checkInTime)}
                  resolveMediaUrl={resolveMediaUrl}
                />
              </div>

              {/* Thông tin Chi tiết 2 cột */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Thời gian Check-in:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatTimeVN(selectedDetailLog.checkInTime)}
                  </span>
                  {selectedDetailLog.lateMinutes && selectedDetailLog.lateMinutes > 0 ? (
                    <span className="text-amber-600 text-[11px] block mt-0.5 font-bold">
                      (Đi muộn {selectedDetailLog.lateMinutes} phút)
                    </span>
                  ) : null}
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Thời gian Check-out:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatTimeVN(selectedDetailLog.checkOutTime)}
                  </span>
                  {selectedDetailLog.earlyExitMinutes && selectedDetailLog.earlyExitMinutes > 0 ? (
                    <span className="text-orange-600 text-[11px] block mt-0.5 font-bold">
                      (Về sớm {selectedDetailLog.earlyExitMinutes} phút)
                    </span>
                  ) : null}
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Số giờ công / Số tiết / Chốt công:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedDetailLog.workHours !== undefined
                      ? `${selectedDetailLog.workHours}h (${selectedDetailLog.workDurationMinutes ?? 0}p)`
                      : `${selectedDetailLog.workDurationMinutes ?? 0}p`}{' '}
                    • {(selectedDetailLog as any).actualTeachingPeriods ?? 0} tiết •{' '}
                    <span className={(selectedDetailLog as any).isClosed ? 'text-emerald-600' : 'text-amber-600'}>
                      {(selectedDetailLog as any).isClosed ? 'Đã chốt công' : 'Chưa chốt'}
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Người hiệu chỉnh thủ công:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {(selectedDetailLog as any).overrideBy
                      ? typeof (selectedDetailLog as any).overrideBy === 'object'
                        ? (selectedDetailLog as any).overrideBy?.fullName ||
                          (selectedDetailLog as any).overrideBy?.ho_ten ||
                          'Quản trị viên'
                        : 'Quản trị viên'
                      : 'Chấm công tự động'}
                  </span>
                </div>
                {((selectedDetailLog as any).leaveRequest || (selectedDetailLog as any).leaveRequestId) && (
                  <div className="col-span-2 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
                    <span className="text-slate-400 block mb-0.5">Đơn từ liên kết (Nghỉ phép / Công tác):</span>
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                      {(selectedDetailLog as any).leaveRequest
                        ? `${(selectedDetailLog as any).leaveRequest.loai_don || 'Đơn'} • ${(selectedDetailLog as any).leaveRequest.trang_thai || ''}`
                        : `Mã đơn: ${(selectedDetailLog as any).leaveRequestId}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Chi tiết các lượt quẹt thô */}
              {Array.isArray((selectedDetailLog as any).punches) && (selectedDetailLog as any).punches.length > 0 && (
                <div className="space-y-2 text-xs">
                  <label className="block font-bold uppercase tracking-wider text-slate-500">
                    Lượt Quẹt Sinh Trắc Học ({(selectedDetailLog as any).punches.length} lượt)
                  </label>
                  <div className="space-y-2">
                    {(selectedDetailLog as any).punches.map((p: any, idx: number) => (
                      <div
                        key={p._id || idx}
                        className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {p.punchType === 'check_in' ? 'Vào ca' : 'Tan ca'} • {formatTimeVN(p.punchTime)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Phương thức: {p.method || 'face_ai'} • Thiết bị: {p.deviceId || '—'}
                            {p.recognizedAngle ? ` • Góc mặt: ${p.recognizedAngle}` : ''}
                          </div>
                          {(p.distanceMeters != null || p.gpsAccuracy != null || (p.latitude != null && p.longitude != null)) && (
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              {p.distanceMeters != null ? `Khoảng cách: ${Math.round(p.distanceMeters)}m` : ''}
                              {p.distanceMeters != null && p.gpsAccuracy != null ? ' • ' : ''}
                              {p.gpsAccuracy != null ? `Sai số GPS: ±${Math.round(p.gpsAccuracy)}m` : ''}
                              {(p.distanceMeters != null || p.gpsAccuracy != null) && p.latitude != null && p.longitude != null ? ' • ' : ''}
                              {p.latitude != null && p.longitude != null
                                ? `GPS: ${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`
                                : ''}
                            </div>
                          )}
                          {(p.isMockLocation || p.isValid === false) && (
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                              {p.isMockLocation ? 'Giả lập vị trí GPS' : ''}
                              {p.isMockLocation && p.invalidReason ? ' • ' : ''}
                              {p.invalidReason || ''}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          {p.confidenceScore != null && (
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                              AI: {Math.round(p.confidenceScore * 100)}%
                            </div>
                          )}
                          {p.livenessScore != null && (
                            <div className="text-[11px] text-slate-500">
                              Mặt thật: {Math.round(p.livenessScore * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cảnh báo an ninh hoặc lý do ghi đè thủ công */}
              {(selectedDetailLog.isFraud || ((selectedDetailLog as any).overrideBy && selectedDetailLog.fraudReason)) && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    selectedDetailLog.isFraud
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      selectedDetailLog.isFraud ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <div className="font-bold">
                      {selectedDetailLog.isFraud ? 'Cảnh Báo Gian Lận / Vi Phạm An Ninh' : 'Lý Do Hiệu Chỉnh / Ghi Đè Công'}
                    </div>
                    <div>
                      {selectedDetailLog.fraudReason || 'Phát hiện vị trí chấm công ngoài bán kính cho phép.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setSelectedDetailLog(null)}>
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* =====================================================================
          MODAL 2: HIỆU CHỈNH BẢN GHI (ADMIN OVERRIDE)
      ===================================================================== */}
      {adjustingLog && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Hiệu Chỉnh Bản Ghi Điểm Danh
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cán bộ: <span className="font-semibold text-slate-800 dark:text-slate-200">{adjustingLog.userId?.fullName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdjustingLog(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng Thái Điểm Danh:
                  </label>
                  <select
                    value={adjustStatus}
                    onChange={(e) => setAdjustStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="on_time">Đúng Giờ</option>
                    <option value="late">Đi Muộn</option>
                    <option value="early_leave">Về Sớm</option>
                    <option value="excused_absence">Nghỉ Có Phép</option>
                    <option value="absent">Vắng Mặt</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giờ Vào (Check-in):
                    </label>
                    <input
                      type="datetime-local"
                      value={adjustCheckIn}
                      onChange={(e) => setAdjustCheckIn(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giờ Ra (Check-out):
                    </label>
                    <input
                      type="datetime-local"
                      value={adjustCheckOut}
                      onChange={(e) => setAdjustCheckOut(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi Chú Điều Chỉnh (Bắt buộc để lưu vết kiểm toán):
                  </label>
                  <textarea
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Nhập lý do hiệu chỉnh bản ghi..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustIsFraud}
                      onChange={(e) => setAdjustIsFraud(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold text-rose-600">Đánh dấu nghi vấn gian lận</span>
                  </label>
                  {adjustIsFraud && (
                    <input
                      type="text"
                      value={adjustFraudReason}
                      onChange={(e) => setAdjustFraudReason(e.target.value)}
                      placeholder="Lý do đánh dấu nghi vấn gian lận..."
                      className="w-full px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 text-xs text-rose-700"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustingLog(null)}
                  disabled={isSubmittingAdjust}
                >
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAdjust}
                  disabled={isSubmittingAdjust}
                  className="bg-brand-600 hover:bg-brand-500 text-white"
                >
                  {isSubmittingAdjust ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* =====================================================================
          MODAL 3: QUÉT VẮNG TỰ ĐỘNG (ABSENT CRON)
      ===================================================================== */}
      {isAbsentCronModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Kích Hoạt Quét Vắng Tự Động
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tự động tạo bản ghi Vắng mặt cho các ca không check-in
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAbsentCronModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn Ngày Cần Quét Vắng:
                  </label>
                  <input
                    type="date"
                    value={cronDate}
                    onChange={(e) => setCronDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                {cronResult && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                    <div className="font-bold">Kết quả quét vắng:</div>
                    <div>{cronResult.message || 'Đã hoàn tất quá trình quét vắng tự động.'}</div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAbsentCronModalOpen(false)}
                  disabled={isRunningCron}
                >
                  Đóng
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAbsentCron}
                  disabled={isRunningCron}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {isRunningCron ? 'Đang chạy...' : 'Chạy Quét Vắng'}
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* =====================================================================
          MODAL 4: ĐIỂM DANH BỔ SUNG (MANUAL PUNCH)
      ===================================================================== */}
      {isManualPunchModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <form
              onSubmit={handleManualSubmit}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 flex items-center justify-center">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Điểm Danh Bổ Sung
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tạo lượt chấm công bù trực tiếp vào cơ sở dữ liệu
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualPunchModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn Cán Bộ / Giảng Viên:
                  </label>
                  <select
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Chọn cán bộ cần điểm danh --</option>
                    {userList.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.fullName} ({u.staffCode || u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Loại Chấm Công:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setManualPunchType('check_in')}
                      className={`py-2 rounded-lg font-semibold transition-all ${
                        manualPunchType === 'check_in'
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Check-in (Vào ca)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualPunchType('check_out')}
                      className={`py-2 rounded-lg font-semibold transition-all ${
                        manualPunchType === 'check_out'
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Check-out (Tan ca)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi Chú Minh Chứng:
                  </label>
                  <textarea
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Ghi rõ lý do điểm danh bù..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManualPunchModalOpen(false)}
                  disabled={isSubmittingManual}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingManual}
                  className="bg-brand-600 hover:bg-brand-500 text-white"
                >
                  {isSubmittingManual ? 'Đang gửi...' : 'Xác Nhận Điểm Danh'}
                </Button>
              </div>
            </form>
          </div>
        </Portal>
      )}
    </div>
  );
};
