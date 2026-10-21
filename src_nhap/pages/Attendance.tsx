import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Calendar, Users, Clock, ChevronLeft, ChevronRight, UserCheck, ArrowLeft, Save, Loader2, BookOpen, User as UserIcon, RefreshCcw, Edit3, XCircle, Plus, GraduationCap, UserCog, CheckCircle2, MapPin } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Định nghĩa các loại trạng thái điểm danh
type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

function ParentAttendanceView() {
  const [loading, setLoading] = useState(true);
  const [studentReport, setStudentReport] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  // Weekly calendar state
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => {
    const base = new Date();
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(base.setDate(diff));
  });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // Get week range dates (YYYY-MM-DD)
  const weekRangeStr = useMemo(() => {
    const monday = new Date(currentWeekMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const format = (d: Date) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const formatVN = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    return {
      startStr: format(monday),
      endStr: format(sunday),
      display: `${formatVN(monday)} - ${formatVN(sunday)}`
    };
  }, [currentWeekMonday]);

  // Fetch children list & report
  const fetchChildrenReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/enrollments/report');
      if (res.data.success) {
        setStudentReport(res.data.data);
        if (res.data.data.length > 0 && !selectedStudentId) {
          // Select first child by default
          setSelectedStudentId(res.data.data[0].studentId);
        }
      }
    } catch (error) {
      toast.error('Không thể tải báo cáo của con');
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  // Fetch weekly schedules
  const fetchWeeklySchedules = useCallback(async () => {
    try {
      const res = await apiClient.get(`/schedules?startDate=${weekRangeStr.startStr}&endDate=${weekRangeStr.endStr}`);
      if (res.data.success) {
        setSchedules(res.data.data);
      }
    } catch (error) {
      console.error('Lỗi tải lịch học:', error);
    }
  }, [weekRangeStr]);

  useEffect(() => {
    fetchChildrenReport();
  }, [fetchChildrenReport]);

  useEffect(() => {
    fetchWeeklySchedules();
  }, [fetchWeeklySchedules]);

  // Helper navigate week
  const handlePrevWeek = () => {
    setCurrentWeekMonday(prev => {
      const nextDate = new Date(prev);
      nextDate.setDate(prev.getDate() - 7);
      return nextDate;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekMonday(prev => {
      const nextDate = new Date(prev);
      nextDate.setDate(prev.getDate() + 7);
      return nextDate;
    });
  };

  const handleCurrentWeek = () => {
    const base = new Date();
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekMonday(new Date(base.setDate(diff)));
  };

  // Filter schedules for currently selected child
  const filteredSchedules = useMemo(() => {
    if (!selectedStudentId || schedules.length === 0) return [];
    
    // schedules returned from backend contain studentAttendance array
    return schedules.filter(s => {
      return s.studentAttendance && s.studentAttendance.some((sa: any) => sa.studentId === selectedStudentId);
    });
  }, [selectedStudentId, schedules]);

  const selectedChildReport = useMemo(() => {
    return studentReport.find(r => r.studentId === selectedStudentId);
  }, [studentReport, selectedStudentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-6">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold">Lịch học & Điểm danh của con</h1>
          <p className="text-violet-100 text-sm mt-1">Xem chi tiết các lớp đang theo học, lịch học hàng tuần và nhận xét của thầy cô.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <GraduationCap className="w-8 h-8 text-violet-200" />
        </div>
      </div>

      {/* Child selector if multiple children */}
      {studentReport.length > 1 && (
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          {studentReport.map((child: any) => (
            <button
              key={child.studentId}
              onClick={() => setSelectedStudentId(child.studentId)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                selectedStudentId === child.studentId
                  ? "bg-white text-violet-700 shadow-md"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              👦 {child.studentName}
            </button>
          ))}
        </div>
      )}

      {selectedChildReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Stats & child info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg">
                  {selectedChildReport.studentName?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{selectedChildReport.studentName}</h3>
                  <p className="text-slate-400 text-xs font-medium">Mã HV: {selectedChildReport.studentCode}</p>
                </div>
              </div>

              {/* Stats blocks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold opacity-80">Đi học đầy đủ</p>
                    <p className="text-lg font-black">{selectedChildReport.attendance?.present || 0} buổi</p>
                  </div>
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600">👍</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold opacity-80">Vắng mặt</p>
                    <p className="text-lg font-black">{selectedChildReport.attendance?.absent || 0} buổi</p>
                  </div>
                  <span className="p-2 rounded-xl bg-rose-100 text-rose-600">❌</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold opacity-80">Đi muộn / Phép</p>
                    <p className="text-lg font-black">
                      {(selectedChildReport.attendance?.late || 0)} muộn · {(selectedChildReport.attendance?.excused || 0)} phép
                    </p>
                  </div>
                  <span className="p-2 rounded-xl bg-amber-100 text-amber-600">🕒</span>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                    <span>Tỷ lệ chuyên cần</span>
                    <span className="text-violet-600">{selectedChildReport.attendanceRate}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full transition-all duration-500" 
                      style={{ width: `${selectedChildReport.attendanceRate}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-indigo-800">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold opacity-80">Điểm số trung bình</p>
                    <p className="text-lg font-black">{selectedChildReport.averageGrade} / 10</p>
                  </div>
                  <span className="p-2 rounded-xl bg-indigo-100 text-indigo-600">⭐</span>
                </div>
              </div>

              {/* Class info info */}
              <div className="pt-4 border-t border-slate-100 space-y-3 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Khóa học:</span>
                  <span className="font-bold text-slate-700 text-right">{selectedChildReport.courseName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Lớp đang học:</span>
                  <span className="font-black text-indigo-600 text-right">{selectedChildReport.className}</span>
                </div>
              </div>

              {/* Tình hình học tập tóm tắt theo môn học */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tình hình học tập:</p>
                <div className="space-y-1.5 text-xs font-semibold text-slate-600">
                  <p className="text-slate-800 font-extrabold text-sm mb-1.5">Môn học: {selectedChildReport.courseName}</p>
                  <p>Học: <span className="text-emerald-600 font-bold">{selectedChildReport.attendance?.present || 0} buổi</span></p>
                  <p>Vắng: <span className="text-rose-600 font-bold">{selectedChildReport.attendance?.absent || 0} buổi</span></p>
                  <p>Khóa học tổng: <span className="text-violet-600 font-bold">{selectedChildReport.totalSessions || 0} buổi</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Weekly schedule & attendance records */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Week navigation */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
              <button 
                onClick={handlePrevWeek} 
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-violet-500" />
                <span className="font-bold text-slate-800 text-sm">Tuần: {weekRangeStr.display}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleCurrentWeek} 
                  className="px-3 py-1.5 bg-violet-50 text-violet-700 font-bold text-xs rounded-lg hover:bg-violet-100 transition-colors mr-2"
                >
                  Tuần này
                </button>
                <button 
                  onClick={handleNextWeek} 
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Weekly list of schedules */}
            <div className="space-y-4">
              {filteredSchedules.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 space-y-3">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold">Không có lịch học nào trong tuần này.</p>
                  <p className="text-xs text-slate-400">Vui lòng chuyển tuần để xem lịch học khác.</p>
                </div>
              ) : (
                filteredSchedules.map((session: any) => {
                  const dayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
                  const sessionDate = new Date(session.startTime);
                  const dayName = dayNames[sessionDate.getDay()];
                  const dateFormatted = `${String(sessionDate.getDate()).padStart(2, '0')}/${String(sessionDate.getMonth() + 1).padStart(2, '0')}/${sessionDate.getFullYear()}`;
                  
                  // Get child attendance status in this schedule
                  const attInfo = session.studentAttendance?.find((sa: any) => sa.studentId === selectedStudentId);

                  return (
                    <div key={session._id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                      
                      {/* Top Header Card */}
                      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                              {dayName} ({dateFormatted})
                            </span>
                            <span className="px-2.5 py-1 bg-violet-50 text-violet-700 font-bold text-[10px] rounded-lg">
                              🕒 {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-base">{session.title || 'Buổi học'}</h4>
                          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium pt-1">
                            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-slate-400" /> {session.class?.name}</span>
                            {session.room && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {session.room?.name || session.room}</span>}
                            {session.teacher && <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-slate-400" /> GV: {session.teacher?.fullName}</span>}
                          </div>
                        </div>

                        {/* Status tag */}
                        <div className="shrink-0 flex items-center gap-2">
                          {attInfo ? (
                            (() => {
                              switch (attInfo.status) {
                                case 'Present':
                                  return (
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-xs rounded-xl">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Có mặt
                                    </span>
                                  );
                                case 'Late':
                                  return (
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 font-black text-xs rounded-xl">
                                      <Clock className="w-4 h-4 text-amber-500" /> Đi muộn
                                    </span>
                                  );
                                case 'Excused':
                                  return (
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-100 font-black text-xs rounded-xl">
                                      <CheckCircle2 className="w-4 h-4 text-sky-500" /> Vắng có phép
                                    </span>
                                  );
                                case 'Absent':
                                  return (
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 font-black text-xs rounded-xl">
                                      <XCircle className="w-4 h-4 text-rose-500" /> Vắng mặt
                                    </span>
                                  );
                                default:
                                  return (
                                    <span className="px-3 py-1.5 bg-slate-100 text-slate-500 font-black text-xs rounded-xl">
                                      Chưa điểm danh
                                    </span>
                                  );
                              }
                            })()
                          ) : (
                            <span className="px-3 py-1.5 bg-slate-50 text-slate-400 font-bold text-xs rounded-xl">
                              Chưa diễn ra
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Collapsible Teacher Feedback Section */}
                      {attInfo && (
                        attInfo.teacherComment || 
                        attInfo.total_score !== undefined || 
                        attInfo.suggestions_for_parents ||
                        (attInfo.images && attInfo.images.length > 0) ||
                        (attInfo.youtubeLinks && attInfo.youtubeLinks.length > 0) ||
                        (attInfo.projectFiles && attInfo.projectFiles.length > 0)
                      ) && (
                        <div className="bg-slate-50/50 p-4 border-t border-slate-50">
                          <button
                            type="button"
                            onClick={() => setExpandedComments(prev => ({ ...prev, [session._id]: !prev[session._id] }))}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-violet-700 hover:text-violet-900 transition-colors"
                          >
                            <span>📝 Nhận xét, Hình ảnh & Đánh giá chi tiết của thầy cô</span>
                            <span className="text-violet-500 text-sm">{expandedComments[session._id] ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
                          </button>
                          
                          {expandedComments[session._id] && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-4 text-xs text-slate-700">
                              {attInfo.total_score !== undefined && (
                                <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl border border-slate-100 w-fit">
                                  <div>
                                    <span className="font-semibold text-slate-400">Điểm đánh giá: </span>
                                    <span className="font-black text-indigo-600 text-sm">{attInfo.total_score} / 100</span>
                                  </div>
                                  {attInfo.rank && (
                                    <div className="pl-4 border-l border-slate-200">
                                      <span className="font-semibold text-slate-400">Xếp loại: </span>
                                      <span className="font-black text-violet-700">{attInfo.rank}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {attInfo.teacherComment && (
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">Nhận xét của giáo viên:</p>
                                  <p className="bg-white p-3 rounded-2xl border border-slate-100 text-slate-600 leading-relaxed font-medium italic">"{attInfo.teacherComment}"</p>
                                </div>
                              )}

                              {(attInfo.strengths || attInfo.weaknesses) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {attInfo.strengths && (
                                    <div className="bg-emerald-50/30 p-3 rounded-2xl border border-emerald-100/50 space-y-0.5">
                                      <p className="font-bold text-emerald-800 text-[10px] uppercase">💪 Ưu điểm:</p>
                                      <p className="text-emerald-700 font-medium leading-relaxed">{attInfo.strengths}</p>
                                    </div>
                                  )}
                                  {attInfo.weaknesses && (
                                    <div className="bg-rose-50/30 p-3 rounded-2xl border border-rose-100/50 space-y-0.5">
                                      <p className="font-bold text-rose-800 text-[10px] uppercase">⚠️ Cần cải thiện:</p>
                                      <p className="text-rose-700 font-medium leading-relaxed">{attInfo.weaknesses}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {attInfo.suggestions_for_parents && (
                                <div className="bg-amber-50/40 p-3 rounded-2xl border border-amber-100/60 space-y-1">
                                  <p className="font-bold text-amber-800 text-[10px] uppercase">💡 Gợi ý cho phụ huynh:</p>
                                  <p className="text-amber-700 font-medium leading-relaxed">{attInfo.suggestions_for_parents}</p>
                                </div>
                              )}

                              {/* Album ảnh lớp học */}
                              {attInfo.images && attInfo.images.length > 0 && (
                                <div className="space-y-2">
                                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">📸 Hình ảnh hoạt động lớp học:</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border border-slate-100">
                                    {attInfo.images.map((img: any) => {
                                      const imgSrc = img.url || `/api/images/${img._id}`;
                                      return (
                                        <a 
                                          key={img._id} 
                                          href={imgSrc} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="relative aspect-video rounded-xl overflow-hidden group border border-slate-100/50 bg-slate-50 hover:shadow-md transition-all"
                                        >
                                          <img 
                                            src={imgSrc} 
                                            alt={img.originalname || 'Hoạt động của con'} 
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
                                            loading="lazy"
                                          />
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Link tham khảo / YouTube */}
                              {attInfo.youtubeLinks && attInfo.youtubeLinks.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">📺 Link bài giảng & video tham khảo:</p>
                                  <div className="space-y-1">
                                    {attInfo.youtubeLinks.map((link: string, idx: number) => (
                                      <a 
                                        key={idx} 
                                        href={link} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center gap-1.5 text-indigo-600 font-bold hover:underline hover:text-indigo-800 break-all"
                                      >
                                        🔗 {link}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* File dự án */}
                              {attInfo.projectFiles && attInfo.projectFiles.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">📁 File dự án & tài liệu đính kèm:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {attInfo.projectFiles.map((file: any, idx: number) => (
                                      <a 
                                        key={idx} 
                                        href={`/api/attendance/project-file/${session._id}/${file.filename}`}
                                        download={file.originalName}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors"
                                      >
                                        💾 {file.originalName || file.filename} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-500">
          Chưa tìm thấy hồ sơ học sinh nào được gán với tài khoản phụ huynh này. Vui lòng liên hệ trung tâm để được hỗ trợ.
        </div>
      )}
    </div>
  );
}

export default function Attendance() {
  const { user: currentUser, hasRole } = useAuth();
  const isParent = hasRole('parent') || hasRole('phụ huynh');

  if (isParent) {
    return <ParentAttendanceView />;
  }

  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [loading, setLoading] = useState(true);

  // --- States dùng chung cho màn hình Chấm điểm/Sửa điểm ---
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionStudents, setSessionStudents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: AttendanceStatus, note: string }>>({});
  // Feedback UI state: open panels per student
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({});
  // Feedback data per student (attendanceId, teacherComment, teacherScore, images[], youtubeLinks[])
  const [feedbackData, setFeedbackData] = useState<Record<string, any>>({});
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ open: boolean; src?: string; isVideo?: boolean }>({ open: false });

  // --- States chấm công giảng viên ---
  // Danh sách GV/TG trong buổi học (kết hợp từ session.teachers + session.teacherAssistants + manual thêm)
  const [sessionTeachers, setSessionTeachers] = useState<any[]>([]);
  // Dữ liệu chấm công GV: { [teacherId]: { role, status, note } }
  const [teacherAttData, setTeacherAttData] = useState<Record<string, { role: 'teacher' | 'assistant'; status: 'Present' | 'Absent'; note: string }>>({});
  // Modal tìm kiếm thêm GV
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // --- States danh sách ---
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [historyClasses, setHistoryClasses] = useState<any[]>([]);
  const [selectedHistoryClass, setSelectedHistoryClass] = useState<any | null>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);



  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);

      // Lấy ngày hôm nay chuẩn YYYY-MM-DD theo giờ địa phương (Việt Nam)
      const todayLocal = new Date().toLocaleDateString('sv-SE'); // Output: "2026-03-18"

      console.log("🚀 Đang check lịch dạy ngày:", todayLocal);

      // Gọi API lấy schedule của ngày hôm nay
      const resToday = await apiClient.get(`/schedules?startDate=${todayLocal}&endDate=${todayLocal}`);

      if (resToday.data.success) {
        console.log("📥 Danh sách lớp tìm thấy:", resToday.data.data);
        setTodaySessions(resToday.data.data);
      }

      // Lấy danh sách lớp cho tab lịch sử
      const resClasses = await apiClient.get('/classes');
      if (resClasses.data.success) setHistoryClasses(resClasses.data.data);

    } catch (error) {
      toast.error("Lỗi kết nối dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // 2. Chuẩn bị dữ liệu để render bảng điểm danh (Dùng cho cả tạo mới và sửa)
  // const prepareAttendanceForm = async (session: any) => {
  //   const toastId = toast.loading("Đang chuẩn bị danh sách học viên...");
  //   try {
  //     const classId = session.class?._id || session.class;
  //     const sessionId = session._id;

  //     // Lấy song song: 1. Toàn bộ học viên của lớp (Roster), 2. Dữ liệu điểm danh đã có trong DB
  //     const [resRoster, resAtt] = await Promise.all([
  //       apiClient.get(`/enrollments/class/${classId}`),
  //       apiClient.get(`/attendance/session/${sessionId}`)
  //     ]);

  //     const roster = (resRoster.data.data || []).map((e: any) => e.student).filter(Boolean);
  //     const savedRecords = resAtt.data.data || [];

  //     setSessionStudents(roster);

  //     // KHỞI TẠO LOGIC: Mặc định là 'Present' (Đi học) cho toàn bộ roster
  //     const dataMap: Record<string, { status: AttendanceStatus, note: string }> = {};
  //     roster.forEach((student: any) => {
  //       // Kiểm tra xem trong DB đã có dữ liệu điểm danh cho bạn này chưa
  //       const existingRecord = savedRecords.find((r: any) => (r.student?._id || r.student) === student._id);

  //       dataMap[student._id] = {
  //         // NẾU CÓ: Dùng dữ liệu cũ. NẾU CHƯA CÓ (quên/mới): Mặc định là 'Present'
  //         status: (existingRecord?.status as AttendanceStatus) || 'Present',
  //         note: existingRecord?.note || ''
  //       };
  //     });

  //     setAttendanceData(dataMap);
  //     setSelectedSession(session);
  //     toast.success("Đã sẵn sàng điểm danh", { id: toastId });
  //   } catch (error) {
  //     toast.error("Lỗi khi chuẩn bị danh sách lớp", { id: toastId });
  //   }
  // };


  const prepareAttendanceForm = async (session: any) => {
    const toastId = toast.loading("Đang chuẩn bị danh sách học viên...");
    try {
      const classId = session.class?._id || session.class;
      const sessionId = session._id;

      // 1. Lấy danh sách học viên từ lớp
      const resStudents = await apiClient.get(`/classes/${classId}/students`);

      // 2. Lấy dữ liệu điểm danh đã lưu cho buổi này
      const resAtt = await apiClient.get(`/attendance/session/${sessionId}`);

      // 3. Lấy chấm công giảng viên đã lưu cho buổi này
      const resTeacherAtt = await apiClient.get(`/teacher-attendance/session/${sessionId}`);

      const roster = resStudents.data.data || [];
      const savedRecords = resAtt.data.data || [];
      const savedTeacherRecords: any[] = resTeacherAtt.data.data || [];

      // --- Khởi tạo danh sách giảng viên trong buổi ---
      // Lấy từ session.teachers (GV chính) + session.teacherAssistants (trợ giảng)
      // Nếu có teacher đơn cũ → thêm vào teachers
      const teacherMap: Record<string, any> = {};

      const addToMap = (t: any, role: 'teacher' | 'assistant') => {
        if (!t) return;
        const id = t._id || t;
        if (!teacherMap[id]) {
          teacherMap[id] = {
            _id: id,
            fullName: t.fullName || 'Giảng viên',
            teacherCode: t.teacherCode || '',
            avatar: t.avatar || '',
            role
          };
        }
      };

      // GV chính (từ teachers[]) hoặc teacher đơn
      if (Array.isArray(session.teachers) && session.teachers.length > 0) {
        session.teachers.forEach((t: any) => addToMap(t, 'teacher'));
      } else if (session.teacher) {
        addToMap(session.teacher, 'teacher');
      }

      // Trợ giảng
      if (Array.isArray(session.teacherAssistants)) {
        session.teacherAssistants.forEach((t: any) => addToMap(t, 'assistant'));
      }

      // Thêm các GV đã có record chấm công (phòng trường hợp bị thêm thủ công trước)
      savedTeacherRecords.forEach((r: any) => {
        if (r.teacher) addToMap(r.teacher, r.role || 'teacher');
      });

      const teacherList = Object.values(teacherMap);
      setSessionTeachers(teacherList);

      // Khởi tạo dữ liệu chấm công GV
      const teacherDataMap: Record<string, { role: 'teacher' | 'assistant'; status: 'Present' | 'Absent'; note: string }> = {};
      teacherList.forEach((t: any) => {
        const saved = savedTeacherRecords.find((r: any) => (r.teacher?._id || r.teacher) === t._id);
        teacherDataMap[t._id] = {
          role: t.role,
          status: (saved?.status as 'Present' | 'Absent') || 'Present',
          note: saved?.note || ''
        };
      });
      setTeacherAttData(teacherDataMap);

      // --- Khởi tạo điểm danh học viên ---
      const rosterWithMeta = roster.map((student: any) => {
        const existingRecord = savedRecords.find((r: any) => (r.student?._id || r.student) === student._id);
        setFeedbackData(prev => ({
          ...prev,
          [student._id]: {
            attendanceId: existingRecord?._id,
            teacherComment: existingRecord?.teacherComment || '',
            teacherScore: existingRecord?.teacherScore ?? null,
            images: (existingRecord?.images || []).map((i: any) => (i._id || i)),
            youtubeLinks: existingRecord?.youtubeLinks || [],
            projectFiles: existingRecord?.projectFiles || [],
            attendance_score: existingRecord?.attendance_score ?? 0,
            attitude_score: existingRecord?.attitude_score ?? 0,
            tech_skill_score: existingRecord?.tech_skill_score ?? 0,
            creative_thinking_score: existingRecord?.creative_thinking_score ?? 0,
            presentation_score: existingRecord?.presentation_score ?? 0,
            teamwork_score: existingRecord?.teamwork_score ?? 0,
            homework_completion_score: existingRecord?.homework_completion_score ?? 0,
            problem_solving_score: existingRecord?.problem_solving_score ?? 0,
            proactivity_score: existingRecord?.proactivity_score ?? 0,
            progress_score: existingRecord?.progress_score ?? 0,
            total_score: existingRecord?.total_score ?? 0,
            rank: existingRecord?.rank || '',
            strengths: existingRecord?.strengths || '',
            weaknesses: existingRecord?.weaknesses || '',
            suggestions_for_parents: existingRecord?.suggestions_for_parents || ''
          }
        }));
        return student;
      });

      setSessionStudents(rosterWithMeta);

      const dataMap: Record<string, { status: AttendanceStatus, note: string }> = {};
      roster.forEach((student: any) => {
        const existingRecord = savedRecords.find((r: any) => (r.student?._id || r.student) === student._id);
        dataMap[student._id] = {
          status: (existingRecord?.status as AttendanceStatus) || 'Present',
          note: existingRecord?.note || ''
        };
      });

      setAttendanceData(dataMap);
      setSelectedSession(session);
      toast.success("Đã sẵn sàng điểm danh", { id: toastId });
    } catch (error: any) {
      console.error("Lỗi:", error);
      toast.error("Lỗi khi chuẩn bị danh sách lớp", { id: toastId });
    }
  };

  // Hàm load danh sách tất cả giảng viên (cho modal thêm GV)
  const loadAllTeachers = async () => {
    if (allTeachers.length > 0) return;
    setLoadingTeachers(true);
    try {
      const res = await apiClient.get('/teachers?limit=200');
      if (res.data.success) setAllTeachers(res.data.data || []);
    } catch (e) {
      toast.error('Lỗi tải danh sách giảng viên');
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Thêm giảng viên thủ công vào buổi học
  const addTeacherToSession = (teacher: any, role: 'teacher' | 'assistant') => {
    const id = teacher._id;
    if (sessionTeachers.find(t => t._id === id)) {
      toast('Giảng viên đã có trong danh sách');
      return;
    }
    setSessionTeachers(prev => [...prev, { ...teacher, role }]);
    setTeacherAttData(prev => ({
      ...prev,
      [id]: { role, status: 'Present', note: '' }
    }));
    setShowAddTeacherModal(false);
  };

  // Xóa giảng viên khỏi danh sách buổi (chỉ xóa trên UI, không xóa DB)
  const removeTeacherFromSession = (teacherId: string) => {
    setSessionTeachers(prev => prev.filter(t => t._id !== teacherId));
    setTeacherAttData(prev => {
      const next = { ...prev };
      delete next[teacherId];
      return next;
    });
  };


  const handleSaveAttendance = async () => {
    if (!selectedSession?._id) return;
    const toastId = toast.loading("Đang lưu kết quả điểm danh...");

    try {
      // BƯỚC 1: Lưu điểm danh học viên
      const attendancePayload = Object.entries(attendanceData).map(([studentId, info]) => ({
        studentId,
        status: info.status,
        note: info.note
      }));

      const resAtt = await apiClient.post(`/attendance/bulk/${selectedSession._id}`, {
        attendanceData: attendancePayload,
        staff: currentUser?._id
      });

      if (!resAtt.data.success) {
        throw new Error(resAtt.data.message || "Không thể lưu bảng điểm danh");
      }

      // BƯỚC 2: Lưu chấm công giảng viên (nếu có)
      if (sessionTeachers.length > 0) {
        const teacherPayload = sessionTeachers.map(t => ({
          teacherId: t._id,
          role: teacherAttData[t._id]?.role || t.role || 'teacher',
          status: teacherAttData[t._id]?.status || 'Present',
          note: teacherAttData[t._id]?.note || ''
        }));

        await apiClient.post(`/teacher-attendance/bulk/${selectedSession._id}`, {
          records: teacherPayload,
          recordedBy: currentUser?._id
        });
      }

      // BƯỚC 3: Cập nhật trạng thái buổi học
      const resSchedule = await apiClient.put(`/schedules/${selectedSession._id}`, {
        status: 'Completed'
      });

      if (resSchedule.data.success) {
        toast.success("Đã lưu điểm danh học viên & chấm công giảng viên thành công!", { id: toastId });
        setSelectedSession(null);
        fetchInitialData();
      } else {
        throw new Error("Lưu điểm thành công nhưng lỗi cập nhật trạng thái buổi học");
      }

    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Không thể đồng bộ dữ liệu", { id: toastId });
    }
  };

  // 4. Logic cho Tab Lịch sử: Chọn lớp -> Hiển thị danh sách buổi học
  const handleSelectHistoryClass = async (cls: any) => {
    setSelectedHistoryClass(cls);
    setLoading(true);
    try {
      const res = await apiClient.get(`/schedules/class/${cls._id}`);
      if (res.data.success) setHistorySessions(res.data.data);
    } catch (e) { toast.error("Lỗi tải lịch sử buổi dạy"); }
    setLoading(false);
  };

  // UI Component: Nút chọn trạng thái điểm danh
  const AttendanceToggle = ({ studentId, status, label, activeBg }: { studentId: string, status: AttendanceStatus, label: string, activeBg: string }) => (
    <button
      onClick={() => setAttendanceData(prev => ({
        ...prev, [studentId]: { ...prev[studentId], status }
      }))}
      className={cn(
        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2",
        attendanceData[studentId]?.status === status
          ? `${activeBg} text-white border-transparent shadow-lg scale-105`
          : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
      )}
    >
      {label}
    </button>
  );

  // Upload multiple image files and return array of image _id
  const uploadFiles = async (studentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return [];
    setUploadingImages(prev => ({ ...prev, [studentId]: true }));
    try {
      const uploadedIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fd = new FormData();
        fd.append('image', f);
        const res = await apiClient.post('/images/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (res.data.success) {
          uploadedIds.push(res.data.image._id);
        } else if (res.data.image && res.data.image._id) {
          uploadedIds.push(res.data.image._id);
        }
      }
      return uploadedIds;
    } catch (err) {
      toast.error('Lỗi upload ảnh');
      return [];
    } finally {
      setUploadingImages(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const ensureAttendanceRecord = async (studentId: string) => {
    // If we already have attendanceId in feedbackData, return it
    const fd = feedbackData[studentId] || {};
    if (fd?.attendanceId) return fd.attendanceId;

    // Otherwise create via bulk endpoint for this single student
    try {
      const payload = [{ studentId, status: attendanceData[studentId]?.status || 'Present', note: attendanceData[studentId]?.note || '' }];
      await apiClient.post(`/attendance/bulk/${selectedSession._id}`, { attendanceData: payload, staff: currentUser?._id });
      // refetch session attendance to get new record id
      const res = await apiClient.get(`/attendance/session/${selectedSession._id}`);
      if (res.data.success) {
        const savedRecords = res.data.data || [];
        const record = savedRecords.find((r: any) => (r.student?._id || r.student) === studentId);
        if (record) {
          setFeedbackData(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), attendanceId: record._id } }));
          return record._id;
        }
      }
    } catch (err) {
      toast.error('Không thể tạo bản ghi điểm danh');
    }
    return null;
  };

  const handleSaveFeedback = async (studentId: string) => {
    try {
      const data = feedbackData[studentId] || {};

      // Ensure attendance record exists before sending files
      let attendanceId = await ensureAttendanceRecord(studentId);
      if (!attendanceId) return;

      // Build FormData to send multipart (files + fields)
      const form = new FormData();
      if (typeof data.teacherComment !== 'undefined') form.append('teacherComment', data.teacherComment);
      if (typeof data.teacherScore !== 'undefined' && data.teacherScore !== null) form.append('teacherScore', String(data.teacherScore));
      
      // Append 360 evaluation fields
      const scoreFields = [
        'attendance_score', 'attitude_score', 'tech_skill_score', 'creative_thinking_score',
        'presentation_score', 'teamwork_score', 'homework_completion_score',
        'problem_solving_score', 'proactivity_score', 'progress_score', 'total_score'
      ];
      scoreFields.forEach(field => {
        if (typeof data[field] !== 'undefined' && data[field] !== null) form.append(field, String(data[field]));
      });

      const textFields = ['rank', 'strengths', 'weaknesses', 'suggestions_for_parents'];
      textFields.forEach(field => {
        if (typeof data[field] !== 'undefined') form.append(field, data[field]);
      });

      // Existing image ids (keep them)
      form.append('images', JSON.stringify(data.images || []));
      form.append('youtubeLinks', JSON.stringify(data.youtubeLinks || []));
      form.append('projectFiles', JSON.stringify(data.projectFiles || []));

      // Append any new files
      if (data.newFiles) {
        const files: FileList = data.newFiles;
        for (let i = 0; i < files.length; i++) {
          form.append('files', files[i]);
        }
      }

      // Append new project file (.zip, .rar)
      if (data.newProjectFile) {
        form.append('projectFiles', data.newProjectFile);
      }

      const res = await apiClient.put(`/attendance/${attendanceId}/feedback`, form);
      if (res.data.success) {
        toast.success('Lưu phản hồi thành công');
        // update local feedbackData attendanceId and images
        // Merge returned images if available
        const returned = res.data.data || {};
        const returnedImageIds = (returned.images || []).map((i: any) => i._id || i);
        const returnedProjectFiles = returned.projectFiles || [];
        setFeedbackData(prev => ({
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            attendanceId,
            images: returnedImageIds,
            projectFiles: returnedProjectFiles,
            newFiles: undefined,
            newProjectFile: undefined
          }
        }));
      } else {
        toast.error(res.data.message || 'Lỗi lưu phản hồi');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi lưu phản hồi');
    }
  };

  const openLightbox = (src: string, isVideo = false) => setLightbox({ open: true, src, isVideo });

  const closeLightbox = () => setLightbox({ open: false });

  const removeImageFromFeedback = (studentId: string, imgId: string) => {
    setFeedbackData(prev => {
      const curr = prev[studentId] || {};
      const images = (curr.images || []).filter((i: string) => i !== imgId);
      return { ...prev, [studentId]: { ...curr, images } };
    });
  };

  const removeYoutubeLink = (studentId: string, idx: number) => {
    setFeedbackData(prev => {
      const curr = prev[studentId] || {};
      const links = (curr.youtubeLinks || []).slice();
      links.splice(idx, 1);
      return { ...prev, [studentId]: { ...curr, youtubeLinks: links } };
    });
  };

  const removeProjectFromFeedback = (studentId: string, filename: string) => {
    setFeedbackData(prev => {
      const curr = prev[studentId] || {};
      const projectFiles = (curr.projectFiles || []).filter((f: any) => f.filename !== filename);
      return { ...prev, [studentId]: { ...curr, projectFiles } };
    });
  };

  const handleDownloadProjectFile = async (attendanceId: string, filename: string, originalName: string) => {
    try {
      const response = await apiClient.get(`/attendance/project-file/${attendanceId}/${filename}`, {
        responseType: 'blob'
      });
      // Tạo URL download và click
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error('Lỗi khi tải xuống file dự án');
    }
  };

  const toYouTubeEmbed = (url: string) => {
    try {
      if (!url) return url;
      const u = new URL(url);
      let id = '';
      if (u.hostname.includes('youtu.be')) {
        id = u.pathname.slice(1);
      } else if (u.searchParams.has('v')) {
        id = u.searchParams.get('v') || '';
      } else if (u.pathname.includes('/embed/')) {
        id = u.pathname.split('/embed/').pop() || '';
      }
      return id ? `https://www.youtube.com/embed/${id}` : url;
    } catch (e) {
      return url;
    }
  };

  // --- VIEW 1: MÀN HÌNH CHẤM ĐIỂM CHI TIẾT (KHI ĐÃ CHỌN 1 BUỔI) ---
  if (selectedSession) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedSession(null)} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 shadow-sm transition-all">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-none">
                {activeTab === 'today' ? 'Điểm danh buổi học' : 'Chỉnh sửa lịch sử'}
              </h1>
              <p className="text-sm font-bold text-indigo-600 mt-1 uppercase tracking-widest">
                {selectedSession.class?.name || 'Chi tiết buổi học'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveAttendance}
            className="bg-slate-900 text-white px-10 py-4 rounded-[1.5rem] font-black shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
          >
            <Save className="w-5 h-5" /> XÁC NHẬN & LƯU
          </button>
        </header>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden border-b-8 border-b-indigo-600">
          <div className="p-6 bg-slate-50/50 border-b flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <Users className="w-4 h-4 text-slate-400" /> Sĩ số: <b>{sessionStudents.length}</b>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" /> Ngày: <b>{new Date(selectedSession.startTime).toLocaleDateString('vi-VN')}</b>
              </div>
            </div>
            {activeTab === 'history' && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-lg border border-amber-200">Sửa đổi lịch sử</span>
            )}
          </div>

        {/* ====== SECTION: CHẤM CÔNG GIẢNG VIÊN ====== */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden border-b-8 border-b-violet-500 mb-4">
          <div className="p-6 bg-violet-50/50 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-base">Chấm công Giảng viên</h2>
                <p className="text-[10px] text-violet-500 font-bold uppercase tracking-widest">
                  {sessionTeachers.length > 0 ? `${sessionTeachers.length} người tham gia buổi học` : 'Chưa có giảng viên được gán'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowAddTeacherModal(true); loadAllTeachers(); }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-black hover:bg-violet-700 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Thêm GV / TG
            </button>
          </div>

          {sessionTeachers.length === 0 ? (
            <div className="p-8 text-center">
              <UserCog className="w-12 h-12 text-slate-100 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Chưa có giảng viên nào được gán vào buổi học này</p>
              <p className="text-slate-300 text-xs mt-1">Nhấn "Thêm GV / TG" để thêm thủ công</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {sessionTeachers.map((teacher) => {
                const tData = teacherAttData[teacher._id] || { role: 'teacher', status: 'Present', note: '' };
                const isPresent = tData.status === 'Present';
                return (
                  <div key={teacher._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-inner flex-shrink-0",
                        tData.role === 'teacher' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
                      )}>
                        {teacher.fullName?.charAt(0) || 'G'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm leading-tight truncate">{teacher.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {teacher.teacherCode && (
                            <span className="text-[10px] text-slate-400 font-bold">{teacher.teacherCode}</span>
                          )}
                          <span className={cn(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                            tData.role === 'teacher'
                              ? 'bg-violet-100 text-violet-600'
                              : 'bg-blue-100 text-blue-600'
                          )}>
                            {tData.role === 'teacher' ? 'Giảng viên' : 'Trợ giảng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Có mặt / Vắng */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setTeacherAttData(prev => ({ ...prev, [teacher._id]: { ...tData, status: 'Present' } }))}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all border-2",
                          isPresent
                            ? "bg-emerald-500 text-white border-transparent shadow-md"
                            : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300"
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Có mặt
                      </button>
                      <button
                        onClick={() => setTeacherAttData(prev => ({ ...prev, [teacher._id]: { ...tData, status: 'Absent' } }))}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all border-2",
                          !isPresent
                            ? "bg-rose-500 text-white border-transparent shadow-md"
                            : "bg-white text-slate-400 border-slate-200 hover:border-rose-300"
                        )}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Vắng
                      </button>
                    </div>

                    {/* Ghi chú */}
                    <input
                      type="text"
                      placeholder="Ghi chú..."
                      className="flex-1 min-w-0 max-w-[200px] bg-slate-50 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-violet-300 focus:bg-white transition-all"
                      value={tData.note}
                      onChange={(e) => setTeacherAttData(prev => ({ ...prev, [teacher._id]: { ...tData, note: e.target.value } }))}
                    />

                    {/* Đổi vai trò + Xóa */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        title={tData.role === 'teacher' ? 'Chuyển thành Trợ giảng' : 'Chuyển thành Giảng viên'}
                        onClick={() => setTeacherAttData(prev => ({
                          ...prev,
                          [teacher._id]: { ...tData, role: tData.role === 'teacher' ? 'assistant' : 'teacher' }
                        }))}
                        className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                      <button
                        title="Xóa khỏi danh sách buổi này"
                        onClick={() => removeTeacherFromSession(teacher._id)}
                        className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ====== SECTION: ĐIỂM DANH HỌC VIÊN ====== */}
        <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b bg-white">
                  <th className="px-8 py-5">Học viên</th>
                  <th className="px-8 py-5 min-w-[420px]">Trạng thái hiện diện</th>
                  <th className="px-8 py-5">Ghi chú nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessionStudents.map((student) => (
                  <React.Fragment key={student._id}>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg shadow-inner">
                            {student.fullName?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{student.fullName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{student.studentCode || 'HV'}</span>
                              <div className="flex gap-1">
                                <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded-md font-black border border-emerald-100" title="Tổng số buổi đi học">
                                  H: {student.attendance?.presentCount || 0}
                                </span>
                                <span className="text-[8px] bg-rose-50 text-rose-600 px-1 py-0.5 rounded-md font-black border border-rose-100" title="Tổng số buổi nghỉ">
                                  V: {student.attendance?.absentCount || 0}
                                </span>
                                <span className="text-[8px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded-md font-black border border-amber-100" title="Tổng số buổi đi muộn">
                                  M: {student.attendance?.lateCount || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex gap-2">
                          <AttendanceToggle studentId={student._id} status="Present" label="Có mặt" activeBg="bg-emerald-500" />
                          <AttendanceToggle studentId={student._id} status="Late" label="Muộn" activeBg="bg-amber-500" />
                          <AttendanceToggle studentId={student._id} status="Absent" label="Vắng" activeBg="bg-rose-500" />
                          <AttendanceToggle studentId={student._id} status="Excused" label="Phép" activeBg="bg-blue-500" />
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <input
                          type="text"
                          placeholder="Lý do, nộp bài..."
                          className="w-full bg-slate-50 rounded-xl px-4 py-3 text-xs font-medium outline-none border border-transparent focus:border-indigo-300 focus:bg-white transition-all"
                          value={attendanceData[student._id]?.note || ''}
                          onChange={(e) => setAttendanceData(prev => ({ ...prev, [student._id]: { ...prev[student._id], note: e.target.value } }))}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={() => setFeedbackOpen(prev => ({ ...prev, [student._id]: !prev[student._id] }))} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black">Nhận xét & Đính kèm</button>
                          <button onClick={() => { /* quick open feedback */ setFeedbackOpen(prev => ({ ...prev, [student._id]: true })); }} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs">Mở</button>
                        </div>
                      </td>
                    </tr>

                    {feedbackOpen[student._id] && (
                      <tr className="bg-slate-50">
                        <td colSpan={3} className="px-8 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-4">
                              <h3 className="font-black text-indigo-700 uppercase tracking-widest text-sm border-b pb-2">XI. PHIẾU ĐÁNH GIÁ HỌC VIÊN 360°</h3>
                              
                              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                {[
                                  { key: 'attendance_score', label: 'Chuyên cần' },
                                  { key: 'attitude_score', label: 'Thái độ học tập' },
                                  { key: 'tech_skill_score', label: 'Kỹ năng công nghệ' },
                                  { key: 'creative_thinking_score', label: 'Tư duy sáng tạo' },
                                  { key: 'presentation_score', label: 'Thuyết trình / Demo' },
                                  { key: 'teamwork_score', label: 'Làm việc nhóm' },
                                  { key: 'homework_completion_score', label: 'Hoàn thành bài tập' },
                                  { key: 'problem_solving_score', label: 'Giải quyết vấn đề' },
                                  { key: 'proactivity_score', label: 'Tính chủ động' },
                                  { key: 'progress_score', label: 'Mức độ tiến bộ' }
                                ].map(criteria => (
                                  <div key={criteria.key} className="flex justify-between items-center text-xs">
                                    <label className="font-bold text-slate-700">{criteria.label}</label>
                                    <input 
                                      type="number" min={0} max={10} step={0.5}
                                      className="w-16 p-1 border border-slate-300 rounded-md text-center bg-slate-50 focus:bg-white"
                                      value={feedbackData[student._id]?.[criteria.key] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : 0;
                                        setFeedbackData(prev => {
                                          const curr = prev[student._id] || {};
                                          const updated = { ...curr, [criteria.key]: val };
                                          // Recalculate total
                                          const total = ['attendance_score', 'attitude_score', 'tech_skill_score', 'creative_thinking_score', 'presentation_score', 'teamwork_score', 'homework_completion_score', 'problem_solving_score', 'proactivity_score', 'progress_score']
                                            .reduce((sum, k) => sum + (updated[k] || 0), 0);
                                          updated.total_score = total;
                                          if (total >= 90) updated.rank = 'Xuất sắc';
                                          else if (total >= 80) updated.rank = 'Giỏi';
                                          else if (total >= 70) updated.rank = 'Khá';
                                          else if (total >= 50) updated.rank = 'Trung bình';
                                          else updated.rank = 'Yếu';
                                          return { ...prev, [student._id]: updated };
                                        });
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <div className="text-sm font-black text-slate-700">Tổng điểm: <span className="text-xl text-indigo-600">{feedbackData[student._id]?.total_score || 0}</span> / 100</div>
                                <div className="text-sm font-black text-slate-700">Xếp loại: <span className="text-lg text-emerald-600 px-3 py-1 bg-emerald-100 rounded-lg">{feedbackData[student._id]?.rank || 'Chưa đánh giá'}</span></div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <label className="text-[12px] font-black text-emerald-600">Điểm mạnh</label>
                                  <textarea className="w-full mt-1 p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 text-sm focus:bg-white transition-all" rows={2}
                                    value={feedbackData[student._id]?.strengths || ''}
                                    onChange={(e) => setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), strengths: e.target.value } }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-[12px] font-black text-amber-600">Điểm cần cải thiện</label>
                                  <textarea className="w-full mt-1 p-3 rounded-xl border border-amber-200 bg-amber-50/30 text-sm focus:bg-white transition-all" rows={2}
                                    value={feedbackData[student._id]?.weaknesses || ''}
                                    onChange={(e) => setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), weaknesses: e.target.value } }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-[12px] font-black text-indigo-600">Đề xuất cho phụ huynh</label>
                                  <textarea className="w-full mt-1 p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 text-sm focus:bg-white transition-all" rows={2}
                                    value={feedbackData[student._id]?.suggestions_for_parents || ''}
                                    onChange={(e) => setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), suggestions_for_parents: e.target.value } }))}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-3 mt-3 border-t pt-4">

                                <div>
                                  <label className="text-[12px] font-black">YouTube Links</label>
                                  <div className="flex items-center gap-2 mt-2">
                                    <input type="text" placeholder="https://youtube.com/..." className="p-2 rounded-lg border border-slate-200 flex-1"
                                      value={(feedbackData[student._id]?.newYoutube || '')}
                                      onChange={(e) => setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), newYoutube: e.target.value } }))}
                                    />
                                    <button onClick={() => {
                                      const url = feedbackData[student._id]?.newYoutube;
                                      if (!url) return;
                                      const curr = feedbackData[student._id]?.youtubeLinks || [];
                                      setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), youtubeLinks: [...curr, url], newYoutube: '' } }));
                                    }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg">Thêm</button>
                                  </div>

                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    {(feedbackData[student._id]?.youtubeLinks || []).map((l: string, idx: number) => {
                                      const embed = toYouTubeEmbed(l);
                                      return (
                                        <div key={idx} className="relative bg-white rounded-md border border-slate-200 px-2 py-1 flex items-center gap-2">
                                          <button onClick={() => openLightbox(embed, true)} className="text-xs text-indigo-600 hover:underline">Preview</button>
                                          <span className="text-[11px] text-slate-600 max-w-xs truncate">{l}</span>
                                          <button onClick={() => removeYoutubeLink(student._id, idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-md">
                                            <XCircle className="w-4 h-4 text-rose-500" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[12px] font-black">Ảnh/Video</label>
                              <input type="file" accept="image/*,video/*" multiple onChange={(e) => {
                                const files = e.target.files;
                                setFeedbackData(prev => ({ ...prev, [student._id]: { ...(prev[student._id] || {}), newFiles: files } }));
                              }} className="mt-2" />

                              <div className="mt-3 flex gap-2 flex-wrap">
                                {(feedbackData[student._id]?.images || []).map((imgId: string) => {
                                  const src = `${apiClient.defaults.baseURL}/images/${imgId}`;
                                  return (
                                    <div key={imgId} className="relative w-20 h-20">
                                      <img onClick={() => openLightbox(src, false)} src={src} className="w-20 h-20 object-cover rounded-md border cursor-pointer" />
                                      <button onClick={() => removeImageFromFeedback(student._id, imgId)} className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md">
                                        <XCircle className="w-4 h-4 text-rose-500" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="mt-4 border-t pt-4">
                                <label className="text-[12px] font-black block text-slate-700">Tải lên Dự án (.zip, .rar)</label>
                                <input 
                                  type="file" 
                                  accept=".zip,.rar" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setFeedbackData(prev => ({ 
                                        ...prev, 
                                        [student._id]: { ...(prev[student._id] || {}), newProjectFile: file } 
                                      }));
                                    }
                                  }} 
                                  className="mt-2 text-xs block w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                                />

                                {/* Chuẩn bị tải lên */}
                                {feedbackData[student._id]?.newProjectFile && (
                                  <div className="mt-2 text-xs text-indigo-600 flex items-center justify-between bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50">
                                    <span className="truncate max-w-[200px]" title={feedbackData[student._id].newProjectFile.name}>
                                      Sẵn sàng: <b>{feedbackData[student._id].newProjectFile.name}</b>
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setFeedbackData(prev => ({ 
                                          ...prev, 
                                          [student._id]: { ...(prev[student._id] || {}), newProjectFile: undefined } 
                                        }));
                                      }} 
                                      className="text-rose-500 font-bold hover:underline text-[10px]"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                )}

                                {/* Danh sách file đã upload */}
                                <div className="mt-3 space-y-2">
                                  {(feedbackData[student._id]?.projectFiles || []).map((projFile: any, index: number) => {
                                    return (
                                      <div key={projFile.filename || index} className="flex items-center justify-between bg-slate-100/80 p-2 rounded-xl border border-slate-200/50 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => handleDownloadProjectFile(feedbackData[student._id].attendanceId, projFile.filename, projFile.originalName)}
                                          className="text-indigo-600 hover:underline font-bold text-left truncate max-w-[180px]"
                                          title={projFile.originalName}
                                        >
                                          {projFile.originalName}
                                        </button>
                                        <span className="text-[9px] text-slate-400">({(projFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                        <button 
                                          type="button"
                                          onClick={() => removeProjectFromFeedback(student._id, projFile.filename)} 
                                          className="p-1 hover:bg-slate-200 rounded text-rose-500"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="mt-4">
                                <button onClick={() => handleSaveFeedback(student._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black">Lưu phản hồi</button>
                                <button onClick={() => setFeedbackOpen(prev => ({ ...prev, [student._id]: false }))} className="ml-3 px-4 py-2 bg-slate-200 rounded-lg">Đóng</button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: THÊM GIẢNG VIÊN THỦ CÔNG (VIEW 1) */}
        {showAddTeacherModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddTeacherModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-900 text-xl">Thêm Giảng viên / Trợ giảng</h3>
                <button onClick={() => setShowAddTeacherModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="relative mb-4">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc mã..."
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                {loadingTeachers ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
                ) : allTeachers
                    .filter(t => t.fullName?.toLowerCase().includes(teacherSearch.toLowerCase()) || t.teacherCode?.toLowerCase().includes(teacherSearch.toLowerCase()))
                    .map(t => (
                  <div key={t._id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black">
                        {t.fullName?.charAt(0) || 'G'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{t.fullName}</p>
                        <p className="text-[10px] font-bold text-slate-400">{t.teacherCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => addTeacherToSession(t, 'teacher')} className="px-3 py-1.5 bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white rounded-lg text-xs font-black transition-colors">
                        + Giảng viên
                      </button>
                      <button onClick={() => addTeacherToSession(t, 'assistant')} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-black transition-colors">
                        + Trợ giảng
                      </button>
                    </div>
                  </div>
                ))}
                {!loadingTeachers && allTeachers.length > 0 && allTeachers.filter(t => t.fullName?.toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                  <p className="text-center py-6 text-slate-400 text-sm">Không tìm thấy giảng viên phù hợp</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LIGHTBOX FOR IMAGES/VIDEOS IN VIEW 1 */}
        {lightbox.open && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={closeLightbox}>
            <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={closeLightbox} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow-lg">
                <XCircle className="w-6 h-6 text-rose-500" />
              </button>
              <div className="bg-black rounded-md overflow-hidden">
                {lightbox.isVideo ? (
                  <iframe title="youtube-preview" src={lightbox.src} className="w-full h-[60vh]" frameBorder="0" allowFullScreen />
                ) : (
                  <img src={lightbox.src} alt="preview" className="w-full h-auto max-h-[80vh] object-contain bg-black" />
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // --- VIEW 2: MÀN HÌNH DANH SÁCH TABS (HÔM NAY / LỊCH SỬ) ---
  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hệ thống Điểm danh</h1>
          <p className="text-slate-500 text-sm">Quản lý chuyên cần học viên của các lớp học thực tế.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
          <button onClick={() => setActiveTab('today')} className={cn("px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'today' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Lớp hôm nay</button>
          <button onClick={() => { setActiveTab('history'); setSelectedHistoryClass(null); }} className={cn("px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'history' ? "bg-white text-indigo-600 shadow-lg" : "text-slate-400")}>Xem lịch sử</button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>
      ) : activeTab === 'today' ? (



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {todaySessions.length > 0 ? (
            todaySessions.map((session) => (
              <div key={session._id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:bg-indigo-600 transition-colors duration-500" />

                <div className="relative z-10 flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100 shadow-sm">
                        {session.room || 'Phòng học'}
                      </span>
                      {session.status === 'Completed' && (
                        <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                          Đã dạy
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mt-4 leading-tight group-hover:text-indigo-900">
                      {session.class?.name || "Lớp học chưa gán tên"}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                      {session.title || `Buổi dạy số ${session.sessionNumber}`}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-xs shadow-md">
                    <UserCheck className={session.status === 'Completed' ? "text-emerald-500" : "text-slate-300"} />
                  </div>
                </div>

                <div className="relative z-10 flex items-center gap-6 py-6 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-300" />
                    <span className="text-sm font-bold text-slate-600">
                      {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-slate-300" />
                    <span className="text-sm font-bold text-slate-600">
                      {session.teacher?.fullName || 'Chưa gán giáo viên'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => prepareAttendanceForm(session)}
                  className={cn(
                    "relative z-10 w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg",
                    session.status === 'Completed'
                      ? "bg-slate-100 text-slate-400 border border-slate-200"
                      : "bg-slate-900 text-white hover:bg-indigo-600"
                  )}
                >
                  {session.status === 'Completed' ? "Sửa lại điểm danh" : "Bắt đầu điểm danh"}
                </button>
              </div>
            ))
          ) : (
            /* Nếu không có lớp học nào khớp ngày hôm nay */
            <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <Calendar className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Hôm nay không có lịch dạy nào</p>
              <p className="text-slate-300 text-[10px] mt-2 italic">
                (Ngày đang kiểm tra: {new Date().toLocaleDateString('vi-VN')})
              </p>
            </div>
          )}
        </div>



      ) : (
        /* UI Tab Lịch sử (Chọn Lớp -> Buổi) */
        <div className="space-y-6">
          {!selectedHistoryClass ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyClasses.map((cls) => (
                <button key={cls._id} onClick={() => handleSelectHistoryClass(cls)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg text-left group transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all"><BookOpen /></div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight mb-2">{cls.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{cls.course?.name}</p>
                  <div className="mt-6 flex justify-end"><ChevronRight className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" /></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              <button onClick={() => setSelectedHistoryClass(null)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"><ArrowLeft className="w-4 h-4" /> Quay lại chọn lớp</button>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b bg-slate-50/30 font-black text-slate-900 text-xl flex justify-between items-center">
                  <span>Lịch sử các buổi dạy: {selectedHistoryClass.name}</span>
                  <RefreshCcw onClick={() => handleSelectHistoryClass(selectedHistoryClass)} className="w-5 h-5 text-slate-300 cursor-pointer hover:rotate-180 transition-all" />
                </div>
                <div className="divide-y divide-slate-50">
                  {historySessions.map((s) => (
                    <div key={s._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/50 transition-all group">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex flex-col items-center justify-center border shadow-sm">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Buổi</span>
                          <span className="text-lg font-black text-indigo-600 leading-none">{s.sessionNumber}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900 text-sm">{new Date(s.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {s.room}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-4 sm:mt-0">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase border",
                          s.status === 'Scheduled' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        )}>
                          {s.status === 'Scheduled' ? 'Chưa dạy' : 'Đã dạy'}
                        </span>
                        <button
                          onClick={() => prepareAttendanceForm(s)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                        >
                          <Edit3 className="w-3 h-3" /> Điểm danh / Sửa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {lightbox.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeLightbox}>
          <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeLightbox} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow-lg">
              <XCircle className="w-6 h-6 text-rose-500" />
            </button>
            <div className="bg-black rounded-md overflow-hidden">
              {lightbox.isVideo ? (
                <iframe title="youtube-preview" src={lightbox.src} className="w-full h-[60vh]" frameBorder="0" allowFullScreen />
              ) : (
                // Image
                <img src={lightbox.src} alt="preview" className="w-full h-auto max-h-[80vh] object-contain bg-black" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: THÊM GIẢNG VIÊN THỦ CÔNG */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddTeacherModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-900 text-xl">Thêm Giảng viên / Trợ giảng</h3>
              <button onClick={() => setShowAddTeacherModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="relative mb-4">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc mã..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                value={teacherSearch}
                onChange={e => setTeacherSearch(e.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
              {loadingTeachers ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
              ) : allTeachers
                  .filter(t => t.fullName?.toLowerCase().includes(teacherSearch.toLowerCase()) || t.teacherCode?.toLowerCase().includes(teacherSearch.toLowerCase()))
                  .map(t => (
                <div key={t._id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black">
                      {t.fullName?.charAt(0) || 'G'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{t.fullName}</p>
                      <p className="text-[10px] font-bold text-slate-400">{t.teacherCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => addTeacherToSession(t, 'teacher')} className="px-3 py-1.5 bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white rounded-lg text-xs font-black transition-colors">
                      + Giảng viên
                    </button>
                    <button onClick={() => addTeacherToSession(t, 'assistant')} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-black transition-colors">
                      + Trợ giảng
                    </button>
                  </div>
                </div>
              ))}
              {!loadingTeachers && allTeachers.length > 0 && allTeachers.filter(t => t.fullName?.toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                <p className="text-center py-6 text-slate-400 text-sm">Không tìm thấy giảng viên phù hợp</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}