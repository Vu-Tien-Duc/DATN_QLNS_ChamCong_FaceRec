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

// Đăng ký 5 góc khuôn mặt (Admin hoặc self)
router.post(
  '/enroll-multi-angle',
  verifyToken,
  upload.fields(angleFields),
  enrollMultiAngleFace
);

// Kiểm tra trạng thái đã đăng ký FaceID của bản thân
router.get('/registration-status', verifyToken, getRegistrationStatus);

// Kiểm tra trạng thái FaceID của nhân viên cụ thể (Admin)
router.get('/registration-status/:userId', verifyToken, verifyRole(['admin', 'truongkhoa']), getRegistrationStatus);

// Xóa dữ liệu khuôn mặt (Hỗ trợ Admin, Trưởng khoa hoặc tự xóa theo Quyền được xóa dữ liệu - Nghị định 13/2023/NĐ-CP)
router.delete('/faces/:userId', verifyToken, deleteFaceData);
router.delete('/my-template', verifyToken, deleteFaceData);

const { faceRecognizeAttendance } = require('../controllers/attendance.controller');
const { faceCheckInRateLimit } = require('../middlewares/rateLimiter.middleware');

// Điểm danh Camera Realtime qua Face ID (Bảo vệ bằng rate limit)
router.post('/checkin', faceCheckInRateLimit, upload.single('image'), faceRecognizeAttendance);
router.post('/checkout', faceCheckInRateLimit, upload.single('image'), faceRecognizeAttendance);

module.exports = router;
