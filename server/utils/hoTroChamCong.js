// Tiện ích sinh trắc học khuôn mặt, định vị GPS/IP nội bộ trường và mã QR động chấm công.

const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const User = require('../models/nguoiDung.model');
const FaceTemplate = require('../models/mauKhuonMat.model');
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');

// Kiểm tra mảng vector khuôn mặt hợp lệ (mảng số hữu hạn khác rỗng)
const isValidFaceDescriptor = (descriptor) =>
  Array.isArray(descriptor) &&
  descriptor.length > 0 &&
  descriptor.every((value) => typeof value === 'number' && Number.isFinite(value));

// Sinh trắc học khuôn mặt

// Tính khoảng cách Euclidean giữa hai vector khuôn mặt
const euclideanDistance = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += (vecA[i] - vecB[i]) ** 2;
  }
  return Math.sqrt(sum);
};

// Tính độ tương đồng Cosine giữa hai vector khuôn mặt
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

// Tính vector trung tâm và chuẩn hóa L2 = 1.0
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

// Kiểm tra khuôn mặt mới có trùng với người dùng khác đã đăng ký hay không
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

    // So sánh 2 ảnh chính diện
    const primaryDist =
      inputPrimary && otherPrimary ? euclideanDistance(inputPrimary, otherPrimary) : Infinity;
    const primarySim =
      inputPrimary && otherPrimary ? cosineSimilarity(inputPrimary, otherPrimary) : -1;

    // So sánh 2 vector trung tâm
    const centroidDist =
      inputCentroid && otherCentroid ? euclideanDistance(inputCentroid, otherCentroid) : Infinity;
    const centroidSim =
      inputCentroid && otherCentroid ? cosineSimilarity(inputCentroid, otherCentroid) : -1;

    // Tìm cặp góc chụp giống nhau nhất
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

    // Ngưỡng trùng lặp cho vector 512D (hoặc vector cũ 128D)
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

// Lấy danh sách khuôn mặt đã đăng ký từ cache RAM (tránh đọc DB mỗi frame)
const getCachedUsersWithFace = async () => {
  const now = Date.now();
  if (_cachedUsersWithFace && now < _faceCacheExpiry) {
    return _cachedUsersWithFace;
  }

  const { Op } = require('sequelize');
  const templates = await FaceTemplate.findAll({
    where: {
      mac_dinh: true,
      trang_thai: { [Op.ne]: 'bi_khoa' },
    },
  });

  const validTemplates = (templates || [])
    .map((template) => {
      const uId = template.nguoi_dung_id ? String(template.nguoi_dung_id) : null;
      const descs = template.vector_dac_trung || [];
      return {
        userId: uId,
        descriptors: Array.isArray(descs) ? descs : [],
      };
    })
    .filter((t) => t.userId && t.descriptors.length > 0);

  if (validTemplates.length === 0) {
    _cachedUsersWithFace = [];
    _faceCacheExpiry = now + FACE_CACHE_TTL_MS;
    return [];
  }

  const users = await User.findAll({
    where: {
      id: { [Op.in]: validTemplates.map((t) => t.userId) },
      kich_hoat: true,
      trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
    },
    attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'anh_dai_dien'],
  });

  const descriptorsByUserId = new Map(
    validTemplates.map((template) => [template.userId, template.descriptors])
  );

  const usersWithFace = users
    .map((user) => {
      const uIdStr = String(user.id);
      return {
        id: user.id,
        ho_ten: user.ho_ten || 'Nhân sự',
        email: user.email || '',
        ma_can_bo: user.ma_can_bo || '',
        vai_tro_chinh: user.vai_tro_chinh || '',
        anh_dai_dien: user.anh_dai_dien || '',
        faceDescriptors: descriptorsByUserId.get(uIdStr) || [],
      };
    })
    .filter((user) => user.faceDescriptors.length > 0);

  _cachedUsersWithFace = usersWithFace;
  _faceCacheExpiry = now + FACE_CACHE_TTL_MS;
  return usersWithFace;
};

// Xóa cache khuôn mặt trong RAM và Redis khi có thay đổi đăng ký
const invalidateFaceCache = () => {
  _cachedUsersWithFace = null;
  _faceCacheExpiry = 0;
  try {
    const { invalidateFaceCache: invalidateRedisFaceCache } = require('../config/redis');
    invalidateRedisFaceCache().catch(() => {});
  } catch (_) {}
};

// Tìm người dùng khớp nhất với vector khuôn mặt truyền vào
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

// Hàng rào địa lý GPS và mạng nội bộ

const CAMPUS_CONFIG_FILE = path.join(__dirname, '../config/campus_config.json');

// Đọc cấu hình khuôn viên trường từ tệp campus_config.json hoặc biến môi trường
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

// Lưu cấu hình khuôn viên trường xuống tệp campus_config.json
const savePersistedCampusConfig = (cfg) => {
  try {
    fs.writeFileSync(CAMPUS_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    // Không bắt buộc ghi file vì đã có Collection SystemConfig và .env
  }
};

const CAMPUS_CONFIG = loadPersistedCampusConfig();

// Tính khoảng cách theo mét giữa 2 tọa độ GPS (công thức Haversine)
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

// Kiểm tra địa chỉ IP có thuộc dải mạng nội bộ trường hay không
const verifyCampusNetwork = (ip, customSubnets = null) => {
  if (!ip) {
    return { isCampusIp: false, ip: null, reason: 'Không có thông tin địa chỉ IP.' };
  }

  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();

  // Cho phép localhost phục vụ kiểm thử nội bộ
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
    if (!net.isIPv4(testIp)) {
      return testIp === cidr;
    }
    if (!cidr.includes('/')) {
      return testIp === cidr;
    }
    const [range, bits = '32'] = cidr.split('/');
    const prefixLen = parseInt(bits, 10);
    if (!net.isIPv4(range) || !Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
      return false;
    }
    const mask = prefixLen === 0 ? 0 : ~(2 ** (32 - prefixLen) - 1);
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

const resolveCachedCampus = () => {
  const geofenceTruong = systemConfigService.getConfigSync('GEOFENCE_TRUONG');
  if (
    geofenceTruong &&
    typeof geofenceTruong === 'object' &&
    Array.isArray(geofenceTruong.toa_do) &&
    geofenceTruong.toa_do.length >= 2 &&
    Number.isFinite(Number(geofenceTruong.toa_do[0])) &&
    Number.isFinite(Number(geofenceTruong.toa_do[1]))
  ) {
    return {
      name: geofenceTruong.ten_co_so || CAMPUS_CONFIG.name,
      lat: Number(geofenceTruong.toa_do[1]),
      lng: Number(geofenceTruong.toa_do[0]),
      radiusMeters: Number(geofenceTruong.ban_kinh_met) || CAMPUS_CONFIG.radiusMeters,
    };
  }

  const legacyCampus = systemConfigService.getConfigSync('CAMPUS_GEOFENCE');
  if (
    legacyCampus &&
    typeof legacyCampus === 'object' &&
    Number.isFinite(Number(legacyCampus.lat)) &&
    Number.isFinite(Number(legacyCampus.lng))
  ) {
    return {
      name: legacyCampus.name || CAMPUS_CONFIG.name,
      lat: Number(legacyCampus.lat),
      lng: Number(legacyCampus.lng),
      radiusMeters: Number(legacyCampus.radiusMeters) || CAMPUS_CONFIG.radiusMeters,
    };
  }

  return { ...CAMPUS_CONFIG };
};

// Kiểm tra vị trí GPS và IP có nằm trong phạm vi trường hoặc đơn vị hay không
const validateGeofence = (clientLocation, targetLocation = null, maxRadius = null, clientIp = null) => {
  const activeCampus = resolveCachedCampus();

  const cachedRadius = systemConfigService.getConfigSync('CAMPUS_GPS_RADIUS_METERS');
  // Hỗ trợ maxRadius là số hoặc object { radiusMultiplier }
  const radiusMultiplier =
    maxRadius && typeof maxRadius === 'object' && Number.isFinite(Number(maxRadius.radiusMultiplier)) && Number(maxRadius.radiusMultiplier) > 0
      ? Number(maxRadius.radiusMultiplier)
      : 1;
  let resolvedRadius;
  if (maxRadius && typeof maxRadius === 'object' && Number.isFinite(Number(maxRadius.radiusMultiplier))) {
    const baseR = cachedRadius || activeCampus.radiusMeters;
    resolvedRadius = Math.round(Number(baseR) * radiusMultiplier);
  } else {
    resolvedRadius = maxRadius;
  }
  const allowedRadius = resolvedRadius || cachedRadius || activeCampus.radiusMeters;
  const accuracyTolerance = Math.min(Number(clientLocation?.accuracy) || 0, 100);
  const effectiveRadius = allowedRadius + accuracyTolerance;

  const campusTarget = {
    name: activeCampus.name,
    lat: activeCampus.lat,
    lng: activeCampus.lng,
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

  // Kiểm tra khoảng cách tới tọa độ khuôn viên trường
  const campusDistance = calculateDistanceMeters(
    Number(clientLocation.lat),
    Number(clientLocation.lng),
    Number(activeCampus.lat),
    Number(activeCampus.lng)
  );

  let isInside = false;
  let minDistance = campusDistance;
  let closestTarget = campusTarget;

  if (campusDistance <= effectiveRadius) {
    isInside = true;
  } else {
    // Kiểm tra thêm tọa độ riêng của khoa/phòng ban nếu có
    const targets = Array.isArray(targetLocation)
      ? targetLocation
      : targetLocation
        ? [targetLocation]
        : [];

    for (const target of targets) {
      const lat = target?.lat;
      const lng = target?.lng;
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        const distance = calculateDistanceMeters(
          Number(clientLocation.lat),
          Number(clientLocation.lng),
          Number(lat),
          Number(lng)
        );
        const targetRadius = Number(target?.radiusMeters);
        const targetEffectiveRadius =
          Number.isFinite(targetRadius) && targetRadius > 0
            ? Math.round(targetRadius * radiusMultiplier) + accuracyTolerance
            : effectiveRadius;

        if (distance <= targetEffectiveRadius) {
          isInside = true;
          closestTarget = {
            name: target.name || activeCampus.name,
            lat: Number(lat),
            lng: Number(lng),
          };
          minDistance = distance;
          break;
        }

        if (distance < minDistance) {
          minDistance = distance;
          closestTarget = {
            name: target.name || activeCampus.name,
            lat: Number(lat),
            lng: Number(lng),
          };
        }
      }
    }
  }

  const roundedDistance = Math.round(minDistance);

  // Kết hợp đối chiếu GPS và IP mạng trường
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

  // Chỉ cho phép Campus IP bù sai số GPS khi vị trí GPS ở vùng lân cận khuôn viên (sai số trong nhà).
  // Nếu GPS báo cách quá xa (> max(effectiveRadius * 2, 500m)), vẫn coi là nghi vấn/không hợp lệ để chống VPN/Proxy giả mạo.
  const maxDriftAllowance = Math.max(effectiveRadius * 2, 500);
  if (netCheck && netCheck.isCampusIp && roundedDistance <= maxDriftAllowance) {
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

// Lấy cấu hình tọa độ và bán kính khuôn viên trường hiện hành (chuẩn hóa tiếng Việt)
const getCampusConfig = () => {
  const campus = resolveCachedCampus();
  return {
    ten_co_so: campus.name,
    vi_do: campus.lat,
    kinh_do: campus.lng,
    ban_kinh_met: campus.radiusMeters,
  };
};

// Lấy danh sách tọa độ geofence theo khoa, phòng ban hoặc lịch giảng dạy
const resolveUserGeofenceTargets = async (userId, scheduleId = null) => {
  if (!userId && !scheduleId) return [];
  try {
    const { PhongBan, LichTrinh } = require('../models');
    const targets = [];

    if (scheduleId) {
      const schedule = await LichTrinh.findByPk(String(scheduleId), {
        attributes: ['id', 'phong_hoc', 'vi_do', 'kinh_do', 'ban_kinh_met'],
      });
      if (schedule && schedule.vi_do != null && schedule.kinh_do != null) {
        targets.push({
          name: schedule.phong_hoc ? `Phòng ${schedule.phong_hoc}` : 'Phòng học phân công',
          lat: Number(schedule.vi_do),
          lng: Number(schedule.kinh_do),
          radiusMeters: schedule.ban_kinh_met ? Number(schedule.ban_kinh_met) : null,
        });
      }
    }

    if (!userId) return targets;

    const user = await User.findByPk(String(userId), {
      attributes: ['id', 'don_vi_chinh_id'],
      include: [
        {
          model: PhongBan,
          as: 'don_vi_chinh',
          attributes: ['id', 'ten_phong_ban', 'vi_do', 'kinh_do', 'ban_kinh_met', 'don_vi_cha_id'],
        },
      ],
    });
    const dept = user?.don_vi_chinh;
    if (!dept) return targets;

    if (dept.vi_do !== null && dept.vi_do !== undefined && dept.kinh_do !== null && dept.kinh_do !== undefined) {
      targets.push({
        name: dept.ten_phong_ban,
        lat: Number(dept.vi_do),
        lng: Number(dept.kinh_do),
        radiusMeters: dept.ban_kinh_met ? Number(dept.ban_kinh_met) : null,
      });
    } else if (dept.don_vi_cha_id) {
      const parentDept = await PhongBan.findByPk(dept.don_vi_cha_id, {
        attributes: ['id', 'ten_phong_ban', 'vi_do', 'kinh_do', 'ban_kinh_met'],
      });
      if (parentDept && parentDept.vi_do != null && parentDept.kinh_do != null) {
        targets.push({
          name: parentDept.ten_phong_ban,
          lat: Number(parentDept.vi_do),
          lng: Number(parentDept.kinh_do),
          radiusMeters: parentDept.ban_kinh_met ? Number(parentDept.ban_kinh_met) : null,
        });
      }
    }
    return targets;
  } catch {
    return [];
  }
};

// Cập nhật và lưu cấu hình tọa độ/bán kính khuôn viên trường
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

  const incomingName = newConfig.ten_co_so;
  const incomingLat = newConfig.vi_do;
  const incomingLng = newConfig.kinh_do;
  const incomingRadius = newConfig.ban_kinh_met;

  if (incomingName !== undefined) {
    const name = String(incomingName).trim();
    if (!name) {
      const error = new Error('Tên khuôn viên không được để trống.');
      error.statusCode = 400;
      throw error;
    }
    updatedConfig.name = name;
  }
  if (incomingLat !== undefined) {
    updatedConfig.lat = validateNumber('lat', incomingLat, -90, 90);
  }
  if (incomingLng !== undefined) {
    updatedConfig.lng = validateNumber('lng', incomingLng, -180, 180);
  }
  if (incomingRadius !== undefined) {
    const radius = validateNumber('radiusMeters', incomingRadius, 1, 100000);
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

// Mã QR động chấm công

// Lấy khóa bí mật dùng để ký và xác minh mã QR động
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

// Tạo mã QR động ký HMAC có thời hạn 20 giây
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

// Xác minh chữ ký và thời hạn của mã QR động
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
    const ts = Number(payload.timestamp);
    if (!Number.isFinite(ts)) {
      return { valid: false, message: 'Mã QR thiếu dấu thời gian hợp lệ.' };
    }
    const now = Date.now();
    const elapsedSeconds = (now - ts) / 1000;
    const MAX_ALLOWED_SECONDS = QR_LIFETIME_SECONDS + 10;

    if (elapsedSeconds < -5) {
      return { valid: false, message: 'Dấu thời gian mã QR không hợp lệ (ở tương lai).' };
    }

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
  // Sinh trắc học khuôn mặt
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

  // Định vị GPS và mạng nội bộ trường
  CAMPUS_CONFIG,
  calculateDistanceMeters,
  validateGeofence,
  verifyCampusNetwork,
  getCampusConfig,
  updateCampusConfig,
  resolveUserGeofenceTargets,

  // Mã QR động
  generateDynamicQRCode,
  verifyDynamicQRCode,
};
