// Lõi xử lý nghiệp vụ điểm danh sinh trắc học dùng chung cho cả nhánh đồng bộ và Worker hàng đợi BullMQ
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  LichTrinh,
  CaLamViec,
  NguoiDung,
  NhatKyKiemToan,
} = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { validateGeofence, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const {
  ServiceError,
  normalizeAttendanceMethod,
  calculateActualTeachingPeriods,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/thoiGianChamCong.utils');
const { evaluateUserScheduleForCheckIn } = require('./dieuKienLichChamCong.service');
const { kiemTraChoPhepCheckOut } = require('./khoiCaDay.service');

const defaultMakeError = (message, statusCode = 400, errorCode = null) =>
  new ServiceError(message, statusCode, errorCode);

// Tìm bản ghi chấm công đang mở (ưu tiên trong ngày, có hỗ trợ ca qua đêm)
const findOpenAttendanceLog = async (userId, punchTime) => {
  const { dateStr: workDateStr } = getVietnamDayRange(punchTime);
  const yesterdayStr = getVietnamDayRange(new Date(punchTime.getTime() - 24 * 60 * 60 * 1000)).dateStr;
  const overnightCutoff = new Date(punchTime.getTime() - 18 * 60 * 60 * 1000);

  let openLog = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id: userId,
      ngay_cong: workDateStr,
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
        ngay_cong: { [Op.in]: [workDateStr, yesterdayStr] },
        thoi_gian_vao: { [Op.gte]: overnightCutoff },
        thoi_gian_ra: null,
        trang_thai: { [Op.ne]: 'thieu_check_out' },
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  return { openLog, workDateStr };
};

// Kiểm tra trạng thái mở/đóng ca, điều kiện lịch/ca và Geofence trước khi ghi nhận lượt quét
const preparePunchContext = async ({
  userId,
  user = null,
  requestedAction = null,
  punchTime = new Date(),
  location = null,
  reqIp = '127.0.0.1',
  makeError = defaultMakeError,
}) => {
  const effectivePunchTime = punchTime ? new Date(punchTime) : new Date();
  const { openLog, workDateStr } = await findOpenAttendanceLog(userId, effectivePunchTime);

  let actionType = requestedAction || null;

  // Đồng bộ khối ca: đang có openLog nhưng đã tới giờ check-in khối giảng dạy mới hoặc ca hành chính song song
  let nextBlockEval = null;
  if (openLog && actionType !== 'check_out') {
    const evalNext = await evaluateUserScheduleForCheckIn(userId, null, user, effectivePunchTime);
    if (evalNext?.canCheckIn) {
      const isNewTeachingBlock = Boolean(
        evalNext.selectedSchedule?.id &&
          String(evalNext.selectedSchedule.id) !== String(openLog.lich_trinh_id || '') &&
          !(evalNext.khoi?.ds_lich_trinh_id || []).includes(String(openLog.lich_trinh_id || ''))
      );
      const isParallelAdminAndTeaching = Boolean(!openLog.lich_trinh_id && evalNext.selectedSchedule?.id);
      if (isNewTeachingBlock || isParallelAdminAndTeaching) {
        nextBlockEval = evalNext;
      }
    }
  }

  if (actionType === 'check_in') {
    if (openLog && !nextBlockEval) {
      const inTimeStr = new Date(openLog.thoi_gian_vao).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      throw makeError(
        user?.ho_ten
          ? `Cán bộ ${user.ho_ten} đang có một ca làm việc (vào ca lúc ${inTimeStr}) chưa được tan ca. Vui lòng chuyển sang 'Tan Ca' nếu muốn check-out.`
          : 'Người dùng đang có một ca làm việc chưa hoàn thành tan ca.',
        409,
        'ATTENDANCE_ALREADY_CHECKED_IN'
      );
    }
  } else if (actionType === 'check_out') {
    if (!openLog) {
      if (user) {
        const lastFinishedLog = await NhatKyChamCong.findOne({
          where: { nguoi_dung_id: userId, ngay_cong: workDateStr, thoi_gian_ra: { [Op.ne]: null } },
          order: [['thoi_gian_ra', 'DESC']],
        });
        if (lastFinishedLog) {
          const outTimeStr = new Date(lastFinishedLog.thoi_gian_ra).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          throw makeError(
            `Cán bộ ${user.ho_ten} đã thực hiện tan ca gần nhất hôm nay lúc ${outTimeStr} rồi.`,
            409,
            'ATTENDANCE_ALREADY_CHECKED_OUT'
          );
        }
      }
      throw makeError(
        user?.ho_ten
          ? `Không tìm thấy lượt vào ca nào hôm nay của cán bộ ${user.ho_ten} để tan ca. Vui lòng điểm danh vào ca trước.`
          : 'Không tìm thấy lượt check-in nào đang mở để thực hiện check-out.',
        404,
        'ATTENDANCE_NO_OPEN_RECORD'
      );
    }
  } else {
    actionType = openLog && !nextBlockEval ? 'check_out' : 'check_in';
  }

  if (actionType === 'check_out' && openLog && openLog.da_chot) {
    throw makeError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-out.', 409, 'ATTENDANCE_LOCKED');
  }

  let scheduleEval = null;
  if (actionType === 'check_in') {
    scheduleEval = nextBlockEval || (await evaluateUserScheduleForCheckIn(userId, null, user, effectivePunchTime));
    if (!scheduleEval || !scheduleEval.canCheckIn) {
      const rolePrefix = String(user?.vai_tro_chinh || '').toLowerCase() === 'giang_vien' ? 'Giảng viên' : 'Cán bộ';
      const fallbackMsg = user?.ho_ten
        ? `${rolePrefix} ${user.ho_ten} hôm nay không có lịch phân công giảng dạy hoặc ca làm việc nào trên hệ thống. Không thể chấm công.`
        : 'Hôm nay không có lịch phân công hoặc ca làm việc đủ điều kiện để check-in.';
      throw makeError(scheduleEval?.message || fallbackMsg, 400, scheduleEval?.status || 'NO_SCHEDULE');
    }
  }

  const targetScheduleId = actionType === 'check_out' ? openLog?.lich_trinh_id : scheduleEval?.selectedSchedule?.id;
  let isOnlineSchedule = Boolean(actionType !== 'check_out' && scheduleEval?.selectedSchedule?.la_truc_tuyen);
  if (!isOnlineSchedule && targetScheduleId && isValidUuid(String(targetScheduleId))) {
    const schedForOnline = await LichTrinh.findByPk(targetScheduleId, { attributes: ['id', 'la_truc_tuyen'] }).catch(() => null);
    isOnlineSchedule = Boolean(schedForOnline?.la_truc_tuyen);
  }

  const geoTargets = isOnlineSchedule ? null : await resolveUserGeofenceTargets(userId, targetScheduleId);
  const geoCheck = isOnlineSchedule
    ? { valid: true, isFraud: false, isSuspicious: false, distance: 0, fraudReason: null, suspiciousReason: null }
    : validateGeofence(location, geoTargets, actionType === 'check_out' ? { radiusMultiplier: 1.5 } : null, reqIp);

  return {
    actionType,
    openLog,
    scheduleEval,
    geoCheck,
    punchTime: effectivePunchTime,
    workDateStr,
  };
};

// Ghi NhatKyChamCong, LuotQuetChamCong, NhatKyKiemToan và phát sự kiện Socket.IO
const executePunchPersistence = async ({
  userId,
  user = null,
  context,
  method = 'face_ai',
  aiResult = null,
  evidenceRef = null,
  location = null,
  deviceId = 'MAY_CHAM_CONG_CAMERA',
  reqIp = '127.0.0.1',
  auditActionPrefix = 'ATTENDANCE_FACE',
  auditExtra = {},
  makeError = defaultMakeError,
}) => {
  const { actionType, openLog, scheduleEval, geoCheck, punchTime, workDateStr } = context;
  const canonicalMethod = normalizeAttendanceMethod(method || 'face_ai');
  const safeDistance = Number.isFinite(geoCheck.distance) ? Math.max(0, Number(geoCheck.distance)) : null;

  const buildScanPayload = (chamCongId, loaiQuet, fallbackPose = null) => ({
    cham_cong_id: chamCongId,
    nguoi_dung_id: userId,
    loai_quet: loaiQuet,
    thoi_gian_quet: punchTime,
    phuong_thuc: canonicalMethod,
    do_tin_cay_ai: aiResult?.similarity ?? null,
    diem_mat_that: aiResult?.liveness_score ?? null,
    goc_mat_nhan_dien: aiResult?.pose || aiResult?.angle || fallbackPose,
    anh_minh_chung: evidenceRef || null,
    vi_do: location?.lat ?? null,
    kinh_do: location?.lng ?? null,
    do_chinh_xac_gps: location?.accuracy ?? null,
    vi_tri_gia_lap: Boolean(geoCheck.isSuspicious),
    khoang_cach_met: safeDistance,
    hop_le: !geoCheck.isFraud,
    ly_do_khong_hop_le: geoCheck.fraudReason || geoCheck.suspiciousReason || null,
    ma_thiet_bi: deviceId || null,
  });

  let attendanceRecord = null;

  if (actionType === 'check_out' && openLog) {
    if (openLog.da_chot) {
      throw makeError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-out.', 409, 'ATTENDANCE_LOCKED');
    }

    let khoiConfig = openLog.ca;
    try {
      const checkOutEval = await kiemTraChoPhepCheckOut({ nguoiDungId: userId, openLog, now: punchTime });
      khoiConfig = checkOutEval.khoiConfig;
    } catch (err) {
      throw makeError(err.message || 'Chưa đủ điều kiện check-out cho khối ca này.', err.statusCode || 400, err.errorCode || null);
    }

    const { finalStatus, earlyMinutes } = calculateCheckOutStatus(punchTime, khoiConfig, openLog.trang_thai);
    const diffMs = openLog.thoi_gian_vao ? punchTime.getTime() - new Date(openLog.thoi_gian_vao).getTime() : 0;
    const durationMins = Math.max(0, Math.round(diffMs / 60000));
    const soTietThucDay = await calculateActualTeachingPeriods(
      {
        lichTrinhId: openLog.lich_trinh_id,
        lichTrinhIds: openLog.ds_lich_trinh_id,
        workingMinutes: durationMins,
        earlyMinutes: earlyMinutes || 0,
      },
      LichTrinh
    );

    attendanceRecord = await runInTransaction(async (transaction) => {
      openLog.thoi_gian_ra = punchTime;
      openLog.trang_thai = finalStatus;
      openLog.ve_som_phut = earlyMinutes || 0;
      openLog.thoi_luong_lam_viec_phut = durationMins;
      openLog.so_tiet_thuc_day = soTietThucDay;
      if (geoCheck.isFraud) openLog.co_gian_lan = true;
      await openLog.save({ transaction });

      await LuotQuetChamCong.create(
        buildScanPayload(openLog.id, 'check_out', user ? 'chinh_dien' : null),
        { transaction }
      );
      return openLog;
    });
  } else {
    const selectedShift = scheduleEval?.shift;
    if (!selectedShift?.id) {
      throw makeError('Không xác định được ca làm việc hợp lệ để tạo bản ghi chấm công.', 400, 'SHIFT_NOT_FOUND');
    }

    const selectedScheduleId = scheduleEval.selectedSchedule?.id || null;
    const selectedKhoiIds = scheduleEval.khoi ? scheduleEval.khoi.ds_lich_trinh_id : null;
    const calculatedStatus = scheduleEval.status || 'on_time';
    const lateMinutes = scheduleEval.lateMinutes || 0;

    try {
      attendanceRecord = await runInTransaction(async (transaction) => {
        let targetAttendance = await NhatKyChamCong.findOne({
          where: {
            nguoi_dung_id: userId,
            ngay_cong: workDateStr,
            ...(selectedScheduleId
              ? { lich_trinh_id: selectedScheduleId }
              : { ca_id: selectedShift.id, lich_trinh_id: null }),
          },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });

        if (targetAttendance) {
          if (targetAttendance.da_chot) {
            throw makeError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-in.', 403, 'ATTENDANCE_LOCKED');
          }
          if (targetAttendance.thoi_gian_vao && targetAttendance.thoi_gian_ra) {
            throw makeError('Ca làm việc trong ngày đã hoàn tất check-in và check-out.', 400, 'ALREADY_CHECKED_IN');
          }
          if (targetAttendance.thoi_gian_vao && !user) {
            // Giữ lại trường hợp tạo bản ghi lượt quét nếu bản ghi đã có giờ vào trong worker queue
          } else if (targetAttendance.thoi_gian_vao) {
            throw makeError('Bạn đã hoàn tất Check-in cho ca làm việc này hôm nay.', 400, 'ALREADY_CHECKED_IN');
          } else {
            targetAttendance.thoi_gian_vao = punchTime;
            if (selectedScheduleId) targetAttendance.lich_trinh_id = selectedScheduleId;
            if (selectedKhoiIds) targetAttendance.ds_lich_trinh_id = selectedKhoiIds;
            targetAttendance.trang_thai = calculatedStatus;
            targetAttendance.di_muon_phut = lateMinutes;
            if (geoCheck.isFraud) targetAttendance.co_gian_lan = true;
            await targetAttendance.save({ transaction });
          }
        } else {
          targetAttendance = await NhatKyChamCong.create(
            {
              nguoi_dung_id: userId,
              ca_id: selectedShift.id,
              lich_trinh_id: selectedScheduleId,
              ds_lich_trinh_id: selectedKhoiIds,
              ngay_cong: workDateStr,
              thoi_gian_vao: punchTime,
              di_muon_phut: lateMinutes,
              trang_thai: calculatedStatus,
              co_gian_lan: Boolean(geoCheck.isFraud),
            },
            { transaction }
          );
        }

        // Chuyển khối giảng dạy trước còn mở sang thieu_check_out (giữ ca hành chính song song)
        if (selectedScheduleId) {
          const staleLogs = await NhatKyChamCong.findAll({
            where: {
              nguoi_dung_id: userId,
              ngay_cong: workDateStr,
              id: { [Op.ne]: targetAttendance.id },
              lich_trinh_id: { [Op.ne]: null },
              thoi_gian_vao: { [Op.ne]: null },
              thoi_gian_ra: null,
              trang_thai: { [Op.ne]: 'thieu_check_out' },
            },
            transaction,
          });
          const sameBlockIds = selectedKhoiIds || [];
          for (const stale of staleLogs) {
            if (sameBlockIds.includes(String(stale.lich_trinh_id))) continue;
            stale.trang_thai = 'thieu_check_out';
            await stale.save({ transaction });
          }
        }

        await LuotQuetChamCong.create(buildScanPayload(targetAttendance.id, 'check_in', null), { transaction });
        return targetAttendance;
      });
    } catch (createErr) {
      if (
        user &&
        (createErr.name === 'SequelizeUniqueConstraintError' ||
          createErr?.parent?.number === 2627 ||
          createErr?.parent?.number === 2601)
      ) {
        throw makeError(
          `Cán bộ ${user.ho_ten} đã có bản ghi điểm danh ca làm việc ngày hôm nay rồi.`,
          409,
          'ATTENDANCE_RECORD_EXISTS'
        );
      }
      throw createErr;
    }
  }

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: userId,
    loai_chu_the: 'user',
    hanh_dong: `${auditActionPrefix}_${actionType}`,
    doi_tuong_id: String(attendanceRecord.id),
    loai_doi_tuong: 'nhat_ky_cham_cong',
    dia_chi_ip: reqIp,
    chi_tiet: {
      do_tin_cay_ai: aiResult?.similarity ?? null,
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
      ...auditExtra,
    },
  }).catch((err) => console.error('[AuditLog Punch Error]:', err.message));

  try {
    const { emitNewPunch, emitAttendanceUpdate } = require('../../config/socket');
    const emitWithUser = (userDoc) => {
      emitNewPunch({
        id: attendanceRecord.id,
        nguoi_dung_id: userId,
        ho_ten: userDoc?.ho_ten || 'Cán bộ',
        ma_can_bo: userDoc?.ma_can_bo || null,
        anh_dai_dien: userDoc?.anh_dai_dien || null,
        don_vi_chinh_id: userDoc?.don_vi_chinh_id || null,
        loai_quet: actionType,
        phuong_thuc: canonicalMethod,
        thoi_gian_quet: punchTime,
        trang_thai: attendanceRecord.trang_thai,
        do_tin_cay_ai: aiResult?.similarity ?? 1.0,
        co_gian_lan: geoCheck.isFraud,
        ly_do_gian_lan: geoCheck.fraudReason,
        anh_minh_chung: evidenceRef,
      });
      emitAttendanceUpdate({
        ...(attendanceRecord.toJSON ? attendanceRecord.toJSON() : attendanceRecord),
        don_vi_chinh_id: userDoc?.don_vi_chinh_id || null,
      });
    };

    if (user) {
      emitWithUser(user);
    } else {
      NguoiDung.findByPk(userId, {
        attributes: ['id', 'ho_ten', 'ma_can_bo', 'anh_dai_dien', 'don_vi_chinh_id'],
        raw: true,
      })
        .then(emitWithUser)
        .catch(() => {});
    }
  } catch (_) {}

  return { actionType, attendanceRecord, geoCheck };
};

module.exports = {
  preparePunchContext,
  executePunchPersistence,
};
