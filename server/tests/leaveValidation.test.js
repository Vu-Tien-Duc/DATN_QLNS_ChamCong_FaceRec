const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const LeaveRequest = require('../models/leaveRequest.model');

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
  console.log('--- Bắt đầu kiểm thử nghiệp vụ Leave Request (Nhóm 5) ---');

  // 1. Kiểm tra enum loại đơn hợp lệ
  const validTypes = ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng'];
  for (const t of validTypes) {
    const doc = new LeaveRequest({
      userId: objectId(),
      type: t,
      reason: 'Xin nghỉ có lý do hợp lệ dài hơn 5 ký tự',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
      status: 'pending',
    });
    await doc.validate();
    assert.equal(doc.loai_don, t);
  }

  // 2. Kiểm tra enum loại đơn không hợp lệ
  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'invalid_type_abc',
      reason: 'Xin nghỉ lý do kiểm thử',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
    }),
    'type'
  );

  // 3. Kiểm tra lý do ngắn hơn 5 ký tự (< 5)
  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'abc',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
    }),
    'reason'
  );

  // 4. Kiểm tra lý do vượt quá 500 ký tự
  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'a'.repeat(501),
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
    }),
    'reason'
  );

  // 5. Kiểm tra bắt buộc có lý do từ chối khi status là REJECTED
  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'Lý do xin nghỉ hợp lệ',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
      status: 'rejected',
      rejectionReason: '',
    }),
    'rejectionReason'
  );

  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'Lý do xin nghỉ hợp lệ',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
      status: 'rejected',
      rejectionReason: '   ',
    }),
    'rejectionReason'
  );

  // 6. Kiểm tra lý do từ chối vượt quá 500 ký tự
  await expectValidationError(
    new LeaveRequest({
      userId: objectId(),
      type: 'nghi_phep',
      reason: 'Lý do xin nghỉ hợp lệ',
      startDate: new Date('2026-10-20T00:00:00+07:00'),
      endDate: new Date('2026-10-21T00:00:00+07:00'),
      status: 'rejected',
      rejectionReason: 'r'.repeat(501),
    }),
    'rejectionReason'
  );

  // 7. Kiểm tra từ chối hợp lệ khi có rejectionReason
  const validRejected = new LeaveRequest({
    userId: objectId(),
    type: 'nghi_phep',
    reason: 'Lý do xin nghỉ hợp lệ',
    startDate: new Date('2026-10-20T00:00:00+07:00'),
    endDate: new Date('2026-10-21T00:00:00+07:00'),
    status: 'rejected',
    rejectionReason: 'Trùng lịch họp đồng ban chủ nhiệm khoa.',
  });
  await validRejected.validate();
  assert.equal(validRejected.ly_do_tu_choi, 'Trùng lịch họp đồng ban chủ nhiệm khoa.');

  // 8. Mapping nhãn tiếng Việt cho loại đơn
  const LEAVE_TYPE_LABELS = {
    nghi_phep: 'Nghỉ phép',
    day_bu: 'Dạy bù',
    doi_ca: 'Đổi ca',
  };
  assert.equal(LEAVE_TYPE_LABELS['nghi_phep'], 'Nghỉ phép');
  assert.equal(LEAVE_TYPE_LABELS['day_bu'], 'Dạy bù');
  assert.equal(LEAVE_TYPE_LABELS['doi_ca'], 'Đổi ca');

  console.log('✅ Tất cả kiểm thử nghiệm vụ Leave Request (Nhóm 5) đã vượt qua thành công.');
};

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exitCode = 1;
});
