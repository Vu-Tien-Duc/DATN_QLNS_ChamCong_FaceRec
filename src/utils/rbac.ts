import { UserProfile } from '../types';

/**
 * Chuẩn hóa mọi biến thể vai trò về DUY NHẤT 1 Canonical Role Key chuẩn:
 * - 'admin': Quản Trị Viên IT
 * - 'bgh': Ban Giám Hiệu
 * - 'truongkhoa': Trưởng Khoa
 * - 'phokhoa': Phó Trưởng Khoa
 * - 'truongbomon': Trưởng Bộ Môn
 * - 'phobomon': Phó Trưởng Bộ Môn
 * - 'truongphong': Trưởng Phòng
 * - 'phophong': Phó Trưởng Phòng
 * - 'daotao': Chuyên Viên Đào Tạo
 * - 'tccb': Tổ Chức Cán Bộ
 * - 'ketoan': Kế Toán
 * - 'kiemtoan': Khảo Thí / Kiểm Toán
 * - 'giangvien': Giảng Viên
 * - 'nhanvien': Chuyên Viên / Nhân Viên
 */
export const normalizeRoleKey = (r?: any): string => {
  if (!r || typeof r !== 'string') return '';
  const clean = r.toLowerCase().replace(/[\s_-]+/g, '');
  switch (clean) {
    case 'adminit':
    case 'itadmin':
    case 'quantri':
    case 'quantrivien':
      return 'admin';
    case 'hieutruong':
    case 'hieupho':
    case 'bangiamhieu':
      return 'bgh';
    case 'photruongkhoa':
      return 'phokhoa';
    case 'photruongbomon':
      return 'phobomon';
    case 'photruongphong':
      return 'phophong';
    case 'chuyenvien':
      return 'nhanvien';
    default:
      return clean;
  }
};

/**
 * Thu thập tập hợp các vai trò chuẩn hóa duy nhất của người dùng (CSDL v2.5 RBAC).
 * Tập hợp trả về CHỈ CHỨA các canonical role key (admin, bgh, truongkhoa, phokhoa...),
 * loại bỏ hoàn toàn các tên đồng nghĩa hoặc bí danh kép làm rối loạn hệ thống.
 */
export const getUserRoles = (user: UserProfile | null | undefined): Set<string> => {
  const set = new Set<string>();
  if (!user) return set;

  const addRole = (r?: any) => {
    const canonical = normalizeRoleKey(r);
    if (canonical) set.add(canonical);
  };

  addRole(user.role);
  addRole(user.primaryRole);

  if (Array.isArray(user.roles)) {
    user.roles.forEach((item: any) => {
      if (typeof item === 'string') addRole(item);
      else if (item?.role) addRole(item.role);
      else if (item?.ma_vai_tro) addRole(item.ma_vai_tro);
    });
  }

  return set;
};

/**
 * Kiểm tra xem người dùng có phải là Quản trị viên (Admin) hay không
 * Lưu ý đặc quyền: Admin không chấm công cá nhân, không xin nghỉ phép, chỉ quản trị và xét duyệt.
 */
export const isAdmin = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  return getUserRoles(user).has('admin');
};

/**
 * Kiểm tra xem người dùng có phải là Ban Giám Hiệu (BGH) hay không
 */
export const isBGH = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  return getUserRoles(user).has('bgh');
};

/**
 * Kiểm tra xem người dùng có phải là Quản trị cấp cao (Admin hoặc BGH) hay không
 */
export const isSuperAdmin = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);
  return roles.has('admin') || roles.has('bgh');
};

/**
 * Kiểm tra xem người dùng có quyền truy cập vào phân hệ / tính năng hay không
 */
export const hasRole = (
  user: UserProfile | null | undefined,
  allowedRoles?: string[],
  excludeRoles?: string[]
): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);

  // 1. Kiểm tra danh sách loại trừ trước tiên (ví dụ: excludeRoles: ['admin'])
  if (excludeRoles && excludeRoles.length > 0) {
    const isExcluded = excludeRoles.some((r) => roles.has(normalizeRoleKey(r)));
    if (isExcluded) return false;
  }

  if (!allowedRoles || allowedRoles.length === 0) return true;

  // 2. Kiểm tra chính xác vai trò được phép (Canonical Role Check)
  return allowedRoles.some((r) => roles.has(normalizeRoleKey(r)));
};

/**
 * Trả về nhãn tiếng Việt chuẩn mực của vai trò
 */
export const getRoleLabel = (role?: string): string => {
  const clean = normalizeRoleKey(role);
  switch (clean) {
    case 'admin':
      return 'Quản Trị Viên IT';
    case 'bgh':
      return 'Ban Giám Hiệu';
    case 'truongkhoa':
      return 'Trưởng Khoa';
    case 'phokhoa':
      return 'Phó Trưởng Khoa';
    case 'truongbomon':
      return 'Trưởng Bộ Môn';
    case 'phobomon':
      return 'Phó Trưởng Bộ Môn';
    case 'truongphong':
      return 'Trưởng Phòng';
    case 'phophong':
      return 'Phó Trưởng Phòng';
    case 'daotao':
      return 'Chuyên Viên Đào Tạo';
    case 'tccb':
      return 'Tổ Chức Cán Bộ';
    case 'ketoan':
      return 'Kế Toán';
    case 'kiemtoan':
      return 'Khảo Thí / Kiểm Toán';
    case 'giangvien':
      return 'Giảng Viên';
    case 'nhanvien':
      return 'Chuyên Viên / Nhân Viên';
    default:
      return (role || '').toUpperCase();
  }
};
