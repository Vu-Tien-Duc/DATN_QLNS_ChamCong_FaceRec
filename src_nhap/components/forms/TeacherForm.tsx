// // import React from 'react';

// // interface TeacherFormProps {
// //   onSubmit: (data: any) => void;
// //   onCancel: () => void;
// // }

// // export function TeacherForm({ onSubmit, onCancel }: TeacherFormProps) {
// //   const handleSubmit = (e: React.FormEvent) => {
// //     e.preventDefault();
// //     const formData = new FormData(e.target as HTMLFormElement);
// //     onSubmit(Object.fromEntries(formData));
// //   };

// //   return (
// //     <form onSubmit={handleSubmit} className="space-y-6">
// //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Họ và tên</label>
// //           <input
// //             name="name"
// //             required
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="Thầy/Cô..."
// //           />
// //         </div>
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Chuyên môn</label>
// //           <input
// //             name="specialization"
// //             required
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="IELTS 8.5, TOEIC 990..."
// //           />
// //         </div>
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Số điện thoại</label>
// //           <input
// //             name="phone"
// //             required
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="0901234567"
// //           />
// //         </div>
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Email</label>
// //           <input
// //             name="email"
// //             type="email"
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="teacher@example.com"
// //           />
// //         </div>
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Bằng cấp / Chứng chỉ</label>
// //           <input
// //             name="certificates"
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="Thạc sĩ, TESOL..."
// //           />
// //         </div>
// //         <div className="space-y-2">
// //           <label className="text-sm font-semibold text-slate-700">Mức lương / giờ</label>
// //           <input
// //             name="hourlyRate"
// //             type="number"
// //             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //             placeholder="500,000"
// //           />
// //         </div>
// //       </div>
// //       <div className="space-y-2">
// //         <label className="text-sm font-semibold text-slate-700">Kinh nghiệm giảng dạy</label>
// //         <textarea
// //           name="experience"
// //           rows={3}
// //           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
// //           placeholder="Mô tả ngắn gọn kinh nghiệm..."
// //         />
// //       </div>
// //       <div className="flex gap-3 pt-4">
// //         <button
// //           type="button"
// //           onClick={onCancel}
// //           className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
// //         >
// //           Hủy
// //         </button>
// //         <button
// //           type="submit"
// //           className="flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
// //         >
// //           Thêm giảng viên
// //         </button>
// //       </div>
// //     </form>
// //   );
// // }


// import React, { useState, useEffect } from 'react';
// import { User, Phone, Mail, BookOpen, GraduationCap, DollarSign, Briefcase, Globe, Landmark, FileText } from 'lucide-react';

// interface TeacherFormProps {
//   onSubmit: (data: any) => void;
//   onCancel: () => void;
//   initialData?: any;
// }

// export function TeacherForm({ onSubmit, onCancel, initialData }: TeacherFormProps) {
//   const [formData, setFormData] = useState<any>({
//     fullName: '',
//     email: '',
//     phone: '',
//     teacherCode: '',
//     specialization: '', // Sẽ convert sang mảng khi submit
//     skills: '',         // Sẽ convert sang mảng khi submit
//     experience: 0,
//     degree: '',
//     type: 'full-time',
//     status: 'active',
//     baseSalary: 0,
//     hourlyRate: 0,
//     bio: '',
//     bankInfo: { bankName: '', accountNumber: '', accountHolder: '' },
//     socialLinks: { linkedin: '', github: '', portfolio: '' }
//   });

//   useEffect(() => {
//     if (initialData) {
//       setFormData({
//         ...initialData,
//         specialization: Array.isArray(initialData.specialization) ? initialData.specialization.join(', ') : initialData.specialization,
//         skills: Array.isArray(initialData.skills) ? initialData.skills.join(', ') : initialData.skills,
//         birthday: initialData.birthday ? new Date(initialData.birthday).toISOString().split('T')[0] : ''
//       });
//     }
//   }, [initialData]);

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();

//     // Clean & Convert data
//     const payload = { ...formData };
//     payload.specialization = formData.specialization.split(',').map((s: string) => s.trim()).filter(Boolean);
//     payload.skills = formData.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
//     payload.experience = Number(payload.experience);
//     payload.baseSalary = Number(payload.baseSalary);
//     payload.hourlyRate = Number(payload.hourlyRate);

//     onSubmit(payload);
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
//       {/* 1. Thông tin cá nhân */}
//       <section className="space-y-4">
//         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
//           <User className="w-4 h-4" /> Thông tin cơ bản
//         </h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <input name="fullName" required placeholder="Họ và tên *" className="form-input-custom" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
//           <input name="teacherCode" placeholder="Mã giảng viên (VD: GV001)" className="form-input-custom" value={formData.teacherCode} onChange={e => setFormData({...formData, teacherCode: e.target.value})} />
//           <input name="phone" required placeholder="Số điện thoại *" className="form-input-custom" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
//           <input name="email" required type="email" placeholder="Email *" className="form-input-custom" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
//           <input name="birthday" type="date" className="form-input-custom" value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} />
//           <select className="form-input-custom" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
//             <option value="">Giới tính</option>
//             <option value="male">Nam</option>
//             <option value="female">Nữ</option>
//             <option value="other">Khác</option>
//           </select>
//         </div>
//       </section>

//       {/* 2. Chuyên môn */}
//       <section className="space-y-4">
//         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
//           <BookOpen className="w-4 h-4" /> Trình độ & Chuyên môn
//         </h3>
//         <div className="space-y-4">
//           <input placeholder="Chuyên môn (Cách nhau bằng dấu phẩy: Java, React...)" className="form-input-custom w-full" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} />
//           <input placeholder="Kỹ năng chi tiết (VD: Spring Boot, Redux, AWS...)" className="form-input-custom w-full" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} />
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <input placeholder="Bằng cấp (Thạc sĩ, Cử nhân...)" className="form-input-custom" value={formData.degree} onChange={e => setFormData({...formData, degree: e.target.value})} />
//             <input type="number" placeholder="Số năm kinh nghiệm" className="form-input-custom" value={formData.experience} onChange={e => setFormData({...formData, experience: e.target.value})} />
//           </div>
//         </div>
//       </section>

//       {/* 3. Tài chính & Hợp đồng */}
//       <section className="space-y-4">
//         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
//           <DollarSign className="w-4 h-4" /> Hợp đồng & Lương
//         </h3>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <select className="form-input-custom" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
//             <option value="full-time">Full-time</option>
//             <option value="part-time">Part-time</option>
//             <option value="freelance">Freelance</option>
//           </select>
//           <select className="form-input-custom" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
//             <option value="active">Đang làm việc</option>
//             <option value="on_leave">Đang nghỉ phép</option>
//             <option value="inactive">Đã nghỉ việc</option>
//           </select>
//           <input type="number" placeholder="Lương cơ bản (VND)" className="form-input-custom" value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: e.target.value})} />
//           <input type="number" placeholder="Thù lao/giờ (VND)" className="form-input-custom" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} />
//         </div>
//       </section>

//       {/* 4. Ngân hàng */}
//       <section className="space-y-4">
//         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
//           <Landmark className="w-4 h-4" /> Thông tin thanh toán
//         </h3>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <input placeholder="Tên ngân hàng" className="form-input-custom" value={formData.bankInfo.bankName} onChange={e => setFormData({...formData, bankInfo: {...formData.bankInfo, bankName: e.target.value}})} />
//           <input placeholder="Số tài khoản" className="form-input-custom" value={formData.bankInfo.accountNumber} onChange={e => setFormData({...formData, bankInfo: {...formData.bankInfo, accountNumber: e.target.value}})} />
//           <input placeholder="Chủ tài khoản" className="form-input-custom" value={formData.bankInfo.accountHolder} onChange={e => setFormData({...formData, bankInfo: {...formData.bankInfo, accountHolder: e.target.value}})} />
//         </div>
//       </section>

//       <div className="flex gap-3 pt-6 border-t sticky bottom-0 bg-white">
//         <button type="button" onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl">Hủy</button>
//         <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200">
//           {initialData ? 'Cập nhật hồ sơ' : 'Lưu giảng viên'}
//         </button>
//       </div>
//     </form>
//   );
// }

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../api/apiClient';
import {
  User, Phone, Mail, BookOpen, GraduationCap,
  DollarSign, Briefcase, Globe, Landmark, FileText,
  Calendar, MapPin, Award, Github, Linkedin, Shield,
  Clock
} from 'lucide-react';

interface TeacherFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function TeacherForm({ onSubmit, onCancel, initialData }: TeacherFormProps) {
  const [formData, setFormData] = useState<any>({
    fullName: '',
    email: '',
    phone: '',
    teacherCode: '',
    birthday: '',
    gender: 'male',
    address: '',
    avatar: '',
    specialization: '', // Sẽ convert sang mảng
    skills: '',         // Sẽ convert sang mảng
    experience: '',
    degree: '',
    bio: '',
    type: 'full-time',
    status: 'active',
    baseSalary: '',
    hourlyRate: '',
    bankInfo: { bankName: '', accountNumber: '', accountHolder: '' },
    socialLinks: { linkedin: '', github: '', portfolio: '' }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh không được vượt quá 5MB');
        return;
      }
      try {
        const formDataPayload = new FormData();
        formDataPayload.append('image', file);

        const res = await apiClient.post('/images/upload', formDataPayload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (res.data && res.data.success) {
          const absoluteUrl = `https://crm.deepcode.vn${res.data.imageUrl}`;
          setFormData({ ...formData, avatar: absoluteUrl });
          alert('Tải ảnh lên thành công!');
        } else {
          alert('Tải ảnh lên thất bại!');
        }
      } catch (error: any) {
        console.error('Lỗi khi tải ảnh:', error);
        alert(error.response?.data?.message || 'Lỗi khi tải ảnh lên');
      }
    }
  };

  // useEffect(() => {
  //   if (initialData) {
  //     setFormData({
  //       ...initialData,
  //       specialization: Array.isArray(initialData.specialization) ? initialData.specialization.join(', ') : '',
  //       skills: Array.isArray(initialData.skills) ? initialData.skills.join(', ') : '',
  //       birthday: initialData.birthday ? new Date(initialData.birthday).toISOString().split('T')[0] : '',
  //       bankInfo: initialData.bankInfo || { bankName: '', accountNumber: '', accountHolder: '' },
  //       socialLinks: initialData.socialLinks || { linkedin: '', github: '', portfolio: '' }
  //     });
  //   }
  // }, [initialData]);


  // TeacherForm.tsx

useEffect(() => {
  if (initialData) {
    setFormData({
      ...initialData,
      // Chuyển mảng về string để hiện trong ô input
      specialization: Array.isArray(initialData.specialization) 
        ? initialData.specialization.join(', ') 
        : (initialData.specialization || ''),
      
      skills: Array.isArray(initialData.skills) 
        ? initialData.skills.join(', ') 
        : (initialData.skills || ''),
        
      birthday: initialData.birthday ? new Date(initialData.birthday).toISOString().split('T')[0] : '',
      bankInfo: initialData.bankInfo || { bankName: '', accountNumber: '', accountHolder: '' },
      socialLinks: initialData.socialLinks || { linkedin: '', github: '', portfolio: '' }
    });
  } else {
    // Tự động generate teacherCode khi thêm mới
    const generateTeacherCode = async () => {
      try {
        const res = await apiClient.get('/teachers?limit=1');
        if (res.data && res.data.success) {
          const total = res.data.total || 0;
          const year = new Date().getFullYear();
          const nextId = (total + 1).toString().padStart(3, '0');
          setFormData(prev => ({ ...prev, teacherCode: `GV${year}-${nextId}` }));
        }
      } catch (err) {
        console.error('Lỗi khi tạo mã giảng viên tự động:', err);
      }
    };
    generateTeacherCode();
  }
}, [initialData]);

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();

  //   // Chuẩn hóa dữ liệu trước khi gửi lên API
  //   const payload = { 
  //     ...formData,
  //     specialization: formData.specialization.split(',').map((s: string) => s.trim()).filter(Boolean),
  //     skills: formData.skills.split(',').map((s: string) => s.trim()).filter(Boolean),
  //     experience: Number(formData.experience) || 0,
  //     baseSalary: Number(formData.baseSalary) || 0,
  //     hourlyRate: Number(formData.hourlyRate) || 0,
  //   };

  //   onSubmit(payload);
  // };

  // TeacherForm.tsx

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Chuyển đổi specialization từ string sang array
    // Ví dụ: "Java, React, " -> ["Java", "React"]
    const specArray = typeof formData.specialization === 'string'
      ? formData.specialization.split(',')
        .map((item: string) => item.trim()) // Xóa khoảng trắng 2 đầu
        .filter((item: string) => item !== "") // Loại bỏ phần tử rỗng
      : formData.specialization;

    // 2. Tương tự cho trường skills
    const skillsArray = typeof formData.skills === 'string'
      ? formData.skills.split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item !== "")
      : formData.skills;

    // 3. Tạo payload cuối cùng
    const payload = {
      ...formData,
      specialization: specArray,
      skills: skillsArray,
      experience: Number(formData.experience) || 0,
      baseSalary: Number(formData.baseSalary) || 0,
      hourlyRate: Number(formData.hourlyRate) || 0,
    };

    // Xóa các trường rỗng để tránh lỗi duplicate key (teacherCode) và CastError (birthday)
    if (!payload.teacherCode || payload.teacherCode.trim() === '') {
      delete payload.teacherCode;
    }
    if (!payload.birthday) {
      delete payload.birthday;
    }

    console.log("📦 Payload đã chuẩn hóa để gửi đi:", payload);
    onSubmit(payload);
  };

  const SectionTitle = ({ icon: Icon, title }: any) => (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4 mt-6 first:mt-0">
      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">{title}</h3>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto px-1 pr-3 custom-scrollbar">

      {/* 1. THÔNG TIN CÁ NHÂN */}
      <section>
        <SectionTitle icon={User} title="Thông tin cá nhân" />
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-2 mb-6 mt-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div 
            className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-indigo-50 shadow-md bg-slate-100 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {formData.avatar ? (
              <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100">
                <User className="w-12 h-12 text-slate-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-indigo-900/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <User className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">Tải ảnh</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] font-medium text-slate-400">Nhấn vào để tải ảnh lên</p>
            <button 
              type="button"
              onClick={() => {
                const url = window.prompt('Hoặc nhập URL ảnh đại diện:', formData.avatar || '');
                if (url !== null) {
                  setFormData({ ...formData, avatar: url.trim() });
                }
              }}
              className="text-[10px] text-indigo-600 hover:text-indigo-700 hover:underline font-bold"
            >
              Hoặc nhập URL ảnh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Họ và tên *</label>
            <input required className="form-input-custom" placeholder="Nguyễn Văn A" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Mã giảng viên *</label>
            <input required className="form-input-custom" placeholder="2024-001" value={formData.teacherCode} onChange={e => setFormData({ ...formData, teacherCode: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Số điện thoại *</label>
            <input required className="form-input-custom" placeholder="090..." value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Email *</label>
            <input required type="email" className="form-input-custom" placeholder="teacher@deepcode.edu.vn" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Ngày sinh *</label>
            <input required type="date" className="form-input-custom" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Giới tính</label>
            <select className="form-input-custom" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Địa chỉ hiện tại</label>
            <input className="form-input-custom" placeholder="Số nhà, tên đường, Quận/Huyện..." value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
        </div>
      </section>

      {/* 2. CHUYÊN MÔN & KỸ NĂNG */}
      <section>
        <SectionTitle icon={GraduationCap} title="Trình độ & Chuyên môn" />
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 ml-1">Bằng cấp cao nhất</label>
              <input className="form-input-custom" placeholder="Thạc sĩ, Cử nhân..." value={formData.degree} onChange={e => setFormData({ ...formData, degree: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 ml-1">Số năm kinh nghiệm</label>
              <input type="number" className="form-input-custom" placeholder="VD: 5" value={formData.experience} onChange={e => setFormData({ ...formData, experience: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1 flex items-center gap-1"><Award className="w-3 h-3 text-indigo-500" /> Mảng giảng dạy chính</label>
            <input className="form-input-custom" placeholder="Java, React, IELTS... (Cách nhau bằng dấu phẩy)" value={formData.specialization} onChange={e => setFormData({ ...formData, specialization: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Kỹ năng chi tiết / Công nghệ</label>
            <input className="form-input-custom" placeholder="Spring Boot, AWS, Speaking..." value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Giới thiệu ngắn (Bio)</label>
            <textarea rows={3} className="form-input-custom" placeholder="Mô tả tóm tắt về giảng viên..." value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
          </div>
        </div>
      </section>

      {/* 3. QUẢN LÝ & TÀI CHÍNH */}
      <section>
        <SectionTitle icon={Shield} title="Quản lý & Tài chính" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Hình thức hợp đồng</label>
            <select className="form-input-custom font-bold text-indigo-600" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="full-time">Full-time (Chính thức)</option>
              <option value="part-time">Part-time (Bán thời gian)</option>
              <option value="freelance">Freelance (Tự do)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Trạng thái công tác</label>
            <select className="form-input-custom font-bold text-emerald-600" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option value="active">Đang làm việc</option>
              <option value="on_leave">Nghỉ phép</option>
              <option value="inactive">Đã nghỉ việc</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Lương cơ bản (VND)</label>
            <div className="relative">
              <input type="number" className="form-input-custom pl-8" placeholder="0" value={formData.baseSalary} onChange={e => setFormData({ ...formData, baseSalary: e.target.value })} />
              <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 ml-1">Thù lao mỗi giờ (VND)</label>
            <div className="relative">
              <input type="number" className="form-input-custom pl-8" placeholder="0" value={formData.hourlyRate} onChange={e => setFormData({ ...formData, hourlyRate: e.target.value })} />
              <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. TÀI KHOẢN NGÂN HÀNG */}
      <section className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-6">
        <SectionTitle icon={Landmark} title="Thông tin thanh toán" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="form-input-custom bg-white" placeholder="Tên ngân hàng" value={formData.bankInfo.bankName} onChange={e => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, bankName: e.target.value } })} />
          <input className="form-input-custom bg-white" placeholder="Số tài khoản" value={formData.bankInfo.accountNumber} onChange={e => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, accountNumber: e.target.value } })} />
          <input className="form-input-custom bg-white md:col-span-2" placeholder="Chủ tài khoản (Không dấu)" value={formData.bankInfo.accountHolder} onChange={e => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, accountHolder: e.target.value.toUpperCase() } })} />
        </div>
      </section>

      {/* 5. MẠNG XÃ HỘI */}
      <section>
        <SectionTitle icon={Globe} title="Liên kết Profile" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <input className="form-input-custom pl-10" placeholder="LinkedIn URL" value={formData.socialLinks.linkedin} onChange={e => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, linkedin: e.target.value } })} />
            <Linkedin className="absolute left-3 top-3 w-4 h-4 text-blue-600" />
          </div>
          <div className="relative">
            <input className="form-input-custom pl-10" placeholder="GitHub URL" value={formData.socialLinks.github} onChange={e => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, github: e.target.value } })} />
            <Github className="absolute left-3 top-3 w-4 h-4 text-slate-800" />
          </div>
        </div>
      </section>

      {/* FOOTER BUTTONS */}
      <div className="flex gap-3 pt-6 border-t sticky bottom-0 bg-white z-10">
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Hủy bỏ</button>
        <button type="submit" className="flex-[2] py-3.5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 shadow-indigo-200 transition-all">
          {initialData ? 'Cập nhật hồ sơ' : 'Kích hoạt giảng viên mới'}
        </button>
      </div>
    </form>
  );
}

// Thêm CSS vào file global hoặc Tailwind config:
// .form-input-custom {
//   @apply w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm;
// }