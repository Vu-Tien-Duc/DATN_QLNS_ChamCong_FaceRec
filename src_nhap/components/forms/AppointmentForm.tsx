import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/apiClient';
import { toast } from 'react-hot-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  FileText, 
  Activity, 
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface AppointmentFormProps {
  lead?: any;    // Nếu tạo từ Lead
  student?: any; // Nếu tạo từ Học viên
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function AppointmentForm({ lead, student, onSubmit, onCancel }: AppointmentFormProps) {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  const [formData, setFormData] = useState({
    lead: lead?._id || null,
    student: student?._id || null,
    type: 'Consultation', // Default enum
    appointmentTime: '',
    location: '',
    staff: '', // ID người phụ trách lịch hẹn
    status: 'Scheduled',
    note: ''
  });

  // 1. Load danh sách nhân viên để gán người phụ trách lịch hẹn (Staff)
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoadingStaff(true);
        const res = await apiClient.get('/users');
        if (res.data.success) {
          setStaffList(res.data.data);
          // Tự động chọn nhân viên đang login hoặc nhân viên đã gán cho Lead
          const assignedId = lead?.assignedTo?._id || lead?.assignedTo;
          if (assignedId) setFormData(prev => ({ ...prev, staff: assignedId }));
        }
      } catch (error) {
        toast.error("Không thể tải danh sách nhân viên");
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, [lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation cơ bản
    if (!formData.appointmentTime) {
      return toast.error("Vui lòng chọn thời gian hẹn");
    }
    if (!formData.staff) {
      return toast.error("Vui lòng chọn nhân viên phụ trách lịch hẹn");
    }

    // Gửi dữ liệu về hàm handleSave ở Leads.tsx
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header Info */}
      <div className="bg-slate-900 p-4 rounded-2xl flex items-center gap-4 text-white shadow-lg">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-xl">
          {(lead?.name || student?.fullName || "U")?.charAt(0)}
        </div>
        <div>
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Tạo lịch hẹn cho</p>
          <h4 className="font-bold text-base">{lead?.name || student?.fullName}</h4>
          <p className="text-xs text-slate-400">{lead?.phone || student?.phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Loại lịch hẹn */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Loại cuộc hẹn
          </label>
          <select
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="Consultation">Consultation (Tư vấn)</option>
            <option value="TrialClass">TrialClass (Học thử)</option>
            <option value="Test">Test (Kiểm tra)</option>
            <option value="Meeting">Meeting (Gặp mặt)</option>
          </select>
        </div>

        {/* Trạng thái */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Trạng thái ban đầu
          </label>
          <select
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Scheduled">🎯 Đã lên lịch</option>
            <option value="Completed">✅ Đã hoàn thành</option>
            <option value="Cancelled">❌ Đã hủy</option>
          </select>
        </div>

        {/* Thời gian */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Thời gian
          </label>
          <input
            type="datetime-local"
            required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={formData.appointmentTime}
            onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
          />
        </div>

        {/* Nhân viên phụ trách lịch hẹn */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Nhân viên tiếp đón
          </label>
          <div className="relative">
            <select
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none appearance-none"
              value={formData.staff}
              onChange={(e) => setFormData({ ...formData, staff: e.target.value })}
            >
              <option value="">-- Chọn nhân viên --</option>
              {staffList.map((s) => (
                <option key={s._id} value={s._id}>{s.fullName}</option>
              ))}
            </select>
            {loadingStaff && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>

        {/* Địa điểm */}
        <div className="col-span-full space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Địa điểm / Phòng họp
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            placeholder="Ví dụ: Phòng 201 hoặc Google Meet link..."
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>

        {/* Ghi chú */}
        <div className="col-span-full space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Ghi chú nội dung lịch hẹn
          </label>
          <textarea
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Ghi chú yêu cầu của học viên hoặc nội dung cần tư vấn..."
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          className="flex-[2] px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" />
          Xác nhận lên lịch
        </button>
      </div>
    </form>
  );
}