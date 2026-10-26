import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  RotateCcw,
  Eye,
  Check,
  X,
  ShieldAlert,
  Loader2,
  CalendarDays,
  CalendarCheck,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Landmark,
  Info,
  ArrowRight,
  Printer,
  Table,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Portal } from '../components/ui/Portal';
import {
  leaveRequestApi,
  LeaveRequestData,
  LeaveBalanceData,
  CreateLeavePayload,
  BackendLeaveType,
} from '../api/leaveRequest.api';
import { departmentApi } from '../api/department.api';
import { scheduleApi } from '../api/schedule.api';
import { extractArray } from '../api/apiClient';
import { DepartmentItem } from '../types';
import { isAdmin as checkIsAdmin, hasRole } from '../utils/rbac';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function formatDateVN(dateStr?: string | Date): string {
  if (!dateStr) return '--/--/----';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeVN(dateStr?: string | Date): string {
  if (!dateStr) return '--/--/---- --:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/---- --:--';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

// Bóc tách tên viết tắt: loại bỏ các học hàm, học vị tiền tố tiếng Việt
function getUserInitials(name?: string): string {
  if (!name) return 'CB';
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

// Tính số ngày làm việc
function calculateWorkingDays(startDateStr: string, endDateStr: string, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(0.5, count || 1);
}

// Visual metadata cho từng loại đơn nghỉ phép
function getLeaveTypeMeta(type?: string) {
  const norm = (type || '').toUpperCase();
  switch (norm) {
    case 'ANNUAL':
    case 'NGHI_PHEP':
      return {
        label: 'Phép Thường Niên',
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        dotColor: 'bg-primary',
        icon: CalendarCheck,
      };
    case 'BUSINESS':
    case 'CONG_TAC':
      return {
        label: 'Công Tác Hội Thảo',
        badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        dotColor: 'bg-indigo-600',
        icon: FileText,
      };
    case 'SICK':
    case 'NGHI_OM':
      return {
        label: 'Nghỉ Ốm (BHXH)',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotColor: 'bg-rose-500',
        icon: AlertCircle,
      };
    case 'COMPENSATORY':
    case 'DAY_BU':
      return {
        label: 'Kế Hoạch Dạy Bù',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        icon: CalendarDays,
      };
    case 'SHIFT_CHANGE':
    case 'DOI_CA':
      return {
        label: 'Xin Đổi Ca Dạy',
        badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        dotColor: 'bg-purple-500',
        icon: Clock,
      };
    case 'UNPAID':
    case 'VIEC_RIENG':
      return {
        label: 'Việc Riêng',
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-500',
        icon: FileText,
      };
    default:
      return {
        label: type || 'Nghỉ Phép',
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-500',
        icon: FileText,
      };
  }
}

// Visual metadata cho trạng thái luồng duyệt
function getLeaveStatusMeta(status?: string) {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'PENDING':
    case 'PENDING_DEAN':
      return {
        label: 'Chờ Cấp 1 (Khoa)',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        dotColor: 'bg-amber-500',
        isPulse: true,
      };
    case 'PENDING_BGH':
      return {
        label: 'Chờ Cấp 2 (BGH)',
        badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
        dotColor: 'bg-indigo-600',
        isPulse: false,
      };
    case 'APPROVED':
      return {
        label: 'Đã Phê Duyệt',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        isPulse: false,
      };
    case 'REJECTED':
      return {
        label: 'Từ Chối',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        dotColor: 'bg-rose-500',
        isPulse: false,
      };
    case 'CANCELLED':
      return {
        label: 'Đã Hủy',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-400',
        isPulse: false,
      };
    default:
      return {
        label: status || 'Không xác định',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 border-slate-200 text-slate-600',
        dotColor: 'bg-slate-400',
        isPulse: false,
      };
  }
}

// =============================================================================
// MAIN COMPONENT: LEAVE REQUESTS
// =============================================================================

export const LeaveRequests: React.FC = () => {
  const { user } = useAuthStore();
  const currentUserId = user?._id;

  // Quyền Admin IT & Thẩm quyền lãnh đạo xét duyệt
  const isAdmin = useMemo(() => checkIsAdmin(user), [user]);
  const hasAdminOrLeadershipRole = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'truongkhoa', 'phokhoa']);
  }, [user]);

  // Data States
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestData[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tracking broken avatars
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

  // Filter States (Đồng bộ chuẩn 4 cột theo code.html)
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'semester' | 'custom'>('month');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<string>('all');
  const [onlyMyApproval, setOnlyMyApproval] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestData | null>(null);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // Form State for Creating Leave Request
  const [createFormData, setCreateFormData] = useState<{
    type: BackendLeaveType;
    reason: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    scheduleId: string;
    makeupDate: string;
    file: File | null;
  }>({
    type: 'ANNUAL',
    reason: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isHalfDay: false,
    scheduleId: '',
    makeupDate: '',
    file: null,
  });
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  // Calculated Days for form
  const calculatedFormDays = useMemo(() => {
    return calculateWorkingDays(createFormData.startDate, createFormData.endDate, createFormData.isHalfDay);
  }, [createFormData.startDate, createFormData.endDate, createFormData.isHalfDay]);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leaveRequestApi.getLeaveRequests();
      const list = extractArray<LeaveRequestData>(res);
      setLeaveRequests(list);
    } catch (err: any) {
      console.error('Error loading leave requests:', err);
      toast.error('Không thể tải danh sách đơn xin nghỉ phép');
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetadata = useCallback(async () => {
    try {
      const [deptRes, balanceRes, schedRes] = await Promise.all([
        departmentApi.getDepartmentsFlat().catch(() => ({ data: [] })),
        leaveRequestApi.getLeaveBalance().catch(() => null),
        scheduleApi.getSchedules({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
      if (balanceRes) setLeaveBalance(balanceRes);
      setSchedules(extractArray<any>(schedRes));
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    loadMetadata();
  }, [loadRequests, loadMetadata]);

  // =============================================================================
  // KPI METRICS CALCULATION (Matching code.html)
  // =============================================================================

  const metrics = useMemo(() => {
    const totalMonth = leaveRequests.length;
    const step1Count = leaveRequests.filter((r) => ['PENDING', 'PENDING_DEAN'].includes(r.status)).length;
    const step2Count = leaveRequests.filter((r) => r.status === 'PENDING_BGH').length;
    const approvedCount = leaveRequests.filter((r) => r.status === 'APPROVED').length;
    const rejectedCount = leaveRequests.filter((r) => r.status === 'REJECTED').length;
    const approvalRate = totalMonth > 0 ? Math.round((approvedCount / totalMonth) * 100) : 0;

    return {
      totalMonth,
      step1Count,
      step2Count,
      approvedCount,
      rejectedCount,
      approvalRate,
    };
  }, [leaveRequests]);

  // =============================================================================
  // FILTERING LOGIC
  // =============================================================================

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((req) => {
      const applicant = typeof req.userId === 'object' ? req.userId : null;
      const applicantId = applicant?._id || req.userId;
      const isOwner = applicantId === currentUserId;

      // 1. Chỉ xem đơn cần tôi duyệt
      if (onlyMyApproval) {
        const isPending = ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'].includes(req.status);
        if (!isPending || isOwner || !hasAdminOrLeadershipRole) {
          return false;
        }
      }

      // 2. Lọc Khoa / Phòng Ban
      if (selectedDeptId !== 'all') {
        const userDeptId = typeof applicant?.departmentId === 'object'
          ? (applicant?.departmentId as any)?._id
          : applicant?.departmentId;
        if (userDeptId !== selectedDeptId) {
          return false;
        }
      }

      // 3. Lọc Hình thức nghỉ phép
      if (selectedType !== 'all') {
        const reqType = (req.type || req.loai_don || '').toUpperCase();
        if (selectedType === 'annual' && !['ANNUAL', 'NGHI_PHEP'].includes(reqType)) return false;
        if (selectedType === 'business' && !['BUSINESS', 'CONG_TAC'].includes(reqType)) return false;
        if (selectedType === 'sick' && !['SICK', 'NGHI_OM'].includes(reqType)) return false;
        if (selectedType === 'personal' && !['UNPAID', 'VIEC_RIENG'].includes(reqType)) return false;
        if (selectedType === 'compensatory' && !['COMPENSATORY', 'DAY_BU'].includes(reqType)) return false;
        if (selectedType === 'shift_change' && !['SHIFT_CHANGE', 'DOI_CA'].includes(reqType)) return false;
      }

      // 4. Lọc Trạng thái luồng duyệt
      if (selectedWorkflowStatus !== 'all') {
        if (selectedWorkflowStatus === 'step1' && !['PENDING', 'PENDING_DEAN'].includes(req.status)) return false;
        if (selectedWorkflowStatus === 'step2' && req.status !== 'PENDING_BGH') return false;
        if (selectedWorkflowStatus === 'approved' && req.status !== 'APPROVED') return false;
        if (selectedWorkflowStatus === 'rejected' && req.status !== 'REJECTED') return false;
      }

      // 5. Keyword search
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const userName = (applicant?.fullName || '').toLowerCase();
        const staffCode = (applicant?.staffCode || '').toLowerCase();
        const reason = (req.reason || req.ly_do || '').toLowerCase();
        const deptName = (typeof applicant?.departmentId === 'object' ? (applicant?.departmentId as any)?.name : '').toLowerCase();

        const match = userName.includes(q) || staffCode.includes(q) || reason.includes(q) || deptName.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [leaveRequests, onlyMyApproval, selectedDeptId, selectedType, selectedWorkflowStatus, searchKeyword, currentUserId, hasAdminOrLeadershipRole]);

  // Phân trang
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedDeptId, selectedType, selectedWorkflowStatus, onlyMyApproval, datePreset]);

  // =============================================================================
  // MODAL & ACTION HANDLERS
  // =============================================================================

  const openCreateModal = () => {
    if (isAdmin) {
      toast.error('Quản trị viên (Admin) chỉ có thẩm quyền quản trị và xét duyệt đơn, không nộp đơn xin nghỉ phép cá nhân.');
      return;
    }
    setCreateFormData({
      type: 'ANNUAL',
      reason: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      isHalfDay: false,
      scheduleId: schedules[0]?._id || '',
      makeupDate: '',
      file: null,
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.reason.trim() || createFormData.reason.trim().length < 5) {
      toast.error('Lý do xin nghỉ phép phải có ít nhất 5 ký tự');
      return;
    }

    if (new Date(createFormData.endDate) < new Date(createFormData.startDate)) {
      toast.error('Ngày kết thúc không thể trước ngày bắt đầu');
      return;
    }

    if (createFormData.type === 'COMPENSATORY' && (!createFormData.scheduleId || !createFormData.makeupDate)) {
      toast.error('Đơn dạy bù bắt buộc phải chọn lịch học và ngày dạy bù');
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload: CreateLeavePayload = {
        type: createFormData.type,
        reason: createFormData.reason.trim(),
        startDate: createFormData.startDate,
        endDate: createFormData.endDate,
        isHalfDay: createFormData.isHalfDay,
        scheduleId: createFormData.type === 'COMPENSATORY' ? createFormData.scheduleId : undefined,
        makeupDate: createFormData.type === 'COMPENSATORY' ? createFormData.makeupDate : undefined,
        file: createFormData.file || undefined,
      };

      await leaveRequestApi.createLeaveRequest(payload);
      toast.success('Gửi đơn xin nghỉ phép thành công. Đơn đã được chuyển đến cấp xét duyệt.');
      setIsCreateModalOpen(false);
      loadRequests();
    } catch (err: any) {
      console.error('Error creating leave request:', err);
      toast.error(err.response?.data?.message || 'Không thể gửi đơn xin nghỉ phép');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDetailModal = (req: LeaveRequestData) => {
    setSelectedRequest(req);
    setIsDetailModalOpen(true);
  };

  const openApprovalModal = (req: LeaveRequestData, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setApprovalAction(action);
    setApprovalNote('');
    setRejectionReason('');
    setIsApprovalModalOpen(true);
  };

  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (approvalAction === 'REJECT' && (!rejectionReason.trim() || rejectionReason.trim().length < 5)) {
      toast.error('Vui lòng nêu rõ lý do từ chối đơn (tối thiểu 5 ký tự)');
      return;
    }

    setActionSubmitting(true);
    try {
      if (approvalAction === 'APPROVE') {
        await leaveRequestApi.approveLeaveRequest(selectedRequest._id, approvalNote.trim());
        toast.success('Phê duyệt đơn xin nghỉ phép thành công');
      } else {
        await leaveRequestApi.rejectLeaveRequest(selectedRequest._id, rejectionReason.trim());
        toast.success('Đã từ chối đơn xin nghỉ phép');
      }

      setIsApprovalModalOpen(false);
      setIsDetailModalOpen(false);
      loadRequests();
    } catch (err: any) {
      console.error('Error updating approval status:', err);
      toast.error(err.response?.data?.message || 'Thao tác xét duyệt thất bại');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Xuất file CSV (UTF-8 BOM)
  const handleExportCSV = () => {
    if (!filteredRequests.length) {
      toast.error('Không có dữ liệu đơn để xuất file Excel');
      return;
    }
    const headers = ['Mã Đơn', 'Cán Bộ / GV', 'Mã CB', 'Đơn Vị', 'Loại Phép', 'Từ Ngày', 'Đến Ngày', 'Số Ngày', 'Lý Do', 'Trạng Thái', 'Ngày Tạo'];
    const rows = filteredRequests.map((r, i) => {
      const userObj = typeof r.userId === 'object' ? r.userId : null;
      const deptName = typeof userObj?.departmentId === 'object' ? (userObj?.departmentId as any)?.name : (userObj?.departmentId || '--');
      return [
        r._id || `DP-${i + 1}`,
        `"${userObj?.fullName || 'Cán Bộ'}"`,
        `"${userObj?.staffCode || '--'}"`,
        `"${deptName}"`,
        `"${getLeaveTypeMeta(r.type || r.loai_don).label}"`,
        formatDateVN(r.startDate || r.ngay_bat_dau),
        formatDateVN(r.endDate || r.ngay_ket_thuc),
        r.totalDays || r.numberOfDays || r.so_ngay || (r as any).so_ngay_nghi || 1,
        `"${(r.reason || r.ly_do || '').replace(/"/g, '""')}"`,
        `"${getLeaveStatusMeta(r.status || r.trang_thai).label}"`,
        formatDateVN(r.createdAt || (r as any).tao_luc),
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Danh_Sach_Don_Nghi_Phep_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file Excel (.csv) thành công');
  };

  return (
    <div className="flex flex-col w-full space-y-4">
      {/* =========================================================================
          SECTION 1: 4 KPI METRIC CARDS (Bám sát 100% mẫu code.html)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Metric 1: Tổng đơn tháng */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs transition-all hover:shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tổng Đơn Tháng
            </span>
            <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {metrics.totalMonth}
              </span>
              <span className="text-xs text-slate-400">đơn</span>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> +12%
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
            <span>Hạn mức ĐH NTU</span>
            <span className="text-brand-600 dark:text-brand-400 font-medium">82.4% khả dụng</span>
          </div>
        </div>

        {/* Metric 2: Chờ duyệt Cấp 1 */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs transition-all hover:shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Chờ duyệt Cấp 1
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950/60 text-[10px] text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
              {metrics.step1Count} CẦN XỬ LÝ
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {String(metrics.step1Count).padStart(2, '0')}
              </span>
              <span className="text-xs text-slate-400">đơn</span>
            </div>
            {metrics.step1Count > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
            <span>Khoa / Viện trưởng</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">&lt; 24h quy định</span>
          </div>
        </div>

        {/* Metric 3: Chờ duyệt Cấp 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs transition-all hover:shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Chờ duyệt Cấp 2
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
              {metrics.step2Count} TIẾP NHẬN
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {String(metrics.step2Count).padStart(2, '0')}
              </span>
              <span className="text-xs text-slate-400">đơn</span>
            </div>
            <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
            <span>Phòng TCCB &amp; BGH</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-400">Hồ sơ thẩm định</span>
          </div>
        </div>

        {/* Metric 4: Đã Phê Duyệt */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs transition-all hover:shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Đã Duyệt / Hợp Lệ
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
              {metrics.approvalRate}% TỶ LỆ
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {metrics.approvedCount}
              </span>
              <span className="text-xs text-slate-400">đơn</span>
            </div>
            {metrics.rejectedCount > 0 && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.2 rounded font-medium border border-rose-200 dark:border-rose-900">
                {metrics.rejectedCount} Từ chối
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
            <span>Đồng bộ TKB &amp; Kiosk</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% Khớp</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: FILTER & ACTION CENTER (Bám sát 100% mẫu code.html)
         ========================================================================= */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3">
        {/* Row 1: Header and Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-5 rounded-full bg-brand-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              Bộ Lọc &amp; Tra Cứu Đơn Nghỉ Phép
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Tổng số {filteredRequests.length} đơn
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadRequests}
              disabled={loading}
              className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Làm mới bảng dữ liệu"
              type="button"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm Mới</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Xuất dữ liệu Excel"
              type="button"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel (.csv)</span>
            </button>
            {!isAdmin && (
              <button
                onClick={openCreateModal}
                className="h-9 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                type="button"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Đơn Phép Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Input & Quick Date Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên cán bộ, giảng viên, mã CB (NTU-xxx), môn học hoặc lý do..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          <div className="flex items-center h-10 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg shrink-0 border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setDatePreset('all')}
              className={`h-full px-3 rounded-md text-xs font-medium transition-all ${
                datePreset === 'all'
                  ? 'bg-brand-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
            >
              Tất Cả
            </button>
            <button
              onClick={() => setDatePreset('today')}
              className={`h-full px-3 rounded-md text-xs font-medium transition-all ${
                datePreset === 'today'
                  ? 'bg-brand-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
            >
              Hôm Nay
            </button>
            <button
              onClick={() => setDatePreset('week')}
              className={`h-full px-3 rounded-md text-xs font-medium transition-all ${
                datePreset === 'week'
                  ? 'bg-brand-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
            >
              Tuần Này
            </button>
            <button
              onClick={() => setDatePreset('month')}
              className={`h-full px-3 rounded-md text-xs font-medium transition-all ${
                datePreset === 'month'
                  ? 'bg-brand-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
            >
              Tháng Này
            </button>
            <button
              onClick={() => setDatePreset('semester')}
              className={`h-full px-3 rounded-md text-xs font-medium transition-all ${
                datePreset === 'semester'
                  ? 'bg-brand-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              type="button"
            >
              Học Kỳ I
            </button>
          </div>
        </div>

        {/* Row 3: 4 Equal Columns Grid Dropdowns & Filter Checkbox */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Col 1: Khoa / Phòng Ban */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Khoa / Phòng ban
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
            >
              <option value="all">-- Tất cả đơn vị (Toàn trường) --</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Col 2: Hình Thức Nghỉ Phép */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Hình thức nghỉ phép
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
            >
              <option value="all">-- Tất cả loại phép --</option>
              <option value="annual">Nghỉ phép thường niên (Năm)</option>
              <option value="business">Đi công tác / Hội thảo Khoa học</option>
              <option value="sick">Nghỉ ốm / Thai sản (Có BHXH)</option>
              <option value="personal">Việc riêng / Không hưởng lương</option>
              <option value="compensatory">Kế hoạch đăng ký dạy bù</option>
              <option value="shift_change">Đơn xin đổi ca dạy</option>
            </select>
          </div>

          {/* Col 3: Trạng Thái Luồng Duyệt */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Trạng thái luồng duyệt
            </label>
            <select
              value={selectedWorkflowStatus}
              onChange={(e) => setSelectedWorkflowStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
            >
              <option value="all">-- Tất cả trạng thái --</option>
              <option value="step1">Chờ duyệt Cấp 1 (Khoa/Bộ môn)</option>
              <option value="step2">Chờ duyệt Cấp 2 (BGH/TCCB)</option>
              <option value="approved">Đã phê duyệt hoàn tất</option>
              <option value="rejected">Từ chối / Yêu cầu giải trình</option>
            </select>
          </div>

          {/* Col 4: Checkbox Chỉ xem đơn cần tôi duyệt */}
          <div className="flex flex-col space-y-1">
            <span className="invisible text-[11px] leading-tight select-none">Placeholder</span>
            <label className="h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between w-full cursor-pointer select-none transition-colors">
              <span className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium truncate">
                <AlertCircle className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="truncate">Chỉ xem đơn cần tôi duyệt</span>
              </span>
              <input
                type="checkbox"
                checked={onlyMyApproval}
                onChange={(e) => setOnlyMyApproval(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-0 cursor-pointer accent-brand-600"
              />
            </label>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: MAIN DATA TABLE (Fixed Zero Horizontal Scroll - Matching code.html)
         ========================================================================= */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        {/* Table Header Bar */}
        <div className="px-3 sm:px-4 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              Danh sách đơn xin nghỉ phép gần đây
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs font-mono">
            <span>Khóa TKB Kỳ 1 2024-2025</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">Tự động đồng bộ Kiosk</span>
          </div>
        </div>

        {/* Fixed Table: exact percentage columns (24% + 14% + 16% + 18% + 14% + 14% = 100%) */}
        <div className="w-full overflow-hidden">
          <table className="table-fixed w-full text-left border-collapse">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200/60 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3 text-left align-middle truncate">Cán bộ / Giảng viên</th>
                <th className="py-2.5 px-2 text-left align-middle truncate">Loại phép</th>
                <th className="py-2.5 px-2 text-left align-middle truncate">Thời gian nghỉ</th>
                <th className="py-2.5 px-2 text-left align-middle truncate">Kế hoạch dạy thay / Bù</th>
                <th className="py-2.5 px-2 text-center align-middle truncate">Trạng thái duyệt</th>
                <th className="py-2.5 pr-3 pl-2 text-right align-middle truncate">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-brand-600 mx-auto mb-2" />
                    <span className="text-xs">Đang tải danh sách đơn xin nghỉ phép...</span>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Không tìm thấy đơn xin nghỉ phép nào
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {onlyMyApproval
                        ? 'Hiện tại không có đơn nào đang chờ bạn xét duyệt.'
                        : 'Không có bản ghi nào khớp với điều kiện tra cứu hiện tại.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((item) => {
                  const applicant = typeof item.userId === 'object' && item.userId ? item.userId : null;
                  const applicantId: string = applicant?._id || (typeof item.userId === 'string' ? item.userId : '');
                  const isOwner = applicantId === currentUserId;
                  const typeMeta = getLeaveTypeMeta(item.type || item.loai_don);
                  const statusMeta = getLeaveStatusMeta(item.status || item.trang_thai);
                  const TypeIcon = typeMeta.icon;

                  // Parse raw fullName
                  const rawName = applicant?.fullName || 'Cán Bộ';
                  const parenMatch = rawName.match(/^(.*?)\s*\((.*?)\)$/);
                  const displayName = parenMatch ? parenMatch[1].trim() : rawName;
                  const deptTitle =
                    typeof applicant?.departmentId === 'object'
                      ? (applicant?.departmentId as any)?.name
                      : applicant?.departmentId || parenMatch?.[2]?.trim() || applicant?.role || 'NTU';

                  const canApprove =
                    hasAdminOrLeadershipRole &&
                    ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'].includes(item.status) &&
                    !isOwner;

                  const daysCount = item.totalDays || item.numberOfDays || item.so_ngay || (item as any).so_ngay_nghi || 1;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Cột 1: Cán bộ / Giảng viên (24%) */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            name={displayName}
                            avatarUrl={applicant?.avatar}
                            staffCode={applicant?.staffCode || applicantId}
                            size="sm"
                            shape="rounded"
                          />
                          <div className="flex flex-col min-w-0 leading-tight">
                            <span
                              className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 transition-colors"
                              title={displayName}
                            >
                              {displayName}
                            </span>
                            <span
                              className="text-[11px] text-slate-500 font-mono truncate"
                              title={`${applicant?.staffCode || '--'} • ${deptTitle}`}
                            >
                              {applicant?.staffCode || '--'} • {deptTitle}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Loại phép (14%) */}
                      <td className="py-2.5 px-2 align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap truncate max-w-full ${typeMeta.badgeClass}`}
                          title={typeMeta.label}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
                          <span className="truncate">{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Cột 3: Thời gian nghỉ (16%) */}
                      <td className="py-2.5 px-2 align-middle">
                        <div className="flex flex-col text-[12px] font-mono leading-tight whitespace-nowrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatDateVN(item.startDate || item.ngay_bat_dau)}
                            {item.endDate && item.endDate !== item.startDate ? ` → ${formatDateVN(item.endDate || item.ngay_ket_thuc)}` : ''}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {daysCount} ngày
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Kế hoạch dạy thay / Bù (18%) */}
                      <td className="py-2.5 px-2 align-middle">
                        <div className="flex flex-col min-w-0 leading-tight">
                          {(item as any).substituteTeacherId || (item as any).nguoi_day_thay_id ? (
                            <>
                              <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                {typeof (item as any).substituteTeacherId === 'object'
                                  ? (item as any).substituteTeacherId?.fullName
                                  : 'Đã phân công dạy thay'}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate font-mono">
                                {item.scheduleId && typeof item.scheduleId === 'object'
                                  ? (item.scheduleId as any)?.subjectId?.name || 'Môn học'
                                  : 'Kế hoạch giảng dạy'}
                              </span>
                            </>
                          ) : item.makeupDate || (item as any).ngay_day_bu ? (
                            <>
                              <span className="text-[12px] text-amber-600 dark:text-amber-400 font-medium truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                Lịch dạy bù: {formatDateVN(item.makeupDate || (item as any).ngay_day_bu)}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate font-mono">
                                {item.reason || 'Dạy bù theo quy định'}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic truncate">
                              {item.reason ? item.reason : 'Không trùng lịch giảng'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái duyệt (14%, text-center) */}
                      <td className="py-2.5 px-2 align-middle text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap shadow-2xs ${statusMeta.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor} ${
                              statusMeta.isPulse ? 'animate-pulse' : ''
                            }`}
                          />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Cột 6: Thao tác (14%, text-right) */}
                      <td className="py-2.5 pr-3 pl-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {canApprove && (
                            <>
                              <button
                                onClick={() => openApprovalModal(item, 'APPROVE')}
                                className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-600 border border-emerald-300/60 dark:border-emerald-800 shadow-2xs flex items-center justify-center transition-all cursor-pointer"
                                title="Phê duyệt đơn"
                                type="button"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openApprovalModal(item, 'REJECT')}
                                className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 border border-rose-300/60 dark:border-rose-800 shadow-2xs flex items-center justify-center transition-all cursor-pointer"
                                title="Từ chối đơn"
                                type="button"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openDetailModal(item)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center transition-all cursor-pointer"
                            title="Xem chi tiết hồ sơ"
                            type="button"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Pagination & Summary Bar */}
        <div className="px-3 sm:px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-slate-500 font-mono text-xs">
            <span>Hiển thị</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(currentPage * pageSize, filteredRequests.length)}
            </span>
            <span>trong tổng số</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{filteredRequests.length}</span>
            <span>đơn xin nghỉ phép</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`h-8 w-8 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === p
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                type="button"
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: SUPPLEMENTARY POLICY NOTICE BANNER (Bám sát mẫu code.html)
         ========================================================================= */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 shrink-0">
            <Info className="w-5 h-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] text-slate-900 dark:text-slate-100 font-semibold">
              Quy định phê duyệt đơn nghỉ phép - Trường ĐH Nguyễn Trãi (Ban hành 2024)
            </span>
            <span className="text-xs text-slate-500">
              Giảng viên có lịch dạy cần hoàn tất phân công dạy thay hoặc kế hoạch dạy bù trước khi nộp đơn tối thiểu 48 giờ. Đơn trên 3 ngày cần ý kiến trực tiếp của Ban Giám hiệu.
            </span>
          </div>
        </div>
        <button
          onClick={() => toast('Hệ thống đang tích hợp văn bản quy chế điện tử.', { icon: 'ℹ️' })}
          className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline shrink-0 cursor-pointer"
          type="button"
        >
          <span>Xem toàn văn Quy chế</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* =========================================================================
          MODAL 1: TẠO ĐƠN NGHỈ PHÉP MỚI
         ========================================================================= */}
      {isCreateModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-lg overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Tạo Đơn Xin Nghỉ Phép Mới
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gửi đến Trưởng Khoa / Phòng Ban thẩm định &amp; phê duyệt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              {/* Loại nghỉ phép */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hình thức nghỉ phép:
                </label>
                <select
                  value={createFormData.type}
                  onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value as BackendLeaveType })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="ANNUAL">Nghỉ phép thường niên (Trừ vào phép năm)</option>
                  <option value="SICK">Nghỉ ốm đau / Y tế / Thai sản (Có xác nhận y tế)</option>
                  <option value="COMPENSATORY">Đăng ký dạy bù (Có chọn lịch học)</option>
                  <option value="SHIFT_CHANGE">Xin đổi ca dạy với giảng viên khác</option>
                  <option value="UNPAID">Việc riêng không hưởng lương</option>
                </select>
              </div>

              {/* Ngày bắt đầu & Ngày kết thúc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Từ ngày:
                  </label>
                  <input
                    type="date"
                    value={createFormData.startDate}
                    onChange={(e) => setCreateFormData({ ...createFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đến ngày:
                  </label>
                  <input
                    type="date"
                    value={createFormData.endDate}
                    onChange={(e) => setCreateFormData({ ...createFormData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Checkbox nửa ngày & Tính ngày */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createFormData.isHalfDay}
                    onChange={(e) => setCreateFormData({ ...createFormData, isHalfDay: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Chỉ nghỉ nửa ngày (Buổi sáng / chiều)
                  </span>
                </label>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                  {calculatedFormDays} ngày công
                </span>
              </div>

              {/* Lịch học & Ngày dạy bù (nếu là COMPENSATORY) */}
              {createFormData.type === 'COMPENSATORY' && (
                <div className="space-y-2 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="font-bold text-blue-700 dark:text-blue-300">
                    Thông tin lớp học cần dạy bù:
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Chọn lớp học:</label>
                    <select
                      value={createFormData.scheduleId}
                      onChange={(e) => setCreateFormData({ ...createFormData, scheduleId: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Chọn buổi giảng dạy cần bù --</option>
                      {schedules.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.subjectId?.name || 'Môn học'} - Phòng {s.roomId || 'Online'} ({formatDateVN(s.date)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Ngày dạy bù dự kiến:</label>
                    <input
                      type="date"
                      value={createFormData.makeupDate}
                      onChange={(e) => setCreateFormData({ ...createFormData, makeupDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Lý do xin nghỉ */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do xin nghỉ chi tiết:
                </label>
                <textarea
                  value={createFormData.reason}
                  onChange={(e) => setCreateFormData({ ...createFormData, reason: e.target.value })}
                  placeholder="Ghi rõ lý do xin nghỉ phép, kế hoạch bàn giao công việc..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              {/* File đính kèm */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tệp minh chứng đính kèm (nếu có):
                </label>
                <input
                  type="file"
                  onChange={(e) => setCreateFormData({ ...createFormData, file: e.target.files?.[0] || null })}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300 cursor-pointer"
                />
              </div>

              {/* Nút hành động modal */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createSubmitting}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createSubmitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white"
                >
                  {createSubmitting ? 'Đang gửi đơn...' : 'Gửi Đơn Xin Nghỉ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL 2: XEM CHI TIẾT HỒ SƠ ĐƠN & LỊCH SỬ LUỒNG DUYỆT
         ========================================================================= */}
      {isDetailModalOpen && selectedRequest && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-lg overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Chi Tiết Hồ Sơ Đơn Nghỉ Phép
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Mã đơn: {selectedRequest._id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin cán bộ */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
              <UserAvatar
                name={(selectedRequest.userId as any)?.fullName}
                avatarUrl={(selectedRequest.userId as any)?.avatar}
                staffCode={(selectedRequest.userId as any)?.staffCode || (selectedRequest.userId as any)?._id}
                size="lg"
                shape="rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {(selectedRequest.userId as any)?.fullName}
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">
                  Mã CB: {(selectedRequest.userId as any)?.staffCode || '--'} | Email: {(selectedRequest.userId as any)?.email}
                </div>
                <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5 truncate">
                  Đơn vị:{' '}
                  {typeof (selectedRequest.userId as any)?.departmentId === 'object'
                    ? (selectedRequest.userId as any)?.departmentId?.name
                    : (selectedRequest.userId as any)?.departmentId || '--'}
                </div>
              </div>
            </div>

            {/* Chi tiết đơn */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Hình thức nghỉ:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {getLeaveTypeMeta(selectedRequest.type || selectedRequest.loai_don).label}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Tổng số ngày:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">
                  {selectedRequest.totalDays || selectedRequest.numberOfDays || selectedRequest.so_ngay || (selectedRequest as any).so_ngay_nghi || 1} ngày
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 col-span-2">
                <span className="text-slate-400 block mb-0.5">Thời gian nghỉ:</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {formatDateVN(selectedRequest.startDate || selectedRequest.ngay_bat_dau)} → {formatDateVN(selectedRequest.endDate || selectedRequest.ngay_ket_thuc)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 col-span-2">
                <span className="text-slate-400 block mb-0.5">Lý do xin nghỉ:</span>
                <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                  {selectedRequest.reason || selectedRequest.ly_do}
                </p>
              </div>
            </div>

            {/* Rejection Alert nếu có */}
            {selectedRequest.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="font-bold">Lý do từ chối:</strong> {selectedRequest.rejectionReason}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {hasAdminOrLeadershipRole &&
                ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'].includes(selectedRequest.status) &&
                (typeof selectedRequest.userId === 'object' ? (selectedRequest.userId as any)?._id : selectedRequest.userId) !== currentUserId && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openApprovalModal(selectedRequest, 'REJECT');
                      }}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Từ chối đơn
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openApprovalModal(selectedRequest, 'APPROVE');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Phê duyệt đơn
                    </Button>
                  </>
                )}
              <Button size="sm" variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL 3: PHÊ DUYỆT HOẶC TỪ CHỐI ĐƠN NGHỈ PHÉP
         ========================================================================= */}
      {isApprovalModalOpen && selectedRequest && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {approvalAction === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Phê Duyệt Đơn Nghỉ Phép
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    Từ Chối Đơn Nghỉ Phép
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApprovalSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Bạn đang thực hiện {approvalAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'} đơn nghỉ phép của cán bộ{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {(selectedRequest.userId as any)?.fullName}
                </strong>
                .
              </p>

              {approvalAction === 'APPROVE' ? (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú phê duyệt (không bắt buộc):
                  </label>
                  <textarea
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="Đã thu xếp kế hoạch giảng dạy / đồng ý cho nghỉ..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-rose-700 dark:text-rose-400 mb-1">
                    Lý do từ chối (bắt buộc):
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Nêu rõ lý do không đồng ý (trùng lịch thi, chưa có người dạy thay...)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsApprovalModalOpen(false)}
                  disabled={actionSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionSubmitting}
                  className={
                    approvalAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }
                >
                  {actionSubmitting
                    ? 'Đang xử lý...'
                    : approvalAction === 'APPROVE'
                    ? 'Xác Nhận Phê Duyệt'
                    : 'Xác Nhận Từ Chối'}
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
