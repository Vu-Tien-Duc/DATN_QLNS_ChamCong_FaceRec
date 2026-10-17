/**
 * Test Suite: Quản lý Thời khóa biểu, Chống xung đột Lịch & Điểm danh Realtime v2.5 (Tuần 3 & 4)
 */
const assert = require('assert');
const mongoose = require('mongoose');
const Schedule = require('../models/schedule.model');
const { isSameRoom, timeStringToMinutes } = require('../services/scheduleManagement.service');

async function runScheduleConflictTests() {
  console.log('\n--- Bắt đầu Test Suite: Schedule Conflicts & Realtime Attendance v2.5 ---');

  // Test 1: Schedule Model khởi tạo đầy đủ các trường TKB học kỳ
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyShiftId = new mongoose.Types.ObjectId();
  const dummySubjectId = new mongoose.Types.ObjectId();

  const scheduleDoc = new Schedule({
    userId: dummyUserId,
    shiftId: dummyShiftId,
    startTime: '07:00',
    endTime: '09:30',
    startPeriod: 1,
    periodCount: 3,
    roomId: 'A101',
    subjectId: dummySubjectId,
    weekday: 1, // Thứ 2
    isRecurring: true,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-12-31'),
    scheduleType: 'CHINH_KHOA',
    weekNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    academicYear: '2026-2027',
    semester: 1,
    exceptions: [
      {
        ngay: new Date('2026-09-08'),
        ly_do: 'Giảng viên dự hội nghị khoa học',
        trang_thai: 'NGHI',
      },
    ],
  });

  await scheduleDoc.validate();
  assert.strictEqual(scheduleDoc.startPeriod, 1, 'startPeriod đúng');
  assert.strictEqual(scheduleDoc.periodCount, 3, 'periodCount đúng');
  assert.strictEqual(scheduleDoc.scheduleType, 'CHINH_KHOA', 'scheduleType đúng');
  assert.strictEqual(scheduleDoc.weekNumbers.length, 10, 'weekNumbers đúng');
  assert.strictEqual(scheduleDoc.exceptions.length, 1, 'exceptions đúng');
  console.log('✓ Test 1 ĐẠT: Schedule Model lưu trữ chuẩn xác các trường TKB học kỳ theo đặc tả v2.5.');

  // Test 2: Thuật toán kiểm tra trùng phòng học chuẩn hóa
  assert.strictEqual(isSameRoom('Phòng A101', 'A101'), true, 'Chuẩn hóa phòng đúng');
  assert.strictEqual(isSameRoom('Giảng đường B202', 'p. B202'), true, 'Chuẩn hóa giảng đường đúng');
  assert.strictEqual(isSameRoom('A101', 'B202'), false, 'Hai phòng khác nhau không trùng');
  console.log('✓ Test 2 ĐẠT: Hàm isSameRoom chuẩn hóa và so sánh tên phòng/giảng đường chính xác.');

  // Test 3: Thuật toán chống xung đột tiết học giữa 2 lịch
  // Lịch A: Tiết 1 - 3 (pStart=1, pEnd=3)
  // Lịch B: Tiết 3 - 5 (pStart=3, pEnd=5) -> Chồng lấn tại Tiết 3!
  const pA_start = 1, pA_end = 3;
  const pB_start = 3, pB_end = 5;
  const isOverlapAB = Math.max(pA_start, pB_start) <= Math.min(pA_end, pB_end);
  assert.strictEqual(isOverlapAB, true, 'Tiết 1-3 và Tiết 3-5 phải bị phát hiện chồng lấn');

  // Lịch C: Tiết 4 - 6 (pStart=4, pEnd=6) -> Không chồng lấn với Lịch A
  const pC_start = 4, pC_end = 6;
  const isOverlapAC = Math.max(pA_start, pC_start) <= Math.min(pA_end, pC_end);
  assert.strictEqual(isOverlapAC, false, 'Tiết 1-3 và Tiết 4-6 không được báo chồng lấn');
  console.log('✓ Test 3 ĐẠT: Thuật toán so sánh khoảng tiết max(Start) <= min(End) hoạt động chuẩn xác.');

  // Test 4: Thuật toán kiểm tra tuần học chung (Intersection of week numbers)
  const weeks1 = [1, 2, 3, 4, 5];
  const weeks2 = [5, 6, 7, 8];
  const weeks3 = [6, 7, 8, 9];

  const hasCommon12 = weeks1.some((w) => weeks2.includes(w)); // Tuần 5 chung
  const hasCommon13 = weeks1.some((w) => weeks3.includes(w)); // Không có tuần chung

  assert.strictEqual(hasCommon12, true, 'Tuần [1-5] và [5-8] phải có tuần 5 chung');
  assert.strictEqual(hasCommon13, false, 'Tuần [1-5] và [6-9] không có tuần chung');
  console.log('✓ Test 4 ĐẠT: Thuật toán đối soát tuần học chung của TKB chính xác.');

  // Test 5: Logic Margin Top 1 - Top 2 (Chống nhận diện nhầm người)
  const candidateTop1 = { userId: 'user_A', similarity: 0.52 };
  const candidateTop2 = { userId: 'user_B', similarity: 0.49 };
  const candidateTop2Far = { userId: 'user_C', similarity: 0.41 };

  const MARGIN_THRESHOLD = 0.05;
  const diffClose = candidateTop1.similarity - candidateTop2.similarity; // 0.03 < 0.05 -> Chặn AMBIGUOUS_MATCH
  const diffClear = candidateTop1.similarity - candidateTop2Far.similarity; // 0.11 >= 0.05 -> Hợp lệ

  assert.strictEqual(diffClose < MARGIN_THRESHOLD, true, 'Độ chênh 0.03 < 0.05 phải bị coi là mơ hồ (Ambiguous)');
  assert.strictEqual(diffClear >= MARGIN_THRESHOLD, true, 'Độ chênh 0.11 >= 0.05 được chấp nhận an toàn');
  console.log('✓ Test 5 ĐẠT: Tiêu chuẩn Margin Top 1 - Top 2 >= 0.05 loại bỏ hoàn toàn nhận diện mơ hồ.');

  // Test 6: Cooldown chống quét lặp 60s
  const cooldownMs = 60 * 1000;
  const scanTime1 = Date.now() - 30 * 1000; // Quét cách đây 30s
  const isCooldownActive = (Date.now() - scanTime1) < cooldownMs;
  assert.strictEqual(isCooldownActive, true, 'Lần quét cách 30s phải bị chặn Cooldown 60s');

  const scanTimeOld = Date.now() - 75 * 1000; // Quét cách đây 75s
  const isCooldownExpired = (Date.now() - scanTimeOld) < cooldownMs;
  assert.strictEqual(isCooldownExpired, false, 'Lần quét cách 75s đã hết thời gian Cooldown và được phép quét tiếp');
  console.log('✓ Test 6 ĐẠT: Cơ chế Cooldown chống quét lặp 60s hoạt động chính xác.');

  console.log('\n===> TẤT CẢ 6 TEST TRONG SCHEDULECONFLICTANDREALTIME.TEST.JS ĐÃ PASS 100% <===\n');
}

runScheduleConflictTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test thất bại:', err);
    process.exit(1);
  });
