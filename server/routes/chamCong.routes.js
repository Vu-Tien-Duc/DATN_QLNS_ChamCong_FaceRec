// Định tuyến API điểm danh (Khuôn mặt, QR, GPS), vào/tan ca, lịch sử và điều chỉnh công (/api/cham-cong)
const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getMyAttendanceHistory,
  getAttendanceById,
  getAttendanceEvidence,
  updateAttendanceByAdmin,
  triggerDailyAbsentCheck,
  faceRecognizeAttendance,
  getDynamicQRCode,
  scanQRCode,
  getCampusConfigInfo,
  updateCampusLocationConfig,
  getLivenessChallengeController,
  verifyLivenessChallengeController,
  getRamIndexStats,
  syncFaissIndexController,
  getQueueStats,
  getKhoiHomNay,
} = require('../controllers/chamCong.controller');
const {
  verifyToken,
  authorizeRoles,
  verifyTerminalKey,
  requirePermission,
  requireAnyPermission,
} = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { faceCheckInRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');
const { uploadFaceImage } = require('../middlewares/taiAnhKhuonMat.middleware');

// Nhận diện khuôn mặt chấm công: bắt buộc đăng nhập, khuôn mặt phải khớp chính chủ tài khoản
router.post('/khuon-mat', faceCheckInRateLimit, verifyToken, requirePermission(PERMISSIONS.CONG_QUET_MAT), uploadFaceImage, faceRecognizeAttendance);
router.get('/thu-thach-mat-that', verifyToken, getLivenessChallengeController);
router.post('/xac-thuc-mat-that', faceCheckInRateLimit, verifyToken, uploadFaceImage, verifyLivenessChallengeController);
router.get('/chi-so-vector/thong-ke', verifyToken, authorizeRoles('admin', 'bgh'), getRamIndexStats);
router.post('/chi-so-vector/dong-bo', verifyToken, authorizeRoles('admin'), syncFaissIndexController);
router.get('/hang-doi/thong-ke', verifyToken, authorizeRoles('admin', 'bgh'), getQueueStats);
router.get('/qr/tao-ma', verifyTerminalKey, getDynamicQRCode);
router.get('/cau-hinh-khuon-vien', verifyTerminalKey, getCampusConfigInfo);

// Luồng người dùng đã đăng nhập
router.use(verifyToken);
router.get('/:id/minh-chung', requireAnyPermission(PERMISSIONS.CONG_XEM_BAN_THAN, PERMISSIONS.CONG_XEM_DON_VI, PERMISSIONS.CONG_XEM_TOAN_TRUONG), getAttendanceEvidence);
router.post('/cau-hinh-khuon-vien', requirePermission(PERMISSIONS.HE_THONG_CAU_HINH), authorizeRoles('admin'), updateCampusLocationConfig);
router.post('/qr/quet-ma', requirePermission(PERMISSIONS.CONG_QUET_MAT), scanQRCode);
router.post('/vao-ca', requireAnyPermission(PERMISSIONS.CONG_QUET_MAT, PERMISSIONS.CONG_CHOT_CONG, PERMISSIONS.CONG_XEM_TOAN_TRUONG), checkIn);
router.post('/tan-ca', requireAnyPermission(PERMISSIONS.CONG_QUET_MAT, PERMISSIONS.CONG_CHOT_CONG, PERMISSIONS.CONG_XEM_TOAN_TRUONG), checkOut);
router.get('/lich-su-cua-toi', requirePermission(PERMISSIONS.CONG_XEM_BAN_THAN), getMyAttendanceHistory);
router.get('/lich-su', requireAnyPermission(PERMISSIONS.CONG_XEM_BAN_THAN, PERMISSIONS.CONG_XEM_DON_VI, PERMISSIONS.CONG_XEM_TOAN_TRUONG), getAttendanceHistory);
router.get('/khoi-hom-nay', requireAnyPermission(PERMISSIONS.CONG_QUET_MAT, PERMISSIONS.CONG_XEM_BAN_THAN), getKhoiHomNay);
router.post('/quet-vang-mat', authorizeRoles('admin', 'bgh'), triggerDailyAbsentCheck);
router.get('/:id', requireAnyPermission(PERMISSIONS.CONG_XEM_BAN_THAN, PERMISSIONS.CONG_XEM_DON_VI, PERMISSIONS.CONG_XEM_TOAN_TRUONG), getAttendanceById);
router.put('/:id/dieu-chinh', requireAnyPermission(PERMISSIONS.CONG_XEM_DON_VI, PERMISSIONS.CONG_XEM_TOAN_TRUONG), authorizeRoles('admin', 'bgh', 'truong_khoa'), updateAttendanceByAdmin);

module.exports = router;
