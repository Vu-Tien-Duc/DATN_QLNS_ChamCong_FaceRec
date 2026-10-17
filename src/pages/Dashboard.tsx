import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckCircle2, XCircle, TrendingUp, Calendar,
  Loader2, ArrowUpRight, ScanFace, FileText, BarChart3, AlertCircle,
  RefreshCw, Zap, CalendarDays, UserCheck, Sparkles, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingLeaves: number;
  attendanceRate: number;
}

interface RecentAttendance {
  _id: string;
  userId?: { fullName: string; email: string; avatar?: string };
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  method?: string;
  createdAt: string;
  date?: string;
}

interface WeeklyTrend {
  day: string;
  present: number;
  late: number;
  absent: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  truongkhoa: 'Trưởng khoa / Bộ môn',
  giangvien: 'Giảng viên',
  nhanvien: 'Cán bộ / Nhân viên',
};

function StatCard({
  label, value, icon: Icon, color, trend, loading, sub,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; trend?: string; loading?: boolean; sub?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue:   { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100' },
    green:  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    red:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-100' },
    yellow: { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
    purple: { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-100' },
    indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-100' },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="card p-5 flex flex-col justify-between hover:shadow-md transition-all border border-slate-200/80">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-2xl ${c.bg} ring-4 ${c.ring} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={c.text} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ArrowUpRight size={12} />{trend}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 mt-3">
          <div className="skeleton h-8 w-16" />
          <div className="skeleton h-4 w-24" />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{value}</p>
          <div className="mt-1">
            <p className="text-xs font-bold text-slate-600">{label}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status?: string) {
  const map: Record<string, { label: string; class: string }> = {
    ON_TIME:         { label: 'Đúng giờ',     class: 'badge-green' },
    PRESENT:         { label: 'Có mặt',       class: 'badge-green' },
    LATE:            { label: 'Đi muộn',      class: 'badge-yellow' },
    EARLY_LEAVE:     { label: 'Về sớm',       class: 'badge-yellow' },
    ABSENT:          { label: 'Vắng mặt',     class: 'badge-red' },
    EXCUSED_ABSENCE: { label: 'Nghỉ có phép', class: 'badge-blue' },
  };
  const item = map[status ?? ''] || { label: status || '—', class: 'badge-gray' };
  return <span className={`badge ${item.class}`}>{item.label}</span>;
}

function getMethodLabel(method?: string) {
  const map: Record<string, string> = {
    face: '🤖 Face ID',
    qr: '📷 QR Code',
    manual: '✍️ Thủ công',
    gps: '📍 GPS Campus',
    fingerprint: '👆 Vân tay',
  };
  return map[method ?? ''] ?? method ?? '—';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3 text-xs">
        <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any) => (
            <p key={p.dataKey} style={{ color: p.color }} className="font-semibold flex items-center justify-between gap-3">
              <span>{p.name}:</span>
              <span className="font-mono">{p.value}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const [historyRes, usersRes, leaveRes] = await Promise.all([
        apiClient.get('/attendance/history', { params: { limit: 100, page: 1 } }).catch(() => ({ data: [] })),
        isAdmin ? apiClient.get('/users').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        apiClient.get('/leave-requests', { params: { status: 'PENDING', limit: 50 } }).catch(() => ({ data: [] })),
      ]);

      const logs = extractArray<RecentAttendance>(historyRes.data?.data ?? historyRes.data);
      const todayLogs = logs.filter((l) => {
        if (!l.createdAt && !l.date) return false;
        const logDate = l.date || (l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : '');
        return logDate === dateStr;
      });

      const usersList = extractArray(usersRes.data?.data ?? usersRes.data);
      const totalUsers =
        typeof usersRes.data?.total === 'number'
          ? usersRes.data.total
          : typeof usersRes.data?.data?.total === 'number'
          ? usersRes.data.data.total
          : usersList.length;

      const pendingLeavesList = extractArray(leaveRes.data?.data ?? leaveRes.data);

      const presentToday = todayLogs.filter((l) => l.status === 'ON_TIME' || l.status === 'PRESENT').length;
      const lateToday = todayLogs.filter((l) => l.status === 'LATE').length;
      const absentToday = todayLogs.filter((l) => l.status === 'ABSENT').length;

      setStats({
        totalUsers: totalUsers || 1,
        presentToday,
        absentToday,
        lateToday,
        pendingLeaves: pendingLeavesList.length,
        attendanceRate: totalUsers > 0 ? Math.round(((presentToday + lateToday) / totalUsers) * 100) : 0,
      });
    } catch {
      setStats({ totalUsers: 0, presentToday: 0, absentToday: 0, lateToday: 0, pendingLeaves: 0, attendanceRate: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, [isAdmin]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await apiClient.get('/attendance/history', { params: { limit: 8, page: 1 } });
      const logs = extractArray<RecentAttendance>(res.data?.data ?? res.data);
      setRecentAttendance(logs);
    } catch {
      setRecentAttendance([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const fetchWeeklyTrend = useCallback(async () => {
    try {
      const res = await apiClient.get('/attendance/history', { params: { limit: 200, page: 1 } });
      const logs = extractArray<RecentAttendance>(res.data?.data ?? res.data);

      const days: WeeklyTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = logs.filter((l) => (l.date ?? l.createdAt ?? '').startsWith(dateStr));
        const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
        days.push({
          day: dayName,
          present: dayLogs.filter((l) => l.status === 'ON_TIME' || l.status === 'PRESENT').length,
          late: dayLogs.filter((l) => l.status === 'LATE').length,
          absent: dayLogs.filter((l) => l.status === 'ABSENT').length,
        });
      }
      setWeeklyTrend(days);
    } catch {
      setWeeklyTrend([]);
    } finally {
      setLoadingWeekly(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecent();
    fetchWeeklyTrend();
  }, [fetchStats, fetchRecent, fetchWeeklyTrend]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadingStats(true);
    setLoadingRecent(true);
    setLoadingWeekly(true);
    await Promise.all([fetchStats(), fetchRecent(), fetchWeeklyTrend()]);
    setRefreshing(false);
    toast.success('Đã cập nhật số liệu mới nhất');
  };

  const pieData = stats
    ? [
        { name: 'Đúng giờ', value: stats.presentToday, color: '#10b981' },
        { name: 'Đi trễ',   value: stats.lateToday,    color: '#f59e0b' },
        { name: 'Vắng mặt', value: stats.absentToday,  color: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  const deptName =
    typeof user?.department === 'object'
      ? (user?.department as { name: string })?.name
      : user?.department;
  const roleKey = typeof user?.role === 'object' ? user?.role?.name : user?.role;
  const roleLabel = ROLE_LABELS[roleKey ?? ''] || 'Cán bộ';

  const todayVN = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 border border-blue-500/20">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 80% 20%, white 1.5px, transparent 1.5px)`,
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold backdrop-blur-md">
              <Sparkles size={13} className="text-amber-300" />
              <span>Hệ Thống Quản Lý Nhân Sự & Chấm Công Trường Đại Học</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Xin chào, {user?.fullName || 'Cán bộ'} 👋
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm font-medium">
              Vai trò: <strong className="text-white">{roleLabel}</strong>
              {deptName ? ` • Đơn vị: ${deptName}` : ''} • {todayVN}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer backdrop-blur-md"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <button
              onClick={() => navigate('/attendance/me')}
              className="flex items-center gap-2 bg-white text-blue-800 hover:bg-blue-50 font-black text-xs px-4 py-2.5 rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              <UserCheck size={16} />
              Chấm Công Ngay
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/attendance/me')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-3 text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <UserCheck size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">Điểm danh</p>
            <p className="text-[10px] text-slate-400 truncate">Chấm công hôm nay</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/schedules')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-400 hover:shadow-md transition-all flex items-center gap-3 text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all">
            <CalendarDays size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">Thời khóa biểu</p>
            <p className="text-[10px] text-slate-400 truncate">Lịch dạy & ca công tác</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/leave-requests')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-400 hover:shadow-md transition-all flex items-center gap-3 text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-all">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">Nghỉ phép</p>
            <p className="text-[10px] text-slate-400 truncate">Tạo & theo dõi đơn</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/reports/attendance')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all flex items-center gap-3 text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <BarChart3 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">Báo cáo</p>
            <p className="text-[10px] text-slate-400 truncate">Thống kê công tháng</p>
          </div>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Tổng cán bộ" value={stats?.totalUsers ?? 0} icon={Users} color="blue" loading={loadingStats} />
        <StatCard label="Có mặt hôm nay" value={stats?.presentToday ?? 0} icon={CheckCircle2} color="green" loading={loadingStats} />
        <StatCard label="Đi trễ" value={stats?.lateToday ?? 0} icon={Clock} color="yellow" loading={loadingStats} />
        <StatCard label="Vắng mặt" value={stats?.absentToday ?? 0} icon={XCircle} color="red" loading={loadingStats} />
        <StatCard label="Đơn chờ duyệt" value={stats?.pendingLeaves ?? 0} icon={FileText} color="purple" loading={loadingStats} />
        <StatCard
          label="Tỷ lệ chuyên cần"
          value={`${stats?.attendanceRate ?? 0}%`}
          icon={BarChart3}
          color="indigo"
          loading={loadingStats}
          sub="Hôm nay"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Bar Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              Xu hướng chuyên cần 7 ngày gần nhất
            </h2>
            <span className="text-[11px] text-slate-400">Theo ca dạy & công tác</span>
          </div>
          {loadingWeekly ? (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-500" size={28} />
            </div>
          ) : weeklyTrend.every((d) => d.present + d.late + d.absent === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center text-slate-400">
              <BarChart3 size={36} className="mb-2 text-slate-300" />
              <p className="text-xs">Chưa có dữ liệu chấm công 7 ngày qua</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="present" name="Đúng giờ" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="late"    name="Đi trễ"   fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="absent"  name="Vắng mặt" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart - Hôm nay */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-4">
              <Zap size={18} className="text-violet-600" />
              Tỷ lệ trạng thái hôm nay
            </h2>
            {loadingStats ? (
              <div className="h-52 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            ) : pieData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle size={36} className="mb-2 text-slate-300" />
                <p className="text-xs">Chưa có lượt chấm công hôm nay</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number, name: string) => [`${val} lượt`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!loadingStats && stats && (
            <div className="pt-3 border-t border-slate-100 text-center">
              <span className="text-2xl font-black text-slate-800">{stats.attendanceRate}%</span>
              <p className="text-[11px] text-slate-400 font-medium">Tỷ lệ chuyên cần ngày</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance Records */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              Lịch sử điểm danh gần nhất
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Nhật ký chấm công thời gian thực trong ngày</p>
          </div>
          <button
            onClick={() => navigate('/attendance/history')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            Xem tất cả <ChevronRight size={14} />
          </button>
        </div>

        {loadingRecent ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : recentAttendance.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">Chưa có lượt chấm công nào trong phiên này</p>
            <p className="text-xs text-slate-400 mt-1">Các lượt quét Face ID hoặc mã QR sẽ tự động hiển thị tại đây</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cán bộ / Giảng viên</th>
                  <th>Giờ Check-in</th>
                  <th>Giờ Check-out</th>
                  <th>Trạng thái</th>
                  <th>Phương thức</th>
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map((log) => {
                  const name = log.userId?.fullName ?? 'Không xác định';
                  const email = log.userId?.email ?? '';
                  const avatar = log.userId?.avatar;
                  const avatarUrl = avatar
                    ? avatar.startsWith('http') || avatar.startsWith('/')
                      ? avatar
                      : `/uploads/${avatar}`
                    : null;

                  return (
                    <tr key={log._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{name[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{name}</p>
                            <p className="text-[11px] text-slate-400">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-slate-700 font-mono font-medium">
                        {log.checkInTime
                          ? new Date(log.checkInTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="text-xs text-slate-700 font-mono font-medium">
                        {log.checkOutTime
                          ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td>{getStatusBadge(log.status)}</td>
                      <td className="text-xs text-slate-600 font-medium">
                        {getMethodLabel(log.method)}
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
  );
}
