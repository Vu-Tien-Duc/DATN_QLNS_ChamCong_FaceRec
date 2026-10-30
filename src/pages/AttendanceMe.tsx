import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ScanFace,
  QrCode,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  User,
  Sparkles,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  X,
  Search,
  RotateCcw,
  Smartphone,
  Laptop,
  Check,
  CalendarDays,
  FileCheck,
  CalendarRange,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Portal } from '../components/ui/Portal';
import { Badge } from '../components/ui/Badge';
import {
  attendanceApi,
  AttendanceHistoryItem,
  AttendancePunchLogItem,
} from '../api/attendance.api';
import { FaceAttendanceScannerModal } from '../components/biometrics/FaceAttendanceScannerModal';

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

function formatMinutes(minutes?: number): string {
  if (!minutes || minutes <= 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatWeekdayShort(dateStr?: string | Date): string {
  if (!dateStr) return 'T-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'T-';
  const day = d.getDay();
  if (day === 0) return 'CN';
  return `T${day + 1}`;
}

function formatDayNumber(dateStr?: string | Date): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return String(d.getDate()).padStart(2, '0');
}

function formatDateOnlyVN(dateStr?: string | Date): string {
  if (!dateStr) return '--/--/----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/----';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getWeekdayLongVN(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getDay();
  if (day === 0) return 'Chủ nhật';
  return `Thứ ${day + 1}`;
}

function cleanShiftName(name?: string): string {
  if (!name) return 'Ca làm việc';
  return name.replace(/\s*\(\s*\d{1,2}h?\s*-\s*\d{1,2}h?\s*\)\s*$/i, '').trim();
}

// Map trạng thái CSDL v2.5
const STATUS_CONFIG: Record<
  string,
  { label: string; badgeCls: string; dotColor: string; bgSoft: string; icon: any }
> = {
  on_time: {
    label: 'Đúng Giờ',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: CheckCircle2,
  },
  late: {
    label: 'Đi Muộn',
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/30',
    icon: Clock,
  },
  early_leave: {
    label: 'Về Sớm',
    badgeCls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    bgSoft: 'bg-orange-50 dark:bg-orange-950/30',
    icon: AlertCircle,
  },
  excused_absence: {
    label: 'Nghỉ Có Phép',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    bgSoft: 'bg-blue-50 dark:bg-blue-950/30',
    icon: FileCheck,
  },
  absent: {
    label: 'Vắng Mặt',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dotColor: 'bg-rose-500',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/30',
    icon: XCircle,
  },
};

const METHOD_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  face_ai: { label: 'FaceID AI', icon: ScanFace, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
  FACE: { label: 'FaceID AI', icon: ScanFace, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
  qr_code: { label: 'Mã QR TOTP', icon: QrCode, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  QR: { label: 'Mã QR TOTP', icon: QrCode, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  gps_mobile: { label: 'GPS Mobile', icon: MapPin, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  GPS: { label: 'GPS Mobile', icon: MapPin, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  thu_cong_admin: { label: 'Quản trị sửa', icon: Laptop, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
  MANUAL: { label: 'Cổng Web', icon: Smartphone, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  system_auto: { label: 'Tự động', icon: Zap, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  SYSTEM: { label: 'Tự động', icon: Zap, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/uploads/')) return `/api${url}`;
  if (url.startsWith('uploads/')) return `/api/${url}`;
  const clean = url.replace(/^\/+/, '');
  return `/api/uploads/${clean}`;
}

// =============================================================================
// MAIN COMPONENT: ATTENDANCE ME
// =============================================================================

export const AttendanceMe: React.FC = () => {
  const { user } = useAuthStore();

  // Current selected month & year (mặc định tháng & năm hiện tại)
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // View mode: 'table' (bảng danh sách) | 'calendar' (lịch tháng trực quan)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Data states
  const [records, setRecords] = useState<AttendanceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [liveClock, setLiveClock] = useState<string>(new Date().toLocaleTimeString('vi-VN'));

  // Modals state
  const [scannerMode, setScannerMode] = useState<'check-in' | 'check-out' | null>(null);
  const [selectedLog, setSelectedLog] = useState<AttendanceHistoryItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualAction, setManualAction] = useState<'check-in' | 'check-out'>('check-in');
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrInputToken, setQrInputToken] = useState<string>('');
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [campusDistance, setCampusDistance] = useState<number | null>(null);

  // Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động lấy tọa độ GPS của trình duyệt
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });

          // Tính khoảng cách sơ bộ tới Phenikaa Campus (20.9632, 105.7472)
          const R = 6371e3; // metres
          const φ1 = (lat * Math.PI) / 180;
          const φ2 = (20.9632 * Math.PI) / 180;
          const Δφ = ((20.9632 - lat) * Math.PI) / 180;
          const Δλ = ((105.7472 - lng) * Math.PI) / 180;
          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const d = Math.round(R * c);
          setCampusDistance(d);
        },
        () => {
          // Bỏ qua nếu từ chối quyền GPS
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Tính toán khoảng ngày đầu tháng - cuối tháng
  const dateRange = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${selectedYear}-${pad(selectedMonth)}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endStr = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;
    return { from: startStr, to: endStr };
  }, [selectedMonth, selectedYear]);

  // Tải lịch sử chấm công từ Backend API (Bảo đảm 100% chỉ tải dữ liệu của chính bản thân)
  const fetchMyAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUserId = user?._id || (user as any)?.id;
      const res = await attendanceApi.getMyAttendanceHistory({
        from: dateRange.from,
        to: dateRange.to,
        limit: 100,
      });
      // Đảm bảo lọc sạch 100% chỉ giữ bản ghi thuộc về chính bản thân người dùng hiện tại
      const myRecords = (res.records || []).filter((r: any) => {
        if (!currentUserId) return true;
        const recUid = typeof r.userId === 'object' ? r.userId?._id : r.userId;
        return !recUid || String(recUid) === String(currentUserId);
      });
      setRecords(myRecords);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tải lịch sử chấm công.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, user]);

  useEffect(() => {
    fetchMyAttendance();
  }, [fetchMyAttendance]);

  // Điều hướng tháng
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
  };

  // Lọc dữ liệu hiển thị trên Client
  const filteredRecords = useMemo(() => {
    // 1. Khử trùng lặp các bản ghi vắng mặt spam cùng 1 ca / ngày
    const seenAbsentKeys = new Set<string>();

    return records.filter((r) => {
      // Nếu là bản ghi vắng mặt không có check-in, chỉ giữ 1 bản ghi duy nhất cho mỗi ca trong ngày
      if (!r.checkInTime && r.status === 'absent') {
        const key = `${r.workDate}_${r.shiftId?._id || r.shiftId?.name || ''}`;
        if (seenAbsentKeys.has(key)) {
          return false;
        }
        seenAbsentKeys.add(key);
      }

      // Lọc trạng thái
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      // Lọc phương thức
      if (methodFilter !== 'ALL') {
        const m = (r.method || '').toUpperCase();
        if (methodFilter === 'FACE' && !m.includes('FACE')) return false;
        if (methodFilter === 'QR' && !m.includes('QR')) return false;
        if (methodFilter === 'GPS' && !m.includes('GPS')) return false;
        if (methodFilter === 'MANUAL' && !m.includes('MANUAL') && !m.includes('THU_CONG')) return false;
      }
      // Tìm kiếm từ khóa
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const dateMatch = (r.workDate || '').toLowerCase().includes(kw);
        const shiftMatch = (r.shiftId?.name || '').toLowerCase().includes(kw);
        const roomMatch = (r.scheduleId?.roomId || '').toLowerCase().includes(kw);
        const subjectMatch = (r.scheduleId?.subjectId?.name || '').toLowerCase().includes(kw);
        const statusMatch = (STATUS_CONFIG[r.status]?.label || '').toLowerCase().includes(kw);
        if (!dateMatch && !shiftMatch && !roomMatch && !subjectMatch && !statusMatch) {
          return false;
        }
      }
      return true;
    });
  }, [records, statusFilter, methodFilter, searchKeyword]);

  // ===========================================================================
  // EXECUTIVE KPI CALCULATIONS
  // ===========================================================================
  const stats = useMemo(() => {
    const totalRecords = records.length;
    let onTimeCount = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let totalLateMinutes = 0;
    let totalWorkHours = 0;
    let totalTeachingPeriods = 0;
    let fraudCount = 0;

    records.forEach((r) => {
      if (r.status === 'on_time') onTimeCount++;
      else if (r.status === 'late') {
        lateCount++;
        totalLateMinutes += r.lateMinutes || 0;
      } else if (r.status === 'early_leave') earlyLeaveCount++;
      else if (r.status === 'excused_absence') excusedCount++;
      else if (r.status === 'absent') absentCount++;

      if (r.isFraud) fraudCount++;

      if (r.workHours) totalWorkHours += r.workHours;
      else if (r.workDurationMinutes) totalWorkHours += r.workDurationMinutes / 60;

      if (r.actualTeachingPeriods) totalTeachingPeriods += r.actualTeachingPeriods;
    });

    const totalAttended = onTimeCount + lateCount + earlyLeaveCount;
    const requiredDays = totalAttended + absentCount || 1;
    const attendanceRate = Math.min(100, Math.round((totalAttended / requiredDays) * 100));

    return {
      totalRecords,
      totalAttended,
      onTimeCount,
      lateCount,
      earlyLeaveCount,
      absentCount,
      excusedCount,
      totalLateMinutes,
      totalWorkHours: Math.round(totalWorkHours * 10) / 10,
      totalTeachingPeriods,
      attendanceRate,
      fraudCount,
    };
  }, [records]);

  // ===========================================================================
  // HANDLERS: MANUAL CHECK-IN & CHECK-OUT & QR SCAN
  // ===========================================================================
  const handleManualPunch = async () => {
    setIsSubmittingManual(true);
    try {
      const payload: any = {
        method: 'manual',
        deviceId: 'WEB_PORTAL',
      };
      if (coords) {
        payload.location = { lat: coords.lat, lng: coords.lng };
      }

      if (manualAction === 'check-in') {
        const res = await attendanceApi.manualCheckIn(payload);
        toast.success(res.message || 'Check-in thành công!');
      } else {
        const res = await attendanceApi.manualCheckOut(payload);
        toast.success(res.message || 'Check-out thành công!');
      }
      setIsManualModalOpen(false);
      fetchMyAttendance();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Điểm danh không thành công.';
      toast.error(msg);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleScanQrSubmit = async () => {
    if (!qrInputToken.trim()) {
      toast.error('Vui lòng nhập hoặc dán mã QR Token.');
      return;
    }
    setIsSubmittingManual(true);
    try {
      const payload: any = {
        qrToken: qrInputToken.trim(),
        deviceId: 'WEB_SCANNER',
      };
      if (coords) {
        payload.location = { lat: coords.lat, lng: coords.lng };
      }
      const res = await attendanceApi.scanQRCode(payload);
      toast.success(res.message || 'Điểm danh bằng mã QR thành công!');
      setIsQrModalOpen(false);
      setQrInputToken('');
      fetchMyAttendance();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Mã QR không hợp lệ hoặc đã hết hạn.';
      toast.error(msg);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Xuất file Excel (.xlsx) báo cáo bảng công cá nhân chuẩn hóa
  const handleExportExcel = () => {
    if (!records.length) {
      toast.error('Không có dữ liệu chấm công để xuất file.');
      return;
    }

    try {
      const dataRows = records.map((r, idx) => {
        const shiftName = r.shiftId?.name || '—';
        const room = r.scheduleId?.roomId || '—';
        const checkIn = r.checkInTime ? formatTimeVN(r.checkInTime) : '—';
        const checkOut = r.checkOutTime ? formatTimeVN(r.checkOutTime) : '—';
        const statusLabel = STATUS_CONFIG[r.status]?.label || r.status;
        const methodLabel = METHOD_CONFIG[r.method || '']?.label || r.method || '—';

        return {
          'STT': idx + 1,
          'Ngày Công': r.workDate,
          'Thứ': formatWeekdayShort(r.workDate),
          'Ca Làm Việc': shiftName,
          'Giảng Đường / Phòng': room,
          'Giờ Vào (Check-In)': checkIn,
          'Giờ Ra (Check-Out)': checkOut,
          'Đi Muộn (Phút)': r.lateMinutes || 0,
          'Về Sớm (Phút)': r.earlyExitMinutes || 0,
          'Số Giờ Công': r.workHours || 0,
          'Số Tiết Dạy': r.actualTeachingPeriods || 0,
          'Trạng Thái': statusLabel,
          'Phương Thức': methodLabel,
          'Ghi Chú': r.isFraud ? 'Phát hiện gian lận vị trí' : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 8 },
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 24 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Tháng ${selectedMonth}-${selectedYear}`);

      const cleanUserName = (user?.fullName || 'Ca_Nhan').replace(/[^a-zA-Z0-9_À-ỹ]/g, '_');
      const fileName = `Bang_Cham_Cong_${cleanUserName}_T${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Bảng công cá nhân (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất bảng công Excel:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // In bảng công
  const handlePrint = () => {
    window.print();
  };

  // ===========================================================================
  // CALENDAR GENERATION (Chế độ xem Lịch Tháng)
  // ===========================================================================
  const calendarDays = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth; // 1-indexed

    // Ngày đầu tiên của tháng (0 = CN, 1 = T2, ...)
    const firstDay = new Date(year, month - 1, 1).getDay();
    // Chuyển về T2 là ngày bắt đầu tuần (0 = T2, ..., 6 = CN)
    const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

    // Tổng số ngày trong tháng hiện tại
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    // Tổng số ngày tháng trước
    const totalDaysInPrevMonth = new Date(year, month - 1, 0).getDate();

    // Map records theo workDate (YYYY-MM-DD)
    const recordMap = new Map<string, AttendanceHistoryItem[]>();
    records.forEach((r) => {
      const key = r.workDate;
      if (!recordMap.has(key)) {
        recordMap.set(key, []);
      }
      recordMap.get(key)!.push(r);
    });

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSunday: boolean;
      records: AttendanceHistoryItem[];
    }> = [];

    // Các ngày đệm đầu tháng (tháng trước)
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: false,
        isSunday: false,
        records: [],
      });
    }

    // Các ngày trong tháng hiện tại
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSunday: dayOfWeek === 0,
        records: recordMap.get(dateStr) || [],
      });
    }

    // Các ngày đệm cuối tháng (tháng sau) để đủ lưới 35 hoặc 42 ô
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: false,
        isSunday: false,
        records: [],
      });
    }

    return days;
  }, [selectedYear, selectedMonth, records, today]);

  return (
    <div className="space-y-6 pb-12">
      {/* =====================================================================
          1. HEADER CARD: NHÂN SỰ & HÀNH ĐỘNG SINH TRẮC HỌC REALTIME
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3 h-3" />
              Sinh Trắc Học AI CSDL v2.5
            </span>
            {user?.staffCode && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-semibold border border-slate-200 dark:border-slate-700">
                {user.staffCode}
              </span>
            )}
            {campusDistance !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <MapPin className="w-3 h-3" />
                Cách trường ~{campusDistance}m
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            {user?.fullName || 'Cán Bộ Giảng Viên'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {typeof user?.departmentId === 'object' && user?.departmentId
                ? (user.departmentId as any).name || 'Khoa / Đơn vị công tác'
                : typeof user?.departmentId === 'string'
                ? user.departmentId
                : 'Khoa / Đơn vị công tác'}
            </span>
            <span>•</span>
            <span className="text-brand-600 dark:text-brand-400 font-medium">
              {typeof user?.role === 'string' ? user.role.toUpperCase() : 'GIẢNG VIÊN'}
            </span>
            <span>•</span>
            <span className="font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {liveClock} (Hôm nay: {formatDateVN(today)})
            </span>
          </p>
        </div>

        {/* Cụm nút hành động điểm danh nhanh */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setScannerMode('check-in')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all"
          >
            <ScanFace className="w-4 h-4" />
            <span>Vào Ca (FaceID)</span>
          </button>

          <button
            onClick={() => setScannerMode('check-out')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all"
          >
            <ScanFace className="w-4 h-4 text-cyan-400" />
            <span>Tan Ca (FaceID)</span>
          </button>

          <button
            onClick={() => {
              setManualAction('check-in');
              setIsManualModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold active:scale-95 transition-all"
            title="Điểm danh Web / GPS"
          >
            <Laptop className="w-4 h-4 text-slate-500" />
            <span>Cổng Web</span>
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold active:scale-95 transition-all"
            title="Quét mã QR TOTP động"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Quét QR</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. EXECUTIVE KPI CARDS: CHỈ SỐ CHUYÊN CẦN TRONG THÁNG
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chuyên cần & Số ngày có mặt */}
        <div className="card p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tỷ Lệ Chuyên Cần
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats.attendanceRate}%
                </span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {stats.totalAttended} / {stats.totalAttended + stats.absentCount} ngày
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000"
                style={{ width: `${stats.attendanceRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex justify-between">
              <span>Đúng giờ: <strong>{stats.onTimeCount}</strong></span>
              <span>Đi muộn: <strong>{stats.lateCount}</strong></span>
            </p>
          </div>
        </div>

        {/* Card 2: Đi muộn & Về sớm */}
        <div className="card p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Đi Muộn & Về Sớm
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats.lateCount}
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  lượt muộn
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tổng trễ: <strong className="text-amber-600 font-bold">{stats.totalLateMinutes}p</strong></span>
            <span>Về sớm: <strong className="text-orange-600 font-bold">{stats.earlyLeaveCount}</strong></span>
          </div>
        </div>

        {/* Card 3: Tổng giờ công & Tiết dạy */}
        <div className="card p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-indigo-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tổng Giờ Công Tích Lũy
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats.totalWorkHours}
                </span>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  giờ công
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Số tiết thực dạy: <strong className="text-indigo-600 font-bold">{stats.totalTeachingPeriods} tiết</strong></span>
            <span>Tháng {selectedMonth}/{selectedYear}</span>
          </div>
        </div>

        {/* Card 4: Nghỉ phép & Vắng mặt */}
        <div className="card p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-rose-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nghỉ Phép & Vắng Mặt
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800 dark:text-white">
                  {stats.absentCount}
                </span>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  buổi vắng
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <XCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Nghỉ có phép: <strong className="text-blue-600 font-bold">{stats.excusedCount}</strong></span>
            {stats.fraudCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> {stats.fraudCount} vi phạm
              </span>
            ) : (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> An toàn
              </span>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. TOOLBAR: ĐIỀU HƯỚNG THÁNG, BỘ LỌC & CHẾ ĐỘ XEM
      ===================================================================== */}
      <div className="card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Nhóm điều hướng tháng */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Tháng {selectedMonth} / {selectedYear}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToCurrentMonth}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Hôm nay
          </button>

          {/* Ô tìm kiếm từ khóa */}
          <div className="relative flex-1 sm:w-60 min-w-[160px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm ca, phòng, môn..."
              className="form-input pl-9 pr-8 py-1.5 text-xs rounded-xl"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Nhóm bộ lọc trạng thái, phương thức và chuyển đổi View Mode */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Lọc Trạng thái */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input py-1.5 text-xs rounded-xl w-auto"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="on_time">Đúng giờ</option>
            <option value="late">Đi muộn</option>
            <option value="early_leave">Về sớm</option>
            <option value="excused_absence">Nghỉ có phép</option>
            <option value="absent">Vắng mặt</option>
          </select>

          {/* Lọc Phương thức */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="form-input py-1.5 text-xs rounded-xl w-auto hidden sm:inline-block"
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="FACE">FaceID</option>
            <option value="QR">Mã QR</option>
            <option value="GPS">GPS Mobile</option>
            <option value="MANUAL">Cổng Web / Thủ công</option>
          </select>

          {/* Switcher chế độ hiển thị: Bảng vs Lịch */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Danh Sách</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Lịch Tháng</span>
            </button>
          </div>

          {/* Nút xuất Excel & In */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
            title="Xuất bảng công cá nhân ra file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Xuất Excel (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="In bảng công"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={fetchMyAttendance}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* =====================================================================
          4. VIEW MODE 1: CHẾ ĐỘ BẢNG DỮ LIỆU CHI TIẾT (TABLE VIEW)
      ===================================================================== */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-2.5 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-[150px]">Ngày Điểm Danh</th>
                  <th className="py-3 px-3">Ca Làm Việc & Địa Điểm</th>
                  <th className="py-3 px-3 w-[95px] whitespace-nowrap">Giờ Vào</th>
                  <th className="py-3 px-3 w-[110px] whitespace-nowrap">Giờ Ra</th>
                  <th className="py-3 px-3 w-[85px] whitespace-nowrap">Thời Lượng</th>
                  <th className="py-3 px-3 w-[115px] whitespace-nowrap">Trạng Thái</th>
                  <th className="py-3 px-3 w-[125px] whitespace-nowrap">Phương Thức</th>
                  <th className="py-3 px-2 text-center w-12">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
                        <p className="text-sm font-medium text-slate-500">Đang tải lịch sử chấm công...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Chưa có bản ghi chấm công nào phù hợp
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Thử đổi bộ lọc hoặc chọn tháng khác để xem lịch sử làm việc.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => {
                    const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.on_time;
                    const methodKey = r.method || '';
                    const methodCfg =
                      METHOD_CONFIG[methodKey] ||
                      METHOD_CONFIG[methodKey.toUpperCase()] ||
                      METHOD_CONFIG.MANUAL;
                    const isTodayRecord = r.workDate === today.toISOString().split('T')[0];
                    const hasPunched = Boolean(r.checkInTime);

                    return (
                      <tr
                        key={r._id || idx}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs ${
                          isTodayRecord ? 'bg-brand-50/25 dark:bg-brand-950/20 font-medium' : ''
                        }`}
                      >
                        {/* 1. STT */}
                        <td className="py-3 px-2.5 text-center font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. Ngày Điểm Danh */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                {formatDateOnlyVN(r.workDate)}
                              </span>
                              {isTodayRecord && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                                  Hôm nay
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {getWeekdayLongVN(r.workDate)}
                            </span>
                          </div>
                        </td>

                        {/* 3. Ca Làm Việc & Địa Điểm */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[200px] md:max-w-[260px] lg:max-w-[340px]"
                              title={cleanShiftName(r.shiftId?.name)}
                            >
                              {cleanShiftName(r.shiftId?.name) || 'Ca làm việc tiêu chuẩn'}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {r.scheduleId?.roomId && (
                                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                                  <MapPin className="w-2.5 h-2.5 text-brand-500" />
                                  {r.scheduleId.roomId}
                                </span>
                              )}
                              {r.shiftId?.startTime && (
                                <span className="font-mono text-slate-400 text-[10px]">
                                  {r.shiftId.startTime} - {r.shiftId.endTime}
                                </span>
                              )}
                              {r.scheduleId?.subjectId?.name && (
                                <span
                                  className="text-slate-400 text-[10px] truncate max-w-[140px]"
                                  title={r.scheduleId.subjectId.name}
                                >
                                  • {r.scheduleId.subjectId.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. Giờ Vào */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {r.checkInTime ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {formatShortTime(r.checkInTime)}
                              </span>
                              {r.lateMinutes && r.lateMinutes > 0 ? (
                                <span
                                  className="px-1 py-0.2 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  title={`Muộn ${r.lateMinutes} phút`}
                                >
                                  +{r.lateMinutes}p
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 5. Giờ Ra */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {r.checkOutTime ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {formatShortTime(r.checkOutTime)}
                              </span>
                              {r.earlyExitMinutes && r.earlyExitMinutes > 0 ? (
                                <span
                                  className="px-1 py-0.2 rounded text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800"
                                  title={`Về sớm ${r.earlyExitMinutes} phút`}
                                >
                                  -{r.earlyExitMinutes}p
                                </span>
                              ) : null}
                            </div>
                          ) : r.checkInTime ? (
                            isTodayRecord ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Đang làm việc
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                Chưa check-out
                              </span>
                            )
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 6. Thời Lượng */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {hasPunched && (r.workHours || r.workDurationMinutes) ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {r.workHours ? `${r.workHours}h` : formatMinutes(r.workDurationMinutes)}
                              </span>
                              {r.actualTeachingPeriods ? (
                                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                                  {r.actualTeachingPeriods} tiết
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 7. Trạng Thái */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.badgeCls}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                              {statusCfg.label}
                            </span>
                            {r.isManualOverride && (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                Quản trị sửa
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Phương Thức */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {hasPunched ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${methodCfg.bg} ${methodCfg.color}`}
                              >
                                <methodCfg.icon className="w-3 h-3" />
                                {methodCfg.label}
                              </span>
                              {r.capturedImage && (
                                <button
                                  onClick={() => setPreviewImage(resolveMediaUrl(r.capturedImage))}
                                  className="w-6 h-6 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-brand-500 transition-all flex-shrink-0 relative group bg-slate-100 flex items-center justify-center shadow-2xs"
                                  title="Xem ảnh chụp đối soát"
                                >
                                  <img
                                    src={resolveMediaUrl(r.capturedImage)}
                                    alt="Minh chứng"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <Eye className="w-2.5 h-2.5 text-slate-400 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 9. Thao Tác Chi Tiết */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            title="Xem chi tiết lượt chấm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. VIEW MODE 2: CHẾ ĐỘ LỊCH THÁNG TRỰC QUAN (CALENDAR VIEW)
      ===================================================================== */}
      {viewMode === 'calendar' && (
        <div className="card p-5 shadow-sm space-y-4">
          {/* Tiêu đề thứ trong tuần */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>Thứ Hai</div>
            <div>Thứ Ba</div>
            <div>Thứ Tư</div>
            <div>Thứ Năm</div>
            <div>Thứ Sáu</div>
            <div>Thứ Bảy</div>
            <div className="text-rose-500">Chủ Nhật</div>
          </div>

          {/* Lưới các ô ngày trong tháng */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell, idx) => {
              const hasRecords = cell.records.length > 0;
              const primaryRecord = cell.records[0];
              const statusCfg = primaryRecord ? STATUS_CONFIG[primaryRecord.status] || STATUS_CONFIG.on_time : null;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (primaryRecord) setSelectedLog(primaryRecord);
                  }}
                  className={`min-h-[95px] p-2 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    cell.isCurrentMonth
                      ? cell.isToday
                        ? 'bg-indigo-50/50 border-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-600 shadow-sm'
                        : cell.isSunday
                        ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                      : 'bg-slate-100/40 dark:bg-slate-950/40 border-slate-100 dark:border-slate-900 opacity-40'
                  } ${hasRecords ? 'cursor-pointer hover:shadow-md' : ''}`}
                >
                  {/* Hàng trên: Số ngày & nhãn Hôm nay */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold ${
                        cell.isToday
                          ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs'
                          : cell.isSunday
                          ? 'text-rose-500'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {hasRecords && cell.records.length > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {cell.records.length} ca
                      </span>
                    )}
                  </div>

                  {/* Phần thân: Chip trạng thái hoặc thông tin chấm công */}
                  {hasRecords && statusCfg ? (
                    <div className="space-y-1 my-1">
                      <div className={`px-2 py-1 rounded-xl text-[11px] font-bold border truncate ${statusCfg.badgeCls}`}>
                        {statusCfg.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate flex items-center justify-between">
                        <span>Vào: {formatShortTime(primaryRecord.checkInTime)}</span>
                        <span>Ra: {formatShortTime(primaryRecord.checkOutTime)}</span>
                      </div>
                    </div>
                  ) : cell.isSunday ? (
                    <span className="text-[10px] text-slate-400 italic">Nghỉ tuần</span>
                  ) : (
                    <div />
                  )}

                  {/* Hàng dưới: Số giờ công tích lũy */}
                  {hasRecords && primaryRecord?.workHours ? (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 self-end">
                      +{primaryRecord.workHours}h
                    </span>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. MODAL 1: CHI TIẾT BẢN GHI CHẤM CÔNG & NHẬT KÝ QUẸT THẺ (PUNCH LOGS)
      ===================================================================== */}
      {selectedLog && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Chi Tiết Chấm Công Ngày {formatDateVN(selectedLog.workDate)}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedLog._id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cảnh báo vi phạm gian lận nếu có */}
            {selectedLog.isFraud && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-800 dark:text-rose-200">
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Cảnh Báo Phát Hiện Gian Lận Điểm Danh</p>
                  <p className="text-xs mt-1 text-rose-700 dark:text-rose-300">
                    {selectedLog.fraudReason || 'Phát hiện vị trí chấm công vượt quá bán kính Geofence khuôn viên trường.'}
                  </p>
                </div>
              </div>
            )}

            {/* Thông tin tóm tắt ca làm việc */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <p className="text-xs text-slate-500">Ca Làm Việc</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedLog.shiftId?.name || 'Ca chuẩn'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Giảng Đường</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {selectedLog.scheduleId?.roomId || 'Phòng làm việc'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Giờ Check-In</p>
                <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                  {formatTimeVN(selectedLog.checkInTime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Giờ Check-Out</p>
                <p className="text-sm font-bold font-mono text-cyan-600 mt-0.5">
                  {formatTimeVN(selectedLog.checkOutTime)}
                </p>
              </div>
            </div>

            {/* Bảng kê chi tiết các lượt quẹt thô PunchLog */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Nhật Ký Quẹt Thẻ Sinh Trắc Học Thực Tế ({selectedLog.punchLogIds?.length || 0} lượt)
              </h4>

              {selectedLog.punchLogIds && selectedLog.punchLogIds.length > 0 ? (
                <div className="space-y-2.5">
                  {selectedLog.punchLogIds.map((p, pIdx) => (
                    <div
                      key={p._id || pIdx}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider ${
                            p.punchType === 'check_in'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                          }`}
                        >
                          {p.punchType === 'check_in' ? 'VÀO CA' : 'TAN CA'}
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatTimeVN(p.punchTime)}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Phương thức: {p.method || 'face_ai'} • Thiết bị: {p.deviceId || 'TERMINAL_DEFAULT'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        {p.confidenceScore !== undefined && p.confidenceScore !== null && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Độ tin cậy: {Math.round(p.confidenceScore * 100)}%
                          </span>
                        )}
                        {p.livenessScore !== undefined && p.livenessScore !== null && (
                          <span className="text-[11px] text-slate-500">
                            Liveness: {Math.round(p.livenessScore * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Không có bản ghi lượt quẹt thô nào đi kèm.</p>
              )}
            </div>

            {/* Ảnh chụp minh chứng */}
            {selectedLog.capturedImage && (
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Ảnh Chụp Minh Chứng Điểm Danh
                </h4>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs">
                  <img
                    src={resolveMediaUrl(selectedLog.capturedImage)}
                    alt="Captured Evidence"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={() => setPreviewImage(resolveMediaUrl(selectedLog.capturedImage))}
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-xs font-semibold backdrop-blur-xs flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> Phóng to
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* =====================================================================
          7. MODAL 2: ĐIỂM DANH THỦ CÔNG QUA WEB / GPS
      ===================================================================== */}
      {isManualModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Điểm Danh Cổng Web
                </h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chọn hành động Check-in hay Check-out */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-2">
                Hành Động Điểm Danh
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualAction('check-in')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    manualAction === 'check-in'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Vào Ca (Check-In)
                </button>
                <button
                  type="button"
                  onClick={() => setManualAction('check-out')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    manualAction === 'check-out'
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Tan Ca (Check-Out)
                </button>
              </div>
            </div>

            {/* Tọa độ Geolocation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  Vị trí GPS Hiện Tại:
                </span>
                {coords ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-amber-500 italic">Đang lấy tọa độ...</span>
                )}
              </div>
              {campusDistance !== null && (
                <p className="text-[11px] text-slate-400">
                  Khoảng cách tới Phenikaa Campus: ~{campusDistance} mét
                </p>
              )}
            </div>

            <p className="text-xs text-slate-400">
              * Hệ thống sẽ tự động đối soát ca làm việc và lịch công tác phù hợp của bạn trong ngày hôm nay.
            </p>

            <div className="pt-2 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setIsManualModalOpen(false)}
                disabled={isSubmittingManual}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleManualPunch}
                isLoading={isSubmittingManual}
              >
                Xác Nhận Điểm Danh
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* =====================================================================
          8. MODAL 3: QUÉT MÃ QR TOTP ĐỘNG
      ===================================================================== */}
      {isQrModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 border border-slate-200/90 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quét Mã QR Động
                </h3>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhập mã Token từ mã QR động hiển thị trên máy chiếu giảng đường hoặc màn hình thiết bị chấm công (hiệu lực 20 giây):
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                QR Token TOTP
              </label>
              <input
                type="text"
                value={qrInputToken}
                onChange={(e) => setQrInputToken(e.target.value)}
                placeholder="Dán mã QR token vào đây..."
                className="form-input text-sm font-mono rounded-xl"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setIsQrModalOpen(false)}
                disabled={isSubmittingManual}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleScanQrSubmit}
                isLoading={isSubmittingManual}
              >
                Xác Nhận Quét QR
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* =====================================================================
          9. MODAL 4: PHÓNG TO ẢNH MINH CHỨNG (LIGHTBOX)
      ===================================================================== */}
      {previewImage && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
          >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        </Portal>
      )}

      {/* =====================================================================
          10. SCANNER MODAL: CAMERA QUÉT KHUÔN MẶT REALTIME
      ===================================================================== */}
      {scannerMode && (
        <FaceAttendanceScannerModal
          isOpen={!!scannerMode}
          mode={scannerMode}
          onClose={() => setScannerMode(null)}
          onSuccess={() => {
            setScannerMode(null);
            fetchMyAttendance();
            toast.success('Chấm công khuôn mặt thành công!');
          }}
        />
      )}
    </div>
  );
};
