// Kiểm thử mã hóa/giải mã AES-256-GCM cho dữ liệu vector sinh trắc học.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.BIOMETRIC_ENCRYPTION_KEY = 'unit-test-biometric-aes256-key';

const {
  isEncryptedEnvelope,
  encryptBiometricJson,
  decryptBiometricJson,
} = require('../utils/maHoaSinhTrac');
const { computeNormalizedCentroid, checkDuplicateFace } = require('../utils/hoTroChamCong');

describe('AES-256-GCM Biometric Encryption', () => {
  it('mã hóa vector khuôn mặt 512 chiều và giải mã khôi phục chính xác', () => {
    const vec512 = Array.from({ length: 512 }, (_, idx) => Number(((idx % 10) * 0.05).toFixed(4)));
    const encryptedStr = encryptBiometricJson([vec512]);
    assert.equal(typeof encryptedStr, 'string');

    const envelope = JSON.parse(encryptedStr);
    assert.equal(isEncryptedEnvelope(envelope), true);
    assert.equal(envelope.alg, 'aes-256-gcm');

    const decrypted = decryptBiometricJson(encryptedStr, []);
    assert.equal(Array.isArray(decrypted), true);
    assert.equal(decrypted.length, 1);
    assert.deepEqual(decrypted[0], vec512);
  });

  it('từ chối giải mã khi bản mã bị thay đổi AuthTag / dữ liệu', () => {
    const encryptedStr = encryptBiometricJson([1, 2, 3]);
    const tampered = JSON.parse(encryptedStr);
    tampered.data = Buffer.from('corrupted-payload').toString('base64');

    const res = decryptBiometricJson(JSON.stringify(tampered), null);
    assert.equal(res, null);
  });

  it('tương thích ngược với dữ liệu JSON thuần cũ chưa mã hóa', () => {
    const legacyPlain = [[0.1, 0.2, 0.3]];
    const res = decryptBiometricJson(JSON.stringify(legacyPlain), []);
    assert.deepEqual(res, legacyPlain);
  });
});

describe('Biometric Centroid & Duplicate Fusion', () => {
  it('chuẩn hóa vector trung tâm L2 và phát hiện trùng lặp sinh trắc học 512D', () => {
    const unitVec = Array.from({ length: 512 }, (_, idx) => (idx === 0 ? 1 : 0));
    const centroid = computeNormalizedCentroid([unitVec, unitVec]);
    assert.equal(centroid.length, 512);
    assert.ok(Math.abs(centroid[0] - 1) < 1e-6);

    const dupResult = checkDuplicateFace([unitVec], [
      { id: 'user-other', ho_ten: 'Nguyễn Văn A', faceDescriptors: [unitVec] },
    ]);
    assert.equal(dupResult.isDuplicate, true);
    assert.equal(dupResult.duplicateUser.id, 'user-other');
  });
});
