// Quản lý thời khóa biểu giảng dạy, lịch tuần, ngoại lệ lịch và kiểm tra trùng lịch.
const { Op } = require('sequelize');
const {
  LichTrinh,
  LichTrinhTuan,
  NgoaiLeLichTrinh,
  CaLamViec,
  NguoiDung,
  MonHoc,
  DonNghiPhep,
  NhatKyKiemToan,
} = require('../../models');
const { getDeanDepartmentIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { normalizeRole, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');

const INCLUDE_SCHEDULE = [
  { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien'] },
  { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
  { model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon', 'so_tin_chi', 'phong_ban_id'] },
  { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
  { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
];

// Định dạng dữ liệu lịch trình kèm mảng số tuần học và ngoại lệ
const formatScheduleOutput = (sched) => {
  if (!sched) return null;
  const raw = sched.toJSON ? sched.toJSON() : { ...sched };
  const weeks = Array.isArray(raw.tuan_hoc)
    ? raw.tuan_hoc.map((w) => Number(w.tuan_thu)).sort((a, b) => a - b)
    : [];

  return {
    ...raw,
    id: raw.id,
    danh_sach_tuan: weeks,
    ngoai_le: raw.ngoai_le || [],
    nguoi_dung_id: raw.giang_vien || raw.nguoi_dung_id,
    ca_id: raw.ca || raw.ca_id,
    mon_hoc_id: raw.mon_hoc || raw.mon_hoc_id,
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

// Kiểm tra hai lịch trình có giao nhau về tiết học hoặc khung giờ hay không
const checkPeriodOrTimeOverlap = (schedA, schedB) => {
  const startA = schedA.tiet_bat_dau;
  const countA = schedA.so_tiet;
  const startB = schedB.tiet_bat_dau;
  const countB = schedB.so_tiet;

  if (startA && countA && startB && countB) {
    const endA = startA + countA - 1;
    const endB = startB + countB - 1;
    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  const aStartMin = timeStringToMinutes(schedA.gio_bat_dau);
  const aEndMin = timeStringToMinutes(schedA.gio_ket_thuc);
  const bStartMin = timeStringToMinutes(schedB.gio_bat_dau);
  const bEndMin = timeStringToMinutes(schedB.gio_ket_thuc);

  return Math.max(aStartMin, bStartMin) < Math.min(aEndMin, bEndMin);
};

// Kiểm tra hai danh sách tuần học có tuần nào trùng nhau hay không
const hasCommonWeek = (weeksA, weeksB) => {
  if (!Array.isArray(weeksA) || !Array.isArray(weeksB)) return true;
  if (weeksA.length === 0 || weeksB.length === 0) return true;
  const setB = new Set(weeksB.map(Number));
  return weeksA.some((w) => setB.has(Number(w)));
};

// Kiểm tra xung đột trùng giảng viên hoặc trùng phòng học khi xếp lịch
const detectScheduleConflicts = async ({
  nguoi_dung_id,
  phong_hoc,
  thu_trong_tuan,
  tiet_bat_dau,
  so_tiet,
  gio_bat_dau,
  gio_ket_thuc,
  ngay_bat_dau,
  ngay_ket_thuc,
  danh_sach_tuan = [],
  nam_hoc,
  hoc_ky,
  excludeScheduleId = null,
}) => {
  const where = {
    thu_trong_tuan: Number(thu_trong_tuan),
    ...(excludeScheduleId ? { id: { [Op.ne]: excludeScheduleId } } : {}),
  };

  if (ngay_bat_dau && ngay_ket_thuc) {
    where.ngay_bat_dau = { [Op.lte]: ngay_ket_thuc };
    where.ngay_ket_thuc = { [Op.gte]: ngay_bat_dau };
  }

  if (nam_hoc) where.nam_hoc = nam_hoc;
  if (hoc_ky !== undefined && Number(hoc_ky) !== 0) {
    where.hoc_ky = Number(hoc_ky);
  }

  const existingSchedules = await LichTrinh.findAll({
    where,
    include: [
      { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'ma_can_bo'] },
      { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
      { model: NgoaiLeLichTrinh, as: 'ngoai_le', attributes: ['ngay', 'trang_thai'] },
    ],
  });

  const incomingSched = {
    tiet_bat_dau: Number(tiet_bat_dau),
    so_tiet: Number(so_tiet),
    gio_bat_dau,
    gio_ket_thuc,
  };

  for (const exist of existingSchedules) {
    if (
      ngay_bat_dau &&
      ngay_ket_thuc &&
      ngay_bat_dau === ngay_ket_thuc &&
      Array.isArray(exist.ngoai_le) &&
      exist.ngoai_le.some(
        (ex) => String(ex.ngay).slice(0, 10) === String(ngay_bat_dau).slice(0, 10) && ['nghi', 'huy'].includes(ex.trang_thai)
      )
    ) {
      continue;
    }

    const existWeeks = (exist.tuan_hoc || []).map((w) => w.tuan_thu);
    if (!hasCommonWeek(danh_sach_tuan, existWeeks)) continue;

    if (!checkPeriodOrTimeOverlap(incomingSched, exist)) continue;

    if (String(exist.nguoi_dung_id) === String(nguoi_dung_id)) {
      const lecturerName = exist.giang_vien?.ho_ten || 'Giảng viên';
      throw new ServiceError(
        `Xung đột lịch Giảng viên: ${lecturerName} đã có lịch giảng dạy khác vào ${
          exist.gio_bat_dau || `tiết ${exist.tiet_bat_dau}`
        } (Thứ ${thu_trong_tuan})!`,
        409,
        'SCHEDULE_LECTURER_CONFLICT',
        { conflictingScheduleId: exist.id }
      );
    }

    if (phong_hoc && exist.phong_hoc && isSameRoom(phong_hoc, exist.phong_hoc)) {
      throw new ServiceError(
        `Xung đột Phòng học: ${phong_hoc} đã được bố trí cho lớp học khác vào ${
          exist.gio_bat_dau || `tiết ${exist.tiet_bat_dau}`
        } (Thứ ${thu_trong_tuan})!`,
        409,
        'SCHEDULE_ROOM_CONFLICT',
        { conflictingScheduleId: exist.id, room: phong_hoc }
      );
    }
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
    const departmentIds = await getDeanDepartmentIds(currentUser);
    const scopedUsers = departmentIds.length
      ? await NguoiDung.findAll({
          where: { don_vi_chinh_id: { [Op.in]: departmentIds } },
          attributes: ['id'],
          raw: true,
        })
      : [];
    const scopedIds = scopedUsers.map((u) => u.id);

    if (nguoi_dung_id) {
      if (!scopedIds.map(String).includes(String(nguoi_dung_id))) {
        throw new ServiceError('Bạn chỉ có quyền xem lịch của giảng viên thuộc khoa mình.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else if (!scopedIds.length) {
      return {
        schedules: [],
        pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 1 },
      };
    } else {
      where.nguoi_dung_id = { [Op.in]: scopedIds };
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
    const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
    const inScope = await isUserInDeanScope(currentUser, schedule.nguoi_dung_id);
    if (!inScope && String(schedule.nguoi_dung_id) !== String(currentUser.id)) {
      throw new ServiceError('Bạn không có quyền xem lịch trình của nhân sự ngoài khoa.', 403);
    }
  }

  return formatScheduleOutput(schedule);
};

// Tạo mới lịch trình giảng dạy kèm danh sách tuần học và kiểm tra chống trùng lịch
const createNewSchedule = async (data, currentUser) => {
  if (!hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, ...UNIT_LEADER_ROLES, 'dao_tao'])) {
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
    mon_hoc_id,
    vi_do,
    kinh_do,
    ban_kinh_met = 100,
    thu_trong_tuan,
    lap_lai_hang_tuan = true,
    ngay_bat_dau,
    ngay_ket_thuc,
    loai_lich = 'chinh_khoa',
    danh_sach_tuan = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    nam_hoc = '2025-2026',
    hoc_ky = 1,
  } = data;

  if (!nguoi_dung_id || !ca_id || thu_trong_tuan === undefined || !ngay_bat_dau || !ngay_ket_thuc) {
    throw new ServiceError('Vui lòng điền đầy đủ Giảng viên, Ca làm việc, Thứ trong tuần, Ngày bắt đầu và Ngày kết thúc.', 400);
  }

  if (!isValidUuid(ca_id)) {
    throw new ServiceError('Mã ca làm việc không hợp lệ.', 400);
  }
  const shiftDoc = await CaLamViec.findByPk(ca_id);
  if (!shiftDoc) {
    throw new ServiceError('Không tìm thấy ca làm việc được chọn.', 404);
  }

  const isGlobalCreator = hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);
  if (!isGlobalCreator && hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    const inScope = await isUserInDeanScope(currentUser, nguoi_dung_id);
    if (!inScope) {
      throw new ServiceError('Bạn chỉ có quyền phân công lịch trình cho nhân sự trong phạm vi đơn vị quản lý.', 403);
    }
  }

  const resolvedStartPeriod = Number(tiet_bat_dau) || 1;
  const resolvedPeriodCount = Number(so_tiet) || 3;
  let resolvedStartTime = gio_bat_dau || shiftDoc.gio_bat_dau || '07:00';
  let resolvedEndTime = gio_ket_thuc || shiftDoc.gio_ket_thuc || '11:30';

  await detectScheduleConflicts({
    nguoi_dung_id,
    phong_hoc,
    thu_trong_tuan,
    tiet_bat_dau: resolvedStartPeriod,
    so_tiet: resolvedPeriodCount,
    gio_bat_dau: resolvedStartTime,
    gio_ket_thuc: resolvedEndTime,
    ngay_bat_dau,
    ngay_ket_thuc,
    danh_sach_tuan,
    nam_hoc,
    hoc_ky,
  });

  let createdId = null;
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
        mon_hoc_id: mon_hoc_id || null,
        vi_do: vi_do ?? null,
        kinh_do: kinh_do ?? null,
        ban_kinh_met,
        thu_trong_tuan: Number(thu_trong_tuan),
        lap_lai_hang_tuan: Boolean(lap_lai_hang_tuan),
        ngay_bat_dau,
        ngay_ket_thuc,
        loai_lich,
        nam_hoc,
        hoc_ky: Number(hoc_ky) || 1,
      },
      { transaction }
    );
    createdId = newSchedule.id;

    if (Array.isArray(danh_sach_tuan) && danh_sach_tuan.length > 0) {
      const uniqueWeeks = [...new Set(danh_sach_tuan.map(Number).filter((w) => w >= 1 && w <= 53))];
      if (uniqueWeeks.length > 0) {
        await LichTrinhTuan.bulkCreate(
          uniqueWeeks.map((tuan_thu) => ({ lich_trinh_id: newSchedule.id, tuan_thu })),
          { transaction }
        );
      }
    }
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'CREATE_SCHEDULE',
    doi_tuong_id: String(createdId),
    loai_doi_tuong: 'lich_trinh',
    chi_tiet: { phong_hoc, thu_trong_tuan, tiet_bat_dau: resolvedStartPeriod, loai_lich },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchScheduleById(createdId, currentUser);
};

// Cập nhật lịch trình, tuần học và kiểm tra lại xung đột lịch
const updateExistingSchedule = async (scheduleId, data, currentUser) => {
  const role = normalizeRole(currentUser?.vai_tro_chinh);
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(role)) {
    throw new ServiceError('Tài khoản Giảng viên / Nhân viên không có quyền chỉnh sửa phân công lịch trình.', 403);
  }
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }

  const schedule = await LichTrinh.findByPk(scheduleId, {
    include: [{ model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] }],
  });
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch cần cập nhật.', 404);
  }
  if (UNIT_LEADER_ROLES.includes(role)) {
    const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
    if (!(await isUserInDeanScope(currentUser, schedule.nguoi_dung_id))) {
      throw new ServiceError('Bạn không có quyền sửa lịch trình của nhân sự ngoài khoa.', 403);
    }
  }

  const currentWeeks = (schedule.tuan_hoc || []).map((w) => w.tuan_thu);
  const nextUserId = data.nguoi_dung_id || data.giang_vien_id || schedule.nguoi_dung_id;
  const nextRoom = data.phong_hoc !== undefined ? data.phong_hoc : schedule.phong_hoc;
  const nextWeekday = data.thu_trong_tuan !== undefined ? data.thu_trong_tuan : schedule.thu_trong_tuan;
  const nextStartPeriod = data.tiet_bat_dau !== undefined ? data.tiet_bat_dau : schedule.tiet_bat_dau;
  const nextPeriodCount = data.so_tiet !== undefined ? data.so_tiet : schedule.so_tiet;
  const nextStartTime = data.gio_bat_dau || schedule.gio_bat_dau;
  const nextEndTime = data.gio_ket_thuc || schedule.gio_ket_thuc;
  const nextWeekNumbers = data.danh_sach_tuan || currentWeeks;
  const nextAcademicYear = data.nam_hoc || schedule.nam_hoc;
  const nextSemester = data.hoc_ky !== undefined ? data.hoc_ky : schedule.hoc_ky;

  const nextStartDate = data.ngay_bat_dau || schedule.ngay_bat_dau;
  const nextEndDate = data.ngay_ket_thuc || schedule.ngay_ket_thuc;

  await detectScheduleConflicts({
    nguoi_dung_id: nextUserId,
    phong_hoc: nextRoom,
    thu_trong_tuan: nextWeekday,
    tiet_bat_dau: nextStartPeriod,
    so_tiet: nextPeriodCount,
    gio_bat_dau: nextStartTime,
    gio_ket_thuc: nextEndTime,
    ngay_bat_dau: nextStartDate,
    ngay_ket_thuc: nextEndDate,
    danh_sach_tuan: nextWeekNumbers,
    nam_hoc: nextAcademicYear,
    hoc_ky: nextSemester,
    excludeScheduleId: schedule.id,
  });

  await runInTransaction(async (transaction) => {
    const updatable = [
      'nguoi_dung_id', 'ca_id', 'mon_hoc_id', 'phong_hoc', 'vi_do', 'kinh_do',
      'ban_kinh_met', 'thu_trong_tuan', 'gio_bat_dau', 'gio_ket_thuc',
      'ngay_bat_dau', 'ngay_ket_thuc', 'tiet_bat_dau', 'so_tiet',
      'lap_lai_hang_tuan', 'loai_lich', 'nam_hoc', 'hoc_ky',
    ];
    for (const field of updatable) {
      if (data[field] !== undefined) schedule[field] = data[field];
    }
    await schedule.save({ transaction });

    if (Array.isArray(data.danh_sach_tuan)) {
      await LichTrinhTuan.destroy({ where: { lich_trinh_id: schedule.id }, transaction });
      const uniqueWeeks = [...new Set(data.danh_sach_tuan.map(Number).filter((w) => w >= 1 && w <= 53))];
      if (uniqueWeeks.length > 0) {
        await LichTrinhTuan.bulkCreate(
          uniqueWeeks.map((tuan_thu) => ({ lich_trinh_id: schedule.id, tuan_thu })),
          { transaction }
        );
      }
    }
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

// Xóa lịch trình nếu chưa phát sinh dữ liệu chấm công hay đơn nghỉ liên quan
const removeSchedule = async (scheduleId, currentUser) => {
  const role = normalizeRole(currentUser?.vai_tro_chinh);
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(role)) {
    throw new ServiceError('Tài khoản Giảng viên / Nhân viên không có quyền xóa phân công lịch trình.', 403);
  }
  if (!isValidUuid(scheduleId)) {
    throw new ServiceError('ID lịch trình không hợp lệ.', 400);
  }

  const schedule = await LichTrinh.findByPk(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch để xóa.', 404);
  }
  if (UNIT_LEADER_ROLES.includes(role)) {
    if (!(await isUserInDeanScope(currentUser, schedule.nguoi_dung_id))) {
      throw new ServiceError('Bạn không có quyền xóa lịch trình của nhân sự ngoài khoa.', 403);
    }
  }

  const { NhatKyChamCong, DonNghiPhep } = require('../../models');
  const [linkedAttendance, linkedLeaves] = await Promise.all([
    NhatKyChamCong.count({ where: { lich_trinh_id: schedule.id } }),
    DonNghiPhep.count({ where: { lich_trinh_id: schedule.id } }),
  ]);
  if (linkedAttendance > 0 || linkedLeaves > 0) {
    throw new ServiceError(
      'Không thể xóa lịch trình vì đã có dữ liệu chấm công hoặc đơn nghỉ phép tham chiếu đến lịch này.',
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
  const schedule = await LichTrinh.findByPk(scheduleId);
  if (!schedule) {
    throw new ServiceError('Không tìm thấy lịch giảng dạy.', 404);
  }

  const userRole = normalizeRole(currentUser?.vai_tro_chinh);
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(userRole) && String(schedule.nguoi_dung_id) !== String(currentUser.id)) {
    throw new ServiceError('Bạn chỉ có quyền báo nghỉ/bù cho lịch của chính mình.', 403);
  }
  if (UNIT_LEADER_ROLES.includes(userRole) && String(schedule.nguoi_dung_id) !== String(currentUser.id)) {
    const inScope = await isUserInDeanScope(currentUser, schedule.nguoi_dung_id);
    if (!inScope) {
      throw new ServiceError('Bạn chỉ có quyền cập nhật ngoại lệ lịch cho nhân sự trong phạm vi đơn vị quản lý.', 403);
    }
  }

  if (trang_thai === 'day_bu' && ngay_day_bu) {
    const { getVietnamTime } = require('../../utils/thoiGianChamCong.utils');
    const makeupDateStr = String(ngay_day_bu).slice(0, 10);
    const makeupVn = getVietnamTime(makeupDateStr);
    const makeupWeekday = makeupVn.getDay();
    const startVn = schedule.ngay_bat_dau ? getVietnamTime(schedule.ngay_bat_dau) : makeupVn;
    const diffDays = Math.max(0, Math.round((makeupVn.getTime() - startVn.getTime()) / (1000 * 60 * 60 * 24)));
    const makeupWeek = Math.floor(diffDays / 7) + 1;

    await detectScheduleConflicts({
      nguoi_dung_id: schedule.nguoi_dung_id,
      phong_hoc: schedule.phong_hoc,
      thu_trong_tuan: makeupWeekday,
      tiet_bat_dau: schedule.tiet_bat_dau,
      so_tiet: schedule.so_tiet,
      gio_bat_dau: schedule.gio_bat_dau,
      gio_ket_thuc: schedule.gio_ket_thuc,
      ngay_bat_dau: makeupDateStr,
      ngay_ket_thuc: makeupDateStr,
      danh_sach_tuan: [makeupWeek],
      nam_hoc: schedule.nam_hoc,
      hoc_ky: schedule.hoc_ky,
      excludeScheduleId: schedule.id,
    });
  }

  const existing = await NgoaiLeLichTrinh.findOne({
    where: { lich_trinh_id: schedule.id, ngay },
  });

  if (existing) {
    existing.ly_do = ly_do || existing.ly_do;
    existing.trang_thai = trang_thai;
    existing.ngay_day_bu = ngay_day_bu || null;
    await existing.save();
  } else {
    await NgoaiLeLichTrinh.create({
      lich_trinh_id: schedule.id,
      ngay,
      ly_do: ly_do || 'Giảng viên có lý do công tác',
      trang_thai,
      ngay_day_bu: ngay_day_bu || null,
    });
  }

  return fetchScheduleById(schedule.id, currentUser);
};

// Lấy lịch giảng dạy có hiệu lực trong ngày (bao gồm lịch dạy bù và dạy thay)
const fetchTodaySchedules = async ({ nguoi_dung_id, ngay, currentUser }) => {
  const { getVietnamTime, getVietnamDayRange } = require('../../utils/thoiGianChamCong.utils');
  const rawDate = ngay ? new Date(ngay) : new Date();
  const vnTime = getVietnamTime(rawDate);
  const { dateStr } = getVietnamDayRange(rawDate);
  const currentWeekday = vnTime.getDay();
  const userRole = normalizeRole(currentUser?.vai_tro_chinh);

  const where = {
    thu_trong_tuan: currentWeekday,
    ngay_bat_dau: { [Op.lte]: dateStr },
    ngay_ket_thuc: { [Op.gte]: dateStr },
  };

  if (['admin', 'bgh', 'tccb', 'dao_tao', 'kiem_toan'].includes(userRole)) {
    if (nguoi_dung_id) {
      where.nguoi_dung_id = nguoi_dung_id;
    }
  } else if (UNIT_LEADER_ROLES.includes(userRole)) {
    const departmentIds = await getDeanDepartmentIds(currentUser);
    const scopedUsers = departmentIds.length
      ? await NguoiDung.findAll({
          where: { don_vi_chinh_id: { [Op.in]: departmentIds } },
          attributes: ['id'],
          raw: true,
        })
      : [];
    const scopedIds = scopedUsers.map((u) => String(u.id));
    if (nguoi_dung_id) {
      if (!scopedIds.includes(String(nguoi_dung_id)) && String(nguoi_dung_id) !== String(currentUser.id)) {
        throw new ServiceError('Bạn không có quyền xem lịch giảng dạy của nhân sự ngoài đơn vị.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else {
      where.nguoi_dung_id = { [Op.in]: scopedIds.length ? scopedIds : [String(currentUser.id)] };
    }
  } else {
    if (nguoi_dung_id && String(nguoi_dung_id) !== String(currentUser.id)) {
      throw new ServiceError('Bạn chỉ có quyền xem lịch giảng dạy hôm nay của chính mình.', 403);
    }
    where.nguoi_dung_id = currentUser.id;
  }

  const makeupScheduleWhere = where.nguoi_dung_id ? { nguoi_dung_id: where.nguoi_dung_id } : undefined;
  const swapWhere = {
    loai_don: 'doi_ca',
    trang_thai: 'approved',
    lich_trinh_id: { [Op.ne]: null },
    [Op.or]: [
      { ngay_day_bu: dateStr },
      { ngay_bat_dau: { [Op.lte]: dateStr }, ngay_ket_thuc: { [Op.gte]: dateStr } },
    ],
  };
  if (nguoi_dung_id) {
    swapWhere.giang_vien_day_thay_id = nguoi_dung_id;
  } else if (!['admin', 'bgh', 'tccb', 'dao_tao', 'kiem_toan'].includes(userRole)) {
    swapWhere.giang_vien_day_thay_id = where.nguoi_dung_id;
  }

  const [schedules, makeupExceptions, swapExceptions] = await Promise.all([
    LichTrinh.findAll({
      where,
      include: INCLUDE_SCHEDULE,
      order: [['tiet_bat_dau', 'ASC'], ['gio_bat_dau', 'ASC']],
    }),
    NgoaiLeLichTrinh.findAll({
      where: {
        trang_thai: 'day_bu',
        [Op.or]: [{ ngay_day_bu: dateStr }, { ngay: dateStr }],
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
    .map(formatScheduleOutput)
    .filter((s) => isScheduleActiveOnDate(s, vnTime));
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
