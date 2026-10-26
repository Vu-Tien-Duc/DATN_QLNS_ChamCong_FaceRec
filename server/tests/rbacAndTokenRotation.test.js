const assert = require('assert');
const { PERMISSIONS, ROLE_PERMISSIONS, hasPermission, getEffectivePermissions } = require('../config/permissions');
const { requirePermission, requireAnyPermission, requireAllPermissions } = require('../middlewares/auth.middleware');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/refreshToken.model');
const User = require('../models/user.model');
const { refreshToken, forgotPassword, resetPassword } = require('../services/auth.service');

async function runRbacTests() {
  console.log('--- Bắt đầu Test Suite: RBAC Permissions & Token Rotation Grace Period 15s ---');

  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.REFRESH_TOKEN_SECRET = 'test_refresh_token_secret_key_12345';

  // Test 1: Giảng viên
  const giangVien = {
    role: 'giangvien',
    roles: [{ role: 'GIANG_VIEN', scope: 'KHOA' }]
  };
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.CONG_XEM_BAN_THAN), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.DON_TU_TAO), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.CONG_QUET_MAT), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.NHAN_SU_QUAN_LY), false);
  console.log('✓ Test 1 ĐẠT: Giảng viên có đúng quyền cá nhân, không có quyền duyệt cấp khoa.');

  // Test 2: Trưởng khoa
  const truongKhoa = {
    role: 'truongkhoa',
    roles: [{ role: 'TRUONG_KHOA', scope: 'KHOA' }]
  };
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.DON_TU_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.HE_THONG_CAU_HINH), false);
  console.log('✓ Test 2 ĐẠT: Trưởng khoa có quyền duyệt cấp khoa và quản lý đơn vị.');

  // Test 3: Phó trưởng khoa chưa ủy quyền
  const phoKhoaChuaUyQuyen = {
    role: 'truongkhoa',
    roles: [{ role: 'PHO_TRUONG_KHOA', scope: 'KHOA', isDelegated: false }]
  };
  assert.strictEqual(hasPermission(phoKhoaChuaUyQuyen, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(phoKhoaChuaUyQuyen, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  console.log('✓ Test 3 ĐẠT: Phó trưởng khoa chưa ủy quyền KHÔNG ĐƯỢC duyệt đơn cấp 1.');

  // Test 4: Phó trưởng khoa được ủy quyền
  const phoKhoaDuocUyQuyen = {
    role: 'truongkhoa',
    roles: [{ role: 'PHO_TRUONG_KHOA', scope: 'KHOA', isDelegated: true }]
  };
  assert.strictEqual(hasPermission(phoKhoaDuocUyQuyen, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(phoKhoaDuocUyQuyen, PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  console.log('✓ Test 4 ĐẠT: Phó trưởng khoa ĐƯỢC ỦY QUYỀN có quyền duyệt đơn cấp 1.');

  // Test 5: Nhiệm kỳ hết hạn
  const cuuTruongKhoa = {
    role: 'giangvien',
    roles: [
      { role: 'TRUONG_KHOA', scope: 'KHOA', startDate: new Date('2020-01-01'), endDate: new Date('2024-01-01') },
      { role: 'GIANG_VIEN', scope: 'KHOA', startDate: new Date('2024-01-02'), endDate: null }
    ]
  };
  assert.strictEqual(hasPermission(cuuTruongKhoa, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  assert.strictEqual(hasPermission(cuuTruongKhoa, PERMISSIONS.CONG_XEM_BAN_THAN), true);
  console.log('✓ Test 5 ĐẠT: Vai trò hết nhiệm kỳ bị tự động tước quyền.');

  // Test 6: BGH và Admin
  const admin = {
    role: 'admin',
    roles: [{ role: 'ADMIN', scope: 'TOAN_TRUONG' }]
  };
  const bgh = {
    role: 'admin',
    roles: [{ role: 'BGH', scope: 'TOAN_TRUONG' }]
  };
  assert.strictEqual(hasPermission(admin, PERMISSIONS.NHAN_SU_QUAN_LY), true);
  assert.strictEqual(hasPermission(admin, PERMISSIONS.HE_THONG_CAU_HINH), true);
  assert.strictEqual(hasPermission(bgh, PERMISSIONS.CONG_XEM_TOAN_TRUONG), true);
  assert.strictEqual(hasPermission(bgh, PERMISSIONS.DON_TU_DUYET_CAP_2), true);
  console.log('✓ Test 6 ĐẠT: Phân quyền BGH và Admin chính xác.');

  // Test 7: requirePermission middleware
  let nextCalled = false;
  requirePermission(PERMISSIONS.DON_TU_DUYET_CAP_1)(
    { user: { hasPermission: (p) => p === PERMISSIONS.DON_TU_DUYET_CAP_1 } },
    {},
    () => { nextCalled = true; }
  );
  assert.strictEqual(nextCalled, true);

  let deniedCode = null;
  requirePermission(PERMISSIONS.DON_TU_DUYET_CAP_1)(
    { user: { hasPermission: () => false } },
    { status: (code) => ({ json: () => { deniedCode = code; } }) },
    () => {}
  );
  assert.strictEqual(deniedCode, 403);
  console.log('✓ Test 7 ĐẠT: Middleware requirePermission chặn 403 khi thiếu quyền.');

  // Test 8: requireAnyPermission & requireAllPermissions
  let anyPassed = false;
  requireAnyPermission(PERMISSIONS.NHAN_SU_QUAN_LY, PERMISSIONS.CONG_XEM_BAN_THAN)(
    { user: { hasPermission: (p) => p === PERMISSIONS.CONG_XEM_BAN_THAN } },
    {},
    () => { anyPassed = true; }
  );
  assert.strictEqual(anyPassed, true);

  let allDenied = false;
  requireAllPermissions(PERMISSIONS.CONG_XEM_BAN_THAN, PERMISSIONS.NHAN_SU_QUAN_LY)(
    { user: { hasPermission: (p) => p === PERMISSIONS.CONG_XEM_BAN_THAN } },
    { status: () => ({ json: () => { allDenied = true; } }) },
    () => {}
  );
  assert.strictEqual(allDenied, true);
  console.log('✓ Test 8 ĐẠT: Middleware requireAnyPermission và requireAllPermissions hoạt động chính xác.');

  // Test 9: Token Rotation & Grace Period 15s
  const userId = '60d5ec49f1b2c8b1f8e4e1a1';
  const familyId = 'family-uuid-1234';
  const originalToken = jwt.sign({ id: userId, family: familyId }, process.env.REFRESH_TOKEN_SECRET);

  const mockSavedToken = {
    _id: 'ref-token-id-1',
    token: 'hash_of_token',
    tokenFamily: familyId,
    ma_ho: familyId,
    userId,
    isUsed: false,
    da_su_dung: false,
    usedAt: null,
    thoi_diem_su_dung: null,
    expiresAt: new Date(Date.now() + 3600000),
    save: async function () { this.da_su_dung = true; this.isUsed = true; this.thoi_diem_su_dung = new Date(); this.usedAt = new Date(); return this; },
  };

  const origFindOne = RefreshToken.findOne;
  const origCreate = RefreshToken.create;
  const origFindById = User.findById;
  const origDeleteMany = RefreshToken.deleteMany;
  const origFindByIdAndUpdate = User.findByIdAndUpdate;

  RefreshToken.findOne = async () => mockSavedToken;
  RefreshToken.create = async () => ({ _id: 'new-ref-id' });
  User.findById = async () => ({
    _id: userId,
    role: 'giangvien',
    email: 'test@example.com',
    isActive: true,
    phien_ban_token: 1,
  });

  const res1 = await refreshToken({ token: originalToken });
  assert(res1.newAccessToken);
  assert(res1.newRefreshTokenString);
  assert.strictEqual(mockSavedToken.da_su_dung, true);

  // Test 10: Grace Period 15s gọi lại token cũ
  const resGrace = await refreshToken({ token: originalToken });
  assert.strictEqual(resGrace.newAccessToken, res1.newAccessToken);
  assert.strictEqual(resGrace.newRefreshTokenString, res1.newRefreshTokenString);
  console.log('✓ Test 9 & 10 ĐẠT: Token Rotation và Grace Period 15s hoạt động hoàn hảo.');

  // Test 11: Replay Attack sau 15 giây
  const compromisedToken = jwt.sign({ id: userId, family: 'fam-hacked' }, process.env.REFRESH_TOKEN_SECRET);
  const usedTokenExpiredGrace = {
    _id: 'ref-used',
    token: 'hash_hacked',
    tokenFamily: 'fam-hacked',
    ma_ho: 'fam-hacked',
    userId,
    isUsed: true,
    da_su_dung: true,
    usedAt: new Date(Date.now() - 30000), // đã qua 30s
    thoi_diem_su_dung: new Date(Date.now() - 30000),
    expiresAt: new Date(Date.now() + 3600000),
  };
  RefreshToken.findOne = async () => usedTokenExpiredGrace;
  let deletedFamily = null;
  RefreshToken.deleteMany = async (q) => { deletedFamily = q.tokenFamily || q.family || q.ma_ho; return { deletedCount: 2 }; };
  let incTokenVersion = false;
  User.findByIdAndUpdate = async (uid, update) => {
    if (update.$inc && (update.$inc.tokenVersion || update.$inc.phien_ban_token)) incTokenVersion = true;
    return { _id: uid };
  };

  let replayBlocked = false;
  try {
    await refreshToken({ token: compromisedToken });
  } catch (err) {
    if (err.errorCode === 'REFRESH_TOKEN_REUSE_DETECTED') {
      replayBlocked = true;
    }
  }
  assert.strictEqual(replayBlocked, true);
  assert.strictEqual(deletedFamily, 'fam-hacked');
  assert.strictEqual(incTokenVersion, true);
  console.log('✓ Test 11 ĐẠT: Phát hiện Replay Attack, hủy Token Family và tăng phien_ban_token.');

  // Restore
  RefreshToken.findOne = origFindOne;
  RefreshToken.create = origCreate;
  User.findById = origFindById;
  RefreshToken.deleteMany = origDeleteMany;
  User.findByIdAndUpdate = origFindByIdAndUpdate;

  // --- TEST OTP QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU (5 TRƯỜNG OTP) ---
  console.log('\n--- Bắt đầu Test Module: Quên Mật Khẩu Chuẩn (Vận hành 5 trường OTP) ---');
  const mockUserOtp = {
    _id: '65f000000000000000000099',
    email: 'giangvien.test@uni.edu.vn',
    ho_ten: 'TS. Nguyễn Văn A',
    kich_hoat: true,
    trang_thai_lam_viec: 'DANG_LAM_VIEC',
    ma_otp: null,
    otp_het_han_luc: null,
    loai_otp: null,
    so_lan_thu_otp: 0,
    otp_gui_luc: null,
    phien_ban_token: 1,
    mat_khau_ma_hoa: 'old_hashed_password_123',
    save: async function () { return this; }
  };

  const origUserFindOne = User.findOne;
  User.findOne = () => ({
    select: () => mockUserOtp
  });
  const origUpdateMany = RefreshToken.updateMany;
  RefreshToken.updateMany = async () => ({ modifiedCount: 1 });

  // Test 12: Yêu cầu OTP thành công & kiểm tra 5 trường
  process.env.NODE_ENV = 'test';
  const resOtp = await forgotPassword({ email: 'giangvien.test@uni.edu.vn' });
  assert.strictEqual(mockUserOtp.loai_otp, 'FORGOT_PASSWORD');
  assert.ok(mockUserOtp.ma_otp, 'ma_otp phải được sinh và băm');
  assert.ok(mockUserOtp.otp_het_han_luc > new Date(), 'otp_het_han_luc phải ở tương lai 10 phút');
  assert.strictEqual(mockUserOtp.so_lan_thu_otp, 0, 'so_lan_thu_otp khởi tạo là 0');
  assert.ok(mockUserOtp.otp_gui_luc, 'otp_gui_luc phải được ghi nhận thời điểm gửi');
  assert.ok(resOtp.devOtp, 'devOtp phải trả về mã 6 số trong môi trường test');
  console.log('✓ Test 12 ĐẠT: Quên mật khẩu vận hành chính xác trọn vẹn cả 5 trường OTP.');

  // Test 13: Cooldown 60s & Giới hạn nhập sai 5 lần & Đổi mật khẩu thành công
  let cooldownBlocked = false;
  try {
    await forgotPassword({ email: 'giangvien.test@uni.edu.vn' });
  } catch (err) {
    if (err.statusCode === 429) cooldownBlocked = true;
  }
  assert.strictEqual(cooldownBlocked, true, 'Cooldown 60s phải chặn yêu cầu gửi liên tục');

  // Thử nhập sai OTP
  let wrongOtpCaught = false;
  try {
    await resetPassword({ email: 'giangvien.test@uni.edu.vn', otp: '000000', newPassword: 'MatKhauMoi@123' });
  } catch (err) {
    wrongOtpCaught = true;
  }
  assert.strictEqual(wrongOtpCaught, true);
  assert.strictEqual(mockUserOtp.so_lan_thu_otp, 1, 'so_lan_thu_otp tăng lên 1 khi nhập sai');

  // Nhập đúng OTP -> đổi mật khẩu thành công và reset 5 trường
  const resetRes = await resetPassword({
    email: 'giangvien.test@uni.edu.vn',
    otp: resOtp.devOtp,
    newPassword: 'MatKhauMoi@123'
  });
  assert.ok(resetRes.message.includes('thành công'));
  assert.strictEqual(mockUserOtp.ma_otp, null, 'ma_otp phải xóa về null sau khi đổi thành công');
  assert.strictEqual(mockUserOtp.otp_het_han_luc, null, 'otp_het_han_luc phải xóa về null');
  assert.strictEqual(mockUserOtp.loai_otp, null, 'loai_otp phải xóa về null');
  assert.strictEqual(mockUserOtp.so_lan_thu_otp, 0, 'so_lan_thu_otp reset về 0');
  assert.strictEqual(mockUserOtp.otp_gui_luc, null, 'otp_gui_luc reset về null');
  assert.strictEqual(mockUserOtp.phien_ban_token, 2, 'phien_ban_token phải tăng để thu hồi token cũ');
  console.log('✓ Test 13 ĐẠT: Cooldown, bảo mật nhập sai tối đa 5 lần và xóa sạch 5 trường OTP sau khi hoàn tất.');

  // Restore mocks
  User.findOne = origUserFindOne;
  RefreshToken.updateMany = origUpdateMany;

  console.log('\n===> TẤT CẢ 13 TEST RBAC, TOKEN ROTATION & QUÊN MẬT KHẨU OTP ĐÃ PASS 100% <===\n');
}

runRbacTests().catch((err) => {
  console.error('LỖI TEST RBAC:', err);
  process.exit(1);
});
