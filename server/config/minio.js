// Lưu trữ tệp lên MinIO/S3 (evidence/, attachments/, faces/, avatars/) và tự động fallback ổ đĩa cục bộ khi MinIO offline

const Minio = require('minio');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const stream = require('stream');

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT, 10) || 9000;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'datn-qlns-storage';
const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1';
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'minio').toLowerCase();

// Thư mục lưu cục bộ di động tương đối theo thư mục dự án khi fallback
const LOCAL_STORAGE_ROOT = path.resolve(
  process.env.STORAGE_LOCAL_DIR || path.resolve(__dirname, '../../storage-uploads')
);
// Lấy đường dẫn lưu ảnh minh chứng điểm danh cục bộ
const getLocalEvidenceDir = () =>
  path.resolve(process.env.ATTENDANCE_EVIDENCE_DIR || path.resolve(__dirname, '../../private/attendance-evidence'));

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

// Khởi tạo hoặc tái sử dụng MinIO Client
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

// Kiểm tra và tự động tạo bucket MinIO nếu chưa tồn tại
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

const assertPathWithinRoot = (rootDir, targetPath) => {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Phát hiện truy cập tệp vượt quá phạm vi thư mục lưu trữ cho phép.');
  }
  return resolvedTarget;
};

const sanitizeObjectKey = (objectKey) => {
  if (typeof objectKey !== 'string' || !objectKey.trim()) {
    throw new Error('Đường dẫn tệp (objectKey) không hợp lệ.');
  }
  if (objectKey.includes('\0') || /^[a-zA-Z]:/.test(objectKey.trim())) {
    throw new Error('Đường dẫn tệp (objectKey) chứa ký tự không hợp lệ.');
  }
  const normalized = objectKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((seg) => seg === '..' || seg === '.')) {
    throw new Error('Đường dẫn tệp (objectKey) chứa phân đoạn traversal không hợp lệ.');
  }
  return segments.join('/');
};

// Quy đổi objectKey thành đường dẫn lưu trữ cục bộ an toàn (chống Path Traversal)
const resolveLocalPath = (objectKey) => {
  const cleanKey = sanitizeObjectKey(objectKey);
  if (cleanKey.startsWith('evidence/')) {
    const filename = cleanKey.slice('evidence/'.length);
    const evidenceRoot = getLocalEvidenceDir();
    const customEvidencePath = assertPathWithinRoot(evidenceRoot, path.join(evidenceRoot, filename));
    if (fs.existsSync(customEvidencePath)) return customEvidencePath;
    const internalEvidenceRoot = path.resolve(__dirname, '../../private/attendance-evidence');
    const internalEvidencePath = assertPathWithinRoot(internalEvidenceRoot, path.join(internalEvidenceRoot, filename));
    if (fs.existsSync(internalEvidencePath)) return internalEvidencePath;
    return customEvidencePath;
  }
  const externalPath = assertPathWithinRoot(LOCAL_STORAGE_ROOT, path.join(LOCAL_STORAGE_ROOT, cleanKey));
  if (fs.existsSync(externalPath)) {
    return externalPath;
  }
  const internalRoot = path.resolve(__dirname, '../../uploads');
  const internalPath = assertPathWithinRoot(internalRoot, path.join(internalRoot, cleanKey));
  if (fs.existsSync(internalPath)) {
    return internalPath;
  }
  return externalPath;
};

// Ghi tệp lên MinIO; nếu MinIO offline thì ghi vào ổ đĩa cục bộ
const putObject = async (objectKey, buffer, contentType = 'application/octet-stream', metaData = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Dữ liệu tải lên phải là một Buffer nhị phân.');
  }

  const cleanKey = sanitizeObjectKey(objectKey);
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
      // Đồng bộ bản sao dự phòng cục bộ để không mất ảnh/tệp khi MinIO tạm ngắt
      try {
        const mirrorPath = resolveLocalPath(cleanKey);
        await fsp.mkdir(path.dirname(mirrorPath), { recursive: true });
        await fsp.writeFile(mirrorPath, buffer);
      } catch (_) {}
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

// Đọc tệp thành Buffer từ MinIO hoặc thư mục cục bộ
const getObject = async (objectKey) => {
  const cleanKey = sanitizeObjectKey(objectKey);
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
    }
  }

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

// Lấy luồng đọc (Readable Stream) để stream trực tiếp về client
const getObjectStream = async (objectKey) => {
  const cleanKey = sanitizeObjectKey(objectKey);
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

// Xóa tệp trên cả MinIO và bản sao cục bộ (nếu có)
const deleteObject = async (objectKey) => {
  const cleanKey = sanitizeObjectKey(objectKey);
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      await minioClient.removeObject(MINIO_BUCKET_NAME, cleanKey);
    } catch (error) {}
  }

  const localPath = resolveLocalPath(cleanKey);
  if (fs.existsSync(localPath)) {
    try {
      await fsp.unlink(localPath);
    } catch (_) {}
  }
};

// Xóa toàn bộ ảnh khuôn mặt của một nhân sự (trên cả MinIO và thư mục cục bộ)
const deleteUserFaceFiles = async (userId, staffCode = null, photoPath = null) => {
  if (!userId && !staffCode && !photoPath) return;
  const idStr = userId ? userId.toString() : '';
  const codeStr = staffCode ? staffCode.toString().replace(/[^a-zA-Z0-9_-]/g, '_') : '';

  const prefixes = [];
  if (codeStr) prefixes.push(`faces/face-${codeStr}-`);
  if (idStr) prefixes.push(`faces/face-${idStr}-`);

  const hasMinio = await ensureBucketExists();
  if (hasMinio && minioClient) {
    try {
      const objectsToDelete = new Set();

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

// Tạo URL tải tệp có thời hạn (mặc định 15 phút); fallback về endpoint proxy nội bộ khi MinIO offline
const getPresignedUrl = async (objectKey, expirySeconds = 900) => {
  const cleanKey = sanitizeObjectKey(objectKey);
  const hasMinio = await ensureBucketExists();

  if (hasMinio && minioClient) {
    try {
      const url = await minioClient.presignedGetObject(MINIO_BUCKET_NAME, cleanKey, expirySeconds);
      return url;
    } catch (error) {
      console.warn(`[Object Storage] Không thể sinh Presigned URL cho '${cleanKey}': ${error.message}`);
    }
  }

  return `/api/tai-tep/tep/${path.basename(cleanKey)}`;
};

// Trả về trạng thái kết nối MinIO và driver lưu trữ hiện tại
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

