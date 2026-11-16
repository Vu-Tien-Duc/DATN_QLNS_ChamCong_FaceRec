/**
 * Face Biometrics Controller (server/controllers/face.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - detectPose: Phát hiện tư thế đầu 3D (Euler Yaw, Pitch, Roll) realtime từ webcam.
 * - enrollMultiAngleFace: Đăng ký khuôn mặt 5 góc, chống trùng lặp, lưu Collection 2 mau_khuon_mat.
 * - getRegistrationStatus: Tra cứu trạng thái đăng ký Face ID của nhân sự.
 * - deleteFaceData: Xóa sạch dữ liệu sinh trắc học khỏi SQL Server và RAM FAISS.
 * - getFaceHealth: Kiểm tra trạng thái hoạt động của Python FastAPI Microservice.
 */
const fs = require('fs');
const {
  detectFacePose,
  enrollMultiAngle,
  callFaceService,
} = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const {
  registerFaceDescriptorForUser,
  removeFaceDescriptorForUser,
  findTargetUserForFace,
  getFaceTemplateByUserId,
  getFaceRegistrationStatusByUserId,
} = require('../services/khuonMat/mauKhuonMat.service');
const minioStorage = require('../config/minio');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');
const { getActiveRoles } = require('../middlewares/xacThuc.middleware');

/**
 * 1. Nhận diện tư thế đầu 3D realtime từ frame webcam
 * @route POST /api/face/detect-pose
 */
const detectPose = async (req, res) => {
  try {
    let imageBuffer = null;

    if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
    } else if (req.file && req.file.path) {
      imageBuffer = fs.readFileSync(req.file.path);
    }

    if (!imageBuffer) {
      return res.status(400).json({ face_detected: false, message: 'Không tìm thấy dữ liệu ảnh frame.' });
    }

    const result = await detectFacePose({
      imageBuffer,
      mimeType: req.file?.mimetype || 'image/jpeg',
      fileName: 'frame.jpg',
    });

    const isDetected = result?.status === 'face_detected';
    const detectedPoseEn = result?.detectedPose || result?.pose?.pose_en || (isDetected ? 'STRAIGHT' : 'NONE');
    const detectedPoseVi = result?.detectedPoseVi || result?.pose?.pose || 'chinh_dien';

    return res.json({
      face_detected: isDetected,
      faceCount: result?.faceCount ?? (isDetected ? 1 : 0),
      bbox: result?.box
        ? {
            x: result.box[0],
            y: result.box[1],
            width: Math.max(20, result.box[2] - result.box[0]),
            height: Math.max(20, result.box[3] - result.box[1]),
          }
        : null,
      pose: {
        pose: detectedPoseEn,
        pose_en: detectedPoseEn,
        pose_vi: detectedPoseVi,
        yaw_deg: result?.yaw ?? result?.pose?.yaw_deg ?? 0,
        pitch_deg: result?.pitch ?? result?.pose?.pitch_deg ?? 0,
        roll_deg: result?.roll ?? result?.pose?.roll_deg ?? 0,
      },
      landmarks: result?.landmarks || null,
      liveness: result?.liveness ?? null,
      quality: result?.quality ?? null,
    });
  } catch (err) {
    // Trả về offline an toàn để camera HUD client hiển thị thông báo mượt mà
    return res.json({
      face_detected: false,
      offline: true,
      error: err.message,
    });
  }
};

/**
 * 2. Đăng ký 5 góc khuôn mặt (Chính diện, Trái, Phải, Ngước, Cúi)
 * @route POST /api/face/enroll-multi-angle
 */
const enrollMultiAngleFace = async (req, res) => {
  try {
    // 0. Phân quyền: Quản trị viên (Admin / BGH) hoặc Cán bộ TCCB mới có quyền đăng ký khuôn mặt
    const userRoles = getActiveRoles(req.user);
    const canEnrollFace = userRoles.has('admin') || userRoles.has('bgh') || userRoles.has('tccb');
    if (!canEnrollFace) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ có Quản trị viên (Admin / BGH) hoặc Cán bộ TCCB mới có quyền đăng ký khuôn mặt cho cán bộ, giảng viên. Cá nhân chỉ có thể điểm danh, không thể tự đăng ký.',
        errorCode: 'FORBIDDEN_ADMIN_ONLY_FACE_ENROLL',
      });
    }

    const {
      ma_can_bo,
      nguoi_dung_id,
      ho_ten,
      ghi_de = false,
      dong_y_thu_thap,
    } = req.body || {};

    const resolvedEmployeeId = ma_can_bo || nguoi_dung_id;
    const resolvedFullName = ho_ten;

    if (!resolvedEmployeeId) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cán bộ (ma_can_bo).' });
    }

    // 1. Tìm User trong SQL Server
    const targetUser = await findTargetUserForFace(resolvedEmployeeId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân sự tương ứng.' });
    }

    // 1.1. Kiểm tra sự đồng thuận thu thập dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP
    const consentAgreed =
      dong_y_thu_thap === true ||
      dong_y_thu_thap === 'true';

    if (!consentAgreed) {
      return res.status(400).json({
        success: false,
        message:
          'Yêu cầu xác nhận đồng thuận: Bạn phải tích chọn đồng ý cho phép Nhà trường thu thập và mã hóa dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP trước khi đăng ký.',
        errorCode: 'BIOMETRIC_CONSENT_REQUIRED_ND13',
      });
    }

    // 2. Gọi Face AI Microservice (Python FastAPI) trích xuất 5 vector
    const targetUserId = String(targetUser.id);
    let aiResult = null;
    try {
      aiResult = await enrollMultiAngle({
        files: req.files,
        employeeId: targetUserId,
        fullName: resolvedFullName || targetUser.ho_ten,
      });

    } catch (aiErr) {
      console.warn('[Face Service] Không thể kết nối AI Microservice:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'Không thể kết nối đến máy chủ Face AI Microservice: ' + aiErr.message,
      });
    }

    // 3. Xử lý tập hợp các vector 5 góc trả về từ InsightFace
    const angles = aiResult?.angles ?? {};
    const angleMapping = [
      { key: 'straight', name: 'chinh_dien' },
      { key: 'left',     name: 'nghieng_trai' },
      { key: 'right',    name: 'nghieng_phai' },
      { key: 'up',       name: 'ngua_len' },
      { key: 'down',     name: 'cui_xuong' },
    ];

    const allVectors = [];
    const recordedPoses = [];

    for (const item of angleMapping) {
      const vec = angles[item.name]?.embedding || angles[item.key]?.embedding;
      if (Array.isArray(vec) && vec.length === 512) {
        allVectors.push(vec);
        recordedPoses.push(item.name);
      }
    }

    if (allVectors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không trích xuất được vector khuôn mặt hợp lệ từ các ảnh tải lên.',
      });
    }

    // 4. Chuẩn bị hàm lưu ảnh khuôn mặt đại diện (chính diện) lên MinIO Object Storage
    // Chỉ thực thi bên trong Service sau khi đã vượt qua kiểm tra chống trùng lặp sinh trắc học
    const existingTemplate = await getFaceTemplateByUserId(targetUserId).catch(() => null);
    let facePhotoUrl = existingTemplate?.anh_dai_dien || targetUser.anh_dai_dien || null;
    const uploadPrimaryPhotoAfterValidation = async () => {
      if (!req.files) return facePhotoUrl;
      const primaryFile = req.files['image_straight']?.[0] || req.files['straight']?.[0] || req.files['image']?.[0];
      if (!primaryFile || !primaryFile.buffer) return facePhotoUrl;

      // Dọn dẹp ảnh cũ của nhân sự trên MinIO/ổ cứng trước khi lưu ảnh mới
      await minioStorage.deleteUserFaceFiles(
        targetUserId,
        targetUser.ma_can_bo,
        facePhotoUrl
      ).catch(() => {});

      // Đặt tên file chuẩn Enterprise: face-<MãCánBộ>-<TênKhôngDấu>.jpg
      const staffCode = (targetUser.ma_can_bo || targetUserId).replace(/[^a-zA-Z0-9_-]/g, '_');
      let cleanName = (targetUser.ho_ten || 'can-bo')
        .replace(/\(.*?\)/g, '')
        .replace(/^(ThS|TS|PGS|GS|Ths|Ts)\.?\s+/i, '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!cleanName) cleanName = 'avatar';

      const fileName = `face-${staffCode}-${cleanName}.jpg`;
      await minioStorage.putObject(`faces/${fileName}`, primaryFile.buffer, 'image/jpeg', {
        userId: targetUserId,
        staffCode,
        fullName: targetUser.ho_ten,
        category: 'face-registration',
      });
      facePhotoUrl = `/api/tai-tep/tep/${fileName}`;
      return facePhotoUrl;
    };

    // 5. Đăng ký qua Service (Chống trùng lặp -> Lưu ảnh MinIO -> Lưu FaceTemplate mã hóa AES-256-GCM -> Sync FAISS & User)
    const result = await registerFaceDescriptorForUser({
      id: targetUserId,
      descriptors: allVectors,
      sampleAngles: recordedPoses,
      force: ghi_de === true || ghi_de === 'true',
      currentUser: req.user,
      ip: req.ip,
      facePhotoUrl,
      onValidated: uploadPrimaryPhotoAfterValidation,
    });

    return res.status(200).json({
      success: true,
      message: `Đăng ký thành công ${allVectors.length} góc khuôn mặt cho ${targetUser.ho_ten}!`,
      data: {
        nguoi_dung_id: targetUserId,
        ho_ten: targetUser.ho_ten,
        cac_goc_mau: recordedPoses,
        so_mau: allVectors.length,
        anh_khuon_mat: facePhotoUrl,
        mau_khuon_mat_id: result.templateId,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message, data: err.data || null });
    }
    return res.status(500).json({ success: false, message: 'Lỗi đăng ký khuôn mặt: ' + err.message });
  }
};

/**
 * 3. Kiểm tra trạng thái đăng ký Face ID
 * @route GET /api/khuon-mat/trang-thai-dang-ky hoặc GET /api/khuon-mat/trang-thai-dang-ky/:nguoiDungId
 */
const getRegistrationStatus = async (req, res) => {
  try {
    const targetId = req.params.nguoiDungId || req.user?.id || req.user?._id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Thiếu định danh người dùng.' });
    }

    const data = await getFaceRegistrationStatusByUserId(targetId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Xóa dữ liệu khuôn mặt Face ID
 * @route DELETE /api/khuon-mat/du-lieu/:nguoiDungId
 */
const deleteFaceData = async (req, res) => {
  try {
    const targetUserId = req.params.nguoiDungId || req.user?._id?.toString();
    const currentUserId = req.user?._id?.toString();
    const isSelf = Boolean(currentUserId && targetUserId && String(currentUserId) === String(targetUserId));
    const userRoles = getActiveRoles(req.user);
    const isAuthorizedManager =
      userRoles.has('admin') ||
      userRoles.has('bgh') ||
      userRoles.has('tccb') ||
      userRoles.has('truong_khoa') ||
      userRoles.has('pho_khoa');

    if (!isSelf && !isAuthorizedManager) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền yêu cầu xóa dữ liệu sinh trắc học của người khác.',
      });
    }

    const result = await removeFaceDescriptorForUser({
      id: targetUserId,
      currentUser: req.user,
      ip: req.ip,
    });
    return sendSuccess(
      res,
      'Đã xóa và hủy bỏ vĩnh viễn dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP thành công.',
      result
    );
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Kiểm tra tình trạng kết nối tới Face AI Microservice
 * @route GET /api/face/health
 */
const getFaceHealth = async (req, res) => {
  try {
    const result = await callFaceService({ path: '/health', method: 'GET', timeoutMs: 5000 });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Face AI service không khả dụng: ' + err.message,
    });
  }
};

/**
 * 6. Kiểm thử nhận diện khuôn mặt Realtime (AI 1:N FAISS, không tạo log chấm công, không kiểm tra geofence hay ca trực)
 * @route POST /api/face/test-recognition
 */
const testFaceRecognition = async (req, res) => {
  try {
    let imageBuffer = null;
    if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
    } else if (req.body?.image) {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) {
      return res.status(400).json({ success: false, matched: false, message: 'Vui lòng cung cấp hình ảnh khuôn mặt từ camera.' });
    }

    const { processFaceAttendance } = require('../services/chamCong');
    const result = await processFaceAttendance({
      imageBuffer,
      location: null,
      deviceId: 'TEST_RECOGNITION_TOOL',
      reqIp: req.ip || '127.0.0.1',
      verifyOnly: true,
      useQueue: false,
    });

    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      matched: false,
      message: err.message || 'Lỗi khi kiểm thử nhận diện khuôn mặt.',
    });
  }
};

module.exports = {
  detectPose,
  enrollMultiAngleFace,
  getRegistrationStatus,
  deleteFaceData,
  getFaceHealth,
  testFaceRecognition,
};

