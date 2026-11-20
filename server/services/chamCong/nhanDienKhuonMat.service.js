// Điểm danh bằng khuôn mặt Realtime (Face Service + FAISS), đối chiếu chính chủ tài khoản đăng nhập, chống quét lặp 60s, kiểm tra GPS và lưu log chấm công
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  LichTrinh,
  CaLamViec,
  NguoiDung,
  PhongBan,
  NhatKyKiemToan,
} = require('../../models');
const { recognizeFace, ensureRamCacheWarm } = require('../khuonMat/ketNoiDichVuKhuonMat');
const { validateGeofence, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const { storeAttendanceEvidence, removeAttendanceEvidence } = require('../../utils/anhMinhChungChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { evaluateUserScheduleForCheckIn } = require('./dieuKienLichChamCong.service');
const { kiemTraChoPhepCheckOut } = require('./khoiCaDay.service');
const {
  ServiceError,
  calculateActualTeachingPeriods,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/thoiGianChamCong.utils');
const {
  checkAndSetCooldown,
  getCooldownRemaining,
  resetCooldown,
} = require('../../config/redis');
const { addPunchJob } = require('../../queues/hangDoiChamCong');

// Bộ nhớ cục bộ chống quét lặp 60 giây (dùng song song với Redis)
const scanCooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000;

// Xử lý điểm danh khuôn mặt Realtime (hỗ trợ cả verifyOnly và đẩy hàng đợi BullMQ)
const processFaceAttendance = async ({
  imageBuffer,
  location = null,
  deviceId = 'MAY_CHAM_CONG_CAMERA',
  reqIp = '127.0.0.1',
  verifyOnly = false,
  useQueue = false,
  requestedAction = null,
  expectedUserId = null,
}) => {
  if (!imageBuffer) {
    throw new ServiceError('Vui lòng cung cấp hình ảnh khuôn mặt từ camera.', 400);
  }

  // Nạp lại vector vào RAM Face Service nếu service vừa khởi động lại
  await ensureRamCacheWarm();

  const aiResult = await recognizeFace({ imageBuffer });

  if (!aiResult.matched) {
    const primaryReason = (aiResult.reasons && aiResult.reasons[0]) || 'Khuôn mặt không khớp với hồ sơ nhân sự nào.';

    let errorCode = 'FACE_NOT_MATCHED';
    let message = primaryReason;

    if (primaryReason.includes('AMBIGUOUS_MATCH')) {
      errorCode = 'AMBIGUOUS_MATCH';
      message =
        'Nhận diện mơ hồ: Độ chênh lệch giữa 2 ứng viên tương đồng nhất nhỏ hơn 0.05. Hệ thống từ chối để chống nhận diện nhầm.';
    } else if (primaryReason.includes('SPOOF_DETECTED')) {
      errorCode = 'LIVENESS_FAILED';
      message = 'Phát hiện dấu hiệu giả mạo sinh trắc học (ảnh in hoặc màn hình kỹ thuật số).';
    } else if (primaryReason.includes('MULTIPLE_FACES')) {
      errorCode = 'MULTIPLE_FACES';
      message = 'Phát hiện nhiều người trong khung hình. Vui lòng chấm công từng người.';
    }

    return {
      success: false,
      matched: false,
      message,
      errorCode,
      similarity: aiResult.similarity || 0,
    };
  }

  const rawUserId = aiResult.userId || aiResult.employee_id;
  let user = null;
  if (rawUserId) {
    const userInclude = [{ model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban'] }];
    if (isValidUuid(String(rawUserId))) {
      user = await NguoiDung.findByPk(String(rawUserId), { include: userInclude });
    }
    if (!user) {
      user = await NguoiDung.findOne({
        where: {
          [Op.or]: [
            { ma_can_bo: String(rawUserId) },
            { email: String(rawUserId) },
          ],
        },
        include: userInclude,
      });
    }
  }

  if (!user || user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
    throw new ServiceError('Tài khoản người dùng không tồn tại, đã bị khóa hoặc đã nghỉ việc.', 403);
  }

  const userId = user.id;

  // Chấm công trên tài khoản đăng nhập: khuôn mặt phải khớp đúng chủ tài khoản, chặn chấm công hộ
  if (expectedUserId && String(userId) !== String(expectedUserId)) {
    return {
      success: false,
      matched: false,
      message: 'Khuôn mặt không khớp với tài khoản đang đăng nhập. Chỉ chính chủ mới được chấm công.',
      errorCode: 'FACE_USER_MISMATCH',
      similarity: aiResult.similarity || 0,
    };
  }

  // Nếu là chế độ verifyOnly: Chỉ trả về thông tin nhận diện để hiển thị popup xác nhận
  if (verifyOnly) {
    return {
      success: true,
      khop_khuon_mat: true,
      nguoi_dung_id: userId,
      user: {
        id: userId,
        ho_ten: user.ho_ten,
        email: user.email,
        vai_tro_chinh: user.vai_tro_chinh,
        anh_dai_dien: user.anh_dai_dien,
        ma_can_bo: user.ma_can_bo || '',
        don_vi_chinh: user.don_vi_chinh
          ? {
              id: user.don_vi_chinh.id,
              ten_phong_ban: user.don_vi_chinh.ten_phong_ban,
            }
          : null,
      },
      diem_tin_cay: aiResult.similarity,
      diem_nguoi_that: aiResult.liveness_score,
      message: `Đã nhận diện: ${user.ho_ten}`,
    };
  }

  // 3. Kiểm tra Cooldown 60 giây chống quét lặp liên tiếp
  const userKey = String(userId);
  const redisRemaining = await getCooldownRemaining(userKey);
  const lastScanTime = scanCooldownMap.get(userKey);
  const nowMs = Date.now();
  const memoryRemaining =
    lastScanTime && nowMs - lastScanTime < COOLDOWN_MS
      ? Math.ceil((COOLDOWN_MS - (nowMs - lastScanTime)) / 1000)
      : 0;

  const remainingSeconds = Math.max(redisRemaining, memoryRemaining);
  if (remainingSeconds > 0) {
    throw new ServiceError(
      `Bạn vừa quét chấm công thành công cách đây chưa đầy 60 giây. Vui lòng chờ ${remainingSeconds}s để tránh trùng lặp.`,
      409,
      'RECENTLY_SCANNED',
      { retryAfterSeconds: remainingSeconds }
    );
  }

  const now = new Date();
  const { dateStr } = getVietnamDayRange(now);
  const yesterdayStr = getVietnamDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000)).dateStr;
  const overnightCutoff = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  // Tra cứu bản ghi chấm công đang mở (hỗ trợ cả ca qua đêm, loại trừ bản ghi đã bị đánh dấu thiếu check-out)
  let openLog = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id: userId,
      ngay_cong: dateStr,
      thoi_gian_vao: { [Op.ne]: null },
      thoi_gian_ra: null,
      trang_thai: { [Op.ne]: 'thieu_check_out' },
    },
    include: [{ model: CaLamViec, as: 'ca' }],
    order: [['tao_luc', 'DESC']],
  });

  if (!openLog) {
    openLog = await NhatKyChamCong.findOne({
      where: {
        nguoi_dung_id: userId,
        ngay_cong: { [Op.in]: [dateStr, yesterdayStr] },
        thoi_gian_vao: { [Op.gte]: overnightCutoff },
        thoi_gian_ra: null,
        trang_thai: { [Op.ne]: 'thieu_check_out' },
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  // Bản ghi hoàn thành gần nhất trong ngày (nếu có)
  const lastFinishedLog = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id: userId,
      ngay_cong: dateStr,
      thoi_gian_ra: { [Op.ne]: null },
    },
    include: [{ model: CaLamViec, as: 'ca' }],
    order: [['thoi_gian_ra', 'DESC']],
  });

  // Quyết định hành động: check_in hay check_out (kiểm tra trước khi ghi cooldown/ảnh minh chứng)
  let actionType = requestedAction;

  // Đang có lượt vào ca nhưng đã đến giờ check-in của một khối giảng dạy khác: đây là lượt check-in khối mới
  let nextBlockEval = null;
  if (openLog && actionType !== 'check_out') {
    const evalNext = await evaluateUserScheduleForCheckIn(userId, null, user);
    if (
      evalNext?.canCheckIn &&
      evalNext.selectedSchedule?.id &&
      String(evalNext.selectedSchedule.id) !== String(openLog.lich_trinh_id || '')
    ) {
      nextBlockEval = evalNext;
    }
  }

  if (actionType === 'check_in') {
    if (openLog && !nextBlockEval) {
      const inTimeStr = new Date(openLog.thoi_gian_vao).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      throw new ServiceError(
        `Cán bộ ${user.ho_ten} đang có một ca làm việc (vào ca lúc ${inTimeStr}) chưa được tan ca. Vui lòng chuyển sang 'Tan Ca' nếu muốn check-out.`,
        409,
        'ATTENDANCE_ALREADY_CHECKED_IN'
      );
    }
    actionType = 'check_in';
  } else if (actionType === 'check_out') {
    if (!openLog) {
      if (lastFinishedLog) {
        const outTimeStr = new Date(lastFinishedLog.thoi_gian_ra).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        throw new ServiceError(
          `Cán bộ ${user.ho_ten} đã thực hiện tan ca gần nhất hôm nay lúc ${outTimeStr} rồi.`,
          409,
          'ATTENDANCE_ALREADY_CHECKED_OUT'
        );
      }
      throw new ServiceError(
        `Không tìm thấy lượt vào ca nào hôm nay của cán bộ ${user.ho_ten} để tan ca. Vui lòng điểm danh vào ca trước.`,
        404,
        'ATTENDANCE_NO_OPEN_RECORD'
      );
    }
    actionType = 'check_out';
  } else {
    actionType = openLog && !nextBlockEval ? 'check_out' : 'check_in';
  }

  if (actionType === 'check_out' && openLog && openLog.da_chot) {
    throw new ServiceError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-out.', 409, 'ATTENDANCE_LOCKED');
  }

  let scheduleEval = null;
  if (actionType === 'check_in') {
    scheduleEval = nextBlockEval || (await evaluateUserScheduleForCheckIn(userId, null, user));
    if (!scheduleEval || !scheduleEval.canCheckIn) {
      const r = (user.vai_tro_chinh || '').toLowerCase();
      const userPrefix = r === 'giang_vien' ? 'Giảng viên' : 'Cán bộ';
      throw new ServiceError(
        scheduleEval?.message ||
          `${userPrefix} ${user.ho_ten} hôm nay không có lịch phân công giảng dạy hoặc ca làm việc nào trên hệ thống. Không thể chấm công.`,
        400,
        scheduleEval?.status || 'NO_SCHEDULE'
      );
    }
  }

  // 4. Xác thực Geofence GPS & Mạng trường (ưu tiên tọa độ phòng học nếu có lịch; bỏ qua nếu lịch trực tuyến)
  const targetScheduleId = actionType === 'check_out' ? openLog?.lich_trinh_id : scheduleEval?.selectedSchedule?.id;
  let isOnlineSchedule = Boolean(actionType !== 'check_out' && scheduleEval?.selectedSchedule?.la_truc_tuyen);
  if (!isOnlineSchedule && targetScheduleId && isValidUuid(String(targetScheduleId))) {
    const schedForOnline = await LichTrinh.findByPk(targetScheduleId, { attributes: ['id', 'la_truc_tuyen'] });
    isOnlineSchedule = Boolean(schedForOnline?.la_truc_tuyen);
  }
  const geoTargets = isOnlineSchedule ? null : await resolveUserGeofenceTargets(userId, targetScheduleId);
  const geoCheck = isOnlineSchedule
    ? { valid: true, isFraud: false, isSuspicious: false, distance: 0, fraudReason: null, suspiciousReason: null }
    : validateGeofence(location, geoTargets, actionType === 'check_out' ? { radiusMultiplier: 1.5 } : null, reqIp);

  // Chỉ ghi cooldown và lưu ảnh minh chứng sau khi qua toàn bộ bước kiểm tra hợp lệ
  scanCooldownMap.set(userKey, Date.now());
  const storedEvidencePath = await storeAttendanceEvidence(imageBuffer);

  // Nếu người dùng yêu cầu xử lý qua Hàng đợi
  if (useQueue) {
    await checkAndSetCooldown(userKey, 60).catch(() => {});

    const queueResponse = await addPunchJob({
      type: 'face_ai',
      userId,
      requestedAction: actionType,
      punchTime: now,
      location,
      reqIp,
      deviceId,
      aiResult: {
        similarity: aiResult.similarity,
        liveness_score: aiResult.liveness_score,
        pose: aiResult.pose || aiResult.angle || null,
      },
      evidenceRef: storedEvidencePath,
    });

    if (queueResponse.success === false || queueResponse.status === 'FAILED_SYNC') {
      scanCooldownMap.delete(userKey);
      await resetCooldown(userKey).catch(() => {});
      await removeAttendanceEvidence(storedEvidencePath).catch(() => {});
      throw new ServiceError(
        queueResponse.message || 'Xử lý điểm danh qua hàng đợi thất bại.',
        400,
        'ATTENDANCE_QUEUE_FAILED'
      );
    }

    return {
      success: true,
      action: queueResponse.queued ? actionType : queueResponse.result?.action || actionType,
      hanh_dong: queueResponse.queued ? 'QUEUED' : queueResponse.result?.action || actionType,
      da_vao_hang_doi: queueResponse.queued,
      ma_cong_viec: queueResponse.jobId,
      message: queueResponse.message,
      user: {
        id: userId,
        ho_ten: user.ho_ten,
        ma_can_bo: user.ma_can_bo,
        vai_tro_chinh: user.vai_tro_chinh,
        anh_dai_dien: user.anh_dai_dien,
      },
      diem_tin_cay: aiResult.similarity,
      diem_nguoi_that: aiResult.liveness_score,
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
      ket_qua: queueResponse.result,
    };
  }

  let attendanceRecord = null;

  if (actionType === 'check_out' && openLog) {
    if (openLog.da_chot) {
      throw new ServiceError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-out.', 409, 'ATTENDANCE_LOCKED');
    }
    // 6. Thực hiện CHECK-OUT (chỉ sau khi ca cuối của khối kết thúc và trước khi check-in khối sau)
    const checkOutTime = new Date();
    const { khoiConfig } = await kiemTraChoPhepCheckOut({
      nguoiDungId: userId,
      openLog,
      now: checkOutTime,
    });
    const shiftConfig = khoiConfig;

    let durationMins = openLog.thoi_luong_lam_viec_phut || 0;
    if (openLog.thoi_gian_vao) {
      const diffMs = checkOutTime.getTime() - new Date(openLog.thoi_gian_vao).getTime();
      durationMins = Math.max(0, Math.round(diffMs / 60000));
    }

    const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      shiftConfig,
      openLog.trang_thai
    );

    const teachingPeriods = await calculateActualTeachingPeriods(
      {
        lichTrinhId: openLog.lich_trinh_id,
        lichTrinhIds: openLog.ds_lich_trinh_id,
        workingMinutes: durationMins,
        earlyMinutes: earlyMinutes || 0,
      },
      LichTrinh
    );

    attendanceRecord = await runInTransaction(async (transaction) => {
      openLog.thoi_gian_ra = checkOutTime;
      openLog.thoi_luong_lam_viec_phut = durationMins;
      openLog.trang_thai = finalStatus;
      openLog.ve_som_phut = earlyMinutes || 0;
      openLog.so_tiet_thuc_day = teachingPeriods;
      if (geoCheck.isFraud) openLog.co_gian_lan = true;

      await openLog.save({ transaction });

      await LuotQuetChamCong.create(
        {
          cham_cong_id: openLog.id,
          nguoi_dung_id: userId,
          loai_quet: 'check_out',
          thoi_gian_quet: checkOutTime,
          phuong_thuc: 'face_ai',
          do_tin_cay_ai: aiResult.similarity ?? null,
          diem_mat_that: aiResult.liveness_score ?? null,
          goc_mat_nhan_dien: aiResult.pose || aiResult.angle || 'chinh_dien',
          anh_minh_chung: storedEvidencePath,
          vi_do: location?.lat ?? null,
          kinh_do: location?.lng ?? null,
          do_chinh_xac_gps: location?.accuracy ?? null,
          vi_tri_gia_lap: Boolean(geoCheck.isSuspicious),
          khoang_cach_met: Number.isFinite(geoCheck.distance) ? Math.max(0, Number(geoCheck.distance)) : null,
          hop_le: !geoCheck.isFraud,
          ly_do_khong_hop_le: geoCheck.fraudReason || geoCheck.suspiciousReason || null,
          ma_thiet_bi: deviceId,
        },
        { transaction }
      );

      return openLog;
    });
  } else {
    // 7. Thực hiện CHECK-IN (tái sử dụng scheduleEval đã thẩm định ở bước trên)
    const checkInTime = now;
    const selectedSchedule = scheduleEval.selectedSchedule;
    const selectedShift = scheduleEval.shift;
    const effectiveCaId = selectedShift?.id || null;
    if (!effectiveCaId) {
      scanCooldownMap.delete(userKey);
      await removeAttendanceEvidence(storedEvidencePath).catch(() => {});
      throw new ServiceError('Không xác định được ca làm việc hợp lệ để chấm công.', 400, 'SHIFT_NOT_FOUND');
    }

    const selectedScheduleId = selectedSchedule?.id || null;
    const calculatedStatus = scheduleEval.status || 'on_time';
    const lateMinutes = scheduleEval.lateMinutes || 0;

    try {
      attendanceRecord = await runInTransaction(async (transaction) => {
        let targetAttendance = await NhatKyChamCong.findOne({
          where: {
            nguoi_dung_id: userId,
            ngay_cong: dateStr,
            ...(selectedScheduleId
              ? { lich_trinh_id: selectedScheduleId }
              : { ca_id: effectiveCaId, lich_trinh_id: null }),
          },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });

        if (targetAttendance) {
          if (targetAttendance.da_chot) {
            throw new ServiceError('Bản ghi chấm công đã được chốt sổ lương, không thể check-in.', 403, 'ATTENDANCE_LOCKED');
          }
          if (targetAttendance.thoi_gian_vao) {
            throw new ServiceError('Bạn đã hoàn tất Check-in cho ca làm việc này hôm nay.', 400, 'ALREADY_CHECKED_IN');
          }
          targetAttendance.thoi_gian_vao = checkInTime;
          if (selectedScheduleId) targetAttendance.lich_trinh_id = selectedScheduleId;
          if (scheduleEval.khoi) targetAttendance.ds_lich_trinh_id = scheduleEval.khoi.ds_lich_trinh_id;
          targetAttendance.di_muon_phut = lateMinutes;
          targetAttendance.trang_thai = calculatedStatus;
          if (geoCheck.isFraud) targetAttendance.co_gian_lan = true;
          await targetAttendance.save({ transaction });
        } else {
          targetAttendance = await NhatKyChamCong.create(
            {
              nguoi_dung_id: userId,
              ca_id: effectiveCaId,
              lich_trinh_id: selectedScheduleId,
              ds_lich_trinh_id: scheduleEval.khoi ? scheduleEval.khoi.ds_lich_trinh_id : null,
              ngay_cong: dateStr,
              thoi_gian_vao: checkInTime,
              di_muon_phut: lateMinutes,
              trang_thai: calculatedStatus,
              co_gian_lan: Boolean(geoCheck.isFraud),
            },
            { transaction }
          );
        }

        // Khối giảng dạy trước chưa check-out mà đã check-in khối sau thì khối trước chuyển thành thiếu check-out
        if (selectedScheduleId) {
          const staleLogs = await NhatKyChamCong.findAll({
            where: {
              nguoi_dung_id: userId,
              ngay_cong: dateStr,
              id: { [Op.ne]: targetAttendance.id },
              lich_trinh_id: { [Op.ne]: null },
              thoi_gian_vao: { [Op.ne]: null },
              thoi_gian_ra: null,
            },
            transaction,
          });
          const sameBlockIds = scheduleEval.khoi?.ds_lich_trinh_id || [];
          for (const stale of staleLogs) {
            if (sameBlockIds.includes(String(stale.lich_trinh_id))) continue;
            stale.trang_thai = 'thieu_check_out';
            await stale.save({ transaction });
          }
        }

        await LuotQuetChamCong.create(
          {
            cham_cong_id: targetAttendance.id,
            nguoi_dung_id: userId,
            loai_quet: 'check_in',
            thoi_gian_quet: checkInTime,
            phuong_thuc: 'face_ai',
            do_tin_cay_ai: aiResult.similarity ?? null,
            diem_mat_that: aiResult.liveness_score ?? null,
            goc_mat_nhan_dien: aiResult.pose || aiResult.angle || null,
            anh_minh_chung: storedEvidencePath,
            vi_do: location?.lat ?? null,
            kinh_do: location?.lng ?? null,
            do_chinh_xac_gps: location?.accuracy ?? null,
            vi_tri_gia_lap: Boolean(geoCheck.isSuspicious),
            khoang_cach_met: Number.isFinite(geoCheck.distance) ? Math.max(0, Number(geoCheck.distance)) : null,
            hop_le: !geoCheck.isFraud,
            ly_do_khong_hop_le: geoCheck.fraudReason || geoCheck.suspiciousReason || null,
            ma_thiet_bi: deviceId,
          },
          { transaction }
        );

        return targetAttendance;
      });
    } catch (createErr) {
      scanCooldownMap.delete(userKey);
      await removeAttendanceEvidence(storedEvidencePath).catch(() => {});
      if (
        createErr.name === 'SequelizeUniqueConstraintError' ||
        createErr?.parent?.number === 2627 ||
        createErr?.parent?.number === 2601
      ) {
        throw new ServiceError(
          `Cán bộ ${user.ho_ten} đã có bản ghi điểm danh ca làm việc ngày hôm nay rồi.`,
          409,
          'ATTENDANCE_RECORD_EXISTS'
        );
      }
      throw createErr;
    }
  }

  // 8. Cập nhật Cooldown 60s
  scanCooldownMap.set(userKey, Date.now());
  await checkAndSetCooldown(userKey, 60).catch(() => {});

  // Ghi NhatKyKiemToan
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: userId,
    loai_chu_the: 'user',
    hanh_dong: `ATTENDANCE_FACE_${actionType}`,
    doi_tuong_id: String(attendanceRecord.id),
    loai_doi_tuong: 'nhat_ky_cham_cong',
    dia_chi_ip: reqIp,
    chi_tiet: {
      do_tin_cay_ai: aiResult.similarity,
      diem_mat_that: aiResult.liveness_score,
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  // Phát sự kiện Realtime Socket.IO tới Admin Dashboard & Trưởng khoa
  try {
    const { emitNewPunch, emitAttendanceUpdate, emitFraudAlert } = require('../../config/socket');
    emitNewPunch({
      id: attendanceRecord.id,
      nguoi_dung_id: userId,
      ho_ten: user.ho_ten || 'Cán bộ',
      ma_can_bo: user.ma_can_bo,
      anh_dai_dien: user.anh_dai_dien,
      don_vi_chinh_id: user.don_vi_chinh_id,
      loai_quet: actionType,
      phuong_thuc: 'face_ai',
      thoi_gian_quet: new Date(),
      trang_thai: attendanceRecord.trang_thai,
      do_tin_cay_ai: aiResult.similarity,
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
      anh_minh_chung: storedEvidencePath,
    });
    emitAttendanceUpdate({
      ...(attendanceRecord.toJSON ? attendanceRecord.toJSON() : attendanceRecord),
      don_vi_chinh_id: user.don_vi_chinh_id,
    });
    if (geoCheck.isFraud) {
      emitFraudAlert({
        type: 'BIOMETRIC_GEOFENCE_ALERT',
        message: geoCheck.fraudReason || `Cảnh báo vị trí chấm công khuôn mặt của ${user.ho_ten}.`,
        details: { userId, attendanceId: attendanceRecord.id },
      });
    }
  } catch (_) {}

  return {
    success: true,
    action: actionType,
    message: `${actionType === 'check_in' ? 'Check-in (Điểm danh vào)' : 'Check-out (Ra về)'} thành công: ${user.ho_ten}`,
    user: {
      id: userId,
      ho_ten: user.ho_ten,
      ma_can_bo: user.ma_can_bo,
      vai_tro_chinh: user.vai_tro_chinh,
      anh_dai_dien: user.anh_dai_dien,
    },
    co_gian_lan: geoCheck.isFraud,
    ly_do_gian_lan: geoCheck.fraudReason,
    diem_tin_cay: aiResult.similarity,
    diem_nguoi_that: aiResult.liveness_score,
    record: attendanceRecord,
  };
};

module.exports = {
  processFaceAttendance,
  scanCooldownMap,
  resetCooldown,
};
