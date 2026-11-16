/**
 * Schedule Controller (server/controllers/schedule.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Tra cứu thời khóa biểu học kỳ, lọc theo giảng viên, phòng học, thứ, tuần.
 * - Thêm mới lịch giảng dạy / công tác (chống xung đột 2 chiều: Giảng viên & Phòng học).
 * - Cập nhật lịch và quản lý ngoại lệ buổi học (addException).
 * - Xóa lịch phân công giảng dạy.
 */
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

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

const mapScheduleBodyToCanonical = (body = {}) => {
  const data = { ...body };
  if (body.giang_vien_id && !data.nguoi_dung_id) {
    data.nguoi_dung_id = body.giang_vien_id;
  }
  return data;
};

/**
 * 1. Lấy danh sách lịch phân công giảng dạy/công tác
 * @route GET /api/lich-trinh
 */
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

/**
 * 2. Lấy chi tiết một lịch cụ thể theo ID
 * @route GET /api/schedules/:id
 */
const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await fetchScheduleById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết lịch giảng dạy thành công.', schedule);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Tạo mới lịch giảng dạy (Tự động kiểm tra chống xung đột)
 * @route POST /api/schedules
 */
const createSchedule = async (req, res, next) => {
  try {
    const payload = mapScheduleBodyToCanonical(req.body);
    const newSchedule = await createNewSchedule(payload, req.user);
    return sendSuccess(res, 'Tạo mới lịch giảng dạy thành công.', newSchedule, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 4. Cập nhật thông tin lịch giảng dạy
 * @route PUT /api/schedules/:id
 */
const updateSchedule = async (req, res, next) => {
  try {
    const payload = mapScheduleBodyToCanonical(req.body);
    const updatedSchedule = await updateExistingSchedule(req.params.id, payload, req.user);
    return sendSuccess(res, 'Cập nhật lịch giảng dạy thành công.', updatedSchedule);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Xóa lịch giảng dạy
 * @route DELETE /api/schedules/:id
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const result = await removeSchedule(req.params.id, req.user);
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Lấy danh sách lịch làm việc của người dùng trong ngày hôm nay
 * @route GET /api/lich-trinh/hom-nay
 */
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

/**
 * 7. Thêm ngoại lệ cho buổi học (Nghỉ, Chuyển dạy bù)
 * @route POST /api/lich-trinh/:id/ngoai-le
 */
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
