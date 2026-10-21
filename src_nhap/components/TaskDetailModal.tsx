import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Type, 
  AlignLeft, 
  User, 
  Flag, 
  Calendar, 
  MessageSquare, 
  History, 
  Send,
  MoreVertical,
  Trash2,
  Paperclip
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { tokenStorage } from '../utils/tokenStorage';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  onTaskUpdate?: () => void;
}

export default function TaskDetailModal({ isOpen, onClose, taskId, onTaskUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [users, setUsers] = useState<any[]>([]);

  const fetchTaskDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tasks/${taskId}`);
      if (res.data.success) {
        setTask(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching task detail:', error);
      toast.error("Không thể tải chi tiết công việc");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await apiClient.get(`/tasks/${taskId}/activities`);
      if (res.data.success) {
        setActivities(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [taskId]);

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
    if (isOpen && taskId) {
      fetchTaskDetail();
      fetchActivities();
      fetchUsers();
    }
  }, [isOpen, taskId, fetchTaskDetail, fetchActivities, fetchUsers]);



  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const user = tokenStorage.getUser();
      const res = await apiClient.post(`/tasks/${taskId}/comments`, {
        content: newComment,
        userId: user?._id || user?.id
      });
      
      if (res.data.success) {
        setNewComment('');
        fetchActivities();
        toast.success("Đã thêm bình luận");
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Không thể thêm bình luận");
    }
  };

  const updateTaskField = async (field: string, value: any) => {
    try {
      const user = tokenStorage.getUser();
      const res = await apiClient.put(`/tasks/${taskId}`, {
        [field]: value,
        userId: user?._id || user?.id
      });
      
      if (res.data.success) {
        fetchTaskDetail();
        fetchActivities();
        if (onTaskUpdate) onTaskUpdate();
        toast.success("Đã cập nhật công việc");
      }
    } catch (error) {
      console.error(`Error updating task ${field}:`, error);
      toast.error("Lỗi khi cập nhật");
    }
  };

  if (!isOpen || !task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-wider">{task.key}</span>
          <span className="text-slate-300">/</span>
          <span className="truncate max-w-[400px]">{task.title}</span>
        </div>
      }
      maxWidth="max-w-5xl"
    >
      <div className="flex flex-col md:flex-row gap-8 h-[70vh]">
        {/* Left Content: Description & Activities */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <AlignLeft className="w-4 h-4" />
              Mô tả
            </div>
            <textarea
              defaultValue={task.description}
              onBlur={(e) => updateTaskField('description', e.target.value)}
              placeholder="Thêm mô tả chi tiết cho công việc này..."
              className="w-full p-4 bg-slate-50 border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl transition-all outline-none text-slate-700 min-h-[150px] resize-none"
            />
          </div>

          {/* Activity / Comments Section */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100">
              <div className="flex gap-6">
                <button 
                  onClick={() => setTab('comments')}
                  className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all ${tab === 'comments' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Bình luận
                </button>
                <button 
                  onClick={() => setTab('history')}
                  className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all ${tab === 'history' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'}`}
                >
                  <History className="w-4 h-4" />
                  Lịch sử
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {tab === 'comments' ? (
                <>
                  <form onSubmit={handleAddComment} className="flex gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {tokenStorage.getUser()?.fullName?.charAt(0)}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Viết bình luận..."
                        className="w-full pl-4 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                      />
                      <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                  {activities.filter(a => a.type === 'comment').map((comment) => (
                    <div key={comment._id} className="flex gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        <img src={comment.user?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 bg-slate-50 p-3 rounded-2xl group-hover:bg-slate-100 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">{comment.user?.fullName}</span>
                          <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        <p className="text-sm text-slate-700">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity._id} className="flex items-start gap-3 pl-2 border-l-2 border-slate-100 py-1">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <History className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-900">{activity.user?.fullName}</span>
                        <span className="text-slate-500"> </span>
                        <span className="text-slate-500">
                          {activity.type === 'status_change' ? (
                            <>đã đổi trạng thái từ <span className="font-bold">{activity.oldValue}</span> sang <span className="font-bold text-emerald-600">{activity.newValue}</span></>
                          ) : (
                            activity.content
                          )}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(activity.createdAt).toLocaleString('vi-VN')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Attributes */}
        <div className="w-full md:w-64 flex flex-col gap-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</label>
            <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 border border-transparent">
              {task.status?.name}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Người thực hiện</label>
            <select
              value={task.assignee?._id || ''}
              onChange={(e) => updateTaskField('assignee', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Chưa phân công</option>
              {users.map((user: any) => (
                <option key={user._id} value={user._id}>
                  {user.fullName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Độ ưu tiên</label>
            <select
              value={task.priority}
              onChange={(e) => updateTaskField('priority', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="highest">Rất cao</option>
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
              <option value="lowest">Rất thấp</option>
            </select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hạn chót</label>
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => updateTaskField('dueDate', e.target.value)}
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
          </div>

          {/* Task Info */}
          <div className="mt-auto pt-6 border-t border-slate-100 space-y-2 text-[10px] text-slate-400 font-medium">
            <p>Tạo ngày: {new Date(task.createdAt).toLocaleDateString('vi-VN')}</p>
            <p>Cập nhật cuối: {new Date(task.updatedAt).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
