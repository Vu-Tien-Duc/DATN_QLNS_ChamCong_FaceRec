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
  Eye,
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
  Send,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { Portal } from '../../components/chung/CongDichChuyen';
import { Badge } from '../../components/chung/NhanTrangThai';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';
import { getRoleLabel, hasRole } from '../../utils/phanQuyen';
import {
  attendanceApi,
  AttendanceHistoryItem,
  AttendancePunchLogItem,
} from '../../api/chamCong.api';
import { FaceAttendanceScannerModal } from '../../components/sinhTracHoc/ModalQuetChamCong';
import { leaveRequestApi } from '../../api/donNghiPhep.api';

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
  thieu_check_out: {
    label: 'Thiếu Check-out',
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    dotColor: 'bg-purple-500',
    bgSoft: 'bg-purple-50 dark:bg-purple-950/30',
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
  qr_code: { label: 'Mã QR TOTP', icon: QrCode, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  gps_mobile: { label: 'GPS Mobile', icon: MapPin, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  thu_cong_admin: { label: 'Quản trị sửa', icon: Laptop, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
  system_auto: { label: 'Tự động', icon: Zap, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('/api/tai-tep/tep/')) return url;
  const clean = url.split('/').pop()?.replace(/^\/+/, '') || '';
  return clean ? `/api/tai-tep/tep/${clean}` : '';
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
  const [campusName, setCampusName] = useState<string>('Trường Đại học Nguyễn Trãi (NTU)');

  // State modal giải trình thiếu check-out
  const [giaiTrinhModal, setGiaiTrinhModal] = useState<{ open: boolean; nhat_ky_id: string; ngay: string }>({
    open: false,
    nhat_ky_id: '',
    ngay: '',
  });
  const [giaiTrinhLyDo, setGiaiTrinhLyDo] = useState('');
  const [isSubmittingGiaiTrinh, setIsSubmittingGiaiTrinh] = useState(false);

  // Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động lấy cấu hình khuôn viên & tọa độ GPS của trình duyệt
  useEffect(() => {
    let active = true;
    const initLocation = async () => {
      let targetLat = 20.9752;
      let targetLng = 105.7628;
      try {
        const cfg = await attendanceApi.getCampusConfig();
        if (cfg && active) {
          if (typeof cfg.lat === 'number') targetLat = cfg.lat;
          if (typeof cfg.lng === 'number') targetLng = cfg.lng;
          if (cfg.name) setCampusName(cfg.name);
        }
      } catch {
        // Fallback sang tọa độ mặc định GEOFENCE_TRUONG
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!active) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setCoords({ lat, lng });

            const R = 6371e3;
            const phi1 = (lat * Math.PI) / 180;
            const phi2 = (targetLat * Math.PI) / 180;
            const dPhi = ((targetLat - lat) * Math.PI) / 180;
            const dLambda = ((targetLng - lng) * Math.PI) / 180;
            const a =
              Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setCampusDistance(Math.round(R * c));
          },
          () => {
            // Bỏ qua nếu từ chối quyền GPS
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };
    initLocation();
    return () => {
      active = false;
    };
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
      const currentUserId = user?.id;
      const res = await attendanceApi.getMyAttendanceHistory({
        tu_ngay: dateRange.from,
        den_ngay: dateRange.to,
        gioi_han: 100,
      });
      // Đảm bảo lọc sạch 100% chỉ giữ bản ghi thuộc về chính bản thân người dùng hiện tại
      const myRecords = (res.records || []).filter((r: any) => {
        if (!currentUserId) return true;
        const recUid = r.nguoi_dung_id || r.nguoi_dung?.id;
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
      if (!r.thoi_gian_vao && r.trang_thai === 'absent') {
        const key = `${r.ngay_cong}_${r.ca?.id || r.ca?.ten_ca || r.ca_id || ''}`;
        if (seenAbsentKeys.has(key)) {
          return false;
        }
        seenAbsentKeys.add(key);
      }

      // Lọc trạng thái
      if (statusFilter !== 'ALL' && r.trang_thai !== statusFilter) {
        return false;
      }
      // Lọc phương thức
      if (methodFilter !== 'ALL') {
        const m = String(r.phuong_thuc || r.luot_quet?.[0]?.phuong_thuc || '');
        if (m !== methodFilter) return false;
      }
      // Tìm kiếm từ khóa
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const dateMatch = (r.ngay_cong || '').toLowerCase().includes(kw);
        const shiftMatch = (r.ca?.ten_ca || '').toLowerCase().includes(kw);
        const roomMatch = (r.lich_trinh?.phong_hoc || '').toLowerCase().includes(kw);
        const subjectMatch = (r.lich_trinh?.mon_hoc?.ten_mon || '').toLowerCase().includes(kw);
        const statusMatch = (STATUS_CONFIG[r.trang_thai || '']?.label || '').toLowerCase().includes(kw);
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
      if (r.trang_thai === 'on_time') onTimeCount++;
      else if (r.trang_thai === 'late') {
        lateCount++;
        totalLateMinutes += r.di_muon_phut || 0;
      } else if (r.trang_thai === 'early_leave') earlyLeaveCount++;
      else if (r.trang_thai === 'excused_absence') excusedCount++;
      else if (r.trang_thai === 'absent') absentCount++;

      if (r.co_gian_lan) fraudCount++;

      if (r.thoi_luong_lam_viec_phut) totalWorkHours += r.thoi_luong_lam_viec_phut / 60;

      if (r.so_tiet_thuc_day) totalTeachingPeriods += r.so_tiet_thuc_day;
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
      const payload: {
        phuong_thuc: string;
        thiet_bi_id: string;
        vi_do?: number;
        kinh_do?: number;
      } = {
        phuong_thuc: 'gps_mobile',
        thiet_bi_id: 'WEB_PORTAL',
      };
      if (coords) {
        payload.vi_do = coords.lat;
        payload.kinh_do = coords.lng;
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
        ma_qr: qrInputToken.trim(),
        thiet_bi_id: 'WEB_SCANNER',
      };
      if (coords) {
        payload.toa_do = { vi_do: coords.lat, kinh_do: coords.lng };
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
        const shiftName = r.ca?.ten_ca || '—';
        const room = r.lich_trinh?.phong_hoc || '—';
        const checkIn = r.thoi_gian_vao ? formatTimeVN(r.thoi_gian_vao) : '—';
        const checkOut = r.thoi_gian_ra ? formatTimeVN(r.thoi_gian_ra) : '—';
        const st = r.trang_thai || 'on_time';
        const statusLabel = STATUS_CONFIG[st]?.label || st;
        const mKey = r.phuong_thuc || r.luot_quet?.[0]?.phuong_thuc || '';
        const methodLabel = METHOD_CONFIG[mKey]?.label || mKey || '—';

        return {
          'STT': idx + 1,
          'Ngày Công': r.ngay_cong,
          'Thứ': formatWeekdayShort(r.ngay_cong || ''),
          'Ca Làm Việc': shiftName,
          'Giảng Đường / Phòng': room,
          'Giờ Vào (Check-In)': checkIn,
          'Giờ Ra (Check-Out)': checkOut,
          'Đi Muộn (Phút)': r.di_muon_phut || 0,
          'Về Sớm (Phút)': r.ve_som_phut || 0,
          'Số Giờ Công': r.thoi_luong_lam_viec_phut ? Number((r.thoi_luong_lam_viec_phut / 60).toFixed(2)) : 0,
          'Số Tiết Dạy': r.so_tiet_thuc_day || 0,
          'Trạng Thái': statusLabel,
          'Phương Thức': methodLabel,
          'Ghi Chú': r.co_gian_lan ? 'Phát hiện gian lận vị trí' : '',
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

      const cleanUserName = (user?.ho_ten || 'Ca_Nhan').replace(/[^a-zA-Z0-9_À-ỹ]/g, '_');
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

    // Map records theo ngay_cong (YYYY-MM-DD)
    const recordMap = new Map<string, AttendanceHistoryItem[]>();
    records.forEach((r) => {
      const key = r.ngay_cong || '';
      if (!key) return;
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
      {/* =====================================================================
          1. PERSONAL ATTENDANCE HEADER + QUICK PUNCH ACTIONS
      ===================================================================== */}
      <div className="pb-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
            <span>{user?.ho_ten || 'Cán Bộ Giảng Viên'}</span>
            {user?.ma_can_bo && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-medium">
                {user.ma_can_bo}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {user?.ten_phong_ban || (user as any)?.don_vi_chinh?.ten_phong_ban || 'Khoa / Đơn vị công tác'}
            </span>
            <span>•</span>
            <span className="text-brand-600 dark:text-brand-400 font-medium">
              {getRoleLabel(user?.vai_tro_chinh)}
            </span>
            {campusDistance !== null && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <MapPin className="w-3 h-3" />
                  Cách trường ~{campusDistance}m
                </span>
              </>
            )}
            <span>•</span>
            <span className="font-mono">
              {liveClock} ({formatDateVN(today)})
            </span>
          </p>
        </div>

        {/* Cụm nút hành động điểm danh nhanh */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setScannerMode('check-in')}
            className="h-9 inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-3.5 rounded-full shadow-xs transition-colors cursor-pointer"
          >
            <ScanFace className="w-3.5 h-3.5" />
            <span>Vào ca (FaceID)</span>
          </button>

          <button
            onClick={() => setScannerMode('check-out')}
            className="h-9 inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs px-3.5 rounded-full shadow-xs transition-colors cursor-pointer"
          >
            <ScanFace className="w-3.5 h-3.5 text-cyan-300" />
            <span>Tan ca (FaceID)</span>
          </button>

          <button
            onClick={() => {
              setManualAction('check-in');
              setIsManualModalOpen(true);
            }}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            title="Điểm danh Web / GPS"
          >
            <Laptop className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Cổng Web</span>
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            title="Quét mã QR TOTP động"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Quét QR</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. HÀNG 4 THẺ KPI CHUẨN FACE ID
      ===================================================================== */}
      <CompactStatsBar
        items={[
          {
            label: 'Tỷ lệ chuyên cần',
            value: `${stats.attendanceRate}%`,
            badge: `${stats.totalAttended}/${stats.totalAttended + stats.absentCount} ngày`,
            progress: stats.attendanceRate,
            tone: 'success',
          },
          {
            label: 'Đi muộn / Về sớm',
            value: stats.lateCount,
            badge: `${stats.totalLateMinutes}p trễ`,
            subtext: 'tổng lượt đi muộn trong tháng',
            tone: 'warning',
          },
          {
            label: 'Giờ công tích lũy',
            value: stats.totalWorkHours,
            unit: 'giờ',
            badge: `${stats.totalTeachingPeriods} tiết`,
            subtext: 'công chuẩn & giờ giảng',
            tone: 'brand',
          },
          {
            label: 'Vắng / Nghỉ phép',
            value: stats.absentCount,
            badge: `${stats.excusedCount} có phép`,
            subtext: stats.absentCount > 0 ? 'cần đối soát công' : 'không có buổi vắng',
            tone: stats.fraudCount > 0 ? 'danger' : 'neutral',
          },
        ]}
      />

      {/* =====================================================================
          3. MAIN PERSONAL ATTENDANCE CARD (CHUẨN FACE ID)
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Nhóm điều hướng tháng */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 h-9">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Tháng {selectedMonth} / {selectedYear}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToCurrentMonth}
            className="h-9 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Hôm nay
          </button>

          {/* Ô tìm kiếm từ khóa */}
          <div className="relative flex-1 sm:w-52 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm ca, phòng, môn..."
              className="w-full h-9 pl-9 pr-8 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-all"
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lọc Trạng thái */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="on_time">Đúng giờ</option>
            <option value="late">Đi muộn</option>
            <option value="early_leave">Về sớm</option>
<option value="thieu_check_out">Thiếu check-out</option>
            <option value="excused_absence">Nghỉ có phép</option>
            <option value="absent">Vắng mặt</option>
          </select>

          {/* Lọc Phương thức */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer hidden sm:inline-block"
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="face_ai">FaceID</option>
            <option value="qr_code">Mã QR</option>
            <option value="gps_mobile">GPS Mobile</option>
            <option value="thu_cong_admin">Thủ công / Quản trị</option>
            <option value="system_auto">Hệ thống tự động</option>
          </select>

          {/* Switcher chế độ hiển thị: Bảng vs Lịch */}
          <div className="flex items-center bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl h-9 gap-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Danh sách</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Lịch tháng</span>
            </button>
          </div>

          {/* Nút xuất Excel & In & Làm mới */}
          <button
            onClick={handleExportExcel}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Xuất bảng công cá nhân ra file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title="In bảng công"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchMyAttendance}
            className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* =====================================================================
          4. VIEW MODE 1: CHẾ ĐỘ BẢNG DỮ LIỆU CHI TIẾT (TABLE VIEW)
      ===================================================================== */}
      {viewMode === 'table' && (
        <div className="w-full overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-2.5 w-10 text-center">#</th>
                  <th className="py-2.5 px-3.5 w-[150px]">Ngày Điểm Danh</th>
                  <th className="py-2.5 px-3.5">Ca Làm Việc & Địa Điểm</th>
                  <th className="py-2.5 px-3.5 w-[95px] whitespace-nowrap">Giờ Vào</th>
                  <th className="py-2.5 px-3.5 w-[110px] whitespace-nowrap">Giờ Ra</th>
                  <th className="py-2.5 px-3.5 w-[85px] whitespace-nowrap">Thời Lượng</th>
                  <th className="py-2.5 px-3.5 w-[115px] whitespace-nowrap">Trạng Thái</th>
                  <th className="py-2.5 px-3.5 w-[125px] whitespace-nowrap">Phương Thức</th>
                  <th className="py-3 px-2 text-center w-12">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
                        <p className="text-xs font-medium text-slate-500">Đang tải lịch sử chấm công...</p>
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
                    const statusKey = r.trang_thai || 'on_time';
                    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.on_time;
                    const methodKey =
                      r.luot_quet?.[0]?.phuong_thuc ||
                      r.phuong_thuc ||
                      (r.ghi_de_thu_cong ? 'thu_cong_admin' : '');
                    const methodCfg = METHOD_CONFIG[methodKey] || {
                      label: methodKey || 'Chưa rõ',
                      icon: Clock,
                      color: 'text-slate-500 dark:text-slate-400',
                      bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                    };
                    const logDate = r.ngay_cong;
                    const todayLocalStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const isTodayRecord = logDate === todayLocalStr;
                    const checkInVal = r.thoi_gian_vao;
                    const checkOutVal = r.thoi_gian_ra;
                    const hasPunched = Boolean(checkInVal);
                    const shiftName = cleanShiftName(r.ca?.ten_ca);
                    const shiftStart = r.ca?.gio_bat_dau;
                    const shiftEnd = r.ca?.gio_ket_thuc;
                    const roomName = r.lich_trinh?.phong_hoc;
                    const subjectName = r.lich_trinh?.mon_hoc?.ten_mon;
                    const lateMins = r.di_muon_phut;
                    const earlyMins = r.ve_som_phut;
                    const durationMins = r.thoi_luong_lam_viec_phut;
                    const teachPeriods = r.so_tiet_thuc_day;
                    const capImg = r.anh_minh_chung;

                    return (
                      <tr
                        key={r.id || idx}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs ${
                          isTodayRecord ? 'bg-brand-50/25 dark:bg-brand-950/20 font-medium' : ''
                        }`}
                      >
                        {/* 1. STT */}
                        <td className="py-3 px-2.5 text-center font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. Ngày Điểm Danh */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                {formatDateOnlyVN(logDate)}
                              </span>
                              {isTodayRecord && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                                  Hôm nay
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {getWeekdayLongVN(logDate)}
                            </span>
                          </div>
                        </td>

                        {/* 3. Ca Làm Việc & Địa Điểm */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[200px] md:max-w-[260px] lg:max-w-[340px]"
                              title={shiftName}
                            >
                              {shiftName || 'Ca làm việc tiêu chuẩn'}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {roomName && (
                                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                                  <MapPin className="w-2.5 h-2.5 text-brand-500" />
                                  {roomName}
                                </span>
                              )}
                              {shiftStart && (
                                <span className="font-mono text-slate-400 text-[10px]">
                                  {shiftStart} - {shiftEnd}
                                </span>
                              )}
                              {subjectName && (
                                <span
                                  className="text-slate-400 text-[10px] truncate max-w-[140px]"
                                  title={subjectName}
                                >
                                  • {subjectName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. Giờ Vào */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {checkInVal ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {formatShortTime(checkInVal)}
                              </span>
                              {lateMins && lateMins > 0 ? (
                                <span
                                  className="px-1 py-0.2 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  title={`Muộn ${lateMins} phút`}
                                >
                                  +{lateMins}p
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 5. Giờ Ra */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {checkOutVal ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {formatShortTime(checkOutVal)}
                              </span>
                              {earlyMins && earlyMins > 0 ? (
                                <span
                                  className="px-1 py-0.2 rounded text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800"
                                  title={`Về sớm ${earlyMins} phút`}
                                >
                                  -{earlyMins}p
                                </span>
                              ) : null}
                            </div>
                          ) : checkInVal ? (
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
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {hasPunched && durationMins != null ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {formatMinutes(durationMins)}
                              </span>
                              {teachPeriods ? (
                                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                                  {teachPeriods} tiết
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                          )}
                        </td>

                        {/* 7. Trạng Thái */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.badgeCls}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                              {statusCfg.label}
                            </span>
                            {r.ghi_de_thu_cong && (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                Quản trị sửa
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Phương Thức */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {hasPunched ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${methodCfg.bg} ${methodCfg.color}`}
                              >
                                <methodCfg.icon className="w-3 h-3" />
                                {methodCfg.label}
                              </span>
                              {capImg && (
                                <button
                                  onClick={() => setPreviewImage(resolveMediaUrl(capImg))}
                                  className="w-6 h-6 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-brand-500 transition-all flex-shrink-0 relative group bg-slate-100 flex items-center justify-center shadow-2xs"
                                  title="Xem ảnh chụp đối soát"
                                >
                                  <AnhBaoMat
                                    src={resolveMediaUrl(capImg)}
                                    alt="Minh chứng"
                                    className="w-full h-full object-cover"
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
        <div className="p-5 space-y-4">
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
              const statusCfg = primaryRecord
                ? STATUS_CONFIG[primaryRecord.trang_thai || ''] || STATUS_CONFIG.on_time
                : null;
              const calCheckIn = primaryRecord?.thoi_gian_vao;
              const calCheckOut = primaryRecord?.thoi_gian_ra;
              const calDuration = primaryRecord?.thoi_luong_lam_viec_phut;

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
                        <span>Vào: {formatShortTime(calCheckIn)}</span>
                        <span>Ra: {formatShortTime(calCheckOut)}</span>
                      </div>
                    </div>
                  ) : cell.isSunday ? (
                    <span className="text-[10px] text-slate-400 italic">Nghỉ tuần</span>
                  ) : (
                    <div />
                  )}

                  {/* Hàng dưới: Số giờ công tích lũy */}
                  {hasRecords && calDuration != null ? (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 self-end">
                      {formatMinutes(calDuration)}
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
      </div>

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
                    Chi Tiết Chấm Công Ngày {formatDateVN(selectedLog.ngay_cong)}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cảnh báo vi phạm gian lận hoặc lý do hiệu chỉnh thủ công */}
            {(selectedLog.co_gian_lan || ((selectedLog.nguoi_ghi_de_id || selectedLog.ghi_de_thu_cong) && (selectedLog.ly_do_ghi_de || selectedLog.ly_do_gian_lan))) && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  selectedLog.co_gian_lan
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                }`}
              >
                <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${selectedLog.co_gian_lan ? 'text-rose-600' : 'text-amber-600'}`} />
                <div>
                  <p className="font-bold text-sm">
                    {selectedLog.co_gian_lan ? 'Cảnh Báo Phát Hiện Gian Lận Điểm Danh' : 'Lý Do Hiệu Chỉnh / Ghi Đè Công'}
                  </p>
                  <p className={`text-xs mt-1 ${selectedLog.co_gian_lan ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {selectedLog.ly_do_gian_lan || selectedLog.ly_do_ghi_de || 'Phát hiện vị trí chấm công vượt quá bán kính Geofence khuôn viên trường.'}
                  </p>
                </div>
              </div>
            )}

            {selectedLog.trang_thai === 'thieu_check_out' && (
              <div className="flex gap-3 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">Thiếu check-out</p>
                  <p className="text-xs mt-1">
                    Bạn đã check-in nhưng chưa check-out khối ca này. Công chưa được tính, vui lòng gửi đơn giải trình để cấp trên duyệt.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedLog.id) return;
                      setGiaiTrinhLyDo('');
                      setGiaiTrinhModal({
                        open: true,
                        nhat_ky_id: String(selectedLog.id),
                        ngay: String(selectedLog.ngay_cong || ''),
                      });
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Gửi đơn giải trình
                  </button>
                </div>
              </div>
            )}

            {/* Thông tin tóm tắt ca làm việc */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <p className="text-xs text-slate-500">Ca Làm Việc</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {cleanShiftName(selectedLog.ca?.ten_ca) || 'Ca chuẩn'}
                </p>
                {selectedLog.ca?.gio_bat_dau && (
                  <p className="text-[11px] font-mono text-slate-500">
                    {selectedLog.ca.gio_bat_dau}–{selectedLog.ca.gio_ket_thuc}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Lịch / Giảng Đường</p>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {(() => {
                    const sch = selectedLog.lich_trinh;
                    if (!sch || typeof sch !== 'object') return 'Phòng làm việc';
                    const weekdayLabels = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                    const subj = sch.mon_hoc?.ten_mon || '';
                    const room = sch.phong_hoc || 'Phòng làm việc';
                    const wdIdx = sch.thu_trong_tuan;
                    const wd = wdIdx !== undefined && wdIdx !== null ? weekdayLabels[Number(wdIdx)] || '' : '';
                    const startP = sch.tiet_bat_dau;
                    const pCount = sch.so_tiet;
                    const periods = startP && pCount
                      ? `Tiết ${startP}–${Number(startP) + Number(pCount) - 1}`
                      : '';
                    return [subj, room, wd, periods].filter(Boolean).join(' • ');
                  })()}
                </p>
                {Array.isArray(selectedLog.ds_lich_trinh_id) && selectedLog.ds_lich_trinh_id.length > 1 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Khối gồm {selectedLog.ds_lich_trinh_id.length} ca liên tục, điểm danh một lần
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Giờ Check-In</p>
                <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                  {formatTimeVN(selectedLog.thoi_gian_vao)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Giờ Check-Out</p>
                <p className="text-sm font-bold font-mono text-cyan-600 mt-0.5">
                  {formatTimeVN(selectedLog.thoi_gian_ra)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Giờ công / Số tiết / Chốt công</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {selectedLog.thoi_luong_lam_viec_phut != null
                    ? formatMinutes(selectedLog.thoi_luong_lam_viec_phut)
                    : '0m'}{' '}
                  • {selectedLog.so_tiet_thuc_day ?? 0} tiết •{' '}
                  <span className={selectedLog.da_chot ? 'text-emerald-600' : 'text-amber-600'}>
                    {selectedLog.da_chot ? 'Đã chốt công' : 'Chưa chốt'}
                  </span>
                </p>
              </div>
              {selectedLog.nguoi_ghi_de && (
                <div>
                  <p className="text-xs text-slate-500">Người hiệu chỉnh</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {selectedLog.nguoi_ghi_de.ho_ten || 'Quản trị viên'}
                  </p>
                </div>
              )}
              {(selectedLog.don_nghi_phep || selectedLog.don_tu || selectedLog.don_tu_id) && (
                <div>
                  <p className="text-xs text-slate-500">Đơn từ liên kết</p>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 font-mono truncate">
                    {(() => {
                      const lr = selectedLog.don_nghi_phep || selectedLog.don_tu;
                      if (!lr) return String(selectedLog.don_tu_id).slice(0, 8);
                      const dateRange =
                        lr.ngay_bat_dau && lr.ngay_ket_thuc
                          ? ` • ${String(lr.ngay_bat_dau).slice(0, 10)} → ${String(lr.ngay_ket_thuc).slice(0, 10)}`
                          : '';
                      return `${lr.loai_don || 'Đơn'} (${lr.trang_thai || ''})${dateRange}`;
                    })()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">Ngày tạo bản ghi</p>
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                  {selectedLog.tao_luc ? new Date(selectedLog.tao_luc).toLocaleString('vi-VN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cập nhật gần nhất</p>
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                  {selectedLog.cap_nhat_luc ? new Date(selectedLog.cap_nhat_luc).toLocaleString('vi-VN') : '—'}
                </p>
              </div>
            </div>

            {/* Bảng kê chi tiết các lượt quẹt thô PunchLog */}
            <div>
              {(() => {
                const punchList = selectedLog.luot_quet || [];
                return (
                  <>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-500" />
                      Nhật Ký Quẹt Thẻ Sinh Trắc Học Thực Tế ({punchList.length} lượt)
                    </h4>

                    {punchList.length > 0 ? (
                      <div className="space-y-2.5">
                        {punchList.map((p, pIdx) => {
                          const isCheckIn = p.loai_quet === 'check_in';
                          const punchTimeVal = p.thoi_gian_quet;
                          const methodStr = p.phuong_thuc || 'face_ai';
                          const deviceStr = p.ma_thiet_bi || 'TERMINAL_DEFAULT';
                          const angleStr = p.goc_mat_nhan_dien;
                          const distM = p.khoang_cach_met;
                          const gpsAcc = p.do_chinh_xac_gps;
                          const latVal = p.vi_do;
                          const lngVal = p.kinh_do;
                          const isMock = p.vi_tri_gia_lap;
                          const isValidLog = p.hop_le;
                          const invalidMsg = p.ly_do_khong_hop_le;
                          const aiConf = p.do_tin_cay_ai;
                          const liveness = p.diem_mat_that;

                          return (
                            <div
                              key={p.id || pIdx}
                              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <span
                                  className={`px-2 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider shrink-0 ${
                                    isCheckIn
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                                  }`}
                                >
                                  {isCheckIn ? 'VÀO CA' : 'TAN CA'}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {formatTimeVN(punchTimeVal)}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Phương thức: {methodStr} • Thiết bị: {deviceStr}
                                    {angleStr ? ` • Góc mặt: ${angleStr}` : ''}
                                  </p>
                                  {(distM != null || gpsAcc != null || (latVal != null && lngVal != null)) && (
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                      {distM != null ? `Khoảng cách GPS: ${Math.round(distM)}m` : ''}
                                      {distM != null && gpsAcc != null ? ' • ' : ''}
                                      {gpsAcc != null ? `Sai số GPS: ±${Math.round(gpsAcc)}m` : ''}
                                      {(distM != null || gpsAcc != null) && latVal != null && lngVal != null ? ' • ' : ''}
                                      {latVal != null && lngVal != null
                                        ? `Tọa độ: ${Number(latVal).toFixed(5)}, ${Number(lngVal).toFixed(5)}`
                                        : ''}
                                    </p>
                                  )}
                                  {(isMock || isValidLog === false) && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                      {isMock ? 'Cảnh báo giả lập vị trí (Mock GPS)' : ''}
                                      {isMock && invalidMsg ? ' • ' : ''}
                                      {invalidMsg || (isValidLog === false ? 'Lượt quét không hợp lệ' : '')}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                {aiConf !== undefined && aiConf !== null && (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    Độ tin cậy: {Math.round(aiConf * 100)}%
                                  </span>
                                )}
                                {liveness !== undefined && liveness !== null && (
                                  <span className="text-[11px] text-slate-500">
                                    Liveness: {Math.round(liveness * 100)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Không có bản ghi lượt quẹt thô nào đi kèm.</p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Ảnh chụp minh chứng */}
            {selectedLog.anh_minh_chung && (
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Ảnh Chụp Minh Chứng Điểm Danh
                </h4>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs min-h-[8rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <AnhBaoMat
                    src={resolveMediaUrl(selectedLog.anh_minh_chung)}
                    alt="Captured Evidence"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={() => setPreviewImage(resolveMediaUrl(selectedLog.anh_minh_chung))}
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
                  Khoảng cách tới {campusName}: ~{campusDistance} mét
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
            <AnhBaoMat
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
      {/* =====================================================================
          MODAL GIẢI TRÌNH THIẾU CHECK-OUT
      ===================================================================== */}
      {giaiTrinhModal.open && (
        <Portal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Gửi đơn giải trình thiếu check-out</h3>
                <button
                  type="button"
                  onClick={() => setGiaiTrinhModal({ open: false, nhat_ky_id: '', ngay: '' })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ngày công: <strong className="text-slate-700 dark:text-slate-200">{giaiTrinhModal.ngay || '—'}</strong>
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Lý do giải trình <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={giaiTrinhLyDo}
                  onChange={(e) => setGiaiTrinhLyDo(e.target.value)}
                  rows={4}
                  placeholder="Mô tả lý do bạn không thể check-out (ví dụ: quên, hệ thống lỗi, ra muộn vì họp...)..."
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">{giaiTrinhLyDo.length}/500 ký tự (tối thiểu 10)</p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setGiaiTrinhModal({ open: false, nhat_ky_id: '', ngay: '' })}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSubmittingGiaiTrinh || giaiTrinhLyDo.trim().length < 10}
                  onClick={async () => {
                    if (giaiTrinhLyDo.trim().length < 10) {
                      toast.error('Lý do phải có ít nhất 10 ký tự.');
                      return;
                    }
                    setIsSubmittingGiaiTrinh(true);
                    try {
                      await leaveRequestApi.createLeaveRequest({
                        loai_don: 'giai_trinh_thieu_check_out',
                        ly_do: giaiTrinhLyDo.trim(),
                        ngay_bat_dau: giaiTrinhModal.ngay,
                        ngay_ket_thuc: giaiTrinhModal.ngay,
                        nhat_ky_id: giaiTrinhModal.nhat_ky_id,
                      });
                      toast.success('Gửi đơn giải trình thành công! Chờ cấp trên phê duyệt.');
                      setGiaiTrinhModal({ open: false, nhat_ky_id: '', ngay: '' });
                      setSelectedLog(null);
                      fetchMyAttendance();
                    } catch (err: any) {
                      const msg = err?.response?.data?.message || err?.message || 'Gửi đơn thất bại.';
                      toast.error(msg);
                    } finally {
                      setIsSubmittingGiaiTrinh(false);
                    }
                  }}
                  className="px-4 py-2 text-sm rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {isSubmittingGiaiTrinh ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Gửi đơn
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

    </div>
  );
};
