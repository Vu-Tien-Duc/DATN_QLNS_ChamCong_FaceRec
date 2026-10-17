import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, Loader2, AlertCircle, Calendar,
  CheckCircle2, XCircle, Clock, TrendingUp, FileText, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface ReportRow {
  userId: string;
  fullName: string;
  email: string;
  department?: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  excusedDays: number;
  attendanceRate: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
        <p className="font-bold text-slate-700 mb-2 truncate max-w-[160px]">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/reports/attendance', {
        params: { month: filterMonth, year: filterYear },
      });
      const data = extractArray<ReportRow>(res.data?.data ?? res.data);
      setRows(data);
    } catch {
      // Thử fallback từ history
      try {
        const res = await apiClient.get('/attendance/history', {
          params: { month: filterMonth, year: filterYear, limit: 500 },
        });
        const logs = extractArray<any>(res.data?.data ?? res.data);
        const map: Record<string, ReportRow> = {};
        logs.forEach((l: any) => {
          const uid = l.userId?._id ?? 'unknown';
          if (!map[uid]) {
            map[uid] = {
              userId: uid,
              fullName: l.userId?.fullName ?? 'Không xác định',
              email: l.userId?.email ?? '',
              totalDays: 0, presentDays: 0, lateDays: 0, absentDays: 0, excusedDays: 0, attendanceRate: 0,
            };
          }
          map[uid].totalDays++;
          if (l.status === 'ON_TIME' || l.status === 'PRESENT') map[uid].presentDays++;
          else if (l.status === 'LATE') map[uid].lateDays++;
          else if (l.status === 'ABSENT') map[uid].absentDays++;
          else if (l.status === 'EXCUSED_ABSENCE') map[uid].excusedDays++;
        });
        const result = Object.values(map).map((r) => ({
          ...r,
          attendanceRate: r.totalDays > 0 ? Math.round(((r.presentDays + r.lateDays) / r.totalDays) * 100) : 0,
        }));
        setRows(result);
      } catch {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const avgRate = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.attendanceRate, 0) / rows.length) : 0;
  const totalPresent = rows.reduce((s, r) => s + r.presentDays, 0);
  const totalAbsent = rows.reduce((s, r) => s + r.absentDays, 0);
  const totalLate = rows.reduce((s, r) => s + r.lateDays, 0);

  // Dữ liệu cho biểu đồ so sánh nhân viên (top 10)
  const chartData = rows
    .slice(0, 10)
    .map((r) => ({
      name: r.fullName.split(' ').slice(-2).join(' '),
      present: r.presentDays,
      late: r.lateDays,
      absent: r.absentDays,
      rate: r.attendanceRate,
    }));

  const handleExportCSV = () => {
    const csv = [
      ['Họ tên', 'Email', 'Tổng ngày', 'Đúng giờ', 'Trễ', 'Vắng', 'Có phép', 'Tỷ lệ (%)'],
      ...rows.map((r) => [r.fullName, r.email, r.totalDays, r.presentDays, r.lateDays, r.absentDays, r.excusedDays, r.attendanceRate]),
    ].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-cham-cong-T${filterMonth}-${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất báo cáo CSV');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Báo cáo Chấm công</h1>
          <p className="text-slate-500 text-sm mt-1">Thống kê chuyên cần theo tháng</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={fetchReport} className="btn-ghost" title="Làm mới">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExportCSV} className="btn-secondary" disabled={rows.length === 0}>
            <Download size={16} />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Calendar size={16} className="text-slate-400" />
        <label className="text-sm font-medium text-slate-600">Lọc theo:</label>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="form-input w-auto">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="form-input w-auto">
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {rows.length > 0 && (
          <span className="ml-auto text-xs text-slate-400 font-medium">{rows.length} nhân sự</span>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Tỷ lệ chuyên cần TB', value: `${avgRate}%`, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
            { label: 'Lượt đúng giờ', value: totalPresent, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Lượt đi trễ', value: totalLate, icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Lượt vắng mặt', value: totalAbsent, icon: XCircle, color: 'text-red-600 bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="card p-5 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart - So sánh nhân viên */}
      {!loading && chartData.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-blue-500" />
            Biểu đồ chấm công theo nhân viên (Top 10) — Tháng {filterMonth}/{filterYear}
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="present" name="Đúng giờ" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="late"    name="Đi trễ"   fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="absent"  name="Vắng mặt" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">Chi tiết — Tháng {filterMonth}/{filterYear}</h2>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Chưa có dữ liệu cho tháng này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th className="text-center">Tổng ngày</th>
                  <th className="text-center">Đúng giờ</th>
                  <th className="text-center">Đi trễ</th>
                  <th className="text-center">Vắng mặt</th>
                  <th className="text-center">Có phép</th>
                  <th className="text-center">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <td>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{r.fullName}</p>
                        <p className="text-xs text-slate-400">{r.email}</p>
                      </div>
                    </td>
                    <td className="text-center font-semibold text-slate-700">{r.totalDays}</td>
                    <td className="text-center"><span className="badge badge-green">{r.presentDays}</span></td>
                    <td className="text-center"><span className="badge badge-yellow">{r.lateDays}</span></td>
                    <td className="text-center"><span className="badge badge-red">{r.absentDays}</span></td>
                    <td className="text-center"><span className="badge badge-blue">{r.excusedDays}</span></td>
                    <td className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              r.attendanceRate >= 90 ? 'bg-emerald-500' :
                              r.attendanceRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${r.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{r.attendanceRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
