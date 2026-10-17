/**
 * Biometric Encryption Utility (server/utils/biometricEncryption.js)
 * Mã hóa dữ liệu sinh trắc học chuẩn AES-256-GCM At-Rest tuân thủ Nghị định 13/2023/NĐ-CP:
 * - Bảo vệ vector đặc trưng 512 chiều trước nguy cơ rò rỉ cơ sở dữ liệu.
 * - Khóa bí mật phái sinh bằng HKDF-SHA256 từ khóa hệ thống hoặc BIOMETRIC_ENCRYPTION_KEY.
 * - Sử dụng IV ngẫu nhiên 12-byte và Authentication Tag 16-byte cho mỗi lần mã hóa.
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits chuẩn cho GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const HKDF_INFO = 'University_Biometric_Vector_Encryption_v2.6';
const HKDF_SALT = 'ND13_2023_DATN_FaceRec_Salt';

/**
 * Phái sinh khóa đối xứng 256-bit an toàn
 */
const getDerivedKey = () => {
  const masterSecret =
    process.env.BIOMETRIC_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'university_biometric_master_encryption_key_2026_default_secure';

  return crypto.hkdfSync(
    'sha256',
    Buffer.from(masterSecret, 'utf8'),
    Buffer.from(HKDF_SALT, 'utf8'),
    Buffer.from(HKDF_INFO, 'utf8'),
    32
  );
};

/**
 * Mã hóa mảng vector số thực thành chuỗi an toàn
 * Định dạng: iv.authTag.ciphertext (Hex)
 * @param {Array<number>|Array<Array<number>>} vectorData Mảng số thực 512D
 * @returns {string} Chuỗi mã hóa hex an toàn
 */
const encryptBiometricVector = (vectorData) => {
  if (!vectorData) return null;
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const jsonString = JSON.stringify(vectorData);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(jsonString, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encryptedBuffer.toString('hex')}`;
};

/**
 * Giải mã chuỗi mã hóa thành mảng vector số thực
 * Hỗ trợ tương thích ngược nếu dữ liệu đầu vào đã là mảng số thực chưa mã hóa
 * @param {string|Array} encryptedInput Chuỗi hex mã hóa hoặc mảng vector gốc
 * @returns {Array<number>|Array<Array<number>>|null}
 */
const decryptBiometricVector = (encryptedInput) => {
  if (!encryptedInput) return null;

  // Nếu đã là mảng số thực (dữ liệu cũ chưa mã hóa), trả về nguyên bản
  if (Array.isArray(encryptedInput)) {
    return encryptedInput;
  }

  if (typeof encryptedInput !== 'string') {
    return null;
  }

  // Nếu không phải định dạng iv.authTag.ciphertext, thử parse JSON
  const parts = encryptedInput.split('.');
  if (parts.length !== 3) {
    try {
      return JSON.parse(encryptedInput);
    } catch {
      return null;
    }
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decryptedBuffer.toString('utf8'));
};

module.exports = {
  encryptBiometricVector,
  decryptBiometricVector,
};
