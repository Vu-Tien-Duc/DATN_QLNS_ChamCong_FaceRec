/**
 * HỆ THỐNG PHÂN QUYỀN RBAC CHUẨN (Role-Based Access Control)
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 */

const { normalizeRole } = require('../utils/roleUtils');

// 1. Danh mục các quyền hạt nhân (Granular Permissions)
const PERMISSIONS = {
  // Đơn từ
  DON_TU_TAO: 'DON_TU:TAO',
  DON_TU_XEM_BAN_THAN: 'DON_TU:XEM_BAN_THAN',
  DON_TU_XEM_DON_VI: 'DON_TU:XEM_DON_VI',
  DON_TU_DUYET_CAP_1: 'DON_TU:DUYET_CAP_1',
  DON_TU_DUYET_CAP_2: 'DON_TU:DUYET_CAP_2',
  DON_TU_HUY: 'DON_TU:HUY',

  // Chấm công & Ngày công
  CONG_QUET_MAT: 'CONG:QUET_MAT',
  CONG_XEM_BAN_THAN: 'CONG:XEM_BAN_THAN',
  CONG_XEM_DON_VI: 'CONG:XEM_DON_VI',
  CONG_XEM_TOAN_TRUONG: 'CONG:XEM_TOAN_TRUONG',
  CONG_GIAI_TRINH: 'CONG:GIAI_TRINH',
  CONG_CHOT_CONG: 'CONG:CHOT_CONG',

  // Thời khóa biểu & Lịch dạy
  LICH_XEM_BAN_THAN: 'LICH:XEM_BAN_THAN',
  LICH_XEM_DON_VI: 'LICH:XEM_DON_VI',
  LICH_XEP_LICH: 'LICH:XEP_LICH',
  LICH_DAY_BU: 'LICH:DAY_BU',

  // Tiền lương & Thu nhập
  LUONG_XEM_BAN_THAN: 'LUONG:XEM_BAN_THAN',
  LUONG_LAP_BANG: 'LUONG:LAP_BANG',
  LUONG_DUYET: 'LUONG:DUYET',
  LUONG_KHOA: 'LUONG:KHOA',

  // Hồ sơ & Nhân sự
  NHAN_SU_XEM_DON_VI: 'NHAN_SU:XEM_DON_VI',
  NHAN_SU_QUAN_LY: 'NHAN_SU:QUAN_LY',
  NHAN_SU_BO_NHIEM: 'NHAN_SU:BO_NHIEM',

  // Quản trị & Kiểm toán
  HE_THONG_CAU_HINH: 'HE_THONG:CAU_HINH',
  HE_THONG_KIEM_TOAN: 'HE_THONG:KIEM_TOAN',
};

// 2. Ma trận Ánh xạ Vai trò -> Tập quyền (Chuẩn canonical lowercase snake_case)
const CANONICAL_ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS), // Admin toàn quyền

  bgh: [
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.DON_TU_DUYET_CAP_2,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_TOAN_TRUONG,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.LUONG_DUYET,
    PERMISSIONS.LUONG_KHOA,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
    PERMISSIONS.NHAN_SU_QUAN_LY,
    PERMISSIONS.HE_THONG_KIEM_TOAN,
  ],

  tccb: [
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.DON_TU_DUYET_CAP_2,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_TOAN_TRUONG,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
    PERMISSIONS.NHAN_SU_QUAN_LY,
    PERMISSIONS.NHAN_SU_BO_NHIEM,
    PERMISSIONS.HE_THONG_KIEM_TOAN,
  ],

  dao_tao: [
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LICH_XEP_LICH,
    PERMISSIONS.LICH_DAY_BU,
  ],

  ke_toan: [
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_TOAN_TRUONG,
    PERMISSIONS.CONG_CHOT_CONG,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.LUONG_LAP_BANG,
    PERMISSIONS.LUONG_KHOA,
  ],

  kiem_toan: [
    PERMISSIONS.CONG_XEM_TOAN_TRUONG,
    PERMISSIONS.HE_THONG_KIEM_TOAN,
  ],

  truong_khoa: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.DON_TU_DUYET_CAP_1,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LICH_XEP_LICH,
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
  ],

  pho_khoa: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    // Chỉ được duyệt khi duoc_uy_quyen === true (xử lý ở tầng getEffectivePermissions)
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
  ],

  truong_bo_mon: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.DON_TU_DUYET_CAP_1,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LICH_XEP_LICH,
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
  ],

  pho_bo_mon: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.LICH_XEM_DON_VI,
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
  ],

  truong_phong: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.DON_TU_DUYET_CAP_1,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
  ],

  pho_phong: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_XEM_DON_VI,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_XEM_DON_VI,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
    PERMISSIONS.NHAN_SU_XEM_DON_VI,
  ],

  giang_vien: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LICH_XEM_BAN_THAN,
    PERMISSIONS.LICH_DAY_BU,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
  ],

  chuyen_vien: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
  ],
  nhan_vien: [
    PERMISSIONS.DON_TU_TAO,
    PERMISSIONS.DON_TU_XEM_BAN_THAN,
    PERMISSIONS.DON_TU_HUY,
    PERMISSIONS.CONG_QUET_MAT,
    PERMISSIONS.CONG_XEM_BAN_THAN,
    PERMISSIONS.CONG_GIAI_TRINH,
    PERMISSIONS.LUONG_XEM_BAN_THAN,
  ],
};

const ROLE_PERMISSIONS = CANONICAL_ROLE_PERMISSIONS;

/**
 * Tính toán tập quyền thực tế (Effective Permissions) của người dùng:
 * 1. Lọc qua mảng roles[] còn hiệu lực (nhiệm kỳ hợp lệ: expiresAt === null hoặc expiresAt >= now).
 * 2. Tính cả cờ isDelegated cho các chức danh phó trưởng.
 * 3. Hợp nhất (Union) toàn bộ quyền và khử trùng lặp.
 */
function getEffectivePermissions(user) {
  if (!user) return new Set();

  const permissions = new Set();
  const now = new Date();

  // Kiểm tra mảng vai trò RBAC v2.5
  const rolesList = user.roles || user.danh_sach_vai_tro || [];

  if (Array.isArray(rolesList) && rolesList.length > 0) {
    for (const r of rolesList) {
      if (!r) continue;
      // Bỏ qua vai trò đã hết nhiệm kỳ (endDate / den_ngay)
      const expiry = r.endDate || r.den_ngay;
      if (expiry && new Date(expiry) < now) {
        continue;
      }

      const roleCode = normalizeRole(r.role || r.ma_vai_tro);
      const rolePerms = ROLE_PERMISSIONS[roleCode] || [];
      for (const p of rolePerms) {
        permissions.add(p);
      }

      // Xử lý ủy quyền cho phó trưởng
      const isDelegated = r.isDelegated || r.duoc_uy_quyen;
      if (isDelegated && ['pho_khoa', 'pho_bo_mon', 'pho_phong'].includes(roleCode)) {
        permissions.add(PERMISSIONS.DON_TU_DUYET_CAP_1);
      }
    }
  }

  // Fallback vai trò phẳng nếu chưa có trong permissions
  const fallbackRole = user.role || user.primaryRole || user.vai_tro_chinh;
  if (fallbackRole && permissions.size === 0) {
    const roleCode = normalizeRole(fallbackRole);
    const fallbackPerms = ROLE_PERMISSIONS[roleCode] || [];
    for (const p of fallbackPerms) {
      permissions.add(p);
    }
  }

  return permissions;
}

/**
 * Kiểm tra xem người dùng có quyền cụ thể hay không
 */
function hasPermission(user, requiredPermission) {
  if (!user || !requiredPermission) return false;
  const effective = getEffectivePermissions(user);
  return effective.has(requiredPermission);
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
};
