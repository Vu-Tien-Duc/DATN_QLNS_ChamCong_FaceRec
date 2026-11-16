/**
 * Attendance Admin Service (server/services/attendance/attendanceAdmin.service.js)
 * Chuẩn hóa Sequelize + SQL Server 3NF (NhatKyChamCong, NhatKyKiemToan).
 */
const { NhatKyChamCong, NhatKyKiemToan } = require('../../models');
const { updateCampusConfig } = require('../../utils/hoTroChamCong');
const { ServiceError } = require('../../utils/thoiGianChamCong.utils');
const { isValidUuid } = require('../../utils/hoTroSequelize');

const updateAttendanceByAdmin = async ({
  id,
  nguoi_thuc_hien_id,
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

  if (log.thoi_gian_vao && log.thoi_gian_ra) {
    const diffMs = log.thoi_gian_ra.getTime() - log.thoi_gian_vao.getTime();
    log.thoi_luong_lam_viec_phut = Math.max(0, Math.round(diffMs / 60000));
  }

  await log.save();

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
  updateCampusConfig,
};
