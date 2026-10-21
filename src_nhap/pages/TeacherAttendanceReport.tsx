import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Loader2, 
  Download, 
  Search, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Code, 
  BookOpen,
  Award,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function TeacherAttendanceReport() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail view state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  useEffect(() => {
    fetchSummary();
  }, [selectedMonth, selectedYear]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/teacher-attendance/summary?month=${selectedMonth}&year=${selectedYear}`);
      if (res.data.success) {
        setSummaryData(res.data.data.teachers || []);
        setSelectedTeacherId(null);
        setTeacherDetail(null);
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải báo cáo tổng hợp: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherDetail = async (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setLoadingDetail(true);
    try {
      const res = await apiClient.get(`/teacher-attendance/report?teacherId=${teacherId}&month=${selectedMonth}&year=${selectedYear}`);
      if (res.data.success) {
        setTeacherDetail(res.data.data);
      }
    } catch (err: any) {
      toast.error('Lỗi tải chi tiết: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExport = () => {
    toast.success('Tính năng xuất báo cáo Excel đang được khởi tạo!');
  };

  const filteredSummary = summaryData.filter(item => 
    item.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.teacherCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Báo cáo công giảng dạy chính thức
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kết quả Chấm công Giảng viên</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng hợp số ca/giờ dạy được **Admin phê duyệt** chính thức theo từng tháng.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-3.5 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-violet-600 mr-2" />
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none pr-2 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <span className="text-slate-300 mx-2">/</span>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none border-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md transition-all"
          >
            <Download className="w-4 h-4" /> Xuất Excel
          </button>
        </div>
      </header>

      {/* SUMMARY TABLE */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg">Bảng tổng hợp công Tháng {selectedMonth}/{selectedYear}</h2>
              <p className="text-xs text-slate-500">{summaryData.length} giảng viên tham gia tích công</p>
            </div>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Tìm tên hoặc mã GV..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b bg-slate-50/80">
                  <th className="px-6 py-4">Giảng viên</th>
                  <th className="px-6 py-4">Cơ sở & Môn phụ trách</th>
                  <th className="px-6 py-4 text-center">Tổng lượt đăng ký</th>
                  <th className="px-6 py-4 text-center">Số Ca/Slot đã duyệt</th>
                  <th className="px-6 py-4 text-center">Chờ duyệt</th>
                  <th className="px-6 py-4 text-right">Tổng giờ công (quy đổi)</th>
                  <th className="px-6 py-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Không có bản ghi công nào được Admin duyệt trong tháng này.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((item, idx) => (
                    <tr 
                      key={`${item.teacherId}-${idx}`} 
                      className={cn(
                        "hover:bg-violet-50/30 transition-colors",
                        selectedTeacherId === item.teacherId ? "bg-violet-50/50" : ""
                      )}
                    >
                      {/* Teacher info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm border border-violet-200">
                            {item.fullName?.charAt(0) || 'G'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{item.teacherCode || 'GV-DEEPCODE'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Campuses & Subjects */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {item.campuses && item.campuses.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.campuses.map((cam: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {cam}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.subjects && item.subjects.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.subjects.map((sub: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                  <Code className="w-3 h-3" />
                                  {sub}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Submissions count */}
                      <td className="px-6 py-4 text-center font-bold text-slate-700">{item.totalSubmissions}</td>

                      {/* Approved slots count */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {item.approvedSlotsCount} ca
                        </span>
                      </td>

                      {/* Pending count */}
                      <td className="px-6 py-4 text-center">
                        {item.pendingLogsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 animate-pulse" />
                            {item.pendingLogsCount} chờ
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>

                      {/* Total Approved Hours */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-base font-black text-slate-900">
                          {item.totalHours ? item.totalHours.toFixed(1) : '0.0'}
                        </span>
                        <span className="text-xs font-bold text-slate-400 ml-1">giờ</span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => fetchTeacherDetail(item.teacherId)}
                          className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            selectedTeacherId === item.teacherId
                              ? "bg-violet-600 text-white shadow-md"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          )}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TEACHER DETAIL DRILL-DOWN */}
      {selectedTeacherId && (
        <div className="bg-white rounded-[2rem] border border-violet-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border-t-4 border-t-violet-600">
          <div className="p-6 border-b flex items-center justify-between bg-violet-50/30">
            <div>
              <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-violet-600" />
                Chi tiết lượt tích công giảng dạy
              </h3>
              {teacherDetail && (
                <p className="text-xs text-violet-700 font-bold mt-1">
                  Đã duyệt: {teacherDetail.summary?.approvedSlotsCount || 0} ca dạy ({teacherDetail.summary?.totalSlotHours || '0.0'} giờ công)
                </p>
              )}
            </div>
            <button 
              onClick={() => { setSelectedTeacherId(null); setTeacherDetail(null); }}
              className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full border border-slate-200 shadow-sm"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {loadingDetail ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
          ) : !teacherDetail || teacherDetail.records.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              Không có lượt tích công nào trong khoảng thời gian này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b bg-slate-50">
                    <th className="px-6 py-4">Ngày dạy & Cơ sở</th>
                    <th className="px-6 py-4">Các Ca / Slot tích</th>
                    <th className="px-6 py-4">Môn học & Lớp phụ trách</th>
                    <th className="px-6 py-4">Trạng thái Admin duyệt</th>
                    <th className="px-6 py-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherDetail.records.map((r: any) => (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {new Date(r.date).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {r.campus?.name || 'N/A'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {r.slots?.map((s: any, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                              {s.name} ({s.shift})
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4 space-y-1">
                        {r.subjects && r.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.subjects.map((sub: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                ⚡ {sub}
                              </span>
                            ))}
                          </div>
                        )}

                        {((r.classes && r.classes.length > 0) || (r.classNames && r.classNames.length > 0) || r.className) && (
                          <div className="flex flex-wrap gap-1">
                            {r.classes && r.classes.length > 0 ? (
                              r.classes.map((cl: any, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  📘 {cl.name}
                                </span>
                              ))
                            ) : r.classNames && r.classNames.length > 0 ? (
                              r.classNames.map((cnName: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  📘 {cnName}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                📘 {r.className}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {r.status === 'Approved' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Đã chấp thuận
                            </span>
                            {r.approvedBy?.fullName && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Bởi: {r.approvedBy.fullName}
                              </div>
                            )}
                          </div>
                        )}
                        {r.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Chờ phê duyệt
                          </span>
                        )}
                        {r.status === 'Rejected' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              Từ chối
                            </span>
                            {r.rejectReason && (
                              <div className="text-[11px] text-rose-600 mt-0.5 italic">
                                Lý do: {r.rejectReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-600 italic">
                          {r.note || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
