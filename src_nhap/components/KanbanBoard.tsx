import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Search, UserPlus } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import TaskCard from './TaskCard';
import { Modal } from './Modal';
import TaskDetailModal from './TaskDetailModal';
import { toast } from 'react-hot-toast';
import { tokenStorage } from '../utils/tokenStorage';

interface KanbanBoardProps {
  projectId: string;
  projectKey: string;
}

export default function KanbanBoard({ projectId, projectKey }: KanbanBoardProps) {
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newTask, setNewTask] = useState({ title: '', status: '', type: 'task', priority: 'medium', points: 0, assignee: '' });
  const [users, setUsers] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch statuses
      const statusRes = await apiClient.get('/task-statuses');
      const statuses = statusRes.data.data;

      // 2. Fetch tasks for this project
      const taskRes = await apiClient.get(`/tasks?projectId=${projectId}`);
      const tasks = taskRes.data.data;

      // 3. Group tasks by status
      const grouped = statuses.map((status: any) => ({
        ...status,
        tasks: tasks.filter((t: any) => t.status?._id === status._id)
      }));

      setColumns(grouped);
    } catch (error) {
      console.error('Error fetching board data:', error);
      toast.error("Không thể tải dữ liệu bảng");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [fetchData, fetchUsers]);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Local update for smoothness
    const startCol = columns.find(c => c._id === source.droppableId);
    const endCol = columns.find(c => c._id === destination.droppableId);

    if (startCol === endCol) {
      const newTasks = Array.from(startCol.tasks);
      const [removed] = newTasks.splice(source.index, 1);
      newTasks.splice(destination.index, 0, removed);
      
      const newCols = columns.map(c => c._id === startCol._id ? { ...c, tasks: newTasks } : c);
      setColumns(newCols);
    } else {
      const startTasks = Array.from(startCol.tasks);
      const [removed] = startTasks.splice(source.index, 1);
      const endTasks = Array.from(endCol.tasks);
      endTasks.splice(destination.index, 0, removed);

      const newCols = columns.map(c => {
        if (c._id === startCol._id) return { ...c, tasks: startTasks };
        if (c._id === endCol._id) return { ...c, tasks: endTasks };
        return c;
      });
      setColumns(newCols);
    }

    // Backend update
    try {
      await apiClient.put(`/tasks/${draggableId}`, {
        status: destination.droppableId
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error("Lỗi khi cập nhật trạng thái");
      fetchData(); // Rollback on error
    }
  };

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/task-statuses', {
        name: newColumnName,
        order: columns.length,
        category: 'inprogress' // default category
      });
      
      if (res.data.success) {
        setIsColumnModalOpen(false);
        setNewColumnName('');
        fetchData();
        toast.success("Thêm cột thành công");
      }
    } catch (error) {
      console.error('Error creating column:', error);
      toast.error("Không thể thêm cột");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = tokenStorage.getUser();
      const res = await apiClient.post('/tasks', {
        ...newTask,
        project: projectId,
        reporter: user?._id || user?.id
      });
      
      if (res.data.success) {
        setIsTaskModalOpen(false);
        fetchData();
        setNewTask({ title: '', status: '', type: 'task', priority: 'medium', points: 0, assignee: '' });
        toast.success("Tạo công việc thành công");
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error("Không thể tạo công việc");
    }
  };

  if (loading) return <div>Đang tải bảng...</div>;

  return (
    <div className="h-full flex flex-col">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          {columns.map((column) => (
            <div key={column._id} className="flex flex-col w-80 min-w-[320px] bg-slate-100/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{column.name}</h3>
                  <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full shadow-sm">
                    {column.tasks.length}
                  </span>
                </div>
                <button className="p-1 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <Droppable droppableId={column._id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto min-h-[150px] transition-colors rounded-xl ${snapshot.isDraggingOver ? 'bg-slate-200/50' : ''}`}
                  >
                    {column.tasks.map((task: any, index: number) => (
                      <Draggable key={task._id} draggableId={task._id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1
                            }}
                          >
                            <TaskCard 
                              task={task} 
                              onClick={() => {
                                setSelectedTaskId(task._id);
                                setIsDetailModalOpen(true);
                              }}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    <button
                      onClick={() => {
                        setNewTask({ ...newTask, status: column._id });
                        setIsTaskModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 p-2 mt-2 text-sm text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all group border border-transparent hover:border-emerald-200"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Tạo công việc
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          ))}
          
          <button 
            onClick={() => setIsColumnModalOpen(true)}
            className="h-fit flex items-center gap-2 px-4 py-3 min-w-[200px] bg-slate-100/50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all border-2 border-dashed border-slate-200 hover:border-emerald-200 group font-bold text-sm"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Thêm cột mới
          </button>
        </div>
      </DragDropContext>

      <TaskDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        taskId={selectedTaskId || ''}
        onTaskUpdate={fetchData}
      />

      <Modal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        title="Thêm cột mới"
      >
        <form onSubmit={handleCreateColumn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tên cột</label>
            <input
              required
              value={newColumnName}
              onChange={e => setNewColumnName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="VD: Đang kiểm thử, Tạm dừng..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsColumnModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Thêm cột
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Tạo công việc mới"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tiêu đề công việc</label>
            <input
              required
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="VD: Thiết kế giao diện Dashboard"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Loại</label>
              <select
                value={newTask.type}
                onChange={e => setNewTask({ ...newTask, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="task">Công việc (Task)</option>
                <option value="bug">Lỗi (Bug)</option>
                <option value="story">Câu chuyện (Story)</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Độ ưu tiên</label>
              <select
                value={newTask.priority}
                onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="highest">Rất cao</option>
                <option value="high">Cao</option>
                <option value="medium">Trung bình</option>
                <option value="low">Thấp</option>
                <option value="lowest">Rất thấp</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Story Points</label>
            <input
              type="number"
              value={newTask.points}
              onChange={e => setNewTask({ ...newTask, points: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="space-y-1">
  <label className="text-sm font-semibold text-slate-700">Người thực hiện</label>
  <select
    value={newTask.assignee}
    onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
  >
    <option value="">Chưa phân công</option>
    {users.map((user: any) => (
      <option key={user._id} value={user._id}>
        {user.fullName} ({user.email})
      </option>
    ))}
  </select>
</div>
<div className="flex gap-3 pt-4">
  <button
    type="button"
    onClick={() => setIsTaskModalOpen(false)}
    className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
  >
    Hủy
  </button>
  <button
    type="submit"
    className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
  >
    Tạo công việc
  </button>
</div>

        </form>
      </Modal>
    </div>
  );
}
