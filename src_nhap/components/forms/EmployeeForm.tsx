

// import React, { useState } from 'react';
// import { Save, X, Upload, FileText } from 'lucide-react';

// interface EmployeeFormProps {
//   onSubmit: (data: any) => void;
//   onCancel: () => void;
//   initialData?: any;
// }

// export function EmployeeForm({ onSubmit, onCancel, initialData }: EmployeeFormProps) {
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     const formData = new FormData(e.target as HTMLFormElement);
//     const data = Object.fromEntries(formData);

//     // Đảm bảo kiểu dữ liệu Date hợp lệ
//     const payload = {
//       ...data,
//       birthDate: data.birthDate || undefined,
//       joinDate: data.joinDate || new Date().toISOString()
//     };

//     onSubmit(payload);
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
//       <section className="space-y-4">
//         <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 text-indigo-600">Thông tin cơ bản</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên *</label>
//             <input name="name" required defaultValue={initialData?.name} className="form-input-custom" />
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Email công việc *</label>
//             <input name="email" type="email" required defaultValue={initialData?.email} className="form-input-custom" />
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại *</label>
//             <input name="phone" required defaultValue={initialData?.phone} className="form-input-custom" />
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Ngày sinh</label>
//             <input name="birthDate" type="date" defaultValue={initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : ''} className="form-input-custom" />
//           </div>
//         </div>
//       </section>

//       <section className="space-y-4">
//         <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 text-indigo-600">Vị trí & Trạng thái</h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Phòng ban</label>
//             <select name="department" defaultValue={initialData?.department || 'Sales'} className="form-input-custom">
//               {['Sales', 'Academic', 'Marketing', 'Finance', 'HR', 'IT'].map(d => <option key={d} value={d}>{d}</option>)}
//             </select>
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Chức vụ</label>
//             <select name="role" defaultValue={initialData?.role || 'Staff'} className="form-input-custom">
//               {['Admin', 'Manager', 'Staff', 'Teacher', 'Consultant'].map(r => <option key={r} value={r}>{r}</option>)}
//             </select>
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Ngày gia nhập</label>
//             <input name="joinDate" type="date" defaultValue={initialData?.joinDate ? new Date(initialData.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className="form-input-custom" />
//           </div>
//           <div className="space-y-1">
//             <label className="text-xs font-bold text-slate-500 uppercase">Trạng thái</label>
//             <select name="status" defaultValue={initialData?.status || 'Active'} className="form-input-custom font-bold">
//               <option value="Active">Đang làm việc</option>
//               <option value="Inactive">Đã nghỉ việc</option>
//               <option value="On Leave">Đang nghỉ phép</option>
//             </select>
//           </div>
//         </div>
//       </section>

//       <div className="flex gap-3 pt-6 border-t sticky bottom-0 bg-white py-4">
//         <button type="button" onClick={onCancel} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl">Hủy</button>
//         <button type="submit" className="flex-[2] py-3.5 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2">
//           <Save className="w-5 h-5" /> {initialData ? 'Cập nhật hồ sơ' : 'Kích hoạt nhân sự mới'}
//         </button>
//       </div>
//     </form>
//   );
// }


import React, { useState } from 'react';
import { Save, Upload, User, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { toast } from 'react-hot-toast';

interface EmployeeFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function EmployeeForm({ onSubmit, onCancel, initialData }: EmployeeFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.avatar || null);
  const [avatarId, setAvatarId] = useState<string | null>(initialData?.avatarId || null);
  const [isUploading, setIsUploading] = useState(false);

  // Xử lý upload ảnh
  // const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   // Preview nhanh
  //   setPreviewUrl(URL.createObjectURL(file));

  //   const formData = new FormData();
  //   formData.append('image', file);

  //   setIsUploading(true);
  //   try {
  //     const res = await apiClient.post('/images/upload', formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' }
  //     });
  //     if (res.data.success) {
  //       setAvatarId(res.data.data._id); // Lưu ID của ảnh vào state
  //       toast.success("Đã upload ảnh đại diện");
  //     }
  //   } catch (error) {
  //     toast.error("Lỗi khi upload ảnh");
  //     setPreviewUrl(initialData?.avatar || null);
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };


  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Chuyển đổi file thành Base64 thay vì dùng blob:
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string); // Kết quả là chuỗi base64 (được phép bởi 'data:')
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    try {
      const res = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success && res.data.image) {
        setAvatarId(res.data.image._id);
        toast.success("Đã upload ảnh");
      }
    } catch (error) {
      toast.error("Lỗi upload");
      setPreviewUrl(initialData?.avatar || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    const payload = {
      ...data,
      avatar: avatarId, // Gửi ID ảnh (hoặc null nếu không đổi)
      birthDate: data.birthDate || undefined,
      joinDate: data.joinDate || new Date().toISOString()
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">

      {/* SECTION UPLOAD AVATAR */}
      <section className="flex flex-col items-center gap-4 py-4">
        <div className="relative group">
          <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            ) : previewUrl ? (
              <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-slate-300" />
            )}
          </div>
          <label className="absolute bottom-1 right-1 p-3 bg-indigo-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-indigo-700 transition-all">
            <Upload className="w-5 h-5" />
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
          </label>
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase">Ảnh đại diện nhân sự</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 text-indigo-600">Thông tin cơ bản</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên *</label>
            <input name="name" required defaultValue={initialData?.name} className="form-input-custom" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Email công việc *</label>
            <input name="email" type="email" required defaultValue={initialData?.email} className="form-input-custom" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại *</label>
            <input name="phone" required defaultValue={initialData?.phone} className="form-input-custom" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Ngày sinh</label>
            <input name="birthDate" type="date" defaultValue={initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : ''} className="form-input-custom" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 text-indigo-600">Vị trí & Trạng thái</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Phòng ban</label>
            <select name="department" defaultValue={initialData?.department || 'Sales'} className="form-input-custom">
              {['Sales', 'Academic', 'Marketing', 'Finance', 'HR', 'IT'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Chức vụ</label>
            <select name="role" defaultValue={initialData?.role || 'Staff'} className="form-input-custom">
              {['Admin', 'Manager', 'Staff', 'Teacher', 'Consultant'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Ngày gia nhập</label>
            <input name="joinDate" type="date" defaultValue={initialData?.joinDate ? new Date(initialData.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className="form-input-custom" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Trạng thái</label>
            <select name="status" defaultValue={initialData?.status || 'Active'} className="form-input-custom font-bold">
              <option value="Active">Đang làm việc</option>
              <option value="Inactive">Đã nghỉ việc</option>
              <option value="On Leave">Đang nghỉ phép</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex gap-3 pt-6 border-t sticky bottom-0 bg-white py-4">
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl">Hủy</button>
        <button
          type="submit"
          disabled={isUploading}
          className="flex-[2] py-3.5 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          {isUploading ? 'Đang upload ảnh...' : (initialData ? 'Cập nhật hồ sơ' : 'Kích hoạt nhân sự mới')}
        </button>
      </div>
    </form>
  );
}
