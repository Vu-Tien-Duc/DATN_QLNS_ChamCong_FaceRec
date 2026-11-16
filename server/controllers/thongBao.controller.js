/**
 * Lấy thông báo theo người dùng đang đăng nhập và trả dữ liệu qua API.
 */
const { getNotifications: fetchNotifications } = require('../services/heThong/thongBao.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

const getNotifications = async (req, res, next) => {
  try {
    const nguoi_dung_id = req.user?._id;
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
