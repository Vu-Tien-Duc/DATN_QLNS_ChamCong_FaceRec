import React, { useState, useEffect, useCallback } from 'react';
import {
  ScanFace, ClipboardList, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, Calendar, Sparkles, RefreshCw, User,
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FaceAttendanceScannerModal } from '../components/FaceAttendanceScannerModal';

interface MyAttendanceLog {
  _id: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  method?: string;
  note?: string;
  date?: string;
  createdAt: string;
  shiftId?: { name: string; startTime: string; endTime: string } | string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ON_TIME:         { label: 'Đúng giờ',     cls: 'badge-green' },
  LATE:            { label: 'Đi trễ',       cls: 'badge-yellow' },
  ABSENT:          { label: 'Vắng mặt',     cls: 'badge-red' },
  EARLY_LEAVE:     { label: 'Về sớm',       cls: 'badge-yellow' },
  EXCUSED_ABSENCE: { label: 'Vắng có phép', cls: 'badge-blue' },
  CHECKED_IN:      { label: 'Đã vào ca',    cls: 'badge-green' },
  CHECKED_OUT:     { label: 'Đã tan ca',    cls: 'badge-gray' },
  PRESENT:         { label: 'Có mặt',       cls: 'badge-green' },
};

const METHOD_ICON: Record<string, string> = {
  face: '🤖', qr: '📷', manual: '✍️', gps: '📍', fingerprint: '👆',
};

const METHOD_LABEL: Record<string, string> = {
  face: 'FaceID', qr: 'QR Code', manual: 'Thủ công', gps: 'GPS', fingerprint: 'Vân tay',
};

export default function AttendanceMe() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MyAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerMode, setScannerMode] = useState<'check-in' | 'check-out' | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const fetchMyLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/attendance/history', {
        params: { month: filterMonth, year: filterYear, limit: 50, page: 1 },
      });
      const data = extractArray<MyAttendanceLog>(res.data?.data ?? res.data);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchMyLogs();
  }, [fetchMyLogs]);

  const totalPresent = logs.filter((l) => l.status === 'ON_TIME' || l.status === 'PRESENT' || l.status === 'CHECKED_IN').length;
  const totalLate    = logs.filter((l) => l.status === 'LATE').length;
  const totalAbsent  = logs.filter((l) => l.status === 'ABSENT').length;
  const totalCheckedOut = logs.filter((l) => l.status === 'CHECKED_OUT' || l.status === 'EARLY_LEAVE').length;
  const attendanceRate = logs.length > 0
    ? Math.round(((totalPresent + totalLate) / logs.length) * 100) : 0;

  const deptName =
    typeof user?.department === 'object'
      ? (user?.department as { name: string })?.name
      : user?.department ?? '—';

  const roleName = typeof user?.role === 'object' ? (user?.role as { name: string })?.name : user?.role ?? '';

  const monthName = new Date(filterYear, filterMonth - 1).toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900 p-6 text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 70% 30%, white 1px, transparent 1px)`, backgroundSize: '28px 28px' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-extrabold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Chấm công cá nhân
            </div>
            <h1 className="text-2xl font-bold mb-1">Chấm công của tôi</h1>
            <p className="text-blue-200 text-sm">
              {user?.fullName} · {roleName} {deptName !== '—' ? `· ${deptName}` : ''}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button onClick={() => setScannerMode('check-in')}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg transition-all">
              <ScanFace size={15} /> Vào ca (FaceID)
            </button>
            <button onClick={() => setScannerMode('check-out')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all">
              <ScanFace size={15} /> Tan ca (FaceID)
            </button>
          </div>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <User size={96} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ngày có mặt', value: totalPresent, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', sub: `${attendanceRate}% chuyên cần` },
          { label: 'Ngày đi trễ', value: totalLate, icon: Clock, color: 'text-amber-600 bg-amber-50', sub: `Tháng ${filterMonth}` },
          { label: 'Ngày vắng mặt', value: totalAbsent, icon: XCircle, color: 'text-red-600 bg-red-50', sub: `Tháng ${filterMonth}` },
          { label: 'Bản ghi tổng', value: logs.length, icon: ClipboardList, color: 'text-blue-600 bg-blue-50', sub: monthName },
        ].map((s) => (
          <div key={s.label} className="card p-5 flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center`}>
              <s.icon size={22} />
            </div>
            <p className="text-3xl font-bold text-slate-800">{s.value}</p>
            <div>
              <p className="text-sm font-medium text-slate-600">{s.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Calendar size={16} className="text-slate-400" />
        <label className="text-sm text-slate-600 font-medium">Xem tháng:</label>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(Number(e.target.value))}
          className="form-input w-auto"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          className="form-input w-auto"
        >
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={fetchMyLogs} className="btn-ghost ml-auto" title="Làm mới">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        {logs.length > 0 && (
          <span className="text-xs text-slate-400">{logs.length} bản ghi</span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ClipboardList size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">Lịch sử chấm công — {monthName}</h2>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Chưa có dữ liệu chấm công tháng này</p>
            <p className="text-slate-400 text-sm mt-1">Dùng FaceID hoặc chấm thủ công ở trang Quản lý chấm công</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Ca làm việc</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Trạng thái</th>
                  <th>Phương thức</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const statusInfo = STATUS_MAP[log.status ?? ''];
                  const shiftName = typeof log.shiftId === 'object' ? log.shiftId?.name ?? '—' : '—';
                  return (
                    <tr key={log._id}>
                      <td className="font-medium text-slate-800">
                        {new Date(log.date ?? log.createdAt).toLocaleDateString('vi-VN', {
                          weekday: 'short', day: '2-digit', month: '2-digit',
                        })}
                      </td>
                      <td className="text-sm text-slate-600">{shiftName}</td>
                      <td className="font-semibold text-emerald-700">
                        {log.checkInTime
                          ? new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="text-slate-600">
                        {log.checkOutTime
                          ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td>
                        {statusInfo ? (
                          <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                        ) : (
                          <span className="badge badge-gray">{log.status ?? '—'}</span>
                        )}
                      </td>
                      <td className="text-sm text-slate-600">
                        {METHOD_ICON[log.method ?? ''] ?? ''}{' '}
                        {METHOD_LABEL[log.method ?? ''] ?? log.method ?? '—'}
                      </td>
                      <td className="text-sm text-slate-500 max-w-[200px] truncate">
                        {log.note ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Face Scanner */}
      {scannerMode && (
        <FaceAttendanceScannerModal
          isOpen={!!scannerMode}
          mode={scannerMode}
          onClose={() => setScannerMode(null)}
          onSuccess={() => {
            setScannerMode(null);
            fetchMyLogs();
            toast.success('Chấm công thành công!');
          }}
        />
      )}
    </div>
  );
}
