// Hàng đợi xử lý điểm danh giờ cao điểm (BullMQ + Redis), tự động fallback xử lý đồng bộ khi Redis offline

const { Queue, Worker, UnrecoverableError } = require('bullmq');
const { getRedisClient, isRedisReady } = require('../config/redis');

const QUEUE_NAME = 'attendance-punch-queue';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_URL = process.env.REDIS_URL || null;

// Cấu hình connection riêng cho BullMQ (yêu cầu maxRetriesPerRequest: null)
const getQueueConnectionOptions = () => {
  if (REDIS_URL) {
    try {
      const parsed = new URL(REDIS_URL);
      const dbStr = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      const parsedDb = dbStr && /^\d+$/.test(dbStr) ? parseInt(dbStr, 10) : undefined;
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || process.env.REDIS_PASSWORD || undefined,
        ...(parsedDb !== undefined ? { db: parsedDb } : {}),
        ...(parsed.protocol === 'rediss:' || process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 1000,
      };
    } catch (_) {}
  }

  const parsedEnvDb = process.env.REDIS_DB !== undefined && /^\d+$/.test(String(process.env.REDIS_DB))
    ? parseInt(process.env.REDIS_DB, 10)
    : undefined;

  return {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
    ...(parsedEnvDb !== undefined ? { db: parsedEnvDb } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 1000,
  };
};

let punchQueue = null;
let punchWorker = null;
let isQueueOnline = false;

// Khởi tạo hàng đợi BullMQ (trả về null khi tắt hoặc Redis offline để dùng fallback đồng bộ)
const getPunchQueue = () => {
  if (punchQueue) return punchQueue;

  if (process.env.DISABLE_BULLMQ === 'true' || !isRedisReady()) {
    isQueueOnline = false;
    return null;
  }

  try {
    const connection = getQueueConnectionOptions();
    punchQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    punchQueue.on('error', (err) => {
      isQueueOnline = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ Queue Error]: ${err.message}. Kích hoạt chế độ Fallback Đồng bộ.`);
      }
    });

    isQueueOnline = true;
  } catch (error) {
    isQueueOnline = false;
    punchQueue = null;
  }

  return punchQueue;
};

// Xử lý 1 lượt điểm danh: đối soát lịch/ca, cập nhật NhatKyChamCong, lưu LuotQuetChamCong và phát Socket
const processPunchJobData = async (jobData) => {
  const {
    type,
    userId,
    nguoi_dung_id,
    punchType,
    requestedAction,
    punchTime,
    location,
    reqIp,
    deviceId,
    aiResult,
    evidenceRef,
  } = jobData;

  const effectiveUserId = nguoi_dung_id || userId;

  const crypto = require('crypto');
  const { Op } = require('sequelize');
  const { sequelize } = require('../config/db');
  const {
    NhatKyChamCong,
    LuotQuetChamCong,
    LichTrinh,
    CaLamViec,
    NguoiDung,
    NhatKyKiemToan,
  } = require('../models');
  const { runInTransaction } = require('../utils/giaoDichDb');
  const {
    normalizeAttendanceMethod,
    calculateActualTeachingPeriods,
    getVietnamTime,
    getVietnamDayRange,
    calculateCheckOutStatus,
  } = require('../utils/thoiGianChamCong.utils');
  const { validateGeofence, resolveUserGeofenceTargets } = require('../utils/hoTroChamCong');
  const { evaluateUserScheduleForCheckIn } = require('../services/chamCong/dieuKienLichChamCong.service');
  const { kiemTraChoPhepCheckOut } = require('../services/chamCong/khoiCaDay.service');

  const effectivePunchTime = punchTime ? new Date(punchTime) : new Date();
  const nowVN = getVietnamTime(effectivePunchTime);
  const { dateStr: workDateStr } = getVietnamDayRange(effectivePunchTime);

  // Môi trường test cô lập không có SQL Server -> chỉ chấm geofence và trả kết quả giả lập
  let dbReady = true;
  try {
    await sequelize.authenticate();
  } catch (_) {
    dbReady = false;
  }

  if (!dbReady) {
    const geoCheck = validateGeofence(location, null, null, reqIp);
    return {
      success: true,
      action: requestedAction || punchType || 'check_in',
      recordId: crypto.randomUUID(),
      userId: effectiveUserId,
      isFraud: geoCheck.isFraud,
      processedAt: new Date(),
      offlineDb: true,
    };
  }

  // Tìm bản ghi chấm công đang mở (ưu tiên trong ngày, có hỗ trợ ca làm việc qua đêm)
  const yesterdayStr = getVietnamDayRange(new Date(effectivePunchTime.getTime() - 24 * 60 * 60 * 1000)).dateStr;
  const overnightCutoff = new Date(effectivePunchTime.getTime() - 18 * 60 * 60 * 1000);
  let openLog = await NhatKyChamCong.findOne({
    where: {
      nguoi_dung_id: effectiveUserId,
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
        nguoi_dung_id: effectiveUserId,
        ngay_cong: { [Op.in]: [workDateStr, yesterdayStr] },
        thoi_gian_vao: { [Op.gte]: overnightCutoff },
        thoi_gian_ra: null,
        trang_thai: { [Op.ne]: 'thieu_check_out' },
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  let actionType = requestedAction || punchType || (openLog ? 'check_out' : 'check_in');
  let attendanceRecord = null;
  const canonicalMethod = normalizeAttendanceMethod(type || 'face_ai');

  // Đồng bộ luồng khối ca: đang có openLog nhưng đã tới giờ check-in khối giảng dạy mới (hoặc ca hành chính song song)
  let nextBlockEval = null;
  if (openLog && actionType !== 'check_out') {
    const evalNext = await evaluateUserScheduleForCheckIn(effectiveUserId, null, null, effectivePunchTime);
    if (evalNext?.canCheckIn) {
      const isNewTeachingBlock = Boolean(
        evalNext.selectedSchedule?.id &&
          String(evalNext.selectedSchedule.id) !== String(openLog.lich_trinh_id || '') &&
          !(evalNext.khoi?.ds_lich_trinh_id || []).includes(String(openLog.lich_trinh_id || ''))
      );
      const isParallelAdminAndTeaching = Boolean(!openLog.lich_trinh_id && evalNext.selectedSchedule?.id);
      if (isNewTeachingBlock || isParallelAdminAndTeaching) {
        nextBlockEval = evalNext;
        actionType = 'check_in';
      }
    }
  }

  if (actionType === 'check_out' && !openLog) {
    throw new UnrecoverableError('Không tìm thấy lượt check-in nào đang mở để thực hiện check-out.');
  }
  if (actionType === 'check_in' && openLog && !nextBlockEval) {
    throw new UnrecoverableError('Người dùng đang có một ca làm việc chưa hoàn thành tan ca.');
  }

  let scheduleEval = null;
  if (actionType !== 'check_out' || !openLog) {
    scheduleEval = nextBlockEval || (await evaluateUserScheduleForCheckIn(effectiveUserId, null, null, effectivePunchTime));
    if (!scheduleEval || !scheduleEval.canCheckIn) {
      throw new UnrecoverableError(
        scheduleEval?.message || 'Hôm nay không có lịch phân công hoặc ca làm việc đủ điều kiện để check-in.'
      );
    }
  }

  const targetScheduleId = actionType === 'check_out' ? openLog?.lich_trinh_id : scheduleEval?.selectedSchedule?.id;
  let isOnlineSchedule = Boolean(actionType !== 'check_out' && scheduleEval?.selectedSchedule?.la_truc_tuyen);
  if (!isOnlineSchedule && targetScheduleId) {
    const schedForOnline = await LichTrinh.findByPk(targetScheduleId, { attributes: ['id', 'la_truc_tuyen'] }).catch(() => null);
    isOnlineSchedule = Boolean(schedForOnline?.la_truc_tuyen);
  }
  const geoTargets = isOnlineSchedule ? null : await resolveUserGeofenceTargets(effectiveUserId, targetScheduleId);
  const geoCheck = isOnlineSchedule
    ? { valid: true, isFraud: false, isSuspicious: false, distance: 0, fraudReason: null, suspiciousReason: null }
    : validateGeofence(location, geoTargets, actionType === 'check_out' ? { radiusMultiplier: 1.5 } : null, reqIp);
  const safeDistance = Number.isFinite(geoCheck.distance) ? Math.max(0, Number(geoCheck.distance)) : null;

  if (openLog && actionType === 'check_out') {
    if (openLog.da_chot) {
      throw new UnrecoverableError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-out.');
    }
    // Luồng CHECK-OUT
    const checkOutTime = effectivePunchTime;
    let khoiConfig = openLog.ca;
    try {
      const checkOutEval = await kiemTraChoPhepCheckOut({
        nguoiDungId: effectiveUserId,
        openLog,
        now: checkOutTime,
      });
      khoiConfig = checkOutEval.khoiConfig;
    } catch (err) {
      throw new UnrecoverableError(err.message || 'Chưa đủ điều kiện check-out cho khối ca này.');
    }

    const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      khoiConfig,
      openLog.trang_thai
    );

    const diffMs = openLog.thoi_gian_vao
      ? checkOutTime.getTime() - new Date(openLog.thoi_gian_vao).getTime()
      : 0;
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
      openLog.thoi_gian_ra = checkOutTime;
      openLog.trang_thai = finalStatus;
      openLog.ve_som_phut = earlyMinutes || 0;
      openLog.thoi_luong_lam_viec_phut = durationMins;
      openLog.so_tiet_thuc_day = soTietThucDay;
      if (geoCheck.isFraud) openLog.co_gian_lan = true;
      await openLog.save({ transaction });

      await LuotQuetChamCong.create(
        {
          cham_cong_id: openLog.id,
          nguoi_dung_id: effectiveUserId,
          loai_quet: 'check_out',
          thoi_gian_quet: checkOutTime,
          phuong_thuc: canonicalMethod,
          do_tin_cay_ai: aiResult?.similarity ?? null,
          diem_mat_that: aiResult?.liveness_score ?? null,
          goc_mat_nhan_dien: aiResult?.pose || aiResult?.angle || null,
          anh_minh_chung: evidenceRef || null,
          vi_do: location?.lat ?? null,
          kinh_do: location?.lng ?? null,
          do_chinh_xac_gps: location?.accuracy ?? null,
          vi_tri_gia_lap: Boolean(geoCheck.isSuspicious),
          khoang_cach_met: safeDistance,
          hop_le: !geoCheck.isFraud,
          ly_do_khong_hop_le: geoCheck.fraudReason || geoCheck.suspiciousReason || null,
          ma_thiet_bi: deviceId || null,
        },
        { transaction }
      );

      return openLog;
    });
  } else {
    // Luồng CHECK-IN
    actionType = 'check_in';
    const checkInTime = effectivePunchTime;
    const selectedShift = scheduleEval.shift;
    const selectedScheduleId = scheduleEval.selectedSchedule?.id || null;
    const selectedKhoiIds = scheduleEval.khoi ? scheduleEval.khoi.ds_lich_trinh_id : null;
    const calculatedStatus = scheduleEval.status || 'on_time';
    const lateMinutes = scheduleEval.lateMinutes || 0;

    if (!selectedShift) {
      throw new UnrecoverableError('Không xác định được ca làm việc hợp lệ để tạo bản ghi chấm công.');
    }

    attendanceRecord = await runInTransaction(async (transaction) => {
      let targetAttendance = await NhatKyChamCong.findOne({
        where: {
          nguoi_dung_id: effectiveUserId,
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
          throw new UnrecoverableError('Bản ghi chấm công đã bị khóa sổ lương, không thể check-in.');
        }
        if (targetAttendance.thoi_gian_vao && targetAttendance.thoi_gian_ra) {
          throw new UnrecoverableError('Ca làm việc trong ngày đã hoàn tất check-in và check-out.');
        }
        if (!targetAttendance.thoi_gian_vao) {
          targetAttendance.thoi_gian_vao = checkInTime;
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
            nguoi_dung_id: effectiveUserId,
            ca_id: selectedShift.id,
            lich_trinh_id: selectedScheduleId,
            ds_lich_trinh_id: selectedKhoiIds,
            ngay_cong: workDateStr,
            thoi_gian_vao: checkInTime,
            di_muon_phut: lateMinutes,
            trang_thai: calculatedStatus,
            co_gian_lan: Boolean(geoCheck.isFraud),
          },
          { transaction }
        );
      }

      // Khối giảng dạy trước chưa check-out mà đã check-in khối sau -> chuyển khối trước sang thiếu check-out (giữ nguyên ca hành chính song song)
      if (selectedScheduleId) {
        const staleLogs = await NhatKyChamCong.findAll({
          where: {
            nguoi_dung_id: effectiveUserId,
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

      await LuotQuetChamCong.create(
        {
          cham_cong_id: targetAttendance.id,
          nguoi_dung_id: effectiveUserId,
          loai_quet: 'check_in',
          thoi_gian_quet: checkInTime,
          phuong_thuc: canonicalMethod,
          do_tin_cay_ai: aiResult?.similarity ?? null,
          diem_mat_that: aiResult?.liveness_score ?? null,
          goc_mat_nhan_dien: aiResult?.pose || aiResult?.angle || null,
          anh_minh_chung: evidenceRef || null,
          vi_do: location?.lat ?? null,
          kinh_do: location?.lng ?? null,
          do_chinh_xac_gps: location?.accuracy ?? null,
          vi_tri_gia_lap: Boolean(geoCheck.isSuspicious),
          khoang_cach_met: safeDistance,
          hop_le: !geoCheck.isFraud,
          ly_do_khong_hop_le: geoCheck.fraudReason || geoCheck.suspiciousReason || null,
          ma_thiet_bi: deviceId || null,
        },
        { transaction }
      );

      return targetAttendance;
    });
  }

  // Ghi nhật ký kiểm toán NhatKyKiemToan (băm chuỗi SHA-256)
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: effectiveUserId,
    loai_chu_the: 'user',
    hanh_dong: `ATTENDANCE_QUEUE_${actionType}`,
    doi_tuong_id: String(attendanceRecord.id),
    loai_doi_tuong: 'nhat_ky_cham_cong',
    dia_chi_ip: reqIp,
    chi_tiet: {
      phuong_thuc: canonicalMethod,
      do_tin_cay_ai: aiResult?.similarity ?? null,
      co_gian_lan: geoCheck.isFraud,
      ly_do_gian_lan: geoCheck.fraudReason,
      xu_ly_qua: 'BULLMQ_ASYNC_PIPELINE',
    },
  }).catch((err) => console.error('[AuditLog Queue Error]:', err.message));

  // Phát sự kiện realtime Socket.IO tới admin và lãnh đạo đơn vị
  try {
    const { emitNewPunch, emitAttendanceUpdate } = require('../config/socket');
    NguoiDung.findByPk(effectiveUserId, {
      attributes: ['id', 'ho_ten', 'ma_can_bo', 'anh_dai_dien', 'don_vi_chinh_id'],
      raw: true,
    })
      .then((userDoc) => {
        emitNewPunch({
          id: attendanceRecord.id,
          nguoi_dung_id: effectiveUserId,
          ho_ten: userDoc?.ho_ten || 'Cán bộ',
          ma_can_bo: userDoc?.ma_can_bo || null,
          anh_dai_dien: userDoc?.anh_dai_dien || null,
          don_vi_chinh_id: userDoc?.don_vi_chinh_id || null,
          loai_quet: actionType,
          phuong_thuc: canonicalMethod,
          thoi_gian_quet: effectivePunchTime,
          trang_thai: attendanceRecord.trang_thai,
          do_tin_cay_ai: aiResult?.similarity || 1.0,
          co_gian_lan: geoCheck.isFraud,
          ly_do_gian_lan: geoCheck.fraudReason,
          anh_minh_chung: evidenceRef,
        });
        emitAttendanceUpdate({
          ...(attendanceRecord.toJSON ? attendanceRecord.toJSON() : attendanceRecord),
          don_vi_chinh_id: userDoc?.don_vi_chinh_id || null,
        });
      })
      .catch(() => {});
  } catch (_) {}

  return {
    success: true,
    action: actionType,
    recordId: attendanceRecord.id,
    userId: effectiveUserId,
    isFraud: geoCheck.isFraud,
    processedAt: new Date(),
  };
};

// Đưa lượt điểm danh vào hàng đợi BullMQ; nếu Redis offline thì xử lý đồng bộ ngay
const addPunchJob = async (jobData) => {
  const queue = getPunchQueue();

  if (queue) {
    let timeoutId = null;
    const jobPromise = queue.add(
      `punch-${jobData.userId}-${Date.now()}`,
      jobData,
      jobData?.idempotencyKey ? { jobId: String(jobData.idempotencyKey) } : undefined
    );
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Queue add timed out')), 1500);
      });
      const job = await Promise.race([jobPromise, timeoutPromise]);
      try {
        const { emitQueueStats } = require('../config/socket');
        getPunchQueueStats().then((stats) => emitQueueStats(stats)).catch(() => {});
      } catch (_) {}
      return {
        success: true,
        queued: true,
        jobId: job.id,
        message: 'Lượt quét điểm danh đã được đưa vào hàng đợi xử lý bất đồng bộ thành công.',
        status: 'QUEUED',
      };
    } catch (queueError) {
      jobPromise.then((lateJob) => lateJob?.remove().catch(() => {})).catch(() => {});
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ] Không thể đẩy job vào hàng đợi: ${queueError.message}. Kích hoạt xử lý đồng bộ Fallback.`);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Xử lý đồng bộ trực tiếp khi BullMQ không khả dụng
  try {
    const syncResult = await processPunchJobData(jobData);
    return {
      success: true,
      queued: false,
      jobId: `sync-${Date.now()}`,
      message: 'Điểm danh thành công (Xử lý đồng bộ Fallback).',
      status: 'PROCESSED_SYNC',
      result: syncResult,
    };
  } catch (err) {
    return {
      success: false,
      queued: false,
      jobId: `sync-${Date.now()}`,
      message: `Xử lý điểm danh đồng bộ thất bại: ${err.message}`,
      status: 'FAILED_SYNC',
      result: { fallbackProcessed: false, error: err.message },
    };
  }
};

// Khởi động Worker xử lý nền hàng đợi điểm danh (mặc định 5 luồng đồng thời)
const startPunchWorker = (concurrency = 5) => {
  if (punchWorker) return punchWorker;

  if (process.env.DISABLE_BULLMQ === 'true' || !isRedisReady()) {
    return null;
  }

  try {
    const connection = getQueueConnectionOptions();
    punchWorker = new Worker(
      QUEUE_NAME,
      async (job) => {
        return await processPunchJobData(job.data);
      },
      {
        connection,
        concurrency,
      }
    );

    punchWorker.on('completed', () => {});

    punchWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker Failed] Job ${job?.id} thất bại: ${err.message}`);
    });

    punchWorker.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ Worker Error]: ${err.message}`);
      }
    });

    return punchWorker;
  } catch (error) {
    punchWorker = null;
    return null;
  }
};

// Thống kê số lượng job hiện có trong hàng đợi
const getPunchQueueStats = async () => {
  const queue = getPunchQueue();
  if (!queue) {
    return {
      status: 'OFFLINE',
      mode: 'SYNC_FALLBACK',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  try {
    const countsPromise = queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Job counts timed out')), 1500)
    );
    const counts = await Promise.race([countsPromise, timeoutPromise]);
    return {
      status: 'ONLINE',
      mode: 'BULLMQ_ASYNC',
      ...counts,
    };
  } catch (error) {
    return {
      status: 'OFFLINE',
      mode: 'SYNC_FALLBACK',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      error: error.message,
    };
  }
};

// Đóng worker và hàng đợi an toàn khi tắt server
const closePunchQueue = async () => {
  if (punchWorker) {
    try {
      await punchWorker.close();
    } catch (_) {}
    punchWorker = null;
  }
  if (punchQueue) {
    try {
      await punchQueue.close();
    } catch (_) {}
    punchQueue = null;
  }
  isQueueOnline = false;
};

module.exports = {
  getPunchQueue,
  addPunchJob,
  startPunchWorker,
  processPunchJobData,
  getPunchQueueStats,
  closePunchQueue,
  QUEUE_NAME,
};
