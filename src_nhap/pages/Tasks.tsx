import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Search, Filter, Calendar, CheckCircle2, Clock, AlertCircle,
  Plus, Layers, LayoutGrid, ListFilter, CalendarDays, User, ArrowRight, X,
  Check, Play, MessageSquare, AlertTriangle, FileText, ChevronRight, BarChart2
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const AGILE_STAGES = [
  { id: 'backlog', label: 'Backlog / Chờ xử lý', color: 'bg-slate-100 text-slate-700 border-slate-200', colBg: 'bg-slate-50/70 border-slate-200' },
  { id: 'todo', label: 'Cần làm (To Do)', color: 'bg-blue-50 text-blue-700 border-blue-200', colBg: 'bg-blue-50/40 border-blue-100' },
  { id: 'in_progress', label: 'Đang thực hiện (In Progress)', color: 'bg-amber-50 text-amber-700 border-amber-200', colBg: 'bg-amber-50/40 border-amber-100' },
  { id: 'review', label: 'Chờ kiểm duyệt (Review)', color: 'bg-purple-50 text-purple-700 border-purple-200', colBg: 'bg-purple-50/40 border-purple-100' },
  { id: 'done', label: 'Hoàn thành (Done)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', colBg: 'bg-emerald-50/40 border-emerald-100' }
];

const PRIORITY_MAP: Record<string, { label: string; badge: string }> = {
  urgent: { label: 'Khẩn cấp', badge: 'bg-rose-500 text-white' },
  highest: { label: 'Rất cao', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  high: { label: 'Cao', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  medium: { label: 'Trung bình', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  low: { label: 'Thấp', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  lowest: { label: 'Rất thấp', badge: 'bg-slate-100 text-slate-400 border-slate-200' }
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: kanban, agile, schedule, list
  const [viewMode, setViewMode] = useState<'kanban' | 'agile' | 'schedule' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStage, setFilterStage] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    agileStage: 'todo',
    progress: 0,
    assignee: '',
    startDate: '',
    dueDate: '',
    estimatedHours: 0
  });

  // Progress Note input inside task detail modal
  const [noteContent, setNoteContent] = useState('');
  const [noteProgress, setNoteProgress] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resTasks, resUsers] = await Promise.all([
        apiClient.get('/tasks'),
        apiClient.get('/users').catch(() => ({ data: { data: [] } }))
      ]);

      if (resTasks.data.success) {
        setTasks(resTasks.data.data);
      }
      if (resUsers.data?.data) {
        setUsersList(resUsers.data.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error("Không thể tải danh sách công việc");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setSelectedTask(null);
    setTaskForm({
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      agileStage: 'todo',
      progress: 0,
      assignee: user?._id || user?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      estimatedHours: 8
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task: any) => {
    setSelectedTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      type: task.type || 'task',
      priority: task.priority || 'medium',
      agileStage: task.agileStage || 'todo',
      progress: task.progress || 0,
      assignee: task.assignee?._id || task.assignee || '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      estimatedHours: task.estimatedHours || 0
    });
    setNoteProgress(task.progress || 0);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      return toast.error("Vui lòng nhập tên công việc");
    }

    try {
      setSubmitting(true);
      if (selectedTask) {
        const res = await apiClient.put(`/tasks/${selectedTask._id}`, taskForm);
        if (res.data.success) {
          toast.success("Đã cập nhật công việc!");
          setIsModalOpen(false);
          fetchData();
        }
      } else {
        const res = await apiClient.post('/tasks', taskForm);
        if (res.data.success) {
          toast.success("Đã giao công việc mới thành công!");
          setIsModalOpen(false);
          fetchData();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể lưu công việc");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStage = async (taskId: string, newStage: string) => {
    try {
      const res = await apiClient.put(`/tasks/${taskId}`, { agileStage: newStage });
      if (res.data.success) {
        setTasks(prev => prev.map(t => t._id === taskId ? res.data.data : t));
        toast.success(`Chuyển trạng thái sang "${AGILE_STAGES.find(s => s.id === newStage)?.label}"`);
      }
    } catch (err) {
      toast.error("Không thể đổi trạng thái công việc");
    }
  };

  const handleAddProgressNote = async (taskId: string) => {
    if (!noteContent.trim()) {
      return toast.error("Vui lòng nhập nội dung ghi chú tiến độ");
    }

    try {
      const res = await apiClient.post(`/tasks/${taskId}/progress-notes`, {
        content: noteContent,
        progress: noteProgress
      });

      if (res.data.success) {
        toast.success("Đã cập nhật nhật ký tiến độ!");
        setSelectedTask(res.data.data);
        setNoteContent('');
        fetchData();
      }
    } catch (err) {
      toast.error("Không thể ghi nhận nhật ký tiến độ");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Xác nhận xóa nhiệm vụ này?")) return;
    try {
      const res = await apiClient.delete(`/tasks/${taskId}`);
      if (res.data.success) {
        toast.success("Đã xóa nhiệm vụ");
        if (selectedTask?._id === taskId) setIsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      toast.error("Không thể xóa nhiệm vụ");
    }
  };

  // Filtering
  const filteredTasks = tasks.filter(t => {
    const matchSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (t.key || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchAssignee = filterAssignee === 'all' || (t.assignee?._id || t.assignee) === filterAssignee;
    const matchStage = filterStage === 'all' || t.agileStage === filterStage;
    return matchSearch && matchAssignee && matchStage;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest mb-1">
            <Layers className="w-4 h-4" /> Quản lý Công việc Nhân sự & Agile Project
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Công việc & Tiến độ</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Phân công nhiệm vụ, theo dõi tiến độ %, giao diện Kanban Agile & Lịch hoàn thiện.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-2xl flex border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Giao diện Kanban Board"
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('agile')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'agile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Giao diện Agile Quy trình"
            >
              <BarChart2 className="w-4 h-4" /> Agile
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Giao diện Lịch hoàn thiện"
            >
              <CalendarDays className="w-4 h-4" /> Lịch Schedule
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Danh sách Table"
            >
              <ListFilter className="w-4 h-4" /> Danh sách
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-3 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 shrink-0 text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Giao Việc Mới
          </button>
        </div>
      </header>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên công việc..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
          >
            <option value="all">-- Lọc theo Người thực hiện (Tất cả) --</option>
            {usersList.map(u => (
              <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
          >
            <option value="all">-- Tất cả giai đoạn Quy trình --</option>
            {AGILE_STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* 1. KANBAN BOARD VIEW */}
          {(viewMode === 'kanban' || viewMode === 'agile') && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
              {AGILE_STAGES.map(stage => {
                const stageTasks = filteredTasks.filter(t => (t.agileStage || 'todo') === stage.id);
                return (
                  <div key={stage.id} className={`rounded-3xl p-4 border flex flex-col justify-between space-y-4 min-w-[240px] ${stage.colBg}`}>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-200/60">
                        <span className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase border ${stage.color}`}>
                          {stage.label}
                        </span>
                        <span className="bg-white border border-slate-200 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                          {stageTasks.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {stageTasks.map(task => {
                          const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.agileStage !== 'done';

                          return (
                            <div
                              key={task._id}
                              onClick={() => openEditModal(task)}
                              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer space-y-3 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${pri.badge}`}>
                                  {pri.label}
                                </span>
                                {isOverdue && (
                                  <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-rose-200">
                                    <AlertTriangle className="w-3 h-3" /> Trễ hạn
                                  </span>
                                )}
                              </div>

                              <h4 className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors">
                                {task.title}
                              </h4>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-black text-slate-500">
                                  <span>Tiến độ</span>
                                  <span className="text-indigo-600">{task.progress || 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                                    style={{ width: `${task.progress || 0}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Assignee & Dates */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                                    {task.assignee?.fullName?.charAt(0) || 'U'}
                                  </div>
                                  <span className="font-bold text-slate-700 truncate max-w-[100px]">
                                    {task.assignee?.fullName || 'Chưa giao'}
                                  </span>
                                </div>

                                {task.dueDate && (
                                  <span className="font-bold text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(task.dueDate).toLocaleDateString('vi-VN')}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {stageTasks.length === 0 && (
                          <div className="py-8 text-center text-xs text-slate-400 italic border-2 border-dashed border-slate-200 rounded-2xl">
                            Trống
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. SCHEDULE / CALENDAR TIMELINE VIEW */}
          {viewMode === 'schedule' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-600" /> Lịch Trình Hoàn Thành Nhiệm Vụ (Schedule Timeline)
                </h3>
                <span className="text-xs font-bold text-slate-400">TỔNG SỐ: {filteredTasks.length} CÔNG VIỆC</span>
              </div>

              <div className="space-y-4">
                {filteredTasks.map(task => {
                  const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.agileStage !== 'done';
                  const stage = AGILE_STAGES.find(s => s.id === (task.agileStage || 'todo'));

                  return (
                    <div
                      key={task._id}
                      onClick={() => openEditModal(task)}
                      className="bg-slate-50 hover:bg-indigo-50/50 p-5 rounded-2xl border border-slate-200 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm ${
                          task.agileStage === 'done' ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-indigo-600'
                        }`}>
                          {task.progress || 0}%
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${pri.badge}`}>
                              {pri.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${stage?.color}`}>
                              {stage?.label}
                            </span>
                            {isOverdue && (
                              <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md">
                                Trễ hạn
                              </span>
                            )}
                          </div>

                          <h4 className="font-black text-slate-900 text-base">{task.title}</h4>
                          <p className="text-xs text-slate-500 font-medium truncate max-w-md mt-0.5">
                            {task.description || 'Không có mô tả chi tiết'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs shrink-0">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase">Người thực hiện</p>
                          <p className="font-extrabold text-slate-800">{task.assignee?.fullName || 'Chưa phân công'}</p>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase">Thời gian thực hiện</p>
                          <p className="font-extrabold text-slate-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            {task.startDate ? new Date(task.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không hạn'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. TABLE / LIST VIEW */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Tên công việc</th>
                    <th className="px-6 py-4">Giai đoạn</th>
                    <th className="px-6 py-4">Ưu tiên</th>
                    <th className="px-6 py-4">Tiến độ %</th>
                    <th className="px-6 py-4">Người thực hiện</th>
                    <th className="px-6 py-4">Hạn hoàn thành</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {filteredTasks.map(task => {
                    const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                    const stage = AGILE_STAGES.find(s => s.id === (task.agileStage || 'todo'));

                    return (
                      <tr key={task._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-slate-900 text-sm">{task.title}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{task.key || 'TASK'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase ${stage?.color}`}>
                            {stage?.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${pri.badge}`}>
                            {pri.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${task.progress || 0}%` }}></div>
                            </div>
                            <span className="font-black text-slate-700">{task.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {task.assignee?.fullName || 'Chưa giao'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-600">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không hạn'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditModal(task)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition-all"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* CREATE & EDIT TASK MODAL WITH PROGRESS NOTES LOG */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-3xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                {selectedTask ? `Chi tiết & Cập nhật Công việc #${selectedTask.key || ''}` : 'Giao Công Việc Nhân Sự Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">Tên công việc / Nhiệm vụ</label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Thiết kế bộ tài liệu tuyển sinh khóa Hè STEAM..."
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">Người thực hiện (Assignee)</label>
                  <select
                    value={taskForm.assignee}
                    onChange={e => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="">-- Chưa chọn người giao --</option>
                    {usersList.map(u => (
                      <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">Giai đoạn Agile</label>
                  <select
                    value={taskForm.agileStage}
                    onChange={e => setTaskForm({ ...taskForm, agileStage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                  >
                    {AGILE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">Độ ưu tiên</label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                  >
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DATES & PROGRESS SLIDER */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={e => setTaskForm({ ...taskForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">Hạn hoàn thiện (Deadline)</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-slate-600 uppercase">Tiến độ %</label>
                    <span className="text-xs font-black text-indigo-600">{taskForm.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={taskForm.progress}
                    onChange={e => setTaskForm({ ...taskForm, progress: Number(e.target.value) })}
                    className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">Mô tả công việc</label>
                <textarea
                  rows={3}
                  placeholder="Ghi rõ chi tiết yêu cầu công việc..."
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {selectedTask && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(selectedTask._id)}
                    className="py-3.5 px-5 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100"
                  >
                    Xóa công việc
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {submitting ? "Đang lưu..." : selectedTask ? "Lưu Cập Nhật" : "Giao Việc Mới"}
                </button>
              </div>
            </form>

            {/* PROGRESS NOTES HISTORY SECTION (Chỉ hiện khi xem chi tiết công việc đã có) */}
            {selectedTask && (
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" /> Nhật ký & Ghi chú Tiến độ Công việc
                </h4>

                {/* Form thêm ghi chú tiến độ */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-slate-700">Cập nhật tiến độ % mới cho nhiệm vụ:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={noteProgress}
                        onChange={e => setNoteProgress(Number(e.target.value))}
                        className="w-32 accent-indigo-600 h-2"
                      />
                      <span className="text-xs font-black text-indigo-600 w-8">{noteProgress}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ghi chú kết quả thực hiện (Ví dụ: Đã hoàn thành 50% thiết kế Slide...)"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddProgressNote(selectedTask._id); }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddProgressNote(selectedTask._id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shrink-0"
                    >
                      Ghi nhật ký
                    </button>
                  </div>
                </div>

                {/* Danh sách ghi chú */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {(selectedTask.progressNotes || []).map((note: any, idx: number) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{note.user?.fullName || 'Thành viên'}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Tiến độ: {note.progressAtNote}%
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 font-medium">{note.content}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(note.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  ))}
                  {(!selectedTask.progressNotes || selectedTask.progressNotes.length === 0) && (
                    <p className="text-xs text-slate-400 italic text-center py-2">Chưa có nhật ký ghi chú tiến độ nào.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
