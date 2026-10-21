import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, MapPin, Search, Filter, Calendar,
  RefreshCw, Trash2, ExternalLink, Globe, Smartphone,
  CheckCircle2, AlertTriangle, User, Loader2, Clock,
  ChevronLeft, ChevronRight, AlertCircle, Compass, LogOut,
  ShieldOff, ShieldAlert, Power, X
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Modal xác nhận force logout
interface ForceLogoutModalProps {
  target: { userId?: string; email: string; name: string; isAll?: boolean } | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

function ForceLogoutModal({ target, onClose, onConfirm }: ForceLogoutModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!target) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason || (target.isAll ? 'Thu hồi toàn bộ phiên đăng nhập - Admin' : 'Quản trị viên thu hồi quyền truy cập'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-rose-100 animate-in zoom-in-95">
        {/* Header */}
        <div className={`p-6 rounded-t-3xl ${target.isAll ? 'bg-gradient-to-r from-rose-600 to-orange-600' : 'bg-gradient-to-r from-amber-500 to-rose-600'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                {target.isAll ? <Power className="w-6 h-6 text-white" /> : <ShieldOff className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">
                  {target.isAll ? '⚡ Force Logout Toàn Bộ' : '⚡ Force Logout Tài Khoản'}
                </h2>
                <p className="text-white/80 text-xs font-medium mt-0.5">
                  {target.isAll ? 'Thu hồi toàn bộ phiên đăng nhập' : `Thu hồi phiên của: ${target.name}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/20 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {target.isAll ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-rose-700">
                ⚠️ Hành động này sẽ ngay lập tức buộc đăng xuất <strong>TẤT CẢ</strong> tài khoản đang đăng nhập vào hệ thống (trừ tài khoản Admin hiện tại).
              </p>
              <p className="text-xs text-rose-500 font-medium mt-2">
                Người dùng bị ảnh hưởng sẽ nhận được thông báo và bị chuyển về trang đăng nhập ngay khi thực hiện hành động tiếp theo.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center font-black text-amber-800">
                  {target.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">{target.name}</p>
                  <p className="text-xs text-slate-500">{target.email}</p>
                </div>
              </div>
              <p className="text-xs text-amber-700 font-medium">
                ⚠️ Tài khoản này sẽ bị đăng xuất ngay lập tức. Mọi token hiện tại của họ sẽ bị vô hiệu hoá.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Lý do (tuỳ chọn)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={target.isAll ? 'Vd: Bảo trì hệ thống, cập nhật bảo mật...' : 'Vd: Vi phạm chính sách, đáng ngờ...'}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-xs transition-all"
          >
            Huỷ bỏ
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-3 text-white font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 ${
              target.isAll
                ? 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700'
                : 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700'
            } disabled:opacity-60`}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
            ) : (
              <><LogOut className="w-4 h-4" /> {target.isAll ? 'Force Logout Tất Cả' : 'Force Logout'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============
export default function LoginLogs() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, totalSuccess: 0, totalFailed: 0 });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Force Logout Modal State
  const [forceLogoutTarget, setForceLogoutTarget] = useState<{
    userId?: string; email: string; name: string; isAll?: boolean;
  } | null>(null);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params: any = { page, limit: pagination.limit };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await apiClient.get('/login-logs', { params });
      if (res.data.success) {
        setLogs(res.data.data);
        setPagination(res.data.pagination);
        setStats(res.data.stats);
      }
    } catch (error) {
      toast.error("Không thể tải nhật ký đăng nhập");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate, pagination.limit]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleDeleteLog = async (id: string) => {
    if (!isAdmin || !window.confirm("Xóa bản ghi nhật ký này?")) return;
    try {
      const res = await apiClient.delete(`/login-logs/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa bản ghi");
        fetchLogs(pagination.page);
      }
    } catch (e) {
      toast.error("Lỗi khi xóa bản ghi");
    }
  };

  const handleClearAll = async () => {
    if (!isAdmin || !window.confirm("CẢNH BÁO: Xóa toàn bộ lịch sử đăng nhập của hệ thống?")) return;
    try {
      const res = await apiClient.delete('/login-logs/clear-all');
      if (res.data.success) {
        toast.success("Đã dọn dẹp toàn bộ nhật ký");
        fetchLogs(1);
      }
    } catch (e) {
      toast.error("Lỗi dọn dẹp nhật ký");
    }
  };

  const handleForceLogout = async (reason: string) => {
    if (!forceLogoutTarget) return;
    try {
      if (forceLogoutTarget.isAll) {
        const res = await apiClient.post('/auth/force-logout-all', { reason });
        if (res.data.success) {
          toast.success(res.data.message, { icon: '⚡', duration: 5000 });
        }
      } else {
        const res = await apiClient.post(`/auth/force-logout/${forceLogoutTarget.userId}`, { reason });
        if (res.data.success) {
          toast.success(res.data.message, { icon: '⚡', duration: 5000 });
        }
      }
      setForceLogoutTarget(null);
      fetchLogs(pagination.page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lỗi khi thực hiện force logout");
      setForceLogoutTarget(null);
    }
  };

  return (
    <>
      {/* Force Logout Confirmation Modal */}
      <ForceLogoutModal
        target={forceLogoutTarget}
        onClose={() => setForceLogoutTarget(null)}
        onConfirm={handleForceLogout}
      />

      <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest mb-1">
              <ShieldCheck className="w-4 h-4" /> Nhật Ký An Ninh & Vị Trí Đăng Nhập (Security & Geolocation Audit)
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Nhật Ký Đăng Nhập Hệ Thống</h1>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Theo dõi thời gian, địa chỉ IP, tọa độ GPS và thiết bị của tất cả thành viên khi truy cập EduCRM.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchLogs(pagination.page)}
              className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-2xl transition-all text-xs"
            >
              <RefreshCw className="w-4 h-4" /> Làm mới
            </button>

            {isAdmin && (
              <>
                {/* Force Logout All Button */}
                <button
                  onClick={() => setForceLogoutTarget({ isAll: true, email: 'ALL', name: 'Tất cả tài khoản' })}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white font-bold px-4 py-2.5 rounded-2xl transition-all text-xs shadow-md shadow-rose-500/30"
                >
                  <Power className="w-4 h-4" /> Force Logout Tất Cả
                </button>

                {/* Clear Logs Button */}
                <button
                  onClick={handleClearAll}
                  className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-4 py-2.5 rounded-2xl transition-all text-xs border border-rose-200"
                >
                  <Trash2 className="w-4 h-4" /> Xóa tất cả log
                </button>
              </>
            )}
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng lượt đăng nhập</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.total.toLocaleString('vi-VN')}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đăng nhập Thành công</p>
              <h3 className="text-2xl font-black text-emerald-600">{stats.totalSuccess.toLocaleString('vi-VN')}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đăng nhập Thất bại</p>
              <h3 className="text-2xl font-black text-rose-600">{stats.totalFailed.toLocaleString('vi-VN')}</h3>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên thành viên, email, địa chỉ hoặc IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 w-full xl:w-auto">
            {['ALL', 'SUCCESS', 'FAILED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  statusFilter === s
                    ? s === 'SUCCESS' ? 'bg-white text-emerald-600 shadow-sm'
                    : s === 'FAILED' ? 'bg-white text-rose-600 shadow-sm'
                    : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {s === 'ALL' ? 'Tất cả' : s === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full xl:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase">Từ</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-slate-700" />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase">Đến</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-slate-700" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4">Thời gian</th>
                  <th className="px-6 py-4">Thành viên / Vai trò</th>
                  <th className="px-6 py-4">Vị trí & Địa chỉ GPS</th>
                  <th className="px-6 py-4">Địa chỉ IP & Trình duyệt</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  {isAdmin && <th className="px-4 py-4 text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-slate-400 font-bold">Chưa có nhật ký đăng nhập nào phù hợp.</td></tr>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const hasGPS = log.latitude && log.longitude;
                    const mapsUrl = hasGPS ? `https://www.google.com/maps?q=${log.latitude},${log.longitude}` : null;

                    return (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Thời gian */}
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900">{new Date(log.createdAt).toLocaleTimeString('vi-VN')}</div>
                          <div className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleDateString('vi-VN')}</div>
                        </td>

                        {/* Thành viên */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shadow-sm">
                              {log.userName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900">{log.userName || log.userEmail}</div>
                              <div className="text-[10px] font-bold text-slate-400">{log.userEmail}</div>
                              {log.userRoles && log.userRoles.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {log.userRoles.map((r: string, idx: number) => (
                                    <span key={idx} className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border border-slate-200">{r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Vị trí GPS */}
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${hasGPS ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{log.address || 'Chưa có địa chỉ'}</p>
                              {hasGPS && mapsUrl && (
                                <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                  GPS ({log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}) <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* IP & Thiết bị */}
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-900 font-mono text-xs">{log.ipAddress}</div>
                          <div className="text-[10px] text-slate-500 font-medium line-clamp-1 max-w-xs" title={log.userAgent}>{log.userAgent}</div>
                        </td>

                        {/* Trạng thái */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border shadow-sm ${
                            isSuccess ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {isSuccess ? <><CheckCircle2 className="w-3 h-3" /> Thành công</> : <><AlertCircle className="w-3 h-3" /> Thất bại</>}
                          </span>
                          {log.failReason && (
                            <p className="text-[10px] text-rose-500 font-bold mt-1 max-w-[140px] mx-auto line-clamp-2">{log.failReason}</p>
                          )}
                        </td>

                        {/* Thao tác */}
                        {isAdmin && (
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Force Logout từng user (nếu có userId và đăng nhập thành công) */}
                              {log.user && (
                                <button
                                  onClick={() => setForceLogoutTarget({
                                    userId: log.user,
                                    email: log.userEmail,
                                    name: log.userName || log.userEmail
                                  })}
                                  title={`Force logout: ${log.userEmail}`}
                                  className="p-2 text-amber-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                >
                                  <ShieldOff className="w-4 h-4" />
                                </button>
                              )}
                              {/* Xóa bản ghi */}
                              <button
                                onClick={() => handleDeleteLog(log._id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                title="Xóa bản ghi"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
            <div>Hiển thị {logs.length} / {pagination.total} bản ghi</div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Trang {pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
