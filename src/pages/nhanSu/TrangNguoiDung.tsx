import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  Building2,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Camera,
  Upload,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { userApi } from '../../api/nguoiDung.api';
import { Button } from '../../components/chung/NutBam';
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
  RoleScopeType,
  UserRoleAssignmentPayload,
} from '../../types/index';
import { useAuthStore } from '../../stores/useXacThucStore';
import { normalizeRoleKey, hasRole } from '../../utils/phanQuyen';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { DepartmentSelect, getDeptCategory } from '../../components/chung/ChonDonVi';
import { Portal } from '../../components/chung/CongDichChuyen';
import { HoSoBenTrai, ThanhTabHoSo, TruongThongTin } from '../../components/chung/HoSoBenTrai';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';

// =============================================================================
// HẰNG SỐ VÀ BẢNG ÁNH XẠ CHUẨN ĐẠI HỌC (CSDL v2.5)
// =============================================================================

const ROLE_SCOPE_LABELS: Record<RoleScopeType, string> = {
  toan_truong: 'Toàn trường',
  khoa: 'Khoa',
  bo_mon: 'Bộ môn',
  phong_ban: 'Phòng ban',
};

const inferRoleScope = (
  role: string,
  deptId: string | null | undefined,
  departments: DepartmentItem[]
): RoleScopeType => {
  if (['admin', 'bgh', 'tccb', 'dao_tao', 'ke_toan', 'kiem_toan'].includes(role)) {
    return 'toan_truong';
  }
  const dept = deptId ? departments.find((d) => String(d._id) === String(deptId)) : null;
  if (dept?.type === 'bo_mon') return 'bo_mon';
  if (dept?.type === 'phong_ban') return 'phong_ban';
  return deptId ? 'khoa' : 'toan_truong';
};

const ROLE_OPTIONS = [
  { value: 'bgh', label: 'Ban Giám Hiệu (BGH)', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'admin', label: 'Quản trị Hệ thống / TCCB', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  { value: 'truong_khoa', label: 'Trưởng Khoa / Trưởng Đơn Vị', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'pho_khoa', label: 'Phó Trưởng Khoa', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  { value: 'truong_bo_mon', label: 'Trưởng Bộ Môn', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'pho_bo_mon', label: 'Phó Trưởng Bộ Môn', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' },
  { value: 'giang_vien', label: 'Giảng Viên', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'nhan_vien', label: 'Chuyên Viên Hành Chính', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
];

const ACADEMIC_RANK_OPTIONS: { value: AcademicRankType; label: string; short: string }[] = [
  { value: 'khong', label: 'Không có học hàm', short: '' },
  { value: 'pho_giao_su', label: 'Phó Giáo sư (PGS)', short: 'PGS.' },
  { value: 'giao_su', label: 'Giáo sư (GS)', short: 'GS.' },
];

const DEGREE_OPTIONS: { value: DegreeType; label: string; short: string }[] = [
  { value: 'cu_nhan', label: 'Cử nhân (CN)', short: 'CN.' },
  { value: 'ky_su', label: 'Kỹ sư (KS)', short: 'KS.' },
  { value: 'thac_si', label: 'Thạc sĩ (ThS)', short: 'ThS.' },
  { value: 'tien_si', label: 'Tiến sĩ (TS)', short: 'TS.' },
  { value: 'khac', label: 'Khác', short: '' },
];

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: 'giang_vien', label: 'Ngạch Giảng viên (Giảng dạy)' },
  { value: 'can_bo_quan_ly', label: 'Cán bộ quản lý' },
  { value: 'chuyen_vien', label: 'Chuyên viên' },
  { value: 'nhan_vien', label: 'Nhân viên / Hành chính' },
];

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'toan_thoi_gian', label: 'Cơ hữu toàn thời gian' },
  { value: 'ban_thoi_gian', label: 'Bán thời gian' },
  { value: 'thinh_giang', label: 'Giảng viên thỉnh giảng' },
  { value: 'hop_dong_vu_viec', label: 'Hợp đồng vụ việc' },
];

const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatusType; label: string; color: string }[] = [
  { value: 'dang_lam_viec', label: 'Đang làm việc', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'tam_nghi', label: 'Tạm nghỉ / Nghỉ thai sản / Đi học', color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  { value: 'da_nghi_viec', label: 'Đã nghỉ việc / Chuyển công tác', color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
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
  if (u.academicRank === 'giao_su') parts.push('GS.');
  else if (u.academicRank === 'pho_giao_su') parts.push('PGS.');

  if (u.degree === 'tien_si') parts.push('TS.');
  else if (u.degree === 'thac_si') parts.push('ThS.');
  else if (u.degree === 'ky_su') parts.push('KS.');
  return parts.join(' ');
};

const getDepartmentName = (u: UserProfile, departments: DepartmentItem[]): string => {
  if (u.departmentName && u.departmentName.trim()) return u.departmentName;

  const rawDept = u.departmentId || (u as any).don_vi_chinh_id || (u as any).don_vi_id;

  if (rawDept && typeof rawDept === 'object') {
    if ('name' in rawDept && rawDept.name) {
      return String(rawDept.name);
    }
    if ('ten_phong_ban' in rawDept && (rawDept as any).ten_phong_ban) {
      return String((rawDept as any).ten_phong_ban);
    }
    if ('_id' in rawDept && rawDept._id) {
      const found = departments.find((d) => String(d._id) === String(rawDept._id));
      if (found) return found.name || (found as any).ten_phong_ban || '';
    }
  }

  if (rawDept) {
    const idStr = String(rawDept);
    const found = departments.find((d) => String(d._id) === idStr);
    if (found) return found.name || (found as any).ten_phong_ban || '';
  }

  // Tra cứu theo danh sách vai trò nếu có
  if (Array.isArray(u.roles) && u.roles.length > 0) {
    const primaryRoleObj = u.roles[0];
    const roleDeptId = primaryRoleObj?.departmentId || (primaryRoleObj as any)?.don_vi_id;
    if (roleDeptId) {
      const idStr = typeof roleDeptId === 'object' && '_id' in roleDeptId ? String(roleDeptId._id) : String(roleDeptId);
      const found = departments.find((d) => String(d._id) === idStr);
      if (found) return found.name || (found as any).ten_phong_ban || '';
    }
  }

  return 'Chưa phân đơn vị';
};

const getDepartmentIdValue = (u: UserProfile): string => {
  const rawDept = u.departmentId || (u as any).don_vi_chinh_id || (u as any).don_vi_id;
  if (rawDept) {
    if (typeof rawDept === 'object' && '_id' in rawDept) {
      return String(rawDept._id);
    }
    return String(rawDept);
  }
  // Tra cứu theo danh sách vai trò nếu có
  if (Array.isArray(u.roles) && u.roles.length > 0) {
    const primaryRoleObj = u.roles[0];
    const roleDeptId = primaryRoleObj?.departmentId || (primaryRoleObj as any)?.don_vi_id;
    if (roleDeptId) {
      return typeof roleDeptId === 'object' && '_id' in roleDeptId ? String(roleDeptId._id) : String(roleDeptId);
    }
  }
  return '';
};

const isBghDept = (d?: DepartmentItem | null): boolean => {
  if (!d) return false;
  const name = (d.name || (d as any).ten_phong_ban || '').toLowerCase();
  const rawType = String(d.type || (d as any).loai_don_vi || '').toLowerCase();
  return name.includes('giám hiệu') || name.includes('ban giám hiệu') || name === 'bgh' || rawType === 'bgh';
};


const getAvatarGradient = (role?: string) => {
  const key = normalizeRoleKey(role);
  switch (key) {
    case 'bgh':
      return 'from-purple-600 to-indigo-600';
    case 'admin':
      return 'from-rose-500 to-orange-500';
    case 'truong_khoa':
    case 'pho_khoa':
      return 'from-blue-600 to-cyan-600';
    case 'truong_bo_mon':
    case 'pho_bo_mon':
      return 'from-indigo-600 to-blue-500';
    case 'giang_vien':
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
  const statusColor =
    user.isActive === false
      ? 'bg-rose-500'
      : user.isFaceRegistered
        ? 'bg-emerald-500'
        : 'bg-amber-400';

  return (
    <UserAvatar
      user={user}
      name={user.fullName}
      avatarUrl={user.avatar}
      staffCode={user.staffCode || user._id}
      size={size}
      shape="rounded"
      showStatusDot={true}
      statusColor={statusColor}
      canUpload={canUpload}
      onQuickUpload={onQuickUpload ? (file) => onQuickUpload(user, file) : undefined}
    />
  );
};

// =============================================================================
// COMPONENT CHÍNH: QUẢN LÝ DANH SÁCH CÁN BỘ & GIẢNG VIÊN (CHUẨN GIAO DIỆN)
// =============================================================================

export const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const viewerRole = normalizeRoleKey(currentUser?.role);
  const canCreateOrDelete = hasRole(currentUser, ['admin', 'bgh', 'tccb']);
  const canEdit = hasRole(currentUser, ['admin', 'bgh', 'tccb', 'truong_khoa']);

  // Kiểm tra phân cấp quyền khóa/vô hiệu hóa tài khoản (Peer & Hierarchy Protection)
  const canManageUserStatus = useCallback(
    (targetEmp: UserProfile) => {
      if (!canCreateOrDelete) return false;
      const currentId = String(currentUser?._id || (currentUser as any)?.id || '');
      const targetId = String(targetEmp._id || '');
      if (currentId && targetId && currentId === targetId) return false; // Không tự khóa chính mình

      const targetRole = normalizeRoleKey(targetEmp.role);
      // 1. Đối tượng là BGH: Chỉ BGH mới có quyền khóa/mở khóa
      if (targetRole === 'bgh') return viewerRole === 'bgh';
      // 2. Đối tượng là Admin: Admin không được khóa Admin cùng cấp (Chỉ BGH mới có quyền)
      if (targetRole === 'admin') return viewerRole === 'bgh';

      return true;
    },
    [canCreateOrDelete, currentUser, viewerRole]
  );

  // State dữ liệu
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

  // State bộ lọc & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'giang_vien' | 'leadership' | 'hanhchinh' | 'face_yes' | 'face_no'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Chế độ hiển thị (3 chế độ: Bảng, Thẻ lưới, Theo Khoa)
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'department'>(() => {
    const saved = localStorage.getItem('users_list_view_mode');
    if (saved === 'table' || saved === 'grid' || saved === 'department') {
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
  const [detailTab, setDetailTab] = useState<'chi_tiet' | 'face' | 'role'>('chi_tiet');

  useEffect(() => {
    if (detailUser) setDetailTab('chi_tiet');
  }, [detailUser?._id]);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'academic' | 'salary'>('basic');
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignmentPayload[]>([]);
  const [roleAssignmentsDirty, setRoleAssignmentsDirty] = useState(false);
  const modalAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateUserPayload & { isActive?: boolean }>({
    fullName: '',
    email: '',
    password: '',
    staffCode: '',
    role: 'giang_vien',
    departmentId: '',
    phoneNumber: '',
    position: 'Giảng viên',
    academicRank: 'khong',
    degree: 'thac_si',
    staffType: 'giang_vien',
    contractType: 'toan_thoi_gian',
    salaryScale: 'V.07.01.03',
    salaryCoefficient: 2.34,
    dependentsCount: 0,
    annualLeaveQuota: 12,
    gender: 'nam',
    dateOfBirth: '',
    startDate: new Date().toISOString().slice(0, 10),
    address: '',
    employmentStatus: 'dang_lam_viec',
    avatar: '',
    ngay_het_han_hop_dong: '',
    ngay_bat_dau_giang_day: '',
    so_cccd: '',
    ma_so_thue: '',
    so_tai_khoan_ngan_hang: '',
    ten_ngan_hang: '',
    chi_nhanh_ngan_hang: '',
    isActive: true,
  });

  const handleSetViewMode = (mode: 'table' | 'grid' | 'department') => {
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
      const [usersRes, deptsRes] = await Promise.allSettled([
        userApi.getUsers({ page: 1, limit: 200 }),
        userApi.getDepartments(),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
        const raw = usersRes.value.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any).users)
            ? (raw as any).users
            : [];
        setUsers(list);
      } else if (usersRes.status === 'rejected') {
        const err = usersRes.reason;
        toast.error(err?.response?.data?.message || 'Không thể tải danh sách cán bộ, giảng viên.');
      }

      if (deptsRes.status === 'fulfilled' && deptsRes.value?.data && Array.isArray(deptsRes.value.data)) {
        setDepartments(deptsRes.value.data);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải dữ liệu cán bộ.');
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
      return u.staffType === 'giang_vien' || ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(r);
    }).length;
    const leadershipCount = users.filter((u) =>
      ['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong'].includes(normalizeRoleKey(u.role))
    ).length;
    const adminStaffCount = users.filter((u) => {
      const r = normalizeRoleKey(u.role);
      return (
        u.staffType === 'nhan_vien' ||
        u.staffType === 'chuyen_vien' ||
        u.staffType === 'can_bo_quan_ly' ||
        r === 'nhan_vien' ||
        r === 'chuyen_vien' ||
        r === 'admin'
      );
    }).length;
    const pgsTsCount = users.filter(
      (u) => u.academicRank === 'giao_su' || u.academicRank === 'pho_giao_su' || u.degree === 'tien_si'
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
        const matchCode = (u.staffCode || '').toLowerCase().includes(q);
        const matchPhone = (u.phoneNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCode && !matchPhone) return false;
      }

      // 2. Lọc theo Tab
      const rKey = normalizeRoleKey(u.role);
      if (filterTab === 'giang_vien') {
        if (u.staffType !== 'giang_vien' && !['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(rKey)) {
          return false;
        }
      } else if (filterTab === 'leadership') {
        if (!['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong'].includes(rKey)) return false;
      } else if (filterTab === 'hanhchinh') {
        if (
          !['nhan_vien', 'chuyen_vien', 'can_bo_quan_ly'].includes(String(u.staffType || '')) &&
          rKey !== 'nhan_vien' &&
          rKey !== 'chuyen_vien' &&
          rKey !== 'admin'
        ) {
          return false;
        }
      } else if (filterTab === 'face_yes') {
        if (!u.isFaceRegistered) return false;
      } else if (filterTab === 'face_no') {
        if (u.isFaceRegistered) return false;
      }

      // 3. Lọc theo Khoa / Phòng ban
      if (departmentFilter !== 'ALL') {
        const deptId = getDepartmentIdValue(u);
        const selectedDept = departments.find((d) => String(d._id) === String(departmentFilter));
        const isBghFilter = selectedDept ? isBghDept(selectedDept) : false;

        if (isBghFilter) {
          const isUserBgh = normalizeRoleKey(u.role) === 'bgh' || deptId === departmentFilter;
          if (!isUserBgh) return false;
        } else {
          // 3.1 Khớp trực tiếp đơn vị chính
          const matchesDirect = deptId === departmentFilter;

          // 3.2 Khớp đơn vị cấp cha (khi lọc theo Khoa cha mà cán bộ thuộc Bộ môn con)
          const userDept = departments.find((d) => String(d._id) === String(deptId));
          const userParentId = userDept?.parentId
            ? typeof userDept.parentId === 'object' && userDept.parentId !== null && '_id' in userDept.parentId
              ? String((userDept.parentId as any)._id)
              : String(userDept.parentId)
            : '';
          const matchesParent = Boolean(userParentId && userParentId === departmentFilter);

          // 3.3 Khớp danh sách vai trò u.roles (nếu có gán đơn vị trực thuộc)
          const matchesRoles = Array.isArray(u.roles) && u.roles.some((r) => {
            const rDept = r.departmentId || (r as any).don_vi_id;
            if (!rDept) return false;
            const rId = typeof rDept === 'object' && rDept !== null && '_id' in rDept ? String((rDept as any)._id) : String(rDept);
            return rId === departmentFilter;
          });

          if (!matchesDirect && !matchesParent && !matchesRoles) {
            return false;
          }
        }
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

    const initialDeptId = viewerRole === 'truong_khoa' ? (getDepartmentIdValue(currentUser as any) || '') : '';

    setFormData({
      fullName: '',
      email: '',
      password: 'password123',
      staffCode: suggestedCode,
      role: 'giang_vien',
      departmentId: initialDeptId,
      phoneNumber: '',
      position: 'Giảng viên',
      academicRank: 'khong',
      degree: 'thac_si',
      staffType: 'giang_vien',
      contractType: 'toan_thoi_gian',
      salaryScale: 'V.07.01.03',
      salaryCoefficient: 2.34,
      dependentsCount: 0,
      annualLeaveQuota: 12,
      gender: 'nam',
      dateOfBirth: '',
      startDate: new Date().toISOString().slice(0, 10),
      address: '',
      employmentStatus: 'dang_lam_viec',
      avatar: '',
      ngay_het_han_hop_dong: '',
      ngay_bat_dau_giang_day: '',
      so_cccd: '',
      ma_so_thue: '',
      so_tai_khoan_ngan_hang: '',
      ten_ngan_hang: '',
      chi_nhanh_ngan_hang: '',
      isActive: true,
    });
    setRoleAssignments([]);
    setRoleAssignmentsDirty(false);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setActiveFormTab('basic');
    const todayIso = new Date().toISOString().slice(0, 10);
    const mappedRoles: UserRoleAssignmentPayload[] = Array.isArray(u.roles)
      ? u.roles.map((r: any) => {
          const code = normalizeRoleKey(r?.ma_vai_tro || r?.role || u.role);
          const rawDeptId =
            r?.don_vi_id && typeof r.don_vi_id === 'object'
              ? String(r.don_vi_id._id || r.don_vi_id.id || '')
              : r?.don_vi_id || r?.departmentId || '';
          const phamVi = (r?.pham_vi || r?.scope || inferRoleScope(code, rawDeptId, departments)) as RoleScopeType;
          return {
            ma_vai_tro: code,
            pham_vi: phamVi,
            don_vi_id: phamVi === 'toan_truong' ? null : rawDeptId || getDepartmentIdValue(u) || null,
            duoc_uy_quyen: Boolean(r?.duoc_uy_quyen),
            tu_ngay: r?.tu_ngay ? String(r.tu_ngay).slice(0, 10) : todayIso,
            den_ngay: r?.den_ngay ? String(r.den_ngay).slice(0, 10) : null,
          };
        })
      : [];
    setRoleAssignments(mappedRoles);
    setRoleAssignmentsDirty(false);
    setFormData({
      fullName: u.fullName || '',
      email: u.email || '',
      password: '',
      staffCode: u.staffCode || '',
      role: normalizeRoleKey(u.role),
      departmentId: getDepartmentIdValue(u),
      phoneNumber: u.phoneNumber || '',
      position: typeof u.position === 'string' ? u.position : '',
      academicRank: u.academicRank || 'khong',
      degree: u.degree || 'thac_si',
      staffType: u.staffType || (normalizeRoleKey(u.role) === 'nhan_vien' ? 'nhan_vien' : 'giang_vien'),
      contractType: u.contractType || 'toan_thoi_gian',
      salaryScale: u.salaryScale || 'V.07.01.03',
      salaryCoefficient: u.salaryCoefficient ?? 2.34,
      dependentsCount: u.dependentsCount ?? 0,
      annualLeaveQuota: u.annualLeaveQuota ?? 12,
      gender: u.gender || 'nam',
      dateOfBirth: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
      startDate: u.startDate ? String(u.startDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      address: u.address || '',
      employmentStatus: u.employmentStatus || 'dang_lam_viec',
      avatar: u.avatar || '',
      ngay_het_han_hop_dong: u.ngay_het_han_hop_dong ? String(u.ngay_het_han_hop_dong).slice(0, 10) : '',
      ngay_bat_dau_giang_day: u.ngay_bat_dau_giang_day ? String(u.ngay_bat_dau_giang_day).slice(0, 10) : '',
      so_cccd: u.so_cccd || '',
      ma_so_thue: u.ma_so_thue || '',
      so_tai_khoan_ngan_hang: u.so_tai_khoan_ngan_hang || '',
      ten_ngan_hang: u.ten_ngan_hang || '',
      chi_nhanh_ngan_hang: u.chi_nhanh_ngan_hang || '',
      isActive: u.isActive !== false,
    });
    setIsFormModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // XUẤT DANH SÁCH NHÂN SỰ RA FILE EXCEL (.XLSX)
  // ---------------------------------------------------------------------------
  const handleExportUsersExcel = () => {
    if (!filteredUsers.length) {
      toast.error('Không có dữ liệu nhân sự để xuất file Excel');
      return;
    }
    try {
      const dataRows = filteredUsers.map((u, i) => {
        const prefix = getAcademicPrefix(u);
        const academicDesc = [
          ACADEMIC_RANK_OPTIONS.find((r) => r.value === u.academicRank)?.label || '',
          DEGREE_OPTIONS.find((d) => d.value === u.degree)?.label || '',
        ].filter(Boolean).join(' - ') || 'Không';

        const roleMeta = getRoleMeta(u.role);
        const deptName = getDepartmentName(u, departments);
        const contractDesc = CONTRACT_TYPE_OPTIONS.find((c) => c.value === u.contractType)?.label || u.contractType || '--';
        const empStatusDesc = EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === u.employmentStatus)?.label || 'Đang công tác';

        return {
          'STT': i + 1,
          'Mã Cán Bộ': u.staffCode || '--',
          'Họ Và Tên': prefix ? `${prefix} ${u.fullName}` : u.fullName,
          'Chức Danh / Vị Trí': u.position || '--',
          'Khoa / Phòng Ban': deptName,
          'Vai Trò Hệ Thống': roleMeta.label,
          'Email Công Vụ': u.email,
          'Số Điện Thoại': u.phoneNumber || '--',
          'Học Hàm & Học Vị': academicDesc,
          'Loại Nhân Sự': u.staffType === 'giang_vien' ? 'Giảng viên' : 'Hành chính',
          'Loại Hợp Đồng': contractDesc,
          'Ngạch Lương': u.salaryScale || '--',
          'Hệ Số Lương': u.salaryCoefficient || 2.34,
          'Người Phụ Thuộc': u.dependentsCount || 0,
          'Phép Năm': `${u.annualLeaveQuota || 12} ngày`,
          'Sinh Trắc Học Face ID': u.isFaceRegistered ? 'Đã đăng ký (512D)' : 'Chưa đăng ký',
          'Tình Trạng Công Tác': empStatusDesc,
          'Trạng Thái Hoạt Động': u.isActive !== false ? 'Đang hoạt động' : 'Đã khóa',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 22 },
        { wch: 28 },
        { wch: 24 },
        { wch: 28 },
        { wch: 15 },
        { wch: 28 },
        { wch: 14 },
        { wch: 22 },
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 },
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Cán Bộ');

      XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_NTU_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Đã xuất Danh sách nhân sự (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Danh sách nhân sự:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // ---------------------------------------------------------------------------
  // ĐỒNG BỘ THÔNG MINH 2 CHIỀU: ĐƠN VỊ & VAI TRÒ HỆ THỐNG (RBAC)
  // ---------------------------------------------------------------------------
  const handleDepartmentChange = (deptId: string) => {
    const selectedDept = departments.find((d) => String(d._id) === String(deptId));
    let newRole = formData.role;
    let newStaffType = formData.staffType;
    let newPosition = formData.position;

    if (selectedDept) {
      const cat = getDeptCategory(selectedDept);
      if (cat === 'bgh') {
        newRole = 'bgh';
        newStaffType = 'can_bo_quan_ly';
        newPosition = formData.position && !['Giảng viên', 'Chuyên viên'].includes(formData.position) ? formData.position : 'Hiệu trưởng';
      } else if (cat === 'khoa') {
        if (['bgh', 'truong_bo_mon', 'admin'].includes(newRole)) {
          newRole = 'giang_vien';
          newStaffType = 'giang_vien';
          newPosition = 'Giảng viên';
        }
      } else if (cat === 'bo_mon' || cat === 'bomon') {
        if (['bgh', 'truong_khoa', 'pho_khoa', 'nhan_vien', 'admin'].includes(newRole)) {
          newRole = 'giang_vien';
          newStaffType = 'giang_vien';
          newPosition = 'Giảng viên';
        }
      } else if (cat === 'phong_ban' || cat === 'phongban') {
        if (['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'giang_vien'].includes(newRole)) {
          newRole = 'nhan_vien';
          newStaffType = 'chuyen_vien';
          newPosition = 'Chuyên viên';
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      departmentId: deptId,
      role: newRole,
      staffType: newStaffType,
      position: newPosition,
    }));
  };

  const handleRoleChange = (newRole: string) => {
    let newDeptId = formData.departmentId;
    let newStaffType: StaffType =
      newRole === 'bgh'
        ? 'can_bo_quan_ly'
        : newRole === 'nhan_vien' || newRole === 'admin'
          ? 'chuyen_vien'
          : 'giang_vien';
    let newPosition = formData.position;

    const currentDept = departments.find((d) => String(d._id) === String(newDeptId));
    const currentCat = currentDept ? getDeptCategory(currentDept) : null;

    if (newRole === 'bgh') {
      const bghDept = departments.find((d) => getDeptCategory(d) === 'bgh');
      newDeptId = bghDept ? bghDept._id : '';
      newPosition = 'Lãnh đạo Ban Giám Hiệu';
    } else if (newRole === 'admin') {
      const adminDept = departments.find(
        (d) =>
          (d.name || '').toLowerCase().includes('quản trị') ||
          (d.name || '').toLowerCase().includes('hành chính')
      ) || departments.find((d) => getDeptCategory(d) === 'phongban');
      newDeptId = adminDept ? adminDept._id : '';
      newPosition = 'Quản trị viên hệ thống';
    } else if (newRole === 'truong_khoa' || newRole === 'pho_khoa') {
      if (currentCat !== 'khoa') {
        const firstKhoa = departments.find((d) => getDeptCategory(d) === 'khoa');
        newDeptId = firstKhoa ? firstKhoa._id : '';
      }
      newPosition = newRole === 'truong_khoa' ? 'Trưởng Khoa' : 'Phó Trưởng Khoa';
    } else if (newRole === 'truong_bo_mon') {
      if (currentCat !== 'bo_mon' && currentCat !== 'bomon') {
        const firstBomon = departments.find((d) => getDeptCategory(d) === 'bo_mon');
        newDeptId = firstBomon ? firstBomon._id : '';
      }
      newPosition = 'Trưởng Bộ Môn';
    } else if (newRole === 'giang_vien') {
      if (currentCat === 'bgh' || currentCat === 'phong_ban' || currentCat === 'phongban') {
        const firstKhoa = departments.find((d) => getDeptCategory(d) === 'khoa');
        newDeptId = firstKhoa ? firstKhoa._id : '';
      }
      newPosition = 'Giảng viên';
    } else if (newRole === 'nhan_vien') {
      if (currentCat === 'bgh' || currentCat === 'bo_mon' || currentCat === 'bomon' || currentCat === 'khoa') {
        const firstPhong = departments.find((d) => getDeptCategory(d) === 'phong_ban');
        newDeptId = firstPhong ? firstPhong._id : '';
      }
      newPosition = 'Chuyên viên';
    }

    setFormData((prev) => ({
      ...prev,
      role: newRole,
      departmentId: newDeptId,
      staffType: newStaffType as any,
      position: newPosition,
    }));
  };

  const availableRoleOptions = useMemo(() => {
    // Trưởng khoa chỉ được chọn phân quyền cán bộ/giảng viên thuộc khoa
    if (viewerRole === 'truong_khoa') {
      return ROLE_OPTIONS.filter((r) => ['giang_vien', 'nhan_vien'].includes(r.value));
    }
    // Admin và Ban Giám Hiệu có quyền chọn bất kỳ vai trò nào
    return ROLE_OPTIONS;
  }, [viewerRole]);


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
    if (!formData.departmentId) {
      toast.error('Vui lòng chọn Khoa / Bộ môn / Phòng ban trực thuộc.');
      return;
    }

    const selectedDept = departments.find((d) => d._id === formData.departmentId);
    if (selectedDept) {
      if (formData.role === 'bgh' && !isBghDept(selectedDept)) {
        toast.error('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.');
        return;
      }
      if (['truong_khoa', 'pho_khoa'].includes(formData.role) && selectedDept.type !== 'khoa') {
        toast.error('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.');
        return;
      }
      if (['truong_bo_mon', 'pho_bo_mon'].includes(formData.role) && selectedDept.type !== 'bo_mon' && selectedDept.type !== 'bomon') {
        toast.error('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.');
        return;
      }
      if (formData.role === 'giang_vien' && selectedDept.type !== 'bo_mon' && selectedDept.type !== 'bomon') {
        toast.error('Giảng viên bắt buộc phải trực thuộc một Bộ Môn cụ thể.');
        return;
      }
      if (formData.role === 'admin' && (selectedDept.type === 'khoa' || selectedDept.type === 'bo_mon' || selectedDept.type === 'bomon')) {
        toast.error('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU.');
        return;
      }
      if (isBghDept(selectedDept) && !['bgh', 'admin'].includes(formData.role)) {
        toast.error('Đơn vị Ban Giám Hiệu chỉ dành cho nhân sự thuộc Ban Giám Hiệu hoặc Quản trị viên cấp trường.');
        return;
      }
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const primaryDeptId = formData.departmentId || null;
    const primaryScope = inferRoleScope(formData.role, primaryDeptId, departments);
    let preparedRoleAssignments: UserRoleAssignmentPayload[] | undefined;

    if (viewerRole !== 'truong_khoa' && roleAssignmentsDirty && roleAssignments.length > 0) {
      const normalizedRows = roleAssignments.map((r) => ({
        ...r,
        don_vi_id: r.pham_vi === 'toan_truong' ? null : r.don_vi_id || primaryDeptId,
      }));
      const seenKeys = new Set<string>();
      for (const row of normalizedRows) {
        const key = `${row.ma_vai_tro}::${row.don_vi_id || 'ALL'}`;
        if (seenKeys.has(key)) {
          toast.error('Danh sách vai trò bị trùng vai trò và đơn vị. Vui lòng chọn vai trò hoặc đơn vị khác.');
          return;
        }
        seenKeys.add(key);
      }

      const primaryKey = `${formData.role}::${(primaryScope === 'toan_truong' ? null : primaryDeptId) || 'ALL'}`;
      const matchedPrimary = normalizedRows.find(
        (r) => `${r.ma_vai_tro}::${r.don_vi_id || 'ALL'}` === primaryKey
      );
      preparedRoleAssignments = [
        {
          ma_vai_tro: formData.role,
          pham_vi: primaryScope,
          don_vi_id: primaryScope === 'toan_truong' ? null : primaryDeptId,
          duoc_uy_quyen: Boolean(matchedPrimary?.duoc_uy_quyen),
          tu_ngay: matchedPrimary?.tu_ngay || todayIso,
          den_ngay: matchedPrimary?.den_ngay || null,
        },
        ...normalizedRows.filter(
          (r) => `${r.ma_vai_tro}::${r.don_vi_id || 'ALL'}` !== primaryKey
        ),
      ];
    }

    setSubmitting(true);
    try {

      if (editingUser) {
        const updatePayload: UpdateUserPayload = {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          staffCode: formData.staffCode.trim().toUpperCase(),
          role: formData.role,
          departmentId: primaryDeptId,
          ...(preparedRoleAssignments ? { danh_sach_vai_tro: preparedRoleAssignments } : {}),
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
          ngay_het_han_hop_dong: formData.ngay_het_han_hop_dong || null,
          ngay_bat_dau_giang_day: formData.ngay_bat_dau_giang_day || null,
          so_cccd: formData.so_cccd?.trim() || null,
          ma_so_thue: formData.ma_so_thue?.trim() || null,
          so_tai_khoan_ngan_hang: formData.so_tai_khoan_ngan_hang?.trim() || null,
          ten_ngan_hang: formData.ten_ngan_hang?.trim() || null,
          chi_nhanh_ngan_hang: formData.chi_nhanh_ngan_hang?.trim() || null,
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
          departmentId: primaryDeptId,
          avatar: formData.avatar?.trim() || null,
          ...(preparedRoleAssignments ? { danh_sach_vai_tro: preparedRoleAssignments } : {}),
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
        await userApi.updateUser(u._id, { isActive: true, employmentStatus: 'dang_lam_viec' });
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
      {/* ── 0. TIÊU ĐỀ TRANG ── */}
      <PageHeader
        title="Danh Sách Cán Bộ & Giảng Viên"
        subtitle="Quản lý hồ sơ viên chức, đơn vị công tác và trạng thái Face ID."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAllData}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />}
              title="Làm mới dữ liệu hồ sơ"
            >
              <span className="hidden sm:inline">Làm mới</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportUsersExcel}
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất danh sách nhân sự ra file Excel (.xlsx)"
            >
              <span className="hidden sm:inline">Xuất Excel</span>
            </Button>

            {canCreateOrDelete && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenCreateModal}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Thêm Cán Bộ
              </Button>
            )}
          </div>
        }
      />

      {/* ── UNIFIED STAFF WORKSPACE: KPI STRIP + TOOLBAR + DATA TABLE ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
        <CompactStatsBar
          embedded
          items={[
            { label: 'Tổng cán bộ', value: stats.total, badge: `${stats.activeCount} công tác`, tone: 'brand' },
            { label: 'Khối giảng dạy', value: stats.lecturerCount, badge: `${stats.pgsTsCount} PGS/TS`, tone: 'neutral' },
            { label: 'Đã có Face ID', value: `${stats.faceRegCount}/${stats.total}`, badge: `${stats.facePercent}%`, tone: 'success' },
            { label: 'Khoa / Phòng ban', value: departments.length, badge: `${stats.leadershipCount} lãnh đạo`, tone: 'neutral' },
          ]}
        />
        {/* Thanh công cụ tìm kiếm & lọc 1 hàng */}
        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm tên cán bộ, mã CB, email, SĐT..."
              className="w-full h-9 pl-9 pr-7 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc Khoa / Đơn vị */}
          <div className="w-full sm:w-56 shrink-0">
            <DepartmentSelect
              departments={departments}
              value={departmentFilter}
              onChange={(val) => {
                setDepartmentFilter(val || 'ALL');
                setFilterTab('all');
                setCurrentPage(1);
              }}
              size="sm"
              allowAll={true}
              allLabel={`Tất cả đơn vị (${departments.length})`}
              placeholder="Lọc theo đơn vị..."
            />
          </div>

          {/* Phân loại cán bộ */}
          <div className="relative h-9 shrink-0">
            <select
              value={filterTab}
              onChange={(e) => {
                setFilterTab(e.target.value as any);
                setCurrentPage(1);
              }}
              className="h-9 appearance-none pl-3 pr-7 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 cursor-pointer"
              aria-label="Phân loại cán bộ"
            >
              <option value="all">Tất cả ({stats.total})</option>
              <option value="giang_vien">Khối Giảng dạy ({stats.lecturerCount})</option>
              <option value="leadership">Lãnh đạo ({stats.leadershipCount})</option>
              <option value="hanhchinh">Khối Hành chính ({stats.adminStaffCount})</option>
              <option value="face_yes">Đã có Face ID ({stats.faceRegCount})</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Chế độ xem */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 h-9 shrink-0">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`h-full flex items-center gap-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Bảng"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`h-full flex items-center gap-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Thẻ lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lưới</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('department')}
              className={`h-full flex items-center gap-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'department'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Theo Khoa / Đơn vị"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Đơn vị</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap">
            {filteredUsers.length} / {users.length} cán bộ
          </span>
        </div>

        {/* Khung Hiển Thị Danh Sách Cán Bộ */}
        <div className="overflow-hidden w-full">
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
              <div className="hidden lg:grid grid-cols-[1.6fr_1.1fr_1.25fr_1fr_130px_145px] gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
                <div className="min-w-0">Cán bộ / Giảng viên</div>
                <div className="min-w-0">Mã CB &amp; Liên hệ</div>
                <div className="min-w-0">Khoa / Đơn vị &amp; Vai trò</div>
                <div className="min-w-0">Học hàm • Ngạch lương</div>
                <div className="text-center">Face ID / Trạng thái</div>
                <div className="text-right">Thao tác</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedUsers.map((emp) => {
                  const isRegistered = Boolean(emp.isFaceRegistered);
                  const parsed = formatNameAndTitle(emp.fullName || '');
                  const staffCodeVal =
                    emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
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
                          <div className="flex flex-col min-w-0 flex-1 leading-snug">
                            <button
                              type="button"
                              onClick={() => setDetailUser(emp)}
                              className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 text-sm truncate text-left transition-colors cursor-pointer"
                              title={parsed.name}
                            >
                              {parsed.name}
                            </button>
                            <span
                              className="text-xs text-slate-500 dark:text-slate-400 truncate block"
                              title={parsed.title || (typeof emp.position === 'string' ? emp.position : '')}
                            >
                              {parsed.title || (typeof emp.position === 'string' && emp.position) || 'Cán bộ cơ hữu'}
                            </span>
                          </div>
                        </div>

                        <span className="lg:hidden text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/70 shrink-0 tabular-nums">
                          {staffCodeVal}
                        </span>
                      </div>

                      {/* Cột 2: Mã CB / Email */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5 leading-snug">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums truncate">
                          {staffCodeVal}
                        </span>
                        <span
                          className="text-xs text-slate-500 dark:text-slate-400 truncate block"
                          title={emp.email}
                        >
                          {emp.email}
                        </span>
                      </div>

                      {/* Cột 3: Khoa / Đơn vị & Vai trò */}
                      <div className="w-full lg:w-auto min-w-0 flex flex-col gap-1 leading-snug">
                        <span
                          className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium text-sm max-w-full min-w-0"
                          title={deptNameVal}
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.label}
                        </span>
                      </div>

                      {/* Cột 4: Học hàm / Ngạch lương */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5 leading-snug">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {academicPrefix || 'Cử nhân / Kỹ sư'} •{' '}
                          {emp.staffType === 'giang_vien' ? 'Giảng dạy' : 'Hành chính'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          Ngạch {emp.salaryScale || 'V.07.01.03'} (HS {(emp.salaryCoefficient ?? 2.34).toFixed(2)})
                        </span>
                      </div>

                      {/* Cột 5: Trạng thái Face ID */}
                      <div className="w-full lg:w-auto min-w-0 flex items-center justify-between lg:justify-center shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 border ${
                            isRegistered
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Đã có Face ID</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span>Chưa đăng ký</span>
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
                            onClick={() => navigate('/dang-ky-khuon-mat')}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Đăng ký / Chụp lại khuôn mặt 5 góc"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canManageUserStatus(emp) && (
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
                  emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
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
          ) : (
            /* ── CHẾ ĐỘ 3: PHÂN NHÓM THEO KHOA / ĐƠN VỊ (DEPARTMENT GROUPS) ── */
            <div className="p-3 sm:p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
              {departmentGroups.map((group) => {
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
                            emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
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
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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

            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
              {/* Cột trái: Ảnh đại diện & thông tin tóm tắt */}
              <HoSoBenTrai
                className="md:w-64 md:shrink-0 md:border-r border-b md:border-b-0 bg-slate-50/60 dark:bg-slate-900/80 max-h-56 md:max-h-none"
                anhDaiDien={
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl overflow-hidden shadow-md ring-4 ring-white dark:ring-slate-800">
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
                      title="Tải ảnh từ máy"
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                }
                maCanBo={formData.staffCode || (editingUser ? '' : 'MÃ MỚI')}
                trangThai={editingUser ? 'Đang cập nhật hồ sơ' : 'Thêm mới hồ sơ'}
                hoTen={formData.fullName || 'Cán bộ / Giảng viên'}
                lienHe={[
                  { icon: <Mail className="w-3.5 h-3.5" />, text: formData.email || 'Chưa nhập email' },
                  {
                    icon: <Phone className="w-3.5 h-3.5" />,
                    text: (formData as any).phoneNumber || 'Chưa nhập số điện thoại',
                  },
                ]}
                thaoTac={
                  <>
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => modalAvatarInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingAvatar ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                    </button>
                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, avatar: '' }))}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa ảnh đại diện</span>
                      </button>
                    )}
                  </>
                }
              />

              {/* Cột phải: Tab + Form */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <ThanhTabHoSo
                  active={activeFormTab}
                  onChange={(id) => setActiveFormTab(id as 'basic' | 'academic' | 'salary')}
                  tabs={[
                    { id: 'basic', label: 'Thông tin cơ bản & Đơn vị' },
                    { id: 'academic', label: 'Học hàm, Học vị & Biên chế' },
                    { id: 'salary', label: 'Ngạch lương & Phép năm' },
                  ]}
                />

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
                      Vai trò hệ thống (RBAC) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      disabled={viewerRole === 'truong_khoa'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {availableRoleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Khoa / Bộ môn / Phòng ban <span className="text-rose-500">*</span>
                    </label>
                    <DepartmentSelect
                      departments={departments}
                      value={formData.departmentId}
                      onChange={handleDepartmentChange}
                      role={formData.role}
                      disabled={viewerRole === 'truong_khoa' || formData.role === 'bgh'}
                      required
                    />
                    {formData.role === 'bgh' && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1">
                        * Cán bộ Ban Giám Hiệu (BGH) được tự động cố định tại Hội Đồng Trường & Ban Giám Hiệu.
                      </p>
                    )}
                    {formData.role === 'admin' && (
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                        * Quản trị viên (Admin) có thể thuộc Hội Đồng Trường hoặc các Ban chức năng của NTU.
                      </p>
                    )}
                  </div>

                  {viewerRole !== 'truong_khoa' && (
                    <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              Vai trò kiêm nhiệm &amp; Ủy quyền duyệt (VaiTroNguoiDung)
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Vai trò chính được tự động gán; thêm dòng nếu cán bộ kiêm nhiệm hoặc được ủy quyền duyệt đơn.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const todayIso = new Date().toISOString().slice(0, 10);
                            const baseScope = inferRoleScope(formData.role, formData.departmentId, departments);
                            const seed: UserRoleAssignmentPayload[] =
                              roleAssignments.length > 0
                                ? roleAssignments
                                : [
                                    {
                                      ma_vai_tro: formData.role,
                                      pham_vi: baseScope,
                                      don_vi_id: baseScope === 'toan_truong' ? null : formData.departmentId || null,
                                      duoc_uy_quyen: false,
                                      tu_ngay: todayIso,
                                      den_ngay: null,
                                    },
                                  ];
                            setRoleAssignments([
                              ...seed,
                              {
                                ma_vai_tro: formData.role === 'pho_khoa' ? 'giang_vien' : 'pho_khoa',
                                pham_vi: formData.departmentId ? 'khoa' : 'toan_truong',
                                don_vi_id: formData.departmentId || null,
                                duoc_uy_quyen: false,
                                tu_ngay: todayIso,
                                den_ngay: null,
                              },
                            ]);
                            setRoleAssignmentsDirty(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm vai trò</span>
                        </button>
                      </div>

                      {roleAssignments.length > 0 && (
                        <div className="space-y-2">
                          {roleAssignments.map((ra, rIdx) => (
                            <div
                              key={rIdx}
                              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                            >
                              <div className="sm:col-span-3">
                                <select
                                  value={ra.ma_vai_tro}
                                  onChange={(e) => {
                                    const nextRole = e.target.value;
                                    setRoleAssignments((prev) =>
                                      prev.map((item, idx) =>
                                        idx === rIdx ? { ...item, ma_vai_tro: nextRole } : item
                                      )
                                    );
                                    setRoleAssignmentsDirty(true);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                >
                                  {availableRoleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <select
                                  value={ra.pham_vi}
                                  onChange={(e) => {
                                    const nextScope = e.target.value as RoleScopeType;
                                    setRoleAssignments((prev) =>
                                      prev.map((item, idx) =>
                                        idx === rIdx
                                          ? {
                                              ...item,
                                              pham_vi: nextScope,
                                              don_vi_id: nextScope === 'toan_truong' ? null : item.don_vi_id || formData.departmentId || null,
                                            }
                                          : item
                                      )
                                    );
                                    setRoleAssignmentsDirty(true);
                                  }}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                >
                                  {Object.entries(ROLE_SCOPE_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <select
                                  disabled={ra.pham_vi === 'toan_truong'}
                                  value={ra.pham_vi === 'toan_truong' ? '' : ra.don_vi_id || ''}
                                  onChange={(e) => {
                                    const nextDept = e.target.value || null;
                                    setRoleAssignments((prev) =>
                                      prev.map((item, idx) =>
                                        idx === rIdx ? { ...item, don_vi_id: nextDept } : item
                                      )
                                    );
                                    setRoleAssignmentsDirty(true);
                                  }}
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                                >
                                  <option value="">{ra.pham_vi === 'toan_truong' ? 'Toàn trường' : '-- Chọn đơn vị --'}</option>
                                  {departments.map((d) => (
                                    <option key={d._id} value={d._id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-2 flex items-center gap-1.5">
                                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(ra.duoc_uy_quyen)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setRoleAssignments((prev) =>
                                        prev.map((item, idx) =>
                                          idx === rIdx ? { ...item, duoc_uy_quyen: checked } : item
                                        )
                                      );
                                      setRoleAssignmentsDirty(true);
                                    }}
                                    className="w-3.5 h-3.5 rounded text-brand-600"
                                  />
                                  <span>Ủy quyền</span>
                                </label>
                              </div>

                              <div className="sm:col-span-2 flex items-center justify-end gap-1">
                                <input
                                  type="date"
                                  title="Hiệu lực đến ngày (bỏ trống = vô thời hạn)"
                                  value={ra.den_ngay || ''}
                                  onChange={(e) => {
                                    const nextEnd = e.target.value || null;
                                    setRoleAssignments((prev) =>
                                      prev.map((item, idx) =>
                                        idx === rIdx ? { ...item, den_ngay: nextEnd } : item
                                      )
                                    );
                                    setRoleAssignmentsDirty(true);
                                  }}
                                  className="w-full px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRoleAssignments((prev) => {
                                      const next = prev.filter((_, idx) => idx !== rIdx);
                                      if (next.length === 0) setRoleAssignmentsDirty(false);
                                      return next;
                                    });
                                    if (roleAssignments.length > 1) setRoleAssignmentsDirty(true);
                                  }}
                                  title="Xóa dòng vai trò này"
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giới tính
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="nam">Nam</option>
                      <option value="nu">Nữ</option>
                      <option value="khac">Khác</option>
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số CCCD / CMND
                    </label>
                    <input
                      type="text"
                      value={formData.so_cccd || ''}
                      onChange={(e) => setFormData({ ...formData, so_cccd: e.target.value })}
                      placeholder="VD: 001201012345"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chức vụ / Chức danh
                    </label>
                    <input
                      type="text"
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="VD: Giảng viên chính, Trưởng bộ môn..."
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
                      Ngày bắt đầu giảng dạy
                    </label>
                    <input
                      type="date"
                      value={formData.ngay_bat_dau_giang_day || ''}
                      onChange={(e) => setFormData({ ...formData, ngay_bat_dau_giang_day: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày hết hạn hợp đồng
                    </label>
                    <input
                      type="date"
                      value={formData.ngay_het_han_hop_dong || ''}
                      onChange={(e) => setFormData({ ...formData, ngay_het_han_hop_dong: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã số thuế cá nhân
                    </label>
                    <input
                      type="text"
                      value={formData.ma_so_thue || ''}
                      onChange={(e) => setFormData({ ...formData, ma_so_thue: e.target.value })}
                      placeholder="VD: 8123456789"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số tài khoản ngân hàng
                    </label>
                    <input
                      type="text"
                      value={formData.so_tai_khoan_ngan_hang || ''}
                      onChange={(e) => setFormData({ ...formData, so_tai_khoan_ngan_hang: e.target.value })}
                      placeholder="VD: 1903..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tên ngân hàng
                    </label>
                    <input
                      type="text"
                      value={formData.ten_ngan_hang || ''}
                      onChange={(e) => setFormData({ ...formData, ten_ngan_hang: e.target.value })}
                      placeholder="VD: Vietcombank, BIDV, Techcombank..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chi nhánh ngân hàng
                    </label>
                    <input
                      type="text"
                      value={formData.chi_nhanh_ngan_hang || ''}
                      onChange={(e) => setFormData({ ...formData, chi_nhanh_ngan_hang: e.target.value })}
                      placeholder="VD: Chi nhánh Hà Nội"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          </div>
        </div>
        </Portal>
      )}

      {/* ── 5. POPUP XEM CHI TIẾT HỒ SƠ CÁN BỘ (BỐ CỤC 2 CỘT + TAB) ────────────────────────── */}
      {detailUser && (
        <Portal>
          <div
            onClick={() => setDetailUser(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Hồ sơ nhân viên</h3>
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-1 min-h-0 flex-col md:flex-row">
                <HoSoBenTrai
                  className="md:w-64 md:shrink-0 md:border-r border-b md:border-b-0 bg-slate-50/60 dark:bg-slate-900/80 max-h-60 md:max-h-none"
                  anhDaiDien={
                    <StaffAvatar
                      user={detailUser}
                      size="xl"
                      canUpload={canEdit}
                      onQuickUpload={handleQuickAvatarUpload}
                    />
                  }
                  maCanBo={detailUser.staffCode || 'CHƯA CẤP MÃ'}
                  trangThai={
                    EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === detailUser.employmentStatus)?.label ||
                    'Đang làm việc'
                  }
                  trangThaiHoatDong={detailUser.employmentStatus !== 'da_nghi_viec' && detailUser.isActive !== false}
                  hoTen={formatNameAndTitle(detailUser.fullName).name}
                  thongTinChinh={[
                    {
                      icon: <Building2 className="w-3.5 h-3.5" />,
                      text: getDepartmentName(detailUser, departments),
                    },
                    {
                      icon: <UsersIcon className="w-3.5 h-3.5" />,
                      text: formatNameAndTitle(detailUser.fullName).title || getRoleMeta(detailUser.role).label,
                    },
                  ]}
                  lienHe={[
                    { icon: <Phone className="w-3.5 h-3.5" />, text: detailUser.phoneNumber || 'Chưa cập nhật' },
                    { icon: <Mail className="w-3.5 h-3.5" />, text: detailUser.email },
                  ]}
                  cacNhomPhu={[
                    {
                      tieuDe: 'Ngày vào trường',
                      noiDung: detailUser.startDate
                        ? new Date(detailUser.startDate).toLocaleDateString('vi-VN')
                        : 'Chưa cập nhật',
                    },
                    { tieuDe: 'Vai trò chính', noiDung: getRoleMeta(detailUser.role).label },
                  ]}
                />

                <div className="flex-1 min-w-0 flex flex-col min-h-0">
                  <ThanhTabHoSo
                    active={detailTab}
                    onChange={(id) => setDetailTab(id as typeof detailTab)}
                    tabs={[
                      { id: 'chi_tiet', label: 'Chi tiết hồ sơ' },
                      { id: 'face', label: 'Sinh trắc học Face ID' },
                      { id: 'role', label: 'Phân quyền & Tài khoản' },
                    ]}
                  />

                  <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs">
                    {(() => {
                      const Field = TruongThongTin;
                      const grid = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4';
                      const fmtDate = (v?: string | null) =>
                        v ? new Date(v).toLocaleDateString('vi-VN') : 'Chưa cập nhật';

                      if (detailTab === 'chi_tiet') {
                        return (
                          <div className="space-y-5">
                            <div>
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                1. Thông tin cá nhân & định danh
                              </h4>
                              <div className={grid}>
                                <Field label="Họ và tên" value={formatNameAndTitle(detailUser.fullName).name} />
                                <Field label="Mã cán bộ" value={detailUser.staffCode || '—'} mono />
                                <Field
                                  label="Giới tính"
                                  value={
                                    detailUser.gender === 'nu' ? 'Nữ' : detailUser.gender === 'khac' ? 'Khác' : 'Nam'
                                  }
                                />
                                <Field label="Ngày sinh" value={fmtDate(detailUser.dateOfBirth)} />
                                <Field label="Số CCCD / CMND" value={detailUser.so_cccd || 'Chưa cập nhật'} mono />
                                <Field label="Địa chỉ" value={detailUser.address || 'Chưa cập nhật'} />
                              </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                2. Công tác, học thuật & hợp đồng
                              </h4>
                              <div className={grid}>
                                <Field label="Đơn vị công tác" value={getDepartmentName(detailUser, departments)} />
                                <Field
                                  label="Chức vụ / Phân loại"
                                  value={
                                    detailUser.position ||
                                    STAFF_TYPE_OPTIONS.find((s) => s.value === detailUser.staffType)?.label ||
                                    'Chưa cập nhật'
                                  }
                                />
                                <Field
                                  label="Học hàm & Học vị"
                                  value={`${
                                    detailUser.academicRank && detailUser.academicRank !== 'khong'
                                      ? `${
                                          ACADEMIC_RANK_OPTIONS.find((a) => a.value === detailUser.academicRank)?.label
                                        } • `
                                      : ''
                                  }${DEGREE_OPTIONS.find((d) => d.value === detailUser.degree)?.label || 'Cử nhân'}`}
                                />
                                <Field
                                  label="Loại hợp đồng"
                                  value={
                                    CONTRACT_TYPE_OPTIONS.find((c) => c.value === detailUser.contractType)?.label ||
                                    'Chưa cập nhật'
                                  }
                                />
                                <Field
                                  label="Ngày vào trường"
                                  value={
                                    detailUser.startDate
                                      ? `${fmtDate(detailUser.startDate)}${
                                          detailUser.tham_nien_nam ? ` (${detailUser.tham_nien_nam} năm)` : ''
                                        }`
                                      : 'Chưa cập nhật'
                                  }
                                />
                                <Field
                                  label="Bắt đầu giảng dạy / Hạn HĐ"
                                  value={
                                    detailUser.ngay_bat_dau_giang_day || detailUser.ngay_het_han_hop_dong
                                      ? `${fmtDate(detailUser.ngay_bat_dau_giang_day)} • ${fmtDate(
                                          detailUser.ngay_het_han_hop_dong
                                        )}`
                                      : 'Chưa cập nhật'
                                  }
                                />
                              </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                3. Lương, thuế & tài khoản ngân hàng
                              </h4>
                              <div className={grid}>
                                <Field label="Ngạch lương" value={detailUser.salaryScale || 'Chưa cập nhật'} mono />
                                <Field
                                  label="Hệ số lương"
                                  value={
                                    detailUser.salaryCoefficient !== undefined
                                      ? Number(detailUser.salaryCoefficient).toFixed(2)
                                      : 'Chưa cập nhật'
                                  }
                                  mono
                                />
                                <Field
                                  label="Phép năm / Người phụ thuộc"
                                  value={`${detailUser.annualLeaveQuota ?? 12} ngày • ${
                                    detailUser.dependentsCount ?? 0
                                  } NPT`}
                                />
                                <Field label="Mã số thuế" value={detailUser.ma_so_thue || 'Chưa cập nhật'} mono />
                                <Field
                                  label="Số tài khoản"
                                  value={detailUser.so_tai_khoan_ngan_hang || 'Chưa cập nhật'}
                                  mono
                                />
                                <Field
                                  label="Ngân hàng / Chi nhánh"
                                  value={
                                    detailUser.ten_ngan_hang
                                      ? `${detailUser.ten_ngan_hang}${
                                          detailUser.chi_nhanh_ngan_hang ? ` - ${detailUser.chi_nhanh_ngan_hang}` : ''
                                        }`
                                      : 'Chưa cập nhật'
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (detailTab === 'face') {
                        const modelName = detailUser.mo_hinh_ai || 'buffalo_s';
                        const sampleQty = detailUser.so_luong_mau || detailUser.sampleCount || 0;
                        return (
                          <div className="space-y-4">
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-3.5">
                                {detailUser.facePhoto ? (
                                  <AnhBaoMat
                                    src={detailUser.facePhoto}
                                    alt={detailUser.fullName}
                                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                    fallback={
                                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        <ScanFace className="w-6 h-6" />
                                      </div>
                                    }
                                  />
                                ) : (
                                  <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                      detailUser.isFaceRegistered
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    <ScanFace className="w-6 h-6" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {detailUser.isFaceRegistered
                                      ? `Đã đăng ký Sinh trắc học Face ID (${modelName} • ${detailUser.vectorDimension || (detailUser as any).so_chieu_vector || 512}D)`
                                      : 'Chưa đăng ký dữ liệu khuôn mặt Face ID'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {detailUser.isFaceRegistered
                                      ? `Số mẫu: ${sampleQty} mẫu (${detailUser.isDefaultFace === false ? 'Mẫu phụ' : 'Mẫu mặc định'}) • Ngày đăng ký: ${
                                          detailUser.faceRegisteredAt
                                            ? new Date(detailUser.faceRegisteredAt).toLocaleDateString('vi-VN')
                                            : 'Chưa cập nhật'
                                        }`
                                      : 'Cần đăng ký 5 góc khuôn mặt để chấm công AI'}
                                  </div>
                                </div>
                              </div>
                              {canCreateOrDelete && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => navigate('/dang-ky-khuon-mat')}
                                    className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer"
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
                          </div>
                        );
                      }
                      const roleItems = (detailUser.roles || []) as any[];
                      return (
                        <div className="space-y-3">
                          <div className={grid}>
                            <Field label="Vai trò chính" value={getRoleMeta(detailUser.role).label} />
                            <Field
                              label="Tài khoản"
                              value={detailUser.isActive !== false ? 'Đang hoạt động' : 'Đã khóa'}
                            />
                            <Field
                              label="Đăng nhập gần nhất"
                              value={
                                (detailUser.lastLoginAt || detailUser.lan_dang_nhap_cuoi)
                                  ? new Date(detailUser.lastLoginAt || detailUser.lan_dang_nhap_cuoi || '').toLocaleString('vi-VN')
                                  : 'Chưa ghi nhận'
                              }
                            />
                            <Field
                              label="Đổi mật khẩu gần nhất"
                              value={
                                (detailUser.passwordChangedAt || detailUser.doi_mat_khau_luc)
                                  ? new Date(detailUser.passwordChangedAt || detailUser.doi_mat_khau_luc || '').toLocaleString('vi-VN')
                                  : 'Chưa thay đổi'
                              }
                            />
                          </div>
                          {roleItems.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Danh sách vai trò được gán ({roleItems.length})
                              </h4>
                              <div className="space-y-2">
                                {roleItems.map((r, i) => {
                                  const rawDeptId =
                                    r?.don_vi_id && typeof r.don_vi_id === 'object'
                                      ? String(r.don_vi_id._id || r.don_vi_id.id || '')
                                      : r?.don_vi_id || r?.departmentId || '';
                                  const matchedDept = rawDeptId
                                    ? departments.find((d) => String(d._id) === String(rawDeptId))
                                    : null;
                                  const scopeKey = (r?.pham_vi || r?.scope || 'toan_truong') as RoleScopeType;
                                  const scopeLabel = ROLE_SCOPE_LABELS[scopeKey] || scopeKey;
                                  const fromDate = r?.tu_ngay || r?.startDate;
                                  const toDate = r?.den_ngay || r?.endDate;
                                  return (
                                    <div
                                      key={r?.id || i}
                                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="flex items-center flex-wrap gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                          {getRoleMeta(r?.ma_vai_tro || r?.role || r?.name).label}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                                          {scopeLabel}
                                          {matchedDept ? `: ${matchedDept.name}` : ''}
                                        </span>
                                        {Boolean(r?.duoc_uy_quyen) && (
                                          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/35 border border-amber-200 dark:border-amber-700/70 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                            Được ủy quyền duyệt
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                        {fromDate ? String(fromDate).slice(0, 10) : '—'} →{' '}
                                        {toDate ? String(toDate).slice(0, 10) : 'Không thời hạn'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between gap-2 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailUser;
                      setDetailUser(null);
                      handleOpenEditModal(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa hồ sơ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-auto"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default Users;
