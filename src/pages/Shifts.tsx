import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Plus,
  Search,
  Download,
  RotateCcw,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Layers,
  X,
  AlertTriangle,
  Timer,
  Calendar,
  Hourglass,
  ArrowRight,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Portal } from '../components/ui/Portal';
import {
  shiftApi,
  ShiftItem,
  CreateShiftPayload,
  UpdateShiftPayload,
} from '../api/shift.api';
import { hasRole } from '../utils/rbac';

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
  const diff = endTotal - startTotal;

  if (diff <= 0) return '0 phút';
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
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    };
  }
  const [h] = startTime.split(':').map(Number);
  if (h < 12) {
    return {
      key: 'morning',
      label: 'Buổi Sáng',
      icon: Sun,
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    };
  }
  if (h < 17) {
    return {
      key: 'afternoon',
      label: 'Buổi Chiều',
      icon: Sunset,
      badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200/60',
    };
  }
  return {
    key: 'evening',
    label: 'Buổi Tối',
    icon: Moon,
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
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
  const pageSize = 10;

  // Modals States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [viewingShift, setViewingShift] = useState<ShiftItem | null>(null);
  const [deletingShift, setDeletingShift] = useState<ShiftItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    startTime: string;
    endTime: string;
    lateThresholdMinutes: number;
    isActive: boolean;
  }>({
    name: '',
    startTime: '07:00',
    endTime: '11:30',
    lateThresholdMinutes: 15,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Permissions
  const canManage = useMemo(() => {
    return hasRole(user, ['admin', 'bgh']);
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
        const matchName = s.name.toLowerCase().includes(kw);
        const matchTime = `${s.startTime} ${s.endTime}`.includes(kw);
        const matchId = (s._id || '').toLowerCase().includes(kw);
        if (!matchName && !matchTime && !matchId) return false;
      }

      // Period Filter
      if (selectedPeriod !== '') {
        const period = getShiftPeriodType(s.startTime);
        if (period.key !== selectedPeriod) return false;
      }

      // Status Filter
      if (selectedStatus !== '') {
        const isActiveBool = selectedStatus === 'active';
        if (s.isActive !== isActiveBool) return false;
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
    const activeShifts = shifts.filter((s) => s.isActive).length;

    let totalGrace = 0;
    shifts.forEach((s) => {
      totalGrace += Number(s.lateThresholdMinutes) || 15;
    });
    const avgGracePeriod = totalShifts > 0 ? Math.round(totalGrace / totalShifts) : 15;

    // Tìm giờ sớm nhất và muộn nhất
    let earliestTime = '07:00';
    let latestTime = '21:00';
    if (shifts.length > 0) {
      const sortedStart = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const sortedEnd = [...shifts].sort((a, b) => b.endTime.localeCompare(a.endTime));
      earliestTime = sortedStart[0]?.startTime || '07:00';
      latestTime = sortedEnd[0]?.endTime || '21:00';
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
        const period = getShiftPeriodType(s.startTime);
        return {
          'STT': idx + 1,
          'Mã Ca': s._id.slice(-6).toUpperCase(),
          'Tên Ca Làm Việc': s.name,
          'Buổi Trong Ngày': period.label,
          'Giờ Bắt Đầu': s.startTime,
          'Giờ Kết Thúc': s.endTime,
          'Thời Lượng': calculateDuration(s.startTime, s.endTime),
          'Ân Hạn Đi Muộn (Phút)': s.lateThresholdMinutes || 15,
          'Trạng Thái Áp Dụng': s.isActive ? 'Đang áp dụng' : 'Tạm ngưng',
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
      name: '',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      isActive: true,
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (shift: ShiftItem) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateThresholdMinutes: shift.lateThresholdMinutes || 15,
      isActive: shift.isActive ?? true,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên ca làm việc');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      toast.error('Vui lòng chọn đầy đủ giờ vào và giờ ra');
      return;
    }
    if (formData.startTime >= formData.endTime) {
      toast.error('Giờ ra phải lớn hơn giờ vào');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateShiftPayload = {
        name: formData.name.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        lateThresholdMinutes: Number(formData.lateThresholdMinutes) || 15,
        isActive: formData.isActive,
      };

      if (editingShift) {
        await shiftApi.updateShift(editingShift._id, payload);
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
      await shiftApi.deleteShift(deletingShift._id);
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
    setTogglingId(shift._id);
    const newStatus = !shift.isActive;
    try {
      await shiftApi.updateShift(shift._id, {
        isActive: newStatus,
      });
      toast.success(
        `Đã chuyển ca "${shift.name}" sang ${newStatus ? 'Đang áp dụng' : 'Tạm ngưng'}!`
      );
      setShifts((prev) =>
        prev.map((s) => (s._id === shift._id ? { ...s, isActive: newStatus } : s))
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
          KPI METRICS STRIP (4 Compact Cards matching code.html)
         ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-purpose="kpi-metric-cards">
        {/* Card 1: Tổng số ca */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Tổng số ca</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.totalShifts}</span>
              <span className="text-xs text-slate-500">ca cấu hình</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 truncate">Hành chính &amp; giảng đường</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Đang áp dụng */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Đang áp dụng</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.activeShifts}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Kích hoạt
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 truncate">Cho phép điểm danh thời gian thực</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Ân hạn đi muộn */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Ân hạn đi muộn</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 leading-none">{kpis.avgGracePeriod}</span>
              <span className="text-xs text-slate-500">phút trung bình</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 truncate">Grace period trước khi tính trễ</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Timer className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Khung giờ trường */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-0.5">Khung giờ trường</span>
            <div className="flex items-baseline gap-1 font-mono text-sm">
              <span className="text-indigo-600 font-bold">{kpis.earliestTime}</span>
              <span className="text-slate-400 text-xs font-normal">đến</span>
              <span className="text-indigo-600 font-bold">{kpis.latestTime}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 truncate">Mở cổng &amp; giảng đường</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* =========================================================================
          FILTER & QUERY CONTROL PANEL (Matching code.html)
         ========================================================================= */}
      <section className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex flex-col gap-3">
        {/* Action Bar Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">Bộ Lọc &amp; Tra Cứu Ca Làm Việc</h2>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <strong className="text-slate-800">{filteredShifts.length}</strong> / {shifts.length} ca
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh Button */}
            <button
              onClick={fetchShifts}
              className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              type="button"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Làm Mới</span>
            </button>
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Xuất danh mục ca làm việc ra file Excel (.xlsx)"
              type="button"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel (.xlsx)</span>
            </button>
            {/* Add Shift Button */}
            {canManage && (
              <button
                onClick={openCreateModal}
                className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
                type="button"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Ca Làm Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs & Dropdowns Row */}
        <div className="grid grid-cols-12 gap-3 items-center">
          {/* Text Search */}
          <div className="col-span-12 sm:col-span-6 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="Tìm theo tên ca, khung giờ (VD: Ca Sáng, 07:00)..."
              type="search"
            />
          </div>

          {/* Period Dropdown */}
          <div className="col-span-6 sm:col-span-3 relative">
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-colors"
            >
              <option value="">-- Tất cả buổi trong ngày --</option>
              <option value="morning">Buổi Sáng</option>
              <option value="afternoon">Buổi Chiều</option>
              <option value="evening">Buổi Tối</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="col-span-6 sm:col-span-3 relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-colors"
            >
              <option value="">-- Tất cả trạng thái --</option>
              <option value="active">Đang áp dụng</option>
              <option value="inactive">Tạm ngưng</option>
            </select>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN SHIFTS DATA TABLE CONTAINER (Strict Zero-Scroll Layout)
         ========================================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden" data-purpose="shift-table-card">
        {/* Table Header Utility Title */}
        <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Danh Sách Ca Làm Việc &amp; Khung Giờ</h3>
            <span className="bg-slate-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold border border-slate-200">
              {filteredShifts.length} / {shifts.length} ca
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Quy chuẩn 45 phút / tiết học</span>
          </div>
        </div>

        {/* Table: table-fixed with Zero Horizontal Scrollbar */}
        <div className="w-full overflow-hidden">
          <table className="table-fixed w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="w-[20%] py-2.5 pl-4 pr-2 font-semibold">Tên ca làm việc</th>
                <th className="w-[13%] py-2.5 px-2 font-semibold">Buổi trong ngày</th>
                <th className="w-[11%] py-2.5 px-2 text-center font-semibold">Giờ vào (Check-in)</th>
                <th className="w-[11%] py-2.5 px-2 text-center font-semibold">Giờ ra (Check-out)</th>
                <th className="w-[11%] py-2.5 px-2 font-semibold">Thời lượng ca</th>
                <th className="w-[11%] py-2.5 px-2 font-semibold">Ân hạn đi muộn</th>
                <th className="w-[13%] py-2.5 px-3 text-center font-semibold">Trạng thái</th>
                <th className="w-[10%] py-2.5 pl-2 pr-4 text-center font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-medium">Đang tải cấu hình ca làm việc...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="text-xs font-semibold text-slate-600">Không tìm thấy ca làm việc nào</span>
                      <p className="text-[11px] text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedShifts.map((s) => {
                  const period = getShiftPeriodType(s.startTime);
                  const PeriodIcon = period.icon;
                  const duration = calculateDuration(s.startTime, s.endTime);
                  const shortId = (s._id || '').slice(-6).toUpperCase();

                  return (
                    <tr key={s._id} className="hover:bg-indigo-50/30 transition-colors group">
                      {/* Tên ca làm việc + ID */}
                      <td className="py-3 pl-4 pr-2 align-middle">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 group-hover:text-indigo-900 truncate">
                            {s.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 tracking-wider">
                            ID: {shortId}
                          </span>
                        </div>
                      </td>

                      {/* Buổi trong ngày */}
                      <td className="py-3 px-2 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${period.badgeClass}`}>
                          <PeriodIcon className="w-3.5 h-3.5" />
                          <span>{period.label}</span>
                        </span>
                      </td>

                      {/* Giờ vào (Check-in) */}
                      <td className="py-3 px-2 align-middle text-center">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono text-xs font-bold tracking-tight border border-emerald-200/60">
                          {s.startTime}
                        </span>
                      </td>

                      {/* Giờ ra (Check-out) */}
                      <td className="py-3 px-2 align-middle text-center">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold tracking-tight border border-indigo-200/60">
                          {s.endTime}
                        </span>
                      </td>

                      {/* Thời lượng ca */}
                      <td className="py-3 px-2 align-middle">
                        <span className="text-xs font-medium text-slate-700">{duration}</span>
                      </td>

                      {/* Ân hạn đi muộn */}
                      <td className="py-3 px-2 align-middle">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-mono text-[11px] font-semibold">
                          <Timer className="w-3 h-3 text-amber-600" />
                          <span>{s.lateThresholdMinutes || 15} phút</span>
                        </span>
                      </td>

                      {/* Trạng thái (Hỗ trợ click chuyển đổi nhanh) */}
                      <td className="py-3 px-3 align-middle text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!canManage || togglingId === s._id}
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                            canManage ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'
                          } ${
                            s.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          } ${togglingId === s._id ? 'opacity-50 pointer-events-none' : ''}`}
                          title={canManage ? 'Nhấn để chuyển đổi trạng thái ca' : undefined}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>
                            {togglingId === s._id
                              ? 'Đang đổi...'
                              : s.isActive
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
                            className="w-7 h-7 rounded-md hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Xem chi tiết"
                            type="button"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => openEditModal(s)}
                              className="w-7 h-7 rounded-md hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                              title="Chỉnh sửa ca"
                              type="button"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setDeletingShift(s)}
                              className="w-7 h-7 rounded-md hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
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
        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Trang <strong className="text-slate-800">{currentPage}</strong> / {totalPages} (Tổng cộng{' '}
              <strong className="text-slate-800">{filteredShifts.length}</strong> ca làm việc)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
                currentPage <= 1
                  ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer'
              }`}
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 rounded-md bg-indigo-600 text-white font-semibold flex items-center justify-center shadow-xs text-xs"
              type="button"
            >
              {currentPage}
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
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

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA CA LÀM VIỆC
         ========================================================================= */}
      {(isCreateModalOpen || editingShift) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
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
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              {formData.startTime && formData.endTime && (
                <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
                  <span>Thời lượng ca dự kiến:</span>
                  <span className="font-bold">{calculateDuration(formData.startTime, formData.endTime)}</span>
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
                    max="120"
                    value={formData.lateThresholdMinutes}
                    onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: Number(e.target.value) })}
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
                      checked={formData.isActive === true}
                      onChange={() => setFormData({ ...formData, isActive: true })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Đang áp dụng (Active)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === false}
                      onChange={() => setFormData({ ...formData, isActive: false })}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Ca Làm Việc</h3>
                  <span className="text-[11px] font-mono text-slate-400">ID: {viewingShift._id}</span>
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
                <p className="text-base font-bold text-slate-900">{viewingShift.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Giờ vào (Check-in)
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200/60">
                    {viewingShift.startTime}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Giờ ra (Check-out)
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200/60">
                    {viewingShift.endTime}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Thời lượng ca
                  </span>
                  <p className="text-xs font-bold text-slate-800">
                    {calculateDuration(viewingShift.startTime, viewingShift.endTime)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Ân hạn đi muộn
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Timer className="w-3.5 h-3.5" />
                    {viewingShift.lateThresholdMinutes || 15} phút
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Trạng thái
                </span>
                {viewingShift.isActive ? (
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Xác Nhận Xóa Ca Làm Việc</h3>
                <p className="text-xs text-slate-500">
                  Bạn có chắc chắn muốn xóa ca làm việc{' '}
                  <b className="text-slate-800 font-semibold">{deletingShift.name}</b> ({deletingShift.startTime} - {deletingShift.endTime})?
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
