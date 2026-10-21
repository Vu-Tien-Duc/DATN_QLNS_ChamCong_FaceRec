
// import React, { useEffect, useState } from 'react';
// import { Lead } from '../../types';
// import { apiClient } from '../../api/apiClient';
// import { toast } from 'react-hot-toast';
// import { Loader2, User, Phone, Mail, BookOpen, Users, MapPin, Calendar, Target } from 'lucide-react';

// interface LeadFormProps {
//   onSubmit: (data: any) => void;
//   onCancel: () => void;
//   initialData?: Lead;
// }

// export function LeadForm({ onSubmit, onCancel, initialData }: LeadFormProps) {
//   const [users, setUsers] = useState<any[]>([]);
//   const [loadingUsers, setLoadingUsers] = useState(false);
//    // 1. Tạo state riêng cho nhân viên phụ trách để kiểm soát việc hiển thị (Controlled Select)
//   const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>("");
//   // 1. Fetch danh sách nhân viên từ hệ thống để đổ vào select AssignedTo
//   useEffect(() => {
//     const fetchEmployees = async () => {
//       try {
//         setLoadingUsers(true);
//         const res = await apiClient.get('/users');
//         if (res.data.success) {
//           setUsers(res.data.data);
//         }
//       } catch (error) {
//         console.error("Lỗi khi tải danh sách nhân viên:", error);
//         toast.error("Không thể tải danh sách nhân viên");
//       } finally {
//         setLoadingUsers(false);
//       }
//     };
//     fetchEmployees();
//   }, []);


//    // 3. Quan trọng: Khi initialData thay đổi (mở Modal), cập nhật state selectedAssignedTo
//   useEffect(() => {
//     if (initialData?.assignedTo) {
//       // Nếu assignedTo là Object (do populate) thì lấy ._id, nếu là String thì lấy luôn
//       const id = typeof initialData.assignedTo === 'object' 
//         ? (initialData.assignedTo as any)?._id 
//         : initialData.assignedTo;
      
//       setSelectedAssignedTo(id || "");
//     } else {
//       setSelectedAssignedTo("");
//     }
//   }, [initialData]);

//   // 2. Xử lý logic Submit
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     const formData = new FormData(e.target as HTMLFormElement);
//     const data: any = Object.fromEntries(formData);

//     // --- CHUẨN HÓA DỮ LIỆU TRƯỚC KHI GỬI ---
//     // Nếu không chọn nhân viên, xóa trường này để tránh gửi chuỗi rỗng "" lên gây lỗi ID
//     if (!data.assignedTo) {
//       delete data.assignedTo;
//     }

//     // Nếu testAppointmentTime trống, xóa để tránh lỗi Date
//     if (!data.testAppointmentTime) {
//       delete data.testAppointmentTime;
//     }

//     // Chuyển năm sinh về kiểu Number
//     if (data.birthYear) {
//       data.birthYear = Number(data.birthYear);
//     }

//     onSubmit(data);
//   };

//   // 3. Xử lý defaultValue cho assignedTo (Nếu là object do populate thì lấy ID)
//   const currentAssignedId = typeof initialData?.assignedTo === 'object' 
//     ? (initialData.assignedTo as any)?._id 
//     : initialData?.assignedTo;

//   return (
//     <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto px-1 custom-scrollbar">
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
//         {/* Họ tên */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <User className="w-4 h-4 text-slate-400" /> Họ và tên
//           </label>
//           <input
//             name="name"
//             required
//             defaultValue={initialData?.name}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
//             placeholder="Ví dụ: Nguyễn Văn A"
//           />
//         </div>

//         {/* Số điện thoại */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
//           </label>
//           <input
//             name="phone"
//             required
//             defaultValue={initialData?.phone}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
//             placeholder="0987654321"
//           />
//         </div>

//          {/* Nhân viên phụ trách - Đã sửa thành Controlled Select */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <Users className="w-4 h-4 text-blue-500" /> Nhân viên phụ trách
//           </label>
//           <div className="relative">
//             <select
//               name="assignedTo"
//               // Dùng value thay vì defaultValue để React kiểm soát
//               value={selectedAssignedTo} 
//               onChange={(e) => setSelectedAssignedTo(e.target.value)}
//               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
//             >
//               <option value="">-- Chưa gán / Để trống --</option>
//               {users.map((u) => (
//                 <option key={u._id} value={u._id}>
//                   {u.fullName} ({u.email})
//                 </option>
//               ))}
//             </select>
            
//             {/* Loading Indicator */}
//             {loadingUsers ? (
//               <div className="absolute right-10 top-1/2 -translate-y-1/2">
//                 <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
//               </div>
//             ) : (
//               // Icon mũi tên xuống cho select custom
//               <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
//                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
//               </div>
//             )}
//           </div>
//           {initialData?.assignedTo && !loadingUsers && users.length > 0 && !users.find(u => u._id === selectedAssignedTo) && (
//             <p className="text-[10px] text-rose-500 italic">Lưu ý: Nhân sự cũ không còn tồn tại hoặc đã bị ẩn.</p>
//           )}
//         </div>

//         {/* Trạng thái Lead */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Trạng thái Lead</label>
//           <select
//             name="status"
//             defaultValue={initialData?.status || 'New Lead'}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
//           >
//             <option value="New Lead">New Lead</option>
//             <option value="Contacted">Contacted</option>
//             <option value="Interested">Interested</option>
//             <option value="Trial class">Trial class</option>
//             <option value="Qualified Lead">Qualified Lead</option>
//             <option value="Converted">Converted</option>
//             <option value="Lost">Lost</option>
//           </select>
//         </div>

//         {/* Email */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <Mail className="w-4 h-4 text-slate-400" /> Email
//           </label>
//           <input
//             name="email"
//             type="email"
//             defaultValue={initialData?.email}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
//             placeholder="example@gmail.com"
//           />
//         </div>

//         {/* Khóa học quan tâm */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <BookOpen className="w-4 h-4 text-slate-400" /> Khóa học quan tâm
//           </label>
//           <input
//             name="courseInterest"
//             defaultValue={initialData?.courseInterest}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
//             placeholder="Ví dụ: FullStack, Java..."
//           />
//         </div>

//         {/* Nguồn Lead */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Nguồn Lead</label>
//           <select
//             name="source"
//             defaultValue={initialData?.source}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
//           >
//             <option value="Website">Website</option>
//             <option value="Facebook Ads">Facebook Ads</option>
//             <option value="TikTok">TikTok</option>
//             <option value="Landing page">Landing page</option>
//             <option value="Hotline">Hotline</option>
//             <option value="Offline event">Offline event</option>
//             <option value="Referral">Referral (giới thiệu)</option>
//           </select>
//         </div>

//         {/* Độ nóng */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Độ nóng</label>
//           <select
//             name="temperature"
//             defaultValue={initialData?.temperature}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
//           >
//             <option value="Hot">Hot 🔥</option>
//             <option value="Warm">Warm ☀️</option>
//             <option value="Cold">Cold ❄️</option>
//           </select>
//         </div>

//         {/* Thông tin học vấn */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Trường</label>
//           <input name="school" defaultValue={initialData?.school} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
//         </div>
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Năm sinh</label>
//           <input name="birthYear" type="number" defaultValue={initialData?.birthYear} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="2005" />
//         </div>

//         {/* Hình thức học */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <MapPin className="w-4 h-4 text-slate-400" /> Hình thức học
//           </label>
//           <select name="learningMechanism" defaultValue={initialData?.learningMechanism} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all">
//             <option value="Offline">Offline (Tại trung tâm)</option>
//             <option value="Online">Online</option>
//             <option value="Hybrid">Hybrid (Cả hai)</option>
//           </select>
//         </div>

//         {/* Lịch hẹn test */}
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//             <Calendar className="w-4 h-4 text-slate-400" /> Lịch hẹn test
//           </label>
//           <input
//             name="testAppointmentTime"
//             type="datetime-local"
//             defaultValue={initialData?.testAppointmentTime ? new Date(initialData.testAppointmentTime).toISOString().slice(0, 16) : ""}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
//           />
//         </div>
//       </div>

//       {/* Ghi chú dài */}
//       <div className="space-y-4">
//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
//              <Target className="w-4 h-4 text-slate-400" /> Mục tiêu học tập
//           </label>
//           <textarea
//             name="goal"
//             rows={2}
//             defaultValue={initialData?.goal}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
//             placeholder="Học để đi làm, hoàn thành khóa luận..."
//           />
//         </div>

//         <div className="space-y-2">
//           <label className="text-sm font-bold text-slate-700">Đánh giá sơ bộ/Phản ứng giá</label>
//           <textarea
//             name="preliminaryAssessment"
//             rows={3}
//             defaultValue={initialData?.preliminaryAssessment}
//             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
//             placeholder="Khả năng tài chính tốt, ra quyết định nhanh..."
//           />
//         </div>
//       </div>

//       {/* Buttons */}
//       <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t">
//         <button
//           type="button"
//           onClick={onCancel}
//           className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
//         >
//           Hủy
//         </button>
//         <button
//           type="submit"
//           className="flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
//         >
//           {initialData ? 'Cập nhật Lead' : 'Lưu Lead mới'}
//         </button>
//       </div>
//     </form>
//   );
// }


import React, { useEffect, useState } from 'react';
import { Lead } from '../../types';
import { apiClient } from '../../api/apiClient';
import { toast } from 'react-hot-toast';
import { Loader2, User, Phone, Mail, BookOpen, Users, MapPin, Calendar, Target, Share2 } from 'lucide-react';

interface LeadFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: Lead;
}

export function LeadForm({ onSubmit, onCancel, initialData }: LeadFormProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]); 
  const [courses, setCourses] = useState<any[]>([]); 
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingUsers(true);
        setLoadingSources(true);
        setLoadingCourses(true);
        
        const [resUsers, resSources, resCourses] = await Promise.all([
          apiClient.get('/users'),
          apiClient.get('/lead-sources'),
          apiClient.get('/courses')
        ]);

        if (resUsers.data.success) setUsers(resUsers.data.data);
        if (resSources.data.success) setSources(resSources.data.data);
        if (resCourses.data.success) setCourses(resCourses.data.data);

      } catch (error) {
        console.error("Lỗi khi tải dữ liệu cấu hình:", error);
        toast.error("Không thể tải dữ liệu hệ thống");
      } finally {
        setLoadingUsers(false);
        setLoadingSources(false);
        setLoadingCourses(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (initialData) {
      const userId = typeof initialData.assignedTo === 'object' 
        ? (initialData.assignedTo as any)?._id 
        : initialData.assignedTo;
      setSelectedAssignedTo(userId || "");

      const sourceId = typeof initialData.source === 'object'
        ? (initialData.source as any)?._id
        : initialData.source;
      setSelectedSource(sourceId || "");

      setSelectedCourse(initialData.courseInterest || "");
    }
  }, [initialData]);

  // 3. Xử lý logic Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data: any = Object.fromEntries(formData);

    // Gán dữ liệu từ các state controlled
    data.assignedTo = selectedAssignedTo;
    data.source = selectedSource;
    data.courseInterest = selectedCourse;

    // --- CHUẨN HÓA DỮ LIỆU TRƯỚC KHI GỬI ---
    if (!data.assignedTo) delete data.assignedTo;
    if (!data.source) delete data.source;
    if (!data.courseInterest) delete data.courseInterest;
    if (!data.testAppointmentTime) delete data.testAppointmentTime;
    if (data.birthYear) data.birthYear = Number(data.birthYear);

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto px-1 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Họ tên */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" /> Họ và tên
          </label>
          <input
            name="name"
            required
            defaultValue={initialData?.name}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            placeholder="Ví dụ: Nguyễn Văn A"
          />
        </div>

        {/* Số điện thoại */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
          </label>
          <input
            name="phone"
            required
            defaultValue={initialData?.phone}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            placeholder="0987654321"
          />
        </div>

        {/* Nhân viên phụ trách */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Nhân viên phụ trách
          </label>
          <div className="relative">
            <select
              value={selectedAssignedTo} 
              onChange={(e) => setSelectedAssignedTo(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none"
            >
              <option value="">-- Chưa gán / Để trống --</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
              ))}
            </select>
            {loadingUsers && <Loader2 className="absolute right-10 top-3.5 w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>

        {/* Nguồn Lead (ĐÃ ĐỔI SANG API) */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-500" /> Nguồn Lead
          </label>
          <div className="relative">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none"
            >
              <option value="">-- Chọn nguồn --</option>
              {sources.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.channel})</option>
              ))}
            </select>
            {loadingSources && <Loader2 className="absolute right-10 top-3.5 w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>

        {/* Khóa học quan tâm (ĐỔI SANG SELECT) */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" /> Khóa học quan tâm
          </label>
          <div className="relative">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none"
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {loadingCourses && <Loader2 className="absolute right-10 top-3.5 w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>

        {/* Trạng thái Lead */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Trạng thái Lead</label>
          <select
            name="status"
            defaultValue={initialData?.status || 'New Lead'}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          >
            <option value="New Lead">New Lead</option>
            <option value="Contacted">Contacted</option>
            <option value="Interested">Interested</option>
            <option value="Trial class">Trial class</option>
            <option value="Qualified Lead">Qualified Lead</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>
        </div>

        {/* Độ nóng */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Độ nóng</label>
          <select
            name="temperature"
            defaultValue={initialData?.temperature}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          >
            <option value="Hot">Hot 🔥</option>
            <option value="Warm">Warm ☀️</option>
            <option value="Cold">Cold ❄️</option>
          </select>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" /> Email
          </label>
          <input
            name="email"
            type="email"
            defaultValue={initialData?.email}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            placeholder="example@gmail.com"
          />
        </div>


        {/* Thông tin học vấn */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Trường</label>
          <input name="school" defaultValue={initialData?.school} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Năm sinh</label>
          <input name="birthYear" type="number" defaultValue={initialData?.birthYear} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="2005" />
        </div>

        {/* Hình thức học */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" /> Hình thức học
          </label>
          <select name="learningMechanism" defaultValue={initialData?.learningMechanism} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
            <option value="Offline">Offline</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>

        {/* Lịch hẹn test */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" /> Lịch hẹn test
          </label>
          <input
            name="testAppointmentTime"
            type="datetime-local"
            defaultValue={initialData?.testAppointmentTime ? new Date(initialData.testAppointmentTime).toISOString().slice(0, 16) : ""}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Ghi chú dài */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
             <Target className="w-4 h-4 text-slate-400" /> Mục tiêu học tập
          </label>
          <textarea
            name="goal"
            rows={2}
            defaultValue={initialData?.goal}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            placeholder="Mục tiêu học tập của em là..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Đánh giá sơ bộ/Phản ứng giá</label>
          <textarea
            name="preliminaryAssessment"
            rows={3}
            defaultValue={initialData?.preliminaryAssessment}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
        >
          Hủy
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
        >
          {initialData ? 'Cập nhật Lead' : 'Lưu Lead mới'}
        </button>
      </div>
    </form>
  );
}
