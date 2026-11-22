// Xử lý lỗi tập trung (Sequelize, Multer, JWT, ServiceError) và phản hồi 404 chuẩn hóa
const { sendError } = require('../utils/phanHoiHttp');

// Quy đổi tên cột CSDL sang nhãn tiếng Việt khi trả thông báo lỗi trùng lặp dữ liệu
const FIELD_LABEL_MAP = {
  // Người dùng & Hồ sơ cán bộ
  email: 'Địa chỉ Email',
  ma_can_bo: 'Mã cán bộ / giảng viên',
  so_dien_thoai: 'Số điện thoại',
  so_cccd: 'Số CCCD/CMND',
  ma_so_thue: 'Mã số thuế',
  nguoi_dung_id: 'Cán bộ / Người dùng',

  // Chấm công & Ca làm việc
  ca_id: 'Ca làm việc',
  ma_ca: 'Mã ca làm việc',
  ten_ca: 'Tên ca làm việc',
  ngay_cong: 'Ngày công',
  lich_trinh_id: 'Lịch trình giảng dạy',

  // Môn học & Khoa / Phòng ban
  mon_hoc_id: 'Môn học',
  ma_mon: 'Mã môn học',
  ten_mon: 'Tên môn học',
  phong_ban_id: 'Khoa / Phòng ban',
  ma_phong_ban: 'Mã khoa / phòng ban',
  ten_phong_ban: 'Tên khoa / phòng ban',

  // Ngày nghỉ lễ, RBAC & Tham số
  ngay: 'Ngày',
  ngay_bat_dau: 'Ngày bắt đầu',
  ngay_ket_thuc: 'Ngày kết thúc',
  khoa_cau_hinh: 'Mã tham số cấu hình',
  ma_vai_tro: 'Mã vai trò',
  thang: 'Tháng',
  nam: 'Năm',
};

// Middleware xử lý lỗi tập trung và chuẩn hóa mã HTTP/thông báo trả về client
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', err);
  }

  const isKnownServiceError = err.name === 'ServiceError' || Boolean(err.statusCode);
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let errorCode = err.errorCode || null;

  if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Tệp tải lên vượt quá dung lượng cho phép.'
        : 'Yêu cầu tải tệp lên không hợp lệ hoặc vượt giới hạn.';
    errorCode = err.code || 'INVALID_FILE_UPLOAD';
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'dữ liệu';
    const label = FIELD_LABEL_MAP[field] || field;
    message = `Giá trị '${label}' đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    const errors = err.errors ? err.errors.map((e) => e.message) : [];
    message = `Dữ liệu không hợp lệ: ${errors.join(', ')}`;
    errorCode = 'VALIDATION_ERROR';
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Dữ liệu tham chiếu hoặc liên kết không hợp lệ hoặc đang được sử dụng ở bảng khác.';
    errorCode = 'FOREIGN_KEY_CONSTRAINT_ERROR';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ hoặc đã bị chỉnh sửa.';
    errorCode = 'AUTH_TOKEN_INVALID';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn. Vui lòng đăng nhập lại hoặc làm mới token.';
    errorCode = 'AUTH_TOKEN_EXPIRED';
  }

  if (!isKnownServiceError && statusCode >= 500 && process.env.NODE_ENV !== 'development') {
    message = 'Lỗi máy chủ nội bộ.';
  }

  const errorPayload =
    err.data !== undefined && err.data !== null
      ? err.data
      : !isKnownServiceError && process.env.NODE_ENV === 'development'
        ? err.stack
        : null;

  return sendError(
    res,
    message,
    errorPayload,
    statusCode,
    errorCode
  );
};

// Middleware trả lỗi 404 khi đường dẫn API không tồn tại
const notFoundHandler = (req, res) => {
  return sendError(
    res,
    `Đường dẫn ${req.originalUrl} không tồn tại trên máy chủ.`,
    null,
    404,
    'RESOURCE_NOT_FOUND'
  );
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
