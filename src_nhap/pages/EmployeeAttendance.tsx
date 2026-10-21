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
  UserPlus,
  Briefcase,
  Layers,
  Filter,
  Users
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
  address?: string;
}

interface UserStaff {
  _id: string;
  fullName: string;
  email: string;
  role?: any;
  department?: string;
}

interface SlotOption {
  slotId: string;
  name: string;
  shift: string;
  timeRange: string;
}

const EMPLOYEE_SLOTS: SlotOption[] = [
  { slotId: 'slot_1', name: 'Slot 1', shift: 'Ca sáng', timeRange: '08:00 - 12:00' },
  { slotId: 'slot_2', name: 'Slot 2', shift: 'Ca chiều', timeRange: '13:30 - 17:30' },
  { slotId: 'slot_3', name: 'Slot 3', shift: 'Ca tối', timeRange: '18:00 - 21:00' }
];

export default function EmployeeAttendance() {
  const { user, can, hasRole } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'my-logs' | 'admin-approval'>('my-logs');

  // Master Data
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserStaff[]>([]);

  // Form State (Employee self-check-in)
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
  const isAdminOrManager = can(PERMISSIONS.EMPLOYEES.MANAGE) || 
                           can(PERMISSIONS.RECEPTIONIST_ATTENDANCE.MANAGE) || 
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
      toast.error('Lỗi khi tải lịch sử chấm công nhân viên');
    } finally {
      setLoadingLogs(false);
    }
  };

  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const toggleAssignSlot = (slotId: string) => {
    setAssignSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  // Submit Self Attendance
  const handleSubmitSelfAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampusId) {
      toast.error('Vui lòng chọn cơ sở làm việc!');
      return;
    }
    if (selectedSlotIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ca / slot làm việc!');
      return;
    }

    setSubmitting(true);
    try {
      const slotsPayload = EMPLOYEE_SLOTS.filter(s => selectedSlotIds.includes(s.slotId));
      
      const res = await apiClient.post('/receptionist-attendance', {
        date: selectedDate,
        campusId: selectedCampusId,
        slots: slotsPayload,
        note
      });

      if (res.data.success) {
        toast.success('Đã gửi chấm công thành công, vui lòng chờ Quản lý phê duyệt!');
        setSelectedSlotIds([]);
        setNote('');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi gửi chấm công');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin Assign Schedule
  const handleAssignSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStaffId) {
      toast.error('Vui lòng chọn nhân viên!');
      return;
    }
    if (!assignCampusId) {
      toast.error('Vui lòng chọn cơ sở làm việc!');
      return;
    }
    if (assignSlotIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ca làm việc!');
      return;
    }

    setAssignSubmitting(true);
    try {
      const slotsPayload = EMPLOYEE_SLOTS.filter(s => assignSlotIds.includes(s.slotId));

      const res = await apiClient.post('/receptionist-attendance/assign', {
        staffId: assignStaffId,
        date: assignDate,
        campusId: assignCampusId,
        slots: slotsPayload,
        note: assignNote
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Đã phân công lịch làm việc cho nhân viên!');
        setShowAssignModal(false);
        setAssignSlotIds([]);
        setAssignNote('');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi phân công ca làm');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Approve / Reject Action
  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await apiClient.put(`/receptionist-attendance/${id}/status`, {
        status: 'Approved'
      });
      if (res.data.success) {
        toast.success('Đã phê duyệt ca làm việc!');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi duyệt ca làm');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRejectModal = (item: any) => {
    setRejectingItem(item);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    setActionLoadingId(rejectingItem._id);
    try {
      const res = await apiClient.put(`/receptionist-attendance/${rejectingItem._id}/status`, {
        status: 'Rejected',
        rejectReason
      });
      if (res.data.success) {
        toast.success('Đã từ chối ca làm việc!');
        setRejectingItem(null);
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi từ chối ca làm');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi chấm công này không?')) return;
    try {
      const res = await apiClient.delete(`/receptionist-attendance/${id}`);
      if (res.data.success) {
        toast.success('Đã xóa bản ghi chấm công!');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa bản ghi');
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchStaff) return true;
    const name = log.staffName || log.user?.fullName || '';
    const email = log.user?.email || '';
    return name.toLowerCase().includes(searchStaff.toLowerCase()) || email.toLowerCase().includes(searchStaff.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã duyệt
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Chờ duyệt
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold mb-2 border border-blue-300">
            <Sparkles className="w-3.5 h-3.5" />
            Hệ thống Chấm công & Phân ca Nhân viên Cơ sở
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chấm Công Nhân Viên</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ghi nhận và tích chọn ca làm việc của Nhân sự tại các cơ sở, tự động tính ca để chuyển vào Bảng Lương.
          </p>
        </div>

        {/* Tab Selector & Admin Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 shadow-inner">
            <button
              onClick={() => setActiveTab('my-logs')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                activeTab === 'my-logs' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Chấm công của tôi
            </button>
            {isAdminOrManager && (
              <button
                onClick={() => setActiveTab('admin-approval')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'admin-approval' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Duyệt & Phân ca (Admin)
              </button>
            )}
          </div>

          {isAdminOrManager && activeTab === 'admin-approval' && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Xếp lịch / Phân ca
            </button>
          )}
        </div>
      </header>

      {/* TAB 1: NHÂN VIÊN TỰ TÍCH CA LÀM VIỆC */}
      {activeTab === 'my-logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Chấm công */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 lg:col-span-1">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Tích ca làm hôm nay</h3>
                <p className="text-xs text-slate-400">Chọn cơ sở và các slot bạn trực tiếp làm</p>
              </div>
            </div>

            <form onSubmit={handleSubmitSelfAttendance} className="space-y-4">
              {/* Ngày làm việc */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Ngày làm việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {/* Cơ sở */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Cơ sở làm việc <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCampusId}
                  onChange={e => setSelectedCampusId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  required
                >
                  {campuses.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.address ? `(${c.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tích chọn Slot */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Chọn các Ca / Slot làm việc <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {EMPLOYEE_SLOTS.map(slot => {
                    const isSelected = selectedSlotIds.includes(slot.slotId);
                    return (
                      <div
                        key={slot.slotId}
                        onClick={() => toggleSlotSelection(slot.slotId)}
                        className={cn(
                          "p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between",
                          isSelected 
                            ? "bg-blue-50/80 border-blue-600 text-blue-900 shadow-sm" 
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-lg flex items-center justify-center border transition-all",
                            isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-black">{slot.name} ({slot.shift})</p>
                            <p className="text-[11px] text-slate-500 font-medium">{slot.timeRange}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
                          1 Ca
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Ghi chú công việc / Bàn giao
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về ca trực, hỗ trợ khách hoặc sự vụ phát sinh..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Gửi Chấm Công
              </button>
            </form>
          </div>

          {/* Lịch sử cá nhân */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-extrabold text-slate-900">Lịch sử chấm công của tôi</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Tháng {filterMonth}/{filterYear}
              </span>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Chưa có bản ghi chấm công nào trong tháng này</p>
                <p className="text-xs text-slate-400">Hãy tích chọn ca làm việc ở khung bên trái để gửi chấm công</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Ngày</th>
                      <th className="py-3 px-4">Cơ sở</th>
                      <th className="py-3 px-4">Ca làm</th>
                      <th className="py-3 px-4">Ghi chú</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((item: any) => (
                      <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-blue-700 text-xs inline-flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {item.campus?.name || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {item.slots?.map((s: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                                {s.name} ({s.shift})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {item.note || '-'}
                          {item.rejectReason && (
                            <p className="text-rose-600 font-bold text-[11px] mt-0.5">Lý do từ chối: {item.rejectReason}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {item.status === 'Pending' && (
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                              title="Hủy / Xóa bản ghi"
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
      )}

      {/* TAB 2: ADMIN PHÊ DUYỆT & PHÂN CA NHÂN SỰ */}
      {activeTab === 'admin-approval' && isAdminOrManager && (
        <div className="space-y-4">
          {/* Bộ lọc Admin */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Tìm tên */}
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên nhân viên..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Lọc Trạng thái */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Pending">Chờ duyệt</option>
                <option value="Approved">Đã duyệt</option>
                <option value="Rejected">Từ chối</option>
              </select>

              {/* Lọc Cơ sở */}
              <select
                value={filterCampus}
                onChange={e => setFilterCampus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả cơ sở</option>
                {campuses.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Tổng cộng: <strong className="text-slate-900">{filteredLogs.length}</strong> ca trực
            </div>
          </div>

          {/* Bảng danh sách Admin duyệt */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-bold text-base">Không có dữ liệu ca trực nào theo bộ lọc</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                      <th className="py-4 px-5">Nhân viên</th>
                      <th className="py-4 px-5">Ngày</th>
                      <th className="py-4 px-5">Cơ sở</th>
                      <th className="py-4 px-5">Các Ca / Slot</th>
                      <th className="py-4 px-5">Ghi chú</th>
                      <th className="py-4 px-5 text-center">Trạng thái</th>
                      <th className="py-4 px-5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((item: any) => (
                      <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                              {(item.staffName || item.user?.fullName || 'U').charAt(0)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900">{item.staffName || item.user?.fullName}</p>
                              <p className="text-xs text-slate-400">{item.user?.email || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 font-bold text-slate-800 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className="font-bold text-blue-700 text-xs inline-flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {item.campus?.name || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1">
                            {item.slots?.map((s: any, idx: number) => (
                              <span key={idx} className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                                {s.name} ({s.shift})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-xs text-slate-500 max-w-xs">
                          {item.note || '-'}
                          {item.rejectReason && (
                            <p className="text-rose-600 font-bold mt-0.5">Lý do từ chối: {item.rejectReason}</p>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.status === 'Pending' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(item._id)}
                                  disabled={actionLoadingId === item._id}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Duyệt
                                </button>
                                <button
                                  onClick={() => handleOpenRejectModal(item)}
                                  disabled={actionLoadingId === item._id}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Từ chối
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                title="Xóa bản ghi"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* MODAL PHÂN CÔNG / XẾP LỊCH CHO ADMIN */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Phân Công Ca Làm Việc
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSchedule} className="space-y-4">
              {/* Chọn Nhân viên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Chọn Nhân viên <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignStaffId}
                  onChange={e => setAssignStaffId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 cursor-pointer"
                  required
                >
                  {staffUsers.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ngày làm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Ngày làm việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={e => setAssignDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  required
                />
              </div>

              {/* Cơ sở */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Cơ sở làm việc <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignCampusId}
                  onChange={e => setAssignCampusId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 cursor-pointer"
                  required
                >
                  {campuses.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Chọn Slot */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Chọn Ca / Slot phân công <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {EMPLOYEE_SLOTS.map(slot => {
                    const isSelected = assignSlotIds.includes(slot.slotId);
                    return (
                      <div
                        key={slot.slotId}
                        onClick={() => toggleAssignSlot(slot.slotId)}
                        className={cn(
                          "p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                          isSelected ? "bg-emerald-50 border-emerald-600 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-700"
                        )}
                      >
                        <span className="text-xs font-bold">{slot.name} ({slot.shift}) - {slot.timeRange}</span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Ghi chú phân công
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú phân công..."
                  value={assignNote}
                  onChange={e => setAssignNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {assignSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Xác nhận Phân ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TỪ CHỐI DUYỆT */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Từ chối ca làm việc
            </h3>
            <p className="text-xs text-slate-600">
              Nhập lý do từ chối ca làm việc của <strong>{rejectingItem.staffName || rejectingItem.user?.fullName}</strong>:
            </p>
            <textarea
              rows={3}
              placeholder="VD: Không có mặt tại cơ sở, ca trùng lặp..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
