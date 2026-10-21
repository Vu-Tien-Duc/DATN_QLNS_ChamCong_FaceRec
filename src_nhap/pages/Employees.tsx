import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Briefcase, Mail, Phone, UserPlus, Trash2, Loader2, Calendar, ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { UserForm } from '../components/forms/UserForm';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { cn } from '../utils/cn';

// Helper: Tính số ngày còn lại đến sinh nhật
const getDaysToBirthday = (birthDateStr: string | undefined | null) => {
  if (!birthDateStr) return null;
  const today = new Date();
  const birthDate = new Date(birthDateStr);

  // Sinh nhật của năm nay
  let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  // Nếu sinh nhật năm nay đã qua, lấy sinh nhật năm sau
  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const diffTime = nextBirthday.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedForUser, setSelectedForUser] = useState<any>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient.get('/roles');
      if (res.data.success) setRoles(res.data.data);
    } catch (error) {
      console.error("Lỗi tải vai trò:", error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employees', {
        params: {
          search: searchTerm,
          department: deptFilter === 'all' ? undefined : deptFilter
        }
      });
      if (res.data.success) {
        setEmployees(res.data.data);
      }
    } catch (error) {
      toast.error("Lỗi tải danh sách nhân viên");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, deptFilter]);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, [fetchEmployees, fetchRoles]);

  const handleSaveEmployee = async (data: any) => {
    try {
      const isEdit = !!selectedEmployee;
      const url = isEdit ? `/employees/${selectedEmployee._id}` : '/employees';
      const res = isEdit ? await apiClient.put(url, data) : await apiClient.post(url, data);

      if (res.data.success) {
        toast.success(isEdit ? "Đã cập nhật" : "Đã thêm nhân viên");
        setIsModalOpen(false);
        fetchEmployees();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Thao tác thất bại");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xóa hồ sơ nhân sự này?")) return;
    try {
      const res = await apiClient.delete(`/employees/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa");
        fetchEmployees();
      }
    } catch (error) { toast.error("Lỗi xóa dữ liệu"); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hồ sơ Nhân sự</h1>
          <p className="text-slate-500 text-sm">Quản lý đội ngũ vận hành hệ thống DeepCode CRM.</p>
        </div>
        <button onClick={() => { setSelectedEmployee(null); setIsModalOpen(true); }} className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-[1.5rem] hover:bg-indigo-700 shadow-xl transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" /> Thêm nhân sự
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng nhân sự</p>
          <p className="text-3xl font-black text-slate-900">{employees.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đang làm việc</p>
          <p className="text-3xl font-black text-emerald-600">{employees.filter(e => e.status === 'Active').length}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Tìm tên, SĐT, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-6 py-3 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 outline-none">
          <option value="all">Tất cả phòng ban</option>
          {['Sales', 'Academic', 'Marketing', 'Finance', 'IT'].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => {
            const daysToBirthday = getDaysToBirthday(emp.birthDate);
            const isBirthdaySoon = daysToBirthday !== null && daysToBirthday <= 7;

            return (
              <div key={emp._id} className={cn(
                "bg-white rounded-[2.5rem] shadow-sm border-2 overflow-hidden hover:shadow-xl transition-all group",
                isBirthdaySoon ? "border-amber-400 ring-4 ring-amber-100" : "border-slate-100"
              )}>
                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <img
                        src={emp.avatar ? `${apiClient.defaults.baseURL}/images/${emp.avatar}` : `https://ui-avatars.com/api/?name=${(emp.name)}`}
                        alt={emp.name}
                        className="w-16 h-16 rounded-xs object-cover shadow-lg bg-slate-100"
                        onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${(emp.name)}`)}
                      />
                      <div>
                        <h3 className="font-black text-slate-900 text-lg leading-none mb-2">{emp.name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {emp.status}
                        </span>
                      </div>
                    </div>
                    {isBirthdaySoon && (
                      <div className="animate-bounce bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                        🎂 {daysToBirthday === 0 ? "Hôm nay!" : `Còn ${daysToBirthday} ngày`}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm font-bold text-slate-600">
                      <Briefcase className="w-4 h-4 mr-3 text-indigo-500" /> {emp.role} • {emp.department}
                    </div>
                    {emp.birthDate && (
                      <div className="flex items-center text-sm text-slate-500 font-medium">
                        <Calendar className="w-4 h-4 mr-3 text-slate-400" /> Sinh nhật: {new Date(emp.birthDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                      </div>
                    )}
                    <div className="flex items-center text-sm text-slate-500 font-medium">
                      <Mail className="w-4 h-4 mr-3 text-slate-400" /> {emp.email}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setSelectedEmployee({ ...emp, avatarId: emp.avatar }); setIsModalOpen(true); }} className="py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-700 transition-all">Sửa hồ sơ</button>
                      <button onClick={() => handleDelete(emp._id)} className="py-3 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-all">Xóa</button>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedForUser({ fullName: emp.name, email: emp.email, department: emp.department.toLowerCase() });
                        setIsUserModalOpen(true);
                      }}
                      className="w-full py-3 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" /> Kích hoạt tài khoản hệ thống
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEmployee ? "Cập nhật nhân sự" : "Thêm nhân sự mới"}>
        <EmployeeForm initialData={selectedEmployee} onSubmit={handleSaveEmployee} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Kích hoạt tài khoản hệ thống">
        <UserForm
          initialData={selectedForUser}
          roles={roles}
          onSuccess={() => {
            setIsUserModalOpen(false);
            toast.success("Đã kích hoạt tài khoản hệ thống");
            fetchEmployees();
            setTimeout(() => window.location.reload(), 1000);
          }}
          onCancel={() => setIsUserModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
