import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import {
  getCleanInitials,
  getCleanAvatarUrl,
  getAvatarTheme,
} from '../../utils/avatarHelper';

export interface UserAvatarProps {
  user?: {
    _id?: string;
    id?: string;
    fullName?: string;
    name?: string;
    avatar?: string | null;
    avatarUrl?: string | null;
    anh_dai_dien?: string | null;
    staffCode?: string;
    role?: string;
  } | null;
  name?: string;
  avatarUrl?: string | null;
  staffCode?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  variant?: 'gradient' | 'soft';
  className?: string;
  showStatusDot?: boolean;
  statusColor?: string;
  canUpload?: boolean;
  onQuickUpload?: (file: File) => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name,
  avatarUrl,
  staffCode,
  size = 'md',
  shape = 'rounded',
  variant = 'gradient',
  className = '',
  showStatusDot = false,
  statusColor = 'bg-emerald-500',
  canUpload = false,
  onQuickUpload,
}) => {
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = name || user?.fullName || user?.name || '';
  const resolvedStaffCode = staffCode || user?.staffCode || user?._id || user?.id || displayName;
  const resolvedAvatarUrl = avatarUrl !== undefined ? getCleanAvatarUrl(avatarUrl) : getCleanAvatarUrl(user);

  useEffect(() => {
    setImgError(false);
  }, [resolvedAvatarUrl]);

  const initials = getCleanInitials(displayName);
  const theme = getAvatarTheme(resolvedStaffCode || displayName);

  // Kích thước chuẩn
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base font-extrabold',
  }[size];

  // Kiểu bo góc
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  // Chế độ màu sắc
  const colorClass =
    variant === 'gradient'
      ? `bg-gradient-to-tr ${theme.gradient} text-white`
      : `${theme.bgLight} ${theme.textLight} border border-current/20`;

  const hasValidPhoto = Boolean(resolvedAvatarUrl && !imgError);

  return (
    <div className={`relative inline-flex shrink-0 group/avatar ${className}`}>
      <div
        className={`${sizeClasses} ${shapeClass} ${
          hasValidPhoto ? 'bg-slate-100 dark:bg-slate-800' : colorClass
        } flex items-center justify-center font-bold shadow-2xs overflow-hidden select-none ring-1 ring-black/5 dark:ring-white/10 relative`}
      >
        {hasValidPhoto ? (
          <img
            src={resolvedAvatarUrl!}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Họa tiết chân dung mờ nhẹ tạo chiều sâu cho Initials */}
            <svg
              viewBox="0 0 40 40"
              className="absolute inset-0 w-full h-full opacity-15"
              fill="currentColor"
            >
              <circle cx="20" cy="14" r="7" />
              <path d="M7 36c0-7.18 5.82-13 13-13s13 5.82 13 13H7z" />
            </svg>
            <span className="relative z-10 tracking-tight font-bold drop-shadow-2xs">
              {initials}
            </span>
          </div>
        )}

        {/* Nút upload nhanh ảnh đại diện */}
        {canUpload && onQuickUpload && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
              title="Tải lên / đổi ảnh đại diện"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onQuickUpload(file);
                  setImgError(false);
                }
              }}
            />
          </>
        )}
      </div>

      {/* Đèn chỉ báo trạng thái hoạt động / Face ID */}
      {showStatusDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${statusColor} rounded-full border-2 border-white dark:border-slate-900 shadow-2xs`}
        />
      )}
    </div>
  );
};
export default UserAvatar;
