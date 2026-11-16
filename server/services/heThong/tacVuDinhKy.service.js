/**
 * Chạy các tác vụ định kỳ xử lý lịch, ghi nhận vắng mặt và gửi báo cáo chấm công.
 * Chuẩn hóa Sequelize + SQL Server 3NF.
 */
const { Op } = require('sequelize');

let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('[Cron Service] Thư viện node-cron chưa được tải:', err.message);
}

const {
  LichTrinh,
  LichTrinhTuan,
  NgoaiLeLichTrinh,
  NhatKyChamCong,
  LuotQuetChamCong,
  DonNghiPhep,
  NhatKyKiemToan,
  NguoiDung,
  PhongBan,
  CaLamViec,
  MonHoc,
  HoSoCanBo,
  NgayNghiLe,
} = require('../../models');
const systemConfigService = require('./cauHinhHeThong.service');
const { sendAbsentWarningEmail, sendDailyAttendanceSummaryEmail } = require('./guiEmail.service');
const { getVietnamTime, getVietnamDayRange, timeStringToMinutes, calculateActualTeachingPeriods } = require('../../utils/thoiGianChamCong.utils');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');

/**
 * Kiểm tra xem email có thể gửi thư thực tế qua Internet không
 */
const isDeliverableEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (lower.endsWith('@university.edu.vn') || lower.endsWith('@example.com')) return false;
  return lower.includes('@') && lower.includes('.');
};

/**
 * Lấy toàn bộ lịch phân công giảng dạy có hiệu lực trong ngày
 */
const getTodayActiveSchedules = async (targetDate = new Date()) => {
  try {
    const vnTime = getVietnamTime(targetDate);
    const currentWeekday = vnTime.getDay();
    const { dateStr } = getVietnamDayRange(targetDate);

    const scheduleIncludes = [
      { model: NguoiDung, as: 'giang_vien', attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id'] },
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
      { model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon', 'so_tin_chi', 'phong_ban_id'] },
      { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
      { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
    ];

    const [schedules, makeupExceptions] = await Promise.all([
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
        ],
      }),
    ]);

    const seenIds = new Set(schedules.map((s) => String(s.id)));
    const combined = [...schedules];
    for (const ex of makeupExceptions) {
      if (ex.lich_trinh && !seenIds.has(String(ex.lich_trinh.id))) {
        seenIds.add(String(ex.lich_trinh.id));
        combined.push(ex.lich_trinh);
      }
    }

    return combined.filter((sch) => isScheduleActiveOnDate(sch, vnTime));
  } catch (error) {
    console.error('[Cron Service] Lỗi khi truy vấn getTodayActiveSchedules:', error);
    throw error;
  }
};

/**
 * Xử lý đối chiếu điểm danh và tạo bản ghi vắng mặt (ABSENT) cho một ca dạy
 */
const processScheduleAttendanceCheck = async (schedule, dayRange) => {
  const { startOfDay, endOfDay, dateStr } = dayRange;
  const userId = schedule.giang_vien?.id || schedule.nguoi_dung_id;
  const shiftId = schedule.ca?.id || schedule.ca_id;
  const teacherName = schedule.giang_vien?.ho_ten || userId;
  const shiftName = schedule.ca?.ten_ca || shiftId;

  // 1. Kiểm tra đối chiếu xem giảng viên đã có bản ghi chấm công nào hôm nay cho ca/lịch này chưa
  const existingLog = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id: userId,
      ca_id: shiftId,
      [Op.or]: [
        { ngay_cong: dateStr },
        { thoi_gian_vao: { [Op.between]: [startOfDay, endOfDay] } },
        { tao_luc: { [Op.between]: [startOfDay, endOfDay] } },
      ],
    },
  });

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

  // 2. Kiểm tra xem giảng viên có đơn xin nghỉ phép đã được phê duyệt trong ngày hôm nay không
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

  // 3. Cơ chế Idempotent: Tạo bản ghi trong NhatKyChamCong
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

  // 4. Gửi email cảnh báo vắng mặt không phép
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

const processAdminStaffDailyAttendance = async (targetDate, dayRange, scheduledUserIds = new Set()) => {
  const vnTime = getVietnamTime(targetDate);
  const weekday = vnTime.getDay();
  // Khối hành chính làm việc từ Thứ 2 đến Thứ 6
  if (weekday < 1 || weekday > 5) {
    return [];
  }

  const defaultShift =
    (await CaLamViec.findOne({ where: { kich_hoat: true }, order: [['gio_bat_dau', 'ASC']] })) ||
    (await CaLamViec.findOne({ order: [['gio_bat_dau', 'ASC']] }));
  if (!defaultShift) return [];

  const staffUsers = await NguoiDung.findAll({
    where: {
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: {
        [Op.notIn]: ['admin', 'bgh', 'giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'],
      },
    },
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh'],
    include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['loai_nhan_su'] }],
  });

  const results = [];
  for (const staff of staffUsers) {
    if (scheduledUserIds.has(String(staff.id))) continue;
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

/**
 * Tiến trình kiểm tra vắng mặt hàng ngày (quét tự động vào cuối ngày 23:59)
 */
const runDailyAbsentCheck = async (targetDate = new Date()) => {
  console.log('------------------------------------------------------------');
  console.log('[Cron Service] Bắt đầu tiến trình tự động quét điểm danh cuối ngày...');
  try {
    const dayRange = getVietnamDayRange(targetDate);

    // 0.1. Kiểm tra chế độ bảo trì hệ thống
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

    // 0.2. Kiểm tra ngày nghỉ lễ (NgayNghiLe)
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

    // 5. Ghi nhận tự động vào nhat_ky_kiem_toan
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

    // 6. Tổng hợp chi tiết và tự động gửi Email Báo Cáo Cuối Ngày tới Ban Giám Hiệu & Quản Trị Viên
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
          { model: LuotQuetChamCong, as: 'luot_quet', attributes: ['phuong_thuc'], limit: 1 },
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
        } else if (log.trang_thai === 'absent') {
          absentList.push(item);
        } else if (log.trang_thai === 'excused_absence') {
          excusedList.push(item);
        }
      }

      const adminUsers = await NguoiDung.findAll({
        where: { vai_tro_chinh: 'admin', kich_hoat: true },
        attributes: ['id', 'email'],
      });
      const recipientEmails = new Set();
      adminUsers.forEach((a) => {
        if (isDeliverableEmail(a.email)) recipientEmails.add(a.email.trim());
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

/**
 * Quét định kỳ trong ngày (mỗi 5 phút)
 */
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

    const defaultLateThreshold = await systemConfigService.getConfig('DEFAULT_LATE_THRESHOLD_MINUTES', 15);
    const activeSchedules = await getTodayActiveSchedules(targetDate);

    for (const schedule of activeSchedules) {
      try {
        const shift = schedule.ca;
        const effectiveStartTime = schedule.gio_bat_dau || shift?.gio_bat_dau;
        if (!effectiveStartTime) continue;

        const startMinutes = timeStringToMinutes(effectiveStartTime);
        const lateThreshold =
          shift?.nguong_di_muon_phut !== undefined ? shift.nguong_di_muon_phut : defaultLateThreshold;

        if (currentMinutes > startMinutes + lateThreshold) {
          await processScheduleAttendanceCheck(schedule, dayRange);
        }
      } catch (itemErr) {
        console.error(`[Cron Service] Lỗi khi xử lý lịch ${schedule.id}:`, itemErr.message);
      }
    }
  } catch (error) {
    console.error('[Cron Service] Lỗi trong scanAndMarkExpiredShiftsAbsent:', error.message);
  }
};

/**
 * Tự động đóng các lượt quên Check-out từ các ngày trước (tránh treo ca mở sang ngày mới).
 */
const closeForgottenOpenCheckouts = async (referenceDate = new Date()) => {
  const { dateStr: todayStr } = getVietnamDayRange(referenceDate);
  const openLogs = await NhatKyChamCong.findAll({
    where: {
      ngay_cong: { [Op.lt]: todayStr },
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
      da_chot: false,
    },
    include: [{ model: CaLamViec, as: 'ca' }],
  });

  let closedCount = 0;
  for (const log of openLogs) {
    try {
      const checkInAt = new Date(log.thoi_gian_vao);
      const dayKey = String(log.ngay_cong).slice(0, 10);
      let autoCloseAt = null;
      if (log.ca?.gio_ket_thuc) {
        const candidateEnd = new Date(`${dayKey}T${String(log.ca.gio_ket_thuc).slice(0, 5)}:00+07:00`);
        if (!Number.isNaN(candidateEnd.getTime()) && candidateEnd >= checkInAt) {
          autoCloseAt = candidateEnd;
        }
      }
      if (!autoCloseAt) {
        const endOfDayCap = new Date(`${dayKey}T23:59:00+07:00`);
        const plus4h = new Date(checkInAt.getTime() + 4 * 60 * 60 * 1000);
        autoCloseAt = plus4h <= endOfDayCap ? plus4h : endOfDayCap;
      }

      const workingMinutes = Math.max(0, Math.round((autoCloseAt.getTime() - checkInAt.getTime()) / 60000));
      const soTiet = await calculateActualTeachingPeriods(
        { lichTrinhId: log.lich_trinh_id, workingMinutes, earlyMinutes: 0 },
        LichTrinh
      );

      log.thoi_gian_ra = autoCloseAt;
      log.thoi_luong_lam_viec_phut = workingMinutes;
      log.so_tiet_thuc_day = soTiet;
      log.ly_do_ghi_de = log.ly_do_ghi_de || 'Hệ thống tự động đóng ca cuối ngày do quên Check-out';
      await log.save();
      closedCount += 1;
    } catch (err) {
      console.error(`[Cron AutoClose] Không thể tự động đóng ca log ${log.id}:`, err.message);
    }
  }

  return { closedCount };
};

/**
 * Dọn dẹp ảnh minh chứng & dữ liệu hết hạn lưu trữ theo cấu hình RETENTION_ANH_NAM / RETENTION_METADATA_NAM.
 */
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
          if (candidate.startsWith(rootDir) && fs.existsSync(candidate)) {
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

  // Sổ cái kiểm toán NhatKyKiemToan được bảo toàn bất biến (chuỗi băm SHA-256), không xóa tự động.
  return {
    clearedPhotosCount,
    purgedAuditCount: 0,
    auditLedgerPreserved: true,
    photoRetentionYears,
    metadataRetentionYears,
  };
};

/**
 * Khởi tạo toàn bộ các cron job chạy nền của hệ thống
 */
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
  );

  cron.schedule(
    '59 23 * * *',
    async () => {
      await withDistributedLock(
        'cron_daily_absent_check',
        600,
        async () => {
          console.log(`[Cron Job] Kích hoạt tác vụ quét vắng mặt tự động lúc 23:59 (${new Date().toISOString()})`);
          await closeForgottenOpenCheckouts();
          await runDailyAbsentCheck();
          await cleanupExpiredRetentionData();
        },
        { logPrefix: '[Cron Job 23:59 Lock]' }
      );
    },
    { scheduled: true, timezone: 'Asia/Ho_Chi_Minh' }
  );

  console.log(
    '[Cron Service] Đã kích hoạt tiến trình nền kiểm tra vắng mặt tự động kèm Khóa Phân Tán (quét mỗi 5 phút & chốt 23:59 hàng ngày, Asia/Ho_Chi_Minh).'
  );
};

module.exports = {
  getTodayActiveSchedules,
  runDailyAbsentCheck,
  processScheduleAttendanceCheck,
  scanAndMarkExpiredShiftsAbsent,
  closeForgottenOpenCheckouts,
  cleanupExpiredRetentionData,
  initCronJobs,
};
