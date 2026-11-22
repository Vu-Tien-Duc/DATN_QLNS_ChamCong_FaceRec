// Quản lý thời khóa biểu giảng dạy, ngoại lệ lịch và kiểm tra trùng lịch.
const { Op } = require('sequelize');
const {
  LichTrinh,
  NgoaiLeLichTrinh,
  CaLamViec,
  NguoiDung,
  VaiTroNguoiDung,
  MonHoc,
  DonNghiPhep,
  NgayNghiLe,
  NhatKyChamCong,
  NhatKyKiemToan,
} = require('../../models');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const { getVietnamTime, getVietnamDayRange } = require('../../utils/thoiGianChamCong.utils');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { PERMISSIONS, hasPermission } = require('../../config/permissions');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const { isValidCalendarDate } = require('./ngayNghiLe.service');
const ServiceError = require('../../utils/loiNghiepVu');

const INCLUDE_SCHEDULE = [
  { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien'] },
  { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
  { model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon', 'so_tin_chi', 'phong_ban_id'] },
  {
    model: NgoaiLeLichTrinh,
    as: 'ngoai_le',
    include: [
      { model: NguoiDung, as: 'giang_vien_day_thay', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo'] },
      { model: CaLamViec, as: 'ca_thay_the', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
    ],
  },
];

const isGlobalScheduleManager = (user) => hasAnyActiveRole(user, ['admin', 'bgh', 'dao_tao']);
const canManageSchedules = (user) => isGlobalScheduleManager(user) || hasPermission(user, PERMISSIONS.LICH_XEP_LICH);
const isUnitLeaderOnly = (user) => !isGlobalScheduleManager(user) && hasAnyActiveRole(user, UNIT_LEADER_ROLES);

// Định dạng dữ liệu lịch trình: giữ nguyên UUID ở các trường *_id và gắn object ở giang_vien, ca, mon_hoc
const formatScheduleOutput = (sched) => {
  if (!sched) return null;
  const raw = sched.toJSON ? sched.toJSON() : { ...sched };

  return {
    ...raw,
    id: raw.id,
    nguoi_dung_id: (typeof raw.nguoi_dung_id === 'object' ? raw.nguoi_dung_id?.id : raw.nguoi_dung_id) || raw.giang_vien?.id || null,
    ca_id: (typeof raw.ca_id === 'object' ? raw.ca_id?.id : raw.ca_id) || raw.ca?.id || null,
    mon_hoc_id: (typeof raw.mon_hoc_id === 'object' ? raw.mon_hoc_id?.id : raw.mon_hoc_id) || raw.mon_hoc?.id || null,
    ngay_day_bu: raw.loai_lich === 'day_bu' && raw.ngay_bat_dau ? String(raw.ngay_bat_dau).slice(0, 10) : (raw.ngay_day_bu || null),
    ngoai_le: raw.ngoai_le || [],
  };
};

// Quy đổi chuỗi giờ HH:mm thành tổng số phút trong ngày
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Chuẩn hóa tên phòng học để so sánh trùng phòng
const normalizeRoomKey = (room) => {
  if (!room || typeof room !== 'string') return '';
  return room
    .toLowerCase()
    .trim()
    .replace(/^(phòng\s*học|phòng|giảng\s*đường|hội\s*trường|khu|p\.)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Kiểm tra hai tên phòng học có chỉ cùng một phòng vật lý hay không
const isSameRoom = (room1, room2) => {
  if (!room1 || !room2) return false;
  const r1 = room1.trim().toLowerCase();
  const r2 = room2.trim().toLowerCase();
  if (r1 === r2) return true;
  const n1 = normalizeRoomKey(r1);
  const n2 = normalizeRoomKey(r2);
  return Boolean(n1 && n2 && n1 === n2);
};

// Kiểm tra hai lịch trình có giao nhau về khung giờ thực tế (ưu tiên) hoặc tiết học hay không
const checkPeriodOrTimeOverlap = (schedA, schedB) => {
  const hasTimesA = Boolean(schedA.gio_bat_dau && schedA.gio_ket_thuc);
  const hasTimesB = Boolean(schedB.gio_bat_dau && schedB.gio_ket_thuc);
  if (hasTimesA && hasTimesB) {
    const aStartMin = timeStringToMinutes(schedA.gio_bat_dau);
    const aEndMin = timeStringToMinutes(schedA.gio_ket_thuc);
    const bStartMin = timeStringToMinutes(schedB.gio_bat_dau);
    const bEndMin = timeStringToMinutes(schedB.gio_ket_thuc);
    return Math.max(aStartMin, bStartMin) < Math.min(aEndMin, bEndMin);
  }

  const startA = schedA.tiet_bat_dau;
  const countA = schedA.so_tiet;
  const startB = schedB.tiet_bat_dau;
  const countB = schedB.so_tiet;

  if (startA && countA && startB && countB) {
    const endA = startA + countA - 1;
    const endB = startB + countB - 1;
    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  return false;
};

// Kiểm tra hai danh sách tuần học có tuần nào trùng nhau hay không
const hasCommonWeek = (weeksA, weeksB) => {
  if (!Array.isArray(weeksA) || !Array.isArray(weeksB)) return true;
  if (weeksA.length === 0 || weeksB.length === 0) return true;
  const setB = new Set(weeksB.map(Number));
  return weeksA.some((w) => setB.has(Number(w)));
};

const toUtcDayMs = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
};

const msToIsoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// Sinh tập các ngày dương lịch thực tế (YYYY-MM-DD) mà lịch trình diễn ra theo [ngay_bat_dau, ngay_ket_thuc]
const getEffectiveCalendarDates = (sched) => {
  const result = new Set();
  const startMs = toUtcDayMs(sched.ngay_bat_dau);
  const endMs = toUtcDayMs(sched.ngay_ket_thuc || sched.ngay_bat_dau);
  if (startMs === null || endMs === null || startMs > endMs) return result;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const targetWeekday = Number(sched.thu_trong_tuan);
  const exceptions = Array.isArray(sched.ngoai_le) ? sched.ngoai_le : [];

  const isExcludedOnDate = (dateIso) =>
    exceptions.some((ex) => {
      if (!ex.ngay || String(ex.ngay).slice(0, 10) !== dateIso) return false;
      if (['nghi', 'huy'].includes(ex.trang_thai)) return true;
      if (ex.trang_thai === 'day_bu' && ex.ngay_day_bu && String(ex.ngay_day_bu).slice(0, 10) !== dateIso) {
        return true;
      }
      if (ex.trang_thai === 'doi_ca') {
        if (ex.giang_vien_day_thay_id && String(ex.giang_vien_day_thay_id) !== String(sched.nguoi_dung_id)) {
          return true;
        }
        if (ex.ngay_day_bu && String(ex.ngay_day_bu).slice(0, 10) !== dateIso) {
          return true;
        }
      }
      return false;
    });

  const isRecurring = sched.lap_lai_hang_tuan !== false;
  const maxSpanDays = Math.min(400, Math.floor((endMs - startMs) / DAY_MS) + 1);
  for (let offset = 0; offset < maxSpanDays; offset++) {
    const curMs = startMs + offset * DAY_MS;
    const curWeekday = new Date(curMs).getUTCDay();
    if (curWeekday !== targetWeekday) continue;
    const iso = msToIsoDate(curMs);
    if (!isExcludedOnDate(iso)) {
      result.add(iso);
    }
    if (!isRecurring) break;
  }
  return result;
};

const validateHolidayForScheduleDate = async (dateStr) => {
  const holiday = await NgayNghiLe.findOne({
    where: { ngay_bat_dau: { [Op.lte]: dateStr }, ngay_ket_thuc: { [Op.gte]: dateStr } },
  });
  if (holiday) {
    throw new ServiceError(
      `Không thể xếp lịch dạy bù vào ngày nghỉ lễ "${holiday.ten_ngay_le}".`,
      409,
      'SCHEDULE_HOLIDAY_CONFLICT'
    );
  }
};

// Kiểm tra xung đột trùng giảng viên hoặc trùng phòng học vật lý (xét theo ngày lịch thực, ngoại lệ dạy bù & đơn đổi ca)
const detectScheduleConflicts = async ({
  nguoi_dung_id,
  phong_hoc,
  la_truc_tuyen = false,
  thu_trong_tuan,
  tiet_bat_dau,
  so_tiet,
  gio_bat_dau,
  gio_ket_thuc,
  ngay_bat_dau,
  ngay_ket_thuc,
  danh_sach_tuan = [],
  lap_lai_hang_tuan = true,
  loai_lich = 'chinh_khoa',
  excludeScheduleId = null,
  excludeExceptionNgay = null,
}) => {
  const incomingDates = getEffectiveCalendarDates({
    ngay_bat_dau,
    ngay_ket_thuc,
    thu_trong_tuan,
    lap_lai_hang_tuan,
    loai_lich,
  });

  // Fallback nếu khoảng ngày quá dài (> 400 ngày) hoặc chưa đủ thông tin để sinh ngày cụ thể
  const startStr = ngay_bat_dau ? String(ngay_bat_dau).slice(0, 10) : null;
  const endStr = ngay_ket_thuc ? String(ngay_ket_thuc).slice(0, 10) : startStr;

  const where = {
    ...(excludeScheduleId ? { id: { [Op.ne]: excludeScheduleId } } : {}),
  };
  if (startStr && endStr) {
    where.ngay_bat_dau = { [Op.lte]: endStr };
    where.ngay_ket_thuc = { [Op.gte]: startStr };
  } else {
    where.thu_trong_tuan = Number(thu_trong_tuan);
  }

  const [existingSchedules, makeupExceptions, approvedSwaps] = await Promise.all([
    LichTrinh.findAll({
      where,
      include: [
        { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo'] },
        { model: NgoaiLeLichTrinh, as: 'ngoai_le', attributes: ['ngay', 'trang_thai', 'ngay_day_bu', 'giang_vien_day_thay_id'] },
      ],
    }),
    startStr && endStr
      ? NgoaiLeLichTrinh.findAll({
          where: {
            trang_thai: 'day_bu',
            [Op.or]: [
              { ngay_day_bu: { [Op.between]: [startStr, endStr] } },
              { ngay_day_bu: { [Op.is]: null }, ngay: { [Op.between]: [startStr, endStr] } },
            ],
          },
          include: [
            {
              model: LichTrinh,
              as: 'lich_trinh',
              required: true,
              include: [{ model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten'] }],
            },
            { model: NguoiDung, as: 'giang_vien_day_thay', attributes: ['id', 'ho_ten'] },
            { model: CaLamViec, as: 'ca_thay_the', attributes: ['id', 'gio_bat_dau', 'gio_ket_thuc'] },
          ],
        })
      : Promise.resolve([]),
    startStr && endStr
      ? DonNghiPhep.findAll({
          where: {
            loai_don: 'doi_ca',
            trang_thai: 'approved',
            lich_trinh_id: { [Op.ne]: null },
            [Op.or]: [
              { ngay_day_bu: { [Op.between]: [startStr, endStr] } },
              { ngay_day_bu: { [Op.is]: null }, ngay_bat_dau: { [Op.lte]: endStr }, ngay_ket_thuc: { [Op.gte]: startStr } },
            ],
          },
          include: [
            {
              model: LichTrinh,
              as: 'lich_trinh',
              required: true,
              include: [{ model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten'] }],
            },
            { model: NguoiDung, as: 'giang_vien_day_thay', attributes: ['id', 'ho_ten'] },
            { model: CaLamViec, as: 'ca_thay_the', attributes: ['id', 'gio_bat_dau', 'gio_ket_thuc'] },
          ],
        })
      : Promise.resolve([]),
  ]);

  const incomingSched = {
    tiet_bat_dau: Number(tiet_bat_dau),
    so_tiet: Number(so_tiet),
    gio_bat_dau,
    gio_ket_thuc,
  };

  const assertNoConflictWithCandidate = (cand, candId, candLecturerId, candLecturerName, candWeekday) => {
    if (!checkPeriodOrTimeOverlap(incomingSched, cand)) return;

    if (String(candLecturerId) === String(nguoi_dung_id)) {
      throw new ServiceError(
        `Xung đột lịch Giảng viên: ${candLecturerName || 'Giảng viên'} đã có lịch giảng dạy khác vào ${
          cand.gio_bat_dau || `tiết ${cand.tiet_bat_dau}`
        } (Thứ ${candWeekday})!`,
        409,
        'SCHEDULE_LECTURER_CONFLICT',
        { conflictingScheduleId: candId }
      );
    }

    if (!la_truc_tuyen && !cand.la_truc_tuyen && phong_hoc && cand.phong_hoc && isSameRoom(phong_hoc, cand.phong_hoc)) {
      throw new ServiceError(
        `Xung đột Phòng học: ${phong_hoc} đã được bố trí cho lớp học khác vào ${
          cand.gio_bat_dau || `tiết ${cand.tiet_bat_dau}`
        } (Thứ ${candWeekday})!`,
        409,
        'SCHEDULE_ROOM_CONFLICT',
        { conflictingScheduleId: candId, room: phong_hoc }
      );
    }
  };

  for (const exist of existingSchedules) {
    if (!hasCommonWeek(danh_sach_tuan, exist.danh_sach_tuan)) continue;
    if (incomingDates.size > 0) {
      const existDates = getEffectiveCalendarDates(exist);
      const hasSharedDate = Array.from(incomingDates).some((d) => existDates.has(d));
      if (!hasSharedDate) continue;
    } else {
      if (Number(exist.thu_trong_tuan) !== Number(thu_trong_tuan)) continue;
    }

    assertNoConflictWithCandidate(
      exist,
      exist.id,
      exist.nguoi_dung_id,
      exist.giang_vien?.ho_ten,
      thu_trong_tuan
    );
  }

  for (const ex of makeupExceptions || []) {
    if (!ex.lich_trinh) continue;
    if (excludeScheduleId && String(ex.lich_trinh_id) === String(excludeScheduleId)) continue;
    if (
      excludeExceptionNgay &&
      String(ex.lich_trinh_id) === String(excludeExceptionNgay.lich_trinh_id) &&
      String(ex.ngay || '').slice(0, 10) === String(excludeExceptionNgay.ngay).slice(0, 10)
    ) {
      continue;
    }
    const makeupIso = String(ex.ngay_day_bu || ex.ngay).slice(0, 10);
    if (incomingDates.size > 0 && !incomingDates.has(makeupIso)) continue;
    const cand = {
      tiet_bat_dau: ex.lich_trinh.tiet_bat_dau,
      so_tiet: ex.lich_trinh.so_tiet,
      gio_bat_dau: ex.ca_thay_the?.gio_bat_dau || ex.lich_trinh.gio_bat_dau,
      gio_ket_thuc: ex.ca_thay_the?.gio_ket_thuc || ex.lich_trinh.gio_ket_thuc,
      phong_hoc: ex.lich_trinh.phong_hoc,
      la_truc_tuyen: ex.lich_trinh.la_truc_tuyen,
    };
    const lecId = ex.giang_vien_day_thay_id || ex.lich_trinh.nguoi_dung_id;
    const lecName = ex.giang_vien_day_thay?.ho_ten || ex.lich_trinh.giang_vien?.ho_ten;
    assertNoConflictWithCandidate(cand, ex.lich_trinh.id, lecId, lecName, thu_trong_tuan);
  }

  for (const sw of approvedSwaps || []) {
    if (!sw.lich_trinh) continue;
    if (excludeScheduleId && String(sw.lich_trinh_id) === String(excludeScheduleId)) continue;
    const swapIso = sw.ngay_day_bu ? String(sw.ngay_day_bu).slice(0, 10) : String(sw.ngay_bat_dau).slice(0, 10);
    const swapEndIso = sw.ngay_day_bu ? swapIso : String(sw.ngay_ket_thuc || sw.ngay_bat_dau).slice(0, 10);
    const hasOverlapDate =
      incomingDates.size > 0
        ? Array.from(incomingDates).some((d) => d >= swapIso && d <= swapEndIso)
        : true;
    if (!hasOverlapDate) continue;

    const cand = {
      tiet_bat_dau: sw.lich_trinh.tiet_bat_dau,
      so_tiet: sw.lich_trinh.so_tiet,
      gio_bat_dau: sw.ca_thay_the?.gio_bat_dau || sw.lich_trinh.gio_bat_dau,
      gio_ket_thuc: sw.ca_thay_the?.gio_ket_thuc || sw.lich_trinh.gio_ket_thuc,
      phong_hoc: sw.lich_trinh.phong_hoc,
      la_truc_tuyen: sw.lich_trinh.la_truc_tuyen,
    };
    const lecId = sw.giang_vien_day_thay_id || sw.lich_trinh.nguoi_dung_id;
    const lecName = sw.giang_vien_day_thay?.ho_ten || sw.lich_trinh.giang_vien?.ho_ten;
    assertNoConflictWithCandidate(cand, sw.lich_trinh.id, lecId, lecName, thu_trong_tuan);
  }

  return true;
};

// Lấy danh sách thời khóa biểu theo bộ lọc, phân trang và phạm vi phân quyền
const fetchSchedules = async (params = {}) => {
  const {
    ca_id,
    thu_trong_tuan,
    ngay_bat_dau,
    ngay_ket_thuc,
    ngay,
    nam_hoc,
    hoc_ky,
    currentUser,
  } = params;
  const nguoi_dung_id = params.nguoi_dung_id || params.giang_vien_id;

  if (nguoi_dung_id && !isValidUuid(nguoi_dung_id)) {
    throw new ServiceError('Định dạng ID giảng viên không hợp lệ.', 400);
  }
  if (ca_id && !isValidUuid(ca_id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400);
  }

  const where = {};
  const { page: pageNum, limit: limitNum, offset } = normalizePagination(
    params.page ?? params.trang,
    params.limit ?? params.gioi_han,
    500
  );
  const isGlobalViewer = hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);
  const isUnitLeader = !isGlobalViewer && hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);
  const isStaffOnly = !isGlobalViewer && !isUnitLeader;

  if (isStaffOnly) {
    where.nguoi_dung_id = currentUser.id;
  } else if (isUnitLeader) {
    const scopedIds = await getDeanScopedUserIds(currentUser);

    if (nguoi_dung_id) {
      if (!scopedIds.map(String).includes(String(nguoi_dung_id)) && String(nguoi_dung_id) !== String(currentUser.id)) {
        throw new ServiceError('Bạn chỉ có quyền xem lịch của giảng viên thuộc khoa mình.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else if (!scopedIds.length) {
      where.nguoi_dung_id = currentUser.id;
    } else {
      where.nguoi_dung_id = { [Op.in]: [...new Set([...scopedIds, String(currentUser.id)])] };
    }
  } else if (nguoi_dung_id) {
    where.nguoi_dung_id = nguoi_dung_id;
  }

  if (ca_id) where.ca_id = ca_id;
  if (thu_trong_tuan !== undefined && thu_trong_tuan !== '') where.thu_trong_tuan = Number(thu_trong_tuan);
  if (nam_hoc) where.nam_hoc = nam_hoc;
  if (hoc_ky !== undefined && Number(hoc_ky) !== 0) where.hoc_ky = Number(hoc_ky);

  if (ngay_bat_dau && ngay_ket_thuc) {
    where.ngay_bat_dau = { [Op.lte]: ngay_ket_thuc };
    where.ngay_ket_thuc = { [Op.gte]: ngay_bat_dau };
  } else if (ngay) {
    where.ngay_bat_dau = { [Op.lte]: ngay };
    where.ngay_ket_thuc = { [Op.gte]: ngay };
  }

  const { count: total, rows } = await LichTrinh.findAndCountAll({
    where,
    include: INCLUDE_SCHEDULE,
    order: [['thu_trong_tuan', 'ASC'], ['tiet_bat_dau', 'ASC'], ['gio_bat_dau', 'ASC']],
    offset,
    limit: limitNum,
    distinct: true,
  });

  return {
    schedules: rows.map(formatScheduleOutput),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

// Lấy chi tiết một lịch trình theo ID kèm kiểm tra quyền truy cập
const fetchScheduleById = async (scheduleId, currentUser) => {
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }
  const schedule = await LichTrinh.findByPk(scheduleId, { include: INCLUDE_SCHEDULE });
  if (!schedule) {
    throw new ServiceError('Không tìm thấy thông tin lịch giảng dạy/công tác.', 404);
  }

  const isGlobalViewer = hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);
  const isUnitLeader = !isGlobalViewer && hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);
  if (!isGlobalViewer && !isUnitLeader) {
    if (String(schedule.nguoi_dung_id) !== String(currentUser.id)) {
      throw new ServiceError('Bạn không có quyền xem lịch trình của người khác.', 403);
    }
  } else if (isUnitLeader) {
    const inScope = await isUserInDeanScope(currentUser, schedule.nguoi_dung_id);
    if (!inScope && String(schedule.nguoi_dung_id) !== String(currentUser.id)) {
      throw new ServiceError('Bạn không có quyền xem lịch trình của nhân sự ngoài khoa.', 403);
    }
  }

  return formatScheduleOutput(schedule);
};

// Kiểm tra tính hợp lệ của các thông số thời gian lịch trình
const validateScheduleTimeAndDates = ({
  thu_trong_tuan,
  tiet_bat_dau,
  so_tiet,
  gio_bat_dau,
  gio_ket_thuc,
  ngay_bat_dau,
  ngay_ket_thuc,
  ban_kinh_met,
}) => {
  const weekday = Number(thu_trong_tuan);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new ServiceError('Thứ trong tuần phải là số nguyên từ 0 (Chủ Nhật) đến 6 (Thứ Bảy).', 400);
  }
  if (!isValidCalendarDate(String(ngay_bat_dau || '').slice(0, 10)) || !isValidCalendarDate(String(ngay_ket_thuc || '').slice(0, 10))) {
    throw new ServiceError('Ngày bắt đầu và ngày kết thúc phải có định dạng YYYY-MM-DD hợp lệ.', 400);
  }
  if (String(ngay_bat_dau).slice(0, 10) > String(ngay_ket_thuc).slice(0, 10)) {
    throw new ServiceError('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 400);
  }
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(String(gio_bat_dau || '').trim()) || !timeRegex.test(String(gio_ket_thuc || '').trim())) {
    throw new ServiceError('Giờ bắt đầu và giờ kết thúc phải có định dạng HH:mm.', 400);
  }
  if (timeStringToMinutes(String(gio_ket_thuc).trim()) <= timeStringToMinutes(String(gio_bat_dau).trim())) {
    throw new ServiceError('Giờ kết thúc phải sau giờ bắt đầu.', 400);
  }
  if (!Number.isFinite(Number(tiet_bat_dau)) || Number(tiet_bat_dau) < 1) {
    throw new ServiceError('Tiết bắt đầu phải lớn hơn hoặc bằng 1.', 400);
  }
  if (!Number.isFinite(Number(so_tiet)) || Number(so_tiet) < 1) {
    throw new ServiceError('Số tiết giảng dạy phải lớn hơn hoặc bằng 1.', 400);
  }
  if (ban_kinh_met !== undefined && (!Number.isFinite(Number(ban_kinh_met)) || Number(ban_kinh_met) < 1)) {
    throw new ServiceError('Bán kính điểm danh (ban_kinh_met) phải lớn hơn hoặc bằng 1 mét.', 400);
  }
};

// Tạo mới lịch trình giảng dạy kèm danh sách tuần học và kiểm tra chống trùng lịch (có khóa phân tán)
const createNewSchedule = async (data, currentUser) => {
  if (!canManageSchedules(currentUser)) {
    throw new ServiceError('Tài khoản Giảng viên / Nhân viên không có quyền phân công lịch trình.', 403);
  }

  const {
    nguoi_dung_id,
    ca_id,
    gio_bat_dau,
    gio_ket_thuc,
    tiet_bat_dau,
    so_tiet,
    phong_hoc,
    co_so,
    la_truc_tuyen = false,
    mon_hoc_id,
    vi_do,
    kinh_do,
    ban_kinh_met = 100,
    thu_trong_tuan,
    lap_lai_hang_tuan = true,
    ngay_bat_dau,
    ngay_ket_thuc,
    loai_lich = 'chinh_khoa',
    ngay_day_bu,
    danh_sach_tuan = [],
    nam_hoc = '2025-2026',
    hoc_ky = 1,
  } = data;

  if (!nguoi_dung_id || !ca_id || thu_trong_tuan === undefined || !ngay_bat_dau || !ngay_ket_thuc) {
    throw new ServiceError('Vui lòng điền đầy đủ Giảng viên, Ca làm việc, Thứ trong tuần, Ngày bắt đầu và Ngày kết thúc.', 400);
  }

  if (!isValidUuid(nguoi_dung_id)) {
    throw new ServiceError('Mã giảng viên / nhân sự không hợp lệ.', 400);
  }
  if (!isValidUuid(ca_id)) {
    throw new ServiceError('Mã ca làm việc không hợp lệ.', 400);
  }
  if (mon_hoc_id && !isValidUuid(mon_hoc_id)) {
    throw new ServiceError('Mã môn học không hợp lệ.', 400);
  }

  const [lecturerDoc, shiftDoc, subjectDoc] = await Promise.all([
    NguoiDung.findByPk(nguoi_dung_id, {
      attributes: ['id', 'vai_tro_chinh', 'kich_hoat', 'trang_thai_lam_viec'],
      include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro', 'tu_ngay', 'den_ngay'] }],
    }),
    CaLamViec.findByPk(ca_id),
    mon_hoc_id ? MonHoc.findByPk(mon_hoc_id, { attributes: ['id'] }) : Promise.resolve(null),
  ]);

  if (!lecturerDoc) {
    throw new ServiceError('Không tìm thấy giảng viên / nhân sự được chọn.', 404);
  }
  if (hasAnyActiveRole(lecturerDoc, [ROLES.ADMIN])) {
    throw new ServiceError(
      'Tài khoản Quản trị viên hệ thống (Admin) không tham gia chấm công hoặc giảng dạy.',
      403,
      'SCHEDULE_ADMIN_EXEMPT'
    );
  }
  if (!shiftDoc) {
    throw new ServiceError('Không tìm thấy ca làm việc được chọn.', 404);
  }
  if (shiftDoc.kich_hoat === false) {
    throw new ServiceError('Ca làm việc này đã bị ngừng kích hoạt, vui lòng chọn ca khác.', 400);
  }
  if (mon_hoc_id && !subjectDoc) {
    throw new ServiceError('Không tìm thấy môn học được chọn.', 404);
  }

  if (isUnitLeaderOnly(currentUser)) {
    const inScope = await isUserInDeanScope(currentUser, nguoi_dung_id);
    if (!inScope) {
      throw new ServiceError('Bạn chỉ có quyền phân công lịch trình cho nhân sự trong phạm vi đơn vị quản lý.', 403);
    }
  }

  let effectiveStartDate = String(ngay_bat_dau).slice(0, 10);
  let effectiveEndDate = String(ngay_ket_thuc).slice(0, 10);
  let effectiveWeekday = Number(thu_trong_tuan);
  let effectiveRecurring = Boolean(lap_lai_hang_tuan);
  let effectiveWeeks = Array.isArray(danh_sach_tuan) ? danh_sach_tuan : [];

  if (loai_lich === 'day_bu') {
    const makeupStr = String(ngay_day_bu || ngay_bat_dau).slice(0, 10);
    if (!isValidCalendarDate(makeupStr)) {
      throw new ServiceError('Ngày dạy bù không hợp lệ (yêu cầu YYYY-MM-DD).', 400);
    }
    await validateHolidayForScheduleDate(makeupStr);
    effectiveStartDate = makeupStr;
    effectiveEndDate = makeupStr;
    effectiveWeekday = getVietnamTime(`${makeupStr}T08:00:00+07:00`).getDay();
    effectiveRecurring = false;
    effectiveWeeks = [1];
  }

  const resolvedStartPeriod = Number(tiet_bat_dau) || 1;
  const resolvedPeriodCount = Number(so_tiet) || 3;
  const resolvedStartTime = String(gio_bat_dau || shiftDoc.gio_bat_dau || '07:00').slice(0, 5);
  const resolvedEndTime = String(gio_ket_thuc || shiftDoc.gio_ket_thuc || '11:30').slice(0, 5);

  validateScheduleTimeAndDates({
    thu_trong_tuan: effectiveWeekday,
    tiet_bat_dau: resolvedStartPeriod,
    so_tiet: resolvedPeriodCount,
    gio_bat_dau: resolvedStartTime,
    gio_ket_thuc: resolvedEndTime,
    ngay_bat_dau: effectiveStartDate,
    ngay_ket_thuc: effectiveEndDate,
    ban_kinh_met,
  });

  let createdId = null;
  await withDistributedLock(`schedule_write_lock`, 15, async () => {
    await detectScheduleConflicts({
      nguoi_dung_id,
      phong_hoc,
      la_truc_tuyen: Boolean(la_truc_tuyen),
      thu_trong_tuan: effectiveWeekday,
      tiet_bat_dau: resolvedStartPeriod,
      so_tiet: resolvedPeriodCount,
      gio_bat_dau: resolvedStartTime,
      gio_ket_thuc: resolvedEndTime,
      ngay_bat_dau: effectiveStartDate,
      ngay_ket_thuc: effectiveEndDate,
      danh_sach_tuan: effectiveWeeks,
      lap_lai_hang_tuan: effectiveRecurring,
      loai_lich,
      nam_hoc,
      hoc_ky,
    });

    await runInTransaction(async (transaction) => {
      const newSchedule = await LichTrinh.create(
        {
          nguoi_dung_id,
          ca_id: ca_id || null,
          gio_bat_dau: resolvedStartTime,
          gio_ket_thuc: resolvedEndTime,
          tiet_bat_dau: resolvedStartPeriod,
          so_tiet: resolvedPeriodCount,
          phong_hoc: phong_hoc || '',
          co_so: co_so || '',
          la_truc_tuyen: Boolean(la_truc_tuyen),
          mon_hoc_id: mon_hoc_id || null,
          vi_do: vi_do ?? null,
          kinh_do: kinh_do ?? null,
          ban_kinh_met,
          thu_trong_tuan: effectiveWeekday,
          lap_lai_hang_tuan: effectiveRecurring,
          ngay_bat_dau: effectiveStartDate,
          ngay_ket_thuc: effectiveEndDate,
          loai_lich,
          nam_hoc,
          hoc_ky: Number(hoc_ky) || 1,
        },
        { transaction }
      );
      createdId = newSchedule.id;
    });
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'CREATE_SCHEDULE',
    doi_tuong_id: String(createdId),
    loai_doi_tuong: 'lich_trinh',
    chi_tiet: { phong_hoc, thu_trong_tuan: effectiveWeekday, tiet_bat_dau: resolvedStartPeriod, loai_lich },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchScheduleById(createdId, currentUser);
};

// Cập nhật lịch trình và kiểm tra lại xung đột lịch (có kiểm tra IDOR & khóa phân tán)
const updateExistingSchedule = async (scheduleId, data, currentUser) => {
  if (!canManageSchedules(currentUser)) {
    throw new ServiceError('Tài khoản Giảng viên / Nhân viên không có quyền chỉnh sửa phân công lịch trình.', 403);
  }
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }

  const schedule = await LichTrinh.findByPk(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch cần cập nhật.', 404);
  }

  const nextUserId = data.nguoi_dung_id || data.giang_vien_id || schedule.nguoi_dung_id;
  if (!isValidUuid(nextUserId)) {
    throw new ServiceError('Mã giảng viên / nhân sự mới không hợp lệ.', 400);
  }

  if (isUnitLeaderOnly(currentUser)) {
    const [oldInScope, newInScope] = await Promise.all([
      isUserInDeanScope(currentUser, schedule.nguoi_dung_id),
      isUserInDeanScope(currentUser, nextUserId),
    ]);
    if (!oldInScope || !newInScope) {
      throw new ServiceError('Bạn không có quyền sửa hoặc chuyển lịch trình cho nhân sự ngoài khoa.', 403);
    }
  }

  if (data.nguoi_dung_id || data.giang_vien_id) {
    const lecDoc = await NguoiDung.findByPk(nextUserId, {
      attributes: ['id', 'vai_tro_chinh'],
      include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro', 'tu_ngay', 'den_ngay'] }],
    });
    if (!lecDoc) {
      throw new ServiceError('Không tìm thấy giảng viên / nhân sự được chọn.', 404);
    }
    if (hasAnyActiveRole(lecDoc, [ROLES.ADMIN])) {
      throw new ServiceError(
        'Tài khoản Quản trị viên hệ thống (Admin) không tham gia chấm công hoặc giảng dạy.',
        403,
        'SCHEDULE_ADMIN_EXEMPT'
      );
    }
  }

  let nextShiftDoc = null;
  if (data.ca_id !== undefined && data.ca_id !== null) {
    if (!isValidUuid(data.ca_id)) {
      throw new ServiceError('Mã ca làm việc không hợp lệ.', 400);
    }
    nextShiftDoc = await CaLamViec.findByPk(data.ca_id);
    if (!nextShiftDoc) {
      throw new ServiceError('Không tìm thấy ca làm việc được chọn.', 404);
    }
    if (String(data.ca_id) !== String(schedule.ca_id) && nextShiftDoc.kich_hoat === false) {
      throw new ServiceError('Ca làm việc này đã bị ngừng kích hoạt.', 400);
    }
  }

  if (data.mon_hoc_id !== undefined && data.mon_hoc_id !== null && data.mon_hoc_id !== '') {
    if (!isValidUuid(data.mon_hoc_id)) {
      throw new ServiceError('Mã môn học không hợp lệ.', 400);
    }
    const subDoc = await MonHoc.findByPk(data.mon_hoc_id, { attributes: ['id'] });
    if (!subDoc) {
      throw new ServiceError('Không tìm thấy môn học được chọn.', 404);
    }
  }

  const nextRoom = data.phong_hoc !== undefined ? data.phong_hoc : schedule.phong_hoc;
  const nextOnline = data.la_truc_tuyen !== undefined ? Boolean(data.la_truc_tuyen) : Boolean(schedule.la_truc_tuyen);
  const nextLoaiLich = data.loai_lich || schedule.loai_lich;
  let nextWeekday = data.thu_trong_tuan !== undefined ? Number(data.thu_trong_tuan) : schedule.thu_trong_tuan;
  const nextStartPeriod = data.tiet_bat_dau !== undefined ? Number(data.tiet_bat_dau) : schedule.tiet_bat_dau;
  const nextPeriodCount = data.so_tiet !== undefined ? Number(data.so_tiet) : schedule.so_tiet;
  const shiftChanged = data.ca_id && String(data.ca_id) !== String(schedule.ca_id);
  const nextStartTime = String(
    data.gio_bat_dau || (shiftChanged && nextShiftDoc ? nextShiftDoc.gio_bat_dau : schedule.gio_bat_dau)
  ).slice(0, 5);
  const nextEndTime = String(
    data.gio_ket_thuc || (shiftChanged && nextShiftDoc ? nextShiftDoc.gio_ket_thuc : schedule.gio_ket_thuc)
  ).slice(0, 5);
  const nextAcademicYear = data.nam_hoc || schedule.nam_hoc;
  const nextSemester = data.hoc_ky !== undefined ? data.hoc_ky : schedule.hoc_ky;
  let nextStartDate = String(data.ngay_bat_dau || schedule.ngay_bat_dau).slice(0, 10);
  let nextEndDate = String(data.ngay_ket_thuc || schedule.ngay_ket_thuc).slice(0, 10);

  if (nextLoaiLich === 'day_bu') {
    const makeupStr = String(data.ngay_day_bu || nextStartDate).slice(0, 10);
    if (!isValidCalendarDate(makeupStr)) {
      throw new ServiceError('Ngày dạy bù không hợp lệ (yêu cầu YYYY-MM-DD).', 400);
    }
    await validateHolidayForScheduleDate(makeupStr);
    nextStartDate = makeupStr;
    nextEndDate = makeupStr;
    nextWeekday = getVietnamTime(`${makeupStr}T08:00:00+07:00`).getDay();
    data = { ...data, lap_lai_hang_tuan: false };
  }

  validateScheduleTimeAndDates({
    thu_trong_tuan: nextWeekday,
    tiet_bat_dau: nextStartPeriod,
    so_tiet: nextPeriodCount,
    gio_bat_dau: nextStartTime,
    gio_ket_thuc: nextEndTime,
    ngay_bat_dau: nextStartDate,
    ngay_ket_thuc: nextEndDate,
    ban_kinh_met: data.ban_kinh_met !== undefined ? data.ban_kinh_met : schedule.ban_kinh_met,
  });

  await withDistributedLock('schedule_write_lock', 15, async () => {
    await detectScheduleConflicts({
      nguoi_dung_id: nextUserId,
      phong_hoc: nextRoom,
      la_truc_tuyen: nextOnline,
      thu_trong_tuan: nextWeekday,
      tiet_bat_dau: nextStartPeriod,
      so_tiet: nextPeriodCount,
      gio_bat_dau: nextStartTime,
      gio_ket_thuc: nextEndTime,
      ngay_bat_dau: nextStartDate,
      ngay_ket_thuc: nextEndDate,
      danh_sach_tuan: data.danh_sach_tuan !== undefined ? data.danh_sach_tuan : schedule.danh_sach_tuan,
      lap_lai_hang_tuan: data.lap_lai_hang_tuan !== undefined ? Boolean(data.lap_lai_hang_tuan) : schedule.lap_lai_hang_tuan,
      loai_lich: nextLoaiLich,
      nam_hoc: nextAcademicYear,
      hoc_ky: nextSemester,
      excludeScheduleId: schedule.id,
    });

    await runInTransaction(async (transaction) => {
      const updatable = [
        'ca_id', 'mon_hoc_id', 'phong_hoc', 'co_so', 'la_truc_tuyen', 'vi_do', 'kinh_do',
        'ban_kinh_met', 'lap_lai_hang_tuan', 'loai_lich', 'nam_hoc', 'hoc_ky',
      ];
      for (const field of updatable) {
        if (data[field] !== undefined) {
          schedule[field] = field === 'la_truc_tuyen' ? Boolean(data[field]) : data[field];
        }
      }
      schedule.nguoi_dung_id = nextUserId;
      schedule.thu_trong_tuan = nextWeekday;
      schedule.gio_bat_dau = nextStartTime;
      schedule.gio_ket_thuc = nextEndTime;
      schedule.ngay_bat_dau = nextStartDate;
      schedule.ngay_ket_thuc = nextEndDate;
      schedule.tiet_bat_dau = nextStartPeriod;
      schedule.so_tiet = nextPeriodCount;
      await schedule.save({ transaction });
    });
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'UPDATE_SCHEDULE',
    doi_tuong_id: String(schedule.id),
    loai_doi_tuong: 'lich_trinh',
    chi_tiet: { updatedFields: Object.keys(data) },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchScheduleById(schedule.id, currentUser);
};

// Xóa lịch trình nếu chưa phát sinh dữ liệu chấm công (kể cả khối ca liên tục) hay đơn nghỉ liên quan
const removeSchedule = async (scheduleId, currentUser) => {
  if (!canManageSchedules(currentUser)) {
    throw new ServiceError('Tài khoản Giảng viên / Nhân viên không có quyền xóa phân công lịch trình.', 403);
  }
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }

  const schedule = await LichTrinh.findByPk(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch để xóa.', 404);
  }
  if (isUnitLeaderOnly(currentUser)) {
    if (!(await isUserInDeanScope(currentUser, schedule.nguoi_dung_id))) {
      throw new ServiceError('Bạn không có quyền xóa lịch trình của nhân sự ngoài khoa.', 403);
    }
  }

  const [linkedAttendance, linkedLeaves] = await Promise.all([
    NhatKyChamCong.count({
      where: {
        [Op.or]: [
          { lich_trinh_id: schedule.id },
          { ds_lich_trinh_id: { [Op.like]: `%${schedule.id}%` } },
        ],
      },
    }),
    DonNghiPhep.count({ where: { lich_trinh_id: schedule.id } }),
  ]);
  if (linkedAttendance > 0 || linkedLeaves > 0) {
    throw new ServiceError(
      'Không thể xóa lịch trình vì đã có dữ liệu chấm công, khối ca liên tục hoặc đơn nghỉ phép tham chiếu đến lịch này.',
      409,
      'SCHEDULE_IN_USE'
    );
  }

  await schedule.destroy();

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'DELETE_SCHEDULE',
    doi_tuong_id: String(scheduleId),
    loai_doi_tuong: 'lich_trinh',
    chi_tiet: { phong_hoc: schedule.phong_hoc, thu_trong_tuan: schedule.thu_trong_tuan },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đã xóa lịch giảng dạy/công tác thành công.' };
};

// Ghi nhận ngoại lệ cho một buổi học (nghỉ, hủy hoặc dạy bù)
const addScheduleException = async ({ scheduleId, ngay, ly_do, trang_thai = 'nghi', ngay_day_bu, currentUser }) => {
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }
  const cleanDate = String(ngay || '').slice(0, 10);
  if (!isValidCalendarDate(cleanDate)) {
    throw new ServiceError('Ngày áp dụng ngoại lệ không hợp lệ (yêu cầu YYYY-MM-DD).', 400);
  }
  const ALLOWED_EXCEPTION_STATUSES = ['nghi', 'huy', 'day_bu', 'doi_ca'];
  if (!ALLOWED_EXCEPTION_STATUSES.includes(trang_thai)) {
    throw new ServiceError('Trạng thái ngoại lệ không hợp lệ (chỉ hỗ trợ: nghi, huy, day_bu, doi_ca).', 400);
  }

  const schedule = await LichTrinh.findByPk(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch giảng dạy.', 404);
  }

  const isManager = canManageSchedules(currentUser);
  const isOwner = String(schedule.nguoi_dung_id) === String(currentUser.id);
  if (!isManager && !isOwner) {
    if (isUnitLeaderOnly(currentUser)) {
      const inScope = await isUserInDeanScope(currentUser, schedule.nguoi_dung_id);
      if (!inScope) {
        throw new ServiceError('Bạn chỉ có quyền cập nhật ngoại lệ lịch cho nhân sự trong phạm vi đơn vị quản lý.', 403);
      }
    } else {
      throw new ServiceError('Bạn chỉ có quyền báo nghỉ/bù cho lịch của chính mình.', 403);
    }
  } else if (isUnitLeaderOnly(currentUser) && !isOwner) {
    const inScope = await isUserInDeanScope(currentUser, schedule.nguoi_dung_id);
    if (!inScope) {
      throw new ServiceError('Bạn chỉ có quyền cập nhật ngoại lệ lịch cho nhân sự trong phạm vi đơn vị quản lý.', 403);
    }
  }

  let cleanMakeupDate = null;
  if (trang_thai === 'day_bu') {
    cleanMakeupDate = ngay_day_bu ? String(ngay_day_bu).slice(0, 10) : '';
    if (!isValidCalendarDate(cleanMakeupDate)) {
      throw new ServiceError('Vui lòng cung cấp ngày dạy bù hợp lệ (YYYY-MM-DD) khi xếp lịch dạy bù.', 400);
    }
    if (cleanMakeupDate === cleanDate) {
      throw new ServiceError('Ngày dạy bù không được trùng với ngày nghỉ gốc.', 400);
    }
    await validateHolidayForScheduleDate(cleanMakeupDate);
  }

  await withDistributedLock('schedule_write_lock', 15, async () => {
    if (trang_thai === 'day_bu') {
      const makeupVn = getVietnamTime(`${cleanMakeupDate}T08:00:00+07:00`);
      const makeupWeekday = makeupVn.getDay();

      await detectScheduleConflicts({
        nguoi_dung_id: schedule.nguoi_dung_id,
        phong_hoc: schedule.phong_hoc,
        la_truc_tuyen: Boolean(schedule.la_truc_tuyen),
        thu_trong_tuan: makeupWeekday,
        tiet_bat_dau: schedule.tiet_bat_dau,
        so_tiet: schedule.so_tiet,
        gio_bat_dau: schedule.gio_bat_dau,
        gio_ket_thuc: schedule.gio_ket_thuc,
        ngay_bat_dau: cleanMakeupDate,
        ngay_ket_thuc: cleanMakeupDate,
        danh_sach_tuan: [],
        loai_lich: 'day_bu',
        excludeScheduleId: null,
        excludeExceptionNgay: { lich_trinh_id: schedule.id, ngay: cleanDate },
      });
    }

    const existing = await NgoaiLeLichTrinh.findOne({
      where: { lich_trinh_id: schedule.id, ngay: cleanDate },
    });

    if (existing && existing.trang_thai === 'doi_ca' && String(existing.ly_do || '').includes('#')) {
      throw new ServiceError(
        'Buổi học này đã gắn với đơn đổi ca/dạy thay được phê duyệt. Vui lòng hủy đơn tương ứng trước khi chỉnh sửa ngoại lệ.',
        409,
        'SCHEDULE_EXCEPTION_LOCKED'
      );
    }

    if (existing) {
      existing.ly_do = ly_do || existing.ly_do;
      existing.trang_thai = trang_thai;
      existing.ngay_day_bu = cleanMakeupDate;
      await existing.save();
    } else {
      await NgoaiLeLichTrinh.create({
        lich_trinh_id: schedule.id,
        ngay: cleanDate,
        ly_do: ly_do || 'Giảng viên có lý do công tác',
        trang_thai,
        ngay_day_bu: cleanMakeupDate,
      });
    }
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'ADD_SCHEDULE_EXCEPTION',
    doi_tuong_id: String(schedule.id),
    loai_doi_tuong: 'ngoai_le_lich_trinh',
    chi_tiet: { ngay: cleanDate, trang_thai, ngay_day_bu: cleanMakeupDate, ly_do: ly_do || null },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchScheduleById(schedule.id, currentUser);
};

// Lấy lịch giảng dạy có hiệu lực trong ngày (loại trừ ngày nghỉ lễ, gộp lịch dạy bù và đổi ca/dạy thay)
const fetchTodaySchedules = async ({ nguoi_dung_id, ngay, currentUser }) => {
  if (nguoi_dung_id && !isValidUuid(nguoi_dung_id)) {
    throw new ServiceError('Định dạng ID giảng viên không hợp lệ.', 400);
  }
  if (ngay && !isValidCalendarDate(String(ngay).slice(0, 10))) {
    throw new ServiceError('Tham số ngày không hợp lệ (yêu cầu YYYY-MM-DD).', 400);
  }

  const rawDate = ngay ? new Date(`${String(ngay).slice(0, 10)}T08:00:00+07:00`) : new Date();
  const vnTime = getVietnamTime(rawDate);
  const { dateStr } = getVietnamDayRange(rawDate);

  // Loại trừ ngày nghỉ lễ toàn trường
  const holidayToday = await NgayNghiLe.findOne({
    where: {
      ngay_bat_dau: { [Op.lte]: dateStr },
      ngay_ket_thuc: { [Op.gte]: dateStr },
    },
  });
  if (holidayToday) {
    return [];
  }

  const currentWeekday = vnTime.getDay();
  const isGlobalViewer = hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);
  const isUnitLeader = !isGlobalViewer && hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES);

  const where = {
    thu_trong_tuan: currentWeekday,
    ngay_bat_dau: { [Op.lte]: dateStr },
    ngay_ket_thuc: { [Op.gte]: dateStr },
  };

  if (isGlobalViewer) {
    if (nguoi_dung_id) {
      where.nguoi_dung_id = nguoi_dung_id;
    }
  } else if (isUnitLeader) {
    const scopedIds = await getDeanScopedUserIds(currentUser);
    if (nguoi_dung_id) {
      if (!scopedIds.includes(String(nguoi_dung_id)) && String(nguoi_dung_id) !== String(currentUser.id)) {
        throw new ServiceError('Bạn không có quyền xem lịch giảng dạy của nhân sự ngoài đơn vị.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else {
      where.nguoi_dung_id = { [Op.in]: [...new Set([...scopedIds, String(currentUser.id)])] };
    }
  } else {
    if (nguoi_dung_id && String(nguoi_dung_id) !== String(currentUser.id)) {
      throw new ServiceError('Bạn chỉ có quyền xem lịch giảng dạy hôm nay của chính mình.', 403);
    }
    where.nguoi_dung_id = currentUser.id;
  }

  const makeupScheduleWhere = where.nguoi_dung_id ? { nguoi_dung_id: where.nguoi_dung_id } : undefined;
  const swapUserFilter = nguoi_dung_id || (!isGlobalViewer ? where.nguoi_dung_id : null);
  const swapWhere = {
    loai_don: 'doi_ca',
    trang_thai: 'approved',
    lich_trinh_id: { [Op.ne]: null },
    [Op.and]: [
      {
        [Op.or]: [
          { ngay_day_bu: dateStr },
          { ngay_day_bu: { [Op.is]: null }, ngay_bat_dau: { [Op.lte]: dateStr }, ngay_ket_thuc: { [Op.gte]: dateStr } },
        ],
      },
      ...(swapUserFilter
        ? [
            {
              [Op.or]: [
                { giang_vien_day_thay_id: swapUserFilter },
                { giang_vien_day_thay_id: null, nguoi_dung_id: swapUserFilter },
              ],
            },
          ]
        : []),
    ],
  };

  const [schedules, makeupExceptions, swapExceptions] = await Promise.all([
    LichTrinh.findAll({
      where,
      include: INCLUDE_SCHEDULE,
      order: [['tiet_bat_dau', 'ASC'], ['gio_bat_dau', 'ASC']],
    }),
    NgoaiLeLichTrinh.findAll({
      where: {
        trang_thai: 'day_bu',
        [Op.or]: [
          { ngay_day_bu: dateStr },
          { ngay_day_bu: { [Op.is]: null }, ngay: dateStr },
        ],
      },
      include: [
        {
          model: LichTrinh,
          as: 'lich_trinh',
          ...(makeupScheduleWhere ? { where: makeupScheduleWhere } : {}),
          required: true,
          include: INCLUDE_SCHEDULE,
        },
      ],
    }),
    DonNghiPhep.findAll({
      where: swapWhere,
      include: [
        {
          model: LichTrinh,
          as: 'lich_trinh',
          required: true,
          include: INCLUDE_SCHEDULE,
        },
        { model: CaLamViec, as: 'ca_thay_the', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
        { model: NguoiDung, as: 'giang_vien_day_thay', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien'] },
      ],
    }),
  ]);

  const mergedById = new Map();
  for (const s of schedules) mergedById.set(String(s.id), s);
  for (const ex of makeupExceptions) {
    if (ex.lich_trinh && !mergedById.has(String(ex.lich_trinh.id))) {
      mergedById.set(String(ex.lich_trinh.id), ex.lich_trinh);
    }
  }
  for (const ex of swapExceptions) {
    if (!ex.lich_trinh) continue;
    const plain = ex.lich_trinh.toJSON ? ex.lich_trinh.toJSON() : { ...ex.lich_trinh };
    plain._isSubstituteOverride = true;
    plain.ngoai_le = Array.isArray(plain.ngoai_le) ? [...plain.ngoai_le] : [];
    const targetSwapDate = ex.ngay_day_bu ? String(ex.ngay_day_bu).slice(0, 10) : dateStr;
    if (!plain.ngoai_le.some((n) => n.trang_thai === 'doi_ca' && String(n.ngay_day_bu || n.ngay).slice(0, 10) === targetSwapDate)) {
      plain.ngoai_le.push({
        ngay: ex.ngay_bat_dau ? String(ex.ngay_bat_dau).slice(0, 10) : dateStr,
        trang_thai: 'doi_ca',
        ngay_day_bu: targetSwapDate,
        giang_vien_day_thay_id: ex.giang_vien_day_thay_id || null,
      });
    }
    if (ex.giang_vien_day_thay_id) plain.nguoi_dung_id = ex.giang_vien_day_thay_id;
    if (ex.giang_vien_day_thay) {
      plain.giang_vien = ex.giang_vien_day_thay.toJSON ? ex.giang_vien_day_thay.toJSON() : ex.giang_vien_day_thay;
    }
    if (ex.ca_thay_the) {
      const shiftPlain = ex.ca_thay_the.toJSON ? ex.ca_thay_the.toJSON() : ex.ca_thay_the;
      plain.ca_id = shiftPlain.id;
      plain.ca = shiftPlain;
      plain.gio_bat_dau = shiftPlain.gio_bat_dau;
      plain.gio_ket_thuc = shiftPlain.gio_ket_thuc;
    }
    mergedById.set(`swap-${ex.lich_trinh.id}-${ex.id}`, plain);
  }

  return Array.from(mergedById.values())
    .filter((s) => isScheduleActiveOnDate(s, rawDate))
    .map(formatScheduleOutput);
};

module.exports = {
  ServiceError,
  timeStringToMinutes,
  normalizeRoomKey,
  isSameRoom,
  checkPeriodOrTimeOverlap,
  hasCommonWeek,
  detectScheduleConflicts,
  fetchSchedules,
  fetchScheduleById,
  createNewSchedule,
  updateExistingSchedule,
  removeSchedule,
  addScheduleException,
  fetchTodaySchedules,
};
