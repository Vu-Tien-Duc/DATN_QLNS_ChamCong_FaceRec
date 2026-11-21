// Tổng hợp thông báo cho người dùng từ sự kiện chấm công, lịch trình và đơn nghỉ.
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  DonNghiPhep,
  LichTrinh,
  LichTrinhTuan,
  NgoaiLeLichTrinh,
  NgayNghiLe,
  CaLamViec,
  NguoiDung,
  VaiTroNguoiDung,
} = require('../../models');
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { getVietnamTime, getVietnamDayRange } = require('../../utils/thoiGianChamCong.utils');
const { resolveActiveSchedulesForUserDate } = require('../../utils/ngayLichTrinh.utils');
const { ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { PERMISSIONS, getEffectivePermissions } = require('../../config/permissions');

// Định dạng ngày giờ HH:mm DD/MM/YYYY theo giờ Việt Nam
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

// Định dạng giờ HH:mm theo giờ Việt Nam
const formatTimeVN = (date) =>
  date
    ? new Date(date).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

// Định dạng ngày DD/MM/YYYY theo giờ Việt Nam
const formatDateVN = (date) =>
  date
    ? new Date(date).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

// Tổng hợp danh sách thông báo gần đây và số lượng chưa đọc cho người dùng
const getNotifications = async ({ nguoi_dung_id, thoi_diem_doc_gan_nhat }) => {
  if (!nguoi_dung_id) return { tong_so: 0, so_chua_doc: 0, danh_sach_thong_bao: [] };

  const user = await NguoiDung.findByPk(nguoi_dung_id, {
    include: [
      {
        model: VaiTroNguoiDung,
        as: 'danh_sach_vai_tro',
        attributes: ['ma_vai_tro', 'don_vi_id', 'duoc_uy_quyen', 'tu_ngay', 'den_ngay'],
      },
    ],
  });
  if (!user) return { tong_so: 0, so_chua_doc: 0, danh_sach_thong_bao: [] };

  const notifications = [];
  const recentAttendances = await NhatKyChamCong.findAll({
    where: { nguoi_dung_id: user.id },
    include: [
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
      { model: LuotQuetChamCong, as: 'luot_quet', attributes: ['phuong_thuc'], limit: 1, separate: true },
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
        tieu_de: `Đã check-out: ${shiftName}`,
        noi_dung: `Ghi nhận check-out thành công lúc ${formatTimeVN(attendance.thoi_gian_ra)} (Phương thức: ${methodLabel}). Đã đồng bộ vào bảng công hệ thống.`,
        loai: 'cham_cong',
        trang_thai: 'success',
        thoi_gian: attendance.thoi_gian_ra,
        duong_dan: '/cham-cong-ca-nhan',
      });
    } else if (attendance.thoi_gian_vao) {
      const isLate = attendance.trang_thai === 'late';
      notifications.push({
        id: `att-in-${attendance.id}`,
        tieu_de: `Điểm danh thành công (${isLate ? 'Đến muộn' : 'Đúng giờ'}): ${shiftName}`,
        noi_dung: `Ghi nhận check-in lúc ${formatTimeVN(attendance.thoi_gian_vao)} (Phương thức: ${methodLabel}). Đã đồng bộ vào hệ thống chấm công.`,
        loai: 'cham_cong',
        trang_thai: isLate ? 'warning' : 'success',
        thoi_gian: attendance.thoi_gian_vao,
        duong_dan: '/cham-cong-ca-nhan',
      });
    } else if (attendance.trang_thai === 'absent') {
      notifications.push({
        id: `att-absent-${attendance.id}`,
        tieu_de: `Cảnh báo vắng mặt: ${shiftName}`,
        noi_dung: `Hệ thống ghi nhận vắng mặt ngày ${formatDateVN(attendance.tao_luc)}. Vui lòng kiểm tra hoặc gửi giải trình/đơn nghỉ phép nếu có.`,
        loai: 'cham_cong',
        trang_thai: 'danger',
        thoi_gian: attendance.tao_luc,
        duong_dan: '/don-nghi-phep',
      });
    }
  });

  // 2a. Thông báo đơn nghỉ phép cá nhân (hiển thị cho MỌI vai trò, kể cả lãnh đạo/cán bộ quản lý)
  const myRequests = await DonNghiPhep.findAll({
    where: { nguoi_dung_id: user.id },
    order: [['cap_nhat_luc', 'DESC']],
    limit: 3,
  });
  myRequests.forEach((leave) => {
    const date = `từ ${formatDateVN(leave.ngay_bat_dau)} đến ${formatDateVN(leave.ngay_ket_thuc)}`;
    if (leave.trang_thai === 'approved') {
      notifications.push({
        id: `leave-${leave.id}`,
        tieu_de: 'Đơn xin nghỉ phép đã được duyệt',
        noi_dung: `Đơn nghỉ ${date} đã được phê duyệt.`,
        loai: 'don_tu',
        trang_thai: 'success',
        thoi_gian: leave.cap_nhat_luc || leave.tao_luc,
        duong_dan: '/don-nghi-phep',
      });
    } else if (leave.trang_thai === 'rejected') {
      notifications.push({
        id: `leave-${leave.id}`,
        tieu_de: 'Đơn xin nghỉ phép bị từ chối',
        noi_dung: `Đơn nghỉ từ ${formatDateVN(leave.ngay_bat_dau)} bị từ chối${leave.ly_do_tu_choi ? `: "${leave.ly_do_tu_choi}"` : ''}.`,
        loai: 'don_tu',
        trang_thai: 'danger',
        thoi_gian: leave.cap_nhat_luc || leave.tao_luc,
        duong_dan: '/don-nghi-phep',
      });
    } else if (['pending', 'pending_dean', 'pending_bgh'].includes(leave.trang_thai)) {
      notifications.push({
        id: `leave-${leave.id}`,
        tieu_de: 'Đơn xin nghỉ phép đang chờ duyệt',
        noi_dung: `Đơn xin nghỉ gửi lúc ${formatDateTimeVN(leave.tao_luc)} đang chờ cấp quản lý xem xét và duyệt.`,
        loai: 'don_tu',
        trang_thai: 'info',
        thoi_gian: leave.tao_luc,
        duong_dan: '/don-nghi-phep',
      });
    }
  });

  // 2b. Hộp thông báo duyệt đơn theo đúng thẩm quyền đa vai trò & cấp duyệt (loại trừ ke_toan, tccb và phó chưa ủy quyền)
  const effectivePerms = getEffectivePermissions(user);
  const isAdmin = hasAnyActiveRole(user, [ROLES.ADMIN]);
  const isBgh = hasAnyActiveRole(user, [ROLES.BGH]);
  const canApproveLevel1 = !isAdmin && effectivePerms.has(PERMISSIONS.DON_TU_DUYET_CAP_1);

  let pendingWhere = null;
  if (isAdmin) {
    pendingWhere = {
      trang_thai: { [Op.in]: ['pending', 'pending_dean', 'pending_bgh'] },
      nguoi_dung_id: { [Op.ne]: user.id },
    };
  } else {
    const approvalOrClauses = [];
    if (isBgh) {
      approvalOrClauses.push({
        trang_thai: 'pending_bgh',
        nguoi_dung_id: { [Op.ne]: user.id },
      });
    }
    if (canApproveLevel1) {
      const scopedIds = (await getDeanScopedUserIds(user)).filter((id) => id !== String(user.id));
      if (scopedIds.length > 0) {
        approvalOrClauses.push({
          trang_thai: { [Op.in]: ['pending', 'pending_dean'] },
          nguoi_dung_id: { [Op.in]: scopedIds },
        });
      }
    }
    if (approvalOrClauses.length === 1) {
      pendingWhere = approvalOrClauses[0];
    } else if (approvalOrClauses.length > 1) {
      pendingWhere = { [Op.or]: approvalOrClauses };
    }
  }

  if (pendingWhere) {
    const { count: totalPendingCount, rows: pendingLeaves } = await DonNghiPhep.findAndCountAll({
      where: pendingWhere,
      include: [{ model: NguoiDung, as: 'nguoi_dung', attributes: ['id', 'ho_ten', 'email'] }],
      order: [['tao_luc', 'DESC']],
      limit: 3,
      distinct: true,
    });
    if (totalPendingCount > 0 && pendingLeaves.length > 0) {
      notifications.push({
        id: 'leave-pending-summary',
        tieu_de: `Hộp duyệt đơn: ${totalPendingCount} đơn cần xử lý`,
        noi_dung: `Có ${totalPendingCount} đơn xin nghỉ phép (gần nhất từ ${pendingLeaves.map((leave) => leave.nguoi_dung?.ho_ten || 'cán bộ').join(', ')}) đang chờ phê duyệt.`,
        loai: 'don_tu',
        trang_thai: 'warning',
        thoi_gian: pendingLeaves[0].tao_luc,
        duong_dan: '/don-nghi-phep',
      });
    }
  }

  // 3. Thông báo lịch giảng dạy hôm nay (xét tuần học, ngày nghỉ lễ và ngoại lệ nghỉ/hủy/dạy bù/đổi ca)
  const now = new Date();
  const nowVN = getVietnamTime(now);
  const { startOfDay, dateStr } = getVietnamDayRange(nowVN);

  const scheduleIncludes = [
    { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
    { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
    { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
  ];

  const [todayHoliday, rawSchedules, exceptionOverrides] = await Promise.all([
    NgayNghiLe.findOne({
      where: {
        ngay_bat_dau: { [Op.lte]: dateStr },
        ngay_ket_thuc: { [Op.gte]: dateStr },
      },
      attributes: ['id', 'ten_ngay_le'],
    }),
    LichTrinh.findAll({
      where: {
        nguoi_dung_id: user.id,
        thu_trong_tuan: nowVN.getDay(),
        ngay_bat_dau: { [Op.lte]: dateStr },
        ngay_ket_thuc: { [Op.gte]: dateStr },
      },
      include: scheduleIncludes,
    }),
    NgoaiLeLichTrinh.findAll({
      where: {
        trang_thai: { [Op.in]: ['day_bu', 'doi_ca'] },
        [Op.or]: [{ ngay_day_bu: dateStr }, { ngay: dateStr }],
      },
      include: [
        { model: CaLamViec, as: 'ca_thay_the', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
        {
          model: LichTrinh,
          as: 'lich_trinh',
          required: true,
          include: scheduleIncludes,
        },
      ],
    }),
  ]);

  const todaySchedules = resolveActiveSchedulesForUserDate({
    rawSchedules,
    exceptionOverrides,
    userId: user.id,
    dateStr,
    now,
    hasHoliday: Boolean(todayHoliday),
  });

  if (todaySchedules.length) {
    notifications.push({
      id: 'schedule-today',
      tieu_de: `Lịch giảng dạy hôm nay (${todaySchedules.length} ca)`,
      noi_dung: `Hôm nay bạn có lịch: ${todaySchedules
        .map((schedule) => `${schedule.ca?.ten_ca || 'Ca dạy'} (${schedule.ca?.gio_bat_dau || ''} - ${schedule.ca?.gio_ket_thuc || ''})`)
        .join(', ')}. Vui lòng thực hiện điểm danh đúng khung giờ.`,
      loai: 'lich_trinh',
      trang_thai: 'info',
      thoi_gian: startOfDay,
      duong_dan: '/lich-trinh',
    });
  }

  notifications.sort((a, b) => new Date(b.thoi_gian).getTime() - new Date(a.thoi_gian).getTime());
  const lastReadAt = thoi_diem_doc_gan_nhat ? new Date(thoi_diem_doc_gan_nhat) : null;
  const unreadCount =
    lastReadAt && !Number.isNaN(lastReadAt.getTime())
      ? notifications.filter((notification) => new Date(notification.thoi_gian).getTime() > lastReadAt.getTime()).length
      : notifications.length;

  return {
    tong_so: notifications.length,
    so_chua_doc: unreadCount,
    danh_sach_thong_bao: notifications.slice(0, 10),
  };
};

module.exports = { getNotifications };
