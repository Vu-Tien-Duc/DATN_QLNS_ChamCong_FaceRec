/**
 * Dịch vụ Báo cáo & Thống kê Chấm công (server/services/baoCao.service.js)
 * Tổng hợp báo cáo chấm công theo quyền truy cập, báo cáo tháng và re-export module xuất Excel.
 */
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  NguoiDung,
  PhongBan,
  DonNghiPhep,
  VaiTroNguoiDung,
} = require('../../models');
const { buildAttendanceDateFilter, getVietnamTime } = require('../../utils/thoiGianChamCong.utils');
const { getDeanDepartmentIds, getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { PERMISSIONS, hasPermission } = require('../../config/permissions');
const { normalizeRole, UNIT_LEADER_ROLES } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');
const {
  calculateCalendarDays,
  toDateKey,
  isSystemAdminUser,
} = require('./dinhDangBaoCao.helper');
const { calculateLeaveDays, getHolidayDateSet } = require('../donNghiPhep/tinhPhepNam.helper');
const xuatBaoCaoExcelService = require('./xuatBaoCaoExcel.service');

const getAttendanceReportData = async (payload = {}) => {
  const userId = payload.nguoi_dung_id;
  const departmentId = payload.don_vi_id;
  const from = payload.tu_ngay;
  const to = payload.den_ngay;
  const currentUser = payload.currentUser;
  let targetUserIds = [];
  const currentRole = normalizeRole(currentUser.vai_tro_chinh);
  const canViewAll =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || ['admin', 'bgh'].includes(currentRole);
  const canViewDept =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || UNIT_LEADER_ROLES.includes(currentRole);

  if (canViewAll) {
    if (userId) {
      targetUserIds = [userId];
    } else if (departmentId) {
      const childDepartments = await PhongBan.findAll({
        where: { don_vi_cha_id: departmentId },
        attributes: ['id'],
        raw: true,
      });
      const departmentIds = [departmentId, ...childDepartments.map((dept) => dept.id)];
      const departmentUsers = await NguoiDung.findAll({
        where: {
          don_vi_chinh_id: { [Op.in]: departmentIds },
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        },
        attributes: ['id', 'ma_can_bo', 'email', 'vai_tro_chinh', 'ho_ten'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = departmentUsers.filter((u) => !isSystemAdminUser(u)).map((user) => user.id);
    } else {
      const allUsers = await NguoiDung.findAll({
        where: {
          kich_hoat: true,
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        },
        attributes: ['id', 'ma_can_bo', 'email', 'vai_tro_chinh', 'ho_ten'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = allUsers.filter((u) => !isSystemAdminUser(u)).map((user) => user.id);
    }
  } else if (canViewDept) {
    const scopedUserIds = await getDeanScopedUserIds(currentUser);
    if (userId) {
      if (!scopedUserIds.map(String).includes(String(userId))) {
        throw new ServiceError('Bạn không có quyền xem thống kê của nhân sự ngoài khoa / đơn vị.', 403);
      }
      targetUserIds = [userId];
    } else {
      targetUserIds = scopedUserIds;
    }
  } else {
    targetUserIds = [currentUser.id];
  }

  let fromDate = null;
  let toDate = null;
  if (from) {
    fromDate =
      typeof from === 'string' && from.length === 10
        ? new Date(`${from}T00:00:00.000+07:00`)
        : new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new ServiceError('Ngày bắt đầu (from) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', 400);
    }
  }
  if (to) {
    toDate =
      typeof to === 'string' && to.length === 10
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

  const safeIds = targetUserIds.length ? targetUserIds : ['00000000-0000-0000-0000-000000000000'];
  const attendanceWhere = { nguoi_dung_id: { [Op.in]: safeIds } };
  if (fromDate || toDate) Object.assign(attendanceWhere, buildAttendanceDateFilter(fromDate, toDate));
  const attendances = await NhatKyChamCong.findAll({ where: attendanceWhere });

  const leaveWhere = {
    nguoi_dung_id: { [Op.in]: safeIds },
    trang_thai: 'approved',
    loai_don: 'nghi_phep',
  };
  if (toDate) leaveWhere.ngay_bat_dau = { [Op.lte]: toDateKey(toDate) };
  if (fromDate) leaveWhere.ngay_ket_thuc = { [Op.gte]: toDateKey(fromDate) };
  const approvedLeaves = await DonNghiPhep.findAll({ where: leaveWhere });

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
      let date = attendance.thoi_gian_vao ? new Date(attendance.thoi_gian_vao) : null;
      if (!date && attendance.ngay_cong) date = new Date(`${attendance.ngay_cong}T00:00:00.000+07:00`);
      if (!date && attendance.tao_luc) date = new Date(attendance.tao_luc);
      return date && date >= weekStart && date <= weekEnd;
    });
    const total = logs.length;
    const onTime = logs.filter((attendance) => attendance.trang_thai === 'on_time').length;
    const late = logs.filter((attendance) => ['late', 'early_leave'].includes(attendance.trang_thai)).length;
    const excused = logs.filter((attendance) => attendance.trang_thai === 'excused_absence').length;
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

  const reportRangeStartKey = fromDate ? toDateKey(fromDate) : null;
  const reportRangeEndKey = toDate ? toDateKey(toDate) : null;
  const hasBoundaryOverlap = approvedLeaves.some((leave) => {
    const lStartKey = String(leave.ngay_bat_dau).slice(0, 10);
    const lEndKey = String(leave.ngay_ket_thuc).slice(0, 10);
    return (
      (reportRangeStartKey && lStartKey < reportRangeStartKey) ||
      (reportRangeEndKey && lEndKey > reportRangeEndKey)
    );
  });
  const holidaySet =
    hasBoundaryOverlap && approvedLeaves.length > 0
      ? await getHolidayDateSet(
          reportRangeStartKey || approvedLeaves[0].ngay_bat_dau,
          reportRangeEndKey || approvedLeaves[0].ngay_ket_thuc
        )
      : null;

  return {
    totalRecords: attendances.length,
    onTimeCount: attendances.filter((attendance) => attendance.trang_thai === 'on_time').length,
    lateCount: attendances.filter((attendance) => attendance.trang_thai === 'late').length,
    earlyLeaveCount: attendances.filter((attendance) => attendance.trang_thai === 'early_leave').length,
    absentCount: attendances.filter((attendance) => attendance.trang_thai === 'absent').length,
    excusedAbsenceCount: attendances.filter((attendance) => attendance.trang_thai === 'excused_absence').length,
    approvedLeaveDays: approvedLeaves.reduce((sum, leave) => {
      const lStartKey = String(leave.ngay_bat_dau).slice(0, 10);
      const lEndKey = String(leave.ngay_ket_thuc).slice(0, 10);
      if (
        (!reportRangeStartKey || lStartKey >= reportRangeStartKey) &&
        (!reportRangeEndKey || lEndKey <= reportRangeEndKey)
      ) {
        return sum + Number(leave.so_ngay ?? 1);
      }
      const effStart = reportRangeStartKey && lStartKey < reportRangeStartKey ? reportRangeStartKey : lStartKey;
      const effEnd = reportRangeEndKey && lEndKey > reportRangeEndKey ? reportRangeEndKey : lEndKey;
      const isHalfDay = Number(leave.so_ngay) === 0.5 && lStartKey === lEndKey;
      return sum + calculateLeaveDays(effStart, effEnd, isHalfDay, holidaySet);
    }, 0),
    weeklyTrend,
  };
};

const generateMonthlyReport = async (month, year, departmentId = null, options = {}) => {
  const mStr = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  const startDate = new Date(`${year}-${mStr}-01T00:00:00.000+07:00`);
  const endDate = new Date(`${year}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);

  const userWhere = {
    kich_hoat: true,
    vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
  };
  if (departmentId) {
    if (Array.isArray(departmentId)) {
      userWhere.don_vi_chinh_id = {
        [Op.in]: departmentId.length ? departmentId : ['00000000-0000-0000-0000-000000000000'],
      };
    } else {
      const childDepts = await PhongBan.findAll({
        where: { don_vi_cha_id: departmentId },
        attributes: ['id'],
        raw: true,
      });
      const allDeptIds = [departmentId, ...childDepts.map((d) => d.id)];
      userWhere.don_vi_chinh_id = { [Op.in]: allDeptIds };
    }
  }

  const allDepartments = await PhongBan.findAll({ attributes: ['id', 'ten_phong_ban'], raw: true });
  const deptMap = {};
  allDepartments.forEach((d) => {
    deptMap[String(d.id)] = d.ten_phong_ban || '';
  });

  const { page, limit } = options;
  const candidateUsers = await NguoiDung.findAll({
    where: userWhere,
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien', 'ma_can_bo'],
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
    order: [['ho_ten', 'ASC']],
  });

  const eligibleUsers = candidateUsers.filter((u) => !isSystemAdminUser(u));
  const totalUsers = eligibleUsers.length;
  const offset = page && limit ? (page - 1) * limit : 0;
  const effectiveLimit = page && limit ? limit : 500;
  const users = eligibleUsers.slice(offset, offset + effectiveLimit);
  const userIds = users.map((u) => u.id);

  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendances = userIds.length
    ? await NhatKyChamCong.findAll({
        where: { nguoi_dung_id: { [Op.in]: userIds }, ...dateFilter },
        attributes: ['id', 'nguoi_dung_id', 'trang_thai', 'thoi_gian_vao', 'tao_luc', 'ngay_cong'],
        raw: true,
      })
    : [];

  const reportData = users.map((user) => {
    const userIdStr = String(user.id);
    const userAttendances = attendances.filter((a) => String(a.nguoi_dung_id) === userIdStr);
    const uFullName = user.ho_ten || '';
    const uRole = user.vai_tro_chinh || '';
    const uDeptId = user.don_vi_chinh_id || null;
    const uAvatar = user.anh_dai_dien || null;
    const dName = uDeptId ? deptMap[String(uDeptId)] || 'Chưa phân bổ' : 'Chưa phân bổ';
    const sCode = user.ma_can_bo || `CB-${userIdStr.slice(-4).toUpperCase()}`;

    const totalShifts = userAttendances.length;
    const onTime = userAttendances.filter((a) => a.trang_thai === 'on_time').length;
    const late = userAttendances.filter((a) => a.trang_thai === 'late').length;
    const early = userAttendances.filter((a) => a.trang_thai === 'early_leave').length;
    const absent = userAttendances.filter((a) => a.trang_thai === 'absent').length;
    const excused = userAttendances.filter((a) => a.trang_thai === 'excused_absence').length;
    const attendanceRate = totalShifts > 0 ? Math.round(((onTime + excused) / totalShifts) * 100) : 100;

    return {
      userId: user.id,
      nguoi_dung_id: user.id,
      employeeId: sCode,
      staffCode: sCode,
      ma_can_bo: sCode,
      fullName: uFullName,
      ho_ten: uFullName,
      email: user.email,
      role: uRole,
      vai_tro_chinh: uRole,
      departmentId: uDeptId,
      don_vi_id: uDeptId,
      departmentName: dName,
      ten_phong_ban: dName,
      avatar: uAvatar,
      anh_dai_dien: uAvatar,
      totalShifts,
      tong_so_ca: totalShifts,
      onTime,
      so_lan_dung_gio: onTime,
      late,
      so_lan_di_muon: late,
      early,
      so_lan_ve_som: early,
      absent,
      so_lan_vang_mat: absent,
      excused,
      so_lan_co_phep: excused,
      attendanceRate,
      ty_le_chuyen_can: attendanceRate,
    };
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const weekRanges = [
    { label: 'Tuần 1', start: 1, end: 7 },
    { label: 'Tuần 2', start: 8, end: 14 },
    { label: 'Tuần 3', start: 15, end: 21 },
    { label: 'Tuần 4', start: 22, end: daysInMonth },
  ];

  const weeklyTrend = weekRanges.map(({ label, start, end }) => {
    const startDayStr = String(start).padStart(2, '0');
    const endDayStr = String(end).padStart(2, '0');
    const wStart = new Date(`${year}-${mStr}-${startDayStr}T00:00:00.000+07:00`);
    const wEnd = new Date(`${year}-${mStr}-${endDayStr}T23:59:59.999+07:00`);

    const weekLogs = attendances.filter((a) => {
      let t = a.thoi_gian_vao ? new Date(a.thoi_gian_vao) : null;
      if (!t && a.ngay_cong) t = new Date(`${a.ngay_cong}T00:00:00.000+07:00`);
      if (!t && a.tao_luc) t = new Date(a.tao_luc);
      return t && t >= wStart && t <= wEnd;
    });

    const total = weekLogs.length;
    const onTime = weekLogs.filter((a) => a.trang_thai === 'on_time' || a.trang_thai === 'excused_absence').length;
    const late = weekLogs.filter((a) => a.trang_thai === 'late' || a.trang_thai === 'early_leave').length;

    return {
      label,
      subLabel: `${String(start).padStart(2, '0')}/${mStr} - ${String(end).padStart(2, '0')}/${mStr}`,
      rate: total > 0 ? Math.round((onTime / total) * 100) : 0,
      lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
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

const getMonthlyReportData = async (payload = {}) => {
  const monthInput = payload.thang;
  const yearInput = payload.nam;
  const departmentId = payload.don_vi_id;
  const page = payload.page ?? payload.trang;
  const limit = payload.limit ?? payload.gioi_han;
  const currentUser = payload.currentUser;
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
  const currentRole = normalizeRole(currentUser.vai_tro_chinh);
  const canViewAll =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || ['admin', 'bgh'].includes(currentRole);
  const canViewDept =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || UNIT_LEADER_ROLES.includes(currentRole);

  if (!canViewAll && canViewDept) {
    const scopedDepartmentIds = await getDeanDepartmentIds(currentUser);
    if (departmentFilter) {
      if (!scopedDepartmentIds.some((id) => String(id) === String(departmentFilter))) {
        throw new ServiceError('Bạn không có quyền xem báo cáo của đơn vị ngoài khoa.', 403);
      }
    } else {
      departmentFilter = scopedDepartmentIds;
    }
  } else if (!canViewAll && !canViewDept) {
    const myDeptId =
      currentUser.don_vi_chinh_id || (await NguoiDung.findByPk(currentUser.id))?.don_vi_chinh_id;
    if (departmentFilter && String(departmentFilter) !== String(myDeptId)) {
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

module.exports = {
  ServiceError,
  generateMonthlyReport,
  getAttendanceReportData,
  getMonthlyReportData,
  ...xuatBaoCaoExcelService,
};
