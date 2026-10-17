/**
 * Authentication Service (server/services/auth.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Đăng nhập tài khoản cán bộ/giảng viên (so khớp bcrypt).
 * - JWT Access Token (15 phút) & Refresh Token Rotation có Grace Period 15s.
 * - Phát hiện và phòng chống Replay Attack (thu hồi toàn bộ Token Family).
 * - Thu hồi tức thì qua In-Memory Token Revocation & tăng phien_ban_token.
 * - Đổi mật khẩu & cập nhật ảnh đại diện người dùng.
 * - Triệt tiêu hoàn toàn các luồng cũ không dùng (OTP, tự đăng ký tự do).
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const AuditLog = require('../models/auditLog.model');
const { revokeToken } = require('../utils/tokenRevocation');
const { uploadDir } = require('../middlewares/upload.middleware');

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
// Key: token_hash, Value: { newAccessToken, newRefreshTokenString, expiresAt }
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
    role: user.role || user.vai_tro,
    vai_tro: user.vai_tro || user.role,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
    ma_don_vi: user.ma_don_vi ? user.ma_don_vi.toString() : null,
    tokenVersion: user.phien_ban_token || user.tokenVersion || 0,
    phien_ban_token: user.phien_ban_token || user.tokenVersion || 0,
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

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select('+mat_khau_ma_hoa +passwordHash')
    .populate('departmentId', 'name code type location');

  if (!user) {
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  const isUserActive = user.isActive !== false && user.trang_thai !== 'KHOA';
  if (!isUserActive) {
    throw new ServiceError('Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa. Vui lòng liên hệ phòng Tổ chức Cán bộ.', 403);
  }

  const targetPasswordHash = user.mat_khau_ma_hoa || user.passwordHash;
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
  await RefreshToken.create({
    ma_nguoi_dung: user._id,
    userId: user._id,
    chuoi_ma_hoa: hashToken(refreshTokenString),
    tokenHash: hashToken(refreshTokenString),
    nhom_token: tokenFamily,
    tokenFamily,
    dia_chi_ip: ipAddress || null,
    ipAddress: ipAddress || null,
    thiet_bi: userAgent || null,
    userAgent: userAgent || null,
    ngay_het_han: expiresAt,
    expiresAt,
    trang_thai: 'DANG_HOAT_DONG',
  });

  // Cập nhật thông tin đăng nhập cuối
  user.lan_dang_nhap_cuoi = new Date();
  user.lastLogin = user.lan_dang_nhap_cuoi;
  user.so_lan_dang_nhap_that_bai = 0;
  await user.save();

  // Ghi Audit Log
  AuditLog.create({
    actor: user._id,
    actorType: 'USER',
    action: 'LOGIN',
    targetId: user._id.toString(),
    targetType: 'User',
    ipAddress: ipAddress || null,
    details: { email: user.email, role: user.role || user.vai_tro },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.mat_khau_ma_hoa;
  delete userObj.passwordHash;

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

  // 1. Kiểm tra In-Memory Grace Period Cache (15s) giải quyết Race Condition
  const graceItem = rotationGraceCache.get(incomingHash) || rotationGraceCache.get(incomingToken);
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
    $or: [
      { chuoi_ma_hoa: incomingHash },
      { tokenHash: incomingHash },
      { token: incomingHash },
      { token: incomingToken },
      { chuoi_token: incomingHash },
      { chuoi_token: incomingToken },
      { ma_hash: incomingHash },
    ],
  });

  if (!tokenDoc) {
    throw new ServiceError('Refresh token không hợp lệ hoặc đã bị hủy.', 403);
  }

  const tokenFamily = tokenDoc.nhom_token || tokenDoc.tokenFamily || tokenDoc.ma_ho;
  const userId = tokenDoc.ma_nguoi_dung || tokenDoc.userId || tokenDoc.nguoi_dung_id;

  // 3. PHÁT HIỆN REPLAY ATTACK: Token này đã bị sử dụng hoặc đã bị thu hồi trước đó
  const isUsed = tokenDoc.da_su_dung || tokenDoc.isUsed || tokenDoc.isRevoked || tokenDoc.da_thu_hoi || tokenDoc.trang_thai === 'DA_THU_HOI';
  if (isUsed) {
    const elapsedMs = tokenDoc.thoi_diem_su_dung
      ? Date.now() - new Date(tokenDoc.thoi_diem_su_dung).getTime()
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
        await RefreshToken.deleteMany({ ma_ho: tokenFamily });
      }
    } else if (userId && typeof RefreshToken.deleteMany === 'function') {
      await RefreshToken.deleteMany({
        $or: [{ userId }, { ma_nguoi_dung: userId }],
      });
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, { $inc: { phien_ban_token: 1 } });
    }

    AuditLog.create({
      actor: userId,
      actorType: 'USER',
      action: 'REPLAY_ATTACK_DETECTED',
      targetId: String(userId),
      targetType: 'User',
      ipAddress: ipAddress || null,
      details: { tokenFamily, warning: 'Phát hiện tái sử dụng Refresh Token! Toàn bộ phiên liên quan đã bị thu hồi.' },
    }).catch((err) => console.error('[AuditLog Error]:', err.message));

    throw new ServiceError(
      'Cảnh báo an ninh: Phát hiện Refresh Token đã qua sử dụng. Toàn bộ phiên đăng nhập đã bị vô hiệu hóa để bảo vệ an toàn danh tính.',
      403,
      'REFRESH_TOKEN_REUSE_DETECTED'
    );
  }

  // Kiểm tra thời hạn
  const expiry = tokenDoc.ngay_het_han || tokenDoc.expiresAt || tokenDoc.het_han_luc;
  if (expiry && new Date(expiry).getTime() < Date.now()) {
    throw new ServiceError('Refresh token đã hết hạn.', 403);
  }

  const user = await User.findById(userId);
  if (!user || user.isActive === false || user.trang_thai === 'KHOA') {
    throw new ServiceError('Tài khoản người dùng không còn tồn tại hoặc đã bị khóa.', 401);
  }

  // 4. Đánh dấu token hiện tại đã sử dụng
  tokenDoc.da_su_dung = true;
  tokenDoc.isUsed = true;
  tokenDoc.trang_thai = 'DA_THU_HOI';
  tokenDoc.thoi_diem_su_dung = new Date();
  if (typeof tokenDoc.save === 'function') {
    await tokenDoc.save();
  }

  // 5. Cấp phát cặp Token mới giữ nguyên Token Family
  const newAccessToken = generateAccessToken(user);
  const { tokenString: newRefreshTokenString } = generateRefreshToken(user, tokenFamily);

  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  if (typeof RefreshToken.create === 'function') {
    await RefreshToken.create({
      ma_nguoi_dung: user._id,
      userId: user._id,
      chuoi_ma_hoa: hashToken(newRefreshTokenString),
      tokenHash: hashToken(newRefreshTokenString),
      token: hashToken(newRefreshTokenString),
      nhom_token: tokenFamily,
      tokenFamily,
      ma_ho: tokenFamily,
      dia_chi_ip: ipAddress || null,
      ipAddress: ipAddress || null,
      thiet_bi: userAgent || null,
      userAgent: userAgent || null,
      ngay_het_han: expiresAt,
      expiresAt,
      trang_thai: 'DANG_HOAT_DONG',
    });
  }

  // 6. Lưu vào Grace Period Cache (15s)
  const graceData = {
    newAccessToken,
    newRefreshTokenString,
    expiresAt: Date.now() + 15000,
  };
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
      { $or: [{ chuoi_ma_hoa: hashed }, { tokenHash: hashed }] },
      { $set: { da_su_dung: true, isUsed: true, trang_thai: 'DA_THU_HOI' } }
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
    .select('-mat_khau_ma_hoa -passwordHash');

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  return user;
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

  const user = await User.findById(userId).select('+mat_khau_ma_hoa +passwordHash');
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const targetHash = user.mat_khau_ma_hoa || user.passwordHash;
  const isMatch = targetHash ? await bcrypt.compare(currentPass, targetHash) : false;
  if (!isMatch) {
    throw new ServiceError('Mật khẩu hiện tại không chính xác.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const newHashedPassword = await bcrypt.hash(newPassword, salt);

  user.mat_khau_ma_hoa = newHashedPassword;
  user.passwordHash = newHashedPassword;
  user.passwordChangedAt = new Date();
  user.phien_ban_token = (user.phien_ban_token || 0) + 1;
  await user.save();

  // Hủy tất cả refresh token cũ của user
  await RefreshToken.updateMany(
    { $or: [{ ma_nguoi_dung: user._id }, { userId: user._id }] },
    { $set: { da_su_dung: true, isUsed: true, trang_thai: 'DA_THU_HOI' } }
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
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);
    finalAvatarPath = `/uploads/${fileName}`;
  }

  if (!finalAvatarPath) {
    throw new ServiceError('Không có dữ liệu ảnh đại diện để cập nhật.', 400);
  }

  user.avatar = finalAvatarPath;
  user.anh_dai_dien = finalAvatarPath;
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

module.exports = {
  ServiceError,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
  generateAccessToken,
  generateRefreshToken,
  rotationGraceCache,
};
