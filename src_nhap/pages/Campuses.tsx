import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Phone, Plus, Edit2, Trash2,
  DoorOpen, Users, Settings, Search, Loader2, ChevronRight,
  Info,
  Shield
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';

export default function Campuses() {
  const [campuses, setCampuses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampus, setActiveCampus] = useState<any>(null); // Cơ sở đang được chọn để xem phòng
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resC, resR] = await Promise.all([
        apiClient.get('/campuses'),
        apiClient.get('/rooms')
      ]);
      setCampuses(resC.data.data || []);
      setRooms(resR.data.data || []);
      if (resC.data.data?.length > 0 && !activeCampus) {
        setActiveCampus(resC.data.data[0]);
      }
    } catch (error) {
      toast.error("Lỗi tải dữ liệu cơ sở");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);




  // 1. Hàm xử lý Lưu Cơ sở (Campus)
  const handleSaveCampus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const res = await apiClient.post('/campuses', data);
      if (res.data.success) {
        toast.success("Thêm cơ sở mới thành công");
        setIsCampusModalOpen(false);
        fetchData(); // Tải lại danh sách
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi khi lưu cơ sở");
    }
  };

  // 2. Hàm xử lý Lưu Phòng học (Room)
  const handleSaveRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData);

    const payload = {
      ...rawData,
      campus: activeCampus._id, // Gán ID cơ sở hiện tại
      capacity: Number(rawData.capacity)
    };

    try {
      const res = await apiClient.post('/rooms', payload);
      if (res.data.success) {
        toast.success("Đã thêm phòng học");
        setIsRoomModalOpen(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi khi lưu phòng học");
    }
  };

  // 3. Load danh sách nhân viên để chọn Manager (Bổ sung thêm state users)
  const [staff, setStaff] = useState<any[]>([]);
  useEffect(() => {
    apiClient.get('/users').then(res => setStaff(res.data.data || []));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hệ thống Cơ sở</h1>
          <p className="text-slate-500 text-sm">Quản lý địa điểm đào tạo và tài nguyên phòng học.</p>
        </div>
        <button
          onClick={() => setIsCampusModalOpen(true)}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
        >
          <Building2 className="w-5 h-5" /> Thêm cơ sở
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500 w-10 h-10" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* CỘT TRÁI: DANH SÁCH CƠ SỞ */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Danh sách chi nhánh</h3>
            <div className="space-y-3">
              {campuses.map((campus) => (
                <div
                  key={campus._id}
                  onClick={() => setActiveCampus(campus)}
                  className={cn(
                    "p-4 rounded-xs border transition-all cursor-pointer group relative",
                    activeCampus?._id === campus._id
                      ? "bg-white border-emerald-500 shadow-md ring-4 ring-indigo-50"
                      : "bg-white border-slate-100 hover:border-indigo-200 shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                      activeCampus?._id === campus._id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                    )}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{campus.name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                        <MapPin className="w-3 h-3" /> {campus.address}
                      </p>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 self-center transition-transform", activeCampus?._id === campus._id ? "text-emerald-500 translate-x-1" : "text-slate-300")} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT PHÒNG HỌC */}
          <div className="lg:col-span-8">
            {activeCampus ? (
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{activeCampus.name}</h2>
                    <p className="text-sm text-slate-500 font-medium">{activeCampus.address}</p>
                  </div>
                  <button
                    onClick={() => setIsRoomModalOpen(true)}
                    className="flex items-center gap-2 text-emerald-600 bg-white border border-indigo-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Thêm phòng học
                  </button>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.filter(r => r.campus === activeCampus._id || r.campus?._id === activeCampus._id).map((room) => (
                    <div key={room._id} className="p-5 rounded-xs border border-slate-100 bg-white hover:shadow-md transition-all group border-l-4 border-l-emerald-500">
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <DoorOpen className="w-5 h-5" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button className="p-2 text-slate-400 hover:text-emerald-600"><Edit2 className="w-4 h-4" /></button>
                          <button className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <h5 className="font-bold text-slate-900 text-lg">{room.name}</h5>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          <Users className="w-3.5 h-3.5" /> {room.capacity} chỗ ngồi
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-tighter">
                          {room.type}
                        </div>
                      </div>
                    </div>
                  ))}

                  {rooms.filter(r => r.campus === activeCampus._id || r.campus?._id === activeCampus._id).length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[30px]">
                      <DoorOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">Chưa có phòng học nào được thiết lập tại cơ sở này.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic">
                Chọn một cơ sở bên trái để xem chi tiết phòng học
              </div>
            )}
          </div>
        </div>
      )}


      <Modal isOpen={isCampusModalOpen} onClose={() => setIsCampusModalOpen(false)} title="Thêm cơ sở đào tạo mới">
        <form onSubmit={handleSaveCampus} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> Tên cơ sở
            </label>
            <input name="name" required placeholder="Ví dụ: DeepCode Quận 10" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" /> Địa chỉ chi tiết
            </label>
            <input name="address" required placeholder="Số 123, đường ABC, phường X..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
              </label>
              <input name="phone" placeholder="028.xxxx.xxxx" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" /> Quản lý cơ sở
              </label>
              <select name="manager" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">-- Chọn nhân sự --</option>
                {staff.map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
            <button type="button" onClick={() => setIsCampusModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Hủy</button>
            <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">Kích hoạt cơ sở</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL THÊM PHÒNG HỌC --- */}
      <Modal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} title={`Thêm phòng vào ${activeCampus?.name}`}>
        <form onSubmit={handleSaveRoom} className="space-y-5">
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-4">
            <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Cơ sở ghi nhận</p>
            <p className="text-sm font-bold text-slate-700">{activeCampus?.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-slate-400" /> Tên phòng học
              </label>
              <input name="name" required placeholder="Ví dụ: Phòng Lab 01, Phòng 202..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Sức chứa (Học viên)
              </label>
              <input name="capacity" type="number" defaultValue="20" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" /> Loại phòng
              </label>
              <select name="type" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="Theory">Phòng lý thuyết</option>
                <option value="Lab">Phòng thực hành (Lab)</option>
                <option value="Meeting">Phòng họp / Workshop</option>
              </select>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                Ghi chú trang thiết bị
              </label>
              <textarea name="note" rows={3} placeholder="VD: Có máy chiếu, 20 máy tính, 2 điều hòa..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
            <button type="button" onClick={() => setIsRoomModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Hủy</button>
            <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700">Lưu phòng học</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}