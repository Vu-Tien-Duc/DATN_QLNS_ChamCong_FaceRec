/**
 * Controller Tải Lên & Tải Xuống Tệp Tin (Upload Controller)
 * Thuần túy tích hợp MinIO Object Storage (S3-Compatible) & Bảo mật phân quyền:
 * - Tiếp nhận Buffer nhị phân trong RAM (MemoryStorage) và tải trực tiếp lên MinIO.
 * - Kiểm soát thẩm quyền tải tệp (Admin, Trưởng khoa theo phạm vi khoa, chính chủ).
 * - Stream dữ liệu nhị phân từ MinIO ra HTTP response hoặc sinh Presigned Signed URL.
 * - Đã loại bỏ 100% các đoạn code cũ ghi/đọc ổ cứng cục bộ (fs/uploadDir).
 */

const crypto = require('crypto');
const path = require('path');
const { sendSuccess, sendError, getBaseUrl } = require('../utils/responseHandler');
const { EXTENSIONS_BY_MIME_TYPE } = require('../middlewares/upload.middleware');
const minioStorage = require('../config/minio');
const User = require('../models/user.model');
const LeaveRequest = require('../models/leaveRequest.model');
const { verifyToken } = require('../middlewares/auth.middleware');
const { isUserInDeanScope } = require('../utils/deanScope');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @desc Upload file đính kèm (ảnh minh chứng, đơn nghỉ phép scan, giấy khám bệnh...)
 * @route POST /api/upload
 */
const uploadSingleFile = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!file) {
      return sendError(res, 'Vui lòng chọn file cần tải lên.', null, 400);
    }

    const buffer = file.buffer;
    if (!buffer || buffer.length === 0) {
      return sendError(res, 'Nội dung tệp rỗng hoặc không đọc được.', null, 400);
    }

    // Xác định phần mở rộng an toàn dựa trên MIME type
    const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[file.mimetype];
    const originalExt = path.extname(file.originalname).toLowerCase();
    const extension = allowedExtensions?.includes(originalExt)
      ? originalExt
      : allowedExtensions
        ? allowedExtensions[0]
        : originalExt || '.bin';
    const filename = `attachment-${crypto.randomUUID()}${extension}`;

    // Lưu trữ trực tiếp lên MinIO Object Storage
    const objectKey = `attachments/${filename}`;
    const uploadResult = await minioStorage.putObject(objectKey, buffer, file.mimetype, {
      originalName: encodeURIComponent(file.originalname),
      uploadedBy: req.user?.id || 'anonymous',
    });

    const fileUrl = `/api/uploads/${filename}`;
    const baseUrl = getBaseUrl(req);
    const fullUrl = `${baseUrl}${fileUrl}`;

    // Sinh Presigned GET URL nếu MinIO sẵn sàng (thời hạn 1 giờ)
    let presignedUrl = null;
    try {
      if (uploadResult.storage === 'minio') {
        presignedUrl = await minioStorage.getPresignedUrl(objectKey, 3600);
      }
    } catch (_) {}

    return sendSuccess(
      res,
      'Tải lên file thành công.',
      {
        originalName: file.originalname,
        filename,
        mimetype: file.mimetype,
        size: buffer.length,
        fileUrl,
        fullUrl,
        url: presignedUrl || fullUrl,
        presignedUrl,
        storage: uploadResult.storage,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Tải xuống hoặc xem tệp đính kèm (có kiểm tra quyền RBAC và stream từ MinIO)
 * @route GET /uploads/:filename hoặc GET /api/uploads/:filename
 */
const downloadFile = async (req, res, next) => {
  try {
    const rawFilename = req.params.filename;
    if (
      typeof rawFilename !== 'string' ||
      !/^[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|pdf|docx?)$/i.test(rawFilename)
    ) {
      return sendError(res, 'Tên file không hợp lệ.', null, 400);
    }

    const safeFilename = path.basename(rawFilename);
    const isFaceImage = safeFilename.startsWith('face-');
    const objectKey = isFaceImage ? `faces/${safeFilename}` : `attachments/${safeFilename}`;

    // 1. Phân quyền truy cập tệp:
    const escapedFilename = escapeRegExp(safeFilename);
    const mediaReferencePattern = new RegExp(`${escapedFilename}(?:[?#].*)?$`, 'i');

    // 1.1 Nếu là Avatar người dùng hoặc Ảnh đại diện khuôn mặt: cho phép hiển thị công khai trên thẻ <img>
    const isAvatarOrFacePhoto = await User.exists({
      $or: [
        { avatar: { $regex: mediaReferencePattern } },
        { anh_dai_dien: { $regex: mediaReferencePattern } },
        { facePhoto: { $regex: mediaReferencePattern } },
        { anh_khuon_mat: { $regex: mediaReferencePattern } },
      ],
    });
    if (isAvatarOrFacePhoto) {
      return streamMinioFile(res, objectKey, true);
    }

    // 1.2 Nếu là ảnh chụp khuôn mặt sinh trắc học chưa gắn vào hồ sơ công khai: kiểm tra quyền người dùng
    if (isFaceImage) {
      if (!req.headers.authorization) {
        return streamMinioFile(res, objectKey, false);
      }
      const faceUser = await User.findOne({ facePhoto: { $regex: mediaReferencePattern } }).select('_id');
      return verifyToken(req, res, (authError) => {
        if (authError) return next(authError);
        const currentUser = req.user;
        if (currentUser.role === 'admin' || (faceUser && faceUser._id.toString() === currentUser.id)) {
          return streamMinioFile(res, objectKey, false);
        }
        return sendError(res, 'Bạn không có quyền truy cập ảnh sinh trắc học này.', null, 403);
      });
    }

    // 1.3 Nếu là tài liệu đính kèm đơn nghỉ phép:
    const leaveRequest = await LeaveRequest.findOne({
      attachmentUrl: { $regex: mediaReferencePattern },
    })
      .select('userId')
      .populate('userId', 'departmentId');

    if (!leaveRequest) {
      return streamMinioFile(res, objectKey, false);
    }

    // Xác thực người dùng và phân quyền theo phạm vi (Admin, Trưởng khoa, Chủ đơn)
    return verifyToken(req, res, (authError) => {
      if (authError) {
        return next(authError);
      }

      const ownerId = leaveRequest.userId?._id || leaveRequest.userId;
      const currentUser = req.user;

      const authorizeAndSend = async () => {
        if (currentUser.role === 'admin') {
          return streamMinioFile(res, objectKey, false);
        }
        if (currentUser.role === 'truongkhoa') {
          if (await isUserInDeanScope(currentUser, ownerId)) {
            return streamMinioFile(res, objectKey, false);
          }
          return sendError(res, 'Bạn không có quyền xem tài liệu ngoài khoa.', null, 403);
        }
        if (ownerId?.toString() === currentUser.id) {
          return streamMinioFile(res, objectKey, false);
        }
        return sendError(res, 'Bạn không có quyền xem tài liệu của người khác.', null, 403);
      };

      authorizeAndSend().catch(next);
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Stream trực tiếp đối tượng từ MinIO Object Storage ra response
 */
const streamMinioFile = async (res, objectKey, isPublic) => {
  try {
    const fileStream = await minioStorage.getObjectStream(objectKey);
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': fileStream.contentType || 'application/octet-stream',
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-store',
    });
    return fileStream.stream.pipe(res);
  } catch (storageError) {
    return sendError(res, 'Không tìm thấy tệp trên hệ thống lưu trữ Object Storage.', null, 404);
  }
};

module.exports = {
  uploadSingleFile,
  downloadFile,
};
