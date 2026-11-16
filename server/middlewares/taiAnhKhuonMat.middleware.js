const multer = require('multer');
const path = require('path');

const IMAGE_EXTENSIONS_BY_MIME = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

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

module.exports = {
  uploadFaceImage: createFaceImageUpload(5 * 1024 * 1024, 1).single('image'),
  uploadFaceImages: createFaceImageUpload(5 * 1024 * 1024, 10).array('images', 10),
};
