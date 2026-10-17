import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Plus, Edit, Trash2, Calendar, AlertCircle,
  RefreshCw, CheckCircle2, X, Info, Sparkles
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { Holiday as HolidayType } from '../types';
import toast from 'react-hot-toast';

export default function Holidays() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('bgh') || hasRole('tccb');

  const [holidays, setHolidays] = useState<HolidayType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    year: selectedYear,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch Holidays
  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/holidays', { params: { year: selectedYear } });
      if (res.data?.success) {
        setHolidays(res.data.data || []);
      }
    } catch {
      toast.error('Không thể tải danh sách ngày nghỉ lễ');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      description: '',
      year: selectedYear,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (holiday: HolidayType) => {
    setEditingId(holiday._id);
    const startStr = holiday.ngay_bat_dau || holiday.startDate || '';
    const endStr = holiday.ngay_ket_thuc || holiday.endDate || '';
    setFormData({
      name: holiday.ten_ngay_le || holiday.name || '',
      startDate: startStr.substring(0, 10),
      endDate: endStr.substring(0, 10),
      description: holiday.mo_ta || holiday.description || '',
      year: holiday.nam || holiday.year || selectedYear,
    });
    setIsModalOpen(true);
  };

  // Submit Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.startDate || !formData.endDate) {
      toast.error('Vui lòng điền đầy đủ tên ngày lễ và thời gian bắt đầu/kết thúc');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description.trim(),
        year: parseInt(formData.startDate.slice(0, 4), 10) || selectedYear,
      };

      if (editingId) {
        const res = await apiClient.put(`/holidays/${editingId}`, payload);
        if (res.data?.success) {
          toast.success(res.data.message || 'Cập nhật ngày nghỉ lễ thành công');
        }
      } else {
        const res = await apiClient.post('/holidays', payload);
        if (res.data?.success) {
          toast.success(res.data.message || 'Thêm ngày nghỉ lễ thành công');
        }
      }
      setIsModalOpen(false);
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu ngày nghỉ lễ');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Holiday
  const handleDelete = async (id: string, name?: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ngày lễ "${name || 'này'}"?`)) return;
    try {
      const res = await apiClient.delete(`/holidays/${id}`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Đã xóa ngày nghỉ lễ');
        fetchHolidays();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa ngày nghỉ lễ');
    }
  };

  // Format Date VN
  const formatDateVN = (dateStr?: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-indigo-600" />
            Lịch Ngày Nghỉ Lễ Toàn Trường
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý các kỳ nghỉ lễ, Tết chính thức của Nhà trường. Dữ liệu này tự động loại trừ khỏi ngày công và tính phụ cấp làm thêm giờ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent font-bold text-slate-800 focus:outline-none"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Thêm Ngày Lễ
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Quy chế Chấm công & Nghỉ lễ v2.5:</span> Các ngày nghỉ lễ chính thức theo Bộ luật Lao động và Quy chế Đại học được hưởng nguyên lương. Cán bộ hoặc giảng viên làm việc vào ngày nghỉ lễ sẽ được tự động nhân hệ số làm thêm giờ theo quy định của Nhà trường.
        </div>
      </div>

      {/* Holiday Cards / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">
            Danh Sách Ngày Nghỉ Lễ Năm {selectedYear} ({holidays.length} kỳ nghỉ)
          </h3>
          <button
            onClick={fetchHolidays}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm">Đang tải lịch nghỉ lễ...</p>
          </div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Chưa có ngày nghỉ lễ nào cho năm {selectedYear}</p>
            <p className="text-xs text-slate-400 mt-1">Nhấn "Thêm Ngày Lễ" để thiết lập lịch nghỉ cho toàn trường.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">STT</th>
                  <th className="px-5 py-3">Tên Ngày Lễ</th>
                  <th className="px-5 py-3">Từ Ngày</th>
                  <th className="px-5 py-3">Đến Ngày</th>
                  <th className="px-5 py-3 text-center">Số Ngày Nghỉ</th>
                  <th className="px-5 py-3">Mô Tả & Ghi Chú</th>
                  {isAdmin && <th className="px-5 py-3 text-center">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map((h, idx) => {
                  const hName = h.ten_ngay_le || h.name || 'Ngày lễ';
                  const hDesc = h.mo_ta || h.description || '--';
                  const days = h.so_ngay_nghi || h.daysCount || 1;

                  return (
                    <tr key={h._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-800">{hName}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {formatDateVN(h.ngay_bat_dau || h.startDate)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {formatDateVN(h.ngay_ket_thuc || h.endDate)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {days} ngày
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs truncate">
                        {hDesc}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(h)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(h._id, hName)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                {editingId ? 'Chỉnh Sửa Ngày Nghỉ Lễ' : 'Thêm Ngày Nghỉ Lễ Mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tên ngày nghỉ lễ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Tết Nguyên Đán Bính Ngọ 2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Từ ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Đến ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mô tả / Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ghi chú chi tiết hoặc số quyết định của Nhà trường..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Lưu Thay Đổi' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
