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
    const password = req.body?.mat_khau || req.body?.password;
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
    const tokenFromBody = req.body?.ma_lam_moi || req.body?.refreshToken;
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
    const refreshTokenString = req.cookies?.refreshToken || req.body?.ma_lam_moi || req.body?.refreshToken || null;

    let accessTokenString = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessTokenString = authHeader.split(' ')[1];
    }

    const userId = req.user?._id || null;

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
    const userId = req.user?._id;
    const user = await authService.getMe(userId);
    return sendSuccess(res, 'Lấy thông tin tài khoản thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// PUT /api/xac-thuc/doi-mat-khau - Đổi mật khẩu tài khoản
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const currentPassword = req.body?.mat_khau_hien_tai || req.body?.currentPassword;
    const newPassword = req.body?.mat_khau_moi || req.body?.newPassword;
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
    const userId = req.user?._id;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    let imageBuffer = null;
    let file = null;
    let avatarUrl = req.body?.anh_dai_dien || req.body?.avatar || null;

    if (req.file) {
      file = req.file;
      imageBuffer = req.file.buffer || null;
    } else if (Array.isArray(req.files) && req.files.length > 0) {
      file = req.files[0];
      imageBuffer = req.files[0].buffer || null;
    } else if (req.body?.anh_dai_dien_base64 || req.body?.avatarBase64) {
      const base64Data = (req.body.anh_dai_dien_base64 || req.body.avatarBase64).replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    const result = await authService.updateAvatar({
      userId,
      avatarUrl,
      imageBuffer,
      file,
      ipAddress,
    });

    return sendSuccess(res, result.message, { anh_dai_dien: result.avatar });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/quen-mat-khau - Gửi mã OTP đặt lại mật khẩu qua email
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    const result = await authService.forgotPassword({ email, ipAddress });

    return sendSuccess(res, result.message, {
      email: result.email,
      het_han_sau_phut: result.expiresInMinutes,
      ...(result.devOtp ? { ma_otp_thu_nghiem: result.devOtp } : {}),
    });
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/xac-thuc/dat-lai-mat-khau - Xác nhận OTP và đặt mật khẩu mới
const resetPassword = async (req, res, next) => {
  try {
    const email = req.body?.email;
    const otp = req.body?.ma_otp || req.body?.otp;
    const newPassword = req.body?.mat_khau_moi || req.body?.newPassword;
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
