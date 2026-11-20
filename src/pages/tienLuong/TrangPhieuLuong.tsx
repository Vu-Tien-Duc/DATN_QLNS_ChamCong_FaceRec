import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
import { useAuthStore } from '../../stores/useXacThucStore';
import { departmentApi } from '../../api/phongBan.api';
import * as XLSX from 'xlsx';
import { DepartmentSelect, DepartmentItem } from '../../components/chung/ChonDonVi';
import { Portal } from '../../components/chung/CongDichChuyen';
import { Button } from '../../components/chung/NutBam';
import {
  payrollApi,
  PayrollRecord,
  PayrollSummaryData,
  GeneratePayrollPayload,
} from '../../api/phieuLuong.api';
import { hasRole, isAdmin } from '../../utils/phanQuyen';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
import { ModalKhoiTaoLuong, ModalMoKhoaLuong } from './components/ModalKhoiTaoVaMoKhoaLuong';

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
import { formatVND, formatDateVN } from '../../utils/dinhDang';

function getInsuranceDetail(p?: PayrollRecord | null) {
  if (!p) return { bhxh: 0, bhyt: 0, bhtn: 0, total: 0 };
  const ins = p.bao_hiem || {};
  return {
    bhxh: Number(ins.bhxh ?? 0),
    bhyt: Number(ins.bhyt ?? 0),
    bhtn: Number(ins.bhtn ?? 0),
    total: Number(ins.tong_bao_hiem ?? p.dong_bao_hiem ?? 0),
  };
}

// Helper chuẩn loại trừ tài khoản Quản trị hệ thống IT & Lãnh đạo BGH khỏi Bảng lương
const isSystemAdminUser = (u: any): boolean => {
  if (!u) return false;
  const role = String(u.vai_tro_chinh || '').toLowerCase();
  const code = String(u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || '').toLowerCase();
  const name = String(u.ho_ten || '').toLowerCase();
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
  return Number(p.thue_tncn?.tien_thue ?? p.thue_thu_nhap_ca_nhan ?? 0);
}

const ALLOWANCE_LABELS: Record<string, string> = {
  CHUC_VU: 'Phụ cấp chức vụ lãnh đạo',
  THAM_NIEN: 'Phụ cấp thâm niên nghề giáo',
  UU_DAI_NGHE: 'Phụ cấp ưu đãi nhà giáo',
  TRACH_NHIEM: 'Phụ cấp trách nhiệm',
  DOC_HAI: 'Phụ cấp độc hại',
  KHAC: 'Phụ cấp khác',
};

function getAllowanceRows(p?: PayrollRecord | null): Array<{ label: string; amount: number }> {
  if (!p) return [];
  const rawList = p.danh_sach_phu_cap || [];
  if (rawList.length > 0) {
    return rawList.map((item) => {
      const code = String(item.loai_phu_cap || 'KHAC').toUpperCase();
      const baseLabel = ALLOWANCE_LABELS[code] || item.loai_phu_cap || 'Phụ cấp';
      const rate = Number(item.he_so_hoac_ty_le || 0);
      const label = rate > 0 ? `${baseLabel} (${rate})` : baseLabel;
      return { label, amount: Number(item.so_tien || 0) };
    });
  }
  return [
    { label: 'Phụ cấp chức vụ lãnh đạo', amount: Number(p.phu_cap_chuc_vu || 0) },
    { label: 'Phụ cấp thâm niên nghề giáo', amount: Number(p.phu_cap_tham_nien || 0) },
    { label: 'Phụ cấp ưu đãi nhà giáo', amount: Number(p.phu_cap_uu_dai_nghe || 0) },
  ].filter((item) => item.amount > 0);
}

function getDeductionRows(p?: PayrollRecord | null): Array<{ label: string; amount: number }> {
  if (!p) return [];
  const rawList = p.cac_khoan_giam_tru || [];
  return rawList.map((item) => ({
    label: item.ly_do || 'Khoản giảm trừ lương',
    amount: Number(item.so_tien || 0),
  }));
}

function ChiTietBangLuong({ payroll }: { payroll: PayrollRecord }) {
  const ins = getInsuranceDetail(payroll);
  const tax = getTaxAmount(payroll);
  const actualDays = payroll.so_cong_thuc_te ?? 0;
  const standardDays = payroll.so_cong_chuan ?? 22;
  const actualHours = payroll.gio_giang?.gio_quy_doi_tich_luy ?? payroll.so_tiet_thuc_day ?? 0;
  const quotaHours = payroll.gio_giang?.dinh_muc_goc ?? payroll.so_tiet_nghia_vu ?? 0;
  const overQuotaHours = payroll.gio_giang?.gio_vuot_dinh_muc ?? payroll.so_tiet_vuot_gio ?? 0;
  const hourlyRate = payroll.gio_giang?.don_gia_gio_chuan ?? payroll.don_gia_tiet_vuot ?? 0;
  const overQuotaRemuneration = payroll.gio_giang?.thu_lao_vuot_gio ?? payroll.tien_vuot_gio ?? 0;
  const primarySalary = payroll.luong_chinh ?? Math.max(0, Math.round((payroll.luong_co_ban || 0) * (payroll.he_so_luong ?? 1)) - (payroll.tong_giam_tru || 0));
  const grossIncome = payroll.tong_thu_nhap_gross ?? (primarySalary + (payroll.tong_phu_cap || 0) + overQuotaRemuneration);
  const netSalary = payroll.thuc_linh_net ?? payroll.thuc_linh ?? 0;

  return (
    <div className="space-y-4 text-xs">
      {/* Kỳ công, giờ giảng, mức lương cơ sở & thông tin lập/duyệt */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-[11px]">
        <div>
          <span className="text-slate-400 block">Mức lương cơ sở</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {payroll.luong_co_ban ? formatVND(payroll.luong_co_ban) : '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Ngày công (Thực tế / Chuẩn)</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {actualDays} / {standardDays} ngày
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Giờ giảng (Thực dạy / Nghĩa vụ)</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {actualHours} / {quotaHours} giờ chuẩn
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Người lập phiếu</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
            {payroll.nguoi_lap?.ho_ten || 'Phòng Kế toán'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Ngày tạo phiếu</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {payroll.tao_luc ? new Date(payroll.tao_luc).toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Cập nhật gần nhất</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {payroll.cap_nhat_luc ? new Date(payroll.cap_nhat_luc).toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        {(payroll.nguoi_duyet || payroll.thoi_gian_duyet) && (
          <div className="col-span-2 sm:col-span-3 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-slate-500">
              Người duyệt:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {payroll.nguoi_duyet?.ho_ten || 'Ban Giám Hiệu'}
              </strong>
            </span>
            {payroll.thoi_gian_duyet && (
              <span className="font-mono text-slate-500">
                {new Date(payroll.thoi_gian_duyet).toLocaleString('vi-VN')}
              </span>
            )}
          </div>
        )}
        {payroll.ghi_chu && (
          <div className="col-span-2 sm:col-span-3 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Ghi chú: </span>
            <span>{payroll.ghi_chu}</span>
          </div>
        )}
      </div>

      {/* 1. Thu nhập chịu thuế */}
      <div className="space-y-2">
        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1">
          1. Thu Nhập Chịu Thuế (Gross)
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600 dark:text-slate-400">
              Lương chính (Hệ số: {payroll.he_so_luong}):
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {formatVND(primarySalary)}
            </span>
          </div>
          {getAllowanceRows(payroll).map((item, idx) => (
            <div key={idx} className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatVND(item.amount)}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600 dark:text-slate-400">
              Vượt giờ giảng dạy ({overQuotaHours} giờ × {formatVND(hourlyRate)}):
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              +{formatVND(overQuotaRemuneration)}
            </span>
          </div>
        </div>
        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-bold border border-slate-200/80 dark:border-slate-700/60">
          <span className="text-slate-800 dark:text-slate-200">TỔNG THU NHẬP GROSS:</span>
          <span className="font-mono text-indigo-700 dark:text-indigo-400 text-sm">
            {formatVND(grossIncome)}
          </span>
        </div>
      </div>

      {/* 2. Khấu trừ bảo hiểm & thuế */}
      <div className="space-y-2">
        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1">
          2. Khấu Trừ Bảo Hiểm &amp; Thuế
        </div>
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
          <div className="flex justify-between py-1.5 gap-2">
            <div>
              <span className="text-slate-600 dark:text-slate-400 block">
                Thuế thu nhập cá nhân (Thuế TNCN lũy tiến 5 bậc):
              </span>
              {(() => {
                const pit = payroll.thue_tncn;
                if (!pit) return null;
                const selfDed = pit.giam_tru_ban_than;
                const depDed = pit.giam_tru_phu_thuoc;
                const taxable = pit.thu_nhap_tinh_thue;
                if (selfDed === undefined && taxable === undefined) return null;
                return (
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                    Giảm trừ bản thân: {formatVND(selfDed || 0)} • Người phụ thuộc: {formatVND(depDed || 0)} • Thu nhập tính thuế: {formatVND(taxable || 0)}
                  </span>
                );
              })()}
            </div>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">-{formatVND(tax)}</span>
          </div>
          {getDeductionRows(payroll).map((item, idx) => (
            <div key={idx} className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-400">
                {item.label}{' '}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">(đã trừ vào lương chính)</span>:
              </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatVND(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Thực lĩnh NET */}
      <div className="pt-2">
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between">
          <div>
            <span className="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-xs block">
              THỰC LĨNH CHUYỂN KHOẢN (NET):
            </span>
            <span className="text-[11px] text-slate-400">Thanh toán qua tài khoản ngân hàng</span>
          </div>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xl">
            {formatVND(netSalary)}
          </span>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeCls: string; dotColor: string }
> = {
  nhap: {
    label: 'Bản Nháp',
    badgeCls: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotColor: 'bg-amber-500',
  },
  cho_duyet: {
    label: 'Chờ Duyệt',
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotColor: 'bg-amber-500',
  },
  da_duyet: {
    label: 'Đã Duyệt / Khóa',
    badgeCls: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotColor: 'bg-blue-500',
  },
  da_chi_tra: {
    label: 'Đã Chi Trả',
    badgeCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
};

export const Payroll: React.FC = () => {
  const { user } = useAuthStore();

  // Role permissions
  const isSystemAdmin = useMemo(() => isAdmin(user), [user]);
  const hasNoPersonalPayslip = useMemo(
    () => isSystemAdmin || hasRole(user, ['bgh']),
    [isSystemAdmin, user]
  );

  const canManagePayroll = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']);
  }, [user]);

  const canGeneratePayroll = useMemo(() => {
    return hasRole(user, ['admin', 'ke_toan']);
  }, [user]);

  const canLockOrUnlock = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'ke_toan']);
  }, [user]);

  // Month & Year selection
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Tabs: 'all-payrolls' (Toàn trường) | 'my-payroll' (Phiếu lương của tôi)
  const [activeTab, setActiveTab] = useState<'all-payrolls' | 'my-payroll'>(
    hasNoPersonalPayslip || canManagePayroll ? 'all-payrolls' : 'my-payroll'
  );

  useEffect(() => {
    if (hasNoPersonalPayslip && activeTab === 'my-payroll') {
      setActiveTab('all-payrolls');
    }
  }, [hasNoPersonalPayslip, activeTab]);

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
  const [pageSize, setPageSize] = useState<number>(10);

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
            thang: selectedMonth,
            nam: selectedYear,
            don_vi_id: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
            trang_thai: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          }),
          payrollApi.getPayrollSummary(
            selectedMonth,
            selectedYear,
            selectedDepartment !== 'ALL' ? selectedDepartment : undefined
          ),
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
      const u = p.nguoi_dung;
      return !isSystemAdminUser(u);
    });
    if (!searchKeyword.trim()) return nonAdminPayrolls;
    const kw = searchKeyword.toLowerCase();
    return nonAdminPayrolls.filter((p) => {
      const u = p.nguoi_dung;
      if (!u) return false;
      const name = (u.ho_ten || '').toLowerCase();
      const code = (u.ma_can_bo || '').toLowerCase();
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

  // Xuất file Excel (.xlsx) bảng lương thông qua dữ liệu đã chuẩn hóa & khử công thức từ Backend
  const handleExportExcel = async () => {
    try {
      const exportData = await payrollApi.exportExcel(
        selectedMonth,
        selectedYear,
        selectedDepartment !== 'ALL' ? selectedDepartment : undefined
      );
      const rawRows = Array.isArray(exportData?.rows) ? exportData.rows : [];
      const kw = searchKeyword.trim().toLowerCase();
      const filteredRows = kw
        ? rawRows.filter((row) =>
            String(row.ho_ten || '').toLowerCase().includes(kw) ||
            String(row.ma_can_bo || '').toLowerCase().includes(kw)
          )
        : rawRows;

      if (filteredRows.length === 0) {
        toast.error('Không có dữ liệu bảng lương để xuất file Excel.');
        return;
      }

      const headers = Array.isArray(exportData?.headers) ? exportData.headers : [];
      const dataRows = filteredRows.map((row, idx) => {
        const sheetRow: Record<string, any> = {};
        headers.forEach((h) => {
          if (h.key === 'stt') {
            sheetRow[h.label] = idx + 1;
          } else if (h.key === 'trang_thai') {
            const st = String(row.trang_thai || 'nhap');
            sheetRow[h.label] = STATUS_CONFIG[st]?.label || st;
          } else {
            sheetRow[h.label] = row[h.key] ?? '';
          }
        });
        return sheetRow;
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = headers.map((h) => ({
        wch: h.key === 'stt' ? 6 : ['ho_ten', 'ten_phong_ban', 'tong_thu_nhap_gross', 'thuc_linh_net'].includes(h.key) ? 24 : 16,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Bảng Lương T${selectedMonth}_${selectedYear}`);

      const fileName = `Bang_Luong_NTU_T${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Bảng lương (.xlsx) thành công!');
    } catch (err: any) {
      console.error('Lỗi khi xuất bảng lương Excel:', err);
      toast.error(err.response?.data?.message || 'Lỗi khi đóng gói tệp Excel.');
    }
  };

  // In phiếu lương kèm nạp dữ liệu bản in chuẩn hóa từ Backend
  const handlePrintPayslip = async (payrollId?: string) => {
    if (payrollId) {
      try {
        await payrollApi.exportPdf(payrollId);
      } catch {
        // Fallback giữ nguyên chế độ in trình duyệt nếu gọi API thất bại
      }
    }
    window.print();
  };

  // Generate Payroll
  const handleGeneratePayroll = async () => {
    setIsSubmitting(true);
    try {
      const payload: GeneratePayrollPayload = {
        thang: selectedMonth,
        nam: selectedYear,
        don_vi_id: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
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

    if (summary.da_khoa) {
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
        await payrollApi.lockPayroll({
          thang: selectedMonth,
          nam: selectedYear,
          don_vi_id: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
        });
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
        thang: selectedMonth,
        nam: selectedYear,
        don_vi_id: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
        ly_do: unlockReason.trim(),
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
  const totalNet = summary?.tong_thuc_linh ?? payrolls.reduce((sum, p) => sum + (p.thuc_linh_net ?? p.thuc_linh ?? 0), 0);
  const totalGross = summary?.tong_thu_nhap ?? payrolls.reduce((sum, p) => sum + (p.tong_thu_nhap_gross ?? 0), 0);
  const totalOvertime = summary?.tong_vuot_gio ?? payrolls.reduce((sum, p) => sum + (p.gio_giang?.thu_lao_vuot_gio ?? p.tien_vuot_gio ?? 0), 0);
  const totalDeductions = (summary?.tong_thue_tncn ?? 0) + (summary?.tong_bao_hiem ?? 0);

  return (
    <div className="space-y-4" data-purpose="payroll-management-dashboard">
      <style>{printStyles}</style>
      {/* =========================================================================
          PAGE HEADER (Chuẩn hóa Typography & Bố cục CSDL v2.5)
         ========================================================================= */}
      <PageHeader
        title="Bảng Lương & Phiếu Lương Cán Bộ"
        subtitle="Tính toán lương ngạch bậc theo cấu hình hệ thống • Thù lao vượt giờ chuẩn & thuế TNCN lũy tiến."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-semibold ${
                summary?.da_khoa
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  : summary?.da_khoa_mot_phan
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}
            >
              {summary?.da_khoa ? <Lock className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>
                {summary?.da_khoa
                  ? 'Đã khóa sổ'
                  : summary?.da_khoa_mot_phan
                    ? `Khóa một phần (${summary.so_phieu_da_khoa ?? 0}/${summary.tong_ban_ghi ?? 0})`
                    : 'Sổ dự thảo'}
              </span>
            </span>

            {activeTab === 'all-payrolls' && (
              <>
                <Button
                  onClick={handleExportExcel}
                  variant="outline"
                  size="sm"
                  leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  title="Xuất bảng lương toàn trường ra file Excel (.xlsx)"
                  type="button"
                >
                  Xuất Excel
                </Button>

                {canLockOrUnlock && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleToggleLockPayroll}
                      variant="outline"
                      size="sm"
                      leftIcon={summary?.da_khoa ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      type="button"
                    >
                      {summary?.da_khoa ? 'Mở khóa sổ' : 'Khóa sổ'}
                    </Button>
                    {summary?.da_khoa_mot_phan && (
                      <Button
                        onClick={() => setIsUnlockModalOpen(true)}
                        variant="outline"
                        size="sm"
                        leftIcon={<Unlock className="w-3.5 h-3.5" />}
                        type="button"
                      >
                        Mở khóa phần đã chốt
                      </Button>
                    )}
                  </div>
                )}

                {canGeneratePayroll && (
                  <Button
                    onClick={() => setIsGenerateModalOpen(true)}
                    variant="primary"
                    size="sm"
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                    type="button"
                  >
                    Khởi tạo lương
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* =========================================================================
          UNIFIED PAYROLL WORKSPACE CARD (KPI STRIP + TABS + TOOLBAR + TABLE)
         ========================================================================= */}
      <CompactStatsBar
        items={[
          { label: 'Thực chi (NET)', value: formatVND(totalNet), badge: `${payrolls.length} CB`, subtext: 'Sau khấu trừ thuế & BH', tone: 'success' },
          { label: 'Tổng GROSS', value: formatVND(totalGross), badge: `T${selectedMonth}/${selectedYear}`, subtext: 'Tổng thu nhập trước thuế', tone: 'brand' },
          { label: 'Vượt giờ dạy', value: formatVND(totalOvertime), unit: 'Giờ chuẩn', subtext: 'Phụ cấp vượt định mức', tone: 'warning' },
          { label: 'Thuế & BHXH', value: formatVND(totalDeductions), subtext: 'BHXH, BHYT, BHTN, TNCN', tone: 'neutral' },
        ]}
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        {canManagePayroll && !hasNoPersonalPayslip && (
          <div className="px-3 pt-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-850/40">
            <button
              onClick={() => setActiveTab('all-payrolls')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'all-payrolls'
                  ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              type="button"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Bảng lương toàn trường</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                {payrolls.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('my-payroll')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'my-payroll'
                  ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              type="button"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Phiếu lương cá nhân</span>
            </button>
          </div>
        )}

      {/* =========================================================================
          TAB 1: BẢNG LƯƠNG TOÀN TRƯỜNG / KHOA (PRIMARY)
         ========================================================================= */}
      {activeTab === 'all-payrolls' && (
        <div className="flex flex-col">
          {/* Compact 1-Row Filter Toolbar */}
          <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            {/* Month Navigator */}
            <div className="flex items-center bg-slate-50/80 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/80 dark:border-slate-700 h-9">
              <button
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                type="button"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>
                  T{selectedMonth}/{selectedYear}
                </span>
              </div>
              <button
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                type="button"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleCurrentMonth}
              className="px-3 h-9 rounded-xl bg-slate-50/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200/80 dark:border-slate-700 cursor-pointer"
              type="button"
            >
              Tháng này
            </button>

            {/* Personnel Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-8 bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-slate-800 dark:text-slate-100 text-xs placeholder:text-slate-400 border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-colors"
                placeholder="Tìm tên, mã nhân viên..."
                type="text"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Faculty / Department Select Dropdown Phân Cấp */}
            <div className="w-full sm:w-52 shrink-0">
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
            <div className="relative shrink-0">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-medium appearance-none border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="nhap">Bản nháp</option>
                <option value="cho_duyet">Chờ duyệt</option>
                <option value="da_duyet">Đã duyệt / Khóa sổ</option>
                <option value="da_chi_tra">Đã chi trả</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              className="w-9 h-9 rounded-xl bg-slate-50/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="Làm mới dữ liệu"
              type="button"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Data Table Container */}
          <div className="flex flex-col">
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
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider select-none border-b border-slate-200/70 dark:border-slate-800">
                    <th className="py-3 px-2 text-center">#</th>
                    <th className="py-2.5 px-3.5 truncate">Cán bộ / Giảng viên</th>
                    <th className="py-2.5 px-3.5 truncate">Lương chính (HS)</th>
                    <th className="py-2.5 px-3.5 truncate">Tổng phụ cấp</th>
                    <th className="py-2.5 px-3.5 truncate">Vượt giờ dạy</th>
                    <th className="py-2.5 px-3.5 truncate">Thu nhập Gross</th>
                    <th className="py-2.5 px-3.5 truncate">Bảo hiểm &amp; Thuế</th>
                    <th className="py-2.5 px-3.5 truncate">Thực lĩnh (Net)</th>
                    <th className="py-3 px-2 text-center truncate">Trạng thái</th>
                    <th className="py-3 px-2 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>Đang tải bảng lương...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Không có dữ liệu bảng lương trong Tháng {selectedMonth}/{selectedYear}
                          </span>
                          <p className="text-xs text-slate-400">
                            Hãy nhấn nút &quot;Khởi tạo lương&quot; để hệ thống tự động tính toán bảng lương cho tháng này.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPayrolls.map((p, idx) => {
                      const u = p.nguoi_dung || ({} as any);
                      const deptName = u.don_vi_chinh?.ten_phong_ban || '—';
                      const stt = (currentPage - 1) * pageSize + idx + 1;
                      const ins = getInsuranceDetail(p);
                      const tax = getTaxAmount(p);
                      const primarySalary = p.luong_chinh ?? Math.max(0, Math.round((p.luong_co_ban || 0) * (p.he_so_luong ?? 1)) - (p.tong_giam_tru || 0));
                      const overtimePay = p.gio_giang?.thu_lao_vuot_gio ?? p.tien_vuot_gio ?? 0;
                      const overtimeHours = p.gio_giang?.gio_vuot_dinh_muc ?? p.so_tiet_vuot_gio ?? 0;
                      const accumulatedHours = p.gio_giang?.gio_quy_doi_tich_luy ?? p.so_tiet_thuc_day ?? 0;
                      const quotaHours = p.gio_giang?.dinh_muc_goc ?? p.so_tiet_nghia_vu ?? 0;
                      const grossIncome = p.tong_thu_nhap_gross ?? (primarySalary + (p.tong_phu_cap || 0) + overtimePay);
                      const netSalary = p.thuc_linh_net ?? p.thuc_linh ?? 0;
                      const allowancesTotal = getAllowanceRows(p).reduce((sum, item) => sum + item.amount, 0);
                      const statusInfo = STATUS_CONFIG[p.trang_thai || 'nhap'] || STATUS_CONFIG.nhap;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors whitespace-nowrap group"
                        >
                          {/* STT */}
                          <td className="py-3 px-2 text-center text-sm tabular-nums text-slate-400">
                            {stt}
                          </td>

                          {/* Cán Bộ / Giảng Viên */}
                          <td className="py-2.5 px-3.5 truncate">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar
                                user={u}
                                name={u.ho_ten}
                                avatarUrl={u.anh_dai_dien}
                                staffCode={u.ma_can_bo || u.id}
                                size="sm"
                                shape="circle"
                              />
                              <div className="min-w-0 truncate leading-snug">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                                  {u.ho_ten || '—'}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                                  {u.ma_can_bo || '—'} • {deptName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Lương Chính (Hệ Số) */}
                          <td className="py-2.5 px-3.5 truncate tabular-nums text-slate-800 dark:text-slate-200">
                            <span className="text-sm font-semibold block truncate">{formatVND(primarySalary)}</span>
                            <span className="text-slate-400 text-xs font-normal block truncate">
                              HS {p.he_so_luong ?? 0} • {p.so_cong_thuc_te ?? 0}/{p.so_cong_chuan ?? 22} công
                            </span>
                          </td>

                          {/* Tổng Phụ Cấp */}
                          <td className="py-2.5 px-3.5 truncate text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                            {formatVND(allowancesTotal)}
                          </td>

                          {/* Vượt Giờ Giảng Dạy */}
                          <td className="py-2.5 px-3.5 truncate tabular-nums text-amber-700 dark:text-amber-400">
                            <span className="text-sm font-semibold block truncate">+{formatVND(overtimePay)}</span>
                            <span className="text-slate-400 text-xs font-normal block truncate">
                              {accumulatedHours}/{quotaHours} giờ ({overtimeHours} giờ vượt)
                            </span>
                          </td>

                          {/* Thu Nhập Gross */}
                          <td className="py-2.5 px-3.5 truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {formatVND(grossIncome)}
                          </td>

                          {/* Bảo Hiểm & Thuế */}
                          <td className="py-2.5 px-3.5 truncate text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            BH: {formatVND(ins.total)} | Thuế: {formatVND(tax)}
                          </td>

                          {/* Thực Lĩnh (Net) */}
                          <td className="py-2.5 px-3.5 truncate text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatVND(netSalary)}
                          </td>

                          {/* Trạng Thái */}
                          <td className="py-3 px-2 text-center truncate">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.badgeCls}`}
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
            <ThanhPhanTrang
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredPayrolls.length}
              pageSize={pageSize}
              itemLabel="cán bộ giảng viên"
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PHIẾU LƯƠNG CÁ NHÂN CỦA TÔI (Matching code.html)
         ========================================================================= */}
      {activeTab === 'my-payroll' && (
        <div className="flex flex-col">
          {/* Month selector for My Payroll */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 h-8">
                <button
                  onClick={handlePrevMonth}
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
                  className="w-6 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  type="button"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleCurrentMonth}
                className="px-2.5 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                type="button"
              >
                Tháng Hiện Tại
              </button>
            </div>

            <div className="flex items-center gap-2">
              {myPayroll && (
                <button
                  onClick={() => handlePrintPayslip(myPayroll.id)}
                  className="h-8 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer shadow-xs"
                  type="button"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>In Phiếu Lương</span>
                </button>
              )}
              <button
                onClick={fetchData}
                className="h-8 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
                type="button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm Mới</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span className="text-xs">Đang tải phiếu lương cá nhân...</span>
            </div>
          ) : !myPayroll ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 stroke-[1.5] mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Chưa có phiếu lương</h3>
              <p className="text-xs text-slate-400 mt-1">
                Phiếu lương Tháng {selectedMonth}/{selectedYear} của bạn chưa được tính toán hoặc chưa ban hành.
              </p>
            </div>
          ) : (
            <div id={selectedPayrollDetail ? undefined : 'printable-payslip'} className="p-6 max-w-3xl mx-auto w-full space-y-6">
              {/* Header phiếu lương */}
              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                    NTU
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    ĐẠI HỌC NGUYỄN TRÃI - PHIẾU LƯƠNG CÁ NHÂN
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                  Kỳ thanh toán: Tháng {myPayroll.thang} / Năm {myPayroll.nam}
                </p>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      (STATUS_CONFIG[myPayroll.trang_thai || 'nhap'] || STATUS_CONFIG.nhap).badgeCls
                    }`}
                  >
                    <span>{(STATUS_CONFIG[myPayroll.trang_thai || 'nhap'] || STATUS_CONFIG.nhap).label}</span>
                  </span>
                </div>
              </div>

              {/* Thông tin nhân viên */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">Họ và tên cán bộ:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{myPayroll.nguoi_dung?.ho_ten}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mã cán bộ / Email:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
                    {myPayroll.nguoi_dung?.ma_can_bo || '—'} • {myPayroll.nguoi_dung?.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Đơn vị / Hệ số lương:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {myPayroll.nguoi_dung?.don_vi_chinh?.ten_phong_ban || '—'} • HS {myPayroll.he_so_luong}
                  </span>
                </div>
              </div>

              <ChiTietBangLuong payroll={myPayroll} />
            </div>
          )}
        </div>
      )}
      </div>

      {/* =========================================================================
          MODAL: XEM CHI TIẾT PHIẾU LƯƠNG CỦA CÁN BỘ (Matching code.html)
         ========================================================================= */}
      {selectedPayrollDetail && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
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
                    Tháng {selectedPayrollDetail.thang} / {selectedPayrollDetail.nam}
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
            <div id="printable-payslip" className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={selectedPayrollDetail.nguoi_dung?.ho_ten}
                    avatarUrl={selectedPayrollDetail.nguoi_dung?.anh_dai_dien}
                    staffCode={selectedPayrollDetail.nguoi_dung?.ma_can_bo || selectedPayrollDetail.nguoi_dung?.id}
                    size="md"
                    shape="circle"
                  />
                  <div className="min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Cán bộ / Giảng viên</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
                      {selectedPayrollDetail.nguoi_dung?.ho_ten}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-mono mt-0.5">
                      Mã: {selectedPayrollDetail.nguoi_dung?.ma_can_bo || '—'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Trạng thái</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      (STATUS_CONFIG[selectedPayrollDetail.trang_thai || 'nhap'] || STATUS_CONFIG.nhap).badgeCls
                    }`}
                  >
                    <span>{(STATUS_CONFIG[selectedPayrollDetail.trang_thai || 'nhap'] || STATUS_CONFIG.nhap).label}</span>
                  </span>
                </div>
              </div>

              <ChiTietBangLuong payroll={selectedPayrollDetail} />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => handlePrintPayslip(selectedPayrollDetail.id)}
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

      <ModalKhoiTaoLuong
        isOpen={isGenerateModalOpen}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        selectedDepartment={selectedDepartment}
        departments={departments}
        isSubmitting={isSubmitting}
        onChangeMonth={setSelectedMonth}
        onChangeYear={setSelectedYear}
        onChangeDepartment={setSelectedDepartment}
        onClose={() => setIsGenerateModalOpen(false)}
        onSubmit={handleGeneratePayroll}
      />

      <ModalMoKhoaLuong
        isOpen={isUnlockModalOpen}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        unlockReason={unlockReason}
        isSubmitting={isSubmitting}
        onChangeReason={setUnlockReason}
        onClose={() => {
          setIsUnlockModalOpen(false);
          setUnlockReason('');
        }}
        onSubmit={handleConfirmUnlock}
      />
    </div>
  );
};
