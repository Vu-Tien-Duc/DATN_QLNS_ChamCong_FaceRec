import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Plus,
  Search,
  Download,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  X,
  AlertTriangle,
  Timer,
  Calendar,
  Hourglass,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { Button } from '../../components/chung/NutBam';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
import {
  shiftApi,
  ShiftItem,
  CreateShiftPayload,
  UpdateShiftPayload,
} from '../../api/caLamViec.api';
import { hasRole } from '../../utils/phanQuyen';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function calculateDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '--';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '--';

  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  let diff = endTotal - startTotal;
  if (diff <= 0) diff += 24 * 60;

  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

function getShiftPeriodType(startTime?: string): {
  key: 'morning' | 'afternoon' | 'evening';
  label: string;
  icon: any;
  badgeClass: string;
} {
  if (!startTime) {
    return {
      key: 'morning',
      label: 'Buổi Sáng',
      icon: Sun,
      badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60',
    };
  }
  const [h] = startTime.split(':').map(Number);
  if (h < 12) {
    return {
      key: 'morning',
      label: 'Buổi Sáng',
      icon: Sun,
      badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60',
    };
  }
  if (h < 17) {
    return {
      key: 'afternoon',
      label: 'Buổi Chiều',
      icon: Sunset,
      badgeClass: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/60',
    };
  }
  return {
    key: 'evening',
    label: 'Buổi Tối',
    icon: Moon,
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60',
  };
}

// =============================================================================
// MAIN COMPONENT: Shifts
// =============================================================================

export const Shifts: React.FC = () => {
  const { user } = useAuthStore();

  // Data States
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(''); // '', 'morning', 'afternoon', 'evening'
  const [selectedStatus, setSelectedStatus] = useState<string>(''); // '', 'active', 'inactive'

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [viewingShift, setViewingShift] = useState<ShiftItem | null>(null);
  const [deletingShift, setDeletingShift] = useState<ShiftItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    ten_ca: string;
    gio_bat_dau: string;
    gio_ket_thuc: string;
    nguong_di_muon_phut: number;
    kich_hoat: boolean;
  }>({
    ten_ca: '',
    gio_bat_dau: '07:00',
    gio_ket_thuc: '11:30',
    nguong_di_muon_phut: 15,
    kich_hoat: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Permissions
  const canManage = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'dao_tao']);
  }, [user]);

  // ===========================================================================
  // FETCH SHIFTS
  // ===========================================================================
  const fetchShifts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await shiftApi.getShifts();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách ca làm việc:', err);
      toast.error(err.response?.data?.message || 'Không thể tải danh sách ca làm việc.');
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // ===========================================================================
  // FILTERING
  // ===========================================================================
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      // Search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchName = s.ten_ca.toLowerCase().includes(kw);
        const matchTime = `${s.gio_bat_dau} ${s.gio_ket_thuc}`.includes(kw);
        const matchId = (s.id || '').toLowerCase().includes(kw);
        if (!matchName && !matchTime && !matchId) return false;
      }

      // Period Filter
      if (selectedPeriod !== '') {
        const period = getShiftPeriodType(s.gio_bat_dau);
        if (period.key !== selectedPeriod) return false;
      }

      // Status Filter
      if (selectedStatus !== '') {
        const isActiveBool = selectedStatus === 'active';
        if (s.kich_hoat !== isActiveBool) return false;
      }

      return true;
    });
  }, [shifts, searchKeyword, selectedPeriod, selectedStatus]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredShifts.length / pageSize) || 1;
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredShifts.slice(start, start + pageSize);
  }, [filteredShifts, currentPage, pageSize]);

  // ===========================================================================
  // COMPUTED KPIS
  // ===========================================================================
  const kpis = useMemo(() => {
    const totalShifts = shifts.length;
    const activeShifts = shifts.filter((s) => s.kich_hoat).length;

    let totalGrace = 0;
    shifts.forEach((s) => {
      totalGrace += s.nguong_di_muon_phut ?? 15;
    });
    const avgGracePeriod = totalShifts > 0 ? Math.round(totalGrace / totalShifts) : 15;

    // Tìm giờ sớm nhất và muộn nhất
    let earliestTime = '07:00';
    let latestTime = '21:00';
    if (shifts.length > 0) {
      const sortedStart = [...shifts].sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau));
      const sortedEnd = [...shifts].sort((a, b) => b.gio_ket_thuc.localeCompare(a.gio_ket_thuc));
      earliestTime = sortedStart[0]?.gio_bat_dau || '07:00';
      latestTime = sortedEnd[0]?.gio_ket_thuc || '21:00';
    }

    return {
      totalShifts,
      activeShifts,
      avgGracePeriod,
      earliestTime,
      latestTime,
    };
  }, [shifts]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedPeriod('');
    setSelectedStatus('');
    setCurrentPage(1);
    toast.success('Đã làm mới bộ lọc');
  };

  // ===========================================================================
  // EXPORT EXCEL (.XLSX)
  // ===========================================================================
  const handleExportExcel = () => {
    if (filteredShifts.length === 0) {
      toast.error('Không có dữ liệu ca làm việc để xuất file Excel.');
      return;
    }

    try {
      const dataRows = filteredShifts.map((s, idx) => {
        const period = getShiftPeriodType(s.gio_bat_dau);
        return {
          'STT': idx + 1,
          'Mã Ca': s.id.slice(-6).toUpperCase(),
          'Tên Ca Làm Việc': s.ten_ca,
          'Buổi Trong Ngày': period.label,
          'Giờ Bắt Đầu': s.gio_bat_dau,
          'Giờ Kết Thúc': s.gio_ket_thuc,
          'Thời Lượng': calculateDuration(s.gio_bat_dau, s.gio_ket_thuc),
          'Ân Hạn Đi Muộn (Phút)': s.nguong_di_muon_phut ?? 15,
          'Trạng Thái Áp Dụng': s.kich_hoat ? 'Đang áp dụng' : 'Tạm ngưng',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 28 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 22 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Mục Ca Làm Việc');

      const fileName = `Danh_Muc_Ca_Lam_Viec_NTU_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Danh mục ca làm việc (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      toast.error('Không thể xuất file ca làm việc.');
    }
  };

  // ===========================================================================
  // FORM / MODAL HANDLERS
  // ===========================================================================
  const openCreateModal = () => {
    setFormData({
      ten_ca: '',
      gio_bat_dau: '07:00',
      gio_ket_thuc: '11:30',
      nguong_di_muon_phut: 15,
      kich_hoat: true,
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (shift: ShiftItem) => {
    setEditingShift(shift);
    setFormData({
      ten_ca: shift.ten_ca,
      gio_bat_dau: shift.gio_bat_dau,
      gio_ket_thuc: shift.gio_ket_thuc,
      nguong_di_muon_phut: shift.nguong_di_muon_phut ?? 15,
      kich_hoat: shift.kich_hoat ?? true,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ten_ca.trim()) {
      toast.error('Vui lòng nhập tên ca làm việc');
      return;
    }
    if (!formData.gio_bat_dau || !formData.gio_ket_thuc) {
      toast.error('Vui lòng chọn đầy đủ giờ vào và giờ ra');
      return;
    }
    if (formData.gio_bat_dau === formData.gio_ket_thuc) {
      toast.error('Giờ vào và giờ ra không được trùng nhau');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateShiftPayload = {
        ten_ca: formData.ten_ca.trim(),
        gio_bat_dau: formData.gio_bat_dau,
        gio_ket_thuc: formData.gio_ket_thuc,
        nguong_di_muon_phut: Number.isFinite(Number(formData.nguong_di_muon_phut))
          ? Math.max(0, Number(formData.nguong_di_muon_phut))
          : 15,
        kich_hoat: formData.kich_hoat,
      };

      if (editingShift) {
        await shiftApi.updateShift(editingShift.id, payload);
        toast.success('Cập nhật ca làm việc thành công!');
        setEditingShift(null);
      } else {
        await shiftApi.createShift(payload);
        toast.success('Thêm mới ca làm việc thành công!');
        setIsCreateModalOpen(false);
      }

      await fetchShifts();
    } catch (err: any) {
      console.error('Lỗi lưu ca làm việc:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu ca làm việc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deletingShift) return;

    setIsSubmitting(true);
    try {
      await shiftApi.deleteShift(deletingShift.id);
      toast.success('Đã xóa ca làm việc thành công!');
      setDeletingShift(null);
      await fetchShifts();
    } catch (err: any) {
      console.error('Lỗi xóa ca làm việc:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa ca làm việc (có thể đang có lịch sử dụng).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (shift: ShiftItem) => {
    if (!canManage) return;
    setTogglingId(shift.id);
    const newStatus = !shift.kich_hoat;
    try {
      await shiftApi.updateShift(shift.id, {
        kich_hoat: newStatus,
      });
      toast.success(
        `Đã chuyển ca "${shift.ten_ca}" sang ${newStatus ? 'Đang áp dụng' : 'Tạm ngưng'}!`
      );
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, kich_hoat: newStatus } : s))
      );
    } catch (err: any) {
      console.error('Lỗi đổi trạng thái ca:', err);
      toast.error(err.response?.data?.message || 'Không thể đổi trạng thái ca làm việc.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4" data-purpose="shift-configuration-dashboard">
      {/* =========================================================================
          1. PAGE HEADER + ACTIONS
         ========================================================================= */}
      <PageHeader
        title="Quản Lý Ca Làm Việc & Khung Giờ"
        subtitle="Cấu hình khung giờ bắt đầu, kết thúc và giới hạn đi muộn, về sớm theo từng ca."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={fetchShifts}
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              type="button"
            >
              Làm mới
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất danh mục ca làm việc ra file Excel (.xlsx)"
              type="button"
            >
              Xuất Excel
            </Button>
            {canManage && (
              <Button
                onClick={openCreateModal}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                type="button"
              >
                Thêm ca làm
              </Button>
            )}
          </div>
        }
      />

      {/* =========================================================================
          2. UNIFIED WORKSPACE CARD: KPI STRIP + TOOLBAR + DATA TABLE
         ========================================================================= */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng số ca',
            value: kpis.totalShifts,
            unit: 'ca',
            subtext: 'Cấu hình toàn trường',
            tone: 'neutral',
            active: selectedStatus === '',
            onClick: () => {
              setSelectedStatus('');
              setCurrentPage(1);
            },
          },
          {
            label: 'Đang áp dụng',
            value: kpis.activeShifts,
            badge: `${kpis.totalShifts > 0 ? Math.round((kpis.activeShifts / kpis.totalShifts) * 100) : 0}%`,
            progress: kpis.totalShifts > 0 ? Math.round((kpis.activeShifts / kpis.totalShifts) * 100) : 0,
            tone: 'success',
            active: selectedStatus === 'active',
            onClick: () => {
              setSelectedStatus((prev) => (prev === 'active' ? '' : 'active'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Ân hạn đi muộn',
            value: kpis.avgGracePeriod,
            unit: 'phút TB',
            subtext: 'Ngưỡng cho phép',
            tone: 'warning',
          },
          {
            label: 'Khung giờ trường',
            value: `${kpis.earliestTime} – ${kpis.latestTime}`,
            subtext: 'Sớm nhất đến muộn nhất',
            tone: 'brand',
          },
        ]}
      />

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden" data-purpose="shift-table-card">
        <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-9 pr-8 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-colors"
              placeholder="Tìm theo tên ca, khung giờ (VD: Ca Sáng, 07:00)..."
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

          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">Tất cả buổi</option>
            <option value="morning">Buổi Sáng</option>
            <option value="afternoon">Buổi Chiều</option>
            <option value="evening">Buổi Tối</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang áp dụng</option>
            <option value="inactive">Tạm ngưng</option>
          </select>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap">
            {filteredShifts.length} / {shifts.length} ca
          </span>
        </div>

        {/* Table: table-fixed with Zero Horizontal Scrollbar */}
        <div className="w-full overflow-x-auto">
          <table className="table-fixed min-w-[780px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="w-[20%] py-3 pl-4 pr-2 font-semibold">Tên ca làm việc</th>
                <th className="w-[13%] py-3 px-2 font-semibold">Buổi trong ngày</th>
                <th className="w-[11%] py-3 px-2 text-center font-semibold">Giờ vào (IN)</th>
                <th className="w-[11%] py-3 px-2 text-center font-semibold">Giờ ra (OUT)</th>
                <th className="w-[11%] py-3 px-2 font-semibold">Thời lượng ca</th>
                <th className="w-[11%] py-3 px-2 font-semibold">Ân hạn trễ</th>
                <th className="w-[13%] py-2.5 px-3.5 text-center font-semibold">Trạng thái</th>
                <th className="w-[10%] py-3 pl-2 pr-4 text-center font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang tải cấu hình ca làm việc...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Không tìm thấy ca làm việc nào</span>
                      <p className="text-xs text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedShifts.map((s) => {
                  const period = getShiftPeriodType(s.gio_bat_dau);
                  const PeriodIcon = period.icon;
                  const duration = calculateDuration(s.gio_bat_dau, s.gio_ket_thuc);
                  const shortId = (s.id || '').slice(-6).toUpperCase();

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Tên ca làm việc + ID */}
                      <td className="py-3 pl-4 pr-2 align-middle">
                        <div className="flex flex-col min-w-0 leading-snug">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                            {s.ten_ca}
                          </span>
                          <span className="text-xs text-slate-400 tabular-nums">
                            ID: {shortId}
                          </span>
                        </div>
                      </td>

                      {/* Buổi trong ngày */}
                      <td className="py-3 px-2 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${period.badgeClass}`}>
                          <PeriodIcon className="w-3.5 h-3.5" />
                          <span>{period.label}</span>
                        </span>
                      </td>

                      {/* Giờ vào (Check-in) */}
                      <td className="py-3 px-2 align-middle text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold tabular-nums border border-emerald-200/60 dark:border-emerald-800/60">
                          {s.gio_bat_dau}
                        </span>
                      </td>

                      {/* Giờ ra (Check-out) */}
                      <td className="py-3 px-2 align-middle text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-sm font-semibold tabular-nums border border-brand-200/60 dark:border-brand-800/60">
                          {s.gio_ket_thuc}
                        </span>
                      </td>

                      {/* Thời lượng ca */}
                      <td className="py-3 px-2 align-middle">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 tabular-nums">{duration}</span>
                      </td>

                      {/* Ân hạn đi muộn */}
                      <td className="py-3 px-2 align-middle">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-medium tabular-nums">
                          <Timer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{s.nguong_di_muon_phut ?? 15} phút</span>
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2.5 px-3.5 align-middle text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!canManage || togglingId === s.id}
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                          } ${
                            s.kich_hoat
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          } ${togglingId === s.id ? 'opacity-50 pointer-events-none' : ''}`}
                          title={canManage ? 'Nhấn để chuyển đổi trạng thái ca' : undefined}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.kich_hoat ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>
                            {togglingId === s.id
                              ? 'Đang đổi...'
                              : s.kich_hoat
                              ? 'Đang áp dụng'
                              : 'Tạm ngưng'}
                          </span>
                        </button>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 pl-2 pr-4 align-middle">
                        <div className="flex items-center justify-center gap-1 text-slate-400">
                          <button
                            onClick={() => setViewingShift(s)}
                            className="w-7 h-7 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Xem chi tiết"
                            type="button"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => openEditModal(s)}
                              className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                              title="Chỉnh sửa ca"
                              type="button"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setDeletingShift(s)}
                              className="w-7 h-7 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Xóa ca"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Table Pagination & Footer Status */}
        <ThanhPhanTrang
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredShifts.length}
          pageSize={pageSize}
          itemLabel="ca làm việc"
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </section>

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA CA LÀM VIỆC
         ========================================================================= */}
      {(isCreateModalOpen || editingShift) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingShift ? 'Chỉnh Sửa Ca Làm Việc' : 'Thêm Ca Làm Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cấu hình khung giờ điểm danh và thời gian ân hạn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingShift(null);
                }}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên ca làm việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.ten_ca}
                  onChange={(e) => setFormData({ ...formData, ten_ca: e.target.value })}
                  placeholder="VD: Ca Sáng (Tiết 1 - 4)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ vào (Check-in) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.gio_bat_dau}
                    onChange={(e) => setFormData({ ...formData, gio_bat_dau: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ ra (Check-out) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.gio_ket_thuc}
                    onChange={(e) => setFormData({ ...formData, gio_ket_thuc: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              {formData.gio_bat_dau && formData.gio_ket_thuc && (
                <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
                  <span>Thời lượng ca dự kiến:</span>
                  <span className="font-bold">{calculateDuration(formData.gio_bat_dau, formData.gio_ket_thuc)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời gian ân hạn đi muộn (Phút)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={formData.nguong_di_muon_phut}
                    onChange={(e) => setFormData({ ...formData, nguong_di_muon_phut: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">phút</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Sau thời gian này, hệ thống sẽ tự động gắn cờ đi muộn khi cán bộ quẹt thẻ/điểm danh AI.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái ca</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.kich_hoat === true}
                      onChange={() => setFormData({ ...formData, kich_hoat: true })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Đang áp dụng (Active)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.kich_hoat === false}
                      onChange={() => setFormData({ ...formData, kich_hoat: false })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Tạm ngưng (Pause)</span>
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingShift(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingShift ? 'Lưu Thay Đổi' : 'Thêm Ca Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: XEM CHI TIẾT CA LÀM VIỆC
         ========================================================================= */}
      {viewingShift && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Ca Làm Việc</h3>
                  <span className="text-[11px] font-mono text-slate-400">ID: {viewingShift.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingShift(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tên ca làm việc
                </span>
                <p className="text-base font-bold text-slate-900">{viewingShift.ten_ca}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Giờ vào (Check-in)
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200/60">
                    {viewingShift.gio_bat_dau}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Giờ ra (Check-out)
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200/60">
                    {viewingShift.gio_ket_thuc}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Thời lượng ca
                  </span>
                  <p className="text-xs font-bold text-slate-800">
                    {calculateDuration(viewingShift.gio_bat_dau, viewingShift.gio_ket_thuc)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Ân hạn đi muộn
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Timer className="w-3.5 h-3.5" />
                    {viewingShift.nguong_di_muon_phut ?? 15} phút
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Trạng thái
                </span>
                {viewingShift.kich_hoat ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Đang áp dụng trong toàn trường
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Tạm ngưng sử dụng
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Ngày tạo
                  </span>
                  <span className="font-mono text-slate-700">
                    {(viewingShift as any).tao_luc ? new Date((viewingShift as any).tao_luc).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Cập nhật gần nhất
                  </span>
                  <span className="font-mono text-slate-700">
                    {(viewingShift as any).cap_nhat_luc ? new Date((viewingShift as any).cap_nhat_luc).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingShift(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: XÁC NHẬN XÓA CA LÀM VIỆC
         ========================================================================= */}
      {deletingShift && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Xác Nhận Xóa Ca Làm Việc</h3>
                <p className="text-xs text-slate-500">
                  Bạn có chắc chắn muốn xóa ca làm việc{' '}
                  <b className="text-slate-800 font-semibold">{deletingShift.ten_ca}</b> ({deletingShift.gio_bat_dau} - {deletingShift.gio_ket_thuc})?
                </p>
                <p className="text-[11px] text-rose-500 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 font-medium">
                  Hệ thống sẽ từ chối xóa nếu ca này đang được gắn vào thời khóa biểu hoặc lịch giảng dạy hoạt động.
                </p>
                <div className="pt-3 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeletingShift(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleDeleteShift}
                    className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang xóa...' : 'Xóa Ca'}
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
