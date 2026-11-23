import { DepartmentItem, UserProfile } from '../../../../types';

export interface DeptMembersCacheEntry {
  status: 'idle' | 'loading' | 'loaded' | 'forbidden' | 'error';
  users: UserProfile[];
  errorMessage?: string;
}

export interface DepartmentAggregateStats {
  directMembers: number;
  totalMembers: number;
  directTotalLinkedMembers: number;
  totalLinkedMembers: number;
  totalSubjects: number;
  childCount: number;
}

export const UNIT_TYPE_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    badgeVariant: 'info' | 'purple' | 'success' | 'neutral';
    colorText: string;
  }
> = {
  khoa: {
    label: 'Khoa Đào Tạo',
    shortLabel: 'Khoa',
    badgeVariant: 'info',
    colorText: 'text-brand-600 dark:text-brand-400',
  },
  bo_mon: {
    label: 'Bộ Môn Chuyên Môn',
    shortLabel: 'Bộ môn',
    badgeVariant: 'purple',
    colorText: 'text-indigo-600 dark:text-indigo-400',
  },
  phong_ban: {
    label: 'Phòng Ban Chức Năng',
    shortLabel: 'Phòng ban',
    badgeVariant: 'success',
    colorText: 'text-emerald-600 dark:text-emerald-400',
  },
};

export const ACADEMIC_MANAGER_ROLES = new Set([
  'giang_vien',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
]);

export const ADMIN_DEPT_MANAGER_ROLES = new Set([
  'nhan_vien',
  'tccb',
  'dao_tao',
  'ke_toan',
  'truong_phong',
  'pho_phong',
]);

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  bgh: 'Ban Giám Hiệu',
  tccb: 'Tổ chức Cán bộ',
  dao_tao: 'Đào tạo',
  ke_toan: 'Kế toán',
  truong_khoa: 'Trưởng Khoa',
  pho_khoa: 'Phó Trưởng Khoa',
  truong_bo_mon: 'Trưởng Bộ môn',
  pho_bo_mon: 'Phó Trưởng Bộ môn',
  truong_phong: 'Trưởng Phòng',
  pho_phong: 'Phó Trưởng Phòng',
  giang_vien: 'Giảng viên',
  nhan_vien: 'Chuyên viên / Nhân viên',
};

export const isBghDepartmentName = (name?: string | null): boolean => {
  const lower = String(name || '').toLowerCase();
  return lower.includes('giám hiệu') || lower.includes('hội đồng trường');
};

export const getUnitLeaderTitle = (deptType?: string | null, deptName?: string | null): string => {
  if (isBghDepartmentName(deptName)) return 'Hiệu trưởng / Người đứng đầu BGH';
  if (deptType === 'khoa') return 'Trưởng Khoa';
  if (deptType === 'bo_mon') return 'Trưởng Bộ môn';
  return 'Trưởng Phòng ban';
};

export const getUnitDeputyMeta = (
  deptType?: string | null,
  deptName?: string | null
): { role: string; title: string } | null => {
  if (isBghDepartmentName(deptName)) return null;
  if (deptType === 'khoa') return { role: 'pho_khoa', title: 'Phó Trưởng Khoa' };
  if (deptType === 'bo_mon') return { role: 'pho_bo_mon', title: 'Phó Trưởng Bộ môn' };
  if (deptType === 'phong_ban') return { role: 'pho_phong', title: 'Phó Trưởng Phòng' };
  return null;
};

export const getRoleDisplayLabel = (role?: string | null): string => {
  const key = String(role || '').toLowerCase().trim();
  return ROLE_LABELS[key] || key || 'Cán bộ';
};

export const getUserPrimaryDeptId = (u?: UserProfile | null): string => {
  if (!u) return '';
  if (typeof u.don_vi_chinh_id === 'string' && u.don_vi_chinh_id) return u.don_vi_chinh_id;
  if (u.don_vi_chinh?.id) return String(u.don_vi_chinh.id);
  return '';
};

export const getDeptParentId = (d?: DepartmentItem | null): string => {
  if (!d) return '';
  if (typeof d.don_vi_cha_id === 'string' && d.don_vi_cha_id) return d.don_vi_cha_id;
  if (d.don_vi_cha?.id) return String(d.don_vi_cha.id);
  return '';
};

export const getDeptManagerId = (d?: DepartmentItem | null): string => {
  if (!d) return '';
  if (typeof d.truong_don_vi_id === 'string' && d.truong_don_vi_id) return d.truong_don_vi_id;
  if (d.truong_don_vi?.id) return String(d.truong_don_vi.id);
  return '';
};

export const isActiveStaff = (u: UserProfile): boolean =>
  u.kich_hoat !== false && u.trang_thai_lam_viec !== 'da_nghi_viec';

export const splitNameAndTitle = (rawName?: string): { cleanName: string; title: string | null } => {
  if (!rawName) return { cleanName: 'Chưa bổ nhiệm', title: null };
  const match = rawName.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (match) {
    return { cleanName: match[1].trim(), title: match[2].trim() };
  }
  return { cleanName: rawName.trim(), title: null };
};
