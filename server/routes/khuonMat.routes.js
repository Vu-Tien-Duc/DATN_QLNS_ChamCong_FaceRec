// Định tuyến API sinh trắc học khuôn mặt: phát hiện tư thế 3D, đăng ký 5 góc, kiểm tra trạng thái & xóa (/api/khuon-mat)
const express = require('express');
const path = require('path');
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
const { verifyToken, verifyRole, getActiveRoles } = require('../middlewares/xacThuc.middleware');
const { facePoseRateLimit, faceCheckInRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');
const { isUserInDeanScope } = require('../utils/phamViTruongKhoa');
const { UNIT_LEADER_ROLES } = require('../utils/vaiTro.utils');

const ALLOWED_FACE_IMAGE_EXT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

// Memory storage - không ghi ra đĩa, chỉ cho phép ảnh JPEG/PNG/WebP
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, callback) => {
    const allowedExts = ALLOWED_FACE_IMAGE_EXT[file.mimetype];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExts || !allowedExts.includes(ext)) {
      const error = new Error('Chỉ chấp nhận tệp ảnh JPEG, PNG hoặc WebP.');
      error.statusCode = 400;
      error.errorCode = 'UNSUPPORTED_FACE_IMAGE_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
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
router.post('/phat-hien-tu-the', facePoseRateLimit, verifyToken, upload.single('image'), detectPose);

// Kiểm thử nhận diện khuôn mặt Realtime (chỉ Admin / BGH / TCCB)
router.post('/kiem-thu-nhan-dien', verifyToken, verifyRole(['admin', 'bgh', 'tccb']), faceCheckInRateLimit, upload.single('image'), testFaceRecognition);


// Đăng ký 5 góc khuôn mặt (Admin / BGH / TCCB hoặc trưởng/phó đơn vị trong phạm vi quản lý, không tự đăng ký)
router.post(
  '/dang-ky-da-goc',
  verifyToken,
  verifyRole(['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]),
  upload.fields(angleFields),
  enrollMultiAngleFace
);

// Kiểm tra trạng thái đã đăng ký FaceID của bản thân
router.get('/trang-thai-dang-ky', verifyToken, getRegistrationStatus);

// Kiểm tra quyền truy cập dữ liệu khuôn mặt của chính chủ hoặc quản trị nhân sự
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

// Xóa dữ liệu khuôn mặt: chỉ cấp trên trong phạm vi quản lý được thực hiện, không ai được tự xóa (kiểm tra trong service)
router.delete(
  '/du-lieu/:nguoiDungId',
  verifyToken,
  deleteFaceData
);

module.exports = router;
