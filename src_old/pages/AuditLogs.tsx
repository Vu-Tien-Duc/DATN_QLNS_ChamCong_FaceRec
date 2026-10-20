import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Loader2, AlertCircle, Search, Shield, RefreshCw, Filter,
  ShieldCheck, CheckCircle2, XCircle, Lock, Hash, ExternalLink
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

interface AuditLog {
  _id: string;
  actor?: { fullName: string; email: string; role?: string };
  adminId?: { fullName: string; email: string };
  userId?: { fullName: string; email: string };
  action: string;
  targetType?: string;
  targetModel?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  ip?: string;
  status?: string;
  timestamp?: string;
  createdAt?: string;
  previousHash?: string;
  currentHash?: string;
  ma_bam_truoc?: string;
  ma_bam_hien_tai?: string;
}

const ACTION_MAP: Record<string, string> = {
  CREATE_USER:       'Tạo tài khoản',
  UPDATE_USER:       'Cập nhật tài khoản',
  DELETE_USER:       'Xoá tài khoản',
  APPROVE_LEAVE:     'Duyệt nghỉ phép',
  REJECT_LEAVE:      'Từ chối nghỉ phép',
  UPDATE_ATTENDANCE: 'Sửa chấm công',
  REGISTER_FACE:     'Đăng ký FaceID',
  DELETE_FACE:       'Xoá FaceID',
  LOGIN:             'Đăng nhập',
  LOGOUT:            'Đăng xuất',
  FORCE_LOGOUT:      'Thu hồi phiên',
  CREATE_SCHEDULE:   'Tạo lịch phân công',
  UPDATE_SCHEDULE:   'Sửa lịch phân công',
  DELETE_SCHEDULE:   'Xoá lịch phân công',
};

export default function AuditLogs() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa') || hasRole('hieutruong') || hasRole('hieupho');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  // State đối soát chuỗi băm mật mã SHA-256
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    isValid: boolean;
    totalChecked: number;
    validCount: number;
    tamperedCount: number;
    brokenChainCount: number;
    tamperedLogs: any[];
    genesisHash: string;
    latestHash: string | null;
    checkedAt: string;
  } | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await apiClient.get('/audit-logs/verify-integrity');
      setVerifyResult(res.data?.data || res.data);
      setShowVerifyModal(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thực hiện đối soát chuỗi băm.');
    } finally {
      setVerifying(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/audit-logs', {
        params: { page, limit: LIMIT },
      });
      const data = extractArray<AuditLog>(res.data?.data ?? res.data);
      const totalCount =
        res.data?.data?.totalRecords ??
        res.data?.data?.pagination?.totalDocs ??
        res.data?.data?.total ??
        res.data?.total ??
        data.length;

      setLogs(Array.isArray(data) ? data : []);
      setTotal(Number(totalCount) || 0);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    const actorName = l.actor?.fullName || l.adminId?.fullName || l.userId?.fullName || '';
    const actionText = ACTION_MAP[l.action] || l.action;
    return (
      actorName.toLowerCase().includes(lower) ||
      actionText.toLowerCase().includes(lower) ||
      (l.targetType || '').toLowerCase().includes(lower)
    );
  });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const formatLogDate = (dateVal?: string) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return '—';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nhật ký Kiểm toán</h1>
          <p className="text-slate-500 text-sm mt-1">Theo dõi mọi hành động quản trị, thay đổi dữ liệu trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
            title="Đối soát chuỗi băm SHA-256 chống sửa đổi / chống chối bỏ"
          >
            {verifying ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Đối soát Chuỗi Hash SHA-256
          </button>
          <button onClick={fetchLogs} className="btn-secondary" title="Tải lại">
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên người thực hiện, hành động hoặc đối tượng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm text-slate-400">Đang tải nhật ký...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <AlertCircle size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">Không tìm thấy bản ghi kiểm toán nào</p>
            <p className="text-xs text-slate-400 mt-1">Nhật ký sẽ xuất hiện khi có các thao tác quản trị trên hệ thống</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người thực hiện</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>Chi tiết</th>
                    <th>IP</th>
                    <th>Thời gian</th>
                    <th>Toàn vẹn (SHA-256)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const actor = log.actor || log.adminId || log.userId;
                    const actorName = actor?.fullName || 'Hệ thống';
                    const actorEmail = actor?.email || 'System / Auto';
                    const targetStr = log.targetType || log.targetModel || '—';
                    const dateStr = formatLogDate(log.timestamp || log.createdAt);
                    const ipStr = log.ipAddress || log.ip || '—';
                    const hashStr = log.currentHash || log.ma_bam_hien_tai;

                    return (
                      <tr key={log._id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <Shield size={15} className="text-violet-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{actorName}</p>
                              <p className="text-xs text-slate-400">{actorEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue text-xs font-semibold">
                            {ACTION_MAP[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600 font-mono font-medium">
                          {targetStr}
                        </td>
                        <td className="text-xs text-slate-600 max-w-[260px] truncate" title={formatDetails(log.details)}>
                          {formatDetails(log.details)}
                        </td>
                        <td className="text-xs text-slate-500 font-mono">{ipStr}</td>
                        <td className="text-xs text-slate-600 font-medium whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td>
                          {hashStr ? (
                            <div className="flex items-center gap-1.5" title={`SHA-256: ${hashStr}`}>
                              <Lock size={12} className="text-emerald-500 shrink-0" />
                              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {hashStr.substring(0, 8)}...
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500 font-medium">
                  Trang {page} / {totalPages} (Tổng {total} bản ghi)
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Tiếp →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Đối Soát Toàn Vẹn Chuỗi Hash (SHA-256) */}
      {showVerifyModal && verifyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${verifyResult.isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {verifyResult.isValid ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Kết Quả Đối Soát Chuỗi Hash</h3>
                  <p className="text-xs text-slate-500">Mã băm SHA-256 Hash Chaining (Chống sửa đổi / chống chối bỏ)</p>
                </div>
              </div>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${verifyResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <p className="font-semibold text-sm">
                {verifyResult.isValid
                  ? '✓ Toàn bộ chuỗi Hash toàn vẹn 100%'
                  : '⚠ Cảnh báo: Phát hiện dữ liệu bị can thiệp trái phép!'}
              </p>
              <p className="text-xs mt-1 opacity-90">
                {verifyResult.isValid
                  ? 'Tất cả các bản ghi kiểm toán đều khớp với chữ ký băm mật mã và liên kết chặt chẽ với mắt xích trước đó. Dữ liệu chưa từng bị chỉnh sửa hoặc xóa bỏ.'
                  : `Phát hiện ${verifyResult.tamperedCount} bản ghi bị sai lệch băm và ${verifyResult.brokenChainCount} mắt xích bị đứt gãy.`}
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Tổng bản ghi đã kiểm tra:</span>
                <span className="font-bold text-slate-800">{verifyResult.totalChecked} bản ghi</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Bản ghi hợp lệ:</span>
                <span className="font-bold text-emerald-600">{verifyResult.validCount} / {verifyResult.totalChecked}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Thời điểm đối soát:</span>
                <span className="font-mono text-slate-700">{new Date(verifyResult.checkedAt).toLocaleString('vi-VN')}</span>
              </div>
              {verifyResult.latestHash && (
                <div className="py-2 border-b border-slate-100">
                  <span className="text-slate-500 block mb-1">Mã Hash mới nhất (Latest Hash):</span>
                  <span className="font-mono text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded block break-all border border-slate-200">
                    {verifyResult.latestHash}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="btn-primary px-5 py-2 text-sm"
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
