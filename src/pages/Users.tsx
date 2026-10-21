import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  Building2,
  GraduationCap,
  ScanFace,
  Edit3,
  Trash2,
  Eye,
  Mail,
  Phone,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
  Unlock,
  MapPin,
  List,
  LayoutGrid,
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Camera,
  Upload,
} from 'lucide-react';
import { userApi } from '../api/user.api';
import {
  UserProfile,
  DepartmentItem,
  CreateUserPayload,
  UpdateUserPayload,
  AcademicRankType,
  DegreeType,
  StaffType,
  ContractType,
  EmploymentStatusType,
  GenderType,
} from '../types';
import { useAuthStore } from '../store/useAuthStore';

// =============================================================================
// HẰNG SỐ VÀ BẢNG ÁNH XẠ CHUẨN ĐẠI HỌC (CSDL v2.5)
// =============================================================================

const ROLE_OPTIONS = [
  { value: 'bgh', label: 'Ban Giám Hiệu (BGH)', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'admin', label: 'Quản trị Hệ thống / TCCB', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  { value: 'truongkhoa', label: 'Trưởng Khoa / Trưởng Đơn Vị', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'phokhoa', label: 'Phó Trưởng Khoa', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  { value: 'truongbomon', label: 'Trưởng Bộ Môn', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'giangvien', label: 'Giảng Viên', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'nhanvien', label: 'Chuyên Viên Hành Chính', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
];

const ACADEMIC_RANK_OPTIONS: { value: AcademicRankType; label: string; short: string }[] = [
  { value: 'KHONG', label: 'Không có học hàm', short: '' },
  { value: 'PHO_GIAO_SU', label: 'Phó Giáo sư (PGS)', short: 'PGS.' },
  { value: 'GIAO_SU', label: 'Giáo sư (GS)', short: 'GS.' },
];

const DEGREE_OPTIONS: { value: DegreeType; label: string; short: string }[] = [
  { value: 'CU_NHAN', label: 'Cử nhân (CN)', short: 'CN.' },
  { value: 'KY_SU', label: 'Kỹ sư (KS)', short: 'KS.' },
  { value: 'THAC_SI', label: 'Thạc sĩ (ThS)', short: 'ThS.' },
  { value: 'TIEN_SI', label: 'Tiến sĩ (TS)', short: 'TS.' },
  { value: 'KHAC', label: 'Khác', short: '' },
];

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: 'GIANG_VIEN', label: 'Ngạch Giảng viên (Giảng dạy)' },
  { value: 'HANH_CHINH', label: 'Ngạch Chuyên viên / Hành chính' },
];

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'TOAN_THOI_GIAN', label: 'Cơ hữu toàn thời gian' },
  { value: 'KHONG_XAC_DINH_THOI_HAN', label: 'HĐ không xác định thời hạn' },
  { value: 'XAC_DINH_THOI_HAN', label: 'HĐ xác định thời hạn (12-36 tháng)' },
  { value: 'THU_VIEC', label: 'Hợp đồng thử việc / Tập sự' },
  { value: 'BAN_THOI_GIAN', label: 'Giảng viên thỉnh giảng / Bán thời gian' },
];

const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatusType; label: string; color: string }[] = [
  { value: 'DANG_LAM_VIEC', label: 'Đang công tác', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'TAM_HOAN', label: 'Tạm hoãn / Nghỉ thai sản / Đi học', color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  { value: 'DA_NGHI_VIEC', label: 'Đã thôi việc / Chuyển công tác', color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
];

const SALARY_SCALE_PRESETS = [
  { code: 'V.07.01.01', label: 'V.07.01.01 - Giảng viên cao cấp (Hạng I)', defaultCoeff: 6.2 },
  { code: 'V.07.01.02', label: 'V.07.01.02 - Giảng viên chính (Hạng II)', defaultCoeff: 4.4 },
  { code: 'V.07.01.03', label: 'V.07.01.03 - Giảng viên (Hạng III)', defaultCoeff: 2.34 },
  { code: '01.002', label: '01.002 - Chuyên viên chính', defaultCoeff: 4.4 },
  { code: '01.003', label: '01.003 - Chuyên viên (Hành chính)', defaultCoeff: 2.34 },
];

/**
 * Tách Họ Tên và Chức Danh trong ngoặc đơn để hiển thị 2 dòng gọn gàng (Chuẩn FaceRegistrationPage)
 */
const formatNameAndTitle = (rawName = '') => {
  const match = rawName.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return { name: match[1].trim(), title: match[2].trim() };
  }
  return { name: rawName.trim(), title: '' };
};

const normalizeRoleKey = (role?: string): string => {
  if (!role) return 'giangvien';
  const r = role.toLowerCase().replace(/_/g, '');
  if (r === 'adminit' || r === 'itadmin' || r === 'tccb' || r === 'ketoan') return 'admin';
  if (r === 'photruongkhoa') return 'phokhoa';
  if (r === 'chuyenvien') return 'nhanvien';
  return r;
};

const getRoleMeta = (role?: string) => {
  const key = normalizeRoleKey(role);
  return (
    ROLE_OPTIONS.find((opt) => opt.value === key) || {
      value: key,
      label: role || 'Cán bộ',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    }
  );
};

const getAcademicPrefix = (u: UserProfile): string => {
  const parts: string[] = [];
  if (u.academicRank === 'GIAO_SU') parts.push('GS.');
  else if (u.academicRank === 'PHO_GIAO_SU') parts.push('PGS.');

  if (u.degree === 'TIEN_SI') parts.push('TS.');
  else if (u.degree === 'THAC_SI') parts.push('ThS.');
  else if (u.degree === 'KY_SU') parts.push('KS.');
  return parts.join(' ');
};

const getDepartmentName = (u: UserProfile, departments: DepartmentItem[]): string => {
  if (u.departmentName) return u.departmentName;
  if (u.departmentId && typeof u.departmentId === 'object' && 'name' in u.departmentId) {
    return u.departmentId.name;
  }
  if (typeof u.departmentId === 'string') {
    const found = departments.find((d) => d._id === u.departmentId);
    if (found) return found.name;
  }
  return 'Chưa phân đơn vị';
};

const getDepartmentIdValue = (u: UserProfile): string => {
  if (!u.departmentId) return '';
  if (typeof u.departmentId === 'object' && '_id' in u.departmentId) {
    return u.departmentId._id;
  }
  return String(u.departmentId);
};

const getAvatarGradient = (role?: string) => {
  const key = normalizeRoleKey(role);
  switch (key) {
    case 'bgh':
      return 'from-purple-600 to-indigo-600';
    case 'admin':
      return 'from-rose-500 to-orange-500';
    case 'truongkhoa':
    case 'phokhoa':
      return 'from-blue-600 to-cyan-600';
    case 'truongbomon':
      return 'from-indigo-600 to-blue-500';
    case 'giangvien':
      return 'from-brand-500 to-indigo-600';
    default:
      return 'from-amber-500 to-orange-600';
  }
};

const getInitials = (fullName = '') => {
  const { name } = formatNameAndTitle(fullName);
  const clean = name
    .replace(/^(GS|PGS|TS|ThS|CN|KS)\.?\s*/gi, '')
    .replace(/^(GS|PGS|TS|ThS|CN|KS)\.?\s*/gi, '')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// =============================================================================
// COMPONENT AVATAR THÔNG MINH (HIỂN THỊ ẢNH THẬT + FALLBACK SVG SẮC NÉT + TẢI ẢNH)
// =============================================================================

interface StaffAvatarProps {
  user: UserProfile;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  canUpload?: boolean;
  onQuickUpload?: (user: UserProfile, file: File) => void;
}

const StaffAvatar: React.FC<StaffAvatarProps> = ({
  user,
  size = 'md',
  canUpload = false,
  onQuickUpload,
}) => {
  const rawSrc = user.avatar || user.facePhoto || null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imgError = Boolean(rawSrc && failedSrc === rawSrc);
  const initials = getInitials(user.fullName);
  const gradient = getAvatarGradient(user.role);

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-[10px]',
    md: 'w-9 h-9 rounded-xl text-xs',
    lg: 'w-11 h-11 rounded-2xl text-sm',
    xl: 'w-16 h-16 rounded-2xl text-lg',
  }[size];

  return (
    <div className="relative group/avatar shrink-0">
      <div
        className={`${sizeClasses} bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-bold shadow-2xs overflow-hidden ring-2 ring-white dark:ring-slate-900 relative select-none`}
      >
        {rawSrc && !imgError ? (
          <img
            src={rawSrc}
            alt={user.fullName}
            className="w-full h-full object-cover"
            onError={() => setFailedSrc(rawSrc)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Họa tiết portrait nền tinh tế */}
            <svg
              viewBox="0 0 40 40"
              className="absolute inset-0 w-full h-full opacity-20 text-white"
              fill="currentColor"
            >
              <circle cx="20" cy="14" r="7" />
              <path d="M7 36c0-7.18 5.82-13 13-13s13 5.82 13 13H7z" />
            </svg>
            <span className="relative z-10 tracking-tight font-extrabold drop-shadow-2xs">
              {initials}
            </span>
          </div>
        )}

        {/* Nút bấm tải ảnh nhanh khi rê chuột vào Avatar (dành cho Admin) */}
        {canUpload && onQuickUpload && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
              title="Nhấn để tải lên / đổi ảnh đại diện (Avatar)"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onQuickUpload(user, file);
                  e.target.value = '';
                }
              }}
            />
          </>
        )}
      </div>

      {/* Chấm trạng thái hoạt động / FaceID */}
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
          user.isActive === false
            ? 'bg-rose-500'
            : user.isFaceRegistered
              ? 'bg-emerald-500'
              : 'bg-amber-400'
        }`}
        title={
          user.isActive === false
            ? 'Tài khoản đang khóa'
            : user.isFaceRegistered
              ? 'Đã xác thực sinh trắc học Face ID'
              : 'Đang hoạt động (Chưa đăng ký Face ID)'
        }
      />
    </div>
  );
};

// =============================================================================
// COMPONENT CHÍNH: QUẢN LÝ DANH SÁCH CÁN BỘ & GIẢNG VIÊN (CHUẨN GIAO DIỆN)
// =============================================================================

export const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const viewerRole = normalizeRoleKey(currentUser?.role);
  const canCreateOrDelete = viewerRole === 'admin' || viewerRole === 'bgh';
  const canEdit = canCreateOrDelete || viewerRole === 'truongkhoa';

  // State dữ liệu
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

  // State bộ lọc & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'giangvien' | 'leadership' | 'hanhchinh' | 'face_yes' | 'face_no'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Chế độ hiển thị (4 chế độ chuẩn giống FaceRegistrationPage)
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'compact' | 'department'>(() => {
    const saved = localStorage.getItem('users_list_view_mode');
    if (saved === 'table' || saved === 'grid' || saved === 'compact' || saved === 'department') {
      return saved;
    }
    return 'table';
  });
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // State Phân trang (Pagination)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // State Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'academic' | 'salary'>('basic');
  const modalAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateUserPayload & { isActive?: boolean }>({
    fullName: '',
    email: '',
    password: '',
    staffCode: '',
    role: 'giangvien',
    departmentId: '',
    phoneNumber: '',
    position: 'Giảng viên',
    academicRank: 'KHONG',
    degree: 'THAC_SI',
    staffType: 'GIANG_VIEN',
    contractType: 'TOAN_THOI_GIAN',
    salaryScale: 'V.07.01.03',
    salaryCoefficient: 2.34,
    dependentsCount: 0,
    annualLeaveQuota: 12,
    gender: 'NAM',
    dateOfBirth: '',
    startDate: new Date().toISOString().slice(0, 10),
    address: '',
    employmentStatus: 'DANG_LAM_VIEC',
    avatar: '',
    isActive: true,
  });

  const handleSetViewMode = (mode: 'table' | 'grid' | 'compact' | 'department') => {
    setViewMode(mode);
    setCurrentPage(1);
    localStorage.setItem('users_list_view_mode', mode);
  };

  const toggleDeptCollapse = (deptName: string) => {
    setCollapsedDepts((prev) => ({ ...prev, [deptName]: !prev[deptName] }));
  };

  // ---------------------------------------------------------------------------
  // TẢI DỮ LIỆU TỪ API
  // ---------------------------------------------------------------------------
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        userApi.getUsers({ page: 1, limit: 200 }),
        userApi.getDepartments(),
      ]);

      if (usersRes.data) {
        const list = Array.isArray(usersRes.data)
          ? usersRes.data
          : Array.isArray(usersRes.data.users)
            ? usersRes.data.users
            : [];
        setUsers(list);
      }

      if (deptsRes.data && Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải danh sách cán bộ, giảng viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ---------------------------------------------------------------------------
  // THỐNG KÊ KPI VÀ LỌC DỮ LIỆU ĐA CHIỀU
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = users.length;
    const activeCount = users.filter((u) => u.isActive !== false).length;
    const faceRegCount = users.filter((u) => Boolean(u.isFaceRegistered)).length;
    const lecturerCount = users.filter((u) => {
      const r = normalizeRoleKey(u.role);
      return u.staffType === 'GIANG_VIEN' || ['giangvien', 'truongkhoa', 'phokhoa', 'truongbomon'].includes(r);
    }).length;
    const leadershipCount = users.filter((u) =>
      ['bgh', 'truongkhoa', 'phokhoa', 'truongbomon'].includes(normalizeRoleKey(u.role))
    ).length;
    const adminStaffCount = users.filter((u) => {
      const r = normalizeRoleKey(u.role);
      return u.staffType === 'HANH_CHINH' || r === 'nhanvien' || r === 'admin';
    }).length;
    const pgsTsCount = users.filter(
      (u) => u.academicRank === 'GIAO_SU' || u.academicRank === 'PHO_GIAO_SU' || u.degree === 'TIEN_SI'
    ).length;

    return {
      total,
      activeCount,
      faceRegCount,
      facePercent: total > 0 ? Math.round((faceRegCount / total) * 100) : 0,
      lecturerCount,
      leadershipCount,
      adminStaffCount,
      pgsTsCount,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = (u.fullName || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchCode = (u.staffCode || u.employeeCode || '').toLowerCase().includes(q);
        const matchPhone = (u.phoneNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCode && !matchPhone) return false;
      }

      // 2. Lọc theo Tab
      const rKey = normalizeRoleKey(u.role);
      if (filterTab === 'giangvien') {
        if (u.staffType !== 'GIANG_VIEN' && !['giangvien', 'truongkhoa', 'phokhoa', 'truongbomon'].includes(rKey)) {
          return false;
        }
      } else if (filterTab === 'leadership') {
        if (!['bgh', 'truongkhoa', 'phokhoa', 'truongbomon'].includes(rKey)) return false;
      } else if (filterTab === 'hanhchinh') {
        if (u.staffType !== 'HANH_CHINH' && rKey !== 'nhanvien' && rKey !== 'admin') return false;
      } else if (filterTab === 'face_yes') {
        if (!u.isFaceRegistered) return false;
      } else if (filterTab === 'face_no') {
        if (u.isFaceRegistered) return false;
      }

      // 3. Lọc theo Khoa / Phòng ban
      if (departmentFilter !== 'ALL') {
        const deptId = getDepartmentIdValue(u);
        if (deptId !== departmentFilter) return false;
      }

      return true;
    });
  }, [users, searchTerm, filterTab, departmentFilter]);

  // Phân nhóm theo Khoa / Đơn vị cho chế độ 'department'
  const departmentGroups = useMemo(() => {
    const map = new Map<string, UserProfile[]>();
    filteredUsers.forEach((emp) => {
      const deptName = getDepartmentName(emp, departments);
      if (!map.has(deptName)) map.set(deptName, []);
      map.get(deptName)!.push(emp);
    });
    return Array.from(map.entries()).map(([deptName, members]) => {
      const registeredCount = members.filter((m) => Boolean(m.isFaceRegistered)).length;
      const percent = members.length > 0 ? Math.round((registeredCount / members.length) * 100) : 0;
      return { deptName, members, total: members.length, registeredCount, percent };
    });
  }, [filteredUsers, departments]);

  // Tính toán Phân trang (Pagination)
  const totalFilteredCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, validCurrentPage, pageSize]);

  const paginatedDepartmentGroups = useMemo(() => {
    const map = new Map<string, UserProfile[]>();
    paginatedUsers.forEach((emp) => {
      const deptName = getDepartmentName(emp, departments);
      if (!map.has(deptName)) map.set(deptName, []);
      map.get(deptName)!.push(emp);
    });
    return Array.from(map.entries()).map(([deptName, members]) => {
      const fullGroup = departmentGroups.find((g) => g.deptName === deptName);
      return {
        deptName,
        members,
        total: fullGroup ? fullGroup.total : members.length,
        registeredCount: fullGroup ? fullGroup.registeredCount : 0,
        percent: fullGroup ? fullGroup.percent : 0,
      };
    });
  }, [paginatedUsers, departmentGroups, departments]);

  // ---------------------------------------------------------------------------
  // XỬ LÝ TẢI LÊN AVATAR NHANH & TRONG MODAL
  // ---------------------------------------------------------------------------
  const handleQuickAvatarUpload = async (targetUser: UserProfile, file: File) => {
    const toastId = toast.loading(`Đang tải ảnh đại diện cho ${formatNameAndTitle(targetUser.fullName).name}...`);
    try {
      const uploadRes = await userApi.uploadAvatar(file);
      const uploadedUrl = uploadRes.data?.fileUrl || uploadRes.data?.url;
      if (!uploadedUrl) {
        throw new Error('Không nhận được đường dẫn ảnh sau khi tải lên.');
      }

      const avatarWithCacheBust = `${uploadedUrl}?v=${Date.now()}`;
      await userApi.updateUser(targetUser._id, { avatar: avatarWithCacheBust });

      setUsers((prev) =>
        prev.map((u) => (u._id === targetUser._id ? { ...u, avatar: avatarWithCacheBust } : u))
      );
      if (detailUser && detailUser._id === targetUser._id) {
        setDetailUser((prev) => (prev ? { ...prev, avatar: avatarWithCacheBust } : null));
      }

      toast.success('Đã cập nhật ảnh đại diện thành công!', { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi tải lên ảnh đại diện.', { id: toastId });
    }
  };

  const handleModalAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploadRes = await userApi.uploadAvatar(file);
      const uploadedUrl = uploadRes.data?.fileUrl || uploadRes.data?.url;
      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, avatar: `${uploadedUrl}?v=${Date.now()}` }));
        toast.success('Đã tải ảnh đại diện lên thành công!');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải ảnh lên.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // ---------------------------------------------------------------------------
  // XỬ LÝ MỞ MODAL THÊM / SỬA
  // ---------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setActiveFormTab('basic');
    const nextIdx = users.length + 1;
    const suggestedCode = `GV${String(nextIdx).padStart(3, '0')}`;

    setFormData({
      fullName: '',
      email: '',
      password: 'password123',
      staffCode: suggestedCode,
      role: 'giangvien',
      departmentId: departments[0]?._id || '',
      phoneNumber: '',
      position: 'Giảng viên',
      academicRank: 'KHONG',
      degree: 'THAC_SI',
      staffType: 'GIANG_VIEN',
      contractType: 'TOAN_THOI_GIAN',
      salaryScale: 'V.07.01.03',
      salaryCoefficient: 2.34,
      dependentsCount: 0,
      annualLeaveQuota: 12,
      gender: 'NAM',
      dateOfBirth: '',
      startDate: new Date().toISOString().slice(0, 10),
      address: '',
      employmentStatus: 'DANG_LAM_VIEC',
      avatar: '',
      isActive: true,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setActiveFormTab('basic');
    setFormData({
      fullName: u.fullName || '',
      email: u.email || '',
      password: '',
      staffCode: u.staffCode || u.employeeCode || '',
      role: normalizeRoleKey(u.role),
      departmentId: getDepartmentIdValue(u),
      phoneNumber: u.phoneNumber || u.phone || '',
      position: typeof u.position === 'string' ? u.position : '',
      academicRank: u.academicRank || 'KHONG',
      degree: u.degree || 'THAC_SI',
      staffType: u.staffType || (normalizeRoleKey(u.role) === 'nhanvien' ? 'HANH_CHINH' : 'GIANG_VIEN'),
      contractType: u.contractType || 'TOAN_THOI_GIAN',
      salaryScale: u.salaryScale || 'V.07.01.03',
      salaryCoefficient: u.salaryCoefficient ?? 2.34,
      dependentsCount: u.dependentsCount ?? 0,
      annualLeaveQuota: u.annualLeaveQuota ?? 12,
      gender: u.gender || 'NAM',
      dateOfBirth: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
      startDate: u.startDate ? String(u.startDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      address: u.address || '',
      employmentStatus: u.employmentStatus || 'DANG_LAM_VIEC',
      avatar: u.avatar || u.facePhoto || '',
      isActive: u.isActive !== false,
    });
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error('Vui lòng nhập họ và tên cán bộ / giảng viên.');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Vui lòng nhập địa chỉ email công vụ.');
      return;
    }
    if (!formData.staffCode.trim()) {
      toast.error('Vui lòng nhập mã cán bộ (VD: GV005, CV003).');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        const updatePayload: UpdateUserPayload = {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          staffCode: formData.staffCode.trim().toUpperCase(),
          role: formData.role,
          departmentId: formData.departmentId || null,
          phoneNumber: formData.phoneNumber?.trim() || undefined,
          position: formData.position?.trim() || undefined,
          academicRank: formData.academicRank,
          degree: formData.degree,
          staffType: formData.staffType,
          contractType: formData.contractType,
          salaryScale: formData.salaryScale,
          salaryCoefficient: Number(formData.salaryCoefficient),
          dependentsCount: Number(formData.dependentsCount),
          annualLeaveQuota: Number(formData.annualLeaveQuota),
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth || undefined,
          startDate: formData.startDate || undefined,
          address: formData.address?.trim() || '',
          employmentStatus: formData.employmentStatus,
          avatar: formData.avatar?.trim() || null,
          isActive: formData.isActive,
        };
        if (formData.password && formData.password.trim().length > 0) {
          updatePayload.password = formData.password.trim();
        }

        await userApi.updateUser(editingUser._id, updatePayload);
        toast.success(`Đã cập nhật hồ sơ của ${formData.fullName}!`);
      } else {
        if (!formData.password || formData.password.length < 6) {
          toast.error('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.');
          setSubmitting(false);
          return;
        }
        const createPayload: CreateUserPayload = {
          ...formData,
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          staffCode: formData.staffCode.trim().toUpperCase(),
          departmentId: formData.departmentId || null,
          avatar: formData.avatar?.trim() || null,
        };
        await userApi.createUser(createPayload);
        toast.success(`Đã tạo tài khoản cán bộ ${formData.fullName} thành công!`);
      }

      setIsFormModalOpen(false);
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi lưu hồ sơ cán bộ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActiveStatus = async (u: UserProfile) => {
    const nextState = u.isActive === false;
    const parsed = formatNameAndTitle(u.fullName);
    const confirmMsg = nextState
      ? `Kích hoạt lại tài khoản của "${parsed.name}"?`
      : `Khóa / Vô hiệu hóa tài khoản của "${parsed.name}"? Toàn bộ phiên đăng nhập của người dùng này sẽ bị thu hồi.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (!nextState) {
        await userApi.deleteUser(u._id);
        toast.success(`Đã vô hiệu hóa tài khoản của ${parsed.name}.`);
      } else {
        await userApi.updateUser(u._id, { isActive: true, employmentStatus: 'DANG_LAM_VIEC' });
        toast.success(`Đã mở khóa tài khoản của ${parsed.name}.`);
      }
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const handleDeleteFaceData = async (u: UserProfile) => {
    const parsed = formatNameAndTitle(u.fullName);
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa dữ liệu sinh trắc học Face ID 512D của "${parsed.name}"? Cán bộ sẽ cần đăng ký lại khuôn mặt 5 góc để chấm công.`
      )
    ) {
      return;
    }

    try {
      await userApi.deleteFaceDescriptor(u._id);
      toast.success(`Đã xóa mẫu sinh trắc học Face ID của ${parsed.name}.`);
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa dữ liệu khuôn mặt.');
    }
  };

  return (
    <div className="space-y-5">
      {/* ── 1. DẢI THẺ THỐNG KÊ TỔNG QUAN (EXECUTIVE KPI BAR - CHUẨN GIAO DIỆN) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Tổng Cán Bộ & Giảng Viên
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{stats.total}</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ({stats.activeCount} đang công tác)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Giảng Viên & Học Hàm PGS/TS
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {stats.lecturerCount}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ({stats.pgsTsCount} GS/PGS/TS)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Đã Đăng Ký Face ID 512D
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {stats.faceRegCount} / {stats.total}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ({stats.facePercent}%)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Đơn Vị Khoa / Phòng Ban
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {departments.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ({stats.leadershipCount} lãnh đạo)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KHUNG QUẢN TRỊ DANH SÁCH CÁN BỘ & GIẢNG VIÊN (CHUẨN GIAO DIỆN) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs space-y-4">
        {/* Header Quản Trị & Cụm Nút Hành Động */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              Danh Sách Hồ Sơ Cán Bộ & Giảng Viên Đại Học Nguyễn Trãi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý biên chế, học hàm/học vị, ngạch lương viên chức, định mức phép năm và ảnh đại diện (Avatar / Face ID).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Ô tìm kiếm */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm tên, mã CB, email, SĐT..."
                className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Lọc theo Khoa / Đơn vị */}
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[210px] truncate cursor-pointer"
            >
              <option value="ALL">Tất cả Khoa / Đơn vị ({departments.length})</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchAllData}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            </button>

            {canCreateOrDelete && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm Cán Bộ Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Thanh công cụ: Bộ lọc Tab & Bộ chọn Bố cục hiển thị (Segmented Control) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          {/* Bộ lọc Tab */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => {
                setFilterTab('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tất cả ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('giangvien');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'giangvien'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Khối Giảng dạy ({stats.lecturerCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('leadership');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'leadership'
                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Lãnh đạo ({stats.leadershipCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('hanhchinh');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'hanhchinh'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Khối Hành chính ({stats.adminStaffCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('face_yes');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'face_yes'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Đã có Face ID ({stats.faceRegCount})
            </button>
          </div>

          {/* Bộ chọn Bố Cục Hiển Thị (Segmented Control 4 chế độ) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Bố cục 1: Dạng Bảng chi tiết (Table View)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Bố cục 2: Dạng Thẻ lưới sinh động (Card Grid)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Thẻ lưới</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Bố cục 3: Dạng Tinh gọn siêu tốc (Compact List)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tinh gọn</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('department')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'department'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Bố cục 4: Dạng Theo Khoa / Đơn vị (Department Groups)"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Theo Khoa</span>
            </button>
          </div>
        </div>

        {/* Khung Hiển Thị Danh Sách Cán Bộ */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden bg-white dark:bg-slate-900 w-full">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Đang tải danh sách cán bộ, giảng viên...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <UsersIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-medium">Không tìm thấy cán bộ / giảng viên nào phù hợp với bộ lọc.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* ── CHẾ ĐỘ 1: BẢNG CHI TIẾT CHUẨN (TABLE VIEW) ── */
            <>
              <div className="hidden lg:grid grid-cols-[1.6fr_1.1fr_1.25fr_1fr_130px_145px] gap-3 px-4 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
                <div className="min-w-0">Cán bộ / Giảng viên</div>
                <div className="min-w-0">Mã CB & Liên hệ</div>
                <div className="min-w-0">Khoa / Đơn vị & Vai trò</div>
                <div className="min-w-0">Học hàm • Ngạch lương</div>
                <div className="text-center">Face ID / Trạng thái</div>
                <div className="text-right">Thao tác</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedUsers.map((emp) => {
                  const isRegistered = Boolean(emp.isFaceRegistered);
                  const parsed = formatNameAndTitle(emp.fullName || '');
                  const staffCodeVal =
                    emp.staffCode || emp.employeeCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                  const deptNameVal = getDepartmentName(emp, departments);
                  const roleMeta = getRoleMeta(emp.role);
                  const academicPrefix = getAcademicPrefix(emp);

                  return (
                    <div
                      key={emp._id}
                      className={`p-3.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:grid lg:grid-cols-[1.6fr_1.1fr_1.25fr_1fr_130px_145px] gap-2.5 lg:gap-3 items-start lg:items-center w-full min-w-0 ${
                        emp.isActive === false ? 'opacity-60 bg-slate-50/40 dark:bg-slate-950/30' : ''
                      }`}
                    >
                      {/* Cột 1: Avatar + Họ tên + Chức danh */}
                      <div className="w-full lg:w-auto min-w-0 flex items-center justify-between lg:justify-start gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <StaffAvatar
                            user={emp}
                            size="md"
                            canUpload={canEdit}
                            onQuickUpload={handleQuickAvatarUpload}
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setDetailUser(emp)}
                              className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 text-xs sm:text-[13px] truncate text-left transition-colors cursor-pointer"
                              title={parsed.name}
                            >
                              {parsed.name}
                            </button>
                            <span
                              className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block"
                              title={parsed.title || (typeof emp.position === 'string' ? emp.position : '')}
                            >
                              {parsed.title || (typeof emp.position === 'string' && emp.position) || 'Cán bộ cơ hữu'}
                            </span>
                          </div>
                        </div>

                        <span className="lg:hidden font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/70 shrink-0">
                          {staffCodeVal}
                        </span>
                      </div>

                      {/* Cột 2: Mã CB / Email */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md inline-block w-fit tracking-wide border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
                          {staffCodeVal}
                        </span>
                        <span
                          className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block"
                          title={emp.email}
                        >
                          {emp.email}
                        </span>
                      </div>

                      {/* Cột 3: Khoa / Đơn vị & Vai trò */}
                      <div className="w-full lg:w-auto min-w-0 flex flex-col gap-1">
                        <span
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 max-w-full min-w-0 w-fit"
                          title={deptNameVal}
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border w-fit ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.label}
                        </span>
                      </div>

                      {/* Cột 4: Học hàm / Ngạch lương */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {academicPrefix || 'Cử nhân / Kỹ sư'} •{' '}
                          {emp.staffType === 'HANH_CHINH' ? 'Hành chính' : 'Giảng dạy'}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Ngạch {emp.salaryScale || 'V.07.01.03'} (HS {(emp.salaryCoefficient ?? 2.34).toFixed(2)})
                        </span>
                      </div>

                      {/* Cột 5: Trạng thái Face ID */}
                      <div className="w-full lg:w-auto min-w-0 flex items-center justify-between lg:justify-center shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase inline-flex items-center gap-1.5 shrink-0 ${
                            isRegistered
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Đã Có Face ID</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span>Chưa Đăng Ký</span>
                            </>
                          )}
                        </span>

                        {/* Cụm nút trên Mobile */}
                        <div className="lg:hidden flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailUser(emp)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(emp)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-400"
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cột 6: Thao tác */}
                      <div className="hidden lg:flex items-center justify-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDetailUser(emp)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Xem hồ sơ chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer"
                            title="Chỉnh sửa hồ sơ & Tải ảnh đại diện"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canCreateOrDelete && (
                          <button
                            type="button"
                            onClick={() => navigate('/face-registration')}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Đăng ký / Chụp lại khuôn mặt 5 góc"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canCreateOrDelete &&
                          String(emp._id) !== String(currentUser?._id || (currentUser as any)?.id) && (
                            <button
                              type="button"
                              onClick={() => handleToggleActiveStatus(emp)}
                              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer ${
                                emp.isActive === false
                                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                              title={emp.isActive === false ? 'Mở khóa tài khoản' : 'Khóa / Vô hiệu hóa tài khoản'}
                            >
                              {emp.isActive === false ? (
                                <Unlock className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : viewMode === 'grid' ? (
            /* ── CHẾ ĐỘ 2: THẺ LƯỚI TRỰC QUAN (CARD GRID VIEW) ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/20">
              {paginatedUsers.map((emp) => {
                const isRegistered = Boolean(emp.isFaceRegistered);
                const parsed = formatNameAndTitle(emp.fullName || '');
                const staffCodeVal =
                  emp.staffCode || emp.employeeCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = getDepartmentName(emp, departments);
                const roleMeta = getRoleMeta(emp.role);

                return (
                  <div
                    key={emp._id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <StaffAvatar
                            user={emp}
                            size="lg"
                            canUpload={canEdit}
                            onQuickUpload={handleQuickAvatarUpload}
                          />
                          <div className="min-w-0">
                            <h4
                              onClick={() => setDetailUser(emp)}
                              className="font-bold text-slate-900 dark:text-white hover:text-brand-600 text-sm truncate cursor-pointer"
                              title={parsed.name}
                            >
                              {parsed.name}
                            </h4>
                            <p
                              className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate"
                              title={parsed.title || (typeof emp.position === 'string' ? emp.position : '')}
                            >
                              {parsed.title || (typeof emp.position === 'string' && emp.position) || 'Cán bộ cơ hữu'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                            isRegistered
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Face ID</span>
                            </>
                          ) : (
                            <span>Chưa có</span>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Mã CB:</span>
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                            {staffCodeVal}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Vai trò:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                            {roleMeta.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 pt-0.5" title={deptNameVal}>
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] truncate font-medium">{deptNameVal}</span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0" title={emp.email}>
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{emp.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailUser(emp)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Hồ sơ</span>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(emp)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800/70 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'compact' ? (
            /* ── CHẾ ĐỘ 3: TINH GỌN SIÊU TỐC (COMPACT VIEW) ── */
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedUsers.map((emp) => {
                const isRegistered = Boolean(emp.isFaceRegistered);
                const parsed = formatNameAndTitle(emp.fullName || '');
                const staffCodeVal =
                  emp.staffCode || emp.employeeCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = getDepartmentName(emp, departments);
                const roleMeta = getRoleMeta(emp.role);

                return (
                  <div
                    key={emp._id}
                    className="px-3.5 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <StaffAvatar
                        user={emp}
                        size="sm"
                        canUpload={canEdit}
                        onQuickUpload={handleQuickAvatarUpload}
                      />

                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDetailUser(emp)}
                          className="font-bold text-slate-900 dark:text-white hover:text-brand-600 truncate max-w-[180px] sm:max-w-[240px] cursor-pointer"
                          title={parsed.name}
                        >
                          {parsed.name}
                        </button>
                        <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0">
                          {staffCodeVal}
                        </span>
                        <span
                          className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                          title={deptNameVal}
                        >
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                        <span className={`hidden md:inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                          {roleMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                          isRegistered
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="hidden sm:inline">{isRegistered ? 'Face ID' : 'Chưa ĐK'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setDetailUser(emp)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── CHẾ ĐỘ 4: PHÂN NHÓM THEO KHOA / ĐƠN VỊ (DEPARTMENT GROUPS) ── */
            <div className="p-3 sm:p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
              {paginatedDepartmentGroups.map((group) => {
                const isCollapsed = Boolean(collapsedDepts[group.deptName]);

                return (
                  <div
                    key={group.deptName}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden"
                  >
                    <div
                      onClick={() => toggleDeptCollapse(group.deptName)}
                      className="p-3.5 sm:px-4 sm:py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/90 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                            {group.deptName}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {group.total} cán bộ • {group.registeredCount} đã có Face ID ({group.percent}%)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${group.percent}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-9 text-right">
                            {group.percent}%
                          </span>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {group.members.map((emp) => {
                          const isRegistered = Boolean(emp.isFaceRegistered);
                          const parsed = formatNameAndTitle(emp.fullName || '');
                          const staffCodeVal =
                            emp.staffCode || emp.employeeCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                          const roleMeta = getRoleMeta(emp.role);

                          return (
                            <div
                              key={emp._id}
                              className="p-3 sm:px-4 sm:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <StaffAvatar
                                  user={emp}
                                  size="md"
                                  canUpload={canEdit}
                                  onQuickUpload={handleQuickAvatarUpload}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => setDetailUser(emp)}
                                      className="font-bold text-slate-900 dark:text-white hover:text-brand-600 truncate cursor-pointer"
                                    >
                                      {parsed.name}
                                    </button>
                                    <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0">
                                      {staffCodeVal}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                                      {roleMeta.label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {parsed.title ? `${parsed.title} • ` : ''}
                                    {emp.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    isRegistered
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  <span className="hidden sm:inline">{isRegistered ? 'Đã có Face ID' : 'Chưa có'}</span>
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setDetailUser(emp)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                >
                                  Chi tiết
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(emp)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-brand-600 hover:bg-brand-50 cursor-pointer"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 3. BỘ ĐIỀU HƯỚNG PHÂN TRANG CHUẨN (PAGINATION BAR) ─────────── */}
        {totalFilteredCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 text-xs text-slate-500 dark:text-slate-400">
            {/* Hiển thị phạm vi bản ghi */}
            <div className="flex items-center gap-2">
              <span>
                Hiển thị{' '}
                <strong className="text-slate-900 dark:text-white">
                  {(validCurrentPage - 1) * pageSize + 1}
                </strong>{' '}
                -{' '}
                <strong className="text-slate-900 dark:text-white">
                  {Math.min(validCurrentPage * pageSize, totalFilteredCount)}
                </strong>{' '}
                trên tổng số{' '}
                <strong className="text-brand-600 dark:text-brand-400">{totalFilteredCount}</strong> cán bộ, giảng viên
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Chọn số dòng trên mỗi trang */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>

              {/* Các nút bấm chuyển trang */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - validCurrentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span className="px-1 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            p === validCurrentPage
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. MODAL THÊM / CẬP NHẬT HỒ SƠ CÁN BỘ (CÓ UPLOAD AVATAR) ──────────── */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
                  {editingUser ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Cập Nhật Hồ Sơ Cán Bộ / Giảng Viên' : 'Thêm Mới Cán Bộ / Giảng Viên'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chuẩn hóa theo CSDL Nhân sự Đại học v2.5
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Khu vực Ảnh đại diện (Avatar Upload Banner) */}
            <div className="px-6 py-3.5 bg-slate-50/60 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base overflow-hidden shadow-xs ring-2 ring-white dark:ring-slate-800 shrink-0">
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt={formData.fullName || 'Avatar'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    getInitials(formData.fullName || 'CB')
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Ảnh đại diện cán bộ (Avatar)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Hỗ trợ JPG, PNG, WebP hoặc tự động đồng bộ từ ảnh chụp khuôn mặt Face ID
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={modalAvatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleModalAvatarFileSelect}
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => modalAvatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 transition-colors cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingAvatar ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                </button>
                {formData.avatar && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, avatar: '' }))}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 text-xs"
                    title="Xóa ảnh đại diện"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs chuyển đổi trong Modal */}
            <div className="px-6 pt-2 border-b border-slate-200 dark:border-slate-800 flex gap-2 bg-slate-50/40 dark:bg-slate-950/30">
              {[
                { id: 'basic', label: '1. Thông tin cơ bản & Đơn vị' },
                { id: 'academic', label: '2. Học hàm, Học vị & Biên chế' },
                { id: 'salary', label: '3. Ngạch lương & Phép năm' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveFormTab(t.id as any)}
                  className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeFormTab === t.id
                      ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
              {activeFormTab === 'basic' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Họ và tên đầy đủ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="VD: TS. Nguyễn Văn Minh"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã cán bộ / giảng viên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.staffCode}
                      onChange={(e) => setFormData({ ...formData, staffCode: e.target.value.toUpperCase() })}
                      placeholder="VD: GV005, TK003"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email công vụ (.edu.vn) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ten.donvi@university.edu.vn"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {editingUser ? 'Đổi mật khẩu mới (Để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? '••••••••' : 'Tối thiểu 6 ký tự'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số điện thoại liên hệ
                    </label>
                    <input
                      type="text"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder="VD: 0912345678"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Khoa / Bộ môn / Phòng ban <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.departmentId || ''}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      disabled={viewerRole === 'truongkhoa'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">-- Chọn đơn vị trực thuộc --</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vai trò hệ thống (RBAC) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setFormData({
                          ...formData,
                          role: newRole,
                          staffType: newRole === 'nhanvien' || newRole === 'admin' ? 'HANH_CHINH' : 'GIANG_VIEN',
                        });
                      }}
                      disabled={viewerRole === 'truongkhoa'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giới tính
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="NAM">Nam</option>
                      <option value="NU">Nữ</option>
                      <option value="KHAC">Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth || ''}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'academic' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Học hàm (Academic Rank)
                    </label>
                    <select
                      value={formData.academicRank}
                      onChange={(e) => setFormData({ ...formData, academicRank: e.target.value as AcademicRankType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {ACADEMIC_RANK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Học vị chuyên môn (Degree)
                    </label>
                    <select
                      value={formData.degree}
                      onChange={(e) => setFormData({ ...formData, degree: e.target.value as DegreeType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {DEGREE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chức danh / Chức vụ hiển thị
                    </label>
                    <input
                      type="text"
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="VD: Trưởng Khoa CNTT, Giảng viên chính..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Phân loại ngạch nhân sự
                    </label>
                    <select
                      value={formData.staffType}
                      onChange={(e) => setFormData({ ...formData, staffType: e.target.value as StaffType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {STAFF_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Loại hợp đồng lao động
                    </label>
                    <select
                      value={formData.contractType}
                      onChange={(e) => setFormData({ ...formData, contractType: e.target.value as ContractType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {CONTRACT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Trạng thái công tác
                    </label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) =>
                        setFormData({ ...formData, employmentStatus: e.target.value as EmploymentStatusType })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày vào trường công tác
                    </label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Địa chỉ thường trú / Liên hệ
                    </label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'salary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã ngạch viên chức / giảng viên (Chọn nhanh)
                    </label>
                    <select
                      value={formData.salaryScale}
                      onChange={(e) => {
                        const preset = SALARY_SCALE_PRESETS.find((p) => p.code === e.target.value);
                        setFormData({
                          ...formData,
                          salaryScale: e.target.value,
                          salaryCoefficient: preset ? preset.defaultCoeff : formData.salaryCoefficient,
                        });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {SALARY_SCALE_PRESETS.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Hệ số lương hiện hưởng
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="15"
                      value={formData.salaryCoefficient}
                      onChange={(e) => setFormData({ ...formData, salaryCoefficient: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số người phụ thuộc (Giảm trừ thuế TNCN)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={formData.dependentsCount}
                      onChange={(e) => setFormData({ ...formData, dependentsCount: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Quỹ nghỉ phép năm định mức (Ngày/năm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="45"
                      value={formData.annualLeaveQuota}
                      onChange={(e) => setFormData({ ...formData, annualLeaveQuota: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {editingUser && (
                    <div className="flex items-center pt-5">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive !== false}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Cho phép tài khoản đăng nhập hệ thống
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Modal */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  Mẹo: Bạn có thể chuyển qua lại giữa 3 tab trước khi nhấn Lưu.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <span>{editingUser ? 'Lưu Cập Nhật' : 'Tạo Hồ Sơ Cán Bộ'}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. DRAWER XEM CHI TIẾT HỒ SƠ CÁN BỘ 360° ────────────────────────── */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Banner Hồ sơ */}
            <div className="relative bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 p-6 text-white">
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <StaffAvatar
                  user={detailUser}
                  size="xl"
                  canUpload={canEdit}
                  onQuickUpload={handleQuickAvatarUpload}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono font-bold">
                      {detailUser.staffCode || detailUser.employeeCode || 'CHƯA CẤP MÃ'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-semibold">
                      {getRoleMeta(detailUser.role).label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mt-1 leading-snug">
                    {formatNameAndTitle(detailUser.fullName).name}
                  </h3>
                  <p className="text-xs text-blue-100/90 mt-0.5">
                    {formatNameAndTitle(detailUser.fullName).title ||
                      getDepartmentName(detailUser, departments)}
                  </p>
                </div>
              </div>
            </div>

            {/* Nội dung chi tiết */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Khối Sinh trắc học Face ID */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      detailUser.isFaceRegistered
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <ScanFace className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {detailUser.isFaceRegistered
                        ? 'Đã đăng ký Sinh trắc học Face ID (InsightFace 512D)'
                        : 'Chưa đăng ký dữ liệu khuôn mặt Face ID'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {detailUser.isFaceRegistered
                        ? `Số góc mặt: ${detailUser.sampleCount || 5}/5 góc chuẩn • Đã mã hóa AES-256-GCM`
                        : 'Cần đăng ký 5 góc khuôn mặt để chấm công AI'}
                    </div>
                  </div>
                </div>
                {canCreateOrDelete && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate('/face-registration')}
                      className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      {detailUser.isFaceRegistered ? 'Cập nhật' : 'Đăng ký ngay'}
                    </button>
                    {detailUser.isFaceRegistered && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailUser;
                          setDetailUser(null);
                          handleDeleteFaceData(target);
                        }}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        title="Xóa dữ liệu sinh trắc học Face ID"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Thông tin biên chế & học thuật */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Thông tin Học thuật & Công tác
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Đơn vị công tác</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {getDepartmentName(detailUser, departments)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Học hàm / Học vị</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {ACADEMIC_RANK_OPTIONS.find((a) => a.value === detailUser.academicRank)?.label || 'Không'} •{' '}
                      {DEGREE_OPTIONS.find((d) => d.value === detailUser.degree)?.label || 'Cử nhân'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Loại hình biên chế</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {CONTRACT_TYPE_OPTIONS.find((c) => c.value === detailUser.contractType)?.label ||
                        'Cơ hữu toàn thời gian'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Ngạch & Hệ số lương</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {detailUser.salaryScale || 'V.07.01.03'} (HS {(detailUser.salaryCoefficient ?? 2.34).toFixed(2)})
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Quỹ phép năm / Phụ thuộc</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {detailUser.annualLeaveQuota ?? 12} ngày phép • {detailUser.dependentsCount ?? 0} người phụ thuộc
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-slate-400 block mb-0.5">Ngày vào trường</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {detailUser.startDate
                        ? new Date(detailUser.startDate).toLocaleDateString('vi-VN')
                        : '15/01/2023'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thông tin liên hệ */}
              <div className="space-y-2.5 text-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Thông tin Liên hệ
                </h4>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{detailUser.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{detailUser.phoneNumber || detailUser.phone || 'Chưa cập nhật số điện thoại'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{detailUser.address || 'Trường Đại học Nguyễn Trãi - Hà Nội'}</span>
                </div>
              </div>
            </div>

            {/* Footer Drawer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 flex items-center justify-between gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailUser;
                    setDetailUser(null);
                    handleOpenEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer ml-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
