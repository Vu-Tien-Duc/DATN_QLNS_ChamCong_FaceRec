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
const { setGraceToken, getGraceToken, deleteGraceToken, redisSet, redisGet } = require('../../config/redis');
const { transporter } = require('../../config/mailer');
const { normalizeRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const ServiceError = require('../../utils/loiNghiepVu');

// Băm token bằng SHA-256 trước khi lưu hoặc tra cứu
const hashToken = (tokenStr) => crypto.createHash('sha256').update(String(tokenStr).trim()).digest('hex');

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
    id: userIdStr,
    userId: userIdStr,
    email: user.email,
    ho_ten: user.ho_ten || '',
    role: roleVal,
    vai_tro_chinh: roleVal,
    danh_sach_vai_tro: activeRoles.length > 0 ? activeRoles : (roleVal ? [roleVal] : []),
    departmentId: deptId,
    don_vi_chinh_id: deptId,
    tokenVersion: user.phien_ban_token || 1,
    phien_ban_token: user.phien_ban_token || 1,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'secret-jwt-fallback-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

// Ký và cấp Refresh Token thuộc cùng họ token (tokenFamily)
const generateRefreshToken = (user, existingFamily = null) => {
  const tokenFamily = existingFamily || crypto.randomBytes(16).toString('hex');
  const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

  const tokenString = jwt.sign(
    {
      id: String(user.id),
      userId: String(user.id),
      tokenFamily,
      type: 'refresh',
    },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'secret-refresh-fallback-key',
    { expiresIn: `${expiresDays}d` }
  );

  return { tokenString, tokenFamily };
};

// Chuẩn hóa thông tin người dùng trả về client (ẩn mật khẩu băm, gộp hồ sơ cán bộ và trạng thái Face ID)
const formatUserResponse = (userInstance, faceTemplate) => {
  const raw = userInstance.toJSON ? userInstance.toJSON() : { ...userInstance };
  delete raw.mat_khau_ma_hoa;
  const profile = raw.ho_so && typeof raw.ho_so === 'object' ? { ...raw.ho_so } : {};
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
  const deptName = deptObj?.ten_phong_ban || '';

  userObj._id = userObj.id;
  userObj.da_dang_ky_face = isRegistered;
  userObj.ngay_dang_ky_face = isRegistered ? (faceTemplate?.ngay_dang_ky || null) : null;
  userObj.so_luong_mau = isRegistered ? (faceTemplate?.so_luong_mau || 0) : 0;
  userObj.mo_hinh_ai = isRegistered ? (faceTemplate?.mo_hinh_ai || 'buffalo_s') : null;
  userObj.so_chieu_vector = isRegistered ? (faceTemplate?.so_chieu_vector || 512) : null;
  userObj.mac_dinh = isRegistered ? Boolean(faceTemplate?.mac_dinh ?? true) : false;
  userObj.trang_thai_khuon_mat = isRegistered ? (faceTemplate?.trang_thai || 'hoat_dong') : null;
  userObj.anh_khuon_mat = isRegistered ? (faceTemplate?.anh_dai_dien || null) : null;
  userObj.isFaceRegistered = isRegistered;
  userObj.faceRegisteredAt = userObj.ngay_dang_ky_face;

  userObj.ho_ten = userObj.ho_ten || '';
  userObj.ma_can_bo = userObj.ma_can_bo || '';
  userObj.so_dien_thoai = userObj.so_dien_thoai || '';
  userObj.vai_tro_chinh = roleVal;
  userObj.don_vi_chinh_id = deptObj || userObj.don_vi_chinh_id || null;
  userObj.anh_dai_dien = userObj.anh_dai_dien || null;

  // Giữ tương thích tên trường cho frontend
  userObj.fullName = userObj.ho_ten;
  userObj.staffCode = userObj.ma_can_bo;
  userObj.phoneNumber = userObj.so_dien_thoai;
  userObj.role = roleVal;
  userObj.primaryRole = roleVal;
  userObj.departmentId = userObj.don_vi_chinh_id;
  userObj.departmentName = deptName;
  userObj.avatar = userObj.anh_dai_dien;
  userObj.facePhoto = userObj.anh_khuon_mat;

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
        attributes: ['ma_vai_tro', 'don_vi_id', 'pham_vi', 'tu_ngay', 'den_ngay'],
      },
    ],
  });

  if (!user) {
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
  }

  const isUserActive = user.kich_hoat !== false && user.trang_thai_lam_viec !== 'da_nghi_viec';
  if (!isUserActive) {
    throw new ServiceError('Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa. Vui lòng liên hệ phòng Tổ chức Cán bộ.', 403);
  }

  const isMatch = user.mat_khau_ma_hoa ? await bcrypt.compare(password, user.mat_khau_ma_hoa) : false;
  if (!isMatch) {
    throw new ServiceError('Tài khoản hoặc mật khẩu không chính xác.', 401);
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

  let graceItem = (await getGraceToken(incomingHash)) || (await getGraceToken(incomingToken));
  if (!graceItem) {
    graceItem = rotationGraceCache.get(incomingHash) || rotationGraceCache.get(incomingToken);
  }
  if (graceItem && graceItem.expiresAt > Date.now() && !(await isGraceItemRevoked(graceItem))) {
    return {
      accessToken: graceItem.newAccessToken,
      token: graceItem.newAccessToken,
      newAccessToken: graceItem.newAccessToken,
      refreshToken: graceItem.newRefreshTokenString,
      newRefreshTokenString: graceItem.newRefreshTokenString,
    };
  }

  const txResult = await runInTransaction(async (transaction) => {
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
      if (elapsedMs <= 15000 && graceItem && !(await isGraceItemRevoked(graceItem))) {
        return { outcome: 'grace' };
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
          attributes: ['ma_vai_tro', 'don_vi_id', 'pham_vi', 'tu_ngay', 'den_ngay'],
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

    return { outcome: 'rotated', user, newAccessToken, newRefreshTokenString };
  });

  if (txResult.outcome === 'grace') {
    return {
      accessToken: graceItem.newAccessToken,
      token: graceItem.newAccessToken,
      newAccessToken: graceItem.newAccessToken,
      refreshToken: graceItem.newRefreshTokenString,
      newRefreshTokenString: graceItem.newRefreshTokenString,
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

  const { user, newAccessToken, newRefreshTokenString } = txResult;

  const graceData = {
    userId: String(user.id),
    createdAt: Date.now(),
    newAccessToken,
    newRefreshTokenString,
    expiresAt: Date.now() + 15000,
  };
  await Promise.all([
    setGraceToken(incomingHash, graceData, 15),
  ]).catch(() => {});
  rotationGraceCache.set(incomingHash, graceData);

  return {
    accessToken: newAccessToken,
    token: newAccessToken,
    newAccessToken,
    refreshToken: newRefreshTokenString,
    newRefreshTokenString,
  };
};

// Đăng xuất và thu hồi token hiện tại
const logout = async ({ refreshTokenString, accessTokenString, userId }) => {
  let effectiveUserId = userId || null;

  if (accessTokenString) {
    const decoded = jwt.decode(accessTokenString);
    const remainingSeconds =
      decoded && typeof decoded.exp === 'number'
        ? Math.max(1, Math.ceil(decoded.exp - Date.now() / 1000))
        : undefined;
    revokeToken(accessTokenString, remainingSeconds);

    if (!effectiveUserId) {
      try {
        const verified = jwt.verify(
          accessTokenString,
          process.env.JWT_SECRET || 'secret-jwt-fallback-key',
          { ignoreExpiration: true }
        );
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
    if (tokenDoc?.ma_nhom_token) {
      await MaLamMoi.update(
        { da_su_dung: true, thoi_diem_su_dung: new Date() },
        { where: { ma_nhom_token: tokenDoc.ma_nhom_token, da_su_dung: false } }
      );
    } else {
      await MaLamMoi.update(
        { da_su_dung: true, thoi_diem_su_dung: new Date() },
        { where: { chuoi_token: tokenHash } }
      );
    }
  }

  await revokeUserGraceTokens(effectiveUserId, refreshTokenString);

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
        attributes: ['ma_vai_tro', 'don_vi_id', 'pham_vi', 'tu_ngay', 'den_ngay'],
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
const changePassword = async ({ userId, currentPassword, oldPassword, newPassword, ipAddress }) => {
  const currentPass = currentPassword || oldPassword;
  if (!currentPass || !newPassword) {
    throw new ServiceError('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.', 400);
  }
  if (newPassword.length < 6) {
    throw new ServiceError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
  }

  const user = await NguoiDung.scope('withPassword').findByPk(userId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const isMatch = user.mat_khau_ma_hoa ? await bcrypt.compare(currentPass, user.mat_khau_ma_hoa) : false;
  if (!isMatch) {
    throw new ServiceError('Mật khẩu hiện tại không chính xác.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  user.mat_khau_ma_hoa = await bcrypt.hash(newPassword, salt);
  user.doi_mat_khau_luc = new Date();
  user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  await user.save();

  await MaLamMoi.update(
    { da_su_dung: true, thoi_diem_su_dung: new Date() },
    { where: { nguoi_dung_id: user.id, da_su_dung: false } }
  );

  await revokeUserGraceTokens(user.id);

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
    const allowedExts = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const rawExt = file && file.originalname ? path.extname(file.originalname).replace('.', '').toLowerCase() : 'jpg';
    const ext = allowedExts.has(rawExt) ? rawExt : 'jpg';
    const mimeType = file?.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const fileName = `avatar-${userId}-${Date.now()}.${ext}`;

    await minioStorage.putObject(`avatars/${fileName}`, bufferToSave, mimeType, {
      userId: String(userId),
      category: 'avatar',
    });

    finalAvatarPath = `/api/tai-tep/tep/${fileName}`;
  } else if (file && file.filename) {
    finalAvatarPath = `/api/tai-tep/tep/${file.filename}`;
  } else if (avatarUrl === null || avatarUrl === '') {
    finalAvatarPath = null;
  } else if (typeof avatarUrl === 'string') {
    const trimmedUrl = avatarUrl.trim();
    const isValidSafeUrl =
      /^\/api\/tai-tep\/tep\/[A-Za-z0-9._-]+$/.test(trimmedUrl) ||
      /^https?:\/\/\S+$/i.test(trimmedUrl) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmedUrl);
    if (!isValidSafeUrl || trimmedUrl.length > 500) {
      throw new ServiceError('Đường dẫn ảnh đại diện không hợp lệ.', 400);
    }
    finalAvatarPath = trimmedUrl;
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
    chi_tiet: { avatar: finalAvatarPath },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    message: 'Cập nhật ảnh đại diện thành công.',
    avatar: finalAvatarPath,
    anh_dai_dien: finalAvatarPath,
  };
};

// Gửi mã OTP đặt lại mật khẩu qua email
const forgotPassword = async ({ email, ipAddress }) => {
  if (!email || !String(email).trim()) {
    throw new ServiceError('Email là bắt buộc.', 400);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = await NguoiDung.findOne({ where: { email: cleanEmail } });

  if (!user || user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
    return {
      success: true,
      message: 'Nếu email tồn tại và đang hoạt động trong hệ thống, mã OTP khôi phục mật khẩu đã được gửi.',
    };
  }

  const latestOtp = await XacThucOtp.findOne({
    where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password' },
    order: [['tao_luc', 'DESC']],
  });

  const COOLDOWN_SECONDS = 60;
  if (latestOtp && latestOtp.gui_luc) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(latestOtp.gui_luc).getTime()) / 1000);
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const waitSeconds = COOLDOWN_SECONDS - elapsedSeconds;
      throw new ServiceError(`Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã OTP mới.`, 429);
    }
  }

  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');

  await XacThucOtp.update(
    { da_su_dung: true },
    { where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password', da_su_dung: false } }
  );

  await XacThucOtp.create({
    nguoi_dung_id: user.id,
    loai_otp: 'forgot_password',
    ma_otp: hashedOtp,
    het_han_luc: new Date(Date.now() + 10 * 60 * 1000),
    so_lan_thu: 0,
    da_su_dung: false,
    gui_luc: new Date(),
  });

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
        <p>Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('[Email OTP Error]:', err.message);
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
    message: 'Nếu email tồn tại và đang hoạt động trong hệ thống, mã OTP khôi phục mật khẩu đã được gửi.',
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

  const user = await NguoiDung.scope('withPassword').findOne({ where: { email: cleanEmail } });
  if (!user) {
    throw new ServiceError('Email hoặc mã OTP không hợp lệ.', 400);
  }

  const otpDoc = await XacThucOtp.findOne({
    where: { nguoi_dung_id: user.id, loai_otp: 'forgot_password', da_su_dung: false },
    order: [['tao_luc', 'DESC']],
  });

  if (!otpDoc) {
    throw new ServiceError('Không có yêu cầu đặt lại mật khẩu nào đang chờ xử lý.', 400);
  }

  const MAX_ATTEMPTS = 5;
  if ((otpDoc.so_lan_thu || 0) >= MAX_ATTEMPTS) {
    otpDoc.da_su_dung = true;
    await otpDoc.save();
    throw new ServiceError('Bạn đã nhập sai mã OTP quá 5 lần. Mã xác thực đã bị vô hiệu hóa vì lý do an toàn. Vui lòng yêu cầu mã mới.', 400);
  }

  if (!otpDoc.het_han_luc || new Date() > new Date(otpDoc.het_han_luc)) {
    otpDoc.da_su_dung = true;
    await otpDoc.save();
    throw new ServiceError('Mã OTP đã hết hạn sử dụng (quá 10 phút). Vui lòng yêu cầu mã mới.', 400);
  }

  const hashedInputOtp = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (hashedInputOtp !== otpDoc.ma_otp) {
    otpDoc.so_lan_thu = (otpDoc.so_lan_thu || 0) + 1;
    await otpDoc.save();
    const remaining = MAX_ATTEMPTS - otpDoc.so_lan_thu;
    throw new ServiceError(`Mã OTP không chính xác. Bạn còn ${remaining} lần thử trước khi mã bị khóa.`, 400);
  }

  const salt = await bcrypt.genSalt(10);
  user.mat_khau_ma_hoa = await bcrypt.hash(newPassword, salt);
  user.doi_mat_khau_luc = new Date();
  user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  await user.save();

  otpDoc.da_su_dung = true;
  await otpDoc.save();

  await MaLamMoi.update(
    { da_su_dung: true, thoi_diem_su_dung: new Date() },
    { where: { nguoi_dung_id: user.id, da_su_dung: false } }
  );

  await revokeUserGraceTokens(user.id);

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: user.id,
    loai_chu_the: 'user',
    hanh_dong: 'PASSWORD_RESET_SUCCESS',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip: ipAddress || null,
    chi_tiet: { email: user.email },
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
};
