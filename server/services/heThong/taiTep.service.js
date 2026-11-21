// Lưu trữ tệp lên MinIO và kiểm tra quyền truy cập tệp riêng tư.
const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');
const { EXTENSIONS_BY_MIME_TYPE } = require('../../middlewares/taiTep.middleware');
const minioStorage = require('../../config/minio');
const { redisGet, redisSet } = require('../../config/redis');
const { NguoiDung, MauKhuonMat, DonNghiPhep, LuotQuetChamCong } = require('../../models');
const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { PERMISSIONS, getEffectivePermissions } = require('../../config/permissions');

const ServiceError = require('../../utils/loiNghiepVu');

const PENDING_UPLOAD_OWNER_PREFIX = 'UPLOAD_OWNER:';
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SAFE_INTERNAL_AVATAR_REGEX = /^\/api\/tai-tep\/tep\/avatar-[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)(?:\?v=\d+)?$/i;
const SAFE_HTTPS_URL_REGEX = /^https:\/\/[^\s<>"']+$/i;

// Kiểm tra và chuẩn hóa URL ảnh đại diện (chỉ chấp nhận tệp nội bộ prefix avatar- hoặc HTTPS hợp lệ)
const normalizeSafeAvatarUrl = (rawUrl) => {
  if (rawUrl === null || rawUrl === undefined) return null;
  if (typeof rawUrl !== 'string') {
    throw new ServiceError('Đường dẫn ảnh đại diện không hợp lệ.', 400);
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (
    trimmed.length > 500 ||
    (!SAFE_INTERNAL_AVATAR_REGEX.test(trimmed) && !SAFE_HTTPS_URL_REGEX.test(trimmed))
  ) {
    throw new ServiceError(
      'Đường dẫn ảnh đại diện không hợp lệ. Chỉ chấp nhận tệp ảnh đại diện (/api/tai-tep/tep/avatar-...) hoặc URL HTTPS.',
      400
    );
  }
  return trimmed;
};

// Lưu tệp đính kèm tải lên lên MinIO và ghi nhận chủ sở hữu tạm thời để người tải xem trước an toàn
const saveUploadedAttachment = async (file, userId = 'anonymous') => {
  const buffer = file.buffer;
  const mime = String(file.mimetype || '').toLowerCase();
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[file.mimetype];
  const originalExt = path.extname(file.originalname).toLowerCase();
  const extension = allowedExtensions?.includes(originalExt)
    ? originalExt
    : allowedExtensions
      ? allowedExtensions[0]
      : originalExt || '.bin';
  const isAvatarUpload = file.fieldname === 'avatar' && AVATAR_MIME_TYPES.has(mime);
  const filename = `${isAvatarUpload ? 'avatar' : 'attachment'}-${crypto.randomUUID()}${extension}`;

  const objectKey = isAvatarUpload ? `avatars/${filename}` : `attachments/${filename}`;
  const uploadResult = await minioStorage.putObject(objectKey, buffer, file.mimetype, {
    originalName: encodeURIComponent(file.originalname),
    uploadedBy: userId,
    ...(isAvatarUpload ? { category: 'avatar' } : {}),
  });

  if (!isAvatarUpload && userId && userId !== 'anonymous') {
    await redisSet(`${PENDING_UPLOAD_OWNER_PREFIX}${filename}`, String(userId), 86400).catch(() => {});
  }

  return {
    filename,
    fileUrl: `/api/tai-tep/tep/${filename}`,
    storage: uploadResult.storage,
    size: buffer.length,
  };
};

// Xác định bucket prefix và chính sách kiểm soát quyền tải của tệp theo tên tệp
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

  // Chỉ tệp có tiền tố avatar- mới được phép truy cập công khai
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
    if (safeFilename.startsWith('attachment-')) {
      const pendingOwnerId = await redisGet(`${PENDING_UPLOAD_OWNER_PREFIX}${safeFilename}`).catch(() => null);
      if (pendingOwnerId) {
        return { objectKey, access: 'pending_attachment', ownerId: String(pendingOwnerId) };
      }
    }
    return { objectKey, access: 'restricted_admin' };
  }

  return {
    objectKey,
    access: 'leave_attachment',
    ownerId: String(leaveRequest.nguoi_dung_id),
  };
};

// Kiểm tra người dùng hiện tại có quyền xem tệp riêng tư thuộc một chủ sở hữu
const canAccessScopedFile = async (
  currentUser,
  ownerId,
  { allowTccb = false, requireLeaveApprovalAuthority = false } = {}
) => {
  const currentUserId = String(currentUser.id);

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh'])) return { allowed: true };
  if (allowTccb && hasAnyActiveRole(currentUser, ['tccb'])) return { allowed: true };
  if (ownerId && ownerId === currentUserId) return { allowed: true };

  if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    if (requireLeaveApprovalAuthority) {
      const perms = getEffectivePermissions(currentUser);
      if (!perms.has(PERMISSIONS.DON_TU_DUYET_CAP_1)) {
        return {
          allowed: false,
          message: 'Phó đơn vị chưa được ủy quyền không có quyền xem tệp đính kèm đơn nghỉ phép của người khác.',
        };
      }
    }
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

// Kiểm tra quyền xem tệp đính kèm của đơn nghỉ phép (chỉ chính chủ, Admin/BGH hoặc Trưởng đơn vị / Phó có ủy quyền)
const canAccessLeaveAttachment = (currentUser, ownerId) =>
  canAccessScopedFile(currentUser, ownerId, {
    allowTccb: false,
    requireLeaveApprovalAuthority: true,
  });

// Kiểm tra quyền xem ảnh minh chứng điểm danh hoặc ảnh mẫu sinh trắc học khuôn mặt
const canAccessAttendanceEvidence = (currentUser, ownerId) =>
  canAccessScopedFile(currentUser, ownerId, { allowTccb: true });

// Kiểm tra quyền xem ảnh mẫu sinh trắc học khuôn mặt (chính chủ, Admin/BGH/TCCB hoặc trưởng/phó đơn vị cùng khoa)
const canAccessFaceImage = (currentUser, ownerId) =>
  canAccessScopedFile(currentUser, ownerId, { allowTccb: true });

module.exports = {
  normalizeSafeAvatarUrl,
  saveUploadedAttachment,
  resolveDownloadPolicy,
  canAccessLeaveAttachment,
  canAccessAttendanceEvidence,
  canAccessFaceImage,
};
