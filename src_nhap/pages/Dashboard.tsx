import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  GraduationCap,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  RefreshCw,
  Phone,
  Filter,
  Award,
  Building2,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  Zap,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { PERMISSIONS } from '../constants/permissions';
import { Navigate } from 'react-router-dom';

const VIBRANT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#3b82f6'];

const TIME_RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7days', label: '7 ngày qua' },
  { id: 'this_month', label: 'Tháng này' },
  { id: '30days', label: '30 ngày qua' },
  { id: 'this_quarter', label: 'Quý này' },
  { id: 'this_year', label: 'Năm nay' },
  { id: 'all', label: 'Tất cả thời gian' }
];

export default function Dashboard() {
  const { user, can, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);

  if (hasRole && (hasRole('parent') || hasRole('phụ huynh'))) {
    return <Navigate to="/student-report" replace />;
  }

  const hasDashboardView = can(PERMISSIONS.DASHBOARD.VIEW);

  // PowerBI Dynamic Slicer Filters State
  const [timeRange, setTimeRange] = useState('this_month');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCampus, setSelectedCampus] = useState('all');

  const fetchDashboardStats = useCallback(async () => {
    if (!hasDashboardView) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/dashboard/stats?timeRange=${timeRange}&sourceId=${selectedSource}&campusId=${selectedCampus}`);
      if (res.data.success) {
        setStatsData(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching PowerBI stats:', error);
      toast.error("Không thể tải báo cáo PowerBI Dashboard");
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedSource, selectedCampus, hasDashboardView]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  if (!hasDashboardView) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4 max-w-2xl mx-auto my-12 shadow-sm font-sans">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto shadow-sm">
          <Zap className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Giới Hạn Quyền Xem Báo Cáo Dashboard</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
          Tài khoản của bạn không có quyền truy cập thông tin Báo cáo tài chính & Dashboard Quản trị của Trung tâm.
          Vui lòng sử dụng các menu chức năng khác trên thanh điều hướng hoặc liên hệ với Quản lý hệ thống để biết thêm chi tiết.
        </p>
      </div>
    );
  }

  const summary = statsData?.summary || {};
  const filterOptions = statsData?.filterOptions || {};
  const salesFunnel = statsData?.salesFunnel || [];
  const financialTrend = statsData?.financialTrend || [];
  const sourceDistribution = statsData?.sourceDistribution || [];
  const campusPerformance = statsData?.campusPerformance || [];
  const staffLeaderboard = statsData?.staffLeaderboard || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans">
      {/* POWERBI EXECUTIVE HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest">
            <Zap className="w-4 h-4 fill-emerald-400 animate-bounce" /> Executive Analytics & PowerBI Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Báo Cáo Quản Trị Hệ Thống</h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-xl font-medium">
            Phân tích đa chiều, lọc báo cáo tương tác và đo lường chỉ số tăng trưởng CRM & Tài chính thực tế.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <button
            onClick={fetchDashboardStats}
            className="p-3 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl transition-all flex items-center gap-2 text-xs font-bold border border-white/10 shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới dữ liệu
          </button>
          <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shadow-inner">
            <Calendar className="w-4 h-4" />
            <span>{TIME_RANGES.find(t => t.id === timeRange)?.label}</span>
          </div>
        </div>
      </header>

      {/* POWERBI SLICERS / FILTER BAR */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
            <Filter className="w-4 h-4" /> Bộ Lọc Truy Vấn Báo Cáo Đa Chiều (PowerBI Slicers)
          </div>
          <span className="text-[11px] font-bold text-slate-400">Tự động cập nhật đồ thị thời gian thực</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Time Range Slicer */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-slate-500 uppercase">1. Khoảng Thời Gian</label>
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {TIME_RANGES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Lead Source Slicer */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-slate-500 uppercase">2. Nguồn Lead / Kênh Tiếp Thị</label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">-- Tất cả nguồn tiếp thị --</option>
              {(filterOptions.sources || []).map((src: any) => (
                <option key={src._id} value={src._id}>{src.name}</option>
              ))}
            </select>
          </div>

          {/* Campus Slicer */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-slate-500 uppercase">3. Cơ Sở Chi Nhánh Trung Tâm</label>
            <select
              value={selectedCampus}
              onChange={e => setSelectedCampus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">-- Tất cả cơ sở trung tâm --</option>
              {(filterOptions.campuses || []).map((cp: any) => (
                <option key={cp._id} value={cp._id}>{cp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VIBRANT POWERBI KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Revenue */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <DollarSign className="w-7 h-7 text-emerald-200 stroke-[3]" />
            </div>
            <span className="text-[10px] font-black uppercase bg-emerald-400/20 px-2.5 py-1 rounded-full border border-emerald-300/30">
              Doanh Thu Kỳ Này
            </span>
          </div>
          <div>
            <h3 className="text-emerald-100 text-xs font-extrabold uppercase tracking-wider">Doanh Thu Thu Được</h3>
            <p className="text-3xl font-black mt-1 tracking-tight">
              {loading ? '...' : (summary.revenuePeriod || 0).toLocaleString('vi-VN')} <span className="text-base font-normal">đ</span>
            </p>
            <p className="text-xs font-bold text-emerald-100 mt-2 flex items-center gap-1">
              <span>Lợi nhuận ròng:</span>
              <span className="font-black text-white">{(summary.netProfitPeriod || 0).toLocaleString('vi-VN')} đ</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Leads & Conversion */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-800 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <Users className="w-7 h-7 text-indigo-200 stroke-[3]" />
            </div>
            <span className="text-[10px] font-black uppercase bg-indigo-400/20 px-2.5 py-1 rounded-full border border-indigo-300/30">
              CRM Pipeline
            </span>
          </div>
          <div>
            <h3 className="text-indigo-100 text-xs font-extrabold uppercase tracking-wider">Tổng Lead Kỳ Này</h3>
            <p className="text-3xl font-black mt-1 tracking-tight">
              {loading ? '...' : (summary.totalLeadsPeriod || 0).toLocaleString('vi-VN')} <span className="text-base font-normal">lead</span>
            </p>
            <p className="text-xs font-bold text-indigo-100 mt-2 flex items-center gap-1">
              <span>Tỷ lệ chốt thành công:</span>
              <span className="font-black text-emerald-300">{summary.conversionRate || 0}%</span>
            </p>
          </div>
        </div>

        {/* Metric 3: Students */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <GraduationCap className="w-7 h-7 text-amber-100 stroke-[3]" />
            </div>
            <span className="text-[10px] font-black uppercase bg-amber-400/20 px-2.5 py-1 rounded-full border border-amber-300/30">
              Đào Tạo
            </span>
          </div>
          <div>
            <h3 className="text-amber-100 text-xs font-extrabold uppercase tracking-wider">Học Viên Đang Học</h3>
            <p className="text-3xl font-black mt-1 tracking-tight">
              {loading ? '...' : (summary.activeStudents || 0).toLocaleString('vi-VN')} <span className="text-base font-normal">học viên</span>
            </p>
            <p className="text-xs font-bold text-amber-100 mt-2 flex items-center gap-1">
              <span>Học viên mới kỳ này:</span>
              <span className="font-black text-white">+{summary.totalStudentsPeriod || 0}</span>
            </p>
          </div>
        </div>

        {/* Metric 4: Net Profit / Expenses */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-700 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <BarChart3 className="w-7 h-7 text-rose-100 stroke-[3]" />
            </div>
            <span className="text-[10px] font-black uppercase bg-rose-400/20 px-2.5 py-1 rounded-full border border-rose-300/30">
              Chi Phí Vận Hành
            </span>
          </div>
          <div>
            <h3 className="text-rose-100 text-xs font-extrabold uppercase tracking-wider">Chi Phí Đã Chi</h3>
            <p className="text-3xl font-black mt-1 tracking-tight">
              {loading ? '...' : (summary.expensePeriod || 0).toLocaleString('vi-VN')} <span className="text-base font-normal">đ</span>
            </p>
            <p className="text-xs font-bold text-rose-100 mt-2 flex items-center gap-1">
              <span>Doanh thu All-time:</span>
              <span className="font-black text-white">{(summary.totalRevenueAllTime || 0).toLocaleString('vi-VN')} đ</span>
            </p>
          </div>
        </div>
      </div>

      {/* POWERBI VISUAL 1 & 2: FINANCIAL TREND & SALES FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Composed Chart: Income, Expense & Net Profit */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> Biểu Đồ Thu - Chi & Lợi Nhuận Ròng qua các Tháng
              </h2>
              <p className="text-xs text-slate-400 font-medium">Đơn vị: Triệu VNĐ (Dữ liệu giao dịch thực tế)</p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={financialTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toFixed(2)} Triệu VNĐ`]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                <Bar dataKey="thu" name="Khoản Thu" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="chi" name="Khoản Chi" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="loiNhuan" name="Lợi Nhuận Ròng" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CRM SALES FUNNEL */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" /> Phễu Chuyển Đổi CRM (Sales Funnel)
            </h2>
            <p className="text-xs text-slate-400 font-medium">Tỷ lệ luồng xử lý từ Lead mới $\rightarrow$ Chốt thành công</p>
          </div>

          <div className="space-y-3">
            {salesFunnel.map((item: any, idx: number) => {
              const maxCount = salesFunnel[0]?.count || 1;
              const percentOfTop = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-800">{item.stage}</span>
                    <span className="text-indigo-600">{item.count} lead ({percentOfTop}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${Math.max(percentOfTop, 5)}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 text-center">
            <span className="text-xs font-bold text-slate-500">
              Tỷ lệ chuyển đổi tổng thể: <span className="font-black text-emerald-600">{summary.conversionRate || 0}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* POWERBI VISUAL 3, 4 & 5: LEAD SOURCES, LEADERBOARD & CAMPUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Donut Chart: Lead Sources */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-600" /> Phân Bổ Theo Nguồn Lead
            </h2>
            <p className="text-xs text-slate-400 font-medium">Tỷ trọng thu hút khách hàng từ các kênh</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sourceDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-50">
            {sourceDistribution.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: VIBRANT_COLORS[idx % VIBRANT_COLORS.length] }}></span>
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="font-black text-slate-900">{item.value} lead</span>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Leaderboard */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Bảng Xếp Hạng Nhân Viên Sales Xuất Sắc
            </h2>
            <p className="text-xs text-slate-400 font-medium">Top nhân sự chốt học viên cao nhất</p>
          </div>

          <div className="space-y-3">
            {staffLeaderboard.map((staff: any, idx: number) => (
              <div key={staff.id || idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl font-black flex items-center justify-center text-xs shadow-sm ${
                    idx === 0 ? 'bg-amber-400 text-amber-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : 'bg-orange-300 text-amber-950'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{staff.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">Đã giao: {staff.assigned} lead</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-emerald-600">{staff.converted} chốt</span>
                  <p className="text-[10px] font-bold text-slate-500">Tỷ lệ: {staff.rate}%</p>
                </div>
              </div>
            ))}
            {staffLeaderboard.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">Chưa có dữ liệu xếp hạng nhân sự.</p>
            )}
          </div>
        </div>

        {/* Campus Comparison */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-600" /> Quy Mô & Học Viên Theo Cơ Sở
            </h2>
            <p className="text-xs text-slate-400 font-medium">So sánh số lớp và học viên giữa các chi nhánh</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campusPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="hocVien" name="Học viên" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="lopHoc" name="Lớp học" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-50">
            {campusPerformance.map((cp: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-700">{cp.name}</span>
                <span className="text-slate-900"><span className="font-black text-cyan-600">{cp.hocVien}</span> HV / <span className="font-black text-purple-600">{cp.lopHoc}</span> Lớp</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
