/**
 * Face Biometrics Controller (server/controllers/face.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - detectPose: Phát hiện tư thế đầu 3D (Euler Yaw, Pitch, Roll) realtime từ webcam.
 * - enrollMultiAngleFace: Đăng ký khuôn mặt 5 góc, chống trùng lặp, lưu Collection 2 mau_khuon_mat.
 * - getRegistrationStatus: Tra cứu trạng thái đăng ký Face ID của nhân sự.
 * - deleteFaceData: Xóa sạch dữ liệu sinh trắc học khỏi MongoDB và RAM FAISS.
 * - getFaceHealth: Kiểm tra trạng thái hoạt động của Python FastAPI Microservice.
 */
const User = require('../models/user.model');
const FaceTemplate = require('../models/faceTemplate.model');
const {
  detectFacePose,
  enrollMultiAngle,
  callFaceService,
} = require('../services/faceServiceClient');
const {
  registerFaceDescriptorForUser,
  removeFaceDescriptorForUser,
} = require('../services/faceTemplate.service');
const minioStorage = require('../config/minio');
const { sendSuccess, sendError } = require('../utils/responseHandler');

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
        pose: result?.detectedPose ?? (isDetected ? 'STRAIGHT' : 'NONE'),
        yaw_deg: result?.yaw ?? 0,
        pitch_deg: result?.pitch ?? 0,
        roll_deg: result?.roll ?? 0,
      },
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
    const employeeId = req.body.employee_id || req.body.userId || req.user?._id?.toString();
    const fullName = req.body.full_name || req.body.fullName;
    const force = req.body.force === true || req.body.force === 'true';

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên (employee_id).' });
    }

    // 1. Tìm User trong MongoDB
    let targetUser = null;
    if (/^[0-9a-fA-F]{24}$/.test(employeeId)) {
      targetUser = await User.findById(employeeId);
    }
    if (!targetUser) {
      targetUser = await User.findOne({
        $or: [{ email: employeeId }, { staffCode: employeeId }],
      });
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân sự tương ứng.' });
    }

    // 1.1. Kiểm tra sự đồng thuận thu thập dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP
    const consentAgreed =
      req.body.consentAgreed === true ||
      req.body.consentAgreed === 'true';

    if (!consentAgreed) {
      return res.status(400).json({
        success: false,
        message:
          'Yêu cầu xác nhận đồng thuận: Bạn phải tích chọn đồng ý cho phép Nhà trường thu thập và mã hóa dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP trước khi đăng ký.',
        errorCode: 'BIOMETRIC_CONSENT_REQUIRED_ND13',
      });
    }

    // 2. Gọi Face AI Microservice (Python FastAPI) trích xuất 5 vector
    let aiResult = null;
    try {
      aiResult = await enrollMultiAngle({
        files: req.files,
        employeeId: targetUser._id.toString(),
        fullName: fullName || targetUser.fullName,
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

    // 4. Lưu ảnh khuôn mặt đại diện (chính diện) lên MinIO Object Storage
    let facePhotoUrl = targetUser.facePhoto;
    if (req.files) {
      const primaryFile = req.files['image_straight']?.[0] || req.files['straight']?.[0] || req.files['image']?.[0];
      if (primaryFile && primaryFile.buffer) {
        const fileName = `face-${targetUser._id}-${Date.now()}.jpg`;
        await minioStorage.putObject(`faces/${fileName}`, primaryFile.buffer, 'image/jpeg', {
          userId: targetUser._id.toString(),
          category: 'face-registration',
        });
        facePhotoUrl = `/uploads/faces/${fileName}`;
      }
    }

    // 5. Đăng ký qua Service (Chống trùng lặp, lưu FaceTemplate, đồng bộ RAM FAISS)
    const result = await registerFaceDescriptorForUser({
      id: targetUser._id,
      descriptors: allVectors,
      poses: recordedPoses,
      force,
      currentUser: req.user,
      ip: req.ip,
    });

    if (facePhotoUrl && facePhotoUrl !== targetUser.facePhoto) {
      await User.findByIdAndUpdate(targetUser._id, { $set: { facePhoto: facePhotoUrl } });
    }

    return res.status(200).json({
      success: true,
      message: `Đăng ký thành công ${allVectors.length} góc khuôn mặt cho ${targetUser.fullName}!`,
      data: {
        userId: targetUser._id,
        fullName: targetUser.fullName,
        anglesRegistered: recordedPoses,
        sampleCount: allVectors.length,
        facePhoto: facePhotoUrl,
        templateId: result.templateId,
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
 * @route GET /api/face/registration-status hoặc GET /api/face/registration-status/:userId
 */
const getRegistrationStatus = async (req, res) => {
  try {
    const targetId = req.params.userId || req.user?._id || req.user?.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Thiếu định danh người dùng.' });
    }

    const user = await User.findById(targetId).select(
      'fullName email isFaceRegistered faceRegisteredAt facePhoto'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const template = await FaceTemplate.findOne({ userId: user._id }).select('poses samplesCount embeddingModel registeredAt');

    const isRegistered =
      Boolean(template) ||
      user.isFaceRegistered === true ||
      Boolean(user.facePhoto);

    return res.json({
      success: true,
      data: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        isRegistered,
        isFaceRegistered: isRegistered,
        faceRegisteredAt: template?.registeredAt || user.faceRegisteredAt,
        facePhoto: user.facePhoto,
        sampleCount: template?.samplesCount || 0,
        sampleAngles: template?.poses || [],
        aiModel: template?.embeddingModel || 'buffalo_s',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Xóa dữ liệu khuôn mặt Face ID
 * @route DELETE /api/face/faces/:userId
 */
const deleteFaceData = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user?._id?.toString() || req.user?.id?.toString();
    const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const userRole = (req.user?.role || '').toLowerCase();
    const isSelf = currentUserId && targetUserId && currentUserId === targetUserId;
    const isAuthorizedManager = ['admin', 'truongkhoa'].includes(userRole);

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

module.exports = {
  detectPose,
  enrollMultiAngleFace,
  getRegistrationStatus,
  deleteFaceData,
  getFaceHealth,
};
