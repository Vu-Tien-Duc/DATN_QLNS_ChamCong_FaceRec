/**
 * Tổng hợp thông báo của người dùng từ các sự kiện chấm công, lịch và đơn nghỉ.
 * Chuẩn hóa Sequelize + SQL Server 3NF.
 */
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  DonNghiPhep,
  LichTrinh,
  CaLamViec,
  NguoiDung,
} = require('../../models');
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { getVietnamTime, getVietnamDayRange } = require('../../utils/thoiGianChamCong.utils');
const { normalizeRole, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES } = require('../../utils/vaiTro.utils');

const formatDateTimeVN = (date) =>
  date
    ? new Date(date).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

const formatTimeVN = (date) =>
  date
    ? new Date(date).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const formatDateVN = (date) =>
  date
    ? new Date(date).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

const getNotifications = async ({ nguoi_dung_id, userId, thoi_diem_doc_gan_nhat, lastReadAt: lastReadAtInput }) => {
  const targetUserId = nguoi_dung_id || userId;
  if (!targetUserId) return { total: 0, unreadCount: 0, notifications: [] };

  const user = await NguoiDung.findByPk(targetUserId);
  if (!user) return { total: 0, unreadCount: 0, notifications: [] };

  const notifications = [];
  const recentAttendances = await NhatKyChamCong.findAll({
    where: { nguoi_dung_id: user.id },
    include: [
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
      { model: LuotQuetChamCong, as: 'luot_quet', attributes: ['phuong_thuc'], limit: 1 },
    ],
    order: [['tao_luc', 'DESC']],
    limit: 4,
  });

  recentAttendances.forEach((attendance) => {
    const shiftName = attendance.ca?.ten_ca || 'Ca làm việc';
    const methodLabel = (attendance.luot_quet?.[0]?.phuong_thuc || 'face_ai').toUpperCase();

    if (attendance.thoi_gian_ra) {
      notifications.push({
        id: `att-out-${attendance.id}`,
        title: `Đã check-out: ${shiftName}`,
        message: `Check-out thành công lúc ${formatTimeVN(attendance.thoi_gian_ra)}. Email biên nhận điểm danh đã gửi về ${user.email}.`,
        type: 'attendance',
        status: 'success',
        timestamp: attendance.thoi_gian_ra,
        link: '/attendance/history',
      });
    } else if (attendance.thoi_gian_vao) {
      const isLate = attendance.trang_thai === 'late';
      notifications.push({
        id: `att-in-${attendance.id}`,
        title: `Điểm danh thành công (${isLate ? 'Đến muộn' : 'Đúng giờ'}): ${shiftName}`,
        message: `Ghi nhận check-in lúc ${formatTimeVN(attendance.thoi_gian_vao)} (Phương thức: ${methodLabel}). Đã đồng bộ vào hệ thống & gửi email.`,
        type: 'attendance',
        status: isLate ? 'warning' : 'success',
        timestamp: attendance.thoi_gian_vao,
        link: '/attendance/history',
      });
    } else if (attendance.trang_thai === 'absent') {
      notifications.push({
        id: `att-absent-${attendance.id}`,
        title: `Cảnh báo vắng mặt: ${shiftName}`,
        message: `Hệ thống ghi nhận vắng mặt ngày ${formatDateVN(attendance.tao_luc)}. Thông báo cảnh báo đã được gửi về email cá nhân.`,
        type: 'attendance',
        status: 'danger',
        timestamp: attendance.tao_luc,
        link: '/leave/create',
      });
    }
  });

  const uRole = normalizeRole(user.vai_tro_chinh);
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(uRole)) {
    const requests = await DonNghiPhep.findAll({
      where: { nguoi_dung_id: user.id },
      order: [['cap_nhat_luc', 'DESC']],
      limit: 3,
    });
    requests.forEach((leave) => {
      const date = `từ ${formatDateVN(leave.ngay_bat_dau)} đến ${formatDateVN(leave.ngay_ket_thuc)}`;
      if (leave.trang_thai === 'approved') {
        notifications.push({
          id: `leave-${leave.id}`,
          title: 'Đơn xin nghỉ phép đã được duyệt',
          message: `Đơn nghỉ ${date} đã được phê duyệt. Thông báo xác nhận đã gửi về email.`,
          type: 'leave',
          status: 'success',
          timestamp: leave.cap_nhat_luc || leave.tao_luc,
          link: '/leave/my-requests',
        });
      } else if (leave.trang_thai === 'rejected') {
        notifications.push({
          id: `leave-${leave.id}`,
          title: 'Đơn xin nghỉ phép bị từ chối',
          message: `Đơn nghỉ từ ${formatDateVN(leave.ngay_bat_dau)} bị từ chối${leave.ly_do_tu_choi ? `: "${leave.ly_do_tu_choi}"` : ''}.`,
          type: 'leave',
          status: 'danger',
          timestamp: leave.cap_nhat_luc || leave.tao_luc,
          link: '/leave/my-requests',
        });
      } else if (['pending', 'pending_dean', 'pending_bgh'].includes(leave.trang_thai)) {
        notifications.push({
          id: `leave-${leave.id}`,
          title: 'Đơn xin nghỉ phép đang chờ duyệt',
          message: `Đơn xin nghỉ gửi lúc ${formatDateTimeVN(leave.tao_luc)} đang chờ cấp quản lý xem xét và duyệt.`,
          type: 'leave',
          status: 'info',
          timestamp: leave.tao_luc,
          link: '/leave/my-requests',
        });
      }
    });
  } else if (UNIT_LEADER_ROLES.includes(uRole) || GLOBAL_ADMIN_ROLES.includes(uRole)) {
    const pendingWhere = { trang_thai: { [Op.in]: ['pending', 'pending_dean', 'pending_bgh'] } };
    if (UNIT_LEADER_ROLES.includes(uRole)) {
      const scopedIds = await getDeanScopedUserIds(user);
      pendingWhere.nguoi_dung_id = { [Op.in]: scopedIds.length ? scopedIds : ['00000000-0000-0000-0000-000000000000'] };
    }
    const pendingLeaves = await DonNghiPhep.findAll({
      where: pendingWhere,
      include: [{ model: NguoiDung, as: 'nguoi_dung', attributes: ['id', 'ho_ten', 'email'] }],
      order: [['tao_luc', 'DESC']],
      limit: 3,
    });
    if (pendingLeaves.length) {
      notifications.push({
        id: 'leave-pending-summary',
        title: `Hộp duyệt đơn: ${pendingLeaves.length} đơn cần xử lý`,
        message: `Có đơn xin nghỉ phép từ ${pendingLeaves.map((leave) => leave.nguoi_dung?.ho_ten || 'cán bộ').join(', ')} đang chờ phê duyệt.`,
        type: 'leave',
        status: 'warning',
        timestamp: pendingLeaves[0].tao_luc,
        link: '/leave/approvals',
      });
    }
  }

  const nowVN = getVietnamTime();
  const { startOfDay, dateStr } = getVietnamDayRange(nowVN);
  const todaySchedules = await LichTrinh.findAll({
    where: {
      nguoi_dung_id: user.id,
      thu_trong_tuan: nowVN.getDay(),
      ngay_bat_dau: { [Op.lte]: dateStr },
      ngay_ket_thuc: { [Op.gte]: dateStr },
    },
    include: [{ model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] }],
  });

  if (todaySchedules.length) {
    notifications.push({
      id: 'schedule-today',
      title: `Lịch giảng dạy hôm nay (${todaySchedules.length} ca)`,
      message: `Hôm nay bạn có lịch: ${todaySchedules
        .map((schedule) => `${schedule.ca?.ten_ca || 'Ca dạy'} (${schedule.ca?.gio_bat_dau || ''} - ${schedule.ca?.gio_ket_thuc || ''})`)
        .join(', ')}. Vui lòng thực hiện điểm danh đúng khung giờ.`,
      type: 'schedule',
      status: 'info',
      timestamp: startOfDay,
      link: '/schedules',
    });
  }

  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const effectiveLastRead = thoi_diem_doc_gan_nhat || lastReadAtInput;
  const lastReadAt = effectiveLastRead ? new Date(effectiveLastRead) : null;
  const unreadCount =
    lastReadAt && !Number.isNaN(lastReadAt.getTime())
      ? notifications.filter((notification) => new Date(notification.timestamp).getTime() > lastReadAt.getTime()).length
      : notifications.length > 0
        ? 1
        : 0;

  return {
    total: notifications.length,
    unreadCount,
    notifications: notifications.slice(0, 10),
  };
};

module.exports = { getNotifications };
