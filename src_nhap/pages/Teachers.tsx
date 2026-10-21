import React, { useState, useEffect, useCallback } from 'react';
import {
  UserSquare2, Star, Calendar, Clock, Search, Plus,
  MoreHorizontal, Mail, Phone, Trash2, Edit2, Loader2, Award, Briefcase, Globe, ShieldCheck
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { TeacherForm } from '../components/forms/TeacherForm';
import { UserForm } from '../components/forms/UserForm';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [selectedForUser, setSelectedForUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient.get('/roles');
      if (res.data.success) setRoles(res.data.data);
    } catch (error) { console.error("Lỗi tải vai trò:", error); }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/teachers?search=${searchTerm}`);
      if (res.data.success) {
        setTeachers(res.data.data);
      }
    } catch (error) {
      toast.error("Lỗi tải danh sách giảng viên");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchTeachers();
    fetchRoles();
  }, [fetchTeachers, fetchRoles]);

  const handleSaveTeacher = async (data: any) => {
    try {
      const isEdit = !!editingTeacher;
      const url = isEdit ? `/teachers/${editingTeacher._id}` : '/teachers';
      const res = isEdit ? await apiClient.put(url, data) : await apiClient.post(url, data);

      if (res.data.success) {
        toast.success(isEdit ? "Cập nhật thành công" : "Đã thêm giảng viên");
        setIsModalOpen(false);
        setEditingTeacher(null);
        fetchTeachers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Thao tác thất bại");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xóa hồ sơ giảng viên này?")) return;
    try {
      const res = await apiClient.delete(`/teachers/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa");
        fetchTeachers();
      }
    } catch (error) { toast.error("Lỗi xóa dữ liệu"); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Đội ngũ Giảng viên</h1>
          <p className="text-slate-500">Quản lý chuyên môn, hợp đồng và chất lượng đào tạo.</p>
        </div>
        <button
          onClick={() => { setEditingTeacher(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
          <Plus className="w-5 h-5" /> Thêm giảng viên
        </button>
      </header>

      <div className="bg-white p-4 rounded-xs shadow-sm border border-slate-100 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã giảng viên hoặc chuyên môn..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teachers.map((teacher) => (
            <div key={teacher._id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all group relative">
              {/* Header Card */}
              <div className="h-24 bg-slate-900 relative">
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingTeacher(teacher); setIsModalOpen(true); }} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(teacher._id)} className="p-2 bg-rose-500/20 hover:bg-rose-500 text-white rounded-lg backdrop-blur-md"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4 flex justify-between items-end">
                  <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl">
                    <div className="w-full h-full rounded-xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black overflow-hidden">
                      {teacher.avatar ? (
                        <img src={teacher.avatar} alt={teacher.fullName} className="w-full h-full object-cover" />
                      ) : (
                        teacher.fullName.charAt(0)
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    <span className="text-xs font-bold text-amber-700">{teacher.rating}</span>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">{teacher.fullName}</h3>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{teacher.teacherCode || 'FREELANCE'}</p>
                </div>

                {/* Chuyên môn Tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {teacher.specialization?.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-md text-[10px] font-bold uppercase">
                      {s}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Kinh nghiệm
                    </p>
                    <p className="text-sm font-bold text-slate-700">{teacher.experience} năm</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Award className="w-3 h-3" /> Bằng cấp
                    </p>
                    <p className="text-sm font-bold text-slate-700 truncate">{teacher.degree || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <a href={`tel:${teacher.phone}`} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><Phone className="w-4 h-4" /></a>
                      <a href={`mailto:${teacher.email}`} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Mail className="w-4 h-4" /></a>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${teacher.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {teacher.status === 'active' ? 'Sẵn sàng' : 'Nghỉ phép'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedForUser({ fullName: teacher.fullName, email: teacher.email, department: 'training', role: roles.find(r => r.name.toLowerCase() === 'teacher')?._id });
                      setIsUserModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Kích hoạt tài khoản hệ thống
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTeacher ? "Chỉnh sửa hồ sơ" : "Thêm giảng viên"}>
        <TeacherForm
          initialData={editingTeacher}
          onSubmit={handleSaveTeacher}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Kích hoạt tài khoản giảng viên">
        <UserForm
          initialData={selectedForUser}
          roles={roles}
          onSuccess={() => {
            setIsUserModalOpen(false);
            toast.success("Đã kích hoạt tài khoản hệ thống cho giảng viên");
            fetchTeachers();
            setTimeout(() => window.location.reload(), 1000);
          }}
          onCancel={() => setIsUserModalOpen(false)}
        />
      </Modal>
    </div>
  );
}