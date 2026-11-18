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
import { useAuthStore } from '../../stores/useXacThucStore';
import { authApi } from '../../api/xacThuc.api';
import { userApi } from '../../api/nguoiDung.api';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { getRoleLabel } from '../../utils/phanQuyen';
import { HoSoBenTrai, ThanhTabHoSo } from '../../components/chung/HoSoBenTrai';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, fetchMe } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'info' | 'hrm' | 'face' | 'security'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form thông tin cá nhân (khớp chính xác các cột có thể tự cập nhật trong CSDL)
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: 'nam',
    bankAccount: '',
    bankName: '',
    bankBranch: '',
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
        dateOfBirth: user.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
        gender: user.gender || 'nam',
        bankAccount: user.so_tai_khoan_ngan_hang || '',
        bankName: user.ten_ngan_hang || '',
        bankBranch: user.chi_nhanh_ngan_hang || '',
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
      if ((res.data as any)?.anh_dai_dien || res.data?.avatar) {
        setPreviewAvatar((res.data as any).anh_dai_dien || res.data.avatar);
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
        so_tai_khoan_ngan_hang: formData.bankAccount.trim() || null,
        ten_ngan_hang: formData.bankName.trim() || null,
        chi_nhanh_ngan_hang: formData.bankBranch.trim() || null,
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
      case 'truong_khoa':
        return {
          label: 'Trưởng Khoa / Đơn Vị',
          tag: 'TRƯỞNG KHOA',
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
        };
      case 'pho_khoa':
        return {
          label: 'Phó Trưởng Khoa',
          tag: 'PHÓ KHOA',
          color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/60',
        };
      case 'truong_bo_mon':
        return {
          label: 'Trưởng Bộ Môn',
          tag: 'TRƯỞNG BỘ MÔN',
          color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60',
        };
      case 'pho_bo_mon':
        return {
          label: 'Phó Trưởng Bộ Môn',
          tag: 'PHÓ BỘ MÔN',
          color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/60',
        };
      case 'tccb':
        return {
          label: 'Phòng Tổ Chức Cán Bộ',
          tag: 'TCCB',
          color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60',
        };
      case 'dao_tao':
        return {
          label: 'Phòng Đào Tạo',
          tag: 'ĐÀO TẠO',
          color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
        };
      case 'ke_toan':
        return {
          label: 'Phòng Kế Toán',
          tag: 'KẾ TOÁN',
          color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
        };
      case 'giang_vien':
        return {
          label: 'Giảng viên Giảng dạy',
          tag: 'GIẢNG VIÊN',
          color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
        };
      case 'nhan_vien':
      case 'chuyen_vien':
        return {
          label: 'Chuyên viên / Nhân viên',
          tag: 'NHÂN VIÊN',
          color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
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
  const isFaceRegistered = Boolean(user?.isFaceRegistered);
  const currentAvatarUrl = previewAvatar || user?.avatar;
  const userExtra = (user || {}) as Record<string, any>;

  const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
    dang_lam_viec: 'Đang làm việc',
    tam_nghi: 'Tạm nghỉ',
    da_nghi_viec: 'Đã nghỉ việc',
  };
  const ACADEMIC_RANK_LABELS: Record<string, string> = {
    khong: 'Không',
    giao_su: 'Giáo sư (GS)',
    pho_giao_su: 'Phó Giáo sư (PGS)',
  };
  const DEGREE_LABELS: Record<string, string> = {
    tien_si: 'Tiến sĩ (TS)',
    thac_si: 'Thạc sĩ (ThS)',
    cu_nhan: 'Cử nhân / Đại học',
    ky_su: 'Kỹ sư',
    khac: 'Khác',
  };
  const STAFF_TYPE_LABELS: Record<string, string> = {
    giang_vien: 'Giảng viên',
    can_bo_quan_ly: 'Cán bộ quản lý',
    chuyen_vien: 'Chuyên viên',
    nhan_vien: 'Nhân viên',
  };
  const CONTRACT_TYPE_LABELS: Record<string, string> = {
    toan_thoi_gian: 'Cơ hữu toàn thời gian',
    ban_thoi_gian: 'Bán thời gian',
    thinh_giang: 'Thỉnh giảng',
    hop_dong_vu_viec: 'Hợp đồng vụ việc',
  };

  const formatDateVi = (val?: string | null) => {
    if (!val) return 'Chưa cập nhật';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? 'Chưa cập nhật' : d.toLocaleDateString('vi-VN');
  };

  const employmentStatusKey = user?.employmentStatus || 'dang_lam_viec';
  const employmentStatusLabel = EMPLOYMENT_STATUS_LABELS[employmentStatusKey] || 'Đang làm việc';
  const academicRankLabel =
    user?.academicRank && user.academicRank !== 'khong'
      ? ACADEMIC_RANK_LABELS[user.academicRank] || user.academicRank
      : '';
  const degreeLabel = user?.degree ? DEGREE_LABELS[user.degree] || user.degree : 'Chưa cập nhật';
  const academicSummary = academicRankLabel ? `${academicRankLabel} • ${degreeLabel}` : degreeLabel;
  const contractLabel = user?.contractType
    ? CONTRACT_TYPE_LABELS[user.contractType] || user.contractType
    : 'Chưa cập nhật';
  const staffTypeLabel = user?.staffType
    ? STAFF_TYPE_LABELS[user.staffType] || user.staffType
    : 'Chưa cập nhật';

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
          BỐ CỤC HỒ SƠ NHÂN VIÊN: CỘT TRÁI (ẢNH + TÓM TẮT) | CỘT PHẢI (TAB + NỘI DUNG)
         =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden lg:sticky lg:top-4">
          <HoSoBenTrai
            anhDaiDien={
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-lg flex items-center justify-center relative">
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
                      staffCode={user?.staffCode || user?._id}
                      size="full"
                      className="w-full h-full"
                    />
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center text-white z-20">
                      <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                      <span className="text-[10px] font-bold mt-1">Đang lưu...</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  title="Thay đổi ảnh đại diện"
                  className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            }
            maCanBo={user?.staffCode}
            trangThai={employmentStatusLabel}
            trangThaiHoatDong={employmentStatusKey !== 'da_nghi_viec' && user?.isActive !== false}
            hoTen={user?.fullName || 'Cán Bộ Hệ Thống'}
            thongTinChinh={[
              { icon: <Building2 className="w-3.5 h-3.5" />, text: user?.departmentName || 'Chưa phân công đơn vị' },
              {
                icon: <GraduationCap className="w-3.5 h-3.5" />,
                text:
                  user?.position && user.position !== 'khong'
                    ? user.position
                    : academicRankLabel || getRoleLabel(user?.role),
              },
            ]}
            lienHe={[
              { icon: <Phone className="w-3.5 h-3.5" />, text: user?.phoneNumber || 'Chưa cập nhật' },
              { icon: <Mail className="w-3.5 h-3.5" />, text: user?.email || '—' },
            ]}
            cacNhomPhu={[
              { tieuDe: 'Vai trò', noiDung: getRoleLabel(user?.role) },
              { tieuDe: 'Ngày vào làm', noiDung: formatDateVi(user?.startDate) },
              {
                tieuDe: 'Sinh trắc học Face ID',
                noiDung: (
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${isFaceRegistered ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    />
                    {isFaceRegistered ? 'Đã kích hoạt 512D' : 'Chưa đăng ký'}
                  </span>
                ),
              },
            ]}
            thaoTac={
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('info');
                    setIsEditing(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Hiệu Chỉnh Hồ Sơ</span>
                </button>
                {currentAvatarUrl && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ ảnh đại diện</span>
                  </button>
                )}
              </>
            }
          />
        </div>

        <div className="min-w-0 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <ThanhTabHoSo
              active={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
              tabs={[
                { id: 'info', label: 'Thông tin cá nhân & liên hệ', icon: <User className="w-3.5 h-3.5" /> },
                { id: 'hrm', label: 'Hồ sơ công tác & học thuật', icon: <Briefcase className="w-3.5 h-3.5" /> },
                { id: 'face', label: 'Sinh trắc học Face ID', icon: <Camera className="w-3.5 h-3.5" /> },
                { id: 'security', label: 'Bảo mật & mật khẩu', icon: <KeyRound className="w-3.5 h-3.5" /> },
              ]}
              className="border-b-0"
            />
          </div>

      {/* ===================================================================
          TAB 1: THÔNG TIN CÁ NHÂN & LIÊN HỆ
         =================================================================== */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột phải: Form thông tin cá nhân */}
          <div className="md:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm">
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
                    <option value="nam">Nam</option>
                    <option value="nu">Nữ</option>
                    <option value="khac">Khác</option>
                  </select>
                </div>

                <div className="md:col-span-2">
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

                {/* Thông tin tài khoản ngân hàng nhận lương (bảng ho_so_can_bo) */}
                <div className="md:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-3">
                    Tài Khoản Ngân Hàng Nhận Lương
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số Tài Khoản
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        placeholder="VD: 1903..."
                        value={formData.bankAccount}
                        onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Tên Ngân Hàng
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        placeholder="VD: Vietcombank, BIDV..."
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Chi Nhánh
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        placeholder="VD: Chi nhánh Hà Nội"
                        value={formData.bankBranch}
                        onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
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

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Mã số nhân sự:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {user?.staffCode || 'Chưa cấp mã'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Khoa / Phòng ban chính:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {user?.departmentName || 'Chưa phân công đơn vị'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Loại nhân sự & Chức vụ:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user?.position && user.position !== 'khong' ? user.position : staffTypeLabel}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Học hàm & Học vị:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{academicSummary}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Ngày vào làm / Thâm niên:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateVi(user?.startDate)}
                  {userExtra.tham_nien_nam ? ` (${userExtra.tham_nien_nam} năm)` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Ngày bắt đầu giảng dạy:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateVi(userExtra.ngay_bat_dau_giang_day)}
                </span>
              </div>
            </div>
          </div>

          {/* Chế độ đãi ngộ, lương & pháp lý */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Chế Độ Đãi Ngộ, Hợp Đồng & Thuế</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Loại hợp đồng:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{contractLabel}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Hạn hợp đồng / Phép năm:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {userExtra.ngay_het_han_hop_dong ? `${formatDateVi(userExtra.ngay_het_han_hop_dong)} • ` : ''}
                  {user?.annualLeaveQuota ?? 12} ngày / năm
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Ngạch bậc & Hệ số lương:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {user?.salaryScale || 'Chưa cập nhật'} • HS{' '}
                  {user?.salaryCoefficient !== undefined ? Number(user.salaryCoefficient).toFixed(2) : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Số CCCD / Người phụ thuộc:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {userExtra.so_cccd || 'Chưa cập nhật'} • {user?.dependentsCount ?? 0} NPT
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Mã số thuế cá nhân:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {userExtra.ma_so_thue || 'Chưa cập nhật'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-500">Tài khoản ngân hàng:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {userExtra.so_tai_khoan_ngan_hang
                    ? `${userExtra.so_tai_khoan_ngan_hang}${
                        userExtra.ten_ngan_hang
                          ? ` (${userExtra.ten_ngan_hang}${
                              userExtra.chi_nhanh_ngan_hang ? ` - ${userExtra.chi_nhanh_ngan_hang}` : ''
                            })`
                          : ''
                      }`
                    : 'Chưa cập nhật'}
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
              onClick={() => navigate('/diem-danh-khuon-mat')}
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
                {user?.facePhoto ? (
                  <AnhBaoMat
                    src={user.facePhoto}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="text-slate-400 flex flex-col items-center gap-1.5">
                        <Camera className="w-10 h-10 opacity-30 text-indigo-600" />
                        <span className="text-xs font-medium">Chưa có ảnh Face ID</span>
                      </div>
                    }
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
                    {isFaceRegistered
                      ? `✓ Đã kích hoạt (${userExtra.so_luong_mau || 5} mẫu)`
                      : 'Chưa đăng ký mẫu'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Mô hình AI nhận diện:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {isFaceRegistered
                      ? `${userExtra.mo_hinh_ai || 'buffalo_s'} (${userExtra.vectorDimension || userExtra.so_chieu_vector || 512}D${userExtra.isDefaultFace === false ? ' • Phụ' : ' • Mặc định'})`
                      : 'Chưa kích hoạt'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Ngày đăng ký / Xác nhận NĐ 13:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {isFaceRegistered
                      ? `Đã đăng ký (${formatDateVi(user?.faceRegisteredAt)})`
                      : 'Chưa xác nhận'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div>
              <span className="text-slate-500 block">Đăng nhập gần nhất:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {(userExtra.lastLoginAt || userExtra.lan_dang_nhap_cuoi)
                  ? new Date(userExtra.lastLoginAt || userExtra.lan_dang_nhap_cuoi).toLocaleString('vi-VN')
                  : 'Chưa ghi nhận'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Đổi mật khẩu gần nhất:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {(userExtra.passwordChangedAt || userExtra.doi_mat_khau_luc)
                  ? new Date(userExtra.passwordChangedAt || userExtra.doi_mat_khau_luc).toLocaleString('vi-VN')
                  : 'Chưa thay đổi'}
              </span>
            </div>
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
      </div>
    </div>
  );
};
