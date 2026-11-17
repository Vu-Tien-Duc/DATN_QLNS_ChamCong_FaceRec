// Quản lý thời khóa biểu giảng dạy/công tác, chống xung đột và ngoại lệ buổi học
const {
  ServiceError,
  fetchSchedules,
  fetchScheduleById,
  createNewSchedule,
  updateExistingSchedule,
  removeSchedule,
  fetchTodaySchedules,
  addScheduleException,
} = require('../services/nhanSu/lichTrinh.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

// Chuẩn hóa giang_vien_id sang nguoi_dung_id từ request body
const mapScheduleBodyToCanonical = (body = {}) => {
  const data = { ...body };
  if (body.giang_vien_id && !data.nguoi_dung_id) {
    data.nguoi_dung_id = body.giang_vien_id;
  }
  return data;
};

// GET /api/lich-trinh - Danh sách lịch giảng dạy / công tác
const getSchedules = async (req, res, next) => {
  try {
    const {
      nguoi_dung_id,
      ca_id,
      thu_trong_tuan,
      ngay_bat_dau,
      ngay_ket_thuc,
      ngay,
      nam_hoc,
      hoc_ky,
      trang: page = 1,
      gioi_han: limit = 20,
    } = req.query;

    const result = await fetchSchedules({
      nguoi_dung_id,
      ca_id,
      thu_trong_tuan,
      ngay_bat_dau,
      ngay_ket_thuc,
      ngay,
      nam_hoc,
      hoc_ky,
      page,
      limit,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách thời khóa biểu thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/lich-trinh/:id - Chi tiết lịch trình theo ID
const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await fetchScheduleById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết lịch giảng dạy thành công.', schedule);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/lich-trinh - Tạo mới lịch giảng dạy (kiểm tra chống xung đột)
const createSchedule = async (req, res, next) => {
  try {
    const payload = mapScheduleBodyToCanonical(req.body);
    const newSchedule = await createNewSchedule(payload, req.user);
    return sendSuccess(res, 'Tạo mới lịch giảng dạy thành công.', newSchedule, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/lich-trinh/:id - Cập nhật thông tin lịch giảng dạy
const updateSchedule = async (req, res, next) => {
  try {
    const payload = mapScheduleBodyToCanonical(req.body);
    const updatedSchedule = await updateExistingSchedule(req.params.id, payload, req.user);
    return sendSuccess(res, 'Cập nhật lịch giảng dạy thành công.', updatedSchedule);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// DELETE /api/lich-trinh/:id - Xóa lịch giảng dạy
const deleteSchedule = async (req, res, next) => {
  try {
    const result = await removeSchedule(req.params.id, req.user);
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/lich-trinh/hom-nay - Lịch làm việc của người dùng trong hôm nay
const getTodaySchedules = async (req, res, next) => {
  try {
    const nguoi_dung_id = req.query?.nguoi_dung_id;
    const ngay = req.query?.ngay;
    const schedules = await fetchTodaySchedules({ nguoi_dung_id, ngay, currentUser: req.user });
    return sendSuccess(res, 'Lấy lịch làm việc hôm nay thành công.', schedules);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/lich-trinh/:id/ngoai-le - Thêm ngoại lệ cho buổi học (nghỉ / dạy bù)
const addException = async (req, res, next) => {
  try {
    const { ngay, ly_do, trang_thai, ngay_day_bu } = req.body || {};

    const updated = await addScheduleException({
      scheduleId: req.params.id,
      ngay,
      ly_do,
      trang_thai,
      ngay_day_bu,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Ghi nhận ngoại lệ buổi học thành công.', updated);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getTodaySchedules,
  addException,
};
