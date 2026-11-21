// Lấy danh sách thông báo sự kiện chấm công, lịch và đơn nghỉ của người dùng đang đăng nhập
const { getNotifications: fetchNotifications } = require('../services/heThong/thongBao.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

// Lấy danh sách thông báo của người dùng đang đăng nhập
const getNotifications = async (req, res, next) => {
  try {
    const nguoi_dung_id = req.user?.id;
    const { thoi_diem_doc_gan_nhat } = req.query;
    const notifications = await fetchNotifications({
      nguoi_dung_id,
      thoi_diem_doc_gan_nhat,
    });
    return sendSuccess(res, 'Lấy danh sách thông báo thành công.', notifications);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getNotifications };
