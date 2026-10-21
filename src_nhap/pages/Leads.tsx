import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Filter, Phone, Mail, Edit2, Calendar, Trash2, Loader2,
  ChevronRight, ChevronLeft, MoreVertical, LayoutGrid, List,
  Star, MessageSquare, Clock, ArrowRight, User
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Modal } from '../components/Modal';
import { LeadForm } from '../components/forms/LeadForm';
import { LeadDetail } from '../components/LeadDetail';
import { StudentForm } from '../components/forms/StudentForm';
import { EnrollmentForm } from '../components/forms/EnrollmentForm';
import { InvoiceForm } from '../components/forms/InvoiceForm';
import { AppointmentForm } from '../components/forms/AppointmentForm';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

const STAGES = [
  { id: 'New Lead', title: 'Mới', color: 'bg-emerald-500' },
  { id: 'Contacted', title: 'Đã liên hệ', color: 'bg-blue-500' },
  { id: 'Interested', title: 'Quan tâm', color: 'bg-purple-500' },
  { id: 'Trial class', title: 'Học thử', color: 'bg-amber-500' },
  { id: 'Qualified Lead', title: 'Tiềm năng', color: 'bg-indigo-500' },
  { id: 'Converted', title: 'Đã chuyển đổi', color: 'bg-green-500' },
  { id: 'Lost', title: 'Thất bại', color: 'bg-rose-500' }
];

export default function Leads() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timePreset, setTimePreset] = useState<'week' | 'month' | 'quarter' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [leadForAppointment, setLeadForAppointment] = useState<any>(null);

  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [conversionStep, setConversionStep] = useState<'profile' | 'enrollment' | 'invoice'>('profile');
  const [createdStudent, setCreatedStudent] = useState<any>(null);
  const [createdEnrollment, setCreatedEnrollment] = useState<any>(null);

  const calculateDates = useCallback((preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'week') {
      const day = now.getDay() || 7; // Sunday is 0, make it 7
      start.setDate(now.getDate() - day + 1); // Monday
      end.setDate(start.getDate() + 6); // Sunday
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (timePreset !== 'custom') {
      calculateDates(timePreset);
    }
  }, [timePreset, calculateDates]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        search: searchTerm,
        status: statusFilter,
        startDate: startDate,
        endDate: endDate
      });
      const res = await apiClient.get(`/leads?${params.toString()}`);
      if (res.data.success) {
        setLeads(res.data.data.data);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách Lead");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [resC, resCl] = await Promise.all([
        apiClient.get('/courses'),
        apiClient.get('/classes')
      ]);
      if (resC.data.success) setCourses(resC.data.data);
      if (resCl.data.success) setClasses(resCl.data.data);
    } catch (error) {
      console.error("Lỗi tải metadata");
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchMetadata();
  }, [fetchLeads, fetchMetadata]);

  // Group leads for Kanban
  const groupedLeads = useMemo(() => {
    const groups: any = {};
    STAGES.forEach(stage => groups[stage.id] = []);
    leads.forEach(lead => {
      if (groups[lead.status]) groups[lead.status].push(lead);
      else if (groups['New Lead']) groups['New Lead'].push(lead);
    });
    return groups;
  }, [leads]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;

    // Update local state for immediate feedback
    const updatedLeads = [...leads];
    const leadIdx = updatedLeads.findIndex(l => l._id === draggableId);
    if (leadIdx !== -1) {
      updatedLeads[leadIdx].status = newStatus;
      setLeads(updatedLeads);
    }

    try {
      await apiClient.put(`/leads/${draggableId}`, { status: newStatus });
      toast.success(`Đã chuyển sang: ${STAGES.find(s => s.id === newStatus)?.title}`);
    } catch (error) {
      toast.error("Không thể cập nhật trạng thái");
      fetchLeads(); // Revert on error
    }
  };

  const handleSaveLead = async (data: any) => {
    const isEdit = !!editingLead;
    const payload = { ...data };
    Object.keys(payload).forEach(key => {
      if (payload[key] === "" || payload[key] === null || payload[key] === undefined) delete payload[key];
    });
    if (payload.assignedTo && typeof payload.assignedTo === 'object') payload.assignedTo = payload.assignedTo._id;
    if (payload.source && typeof payload.source === 'object') payload.source = payload.source._id;

    try {
      const url = isEdit ? `/leads/${editingLead._id}` : '/leads';
      const method = isEdit ? 'put' : 'post';
      const res = await apiClient[method](url, payload);
      if (res.data.success) {
        toast.success(isEdit ? "Cập nhật thành công" : "Thêm mới thành công");
        setIsModalOpen(false);
        setEditingLead(null);
        fetchLeads();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi thao tác");
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm("Xóa Lead này?")) return;
    try {
      await apiClient.delete(`/leads/${id}`);
      toast.success("Đã xóa");
      fetchLeads();
    } catch (error) {
      toast.error("Xóa thất bại");
    }
  };

  const handleSaveAppointment = async (formData: any) => {
    try {
      const res = await apiClient.post('/appointments', formData);
      if (res.data.success) {
        toast.success("Đã đặt lịch hẹn!");
        if (formData.type === 'Test') {
          await apiClient.put(`/leads/${formData.lead}`, { testAppointmentTime: formData.appointmentTime });
        }
        setIsAppointmentModalOpen(false);
        fetchLeads();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi tạo cuộc hẹn");
    }
  };

  const handleProfileSubmit = async (studentData: any) => {
    try {
      const leadId = selectedLead._id || selectedLead.id;
      const res = await apiClient.post(`/leads/${leadId}/convert`, studentData);
      if (res.data.success) {
        setCreatedStudent(res.data.data);
        setConversionStep('enrollment');
      }
    } catch (error: any) {
      toast.error("Lỗi tạo hồ sơ học viên");
    }
  };

  const handleEnrollmentSubmit = async (enrollData: any) => {
    try {
      const res = await apiClient.post('/enrollments', enrollData);
      if (res.data.success) {
        setCreatedEnrollment(res.data.data);
        setConversionStep('invoice');
      }
    } catch (error: any) {
      toast.error("Lỗi ghi danh khóa học");
    }
  };

  const handleInvoiceSubmit = async (paymentData: any) => {
    try {
      const enrollmentId = createdEnrollment?._id || createdEnrollment?.id;
      if (!enrollmentId) return toast.error("Mã ghi danh không hợp lệ");
      const res = await apiClient.post(`/tuitions/enrollment/${enrollmentId}/collect`, paymentData);
      if (res.data.success) {
        toast.success("Hoàn tất nhập học");
        setIsConversionModalOpen(false);
        setSelectedLead(null);
        setCreatedStudent(null);
        setCreatedEnrollment(null);
        setConversionStep('profile');
        fetchLeads();
      }
    } catch (error: any) {
      toast.error("Lỗi hạch toán tài chính");
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col space-y-4">
      {/* PROFESSIONAL HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            CRM Pipeline <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-lg">LIVE</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Hệ thống quản lý phễu khách hàng chuyên nghiệp</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => { setEditingLead(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
          >
            <Plus className="w-4 h-4" /> Tạo mới
          </button>
        </div>
      </header>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white px-6 py-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm Lead theo tên, SĐT, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-full md:w-auto">
            {(['week', 'month', 'quarter', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setTimePreset(p)}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timePreset === p ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Tùy chọn'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setTimePreset('custom'); }}
                className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 focus:ring-0 w-28"
              />
            </div>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setTimePreset('custom'); }}
                className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 focus:ring-0 w-28"
              />
            </div>
          </div>

          <div className="h-6 w-px bg-slate-100 hidden md:block" />

          <div className="flex items-center gap-2">
            <select
              className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KANBAN PIPELINE */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 min-w-max h-full">
              {STAGES.map(stage => (
                <div key={stage.id} className="w-80 flex flex-col bg-slate-50/50 rounded-[2.5rem] p-3 border border-slate-100/50">
                  <div className="flex items-center justify-between px-4 py-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-6 rounded-full ${stage.color}`} />
                      <h2 className="font-black text-slate-800 text-sm uppercase tracking-tighter">{stage.title}</h2>
                      <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-400 border border-slate-100 shadow-sm">
                        {groupedLeads[stage.id]?.length || 0}
                      </span>
                    </div>
                    <MoreVertical className="w-4 h-4 text-slate-300" />
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 space-y-4 px-1 pb-4 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/30' : ''}`}
                      >
                        {groupedLeads[stage.id]?.map((lead: any, index: number) => (
                          <Draggable key={lead._id} draggableId={lead._id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedLead(lead)}
                                className={`bg-white p-5 rounded-xs border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group cursor-pointer relative overflow-hidden ${snapshot.isDragging ? 'rotate-2 shadow-2xl ring-2 ring-indigo-500' : ''}`}
                              >
                                {lead.temperature && (
                                  <div className="absolute top-0 right-0 p-3 flex gap-0.5">
                                    {[...Array(lead.temperature === 'Hot' ? 3 : lead.temperature === 'Warm' ? 2 : 1)].map((_, i) => (
                                      <Star key={i} className={`w-2.5 h-2.5 ${lead.temperature === 'Hot' ? 'text-rose-500 fill-rose-500' : lead.temperature === 'Warm' ? 'text-amber-500 fill-amber-500' : 'text-blue-400 fill-blue-400'}`} />
                                    ))}
                                  </div>
                                )}

                                <div className="space-y-3">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{lead.name}</h4>
                                  </div>

                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                                      <MessageSquare className="w-3 h-3" />
                                      {lead.courseInterest || 'Chưa chọn khóa'}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                      <Phone className="w-3 h-3 text-indigo-400" />
                                      {lead.phone}
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center -space-x-1.5">
                                      {lead.assignedTo ? (
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[8px] font-black text-indigo-600 border border-white ring-1 ring-indigo-100" title={lead.assignedTo.fullName}>
                                          {lead.assignedTo.fullName?.charAt(0)}
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border border-white">
                                          <User className="w-3 h-3" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); setLeadForAppointment(lead); setIsAppointmentModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Calendar className="w-3.5 h-3.5" /></button>
                                      <button onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-8 py-5">Khách hàng</th>
                  <th className="px-8 py-5">Khóa quan tâm</th>
                  <th className="px-8 py-5">Trạng thái</th>
                  <th className="px-8 py-5">Phụ trách</th>
                  <th className="px-8 py-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-indigo-50/20 transition-colors group cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-900 text-sm">{lead.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{lead.phone} • {lead.email || 'N/A'}</div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">{lead.courseInterest}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-4 rounded-full ${STAGES.find(s => s.id === lead.status)?.color || 'bg-slate-300'}`} />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{STAGES.find(s => s.id === lead.status)?.title || lead.status}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {lead.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 border border-indigo-100">{lead.assignedTo.fullName?.charAt(0)}</div>
                          <span className="text-xs font-bold text-slate-600">{lead.assignedTo.fullName}</span>
                        </div>
                      ) : <span className="text-[10px] text-slate-300 italic">Chưa gán</span>}
                    </td>
                    <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setLeadForAppointment(lead); setIsAppointmentModalOpen(true); }} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Calendar className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingLead(lead); setIsModalOpen(true); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteLead(lead._id)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODALS (Unchanged logic, just ensure they are clean) --- */}
      <Modal isOpen={isModalOpen || !!editingLead} onClose={() => { setIsModalOpen(false); setEditingLead(null); }} title={editingLead ? "Cập nhật Lead" : "Thêm khách hàng tiềm năng"}>
        <LeadForm initialData={editingLead} onSubmit={handleSaveLead} onCancel={() => { setIsModalOpen(false); setEditingLead(null); }} />
      </Modal>

      <Modal
        isOpen={!!selectedLead && !isConversionModalOpen}
        onClose={() => setSelectedLead(null)}
        title={`Hồ sơ chi tiết: ${selectedLead?.name}`}
      >
        {selectedLead && (
          <LeadDetail
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead); }}
            onConvertToStudent={(lead) => {
              setConversionStep('profile');
              setIsConversionModalOpen(true);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={isAppointmentModalOpen} onClose={() => setIsAppointmentModalOpen(false)} title="Lên lịch hẹn làm việc">
        <AppointmentForm lead={leadForAppointment} onSubmit={handleSaveAppointment} onCancel={() => setIsAppointmentModalOpen(false)} />
      </Modal>

      <Modal isOpen={isConversionModalOpen} onClose={() => setIsConversionModalOpen(false)} title="Quy trình chuyển đổi & Nhập học">
        <div className="space-y-8">
          <div className="flex justify-between relative px-20">
            <div className="absolute top-1/2 left-20 right-20 h-px bg-slate-100 -translate-y-1/2" />
            {['profile', 'enrollment', 'invoice'].map((step, idx) => (
              <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${conversionStep === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-50 shadow-lg' : (idx < ['profile', 'enrollment', 'invoice'].indexOf(conversionStep) ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 border border-slate-100')}`}>
                  {idx + 1}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${conversionStep === step ? 'text-indigo-600' : 'text-slate-400'}`}>{step}</span>
              </div>
            ))}
          </div>

          {conversionStep === 'profile' && <StudentForm initialData={selectedLead} onSubmit={handleProfileSubmit} onCancel={() => setIsConversionModalOpen(false)} />}
          {conversionStep === 'enrollment' && <EnrollmentForm courses={courses} classes={classes} initialStudent={createdStudent} onSubmit={handleEnrollmentSubmit} onCancel={() => setIsConversionModalOpen(false)} />}
          {conversionStep === 'invoice' && <InvoiceForm invoice={createdEnrollment} onSubmit={handleInvoiceSubmit} onCancel={() => setIsConversionModalOpen(false)} />}
        </div>
      </Modal>
    </div>
  );
}