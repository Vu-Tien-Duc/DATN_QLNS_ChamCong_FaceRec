/**
 * Auth & RBAC Middleware (server/middlewares/auth.middleware.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Xác thực JWT Access Token, thu hồi token in-memory, kiểm tra phien_ban_token.
 * - Phân quyền theo 10 chức danh đại học chuẩn (Admin, BGH, Trưởng khoa, GV, CV,...).
 * - Hỗ trợ nhiệm kỳ công tác (tự động tước quyền khi vai trò hết hạn).
 * - Hạt nhân phân quyền chi tiết (requirePermission, requireAnyPermission, requireAllPermissions).
 * - Xác thực trạm camera điểm danh (verifyTerminalKey).
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isTokenRevoked } = require('../utils/tokenRevocation');
const User = require('../models/user.model');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { sendError } = require('../utils/responseHandler');

/**
 * 1. Middleware xác thực JWT Access Token & Trạng thái tài khoản
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

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

    // Kiểm tra thu hồi In-Memory
    if (isTokenRevoked(token)) {
      return sendError(res, 'Token đã bị vô hiệu hóa do đăng xuất. Vui lòng đăng nhập lại.', null, 401);
    }

    const user = await User.findById(decoded.id || decoded.userId).select(
      'role vai_tro departmentId ma_don_vi isActive trang_thai passwordChangedAt phien_ban_token danh_sach_vai_tro vai_tro_chinh don_vi_chinh_id fullName ho_ten email'
    );

    if (!user) {
      return sendError(res, 'Người dùng không tồn tại trên hệ thống.', null, 401);
    }

    if (user.isActive === false || user.trang_thai === 'KHOA') {
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa.', null, 403);
    }

    // Kiểm tra thu hồi phiên đăng nhập hàng loạt qua phien_ban_token
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

    // Kiểm tra thời điểm đổi mật khẩu gần nhất
    if (user.passwordChangedAt) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
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

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return sendError(res, 'Lỗi hệ thống khi xác thực token: ' + error.message, null, 500);
  }
};

/**
 * Trợ thủ: Lấy toàn bộ danh sách vai trò đang còn hiệu lực của người dùng
 */
const getActiveRoles = (user) => {
  const now = new Date();
  const roles = new Set();

  const primaryRole = user.role || user.vai_tro || user.vai_tro_chinh;
  if (primaryRole) roles.add(primaryRole.toLowerCase());

  if (Array.isArray(user.danh_sach_vai_tro)) {
    for (const v of user.danh_sach_vai_tro) {
      if (!v) continue;
      const roleName = (typeof v === 'string' ? v : v.vai_tro || v.role || '').toLowerCase();
      if (!roleName) continue;

      if (v.nhiem_ky_den && new Date(v.nhiem_ky_den) < now) {
        continue; // Bỏ qua vai trò đã hết nhiệm kỳ công tác
      }
      roles.add(roleName);
    }
  }

  return roles;
};

/**
 * Trợ thủ: Tập hợp toàn bộ quyền hạn (permissions) hợp lệ của người dùng
 */
const getUserPermissions = (user) => {
  const activeRoles = getActiveRoles(user);
  const permissions = new Set();

  for (const role of activeRoles) {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    for (const p of rolePerms) {
      permissions.add(p);
    }
  }

  return permissions;
};

/**
 * 2. Phân quyền theo vai trò (Role-based)
 */
const verifyRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Người dùng chưa được xác thực.', null, 401);
    }

    const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const normalizedAllowed = rolesToCheck.map((r) => String(r).toLowerCase());

    const userRoles = getActiveRoles(req.user);
    const hasRole = normalizedAllowed.some((r) => userRoles.has(r));

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

const authorizeRoles = (...roles) => verifyRole(roles.flat());

const userHasPerm = (user, perm) => {
  if (typeof user.hasPermission === 'function') {
    return user.hasPermission(perm);
  }
  const userPerms = getUserPermissions(user);
  return userPerms.has(perm);
};

/**
 * 3. Hạt nhân phân quyền RBAC: Yêu cầu 1 quyền cụ thể
 */
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

/**
 * 4. Hạt nhân phân quyền RBAC: Yêu cầu ít nhất 1 trong danh sách quyền
 */
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

/**
 * 5. Hạt nhân phân quyền RBAC: Yêu cầu tất cả quyền trong danh sách
 */
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

/**
 * 6. Xác thực trạm camera điểm danh (Ưu tiên Bearer Token, fallback Terminal Key)
 */
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
