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
  faceCheckIn,
  faceCheckInBatch,
  detectPose,
  generateQRCode,
  scanQRCode,
  getCampusLocationConfig,
  updateCampusLocationConfig,
  getLivenessChallengeController,
  verifyLivenessChallengeController,
  getFaissStatsController,
  syncFaissIndexController,
  getQueueStats,
} = require('../controllers/chamCong.controller');
const { verifyToken, authorizeRoles, verifyTerminalKey, requirePermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { faceCheckInRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');
const { uploadFaceImage, uploadFaceImages } = require('../middlewares/taiAnhKhuonMat.middleware');

// Nhận nhiều ảnh khuôn mặt nếu client gửi multipart/form-data, ngược lại đi thẳng sang JSON
const optionalFaceBatchUpload = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadFaceImages(req, res, next);
  }
  return next();
};

// Luồng Kiosk / Máy chấm công (xác thực qua x-terminal-key hoặc Bearer JWT)
router.post('/khuon-mat', faceCheckInRateLimit, verifyTerminalKey, uploadFaceImage, faceCheckIn);
router.post('/khuon-mat-hang-loat', faceCheckInRateLimit, verifyTerminalKey, optionalFaceBatchUpload, faceCheckInBatch);
router.get('/thu-thach-mat-that', verifyTerminalKey, getLivenessChallengeController);
router.post('/xac-thuc-mat-that', faceCheckInRateLimit, verifyTerminalKey, uploadFaceImage, verifyLivenessChallengeController);
router.get('/chi-so-vector/thong-ke', verifyToken, authorizeRoles('admin', 'bgh'), getFaissStatsController);
router.post('/chi-so-vector/dong-bo', verifyToken, authorizeRoles('admin'), syncFaissIndexController);
router.get('/hang-doi/thong-ke', verifyToken, authorizeRoles('admin', 'bgh'), getQueueStats);
router.get('/qr/tao-ma', verifyTerminalKey, generateQRCode);
router.get('/cau-hinh-khuon-vien', verifyTerminalKey, getCampusLocationConfig);

// Luồng người dùng đã đăng nhập
router.use(verifyToken);
router.get('/:id/minh-chung', getAttendanceEvidence);
router.post('/cau-hinh-khuon-vien', requirePermission(PERMISSIONS.HE_THONG_CAU_HINH), authorizeRoles('admin'), updateCampusLocationConfig);
router.post('/qr/quet-ma', scanQRCode);
router.post('/vao-ca', checkIn);
router.post('/tan-ca', checkOut);
router.get('/lich-su-cua-toi', getMyAttendanceHistory);
router.get('/lich-su', getAttendanceHistory);
router.post('/quet-vang-mat', authorizeRoles('admin', 'bgh'), triggerDailyAbsentCheck);
router.get('/:id', getAttendanceById);
router.put('/:id/dieu-chinh', authorizeRoles('admin', 'bgh', 'truong_khoa'), updateAttendanceByAdmin);

module.exports = router;
