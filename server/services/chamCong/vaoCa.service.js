// Xử lý điểm danh vào ca (Check-in) kèm đối soát lịch/ca trực và xác thực vị trí GPS
const { Op } = require('sequelize');
const { NhatKyChamCong, LuotQuetChamCong, CaLamViec, NguoiDung, LichTrinh } = require('../../models');
const { sendCheckInNotificationEmail } = require('../heThong/guiEmail.service');
const { validateGeofence, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const {
  ServiceError,
  normalizeAttendanceMethod,
  getVietnamTime,
  getVietnamDayRange,
  calculateAttendanceStatus,
} = require('../../utils/thoiGianChamCong.utils');
const { evaluateUserScheduleForCheckIn } = require('./dieuKienLichChamCong.service');

// Xử lý chấm công vào ca, đối chiếu ca/lịch làm việc và xác thực vị trí GPS
const performCheckIn = async ({
  nguoi_dung_id,
  ca_id,
  lich_trinh_id,
  thiet_bi_id = 'MOBILE_APP',
  vi_do,
  kinh_do,
  do_chinh_xac = null,
  phuong_thuc = 'gps_mobile',
  dia_chi_ip = null,
  allowManual = false,
}) => {
  if (!nguoi_dung_id || !isValidUuid(String(nguoi_dung_id))) {
    throw new ServiceError('Thiếu hoặc sai định dạng thông tin người dùng (nguoi_dung_id).', 400);
  }

  const rawMethod = normalizeAttendanceMethod(phuong_thuc);
  if (rawMethod === 'thu_cong_admin' && !allowManual) {
    throw new ServiceError(
      'Phương thức điểm danh thủ công đã bị vô hiệu hóa đối với tài khoản này. Vui lòng bật định vị GPS, Quét mã QR hoặc Nhận diện khuôn mặt Face ID.',
      403,
      'MANUAL_ATTENDANCE_DISABLED'
    );
  }
  if (!allowManual && rawMethod !== 'gps_mobile') {
    throw new ServiceError(
      'Phương thức chấm công không hợp lệ cho luồng vào ca GPS.',
      400,
      'INVALID_ATTENDANCE_METHOD'
    );
  }
  const finalMethod = allowManual && rawMethod === 'thu_cong_admin' ? 'thu_cong_admin' : 'gps_mobile';

  const lat = vi_do !== undefined && vi_do !== null && vi_do !== '' ? Number(vi_do) : null;
  const lng = kinh_do !== undefined && kinh_do !== null && kinh_do !== '' ? Number(kinh_do) : null;
  const acc = do_chinh_xac !== undefined && do_chinh_xac !== null && do_chinh_xac !== '' ? Number(do_chinh_xac) : null;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  const now = new Date();
  const nowVN = getVietnamTime(now);
  const { dateStr } = getVietnamDayRange(now);

  let effectiveShift = null;
  let calculatedStatus = 'on_time';
  let lateMinutes = 0;
  let resolvedScheduleId = lich_trinh_id || null;
  let khoi = null;

  if (allowManual && ca_id && isValidUuid(String(ca_id))) {
    effectiveShift = await CaLamViec.findByPk(ca_id);
    if (effectiveShift) {
      const statusResult = calculateAttendanceStatus(now, effectiveShift);
      calculatedStatus = typeof statusResult === 'object' ? (statusResult.status || 'on_time') : (statusResult || 'on_time');
      if (typeof statusResult === 'object' && statusResult.lateMinutes !== undefined) {
        lateMinutes = statusResult.lateMinutes;
      } else if (calculatedStatus === 'late' && effectiveShift.gio_bat_dau) {
        const [h, m] = effectiveShift.gio_bat_dau.split(':').map(Number);
        lateMinutes = Math.max(0, (nowVN.getHours() * 60 + nowVN.getMinutes()) - (h * 60 + m));
      }
    }
  }

  if (!effectiveShift) {
    const evalResult = await evaluateUserScheduleForCheckIn(nguoi_dung_id, ca_id);
    if (!evalResult || !evalResult.canCheckIn) {
      throw new ServiceError(
        evalResult?.message || 'Hôm nay bạn không có lịch phân công làm việc hoặc giảng dạy trên hệ thống. Không thể thực hiện chấm công.',
        400,
        evalResult?.status || 'NO_SCHEDULE'
      );
    }
    effectiveShift = evalResult.shift;
    resolvedScheduleId = evalResult.selectedSchedule?.id || resolvedScheduleId;
    khoi = evalResult.khoi || null;
    calculatedStatus = evalResult.status || 'on_time';
    lateMinutes = evalResult.lateMinutes || 0;
  }

  if (!effectiveShift) {
    effectiveShift = (await CaLamViec.findOne({ where: { kich_hoat: true } })) || (await CaLamViec.findOne());
  }

  let isFraud = false;
  let fraudReason = null;
  let geofenceMeta = null;

  // A2: Lịch trực tuyến → bỏ qua kiểm tra bắt buộc GPS & geofence
  let isOnlineSchedule = false;
  if (resolvedScheduleId) {
    const scheduleForOnlineCheck = await LichTrinh.findByPk(resolvedScheduleId, { attributes: ['id', 'la_truc_tuyen'] });
    isOnlineSchedule = Boolean(scheduleForOnlineCheck?.la_truc_tuyen);
  }

  if (!isOnlineSchedule) {
    if (!allowManual && !hasCoordinates) {
      throw new ServiceError(
        'Chấm công vào ca bắt buộc phải gửi tọa độ GPS hợp lệ.',
        400,
        'ATTENDANCE_GPS_REQUIRED'
      );
    }
    if ((finalMethod === 'gps_mobile' || hasCoordinates) && acc !== null && Number.isFinite(acc) && acc > 150) {
      throw new ServiceError(
        `Độ chính xác GPS không đủ tin cậy (sai số ${acc}m vượt ngưỡng cho phép <= 150m). Vui lòng di chuyển ra nơi thoáng.`,
        400,
        'GPS_ACCURACY_UNRELIABLE',
        { accuracy: acc }
      );
    }
    if ((finalMethod === 'gps_mobile' || hasCoordinates) && hasCoordinates) {
      const geoTargets = await resolveUserGeofenceTargets(nguoi_dung_id, resolvedScheduleId);
      const geofenceResult = validateGeofence({ lat, lng, accuracy: acc }, geoTargets, null, dia_chi_ip);
      geofenceMeta = geofenceResult;
      if (!geofenceResult.valid) {
        isFraud = true;
        fraudReason = geofenceResult.fraudReason || `Tọa độ GPS nằm ngoài bán kính cho phép (${Math.round(geofenceResult.distance)}m so với tâm trường).`;
      }
    }
  }

  const finalShiftId = effectiveShift?.id || ca_id;

  const whereExisting = {
    nguoi_dung_id,
    ngay_cong: dateStr,
    ...(resolvedScheduleId ? { lich_trinh_id: resolvedScheduleId } : finalShiftId ? { ca_id: finalShiftId, lich_trinh_id: null } : {}),
  };

  let attendance = await NhatKyChamCong.findOne({ where: whereExisting });

  if (attendance && attendance.da_chot) {
    throw new ServiceError(
      'Dữ liệu chấm công ngày này đã bị khóa sổ lương, không thể check-in bổ sung.',
      409,
      'ATTENDANCE_LOCKED'
    );
  }

  if (attendance && attendance.thoi_gian_vao) {
    throw new ServiceError(
      'Bạn đã thực hiện check-in cho ca làm việc này hôm nay rồi.',
      400,
      'ATTENDANCE_ALREADY_CHECKED_IN',
      { thoi_gian_vao: attendance.thoi_gian_vao }
    );
  }

  const openAttendances = await NhatKyChamCong.findAll({
    where: {
      nguoi_dung_id,
      ngay_cong: dateStr,
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
      trang_thai: { [Op.ne]: 'thieu_check_out' },
    },
  });
  // Khối giảng dạy trước chưa check-out mà đã check-in khối sau thì khối trước chuyển thành thiếu check-out.
  // Ca hành chính chạy song song với các khối giảng dạy nên được giữ nguyên.
  const staleOpenAttendances = [];
  for (const open of openAttendances) {
    const isTeachingOpen = Boolean(open.lich_trinh_id);
    const isTeachingNew = Boolean(resolvedScheduleId);
    if (isTeachingOpen && isTeachingNew) {
      const sameBlock =
        String(open.lich_trinh_id) === String(resolvedScheduleId) ||
        Boolean(khoi && khoi.ds_lich_trinh_id.includes(String(open.lich_trinh_id)));
      if (!sameBlock) {
        staleOpenAttendances.push(open);
        continue;
      }
    } else if (!isTeachingOpen && isTeachingNew) {
      continue;
    }
    throw new ServiceError(
      'Bạn đang có một ca làm việc chưa hoàn thành tan ca. Vui lòng check-out trước khi bắt đầu ca làm việc mới.',
      400,
      'ATTENDANCE_ALREADY_CHECKED_IN',
      { thoi_gian_vao: open.thoi_gian_vao }
    );
  }

  let punchLog = null;
  await runInTransaction(async (transaction) => {
    for (const stale of staleOpenAttendances) {
      stale.trang_thai = 'thieu_check_out';
      await stale.save({ transaction });
    }

    if (!attendance) {
      attendance = await NhatKyChamCong.create(
        {
          nguoi_dung_id,
          ca_id: finalShiftId,
          lich_trinh_id: resolvedScheduleId,
          ds_lich_trinh_id: khoi ? khoi.ds_lich_trinh_id : null,
          ngay_cong: dateStr,
          thoi_gian_vao: now,
          trang_thai: calculatedStatus,
          di_muon_phut: lateMinutes,
          co_gian_lan: isFraud,
        },
        { transaction }
      );
    } else {
      attendance.thoi_gian_vao = now;
      attendance.ca_id = finalShiftId;
      if (resolvedScheduleId) attendance.lich_trinh_id = resolvedScheduleId;
      if (khoi) attendance.ds_lich_trinh_id = khoi.ds_lich_trinh_id;
      attendance.trang_thai = calculatedStatus;
      attendance.di_muon_phut = lateMinutes;
      if (isFraud) attendance.co_gian_lan = true;
      await attendance.save({ transaction });
    }

    punchLog = await LuotQuetChamCong.create(
      {
        cham_cong_id: attendance.id,
        nguoi_dung_id,
        loai_quet: 'check_in',
        thoi_gian_quet: now,
        phuong_thuc: finalMethod,
        vi_do: hasCoordinates ? lat : null,
        kinh_do: hasCoordinates ? lng : null,
        do_chinh_xac_gps: hasCoordinates ? acc : null,
        vi_tri_gia_lap: Boolean(geofenceMeta?.isSuspicious),
        khoang_cach_met: Number.isFinite(geofenceMeta?.distance) ? Math.round(geofenceMeta.distance) : null,
        hop_le: !isFraud,
        ly_do_khong_hop_le: fraudReason,
        ma_thiet_bi: thiet_bi_id,
      },
      { transaction }
    );
  });

  const attendanceOwner = await NguoiDung.findByPk(nguoi_dung_id, {
    attributes: ['email', 'ho_ten', 'don_vi_chinh_id'],
  }).catch(() => null);

  if (attendanceOwner && attendanceOwner.email) {
    sendCheckInNotificationEmail({
      to: attendanceOwner.email,
      fullName: attendanceOwner.ho_ten || 'Cán bộ',
      checkInTime: now,
      status: calculatedStatus,
      lateMinutes,
      method: finalMethod,
    }).catch(() => {});
  }

  try {
    const { emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
    emitAttendanceUpdate({
      ...(attendance.toJSON ? attendance.toJSON() : attendance),
      don_vi_chinh_id: attendanceOwner?.don_vi_chinh_id || null,
    });
    if (isFraud) {
      emitFraudAlert({
        type: 'GEOFENCE_CHECK_IN_ALERT',
        message: fraudReason || 'Cảnh báo vị trí check-in ngoài phạm vi trường.',
        details: { userId: nguoi_dung_id, attendanceId: attendance.id },
      });
    }
  } catch (_) {}

  return {
    success: true,
    message: isFraud ? `Check-in thành công có cảnh báo: ${fraudReason}` : 'Check-in chấm công thành công.',
    attendanceLog: attendance,
    punchLog,
    trang_thai: calculatedStatus,
    so_phut_di_muon: lateMinutes,
    co_gian_lan: isFraud,
    ly_do_gian_lan: fraudReason,
  };
};

module.exports = { performCheckIn };
