import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronDown,
  ChevronUp,
  Camera,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  AlertCircle,
  Upload,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { userApi } from '../../api/nguoiDung.api';
import { Button } from '../../components/chung/NutBam';
import { ModalNhapExcelNhanSu } from '../../components/nhanSu/ModalNhapExcelNhanSu';
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
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';
import { DepartmentSelect, getDeptCategory } from '../../components/chung/ChonDonVi';
import { Portal } from '../../components/chung/CongDichChuyen';
import { HoSoBenTrai, ThanhTabHoSo, TruongThongTin } from '../../components/chung/HoSoBenTrai';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';
import { SearchInput } from '../../components/chung/OTimKiem';

// =============================================================================
// HẰNG SỐ VÀ BẢNG ÁNH XẠ CHUẨN ĐẠI HỌC (CSDL v2.5)
// =============================================================================

const GLOBAL_SCOPE_ROLES = new Set(['admin', 'bgh', 'tccb', 'dao_tao', 'ke_toan']);
const DEPUTY_DELEGATION_ROLES = new Set(['pho_khoa', 'pho_bo_mon', 'pho_phong']);
const SECONDARY_FORBIDDEN_ROLES = new Set(['admin', 'truong_khoa', 'truong_bo_mon', 'truong_phong']);

const formatDateVN = (raw?: string | null): string => {
  const iso = toDateInputValue(raw);
  if (!iso) return 'Chưa cập nhật';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const getDeptParentId = (dept?: DepartmentItem | null): string | null => {
  if (!dept?.don_vi_cha_id) return null;
  if (typeof dept.don_vi_cha_id === 'object' && dept.don_vi_cha_id !== null && 'id' in dept.don_vi_cha_id) {
    return String((dept.don_vi_cha_id as any).id || '') || null;
  }
  return String(dept.don_vi_cha_id) || null;
};

const isParentChildDeptConflict = (
  deptIdA: string | null | undefined,
  deptIdB: string | null | undefined,
  departments: DepartmentItem[]
): boolean => {
  if (!deptIdA || !deptIdB) return false;
  const idA = String(deptIdA);
  const idB = String(deptIdB);
  if (idA === idB) return false;
  const deptA = departments.find((d) => String(d.id) === idA);
  const deptB = departments.find((d) => String(d.id) === idB);
  const parentA = getDeptParentId(deptA);
  const parentB = getDeptParentId(deptB);
  return parentA === idB || parentB === idA;
};

const getAllowedDeptsForSecondaryRole = (role: string, departments: DepartmentItem[]): DepartmentItem[] => {
  if (GLOBAL_SCOPE_ROLES.has(role)) return [];
  if (role === 'pho_khoa') return departments.filter((d) => getDeptCategory(d) === 'khoa');
  if (role === 'pho_bo_mon') return departments.filter((d) => getDeptCategory(d) === 'bo_mon');
  if (role === 'giang_vien') return departments.filter((d) => ['khoa', 'bo_mon'].includes(getDeptCategory(d)));
  if (role === 'pho_phong' || role === 'nhan_vien') return departments.filter((d) => getDeptCategory(d) === 'phong_ban');
  return departments.filter((d) => getDeptCategory(d) !== 'bgh');
};

const toDateInputValue = (raw: unknown): string => {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
  }
  const parsed = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const inferRoleScope = (
  role: string,
  deptId: string | null | undefined,
  departments: DepartmentItem[]
): RoleScopeType => {
  if (GLOBAL_SCOPE_ROLES.has(role)) {
    return 'toan_truong';
  }
  const dept = deptId ? departments.find((d) => String(d.id) === String(deptId)) : null;
  if (dept?.loai_don_vi === 'bo_mon') return 'bo_mon';
  if (dept?.loai_don_vi === 'phong_ban') return 'phong_ban';
  if (dept?.loai_don_vi === 'khoa') return 'khoa';
  if (role === 'pho_khoa' || role === 'truong_khoa') return 'khoa';
  if (role === 'pho_bo_mon' || role === 'truong_bo_mon') return 'bo_mon';
  if (role === 'pho_phong' || role === 'truong_phong') return 'phong_ban';
  return deptId ? 'khoa' : 'toan_truong';
};

const ROLE_OPTIONS = [
  { value: 'bgh', label: 'Ban Giám Hiệu (BGH)', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'admin', label: 'Quản trị Hệ thống (Admin IT)', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  { value: 'tccb', label: 'Tổ Chức Cán Bộ (TCCB)', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'dao_tao', label: 'Chuyên Viên Đào Tạo', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'ke_toan', label: 'Kế Toán', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'truong_khoa', label: 'Trưởng Khoa / Trưởng Đơn Vị', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'pho_khoa', label: 'Phó Trưởng Khoa', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  { value: 'truong_bo_mon', label: 'Trưởng Bộ Môn', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'pho_bo_mon', label: 'Phó Trưởng Bộ Môn', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' },
  { value: 'truong_phong', label: 'Trưởng Phòng', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800' },
  { value: 'pho_phong', label: 'Phó Trưởng Phòng', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  { value: 'giang_vien', label: 'Giảng Viên', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'nhan_vien', label: 'Chuyên Viên / Nhân Viên', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
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



const getTodayVietnamIso = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const sanitizeExcelCell = (val: unknown): string | number => {
  if (typeof val === 'number') return val;
  const s = String(val ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

const getActiveRoleSetFromUser = (u?: UserProfile | null): Set<string> => {
  const roles = new Set<string>();
  if (!u) return roles;
  const primary = normalizeRoleKey(u.vai_tro_chinh);
  if (primary) roles.add(primary);
  const todayKey = getTodayVietnamIso();
  if (Array.isArray(u.danh_sach_vai_tro)) {
    for (const r of u.danh_sach_vai_tro) {
      if (!r) continue;
      const start = r.tu_ngay ? String(r.tu_ngay).slice(0, 10) : null;
      const end = r.den_ngay ? String(r.den_ngay).slice(0, 10) : null;
      if (start && start > todayKey) continue;
      if (end && end < todayKey) continue;
      const code = normalizeRoleKey(r.ma_vai_tro);
      if (code) roles.add(code);
    }
  }
  return roles;
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
  if (u.hoc_ham === 'giao_su') parts.push('GS.');
  else if (u.hoc_ham === 'pho_giao_su') parts.push('PGS.');

  if (u.hoc_vi === 'tien_si') parts.push('TS.');
  else if (u.hoc_vi === 'thac_si') parts.push('ThS.');
  else if (u.hoc_vi === 'ky_su') parts.push('KS.');
  return parts.join(' ');
};

const getDepartmentName = (u: UserProfile, departments: DepartmentItem[]): string => {
  if (u.ten_phong_ban && u.ten_phong_ban.trim()) return u.ten_phong_ban;

  const rawDept = u.don_vi_chinh_id || u.don_vi_chinh;

  if (rawDept && typeof rawDept === 'object') {
    if ('ten_phong_ban' in rawDept && rawDept.ten_phong_ban) {
      return String(rawDept.ten_phong_ban);
    }
    if ('id' in rawDept && rawDept.id) {
      const found = departments.find((d) => String(d.id) === String(rawDept.id));
      if (found) return found.ten_phong_ban || '';
    }
  }

  if (rawDept) {
    const idStr = String(rawDept);
    const found = departments.find((d) => String(d.id) === idStr);
    if (found) return found.ten_phong_ban || '';
  }

  // Tra cứu theo danh sách vai trò nếu có
  if (Array.isArray(u.danh_sach_vai_tro) && u.danh_sach_vai_tro.length > 0) {
    const primaryRoleObj = u.danh_sach_vai_tro[0];
    const roleDeptId = primaryRoleObj?.don_vi_id;
    if (roleDeptId) {
      const idStr = typeof roleDeptId === 'object' && 'id' in roleDeptId ? String(roleDeptId.id) : String(roleDeptId);
      const found = departments.find((d) => String(d.id) === idStr);
      if (found) return found.ten_phong_ban || '';
    }
  }

  return 'Chưa phân đơn vị';
};

const getDepartmentIdValue = (u: UserProfile): string => {
  const rawDept = u.don_vi_chinh_id || u.don_vi_chinh;
  if (rawDept) {
    if (typeof rawDept === 'object' && 'id' in rawDept) {
      return String(rawDept.id);
    }
    return String(rawDept);
  }
  // Tra cứu theo danh sách vai trò nếu có
  if (Array.isArray(u.danh_sach_vai_tro) && u.danh_sach_vai_tro.length > 0) {
    const primaryRoleObj = u.danh_sach_vai_tro[0];
    const roleDeptId = primaryRoleObj?.don_vi_id;
    if (roleDeptId) {
      return typeof roleDeptId === 'object' && 'id' in roleDeptId ? String(roleDeptId.id) : String(roleDeptId);
    }
  }
  return '';
};

const isBghDept = (d?: DepartmentItem | null): boolean => {
  if (!d) return false;
  const name = (d.ten_phong_ban || '').toLowerCase();
  const rawType = String(d.loai_don_vi || '').toLowerCase();
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
// COMPONENT AVATAR THÔNG MINH (HIỂN THỊ ẢNH THẬT + FALLBACK SVG SẮC NÉT)
// =============================================================================

interface StaffAvatarProps {
  user: UserProfile;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const StaffAvatar: React.FC<StaffAvatarProps> = ({
  user,
  size = 'md',
}) => {
  const statusColor =
    user.kich_hoat === false
      ? 'bg-rose-500'
      : user.da_dang_ky_face
        ? 'bg-emerald-500'
        : 'bg-amber-400';

  return (
    <UserAvatar
      user={user}
      name={user.ho_ten}
      avatarUrl={user.anh_dai_dien}
      staffCode={user.ma_can_bo || user.id}
      size={size}
      shape="circle"
      showStatusDot={true}
      statusColor={statusColor}
    />
  );
};

// =============================================================================
// COMPONENT CHÍNH: QUẢN LÝ DANH SÁCH CÁN BỘ & GIẢNG VIÊN (CHUẨN GIAO DIỆN)
// =============================================================================

export const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const isBghViewer = hasRole(currentUser, ['bgh']);
  const isTopAdminViewer = hasRole(currentUser, ['admin', 'bgh']);
  const canCreateOrDelete = hasRole(currentUser, ['admin', 'bgh', 'tccb']);
  const canLockAccount = isTopAdminViewer;
  const isUnitLeaderViewer =
    hasRole(currentUser, ['truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong']) &&
    !canCreateOrDelete;
  const canEdit = hasRole(currentUser, [
    'admin', 'bgh', 'tccb', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong',
  ]);

  // Kiểm tra phân cấp quyền khóa/mở khóa tài khoản (chỉ Admin/BGH; chỉ BGH được khóa/mở Admin/BGH, kể cả vai trò kiêm nhiệm)
  const canManageUserStatus = useCallback(
    (targetEmp: UserProfile) => {
      if (!canLockAccount) return false;
      const currentId = String(currentUser?.id || '');
      const targetId = String(targetEmp.id || '');
      if (currentId && targetId && currentId === targetId) return false; // Không tự khóa chính mình

      const targetRoles = getActiveRoleSetFromUser(targetEmp);
      const isViewerBgh = hasRole(currentUser, ['bgh']);
      if (targetRoles.has('bgh') || targetRoles.has('admin')) {
        return isViewerBgh;
      }

      return true;
    },
    [canLockAccount, currentUser]
  );

  // State dữ liệu
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
  const [isImportExcelModalOpen, setIsImportExcelModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [detailTab, setDetailTab] = useState<'chi_tiet' | 'face' | 'role'>('chi_tiet');

  useEffect(() => {
    if (detailUser) setDetailTab('chi_tiet');
  }, [detailUser?.id]);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'academic' | 'salary'>('basic');
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignmentPayload[]>([]);
  const [primaryRoleDelegated, setPrimaryRoleDelegated] = useState<boolean>(false);
  const [primaryRoleStartDate, setPrimaryRoleStartDate] = useState<string>(() => getTodayVietnamIso());
  const [expandedRoleDateRows, setExpandedRoleDateRows] = useState<Record<number, boolean>>({});
  const [roleAssignmentsDirty, setRoleAssignmentsDirty] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateUserPayload & { kich_hoat?: boolean }>({
    ho_ten: '',
    email: '',
    mat_khau: '',
    ma_can_bo: '',
    vai_tro_chinh: 'giang_vien',
    don_vi_chinh_id: '',
    so_dien_thoai: '',
    chuc_vu: 'Giảng viên',
    hoc_ham: 'khong',
    hoc_vi: 'thac_si',
    loai_nhan_su: 'giang_vien',
    loai_hop_dong: 'toan_thoi_gian',
    ngach_luong: 'V.07.01.03',
    he_so_luong: 2.34,
    so_nguoi_phu_thuoc: 0,
    han_muc_phep_nam: 12,
    gioi_tinh: 'nam',
    ngay_sinh: '',
    ngay_vao_lam: getTodayVietnamIso(),
    dia_chi: '',
    trang_thai_lam_viec: 'dang_lam_viec',
    anh_dai_dien: '',
    ngay_het_han_hop_dong: '',
    ngay_bat_dau_giang_day: '',
    so_cccd: '',
    ma_so_thue: '',
    so_tai_khoan_ngan_hang: '',
    ten_ngan_hang: '',
    chi_nhanh_ngan_hang: '',
    kich_hoat: true,
  });
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

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
        userApi.getUsers({ trang: 1, gioi_han: 100 }),
        userApi.getDepartments(),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
        const raw = usersRes.value.data;
        let list: UserProfile[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any).users)
            ? (raw as any).users
            : [];
        const totalPages = Number((raw as any)?.pagination?.totalPages || 1);
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              userApi.getUsers({ trang: i + 2, gioi_han: 100 }).catch(() => null)
            )
          );
          rest.forEach((r) => {
            const extra = (r?.data as any)?.users;
            if (Array.isArray(extra)) list = list.concat(extra);
          });
        }
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
    const activeCount = users.filter((u) => u.kich_hoat !== false).length;
    const faceRegCount = users.filter((u) => Boolean(u.da_dang_ky_face)).length;
    const lecturerCount = users.filter((u) => {
      const r = normalizeRoleKey(u.vai_tro_chinh);
      return u.loai_nhan_su === 'giang_vien' || ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(r);
    }).length;
    const leadershipCount = users.filter((u) =>
      ['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong'].includes(normalizeRoleKey(u.vai_tro_chinh))
    ).length;
    const adminStaffCount = users.filter((u) => {
      const r = normalizeRoleKey(u.vai_tro_chinh);
      return (
        u.loai_nhan_su === 'nhan_vien' ||
        u.loai_nhan_su === 'chuyen_vien' ||
        u.loai_nhan_su === 'can_bo_quan_ly' ||
        r === 'nhan_vien' ||
        r === 'admin'
      );
    }).length;
    const pgsTsCount = users.filter(
      (u) => u.hoc_ham === 'giao_su' || u.hoc_ham === 'pho_giao_su' || u.hoc_vi === 'tien_si'
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
        const matchName = (u.ho_ten || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchCode = (u.ma_can_bo || '').toLowerCase().includes(q);
        const matchPhone = (u.so_dien_thoai || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCode && !matchPhone) return false;
      }

      // 2. Lọc theo Tab
      const rKey = normalizeRoleKey(u.vai_tro_chinh);
      if (filterTab === 'giang_vien') {
        if (u.loai_nhan_su !== 'giang_vien' && !['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(rKey)) {
          return false;
        }
      } else if (filterTab === 'leadership') {
        if (!['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong'].includes(rKey)) return false;
      } else if (filterTab === 'hanhchinh') {
        if (
          !['nhan_vien', 'chuyen_vien', 'can_bo_quan_ly'].includes(String(u.loai_nhan_su || '')) &&
          rKey !== 'nhan_vien' &&
          rKey !== 'admin'
        ) {
          return false;
        }
      } else if (filterTab === 'face_yes') {
        if (!u.da_dang_ky_face) return false;
      } else if (filterTab === 'face_no') {
        if (u.da_dang_ky_face) return false;
      }

      // 3. Lọc theo Khoa / Phòng ban
      if (departmentFilter !== 'ALL') {
        const deptId = getDepartmentIdValue(u);
        const selectedDept = departments.find((d) => String(d.id) === String(departmentFilter));
        const isBghFilter = selectedDept ? isBghDept(selectedDept) : false;

        if (isBghFilter) {
          const isUserBgh = normalizeRoleKey(u.vai_tro_chinh) === 'bgh' || deptId === departmentFilter;
          if (!isUserBgh) return false;
        } else {
          // 3.1 Khớp trực tiếp đơn vị chính
          const matchesDirect = deptId === departmentFilter;

          // 3.2 Khớp đơn vị cấp cha (khi lọc theo Khoa cha mà cán bộ thuộc Bộ môn con)
          const userDept = departments.find((d) => String(d.id) === String(deptId));
          const userParentId = userDept?.don_vi_cha_id
            ? typeof userDept.don_vi_cha_id === 'object' && userDept.don_vi_cha_id !== null && 'id' in userDept.don_vi_cha_id
              ? String(userDept.don_vi_cha_id.id)
              : String(userDept.don_vi_cha_id)
            : '';
          const matchesParent = Boolean(userParentId && userParentId === departmentFilter);

          // 3.3 Khớp danh sách vai trò u.danh_sach_vai_tro (nếu có gán đơn vị trực thuộc)
          const matchesRoles = Array.isArray(u.danh_sach_vai_tro) && u.danh_sach_vai_tro.some((r) => {
            const rDept = r.don_vi_id;
            if (!rDept) return false;
            const rId = typeof rDept === 'object' && rDept !== null && 'id' in rDept ? String(rDept.id) : String(rDept);
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
      const registeredCount = members.filter((m) => Boolean(m.da_dang_ky_face)).length;
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
  // XỬ LÝ MỞ MODAL THÊM / SỬA
  // ---------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setActiveFormTab('basic');
    setFormValidationErrors([]);
    const nextIdx = users.length + 1;
    const suggestedCode = `GV${String(nextIdx).padStart(3, '0')}`;

    const initialDeptId = isUnitLeaderViewer ? (getDepartmentIdValue(currentUser as any) || '') : '';

    setFormData({
      ho_ten: '',
      email: '',
      mat_khau: 'password123',
      ma_can_bo: suggestedCode,
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: initialDeptId,
      so_dien_thoai: '',
      chuc_vu: 'Giảng viên',
      hoc_ham: 'khong',
      hoc_vi: 'thac_si',
      loai_nhan_su: 'giang_vien',
      loai_hop_dong: 'toan_thoi_gian',
      ngach_luong: 'V.07.01.03',
      he_so_luong: 2.34,
      so_nguoi_phu_thuoc: 0,
      han_muc_phep_nam: 12,
      gioi_tinh: 'nam',
      ngay_sinh: '',
      ngay_vao_lam: getTodayVietnamIso(),
      dia_chi: '',
      trang_thai_lam_viec: 'dang_lam_viec',
      anh_dai_dien: '',
      ngay_het_han_hop_dong: '',
      ngay_bat_dau_giang_day: '',
      so_cccd: '',
      ma_so_thue: '',
      so_tai_khoan_ngan_hang: '',
      ten_ngan_hang: '',
      chi_nhanh_ngan_hang: '',
      kich_hoat: true,
    });
    setRoleAssignments([]);
    setPrimaryRoleDelegated(false);
    setPrimaryRoleStartDate(getTodayVietnamIso());
    setExpandedRoleDateRows({});
    setRoleAssignmentsDirty(false);
    setIsFormModalOpen(true);
  };

  const mapUserToFormData = useCallback((u: UserProfile) => {
    const hoSo = ((u as any).ho_so && typeof (u as any).ho_so === 'object' ? (u as any).ho_so : {}) as Record<string, any>;
    const pick = <T,>(topVal: T | undefined | null, profileKey: string, fallback: T): T => {
      if (topVal !== undefined && topVal !== null && topVal !== '') return topVal;
      const nested = hoSo[profileKey];
      if (nested !== undefined && nested !== null && nested !== '') return nested as T;
      return fallback;
    };
    const roleKey = normalizeRoleKey(u.vai_tro_chinh);
    return {
      ho_ten: u.ho_ten || '',
      email: u.email || '',
      mat_khau: '',
      ma_can_bo: u.ma_can_bo || '',
      vai_tro_chinh: roleKey,
      don_vi_chinh_id: getDepartmentIdValue(u),
      so_dien_thoai: u.so_dien_thoai || '',
      chuc_vu: typeof pick(u.chuc_vu, 'chuc_vu', '') === 'string' ? pick(u.chuc_vu, 'chuc_vu', '') : '',
      hoc_ham: pick(u.hoc_ham, 'hoc_ham', 'khong') as AcademicRankType,
      hoc_vi: pick(u.hoc_vi, 'hoc_vi', 'thac_si') as DegreeType,
      loai_nhan_su: pick(
        u.loai_nhan_su,
        'loai_nhan_su',
        roleKey === 'nhan_vien' ? 'nhan_vien' : 'giang_vien'
      ) as StaffType,
      loai_hop_dong: pick(u.loai_hop_dong, 'loai_hop_dong', 'toan_thoi_gian') as ContractType,
      ngach_luong: pick(u.ngach_luong, 'ngach_luong', 'V.07.01.03'),
      he_so_luong: Number(u.he_so_luong ?? hoSo.he_so_luong ?? 2.34),
      so_nguoi_phu_thuoc: Number(u.so_nguoi_phu_thuoc ?? hoSo.so_nguoi_phu_thuoc ?? 0),
      han_muc_phep_nam: Number(u.han_muc_phep_nam ?? hoSo.han_muc_phep_nam ?? 12),
      gioi_tinh: pick(u.gioi_tinh, 'gioi_tinh', 'nam') as GenderType,
      ngay_sinh: toDateInputValue(u.ngay_sinh ?? hoSo.ngay_sinh),
      ngay_vao_lam: toDateInputValue(u.ngay_vao_lam ?? hoSo.ngay_vao_lam) || getTodayVietnamIso(),
      dia_chi: pick(u.dia_chi, 'dia_chi', ''),
      trang_thai_lam_viec: (u.trang_thai_lam_viec || 'dang_lam_viec') as EmploymentStatusType,
      anh_dai_dien: u.anh_dai_dien || '',
      ngay_het_han_hop_dong: toDateInputValue(u.ngay_het_han_hop_dong ?? hoSo.ngay_het_han_hop_dong),
      ngay_bat_dau_giang_day: toDateInputValue(u.ngay_bat_dau_giang_day ?? hoSo.ngay_bat_dau_giang_day),
      so_cccd: pick(u.so_cccd, 'so_cccd', ''),
      ma_so_thue: pick(u.ma_so_thue, 'ma_so_thue', ''),
      so_tai_khoan_ngan_hang: pick(u.so_tai_khoan_ngan_hang, 'so_tai_khoan_ngan_hang', ''),
      ten_ngan_hang: pick(u.ten_ngan_hang, 'ten_ngan_hang', ''),
      chi_nhanh_ngan_hang: pick(u.chi_nhanh_ngan_hang, 'chi_nhanh_ngan_hang', ''),
      kich_hoat: u.kich_hoat !== false,
    };
  }, []);

  const extractRoleStateFromUser = useCallback(
    (u: UserProfile) => {
      const todayIso = getTodayVietnamIso();
      const primaryCode = normalizeRoleKey(u.vai_tro_chinh);
      const primaryDeptId = GLOBAL_SCOPE_ROLES.has(primaryCode) ? null : (getDepartmentIdValue(u) || null);
      let primaryDelegated = false;
      let primaryStartDate = todayIso;
      const secondaryRows: UserRoleAssignmentPayload[] = [];

      if (Array.isArray(u.danh_sach_vai_tro)) {
        for (const r of u.danh_sach_vai_tro as any[]) {
          if (!r) continue;
          const code = normalizeRoleKey(r?.ma_vai_tro || u.vai_tro_chinh);
          const rawDeptId =
            r?.don_vi_id && typeof r.don_vi_id === 'object'
              ? String(r.don_vi_id.id || '')
              : r?.don_vi_id
                ? String(r.don_vi_id)
                : '';
          const effectiveDeptId = GLOBAL_SCOPE_ROLES.has(code) ? null : (rawDeptId || null);
          const phamVi = inferRoleScope(code, effectiveDeptId, departments);

          const isPrimaryRow =
            code === primaryCode &&
            String(effectiveDeptId || '') === String(primaryDeptId || '');

          if (isPrimaryRow) {
            primaryDelegated = DEPUTY_DELEGATION_ROLES.has(code) && Boolean(r?.duoc_uy_quyen);
            primaryStartDate = toDateInputValue(r?.tu_ngay) || todayIso;
            continue;
          }

          secondaryRows.push({
            ma_vai_tro: code,
            pham_vi: phamVi,
            don_vi_id: effectiveDeptId,
            duoc_uy_quyen: DEPUTY_DELEGATION_ROLES.has(code) ? Boolean(r?.duoc_uy_quyen) : false,
            tu_ngay: toDateInputValue(r?.tu_ngay) || todayIso,
            den_ngay: toDateInputValue(r?.den_ngay) || null,
          });
        }
      }

      return { primaryDelegated, primaryStartDate, secondaryRows };
    },
    [departments]
  );

  const handleOpenDetailModal = useCallback(async (u: UserProfile) => {
    setDetailUser(u);
    try {
      const res = await userApi.getUserById(String(u.id));
      if (res?.data && String(res.data.id) === String(u.id)) {
        setDetailUser((current) =>
          current && String(current.id) === String(u.id) ? res.data : current
        );
      }
    } catch {
      // Giữ nguyên dữ liệu từ danh sách nếu tải chi tiết thất bại
    }
  }, []);

  const handleOpenEditModal = async (u: UserProfile) => {
    let sourceUser = u;
    try {
      const res = await userApi.getUserById(String(u.id));
      if (res?.data && String(res.data.id) === String(u.id)) {
        sourceUser = res.data;
      }
    } catch {
      // Dự phòng dùng dữ liệu từ danh sách nếu tải chi tiết thất bại
    }

    const extractedRoles = extractRoleStateFromUser(sourceUser);
    setEditingUser(sourceUser);
    setActiveFormTab('basic');
    setFormValidationErrors([]);
    setPrimaryRoleDelegated(extractedRoles.primaryDelegated);
    setPrimaryRoleStartDate(extractedRoles.primaryStartDate);
    setRoleAssignments(extractedRoles.secondaryRows);
    setExpandedRoleDateRows({});
    setRoleAssignmentsDirty(false);
    setFormData(mapUserToFormData(sourceUser));
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
          ACADEMIC_RANK_OPTIONS.find((r) => r.value === u.hoc_ham)?.label || '',
          DEGREE_OPTIONS.find((d) => d.value === u.hoc_vi)?.label || '',
        ].filter(Boolean).join(' - ') || 'Không';

        const roleMeta = getRoleMeta(u.vai_tro_chinh);
        const deptName = getDepartmentName(u, departments);
        const contractDesc = CONTRACT_TYPE_OPTIONS.find((c) => c.value === u.loai_hop_dong)?.label || u.loai_hop_dong || '--';
        const empStatusDesc = EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === u.trang_thai_lam_viec)?.label || 'Đang công tác';

        const staffTypeLabel =
          STAFF_TYPE_OPTIONS.find((s) => s.value === u.loai_nhan_su)?.label ||
          (u.loai_nhan_su === 'giang_vien' ? 'Giảng viên' : 'Hành chính');

        return {
          'STT': i + 1,
          'Mã Cán Bộ': sanitizeExcelCell(u.ma_can_bo || '--'),
          'Họ Và Tên': sanitizeExcelCell(prefix ? `${prefix} ${u.ho_ten}` : u.ho_ten),
          'Chức Danh / Vị Trí': sanitizeExcelCell(u.chuc_vu || '--'),
          'Khoa / Phòng Ban': sanitizeExcelCell(deptName),
          'Vai Trò Hệ Thống': sanitizeExcelCell(roleMeta.label),
          'Email Công Vụ': sanitizeExcelCell(u.email),
          'Số Điện Thoại': sanitizeExcelCell(u.so_dien_thoai || '--'),
          'Học Hàm & Học Vị': sanitizeExcelCell(academicDesc),
          'Loại Nhân Sự': sanitizeExcelCell(staffTypeLabel),
          'Loại Hợp Đồng': sanitizeExcelCell(contractDesc),
          'Ngạch Lương': sanitizeExcelCell(u.ngach_luong || '--'),
          'Hệ Số Lương': u.he_so_luong ?? 2.34,
          'Người Phụ Thuộc': u.so_nguoi_phu_thuoc ?? 0,
          'Phép Năm': sanitizeExcelCell(`${u.han_muc_phep_nam ?? 12} ngày`),
          'Sinh Trắc Học Face ID': u.da_dang_ky_face ? 'Đã đăng ký (512D)' : 'Chưa đăng ký',
          'Tình Trạng Công Tác': sanitizeExcelCell(empStatusDesc),
          'Trạng Thái Hoạt Động': u.kich_hoat !== false ? 'Đang hoạt động' : 'Đã khóa',
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

      XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_NTU_${getTodayVietnamIso()}.xlsx`);
      toast.success('Đã xuất Danh sách nhân sự (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Danh sách nhân sự:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // ---------------------------------------------------------------------------
  // ĐỒNG BỘ THÔNG MINH 2 CHIỀU: ĐƠN VỊ & VAI TRÒ HỆ THỐNG (RBAC)
  // ---------------------------------------------------------------------------
  const syncRolesAfterPrimaryChange = useCallback(
    (nextRole: string, nextDeptId: string) => {
      if (!DEPUTY_DELEGATION_ROLES.has(nextRole) && primaryRoleDelegated) {
        setPrimaryRoleDelegated(false);
        setRoleAssignmentsDirty(true);
      }
      const nextPrimaryEffDept = GLOBAL_SCOPE_ROLES.has(nextRole) ? null : (nextDeptId || null);
      const nextPrimaryKey = `${nextRole}::${nextPrimaryEffDept || 'ALL'}`;
      setRoleAssignments((prev) => {
        const filtered = prev.filter((item) => {
          const itemEffDept = GLOBAL_SCOPE_ROLES.has(item.ma_vai_tro) ? null : (item.don_vi_id || null);
          return `${item.ma_vai_tro}::${itemEffDept || 'ALL'}` !== nextPrimaryKey;
        });
        if (filtered.length !== prev.length) {
          setRoleAssignmentsDirty(true);
        }
        return filtered;
      });
    },
    [primaryRoleDelegated]
  );

  const handleDepartmentChange = (deptId: string) => {
    const selectedDept = departments.find((d) => String(d.id) === String(deptId));
    let newRole = formData.vai_tro_chinh || 'giang_vien';
    let newStaffType = formData.loai_nhan_su;
    let newPosition = formData.chuc_vu;

    if (selectedDept) {
      const cat = getDeptCategory(selectedDept);
      if (cat === 'bgh') {
        newRole = 'bgh';
        newStaffType = 'can_bo_quan_ly';
        newPosition = formData.chuc_vu && !['Giảng viên', 'Chuyên viên'].includes(formData.chuc_vu) ? formData.chuc_vu : 'Hiệu trưởng';
      } else if (cat === 'khoa') {
        if (['bgh', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong', 'tccb', 'dao_tao', 'ke_toan', 'admin'].includes(newRole)) {
          newRole = 'giang_vien';
          newStaffType = 'giang_vien';
          newPosition = 'Giảng viên';
        }
      } else if (cat === 'bo_mon') {
        if (['bgh', 'truong_khoa', 'pho_khoa', 'truong_phong', 'pho_phong', 'tccb', 'dao_tao', 'ke_toan', 'nhan_vien', 'admin'].includes(newRole)) {
          newRole = 'giang_vien';
          newStaffType = 'giang_vien';
          newPosition = 'Giảng viên';
        }
      } else if (cat === 'phong_ban') {
        if (['bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'giang_vien'].includes(newRole)) {
          newRole = 'nhan_vien';
          newStaffType = 'chuyen_vien';
          newPosition = 'Chuyên viên';
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      don_vi_chinh_id: deptId,
      vai_tro_chinh: newRole,
      loai_nhan_su: newStaffType,
      chuc_vu: editingUser && prev.chuc_vu?.trim() ? prev.chuc_vu : newPosition,
    }));
    syncRolesAfterPrimaryChange(newRole, deptId);
  };

  const handleRoleChange = (newRole: string) => {
    let newDeptId = formData.don_vi_chinh_id;
    const isAdminDeptRole = ['nhan_vien', 'admin', 'tccb', 'dao_tao', 'ke_toan'].includes(newRole);
    const isUnitManagementRole = ['bgh', 'truong_phong', 'pho_phong'].includes(newRole);
    let newStaffType: StaffType = isUnitManagementRole
      ? 'can_bo_quan_ly'
      : isAdminDeptRole
        ? 'chuyen_vien'
        : 'giang_vien';
    let newPosition = formData.chuc_vu;

    const currentDept = departments.find((d) => String(d.id) === String(newDeptId));
    const currentCat = currentDept ? getDeptCategory(currentDept) : null;

    if (newRole === 'bgh') {
      const bghDept = departments.find((d) => getDeptCategory(d) === 'bgh');
      newDeptId = bghDept ? bghDept.id : '';
      newPosition = 'Lãnh đạo Ban Giám Hiệu';
    } else if (newRole === 'admin') {
      const adminDept = departments.find(
        (d) =>
          (d.ten_phong_ban || '').toLowerCase().includes('quản trị') ||
          (d.ten_phong_ban || '').toLowerCase().includes('hành chính')
      ) || departments.find((d) => getDeptCategory(d) === 'phong_ban');
      newDeptId = adminDept ? adminDept.id : '';
      newPosition = 'Quản trị viên hệ thống';
    } else if (newRole === 'truong_khoa' || newRole === 'pho_khoa') {
      if (currentCat !== 'khoa') {
        const firstKhoa = departments.find((d) => getDeptCategory(d) === 'khoa');
        newDeptId = firstKhoa ? firstKhoa.id : '';
      }
      newPosition = newRole === 'truong_khoa' ? 'Trưởng Khoa' : 'Phó Trưởng Khoa';
    } else if (newRole === 'truong_bo_mon' || newRole === 'pho_bo_mon') {
      if (currentCat !== 'bo_mon') {
        const firstBomon = departments.find((d) => getDeptCategory(d) === 'bo_mon');
        newDeptId = firstBomon ? firstBomon.id : '';
      }
      newPosition = newRole === 'truong_bo_mon' ? 'Trưởng Bộ Môn' : 'Phó Trưởng Bộ Môn';
    } else if (newRole === 'giang_vien') {
      if (currentCat === 'bgh' || currentCat === 'phong_ban') {
        const firstKhoa = departments.find((d) => getDeptCategory(d) === 'khoa');
        newDeptId = firstKhoa ? firstKhoa.id : '';
      }
      newPosition = 'Giảng viên';
    } else if (['nhan_vien', 'tccb', 'dao_tao', 'ke_toan', 'truong_phong', 'pho_phong'].includes(newRole)) {
      if (currentCat !== 'phong_ban') {
        const firstPhong = departments.find((d) => getDeptCategory(d) === 'phong_ban');
        newDeptId = firstPhong ? firstPhong.id : '';
      }
      if (newRole === 'truong_phong') newPosition = 'Trưởng Phòng';
      else if (newRole === 'pho_phong') newPosition = 'Phó Trưởng Phòng';
      else if (newRole === 'tccb') newPosition = 'Chuyên viên TCCB';
      else if (newRole === 'dao_tao') newPosition = 'Chuyên viên Đào tạo';
      else if (newRole === 'ke_toan') newPosition = 'Kế toán viên';
      else newPosition = 'Chuyên viên';
    }

    setFormData((prev) => ({
      ...prev,
      vai_tro_chinh: newRole,
      don_vi_chinh_id: newDeptId,
      loai_nhan_su: newStaffType,
      chuc_vu: editingUser && prev.chuc_vu?.trim() ? prev.chuc_vu : newPosition,
    }));
    syncRolesAfterPrimaryChange(newRole, newDeptId);
  };

  const availableRoleOptions = useMemo(() => {
    if (isUnitLeaderViewer) {
      return ROLE_OPTIONS.filter((r) => ['giang_vien', 'nhan_vien'].includes(r.value));
    }
    if (!isTopAdminViewer) {
      return ROLE_OPTIONS.filter((r) => !['admin', 'bgh'].includes(r.value));
    }
    return ROLE_OPTIONS;
  }, [isUnitLeaderViewer, isTopAdminViewer]);

  const secondaryRoleOptions = useMemo(() => {
    return availableRoleOptions.filter((r) => {
      if (SECONDARY_FORBIDDEN_ROLES.has(r.value)) return false;
      if (r.value === 'bgh' && !isBghViewer) return false;
      return true;
    });
  }, [availableRoleOptions, isBghViewer]);

  const handleAddSecondaryRole = useCallback(() => {
    const todayIso = getTodayVietnamIso();
    const currentPrimaryRole = formData.vai_tro_chinh || 'giang_vien';
    const currentPrimaryEffDept = GLOBAL_SCOPE_ROLES.has(currentPrimaryRole)
      ? null
      : (formData.don_vi_chinh_id || null);

    const usedKeys = new Set<string>([
      `${currentPrimaryRole}::${currentPrimaryEffDept || 'ALL'}`,
      ...roleAssignments.map((r) => {
        const effDept = GLOBAL_SCOPE_ROLES.has(r.ma_vai_tro) ? null : (r.don_vi_id || null);
        return `${r.ma_vai_tro}::${effDept || 'ALL'}`;
      }),
    ]);

    const allowedValues = new Set(secondaryRoleOptions.map((o) => o.value));
    const basePriority =
      currentPrimaryRole === 'giang_vien'
        ? ['pho_khoa', 'pho_bo_mon', 'dao_tao', 'tccb', 'ke_toan', 'pho_phong', 'nhan_vien', 'bgh']
        : ['giang_vien', 'dao_tao', 'tccb', 'ke_toan', 'pho_khoa', 'pho_bo_mon', 'pho_phong', 'nhan_vien', 'bgh'];
    const priorityOrder = basePriority.filter((r) => allowedValues.has(r) && r !== currentPrimaryRole);

    let chosenRole = priorityOrder[0] || secondaryRoleOptions[0]?.value || 'giang_vien';
    let chosenDeptId: string | null = null;

    for (const candidateRole of priorityOrder) {
      if (GLOBAL_SCOPE_ROLES.has(candidateRole)) {
        if (!usedKeys.has(`${candidateRole}::ALL`)) {
          chosenRole = candidateRole;
          chosenDeptId = null;
          break;
        }
        continue;
      }
      const allowedDepts = getAllowedDeptsForSecondaryRole(candidateRole, departments);
      const existingLecturerDepts = [
        ...(currentPrimaryRole === 'giang_vien' && currentPrimaryEffDept ? [String(currentPrimaryEffDept)] : []),
        ...roleAssignments
          .filter((r) => r.ma_vai_tro === 'giang_vien' && r.don_vi_id)
          .map((r) => String(r.don_vi_id)),
      ];
      const preferredOrder = [
        ...allowedDepts.filter((d) => String(d.id) === String(formData.don_vi_chinh_id || '')),
        ...allowedDepts.filter((d) => String(d.id) !== String(formData.don_vi_chinh_id || '')),
      ];
      const freeDept = preferredOrder.find((d) => {
        if (usedKeys.has(`${candidateRole}::${d.id}`)) return false;
        if (
          candidateRole === 'giang_vien' &&
          existingLecturerDepts.some((otherId) => isParentChildDeptConflict(d.id, otherId, departments))
        ) {
          return false;
        }
        return true;
      });
      if (freeDept) {
        chosenRole = candidateRole;
        chosenDeptId = freeDept.id;
        break;
      }
    }

    const chosenScope = inferRoleScope(chosenRole, chosenDeptId, departments);
    setRoleAssignments((prev) => [
      ...prev,
      {
        ma_vai_tro: chosenRole,
        pham_vi: chosenScope,
        don_vi_id: chosenScope === 'toan_truong' ? null : chosenDeptId,
        duoc_uy_quyen: false,
        tu_ngay: todayIso,
        den_ngay: null,
      },
    ]);
    setRoleAssignmentsDirty(true);
  }, [departments, formData.don_vi_chinh_id, formData.vai_tro_chinh, roleAssignments, secondaryRoleOptions]);


  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationErrors([]);

    const validationErrors: string[] = [];
    let firstErrorTab: 'basic' | 'academic' | 'salary' | null = null;
    const addErr = (tab: 'basic' | 'academic' | 'salary', msg: string) => {
      if (!firstErrorTab) firstErrorTab = tab;
      validationErrors.push(msg);
    };

    const trimmedName = formData.ho_ten.trim();
    const trimmedEmail = formData.email.trim();
    const staffCode = (formData.ma_can_bo || '').trim().toUpperCase();
    const primaryRole = formData.vai_tro_chinh || 'giang_vien';
    const cleanPhone = (formData.so_dien_thoai || '').replace(/[\s.-]/g, '').trim();
    const cleanCccd = (formData.so_cccd || '').trim();
    const cleanTaxCode = (formData.ma_so_thue || '').trim();
    const cleanBankAccount = (formData.so_tai_khoan_ngan_hang || '').trim();
    const cleanBankName = (formData.ten_ngan_hang || '').trim();
    const trimmedPosition = (formData.chuc_vu || '').trim();
    const trimmedAddress = (formData.dia_chi || '').trim();
    const todayIsoCheck = getTodayVietnamIso();
    const isLecturerForm =
      formData.loai_nhan_su === 'giang_vien' ||
      ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(primaryRole);
    const isFixedTermContract = ['ban_thoi_gian', 'thinh_giang', 'hop_dong_vu_viec'].includes(
      formData.loai_hop_dong || ''
    );

    // Tab 1: Thông tin cơ bản & Đơn vị
    if (!trimmedName) addErr('basic', 'Họ và tên đầy đủ');
    if (!staffCode) addErr('basic', 'Mã cán bộ / giảng viên');
    if (!trimmedEmail) {
      addErr('basic', 'Email công vụ');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      addErr('basic', 'Email công vụ không đúng định dạng');
    }

    if (!editingUser) {
      if (!formData.mat_khau || formData.mat_khau.trim().length < 6) {
        addErr('basic', 'Mật khẩu khởi tạo (tối thiểu 6 ký tự)');
      }
    } else if (formData.mat_khau && formData.mat_khau.trim().length > 0 && formData.mat_khau.trim().length < 6) {
      addErr('basic', 'Mật khẩu mới (phải có tối thiểu 6 ký tự nếu muốn đổi)');
    }

    if (!cleanPhone) {
      addErr('basic', 'Số điện thoại liên hệ');
    } else if (!/^(0|\+84)\d{9,10}$/.test(cleanPhone)) {
      addErr('basic', 'Số điện thoại không hợp lệ (cần 10–11 số bắt đầu bằng 0 hoặc +84)');
    }

    if (!formData.don_vi_chinh_id) {
      addErr('basic', 'Khoa / Bộ môn / Phòng ban trực thuộc');
    }
    if (!formData.ngay_sinh) {
      addErr('basic', 'Ngày sinh');
    } else if (formData.ngay_sinh > todayIsoCheck) {
      addErr('basic', 'Ngày sinh không được lớn hơn ngày hiện tại');
    }

    if (!cleanCccd) {
      addErr('basic', 'Số CCCD / CMND');
    } else if (!/^\d{9}$|^\d{12}$/.test(cleanCccd)) {
      addErr('basic', 'Số CCCD / CMND phải gồm đúng 9 hoặc 12 chữ số');
    }

    if (!trimmedPosition) addErr('basic', 'Chức vụ / Chức danh');

    // Tab 2: Học hàm, Học vị & Biên chế
    if (!formData.ngay_vao_lam) addErr('academic', 'Ngày vào trường công tác');
    if (isLecturerForm && !formData.ngay_bat_dau_giang_day) {
      addErr('academic', 'Ngày bắt đầu giảng dạy (bắt buộc đối với giảng viên)');
    } else if (formData.ngay_bat_dau_giang_day) {
      if (formData.ngay_bat_dau_giang_day > todayIsoCheck) {
        addErr('academic', 'Ngày bắt đầu giảng dạy không được lớn hơn ngày hiện tại');
      } else if (formData.ngay_sinh && formData.ngay_bat_dau_giang_day <= formData.ngay_sinh) {
        addErr('academic', 'Ngày bắt đầu giảng dạy phải sau ngày sinh');
      }
    }
    if (isFixedTermContract && !formData.ngay_het_han_hop_dong) {
      addErr('academic', 'Ngày hết hạn hợp đồng (bắt buộc đối với hợp đồng có thời hạn)');
    } else if (
      formData.ngay_het_han_hop_dong &&
      formData.ngay_vao_lam &&
      formData.ngay_het_han_hop_dong < formData.ngay_vao_lam
    ) {
      addErr('academic', 'Ngày hết hạn hợp đồng phải sau hoặc bằng ngày vào trường');
    }
    if (!trimmedAddress) addErr('academic', 'Địa chỉ thường trú / Liên hệ');

    // Tab 3: Ngạch lương, Thuế & Ngân hàng
    const isVisitingContract = ['thinh_giang', 'hop_dong_vu_viec'].includes(formData.loai_hop_dong || '');
    const coeffVal = Number(formData.he_so_luong);
    if (!Number.isFinite(coeffVal) || coeffVal < 0 || coeffVal > 30 || (!isVisitingContract && coeffVal <= 0)) {
      addErr('salary', 'Hệ số lương hiện hưởng (phải > 0 đối với hợp đồng cơ hữu)');
    }
    const leaveQuotaVal = Number(formData.han_muc_phep_nam);
    if (!Number.isFinite(leaveQuotaVal) || leaveQuotaVal < 0 || leaveQuotaVal > 45) {
      addErr('salary', 'Quỹ nghỉ phép năm định mức (0–45 ngày)');
    }
    if (cleanTaxCode && !/^\d{10}(\d{3})?$/.test(cleanTaxCode)) {
      addErr('salary', 'Mã số thuế cá nhân phải gồm đúng 10 hoặc 13 chữ số');
    }
    if (cleanBankAccount && !cleanBankName) {
      addErr('salary', 'Tên ngân hàng (bắt buộc khi đã nhập số tài khoản)');
    } else if (cleanBankName && !cleanBankAccount) {
      addErr('salary', 'Số tài khoản ngân hàng (bắt buộc khi đã nhập tên ngân hàng)');
    }

    // Kiểm tra danh sách vai trò kiêm nhiệm (nếu người dùng có quyền quản lý phân vai)
    const primaryDeptIdCheck = formData.don_vi_chinh_id || null;
    const primaryScopeCheck = inferRoleScope(primaryRole, primaryDeptIdCheck, departments);
    if (canCreateOrDelete && roleAssignments.length > 0) {
      const primaryEffDeptCheck = primaryScopeCheck === 'toan_truong' ? null : primaryDeptIdCheck;
      const seenRoleKeys = new Set<string>([`${primaryRole}::${primaryEffDeptCheck || 'ALL'}`]);
      const seenLecturerDeptIds: string[] =
        primaryRole === 'giang_vien' && primaryEffDeptCheck ? [String(primaryEffDeptCheck)] : [];
      roleAssignments.forEach((row, idx) => {
        const lineNum = idx + 1;
        if (SECONDARY_FORBIDDEN_ROLES.has(row.ma_vai_tro)) {
          addErr(
            'basic',
            `Vai trò kiêm nhiệm #${lineNum}: Không được gán Admin hoặc Trưởng đơn vị tại mục kiêm nhiệm`
          );
        }
        const isGlobal = GLOBAL_SCOPE_ROLES.has(row.ma_vai_tro);
        if (!isGlobal && !row.don_vi_id) {
          addErr('basic', `Vai trò kiêm nhiệm #${lineNum}: Vui lòng chọn đơn vị áp dụng`);
        }
        if (row.den_ngay && row.tu_ngay && row.den_ngay < row.tu_ngay) {
          addErr('basic', `Vai trò kiêm nhiệm #${lineNum}: Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu`);
        }
        const rowKey = `${row.ma_vai_tro}::${isGlobal ? 'ALL' : (row.don_vi_id || 'ALL')}`;
        if (seenRoleKeys.has(rowKey)) {
          addErr('basic', `Vai trò kiêm nhiệm #${lineNum}: Bị trùng vai trò và đơn vị`);
        }
        if (
          row.ma_vai_tro === 'giang_vien' &&
          row.don_vi_id &&
          seenLecturerDeptIds.some((otherId) => isParentChildDeptConflict(row.don_vi_id, otherId, departments))
        ) {
          addErr(
            'basic',
            `Vai trò kiêm nhiệm #${lineNum}: Không thể gán trùng Giảng viên ở cả Khoa và Bộ môn trực thuộc cùng một Khoa`
          );
        }
        seenRoleKeys.add(rowKey);
        if (row.ma_vai_tro === 'giang_vien' && row.don_vi_id) {
          seenLecturerDeptIds.push(String(row.don_vi_id));
        }
      });
    }

    if (validationErrors.length > 0) {
      setFormValidationErrors(validationErrors);
      if (firstErrorTab) setActiveFormTab(firstErrorTab);
      toast.error(`Chưa điền đủ hoặc sai thông tin: ${validationErrors[0]}`);
      return;
    }

    const selectedDept = departments.find((d) => d.id === formData.don_vi_chinh_id);
    if (selectedDept) {
      if (primaryRole === 'bgh' && !isBghDept(selectedDept)) {
        toast.error('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.');
        return;
      }
      if (['truong_khoa', 'pho_khoa'].includes(primaryRole) && selectedDept.loai_don_vi !== 'khoa') {
        toast.error('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.');
        return;
      }
      if (['truong_bo_mon', 'pho_bo_mon'].includes(primaryRole) && selectedDept.loai_don_vi !== 'bo_mon') {
        toast.error('Trưởng Bộ Môn / Phó Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.');
        return;
      }
      if (['truong_phong', 'pho_phong', 'tccb', 'dao_tao', 'ke_toan'].includes(primaryRole) && selectedDept.loai_don_vi !== 'phong_ban') {
        toast.error('Vai trò khối phòng ban / chức năng bắt buộc phải thuộc đơn vị cấp Phòng ban.');
        return;
      }
      if (primaryRole === 'giang_vien' && !['khoa', 'bo_mon'].includes(selectedDept.loai_don_vi || '')) {
        toast.error('Giảng viên bắt buộc phải trực thuộc một Khoa hoặc Bộ Môn đào tạo.');
        return;
      }
      if (primaryRole === 'admin' && (selectedDept.loai_don_vi === 'khoa' || selectedDept.loai_don_vi === 'bo_mon')) {
        toast.error('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU.');
        return;
      }
      if (isBghDept(selectedDept) && !['bgh', 'admin'].includes(primaryRole)) {
        toast.error('Đơn vị Ban Giám Hiệu chỉ dành cho nhân sự thuộc Ban Giám Hiệu hoặc Quản trị viên cấp trường.');
        return;
      }
    }

    const todayIso = getTodayVietnamIso();
    const primaryDeptId = formData.don_vi_chinh_id || null;
    const primaryScope = inferRoleScope(primaryRole, primaryDeptId, departments);
    let preparedRoleAssignments: UserRoleAssignmentPayload[] | undefined;

    if (canCreateOrDelete && roleAssignmentsDirty) {
      const normalizedSecondaryRows: UserRoleAssignmentPayload[] = roleAssignments.map((r) => {
        const isGlobal = GLOBAL_SCOPE_ROLES.has(r.ma_vai_tro);
        const effDeptId = isGlobal ? null : (r.don_vi_id || null);
        const effScope = inferRoleScope(r.ma_vai_tro, effDeptId, departments);
        return {
          ma_vai_tro: r.ma_vai_tro,
          pham_vi: effScope,
          don_vi_id: effDeptId,
          duoc_uy_quyen: DEPUTY_DELEGATION_ROLES.has(r.ma_vai_tro) ? Boolean(r.duoc_uy_quyen) : false,
          tu_ngay: r.tu_ngay || todayIso,
          den_ngay: r.den_ngay || null,
        };
      });

      preparedRoleAssignments = [
        {
          ma_vai_tro: primaryRole,
          pham_vi: primaryScope,
          don_vi_id: primaryScope === 'toan_truong' ? null : primaryDeptId,
          duoc_uy_quyen: DEPUTY_DELEGATION_ROLES.has(primaryRole) ? primaryRoleDelegated : false,
          tu_ngay: primaryRoleStartDate || todayIso,
          den_ngay: null,
        },
        ...normalizedSecondaryRows,
      ];
    }

    setSubmitting(true);
    try {

      if (editingUser) {
        const updatePayload: UpdateUserPayload = {
          ho_ten: formData.ho_ten.trim(),
          email: formData.email.trim(),
          ma_can_bo: staffCode,
          vai_tro_chinh: primaryRole,
          don_vi_chinh_id: primaryDeptId,
          ...(preparedRoleAssignments ? { danh_sach_vai_tro: preparedRoleAssignments } : {}),
          so_dien_thoai: formData.so_dien_thoai?.trim() || undefined,
          chuc_vu: formData.chuc_vu?.trim() || undefined,
          hoc_ham: formData.hoc_ham,
          hoc_vi: formData.hoc_vi,
          loai_nhan_su: formData.loai_nhan_su,
          loai_hop_dong: formData.loai_hop_dong,
          ngach_luong: formData.ngach_luong,
          he_so_luong: Number(formData.he_so_luong),
          so_nguoi_phu_thuoc: Number(formData.so_nguoi_phu_thuoc),
          han_muc_phep_nam: Number(formData.han_muc_phep_nam),
          gioi_tinh: formData.gioi_tinh,
          ngay_sinh: formData.ngay_sinh || undefined,
          ngay_vao_lam: formData.ngay_vao_lam || undefined,
          dia_chi: formData.dia_chi?.trim() || '',
          trang_thai_lam_viec: formData.trang_thai_lam_viec,
          ...(canCreateOrDelete && editingUser.anh_dai_dien && !formData.anh_dai_dien?.trim()
            ? { anh_dai_dien: null }
            : {}),
          ngay_het_han_hop_dong: formData.ngay_het_han_hop_dong || null,
          ngay_bat_dau_giang_day: formData.ngay_bat_dau_giang_day || null,
          so_cccd: formData.so_cccd?.trim() || null,
          ma_so_thue: formData.ma_so_thue?.trim() || null,
          so_tai_khoan_ngan_hang: formData.so_tai_khoan_ngan_hang?.trim() || null,
          ten_ngan_hang: formData.ten_ngan_hang?.trim() || null,
          chi_nhanh_ngan_hang: formData.chi_nhanh_ngan_hang?.trim() || null,
          kich_hoat: formData.kich_hoat,
        };
        if (formData.mat_khau && formData.mat_khau.trim().length > 0) {
          updatePayload.mat_khau = formData.mat_khau.trim();
        }

        await userApi.updateUser(editingUser.id, updatePayload);
        toast.success(`Đã cập nhật hồ sơ của ${formData.ho_ten}!`);
      } else {
        if (!formData.mat_khau || formData.mat_khau.length < 6) {
          toast.error('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.');
          setSubmitting(false);
          return;
        }
        const createPayload: CreateUserPayload = {
          ho_ten: formData.ho_ten.trim(),
          email: formData.email.trim().toLowerCase(),
          mat_khau: formData.mat_khau,
          ma_can_bo: staffCode,
          vai_tro_chinh: primaryRole,
          don_vi_chinh_id: primaryDeptId,
          ...(preparedRoleAssignments ? { danh_sach_vai_tro: preparedRoleAssignments } : {}),
          so_dien_thoai: formData.so_dien_thoai?.trim() || undefined,
          chuc_vu: formData.chuc_vu?.trim() || undefined,
          hoc_ham: formData.hoc_ham,
          hoc_vi: formData.hoc_vi,
          loai_nhan_su: formData.loai_nhan_su,
          loai_hop_dong: formData.loai_hop_dong,
          ngach_luong: formData.ngach_luong,
          he_so_luong: Number(formData.he_so_luong),
          so_nguoi_phu_thuoc: Number(formData.so_nguoi_phu_thuoc),
          han_muc_phep_nam: Number(formData.han_muc_phep_nam),
          gioi_tinh: formData.gioi_tinh,
          ngay_sinh: formData.ngay_sinh || undefined,
          ngay_vao_lam: formData.ngay_vao_lam || undefined,
          dia_chi: formData.dia_chi?.trim() || '',
          trang_thai_lam_viec: formData.trang_thai_lam_viec,
          ngay_het_han_hop_dong: formData.ngay_het_han_hop_dong || null,
          ngay_bat_dau_giang_day: formData.ngay_bat_dau_giang_day || null,
          so_cccd: formData.so_cccd?.trim() || null,
          ma_so_thue: formData.ma_so_thue?.trim() || null,
          so_tai_khoan_ngan_hang: formData.so_tai_khoan_ngan_hang?.trim() || null,
          ten_ngan_hang: formData.ten_ngan_hang?.trim() || null,
          chi_nhanh_ngan_hang: formData.chi_nhanh_ngan_hang?.trim() || null,
        };
        await userApi.createUser(createPayload);
        toast.success(`Đã tạo tài khoản cán bộ ${formData.ho_ten} thành công!`);
      }

      setIsFormModalOpen(false);
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi lưu hồ sơ cán bộ.', { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActiveStatus = async (u: UserProfile) => {
    const nextState = u.kich_hoat === false;
    const parsed = formatNameAndTitle(u.ho_ten);
    const confirmMsg = nextState
      ? `Kích hoạt lại tài khoản của "${parsed.name}"?`
      : `Khóa / Vô hiệu hóa tài khoản của "${parsed.name}"? Toàn bộ phiên đăng nhập của người dùng này sẽ bị thu hồi.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (!nextState) {
        await userApi.deleteUser(u.id);
        toast.success(`Đã vô hiệu hóa tài khoản của ${parsed.name}.`);
      } else {
        await userApi.updateUser(u.id, { kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec' });
        toast.success(`Đã mở khóa tài khoản của ${parsed.name}.`);
      }
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.', { duration: 6000 });
    }
  };

  const handleDeleteFaceData = async (u: UserProfile) => {
    const parsed = formatNameAndTitle(u.ho_ten);
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa dữ liệu sinh trắc học Face ID 512D của "${parsed.name}"? Cán bộ sẽ cần đăng ký lại khuôn mặt 5 góc để chấm công.`
      )
    ) {
      return;
    }

    try {
      await userApi.deleteFaceDescriptor(u.id);
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
                variant="outline"
                size="sm"
                onClick={() => setIsImportExcelModalOpen(true)}
                leftIcon={<Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                title="Thêm nhanh nhiều nhân sự từ file Excel (.xlsx)"
              >
                <span className="hidden sm:inline">Nhập Excel</span>
              </Button>
            )}

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

      {/* ── FLUX STATS ROW: 4 SEPARATE METRIC CARDS ── */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng cán bộ',
            value: stats.total,
            badge: `${stats.activeCount} công tác`,
            subtext: 'Toàn hệ thống',
            tone: 'neutral',
            active: filterTab === 'all',
            onClick: () => {
              setFilterTab('all');
              setCurrentPage(1);
            },
          },
          {
            label: 'Khối giảng dạy',
            value: stats.lecturerCount,
            badge: `${stats.pgsTsCount} PGS/TS`,
            subtext: 'Giảng viên & nghiên cứu',
            tone: 'brand',
            active: filterTab === 'giang_vien',
            onClick: () => {
              setFilterTab((prev) => (prev === 'giang_vien' ? 'all' : 'giang_vien'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Đã có Face ID',
            value: stats.faceRegCount,
            badge: `${stats.facePercent}%`,
            progress: stats.facePercent,
            tone: 'success',
            active: filterTab === 'face_yes',
            onClick: () => {
              setFilterTab((prev) => (prev === 'face_yes' ? 'all' : 'face_yes'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Khoa / Phòng ban',
            value: departments.length,
            badge: `${stats.leadershipCount} lãnh đạo`,
            subtext: 'Đơn vị trực thuộc',
            tone: 'warning',
            active: filterTab === 'leadership',
            onClick: () => {
              setFilterTab((prev) => (prev === 'leadership' ? 'all' : 'leadership'));
              setCurrentPage(1);
            },
          },
        ]}
      />

      {/* ── MAIN STAFF WORKSPACE CARD (FLUX STYLE) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Thanh công cụ tìm kiếm & lọc 1 hàng Flux Style */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm */}
          <SearchInput
            value={searchTerm}
            onChange={(next) => {
              setSearchTerm(next);
              setCurrentPage(1);
            }}
            debounceMs={180}
            placeholder="Tìm tên cán bộ, mã CB, email, SĐT..."
            className="relative flex-1 min-w-[220px]"
          />

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
              className="h-9 appearance-none pl-3 pr-8 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 cursor-pointer transition-all"
              aria-label="Phân loại cán bộ"
            >
              <option value="all">Tất cả ({stats.total})</option>
              <option value="giang_vien">Khối Giảng dạy ({stats.lecturerCount})</option>
              <option value="leadership">Lãnh đạo ({stats.leadershipCount})</option>
              <option value="hanhchinh">Khối Hành chính ({stats.adminStaffCount})</option>
              <option value="face_yes">Đã có Face ID ({stats.faceRegCount})</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Chế độ xem */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl h-9 shrink-0">
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
              <div className="hidden lg:grid grid-cols-[1.6fr_1.1fr_1.25fr_1fr_130px_145px] gap-3 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider items-center select-none">
                <div className="min-w-0">Cán bộ / Giảng viên</div>
                <div className="min-w-0">Mã CB &amp; Liên hệ</div>
                <div className="min-w-0">Khoa / Đơn vị &amp; Vai trò</div>
                <div className="min-w-0">Học hàm • Ngạch lương</div>
                <div className="text-center">Face ID / Trạng thái</div>
                <div className="text-right">Thao tác</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedUsers.map((emp) => {
                  const isRegistered = Boolean(emp.da_dang_ky_face);
                  const parsed = formatNameAndTitle(emp.ho_ten || '');
                  const staffCodeVal =
                    emp.ma_can_bo || (emp.id ? `CB-${emp.id.slice(-4).toUpperCase()}` : '—');
                  const deptNameVal = getDepartmentName(emp, departments);
                  const roleMeta = getRoleMeta(emp.vai_tro_chinh);
                  const academicPrefix = getAcademicPrefix(emp);

                  return (
                    <div
                      key={emp.id}
                      className={`p-3 sm:px-4 sm:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:grid lg:grid-cols-[1.6fr_1.1fr_1.25fr_1fr_130px_145px] gap-2 lg:gap-3 items-start lg:items-center w-full min-w-0 ${
                        emp.kich_hoat === false ? 'opacity-60 bg-slate-50/40 dark:bg-slate-950/30' : ''
                      }`}
                    >
                      {/* Cột 1: Avatar + Họ tên + Chức danh */}
                      <div className="w-full lg:w-auto min-w-0 flex items-center justify-between lg:justify-start gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <StaffAvatar
                            user={emp}
                            size="sm"
                          />
                          <div className="flex flex-col min-w-0 flex-1 leading-tight">
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(emp)}
                              className="font-semibold text-slate-800 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 text-xs truncate text-left transition-colors cursor-pointer"
                              title={parsed.name}
                            >
                              {parsed.name}
                            </button>
                            <span
                              className="text-[11px] text-slate-400 dark:text-slate-500 truncate block mt-0.5"
                              title={parsed.title || (typeof emp.chuc_vu === 'string' ? emp.chuc_vu : '')}
                            >
                              {parsed.title || (typeof emp.chuc_vu === 'string' && emp.chuc_vu) || 'Cán bộ cơ hữu'}
                            </span>
                          </div>
                        </div>

                        <span className="lg:hidden text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0 tabular-nums font-mono">
                          {staffCodeVal}
                        </span>
                      </div>

                      {/* Cột 2: Mã CB / Email */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5 leading-tight">
                        <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 tabular-nums truncate">
                          {staffCodeVal}
                        </span>
                        <span
                          className="text-[11px] text-slate-400 dark:text-slate-500 truncate block font-normal"
                          title={emp.email}
                        >
                          {emp.email}
                        </span>
                      </div>

                      {/* Cột 3: Khoa / Đơn vị & Vai trò */}
                      <div className="w-full lg:w-auto min-w-0 flex flex-col gap-1 leading-tight">
                        <span
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs max-w-full min-w-0"
                          title={deptNameVal}
                        >
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.label}
                        </span>
                      </div>

                      {/* Cột 4: Học hàm / Ngạch lương */}
                      <div className="hidden lg:flex min-w-0 flex-col gap-0.5 leading-tight">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {academicPrefix || 'Cử nhân / Kỹ sư'} •{' '}
                          {emp.loai_nhan_su === 'giang_vien' ? 'Giảng dạy' : 'Hành chính'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-mono">
                          Ngạch {emp.ngach_luong || 'V.07.01.03'} (HS {(emp.he_so_luong ?? 2.34).toFixed(2)})
                        </span>
                      </div>

                      {/* Cột 5: Trạng thái Face ID & Tài khoản */}
                      <div className="w-full lg:w-auto min-w-0 flex items-center justify-between lg:justify-center shrink-0">
                        <div className="flex flex-col items-start lg:items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1 shrink-0 ${
                              isRegistered
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isRegistered ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Face ID</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                <span>Chưa Face ID</span>
                              </>
                            )}
                          </span>
                          {(emp.kich_hoat === false || (emp.trang_thai_lam_viec && emp.trang_thai_lam_viec !== 'dang_lam_viec')) && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              {emp.kich_hoat === false
                                ? 'Đã khóa TK'
                                : EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === emp.trang_thai_lam_viec)?.label || emp.trang_thai_lam_viec}
                            </span>
                          )}
                        </div>

                        {/* Cụm nút trên Mobile */}
                        <div className="lg:hidden flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(emp)}
                            className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(emp)}
                              className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 text-brand-600 flex items-center justify-center"
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
                          onClick={() => handleOpenDetailModal(emp)}
                          className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                          title="Xem hồ sơ chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="w-7 h-7 rounded-full text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors flex items-center justify-center cursor-pointer"
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
                              emp.kich_hoat === false
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                            title={emp.kich_hoat === false ? 'Mở khóa tài khoản' : 'Khóa / Vô hiệu hóa tài khoản'}
                          >
                            {emp.kich_hoat === false ? (
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
                const isRegistered = Boolean(emp.da_dang_ky_face);
                const parsed = formatNameAndTitle(emp.ho_ten || '');
                const staffCodeVal =
                  emp.ma_can_bo || (emp.id ? `CB-${emp.id.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = getDepartmentName(emp, departments);
                const roleMeta = getRoleMeta(emp.vai_tro_chinh);

                return (
                  <div
                    key={emp.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <StaffAvatar
                            user={emp}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <h4
                              onClick={() => handleOpenDetailModal(emp)}
                              className="font-bold text-slate-900 dark:text-white hover:text-brand-600 text-sm truncate cursor-pointer"
                              title={parsed.name}
                            >
                              {parsed.name}
                            </h4>
                            <p
                              className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate"
                              title={parsed.title || (typeof emp.chuc_vu === 'string' ? emp.chuc_vu : '')}
                            >
                              {parsed.title || (typeof emp.chuc_vu === 'string' && emp.chuc_vu) || 'Cán bộ cơ hữu'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
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
                          {(emp.kich_hoat === false || (emp.trang_thai_lam_viec && emp.trang_thai_lam_viec !== 'dang_lam_viec')) && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {emp.kich_hoat === false
                                ? 'Đã khóa'
                                : EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === emp.trang_thai_lam_viec)?.label || emp.trang_thai_lam_viec}
                            </span>
                          )}
                        </div>
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
                        onClick={() => handleOpenDetailModal(emp)}
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
                          const isRegistered = Boolean(emp.da_dang_ky_face);
                          const parsed = formatNameAndTitle(emp.ho_ten || '');
                          const staffCodeVal =
                            emp.ma_can_bo || (emp.id ? `CB-${emp.id.slice(-4).toUpperCase()}` : '—');
                          const roleMeta = getRoleMeta(emp.vai_tro_chinh);

                          return (
                            <div
                              key={emp.id}
                              className="p-3 sm:px-4 sm:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <StaffAvatar
                                  user={emp}
                                  size="md"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDetailModal(emp)}
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
                                  onClick={() => handleOpenDetailModal(emp)}
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
        <ThanhPhanTrang
          currentPage={validCurrentPage}
          totalPages={totalPages}
          totalItems={totalFilteredCount}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          itemLabel="cán bộ, giảng viên"
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ── 4. MODAL THÊM / CẬP NHẬT HỒ SƠ CÁN BỘ ───────────────────────────── */}
      {isFormModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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
              {/* Cột trái: Ảnh đại diện mặc định / hiện tại & thông tin tóm tắt */}
              <HoSoBenTrai
                className="md:w-64 md:shrink-0 md:border-r border-b md:border-b-0 bg-slate-50/60 dark:bg-slate-900/80 max-h-56 md:max-h-none"
                anhDaiDien={
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl overflow-hidden shadow-md ring-4 ring-white dark:ring-slate-800">
                    {editingUser && formData.anh_dai_dien ? (
                      <AnhBaoMat
                        src={formData.anh_dai_dien}
                        alt={formData.ho_ten || 'Avatar'}
                        className="w-full h-full object-cover"
                        fallback={getInitials(formData.ho_ten || 'CB')}
                      />
                    ) : (
                      getInitials(formData.ho_ten || 'CB')
                    )}
                  </div>
                }
                maCanBo={formData.ma_can_bo || (editingUser ? '' : 'MÃ MỚI')}
                trangThai={editingUser ? 'Đang cập nhật hồ sơ' : 'Thêm mới hồ sơ'}
                hoTen={formData.ho_ten || 'Cán bộ / Giảng viên'}
                lienHe={[
                  { icon: <Mail className="w-3.5 h-3.5" />, text: formData.email || 'Chưa nhập email' },
                  {
                    icon: <Phone className="w-3.5 h-3.5" />,
                    text: formData.so_dien_thoai || 'Chưa nhập số điện thoại',
                  },
                ]}
                thaoTac={
                  <div className="space-y-2 w-full">
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 text-center">
                      {editingUser
                        ? 'Ảnh đại diện do cán bộ tự cập nhật tại mục Hồ sơ cá nhân.'
                        : 'Ảnh đại diện khởi tạo mặc định. Cán bộ sẽ tự cập nhật tại Hồ sơ cá nhân.'}
                    </p>
                    {editingUser && canCreateOrDelete && formData.anh_dai_dien && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, anh_dai_dien: '' }));
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Đặt lại ảnh mặc định</span>
                      </button>
                    )}
                  </div>
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
            <form noValidate onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formValidationErrors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-bold">Vui lòng kiểm tra và điền đầy đủ thông tin bắt buộc (kiểm tra cả 3 tab):</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {formValidationErrors.map((errMsg, idx) => (
                        <li key={idx}>{errMsg}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {activeFormTab === 'basic' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Họ và tên đầy đủ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.ho_ten}
                      onChange={(e) => setFormData({ ...formData, ho_ten: e.target.value })}
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
                      value={formData.ma_can_bo}
                      onChange={(e) => setFormData({ ...formData, ma_can_bo: e.target.value.toUpperCase() })}
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
                      value={formData.mat_khau}
                      onChange={(e) => setFormData({ ...formData, mat_khau: e.target.value })}
                      placeholder={editingUser ? '••••••••' : 'Tối thiểu 6 ký tự'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số điện thoại liên hệ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.so_dien_thoai || ''}
                      onChange={(e) => setFormData({ ...formData, so_dien_thoai: e.target.value })}
                      placeholder="VD: 0912345678"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vai trò hệ thống (RBAC) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.vai_tro_chinh}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      disabled={isUnitLeaderViewer}
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
                      value={formData.don_vi_chinh_id}
                      onChange={handleDepartmentChange}
                      role={formData.vai_tro_chinh}
                      disabled={isUnitLeaderViewer || formData.vai_tro_chinh === 'bgh'}
                      required
                    />
                    {formData.vai_tro_chinh === 'bgh' && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1">
                        * Cán bộ Ban Giám Hiệu (BGH) được tự động cố định tại Hội Đồng Trường & Ban Giám Hiệu.
                      </p>
                    )}
                    {formData.vai_tro_chinh === 'admin' && (
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                        * Quản trị viên (Admin) có thể thuộc Hội Đồng Trường hoặc các Ban chức năng của NTU.
                      </p>
                    )}
                  </div>

                  {canCreateOrDelete && (() => {
                    const currentPrimaryRole = formData.vai_tro_chinh || 'giang_vien';
                    const isPrimaryDeputy = DEPUTY_DELEGATION_ROLES.has(currentPrimaryRole);

                    return (
                      <div className="sm:col-span-2 space-y-2.5">
                        {/* Chỉ hiện nút gạt ủy quyền khi vai trò chính là cấp Phó đơn vị */}
                        {isPrimaryDeputy && (
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                Ủy quyền duyệt đơn thay Trưởng đơn vị
                              </p>
                              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                                Cho phép duyệt đơn nghỉ phép, đổi ca cấp 1 tại đơn vị khi Trưởng đơn vị vắng mặt.
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={primaryRoleDelegated}
                              onClick={() => {
                                setPrimaryRoleDelegated((prev) => !prev);
                                setRoleAssignmentsDirty(true);
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                primaryRoleDelegated
                                  ? 'bg-brand-600'
                                  : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  primaryRoleDelegated ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </div>
                        )}

                        {/* Chức vụ kiêm nhiệm: mặc định thu gọn 1 dòng, chỉ mở khung khi có dòng kiêm nhiệm */}
                        {roleAssignments.length === 0 ? (
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Chức vụ kiêm nhiệm (nếu cán bộ đảm nhiệm thêm vai trò khác)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddSecondaryRole}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Kiêm nhiệm chức vụ khác</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  Chức vụ kiêm nhiệm ({roleAssignments.length})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleAddSecondaryRole}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm</span>
                              </button>
                            </div>

                            <div className="space-y-2">
                              {roleAssignments.map((ra, rIdx) => {
                                const isGlobalSecondary = GLOBAL_SCOPE_ROLES.has(ra.ma_vai_tro);
                                const isDeputySecondary = DEPUTY_DELEGATION_ROLES.has(ra.ma_vai_tro);
                                const otherLecturerDeptIds = [
                                  ...(formData.vai_tro_chinh === 'giang_vien' && formData.don_vi_chinh_id
                                    ? [String(formData.don_vi_chinh_id)]
                                    : []),
                                  ...roleAssignments
                                    .filter((other, oIdx) => oIdx !== rIdx && other.ma_vai_tro === 'giang_vien' && other.don_vi_id)
                                    .map((other) => String(other.don_vi_id)),
                                ];
                                const hasParentChildLecturerConflict =
                                  ra.ma_vai_tro === 'giang_vien' &&
                                  Boolean(ra.don_vi_id) &&
                                  otherLecturerDeptIds.some((otherId) =>
                                    isParentChildDeptConflict(ra.don_vi_id, otherId, departments)
                                  );
                                const rawAllowedDepts = getAllowedDeptsForSecondaryRole(ra.ma_vai_tro, departments);
                                const allowedDepts =
                                  ra.ma_vai_tro === 'giang_vien'
                                    ? rawAllowedDepts.filter((d) => {
                                        if (String(d.id) === String(ra.don_vi_id || '')) return true;
                                        if (otherLecturerDeptIds.includes(String(d.id))) return false;
                                        return !otherLecturerDeptIds.some((otherId) =>
                                          isParentChildDeptConflict(d.id, otherId, departments)
                                        );
                                      })
                                    : rawAllowedDepts;
                                const isLegacyOption = !secondaryRoleOptions.some((o) => o.value === ra.ma_vai_tro);
                                const legacyMeta = isLegacyOption ? getRoleMeta(ra.ma_vai_tro) : null;
                                const showDateRow = Boolean(expandedRoleDateRows[rIdx] || ra.den_ngay);

                                return (
                                  <div
                                    key={rIdx}
                                    className={`p-2.5 rounded-lg bg-white dark:bg-slate-900 border space-y-2 ${
                                      hasParentChildLecturerConflict
                                        ? 'border-rose-300 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20'
                                        : 'border-slate-200/90 dark:border-slate-700'
                                    }`}
                                  >
                                    {/* 1 hàng ngang duy nhất: Chức vụ + Đơn vị + Đặt hạn + Xóa */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <select
                                        aria-label="Chức vụ kiêm nhiệm"
                                        value={ra.ma_vai_tro}
                                        onChange={(e) => {
                                          const nextRole = e.target.value;
                                          const nextIsGlobal = GLOBAL_SCOPE_ROLES.has(nextRole);
                                          const baseAllowedDepts = getAllowedDeptsForSecondaryRole(nextRole, departments);
                                          const nextAllowedDepts =
                                            nextRole === 'giang_vien'
                                              ? baseAllowedDepts.filter(
                                                  (d) =>
                                                    !otherLecturerDeptIds.includes(String(d.id)) &&
                                                    !otherLecturerDeptIds.some((otherId) =>
                                                      isParentChildDeptConflict(d.id, otherId, departments)
                                                    )
                                                )
                                              : baseAllowedDepts;
                                          setRoleAssignments((prev) =>
                                            prev.map((item, idx) => {
                                              if (idx !== rIdx) return item;
                                              const keepCurrentDept =
                                                !nextIsGlobal &&
                                                item.don_vi_id &&
                                                nextAllowedDepts.some((d) => String(d.id) === String(item.don_vi_id));
                                              const nextDeptId = nextIsGlobal
                                                ? null
                                                : keepCurrentDept
                                                  ? item.don_vi_id
                                                  : nextAllowedDepts[0]?.id || null;
                                              return {
                                                ...item,
                                                ma_vai_tro: nextRole,
                                                don_vi_id: nextDeptId,
                                                pham_vi: inferRoleScope(nextRole, nextDeptId, departments),
                                                duoc_uy_quyen: DEPUTY_DELEGATION_ROLES.has(nextRole)
                                                  ? Boolean(item.duoc_uy_quyen)
                                                  : false,
                                              };
                                            })
                                          );
                                          setRoleAssignmentsDirty(true);
                                        }}
                                        className="w-full sm:w-[44%] h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                      >
                                        {isLegacyOption && legacyMeta && (
                                          <option value={ra.ma_vai_tro} disabled>
                                            {legacyMeta.label} (Vui lòng đổi hoặc xóa)
                                          </option>
                                        )}
                                        {secondaryRoleOptions.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>

                                      {isGlobalSecondary ? (
                                        <div className="flex-1 h-9 px-3 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center text-xs text-slate-500 dark:text-slate-400">
                                          Toàn trường
                                        </div>
                                      ) : (
                                        <select
                                          aria-label="Đơn vị kiêm nhiệm"
                                          value={ra.don_vi_id || ''}
                                          onChange={(e) => {
                                            const nextDept = e.target.value || null;
                                            setRoleAssignments((prev) =>
                                              prev.map((item, idx) =>
                                                idx === rIdx
                                                  ? {
                                                      ...item,
                                                      don_vi_id: nextDept,
                                                      pham_vi: inferRoleScope(item.ma_vai_tro, nextDept, departments),
                                                    }
                                                  : item
                                              )
                                            );
                                            setRoleAssignmentsDirty(true);
                                          }}
                                          className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        >
                                          <option value="">-- Chọn đơn vị --</option>
                                          {allowedDepts.map((d) => (
                                            <option key={d.id} value={d.id}>
                                              {d.ten_phong_ban}
                                            </option>
                                          ))}
                                        </select>
                                      )}

                                      <div className="flex items-center justify-end gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedRoleDateRows((prev) => ({
                                              ...prev,
                                              [rIdx]: !showDateRow,
                                            }))
                                          }
                                          title={ra.den_ngay ? `Hiệu lực đến ${ra.den_ngay}` : 'Đặt ngày hết hiệu lực (tùy chọn)'}
                                          className={`inline-flex items-center gap-1 h-9 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                            showDateRow
                                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                                              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                          }`}
                                        >
                                          <Calendar className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">{ra.den_ngay ? 'Có hạn' : 'Đặt hạn'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRoleAssignments((prev) => prev.filter((_, idx) => idx !== rIdx));
                                            setExpandedRoleDateRows((prev) => {
                                              const next: Record<number, boolean> = {};
                                              Object.entries(prev).forEach(([k, v]) => {
                                                const idxNum = Number(k);
                                                if (idxNum < rIdx) next[idxNum] = v;
                                                else if (idxNum > rIdx) next[idxNum - 1] = v;
                                              });
                                              return next;
                                            });
                                            setRoleAssignmentsDirty(true);
                                          }}
                                          title="Xóa chức vụ kiêm nhiệm"
                                          className="h-9 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {hasParentChildLecturerConflict && (
                                      <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          Trùng phạm vi Khoa – Bộ môn trực thuộc với vai trò Giảng viên khác. Hãy chọn Khoa khác hoặc xóa dòng này.
                                        </span>
                                      </p>
                                    )}

                                    {/* Dòng phụ CHỈ hiện khi là cấp Phó (nút gạt ủy quyền) hoặc khi người dùng bật "Đặt hạn" */}
                                    {(isDeputySecondary || showDateRow) && (
                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        {isDeputySecondary ? (
                                          <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300 cursor-pointer select-none">
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
                                              className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500"
                                            />
                                            <span>Ủy quyền duyệt đơn thay Trưởng đơn vị</span>
                                          </label>
                                        ) : (
                                          <span />
                                        )}

                                        {showDateRow && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                              Hiệu lực đến:
                                            </span>
                                            <input
                                              type="date"
                                              min={ra.tu_ngay || undefined}
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
                                              className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                            />
                                            {ra.den_ngay && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setRoleAssignments((prev) =>
                                                    prev.map((item, idx) =>
                                                      idx === rIdx ? { ...item, den_ngay: null } : item
                                                    )
                                                  );
                                                  setExpandedRoleDateRows((prev) => ({ ...prev, [rIdx]: false }));
                                                  setRoleAssignmentsDirty(true);
                                                }}
                                                title="Xóa ngày hết hạn (vô thời hạn)"
                                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giới tính
                    </label>
                    <select
                      value={formData.gioi_tinh}
                      onChange={(e) => setFormData({ ...formData, gioi_tinh: e.target.value as GenderType })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="nam">Nam</option>
                      <option value="nu">Nữ</option>
                      <option value="khac">Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày sinh <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.ngay_sinh || ''}
                      onChange={(e) => setFormData({ ...formData, ngay_sinh: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Số CCCD / CMND <span className="text-rose-500">*</span>
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
                      Chức vụ / Chức danh <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.chuc_vu || ''}
                      onChange={(e) => setFormData({ ...formData, chuc_vu: e.target.value })}
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
                      value={formData.hoc_ham}
                      onChange={(e) => setFormData({ ...formData, hoc_ham: e.target.value as AcademicRankType })}
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
                      value={formData.hoc_vi}
                      onChange={(e) => setFormData({ ...formData, hoc_vi: e.target.value as DegreeType })}
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
                      value={formData.loai_nhan_su}
                      onChange={(e) => setFormData({ ...formData, loai_nhan_su: e.target.value as StaffType })}
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
                      value={formData.loai_hop_dong}
                      onChange={(e) => {
                        const nextContract = e.target.value as ContractType;
                        const isVisiting = nextContract === 'thinh_giang' || nextContract === 'hop_dong_vu_viec';
                        setFormData({
                          ...formData,
                          loai_hop_dong: nextContract,
                          he_so_luong: isVisiting ? 0 : (Number(formData.he_so_luong) <= 0 ? 2.34 : formData.he_so_luong),
                        });
                      }}
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
                      value={formData.trang_thai_lam_viec}
                      onChange={(e) =>
                        setFormData({ ...formData, trang_thai_lam_viec: e.target.value as EmploymentStatusType })
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
                      Ngày vào trường công tác <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.ngay_vao_lam || ''}
                      onChange={(e) => setFormData({ ...formData, ngay_vao_lam: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày bắt đầu giảng dạy
                      {(formData.loai_nhan_su === 'giang_vien' ||
                        ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(
                          formData.vai_tro_chinh || ''
                        )) && <span className="text-rose-500"> *</span>}
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
                      {['ban_thoi_gian', 'thinh_giang', 'hop_dong_vu_viec'].includes(formData.loai_hop_dong || '') && (
                        <span className="text-rose-500"> *</span>
                      )}
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
                      Địa chỉ thường trú / Liên hệ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.dia_chi || ''}
                      onChange={(e) => setFormData({ ...formData, dia_chi: e.target.value })}
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
                      value={formData.ngach_luong}
                      onChange={(e) => {
                        const preset = SALARY_SCALE_PRESETS.find((p) => p.code === e.target.value);
                        setFormData({
                          ...formData,
                          ngach_luong: e.target.value,
                          he_so_luong: preset ? preset.defaultCoeff : formData.he_so_luong,
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
                      Hệ số lương hiện hưởng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="30"
                      value={formData.he_so_luong}
                      onChange={(e) => setFormData({ ...formData, he_so_luong: Number(e.target.value) })}
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
                      value={formData.so_nguoi_phu_thuoc}
                      onChange={(e) => setFormData({ ...formData, so_nguoi_phu_thuoc: Number(e.target.value) })}
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
                      value={formData.han_muc_phep_nam}
                      onChange={(e) => setFormData({ ...formData, han_muc_phep_nam: Number(e.target.value) })}
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
                          checked={formData.kich_hoat !== false}
                          onChange={(e) => setFormData({ ...formData, kich_hoat: e.target.checked })}
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
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
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
                {(() => {
                  const isAccountLocked = detailUser.kich_hoat === false;
                  const workStatusLabel = isAccountLocked
                    ? 'Tài khoản đã khóa'
                    : EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === detailUser.trang_thai_lam_viec)?.label ||
                      'Đang làm việc';
                  const isWorkingActive =
                    !isAccountLocked && detailUser.trang_thai_lam_viec !== 'da_nghi_viec';
                  const primaryCode = normalizeRoleKey(detailUser.vai_tro_chinh);
                  const primaryDeptId = GLOBAL_SCOPE_ROLES.has(primaryCode)
                    ? null
                    : (getDepartmentIdValue(detailUser) || null);
                  const todayIso = getTodayVietnamIso();
                  const secondaryActiveCount = (Array.isArray(detailUser.danh_sach_vai_tro)
                    ? detailUser.danh_sach_vai_tro
                    : []
                  ).filter((r: any) => {
                    if (!r) return false;
                    const code = normalizeRoleKey(r?.ma_vai_tro);
                    const rawDept =
                      r?.don_vi_id && typeof r.don_vi_id === 'object'
                        ? String(r.don_vi_id.id || '')
                        : r?.don_vi_id
                          ? String(r.don_vi_id)
                          : '';
                    const effDept = GLOBAL_SCOPE_ROLES.has(code) ? null : (rawDept || null);
                    const isPrimary =
                      code === primaryCode &&
                      String(effDept || '') === String(primaryDeptId || '');
                    if (isPrimary) return false;
                    const endIso = toDateInputValue(r?.den_ngay);
                    return !endIso || endIso >= todayIso;
                  }).length;

                  return (
                    <HoSoBenTrai
                      className="md:w-64 md:shrink-0 md:border-r border-b md:border-b-0 bg-slate-50/60 dark:bg-slate-900/80 max-h-60 md:max-h-none"
                      anhDaiDien={
                        <StaffAvatar
                          user={detailUser}
                          size="xl"
                        />
                      }
                      maCanBo={detailUser.ma_can_bo || 'CHƯA CẤP MÃ'}
                      trangThai={workStatusLabel}
                      trangThaiHoatDong={isWorkingActive}
                      hoTen={formatNameAndTitle(detailUser.ho_ten).name}
                      thongTinChinh={[
                        {
                          icon: <Building2 className="w-3.5 h-3.5" />,
                          text: getDepartmentName(detailUser, departments),
                        },
                        {
                          icon: <UsersIcon className="w-3.5 h-3.5" />,
                          text:
                            detailUser.chuc_vu ||
                            formatNameAndTitle(detailUser.ho_ten).title ||
                            getRoleMeta(detailUser.vai_tro_chinh).label,
                        },
                      ]}
                      lienHe={[
                        { icon: <Phone className="w-3.5 h-3.5" />, text: detailUser.so_dien_thoai || 'Chưa cập nhật' },
                        { icon: <Mail className="w-3.5 h-3.5" />, text: detailUser.email },
                      ]}
                      cacNhomPhu={[
                        {
                          tieuDe: 'Ngày vào trường',
                          noiDung: formatDateVN(detailUser.ngay_vao_lam),
                        },
                        { tieuDe: 'Vai trò chính', noiDung: getRoleMeta(detailUser.vai_tro_chinh).label },
                        ...(secondaryActiveCount > 0
                          ? [{ tieuDe: 'Kiêm nhiệm', noiDung: `${secondaryActiveCount} chức vụ đang hiệu lực` }]
                          : []),
                      ]}
                    />
                  );
                })()}

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

                      if (detailTab === 'chi_tiet') {
                        const academicRankLabel =
                          detailUser.hoc_ham && detailUser.hoc_ham !== 'khong'
                            ? ACADEMIC_RANK_OPTIONS.find((a) => a.value === detailUser.hoc_ham)?.label || ''
                            : '';
                        const degreeLabel = detailUser.hoc_vi
                          ? DEGREE_OPTIONS.find((d) => d.value === detailUser.hoc_vi)?.label || ''
                          : '';
                        const academicSummary = [academicRankLabel, degreeLabel].filter(Boolean).join(' • ') || 'Chưa cập nhật';
                        const isLecturerDetail =
                          detailUser.loai_nhan_su === 'giang_vien' || Boolean(detailUser.ngay_bat_dau_giang_day);
                        const contractExpiryDisplay = detailUser.ngay_het_han_hop_dong
                          ? formatDateVN(detailUser.ngay_het_han_hop_dong)
                          : detailUser.loai_hop_dong === 'toan_thoi_gian'
                            ? 'Không thời hạn'
                            : 'Chưa cập nhật';

                        return (
                          <div className="space-y-5">
                            <div>
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                1. Thông tin cá nhân &amp; định danh
                              </h4>
                              <div className={grid}>
                                <Field label="Họ và tên" value={formatNameAndTitle(detailUser.ho_ten).name} />
                                <Field label="Mã cán bộ" value={detailUser.ma_can_bo || '—'} mono />
                                <Field
                                  label="Giới tính"
                                  value={
                                    detailUser.gioi_tinh === 'nu' ? 'Nữ' : detailUser.gioi_tinh === 'khac' ? 'Khác' : 'Nam'
                                  }
                                />
                                <Field label="Ngày sinh" value={formatDateVN(detailUser.ngay_sinh)} />
                                <Field label="Số CCCD / CMND" value={detailUser.so_cccd || 'Chưa cập nhật'} mono />
                                <Field label="Địa chỉ" value={detailUser.dia_chi || 'Chưa cập nhật'} />
                              </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                2. Công tác, học thuật &amp; hợp đồng
                              </h4>
                              <div className={grid}>
                                <Field label="Đơn vị công tác" value={getDepartmentName(detailUser, departments)} />
                                <Field label="Chức vụ" value={detailUser.chuc_vu || 'Chưa cập nhật'} />
                                <Field
                                  label="Phân loại nhân sự"
                                  value={
                                    STAFF_TYPE_OPTIONS.find((s) => s.value === detailUser.loai_nhan_su)?.label ||
                                    'Chưa cập nhật'
                                  }
                                />
                                <Field label="Học hàm & Học vị" value={academicSummary} />
                                <Field
                                  label="Loại hợp đồng"
                                  value={
                                    CONTRACT_TYPE_OPTIONS.find((c) => c.value === detailUser.loai_hop_dong)?.label ||
                                    'Chưa cập nhật'
                                  }
                                />
                                <Field
                                  label="Trạng thái công tác"
                                  value={
                                    EMPLOYMENT_STATUS_OPTIONS.find((s) => s.value === detailUser.trang_thai_lam_viec)?.label ||
                                    'Đang làm việc'
                                  }
                                />
                                <Field
                                  label="Ngày vào trường"
                                  value={
                                    detailUser.ngay_vao_lam
                                      ? `${formatDateVN(detailUser.ngay_vao_lam)}${
                                          detailUser.tham_nien_nam && detailUser.tham_nien_nam > 0
                                            ? ` (${detailUser.tham_nien_nam} năm)`
                                            : ''
                                        }`
                                      : 'Chưa cập nhật'
                                  }
                                />
                                {isLecturerDetail && (
                                  <Field
                                    label="Ngày bắt đầu giảng dạy"
                                    value={formatDateVN(detailUser.ngay_bat_dau_giang_day)}
                                  />
                                )}
                                <Field label="Ngày hết hạn hợp đồng" value={contractExpiryDisplay} />
                              </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                                3. Lương, thuế &amp; tài khoản ngân hàng
                              </h4>
                              <div className={grid}>
                                <Field label="Ngạch lương" value={detailUser.ngach_luong || 'Chưa cập nhật'} mono />
                                <Field
                                  label="Hệ số lương"
                                  value={
                                    detailUser.he_so_luong !== undefined && detailUser.he_so_luong !== null
                                      ? Number(detailUser.he_so_luong).toFixed(2)
                                      : 'Chưa cập nhật'
                                  }
                                  mono
                                />
                                <Field
                                  label="Phép năm / Người phụ thuộc"
                                  value={`${detailUser.han_muc_phep_nam ?? 12} ngày • ${
                                    detailUser.so_nguoi_phu_thuoc ?? 0
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
                        const sampleQty = detailUser.so_luong_mau || 0;
                        return (
                          <div className="space-y-4">
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-3.5">
                                {detailUser.anh_khuon_mat ? (
                                  <AnhBaoMat
                                    src={detailUser.anh_khuon_mat}
                                    alt={detailUser.ho_ten}
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
                                      detailUser.da_dang_ky_face
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    <ScanFace className="w-6 h-6" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {detailUser.da_dang_ky_face
                                      ? `Đã đăng ký Sinh trắc học Face ID (${modelName} • ${detailUser.so_chieu_vector || 512}D)`
                                      : 'Chưa đăng ký dữ liệu khuôn mặt Face ID'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {detailUser.da_dang_ky_face
                                      ? `Trạng thái: ${detailUser.trang_thai_khuon_mat === 'bi_khoa' ? 'Tạm khóa' : 'Đang hoạt động'} • Số mẫu: ${sampleQty} mẫu (${detailUser.mac_dinh === false ? 'Mẫu phụ' : 'Mẫu mặc định'}) • Ngày đăng ký: ${
                                          detailUser.ngay_dang_ky_face
                                            ? new Date(detailUser.ngay_dang_ky_face).toLocaleDateString('vi-VN')
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
                                    {detailUser.da_dang_ky_face ? 'Cập nhật' : 'Đăng ký ngay'}
                                  </button>
                                  {detailUser.da_dang_ky_face && (
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
                      const primaryCode = normalizeRoleKey(detailUser.vai_tro_chinh);
                      const primaryDeptId = GLOBAL_SCOPE_ROLES.has(primaryCode)
                        ? null
                        : (getDepartmentIdValue(detailUser) || null);
                      const todayIso = getTodayVietnamIso();

                      const rawRoleItems = (Array.isArray(detailUser.danh_sach_vai_tro)
                        ? detailUser.danh_sach_vai_tro
                        : []) as any[];

                      const parsedRoleItems = rawRoleItems.map((r, i) => {
                        const code = normalizeRoleKey(r?.ma_vai_tro || detailUser.vai_tro_chinh);
                        const isGlobal = GLOBAL_SCOPE_ROLES.has(code);
                        const rawDeptId =
                          r?.don_vi_id && typeof r.don_vi_id === 'object'
                            ? String(r.don_vi_id.id || '')
                            : r?.don_vi_id
                              ? String(r.don_vi_id)
                              : '';
                        const effectiveDeptId = isGlobal ? null : (rawDeptId || null);
                        const matchedDept = effectiveDeptId
                          ? departments.find((d) => String(d.id) === String(effectiveDeptId))
                          : null;
                        const deptName = isGlobal
                          ? 'Toàn trường'
                          : r?.don_vi?.ten_phong_ban || matchedDept?.ten_phong_ban || 'Chưa gắn đơn vị';
                        const isPrimary =
                          code === primaryCode &&
                          String(effectiveDeptId || '') === String(primaryDeptId || '');
                        const fromIso = toDateInputValue(r?.tu_ngay);
                        const toIso = toDateInputValue(r?.den_ngay);
                        const isExpired = Boolean(toIso && toIso < todayIso);
                        const isUpcoming = Boolean(fromIso && fromIso > todayIso);

                        return {
                          key: r?.id || `${code}-${effectiveDeptId || 'all'}-${i}`,
                          code,
                          deptName,
                          isPrimary,
                          isDelegated: DEPUTY_DELEGATION_ROLES.has(code) && Boolean(r?.duoc_uy_quyen),
                          fromIso,
                          toIso,
                          isExpired,
                          isUpcoming,
                        };
                      });

                      if (!parsedRoleItems.some((item) => item.isPrimary)) {
                        parsedRoleItems.unshift({
                          key: `primary-${primaryCode}`,
                          code: primaryCode,
                          deptName: GLOBAL_SCOPE_ROLES.has(primaryCode)
                            ? 'Toàn trường'
                            : getDepartmentName(detailUser, departments),
                          isPrimary: true,
                          isDelegated: false,
                          fromIso: toDateInputValue(detailUser.ngay_vao_lam),
                          toIso: '',
                          isExpired: false,
                          isUpcoming: false,
                        });
                      }

                      parsedRoleItems.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

                      return (
                        <div className="space-y-5">
                          <div className={grid}>
                            <Field label="Vai trò chính" value={getRoleMeta(detailUser.vai_tro_chinh).label} />
                            <Field
                              label="Tài khoản"
                              value={detailUser.kich_hoat !== false ? 'Đang hoạt động' : 'Đã khóa'}
                            />
                            <Field
                              label="Đăng nhập gần nhất"
                              value={
                                detailUser.lan_dang_nhap_cuoi
                                  ? new Date(detailUser.lan_dang_nhap_cuoi).toLocaleString('vi-VN')
                                  : 'Chưa ghi nhận'
                              }
                            />
                            <Field
                              label="Đổi mật khẩu gần nhất"
                              value={
                                detailUser.doi_mat_khau_luc
                                  ? new Date(detailUser.doi_mat_khau_luc).toLocaleString('vi-VN')
                                  : 'Chưa thay đổi'
                              }
                            />
                            <Field
                              label="Ngày tạo tài khoản"
                              value={
                                detailUser.tao_luc
                                  ? new Date(detailUser.tao_luc).toLocaleString('vi-VN')
                                  : 'Chưa ghi nhận'
                              }
                            />
                            <Field
                              label="Cập nhật gần nhất"
                              value={
                                detailUser.cap_nhat_luc
                                  ? new Date(detailUser.cap_nhat_luc).toLocaleString('vi-VN')
                                  : 'Chưa ghi nhận'
                              }
                            />
                          </div>

                          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                              Vai trò &amp; Chức vụ kiêm nhiệm ({parsedRoleItems.length})
                            </h4>
                            <div className="space-y-2">
                              {parsedRoleItems.map((item) => (
                                <div
                                  key={item.key}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs ${
                                    item.isExpired
                                      ? 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                                      : item.isPrimary
                                        ? 'border-brand-200/80 dark:border-brand-900/60 bg-brand-50/30 dark:bg-brand-950/20'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50'
                                  }`}
                                >
                                  <div className="flex items-center flex-wrap gap-2 min-w-0">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                        item.isPrimary
                                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                                          : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                      }`}
                                    >
                                      {item.isPrimary ? 'Chính' : 'Kiêm nhiệm'}
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {getRoleMeta(item.code).label}
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                                      {item.deptName}
                                    </span>
                                    {item.isDelegated && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/35 border border-amber-200 dark:border-amber-700/70 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                        Ủy quyền duyệt cấp 1
                                      </span>
                                    )}
                                    {item.isExpired && (
                                      <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                                        Đã hết hạn
                                      </span>
                                    )}
                                    {item.isUpcoming && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                        Chưa hiệu lực
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                    {item.fromIso ? formatDateVN(item.fromIso) : '—'} →{' '}
                                    {item.toIso ? formatDateVN(item.toIso) : 'Vô thời hạn'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
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

      <ModalNhapExcelNhanSu
        isOpen={isImportExcelModalOpen}
        onClose={() => setIsImportExcelModalOpen(false)}
        departments={departments}
        existingUsers={users}
        currentUserRole={
          hasRole(currentUser, ['bgh'])
            ? 'bgh'
            : isTopAdminViewer
              ? 'admin'
              : normalizeRoleKey(currentUser?.vai_tro_chinh)
        }
        onSuccess={fetchAllData}
      />
    </div>
  );
};

export default Users;
