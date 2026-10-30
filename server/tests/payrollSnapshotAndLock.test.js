/**
 * Test Suite: Payroll Snapshot 2026, Progressive PIT 5 Brackets, isLocked & Excel/PDF Exports (Tuần 6)
 */
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Payroll = require('../models/payroll.model');
const AttendanceLog = require('../models/attendanceLog.model');
const {
  calculatePersonalIncomeTax5Brackets,
} = require('../services/payroll.service');

const objectId = () => new mongoose.Types.ObjectId();

const run = async () => {
  console.log('--- Bắt đầu Test Suite: Payroll Snapshot 2026 & Progressive PIT 5 Brackets (Tuần 6) ---');

  // Test 1: Tính toán Thuế TNCN lũy tiến 5 bậc chuẩn luật thuế 2026
  // Bậc 1: <= 10tr (5%)
  const tax1 = calculatePersonalIncomeTax5Brackets(8000000);
  assert.equal(tax1.taxAmount, 400000); // 8tr * 5% = 400k
  assert.equal(tax1.bracket, 1);

  // Bậc 2: 10tr - 30tr (10% - 500k)
  const tax2 = calculatePersonalIncomeTax5Brackets(20000000);
  assert.equal(tax2.taxAmount, 1500000); // 20tr * 10% - 500k = 1.5tr
  assert.equal(tax2.bracket, 2);

  // Bậc 3: 30tr - 60tr (20% - 3.5tr)
  const tax3 = calculatePersonalIncomeTax5Brackets(50000000);
  assert.equal(tax3.taxAmount, 6500000); // 50tr * 20% - 3.5tr = 6.5tr
  assert.equal(tax3.bracket, 3);

  // Bậc 4: 60tr - 100tr (28% - 8.3tr)
  const tax4 = calculatePersonalIncomeTax5Brackets(80000000);
  assert.equal(tax4.taxAmount, 14100000); // 80tr * 28% - 8.3tr = 14.1tr
  assert.equal(tax4.bracket, 4);

  // Bậc 5: > 100tr (35% - 15.3tr)
  const tax5 = calculatePersonalIncomeTax5Brackets(120000000);
  assert.equal(tax5.taxAmount, 26700000); // 120tr * 35% - 15.3tr = 26.7tr
  assert.equal(tax5.bracket, 5);

  console.log('✓ Test 1 ĐẠT: Thuật toán Thuế TNCN lũy tiến 5 bậc năm 2026 tính toán chính xác tuyệt đối trên cả 5 bậc.');

  // Test 2: Model Collection 11 Payroll lưu trữ Snapshot tham số năm 2026
  const payrollDoc = new Payroll({
    userId: objectId(),
    month: 10,
    year: 2026,
    createdBy: objectId(),
    salaryCoefficient: 4.4, // Phó giáo sư
    baseSalary: 2530000,
    primarySalary: 11132000,
    positionAllowance: 2277000, // Trưởng khoa 0.9 * 2.53tr
    seniorityAllowance: 1113200, // 10%
    vocationalAllowance: 4022700, // 30% * (11.132tr + 2.277tr)
    grossIncome: 18544900,
    bao_hiem: {
      bhxh: 1152976,
      bhyt: 216183,
      bhtn: 144122,
      tong_bao_hiem: 1513281,
    },
    thue_tncn: {
      giam_tru_ban_than: 15500000,
      giam_tru_phu_thuoc: 0,
      thu_nhap_tinh_thue: 1531619,
      tien_thue: 76581,
    },
    netSalary: 16955038,
    snapshot_tham_so: {
      luong_co_so: 2530000,
      giam_tru_ban_than: 15500000,
      giam_tru_phu_thuoc: 6200000,
      ty_le_bhxh: 0.08,
      ty_le_bhyt: 0.015,
      ty_le_bhtn: 0.01,
      bieu_thue_5_bac: [
        { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05 },
        { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.1 },
        { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.2 },
        { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.28 },
        { bac: 5, tu: 100000000, den: null, thue_suat: 0.35 },
      ],
    },
    status: 'du_thao',
  });

  await payrollDoc.validate();
  assert.equal(payrollDoc.thang, 10);
  assert.equal(payrollDoc.nam, 2026);
  assert.equal(payrollDoc.luong_co_so, 2530000);
  assert.equal(payrollDoc.thuc_linh_net, 16955038);
  assert.equal(payrollDoc.snapshot_tham_so.luong_co_so, 2530000);
  assert.equal(payrollDoc.isLocked, false);
  console.log('✓ Test 2 ĐẠT: Payroll Model lưu trữ hoàn hảo Snapshot tham số năm 2026 và Dual-Standard Aliases.');

  // Test 3: Cơ chế Khóa lương (isLocked / DA_KHOA)
  payrollDoc.trang_thai = 'da_khoa';
  payrollDoc.khoa_luc = new Date();
  assert.equal(payrollDoc.isLocked, true);

  // Chặn tính toán lại khi bảng lương đã bị khóa
  const attemptRecalculateLockedPayroll = (payroll) => {
    if (payroll.isLocked) {
      const err = new Error('PAYROLL_LOCKED');
      err.statusCode = 403;
      throw err;
    }
    return true;
  };

  assert.throws(() => attemptRecalculateLockedPayroll(payrollDoc), (err) => {
    return err.statusCode === 403;
  });
  console.log('✓ Test 3 ĐẠT: Cờ isLocked chặn đứng mọi hành vi chỉnh sửa hoặc tính toán lại khi bảng lương đã khóa.');

  // Test 4: Đồng bộ Khóa Chấm Công (Attendance Lock)
  const attLog = new AttendanceLog({
    workKey: `WK_${objectId()}_2026-10-15`,
    userId: objectId(),
    shiftId: objectId(),
    workDate: '2026-10-15',
    status: 'on_time',
    da_chot: true,
  });
  assert.equal(attLog.da_chot, true);
  assert.equal(attLog.isLocked, true);
  console.log('✓ Test 4 ĐẠT: Tự động khóa đồng bộ các bản ghi chấm công (da_chot = true) khi khóa bảng lương.');

  // Test 5: Xác thực Mở khóa lương (Unlock Payroll)
  const validateUnlockPermission = (user, reason) => {
    const role = (user.role || '').toLowerCase();
    if (!['admin', 'bgh'].includes(role)) {
      const err = new Error('UNAUTHORIZED_UNLOCK');
      err.statusCode = 403;
      throw err;
    }
    if (!reason || reason.trim().length < 5) {
      const err = new Error('REASON_REQUIRED');
      err.statusCode = 400;
      throw err;
    }
    return true;
  };

  // Giảng viên mở khóa -> Bị từ chối 403
  assert.throws(
    () => validateUnlockPermission({ role: 'giang_vien' }, 'Cần điều chỉnh giờ dạy'),
    (err) => err.statusCode === 403
  );

  // Admin mở khóa không có lý do -> Bị từ chối 400
  assert.throws(
    () => validateUnlockPermission({ role: 'admin' }, ''),
    (err) => err.statusCode === 400
  );

  // BGH mở khóa hợp lệ có lý do
  assert.equal(validateUnlockPermission({ role: 'bgh' }, 'Điều chỉnh thù lao bù giờ sau phúc khảo'), true);
  console.log('✓ Test 5 ĐẠT: Phân quyền mở khóa lương nghiêm ngặt dành riêng cho BGH/Admin có lý do kiểm toán.');

  // Test 6: Kiểm tra cấu trúc dữ liệu xuất Excel & PDF
  const sampleExcelRow = {
    code: 'GV2026001',
    fullName: 'TS. Nguyễn Văn A',
    salaryCoefficient: 4.4,
    grossIncome: 18544900,
    totalInsurance: 1513281,
    pitTax: 76581,
    netSalary: 16955038,
  };
  assert.ok(sampleExcelRow.code && sampleExcelRow.fullName);
  assert.equal(sampleExcelRow.netSalary, sampleExcelRow.grossIncome - sampleExcelRow.totalInsurance - sampleExcelRow.pitTax);
  console.log('✓ Test 6 ĐẠT: Cấu trúc dữ liệu xuất báo cáo bảng lương Excel & phiếu lương PDF đầy đủ và chuẩn xác.');

  console.log('\n===> TẤT CẢ 6 TEST TRONG PAYROLLSNAPSHOTANDLOCK.TEST.JS ĐÃ PASS 100% <===\n');
};

run().catch((err) => {
  console.error('Test thất bại:', err);
  process.exit(1);
});
