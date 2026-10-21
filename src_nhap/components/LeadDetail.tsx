import React, { useState, useEffect } from 'react';
import {
  User, School, Calendar, Target, Brain, DollarSign, MapPin,
  ClipboardCheck, Clock, MessageSquare, GraduationCap, Activity as ActivityIcon,
  ThumbsUp, Phone, Mail, MessageCircle, FileText, UserPlus, Plus, CheckCircle2,
  Edit2, Send, Loader2, Info
} from 'lucide-react';
import { Lead } from '../types';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

interface LeadDetailProps {
  lead: Lead;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onUpdateAppointment?: (leadId: string, time: string) => void;
  onConvertToStudent?: (lead: Lead) => void;
}

export function LeadDetail({ lead, onClose, onEdit, onUpdateAppointment, onConvertToStudent }: LeadDetailProps) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'activities' | 'test'>('info');

  // States cho Lịch hẹn
  const [isScheduling, setIsScheduling] = useState(false);
  const [tempTime, setTempTime] = useState(lead.testAppointmentTime || '');

  // States cho Tab Hoạt động (Lịch sử chăm sóc)
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'CALL', // Enum: CALL, ZALO, MEETING, EMAIL, NOTE
    content: ''
  });

  // 1. Fetch danh sách hoạt động từ API
  // const fetchActivities = async () => {
  //   try {
  //     setLoadingActivities(true);
  //     const res = await apiClient.get(`/leads/${lead._id || lead.id}/activities`);
  //     if (res.data.success) {
  //       setActivities(res.data.data);
  //     }
  //   } catch (error) {
  //     console.error("Lỗi fetch activities:", error);
  //   } finally {
  //     setLoadingActivities(false);
  //   }
  // };

  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const leadId = lead._id || lead.id;

      // URL mới: /lead-activities/:leadId/activities
      const res = await apiClient.get(`/lead-activities/${leadId}/activities`);

      if (res.data.success) {
        setActivities(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch sử chăm sóc:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Tự động fetch khi chuyển sang tab activities
  useEffect(() => {
    if (activeTab === 'activities') {
      fetchActivities();
    }
  }, [activeTab, lead]);

  // // 2. Thêm hoạt động mới
  // const handleAddActivity = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!newActivity.content.trim()) return;

  //   try {
  //     const payload = {
  //       type: newActivity.type,
  //       content: newActivity.content,
  //       staff: currentUser?._id, // Ghi nhận nhân viên đang login
  //       activityTime: new Date()
  //     };

  //     const res = await apiClient.post(`/leads/${lead._id || lead.id}/activities`, payload);

  //     if (res.data.success) {
  //       toast.success("Đã lưu hoạt động");
  //       setNewActivity({ ...newActivity, content: '' }); // Clear input
  //       fetchActivities(); // Refresh list
  //     }
  //   } catch (error) {
  //     toast.error("Không thể lưu hoạt động");
  //   }


  // // 2. Thêm hoạt động mới
  // const handleAddActivity = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   console.group("🚀 Debug: handleAddActivity");

  //   // Kiểm tra nội dung trống
  //   if (!newActivity.content.trim()) {
  //     console.warn("⚠️ Cảnh báo: Nội dung hoạt động đang trống.");
  //     console.groupEnd();
  //     return;
  //   }

  //   const leadId = lead._id || lead.id;

  //   // Kiểm tra ID Lead
  //   if (!leadId) {
  //     console.error("❌ Lỗi: Không tìm thấy ID của Lead!", lead);
  //     toast.error("Lỗi dữ liệu Lead");
  //     console.groupEnd();
  //     return;
  //   }

  //   try {

  //     const payload = {
  //       type: newActivity.type, // Phải là 'CALL' chứ không phải 'Call'
  //       content: newActivity.content,
  //       staff: currentUser?._id || null, // Nếu null thì backend sẽ bỏ qua
  //       activityTime: new Date()
  //     };


  //     console.log("📍 Lead ID:", leadId);
  //     console.log("👤 Current User ID (Staff):", currentUser?._id);
  //     console.log("📦 Payload gửi đi:", payload);
  //     console.log("🔗 URL:", `/leads/${leadId}/activities`);

  //     const res = await apiClient.post(`/leads/${leadId}/activities`, payload);

  //     console.log("📥 Server Response:", res.data);

  //     if (res.data.success) {
  //       toast.success("Đã lưu hoạt động");
  //       console.log("✅ Thành công!");
  //       setNewActivity({ ...newActivity, content: '' }); // Clear input
  //       fetchActivities(); // Refresh list
  //     } else {
  //       console.warn("⚠️ Server trả về success: false", res.data);
  //     }
  //   } catch (error: any) {
  //     console.error("❌ Lỗi nghiêm trọng khi gọi API:");
  //     if (error.response) {
  //       // Lỗi từ phía Server trả về (4xx, 5xx)
  //       console.error("Status:", error.response.status);
  //       console.error("Data:", error.response.data);
  //     } else if (error.request) {
  //       // Lỗi không nhận được phản hồi (Network error)
  //       console.error("Request Error (Không có phản hồi):", error.request);
  //     } else {
  //       console.error("Error Message:", error.message);
  //     }
  //     toast.error(error.response?.data?.message || "Không thể lưu hoạt động");
  //   } finally {
  //     console.groupEnd();
  //   }
  // };


  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newActivity.content.trim()) return;

    const leadId = lead._id || lead.id;

    try {
      // Chuẩn hóa dữ liệu trước khi gửi
      const payload = {
        type: newActivity.type.toUpperCase(), // 'CALL', 'ZALO'...
        content: newActivity.content.trim(),
        staff: currentUser?._id || null, // ID nhân viên đang login
        activityTime: new Date()
      };

      // URL ĐÚNG theo cấu hình backend của bạn
      const apiUrl = `/lead-activities/${leadId}/activities`;

      console.log("🚀 Gọi API:", apiUrl);
      console.log("📦 Dữ liệu gửi đi:", payload);

      const res = await apiClient.post(apiUrl, payload);

      if (res.data.success) {
        toast.success("Đã lưu lịch sử chăm sóc");
        setNewActivity({ ...newActivity, content: '' }); // Reset ô nhập
        fetchActivities(); // Tải lại danh sách để hiện cái mới nhất
      }
    } catch (error: any) {
      console.error("❌ Lỗi API:");
      const errorMsg = error.response?.data?.message || "Không thể lưu hoạt động";
      toast.error(errorMsg);

      if (error.response?.status === 404) {
        console.error("Lỗi 404: Hãy kiểm tra lại tiền tố ở server.js hoặc route.js");
      }
    }
  };

  const handleScheduleUpdate = () => {
    if (onUpdateAppointment) {
      onUpdateAppointment(lead._id || lead.id, tempTime);
      setIsScheduling(false);
    }
  };

  // Helper UI Components
  const DetailItem = ({ icon: Icon, label, value, fullWidth = false }: any) => (
    <div className={`p-4 bg-slate-50 rounded-2xl border border-slate-100 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
        {value || 'Chưa cập nhật'}
      </p>
    </div>
  );

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return 'Chưa có lịch hẹn';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <Phone className="w-4 h-4" />;
      case 'ZALO': return <MessageCircle className="w-4 h-4" />;
      case 'MEETING': return <User className="w-4 h-4" />;
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };



  // States cho Tab Test đầu vào
  const [tests, setTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [isTestFormOpen, setIsTestFormOpen] = useState(false);
  const [newTest, setNewTest] = useState({
    score: '',
    level: '',
    recommendedCourse: '',
    comment: '',
    testDate: new Date().toISOString().slice(0, 16) // format cho input datetime-local
  });

  // 1. Lấy danh sách bài Test từ API
  const fetchTests = async () => {
    try {
      setLoadingTests(true);
      const leadId = lead._id || lead.id;
      // Theo route: router.use('/lead-tests', leadTestRoutes) + router.get('/leads/:leadId/tests')
      const res = await apiClient.get(`/lead-tests/leads/${leadId}/tests`);
      if (res.data.success) {
        setTests(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi fetch tests:", error);
    } finally {
      setLoadingTests(false);
    }
  };

  // Tự động fetch khi chuyển sang tab test
  useEffect(() => {
    if (activeTab === 'test') {
      fetchTests();
    }
  }, [activeTab, lead]);

  // 2. Hàm lưu kết quả Test mới
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const leadId = lead._id || lead.id;

    try {
      const payload = {
        ...newTest,
        score: Number(newTest.score), // Ép kiểu số cho score
        teacher: currentUser?._id,    // Ghi nhận giáo viên chấm (User đang login)
      };

      const res = await apiClient.post(`/lead-tests/leads/${leadId}/tests`, payload);

      if (res.data.success) {
        toast.success("Đã lưu kết quả Test");
        setIsTestFormOpen(false);
        setNewTest({ score: '', level: '', recommendedCourse: '', comment: '', testDate: new Date().toISOString().slice(0, 16) });
        fetchTests(); // Tải lại danh sách
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể lưu kết quả test");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-100 sticky top-0 bg-white z-10">
        {(['info', 'activities', 'test'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            {tab === 'info' ? 'Thông tin chi tiết' : tab === 'activities' ? 'Lịch sử chăm sóc' : 'Test đầu vào'}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* TAB 1: THÔNG TIN CHI TIẾT */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem icon={User} label="Họ và Tên" value={lead.name} />
            <DetailItem icon={School} label="Trường / Cơ quan" value={lead.school} />
            <DetailItem icon={Calendar} label="Năm sinh" value={lead.birthYear} />
            <DetailItem icon={Target} label="Nhu cầu học" value={lead.needs} />
            <DetailItem icon={GraduationCap} label="Ngành / Định hướng" value={lead.major} />
            <DetailItem icon={ThumbsUp} label="Thái độ tư vấn" value={lead.attitude} />
            <DetailItem icon={MapPin} label="Hình thức học" value={lead.learningMechanism} />
            <DetailItem icon={Brain} label="Năng lực" value={lead.competence} />
            <DetailItem icon={DollarSign} label="Phản ứng giá" value={lead.priceReaction} fullWidth />

            {/* Lịch hẹn Test */}
            <div className="col-span-full p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Lịch hẹn Test đầu vào
                </span>
                {!isScheduling && (
                  <button onClick={() => setIsScheduling(true)} className="text-xs font-bold text-indigo-600 underline">Thay đổi</button>
                )}
              </div>
              {isScheduling ? (
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={tempTime}
                    onChange={(e) => setTempTime(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border-2 border-indigo-200 outline-none text-sm"
                  />
                  <button onClick={handleScheduleUpdate} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md">Lưu</button>
                  <button onClick={() => setIsScheduling(false)} className="px-4 py-2 bg-white border rounded-xl text-xs">Hủy</button>
                </div>
              ) : (
                <p className="text-slate-900 font-bold text-lg">{formatDateTime(lead.testAppointmentTime)}</p>
              )}
            </div>

            <DetailItem icon={MessageSquare} label="Ghi chú Sales" value={lead.teacherNotes} fullWidth />
          </div>
        )}

        {/* TAB 2: LỊCH SỬ CHĂM SÓC (ACTIVITIES) */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            {/* Quick Log Activity Form */}
            <form onSubmit={handleAddActivity} className="bg-slate-900 p-5 rounded-xs shadow-xl">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <ActivityIcon className="w-4 h-4" /> Ghi nhận tương tác mới
                  </span>
                  <select
                    value={newActivity.type}
                    onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                    className="bg-slate-800 text-white border-none rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none cursor-pointer"
                  >
                    <option value="CALL">📞 CALL</option>
                    <option value="ZALO">💬 ZALO</option>
                    <option value="MEETING">🤝 MEETING</option>
                    <option value="EMAIL">📧 EMAIL</option>
                    <option value="NOTE">📝 NOTE</option>
                  </select>
                </div>
                <div className="relative">
                  <textarea
                    placeholder="Nhập nội dung tư vấn, phản hồi của khách hàng..."
                    className="w-full bg-slate-800 text-white border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-emerald-500 transition-all min-h-[100px] resize-none"
                    value={newActivity.content}
                    onChange={(e) => setNewActivity({ ...newActivity, content: e.target.value })}
                  />
                  <button
                    type="submit"
                    disabled={!newActivity.content.trim()}
                    className="absolute bottom-3 right-3 p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-slate-600 transition-all shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Timeline Activities */}
            <div className="relative space-y-6 pl-6 border-l-2 border-slate-100 ml-4 py-2">
              {loadingActivities ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
              ) : activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act._id} className="relative group">
                    <div className="absolute -left-[33px] top-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm" />
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-slate-50 rounded-lg text-emerald-600">
                            {getActivityIcon(act.type)}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{act.type}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(act.activityTime || act.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{act.content}</p>
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-50">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 uppercase">
                          {act.staff?.fullName?.charAt(0) || 'S'}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                          Ghi nhận bởi: <span className="text-slate-600">{act.staff?.fullName || 'Hệ thống'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center bg-slate-50 rounded-xs border-2 border-dashed border-slate-200">
                  <Info className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">Chưa có lịch sử chăm sóc.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TEST ĐẦU VÀO */}
        {/* TAB 3: TEST ĐẦU VÀO */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-500" /> Danh sách kết quả Test
              </h3>
              {!isTestFormOpen && (
                <button
                  onClick={() => setIsTestFormOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                  <Plus className="w-4 h-4" /> Nhập kết quả mới
                </button>
              )}
            </div>

            {/* Form nhập kết quả Test */}
            {isTestFormOpen && (
              <form onSubmit={handleCreateTest} className="bg-white p-6 rounded-xs border-2 border-indigo-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Điểm số (0-100)</label>
                    <input
                      required type="number" min="0" max="100"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold"
                      value={newTest.score}
                      onChange={(e) => setNewTest({ ...newTest, score: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trình độ (Level)</label>
                    <input
                      required type="text" placeholder="VD: B1, Intermediate..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      value={newTest.level}
                      onChange={(e) => setNewTest({ ...newTest, level: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thời gian test</label>
                    <input
                      required type="datetime-local"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm"
                      value={newTest.testDate}
                      onChange={(e) => setNewTest({ ...newTest, testDate: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Khóa học đề xuất</label>
                    <input
                      required type="text" placeholder="VD: FullStack Coaching, IELTS 6.5..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      value={newTest.recommendedCourse}
                      onChange={(e) => setNewTest({ ...newTest, recommendedCourse: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nhận xét chi tiết</label>
                    <textarea
                      rows={3} placeholder="Điểm mạnh, điểm yếu, thái độ học viên..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm"
                      value={newTest.comment}
                      onChange={(e) => setNewTest({ ...newTest, comment: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsTestFormOpen(false)} className="px-6 py-2 text-sm font-bold text-slate-500">Hủy</button>
                  <button type="submit" className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700">Lưu kết quả</button>
                </div>
              </form>
            )}

            {/* Danh sách kết quả Test */}
            <div className="space-y-4">
              {loadingTests ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
              ) : tests.length > 0 ? (
                tests.map((test) => (
                  <div key={test._id} className="bg-white p-5 rounded-xs border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-indigo-50 p-3 rounded-2xl text-center border border-indigo-100/50">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Điểm số</p>
                        <p className="text-2xl font-black text-indigo-600">{test.score}<span className="text-xs text-indigo-400">/100</span></p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Trình độ</p>
                        <p className="text-lg font-bold text-slate-800">{test.level}</p>
                      </div>
                      <div className="col-span-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Khóa học đề xuất
                        </p>
                        <p className="text-sm font-bold text-slate-800">{test.recommendedCourse}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Nhận xét
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed italic">"{test.comment || 'Không có nhận xét'}"</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 uppercase">
                            {test.teacher?.fullName?.charAt(0) || 'G'}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            Giáo viên chấm: <span className="text-slate-700">{test.teacher?.fullName || 'N/A'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                          <Calendar className="w-3 h-3" /> {new Date(test.testDate).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center bg-slate-50 rounded-xs border-2 border-dashed border-slate-200">
                  <ClipboardCheck className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">Chưa có dữ liệu bài test cho Lead này.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row justify-between gap-4 pt-6 border-t border-slate-100">
        <div className="flex gap-2">
          {lead.status !== 'Converted' ? (
            <button
              onClick={() => onConvertToStudent?.(lead)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg"
            >
              <UserPlus className="w-5 h-5" /> Chốt đăng ký
            </button>
          ) : (
            <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" /> Đã thành học viên
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all">Đóng</button>
          <button
            onClick={() => onEdit(lead)}
            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4 text-emerald-400" /> Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}