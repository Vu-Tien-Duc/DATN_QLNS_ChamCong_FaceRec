// Tổng hợp báo cáo thống kê chấm công theo phạm vi quyền truy cập và xuất dữ liệu Excel
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  NguoiDung,
  PhongBan,
  DonNghiPhep,
  VaiTroNguoiDung,
} = require('../../models');
const { buildAttendanceDateFilter } = require('../../utils/thoiGianChamCong.utils');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanDepartmentIds, getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { PERMISSIONS, hasPermission } = require('../../config/permissions');
const { UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');
const {
  calculateCalendarDays,
  toDateKey,
  isSystemAdminUser,
  resolveDepartmentIdsTree,
  computeWeeklyTrendBuckets,
} = require('./dinhDangBaoCao.helper');
const { calculateLeaveDays, getHolidayDateSet } = require('../donNghiPhep/tinhPhepNam.helper');
const xuatBaoCaoExcelService = require('./xuatBaoCaoExcel.service');

// Lấy báo cáo chấm công tổng hợp trong khoảng thời gian theo phạm vi phân quyền
const getAttendanceReportData = async (payload = {}) => {
  const userId = payload.nguoi_dung_id;
  const departmentId = payload.don_vi_id;
  const from = payload.tu_ngay;
  const to = payload.den_ngay;
  const currentUser = payload.currentUser;

  if (userId && !isValidUuid(String(userId))) {
    throw new ServiceError('Mã người dùng (nguoi_dung_id) không đúng định dạng UUID.', 400, 'INVALID_USER_ID');
  }
  if (departmentId && !isValidUuid(String(departmentId))) {
    throw new ServiceError('Mã đơn vị (don_vi_id) không đúng định dạng UUID.', 400, 'INVALID_DEPARTMENT_ID');
  }

  let targetUserIds = [];
  const canViewAll =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || hasAnyActiveRole(currentUser, ['admin', 'bgh']);
  const canViewDept =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);

  if (canViewAll) {
    if (userId) {
      const targetUser = await NguoiDung.findByPk(userId, {
        attributes: ['id', 'vai_tro_chinh', 'kich_hoat', 'trang_thai_lam_viec'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds =
        targetUser && !isSystemAdminUser(targetUser) ? [targetUser.id] : [];
    } else if (departmentId) {
      const departmentIds = await resolveDepartmentIdsTree(departmentId);
      const departmentUsers = await NguoiDung.findAll({
        where: {
          don_vi_chinh_id: { [Op.in]: departmentIds.length ? departmentIds : ['00000000-0000-0000-0000-000000000000'] },
          kich_hoat: true,
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
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
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        },
        attributes: ['id', 'ma_can_bo', 'email', 'vai_tro_chinh', 'ho_ten'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = allUsers.filter((u) => !isSystemAdminUser(u)).map((user) => user.id);
    }
  } else if (canViewDept) {
    const [scopedDepartmentIds, scopedUserIds] = await Promise.all([
      getDeanDepartmentIds(currentUser),
      getDeanScopedUserIds(currentUser),
    ]);
    if (userId) {
      if (!scopedUserIds.map(String).includes(String(userId))) {
        throw new ServiceError('Bạn không có quyền xem thống kê của nhân sự ngoài khoa / đơn vị.', 403);
      }
      const targetUser = await NguoiDung.findByPk(userId, {
        attributes: ['id', 'vai_tro_chinh'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = targetUser && !isSystemAdminUser(targetUser) ? [targetUser.id] : [];
    } else if (departmentId) {
      if (!scopedDepartmentIds.some((id) => String(id) === String(departmentId))) {
        throw new ServiceError('Bạn không có quyền xem thống kê của đơn vị ngoài khoa.', 403);
      }
      const subDeptIds = await resolveDepartmentIdsTree(departmentId);
      const allowedDeptSet = new Set(scopedDepartmentIds.map(String));
      const filteredDeptIds = subDeptIds.filter((id) => allowedDeptSet.has(String(id)));
      const deptUsers = await NguoiDung.findAll({
        where: {
          don_vi_chinh_id: { [Op.in]: filteredDeptIds.length ? filteredDeptIds : ['00000000-0000-0000-0000-000000000000'] },
          kich_hoat: true,
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        },
        attributes: ['id', 'vai_tro_chinh'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = deptUsers.filter((u) => !isSystemAdminUser(u)).map((u) => u.id);
    } else if (scopedUserIds.length > 0) {
      const deptUsers = await NguoiDung.findAll({
        where: {
          id: { [Op.in]: scopedUserIds },
          kich_hoat: true,
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        },
        attributes: ['id', 'vai_tro_chinh'],
        include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
      });
      targetUserIds = deptUsers.filter((u) => !isSystemAdminUser(u)).map((u) => u.id);
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
      throw new ServiceError('Ngày bắt đầu (tu_ngay) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', 400);
    }
  }
  if (to) {
    toDate =
      typeof to === 'string' && to.length === 10
        ? new Date(`${to}T23:59:59.999+07:00`)
        : new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new ServiceError('Ngày kết thúc (den_ngay) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', 400);
    }
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ServiceError(
      'Khoảng thời gian không hợp lệ: Ngày bắt đầu (tu_ngay) phải nhỏ hơn hoặc bằng ngày kết thúc (den_ngay).',
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

  const weeklyTrend = computeWeeklyTrendBuckets(attendances, fromDate, toDate);

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

  let holidaySet = null;
  if (hasBoundaryOverlap && approvedLeaves.length > 0) {
    const leaveStartKeys = approvedLeaves.map((l) => String(l.ngay_bat_dau).slice(0, 10)).sort();
    const leaveEndKeys = approvedLeaves.map((l) => String(l.ngay_ket_thuc).slice(0, 10)).sort();
    holidaySet = await getHolidayDateSet(
      reportRangeStartKey || leaveStartKeys[0],
      reportRangeEndKey || leaveEndKeys[leaveEndKeys.length - 1]
    );
  }

  return {
    totalRecords: attendances.length,
    onTimeCount: attendances.filter((attendance) => attendance.trang_thai === 'on_time').length,
    lateCount: attendances.filter((attendance) => attendance.trang_thai === 'late').length,
    earlyLeaveCount: attendances.filter((attendance) => attendance.trang_thai === 'early_leave').length,
    absentCount: attendances.filter((attendance) => attendance.trang_thai === 'absent').length,
    excusedAbsenceCount: attendances.filter((attendance) => attendance.trang_thai === 'excused_absence').length,
    thieuCheckOutCount: attendances.filter((attendance) => attendance.trang_thai === 'thieu_check_out').length,
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

// Tổng hợp số liệu chấm công, đơn nghỉ phép và xu hướng theo tuần của một tháng
const generateMonthlyReport = async (month, year, departmentId = null, options = {}) => {
  const mStr = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  const startDate = new Date(`${year}-${mStr}-01T00:00:00.000+07:00`);
  const endDate = new Date(`${year}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);

  const userWhere = {
    kich_hoat: true,
    trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
    vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
  };
  if (departmentId) {
    const allDeptIds = await resolveDepartmentIdsTree(departmentId);
    userWhere.don_vi_chinh_id = {
      [Op.in]: allDeptIds.length ? allDeptIds : ['00000000-0000-0000-0000-000000000000'],
    };
  }

  const allDepartments = await PhongBan.findAll({ attributes: ['id', 'ten_phong_ban'], raw: true });
  const deptMap = {};
  allDepartments.forEach((d) => {
    deptMap[String(d.id)] = d.ten_phong_ban || '';
  });

  const { page, limit, userId } = options;
  if (userId) {
    userWhere.id = userId;
  }
  const candidateUsers = await NguoiDung.findAll({
    where: userWhere,
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien', 'ma_can_bo'],
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
    order: [['ho_ten', 'ASC']],
  });

  const eligibleUsers = candidateUsers.filter((u) => !isSystemAdminUser(u));
  const eligibleUserIds = eligibleUsers.map((u) => u.id);
  const totalUsers = eligibleUsers.length;
  const offset = page && limit ? (page - 1) * limit : 0;
  const effectiveLimit = page && limit ? limit : 500;
  const pagedUsers = eligibleUsers.slice(offset, offset + effectiveLimit);

  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  // Truy vấn trên toàn bộ eligibleUserIds để weeklyTrend luôn phản ánh đúng cả đơn vị/toàn trường bất kể phân trang
  const allAttendances = eligibleUserIds.length
    ? await NhatKyChamCong.findAll({
        where: { nguoi_dung_id: { [Op.in]: eligibleUserIds }, ...dateFilter },
        attributes: ['id', 'nguoi_dung_id', 'trang_thai', 'thoi_gian_vao', 'tao_luc', 'ngay_cong'],
        raw: true,
      })
    : [];

  const reportData = pagedUsers.map((user) => {
    const userIdStr = String(user.id);
    const userAttendances = allAttendances.filter((a) => String(a.nguoi_dung_id) === userIdStr);
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
    const thieuCheckOut = userAttendances.filter((a) => a.trang_thai === 'thieu_check_out').length;
    const attendanceRate = totalShifts > 0 ? Math.round(((onTime + excused) / totalShifts) * 100) : 0;

    return {
      nguoi_dung_id: user.id,
      ma_can_bo: sCode,
      ho_ten: uFullName,
      email: user.email,
      vai_tro_chinh: uRole,
      don_vi_id: uDeptId,
      ten_phong_ban: dName,
      anh_dai_dien: uAvatar,
      tong_so_ca: totalShifts,
      so_lan_dung_gio: onTime,
      so_lan_di_muon: late,
      so_lan_ve_som: early,
      so_lan_vang_mat: absent,
      so_lan_co_phep: excused,
      so_lan_thieu_check_out: thieuCheckOut,
      ty_le_chuyen_can: attendanceRate,
    };
  });

  const weeklyTrend = computeWeeklyTrendBuckets(allAttendances, startDate, endDate);

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

// Kiểm tra tham số tháng/năm và trả về báo cáo tổng hợp tháng theo phạm vi quyền
const getMonthlyReportData = async (payload = {}) => {
  const monthInput = payload.thang;
  const yearInput = payload.nam;
  const departmentId = payload.don_vi_id;
  const page = payload.page ?? payload.trang;
  const limit = payload.limit ?? payload.gioi_han;
  const currentUser = payload.currentUser;

  if (departmentId && !isValidUuid(String(departmentId))) {
    throw new ServiceError('Mã đơn vị (don_vi_id) không đúng định dạng UUID.', 400, 'INVALID_DEPARTMENT_ID');
  }

  const parsedMonth = monthInput !== undefined && monthInput !== '' ? parseInt(monthInput, 10) : null;
  if (parsedMonth !== null && (Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) {
    throw new ServiceError('Tháng (thang) không hợp lệ. Vui lòng cung cấp số nguyên từ 1 đến 12.', 400);
  }
  const parsedYear = yearInput !== undefined && yearInput !== '' ? parseInt(yearInput, 10) : null;
  if (parsedYear !== null && (Number.isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100)) {
    throw new ServiceError('Năm (nam) không hợp lệ. Vui lòng cung cấp năm từ 2000 đến 2100.', 400);
  }
  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const month = parsedMonth || nowVN.getUTCMonth() + 1;
  const year = parsedYear || nowVN.getUTCFullYear();

  let departmentFilter = departmentId || null;
  const canViewAll =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || hasAnyActiveRole(currentUser, ['admin', 'bgh']);
  const canViewDept =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);

  const options = {};
  if (!canViewAll && canViewDept) {
    const scopedDepartmentIds = await getDeanDepartmentIds(currentUser);
    if (departmentFilter) {
      if (!scopedDepartmentIds.some((id) => String(id) === String(departmentFilter))) {
        throw new ServiceError('Bạn không có quyền xem báo cáo của đơn vị ngoài khoa.', 403);
      }
      const subDeptIds = await resolveDepartmentIdsTree(departmentFilter);
      const allowedSet = new Set(scopedDepartmentIds.map(String));
      departmentFilter = subDeptIds.filter((id) => allowedSet.has(String(id)));
    } else {
      departmentFilter = scopedDepartmentIds;
    }
  } else if (!canViewAll && !canViewDept) {
    const myDeptId =
      currentUser.don_vi_chinh_id || (await NguoiDung.findByPk(currentUser.id))?.don_vi_chinh_id;
    if (departmentFilter && String(departmentFilter) !== String(myDeptId)) {
      throw new ServiceError('Bạn chỉ có thể xem báo cáo chấm công của bản thân.', 403);
    }
    departmentFilter = null;
    options.userId = currentUser.id;
  }

  if (page !== undefined || limit !== undefined) {
    options.page = Math.max(1, parseInt(page, 10) || 1);
    options.limit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 20));
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
