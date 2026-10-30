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
  Layers,
  Link2,
  Terminal,
  Hash,
  User,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpRight,
  Lock,
  Server,
  Activity,
  X,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Portal } from '../components/ui/Portal';
import {
  auditLogApi,
  AuditLogItem,
  AuditLogPagination,
  IntegrityCheckResponse,
} from '../api/auditLog.api';

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

function truncateHash(hash?: string | null, length: number = 10): string {
  if (!hash) return 'N/A';
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
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
        page: currentPage,
        limit: pageSize,
      };

      if (keyword.trim()) params.keyword = keyword.trim();
      if (selectedStatus) params.status = selectedStatus;
      if (selectedTargetType) params.targetType = selectedTargetType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

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
      if (log.status === 'success') successCount++;
      else if (log.status === 'failed') failedCount++;
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
        const actorName =
          typeof l.actor === 'object' && l.actor
            ? (l.actor as any).fullName || (l.actor as any).name || '--'
            : l.actorType === 'system'
            ? 'HỆ THỐNG (SYSTEM)'
            : '--';
        const actorCode = typeof l.actor === 'object' && l.actor ? (l.actor as any).staffCode || '--' : '--';
        const detailsStr = l.details ? JSON.stringify(l.details) : '';

        return {
          'STT': idx + 1,
          'Thời Điểm': formatDateTimeVN(l.timestamp),
          'Hành Động': l.action,
          'Người Thực Hiện': actorName,
          'Mã Cán Bộ': actorCode,
          'Loại Chủ Thể': l.actorType || 'user',
          'Loại Đối Tượng': l.targetType,
          'ID Đối Tượng': l.targetId,
          'Địa Chỉ IP': l.ipAddress || '--',
          'Kết Quả': l.status === 'success' ? 'Thành công' : 'Thất bại',
          'Mã Băm SHA-256 Hiện Tại': l.currentHash || '--',
          'Mã Băm Trước Đó': l.previousHash || '--',
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
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            SHA-256 Hash Chaining
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Lưu vết toàn bộ thao tác, hành vi truy cập và bảo vệ tính bất biến dữ liệu theo chuẩn an toàn thông tin CSDL v2.5.
        </p>
      </div>

      {/* 2. BỘ 4 THẺ KPI KIỂM TOÁN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng số bản ghi */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-400 dark:hover:border-indigo-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng Số Bản Ghi
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {kpis.totalRecords.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">sự kiện đã ghi</span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Cơ chế Append-Only (Bất biến)</span>
          </div>
        </div>

        {/* KPI 2: Tỷ lệ thành công */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-400 dark:hover:border-emerald-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Thao Tác Hợp Lệ
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {kpis.successRate}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">tỷ lệ trang này</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {kpis.successCount} thao tác SUCCESS
          </div>
        </div>

        {/* KPI 3: Thao tác thất bại / Cảnh báo */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-400 dark:hover:border-rose-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cảnh Báo / Thất Bại
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${kpis.failedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {kpis.failedCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">thao tác FAILED</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {kpis.failedCount === 0 ? 'An toàn, không có sự cố' : 'Cần kiểm tra chi tiết lỗi'}
          </div>
        </div>

        {/* KPI 4: Tính toàn vẹn chuỗi Hash */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-cyan-400 dark:hover:border-cyan-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chuỗi Hash Chaining
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
              SHA-256
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">liên kết chuỗi</span>
          </div>
          <div className="mt-2 text-xs text-cyan-700 dark:text-cyan-300 font-medium flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" />
            <span>Chống sửa lén &amp; xóa bản ghi</span>
          </div>
        </div>
      </div>

      {/* 3. BỘ LỌC ĐA CHIỀU & TÌM KIẾM */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Actions & Toolbar Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bộ Lọc & Tra Cứu Sự Kiện Hệ Thống</span>
            <span>• Tổng số <b>{totalRecords}</b> bản ghi</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAuditLogs}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm Mới</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
              title="Xuất nhật ký kiểm toán ra file Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Xuất Excel (.xlsx)</span>
            </Button>

            <Button
              size="sm"
              onClick={runIntegrityVerification}
              disabled={isCheckingIntegrity}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-md shadow-indigo-600/20"
            >
              <Link2 className={`w-4 h-4 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
              <span>{isCheckingIntegrity ? 'Đang Đối Soát...' : 'Đối Soát SHA-256'}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo Hành động, Loại đối tượng, ID..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {keyword && (
              <button
                onClick={() => setKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Target Type Filter */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedTargetType}
                onChange={(e) => {
                  setSelectedTargetType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="">Tất cả đối tượng</option>
                <option value="User">User (Cán bộ / Tài khoản)</option>
                <option value="Payroll">Payroll (Bảng Lương)</option>
                <option value="AttendanceRecord">AttendanceRecord (Điểm danh)</option>
                <option value="SystemConfig">SystemConfig (Cấu hình hệ thống)</option>
                <option value="LeaveRequest">LeaveRequest (Đơn nghỉ phép)</option>
                <option value="Schedule">Schedule (Thời khóa biểu / Lịch)</option>
                <option value="FaceTemplate">FaceTemplate (Mẫu khuôn mặt)</option>
                <option value="Holiday">Holiday (Ngày nghỉ lễ)</option>
                <option value="ShiftConfig">ShiftConfig (Ca làm việc)</option>
                <option value="Department">Department (Khoa / Phòng ban)</option>
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="">Tất cả kết quả</option>
                <option value="success">Thành công (SUCCESS)</option>
                <option value="failed">Thất bại (FAILED)</option>
              </select>
            </div>
          </div>

          {/* Date Range: From / To */}
          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              title="Từ ngày"
              className="w-1/2 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              title="Đến ngày"
              className="w-1/2 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Active Filters Summary */}
        {(keyword || selectedStatus || selectedTargetType || startDate || endDate) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span className="text-slate-400">Đang lọc theo:</span>
            {keyword && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Từ khóa: &quot;{keyword}&quot;
                <button onClick={() => setKeyword('')} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTargetType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                Đối tượng: {selectedTargetType}
                <button onClick={() => setSelectedTargetType('')} className="hover:text-cyan-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Kết quả: {selectedStatus}
                <button onClick={() => setSelectedStatus('')} className="hover:text-emerald-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Thời gian: {startDate || '...'} đến {endDate || '...'}
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="hover:text-amber-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setKeyword('');
                setSelectedStatus('');
                setSelectedTargetType('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-slate-400 hover:text-indigo-600 underline ml-auto cursor-pointer"
            >
              Đặt lại tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* 4. MAIN AUDIT LOGS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3 animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Thời Điểm</th>
                  <th className="py-3.5 px-4">Người Thực Hiện</th>
                  <th className="py-3.5 px-4">Hành Động</th>
                  <th className="py-3.5 px-4">Đối Tượng Tác Động</th>
                  <th className="py-3.5 px-4">Địa Chỉ IP</th>
                  <th className="py-3.5 px-4 text-center">Kết Quả</th>
                  <th className="py-3.5 px-4">Mã Băm SHA-256</th>
                  <th className="py-3.5 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {logs.map((log) => {
                  const actStyle = getActionColor(log.action);
                  const actorName =
                    typeof log.actor === 'object' && log.actor
                      ? log.actor.fullName
                      : log.actorType === 'system'
                      ? 'HỆ THỐNG'
                      : 'Ẩn danh / Không xác định';
                  const actorRole = typeof log.actor === 'object' && log.actor ? log.actor.role : log.actorType;

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Thời điểm */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDateTimeVN(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Người thực hiện */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.actorType === 'system' ? (
                              <Server className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-xs text-slate-900 dark:text-white line-clamp-1">
                              {actorName}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                              {actorRole || 'system'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Hành động */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${actStyle.bg} ${actStyle.text} ${actStyle.border}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Đối tượng tác động */}
                      <td className="py-3 px-4">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.targetType}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 ml-1.5 block sm:inline">
                            #{log.targetId ? log.targetId.slice(-8) : '--'}
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {log.ipAddress || '127.0.0.1'}
                        </span>
                      </td>

                      {/* Kết quả */}
                      <td className="py-3 px-4 text-center">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Mã băm SHA-256 */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <code
                            title={log.currentHash || ''}
                            className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40"
                          >
                            {truncateHash(log.currentHash, 6)}
                          </code>
                          {log.currentHash && (
                            <button
                              onClick={() => copyToClipboard(log.currentHash || '', log._id)}
                              title="Sao chép toàn bộ mã băm"
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              {copiedKey === log._id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Xem chi tiết sự kiện và payload"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value={10}>10 bản ghi</option>
                <option value={20}>20 bản ghi</option>
                <option value={50}>50 bản ghi</option>
                <option value={100}>100 bản ghi</option>
              </select>
              <span>trên trang (Tổng {totalRecords.toLocaleString()} sự kiện)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Trước
              </Button>

              <span className="px-3 py-1 font-semibold text-slate-800 dark:text-slate-200">
                Trang {pagination.page} / {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-2.5 py-1 text-xs"
              >
                Sau <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================================= */}
      {/* 6. MODAL 1: CHI TIẾT SỰ KIỆN KIỂM TOÁN & PAYLOAD */}
      {/* ============================================================================= */}
      {isDetailModalOpen && selectedLog && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Sự Kiện Kiểm Toán #{selectedLog._id.slice(-8)}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        selectedLog.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      }`}
                    >
                      {selectedLog.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thời điểm: {formatDateTimeVN(selectedLog.timestamp)}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Hành Động</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.action}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Loại Đối Tượng</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.targetType}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Địa Chỉ IP</span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedLog.ipAddress || '127.0.0.1'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Chủ Thể (Actor)</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {typeof selectedLog.actor === 'object' && selectedLog.actor
                      ? selectedLog.actor.fullName
                      : selectedLog.actorType || 'system'}
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
                      <span>{selectedLog.previousHash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}</span>
                      {selectedLog.previousHash && (
                        <button
                          onClick={() => copyToClipboard(selectedLog.previousHash || '', 'prevHash')}
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
                      <span>{selectedLog.currentHash || 'Chưa tính mã băm'}</span>
                      {selectedLog.currentHash && (
                        <button
                          onClick={() => copyToClipboard(selectedLog.currentHash || '', 'currHash')}
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
                    {selectedLog.targetId}
                  </span>
                </div>
                {selectedLog.userAgent && (
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-slate-400 shrink-0">User-Agent:</span>
                    <span className="text-right text-slate-600 dark:text-slate-300 break-all font-mono text-[10px]">
                      {selectedLog.userAgent}
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
                  {selectedLog.details && (
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(selectedLog.details, null, 2), 'payload')
                      }
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Copy className="w-3 h-3" />
                      Sao chép JSON
                    </button>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                  {selectedLog.details ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details, null, 2)}
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
