// Socket.IO Realtime: xác thực JWT/Terminal Key, chia room (admin-room, dept:{id}, user:{id}) và phát sự kiện tức thì

const { Server } = require('socket.io');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { NguoiDung, VaiTroNguoiDung } = require('../models');
const { isTokenRevokedAsync } = require('../utils/thuHoiToken');
const { isValidUuid } = require('../utils/hoTroSequelize');
const { UNIT_LEADER_ROLES, normalizeRole, getActiveUserRoles, hasAnyActiveRole } = require('../utils/vaiTro.utils');

let io = null;

// Lấy khóa bí mật để xác thực JWT cho kết nối Socket.IO
const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET chưa được cấu hình cho WebSocket Server.');
  }
  return process.env.JWT_SECRET;
};

// Khởi tạo Socket.IO gắn với HTTP Server và cấu hình xác thực kết nối
const initSocketServer = (httpServer, customOptions = {}) => {
  if (io) return io;

  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (process.env.NODE_ENV === 'production') {
          callback(new Error('Not allowed by Socket.IO CORS policy'), false);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    ...customOptions,
  });

  // Xác thực kết nối bằng JWT (đối soát blacklist, tokenVersion & trạng thái CSDL) hoặc mã thiết bị X-Terminal-Key
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      const token = socket.handshake.auth?.token || bearerToken;

      if (!token) {
        const providedTerminalKey =
          socket.handshake.headers?.['x-terminal-key'] || socket.handshake.auth?.terminalKey;
        const expectedTerminalKey = process.env.TERMINAL_KEY;
        if (expectedTerminalKey && providedTerminalKey) {
          const a = Buffer.from(String(providedTerminalKey));
          const b = Buffer.from(String(expectedTerminalKey));
          if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
            socket.user = { id: 'TERMINAL_DEVICE', role: 'terminal', isTerminal: true };
            return next();
          }
        }

        if (process.env.NODE_ENV === 'test' && socket.handshake.auth?.allowGuestInTest === true) {
          socket.user = { id: 'GUEST_TEST', role: 'guest' };
          return next();
        }

        return next(new Error('AUTHENTICATION_ERROR: Thiếu JWT Token xác thực kết nối WebSocket.'));
      }

      const decoded = jwt.verify(token, getJwtSecret());

      if (await isTokenRevokedAsync(token)) {
        return next(new Error('AUTHENTICATION_ERROR: Token đã bị vô hiệu hóa do đăng xuất.'));
      }

      const tokenUserId = decoded?.id;
      if (!isValidUuid(tokenUserId)) {
        return next(new Error('AUTHENTICATION_ERROR: Định danh người dùng trong token không hợp lệ.'));
      }

      const user = await NguoiDung.findByPk(tokenUserId, {
        attributes: [
          'id',
          'vai_tro_chinh',
          'don_vi_chinh_id',
          'kich_hoat',
          'trang_thai_lam_viec',
          'phien_ban_token',
          'doi_mat_khau_luc',
          'ho_ten',
          'email',
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
        return next(new Error('AUTHENTICATION_ERROR: Người dùng không tồn tại trên hệ thống.'));
      }

      if (user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec') {
        return next(new Error('AUTHENTICATION_ERROR: Tài khoản đã bị vô hiệu hóa hoặc đã nghỉ việc.'));
      }

      const userTokenVersion = user.phien_ban_token || 1;
      if (typeof decoded.phien_ban_token !== 'number' || decoded.phien_ban_token < userTokenVersion) {
        return next(new Error('AUTHENTICATION_ERROR: Phiên đăng nhập đã bị thu hồi.'));
      }

      if (user.doi_mat_khau_luc) {
        const changedTimestamp = Math.floor(new Date(user.doi_mat_khau_luc).getTime() / 1000);
        if (decoded.iat && decoded.iat < changedTimestamp) {
          return next(new Error('AUTHENTICATION_ERROR: Mật khẩu đã thay đổi gần đây. Vui lòng đăng nhập lại.'));
        }
      }

      const activeRoles = Array.from(getActiveUserRoles(user));
      const primaryRole = normalizeRole(user.vai_tro_chinh) || activeRoles[0] || 'nhan_vien';
      socket.user = {
        id: user.id,
        vai_tro_chinh: primaryRole,
        danh_sach_vai_tro: user.danh_sach_vai_tro || [],
        don_vi_chinh_id: user.don_vi_chinh_id || null,
        email: user.email,
        ho_ten: user.ho_ten,
      };

      return next();
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Socket Handshake Auth Warning]:', err.message);
      }
      return next(new Error(`AUTHENTICATION_ERROR: Token không hợp lệ hoặc đã hết hạn (${err.message}).`));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user || {};
    const userId = user.id ? user.id.toString() : socket.id;
    const isAdminViewer = hasAnyActiveRole(user, ['admin', 'bgh', 'tccb']);
    const isDeptLeader = hasAnyActiveRole(user, UNIT_LEADER_ROLES);

    // Tự động đưa socket vào room cá nhân, room toàn trường (admin) và room đơn vị (lãnh đạo)
    socket.join(`user:${userId}`);

    if (isAdminViewer) {
      socket.join('admin-room');
    }

    if (user.don_vi_chinh_id && (isDeptLeader || isAdminViewer)) {
      socket.join(`dept:${user.don_vi_chinh_id.toString()}`);
    }

    // Cho client xin vào room bổ sung nhưng vẫn kiểm tra quyền để tránh IDOR
    socket.on('room:join', (roomName) => {
      if (typeof roomName !== 'string' || roomName.length === 0) return;
      if (roomName === 'admin-room') {
        if (isAdminViewer) socket.join(roomName);
        return;
      }
      if (roomName.startsWith('dept:')) {
        const targetDept = roomName.slice(5);
        if (isAdminViewer || (isDeptLeader && user.don_vi_chinh_id && String(user.don_vi_chinh_id) === targetDept)) {
          socket.join(roomName);
        }
        return;
      }
      if (roomName === `user:${userId}`) {
        socket.join(roomName);
      }
    });

    socket.on('room:leave', (roomName) => {
      if (typeof roomName === 'string' && roomName.length > 0) {
        socket.leave(roomName);
      }
    });

    socket.on('ping:check', (callback) => {
      if (typeof callback === 'function') {
        callback({ status: 'PONG', serverTime: Date.now() });
      }
    });

    socket.on('disconnect', (reason) => {});
  });

  return io;
};

// Lấy instance Socket.IO đang hoạt động
const getIO = () => io;

// Phát sự kiện lượt quẹt điểm danh mới tới admin, lãnh đạo đơn vị và nhân sự liên quan
const emitNewPunch = (punchData) => {
  if (!io) return false;

  try {
    const userId = punchData.nguoi_dung_id;
    const departmentId = punchData.don_vi_chinh_id;
    const payload = {
      event: 'NEW_PUNCH',
      id: punchData.id,
      nguoi_dung_id: userId,
      ho_ten: punchData.ho_ten,
      ma_can_bo: punchData.ma_can_bo,
      anh_dai_dien: punchData.anh_dai_dien,
      don_vi_chinh_id: departmentId,
      ten_phong_ban: punchData.ten_phong_ban,
      loai_quet: punchData.loai_quet || 'check_in',
      phuong_thuc: punchData.phuong_thuc || 'face_ai',
      thoi_gian_quet: punchData.thoi_gian_quet || new Date(),
      trang_thai: punchData.trang_thai,
      do_tin_cay_ai: punchData.do_tin_cay_ai,
      co_gian_lan: Boolean(punchData.co_gian_lan),
      ly_do_gian_lan: punchData.ly_do_gian_lan || null,
      anh_minh_chung: punchData.anh_minh_chung || null,
      thoi_diem: Date.now(),
    };

    io.to('admin-room').emit('attendance:new-punch', payload);

    if (departmentId) {
      io.to(`dept:${departmentId.toString()}`).emit('attendance:new-punch', payload);
    }

    if (userId) {
      io.to(`user:${userId.toString()}`).emit('attendance:new-punch', payload);
    }

    if (payload.co_gian_lan) {
      emitFraudAlert({
        type: 'ATTENDANCE_FRAUD',
        severity: 'HIGH',
        message: `Phát hiện nghi vấn điểm danh bất thường: ${payload.ho_ten || 'Cán bộ'} (${payload.ly_do_gian_lan || 'Sai vị trí Geofence'})`,
        details: payload,
      });
    }

    return true;
  } catch (err) {
    console.error('[Socket.IO emitNewPunch Error]:', err.message);
    return false;
  }
};

// Phát sự kiện cập nhật log chấm công (Check-out hoặc điều chỉnh thủ công)
const emitAttendanceUpdate = (attendanceData) => {
  if (!io) return false;

  try {
    const userId = attendanceData.nguoi_dung_id;
    const departmentId = attendanceData.don_vi_chinh_id;
    const payload = {
      event: 'ATTENDANCE_UPDATE',
      id: attendanceData.id,
      nguoi_dung_id: userId,
      don_vi_chinh_id: departmentId || null,
      thoi_gian_vao: attendanceData.thoi_gian_vao,
      thoi_gian_ra: attendanceData.thoi_gian_ra,
      trang_thai: attendanceData.trang_thai,
      chinh_sua_thu_cong: Boolean(attendanceData.chinh_sua_thu_cong),
      cap_nhat_luc: new Date(),
    };

    io.to('admin-room').emit('attendance:update', payload);

    if (departmentId) {
      io.to(`dept:${departmentId.toString()}`).emit('attendance:update', payload);
    }

    if (userId) {
      io.to(`user:${userId.toString()}`).emit('attendance:update', payload);
    }

    return true;
  } catch (err) {
    console.error('[Socket.IO emitAttendanceUpdate Error]:', err.message);
    return false;
  }
};

// Phát cảnh báo gian lận tới phòng quản trị (admin-room)
const emitFraudAlert = (alertData) => {
  if (!io) return false;

  try {
    const payload = {
      event: 'SECURITY_ALERT',
      type: alertData.type || 'BIOMETRIC_OR_GEOFENCE_FRAUD',
      severity: alertData.severity || 'CRITICAL',
      message: alertData.message || 'Cảnh báo vi phạm điểm danh!',
      details: alertData.details || {},
      createdAt: new Date(),
    };

    io.to('admin-room').emit('security:fraud-alert', payload);
    return true;
  } catch (err) {
    return false;
  }
};

// Phát sự kiện thay đổi trạng thái đơn nghỉ phép / dạy bù / đổi ca
const emitLeaveRequestUpdate = (leaveData) => {
  if (!io) return false;

  try {
    const userId = leaveData.nguoi_dung_id;
    const departmentId = leaveData.don_vi_chinh_id;
    const payload = {
      event: 'LEAVE_REQUEST_UPDATE',
      id: leaveData.id,
      nguoi_dung_id: userId,
      ho_ten_nguoi_tao: leaveData.ho_ten_nguoi_tao,
      loai_don: leaveData.loai_don,
      trang_thai: leaveData.trang_thai,
      nguoi_duyet_id: leaveData.nguoi_duyet_id,
      cap_nhat_luc: new Date(),
    };

    io.to('admin-room').emit('leave:status-changed', payload);

    if (departmentId) {
      io.to(`dept:${departmentId.toString()}`).emit('leave:status-changed', payload);
    }

    if (userId) {
      io.to(`user:${userId.toString()}`).emit('leave:status-changed', payload);
    }

    return true;
  } catch (err) {
    return false;
  }
};

// Phát thống kê tải hàng đợi chấm công BullMQ tới admin-room
const emitQueueStats = (queueStats) => {
  if (!io) return false;

  try {
    io.to('admin-room').emit('queue:stats-update', {
      event: 'QUEUE_STATS',
      stats: queueStats,
      timestamp: Date.now(),
    });
    return true;
  } catch (err) {
    return false;
  }
};

// Ngắt toàn bộ kết nối WebSocket đang mở của một người dùng (khi đăng xuất / đổi mật khẩu / khóa tài khoản)
const disconnectUserSockets = (userId) => {
  if (!io || !userId || typeof io.in !== 'function') return 0;
  try {
    io.in(`user:${String(userId)}`).disconnectSockets(true);
    return 1;
  } catch (_) {
    return 0;
  }
};

// Đóng kết nối WebSocket khi tắt máy chủ
const closeSocketServer = async () => {
  if (io) {
    try {
      await new Promise((resolve) => {
        io.close(() => resolve());
      });
    } catch (_) {}
    io = null;
  }
};

module.exports = {
  initSocketServer,
  getIO,
  emitNewPunch,
  emitAttendanceUpdate,
  emitFraudAlert,
  emitLeaveRequestUpdate,
  emitQueueStats,
  disconnectUserSockets,
  closeSocketServer,
};
