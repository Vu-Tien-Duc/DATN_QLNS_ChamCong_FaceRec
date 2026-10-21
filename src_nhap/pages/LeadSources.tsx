// import React, { useState } from 'react';
// import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Share2 } from 'lucide-react';
// import { Source } from '../types';

// const initialSources: Source[] = [
//   { id: '1', name: 'Facebook', active: true },
//   { id: '2', name: 'Zalo', active: true },
//   { id: '3', name: 'Website', active: true },
//   { id: '4', name: 'TikTok', active: true },
//   { id: '5', name: 'Referral', active: true },
// ];

// export default function LeadSources() {
//   const [sources, setSources] = useState<Source[]>(initialSources);
//   const [newSourceName, setNewSourceName] = useState('');

//   const handleAddSource = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!newSourceName.trim()) return;

//     const newSource: Source = {
//       id: Date.now().toString(),
//       name: newSourceName.trim(),
//       active: true
//     };

//     setSources([...sources, newSource]);
//     setNewSourceName('');
//   };

//   const toggleActive = (id: string) => {
//     setSources(sources.map(s => s.id === id ? { ...s, active: !s.active } : s));
//   };

//   const deleteSource = (id: string) => {
//     setSources(sources.filter(s => s.id !== id));
//   };

//   return (
//     <div className="space-y-8">
//       <header>
//         <h1 className="text-3xl font-bold text-slate-900">Quản lý nguồn Leads</h1>
//         <p className="text-slate-500">Cấu hình các kênh thu hút khách hàng tiềm năng.</p>
//       </header>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//         <div className="lg:col-span-1">
//           <div className="bg-white p-6 rounded-xs shadow-sm border border-slate-100">
//             <h2 className="text-xl font-bold text-slate-900 mb-6">Thêm nguồn mới</h2>
//             <form onSubmit={handleAddSource} className="space-y-4">
//               <div>
//                 <label className="text-sm font-semibold text-slate-700 block mb-2">Tên nguồn</label>
//                 <input
//                   type="text"
//                   value={newSourceName}
//                   onChange={(e) => setNewSourceName(e.target.value)}
//                   placeholder="Ví dụ: TikTok, Instagram..."
//                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
//                 />
//               </div>
//               <button
//                 type="submit"
//                 className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
//               >
//                 <Plus className="w-5 h-5" />
//                 Thêm nguồn
//               </button>
//             </form>
//           </div>
//         </div>

//         <div className="lg:col-span-2">
//           <div className="bg-white rounded-xs shadow-sm border border-slate-100 overflow-hidden">
//             <div className="p-6 border-b border-slate-100">
//               <h2 className="text-xl font-bold text-slate-900">Danh sách nguồn hiện có</h2>
//             </div>
//             <div className="divide-y divide-slate-50">
//               {sources.map((source) => (
//                 <div key={source.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
//                   <div className="flex items-center gap-4">
//                     <div className={`p-3 rounded-2xl ${source.active ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
//                       <Share2 className="w-5 h-5" />
//                     </div>
//                     <div>
//                       <h3 className={`font-bold ${source.active ? 'text-slate-900' : 'text-slate-400'}`}>{source.name}</h3>
//                       <p className="text-xs text-slate-500">ID: {source.id}</p>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-3">
//                     <button
//                       onClick={() => toggleActive(source.id)}
//                       className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
//                         source.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
//                       }`}
//                     >
//                       {source.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
//                       {source.active ? 'Đang hoạt động' : 'Tạm dừng'}
//                     </button>
//                     <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
//                       <Edit2 className="w-4 h-4" />
//                     </button>
//                     <button 
//                       onClick={() => deleteSource(source.id)}
//                       className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
//                     >
//                       <Trash2 className="w-4 h-4" />
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Share2,
  Loader2,
  Search,
  Tag,
  Globe,
  RefreshCcw,
  MessageSquare
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

// Mapping icons cho từng Channel
const CHANNEL_ICONS: Record<string, any> = {
  facebook: 'bg-blue-100 text-blue-600',
  google: 'bg-red-100 text-red-600',
  tiktok: 'bg-slate-900 text-white',
  zalo: 'bg-blue-500 text-white',
  website: 'bg-emerald-100 text-emerald-600',
  referral: 'bg-purple-100 text-purple-600',
  offline: 'bg-orange-100 text-orange-600',
  other: 'bg-slate-100 text-slate-600'
};

export default function LeadSources() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // State cho Form (Dùng chung cho Thêm và Sửa)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    channel: 'facebook',
    description: '',
    status: 'active'
  });

  // 1. Lấy danh sách nguồn
  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/lead-sources', { params: { search: searchTerm } });
      if (res.data.success) {
        setSources(res.data.data);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách nguồn");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // 2. Xử lý lưu (Create hoặc Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      let res;
      if (editingId) {
        res = await apiClient.put(`/lead-sources/${editingId}`, formData);
      } else {
        res = await apiClient.post('/lead-sources', formData);
      }

      if (res.data.success) {
        toast.success(editingId ? "Cập nhật thành công" : "Thêm nguồn thành công");
        resetForm();
        fetchSources();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Thao tác thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Xử lý xóa
  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nguồn này?")) return;
    try {
      const res = await apiClient.delete(`/lead-sources/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa nguồn");
        fetchSources();
      }
    } catch (error) {
      toast.error("Không thể xóa");
    }
  };

  // 4. Bật/Tắt trạng thái nhanh
  const toggleStatus = async (source: any) => {
    const newStatus = source.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiClient.put(`/lead-sources/${source._id}`, { status: newStatus });
      if (res.data.success) {
        toast.success(`Đã chuyển sang ${newStatus}`);
        fetchSources();
      }
    } catch (error) {
      toast.error("Lỗi cập nhật trạng thái");
    }
  };

  const handleEditClick = (source: any) => {
    setEditingId(source._id);
    setFormData({
      name: source.name,
      code: source.code || '',
      channel: source.channel || 'facebook',
      description: source.description || '',
      status: source.status || 'active'
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', channel: 'facebook', description: '', status: 'active' });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cấu hình Nguồn Leads</h1>
          <p className="text-slate-500 text-sm">Quản lý các kênh marketing và nguồn khách hàng tiềm năng đổ về.</p>
        </div>
        <button
          onClick={fetchSources}
          className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all"
        >
          <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CỘT TRÁI: FORM NHẬP LIỆU */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 sticky top-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              {editingId ? <Edit2 className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-emerald-500" />}
              {editingId ? "Chỉnh sửa nguồn" : "Thêm nguồn mới"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tên nguồn</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Facebook Ads..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mã định danh (Code)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Ví dụ: FB_ADS_2024"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Kênh chính (Channel)</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                >
                  <option value="facebook">Facebook</option>
                  <option value="google">Google</option>
                  <option value="tiktok">TikTok</option>
                  <option value="zalo">Zalo</option>
                  <option value="website">Website</option>
                  <option value="referral">Người giới thiệu</option>
                  <option value="offline">Sự kiện/Offline</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mô tả</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả chiến dịch hoặc chi tiết nguồn..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold px-6 py-3 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? "Cập nhật" : "Tạo nguồn"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* CỘT PHẢI: DANH SÁCH NGUỒN */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên nguồn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Đang đồng bộ dữ liệu...</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {sources.map((source) => (
                  <div key={source._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl transition-all ${source.status === 'active' ? (CHANNEL_ICONS[source.channel] || 'bg-slate-100') : 'bg-slate-200 text-slate-400 opacity-50'}`}>
                        <Share2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold text-lg ${source.status === 'active' ? 'text-slate-900' : 'text-slate-400'}`}>
                            {source.name}
                          </h3>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {source.channel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {source.code || 'NO_CODE'}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> {new Date(source.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        {source.description && (
                          <p className="text-sm text-slate-500 mt-2 line-clamp-1 italic flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {source.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleStatus(source)}
                        title={source.status === 'active' ? "Tạm dừng" : "Kích hoạt"}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${source.status === 'active'
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                      >
                        {source.status === 'active' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span className="hidden xl:inline">{source.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span>
                      </button>

                      <button
                        onClick={() => handleEditClick(source)}
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 rounded-xl transition-all shadow-sm"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleDelete(source._id)}
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && sources.length === 0 && (
              <div className="p-20 text-center bg-slate-50/50">
                <Tag className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Chưa có nguồn Lead nào được cấu hình</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
