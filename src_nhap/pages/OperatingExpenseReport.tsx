import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Loader2,
  Download,
  Search,
  FileText,
  Building2,
  Wallet,
  Edit2,
  Sparkles,
  XCircle,
  Check,
  RefreshCw,
  PlusCircle,
  Trash2,
  Home,
  Zap,
  Droplets,
  Wifi,
  Armchair,
  Wrench,
  PenTool,
  Monitor,
  Megaphone,
  PartyPopper,
  Truck,
  Landmark,
  SprayCan,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Repeat,
  Copy,
  PieChart,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bar: string }> = {
  rent: { label: 'Tiền thuê nhà / Mặt bằng', icon: Home, color: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-500' },
  electricity: { label: 'Tiền điện', icon: Zap, color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  water: { label: 'Tiền nước', icon: Droplets, color: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500' },
  internet: { label: 'Internet / Viễn thông', icon: Wifi, color: 'bg-cyan-50 text-cyan-700 border-cyan-200', bar: 'bg-cyan-500' },
  facility: { label: 'Cơ sở vật chất / Thiết bị', icon: Armchair, color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500' },
  maintenance: { label: 'Sửa chữa / Bảo trì', icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  office_supplies: { label: 'Văn phòng phẩm', icon: PenTool, color: 'bg-lime-50 text-lime-700 border-lime-200', bar: 'bg-lime-500' },
  software: { label: 'Phần mềm / Dịch vụ online', icon: Monitor, color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500' },
  marketing: { label: 'Marketing / Quảng cáo', icon: Megaphone, color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', bar: 'bg-fuchsia-500' },
  event: { label: 'Sự kiện / Hội thảo', icon: PartyPopper, color: 'bg-pink-50 text-pink-700 border-pink-200', bar: 'bg-pink-500' },
  transport: { label: 'Đi lại / Vận chuyển', icon: Truck, color: 'bg-teal-50 text-teal-700 border-teal-200', bar: 'bg-teal-500' },
  tax_fee: { label: 'Thuế / Phí / Lệ phí', icon: Landmark, color: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500' },
  cleaning: { label: 'Vệ sinh / An ninh', icon: SprayCan, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  other: { label: 'Chi phí khác', icon: MoreHorizontal, color: 'bg-slate-100 text-slate-700 border-slate-200', bar: 'bg-slate-500' }
};

const UNIT_PRESETS: Record<string, string> = {
  rent: 'tháng', electricity: 'kWh', water: 'm³', internet: 'tháng', software: 'tháng', cleaning: 'tháng'
};

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: 'Chuyển khoản', cash: 'Tiền mặt', card: 'Thẻ', other: 'Khác'
};

const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatShort = (n: number) => {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' tr';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
};

const toDateInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function OperatingExpenseReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [campuses, setCampuses] = useState<any[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const emptyForm = {
    campus: '',
    category: 'rent',
    title: '',
    vendor: '',
    invoiceNo: '',
    quantity: 1,
    unit: 'tháng',
    unitPrice: 0,
    dueDate: '',
    status: 'Pending',
    paidDate: '',
    paymentMethod: 'bank_transfer',
    isRecurring: false,
    note: ''
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    apiClient.get('/campuses')
      .then(res => setCampuses(res.data?.data || res.data || []))
      .catch(() => setCampuses([]));
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, selectedCampus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/operating-expenses/monthly-summary?month=${selectedMonth}&year=${selectedYear}&campus=${selectedCampus}`);
      if (res.data.success) setData(res.data.data);
    } catch (err: any) {
      toast.error('Lỗi khi tải báo cáo chi phí: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (data?.items || []).filter((it: any) => {
      if (filterCategory !== 'all' && it.category !== filterCategory) return false;
      if (filterStatus !== 'all' && it.status !== filterStatus) return false;
      if (!q) return true;
      return [it.title, it.vendor, it.invoiceNo, it.note, it.campus?.name].some((v: string) => v?.toLowerCase().includes(q));
    });
  }, [data, filterCategory, filterStatus, searchQuery]);

  const filteredTotal = filteredItems.reduce((s: number, it: any) => s + (it.amount || 0), 0);
  const formAmount = Math.round((Number(form.quantity) || 0) * (Number(form.unitPrice) || 0));

  const defaultDate = () => {
    const now = new Date();
    const d = (now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear) ? now.getDate() : 1;
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const openAdd = (category?: string) => {
    setEditingId(null);
    const cat = category || 'rent';
    setForm({
      ...emptyForm,
      category: cat,
      unit: UNIT_PRESETS[cat] || 'lần',
      isRecurring: ['rent', 'internet', 'software', 'cleaning'].includes(cat),
      campus: selectedCampus !== 'all' && selectedCampus !== 'general' ? selectedCampus : '',
      dueDate: defaultDate()
    });
    setModalOpen(true);
  };

  const openEdit = (it: any) => {
    setEditingId(it._id);
    setForm({
      campus: it.campus?._id || '',
      category: it.category,
      title: it.title || '',
      vendor: it.vendor || '',
      invoiceNo: it.invoiceNo || '',
      quantity: it.quantity || 1,
      unit: it.unit || 'tháng',
      unitPrice: it.unitPrice || 0,
      dueDate: toDateInput(it.dueDate),
      status: it.status || 'Pending',
      paidDate: toDateInput(it.paidDate),
      paymentMethod: it.paymentMethod || 'bank_transfer',
      isRecurring: !!it.isRecurring,
      note: it.note || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        campus: form.campus || null,
        quantity: Number(form.quantity) || 1,
        unitPrice: Number(form.unitPrice) || 0,
        month: selectedMonth,
        year: selectedYear
      };
      const res = editingId
        ? await apiClient.put(`/operating-expenses/${editingId}`, payload)
        : await apiClient.post('/operating-expenses', payload);
      if (res.data.success) {
        toast.success(res.data.message || 'Đã lưu khoản chi phí');
        setModalOpen(false);
        await fetchData();
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (it: any) => {
    try {
      const res = await apiClient.patch(`/operating-expenses/${it._id}/status`, {
        status: it.status === 'Paid' ? 'Pending' : 'Paid'
      });
      if (res.data.success) {
        toast.success(res.data.message);
        await fetchData();
      }
    } catch (err: any) {
      toast.error('Lỗi cập nhật trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (it: any) => {
    if (!window.confirm(`Xóa khoản chi "${it.title}" (${formatVND(it.amount)})?`)) return;
    try {
      const res = await apiClient.delete(`/operating-expenses/${it._id}`);
      if (res.data.success) {
        toast.success('Đã xóa khoản chi phí');
        await fetchData();
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCopyRecurring = async () => {
    setCopying(true);
    try {
      const res = await apiClient.post('/operating-expenses/copy-recurring', { month: selectedMonth, year: selectedYear });
      if (res.data.success) {
        toast.success(res.data.message);
        await fetchData();
      }
    } catch (err: any) {
      toast.error('Lỗi sao chép: ' + (err.response?.data?.message || err.message));
    } finally {
      setCopying(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredItems.length) {
      toast.error('Không có dữ liệu để xuất!');
      return;
    }
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['STT', 'Hạng mục', 'Nội dung', 'Cơ sở', 'Nhà cung cấp', 'Số HĐ/Chứng từ', 'Số lượng', 'Đơn vị', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)', 'Hạn thanh toán', 'Trạng thái', 'Ngày thanh toán', 'Hình thức', 'Định kỳ', 'Ghi chú'];
    const rows = filteredItems.map((it: any, i: number) => [
      i + 1,
      esc(CATEGORY_META[it.category]?.label || it.categoryLabel),
      esc(it.title),
      esc(it.campus?.name || 'Chi phí chung'),
      esc(it.vendor),
      esc(it.invoiceNo),
      it.quantity,
      esc(it.unit),
      it.unitPrice,
      it.amount,
      it.dueDate ? new Date(it.dueDate).toLocaleDateString('vi-VN') : '',
      it.status === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
      it.paidDate ? new Date(it.paidDate).toLocaleDateString('vi-VN') : '',
      esc(PAYMENT_LABELS[it.paymentMethod] || ''),
      it.isRecurring ? 'Có' : '',
      esc(it.note)
    ]);
    const summary = [
      [],
      ['', 'TỔNG CHI PHÍ VẬN HÀNH', '', '', '', '', '', '', '', filteredTotal],
      ...(data?.payrollTotal != null ? [
        ['', 'QUỸ LƯƠNG THÁNG', '', '', '', '', '', '', '', data.payrollTotal],
        ['', 'TỔNG CHI PHÍ DOANH NGHIỆP', '', '', '', '', '', '', '', data.grandTotal]
      ] : [])
    ];
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any[]) => r.join(',')), ...summary.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chi_Phi_Van_Hanh_Thang_${selectedMonth}_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Đã tải xuống báo cáo CSV!');
  };

  const isOverdue = (it: any) => it.status !== 'Paid' && it.dueDate && new Date(it.dueDate) < new Date(new Date().toDateString());
  const maxTrend = Math.max(1, ...(data?.trend || []).map((t: any) => (t.expense || 0) + (t.payroll || 0)));
  const showPayroll = data?.payrollTotal != null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold mb-2 border border-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            Tiền nhà • Điện nước • Internet • Cơ sở vật chất • Chi phí phát sinh
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Báo cáo Chi phí Vận hành</h1>
          <p className="text-slate-500 text-sm mt-1">
            Theo dõi toàn bộ chi phí hoạt động doanh nghiệp theo tháng, theo cơ sở và hạng mục — kết hợp với quỹ lương để ra tổng chi phí.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-3.5 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none pr-2 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <span className="text-slate-300 mx-2">/</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin text-indigo-600')} />
            Làm mới
          </button>

          <button
            onClick={handleCopyRecurring}
            disabled={copying}
            title="Sao chép các khoản định kỳ (tiền nhà, internet...) từ tháng trước"
            className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border border-indigo-200 cursor-pointer disabled:opacity-60"
          >
            {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Chép định kỳ tháng trước
          </button>

          <button
            id="btn-add-expense"
            onClick={() => openAdd()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Thêm chi phí
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Xuất CSV/Excel
          </button>
        </div>
      </header>

      {/* Recurring reminder */}
      {data?.pendingRecurringCopy > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-indigo-900 font-semibold">
            <Repeat className="w-4 h-4 text-indigo-600" />
            Có <strong>{data.pendingRecurringCopy}</strong> khoản chi phí định kỳ của tháng trước chưa được đưa vào Tháng {selectedMonth}/{selectedYear}.
          </div>
          <button
            onClick={handleCopyRecurring}
            disabled={copying}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer"
          >
            {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Sao chép ngay
          </button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider">Tổng chi phí vận hành</p>
          <p className="text-3xl font-black mt-2">{formatVND(data?.total || 0)}</p>
          <div className="flex items-center gap-1 text-xs text-indigo-100 mt-2 font-medium">
            {data?.changePercent == null ? (
              <span>{data?.count || 0} khoản • Tháng {selectedMonth}/{selectedYear}</span>
            ) : (
              <>
                {data.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {data.changePercent >= 0 ? '+' : ''}{data.changePercent}% so với tháng trước ({formatShort(data.prevTotal)})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tình trạng thanh toán</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold"><CheckCircle2 className="w-4 h-4" /> Đã chi</span>
              <span className="font-black text-slate-900">{formatVND(data?.paid || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-amber-600 font-bold"><Clock className="w-4 h-4" /> Chưa chi</span>
              <span className="font-black text-slate-900">{formatVND(data?.pending || 0)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${data?.total ? Math.round((data.paid / data.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        <Link
          to="/payroll-report"
          className={cn(
            'bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group',
            !showPayroll && 'opacity-60'
          )}
        >
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Quỹ lương tháng
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {showPayroll ? formatVND(data.payrollTotal) : '—'}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 mt-1">
            {showPayroll ? `${data.payrollPersonnel || 0} nhân sự • Xem bảng lương` : 'Chỉ hiển thị khi xem toàn công ty'}
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </Link>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Tổng chi phí doanh nghiệp</p>
          <p className="text-3xl font-black mt-2">{formatVND(data?.grandTotal || 0)}</p>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {showPayroll ? 'Chi phí vận hành + Quỹ lương' : 'Chi phí vận hành của cơ sở đã chọn'}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By category */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 lg:col-span-1">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-indigo-600" /> Theo hạng mục
          </h3>
          {!data?.byCategory?.length ? (
            <p className="text-sm text-slate-400">Chưa có chi phí nào.</p>
          ) : (
            <div className="space-y-3">
              {data.byCategory.map((c: any) => {
                const meta = CATEGORY_META[c.category] || CATEGORY_META.other;
                const Icon = meta.icon;
                const pct = data.total ? Math.round((c.total / data.total) * 100) : 0;
                return (
                  <button
                    key={c.category}
                    onClick={() => setFilterCategory(filterCategory === c.category ? 'all' : c.category)}
                    className={cn(
                      'w-full text-left group cursor-pointer rounded-xl p-1.5 -m-1.5 transition-colors',
                      filterCategory === c.category ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Icon className="w-3.5 h-3.5 text-slate-500" /> {meta.label}
                        <span className="text-slate-400 font-semibold">({c.count})</span>
                      </span>
                      <span className="font-black text-slate-900">{formatShort(c.total)} <span className="text-slate-400 font-bold">• {pct}%</span></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-700', meta.bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* By campus */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-indigo-600" /> Theo cơ sở
          </h3>
          {!data?.byCampus?.length ? (
            <p className="text-sm text-slate-400">Chưa có chi phí nào.</p>
          ) : (
            <div className="space-y-2.5">
              {data.byCampus.map((c: any) => {
                const pct = data.total ? Math.round((c.total / data.total) * 100) : 0;
                return (
                  <div key={c.campusId} className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-100 bg-slate-50/60">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                      {pct}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.count} khoản chi</p>
                    </div>
                    <span className="text-sm font-black text-slate-900">{formatVND(c.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trend */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Xu hướng 6 tháng
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 mb-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Vận hành</span>
            {showPayroll && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" /> Lương</span>}
          </div>
          <div className="flex items-end justify-between gap-2 h-40">
            {(data?.trend || []).map((t: any) => {
              const total = (t.expense || 0) + (t.payroll || 0);
              const isCurrent = t.month === selectedMonth && t.year === selectedYear;
              return (
                <button
                  key={`${t.month}-${t.year}`}
                  onClick={() => { setSelectedMonth(t.month); setSelectedYear(t.year); }}
                  title={`T${t.month}/${t.year}: Vận hành ${formatVND(t.expense)}${showPayroll ? ` • Lương ${formatVND(t.payroll)}` : ''}`}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                >
                  <span className="text-[10px] font-bold text-slate-500">{formatShort(total)}</span>
                  <div
                    className={cn('w-full rounded-lg overflow-hidden flex flex-col justify-end transition-all group-hover:opacity-80', isCurrent && 'ring-2 ring-indigo-300 ring-offset-1')}
                    style={{ height: `${Math.max(4, (total / maxTrend) * 100)}%` }}
                  >
                    {showPayroll && t.payroll > 0 && (
                      <div className="bg-emerald-400 w-full" style={{ height: `${(t.payroll / (total || 1)) * 100}%` }} />
                    )}
                    <div className="bg-indigo-500 w-full flex-1" style={{ minHeight: t.expense > 0 ? 3 : 0 }} />
                  </div>
                  <span className={cn('text-[10px] font-bold', isCurrent ? 'text-indigo-700' : 'text-slate-400')}>T{t.month}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm nội dung, nhà cung cấp, số HĐ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <select
            value={selectedCampus}
            onChange={e => setSelectedCampus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700 cursor-pointer"
          >
            <option value="all">Toàn công ty (tất cả cơ sở)</option>
            <option value="general">Chỉ chi phí chung</option>
            {campuses.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả hạng mục</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700 cursor-pointer"
          >
            <option value="all">Mọi trạng thái</option>
            <option value="Paid">Đã thanh toán</option>
            <option value="Pending">Chưa thanh toán</option>
          </select>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Hiển thị <strong className="text-slate-800">{filteredItems.length}</strong> khoản • Tổng <strong className="text-indigo-700">{formatVND(filteredTotal)}</strong>
        </div>
      </div>

      {/* Quick add by category */}
      <div className="flex flex-wrap gap-2">
        {['rent', 'electricity', 'water', 'internet', 'facility', 'maintenance', 'event', 'other'].map(k => {
          const meta = CATEGORY_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              onClick={() => openAdd(k)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer', meta.color)}
            >
              <PlusCircle className="w-3 h-3" /><Icon className="w-3.5 h-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600 font-bold text-base">Chưa có khoản chi phí nào trong Tháng {selectedMonth}/{selectedYear}</p>
            <p className="text-xs text-slate-400 mt-1">Bấm "Thêm chi phí" hoặc chọn nhanh một hạng mục phía trên để bắt đầu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                  <th className="py-4 px-5">Hạng mục / Nội dung</th>
                  <th className="py-4 px-5">Cơ sở</th>
                  <th className="py-4 px-5">Nhà cung cấp</th>
                  <th className="py-4 px-5 text-right">SL x Đơn giá</th>
                  <th className="py-4 px-5 text-right">Thành tiền</th>
                  <th className="py-4 px-5 text-center">Hạn / Trạng thái</th>
                  <th className="py-4 px-5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((it: any) => {
                  const meta = CATEGORY_META[it.category] || CATEGORY_META.other;
                  const Icon = meta.icon;
                  const overdue = isOverdue(it);
                  return (
                    <tr key={it._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border shrink-0', meta.color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {it.title}
                              {it.isRecurring && (
                                <span title="Chi phí định kỳ hàng tháng" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                                  <Repeat className="w-2.5 h-2.5" /> Định kỳ
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400">{meta.label}{it.invoiceNo ? ` • HĐ: ${it.invoiceNo}` : ''}</p>
                            {it.note && <p className="text-[11px] text-amber-600 italic mt-0.5 max-w-xs truncate">📝 {it.note}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {it.campus?.name || 'Chi phí chung'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-xs text-slate-600 font-semibold">{it.vendor || '-'}</td>
                      <td className="py-4 px-5 text-right text-xs text-slate-500">
                        {it.quantity} {it.unit} x {formatVND(it.unitPrice)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="text-base font-black text-indigo-700">{formatVND(it.amount)}</span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => handleToggleStatus(it)}
                          title="Bấm để đổi trạng thái thanh toán"
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-all hover:shadow-sm',
                            it.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : overdue
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          )}
                        >
                          {it.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {it.status === 'Paid' ? 'Đã thanh toán' : overdue ? 'Quá hạn' : 'Chưa thanh toán'}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {it.status === 'Paid' && it.paidDate
                            ? `Chi ngày ${new Date(it.paidDate).toLocaleDateString('vi-VN')}`
                            : it.dueDate ? `Hạn ${new Date(it.dueDate).toLocaleDateString('vi-VN')}` : ''}
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(it)} title="Sửa" className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(it)} title="Xóa" className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={4} className="py-4 px-5 text-right text-xs font-black text-slate-600 uppercase">Tổng cộng</td>
                  <td className="py-4 px-5 text-right text-lg font-black text-indigo-700">{formatVND(filteredTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  {editingId ? 'Sửa khoản chi phí' : 'Thêm khoản chi phí vận hành'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Kỳ báo cáo Tháng {selectedMonth}/{selectedYear}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Category grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Hạng mục</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {Object.entries(CATEGORY_META).map(([k, v]) => {
                    const Icon = v.icon;
                    const active = form.category === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm({ ...form, category: k, unit: editingId ? form.unit : (UNIT_PRESETS[k] || form.unit) })}
                        className={cn(
                          'px-2 py-2 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-all cursor-pointer text-left',
                          active ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung chi <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Tiền thuê mặt bằng cơ sở 1, Hoá đơn điện T10..."
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cơ sở</label>
                  <select
                    value={form.campus}
                    onChange={e => setForm({ ...form, campus: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                  >
                    <option value="">Chi phí chung (toàn công ty)</option>
                    {campuses.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nhà cung cấp / Người nhận</label>
                  <input
                    type="text"
                    placeholder="VD: EVN, Viettel, Chủ nhà..."
                    value={form.vendor}
                    onChange={e => setForm({ ...form, vendor: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị</label>
                  <input
                    type="text"
                    list="expense-units"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                  <datalist id="expense-units">
                    {['tháng', 'kWh', 'm³', 'lần', 'cái', 'bộ', 'gói', 'năm', 'khoản'].map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn giá (VNĐ) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={form.unitPrice}
                    onChange={e => setForm({ ...form, unitPrice: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn thanh toán</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số HĐ / Chứng từ</label>
                  <input
                    type="text"
                    value={form.invoiceNo}
                    onChange={e => setForm({ ...form, invoiceNo: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hình thức</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.status === 'Paid'}
                    onChange={e => setForm({ ...form, status: e.target.checked ? 'Paid' : 'Pending', paidDate: e.target.checked ? (form.paidDate || new Date().toISOString().slice(0, 10)) : '' })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  Đã thanh toán
                </label>
                {form.status === 'Paid' && (
                  <input
                    type="date"
                    value={form.paidDate}
                    onChange={e => setForm({ ...form, paidDate: e.target.value })}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                  />
                )}
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <Repeat className="w-3.5 h-3.5 text-indigo-600" /> Chi phí định kỳ hàng tháng
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 uppercase">Thành tiền:</span>
                <span className="text-lg font-black text-indigo-700">{formatVND(formAmount)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || formAmount <= 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'Cập nhật' : 'Thêm vào báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
