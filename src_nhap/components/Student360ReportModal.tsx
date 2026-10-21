import React, { useMemo } from 'react';
import { X, Loader2, AlertCircle, Calendar, GraduationCap, Award, Phone, Mail } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Record360 {
  _id: string;
  schedule?: {
    title: string;
    startTime: string;
  };
  total_score: number;
  teacherScore?: number;
  attendance_score: number;
  attitude_score: number;
  tech_skill_score: number;
  creative_thinking_score: number;
  presentation_score: number;
  teamwork_score: number;
  homework_completion_score: number;
  problem_solving_score: number;
  proactivity_score: number;
  progress_score: number;
  rank?: string;
  strengths?: string;
  weaknesses?: string;
  suggestions_for_parents?: string;
  teacherComment?: string;
}

interface StudentInfo {
  studentName: string;
  studentCode: string;
  email: string;
  phone: string;
  courseName: string;
  className: string;
}

interface Student360ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentInfo: StudentInfo | null;
  records: Record360[];
  loading: boolean;
}

export default function Student360ReportModal({ isOpen, onClose, studentInfo, records, loading }: Student360ReportModalProps) {
  
  const chartData = useMemo(() => {
    if (!records || records.length === 0) return [];
    
    // Sort records by date to show progress correctly
    const sorted = [...records].sort((a, b) => {
      const dateA = new Date(a.schedule?.startTime || 0).getTime();
      const dateB = new Date(b.schedule?.startTime || 0).getTime();
      return dateA - dateB;
    });

    return sorted.map((r, i) => ({
      name: `B${i + 1}`, // Buổi 1, Buổi 2...
      date: new Date(r.schedule?.startTime || '').toLocaleDateString('vi-VN'),
      title: r.schedule?.title || `Buổi ${i+1}`,
      total: r.total_score || r.teacherScore || 0
    }));
  }, [records]);

  const radarData = useMemo(() => {
    if (!records || records.length === 0) return [];
    
    let sum = {
      attendance: 0, attitude: 0, tech: 0, creative: 0, 
      presentation: 0, teamwork: 0, homework: 0, 
      problem_solving: 0, proactive: 0, progress: 0
    };
    
    let count = records.length;

    records.forEach(r => {
      sum.attendance += (r.attendance_score || 0);
      sum.attitude += (r.attitude_score || 0);
      sum.tech += (r.tech_skill_score || 0);
      sum.creative += (r.creative_thinking_score || 0);
      sum.presentation += (r.presentation_score || 0);
      sum.teamwork += (r.teamwork_score || 0);
      sum.homework += (r.homework_completion_score || 0);
      sum.problem_solving += (r.problem_solving_score || 0);
      sum.proactive += (r.proactivity_score || 0);
      sum.progress += (r.progress_score || 0);
    });

    return [
      { subject: 'Chuyên cần', A: Math.round((sum.attendance / count) * 10) },
      { subject: 'Thái độ', A: Math.round((sum.attitude / count) * 10) },
      { subject: 'Kỹ năng CN', A: Math.round((sum.tech / count) * 10) },
      { subject: 'Sáng tạo', A: Math.round((sum.creative / count) * 10) },
      { subject: 'Thuyết trình', A: Math.round((sum.presentation / count) * 10) },
      { subject: 'Làm việc nhóm', A: Math.round((sum.teamwork / count) * 10) },
      { subject: 'BTVN', A: Math.round((sum.homework / count) * 10) },
      { subject: 'Giải quyết VĐ', A: Math.round((sum.problem_solving / count) * 10) },
      { subject: 'Chủ động', A: Math.round((sum.proactive / count) * 10) },
      { subject: 'Tiến bộ', A: Math.round((sum.progress / count) * 10) },
    ]; // Multiply by 10 to scale to 100 max for radar
  }, [records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-300">
      <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-white">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 rounded-t-[2.5rem]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">Hồ Sơ Đánh Giá 360° Toàn Diện</h2>
              <p className="text-sm font-bold text-slate-500 mt-1">Hệ thống báo cáo tiến độ học tập và rèn luyện</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-all">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Đang phân tích dữ liệu...</p>
            </div>
          ) : !studentInfo ? (
            <div className="text-center py-20 text-slate-500">Không có dữ liệu học viên</div>
          ) : (
            <>
              {/* PROFILE SECTION */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="w-28 h-28 bg-indigo-600 text-white rounded-[2rem] flex flex-col items-center justify-center font-black text-4xl shadow-lg shadow-indigo-200 shrink-0">
                  {studentInfo.studentName.charAt(0)}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{studentInfo.studentName}</h3>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-slate-200">
                      MÃ: {studentInfo.studentCode || 'N/A'}
                    </span>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase border border-indigo-100 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" /> {studentInfo.courseName}
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold uppercase border border-emerald-100 flex items-center gap-1">
                      LỚP: {studentInfo.className}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mt-4 pt-4 border-t border-slate-100 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {studentInfo.phone || 'Chưa cập nhật SĐT'}</div>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> {studentInfo.email || 'Chưa cập nhật Email'}</div>
                  </div>
                </div>
              </div>

              {records && records.length > 0 ? (
                <>
                  {/* CHARTS SECTION */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Line Chart */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Biểu đồ Sự tiến bộ (Tổng điểm)</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any) => [`${value} điểm`, 'Tổng điểm']}
                              labelFormatter={(label: any) => `Buổi học: ${label}`}
                            />
                            <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={4} dot={{r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 3}} activeDot={{r: 8}} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Radar Chart */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Đánh giá Năng lực Trung bình (Thang 100)</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Năng lực" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                            <Tooltip formatter={(val: any) => [`${val}/100`, 'Điểm TB']} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* RECORDS HISTORY */}
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-500" />
                      Chi tiết Lịch sử Đánh giá
                    </h4>
                    <div className="space-y-6">
                      {records.map((record: Record360, idx: number) => (
                        <div key={record._id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 rounded-r-[2rem]" />
                          
                          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-50 pb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg border border-indigo-100">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-lg">{record.schedule?.title || `Buổi học`}</p>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(record.schedule?.startTime || '').toLocaleDateString('vi-VN')} - {new Date(record.schedule?.startTime || '').toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</p>
                              </div>
                            </div>
                            <div className="mt-4 md:mt-0 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 text-center">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Tổng điểm</p>
                              <div className="flex items-end gap-2 justify-center">
                                <span className="text-3xl font-black text-indigo-600 leading-none">{record.total_score || record.teacherScore || 0}</span>
                                <span className="text-sm font-bold text-emerald-500 mb-1">{record.rank ? `• ${record.rank}` : ''}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            {[
                              { label: 'Chuyên cần', val: record.attendance_score },
                              { label: 'Thái độ', val: record.attitude_score },
                              { label: 'Kỹ năng CN', val: record.tech_skill_score },
                              { label: 'Sáng tạo', val: record.creative_thinking_score },
                              { label: 'Thuyết trình', val: record.presentation_score },
                              { label: 'Làm việc nhóm', val: record.teamwork_score },
                              { label: 'Làm BTVN', val: record.homework_completion_score },
                              { label: 'Giải quyết VĐ', val: record.problem_solving_score },
                              { label: 'Chủ động', val: record.proactivity_score },
                              { label: 'Tiến bộ', val: record.progress_score },
                            ].map((c, i) => (
                              <div key={i} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 text-center" title={c.label}>{c.label}</p>
                                <p className="text-lg font-black text-slate-800">{c.val ?? '-'}</p>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Điểm mạnh
                              </p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap font-medium">{record.strengths || '-'}</p>
                            </div>
                            <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Cần cải thiện
                              </p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap font-medium">{record.weaknesses || '-'}</p>
                            </div>
                            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Đề xuất
                              </p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap font-medium">{record.suggestions_for_parents || '-'}</p>
                            </div>
                          </div>

                          {record.teacherComment && !record.strengths && (
                            <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nhận xét chung (Mẫu cũ)</p>
                              <p className="text-sm text-slate-700 font-medium">{record.teacherComment}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
                    <AlertCircle className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Chưa có dữ liệu 360°</h3>
                  <p className="text-slate-500 text-sm mt-2 max-w-md text-center font-medium">Học viên này chưa có phiếu đánh giá chi tiết nào được ghi nhận trong khoá học này.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
