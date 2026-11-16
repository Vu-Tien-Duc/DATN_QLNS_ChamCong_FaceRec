/**
 * Face API Routes
 * Xử lý đăng ký khuôn mặt 5 góc, phát hiện tư thế đầu, và kiểm tra trạng thái FaceID.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  detectPose,
  enrollMultiAngleFace,
  getRegistrationStatus,
  deleteFaceData,
  getFaceHealth,
  testFaceRecognition,
} = require('../controllers/khuonMat.controller');
const { verifyToken, verifyRole, verifyTerminalKey, getActiveRoles } = require('../middlewares/xacThuc.middleware');
const { faceCheckInRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');
const { isUserInDeanScope } = require('../utils/phamViTruongKhoa');
const { UNIT_LEADER_ROLES } = require('../utils/vaiTro.utils');

// Memory storage - không ghi ra đĩa, xử lý nhanh
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Các file ảnh 5 góc mà FaceRegistrationModal gửi lên (Chuẩn hóa duy nhất 5 góc)
const angleFields = [
  { name: 'image_straight', maxCount: 1 },
  { name: 'image_left',     maxCount: 1 },
  { name: 'image_right',    maxCount: 1 },
  { name: 'image_up',       maxCount: 1 },
  { name: 'image_down',     maxCount: 1 },
];

// Kiểm tra tình trạng AI service
router.get('/suc-khoe', getFaceHealth);

// Phát hiện tư thế đầu 3D realtime
router.post('/phat-hien-tu-the', verifyTerminalKey, upload.single('image'), detectPose);

// Kiểm thử nhận diện khuôn mặt Realtime (không tạo bản ghi chấm công, không geofence)
router.post('/kiem-thu-nhan-dien', verifyToken, faceCheckInRateLimit, upload.single('image'), testFaceRecognition);


// Đăng ký 5 góc khuôn mặt (Quản trị viên Admin / BGH / Cán bộ TCCB)
router.post(
  '/dang-ky-da-goc',
  verifyToken,
  verifyRole(['admin', 'bgh', 'tccb']),
  upload.fields(angleFields),
  enrollMultiAngleFace
);

// Kiểm tra trạng thái đã đăng ký FaceID của bản thân
router.get('/trang-thai-dang-ky', verifyToken, getRegistrationStatus);

const canAccessTargetFace = async (req, res, next, forbiddenCode, forbiddenMessage) => {
  try {
    const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const targetUserId = req.params.nguoiDungId;
    if (currentUserId && targetUserId && currentUserId === targetUserId) {
      return next();
    }

    const roles = getActiveRoles(req.user);
    if (roles.has('admin') || roles.has('bgh') || roles.has('tccb')) {
      return next();
    }

    const hasUnitLeaderRole = UNIT_LEADER_ROLES.some((r) => roles.has(r));
    if (hasUnitLeaderRole) {
      const inScope = await isUserInDeanScope(req.user, targetUserId);
      if (inScope) return next();
    }

    return res.status(403).json({
      success: false,
      message: forbiddenMessage,
      errorCode: forbiddenCode,
    });
  } catch (err) {
    return next(err);
  }
};

// Kiểm tra trạng thái FaceID của nhân viên cụ thể (Admin / BGH / TCCB / Trưởng đơn vị cùng khoa hoặc chính bản thân)
router.get(
  '/trang-thai-dang-ky/:nguoiDungId',
  verifyToken,
  (req, res, next) =>
    canAccessTargetFace(
      req,
      res,
      next,
      'FORBIDDEN_FACE_STATUS_VIEW',
      'Bạn không có quyền xem trạng thái Face ID của nhân sự khác.'
    ),
  getRegistrationStatus
);

// Middleware phân quyền xóa FaceID: Admin / BGH / TCCB / Trưởng đơn vị cùng khoa hoặc tự xóa theo NĐ 13/2023/NĐ-CP
const canDeleteFace = (req, res, next) =>
  canAccessTargetFace(
    req,
    res,
    next,
    'FORBIDDEN_FACE_DELETE',
    'Bạn không có quyền yêu cầu xóa dữ liệu sinh trắc học của người khác.'
  );

// Xóa dữ liệu khuôn mặt (Hỗ trợ Admin / BGH / TCCB / Trưởng khoa hoặc tự xóa theo Nghị định 13/2023/NĐ-CP)
router.delete(
  '/du-lieu/:nguoiDungId',
  verifyToken,
  canDeleteFace,
  deleteFaceData
);
router.delete('/du-lieu-cua-toi', verifyToken, deleteFaceData);

const { faceRecognizeAttendance } = require('../controllers/chamCong.controller');

// Điểm danh Camera Realtime qua Face ID (Bảo vệ bằng rate limit + JWT hoặc Terminal Key)
router.post('/vao-ca', faceCheckInRateLimit, verifyTerminalKey, upload.single('image'), faceRecognizeAttendance);
router.post('/tan-ca', faceCheckInRateLimit, verifyTerminalKey, upload.single('image'), faceRecognizeAttendance);

module.exports = router;
