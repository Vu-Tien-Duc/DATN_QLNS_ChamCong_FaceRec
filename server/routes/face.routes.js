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
} = require('../controllers/face.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

// Memory storage - không ghi ra đĩa, xử lý nhanh
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Các file ảnh 5 góc mà FaceRegistrationModal gửi lên
const angleFields = [
  { name: 'image_straight', maxCount: 1 },
  { name: 'image_left',     maxCount: 1 },
  { name: 'image_right',    maxCount: 1 },
  { name: 'image_up',       maxCount: 1 },
  { name: 'image_down',     maxCount: 1 },
  { name: 'image',          maxCount: 1 },
  { name: 'straight',       maxCount: 1 },
  { name: 'left',           maxCount: 1 },
  { name: 'right',          maxCount: 1 },
  { name: 'up',             maxCount: 1 },
  { name: 'down',           maxCount: 1 },
];

// Health check - không cần auth
router.get('/health', getFaceHealth);

// Detect pose (realtime camera loop - không cần auth vì là từ webcam client)
router.post('/detect-pose', upload.single('image'), detectPose);

// Kiểm thử nhận diện khuôn mặt Realtime (không tạo bản ghi chấm công, không geofence)
router.post('/test-recognition', upload.single('image'), testFaceRecognition);


// Đăng ký 5 góc khuôn mặt (Chỉ Quản trị viên Admin/BGH mới có quyền)
router.post(
  '/enroll-multi-angle',
  verifyToken,
  verifyRole(['admin', 'bgh', 'admin_it', 'it_admin']),
  upload.fields(angleFields),
  enrollMultiAngleFace
);

// Kiểm tra trạng thái đã đăng ký FaceID của bản thân
router.get('/registration-status', verifyToken, getRegistrationStatus);

// Kiểm tra trạng thái FaceID của nhân viên cụ thể (Admin / Trưởng khoa / hoặc chính bản thân nhân viên)
router.get(
  '/registration-status/:userId',
  verifyToken,
  (req, res, next) => {
    const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const targetUserId = req.params.userId;
    const userRole = (req.user?.role || req.user?.primaryRole || req.user?.vai_tro_chinh || '').toLowerCase();
    const canManage = ['admin', 'bgh', 'truong_khoa', 'truongkhoa', 'admin_it', 'it_admin', 'tccb'].includes(userRole);

    if (currentUserId === targetUserId || canManage) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem trạng thái Face ID của nhân sự khác.',
      errorCode: 'FORBIDDEN_FACE_STATUS_VIEW',
    });
  },
  getRegistrationStatus
);

// Middleware phân quyền xóa FaceID: Admin / BGH / TCCB / Trưởng khoa hoặc tự xóa theo NĐ 13/2023/NĐ-CP
const canDeleteFace = (req, res, next) => {
  const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
  const targetUserId = req.params.userId;
  const userRole = (req.user?.role || req.user?.primaryRole || req.user?.vai_tro_chinh || '').toLowerCase();
  const canManage = ['admin', 'bgh', 'truong_khoa', 'truongkhoa', 'admin_it', 'it_admin', 'tccb'].includes(userRole);

  if (currentUserId === targetUserId || canManage) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Bạn không có quyền yêu cầu xóa dữ liệu sinh trắc học của người khác.',
    errorCode: 'FORBIDDEN_FACE_DELETE',
  });
};

// Xóa dữ liệu khuôn mặt (Hỗ trợ Admin / BGH / TCCB / Trưởng khoa hoặc tự xóa theo Quyền được xóa dữ liệu - Nghị định 13/2023/NĐ-CP)
router.delete(
  '/faces/:userId',
  verifyToken,
  canDeleteFace,
  deleteFaceData
);
router.delete('/my-template', verifyToken, deleteFaceData);

// Alias: Cho phép route /face/:userId hoặc /face/users/:userId nếu client gọi
router.delete('/users/:userId', verifyToken, canDeleteFace, deleteFaceData);

const { faceRecognizeAttendance } = require('../controllers/attendance.controller');
const { faceCheckInRateLimit } = require('../middlewares/rateLimiter.middleware');

// Điểm danh Camera Realtime qua Face ID (Bảo vệ bằng rate limit)
router.post('/checkin', faceCheckInRateLimit, upload.single('image'), faceRecognizeAttendance);
router.post('/checkout', faceCheckInRateLimit, upload.single('image'), faceRecognizeAttendance);

module.exports = router;
