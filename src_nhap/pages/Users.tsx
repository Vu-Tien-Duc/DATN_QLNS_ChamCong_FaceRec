import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, UserPlus, ShieldCheck, Mail, Clock,
  Lock, Unlock, Key, Briefcase, Trash2, Edit2, Loader2, Shield,
  Users as UsersIcon, Phone, RotateCcw, LayoutGrid, List,
  CheckCircle, AlertCircle, X, MapPin, ScanFace
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { UserForm } from '../components/forms/UserForm';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

// Helper để format avatar URL
const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
    return avatar;
  }
  if (avatar.startsWith('/')) {
    return avatar;
  }
  if (/^[0-9a-fA-F]{24}$/.test(avatar)) {
    return `/api/images/${avatar}`;
  }
  return `/uploads/${avatar}`;
};

// Component Avatar thông minh với icon mặc định và fallback khi lỗi
function UserAvatar({
  avatar,
  name,
  className = "w-14 h-14 rounded-2xl",
  iconSize = "w-6 h-6",
  status
}: {
  avatar?: string;
  name?: string;
  className?: string;
  iconSize?: string;
  status?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const avatarUrl = getAvatarUrl(avatar);

  // Reset error when avatar changes
  useEffect(() => {
    setHasError(false);
  }, [avatar]);

  return (
    <div className={`relative shrink-0 ${className}`}>
      {avatarUrl && !hasError ? (
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
          style={{ borderRadius: 'inherit' }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/70 border border-slate-200/80 text-slate-400 group-hover:text-indigo-600 transition-colors shadow-inner"
          style={{ borderRadius: 'inherit' }}
        >
          <UsersIcon className={`${iconSize} stroke-[1.8] text-slate-400`} />
        </div>
      )}
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-1 ring-slate-100 shadow-xs ${
            status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          title={status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
        />
      )}
    </div>
  );
}

// Helper map màu sắc Role
const getRoleStyle = (roleName: string) => {
  const name = roleName?.toLowerCase() || '';
  if (name.includes('admin')) return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20';
  if (name.includes('investor') || name.includes('shareholder')) return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
  if (name.includes('manager') || name.includes('director')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (name.includes('sale') || name.includes('leader')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (name.includes('teacher') || name.includes('giảng viên')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (name.includes('parent') || name.includes('phụ huynh')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (name.includes('student') || name.includes('học viên')) return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const DEPT_MAP: Record<string, string> = {
  sales: 'Kinh doanh',
  training: 'Đào tạo',
  accounting: 'Kế toán',
  marketing: 'Marketing',
  operation: 'Vận hành',
  'boad of director': 'Ban giám đốc',
  teacher: 'Giảng viên',
  student: 'Học viên',
  parent: 'Phụ huynh'
};

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Face Registration Modal State
  const [selectedUserForFace, setSelectedUserForFace] = useState<any>(null);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceAiStatus, setFaceAiStatus] = useState<{ healthy: boolean; status?: string; app_name?: string } | null>(null);

  // Filters & View State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedFaceFilter, setSelectedFaceFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Kiểm tra sức khỏe Face AI Microservice
  const checkFaceAiHealth = useCallback(async () => {
    try {
      const res = await apiClient.get('/face/health');
      if (res.data?.success && res.data?.data) {
        setFaceAiStatus(res.data.data);
      } else {
        setFaceAiStatus({ healthy: false });
      }
    } catch {
      setFaceAiStatus({ healthy: false });
    }
  }, []);

  // Fetch dữ liệu người dùng & vai trò
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resUsers, resRoles] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/roles')
      ]);

      if (resUsers.data.success) {
        setUsers(resUsers.data.data || []);
      }
      if (resRoles.data.success) {
        setRoles(resRoles.data.data || []);
      }
    } catch (error) {
      toast.error("Lỗi tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    checkFaceAiHealth();
  }, [fetchData, checkFaceAiHealth]);

  // Xóa tài khoản
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận xóa tài khoản "${name || 'này'}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await apiClient.delete(`/users/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa tài khoản thành công");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể xóa tài khoản");
    }
  };

  // Khóa / Mở khóa tài khoản
  const toggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiClient.put(`/users/${user._id}`, { status: newStatus });
      if (res.data.success) {
        toast.success(`Đã ${newStatus === 'active' ? 'mở khóa' : 'tạm khóa'} tài khoản ${user.fullName}`);
        fetchData();
      }
    } catch (err) {
      toast.error("Lỗi cập nhật trạng thái");
    }
  };

  // Lấy danh sách tên vai trò
  const getUserRolesList = (user: any) => {
    if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles.map((r: any) => (typeof r === 'object' ? r.name : r)).filter(Boolean);
    }
    const singleRole = typeof user.role === 'object' ? user.role?.name : user.role;
    return singleRole ? [singleRole] : ['Chưa gán vai trò'];
  };

  // Lọc người dùng theo các điều kiện
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = user.fullName?.toLowerCase().includes(query);
        const matchEmail = user.email?.toLowerCase().includes(query);
        const matchPhone = user.phone?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }

      // 2. Department
      if (selectedDept !== 'all') {
        if (user.department !== selectedDept) return false;
      }

      // 3. Status
      if (selectedStatus !== 'all') {
        if (user.status !== selectedStatus) return false;
      }

      // 4. Role
      if (selectedRole !== 'all') {
        const roleNames = getUserRolesList(user);
        const hasRole = roleNames.some((r: string) => r.toLowerCase() === selectedRole.toLowerCase());
        if (!hasRole) return false;
      }

      // 5. Khuôn mặt (Face Recognition)
      if (selectedFaceFilter === 'registered') {
        if (!user.isFaceRegistered && !user.facePhoto) return false;
      } else if (selectedFaceFilter === 'unregistered') {
        if (user.isFaceRegistered || user.facePhoto) return false;
      }

      return true;
    });
  }, [users, searchTerm, selectedDept, selectedStatus, selectedRole, selectedFaceFilter]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;
    const faceCount = users.filter(u => u.isFaceRegistered || u.facePhoto).length;
    const adminCount = users.filter(u => {
      const rolesList = getUserRolesList(u);
      return rolesList.some((r: string) => r.toLowerCase().includes('admin') || r.toLowerCase().includes('director'));
    }).length;
    return { total, active, inactive, faceCount, adminCount };
  }, [users]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDept('all');
    setSelectedRole('all');
    setSelectedStatus('all');
    setSelectedFaceFilter('all');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ── HEADER CHÍNH ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Quản lý Tài khoản & Phân quyền
                <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                  {users.length} tài khoản
                </span>
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Thiết lập thông tin nhân sự, ảnh đại diện, phòng ban và phân công đa vai trò hệ thống.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Trạng thái Face AI Microservice */}
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
            faceAiStatus?.healthy
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${faceAiStatus?.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{faceAiStatus?.healthy ? 'Face AI (ArcFace 512D): Hoạt động' : 'Face AI: Ngoại tuyến'}</span>
          </div>

          {/* Nút Thử nghiệm Face AI */}
          <button
            type="button"
            onClick={() => setIsTestFaceModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 font-bold flex items-center gap-2 transition-all cursor-pointer text-sm shadow-2xs"
            title="Mở camera để nhận diện thử nghiệm với toàn bộ Vector DB"
          >
            <ScanFace className="w-4 h-4 text-indigo-600" />
            <span>Thử nghiệm Face AI</span>
          </button>

          <button
            onClick={() => { fetchData(); checkFaceAiHealth(); }}
            disabled={loading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-200 cursor-pointer text-sm"
          >
            <UserPlus className="w-4 h-4" /> Tạo tài khoản mới
          </button>
        </div>
      </div>

      {/* ── KPI METRICS THỐNG KÊ ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng nhân sự</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UsersIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đang hoạt động</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.active}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Đang tạm khóa</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.inactive}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Quản trị & Lãnh đạo</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.adminCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── BỘ LỌC & TÌM KIẾM ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên, email hoặc số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc phòng ban */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">Tất cả phòng ban</option>
            {Object.entries(DEPT_MAP).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Lọc vai trò */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            {roles.map(r => (
              <option key={r._id} value={r.name}>{r.name}</option>
            ))}
          </select>

          {/* Lọc khuôn mặt */}
          <select
            value={selectedFaceFilter}
            onChange={(e) => setSelectedFaceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">Khuôn mặt: Tất cả ({users.length})</option>
            <option value="registered">Đã đăng ký ({stats.faceCount})</option>
            <option value="unregistered">Chưa đăng ký ({users.length - stats.faceCount})</option>
          </select>

          {/* Lọc trạng thái */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center shrink-0">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'active' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => setSelectedStatus('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'inactive' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Đã khóa
            </button>
          </div>

          {/* Chuyển đổi View Mode */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center shrink-0 border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng thẻ (Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng bảng (Table)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thông tin số lượng kết quả */}
        {(searchTerm || selectedDept !== 'all' || selectedRole !== 'all' || selectedStatus !== 'all' || selectedFaceFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              Tìm thấy <strong className="text-slate-800 font-bold">{filteredUsers.length}</strong> kết quả phù hợp
            </span>
            <button
              onClick={resetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ── NỘI DUNG CHÍNH (GRID HOẶC TABLE) ─────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-sm font-medium">Đang tải danh sách người dùng...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto">
            <UsersIcon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy tài khoản nào</h3>
            <p className="text-xs text-slate-400 mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc trạng thái, phòng ban.
            </p>
          </div>
          {(searchTerm || selectedDept !== 'all' || selectedRole !== 'all' || selectedStatus !== 'all' || selectedFaceFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Đặt lại toàn bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          {/* VIEW DẠNG GRID */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredUsers.map((user: any) => {
                const userRolesList = getUserRolesList(user);
                return (
                  <div
                    key={user._id}
                    className="bg-white rounded-3xl shadow-xs border border-slate-200/80 hover:border-indigo-200 hover:shadow-xl transition-all duration-200 flex flex-col justify-between group overflow-hidden"
                  >
                    <div className="p-6 space-y-5">
                      {/* Top Header Card: Avatar + Tên + Hành động nhanh */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <UserAvatar
                            avatar={user.avatar}
                            name={user.fullName}
                            status={user.status}
                            className="w-14 h-14 rounded-2xl shadow-sm border border-slate-200/70"
                            iconSize="w-6 h-6"
                          />
                          <div className="min-w-0">
                            <h3 className="font-black text-slate-900 text-base leading-snug truncate group-hover:text-indigo-600 transition-colors">
                              {user.fullName || 'Chưa đặt tên'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium truncate mt-0.5">
                              <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate mt-0.5">
                                <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nút Edit & Delete */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                            title="Chỉnh sửa tài khoản"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user._id, user.fullName)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Các vai trò */}
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-indigo-500" />
                          Vai trò ({userRolesList.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {userRolesList.map((rName: string, i: number) => (
                            <span
                              key={i}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider shadow-2xs ${getRoleStyle(rName)}`}
                            >
                              {rName}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Thông tin phòng ban & Trạng thái */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-slate-400" /> Bộ phận
                          </p>
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {DEPT_MAP[user.department] || user.department || 'Chưa chọn'}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                            Trạng thái
                          </p>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-black ${
                            user.status === 'active' ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {user.status === 'active' ? 'HOẠT ĐỘNG' : 'ĐÃ KHÓA'}
                          </span>
                        </div>
                      </div>

                      {/* Đăng ký khuôn mặt */}
                      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            user.isFaceRegistered || user.facePhoto
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-200/80 text-slate-500 border border-slate-300/60'
                          }`}>
                            <ScanFace className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 leading-none">
                              Khuôn mặt
                            </p>
                            <p className="text-xs font-black truncate">
                              {user.isFaceRegistered || user.facePhoto ? (
                                <span className="text-emerald-700 inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600 inline" /> Đã đăng ký
                                </span>
                              ) : (
                                <span className="text-slate-400 font-semibold">Chưa đăng ký</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {user.isFaceRegistered || user.facePhoto ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => { setSelectedUserForFace(user); setIsFaceModalOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                              title="Đăng ký lại khuôn mặt cho tài khoản này"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Đăng ký lại
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setSelectedUserForFace(user); setIsFaceModalOpen(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-indigo-200 cursor-pointer shrink-0"
                            title="Đăng ký nhận diện khuôn mặt"
                          >
                            <ScanFace className="w-3.5 h-3.5" />
                            Đăng ký khuôn mặt
                          </button>
                        )}
                      </div>

                      {/* Quê quán / Năm sinh nếu có */}
                      {(user.hometown || user.yearOfBirth) && (
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium pt-0.5">
                          {user.hometown && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" /> {user.hometown}
                            </span>
                          )}
                          {user.yearOfBirth && (
                            <span>Sinh năm {user.yearOfBirth}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="bg-slate-50/70 px-5 py-3.5 flex items-center gap-2.5 border-t border-slate-100">
                      <button
                        onClick={() => toggleStatus(user)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          user.status === 'active'
                            ? 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 shadow-2xs'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        }`}
                      >
                        {user.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                      </button>

                      <button
                        onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-all shadow-2xs cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-500" /> Sửa / Đổi MK
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW DẠNG TABLE */
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80">
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Nhân sự</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Liên hệ</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Các vai trò</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Phòng ban</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Khuôn mặt</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user: any) => {
                      const userRolesList = getUserRolesList(user);
                      const isFaceDone = Boolean(user.isFaceRegistered || user.facePhoto);
                      return (
                        <tr key={user._id} className="hover:bg-slate-50/60 transition-colors group">
                          {/* Cột Nhân sự: Avatar + Tên */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <UserAvatar
                                avatar={user.avatar}
                                name={user.fullName}
                                status={user.status}
                                className="w-11 h-11 rounded-xl shadow-2xs border border-slate-200/60"
                                iconSize="w-5 h-5"
                              />
                              <div>
                                <p className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">
                                  {user.fullName || 'Chưa đặt tên'}
                                </p>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{user.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Cột Liên hệ */}
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">
                            {user.phone ? (
                              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                {user.phone}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có SĐT</span>
                            )}
                          </td>

                          {/* Cột Các vai trò */}
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {userRolesList.map((rName: string, i: number) => (
                                <span
                                  key={i}
                                  className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getRoleStyle(rName)}`}
                                >
                                  {rName}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Cột Phòng ban */}
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
                              {DEPT_MAP[user.department] || user.department || 'Chưa chọn'}
                            </span>
                          </td>

                          {/* Cột Nhận diện Khuôn mặt */}
                          <td className="px-6 py-4">
                            {isFaceDone ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  Đã đăng ký
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedUserForFace(user); setIsFaceModalOpen(true); }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Đăng ký lại khuôn mặt"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Đăng ký lại
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setSelectedUserForFace(user); setIsFaceModalOpen(true); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                title="Đăng ký nhận diện khuôn mặt"
                              >
                                <ScanFace className="w-3.5 h-3.5" />
                                Đăng ký khuôn mặt
                              </button>
                            )}
                          </td>

                          {/* Cột Trạng thái */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-md border ${
                              user.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {user.status === 'active' ? 'HOẠT ĐỘNG' : 'ĐÃ KHÓA'}
                            </span>
                          </td>

                          {/* Cột Thao tác */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => toggleStatus(user)}
                                title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                  user.status === 'active'
                                    ? 'text-rose-500 hover:bg-rose-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {user.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                title="Chỉnh sửa & Đổi mật khẩu"
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(user._id, user.fullName)}
                                title="Xóa tài khoản"
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL TẠO & CẬP NHẬT TÀI KHOẢN ───────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedUser(null); }}
        title={selectedUser ? `Cập nhật tài khoản: ${selectedUser.fullName}` : "Tạo tài khoản nhân viên mới"}
      >
        <UserForm
          initialData={selectedUser}
          roles={roles}
          onSuccess={() => { setIsModalOpen(false); fetchData(); }}
          onCancel={() => { setIsModalOpen(false); setSelectedUser(null); }}
        />
      </Modal>

      {/* ── MODAL ĐĂNG KÝ KHUÔN MẶT ───────────────────────────────── */}
      {isFaceModalOpen && (
        <FaceRegistrationModal
          isOpen={isFaceModalOpen}
          onClose={() => { setIsFaceModalOpen(false); setSelectedUserForFace(null); }}
          user={selectedUserForFace}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  );
}