/**
 * Dịch vụ Tải lên & Phân quyền Tải xuống Tệp (server/services/taiTep.service.js)
 * Tách logic truy vấn CSDL & kiểm tra quyền truy cập tệp MinIO khỏi taiTep.controller.js.
 */
const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');
const { EXTENSIONS_BY_MIME_TYPE } = require('../../middlewares/taiTep.middleware');
const minioStorage = require('../../config/minio');
const { NguoiDung, MauKhuonMat, DonNghiPhep, LuotQuetChamCong } = require('../../models');
const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { normalizeRole } = require('../../utils/vaiTro.utils');

const saveUploadedAttachment = async (file, userId = 'anonymous') => {
  const buffer = file.buffer;
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[file.mimetype];
  const originalExt = path.extname(file.originalname).toLowerCase();
  const extension = allowedExtensions?.includes(originalExt)
    ? originalExt
    : allowedExtensions
      ? allowedExtensions[0]
      : originalExt || '.bin';
  const filename = `attachment-${crypto.randomUUID()}${extension}`;

  const objectKey = `attachments/${filename}`;
  const uploadResult = await minioStorage.putObject(objectKey, buffer, file.mimetype, {
    originalName: encodeURIComponent(file.originalname),
    uploadedBy: userId,
  });

  let presignedUrl = null;
  try {
    if (uploadResult.storage === 'minio') {
      presignedUrl = await minioStorage.getPresignedUrl(objectKey, 3600);
    }
  } catch (_) {}

  return {
    filename,
    fileUrl: `/api/tai-tep/tep/${filename}`,
    presignedUrl,
    storage: uploadResult.storage,
    size: buffer.length,
  };
};

const resolveDownloadPolicy = async (safeFilename) => {
  const isFaceImage = safeFilename.startsWith('face-');
  const isAttendanceEvidence = safeFilename.startsWith('attendance-');
  const isAvatarImage = safeFilename.startsWith('avatar-');
  const objectKey = isFaceImage
    ? `faces/${safeFilename}`
    : isAttendanceEvidence
      ? `evidence/${safeFilename}`
      : isAvatarImage
        ? `avatars/${safeFilename}`
        : `attachments/${safeFilename}`;

  if (isAvatarImage) {
    return { objectKey, access: 'public' };
  }

  const likePattern = `%${safeFilename}%`;
  if (isAttendanceEvidence) {
    const punchLog = await LuotQuetChamCong.findOne({
      where: { anh_minh_chung: { [Op.like]: likePattern } },
      attributes: ['id', 'nguoi_dung_id'],
    });
    return {
      objectKey,
      access: 'attendance_evidence',
      ownerId: punchLog?.nguoi_dung_id ? String(punchLog.nguoi_dung_id) : null,
    };
  }

  const avatarUser = await NguoiDung.findOne({
    where: { anh_dai_dien: { [Op.like]: likePattern } },
    attributes: ['id'],
  });
  if (avatarUser) {
    return { objectKey, access: 'public' };
  }

  if (isFaceImage) {
    const faceTemplate = await MauKhuonMat.findOne({
      where: { anh_dai_dien: { [Op.like]: likePattern } },
      attributes: ['id', 'nguoi_dung_id'],
    });
    return {
      objectKey,
      access: 'face',
      ownerId: faceTemplate ? String(faceTemplate.nguoi_dung_id) : null,
    };
  }

  const leaveRequest = await DonNghiPhep.findOne({
    where: { tep_dinh_kem: { [Op.like]: likePattern } },
    attributes: ['id', 'nguoi_dung_id'],
  });
  if (!leaveRequest) {
    return { objectKey, access: 'restricted_admin' };
  }

  return {
    objectKey,
    access: 'leave_attachment',
    ownerId: String(leaveRequest.nguoi_dung_id),
  };
};

const canAccessScopedFile = async (currentUser, ownerId, { allowTccb = false } = {}) => {
  const currentUserId = String(currentUser.id);
  const currentRole = normalizeRole(currentUser.vai_tro_chinh);

  if (['admin', 'bgh'].includes(currentRole)) return { allowed: true };
  if (allowTccb && currentRole === 'tccb') return { allowed: true };
  if (ownerId && ownerId === currentUserId) return { allowed: true };

  if (['truong_khoa', 'pho_khoa'].includes(currentRole)) {
    if (!ownerId) {
      return { allowed: false, message: 'Không xác định được chủ sở hữu tệp để kiểm tra phạm vi khoa.' };
    }
    const inScope = await isUserInDeanScope(currentUser, ownerId);
    return inScope
      ? { allowed: true }
      : { allowed: false, message: 'Bạn không có quyền xem tài liệu ngoài khoa.' };
  }
  return { allowed: false, message: 'Bạn không có quyền xem tài liệu của người khác.' };
};

const canAccessLeaveAttachment = (currentUser, ownerId) =>
  canAccessScopedFile(currentUser, ownerId, { allowTccb: false });

const canAccessAttendanceEvidence = (currentUser, ownerId) =>
  canAccessScopedFile(currentUser, ownerId, { allowTccb: true });

module.exports = {
  saveUploadedAttachment,
  resolveDownloadPolicy,
  canAccessLeaveAttachment,
  canAccessAttendanceEvidence,
};
