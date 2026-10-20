import React, { useState, useEffect, useCallback } from 'react';
import {
  ScanFace, Clock, CheckCircle2, XCircle, ClipboardList,
  Loader2, AlertCircle, Calendar, Search, Eye,
  Edit2, Trash2, RefreshCw, User, X, Check,
  ShieldCheck, UserPlus, Filter, Sparkles, FileText,
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FaceAttendanceScannerModal } from '../components/FaceAttendanceScannerModal';

interface AttendanceLog {
  _id: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    department?: { name: string } | string;
  };
  shiftId?: { _id: string; name: string; startTime: string; endTime: string } | string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  method?: string;
  note?: string;
  createdAt: string;
  date?: string;
}

interface ShiftConfig {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ON_TIME:          { label: 'Đúng giờ',      className: 'badge-green' },
  LATE:             { label: 'Đi trễ',         className: 'badge-yellow' },
  ABSENT:           { label: 'Vắng mặt',       className: 'badge-red' },
  EARLY_LEAVE:      { label: 'Về sớm',         className: 'badge-yellow' },
  EXCUSED_ABSENCE:  { label: 'Vắng có phép',   className: 'badge-blue' },
  CHECKED_IN:       { label: 'Đã vào ca',      className: 'badge-green' },
  CHECKED_OUT:      { label: 'Đã tan ca',      className: 'badge-gray' },
  PRESENT:          { label: 'Có mặt',         className: 'badge-green' },
};

const METHOD_MAP: Record<string, string> = {
  face:         '🤖 FaceID',
  qr:           '📷 QR Code',
  manual:       '✍️ Thủ công',
  gps:          '📍 GPS',
  fingerprint:  '👆 Vân tay',
};

function StatusBadge({ status }: { status?: string }) {
  const info = STATUS_MAP[status ?? ''];
  if (!info) return <span className="badge badge-gray">{status ?? '—'}</span>;
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export default function AttendanceManage() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  // Tab
  const [activeTab, setActiveTab] = useState<'logs' | 'checkin'>('logs');

  // Face scanner modal
  const [scannerMode, setScannerMode] = useState<'check-in' | 'check-out' | null>(null);

  // Logs
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [search, setSearch] = useState('');

  // Manual check-in form
  const [manualShiftId, setManualShiftId] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Admin edit
  const [editLog, setEditLog] = useState<AttendanceLog | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (filterDate) params.date = filterDate;
      if (filterStatus) params.status = filterStatus;
      if (filterShift) params.shiftId = filterShift;
      const res = await apiClient.get('/attendance/history', { params });
      const records = extractArray<AttendanceLog>(res.data?.data ?? res.data);
      const totalCount =
        typeof res.data?.data?.total === 'number' ? res.data.data.total :
        typeof res.data?.total === 'number' ? res.data.total :
        records.length;
      setLogs(records);
      setTotal(totalCount);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Không thể tải lịch sử chấm công');
    } finally {
      setLoading(false);
    }
  }, [page, filterDate, filterStatus, filterShift]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await apiClient.get('/shifts');
      const data = extractArray<ShiftConfig>(res.data?.data ?? res.data);
      setShifts(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchShifts();
  }, [fetchLogs, fetchShifts]);

  // Chấm công thủ công
  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    try {
      await apiClient.post('/attendance/check-in', {
        method: 'manual',
        shiftId: manualShiftId || undefined,
        note: manualNote || undefined,
      });
      toast.success('Chấm công thủ công thành công!');
      setManualShiftId('');
      setManualNote('');
      fetchLogs();
      setActiveTab('logs');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Chấm công thất bại');
    } finally {
      setManualLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      await apiClient.post('/attendance/check-out', { method: 'manual' });
      toast.success('Tan ca thành công!');
      fetchLogs();
      setActiveTab('logs');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Tan ca thất bại');
    }
  };

  // Admin cập nhật
  const handleEditSave = async () => {
    if (!editLog) return;
    setEditLoading(true);
    try {
      await apiClient.put(`/attendance/${editLog._id}`, { status: editStatus, note: editNote });
      toast.success('Cập nhật thành công');
      setEditLog(null);
      fetchLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Cập nhật thất bại');
    } finally {
      setEditLoading(false);
    }
  };

  // Filter client-side search
  const filtered = logs.filter((l) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    const name = l.userId?.fullName?.toLowerCase() ?? '';
    const email = l.userId?.email?.toLowerCase() ?? '';
    return name.includes(lower) || email.includes(lower);
  });

  const totalPages = Math.ceil(total / LIMIT);

  const todayPresent = logs.filter((l) => l.status === 'ON_TIME' || l.status === 'PRESENT').length;
  const todayLate    = logs.filter((l) => l.status === 'LATE').length;
  const todayAbsent  = logs.filter((l) => l.status === 'ABSENT').length;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold mb-2 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5" />
            Hệ thống Chấm công Nhân sự
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Chấm công</h1>
          <p className="text-slate-500 text-sm mt-1">Ghi nhận, theo dõi và quản lý lịch sử chấm công</p>
        </div>

        {/* Tab Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 shadow-inner">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5
                ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Lịch sử
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5
                ${activeTab === 'checkin' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Clock className="w-3.5 h-3.5" />
              Chấm công
            </button>
          </div>

          <button onClick={() => setScannerMode('check-in')} className="btn-primary">
            <ScanFace size={16} />
            FaceID Vào ca
          </button>
          <button onClick={() => setScannerMode('check-out')} className="btn-secondary">
            <ScanFace size={16} />
            FaceID Tan ca
          </button>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng bản ghi', value: total, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
          { label: 'Đúng giờ', value: todayPresent, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Đi trễ', value: todayLate, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Vắng mặt', value: todayAbsent, icon: XCircle, color: 'text-red-600 bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TAB: CHẤM CÔNG THỦ CÔNG */}
      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Vào ca */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Chấm công Vào ca</h3>
                <p className="text-xs text-slate-400">Ghi nhận giờ vào ca thủ công</p>
              </div>
            </div>
            <form onSubmit={handleManualCheckIn} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Ca làm việc</label>
                <select
                  className="form-input"
                  value={manualShiftId}
                  onChange={(e) => setManualShiftId(e.target.value)}
                >
                  <option value="">-- Tự động nhận ca theo giờ --</option>
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} – {s.endTime})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ghi chú</label>
                <textarea
                  className="form-input h-24 resize-none"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Lý do chấm công thủ công..."
                />
              </div>
              <button type="submit" disabled={manualLoading} className="btn-primary w-full justify-center">
                {manualLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Xác nhận Check-in
              </button>
            </form>
          </div>

          {/* Form Tan ca */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Chấm công Tan ca</h3>
                <p className="text-xs text-slate-400">Kết thúc ca làm việc hiện tại</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Nhân viên: <span className="font-bold text-slate-800">{user?.fullName}</span>
              </p>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
              <button onClick={handleCheckOut} className="btn-secondary w-full justify-center mt-2">
                <XCircle size={16} />
                Xác nhận Tan ca
              </button>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-xs text-blue-700 font-semibold mb-1">💡 Hoặc dùng FaceID:</p>
              <div className="flex gap-2">
                <button onClick={() => setScannerMode('check-in')} className="btn-primary flex-1 justify-center text-xs py-2">
                  <ScanFace size={14} /> Vào ca
                </button>
                <button onClick={() => setScannerMode('check-out')} className="btn-secondary flex-1 justify-center text-xs py-2">
                  <ScanFace size={14} /> Tan ca
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LỊCH SỬ */}
      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-9"
              />
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
              className="form-input w-auto"
            />
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="form-input w-auto"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={filterShift}
              onChange={(e) => { setFilterShift(e.target.value); setPage(1); }}
              className="form-input w-auto"
            >
              <option value="">Tất cả ca</option>
              {shifts.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
            <button onClick={fetchLogs} className="btn-ghost" title="Làm mới">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Không có dữ liệu chấm công</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Ca làm việc</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Trạng thái</th>
                        <th>Phương thức</th>
                        <th>Ngày</th>
                        {isAdmin && <th>Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((log) => {
                        const name = log.userId?.fullName ?? 'Không xác định';
                        const avatarUrl = log.userId?.avatar
                          ? log.userId.avatar.startsWith('http')
                            ? log.userId.avatar
                            : `/uploads/${log.userId.avatar}`
                          : null;
                        const shiftName = typeof log.shiftId === 'object' ? log.shiftId?.name ?? '—' : '—';
                        return (
                          <tr key={log._id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-blue-600 text-xs font-bold">{name[0]?.toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-800 text-sm">{name}</p>
                                  <p className="text-xs text-slate-400">{log.userId?.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-sm text-slate-600">{shiftName}</td>
                            <td className="text-sm font-medium text-emerald-700">
                              {log.checkInTime
                                ? new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td className="text-sm font-medium text-slate-600">
                              {log.checkOutTime
                                ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td><StatusBadge status={log.status} /></td>
                            <td className="text-sm text-slate-600">
                              {METHOD_MAP[log.method ?? ''] ?? log.method ?? '—'}
                            </td>
                            <td className="text-sm text-slate-500">
                              {new Date(log.date ?? log.createdAt).toLocaleDateString('vi-VN')}
                            </td>
                            {isAdmin && (
                              <td>
                                <button
                                  onClick={() => {
                                    setEditLog(log);
                                    setEditStatus(log.status ?? '');
                                    setEditNote(log.note ?? '');
                                  }}
                                  className="btn-ghost p-2"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      Trang {page} / {totalPages} · {total} bản ghi
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                      >← Trước</button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                      >Tiếp →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Admin Edit Modal */}
      {editLog && isAdmin && (
        <div className="modal-overlay" onClick={() => setEditLog(null)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-500" />
                Chỉnh sửa chấm công
              </h3>
              <button onClick={() => setEditLog(null)} className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700">
                Nhân viên: <span className="font-bold">{editLog.userId?.fullName}</span>
                <br />
                <span className="text-xs text-slate-400">
                  {new Date(editLog.date ?? editLog.createdAt).toLocaleDateString('vi-VN')}
                  {' · '}
                  {METHOD_MAP[editLog.method ?? ''] ?? editLog.method ?? '—'}
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select className="form-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ghi chú Admin</label>
                <textarea
                  className="form-input h-24 resize-none"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Lý do điều chỉnh..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditLog(null)} className="btn-secondary flex-1">Huỷ</button>
                <button onClick={handleEditSave} disabled={editLoading} className="btn-primary flex-1 justify-center">
                  {editLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Scanner Modal */}
      {scannerMode && (
        <FaceAttendanceScannerModal
          isOpen={!!scannerMode}
          mode={scannerMode}
          onClose={() => setScannerMode(null)}
          onSuccess={() => {
            setScannerMode(null);
            fetchLogs();
          }}
        />
      )}
    </div>
  );
}
