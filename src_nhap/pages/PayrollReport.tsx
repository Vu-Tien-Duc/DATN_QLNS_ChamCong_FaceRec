import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Receipt,
  Users, 
  Loader2, 
  Download, 
  Search, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Building2, 
  Wallet,
  Edit2,
  DollarSign,
  Sparkles,
  Award,
  ChevronRight,
  XCircle,
  Check,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  History,
  ShieldCheck,
  Briefcase,
  Trash2,
  ClipboardList
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PayrollReport() {
  const [loading, setLoading] = useState(true);
  const [payrollData, setPayrollData] = useState<any | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail Drill-down
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  // Edit Rate Modal
  const [editingPerson, setEditingPerson] = useState<any | null>(null);
  const [editSlotRate, setEditSlotRate] = useState<number>(150000);
  const [editBaseSalary, setEditBaseSalary] = useState<number>(0);
  const [editBonus, setEditBonus] = useState<number>(0);
  const [editDeduction, setEditDeduction] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [applyScope, setApplyScope] = useState<'from_now_on' | 'month_only'>('from_now_on');
  const [savingRate, setSavingRate] = useState<boolean>(false);

  // Khoản phát sinh (ngoài chấm công / hợp đồng thời vụ)
  const emptyExtraForm = {
    recipientMode: 'user' as 'user' | 'external',
    userId: '',
    personName: '',
    personPhone: '',
    type: 'task',
    title: '',
    description: '',
    workDate: '',
    quantity: 1,
    unit: 'lần',
    unitPrice: 0
  };
  const [extraModalOpen, setExtraModalOpen] = useState(false);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [extraForm, setExtraForm] = useState<any>(emptyExtraForm);
  const [savingExtra, setSavingExtra] = useState(false);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth, selectedYear, selectedRole]);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/payroll/monthly-summary?month=${selectedMonth}&year=${selectedYear}&role=${selectedRole}`);
      if (res.data.success) {
        setPayrollData(res.data.data);
        // Đồng bộ lại khung chi tiết đang mở
        setSelectedPerson((prev: any) =>
          prev ? (res.data.data.personnel || []).find((p: any) => p.id === prev.id) || null : null
        );
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải bảng lương: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const ensureUserOptions = async () => {
    if (userOptions.length > 0) return;
    try {
      const res = await apiClient.get('/payroll/users-lookup');
      if (res.data.success) setUserOptions(res.data.data || []);
    } catch (err: any) {
      toast.error('Không tải được danh sách nhân sự: ' + (err.response?.data?.message || err.message));
    }
  };

  const defaultWorkDate = () => {
    const now = new Date();
    const d = (now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear)
      ? now.getDate() : 1;
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const openAddExtra = (person?: any) => {
    ensureUserOptions();
    setEditingExtraId(null);
    setUserSearch('');
    if (person?.isExternal) {
      setExtraForm({ ...emptyExtraForm, recipientMode: 'external', personName: person.fullName, personPhone: person.email || '', workDate: defaultWorkDate() });
    } else {
      setExtraForm({ ...emptyExtraForm, userId: person?.id || '', workDate: defaultWorkDate() });
    }
    setExtraModalOpen(true);
  };

  const openEditExtra = (ex: any) => {
    ensureUserOptions();
    setEditingExtraId(ex._id);
    setUserSearch('');
    setExtraForm({
      recipientMode: ex.userId ? 'user' : 'external',
      userId: ex.userId || '',
      personName: ex.personName || '',
      personPhone: ex.personPhone || '',
      type: ex.type || 'task',
      title: ex.title || '',
      description: ex.description || '',
      workDate: ex.workDate ? new Date(ex.workDate).toISOString().slice(0, 10) : '',
      quantity: ex.quantity || 1,
      unit: ex.unit || 'lần',
      unitPrice: ex.unitPrice || 0
    });
    setExtraModalOpen(true);
  };

  const handleSaveExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (extraForm.recipientMode === 'user' && !extraForm.userId) {
      toast.error('Vui lòng chọn nhân sự nhận lương');
      return;
    }
    if (extraForm.recipientMode === 'external' && !extraForm.personName.trim()) {
      toast.error('Vui lòng nhập tên người nhận');
      return;
    }
    setSavingExtra(true);
    try {
      const payload = {
        userId: extraForm.recipientMode === 'user' ? extraForm.userId : null,
        personName: extraForm.recipientMode === 'external' ? extraForm.personName : '',
        personPhone: extraForm.recipientMode === 'external' ? extraForm.personPhone : '',
        type: extraForm.type,
        title: extraForm.title,
        description: extraForm.description,
        workDate: extraForm.workDate || undefined,
        quantity: Number(extraForm.quantity) || 1,
        unit: extraForm.unit,
        unitPrice: Number(extraForm.unitPrice) || 0,
        month: selectedMonth,
        year: selectedYear
      };
      const res = editingExtraId
        ? await apiClient.put(`/payroll/extras/${editingExtraId}`, payload)
        : await apiClient.post('/payroll/extras', payload);
      if (res.data.success) {
        toast.success(res.data.message || 'Đã lưu khoản phát sinh');
        setExtraModalOpen(false);
        await fetchPayroll();
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu khoản phát sinh: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingExtra(false);
    }
  };

  const handleDeleteExtra = async (ex: any) => {
    if (!window.confirm(`Xóa khoản phát sinh "${ex.title}" (${formatVND(ex.amount)})?`)) return;
    try {
      const res = await apiClient.delete(`/payroll/extras/${ex._id}`);
      if (res.data.success) {
        toast.success('Đã xóa khoản phát sinh');
        await fetchPayroll();
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredUserOptions = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter((u: any) =>
      u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [userOptions, userSearch]);

  const extraFormAmount = Math.round((Number(extraForm.quantity) || 0) * (Number(extraForm.unitPrice) || 0));

  const handleOpenEditRate = (person: any) => {
    setEditingPerson(person);
    setEditSlotRate(person.slotRate || (person.userType === 'teacher' ? 200000 : 150000));
    setEditBaseSalary(person.baseSalary || 0);
    setEditBonus(person.bonus || 0);
    setEditDeduction(person.deduction || 0);
    setEditNote(person.note || '');
    setApplyScope('from_now_on');
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    setSavingRate(true);
    try {
      const res = await apiClient.put('/payroll/update-rate', {
        userId: editingPerson.id,
        userType: editingPerson.userType,
        slotRate: Number(editSlotRate) || 0,
        baseSalary: Number(editBaseSalary) || 0,
        bonus: Number(editBonus) || 0,
        deduction: Number(editDeduction) || 0,
        note: editNote,
        month: selectedMonth,
        year: selectedYear,
        applyScope
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Đã lưu đơn giá và tính lại lương thành công!');
        setEditingPerson(null);
        await fetchPayroll();
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu và tính lại lương: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingRate(false);
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  // Tính toán preview trước khi lưu
  const modalCalculatedTotal = useMemo(() => {
    if (!editingPerson) return 0;
    const slots = editingPerson.approvedSlots || 0;
    const slotSal = slots * (Number(editSlotRate) || 0);
    const total = slotSal + (Number(editBaseSalary) || 0) + (Number(editBonus) || 0) + (editingPerson.extraAmount || 0) - (Number(editDeduction) || 0);
    return Math.max(0, total);
  }, [editingPerson, editSlotRate, editBaseSalary, editBonus, editDeduction]);

  const handleExportCSV = () => {
    if (!filteredPersonnel || filteredPersonnel.length === 0) {
      toast.error('Không có dữ liệu để xuất!');
      return;
    }

    const headers = ['STT', 'Họ và tên', 'Email', 'Vai trò / Phòng ban', 'Số ca đã duyệt', 'Đơn giá/Ca (VNĐ)', 'Lương theo ca (VNĐ)', 'Lương cứng/Phụ cấp (VNĐ)', 'Phát sinh (VNĐ)', 'Chi tiết phát sinh', 'Thưởng (VNĐ)', 'Giảm trừ (VNĐ)', 'TỔNG LƯƠNG THỰC NHẬN (VNĐ)', 'Ghi chú'];
    
    const rows = filteredPersonnel.map((p: any, idx: number) => [
      idx + 1,
      `"${p.fullName || ''}"`,
      `"${p.email || ''}"`,
      `"${p.roleName || ''}"`,
      p.approvedSlots || 0,
      p.slotRate || 0,
      p.slotsSalary || (p.approvedSlots * p.slotRate),
      p.baseSalary || 0,
      p.extraAmount || 0,
      `"${(p.extras || []).map((e: any) => `${e.title}: ${e.amount}`).join('; ').replace(/"/g, '""')}"`,
      p.bonus || 0,
      p.deduction || 0,
      p.totalSalary || 0,
      `"${(p.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Luong_Tong_Hop_Thang_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải xuống bảng lương CSV thành công!');
  };

  const filteredPersonnel = (payrollData?.personnel || []).filter((p: any) =>
    p.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeStyle = (userType: string) => {
    switch (userType) {
      case 'teacher':
        return "bg-violet-50 text-violet-700 border-violet-200";
      case 'receptionist':
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case 'sales':
        return "bg-amber-50 text-amber-800 border-amber-200";
      case 'accountant':
        return "bg-rose-50 text-rose-700 border-rose-200";
      case 'marketing':
        return "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200";
      case 'shift_worker':
        return "bg-teal-50 text-teal-800 border-teal-200";
      case 'operations':
        return "bg-sky-50 text-sky-700 border-sky-200";
      case 'collaborator':
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold mb-2 border border-emerald-300">
            <Sparkles className="w-3.5 h-3.5" />
            Tổng hợp Lương Giảng viên, Nhân viên & Nhân sự các Cơ sở
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bảng Lương & Thống kê Ca làm</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng hợp số ca đã duyệt của Giảng viên, Nhân viên văn phòng, Sale, Lễ tân, Kế toán, Vận hành và Thời vụ để tính lương tự động.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-3.5 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600 mr-2" />
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none pr-2 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <span className="text-slate-300 mx-2">/</span>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={fetchPayroll}
            title="Làm mới & Tính lại"
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-emerald-600")} />
            Tính lại
          </button>

          <Link
            to="/operating-expense-report"
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-indigo-600" /> Chi phí vận hành (CSVC, điện nước...)
          </Link>

          <button 
            id="btn-add-payroll-extra"
            onClick={() => openAddExtra()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Thêm khoản phát sinh
          </button>

          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Xuất Bảng Lương (CSV/Excel)
          </button>
        </div>
      </header>

      {/* Summary KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-xs text-emerald-100 font-bold uppercase tracking-wider">Tổng Quỹ Lương Dự Tính</p>
          <p className="text-3xl font-black mt-2">
            {formatVND(payrollData?.totalCompanyPayroll || 0)}
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-200 mt-2 font-medium">
            <Wallet className="w-3.5 h-3.5" />
            Tháng {selectedMonth}/{selectedYear} • Tự động cập nhật vào DB
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng số Ca/Slot đã Duyệt</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {payrollData?.totalSlotsAll || 0} <span className="text-sm font-bold text-slate-500">ca</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Số Nhân sự Tính Lương</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {payrollData?.totalPersonnel || 0} <span className="text-sm font-bold text-slate-500">người</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSelectedRole('extra')}
          title="Lọc những nhân sự có khoản phát sinh"
          className="bg-white p-5 rounded-3xl border border-orange-200/80 shadow-sm flex items-center gap-4 text-left hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Khoản phát sinh</p>
            <p className="text-2xl font-black text-orange-600 mt-0.5">
              {formatVND(payrollData?.totalExtraAll || 0)}
            </p>
            <p className="text-[11px] text-slate-400 font-semibold">{payrollData?.totalExtraCount || 0} khoản • ngoài chấm công</p>
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Tất cả nhân sự (GV, Nhân viên, Lễ tân, Sale, Vận hành, Thời vụ)</option>
            <option value="staff">Tất cả Nhân viên văn phòng</option>
            <option value="teacher">Giảng viên</option>
            <option value="receptionist">Lễ tân</option>
            <option value="sales">Sale / Tư vấn viên</option>
            <option value="accountant">Kế toán / Tài chính</option>
            <option value="marketing">Marketing</option>
            <option value="operations">Vận hành / Quản trị</option>
            <option value="shift_worker">Nhân sự thời vụ</option>
            <option value="extra">Chỉ nhân sự có khoản phát sinh</option>
            <option value="collaborator">Cộng tác viên / Ngoài hệ thống</option>
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <History className="w-4 h-4 text-emerald-600" />
          Bấm biểu tượng ✏️ để sửa đơn giá ca làm & tính lại lương cho từng nhân sự
        </div>
      </div>

      {/* PAYROLL TABLE */}
      <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          </div>
        ) : filteredPersonnel.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600 font-bold text-base">Không có dữ liệu tính lương nào trong tháng này</p>
            <p className="text-xs text-slate-400 mt-1">
              Đảm bảo các ca chấm công của Giảng viên hoặc Nhân viên đã được Admin phê duyệt
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                  <th className="py-4 px-5">Nhân sự</th>
                  <th className="py-4 px-5">Vai trò / Phòng ban</th>
                  <th className="py-4 px-5 text-center">Số Ca đã duyệt</th>
                  <th className="py-4 px-5 text-right">Đơn giá / 1 Ca</th>
                  <th className="py-4 px-5 text-right">Lương theo ca</th>
                  <th className="py-4 px-5 text-right">Lương cứng / Phụ cấp</th>
                  <th className="py-4 px-5 text-right">Phát sinh</th>
                  <th className="py-4 px-5 text-right">Thưởng / Phạt</th>
                  <th className="py-4 px-5 text-right">TỔNG LƯƠNG THỰC NHẬN</th>
                  <th className="py-4 px-5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPersonnel.map((person: any, idx: number) => {
                  const slotsSalary = person.slotsSalary || (person.approvedSlots * person.slotRate);
                  const bonus = person.bonus || 0;
                  const deduction = person.deduction || 0;

                  return (
                    <tr key={person.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Personnel Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm",
                            person.userType === 'teacher' ? "bg-violet-100 text-violet-700 border-violet-200" :
                            person.userType === 'receptionist' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            person.userType === 'sales' ? "bg-amber-100 text-amber-800 border-amber-200" :
                            person.userType === 'accountant' ? "bg-rose-100 text-rose-800 border-rose-200" :
                            person.userType === 'marketing' ? "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" :
                            person.userType === 'shift_worker' ? "bg-teal-100 text-teal-800 border-teal-200" :
                            "bg-blue-100 text-blue-700 border-blue-200"
                          )}>
                            {person.fullName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{person.fullName}</p>
                            <p className="text-xs text-slate-400">{person.email || 'Chưa có email'}</p>
                            {person.note && (
                              <p className="text-[11px] text-amber-600 italic mt-0.5 max-w-xs truncate">
                                📝 {person.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1",
                          getRoleBadgeStyle(person.userType)
                        )}>
                          {person.roleName}
                        </span>
                      </td>

                      {/* Approved Slots */}
                      <td className="py-4 px-5 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          {person.approvedSlots} ca
                        </span>
                      </td>

                      {/* Slot Rate */}
                      <td className="py-4 px-5 text-right font-bold text-slate-800">
                        {person.isExternal ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span>{formatVND(person.slotRate)}</span>
                          <button
                            onClick={() => handleOpenEditRate(person)}
                            className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Sửa đơn giá ca làm & tính lại lương"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        )}
                      </td>

                      {/* Slots Salary */}
                      <td className="py-4 px-5 text-right font-semibold text-slate-700">
                        {formatVND(slotsSalary)}
                      </td>

                      {/* Base Salary */}
                      <td className="py-4 px-5 text-right font-semibold text-slate-600">
                        {formatVND(person.baseSalary)}
                      </td>

                      {/* Extras */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {person.extraAmount > 0 ? (
                            <button
                              onClick={() => setSelectedPerson(person)}
                              className="text-orange-600 font-bold text-sm hover:underline cursor-pointer"
                              title="Xem chi tiết các khoản phát sinh"
                            >
                              +{formatVND(person.extraAmount)}
                              <span className="block text-[10px] text-orange-400 font-semibold">{person.extras?.length || 0} khoản</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          <button
                            onClick={() => openAddExtra(person)}
                            className="text-slate-400 hover:text-orange-600 p-1.5 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
                            title="Thêm khoản phát sinh cho nhân sự này"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Bonus / Deduction */}
                      <td className="py-4 px-5 text-right text-xs">
                        {bonus > 0 && (
                          <div className="text-emerald-600 font-bold">+{formatVND(bonus)}</div>
                        )}
                        {deduction > 0 && (
                          <div className="text-rose-500 font-bold">-{formatVND(deduction)}</div>
                        )}
                        {bonus === 0 && deduction === 0 && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Total Salary */}
                      <td className="py-4 px-5 text-right">
                        <span className="text-base font-black text-emerald-600 bg-emerald-50/90 px-3 py-1.5 rounded-xl border border-emerald-200 inline-block shadow-sm">
                          {formatVND(person.totalSalary)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!person.isExternal && (
                          <button
                            onClick={() => handleOpenEditRate(person)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Chỉnh sửa đơn giá và tính lại"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Sửa giá
                          </button>
                          )}
                          <button
                            onClick={() => setSelectedPerson(selectedPerson?.id === person.id ? null : person)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            Chi tiết
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Person Detail Drill-down */}
      {selectedPerson && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 border-t-4 border-t-emerald-600">
          <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-black text-xl text-slate-900">
                Chi tiết ca làm của {selectedPerson.fullName} ({selectedPerson.roleName})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tổng cộng {selectedPerson.approvedSlots} ca được duyệt • Đơn giá: {formatVND(selectedPerson.slotRate)}/ca • Tổng lương: <strong className="text-emerald-600 font-bold">{formatVND(selectedPerson.totalSalary)}</strong>
              </p>
            </div>
            <button
              onClick={() => setSelectedPerson(null)}
              className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full border border-slate-200 cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-x-auto space-y-6">
            {/* Khoản phát sinh */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-orange-500" />
                  Khoản phát sinh ngoài chấm công
                  <span className="text-orange-600">({formatVND(selectedPerson.extraAmount || 0)})</span>
                </h4>
                <button
                  onClick={() => openAddExtra(selectedPerson)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Thêm khoản
                </button>
              </div>
              {!selectedPerson.extras?.length ? (
                <p className="text-slate-400 text-sm">Chưa có khoản phát sinh nào trong tháng này.</p>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-orange-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-orange-50/50">
                      <th className="py-3 px-4">Ngày</th>
                      <th className="py-3 px-4">Loại</th>
                      <th className="py-3 px-4">Nội dung công việc / Nhiệm vụ</th>
                      <th className="py-3 px-4 text-right">Số lượng x Đơn giá</th>
                      <th className="py-3 px-4 text-right">Thành tiền</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPerson.extras.map((ex: any) => (
                      <tr key={ex._id} className="hover:bg-orange-50/30">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {ex.workDate ? new Date(ex.workDate).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            {ex.typeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{ex.title}</p>
                          {ex.description && <p className="text-xs text-slate-500 italic">{ex.description}</p>}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-600">
                          {ex.quantity} {ex.unit} x {formatVND(ex.unitPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-orange-600">{formatVND(ex.amount)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditExtra(ex)} title="Sửa" className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteExtra(ex)} title="Xóa" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!selectedPerson.isExternal && (
            <div>
            <h4 className="font-extrabold text-slate-800 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Ca làm đã duyệt ({selectedPerson.approvedSlots || 0} ca)
            </h4>
            {!selectedPerson.logs?.length ? (
              <p className="text-slate-400 text-sm">Chưa có thông tin ca chi tiết.</p>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Ngày làm việc</th>
                    <th className="py-3 px-4">Cơ sở trực/dạy</th>
                    <th className="py-3 px-4">Các Ca / Slot</th>
                    <th className="py-3 px-4">Thông tin bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPerson.logs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {new Date(log.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600 text-xs">
                          <Building2 className="w-3.5 h-3.5" />
                          {log.campusName || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {log.slots?.map((s: any, i: number) => (
                            <span key={i} className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {s.name || s.slotId} {s.shift ? `(${s.shift})` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 italic">
                        {log.note || log.subjects?.join(', ') || log.classes?.join(', ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editingPerson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                Thay đổi Đơn Giá & Tính Lại Lương
              </h3>
              <button
                onClick={() => setEditingPerson(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                {editingPerson.fullName?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{editingPerson.fullName}</p>
                <p className="text-xs text-slate-500">
                  {editingPerson.roleName} • Tháng {selectedMonth}/{selectedYear} • <span className="font-bold text-blue-600">{editingPerson.approvedSlots || 0} ca đã duyệt</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRate} className="space-y-4">
              {/* Đơn giá ca làm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Đơn giá 1 Ca làm việc (VNĐ/ca) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={5000}
                    value={editSlotRate}
                    onChange={e => setEditSlotRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    VNĐ / ca
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Thành tiền: <strong className="text-emerald-700 font-bold">{formatVND(editSlotRate)}</strong></span>
                  <div className="flex gap-1.5">
                    {[100000, 150000, 200000, 250000, 300000, 500000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditSlotRate(val)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border cursor-pointer"
                      >
                        {(val / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lương cứng & Thưởng & Phạt */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lương cứng (VNĐ)
                  </label>
                  <input
                    type="number"
                    step={50000}
                    value={editBaseSalary}
                    onChange={e => setEditBaseSalary(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    Thưởng thêm (+)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={editBonus}
                    onChange={e => setEditBonus(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">
                    Giảm trừ (-)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={editDeduction}
                    onChange={e => setEditDeduction(Number(e.target.value))}
                    className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-bold text-rose-800 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú điều chỉnh lương
                </label>
                <input
                  type="text"
                  placeholder="VD: Điều chỉnh đơn giá ca đặc biệt, thưởng năng suất..."
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Live Preview Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Lương ca ({editingPerson.approvedSlots || 0} ca x {formatVND(editSlotRate)}):</span>
                  <span className="font-bold text-slate-800">{formatVND((editingPerson.approvedSlots || 0) * (Number(editSlotRate) || 0))}</span>
                </div>
                {Number(editBaseSalary) > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Lương cứng / Phụ cấp:</span>
                    <span className="font-bold text-slate-800">+{formatVND(editBaseSalary)}</span>
                  </div>
                )}
                {Number(editBonus) > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-700">
                    <span>Thưởng thêm:</span>
                    <span className="font-bold">+{formatVND(editBonus)}</span>
                  </div>
                )}
                {(editingPerson.extraAmount || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs text-orange-600">
                    <span>Khoản phát sinh ({editingPerson.extras?.length || 0} khoản):</span>
                    <span className="font-bold">+{formatVND(editingPerson.extraAmount)}</span>
                  </div>
                )}
                {Number(editDeduction) > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-600">
                    <span>Giảm trừ:</span>
                    <span className="font-bold">-{formatVND(editDeduction)}</span>
                  </div>
                )}
                <div className="border-t border-emerald-200 pt-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 uppercase">TỔNG LƯƠNG TÍNH LẠI:</span>
                  <span className="text-base font-black text-emerald-700">{formatVND(modalCalculatedTotal)}</span>
                </div>
              </div>

              {/* Phạm vi áp dụng (Effective Date Scope) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Phạm vi hiệu lực của mức lương này:
                </label>
                
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="applyScope"
                    value="from_now_on"
                    checked={applyScope === 'from_now_on'}
                    onChange={() => setApplyScope('from_now_on')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900">Áp dụng từ Tháng {selectedMonth}/{selectedYear} trở đi (Tương lai)</span>
                    <p className="text-[11px] text-slate-500">Mức lương mới sẽ là mốc tính từ tháng này. Toàn bộ các tháng trong quá khứ được giữ nguyên 100% không bị thay đổi.</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1 border-t border-slate-200/60">
                  <input
                    type="radio"
                    name="applyScope"
                    value="month_only"
                    checked={applyScope === 'month_only'}
                    onChange={() => setApplyScope('month_only')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900">Chỉ áp dụng riêng cho Tháng {selectedMonth}/{selectedYear} này</span>
                    <p className="text-[11px] text-slate-500">Chỉ tính lại và lưu riêng cho kỳ lương tháng này. Không thay đổi mức lương của bất kỳ tháng nào khác.</p>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPerson(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingRate}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  {savingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Lưu & Tính Lại Lương Vào DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Extra (Phát sinh) Modal */}
      {extraModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-orange-500" />
                  {editingExtraId ? 'Sửa khoản phát sinh' : 'Thêm khoản lương phát sinh'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dùng cho công việc ngoài bảng chấm công / hợp đồng thời vụ (làm theo nhiệm vụ, sự kiện, CTV...) • Kỳ lương Tháng {selectedMonth}/{selectedYear}
                </p>
              </div>
              <button onClick={() => setExtraModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExtra} className="space-y-4">
              {/* Người nhận */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Người nhận lương</label>
                <div className="flex gap-2 mb-2">
                  {[
                    { v: 'user', label: 'Nhân sự trong hệ thống' },
                    { v: 'external', label: 'Người ngoài / CTV (chưa có tài khoản)' }
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setExtraForm({ ...extraForm, recipientMode: opt.v })}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        extraForm.recipientMode === opt.v
                          ? "bg-orange-500 text-white border-orange-500 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {extraForm.recipientMode === 'user' ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Tìm nhanh theo tên / email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <select
                      id="extra-user-select"
                      value={extraForm.userId}
                      onChange={e => setExtraForm({ ...extraForm, userId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500/20"
                      required
                    >
                      <option value="">-- Chọn nhân sự ({filteredUserOptions.length}) --</option>
                      {extraForm.userId && !filteredUserOptions.some((u: any) => u._id === extraForm.userId) && (
                        <option value={extraForm.userId}>
                          {userOptions.find((u: any) => u._id === extraForm.userId)?.fullName || 'Nhân sự đã chọn'}
                        </option>
                      )}
                      {filteredUserOptions.map((u: any) => (
                        <option key={u._id} value={u._id}>
                          {u.fullName} {u.email ? `• ${u.email}` : ''} ({u.roleName})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Họ tên người nhận *"
                      value={extraForm.personName}
                      onChange={e => setExtraForm({ ...extraForm, personName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500/20"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Số điện thoại (tuỳ chọn)"
                      value={extraForm.personPhone}
                      onChange={e => setExtraForm({ ...extraForm, personPhone: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                )}
              </div>

              {/* Loại & ngày */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại phát sinh</label>
                  <select
                    value={extraForm.type}
                    onChange={e => setExtraForm({ ...extraForm, type: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="task">Làm theo nhiệm vụ</option>
                    <option value="extra_shift">Ca làm bổ sung (chưa chấm công)</option>
                    <option value="overtime">Tăng ca</option>
                    <option value="event">Sự kiện / Công tác</option>
                    <option value="allowance">Phụ cấp phát sinh</option>
                    <option value="collaborator">Cộng tác viên</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày thực hiện</label>
                  <input
                    type="date"
                    value={extraForm.workDate}
                    onChange={e => setExtraForm({ ...extraForm, workDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Nội dung */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung công việc / Nhiệm vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Hỗ trợ tổ chức hội thảo tuyển sinh, trực sự kiện khai giảng..."
                  value={extraForm.title}
                  onChange={e => setExtraForm({ ...extraForm, title: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
                <textarea
                  rows={2}
                  placeholder="Mô tả thêm (tuỳ chọn)"
                  value={extraForm.description}
                  onChange={e => setExtraForm({ ...extraForm, description: e.target.value })}
                  className="w-full mt-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              {/* Số lượng x đơn giá */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={extraForm.quantity}
                    onChange={e => setExtraForm({ ...extraForm, quantity: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị</label>
                  <select
                    value={extraForm.unit}
                    onChange={e => setExtraForm({ ...extraForm, unit: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {['lần', 'nhiệm vụ', 'ca', 'giờ', 'buổi', 'ngày', 'sự kiện', 'khoản'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={extraForm.unitPrice}
                    onChange={e => setExtraForm({ ...extraForm, unitPrice: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-3.5 flex items-center justify-between">
                <span className="text-xs font-black text-orange-900 uppercase">Thành tiền cộng vào lương:</span>
                <span className="text-lg font-black text-orange-600">{formatVND(extraFormAmount)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExtraModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingExtra || extraFormAmount <= 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  {savingExtra ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingExtraId ? 'Cập nhật & Tính lại lương' : 'Thêm vào bảng lương'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
