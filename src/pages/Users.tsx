import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, ScanFace, UserPlus,
  Loader2, AlertCircle, ChevronDown, ChevronUp, Eye, EyeOff,
  Building2, Mail, Phone, ShieldCheck, User, Check, X,
} from 'lucide-react';
import { apiClient, extractArray } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';

interface Department {
  _id: string;
  name: string;
  code?: string;
}

interface UserItem {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: { _id: string; name: string } | string;
  department?: { _id: string; name: string } | string;
  isActive?: boolean;
  isFaceRegistered?: boolean;
  facePhoto?: string;
  createdAt?: string;
  avatar?: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'truongkhoa', label: 'Trưởng khoa' },
  { value: 'giangvien', label: 'Giảng viên' },
  { value: 'nhanvien', label: 'Nhân viên' },
];

function getRoleBadge(role?: UserItem['role']) {
  const name = typeof role === 'object' ? role?.name : role;
  const lower = String(name ?? '').toLowerCase();
  if (lower === 'admin') return <span className="badge badge-red">Quản trị viên</span>;
  if (lower === 'truongkhoa') return <span className="badge badge-purple">Trưởng khoa</span>;
  if (lower === 'giangvien') return <span className="badge badge-blue">Giảng viên</span>;
  return <span className="badge badge-gray">{name ?? 'Nhân viên'}</span>;
}

function getAvatarUrl(user: UserItem) {
  if (!user.avatar) return null;
  if (user.avatar.startsWith('http')) return user.avatar;
  return `/uploads/${user.avatar}`;
}

interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  departmentId: string;
}

const EMPTY_FORM: UserFormData = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  role: 'giangvien',
  departmentId: '',
};

export default function Users() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isTruongKhoa = hasRole('truongkhoa');
  const canManage = isAdmin || isTruongKhoa;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Face registration modal
  const [faceRegUser, setFaceRegUser] = useState<UserItem | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users');
      const data = extractArray<UserItem>(res.data?.data ?? res.data);
      setUsers(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Không thể tải danh sách nhân sự');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await apiClient.get('/departments');
      const data = extractArray<Department>(res.data?.data ?? res.data);
      setDepartments(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchDepts();
  }, [fetchUsers, fetchDepts]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    const deptId = typeof u.department === 'object' ? u.department?._id ?? '' : '';
    const roleName = typeof u.role === 'object' ? u.role?.name ?? '' : u.role ?? '';
    setFormData({
      fullName: u.fullName,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      role: roleName,
      departmentId: deptId,
    });
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      toast.error('Vui lòng nhập họ tên và email');
      return;
    }
    setFormLoading(true);
    try {
      const payload: Record<string, string> = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        departmentId: formData.departmentId,
      };
      if (formData.password) payload.password = formData.password;

      if (editingUser) {
        await apiClient.put(`/users/${editingUser._id}`, payload);
        toast.success('Cập nhật thành công');
      } else {
        if (!formData.password) {
          toast.error('Vui lòng nhập mật khẩu khi tạo mới');
          return;
        }
        await apiClient.post('/users', payload);
        toast.success('Tạo tài khoản thành công');
      }
      setShowForm(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Lưu thất bại');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/users/${deleteId}`);
      toast.success('Đã vô hiệu hoá tài khoản');
      setDeleteId(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Xoá thất bại');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter
  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      !search ||
      u.fullName.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower) ||
      (u.phone ?? '').includes(search);
    const roleName = typeof u.role === 'object' ? u.role?.name ?? '' : u.role ?? '';
    const matchRole = !filterRole || roleName === filterRole;
    const deptId = typeof u.department === 'object' ? u.department?._id ?? '' : '';
    const matchDept = !filterDept || deptId === filterDept;
    return matchSearch && matchRole && matchDept;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Nhân sự</h1>
          <p className="text-slate-500 text-sm mt-1">
            {users.length} tài khoản trong hệ thống
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary shrink-0">
            <UserPlus size={16} />
            Thêm nhân sự
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="form-input w-auto"
        >
          <option value="">Tất cả vai trò</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="form-input w-auto"
        >
          <option value="">Tất cả phòng ban</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Không tìm thấy nhân sự nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th>Phòng ban</th>
                  <th>Liên hệ</th>
                  <th>FaceID</th>
                  <th>Trạng thái</th>
                  {canManage && <th className="text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const deptName = typeof u.department === 'object'
                    ? u.department?.name ?? '—'
                    : u.department ?? '—';
                  const avatarUrl = getAvatarUrl(u);

                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-blue-600 font-bold text-sm">
                                {u.fullName?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{u.fullName}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{getRoleBadge(u.role)}</td>
                      <td>
                        <span className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Building2 size={13} className="text-slate-400" />
                          {deptName}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600">{u.phone || '—'}</td>
                      <td>
                        {u.isFaceRegistered ? (
                          <span className="badge badge-green">
                            <ScanFace size={11} />
                            Đã đăng ký
                          </span>
                        ) : (
                          <span className="badge badge-gray">Chưa đăng ký</span>
                        )}
                      </td>
                      <td>
                        {u.isActive !== false ? (
                          <span className="badge badge-green">Hoạt động</span>
                        ) : (
                          <span className="badge badge-red">Đã khoá</span>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          <div className="flex items-center gap-1.5 justify-end">
                            {isAdmin && (
                              <button
                                onClick={() => setFaceRegUser(u)}
                                className="btn-ghost p-2 text-violet-600 hover:bg-violet-50"
                                title="Đăng ký FaceID"
                              >
                                <ScanFace size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(u)}
                              className="btn-ghost p-2"
                              title="Chỉnh sửa"
                            >
                              <Edit2 size={15} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteId(u._id)}
                                className="btn-ghost p-2 text-red-500 hover:bg-red-50"
                                title="Vô hiệu hoá"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="btn-ghost p-2"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="form-group">
                <label className="form-label">Họ và tên *</label>
                <input
                  className="form-input"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="a.nguyen@university.edu.vn"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pr-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0912345678"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vai trò</label>
                  <select
                    className="form-input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Phòng ban / Khoa</label>
                <select
                  className="form-input"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Vô hiệu hoá tài khoản</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tài khoản sẽ bị khoá và không thể đăng nhập. Dữ liệu sẽ được giữ lại.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="btn-secondary flex-1"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="btn-danger flex-1 justify-center"
                >
                  {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Registration Modal */}
      {faceRegUser && (
        <FaceRegistrationModal
          isOpen={!!faceRegUser}
          onClose={() => setFaceRegUser(null)}
          user={faceRegUser}
          onSuccess={() => {
            setFaceRegUser(null);
            fetchUsers();
            toast.success('Đăng ký khuôn mặt thành công!');
          }}
        />
      )}
    </div>
  );
}
