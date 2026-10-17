/**
 * Trả kết quả tải tệp lên và phục vụ tải tệp đã lưu qua các tuyến HTTP.
 */
const { sendSuccess, sendError, getBaseUrl } = require('../utils/responseHandler');
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../middlewares/upload.middleware');
const User = require('../models/user.model');
const LeaveRequest = require('../models/leaveRequest.model');
const { verifyToken } = require('../middlewares/auth.middleware');
const { isUserInDeanScope } = require('../utils/deanScope');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sendStoredFile = (res, filePath, isPublic) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-store',
  });
  return res.sendFile(filePath);
};

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

    const fileUrl = `/api/uploads/${file.filename}`;
    const baseUrl = getBaseUrl(req);
    const fullUrl = `${baseUrl}${fileUrl}`;

    return sendSuccess(res, 'Tải lên file thành công.', {
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      fileUrl,
      fullUrl,
      url: fullUrl, // Trả về đường dẫn tuyệt đối cho Mobile App
    }, 201);
  } catch (error) {
    next(error);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    const filename = req.params.filename;
    if (
      typeof filename !== 'string' ||
      filename !== path.basename(filename) ||
      !/^[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|pdf|docx?)$/i.test(filename)
    ) {
      return sendError(res, 'Tên file không hợp lệ.', null, 400);
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(uploadDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Không tìm thấy file.', null, 404);
    }

    const escapedFilename = escapeRegExp(safeFilename);
    const mediaReferencePattern = new RegExp(`${escapedFilename}(?:[?#].*)?$`, 'i');
    const isAvatar = await User.exists({ avatar: { $regex: mediaReferencePattern } });
    if (isAvatar) {
      return sendStoredFile(res, filePath, true);
    }

    const leaveRequest = await LeaveRequest.findOne({
      attachmentUrl: { $regex: mediaReferencePattern },
    })
      .select('userId')
      .populate('userId', 'departmentId');
    if (!leaveRequest) {
      return sendError(res, 'Không tìm thấy tài liệu đính kèm.', null, 404);
    }

    return verifyToken(req, res, (authError) => {
      if (authError) {
        return next(authError);
      }

      const ownerId = leaveRequest.userId?._id || leaveRequest.userId;
      const currentUser = req.user;
      const authorizeAndSend = async () => {
        if (currentUser.role === 'admin') {
          return sendStoredFile(res, filePath, false);
        }
        if (currentUser.role === 'truongkhoa') {
          if (await isUserInDeanScope(currentUser, ownerId)) {
            return sendStoredFile(res, filePath, false);
          }
          return sendError(res, 'Bạn không có quyền xem tài liệu ngoài khoa.', null, 403);
        }
        if (ownerId?.toString() === currentUser.id) {
          return sendStoredFile(res, filePath, false);
        }
        return sendError(res, 'Bạn không có quyền xem tài liệu của người khác.', null, 403);
      };

      authorizeAndSend().catch(next);
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadSingleFile,
  downloadFile,
};
