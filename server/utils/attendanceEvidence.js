const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const evidenceDir = path.resolve(
  process.env.ATTENDANCE_EVIDENCE_DIR || path.join(__dirname, '../../private/attendance-evidence')
);
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const FILE_NAME_PATTERN = /^attendance-[0-9a-f-]{36}\.(jpg|png|webp)$/i;

const validateImageDataUrl = (imageDataUrl) => {
  if (typeof imageDataUrl !== 'string') {
    const error = new Error('Ảnh minh chứng phải là Data URL dạng JPEG, PNG hoặc WebP.');
    error.statusCode = 400;
    throw error;
  }

  const match = DATA_URL_PATTERN.exec(imageDataUrl);
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

const storeAttendanceEvidence = async (imageDataUrl) => {
  const { buffer, extension } = validateImageDataUrl(imageDataUrl);
  const filename = `attendance-${crypto.randomUUID()}.${extension}`;
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, filename), buffer, { flag: 'wx', mode: 0o600 });
  return filename;
};

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

  const buffer = await fs.readFile(path.join(evidenceDir, reference));
  const extension = path.extname(reference).toLowerCase();
  const contentType = extension === '.jpg' ? 'image/jpeg' : `image/${extension.slice(1)}`;
  return { buffer, contentType };
};

const removeAttendanceEvidence = async (reference) => {
  if (typeof reference !== 'string' || !FILE_NAME_PATTERN.test(reference)) {
    return;
  }
  await fs.rm(path.join(evidenceDir, reference), { force: true });
};

module.exports = {
  MAX_EVIDENCE_BYTES,
  storeAttendanceEvidence,
  readAttendanceEvidence,
  removeAttendanceEvidence,
};
