// Xử lý quét mã QR động điểm danh (Check-in / Check-out) kèm xác thực vị trí GPS và lưu SQL Server 3NF
const { Op } = require('sequelize');
const { NhatKyChamCong, LuotQuetChamCong, LichTrinh, CaLamViec } = require('../../models');
const { validateGeofence, verifyDynamicQRCode, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { redisGet, redisSet } = require('../../config/redis');
const {
  ServiceError,
  calculateActualTeachingPeriods,
  getVietnamTime,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/thoiGianChamCong.utils');
const { evaluateUserScheduleForCheckIn } = require('./dieuKienLichChamCong.service');

// Xử lý quét mã QR động cho cả Check-in và Check-out
const processScanQRCode = async ({
  nguoi_dung_id,
  qrToken,
  vi_do,
  kinh_do,
  do_chinh_xac = null,
  thiet_bi_id = 'MOBILE_APP_QR',
  dia_chi_ip = null,
}) => {
  if (!nguoi_dung_id || !isValidUuid(String(nguoi_dung_id))) {
    throw new ServiceError('Thiếu hoặc sai định dạng thông tin người dùng (nguoi_dung_id).', 400);
  }

  if (!qrToken) {
    throw new ServiceError('Mã qrToken là bắt buộc.', 400);
  }

  // 1. Xác minh tính hợp lệ và thời hạn của Dynamic QR Token
  const verifyResult = verifyDynamicQRCode(qrToken);
  if (!verifyResult.valid) {
    throw new ServiceError(verifyResult.message || 'Mã QR không hợp lệ hoặc đã hết hạn.', 400);
  }

  // Chống replay cùng một nonce QR cho cùng tài khoản
  const qrNonce = verifyResult.data?.nonce;
  if (qrNonce) {
    const replayKey = `qr_replay:${qrNonce}:${nguoi_dung_id}`;
    const alreadyUsed = await redisGet(replayKey);
    if (alreadyUsed) {
      throw new ServiceError(
        'Mã QR này đã được bạn sử dụng. Vui lòng đợi mã QR mới trên màn hình!',
        409,
        'QR_REPLAY_DETECTED'
      );
    }
    await redisSet(replayKey, '1', 45);
  }

  const lat = vi_do !== undefined ? vi_do : null;
  const lng = kinh_do !== undefined ? kinh_do : null;
  const acc = do_chinh_xac !== undefined ? do_chinh_xac : null;

  // 2. Bắt buộc kiểm tra GPS chống gian lận quét QR từ xa
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    throw new ServiceError(
      'Điểm danh bằng mã QR bắt buộc phải bật định vị GPS để xác thực bạn đang có mặt tại trường.',
      400,
      'ATTENDANCE_GPS_REQUIRED'
    );
  }

  const now = new Date();
  const { dateStr } = getVietnamDayRange(now);
  const yesterdayStr = getVietnamDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000)).dateStr;
  const overnightCutoff = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  // 2. Tra cứu bản ghi chấm công đang mở (hỗ trợ cả ca qua đêm)
  let attendance = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id,
      ngay_cong: dateStr,
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
    },
    include: [{ model: CaLamViec, as: 'ca' }],
    order: [['tao_luc', 'DESC']],
  });

  if (!attendance) {
    attendance = await NhatKyChamCong.findOne({
      where: {
        nguoi_dung_id,
        ngay_cong: { [Op.in]: [dateStr, yesterdayStr] },
        thoi_gian_vao: { [Op.gte]: overnightCutoff },
        thoi_gian_ra: null,
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  let evalResult = null;
  if (!attendance || !attendance.thoi_gian_vao) {
    evalResult = await evaluateUserScheduleForCheckIn(nguoi_dung_id);
    if (!evalResult || !evalResult.canCheckIn) {
      throw new ServiceError(
        evalResult?.message ||
          'Hôm nay bạn không có lịch phân công làm việc hoặc giảng dạy trên hệ thống. Không thể thực hiện chấm công.',
        400,
        evalResult?.status || 'NO_SCHEDULE'
      );
    }
  } else if (attendance.da_chot) {
    throw new ServiceError(
      'Bản ghi chấm công đã bị khóa sổ lương, không thể check-out hoặc chỉnh sửa.',
      409,
      'ATTENDANCE_LOCKED'
    );
  }

  // 3. Bắt buộc kiểm tra GPS chống gian lận quét QR từ xa (ưu tiên tọa độ phòng học nếu có lịch)
  let isFraud = false;
  let fraudReason = null;
  const targetScheduleId = attendance?.lich_trinh_id || evalResult?.selectedSchedule?.id || null;
  const geoTargets = await resolveUserGeofenceTargets(nguoi_dung_id, targetScheduleId);
  const geofenceResult = validateGeofence({ lat, lng, accuracy: acc }, geoTargets, null, dia_chi_ip);
  if (!geofenceResult.valid) {
    isFraud = true;
    fraudReason =
      geofenceResult.fraudReason ||
      `Quét mã QR nhưng GPS nằm ngoài khuôn viên trường (${Math.round(geofenceResult.distance || 0)}m).`;
  }

  // TRƯỜNG HỢP 1: CHƯA CHECK-IN -> THỰC HIỆN CHECK-IN BẰNG QR
  if (!attendance || !attendance.thoi_gian_vao) {
    const effectiveShift = evalResult.shift;
    const effectiveCaId = effectiveShift?.id || null;
    if (!effectiveCaId) {
      throw new ServiceError('Không xác định được ca làm việc hợp lệ để chấm công.', 400, 'SHIFT_NOT_FOUND');
    }

    const resolvedScheduleId = evalResult.selectedSchedule?.id || null;
    const calculatedStatus = evalResult.status || 'on_time';
    const lateMinutes = evalResult.lateMinutes || 0;

    const { savedAttendance, punchLog } = await runInTransaction(async (transaction) => {
      let targetAttendance = attendance;
      if (!targetAttendance) {
        targetAttendance = await NhatKyChamCong.create(
          {
            nguoi_dung_id,
            ca_id: effectiveCaId,
            lich_trinh_id: resolvedScheduleId,
            ngay_cong: dateStr,
            thoi_gian_vao: now,
            trang_thai: calculatedStatus,
            di_muon_phut: lateMinutes,
            co_gian_lan: isFraud,
          },
          { transaction }
        );
      } else {
        targetAttendance.thoi_gian_vao = now;
        targetAttendance.trang_thai = calculatedStatus;
        targetAttendance.ca_id = effectiveCaId;
        if (resolvedScheduleId) targetAttendance.lich_trinh_id = resolvedScheduleId;
        targetAttendance.di_muon_phut = lateMinutes;
        if (isFraud) targetAttendance.co_gian_lan = true;
        await targetAttendance.save({ transaction });
      }

      const createdPunch = await LuotQuetChamCong.create(
        {
          cham_cong_id: targetAttendance.id,
          nguoi_dung_id,
          loai_quet: 'check_in',
          thoi_gian_quet: now,
          phuong_thuc: 'qr_code',
          vi_do: lat,
          kinh_do: lng,
          do_chinh_xac_gps: acc,
          vi_tri_gia_lap: Boolean(geofenceResult?.isSuspicious),
          khoang_cach_met: Number.isFinite(geofenceResult?.distance) ? Math.max(0, Math.round(geofenceResult.distance)) : null,
          hop_le: !isFraud,
          ly_do_khong_hop_le: fraudReason || geofenceResult?.suspiciousReason || null,
          ma_thiet_bi: thiet_bi_id,
        },
        { transaction }
      );

      return { savedAttendance: targetAttendance, punchLog: createdPunch };
    });

    try {
      const { emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
      emitAttendanceUpdate(savedAttendance.toJSON ? savedAttendance.toJSON() : savedAttendance);
      if (isFraud) {
        emitFraudAlert({
          type: 'QR_GEOFENCE_CHECK_IN_ALERT',
          message: fraudReason || 'Cảnh báo vị trí quét QR vào ca.',
          details: { userId: nguoi_dung_id, attendanceId: savedAttendance.id },
        });
      }
    } catch (_) {}

    return {
      loai_quet: 'check_in',
      message: isFraud
        ? `Quét QR Check-in thành công có cảnh báo: ${fraudReason}`
        : 'Quét mã QR Check-in thành công.',
      trang_thai: calculatedStatus,
      thoi_gian_vao: now,
      gian_lan: isFraud,
      ly_do_gian_lan: fraudReason,
      nhat_ky_cham_cong: savedAttendance,
      luot_quet: punchLog,
    };
  }

  // TRƯỜNG HỢP 2: ĐÃ CHECK-IN NHƯNG CHƯA CHECK-OUT -> THỰC HIỆN CHECK-OUT BẰNG QR
  if (attendance.da_chot) {
    throw new ServiceError(
      'Bản ghi chấm công đã bị khóa sổ lương, không thể check-out hoặc chỉnh sửa.',
      409,
      'ATTENDANCE_LOCKED'
    );
  }

  const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
    now,
    attendance.ca,
    attendance.trang_thai
  );

  const diffMs = now.getTime() - new Date(attendance.thoi_gian_vao).getTime();
  const durationMinutes = Math.max(0, Math.round(diffMs / 60000));
  const soTietThucDay = await calculateActualTeachingPeriods(
    {
      lichTrinhId: attendance.lich_trinh_id,
      workingMinutes: durationMinutes,
      earlyMinutes: earlyMinutes || 0,
    },
    LichTrinh
  );

  const { savedAttendance, punchLog } = await runInTransaction(async (transaction) => {
    attendance.thoi_gian_ra = now;
    attendance.trang_thai = finalStatus;
    attendance.ve_som_phut = earlyMinutes || 0;
    attendance.thoi_luong_lam_viec_phut = durationMinutes;
    attendance.so_tiet_thuc_day = soTietThucDay;
    if (isFraud) attendance.co_gian_lan = true;

    await attendance.save({ transaction });

    const createdPunch = await LuotQuetChamCong.create(
      {
        cham_cong_id: attendance.id,
        nguoi_dung_id,
        loai_quet: 'check_out',
        thoi_gian_quet: now,
        phuong_thuc: 'qr_code',
        vi_do: lat,
        kinh_do: lng,
        do_chinh_xac_gps: acc,
        vi_tri_gia_lap: Boolean(geofenceResult?.isSuspicious),
        khoang_cach_met: Number.isFinite(geofenceResult?.distance) ? Math.max(0, Math.round(geofenceResult.distance)) : null,
        hop_le: !isFraud,
        ly_do_khong_hop_le: fraudReason || geofenceResult?.suspiciousReason || null,
        ma_thiet_bi: thiet_bi_id,
      },
      { transaction }
    );

    return { savedAttendance: attendance, punchLog: createdPunch };
  });

  try {
    const { emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
    emitAttendanceUpdate(savedAttendance.toJSON ? savedAttendance.toJSON() : savedAttendance);
    if (isFraud) {
      emitFraudAlert({
        type: 'QR_GEOFENCE_CHECK_OUT_ALERT',
        message: fraudReason || 'Cảnh báo vị trí quét QR tan ca.',
        details: { userId: nguoi_dung_id, attendanceId: savedAttendance.id },
      });
    }
  } catch (_) {}

  return {
    loai_quet: 'check_out',
    message: isFraud
      ? `Quét QR Check-out thành công có cảnh báo: ${fraudReason}`
      : 'Quét mã QR Check-out thành công.',
    trang_thai: finalStatus,
    thoi_gian_ra: now,
    so_gio_cong: savedAttendance.so_gio_cong,
    ve_som_phut: savedAttendance.ve_som_phut,
    gian_lan: isFraud,
    ly_do_gian_lan: fraudReason,
    nhat_ky_cham_cong: savedAttendance,
    luot_quet: punchLog,
  };
};

module.exports = { processScanQRCode };
