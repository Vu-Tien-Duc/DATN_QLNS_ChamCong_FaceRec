// Định dạng ngày giờ, nhãn trạng thái và chống công thức Excel (Formula Injection) khi xuất báo cáo
const { isSystemAdminUser } = require('../../utils/vaiTro.utils');

// Tính số ngày lịch nằm giữa startDate và endDate (bao gồm cả hai đầu)
const calculateCalendarDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
};

// Chuyển ngày sang chuỗi khóa YYYY-MM-DD theo múi giờ Việt Nam
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

// Dùng lại hàm kiểm tra Admin/BGH thống nhất trong vaiTro.utils.js

// Quy đổi mốc thời gian sang giờ Việt Nam (UTC+7) để tách ngày/giờ
const toVnDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 7 * 3600 * 1000);
};

// Định dạng ngày kiểu DD/MM/YYYY
const formatDateVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '';
  const day = String(vn.getUTCDate()).padStart(2, '0');
  const month = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const year = vn.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

// Định dạng giờ kiểu HH:mm:ss
const formatTimeVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '--';
  const hour = String(vn.getUTCHours()).padStart(2, '0');
  const minute = String(vn.getUTCMinutes()).padStart(2, '0');
  const second = String(vn.getUTCSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
};

// Lấy tên thứ trong tuần bằng tiếng Việt
const getWeekdayVN = (date) => {
  const vn = toVnDate(date);
  if (!vn) return '';
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[vn.getUTCDay()] || '';
};

// Chuyển mã trạng thái chấm công sang nhãn tiếng Việt
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

// Chuyển mã phương thức chấm công sang nhãn tiếng Việt
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

// Chuyển mã loại đơn nghỉ sang nhãn tiếng Việt
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

// Chuyển mã trạng thái duyệt đơn sang nhãn tiếng Việt
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

// Chuyển mã vai trò sang tên hiển thị tiếng Việt
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

// Chèn dấu nháy đơn vào đầu chuỗi bắt đầu bằng =, +, -, @ để chống Excel Formula Injection
const sanitizeExcelCell = (value) => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

// Làm sạch toàn bộ giá trị chuỗi trong một dòng dữ liệu Excel
const sanitizeExcelRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const sanitized = {};
  for (const [key, val] of Object.entries(row)) {
    sanitized[key] = sanitizeExcelCell(val);
  }
  return sanitized;
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
  sanitizeExcelCell,
  sanitizeExcelRow,
};
