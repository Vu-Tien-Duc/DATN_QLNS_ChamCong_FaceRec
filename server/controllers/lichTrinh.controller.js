// Quản lý thời khóa biểu giảng dạy/công tác, chống xung đột và ngoại lệ buổi học
const {
  fetchSchedules,
  fetchScheduleById,
  createNewSchedule,
  updateExistingSchedule,
  removeSchedule,
  fetchTodaySchedules,
  addScheduleException,
} = require('../services/nhanSu/lichTrinh.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

const SCHEDULE_WHITELIST_FIELDS = [
  'nguoi_dung_id',
  'ca_id',
  'mon_hoc_id',
  'phong_hoc',
  'co_so',
  'la_truc_tuyen',
  'vi_do',
  'kinh_do',
  'ban_kinh_met',
  'thu_trong_tuan',
  'gio_bat_dau',
  'gio_ket_thuc',
  'ngay_bat_dau',
  'ngay_ket_thuc',
  'tiet_bat_dau',
  'so_tiet',
  'lap_lai_hang_tuan',
  'loai_lich',
  'ngay_day_bu',
  'danh_sach_tuan',
  'nam_hoc',
  'hoc_ky',
];

// Chuẩn hóa trường đầu vào và lọc whitelist cho lịch trình
const mapScheduleBodyToCanonical = (body = {}) => {
  if (!body || typeof body !== 'object') return {};
  const data = {};
  for (const field of SCHEDULE_WHITELIST_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  if (body.giang_vien_id && !data.nguoi_dung_id) {
    data.nguoi_dung_id = body.giang_vien_id;
  }
  return data;
};

// GET /api/lich-trinh - Danh sách lịch giảng dạy / công tác
const getSchedules = async (req, res) => {
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
};

// GET /api/lich-trinh/:id - Chi tiết lịch trình theo ID
const getScheduleById = async (req, res) => {
  const schedule = await fetchScheduleById(req.params.id, req.user);
  return sendSuccess(res, 'Lấy chi tiết lịch giảng dạy thành công.', schedule);
};

// POST /api/lich-trinh - Tạo mới lịch giảng dạy (kiểm tra chống xung đột)
const createSchedule = async (req, res) => {
  const newSchedule = await createNewSchedule(mapScheduleBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Tạo mới lịch giảng dạy thành công.', newSchedule, 201);
};

// PUT /api/lich-trinh/:id - Cập nhật thông tin lịch giảng dạy
const updateSchedule = async (req, res) => {
  const updatedSchedule = await updateExistingSchedule(req.params.id, mapScheduleBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Cập nhật lịch giảng dạy thành công.', updatedSchedule);
};

// DELETE /api/lich-trinh/:id - Xóa lịch giảng dạy
const deleteSchedule = async (req, res) => {
  const result = await removeSchedule(req.params.id, req.user);
  return sendSuccess(res, result.message);
};

// GET /api/lich-trinh/hom-nay - Lịch làm việc của người dùng trong hôm nay
const getTodaySchedules = async (req, res) => {
  const schedules = await fetchTodaySchedules({
    nguoi_dung_id: req.query?.nguoi_dung_id,
    ngay: req.query?.ngay,
    currentUser: req.user,
  });
  return sendSuccess(res, 'Lấy lịch làm việc hôm nay thành công.', schedules);
};

// POST /api/lich-trinh/:id/ngoai-le - Thêm ngoại lệ cho buổi học (nghỉ / dạy bù)
const addException = async (req, res) => {
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
