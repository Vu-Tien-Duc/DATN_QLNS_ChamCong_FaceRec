/**
 * Tổng hợp báo cáo chấm công theo quyền truy cập và chuẩn bị dữ liệu xuất Excel.
 */
const AttendanceLog = require('../models/attendanceLog.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const LeaveRequest = require('../models/leaveRequest.model');
const { buildAttendanceDateFilter } = require('../utils/attendanceTime.utils');
const { getDeanDepartmentIds, getDeanScopedUserIds } = require('../utils/deanScope');
const { PERMISSIONS, hasPermission } = require('../config/permissions');
const ServiceError = require('../utils/serviceError');

const calculateCalendarDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
};

// Helper nhận diện tài khoản Quản trị hệ thống IT và Lãnh đạo BGH (không phải đối tượng chấm công)
const NON_ADMIN_MONGO_CRITERIA = {
  vai_tro_chinh: { $nin: ['ADMIN', 'admin', 'BGH', 'bgh'] },
  ma_can_bo: { $not: /^(ADMIN|BGH)/i },
  email: { $not: /^admin@/i, $not: /daihocdtd@/i, $not: /^hieutruong@/i },
};

const isSystemAdminUser = (u) => {
  if (!u) return false;
  const r = String(u.role || u.primaryRole || u.vai_tro_chinh || '').toLowerCase();
  const code = String(u.staffCode || u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || '').toLowerCase();
  const name = String(u.fullName || u.ho_ten || '').toLowerCase();
  const hasAdminOrBghRole = Array.isArray(u.roles) && u.roles.some((item) => {
    const itemRole = String(item.role || item.ma_vai_tro || '').toUpperCase();
    return itemRole === 'ADMIN' || itemRole === 'BGH';
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

const getAttendanceReportData = async ({ userId, departmentId, from, to, currentUser }) => {
  let targetUserIds = [];
  const canViewAll = hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || ['admin', 'ADMIN'].includes(currentUser.role);
  const canViewDept = hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || ['truongkhoa', 'TRUONG_KHOA'].includes(currentUser.role);

  if (canViewAll) {
    if (userId) {
      targetUserIds = [userId];
    } else if (departmentId) {
      const childDepartments = await Department.find({ parentId: departmentId }).select('_id');
      const departmentIds = [departmentId, ...childDepartments.map((department) => department._id)];
      const departmentUsers = await User.find({ departmentId: { $in: departmentIds }, ...NON_ADMIN_MONGO_CRITERIA }).select('_id staffCode email role fullName roles');
      targetUserIds = departmentUsers.filter((u) => !isSystemAdminUser(u)).map((user) => user._id);
    } else {
      const allUsers = await User.find({ isActive: true, ...NON_ADMIN_MONGO_CRITERIA }).select('_id staffCode email role fullName roles');
      targetUserIds = allUsers.filter((u) => !isSystemAdminUser(u)).map((user) => user._id);
    }
  } else if (canViewDept) {
    const scopedUserIds = await getDeanScopedUserIds(currentUser);
    if (userId) {
      if (!scopedUserIds.includes(userId.toString())) {
        throw new ServiceError('Bạn không có quyền xem thống kê của nhân sự ngoài khoa / đơn vị.', 403);
      }
      targetUserIds = [userId];
    } else {
      targetUserIds = scopedUserIds;
    }
  } else {
    targetUserIds = [currentUser.id || currentUser._id];
  }

  let fromDate = null;
  let toDate = null;
  if (from) {
    fromDate = typeof from === 'string' && from.length === 10
      ? new Date(`${from}T00:00:00.000+07:00`)
      : new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new ServiceError('Ngày bắt đầu (from) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', 400);
    }
  }
  if (to) {
    toDate = typeof to === 'string' && to.length === 10
      ? new Date(`${to}T23:59:59.999+07:00`)
      : new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new ServiceError('Ngày kết thúc (to) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', 400);
    }
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ServiceError(
      'Khoảng thời gian không hợp lệ: Ngày bắt đầu (from) phải nhỏ hơn hoặc bằng ngày kết thúc (to).',
      400
    );
  }

  const attendanceQuery = { userId: { $in: targetUserIds } };
  if (fromDate || toDate) Object.assign(attendanceQuery, buildAttendanceDateFilter(fromDate, toDate));
  const attendances = await AttendanceLog.find(attendanceQuery);

  const leaveQuery = { userId: { $in: targetUserIds }, status: 'APPROVED', type: 'nghi_phep' };
  if (fromDate || toDate) {
    if (toDate) leaveQuery.startDate = { $lte: toDate };
    if (fromDate) leaveQuery.endDate = { $gte: fromDate };
  }
  const approvedLeaves = await LeaveRequest.find(leaveQuery);

  const { getVietnamTime } = require('../utils/attendanceTime.utils');
  const vnFrom = fromDate ? getVietnamTime(fromDate) : getVietnamTime();
  const year = vnFrom.getFullYear();
  const month = vnFrom.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const weekRanges = [
    { label: 'Tuần 1', startDay: 1, endDay: 7 },
    { label: 'Tuần 2', startDay: 8, endDay: 14 },
    { label: 'Tuần 3', startDay: 15, endDay: 21 },
    { label: 'Tuần 4', startDay: 22, endDay: lastDayOfMonth },
  ];
  const monthString = String(month + 1).padStart(2, '0');
  const weeklyTrend = weekRanges.map((week) => {
    const startDay = String(week.startDay).padStart(2, '0');
    const endDay = String(week.endDay).padStart(2, '0');
    const weekStart = new Date(`${year}-${monthString}-${startDay}T00:00:00.000+07:00`);
    const weekEnd = new Date(`${year}-${monthString}-${endDay}T23:59:59.999+07:00`);
    const logs = attendances.filter((attendance) => {
      let date = attendance.checkInTime ? new Date(attendance.checkInTime) : null;
      if (!date && attendance.workDate) date = new Date(`${attendance.workDate}T00:00:00.000+07:00`);
      if (!date && attendance.createdAt) date = new Date(attendance.createdAt);
      return date && date >= weekStart && date <= weekEnd;
    });
    const total = logs.length;
    const onTime = logs.filter((attendance) => attendance.status === 'ON_TIME').length;
    const late = logs.filter((attendance) => ['LATE', 'EARLY_LEAVE'].includes(attendance.status)).length;
    const excused = logs.filter((attendance) => attendance.status === 'EXCUSED_ABSENCE').length;
    return {
      label: week.label,
      subLabel: `${startDay}/${monthString} - ${endDay}/${monthString}`,
      rate: total ? Math.round(((onTime + excused) / total) * 100) : 0,
      lateRate: total ? Math.round((late / total) * 100) : 0,
      total,
      onTime,
      late,
    };
  });

  return {
    totalRecords: attendances.length,
    onTimeCount: attendances.filter((attendance) => attendance.status === 'ON_TIME').length,
    lateCount: attendances.filter((attendance) => attendance.status === 'LATE').length,
    earlyLeaveCount: attendances.filter((attendance) => attendance.status === 'EARLY_LEAVE').length,
    absentCount: attendances.filter((attendance) => attendance.status === 'ABSENT').length,
    excusedAbsenceCount: attendances.filter((attendance) => attendance.status === 'EXCUSED_ABSENCE').length,
    approvedLeaveDays: approvedLeaves.reduce((sum, leave) => {
      const effectiveStart = fromDate ? new Date(Math.max(leave.startDate.getTime(), fromDate.getTime())) : leave.startDate;
      const effectiveEnd = toDate ? new Date(Math.min(leave.endDate.getTime(), toDate.getTime())) : leave.endDate;
      return sum + calculateCalendarDays(effectiveStart, effectiveEnd);
    }, 0),
    weeklyTrend,
  };
};

const getMonthlyReportData = async ({ month: monthInput, year: yearInput, departmentId, page, limit, currentUser }) => {
  const parsedMonth = monthInput !== undefined && monthInput !== '' ? parseInt(monthInput, 10) : null;
  if (parsedMonth !== null && (Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) {
    throw new ServiceError('Tháng (month) không hợp lệ. Vui lòng cung cấp số nguyên từ 1 đến 12.', 400);
  }
  const parsedYear = yearInput !== undefined && yearInput !== '' ? parseInt(yearInput, 10) : null;
  if (parsedYear !== null && (Number.isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100)) {
    throw new ServiceError('Năm (year) không hợp lệ. Vui lòng cung cấp năm từ 2000 đến 2100.', 400);
  }
  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const month = parsedMonth || nowVN.getUTCMonth() + 1;
  const year = parsedYear || nowVN.getUTCFullYear();

  let departmentFilter = departmentId || null;
  const canViewAll = hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || ['admin', 'ADMIN'].includes(currentUser.role);
  const canViewDept = hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || ['truongkhoa', 'TRUONG_KHOA'].includes(currentUser.role);

  if (!canViewAll && canViewDept) {
    const scopedDepartmentIds = await getDeanDepartmentIds(currentUser);
    if (departmentFilter) {
      if (!scopedDepartmentIds.some((id) => id.toString() === departmentFilter.toString())) {
        throw new ServiceError('Bạn không có quyền xem báo cáo của đơn vị ngoài khoa.', 403);
      }
    } else {
      departmentFilter = scopedDepartmentIds;
    }
  } else if (!canViewAll && !canViewDept) {
    const myDeptId = currentUser.departmentId || (await User.findById(currentUser.id || currentUser._id))?.departmentId;
    if (departmentFilter && departmentFilter.toString() !== myDeptId?.toString()) {
      throw new ServiceError('Bạn chỉ có thể xem báo cáo trong đơn vị của mình.', 403);
    }
    departmentFilter = myDeptId ? [myDeptId] : [];
  }

  const options = {};
  if (page !== undefined || limit !== undefined) {
    options.page = Math.max(1, parseInt(page, 10) || 1);
    options.limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
  }
  return { month, year, result: await generateMonthlyReport(month, year, departmentFilter, options) };
};

const getExportReportDataForUser = async ({ query, currentUser }) => {
  const { userId, departmentId, from, to } = query;
  const monthValue = query.month !== undefined && query.month !== '' ? parseInt(query.month, 10) : undefined;
  const yearValue = query.year !== undefined && query.year !== '' ? parseInt(query.year, 10) : undefined;
  const month = monthValue >= 1 && monthValue <= 12 ? monthValue : undefined;
  const year = yearValue >= 2000 && yearValue <= 2100 ? yearValue : undefined;

  let targetUserIds = [];
  let departmentFilter = departmentId || null;
  const canViewAll = hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || ['admin', 'ADMIN'].includes(currentUser.role);
  const canViewDept = hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || ['truongkhoa', 'TRUONG_KHOA'].includes(currentUser.role);

  if (canViewAll) {
    if (userId) targetUserIds = [userId];
  } else if (canViewDept) {
    const scopedUserIds = await getDeanScopedUserIds(currentUser);
    const scopedDepartmentIds = await getDeanDepartmentIds(currentUser);
    if (userId) {
      if (!scopedUserIds.includes(userId.toString())) {
        throw new ServiceError('Bạn không có quyền xuất dữ liệu của nhân sự ngoài khoa.', 403);
      }
      targetUserIds = [userId];
    } else {
      targetUserIds = scopedUserIds;
    }
    if (departmentId) {
      if (!scopedDepartmentIds.some((id) => id.toString() === departmentId.toString())) {
        throw new ServiceError('Bạn không có quyền xuất báo cáo của đơn vị ngoài khoa.', 403);
      }
    } else {
      departmentFilter = scopedDepartmentIds;
    }
  } else {
    targetUserIds = [currentUser.id || currentUser._id];
  }

  return generateExportReportData({
    month,
    year,
    from,
    to,
    departmentId: departmentFilter,
    targetUserIds,
  });
};

// Helper định dạng ngày tháng theo múi giờ Việt Nam (UTC+07:00)
const toVnDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
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
  const day = vn.getUTCDay();
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[day] || '';
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'ON_TIME':
      return 'Đúng giờ';
    case 'LATE':
      return 'Đi muộn';
    case 'EARLY_LEAVE':
      return 'Về sớm';
    case 'ABSENT':
      return 'Vắng mặt';
    case 'EXCUSED_ABSENCE':
      return 'Nghỉ có phép';
    default:
      return status || '--';
  }
};

const getMethodLabel = (method) => {
  switch (method) {
    case 'face':
      return 'Face ID (Máy chấm công)';
    case 'qr':
      return 'Mã QR';
    case 'manual':
      return 'Thủ công';
    case 'gps':
      return 'Định vị GPS';
    case 'admin_override':
      return 'Quản trị điều chỉnh';
    case 'fingerprint':
      return 'Vân tay';
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
    case 'APPROVED':
      return 'Đã duyệt';
    case 'PENDING':
      return 'Chờ duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    default:
      return status || '--';
  }
};

const getRoleLabel = (role) => {
  switch (role) {
    case 'admin':
    case 'ADMIN':
      return 'Quản trị viên';
    case 'BGH':
      return 'Ban Giám hiệu';
    case 'TCCB':
      return 'Phòng Tổ chức Cán bộ';
    case 'DAO_TAO':
      return 'Phòng Đào tạo';
    case 'KE_TOAN':
      return 'Phòng Kế toán';
    case 'KIEM_TOAN':
      return 'Ban Kiểm toán';
    case 'truongkhoa':
    case 'TRUONG_KHOA':
      return 'Trưởng Khoa';
    case 'PHO_TRUONG_KHOA':
      return 'Phó Trưởng Khoa';
    case 'TRUONG_BO_MON':
      return 'Trưởng Bộ môn';
    case 'PHO_TRUONG_BO_MON':
      return 'Phó Trưởng Bộ môn';
    case 'TRUONG_PHONG':
      return 'Trưởng Phòng';
    case 'PHO_TRUONG_PHONG':
      return 'Phó Trưởng Phòng';
    case 'giangvien':
    case 'GIANG_VIEN':
      return 'Giảng Viên';
    case 'nhanvien':
    case 'CHUYEN_VIEN':
      return 'Chuyên viên / Cán bộ';
    default:
      return role || 'Cán bộ';
  }
};

/**
 * Service tổng hợp báo cáo chấm công toàn trường hoặc theo Khoa
 * @param {number} month - Tháng (1-12)
 * @param {number} year - Năm (vd: 2026)
 * @param {string|Array<string>} departmentId - ID đơn vị hoặc danh sách ID đơn vị
 * @param {Object} options - Tùy chọn phân trang { page, limit }
 */
const generateMonthlyReport = async (month, year, departmentId = null, options = {}) => {
  const mStr = String(month).padStart(2, '0');
  // Tính chính xác ngày cuối cùng của tháng theo lịch dương
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  // Mốc thời gian bắt đầu và kết thúc tháng đúng theo múi giờ Việt Nam (Asia/Ho_Chi_Minh: UTC+07:00)
  const startDate = new Date(`${year}-${mStr}-01T00:00:00.000+07:00`);
  const endDate = new Date(`${year}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);

  let userFilter = { isActive: true, ...NON_ADMIN_MONGO_CRITERIA };
  if (departmentId) {
    if (Array.isArray(departmentId)) {
      userFilter.departmentId = { $in: departmentId };
    } else {
      const childDepts = await Department.find({ parentId: departmentId }).select('_id');
      const allDeptIds = [departmentId, ...childDepts.map((d) => d._id)];
      userFilter.departmentId = { $in: allDeptIds };
    }
  }

  const totalUsers = await User.countDocuments(userFilter);

  // Nạp danh mục đơn vị để ánh xạ tên phòng ban
  const allDepartments = await Department.find().select('_id name ten_phong_ban').lean();
  const deptMap = {};
  allDepartments.forEach((d) => {
    deptMap[d._id.toString()] = d.name || d.ten_phong_ban || '';
  });

  let userQuery = User.find(userFilter).select('_id fullName email role departmentId avatar staffCode ma_can_bo');

  const { page, limit } = options;
  if (page && limit) {
    const skip = (page - 1) * limit;
    userQuery = userQuery.skip(skip).limit(limit);
  } else {
    // Giới hạn an toàn tối đa 500 bản ghi để chống tràn RAM khi chạy quy mô lớn
    userQuery = userQuery.limit(500);
  }

  const rawUsers = await userQuery;
  const users = rawUsers.filter((u) => !isSystemAdminUser(u));
  const userIds = users.map((u) => u._id);

  // Chỉ lấy các trường cần thiết phục vụ thống kê
  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendances = await AttendanceLog.find({
    userId: { $in: userIds },
    ...dateFilter,
  })
    .select('userId status checkInTime createdAt workDate');

  const reportData = users.map((user) => {
    const userIdStr = user._id ? user._id.toString() : '';
    const userAttendances = attendances.filter((a) => {
      const aUid = a.userId;
      return aUid && aUid.toString() === userIdStr;
    });
    const uFullName = user.fullName || '';
    const uRole = user.role || '';
    const uDeptId = user.departmentId || null;
    const uAvatar = user.avatar || null;
    const dName = uDeptId ? deptMap[uDeptId.toString()] || 'Chưa phân bổ' : 'Chưa phân bổ';
    const sCode = user.staffCode || user.ma_can_bo || (user._id ? `CB-${user._id.toString().slice(-4).toUpperCase()}` : '--');

    const totalShifts = userAttendances.length;
    const onTime = userAttendances.filter((a) => a.status === 'ON_TIME').length;
    const late = userAttendances.filter((a) => a.status === 'LATE').length;
    const early = userAttendances.filter((a) => a.status === 'EARLY_LEAVE').length;
    const absent = userAttendances.filter((a) => a.status === 'ABSENT').length;
    const excused = userAttendances.filter((a) => a.status === 'EXCUSED_ABSENCE').length;
    const valid = onTime + excused;
    const attendanceRate = totalShifts > 0 ? Math.round((valid / totalShifts) * 100) : 100;

    return {
      userId: user._id,
      employeeId: sCode,
      staffCode: sCode,
      fullName: uFullName,
      email: user.email,
      role: uRole,
      departmentId: uDeptId,
      departmentName: dName,
      avatar: uAvatar,
      user: {
        id: user._id,
        fullName: uFullName,
        email: user.email,
        role: uRole,
        departmentId: uDeptId,
        departmentName: dName,
        avatar: uAvatar,
        staffCode: sCode,
      },
      totalShifts,
      totalWorkingDays: totalShifts,
      onTime,
      onTimeCount: onTime,
      late,
      lateCount: late,
      early,
      earlyLeaveCount: early,
      absent,
      absentCount: absent,
      excused,
      excusedCount: excused,
      attendanceRate,
    };
  });

  // Tính xu hướng chuyên cần theo 4 tuần trong tháng hoàn toàn từ dữ liệu MongoDB thật
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekRanges = [
    { label: 'Tuần 1', start: 1, end: 7 },
    { label: 'Tuần 2', start: 8, end: 14 },
    { label: 'Tuần 3', start: 15, end: 21 },
    { label: 'Tuần 4', start: 22, end: daysInMonth },
  ];

  const weeklyTrend = weekRanges.map(({ label, start, end }) => {
    // Sử dụng múi giờ Việt Nam (UTC+7) cho ranh giới tuần
    const startDayStr = String(start).padStart(2, '0');
    const endDayStr = String(end).padStart(2, '0');
    const wStart = new Date(`${year}-${mStr}-${startDayStr}T00:00:00.000+07:00`);
    const wEnd = new Date(`${year}-${mStr}-${endDayStr}T23:59:59.999+07:00`);

    const weekLogs = attendances.filter((a) => {
      let t = a.checkInTime ? new Date(a.checkInTime) : null;
      if (!t && a.workDate) {
        t = new Date(`${a.workDate}T00:00:00.000+07:00`);
      }
      if (!t && a.createdAt) {
        t = new Date(a.createdAt);
      }
      return t && t >= wStart && t <= wEnd;
    });

    const total = weekLogs.length;
    const onTime = weekLogs.filter((a) => a.status === 'ON_TIME' || a.status === 'EXCUSED_ABSENCE').length;
    const late = weekLogs.filter((a) => a.status === 'LATE' || a.status === 'EARLY_LEAVE').length;

    const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;

    return {
      label,
      subLabel: `${String(start).padStart(2, '0')}/${mStr} - ${String(end).padStart(2, '0')}/${mStr}`,
      rate,
      lateRate,
      total,
      onTime,
      late,
    };
  });

  return {
    report: reportData,
    totalUsers,
    weeklyTrend,
    pagination: {
      page: page || 1,
      limit: limit || reportData.length,
      totalPages: limit ? Math.ceil(totalUsers / limit) || 1 : 1,
      totalUsers,
    },
  };
};

/**
 * Service trích xuất dữ liệu chi tiết cho file Excel 5 Sheets
 */
const generateExportReportData = async ({
  month,
  year,
  from,
  to,
  departmentId,
  targetUserIds = [],
}) => {
  let startDate = null;
  let endDate = null;
  let periodLabel = '';

  if (month && year) {
    const mStr = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDayStr = String(lastDay).padStart(2, '0');
    startDate = new Date(`${year}-${mStr}-01T00:00:00.000+07:00`);
    endDate = new Date(`${year}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);
    periodLabel = `Tháng ${mStr}/${year} (01/${mStr}/${year} - ${lastDayStr}/${mStr}/${year})`;
  } else if (from || to) {
    startDate = from
      ? (typeof from === 'string' && from.length === 10
          ? new Date(`${from}T00:00:00.000+07:00`)
          : new Date(from))
      : new Date('2020-01-01T00:00:00.000+07:00');
    endDate = to
      ? (typeof to === 'string' && to.length === 10
          ? new Date(`${to}T23:59:59.999+07:00`)
          : new Date(to))
      : new Date();
    periodLabel = `Từ ngày ${formatDateVN(startDate)} đến ngày ${formatDateVN(endDate)}`;
  } else {
    // Mặc định tháng hiện tại theo giờ VN
    const nowVn = new Date(Date.now() + 7 * 3600 * 1000);
    const curM = nowVn.getUTCMonth() + 1;
    const curY = nowVn.getUTCFullYear();
    const mStr = String(curM).padStart(2, '0');
    const lastDay = new Date(Date.UTC(curY, curM, 0)).getUTCDate();
    const lastDayStr = String(lastDay).padStart(2, '0');
    startDate = new Date(`${curY}-${mStr}-01T00:00:00.000+07:00`);
    endDate = new Date(`${curY}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);
    periodLabel = `Tháng ${mStr}/${curY} (01/${mStr}/${curY} - ${lastDayStr}/${mStr}/${curY})`;
  }

  // 1. Tải danh mục đơn vị phòng ban để ánh xạ tên
  const allDepartments = await Department.find().select('_id name type parentId').lean();
  const deptMap = {};
  allDepartments.forEach((d) => {
    deptMap[d._id.toString()] = d.name || d.ten_phong_ban || '';
  });

  const userFilter = { isActive: true, ...NON_ADMIN_MONGO_CRITERIA };
  if (targetUserIds && targetUserIds.length > 0) {
    userFilter._id = { $in: targetUserIds };
  } else if (departmentId) {
    if (Array.isArray(departmentId)) {
      userFilter.departmentId = { $in: departmentId };
    } else {
      const childDepts = await Department.find({ parentId: departmentId }).select('_id');
      const allDeptIds = [departmentId, ...childDepts.map((d) => d._id)];
      userFilter.departmentId = { $in: allDeptIds };
    }
  }

  const rawUsers = await User.find(userFilter).select('_id fullName email role departmentId staffCode roles').lean();
  const users = rawUsers.filter((u) => !isSystemAdminUser(u));
  const effectiveUserIds = users.map((u) => u._id);

  // 3. Lấy tất cả lịch sử chấm công trong khoảng thời gian
  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendanceLogs = await AttendanceLog.find({
    userId: { $in: effectiveUserIds },
    ...dateFilter,
  })
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
    .populate('scheduleId', 'roomId weekday startTime endTime')
    .populate('leaveRequestId', 'type reason status')
    .sort({ checkInTime: -1, createdAt: -1 })
    .lean();

  // 4. Lấy danh sách đơn nghỉ trong khoảng thời gian
  const leaveQuery = {
    userId: { $in: effectiveUserIds },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };
  const leaveRequests = await LeaveRequest.find(leaveQuery)
    .populate('userId', 'fullName email role departmentId')
    .populate('approvedBy', 'fullName email role')
    .sort({ createdAt: -1 })
    .lean();

  // 5. Chuẩn bị dữ liệu Sheet 2: Chi tiết chấm công
  const attendanceDetailList = attendanceLogs.map((log, index) => {
    const userObj = log.userId || {};
    const shiftObj = log.shiftId || {};
    const schedObj = log.scheduleId || {};

    const deptName = userObj.departmentId
      ? deptMap[userObj.departmentId.toString()] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    const workDate = log.checkInTime || log.createdAt || log.workDate;
    const checkIn = log.checkInTime ? new Date(log.checkInTime) : null;
    const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : null;

    const shiftStart = schedObj.startTime || shiftObj.startTime || '07:30';
    const shiftEnd = schedObj.endTime || shiftObj.endTime || '11:30';

    // Tính toán số phút trễ / sớm
    let lateEarlyMinutes = '0 phút';
    if (log.status === 'ON_TIME') {
      lateEarlyMinutes = '0 phút (Đúng giờ)';
    } else if (log.status === 'LATE') {
      if (checkIn) {
        const vnCI = toVnDate(checkIn);
        const [shH, shM] = shiftStart.split(':').map(Number);
        const shiftStartM = shH * 60 + shM;
        const actualM = vnCI.getUTCHours() * 60 + vnCI.getUTCMinutes();
        const diff = Math.max(1, actualM - shiftStartM);
        lateEarlyMinutes = `Muộn ${diff} phút`;
      } else {
        lateEarlyMinutes = 'Đi muộn';
      }
    } else if (log.status === 'EARLY_LEAVE') {
      if (checkOut) {
        const vnCO = toVnDate(checkOut);
        const [ehH, ehM] = shiftEnd.split(':').map(Number);
        const shiftEndM = ehH * 60 + ehM;
        const actualM = vnCO.getUTCHours() * 60 + vnCO.getUTCMinutes();
        const diff = Math.max(1, shiftEndM - actualM);
        lateEarlyMinutes = `Về sớm ${diff} phút`;
      } else {
        lateEarlyMinutes = 'Về sớm';
      }
    } else if (log.status === 'ABSENT') {
      lateEarlyMinutes = 'Vắng mặt';
    } else if (log.status === 'EXCUSED_ABSENCE') {
      lateEarlyMinutes = 'Nghỉ có phép';
    }

    // Tọa độ GPS
    let gpsCoords = 'Không ghi nhận';
    if (log.location && log.location.lat !== null && log.location.lng !== null) {
      gpsCoords = `${Number(log.location.lat).toFixed(4)}, ${Number(log.location.lng).toFixed(4)}`;
    }

    // Ghi chú
    let note = '';
    if (log.isManualOverride) {
      note = 'Quản trị viên điều chỉnh thủ công';
    } else if (log.method === 'face') {
      if (log.confidenceScore !== null && log.confidenceScore !== undefined) {
        note = `Face ID (Máy chấm công - Độ tin cậy ${(log.confidenceScore * 100).toFixed(0)}%)`;
      } else {
        note = 'Face ID (Máy chấm công)';
      }
    } else if (log.leaveRequestId) {
      note = `Đơn nghỉ: ${getLeaveTypeLabel(log.leaveRequestId.type || '')} (${log.leaveRequestId.reason || ''})`;
    }

    return {
      stt: index + 1,
      employeeId: userObj._id ? userObj._id.toString().slice(-6).toUpperCase() : '',
      fullName: userObj.fullName || 'Cán bộ',
      departmentName: deptName,
      date: formatDateVN(workDate),
      weekday: getWeekdayVN(workDate),
      shiftName: shiftObj.name || 'Ca làm việc',
      scheduledTime: `${shiftStart} - ${shiftEnd}`,
      checkInTime: formatTimeVN(checkIn),
      checkOutTime: formatTimeVN(checkOut),
      status: getStatusLabel(log.status),
      statusCode: log.status,
      lateEarlyMinutes,
      method: getMethodLabel(log.method),
      gpsCoordinates: gpsCoords,
      notes: note,
    };
  });

  // 6. Chuẩn bị dữ liệu Sheet 3: Chi tiết đơn nghỉ
  const leaveDetailList = leaveRequests.map((req, index) => {
    const userObj = req.userId || {};
    const approverObj = req.approvedBy || {};

    const deptName = userObj.departmentId
      ? deptMap[userObj.departmentId.toString()] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    // Tính số ngày nghỉ
    const s = new Date(req.startDate);
    const e = new Date(req.endDate);
    let numDays = 1;
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
      const sUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
      const eUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
      numDays = Math.max(1, Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1);
    }

    let approvalInfo = '';
    if (req.status === 'APPROVED') {
      const dateStr = req.updatedAt ? formatDateVN(req.updatedAt) : '';
      approvalInfo = `Duyệt ngày ${dateStr}${req.approvalNote ? `: ${req.approvalNote}` : ''}`;
    } else if (req.status === 'REJECTED') {
      const dateStr = req.updatedAt ? formatDateVN(req.updatedAt) : '';
      approvalInfo = `Từ chối ngày ${dateStr}${req.rejectionReason ? `: ${req.rejectionReason}` : ''}`;
    } else {
      approvalInfo = 'Đang chờ xét duyệt';
    }

    return {
      stt: index + 1,
      requestId: req._id ? req._id.toString().slice(-6).toUpperCase() : '',
      fullName: userObj.fullName || 'Cán bộ',
      departmentName: deptName,
      leaveType: getLeaveTypeLabel(req.type),
      startDate: formatDateVN(req.startDate),
      endDate: formatDateVN(req.endDate),
      numberOfDays: numDays,
      reason: req.reason || '',
      status: getLeaveStatusLabel(req.status),
      statusCode: req.status,
      approver: approverObj.fullName || '--',
      approvalNote: approvalInfo,
    };
  });

  // 7. Chuẩn bị dữ liệu Sheet 4: Thống kê nhân sự
  const staffStatsList = users.map((user, index) => {
    const uLogs = attendanceLogs.filter((l) => {
      const logUid = l.userId ? (l.userId._id || l.userId).toString() : '';
      return logUid === user._id.toString();
    });

    const deptName = user.departmentId
      ? deptMap[user.departmentId.toString()] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    const totalShifts = uLogs.length;
    const onTime = uLogs.filter((l) => l.status === 'ON_TIME').length;
    const late = uLogs.filter((l) => l.status === 'LATE').length;
    const early = uLogs.filter((l) => l.status === 'EARLY_LEAVE').length;
    const absent = uLogs.filter((l) => l.status === 'ABSENT').length;
    const excused = uLogs.filter((l) => l.status === 'EXCUSED_ABSENCE').length;

    const validShifts = onTime + excused;
    const rate = totalShifts > 0 ? Math.round((validShifts / totalShifts) * 100) : 100;

    return {
      stt: index + 1,
      employeeId: user._id.toString().slice(-6).toUpperCase(),
      fullName: user.fullName,
      email: user.email,
      departmentName: deptName,
      role: getRoleLabel(user.role),
      totalShifts,
      onTime,
      late,
      early,
      absent,
      excused,
      attendanceRate: rate,
    };
  });

  // 8. Chuẩn bị dữ liệu Sheet 5: Thống kê theo ngày
  // Tạo danh sách từng ngày trong khoảng thời gian
  const dailyStatsMap = {};
  const currentCursor = new Date(startDate.getTime());
  while (currentCursor <= endDate) {
    const vnCursor = toVnDate(currentCursor);
    const dateKey = `${String(vnCursor.getUTCDate()).padStart(2, '0')}/${String(vnCursor.getUTCMonth() + 1).padStart(2, '0')}/${vnCursor.getUTCFullYear()}`;
    if (!dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey] = {
        date: dateKey,
        weekday: getWeekdayVN(currentCursor),
        totalShifts: 0,
        onTime: 0,
        late: 0,
        early: 0,
        absent: 0,
        excused: 0,
      };
    }
    currentCursor.setUTCDate(currentCursor.getUTCDate() + 1);
  }

  attendanceLogs.forEach((log) => {
    const workDate = log.checkInTime || log.createdAt || log.workDate;
    const dateKey = formatDateVN(workDate);
    if (!dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey] = {
        date: dateKey,
        weekday: getWeekdayVN(workDate),
        totalShifts: 0,
        onTime: 0,
        late: 0,
        early: 0,
        absent: 0,
        excused: 0,
      };
    }

    dailyStatsMap[dateKey].totalShifts += 1;
    if (log.status === 'ON_TIME') dailyStatsMap[dateKey].onTime += 1;
    else if (log.status === 'LATE') dailyStatsMap[dateKey].late += 1;
    else if (log.status === 'EARLY_LEAVE') dailyStatsMap[dateKey].early += 1;
    else if (log.status === 'ABSENT') dailyStatsMap[dateKey].absent += 1;
    else if (log.status === 'EXCUSED_ABSENCE') dailyStatsMap[dateKey].excused += 1;
  });

  const dailyStatsList = Object.values(dailyStatsMap).map((d, index) => {
    const valid = d.onTime + d.excused;
    const rate = d.totalShifts > 0 ? Math.round((valid / d.totalShifts) * 100) : 0;
    return {
      stt: index + 1,
      ...d,
      attendanceRate: rate,
    };
  });

  // 9. Chuẩn bị dữ liệu Sheet 1: Tổng quan
  const totalShifts = attendanceLogs.length;
  const onTimeCount = attendanceLogs.filter((l) => l.status === 'ON_TIME').length;
  const lateCount = attendanceLogs.filter((l) => l.status === 'LATE').length;
  const earlyLeaveCount = attendanceLogs.filter((l) => l.status === 'EARLY_LEAVE').length;
  const absentCount = attendanceLogs.filter((l) => l.status === 'ABSENT').length;
  const excusedAbsenceCount = attendanceLogs.filter((l) => l.status === 'EXCUSED_ABSENCE').length;

  const validShifts = onTimeCount + excusedAbsenceCount;
  const overallAttendanceRate = totalShifts > 0 ? Math.round((validShifts / totalShifts) * 100) : 100;

  // Tính số ngày nghỉ phép đã duyệt
  const approvedLeaves = leaveRequests.filter((r) => r.status === 'APPROVED' && r.type === 'nghi_phep');
  const approvedLeaveDays = approvedLeaves.reduce((sum, item) => {
    const s = new Date(item.startDate);
    const e = new Date(item.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return sum;
    const sUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    const eUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
    return sum + Math.max(1, Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1);
  }, 0);

  // Lấy tên đơn vị lọc nếu có
  let departmentLabel = 'Toàn trường';
  if (departmentId && deptMap[departmentId.toString()]) {
    departmentLabel = deptMap[departmentId.toString()];
  }

  const overview = {
    period: periodLabel,
    department: departmentLabel,
    totalUsers: users.length,
    totalShifts,
    onTimeCount,
    lateCount,
    earlyLeaveCount,
    absentCount,
    excusedAbsenceCount,
    overallAttendanceRate,
    approvedLeaveDays,
    exportedAt: formatDateVN(new Date()) + ' ' + formatTimeVN(new Date()),
  };

  return {
    overview,
    attendanceLogs: attendanceDetailList,
    leaveRequests: leaveDetailList,
    staffStats: staffStatsList,
    dailyStats: dailyStatsList,
  };
};

module.exports = {
  ServiceError,
  generateMonthlyReport,
  generateExportReportData,
  getAttendanceReportData,
  getMonthlyReportData,
  getExportReportDataForUser,
};
