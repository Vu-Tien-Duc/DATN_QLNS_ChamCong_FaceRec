import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, AlertCircle, Users, Check, X } from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Department {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  headId?: { _id: string; fullName: string } | string;
  memberCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

export default function Departments() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/departments');
      const data = extractArray<Department>(res.data?.data ?? res.data);
      setDepts(data);
    } catch {
      toast.error('Không thể tải danh sách phòng ban');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const openCreate = () => {
    setEditDept(null);
    setFormData({ name: '', code: '', description: '' });
    setShowForm(true);
  };

  const openEdit = (d: Department) => {
    setEditDept(d);
    setFormData({ name: d.name, code: d.code ?? '', description: d.description ?? '' });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast.error('Vui lòng nhập tên phòng ban'); return; }
    setFormLoading(true);
    try {
      if (editDept) {
        await apiClient.put(`/departments/${editDept._id}`, formData);
        toast.success('Cập nhật thành công');
      } else {
        await apiClient.post('/departments', formData);
        toast.success('Tạo phòng ban thành công');
      }
      setShowForm(false);
      fetchDepts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Lưu thất bại');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/departments/${deleteId}`);
      toast.success('Đã xoá phòng ban');
      setDeleteId(null);
      fetchDepts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xoá thất bại');
    }
  };

  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-violet-100 text-violet-600',
    'bg-emerald-100 text-emerald-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
    'bg-cyan-100 text-cyan-600',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Phòng ban / Khoa</h1>
          <p className="text-slate-500 text-sm mt-1">{depts.length} đơn vị trong hệ thống</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Thêm phòng ban
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : depts.length === 0 ? (
        <div className="card p-16 text-center">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Chưa có phòng ban nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {depts.map((d, i) => {
            const colorCls = colors[i % colors.length];
            const headName = typeof d.headId === 'object' ? d.headId?.fullName : '—';
            return (
              <div key={d._id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorCls}`}>
                    <Building2 size={22} />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(d)} className="btn-ghost p-2"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteId(d._id)} className="btn-ghost p-2 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{d.name}</h3>
                {d.code && <p className="text-xs text-slate-500 mb-2 font-mono">#{d.code}</p>}
                {d.description && <p className="text-sm text-slate-500 mb-3">{d.description}</p>}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {d.memberCount ?? 0} thành viên
                  </span>
                  {headName !== '—' && <span>Trưởng: {headName}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editDept ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban'}</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Tên phòng ban *</label>
                <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Khoa Công nghệ thông tin" required />
              </div>
              <div className="form-group">
                <label className="form-label">Mã phòng ban</label>
                <input className="form-input font-mono" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="CNTT" />
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-input h-20 resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Huỷ</button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1 justify-center">
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editDept ? 'Lưu' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Xoá phòng ban?</h3>
              <p className="text-slate-500 text-sm mb-6">Hành động này không thể hoàn tác.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Huỷ</button>
                <button onClick={handleDelete} className="btn-danger flex-1">Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
