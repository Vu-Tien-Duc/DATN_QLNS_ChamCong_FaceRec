import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  Terminal,
  Copy,
  Check,
  Clock,
  ArrowUpRight,
  Lock,
  Server,
  Activity,
  X,
  Sparkles,
  FileSpreadsheet,
  Layers,
  Hash,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { Badge } from '../../components/chung/NhanTrangThai';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { getRoleLabel } from '../../utils/phanQuyen';
import {
  auditLogApi,
  AuditLogItem,
  AuditLogPagination,
  IntegrityCheckResponse,
} from '../../api/nhatKyKiemToan.api';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function formatDateTimeVN(isoStr?: string): string {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateAndTimeParts(isoStr?: string): { date: string; time: string } {
  if (!isoStr) return { date: '--', time: '--' };
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return { date: isoStr, time: '--' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  FORGOT_PASSWORD_OTP_SENT: 'Gửi OTP khôi phục',
  PASSWORD_RESET_SUCCESS: 'Đặt lại mật khẩu',
  CREATE_USER: 'Tạo nhân sự',
  UPDATE_USER: 'Cập nhật nhân sự',
  SOFT_DELETE_USER: 'Khóa tài khoản',
  UPDATE_AVATAR: 'Đổi ảnh đại diện',
  REGISTER_FACE_DESCRIPTOR: 'Đăng ký Face ID',
  FORCE_REGISTER_FACE_DESCRIPTOR: 'Ghi đè Face ID',
  BIOMETRIC_DATA_PURGED_RIGHT_TO_ERASURE: 'Xóa dữ liệu Face ID',
  REPLAY_ATTACK_DETECTED: 'Cảnh báo giả mạo',
  ADMIN_OVERRIDE_ATTENDANCE: 'Điều chỉnh công',
  APPROVE_LEAVE_FINAL: 'Duyệt đơn phép',
  CANCEL_LEAVE_AND_ROLLBACK: 'Hủy đơn & hoàn phép',
  ASSIGN_SUBSTITUTE_LECTURER: 'Phân công dạy thay',
  CREATE_DEPARTMENT: 'Tạo đơn vị',
  UPDATE_DEPARTMENT: 'Sửa đơn vị',
  DELETE_DEPARTMENT: 'Xóa đơn vị',
  CREATE_SCHEDULE: 'Tạo lịch dạy',
  UPDATE_SCHEDULE: 'Sửa lịch dạy',
  DELETE_SCHEDULE: 'Xóa lịch dạy',
  SCHEDULE_AUTO_CANCELLED_LATE: 'Tự hủy lịch trễ',
  GENERATE_PAYROLL: 'Khởi tạo bảng lương',
  LOCK_PAYROLL: 'Khóa sổ lương',
  UNLOCK_PAYROLL: 'Mở khóa sổ lương',
  UPDATE_SYSTEM_CONFIG: 'Sửa cấu hình',
  CRON_AUTO_ABSENT: 'Quét vắng tự động',
  CRON_HOLIDAY_SKIPPED: 'Bỏ qua ngày lễ',
};

function getActionLabel(action?: string): string {
  const act = String(action || '').trim();
  const upper = act.toUpperCase();
  if (ACTION_LABELS[upper]) return ACTION_LABELS[upper];
  if (upper.startsWith('APPROVE_LEAVE_LEVEL_')) return 'Duyệt đơn cấp 1';
  if (upper.startsWith('REJECT_LEAVE_LEVEL_')) return 'Từ chối đơn phép';
  if (upper.startsWith('ATTENDANCE_FACE_') || upper.startsWith('ATTENDANCE_QUEUE_')) {
    return 'Điểm danh Face ID';
  }
  return act || 'Thao tác';
}

function truncateHash(hash?: string | null, length: number = 10): string {
  if (!hash) return 'N/A';
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

const TARGET_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'nguoi_dung', label: 'Cán bộ / Người dùng' },
  { value: 'don_nghi_phep', label: 'Đơn nghỉ phép' },
  { value: 'nhat_ky_cham_cong', label: 'Nhật ký chấm công' },
  { value: 'phieu_luong', label: 'Bảng / Phiếu lương' },
  { value: 'lich_trinh', label: 'Lịch giảng dạy' },
  { value: 'phong_ban', label: 'Khoa / Phòng ban' },
  { value: 'cau_hinh_he_thong', label: 'Cấu hình hệ thống' },
  { value: 'ngay_nghi_le', label: 'Ngày nghỉ lễ' },
  { value: 'ca_lam_viec', label: 'Ca làm việc' },
  { value: 'mon_hoc', label: 'Môn học' },
  { value: 'mau_khuon_mat', label: 'Mẫu khuôn mặt' },
];

const TARGET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TARGET_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function getAuditActorInfo(log: any): {
  name: string;
  role: string;
  staffCode: string;
  isSystem: boolean;
  actorObj: any;
} {
  const actorObj =
    (log?.nguoi_thuc_hien && typeof log.nguoi_thuc_hien === 'object' ? log.nguoi_thuc_hien : null) ||
    (log?.actor && typeof log.actor === 'object' ? log.actor : null) ||
    (log?.nguoi_thuc_hien_id && typeof log.nguoi_thuc_hien_id === 'object' ? log.nguoi_thuc_hien_id : null);
  const actorType = String(log?.actorType || log?.loai_chu_the || 'user').toLowerCase();
  const isSystem = actorType === 'system' || (!actorObj && !log?.nguoi_thuc_hien_id);

  if (actorObj) {
    return {
      name: actorObj.ho_ten || actorObj.email || 'Quản trị viên Hệ thống',
      role: actorObj.vai_tro_chinh || actorType,
      staffCode: actorObj.ma_can_bo || '--',
      isSystem: false,
      actorObj,
    };
  }
  return {
    name: isSystem ? 'HỆ THỐNG' : 'Tài khoản đã xóa',
    role: actorType || 'system',
    staffCode: '--',
    isSystem,
    actorObj: null,
  };
}

function getActionColor(action?: string): { bg: string; text: string; border: string } {
  const act = (action || '').toUpperCase();
  if (act.includes('CREATE') || act.includes('INSERT') || act.includes('ENROLL')) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
    };
  }
  if (act.includes('UPDATE') || act.includes('OVERRIDE') || act.includes('EDIT')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
    };
  }
  if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('DROP')) {
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
    };
  }
  if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('VERIFY')) {
    return {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    };
  }
  return {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  };
}

// =============================================================================
// MAIN COMPONENT: AuditLogs
// =============================================================================

export const AuditLogs: React.FC = () => {
  const { user } = useAuthStore();

  // Data States
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    limit: 20,
    totalPages: 1,
    totalDocs: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Filter States
  const [keyword, setKeyword] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(''); // '', 'success', 'failed'
  const [selectedTargetType, setSelectedTargetType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilters, setShowDateFilters] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState<boolean>(false);
  const [integrityData, setIntegrityData] = useState<IntegrityCheckResponse | null>(null);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState<boolean>(false);

  // Copy hash helper state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Đã sao chép vào bộ nhớ tạm!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        trang: currentPage,
        gioi_han: pageSize,
      };

      if (keyword.trim()) params.tim_kiem = keyword.trim();
      if (selectedStatus) params.ket_qua = selectedStatus;
      if (selectedTargetType) params.loai_doi_tuong = selectedTargetType;
      if (startDate) params.tu_ngay = startDate;
      if (endDate) params.den_ngay = endDate;

      const res = await auditLogApi.getAuditLogs(params);
      setLogs(res.logs || []);
      setTotalRecords(res.totalRecords || 0);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Lỗi khi tải nhật ký kiểm toán:', err);
      toast.error(err.response?.data?.message || 'Không thể tải nhật ký kiểm toán.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, keyword, selectedStatus, selectedTargetType, startDate, endDate]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // =============================================================================
  // INTEGRITY CHECK (SHA-256 HASH CHAIN)
  // =============================================================================

  const runIntegrityVerification = async () => {
    setIsCheckingIntegrity(true);
    try {
      const data = await auditLogApi.verifyIntegrity(1000);
      setIntegrityData(data);
      setIsIntegrityModalOpen(true);
      if (data.isValid) {
        toast.success('Đối soát chuỗi băm thành công: Dữ liệu kiểm toán an toàn 100%!');
      } else {
        toast.error('CẢNH BÁO: Phát hiện bất thường hoặc bản ghi bị can thiệp trái phép!');
      }
    } catch (err: any) {
      console.error('Lỗi khi đối soát toàn vẹn:', err);
      toast.error(err.response?.data?.message || 'Không thể thực hiện đối soát toàn vẹn.');
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // =============================================================================
  // KPI CALCULATIONS
  // =============================================================================

  const kpis = useMemo(() => {
    let successCount = 0;
    let failedCount = 0;

    logs.forEach((log) => {
      if (['success', 'thanh_cong'].includes(String(log.ket_qua || '').toLowerCase())) successCount++;
      else if (['failed', 'that_bai'].includes(String(log.ket_qua || '').toLowerCase())) failedCount++;
    });

    const pageCount = logs.length || 1;
    const successRate = ((successCount / pageCount) * 100).toFixed(1);

    return {
      totalRecords,
      successRate,
      successCount,
      failedCount,
    };
  }, [logs, totalRecords]);

  // =============================================================================
  // EXPORT EXCEL (.XLSX)
  // =============================================================================

  const handleExportExcel = () => {
    if (logs.length === 0) {
      toast.error('Không có dữ liệu nhật ký kiểm toán để xuất file Excel.');
      return;
    }

    try {
      const dataRows = logs.map((l, idx) => {
        const actorInfo = getAuditActorInfo(l);
        const detailsStr = l.chi_tiet ? JSON.stringify(l.chi_tiet) : '';
        const isOk = ['success', 'thanh_cong'].includes(String(l.ket_qua || '').toLowerCase());

        return {
          'STT': idx + 1,
          'Thời Điểm': formatDateTimeVN(l.thoi_diem),
          'Hành Động': l.hanh_dong,
          'Người Thực Hiện': actorInfo.name,
          'Mã Cán Bộ': actorInfo.staffCode,
          'Loại Chủ Thể': l.loai_chu_the || 'user',
          'Loại Đối Tượng': TARGET_TYPE_LABELS[l.loai_doi_tuong] || l.loai_doi_tuong,
          'ID Đối Tượng': l.doi_tuong_id,
          'Địa Chỉ IP': l.dia_chi_ip || '--',
          'Kết Quả': isOk ? 'Thành công' : 'Thất bại',
          'Mã Băm SHA-256 Hiện Tại': l.ma_bam_hien_tai || '--',
          'Mã Băm Trước Đó': l.ma_bam_truoc || '--',
          'Chi Tiết Thay Đổi': detailsStr,
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 26 },
        { wch: 26 },
        { wch: 14 },
        { wch: 15 },
        { wch: 20 },
        { wch: 24 },
        { wch: 16 },
        { wch: 14 },
        { wch: 35 },
        { wch: 35 },
        { wch: 40 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Nhật Ký Kiểm Toán');

      const fileName = `Nhat_Ky_Kiem_Toan_AuditLogs_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Nhật ký kiểm toán (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      toast.error('Không thể xuất file nhật ký kiểm toán.');
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-4">
      {/* 1. HEADER SECTION */}
      <PageHeader
        title="Nhật Ký Kiểm Toán Hệ Thống"
        subtitle="Lưu vết thao tác hệ thống và kiểm tra tính toàn vẹn dữ liệu SHA-256."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAuditLogs}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Làm mới
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={logs.length === 0}
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất nhật ký kiểm toán ra file Excel (.xlsx)"
            >
              Xuất Excel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={runIntegrityVerification}
              disabled={isCheckingIntegrity}
              leftIcon={<Link2 className={`w-3.5 h-3.5 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />}
            >
              {isCheckingIntegrity ? 'Đang đối soát...' : 'Đối soát SHA-256'}
            </Button>
          </div>
        }
      />

      {/* 2. FLUX SEPARATE STATS ROW */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng sự kiện',
            value: kpis.totalRecords.toLocaleString(),
            subtext: 'Nhật ký toàn hệ thống',
            tone: 'neutral',
            active: selectedStatus === '',
            onClick: () => {
              setSelectedStatus('');
              setCurrentPage(1);
            },
          },
          {
            label: 'Thao tác hợp lệ',
            value: kpis.successCount,
            badge: `${kpis.successRate}%`,
            progress: Number(kpis.successRate) || 0,
            tone: 'success',
            active: selectedStatus === 'success',
            onClick: () => {
              setSelectedStatus((prev) => (prev === 'success' ? '' : 'success'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Cảnh báo / Lỗi',
            value: kpis.failedCount,
            subtext: kpis.failedCount > 0 ? 'Cần rà soát bảo mật' : 'Không phát hiện lỗi',
            tone: kpis.failedCount > 0 ? 'danger' : 'neutral',
            active: selectedStatus === 'failed',
            onClick: () => {
              setSelectedStatus((prev) => (prev === 'failed' ? '' : 'failed'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Toàn vẹn dữ liệu',
            value: 'SHA-256',
            unit: 'Khớp chuỗi',
            subtext: 'Chống sửa đổi log',
            tone: 'brand',
          },
        ]}
      />

      {/* 3. MAIN AUDIT LOGS CARD (FLUX STYLE) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Keyword Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm theo hành động, loại đối tượng, ID..."
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-8 text-xs rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-colors"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Target Type Filter */}
            <select
              value={selectedTargetType}
              onChange={(e) => {
                setSelectedTargetType(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 pl-3 pr-7 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">Tất cả đối tượng</option>
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 pl-3 pr-7 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">Tất cả kết quả</option>
              <option value="success">Thành công</option>
              <option value="failed">Thất bại</option>
            </select>

            {/* Date Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowDateFilters((prev) => !prev)}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                showDateFilters || startDate || endDate
                  ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Khoảng ngày</span>
            </button>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto pr-1 whitespace-nowrap">
              {totalRecords} bản ghi
            </span>
          </div>

          {showDateFilters && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Từ ngày:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono focus:outline-none"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono focus:outline-none"
              />
              {(keyword || selectedStatus || selectedTargetType || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    setSelectedStatus('');
                    setSelectedTargetType('');
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-auto cursor-pointer"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3 animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Đang tải danh sách nhật ký kiểm toán...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Không tìm thấy sự kiện kiểm toán nào
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Không có nhật ký nào phù hợp với các tiêu chí tìm kiếm hiện tại. Hãy thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[780px] text-left border-collapse">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">Thời Điểm</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Người Thực Hiện</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Hành Động</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Đối Tượng</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Kết Quả</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {logs.map((log: any) => {
                  const actVal = log.action || log.hanh_dong || 'THAO TÁC';
                  const actLabel = getActionLabel(actVal);
                  const actStyle = getActionColor(actVal);
                  const actorInfo = getAuditActorInfo(log);
                  const timestampVal = log.timestamp || log.thoi_diem || log.tao_luc;
                  const timeParts = formatDateAndTimeParts(timestampVal);
                  const ipVal = log.ipAddress || log.dia_chi_ip || '127.0.0.1';
                  const hashVal = log.currentHash || log.ma_bam_hien_tai || '';
                  const targetTypeVal = log.targetType || log.loai_doi_tuong || 'he_thong';
                  const targetLabel = TARGET_TYPE_LABELS[targetTypeVal] || targetTypeVal;
                  const targetIdVal = log.targetId || log.doi_tuong_id || '';
                  const statusVal = (log.status || log.ket_qua || 'success').toString().toLowerCase();
                  const isSuccess = statusVal === 'success' || statusVal === 'thanh_cong';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Thời điểm & IP */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="leading-snug">
                          <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-slate-800 dark:text-slate-200">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{timeParts.date}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums pl-5">
                            {timeParts.time} • {ipVal}
                          </div>
                        </div>
                      </td>

                      {/* Người thực hiện */}
                      <td className="py-2.5 px-3.5 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {actorInfo.isSystem ? (
                            <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                              <Server className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <UserAvatar
                              user={actorInfo.actorObj}
                              name={actorInfo.name}
                              staffCode={actorInfo.staffCode}
                              size="sm"
                              shape="circle"
                            />
                          )}
                          <div className="min-w-0 leading-snug">
                            <div
                              className="font-semibold text-xs text-slate-900 dark:text-white truncate"
                              title={actorInfo.name}
                            >
                              {actorInfo.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {actorInfo.isSystem ? 'Tác vụ hệ thống' : getRoleLabel(actorInfo.role)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Hành động (Tiếng Việt dễ hiểu) */}
                      <td className="py-2.5 px-3.5">
                        <span
                          title={`Mã hệ thống: ${actVal}`}
                          className={`inline-flex items-center max-w-full truncate px-2.5 py-1 rounded-full text-xs font-medium border ${actStyle.bg} ${actStyle.text} ${actStyle.border}`}
                        >
                          {actLabel}
                        </span>
                      </td>

                      {/* Đối tượng tác động */}
                      <td className="py-2.5 px-3.5 min-w-0">
                        <div className="min-w-0 leading-snug">
                          <div
                            className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                            title={`${targetLabel} (${targetTypeVal})`}
                          >
                            {targetLabel}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                            #{targetIdVal ? String(targetIdVal).slice(-8) : '--'}
                          </div>
                        </div>
                      </td>

                      {/* Kết quả */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Thành công
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-0.5 max-w-[160px]">
                            <span
                              title={log.ly_do_that_bai || ''}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                            >
                              <XCircle className="w-3 h-3 text-rose-500" />
                              Thất bại
                            </span>
                            {log.ly_do_that_bai && (
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 truncate max-w-full" title={log.ly_do_that_bai}>
                                {log.ly_do_that_bai}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Thao tác: Copy SHA-256 & Xem chi tiết */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {hashVal && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(hashVal, log.id)}
                              title={`Sao chép mã SHA-256 (${truncateHash(hashVal, 6)})`}
                              className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                            >
                              {copiedKey === log.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-full transition-colors cursor-pointer"
                            title="Xem chi tiết sự kiện"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. PHÂN TRANG (PAGINATION) */}
        {!isLoading && logs.length > 0 && (
          <ThanhPhanTrang
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={totalRecords}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            itemLabel="sự kiện kiểm toán"
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* ============================================================================= */}
      {/* 6. MODAL 1: CHI TIẾT SỰ KIỆN KIỂM TOÁN & PAYLOAD */}
      {/* ============================================================================= */}
      {isDetailModalOpen && selectedLog && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Sự Kiện Kiểm Toán #{selectedLog.id.slice(-8)}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        selectedLog.ket_qua === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      }`}
                    >
                      {selectedLog.ket_qua}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thời điểm: {formatDateTimeVN(selectedLog.thoi_diem)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-sm">
              {/* Thẻ tóm tắt */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Hành Động</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.hanh_dong}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Loại Đối Tượng</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {TARGET_TYPE_LABELS[selectedLog.loai_doi_tuong] || selectedLog.loai_doi_tuong}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Kết Quả</span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      ['success', 'thanh_cong'].includes(String(selectedLog.ket_qua || 'success').toLowerCase())
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {['success', 'thanh_cong'].includes(String(selectedLog.ket_qua || 'success').toLowerCase())
                      ? 'Thành công'
                      : 'Thất bại'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Địa Chỉ IP</span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.dia_chi_ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">
                    Chủ Thể ({selectedLog.loai_chu_the === 'system' ? 'Hệ thống' : 'Người dùng'})
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {getAuditActorInfo(selectedLog).name}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Thời Điểm Ghi Nhận</span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.thoi_diem ? new Date(selectedLog.thoi_diem).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>

              {/* Thông tin Mật mã Chuỗi Hash (Chống can thiệp) */}
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/70 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Xác Thực Mật Mã Chuỗi Khối (SHA-256 Hash Chain)</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block">Mã băm mắt xích trước (previousHash):</span>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
                      <span>{selectedLog.ma_bam_truoc || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}</span>
                      {selectedLog.ma_bam_truoc && (
                        <button
                          onClick={() => copyToClipboard(selectedLog.ma_bam_truoc || '', 'prevHash')}
                          className="text-slate-400 hover:text-indigo-600 ml-2"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block">Mã băm bản ghi hiện tại (currentHash):</span>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold break-all">
                      <span>{selectedLog.ma_bam_hien_tai || 'Chưa tính mã băm'}</span>
                      {selectedLog.ma_bam_hien_tai && (
                        <button
                          onClick={() => copyToClipboard(selectedLog.ma_bam_hien_tai || '', 'currHash')}
                          className="text-slate-400 hover:text-indigo-600 ml-2"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thông tin đối tượng tác động & Thiết bị */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target ID:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.doi_tuong_id}
                  </span>
                </div>
                {selectedLog.thong_tin_trinh_duyet && (
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-slate-400 shrink-0">User-Agent:</span>
                    <span className="text-right text-slate-600 dark:text-slate-300 break-all font-mono text-[10px]">
                      {selectedLog.thong_tin_trinh_duyet}
                    </span>
                  </div>
                )}
                {(selectedLog as any).failureReason && (
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-rose-500 shrink-0 font-semibold">Lý do thất bại:</span>
                    <span className="text-right text-rose-600 dark:text-rose-400 font-medium break-words">
                      {(selectedLog as any).failureReason}
                    </span>
                  </div>
                )}
              </div>

              {/* Payload Chi Tiết (JSON Data) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Dữ Liệu Chi Tiết (Event Payload):
                  </span>
                  {selectedLog.chi_tiet && (
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(selectedLog.chi_tiet, null, 2), 'payload')
                      }
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Copy className="w-3 h-3" />
                      Sao chép JSON
                    </button>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                  {selectedLog.chi_tiet ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.chi_tiet, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-slate-500 italic">Không có dữ liệu chi tiết kèm theo.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Đóng Cửa Sổ
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* ============================================================================= */}
      {/* 7. MODAL 2: BÁO CÁO ĐỐI SOÁT TOÀN VẸN CHUỖI HASH (SHA-256) */}
      {/* ============================================================================= */}
      {isIntegrityModalOpen && integrityData && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 p-6 sm:p-7 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-5">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-3 ${
                  integrityData.isValid
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 shadow-emerald-500/20'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 shadow-rose-500/20'
                }`}
              >
                {integrityData.isValid ? (
                  <ShieldCheck className="w-8 h-8" />
                ) : (
                  <ShieldAlert className="w-8 h-8" />
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {integrityData.isValid
                  ? 'Đối Soát Toàn Vẹn Thành Công: An Toàn 100%'
                  : 'Cảnh Báo: Phát Hiện Dị Thường Trong Chuỗi Khối!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Thời gian kiểm tra: {formatDateTimeVN(integrityData.checkedAt)}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-400 block">Đã Kiểm Tra</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 block">
                  {integrityData.totalChecked}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">Hợp Lệ</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                  {integrityData.validCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 block">Bị Sửa Đổi</span>
                <span className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5 block">
                  {integrityData.tamperedCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 block">Đứt Gãy Chuỗi</span>
                <span className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5 block">
                  {integrityData.brokenChainCount}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2 mb-5">
              <div>
                <span className="text-slate-400 block">Mã băm khối khởi nguyên (Genesis Hash):</span>
                <code className="text-[10px] font-mono text-slate-600 dark:text-slate-300 block truncate">
                  {integrityData.genesisHash}
                </code>
              </div>
              {integrityData.latestHash && (
                <div>
                  <span className="text-slate-400 block">Mã băm đỉnh chuỗi gần nhất (Latest Block Hash):</span>
                  <code className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold block truncate">
                    {integrityData.latestHash}
                  </code>
                </div>
              )}
            </div>

            {integrityData.tamperedLogs && integrityData.tamperedLogs.length > 0 && (
              <div className="mb-5">
                <span className="text-xs font-bold text-rose-600 mb-1.5 block">
                  Danh Sách Bản Ghi Bị Can Thiệp:
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {integrityData.tamperedLogs.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300"
                    >
                      <div className="font-bold">
                        #{item.id} - {item.action} ({formatDateTimeVN(item.timestamp)})
                      </div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setIsIntegrityModalOpen(false)} className="w-full sm:w-auto">
                Đóng Báo Cáo
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}
    </div>
  );
};
