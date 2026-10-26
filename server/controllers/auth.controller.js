/**
 * Authentication Controller (server/controllers/auth.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Đăng nhập tài khoản (login).
 * - Làm mới Token với Grace Period 15s và chống Replay Attack (refreshToken).
 * - Đăng xuất và thu hồi phiên (logout).
 * - Lấy thông tin cá nhân (getMe).
 * - Đổi mật khẩu tài khoản (changePassword).
 * - Cập nhật ảnh đại diện (updateAvatar).
 * - CẮT BỎ HOÀN TOÀN các luồng rác cũ (OTP, tự đăng ký tài khoản tự do).
 */
const authService = require('../services/auth.service');
const { ServiceError } = authService;
const { sendSuccess, sendError } = require('../utils/responseHandler');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  next(error);
};

/**
 * 1. Đăng nhập hệ thống
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.login({ email, password, ipAddress, userAgent });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, 'Đăng nhập thành công.', {
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Làm mới Token (Refresh Token Rotation + Grace Period 15s)
 * @route POST /api/auth/refresh hoặc /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody = req.body?.refreshToken;
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
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Đăng xuất hệ thống
 * @route POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const refreshTokenString = req.cookies?.refreshToken || req.body?.refreshToken || null;

    let accessTokenString = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessTokenString = authHeader.split(' ')[1];
    }

    const userId = req.user?._id || req.user?.id || null;

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

/**
 * 4. Lấy thông tin tài khoản hiện tại
 * @route GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await authService.getMe(userId);
    return sendSuccess(res, 'Lấy thông tin tài khoản thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Đổi mật khẩu
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { oldPassword, currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.changePassword({
      userId,
      currentPassword: currentPassword || oldPassword,
      newPassword,
      ipAddress,
    });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Cập nhật ảnh đại diện
 * @route PUT hoặc POST /api/auth/avatar
 */
const updateAvatar = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    let imageBuffer = null;
    let file = null;
    let avatarUrl = req.body?.avatar || null;

    if (req.file) {
      file = req.file;
      imageBuffer = req.file.buffer || null;
    } else if (Array.isArray(req.files) && req.files.length > 0) {
      file = req.files[0];
      imageBuffer = req.files[0].buffer || null;
    } else if (req.body?.avatarBase64) {
      const base64Data = req.body.avatarBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    const result = await authService.updateAvatar({
      userId,
      avatarUrl,
      imageBuffer,
      file,
      ipAddress,
    });

    return sendSuccess(res, result.message, { avatar: result.avatar });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Yêu cầu gửi mã OTP đặt lại mật khẩu qua email
 * @route POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.forgotPassword({ email, ipAddress });

    return sendSuccess(res, result.message, {
      email: result.email,
      expiresInMinutes: result.expiresInMinutes,
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 8. Đặt lại mật khẩu mới bằng mã OTP
 * @route POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.resetPassword({
      email,
      otp,
      newPassword,
      ipAddress,
    });

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
