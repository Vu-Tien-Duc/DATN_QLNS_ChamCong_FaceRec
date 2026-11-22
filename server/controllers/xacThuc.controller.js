// Xác thực đăng nhập, xoay vòng Refresh Token, đăng xuất, đổi mật khẩu và khôi phục bằng OTP
const authService = require('../services/heThong/xacThuc.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

// POST /api/xac-thuc/dang-nhap - Đăng nhập hệ thống
const login = async (req, res) => {
  const result = await authService.login({
    email: req.body?.email,
    password: req.body?.mat_khau,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  });

  res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  return sendSuccess(res, 'Đăng nhập thành công.', {
    token: result.token,
    ma_lam_moi: result.refreshToken,
    nguoi_dung: result.user,
  });
};

// POST /api/xac-thuc/lam-moi-token - Cấp lại Access Token (Refresh Token Rotation)
const refreshToken = async (req, res) => {
  const result = await authService.refreshToken({
    refreshTokenString: req.cookies?.refreshToken || req.body?.ma_lam_moi,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  });

  res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  return sendSuccess(res, 'Làm mới phiên đăng nhập thành công.', {
    token: result.accessToken,
    ma_lam_moi: result.refreshToken,
  });
};

// POST /api/xac-thuc/dang-xuat - Thu hồi token và kết thúc phiên đăng nhập
const logout = async (req, res) => {
  let accessTokenString = req.token || null;
  if (!accessTokenString) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessTokenString = authHeader.slice(7).trim();
    }
  }

  await authService.logout({
    refreshTokenString: req.cookies?.refreshToken || req.body?.ma_lam_moi || null,
    accessTokenString,
    userId: req.user?.id || null,
  });

  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  return sendSuccess(res, 'Đăng xuất thành công.');
};

// GET /api/xac-thuc/ho-so - Lấy thông tin tài khoản hiện tại
const getMe = async (req, res) => {
  const user = await authService.getMe(req.user?.id);
  return sendSuccess(res, 'Lấy thông tin tài khoản thành công.', user);
};

// PUT /api/xac-thuc/doi-mat-khau - Đổi mật khẩu tài khoản
const changePassword = async (req, res) => {
  const result = await authService.changePassword({
    userId: req.user?.id,
    currentPassword: req.body?.mat_khau_hien_tai,
    newPassword: req.body?.mat_khau_moi,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  });

  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  return sendSuccess(res, result.message);
};

// PUT /api/xac-thuc/anh-dai-dien - Cập nhật ảnh đại diện cá nhân
const updateAvatar = async (req, res) => {
  let imageBuffer = null;
  let file = null;
  const avatarUrl = req.body?.anh_dai_dien !== undefined ? req.body.anh_dai_dien : undefined;

  if (req.file) {
    file = req.file;
    imageBuffer = req.file.buffer || null;
  } else if (Array.isArray(req.files) && req.files.length > 0) {
    file = req.files[0];
    imageBuffer = req.files[0].buffer || null;
  } else if (req.body?.anh_dai_dien_base64) {
    const rawBase64 = String(req.body.anh_dai_dien_base64);
    const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
    imageBuffer = Buffer.from(base64Data, 'base64');
  }

  const result = await authService.updateAvatar({
    userId: req.user?.id,
    avatarUrl,
    imageBuffer,
    file,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  });

  return sendSuccess(res, result.message, { anh_dai_dien: result.anh_dai_dien });
};

// POST /api/xac-thuc/quen-mat-khau - Gửi mã OTP đặt lại mật khẩu qua email
const forgotPassword = async (req, res) => {
  const result = await authService.forgotPassword({
    email: req.body?.email,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  });
  return sendSuccess(res, result.message);
};

// POST /api/xac-thuc/dat-lai-mat-khau - Xác nhận OTP và đặt mật khẩu mới
const resetPassword = async (req, res) => {
  const result = await authService.resetPassword({
    email: req.body?.email,
    otp: req.body?.ma_otp,
    newPassword: req.body?.mat_khau_moi,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  });

  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  return sendSuccess(res, result.message);
};

module.exports = {
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
};
