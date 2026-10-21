import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, User, MapPin, CheckCircle2, XCircle,
  MoreVertical, Search, Filter, Loader2, Edit2, Trash2, Tag
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { AppointmentForm } from '../components/forms/AppointmentForm';
import { toast } from 'react-hot-toast';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // 1. Load danh sách từ API
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/appointments');
      if (res.data.success) {
        setAppointments(res.data.data);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách lịch hẹn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // 2. Cập nhật trạng thái nhanh (Hoàn thành/Hủy)
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await apiClient.put(`/appointments/${id}`, { status });
      if (res.data.success) {
        toast.success(`Đã cập nhật: ${status}`);
        fetchAppointments();
      }
    } catch (err) {
      toast.error("Lỗi cập nhật trạng thái");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xác nhận xóa lịch hẹn này?")) return;
    try {
      await apiClient.delete(`/appointments/${id}`);
      toast.success("Đã xóa");
      fetchAppointments();
    } catch (err) {
      toast.error("Lỗi xóa");
    }
  };

  // Helper hiển thị màu sắc
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Test': return <Tag className="w-3 h-3" />;
      case 'TrialClass': return <Loader2 className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lịch hẹn hệ thống</h1>
          <p className="text-slate-500">Theo dõi các cuộc hẹn tư vấn, test đầu vào và học thử.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <Filter className="w-4 h-4" /> Lọc trạng thái
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((apt: any) => (
            <div key={apt._id} className="bg-white rounded-xs shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getStatusStyle(apt.status)}`}>
                      {apt.status === 'Scheduled' ? '📅 Sắp diễn ra' : apt.status === 'Completed' ? '✅ Hoàn thành' : '❌ Đã hủy'}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(apt._id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Khách hàng */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                      {(apt.lead?.name || apt.student?.fullName || "?").charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">
                        {apt.lead?.name || apt.student?.fullName}
                      </h3>
                      <p className="text-xs text-slate-500">{apt.lead?.phone || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Thời gian & Địa điểm */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Clock className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Thời gian</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {new Date(apt.appointmentTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(apt.appointmentTime).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <MapPin className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Địa điểm</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 truncate">{apt.location || 'Chưa rõ'}</p>
                    </div>
                  </div>

                  {/* Phụ trách & Loại */}
                  <div className="flex items-center justify-between text-xs pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {apt.staff?.fullName?.charAt(0)}
                      </div>
                      <span className="text-slate-500">Phụ trách: <b>{apt.staff?.fullName}</b></span>
                    </div>
                    <span className="flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                      {getTypeIcon(apt.type)} {apt.type}
                    </span>
                  </div>

                  {/* Ghi chú */}
                  {apt.note && (
                    <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100/50">
                      <p className="text-[11px] text-amber-700 italic leading-relaxed">"{apt.note}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Footer */}
              {apt.status === 'Scheduled' && (
                <div className="bg-slate-50 px-4 py-3 flex gap-2 border-t border-slate-50">
                  <button
                    onClick={() => handleUpdateStatus(apt._id, 'Completed')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Hoàn thành
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(apt._id, 'Cancelled')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Hủy hẹn
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {appointments.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-xs border border-dashed border-slate-200">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Không có lịch hẹn nào</h3>
          <p className="text-slate-400 text-sm">Mọi lịch hẹn khách hàng sẽ được hiển thị tại đây.</p>
        </div>
      )}
    </div>
  );
}