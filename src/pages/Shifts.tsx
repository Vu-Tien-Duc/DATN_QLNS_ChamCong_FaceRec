import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Clock, Loader2, AlertCircle, Check, X,
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface ShiftConfig {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes?: number;
  description?: string;
  isActive?: boolean;
}

export default function Shifts() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('truongkhoa');

  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState<ShiftConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    lateThresholdMinutes: 15,
    description: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/shifts');
      const data = extractArray<ShiftConfig>(res.data?.data ?? res.data);
      setShifts(data);
    } catch {
      toast.error('Không thể tải danh sách ca làm việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const openCreate = () => {
    setEditShift(null);
    setFormData({ name: '', startTime: '', endTime: '', lateThresholdMinutes: 15, description: '' });
    setShowForm(true);
  };

  const openEdit = (s: ShiftConfig) => {
    setEditShift(s);
    setFormData({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      lateThresholdMinutes: s.lateThresholdMinutes ?? 15,
      description: s.description ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startTime || !formData.endTime) {
      toast.error('Vui lòng nhập đầy đủ thông tin ca');
      return;
    }
    setFormLoading(true);
    try {
      if (editShift) {
        await apiClient.put(`/shifts/${editShift._id}`, formData);
        toast.success('Cập nhật ca thành công');
      } else {
        await apiClient.post('/shifts', formData);
        toast.success('Tạo ca làm việc thành công');
      }
      setShowForm(false);
      fetchShifts();
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
      await apiClient.delete(`/shifts/${deleteId}`);
      toast.success('Đã xoá ca làm việc');
      setDeleteId(null);
      fetchShifts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xoá thất bại');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ca làm việc</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý cấu hình ca làm việc trong trường</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} />
            Thêm ca mới
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : shifts.length === 0 ? (
        <div className="card p-16 text-center">
          <Clock size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Chưa có ca làm việc nào</p>
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary mt-4 mx-auto">
              <Plus size={16} /> Tạo ca đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div key={shift._id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock size={22} className="text-blue-600" />
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(shift)} className="btn-ghost p-2">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteId(shift._id)} className="btn-ghost p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{shift.name}</h3>
              <p className="text-2xl font-bold text-blue-600 mb-2">
                {shift.startTime} – {shift.endTime}
              </p>
              {shift.description && (
                <p className="text-sm text-slate-500 mb-3">{shift.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>⏱ Trễ sau {shift.lateThresholdMinutes ?? 15} phút</span>
                <span className={`badge ${shift.isActive !== false ? 'badge-green' : 'badge-gray'}`}>
                  {shift.isActive !== false ? 'Đang dùng' : 'Đã tắt'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                {editShift ? 'Chỉnh sửa ca' : 'Tạo ca mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Tên ca *</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ca Sáng, Ca Chiều..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Giờ bắt đầu *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Giờ kết thúc *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Ngưỡng trễ (phút)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="form-input"
                  value={formData.lateThresholdMinutes}
                  onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <input
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả ca làm việc..."
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Huỷ</button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1 justify-center">
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editShift ? 'Lưu thay đổi' : 'Tạo ca'}
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
              <h3 className="text-lg font-bold text-slate-800 mb-2">Xoá ca làm việc?</h3>
              <p className="text-slate-500 text-sm mb-6">Hành động này không thể hoàn tác.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Huỷ</button>
                <button onClick={handleDelete} className="btn-danger flex-1 justify-center">Xác nhận xoá</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
