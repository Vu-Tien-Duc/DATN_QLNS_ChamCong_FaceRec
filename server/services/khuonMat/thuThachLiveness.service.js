// Tạo, ký HMAC và xác thực thử thách Liveness 3D chống giả mạo ảnh tĩnh
const crypto = require('crypto');
const { redisGet, redisSet } = require('../../config/redis');
const { detectFacePose } = require('./ketNoiDichVuKhuonMat');
const { ServiceError } = require('../../utils/thoiGianChamCong.utils');

const LIVENESS_CHALLENGES = ['LOOK_UP', 'LOOK_DOWN', 'TURN_LEFT', 'TURN_RIGHT'];
const FALLBACK_LIVENESS_SECRET = crypto.randomBytes(32).toString('hex');
const POSE_SYNONYMS = {
  LOOK_UP: ['LOOK_UP', 'UP', 'NGUA', 'NGUOC'],
  LOOK_DOWN: ['LOOK_DOWN', 'DOWN', 'CUI'],
  TURN_LEFT: ['TURN_LEFT', 'LEFT', 'TRAI', 'QUAY_TRAI'],
  TURN_RIGHT: ['TURN_RIGHT', 'RIGHT', 'PHAI', 'QUAY_PHAI'],
  STRAIGHT: ['STRAIGHT', 'FRONT', 'CENTER', 'CHINH_DIEN'],
};

const getLivenessSecret = () => process.env.JWT_SECRET || process.env.QR_SECRET || FALLBACK_LIVENESS_SECRET;

const signPayload = (payloadObj) => {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getLivenessSecret()).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
};

const verifySignedPayload = (token, invalidMessage, errorCode = null) => {
  if (!token || !token.includes('.')) {
    throw new ServiceError(invalidMessage, 400, errorCode);
  }
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', getLivenessSecret()).update(payloadB64).digest('hex');
  const sigBuf = Buffer.from(sig || '');
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new ServiceError(invalidMessage, 400, errorCode);
  }
  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new ServiceError(invalidMessage, 400, errorCode);
  }
};

// Kiểm tra tư thế khuôn mặt từ AI có khớp với yêu cầu thử thách liveness
const normalizePoseMatchesChallenge = (challenge, poseRes) => {
  if (!challenge) return Boolean(poseRes?.face_detected ?? true);
  const rawPoseObj = poseRes?.pose || poseRes?.data?.pose;
  const candidates = [
    poseRes?.detectedPose,
    typeof rawPoseObj === 'string' ? rawPoseObj : rawPoseObj?.pose_en,
    typeof rawPoseObj === 'object' ? rawPoseObj?.pose : null,
    typeof rawPoseObj === 'object' ? rawPoseObj?.pose_vi : null,
  ]
    .filter(Boolean)
    .map((val) => String(val).trim().toUpperCase());

  const acceptedTokens = POSE_SYNONYMS[challenge] || [challenge];
  return candidates.some((cand) => acceptedTokens.some((tok) => cand === tok || cand.includes(tok)));
};

// Phát hành thử thách Liveness ngẫu nhiên gắn userId (hạn 120 giây)
const issueLivenessChallenge = (userId) => {
  const challenge = LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
  const nonce = crypto.randomBytes(12).toString('hex');
  const exp = Date.now() + 120 * 1000;
  const challengeToken = signPayload({
    challenge,
    nonce,
    exp,
    userId: userId ? String(userId) : '',
  });
  return { challenge, challengeToken, expiresInSeconds: 120 };
};

// Xác thực ảnh người dùng thực hiện đúng thử thách Liveness và cấp vé tạm thời gắn userId
const verifyLivenessChallenge = async ({ challengeToken, userId, imageBuffer }) => {
  const tokenPayload = verifySignedPayload(
    String(challengeToken || '').trim(),
    'Thiếu hoặc sai định dạng challengeToken xác thực Liveness.'
  );

  if (tokenPayload?.userId && String(tokenPayload.userId) !== String(userId || '')) {
    throw new ServiceError('Thử thách Liveness không thuộc về tài khoản hiện tại.', 403, 'LIVENESS_USER_MISMATCH');
  }
  if (!tokenPayload?.exp || Date.now() > Number(tokenPayload.exp)) {
    throw new ServiceError('Thử thách Liveness đã hết hạn. Vui lòng lấy thử thách mới.', 400);
  }

  const nonceKey = `liveness_nonce:${tokenPayload.nonce}`;
  if (await redisGet(nonceKey)) {
    throw new ServiceError('Thử thách Liveness đã được sử dụng. Vui lòng lấy thử thách mới.', 409);
  }
  await redisSet(nonceKey, '1', 150);

  if (!imageBuffer) {
    throw new ServiceError('Vui lòng cung cấp ảnh để xác thực Liveness.', 400);
  }

  const expectedChallenge = String(tokenPayload.challenge || '').toUpperCase();
  const poseRes = await detectFacePose({ imageBuffer });
  const detectedPose =
    typeof poseRes?.pose === 'object'
      ? poseRes.pose.pose_en || poseRes.pose.pose || ''
      : poseRes?.detectedPose || poseRes?.pose || poseRes?.data?.pose || '';

  const faceDetected = poseRes?.status ? poseRes.status === 'face_detected' : Boolean(poseRes?.face_detected ?? true);
  const passed = faceDetected && normalizePoseMatchesChallenge(expectedChallenge, poseRes);

  let livenessTicket = null;
  if (passed && userId) {
    const ticketNonce = crypto.randomBytes(12).toString('hex');
    livenessTicket = signPayload({ nonce: ticketNonce, userId: String(userId), exp: Date.now() + 120 * 1000 });
    await redisSet(`liveness_ticket:${ticketNonce}`, String(userId), 150).catch(() => {});
  }

  return {
    passed,
    detectedPose: String(detectedPose || '').toUpperCase(),
    expectedChallenge,
    ...(livenessTicket ? { livenessTicket } : {}),
  };
};

// Kiểm tra và đánh dấu đã dùng vé xác thực Liveness trước khi điểm danh Face ID
const consumeLivenessTicket = async (livenessTicket, callerId, options = {}) => {
  const ticket = String(livenessTicket || '').trim();
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  const requireTicket =
    options?.requireTicket ??
    (process.env.ENFORCE_LIVENESS_TICKET === 'true' || !isTestEnv);

  if (!ticket) {
    if (requireTicket) {
      throw new ServiceError(
        'Vui lòng hoàn thành thử thách xác thực người thật (Liveness) trước khi chấm công khuôn mặt.',
        400,
        'LIVENESS_TICKET_REQUIRED'
      );
    }
    return;
  }

  const ticketData = verifySignedPayload(ticket, 'Vé xác thực Liveness không hợp lệ.', 'INVALID_LIVENESS_TICKET');
  if (!ticketData?.exp || Date.now() > Number(ticketData.exp)) {
    throw new ServiceError('Vé xác thực Liveness đã hết hạn.', 400, 'LIVENESS_TICKET_EXPIRED');
  }
  if (String(ticketData.userId || '') !== String(callerId)) {
    throw new ServiceError('Vé Liveness không khớp với tài khoản đang đăng nhập.', 403, 'LIVENESS_USER_MISMATCH');
  }

  const ticketRedisKey = `liveness_ticket:${ticketData.nonce}`;
  const storedTicketOwner = await redisGet(ticketRedisKey);
  if (storedTicketOwner && String(storedTicketOwner) !== String(callerId)) {
    throw new ServiceError('Vé Liveness đã bị sử dụng hoặc không hợp lệ.', 409, 'LIVENESS_TICKET_REPLAY');
  }
  if (storedTicketOwner === 'USED') {
    throw new ServiceError('Vé Liveness đã được sử dụng.', 409, 'LIVENESS_TICKET_REPLAY');
  }
  await redisSet(ticketRedisKey, 'USED', 150).catch(() => {});
};

module.exports = {
  issueLivenessChallenge,
  verifyLivenessChallenge,
  consumeLivenessTicket,
};
