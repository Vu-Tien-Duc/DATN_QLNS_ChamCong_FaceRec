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
} = require('../controllers/xacThuc.controller');
const { verifyToken } = require('../middlewares/xacThuc.middleware');
const { upload } = require('../middlewares/taiTep.middleware');
const { loginLimiter, passwordResetLimiter } = require('../middlewares/gioiHanTruyCap.middleware');

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
router.post('/dang-nhap', loginLimiter, login);

// 2. Quản lý phiên & Token Rotation
router.post('/lam-moi-token', refreshToken);
router.post('/dang-xuat', logout);

// 3. Thông tin cá nhân & Đổi mật khẩu
router.get('/ho-so', verifyToken, getMe);
router.put('/doi-mat-khau', verifyToken, passwordResetLimiter, changePassword);

// 4. Cập nhật ảnh đại diện
router.put('/anh-dai-dien', verifyToken, handleAvatarUpload, updateAvatar);

// 5. Quên mật khẩu & Đặt lại mật khẩu bằng mã OTP (Public, có Rate Limiting)
router.post('/quen-mat-khau', passwordResetLimiter, forgotPassword);
router.post('/dat-lai-mat-khau', passwordResetLimiter, resetPassword);

module.exports = router;
