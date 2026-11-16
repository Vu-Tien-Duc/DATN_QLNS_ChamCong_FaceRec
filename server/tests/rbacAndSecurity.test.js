const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';

const { PERMISSIONS, getEffectivePermissions, hasPermission } = require('../config/permissions');
const { getActiveRoles } = require('../middlewares/xacThuc.middleware');
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
