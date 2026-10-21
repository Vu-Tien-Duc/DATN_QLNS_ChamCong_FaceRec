


import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Calendar, Users, Clock, MapPin, ChevronRight, CheckCircle2,
  XCircle, AlertCircle, History, UserCheck, ArrowLeft, Save, Loader2, BookOpen, Info,
  User,
  MinusCircle
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export default function Attendance() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [loading, setLoading] = useState(true);

  // States cho Tab "Hôm nay"
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionStudents, setSessionStudents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: AttendanceStatus, note: string }>>({});

  // States cho Tab "Lịch sử"
  const [historyClasses, setHistoryClasses] = useState<any[]>([]);
  const [selectedHistoryClass, setSelectedHistoryClass] = useState<any | null>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<any | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyFullRoster, setHistoryFullRoster] = useState<any[]>([]); // Danh sách toàn bộ HV của lớp

  // 1. Tải danh sách buổi học hôm nay & danh sách lớp để xem lịch sử
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const [resToday, resClasses] = await Promise.all([
        apiClient.get(`/schedules?startDate=${today}&endDate=${today}`),
        apiClient.get('/classes')
      ]);

      if (resToday.data.success) setTodaySessions(resToday.data.data);
      if (resClasses.data.success) setHistoryClasses(resClasses.data.data);
    } catch (error) {
      toast.error("Không thể tải dữ liệu điểm danh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // 2. Logic Bắt đầu điểm danh (Tab Hôm nay)
  // const handleStartAttendance = async (session: any) => {
  //   const toastId = toast.loading("Đang chuẩn bị danh sách...");
  //   try {
  //     setSelectedSession(session);

  //     // B1: Lấy danh sách học viên thực tế của lớp này từ Enrollment
  //     const resEnroll = await apiClient.get(`/enrollments?class=${session.class?._id}`);
  //     const students = resEnroll.data.data.map((e: any) => e.student).filter(Boolean);
  //     setSessionStudents(students);

  //     // B2: Lấy dữ liệu điểm danh đã lưu (nếu giáo viên điểm danh lại)
  //     const resAtt = await apiClient.get(`/attendance/session/${session._id}`);

  //     const initialData: Record<string, { status: AttendanceStatus, note: string }> = {};
  //     // Mặc định tất cả là Có mặt
  //     students.forEach((s: any) => {
  //       initialData[s._id] = { status: 'Present', note: '' };
  //     });
  //     // Đè dữ liệu cũ từ database lên (nếu có)
  //     resAtt.data.data.forEach((record: any) => {
  //       if (record.student) {
  //         initialData[record.student._id] = { status: record.status, note: record.note || '' };
  //       }
  //     });

  //     setAttendanceData(initialData);
  //     toast.dismiss(toastId);
  //   } catch (error) {
  //     toast.error("Lỗi khi tải danh sách học viên", { id: toastId });
  //   }
  // };


  // 2. Logic Bắt đầu điểm danh: Hiện TOÀN BỘ sinh viên của lớp
  const handleStartAttendance = async (session: any) => {
    const toastId = toast.loading("Đang tải danh sách lớp...");
    try {
      setSelectedSession(session);
      const classId = session.class?._id || session.class;

      // B1: Lấy toàn bộ học viên của lớp này từ bảng Enrollment
      const resEnroll = await apiClient.get(`/enrollments/class/${classId}`);
      const enrollments = resEnroll.data.data || [];
      const students = enrollments.map((e: any) => e.student).filter(Boolean);
      setSessionStudents(students);

      // B2: Lấy dữ liệu điểm danh ĐÃ LƯU của buổi học này (nếu có)
      const resAtt = await apiClient.get(`/attendance/session/${session._id}`);
      const savedRecords = resAtt.data.data || [];

      // B3: Hợp nhất (Merge) danh sách sinh viên với trạng thái điểm danh
      const initialMap: Record<string, { status: AttendanceStatus, note: string }> = {};

      students.forEach((s: any) => {
        // Tìm xem học viên này đã được điểm danh trong buổi này chưa
        const saved = savedRecords.find((r: any) => r.student?._id === s._id || r.student === s._id);

        initialMap[s._id] = {
          status: (saved?.status as AttendanceStatus) || 'Present', // Mặc định là 'Có mặt' nếu chưa có dữ liệu
          note: saved?.note || ''
        };
      });

      setAttendanceData(initialMap);
      toast.success(`Tải xong ${students.length} học viên`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi chuẩn bị dữ liệu điểm danh", { id: toastId });
    }
  };
  // 3. Lưu điểm danh hàng loạt
  const handleSaveAttendance = async () => {
    const toastId = toast.loading("Đang đồng bộ dữ liệu...");
    try {
      const payload = Object.entries(attendanceData).map(([studentId, info]) => ({
        studentId,
        status: info.status,
        note: info.note
      }));

      const res = await apiClient.post(`/attendance/bulk/${selectedSession._id}`, {
        attendanceData: payload,
        staff: currentUser?._id
      });

      if (res.data.success) {
        toast.success("Đã lưu điểm danh thành công!", { id: toastId });
        setSelectedSession(null);
        fetchInitialData();
      }
    } catch (error) {
      toast.error("Lỗi khi lưu dữ liệu", { id: toastId });
    }
  };

  // 4. Logic xem lịch sử theo Lớp -> Buổi
  // const handleSelectHistoryClass = async (cls: any) => {
  //   setSelectedHistoryClass(cls);
  //   setLoading(true);
  //   try {
  //     const res = await apiClient.get(`/schedules/class/${cls._id}`);
  //     if (res.data.success) setHistorySessions(res.data.data);
  //   } catch (e) { toast.error("Lỗi tải lịch sử buổi học"); }
  //   setLoading(false);
  // };

  // const handleSelectHistorySession = async (session: any) => {
  //   setSelectedHistorySession(session);
  //   setLoading(true);
  //   try {
  //     const res = await apiClient.get(`/attendance/session/${session._id}`);
  //     if (res.data.success) setHistoryRecords(res.data.data);
  //   } catch (e) { toast.error("Lỗi tải chi tiết điểm danh"); }
  //   setLoading(false);
  // };


  // 3. Logic Lịch sử (Merge Roster & Records)
  const handleSelectHistoryClass = async (cls: any) => {
    setSelectedHistoryClass(cls);
    setLoading(true);
    try {
      const res = await apiClient.get(`/schedules/class/${cls._id}`);
      if (res.data.success) setHistorySessions(res.data.data);
    } catch (e) { toast.error("Lỗi tải buổi học"); }
    setLoading(false);
  };

  // const handleSelectHistorySession = async (session: any) => {
  //   setLoading(true);
  //   try {
  //     setSelectedHistorySession(session);
  //     const classId = selectedHistoryClass._id;

  //     // GỌI ĐỒNG THỜI: Danh sách học viên lớp và Dữ liệu điểm danh của buổi đó
  //     const [resRoster, resAtt] = await Promise.all([
  //       apiClient.get(`/enrollments/class/${classId}`),
  //       apiClient.get(`/attendance/session/${session._id}`)
  //     ]);

  //     const roster = (resRoster.data.data || []).map((e: any) => e.student).filter(Boolean);
  //     const attendance = resAtt.data.data || [];

  //     // Merge: Gán record điểm danh vào từng học viên trong roster
  //     const mergedData = roster.map((student: any) => {
  //       const record = attendance.find((r: any) => (r.student?._id || r.student) === student._id);
  //       return {
  //         ...student,
  //         attendanceRecord: record || null // Nếu null nghĩa là chưa điểm danh
  //       };
  //     });

  //     setHistoryFullRoster(mergedData);
  //   } catch (e) {
  //     toast.error("Lỗi tải chi tiết lịch sử");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // UI Helpers
  // const getStatusLabel = (status: string) => {
  //   const labels: any = { Present: 'Có mặt', Absent: 'Vắng mặt', Late: 'Đi muộn', Excused: 'Có phép' };
  //   return labels[status] || status;
  // };

  // const getStatusColor = (status: string) => {
  //   const colors: any = { Present: 'bg-emerald-500', Absent: 'bg-rose-500', Late: 'bg-amber-500', Excused: 'bg-blue-500' };
  //   return colors[status] || 'bg-slate-400';
  // };

  // Helper UI


  const handleSelectHistorySession = async (session: any) => {
    console.group("🔍 DEBUG: Lấy lịch sử điểm danh buổi học");
    console.log("1. Buổi học (Session) đang chọn:", session);
    console.log("2. Lớp học (Class) đang chọn:", selectedHistoryClass);

    setLoading(true);
    try {
      setSelectedHistorySession(session);

      const classId = selectedHistoryClass?._id || selectedHistoryClass?.id;
      const sessionId = session?._id || session?.id;

      if (!classId) {
        console.error("❌ Lỗi: Không tìm thấy ID của lớp học!");
        toast.error("Không xác định được lớp học");
        console.groupEnd();
        return;
      }

      // GỌI ĐỒNG THỜI 2 API
      console.log(`📡 Đang gọi API Enrollments cho lớp: ${classId}`);
      console.log(`📡 Đang gọi API Attendance cho buổi: ${sessionId}`);

      const [resRoster, resAtt] = await Promise.all([
        apiClient.get(`/enrollments/class/${classId}`),
        apiClient.get(`/attendance/session/${sessionId}`)
      ]);

      console.log("3. Dữ liệu Danh sách lớp (Enrollments):", resRoster.data);
      console.log("4. Dữ liệu Điểm danh đã lưu (Attendance):", resAtt.data);

      // Trích xuất học viên
      const roster = (resRoster.data.data || []).map((e: any) => e.student).filter(Boolean);
      const attendance = resAtt.data.data || [];

      console.log(`📊 Số lượng học viên gốc của lớp: ${roster.length}`);
      console.log(`📊 Số lượng bản ghi điểm danh tìm thấy: ${attendance.length}`);

      // MERGE LOGIC: Ánh xạ điểm danh vào danh sách lớp
      const mergedData = roster.map((student: any) => {
        // Kiểm tra khớp ID (Sử dụng cả id và _id cho chắc chắn)
        const record = attendance.find((r: any) => {
          const rStudentId = r.student?._id || r.student?.id || r.student;
          const sStudentId = student._id || student.id;
          return rStudentId === sStudentId;
        });

        return {
          ...student,
          attendanceRecord: record || null
        };
      });

      console.log("5. Dữ liệu sau khi gộp (Merged Data):", mergedData);
      setHistoryFullRoster(mergedData);

      if (mergedData.length === 0) {
        console.warn("⚠️ Cảnh báo: Danh sách sau khi gộp trống trơn!");
      }

    } catch (e: any) {
      console.error("❌ Lỗi nghiêm trọng khi tải lịch sử:", e);
      toast.error("Lỗi tải chi tiết lịch sử");
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'Present': return 'Có mặt';
      case 'Absent': return 'Vắng mặt';
      case 'Late': return 'Đi muộn';
      case 'Excused': return 'Có phép';
      default: return 'Chưa ghi nhận';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500';
      case 'Absent': return 'bg-rose-500';
      case 'Late': return 'bg-amber-500';
      case 'Excused': return 'bg-blue-500';
      default: return 'bg-slate-300';
    }
  };


  // 2. Hàm xử lý nòng cốt: Chuẩn bị dữ liệu điểm danh (Dùng cho cả Today và History)
  const prepareAttendanceData = async (session: any) => {
    const toastId = toast.loading("Đang tải dữ liệu học viên...");
    try {
      const classId = session.class?._id || session.class;
      const sessionId = session._id;

      // Lấy danh sách lớp và danh sách điểm danh hiện tại
      const [resRoster, resAtt] = await Promise.all([
        apiClient.get(`/enrollments/class/${classId}`),
        apiClient.get(`/attendance/session/${sessionId}`)
      ]);

      const roster = (resRoster.data.data || []).map((e: any) => e.student).filter(Boolean);
      const savedRecords = resAtt.data.data || [];

      setSessionStudents(roster);

      // Khởi tạo map dữ liệu
      const dataMap: Record<string, { status: AttendanceStatus, note: string }> = {};
      roster.forEach((student: any) => {
        const record = savedRecords.find((r: any) => (r.student?._id || r.student) === student._id);
        dataMap[student._id] = {
          status: (record?.status as AttendanceStatus) || 'Present',
          note: record?.note || ''
        };
      });

      setAttendanceData(dataMap);
      setSelectedSession(session);
      toast.success("Đã sẵn sàng", { id: toastId });
    } catch (error) {
      toast.error("Lỗi tải dữ liệu chi tiết", { id: toastId });
    }
  };

  // --- RENDER MÀN HÌNH ĐIỂM DANH CHI TIẾT (BƯỚC 2 CỦA TAB TODAY) ---
  if (selectedSession) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedSession(null)} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">Điểm danh: {selectedSession.class?.name}</h1>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-tighter">
                {selectedSession.title} • {new Date(selectedSession.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveAttendance}
            className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
          >
            <Save className="w-5 h-5" /> Lưu kết quả
          </button>
        </header>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">Sĩ số: {sessionStudents.length}</span>
              <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100">Phòng: {selectedSession.room}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
                  <th className="px-8 py-5 w-1/3">Học viên</th>
                  <th className="px-8 py-5">Trạng thái hiện diện</th>
                  <th className="px-8 py-5">Ghi chú nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessionStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg">
                          {student.fullName?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{student.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{student.studentCode || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex gap-2">
                        {(['Present', 'Late', 'Absent', 'Excused'] as AttendanceStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => setAttendanceData(prev => ({
                              ...prev, [student._id]: { ...prev[student._id], status }
                            }))}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                              attendanceData[student._id]?.status === status
                                ? `${getStatusColor(status)} text-white border-transparent shadow-lg`
                                : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                            )}
                          >
                            {getStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <input
                        type="text"
                        placeholder="Lý do, nộp bài..."
                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={attendanceData[student._id]?.note || ''}
                        onChange={(e) => setAttendanceData(prev => ({
                          ...prev, [student._id]: { ...prev[student._id], note: e.target.value }
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER TAB CHÍNH (HÔM NAY / LỊCH SỬ) ---
  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Điểm danh & Chuyên cần</h1>
          <p className="text-slate-500 text-sm">Ghi nhận sự hiện diện của học viên trong các buổi học thực tế.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('today')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'today' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Lớp hôm nay</button>
          <button onClick={() => setActiveTab('history')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'history' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Lịch sử hệ thống</button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>
      ) : activeTab === 'today' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {todaySessions.map((session) => (
            <div key={session._id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">{session.room}</span>
                  <h3 className="text-xl font-black text-slate-900 mt-3 leading-tight">{session.class?.name}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-tighter">{session.title}</p>
                </div>
                <div className="p-4 bg-emerald-50 text-emerald-500 rounded-xs group-hover:scale-110 transition-transform"><UserCheck className="w-6 h-6" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-300" />
                  <span className="text-sm font-bold text-slate-600">
                    {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-300" />
                  <span className="text-sm font-bold text-slate-600">{session.teacher?.fullName}</span>
                </div>
              </div>
              {/* <button 
                onClick={() => handleStartAttendance(session)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-lg"
              >
                Bắt đầu điểm danh
              </button> */}

              <button onClick={() => prepareAttendanceData(session)} className="relative z-10 w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-lg">Bắt đầu điểm danh</button>
            </div>
          ))}
          {todaySessions.length === 0 && (
            <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Không có lớp học nào diễn ra hôm nay</p>
            </div>
          )}
        </div>
      ) : (
        /* TAB LỊCH SỬ DỰA TRÊN DỮ LIỆU THẬT */
        // <div className="space-y-6 animate-in fade-in duration-500">
        //   {!selectedHistoryClass ? (
        //      // Bước 1: Chọn lớp
        //      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        //         {historyClasses.map((cls) => (
        //            <button key={cls._id} onClick={() => handleSelectHistoryClass(cls)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all text-left group">
        //               <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
        //                 <BookOpen className="w-7 h-7" />
        //               </div>
        //               <h3 className="text-lg font-black text-slate-900 leading-tight mb-2">{cls.name}</h3>
        //               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{cls.course?.name || '---'}</p>
        //               <div className="mt-6 flex justify-end"><ChevronRight className="text-slate-300 group-hover:text-indigo-600" /></div>
        //            </button>
        //         ))}
        //      </div>
        //   ) : !selectedHistorySession ? (
        //      // Bước 2: Chọn buổi học của lớp đó
        //      <div className="space-y-4">
        //         <button onClick={() => setSelectedHistoryClass(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"><ArrowLeft className="w-4 h-4" /> Quay lại chọn lớp</button>
        //         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        //            <div className="p-8 border-b bg-slate-50/30 font-black text-slate-900 text-xl">Lịch sử buổi học: {selectedHistoryClass.name}</div>
        //            <div className="divide-y divide-slate-50">
        //               {historySessions.map((s) => (
        //                  <button key={s._id} onClick={() => handleSelectHistorySession(s)} className="w-full p-6 flex items-center justify-between hover:bg-indigo-50/30 transition-all">
        //                     <div className="flex items-center gap-6">
        //                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">{s.sessionNumber}</div>
        //                        <div className="text-left">
        //                           <p className="font-bold text-slate-900">{new Date(s.startTime).toLocaleDateString('vi-VN', {weekday:'long', day:'2-digit', month:'2-digit'})}</p>
        //                           <p className="text-[10px] text-slate-400 font-bold uppercase">{s.room}</p>
        //                        </div>
        //                     </div>
        //                     <ChevronRight className="w-5 h-5 text-slate-200" />
        //                  </button>
        //               ))}
        //            </div>
        //         </div>
        //      </div>
        //   ) : (
        //      // Bước 3: Xem chi tiết điểm danh buổi đó
        //      <div className="space-y-4">
        //         <button onClick={() => setSelectedHistorySession(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"><ArrowLeft className="w-4 h-4" /> Quay lại danh sách buổi</button>
        //         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        //            <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
        //               <div>
        //                 <h2 className="text-xl font-black text-slate-900">Chi tiết điểm danh buổi {selectedHistorySession.sessionNumber}</h2>
        //                 <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">{new Date(selectedHistorySession.startTime).toLocaleDateString('vi-VN')}</p>
        //               </div>
        //               <div className="flex gap-4">
        //                  <div className="text-center bg-emerald-50 px-6 py-2 rounded-2xl border border-emerald-100">
        //                     <p className="text-[10px] font-black text-emerald-600 uppercase">Có mặt</p>
        //                     <p className="text-lg font-black text-emerald-700">{historyRecords.filter(r => r.status === 'Present').length}</p>
        //                  </div>
        //                  <div className="text-center bg-rose-50 px-6 py-2 rounded-2xl border border-rose-100">
        //                     <p className="text-[10px] font-black text-rose-600 uppercase">Vắng</p>
        //                     <p className="text-lg font-black text-rose-700">{historyRecords.filter(r => r.status === 'Absent').length}</p>
        //                  </div>
        //               </div>
        //            </div>
        //            <table className="w-full text-left">
        //               <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
        //                 <tr><th className="px-8 py-4">Học viên</th><th className="px-8 py-4">Trạng thái</th><th className="px-8 py-4">Ghi chú</th></tr>
        //               </thead>
        //               <tbody className="divide-y divide-slate-50">
        //                 {historyRecords.map((r) => (
        //                    <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
        //                       <td className="px-8 py-5 flex items-center gap-3">
        //                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">{r.student?.fullName?.charAt(0)}</div>
        //                          <span className="font-bold text-slate-900 text-sm">{r.student?.fullName}</span>
        //                       </td>
        //                       <td className="px-8 py-5">
        //                          <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase text-white", getStatusColor(r.status))}>
        //                             {getStatusLabel(r.status)}
        //                          </span>
        //                       </td>
        //                       <td className="px-8 py-5 text-xs text-slate-500 italic">{r.note || '---'}</td>
        //                    </tr>
        //                 ))}
        //               </tbody>
        //            </table>
        //         </div>
        //      </div>
        //   )}
        // </div>


        <div className="space-y-6">
          {!selectedHistoryClass ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyClasses.map((cls) => (
                <button key={cls._id} onClick={() => handleSelectHistoryClass(cls)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg text-left group transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all"><BookOpen /></div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight mb-2">{cls.name}</h3>
                  <div className="mt-6 flex justify-end"><ChevronRight className="text-slate-300 group-hover:text-indigo-600" /></div>
                </button>
              ))}
            </div>
          ) : !selectedHistorySession ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedHistoryClass(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"><ArrowLeft className="w-4 h-4" /> Quay lại chọn lớp</button>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b bg-slate-50/30 font-black text-slate-900 text-xl">Lịch sử buổi học: {selectedHistoryClass.name}</div>
                <div className="divide-y divide-slate-50">
                  {historySessions.map((s) => (
                    <button key={s._id} onClick={() => handleSelectHistorySession(s)} className="w-full p-6 flex items-center justify-between hover:bg-indigo-50/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">{s.sessionNumber}</div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">{new Date(s.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{s.room}</p>
                        </div>
                      </div>
                      <span className={cn("text-[9px] font-black px-2 py-1 rounded border uppercase", s.status === 'Scheduled' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100')}>
                        {s.status === 'Scheduled' ? 'Chưa dạy' : 'Đã dạy'}
                      </span>
                      <button
                        onClick={() => prepareAttendanceData(s)}
                        className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                      >
                        Sửa điểm danh
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              <button onClick={() => setSelectedHistorySession(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"><ArrowLeft className="w-4 h-4" /> Quay lại danh sách buổi</button>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Chi tiết điểm danh buổi {selectedHistorySession.sessionNumber}</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">{new Date(selectedHistorySession.startTime).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center bg-emerald-50 px-6 py-2 rounded-2xl border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-black text-emerald-600 uppercase">Có mặt</p>
                      <p className="text-lg font-black text-emerald-700">{historyFullRoster.filter(r => r.attendanceRecord?.status === 'Present').length}</p>
                    </div>
                    <div className="text-center bg-slate-100 px-6 py-2 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sĩ số lớp</p>
                      <p className="text-lg font-black text-slate-700">{historyFullRoster.length}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
                        <th className="px-8 py-4">Học viên</th>
                        <th className="px-8 py-4">Kết quả điểm danh</th>
                        <th className="px-8 py-4">Ghi chú từ giáo viên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {historyFullRoster.map((student) => (
                        <tr key={student._id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">{student.fullName?.charAt(0)}</div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{student.fullName}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{student.studentCode || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-white shadow-sm flex items-center w-fit gap-2", getStatusColor(student.attendanceRecord?.status))}>
                              {student.attendanceRecord?.status ? null : <MinusCircle className="w-3 h-3" />}
                              {getStatusLabel(student.attendanceRecord?.status)}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-xs text-slate-500 italic font-medium">
                            {student.attendanceRecord?.note || (student.attendanceRecord ? '---' : '(Chưa có dữ liệu)')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}