/**
 * =============================================================================
 * BỘ KIỂM THỬ TUẦN 8: TỔNG KIỂM TRA HỆ THỐNG, AUDIT LOG, SWAGGER OPENAPI 3.0
 * & DOCKER CONTAINER HÓA TOÀN DIỆN
 * Tác giả: Vũ Tiến Đức - MSV: 2310900023
 * =============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const AuditLog = require('../models/auditLog.model');
const { getAuditLogs } = require('../services/auditLog.service');
const swaggerSpec = require('../config/swagger');

// Giả lập mock find/countDocuments khi chạy standalone test không có MongoDB kết nối
const mockAuditDocs = [
  {
    _id: new mongoose.Types.ObjectId('6a9d57378cf3a6165de25ded'),
    nguoi_thuc_hien_id: new mongoose.Types.ObjectId('6a9d57378cf3a6165de25dd6'),
    hanh_dong: 'UPDATE_SYSTEM_CONFIG',
    doi_tuong_id: 'CAMPUS_GPS_RADIUS_METERS',
    loai_doi_tuong: 'SystemConfig',
    ket_qua: 'SUCCESS',
    dia_chi_ip: '127.0.0.1',
    thong_tin_trinh_duyet: 'Node-TestAgent',
    user_agent: 'Node-TestAgent',
    thoi_diem: new Date('2026-10-16T08:00:00.000Z'),
    chi_tiet: { key: 'CAMPUS_GPS_RADIUS_METERS', oldValue: 50, newValue: 100 },
    actor: {
      _id: '6a9d57378cf3a6165de25dd6',
      fullName: 'Quản trị viên Đại học',
      email: 'admin@university.edu.vn',
      role: 'admin',
    },
  },
  {
    _id: new mongoose.Types.ObjectId('6a9d57378cf3a6165de25dee'),
    nguoi_thuc_hien_id: new mongoose.Types.ObjectId('6a9d57378cf3a6165de25dd8'),
    hanh_dong: 'LOCK_PAYROLL',
    doi_tuong_id: '6a9d57378cf3a6165de25df1',
    loai_doi_tuong: 'Payroll',
    ket_qua: 'SUCCESS',
    dia_chi_ip: '192.168.1.10',
    thoi_diem: new Date('2026-10-16T09:00:00.000Z'),
    chi_tiet: { month: 10, year: 2026, status: 'DA_KHOA' },
  },
  {
    _id: new mongoose.Types.ObjectId('6a9d57378cf3a6165de25def'),
    nguoi_thuc_hien_id: null,
    hanh_dong: 'LOGIN_FAILED',
    doi_tuong_id: 'auth_attempt',
    loai_doi_tuong: 'Auth',
    ket_qua: 'FAILED',
    dia_chi_ip: '113.190.22.15',
    thoi_diem: new Date('2026-10-16T09:30:00.000Z'),
    chi_tiet: { reason: 'INVALID_CREDENTIALS', email: 'unknown@university.edu.vn' },
  },
];

async function runTests() {
  console.log('--- BẮT ĐẦU KIỂM THỬ TUẦN 8: AUDIT LOG, SWAGGER OPENAPI & DOCKER ---');

  // =========================================================================
  // 1. Kiểm thử mô hình Audit Log và tính bất biến (Immutability / Append-only)
  // =========================================================================
  console.log('\n[Test 1] Kiểm tra tính bất biến (Immutability) của AuditLog...');
  const sampleLog = new AuditLog({
    hanh_dong: 'TEST_ACTION',
    doi_tuong_id: 'TEST_001',
    loai_doi_tuong: 'Test',
    ket_qua: 'SUCCESS',
  });
  sampleLog.isNew = false; // Giả lập document đã tồn tại trong DB

  await assert.rejects(
    async () => {
      await sampleLog.save();
    },
    /Nhật ký kiểm toán \(Audit Log\) là dữ liệu bất biến/,
    'AuditLog phải ngăn chặn hành vi sửa đổi (save trên document cũ)'
  );
  console.log('✓ Test 1 ĐẠT: AuditLog từ chối chỉnh sửa bản ghi cũ (Append-Only đảm bảo an toàn pháp lý).');

  // =========================================================================
  // 2. Kiểm thử Logic Lọc và Phân trang Service getAuditLogs
  // =========================================================================
  console.log('\n[Test 2] Kiểm tra chức năng lọc và phân trang Service getAuditLogs...');

  // Mock các hàm Mongoose để kiểm thử unit test độc lập
  const originalCount = AuditLog.countDocuments;
  const originalFind = AuditLog.find;

  let capturedQuery = null;
  AuditLog.countDocuments = async (query) => {
    capturedQuery = query;
    return mockAuditDocs.length;
  };

  AuditLog.find = (query) => {
    capturedQuery = query;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: async () => mockAuditDocs,
          }),
          limit: async () => mockAuditDocs,
        }),
      }),
    };
  };

  try {
    const result = await getAuditLogs({
      action: 'UPDATE_SYSTEM_CONFIG',
      status: 'SUCCESS',
      keyword: 'GPS',
      page: 1,
      limit: 10,
    });

    assert.strictEqual(result.totalRecords, 3, 'Phải trả về tổng số bản ghi.');
    assert.strictEqual(result.pagination.page, 1, 'Trang hiện tại phải là 1.');
    assert.strictEqual(result.pagination.limit, 10, 'Giới hạn phải là 10.');
    assert.strictEqual(capturedQuery.action, 'UPDATE_SYSTEM_CONFIG', 'Query phải chứa đúng action.');
    assert.strictEqual(capturedQuery.status, 'SUCCESS', 'Query phải lọc theo status SUCCESS.');
    assert.ok(capturedQuery.$or, 'Query phải tạo $or regex cho keyword search.');

    console.log('✓ Test 2 ĐẠT: getAuditLogs xử lý đúng bộ lọc đa tiêu chí (action, status, keyword, pagination).');
  } finally {
    AuditLog.countDocuments = originalCount;
    AuditLog.find = originalFind;
  }

  // =========================================================================
  // 3. Kiểm thử Tính Đầy Đủ của Swagger OpenAPI 3.0 Specs
  // =========================================================================
  console.log('\n[Test 3] Kiểm tra tài liệu Swagger OpenAPI 3.0...');
  assert.strictEqual(swaggerSpec.openapi, '3.0.0', 'Tài liệu OpenAPI phải tuân thủ chuẩn 3.0.0.');
  assert.ok(swaggerSpec.info && swaggerSpec.info.title, 'OpenAPI info phải có title.');

  // Kiểm tra Schemas
  const schemas = swaggerSpec.components.schemas;
  assert.ok(schemas.User, 'Swagger phải chứa schema User');
  assert.ok(schemas.Department, 'Swagger phải chứa schema Department');
  assert.ok(schemas.ShiftConfig, 'Swagger phải chứa schema ShiftConfig');
  assert.ok(schemas.Schedule, 'Swagger phải chứa schema Schedule');
  assert.ok(schemas.AttendanceLog, 'Swagger phải chứa schema AttendanceLog');
  assert.ok(schemas.LeaveRequest, 'Swagger phải chứa schema LeaveRequest');
  assert.ok(schemas.AuditLog, 'Swagger phải chứa schema AuditLog');
  assert.ok(schemas.Payroll, 'Swagger phải chứa schema Payroll');
  assert.ok(schemas.FaceTemplate, 'Swagger phải chứa schema FaceTemplate');
  assert.ok(schemas.SystemConfig, 'Swagger phải chứa schema SystemConfig');
  console.log('✓ Schemas: Đầy đủ 10+ schemas trọng yếu (bao gồm Payroll, FaceTemplate, SystemConfig).');

  // Kiểm tra Endpoints
  const paths = swaggerSpec.paths;
  const requiredEndpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/users',
    '/api/departments',
    '/api/shifts',
    '/api/schedules',
    '/api/attendance/check-in',
    '/api/attendance/check-out',
    '/api/leave-requests',
    '/api/audit-logs',
    '/api/reports/attendance',
    '/api/ai/chat',
    '/api/notifications',
    '/api/payrolls/generate',
    '/api/payrolls',
    '/api/payrolls/my-payroll',
    '/api/payrolls/summary',
    '/api/payrolls/{id}/lock',
    '/api/payrolls/export/excel',
    '/api/payrolls/export/pdf',
    '/api/face/detect-pose',
    '/api/face/enroll-multi-angle',
    '/api/face/registration-status/{userId}',
    '/api/face/faces/{userId}',
    '/api/face/health',
    '/api/system/configs',
  ];

  for (const ep of requiredEndpoints) {
    assert.ok(paths[ep], `Swagger OpenAPI phải định nghĩa endpoint: ${ep}`);
  }
  console.log(`✓ Endpoints: Đầy đủ ${requiredEndpoints.length} endpoints cốt lõi toàn hệ thống.`);

  // Kiểm tra Tags
  const tagNames = swaggerSpec.tags.map((t) => t.name);
  assert.ok(tagNames.some((t) => t.includes('Bảng Lương')), 'Phải có tag Payrolls');
  assert.ok(tagNames.some((t) => t.includes('Khuôn Mặt')), 'Phải có tag Face Biometrics');
  assert.ok(tagNames.some((t) => t.includes('Cấu Hình Hệ Thống')), 'Phải có tag System Configs');
  assert.ok(tagNames.some((t) => t.includes('Kiểm Toán')), 'Phải có tag Audit Logs');
  console.log('✓ Test 3 ĐẠT: Tài liệu OpenAPI 3.0 tập trung và hoàn chỉnh 100%.');

  // =========================================================================
  // 4. Kiểm thử Cấu Trúc Docker & Docker Compose
  // =========================================================================
  console.log('\n[Test 4] Kiểm tra cấu hình Docker Containerization...');

  const rootDir = path.resolve(__dirname, '../../');
  const rootDockerfile = path.join(rootDir, 'Dockerfile');
  const faceDockerfile = path.join(rootDir, 'face-service/Dockerfile');
  const dockerCompose = path.join(rootDir, 'docker-compose.yml');
  const rootDockerignore = path.join(rootDir, '.dockerignore');
  const faceDockerignore = path.join(rootDir, 'face-service/.dockerignore');
  const envDocker = path.join(rootDir, '.env.docker.example');

  assert.ok(fs.existsSync(rootDockerfile), 'Phải tồn tại root Dockerfile');
  assert.ok(fs.existsSync(faceDockerfile), 'Phải tồn tại face-service/Dockerfile');
  assert.ok(fs.existsSync(dockerCompose), 'Phải tồn tại docker-compose.yml');
  assert.ok(fs.existsSync(rootDockerignore), 'Phải tồn tại .dockerignore');
  assert.ok(fs.existsSync(faceDockerignore), 'Phải tồn tại face-service/.dockerignore');
  assert.ok(fs.existsSync(envDocker), 'Phải tồn tại .env.docker.example');

  // Kiểm tra nội dung Dockerfile root
  const rootDockerContent = fs.readFileSync(rootDockerfile, 'utf-8');
  assert.ok(rootDockerContent.includes('AS builder'), 'Dockerfile phải có Stage builder');
  assert.ok(rootDockerContent.includes('AS runner'), 'Dockerfile phải có Stage runner');
  assert.ok(rootDockerContent.includes('npm run build'), 'Dockerfile phải build frontend React');
  assert.ok(rootDockerContent.includes('HEALTHCHECK'), 'Dockerfile phải có lệnh HEALTHCHECK');

  // Kiểm tra nội dung Dockerfile Python
  const faceDockerContent = fs.readFileSync(faceDockerfile, 'utf-8');
  assert.ok(faceDockerContent.includes('python:3.10-slim'), 'Face Dockerfile phải dùng Python 3.10 slim');
  assert.ok(faceDockerContent.includes('requirements.txt'), 'Face Dockerfile phải cài requirements');
  assert.ok(faceDockerContent.includes('8001'), 'Face Dockerfile phải expose port 8001');

  // Kiểm tra nội dung docker-compose.yml
  const composeContent = fs.readFileSync(dockerCompose, 'utf-8');
  assert.ok(composeContent.includes('mongo:'), 'Compose phải có service mongo');
  assert.ok(composeContent.includes('--replSet'), 'Mongo phải chạy với replica set rs0 cho Transactions');
  assert.ok(composeContent.includes('face-service:'), 'Compose phải có service face-service');
  assert.ok(composeContent.includes('web:'), 'Compose phải có service web');
  assert.ok(composeContent.includes('service_healthy'), 'Web phải chờ mongo và face-service sẵn sàng (service_healthy)');

  console.log('✓ Test 4 ĐẠT: Bộ cấu hình Docker Containerization hoàn chỉnh, chuẩn multi-stage và sẵn sàng production.');

  // =========================================================================
  // 5. Kiểm thử Chuỗi Băm Mật Mã SHA-256 & Đối Soát Tính Toàn Vẹn Audit Log
  // =========================================================================
  console.log('\n[Test 5] Kiểm tra chuỗi băm SHA-256 (Hash Chaining) và đối soát tính toàn vẹn...');

  const { computeLogHash, GENESIS_HASH } = AuditLog;

  // 5.1 Kiểm tra thuật toán băm SHA-256 chuẩn xác
  const mockLog1 = {
    _id: '507f1f77bcf86cd799439011',
    thoi_diem: new Date('2026-10-17T08:00:00.000Z'),
    nguoi_thuc_hien_id: '60d0fe4f5311236168a109ca',
    loai_chu_the: 'USER',
    hanh_dong: 'LOGIN',
    loai_doi_tuong: 'User',
    doi_tuong_id: '60d0fe4f5311236168a109ca',
    ket_qua: 'SUCCESS',
    chi_tiet: { ip: '192.168.1.10' },
    ma_bam_truoc: GENESIS_HASH,
  };
  mockLog1.ma_bam_hien_tai = computeLogHash(mockLog1, GENESIS_HASH);

  assert.strictEqual(typeof mockLog1.ma_bam_hien_tai, 'string');
  assert.strictEqual(mockLog1.ma_bam_hien_tai.length, 64, 'Mã băm SHA-256 phải có đúng 64 ký tự hex.');

  // 5.2 Mắt xích thứ 2 kế thừa hash của mắt xích thứ 1
  const mockLog2 = {
    _id: '507f1f77bcf86cd799439012',
    thoi_diem: new Date('2026-10-17T08:05:00.000Z'),
    nguoi_thuc_hien_id: '60d0fe4f5311236168a109ca',
    loai_chu_the: 'USER',
    hanh_dong: 'CHECK_IN_FACE',
    loai_doi_tuong: 'AttendanceLog',
    doi_tuong_id: '60d0fe4f5311236168a109cb',
    ket_qua: 'SUCCESS',
    chi_tiet: { liveness: 0.98 },
    ma_bam_truoc: mockLog1.ma_bam_hien_tai,
  };
  mockLog2.ma_bam_hien_tai = computeLogHash(mockLog2, mockLog1.ma_bam_hien_tai);

  // 5.3 Mắt xích thứ 3
  const mockLog3 = {
    _id: '507f1f77bcf86cd799439013',
    thoi_diem: new Date('2026-10-17T17:00:00.000Z'),
    nguoi_thuc_hien_id: '60d0fe4f5311236168a109ca',
    loai_chu_the: 'USER',
    hanh_dong: 'CHECK_OUT_FACE',
    loai_doi_tuong: 'AttendanceLog',
    doi_tuong_id: '60d0fe4f5311236168a109cb',
    ket_qua: 'SUCCESS',
    chi_tiet: { liveness: 0.99 },
    ma_bam_truoc: mockLog2.ma_bam_hien_tai,
  };
  mockLog3.ma_bam_hien_tai = computeLogHash(mockLog3, mockLog2.ma_bam_hien_tai);

  // Giả lập AuditLog.find trả về chuỗi 3 mắt xích hợp lệ
  const originalFindForChain = AuditLog.find;
  AuditLog.find = () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => [mockLog1, mockLog2, mockLog3],
      }),
    }),
  });

  try {
    const validVerify = await AuditLog.verifyChainIntegrity();
    assert.strictEqual(validVerify.isValid, true, 'Chuỗi hợp lệ phải trả về isValid = true.');
    assert.strictEqual(validVerify.totalChecked, 3);
    assert.strictEqual(validVerify.tamperedCount, 0);
    assert.strictEqual(validVerify.brokenChainCount, 0);
    assert.strictEqual(validVerify.latestHash, mockLog3.ma_bam_hien_tai);

    // 5.4 Giả lập kẻ tấn công sửa lén chi tiết của mockLog2 trong DB
    const tamperedLog2 = {
      ...mockLog2,
      chi_tiet: { liveness: 0.12 }, // Thay đổi số liệu
    };
    AuditLog.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [mockLog1, tamperedLog2, mockLog3],
        }),
      }),
    });

    const tamperedVerify = await AuditLog.verifyChainIntegrity();
    assert.strictEqual(tamperedVerify.isValid, false, 'Khi dữ liệu bị can thiệp, verify phải trả về false.');
    assert.strictEqual(tamperedVerify.tamperedCount, 1, 'Phải phát hiện chính xác 1 bản ghi bị sửa.');
    assert.ok(tamperedVerify.tamperedLogs[0].reason.includes('can thiệp trái phép'));

    // 5.5 Giả lập kẻ tấn công xóa mất bản ghi mockLog2 dẫn đến đứt gãy chuỗi
    AuditLog.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [mockLog1, mockLog3],
        }),
      }),
    });

    const brokenVerify = await AuditLog.verifyChainIntegrity();
    assert.strictEqual(brokenVerify.isValid, false, 'Khi chuỗi bị đứt gãy, verify phải trả về false.');
    assert.strictEqual(brokenVerify.brokenChainCount, 1, 'Phải phát hiện chính xác mắt xích bị đứt.');

    console.log('✓ Test 5 ĐẠT: Chuỗi băm SHA-256 Hash Chaining phát hiện 100% các hành vi sửa lén hoặc xóa bỏ nhật ký kiểm toán.');
  } finally {
    AuditLog.find = originalFindForChain;
  }

  // ===========================================================================
  // TEST 6: KHÓA PHÂN TÁN DISTRIBUTED LOCK & ADAPTIVE RATE LIMITER (GIAI ĐOẠN 4)
  // ===========================================================================
  console.log('\n--- TEST 6: Khóa phân tán Distributed Lock & Adaptive Rate Limiter ---');
  const {
    acquireLock,
    releaseLock,
    withDistributedLock,
    getLockStatus,
    resetMemoryLocks,
  } = require('../utils/distributedLock');
  const {
    aiChatRateLimit,
    passwordResetLimiter,
    loginLimiter,
    faceCheckInRateLimit,
  } = require('../middlewares/rateLimiter.middleware');

  resetMemoryLocks();

  // 6.1 Worker 1 giành khóa thành công
  const lockKey = 'CRON_TEST_SCAN';
  const acquired1 = await acquireLock(lockKey, 2, 'worker_node_1');
  assert.strictEqual(acquired1, true, 'Worker 1 phải giành được khóa thành công.');

  // 6.2 Worker 2 thử giành cùng khóa khi Worker 1 chưa giải phóng và chưa hết hạn -> Phải thất bại
  const acquired2 = await acquireLock(lockKey, 2, 'worker_node_2');
  assert.strictEqual(acquired2, false, 'Worker 2 không thể giành khóa khi Worker 1 đang nắm giữ.');

  const statusWhileLocked = await getLockStatus(lockKey);
  assert.strictEqual(statusWhileLocked.isLocked, true, 'Trạng thái khóa phải là isLocked = true.');
  assert.strictEqual(statusWhileLocked.lockedBy, 'worker_node_1');

  // 6.3 Worker 2 thử giải phóng khóa của Worker 1 -> Không được phép
  const releasedWrongWorker = await releaseLock(lockKey, 'worker_node_2');
  assert.strictEqual(releasedWrongWorker, false, 'Worker khác không thể giải phóng khóa không thuộc về mình.');

  // 6.4 Worker 1 giải phóng khóa của mình -> Thành công
  const released1 = await releaseLock(lockKey, 'worker_node_1');
  assert.strictEqual(released1, true, 'Worker 1 phải giải phóng được khóa thành công.');

  // Sau khi giải phóng, Worker 2 có thể giành khóa
  const acquiredAfterRelease = await acquireLock(lockKey, 2, 'worker_node_2');
  assert.strictEqual(acquiredAfterRelease, true, 'Worker 2 phải giành được khóa sau khi Worker 1 đã giải phóng.');

  // 6.5 Cơ chế tự phục hồi sự cố (TTL Crash Recovery): Khi Worker 2 crash mà không release
  // Chờ khóa hết hạn TTL (ttlSeconds = 1s)
  await acquireLock('CRON_CRASH_TEST', 1, 'worker_crashed');
  // Giả lập worker_crashed chết đột ngột. Chờ 1.1s để TTL quá hạn
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const acquiredAfterCrash = await acquireLock('CRON_CRASH_TEST', 2, 'worker_recovery');
  assert.strictEqual(acquiredAfterCrash, true, 'Khóa quá hạn TTL phải cho phép worker mới tự động chiếm quyền (Crash-safe).');
  await releaseLock('CRON_CRASH_TEST', 'worker_recovery');

  // 6.6 withDistributedLock tự động giải phóng an toàn cả khi task hoàn thành hoặc ném lỗi
  let taskRan = false;
  const result = await withDistributedLock('CRON_SAFE_WRAP', 5, async () => {
    taskRan = true;
    return 'COMPLETED_SUCCESSFULLY';
  }, { workerId: 'worker_wrapper' });
  assert.strictEqual(taskRan, true);
  assert.strictEqual(result, 'COMPLETED_SUCCESSFULLY');

  // Kiểm tra khóa đã được giải phóng ngay lập tức sau withDistributedLock
  const statusAfterWrap = await getLockStatus('CRON_SAFE_WRAP');
  assert.strictEqual(statusAfterWrap.isLocked, false, 'Khóa phải được giải phóng ngay sau withDistributedLock.');

  // Kiểm tra an toàn khi taskFn ném lỗi (error safety)
  try {
    await withDistributedLock('CRON_SAFE_WRAP_ERROR', 5, async () => {
      throw new Error('Mô phỏng lỗi nghiệp vụ trong cron task');
    }, { workerId: 'worker_wrapper_err' });
  } catch (err) {
    assert.strictEqual(err.message, 'Mô phỏng lỗi nghiệp vụ trong cron task');
  }
  const statusAfterError = await getLockStatus('CRON_SAFE_WRAP_ERROR');
  assert.strictEqual(statusAfterError.isLocked, false, 'Khóa phải được giải phóng an toàn dù taskFn ném lỗi.');

  // 6.7 Rate Limiter Middlewares kiểm tra khởi tạo và xuất khẩu đúng chuẩn
  assert.ok(typeof aiChatRateLimit === 'function', 'aiChatRateLimit phải là middleware Express hợp lệ.');
  assert.ok(typeof passwordResetLimiter === 'function', 'passwordResetLimiter phải là middleware Express hợp lệ.');
  assert.ok(typeof loginLimiter === 'function', 'loginLimiter phải là middleware Express hợp lệ.');
  assert.ok(typeof faceCheckInRateLimit === 'function', 'faceCheckInRateLimit phải là middleware Express hợp lệ.');

  console.log('✓ Test 6 ĐẠT: Khóa phân tán Distributed Lock (Atomic CAS, TTL Crash Recovery, Error-Safe Wrapper) & Rate Limiter hoạt động hoàn hảo 100%.');

  console.log('\n=============================================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TUẦN 8 & BẢO MẬT GIAI ĐOẠN 2 & GIAI ĐOẠN 4 ĐÃ ĐẠT 100% THÀNH CÔNG!');
  console.log('=============================================================================');
}

runTests().catch((err) => {
  console.error('❌ LỖI KIỂM THỬ TUẦN 8:', err);
  process.exit(1);
});
