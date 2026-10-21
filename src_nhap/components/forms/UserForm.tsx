import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  Shield, User, Mail, Lock, Briefcase, Info, ShieldCheck, Check,
  Phone, MapPin, Calendar, CreditCard, Users, Upload, Camera, Loader2,
  Trash2, Link as LinkIcon
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface UserFormProps {
  initialData?: any;
  roles: any[]; // Danh sách roles nhận từ trang Users.tsx
  onSuccess: (payload?: any) => void;
  onCancel: () => void;
}

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

export function UserForm({ initialData, roles, onSuccess, onCancel }: UserFormProps) {
  const isEdit = !!(initialData && initialData._id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    hometown: '',
    yearOfBirth: '',
    gender: '',
    bankName: '',
    bankAccountNumber: '',
    password: '',
    department: 'sales',
    status: 'active',
    avatar: ''
  });

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    setImgError(false);
    if (initialData) {
      setFormData({
        fullName: initialData.fullName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        hometown: initialData.hometown || '',
        yearOfBirth: initialData.yearOfBirth || '',
        gender: initialData.gender || '',
        bankName: initialData.bankName || '',
        bankAccountNumber: initialData.bankAccountNumber || '',
        password: '',
        department: initialData.department || 'sales',
        status: initialData.status || 'active',
        avatar: initialData.avatar || ''
      });

      // Khôi phục danh sách vai trò
      if (initialData.roles && Array.isArray(initialData.roles) && initialData.roles.length > 0) {
        const ids = initialData.roles.map((r: any) => typeof r === 'object' ? r._id : r).filter(Boolean);
        setSelectedRoleIds(ids);
      } else if (initialData.role) {
        const singleId = typeof initialData.role === 'object' ? initialData.role._id : initialData.role;
        setSelectedRoleIds(singleId ? [singleId] : []);
      } else {
        setSelectedRoleIds([]);
      }
    } else {
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        hometown: '',
        yearOfBirth: '',
        gender: '',
        bankName: '',
        bankAccountNumber: '',
        password: '',
        department: 'sales',
        status: 'active',
        avatar: ''
      });
      setSelectedRoleIds([]);
    }
  }, [initialData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('image', file);

      const res = await apiClient.post('/images/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const uploadedUrl = res.data.imageUrl || res.data.image?.url;
        if (uploadedUrl) {
          setImgError(false);
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          toast.success('Đã tải lên ảnh đại diện');
        } else {
          toast.error('Không tìm thấy đường dẫn ảnh phản hồi từ server');
        }
      } else {
        toast.error(res.data?.message || 'Tải ảnh thất bại');
      }
    } catch (error: any) {
      console.error('Lỗi khi upload ảnh:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi upload ảnh đại diện');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: '' }));
    setImgError(false);
    toast.success('Đã gỡ ảnh đại diện');
  };

  const handlePromptUrl = () => {
    const url = window.prompt('Nhập link URL ảnh đại diện:', formData.avatar || '');
    if (url !== null) {
      setImgError(false);
      setFormData(prev => ({ ...prev, avatar: url.trim() }));
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRoleIds.length === 0) {
      return toast.error("Vui lòng gán ít nhất một vai trò cho tài khoản");
    }

    const payload: any = {
      ...formData,
      roles: selectedRoleIds,
      role: selectedRoleIds[0] // Primary role
    };

    if (isEdit && !payload.password) {
      delete payload.password;
    }

    try {
      const res = isEdit
        ? await apiClient.put(`/users/${initialData._id}`, payload)
        : await apiClient.post('/users', payload);

      if (res.data.success) {
        toast.success(isEdit ? "Cập nhật tài khoản thành công!" : "Tạo tài khoản mới thành công!");
        onSuccess(payload);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi xử lý yêu cầu");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      {/* SECTION UPLOAD AVATAR */}
      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="relative group shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center overflow-hidden border-2 border-slate-200 shadow-sm relative group">
            {isUploading ? (
              <div className="flex flex-col items-center justify-center gap-1">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                <span className="text-[10px] text-slate-500 font-bold">Đang tải...</span>
              </div>
            ) : formData.avatar && !imgError ? (
              <img
                src={getAvatarUrl(formData.avatar)}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50/60 text-slate-400">
                <User className="w-10 h-10 text-indigo-300" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Mặc định</span>
              </div>
            )}
          </div>

          {/* Quick trigger camera button */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
            title="Tải ảnh lên"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div>
            <h4 className="text-sm font-black text-slate-800">Ảnh đại diện nhân sự</h4>
            <p className="text-xs text-slate-400">Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa 5MB). Nếu chưa có, hệ thống hiển thị icon mặc định.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {formData.avatar ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy'}
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={handlePromptUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              Nhập link ảnh
            </button>

            {formData.avatar && (
              <button
                type="button"
                disabled={isUploading}
                onClick={handleRemoveAvatar}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa ảnh
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Họ và tên nhân viên
          </label>
          <input
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.fullName}
            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Nguyễn Văn A"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" /> Email đăng nhập
          </label>
          <input
            required
            type="email"
            disabled={isEdit}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50 font-bold"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@deepcode.vn"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" /> Số điện thoại
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            placeholder="0912345678"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Quê quán / Địa chỉ
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.hometown}
            onChange={e => setFormData({ ...formData, hometown: e.target.value })}
            placeholder="Hà Nội, Nam Định..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Năm sinh
          </label>
          <input
            type="number"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.yearOfBirth}
            onChange={e => setFormData({ ...formData, yearOfBirth: e.target.value })}
            placeholder="199x"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Giới tính
          </label>
          <select
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
            value={formData.gender}
            onChange={e => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="">-- Chọn giới tính --</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5" /> Ngân hàng
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.bankName}
            onChange={e => setFormData({ ...formData, bankName: e.target.value })}
            placeholder="Vietcombank, Techcombank..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5" /> Số tài khoản
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
            value={formData.bankAccountNumber}
            onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })}
            placeholder="0123456789"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" /> {isEdit ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu khởi tạo"}
        </label>
        <input
          required={!isEdit}
          type="password"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
          value={formData.password}
          onChange={e => setFormData({ ...formData, password: e.target.value })}
          placeholder="••••••••"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5" /> Phòng ban hạch toán
          </label>
          <select
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
            value={formData.department}
            onChange={e => setFormData({ ...formData, department: e.target.value })}
          >
            <option value="">-- Chọn phòng ban --</option>
            <option value="sales">Kinh doanh</option>
            <option value="training">Đào tạo (Academic)</option>
            <option value="accounting">Kế toán / Tài chính</option>
            <option value="marketing">Marketing</option>
            <option value="operation">Vận hành / IT</option>
            <option value="boad of director">Ban giám đốc</option>
            <option value="teacher">Giảng viên</option>
            <option value="student">Học viên</option>
            <option value="parent">🔗 Phụ huynh (Portal SteamLab)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Info className="w-3.5 h-3.5" /> Trạng thái tài khoản
          </label>
          <select
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đang tạm khóa</option>
          </select>
        </div>
      </div>

      {/* MULTI-ROLE SELECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Chọn Các Vai trò (Hỗ trợ 1 người có nhiều vai trò)
          </label>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
            {selectedRoleIds.length} vai trò được chọn
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {roles.map((role) => {
            const isSelected = selectedRoleIds.includes(role._id);
            return (
              <div
                key={role._id}
                onClick={() => toggleRole(role._id)}
                className={`cursor-pointer flex items-center justify-between px-3.5 py-3 rounded-xl transition-all border-2 select-none ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-[11px] font-black uppercase truncate pr-1">{role.name}</span>
                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                  isSelected ? 'bg-white text-indigo-600 border-white' : 'border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
        {roles.length === 0 && <p className="text-[10px] text-rose-500 italic">Hệ thống chưa có vai trò nào. Hãy cấu hình ở mục Phân quyền.</p>}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isUploading}
          className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải ảnh lên...
            </>
          ) : (
            isEdit ? "Cập nhật tài khoản" : "Kích hoạt tài khoản"
          )}
        </button>
      </div>
    </form>
  );
}