// Kiểm tra định dạng, giới hạn dung lượng (5MB) và lưu tạm ảnh khuôn mặt vào RAM trước khi gửi qua Face AI
const multer = require('multer');
const path = require('path');

const IMAGE_EXTENSIONS_BY_MIME = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

// Tạo middleware Multer lưu ảnh khuôn mặt vào RAM và kiểm tra định dạng hợp lệ
const createFaceImageUpload = (fileSize, files) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize,
      files,
      fields: 15,
      fieldSize: 1024 * 10,
      parts: files + 15,
    },
    fileFilter: (req, file, callback) => {
      const allowedExtensions = IMAGE_EXTENSIONS_BY_MIME[file.mimetype];
      const extension = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions || !allowedExtensions.includes(extension)) {
        const error = new Error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
        error.statusCode = 400;
        error.errorCode = 'UNSUPPORTED_FACE_IMAGE_TYPE';
        callback(error);
        return;
      }
      callback(null, true);
    },
  });

// Kiểm tra magic bytes nhị phân thực tế (JPEG / PNG / WebP) chống giả mạo Content-Type & khớp nosniff
const detectImageSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  return null;
};

module.exports = {
  detectImageSignature,
  uploadFaceImage: createFaceImageUpload(5 * 1024 * 1024, 1).single('image'),
  uploadFaceImages: createFaceImageUpload(5 * 1024 * 1024, 10).array('images', 10),
};
