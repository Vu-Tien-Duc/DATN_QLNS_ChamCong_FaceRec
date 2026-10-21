import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Calculator, User, BookOpen, ArrowLeft,
  Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Percent
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Grades() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isTeacher = hasRole('teacher');
  const isStudent = hasRole('student');
  const hasFullAccess = isAdmin || user?.email === 'admin@deepcode.vn';

  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dữ liệu bảng điểm
  const [students, setStudents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [gradeMatrix, setGradeMatrix] = useState<Record<string, any>>({});

  // 1. Tải danh sách lớp
  useEffect(() => {
    setLoading(true);

    apiClient.get('/classes')
      .then(res => {
        let rawClasses = res.data.data || [];

        console.log("🔍 [Grades] Current User:", user?.email);
        console.log("🔍 [Grades] Access Level:", hasFullAccess ? "FULL ACCESS" : "RESTRICTED");

        // Nếu không phải Admin, lọc theo Email giảng viên (Student tạm thời xem tất cả)
        if (!hasFullAccess && !isStudent && user?.email) {
          rawClasses = rawClasses.filter((cls: any) =>
            cls.teacher?.email === user.email
          );
        }

        setClasses(rawClasses);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Không thể tải danh sách lớp học");
        setLoading(false);
      });
  }, [user, isAdmin, isStudent, hasFullAccess]);

  const fetchClassGrades = async (cls: any) => {
    setSelectedClass(cls);
    setLoading(true);
    try {
      const [resGrades, resStudents] = await Promise.all([
        apiClient.get(`/grades/class/${cls._id}`),
        apiClient.get(`/classes/${cls._id}/students`)
      ]);

      const cats = resGrades.data.data.categories || [];
      const studentList = resStudents.data.data || [];

      setCategories(cats);
      setStudents(studentList);

      const matrix: any = {};
      (resGrades.data.data.records || []).forEach((r: any) => {
        matrix[`${r.student}_${r.category}`] = r.value;
      });
      setGradeMatrix(matrix);
    } catch (error) {
      toast.error("Lỗi tải dữ liệu điểm số");
    } finally {
      setLoading(false);
    }
  };

  const addCategory = () => {
    const tempId = `temp_${Date.now()}`;
    setCategories([...categories, {
      tempId,
      name: 'Đầu điểm mới',
      weight: 0.1,
      order: categories.length + 1
    }]);
  };

  const handleSaveAll = async () => {
    if (!selectedClass || isStudent) return;
    const toastId = toast.loading("Đang đồng bộ dữ liệu...");

    try {
      const resComp = await apiClient.post(`/grades/composition/${selectedClass._id}`, categories);
      const savedCategories = resComp.data.data || [];
      const finalGradeData: any[] = [];

      students.forEach(student => {
        categories.forEach((cat, index) => {
          const realCategoryId = savedCategories[index]?._id;
          const lookupKey = `${student._id}_${cat._id || cat.tempId}`;
          const scoreValue = gradeMatrix[lookupKey];

          if (scoreValue !== undefined && scoreValue !== '' && realCategoryId) {
            finalGradeData.push({
              student: student._id,
              category: realCategoryId,
              value: Number(scoreValue)
            });
          }
        });
      });

      await apiClient.post(`/grades/bulk-save/${selectedClass._id}`, { gradeData: finalGradeData });
      toast.success("Đã lưu bảng điểm thành công!", { id: toastId });
      await fetchClassGrades(selectedClass);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Lỗi khi lưu dữ liệu", { id: toastId });
    }
  };

  const calculateAverage = (studentId: string) => {
    let totalScore = 0;
    let totalWeight = 0;

    categories.forEach(cat => {
      const key = `${studentId}_${cat._id || cat.tempId}`;
      const score = parseFloat(gradeMatrix[key]);

      if (!isNaN(score)) {
        totalScore += score * (cat.weight || 0);
        totalWeight += (cat.weight || 0);
      }
    });

    if (totalWeight === 0) return "0.00";
    const result = totalScore / totalWeight;
    return isNaN(result) ? "0.00" : result.toFixed(2);
  };

  // Lọc danh sách học viên hiển thị: Nếu là student thì chỉ thấy bản thân (So sánh email không phân biệt hoa thường và bỏ khoảng trắng)
  const displayedStudents = isStudent
    ? students.filter(s => s.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase())
    : students;


  if (!selectedClass) {
    return (
      <div className="space-y-6 p-4">
        <header>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {isStudent ? "Kết quả học tập" : "Quản lý Điểm số"}
          </h1>
          <p className="text-slate-500">{isStudent ? "Xem điểm số và tiến độ học tập cá nhân." : "Theo dõi và cập nhật điểm số định kỳ cho học viên."}</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map(cls => (
              <div
                key={cls._id}
                onClick={() => fetchClassGrades(cls)}
                className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-emerald-500 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 group-hover:bg-indigo-600 transition-colors" />
                <Calculator className="w-12 h-12 text-emerald-600 group-hover:text-white relative z-10 mb-4 transition-colors" />
                <h3 className="font-bold text-xl text-slate-800 relative z-10">{cls.name}</h3>
                <p className="text-xs text-slate-400 font-black uppercase mt-2 relative z-10">{cls.course?.name}</p>
              </div>
            ))}
            {!loading && classes.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Không có lớp học nào</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedClass(null)} className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedClass.name}</h1>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
              {isStudent ? "Bảng điểm cá nhân" : "Bảng điểm & Hệ số đánh giá"}
            </p>
          </div>
        </div>
        {!isStudent && (
          <button
            onClick={handleSaveAll}
            className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl"
          >
            <Save className="w-4 h-4 text-white" /> Lưu bảng điểm
          </button>
        )}
      </header>

      {/* 1. THIẾT LẬP HỆ SỐ (Chỉ hiện với Admin/Teacher) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-50 pb-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-500" /> Cấu trúc trọng số điểm
          </h2>
          {!isStudent && (
            <button onClick={addCategory} className="bg-indigo-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition-all">
              <Plus className="w-4 h-4" /> Thêm đầu điểm
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {categories.map((cat, idx) => (
            <div key={cat._id || cat.tempId} className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-200 flex items-center gap-3 animate-in zoom-in-95 duration-200">
              <span className="font-bold text-sm text-slate-800">{cat.name}</span>
              <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400">HS:</span>
                <span className="text-xs font-black text-emerald-600">{cat.weight}</span>
              </div>
              {!isStudent && (
                <button
                  onClick={() => setCategories(categories.filter((_, i) => i !== idx))}
                  className="p-2 text-rose-300 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. BẢNG NHẬP ĐIỂM TẬP TRUNG */}
      <div className="bg-white rounded-xs border border-slate-200 shadow-sm overflow-hidden overflow-x-auto border-b-4 border-b-slate-900">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-5 py-4 text-left min-w-[220px] border-r border-white/5 sticky left-0 bg-slate-900 z-20 font-black uppercase tracking-widest">Học viên</th>
              {categories.map(cat => (
                <th key={cat._id || cat.tempId} className="px-3 py-4 text-center border-r border-white/5 min-w-[100px] font-black uppercase tracking-widest bg-emerald-600">
                  {cat.name}
                  <div className="text-[7px] text-emerald-100 mt-0.5 font-bold">{((cat.weight || 0) * 100).toFixed(0)}%</div>
                </th>
              ))}
              <th className="px-5 py-4 text-center bg-blue-600 font-black uppercase tracking-widest">TB</th>
              <th className="px-5 py-4 text-center bg-slate-800 font-black uppercase tracking-widest min-w-[180px]">Đánh giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedStudents.map(student => {
              const avgNum = parseFloat(calculateAverage(student._id));
              const isPassed = avgNum >= 80;

              return (
                <tr key={student._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3 border-r border-slate-50 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-[10px]">{student.fullName?.charAt(0)}</div>
                      <span className="font-bold text-slate-700">{student.fullName}</span>
                    </div>
                  </td>
                  {categories.map(cat => {
                    const cellId = `${student._id}_${cat._id || cat.tempId}`;
                    return (
                      <td key={cellId} className="p-1 border-r border-slate-50">
                        {isStudent ? (
                          <div className="w-full text-center font-bold text-indigo-600 py-2">
                            {gradeMatrix[cellId] || '-'}
                          </div>
                        ) : (
                          <input
                            type="number" min="0" max="100" step="0.1"
                            placeholder="-"
                            className="w-full bg-transparent text-center font-bold text-indigo-600 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 py-2 rounded-lg transition-all"
                            value={gradeMatrix[cellId] ?? ''}
                            onChange={(e) => setGradeMatrix({ ...gradeMatrix, [cellId]: e.target.value })}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className={cn(
                    "px-4 py-3 text-center font-black text-sm text-white",
                    isPassed ? "bg-emerald-600" : "bg-rose-500"
                  )}>
                    {avgNum.toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-[10px] transition-all",
                      isPassed
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : "bg-rose-50 border-rose-100 text-rose-700"
                    )}>
                      {isPassed ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span className="uppercase tracking-tight">
                        {isPassed ? "Đạt yêu cầu" : "Nỗ lực hơn"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {displayedStudents.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-3">
            <User className="w-12 h-12 text-slate-200" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Không có dữ liệu hiển thị</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-amber-50 rounded-xs border border-amber-100 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-black text-amber-800 uppercase tracking-tighter">Lưu ý về quy trình chấm điểm</p>
          <p className="text-xs text-amber-700 leading-relaxed font-medium italic">
            Hệ thống sử dụng phương pháp tính điểm trung bình có trọng số. <br />
            Ví dụ: Nếu "Giữa kỳ" có hệ số 0.3 và "Cuối kỳ" 0.7, điểm TB = (Giữa kỳ * 0.3) + (Cuối kỳ * 0.7).
          </p>
        </div>
      </div>
    </div>
  );
}