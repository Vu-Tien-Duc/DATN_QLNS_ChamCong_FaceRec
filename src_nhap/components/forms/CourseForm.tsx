// import React, { useState } from 'react';
// import { apiClient } from '../../api/apiClient';
// import { toast } from 'react-hot-toast';

// export function CourseForm({ initialData, onSuccess, onCancel }: any) {
//   const [formData, setFormData] = useState(initialData || {
//     name: '',
//     courseCode: '',
//     price: 0,
//     duration: '',
//     category: '',
//     description: '',
//     status: 'active'
//   });

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       const res = initialData 
//         ? await apiClient.put(`/courses/${initialData._id}`, formData)
//         : await apiClient.post('/courses', formData);
      
//       if (res.data.success) {
//         toast.success("Thành công");
//         onSuccess();
//       }
//     } catch (err) { toast.error("Lỗi thao tác"); }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div className="grid grid-cols-2 gap-4">
//         <div className="col-span-2">
//           <label className="block text-sm font-bold text-slate-700 mb-1">Tên khóa học</label>
//           <input required className="w-full px-4 py-2 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
//         </div>
//         <div>
//           <label className="block text-sm font-bold text-slate-700 mb-1">Mã khóa học</label>
//           <input required className="w-full px-4 py-2 border rounded-xl" value={formData.courseCode} onChange={e => setFormData({...formData, courseCode: e.target.value})} />
//         </div>
//         <div>
//           <label className="block text-sm font-bold text-slate-700 mb-1">Học phí (VNĐ)</label>
//           <input type="number" className="w-full px-4 py-2 border rounded-xl" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
//         </div>
//         <div>
//           <label className="block text-sm font-bold text-slate-700 mb-1">Thời lượng</label>
//           <input className="w-full px-4 py-2 border rounded-xl" placeholder="VD: 3 tháng" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
//         </div>
//         <div>
//           <label className="block text-sm font-bold text-slate-700 mb-1">Danh mục</label>
//           <input className="w-full px-4 py-2 border rounded-xl" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
//         </div>
//       </div>
//       <div className="flex gap-3 pt-4">
//         <button type="button" onClick={onCancel} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Hủy</button>
//         <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Lưu lại</button>
//       </div>
//     </form>
//   );
// }

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/apiClient';
import { toast } from 'react-hot-toast';
import { Book, Hash, Clock, DollarSign, Tag, FileText } from 'lucide-react';

export function CourseForm({ initialData, onSuccess, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: '',
    courseCode: '',
    price: 0,
    totalSessions: 0,
    hoursPerSession: 0,
    duration: '',
    category: '',
    description: '',
    status: 'active'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        // Đảm bảo các trường số không bị null
        price: initialData.price || 0,
        totalSessions: initialData.totalSessions || 0,
        hoursPerSession: initialData.hoursPerSession || 0,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        totalSessions: Number(formData.totalSessions),
        hoursPerSession: Number(formData.hoursPerSession)
      };

      const res = initialData 
        ? await apiClient.put(`/courses/${initialData._id}`, payload)
        : await apiClient.post('/courses', payload);
      
      if (res.data.success) {
        toast.success(initialData ? "Đã cập nhật" : "Đã tạo mới");
        onSuccess();
      }
    } catch (err: any) { 
      toast.error(err.response?.data?.message || "Lỗi thao tác"); 
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tên khóa học */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Book className="w-4 h-4 text-slate-400" /> Tên chương trình đào tạo
          </label>
          <input 
            required 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            placeholder="Ví dụ: Fullstack Web Developer"
          />
        </div>

        {/* Mã & Category */}
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700">Mã khóa học</label>
          <input 
            required 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={formData.courseCode} 
            onChange={e => setFormData({...formData, courseCode: e.target.value.toUpperCase()})} 
            placeholder="VD: FS-01"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700">Danh mục / Nhóm</label>
          <input 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={formData.category} 
            onChange={e => setFormData({...formData, category: e.target.value})} 
            placeholder="VD: Lập trình"
          />
        </div>

        {/* Số buổi & Số giờ */}
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" /> Tổng số buổi học
          </label>
          <input 
            type="number"
            required 
            className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-indigo-600" 
            value={formData.totalSessions} 
            onChange={e => setFormData({...formData, totalSessions: Number(e.target.value)})} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Số giờ mỗi buổi
          </label>
          <input 
            type="number"
            step="0.5"
            required 
            className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-emerald-600" 
            value={formData.hoursPerSession} 
            onChange={e => setFormData({...formData, hoursPerSession: Number(e.target.value)})} 
          />
        </div>

        {/* Giá & Duration */}
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" /> Học phí niêm yết
          </label>
          <input 
            type="number"
            required 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700" 
            value={formData.price} 
            onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700">Thời gian dự kiến</label>
          <input 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={formData.duration} 
            onChange={e => setFormData({...formData, duration: e.target.value})} 
            placeholder="VD: 6 tháng / 24 tuần"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="text-sm font-bold text-slate-700">Trạng thái khóa học</label>
          <select 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value})}
          >
            <option value="active">Đang hoạt động (Active)</option>
            <option value="inactive">Tạm dừng (Inactive)</option>
          </select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" /> Mô tả ngắn
          </label>
          <textarea 
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t border-slate-50">
        <button type="button" onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Hủy</button>
        <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
          {initialData ? "Lưu thay đổi" : "Tạo khóa học"}
        </button>
      </div>
    </form>
  );
}