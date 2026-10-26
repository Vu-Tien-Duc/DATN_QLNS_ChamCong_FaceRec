/**
 * Chuẩn hóa phản hồi lỗi và 404 trước khi trả kết quả về client.
 */
const { sendError } = require('../utils/responseHandler');

/**
 * Bản đồ ánh xạ tên trường kỹ thuật CSDL sang tên Tiếng Việt thân thiện
 */
const FIELD_LABEL_MAP = {
  // Người dùng & Xác thực
  email: 'Địa chỉ Email',
  ma_can_bo: 'Mã cán bộ / giảng viên',
  staffCode: 'Mã cán bộ / giảng viên',
  ma_nhan_vien: 'Mã nhân viên',
  employeeCode: 'Mã nhân viên',
  so_dien_thoai: 'Số điện thoại',
  phone: 'Số điện thoại',
  phoneNumber: 'Số điện thoại',
  ten_dang_nhap: 'Tên đăng nhập',
  username: 'Tên đăng nhập',
  cccd: 'Số CCCD/CMND',
  so_cccd_ma_hoa: 'Số CCCD/CMND',
  identityCard: 'Số CCCD/CMND',
  so_cmnd: 'Số CCCD/CMND',
  citizenId: 'Số CCCD/CMND',
  nguoi_dung_id: 'Cán bộ / Người dùng',
  userId: 'Cán bộ / Người dùng',

  // Chấm công & Ca làm việc
  ca_id: 'Ca làm việc',
  shiftId: 'Ca làm việc',
  ma_ca: 'Mã ca làm việc',
  shiftCode: 'Mã ca làm việc',
  ten_ca: 'Tên ca làm việc',
  shiftName: 'Tên ca làm việc',
  ngay_cong: 'Ngày công',
  workDate: 'Ngày công',
  khoa_cong: 'Khóa chấm công',
  workKey: 'Khóa chấm công',
  lich_trinh_id: 'Lịch trình giảng dạy',
  scheduleId: 'Lịch trình giảng dạy',

  // Môn học & Học phần
  mon_hoc_id: 'Môn học',
  subjectId: 'Môn học',
  ma_mon: 'Mã môn học',
  subjectCode: 'Mã môn học',
  ten_mon: 'Tên môn học',
  subjectName: 'Tên môn học',
  ma_hoc_phan: 'Mã học phần',
  ma_lop_hoc_phan: 'Mã lớp học phần',

  // Khoa & Phòng ban
  phong_ban_id: 'Khoa / Phòng ban',
  departmentId: 'Khoa / Phòng ban',
  ma_phong_ban: 'Mã khoa / phòng ban',
  departmentCode: 'Mã khoa / phòng ban',
  deptCode: 'Mã khoa / phòng ban',
  ten_phong_ban: 'Tên khoa / phòng ban',
  departmentName: 'Tên khoa / phòng ban',
  deptName: 'Tên khoa / phòng ban',

  // Ngày nghỉ lễ & Tham số
  ngay: 'Ngày nghỉ lễ',
  date: 'Ngày',
  ngay_bat_dau: 'Ngày bắt đầu',
  startDate: 'Ngày bắt đầu',
  ngay_ket_thuc: 'Ngày kết thúc',
  endDate: 'Ngày kết thúc',
  khoa: 'Mã tham số cấu hình',
  key: 'Mã tham số cấu hình',
  thang: 'Tháng',
  nam: 'Năm',
  year: 'Năm',
  month: 'Tháng',
  token: 'Mã xác thực token',
};

/**
 * Xử lý và chuẩn hóa thông báo lỗi trùng lặp MongoDB E11000 duplicate key
 */
const formatDuplicateKeyErrorMessage = (err) => {
  const keyValue = err.keyValue || {};
  const keys = Object.keys(keyValue);
  const msgStr = `${err.message || ''} ${err.errmsg || ''}`;

  // 1. Phân loại theo Collection hoặc tổ hợp trường đặc thù
  // A. Bảng Chấm công (AttendanceLog / nhat_ky_cham_cong)
  if (
    msgStr.includes('nhat_ky_cham_cong') ||
    msgStr.includes('attendance') ||
    (keyValue.nguoi_dung_id && (keyValue.ca_id || keyValue.ngay_cong || keyValue.lich_trinh_id)) ||
    (keyValue.userId && (keyValue.shiftId || keyValue.workDate || keyValue.scheduleId))
  ) {
    return 'Bản ghi chấm công của cán bộ trong ca làm việc ngày hôm nay đã tồn tại trên hệ thống.';
  }

  // B. Mẫu khuôn mặt (FaceTemplate / mau_khuon_mat)
  if (
    msgStr.includes('mau_khuon_mat') ||
    msgStr.includes('face_template') ||
    msgStr.includes('FaceTemplate') ||
    (keys.length === 1 && (keys[0] === 'nguoi_dung_id' || keys[0] === 'userId') && msgStr.includes('mau_khuon_mat'))
  ) {
    return 'Dữ liệu mẫu khuôn mặt của cán bộ này đã được đăng ký trên hệ thống.';
  }

  // C. Bảng lương (Payroll / phieu_luong)
  if (
    msgStr.includes('phieu_luong') ||
    msgStr.includes('payroll') ||
    (keyValue.nguoi_dung_id && (keyValue.thang !== undefined || keyValue.nam !== undefined)) ||
    (keyValue.userId && (keyValue.month !== undefined || keyValue.year !== undefined))
  ) {
    const month = keyValue.thang || keyValue.month;
    const year = keyValue.nam || keyValue.year;
    return month && year
      ? `Bảng lương của cán bộ tháng ${month}/${year} đã tồn tại trên hệ thống.`
      : 'Bảng lương của cán bộ trong kỳ lương này đã tồn tại trên hệ thống.';
  }

  // D. Lịch trình / Thời khóa biểu (Schedule / lich_trinh)
  if (msgStr.includes('lich_trinh') || msgStr.includes('schedule')) {
    return 'Lịch trình hoặc ca giảng dạy này đã tồn tại hoặc bị trùng lặp phòng học/thời gian.';
  }

  // E. Ngày nghỉ lễ (Holiday / ngay_nghi_le)
  if (msgStr.includes('ngay_nghi_le') || msgStr.includes('holiday')) {
    return 'Ngày nghỉ lễ này đã được thiết lập trên hệ thống.';
  }

  // F. Cấu hình hệ thống (SystemConfig / cau_hinh_he_thong)
  if (msgStr.includes('cau_hinh_he_thong') || msgStr.includes('system_config')) {
    const keyVal = keyValue.khoa || keyValue.key;
    return keyVal
      ? `Tham số cấu hình "${keyVal}" đã tồn tại trên hệ thống.`
      : 'Tham số cấu hình này đã tồn tại trên hệ thống.';
  }

  // 2. Tra cứu từng trường cụ thể
  const primaryKey = keys[0];
  if (primaryKey && FIELD_LABEL_MAP[primaryKey]) {
    const val = keyValue[primaryKey];
    const valStr = typeof val === 'string' || typeof val === 'number' ? ` "${val}"` : '';
    return `${FIELD_LABEL_MAP[primaryKey]}${valStr} đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.`;
  }

  // 3. Trường hợp nhiều trường kết hợp
  if (keys.length > 1) {
    const friendlyNames = keys.map((k) => FIELD_LABEL_MAP[k] || k).join(', ');
    return `Bộ thông tin (${friendlyNames}) đã tồn tại trên hệ thống.`;
  }

  return 'Dữ liệu này đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.';
};

/**
 * Middleware xử lý lỗi hệ thống tập trung
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  // 1. Lỗi sai định dạng ObjectId Mongoose (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    const fieldLabel = FIELD_LABEL_MAP[err.path] || err.path;
    message = `Định dạng mã định danh không hợp lệ cho trường '${fieldLabel}'.`;
    errorCode = 'INVALID_OBJECT_ID';
  }

  if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Tệp tải lên vượt quá dung lượng cho phép.'
        : 'Yêu cầu tải tệp lên không hợp lệ hoặc vượt giới hạn.';
    errorCode = err.code || 'INVALID_FILE_UPLOAD';
  }

  // 2. Lỗi trùng lặp dữ liệu duy nhất trong MongoDB (E11000 duplicate key)
  if (err.code === 11000) {
    statusCode = 409;
    message = formatDuplicateKeyErrorMessage(err);
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // 3. Lỗi xác thực Schema Mongoose (ValidationError)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = `Dữ liệu không hợp lệ: ${errors.join(', ')}`;
    errorCode = 'VALIDATION_ERROR';
  }

  // 4. Lỗi JWT
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

  if (statusCode >= 500 && process.env.NODE_ENV !== 'development') {
    message = 'Lỗi máy chủ nội bộ.';
  }

  return sendError(
    res,
    message,
    process.env.NODE_ENV === 'development' ? err.stack : null,
    statusCode,
    errorCode
  );
};

/**
 * Middleware xử lý đường dẫn không tồn tại (404 Not Found)
 */
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
