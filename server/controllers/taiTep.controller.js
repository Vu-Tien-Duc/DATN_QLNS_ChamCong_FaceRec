// Tải lên tệp đính kèm và phân quyền stream tải tệp từ MinIO / lưu trữ cục bộ
const path = require('path');
const { sendSuccess, sendError, getBaseUrl } = require('../utils/phanHoiHttp');
const minioStorage = require('../config/minio');
const { verifyToken } = require('../middlewares/xacThuc.middleware');
const { normalizeRole } = require('../utils/vaiTro.utils');
const taiTepService = require('../services/heThong/taiTep.service');

// Tải lên một tệp đính kèm lên MinIO hoặc lưu trữ cục bộ
const uploadSingleFile = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!file) {
      return sendError(res, 'Vui lòng chọn file cần tải lên.', null, 400);
    }
    if (!file.buffer || file.buffer.length === 0) {
      return sendError(res, 'Nội dung tệp rỗng hoặc không đọc được.', null, 400);
    }

    const saved = await taiTepService.saveUploadedAttachment(file, req.user?.id || 'anonymous');
    const baseUrl = getBaseUrl(req);
    const fullUrl = `${baseUrl}${saved.fileUrl}`;

    return sendSuccess(
      res,
      'Tải lên file thành công.',
      {
        ten_goc: file.originalname,
        ten_tep: saved.filename,
        loai_tep: file.mimetype,
        kich_thuoc: saved.size,
        duong_dan_tep: saved.fileUrl,
        duong_dan_day_du: fullUrl,
        url: saved.presignedUrl || fullUrl,
        luu_tru: saved.storage,
      },
      201
    );
  } catch (error) {
    return next(error);
  }
};

// Kiểm tra quyền truy cập và tải tệp xuống theo chính sách của tệp
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
    const policy = await taiTepService.resolveDownloadPolicy(safeFilename);

    if (policy.access === 'public') {
      return streamMinioFile(res, policy.objectKey, true);
    }
    if (policy.access === 'face') {
      return verifyToken(req, res, (authError) => {
        if (authError) return next(authError);
        const currentUser = req.user;
        if (
          ['admin', 'bgh', 'tccb'].includes(normalizeRole(currentUser.vai_tro_chinh)) ||
          (policy.ownerId && policy.ownerId === String(currentUser.id))
        ) {
          return streamMinioFile(res, policy.objectKey, false);
        }
        return sendError(res, 'Bạn không có quyền truy cập ảnh sinh trắc học này.', null, 403);
      });
    }
    if (policy.access === 'restricted_admin') {
      return verifyToken(req, res, (authError) => {
        if (authError) return next(authError);
        const currentRole = normalizeRole(req.user.vai_tro_chinh);
        if (['admin', 'bgh'].includes(currentRole)) {
          return streamMinioFile(res, policy.objectKey, false);
        }
        return sendError(res, 'Bạn không có quyền truy cập tệp nội bộ chưa liên kết này.', null, 403);
      });
    }

    if (policy.access === 'attendance_evidence') {
      return verifyToken(req, res, (authError) => {
        if (authError) return next(authError);
        taiTepService
          .canAccessAttendanceEvidence(req.user, policy.ownerId)
          .then((result) => {
            if (!result.allowed) {
              return sendError(res, result.message, null, 403);
            }
            return streamMinioFile(res, policy.objectKey, false);
          })
          .catch(next);
      });
    }

    return verifyToken(req, res, (authError) => {
      if (authError) return next(authError);
      taiTepService
        .canAccessLeaveAttachment(req.user, policy.ownerId)
        .then((result) => {
          if (!result.allowed) {
            return sendError(res, result.message, null, 403);
          }
          return streamMinioFile(res, policy.objectKey, false);
        })
        .catch(next);
    });
  } catch (error) {
    return next(error);
  }
};

// Đọc và truyền luồng dữ liệu tệp từ MinIO/cục bộ về HTTP response
const streamMinioFile = async (res, objectKey, isPublic) => {
  try {
    const fileStream = await minioStorage.getObjectStream(objectKey);
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': fileStream.contentType || 'application/octet-stream',
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-store',
    });

    const stream = fileStream.stream;
    stream.on('error', (streamError) => {
      console.error('[Stream MinIO Error]:', streamError?.message || streamError);
      if (!res.headersSent) {
        return sendError(res, 'Lỗi đọc luồng tệp từ hệ thống lưu trữ.', null, 500);
      }
      res.destroy(streamError);
    });
    res.on('close', () => {
      if (typeof stream.destroy === 'function' && !stream.destroyed) {
        stream.destroy();
      }
    });

    return stream.pipe(res);
  } catch (storageError) {
    return sendError(res, 'Không tìm thấy tệp trên hệ thống lưu trữ Object Storage.', null, 404);
  }
};

module.exports = {
  uploadSingleFile,
  downloadFile,
};
