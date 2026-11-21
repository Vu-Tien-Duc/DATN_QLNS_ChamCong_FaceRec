// Định dạng ngày giờ, nhãn trạng thái, phân cấp đơn vị và chống công thức Excel (Formula Injection) khi xuất báo cáo
const { Op } = require('sequelize');
const { PhongBan } = require('../../models');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { isSystemAdminUser, normalizeRole } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');

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
    case 'thieu_check_out':
      return 'Thiếu check-out';
    default:
      return status || '--';
  }
};

// Chuyển mã phương thức chấm công sang nhãn tiếng Việt
const getMethodLabel = (method) => {
  switch (method) {
    case 'face_ai':
      return 'Face ID (Máy chấm công)';
    case 'qr_code':
      return 'Mã QR';
    case 'thu_cong_admin':
      return 'Thủ công';
    case 'gps_mobile':
      return 'Định vị GPS';
    case 'system_auto':
      return 'Hệ thống tự động';
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
    case 'nghi_om':
      return 'Nghỉ ốm';
    case 'viec_rieng':
      return 'Nghỉ việc riêng';
    case 'giai_trinh_cong':
      return 'Giải trình công';
    case 'giai_trinh_thieu_check_out':
      return 'Giải trình thiếu check-out';
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
    case 'pending_bgh':
      return 'Chờ duyệt';
    case 'rejected':
      return 'Đã từ chối';
    case 'cancelled':
      return 'Đã hủy';
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
    case 'nhan_vien':
      return 'Nhân viên';
    default:
      return role || 'Cán bộ';
  }
};

// Duyệt đệ quy toàn bộ đơn vị con nhiều cấp từ 1 hoặc nhiều don_vi_id
const resolveDepartmentIdsTree = async (departmentInput) => {
  if (!departmentInput) return [];
  const seeds = (Array.isArray(departmentInput) ? departmentInput : [departmentInput])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (seeds.length === 0) return [];

  for (const id of seeds) {
    if (!isValidUuid(id)) {
      throw new ServiceError('Mã đơn vị (don_vi_id) không đúng định dạng UUID.', 400, 'INVALID_DEPARTMENT_ID');
    }
  }

  const allDeptIds = [...new Set(seeds)];
  let parentIds = [...allDeptIds];
  while (parentIds.length > 0) {
    const childDepts = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: parentIds } },
      attributes: ['id'],
      raw: true,
    });
    const newChildren = childDepts.map((d) => String(d.id)).filter((id) => !allDeptIds.includes(id));
    if (newChildren.length === 0) break;
    allDeptIds.push(...newChildren);
    parentIds = newChildren;
  }
  return allDeptIds;
};

// Lấy khóa ngày chuẩn YYYY-MM-DD ưu tiên ngay_cong trước khi fallback sang thoi_gian_vao/tao_luc
const getAttendanceWorkDateKey = (log) => {
  if (log?.ngay_cong) return String(log.ngay_cong).slice(0, 10);
  if (log?.thoi_gian_vao) return toDateKey(log.thoi_gian_vao);
  if (log?.tao_luc) return toDateKey(log.tao_luc);
  return null;
};

// Tính xu hướng chuyên cần theo tuần (4 tuần trong tháng hoặc nhiều tuần nếu khoảng thời gian vắt nhiều tháng)
const computeWeeklyTrendBuckets = (attendances = [], startDate = null, endDate = null) => {
  const startKey = startDate ? toDateKey(startDate) : null;
  const endKey = endDate ? toDateKey(endDate) : null;

  const sameMonth =
    !startKey ||
    !endKey ||
    startKey.slice(0, 7) === endKey.slice(0, 7);

  let buckets = [];
  if (sameMonth) {
    const refKey = startKey || endKey || toDateKey(new Date());
    const [yStr, mStr] = refKey.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    buckets = [
      { label: 'Tuần 1', startKey: `${yStr}-${mStr}-01`, endKey: `${yStr}-${mStr}-07`, subLabel: `01/${mStr} - 07/${mStr}` },
      { label: 'Tuần 2', startKey: `${yStr}-${mStr}-08`, endKey: `${yStr}-${mStr}-14`, subLabel: `08/${mStr} - 14/${mStr}` },
      { label: 'Tuần 3', startKey: `${yStr}-${mStr}-15`, endKey: `${yStr}-${mStr}-21`, subLabel: `15/${mStr} - 21/${mStr}` },
      { label: 'Tuần 4', startKey: `${yStr}-${mStr}-22`, endKey: `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`, subLabel: `22/${mStr} - ${String(lastDay).padStart(2, '0')}/${mStr}` },
    ];
  } else {
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const [ey, em, ed] = endKey.split('-').map(Number);
    let cur = new Date(Date.UTC(sy, sm - 1, sd));
    const endUtc = new Date(Date.UTC(ey, em - 1, ed));
    let idx = 1;
    while (cur <= endUtc) {
      const wStartKey = cur.toISOString().slice(0, 10);
      const wEnd = new Date(cur.getTime());
      wEnd.setUTCDate(wEnd.getUTCDate() + 6);
      const actualEnd = wEnd > endUtc ? endUtc : wEnd;
      const wEndKey = actualEnd.toISOString().slice(0, 10);
      const [, sM, sD] = wStartKey.split('-');
      const [, eM, eD] = wEndKey.split('-');
      buckets.push({
        label: `Tuần ${idx}`,
        startKey: wStartKey,
        endKey: wEndKey,
        subLabel: `${sD}/${sM} - ${eD}/${eM}`,
      });
      cur = new Date(actualEnd.getTime());
      cur.setUTCDate(cur.getUTCDate() + 1);
      idx += 1;
    }
  }

  return buckets.map((b) => {
    const logs = attendances.filter((a) => {
      const key = getAttendanceWorkDateKey(a);
      return key && key >= b.startKey && key <= b.endKey;
    });
    const total = logs.length;
    const onTime = logs.filter((a) => a.trang_thai === 'on_time' || a.trang_thai === 'excused_absence').length;
    const late = logs.filter((a) => a.trang_thai === 'late' || a.trang_thai === 'early_leave').length;
    return {
      label: b.label,
      subLabel: b.subLabel,
      rate: total > 0 ? Math.round((onTime / total) * 100) : 0,
      lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
      total,
      onTime,
      late,
    };
  });
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
  resolveDepartmentIdsTree,
  getAttendanceWorkDateKey,
  computeWeeklyTrendBuckets,
};
