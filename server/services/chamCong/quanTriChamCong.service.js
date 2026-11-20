// Điều chỉnh bản ghi chấm công (Admin/BGH/Lãnh đạo đơn vị) và ghi vết vào NhatKyKiemToan
const { NhatKyChamCong, NhatKyKiemToan, NguoiDung, VaiTroNguoiDung, LichTrinh, CaLamViec } = require('../../models');
const {
  ServiceError,
  calculateActualTeachingPeriods,
  calculateCheckOutStatus,
  getVietnamTime,
  timeStringToMinutes,
} = require('../../utils/thoiGianChamCong.utils');
const { layKhoiTheoLichTrinh } = require('./khoiCaDay.service');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { GLOBAL_ADMIN_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');

// Điều chỉnh thủ công bản ghi chấm công bởi quản trị hoặc trưởng đơn vị và ghi nhật ký kiểm toán
const updateAttendanceByAdmin = async ({
  id,
  nguoi_thuc_hien_id,
  currentUser = null,
  dia_chi_ip,
  trang_thai,
  thoi_gian_vao,
  thoi_gian_ra,
  don_tu_id,
  co_gian_lan,
  ly_do_ghi_de,
}) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Định dạng mã bản ghi chấm công không hợp lệ.', 400);
  }

  const log = await NhatKyChamCong.findByPk(id);
  if (!log) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công cần điều chỉnh.', 404);
  }

  let actor = currentUser;
  if (!actor && nguoi_thuc_hien_id && isValidUuid(nguoi_thuc_hien_id)) {
    actor = await NguoiDung.findByPk(nguoi_thuc_hien_id, {
      attributes: ['id', 'vai_tro_chinh', 'don_vi_chinh_id'],
      include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro', 'don_vi_id', 'tu_ngay', 'den_ngay'] }],
    });
  }
  if (actor) {
    const isGlobalAdmin = hasAnyActiveRole(actor, GLOBAL_ADMIN_ROLES);
    if (!isGlobalAdmin && String(actor.id) === String(log.nguoi_dung_id)) {
      throw new ServiceError(
        'Lãnh đạo đơn vị không được tự điều chỉnh bản ghi chấm công của chính mình.',
        403,
        'CANNOT_OVERRIDE_OWN_ATTENDANCE'
      );
    }
    const inScope = await isUserInDeanScope(actor, log.nguoi_dung_id);
    if (!inScope) {
      throw new ServiceError(
        'Bạn không có quyền điều chỉnh bản ghi chấm công của nhân sự ngoài đơn vị quản lý.',
        403,
        'ATTENDANCE_OUT_OF_SCOPE'
      );
    }
  }
  if (log.da_chot) {
    throw new ServiceError(
      'Bản ghi chấm công đã được chốt sổ lương (da_chot = true). Vui lòng mở khóa bảng lương trước khi chỉnh sửa.',
      403,
      'ATTENDANCE_LOCKED_BY_PAYROLL'
    );
  }

  const previousData = {
    trang_thai: log.trang_thai,
    thoi_gian_vao: log.thoi_gian_vao,
    thoi_gian_ra: log.thoi_gian_ra,
    co_gian_lan: log.co_gian_lan,
    don_tu_id: log.don_tu_id,
  };

  const nextCheckInTime = thoi_gian_vao !== undefined ? (thoi_gian_vao ? new Date(thoi_gian_vao) : null) : log.thoi_gian_vao;
  const nextCheckOutTime = thoi_gian_ra !== undefined ? (thoi_gian_ra ? new Date(thoi_gian_ra) : null) : log.thoi_gian_ra;

  if (nextCheckInTime && Number.isNaN(nextCheckInTime.getTime())) {
    throw new ServiceError('Thời điểm check-in không hợp lệ.', 400);
  }
  if (nextCheckOutTime && Number.isNaN(nextCheckOutTime.getTime())) {
    throw new ServiceError('Thời điểm check-out không hợp lệ.', 400);
  }
  if (nextCheckInTime && nextCheckOutTime && nextCheckOutTime < nextCheckInTime) {
    throw new ServiceError('Thời điểm check-out không thể diễn ra trước thời điểm check-in.', 400);
  }

  if (trang_thai !== undefined) log.trang_thai = trang_thai;
  if (thoi_gian_vao !== undefined) log.thoi_gian_vao = nextCheckInTime;
  if (thoi_gian_ra !== undefined) log.thoi_gian_ra = nextCheckOutTime;
  if (don_tu_id !== undefined) log.don_tu_id = don_tu_id || null;
  if (co_gian_lan !== undefined) log.co_gian_lan = Boolean(co_gian_lan);

  log.nguoi_ghi_de_id = nguoi_thuc_hien_id || null;
  log.ly_do_ghi_de = ly_do_ghi_de || 'Quản trị viên hiệu chỉnh bản ghi chấm công';

  if (log.trang_thai === 'absent' || log.trang_thai === 'thieu_check_out' || log.trang_thai === 'excused_absence') {
    log.so_tiet_thuc_day = 0;
    log.di_muon_phut = 0;
    log.ve_som_phut = 0;
    if (log.trang_thai === 'absent' || log.trang_thai === 'excused_absence') {
      log.thoi_luong_lam_viec_phut = 0;
    }
  } else {
    const khoi = log.lich_trinh_id
      ? await layKhoiTheoLichTrinh(log.nguoi_dung_id, log.lich_trinh_id, log.ngay_cong).catch(() => null)
      : null;
    const shiftDoc = !khoi && log.ca_id ? await CaLamViec.findByPk(log.ca_id, { attributes: ['gio_bat_dau', 'gio_ket_thuc'] }) : null;
    const timeCfg = khoi
      ? { gio_bat_dau: khoi.gio_bat_dau, gio_ket_thuc: khoi.gio_ket_thuc }
      : shiftDoc
      ? { gio_bat_dau: shiftDoc.gio_bat_dau, gio_ket_thuc: shiftDoc.gio_ket_thuc }
      : null;

    if (thoi_gian_vao !== undefined) {
      if (log.thoi_gian_vao && timeCfg?.gio_bat_dau) {
        const vnIn = getVietnamTime(log.thoi_gian_vao);
        const inMins = vnIn.getHours() * 60 + vnIn.getMinutes();
        const startMins = timeStringToMinutes(timeCfg.gio_bat_dau);
        log.di_muon_phut = Math.max(0, inMins - startMins);
      } else if (!log.thoi_gian_vao) {
        log.di_muon_phut = 0;
      }
    }

    if (thoi_gian_ra !== undefined) {
      if (log.thoi_gian_ra && timeCfg?.gio_ket_thuc) {
        log.ve_som_phut = calculateCheckOutStatus(log.thoi_gian_ra, timeCfg, log.trang_thai).earlyMinutes;
      } else if (!log.thoi_gian_ra) {
        log.ve_som_phut = 0;
      }
    }

    if (log.thoi_gian_vao && log.thoi_gian_ra) {
      const diffMs = log.thoi_gian_ra.getTime() - log.thoi_gian_vao.getTime();
      log.thoi_luong_lam_viec_phut = Math.max(0, Math.round(diffMs / 60000));
      if (log.lich_trinh_id || (Array.isArray(log.ds_lich_trinh_id) && log.ds_lich_trinh_id.length > 0)) {
        log.so_tiet_thuc_day = await calculateActualTeachingPeriods(
          {
            lichTrinhId: log.lich_trinh_id,
            lichTrinhIds: log.ds_lich_trinh_id,
            workingMinutes: log.thoi_luong_lam_viec_phut,
            earlyMinutes: log.ve_som_phut || 0,
          },
          LichTrinh
        );
      }
    }
  }

  await log.save();

  const logOwner = await NguoiDung.findByPk(log.nguoi_dung_id, { attributes: ['don_vi_chinh_id'] }).catch(() => null);

  try {
    const { emitAttendanceUpdate } = require('../../config/socket');
    emitAttendanceUpdate({
      ...(log.toJSON ? log.toJSON() : log),
      don_vi_chinh_id: logOwner?.don_vi_chinh_id || null,
      chinh_sua_thu_cong: true,
    });
  } catch (_) {}

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id,
    loai_chu_the: 'user',
    hanh_dong: 'ADMIN_OVERRIDE_ATTENDANCE',
    doi_tuong_id: String(log.id),
    loai_doi_tuong: 'nhat_ky_cham_cong',
    dia_chi_ip,
    chi_tiet: {
      previousData,
      newData: {
        trang_thai: log.trang_thai,
        thoi_gian_vao: log.thoi_gian_vao,
        thoi_gian_ra: log.thoi_gian_ra,
        co_gian_lan: log.co_gian_lan,
        ly_do_ghi_de: log.ly_do_ghi_de,
      },
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return log;
};

module.exports = {
  updateAttendanceByAdmin,
};
