const assert = require('assert');
const { PERMISSIONS, ROLE_PERMISSIONS, hasPermission, getEffectivePermissions } = require('../config/permissions');
const { requirePermission, requireAnyPermission, requireAllPermissions } = require('../middlewares/auth.middleware');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/refreshToken.model');
const User = require('../models/user.model');
const { refreshToken } = require('../services/auth.service');

async function runRbacTests() {
  console.log('--- Bắt đầu Test Suite: RBAC Permissions & Token Rotation Grace Period 15s ---');

  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.REFRESH_TOKEN_SECRET = 'test_refresh_token_secret_key_12345';

  // Test 1: Giảng viên
  const giangVien = {
    vai_tro_chinh: 'giangvien',
    danh_sach_vai_tro: [{ ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA' }]
  };
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.CONG_XEM_BAN_THAN), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.DON_TU_TAO), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.CONG_QUET_MAT), true);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  assert.strictEqual(hasPermission(giangVien, PERMISSIONS.NHAN_SU_QUAN_LY), false);
  console.log('✓ Test 1 ĐẠT: Giảng viên có đúng quyền cá nhân, không có quyền duyệt cấp khoa.');

  // Test 2: Trưởng khoa
  const truongKhoa = {
    vai_tro_chinh: 'truongkhoa',
    danh_sach_vai_tro: [{ ma_vai_tro: 'TRUONG_KHOA', pham_vi: 'KHOA' }]
  };
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.DON_TU_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(truongKhoa, PERMISSIONS.HE_THONG_CAU_HINH), false);
  console.log('✓ Test 2 ĐẠT: Trưởng khoa có quyền duyệt cấp khoa và quản lý đơn vị.');

  // Test 3: Phó trưởng khoa chưa ủy quyền
  const phoKhoaChuaUyQuyen = {
    vai_tro_chinh: 'truongkhoa',
    danh_sach_vai_tro: [{ ma_vai_tro: 'PHO_TRUONG_KHOA', pham_vi: 'KHOA', duoc_uy_quyen: false }]
  };
  assert.strictEqual(hasPermission(phoKhoaChuaUyQuyen, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(phoKhoaChuaUyQuyen, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  console.log('✓ Test 3 ĐẠT: Phó trưởng khoa chưa ủy quyền KHÔNG ĐƯỢC duyệt đơn cấp 1.');

  // Test 4: Phó trưởng khoa được ủy quyền
  const phoKhoaDuocUyQuyen = {
    vai_tro_chinh: 'truongkhoa',
    danh_sach_vai_tro: [{ ma_vai_tro: 'PHO_TRUONG_KHOA', pham_vi: 'KHOA', duoc_uy_quyen: true }]
  };
  assert.strictEqual(hasPermission(phoKhoaDuocUyQuyen, PERMISSIONS.CONG_XEM_DON_VI), true);
  assert.strictEqual(hasPermission(phoKhoaDuocUyQuyen, PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  console.log('✓ Test 4 ĐẠT: Phó trưởng khoa ĐƯỢC ỦY QUYỀN có quyền duyệt đơn cấp 1.');

  // Test 5: Nhiệm kỳ hết hạn
  const cuuTruongKhoa = {
    vai_tro_chinh: 'giangvien',
    danh_sach_vai_tro: [
      { ma_vai_tro: 'TRUONG_KHOA', pham_vi: 'KHOA', tu_ngay: new Date('2020-01-01'), den_ngay: new Date('2024-01-01') },
      { ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA', tu_ngay: new Date('2024-01-02'), den_ngay: null }
    ]
  };
  assert.strictEqual(hasPermission(cuuTruongKhoa, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
  assert.strictEqual(hasPermission(cuuTruongKhoa, PERMISSIONS.CONG_XEM_BAN_THAN), true);
  console.log('✓ Test 5 ĐẠT: Vai trò hết nhiệm kỳ bị tự động tước quyền.');

  // Test 6: BGH và Admin
  const admin = {
    vai_tro_chinh: 'admin',
    danh_sach_vai_tro: [{ ma_vai_tro: 'ADMIN', pham_vi: 'TOAN_TRUONG' }]
  };
  const bgh = {
    vai_tro_chinh: 'admin',
    danh_sach_vai_tro: [{ ma_vai_tro: 'BGH', pham_vi: 'TOAN_TRUONG' }]
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
    ma_ho: familyId,
    userId,
    da_su_dung: false,
    thoi_diem_su_dung: null,
    expiresAt: new Date(Date.now() + 3600000),
    save: async function () { this.da_su_dung = true; this.thoi_diem_su_dung = new Date(); return this; },
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
    ma_ho: 'fam-hacked',
    userId,
    da_su_dung: true,
    thoi_diem_su_dung: new Date(Date.now() - 30000), // đã qua 30s
    expiresAt: new Date(Date.now() + 3600000),
  };
  RefreshToken.findOne = async () => usedTokenExpiredGrace;
  let deletedFamily = null;
  RefreshToken.deleteMany = async (q) => { deletedFamily = q.ma_ho; return { deletedCount: 2 }; };
  let incTokenVersion = false;
  User.findByIdAndUpdate = async (uid, update) => {
    if (update.$inc && update.$inc.phien_ban_token) incTokenVersion = true;
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

  console.log('\n===> TẤT CẢ 11 TEST RBAC & TOKEN ROTATION ĐÃ PASS 100% <===\n');
}

runRbacTests().catch((err) => {
  console.error('LỖI TEST RBAC:', err);
  process.exit(1);
});
