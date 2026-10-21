import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Plus, Search, MoreVertical, Shield, Mail, Phone } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', description: '' });

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/departments');
      if (res.data.success) {
        setDepartments(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error("Không thể tải danh sách phòng ban");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/departments', newDept);
      if (res.data.success) {
        setIsDeptModalOpen(false);
        fetchDepartments();
        setNewDept({ name: '', description: '' });
        toast.success("Thêm phòng ban thành công");
      }
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error("Không thể thêm phòng ban");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phòng ban & Nhóm</h1>
          <p className="text-slate-500">Quản lý cơ cấu tổ chức và nhân sự theo phòng ban.</p>
        </div>
        <button
          onClick={() => setIsDeptModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5" />
          Thêm phòng ban
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-64 bg-white rounded-xs border border-slate-200 animate-pulse" />)
        ) : departments.length > 0 ? (
          departments.map((dept: any) => (
            <div key={dept._id} className="bg-white rounded-xs border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
              <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{dept.name}</h3>
                    <p className="text-sm text-slate-500">{dept.description || 'Chưa có mô tả'}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thành viên ({dept.members?.length || 0})</span>
                  <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Xem tất cả</button>
                </div>
                <div className="space-y-3">
                  {dept.members?.slice(0, 3).map((member: any) => (
                    <div key={member._id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                          <img src={member.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{member.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{member.role?.name || 'Staff'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!dept.members || dept.members.length === 0) && (
                    <p className="text-sm text-slate-400 italic text-center py-4">Chưa có thành viên nào</p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-xs border-2 border-dashed border-slate-200">
            <Building2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Chưa có phòng ban nào</h3>
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all mt-4"
            >
              Thêm phòng ban đầu tiên
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Thêm phòng ban mới"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tên phòng ban</label>
            <input
              required
              value={newDept.name}
              onChange={e => setNewDept({ ...newDept, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="VD: Phòng Kỹ thuật"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Mô tả</label>
            <textarea
              rows={3}
              value={newDept.description}
              onChange={e => setNewDept({ ...newDept, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Mô tả nhiệm vụ của phòng ban..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsDeptModalOpen(false)}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Tạo phòng ban
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
