import { UserProfile } from '../types/index';

/**
 * Chuẩn hóa mọi biến thể vai trò về DUY NHẤT 1 Canonical Role Key chuẩn (lowercase snake_case):
 * - 'admin': Quản Trị Viên IT
 * - 'bgh': Ban Giám Hiệu
 * - 'truong_khoa': Trưởng Khoa
 * - 'pho_khoa': Phó Trưởng Khoa
 * - 'truong_bo_mon': Trưởng Bộ Môn
 * - 'pho_bo_mon': Phó Trưởng Bộ Môn
 * - 'truong_phong': Trưởng Phòng
 * - 'pho_phong': Phó Trưởng Phòng
 * - 'dao_tao': Chuyên Viên Đào Tạo
 * - 'tccb': Tổ Chức Cán Bộ
 * - 'ke_toan': Kế Toán
 * - 'giang_vien': Giảng Viên
 * - 'nhan_vien': Nhân Viên
 */
export const normalizeRoleKey = (r?: any): string => {
  if (!r || typeof r !== 'string') return '';
  return r.trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const getVietnamTodayKey = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const isRoleAssignmentActive = (item: any, todayKey: string): boolean => {
  if (!item || typeof item !== 'object') return false;
  const rawStart = item.tu_ngay;
  const rawEnd = item.den_ngay;
  const start = rawStart ? String(rawStart).slice(0, 10) : null;
  const end = rawEnd ? String(rawEnd).slice(0, 10) : null;
  if (start && start > todayKey) return false;
  if (end && end < todayKey) return false;
  return true;
};

/**
 * Thu thập tập hợp các vai trò chuẩn hóa duy nhất còn hiệu lực của người dùng (CSDL v2.5 RBAC).
 */
export const getUserRoles = (user: UserProfile | null | undefined): Set<string> => {
  const set = new Set<string>();
  if (!user) return set;

  const addRole = (r?: any) => {
    const canonical = normalizeRoleKey(r);
    if (canonical) set.add(canonical);
  };

  addRole(user.vai_tro_chinh);

  const roleList = Array.isArray(user.danh_sach_vai_tro) ? user.danh_sach_vai_tro : [];

  const todayKey = getVietnamTodayKey();
  roleList.forEach((item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      addRole(item);
      return;
    }
    if (!isRoleAssignmentActive(item, todayKey)) return;
    addRole(item.ma_vai_tro);
  });

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
 * Kiểm tra quyền tự chấm công cá nhân (Face ID, Trực tuyến GPS, Quét mã QR).
 * Lưu ý nghiệp vụ: Quản trị viên IT (admin) KHÔNG tự chấm công cá nhân.
 */
export const canPersonalCheckIn = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);
  return !roles.has('admin');
};

/**
 * Kiểm tra quyền vận hành Trạm điểm danh Kiosk & phát mã QR động (20s).
 * Chỉ cấp Quản trị / BGH / TCCB / Đào tạo / Lãnh đạo đơn vị được phép phát mã QR động.
 * Giảng viên / nhân viên thông thường KHÔNG được tự sinh mã QR để chống gian lận điểm danh hộ.
 */
export const KIOSK_OPERATOR_ROLES = [
  'admin',
  'bgh',
  'tccb',
  'dao_tao',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
] as const;

export const canOperateAttendanceKiosk = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);
  return KIOSK_OPERATOR_ROLES.some((r) => roles.has(r));
};

/**
 * Kiểm tra quyền duyệt đơn cấp 1 (Trưởng đơn vị hoặc Phó đơn vị có cờ duoc_uy_quyen)
 */
export const canApproveLevel1 = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);
  if (roles.has('admin') || roles.has('bgh') || roles.has('truong_khoa') || roles.has('truong_bo_mon') || roles.has('truong_phong')) {
    return true;
  }
  const roleList = Array.isArray(user.danh_sach_vai_tro) ? user.danh_sach_vai_tro : [];
  const todayKey = getVietnamTodayKey();
  return roleList.some(
    (r: any) =>
      isRoleAssignmentActive(r, todayKey) &&
      Boolean(r?.duoc_uy_quyen) &&
      ['pho_khoa', 'pho_bo_mon', 'pho_phong'].includes(normalizeRoleKey(r?.ma_vai_tro))
  );
};

/**
 * Kiểm tra quyền tạo/sửa danh mục môn học (khớp BE LICH:XEP_LICH | HE_THONG:CAU_HINH)
 */
export const canManageSubjects = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roles = getUserRoles(user);
  if (
    roles.has('admin') ||
    roles.has('bgh') ||
    roles.has('dao_tao') ||
    roles.has('truong_khoa') ||
    roles.has('truong_bo_mon')
  ) {
    return true;
  }
  const roleList = Array.isArray(user.danh_sach_vai_tro) ? user.danh_sach_vai_tro : [];
  const todayKey = getVietnamTodayKey();
  return roleList.some(
    (r: any) =>
      isRoleAssignmentActive(r, todayKey) &&
      Boolean(r?.duoc_uy_quyen) &&
      ['pho_khoa', 'pho_bo_mon'].includes(normalizeRoleKey(r?.ma_vai_tro))
  );
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
    case 'truong_khoa':
      return 'Trưởng Khoa';
    case 'pho_khoa':
      return 'Phó Trưởng Khoa';
    case 'truong_bo_mon':
      return 'Trưởng Bộ Môn';
    case 'pho_bo_mon':
      return 'Phó Trưởng Bộ Môn';
    case 'truong_phong':
      return 'Trưởng Phòng';
    case 'pho_phong':
      return 'Phó Trưởng Phòng';
    case 'dao_tao':
      return 'Chuyên Viên Đào Tạo';
    case 'tccb':
      return 'Tổ Chức Cán Bộ';
    case 'ke_toan':
      return 'Kế Toán';
    case 'giang_vien':
      return 'Giảng Viên';
    case 'nhan_vien':
      return 'Nhân Viên';
    default:
      return role || '';
  }
};
