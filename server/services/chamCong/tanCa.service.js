/**
 * Check-Out Service (server/services/attendance/checkOut.service.js)
 * Chuẩn hóa Sequelize + SQL Server 3NF (NhatKyChamCong, LuotQuetChamCong, LichTrinh, CaLamViec, NguoiDung).
 */
const { Op } = require('sequelize');
const { NhatKyChamCong, LuotQuetChamCong, LichTrinh, CaLamViec, NguoiDung } = require('../../models');
const { sendCheckOutNotificationEmail } = require('../heThong/guiEmail.service');
const { validateGeofence, resolveUserGeofenceTargets } = require('../../utils/hoTroChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const {
  ServiceError,
  normalizeAttendanceMethod,
  calculateActualTeachingPeriods,
  getVietnamTime,
  getVietnamDayRange,
  calculateCheckOutStatus,
} = require('../../utils/thoiGianChamCong.utils');

const performCheckOut = async ({
  nguoi_dung_id,
  ca_id,
  cham_cong_id,
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
      'Phương thức điểm danh thủ công đã bị vô hiệu hóa đối với tài khoản này.',
      403,
      'MANUAL_ATTENDANCE_DISABLED'
    );
  }
  if (!allowManual && rawMethod !== 'gps_mobile') {
    throw new ServiceError(
      'Phương thức chấm công không hợp lệ cho luồng tan ca GPS.',
      400,
      'INVALID_ATTENDANCE_METHOD'
    );
  }
  const finalMethod = allowManual && rawMethod === 'thu_cong_admin' ? 'thu_cong_admin' : 'gps_mobile';

  const lat = vi_do !== undefined && vi_do !== null && vi_do !== '' ? Number(vi_do) : null;
  const lng = kinh_do !== undefined && kinh_do !== null && kinh_do !== '' ? Number(kinh_do) : null;
  const acc = do_chinh_xac !== undefined && do_chinh_xac !== null && do_chinh_xac !== '' ? Number(do_chinh_xac) : null;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  if (!allowManual && !hasCoordinates) {
    throw new ServiceError(
      'Chấm công tan ca bắt buộc phải gửi tọa độ GPS hợp lệ.',
      400,
      'ATTENDANCE_GPS_REQUIRED'
    );
  }

  const now = new Date();
  const { dateStr } = getVietnamDayRange(now);

  const where = {
    nguoi_dung_id,
    ngay_cong: dateStr,
    thoi_gian_vao: { [Op.ne]: null },
    thoi_gian_ra: null,
  };

  if (cham_cong_id && isValidUuid(String(cham_cong_id))) {
    where.id = cham_cong_id;
  } else if (ca_id && isValidUuid(String(ca_id))) {
    where.ca_id = ca_id;
  }

  let openLog = await NhatKyChamCong.findOne({
    where,
    include: [{ model: CaLamViec, as: 'ca' }],
  });

  if (!openLog) {
    const overnightCutoff = new Date(now.getTime() - 18 * 60 * 60 * 1000);
    const { dateStr: yesterdayStr } = getVietnamDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    openLog = await NhatKyChamCong.findOne({
      where: {
        nguoi_dung_id,
        ngay_cong: { [Op.in]: [dateStr, yesterdayStr] },
        thoi_gian_vao: { [Op.gte]: overnightCutoff },
        thoi_gian_ra: null,
        ...(cham_cong_id && isValidUuid(String(cham_cong_id))
          ? { id: cham_cong_id }
          : ca_id && isValidUuid(String(ca_id))
          ? { ca_id }
          : {}),
      },
      include: [{ model: CaLamViec, as: 'ca' }],
      order: [['thoi_gian_vao', 'DESC']],
    });
  }

  if (!openLog) {
    throw new ServiceError(
      'Không tìm thấy lượt check-in nào đang mở cần check-out trong ngày hôm nay.',
      404,
      'ATTENDANCE_NO_OPEN_RECORD'
    );
  }

  if (openLog.da_chot) {
    throw new ServiceError(
      'Bản ghi chấm công đã bị khóa sổ lương, không thể check-out hoặc chỉnh sửa.',
      409,
      'ATTENDANCE_LOCKED'
    );
  }

  let isFraud = false;
  let fraudReason = null;
  let geofenceMeta = null;

  if (finalMethod === 'gps_mobile' || hasCoordinates) {
    if (acc !== null && Number.isFinite(acc) && acc > 150) {
      throw new ServiceError(
        `Độ chính xác GPS không đủ tin cậy (sai số ${acc}m vượt ngưỡng cho phép <= 150m). Vui lòng di chuyển ra nơi thoáng.`,
        400,
        'GPS_ACCURACY_UNRELIABLE',
        { accuracy: acc }
      );
    }
    if (hasCoordinates) {
      const geoTargets = await resolveUserGeofenceTargets(nguoi_dung_id, openLog.lich_trinh_id);
      const geofenceResult = validateGeofence({ lat, lng, accuracy: acc }, geoTargets, null, dia_chi_ip);
      geofenceMeta = geofenceResult;
      if (!geofenceResult.valid) {
        isFraud = true;
        fraudReason = geofenceResult.fraudReason || `Tọa độ GPS check-out nằm ngoài bán kính cho phép (${Math.round(geofenceResult.distance)}m so với tâm trường).`;
      }
    }
  }

  const { finalStatus, earlyMinutes } = calculateCheckOutStatus(
    now,
    openLog.ca,
    openLog.trang_thai
  );

  let workingMinutes = openLog.thoi_luong_lam_viec_phut || 0;
  let soGioCong = 0;
  if (openLog.thoi_gian_vao) {
    const diffMs = now.getTime() - new Date(openLog.thoi_gian_vao).getTime();
    workingMinutes = Math.max(0, Math.round(diffMs / 60000));
    soGioCong = parseFloat((workingMinutes / 60).toFixed(2));
  }

  const soTietThucDay = await calculateActualTeachingPeriods(
    {
      lichTrinhId: openLog.lich_trinh_id,
      workingMinutes,
      earlyMinutes: earlyMinutes || 0,
    },
    LichTrinh
  );

  let punchLog = null;
  await runInTransaction(async (transaction) => {
    punchLog = await LuotQuetChamCong.create(
      {
        cham_cong_id: openLog.id,
        nguoi_dung_id,
        loai_quet: 'check_out',
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

    openLog.thoi_gian_ra = now;
    openLog.trang_thai = finalStatus;
    openLog.ve_som_phut = earlyMinutes || 0;
    openLog.thoi_luong_lam_viec_phut = workingMinutes;
    openLog.so_tiet_thuc_day = soTietThucDay;
    if (isFraud) openLog.co_gian_lan = true;

    await openLog.save({ transaction });
  });

  NguoiDung.findByPk(nguoi_dung_id, { attributes: ['email', 'ho_ten'] })
    .then((user) => {
      if (user && user.email) {
        sendCheckOutNotificationEmail({
          to: user.email,
          fullName: user.ho_ten || 'Thầy/Cô',
          checkInTime: openLog.thoi_gian_vao,
          checkOutTime: now,
          isEarlyLeave: earlyMinutes > 0,
          earlyMinutes,
          method: finalMethod,
        }).catch(() => {});
      }
    })
    .catch(() => {});

  return {
    success: true,
    message: isFraud ? `Check-out thành công có cảnh báo: ${fraudReason}` : 'Check-out hoàn tất phiên làm việc thành công.',
    attendanceLog: openLog,
    punchLog,
    trang_thai: finalStatus,
    so_gio_cong: openLog.so_gio_cong,
    ve_som_phut: openLog.ve_som_phut,
    co_gian_lan: isFraud,
    ly_do_gian_lan: fraudReason,
  };
};

module.exports = { performCheckOut };
