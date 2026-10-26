import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Camera,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Award,
  Clock,
  Sparkles,
  ArrowRight,
  Upload,
  Trash2,
  Loader2,
  GraduationCap,
  Briefcase,
  MapPin,
  ShieldCheck,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth.api';
import { userApi } from '../api/user.api';
import { UserAvatar } from '../components/ui/UserAvatar';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, fetchMe } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'info' | 'hrm' | 'face' | 'security'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form thông tin cá nhân
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: 'NAM',
  });

  // Form đổi mật khẩu
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phone: user.phoneNumber || '',
        email: user.email || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
        gender: user.gender || 'NAM',
      });
      setPreviewAvatar(user.avatar || null);
    }
  }, [user]);

  // Xử lý tải ảnh đại diện lên
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh (JPG, PNG, WebP)!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng ảnh tối đa là 5MB!');
      return;
    }

    // Xem trước tức thì (Instant Preview)
    const localUrl = URL.createObjectURL(file);
    setPreviewAvatar(localUrl);

    const formDataUpload = new FormData();
    formDataUpload.append('avatar', file);

    setUploadingAvatar(true);
    const toastId = toast.loading('Đang xử lý và tải lên ảnh đại diện...');
    try {
      const res = await authApi.updateAvatar(formDataUpload);
      await fetchMe();
      if (res.data?.avatar) {
        setPreviewAvatar(res.data.avatar);
      }
      toast.success('Cập nhật ảnh đại diện thành công!', { id: toastId });
    } catch (err: any) {
      // Hoàn tác preview nếu lỗi
      setPreviewAvatar(user?.avatar || null);
      toast.error(err.response?.data?.message || 'Không thể tải lên ảnh đại diện', { id: toastId });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Xử lý gỡ ảnh đại diện
  const handleRemoveAvatar = async () => {
    if (!user?.avatar && !previewAvatar) return;
    if (!window.confirm('Bạn có chắc chắn muốn gỡ ảnh đại diện hiện tại?')) return;

    setUploadingAvatar(true);
    const toastId = toast.loading('Đang gỡ ảnh đại diện...');
    try {
      await authApi.updateAvatar({ avatar: null });
      setPreviewAvatar(null);
      await fetchMe();
      toast.success('Đã gỡ ảnh đại diện thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gỡ ảnh đại diện', { id: toastId });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Cập nhật thông tin hồ sơ
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id) return;

    setLoading(true);
    try {
      await userApi.updateUser(user._id, {
        fullName: formData.fullName,
        phoneNumber: formData.phone,
        address: formData.address,
        gender: formData.gender as any,
        dateOfBirth: formData.dateOfBirth,
      });
      await fetchMe();
      toast.success('Cập nhật hồ sơ cá nhân thành công!');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật hồ sơ cá nhân');
    } finally {
      setLoading(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Đổi mật khẩu thành công!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch ((role || '').toLowerCase()) {
      case 'admin':
        return {
          label: 'Quản trị viên Hệ thống (Admin IT)',
          tag: 'ADMIN',
          color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60',
        };
      case 'bgh':
        return {
          label: 'Ban Giám Hiệu (BGH)',
          tag: 'BGH',
          color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60',
        };
      case 'truongkhoa':
      case 'truong_khoa':
        return {
          label: 'Trưởng Khoa / Đơn Vị',
          tag: 'TRƯỞNG KHOA',
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
        };
      case 'tccb':
        return {
          label: 'Phòng Tổ Chức Cán Bộ',
          tag: 'TCCB',
          color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60',
        };
      case 'giangvien':
      case 'giang_vien':
        return {
          label: 'Giảng viên Giảng dạy',
          tag: 'GIẢNG VIÊN',
          color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
        };
      default:
        return {
          label: 'Cán bộ / Nhân viên',
          tag: 'CÁN BỘ',
          color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
        };
    }
  };

  const roleInfo = getRoleBadge(user?.role);
  const isFaceRegistered = !!user?.isFaceRegistered || !!(user as any)?.da_dang_ky_face;
  const currentAvatarUrl = previewAvatar || user?.avatar;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Input File Ẩn Cho Phép Tải Ảnh Từ Mọi Nút */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleAvatarFileSelect}
      />

      {/* ===================================================================
          1. HERO PROFILE CARD WITH GRADIENT COVER BANNER
         =================================================================== */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Cover Banner với họa tiết NTU Smart HR */}
        <div className="h-44 sm:h-52 w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 relative overflow-hidden">
          {/* Lưới chấm vi mô & ánh sáng trang trí */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-1/4 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Huy hiệu thương hiệu Đại Học Nguyễn Trãi */}
          <div className="absolute top-4 right-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>NTU Smart HR • Hồ Sơ Điện Tử</span>
          </div>
        </div>

        {/* Thông tin hồ sơ chính (Avatar, Tên, Chức vụ, Nút thao tác) */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 -mt-16 sm:-mt-20">
            {/* Cụm Avatar lớn & Thông tin nhận diện */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
              {/* Avatar khung lớn với nút tương tác ảnh */}
              <div className="relative group shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white dark:bg-slate-900 p-1.5 ring-4 ring-white dark:ring-slate-900 shadow-2xl overflow-hidden">
                  <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                    {currentAvatarUrl ? (
                      <img
                        src={currentAvatarUrl}
                        alt={user?.fullName || 'Avatar'}
                        className="w-full h-full object-cover"
                        onError={() => setPreviewAvatar(null)}
                      />
                    ) : (
                      <UserAvatar
                        user={user}
                        name={user?.fullName}
                        avatarUrl={user?.avatar}
                        size="xl"
                        className="w-full h-full text-2xl font-black"
                      />
                    )}

                    {/* Loading overlay khi đang tải ảnh */}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                        <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                        <span className="text-[10px] font-bold mt-1">Đang lưu...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nút Camera đổi ảnh nổi góc dưới */}
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  title="Thay đổi ảnh đại diện"
                  className="absolute bottom-1 right-1 w-9 h-9 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Tên & chức vụ */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {user?.fullName || 'Cán Bộ Hệ Thống'}
                  </h1>
                  {user?.staffCode && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      {user.staffCode}
                    </span>
                  )}
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleInfo.color}`}>
                    {roleInfo.tag}
                  </span>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    {user?.departmentName || 'Khoa Công Nghệ Thông Tin'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {user?.position || (user as any)?.academicRank || 'Giảng viên'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {user?.email || 'email@daihoc.edu.vn'}
                  </span>
                </div>
              </div>
            </div>

            {/* Các nút hành động chính */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{uploadingAvatar ? 'Đang tải...' : 'Tải Ảnh Đại Diện'}</span>
              </button>

              {currentAvatarUrl && (
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={handleRemoveAvatar}
                  title="Gỡ ảnh đại diện"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('info');
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Hiệu Chỉnh Hồ Sơ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dải 4 Thẻ KPI Tóm Tắt Nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="p-4 border-r border-slate-200/90 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Sinh Trắc Học Face ID
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isFaceRegistered ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isFaceRegistered ? 'Đã kích hoạt 512D' : 'Chưa đăng ký'}
              </span>
            </div>
          </div>

          <div className="p-4 border-r border-slate-200/90 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Trạng Thái Công Tác
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Chính thức
            </span>
          </div>

          <div className="p-4 border-r border-slate-200/90 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Phân Quyền Vai Trò
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
              {user?.role || 'GIANGVIEN'}
            </span>
          </div>

          <div className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              An Toàn Tài Khoản
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Bảo mật 2 lớp OTP
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. NAVIGATION TABS (Phong Cách Capsule Cao Cấp)
         =================================================================== */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 overflow-x-auto custom-scrollbar">
        {[
          { id: 'info', label: '1. Thông Tin Cá Nhân & Liên Hệ', icon: User },
          { id: 'hrm', label: '2. Hồ Sơ Công Tác & Học Thuật HRM', icon: Briefcase },
          { id: 'face', label: '3. Sinh Trắc Học Face ID 512D', icon: Camera },
          { id: 'security', label: '4. Bảo Mật & Đổi Mật Khẩu', icon: KeyRound },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================
          TAB 1: THÔNG TIN CÁ NHÂN & LIÊN HỆ
         =================================================================== */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột trái: Quản lý Ảnh Đại Diện Chi Tiết */}
          <div className="md:col-span-1 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              <span>Ảnh Đại Diện Cá Nhân</span>
            </h3>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
              <div className="w-32 h-32 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-md ring-2 ring-indigo-500/20 mb-3 flex items-center justify-center">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={user?.fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                    onError={() => setPreviewAvatar(null)}
                  />
                ) : (
                  <UserAvatar
                    user={user}
                    name={user?.fullName}
                    avatarUrl={user?.avatar}
                    size="xl"
                    className="w-full h-full text-3xl font-black"
                  />
                )}
              </div>

              <div className="w-full space-y-2">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingAvatar ? 'Đang tải lên...' : 'Chọn Ảnh Từ Máy Tính'}</span>
                </button>

                {currentAvatarUrl && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ Ảnh Đại Diện</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Định dạng JPG, PNG, WebP (tối đa 5MB). Ảnh hiển thị ngay trên toàn hệ thống sau khi lưu.
              </p>
            </div>
          </div>

          {/* Cột phải: Form thông tin cá nhân */}
          <div className="md:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Lý Lịch & Thông Tin Liên Hệ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cập nhật số điện thoại, địa chỉ và thông tin liên hệ chính xác để nhận thông báo công tác.
                </p>
              </div>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Chỉnh Sửa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
              )}
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ và Tên Cán Bộ
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Công Tác NTU
                  </label>
                  <input
                    type="email"
                    disabled={true}
                    value={formData.email}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed"
                    title="Email cơ quan do Phòng TCCB cấp cố định"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số Điện Thoại Di Động
                  </label>
                  <input
                    type="tel"
                    disabled={!isEditing}
                    placeholder="VD: 0987654321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ngày Tháng Năm Sinh
                  </label>
                  <input
                    type="date"
                    disabled={!isEditing}
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Giới Tính
                  </label>
                  <select
                    disabled={!isEditing}
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Địa Chỉ Thường Trú / Nơi Ở
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    placeholder="VD: Cầu Giấy, Hà Nội"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{loading ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: HỒ SƠ CÔNG TÁC & HỌC THUẬT HRM
         =================================================================== */}
      {activeTab === 'hrm' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thông tin biên chế & đơn vị */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Đơn Vị & Vị Trí Việc Làm</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Mã số nhân sự:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {user?.staffCode || 'Chưa cấp mã'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Khoa / Phòng ban chính:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {user?.departmentName || 'Khoa Công Nghệ Thông Tin'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Chức vụ quản lý:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user?.position || 'Giảng viên'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Học hàm & Học vị:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(user as any)?.academicRank || 'Thạc sĩ'}
                </span>
              </div>
            </div>
          </div>

          {/* Chế độ đãi ngộ & Lương */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Chế Độ Đãi Ngộ & Hợp Đồng</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Loại hợp đồng:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Hợp đồng xác định thời hạn
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Hạn mức phép năm:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  12 ngày / năm
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Ngạch bậc lương:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Giảng viên chính (Hạng II)
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Hệ số lương cơ sở:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  4.40
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: SINH TRẮC HỌC FACE ID 512D
         =================================================================== */}
      {activeTab === 'face' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <span>Dữ Liệu Khuôn Mặt Sinh Trắc Học AI (InsightFace 512D)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Vector đặc trưng khuôn mặt 512 chiều được bảo vệ bằng mã hóa chuẩn Nghị định 13/2023/NĐ-CP.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/face-attendance')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <span>Kiểm Thử Điểm Danh Camera</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Ảnh khuôn mặt đăng ký */}
            <div className="md:col-span-1 flex flex-col items-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-40 h-40 rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center relative shadow-inner">
                {user?.facePhoto || (user as any)?.anh_khuon_mat ? (
                  <img
                    src={user.facePhoto || (user as any).anh_khuon_mat}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-1.5">
                    <Camera className="w-10 h-10 opacity-30 text-indigo-600" />
                    <span className="text-xs font-medium">Chưa có ảnh Face ID</span>
                  </div>
                )}
              </div>
              <span className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                Ảnh Chân Dung Sinh Trắc Học
              </span>
            </div>

            {/* Chi tiết thông số sinh trắc học */}
            <div className="md:col-span-2 space-y-3.5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Trạng thái đăng ký:</span>
                  <span
                    className={`font-bold px-3 py-1 rounded-full text-xs ${
                      isFaceRegistered
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {isFaceRegistered ? '✓ Đã kích hoạt mẫu 5 góc' : 'Chưa đăng ký mẫu'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Mô hình AI nhận diện:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    ArcFace ResNet-100 (512D Embeddings)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Chấp thuận dữ liệu sinh trắc học:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {isFaceRegistered ? 'Đã ký xác nhận (NĐ 13/2023)' : 'Chưa xác nhận'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <span className="font-bold block mb-1">📌 Hướng dẫn khi cần đăng ký lại khuôn mặt:</span>
                Vui lòng liên hệ Quản trị viên IT hoặc Phòng Tổ chức Cán bộ để thu thập lại 5 góc khuôn mặt chuẩn tại Kiosk đăng ký khuôn mặt của Nhà trường.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 4: BẢO MẬT & ĐỔI MẬT KHẨU
         =================================================================== */}
      {activeTab === 'security' && (
        <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Đổi Mật Khẩu Đăng Nhập
            </h3>
            <p className="text-xs text-slate-500">
              Mật khẩu mới phải có tối thiểu 6 ký tự để đảm bảo an toàn tài khoản.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mật Khẩu Hiện Tại
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  placeholder="Nhập mật khẩu đang dùng"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mật Khẩu Mới
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Xác Nhận Mật Khẩu Mới
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-2.5 mt-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{changingPassword ? 'Đang cập nhật mật khẩu...' : 'Xác Nhận Đổi Mật Khẩu'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
