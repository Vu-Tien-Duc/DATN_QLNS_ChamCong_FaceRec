/**
 * Chuẩn hóa phản hồi thành công (Success Response)
 * Tuân thủ cấu trúc thống nhất { success, data, message, errorCode }
 */
const sendSuccess = (res, message = 'Thành công', data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    errorCode: null,
  });
};

/**
 * Chuẩn hóa phản hồi lỗi (Error Response)
 * Tuân thủ cấu trúc thống nhất { success, data, message, errorCode, errors }
 */
const sendError = (res, message = 'Có lỗi xảy ra', errors = null, statusCode = 500, errorCode = null) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errorCode: errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    errors: errors !== undefined ? errors : null,
  });
};

/**
 * BẢNG MÃ LỖI CHUẨN TOÀN HỆ THỐNG (ERROR CODES)
 */
const ERROR_CODES = {
  // --- Ca làm việc (Shift Config) ---
  SHIFT_NOT_FOUND: 'SHIFT_001',           // Không tìm thấy ca làm việc
  SHIFT_IN_USE: 'SHIFT_002',              // Ca đang được sử dụng trong lịch, không thể xóa
  SHIFT_INVALID_DATA: 'SHIFT_003',        // Dữ liệu ca làm việc không hợp lệ (giờ sai, ngưỡng trễ âm)
  SHIFT_DUPLICATE: 'SHIFT_004',           // Ca làm việc đã tồn tại (trùng tên hoặc khung giờ)

  // --- Lịch phân công giảng dạy / công tác (Schedule) ---
  SCHEDULE_NOT_FOUND: 'SCHEDULE_001',     // Không tìm thấy lịch giảng dạy/công tác
  SCHEDULE_CONFLICT: 'SCHEDULE_002',      // Trùng lịch với ca khác cùng ngày/thứ trong học kỳ
  SCHEDULE_INVALID_DATA: 'SCHEDULE_003',  // Dữ liệu phân lịch không hợp lệ (thiếu trường, ngày kết thúc < bắt đầu)

  // --- Chấm công (Attendance) ---
  ATTENDANCE_ALREADY_EXISTS: 'ATTENDANCE_002', // Đã check-in ca này rồi, không check-in trùng
  ATTENDANCE_NO_OPEN_RECORD: 'ATTENDANCE_003', // Không tìm thấy ca check-in mở để check-out
  ATTENDANCE_NO_MATCHING_SCHEDULE: 'ATTENDANCE_004', // Không có lịch phù hợp hiện tại để check-in

  // --- Xác thực & Người dùng ---
  AUTH_TOKEN_INVALID: 'AUTH_002',         // Token không hợp lệ hoặc hết hạn
  AUTH_FORBIDDEN: 'AUTH_004',             // Không có quyền truy cập
  USER_NOT_FOUND: 'USER_001',             // Không tìm thấy người dùng
  USER_FACE_ALREADY_REGISTERED: 'USER_003', // Khuôn mặt này đã được đăng ký cho một tài khoản khác

  // --- Môn học (Subject) ---
  SUBJECT_NOT_FOUND: 'SUBJECT_001',       // Không tìm thấy môn học
  SUBJECT_DUPLICATE: 'SUBJECT_002',       // Mã môn học đã tồn tại
  SUBJECT_IN_USE: 'SUBJECT_003',          // Môn học đang được gán trong lịch dạy, không thể xóa
  SUBJECT_INVALID_DATA: 'SUBJECT_004',    // Dữ liệu môn học không hợp lệ
};

module.exports = {
  sendSuccess,
  sendError,
  ERROR_CODES,
  getBaseUrl: (req) => {
    const host = req.get('host') || '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}`;
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps =
      forwardedProto === 'https' ||
      req.secure ||
      req.protocol === 'https' ||
      host.includes('chamcongdh.io.vn');

    const proto = isHttps ? 'https' : (req.protocol || 'http');
    return `${proto}://${host}`;
  },
};

