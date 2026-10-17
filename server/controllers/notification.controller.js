/**
 * Lấy thông báo theo người dùng đang đăng nhập và trả dữ liệu qua API.
 */
const { getNotifications: fetchNotifications } = require('../services/notification.service');
const { sendSuccess } = require('../utils/responseHandler');

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await fetchNotifications({
      userId: req.user.id,
      lastReadAt: req.query.lastReadAt,
    });
    return sendSuccess(res, 'Lấy danh sách thông báo thành công.', notifications);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getNotifications };
