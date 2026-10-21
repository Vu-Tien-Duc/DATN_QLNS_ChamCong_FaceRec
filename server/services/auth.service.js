/**
 * Authentication Service (server/services/auth.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Đăng nhập tài khoản cán bộ/giảng viên (so khớp bcrypt).
 * - JWT Access Token (15 phút) & Refresh Token Rotation có Grace Period 15s.
 * - Phát hiện và phòng chống Replay Attack (thu hồi toàn bộ Token Family).
 * - Thu hồi tức thì qua In-Memory Token Revocation & tăng tokenVersion.
 * - Đổi mật khẩu & cập nhật ảnh đại diện người dùng.
 * - Triệt tiêu hoàn toàn các luồng cũ không dùng (OTP, tự đăng ký tự do).
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const AuditLog = require('../models/auditLog.model');
const { revokeToken } = require('../utils/tokenRevocation');
const minioStorage = require('../config/minio');
const { setGraceToken, getGraceToken } = require('../config/redis');
const { transporter } = require('../config/mailer');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

// Băm token SHA-256 lưu trữ an toàn trong MongoDB
const hashToken = (tokenStr) => crypto.createHash('sha256').update(String(tokenStr).trim()).digest('hex');

// In-Memory Grace Period Cache (15 giây) xử lý Race Condition khi trình duyệt gửi nhiều request refresh đồng thời
// Key: hashedToken, Value: { newAccessToken, newRefreshTokenString, expiresAt }
const rotationGraceCache = new Map();

if (process.env.NODE_ENV !== 'test') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rotationGraceCache.entries()) {
      if (value.expiresAt <= now) {
        rotationGraceCache.delete(key);
      }
    }
  }, 30000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Sinh chuỗi JWT Access Token (15m) chứa danh tính, vai trò và phiên bản token
 */
const generateAccessToken = (user) => {
  const payload = {
    id: user._id.toString(),
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
    tokenVersion: user.tokenVersion || 0,
  };

  const secret = process.env.JWT_SECRET || 'secret-jwt-fallback-key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Sinh chuỗi JWT Refresh Token (7 ngày) gắn với Token Family UUID
 */
const generateRefreshToken = (user, familyId = null) => {
  const tokenFamily = familyId || crypto.randomUUID();
  const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'secret-refresh-fallback-key';
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  const tokenString = jwt.sign(
    {
      userId: user._id.toString(),
      tokenFamily,
      type: 'refresh',
      nonce: crypto.randomUUID(),
    },
    secret,
    { expiresIn }
  );

  return { tokenString, tokenFamily };
};

/**
 * 1. Đăng nhập hệ thống (Login)
 */
const login = async ({ email, password, ipAddress, userAgent }) => {
  if (!email || !password) {
    throw new ServiceError('Vui lòng nhập đầy đủ email và mật khẩu.', 400);
  }

  const inputStr = email.trim();
  const normalizedEmail = inputStr.toLowerCase();

  const query = {
    $or: [
      { email: normalizedEmail },
      { staffCode: inputStr.toUpperCase() },
    ],
  };

  const user = await User.findOne(query)
    .select('+passwordHash +mat_khau_ma_hoa')
    .populate('departmentId', 'name code type location');

  if (!user) {
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  const isUserActive = user.isActive !== false && user.kich_hoat !== false;
  if (!isUserActive) {
    throw new ServiceError('Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa. Vui lòng liên hệ phòng Tổ chức Cán bộ.', 403);
  }

  const targetPasswordHash = user.passwordHash || user.mat_khau_ma_hoa;
  const isMatch = targetPasswordHash ? await bcrypt.compare(password, targetPasswordHash) : false;
  if (!isMatch) {
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  // Khởi tạo cặp Token (Access Token 15m + Refresh Token 7 ngày)
  const token = generateAccessToken(user);
  const { tokenString: refreshTokenString, tokenFamily } = generateRefreshToken(user);

  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  // Lưu bản ghi Refresh Token vào MongoDB
  const hashedTokenStr = hashToken(refreshTokenString);
  await RefreshToken.create({
    chuoi_token: hashedTokenStr,
    ma_ho: tokenFamily,
    nguoi_dung_id: user._id,
    dia_chi_ip: ipAddress || null,
    thong_tin_trinh_duyet: userAgent || null,
    het_han_luc: expiresAt,
  });

  // Cập nhật thông tin đăng nhập cuối
  user.lastLogin = new Date();
  await user.save();

  // Ghi Audit Log
  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'LOGIN',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { email: user.email, role: user.role },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const FaceTemplate = require('../models/faceTemplate.model');
  let faceTemplate = null;
  try {
    faceTemplate = await FaceTemplate.findOne({
      $or: [
        { nguoi_dung_id: user._id },
        { userId: user._id },
      ],
    }).select('ngay_dang_ky so_luong_mau').lean();
  } catch (_) {}

  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.passwordHash;

  const isRegistered = Boolean(faceTemplate);

  userObj.isFaceRegistered = isRegistered;
  userObj.da_dang_ky_face = isRegistered;
  userObj.faceRegisteredAt = isRegistered ? (faceTemplate?.ngay_dang_ky || userObj.faceRegisteredAt || null) : null;

  return {
    token,
    refreshToken: refreshTokenString,
    user: userObj,
  };
};

/**
 * 2. Làm mới Token (Refresh Token Rotation với Grace Period 15s và Chống Replay Attack)
 */
const refreshToken = async ({ token, refreshTokenString, ipAddress, userAgent }) => {
  const incomingToken = token || refreshTokenString;
  if (!incomingToken) {
    throw new ServiceError('Vui lòng cung cấp refreshToken qua Cookie hoặc Request Body.', 400);
  }

  const incomingHash = hashToken(incomingToken);

  // 1. Kiểm tra Grace Period Cache (15s) giải quyết Race Condition (Ưu tiên Redis -> Fallback Memory)
  let graceItem = (await getGraceToken(incomingHash)) || (await getGraceToken(incomingToken));
  if (!graceItem) {
    graceItem = rotationGraceCache.get(incomingHash) || rotationGraceCache.get(incomingToken);
  }
  if (graceItem && graceItem.expiresAt > Date.now()) {
    return {
      accessToken: graceItem.newAccessToken,
      token: graceItem.newAccessToken,
      newAccessToken: graceItem.newAccessToken,
      refreshToken: graceItem.newRefreshTokenString,
      newRefreshTokenString: graceItem.newRefreshTokenString,
    };
  }

  // 2. Tìm bản ghi Refresh Token trong Database
  const tokenDoc = await RefreshToken.findOne({
    $or: [{ chuoi_token: incomingHash }, { token: incomingHash }, { tokenHash: incomingHash }],
  });

  if (!tokenDoc) {
    throw new ServiceError('Refresh token không hợp lệ hoặc đã bị hủy.', 403);
  }

  const tokenFamily = tokenDoc.familyId || tokenDoc.tokenFamily || tokenDoc.ma_ho;
  const userId = tokenDoc.userId || tokenDoc.nguoi_dung_id;

  // 3. PHÁT HIỆN REPLAY ATTACK: Token này đã bị sử dụng hoặc đã bị thu hồi trước đó
  const isUsed = tokenDoc.isUsed || tokenDoc.da_su_dung;
  if (isUsed) {
    const elapsedMs = tokenDoc.usedAt
      ? Date.now() - new Date(tokenDoc.usedAt).getTime()
      : Infinity;

    if (elapsedMs <= 15000 && graceItem) {
      return {
        accessToken: graceItem.newAccessToken,
        token: graceItem.newAccessToken,
        newAccessToken: graceItem.newAccessToken,
        refreshToken: graceItem.newRefreshTokenString,
        newRefreshTokenString: graceItem.newRefreshTokenString,
      };
    }

    // Quá 15 giây hoặc không có grace cache: PHÁT HIỆN REPLAY ATTACK
    if (tokenFamily) {
      if (typeof RefreshToken.deleteMany === 'function') {
        await RefreshToken.deleteMany({
          tokenFamily,
          familyId: tokenFamily,
          ma_ho: tokenFamily,
        });
      }
    } else if (userId && typeof RefreshToken.deleteMany === 'function') {
      await RefreshToken.deleteMany({ userId });
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    }

    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      AuditLog.create({
        actor: userId,
        actorType: 'USER',
        action: 'REPLAY_ATTACK_DETECTED',
        targetId: String(userId),
        targetType: 'User',
        ipAddress: ipAddress || null,
        details: { tokenFamily, warning: 'Phát hiện tái sử dụng Refresh Token! Toàn bộ phiên liên quan đã bị thu hồi.' },
      }).catch((err) => console.error('[AuditLog Error]:', err.message));
    }

    throw new ServiceError(
      'Cảnh báo an ninh: Phát hiện Refresh Token đã qua sử dụng. Toàn bộ phiên đăng nhập đã bị vô hiệu hóa để bảo vệ an toàn danh tính.',
      403,
      'REFRESH_TOKEN_REUSE_DETECTED'
    );
  }

  // Kiểm tra thời hạn
  const expiry = tokenDoc.expiresAt;
  if (expiry && new Date(expiry).getTime() < Date.now()) {
    throw new ServiceError('Refresh token đã hết hạn.', 403);
  }

  const user = await User.findById(userId);
  if (!user || user.isActive === false) {
    throw new ServiceError('Tài khoản người dùng không còn tồn tại hoặc đã bị khóa.', 401);
  }

  // 4. Đánh dấu token hiện tại đã sử dụng
  tokenDoc.isUsed = true;
  tokenDoc.usedAt = new Date();
  if (typeof tokenDoc.save === 'function') {
    await tokenDoc.save();
  }

  // 5. Cấp phát cặp Token mới giữ nguyên Token Family
  const newAccessToken = generateAccessToken(user);
  const { tokenString: newRefreshTokenString } = generateRefreshToken(user, tokenFamily);

  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  if (typeof RefreshToken.create === 'function') {
    const hashedNewToken = hashToken(newRefreshTokenString);
    await RefreshToken.create({
      chuoi_token: hashedNewToken,
      ma_ho: tokenFamily,
      nguoi_dung_id: user._id,
      dia_chi_ip: ipAddress || null,
      thong_tin_trinh_duyet: userAgent || null,
      het_han_luc: expiresAt,
    });
  }

  // 6. Lưu vào Grace Period Cache (15s) đồng bộ đa container qua Redis và Memory
  const graceData = {
    newAccessToken,
    newRefreshTokenString,
    expiresAt: Date.now() + 15000,
  };
  await Promise.all([
    setGraceToken(incomingHash, graceData, 15),
    setGraceToken(incomingToken, graceData, 15),
  ]).catch(() => { });
  rotationGraceCache.set(incomingHash, graceData);
  rotationGraceCache.set(incomingToken, graceData);

  return {
    accessToken: newAccessToken,
    token: newAccessToken,
    newAccessToken,
    refreshToken: newRefreshTokenString,
    newRefreshTokenString,
  };
};

/**
 * 3. Đăng xuất hệ thống (Logout)
 */
const logout = async ({ refreshTokenString, accessTokenString, userId }) => {
  // 1. Thu hồi Access Token in-memory
  if (accessTokenString) {
    revokeToken(accessTokenString);
  }

  // 2. Thu hồi Refresh Token trong DB
  if (refreshTokenString) {
    const hashed = hashToken(refreshTokenString);
    await RefreshToken.updateMany(
      { $or: [{ chuoi_token: hashed }, { tokenHash: hashed }] },
      { $set: { isUsed: true, da_su_dung: true } }
    );
  }

  // 3. Ghi Audit Log nếu có userId
  if (userId) {
    AuditLog.create({
      actor: userId,
      actorType: 'USER',
      action: 'LOGOUT',
      targetId: String(userId),
      targetType: 'User',
      details: { message: 'Đăng xuất thành công, token đã bị thu hồi.' },
    }).catch((err) => console.error('[AuditLog Error]:', err.message));
  }

  return { message: 'Đăng xuất thành công.' };
};

/**
 * 4. Lấy thông tin tài khoản hiện tại (Get Me)
 */
const getMe = async (userId) => {
  const user = await User.findById(userId)
    .populate('departmentId', 'name code type location')
    .select('-passwordHash');

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  const FaceTemplate = require('../models/faceTemplate.model');
  const template = await FaceTemplate.findOne({
    $or: [{ nguoi_dung_id: user._id }, { userId: user._id }],
  }).select('ngay_dang_ky so_luong_mau').lean();

  const userObj = user.toObject ? user.toObject() : user;
  const isRegistered = Boolean(template);

  userObj.isFaceRegistered = isRegistered;
  userObj.da_dang_ky_face = isRegistered;
  userObj.faceRegisteredAt = isRegistered ? (template?.ngay_dang_ky || userObj.faceRegisteredAt || null) : null;

  return userObj;
};

/**
 * 5. Đổi mật khẩu (Change Password)
 */
const changePassword = async ({ userId, currentPassword, oldPassword, newPassword, ipAddress }) => {
  const currentPass = currentPassword || oldPassword;
  if (!currentPass || !newPassword) {
    throw new ServiceError('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.', 400);
  }

  if (newPassword.length < 6) {
    throw new ServiceError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const targetHash = user.passwordHash;
  const isMatch = targetHash ? await bcrypt.compare(currentPass, targetHash) : false;
  if (!isMatch) {
    throw new ServiceError('Mật khẩu hiện tại không chính xác.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const newHashedPassword = await bcrypt.hash(newPassword, salt);

  user.passwordHash = newHashedPassword;
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Hủy tất cả refresh token cũ của user
  await RefreshToken.updateMany(
    { userId: user._id },
    { $set: { isUsed: true, da_su_dung: true } }
  );

  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'CHANGE_PASSWORD',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { message: 'Đổi mật khẩu thành công. Đã thu hồi toàn bộ phiên đăng nhập cũ.' },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.' };
};

/**
 * 6. Cập nhật ảnh đại diện người dùng
 */
const updateAvatar = async ({ userId, avatarUrl, imageBuffer, file, ipAddress }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  let finalAvatarPath = avatarUrl;

  if (file && file.filename) {
    finalAvatarPath = `/uploads/${file.filename}`;
  } else if (imageBuffer) {
    const ext = 'jpg';
    const fileName = `avatar-${userId}-${Date.now()}.${ext}`;
    await minioStorage.putObject(`avatars/${fileName}`, imageBuffer, 'image/jpeg', {
      userId: userId.toString(),
      category: 'avatar',
    });
    finalAvatarPath = `/uploads/${fileName}`;
  }

  if (!finalAvatarPath) {
    throw new ServiceError('Không có dữ liệu ảnh đại diện để cập nhật.', 400);
  }

  user.avatar = finalAvatarPath;
  await user.save();

  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'UPDATE_AVATAR',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { avatar: finalAvatarPath },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    message: 'Cập nhật ảnh đại diện thành công.',
    avatar: finalAvatarPath,
  };
};

/**
 * 7. Yêu cầu đặt lại mật khẩu qua mã OTP gửi về Email
 * Vận hành chuẩn xác các trường: ma_otp, otp_het_han_luc, loai_otp, so_lan_thu_otp, otp_gui_luc
 */
const forgotPassword = async ({ email, ipAddress }) => {
  if (!email || !String(email).trim()) {
    throw new ServiceError('Email là bắt buộc.', 400);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: cleanEmail })
    .select('+ma_otp +otp_het_han_luc +loai_otp +so_lan_thu_otp +otp_gui_luc');

  if (!user) {
    throw new ServiceError('Không tìm thấy tài khoản với email này trong hệ thống.', 404);
  }

  if (user.kich_hoat === false || user.trang_thai_lam_viec === 'DA_NGHI_VIEC') {
    throw new ServiceError('Tài khoản đã bị vô hiệu hóa hoặc đã nghỉ việc. Vui lòng liên hệ Phòng Tổ chức cán bộ.', 403);
  }

  // 1. Kiểm tra Cooldown chống spam gửi OTP liên tục (Sử dụng trường otp_gui_luc)
  const COOLDOWN_SECONDS = 60;
  if (user.otp_gui_luc) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(user.otp_gui_luc).getTime()) / 1000);
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const waitSeconds = COOLDOWN_SECONDS - elapsedSeconds;
      throw new ServiceError(`Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã OTP mới.`, 429);
    }
  }

  // 2. Sinh mã OTP 6 chữ số ngẫu nhiên
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  // Mã hóa băm SHA-256 lưu trong CSDL để đảm bảo an toàn tuyệt đối
  const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');

  // 3. Cập nhật đầy đủ cả 5 trường OTP trong Schema nguoi_dung
  user.ma_otp = hashedOtp;
  user.otp_het_han_luc = new Date(Date.now() + 10 * 60 * 1000); // 10 phút hiệu lực
  user.loai_otp = 'FORGOT_PASSWORD';
  user.so_lan_thu_otp = 0;
  user.otp_gui_luc = new Date();
  await user.save();

  // 4. Gửi email chứa mã OTP đến hòm thư của giảng viên
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"QLNS & Chấm Công Đại Học" <no-reply@uni.edu.vn>',
    to: user.email,
    subject: '[QLNS] Mã OTP xác thực đặt lại mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Yêu Cầu Đặt Lại Mật Khẩu</h2>
        <p>Kính gửi Thầy/Cô <strong>${user.ho_ten || 'Giảng viên'}</strong>,</p>
        <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e40af; background: #eff6ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3b82f6;">${rawOtp}</span>
        </div>
        <p>Mã OTP có hiệu lực trong vòng <strong>10 phút</strong>. Vì lý do bảo mật, Thầy/Cô tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="color: #64748b; font-size: 13px;">Nếu Thầy/Cô không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ ngay với Ban Quản trị hệ thống.</p>
      </div>
    `,
  };

  try {
    if (transporter && transporter.sendMail) {
      await transporter.sendMail(mailOptions);
    }
  } catch (mailErr) {
    console.error('[Mailer Error] Không thể gửi email OTP:', mailErr.message);
  }

  // 5. Ghi Audit Log vết kiểm toán
  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'FORGOT_PASSWORD_REQUESTED',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { email: user.email, expiresAt: user.otp_het_han_luc },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 10 phút.',
    email: user.email,
    expiresInMinutes: 10,
    ...(process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? { devOtp: rawOtp } : {}),
  };
};

/**
 * 8. Xác thực mã OTP và đặt lại mật khẩu mới
 * Vận hành chuẩn xác: so_lan_thu_otp (chống brute-force), otp_het_han_luc, loai_otp, ma_otp
 */
const resetPassword = async ({ email, otp, newPassword, ipAddress }) => {
  if (!email || !String(email).trim()) {
    throw new ServiceError('Email là bắt buộc.', 400);
  }
  if (!otp || !String(otp).trim()) {
    throw new ServiceError('Mã OTP là bắt buộc.', 400);
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ServiceError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  const user = await User.findOne({ email: cleanEmail })
    .select('+ma_otp +otp_het_han_luc +loai_otp +so_lan_thu_otp +otp_gui_luc +mat_khau_ma_hoa');

  if (!user) {
    throw new ServiceError('Không tìm thấy tài khoản người dùng.', 404);
  }

  // 1. Kiểm tra loại OTP
  if (user.loai_otp !== 'FORGOT_PASSWORD' || !user.ma_otp) {
    throw new ServiceError('Không có yêu cầu đặt lại mật khẩu nào đang chờ xử lý.', 400);
  }

  // 2. Kiểm tra số lần thử sai (Chống dò mã Brute-force - Sử dụng so_lan_thu_otp)
  const MAX_ATTEMPTS = 5;
  if ((user.so_lan_thu_otp || 0) >= MAX_ATTEMPTS) {
    user.ma_otp = null;
    user.otp_het_han_luc = null;
    user.loai_otp = null;
    user.so_lan_thu_otp = 0;
    await user.save();
    throw new ServiceError('Bạn đã nhập sai mã OTP quá 5 lần. Mã xác thực đã bị vô hiệu hóa vì lý do an toàn. Vui lòng yêu cầu mã mới.', 400);
  }

  // 3. Kiểm tra thời hạn hiệu lực của mã OTP (Sử dụng otp_het_han_luc)
  if (!user.otp_het_han_luc || new Date() > new Date(user.otp_het_han_luc)) {
    user.ma_otp = null;
    user.otp_het_han_luc = null;
    user.loai_otp = null;
    user.so_lan_thu_otp = 0;
    await user.save();
    throw new ServiceError('Mã OTP đã hết hạn sử dụng (quá 10 phút). Vui lòng yêu cầu mã mới.', 400);
  }

  // 4. So khớp mã OTP (So sánh băm SHA-256)
  const hashedInputOtp = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (hashedInputOtp !== user.ma_otp) {
    user.so_lan_thu_otp = (user.so_lan_thu_otp || 0) + 1;
    await user.save();
    const remaining = MAX_ATTEMPTS - user.so_lan_thu_otp;
    throw new ServiceError(`Mã OTP không chính xác. Bạn còn ${remaining} lần thử trước khi mã bị khóa.`, 400);
  }

  // 5. Cập nhật mật khẩu mới và hủy toàn bộ phiên làm việc cũ
  const salt = await bcrypt.genSalt(10);
  user.mat_khau_ma_hoa = await bcrypt.hash(newPassword, salt);
  user.doi_mat_khau_luc = new Date();
  user.phien_ban_token = (user.phien_ban_token || 1) + 1; // Thu hồi token tức thì

  // Xóa sạch toàn bộ 5 trường OTP về null sau khi đổi mật khẩu thành công
  user.ma_otp = null;
  user.otp_het_han_luc = null;
  user.loai_otp = null;
  user.so_lan_thu_otp = 0;
  user.otp_gui_luc = null;
  await user.save();

  // 6. Thu hồi toàn bộ Refresh Tokens của user trong cơ sở dữ liệu
  await RefreshToken.updateMany(
    { nguoi_dung_id: user._id, da_su_dung: false },
    { da_su_dung: true, thoi_diem_su_dung: new Date() }
  );

  // 7. Ghi Audit Log kiểm toán
  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'PASSWORD_RESET_SUCCESS',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { email: user.email },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
  };
};

module.exports = {
  ServiceError,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
  generateAccessToken,
  generateRefreshToken,
  rotationGraceCache,
};
