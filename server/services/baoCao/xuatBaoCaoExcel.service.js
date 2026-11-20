// Tổng hợp dữ liệu báo cáo chấm công nhiều sheet (tổng hợp, chi tiết, đi muộn, nghỉ phép, theo đơn vị) để xuất Excel
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  NguoiDung,
  PhongBan,
  DonNghiPhep,
  VaiTroNguoiDung,
  CaLamViec,
  LichTrinh,
} = require('../../models');
const { buildAttendanceDateFilter } = require('../../utils/thoiGianChamCong.utils');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanDepartmentIds, getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { PERMISSIONS, hasPermission } = require('../../config/permissions');
const { UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');
const { calculateLeaveDays, getHolidayDateSet } = require('../donNghiPhep/tinhPhepNam.helper');
const {
  calculateCalendarDays,
  toDateKey,
  isSystemAdminUser,
  formatDateVN,
  formatTimeVN,
  getWeekdayVN,
  getStatusLabel,
  getMethodLabel,
  getLeaveTypeLabel,
  getLeaveStatusLabel,
  getRoleLabel,
  sanitizeExcelRow,
  resolveDepartmentIdsTree,
  getAttendanceWorkDateKey,
} = require('./dinhDangBaoCao.helper');

// Tổng hợp toàn bộ các bảng dữ liệu chi tiết để xuất báo cáo Excel nhiều sheet
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
      ? typeof from === 'string' && from.length === 10
        ? new Date(`${from}T00:00:00.000+07:00`)
        : new Date(from)
      : new Date('2020-01-01T00:00:00.000+07:00');
    endDate = to
      ? typeof to === 'string' && to.length === 10
        ? new Date(`${to}T23:59:59.999+07:00`)
        : new Date(to)
      : new Date();
    periodLabel = `Từ ngày ${formatDateVN(startDate)} đến ngày ${formatDateVN(endDate)}`;
  } else {
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

  const allDepartments = await PhongBan.findAll({
    attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'don_vi_cha_id'],
    raw: true,
  });
  const deptMap = {};
  allDepartments.forEach((d) => {
    deptMap[String(d.id)] = d.ten_phong_ban || '';
  });

  const userWhere = {
    kich_hoat: true,
    trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
    vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
  };
  if (targetUserIds && targetUserIds.length > 0) {
    userWhere.id = { [Op.in]: targetUserIds };
  }
  if (departmentId) {
    const allDeptIds = await resolveDepartmentIdsTree(departmentId);
    userWhere.don_vi_chinh_id = {
      [Op.in]: allDeptIds.length ? allDeptIds : ['00000000-0000-0000-0000-000000000000'],
    };
  }

  const rawUsers = await NguoiDung.findAll({
    where: userWhere,
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'ma_can_bo'],
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] }],
  });
  const users = rawUsers.filter((u) => !isSystemAdminUser(u));
  const effectiveUserIds = users.map((u) => u.id);
  const safeIds = effectiveUserIds.length ? effectiveUserIds : ['00000000-0000-0000-0000-000000000000'];

  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendanceLogs = await NhatKyChamCong.findAll({
    where: { nguoi_dung_id: { [Op.in]: safeIds }, ...dateFilter },
    include: [
      { model: NguoiDung, as: 'nguoi_dung', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'ma_can_bo'] },
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
      { model: LichTrinh, as: 'lich_trinh', attributes: ['id', 'phong_hoc', 'thu_trong_tuan'] },
      { model: DonNghiPhep, as: 'don_tu', attributes: ['id', 'loai_don', 'ly_do', 'trang_thai'] },
      {
        model: LuotQuetChamCong,
        as: 'luot_quet',
        attributes: ['phuong_thuc', 'do_tin_cay_ai', 'vi_do', 'kinh_do', 'thoi_gian_quet'],
        separate: true,
        order: [['thoi_gian_quet', 'ASC']],
        limit: 1,
      },
    ],
    order: [
      ['ngay_cong', 'DESC'],
      ['thoi_gian_vao', 'DESC'],
      ['tao_luc', 'DESC'],
    ],
  });

  const leaveRequests = await DonNghiPhep.findAll({
    where: {
      nguoi_dung_id: { [Op.in]: safeIds },
      ngay_bat_dau: { [Op.lte]: toDateKey(endDate) },
      ngay_ket_thuc: { [Op.gte]: toDateKey(startDate) },
    },
    include: [
      { model: NguoiDung, as: 'nguoi_dung', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'ma_can_bo'] },
      { model: NguoiDung, as: 'nguoi_duyet', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh'] },
    ],
    order: [['tao_luc', 'DESC']],
  });

  const attendanceDetailList = attendanceLogs.map((log, index) => {
    const userObj = log.nguoi_dung || {};
    const shiftObj = log.ca || {};
    const firstPunch = log.luot_quet?.[0] || null;
    const method = firstPunch?.phuong_thuc || 'thu_cong_admin';

    const deptName = userObj.don_vi_chinh_id
      ? deptMap[String(userObj.don_vi_chinh_id)] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    // Luôn ưu tiên ngày công chuẩn (ngay_cong) để tránh sai lệch khi duyệt hồi tố đơn từ sang tháng khác
    const workDateKey = getAttendanceWorkDateKey(log);
    const workDate = workDateKey ? new Date(`${workDateKey}T00:00:00.000+07:00`) : (log.thoi_gian_vao || log.tao_luc);
    const checkIn = log.thoi_gian_vao ? new Date(log.thoi_gian_vao) : null;
    const checkOut = log.thoi_gian_ra ? new Date(log.thoi_gian_ra) : null;
    const shiftStart = shiftObj.gio_bat_dau || '07:30';
    const shiftEnd = shiftObj.gio_ket_thuc || '11:30';

    const lateMins = Number(log.di_muon_phut || 0);
    const earlyMins = Number(log.ve_som_phut || 0);
    let lateEarlyMinutes = '0 phút';
    if (log.trang_thai === 'on_time') {
      lateEarlyMinutes = '0 phút (Đúng giờ)';
    } else if (log.trang_thai === 'late') {
      lateEarlyMinutes = lateMins > 0 ? `Muộn ${lateMins} phút` : 'Đi muộn';
    } else if (log.trang_thai === 'early_leave') {
      lateEarlyMinutes = earlyMins > 0 ? `Về sớm ${earlyMins} phút` : 'Về sớm';
    } else if (log.trang_thai === 'absent') {
      lateEarlyMinutes = 'Vắng mặt';
    } else if (log.trang_thai === 'excused_absence') {
      lateEarlyMinutes = 'Nghỉ có phép';
    } else if (log.trang_thai === 'thieu_check_out') {
      lateEarlyMinutes = 'Thiếu check-out';
    }

    let gpsCoords = 'Không ghi nhận';
    if (firstPunch && firstPunch.vi_do != null && firstPunch.kinh_do != null) {
      gpsCoords = `${Number(firstPunch.vi_do).toFixed(4)}, ${Number(firstPunch.kinh_do).toFixed(4)}`;
    }

    let note = '';
    if (log.nguoi_ghi_de_id) {
      note = 'Quản trị viên điều chỉnh thủ công';
    } else if (method === 'face_ai') {
      note =
        firstPunch?.do_tin_cay_ai != null
          ? `Face ID (Máy chấm công - Độ tin cậy ${(Number(firstPunch.do_tin_cay_ai) * 100).toFixed(0)}%)`
          : 'Face ID (Máy chấm công)';
    } else if (log.don_tu) {
      note = `Đơn nghỉ: ${getLeaveTypeLabel(log.don_tu.loai_don || '')} (${log.don_tu.ly_do || ''})`;
    }

    const staffCode = userObj.ma_can_bo || (userObj.id ? `CB-${String(userObj.id).slice(-4).toUpperCase()}` : '');
    return {
      stt: index + 1,
      ma_can_bo: staffCode,
      ho_ten: userObj.ho_ten || 'Cán bộ',
      ten_phong_ban: deptName,
      ngay: formatDateVN(workDate),
      thu: getWeekdayVN(workDate),
      ten_ca: shiftObj.ten_ca || 'Ca làm việc',
      khung_gio_chuan: `${shiftStart} - ${shiftEnd}`,
      thoi_gian_vao: formatTimeVN(checkIn),
      thoi_gian_ra: formatTimeVN(checkOut),
      trang_thai: getStatusLabel(log.trang_thai),
      ma_trang_thai: log.trang_thai,
      so_phut_lech: lateEarlyMinutes,
      phuong_thuc: getMethodLabel(method),
      toa_do_gps: gpsCoords,
      ghi_chu: note,
    };
  });

  const leaveDetailList = leaveRequests.map((req, index) => {
    const userObj = req.nguoi_dung || {};
    const approverObj = req.nguoi_duyet || {};
    const deptName = userObj.don_vi_chinh_id
      ? deptMap[String(userObj.don_vi_chinh_id)] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    const numDays =
      req.so_ngay !== null && req.so_ngay !== undefined
        ? Number(req.so_ngay)
        : calculateCalendarDays(req.ngay_bat_dau, req.ngay_ket_thuc);
    let approvalInfo = 'Đang chờ xét duyệt';
    if (req.trang_thai === 'approved') {
      const dateStr = req.thoi_gian_duyet ? formatDateVN(req.thoi_gian_duyet) : formatDateVN(req.cap_nhat_luc);
      approvalInfo = `Duyệt ngày ${dateStr}`;
    } else if (req.trang_thai === 'rejected') {
      const dateStr = req.cap_nhat_luc ? formatDateVN(req.cap_nhat_luc) : '';
      approvalInfo = `Từ chối ngày ${dateStr}${req.ly_do_tu_choi ? `: ${req.ly_do_tu_choi}` : ''}`;
    } else if (req.trang_thai === 'cancelled') {
      const dateStr = req.cap_nhat_luc ? formatDateVN(req.cap_nhat_luc) : '';
      approvalInfo = dateStr ? `Đã hủy ngày ${dateStr}` : 'Đã hủy';
    }

    return {
      stt: index + 1,
      ma_don: req.id ? String(req.id).slice(-6).toUpperCase() : '',
      ho_ten: userObj.ho_ten || 'Cán bộ',
      ten_phong_ban: deptName,
      loai_don: getLeaveTypeLabel(req.loai_don),
      ngay_bat_dau: formatDateVN(req.ngay_bat_dau),
      ngay_ket_thuc: formatDateVN(req.ngay_ket_thuc),
      so_ngay: numDays,
      ly_do: req.ly_do || '',
      trang_thai: getLeaveStatusLabel(req.trang_thai),
      ma_trang_thai: req.trang_thai,
      nguoi_duyet: approverObj.ho_ten || '--',
      ghi_chu_duyet: approvalInfo,
    };
  });

  const staffStatsList = users.map((user, index) => {
    const uLogs = attendanceLogs.filter((l) => String(l.nguoi_dung_id) === String(user.id));
    const deptName = user.don_vi_chinh_id
      ? deptMap[String(user.don_vi_chinh_id)] || 'Chưa phân bổ'
      : 'Chưa phân bổ';

    const totalShifts = uLogs.length;
    const onTime = uLogs.filter((l) => l.trang_thai === 'on_time').length;
    const late = uLogs.filter((l) => l.trang_thai === 'late').length;
    const early = uLogs.filter((l) => l.trang_thai === 'early_leave').length;
    const absent = uLogs.filter((l) => l.trang_thai === 'absent').length;
    const excused = uLogs.filter((l) => l.trang_thai === 'excused_absence').length;
    const thieuCheckOut = uLogs.filter((l) => l.trang_thai === 'thieu_check_out').length;
    const rate = totalShifts > 0 ? Math.round(((onTime + excused) / totalShifts) * 100) : 0;

    return {
      stt: index + 1,
      ma_can_bo: user.ma_can_bo || `CB-${String(user.id).slice(-4).toUpperCase()}`,
      ho_ten: user.ho_ten,
      email: user.email,
      ten_phong_ban: deptName,
      vai_tro_chinh: getRoleLabel(user.vai_tro_chinh),
      tong_so_ca: totalShifts,
      so_lan_dung_gio: onTime,
      so_lan_di_muon: late,
      so_lan_ve_som: early,
      so_lan_vang_mat: absent,
      so_lan_co_phep: excused,
      so_lan_thieu_check_out: thieuCheckOut,
      ty_le_chuyen_can: rate,
    };
  });

  const dailyStatsMap = {};
  const startCursorKey = toDateKey(startDate);
  const endCursorKey = toDateKey(endDate);
  const [sy, sm, sd] = startCursorKey.split('-').map(Number);
  const [ey, em, ed] = endCursorKey.split('-').map(Number);
  const currentCursor = new Date(Date.UTC(sy, sm - 1, sd));
  const endCursorUtc = new Date(Date.UTC(ey, em - 1, ed));
  while (currentCursor <= endCursorUtc) {
    const keyIso = currentCursor.toISOString().slice(0, 10);
    const dateKey = `${keyIso.slice(8, 10)}/${keyIso.slice(5, 7)}/${keyIso.slice(0, 4)}`;
    if (!dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey] = {
        ngay: dateKey,
        thu: getWeekdayVN(new Date(`${keyIso}T00:00:00.000+07:00`)),
        tong_so_ca: 0,
        so_lan_dung_gio: 0,
        so_lan_di_muon: 0,
        so_lan_ve_som: 0,
        so_lan_vang_mat: 0,
        so_lan_co_phep: 0,
        so_lan_thieu_check_out: 0,
      };
    }
    currentCursor.setUTCDate(currentCursor.getUTCDate() + 1);
  }

  attendanceLogs.forEach((log) => {
    const workDateKey = getAttendanceWorkDateKey(log);
    const workDate = workDateKey ? new Date(`${workDateKey}T00:00:00.000+07:00`) : (log.thoi_gian_vao || log.tao_luc);
    const dateKey = formatDateVN(workDate);
    if (!dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey] = {
        ngay: dateKey,
        thu: getWeekdayVN(workDate),
        tong_so_ca: 0,
        so_lan_dung_gio: 0,
        so_lan_di_muon: 0,
        so_lan_ve_som: 0,
        so_lan_vang_mat: 0,
        so_lan_co_phep: 0,
        so_lan_thieu_check_out: 0,
      };
    }

    dailyStatsMap[dateKey].tong_so_ca += 1;
    if (log.trang_thai === 'on_time') dailyStatsMap[dateKey].so_lan_dung_gio += 1;
    else if (log.trang_thai === 'late') dailyStatsMap[dateKey].so_lan_di_muon += 1;
    else if (log.trang_thai === 'early_leave') dailyStatsMap[dateKey].so_lan_ve_som += 1;
    else if (log.trang_thai === 'absent') dailyStatsMap[dateKey].so_lan_vang_mat += 1;
    else if (log.trang_thai === 'excused_absence') dailyStatsMap[dateKey].so_lan_co_phep += 1;
    else if (log.trang_thai === 'thieu_check_out') dailyStatsMap[dateKey].so_lan_thieu_check_out += 1;
  });

  const dailyStatsList = Object.values(dailyStatsMap).map((d, index) => {
    const valid = d.so_lan_dung_gio + d.so_lan_co_phep;
    const rate = d.tong_so_ca > 0 ? Math.round((valid / d.tong_so_ca) * 100) : 0;
    return { stt: index + 1, ...d, ty_le_chuyen_can: rate };
  });

  const totalShifts = attendanceLogs.length;
  const onTimeCount = attendanceLogs.filter((l) => l.trang_thai === 'on_time').length;
  const lateCount = attendanceLogs.filter((l) => l.trang_thai === 'late').length;
  const earlyLeaveCount = attendanceLogs.filter((l) => l.trang_thai === 'early_leave').length;
  const absentCount = attendanceLogs.filter((l) => l.trang_thai === 'absent').length;
  const excusedAbsenceCount = attendanceLogs.filter((l) => l.trang_thai === 'excused_absence').length;
  const thieuCheckOutCount = attendanceLogs.filter((l) => l.trang_thai === 'thieu_check_out').length;
  const overallAttendanceRate =
    totalShifts > 0 ? Math.round(((onTimeCount + excusedAbsenceCount) / totalShifts) * 100) : 0;

  const approvedLeaves = leaveRequests.filter((r) => r.trang_thai === 'approved' && r.loai_don === 'nghi_phep');
  const rangeStartKey = toDateKey(startDate);
  const rangeEndKey = toDateKey(endDate);
  const hasBoundaryOverlap = approvedLeaves.some((leave) => {
    const lStartKey = String(leave.ngay_bat_dau).slice(0, 10);
    const lEndKey = String(leave.ngay_ket_thuc).slice(0, 10);
    return (rangeStartKey && lStartKey < rangeStartKey) || (rangeEndKey && lEndKey > rangeEndKey);
  });
  let holidaySet = null;
  if (hasBoundaryOverlap && approvedLeaves.length > 0) {
    const leaveStarts = approvedLeaves.map((l) => String(l.ngay_bat_dau).slice(0, 10)).sort();
    const leaveEnds = approvedLeaves.map((l) => String(l.ngay_ket_thuc).slice(0, 10)).sort();
    holidaySet = await getHolidayDateSet(
      rangeStartKey || leaveStarts[0],
      rangeEndKey || leaveEnds[leaveEnds.length - 1]
    );
  }

  const approvedLeaveDays = approvedLeaves.reduce((sum, item) => {
    const lStartKey = String(item.ngay_bat_dau).slice(0, 10);
    const lEndKey = String(item.ngay_ket_thuc).slice(0, 10);
    if ((!rangeStartKey || lStartKey >= rangeStartKey) && (!rangeEndKey || lEndKey <= rangeEndKey)) {
      return sum + (item.so_ngay !== null && item.so_ngay !== undefined ? Number(item.so_ngay) : 1);
    }
    const effStart = rangeStartKey && lStartKey < rangeStartKey ? rangeStartKey : lStartKey;
    const effEnd = rangeEndKey && lEndKey > rangeEndKey ? rangeEndKey : lEndKey;
    const isHalfDay = Number(item.so_ngay) === 0.5 && lStartKey === lEndKey;
    return sum + calculateLeaveDays(effStart, effEnd, isHalfDay, holidaySet);
  }, 0);

  let departmentLabel = 'Toàn trường';
  if (Array.isArray(departmentId) && departmentId.length > 0) {
    const primaryDeptName = deptMap[String(departmentId[0])];
    if (primaryDeptName) {
      departmentLabel = primaryDeptName;
    } else {
      const resolvedNames = [...new Set(departmentId.map((id) => deptMap[String(id)]).filter(Boolean))];
      if (resolvedNames.length > 0) departmentLabel = resolvedNames.join(', ');
    }
  } else if (departmentId && !Array.isArray(departmentId) && deptMap[String(departmentId)]) {
    departmentLabel = deptMap[String(departmentId)];
  } else if (Array.isArray(targetUserIds) && targetUserIds.length === 1 && users.length === 1) {
    const singleDeptId = users[0].don_vi_chinh_id;
    departmentLabel = (singleDeptId && deptMap[String(singleDeptId)]) || 'Cá nhân';
  }

  return {
    tong_quan: sanitizeExcelRow({
      ky_bao_cao: periodLabel,
      don_vi: departmentLabel,
      tong_so_nhan_su: users.length,
      tong_so_ca: totalShifts,
      so_lan_dung_gio: onTimeCount,
      so_lan_di_muon: lateCount,
      so_lan_ve_som: earlyLeaveCount,
      so_lan_vang_mat: absentCount,
      so_lan_co_phep: excusedAbsenceCount,
      so_lan_thieu_check_out: thieuCheckOutCount,
      ty_le_chuyen_can: overallAttendanceRate,
      so_ngay_nghi_phep_da_duyet: approvedLeaveDays,
      thoi_diem_xuat: `${formatDateVN(new Date())} ${formatTimeVN(new Date())}`,
    }),
    nhat_ky_cham_cong: attendanceDetailList.map(sanitizeExcelRow),
    don_nghi_phep: leaveDetailList.map(sanitizeExcelRow),
    thong_ke_nhan_su: staffStatsList.map(sanitizeExcelRow),
    thong_ke_theo_ngay: dailyStatsList.map(sanitizeExcelRow),
  };
};

// Kiểm tra phạm vi quyền truy cập và trả về dữ liệu xuất Excel cho người dùng yêu cầu
const getExportReportDataForUser = async ({ query = {}, currentUser }) => {
  const userId = query.nguoi_dung_id;
  const departmentId = query.don_vi_id;
  const from = query.tu_ngay;
  const to = query.den_ngay;
  const rawMonth = query.thang;
  const rawYear = query.nam;

  if (userId && !isValidUuid(String(userId))) {
    throw new ServiceError('Mã người dùng (nguoi_dung_id) không đúng định dạng UUID.', 400, 'INVALID_USER_ID');
  }
  if (departmentId && !isValidUuid(String(departmentId))) {
    throw new ServiceError('Mã đơn vị (don_vi_id) không đúng định dạng UUID.', 400, 'INVALID_DEPARTMENT_ID');
  }
  if (from && Number.isNaN(new Date(from).getTime())) {
    throw new ServiceError('Ngày bắt đầu (tu_ngay) không đúng định dạng ngày hợp lệ.', 400);
  }
  if (to && Number.isNaN(new Date(to).getTime())) {
    throw new ServiceError('Ngày kết thúc (den_ngay) không đúng định dạng ngày hợp lệ.', 400);
  }

  let month;
  if (rawMonth !== undefined && rawMonth !== '') {
    const parsedM = parseInt(rawMonth, 10);
    if (Number.isNaN(parsedM) || parsedM < 1 || parsedM > 12) {
      throw new ServiceError('Tháng (thang) không hợp lệ (1-12).', 400);
    }
    month = parsedM;
  }
  let year;
  if (rawYear !== undefined && rawYear !== '') {
    const parsedY = parseInt(rawYear, 10);
    if (Number.isNaN(parsedY) || parsedY < 2000 || parsedY > 2100) {
      throw new ServiceError('Năm (nam) không hợp lệ (2000-2100).', 400);
    }
    year = parsedY;
  }

  let targetUserIds = [];
  let departmentFilter = departmentId || null;
  const canViewAll =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_TOAN_TRUONG) || hasAnyActiveRole(currentUser, ['admin', 'bgh']);
  const canViewDept =
    hasPermission(currentUser, PERMISSIONS.CONG_XEM_DON_VI) || hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);

  if (canViewAll) {
    if (userId) targetUserIds = [userId];
  } else if (canViewDept) {
    const [scopedUserIds, scopedDepartmentIds] = await Promise.all([
      getDeanScopedUserIds(currentUser),
      getDeanDepartmentIds(currentUser),
    ]);
    if (userId) {
      if (!scopedUserIds.map(String).includes(String(userId))) {
        throw new ServiceError('Bạn không có quyền xuất dữ liệu của nhân sự ngoài khoa.', 403);
      }
      targetUserIds = [userId];
    }
    if (departmentId) {
      if (!scopedDepartmentIds.some((id) => String(id) === String(departmentId))) {
        throw new ServiceError('Bạn không có quyền xuất báo cáo của đơn vị ngoài khoa.', 403);
      }
      const subDeptIds = await resolveDepartmentIdsTree(departmentId);
      const allowedSet = new Set(scopedDepartmentIds.map(String));
      departmentFilter = subDeptIds.filter((id) => allowedSet.has(String(id)));
    } else {
      departmentFilter = scopedDepartmentIds;
    }
  } else {
    targetUserIds = [currentUser.id];
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

module.exports = {
  generateExportReportData,
  getExportReportDataForUser,
};
