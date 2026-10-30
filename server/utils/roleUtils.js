/**
 * QUY CHUẨN ĐỒNG NHẤT VAI TRÒ HỆ THỐNG (Canonical Snake_Case Lowercase)
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 *
 * Tiêu chuẩn: Duy nhất chữ thường snake_case, loại bỏ hoàn toàn alias và biến thể viết hoa/viết liền.
 * Duy nhất 1 chuẩn chuẩn hóa: truong_khoa, pho_khoa, truong_bo_mon, giang_vien, admin...
 */

const ROLES = {
  ADMIN: 'admin',
  BGH: 'bgh',
  TCCB: 'tccb',
  DAO_TAO: 'dao_tao',
  KE_TOAN: 'ke_toan',
  KIEM_TOAN: 'kiem_toan',
  TRUONG_KHOA: 'truong_khoa',
  PHO_KHOA: 'pho_khoa',
  TRUONG_BO_MON: 'truong_bo_mon',
  PHO_BO_MON: 'pho_bo_mon',
  TRUONG_PHONG: 'truong_phong',
  PHO_PHONG: 'pho_phong',
  GIANG_VIEN: 'giang_vien',
  CHUYEN_VIEN: 'chuyen_vien',
  NHAN_VIEN: 'nhan_vien',
  QUAN_LY_XE: 'quan_ly_xe',
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
  ROLES.KIEM_TOAN,
];

/**
 * Chuẩn hóa vai trò: duy nhất chữ thường snake_case (loại bỏ hoàn toàn danh sách alias)
 * @param {string} roleInput 
 * @returns {string} ví dụ: 'truong_khoa', 'giang_vien'
 */
function normalizeRole(roleInput) {
  if (!roleInput || typeof roleInput !== 'string') return ROLES.GIANG_VIEN;
  return roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

module.exports = {
  ROLES,
  ALL_ROLES,
  UNIT_LEADER_ROLES,
  GLOBAL_ADMIN_ROLES,
  normalizeRole,
};
