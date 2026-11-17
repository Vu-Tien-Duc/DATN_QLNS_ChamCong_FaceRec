// Lớp lỗi nghiệp vụ dùng chung kèm mã trạng thái HTTP và mã lỗi tùy chọn.
class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

module.exports = ServiceError;
