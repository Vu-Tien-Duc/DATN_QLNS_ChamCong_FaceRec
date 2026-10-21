

// import React from 'react';
// import { Lead } from '../../types';

// interface StudentFormProps {
//   onSubmit: (data: any) => void;
//   onCancel: () => void;
//   initialData?: Partial<Lead>;
// }

// export function StudentForm({ onSubmit, onCancel, initialData }: StudentFormProps) {
  
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     const formData = new FormData(e.target as HTMLFormElement);
//     const rawData = Object.fromEntries(formData);
    
//     // --- XỬ LÝ DỮ LIỆU SẠCH (CLEAN DATA) ---
//     const cleanData: any = {};
    
//     Object.entries(rawData).forEach(([key, value]) => {
//       // Chỉ lấy các giá trị không rỗng
//       if (value !== "" && value !== null && value !== undefined) {
//         // Ép kiểu số cho điểm test
//         if (key === 'entranceTestScore') {
//           cleanData[key] = Number(value);
//         } else {
//           cleanData[key] = value;
//         }
//       }
//     });

//     // Truyền dữ liệu đã lọc lên hàm handleProfileSubmit ở trang cha
//     onSubmit(cleanData);
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-8 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
      
//       {/* 1. THÔNG TIN CƠ BẢN */}
//       <section className="space-y-4">
//         <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
//           <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
//           <h3 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h3>
//         </div>
        
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Họ và tên <span className="text-rose-500">*</span></label>
//             <input
//               name="fullName"
//               required
//               defaultValue={initialData?.name}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
//             />
//           </div>
          
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Giới tính</label>
//             <select
//               name="gender"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             >
//               <option value="male">Nam</option>
//               <option value="female">Nữ</option>
//               <option value="other">Khác</option>
//             </select>
//           </div>

//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Ngày sinh (Birthday)</label>
//             <input
//               name="birthday"
//               type="date"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>

//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">CCCD / CMND</label>
//             <input
//               name="idCard"
//               placeholder="Nhập số định danh..."
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>

//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-rose-500">*</span></label>
//             <input
//               name="phone"
//               required
//               defaultValue={initialData?.phone}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>

//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Email</label>
//             <input
//               name="email"
//               type="email"
//               defaultValue={initialData?.email}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>

//           <div className="md:col-span-2 space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Địa chỉ thường trú</label>
//             <input
//               name="address"
//               placeholder="Số nhà, tên đường, phường/xã..."
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//         </div>
//       </section>

//       {/* 2. THÔNG TIN LIÊN HỆ PHỤ HUYNH */}
//       <section className="space-y-4">
//         <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
//           <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
//           <h3 className="text-lg font-bold text-slate-900">Thông tin phụ huynh / Người bảo hộ</h3>
//         </div>
        
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Họ tên phụ huynh</label>
//             <input
//               name="parentName"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Quan hệ</label>
//             <select name="parentRelationship" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
//               <option value="Father">Cha</option>
//               <option value="Mother">Mẹ</option>
//               <option value="Guardian">Người giám hộ</option>
//               <option value="Other">Khác</option>
//             </select>
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">SĐT phụ huynh</label>
//             <input
//               name="parentPhone"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Email phụ huynh</label>
//             <input
//               name="parentEmail"
//               type="email"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//         </div>
//       </section>

//       {/* 3. THÔNG TIN HỌC TẬP & HỆ THỐNG */}
//       <section className="space-y-4">
//         <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
//           <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
//           <h3 className="text-lg font-bold text-slate-900">Hồ sơ học vấn & Trạng thái</h3>
//         </div>
        
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Trường (Đang học/Tốt nghiệp)</label>
//             <input
//               name="school"
//               defaultValue={initialData?.school}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Năm học / Khối</label>
//             <input
//               name="studyYear"
//               defaultValue={initialData?.studyYear}
//               placeholder="VD: Năm 3, Lớp 12..."
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Điểm test đầu vào</label>
//             <input
//               name="entranceTestScore"
//               type="number"
//               step="0.1"
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-amber-600"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Trình độ hiện tại</label>
//             <input
//               name="currentLevel"
//               placeholder="VD: Beginner, A2, IELTS 5.0..."
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Trạng thái học viên</label>
//             <select name="status" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-emerald-600">
//               <option value="studying">Đang học (Chính thức)</option>
//               <option value="trial">Học thử (Trial)</option>
//               <option value="pause">Bảo lưu</option>
//             </select>
//           </div>
//           <div className="space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Người giới thiệu</label>
//             <input
//               name="referrer"
//               defaultValue={initialData?.referrer}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             />
//           </div>
//           <div className="md:col-span-2 space-y-1">
//             <label className="text-sm font-semibold text-slate-700">Ghi chú đặc điểm học viên</label>
//             <textarea
//               name="note"
//               rows={2}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//               placeholder="Điểm mạnh, điểm yếu hoặc các lưu ý đặc biệt..."
//             />
//           </div>
//         </div>
//       </section>

//       {/* NÚT ĐIỀU HƯỚNG */}
//       <div className="flex gap-3 pt-6 border-t border-slate-100 sticky bottom-0 bg-white">
//         <button
//           type="button"
//           onClick={onCancel}
//           className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
//         >
//           Hủy bỏ
//         </button>
//         <button
//           type="submit"
//           className="flex-[2] px-6 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
//         >
//           Tiếp tục: Đăng ký lớp & Học phí
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
//         </button>
//       </div>
//     </form>
//   );
// }


import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/apiClient';
import { Lead } from '../../types';
import { toast } from 'react-hot-toast';

interface StudentFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any; // Dữ liệu từ Lead truyền sang
}

export function StudentForm({ onSubmit, onCancel, initialData }: StudentFormProps) {
  const [createParentAccount, setCreateParentAccount] = useState(false);
  const [parentAccountPassword, setParentAccountPassword] = useState('123456');
  // 1. Khởi tạo state cho toàn bộ form dựa trên Model Student
  const [formData, setFormData] = useState({
    fullName: '',
    gender: 'male',
    birthday: '',
    idCard: '',
    phone: '',
    email: '',
    address: '',
    parentAccountId: '', // ← ID tài khoản phụ huynh trên hệ thống
    parentName: '',
    parentRelationship: 'Father',
    parentPhone: '',
    parentEmail: '',
    school: '',
    studyYear: '',
    entranceTestScore: '',
    currentLevel: '',
    status: 'studying',
    referrer: '',
    note: ''
  });

  const [parentUsers, setParentUsers] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  // Tải danh sách tài khoản phụ huynh
  const fetchParentUsers = useCallback(async () => {
    setLoadingParents(true);
    try {
      const res = await apiClient.get('/students/parents/list');
      if (res.data.success) {
        setParentUsers(res.data.data);
      }
    } catch (e) {
      console.error('Không tải được danh sách phụ huynh', e);
    } finally {
      setLoadingParents(false);
    }
  }, []);

  useEffect(() => { fetchParentUsers(); }, [fetchParentUsers]);


  console.log("init-data-student:", initialData);
  // 2. Đồng bộ hóa dữ liệu từ initialData (Lead) vào State của Form
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        fullName: initialData.fullName || initialData.name || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        school: initialData.school || '',
        studyYear: initialData.studyYear || '',
        referrer: initialData.referrer || '',
        address: initialData.address || '',
        parentAccountId: initialData.parentAccountId?._id || initialData.parentAccountId || '',
        parentName: initialData.parentName || '',
        parentPhone: initialData.parentPhone || '',
        parentEmail: initialData.parentEmail || '',
        parentRelationship: initialData.parentRelationship || 'Father',
        birthday: initialData.birthday ? new Date(initialData.birthday).toISOString().split('T')[0] : ''
      }));
    }
  }, [initialData]);

  // 3. Hàm xử lý thay đổi input chung
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'parentAccountId') {
      const selectedParent = parentUsers.find(u => u._id === value);
      if (selectedParent) {
        // Kiểm tra xem bên dưới đã có bất kỳ thông tin phụ huynh nào chưa
        const hasExistingInfo = !!(
          formData.parentName?.trim() ||
          formData.parentPhone?.trim() ||
          formData.parentEmail?.trim()
        );

        if (hasExistingInfo) {
          const confirmUpdate = window.confirm(
            "Đã có thông tin phụ huynh bên dưới. Bạn có muốn cập nhật thông tin phụ huynh (Họ tên, SĐT, Email) theo tài khoản Portal đã chọn hay không?"
          );
          if (confirmUpdate) {
            setFormData((prev) => ({
              ...prev,
              parentAccountId: value,
              parentName: selectedParent.fullName || '',
              parentPhone: selectedParent.phone || '',
              parentEmail: selectedParent.email || ''
            }));
          } else {
            // Giữ nguyên thông tin bên dưới, chỉ liên kết tài khoản portal
            setFormData((prev) => ({
              ...prev,
              parentAccountId: value
            }));
          }
        } else {
          // Chưa có thông tin thì tự động điền luôn
          setFormData((prev) => ({
            ...prev,
            parentAccountId: value,
            parentName: selectedParent.fullName || '',
            parentPhone: selectedParent.phone || '',
            parentEmail: selectedParent.email || ''
          }));
        }
        return;
      } else {
        // Trường hợp chọn "-- Chưa có / Chưa gán tài khoản --"
        setFormData((prev) => ({
          ...prev,
          parentAccountId: ''
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- XỬ LÝ DỮ LIỆU SẠCH (CLEAN DATA) ---
    const cleanData: any = {};
    Object.entries(formData).forEach(([key, value]) => {
      // Chỉ lấy các giá trị không rỗng để gửi API
      if (value !== "" && value !== null && value !== undefined) {
        if (key === 'entranceTestScore') {
          cleanData[key] = Number(value);
        } else {
          cleanData[key] = value;
        }
      }
    });

    if (createParentAccount) {
      if (!formData.parentEmail) {
        toast.error('Email phụ huynh là bắt buộc khi chọn tự động tạo tài khoản portal!');
        return;
      }
      cleanData.createParentAccount = true;
      cleanData.parentAccountPassword = parentAccountPassword;
    }

    onSubmit(cleanData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
      
      {/* 1. THÔNG TIN CƠ BẢN */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
          <h3 className="text-lg font-bold text-slate-900">Thông tin cá nhân học viên</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Họ và tên <span className="text-rose-500">*</span></label>
            <input
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Giới tính</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Ngày sinh</label>
            <input
              name="birthday"
              type="date"
              value={formData.birthday}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-rose-500">*</span></label>
            <input
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">CCCD / CMND</label>
            <input
              name="idCard"
              value={formData.idCard}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="Nhập số định danh..."
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-semibold text-slate-700">Địa chỉ thường trú</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Số nhà, tên đường, phường/xã..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>
        </div>
      </section>

      {/* 2. THÔNG TIN PHỤ HUYNH */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
          <h3 className="text-lg font-bold text-slate-900">Thông tin phụ huynh</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── QUAN TRỌNG: Gán tài khoản portal phụ huynh ── */}
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              🔗 Tài khoản Portal phụ huynh
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">Liên kết SteamLab</span>
            </label>
            <select
              name="parentAccountId"
              value={createParentAccount ? '' : formData.parentAccountId}
              onChange={handleChange}
              disabled={createParentAccount}
              className={`w-full px-4 py-3 border-2 rounded-xl outline-none font-medium transition-colors ${
                createParentAccount 
                  ? 'bg-slate-100 border-slate-200 text-slate-455/50 cursor-not-allowed text-slate-400' 
                  : 'bg-blue-50 border-blue-200 text-slate-700 focus:border-blue-500'
              }`}
            >
              <option value="">-- Chưa có / Chưa gán tài khoản --</option>
              {loadingParents ? (
                <option disabled>Đang tải danh sách...</option>
              ) : (
                parentUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName} ({u.email})
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Chọn tài khoản phụ huynh đã tạo ở mục <strong>Quản lý Users</strong>. Sau khi gán, phụ huynh sẽ thấy thông tin của con em khi đăng nhập tại steamlab.deepcode.vn.
            </p>
          </div>

          {/* Tùy chọn Tự động tạo tài khoản Portal */}
          <div className="md:col-span-2 flex items-center gap-2 py-2 px-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <input
              type="checkbox"
              id="createParentAccount"
              checked={createParentAccount}
              onChange={(e) => setCreateParentAccount(e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="createParentAccount" className="text-xs font-bold text-blue-800 cursor-pointer select-none">
              ⚡ Tự động tạo tài khoản Portal phụ huynh mới (Dựa vào Email phụ huynh bên dưới)
            </label>
          </div>

          {createParentAccount && (
            <div className="md:col-span-2 space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
              <label className="text-xs font-bold text-amber-800">Mật khẩu tài khoản phụ huynh mới</label>
              <input
                type="text"
                value={parentAccountPassword}
                onChange={(e) => setParentAccountPassword(e.target.value)}
                className="w-full px-4 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                placeholder="Nhập mật khẩu hoặc để mặc định..."
              />
              <p className="text-[10px] text-amber-700">
                Tài khoản sẽ được tạo tự động sau khi lưu học sinh, sử dụng <strong>Email phụ huynh</strong> làm tài khoản đăng nhập và mật khẩu phía trên.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Họ tên phụ huynh</label>
            <input name="parentName" value={formData.parentName} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Quan hệ</label>
            <select name="parentRelationship" value={formData.parentRelationship} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              <option value="Father">Cha</option>
              <option value="Mother">Mẹ</option>
              <option value="Guardian">Người giám hộ</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">SĐT phụ huynh</label>
            <input name="parentPhone" value={formData.parentPhone} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Email phụ huynh</label>
            <input name="parentEmail" type="email" value={formData.parentEmail} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
        </div>
      </section>

      {/* 3. THÔNG TIN HỌC TẬP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
          <h3 className="text-lg font-bold text-slate-900">Hồ sơ học vấn</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Trường đang học</label>
            <input name="school" value={formData.school} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Năm học / Khối</label>
            <input name="studyYear" value={formData.studyYear} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Điểm test đầu vào</label>
            <input name="entranceTestScore" type="number" value={formData.entranceTestScore} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Trạng thái học viên</label>
            <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-emerald-600">
              <option value="studying">Đang học (Chính thức)</option>
              <option value="trial">Học thử (Trial)</option>
              <option value="pause">Bảo lưu</option>
            </select>
          </div>
        </div>
      </section>

      {/* NÚT ĐIỀU HƯỚNG */}
      <div className="flex gap-3 pt-6 border-t border-slate-100 sticky bottom-0 bg-white z-10">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          className="flex-[2] px-6 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
        >
          Bước tiếp theo: Đăng ký & Học phí
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>
    </form>
  );
}