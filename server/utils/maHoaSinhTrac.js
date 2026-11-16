/**
 * Mã hóa & Giải mã Dữ liệu Sinh trắc học Khuôn mặt (AES-256-GCM).
 * Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân nhạy cảm (dữ liệu sinh trắc học).
 * Hỗ trợ giải mã tương thích ngược với dữ liệu JSON thuần cũ nếu có.
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENVELOPE_VERSION = 'v1';

const deriveAes256Key = () => {
  const rawSecret =
    process.env.BIOMETRIC_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'datn-qlns-biometric-aes256-gcm-dev-key';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
};

const isEncryptedEnvelope = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value._enc === ENVELOPE_VERSION &&
      value.alg === ALGORITHM &&
      typeof value.iv === 'string' &&
      typeof value.tag === 'string' &&
      typeof value.data === 'string'
  );

const encryptBiometricJson = (value) => {
  if (value === null || value === undefined) return null;
  if (isEncryptedEnvelope(value)) return JSON.stringify(value);

  const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
  const key = deriveAes256Key();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    _enc: ENVELOPE_VERSION,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
  });
};

const decryptBiometricJson = (raw, fallback = null) => {
  if (raw === null || raw === undefined || raw === '') return fallback;

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  // Tương thích ngược với bản ghi JSON thuần chưa mã hóa cũ
  if (!isEncryptedEnvelope(parsed)) {
    return parsed;
  }

  try {
    const key = deriveAes256Key();
    const iv = Buffer.from(parsed.iv, 'base64');
    const tag = Buffer.from(parsed.tag, 'base64');
    const ciphertext = Buffer.from(parsed.data, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[BiometricCipher] Giải mã vector sinh trắc học thất bại:', err.message);
    return fallback;
  }
};

module.exports = {
  ALGORITHM,
  ENVELOPE_VERSION,
  isEncryptedEnvelope,
  encryptBiometricJson,
  decryptBiometricJson,
};
