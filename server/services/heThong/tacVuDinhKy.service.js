// Chạy các tác vụ định kỳ xử lý lịch dạy, đánh vắng tự động và gửi báo cáo chấm công.
const { Op } = require('sequelize');

let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('[Cron Service] Thư viện node-cron chưa được tải:', err.message);
}

const {
  LichTrinh,
  NgoaiLeLichTrinh,
  NhatKyChamCong,
  LuotQuetChamCong,
  DonNghiPhep,
  NhatKyKiemToan,
  NguoiDung,
  VaiTroNguoiDung,
  PhongBan,
  CaLamViec,
  MonHoc,
  HoSoCanBo,
  NgayNghiLe,
} = require('../../models');
const systemConfigService = require('./cauHinhHeThong.service');
const { sendAbsentWarningEmail, sendDailyAttendanceSummaryEmail } = require('./guiEmail.service');
const { getVietnamTime, getVietnamDayRange, timeStringToMinutes } = require('../../utils/thoiGianChamCong.utils');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const { hasAnyActiveRole } = require('../../utils/vaiTro.utils');

const path = require('path');
const scheduledCronTasks = [];

// Kiểm tra email có phải địa chỉ thật để gửi thư
const isDeliverableEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (lower.endsWith('@university.edu.vn') || lower.endsWith('@example.com')) return false;
  return lower.includes('@') && lower.includes('.');
};

// Lấy toàn bộ lịch giảng dạy có hiệu lực trong ngày
const getTodayActiveSchedules = async (targetDate = new Date()) => {
  try {
    const vnTime = getVietnamTime(targetDate);
    const currentWeekday = vnTime.getDay();
    const { dateStr } = getVietnamDayRange(targetDate);

    const scheduleIncludes = [
      { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id'] },
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
      { model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon', 'so_tin_chi', 'phong_ban_id'] },
      { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
    ];

    const [schedules, makeupAndSwapExceptions] = await Promise.all([
      LichTrinh.findAll({
        where: {
          thu_trong_tuan: currentWeekday,
          ngay_bat_dau: { [Op.lte]: dateStr },
          ngay_ket_thuc: { [Op.gte]: dateStr },
        },
        include: scheduleIncludes,
        order: [[{ model: CaLamViec, as: 'ca' }, 'gio_bat_dau', 'ASC']],
      }),
      NgoaiLeLichTrinh.findAll({
        where: {
          trang_thai: { [Op.in]: ['day_bu', 'doi_ca'] },
          [Op.or]: [{ ngay_day_bu: dateStr }, { ngay: dateStr }],
        },
        include: [
          {
            model: LichTrinh,
            as: 'lich_trinh',
            required: true,
            include: scheduleIncludes,
          },
          {
            model: NguoiDung,
            as: 'giang_vien_day_thay',
            attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id'],
          },
          {
            model: CaLamViec,
            as: 'ca_thay_the',
            attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'],
          },
        ],
      }),
    ]);

    const applyExceptionOverride = (ex) => {
      const overridePlain = typeof ex.lich_trinh.toJSON === 'function' ? ex.lich_trinh.toJSON() : { ...ex.lich_trinh };
      overridePlain._isSubstituteOverride = true;
      if (ex.giang_vien_day_thay) {
        overridePlain.nguoi_dung_id = ex.giang_vien_day_thay.id;
        overridePlain.giang_vien =
          typeof ex.giang_vien_day_thay.toJSON === 'function' ? ex.giang_vien_day_thay.toJSON() : ex.giang_vien_day_thay;
      }
      if (ex.ca_thay_the) {
        overridePlain.ca_id = ex.ca_thay_the.id;
        overridePlain.ca = typeof ex.ca_thay_the.toJSON === 'function' ? ex.ca_thay_the.toJSON() : ex.ca_thay_the;
        overridePlain.gio_bat_dau = overridePlain.ca.gio_bat_dau;
        overridePlain.gio_ket_thuc = overridePlain.ca.gio_ket_thuc;
      }
      return overridePlain;
    };

    const seenIds = new Set(schedules.map((s) => String(s.id)));
    const combined = [...schedules];
    for (const ex of makeupAndSwapExceptions) {
      if (!ex.lich_trinh) continue;
      if (ex.trang_thai === 'doi_ca') {
        const isSwapTargetDate = String(ex.ngay_day_bu || ex.ngay).slice(0, 10) === dateStr;
        if (isSwapTargetDate && (ex.giang_vien_day_thay || ex.ca_thay_the)) {
          const overridePlain = applyExceptionOverride(ex);
          const existingIndex = combined.findIndex((s) => String(s.id) === String(ex.lich_trinh.id));
          if (existingIndex >= 0) {
            combined[existingIndex] = overridePlain;
          } else {
            seenIds.add(String(ex.lich_trinh.id));
            combined.push(overridePlain);
          }
        }
      } else if (!seenIds.has(String(ex.lich_trinh.id))) {
        seenIds.add(String(ex.lich_trinh.id));
        combined.push(ex.giang_vien_day_thay || ex.ca_thay_the ? applyExceptionOverride(ex) : ex.lich_trinh);
      }
    }

    return combined.filter((sch) => isScheduleActiveOnDate(sch, targetDate));
  } catch (error) {
    console.error('[Cron Service] Lỗi khi truy vấn getTodayActiveSchedules:', error);
    throw error;
  }
};

// Đối chiếu điểm danh và ghi nhận vắng mặt nếu chưa chấm công
const processScheduleAttendanceCheck = async (schedule, dayRange) => {
  const { startOfDay, endOfDay, dateStr } = dayRange;
  const userId = schedule.giang_vien?.id || schedule.nguoi_dung_id;
  const shiftId = schedule.ca?.id || schedule.ca_id;
  const teacherName = schedule.giang_vien?.ho_ten || userId;
  const shiftName = schedule.ca?.ten_ca || shiftId;

  const holiday = await NgayNghiLe.findOne({
    where: {
      ngay_bat_dau: { [Op.lte]: dateStr },
      ngay_ket_thuc: { [Op.gte]: dateStr },
    },
    attributes: ['id', 'ten_ngay_le'],
  });
  if (holiday) {
    return {
      scheduleId: schedule.id,
      userId,
      teacherName,
      shiftName,
      action: 'SKIPPED_HOLIDAY',
      status: 'holiday',
      reason: `Ngày nghỉ lễ: ${holiday.ten_ngay_le}`,
    };
  }

  // Kiểm tra xem giảng viên đã có bản ghi chấm công cho lịch/khối ca này chưa (kể cả đã gộp trong ds_lich_trinh_id)
  const dayLogs = await NhatKyChamCong.findAll({
    where: {
      nguoi_dung_id: userId,
      [Op.or]: [
        { ngay_cong: dateStr },
        { thoi_gian_vao: { [Op.between]: [startOfDay, endOfDay] } },
        { tao_luc: { [Op.between]: [startOfDay, endOfDay] } },
      ],
    },
  });

  const scheduleIdStr = String(schedule.id);
  const existingLog = dayLogs.find((log) => {
    if (log.lich_trinh_id && String(log.lich_trinh_id) === scheduleIdStr) return true;
    if (Array.isArray(log.ds_lich_trinh_id) && log.ds_lich_trinh_id.map(String).includes(scheduleIdStr)) return true;
    if (!log.lich_trinh_id && shiftId && String(log.ca_id) === String(shiftId)) return true;
    return false;
  }) || null;

  if (existingLog) {
    console.log(
      `[Cron Service] [BỎ QUA] Giảng viên ${teacherName} (${shiftName}): Đã có bản ghi chấm công với trạng thái '${existingLog.trang_thai}' (Log ID: ${existingLog.id}).`
    );
    return {
      scheduleId: schedule.id,
      userId,
      teacherName,
      shiftName,
      action: 'SKIPPED',
      status: existingLog.trang_thai,
      logId: existingLog.id,
      reason: `Đã có bản ghi chấm công với trạng thái ${existingLog.trang_thai}`,
    };
  }

  // Kiểm tra đơn xin nghỉ phép đã được duyệt trong ngày
  const approvedLeave = await DonNghiPhep.findOne({
    where: {
      nguoi_dung_id: userId,
      trang_thai: 'approved',
      ngay_bat_dau: { [Op.lte]: dateStr },
      ngay_ket_thuc: { [Op.gte]: dateStr },
    },
  });

  const finalStatus = approvedLeave ? 'excused_absence' : 'absent';
  const leaveRequestId = approvedLeave ? approvedLeave.id : null;

  // Tạo bản ghi chấm công (bỏ qua nếu đã tồn tại do trùng khóa)
  let newLog;
  try {
    newLog = await NhatKyChamCong.create({
      nguoi_dung_id: userId,
      ca_id: shiftId,
      lich_trinh_id: schedule.id,
      trang_thai: finalStatus,
      thoi_gian_vao: null,
      thoi_gian_ra: null,
      ngay_cong: dateStr,
      don_tu_id: leaveRequestId,
    });
  } catch (err) {
    if (
      err.name === 'SequelizeUniqueConstraintError' ||
      err?.parent?.number === 2627 ||
      err?.parent?.number === 2601
    ) {
      console.log(
        `[Cron Service] [BỎ QUA] Giảng viên ${teacherName} (${shiftName}): Đã tồn tại bản ghi trong CSDL (duplicate key).`
      );
      return {
        scheduleId: schedule.id,
        userId,
        teacherName,
        shiftName,
        action: 'SKIPPED',
        status: finalStatus,
        reason: 'Đã có bản ghi chấm công (duplicate key)',
      };
    }
    throw err;
  }

  console.log(
    `[Cron Service] [ĐÁNH VẮNG] Tự động ghi nhận '${finalStatus}' cho Giảng viên ${teacherName} (${shiftName}) - Log ID: ${newLog.id}`
  );

  // Gửi email cảnh báo vắng mặt không phép
  let emailSent = false;
  if (finalStatus === 'absent' && schedule.giang_vien?.email) {
    if (isDeliverableEmail(schedule.giang_vien.email)) {
      try {
        await sendAbsentWarningEmail({
          to: schedule.giang_vien.email,
          fullName: teacherName,
          shiftName,
          date: dateStr,
        });
        emailSent = true;
        console.log(
          `[Cron Service] [GỬI MAIL] Đã gửi email cảnh báo vắng mặt thành công tới: ${schedule.giang_vien.email}`
        );
      } catch (emailErr) {
        console.error(
          `[Cron Service] [LỖI GỬI MAIL] Không thể gửi mail cảnh báo tới ${schedule.giang_vien.email}:`,
          emailErr.message
        );
      }
    } else {
      console.log(
        `[Cron Service] Bỏ qua gửi email ra Internet tới địa chỉ giả định của mẫu: ${schedule.giang_vien.email}`
      );
    }
  }

  return {
    scheduleId: schedule.id,
    userId,
    teacherName,
    shiftName,
    action: 'CREATED',
    status: finalStatus,
    logId: newLog.id,
    leaveRequestId,
    emailSent,
    reason: approvedLeave
      ? 'Đã có đơn nghỉ phép được duyệt hợp lệ (EXCUSED_ABSENCE)'
      : 'Không phát sinh lượt check-in nào trong ngày (ABSENT)',
  };
};

// Kiểm tra điểm danh cuối ngày cho khối nhân sự hành chính (làm việc Thứ 2 - Thứ 6)
const ADMIN_STAFF_EXCLUDED_ROLES = [
  'admin',
  'bgh',
  'giang_vien',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
];

const processAdminStaffDailyAttendance = async (targetDate, dayRange, scheduledUserIds = new Set()) => {
  const vnTime = getVietnamTime(targetDate);
  const weekday = vnTime.getDay();
  // Khối hành chính làm việc từ Thứ 2 đến Thứ 6
  if (weekday < 1 || weekday > 5) {
    return [];
  }

  const activeShifts = await CaLamViec.findAll({
    where: { kich_hoat: true },
    order: [['gio_bat_dau', 'ASC']],
  });
  const defaultShift =
    activeShifts.find((s) => /hành\s*chính|hanh\s*chinh|văn\s*phòng|van\s*phong|ca\s*ngày/i.test(String(s.ten_ca || ''))) ||
    activeShifts[0] ||
    (await CaLamViec.findOne({ order: [['gio_bat_dau', 'ASC']] }));
  if (!defaultShift) return [];

  const staffUsers = await NguoiDung.findAll({
    where: {
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: {
        [Op.notIn]: ADMIN_STAFF_EXCLUDED_ROLES,
      },
    },
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh'],
    include: [
      { model: HoSoCanBo, as: 'ho_so', attributes: ['loai_nhan_su'] },
      {
        model: VaiTroNguoiDung,
        as: 'danh_sach_vai_tro',
        attributes: ['ma_vai_tro', 'tu_ngay', 'den_ngay'],
      },
    ],
  });

  const results = [];
  for (const staff of staffUsers) {
    if (scheduledUserIds.has(String(staff.id))) continue;
    if (hasAnyActiveRole(staff, ADMIN_STAFF_EXCLUDED_ROLES)) continue;
    if ((staff.ho_so?.loai_nhan_su || '').toLowerCase() === 'giang_vien') continue;

    const existingLog = await NhatKyChamCong.findOne({
      where: {
        nguoi_dung_id: staff.id,
        [Op.or]: [
          { ngay_cong: dayRange.dateStr },
          { thoi_gian_vao: { [Op.between]: [dayRange.startOfDay, dayRange.endOfDay] } },
        ],
      },
    });
    if (existingLog) {
      results.push({
        scheduleId: null,
        userId: staff.id,
        teacherName: staff.ho_ten,
        shiftName: defaultShift.ten_ca,
        action: 'SKIPPED',
        status: existingLog.trang_thai,
        logId: existingLog.id,
      });
      continue;
    }

    const approvedLeave = await DonNghiPhep.findOne({
      where: {
        nguoi_dung_id: staff.id,
        trang_thai: 'approved',
        ngay_bat_dau: { [Op.lte]: dayRange.dateStr },
        ngay_ket_thuc: { [Op.gte]: dayRange.dateStr },
      },
    });
    const finalStatus = approvedLeave ? 'excused_absence' : 'absent';

    try {
      const created = await NhatKyChamCong.create({
        nguoi_dung_id: staff.id,
        ca_id: defaultShift.id,
        lich_trinh_id: null,
        trang_thai: finalStatus,
        thoi_gian_vao: null,
        thoi_gian_ra: null,
        ngay_cong: dayRange.dateStr,
        don_tu_id: approvedLeave ? approvedLeave.id : null,
      });
      results.push({
        scheduleId: null,
        userId: staff.id,
        teacherName: staff.ho_ten,
        shiftName: defaultShift.ten_ca,
        action: 'CREATED',
        status: finalStatus,
        logId: created.id,
      });
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') {
        console.error(`[Cron Service] Lỗi đánh vắng khối hành chính (${staff.ho_ten}):`, err.message);
      }
    }
  }
  return results;
};

// Quét và ghi nhận vắng mặt toàn trường vào cuối ngày (23:59)
const runDailyAbsentCheck = async (targetDate = new Date()) => {
  console.log('------------------------------------------------------------');
  console.log('[Cron Service] Bắt đầu tiến trình tự động quét điểm danh cuối ngày...');
  try {
    const dayRange = getVietnamDayRange(targetDate);

    // Bỏ qua nếu hệ thống đang bảo trì
    const isMaintenance = await systemConfigService.getConfig('SYSTEM_MAINTENANCE_MODE', false);
    if (isMaintenance) {
      console.log('[Cron Service] Hệ thống đang ở chế độ bảo trì (SYSTEM_MAINTENANCE_MODE). Bỏ qua tiến trình quét vắng mặt.');
      return {
        checkedDate: dayRange.dateStr,
        isMaintenance: true,
        action: 'MAINTENANCE_SKIPPED',
        message: 'Hệ thống đang ở chế độ bảo trì. Đã tạm dừng quét vắng mặt.',
      };
    }

    // Bỏ qua nếu là ngày nghỉ lễ
    const holiday = await NgayNghiLe.findOne({
      where: {
        ngay_bat_dau: { [Op.lte]: dayRange.dateStr },
        ngay_ket_thuc: { [Op.gte]: dayRange.dateStr },
      },
    });
    if (holiday) {
      console.log(`[Cron Service] Ngày ${dayRange.dateStr} là ngày nghỉ lễ: "${holiday.ten_ngay_le}". Tự động bỏ qua quét vắng mặt.`);
      try {
        const adminUser = await NguoiDung.findOne({ where: { vai_tro_chinh: 'admin' } });
        await NhatKyKiemToan.create({
          nguoi_thuc_hien_id: adminUser ? adminUser.id : null,
          loai_chu_the: 'system',
          hanh_dong: 'CRON_HOLIDAY_SKIPPED',
          doi_tuong_id: `HOLIDAY_${dayRange.dateStr}`,
          loai_doi_tuong: 'ngay_nghi_le',
          dia_chi_ip: '127.0.0.1',
          chi_tiet: {
            scannedDate: dayRange.dateStr,
            holidayName: holiday.ten_ngay_le,
            startDate: holiday.ngay_bat_dau,
            endDate: holiday.ngay_ket_thuc,
            reason: 'Ngày nghỉ lễ theo quy định - bỏ qua toàn bộ đánh vắng tự động',
          },
        });
      } catch (auditErr) {
        console.error('[Cron Service] Lỗi ghi audit log bỏ qua ngày lễ:', auditErr.message);
      }
      return {
        checkedDate: dayRange.dateStr,
        isHoliday: true,
        holidayName: holiday.ten_ngay_le,
        action: 'HOLIDAY_SKIPPED',
        message: `Ngày ${dayRange.dateStr} là ngày nghỉ lễ (${holiday.ten_ngay_le}). Đã tự động bỏ qua đánh vắng.`,
      };
    }

    const activeSchedules = await getTodayActiveSchedules(targetDate);
    console.log(`[Cron Service] Tổng số lịch cần rà soát điểm danh: ${activeSchedules.length}`);

    const results = [];
    let skippedCount = 0;
    let absentCreatedCount = 0;
    let excusedCreatedCount = 0;

    for (const schedule of activeSchedules) {
      try {
        const itemResult = await processScheduleAttendanceCheck(schedule, dayRange);
        results.push(itemResult);
        if (itemResult.action === 'SKIPPED') {
          skippedCount++;
        } else if (itemResult.action === 'CREATED') {
          if (itemResult.status === 'absent') absentCreatedCount++;
          else if (itemResult.status === 'excused_absence') excusedCreatedCount++;
        }
      } catch (err) {
        console.error(`[Cron Service] Lỗi xử lý lịch ${schedule.id}:`, err);
        results.push({
          scheduleId: schedule.id,
          action: 'ERROR',
          error: err.message,
        });
      }
    }

    const scheduledUserIds = new Set(activeSchedules.map((s) => String(s.giang_vien?.id || s.nguoi_dung_id)));
    const adminStaffResults = await processAdminStaffDailyAttendance(targetDate, dayRange, scheduledUserIds);
    for (const itemResult of adminStaffResults) {
      results.push(itemResult);
      if (itemResult.action === 'SKIPPED') skippedCount++;
      else if (itemResult.action === 'CREATED') {
        if (itemResult.status === 'absent') absentCreatedCount++;
        else if (itemResult.status === 'excused_absence') excusedCreatedCount++;
      }
    }

    const summary = {
      checkedDate: dayRange.dateStr,
      totalSchedules: activeSchedules.length,
      adminStaffScanned: adminStaffResults.length,
      absentCreatedCount,
      excusedCreatedCount,
      skippedCount,
      details: results,
    };

    // Ghi nhật ký kiểm toán tự động
    try {
      const adminUser = await NguoiDung.findOne({ where: { vai_tro_chinh: 'admin' } });
      const actorId = adminUser ? adminUser.id : null;

      await NhatKyKiemToan.create({
        nguoi_thuc_hien_id: actorId,
        loai_chu_the: 'system',
        hanh_dong: 'CRON_AUTO_ABSENT',
        doi_tuong_id: `CRON_${dayRange.dateStr}`,
        loai_doi_tuong: 'nhat_ky_cham_cong',
        dia_chi_ip: '127.0.0.1',
        chi_tiet: {
          scannedDate: dayRange.dateStr,
          totalSchedules: activeSchedules.length,
          presentCount: skippedCount,
          excusedCount: excusedCreatedCount,
          absentCount: absentCreatedCount,
          results: results.map((r) => ({
            scheduleId: r.scheduleId,
            userId: r.userId,
            teacherName: r.teacherName,
            action: r.action,
            status: r.status,
            emailSent: r.emailSent || false,
          })),
        },
      });
      console.log('[Cron Service] [AUDIT LOG] Đã ghi nhận vết thao tác tự động CRON_AUTO_ABSENT vào CSDL.');
    } catch (auditErr) {
      console.error('[Cron Service] [LỖI AUDIT LOG] Không thể ghi audit log:', auditErr.message);
    }

    // Tổng hợp số liệu và gửi email báo cáo cuối ngày cho ban giám hiệu và quản trị viên
    try {
      const todayLogs = await NhatKyChamCong.findAll({
        where: {
          [Op.or]: [
            { ngay_cong: dayRange.dateStr },
            { thoi_gian_vao: { [Op.between]: [dayRange.startOfDay, dayRange.endOfDay] } },
            { tao_luc: { [Op.between]: [dayRange.startOfDay, dayRange.endOfDay] } },
          ],
        },
        include: [
          {
            model: NguoiDung,
            as: 'nguoi_dung',
            attributes: ['id', 'ho_ten', 'email', 'don_vi_chinh_id', 'vai_tro_chinh'],
            include: [{ model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban'] }],
          },
          { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
          {
            model: LichTrinh,
            as: 'lich_trinh',
            attributes: ['id', 'phong_hoc', 'thu_trong_tuan', 'mon_hoc_id'],
            include: [{ model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon'] }],
          },
          { model: LuotQuetChamCong, as: 'luot_quet', attributes: ['phuong_thuc'], limit: 1, separate: true },
        ],
      });

      const onTimeList = [];
      const lateList = [];
      const earlyList = [];
      const absentList = [];
      const excusedList = [];

      for (const log of todayLogs) {
        const u = log.nguoi_dung || {};
        const shift = log.ca || {};
        const sched = log.lich_trinh || {};
        const methodCode = log.luot_quet?.[0]?.phuong_thuc || 'thu_cong_admin';

        const checkInTimeStr = log.thoi_gian_vao
          ? new Date(log.thoi_gian_vao).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
          : '--:--';
        const checkOutTimeStr = log.thoi_gian_ra
          ? new Date(log.thoi_gian_ra).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
          : 'Chưa về';

        const item = {
          fullName: u.ho_ten || 'Nhân sự',
          departmentName: u.don_vi_chinh?.ten_phong_ban || '',
          shiftName: shift.ten_ca || 'Ca làm việc',
          roomId: sched.phong_hoc || '',
          checkInTimeStr,
          checkOutTimeStr,
          method: methodCode === 'face_ai' ? 'Face ID' : methodCode === 'qr_code' ? 'QR Code' : 'Thủ công',
          emailSent: true,
        };

        if (log.trang_thai === 'on_time') {
          onTimeList.push(item);
        } else if (log.trang_thai === 'late') {
          let lateMins = 0;
          if (log.thoi_gian_vao && shift.gio_bat_dau) {
            const vnDate = getVietnamTime(log.thoi_gian_vao);
            const currentMins = vnDate.getHours() * 60 + vnDate.getMinutes();
            const startMins = timeStringToMinutes(shift.gio_bat_dau);
            lateMins = Math.max(0, currentMins - startMins);
          }
          const lateHours = Math.floor(lateMins / 60);
          const remMins = lateMins % 60;
          item.lateMinutes = lateMins;
          item.lateTimeFormatted = lateHours > 0 ? `${lateHours}h ${remMins}p` : `${lateMins} phút`;
          lateList.push(item);
        } else if (log.trang_thai === 'early_leave') {
          let earlyMins = 0;
          if (log.thoi_gian_ra && shift.gio_ket_thuc) {
            const vnDate = getVietnamTime(log.thoi_gian_ra);
            const checkOutMins = vnDate.getHours() * 60 + vnDate.getMinutes();
            const endMins = timeStringToMinutes(shift.gio_ket_thuc);
            earlyMins = Math.max(0, endMins - checkOutMins);
          }
          const earlyHours = Math.floor(earlyMins / 60);
          const remMins = earlyMins % 60;
          item.earlyMinutes = earlyMins;
          item.earlyTimeFormatted = earlyHours > 0 ? `${earlyHours}h ${remMins}p` : `${earlyMins} phút`;
          earlyList.push(item);
        } else if (log.trang_thai === 'thieu_check_out') {
          item.lateMinutes = 0;
          item.lateTimeFormatted = 'Thiếu Check-out';
          lateList.push(item);
        } else if (log.trang_thai === 'absent') {
          absentList.push(item);
        } else if (log.trang_thai === 'excused_absence') {
          excusedList.push(item);
        }
      }

      const activeUsersForReport = await NguoiDung.findAll({
        where: { kich_hoat: true },
        attributes: ['id', 'email', 'vai_tro_chinh'],
        include: [
          {
            model: VaiTroNguoiDung,
            as: 'danh_sach_vai_tro',
            attributes: ['ma_vai_tro', 'tu_ngay', 'den_ngay'],
          },
        ],
      });
      const recipientEmails = new Set();
      activeUsersForReport.forEach((u) => {
        if (hasAnyActiveRole(u, ['admin', 'bgh']) && isDeliverableEmail(u.email)) {
          recipientEmails.add(u.email.trim());
        }
      });
      if (isDeliverableEmail(process.env.EMAIL_USER)) recipientEmails.add(process.env.EMAIL_USER.trim());

      for (const email of recipientEmails) {
        await sendDailyAttendanceSummaryEmail({
          to: email,
          dateStr: dayRange.dateStr,
          totalSchedules: activeSchedules.length + adminStaffResults.length,
          stats: {
            onTimeCount: onTimeList.length,
            lateCount: lateList.length,
            earlyCount: earlyList.length,
            excusedCount: excusedList.length,
            absentCount: absentList.length,
          },
          absentList,
          lateList,
          earlyList,
          excusedList,
          presentList: onTimeList,
        }).catch((err) => console.error(`[Cron Service] Lỗi gửi báo cáo ngày tới ${email}:`, err.message));
      }
      console.log(`[Cron Service] [BÁO CÁO CUỐI NGÀY] Đã gửi email tổng kết chấm công tới ${recipientEmails.size} quản trị viên.`);
    } catch (reportErr) {
      console.error('[Cron Service] Lỗi khi tạo báo cáo email cuối ngày:', reportErr.message);
    }

    console.log(
      `[Cron Service] Kết thúc quét điểm danh: Tổng ${activeSchedules.length} lịch | Đánh vắng ABSENT: ${absentCreatedCount} | Nghỉ phép EXCUSED: ${excusedCreatedCount} | Bỏ qua (Đã có log): ${skippedCount}`
    );
    console.log('------------------------------------------------------------');
    return summary;
  } catch (error) {
    console.error('[Cron Service] Lỗi trong tiến trình quét điểm danh:', error);
    console.log('------------------------------------------------------------');
    throw error;
  }
};

// Quét định kỳ các ca đã kết thúc hoàn toàn trong ngày (mỗi 5 phút) — không đánh vắng sớm giữa giờ để giữ luồng check-in muộn
const scanAndMarkExpiredShiftsAbsent = async (targetDate = new Date()) => {
  try {
    const vnTime = getVietnamTime(targetDate);
    const dayRange = getVietnamDayRange(targetDate);
    const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes();

    const isMaintenance = await systemConfigService.getConfig('SYSTEM_MAINTENANCE_MODE', false);
    if (isMaintenance) return;

    const holiday = await NgayNghiLe.findOne({
      where: {
        ngay_bat_dau: { [Op.lte]: dayRange.dateStr },
        ngay_ket_thuc: { [Op.gte]: dayRange.dateStr },
      },
    });
    if (holiday) return;

    const activeSchedules = await getTodayActiveSchedules(targetDate);
    const createdResults = [];

    for (const schedule of activeSchedules) {
      try {
        const shift = schedule.ca;
        const effectiveStartTime = schedule.gio_bat_dau || shift?.gio_bat_dau;
        const effectiveEndTime = schedule.gio_ket_thuc || shift?.gio_ket_thuc;
        if (!effectiveStartTime || !effectiveEndTime) continue;

        const startMinutes = timeStringToMinutes(effectiveStartTime);
        const endMinutes = timeStringToMinutes(effectiveEndTime);
        const isOvernightShift = endMinutes < startMinutes;

        // Chỉ tự động đánh vắng sau khi ca thường trong ngày đã thực sự kết thúc (bỏ qua ca qua đêm sang ngày hôm sau)
        if (!isOvernightShift && currentMinutes > endMinutes) {
          const itemResult = await processScheduleAttendanceCheck(schedule, dayRange);
          if (itemResult?.action === 'CREATED') {
            createdResults.push(itemResult);
          }
        }
      } catch (itemErr) {
        console.error(`[Cron Service] Lỗi khi xử lý lịch ${schedule.id}:`, itemErr.message);
      }
    }

    // Chỉ ghi nhật ký kiểm toán khi thực sự phát sinh ít nhất 1 bản ghi vắng mới (tránh spam log mỗi 5 phút)
    if (createdResults.length > 0) {
      try {
        const absentCount = createdResults.filter((r) => r.status === 'absent').length;
        const excusedCount = createdResults.filter((r) => r.status === 'excused_absence').length;
        await NhatKyKiemToan.create({
          nguoi_thuc_hien_id: null,
          loai_chu_the: 'system',
          hanh_dong: 'CRON_AUTO_ABSENT',
          doi_tuong_id: `CRON_SHIFT_${dayRange.dateStr}`,
          loai_doi_tuong: 'nhat_ky_cham_cong',
          dia_chi_ip: '127.0.0.1',
          chi_tiet: {
            source: 'scan_expired_shifts',
            scannedDate: dayRange.dateStr,
            absentCount,
            excusedCount,
            results: createdResults.map((r) => ({
              scheduleId: r.scheduleId,
              userId: r.userId,
              teacherName: r.teacherName,
              shiftName: r.shiftName,
              status: r.status,
              logId: r.logId,
              emailSent: r.emailSent || false,
            })),
          },
        });
      } catch (auditErr) {
        console.error('[Cron Service] Lỗi ghi audit log đánh vắng hết ca:', auditErr.message);
      }
    }
  } catch (error) {
    console.error('[Cron Service] Lỗi trong scanAndMarkExpiredShiftsAbsent:', error.message);
  }
};

// Đánh dấu thiếu check-out cho các lượt vào ca chưa ra ca (không tự gán giờ ra hay cộng số tiết; chờ giải trình và cấp trên duyệt)
const danhDauThieuCheckOut = async (referenceDate = new Date()) => {
  const { dateStr: todayStr } = getVietnamDayRange(referenceDate);
  const openLogs = await NhatKyChamCong.findAll({
    where: {
      ngay_cong: { [Op.lte]: todayStr },
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
      da_chot: false,
      trang_thai: { [Op.ne]: 'thieu_check_out' },
    },
    include: [{ model: CaLamViec, as: 'ca' }],
  });

  let flaggedCount = 0;
  const flaggedItems = [];
  for (const log of openLogs) {
    try {
      const dayKey = String(log.ngay_cong).slice(0, 10);
      const startStr = log.ca?.gio_bat_dau ? String(log.ca.gio_bat_dau) : null;
      const endStr = log.ca?.gio_ket_thuc ? String(log.ca.gio_ket_thuc) : null;
      // Ca qua đêm của hôm nay vẫn đang diễn ra sau 23:59 nên chưa đánh dấu
      const isOvernightShift = Boolean(startStr && endStr && endStr < startStr);
      if (dayKey === todayStr && isOvernightShift) continue;

      log.trang_thai = 'thieu_check_out';
      log.thoi_luong_lam_viec_phut = 0;
      log.so_tiet_thuc_day = 0;
      log.ly_do_ghi_de = log.ly_do_ghi_de || 'Hệ thống đánh dấu thiếu Check-out cuối ngày, chờ giải trình và duyệt công';
      await log.save();
      flaggedCount += 1;
      flaggedItems.push({
        logId: log.id,
        userId: log.nguoi_dung_id,
        workDate: dayKey,
      });
    } catch (err) {
      console.error(`[Cron MissingCheckout] Không thể đánh dấu thiếu check-out log ${log.id}:`, err.message);
    }
  }

  if (flaggedCount > 0) {
    try {
      await NhatKyKiemToan.create({
        nguoi_thuc_hien_id: null,
        loai_chu_the: 'system',
        hanh_dong: 'CRON_MISSING_CHECKOUT',
        doi_tuong_id: `CRON_CHECKOUT_${todayStr}`,
        loai_doi_tuong: 'nhat_ky_cham_cong',
        dia_chi_ip: '127.0.0.1',
        chi_tiet: {
          scannedDate: todayStr,
          flaggedCount,
          items: flaggedItems,
        },
      });
    } catch (auditErr) {
      console.error('[Cron MissingCheckout] Lỗi ghi audit log thiếu check-out:', auditErr.message);
    }
  }

  return { flaggedCount };
};

// Dọn dẹp ảnh minh chứng và nhật ký chấm công hết hạn lưu trữ
const cleanupExpiredRetentionData = async (referenceDate = new Date()) => {
  const fs = require('fs');
  const path = require('path');
  const { removeAttendanceEvidence } = require('../../utils/anhMinhChungChamCong');

  const photoRetentionYears = Math.max(1, Number(await systemConfigService.getConfig('RETENTION_ANH_NAM', 1)) || 1);
  const metadataRetentionYears = Math.max(
    photoRetentionYears,
    Number(await systemConfigService.getConfig('RETENTION_METADATA_NAM', 5)) || 5
  );

  const photoCutoff = new Date(referenceDate);
  photoCutoff.setFullYear(photoCutoff.getFullYear() - photoRetentionYears);

  const expiredPunches = await LuotQuetChamCong.findAll({
    where: {
      thoi_gian_quet: { [Op.lt]: photoCutoff },
      anh_minh_chung: { [Op.ne]: null },
    },
    attributes: ['id', 'anh_minh_chung'],
    limit: 500,
  });

  const localRoots = [
    path.resolve(process.cwd(), 'uploads'),
    process.env.ATTENDANCE_EVIDENCE_DIR ? path.resolve(process.env.ATTENDANCE_EVIDENCE_DIR) : null,
    process.env.STORAGE_LOCAL_DIR ? path.resolve(process.env.STORAGE_LOCAL_DIR) : null,
  ].filter(Boolean);

  let clearedPhotosCount = 0;

  for (const punch of expiredPunches) {
    const rawPath = String(punch.anh_minh_chung || '');
    const fileName = path.basename(rawPath.split('?')[0]);
    if (fileName && !rawPath.includes('..')) {
      await removeAttendanceEvidence(fileName).catch(() => {});
      for (const rootDir of localRoots) {
        for (const candidate of [
          path.join(rootDir, fileName),
          path.join(rootDir, 'evidence', fileName),
          path.join(rootDir, 'faces', fileName),
        ]) {
          if ((candidate === rootDir || candidate.startsWith(rootDir + path.sep)) && fs.existsSync(candidate)) {
            try {
              fs.unlinkSync(candidate);
            } catch (_) {}
          }
        }
      }
    }
    punch.anh_minh_chung = null;
    await punch.save();
    clearedPhotosCount += 1;
  }

  if (clearedPhotosCount > 0) {
    try {
      const { dateStr } = getVietnamDayRange(referenceDate);
      await NhatKyKiemToan.create({
        nguoi_thuc_hien_id: null,
        loai_chu_the: 'system',
        hanh_dong: 'CRON_RETENTION_CLEANUP',
        doi_tuong_id: `CRON_RETENTION_${dateStr}`,
        loai_doi_tuong: 'nhat_ky_cham_cong',
        dia_chi_ip: '127.0.0.1',
        chi_tiet: {
          scannedDate: dateStr,
          clearedPhotosCount,
          photoRetentionYears,
          metadataRetentionYears,
        },
      });
    } catch (auditErr) {
      console.error('[Cron Retention] Lỗi ghi audit log dọn dữ liệu hết hạn:', auditErr.message);
    }
  }

  // Sổ cái kiểm toán NhatKyKiemToan được bảo toàn bất biến (chuỗi băm SHA-256), không xóa tự động.
  return {
    clearedPhotosCount,
    purgedAuditCount: 0,
    auditLedgerPreserved: true,
    photoRetentionYears,
    metadataRetentionYears,
  };
};

// Khởi tạo toàn bộ tác vụ chạy định kỳ của hệ thống
const initCronJobs = () => {
  if (!cron) {
    console.warn('[Cron Service] Bỏ qua initCronJobs vì node-cron không khả dụng.');
    return;
  }

  setTimeout(async () => {
    try {
      await withDistributedLock(
        'cron_startup_scan',
        60,
        async () => {
          const todayStr = getVietnamDayRange().dateStr;
          const deletedCount = await NhatKyChamCong.destroy({
            where: {
              trang_thai: { [Op.in]: ['absent', 'excused_absence'] },
              thoi_gian_vao: null,
              don_tu_id: null,
              ngay_cong: { [Op.gt]: todayStr },
            },
          });
          if (deletedCount > 0) {
            console.log(
              `[Cron Service] Đã tự động dọn dẹp ${deletedCount} bản ghi vắng mặt tương lai bị tạo nhầm do lỗi lệch múi giờ.`
            );
          }

          console.log('[Cron Service] Tự động kích hoạt lượt quét kiểm tra ca quá hạn ngay sau khi khởi động máy chủ...');
          await scanAndMarkExpiredShiftsAbsent();
        },
        { logPrefix: '[Cron Startup Lock]' }
      );
    } catch (e) {
      console.error('[Cron Service] Lỗi quét khởi động máy chủ:', e.message);
    }
  }, 2000);

  scheduledCronTasks.push(
    cron.schedule(
      '*/5 * * * *',
      async () => {
        await withDistributedLock(
          'cron_periodic_scan',
          240,
          async () => {
            await scanAndMarkExpiredShiftsAbsent();
          },
          { logPrefix: '[Cron Job 5m Lock]' }
        );
      },
      { scheduled: true, timezone: 'Asia/Ho_Chi_Minh' }
    )
  );

  scheduledCronTasks.push(
    cron.schedule(
      '59 23 * * *',
      async () => {
        await withDistributedLock(
          'cron_daily_absent_check',
          600,
          async () => {
            console.log(`[Cron Job] Kích hoạt tác vụ quét vắng mặt tự động lúc 23:59 (${new Date().toISOString()})`);
            await danhDauThieuCheckOut();
            await runDailyAbsentCheck();
            await cleanupExpiredRetentionData();
            await systemConfigService
              .updateConfig('CRON_LAST_RUN', {
                thoi_gian_chay: new Date().toISOString(),
                trang_thai: 'thanh_cong',
              })
              .catch((err) => console.warn('[Cron Service] Không thể cập nhật CRON_LAST_RUN:', err.message));
          },
          { logPrefix: '[Cron Job 23:59 Lock]' }
        );
      },
      { scheduled: true, timezone: 'Asia/Ho_Chi_Minh' }
    )
  );

  console.log(
    '[Cron Service] Đã kích hoạt tiến trình nền kiểm tra vắng mặt tự động kèm Khóa Phân Tán (quét mỗi 5 phút & chốt 23:59 hàng ngày, Asia/Ho_Chi_Minh).'
  );
};

// Dừng toàn bộ tiến trình node-cron khi tắt máy chủ
const stopCronJobs = () => {
  for (const task of scheduledCronTasks) {
    try {
      task?.stop?.();
    } catch (_) {}
  }
  scheduledCronTasks.length = 0;
};

module.exports = {
  getTodayActiveSchedules,
  processAdminStaffDailyAttendance,
  runDailyAbsentCheck,
  processScheduleAttendanceCheck,
  scanAndMarkExpiredShiftsAbsent,
  danhDauThieuCheckOut,
  cleanupExpiredRetentionData,
  initCronJobs,
  stopCronJobs,
};
