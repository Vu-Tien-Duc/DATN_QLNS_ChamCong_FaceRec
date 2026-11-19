import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PartyPopper,
  Calendar,
  CalendarDays,
  Plus,
  Search,
  Download,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  X,
  AlertTriangle,
  Table as TableIcon,
  LayoutGrid,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import {
  holidayApi,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
} from '../../api/ngayNghiLe.api';
import { hasRole } from '../../utils/phanQuyen';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { Button } from '../../components/chung/NutBam';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';

// =============================================================================
// HELPER FUNCTIONS & FORMATTERS
// =============================================================================

function formatDateVN(dateStr?: string): string {
  if (!dateStr) return '--';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '--';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function calculateDayCount(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays + 1 : 0;
}

type TimingStatus = 'upcoming' | 'ongoing' | 'passed';

function getTimingStatus(startDate?: string, endDate?: string): {
  status: TimingStatus;
  label: string;
  badgeClass: string;
  daysDiff: number;
} {
  if (!startDate || !endDate) {
    return { status: 'passed', label: 'Không xác định', badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700', daysDiff: 0 };
  }
  const todayStr = new Date().toISOString().slice(0, 10);

  if (todayStr >= startDate && todayStr <= endDate) {
    return {
      status: 'ongoing',
      label: 'Đang diễn ra',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-pulse',
      daysDiff: 0,
    };
  }

  if (todayStr < startDate) {
    const s = new Date(startDate);
    const t = new Date(todayStr);
    const diffDays = Math.ceil((s.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'upcoming',
      label: `Sắp tới (${diffDays} ngày)`,
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold',
      daysDiff: diffDays,
    };
  }

  return {
    status: 'passed',
    label: 'Đã kết thúc',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    daysDiff: 0,
  };
}

// =============================================================================
// MAIN COMPONENT: Holidays
// =============================================================================

export const Holidays: React.FC = () => {
  const { user } = useAuthStore();

  // Data States
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const currentYearStr = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedPaid, setSelectedPaid] = useState<string>(''); // 'true', 'false', ''
  const [selectedTiming, setSelectedTiming] = useState<string>(''); // 'upcoming', 'ongoing', 'passed', ''
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [activeHoliday, setActiveHoliday] = useState<HolidayItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    ten_ngay_le: string;
    ngay_bat_dau: string;
    ngay_ket_thuc: string;
    huong_luong: boolean;
    mo_ta: string;
  }>({
    ten_ngay_le: '',
    ngay_bat_dau: '',
    ngay_ket_thuc: '',
    huong_luong: true,
    mo_ta: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Role Permissions
  const canManage = useMemo(() => {
    return hasRole(user, ['admin', 'bgh']);
  }, [user]);

  // ===========================================================================
  // FETCH HOLIDAYS
  // ===========================================================================
  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await holidayApi.getHolidays({
        nam: selectedYear !== 'all' ? selectedYear : undefined,
      });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách ngày nghỉ lễ:', err);
      toast.error(err.response?.data?.message || 'Không thể tải danh sách ngày nghỉ lễ.');
      setHolidays([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Chuẩn hóa dữ liệu ngày nghỉ lễ đồng bộ CSDL v2.5
  const normalizedHolidays = useMemo<HolidayItem[]>(() => {
    return holidays.map((h: any) => {
      const start = h.ngay_bat_dau || '';
      const end = h.ngay_ket_thuc || '';
      return {
        ...h,
        ten_ngay_le: h.ten_ngay_le || '',
        ngay_bat_dau: start,
        ngay_ket_thuc: end,
        nam: h.nam || (start ? parseInt(start.slice(0, 4), 10) : new Date().getFullYear()),
        huong_luong: h.huong_luong !== undefined ? h.huong_luong : true,
        mo_ta: h.mo_ta !== undefined ? h.mo_ta : '',
      };
    });
  }, [holidays]);

  // Danh sách các năm động từ dữ liệu
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(2026);
    yearsSet.add(2025);
    yearsSet.add(new Date().getFullYear());
    normalizedHolidays.forEach((h) => {
      if (h.nam) yearsSet.add(h.nam);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [normalizedHolidays]);

  // ===========================================================================
  // FILTERING
  // ===========================================================================
  const filteredHolidays = useMemo(() => {
    return normalizedHolidays.filter((h) => {
      // Search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchName = h.ten_ngay_le.toLowerCase().includes(kw);
        const matchDesc = (h.mo_ta || '').toLowerCase().includes(kw);
        if (!matchName && !matchDesc) return false;
      }

      // Paid Mode
      if (selectedPaid !== '') {
        const isPaidBool = selectedPaid === 'true';
        if (h.huong_luong !== isPaidBool) return false;
      }

      // Timing
      if (selectedTiming !== '') {
        const timing = getTimingStatus(h.ngay_bat_dau, h.ngay_ket_thuc);
        if (timing.status !== selectedTiming) return false;
      }

      return true;
    });
  }, [normalizedHolidays, searchKeyword, selectedPaid, selectedTiming]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredHolidays.length / pageSize) || 1;
  const paginatedHolidays = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHolidays.slice(start, start + pageSize);
  }, [filteredHolidays, currentPage, pageSize]);

  // ===========================================================================
  // COMPUTED KPIS
  // ===========================================================================
  const kpis = useMemo(() => {
    const totalHolidays = normalizedHolidays.length;
    let totalDays = 0;
    let paidDays = 0;

    normalizedHolidays.forEach((h) => {
      const days = calculateDayCount(h.ngay_bat_dau, h.ngay_ket_thuc);
      totalDays += days;
      if (h.huong_luong) {
        paidDays += days;
      }
    });

    const avgDays = totalHolidays > 0 ? (totalDays / totalHolidays).toFixed(1) : '0';
    const paidPercentage = totalDays > 0 ? Math.round((paidDays / totalDays) * 100) : 100;

    // Tìm kỳ nghỉ kế tiếp
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingList = normalizedHolidays
      .filter((h) => (h.ngay_bat_dau || '') >= todayStr)
      .sort((a, b) => (a.ngay_bat_dau || '').localeCompare(b.ngay_bat_dau || ''));

    const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;
    let daysUntilNext = 0;
    if (nextHoliday) {
      const s = new Date(nextHoliday.ngay_bat_dau);
      const t = new Date(todayStr);
      daysUntilNext = Math.ceil((s.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      totalHolidays,
      totalDays,
      paidDays,
      avgDays,
      paidPercentage,
      nextHoliday,
      daysUntilNext,
    };
  }, [holidays]);

  // ===========================================================================
  // EXPORT CSV
  // ===========================================================================
  const handleExportCSV = () => {
    if (filteredHolidays.length === 0) {
      toast.error('Không có dữ liệu ngày nghỉ lễ để xuất');
      return;
    }

    try {
      const headers = ['Tên kỳ nghỉ lễ', 'Năm', 'Ngày bắt đầu', 'Ngày kết thúc', 'Số ngày', 'Chế độ lương', 'Trạng thái', 'Mô tả / Căn cứ'];
      const rows = filteredHolidays.map((h) => {
        const days = calculateDayCount(h.ngay_bat_dau, h.ngay_ket_thuc);
        const timing = getTimingStatus(h.ngay_bat_dau, h.ngay_ket_thuc);
        return [
          `"${h.ten_ngay_le.replace(/"/g, '""')}"`,
          h.nam || '',
          formatDateVN(h.ngay_bat_dau),
          formatDateVN(h.ngay_ket_thuc),
          days,
          h.huong_luong ? '100% Lương' : 'Không hưởng lương',
          timing.label,
          `"${(h.mo_ta || '').replace(/"/g, '""')}"`,
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Lich_Nghi_Le_${selectedYear}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã xuất file lịch nghỉ lễ thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file:', err);
      toast.error('Không thể xuất file lịch nghỉ lễ');
    }
  };

  // Reset filter
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedPaid('');
    setSelectedTiming('');
    setSelectedYear(String(new Date().getFullYear()));
    setCurrentPage(1);
    toast.success('Đã đặt lại tất cả bộ lọc');
  };

  // ===========================================================================
  // FORM / MODAL HANDLERS
  // ===========================================================================
  const openAddModal = () => {
    setFormData({
      ten_ngay_le: '',
      ngay_bat_dau: '',
      ngay_ket_thuc: '',
      huong_luong: true,
      mo_ta: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (holiday: HolidayItem) => {
    setActiveHoliday(holiday);
    setFormData({
      ten_ngay_le: holiday.ten_ngay_le,
      ngay_bat_dau: holiday.ngay_bat_dau,
      ngay_ket_thuc: holiday.ngay_ket_thuc,
      huong_luong: holiday.huong_luong,
      mo_ta: holiday.mo_ta || '',
    });
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ten_ngay_le.trim()) {
      toast.error('Vui lòng nhập tên kỳ nghỉ lễ');
      return;
    }
    if (!formData.ngay_bat_dau) {
      toast.error('Vui lòng chọn ngày bắt đầu');
      return;
    }
    if (!formData.ngay_ket_thuc) {
      toast.error('Vui lòng chọn ngày kết thúc');
      return;
    }
    if (formData.ngay_bat_dau > formData.ngay_ket_thuc) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }

    setIsSubmitting(true);
    try {
      const year = Number(formData.ngay_bat_dau.slice(0, 4));
      const payload: CreateHolidayPayload = {
        ten_ngay_le: formData.ten_ngay_le.trim(),
        ngay_bat_dau: formData.ngay_bat_dau,
        ngay_ket_thuc: formData.ngay_ket_thuc,
        nam: year,
        huong_luong: formData.huong_luong,
        mo_ta: formData.mo_ta.trim(),
      };

      if (isEditModalOpen && activeHoliday) {
        await holidayApi.updateHoliday(activeHoliday.id, payload);
        toast.success('Cập nhật ngày nghỉ lễ thành công!');
        setIsEditModalOpen(false);
      } else {
        await holidayApi.createHoliday(payload);
        toast.success('Thêm mới ngày nghỉ lễ thành công!');
        setIsAddModalOpen(false);
      }

      await fetchHolidays();
    } catch (err: any) {
      console.error('Lỗi khi lưu ngày nghỉ lễ:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu ngày nghỉ lễ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!activeHoliday) return;
    setIsSubmitting(true);
    try {
      await holidayApi.deleteHoliday(activeHoliday.id);
      toast.success('Đã xóa ngày nghỉ lễ thành công!');
      setIsDeleteModalOpen(false);
      setActiveHoliday(null);
      await fetchHolidays();
    } catch (err: any) {
      console.error('Lỗi khi xóa ngày nghỉ lễ:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa ngày nghỉ lễ này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-purpose="holidays-management-page">
      {/* =========================================================================
          1. PAGE HEADER + ACTIONS
         ========================================================================= */}
      <PageHeader
        title="Quản Lý Ngày Nghỉ Lễ & Sự Kiện"
        subtitle="Danh mục ngày lễ toàn quốc, kỳ nghỉ Tết và chế độ nghỉ bù hưởng lương."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={fetchHolidays}
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              type="button"
            >
              Làm mới
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              type="button"
            >
              Xuất CSV
            </Button>
            {canManage && (
              <Button
                onClick={openAddModal}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                type="button"
              >
                Thêm ngày nghỉ
              </Button>
            )}
          </div>
        }
      />

      {/* =========================================================================
          2. UNIFIED HOLIDAYS CARD: KPI STRIP + FILTER BAR + TABLE / GRID
         ========================================================================= */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng kỳ nghỉ',
            value: kpis.totalHolidays,
            unit: 'đợt',
            subtext: selectedYear === 'all' ? 'Tất cả các năm' : `Năm ${selectedYear}`,
            tone: 'neutral',
            active: selectedPaid === '' && selectedTiming === '',
            onClick: () => {
              setSelectedPaid('');
              setSelectedTiming('');
              setCurrentPage(1);
            },
          },
          {
            label: 'Tổng ngày nghỉ',
            value: kpis.totalDays,
            unit: 'ngày',
            subtext: 'Tổng thời lượng nghỉ lễ',
            tone: 'warning',
          },
          {
            label: 'Hưởng 100% lương',
            value: `${kpis.paidDays}/${kpis.totalDays}`,
            badge: `${kpis.paidPercentage}%`,
            progress: kpis.paidPercentage,
            tone: 'success',
            active: selectedPaid === 'true',
            onClick: () => {
              setSelectedPaid((prev) => (prev === 'true' ? '' : 'true'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Kỳ nghỉ tới',
            value: kpis.nextHoliday ? kpis.nextHoliday.ten_ngay_le : 'Chưa có',
            badge: kpis.nextHoliday ? `Còn ${kpis.daysUntilNext}d` : undefined,
            subtext: kpis.nextHoliday ? 'Sắp diễn ra' : 'Không có lịch sắp tới',
            tone: 'brand',
            active: selectedTiming === 'upcoming',
            onClick: () => {
              setSelectedTiming((prev) => (prev === 'upcoming' ? '' : 'upcoming'));
              setCurrentPage(1);
            },
          },
        ]}
      />

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">

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
            className="w-full h-9 pl-9 pr-8 bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-colors"
            placeholder="Tìm kỳ nghỉ lễ theo tên hoặc mô tả..."
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
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
        >
          <option value="all">Tất cả năm</option>
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>
              Năm {yr}
            </option>
          ))}
        </select>

        <select
          value={selectedPaid}
          onChange={(e) => {
            setSelectedPaid(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
        >
          <option value="">Tất cả chế độ</option>
          <option value="true">Hưởng 100% lương</option>
          <option value="false">Không hưởng lương</option>
        </select>

        <select
          value={selectedTiming}
          onChange={(e) => {
            setSelectedTiming(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 pl-3 pr-7 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
        >
          <option value="">Tất cả thời điểm</option>
          <option value="ongoing">Đang diễn ra</option>
          <option value="upcoming">Sắp diễn ra</option>
          <option value="passed">Đã kết thúc</option>
        </select>

        <div className="flex items-center bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl shrink-0 h-9">
          <button
            onClick={() => setViewMode('table')}
            className={`h-full flex items-center gap-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 shadow-2xs text-brand-700 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            type="button"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Bảng</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`h-full flex items-center gap-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 shadow-2xs text-brand-700 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            type="button"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Thẻ</span>
          </button>
        </div>

        {(selectedYear !== 'all' || selectedPaid !== '' || selectedTiming !== '' || searchKeyword) && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer px-1"
            type="button"
          >
            Đặt lại
          </button>
        )}

        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap">
          {filteredHolidays.length} / {holidays.length} kỳ nghỉ
        </span>
      </div>

      {/* =========================================================================
          VIEW MODE 1: TABLE VIEW
         ========================================================================= */}
      {viewMode === 'table' ? (
        <div className="flex flex-col">
          <div className="w-full overflow-hidden">
            <table className="table-fixed w-full text-left border-collapse">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Tên kỳ nghỉ lễ</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Khoảng thời gian</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center whitespace-nowrap">Số ngày</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center whitespace-nowrap">Chế độ lương</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center whitespace-nowrap">Trạng thái</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Mô tả / Căn cứ</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Đang tải lịch nghỉ lễ...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <PartyPopper className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                        <span className="text-xs font-semibold text-slate-600">Không tìm thấy kỳ nghỉ lễ nào</span>
                        <p className="text-xs text-slate-400">Thử thay đổi năm hoặc bỏ bớt các tiêu chí lọc</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedHolidays.map((h) => {
                    const days = calculateDayCount(h.ngay_bat_dau, h.ngay_ket_thuc);
                    const timing = getTimingStatus(h.ngay_bat_dau, h.ngay_ket_thuc);

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                        {/* Tên kỳ nghỉ lễ */}
                        <td className="py-2.5 px-3.5 min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                              <PartyPopper className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-1.5 truncate min-w-0">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {h.ten_ngay_le || (h as any).ten_ngay_le || '--'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium tabular-nums shrink-0">
                                {h.nam || (h as any).nam || '--'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Khoảng thời gian */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 tabular-nums text-sm font-medium whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {h.ngay_bat_dau === h.ngay_ket_thuc ? (
                              <span>{formatDateVN(h.ngay_bat_dau || (h as any).ngay_bat_dau)}</span>
                            ) : (
                              <>
                                <span>{formatDateShort(h.ngay_bat_dau || (h as any).ngay_bat_dau)}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span>{formatDateVN(h.ngay_ket_thuc || (h as any).ngay_ket_thuc)}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Số ngày nghỉ */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-medium tabular-nums">
                            {days} ngày
                          </span>
                        </td>

                        {/* Chế độ lương */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {h.huong_luong ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>100% Lương</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-medium whitespace-nowrap">
                              <span>Không lương</span>
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${timing.badgeClass}`}>
                            {timing.label}
                          </span>
                        </td>

                        {/* Mô tả / Căn cứ */}
                        <td className="py-2.5 px-3.5 min-w-0">
                          <span className="text-slate-600 dark:text-slate-400 text-sm block truncate" title={h.mo_ta || (h as any).mo_ta || 'Không có mô tả'}>
                            {h.mo_ta || (h as any).mo_ta || 'Theo quy định'}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 text-slate-400">
                            <button
                              onClick={() => {
                                setActiveHoliday(h);
                                setIsViewModalOpen(true);
                              }}
                              className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Xem chi tiết"
                              type="button"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canManage && (
                              <button
                                onClick={() => openEditModal(h)}
                                className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Chỉnh sửa"
                                type="button"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {canManage && (
                              <button
                                onClick={() => {
                                  setActiveHoliday(h);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Xóa"
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

          {/* Table Pagination Footer */}
          <ThanhPhanTrang
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredHolidays.length}
            pageSize={pageSize}
            itemLabel="kỳ nghỉ lễ"
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/40 dark:bg-slate-950/30">
          {paginatedHolidays.map((h) => {
            const days = calculateDayCount(h.ngay_bat_dau, h.ngay_ket_thuc);
            const timing = getTimingStatus(h.ngay_bat_dau, h.ngay_ket_thuc);

            return (
              <div
                key={h.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-sm p-4 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <PartyPopper className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 leading-snug">
                          {h.ten_ngay_le}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">Năm học {h.nam}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${timing.badgeClass}`}>
                      {timing.label}
                    </span>
                  </div>

                  <div className="mt-3.5 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Thời gian nghỉ:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                        {formatDateVN(h.ngay_bat_dau)} → {formatDateVN(h.ngay_ket_thuc)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Thời lượng:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                        {days} ngày thực tế
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Chế độ:</span>
                      <span className={`font-semibold ${h.huong_luong ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {h.huong_luong ? '✓ 100% Lương' : 'Không hưởng lương'}
                      </span>
                    </div>
                  </div>

                  {h.mo_ta && (
                    <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                      "{h.mo_ta}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1 text-slate-400">
                  <button
                    onClick={() => {
                      setActiveHoliday(h);
                      setIsViewModalOpen(true);
                    }}
                    className="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                    title="Xem chi tiết"
                    type="button"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => openEditModal(h)}
                      className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Chỉnh sửa"
                      type="button"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => {
                        setActiveHoliday(h);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA KỲ NGHỈ LỄ
         ========================================================================= */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <PartyPopper className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {isEditModalOpen ? 'Chỉnh Sửa Kỳ Nghỉ Lễ' : 'Thêm Kỳ Nghỉ Lễ Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Thiết lập ngày nghỉ toàn trường và chế độ chấm công
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên kỳ nghỉ lễ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.ten_ngay_le}
                  onChange={(e) => setFormData({ ...formData, ten_ngay_le: e.target.value })}
                  placeholder="VD: Tết Nguyên Đán Bính Ngọ 2026"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.ngay_bat_dau}
                    onChange={(e) => setFormData({ ...formData, ngay_bat_dau: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày kết thúc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.ngay_ket_thuc}
                    onChange={(e) => setFormData({ ...formData, ngay_ket_thuc: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                  />
                </div>
              </div>

              {formData.ngay_bat_dau && formData.ngay_ket_thuc && formData.ngay_bat_dau <= formData.ngay_ket_thuc && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-800 flex items-center justify-between">
                  <span>Tổng số ngày nghỉ dự kiến:</span>
                  <span className="font-bold">
                    {calculateDayCount(formData.ngay_bat_dau, formData.ngay_ket_thuc)} ngày
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chế độ chấm công &amp; lương</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isPaid"
                      checked={formData.huong_luong === true}
                      onChange={() => setFormData({ ...formData, huong_luong: true })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Hưởng 100% lương (Chuẩn Nhà nước)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isPaid"
                      checked={formData.huong_luong === false}
                      onChange={() => setFormData({ ...formData, huong_luong: false })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Không hưởng lương</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả / Căn cứ pháp lý</label>
                <textarea
                  rows={3}
                  value={formData.mo_ta}
                  onChange={(e) => setFormData({ ...formData, mo_ta: e.target.value })}
                  placeholder="Căn cứ thông báo số..., quy chế đào tạo NTU..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : isEditModalOpen ? 'Lưu Thay Đổi' : 'Thêm Kỳ Nghỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}

      {/* =========================================================================
          MODAL: XEM CHI TIẾT KỲ NGHỈ LỄ
         ========================================================================= */}
      {isViewModalOpen && activeHoliday && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <PartyPopper className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Kỳ Nghỉ Lễ</h3>
                  <span className="text-[11px] text-slate-400">Năm học {activeHoliday.nam}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tên kỳ nghỉ lễ
                </span>
                <p className="text-base font-bold text-slate-900">{activeHoliday.ten_ngay_le}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Khoảng thời gian
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800">
                    {formatDateVN(activeHoliday.ngay_bat_dau)} → {formatDateVN(activeHoliday.ngay_ket_thuc)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Tổng số ngày nghỉ
                  </span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-bold">
                    {calculateDayCount(activeHoliday.ngay_bat_dau, activeHoliday.ngay_ket_thuc)} ngày thực tế
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Chế độ lương
                  </span>
                  {activeHoliday.huong_luong ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% Lương
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Không hưởng lương
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Trạng thái hiện tại
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                      getTimingStatus(activeHoliday.ngay_bat_dau, activeHoliday.ngay_ket_thuc).badgeClass
                    }`}
                  >
                    {getTimingStatus(activeHoliday.ngay_bat_dau, activeHoliday.ngay_ket_thuc).label}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Mô tả / Căn cứ
                </span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {activeHoliday.mo_ta || 'Theo lịch và quy định của nhà trường.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Ngày tạo
                  </span>
                  <span className="font-mono text-slate-700">
                    {(activeHoliday as any).createdAt ? new Date((activeHoliday as any).createdAt).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Cập nhật gần nhất
                  </span>
                  <span className="font-mono text-slate-700">
                    {(activeHoliday as any).updatedAt ? new Date((activeHoliday as any).updatedAt).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
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
          MODAL: XÁC NHẬN XÓA KỲ NGHỈ LỄ
         ========================================================================= */}
      {isDeleteModalOpen && activeHoliday && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xác Nhận Xóa Kỳ Nghỉ Lễ</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa kỳ nghỉ{' '}
                <b className="text-slate-800 font-semibold">{activeHoliday.ten_ngay_le}</b> (Năm {activeHoliday.nam})?
              </p>
              <p className="text-[11px] text-rose-500 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 font-medium">
                Dữ liệu chấm công tự động trong các ngày này sẽ được tính lại theo quy chuẩn ngày làm việc thông thường.
              </p>
              <div className="pt-3 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeleteHoliday}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xóa...' : 'Xóa Kỳ Nghỉ'}
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
