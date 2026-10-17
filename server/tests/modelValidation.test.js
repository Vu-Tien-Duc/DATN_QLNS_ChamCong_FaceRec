const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Schedule = require('../models/schedule.model');
const ShiftConfig = require('../models/shiftConfig.model');
const FaceTemplate = require('../models/faceTemplate.model');
const PunchLog = require('../models/punchLog.model');
const Holiday = require('../models/holiday.model');
const SystemConfig = require('../models/systemConfig.model');
const { findBestFaceMatch } = require('../utils/attendanceHelpers');

const objectId = () => new mongoose.Types.ObjectId();

const expectValidationError = async (document, path) => {
  let validationError;
  try {
    await document.validate();
  } catch (error) {
    validationError = error;
  }
  assert.ok(validationError, `Expected validation to fail for ${path}`);
  const realPath = document.schema?.aliases?.[path] || path;
  assert.ok(
    validationError.errors[path] || validationError.errors[realPath],
    `Expected a validation error on ${path} (or ${realPath})`
  );
};

const run = async () => {
  const user = new User({
    fullName: 'Giảng viên kiểm thử',
    email: 'lecturer@example.edu.vn',
    passwordHash: 'hashed-password',
    departmentId: objectId(),
    staffCode: 'gv_001',
    phoneNumber: '0901234567',
    academicTitle: 'Tiến sĩ',
  });
  assert.equal(user.staffCode, 'GV_001');
  await user.validate();

  await expectValidationError(
    new User({
      fullName: 'Giảng viên kiểm thử',
      email: 'fractional-quota@example.edu.vn',
      passwordHash: 'hashed-password',
      departmentId: objectId(),
      annualLeaveQuota: 12.5,
    }),
    'annualLeaveQuota'
  );

  const invalidUser = new User({
    fullName: 'Giảng viên kiểm thử',
    email: 'invalid-code@example.edu.vn',
    passwordHash: 'hashed-password',
    departmentId: objectId(),
    staffCode: 'G#1',
  });
  await expectValidationError(invalidUser, 'staffCode');

  const invalidCccdUser = new User({
    fullName: 'Giảng viên kiểm thử',
    email: 'invalid-cccd@example.edu.vn',
    passwordHash: 'hashed-password',
    departmentId: objectId(),
    identityCard: '12345',
  });
  await expectValidationError(invalidCccdUser, 'identityCard');

  const validCccdUser = new User({
    fullName: 'Giảng viên kiểm thử',
    email: 'valid-cccd@example.edu.vn',
    passwordHash: 'hashed-password',
    departmentId: objectId(),
    identityCard: '001201012345',
    gender: 'FEMALE',
    position: 'Trưởng bộ môn',
    contractType: 'INDEFINITE',
  });
  await validCccdUser.validate();
  assert.equal(validCccdUser.identityCard, '001201012345');
  assert.equal(validCccdUser.gender, 'FEMALE');
  assert.equal(validCccdUser.contractType, 'INDEFINITE');

  const insightFaceTemplate = {
    userId: objectId(),
    descriptors: [Array.from({ length: 512 }, (_, index) => index / 512)],
    embeddingDimensions: 512,
    embeddingModel: 'insightface-buffalo_l',
  };
  await new FaceTemplate(insightFaceTemplate).validate();
  await expectValidationError(
    new FaceTemplate({
      ...insightFaceTemplate,
      userId: objectId(),
      descriptors: [Array.from({ length: 128 }, (_, index) => index / 128)],
    }),
    'descriptors'
  );
  await expectValidationError(
    new FaceTemplate({
      ...insightFaceTemplate,
      embeddingModel: 'face-api',
    }),
    'embeddingModel'
  );
  await expectValidationError(
    new FaceTemplate({
      ...insightFaceTemplate,
      descriptors: [
        Array.from({ length: 128 }, (_, index) => index / 128),
        Array.from({ length: 512 }, (_, index) => index / 512),
      ],
    }),
    'descriptors'
  );
  await expectValidationError(
    new FaceTemplate({
      ...insightFaceTemplate,
      descriptors: [Array.from({ length: 256 }, (_, index) => index / 256)],
    }),
    'descriptors'
  );
  const insightFaceVector = Array.from({ length: 512 }, (_, index) => index === 0 ? 1 : 0);
  const legacyVector = Array.from({ length: 128 }, (_, index) => index === 0 ? 1 : 0);
  const matchedInsightFace = findBestFaceMatch(insightFaceVector, [
    { _id: 'legacy', fullName: 'Legacy', faceDescriptors: [legacyVector] },
    { _id: 'insightface', fullName: 'InsightFace', faceDescriptors: [insightFaceVector] },
  ]);
  assert.equal(matchedInsightFace.bestMatch.fullName, 'InsightFace');
  assert.equal(matchedInsightFace.bestDistance, 0);
  assert.equal(
    findBestFaceMatch(insightFaceVector, [
      { _id: 'legacy', fullName: 'Legacy', faceDescriptors: [legacyVector] },
    ]).bestMatch,
    null
  );

  const attendanceBase = {
    userId: objectId(),
    shiftId: objectId(),
    workDate: '2026-10-12',
    status: 'ON_TIME',
    checkInTime: new Date('2026-10-12T08:00:00+07:00'),
  };
  await expectValidationError(
    new AttendanceLog({
      ...attendanceBase,
      checkOutTime: new Date('2026-10-12T07:59:00+07:00'),
    }),
    'checkOutTime'
  );
  await expectValidationError(
    new AttendanceLog({ ...attendanceBase, isManualOverride: true }),
    'overriddenBy'
  );
  await expectValidationError(
    new AttendanceLog({ ...attendanceBase, isManualOverride: true, overriddenBy: objectId() }),
    'overrideReason'
  );
  await expectValidationError(
    new PunchLog({
      attendanceLogId: objectId(),
      userId: objectId(),
      punchType: 'CHECK_IN',
      confidenceScore: 1.1,
    }),
    'confidenceScore'
  );

  const validCompletedLog = new AttendanceLog({
    ...attendanceBase,
    checkInTime: new Date('2026-10-12T08:00:00+07:00'),
    checkOutTime: new Date('2026-10-12T17:00:00+07:00'),
  });
  await validCompletedLog.validate();
  assert.equal(validCompletedLog.workDurationMinutes, 540);

  // Kiểm tra thời lượng được cập nhật lại khi đổi giờ ra
  validCompletedLog.checkOutTime = new Date('2026-10-12T18:00:00+07:00');
  await validCompletedLog.validate();
  assert.equal(validCompletedLog.workDurationMinutes, 600);

  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'Lý do kiểm thử hợp lệ',
      startDate: new Date('2026-10-14T00:00:00+07:00'),
      endDate: new Date('2026-10-13T00:00:00+07:00'),
    }),
    'endDate'
  );

  await expectValidationError(
    new ShiftConfig({ name: 'Ca kiểm thử', startTime: '08:00', endTime: '08:00' }),
    'endTime'
  );
  await expectValidationError(
    new ShiftConfig({ name: 'Ca qua đêm', startTime: '22:00', endTime: '06:00' }),
    'endTime'
  );
  await expectValidationError(
    new ShiftConfig({
      name: 'Ca kiểm thử ngưỡng',
      startTime: '08:00',
      endTime: '09:00',
      lateThresholdMinutes: 1.5,
    }),
    'lateThresholdMinutes'
  );

  await expectValidationError(
    new Schedule({
      userId: objectId(),
      shiftId: objectId(),
      weekday: 1,
      startTime: '08:00',
      endTime: '09:00',
      startDate: new Date('2026-10-14T00:00:00+07:00'),
      endDate: new Date('2026-10-13T00:00:00+07:00'),
    }),
    'endDate'
  );
  await expectValidationError(
    new Schedule({
      userId: objectId(),
      shiftId: objectId(),
      weekday: 1,
      startTime: '08:00',
      endTime: '08:00',
      startDate: new Date('2026-10-13T00:00:00+07:00'),
      endDate: new Date('2026-10-14T00:00:00+07:00'),
    }),
    'endTime'
  );
  await expectValidationError(
    new Schedule({
      userId: objectId(),
      shiftId: objectId(),
      weekday: 1,
      startTime: '22:00',
      endTime: '06:00',
      startDate: new Date('2026-10-13T00:00:00+07:00'),
      endDate: new Date('2026-10-14T00:00:00+07:00'),
    }),
    'endTime'
  );

  const originalFindShiftById = ShiftConfig.findById;
  try {
    ShiftConfig.findById = async () => ({ startTime: '08:00', endTime: '09:00' });
    const inheritedSchedule = new Schedule({
      userId: objectId(),
      shiftId: objectId(),
      weekday: 1,
      startDate: new Date('2026-10-13T00:00:00+07:00'),
      endDate: new Date('2026-10-14T00:00:00+07:00'),
    });
    await inheritedSchedule.validate();
    assert.equal(inheritedSchedule.startTime, '08:00');
    assert.equal(inheritedSchedule.endTime, '09:00');

    ShiftConfig.findById = async () => ({ startTime: '22:00', endTime: '06:00' });
    await expectValidationError(
      new Schedule({
        userId: objectId(),
        shiftId: objectId(),
        weekday: 1,
        startDate: new Date('2026-10-13T00:00:00+07:00'),
        endDate: new Date('2026-10-14T00:00:00+07:00'),
      }),
      'endTime'
    );
  } finally {
    ShiftConfig.findById = originalFindShiftById;
  }

  // --- Kiểm thử mô hình Holiday (ngay_nghi_le) ---
  const validHoliday = new Holiday({
    ten_ngay_le: 'Quốc Khánh',
    ngay_bat_dau: '2026-09-02',
    ngay_ket_thuc: '2026-09-02',
    huong_luong: true,
  });
  await validHoliday.validate();
  assert.equal(validHoliday.name, 'Quốc Khánh');
  assert.equal(validHoliday.startDate, '2026-09-02');
  assert.equal(validHoliday.endDate, '2026-09-02');
  assert.equal(validHoliday.isPaid, true);

  await expectValidationError(
    new Holiday({
      ten_ngay_le: 'Sai định dạng ngày',
      ngay_bat_dau: '02/09/2026',
      ngay_ket_thuc: '2026-09-02',
    }),
    'ngay_bat_dau'
  );

  // --- Kiểm thử mô hình SystemConfig (cau_hinh_he_thong) ---
  const validConfig = new SystemConfig({
    khoa_cau_hinh: 'face_match_threshold',
    gia_tri: 0.45,
    nhom: 'AI',
    mo_ta: 'Ngưỡng đối sánh Face ID',
  });
  assert.equal(validConfig.key, 'FACE_MATCH_THRESHOLD');
  await validConfig.validate();
  assert.equal(validConfig.value, 0.45);
  assert.equal(validConfig.group, 'AI');

  await expectValidationError(
    new SystemConfig({
      khoa_cau_hinh: 'INVALID_GROUP_CONFIG',
      gia_tri: 123,
      nhom: 'UNKNOWN_GROUP',
    }),
    'nhom'
  );

  // --- Kiểm thử cờ co_di_muon, co_ve_som, quen_quet_ra trong AttendanceLog ---
  const attendanceWithFlags = new AttendanceLog({
    userId: objectId(),
    shiftId: objectId(),
    workDate: '2026-10-15',
    thoi_gian_vao: new Date('2026-10-15T08:15:00+07:00'),
    di_muon_phut: 15,
    trang_thai: 'LATE',
    ve_som_phut: 10,
    quen_quet_ra: true,
  });
  await attendanceWithFlags.validate();
  assert.equal(attendanceWithFlags.co_di_muon, true);
  assert.equal(attendanceWithFlags.isLate, true);
  assert.equal(attendanceWithFlags.co_ve_som, true);
  assert.equal(attendanceWithFlags.isEarlyLeave, true);
  assert.equal(attendanceWithFlags.quen_quet_ra, true);
  assert.equal(attendanceWithFlags.isMissingCheckOut, true);

  console.log('Model validation tests passed (including Holiday, SystemConfig, Attendance Flags).');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
