/**
 * Cấu hình kiểm tra giới hạn và lưu trữ tệp tải lên của người dùng.
 * Sử dụng lưu trữ RAM MemoryStorage để truyền trực tiếp dữ liệu nhị phân lên MinIO Object Storage.
 */
const multer = require('multer');
const path = require('path');

const EXTENSIONS_BY_MIME_TYPE = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

// Danh sách các định dạng file minh chứng được chấp nhận
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[file.mimetype];
  const extension = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && allowedExtensions?.includes(extension)) {
    cb(null, true);
  } else {
    const error = new Error(
      'Định dạng hoặc phần mở rộng tệp không được hỗ trợ. Vui lòng tải ảnh PNG, JPG, WEBP hoặc tài liệu PDF, DOC, DOCX.'
    );
    error.statusCode = 400;
    error.errorCode = 'UNSUPPORTED_FILE_TYPE';
    cb(error);
  }
};

// Sử dụng memoryStorage để đưa trực tiếp Buffer lên MinIO Object Storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Tối đa 10MB
    files: 1,
    fields: 20,
    fieldSize: 1024 * 1024,
    parts: 21,
  },
  fileFilter,
});

module.exports = {
  upload,
  ALLOWED_MIME_TYPES,
  EXTENSIONS_BY_MIME_TYPE,
};
