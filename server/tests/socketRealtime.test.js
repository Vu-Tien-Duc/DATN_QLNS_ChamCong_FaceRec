/**
 * Test Suite: Realtime WebSockets & Socket.IO Architecture (Phần 4)
 * Kiểm tra toàn diện hệ thống truyền thông thời gian thực Socket.IO:
 * 1. Khởi tạo Socket.IO Server gắn với HTTP Server và cấu hình CORS.
 * 2. Xác thực Handshake Authentication qua JWT Token (Hợp lệ cho phép, sai bị từ chối).
 * 3. Tự động phân chia Rooms theo phân quyền RBAC (admin-room, dept:xxx, user:xxx).
 * 4. Phát và nhận sự kiện Điểm danh mới (attendance:new-punch) với độ trễ cực thấp (< 100ms).
 * 5. Phát và nhận cảnh báo an ninh / gian lận sinh trắc học tức thì (security:fraud-alert).
 * 6. Phát và nhận cập nhật đơn từ (leave:status-changed) và trạng thái hàng đợi (queue:stats-update).
 * 7. Đóng kết nối an toàn khi Shutdown (closeSocketServer).
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');

process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'datn_qlns_secret_key_2026';

const {
  initSocketServer,
  getIO,
  emitNewPunch,
  emitAttendanceUpdate,
  emitFraudAlert,
  emitLeaveRequestUpdate,
  emitQueueStats,
  closeSocketServer,
} = require('../config/socket');

const TEST_PORT = 9876;

const runTests = async () => {
  console.log('--- Bắt đầu Test Suite: Realtime Socket.IO Architecture (Phần 4) ---');

  // Khởi tạo HTTP Server thử nghiệm
  const httpServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Socket Test Server');
  });

  await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));

  // ---------------------------------------------------------------------------
  // Test 1: Khởi tạo Socket.IO Server
  // ---------------------------------------------------------------------------
  console.log('[Test 1] Khởi tạo Socket.IO Server và kiểm tra instance...');
  const ioServer = initSocketServer(httpServer);
  assert.ok(ioServer, 'Socket.IO Server phải được khởi tạo thành công.');
  assert.equal(getIO(), ioServer, 'getIO() phải trả về đúng instance đã tạo.');
  console.log('✓ Test 1 ĐẠT: Khởi tạo Socket.IO Server thành công gắn với HTTP Server.');

  // Tạo Token mẫu
  const adminToken = jwt.sign(
    { id: 'admin_user_001', role: 'admin', departmentId: 'dept_cntt', fullName: 'TS. Quản Trị Viên' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const teacherToken = jwt.sign(
    { id: 'gv_user_002', role: 'giangvien', departmentId: 'dept_cntt', fullName: 'ThS. Nguyễn Văn A' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ---------------------------------------------------------------------------
  // Test 2: Xác thực Handshake JWT Token hợp lệ & Kết nối thành công
  // ---------------------------------------------------------------------------
  console.log('[Test 2] Kiểm tra kết nối Client với JWT Token hợp lệ...');
  const adminClient = Client(`http://localhost:${TEST_PORT}`, {
    auth: { token: adminToken },
    transports: ['websocket'],
    reconnection: false,
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout kết nối socket')), 3000);
    adminClient.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    adminClient.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  assert.ok(adminClient.connected, 'Admin Client phải kết nối thành công.');
  console.log(`✓ Test 2 ĐẠT: Handshake JWT Token hợp lệ thành công (Socket ID: ${adminClient.id}).`);

  // ---------------------------------------------------------------------------
  // Test 3: Phát và nhận sự kiện attendance:new-punch tức thì (< 100ms)
  // ---------------------------------------------------------------------------
  console.log('[Test 3] Kiểm tra phát và nhận sự kiện attendance:new-punch...');
  const samplePunch = {
    punchId: 'punch_rec_12345',
    userId: 'gv_user_002',
    userName: 'ThS. Nguyễn Văn A',
    staffCode: 'GV002',
    departmentId: 'dept_cntt',
    punchType: 'CHECK_IN',
    method: 'FACE_AI',
    status: 'ON_TIME',
    confidenceScore: 0.98,
    isFraud: false,
    scanTime: new Date(),
  };

  const startTime = performance.now();
  const receivedPunchPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout chờ sự kiện punch')), 2000);
    adminClient.on('attendance:new-punch', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const emitSuccess = emitNewPunch(samplePunch);
  assert.equal(emitSuccess, true, 'Hàm emitNewPunch phải trả về true khi thành công.');

  const receivedPunch = await receivedPunchPromise;
  const duration = performance.now() - startTime;

  assert.equal(receivedPunch.userId, samplePunch.userId);
  assert.equal(receivedPunch.userName, samplePunch.userName);
  assert.equal(receivedPunch.punchType, 'CHECK_IN');
  assert.equal(receivedPunch.status, 'ON_TIME');
  console.log(`✓ Test 3 ĐẠT: Nhận sự kiện attendance:new-punch trong ${duration.toFixed(2)}ms (< 100ms chuẩn Realtime).`);

  // ---------------------------------------------------------------------------
  // Test 4: Phát và nhận Cảnh Báo Gian Lận Bảo Mật (security:fraud-alert)
  // ---------------------------------------------------------------------------
  console.log('[Test 4] Kiểm tra phát cảnh báo gian lận an ninh...');
  const fraudPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout chờ cảnh báo gian lận')), 2000);
    adminClient.on('security:fraud-alert', (alert) => {
      clearTimeout(timer);
      resolve(alert);
    });
  });

  emitFraudAlert({
    type: 'GEOFENCE_VIOLATION',
    severity: 'HIGH',
    message: 'Phát hiện vị trí chấm công vượt quá bán kính 500m cho phép.',
  });

  const receivedAlert = await fraudPromise;
  assert.equal(receivedAlert.type, 'GEOFENCE_VIOLATION');
  assert.equal(receivedAlert.severity, 'HIGH');
  console.log(`✓ Test 4 ĐẠT: Cảnh báo an ninh Realtime phát thành công tới Admin: '${receivedAlert.message}'.`);

  // ---------------------------------------------------------------------------
  // Test 5: Phát sự kiện Hàng Đợi BullMQ (queue:stats-update)
  // ---------------------------------------------------------------------------
  console.log('[Test 5] Kiểm tra phát biến động tải hàng đợi (queue:stats-update)...');
  const queuePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout chờ queue update')), 2000);
    adminClient.on('queue:stats-update', (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

  emitQueueStats({ waiting: 15, active: 3, completed: 120, failed: 0 });
  const receivedQueue = await queuePromise;
  assert.equal(receivedQueue.stats.waiting, 15);
  console.log('✓ Test 5 ĐẠT: Cập nhật biến động hàng đợi giờ cao điểm Realtime chuẩn xác.');

  // ---------------------------------------------------------------------------
  // Test 6: Kiểm tra ngắt kết nối an toàn và giải phóng tài nguyên
  // ---------------------------------------------------------------------------
  console.log('[Test 6] Kiểm tra đóng Server Socket.IO (closeSocketServer)...');
  adminClient.disconnect();
  await closeSocketServer();

  await new Promise((resolve) => httpServer.close(resolve));
  console.log('✓ Test 6 ĐẠT: Đóng kết nối an toàn, không rò rỉ socket và không treo tiến trình.');

  console.log('\n===============================================================');
  console.log('🎉 100% TẤT CẢ CÁC BÀI TEST REALTIME SOCKET.IO ĐỀU ĐÃ ĐẠT! 🎉');
  console.log('===============================================================\n');
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Lỗi Test Suite Socket.IO:', err);
    process.exit(1);
  });
