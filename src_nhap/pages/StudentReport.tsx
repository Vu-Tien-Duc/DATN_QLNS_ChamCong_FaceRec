
import React, { useState, useEffect, useMemo } from 'react';
import Student360ReportModal from '../components/Student360ReportModal';
import {
  Download,
  Search,
  Filter,
  User,
  Mail,
  Phone,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  ChevronRight,
  Printer,
  Loader2,
  AlertCircle,
  Activity,
  Award,
  X
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EnrollmentInfo {
  enrollmentId: string;
  className: string;
  classId: string;
  courseName: string;
  courseId: string;
  status: string;
  attendanceRate: number;
  averageGrade: number;
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
}

interface StudentGroupedReport {
  studentId: string;
  studentName: string;
  studentCode: string;
  email: string;
  phone: string;
  enrollments: EnrollmentInfo[];
}

interface StudentReportData {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  email: string;
  phone: string;
  className: string;
  classId: string;
  courseName: string;
  courseId: string;
  status: string;
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  attendanceRate: number;
  averageGrade: number;
}

export default function StudentReport() {
  const [reports, setReports] = useState<StudentReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [evalModal, setEvalModal] = useState<{ open: boolean, studentInfo?: any, records?: any[], loading?: boolean }>({ open: false });

  const handleView360 = async (student: StudentGroupedReport, enrollment: EnrollmentInfo) => {
    const studentInfo = {
      studentName: student.studentName,
      studentCode: student.studentCode,
      email: student.email,
      phone: student.phone,
      courseName: enrollment.courseName,
      className: enrollment.className
    };

    setEvalModal({ open: true, studentInfo, loading: true });
    try {
      const res = await apiClient.get(`/attendance/history/student/${student.studentId}/course/${enrollment.courseId}`);
      if (res.data.success) {
        // Filter out records that don't have total_score or teacherScore (meaning no 360 evaluation was done yet)
        const records = (res.data.data.records || []).filter((r: any) => r.total_score !== undefined || r.teacherScore !== undefined);
        setEvalModal({ open: true, studentInfo, records, loading: false });
      }
    } catch (err) {
      toast.error('Lỗi tải báo cáo 360');
      setEvalModal(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/enrollments/report');
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching student reports:", error);
      toast.error("Không thể tải báo cáo học viên");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Group by Student
  const groupedReports = useMemo(() => {
    const groups: { [key: string]: StudentGroupedReport } = {};

    reports.forEach(report => {
      if (!groups[report.studentId]) {
        groups[report.studentId] = {
          studentId: report.studentId,
          studentName: report.studentName,
          studentCode: report.studentCode,
          email: report.email,
          phone: report.phone,
          enrollments: []
        };
      }
      groups[report.studentId].enrollments.push({
        enrollmentId: report.enrollmentId,
        className: report.className,
        classId: report.classId,
        courseName: report.courseName,
        courseId: report.courseId,
        status: report.status,
        attendanceRate: report.attendanceRate,
        averageGrade: report.averageGrade,
        attendance: report.attendance
      });
    });

    return Object.values(groups);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return groupedReports.filter(item =>
      item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.studentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.enrollments.some(e => e.className.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [groupedReports, searchTerm]);

  const stats = useMemo(() => {
    if (reports.length === 0) return { avgAttendance: 0, avgGrade: 0, totalStudents: 0 };
    const avgAttendance = reports.reduce((acc, curr) => acc + curr.attendanceRate, 0) / reports.length;
    const gradedReports = reports.filter(r => r.averageGrade > 0);
    const avgGrade = gradedReports.length > 0
      ? gradedReports.reduce((acc, curr) => acc + curr.averageGrade, 0) / gradedReports.length
      : 0;
    const totalStudents = groupedReports.length;
    return {
      avgAttendance: Math.round(avgAttendance),
      avgGrade: parseFloat(avgGrade.toFixed(2)),
      totalStudents
    };
  }, [reports, groupedReports]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'studying': return 'bg-emerald-100 text-emerald-700';
      case 'graduated': return 'bg-blue-100 text-blue-700';
      case 'withdrawn': return 'bg-rose-100 text-rose-700';
      case 'pause': return 'bg-amber-100 text-amber-700';
      case 'trial': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'studying': return 'Đang học';
      case 'graduated': return 'Đã tốt nghiệp';
      case 'withdrawn': return 'Thôi học';
      case 'pause': return 'Bảo lưu';
      case 'trial': return 'Học thử';
      default: return status || 'N/A';
    }
  };


  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Đang tổng hợp dữ liệu học viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Báo cáo Tổng hợp Học viên</h1>
          <p className="text-slate-500 text-sm">Quản lý kết quả học tập và chuyên cần của học viên theo từng khóa học.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer className="w-5 h-5" /> In báo cáo
          </button>
          <button className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
            <Download className="w-5 h-5" /> Xuất dữ liệu
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Chuyên cần TB</p>
            <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.avgAttendance}%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Điểm trung bình</p>
            <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.avgGrade}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <User className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sỹ số học viên</p>
            <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.totalStudents}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            type="text"
            placeholder="Tìm theo tên học viên, mã HV, email hoặc tên lớp học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-700"
          />
        </div>
      </div>

      {/* Grouped Report Table */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-left">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin Học viên</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách Lớp & Kết quả</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map((student) => (
                <tr key={student.studentId} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8 align-top">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
                        {student.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-lg uppercase tracking-tight">{student.studentName}</div>
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded w-fit uppercase tracking-tighter">
                            {student.studentCode || 'No-Code'}
                          </span>
                          <div className="flex items-center text-xs text-slate-400 font-medium">
                            <Mail className="w-3 h-3 mr-2" /> {student.email}
                          </div>
                          <div className="flex items-center text-xs text-slate-400 font-medium">
                            <Phone className="w-3 h-3 mr-2" /> {student.phone}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-8">
                    <div className="space-y-4">
                      {student.enrollments.map((en, idx) => {
                        const isAttendanceLow = en.attendanceRate < 80;
                        const isGradeLow = en.averageGrade > 0 && en.averageGrade < 5;

                        return (
                          <div key={en.enrollmentId} className={cn(
                            "p-4 rounded-xs border transition-all",
                            idx % 2 === 0 ? "bg-white border-slate-100" : "bg-slate-50/50 border-transparent"
                          )}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen className="w-4 h-4 text-indigo-500" />
                                  <span className="font-black text-sm text-slate-800 uppercase tracking-tight">{en.className}</span>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                                    getStatusColor(en.status)
                                  )}>
                                    {getStatusText(en.status)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{en.courseName}</p>
                              </div>

                              <div className="flex items-center gap-8">
                                {/* Attendance */}
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Activity className={cn("w-3 h-3", isAttendanceLow ? "text-rose-500" : "text-emerald-500")} />
                                    <span className={cn("text-xs font-black", isAttendanceLow ? "text-rose-500" : "text-slate-700")}>
                                      {en.attendanceRate}%
                                    </span>
                                  </div>
                                  <div className="w-20 bg-slate-200 h-1 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        en.attendanceRate >= 90 ? 'bg-emerald-500' :
                                          en.attendanceRate >= 75 ? 'bg-indigo-500' : 'bg-rose-500'
                                      )}
                                      style={{ width: `${en.attendanceRate}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-400 mt-1 font-bold">Vắng: {en.attendance.absent} (P: {en.attendance.excused})</span>
                                </div>

                                {/* Grades */}
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Award className={cn("w-3 h-3", isGradeLow ? "text-rose-500" : "text-amber-500")} />
                                    <span className={cn("text-xs font-black", isGradeLow ? "text-rose-500" : "text-slate-700")}>
                                      {en.averageGrade > 0 ? en.averageGrade : '---'}
                                    </span>
                                  </div>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                    en.averageGrade >= 8 ? "bg-emerald-100 text-emerald-600" :
                                      en.averageGrade >= 5 ? "bg-indigo-100 text-indigo-600" : "bg-rose-100 text-rose-600"
                                  )}>
                                    {en.averageGrade >= 8 ? 'Giỏi' : en.averageGrade >= 6.5 ? 'Khá' : en.averageGrade >= 5 ? 'Trung bình' : 'Yếu'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                              <button 
                                onClick={() => handleView360(student, en)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                <Award className="w-4 h-4" /> Xem Báo Cáo 360°
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right align-top">
                    <button className="p-3 text-slate-300 hover:bg-white hover:text-indigo-600 hover:shadow-xl rounded-[1.5rem] transition-all border border-transparent hover:border-slate-100">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReports.length === 0 && (
          <div className="p-32 text-center">
            <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Search className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Không có kết quả</h3>
            <p className="text-slate-400 max-w-sm mx-auto font-medium">Vui lòng thử tìm kiếm bằng từ khóa khác hoặc kiểm tra lại các bộ lọc.</p>
          </div>
        )}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-indigo-200">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-[1.5rem]">
            <GraduationCap className="w-10 h-10" />
          </div>
          <div>
            <h4 className="font-black text-2xl uppercase tracking-tighter">Đánh giá Năng lực Học viên</h4>
            <p className="text-indigo-100 text-sm font-medium mt-1">Dữ liệu được cập nhật thời gian thực dựa trên kết quả từ giảng viên.</p>
          </div>
        </div>
        <button className="px-10 py-4 bg-white text-indigo-600 font-black text-sm rounded-[1.5rem] hover:bg-indigo-50 transition-all uppercase tracking-widest shadow-xl">
          Tải Báo cáo Tổng kết (.PDF)
        </button>
      </div>

      {/* 360 Evaluation Modal Component */}
      <Student360ReportModal 
        isOpen={evalModal.open}
        onClose={() => setEvalModal({ open: false })}
        studentInfo={evalModal.studentInfo}
        records={evalModal.records || []}
        loading={!!evalModal.loading}
      />
    </div>
  );
}
