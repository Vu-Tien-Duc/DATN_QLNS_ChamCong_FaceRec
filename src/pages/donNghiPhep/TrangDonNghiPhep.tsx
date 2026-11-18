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
  RefreshCw,
  Eye,
  Check,
  X,
  Loader2,
  CalendarDays,
  CalendarCheck,
  Download,
  ExternalLink,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Info,
  ArrowRight,
  Printer,
  AlertTriangle,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { Portal } from '../../components/chung/CongDichChuyen';
import { DepartmentSelect } from '../../components/chung/ChonDonVi';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import {
  leaveRequestApi,
  LeaveRequestData,
  LeaveBalanceData,
  CreateLeavePayload,
  BackendLeaveType,
} from '../../api/donNghiPhep.api';
import { departmentApi } from '../../api/phongBan.api';
import { scheduleApi } from '../../api/lichTrinh.api';
import { shiftApi } from '../../api/caLamViec.api';
import { userApi } from '../../api/nguoiDung.api';
import { extractArray } from '../../api/apiClient';
import { DepartmentItem, ShiftItem, UserProfile } from '../../types/index';
import { isAdmin as checkIsAdmin, hasRole } from '../../utils/phanQuyen';
import { formatDateVN, formatDateTimeVN } from '../../utils/dinhDang';
import { ModalPheDuyetDon } from './components/ModalPheDuyetDon';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

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
  const norm = (type || '').toLowerCase();
  switch (norm) {
    case 'nghi_phep':
      return {
        label: 'Phép Thường Niên',
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        dotColor: 'bg-primary',
        icon: CalendarCheck,
      };
    case 'day_bu':
      return {
        label: 'Kế Hoạch Dạy Bù',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        icon: CalendarDays,
      };
    case 'doi_ca':
      return {
        label: 'Xin Đổi Ca Dạy',
        badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        dotColor: 'bg-purple-500',
        icon: Clock,
      };
    case 'nghi_om':
      return {
        label: 'Nghỉ Ốm (BHXH)',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotColor: 'bg-rose-500',
        icon: AlertCircle,
      };
    case 'viec_rieng':
      return {
        label: 'Việc Riêng',
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-500',
        icon: FileText,
      };
    case 'giai_trinh_cong':
      return {
        label: 'Giải Trình Chấm Công',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
        icon: Clock,
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
  const norm = (status || '').toLowerCase();
  switch (norm) {
    case 'pending':
    case 'pending_dean':
      return {
        label: 'Chờ Cấp 1 (Khoa)',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        dotColor: 'bg-amber-500',
        isPulse: true,
      };
    case 'pending_bgh':
      return {
        label: 'Chờ Cấp 2 (BGH)',
        badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
        dotColor: 'bg-indigo-600',
        isPulse: false,
      };
    case 'approved':
      return {
        label: 'Đã Phê Duyệt',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        isPulse: false,
      };
    case 'rejected':
      return {
        label: 'Từ Chối',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        dotColor: 'bg-rose-500',
        isPulse: false,
      };
    case 'cancelled':
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
    return hasRole(user, ['admin', 'bgh', 'truong_khoa', 'pho_khoa']);
  }, [user]);

  // Data States
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestData[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tracking broken avatars
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});

  // Filter States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
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

  // Helper kiểm tra URL minh chứng hợp lệ (loại bỏ chuỗi undefined, null từ đơn cũ)
  const isValidAttachmentUrl = useCallback((url?: string | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim().toLowerCase();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
    if (trimmed.endsWith('/undefined') || trimmed.endsWith('/null') || trimmed.includes('/uploads/undefined') || trimmed.includes('/api/uploads/undefined')) return false;
    return true;
  }, []);

  // Helper hàm chuẩn hóa URL minh chứng đính kèm (hỗ trợ kèm token xác thực)
  const getAttachmentFullUrl = useCallback((url?: string | null): string => {
    if (!url) return '';
    let finalUrl = url;
    if (!finalUrl.startsWith('http')) {
      if (!finalUrl.startsWith('/api/tai-tep/tep/')) {
        const clean = finalUrl.split('/').pop()?.replace(/^\/+/, '') || '';
        finalUrl = clean ? `/api/tai-tep/tep/${clean}` : '';
      }
    }
    const token = localStorage.getItem('token');
    if (token) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      return `${finalUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    return finalUrl;
  }, []);

  const isImageAttachment = useCallback((url?: string | null): boolean => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || clean.endsWith('.gif');
  }, []);

  const getAttachmentFileName = useCallback((url?: string | null): string => {
    if (!url) return 'minh-chung.png';
    const clean = url.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'minh-chung.png';
  }, []);

  // Helper hàm ánh xạ tên đơn vị / Khoa / Phòng ban an toàn (chống hiển thị ObjectId trần)
  const resolveDeptName = useCallback((deptRef: any): string => {
    if (!deptRef) return 'ĐH Nguyễn Trãi';
    if (typeof deptRef === 'object' && deptRef !== null) {
      return deptRef.name || deptRef.ten_phong_ban || deptRef.code || 'ĐH Nguyễn Trãi';
    }
    const idStr = String(deptRef).trim();
    const matched = departments.find((d) => d._id === idStr || d.code === idStr);
    if (matched) return matched.name;
    return 'Khoa / Đơn vị';
  }, [departments]);

  // Form State for Creating Leave Request
  const [createFormData, setCreateFormData] = useState<{
    type: BackendLeaveType;
    reason: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    leavePeriods: string;
    scheduleId: string;
    substituteShiftId: string;
    substituteTeacherId: string;
    makeupDate: string;
    file: File | null;
  }>({
    type: 'nghi_phep',
    reason: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isHalfDay: false,
    leavePeriods: '',
    scheduleId: '',
    substituteShiftId: '',
    substituteTeacherId: '',
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
      const [deptRes, balanceRes, schedRes, shiftRes, usersRes] = await Promise.all([
        departmentApi.getDepartmentsFlat().catch(() => ({ data: [] })),
        leaveRequestApi.getLeaveBalance().catch(() => null),
        scheduleApi.getSchedules({ limit: 100 }).catch(() => ({ data: [] })),
        shiftApi.getShifts().catch(() => []),
        userApi.getUsers({ limit: 200 }).catch(() => ({ data: [] })),
      ]);

      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
      if (balanceRes) setLeaveBalance(balanceRes);
      setSchedules(extractArray<any>(schedRes));
      setShifts(extractArray<ShiftItem>(shiftRes));
      setTeachers(extractArray<UserProfile>(usersRes));
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
    const step1Count = leaveRequests.filter((r) => ['pending', 'pending_dean'].includes(r.status)).length;
    const step2Count = leaveRequests.filter((r) => r.status === 'pending_bgh').length;
    const approvedCount = leaveRequests.filter((r) => r.status === 'approved').length;
    const rejectedCount = leaveRequests.filter((r) => r.status === 'rejected').length;
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
        const isPending = ['pending', 'pending_dean', 'pending_bgh'].includes(req.status);
        if (!isPending || isOwner || !hasAdminOrLeadershipRole) {
          return false;
        }
      }

      // 2. Lọc Khoa / Phòng Ban (Hỗ trợ phân cấp Khoa & Bộ môn con)
      if (selectedDeptId && selectedDeptId !== 'all') {
        const userDeptId = String(
          typeof applicant?.departmentId === 'object'
            ? (applicant?.departmentId as any)?._id
            : applicant?.departmentId || ''
        );
        if (userDeptId !== selectedDeptId) {
          const userDept = departments.find((d) => String(d._id) === userDeptId);
          const parentId = userDept?.parentId
            ? (typeof userDept.parentId === 'object' && '_id' in userDept.parentId
                ? String(userDept.parentId._id)
                : String(userDept.parentId))
            : '';
          if (parentId !== selectedDeptId) {
            return false;
          }
        }
      }

      // 3. Lọc Hình thức nghỉ phép
      if (selectedType !== 'all') {
        const reqType = (req.type || req.loai_don || '').toLowerCase();
        if (reqType !== selectedType) return false;
      }

      // 4. Lọc Trạng thái luồng duyệt
      if (selectedWorkflowStatus !== 'all') {
        if (selectedWorkflowStatus === 'step1' && !['pending', 'pending_dean'].includes(req.status)) return false;
        if (selectedWorkflowStatus === 'step2' && req.status !== 'pending_bgh') return false;
        if (selectedWorkflowStatus === 'approved' && req.status !== 'approved') return false;
        if (selectedWorkflowStatus === 'rejected' && req.status !== 'rejected') return false;
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
      type: 'nghi_phep',
      reason: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      isHalfDay: false,
      leavePeriods: '',
      scheduleId: schedules[0]?._id || '',
      substituteShiftId: '',
      substituteTeacherId: '',
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

    if (createFormData.type === 'day_bu' && (!createFormData.scheduleId || !createFormData.makeupDate)) {
      toast.error('Đơn dạy bù bắt buộc phải chọn lịch học và ngày dạy bù');
      return;
    }

    if (
      createFormData.type === 'doi_ca' &&
      !createFormData.substituteShiftId &&
      !createFormData.substituteTeacherId
    ) {
      toast.error('Đơn đổi ca cần chọn ít nhất ca thay thế hoặc giảng viên dạy thay');
      return;
    }

    setCreateSubmitting(true);
    try {
      const parsedPeriods = Number(createFormData.leavePeriods);
      const payload: CreateLeavePayload = {
        type: createFormData.type,
        reason: createFormData.reason.trim(),
        startDate: createFormData.startDate,
        endDate: createFormData.endDate,
        isHalfDay: createFormData.isHalfDay,
        leavePeriods: parsedPeriods > 0 ? parsedPeriods : undefined,
        scheduleId:
          createFormData.type === 'day_bu' || createFormData.type === 'doi_ca'
            ? createFormData.scheduleId || undefined
            : undefined,
        substituteShiftId:
          createFormData.type === 'doi_ca' && createFormData.substituteShiftId
            ? createFormData.substituteShiftId
            : undefined,
        substituteTeacherId:
          createFormData.type === 'doi_ca' && createFormData.substituteTeacherId
            ? createFormData.substituteTeacherId
            : undefined,
        makeupDate: createFormData.type === 'day_bu' ? createFormData.makeupDate : undefined,
        file: createFormData.file || undefined,
      };

      await leaveRequestApi.createLeaveRequest(payload);
      toast.success('Gửi đơn xin nghỉ phép thành công. Đơn đã được chuyển đến cấp xét duyệt.');
      setIsCreateModalOpen(false);
      loadRequests();
      loadMetadata();
    } catch (err: any) {
      console.error('Error creating leave request:', err);
      toast.error(err.response?.data?.message || 'Không thể gửi đơn xin nghỉ phép');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const [selectedApplicantBalance, setSelectedApplicantBalance] = useState<LeaveBalanceData | null>(null);
  const [loadingApplicantBalance, setLoadingApplicantBalance] = useState<boolean>(false);

  const getApproverDisplayName = useCallback((item: LeaveRequestData): string => {
    if (item.approvedBy && typeof item.approvedBy === 'object') {
      return item.approvedBy.fullName || (item.approvedBy as any).ho_ten || 'Lãnh đạo';
    }
    const history = item.approvalHistory || (item as any).lich_su_duyet || [];
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.nguoi_duyet && typeof last.nguoi_duyet === 'object') {
        return last.nguoi_duyet.fullName || (last.nguoi_duyet as any).ho_ten || 'Lãnh đạo';
      }
    }
    return 'Lãnh đạo';
  }, []);

  const getStep1ApproverName = useCallback((item: LeaveRequestData): string => {
    const history = item.approvalHistory || (item as any).lich_su_duyet || [];
    if (history.length > 0) {
      const first = history[0];
      if (first.nguoi_duyet && typeof first.nguoi_duyet === 'object') {
        return first.nguoi_duyet.fullName || (first.nguoi_duyet as any).ho_ten || 'Trưởng khoa';
      }
    }
    return 'Trưởng khoa';
  }, []);

  const openDetailModal = async (req: LeaveRequestData) => {
    setSelectedRequest(req);
    setIsDetailModalOpen(true);
    setSelectedApplicantBalance(null);

    const applicantId = typeof req.userId === 'object' ? req.userId?._id : req.userId;
    if (applicantId) {
      setLoadingApplicantBalance(true);
      try {
        const bal = await leaveRequestApi.getLeaveBalance(applicantId);
        setSelectedApplicantBalance(bal);
      } catch (_) {
        setSelectedApplicantBalance(null);
      } finally {
        setLoadingApplicantBalance(false);
      }
    }
  };

  const openApprovalModal = (req: LeaveRequestData, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setApprovalAction(action);
    setApprovalNote('');
    setRejectionReason('');
    setIsApprovalModalOpen(true);
  };

  const getExpectedVersion = useCallback((req?: LeaveRequestData | null): number | undefined => {
    const updated = req?.updatedAt || (req as any)?.cap_nhat_luc;
    if (!updated) return undefined;
    const ts = new Date(updated).getTime();
    return Number.isFinite(ts) ? ts : undefined;
  }, []);

  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (approvalAction === 'REJECT' && (!rejectionReason.trim() || rejectionReason.trim().length < 5)) {
      toast.error('Vui lòng nêu rõ lý do từ chối đơn (tối thiểu 5 ký tự)');
      return;
    }

    setActionSubmitting(true);
    try {
      const expectedVersion = getExpectedVersion(selectedRequest);
      if (approvalAction === 'APPROVE') {
        await leaveRequestApi.approveLeaveRequest(selectedRequest._id, approvalNote.trim(), expectedVersion);
        toast.success('Phê duyệt đơn xin nghỉ phép thành công');
      } else {
        await leaveRequestApi.rejectLeaveRequest(selectedRequest._id, rejectionReason.trim(), expectedVersion);
        toast.success('Đã từ chối đơn xin nghỉ phép');
      }

      setIsApprovalModalOpen(false);
      setIsDetailModalOpen(false);
      loadRequests();
      loadMetadata();
    } catch (err: any) {
      console.error('Error updating approval status:', err);
      toast.error(err.response?.data?.message || 'Thao tác xét duyệt thất bại');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Xử lý Hủy đơn trực tuyến (Chủ đơn hoặc Admin)
  const handleCancelRequest = async (requestId: string, expectedVersion?: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn này không? Đơn sau khi hủy sẽ không thể hoàn tác.')) {
      return;
    }
    setActionSubmitting(true);
    try {
      await leaveRequestApi.cancelLeaveRequest(requestId, expectedVersion);
      toast.success('Hủy đơn xin nghỉ phép thành công');
      setIsDetailModalOpen(false);
      loadRequests();
      loadMetadata();
    } catch (err: any) {
      console.error('Error cancelling leave request:', err);
      toast.error(err.response?.data?.message || 'Hủy đơn thất bại');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Xuất file Excel chuẩn .xlsx
  const handleExportExcel = () => {
    if (!filteredRequests.length) {
      toast.error('Không có dữ liệu đơn để xuất file Excel');
      return;
    }
    try {
      const dataRows = filteredRequests.map((r, i) => {
        const userObj = typeof r.userId === 'object' ? r.userId : null;
        const deptName = typeof userObj?.departmentId === 'object'
          ? (userObj?.departmentId as any)?.name
          : resolveDeptName(userObj?.departmentId);

        return {
          'STT': i + 1,
          'Mã Đơn': r._id || `DP-${i + 1}`,
          'Họ Và Tên': userObj?.fullName || 'Cán Bộ',
          'Mã Cán Bộ': userObj?.staffCode || '--',
          'Email': userObj?.email || '--',
          'Khoa / Phòng Ban': deptName || '--',
          'Hình Thức Nghỉ Phép': getLeaveTypeMeta(r.type || r.loai_don).label,
          'Từ Ngày': formatDateVN(r.startDate || r.ngay_bat_dau),
          'Đến Ngày': formatDateVN(r.endDate || r.ngay_ket_thuc),
          'Số Ngày Nghỉ': r.totalDays || r.numberOfDays || r.so_ngay || (r as any).so_ngay_nghi || 1,
          'Lý Do': r.reason || r.ly_do || '',
          'Trạng Thái Luồng Duyệt': getLeaveStatusMeta(r.status || r.trang_thai).label,
          'Người Duyệt': getApproverDisplayName(r),
          'Ghi Chú Phê Duyệt': r.approvalNote || '',
          'Lý Do Từ Chối': r.rejectionReason || '',
          'Thời Gian Gửi Đơn': formatDateTimeVN(r.createdAt || (r as any).tao_luc),
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 24 },
        { wch: 24 },
        { wch: 14 },
        { wch: 28 },
        { wch: 26 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 32 },
        { wch: 24 },
        { wch: 22 },
        { wch: 25 },
        { wch: 25 },
        { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Đơn Từ');
      XLSX.writeFile(wb, `Danh_Sach_Don_Nghi_Phep_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success('Đã xuất file Excel (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  return (
    <div className="flex flex-col w-full space-y-4">
      {/* =========================================================================
          1. PAGE HEADER + ACTIONS
         ========================================================================= */}
      <PageHeader
        title="Quản Lý Đơn Xin Nghỉ Phép & Giải Trình"
        subtitle="Phê duyệt 2 cấp, theo dõi quỹ phép năm và đồng bộ lịch giảng dạy."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                loadRequests();
                loadMetadata();
              }}
              disabled={loading}
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              title="Làm mới bảng dữ liệu và số dư phép"
              type="button"
            >
              Làm mới
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất dữ liệu Excel (.xlsx)"
              type="button"
            >
              Xuất Excel
            </Button>
            {!isAdmin && (
              <Button
                onClick={openCreateModal}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                type="button"
              >
                Tạo đơn phép
              </Button>
            )}
          </div>
        }
      />

      {/* =========================================================================
          2. UNIFIED LEAVE WORKSPACE CARD: KPI STRIP + TOOLBAR + TABLE + POLICY
         ========================================================================= */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col">
        <CompactStatsBar
          embedded
          items={[
            { label: 'Tổng đơn tháng', value: metrics.totalMonth, unit: 'đơn', tone: 'neutral' },
            { label: 'Chờ duyệt cấp 1', value: metrics.step1Count, unit: 'đơn', tone: 'warning' },
            { label: 'Chờ duyệt cấp 2', value: metrics.step2Count, unit: 'đơn', tone: 'brand' },
            {
              label: 'Đã duyệt',
              value: metrics.approvedCount,
              badge: `${metrics.approvalRate}%`,
              tone: 'success',
            },
            ...(leaveBalance && !leaveBalance.isAdmin
              ? [
                  {
                    label: `Phép năm ${leaveBalance.year || (leaveBalance as any).nam || new Date().getFullYear()}`,
                    value: `${leaveBalance.availableDays ?? (leaveBalance as any).so_ngay_kha_dung ?? 0}/${
                      leaveBalance.annualLeaveQuota ?? (leaveBalance as any).han_muc_phep_nam ?? 12
                    }`,
                    unit: 'ngày',
                    tone: 'brand' as const,
                  },
                ]
              : []),
          ]}
        />
        {/* Compact Toolbar */}
        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên, mã CB, môn học hoặc lý do..."
                className="w-full h-9 pl-9 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 transition-colors"
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

            {/* Date Preset */}
            <div className="relative h-9 shrink-0">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="h-9 appearance-none pl-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer"
                aria-label="Khoảng thời gian"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="semester">Học kỳ I</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Workflow Status */}
            <div className="relative h-9 shrink-0">
              <select
                value={selectedWorkflowStatus}
                onChange={(e) => setSelectedWorkflowStatus(e.target.value)}
                className="h-9 appearance-none pl-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus:border-brand-500 cursor-pointer"
                aria-label="Trạng thái duyệt"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="step1">Chờ duyệt Cấp 1</option>
                <option value="step2">Chờ duyệt Cấp 2</option>
                <option value="approved">Đã phê duyệt</option>
                <option value="rejected">Từ chối / Giải trình</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Expandable Advanced Filters Button */}
            {(() => {
              const extraCount =
                (selectedDeptId !== 'all' ? 1 : 0) +
                (selectedType !== 'all' ? 1 : 0) +
                (onlyMyApproval ? 1 : 0);
              return (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
                    showAdvancedFilters || extraCount > 0
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

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap">
              {filteredRequests.length} đơn
            </span>
          </div>

          {/* Expandable Secondary Filters Row */}
          {showAdvancedFilters && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs animate-fade-in">
              <div className="w-full sm:w-56">
                <DepartmentSelect
                  departments={departments}
                  value={selectedDeptId === 'all' ? '' : selectedDeptId}
                  onChange={(val) => setSelectedDeptId(val || 'all')}
                  allowAll={true}
                  allLabel="-- Tất cả đơn vị --"
                  placeholder="Chọn Khoa / Đơn vị..."
                  size="sm"
                  className="w-full"
                />
              </div>

              <div className="relative w-full sm:w-56">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-9 appearance-none px-3 pr-7 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="all">-- Tất cả loại phép --</option>
                  <option value="nghi_phep">Nghỉ phép thường niên</option>
                  <option value="day_bu">Đăng ký dạy bù</option>
                  <option value="doi_ca">Đơn xin đổi ca dạy</option>
                  <option value="nghi_om">Nghỉ ốm / Thai sản</option>
                  <option value="viec_rieng">Việc riêng / Không lương</option>
                  <option value="giai_trinh_cong">Giải trình chấm công</option>
                </select>
                <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <label className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMyApproval}
                  onChange={(e) => setOnlyMyApproval(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-0 cursor-pointer accent-brand-600"
                />
                <AlertCircle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-200 font-medium">Chỉ xem đơn cần tôi duyệt</span>
              </label>

              {(selectedDeptId !== 'all' || selectedType !== 'all' || selectedWorkflowStatus !== 'all' || onlyMyApproval || searchKeyword) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    setSelectedDeptId('all');
                    setSelectedType('all');
                    setSelectedWorkflowStatus('all');
                    setOnlyMyApproval(false);
                    setDatePreset('month');
                  }}
                  className="h-9 px-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline ml-auto"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          )}
        </div>

        {/* Responsive Table với thanh cuộn ngang khi màn hình hẹp, đảm bảo không chồng lấn cột Thao tác và Trạng thái */}
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[860px] text-left border-collapse">
            <colgroup>
              <col style={{ width: '21%', minWidth: '180px' }} />
              <col style={{ width: '14%', minWidth: '125px' }} />
              <col style={{ width: '14%', minWidth: '115px' }} />
              <col style={{ width: '21%', minWidth: '160px' }} />
              <col style={{ width: '16%', minWidth: '135px' }} />
              <col style={{ width: '14%', minWidth: '120px' }} />
            </colgroup>
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200/70 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 text-left align-middle truncate">Cán bộ / Giảng viên</th>
                <th className="py-3 px-3 text-left align-middle truncate">Loại phép</th>
                <th className="py-3 px-3 text-left align-middle truncate">Thời gian nghỉ</th>
                <th className="py-3 px-3 text-left align-middle truncate">Lý do &amp; Kế hoạch bù</th>
                <th className="py-3 px-3 text-center align-middle truncate">Trạng thái duyệt</th>
                <th className="py-3 px-3 text-center align-middle truncate">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-sm text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-brand-600 mx-auto mb-2" />
                    <span>Đang tải danh sách đơn xin nghỉ phép...</span>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Không tìm thấy đơn xin nghỉ phép nào
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
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

                  // Parse raw fullName
                  const rawName = applicant?.fullName || 'Cán Bộ';
                  const parenMatch = rawName.match(/^(.*?)\s*\((.*?)\)$/);
                  const displayName = parenMatch ? parenMatch[1].trim() : rawName;
                  const deptTitle = resolveDeptName(applicant?.departmentId || (applicant as any)?.don_vi_chinh_id);
                  const staffCodeDisplay = applicant?.staffCode || (applicant as any)?.ma_can_bo || 'NTU-CB';

                  const canApprove =
                    hasAdminOrLeadershipRole &&
                    ['pending', 'pending_dean', 'pending_bgh'].includes(item.status) &&
                    !isOwner;

                  const canCancel =
                    ['pending', 'pending_dean', 'pending_bgh'].includes(item.status) &&
                    (isOwner || isAdmin);

                  const daysCount = item.totalDays ?? (item as any).so_ngay ?? (item as any).numberOfDays ?? 1;
                  const itemAttachment = item.attachmentUrl || (item as any).tep_dinh_kem;
                  const hasValidAttachment = isValidAttachmentUrl(itemAttachment);

                  return (
                    <tr
                      key={item._id}
                      onClick={() => openDetailModal(item)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      title="Nhấp để xem chi tiết hồ sơ đơn & minh chứng đính kèm"
                    >
                      {/* Cột 1: Cán bộ / Giảng viên */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={displayName}
                            avatarUrl={applicant?.avatar}
                            staffCode={staffCodeDisplay}
                            size="sm"
                            shape="rounded"
                          />
                          <div className="flex flex-col min-w-0 leading-snug">
                            <span
                              className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 transition-colors"
                              title={displayName}
                            >
                              {displayName}
                            </span>
                            <span
                              className="text-xs text-slate-500 dark:text-slate-400 truncate"
                              title={`${staffCodeDisplay} • ${deptTitle}`}
                            >
                              {staffCodeDisplay} • {deptTitle}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Loại phép */}
                      <td className="py-3 px-3 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap truncate max-w-full ${typeMeta.badgeClass}`}
                          title={typeMeta.label}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
                          <span className="truncate">{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Cột 3: Thời gian nghỉ */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col leading-snug whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatDateVN(item.startDate || item.ngay_bat_dau)}
                            {item.endDate && item.endDate !== item.startDate ? ` → ${formatDateVN(item.endDate || item.ngay_ket_thuc)}` : ''}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {daysCount} ngày
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Lý do & Kế hoạch bù / Dẫn chứng */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col min-w-0 leading-snug gap-0.5">
                          <span
                            className="text-sm text-slate-800 dark:text-slate-200 font-medium truncate"
                            title={item.reason || item.ly_do || 'Nghỉ theo kế hoạch'}
                          >
                            {item.reason || item.ly_do || 'Nghỉ theo kế hoạch'}
                          </span>

                          {(item as any).substituteTeacherId ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Dạy thay: {typeof (item as any).substituteTeacherId === 'object'
                                ? (item as any).substituteTeacherId?.fullName || (item as any).substituteTeacherId?.ho_ten
                                : 'Đã phân công'}
                            </span>
                          ) : item.makeupDate || (item as any).ngay_day_bu ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium truncate flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              Dạy bù: {formatDateVN(item.makeupDate || (item as any).ngay_day_bu)}
                            </span>
                          ) : null}

                          {hasValidAttachment && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 w-fit"
                              title="Cán bộ có đính kèm tệp minh chứng"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span>Tệp minh chứng</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái duyệt */}
                      <td className="py-3 px-3 align-middle text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${statusMeta.badgeClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor} ${
                                statusMeta.isPulse ? 'animate-pulse' : ''
                              }`}
                            />
                            {statusMeta.label}
                          </span>
                          {item.status === 'approved' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={`Duyệt bởi: ${getApproverDisplayName(item)}`}>
                              {getApproverDisplayName(item)}
                            </span>
                          )}
                          {item.status === 'pending_bgh' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={`Khoa đã thông qua: ${getStep1ApproverName(item)}`}>
                              Khoa: {getStep1ApproverName(item)}
                            </span>
                          )}
                          {item.status === 'rejected' && (
                            <span className="text-xs text-rose-600 dark:text-rose-400 truncate max-w-[150px]" title={`Từ chối bởi ${getApproverDisplayName(item)}: ${item.rejectionReason || ''}`}>
                              {getApproverDisplayName(item)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 6: Thao tác */}
                      <td className="py-3 px-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-center gap-1">
                          {canApprove && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openApprovalModal(item, 'APPROVE');
                                }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                                title="Phê duyệt đơn"
                                type="button"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openApprovalModal(item, 'REJECT');
                                }}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title="Từ chối đơn"
                                type="button"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {canCancel && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelRequest(item._id, getExpectedVersion(item));
                              }}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                              title="Hủy đơn xin nghỉ"
                              type="button"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(item);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Xem chi tiết đơn"
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
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs tabular-nums">
            <span>Hiển thị</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} –{' '}
              {Math.min(currentPage * pageSize, filteredRequests.length)}
            </span>
            <span>trên tổng số</span>
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

        {/* Supplementary Policy Notice Footer inside Unified Card */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/40 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 shrink-0">
              <Info className="w-4 h-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-slate-900 dark:text-slate-100 font-semibold">
                Quy định phê duyệt đơn nghỉ phép - Trường ĐH Nguyễn Trãi (Ban hành 2024)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
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
      </div>

      {/* =========================================================================
          MODAL 1: TẠO ĐƠN NGHỈ PHÉP MỚI
         ========================================================================= */}
      {isCreateModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            {/* Header: Cố định phía trên */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
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
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form: Thân cuộn mượt + Chân trang cố định */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3.5 text-xs">
                {/* Hạn mức ngày phép năm của bạn */}
                {leaveBalance && !leaveBalance.isAdmin && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-100">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Quỹ Phép Năm Của Bạn ({leaveBalance.year || new Date().getFullYear()}):
                      </span>
                      <span className="font-mono text-xs text-blue-700 dark:text-blue-300 font-bold bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800">
                        Còn {leaveBalance.availableDays} / {leaveBalance.annualLeaveQuota} ngày khả dụng
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-blue-200/50 dark:border-blue-900/40">
                      <div className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/20">
                        <span className="text-slate-500 block text-[10px]">Được phép:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{leaveBalance.annualLeaveQuota} ngày</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/20">
                        <span className="text-slate-500 block text-[10px]">Đã nghỉ:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{leaveBalance.daysUsed} ngày</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/20">
                        <span className="text-slate-500 block text-[10px]">Đang chờ duyệt:</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-mono text-xs">{leaveBalance.pendingAnnualLeaveDays} ngày</strong>
                      </div>
                    </div>
                    {createFormData.type === 'nghi_phep' && calculatedFormDays > leaveBalance.availableDays && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 pt-1 border-t border-rose-200/60 dark:border-rose-900/40">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Số ngày xin nghỉ ({calculatedFormDays} ngày) vượt quá số ngày phép khả dụng ({leaveBalance.availableDays} ngày)!
                      </div>
                    )}
                  </div>
                )}

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
                    <option value="nghi_phep">Nghỉ phép thường niên (Trừ vào phép năm)</option>
                    <option value="day_bu">Đăng ký dạy bù (Có chọn lịch học)</option>
                    <option value="doi_ca">Xin đổi ca dạy với giảng viên khác</option>
                    <option value="nghi_om">Nghỉ ốm đau / Y tế / Thai sản (Có xác nhận y tế)</option>
                    <option value="viec_rieng">Việc riêng không hưởng lương</option>
                    <option value="giai_trinh_cong">Giải trình chấm công (Quên quẹt thẻ / Bổ sung giờ dạy)</option>
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
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setCreateFormData((prev) => ({
                          ...prev,
                          startDate: newStart,
                          endDate: prev.isHalfDay ? newStart : prev.endDate,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Đến ngày:</span>
                      {createFormData.isHalfDay && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">(Khóa trong ngày)</span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={createFormData.isHalfDay ? createFormData.startDate : createFormData.endDate}
                      onChange={(e) => setCreateFormData({ ...createFormData, endDate: e.target.value })}
                      disabled={createFormData.isHalfDay}
                      className={`w-full px-3 py-2 rounded-lg border font-mono transition-colors ${
                        createFormData.isHalfDay
                          ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed select-none'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                      }`}
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
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setCreateFormData((prev) => ({
                          ...prev,
                          isHalfDay: isChecked,
                          endDate: isChecked ? prev.startDate : prev.endDate,
                        }));
                      }}
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

                {/* Số tiết nghỉ giảng dạy (nếu nghỉ theo tiết) */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số tiết nghỉ giảng dạy <span className="font-normal text-slate-400">(không bắt buộc)</span>:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={createFormData.leavePeriods}
                    onChange={(e) => setCreateFormData({ ...createFormData, leavePeriods: e.target.value })}
                    placeholder="Nhập số tiết nếu xin nghỉ/đổi theo tiết (VD: 2 hoặc 4)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                {/* Lịch học & Ngày dạy bù (nếu là day_bu) */}
                {createFormData.type === 'day_bu' && (
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

                {/* Thông tin Đổi ca / Giảng viên dạy thay (nếu là doi_ca) */}
                {createFormData.type === 'doi_ca' && (
                  <div className="space-y-2.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="font-bold text-amber-800 dark:text-amber-300">
                      Thông tin đổi ca / phân công dạy thay:
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Buổi giảng dạy liên quan:</label>
                      <select
                        value={createFormData.scheduleId}
                        onChange={(e) => setCreateFormData({ ...createFormData, scheduleId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Chọn buổi học cần đổi (nếu có) --</option>
                        {schedules.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.subjectId?.name || 'Môn học'} - Phòng {s.roomId || 'Online'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Ca làm việc thay thế:</label>
                      <select
                        value={createFormData.substituteShiftId}
                        onChange={(e) => setCreateFormData({ ...createFormData, substituteShiftId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Chọn ca thay thế --</option>
                        {shifts.map((sh) => (
                          <option key={sh._id} value={sh._id}>
                            {sh.name} ({sh.startTime} - {sh.endTime})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Giảng viên dạy thay:</label>
                      <select
                        value={createFormData.substituteTeacherId}
                        onChange={(e) => setCreateFormData({ ...createFormData, substituteTeacherId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Chọn giảng viên dạy thay --</option>
                        {teachers
                          .filter((t) => t._id !== currentUserId)
                          .map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.fullName} {t.staffCode ? `(${t.staffCode})` : ''}
                            </option>
                          ))}
                      </select>
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
              </div>

              {/* Nút hành động modal cố định ở chân */}
              <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            {/* Header: Cố định trên cùng */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Chi Tiết Hồ Sơ Đơn Nghỉ Phép
                    </h3>
                    {(() => {
                      const sm = getLeaveStatusMeta(selectedRequest.status);
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dotColor} ${sm.isPulse ? 'animate-pulse' : ''}`} />
                          {sm.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Mã đơn: <span className="text-slate-700 dark:text-slate-300 font-semibold">{selectedRequest._id}</span>
                    {selectedRequest.createdAt && (
                      <span className="ml-2 text-slate-400">
                        • Nộp: {formatDateTimeVN(selectedRequest.createdAt)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thân cuộn: Cuộn mượt mà các chi tiết đơn và ảnh minh chứng */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4 text-xs">
              {/* Thông tin cán bộ */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <UserAvatar
                  name={(selectedRequest.userId as any)?.fullName}
                  avatarUrl={(selectedRequest.userId as any)?.avatar}
                  staffCode={(selectedRequest.userId as any)?.staffCode || (selectedRequest.userId as any)?.ma_can_bo || (selectedRequest.userId as any)?._id}
                  size="lg"
                  shape="rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {(selectedRequest.userId as any)?.fullName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      {(selectedRequest.userId as any)?.staffCode || (selectedRequest.userId as any)?.ma_can_bo || 'NTU-CB'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate mt-0.5">
                    Email: {(selectedRequest.userId as any)?.email || 'Chưa cập nhật'}
                  </div>
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5 truncate">
                    Đơn vị: {resolveDeptName((selectedRequest.userId as any)?.departmentId || (selectedRequest.userId as any)?.don_vi_chinh_id)}
                  </div>
                </div>
              </div>

              {/* Hạn mức & Số ngày nghỉ còn lại của Cán bộ (Cho cấp xét duyệt thẩm định) */}
              {loadingApplicantBalance ? (
                <div className="p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/30 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Đang tải thông tin hạn mức phép năm của cán bộ...</span>
                </div>
              ) : selectedApplicantBalance ? (
                <div className="p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Quỹ nghỉ phép năm {selectedApplicantBalance.year || (selectedApplicantBalance as any).nam || new Date().getFullYear()} của cán bộ
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      (selectedApplicantBalance.availableDays ?? (selectedApplicantBalance as any).so_ngay_kha_dung ?? 0) > 0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}>
                      {(selectedApplicantBalance.availableDays ?? (selectedApplicantBalance as any).so_ngay_kha_dung ?? 0) > 0 ? `Còn ${selectedApplicantBalance.availableDays ?? (selectedApplicantBalance as any).so_ngay_kha_dung} ngày khả dụng` : 'Đã hết hạn mức'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Được hưởng</span>
                      <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {selectedApplicantBalance.annualLeaveQuota ?? (selectedApplicantBalance as any).han_muc_phep_nam ?? 12}
                      </strong>
                      <span className="text-[9px] text-slate-400 block">ngày</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Đã nghỉ</span>
                      <strong className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {selectedApplicantBalance.daysUsed ?? (selectedApplicantBalance as any).so_ngay_da_nghi ?? 0}
                      </strong>
                      <span className="text-[9px] text-slate-400 block">ngày</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block uppercase font-medium">Chờ duyệt</span>
                      <strong className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {selectedApplicantBalance.pendingAnnualLeaveDays ?? (selectedApplicantBalance as any).so_ngay_cho_duyet ?? 0}
                      </strong>
                      <span className="text-[9px] text-slate-400 block">ngày</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">Còn lại</span>
                      <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {selectedApplicantBalance.availableDays ?? (selectedApplicantBalance as any).so_ngay_kha_dung ?? 0}
                      </strong>
                      <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 block">ngày</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Chi tiết đơn */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                  <span className="text-slate-400 block mb-1 font-medium">Hình thức nghỉ:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {getLeaveTypeMeta(selectedRequest.type || selectedRequest.loai_don).label}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                  <span className="text-slate-400 block mb-1 font-medium">Tổng số ngày:</span>
                  <span className="font-bold text-base text-brand-600 dark:text-brand-400 font-mono">
                    {selectedRequest.totalDays ?? (selectedRequest as any).so_ngay ?? 1} ngày
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                  <span className="text-slate-400 block mb-1 font-medium">Thời gian nghỉ:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">
                    {formatDateVN(selectedRequest.startDate || selectedRequest.ngay_bat_dau)} → {formatDateVN(selectedRequest.endDate || selectedRequest.ngay_ket_thuc)}
                  </span>
                </div>
                {Number((selectedRequest as any).leavePeriods || 0) > 0 && (
                  <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                    <span className="text-slate-400 block mb-1 font-medium">Số tiết nghỉ giảng dạy:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                      {(selectedRequest as any).leavePeriods} tiết
                    </span>
                  </div>
                )}
                {(selectedRequest as any).substituteShiftId && (
                  <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                    <span className="text-slate-400 block mb-1 font-medium">Ca làm việc thay thế:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {typeof (selectedRequest as any).substituteShiftId === 'object'
                        ? `${(selectedRequest as any).substituteShiftId?.ten_ca || (selectedRequest as any).substituteShiftId?.name} (${(selectedRequest as any).substituteShiftId?.gio_bat_dau || ''}–${(selectedRequest as any).substituteShiftId?.gio_ket_thuc || ''})`
                        : 'Đã chọn ca thay thế'}
                    </span>
                  </div>
                )}
                {(selectedRequest as any).substituteTeacherId && (
                  <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                    <span className="text-slate-400 block mb-1 font-medium">Giảng viên dạy thay:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {typeof (selectedRequest as any).substituteTeacherId === 'object'
                        ? (selectedRequest as any).substituteTeacherId?.fullName || (selectedRequest as any).substituteTeacherId?.ho_ten
                        : 'Đã phân công'}
                    </span>
                  </div>
                )}
                {(selectedRequest as any).approvedAt && (
                  <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40">
                    <span className="text-slate-400 block mb-1 font-medium">Thời gian xét duyệt:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {formatDateTimeVN((selectedRequest as any).approvedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Kế hoạch dạy bù nếu có */}
              {(selectedRequest.makeupDate || (selectedRequest as any).makeupSchedule) && (
                <div className="p-3.5 rounded-xl border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
                  <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" /> Kế hoạch dạy bù đã đăng ký:
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 pl-5">
                    Buổi dạy bù dự kiến: <span className="font-semibold font-mono">{formatDateVN(selectedRequest.makeupDate || (selectedRequest as any).makeupSchedule?.date)}</span>
                  </div>
                </div>
              )}

              {/* Lý do xin nghỉ */}
              <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850/40 space-y-1">
                <span className="text-slate-400 font-medium block">Lý do xin nghỉ:</span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                  {selectedRequest.reason || selectedRequest.ly_do}
                </p>
              </div>

              {/* Dẫn chứng / Tệp minh chứng đính kèm */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    Tài liệu / Ảnh minh chứng (do Giảng viên đính kèm lúc nộp đơn):
                  </span>
                  {isValidAttachmentUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem) && (
                    <a
                      href={getAttachmentFullUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở trong tab mới
                    </a>
                  )}
                </div>

                {isValidAttachmentUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem) ? (
                  <div>
                    {isImageAttachment(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem) ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-white/5 p-2 flex flex-col items-center justify-center">
                        <AnhBaoMat
                          src={getAttachmentFullUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem)}
                          alt="Ảnh minh chứng nghỉ phép"
                          className="max-h-56 sm:max-h-64 w-auto object-contain rounded-lg shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                          onClick={() => window.open(getAttachmentFullUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem), '_blank')}
                        />
                        <span className="text-[10px] text-slate-400 mt-1.5 italic">
                          (Bấm vào ảnh để xem kích thước gốc trong tab mới)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-6 h-6 text-brand-600 dark:text-brand-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {getAttachmentFileName(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem)}
                            </span>
                            <span className="text-[10px] text-slate-400">Tài liệu đính kèm kèm theo đơn</span>
                          </div>
                        </div>
                        <a
                          href={getAttachmentFullUrl(selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 hover:bg-brand-100 transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Tải về
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Cán bộ / Giảng viên không đính kèm tệp minh chứng trong đơn này.
                  </p>
                )}
              </div>

              {/* Tiến trình & Lịch sử phê duyệt đa cấp */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    Tiến Trình & Lịch Sử Phê Duyệt
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {Number(selectedRequest.totalDays ?? (selectedRequest as any).so_ngay ?? 1) > 3 
                      ? 'Quy trình 2 cấp (Đơn > 3 ngày)' 
                      : 'Quy trình 1 cấp (Đơn ≤ 3 ngày)'}
                  </span>
                </div>

                {/* Timeline container */}
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {/* Bước 1: Nộp đơn */}
                  <div className="relative">
                    <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-900">
                      <Check className="w-3 h-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          Bước 1: Nộp hồ sơ đơn nghỉ phép
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Đã gửi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Người nộp: <strong>{(selectedRequest.userId as any)?.fullName || 'Cán bộ'}</strong>
                        {selectedRequest.createdAt && ` • ${formatDateTimeVN(selectedRequest.createdAt)}`}
                      </p>
                    </div>
                  </div>

                  {/* Bước 2: Cấp 1 - Trưởng Khoa / Đơn vị */}
                  {(() => {
                    const history = (selectedRequest.approvalHistory || (selectedRequest as any).lich_su_duyet || []) as any[];
                    const step1 =
                      history.find((h: any) => Number(h.level ?? h.cap_duyet ?? h.cap) === 1) ||
                      (history.length > 0 ? history[0] : null);
                    const isTotalMultiStep = Number(selectedRequest.totalDays ?? (selectedRequest as any).so_ngay ?? 1) > 3;
                    
                    let statusLabel = 'Chờ Trưởng khoa duyệt';
                    let statusBadgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                    let iconBg = 'bg-amber-500 text-white';
                    let IconComponent = Clock;
                    let approverName = 'Trưởng Khoa / Quản lý đơn vị';
                    let actionTime = '';
                    let note = '';

                    if (step1) {
                      approverName = step1.nguoi_duyet?.fullName || (step1.nguoi_duyet as any)?.ho_ten || step1.vai_tro || 'Trưởng khoa';
                      const rawTs = step1.timestamp || step1.thoi_diem || step1.thoi_gian;
                      actionTime = rawTs ? formatDateTimeVN(rawTs) : '';
                      note = step1.comment || step1.y_kien || step1.ghi_chu || '';
                      if (step1.hanh_dong === 'rejected') {
                        statusLabel = 'Từ chối duyệt';
                        statusBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                        iconBg = 'bg-rose-500 text-white';
                        IconComponent = X;
                      } else {
                        statusLabel = isTotalMultiStep ? 'Đã thông qua Cấp 1' : 'Đã phê duyệt';
                        statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                        iconBg = 'bg-emerald-500 text-white';
                        IconComponent = Check;
                      }
                    } else if (selectedRequest.status === 'approved') {
                      statusLabel = 'Đã phê duyệt';
                      statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                      iconBg = 'bg-emerald-500 text-white';
                      IconComponent = Check;
                      approverName = getApproverDisplayName(selectedRequest);
                      actionTime = selectedRequest.updatedAt ? formatDateTimeVN(selectedRequest.updatedAt) : '';
                      note = selectedRequest.approvalNote || '';
                    } else if (selectedRequest.status === 'rejected') {
                      statusLabel = 'Từ chối duyệt';
                      statusBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                      iconBg = 'bg-rose-500 text-white';
                      IconComponent = X;
                      approverName = getApproverDisplayName(selectedRequest);
                      note = selectedRequest.rejectionReason || '';
                    } else if (selectedRequest.status === 'pending_bgh') {
                      statusLabel = 'Đã thông qua Cấp 1';
                      statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                      iconBg = 'bg-emerald-500 text-white';
                      IconComponent = Check;
                      approverName = 'Trưởng khoa';
                    }

                    return (
                      <div className="relative">
                        <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full ${iconBg} flex items-center justify-center ring-4 ring-white dark:ring-slate-900`}>
                          <IconComponent className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Bước 2: Phê duyệt Cấp 1 (Trưởng Khoa / Đơn vị)
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${statusBadgeClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Người xét duyệt: <strong>{approverName}</strong>
                            {actionTime && ` • ${actionTime}`}
                          </p>
                          {note && (
                            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                              <span className="font-medium text-slate-500">Ý kiến duyệt:</span> {note}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bước 3: Cấp 2 - Ban Giám Hiệu (Chỉ với đơn > 3 ngày) */}
                  {(() => {
                    const isTotalMultiStep = Number(selectedRequest.totalDays ?? (selectedRequest as any).so_ngay ?? 1) > 3;
                    if (!isTotalMultiStep) {
                      return (
                        <div className="relative opacity-60">
                          <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center ring-4 ring-white dark:ring-slate-900 text-[10px] font-bold">
                            -
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                Bước 3: Phê chuẩn Cấp 2 (Ban Giám Hiệu)
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Không yêu cầu (Đơn ≤ 3 ngày)
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Đơn nghỉ từ 3 ngày trở xuống do Trưởng khoa phê duyệt hoàn tất.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const history = (selectedRequest.approvalHistory || (selectedRequest as any).lich_su_duyet || []) as any[];
                    const step2 =
                      history.find((h: any) => Number(h.level ?? h.cap_duyet ?? h.cap) === 2) ||
                      (history.length > 1 ? history[1] : null);

                    let statusLabel = 'Chờ BGH phê chuẩn';
                    let statusBadgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                    let iconBg = 'bg-amber-500 text-white';
                    let IconComponent = Clock;
                    let approverName = 'Ban Giám Hiệu / Lãnh đạo trường';
                    let actionTime = '';
                    let note = '';

                    if (step2) {
                      approverName = step2.nguoi_duyet?.fullName || (step2.nguoi_duyet as any)?.ho_ten || 'Ban Giám Hiệu';
                      const rawTs2 = step2.timestamp || step2.thoi_diem || step2.thoi_gian;
                      actionTime = rawTs2 ? formatDateTimeVN(rawTs2) : '';
                      note = step2.comment || step2.y_kien || step2.ghi_chu || '';
                      if (step2.hanh_dong === 'rejected') {
                        statusLabel = 'BGH Từ chối';
                        statusBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                        iconBg = 'bg-rose-500 text-white';
                        IconComponent = X;
                      } else {
                        statusLabel = 'BGH Phê chuẩn';
                        statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                        iconBg = 'bg-emerald-500 text-white';
                        IconComponent = Check;
                      }
                    } else if (selectedRequest.status === 'approved') {
                      statusLabel = 'BGH Phê chuẩn';
                      statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                      iconBg = 'bg-emerald-500 text-white';
                      IconComponent = Check;
                      approverName = getApproverDisplayName(selectedRequest);
                      actionTime = selectedRequest.updatedAt ? formatDateTimeVN(selectedRequest.updatedAt) : '';
                      note = selectedRequest.approvalNote || '';
                    } else if (selectedRequest.status === 'rejected') {
                      statusLabel = 'Dừng luồng';
                      statusBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                      iconBg = 'bg-slate-400 text-white';
                      IconComponent = X;
                      approverName = 'Đơn đã dừng do bị từ chối';
                    } else if (['pending', 'pending_dean'].includes(selectedRequest.status)) {
                      statusLabel = 'Chờ xong Cấp 1';
                      statusBadgeClass = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                      iconBg = 'bg-slate-400 text-white';
                      IconComponent = Clock;
                      approverName = 'Chưa chuyển tới BGH';
                    }

                    return (
                      <div className="relative">
                        <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full ${iconBg} flex items-center justify-center ring-4 ring-white dark:ring-slate-900`}>
                          <IconComponent className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Bước 3: Phê chuẩn Cấp 2 (Ban Giám Hiệu)
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${statusBadgeClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Người phê chuẩn: <strong>{approverName}</strong>
                            {actionTime && ` • ${actionTime}`}
                          </p>
                          {note && (
                            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                              <span className="font-medium text-slate-500">Ý kiến BGH:</span> {note}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Ghi chú phê duyệt cuối cùng nếu có */}
              {selectedRequest.approvalNote && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Ghi chú phê duyệt:</strong> {selectedRequest.approvalNote}
                  </div>
                </div>
              )}

              {/* Rejection Alert nếu có */}
              {selectedRequest.rejectionReason && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Lý do từ chối:</strong> {selectedRequest.rejectionReason}
                  </div>
                </div>
              )}
            </div>

            {/* Chân trang cố định: Trạng thái & Các nút thao tác luôn luôn hiển thị */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between shrink-0 gap-3 z-10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Trạng thái:</span>
                {(() => {
                  const sm = getLeaveStatusMeta(selectedRequest.status);
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sm.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sm.dotColor} ${sm.isPulse ? 'animate-pulse' : ''}`} />
                      {sm.label}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                {hasAdminOrLeadershipRole &&
                  ['pending', 'pending_dean', 'pending_bgh'].includes(selectedRequest.status) &&
                  (typeof selectedRequest.userId === 'object' ? (selectedRequest.userId as any)?._id : selectedRequest.userId) !== currentUserId && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          openApprovalModal(selectedRequest, 'REJECT');
                        }}
                        className="text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Phê duyệt đơn
                      </Button>
                    </>
                  )}
                {/* Nút Hủy đơn cho người tạo đơn hoặc Admin khi đơn đang chờ duyệt */}
                {['pending', 'pending_dean', 'pending_bgh'].includes(selectedRequest.status) &&
                  ((typeof selectedRequest.userId === 'object' ? (selectedRequest.userId as any)?._id : selectedRequest.userId) === currentUserId || isAdmin) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(selectedRequest._id, getExpectedVersion(selectedRequest))}
                      className="text-amber-600 hover:text-amber-700 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Hủy đơn này
                    </Button>
                  )}
                <Button size="sm" variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      <ModalPheDuyetDon
        isOpen={isApprovalModalOpen}
        selectedRequest={selectedRequest}
        approvalAction={approvalAction}
        approvalNote={approvalNote}
        rejectionReason={rejectionReason}
        submitting={actionSubmitting}
        onChangeApprovalNote={setApprovalNote}
        onChangeRejectionReason={setRejectionReason}
        isValidAttachmentUrl={isValidAttachmentUrl}
        getAttachmentFullUrl={getAttachmentFullUrl}
        onClose={() => setIsApprovalModalOpen(false)}
        onSubmit={handleApprovalSubmit}
      />
    </div>
  );
};
