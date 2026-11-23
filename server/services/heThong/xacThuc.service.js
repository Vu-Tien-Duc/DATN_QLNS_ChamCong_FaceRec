// Xử lý đăng nhập, xoay vòng Refresh Token, đăng xuất, đổi mật khẩu, ảnh đại diện và OTP quên mật khẩu.
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');

const {
  NguoiDung,
  HoSoCanBo,
  PhongBan,
  VaiTroNguoiDung,
  MauKhuonMat,
  XacThucOtp,
  MaLamMoi,
  NhatKyKiemToan,
} = require('../../models');
const { revokeToken } = require('../../utils/thuHoiToken');
const { runInTransaction } = require('../../utils/giaoDichDb');
const minioStorage = require('../../config/minio');
const { setGraceToken, getGraceToken, deleteGraceToken, redisSet, redisGet, redisDel } = require('../../config/redis');
const { transporter } = require('../../config/mailer');
const { disconnectUserSockets } = require('../../config/socket');
const { normalizeRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const { normalizeSafeAvatarUrl } = require('./taiTep.service');
const ServiceError = require('../../utils/loiNghiepVu');

// Băm token bằng SHA-256 trước khi lưu hoặc tra cứu
const hashToken = (tokenStr) => crypto.createHash('sha256').update(String(tokenStr).trim()).digest('hex');

const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const UNIFIED_OTP_ERROR_MESSAGE = 'Email hoặc mã OTP không hợp lệ hoặc đã hết hạn.';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const OTP_COOLDOWN_SECONDS = 60;

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'secret-jwt-fallback-key';
  }
  throw new ServiceError('Lỗi cấu hình bảo mật JWT_SECRET.', 500);
};

const getRefreshTokenSecret = () => {
  if (process.env.REFRESH_TOKEN_SECRET) return process.env.REFRESH_TOKEN_SECRET;
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'secret-refresh-fallback-key';
  }
  throw new ServiceError('Lỗi cấu hình bảo mật REFRESH_TOKEN_SECRET.', 500);
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const detectImageSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mimeType: 'image/jpeg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mimeType: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mimeType: 'image/webp' };
  }
  return null;
};

const LOGIN_FAIL_PREFIX = 'LOGIN_FAIL_USER:';
const OTP_COOLDOWN_PREFIX = 'OTP_REQ_COOLDOWN:';
const loginFailureMap = new Map();
const otpCooldownMap = new Map();

const getMaxLoginFailures = () => {
  const envLimit = Number(process.env.MAX_LOGIN_FAILURES);
  if (Number.isFinite(envLimit) && envLimit > 0) return envLimit;
  return 5;
};

const checkUserLoginLockout = async (userId) => {
  const uid = String(userId);
  const now = Date.now();
  const localEntry = loginFailureMap.get(uid);
  if (localEntry && localEntry.expiresAt > now && localEntry.count >= getMaxLoginFailures()) {
    return true;
  }
  const remoteRaw = await redisGet(`${LOGIN_FAIL_PREFIX}${uid}`).catch(() => null);
  if (remoteRaw && Number(remoteRaw) >= getMaxLoginFailures()) {
    return true;
  }
  return false;
};

const recordUserLoginFailure = async (userId) => {
  const uid = String(userId);
  const now = Date.now();
  const existing = loginFailureMap.get(uid);
  const nextCount = existing && existing.expiresAt > now ? existing.count + 1 : 1;
  const expiresAt = existing && existing.expiresAt > now ? existing.expiresAt : now + LOGIN_FAIL_WINDOW_MS;
  loginFailureMap.set(uid, { count: nextCount, expiresAt });
  const ttlSec = Math.max(1, Math.ceil((expiresAt - now) / 1000));
  await redisSet(`${LOGIN_FAIL_PREFIX}${uid}`, String(nextCount), ttlSec).catch(() => {});
};

const clearUserLoginFailures = async (userId) => {
  const uid = String(userId);
  loginFailureMap.delete(uid);
  await redisSet(`${LOGIN_FAIL_PREFIX}${uid}`, '0', 1).catch(() => {});
};

const checkAndMarkOtpCooldown = async (emailHash) => {
  const now = Date.now();
  const localUntil = otpCooldownMap.get(emailHash);
  if (localUntil && localUntil > now) {
    return Math.max(1, Math.ceil((localUntil - now) / 1000));
  }
  const remoteUntil = await redisGet(`${OTP_COOLDOWN_PREFIX}${emailHash}`).catch(() => null);
  if (remoteUntil && Number(remoteUntil) > now) {
    return Math.max(1, Math.ceil((Number(remoteUntil) - now) / 1000));
  }
  const nextUntil = now + OTP_COOLDOWN_SECONDS * 1000;
  otpCooldownMap.set(emailHash, nextUntil);
  await redisSet(`${OTP_COOLDOWN_PREFIX}${emailHash}`, String(nextUntil), OTP_COOLDOWN_SECONDS).catch(() => {});
  return 0;
};

const GRACE_REVOKED_USER_PREFIX = 'TOKEN_GRACE_REVOKED:';
const revokedGraceUserMap = new Map();
const rotationGraceCache = new Map();

// Vô hiệu hóa các token đang nằm trong grace period của người dùng khi đăng xuất hoặc bị thu hồi
const revokeUserGraceTokens = async (userId, specificRefreshToken = null) => {
  const now = Date.now();
  if (specificRefreshToken) {
    const tokenHash = hashToken(specificRefreshToken);
    rotationGraceCache.delete(tokenHash);
    rotationGraceCache.delete(specificRefreshToken);
    await deleteGraceToken(tokenHash).catch(() => {});
  }
  if (userId) {
    const uid = String(userId);
    revokedGraceUserMap.set(uid, now);
    await redisSet(`${GRACE_REVOKED_USER_PREFIX}${uid}`, String(now), 30).catch(() => {});
    for (const [key, value] of rotationGraceCache.entries()) {
      if (value && String(value.userId) === uid) {
        rotationGraceCache.delete(key);
        deleteGraceToken(key).catch(() => {});
      }
    }
  }
};

// Kiểm tra bản ghi grace period của token đã bị thu hồi hay chưa
const isGraceItemRevoked = async (graceItem) => {
  if (!graceItem || !graceItem.userId) return false;
  const uid = String(graceItem.userId);
  const createdAt = Number(graceItem.createdAt || 0);
  const localRevokedAt = revokedGraceUserMap.get(uid);
  if (localRevokedAt && localRevokedAt >= createdAt) return true;
  const remoteRevokedAt = await redisGet(`${GRACE_REVOKED_USER_PREFIX}${uid}`).catch(() => null);
  if (remoteRevokedAt && Number(remoteRevokedAt) >= createdAt) return true;
  return false;
};

if (process.env.NODE_ENV !== 'test') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rotationGraceCache.entries()) {
      if (value.expiresAt <= now) rotationGraceCache.delete(key);
    }
    for (const [uid, revokedAt] of revokedGraceUserMap.entries()) {
      if (now - revokedAt > 30000) revokedGraceUserMap.delete(uid);
    }
    for (const [uid, entry] of loginFailureMap.entries()) {
      if (entry.expiresAt <= now) loginFailureMap.delete(uid);
    }
    for (const [emailHash, until] of otpCooldownMap.entries()) {
      if (until <= now) otpCooldownMap.delete(emailHash);
    }
  }, 30000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

// Ký và cấp Access Token chứa vai trò và phiên bản token hiện tại
const generateAccessToken = (user) => {
  const roleVal = normalizeRole(user.vai_tro_chinh);
  const activeRoles = Array.from(getActiveUserRoles(user));
  const deptId = user.don_vi_chinh_id ? String(user.don_vi_chinh_id) : null;
  const userIdStr = String(user.id);

  const payload = {
    jti: crypto.randomUUID(),
    id: userIdStr,
    email: user.email,
    ho_ten: user.ho_ten || '',
    vai_tro_chinh: roleVal,
    danh_sach_vai_tro: activeRoles.length > 0 ? activeRoles : (roleVal ? [roleVal] : []),
    don_vi_chinh_id: deptId,
    phien_ban_token: user.phien_ban_token || 1,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

// Ký và cấp Refresh Token thuộc cùng họ token (tokenFamily)
const generateRefreshToken = (user, existingFamily = null) => {
  const tokenFamily = existingFamily || crypto.randomBytes(16).toString('hex');
  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

  const tokenString = jwt.sign(
    {
      jti: crypto.randomUUID(),
      id: String(user.id),
      tokenFamily,
      type: 'refresh',
    },
    getRefreshTokenSecret(),
    { expiresIn: `${expiresDays}d` }
  );

  return { tokenString, tokenFamily };
};

// Chuẩn hóa thông tin người dùng trả về client (ẩn mật khẩu băm, gộp hồ sơ cán bộ và trạng thái Face ID)
const formatUserResponse = (userInstance, faceTemplate) => {
  const raw =
    typeof userInstance.get === 'function'
      ? userInstance.get({ plain: true })
      : userInstance.toJSON
        ? userInstance.toJSON()
        : { ...userInstance };
  delete raw.mat_khau_ma_hoa;
  const rawProfile =
    raw.ho_so && typeof raw.ho_so === 'object'
      ? typeof raw.ho_so.get === 'function'
        ? raw.ho_so.get({ plain: true })
        : typeof raw.ho_so.toJSON === 'function'
          ? raw.ho_so.toJSON()
          : { ...raw.ho_so }
      : {};
  const profile = { ...rawProfile };
  delete profile.id;
  delete profile.nguoi_dung_id;
  delete profile.tao_luc;
  delete profile.cap_nhat_luc;

  const userObj = {
    ...profile,
    ...raw,
    tham_nien_nam: userInstance.ho_so?.tham_nien_nam ?? 0,
  };

  const isRegistered = Boolean(faceTemplate);
  const roleVal = normalizeRole(userObj.vai_tro_chinh);
  const deptObj = userObj.don_vi_chinh || null;

  userObj.da_dang_ky_face = isRegistered;
  userObj.ngay_dang_ky_face = isRegistered ? (faceTemplate?.ngay_dang_ky || null) : null;
  userObj.so_luong_mau = isRegistered ? (faceTemplate?.so_luong_mau || 0) : 0;
  userObj.mo_hinh_ai = isRegistered ? (faceTemplate?.mo_hinh_ai || 'buffalo_s') : null;
  userObj.so_chieu_vector = isRegistered ? (faceTemplate?.so_chieu_vector || 512) : null;
  userObj.mac_dinh = isRegistered ? Boolean(faceTemplate?.mac_dinh ?? true) : false;
  userObj.trang_thai_khuon_mat = isRegistered ? (faceTemplate?.trang_thai || 'hoat_dong') : null;
  userObj.anh_khuon_mat = isRegistered ? (faceTemplate?.anh_dai_dien || null) : null;

  userObj.ho_ten = userObj.ho_ten || '';
  userObj.ma_can_bo = userObj.ma_can_bo || '';
  userObj.so_dien_thoai = userObj.so_dien_thoai || '';
  userObj.vai_tro_chinh = roleVal;
  userObj.don_vi_chinh = deptObj || userObj.don_vi_chinh || null;
  userObj.don_vi_chinh_id = deptObj?.id || (typeof userObj.don_vi_chinh_id === 'string' ? userObj.don_vi_chinh_id : null);
  userObj.ten_phong_ban = deptObj?.ten_phong_ban || '';
  userObj.anh_dai_dien = userObj.anh_dai_dien || null;

  return userObj;
};

// Đăng nhập hệ thống
const login = async ({ email, password, ipAddress, userAgent }) => {
  if (!email || !password) {
    throw new ServiceError('Vui lòng nhập đầy đủ email và mật khẩu.', 400);
  }

  const inputStr = email.trim();
  const normalizedEmail = inputStr.toLowerCase();

  const user = await NguoiDung.scope('withPassword').findOne({
    where: {
      [Op.or]: [
        { email: normalizedEmail },
        { ma_can_bo: inputStr.toUpperCase() },
      ],
    },
    include: [
      {
        model: PhongBan,
        as: 'don_vi_chinh',
        attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'vi_do', 'kinh_do', 'ban_kinh_met'],
      },
      {
        model: HoSoCanBo,
        as: 'ho_so',
      },
      {
        model: VaiTroNguoiDung,
        as: 'danh_sach_vai_tro',
        attributes: ['id', 'ma_vai_tro', 'don_vi_id', 'pham_vi', 'duoc_uy_quyen', 'tu_ngay', 'den_ngay'],
        include: [{ model: PhongBan, as: 'don_vi', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] }],
      },
    ],
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  if (await checkUserLoginLockout(user.id)) {
    throw new ServiceError(
      'Tài khoản này đã đăng nhập sai quá số lần quy định (5 lần). Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
      429,
      'AUTH_RATE_LIMIT_EXCEEDED'
    );
  }

  // So khớp mật khẩu trước khi báo trạng thái khóa/nghỉ việc để chống dò tài khoản (enumeration)
  const isMatch = user.mat_khau_ma_hoa
    ? await bcrypt.compare(password, user.mat_khau_ma_hoa)
    : await bcrypt.compare(password, DUMMY_BCRYPT_HASH).then(() => false);
  if (!isMatch) {
    await recordUserLoginFailure(user.id);
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  await clearUserLoginFailures(user.id);

  const isUserActive = user.kich_hoat !== false && user.trang_thai_lam_viec !== 'da_nghi_viec';
  if (!isUserActive) {
    throw new ServiceError('Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa. Vui lòng liên hệ phòng Tổ chức Cán bộ.', 403);
  }

  const token = generateAccessToken(user);
  const { tokenString: refreshTokenString, tokenFamily } = generateRefreshToken(user);

  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await MaLamMoi.create({
    chuoi_token: hashToken(refreshTokenString),
    ma_nhom_token: tokenFamily,
    nguoi_dung_id: user.id,
    dia_chi_ip: ipAddress || null,
    thiet_bi: userAgent || null,
    het_han_luc: expiresAt,
  });

  await NguoiDung.update(
    { lan_dang_nhap_cuoi: new Date() },
    { where: { id: user.id } }
  );

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user.id,
    loai_chu_the: 'user',
    hanh_dong: 'LOGIN',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { email: user.email, role: user.vai_tro_chinh },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  let faceTemplate = null;
  try {
    faceTemplate = await MauKhuonMat.findOne({
      where: { nguoi_dung_id: user.id, mac_dinh: true },
      attributes: ['ngay_dang_ky', 'so_luong_mau', 'anh_dai_dien', 'mo_hinh_ai', 'so_chieu_vector', 'mac_dinh', 'trang_thai'],
    });
  } catch (_) {}

  return {
    token,
    refreshToken: refreshTokenString,
    user: formatUserResponse(user, faceTemplate),
  };
};

// Làm mới Access Token và xoay vòng Refresh Token (có grace period 15 giây)
const refreshToken = async ({ token, refreshTokenString, ipAddress, userAgent }) => {
  const incomingToken = token || refreshTokenString;
  if (!incomingToken) {
    throw new ServiceError('Vui lòng cung cấp refreshToken qua Cookie hoặc Request Body.', 400);
  }

  const incomingHash = hashToken(incomingToken);

  const readGraceItem = async () => {
    let item = (await getGraceToken(incomingHash)) || (await getGraceToken(incomingToken));
    if (!item) {
      item = rotationGraceCache.get(incomingHash) || rotationGraceCache.get(incomingToken);
    }
    if (item && item.expiresAt > Date.now() && !(await isGraceItemRevoked(item))) {
      return item;
    }
    return null;
  };

  const initialGraceItem = await readGraceItem();
  if (initialGraceItem) {
    return {
      accessToken: initialGraceItem.newAccessToken,
      refreshToken: initialGraceItem.newRefreshTokenString,
    };
  }

  let graceStoredInTx = false;
  let txResult;
  try {
    txResult = await runInTransaction(async (transaction) => {
      const tokenDoc = await MaLamMoi.findOne({
        where: { chuoi_token: incomingHash },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!tokenDoc) {
        throw new ServiceError('Refresh token không hợp lệ hoặc đã bị hủy.', 403);
      }

      const tokenFamily = tokenDoc.ma_nhom_token;
      const userId = tokenDoc.nguoi_dung_id;

      if (tokenDoc.da_su_dung) {
        const usedAtTime = tokenDoc.thoi_diem_su_dung;
        const elapsedMs = usedAtTime ? Date.now() - new Date(usedAtTime).getTime() : Infinity;
        // Đọc lại grace cache bên trong transaction sau khi giành khóa để tránh race condition đa request
        const txGraceItem = await readGraceItem();
        if (elapsedMs <= 15000 && txGraceItem) {
          return { outcome: 'grace', graceItem: txGraceItem };
        }
        return { outcome: 'replay', tokenFamily, userId };
      }

      if (tokenDoc.het_han_luc && new Date(tokenDoc.het_han_luc).getTime() < Date.now()) {
        throw new ServiceError('Refresh token đã hết hạn.', 403);
      }

      const user = await NguoiDung.findByPk(userId, {
        include: [
          {
            model: VaiTroNguoiDung,
            as: 'danh_sach_vai_tro',
            attributes: ['id', 'ma_vai_tro', 'don_vi_id', 'pham_vi', 'duoc_uy_quyen', 'tu_ngay', 'den_ngay'],
            include: [{ model: PhongBan, as: 'don_vi', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] }],
          },
        ],
        transaction,
      });
      if (!user || user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
        throw new ServiceError('Tài khoản người dùng không còn tồn tại hoặc đã bị khóa.', 401);
      }

      tokenDoc.da_su_dung = true;
      tokenDoc.thoi_diem_su_dung = new Date();
      await tokenDoc.save({ transaction });

      const newAccessToken = generateAccessToken(user);
      const { tokenString: newRefreshTokenString } = generateRefreshToken(user, tokenFamily);

      const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

      await MaLamMoi.create(
        {
          chuoi_token: hashToken(newRefreshTokenString),
          ma_nhom_token: tokenFamily,
          nguoi_dung_id: user.id,
          dia_chi_ip: ipAddress || null,
          thiet_bi: userAgent || null,
          het_han_luc: expiresAt,
        },
        { transaction }
      );

      const graceData = {
        userId: String(user.id),
        createdAt: Date.now(),
        newAccessToken,
        newRefreshTokenString,
        expiresAt: Date.now() + 15000,
      };
      rotationGraceCache.set(incomingHash, graceData);
      await setGraceToken(incomingHash, graceData, 15).catch(() => {});
      graceStoredInTx = true;

      return { outcome: 'rotated', newAccessToken, newRefreshTokenString };
    });
  } catch (err) {
    if (graceStoredInTx) {
      rotationGraceCache.delete(incomingHash);
      await deleteGraceToken(incomingHash).catch(() => {});
    }
    throw err;
  }

  if (txResult.outcome === 'grace') {
    return {
      accessToken: txResult.graceItem.newAccessToken,
      refreshToken: txResult.graceItem.newRefreshTokenString,
    };
  }

  if (txResult.outcome === 'replay') {
    const { tokenFamily, userId } = txResult;
    await revokeUserGraceTokens(userId, incomingToken);

    if (tokenFamily) {
      await MaLamMoi.destroy({ where: { ma_nhom_token: tokenFamily } });
    } else if (userId) {
      await MaLamMoi.destroy({ where: { nguoi_dung_id: userId } });
    }

    if (userId) {
      await NguoiDung.increment('phien_ban_token', { by: 1, where: { id: userId } });
    }

    NhatKyKiemToan.create({
      nguoi_thuc_hien_id: userId,
      loai_chu_the: 'user',
      hanh_dong: 'REPLAY_ATTACK_DETECTED',
      doi_tuong_id: String(userId),
      loai_doi_tuong: 'nguoi_dung',
      dia_chi_ip: ipAddress || null,
      chi_tiet: { tokenFamily, warning: 'Phát hiện tái sử dụng Refresh Token! Toàn bộ phiên liên quan đã bị thu hồi.' },
    }).catch((err) => console.error('[AuditLog Error]:', err.message));

    throw new ServiceError(
      'Cảnh báo an ninh: Phát hiện Refresh Token đã qua sử dụng. Toàn bộ phiên đăng nhập đã bị vô hiệu hóa để bảo vệ an toàn danh tính.',
      403,
      'REFRESH_TOKEN_REUSE_DETECTED'
    );
  }

  return {
    accessToken: txResult.newAccessToken,
    refreshToken: txResult.newRefreshTokenString,
  };
};

// Đăng xuất và thu hồi token hiện tại
const logout = async ({ refreshTokenString, accessTokenString, userId }) => {
  let effectiveUserId = userId || null;

  if (accessTokenString) {
    const decoded = jwt.decode(accessTokenString);
    const expiresAtMs = decoded && typeof decoded.exp === 'number' ? decoded.exp * 1000 : undefined;
    revokeToken(accessTokenString, expiresAtMs);

    if (!effectiveUserId) {
      try {
        const verified = jwt.verify(accessTokenString, getJwtSecret(), { ignoreExpiration: true });
        if (verified?.id) {
          effectiveUserId = verified.id;
        }
      } catch (_) {}
    }
  }

  if (refreshTokenString) {
    const tokenHash = hashToken(refreshTokenString);
    const tokenDoc = await MaLamMoi.findOne({
      where: { chuoi_token: tokenHash },
      attributes: ['id', 'nguoi_dung_id', 'ma_nhom_token'],
    }).catch(() => null);
    if (!effectiveUserId && tokenDoc?.nguoi_dung_id) {
      effectiveUserId = tokenDoc.nguoi_dung_id;
    }
    // Xóa bản ghi refresh token khi đăng xuất chủ động để không gây nhầm lẫn Replay Attack
    if (tokenDoc?.ma_nhom_token) {
      await MaLamMoi.destroy({ where: { ma_nhom_token: tokenDoc.ma_nhom_token } });
    } else {
      await MaLamMoi.destroy({ where: { chuoi_token: tokenHash } });
    }
  }

  await revokeUserGraceTokens(effectiveUserId, refreshTokenString);
  if (effectiveUserId) {
    disconnectUserSockets(effectiveUserId);
  }

  if (effectiveUserId) {
    NhatKyKiemToan.create({
      nguoi_thuc_hien_id: effectiveUserId,
      loai_chu_the: 'user',
      hanh_dong: 'LOGOUT',
      doi_tuong_id: String(effectiveUserId),
      loai_doi_tuong: 'nguoi_dung',
      chi_tiet: { message: 'Đăng xuất thành công, token đã bị thu hồi.' },
    }).catch((err) => console.error('[AuditLog Error]:', err.message));
  }

  return { message: 'Đăng xuất thành công.' };
};

// Lấy thông tin tài khoản hiện tại
const getMe = async (userId) => {
  const user = await NguoiDung.findByPk(userId, {
    include: [
      {
        model: PhongBan,
        as: 'don_vi_chinh',
        attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'vi_do', 'kinh_do', 'ban_kinh_met'],
      },
      {
        model: HoSoCanBo,
        as: 'ho_so',
      },
      {
        model: VaiTroNguoiDung,
        as: 'danh_sach_vai_tro',
        attributes: ['id', 'ma_vai_tro', 'don_vi_id', 'pham_vi', 'duoc_uy_quyen', 'tu_ngay', 'den_ngay'],
        include: [{ model: PhongBan, as: 'don_vi', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] }],
      },
    ],
  });

  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  const template = await MauKhuonMat.findOne({
    where: { nguoi_dung_id: user.id, mac_dinh: true },
    attributes: ['ngay_dang_ky', 'so_luong_mau', 'anh_dai_dien', 'mo_hinh_ai', 'so_chieu_vector', 'mac_dinh', 'trang_thai'],
  });

  return formatUserResponse(user, template);
};

// Đổi mật khẩu tài khoản
const changePassword = async ({ userId, currentPassword, newPassword, ipAddress }) => {
  if (!currentPassword || !newPassword) {
    throw new ServiceError('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.', 400);
  }
  if (newPassword.length < 6) {
    throw new ServiceError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
  }

  const user = await NguoiDung.scope('withPassword').findByPk(userId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const isMatch = user.mat_khau_ma_hoa ? await bcrypt.compare(currentPassword, user.mat_khau_ma_hoa) : false;
  if (!isMatch) {
    throw new ServiceError('Mật khẩu hiện tại không chính xác.', 400);
  }

  const isSameAsCurrent = user.mat_khau_ma_hoa ? await bcrypt.compare(newPassword, user.mat_khau_ma_hoa) : false;
  if (isSameAsCurrent) {
    throw new ServiceError('Mật khẩu mới không được trùng với mật khẩu hiện tại.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  await runInTransaction(async (transaction) => {
    user.mat_khau_ma_hoa = hashedNewPassword;
    user.doi_mat_khau_luc = new Date();
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
    await user.save({ transaction });

    // Xóa toàn bộ refresh token cũ để không gây Replay Attack giả nếu thiết bị cũ gọi refresh
    await MaLamMoi.destroy({
      where: { nguoi_dung_id: user.id },
      transaction,
    });
  });

  await revokeUserGraceTokens(user.id);
  disconnectUserSockets(user.id);

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user.id,
    loai_chu_the: 'user',
    hanh_dong: 'CHANGE_PASSWORD',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { message: 'Đổi mật khẩu thành công. Đã thu hồi toàn bộ phiên đăng nhập cũ.' },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.' };
};

// Cập nhật ảnh đại diện người dùng
const updateAvatar = async ({ userId, avatarUrl, imageBuffer, file, ipAddress }) => {
  const user = await NguoiDung.findByPk(userId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  let finalAvatarPath = user.anh_dai_dien;
  const bufferToSave = imageBuffer || (file && file.buffer ? file.buffer : null);

  if (bufferToSave) {
    if (!Buffer.isBuffer(bufferToSave) || bufferToSave.length === 0 || bufferToSave.length > MAX_AVATAR_BYTES) {
      throw new ServiceError('Ảnh đại diện vượt quá giới hạn dung lượng tối đa (5MB).', 400);
    }
    const signature = detectImageSignature(bufferToSave);
    if (!signature) {
      throw new ServiceError('Định dạng ảnh đại diện không hợp lệ. Chỉ chấp nhận tệp JPG, PNG hoặc WEBP.', 400);
    }
    const fileName = `avatar-${userId}-${Date.now()}.${signature.ext}`;

    await minioStorage.putObject(`avatars/${fileName}`, bufferToSave, signature.mimeType, {
      userId: String(userId),
      category: 'avatar',
    });

    finalAvatarPath = `/api/tai-tep/tep/${fileName}`;
  } else if (file && file.filename) {
    finalAvatarPath = normalizeSafeAvatarUrl(`/api/tai-tep/tep/${path.basename(String(file.filename))}`);
  } else if (avatarUrl !== undefined) {
    finalAvatarPath = normalizeSafeAvatarUrl(avatarUrl);
  }

  user.anh_dai_dien = finalAvatarPath;
  await user.save();

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user.id,
    loai_chu_the: 'user',
    hanh_dong: 'UPDATE_AVATAR',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { anh_dai_dien: finalAvatarPath },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    message: 'Cập nhật ảnh đại diện thành công.',
    anh_dai_dien: finalAvatarPath,
  };
};

// Gửi mã OTP đặt lại mật khẩu qua email
const forgotPassword = async ({ email, ipAddress }) => {
  if (!email || !String(email).trim()) {
    throw new ServiceError('Email là bắt buộc.', 400);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new ServiceError('Định dạng email không hợp lệ.', 400, 'INVALID_EMAIL_FORMAT');
  }

  const user = await NguoiDung.findOne({ where: { email: cleanEmail } });
  if (!user) {
    throw new ServiceError('Email này không tồn tại trong hệ thống tài khoản.', 404, 'EMAIL_NOT_FOUND');
  }
  if (user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
    throw new ServiceError('Tài khoản liên kết với email này đang bị khóa hoặc đã nghỉ việc.', 403, 'ACCOUNT_INACTIVE');
  }

  const emailHash = hashToken(cleanEmail);
  const waitSeconds = await checkAndMarkOtpCooldown(emailHash);
  if (waitSeconds > 0) {
    throw new ServiceError(`Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã OTP mới.`, 429);
  }

  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = hashToken(rawOtp);
  const safeFullName = escapeHtml(user.ho_ten || 'Giảng viên');
  const senderEmail = (process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@uni.edu.vn').trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"QLNS & Chấm Công Đại Học" <${senderEmail}>`,
    to: user.email,
    subject: '[QLNS] Mã OTP xác thực đặt lại mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Yêu Cầu Đặt Lại Mật Khẩu</h2>
        <p>Kính gửi Thầy/Cô <strong>${safeFullName}</strong>,</p>
        <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e40af; background: #eff6ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3b82f6;">${rawOtp}</span>
        </div>
        <p>Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>.</p>
      </div>
    `,
  };

  await runInTransaction(async (transaction) => {
    await XacThucOtp.update(
      { da_su_dung: true },
      { where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password', da_su_dung: false }, transaction }
    );

    await XacThucOtp.create(
      {
        nguoi_dung_id: user.id,
        loai_otp: 'forgot_password',
        ma_otp: hashedOtp,
        het_han_luc: new Date(Date.now() + 10 * 60 * 1000),
        so_lan_thu: 0,
        da_su_dung: false,
        gui_luc: new Date(),
      },
      { transaction }
    );
  });

  // Gửi email OTP sau khi DB transaction đã commit để không giữ connection lock khi SMTP chậm
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('[Email OTP Error]:', err.message);
    otpCooldownMap.delete(emailHash);
    await redisDel(`${OTP_COOLDOWN_PREFIX}${emailHash}`).catch(() => {});
    await XacThucOtp.update(
      { da_su_dung: true },
      { where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password', ma_otp: hashedOtp, da_su_dung: false } }
    ).catch(() => {});
    const devDetail =
      process.env.NODE_ENV === 'production'
        ? ''
        : ` (${err.message || 'Lỗi kết nối SMTP'})`;
    throw new ServiceError(
      `Không thể gửi email xác thực OTP lúc này${devDetail}. Vui lòng kiểm tra cấu hình SMTP hoặc thử lại sau.`,
      503,
      'EMAIL_OTP_SEND_FAILED'
    );
  }

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user.id,
    loai_chu_the: 'user',
    hanh_dong: 'FORGOT_PASSWORD_OTP_SENT',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { email: user.email },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    success: true,
    message: 'Mã OTP khôi phục mật khẩu đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư (kể cả Spam/Thư rác).',
  };
};

// Xác thực OTP và đặt lại mật khẩu mới
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
  const MAX_ATTEMPTS = 5;

  const txResult = await runInTransaction(async (transaction) => {
    const user = await NguoiDung.scope('withPassword').findOne({
      where: { email: cleanEmail },
      transaction,
    });
    if (!user || user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
      return { ok: false, statusCode: 400, message: UNIFIED_OTP_ERROR_MESSAGE };
    }

    const otpDoc = await XacThucOtp.findOne({
      where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password', da_su_dung: false },
      order: [['tao_luc', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!otpDoc) {
      return { ok: false, statusCode: 400, message: UNIFIED_OTP_ERROR_MESSAGE };
    }

    if ((otpDoc.so_lan_thu || 0) >= MAX_ATTEMPTS) {
      otpDoc.da_su_dung = true;
      await otpDoc.save({ transaction });
      return { ok: false, statusCode: 400, message: UNIFIED_OTP_ERROR_MESSAGE };
    }

    if (!otpDoc.het_han_luc || new Date() > new Date(otpDoc.het_han_luc)) {
      otpDoc.da_su_dung = true;
      await otpDoc.save({ transaction });
      return { ok: false, statusCode: 400, message: UNIFIED_OTP_ERROR_MESSAGE };
    }

    const hashedInputBuf = crypto.createHash('sha256').update(cleanOtp).digest();
    const storedOtpBuf = Buffer.from(String(otpDoc.ma_otp || ''), 'hex');
    const isOtpMatch =
      storedOtpBuf.length === hashedInputBuf.length &&
      crypto.timingSafeEqual(storedOtpBuf, hashedInputBuf);

    if (!isOtpMatch) {
      const nextAttempts = (otpDoc.so_lan_thu || 0) + 1;
      otpDoc.so_lan_thu = nextAttempts;
      if (nextAttempts >= MAX_ATTEMPTS) {
        otpDoc.da_su_dung = true;
      }
      await otpDoc.save({ transaction });
      return { ok: false, statusCode: 400, message: UNIFIED_OTP_ERROR_MESSAGE };
    }

    const isSameAsCurrent = user.mat_khau_ma_hoa ? await bcrypt.compare(newPassword, user.mat_khau_ma_hoa) : false;
    if (isSameAsCurrent) {
      return { ok: false, statusCode: 400, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' };
    }

    const salt = await bcrypt.genSalt(10);
    user.mat_khau_ma_hoa = await bcrypt.hash(newPassword, salt);
    user.doi_mat_khau_luc = new Date();
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
    await user.save({ transaction });

    otpDoc.da_su_dung = true;
    await otpDoc.save({ transaction });

    await MaLamMoi.destroy({
      where: { nguoi_dung_id: user.id },
      transaction,
    });

    return { ok: true, userId: user.id, email: user.email };
  });

  if (!txResult.ok) {
    throw new ServiceError(txResult.message, txResult.statusCode);
  }

  await revokeUserGraceTokens(txResult.userId);

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: txResult.userId,
    loai_chu_the: 'user',
    hanh_dong: 'PASSWORD_RESET_SUCCESS',
    doi_tuong_id: String(txResult.userId),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { email: txResult.email },
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
  revokeUserGraceTokens,
  rotationGraceCache,
  loginFailureMap,
  otpCooldownMap,
};
