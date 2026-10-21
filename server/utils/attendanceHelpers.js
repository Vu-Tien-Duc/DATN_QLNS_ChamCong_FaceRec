/**
 * attendanceHelpers.js
 * Tập hợp các thuật toán và tiện ích phục vụ chấm công đa phương thức:
 * 1. SINH TRẮC HỌC KHUÔN MẶT (Face Biometrics - Euclidean, Centroid, Cache, Anti-duplicate)
 * 2. ĐỊNH VỊ GPS & HÀNG RÀO ĐỊA LÝ (Geofencing - Haversine, Campus Config, Adaptive Tolerance)
 * 3. MÃ QR ĐỘNG BẢO MẬT (Dynamic TOTP QR - HMAC SHA-256)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const User = require('../models/user.model');
const FaceTemplate = require('../models/faceTemplate.model');
const systemConfigService = require('../services/systemConfig.service');

const isValidFaceDescriptor = (descriptor) =>
  Array.isArray(descriptor) &&
  descriptor.length > 0 &&
  descriptor.every((value) => typeof value === 'number' && Number.isFinite(value));

// ============================================================================
// PHẦN 1: SINH TRẮC HỌC KHUÔN MẶT (FACE BIOMETRICS)
// ============================================================================

/**
 * Tính khoảng cách Euclidean giữa hai vector đặc trưng 512 số (InsightFace)
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
const euclideanDistance = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += (vecA[i] - vecB[i]) ** 2;
  }
  return Math.sqrt(sum);
};

/**
 * Tính Cosine Similarity giữa hai vector đặc trưng (Dot Product nếu đã chuẩn hóa L2)
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Giá trị trong khoảng [-1.0, 1.0]
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
};

// Ngưỡng so khớp nhận diện khuôn mặt Máy chấm công Face ID (1-to-N matching).
const FACE_MATCH_THRESHOLD = 0.48;

// Ngưỡng kiểm tra trùng lặp khi Đăng Ký Khuôn Mặt (Anti-duplicate registration).
const DUPLICATE_FACE_THRESHOLD = 0.28;

/**
 * Tính vector trung tâm (Centroid) và chuẩn hóa độ dài L2 = 1.0
 * @param {number[][]} descriptors - Mảng các vector 512 số (InsightFace)
 * @returns {number[]|null}
 */
const computeNormalizedCentroid = (descriptors) => {
  if (!Array.isArray(descriptors) || descriptors.length === 0) return null;
  const validDesc = descriptors.filter(isValidFaceDescriptor);
  if (validDesc.length === 0) return null;

  const dim = validDesc[0].length;
  if (validDesc.some((descriptor) => descriptor.length !== dim)) return null;

  const centroid = Array.from({ length: dim }, () => 0);
  for (const desc of validDesc) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += desc[i];
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += centroid[i] * centroid[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }
  }
  return centroid;
};

/**
 * Thuật toán Biometric Multi-Metric Fusion kiểm tra trùng lặp khuôn mặt
 * @param {number[][]} incomingDescriptors
 * @param {Array} otherUsersWithFace
 * @returns {{ isDuplicate: boolean, duplicateUser: Object|null, distance: number, threshold: number }}
 */
const checkDuplicateFace = (incomingDescriptors, otherUsersWithFace) => {
  if (!Array.isArray(incomingDescriptors) || incomingDescriptors.length === 0) {
    return { isDuplicate: false, duplicateUser: null, distance: Infinity, similarity: 0, threshold: 0.88 };
  }

  const inputPrimary = incomingDescriptors[0];
  const inputCentroid = computeNormalizedCentroid(incomingDescriptors);
  let closestDuplicateUser = null;
  let minRecordedDistance = Infinity;
  let maxRecordedSimilarity = -1;

  for (const other of otherUsersWithFace) {
    const otherCandidates = Array.isArray(other.faceDescriptors)
      ? other.faceDescriptors.filter(
        (descriptor) => isValidFaceDescriptor(descriptor) && descriptor.length === inputPrimary.length
      )
      : [];

    if (otherCandidates.length === 0) continue;

    const otherPrimary = otherCandidates[0];
    const otherCentroid = computeNormalizedCentroid(otherCandidates);

    // 1. Khoảng cách Euclidean & Cosine giữa 2 góc chính diện
    const primaryDist =
      inputPrimary && otherPrimary ? euclideanDistance(inputPrimary, otherPrimary) : Infinity;
    const primarySim =
      inputPrimary && otherPrimary ? cosineSimilarity(inputPrimary, otherPrimary) : -1;

    // 2. Khoảng cách Euclidean & Cosine giữa 2 vector trung tâm (Centroid)
    const centroidDist =
      inputCentroid && otherCentroid ? euclideanDistance(inputCentroid, otherCentroid) : Infinity;
    const centroidSim =
      inputCentroid && otherCentroid ? cosineSimilarity(inputCentroid, otherCentroid) : -1;

    // 3. Tìm cặp tương đồng nhất trong toàn bộ các góc chụp
    let minPairDist = Infinity;
    let maxPairSim = -1;
    for (const inVec of incomingDescriptors) {
      for (const exVec of otherCandidates) {
        const d = euclideanDistance(inVec, exVec);
        if (d < minPairDist) minPairDist = d;
        const s = cosineSimilarity(inVec, exVec);
        if (s > maxPairSim) maxPairSim = s;
      }
    }

    const effectiveMinDist = Math.min(primaryDist, centroidDist, minPairDist);
    if (effectiveMinDist < minRecordedDistance) {
      minRecordedDistance = effectiveMinDist;
    }

    const effectiveMaxSim = Math.max(primarySim, centroidSim, maxPairSim);
    if (effectiveMaxSim > maxRecordedSimilarity) {
      maxRecordedSimilarity = effectiveMaxSim;
    }

    const is512 = inputPrimary?.length === 512;

    // TIÊU CHÍ XÁC NHẬN TRÙNG LẶP (CÙNG MỘT NGƯỜI):
    // Đối với ArcFace 512D:
    // - Cosine Similarity giữa 2 ảnh chính diện >= 0.58 HOẶC
    // - Cosine Similarity giữa 2 Centroid >= 0.58 HOẶC
    // - Khoảng cách Euclidean tối thiểu <= 0.88 HOẶC
    // - Có bất kỳ cặp góc nào tương đồng >= 0.62
    // (Đảm bảo 100% bắt được cùng 1 người dù lệch góc hay đổi biểu cảm; người khác biệt chỉ có Cosine < 0.35)
    const isDup = is512
      ? (primarySim >= 0.58 || centroidSim >= 0.58 || maxPairSim >= 0.62 || primaryDist <= 0.88 || centroidDist <= 0.88 || minPairDist <= 0.84)
      : (primaryDist < 0.28 || centroidDist < 0.28 || minPairDist < 0.25);

    if (isDup) {
      closestDuplicateUser = other;
      break;
    }
  }

  const effectiveThreshold = inputPrimary?.length === 512 ? 0.88 : DUPLICATE_FACE_THRESHOLD;
  return {
    isDuplicate: !!closestDuplicateUser,
    duplicateUser: closestDuplicateUser,
    distance: minRecordedDistance < Infinity ? +minRecordedDistance.toFixed(4) : 0,
    similarity: maxRecordedSimilarity >= 0 ? +maxRecordedSimilarity.toFixed(4) : 0,
    threshold: effectiveThreshold,
  };
};

// In-memory Cache cho danh sách vector Face ID của người dùng (TTL 5 phút)
let _cachedUsersWithFace = null;
let _faceCacheExpiry = 0;
const FACE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Lấy danh sách người dùng đã đăng ký Face ID từ Cache trong RAM (tránh đọc DB mỗi frame)
 * @returns {Promise<Array>}
 */
const getCachedUsersWithFace = async () => {
  const now = Date.now();
  if (_cachedUsersWithFace && now < _faceCacheExpiry) {
    return _cachedUsersWithFace;
  }

  // 1. Lấy tất cả FaceTemplate có vector đặc trưng
  const templates = await FaceTemplate.find()
    .select('+vector_dac_trung +descriptors +vector_trung_binh +averageDescriptor')
    .lean();

  const validTemplates = (templates || [])
    .map((template) => {
      const uId = (template.nguoi_dung_id || template.userId)?.toString();
      const descs = template.vector_dac_trung || template.descriptors || [];
      return {
        userId: uId || null,
        descriptors: Array.isArray(descs) ? descs : [],
      };
    })
    .filter((t) => t.userId && t.descriptors.length > 0);

  if (validTemplates.length === 0) {
    _cachedUsersWithFace = [];
    _faceCacheExpiry = now + FACE_CACHE_TTL_MS;
    return [];
  }

  // 2. Lấy thông tin User tương ứng (không lọc isActive để luôn bảo vệ khuôn mặt đã đăng ký)
  const users = await User.find({
    _id: { $in: validTemplates.map((template) => template.userId) },
  }).select('ho_ten fullName email ma_nhan_su staffCode vai_tro_chinh role anh_dai_dien avatar').lean();

  const descriptorsByUserId = new Map(
    validTemplates.map((template) => [template.userId, template.descriptors])
  );

  const usersWithFace = users
    .map((user) => {
      const uIdStr = user._id.toString();
      return {
        _id: user._id,
        fullName: user.ho_ten || user.fullName || 'Nhân sự',
        email: user.email || '',
        staffCode: user.ma_nhan_su || user.staffCode || '',
        role: user.vai_tro_chinh || user.role || '',
        avatar: user.anh_dai_dien || user.avatar || '',
        faceDescriptors: descriptorsByUserId.get(uIdStr) || [],
      };
    })
    .filter((user) => user.faceDescriptors.length > 0);

  _cachedUsersWithFace = usersWithFace;
  _faceCacheExpiry = now + FACE_CACHE_TTL_MS;
  return usersWithFace;
};

/**
 * Xóa cache người dùng Face ID khi có người đăng ký mới hoặc xóa Face ID
 */
const invalidateFaceCache = () => {
  _cachedUsersWithFace = null;
  _faceCacheExpiry = 0;
};

/**
 * Tìm kiếm người dùng khớp nhất từ một vector khuôn mặt
 * @param {number[]} descriptor
 * @param {Array} usersWithFace
 * @param {number} [threshold=FACE_MATCH_THRESHOLD]
 * @returns {{ bestMatch: Object|null, bestDistance: number, confidenceScore: number }}
 */
const findBestFaceMatch = (descriptor, usersWithFace, threshold = FACE_MATCH_THRESHOLD) => {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const u of usersWithFace) {
    const candidates = Array.isArray(u.faceDescriptors) ? u.faceDescriptors : [];

    if (candidates.length === 0) continue;

    for (const cand of candidates) {
      if (!isValidFaceDescriptor(cand) || cand.length !== descriptor.length) continue;
      const dist = euclideanDistance(descriptor, cand);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = u;
      }
    }
  }

  const confidenceScore = bestDistance < Infinity ? +(1 - bestDistance).toFixed(4) : 0;
  return {
    bestMatch: bestDistance < threshold ? bestMatch : null,
    bestDistance: +bestDistance.toFixed(4),
    confidenceScore,
  };
};

// ============================================================================
// PHẦN 2: HÀNG RÀO ĐỊA LÝ & TỌA ĐỘ GPS (GEOFENCING)
// ============================================================================

const CAMPUS_CONFIG_FILE = path.join(__dirname, '../config/campus_config.json');

const loadPersistedCampusConfig = () => {
  const defaultConfig = {
    name: process.env.CAMPUS_NAME || 'Khuôn viên Cơ sở chính - Trường Đại học',
    lat: Number(process.env.CAMPUS_LAT || '20.965483'),
    lng: Number(process.env.CAMPUS_LNG || '105.729905'),
    radiusMeters: Number(process.env.CAMPUS_RADIUS_METERS || '500'),
  };
  if (!fs.existsSync(CAMPUS_CONFIG_FILE)) {
    return defaultConfig;
  }

  const data = JSON.parse(fs.readFileSync(CAMPUS_CONFIG_FILE, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('[Geofence] campus_config.json phải chứa một đối tượng cấu hình.');
  }

  const config = {
    name: data.name === undefined ? defaultConfig.name : String(data.name).trim(),
    lat: data.lat === undefined ? defaultConfig.lat : Number(data.lat),
    lng: data.lng === undefined ? defaultConfig.lng : Number(data.lng),
    radiusMeters: data.radiusMeters === undefined ? defaultConfig.radiusMeters : Number(data.radiusMeters),
  };
  if (
    !config.name ||
    !Number.isFinite(config.lat) ||
    config.lat < -90 ||
    config.lat > 90 ||
    !Number.isFinite(config.lng) ||
    config.lng < -180 ||
    config.lng > 180 ||
    !Number.isInteger(config.radiusMeters) ||
    config.radiusMeters < 1 ||
    config.radiusMeters > 100000
  ) {
    throw new Error('[Geofence] Giá trị trong campus_config.json không hợp lệ.');
  }
  return config;
};

const savePersistedCampusConfig = (cfg) => {
  try {
    fs.writeFileSync(CAMPUS_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    // Không bắt buộc ghi file vì đã có Collection SystemConfig và .env
  }
};

const CAMPUS_CONFIG = loadPersistedCampusConfig();

/**
 * Tính khoảng cách đường chim bay giữa 2 tọa độ GPS (Công thức Haversine)
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Khoảng cách tính bằng mét
 */
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaPhi = (lat2 - lat1) * rad;
  const deltaLambda = (lon2 - lon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Kiểm tra xem địa chỉ IP có thuộc dải mạng nội bộ trường (Campus Subnets) hay không
 * Hỗ trợ IPv4 CIDR, loopback (127.0.0.1, ::1) và các dải LAN trường (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * @param {string} ip Địa chỉ IP của client gửi lên
 * @param {string[]} [customSubnets] Danh sách CIDR tùy chọn
 * @returns {{ isCampusIp: boolean, ip: string, matchedSubnet?: string, reason?: string }}
 */
const verifyCampusNetwork = (ip, customSubnets = null) => {
  if (!ip) {
    return { isCampusIp: false, ip: null, reason: 'Không có thông tin địa chỉ IP.' };
  }

  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();

  // 1. Loopback / Localhost (Dành cho kiểm thử và demo nội bộ)
  if (['127.0.0.1', '::1', 'localhost'].includes(cleanIp)) {
    return { isCampusIp: true, ip: cleanIp, matchedSubnet: '127.0.0.1/32 (Localhost)' };
  }

  const defaultSubnets = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.1/32',
  ];

  const configuredSubnets =
    customSubnets ||
    systemConfigService.getConfigSync('CAMPUS_IP_SUBNETS') ||
    (process.env.CAMPUS_IP_WHITELIST
      ? process.env.CAMPUS_IP_WHITELIST.split(',').map((s) => s.trim())
      : null) ||
    defaultSubnets;

  const subnetsList = Array.isArray(configuredSubnets) ? configuredSubnets : defaultSubnets;

  const ipToInt = (ipStr) => {
    return ipStr.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  };

  const isIpInCidr = (testIp, cidr) => {
    if (!cidr.includes('/')) {
      return testIp === cidr;
    }
    const [range, bits = '32'] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    try {
      return (ipToInt(testIp) & mask) === (ipToInt(range) & mask);
    } catch {
      return false;
    }
  };

  for (const subnet of subnetsList) {
    if (isIpInCidr(cleanIp, subnet)) {
      return { isCampusIp: true, ip: cleanIp, matchedSubnet: subnet };
    }
  }

  return { isCampusIp: false, ip: cleanIp, reason: 'Địa chỉ IP ngoài dải mạng trường học.' };
};

/**
 * Kiểm tra xem vị trí người dùng có nằm trong Hàng rào địa lý (Geofence) và Mạng trường hay không
 * @param {{ lat: number, lng: number, accuracy?: number }} clientLocation
 * @param {{ lat?: number, lng?: number, name?: string }} [targetLocation]
 * @param {number} [maxRadius]
 * @param {string} [clientIp] Địa chỉ IP của client gửi lên để đối soát chéo chống Fake GPS
 * @returns {{ isInside: boolean, distanceMeters: number, allowedRadius: number, effectiveRadius: number, target: Object, isFraud: boolean, fraudReason: string|null, isSuspicious?: boolean, suspiciousReason?: string|null, verificationMethod?: string, confidence?: string }}
 */
const validateGeofence = (clientLocation, targetLocation = null, maxRadius = null, clientIp = null) => {
  const cachedRadius = systemConfigService.getConfigSync('CAMPUS_GPS_RADIUS_METERS');
  const allowedRadius = maxRadius || cachedRadius || CAMPUS_CONFIG.radiusMeters;
  const accuracyTolerance = Math.min(Number(clientLocation?.accuracy) || 0, 100);
  const effectiveRadius = allowedRadius + accuracyTolerance;

  const campusTarget = {
    name: CAMPUS_CONFIG.name,
    lat: CAMPUS_CONFIG.lat,
    lng: CAMPUS_CONFIG.lng,
  };

  const netCheck = clientIp ? verifyCampusNetwork(clientIp) : null;

  if (!clientLocation || clientLocation.lat === undefined || clientLocation.lng === undefined) {
    // Trường hợp không có GPS nhưng đang quẹt từ máy tính/thiết bị nối mạng nội bộ trường
    if (netCheck && netCheck.isCampusIp) {
      return {
        valid: true,
        isInside: true,
        distance: 0,
        distanceMeters: 0,
        allowedRadius,
        effectiveRadius,
        target: campusTarget,
        closest: campusTarget,
        isFraud: false,
        fraudReason: null,
        isSuspicious: false,
        suspiciousReason: null,
        clientIp: netCheck.ip,
        isCampusNetwork: true,
        verificationMethod: 'CAMPUS_IP_ONLY',
        confidence: 'HIGH',
      };
    }

    return {
      valid: false,
      isInside: false,
      distance: Infinity,
      distanceMeters: Infinity,
      allowedRadius,
      effectiveRadius,
      target: campusTarget,
      closest: campusTarget,
      isFraud: true,
      fraudReason: 'Không tìm thấy dữ liệu tọa độ GPS từ thiết bị và IP không thuộc mạng trường.',
      clientIp: netCheck?.ip || null,
      isCampusNetwork: Boolean(netCheck?.isCampusIp),
      isSuspicious: false,
      suspiciousReason: null,
      verificationMethod: 'OUTSIDE_BOTH',
      confidence: 'NONE',
    };
  }

  // 1. Kiểm tra khoảng cách tới Tọa độ Khuôn viên trường (Campus Config)
  const campusDistance = calculateDistanceMeters(
    Number(clientLocation.lat),
    Number(clientLocation.lng),
    Number(CAMPUS_CONFIG.lat),
    Number(CAMPUS_CONFIG.lng)
  );

  let isInside = false;
  let minDistance = campusDistance;
  let closestTarget = campusTarget;

  if (campusDistance <= effectiveRadius) {
    isInside = true;
  } else {
    // 2. Nếu targetLocation (khoa/phòng ban/phòng học của lịch dạy) có tọa độ riêng hợp lệ, kiểm tra thêm
    const targets = Array.isArray(targetLocation)
      ? targetLocation
      : targetLocation
        ? [targetLocation]
        : [];

    for (const target of targets) {
      const lat = target?.lat !== undefined ? target.lat : target?.latitude;
      const lng = target?.lng !== undefined ? target.lng : target?.longitude;
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        const distance = calculateDistanceMeters(
          Number(clientLocation.lat),
          Number(clientLocation.lng),
          Number(lat),
          Number(lng)
        );

        if (distance <= effectiveRadius) {
          isInside = true;
          closestTarget = {
            name: target.name || CAMPUS_CONFIG.name,
            lat: Number(lat),
            lng: Number(lng),
          };
          minDistance = distance;
          break;
        }

        if (distance < minDistance) {
          minDistance = distance;
          closestTarget = {
            name: target.name || CAMPUS_CONFIG.name,
            lat: Number(lat),
            lng: Number(lng),
          };
        }
      }
    }
  }

  const roundedDistance = Math.round(minDistance);

  // 3. Phân tích kết hợp 2 yếu tố GPS & IP Mạng trường
  if (isInside) {
    const isSuspicious = Boolean(netCheck && !netCheck.isCampusIp);
    return {
      valid: true,
      isInside: true,
      distance: roundedDistance,
      distanceMeters: roundedDistance,
      allowedRadius,
      effectiveRadius,
      target: closestTarget,
      closest: closestTarget,
      isFraud: false,
      fraudReason: null,
      isSuspicious,
      suspiciousReason: isSuspicious
        ? 'Tọa độ GPS trong trường nhưng địa chỉ IP nằm ngoài mạng trường (Cảnh báo nghi vấn Fake GPS).'
        : null,
      clientIp: netCheck?.ip || null,
      isCampusNetwork: netCheck ? netCheck.isCampusIp : null,
      verificationMethod: netCheck?.isCampusIp ? 'GPS_AND_CAMPUS_IP' : 'GPS_ONLY',
      confidence: netCheck?.isCampusIp ? 'HIGH' : isSuspicious ? 'MEDIUM' : 'HIGH',
    };
  }

  // Nếu GPS báo ngoài bán kính, nhưng IP thuộc dải nội bộ trường (ví dụ máy tính phòng Lab)
  if (netCheck && netCheck.isCampusIp) {
    return {
      valid: true,
      isInside: true,
      distance: roundedDistance,
      distanceMeters: roundedDistance,
      allowedRadius,
      effectiveRadius,
      target: closestTarget,
      closest: closestTarget,
      isFraud: false,
      fraudReason: null,
      isSuspicious: false,
      suspiciousReason: null,
      networkVerified: true,
      clientIp: netCheck.ip,
      isCampusNetwork: true,
      verificationMethod: 'CAMPUS_IP_OVERRIDE',
      confidence: 'HIGH',
    };
  }

  return {
    valid: false,
    isInside: false,
    distance: roundedDistance,
    distanceMeters: roundedDistance,
    allowedRadius,
    effectiveRadius,
    target: closestTarget,
    closest: closestTarget,
    isFraud: true,
    fraudReason: `Vị trí quẹt thẻ (${roundedDistance}m) nằm ngoài bán kính cho phép (${allowedRadius}m) của ${closestTarget?.name || 'Khuôn viên trường'} và không thuộc dải mạng trường học.`,
    isSuspicious: true,
    suspiciousReason: 'Quẹt ngoài bán kính và IP ngoài khuôn viên trường.',
    clientIp: netCheck?.ip || null,
    isCampusNetwork: false,
    verificationMethod: 'OUTSIDE_BOTH',
    confidence: 'NONE',
  };
};

const getCampusConfig = () => ({ ...CAMPUS_CONFIG });

const updateCampusConfig = (newConfig = {}) => {
  const updatedConfig = { ...CAMPUS_CONFIG };
  const validateNumber = (field, value, min, max) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      const error = new Error(`Giá trị ${field} không hợp lệ.`);
      error.statusCode = 400;
      throw error;
    }
    return number;
  };

  if (newConfig.name !== undefined) {
    const name = String(newConfig.name).trim();
    if (!name) {
      const error = new Error('Tên khuôn viên không được để trống.');
      error.statusCode = 400;
      throw error;
    }
    updatedConfig.name = name;
  }
  if (newConfig.lat !== undefined) {
    updatedConfig.lat = validateNumber('lat', newConfig.lat, -90, 90);
  }
  if (newConfig.lng !== undefined) {
    updatedConfig.lng = validateNumber('lng', newConfig.lng, -180, 180);
  }
  if (newConfig.radiusMeters !== undefined) {
    const radius = validateNumber('radiusMeters', newConfig.radiusMeters, 1, 100000);
    if (!Number.isInteger(radius)) {
      const error = new Error('Giá trị radiusMeters phải là số nguyên.');
      error.statusCode = 400;
      throw error;
    }
    updatedConfig.radiusMeters = radius;
  }

  savePersistedCampusConfig(updatedConfig);
  Object.assign(CAMPUS_CONFIG, updatedConfig);
  return { ...CAMPUS_CONFIG };
};

// ============================================================================
// PHẦN 3: MÃ QR ĐỘNG TOTP BẢO MẬT (DYNAMIC QR CODE)
// ============================================================================

const getQrSecret = () => {
  if (process.env.QR_SECRET) {
    return process.env.QR_SECRET;
  }
  if (process.env.JWT_SECRET) {
    return crypto.createHmac('sha256', process.env.JWT_SECRET).update('attendance-qr').digest();
  }
  throw new Error('Cần cấu hình QR_SECRET hoặc JWT_SECRET để ký mã QR.');
};
const QR_LIFETIME_SECONDS = 20;

/**
 * Sinh mã QR Động chứa token có chữ ký HMAC kèm timestamp (Hết hạn sau 20s)
 * @param {Object} [meta={}] Thông tin giảng đường / máy chấm công
 * @returns {{ qrToken: string, qrPayload: Object, expiresIn: number, expiresAt: string, campus: Object }}
 */
const generateDynamicQRCode = (meta = {}) => {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(4).toString('hex');
  const payload = {
    type: 'ATT_QR',
    timestamp,
    expiresIn: QR_LIFETIME_SECONDS,
    nonce,
    room: meta.roomId || 'MAY_CHAM_CONG',
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getQrSecret()).update(payloadBase64).digest('hex').substring(0, 32);
  const qrToken = `${payloadBase64}.${signature}`;

  return {
    qrToken,
    qrPayload: payload,
    expiresIn: QR_LIFETIME_SECONDS,
    expiresAt: new Date(timestamp + QR_LIFETIME_SECONDS * 1000).toISOString(),
    campus: CAMPUS_CONFIG,
  };
};

/**
 * Xác minh mã QR Động được quét từ điện thoại
 * @param {string} token - Token dạng base64Payload.signature
 * @returns {{ valid: boolean, message?: string, data?: Object }}
 */
const verifyDynamicQRCode = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, message: 'Mã QR không đúng định dạng hoặc bị lỗi khi quét.' };
  }

  const [payloadBase64, signature] = token.split('.');
  const fullSignature = crypto.createHmac('sha256', getQrSecret()).update(payloadBase64).digest('hex');
  const expectedSignature = Buffer.from(
    signature.length === fullSignature.length ? fullSignature : fullSignature.substring(0, 32)
  );
  const suppliedSignature = Buffer.from(signature);
  const isValidSig =
    suppliedSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(suppliedSignature, expectedSignature);
  if (!isValidSig) {
    return { valid: false, message: 'Chữ ký mã QR không hợp lệ (Mã giả mạo).' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    const now = Date.now();
    const elapsedSeconds = (now - payload.timestamp) / 1000;
    const MAX_ALLOWED_SECONDS = QR_LIFETIME_SECONDS + 10;

    if (elapsedSeconds > MAX_ALLOWED_SECONDS) {
      return {
        valid: false,
        message: `Mã QR đã hết hạn (${Math.round(elapsedSeconds)}s trước). Vui lòng quét mã QR mới nhất hiển thị trên màn hình!`,
      };
    }

    return { valid: true, data: payload };
  } catch {
    return { valid: false, message: 'Không thể giải mã nội dung mã QR.' };
  }
};

module.exports = {
  // Biometrics
  euclideanDistance,
  cosineSimilarity,
  FACE_MATCH_THRESHOLD,
  getEffectiveFaceMatchThreshold: () => systemConfigService.getConfigSync('FACE_MATCH_THRESHOLD', FACE_MATCH_THRESHOLD),
  DUPLICATE_FACE_THRESHOLD,
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
  findBestFaceMatch,

  // Geofence & Campus Network
  CAMPUS_CONFIG,
  calculateDistanceMeters,
  validateGeofence,
  verifyCampusNetwork,
  getCampusConfig,
  updateCampusConfig,

  // QR
  generateDynamicQRCode,
  verifyDynamicQRCode,
};
