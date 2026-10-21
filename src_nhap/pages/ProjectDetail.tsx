import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  UserPlus, 
  MoreHorizontal,
  LayoutGrid,
  List as ListIcon,
  PieChart
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import KanbanBoard from '../components/KanbanBoard';
import ProjectStatistics from '../components/ProjectStatistics';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list' | 'timeline'>('board');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [editForm, setEditForm] = useState({ name: '', description: '', type: '', status: '' });

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${id}`);
      if (res.data.success) {
        setProject(res.data.data);
        setEditForm({
          name: res.data.data.name,
          description: res.data.data.description || '',
          type: res.data.data.type,
          status: res.data.data.status || 'active'
        });
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error("Không thể tải thông tin dự án");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.put(`/projects/${id}`, editForm);
      if (res.data.success) {
        toast.success("Cập nhật dự án thành công");
        setIsSettingsModalOpen(false);
        fetchProject();
      }
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error("Không thể cập nhật dự án");
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa dự án này? Toàn bộ công việc liên quan sẽ bị xóa.")) return;
    try {
      const res = await apiClient.delete(`/projects/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa dự án");
        window.location.href = '/projects';
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error("Không thể xóa dự án");
    }
  };

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
    if (id) fetchProject();
    fetchUsers();
  }, [id, fetchProject, fetchUsers]);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      const res = await apiClient.post(`/projects/${id}/members`, { userId: selectedUser });
      if (res.data.success) {
        toast.success("Thêm thành viên thành công");
        setIsMemberModalOpen(false);
        setSelectedUser('');
        fetchProject();
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error("Không thể thêm thành viên");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (!project) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-slate-900">Không tìm thấy dự án</h2>
      <Link to="/projects" className="text-emerald-600 hover:underline mt-2 inline-block">Quay lại danh sách dự án</Link>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 md:-m-8">
      {/* Project Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/projects" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              {project.key}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                {project.type === 'scrum' ? 'Scrum Project' : 'Kanban Project'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 mr-2">
              {project.members?.map((member: any) => (
                <div key={member._id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden" title={member.fullName}>
                  <img src={member.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} className="w-full h-full object-cover" />
                </div>
              ))}
              <button 
                onClick={() => setIsMemberModalOpen(true)}
                className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setView('board')}
              className={`flex items-center gap-2 px-1 py-2 text-sm font-medium border-b-2 transition-all ${view === 'board' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              Bảng công việc
            </button>
            {project.type === 'scrum' && (
              <button className="flex items-center gap-2 px-1 py-2 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700">
                <ListIcon className="w-4 h-4" />
                Backlog
              </button>
            )}
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-1 py-2 text-sm font-medium border-b-2 transition-all ${view === 'list' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <PieChart className="w-4 h-4" />
              Báo cáo & Thống kê
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                placeholder="Tìm kiếm công việc..."
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm w-48 focus:w-64 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
              Lọc
            </button>
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-hidden bg-slate-50">
        {view === 'board' ? (
          <div className="p-6 h-full">
            <KanbanBoard projectId={id || ''} projectKey={project.key} />
          </div>
        ) : view === 'list' ? (
          <ProjectStatistics projectId={id || ''} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 italic">
            Tính năng đang được phát triển...
          </div>
        )}
      </div>

      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title="Thêm thành viên vào dự án"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Chọn thành viên</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="">-- Chọn nhân sự --</option>
              {users.map((user: any) => (
                <option key={user._id} value={user._id}>
                  {user.fullName} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsMemberModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              onClick={handleAddMember}
              disabled={!selectedUser}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              Thêm vào dự án
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Cấu hình dự án"
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tên dự án</label>
            <input
              required
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Loại dự án</label>
              <select
                value={editForm.type}
                onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="kanban">Kanban</option>
                <option value="scrum">Scrum</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Trạng thái</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="active">Đang hoạt động</option>
                <option value="archived">Lưu trữ</option>
                <option value="completed">Đã hoàn thành</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Mô tả</label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={handleDeleteProject}
              className="px-4 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all"
            >
              Xóa dự án
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
              className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
