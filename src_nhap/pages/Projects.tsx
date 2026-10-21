import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Search, MoreVertical, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';
import { tokenStorage } from '../utils/tokenStorage';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', key: '', type: 'kanban', description: '' });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/projects');
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error("Không thể tải danh sách dự án");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = tokenStorage.getUser();
      const managerId = user?._id || user?.id;

      console.log('Creating project with user from storage:', user);
      console.log('Creating project with managerId:', managerId);

      if (!managerId) {
        toast.error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        return;
      }

      const res = await apiClient.post('/projects', {
        ...newProject,
        manager: managerId
      });

      if (res.data.success) {
        setIsModalOpen(false);
        fetchProjects();
        setNewProject({ name: '', key: '', type: 'kanban', description: '' });
        toast.success("Tạo dự án thành công");
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      const message = error.response?.data?.message || "Không thể tạo dự án";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dự án</h1>
          <p className="text-slate-500">Quản lý và theo dõi tiến độ các dự án của bạn.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5" />
          Tạo dự án mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))
        ) : projects.length > 0 ? (
          projects.map((project: any) => (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
                  {project.key}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {project.name}
                  </h3>
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    {project.type === 'scrum' ? 'Scrum' : 'Kanban'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2 mb-6">
                {project.description || 'Không có mô tả cho dự án này.'}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                    <img
                      src={project.manager?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                      alt="Manager"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-slate-600 font-medium">{project.manager?.fullName}</span>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Active
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-xs border-2 border-dashed border-slate-200">
            <Layers className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Chưa có dự án nào</h3>
            <p className="text-slate-500 mb-6">Bắt đầu bằng việc tạo một dự án mới để quản lý công việc.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
            >
              Tạo dự án đầu tiên
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tạo dự án mới"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tên dự án</label>
            <input
              required
              value={newProject.name}
              onChange={e => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="VD: Phát triển EduCRM"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Mã dự án (Key)</label>
              <input
                required
                maxLength={5}
                value={newProject.key}
                onChange={e => setNewProject({ ...newProject, key: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="VD: CRM"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Loại dự án</label>
              <select
                value={newProject.type}
                onChange={e => setNewProject({ ...newProject, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="kanban">Kanban Board</option>
                <option value="scrum">Scrum Board</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Mô tả</label>
            <textarea
              rows={3}
              value={newProject.description}
              onChange={e => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Mô tả ngắn gọn về dự án..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Tạo dự án
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
