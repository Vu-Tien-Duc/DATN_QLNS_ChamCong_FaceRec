// Kiểm tra định dạng, giới hạn dung lượng (10MB) và lưu tạm tệp tải lên vào RAM để đẩy lên MinIO
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

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Kiểm tra loại MIME và phần mở rộng tệp được phép tải lên
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

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 20,
    fieldSize: 1024 * 1024,
    parts: 21,
  },
  fileFilter,
});

// Kiểm tra chữ ký nhị phân (Magic Bytes) thực tế của tệp tải lên
const validateFileMagicBytes = (buffer, mimetype = '') => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const mime = String(mimetype).toLowerCase();

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') {
    const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('ascii');
    return head.includes('%PDF-');
  }
  if (mime === 'application/msword') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    );
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      ((buffer[2] === 0x03 && buffer[3] === 0x04) || (buffer[2] === 0x05 && buffer[3] === 0x06))
    );
  }
  return false;
};

const verifyUploadedFileMagicBytes = (req, _res, next) => {
  const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
  if (!file) return next();
  if (!validateFileMagicBytes(file.buffer, file.mimetype)) {
    const error = new Error(
      'Nội dung nhị phân của tệp không khớp với định dạng được khai báo (Magic Bytes không hợp lệ).'
    );
    error.statusCode = 400;
    error.errorCode = 'INVALID_FILE_MAGIC_BYTES';
    return next(error);
  }
  return next();
};

module.exports = {
  upload,
  validateFileMagicBytes,
  verifyUploadedFileMagicBytes,
  ALLOWED_MIME_TYPES,
  EXTENSIONS_BY_MIME_TYPE,
};
