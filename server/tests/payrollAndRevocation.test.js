const assert = require('assert');
const mongoose = require('mongoose');
const Payroll = require('../models/payroll.model');
const { isTokenRevoked, revokeToken } = require('../utils/tokenRevocation');

async function testPayrollAndRevocation() {
  console.log('--- Bắt đầu Test Suite: Payroll Model (Collection 11) & In-Memory Token Revocation ---');

  // Test 1: Payroll validation thành công với đầy đủ trường bắt buộc
  const dummyUser = new mongoose.Types.ObjectId();
  const validPayroll = new Payroll({
    nguoi_dung_id: dummyUser,
    thang: 10,
    nam: 2026,
    nguoi_lap_id: dummyUser,
    he_so_luong: 2.34,
    luong_co_so: 2340000,
    luong_chinh: 2.34 * 2340000,
    tong_thu_nhap_gross: 12000000,
    thuc_linh_net: 10500000,
  });

  const validationError = validPayroll.validateSync();
  assert.strictEqual(validationError, undefined, 'Phiếu lương hợp lệ không được có lỗi validation');
  console.log('✓ Test 1 ĐẠT: Payroll Model khởi tạo và validate thành công với dữ liệu hợp lệ.');

  // Test 2: Payroll bắt lỗi khi thiếu trường bắt buộc
  const invalidPayroll = new Payroll({
    thang: 15, // Sai: tháng phải từ 1 đến 12
  });
  const err = invalidPayroll.validateSync();
  assert(err, 'Phải có lỗi validation khi dữ liệu không hợp lệ');
  assert(err.errors.nguoi_dung_id, 'Thiếu nguoi_dung_id phải báo lỗi');
  assert(err.errors.nam, 'Thiếu nam phải báo lỗi');
  assert(err.errors.thang, 'Tháng 15 phải báo lỗi');
  console.log('✓ Test 2 ĐẠT: Payroll bắt lỗi chính xác khi thiếu trường bắt buộc và tháng vượt quá 12.');

  // Test 3: Dual-standard Alias của Payroll
  const aliasPayroll = new Payroll({
    userId: dummyUser,
    month: 11,
    year: 2026,
    createdBy: dummyUser,
    salaryCoefficient: 3.0,
    baseSalary: 2340000,
    primarySalary: 7020000,
    grossIncome: 15000000,
    netSalary: 13000000,
  });
  assert.strictEqual(aliasPayroll.thang, 11);
  assert.strictEqual(aliasPayroll.nam, 2026);
  assert.strictEqual(aliasPayroll.he_so_luong, 3.0);
  assert.strictEqual(aliasPayroll.tong_thu_nhap_gross, 15000000);
  assert.strictEqual(aliasPayroll.thuc_linh_net, 13000000);
  console.log('✓ Test 3 ĐẠT: Dual-standard Aliases của Payroll (userId, month, year, netSalary) ánh xạ chuẩn xác.');

  // Test 4: In-memory token revocation
  const testToken = 'sample_jwt_token_for_logout_test_12345';
  assert.strictEqual(isTokenRevoked(testToken), false, 'Token ban đầu chưa bị revoke');

  revokeToken(testToken, Date.now() + 60000); // Thu hồi 60s
  assert.strictEqual(isTokenRevoked(testToken), true, 'Token phải ở trạng thái đã bị revoke sau khi gọi revokeToken');

  // Token hết hạn
  const expiredToken = 'expired_revoked_token';
  revokeToken(expiredToken, Date.now() - 1000); // Đã hết hạn
  assert.strictEqual(isTokenRevoked(expiredToken), false, 'Token thu hồi đã quá hạn thì tự giải phóng');
  console.log('✓ Test 4 ĐẠT: In-memory token revocation hoạt động chính xác không cần bảng CSDL.');

  console.log('\n===> TẤT CẢ TEST TRONG PAYROLL & REVOCATION ĐÃ PASS 100% <===\n');
}

testPayrollAndRevocation().catch((err) => {
  console.error('LỖI TEST PAYROLL:', err);
  process.exit(1);
});
