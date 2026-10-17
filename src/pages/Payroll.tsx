import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Download, Lock, Unlock, Calculator, FileSpreadsheet,
  FileText, ShieldCheck, AlertCircle, RefreshCw, Eye, CheckCircle2,
  Calendar, Building2, User, ChevronRight, X, TrendingUp, Layers
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { Payroll as PayrollType } from '../types';
import toast from 'react-hot-toast';

export default function Payroll() {
  const { user, hasRole } = useAuth();
  const isAdminOrManager = hasRole('admin') || hasRole('truongkhoa') || hasRole('bgh') || hasRole('ketoan');

  const [activeTab, setActiveTab] = useState<'me' | 'manage'>('me');
  const [loading, setLoading] = useState(false);
  const [myPayroll, setMyPayroll] = useState<PayrollType | null>(null);
  const [payrollList, setPayrollList] = useState<PayrollType[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollType | null>(null);

  // Filters for Management Tab
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterDept, setFilterDept] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);

  // Action Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch My Current Payroll
  const fetchMyPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/payrolls/me/current');
      if (res.data?.success && res.data?.data) {
        setMyPayroll(res.data.data);
      } else {
        setMyPayroll(null);
      }
    } catch {
      // Có thể chưa có phiếu lương tháng này
      setMyPayroll(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Payroll List (Management)
  const fetchPayrollList = useCallback(async () => {
    if (!isAdminOrManager) return;
    setLoading(true);
    try {
      const params: any = { month: filterMonth, year: filterYear };
      if (filterDept) params.departmentId = filterDept;
      const res = await apiClient.get('/payrolls', { params });
      if (res.data?.success) {
        setPayrollList(res.data.data || []);
      }
    } catch {
      toast.error('Không thể tải danh sách bảng lương');
    } finally {
      setLoading(false);
    }
  }, [isAdminOrManager, filterMonth, filterYear, filterDept]);

  // Fetch Departments for Filter
  useEffect(() => {
    if (isAdminOrManager) {
      apiClient.get('/departments')
        .then((res) => {
          if (res.data?.success) setDepartments(res.data.data || []);
        })
        .catch(() => {});
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (activeTab === 'me') {
      fetchMyPayroll();
    } else {
      fetchPayrollList();
    }
  }, [activeTab, fetchMyPayroll, fetchPayrollList]);

  // Handler: Generate Payroll
  const handleGeneratePayroll = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.post('/payrolls/generate', {
        month: filterMonth,
        year: filterYear,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Khởi tạo bảng lương thành công');
        setIsGenerateOpen(false);
        fetchPayrollList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tính toán bảng lương');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Lock Payroll
  const handleLockPayroll = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn KHÓA SỔ LƯƠNG tháng ${filterMonth}/${filterYear}? Toàn bộ dữ liệu chấm công tháng này sẽ được chốt bất biến.`)) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post('/payrolls/lock', {
        month: filterMonth,
        year: filterYear,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Đã khóa sổ lương thành công');
        fetchPayrollList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi khóa bảng lương');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Unlock Payroll
  const handleUnlockPayroll = async () => {
    if (!unlockReason.trim()) {
      toast.error('Vui lòng nhập lý do mở khóa để ghi nhận nhật ký kiểm toán');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post('/payrolls/unlock', {
        month: filterMonth,
        year: filterYear,
        reason: unlockReason.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Đã mở khóa sổ lương thành công');
        setIsUnlockOpen(false);
        setUnlockReason('');
        fetchPayrollList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi mở khóa bảng lương');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const res = await apiClient.get('/payrolls/export/excel', {
        params: { month: filterMonth, year: filterYear, departmentId: filterDept || undefined },
      });
      if (res.data?.success) {
        toast.success('Báo cáo Excel đã được chuẩn bị thành công');
        // If file content or download URL is provided:
        if (res.data.data?.downloadUrl) {
          window.open(res.data.data.downloadUrl, '_blank');
        } else {
          toast.success(`Dữ liệu bảng lương ${res.data.data?.totalRecords || 0} cán bộ đã sẵn sàng.`);
        }
      }
    } catch {
      toast.error('Không thể xuất báo cáo Excel');
    }
  };

  // Format Currency VND
  const formatVND = (val?: number) => {
    if (val === undefined || val === null) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Check if current month is locked
  const isMonthLocked = payrollList.some((p) => p.isLocked || p.status === 'DA_KHOA');

  // Compute Total Metrics
  const totalGross = payrollList.reduce((sum, p) => sum + (p.tong_thu_nhap_gross || p.grossIncome || 0), 0);
  const totalNet = payrollList.reduce((sum, p) => sum + (p.thuc_linh_net || p.netSalary || 0), 0);
  const totalTax = payrollList.reduce((sum, p) => sum + (p.thue_tncn?.tien_thue || 0), 0);
  const totalInsurance = payrollList.reduce((sum, p) => sum + (p.bao_hiem?.tong_bao_hiem || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Bảng Lương & Thu Nhập Năm 2026
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Hệ thống tính lương giảng dạy chuẩn hóa Snapshot 2026, thuế TNCN lũy tiến 5 bậc và quản lý khóa sổ lương.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
          <button
            onClick={() => setActiveTab('me')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'me'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Phiếu Lương Của Tôi
          </button>
          {isAdminOrManager && (
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'manage'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quản Lý Bảng Lương
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: PHIẾU LƯƠNG CỦA TÔI */}
      {activeTab === 'me' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-slate-500 text-sm font-medium">Đang tải phiếu lương của bạn...</p>
            </div>
          ) : !myPayroll ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Chưa có phiếu lương tháng này</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mt-2">
                Bảng lương tháng hiện tại đang được phòng Tổ chức Cán bộ & Kế toán lập dự thảo hoặc chưa chốt công. Vui lòng quay lại sau.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Slip Header Banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 sm:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {myPayroll.isLocked || myPayroll.status === 'DA_KHOA' ? 'Đã Khóa Sổ & Quyết Toán' : 'Bản Dự Thảo'}
                    </span>
                    <h2 className="text-2xl font-black">
                      PHIẾU LƯƠNG THÁNG {myPayroll.thang || myPayroll.month}/{myPayroll.nam || myPayroll.year}
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">
                      Cán bộ: <span className="font-semibold text-white">{user?.fullName}</span> | Mã định danh: <span className="font-semibold text-white">{(user?.staffCode || user?._id?.slice(-6) || '').toUpperCase()}</span>
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-right">
                    <p className="text-xs uppercase tracking-wider text-emerald-100 font-medium">Thực Lĩnh Net</p>
                    <p className="text-3xl font-extrabold text-white mt-1">
                      {formatVND(myPayroll.thuc_linh_net || myPayroll.netSalary)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Slip Content Sections */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* 3 Main Summary Columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">1. Lương Chính & Phụ Cấp</p>
                    <p className="text-xl font-bold text-slate-800 mt-2">
                      {formatVND((myPayroll.luong_chinh || myPayroll.primarySalary || 0) + (myPayroll.phu_cap_chuc_vu || 0) + (myPayroll.phu_cap_tham_nien || 0) + (myPayroll.phu_cap_uu_dai_nghe || 0))}
                    </p>
                    <div className="text-xs text-slate-500 space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>Hệ số lương:</span>
                        <span className="font-medium text-slate-700">{myPayroll.he_so_luong || myPayroll.salaryCoefficient}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lương cơ sở:</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.luong_co_so || myPayroll.baseSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phụ cấp chức vụ:</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.phu_cap_chuc_vu)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ưu đãi nghề:</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.phu_cap_uu_dai_nghe)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">2. Thù Lao Giờ Giảng Dạy</p>
                    <p className="text-xl font-bold text-emerald-700 mt-2">
                      {formatVND(myPayroll.gio_giang?.thu_lao_vuot_gio || 0)}
                    </p>
                    <div className="text-xs text-slate-500 space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>Định mức giờ:</span>
                        <span className="font-medium text-slate-700">{myPayroll.gio_giang?.dinh_muc_sau_giam || 135} tiết</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Giờ giảng quy đổi:</span>
                        <span className="font-medium text-slate-700">{myPayroll.gio_giang?.gio_quy_doi_tich_luy || 0} tiết</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Giờ vượt định mức:</span>
                        <span className="font-semibold text-emerald-600">+{myPayroll.gio_giang?.gio_vuot_dinh_muc || 0} tiết</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Đơn giá giờ chuẩn:</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.gio_giang?.don_gia_gio_chuan || 120000)}/tiết</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">3. Các Khoản Giảm Trừ</p>
                    <p className="text-xl font-bold text-rose-600 mt-2">
                      -{formatVND((myPayroll.bao_hiem?.tong_bao_hiem || 0) + (myPayroll.thue_tncn?.tien_thue || 0))}
                    </p>
                    <div className="text-xs text-slate-500 space-y-1 mt-3">
                      <div className="flex justify-between">
                        <span>BHXH (8%):</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.bao_hiem?.bhxh)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>BHYT (1.5%):</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.bao_hiem?.bhyt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>BHTN (1%):</span>
                        <span className="font-medium text-slate-700">{formatVND(myPayroll.bao_hiem?.bhtn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Thuế TNCN (5 bậc):</span>
                        <span className="font-semibold text-rose-600">{formatVND(myPayroll.thue_tncn?.tien_thue)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax & Snapshot note */}
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Chính sách Snapshot Tham Số Lương 2026:</span> Mức lương cơ sở áp dụng 2.530.000 VNĐ, mức giảm trừ gia cảnh bản thân 11.000.000 VNĐ/tháng, người phụ thuộc 4.400.000 VNĐ/tháng, biểu thuế TNCN 5 bậc lũy tiến theo Luật Thuế Thu nhập cá nhân mới nhất.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QUẢN LÝ BẢNG LƯƠNG (ADMIN & MANAGER) */}
      {activeTab === 'manage' && isAdminOrManager && (
        <div className="space-y-6">
          {/* Top Actions & Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Tháng:</span>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Năm:</span>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>

              {departments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Tất cả Đơn vị / Khoa</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name || d.ten_don_vi}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsGenerateOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Calculator className="w-4 h-4" />
                Tính Lương Tháng
              </button>

              {isMonthLocked ? (
                <button
                  onClick={() => setIsUnlockOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all shadow-sm"
                >
                  <Unlock className="w-4 h-4" />
                  Mở Khóa Lương
                </button>
              ) : (
                <button
                  onClick={handleLockPayroll}
                  disabled={actionLoading || payrollList.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  Khóa Sổ Lương
                </button>
              )}

              <button
                onClick={handleExportExcel}
                disabled={payrollList.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Xuất Excel
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Quỹ Lương Net</p>
              <p className="text-2xl font-black text-emerald-700 mt-2">{formatVND(totalNet)}</p>
              <p className="text-xs text-slate-400 mt-1">Chi trả thực lĩnh cán bộ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Thu Nhập Gross</p>
              <p className="text-2xl font-black text-slate-800 mt-2">{formatVND(totalGross)}</p>
              <p className="text-xs text-slate-400 mt-1">Bao gồm lương & phụ cấp</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thuế TNCN Khấu Trừ</p>
              <p className="text-2xl font-black text-rose-600 mt-2">{formatVND(totalTax)}</p>
              <p className="text-xs text-slate-400 mt-1">Biểu thuế lũy tiến 5 bậc</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bảo Hiểm Bắt Buộc</p>
              <p className="text-2xl font-black text-blue-600 mt-2">{formatVND(totalInsurance)}</p>
              <p className="text-xs text-slate-400 mt-1">BHXH + BHYT + BHTN (10.5%)</p>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-slate-600" />
                <h3 className="font-bold text-slate-800">
                  Bảng Lương Tháng {filterMonth}/{filterYear} ({payrollList.length} hồ sơ)
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isMonthLocked
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isMonthLocked ? '🔒 Đã Khóa Sổ Lương' : '🟢 Sổ Lương Mở (Dự Thảo)'}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-sm">Đang tải dữ liệu bảng lương...</p>
              </div>
            ) : payrollList.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">Chưa có bảng lương tháng {filterMonth}/{filterYear}</p>
                <p className="text-xs text-slate-400 mt-1">Nhấn "Tính Lương Tháng" để khởi tạo bảng lương tự động.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">STT</th>
                      <th className="px-4 py-3">Nhân Sự</th>
                      <th className="px-4 py-3 text-right">Hệ Số</th>
                      <th className="px-4 py-3 text-right">Lương Chính</th>
                      <th className="px-4 py-3 text-right">Phụ Cấp</th>
                      <th className="px-4 py-3 text-right">Giờ Vượt</th>
                      <th className="px-4 py-3 text-right">Tổng Gross</th>
                      <th className="px-4 py-3 text-right">Bảo Hiểm</th>
                      <th className="px-4 py-3 text-right">Thuế TNCN</th>
                      <th className="px-4 py-3 text-right font-bold text-emerald-700">Thực Lĩnh Net</th>
                      <th className="px-4 py-3 text-center">Trạng Thái</th>
                      <th className="px-4 py-3 text-center">Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payrollList.map((item, idx) => {
                      const userObj = item.userId || item.nguoi_dung_id || {};
                      const uName = userObj.fullName || userObj.ho_ten || 'Cán bộ';
                      const uEmail = userObj.email || '';
                      const uDept = userObj.department?.name || userObj.departmentId?.name || 'Chưa phân bổ';

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800">{uName}</p>
                            <p className="text-xs text-slate-400">{uDept} • {uEmail}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {item.he_so_luong || item.salaryCoefficient}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatVND(item.luong_chinh || item.primarySalary)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatVND((item.phu_cap_chuc_vu || 0) + (item.phu_cap_tham_nien || 0) + (item.phu_cap_uu_dai_nghe || 0))}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                            +{item.gio_giang?.gio_vuot_dinh_muc || 0}h
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatVND(item.tong_thu_nhap_gross || item.grossIncome)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            {formatVND(item.bao_hiem?.tong_bao_hiem)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            {formatVND(item.thue_tncn?.tien_thue)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-700">
                            {formatVND(item.thuc_linh_net || item.netSalary)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                              item.isLocked || item.status === 'DA_KHOA'
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {item.isLocked || item.status === 'DA_KHOA' ? 'Đã Khóa' : 'Dự Thảo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedPayroll(item)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors"
                              title="Xem chi tiết phiếu lương"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TÍNH LƯƠNG THÁNG TỰ ĐỘNG */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                Khởi Tạo & Tính Toán Bảng Lương
              </h3>
              <button onClick={() => setIsGenerateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <p className="text-slate-600">
                Hệ thống sẽ tổng hợp tự động số ngày công thực tế, số tiết giảng dạy đối soát từ Thời khóa biểu, tính toán thù lao vượt định mức và khấu trừ thuế TNCN lũy tiến 5 bậc cho:
              </p>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center font-bold text-emerald-800 text-base">
                Tháng {filterMonth} Năm {filterYear}
              </div>
              <p className="text-xs text-slate-500 italic">
                * Lưu ý: Nếu tháng đã có bảng lương dự thảo, thao tác này sẽ cập nhật lại các chỉ số chấm công mới nhất.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleGeneratePayroll}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Xác Nhận Tính Lương
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MỞ KHÓA SỔ LƯƠNG (CÓ LÝ DO AUDIT) */}
      {isUnlockOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-600" />
                Mở Khóa Sổ Lương Tháng {filterMonth}/{filterYear}
              </h3>
              <button onClick={() => setIsUnlockOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <p className="text-slate-600">
                Việc mở khóa sổ lương cho phép chỉnh sửa bổ sung công hoặc hồi tố lương. Hành động này sẽ được ghi nhận nghiêm ngặt vào <span className="font-bold text-slate-800">Nhật ký kiểm toán (Audit Log)</span>.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lý do mở khóa <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết mở khóa sổ lương (vd: Bổ sung thanh toán giờ dạy học kỳ hè theo quyết định BGH)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsUnlockOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleUnlockPayroll}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 shadow-sm flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Xác Nhận Mở Khóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: XEM CHI TIẾT PHIẾU LƯƠNG NHÂN VIÊN */}
      {selectedPayroll && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Chi Tiết Phiếu Lương</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tháng {selectedPayroll.thang || selectedPayroll.month}/{selectedPayroll.nam || selectedPayroll.year} • {selectedPayroll.userId?.fullName || 'Cán bộ'}
                </p>
              </div>
              <button onClick={() => setSelectedPayroll(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Header Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-emerald-800 uppercase">Thực Lĩnh Net</p>
                  <p className="text-3xl font-black text-emerald-700 mt-1">
                    {formatVND(selectedPayroll.thuc_linh_net || selectedPayroll.netSalary)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-1">
                  <p>Tổng Gross: <span className="font-bold text-slate-800">{formatVND(selectedPayroll.tong_thu_nhap_gross || selectedPayroll.grossIncome)}</span></p>
                  <p>Trạng thái: <span className="font-bold text-emerald-700">{selectedPayroll.isLocked ? 'Đã Khóa' : 'Dự Thảo'}</span></p>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-700 uppercase border-b pb-1">I. Lương Cơ Bản & Phụ Cấp</p>
                  <div className="flex justify-between">
                    <span>Hệ số lương:</span>
                    <span className="font-semibold text-slate-800">{selectedPayroll.he_so_luong || selectedPayroll.salaryCoefficient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lương cơ sở:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.luong_co_so || selectedPayroll.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lương chính:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.luong_chinh || selectedPayroll.primarySalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phụ cấp chức vụ:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.phu_cap_chuc_vu)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phụ cấp ưu đãi nghề:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.phu_cap_uu_dai_nghe)}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-700 uppercase border-b pb-1">II. Giờ Giảng Dạy & Vượt Giờ</p>
                  <div className="flex justify-between">
                    <span>Định mức giờ quy định:</span>
                    <span className="font-semibold text-slate-800">{selectedPayroll.gio_giang?.dinh_muc_sau_giam || 135} tiết</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số giờ giảng quy đổi:</span>
                    <span className="font-semibold text-slate-800">{selectedPayroll.gio_giang?.gio_quy_doi_tich_luy || 0} tiết</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số giờ vượt định mức:</span>
                    <span className="font-bold text-emerald-600">+{selectedPayroll.gio_giang?.gio_vuot_dinh_muc || 0} tiết</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Đơn giá giờ chuẩn:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.gio_giang?.don_gia_gio_chuan || 120000)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-emerald-700">
                    <span>Thù lao vượt giờ:</span>
                    <span>{formatVND(selectedPayroll.gio_giang?.thu_lao_vuot_gio)}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-700 uppercase border-b pb-1">III. Bảo Hiểm Bắt Buộc (10.5%)</p>
                  <div className="flex justify-between">
                    <span>BHXH (8%):</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.bao_hiem?.bhxh)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BHYT (1.5%):</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.bao_hiem?.bhyt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BHTN (1%):</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.bao_hiem?.bhtn)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-blue-700">
                    <span>Tổng bảo hiểm:</span>
                    <span>{formatVND(selectedPayroll.bao_hiem?.tong_bao_hiem)}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-700 uppercase border-b pb-1">IV. Thuế Thu Nhập Cá Nhân</p>
                  <div className="flex justify-between">
                    <span>Giảm trừ bản thân:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.thue_tncn?.giam_tru_ban_than || 11000000)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thu nhập tính thuế:</span>
                    <span className="font-semibold text-slate-800">{formatVND(selectedPayroll.thue_tncn?.thu_nhap_tinh_thue)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold text-rose-600">
                    <span>Tiền thuế TNCN (5 bậc):</span>
                    <span>{formatVND(selectedPayroll.thue_tncn?.tien_thue)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedPayroll(null)}
                className="px-5 py-2 text-sm bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
