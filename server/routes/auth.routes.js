const express = require('express');
const router = express.Router();
const {
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');
const { loginLimiter, passwordResetLimiter } = require('../middlewares/rateLimiter.middleware');

// Middleware hỗ trợ upload ảnh (nếu client gửi multipart/form-data) hoặc bỏ qua nếu là JSON
const handleAvatarUpload = (req, res, next) => {
  upload.any()(req, res, function (err) {
    if (err) {
      return next(err);
    }
    next();
  });
};

// 1. Xác thực & Đăng nhập (Áp dụng Rate Limiting tối đa 5 lần / 15 phút)
router.post('/login', loginLimiter, login);

// 2. Quản lý phiên & Token Rotation
router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken); // Alias chuẩn frontend
router.post('/logout', logout);

// 3. Thông tin cá nhân & Đổi mật khẩu (Hỗ trợ cả PUT & POST, có passwordResetLimiter)
router.get('/me', verifyToken, getMe);
router.put('/change-password', verifyToken, passwordResetLimiter, changePassword);
router.post('/change-password', verifyToken, passwordResetLimiter, changePassword);

// 4. Cập nhật ảnh đại diện (Hỗ trợ cả PUT & POST, multipart & JSON)
router.put('/avatar', verifyToken, handleAvatarUpload, updateAvatar);
router.post('/avatar', verifyToken, handleAvatarUpload, updateAvatar);

// 5. Quên mật khẩu & Đặt lại mật khẩu bằng mã OTP (Public, có Rate Limiting)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

module.exports = router;
