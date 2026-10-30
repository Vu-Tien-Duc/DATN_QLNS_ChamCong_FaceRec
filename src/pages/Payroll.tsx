import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  BookOpen,
  Scale,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  Play,
  Lock,
  Unlock,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  X,
  FileSpreadsheet,
  FileText,
  User,
  ShieldCheck,
  Building2,
  CreditCard,
  Receipt,
  FileCheck,
  Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { departmentApi } from '../api/department.api';
import * as XLSX from 'xlsx';
import { DepartmentSelect, DepartmentItem } from '../components/ui/DepartmentSelect';
import { Portal } from '../components/ui/Portal';
import {
  payrollApi,
  PayrollRecord,
  PayrollSummaryData,
  GeneratePayrollPayload,
} from '../api/payroll.api';
import { hasRole, isAdmin } from '../utils/rbac';
import { UserAvatar } from '../components/ui/UserAvatar';

// =============================================================================
// PRINT STYLES FOR PAYSLIP
// =============================================================================
const printStyles = `
@media print {
  body * {
    visibility: hidden;
  }
  #printable-payslip, #printable-payslip * {
    visibility: visible;
  }
  #printable-payslip {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
    background: white !important;
    color: black !important;
  }
  .no-print {
    display: none !important;
  }
}
`;

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function formatVND(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

function formatDateVN(dateStr?: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getInsuranceDetail(p?: PayrollRecord | null) {
  if (!p) return { bhxh: 0, bhyt: 0, bhtn: 0, total: 0 };
  const ins: any = p.insurance || (p as any).bao_hiem || {};
  return {
    bhxh: ins.socialInsurance ?? ins.bhxh ?? 0,
    bhyt: ins.healthInsurance ?? ins.bhyt ?? 0,
    bhtn: ins.unemploymentInsurance ?? ins.bhtn ?? 0,
    total: ins.totalInsurance ?? ins.tong_bao_hiem ?? 0,
  };
}

// Helper chuẩn loại trừ tài khoản Quản trị hệ thống IT & Lãnh đạo BGH khỏi Bảng lương
const isSystemAdminUser = (u: any): boolean => {
  if (!u) return false;
  const role = String(u.role || u.primaryRole || u.vai_tro_chinh || '').toLowerCase();
  const code = String(u.staffCode || u.employeeId || u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || '').toLowerCase();
  const name = String(u.fullName || u.ho_ten || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'bgh' ||
    role.includes('quản trị') ||
    role.includes('giám hiệu') ||
    code.startsWith('ADMIN') ||
    code.startsWith('BGH') ||
    email.startsWith('admin@') ||
    email.includes('daihocdtd@') ||
    email.startsWith('hieutruong@') ||
    name.includes('quản trị viên') ||
    name.includes('hiệu trưởng') ||
    name.includes('ban giám hiệu')
  );
};


function getTaxAmount(p?: PayrollRecord | null): number {
  if (!p) return 0;
  const pit: any = p.personalIncomeTax || p.thue_tncn || {};
  return pit.taxAmount ?? pit.tien_thue ?? 0;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeCls: string; dotColor: string }
> = {
  du_thao: {
    label: 'Dự Thảo',
    badgeCls: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotColor: 'bg-amber-500',
  },
  cho_duyet: {
    label: 'Chờ Duyệt',
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotColor: 'bg-amber-500',
  },
  da_duyet: {
    label: 'Đã Duyệt',
    badgeCls: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotColor: 'bg-blue-500',
  },
  da_khoa: {
    label: 'Đã Khóa Sổ',
    badgeCls: 'bg-purple-50 text-purple-700 border border-purple-200',
    dotColor: 'bg-purple-500',
  },
  da_thanh_toan: {
    label: 'Đã Chi Trả',
    badgeCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
};

export const Payroll: React.FC = () => {
  const { user } = useAuthStore();

  // Role permissions
  const isSystemAdmin = useMemo(() => isAdmin(user), [user]);

  const canManagePayroll = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'ke_toan', 'truong_khoa']);
  }, [user]);

  const canGeneratePayroll = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'ke_toan']);
  }, [user]);

  const canLockOrUnlock = useMemo(() => {
    return hasRole(user, ['admin', 'bgh']);
  }, [user]);

  // Month & Year selection
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Tabs: 'all-payrolls' (Toàn trường) | 'my-payroll' (Phiếu lương của tôi)
  // Admin IT không có bảng lương cá nhân; Giảng viên/Nhân viên không xem được bảng lương toàn trường
  const [activeTab, setActiveTab] = useState<'all-payrolls' | 'my-payroll'>(
    isSystemAdmin || canManagePayroll ? 'all-payrolls' : 'my-payroll'
  );

  // Đảm bảo Admin luôn ở tab all-payrolls
  useEffect(() => {
    if (isSystemAdmin && activeTab === 'my-payroll') {
      setActiveTab('all-payrolls');
    }
  }, [isSystemAdmin, activeTab]);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Data states
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [myPayroll, setMyPayroll] = useState<PayrollRecord | null>(null);
  const [summary, setSummary] = useState<PayrollSummaryData | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals
  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<PayrollRecord | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await departmentApi.getDepartmentsFlat();
        const list = Array.isArray(res.data) ? res.data : [];
        setDepartments(list);
      } catch {
        // ignore
      }
    };
    fetchDepts();
  }, []);

  // Fetch Payroll Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (canManagePayroll && activeTab === 'all-payrolls') {
        const [records, sum] = await Promise.all([
          payrollApi.getPayrolls({
            month: selectedMonth,
            year: selectedYear,
            departmentId: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
            status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          }),
          payrollApi.getPayrollSummary(selectedMonth, selectedYear),
        ]);
        setPayrolls(records);
        setSummary(sum);
      }

      if (activeTab === 'my-payroll') {
        const mine = await payrollApi.getMyPayroll(selectedMonth, selectedYear);
        setMyPayroll(mine);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải bảng lương:', err);
      toast.error(err.response?.data?.message || 'Không thể tải bảng lương.');
    } finally {
      setIsLoading(false);
    }
  }, [canManagePayroll, activeTab, selectedMonth, selectedYear, selectedDepartment, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered Payroll Records for Client Search (loại trừ hoàn toàn tài khoản Admin IT)
  const filteredPayrolls = useMemo(() => {
    const nonAdminPayrolls = payrolls.filter((p) => {
      const u = p.userId;
      return !isSystemAdminUser(u);
    });
    if (!searchKeyword.trim()) return nonAdminPayrolls;
    const kw = searchKeyword.toLowerCase();
    return nonAdminPayrolls.filter((p) => {
      const u = p.userId;
      if (!u) return false;
      const name = (u.fullName || '').toLowerCase();
      const code = (u.staffCode || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(kw) || code.includes(kw) || email.includes(kw);
    });
  }, [payrolls, searchKeyword]);

  // Paginated records
  const totalPages = Math.ceil(filteredPayrolls.length / pageSize) || 1;
  const paginatedPayrolls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayrolls.slice(start, start + pageSize);
  }, [filteredPayrolls, currentPage, pageSize]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setCurrentPage(1);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
    setCurrentPage(1);
  };

  // Xuất file Excel (.xlsx) bảng lương tài chính chuẩn hóa
  const handleExportExcel = () => {
    if (filteredPayrolls.length === 0) {
      toast.error('Không có dữ liệu bảng lương để xuất file Excel.');
      return;
    }

    try {
      const dataRows = filteredPayrolls.map((p, idx) => {
        const u = p.userId || ({} as any);
        const deptName =
          typeof u.departmentId === 'object' && u.departmentId
            ? u.departmentId.name
            : '—';
        const ins = getInsuranceDetail(p);
        const tax = getTaxAmount(p);
        const positionAllowance = p.positionAllowance || 0;
        const seniorityAllowance = p.seniorityAllowance || 0;
        const vocationalAllowance = p.vocationalAllowance || 0;
        const otherAllowance = (p as any).otherAllowance || (p as any).phu_cap_khac || 0;
        const totalAllowance = positionAllowance + seniorityAllowance + vocationalAllowance + otherAllowance;
        const overQuota = p.teachingHours?.overQuotaRemuneration || 0;

        return {
          'STT': idx + 1,
          'Mã Cán Bộ': u.staffCode || '--',
          'Họ Và Tên': u.fullName || '--',
          'Khoa / Đơn Vị': deptName,
          'Chức Vụ': u.position || '--',
          'Học Vị': u.degree || '--',
          'Ngạch Lương': u.salaryScale || '--',
          'Hệ Số Lương': p.salaryCoefficient || 2.34,
          'Lương Cơ Bản': p.primarySalary || 0,
          'Tổng Phụ Cấp': totalAllowance,
          'Thù Lao Vượt Giờ': overQuota,
          'Tổng Thu Nhập (Gross)': p.grossIncome || 0,
          'BHXH (8%)': ins.bhxh || 0,
          'BHYT (1.5%)': ins.bhyt || 0,
          'BHTN (1%)': ins.bhtn || 0,
          'Tổng Bảo Hiểm (10.5%)': ins.total || 0,
          'Thuế TNCN': tax,
          'Thực Lĩnh (Net)': p.netSalary || 0,
          'Trạng Thái': STATUS_CONFIG[p.status]?.label || p.status,
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 26 },
        { wch: 18 },
        { wch: 14 },
        { wch: 15 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Bảng Lương T${selectedMonth}_${selectedYear}`);

      const fileName = `Bang_Luong_NTU_T${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Bảng lương (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất bảng lương Excel:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // Generate Payroll
  const handleGeneratePayroll = async () => {
    setIsSubmitting(true);
    try {
      const payload: GeneratePayrollPayload = {
        month: selectedMonth,
        year: selectedYear,
        departmentId: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
      };
      await payrollApi.generatePayroll(payload);
      toast.success(
        `Đã khởi tạo và tính toán bảng lương Tháng ${selectedMonth}/${selectedYear} thành công!`
      );
      setIsGenerateModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Lỗi khởi tạo lương:', err);
      toast.error(err.response?.data?.message || 'Không thể khởi tạo bảng lương.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lock / Unlock Payroll
  const handleToggleLockPayroll = async () => {
    if (!summary) return;

    if (summary.isLocked) {
      setIsUnlockModalOpen(true);
    } else {
      if (
        !window.confirm(
          `Bạn có chắc chắn muốn KHÓA SỔ bảng lương Tháng ${selectedMonth}/${selectedYear}? Dữ liệu sau khi khóa sẽ không thể tự ý sửa đổi.`
        )
      ) {
        return;
      }

      setIsSubmitting(true);
      try {
        await payrollApi.lockPayroll({ month: selectedMonth, year: selectedYear });
        toast.success(`Đã khóa sổ bảng lương Tháng ${selectedMonth}/${selectedYear} thành công!`);
        await fetchData();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Không thể khóa sổ bảng lương.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleConfirmUnlock = async () => {
    if (!unlockReason.trim()) {
      toast.error('Vui lòng nhập lý do mở khóa sổ bảng lương');
      return;
    }

    setIsSubmitting(true);
    try {
      await payrollApi.unlockPayroll({
        month: selectedMonth,
        year: selectedYear,
        reason: unlockReason.trim(),
      });
      toast.success(`Đã mở khóa sổ bảng lương Tháng ${selectedMonth}/${selectedYear}!`);
      setIsUnlockModalOpen(false);
      setUnlockReason('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể mở khóa sổ bảng lương.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Computed display stats
  const totalNet = summary?.totalNetSalary || payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const totalGross = summary?.totalGrossSalary || payrolls.reduce((sum, p) => sum + (p.grossIncome || 0), 0);
  const totalOvertime = summary?.totalOvertimePay || payrolls.reduce((sum, p) => sum + (p.teachingHours?.overQuotaRemuneration || 0), 0);
  const totalDeductions = (summary?.totalTax || 0) + (summary?.totalInsurance || 0);

  return (
    <div className="space-y-4" data-purpose="payroll-management-dashboard">
      <style>{printStyles}</style>
      {/* =========================================================================
          TOP CONTEXT HEADER BAR (Matching code.html)
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Quản Lý Bảng Lương &amp; Phiếu Lương
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
              Nghị Định 73/2024/NĐ-CP
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-3xl">
            Tính lương tự động, phụ cấp chức vụ, thâm niên nhà giáo, thù lao vượt giờ giảng dạy và khấu trừ thuế TNCN lũy tiến 5 bậc.
          </p>
        </div>

        {/* Reference Badges on Right */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium shadow-xs">
            <span className="text-slate-400 font-mono text-[11px]">Lương cơ sở:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">2.340.000 đ</span>
          </div>
          {summary?.isLocked ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold shadow-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Đã Khóa Sổ</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold shadow-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>Sổ Dự Thảo (Chưa Khóa)</span>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          NAVIGATION TABS (Matching code.html)
         ========================================================================= */}
      <div className="flex items-center gap-2">
        {canManagePayroll && (
          <button
            onClick={() => setActiveTab('all-payrolls')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all-payrolls'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-transparent'
            }`}
            type="button"
          >
            <CreditCard className="w-4 h-4" />
            <span>Bảng Lương Toàn Trường / Khoa</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold border border-indigo-200/60 dark:border-indigo-800">
              {payrolls.length}
            </span>
          </button>
        )}

        {!isSystemAdmin && (
          <button
            onClick={() => setActiveTab('my-payroll')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'my-payroll'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-transparent'
            }`}
            type="button"
          >
            <Receipt className="w-4 h-4" />
            <span>Phiếu Lương Cá Nhân Của Tôi</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          4 COMPACT FINANCIAL KPI CARDS (Dark Mode Enabled)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: NET Salary */}
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-xs overflow-hidden flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 hover:shadow-sm transition-shadow">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <div className="flex items-center justify-between pl-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Quỹ Lương Thực Chi (NET)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="pl-2 mt-2 flex items-baseline justify-between">
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {formatVND(totalNet)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {payrolls.length} cán bộ
            </span>
          </div>
        </div>

        {/* Card 2: GROSS Income */}
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-xs overflow-hidden flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 hover:shadow-sm transition-shadow">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
          <div className="flex items-center justify-between pl-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Tổng Thu Nhập GROSS
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="pl-2 mt-2 flex items-baseline justify-between">
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatVND(totalGross)}
            </div>
            <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
              T{selectedMonth}/{selectedYear}
            </span>
          </div>
        </div>

        {/* Card 3: Overtime Remuneration */}
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-xs overflow-hidden flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 hover:shadow-sm transition-shadow">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
          <div className="flex items-center justify-between pl-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Thù Lao Vượt Giờ Dạy
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/70 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="pl-2 mt-2 flex items-baseline justify-between">
            <div className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
              {formatVND(totalOvertime)}
            </div>
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 font-normal">
              120k đ/tiết
            </span>
          </div>
        </div>

        {/* Card 4: Taxes & Insurance Deductions */}
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-xs overflow-hidden flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 hover:shadow-sm transition-shadow">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
          <div className="flex items-center justify-between pl-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Thuế TNCN &amp; BHXH (10.5%)
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/70 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="pl-2 mt-2 flex items-baseline justify-between">
            <div className="font-mono text-lg font-bold text-purple-700 dark:text-purple-400">
              {formatVND(totalDeductions)}
            </div>
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              BH: {formatVND(summary?.totalInsurance || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: BẢNG LƯƠNG TOÀN TRƯỜNG / KHOA (Matching code.html)
         ========================================================================= */}
      {activeTab === 'all-payrolls' && (
        <div className="space-y-4">
          {/* Filter & Action Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Left Filters */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Month Navigator */}
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 h-8">
                <button
                  onClick={handlePrevMonth}
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  type="button"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Tháng {selectedMonth} / {selectedYear}
                  </span>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  type="button"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleCurrentMonth}
                className="px-2.5 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                type="button"
              >
                Tháng Hiện Tại
              </button>

              {/* Personnel Search Input */}
              <div className="relative w-56 min-w-[180px]">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-8 pl-8 pr-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-100 text-xs placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Tìm tên, mã nhân viên..."
                  type="text"
                />
              </div>

              {/* Faculty / Department Select Dropdown Phân Cấp */}
              <div className="w-56">
                <DepartmentSelect
                  departments={departments}
                  value={selectedDepartment}
                  onChange={(deptId) => {
                    setSelectedDepartment(deptId);
                    setCurrentPage(1);
                  }}
                  allowAll={true}
                  allLabel="Tất cả đơn vị / khoa"
                  placeholder="Chọn đơn vị / khoa..."
                  size="sm"
                />
              </div>

              {/* Status Select Dropdown */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-7 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-medium appearance-none border border-slate-200 dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="du_thao">Dự thảo</option>
                  <option value="da_khoa">Đã khóa sổ</option>
                  <option value="da_thanh_toan">Đã chi trả</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchData}
                className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Làm mới dữ liệu"
                type="button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Action Group */}
            <div className="flex items-center gap-2 shrink-0">
              {canGeneratePayroll && (
                <button
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  type="button"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Khởi Tạo Lương</span>
                </button>
              )}

              {canLockOrUnlock && (
                <button
                  onClick={handleToggleLockPayroll}
                  className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    summary?.isLocked
                      ? 'bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                  type="button"
                >
                  {summary?.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{summary?.isLocked ? 'Mở Khóa Sổ' : 'Khóa Sổ'}</span>
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="h-8 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer shadow-2xs"
                title="Xuất bảng lương toàn trường ra file Excel (.xlsx)"
                type="button"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Xuất Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Main Data Table Container (Strict Zero-Horizontal-Scroll 10 Cột) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col style={{ width: '3.5%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '8.5%' }} />
                  <col style={{ width: '5%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider select-none border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-2 text-center">#</th>
                    <th className="py-2.5 px-2.5 truncate">Cán Bộ / Giảng Viên</th>
                    <th className="py-2.5 px-2.5 truncate">Lương Chính (Hệ Số)</th>
                    <th className="py-2.5 px-2.5 truncate">Tổng Phụ Cấp</th>
                    <th className="py-2.5 px-2.5 truncate">Vượt Giờ Giảng Dạy</th>
                    <th className="py-2.5 px-2.5 truncate">Thu Nhập Gross</th>
                    <th className="py-2.5 px-2.5 truncate">Bảo Hiểm &amp; Thuế</th>
                    <th className="py-2.5 px-2.5 truncate">Thực Lĩnh (Net)</th>
                    <th className="py-2.5 px-2 text-center truncate">Trạng Thái</th>
                    <th className="py-2.5 px-2 text-center">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs font-medium">Đang tải bảng lương...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                          <span className="text-xs font-semibold text-slate-600">
                            Không có dữ liệu bảng lương trong Tháng {selectedMonth}/{selectedYear}
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Hãy nhấn nút "Khởi Tạo Lương" để hệ thống tự động tính toán bảng lương cho tháng này.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPayrolls.map((p, idx) => {
                      const u = p.userId || ({} as any);
                      const deptName =
                        typeof u.departmentId === 'object' && u.departmentId
                          ? u.departmentId.name
                          : '—';
                      const stt = (currentPage - 1) * pageSize + idx + 1;
                      const ins = getInsuranceDetail(p);
                      const tax = getTaxAmount(p);
                      const overtimePay = p.teachingHours?.overQuotaRemuneration || 0;
                      const overtimeHours = p.teachingHours?.overQuotaHours || 0;
                      const allowancesTotal =
                        (p.positionAllowance || 0) +
                        (p.seniorityAllowance || 0) +
                        (p.vocationalAllowance || 0);
                      const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.du_thao;

                      return (
                        <tr
                          key={p._id}
                          className="hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 transition-colors whitespace-nowrap group"
                        >
                          {/* STT */}
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                            {stt}
                          </td>

                          {/* Cán Bộ / Giảng Viên */}
                          <td className="py-2.5 px-2.5 truncate">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                user={u}
                                name={u.fullName}
                                avatarUrl={(u as any).avatar}
                                staffCode={u.staffCode || u._id}
                                size="xs"
                                shape="rounded"
                              />
                              <div className="min-w-0 truncate">
                                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-900 dark:group-hover:text-indigo-300 truncate block">
                                  {u.fullName || '—'}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 block truncate">
                                  {u.staffCode || '—'} • {deptName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Lương Chính (Hệ Số) */}
                          <td className="py-2.5 px-2.5 truncate font-mono text-slate-800">
                            <span className="font-bold">{formatVND(p.primarySalary)}</span>
                            <span className="text-slate-400 text-[11px] font-normal ml-1">
                              ({p.salaryCoefficient || 2.34})
                            </span>
                          </td>

                          {/* Tổng Phụ Cấp */}
                          <td className="py-2.5 px-2.5 truncate font-mono font-bold text-slate-800">
                            {formatVND(allowancesTotal)}
                          </td>

                          {/* Vượt Giờ Giảng Dạy */}
                          <td className="py-2.5 px-2.5 truncate font-mono font-bold text-amber-700">
                            +{formatVND(overtimePay)}
                            <span className="text-slate-400 text-[10px] font-normal ml-1">
                              ({overtimeHours}h)
                            </span>
                          </td>

                          {/* Thu Nhập Gross */}
                          <td className="py-2.5 px-2.5 truncate font-mono font-bold text-slate-900">
                            {formatVND(p.grossIncome)}
                          </td>

                          {/* Bảo Hiểm & Thuế */}
                          <td className="py-2.5 px-2.5 truncate font-mono text-[11px] text-slate-500">
                            BH: {formatVND(ins.total)} | Thuế: {formatVND(tax)}
                          </td>

                          {/* Thực Lĩnh (Net) */}
                          <td className="py-2.5 px-2.5 truncate font-mono font-bold text-emerald-700 text-xs">
                            {formatVND(p.netSalary)}
                          </td>

                          {/* Trạng Thái */}
                          <td className="py-2.5 px-2 text-center truncate">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.badgeCls}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
                              <span>{statusInfo.label}</span>
                            </span>
                          </td>

                          {/* Chi Tiết */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => setSelectedPayrollDetail(p)}
                              className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                              title="Xem chi tiết phiếu lương"
                              type="button"
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

            {/* Bottom Pagination & Counter Footer */}
            <div className="bg-slate-50/80 dark:bg-slate-900 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div>
                Hiển thị{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {filteredPayrolls.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                  {Math.min(currentPage * pageSize, filteredPayrolls.length)}
                </strong>{' '}
                trên tổng số <strong className="text-slate-800 dark:text-slate-200">{filteredPayrolls.length}</strong> cán bộ giảng viên
              </div>
              <div className="flex items-center gap-1 font-mono">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors ${
                    currentPage <= 1
                      ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                  type="button"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
                  {currentPage}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors ${
                    currentPage >= totalPages
                      ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                  type="button"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PHIẾU LƯƠNG CÁ NHÂN CỦA TÔI (Matching code.html)
         ========================================================================= */}
      {activeTab === 'my-payroll' && (
        <div className="space-y-4">
          {/* Month selector for My Payroll */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-50 rounded-xl p-0.5 border border-slate-200 h-8">
                <button
                  onClick={handlePrevMonth}
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                  type="button"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-2 font-mono text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Tháng {selectedMonth} / {selectedYear}
                  </span>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                  type="button"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleCurrentMonth}
                className="px-2.5 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors border border-slate-200 cursor-pointer"
                type="button"
              >
                Tháng Hiện Tại
              </button>
            </div>

            <div className="flex items-center gap-2">
              {myPayroll && (
                <button
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-xs text-slate-700 font-semibold transition-colors cursor-pointer shadow-xs"
                  type="button"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>In Phiếu Lương</span>
                </button>
              )}
              <button
                onClick={fetchData}
                className="h-8 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 text-xs text-slate-700 font-semibold transition-colors cursor-pointer"
                type="button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm Mới</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200/90 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span className="text-xs">Đang tải phiếu lương cá nhân...</span>
            </div>
          ) : !myPayroll ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200/90 text-center text-slate-400">
              <Receipt className="w-10 h-10 text-slate-300 stroke-[1.5] mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">Chưa có phiếu lương</h3>
              <p className="text-xs text-slate-400 mt-1">
                Phiếu lương Tháng {selectedMonth}/{selectedYear} của bạn chưa được tính toán hoặc chưa ban hành.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs max-w-3xl mx-auto space-y-6">
              {/* Header phiếu lương */}
              <div className="text-center pb-4 border-b border-slate-200">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    NTU
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    ĐẠI HỌC NGUYỄN TRÃI - PHIẾU LƯƠNG CÁ NHÂN
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Kỳ thanh toán: Tháng {myPayroll.month} / Năm {myPayroll.year}
                </p>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      (STATUS_CONFIG[myPayroll.status] || STATUS_CONFIG.du_thao).badgeCls
                    }`}
                  >
                    <span>{(STATUS_CONFIG[myPayroll.status] || STATUS_CONFIG.du_thao).label}</span>
                  </span>
                </div>
              </div>

              {/* Thông tin nhân viên */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">Họ và tên cán bộ:</span>
                  <span className="font-bold text-slate-800 text-sm">{myPayroll.userId?.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mã cán bộ / Email:</span>
                  <span className="font-mono text-slate-700">
                    {myPayroll.userId?.staffCode || '—'} • {myPayroll.userId?.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Hệ số lương:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{myPayroll.salaryCoefficient}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mức lương cơ sở:</span>
                  <span className="font-mono font-bold text-slate-800">{formatVND(myPayroll.baseSalary || 2340000)}</span>
                </div>
              </div>

              {/* Chi tiết các khoản thu nhập & khấu trừ */}
              <div className="space-y-3 text-xs">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1">
                  1. Các Khoản Thu Nhập
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Lương chính theo hệ số:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatVND(myPayroll.primarySalary)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Phụ cấp chức vụ:</span>
                  <span className="font-mono font-bold text-slate-900">{formatVND(myPayroll.positionAllowance)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Phụ cấp thâm niên nghề:</span>
                  <span className="font-mono font-bold text-slate-900">{formatVND(myPayroll.seniorityAllowance)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Phụ cấp ưu đãi giảng dạy:</span>
                  <span className="font-mono font-bold text-slate-900">{formatVND(myPayroll.vocationalAllowance)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Thù lao vượt giờ giảng dạy ({myPayroll.teachingHours?.overQuotaHours || 0} giờ):</span>
                  <span className="font-mono font-bold text-amber-700">+{formatVND(myPayroll.teachingHours?.overQuotaRemuneration)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded-lg font-bold">
                  <span className="text-slate-800">TỔNG THU NHẬP GROSS:</span>
                  <span className="font-mono text-indigo-700">{formatVND(myPayroll.grossIncome)}</span>
                </div>

                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1 pt-2">
                  2. Các Khoản Giảm Trừ
                </div>
                {(() => {
                  const ins = getInsuranceDetail(myPayroll);
                  const tax = getTaxAmount(myPayroll);
                  return (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-600">Bảo hiểm xã hội (BHXH 8%):</span>
                        <span className="font-mono font-bold text-rose-600">-{formatVND(ins.bhxh)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-600">Bảo hiểm y tế (BHYT 1.5%):</span>
                        <span className="font-mono font-bold text-rose-600">-{formatVND(ins.bhyt)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-600">Bảo hiểm thất nghiệp (BHTN 1%):</span>
                        <span className="font-mono font-bold text-rose-600">-{formatVND(ins.bhtn)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-600">Thuế thu nhập cá nhân (Thuế TNCN):</span>
                        <span className="font-mono font-bold text-rose-600">-{formatVND(tax)}</span>
                      </div>
                    </>
                  );
                })()}

                {/* Tổng thực lĩnh */}
                <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between text-sm bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60">
                  <span className="font-bold text-slate-800 uppercase">THỰC LĨNH CHUYỂN KHOẢN (NET):</span>
                  <span className="font-mono font-bold text-emerald-700 text-lg">
                    {formatVND(myPayroll.netSalary)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: XEM CHI TIẾT PHIẾU LƯƠNG CỦA CÁN BỘ (Matching code.html)
         ========================================================================= */}
      {selectedPayrollDetail && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  NTU
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Chi Tiết Phiếu Lương Cán Bộ
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Tháng {selectedPayrollDetail.month} / {selectedPayrollDetail.year} • NĐ 73/2024
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayrollDetail(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={selectedPayrollDetail.userId?.fullName}
                    avatarUrl={(selectedPayrollDetail.userId as any)?.avatar}
                    staffCode={selectedPayrollDetail.userId?.staffCode || selectedPayrollDetail.userId?._id}
                    size="md"
                    shape="rounded"
                  />
                  <div className="min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Cán bộ / Giảng viên</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
                      {selectedPayrollDetail.userId?.fullName}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-mono mt-0.5">
                      Mã: {selectedPayrollDetail.userId?.staffCode || '—'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Trạng thái</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      (STATUS_CONFIG[selectedPayrollDetail.status] || STATUS_CONFIG.du_thao).badgeCls
                    }`}
                  >
                    <span>{(STATUS_CONFIG[selectedPayrollDetail.status] || STATUS_CONFIG.du_thao).label}</span>
                  </span>
                </div>
              </div>

              {/* Thu nhập */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1">
                  1. Thu Nhập Chịu Thuế (Gross)
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Lương chính (Hệ số: {selectedPayrollDetail.salaryCoefficient}):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatVND(selectedPayrollDetail.primarySalary)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Phụ cấp chức vụ lãnh đạo:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatVND(selectedPayrollDetail.positionAllowance)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Phụ cấp thâm niên nghề giáo:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatVND(selectedPayrollDetail.seniorityAllowance)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Phụ cấp ưu đãi nhà giáo (30%):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatVND(selectedPayrollDetail.vocationalAllowance)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600 dark:text-slate-400">
                      Vượt giờ giảng dạy ({selectedPayrollDetail.teachingHours?.overQuotaHours || 0} giờ × 120.000 đ):
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      +{formatVND(selectedPayrollDetail.teachingHours?.overQuotaRemuneration)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-bold border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-slate-800 dark:text-slate-200">TỔNG THU NHẬP GROSS:</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-400 text-sm">{formatVND(selectedPayrollDetail.grossIncome)}</span>
                </div>
              </div>

              {/* Khấu trừ */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1">
                  2. Khấu Trừ Bảo Hiểm &amp; Thuế
                </div>
                {(() => {
                  const ins = getInsuranceDetail(selectedPayrollDetail);
                  const tax = getTaxAmount(selectedPayrollDetail);
                  return (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-600 dark:text-slate-400">Bảo hiểm xã hội (BHXH 8%):</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatVND(ins.bhxh)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-600 dark:text-slate-400">Bảo hiểm y tế (BHYT 1.5%):</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatVND(ins.bhyt)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-600 dark:text-slate-400">Bảo hiểm thất nghiệp (BHTN 1%):</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatVND(ins.bhtn)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-600 dark:text-slate-400">Thuế thu nhập cá nhân (Thuế TNCN lũy tiến 5 bậc):</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatVND(tax)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Thực lĩnh NET */}
              <div className="pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-xs block">THỰC LĨNH CHUYỂN KHOẢN (NET):</span>
                    <span className="text-[11px] text-slate-400">Thanh toán qua tài khoản ngân hàng</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xl">
                    {formatVND(selectedPayrollDetail.netSalary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>In Phiếu Lương</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayrollDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: KHỞI TẠO LƯƠNG
         ========================================================================= */}
      {isGenerateModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Khởi Tạo &amp; Tính Bảng Lương</h3>
                  <p className="text-[11px] text-slate-400">Áp dụng NĐ 73/2024/NĐ-CP toàn trường</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tháng tính lương</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Năm</label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phạm vi tính lương</label>
                <div className="w-full">
                  <DepartmentSelect
                    departments={departments}
                    value={selectedDepartment}
                    onChange={(deptId) => setSelectedDepartment(deptId)}
                    allowAll={true}
                    allLabel="Toàn Trường (Tất cả khoa / phòng ban)"
                    placeholder="Chọn phạm vi đơn vị..."
                    size="md"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-800">
                Hệ thống sẽ tự động quét số tiết giảng dạy, hệ số lương và khấu trừ bảo hiểm để tính ra bảng lương dự thảo cho tháng {selectedMonth}/{selectedYear}.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGeneratePayroll}
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tính toán...' : 'Chạy Tính Lương'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: MỞ KHÓA SỔ BẢNG LƯƠNG
         ========================================================================= */}
      {isUnlockModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <Unlock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Mở Khóa Sổ Bảng Lương</h3>
                <p className="text-xs text-slate-500">
                  Bạn đang yêu cầu mở khóa sổ bảng lương{' '}
                  <strong className="text-slate-800 font-mono">
                    Tháng {selectedMonth}/{selectedYear}
                  </strong>
                  . Hành động này sẽ được ghi nhận vào nhật ký kiểm toán hệ thống.
                </p>

                <div className="text-left pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lý do mở khóa sổ <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                    placeholder="VD: Điều chỉnh bổ sung tiết vượt giờ khoa CNTT theo đề xuất..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  ></textarea>
                </div>

                <div className="pt-3 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      setUnlockReason('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmUnlock}
                    className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang mở khóa...' : 'Xác Nhận Mở Khóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
