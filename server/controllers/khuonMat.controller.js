// Điều phối nhận diện tư thế 3D, đăng ký 5 góc và đồng bộ dữ liệu khuôn mặt (SQL Server + FAISS)
const fs = require('fs');
const {
  detectFacePose,
  enrollMultiAngle,
  callFaceService,
} = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const {
  assertCanManageFace,
  registerFaceDescriptorForUser,
  removeFaceDescriptorForUser,
  findTargetUserForFace,
  getFaceTemplateByUserId,
  getFaceRegistrationStatusByUserId,
} = require('../services/khuonMat/mauKhuonMat.service');
const minioStorage = require('../config/minio');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');
const { getActiveRoles } = require('../middlewares/xacThuc.middleware');
const { UNIT_LEADER_ROLES } = require('../utils/vaiTro.utils');

// POST /api/khuon-mat/phat-hien-tu-the - Nhận diện tư thế đầu 3D từ frame webcam
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

// POST /api/khuon-mat/dang-ky-da-goc - Đăng ký khuôn mặt 5 góc (thẳng, trái, phải, ngước, cúi)
const enrollMultiAngleFace = async (req, res) => {
  try {
    const userRoles = getActiveRoles(req.user);
    const canEnrollFace =
      userRoles.has('admin') ||
      userRoles.has('bgh') ||
      userRoles.has('tccb') ||
      UNIT_LEADER_ROLES.some((role) => userRoles.has(role));
    if (!canEnrollFace) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ cấp trên (Quản trị viên, BGH, TCCB hoặc trưởng/phó đơn vị) mới có quyền đăng ký khuôn mặt cho nhân sự cấp dưới. Cá nhân chỉ có thể điểm danh, không thể tự đăng ký.',
        errorCode: 'FORBIDDEN_FACE_ENROLL',
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

    const targetUser = await findTargetUserForFace(resolvedEmployeeId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân sự tương ứng.' });
    }

    // Kiểm tra quyền và phạm vi quản lý trước khi gọi AI hoặc lưu bất kỳ dữ liệu nào
    await assertCanManageFace(req.user, targetUser, 'đăng ký');
    // Bắt buộc người dùng xác nhận đồng thuận thu thập sinh trắc học theo NĐ 13/2023/NĐ-CP
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

    // Callback lưu ảnh chính diện sau khi đã qua kiểm tra chống trùng khuôn mặt
    const existingTemplate = await getFaceTemplateByUserId(targetUserId).catch(() => null);
    let facePhotoUrl = existingTemplate?.anh_dai_dien || targetUser.anh_dai_dien || null;
    const uploadPrimaryPhotoAfterValidation = async () => {
      if (!req.files) return facePhotoUrl;
      const primaryFile = req.files['image_straight']?.[0] || req.files['straight']?.[0] || req.files['image']?.[0];
      if (!primaryFile || !primaryFile.buffer) return facePhotoUrl;

      await minioStorage.deleteUserFaceFiles(
        targetUserId,
        targetUser.ma_can_bo,
        facePhotoUrl
      ).catch(() => {});

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

// GET /api/khuon-mat/trang-thai-dang-ky(/:nguoiDungId) - Kiểm tra trạng thái đăng ký Face ID
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

// DELETE /api/khuon-mat/du-lieu/:nguoiDungId - Xóa dữ liệu khuôn mặt Face ID (chỉ cấp trên trong phạm vi quản lý, không tự xóa)
const deleteFaceData = async (req, res) => {
  try {
    const targetUserId = req.params.nguoiDungId;
    if (!targetUserId) {
      return sendError(res, 'Thiếu định danh người dùng cần xóa dữ liệu khuôn mặt.', null, 400);
    }

    // Quyền (cấp trên, phạm vi quản lý, không tự xóa) được kiểm tra trong removeFaceDescriptorForUser
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

// GET /api/khuon-mat/suc-khoe - Kiểm tra kết nối tới Python Face Service
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

// POST /api/khuon-mat/kiem-thu-nhan-dien - Thử nghiệm nhận diện AI 1:N (không tạo log chấm công)
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

