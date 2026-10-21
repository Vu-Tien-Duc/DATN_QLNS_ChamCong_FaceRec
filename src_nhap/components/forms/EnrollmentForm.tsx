import React, { useState, useEffect } from 'react';
import { Student, Course, Class } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Loader2, User, BookOpen, Tag, DollarSign, ShieldCheck, Edit3 } from 'lucide-react';

interface EnrollmentFormProps {
  courses: Course[];
  classes: Class[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  initialStudent?: any;
}

export function EnrollmentForm({ courses, classes, onSubmit, onCancel, initialData, initialStudent }: EnrollmentFormProps) {
  const { user: currentUser } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // --- STATE QUẢN LÝ FORM ---
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [tuitionFee, setTuitionFee] = useState(0); // Học phí gốc (Có thể sửa)
  const [discount, setDiscount] = useState(0);    // Giảm giá
  const [status, setStatus] = useState('Active');
  const [note, setNote] = useState('');

  // 1. Khởi tạo dữ liệu
  useEffect(() => {
    const initForm = async () => {
      setLoadingStudents(true);
      try {
        const res = await apiClient.get('/students?limit=100');
        if (res.data.success) setStudents(res.data.data);

        if (initialData) {
          setSelectedStudentId(initialData.student?._id || initialData.student || '');
          setSelectedCourseId(initialData.course?._id || initialData.course || '');
          setSelectedClassId(initialData.class?._id || initialData.class || '');
          setTuitionFee(initialData.tuitionFee || 0);
          setDiscount(initialData.discount || 0);
          setStatus(initialData.status || 'Active');
          setNote(initialData.note || '');
        } else if (initialStudent) {
          setSelectedStudentId(initialStudent._id || initialStudent.id);
        }
      } catch (e) {
        toast.error("Lỗi tải dữ liệu");
      } finally {
        setLoadingStudents(false);
      }
    };
    initForm();
  }, [initialData, initialStudent]);

  // 2. Xử lý khi chọn Khóa học
  const onCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);

    // Tìm thông tin khóa học để lấy giá mặc định
    // Kiểm tra cả _id và id để tránh lỗi mapping API
    const foundCourse = courses.find((c: any) => (c._id === courseId || c.id === courseId));

    if (foundCourse) {
      setTuitionFee(foundCourse.price || 0);
      toast.success(`Đã áp dụng giá mặc định cho khóa ${foundCourse.name}`);
    }
    setSelectedClassId(''); // Reset lớp khi đổi khóa
  };

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();

  //   const payload: any = {
  //     student: selectedStudentId,
  //     course: selectedCourseId,
  //     tuitionFee: Number(tuitionFee),
  //     discount: Number(discount),
  //     finalFee: Number(tuitionFee) - Number(discount),
  //     status,
  //     note,
  //     staff: currentUser?._id
  //   };

  //   if (selectedClassId && selectedClassId !== "") {
  //     payload.class = selectedClassId;
  //   }

  //   if (!payload.student || !payload.course) {
  //     return toast.error("Vui lòng chọn đầy đủ học viên và khóa học");
  //   }

  //   onSubmit(payload);
  // };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Ép kiểu chắc chắn là Number
    const tFee = Number(tuitionFee) || 0;
    const dCount = Number(discount) || 0;

    const payload: any = {
      student: selectedStudentId,
      course: selectedCourseId,
      tuitionFee: tFee,
      discount: dCount,
      finalFee: tFee - dCount, // Tính toán sẵn để gửi lên server
      status: status,
      note: note,
      staff: currentUser?._id
    };

    if (selectedClassId && selectedClassId !== "") {
      payload.class = selectedClassId;
    }

    if (!payload.student || !payload.course) {
      return toast.error("Vui lòng chọn học viên và khóa học");
    }

    onSubmit(payload);
  };
  // Lọc danh sách lớp theo khóa học
  const filteredClasses = classes.filter((c: any) => {
    const courseRef = c.course?._id || c.course;
    return courseRef === selectedCourseId || !selectedCourseId;
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">

      {/* PHẦN 1: HỌC VIÊN */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <User className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-slate-800">Thông tin học viên</h3>
        </div>
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          required
          disabled={!!initialData || !!initialStudent}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-70"
        >
          <option value="">-- Chọn học viên --</option>
          {students.map(s => (
            <option key={s._id} value={s._id}>{s.fullName} - {s.phone}</option>
          ))}
        </select>
      </section>

      {/* PHẦN 2: KHÓA HỌC & LỚP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-slate-800">Đăng ký chương trình</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Khóa học đăng ký *</label>
            <select
              required
              value={selectedCourseId}
              // disabled={!!initialData}  <-- XÓA HOẶC COMMENT DÒNG NÀY ĐI
              onChange={(e) => onCourseSelect(e.target.value)} // Sử dụng hàm onCourseSelect thay vì set trực tiếp
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((c: any) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Lớp học (Tùy chọn)</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Chưa xếp lớp / Bổ sung sau --</option>
              {filteredClasses.map((cls: any) => (
                <option key={cls._id} value={cls._id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* PHẦN 3: TÀI CHÍNH (Đã cho phép sửa Tuition Fee) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-bold text-slate-800">Học phí & Chiết khấu</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              Học phí gốc (VND) <Edit3 className="w-3 h-3 text-slate-400" />
            </label>
            <input
              type="number"
              value={tuitionFee}
              onChange={(e) => setTuitionFee(Number(e.target.value))}
              placeholder="Nhập giá tiền..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Số tiền giảm giá (VND)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
            />
          </div>

          <div className="md:col-span-2 p-6 bg-slate-900 rounded-xs text-white flex justify-between items-center shadow-xl">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng học phí thực thu</p>
              <p className="text-3xl font-black text-emerald-400">
                {Math.max(0, (Number(tuitionFee || 0) - Number(discount || 0))).toLocaleString('vi-VN')}
                <span className="text-sm font-normal">VND</span>
              </p>
            </div>
            <ShieldCheck className="w-10 h-10 text-slate-700" />
          </div>
        </div>
      </section>

      {/* Ghi chú & Trạng thái */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-bold text-slate-700">Ghi chú ghi danh</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            placeholder="Ghi chú về ưu đãi hoặc thỏa thuận riêng..."
          />
        </div>

        {initialData && (
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Trạng thái hồ sơ</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-indigo-600"
            >
              <option value="Active">Đang học (Active)</option>
              <option value="Completed">Hoàn thành (Completed)</option>
              <option value="Dropped">Đã thôi học (Dropped)</option>
              <option value="Reserved">Bảo lưu (Reserved)</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-6 sticky bottom-0 bg-white border-t py-4">
        <button type="button" onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl">Hủy</button>
        <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">
          {initialData ? 'Lưu thay đổi' : 'Xác nhận ghi danh'}
        </button>
      </div>
    </form>
  );
}