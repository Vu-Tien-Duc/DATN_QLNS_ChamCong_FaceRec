// Quản lý đăng ký, chống trùng lặp và xóa mẫu vector khuôn mặt (MauKhuonMat + FAISS RAM)
const { Op } = require('sequelize');
const { NguoiDung, MauKhuonMat, NhatKyKiemToan } = require('../../models');
const {
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
} = require('../../utils/hoTroChamCong');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');
const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { normalizeRole, UNIT_LEADER_ROLES } = require('../../utils/vaiTro.utils');
const { extractFaceEmbedding, addFaissTemplate, removeFaissTemplate } = require('./ketNoiDichVuKhuonMat');

const VALID_DIMENSIONS = 512;
const DEFAULT_POSES = ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'];
const POSE_LABELS = {
  chinh_dien: 'Chính diện (nhìn thẳng)',
  nghieng_trai: 'Nghiêng trái (15°-25°)',
  nghieng_phai: 'Nghiêng phải (15°-25°)',
  ngua_len: 'Ngửa lên (15°-20°)',
  cui_xuong: 'Cúi xuống (15°-20°)',
};

// Kiểm tra mảng vector khuôn mặt đúng 512 phần tử số hợp lệ
const isValidVector512 = (vec) =>
  Array.isArray(vec) &&
  vec.length === VALID_DIMENSIONS &&
  vec.every((val) => typeof val === 'number' && Number.isFinite(val));

// Đăng ký hoặc cập nhật mẫu vector khuôn mặt 512 chiều cho người dùng kèm chống trùng lặp
const registerFaceDescriptorForUser = async ({
  id,
  faceDescriptor,
  faceDescriptors,
  descriptors,
  sampleAngles,
  force,
  overrideDuplicate,
  currentUser,
  ip,
  facePhotoUrl,
  onValidated,
}) => {
  const isForce = force === true || force === 'true' || overrideDuplicate === true;

  let vectorList = [];
  const rawList = faceDescriptors || descriptors;

  if (Array.isArray(rawList) && rawList.length > 0) {
    for (let i = 0; i < rawList.length; i++) {
      if (!isValidVector512(rawList[i])) {
        throw new ServiceError(
          `Vector mẫu thứ ${i + 1} không hợp lệ: Phải là mảng đúng 512 số thực chuẩn hóa.`,
          400
        );
      }
    }
    vectorList = rawList;
  } else if (isValidVector512(faceDescriptor)) {
    vectorList = [faceDescriptor];
  } else {
    throw new ServiceError('Yêu cầu cung cấp vector khuôn mặt 512 chiều hợp lệ (InsightFace buffalo_s).', 400);
  }

  const effectiveSampleAngles = Array.isArray(sampleAngles) && sampleAngles.length === vectorList.length
    ? sampleAngles
    : DEFAULT_POSES.slice(0, vectorList.length);

  if (!isValidUuid(id)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }
  const targetUser = await NguoiDung.findByPk(id);
  if (!targetUser) {
    throw new ServiceError('Không tìm thấy thông tin nhân sự cần đăng ký Face ID.', 404);
  }

  // Chống trùng lặp sinh trắc học
  const otherUsers = (await getCachedUsersWithFace()).filter(
    (u) => String(u.id || u._id) !== String(targetUser.id)
  );

  const dupCheck = checkDuplicateFace(vectorList, otherUsers);
  if (dupCheck.isDuplicate && dupCheck.duplicateUser && !isForce) {
    const dup = dupCheck.duplicateUser;
    const staffInfo = dup.ma_can_bo ? `Mã CB: ${dup.ma_can_bo} - ` : '';
    throw new ServiceError(
      `Phát hiện trùng lặp sinh trắc học: Khuôn mặt này đã được đăng ký cho tài khoản "${dup.ho_ten}" (${staffInfo}${dup.email || 'đã có Face ID'}). Mỗi nhân sự chỉ được sở hữu một khuôn mặt duy nhất trong hệ thống!`,
      409,
      'USER_FACE_ALREADY_REGISTERED',
      {
        duplicateUserId: dup.id || dup._id,
        duplicateFullName: dup.ho_ten,
        duplicateEmail: dup.email,
        duplicateStaffCode: dup.ma_can_bo,
        distance: dupCheck.distance,
        similarity: dupCheck.similarity,
        threshold: dupCheck.threshold,
      }
    );
  }

  const vectorTrungBinh = computeNormalizedCentroid(vectorList) || vectorList[0];
  const now = new Date();

  let effectiveFacePhotoUrl = facePhotoUrl;
  if (typeof onValidated === 'function') {
    const resolvedPhotoUrl = await onValidated(targetUser);
    if (resolvedPhotoUrl) {
      effectiveFacePhotoUrl = resolvedPhotoUrl;
    }
  }

  let templateDoc = null;
  await runInTransaction(async (transaction) => {
    await MauKhuonMat.update(
      { mac_dinh: false },
      { where: { nguoi_dung_id: targetUser.id, mac_dinh: true }, transaction }
    );

    templateDoc = await MauKhuonMat.create(
      {
        nguoi_dung_id: targetUser.id,
        vector_dac_trung: vectorList,
        vector_trung_binh: vectorTrungBinh,
        so_chieu_vector: VALID_DIMENSIONS,
        mo_hinh_ai: 'buffalo_s',
        anh_dai_dien: effectiveFacePhotoUrl || null,
        so_luong_mau: vectorList.length,
        mac_dinh: true,
        trang_thai: 'da_kich_hoat',
        ngay_dang_ky: now,
      },
      { transaction }
    );
  });

  invalidateFaceCache();

  addFaissTemplate({
    userId: String(targetUser.id),
    embeddings: vectorList,
    fullName: targetUser.ho_ten,
    employeeId: targetUser.ma_can_bo || targetUser.email || String(targetUser.id),
  }).catch((err) => console.warn('[FAISS Sync Warning]:', err.message));

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser?.id || targetUser.id,
    loai_chu_the: 'user',
    hanh_dong: isForce && dupCheck.isDuplicate ? 'FORCE_REGISTER_FACE_DESCRIPTOR' : 'REGISTER_FACE_DESCRIPTOR',
    doi_tuong_id: String(targetUser.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ip || null,
    chi_tiet: {
      userEmail: targetUser.email,
      sampleCount: vectorList.length,
      sampleAngles: effectiveSampleAngles,
      forcedOverride: isForce,
      encryptionAlgorithm: 'aes-256-gcm',
      biometricConsent: {
        accepted: true,
        policyVersion: 'ND-13/2023-v1',
        consentedAt: now.toISOString(),
      },
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    userId: targetUser.id,
    fullName: targetUser.ho_ten,
    email: targetUser.email,
    isFaceRegistered: true,
    sampleCount: vectorList.length,
    sampleAngles: effectiveSampleAngles,
    templateId: templateDoc.id,
  };
};

// Trích xuất vector từ nhiều ảnh khuôn mặt tải lên rồi lưu mẫu sinh trắc học cho người dùng
const registerFaceImagesForUser = async ({ id, files, sampleAngles, force, currentUser, ip }) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ServiceError('Vui lòng cung cấp ít nhất một file ảnh khuôn mặt.', 400);
  }

  const descriptors = [];
  const recordedPoses = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const poseKey = (Array.isArray(sampleAngles) && sampleAngles[idx]) ? sampleAngles[idx] : (DEFAULT_POSES[idx] || `goc_${idx + 1}`);
    const poseLabel = POSE_LABELS[poseKey] || `Góc ${idx + 1}`;

    const extraction = await extractFaceEmbedding({
      imageBuffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    if (extraction.status !== 'face_detected' || extraction.embeddingDimensions !== 512) {
      const msg = extraction.status === 'no_face'
        ? 'không phát hiện được khuôn mặt rõ ràng'
        : extraction.status === 'multiple_faces'
          ? 'có nhiều hơn một khuôn mặt lọt vào khung hình'
          : 'không trích xuất được vector chuẩn 512 chiều';
      throw new ServiceError(`Ảnh ${poseLabel} ${msg}. Vui lòng chụp lại riêng góc này.`, 400);
    }

    descriptors.push(extraction.embedding);
    recordedPoses.push(poseKey);
  }

  return registerFaceDescriptorForUser({
    id,
    faceDescriptors: descriptors,
    sampleAngles: recordedPoses,
    force,
    currentUser,
    ip,
  });
};

// Xóa dữ liệu mẫu khuôn mặt khỏi SQL Server và FAISS RAM
const removeFaceDescriptorForUser = async ({ id, currentUser, ip }) => {
  if (!id) {
    throw new ServiceError('Thiếu định danh người dùng cần xóa dữ liệu khuôn mặt.', 400);
  }

  let targetUser = null;
  if (isValidUuid(id)) {
    targetUser = await NguoiDung.findByPk(id);
  }
  if (!targetUser) {
    targetUser = await NguoiDung.findOne({
      where: {
        [Op.or]: [{ ma_can_bo: String(id).toUpperCase() }, { email: String(id).toLowerCase() }],
      },
    });
  }

  if (!targetUser) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  if (currentUser) {
    const isSelf = String(currentUser.id || currentUser._id) === String(targetUser.id);
    const actorRole = normalizeRole(currentUser.vai_tro_chinh || currentUser.role);
    const isTopAdmin = ['admin', 'bgh', 'tccb'].includes(actorRole);
    if (!isSelf && !isTopAdmin) {
      if (UNIT_LEADER_ROLES.includes(actorRole)) {
        const inScope = await isUserInDeanScope(currentUser, targetUser.id);
        if (!inScope) {
          throw new ServiceError('Bạn không có quyền xóa dữ liệu sinh trắc học của nhân sự ngoài phạm vi quản lý.', 403);
        }
      } else {
        throw new ServiceError('Bạn không có quyền yêu cầu xóa dữ liệu sinh trắc học của người khác.', 403);
      }
    }
  }

  const deletedCount = await MauKhuonMat.destroy({
    where: { nguoi_dung_id: targetUser.id },
  });

  const currentAvatar = targetUser.anh_dai_dien || '';
  if (currentAvatar.includes('/faces/face-') || currentAvatar.includes('face-')) {
    targetUser.anh_dai_dien = null;
    await targetUser.save();
  }

  const { deleteUserFaceFiles } = require('../../config/minio');
  await deleteUserFaceFiles(
    targetUser.id,
    targetUser.ma_can_bo,
    currentAvatar
  ).catch((err) => console.warn('[Face Storage Cleanup Warning]:', err.message));

  invalidateFaceCache();

  removeFaissTemplate(String(targetUser.id)).catch((err) =>
    console.warn('[FAISS Remove Warning]:', err.message)
  );

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser?.id || targetUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'BIOMETRIC_DATA_PURGED_RIGHT_TO_ERASURE',
    doi_tuong_id: String(targetUser.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ip || null,
    chi_tiet: {
      userEmail: targetUser.email,
      deletedTemplatesCount: deletedCount,
      legalBasis: 'ND13-2023-Right-To-Erasure',
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    success: true,
    message: 'Đã xóa và hủy bỏ vĩnh viễn dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP thành công.',
    userId: targetUser.id,
    fullName: targetUser.ho_ten,
    faceRegistered: false,
    deletedCount,
  };
};

// Lấy thông tin mẫu khuôn mặt mặc định theo ID người dùng
const getFaceTemplateByUserId = async (userId) => {
  return MauKhuonMat.findOne({
    where: { nguoi_dung_id: userId, mac_dinh: true },
    attributes: ['id', 'so_luong_mau', 'mo_hinh_ai', 'ngay_dang_ky', 'so_chieu_vector', 'mac_dinh', 'anh_dai_dien', 'trang_thai'],
  });
};

// Tìm người dùng theo UUID, email hoặc mã cán bộ
const findTargetUserForFace = async (identifier) => {
  if (!identifier) return null;
  if (isValidUuid(String(identifier))) {
    const byId = await NguoiDung.findByPk(String(identifier));
    if (byId) return byId;
  }
  return NguoiDung.findOne({
    where: {
      [Op.or]: [
        { email: String(identifier).toLowerCase() },
        { ma_can_bo: String(identifier).toUpperCase() },
      ],
    },
  });
};

// Kiểm tra trạng thái đã đăng ký khuôn mặt của một người dùng
const getFaceRegistrationStatusByUserId = async (targetId) => {
  const user = isValidUuid(String(targetId)) ? await NguoiDung.findByPk(String(targetId)) : null;
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const template = await MauKhuonMat.findOne({
    where: { nguoi_dung_id: user.id, mac_dinh: true },
  });

  const hasValidTemplate = Boolean(
    template &&
      ((Array.isArray(template.vector_dac_trung) && template.vector_dac_trung.length > 0) ||
        (Array.isArray(template.vector_trung_binh) && template.vector_trung_binh.length > 0))
  );

  const sampleCount = hasValidTemplate ? Number(template?.so_luong_mau || 0) : 0;
  const sampleAngles = hasValidTemplate ? DEFAULT_POSES.slice(0, sampleCount) : [];

  return {
    nguoi_dung_id: user.id,
    ho_ten: user.ho_ten,
    email: user.email,
    ma_can_bo: user.ma_can_bo,
    da_dang_ky_face: hasValidTemplate,
    ngay_dang_ky: hasValidTemplate ? template?.ngay_dang_ky || null : null,
    anh_dai_dien: hasValidTemplate ? template?.anh_dai_dien || user.anh_dai_dien || null : null,
    so_luong_mau: sampleCount,
    cac_goc_chup: sampleAngles,
    mo_hinh_ai: template?.mo_hinh_ai || 'buffalo_s',
    so_chieu_vector: hasValidTemplate ? Number(template?.so_chieu_vector || 512) : null,
    mac_dinh: hasValidTemplate ? Boolean(template?.mac_dinh ?? true) : false,
    trang_thai_khuon_mat: hasValidTemplate ? (template?.trang_thai || 'hoat_dong') : null,
    userId: user.id,
    fullName: user.ho_ten,
    staffCode: user.ma_can_bo,
    isFaceRegistered: hasValidTemplate,
    faceRegisteredAt: hasValidTemplate ? template?.ngay_dang_ky || null : null,
    facePhoto: hasValidTemplate ? template?.anh_dai_dien || user.anh_dai_dien || null : null,
    sampleCount,
    sampleAngles,
    embeddingModel: template?.mo_hinh_ai || 'buffalo_s',
    vectorDimension: hasValidTemplate ? Number(template?.so_chieu_vector || 512) : null,
    isDefaultFace: hasValidTemplate ? Boolean(template?.mac_dinh ?? true) : false,
    faceStatus: hasValidTemplate ? (template?.trang_thai || 'hoat_dong') : null,
  };
};

module.exports = {
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
  getFaceTemplateByUserId,
  findTargetUserForFace,
  getFaceRegistrationStatusByUserId,
};
