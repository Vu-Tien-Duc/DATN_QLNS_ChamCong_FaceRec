/**
 * Module Cấu Hình & Quản Lý Lưu Trữ Đối Tượng MinIO / S3 (server/config/minio.js)
 * Chuẩn Enterprise cho Hệ Thống QLNS & Chấm Công Đại Học:
 * - Hỗ trợ lưu trữ Object Storage tương thích AWS S3 (MinIO on-premise / AWS S3 / Cloudflare R2).
 * - Phân vùng lưu trữ (Bucket / Prefixes):
 *   + 'evidence/'   : Ảnh minh chứng chấm công, bằng chứng phát hiện gian lận.
 *   + 'attachments/': File scan đơn nghỉ phép, giấy tờ khám bệnh, hồ sơ minh chứng.
 *   + 'faces/'      : Ảnh khuôn mặt đăng ký 5 góc & ảnh đại diện sinh trắc học.
 *   + 'avatars/'    : Ảnh đại diện người dùng.
 * - Cơ chế Hybrid Fallback: Khi MinIO service offline, tự động chuyển đổi sang Local Disk Storage
 *   đảm bảo Zero Downtime cho môi trường phát triển & kiểm thử.
 * - Hỗ trợ tạo Presigned URL (Signed URL) có thời hạn (15-60 phút) để xem tệp bảo mật.
 */

const Minio = require('minio');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const stream = require('stream');

// 1. Đọc cấu hình môi trường
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT, 10) || 9000;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'datn-qlns-storage';
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1';
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'minio').toLowerCase();

// Thư mục cục bộ dùng cho Local Fallback (Lưu bên ngoài project tránh nặng repository)
const LOCAL_STORAGE_ROOT = process.env.STORAGE_LOCAL_DIR
  ? path.resolve(process.env.STORAGE_LOCAL_DIR)
  : path.resolve('D:/DATN_VuTienDuc_2310900023/storage-uploads');
const getLocalEvidenceDir = () =>
  path.resolve(process.env.ATTENDANCE_EVIDENCE_DIR || 'D:/DATN_VuTienDuc_2310900023/attendance-evidence');

// Đảm bảo thư mục fallback cục bộ tồn tại
for (const dir of [LOCAL_STORAGE_ROOT, getLocalEvidenceDir(), path.join(LOCAL_STORAGE_ROOT, 'faces'), path.join(LOCAL_STORAGE_ROOT, 'attachments')]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
}

let minioClient = null;
let isMinioAvailable = false;
let bucketInitialized = false;

/**
 * 2. Khởi tạo MinIO Client
 */
const getMinioClient = () => {
  if (minioClient) return minioClient;

  if (STORAGE_DRIVER === 'local') {
    isMinioAvailable = false;
    return null;
  }

  try {
    minioClient = new Minio.Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      region: MINIO_REGION,
    });
  } catch (error) {
    console.warn(`[Object Storage] Không thể khởi tạo MinIO Client: ${error.message}. Chuyển sang Local Storage Fallback.`);
    isMinioAvailable = false;
    minioClient = null;
  }

  return minioClient;
};

/**
 * 3. Kiểm tra kết nối và tạo Bucket nếu chưa có
 */
const ensureBucketExists = async (bucketName = MINIO_BUCKET_NAME) => {
  if (bucketInitialized && isMinioAvailable) return true;

  const client = getMinioClient();
  if (!client) {
    isMinioAvailable = false;
    return false;
  }

  try {
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      await client.makeBucket(bucketName, MINIO_REGION);
      console.log(`[Object Storage] Đã tạo mới Bucket '${bucketName}' trên MinIO.`);
    }
    isMinioAvailable = true;
    bucketInitialized = true;
    return true;
  } catch (error) {
    isMinioAvailable = false;
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Object Storage] MinIO Server (${MINIO_ENDPOINT}:${MINIO_PORT}) chưa sẵn sàng: ${error.message}. Kích hoạt chế độ Local Storage Fallback.`);
    }
    return false;
  }
};

/**
 * 4. Phân giải đường dẫn cục bộ khi fallback
 */
const resolveLocalPath = (objectKey) => {
  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  if (cleanKey.startsWith('evidence/')) {
    const filename = cleanKey.replace(/^evidence[/\\]+/, '');
    const customEvidencePath = path.join(getLocalEvidenceDir(), filename);
    if (fs.existsSync(customEvidencePath)) return customEvidencePath;
    const internalEvidencePath = path.resolve(__dirname, '../../private/attendance-evidence', filename);
    if (fs.existsSync(internalEvidencePath)) return internalEvidencePath;
    return customEvidencePath;
  }
  const externalPath = path.join(LOCAL_STORAGE_ROOT, cleanKey);
  if (fs.existsSync(externalPath)) {
    return externalPath;
  }
  const internalPath = path.resolve(__dirname, '../../uploads', cleanKey);
  if (fs.existsSync(internalPath)) {
    return internalPath;
  }
  return externalPath;
};

/**
 * 5. Lưu trữ tệp tin (Put Object)
 * @param {string} objectKey Đường dẫn định danh tệp (vd: 'evidence/attendance-xxx.jpg', 'attachments/file-xxx.pdf')
 * @param {Buffer} buffer Dữ liệu nhị phân của tệp
 * @param {string} contentType MIME type của tệp (vd: 'image/jpeg', 'application/pdf')
 * @param {object} metaData Thông tin metadata đi kèm
 * @returns {Promise<{ objectKey: string, bucket: string, size: number, storage: 'minio' | 'local' }>}
 */
const putObject = async (objectKey, buffer, contentType = 'application/octet-stream', metaData = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Dữ liệu tải lên phải là một Buffer nhị phân.');
  }

  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      const sanitizedMeta = {};
      for (const [k, v] of Object.entries(metaData)) {
        if (typeof v === 'string') {
          sanitizedMeta[k] = encodeURIComponent(v);
        } else if (v !== undefined && v !== null) {
          sanitizedMeta[k] = String(v);
        }
      }
      const uploadMeta = {
        'Content-Type': contentType,
        ...sanitizedMeta,
      };
      await minioClient.putObject(MINIO_BUCKET_NAME, cleanKey, buffer, buffer.length, uploadMeta);
      return {
        objectKey: cleanKey,
        bucket: MINIO_BUCKET_NAME,
        size: buffer.length,
        contentType,
        storage: 'minio',
      };
    } catch (error) {
      console.warn(`[Object Storage] Ghi tệp '${cleanKey}' lên MinIO thất bại: ${error.message}. Chuyển hướng ghi Fallback cục bộ.`);
    }
  }

  // Fallback: Ghi vào ổ cứng cục bộ
  const localPath = resolveLocalPath(cleanKey);
  await fsp.mkdir(path.dirname(localPath), { recursive: true });
  await fsp.writeFile(localPath, buffer);

  return {
    objectKey: cleanKey,
    bucket: 'local-storage',
    size: buffer.length,
    contentType,
    storage: 'local',
    localPath,
  };
};

/**
 * 6. Đọc tệp tin thành Buffer (Get Object)
 * @param {string} objectKey Đường dẫn định danh tệp
 * @returns {Promise<{ buffer: Buffer, contentType: string, size: number, storage: 'minio' | 'local' }>}
 */
const getObject = async (objectKey) => {
  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      const dataStream = await minioClient.getObject(MINIO_BUCKET_NAME, cleanKey);
      const chunks = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      let contentType = 'application/octet-stream';
      try {
        const stat = await minioClient.statObject(MINIO_BUCKET_NAME, cleanKey);
        if (stat?.metaData?.['content-type']) {
          contentType = stat.metaData['content-type'];
        }
      } catch (_) {}

      return {
        buffer,
        contentType,
        size: buffer.length,
        storage: 'minio',
      };
    } catch (error) {
      // Nếu MinIO không tìm thấy hoặc lỗi, thử tìm trong local fallback
    }
  }

  // Đọc từ local fallback
  const localPath = resolveLocalPath(cleanKey);
  if (!fs.existsSync(localPath)) {
    const error = new Error(`Không tìm thấy tệp '${cleanKey}' trong hệ thống lưu trữ.`);
    error.code = 'ENOENT';
    error.statusCode = 404;
    throw error;
  }

  const buffer = await fsp.readFile(localPath);
  const ext = path.extname(cleanKey).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return {
    buffer,
    contentType: mimeMap[ext] || 'application/octet-stream',
    size: buffer.length,
    storage: 'local',
  };
};

/**
 * 7. Lấy Readable Stream của tệp (Get Object Stream)
 * @param {string} objectKey Đường dẫn định danh tệp
 * @returns {Promise<{ stream: stream.Readable, contentType: string, size?: number, storage: 'minio' | 'local' }>}
 */
const getObjectStream = async (objectKey) => {
  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      const dataStream = await minioClient.getObject(MINIO_BUCKET_NAME, cleanKey);
      let contentType = 'application/octet-stream';
      let size = 0;
      try {
        const stat = await minioClient.statObject(MINIO_BUCKET_NAME, cleanKey);
        contentType = stat?.metaData?.['content-type'] || contentType;
        size = stat?.size || 0;
      } catch (_) {}

      return {
        stream: dataStream,
        contentType,
        size,
        storage: 'minio',
      };
    } catch (error) {}
  }

  // Fallback stream từ local file
  const localPath = resolveLocalPath(cleanKey);
  if (!fs.existsSync(localPath)) {
    const error = new Error(`Không tìm thấy tệp '${cleanKey}'.`);
    error.code = 'ENOENT';
    error.statusCode = 404;
    throw error;
  }

  const stat = await fsp.stat(localPath);
  const ext = path.extname(cleanKey).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return {
    stream: fs.createReadStream(localPath),
    contentType: mimeMap[ext] || 'application/octet-stream',
    size: stat.size,
    storage: 'local',
  };
};

/**
 * 8. Xóa tệp tin (Delete Object)
 * @param {string} objectKey Đường dẫn định danh tệp
 */
const deleteObject = async (objectKey) => {
  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      await minioClient.removeObject(MINIO_BUCKET_NAME, cleanKey);
    } catch (error) {}
  }

  // Xóa thêm trong local fallback nếu có
  const localPath = resolveLocalPath(cleanKey);
  if (fs.existsSync(localPath)) {
    try {
      await fsp.unlink(localPath);
    } catch (_) {}
  }
};

/**
 * 8.1. Xóa toàn bộ ảnh khuôn mặt thuộc về người dùng (MinIO & Local Fallback)
 * Hỗ trợ xóa theo Mã cán bộ (StaffCode), ID hoặc Đường dẫn ảnh cụ thể
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} [staffCode]
 * @param {string} [photoPath]
 */
const deleteUserFaceFiles = async (userId, staffCode = null, photoPath = null) => {
  if (!userId && !staffCode && !photoPath) return;
  const idStr = userId ? userId.toString() : '';
  const codeStr = staffCode ? staffCode.toString().replace(/[^a-zA-Z0-9_-]/g, '_') : '';

  const prefixes = [];
  if (codeStr) prefixes.push(`faces/face-${codeStr}-`);
  if (idStr) prefixes.push(`faces/face-${idStr}-`);

  // 1. Xóa trên MinIO Object Storage
  const hasMinio = await ensureBucketExists();
  if (hasMinio && minioClient) {
    try {
      const objectsToDelete = new Set();

      // Nếu có tên file ảnh cụ thể, xóa trực tiếp
      if (photoPath) {
        const clean = photoPath.replace(/^\/api\/(?:v1\/)?uploads\//, '').replace(/^\/uploads\//, '');
        const objKey = clean.startsWith('faces/') ? clean : `faces/${clean}`;
        objectsToDelete.add(objKey);
      }

      for (const prefix of prefixes) {
        const stream = minioClient.listObjects(MINIO_BUCKET_NAME, prefix, true);
        for await (const obj of stream) {
          if (obj && obj.name) {
            objectsToDelete.add(obj.name);
          }
        }
      }

      if (objectsToDelete.size > 0) {
        await minioClient.removeObjects(MINIO_BUCKET_NAME, Array.from(objectsToDelete));
      }
    } catch (minioErr) {
      console.warn('[Object Storage] Lỗi khi xóa tệp MinIO cho user:', minioErr.message);
    }
  }

  // 2. Xóa trên các thư mục local fallback
  const localDirs = [
    path.join(LOCAL_STORAGE_ROOT, 'faces'),
    path.resolve(__dirname, '../../uploads/faces'),
  ];

  for (const dir of localDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = await fsp.readdir(dir);
        for (const file of files) {
          const matchesCode = codeStr && file.startsWith(`face-${codeStr}-`);
          const matchesId = idStr && file.startsWith(`face-${idStr}-`);
          const matchesPhoto = photoPath && file === path.basename(photoPath);
          if (matchesCode || matchesId || matchesPhoto) {
            await fsp.unlink(path.join(dir, file)).catch(() => {});
          }
        }
      } catch (_) {}
    }
  }
};

/**
 * 9. Sinh URL Ký Trước (Presigned GET URL) có giới hạn thời gian
 * @param {string} objectKey Đường dẫn định danh tệp
 * @param {number} expirySeconds Thời gian hết hạn của URL (mặc định 900s = 15 phút)
 * @returns {Promise<string>} Signed URL truy cập tệp an toàn
 */
const getPresignedUrl = async (objectKey, expirySeconds = 900) => {
  const cleanKey = objectKey.replace(/^[/\\]+/, '');
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      const url = await minioClient.presignedGetObject(MINIO_BUCKET_NAME, cleanKey, expirySeconds);
      return url;
    } catch (error) {
      console.warn(`[Object Storage] Không thể sinh Presigned URL cho '${cleanKey}': ${error.message}`);
    }
  }

  // Fallback: Trả về endpoint API proxy an toàn nội bộ
  if (cleanKey.startsWith('evidence/')) {
    const filename = cleanKey.replace(/^evidence[/\\]+/, '');
    return `/api/v1/attendance/evidence/${filename}`;
  }
  return `/api/upload/file/${path.basename(cleanKey)}`;
};

/**
 * 10. Trạng thái kết nối của MinIO
 */
const getStorageStatus = () => ({
  driver: STORAGE_DRIVER,
  isMinioAvailable,
  bucketInitialized,
  bucketName: MINIO_BUCKET_NAME,
  endpoint: `${MINIO_ENDPOINT}:${MINIO_PORT}`,
  localFallbackRoot: LOCAL_STORAGE_ROOT,
});

module.exports = {
  getMinioClient,
  ensureBucketExists,
  putObject,
  getObject,
  getObjectStream,
  deleteObject,
  deleteUserFaceFiles,
  resolveLocalPath,
  getPresignedUrl,
  getStorageStatus,
  MINIO_BUCKET_NAME,
  LOCAL_STORAGE_ROOT,
  getLocalEvidenceDir,
};

