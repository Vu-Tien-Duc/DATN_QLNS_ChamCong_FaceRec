import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, Loader2, AlertCircle, Check, X, Search,
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Subject {
  _id: string;
  name: string;
  code?: string;
  credits?: number;
  description?: string;
  departmentId?: { _id: string; name: string } | string;
  isActive?: boolean;
}

export default function Subjects() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', credits: 3, description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/subjects');
      const data = extractArray<Subject>(res.data?.data ?? res.data);
      setSubjects(data);
    } catch {
      toast.error('Không thể tải danh sách môn học');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const openCreate = () => {
    setEditSubject(null);
    setFormData({ name: '', code: '', credits: 3, description: '' });
    setShowForm(true);
  };

  const openEdit = (s: Subject) => {
    setEditSubject(s);
    setFormData({ name: s.name, code: s.code ?? '', credits: s.credits ?? 3, description: s.description ?? '' });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast.error('Vui lòng nhập tên môn học'); return; }
    setFormLoading(true);
    try {
      if (editSubject) {
        await apiClient.put(`/subjects/${editSubject._id}`, formData);
        toast.success('Cập nhật thành công');
      } else {
        await apiClient.post('/subjects', formData);
        toast.success('Tạo môn học thành công');
      }
      setShowForm(false);
      fetchSubjects();
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
      await apiClient.delete(`/subjects/${deleteId}`);
      toast.success('Đã xoá môn học');
      setDeleteId(null);
      fetchSubjects();
    } catch {
      toast.error('Xoá thất bại');
    }
  };

  const filtered = subjects.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Môn học</h1>
          <p className="text-slate-500 text-sm mt-1">{subjects.length} môn học trong hệ thống</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Thêm môn học
          </button>
        )}
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã môn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Không tìm thấy môn học nào</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã môn</th>
                <th>Tên môn học</th>
                <th>Số tín chỉ</th>
                <th>Mô tả</th>
                <th>Trạng thái</th>
                {isAdmin && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s._id}>
                  <td><code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{s.code || '—'}</code></td>
                  <td className="font-medium text-slate-800">{s.name}</td>
                  <td>
                    <span className="badge badge-blue">{s.credits ?? 0} TC</span>
                  </td>
                  <td className="text-sm text-slate-500 max-w-[300px] truncate">{s.description || '—'}</td>
                  <td>
                    <span className={`badge ${s.isActive !== false ? 'badge-green' : 'badge-gray'}`}>
                      {s.isActive !== false ? 'Đang dạy' : 'Ngưng'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="btn-ghost p-2"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(s._id)} className="btn-ghost p-2 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editSubject ? 'Chỉnh sửa môn học' : 'Thêm môn học'}</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Tên môn học *</label>
                <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Lập trình Web" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Mã môn</label>
                  <input className="form-input font-mono" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="CNTT401" />
                </div>
                <div className="form-group">
                  <label className="form-label">Số tín chỉ</label>
                  <input type="number" min={1} max={10} className="form-input" value={formData.credits} onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-input h-20 resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Huỷ</button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1 justify-center">
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editSubject ? 'Lưu' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Xoá môn học?</h3>
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
