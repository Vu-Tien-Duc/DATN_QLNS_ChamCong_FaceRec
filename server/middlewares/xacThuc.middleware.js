// Xác thực JWT / Terminal Key và kiểm tra phân quyền RBAC theo vai trò hoặc quyền chi tiết
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isTokenRevokedAsync } = require('../utils/thuHoiToken');
const { NguoiDung, VaiTroNguoiDung } = require('../models');
const { ROLE_PERMISSIONS, getEffectivePermissions } = require('../config/permissions');
const { sendError } = require('../utils/phanHoiHttp');

// Xác thực JWT Bearer token, kiểm tra thu hồi và nạp thông tin người dùng vào req.user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || null;

    if (!authHeader) {
      return sendError(res, 'Truy cập bị từ chối. Token không tồn tại.', null, 401);
    }

    const tokenMatch = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
    const token = tokenMatch?.[1];
    if (!token) {
      return sendError(res, 'Truy cập bị từ chối. Định dạng token không hợp lệ.', null, 401);
    }

    const jwtSecret = process.env.JWT_SECRET || 'secret-jwt-fallback-key';

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token đã hết hạn. Vui lòng làm mới token hoặc đăng nhập lại.', null, 401);
      }
      return sendError(res, 'Token không hợp lệ hoặc đã bị giả mạo.', null, 401);
    }

    // Kiểm tra thu hồi In-Memory & Redis
    if (await isTokenRevokedAsync(token)) {
      return sendError(res, 'Token đã bị vô hiệu hóa do đăng xuất. Vui lòng đăng nhập lại.', null, 401);
    }

    const user = await NguoiDung.findByPk(decoded.id || decoded.userId, {
      attributes: [
        'id',
        'vai_tro_chinh',
        'don_vi_chinh_id',
        'kich_hoat',
        'trang_thai_lam_viec',
        'doi_mat_khau_luc',
        'phien_ban_token',
        'ho_ten',
        'email',
        'ma_can_bo',
        'anh_dai_dien',
      ],
      include: [
        {
          model: VaiTroNguoiDung,
          as: 'danh_sach_vai_tro',
          attributes: ['id', 'ma_vai_tro', 'pham_vi', 'don_vi_id', 'duoc_uy_quyen', 'tu_ngay', 'den_ngay'],
        },
      ],
    });

    if (!user) {
      return sendError(res, 'Người dùng không tồn tại trên hệ thống.', null, 401);
    }

    if (user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa hoặc đã nghỉ việc.', null, 403);
    }

    const userTokenVersion = user.phien_ban_token || 0;
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion < userTokenVersion) {
      return sendError(
        res,
        'Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất. Vui lòng đăng nhập lại.',
        null,
        401,
        'SESSION_REVOKED'
      );
    }

    const passwordChangedAt = user.doi_mat_khau_luc;
    if (passwordChangedAt) {
      const changedTimestamp = Math.floor(new Date(passwordChangedAt).getTime() / 1000);
      if (decoded.iat && decoded.iat < changedTimestamp) {
        return sendError(
          res,
          'Mật khẩu đã được thay đổi gần đây. Vui lòng đăng nhập lại.',
          null,
          401,
          'PASSWORD_CHANGED'
        );
      }
    }

    // Gán các trường tương thích ngược để bảo vệ tất cả router
    user._id = user.id;
    user.role = normalizeRole(user.vai_tro_chinh);
    user.primaryRole = user.role;
    user.departmentId = user.don_vi_chinh_id;
    user.fullName = user.ho_ten;
    user.staffCode = user.ma_can_bo;
    user.avatar = user.anh_dai_dien;
    user.isActive = user.kich_hoat;
    user.roles = user.danh_sach_vai_tro;

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return sendError(res, 'Lỗi hệ thống khi xác thực token: ' + error.message, null, 500);
  }
};

const { normalizeRole } = require('../utils/vaiTro.utils');

// Chuẩn hóa tên vai trò về chữ thường snake_case
const normalizeRoleKey = (r) => {
  return normalizeRole(r);
};

// Kiểm tra vai trò phụ có đang trong thời hạn hiệu lực (tu_ngay <= hôm nay <= den_ngay)
const isRoleEntryActive = (entry, todayKey) => {
  if (!entry || typeof entry !== 'object') return false;
  const start = entry.tu_ngay || entry.startDate;
  const expiry = entry.den_ngay || entry.endDate;
  if (start && String(start).slice(0, 10) > todayKey) return false;
  if (expiry && String(expiry).slice(0, 10) < todayKey) return false;
  return true;
};

// Tập hợp tất cả vai trò đang hiệu lực của người dùng (vai trò chính + vai trò phụ)
const getActiveRoles = (user) => {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const roles = new Set();

  const addNorm = (r) => {
    const canonical = normalizeRoleKey(r);
    if (canonical) roles.add(canonical);
  };

  addNorm(user.role);
  addNorm(user.primaryRole);
  addNorm(user.vai_tro_chinh);

  const roleCollections = [user.roles, user.danh_sach_vai_tro].filter(Array.isArray);
  for (const list of roleCollections) {
    for (const v of list) {
      if (!v) continue;
      const roleName = typeof v === 'string' ? v : v.ma_vai_tro || v.role || '';
      if (!roleName) continue;
      if (typeof v === 'object' && !isRoleEntryActive(v, todayKey)) {
        continue;
      }
      addNorm(roleName);
    }
  }

  return roles;
};

// Tổng hợp tập quyền chi tiết của người dùng
const getUserPermissions = (user) => {
  const permissions = getEffectivePermissions(user);
  const activeRoles = getActiveRoles(user);

  for (const role of activeRoles) {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    for (const p of rolePerms) {
      permissions.add(p);
    }
  }

  return permissions;
};

// Chỉ cho phép nếu người dùng giữ ít nhất 1 vai trò trong danh sách
const verifyRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
    }

    const rolesToCheck = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRoleKey);
    const userRoles = getActiveRoles(req.user);

    const hasRole = rolesToCheck.some((r) => userRoles.has(r));

    if (!hasRole) {
      return sendError(
        res,
        'Bạn không có quyền truy cập chức năng này.',
        null,
        403,
        'FORBIDDEN_ROLE'
      );
    }

    return next();
  };
};

// Alias cho verifyRole, nhận danh sách vai trò dạng tham số rời
const authorizeRoles = (...roles) => verifyRole(roles.flat());

// Kiểm tra người dùng có một quyền cụ thể hay không
const userHasPerm = (user, perm) => {
  if (typeof user.hasPermission === 'function') {
    return user.hasPermission(perm);
  }
  const userPerms = getUserPermissions(user);
  return userPerms.has(perm);
};

// Kiểm tra đủ 1 quyền RBAC cụ thể
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
    }

    if (!userHasPerm(req.user, permission)) {
      return sendError(
        res,
        `Bạn không có quyền thực hiện chức năng này. Yêu cầu quyền: ${permission}`,
        null,
        403,
        'PERMISSION_DENIED'
      );
    }

    return next();
  };
};

// Kiểm tra có ít nhất 1 quyền trong danh sách
const requireAnyPermission = (...permissions) => {
  const permList = permissions.flat();
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
    }

    const hasAny = permList.some((p) => userHasPerm(req.user, p));

    if (!hasAny) {
      return sendError(
        res,
        `Bạn không có quyền truy cập chức năng này. Cần một trong các quyền: ${permList.join(', ')}`,
        null,
        403,
        'PERMISSION_DENIED'
      );
    }

    return next();
  };
};

// Kiểm tra có đầy đủ tất cả quyền trong danh sách
const requireAllPermissions = (...permissions) => {
  const permList = permissions.flat();
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
    }

    const hasAll = permList.every((p) => userHasPerm(req.user, p));

    if (!hasAll) {
      return sendError(
        res,
        `Bạn không đủ các quyền thực hiện chức năng này. Yêu cầu: ${permList.join(', ')}`,
        null,
        403,
        'PERMISSION_DENIED'
      );
    }

    return next();
  };
};

// Xác thực trạm camera/kiosk (ưu tiên Bearer Token, fallback sang x-terminal-key)
const verifyTerminalKey = async (req, res, next) => {
  if (req.headers.authorization) {
    return verifyToken(req, res, next);
  }

  const terminalKey = req.headers['x-terminal-key'];
  const validKey = process.env.TERMINAL_KEY;

  if (validKey && terminalKey) {
    const suppliedKey = Buffer.from(terminalKey);
    const configuredKey = Buffer.from(validKey);
    if (
      suppliedKey.length === configuredKey.length &&
      crypto.timingSafeEqual(suppliedKey, configuredKey)
    ) {
      return next();
    }
  }

  return sendError(res, 'Yêu cầu đăng nhập hoặc quyền truy cập máy chấm công camera.', null, 401);
};

module.exports = {
  verifyToken,
  verifyRole,
  authorizeRoles,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  verifyTerminalKey,
  getActiveRoles,
  getUserPermissions,
};
