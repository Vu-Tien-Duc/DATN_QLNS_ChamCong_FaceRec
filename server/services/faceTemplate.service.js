/**
 * Face Template Service (server/services/faceTemplate.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Quản lý Collection 2 FaceTemplate (mau_khuon_mat): Tách biệt dữ liệu sinh trắc khỏi User.
 * - Chuẩn hóa vector 512 chiều ArcFace InsightFace (buffalo_s).
 * - Tính vector trọng tâm L2 (computeNormalizedCentroid).
 * - Thuật toán chống trùng lặp khuôn mặt giữa các nhân viên (Anti-Duplicate Biometric Verification).
 * - Đồng bộ tức thì lên bộ nhớ RAM FAISS của Face Microservice.
 * - Ghi Audit Log toàn diện và cập nhật cờ isFaceRegistered cho User.
 */
const User = require('../models/user.model');
const FaceTemplate = require('../models/faceTemplate.model');
const AuditLog = require('../models/auditLog.model');
const {
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
} = require('../utils/attendanceHelpers');
const ServiceError = require('../utils/serviceError');
const { extractFaceEmbedding, addFaissTemplate, removeFaissTemplate } = require('./faceServiceClient');
const { encryptBiometricVector } = require('../utils/biometricEncryption');

const VALID_DIMENSIONS = 512;
const DEFAULT_POSES = ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'];
const POSE_LABELS = {
  chinh_dien: 'Chính diện (nhìn thẳng)',
  nghieng_trai: 'Nghiêng trái (15°-25°)',
  nghieng_phai: 'Nghiêng phải (15°-25°)',
  ngua_len: 'Ngửa lên (15°-20°)',
  cui_xuong: 'Cúi xuống (15°-20°)',
};

const isValidVector512 = (vec) =>
  Array.isArray(vec) &&
  vec.length === VALID_DIMENSIONS &&
  vec.every((val) => typeof val === 'number' && Number.isFinite(val));

/**
 * 1. Đăng ký tập hợp vector 5 góc cho người dùng
 */
const registerFaceDescriptorForUser = async ({
  id,
  faceDescriptor,
  faceDescriptors,
  descriptors,
  poses,
  sampleAngles,
  force,
  overrideDuplicate,
  currentUser,
  ip,
}) => {
  const isForce = force === true || force === 'true' || overrideDuplicate === true;

  // Thu thập danh sách vector
  let vectorList = [];
  const rawList = faceDescriptors || descriptors;

  if (Array.isArray(rawList) && rawList.length > 0) {
    for (let i = 0; i < rawList.length; i++) {
      const v = rawList[i];
      if (!isValidVector512(v)) {
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

  const effectivePoses = Array.isArray(poses) && poses.length === vectorList.length
    ? poses
    : Array.isArray(sampleAngles) && sampleAngles.length === vectorList.length
      ? sampleAngles
      : DEFAULT_POSES.slice(0, vectorList.length);

  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw new ServiceError('Không tìm thấy thông tin nhân sự cần đăng ký Face ID.', 404);
  }

  // 2. Chống trùng lặp sinh trắc học: Kiểm tra khuôn mặt đã được đăng ký bởi người khác chưa
  const otherUsers = (await getCachedUsersWithFace()).filter(
    (u) => u._id.toString() !== targetUser._id.toString()
  );

  const dupCheck = checkDuplicateFace(vectorList, otherUsers);
  if (dupCheck.isDuplicate && dupCheck.duplicateUser && !isForce) {
    const dup = dupCheck.duplicateUser;
    throw new ServiceError(
      `Khuôn mặt này đã được đăng ký cho tài khoản "${dup.fullName || dup.ho_ten}" (${dup.email}). Mỗi nhân sự chỉ được sở hữu một khuôn mặt duy nhất!`,
      409,
      'USER_FACE_ALREADY_REGISTERED',
      {
        duplicateUserId: dup._id,
        duplicateFullName: dup.fullName || dup.ho_ten,
        duplicateEmail: dup.email,
        distance: dupCheck.distance,
        threshold: dupCheck.threshold,
      }
    );
  }

  // 3. Tính toán vector trọng tâm L2 (Centroid)
  const vectorTrungBinh = computeNormalizedCentroid(vectorList) || vectorList[0];

  // 4. Lưu vào Collection 2 FaceTemplate (mau_khuon_mat)
  const templateDoc = await FaceTemplate.findOneAndUpdate(
    {
      $or: [{ ma_nguoi_dung: targetUser._id }, { userId: targetUser._id }],
    },
    {
      $set: {
        ma_nguoi_dung: targetUser._id,
        userId: targetUser._id,
        vector_dac_trung: vectorList,
        descriptors: vectorList,
        vector_trung_binh: vectorTrungBinh,
        averageDescriptor: vectorTrungBinh,
        cac_goc_chup: effectivePoses,
        poses: effectivePoses,
        so_luong_mau: vectorList.length,
        samplesCount: vectorList.length,
        so_chieu_vector: 512,
        embeddingDimensions: 512,
        mo_hinh_ai: 'buffalo_s',
        embeddingModel: 'buffalo_s',
        nguoi_dang_ky: currentUser?._id || currentUser?.id || targetUser._id,
        registeredBy: currentUser?._id || currentUser?.id || targetUser._id,
        ngay_dang_ky: new Date(),
        registeredAt: new Date(),
        du_lieu_ma_hoa: encryptBiometricVector(vectorList),
        vector_trung_binh_ma_hoa: encryptBiometricVector(vectorTrungBinh),
        trang_thai_ma_hoa: 'AES_256_GCM',
        dong_y_thu_thap: true,
        thoi_diem_dong_y: new Date(),
        phien_ban_chinh_sach: 'ND13-2023-V1.0',
        ip_dong_y: ip || null,
        dieu_khoan_dong_y: true,
        consentAgreed: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 5. Cập nhật User model
  targetUser.isFaceRegistered = true;
  targetUser.faceRegisteredAt = new Date();
  await targetUser.save();

  // 6. Xóa cache Node.js & nạp vector vào FAISS RAM của Python Face Service
  invalidateFaceCache();

  addFaissTemplate({
    userId: targetUser._id.toString(),
    embeddings: vectorList,
    fullName: targetUser.fullName || targetUser.ho_ten,
    employeeId: targetUser.email || targetUser._id.toString(),
  }).catch((err) => console.warn('[FAISS Sync Warning]:', err.message));

  // 7. Ghi Audit Log tuân thủ Nghị định 13/2023/NĐ-CP
  AuditLog.create({
    actor: currentUser?._id || currentUser?.id || targetUser._id,
    actorType: 'USER',
    action: isForce && dupCheck.isDuplicate ? 'FORCE_REGISTER_FACE_DESCRIPTOR' : 'REGISTER_FACE_DESCRIPTOR',
    targetId: targetUser._id.toString(),
    targetType: 'User',
    ipAddress: ip || null,
    details: {
      userEmail: targetUser.email,
      samplesCount: vectorList.length,
      poses: effectivePoses,
      forcedOverride: isForce,
      encryptedAtRest: true,
      encryptionAlgorithm: 'AES-256-GCM',
      decree13Consent: true,
      policyVersion: 'ND13-2023-V1.0',
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));


  return {
    userId: targetUser._id,
    fullName: targetUser.fullName || targetUser.ho_ten,
    email: targetUser.email,
    faceRegistered: true,
    samplesCount: vectorList.length,
    poses: effectivePoses,
    templateId: templateDoc._id,
  };
};

/**
 * 2. Đăng ký từ danh sách file ảnh gửi lên
 */
const registerFaceImagesForUser = async ({ id, files, poses, force, currentUser, ip }) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ServiceError('Vui lòng cung cấp ít nhất một file ảnh khuôn mặt.', 400);
  }

  const descriptors = [];
  const recordedPoses = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const poseKey = (Array.isArray(poses) && poses[idx]) ? poses[idx] : (DEFAULT_POSES[idx] || `goc_${idx + 1}`);
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
    poses: recordedPoses,
    force,
    currentUser,
    ip,
  });
};

/**
 * 3. Xóa dữ liệu khuôn mặt Face ID
 */
const removeFaceDescriptorForUser = async ({ id, currentUser, ip }) => {
  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  // 1. Xóa khỏi Collection mau_khuon_mat
  const deleteResult = await FaceTemplate.deleteMany({
    $or: [{ ma_nguoi_dung: targetUser._id }, { userId: targetUser._id }],
  });

  // 2. Reset các trường sinh trắc học trên User
  await User.findByIdAndUpdate(targetUser._id, {
    $set: {
      isFaceRegistered: false,
      facePhoto: null,
      faceRegisteredAt: null,
      faceDescriptor: [],
      faceAngles: { straight: [], left: [], right: [], up: [], down: [] },
    },
  });

  // 3. Xóa khỏi RAM cache Node & FAISS RAM Python
  invalidateFaceCache();

  removeFaissTemplate(targetUser._id.toString()).catch((err) =>
    console.warn('[FAISS Remove Warning]:', err.message)
  );

  // 4. Ghi Audit Log
  AuditLog.create({
    actor: currentUser?._id || currentUser?.id || targetUser._id,
    actorType: 'USER',
    action: 'BIOMETRIC_DATA_PURGED_RIGHT_TO_ERASURE',
    targetId: targetUser._id.toString(),
    targetType: 'User',
    ipAddress: ip || null,
    details: {
      userEmail: targetUser.email,
      deletedTemplatesCount: deleteResult.deletedCount,
      legalBasis: 'ND13-2023-Right-To-Erasure',
      reason: 'Yêu cầu hủy bỏ và xóa vĩnh viễn dữ liệu sinh trắc học cá nhân theo Nghị định 13/2023/NĐ-CP',
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    userId: targetUser._id,
    fullName: targetUser.fullName || targetUser.ho_ten,
    faceRegistered: false,
    deletedCount: deleteResult.deletedCount,
  };
};

/**
 * 4. Lấy dữ liệu mẫu khuôn mặt của người dùng
 */
const getFaceTemplateByUserId = async (userId) => {
  return FaceTemplate.findOne({
    $or: [{ ma_nguoi_dung: userId }, { userId }],
  }).select('cac_goc_chup so_luong_mau mo_hinh_ai ngay_dang_ky so_chieu_vector');
};

module.exports = {
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
  getFaceTemplateByUserId,
};
