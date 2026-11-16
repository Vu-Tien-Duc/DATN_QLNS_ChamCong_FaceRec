/**
 * Quản lý danh sách thu hồi token (Revoked Tokens) trong bộ nhớ (In-Memory)
 * Không lưu bảng trong CSDL SQL Server.
 */
const crypto = require('crypto');
const { redisSet, redisGet, isRedisReady } = require('../config/redis');

const REVOKED_TOKEN_PREFIX = 'REVOKED_TOKEN:';
const revokedTokensMap = new Map();

// Tự động dọn dẹp các token hết hạn định kỳ mỗi 5 phút
if (process.env.NODE_ENV !== 'test') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [hash, expTime] of revokedTokensMap.entries()) {
      if (expTime <= now) {
        revokedTokensMap.delete(hash);
      }
    }
  }, 5 * 60 * 1000);
  if (interval.unref) interval.unref();
}

const hashToken = (tokenStr) => crypto.createHash('sha256').update(String(tokenStr).trim()).digest('hex');

const isTokenRevoked = (token) => {
  if (!token) return false;
  const hash = hashToken(token);
  const expTime = revokedTokensMap.get(hash);
  if (!expTime) return false;
  if (Date.now() > expTime) {
    revokedTokensMap.delete(hash);
    return false;
  }
  return true;
};

const isTokenRevokedAsync = async (token) => {
  if (!token) return false;
  if (isTokenRevoked(token)) return true;
  if (isRedisReady()) {
    const hash = hashToken(token);
    const val = await redisGet(`${REVOKED_TOKEN_PREFIX}${hash}`);
    if (val) return true;
  }
  return false;
};

const revokeToken = (token, expiresAt) => {
  if (!token) return;
  const hash = hashToken(token);
  let expTime;
  if (expiresAt instanceof Date) {
    expTime = expiresAt.getTime();
  } else if (typeof expiresAt === 'number') {
    expTime = expiresAt > 1e11 ? expiresAt : expiresAt * 1000;
  } else {
    expTime = Date.now() + 15 * 60 * 1000; // Mặc định 15 phút
  }
  revokedTokensMap.set(hash, expTime);
  const ttlSeconds = Math.max(1, Math.ceil((expTime - Date.now()) / 1000));
  if (isRedisReady()) {
    redisSet(`${REVOKED_TOKEN_PREFIX}${hash}`, '1', ttlSeconds).catch(() => {});
  }
};

module.exports = {
  isTokenRevoked,
  isTokenRevokedAsync,
  revokeToken,
};
