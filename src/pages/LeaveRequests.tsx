import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Check, X, Loader2, AlertCircle,
  Calendar, Clock, User, ShieldCheck, CheckCircle2, XCircle, Info
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface LeaveRequest {
  _id: string;
  userId?: { _id: string; fullName: string; email: string; avatar?: string; role?: string };
  type?: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvalNote?: string;
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface LeaveBalance {
  annualLeaveQuota?: number;
  usedAnnualLeaveDays?: number;
  remainingAnnualLeaveDays?: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Chờ duyệt', cls: 'badge-yellow' },
  APPROVED:  { label: 'Đã duyệt',  cls: 'badge-green' },
  REJECTED:  { label: 'Từ chối',   cls: 'badge-red' },
  CANCELLED: { label: 'Đã hủy',    cls: 'badge-gray' },
};

const LEAVE_TYPES: Record<string, string> = {
  ANNUAL:    'Nghỉ phép năm',
  SICK:      'Nghỉ ốm / Khám bệnh',
  PERSONAL:  'Việc cá nhân / Gia đình',
  MATERNITY: 'Nghỉ thai sản',
  BUSINESS:  'Đi công tác',
  OTHER:     'Khác',
};

export default function LeaveRequests() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  // Form tạo đơn mới
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('ANNUAL');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Modal phê duyệt / từ chối
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveAction, setApproveAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalNote, setApprovalNote] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiClient.get('/leave-requests/balance');
      const data = res.data?.data ?? res.data;
      if (data) {
        setBalance({
          annualLeaveQuota: data.annualLeaveQuota ?? data.quota ?? 12,
          usedAnnualLeaveDays: data.usedAnnualLeaveDays ?? data.usedDays ?? 0,
          remainingAnnualLeaveDays: data.remainingAnnualLeaveDays ?? data.remainingDays ?? 12,
        });
      }
    } catch (_) {}
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      const res = await apiClient.get('/leave-requests', { params });
      const data = extractArray<LeaveRequest>(res.data?.data ?? res.data);
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRequests();
    fetchBalance();
  }, [fetchRequests, fetchBalance]);

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    try {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (isNaN(s) || isNaN(e) || e < s) return 0;
      return Math.round((e - s) / 86400000) + 1;
    } catch {
      return 0;
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStart || !formEnd || !formReason.trim()) {
      toast.error('Vui lòng điền đầy đủ ngày bắt đầu, ngày kết thúc và lý do');
      return;
    }
    setFormLoading(true);
    try {
      await apiClient.post('/leave-requests', {
        type: formType,
        startDate: formStart,
        endDate: formEnd,
        reason: formReason.trim(),
      });
      toast.success('Đã gửi đơn xin nghỉ phép thành công');
      setShowForm(false);
      setFormReason('');
      setFormStart('');
      setFormEnd('');
      fetchRequests();
      fetchBalance();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gửi đơn thất bại');
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveId) return;
    setApproveLoading(true);
    try {
      const endpoint =
        approveAction === 'APPROVED'
          ? `/leave-requests/${approveId}/approve`
          : `/leave-requests/${approveId}/reject`;

      const payload =
        approveAction === 'APPROVED'
          ? { approvalNote: approvalNote.trim() }
          : { rejectionReason: approvalNote.trim() || 'Từ chối đơn' };

      await apiClient.put(endpoint, payload);
      toast.success(approveAction === 'APPROVED' ? 'Đã phê duyệt đơn thành công' : 'Đã từ chối đơn');
      setApproveId(null);
      setApprovalNote('');
      fetchRequests();
      fetchBalance();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xử lý đơn thất bại');
    } finally {
      setApproveLoading(false);
    }
  };

  const formatDateStr = (dateVal?: string) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Nghỉ phép</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gửi đơn xin nghỉ phép, theo dõi tiến độ duyệt và hạn mức phép năm
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary shrink-0">
          <Plus size={16} /> Tạo đơn xin nghỉ
        </button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-tr from-blue-50 to-indigo-50/40 border-blue-200/80">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
            Hạn mức phép năm
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-900">
              {balance?.annualLeaveQuota ?? 12}
            </span>
            <span className="text-xs font-semibold text-blue-600">ngày / năm</span>
          </div>
          <p className="text-[11px] text-blue-500/90 mt-1">Quy định chuẩn của Nhà trường</p>
        </div>

        <div className="card p-5 bg-gradient-to-tr from-amber-50 to-orange-50/40 border-amber-200/80">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
            Đã sử dụng
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-900">
              {balance?.usedAnnualLeaveDays ?? 0}
            </span>
            <span className="text-xs font-semibold text-amber-600">ngày</span>
          </div>
          <p className="text-[11px] text-amber-600/90 mt-1">Số ngày phép đã được phê duyệt</p>
        </div>

        <div className="card p-5 bg-gradient-to-tr from-emerald-50 to-teal-50/40 border-emerald-200/80">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
            Còn lại
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-900">
              {balance?.remainingAnnualLeaveDays ?? 12}
            </span>
            <span className="text-xs font-semibold text-emerald-600">ngày</span>
          </div>
          <p className="text-[11px] text-emerald-600/90 mt-1">Khả dụng cho các đợt nghỉ tiếp theo</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card p-3 flex flex-wrap gap-2">
        {[
          { key: '', label: 'Tất cả' },
          { key: 'PENDING', label: 'Chờ duyệt' },
          { key: 'APPROVED', label: 'Đã duyệt' },
          { key: 'REJECTED', label: 'Từ chối' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm text-slate-400">Đang tải danh sách đơn...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center">
            <AlertCircle size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-bold">Không có đơn xin nghỉ phép nào</p>
            <p className="text-xs text-slate-400 mt-1">Bấm nút "Tạo đơn xin nghỉ" ở trên để gửi đơn mới</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Người làm đơn</th>
                  <th>Loại nghỉ</th>
                  <th>Thời gian</th>
                  <th>Số ngày</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th className="text-right">Xét duyệt</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const applicantName = r.userId?.fullName || user?.fullName || 'Cán bộ';
                  const applicantEmail = r.userId?.email || user?.email || '';
                  const numDays = calcDays(r.startDate, r.endDate);
                  const typeLabel = LEAVE_TYPES[r.type || 'ANNUAL'] || r.type || 'Phép năm';
                  const statusInfo = STATUS_LABELS[r.status] || { label: r.status, cls: 'badge-gray' };
                  const isPending = r.status === 'PENDING';

                  return (
                    <tr key={r._id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {applicantName[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{applicantName}</p>
                            <p className="text-[11px] text-slate-400">{applicantEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600 font-medium whitespace-nowrap">
                        {formatDateStr(r.startDate)} → {formatDateStr(r.endDate)}
                      </td>
                      <td className="text-xs font-bold text-blue-700 font-mono">
                        {numDays} ngày
                      </td>
                      <td className="text-xs text-slate-600 max-w-[200px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td>
                        <span className={`badge ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="text-right">
                          {isPending ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  setApproveId(r._id);
                                  setApproveAction('APPROVED');
                                  setApprovalNote('');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => {
                                  setApproveId(r._id);
                                  setApproveAction('REJECTED');
                                  setApprovalNote('');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tạo Đơn */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Tạo đơn xin nghỉ phép</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Loại nghỉ phép *</label>
                <select
                  className="form-input"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  required
                >
                  {Object.entries(LEAVE_TYPES).map(([val, lab]) => (
                    <option key={val} value={val}>{lab}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Từ ngày *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến ngày *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              {formStart && formEnd && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 flex items-center justify-between">
                  <span>Tổng số ngày xin nghỉ:</span>
                  <span className="text-sm font-black">{calcDays(formStart, formEnd)} ngày</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Lý do nghỉ cụ thể *</label>
                <textarea
                  className="form-input min-h-[90px]"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Ghi rõ lý do xin nghỉ phép / đổi ca..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Gửi đơn xét duyệt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Duyệt / Từ Chối */}
      {approveId && (
        <div className="modal-overlay" onClick={() => setApproveId(null)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {approveAction === 'APPROVED' ? 'Phê duyệt đơn nghỉ phép' : 'Từ chối đơn nghỉ phép'}
              </h3>
              <button onClick={() => setApproveId(null)} className="btn-ghost p-1.5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                {approveAction === 'APPROVED'
                  ? 'Khi phê duyệt, hệ thống sẽ tự động trừ hạn mức phép năm và đồng bộ lịch chấm công có phép (EXCUSED_ABSENCE).'
                  : 'Vui lòng nhập lý do từ chối để cán bộ được thông tin rõ ràng.'}
              </p>

              <div className="form-group">
                <label className="form-label">
                  {approveAction === 'APPROVED' ? 'Ghi chú duyệt (tuỳ chọn)' : 'Lý do từ chối *'}
                </label>
                <textarea
                  className="form-input min-h-[80px]"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder={
                    approveAction === 'APPROVED'
                      ? 'Đồng ý duyệt đơn...'
                      : 'Nhập lý do không thể duyệt...'
                  }
                  required={approveAction === 'REJECTED'}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setApproveId(null)}
                  className="btn-secondary flex-1"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approveLoading}
                  className={`btn flex-1 justify-center text-white ${
                    approveAction === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {approveLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : approveAction === 'APPROVED' ? (
                    'Xác nhận duyệt'
                  ) : (
                    'Xác nhận từ chối'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
