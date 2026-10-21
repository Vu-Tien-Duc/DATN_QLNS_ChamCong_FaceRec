import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Search, 
  ShieldCheck, 
  User as UserIcon, 
  FileText, 
  Loader2, 
  Trash2, 
  AlertCircle,
  Sparkles,
  Check,
  X,
  UserPlus
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../constants/permissions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Campus {
  _id: string;
  name: string;
  code?: string;
}

interface UserStaff {
  _id: string;
  fullName: string;
  email: string;
  role?: any;
}

interface SlotOption {
  slotId: string;
  name: string;
  shift: string;
  timeRange: string;
}

const RECEPTIONIST_SLOTS: SlotOption[] = [
  { slotId: 'slot_1', name: 'Slot 1', shift: 'Ca sáng', timeRange: '08:00 - 12:00' },
  { slotId: 'slot_2', name: 'Slot 2', shift: 'Ca chiều', timeRange: '13:30 - 17:30' },
  { slotId: 'slot_3', name: 'Slot 3', shift: 'Ca tối', timeRange: '18:00 - 21:00' }
];

export default function ReceptionistAttendance() {
  const { user, can, hasRole } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'my-logs' | 'admin-approval'>('my-logs');

  // Master Data
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserStaff[]>([]);

  // Form State (Receptionist self-check-in)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Admin Assign Schedule Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState<string>('');
  const [assignDate, setAssignDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [assignCampusId, setAssignCampusId] = useState<string>('');
  const [assignSlotIds, setAssignSlotIds] = useState<string[]>([]);
  const [assignNote, setAssignNote] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Logs List State
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Filter State
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCampus, setFilterCampus] = useState<string>('all');
  const [searchStaff, setSearchStaff] = useState<string>('');

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Check Admin / Manager Role (Chỉ Admin / Quản lý mới thấy Tab Phê duyệt)
  const userRole = (user?.role?.name || '').toLowerCase();
  const isAdminOrManager = can(PERMISSIONS.RECEPTIONIST_ATTENDANCE.MANAGE) || 
                           hasRole('admin') || 
                           hasRole('manager') || 
                           hasRole('director') || 
                           hasRole('superadmin') ||
                           ['admin', 'manager', 'director', 'superadmin'].includes(userRole);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, filterMonth, filterYear, filterStatus, filterCampus]);

  const fetchMasterData = async () => {
    try {
      const [campusRes, userRes] = await Promise.all([
        apiClient.get('/campuses'),
        apiClient.get('/users')
      ]);

      const campusList = campusRes.data?.data || campusRes.data || [];
      const userList = userRes.data?.data || userRes.data || [];

      setCampuses(campusList);
      setStaffUsers(userList);

      if (campusList.length > 0) {
        setSelectedCampusId(campusList[0]._id);
        setAssignCampusId(campusList[0]._id);
      }
      if (userList.length > 0) {
        setAssignStaffId(userList[0]._id);
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải dữ liệu cơ sở & nhân sự');
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params: any = {
        month: filterMonth,
        year: filterYear,
        status: filterStatus,
        campusId: filterCampus
      };

      const res = await apiClient.get('/receptionist-attendance', { params });
      if (res.data.success) {
        setLogs(res.data.data || []);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách ca làm việc Lễ tân');
    } finally {
      setLoadingLogs(false);
    }
  };

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const toggleAssignSlot = (slotId: string) => {
    setAssignSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const handleSubmitSelfLog = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      toast.error('Vui lòng chọn ngày làm việc');
      return;
    }
    if (!selectedCampusId) {
      toast.error('Vui lòng chọn cơ sở làm việc');
      return;
    }
    if (selectedSlotIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 Slot ca làm việc');
      return;
    }

    const payloadSlots = RECEPTIONIST_SLOTS
      .filter(s => selectedSlotIds.includes(s.slotId))
      .map(s => ({
        slotId: s.slotId,
        name: s.name,
        shift: s.shift
      }));

    setSubmitting(true);
    try {
      const res = await apiClient.post('/receptionist-attendance', {
        date: selectedDate,
        campusId: selectedCampusId,
        slots: payloadSlots,
        note
      });

      if (res.data.success) {
        toast.success('Gửi tích ca làm việc Lễ tân thành công! Đang chờ Admin phê duyệt.');
        setSelectedSlotIds([]);
        setNote('');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('Lỗi khi gửi ca làm việc: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminAssignSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignStaffId || !assignDate || !assignCampusId || assignSlotIds.length === 0) {
      toast.error('Vui lòng điền đầy đủ thông tin phân công');
      return;
    }

    const payloadSlots = RECEPTIONIST_SLOTS
      .filter(s => assignSlotIds.includes(s.slotId))
      .map(s => ({
        slotId: s.slotId,
        name: s.name,
        shift: s.shift
      }));

    setAssignSubmitting(true);
    try {
      const res = await apiClient.post('/receptionist-attendance/assign', {
        staffId: assignStaffId,
        date: assignDate,
        campusId: assignCampusId,
        slots: payloadSlots,
        note: assignNote
      });

      if (res.data.success) {
        toast.success('Phân công lịch làm việc thành công!');
        setShowAssignModal(false);
        setAssignSlotIds([]);
        setAssignNote('');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('Lỗi khi phân công: ' + (err.response?.data?.message || err.message));
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected', reason?: string) => {
    setActionLoadingId(id);
    try {
      const res = await apiClient.put(`/receptionist-attendance/${id}/status`, {
        status: newStatus,
        rejectReason: reason || ''
      });

      if (res.data.success) {
        toast.success(newStatus === 'Approved' ? 'Đã phê duyệt ca làm Lễ tân!' : 'Đã từ chối ca làm Lễ tân.');
        fetchLogs();
        setRejectingItem(null);
        setRejectReason('');
      }
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi ca làm này?')) return;

    setActionLoadingId(id);
    try {
      const res = await apiClient.delete(`/receptionist-attendance/${id}`);
      if (res.data.success) {
        toast.success('Đã xóa bản ghi ca làm Lễ tân');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter logs for display
  const filteredLogs = logs.filter(item => {
    if (!searchStaff) return true;
    const nameStr = item.staffName || item.user?.fullName || '';
    return nameStr.toLowerCase().includes(searchStaff.toLowerCase());
  });

  const totalCount = filteredLogs.length;
  const pendingCount = filteredLogs.filter(l => l.status === 'Pending').length;
  const approvedCount = filteredLogs.filter(l => l.status === 'Approved').length;
  const rejectedCount = filteredLogs.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-400/20">
            <Sparkles className="w-3.5 h-3.5" />
            Lễ tân, Sale & Nhân sự Vận hành
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Chấm công Ca trực Lễ tân, Sale & Vận hành</h1>
          <p className="text-emerald-200/80 text-sm mt-1 max-w-2xl">
            Lễ tân, Sale & Nhân sự Vận hành chủ động xác nhận cơ sở & tích chọn ca trực (Slot 1 Sáng, Slot 2 Chiều, Slot 3 Tối). Admin phân công & phê duyệt chính thức.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="relative z-10 flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('my-logs')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
              activeTab === 'my-logs' 
                ? "bg-white text-slate-900 shadow-md" 
                : "text-emerald-100 hover:bg-white/10"
            )}
          >
            <UserIcon className="w-4 h-4" />
            Tích ca cá nhân
          </button>

          {isAdminOrManager && (
            <button
              onClick={() => setActiveTab('admin-approval')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 relative",
                activeTab === 'admin-approval' 
                  ? "bg-white text-slate-900 shadow-md" 
                  : "text-emerald-100 hover:bg-white/10"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Phê duyệt
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-extrabold bg-amber-500 text-white rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'my-logs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Card */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Xác nhận ca làm việc tại Cơ sở
              </h2>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold">Lễ tân</span>
            </div>

            <form onSubmit={handleSubmitSelfLog} className="space-y-4">
              {/* Date & Campus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày làm việc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cơ sở trực <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  >
                    {campuses.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Slot Options */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tích chọn Ca / Slot trực Lễ tân <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {RECEPTIONIST_SLOTS.map(slot => {
                    const isChecked = selectedSlotIds.includes(slot.slotId);
                    return (
                      <div
                        key={slot.slotId}
                        onClick={() => toggleSlot(slot.slotId)}
                        className={cn(
                          "cursor-pointer flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 select-none",
                          isChecked 
                            ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm" 
                            : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-lg flex items-center justify-center border transition-all",
                            isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-800">{slot.name}</span>
                            <span className="ml-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              {slot.shift}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                          {slot.timeRange}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ghi chú công việc / Nhiệm vụ lễ tân
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ví dụ: Trực đón học viên ca sáng, thu học phí 2 phụ huynh..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Submit Tích ca Lễ tân
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Personal Logs Table */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lịch sử tích ca cá nhân</h2>
                <p className="text-xs text-slate-500">Các ca trực lễ tân bạn đã đăng ký</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>

                <select
                  value={filterYear}
                  onChange={e => setFilterYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Chưa có ca trực nào</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng chọn ngày và ca trực ở form bên trái để ghi nhận</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-3">Ngày & Cơ sở</th>
                      <th className="py-3 px-3">Các Slot đã tích</th>
                      <th className="py-3 px-3">Trạng thái Admin</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900">
                            {new Date(log.date).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5" />
                            {log.campus?.name || 'N/A'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {log.slots?.map((s: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {s.name} ({s.shift})
                              </span>
                            ))}
                          </div>
                          {log.note && (
                            <p className="text-xs text-slate-500 italic mt-1 max-w-xs truncate" title={log.note}>
                              "{log.note}"
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          {log.status === 'Pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 animate-pulse" />
                              Chờ duyệt
                            </span>
                          )}
                          {log.status === 'Approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã chấp thuận
                            </span>
                          )}
                          {log.status === 'Rejected' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                Từ chối
                              </span>
                              {log.rejectReason && (
                                <p className="text-[11px] text-rose-600 mt-0.5 italic">
                                  Lý do: {log.rejectReason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          {log.status === 'Pending' && (
                            <button
                              onClick={() => handleDeleteLog(log._id)}
                              disabled={actionLoadingId === log._id}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                              title="Xóa bản ghi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Admin Approval & Assign Tab */
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Tổng ca Lễ tân</p>
                <p className="text-2xl font-black text-slate-900">{totalCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-amber-800 font-semibold uppercase">Chờ phê duyệt</p>
                <p className="text-2xl font-black text-amber-900">{pendingCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-emerald-800 font-semibold uppercase">Đã chấp thuận</p>
                <p className="text-2xl font-black text-emerald-900">{approvedCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-rose-800 font-semibold uppercase">Từ chối</p>
                <p className="text-2xl font-black text-rose-900">{rejectedCount}</p>
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Phân công Lịch tuần
              </button>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên lễ tân..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Pending">Chờ phê duyệt</option>
                <option value="Approved">Đã chấp thuận</option>
                <option value="Rejected">Từ chối</option>
              </select>

              <select
                value={filterCampus}
                onChange={e => setFilterCampus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="all">Tất cả cơ sở</option>
                {campuses.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Admin Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-semibold">Không tìm thấy ca trực Lễ tân nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-4 px-4">Lễ tân</th>
                      <th className="py-4 px-4">Ngày làm & Cơ sở</th>
                      <th className="py-4 px-4">Slot trực</th>
                      <th className="py-4 px-4">Ghi chú công việc</th>
                      <th className="py-4 px-4">Trạng thái</th>
                      <th className="py-4 px-4 text-center">Phê duyệt Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                              {(log.staffName || log.user?.fullName || 'LT').charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">
                                {log.staffName || log.user?.fullName || 'N/A'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {log.user?.email || ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800">
                            {new Date(log.date).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5" />
                            {log.campus?.name || 'N/A'}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {log.slots?.map((s: any, idx: number) => (
                              <span key={idx} className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {s.name} ({s.shift})
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <span className="text-xs text-slate-600 line-clamp-2">
                            {log.note || <em className="text-slate-400">Không có ghi chú</em>}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          {log.status === 'Pending' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              Chờ duyệt
                            </span>
                          )}
                          {log.status === 'Approved' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đã duyệt
                              </span>
                              {log.approvedBy?.fullName && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Bởi: {log.approvedBy.fullName}
                                </div>
                              )}
                            </div>
                          )}
                          {log.status === 'Rejected' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5" />
                                Từ chối
                              </span>
                              {log.rejectReason && (
                                <div className="text-[11px] text-rose-600 mt-0.5 italic">
                                  Lý do: {log.rejectReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {log.status !== 'Approved' && (
                              <button
                                onClick={() => handleUpdateStatus(log._id, 'Approved')}
                                disabled={actionLoadingId === log._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Phê duyệt
                              </button>
                            )}

                            {log.status !== 'Rejected' && (
                              <button
                                onClick={() => {
                                  setRejectingItem(log);
                                  setRejectReason('');
                                }}
                                disabled={actionLoadingId === log._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Từ chối
                              </button>
                            )}
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
      )}

      {/* Admin Assign Schedule Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Phân công Lịch làm việc cho Lễ tân
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminAssignSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Chọn Lễ tân / Nhân viên <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignStaffId}
                  onChange={e => setAssignStaffId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  required
                >
                  {staffUsers.map(st => (
                    <option key={st._id} value={st._id}>
                      {st.fullName} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày phân công <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignDate}
                    onChange={e => setAssignDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cơ sở trực <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={assignCampusId}
                    onChange={e => setAssignCampusId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    required
                  >
                    {campuses.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tích chọn Ca / Slot phân công <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RECEPTIONIST_SLOTS.map(slot => {
                    const isChecked = assignSlotIds.includes(slot.slotId);
                    return (
                      <div
                        key={slot.slotId}
                        onClick={() => toggleAssignSlot(slot.slotId)}
                        className={cn(
                          "cursor-pointer p-2.5 rounded-xl border text-center transition-all select-none",
                          isChecked 
                            ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20" 
                            : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <p className="font-bold text-xs text-slate-900">{slot.name}</p>
                        <p className="text-[11px] font-semibold text-emerald-700">{slot.shift}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chú phân công
                </label>
                <textarea
                  rows={2}
                  value={assignNote}
                  onChange={e => setAssignNote(e.target.value)}
                  placeholder="Ghi chú công việc..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2"
                >
                  {assignSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu phân công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Từ chối ca trực Lễ tân
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Nhập lý do từ chối ca trực của lễ tân{' '}
              <strong className="text-slate-900">{rejectingItem.staffName || rejectingItem.user?.fullName}</strong>:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Lễ tân vắng mặt không báo trước..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-rose-500/20 outline-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingItem._id, 'Rejected', rejectReason)}
                disabled={actionLoadingId === rejectingItem._id}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-2"
              >
                {actionLoadingId === rejectingItem._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Xác nhận từ chối'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
