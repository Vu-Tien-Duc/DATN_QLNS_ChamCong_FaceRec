// Xử lý quét mã QR động điểm danh (Check-in / Check-out) kèm xác thực vị trí GPS và lưu SQL Server 3NF
const { Op } = require('sequelize');
const { NhatKyChamCong, LuotQuetChamCong, LichTrinh, CaLamViec, NguoiDung, NhatKyKiemToan } = require('../../models');
const { validateGeofence, verifyDynamicQRCode, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { redisGet, redisSet } = require('../../config/redis');
const {
  ServiceError,
  calculateActualTeachingPeriods,
  getVietnamTime,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/thoiGianChamCong.utils');
const { evaluateUserScheduleForCheckIn } = require('./dieuKienLichChamCong.service');
const { kiemTraChoPhepCheckOut } = require('./khoiCaDay.service');

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

  // Chuẩn bị khóa chống replay cùng một nonce QR cho cùng tài khoản (kiểm tra trước & trong lock, chỉ đánh dấu đã dùng sau khi qua validate ngay trước khi ghi DB)
  const qrNonce = verifyResult.data?.nonce;
  const replayKey = qrNonce ? `qr_replay:${qrNonce}:${nguoi_dung_id}` : null;
  if (replayKey) {
    const alreadyUsed = await redisGet(replayKey);
    if (alreadyUsed) {
      throw new ServiceError(
        'Mã QR này đã được bạn sử dụng. Vui lòng đợi mã QR mới trên màn hình!',
        409,
        'QR_REPLAY_DETECTED'
      );
    }
  }

  const lat = vi_do !== undefined && vi_do !== null && vi_do !== '' ? Number(vi_do) : null;
  const lng = kinh_do !== undefined && kinh_do !== null && kinh_do !== '' ? Number(kinh_do) : null;
  const acc = do_chinh_xac !== undefined && do_chinh_xac !== null && do_chinh_xac !== '' ? Number(do_chinh_xac) : null;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  return withDistributedLock(`attendance_punch:${nguoi_dung_id}`, 15, async () => {
  if (replayKey) {
    const alreadyUsedInLock = await redisGet(replayKey);
    if (alreadyUsedInLock) {
      throw new ServiceError(
        'Mã QR này đã được bạn sử dụng. Vui lòng đợi mã QR mới trên màn hình!',
        409,
        'QR_REPLAY_DETECTED'
      );
    }
  }
  const markQrNonceUsed = async () => {
    if (replayKey) {
      await redisSet(replayKey, '1', 45);
    }
  };
  const now = new Date();
  const { dateStr } = getVietnamDayRange(now);
  const yesterdayStr = getVietnamDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000)).dateStr;
  const overnightCutoff = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  // 2. Tra cứu bản ghi chấm công đang mở (hỗ trợ cả ca qua đêm, loại trừ bản ghi đã bị đánh dấu thiếu check-out)
  let attendance = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id,
      ngay_cong: dateStr,
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
      trang_thai: { [Op.ne]: 'thieu_check_out' },
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
        trang_thai: { [Op.ne]: 'thieu_check_out' },
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  // Đánh giá xem đã sang khối ca giảng dạy tiếp theo hay vẫn đang ở ca hiện tại
  let evalResult = null;
  let isCheckInAction = !attendance || !attendance.thoi_gian_vao;
  if (attendance && attendance.thoi_gian_vao) {
    const evalNext = await evaluateUserScheduleForCheckIn(nguoi_dung_id);
    if (
      evalNext?.canCheckIn &&
      evalNext.selectedSchedule?.id &&
      String(evalNext.selectedSchedule.id) !== String(attendance.lich_trinh_id || '')
    ) {
      evalResult = evalNext;
      isCheckInAction = true;
    } else if (attendance.da_chot) {
      throw new ServiceError(
        'Bản ghi chấm công đã bị khóa sổ lương, không thể check-out hoặc chỉnh sửa.',
        409,
        'ATTENDANCE_LOCKED'
      );
    }
  }

  if (isCheckInAction && !evalResult) {
    evalResult = await evaluateUserScheduleForCheckIn(nguoi_dung_id);
    if (!evalResult || !evalResult.canCheckIn) {
      throw new ServiceError(
        evalResult?.message ||
          'Hôm nay bạn không có lịch phân công làm việc hoặc giảng dạy trên hệ thống. Không thể thực hiện chấm công.',
        400,
        evalResult?.status || 'NO_SCHEDULE'
      );
    }
  }

  // 3. Kiểm tra GPS chống gian lận quét QR từ xa (bỏ qua nếu lịch trực tuyến; nới 1.5× khi check-out)
  const isCheckOutAction = !isCheckInAction;
  let isFraud = false;
  let fraudReason = null;
  const targetScheduleId = isCheckOutAction
    ? attendance?.lich_trinh_id || null
    : evalResult?.selectedSchedule?.id || null;
  let isOnlineSchedule = Boolean(!isCheckOutAction && evalResult?.selectedSchedule?.la_truc_tuyen);
  if (!isOnlineSchedule && targetScheduleId && isValidUuid(String(targetScheduleId))) {
    const schedForOnline = await LichTrinh.findByPk(targetScheduleId, { attributes: ['id', 'la_truc_tuyen'] });
    isOnlineSchedule = Boolean(schedForOnline?.la_truc_tuyen);
  }
  if (!isOnlineSchedule && !hasCoordinates) {
    throw new ServiceError(
      'Điểm danh bằng mã QR bắt buộc phải bật định vị GPS để xác thực bạn đang có mặt tại trường.',
      400,
      'ATTENDANCE_GPS_REQUIRED'
    );
  }
  const geoTargets = isOnlineSchedule ? null : await resolveUserGeofenceTargets(nguoi_dung_id, targetScheduleId);
  const geofenceResult = isOnlineSchedule
    ? { valid: true, isSuspicious: false, distance: 0, fraudReason: null, suspiciousReason: null }
    : validateGeofence(
        { lat, lng, accuracy: acc },
        geoTargets,
        isCheckOutAction ? { radiusMultiplier: 1.5 } : null,
        dia_chi_ip
      );
  if (!geofenceResult.valid) {
    isFraud = true;
    fraudReason =
      geofenceResult.fraudReason ||
      `Quét mã QR nhưng GPS nằm ngoài khuôn viên trường (${Math.round(geofenceResult.distance || 0)}m).`;
  }

  // TRƯỜNG HỢP 1: CHECK-IN BẰNG QR (chưa check-in hoặc đã sang khối ca giảng dạy mới)
  if (isCheckInAction) {
    const effectiveShift = evalResult.shift;
    const effectiveCaId = effectiveShift?.id || null;
    if (!effectiveCaId) {
      throw new ServiceError('Không xác định được ca làm việc hợp lệ để chấm công.', 400, 'SHIFT_NOT_FOUND');
    }

    const resolvedScheduleId = evalResult.selectedSchedule?.id || null;
    const resolvedKhoiIds = evalResult.khoi ? evalResult.khoi.ds_lich_trinh_id : null;
    const calculatedStatus = evalResult.status || 'on_time';
    const lateMinutes = evalResult.lateMinutes || 0;

    await markQrNonceUsed();

    const { savedAttendance, punchLog } = await runInTransaction(async (transaction) => {
      let targetAttendance = await NhatKyChamCong.findOne({
        where: {
          nguoi_dung_id,
          ngay_cong: dateStr,
          ...(resolvedScheduleId
            ? { lich_trinh_id: resolvedScheduleId }
            : { ca_id: effectiveCaId, lich_trinh_id: null }),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!targetAttendance) {
        targetAttendance = await NhatKyChamCong.create(
          {
            nguoi_dung_id,
            ca_id: effectiveCaId,
            lich_trinh_id: resolvedScheduleId,
            ds_lich_trinh_id: resolvedKhoiIds,
            ngay_cong: dateStr,
            thoi_gian_vao: now,
            trang_thai: calculatedStatus,
            di_muon_phut: lateMinutes,
            co_gian_lan: isFraud,
          },
          { transaction }
        );
      } else {
        if (targetAttendance.da_chot) {
          throw new ServiceError('Bản ghi chấm công đã được chốt sổ lương, không thể check-in.', 403, 'ATTENDANCE_LOCKED');
        }
        targetAttendance.thoi_gian_vao = now;
        targetAttendance.trang_thai = calculatedStatus;
        targetAttendance.ca_id = effectiveCaId;
        if (resolvedScheduleId) targetAttendance.lich_trinh_id = resolvedScheduleId;
        if (resolvedKhoiIds) targetAttendance.ds_lich_trinh_id = resolvedKhoiIds;
        targetAttendance.di_muon_phut = lateMinutes;
        if (isFraud) targetAttendance.co_gian_lan = true;
        await targetAttendance.save({ transaction });
      }

      // Đóng khối giảng dạy trước chưa check-out sang thieu_check_out khi đã sang khối dạy mới (giữ ca hành chính song song)
      if (resolvedScheduleId) {
        const staleLogs = await NhatKyChamCong.findAll({
          where: {
            nguoi_dung_id,
            ngay_cong: dateStr,
            id: { [Op.ne]: targetAttendance.id },
            lich_trinh_id: { [Op.ne]: null },
            thoi_gian_vao: { [Op.ne]: null },
            thoi_gian_ra: null,
            trang_thai: { [Op.ne]: 'thieu_check_out' },
          },
          transaction,
        });
        const sameBlockIds = resolvedKhoiIds || [];
        for (const stale of staleLogs) {
          if (sameBlockIds.includes(String(stale.lich_trinh_id))) continue;
          stale.trang_thai = 'thieu_check_out';
          await stale.save({ transaction });
        }
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

    const ownerDoc = await NguoiDung.findByPk(nguoi_dung_id, { attributes: ['don_vi_chinh_id'] }).catch(() => null);

    try {
      const { emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
      emitAttendanceUpdate({
        ...(savedAttendance.toJSON ? savedAttendance.toJSON() : savedAttendance),
        don_vi_chinh_id: ownerDoc?.don_vi_chinh_id || null,
      });
      if (isFraud) {
        emitFraudAlert({
          type: 'QR_GEOFENCE_CHECK_IN_ALERT',
          message: fraudReason || 'Cảnh báo vị trí quét QR vào ca.',
          details: { userId: nguoi_dung_id, attendanceId: savedAttendance.id },
        });
      }
    } catch (_) {}

    NhatKyKiemToan?.create?.({
      nguoi_thuc_hien_id: nguoi_dung_id,
      loai_chu_the: 'user',
      hanh_dong: 'ATTENDANCE_QR_CHECK_IN',
      doi_tuong_id: String(savedAttendance.id),
      loai_doi_tuong: 'nhat_ky_cham_cong',
      chi_tiet: {
        ngay_cong: dateStr,
        trang_thai: calculatedStatus,
        phuong_thuc: 'qr_code',
        co_gian_lan: Boolean(isFraud),
      },
    })?.catch?.((err) => console.error('[AuditLog Error ATTENDANCE_QR_CHECK_IN]:', err.message));

    return {
      loai_quet: 'check_in',
      message: isFraud
        ? `Quét QR Check-in thành công có cảnh báo: ${fraudReason}`
        : 'Quét mã QR Check-in thành công.',
      trang_thai: calculatedStatus,
      thoi_gian_vao: now,
      co_gian_lan: isFraud,
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

  const { khoiConfig } = await kiemTraChoPhepCheckOut({
    nguoiDungId: nguoi_dung_id,
    openLog: attendance,
    now,
  });

  const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
    now,
    khoiConfig,
    attendance.trang_thai
  );

  const diffMs = now.getTime() - new Date(attendance.thoi_gian_vao).getTime();
  const durationMinutes = Math.max(0, Math.round(diffMs / 60000));
  const soTietThucDay = await calculateActualTeachingPeriods(
    {
      lichTrinhId: attendance.lich_trinh_id,
      lichTrinhIds: attendance.ds_lich_trinh_id,
      workingMinutes: durationMinutes,
      earlyMinutes: earlyMinutes || 0,
    },
    LichTrinh
  );

  await markQrNonceUsed();

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

  const ownerDoc = await NguoiDung.findByPk(nguoi_dung_id, { attributes: ['don_vi_chinh_id'] }).catch(() => null);

  try {
    const { emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
    emitAttendanceUpdate({
      ...(savedAttendance.toJSON ? savedAttendance.toJSON() : savedAttendance),
      don_vi_chinh_id: ownerDoc?.don_vi_chinh_id || null,
    });
    if (isFraud) {
      emitFraudAlert({
        type: 'QR_GEOFENCE_CHECK_OUT_ALERT',
        message: fraudReason || 'Cảnh báo vị trí quét QR tan ca.',
        details: { userId: nguoi_dung_id, attendanceId: savedAttendance.id },
      });
    }
  } catch (_) {}

  NhatKyKiemToan?.create?.({
    nguoi_thuc_hien_id: nguoi_dung_id,
    loai_chu_the: 'user',
    hanh_dong: 'ATTENDANCE_QR_CHECK_OUT',
    doi_tuong_id: String(savedAttendance.id),
    loai_doi_tuong: 'nhat_ky_cham_cong',
    chi_tiet: {
      ngay_cong: dateStr,
      trang_thai: finalStatus,
      phuong_thuc: 'qr_code',
      so_gio_cong: savedAttendance.so_gio_cong,
      co_gian_lan: Boolean(isFraud),
    },
  })?.catch?.((err) => console.error('[AuditLog Error ATTENDANCE_QR_CHECK_OUT]:', err.message));

  return {
    loai_quet: 'check_out',
    message: isFraud
      ? `Quét QR Check-out thành công có cảnh báo: ${fraudReason}`
      : 'Quét mã QR Check-out thành công.',
    trang_thai: finalStatus,
    thoi_gian_ra: now,
    so_gio_cong: savedAttendance.so_gio_cong,
    ve_som_phut: savedAttendance.ve_som_phut,
    co_gian_lan: isFraud,
    ly_do_gian_lan: fraudReason,
    nhat_ky_cham_cong: savedAttendance,
    luot_quet: punchLog,
  };
  });
};

module.exports = { processScanQRCode };
