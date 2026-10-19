/**
 * Module Xử Lý Ảnh Minh Chứng Điểm Danh (server/utils/attendanceEvidence.js)
 * Tích hợp MinIO S3-Compatible Object Storage & Xác thực sinh trắc học an toàn:
 * - Kiểm tra chữ ký định dạng nhị phân JPEG, PNG, WebP và giới hạn dung lượng <= 2MB.
 * - Lưu trữ đối tượng tập trung trên MinIO bucket prefix 'evidence/attendance-[UUID].[ext]'.
 * - Cung cấp cơ chế sinh Presigned Signed URL có thời hạn phục vụ xem ảnh minh chứng bảo mật.
 * - Đã loại bỏ 100% các đoạn code cũ ghi đĩa cục bộ trực tiếp (toàn bộ ủy quyền cho minioStorage).
 */

const crypto = require('crypto');
const minioStorage = require('../config/minio');

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const FILE_NAME_PATTERN = /^attendance-[0-9a-f-]{36}\.(jpg|png|webp)$/i;

/**
 * Xác thực dữ liệu ảnh minh chứng (Hỗ trợ Data URL Base64 và Buffer nhị phân)
 */
const validateImageDataUrl = (imageData) => {
  if (Buffer.isBuffer(imageData)) {
    if (imageData.length === 0 || imageData.length > MAX_EVIDENCE_BYTES) {
      const error = new Error('Ảnh minh chứng không được rỗng và không được vượt quá 2 MB.');
      error.statusCode = imageData.length > MAX_EVIDENCE_BYTES ? 413 : 400;
      throw error;
    }
    const isJpeg = imageData.length >= 3 && imageData[0] === 0xff && imageData[1] === 0xd8 && imageData[2] === 0xff;
    const isPng = imageData.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
      imageData.length >= 12 &&
      imageData.toString('ascii', 0, 4) === 'RIFF' &&
      imageData.toString('ascii', 8, 12) === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      const error = new Error('Nội dung ảnh minh chứng không khớp với định dạng JPEG, PNG hoặc WebP.');
      error.statusCode = 400;
      throw error;
    }
    const format = isJpeg ? 'jpeg' : isPng ? 'png' : 'webp';
    return {
      buffer: imageData,
      contentType: `image/${format}`,
      extension: format === 'jpeg' ? 'jpg' : format,
    };
  }

  if (typeof imageData !== 'string') {
    const error = new Error('Ảnh minh chứng phải là Data URL dạng JPEG, PNG hoặc WebP.');
    error.statusCode = 400;
    throw error;
  }

  const match = DATA_URL_PATTERN.exec(imageData);
  if (!match) {
    const error = new Error('Ảnh minh chứng phải có định dạng JPEG, PNG hoặc WebP hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  const [, format, base64] = match;
  if (base64.length > Math.ceil(MAX_EVIDENCE_BYTES / 3) * 4) {
    const error = new Error('Ảnh minh chứng không được vượt quá 2 MB.');
    error.statusCode = 413;
    throw error;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (
    buffer.length === 0 ||
    buffer.length > MAX_EVIDENCE_BYTES ||
    buffer.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')
  ) {
    const error = new Error('Kích thước hoặc nội dung ảnh minh chứng không hợp lệ.');
    error.statusCode = buffer.length > MAX_EVIDENCE_BYTES ? 413 : 400;
    throw error;
  }

  const signatures = {
    jpeg: buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    png: buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp:
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  };

  if (!signatures[format]) {
    const error = new Error('Nội dung ảnh minh chứng không khớp với định dạng khai báo.');
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    contentType: `image/${format}`,
    extension: format === 'jpeg' ? 'jpg' : format,
  };
};

/**
 * Lưu ảnh minh chứng điểm danh / gian lận trực tiếp lên MinIO Object Storage
 */
const storeAttendanceEvidence = async (imageData) => {
  const { buffer, extension, contentType } = validateImageDataUrl(imageData);
  const filename = `attendance-${crypto.randomUUID()}.${extension}`;
  const objectKey = `evidence/${filename}`;

  await minioStorage.putObject(objectKey, buffer, contentType, {
    category: 'attendance-evidence',
    uploadedAt: new Date().toISOString(),
  });

  return filename;
};

/**
 * Đọc ảnh minh chứng điểm danh từ MinIO Object Storage
 */
const readAttendanceEvidence = async (reference) => {
  if (typeof reference !== 'string' || !reference) {
    return null;
  }

  if (reference.startsWith('data:')) {
    const { buffer, contentType } = validateImageDataUrl(reference);
    return { buffer, contentType };
  }

  if (!FILE_NAME_PATTERN.test(reference)) {
    throw new Error('Tham chiếu ảnh minh chứng không hợp lệ.');
  }

  try {
    const objectKey = `evidence/${reference}`;
    const file = await minioStorage.getObject(objectKey);
    return { buffer: file.buffer, contentType: file.contentType };
  } catch (error) {
    const notFoundError = new Error(`Không tìm thấy ảnh minh chứng: ${reference}`);
    notFoundError.code = 'ENOENT';
    notFoundError.statusCode = 404;
    throw notFoundError;
  }
};

/**
 * Xóa ảnh minh chứng điểm danh khỏi MinIO Object Storage
 */
const removeAttendanceEvidence = async (reference) => {
  if (typeof reference !== 'string' || !FILE_NAME_PATTERN.test(reference)) {
    return;
  }
  await minioStorage.deleteObject(`evidence/${reference}`);
};

/**
 * Sinh Presigned URL an toàn để xem ảnh minh chứng từ MinIO
 */
const getEvidencePresignedUrl = async (reference, expirySeconds = 900) => {
  if (!FILE_NAME_PATTERN.test(reference)) {
    return null;
  }
  return await minioStorage.getPresignedUrl(`evidence/${reference}`, expirySeconds);
};

module.exports = {
  MAX_EVIDENCE_BYTES,
  storeAttendanceEvidence,
  readAttendanceEvidence,
  removeAttendanceEvidence,
  getEvidencePresignedUrl,
};
