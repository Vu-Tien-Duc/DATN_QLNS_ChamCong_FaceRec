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
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
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
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  if (path.startsWith('/api/tai-tep/tep/')) return path;
  const filename = path.split('/').pop()?.split('\\').pop() || '';
  if (!filename) return '';
  return `/api/tai-tep/tep/${filename}`;
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
  thu_cong_admin: {
    label: 'Thủ Công / Quản Trị',
    icon: ShieldCheck,
    cls: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800',
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
  gps_mobile: {
    label: 'Mobile GPS',
    icon: MapPin,
    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800',
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
          userApi.getUsers({ gioi_han: 1000 }).catch(() => ({ data: [] })),
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
        trang: currentPage,
        gioi_han: limit,
      };
      if (resolvedFrom) params.tu_ngay = resolvedFrom;
      if (resolvedTo) params.den_ngay = resolvedTo;
      if (selectedDeptId) params.don_vi_id = selectedDeptId;
      if (selectedStatus) params.trang_thai = selectedStatus;
      if (selectedMethod) params.phuong_thuc = selectedMethod;
      if (onlyFraud) params.co_gian_lan = true;

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
    const punchName = punchData?.ho_ten || 'Một cán bộ';
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

  useSocketEvent('attendance:update', () => {
    fetchAttendanceList();
  });

  useSocketEvent('security:fraud-alert', (alertData: any) => {
    toast.error(
      `Cảnh báo an ninh: ${alertData?.message || 'Phát hiện lượt quẹt thẻ vi phạm GPS / giả mạo!'}`,
      { duration: 5000 }
    );
    fetchAttendanceList();
  });

  // Client-side search keyword
  const filteredRecords = useMemo(() => {
    if (!searchKeyword.trim()) return records;
    const kw = searchKeyword.toLowerCase();
    return records.filter((r) => {
      const name = (r.nguoi_dung?.ho_ten || r.userId?.fullName || '').toLowerCase();
      const email = (r.nguoi_dung?.email || r.userId?.email || '').toLowerCase();
      const code = (r.nguoi_dung?.ma_can_bo || r.userId?.staffCode || '').toLowerCase();
      const dept = (
        r.nguoi_dung?.don_vi_chinh?.ten_phong_ban ||
        (typeof r.userId?.departmentId === 'object' ? r.userId?.departmentId?.name : '') ||
        ''
      ).toLowerCase();
      const shift = (r.ca?.ten_ca || r.shiftId?.name || '').toLowerCase();
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
      const st = r.trang_thai || r.status;
      if (st === 'on_time') onTime++;
      else if (st === 'late') {
        late++;
        totalLateMinutes += (r.di_muon_phut ?? r.lateMinutes ?? 0);
      } else if (st === 'early_leave') early++;
      else if (st === 'absent') absent++;
      else if (st === 'excused_absence') excused++;

      if (r.co_gian_lan ?? r.isFraud) fraudCount++;
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
          r.nguoi_dung?.don_vi_chinh?.ten_phong_ban ||
          (typeof r.userId?.departmentId === 'object' ? r.userId?.departmentId?.name || '' : '');
        const stKey = r.trang_thai || r.status || '';
        const statusLabel = STATUS_CONFIG[stKey]?.label || stKey || 'Chưa rõ';
        const methodKey = r.phuong_thuc || r.method || '';
        const methodLabel = METHOD_LABELS[methodKey]?.label || methodKey || 'Chưa rõ';
        const isFraudVal = Boolean(r.co_gian_lan ?? r.isFraud);
        const isFraudText = isFraudVal ? 'Phát hiện nghi vấn' : 'Bình thường';

        return {
          'STT': idx + 1,
          'Mã Cán Bộ': r.nguoi_dung?.ma_can_bo || r.userId?.staffCode || '--',
          'Họ Và Tên': r.nguoi_dung?.ho_ten || r.userId?.fullName || '--',
          'Email Công Vụ': r.nguoi_dung?.email || r.userId?.email || '--',
          'Khoa / Phòng Ban': deptName || '--',
          'Ngày Chấm Công': formatShortDate(r.ngay_cong || r.workDate),
          'Ca Làm Việc': r.ca?.ten_ca || r.shiftId?.name || 'Hành chính',
          'Giờ Check-in': formatShortTime(r.thoi_gian_vao || r.checkInTime),
          'Giờ Check-out': formatShortTime(r.thoi_gian_ra || r.checkOutTime),
          'Đi Muộn (Phút)': r.di_muon_phut ?? r.lateMinutes ?? 0,
          'Thời Lượng (Giờ)': r.thoi_luong_lam_viec_phut != null ? +(r.thoi_luong_lam_viec_phut / 60).toFixed(1) : (r.workHours || 0),
          'Số Tiết Dạy': r.so_tiet_thuc_day ?? r.actualTeachingPeriods ?? 0,
          'Trạng Thái': statusLabel,
          'Phương Thức Điểm Danh': methodLabel,
          'An Ninh / Gian Lận': isFraudText,
          'Lý Do / Chi Tiết': r.ly_do_gian_lan || r.fraudReason || r.ly_do_ghi_de || '',
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
    setAdjustStatus(item.trang_thai || item.status || 'on_time');
    setAdjustCheckIn(toLocalDatetimeInput(item.thoi_gian_vao || item.checkInTime));
    setAdjustCheckOut(toLocalDatetimeInput(item.thoi_gian_ra || item.checkOutTime));
    const isFraudVal = Boolean(item.co_gian_lan ?? item.isFraud);
    const reasonVal = item.ly_do_gian_lan || item.fraudReason || item.ly_do_ghi_de || '';
    setAdjustNote(!isFraudVal && reasonVal ? reasonVal : '');
    setAdjustIsFraud(isFraudVal);
    setAdjustFraudReason(isFraudVal && reasonVal ? reasonVal : '');
  };

  const handleSaveAdjust = async () => {
    if (!adjustingLog) return;
    setIsSubmittingAdjust(true);
    try {
      const resolvedOverrideReason = adjustIsFraud
        ? adjustFraudReason.trim() || adjustNote.trim()
        : adjustNote.trim() || adjustFraudReason.trim();
      const targetId = adjustingLog.id || adjustingLog._id;
      await attendanceApi.updateAttendance(targetId, {
        trang_thai: adjustStatus,
        thoi_gian_vao: adjustCheckIn ? new Date(adjustCheckIn).toISOString() : undefined,
        thoi_gian_ra: adjustCheckOut ? new Date(adjustCheckOut).toISOString() : undefined,
        co_gian_lan: adjustIsFraud,
        ly_do_ghi_de: resolvedOverrideReason || undefined,
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
          method: 'manual',
          deviceId: 'WEB_ADMIN_PORTAL',
        });
      } else {
        await (attendanceApi.manualCheckOut as any)({
          userId: manualUserId,
          method: 'manual',
          deviceId: 'WEB_ADMIN_PORTAL',
        });
      }
      toast.success('Điểm danh bổ sung thành công!');
      setIsManualPunchModalOpen(false);
      setManualUserId('');
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

            {hasRole(user, ['admin', 'bgh', 'truong_khoa']) && (
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
          2. HÀNG 4 THẺ KPI CHUẨN FACE ID
      ===================================================================== */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng lượt chấm',
            value: stats.total,
            subtext: 'bản ghi theo bộ lọc',
            tone: 'neutral',
            onClick: () => {
              setSelectedStatus('');
              setCurrentPage(1);
            },
          },
          {
            label: 'Đúng giờ',
            value: stats.onTime,
            badge: `${stats.onTimeRate}%`,
            progress: stats.onTimeRate,
            tone: 'success',
            onClick: () => {
              setSelectedStatus('on_time');
              setCurrentPage(1);
            },
          },
          {
            label: 'Đi muộn / Về sớm',
            value: stats.late + stats.early,
            subtext: `${stats.late} muộn · ${stats.early} về sớm`,
            tone: 'warning',
            onClick: () => {
              setSelectedStatus('late');
              setCurrentPage(1);
            },
          },
          {
            label: 'Vắng mặt',
            value: stats.absent,
            badge: stats.fraudCount > 0 ? `${stats.fraudCount} nghi vấn` : undefined,
            subtext: stats.absent > 0 ? 'cần đối soát' : 'đầy đủ nhân sự',
            tone: 'danger',
            onClick: () => {
              setSelectedStatus('absent');
              setCurrentPage(1);
            },
          },
        ]}
      />

      {/* =====================================================================
          3. MAIN DATA TABLE WORKSPACE CARD (CHUẨN FACE ID)
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col w-full">
        {/* Compact 1-Row Table Toolbar */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo họ tên, mã CB, email, ca học..."
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-slate-50/70 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 outline-none transition-all"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
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
                className="h-9 appearance-none pl-3 pr-7 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer transition-all"
                aria-label="Khoảng thời gian"
              >
                <option value="all">Tất cả ngày</option>
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="custom">Tùy chọn ngày...</option>
              </select>
              <ChevronRight className="w-3 h-3 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick Status Select */}
            <div className="relative h-9">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 appearance-none pl-3 pr-7 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer transition-all"
                aria-label="Trạng thái điểm danh"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="on_time">Đúng giờ</option>
                <option value="late">Đi muộn</option>
                <option value="early_leave">Về sớm</option>
                <option value="excused_absence">Nghỉ có phép</option>
                <option value="absent">Vắng mặt</option>
              </select>
              <ChevronRight className="w-3 h-3 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Advanced Filters Toggle */}
            {(() => {
              const extraCount = (selectedDeptId ? 1 : 0) + (selectedMethod ? 1 : 0) + (onlyFraud ? 1 : 0);
              const isOpen = showAdvancedFilters || dateRangePreset === 'custom';
              return (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    isOpen || extraCount > 0
                      ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800'
                      : 'bg-slate-100/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Bộ lọc</span>
                  {extraCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {extraCount}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Right: Record Count */}
            <div className="flex items-center gap-2 ml-auto text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="font-medium whitespace-nowrap">
                {filteredRecords.length} / {totalCount} bản ghi
              </span>
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
                  <option value="gps_mobile">Mobile GPS</option>
                  <option value="thu_cong_admin">Thủ công / Quản trị</option>
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
              <tr className="bg-slate-50/70 dark:bg-slate-850/60 text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 font-bold select-none">
                <th className="py-3.5 px-4 font-bold truncate">Cán Bộ / Giảng Viên</th>
                <th className="py-3.5 px-4 font-bold truncate">Ngày &amp; Ca Học</th>
                <th className="py-3.5 px-4 font-bold truncate">Giờ Vào (IN)</th>
                <th className="py-3.5 px-4 font-bold truncate">Giờ Ra (OUT)</th>
                <th className="py-3.5 px-4 font-bold truncate">Thời Lượng</th>
                <th className="py-3.5 px-4 font-bold truncate">Trạng Thái</th>
                <th className="py-3.5 px-4 font-bold truncate">Minh Chứng</th>
                <th className="py-3.5 px-4 text-center font-bold truncate">Thao Tác</th>
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
                  const statusKey = item.trang_thai || item.status;
                  const statusObj = STATUS_CONFIG[statusKey] || STATUS_CONFIG.absent;
                  const methodKey = item.phuong_thuc || item.method || '';
                  const methodObj =
                    METHOD_LABELS[methodKey] ||
                    METHOD_LABELS[methodKey.toUpperCase()] || {
                      label: methodKey || 'Chưa rõ',
                      icon: Clock,
                      cls: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
                    };
                  const MethodIcon = methodObj.icon;
                  const isFraud = Boolean(item.co_gian_lan ?? item.isFraud);
                  const deptName =
                    item.nguoi_dung?.don_vi_chinh?.ten_phong_ban ||
                    (typeof item.userId?.departmentId === 'object' ? item.userId?.departmentId?.name || '' : '');
                  const snapshot =
                    item.anh_minh_chung ||
                    item.capturedImage ||
                    item.evidencePhoto ||
                    (item.luot_quet && item.luot_quet[0]?.anh_minh_chung) ||
                    (item.punchLogIds && (item.punchLogIds[0]?.evidencePhoto || item.punchLogIds[0]?.evidenceImage));
                  const userFullName = item.nguoi_dung?.ho_ten || item.userId?.fullName || 'Chưa định danh';
                  const userStaffCode = item.nguoi_dung?.ma_can_bo || item.userId?.staffCode || '--';
                  const userAvatarUrl = item.nguoi_dung?.anh_dai_dien || item.userId?.avatar;
                  const checkInTimeVal = item.thoi_gian_vao || item.checkInTime;
                  const checkOutTimeVal = item.thoi_gian_ra || item.checkOutTime;
                  const lateMins = item.di_muon_phut ?? item.lateMinutes;
                  const earlyMins = item.ve_som_phut ?? item.earlyExitMinutes;
                  const durationMins = item.thoi_luong_lam_viec_phut ?? item.workDurationMinutes;
                  const teachPeriods = item.so_tiet_thuc_day ?? (item as any).actualTeachingPeriods;
                  const isClosed = item.da_chot ?? (item as any).isClosed;
                  const shiftName = item.ca?.ten_ca || item.shiftId?.name || 'Ca Hành Chính';
                  const roomStr = item.lich_trinh?.phong_hoc || (item as any).schedule?.roomId;
                  const subjectStr = item.lich_trinh?.mon_hoc?.ten_mon || (item as any).schedule?.subject?.name;
                  const hasOverride = Boolean(item.nguoi_ghi_de_id || (item as any).overrideBy || item.ghi_de_thu_cong);
                  const hasLeaveReq = Boolean(item.don_tu_id || item.don_nghi_phep || item.don_tu || (item as any).leaveRequest);

                  return (
                    <tr
                      key={item.id || item._id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group ${
                        isFraud ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Cột 1: Cán bộ / Giảng viên (18%) */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={userFullName}
                            avatarUrl={userAvatarUrl}
                            staffCode={userStaffCode}
                            size="sm"
                            shape="circle"
                          />
                          <div className="flex flex-col min-w-0 leading-tight">
                            <span
                              className="text-xs text-slate-800 dark:text-slate-100 truncate font-semibold"
                              title={userFullName}
                            >
                              {userFullName}
                            </span>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              <span className="font-mono text-brand-600 dark:text-brand-400 font-medium">
                                {userStaffCode}
                              </span>
                              <span>•</span>
                              <span className="truncate">{deptName || 'Nhân sự'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Ngày & Ca Học (14%) */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {formatDateVN(item.ngay_cong || item.workDate)}
                          </span>
                          <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium truncate mt-0.5">
                            {shiftName}
                          </span>
                          {(roomStr || subjectStr) && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {[subjectStr, roomStr].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Giờ Vào (IN) (14%) */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-col gap-1 items-start leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`tabular-nums font-mono text-xs font-semibold ${
                                checkInTimeVal
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-slate-400 font-normal'
                              }`}
                            >
                              {formatTimeVN(checkInTimeVal)}
                            </span>
                            {lateMins && lateMins > 0 ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[10px] tabular-nums font-mono">
                                +{lateMins}p
                              </span>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                            <MethodIcon className="w-2.5 h-2.5" />
                            {methodObj.label}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Giờ Ra (OUT) (11%) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`tabular-nums font-mono text-xs whitespace-nowrap ${
                              checkOutTimeVal
                                ? 'font-semibold text-slate-800 dark:text-slate-200'
                                : 'text-slate-400 font-normal'
                            }`}
                          >
                            {formatTimeVN(checkOutTimeVal)}
                          </span>
                          {earlyMins && earlyMins > 0 ? (
                            <span className="px-1.5 py-0.2 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 font-semibold text-[10px] tabular-nums font-mono">
                              -{earlyMins}p
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Cột 5: Thời Lượng (10%) */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-medium tabular-nums">
                            {durationMins != null
                              ? formatMinutes(durationMins)
                              : item.workHours
                              ? `${item.workHours} giờ`
                              : '--'}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {teachPeriods ? `${teachPeriods} tiết • ` : ''}
                            <span className={isClosed ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                              {isClosed ? 'Đã chốt' : 'Chưa chốt'}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Cột 6: Trạng Thái (12%) */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusObj.badgeCls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dotColor}`} />
                            {statusObj.label}
                          </span>
                          {(isFraud || hasOverride || hasLeaveReq) && (
                            <div className="flex flex-wrap gap-1">
                              {isFraud && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                  Nghi vấn
                                </span>
                              )}
                              {hasOverride && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Ghi đè
                                </span>
                              )}
                              {hasLeaveReq && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  Có đơn
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cột 7: Minh Chứng (13%) */}
                      <td className="py-2.5 px-3.5">
                        {snapshot && !brokenEvidence[item.id || item._id] ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              onClick={() => setSelectedDetailLog(item)}
                              className="w-6 h-6 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all flex items-center justify-center"
                              title="Xem ảnh chụp đối soát"
                            >
                              <AnhBaoMat
                                className="w-full h-full object-cover"
                                alt="Biometric camera snapshot"
                                src={resolveMediaUrl(snapshot)}
                                onError={() => {
                                  const idKey = item.id || item._id;
                                  setBrokenEvidence((prev) => ({ ...prev, [idKey]: true }));
                                }}
                              />
                            </div>
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              Match
                            </span>
                          </div>
                        ) : statusKey === 'excused_absence' ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 truncate">
                            #NP-Đã duyệt
                          </span>
                        ) : methodKey === 'GPS' || methodKey === 'gps_mobile' ? (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            Định vị GPS
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 truncate">
                            --
                          </span>
                        )}
                      </td>

                      {/* Cột 8: Thao Tác (8%) */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedDetailLog(item)}
                            className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Xem chi tiết"
                            type="button"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {hasRole(user, ['admin', 'bgh', 'truong_khoa']) && (
                            <button
                              onClick={() => handleOpenAdjustModal(item)}
                              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition-colors"
                              title="Duyệt bù / Hiệu chỉnh"
                              type="button"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
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

        {/* Table Pagination Footer (Chuẩn Face ID) */}
        <ThanhPhanTrang
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={limit}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(size) => {
            setLimit(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          itemLabel="bản ghi"
        />
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
                      Mã bản ghi: <span className="font-mono">{selectedDetailLog.id || selectedDetailLog._id}</span>
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
                  name={selectedDetailLog.nguoi_dung?.ho_ten || selectedDetailLog.userId?.fullName}
                  avatarUrl={selectedDetailLog.nguoi_dung?.anh_dai_dien || selectedDetailLog.userId?.avatar}
                  staffCode={selectedDetailLog.nguoi_dung?.ma_can_bo || selectedDetailLog.userId?.staffCode || selectedDetailLog.userId?._id}
                  size="lg"
                  shape="circle"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {selectedDetailLog.nguoi_dung?.ho_ten || selectedDetailLog.userId?.fullName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    Mã CB: <span className="font-semibold">{selectedDetailLog.nguoi_dung?.ma_can_bo || selectedDetailLog.userId?.staffCode || '--'}</span> | Email: {selectedDetailLog.nguoi_dung?.email || selectedDetailLog.userId?.email}
                  </div>
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5 truncate">
                    Khoa/Bộ môn:{' '}
                    {selectedDetailLog.nguoi_dung?.don_vi_chinh?.ten_phong_ban ||
                      (typeof selectedDetailLog.userId?.departmentId === 'object'
                        ? selectedDetailLog.userId?.departmentId?.name
                        : '--')}
                  </div>
                </div>
              </div>

              {/* Ảnh chụp Snapshot camera đối soát */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Ảnh Chụp Snapshot Thời Điểm Quẹt Thẻ
                </label>
                <KhungAnhMinhChung
                  logId={selectedDetailLog.id || selectedDetailLog._id}
                  initialUrl={selectedDetailLog.anh_minh_chung || selectedDetailLog.capturedImage || selectedDetailLog.evidencePhoto}
                  checkInTimeText={formatTimeVN(selectedDetailLog.thoi_gian_vao || selectedDetailLog.checkInTime)}
                  resolveMediaUrl={resolveMediaUrl}
                />
              </div>

              {/* Thông tin Chi tiết 2 cột */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Ngày công &amp; Trạng thái:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatDateVN(selectedDetailLog.ngay_cong || selectedDetailLog.workDate)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {(STATUS_CONFIG[selectedDetailLog.trang_thai || selectedDetailLog.status] || STATUS_CONFIG.absent).label}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Tạo / Cập nhật bản ghi:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block">
                    Tạo: {selectedDetailLog.tao_luc || selectedDetailLog.createdAt ? new Date(selectedDetailLog.tao_luc || selectedDetailLog.createdAt!).toLocaleString('vi-VN') : '—'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 block">
                    Sửa: {selectedDetailLog.cap_nhat_luc || selectedDetailLog.updatedAt ? new Date(selectedDetailLog.cap_nhat_luc || selectedDetailLog.updatedAt!).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Thời gian Check-in:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatTimeVN(selectedDetailLog.thoi_gian_vao || selectedDetailLog.checkInTime)}
                  </span>
                  {(selectedDetailLog.di_muon_phut ?? selectedDetailLog.lateMinutes) && (selectedDetailLog.di_muon_phut ?? selectedDetailLog.lateMinutes)! > 0 ? (
                    <span className="text-amber-600 text-[11px] block mt-0.5 font-bold">
                      (Đi muộn {selectedDetailLog.di_muon_phut ?? selectedDetailLog.lateMinutes} phút)
                    </span>
                  ) : null}
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Thời gian Check-out:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatTimeVN(selectedDetailLog.thoi_gian_ra || selectedDetailLog.checkOutTime)}
                  </span>
                  {(selectedDetailLog.ve_som_phut ?? selectedDetailLog.earlyExitMinutes) && (selectedDetailLog.ve_som_phut ?? selectedDetailLog.earlyExitMinutes)! > 0 ? (
                    <span className="text-orange-600 text-[11px] block mt-0.5 font-bold">
                      (Về sớm {selectedDetailLog.ve_som_phut ?? selectedDetailLog.earlyExitMinutes} phút)
                    </span>
                  ) : null}
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Số giờ công / Số tiết / Chốt công:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {(selectedDetailLog.thoi_luong_lam_viec_phut != null || selectedDetailLog.workDurationMinutes != null)
                      ? formatMinutes(selectedDetailLog.thoi_luong_lam_viec_phut ?? selectedDetailLog.workDurationMinutes ?? 0)
                      : `${selectedDetailLog.workHours ?? 0}h`}{' '}
                    • {selectedDetailLog.so_tiet_thuc_day ?? (selectedDetailLog as any).actualTeachingPeriods ?? 0} tiết •{' '}
                    <span className={(selectedDetailLog.da_chot ?? (selectedDetailLog as any).isClosed) ? 'text-emerald-600' : 'text-amber-600'}>
                      {(selectedDetailLog.da_chot ?? (selectedDetailLog as any).isClosed) ? 'Đã chốt công' : 'Chưa chốt'}
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-1">Người hiệu chỉnh thủ công:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDetailLog.nguoi_ghi_de?.ho_ten ||
                      ((selectedDetailLog as any).overrideBy
                        ? typeof (selectedDetailLog as any).overrideBy === 'object'
                          ? (selectedDetailLog as any).overrideBy?.fullName ||
                            (selectedDetailLog as any).overrideBy?.ho_ten ||
                            'Quản trị viên'
                          : 'Quản trị viên'
                        : 'Chấm công tự động')}
                  </span>
                </div>
                {(selectedDetailLog.lich_trinh || (selectedDetailLog as any).schedule || (selectedDetailLog as any).scheduleId) && (
                  <div className="col-span-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-1">Lịch giảng dạy / Giảng đường:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(() => {
                        const sch = selectedDetailLog.lich_trinh || (selectedDetailLog as any).schedule || (selectedDetailLog as any).scheduleId;
                        if (!sch || typeof sch !== 'object') return `Mã lịch: ${String((selectedDetailLog as any).scheduleId).slice(0, 8)}`;
                        const weekdayLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                        const subj = sch.mon_hoc?.ten_mon || sch.subject?.name || '';
                        const room = sch.phong_hoc || sch.roomId || 'Phòng làm việc';
                        const wdIdx = sch.thu_trong_tuan ?? sch.weekday;
                        const weekdayText = wdIdx !== undefined && wdIdx !== null ? weekdayLabels[Number(wdIdx)] || '' : '';
                        const startP = sch.tiet_bat_dau ?? sch.startPeriod;
                        const pCount = sch.so_tiet ?? sch.periodCount;
                        const periodText = startP && pCount
                          ? `Tiết ${startP}–${Number(startP) + Number(pCount) - 1}`
                          : '';
                        return [subj, room, weekdayText, periodText].filter(Boolean).join(' • ');
                      })()}
                    </span>
                  </div>
                )}
                {(selectedDetailLog.don_nghi_phep || selectedDetailLog.don_tu || (selectedDetailLog as any).leaveRequest || (selectedDetailLog as any).leaveRequestId) && (
                  <div className="col-span-2 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
                    <span className="text-slate-400 block mb-0.5">Đơn từ liên kết (Nghỉ phép / Công tác):</span>
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                      {(() => {
                        const lr = selectedDetailLog.don_nghi_phep || selectedDetailLog.don_tu || (selectedDetailLog as any).leaveRequest;
                        if (!lr) return `Mã đơn: ${(selectedDetailLog as any).leaveRequestId}`;
                        const startD = lr.ngay_bat_dau || lr.startDate;
                        const endD = lr.ngay_ket_thuc || lr.endDate;
                        const dateRange = startD && endD
                          ? ` • ${String(startD).slice(0, 10)} → ${String(endD).slice(0, 10)}`
                          : '';
                        return `${lr.loai_don || lr.type || 'Đơn'} (${lr.trang_thai || lr.status || ''})${dateRange}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* Chi tiết các lượt quẹt thô */}
              {(() => {
                const rawPunches = selectedDetailLog.luot_quet || (selectedDetailLog as any).punches || selectedDetailLog.punchLogIds || [];
                return Array.isArray(rawPunches) && rawPunches.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    <label className="block font-bold uppercase tracking-wider text-slate-500">
                      Lượt Quẹt Sinh Trắc Học ({rawPunches.length} lượt)
                    </label>
                    <div className="space-y-2">
                      {rawPunches.map((p: any, idx: number) => {
                        const isCheckIn = p.loai_quet === 'check_in' || p.loai_quet === 'vao' || p.punchType === 'check_in';
                        const punchTimeVal = p.thoi_gian_quet || p.punchTime;
                        const methodStr = p.phuong_thuc || p.method || 'face_ai';
                        const deviceStr = p.ma_thiet_bi || p.deviceId || '—';
                        const angleStr = p.goc_mat_nhan_dien || p.recognizedAngle;
                        const distM = p.khoang_cach_met ?? p.distanceMeters;
                        const gpsAcc = p.do_chinh_xac_gps ?? p.gpsAccuracy;
                        const latVal = p.vi_do ?? p.latitude;
                        const lngVal = p.kinh_do ?? p.longitude;
                        const isMock = p.vi_tri_gia_lap ?? p.isMockLocation;
                        const isValidLog = p.hop_le ?? p.isValid;
                        const invalidMsg = p.ly_do_khong_hop_le || p.invalidReason;
                        const aiConf = p.do_tin_cay_ai ?? p.confidenceScore;
                        const liveness = p.diem_mat_that ?? p.livenessScore;

                        return (
                          <div
                            key={p.id || p._id || idx}
                            className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {isCheckIn ? 'Vào ca' : 'Tan ca'} • {formatTimeVN(punchTimeVal)}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Phương thức: {methodStr} • Thiết bị: {deviceStr}
                                {angleStr ? ` • Góc mặt: ${angleStr}` : ''}
                              </div>
                              {(distM != null || gpsAcc != null || (latVal != null && lngVal != null)) && (
                                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                  {distM != null ? `Khoảng cách: ${Math.round(distM)}m` : ''}
                                  {distM != null && gpsAcc != null ? ' • ' : ''}
                                  {gpsAcc != null ? `Sai số GPS: ±${Math.round(gpsAcc)}m` : ''}
                                  {(distM != null || gpsAcc != null) && latVal != null && lngVal != null ? ' • ' : ''}
                                  {latVal != null && lngVal != null
                                    ? `GPS: ${Number(latVal).toFixed(5)}, ${Number(lngVal).toFixed(5)}`
                                    : ''}
                                </div>
                              )}
                              {(isMock || isValidLog === false) && (
                                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                  {isMock ? 'Giả lập vị trí GPS' : ''}
                                  {isMock && invalidMsg ? ' • ' : ''}
                                  {invalidMsg || ''}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              {aiConf != null && (
                                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  AI: {Math.round(aiConf * 100)}%
                                </div>
                              )}
                              {liveness != null && (
                                <div className="text-[11px] text-slate-500">
                                  Mặt thật: {Math.round(liveness * 100)}%
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Cảnh báo an ninh hoặc lý do ghi đè thủ công */}
              {((selectedDetailLog.co_gian_lan ?? selectedDetailLog.isFraud) || ((selectedDetailLog.nguoi_ghi_de || (selectedDetailLog as any).overrideBy) && (selectedDetailLog.ly_do_gian_lan || selectedDetailLog.fraudReason || selectedDetailLog.ly_do_ghi_de))) && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    (selectedDetailLog.co_gian_lan ?? selectedDetailLog.isFraud)
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      (selectedDetailLog.co_gian_lan ?? selectedDetailLog.isFraud) ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <div className="font-bold">
                      {(selectedDetailLog.co_gian_lan ?? selectedDetailLog.isFraud) ? 'Cảnh Báo Gian Lận / Vi Phạm An Ninh' : 'Lý Do Hiệu Chỉnh / Ghi Đè Công'}
                    </div>
                    <div>
                      {selectedDetailLog.ly_do_gian_lan || selectedDetailLog.fraudReason || selectedDetailLog.ly_do_ghi_de || 'Phát hiện vị trí chấm công ngoài bán kính cho phép.'}
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
                      Cán bộ: <span className="font-semibold text-slate-800 dark:text-slate-200">{adjustingLog.nguoi_dung?.ho_ten || adjustingLog.userId?.fullName}</span>
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
                    {userList.map((u) => {
                      const uId = u.id || u._id;
                      const uName = u.ho_ten || u.fullName;
                      const uCode = u.ma_can_bo || u.staffCode || u.email;
                      return (
                        <option key={uId} value={uId}>
                          {uName} ({uCode})
                        </option>
                      );
                    })}
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
