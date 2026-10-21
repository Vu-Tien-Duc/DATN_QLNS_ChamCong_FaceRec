import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, Plus, MapPin, Users, Loader2, ChevronRight,
  Clock, CheckCircle2, Ban, Trash2, Search, Building2, CalendarDays,
  LayoutGrid, List as ListIcon, FileText, BarChart3, Award, Sparkles,
  UserCheck, XCircle
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function cn(...inputs: any[]) { return inputs.filter(Boolean).join(' '); }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  Upcoming:  { label: 'Sắp diễn ra', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     icon: Clock },
  Ongoing:   { label: 'Đang diễn ra', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200',   icon: CalendarCheck },
  Completed: { label: 'Hoàn thành',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  Cancelled: { label: 'Đã hủy',       color: 'text-red-500',   bg: 'bg-red-50 border-red-200',       icon: Ban },
};

export default function Events() {
  const [activeTab, setActiveTab] = useState<'list' | 'monthly-stats'>('list');

  const [events, setEvents] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  
  // Monthly Stats State
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [monthlyStatsData, setMonthlyStatsData] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchParticipant, setSearchParticipant] = useState('');
  const [selectedParticipantDetail, setSelectedParticipantDetail] = useState<any | null>(null);

  const navigate = useNavigate();

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const res = await apiClient.get('/events', { params });
      setEvents(res.data.data || []);
    } catch { toast.error('Lỗi tải sự kiện'); }
    finally { setLoading(false); }
  };

  const fetchMonthlyStats = async () => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get(`/events/monthly-stats?month=${statsMonth}&year=${statsYear}`);
      if (res.data.success) {
        setMonthlyStatsData(res.data.data);
      }
    } catch { toast.error('Lỗi tải thống kê tháng'); }
    finally { setLoadingStats(false); }
  };

  const fetchMeta = async () => {
    try {
      const [c, e] = await Promise.all([apiClient.get('/campuses'), apiClient.get('/employees')]);
      setCampuses(c.data.data || []);
      setEmployees(e.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchEvents(); }, [filterStatus]);
  useEffect(() => {
    if (activeTab === 'monthly-stats') {
      fetchMonthlyStats();
    }
  }, [activeTab, statsMonth, statsYear]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get('title'),
      description: fd.get('description'),
      date: fd.get('date'),
      campus: fd.get('campus'),
      status: fd.get('status') || 'Upcoming',
      participants: selectedEmps.map(id => ({ employee: id, attended: false, note: '' })),
    };
    if (selectedEmps.length === 0) { toast.error('Vui lòng chọn ít nhất 1 nhân viên'); return; }
    try {
      const res = await apiClient.post('/events', payload);
      if (res.data.success) {
        toast.success('Tạo sự kiện thành công');
        setIsCreateOpen(false);
        setSelectedEmps([]);
        fetchEvents();
      }
    } catch (err: any) { toast.error(err.response?.data?.message || 'Lỗi tạo sự kiện'); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    try {
      await apiClient.delete(`/events/${id}`);
      toast.success('Đã xóa sự kiện');
      fetchEvents();
    } catch { toast.error('Lỗi xóa sự kiện'); }
  };

  const toggleEmp = (id: string) => {
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredEmps = employees.filter(emp =>
    emp.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.email?.toLowerCase().includes(empSearch.toLowerCase())
  );

  const filteredParticipants = (monthlyStatsData?.participants || []).filter((p: any) =>
    p.name?.toLowerCase().includes(searchParticipant.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchParticipant.toLowerCase()) ||
    p.department?.toLowerCase().includes(searchParticipant.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER & TAB SWITCH */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-emerald-500" /> Quản lý & Thống kê Sự kiện
          </h1>
          <p className="text-slate-500 text-sm mt-1">Danh sách sự kiện, theo dõi lượt tham gia & thống kê chi tiết theo tháng.</p>
        </div>

        {/* TAB BUTTONS */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'list' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <CalendarDays className="w-4 h-4" /> Danh sách sự kiện
          </button>
          <button
            onClick={() => setActiveTab('monthly-stats')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'monthly-stats' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" /> Thống kê theo Tháng
          </button>
        </div>
      </header>

      {/* CONTENT: TAB 1 (EVENT MANAGEMENT LIST) */}
      {activeTab === 'list' ? (
        <div className="space-y-6">
          {/* ACTION BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3 items-center">
              <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={cn("p-2.5 transition-colors", viewMode === 'grid' ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={cn("p-2.5 transition-colors", viewMode === 'list' ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}
                >
                  <ListIcon className="w-5 h-5" />
                </button>
              </div>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none shadow-sm"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <button
              onClick={() => { setIsCreateOpen(true); setSelectedEmps([]); setEmpSearch(''); }}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <Plus className="w-5 h-5" /> Tạo sự kiện mới
            </button>
          </div>

          {/* EVENTS LIST / GRID */}
          {loading ? (
            <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500 w-10 h-10" /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 bg-white border-2 border-dashed border-slate-100 rounded-3xl">
              <CalendarCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-lg">Chưa có sự kiện nào được tạo</p>
              <button 
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 text-emerald-600 font-bold hover:underline"
              >
                Tạo sự kiện đầu tiên
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {events.map(ev => {
                const sc = STATUS_CONFIG[ev.status] || STATUS_CONFIG.Upcoming;
                const Icon = sc.icon;
                const att = ev.participants?.filter((p: any) => p.attended).length || 0;
                const tot = ev.participants?.length || 0;
                return (
                  <div
                    key={ev._id}
                    onClick={() => navigate(`/events/${ev._id}`)}
                    className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-emerald-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", sc.bg, sc.color)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={cn("text-xs font-bold px-3 py-1 rounded-full border", sc.bg, sc.color)}>
                        {sc.label}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-900 mb-2 line-clamp-2">{ev.title}</h3>
                    
                    <div className="space-y-2 mt-4 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{new Date(ev.date).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{ev.campus?.name || 'Chưa xác định'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span><strong className="text-slate-800">{att}</strong> / {tot} đã tham gia</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, ev._id)}
                      className="absolute bottom-6 right-6 p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Xóa sự kiện"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="p-4 pl-6">Sự kiện</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Cơ sở</th>
                      <th className="p-4">Tham gia</th>
                      <th className="p-4">Ngày diễn ra</th>
                      <th className="p-4 pr-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map(ev => {
                      const sc = STATUS_CONFIG[ev.status] || STATUS_CONFIG.Upcoming;
                      const Icon = sc.icon;
                      const att = ev.participants?.filter((p: any) => p.attended).length || 0;
                      const tot = ev.participants?.length || 0;
                      return (
                        <tr 
                          key={ev._id} 
                          onClick={() => navigate(`/events/${ev._id}`)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", sc.bg, sc.color)}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="font-bold text-slate-900 text-sm max-w-[300px] truncate">{ev.title}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn("text-xs font-bold px-3 py-1 rounded-full border inline-block", sc.bg, sc.color)}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-600 truncate max-w-[200px]">
                            {ev.campus?.name}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: tot ? `${(att/tot)*100}%` : '0%' }}></div>
                              </div>
                              <span className="text-xs font-bold text-slate-600">{att}/{tot}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-600">
                            {new Date(ev.date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <button
                              onClick={(e) => handleDelete(e, ev._id)}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CONTENT: TAB 2 (MONTHLY EVENT STATISTICS REPORT) */
        <div className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <p className="text-xs text-emerald-100 font-bold uppercase tracking-wider">Tổng Sự kiện Trong Tháng</p>
              <p className="text-3xl font-black mt-2">
                {monthlyStatsData?.totalEventsThisMonth || 0} <span className="text-sm font-bold text-emerald-200">sự kiện</span>
              </p>
              <p className="text-xs text-emerald-200 mt-2">
                Hoàn thành: <strong>{monthlyStatsData?.completedEventsCount || 0}</strong> • Sắp diễn ra: <strong>{monthlyStatsData?.upcomingEventsCount || 0}</strong>
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng Lượt Tham Dự Sự Kiện</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">
                  {monthlyStatsData?.totalAttendedCount || 0} <span className="text-sm font-bold text-slate-500">lượt</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Số Người Tham Gia Duy Nhất</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">
                  {monthlyStatsData?.uniqueParticipantsCount || 0} <span className="text-sm font-bold text-slate-500">người</span>
                </p>
              </div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên người tham gia, email..."
                value={searchParticipant}
                onChange={e => setSearchParticipant(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statsMonth}
                onChange={e => setStatsMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>

              <select
                value={statsYear}
                onChange={e => setStatsYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PARTICIPANTS ATTENDANCE TABLE */}
          <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingStats ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-bold text-base">Không có dữ liệu người tham gia sự kiện trong tháng này</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                      <th className="py-4 px-5">Người tham gia</th>
                      <th className="py-4 px-5">Phòng ban / Chức danh</th>
                      <th className="py-4 px-5 text-center">Số buổi Sự kiện Đã tham gia</th>
                      <th className="py-4 px-5 text-center">Tỷ lệ Tham gia</th>
                      <th className="py-4 px-5">Các Sự kiện Đã Đăng ký</th>
                      <th className="py-4 px-5 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.map((p: any, idx: number) => {
                      const ratePercent = p.registeredEventsCount ? Math.round((p.attendedEventsCount / p.registeredEventsCount) * 100) : 0;
                      return (
                        <tr key={`${p.employeeId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm overflow-hidden">
                                {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" alt="" /> : p.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-400">{p.email || p.phone}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-5">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                              {p.department || p.role || 'Nhân sự'}
                            </span>
                          </td>

                          <td className="py-4 px-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Award className="w-4 h-4 text-emerald-600" />
                              {p.attendedEventsCount} buổi có mặt
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5">trên tổng {p.registeredEventsCount} sự kiện</p>
                          </td>

                          <td className="py-4 px-5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ratePercent}%` }}></div>
                              </div>
                              <span className="text-xs font-bold text-slate-700">{ratePercent}%</span>
                            </div>
                          </td>

                          <td className="py-4 px-5">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.events?.map((ev: any, i: number) => (
                                <span 
                                  key={i} 
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[11px] font-bold border truncate max-w-[140px]",
                                    ev.attended 
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                                      : "bg-slate-50 text-slate-500 border-slate-200"
                                  )}
                                  title={`${ev.title} (${new Date(ev.date).toLocaleDateString('vi-VN')})`}
                                >
                                  {ev.attended ? '✓ ' : '✗ '}{ev.title}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-4 px-5 text-center">
                            <button
                              onClick={() => setSelectedParticipantDetail(selectedParticipantDetail?.employeeId === p.employeeId ? null : p)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all inline-flex items-center gap-1"
                            >
                              Chi tiết
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PARTICIPANT EVENT DETAILS MODAL / DRILLDOWN */}
          {selectedParticipantDetail && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 border-t-4 border-t-emerald-600">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-black text-xl text-slate-900">
                    Lịch sử tham gia sự kiện của {selectedParticipantDetail.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Đã có mặt {selectedParticipantDetail.attendedEventsCount} / {selectedParticipantDetail.registeredEventsCount} sự kiện trong Tháng {statsMonth}/{statsYear}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedParticipantDetail(null)}
                  className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full border border-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Tên Sự kiện</th>
                      <th className="py-3 px-4">Ngày diễn ra</th>
                      <th className="py-3 px-4">Cơ sở tổ chức</th>
                      <th className="py-3 px-4">Điểm danh</th>
                      <th className="py-3 px-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedParticipantDetail.events?.map((ev: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{ev.title}</td>
                        <td className="py-3 px-4 font-medium text-slate-600">
                          {new Date(ev.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-600 text-xs">{ev.campusName}</td>
                        <td className="py-3 px-4">
                          {ev.attended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đã có mặt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" /> Vắng mặt
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 italic">{ev.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo sự kiện mới">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" /> Tên sự kiện
            </label>
            <input name="title" required placeholder="VD: Teambuilding Q3 2026" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Mô tả</label>
            <textarea name="description" rows={2} placeholder="Ghi chú thêm về sự kiện..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" /> Ngày diễn ra
              </label>
              <input name="date" type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" /> Cơ sở
              </label>
              <select name="campus" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">-- Chọn cơ sở --</option>
                {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Trạng thái
            </label>
            <select name="status" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Employee multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Nhân viên tham gia ({selectedEmps.length} đã chọn)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm nhân viên..."
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
              />
            </div>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setSelectedEmps(employees.map(e => e._id))} className="text-xs text-emerald-600 font-bold hover:underline">Chọn tất cả</button>
              <button type="button" onClick={() => setSelectedEmps([])} className="text-xs text-red-500 font-bold hover:underline">Bỏ chọn tất cả</button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
              {filteredEmps.map(emp => (
                <label key={emp._id} className={cn("flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors", selectedEmps.includes(emp._id) && "bg-emerald-50/50")}>
                  <input
                    type="checkbox"
                    checked={selectedEmps.includes(emp._id)}
                    onChange={() => toggleEmp(emp._id)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                    {emp.avatar ? <img src={emp.avatar} className="w-full h-full object-cover" alt="" /> : emp.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{emp.department} · {emp.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Hủy</button>
            <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all">Tạo sự kiện</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
