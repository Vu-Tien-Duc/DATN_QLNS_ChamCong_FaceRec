/**
 * Tiện ích định dạng ngày giờ & nhãn hiển thị báo cáo (server/services/baoCao/dinhDangBaoCao.helper.js)
 */
const { normalizeRole } = require('../../utils/vaiTro.utils');

const calculateCalendarDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
};

const toDateKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

const isSystemAdminUser = (u) => {
  if (!u) return false;
  const r = normalizeRole(u.vai_tro_chinh);
  const code = String(u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || '').toLowerCase();
  const name = String(u.ho_ten || '').toLowerCase();
  const hasAdminOrBghRole =
    Array.isArray(u.danh_sach_vai_tro) &&
    u.danh_sach_vai_tro.some((item) => {
      const itemRole = normalizeRole(item.vai_tro || item.ma_vai_tro || item);
      return itemRole === 'admin' || itemRole === 'bgh';
    });
  return (
    r === 'admin' ||
    r === 'bgh' ||
    r.includes('quản trị') ||
    r.includes('giám hiệu') ||
    code.startsWith('ADMIN') ||
    code.startsWith('BGH') ||
    hasAdminOrBghRole ||
    email.startsWith('admin@') ||
    email.includes('daihocdtd@') ||
    email.startsWith('hieutruong@') ||
    name.includes('quản trị viên') ||
    name.includes('hiệu trưởng') ||
    name.includes('ban giám hiệu')
  );
};

const toVnDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 7 * 3600 * 1000);
};

const formatDateVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '';
  const day = String(vn.getUTCDate()).padStart(2, '0');
  const month = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const year = vn.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const formatTimeVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '--';
  const hour = String(vn.getUTCHours()).padStart(2, '0');
  const minute = String(vn.getUTCMinutes()).padStart(2, '0');
  const second = String(vn.getUTCSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
};

const getWeekdayVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '';
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[vn.getUTCDay()] || '';
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'on_time':
      return 'Đúng giờ';
    case 'late':
      return 'Đi muộn';
    case 'early_leave':
      return 'Về sớm';
    case 'absent':
      return 'Vắng mặt';
    case 'excused_absence':
      return 'Nghỉ có phép';
    default:
      return status || '--';
  }
};

const getMethodLabel = (method) => {
  switch (method) {
    case 'face_ai':
    case 'face':
      return 'Face ID (Máy chấm công)';
    case 'qr_code':
    case 'qr':
      return 'Mã QR';
    case 'thu_cong_admin':
    case 'manual':
      return 'Thủ công';
    case 'gps_mobile':
    case 'gps':
      return 'Định vị GPS';
    default:
      return method || 'Thủ công';
  }
};

const getLeaveTypeLabel = (type) => {
  switch (type) {
    case 'nghi_phep':
      return 'Nghỉ phép năm';
    case 'day_bu':
      return 'Đăng ký dạy bù';
    case 'doi_ca':
      return 'Xin đổi ca dạy';
    default:
      return type || '--';
  }
};

const getLeaveStatusLabel = (status) => {
  switch (status) {
    case 'approved':
      return 'Đã duyệt';
    case 'pending':
    case 'pending_dean':
    case 'pending_bgh':
      return 'Chờ duyệt';
    case 'rejected':
      return 'Đã từ chối';
    default:
      return status || '--';
  }
};

const getRoleLabel = (role) => {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'admin':
      return 'Quản trị viên';
    case 'bgh':
      return 'Ban Giám hiệu';
    case 'tccb':
      return 'Phòng Tổ chức Cán bộ';
    case 'dao_tao':
      return 'Phòng Đào tạo';
    case 'ke_toan':
      return 'Phòng Kế toán';
    case 'kiem_toan':
      return 'Ban Kiểm toán';
    case 'truong_khoa':
      return 'Trưởng Khoa';
    case 'pho_khoa':
      return 'Phó Trưởng Khoa';
    case 'truong_bo_mon':
      return 'Trưởng Bộ môn';
    case 'pho_bo_mon':
      return 'Phó Trưởng Bộ môn';
    case 'truong_phong':
      return 'Trưởng Phòng';
    case 'pho_phong':
      return 'Phó Trưởng Phòng';
    case 'giang_vien':
      return 'Giảng Viên';
    case 'chuyen_vien':
      return 'Chuyên viên';
    case 'nhan_vien':
      return 'Nhân viên';
    default:
      return role || 'Cán bộ';
  }
};

module.exports = {
  calculateCalendarDays,
  toDateKey,
  isSystemAdminUser,
  toVnDate,
  formatDateVN,
  formatTimeVN,
  getWeekdayVN,
  getStatusLabel,
  getMethodLabel,
  getLeaveTypeLabel,
  getLeaveStatusLabel,
  getRoleLabel,
};
