// Định nghĩa danh sách vai trò chuẩn (snake_case chữ thường) và hàm chuẩn hóa, lấy vai trò hiệu lực.

const ROLES = {
  ADMIN: 'admin',
  BGH: 'bgh',
  TCCB: 'tccb',
  DAO_TAO: 'dao_tao',
  KE_TOAN: 'ke_toan',
  TRUONG_KHOA: 'truong_khoa',
  PHO_KHOA: 'pho_khoa',
  TRUONG_BO_MON: 'truong_bo_mon',
  PHO_BO_MON: 'pho_bo_mon',
  TRUONG_PHONG: 'truong_phong',
  PHO_PHONG: 'pho_phong',
  GIANG_VIEN: 'giang_vien',
  NHAN_VIEN: 'nhan_vien',
};

const ALL_ROLES = Object.values(ROLES);

// Nhóm Lãnh đạo đơn vị (quản lý Khoa / Bộ môn / Phòng ban)
const UNIT_LEADER_ROLES = [
  ROLES.TRUONG_KHOA,
  ROLES.PHO_KHOA,
  ROLES.TRUONG_BO_MON,
  ROLES.PHO_BO_MON,
  ROLES.TRUONG_PHONG,
  ROLES.PHO_PHONG,
];

// Nhóm Quản trị viên cấp trường
const GLOBAL_ADMIN_ROLES = [
  ROLES.ADMIN,
  ROLES.BGH,
  ROLES.TCCB,
  ROLES.KE_TOAN,
];

// Chuẩn hóa tên vai trò sang chữ thường snake_case
function normalizeRole(roleInput) {
  if (!roleInput || typeof roleInput !== 'string') return '';
  return roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// Tập hợp các vai trò đang còn hiệu lực của người dùng (vai trò chính và vai trò phụ)
function getActiveUserRoles(user) {
  const roles = new Set();
  if (!user) return roles;

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const primary = normalizeRole(user.vai_tro_chinh);
  if (primary) roles.add(primary);

  const list = user.danh_sach_vai_tro || [];
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item) continue;
      if (typeof item === 'string') {
        const code = normalizeRole(item);
        if (code) roles.add(code);
        continue;
      }
      if (typeof item === 'object') {
        const start = item.tu_ngay ? String(item.tu_ngay).slice(0, 10) : null;
        const end = item.den_ngay ? String(item.den_ngay).slice(0, 10) : null;
        if (start && start > todayKey) continue;
        if (end && end < todayKey) continue;
        const code = normalizeRole(item.ma_vai_tro || item.role);
        if (code) roles.add(code);
      }
    }
  }
  return roles;
}

// Kiểm tra người dùng có ít nhất một vai trò thuộc danh sách cho phép
function hasAnyActiveRole(user, allowedRoles = []) {
  const active = getActiveUserRoles(user);
  return allowedRoles.some((r) => active.has(normalizeRole(r)));
}

// Kiểm tra người dùng có phải quản trị hệ thống (admin hoặc bgh)
function isSystemAdminUser(user) {
  return hasAnyActiveRole(user, [ROLES.ADMIN, ROLES.BGH]);
}

module.exports = {
  ROLES,
  ALL_ROLES,
  UNIT_LEADER_ROLES,
  GLOBAL_ADMIN_ROLES,
  normalizeRole,
  getActiveUserRoles,
  hasAnyActiveRole,
  isSystemAdminUser,
};
