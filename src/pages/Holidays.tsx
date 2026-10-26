import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PartyPopper,
  Calendar,
  CalendarDays,
  Plus,
  Search,
  Download,
  RotateCcw,
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
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import {
  holidayApi,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
} from '../api/holiday.api';
import { hasRole } from '../utils/rbac';
import { Portal } from '../components/ui/Portal';

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
    return { status: 'passed', label: 'Không xác định', badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200', daysDiff: 0 };
  }
  const todayStr = new Date().toISOString().slice(0, 10);

  if (todayStr >= startDate && todayStr <= endDate) {
    return {
      status: 'ongoing',
      label: 'Đang diễn ra',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse',
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
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold',
      daysDiff: diffDays,
    };
  }

  return {
    status: 'passed',
    label: 'Đã kết thúc',
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
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
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedPaid, setSelectedPaid] = useState<string>(''); // 'true', 'false', ''
  const [selectedTiming, setSelectedTiming] = useState<string>(''); // 'upcoming', 'ongoing', 'passed', ''
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [activeHoliday, setActiveHoliday] = useState<HolidayItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    isPaid: boolean;
    description: string;
  }>({
    name: '',
    startDate: '',
    endDate: '',
    isPaid: true,
    description: '',
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
        year: selectedYear !== 'all' ? selectedYear : undefined,
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

  // Danh sách các năm động từ dữ liệu
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(2026);
    yearsSet.add(2025);
    yearsSet.add(new Date().getFullYear());
    holidays.forEach((h) => {
      if (h.year) yearsSet.add(h.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [holidays]);

  // ===========================================================================
  // FILTERING
  // ===========================================================================
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      // Search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchName = h.name.toLowerCase().includes(kw);
        const matchDesc = (h.description || '').toLowerCase().includes(kw);
        if (!matchName && !matchDesc) return false;
      }

      // Paid Mode
      if (selectedPaid !== '') {
        const isPaidBool = selectedPaid === 'true';
        if (h.isPaid !== isPaidBool) return false;
      }

      // Timing
      if (selectedTiming !== '') {
        const timing = getTimingStatus(h.startDate, h.endDate);
        if (timing.status !== selectedTiming) return false;
      }

      return true;
    });
  }, [holidays, searchKeyword, selectedPaid, selectedTiming]);

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
    const totalHolidays = holidays.length;
    let totalDays = 0;
    let paidDays = 0;

    holidays.forEach((h) => {
      const days = calculateDayCount(h.startDate, h.endDate);
      totalDays += days;
      if (h.isPaid) {
        paidDays += days;
      }
    });

    const avgDays = totalHolidays > 0 ? (totalDays / totalHolidays).toFixed(1) : '0';
    const paidPercentage = totalDays > 0 ? Math.round((paidDays / totalDays) * 100) : 100;

    // Tìm kỳ nghỉ kế tiếp
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingList = holidays
      .filter((h) => h.startDate >= todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;
    let daysUntilNext = 0;
    if (nextHoliday) {
      const s = new Date(nextHoliday.startDate);
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
        const days = calculateDayCount(h.startDate, h.endDate);
        const timing = getTimingStatus(h.startDate, h.endDate);
        return [
          `"${h.name.replace(/"/g, '""')}"`,
          h.year || '',
          formatDateVN(h.startDate),
          formatDateVN(h.endDate),
          days,
          h.isPaid ? '100% Lương' : 'Không hưởng lương',
          timing.label,
          `"${(h.description || '').replace(/"/g, '""')}"`,
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
    setSelectedYear('2026');
    setCurrentPage(1);
    toast.success('Đã đặt lại tất cả bộ lọc');
  };

  // ===========================================================================
  // FORM / MODAL HANDLERS
  // ===========================================================================
  const openAddModal = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      isPaid: true,
      description: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (holiday: HolidayItem) => {
    setActiveHoliday(holiday);
    setFormData({
      name: holiday.name,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      isPaid: holiday.isPaid,
      description: holiday.description || '',
    });
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên kỳ nghỉ lễ');
      return;
    }
    if (!formData.startDate) {
      toast.error('Vui lòng chọn ngày bắt đầu');
      return;
    }
    if (!formData.endDate) {
      toast.error('Vui lòng chọn ngày kết thúc');
      return;
    }
    if (formData.startDate > formData.endDate) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }

    setIsSubmitting(true);
    try {
      const year = Number(formData.startDate.slice(0, 4));
      const payload: CreateHolidayPayload = {
        name: formData.name.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        year,
        isPaid: formData.isPaid,
        description: formData.description.trim(),
      };

      if (isEditModalOpen && activeHoliday) {
        await holidayApi.updateHoliday(activeHoliday._id, payload);
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
      await holidayApi.deleteHoliday(activeHoliday._id);
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
          4 COMPACT KPI CARDS GRID (Matching code.html)
         ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5" data-purpose="kpi-metric-cards">
        {/* Card 1: Tổng số kỳ nghỉ */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">TỔNG SỐ KỲ NGHỈ</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <PartyPopper className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.totalHolidays}</span>
              <span className="text-xs text-slate-500 font-medium">
                đợt nghỉ ({selectedYear === 'all' ? 'Tất cả' : `Năm ${selectedYear}`})
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-rose-700 text-xs font-medium truncate">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Lịch chuẩn NTU</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tổng số ngày nghỉ */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">TỔNG SỐ NGÀY NGHỈ</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.totalDays}</span>
              <span className="text-xs text-slate-500 font-medium">ngày thực tế</span>
            </div>
            <div className="mt-1 text-amber-700 text-xs font-medium truncate">
              <span>TB {kpis.avgDays} ngày / kỳ nghỉ</span>
            </div>
          </div>
        </div>

        {/* Card 3: Hưởng 100% lương */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">HƯỞNG 100% LƯƠNG</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.paidDays}</span>
              <span className="text-xs text-slate-500">/ {kpis.totalDays} ngày nghỉ</span>
            </div>
            <div className="mt-1 text-emerald-700 text-xs font-medium truncate">
              <span>{kpis.paidPercentage}% chế độ Nhà nước</span>
            </div>
          </div>
        </div>

        {/* Card 4: Kỳ nghỉ tiếp theo */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">KỲ NGHỈ TIẾP THEO</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-sm text-slate-900 font-semibold truncate">
              {kpis.nextHoliday ? kpis.nextHoliday.name : 'Chưa có lịch mới'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600 font-medium truncate">
              {kpis.nextHoliday ? (
                <span>
                  ⏳ Còn {kpis.daysUntilNext} ngày ({formatDateShort(kpis.nextHoliday.startDate)})
                </span>
              ) : (
                <span>Đã kết thúc lịch năm</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FILTER & ACTION TOOLBAR SECTION (Matching code.html)
         ========================================================================= */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col gap-3.5">
        {/* Row 1: Header and Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-bold text-slate-800">Bộ Lọc &amp; Tra Cứu Kỳ Nghỉ Lễ</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <strong className="text-slate-800">{filteredHolidays.length}</strong> / {holidays.length} kỳ nghỉ
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Refresh Button */}
            <button
              onClick={fetchHolidays}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition-colors cursor-pointer"
              type="button"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Làm Mới</span>
            </button>
            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50/60 text-emerald-700 text-xs font-semibold border border-emerald-300 shadow-xs transition-colors cursor-pointer"
              type="button"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Xuất Excel (.csv)</span>
            </button>
            {/* Add Holiday Button */}
            {canManage && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm shadow-rose-600/30 transition-all cursor-pointer"
                type="button"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Ngày Nghỉ Lễ</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Input and Dropdowns in a unified row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-9 pr-3 bg-slate-50 rounded-xl text-slate-800 placeholder:text-slate-400 text-xs border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              placeholder="Tìm kiếm kỳ nghỉ lễ theo tên hoặc mô tả căn cứ..."
              type="text"
            />
          </div>

          {/* Year Selector (Nạp động các năm từ CSDL) */}
          <div className="relative shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer transition-colors"
            >
              <option value="all">Tất cả các năm</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Năm {yr} {yr === 2026 ? '(Chuẩn)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector */}
          <div className="relative shrink-0">
            <select
              value={selectedPaid}
              onChange={(e) => {
                setSelectedPaid(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer transition-colors"
            >
              <option value="">Tất cả chế độ</option>
              <option value="true">Hưởng 100% lương</option>
              <option value="false">Không hưởng lương</option>
            </select>
          </div>

          {/* Period Selector */}
          <div className="relative shrink-0">
            <select
              value={selectedTiming}
              onChange={(e) => {
                setSelectedTiming(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer transition-colors"
            >
              <option value="">Tất cả thời điểm</option>
              <option value="ongoing">Đang diễn ra</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="passed">Đã kết thúc</option>
            </select>
          </div>

          {/* View Switcher: Bảng / Thẻ */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white shadow-xs text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              type="button"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Bảng</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white shadow-xs text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              type="button"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Thẻ</span>
            </button>
          </div>
        </div>

        {/* Active Filters Tagline */}
        {(selectedYear !== 'all' || selectedPaid !== '' || selectedTiming !== '' || searchKeyword) && (
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2 text-xs border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400">Đang lọc theo:</span>
              {selectedYear !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                  <span>Năm: {selectedYear}</span>
                  <button
                    onClick={() => setSelectedYear('all')}
                    className="hover:opacity-75 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedPaid !== '' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <span>Chế độ: {selectedPaid === 'true' ? '100% lương' : 'Không lương'}</span>
                  <button
                    onClick={() => setSelectedPaid('')}
                    className="hover:opacity-75 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedTiming !== '' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                  <span>Thời điểm: {selectedTiming}</span>
                  <button
                    onClick={() => setSelectedTiming('')}
                    className="hover:opacity-75 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors cursor-pointer"
              type="button"
            >
              Đặt lại tất cả bộ lọc
            </button>
          </div>
        )}
      </section>

      {/* =========================================================================
          VIEW MODE 1: STRICT ZERO-HORIZONTAL SCROLL TABLE CARD (Matching code.html)
         ========================================================================= */}
      {viewMode === 'table' ? (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
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
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">TÊN KỲ NGHỈ LỄ</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">KHOẢNG THỜI GIAN</th>
                  <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">SỐ NGÀY NGHỈ</th>
                  <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">CHẾ ĐỘ LƯƠNG</th>
                  <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">TRẠNG THÁI</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">MÔ TẢ / CĂN CỨ</th>
                  <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">Đang tải lịch nghỉ lễ...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <PartyPopper className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                        <span className="text-xs font-semibold text-slate-600">Không tìm thấy kỳ nghỉ lễ nào</span>
                        <p className="text-[11px] text-slate-400">Thử thay đổi năm hoặc bỏ bớt các tiêu chí lọc</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedHolidays.map((h) => {
                    const days = calculateDayCount(h.startDate, h.endDate);
                    const timing = getTimingStatus(h.startDate, h.endDate);

                    return (
                      <tr key={h._id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Tên kỳ nghỉ lễ */}
                        <td className="py-2.5 px-3 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                              <PartyPopper className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-1.5 truncate min-w-0">
                              <span className="text-xs font-semibold text-slate-900 group-hover:text-rose-900 truncate">
                                {h.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                                {h.year}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Khoảng thời gian */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-800 font-mono text-[11px] font-medium whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {h.startDate === h.endDate ? (
                              <span>{formatDateVN(h.startDate)}</span>
                            ) : (
                              <>
                                <span>{formatDateShort(h.startDate)}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span>{formatDateVN(h.endDate)}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Số ngày nghỉ */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-semibold">
                            {days} ngày
                          </span>
                        </td>

                        {/* Chế độ lương */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {h.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>100% Lương</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium whitespace-nowrap">
                              <span>Không lương</span>
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${timing.badgeClass}`}>
                            {timing.label}
                          </span>
                        </td>

                        {/* Mô tả / Căn cứ */}
                        <td className="py-2.5 px-3 min-w-0">
                          <span className="text-slate-500 text-xs block truncate" title={h.description || 'Không có mô tả'}>
                            {h.description || 'Theo quy định'}
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
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-500">
            <div>
              <span>
                Trang <strong className="text-slate-800">{currentPage}</strong> / {totalPages} (Tổng cộng{' '}
                <strong className="text-slate-800">{filteredHolidays.length}</strong> kỳ nghỉ lễ)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  currentPage <= 1
                    ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer'
                }`}
                type="button"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="w-8 h-8 rounded-lg bg-rose-600 text-white font-semibold flex items-center justify-center shadow-xs"
                type="button"
              >
                {currentPage}
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  currentPage >= totalPages
                    ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer'
                }`}
                type="button"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* =========================================================================
            VIEW MODE 2: CARD GRID VIEW (Dạng Thẻ)
           ========================================================================= */
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {paginatedHolidays.map((h) => {
            const days = calculateDayCount(h.startDate, h.endDate);
            const timing = getTimingStatus(h.startDate, h.endDate);

            return (
              <div
                key={h._id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-sm p-4 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <PartyPopper className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-900 leading-snug">
                          {h.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">Năm học {h.year}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${timing.badgeClass}`}>
                      {timing.label}
                    </span>
                  </div>

                  <div className="mt-3.5 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Thời gian nghỉ:</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px]">
                        {formatDateVN(h.startDate)} → {formatDateVN(h.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Thời lượng:</span>
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                        {days} ngày thực tế
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Chế độ:</span>
                      <span className={`font-semibold ${h.isPaid ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {h.isPaid ? '✓ 100% Lương' : 'Không hưởng lương'}
                      </span>
                    </div>
                  </div>

                  {h.description && (
                    <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 italic">
                      "{h.description}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1 text-slate-400">
                  <button
                    onClick={() => {
                      setActiveHoliday(h);
                      setIsViewModalOpen(true);
                    }}
                    className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Xem chi tiết"
                    type="button"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => openEditModal(h)}
                      className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
                      className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
        </section>
      )}

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA KỲ NGHỈ LỄ
         ========================================================================= */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && formData.startDate <= formData.endDate && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-800 flex items-center justify-between">
                  <span>Tổng số ngày nghỉ dự kiến:</span>
                  <span className="font-bold">
                    {calculateDayCount(formData.startDate, formData.endDate)} ngày
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
                      checked={formData.isPaid === true}
                      onChange={() => setFormData({ ...formData, isPaid: true })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Hưởng 100% lương (Chuẩn Nhà nước)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isPaid"
                      checked={formData.isPaid === false}
                      onChange={() => setFormData({ ...formData, isPaid: false })}
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <PartyPopper className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Kỳ Nghỉ Lễ</h3>
                  <span className="text-[11px] text-slate-400">Năm học {activeHoliday.year}</span>
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
                <p className="text-base font-bold text-slate-900">{activeHoliday.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Khoảng thời gian
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800">
                    {formatDateVN(activeHoliday.startDate)} → {formatDateVN(activeHoliday.endDate)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Tổng số ngày nghỉ
                  </span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-bold">
                    {calculateDayCount(activeHoliday.startDate, activeHoliday.endDate)} ngày thực tế
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Chế độ lương
                  </span>
                  {activeHoliday.isPaid ? (
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
                      getTimingStatus(activeHoliday.startDate, activeHoliday.endDate).badgeClass
                    }`}
                  >
                    {getTimingStatus(activeHoliday.startDate, activeHoliday.endDate).label}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Mô tả / Căn cứ
                </span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {activeHoliday.description || 'Theo lịch và quy định của nhà trường.'}
                </p>
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xác Nhận Xóa Kỳ Nghỉ Lễ</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa kỳ nghỉ{' '}
                <b className="text-slate-800 font-semibold">{activeHoliday.name}</b> (Năm {activeHoliday.year})?
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
