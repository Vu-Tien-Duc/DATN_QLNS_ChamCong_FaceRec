// Đánh giá lịch/ca làm việc trong ngày đủ điều kiện để giảng viên/cán bộ thực hiện Check-in
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LichTrinh,
  NgoaiLeLichTrinh,
  CaLamViec,
  NguoiDung,
  HoSoCanBo,
  NhatKyKiemToan,
  NgayNghiLe,
} = require('../../models');
const { processScheduleAttendanceCheck } = require('../heThong/tacVuDinhKy.service');
const { getConfigSync } = require('../heThong/cauHinhHeThong.service');
const { getVietnamTime, getVietnamDayRange, timeStringToMinutes } = require('../../utils/thoiGianChamCong.utils');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const {
  gomKhoiCaDay,
  NGUONG_GOP_KHOI_MAC_DINH_PHUT,
  LOAI_GIANG_DAY,
} = require('../../utils/gomKhoiCaDay.utils');

// Đánh giá lịch giảng dạy/công tác và chọn ca phù hợp để thực hiện điểm danh vào ca
const evaluateUserScheduleForCheckIn = async (
  userId,
  specificShiftId = null,
  userObj = null,
  referenceDate = new Date(),
  { readOnly = false } = {}
) => {
  const nowVN = getVietnamTime(referenceDate);
  const attendanceRules = getConfigSync('QUY_TAC_DIEM_DANH', {});
  const configuredCheckInWindow = Math.max(5, Number(attendanceRules?.cua_so_checkin_truoc_phut) || 30);
  const configuredDefaultLate = Math.max(1, Number(getConfigSync('DEFAULT_LATE_THRESHOLD_MINUTES', 15)) || 15);
  const currentWeekday = nowVN.getDay();
  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const dayRange = getVietnamDayRange(nowVN);
  const { startOfDay, endOfDay, dateStr } = dayRange;

  let user = userObj && userObj.ho_ten ? userObj : null;
  if (!user && userId && isValidUuid(userId)) {
    user = await NguoiDung.findByPk(userId, {
      attributes: ['id', 'ho_ten', 'vai_tro_chinh'],
      include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['loai_nhan_su'] }],
    });
  }

  const userName = user?.ho_ten || 'Cán bộ';
  const userRole = (user?.vai_tro_chinh || '').toLowerCase();
  const loaiNhanSu = (user?.ho_so?.loai_nhan_su || user?.loai_nhan_su || '').toLowerCase();
  const isPureLecturer = userRole === 'giang_vien' || (loaiNhanSu === 'giang_vien' && !['truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'admin', 'bgh', 'tccb', 'dao_tao'].includes(userRole));
  const isFaculty =
    loaiNhanSu === 'giang_vien' ||
    ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(userRole);
  const prefix = isFaculty ? 'Giảng viên' : 'Cán bộ';

  const where = {
    nguoi_dung_id: userId,
    thu_trong_tuan: currentWeekday,
    ngay_bat_dau: { [Op.lte]: dateStr },
    ngay_ket_thuc: { [Op.gte]: dateStr },
  };

  if (specificShiftId && isValidUuid(String(specificShiftId))) {
    where.ca_id = specificShiftId;
  }

  const scheduleIncludes = [
    { model: CaLamViec, as: 'ca' },
    { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh'] },
    { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
  ];

  const [rawSchedules, makeupExceptions, swapExceptions] = await Promise.all([
    LichTrinh.findAll({
      where,
      include: scheduleIncludes,
      order: [['gio_bat_dau', 'ASC']],
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
          required: true,
          include: scheduleIncludes,
        },
        { model: CaLamViec, as: 'ca_thay_the' },
      ],
    }),
    NgoaiLeLichTrinh.findAll({
      where: {
        trang_thai: 'doi_ca',
        [Op.or]: [{ ngay_day_bu: dateStr }, { ngay: dateStr }],
      },
      include: [
        {
          model: LichTrinh,
          as: 'lich_trinh',
          required: true,
          include: scheduleIncludes,
        },
        { model: CaLamViec, as: 'ca_thay_the' },
      ],
    }),
  ]);

  const seenScheduleIds = new Set();
  const schedules = [];
  const toPlainSchedule = (s, overrideEx = null) => {
    const plain = s.toJSON();
    if (overrideEx) {
      plain._isSubstituteOverride = true;
      if (overrideEx.giang_vien_day_thay_id) {
        plain.nguoi_dung_id = overrideEx.giang_vien_day_thay_id;
      }
      if (overrideEx.ca_thay_the) {
        plain.ca_id = overrideEx.ca_thay_the.id;
        plain.ca = typeof overrideEx.ca_thay_the.toJSON === 'function' ? overrideEx.ca_thay_the.toJSON() : overrideEx.ca_thay_the;
        plain.gio_bat_dau = plain.ca.gio_bat_dau;
        plain.gio_ket_thuc = plain.ca.gio_ket_thuc;
      }
    }
    return plain;
  };

  for (const s of rawSchedules) {
    seenScheduleIds.add(String(s.id));
    schedules.push(toPlainSchedule(s));
  }
  for (const ex of makeupExceptions) {
    if (!ex.lich_trinh) continue;
    const isForUser =
      String(ex.giang_vien_day_thay_id || ex.lich_trinh.nguoi_dung_id) === String(userId);
    if (!isForUser) continue;
    if (specificShiftId && isValidUuid(String(specificShiftId)) && String(ex.ca_thay_the_id || ex.lich_trinh.ca_id) !== String(specificShiftId)) {
      continue;
    }
    if (!seenScheduleIds.has(String(ex.lich_trinh.id))) {
      seenScheduleIds.add(String(ex.lich_trinh.id));
      schedules.push(toPlainSchedule(ex.lich_trinh, ex));
    }
  }
  for (const ex of swapExceptions) {
    if (!ex.lich_trinh) continue;
    const isSub = ex.giang_vien_day_thay_id && String(ex.giang_vien_day_thay_id) === String(userId);
    const isSelfShiftSwap =
      !ex.giang_vien_day_thay_id &&
      ex.ca_thay_the &&
      String(ex.lich_trinh.nguoi_dung_id) === String(userId) &&
      String(ex.ngay_day_bu || ex.ngay).slice(0, 10) === dateStr;
    if (!isSub && !isSelfShiftSwap) continue;
    const effectiveShiftId = ex.ca_thay_the_id || ex.lich_trinh.ca_id;
    if (specificShiftId && isValidUuid(String(specificShiftId)) && String(effectiveShiftId) !== String(specificShiftId)) {
      continue;
    }
    const existingIdx = schedules.findIndex((item) => String(item.id) === String(ex.lich_trinh.id));
    if (existingIdx >= 0) {
      schedules[existingIdx] = toPlainSchedule(ex.lich_trinh, ex);
    } else {
      seenScheduleIds.add(String(ex.lich_trinh.id));
      schedules.push(toPlainSchedule(ex.lich_trinh, ex));
    }
  }

  // 1. Không có lịch giảng dạy hôm nay
  if (!schedules || schedules.length === 0) {
    if (isPureLecturer) {
      return {
        canCheckIn: false,
        status: 'NO_SCHEDULE',
        message: `Giảng viên ${userName} hôm nay không có lịch phân công giảng dạy nào trên hệ thống.`,
      };
    }

    const shiftWhere = { kich_hoat: true };
    if (specificShiftId && isValidUuid(String(specificShiftId))) {
      shiftWhere.id = specificShiftId;
    }
    const adminShifts = await CaLamViec.findAll({ where: shiftWhere, order: [['gio_bat_dau', 'ASC']] });
    if (!adminShifts || adminShifts.length === 0) {
      return {
        canCheckIn: false,
        status: 'NO_SCHEDULE',
        message: `Cán bộ ${userName} hôm nay không có ca làm việc hành chính nào được kích hoạt trên hệ thống.`,
      };
    }

    let chosenShift = null;
    let upcomingShift = null;
    let alreadyCheckedInAdminLog = null;

    for (const shift of adminShifts) {
      const shiftStartStr = shift.gio_bat_dau;
      const shiftEndStr = shift.gio_ket_thuc;
      const startMinutes = timeStringToMinutes(shiftStartStr);
      const rawEndMinutes = timeStringToMinutes(shiftEndStr);
      const isOvernightShift = rawEndMinutes < startMinutes;
      const effectiveEndMinutes = isOvernightShift ? rawEndMinutes + 1440 : rawEndMinutes;
      const effectiveCurrentMinutes =
        isOvernightShift && currentMinutes < rawEndMinutes ? currentMinutes + 1440 : currentMinutes;

      const existingAdminLog = await NhatKyChamCong.findOne({
        where: {
          nguoi_dung_id: userId,
          ca_id: shift.id,
          lich_trinh_id: null,
          [Op.or]: [
            { ngay_cong: dateStr },
            { thoi_gian_vao: { [Op.between]: [startOfDay, endOfDay] } },
          ],
        },
      });

      if (existingAdminLog) {
        if (existingAdminLog.thoi_gian_ra || existingAdminLog.trang_thai === 'thieu_check_out') continue;
        if (existingAdminLog.thoi_gian_vao && !existingAdminLog.thoi_gian_ra) {
          alreadyCheckedInAdminLog = existingAdminLog;
          continue;
        }
      }

      const adminCheckInWindow = Math.max(configuredCheckInWindow, 60);
      const earlyLimitMinutes = Math.max(0, startMinutes - adminCheckInWindow);
      if (effectiveCurrentMinutes < earlyLimitMinutes) {
        if (!upcomingShift) {
          const openH = Math.floor(earlyLimitMinutes / 60).toString().padStart(2, '0');
          const openM = (earlyLimitMinutes % 60).toString().padStart(2, '0');
          upcomingShift = {
            shiftId: shift.id,
            shiftName: shift.ten_ca,
            startTime: shiftStartStr,
            endTime: shiftEndStr,
            openCheckInTime: `${openH}:${openM}`,
          };
        }
        continue;
      }

      if (effectiveCurrentMinutes > effectiveEndMinutes) continue;

      const status = effectiveCurrentMinutes > startMinutes ? 'late' : 'on_time';
      const lateMinutes = status === 'late' ? effectiveCurrentMinutes - startMinutes : 0;

      chosenShift = {
        shift,
        status,
        lateMinutes,
        shiftStartStr,
        shiftEndStr,
      };
      break;
    }

    if (chosenShift) {
      return {
        canCheckIn: true,
        selectedSchedule: {
          id: null,
          ca_id: chosenShift.shift.id,
          gio_bat_dau: chosenShift.shiftStartStr,
          gio_ket_thuc: chosenShift.shiftEndStr,
          phong_hoc: 'Văn phòng hành chính',
        },
        shift: chosenShift.shift,
        status: chosenShift.status,
        lateMinutes: chosenShift.lateMinutes,
        cancelledSchedules: [],
      };
    }

    if (alreadyCheckedInAdminLog) {
      return {
        canCheckIn: false,
        status: 'ALREADY_CHECKED_IN',
        message: `${prefix} ${userName} đã check-in vào ca làm việc này rồi. Vui lòng sử dụng chức năng Check-out khi kết thúc ca.`,
        existingLog: alreadyCheckedInAdminLog,
      };
    }

    if (upcomingShift) {
      return {
        canCheckIn: false,
        status: 'TOO_EARLY',
        message: `Chưa đến giờ chấm công cho ${upcomingShift.shiftName} (${upcomingShift.startTime}). Cổng chấm công mở lúc ${upcomingShift.openCheckInTime}.`,
      };
    }

    return {
      canCheckIn: false,
      status: 'OUTSIDE_SHIFT_WINDOW',
      message: `${prefix} ${userName} không có ca làm việc hành chính nào đang mở vào thời điểm hiện tại.`,
    };
  }

  // 2. Luồng Giảng viên có lịch giảng dạy (các ca liền nhau cùng cơ sở gom thành một khối, mỗi khối check-in một lần)
  const cancelledSchedules = [];
  const absentSchedules = [];
  let eligibleSchedule = null;
  let upcomingSchedule = null;
  let alreadyCheckedInLog = null;

  const activeSchedules = schedules.filter((sch) => sch.ca && isScheduleActiveOnDate(sch, referenceDate));
  const scheduleById = new Map(activeSchedules.map((sch) => [String(sch.id), sch]));
  const nguongGopKhoi = Number(attendanceRules?.nguong_gop_khoi_phut);
  const khoiList = gomKhoiCaDay(
    activeSchedules.map((sch) => ({
      id: String(sch.id),
      loai: LOAI_GIANG_DAY,
      ca_id: sch.ca_id,
      gio_bat_dau: sch.gio_bat_dau || sch.ca.gio_bat_dau,
      gio_ket_thuc: sch.gio_ket_thuc || sch.ca.gio_ket_thuc,
      co_so: sch.co_so,
      phong_hoc: sch.phong_hoc,
      so_tiet: sch.so_tiet,
    })),
    Number.isFinite(nguongGopKhoi) ? nguongGopKhoi : NGUONG_GOP_KHOI_MAC_DINH_PHUT
  );

  for (const khoi of khoiList) {
    const memberSchedules = khoi.ds_lich_trinh_id.map((id) => scheduleById.get(id)).filter(Boolean);
    const sch = memberSchedules[0];
    const shift = sch.ca;

    const shiftStartStr = khoi.gio_bat_dau;
    const shiftEndStr = khoi.gio_ket_thuc;
    const startMinutes = timeStringToMinutes(shiftStartStr);
    // Cửa sổ check-in đối xứng: N phút trước đến N phút sau giờ bắt đầu ca đầu khối (N cài khi tạo ca, mặc định 15)
    const lateThreshold =
      shift.nguong_di_muon_phut !== undefined && shift.nguong_di_muon_phut !== null
        ? shift.nguong_di_muon_phut
        : configuredDefaultLate;

    const existingLog = await NhatKyChamCong.findOne({
      where: {
        nguoi_dung_id: userId,
        lich_trinh_id: { [Op.in]: khoi.ds_lich_trinh_id },
        [Op.or]: [
          { ngay_cong: dateStr },
          { thoi_gian_vao: { [Op.between]: [startOfDay, endOfDay] } },
          { tao_luc: { [Op.between]: [startOfDay, endOfDay] } },
        ],
      },
    });

    if (existingLog) {
      if (existingLog.trang_thai === 'absent' || existingLog.trang_thai === 'excused_absence') {
        absentSchedules.push({
          schedule: sch,
          shift,
          shiftStartStr,
          shiftEndStr,
          lateThreshold,
          status: existingLog.trang_thai,
          log: existingLog,
        });
        continue;
      }
      if (existingLog.thoi_gian_ra || existingLog.trang_thai === 'thieu_check_out') continue;
      if (existingLog.thoi_gian_vao && !existingLog.thoi_gian_ra) {
        alreadyCheckedInLog = existingLog;
        continue;
      }
    }

    if (currentMinutes > startMinutes + lateThreshold) {
      const holiday = await NgayNghiLe.findOne({
        where: {
          ngay_bat_dau: { [Op.lte]: dateStr },
          ngay_ket_thuc: { [Op.gte]: dateStr },
        },
        attributes: ['id', 'ten_ngay_le'],
      });
      if (holiday) {
        continue;
      }

      // Quá hạn check-in của khối: chỉ ghi DB/gửi email khi KHÔNG ở chế độ chỉ đọc (GET /khoi-hom-nay)
      const absentResults = [];
      if (!readOnly) {
        for (const member of memberSchedules) {
          absentResults.push(await processScheduleAttendanceCheck(member, dayRange));
        }
      }
      const absentResult = absentResults[0] || null;
      const shiftName = shift.ten_ca || 'Ca làm việc';
      cancelledSchedules.push({
        scheduleId: sch.id,
        shiftName,
        startTime: shiftStartStr,
        endTime: shiftEndStr,
        lateThreshold,
        absentResult,
      });

      if (!readOnly) {
        NhatKyKiemToan.create({
          nguoi_thuc_hien_id: userId,
          loai_chu_the: 'system',
          hanh_dong: 'SCHEDULE_AUTO_CANCELLED_LATE',
          doi_tuong_id: String(sch.id),
          loai_doi_tuong: 'lich_trinh',
          chi_tiet: {
            shiftName,
            startTime: shiftStartStr,
            currentMinutes,
            lateMinutes: currentMinutes - startMinutes,
            lateThreshold,
            scheduleIds: khoi.ds_lich_trinh_id,
            reason: `Quá hạn check-in (muộn quá ${lateThreshold} phút). Tự động hủy lịch và đánh vắng.`,
          },
        }).catch((error) => {
          console.error('[AttendanceService] Không thể ghi audit log hủy lịch quá hạn:', error);
        });
      }

      continue;
    }

    const earlyLimitMinutes = Math.max(0, startMinutes - lateThreshold);
    if (currentMinutes < earlyLimitMinutes) {
      if (!upcomingSchedule) {
        const openH = Math.floor(earlyLimitMinutes / 60).toString().padStart(2, '0');
        const openM = (earlyLimitMinutes % 60).toString().padStart(2, '0');
        upcomingSchedule = {
          scheduleId: sch.id,
          shiftName: shift.ten_ca || 'Ca làm việc',
          startTime: shiftStartStr,
          endTime: shiftEndStr,
          openCheckInTime: `${openH}:${openM}`,
          windowMinutes: lateThreshold,
        };
      }
      continue;
    }

    const status = currentMinutes > startMinutes ? 'late' : 'on_time';
    const lateMinutes = status === 'late' ? currentMinutes - startMinutes : 0;

    eligibleSchedule = {
      schedule: sch,
      shift,
      khoi,
      status,
      lateMinutes,
      shiftStartStr,
      shiftEndStr,
    };
    break;
  }

  if (eligibleSchedule) {
    return {
      canCheckIn: true,
      selectedSchedule: eligibleSchedule.schedule,
      shift: eligibleSchedule.shift,
      khoi: eligibleSchedule.khoi,
      status: eligibleSchedule.status,
      lateMinutes: eligibleSchedule.lateMinutes,
      cancelledSchedules,
    };
  }

  if (alreadyCheckedInLog) {
    return {
      canCheckIn: false,
      status: 'ALREADY_CHECKED_IN',
      message: `${prefix} ${userName} đã check-in vào ca làm việc này rồi. Vui lòng sử dụng chức năng Check-out khi kết thúc ca.`,
      existingLog: alreadyCheckedInLog,
    };
  }

  // A3: Người dùng kiêm nhiệm (trưởng/phó khoa có cả lịch dạy lẫn ca hành chính)
  // → Nếu không có khối giảng dạy nào đang mở, thử tìm ca hành chính phù hợp trong ngày
  if (isFaculty && !isPureLecturer) {
    const shiftWhere2 = { kich_hoat: true };
    if (specificShiftId && isValidUuid(String(specificShiftId))) {
      shiftWhere2.id = specificShiftId;
    }
    const adminShifts2 = await CaLamViec.findAll({ where: shiftWhere2, order: [['gio_bat_dau', 'ASC']] });

    let chosenAdminShift = null;
    let upcomingAdminShift = null;
    let alreadyCheckedInAdmin = null;

    for (const shift of adminShifts2) {
      const startM = timeStringToMinutes(shift.gio_bat_dau);
      const rawEndM = timeStringToMinutes(shift.gio_ket_thuc);
      const isOvernight = rawEndM < startM;
      const effectiveEndM = isOvernight ? rawEndM + 1440 : rawEndM;
      const effectiveCurM = isOvernight && currentMinutes < rawEndM ? currentMinutes + 1440 : currentMinutes;

      const existingAdminLog2 = await NhatKyChamCong.findOne({
        where: {
          nguoi_dung_id: userId,
          ca_id: shift.id,
          lich_trinh_id: null,
          ngay_cong: dateStr,
        },
      });
      if (existingAdminLog2) {
        if (existingAdminLog2.thoi_gian_ra || existingAdminLog2.trang_thai === 'thieu_check_out') continue;
        if (existingAdminLog2.thoi_gian_vao && !existingAdminLog2.thoi_gian_ra) {
          alreadyCheckedInAdmin = existingAdminLog2;
          continue;
        }
      }

      const adminWindow = Math.max(configuredCheckInWindow, 60);
      const earlyLimitM = Math.max(0, startM - adminWindow);
      if (effectiveCurM < earlyLimitM) {
        if (!upcomingAdminShift) {
          const openH = Math.floor(earlyLimitM / 60).toString().padStart(2, '0');
          const openMm = (earlyLimitM % 60).toString().padStart(2, '0');
          upcomingAdminShift = {
            shiftId: shift.id,
            shiftName: shift.ten_ca,
            startTime: shift.gio_bat_dau,
            endTime: shift.gio_ket_thuc,
            openCheckInTime: `${openH}:${openMm}`,
          };
        }
        continue;
      }
      if (effectiveCurM > effectiveEndM) continue;

      const shiftStatus = effectiveCurM > startM ? 'late' : 'on_time';
      const shiftLateMin = shiftStatus === 'late' ? effectiveCurM - startM : 0;
      chosenAdminShift = { shift, status: shiftStatus, lateMinutes: shiftLateMin };
      break;
    }

    if (chosenAdminShift) {
      return {
        canCheckIn: true,
        selectedSchedule: {
          id: null,
          ca_id: chosenAdminShift.shift.id,
          gio_bat_dau: chosenAdminShift.shift.gio_bat_dau,
          gio_ket_thuc: chosenAdminShift.shift.gio_ket_thuc,
          phong_hoc: 'Văn phòng hành chính',
        },
        shift: chosenAdminShift.shift,
        status: chosenAdminShift.status,
        lateMinutes: chosenAdminShift.lateMinutes,
        cancelledSchedules,
        _sourceType: 'admin_shift_fallback',
      };
    }

    if (alreadyCheckedInAdmin) {
      return {
        canCheckIn: false,
        status: 'ALREADY_CHECKED_IN',
        message: `${prefix} ${userName} đã check-in vào ca hành chính rồi. Vui lòng sử dụng chức năng Check-out khi kết thúc ca.`,
        existingLog: alreadyCheckedInAdmin,
      };
    }

    if (upcomingAdminShift) {
      return {
        canCheckIn: false,
        status: 'TOO_EARLY',
        message: `Chưa đến giờ chấm công cho ca hành chính ${upcomingAdminShift.shiftName} (${upcomingAdminShift.startTime}). Cổng mở lúc ${upcomingAdminShift.openCheckInTime}.`,
        _sourceType: 'admin_shift_fallback',
      };
    }
  }

  if (cancelledSchedules.length > 0) {
    const firstCancelled = cancelledSchedules[0];
    return {
      canCheckIn: false,
      status: 'SCHEDULE_CANCELLED_LATE',
      message: `${prefix} ${userName} đã quá hạn điểm danh cho ${firstCancelled.shiftName} (giờ bắt đầu ${firstCancelled.startTime}, tối đa muộn ${firstCancelled.lateThreshold} phút). Hệ thống đã tự động hủy lịch và ghi nhận vắng mặt.`,
      cancelledSchedules,
    };
  }

  if (absentSchedules.length > 0) {
    const firstAbsent = absentSchedules[0];
    const reasonText =
      firstAbsent.status === 'excused_absence'
        ? 'đã được duyệt đơn nghỉ phép'
        : 'đã bị đánh dấu vắng mặt do quá hạn điểm danh';
    return {
      canCheckIn: false,
      status: firstAbsent.status === 'excused_absence' ? 'EXCUSED_ABSENCE' : 'ALREADY_ABSENT',
      message: `${firstAbsent.shift?.ten_ca || 'Ca làm việc'} (${firstAbsent.shiftStartStr}) hôm nay ${reasonText}.`,
    };
  }

  if (upcomingSchedule) {
    return {
      canCheckIn: false,
      status: 'TOO_EARLY',
      message: `Chưa đến giờ điểm danh cho ${upcomingSchedule.shiftName} (${upcomingSchedule.startTime}). Cổng check-in sẽ mở trước ${upcomingSchedule.windowMinutes} phút (lúc ${upcomingSchedule.openCheckInTime}).`,
      upcomingSchedule,
    };
  }

  return {
    canCheckIn: false,
    status: 'ALL_SHIFTS_COMPLETED',
    message: `${prefix} ${userName} đã hoàn thành tất cả các ca làm việc trong ngày hôm nay.`,
  };
};

module.exports = {
  evaluateUserScheduleForCheckIn,
};
