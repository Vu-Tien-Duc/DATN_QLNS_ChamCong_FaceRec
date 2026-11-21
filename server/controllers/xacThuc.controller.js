// Xác thực đăng nhập, xoay vòng Refresh Token, đăng xuất, đổi mật khẩu và khôi phục bằng OTP
const authService = require('../services/heThong/xacThuc.service');
const { ServiceError } = authService;
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

// POST /api/xac-thuc/dang-nhap - Đăng nhập hệ thống
const login = async (req, res, next) => {
  try {
    const email = req.body?.email;
    const password = req.body?.mat_khau;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.login({ email, password, ipAddress, userAgent });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, 'Đăng nhập thành công.', {
      token: result.token,
      ma_lam_moi: result.refreshToken,
      nguoi_dung: result.user,
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/lam-moi-token - Cấp lại Access Token (Refresh Token Rotation)
const refreshToken = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody = req.body?.ma_lam_moi;
    const tokenToRefresh = tokenFromCookie || tokenFromBody;

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.refreshToken({
      refreshTokenString: tokenToRefresh,
      ipAddress,
      userAgent,
    });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, 'Làm mới phiên đăng nhập thành công.', {
      token: result.accessToken,
      ma_lam_moi: result.refreshToken,
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/dang-xuat - Thu hồi token và kết thúc phiên đăng nhập
const logout = async (req, res, next) => {
  try {
    const refreshTokenString = req.cookies?.refreshToken || req.body?.ma_lam_moi || null;

    let accessTokenString = req.token || null;
    if (!accessTokenString) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessTokenString = authHeader.slice(7).trim();
      }
    }

    const userId = req.user?.id || null;

    await authService.logout({
      refreshTokenString,
      accessTokenString,
      userId,
    });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return sendSuccess(res, 'Đăng xuất thành công.');
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/xac-thuc/ho-so - Lấy thông tin tài khoản hiện tại
const getMe = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const user = await authService.getMe(userId);
    return sendSuccess(res, 'Lấy thông tin tài khoản thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/xac-thuc/doi-mat-khau - Đổi mật khẩu tài khoản
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const currentPassword = req.body?.mat_khau_hien_tai;
    const newPassword = req.body?.mat_khau_moi;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.changePassword({
      userId,
      currentPassword,
      newPassword,
      ipAddress,
    });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/xac-thuc/anh-dai-dien - Cập nhật ảnh đại diện cá nhân
const updateAvatar = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

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
      userId,
      avatarUrl,
      imageBuffer,
      file,
      ipAddress,
    });

    return sendSuccess(res, result.message, { anh_dai_dien: result.anh_dai_dien });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/quen-mat-khau - Gửi mã OTP đặt lại mật khẩu qua email
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.forgotPassword({ email, ipAddress });

    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/dat-lai-mat-khau - Xác nhận OTP và đặt mật khẩu mới
const resetPassword = async (req, res, next) => {
  try {
    const email = req.body?.email;
    const otp = req.body?.ma_otp;
    const newPassword = req.body?.mat_khau_moi;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.resetPassword({
      email,
      otp,
      newPassword,
      ipAddress,
    });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
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
