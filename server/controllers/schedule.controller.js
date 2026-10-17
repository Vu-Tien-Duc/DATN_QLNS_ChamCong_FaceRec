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
} = require('../services/scheduleManagement.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

/**
 * 1. Lấy danh sách lịch phân công giảng dạy/công tác
 * @route GET /api/schedules
 */
const getSchedules = async (req, res, next) => {
  try {
    const { userId, shiftId, weekday, startDate, endDate, date, academicYear, semester, page, limit } = req.query;
    const result = await fetchSchedules({
      userId,
      shiftId,
      weekday,
      startDate,
      endDate,
      date,
      academicYear,
      semester,
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
    const newSchedule = await createNewSchedule(req.body, req.user);
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
    const updatedSchedule = await updateExistingSchedule(req.params.id, req.body, req.user);
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
 * @route GET /api/schedules/today
 */
const getTodaySchedules = async (req, res, next) => {
  try {
    const { userId, date } = req.query;
    const schedules = await fetchTodaySchedules({ userId, date, currentUser: req.user });
    return sendSuccess(res, 'Lấy lịch làm việc hôm nay thành công.', schedules);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Thêm ngoại lệ cho buổi học (Nghỉ, Chuyển dạy bù)
 * @route POST /api/schedules/:id/exceptions
 */
const addException = async (req, res, next) => {
  try {
    const { date, reason, status, makeupDate } = req.body;
    const updated = await addScheduleException({
      scheduleId: req.params.id,
      date,
      reason,
      status,
      makeupDate,
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
