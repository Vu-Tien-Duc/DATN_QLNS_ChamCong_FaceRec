// Kiểm thử phân quyền RBAC đa vai trò, lọc lịch đổi ca, mã QR động và hàng rào địa lý GPS/IP.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';

const { PERMISSIONS, getEffectivePermissions, hasPermission } = require('../config/permissions');
const { getActiveRoles } = require('../middlewares/xacThuc.middleware');
const { hasAnyActiveRole } = require('../utils/vaiTro.utils');
const { isScheduleActiveOnDate } = require('../utils/ngayLichTrinh.utils');
const {
  generateDynamicQRCode,
  verifyDynamicQRCode,
  verifyCampusNetwork,
  validateGeofence,
} = require('../utils/hoTroChamCong');

describe('RBAC Permissions & Active Roles', () => {
  it('luôn hợp nhất quyền từ vai_tro_chinh và các vai trò phụ còn hiệu lực', () => {
    const user = {
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [
        { ma_vai_tro: 'truong_bo_mon', tu_ngay: '2020-01-01', den_ngay: '2099-12-31' },
      ],
    };

    const perms = getEffectivePermissions(user);
    assert.equal(perms.has(PERMISSIONS.DON_TU_TAO), true);
    assert.equal(perms.has(PERMISSIONS.DON_TU_DUYET_CAP_1), true);
    assert.equal(hasPermission(user, PERMISSIONS.LICH_XEP_LICH), true);
  });

  it('bỏ qua vai trò chưa đến ngày hiệu lực (tu_ngay ở tương lai) hoặc đã hết hạn (den_ngay ở quá khứ)', () => {
    const user = {
      vai_tro_chinh: 'nhan_vien',
      danh_sach_vai_tro: [
        { ma_vai_tro: 'truong_khoa', tu_ngay: '2099-01-01', den_ngay: '2099-12-31' },
        { ma_vai_tro: 'admin', tu_ngay: '2020-01-01', den_ngay: '2020-12-31' },
      ],
    };

    const activeRoles = getActiveRoles(user);
    assert.equal(activeRoles.has('nhan_vien'), true);
    assert.equal(activeRoles.has('truong_khoa'), false);
    assert.equal(activeRoles.has('admin'), false);
    assert.equal(hasPermission(user, PERMISSIONS.HE_THONG_CAU_HINH), false);
    assert.equal(hasPermission(user, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
    assert.equal(hasAnyActiveRole(user, ['truong_khoa', 'admin']), false);
    assert.equal(hasAnyActiveRole(user, ['nhan_vien']), true);
  });

  it('chỉ cấp quyền duyệt cấp 1 cho phó đơn vị khi vai trò có cờ duoc_uy_quyen = true', () => {
    const nonDelegatedVice = {
      vai_tro_chinh: 'pho_khoa',
      danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: false }],
    };
    const delegatedVice = {
      vai_tro_chinh: 'pho_khoa',
      danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: true }],
    };

    assert.equal(hasPermission(nonDelegatedVice, PERMISSIONS.DON_TU_DUYET_CAP_1), false);
    assert.equal(hasPermission(delegatedVice, PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  });

  it('cấp đủ quyền tự chấm công, giải trình và tạo/hủy đơn cho khối tccb, dao_tao, ke_toan (trừ admin và bgh)', () => {
    for (const role of ['tccb', 'dao_tao', 'ke_toan']) {
      const staff = { vai_tro_chinh: role, danh_sach_vai_tro: [] };
      assert.equal(hasPermission(staff, PERMISSIONS.DON_TU_TAO), true, `${role} phải có DON_TU_TAO`);
      assert.equal(hasPermission(staff, PERMISSIONS.DON_TU_HUY), true, `${role} phải có DON_TU_HUY`);
      assert.equal(hasPermission(staff, PERMISSIONS.CONG_QUET_MAT), true, `${role} phải có CONG_QUET_MAT`);
      assert.equal(hasPermission(staff, PERMISSIONS.CONG_GIAI_TRINH), true, `${role} phải có CONG_GIAI_TRINH`);
    }
    assert.equal(hasPermission({ vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] }, PERMISSIONS.CONG_QUET_MAT), false);
    assert.equal(hasPermission({ vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] }, PERMISSIONS.DON_TU_TAO), false);
  });

  it('loại trừ lịch gốc đã đổi ca sang giảng viên dạy thay và giữ nguyên bản ghi cho người dạy thay', () => {
    const ownerSchedule = {
      id: 'sch-1',
      nguoi_dung_id: 'owner-1',
      ngay_bat_dau: '2026-09-01',
      ngoai_le: [{ ngay: '2026-09-08', trang_thai: 'doi_ca', giang_vien_day_thay_id: 'sub-2' }],
    };
    const substituteSchedule = { ...ownerSchedule, _isSubstituteOverride: true };

    assert.equal(isScheduleActiveOnDate(ownerSchedule, '2026-09-08'), false);
    assert.equal(isScheduleActiveOnDate(substituteSchedule, '2026-09-08'), true);
  });
});

describe('Dynamic QR & Geofence Security', () => {
  it('ký và xác minh mã QR động hợp lệ, đồng thời từ chối chữ ký giả mạo', () => {
    const generated = generateDynamicQRCode({ roomId: 'A101' });
    const validRes = verifyDynamicQRCode(generated.qrToken);
    assert.equal(validRes.valid, true);
    assert.equal(validRes.data.room, 'A101');

    const tampered = `${generated.qrToken.slice(0, -4)}ffff`;
    const tamperedRes = verifyDynamicQRCode(tampered);
    assert.equal(tamperedRes.valid, false);
  });

  it('từ chối mã QR có timestamp nằm ở tương lai (> 5 giây)', () => {
    const crypto = require('crypto');
    const secret = crypto.createHmac('sha256', process.env.JWT_SECRET).update('attendance-qr').digest();
    const payloadBase64 = Buffer.from(
      JSON.stringify({ type: 'ATT_QR', timestamp: Date.now() + 60000, nonce: 'future01' })
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex').substring(0, 32);
    const futureToken = `${payloadBase64}.${sig}`;

    const res = verifyDynamicQRCode(futureToken);
    assert.equal(res.valid, false);
  });

  it('kiểm tra CIDR hợp lệ và chặn CAMPUS_IP_OVERRIDE khi GPS cách trường quá xa', () => {
    assert.equal(verifyCampusNetwork('192.168.10.25', ['192.168.0.0/16']).isCampusIp, true);
    assert.equal(verifyCampusNetwork('not-an-ip', ['192.168.0.0/16']).isCampusIp, false);

    // Tọa độ tại TP.HCM (~1100km so với Hà Đông) dù đi qua IP localhost vẫn phải báo gian lận
    const farAwayResult = validateGeofence(
      { lat: 10.7769, lng: 106.7009, accuracy: 10 },
      { lat: 20.9752, lng: 105.7628, name: 'NTU' },
      150,
      '127.0.0.1'
    );
    assert.equal(farAwayResult.valid, false);
    assert.equal(farAwayResult.isFraud, true);

    // Sai số trong nhà (cách tâm ~220m, trong ngưỡng drift) qua mạng nội bộ vẫn hợp lệ
    const indoorDriftResult = validateGeofence(
      { lat: 20.9770, lng: 105.7628, accuracy: 20 },
      { lat: 20.9752, lng: 105.7628, name: 'NTU' },
      150,
      '127.0.0.1'
    );
    assert.equal(indoorDriftResult.valid, true);
  });
});
