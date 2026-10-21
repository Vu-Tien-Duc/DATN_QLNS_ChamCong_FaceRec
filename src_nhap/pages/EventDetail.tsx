import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CalendarCheck, MapPin, Users, Loader2,
  CheckCircle2, XCircle, Clock, Ban, Save, Trash2, Edit,
  Building2, CalendarDays, FileText, Activity
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

function cn(...inputs: any[]) { return inputs.filter(Boolean).join(' '); }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  Upcoming:  { label: 'Sắp diễn ra', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     icon: Clock },
  Ongoing:   { label: 'Đang diễn ra', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200',   icon: CalendarCheck },
  Completed: { label: 'Hoàn thành',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  Cancelled: { label: 'Đã hủy',       color: 'text-red-500',   bg: 'bg-red-50 border-red-200',       icon: Ban },
};

type TabType = 'view' | 'attendance' | 'edit';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('view');

  // Metadata for Edit tab
  const [campuses, setCampuses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // States for Attendance tab
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { attended: boolean; note: string }>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // States for Edit tab
  const [editForm, setEditForm] = useState<any>({});
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/events/${id}`);
      const ev = res.data.data;
      setEvent(ev);
      
      // Init Edit form
      setEditForm({
        title: ev.title,
        description: ev.description,
        date: ev.date ? ev.date.split('T')[0] : '',
        campus: ev.campus?._id,
        status: ev.status
      });
      setSelectedEmps((ev.participants || []).map((p: any) => p.employee?._id || p.employee));

      // Init Attendance map
      const map: Record<string, { attended: boolean; note: string }> = {};
      (ev.participants || []).forEach((p: any) => {
        const eid = p.employee?._id || p.employee;
        map[eid] = { attended: p.attended || false, note: p.note || '' };
      });
      setAttendanceMap(map);

    } catch (err) {
      toast.error('Không tìm thấy sự kiện');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [c, e] = await Promise.all([apiClient.get('/campuses'), apiClient.get('/employees')]);
      setCampuses(c.data.data || []);
      setEmployees(e.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchData();
    fetchMeta();
  }, [id]);

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const updates = Object.entries(attendanceMap).map(([employeeId, v]) => ({
        employeeId, attended: v.attended, note: v.note
      }));
      const res = await apiClient.patch(`/events/${id}/attendance`, { updates });
      if (res.data.success) {
        toast.success('Lưu điểm danh thành công');
        setEvent(res.data.data);
      }
    } catch { toast.error('Lỗi lưu điểm danh'); }
    finally { setSavingAttendance(false); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmps.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 nhân viên');
      return;
    }

    setSavingEdit(true);
    try {
      // Compute new participants array keeping existing attendance
      const currentParticipants = event.participants || [];
      const newParticipants = selectedEmps.map(empId => {
        const existing = currentParticipants.find((p: any) => (p.employee?._id || p.employee) === empId);
        if (existing) {
          return { employee: empId, attended: existing.attended, note: existing.note };
        }
        return { employee: empId, attended: false, note: '' };
      });

      const payload = {
        ...editForm,
        participants: newParticipants
      };

      const res = await apiClient.put(`/events/${id}`, payload);
      if (res.data.success) {
        toast.success('Cập nhật sự kiện thành công');
        fetchData(); // reload all
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này? Hành động này không thể hoàn tác.')) return;
    try {
      await apiClient.delete(`/events/${id}`);
      toast.success('Đã xóa sự kiện');
      navigate('/events');
    } catch { toast.error('Lỗi xóa sự kiện'); }
  };

  const toggleEmp = (empId: string) => {
    setSelectedEmps(prev => prev.includes(empId) ? prev.filter(x => x !== empId) : [...prev, empId]);
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500 w-10 h-10" /></div>;
  }

  if (!event) return null;

  const sc = STATUS_CONFIG[event.status] || STATUS_CONFIG.Upcoming;
  const StatusIcon = sc.icon;
  const attCount = event.participants?.filter((p: any) => p.attended).length || 0;
  const totalCount = event.participants?.length || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER & BREADCRUMB */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/events')} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 line-clamp-1">{event.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {new Date(event.date).toLocaleDateString('vi-VN')}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {event.campus?.name}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={cn("text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5", sc.bg, sc.color)}>
            <StatusIcon className="w-4 h-4" /> {sc.label}
          </span>
          <button onClick={handleDelete} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TABS MENU */}
      <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={() => setActiveTab('view')}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all", activeTab === 'view' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")}
        >
          <Activity className="w-4 h-4" /> Tổng quan
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all", activeTab === 'attendance' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")}
        >
          <Users className="w-4 h-4" /> Điểm danh
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all", activeTab === 'edit' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")}
        >
          <Edit className="w-4 h-4" /> Chỉnh sửa
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
        
        {/* TAB 1: VIEW */}
        {activeTab === 'view' && (
          <div className="space-y-8 animate-in fade-in">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Thông tin chi tiết</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{event.description || 'Không có mô tả chi tiết.'}</p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Thống kê tham gia</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center">
                  <p className="text-3xl font-black text-slate-900 mb-1">{totalCount}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase">Được mời</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 text-center">
                  <p className="text-3xl font-black text-emerald-600 mb-1">{attCount}</p>
                  <p className="text-xs font-bold text-emerald-500 uppercase">Đã tham gia</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-5 border border-red-100 text-center">
                  <p className="text-3xl font-black text-red-500 mb-1">{totalCount - attCount}</p>
                  <p className="text-xs font-bold text-red-400 uppercase">Vắng mặt</p>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-slate-400 text-center mt-10">
              Sự kiện được tạo bởi: <strong className="text-slate-600">{event.createdBy?.fullName || 'Hệ thống'}</strong> vào ngày {new Date(event.createdAt).toLocaleString('vi-VN')}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Danh sách nhân viên</h2>
                <p className="text-sm text-slate-500">Đánh dấu tham gia và nhập ghi chú nếu có.</p>
              </div>
              <button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
              >
                {savingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu điểm danh
              </button>
            </div>

            {totalCount === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-2xl">
                <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Chưa có nhân viên nào trong danh sách</p>
                <button onClick={() => setActiveTab('edit')} className="text-emerald-600 font-bold mt-2 text-sm">Chuyển sang tab Chỉnh sửa để thêm nhân viên</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="p-4 rounded-tl-xl">Trạng thái</th>
                      <th className="p-4">Nhân sự</th>
                      <th className="p-4">Phòng ban</th>
                      <th className="p-4 rounded-tr-xl">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(event.participants || []).map((p: any) => {
                      const emp = p.employee || {};
                      const eid = emp._id || p.employee;
                      const att = attendanceMap[eid];
                      return (
                        <tr key={eid} className={cn("hover:bg-slate-50 transition-colors", att?.attended && "bg-emerald-50/30")}>
                          <td className="p-4">
                            <button
                              onClick={() => setAttendanceMap(prev => ({ ...prev, [eid]: { ...prev[eid], attended: !prev[eid]?.attended } }))}
                              className="focus:outline-none"
                            >
                              {att?.attended
                                ? <CheckCircle2 className="w-7 h-7 text-emerald-500 drop-shadow-sm" />
                                : <div className="w-7 h-7 rounded-full border-2 border-slate-200 hover:border-emerald-300 transition-colors flex items-center justify-center"></div>
                              }
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                                {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt="" /> : (emp.name?.charAt(0) || '?')}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{emp.name || 'N/A'}</p>
                                <p className="text-xs text-slate-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {emp.department || '—'}
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              placeholder="Ghi chú vắng mặt..."
                              value={att?.note || ''}
                              onChange={e => setAttendanceMap(prev => ({ ...prev, [eid]: { ...prev[eid], note: e.target.value } }))}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EDIT */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveEdit} className="space-y-6 animate-in fade-in max-w-3xl">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Tên sự kiện</label>
              <input
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Mô tả</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Ngày diễn ra</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Cơ sở</label>
                <select
                  value={editForm.campus}
                  onChange={e => setEditForm({ ...editForm, campus: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Trạng thái</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <hr className="border-slate-100 my-6" />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700">Quản lý nhân sự tham gia</label>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">{selectedEmps.length} đã chọn</span>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 bg-slate-50">
                  {employees.map(emp => (
                    <label key={emp._id} className={cn("flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors", selectedEmps.includes(emp._id) && "bg-white")}>
                      <input
                        type="checkbox"
                        checked={selectedEmps.includes(emp._id)}
                        onChange={() => toggleEmp(emp._id)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                        {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt="" /> : emp.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.department} · {emp.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">Lưu ý: Bỏ chọn nhân viên sẽ xóa thông tin điểm danh của họ trong sự kiện này.</p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingEdit}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
              >
                {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
