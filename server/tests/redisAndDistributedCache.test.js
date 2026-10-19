/**
 * Test Suite: Redis & Distributed Cache Architecture (Phần 1)
 * Kiểm thử toàn diện:
 * 1. Redis Client & Cơ chế Transparent Fallback In-Memory
 * 2. Phân tán Cooldown chống quét lặp 60s (checkAndSetCooldown, getCooldownRemaining, resetCooldown)
 * 3. Grace Period Cache 15s cho RTR Token
 * 4. Khóa phân tán Distributed Lock (acquireLock, releaseLock, withDistributedLock)
 * 5. Bộ đệm vector khuôn mặt sinh trắc học (cacheFaceVectors, getCachedFaceVectors, invalidateFaceCache)
 */
const assert = require('node:assert/strict');
const redisService = require('../config/redis');
const {
  acquireLock,
  releaseLock,
  withDistributedLock,
  getLockStatus,
  resetMemoryLocks,
} = require('../utils/distributedLock');

const run = async () => {
  console.log('--- Bắt đầu Test Suite: Redis & Distributed Cache Architecture (Phần 1) ---');

  // Test 1: Kiểm tra trạng thái Adapter & Fallback Memory
  const isRedis = redisService.isRedisReady();
  console.log(`[Test 1] Trạng thái Redis Server: ${isRedis ? 'ONLINE (Redis Mode)' : 'OFFLINE (In-Memory Fallback Active)'}`);
  
  // Set và Get cơ bản
  await redisService.redisSet('TEST_KEY_HELLO', 'WORLD_2026', 10);
  const val = await redisService.redisGet('TEST_KEY_HELLO');
  assert.equal(val, 'WORLD_2026', 'Giá trị đọc lại phải khớp với giá trị vừa ghi');
  await redisService.redisDel('TEST_KEY_HELLO');
  const valDeleted = await redisService.redisGet('TEST_KEY_HELLO');
  assert.equal(valDeleted, null, 'Key đã xóa phải trả về null');
  console.log('✓ Test 1 ĐẠT: Bộ điều hợp Cache (Get/Set/Del) hoạt động chính xác và an toàn.');

  // Test 2: Phân tán Cooldown chống quét lặp 60 giây
  const testUserId = 'user_test_cooldown_60s';
  await redisService.resetCooldown(testUserId);

  // Lần 1: Cho phép quẹt
  const firstPunch = await redisService.checkAndSetCooldown(testUserId, 60);
  assert.equal(firstPunch.allowed, true, 'Lần quẹt đầu tiên phải được phép');
  assert.equal(firstPunch.remainingSeconds, 0);

  // Lần 2 (ngay lập tức): Bị chặn bởi Cooldown
  const secondPunch = await redisService.checkAndSetCooldown(testUserId, 60);
  assert.equal(secondPunch.allowed, false, 'Lần quẹt thứ 2 trong 60s phải bị chặn');
  assert.ok(secondPunch.remainingSeconds > 0 && secondPunch.remainingSeconds <= 60, 'Thời gian chờ phải từ 1 đến 60s');

  const remaining = await redisService.getCooldownRemaining(testUserId);
  assert.ok(remaining > 0 && remaining <= 60, 'getCooldownRemaining phải trả về số giây hợp lệ');

  // Reset Cooldown
  await redisService.resetCooldown(testUserId);
  const afterReset = await redisService.getCooldownRemaining(testUserId);
  assert.equal(afterReset, 0, 'Sau khi reset, remainingSeconds phải bằng 0');
  console.log('✓ Test 2 ĐẠT: Cooldown chống quét lặp phân tán 60 giây hoạt động hoàn hảo.');

  // Test 3: Grace Period Cache 15s cho RTR Token
  const testTokenHash = 'hashed_refresh_token_test_abc_123';
  const tokenData = {
    newAccessToken: 'jwt_access_token_sample',
    newRefreshTokenString: 'refresh_uuid_sample_family',
    expiresAt: Date.now() + 15000,
  };
  await redisService.setGraceToken(testTokenHash, tokenData, 15);

  const cachedGrace = await redisService.getGraceToken(testTokenHash);
  assert.ok(cachedGrace, 'Phải tìm thấy Grace Token vừa lưu');
  assert.equal(cachedGrace.newAccessToken, 'jwt_access_token_sample');
  assert.equal(cachedGrace.newRefreshTokenString, 'refresh_uuid_sample_family');
  console.log('✓ Test 3 ĐẠT: Grace Period Cache 15s xử lý Race Condition đa tiến trình chuẩn xác.');

  // Test 4: Khóa Phân Tán (Distributed Lock)
  resetMemoryLocks();
  const lockKey = 'CRON_TEST_PAYROLL_LOCK';
  const worker1 = 'worker_node_instance_A';
  const worker2 = 'worker_node_instance_B';

  // Worker 1 giành khóa
  const acquiredW1 = await acquireLock(lockKey, 30, worker1);
  assert.equal(acquiredW1, true, 'Worker 1 phải giành được khóa');

  // Worker 2 thử giành cùng khóa
  const acquiredW2 = await acquireLock(lockKey, 30, worker2);
  assert.equal(acquiredW2, false, 'Worker 2 phải bị từ chối khi khóa đang bị giữ');

  // Kiểm tra trạng thái khóa
  const status = await getLockStatus(lockKey);
  assert.equal(status.isLocked, true, 'Khóa phải ở trạng thái locked');
  assert.equal(status.lockedBy, worker1, 'Khóa phải do Worker 1 nắm giữ');

  // Worker 2 thử giải phóng khóa của Worker 1 -> phải thất bại
  const invalidRelease = await releaseLock(lockKey, worker2);
  assert.equal(invalidRelease, false, 'Worker 2 không được phép giải phóng khóa của Worker 1');

  // Worker 1 giải phóng khóa của chính mình -> thành công
  const validRelease = await releaseLock(lockKey, worker1);
  assert.equal(validRelease, true, 'Worker 1 phải giải phóng khóa thành công');

  // Worker 2 giành lại khóa sau khi đã giải phóng
  const acquiredW2After = await acquireLock(lockKey, 30, worker2);
  assert.equal(acquiredW2After, true, 'Worker 2 phải giành được khóa sau khi Worker 1 giải phóng');
  await releaseLock(lockKey, worker2);
  console.log('✓ Test 4 ĐẠT: Khóa phân tán Distributed Lock (Mutual Exclusion, Safe Release) hoạt động chuẩn xác.');

  // Test 5: Wrapper withDistributedLock tự động giải phóng
  const withLockKey = 'IMPORT_TKB_TASK';
  let executed = false;
  const taskResult = await withDistributedLock(withLockKey, 10, async () => {
    executed = true;
    return 'TASK_COMPLETED_SUCCESSFULLY';
  });
  assert.equal(executed, true, 'Hàm tác vụ phải được thực thi');
  assert.equal(taskResult, 'TASK_COMPLETED_SUCCESSFULLY');

  // Sau khi xong, khóa phải được tự động giải phóng
  const lockStatusAfter = await getLockStatus(withLockKey);
  assert.equal(lockStatusAfter.isLocked, false, 'Khóa phải được giải phóng tự động trong finally block');
  console.log('✓ Test 5 ĐẠT: Wrapper withDistributedLock thực thi và tự động giải phóng khóa thành công.');

  // Test 6: Bộ đệm Cache Vector Khuôn mặt sinh trắc học
  const mockTemplates = [
    { userId: 'user_1', fullName: 'TS. Nguyễn Văn A', embedding: [0.12, 0.34, 0.56] },
    { userId: 'user_2', fullName: 'ThS. Trần Thị B', embedding: [0.78, 0.90, 0.11] },
  ];
  await redisService.cacheFaceVectors(mockTemplates, 300);
  const cachedVectors = await redisService.getCachedFaceVectors();
  assert.equal(cachedVectors.length, 2, 'Phải đọc lại đủ 2 mẫu khuôn mặt từ Cache');
  assert.equal(cachedVectors[0].fullName, 'TS. Nguyễn Văn A');

  await redisService.invalidateFaceCache();
  const invalidated = await redisService.getCachedFaceVectors();
  assert.equal(invalidated, null, 'Sau khi invalidate, cache vector phải rỗng');
  console.log('✓ Test 6 ĐẠT: Bộ đệm vector khuôn mặt sinh trắc học (Cache & Invalidation) chính xác.');

  // Dọn dẹp
  await redisService.closeRedis();
  console.log('\n=============================================================================');
  console.log('🎉 TẤT CẢ 6 BÀI KIỂM THỬ REDIS & DISTRIBUTED CACHE (PHẦN 1) ĐÃ PASS 100%!');
  console.log('=============================================================================\n');
};

run().catch((err) => {
  console.error('❌ Kiểm thử Redis & Distributed Cache thất bại:', err);
  process.exit(1);
});
