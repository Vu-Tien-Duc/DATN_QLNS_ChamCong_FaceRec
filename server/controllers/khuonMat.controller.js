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
  getFaceRegistrationStatusByUserId,
} = require('../services/khuonMat/mauKhuonMat.service');
const { detectImageSignature } = require('../middlewares/taiAnhKhuonMat.middleware');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');
const { hasAnyActiveRole } = require('../utils/vaiTro.utils');
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

// POST /api/khuon-mat/dang-ky-da-goc - Đăng ký khuôn mặt 5 góc (thẳng, trái, phải, ngửa, cúi)
const enrollMultiAngleFace = async (req, res) => {
  try {
    const canEnrollFace = hasAnyActiveRole(req.user, ['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]);
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

    // Kiểm tra chữ ký nhị phân (magic bytes) của mọi tệp ảnh tải lên trước khi chuyển qua Face AI
    const uploadedFields = Object.values(req.files || {}).flat().filter(Boolean);
    for (const file of uploadedFields) {
      if (!file.buffer || !detectImageSignature(file.buffer)) {
        return res.status(400).json({
          success: false,
          message: 'Tệp ảnh khuôn mặt không đúng định dạng JPEG, PNG hoặc WebP hợp lệ.',
          errorCode: 'INVALID_IMAGE_SIGNATURE',
        });
      }
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
      console.warn('[Face Service] Lỗi gọi AI Microservice:', aiErr.message);
      if (aiErr.statusCode >= 400 && aiErr.statusCode < 500) {
        return res.status(aiErr.statusCode).json({
          success: false,
          message: aiErr.message || 'Ảnh khuôn mặt chưa đạt chuẩn đăng ký.',
          errorCode: aiErr.errorCode || 'FACE_AI_VALIDATION_FAILED',
        });
      }
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ Face AI Microservice tạm thời không khả dụng. Vui lòng thử lại sau.',
        errorCode: aiErr.errorCode || 'FACE_SERVICE_UNAVAILABLE',
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
        errorCode: 'FACE_EMBEDDING_EXTRACTION_FAILED',
      });
    }

    const primaryFile = req.files?.['image_straight']?.[0] || req.files?.['straight']?.[0] || req.files?.['image']?.[0] || null;

    const result = await registerFaceDescriptorForUser({
      id: targetUserId,
      descriptors: allVectors,
      sampleAngles: recordedPoses,
      force: ghi_de === true || ghi_de === 'true',
      currentUser: req.user,
      ip: req.ip,
      primaryPhotoFile: primaryFile,
    });

    return res.status(200).json({
      success: true,
      message: `Đăng ký thành công ${allVectors.length} góc khuôn mặt cho ${targetUser.ho_ten}!`,
      data: {
        nguoi_dung_id: targetUserId,
        ho_ten: targetUser.ho_ten,
        cac_goc_chup: result.cac_goc_chup,
        so_luong_mau: result.so_luong_mau,
        anh_khuon_mat: result.anh_khuon_mat || null,
        mau_khuon_mat_id: result.mau_khuon_mat_id,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errorCode: err.errorCode || null,
        data: err.data || null,
      });
    }
    console.error('[EnrollMultiAngleFace Error]:', err);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống khi đăng ký khuôn mặt.' });
  }
};

// GET /api/khuon-mat/trang-thai-dang-ky(/:nguoiDungId) - Kiểm tra trạng thái đăng ký Face ID
const getRegistrationStatus = async (req, res) => {
  try {
    const targetId = req.params.nguoiDungId || req.user?.id;

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
      return sendError(res, err.message, err.data || null, err.statusCode, err.errorCode || null);
    }
    console.error('[DeleteFaceData Error]:', err);
    return sendError(res, 'Đã xảy ra lỗi hệ thống khi xóa dữ liệu khuôn mặt.', null, 500, 'FACE_DELETE_INTERNAL_ERROR');
  }
};

// GET /api/khuon-mat/suc-khoe - Kiểm tra kết nối tới Python Face Service
const getFaceHealth = async (req, res) => {
  try {
    const result = await callFaceService({ path: '/health', method: 'GET', timeoutMs: 5000 });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.warn('[FaceHealth Warning]:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Face AI service tạm thời không khả dụng.',
      errorCode: err.errorCode || 'FACE_SERVICE_UNAVAILABLE',
    });
  }
};

// POST /api/khuon-mat/kiem-thu-nhan-dien - Thử nghiệm nhận diện AI 1:N (không tạo log chấm công)
const testFaceRecognition = async (req, res) => {
  try {
    let imageBuffer = null;
    if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
    } else if (req.body?.image && typeof req.body.image === 'string') {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      if (base64Data.length > 21 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          khop_khuon_mat: false,
          message: 'Ảnh kiểm thử vượt quá dung lượng cho phép (tối đa 15MB).',
          errorCode: 'FACE_IMAGE_TOO_LARGE',
        });
      }
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        khop_khuon_mat: false,
        message: 'Vui lòng cung cấp hình ảnh khuôn mặt từ camera.',
      });
    }

    if (imageBuffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        khop_khuon_mat: false,
        message: 'Ảnh kiểm thử vượt quá dung lượng cho phép (tối đa 15MB).',
        errorCode: 'FACE_IMAGE_TOO_LARGE',
      });
    }

    if (!detectImageSignature(imageBuffer)) {
      return res.status(400).json({
        success: false,
        khop_khuon_mat: false,
        message: 'Tệp ảnh kiểm thử không đúng định dạng JPEG, PNG hoặc WebP hợp lệ.',
        errorCode: 'INVALID_IMAGE_SIGNATURE',
      });
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

    if (!result.khop_khuon_mat) {
      return res.json({
        success: false,
        khop_khuon_mat: false,
        message: result.message || 'Không tìm thấy khuôn mặt trùng khớp trong hệ thống.',
        errorCode: result.errorCode || 'FACE_NOT_MATCHED',
        do_tuong_dong: result.similarity ?? null,
        do_tin_cay: result.similarity ?? null,
      });
    }

    const matchedUser = result.user || {};
    const score = result.diem_tin_cay ?? result.similarity ?? null;

    return res.json({
      success: true,
      khop_khuon_mat: true,
      nguoi_dung_id: result.nguoi_dung_id || matchedUser.id,
      nguoi_dung: {
        id: matchedUser.id || result.nguoi_dung_id,
        ho_ten: matchedUser.ho_ten,
        email: matchedUser.email,
        vai_tro_chinh: matchedUser.vai_tro_chinh,
        anh_dai_dien: matchedUser.anh_dai_dien || null,
        ma_can_bo: matchedUser.ma_can_bo || '',
        ten_phong_ban: matchedUser.don_vi_chinh?.ten_phong_ban || null,
      },
      do_tuong_dong: score,
      do_tin_cay: score,
      diem_nguoi_that: result.diem_nguoi_that ?? null,
      message: result.message,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        khop_khuon_mat: false,
        message: err.message,
        errorCode: err.errorCode || null,
      });
    }
    console.error('[TestFaceRecognition Error]:', err);
    return res.status(500).json({
      success: false,
      khop_khuon_mat: false,
      message: 'Đã xảy ra lỗi khi kiểm thử nhận diện khuôn mặt.',
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

