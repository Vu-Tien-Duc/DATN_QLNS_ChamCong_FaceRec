/**
 * Cấu Hình & Quản Lý Realtime WebSockets (Socket.IO)
 * 
 * Kiến trúc Realtime chuẩn CSDL v2.5:
 * 1. Xác thực bảo mật: Handshake Authentication với JWT Token qua auth.token hoặc Authorization header.
 * 2. Phân chia Room theo phân quyền RBAC:
 *    - `admin-room`: Quản trị viên nhận thông báo toàn trường (lượt quẹt, cảnh báo gian lận, biến động hàng đợi).
 *    - `dept:{departmentId}`: Trưởng khoa nhận thông báo của cán bộ thuộc khoa mình (DeanScope).
 *    - `user:{userId}`: Giảng viên/Nhân viên nhận thông báo duyệt đơn, trạng thái điểm danh cá nhân.
 * 3. Event Emitters hỗ trợ Fast UI Update (< 100ms):
 *    - `attendance:new-punch`: Lượt quẹt chấm công mới (Face AI / QR / GPS).
 *    - `attendance:update`: Cập nhật log điểm danh (Check-out hoặc Admin Override).
 *    - `security:fraud-alert`: Cảnh báo tức thì khi phát hiện Fake GPS, giả mạo sinh trắc học hoặc sai ca.
 *    - `leave:status-changed`: Cập nhật trạng thái đơn xin nghỉ phép / dạy bù realtime.
 *    - `queue:stats-update`: Cập nhật chỉ số tải của Hàng đợi BullMQ giờ cao điểm.
 * 4. Error-Resilient & Zero-Crash: Tự động bỏ qua an toàn nếu Socket.IO chưa khởi tạo.
 */

const { Server } = require('socket.io');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let io = null;

const getJwtSecret = () => process.env.JWT_SECRET || 'secret-jwt-fallback-key';

/**
 * 1. Khởi tạo Socket.IO Server gắn với HTTP Server
 * @param {import('http').Server} httpServer Máy chủ HTTP Node.js
 * @param {object} customOptions Tùy chỉnh CORS hoặc adapter
 */
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

  // Middleware xác thực bảo mật kết nối WebSocket
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const token = socket.handshake.auth?.token || socket.handshake.query?.token || bearerToken;

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

        // Cho phép kết nối ẩn danh ở môi trường test nếu không có token
        if (process.env.NODE_ENV === 'test') {
          socket.user = { id: 'GUEST_TEST', role: 'guest' };
          return next();
        }

        return next(new Error('AUTHENTICATION_ERROR: Thiếu JWT Token xác thực kết nối WebSocket.'));
      }

      // Xác minh chữ ký JWT
      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = {
        id: decoded.id || decoded.userId || decoded._id || decoded.nguoi_dung_id,
        role: decoded.vai_tro_chinh || decoded.role || (Array.isArray(decoded.danh_sach_vai_tro) ? decoded.danh_sach_vai_tro[0] : (Array.isArray(decoded.roles) ? decoded.roles[0] : 'nhan_vien')),
        departmentId: decoded.don_vi_chinh_id || decoded.departmentId || null,
        email: decoded.email,
        fullName: decoded.ho_ten || decoded.fullName,
      };

      return next();
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Socket Handshake Auth Warning]:', err.message);
      }
      if (process.env.NODE_ENV === 'test') {
        socket.user = { id: 'GUEST_TEST', role: 'guest' };
        return next();
      }
      return next(new Error(`AUTHENTICATION_ERROR: Token không hợp lệ hoặc đã hết hạn (${err.message}).`));
    }
  });

  // Xử lý các sự kiện kết nối của Client
  io.on('connection', (socket) => {
    const user = socket.user || {};
    const userId = user.id ? user.id.toString() : socket.id;

    // 1. Tự động gia nhập Room cá nhân
    socket.join(`user:${userId}`);

    // 2. Nếu là Admin hoặc BGH: Gia nhập admin-room để giám sát toàn trường
    if (user.role === 'admin' || user.role === 'bgh') {
      socket.join('admin-room');
    }

    // 3. Nếu là Trưởng khoa: Gia nhập Room của Khoa (DeanScope)
    if (user.departmentId) {
      socket.join(`dept:${user.departmentId.toString()}`);
    }

    // Cho phép client gửi yêu cầu gia nhập room bổ sung (kiểm tra quyền RBAC để chống IDOR)
    socket.on('room:join', (roomName) => {
      if (typeof roomName !== 'string' || roomName.length === 0) return;
      const isGlobalAdmin = ['admin', 'bgh', 'tccb', 'kiem_toan'].includes(String(user.role || '').toLowerCase());
      if (roomName === 'admin-room') {
        if (isGlobalAdmin) socket.join(roomName);
        return;
      }
      if (roomName.startsWith('dept:')) {
        const targetDept = roomName.slice(5);
        if (isGlobalAdmin || (user.departmentId && String(user.departmentId) === targetDept)) {
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

    // Phản hồi ping kiểm tra độ trễ mạng
    socket.on('ping:check', (callback) => {
      if (typeof callback === 'function') {
        callback({ status: 'PONG', serverTime: Date.now() });
      }
    });

    socket.on('disconnect', (reason) => {
      // Ngắt kết nối socket an toàn
    });
  });

  return io;
};

/**
 * 2. Lấy đối tượng Socket Server
 */
const getIO = () => io;

/**
 * 3. Phát sự kiện Lượt quẹt điểm danh mới (Fast Realtime Broadcast < 100ms)
 * @param {object} punchData Thông tin lượt điểm danh
 */
const emitNewPunch = (punchData) => {
  if (!io) return false;

  try {
    const userId = punchData.nguoi_dung_id || punchData.userId;
    const departmentId = punchData.don_vi_chinh_id || punchData.departmentId;
    const payload = {
      event: 'NEW_PUNCH',
      punchId: punchData._id || punchData.punchId || punchData.id,
      userId,
      userName: punchData.ho_ten || punchData.userName || punchData.fullName,
      staffCode: punchData.ma_can_bo || punchData.staffCode,
      avatar: punchData.anh_dai_dien || punchData.avatar,
      departmentId,
      departmentName: punchData.ten_phong_ban || punchData.departmentName,
      punchType: punchData.loai_quet || punchData.punchType || 'check_in',
      method: punchData.phuong_thuc || punchData.method || 'face_ai',
      punchTime: punchData.thoi_gian_quet || punchData.punchTime || new Date(),
      status: punchData.trang_thai || punchData.status,
      confidenceScore: punchData.do_chinh_xac || punchData.confidenceScore,
      isFraud: Boolean(punchData.co_gian_lan !== undefined ? punchData.co_gian_lan : punchData.isFraud),
      fraudReason: punchData.ly_do_gian_lan || punchData.fraudReason,
      evidenceUrl: punchData.anh_minh_chung || punchData.evidenceUrl || punchData.evidenceImage,
      timestamp: Date.now(),
    };

    // 1. Bắn trực tiếp lên Admin Dashboard toàn trường
    io.to('admin-room').emit('attendance:new-punch', payload);

    // 2. Bắn cho Trưởng khoa tương ứng (DeanScope)
    if (departmentId) {
      io.to(`dept:${departmentId.toString()}`).emit('attendance:new-punch', payload);
    }

    // 3. Bắn cho chính cán bộ đó
    if (userId) {
      io.to(`user:${userId.toString()}`).emit('attendance:new-punch', payload);
    }

    // 4. Nếu có dấu hiệu gian lận: Phát ngay cảnh báo bảo mật tức thì
    if (payload.isFraud) {
      emitFraudAlert({
        type: 'ATTENDANCE_FRAUD',
        severity: 'HIGH',
        message: `Phát hiện nghi vấn điểm danh bất thường: ${payload.userName} (${payload.fraudReason || 'Sai vị trí Geofence'})`,
        details: payload,
      });
    }

    return true;
  } catch (err) {
    console.error('[Socket.IO emitNewPunch Error]:', err.message);
    return false;
  }
};

/**
 * 4. Phát sự kiện Cập nhật Log Chấm công (Check-out hoặc Admin Override)
 * @param {object} attendanceData Dữ liệu log chấm công
 */
const emitAttendanceUpdate = (attendanceData) => {
  if (!io) return false;

  try {
    const userId = attendanceData.nguoi_dung_id || attendanceData.userId;
    const departmentId = attendanceData.don_vi_chinh_id || attendanceData.departmentId;
    const payload = {
      event: 'ATTENDANCE_UPDATE',
      logId: attendanceData._id || attendanceData.id,
      userId,
      checkInTime: attendanceData.thoi_gian_check_in || attendanceData.checkInTime,
      checkOutTime: attendanceData.thoi_gian_check_out || attendanceData.checkOutTime,
      status: attendanceData.trang_thai || attendanceData.status,
      isManualOverride: Boolean(attendanceData.chinh_sua_thu_cong !== undefined ? attendanceData.chinh_sua_thu_cong : attendanceData.isManualOverride),
      updatedAt: new Date(),
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

/**
 * 5. Phát Cảnh Báo Gian Lận & An Ninh Sinh Trắc Học Tức Thì
 * @param {object} alertData Dữ liệu cảnh báo
 */
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

    // Gửi cảnh báo đỏ tới tất cả Quản trị viên
    io.to('admin-room').emit('security:fraud-alert', payload);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * 6. Phát sự kiện Cập nhật Đơn từ (Phê duyệt / Từ chối / Tạo mới)
 * @param {object} leaveData Thông tin đơn từ
 */
const emitLeaveRequestUpdate = (leaveData) => {
  if (!io) return false;

  try {
    const userId = leaveData.nguoi_dung_id || leaveData.userId;
    const departmentId = leaveData.don_vi_id || leaveData.don_vi_chinh_id || leaveData.departmentId;
    const payload = {
      event: 'LEAVE_REQUEST_UPDATE',
      requestId: leaveData._id || leaveData.id,
      userId,
      applicantName: leaveData.ho_ten_nguoi_tao || leaveData.applicantName,
      requestType: leaveData.loai_don || leaveData.type || leaveData.requestType,
      status: leaveData.trang_thai || leaveData.status,
      approverId: leaveData.nguoi_duyet_id || leaveData.approverId,
      updatedAt: new Date(),
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

/**
 * 7. Phát sự kiện Biến động Hàng đợi BullMQ Giờ Cao Điểm
 * @param {object} queueStats Thống kê jobs
 */
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

/**
 * 8. Đóng kết nối Socket.IO Server khi Shutdown hoặc Reset Test
 */
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
  closeSocketServer,
};
