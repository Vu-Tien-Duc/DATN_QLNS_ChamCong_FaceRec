/**
 * Facade cho các nghiệp vụ chấm công, giữ API service ổn định trong khi logic nằm ở module chuyên biệt.
 */
const shared = require('../../utils/thoiGianChamCong.utils');
const {
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
  DUPLICATE_FACE_THRESHOLD,
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
  findBestFaceMatch,
  CAMPUS_CONFIG,
  getCampusConfig,
  updateCampusConfig,
  calculateDistanceMeters,
  validateGeofence,
  generateDynamicQRCode,
  verifyDynamicQRCode,
} = require('../../utils/hoTroChamCong');
const schedule = require('./dieuKienLichChamCong.service');
const checkIn = require('./vaoCa.service');
const checkOut = require('./tanCa.service');
const face = require('./nhanDienKhuonMat.service');
const qr = require('./chamCongQr.service');
const history = require('./lichSuChamCong.service');
const admin = require('./quanTriChamCong.service');

module.exports = {
  ...shared, ...schedule, ...checkIn, ...checkOut, ...face, ...qr, ...history, ...admin,
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
  DUPLICATE_FACE_THRESHOLD,
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
  findBestFaceMatch,
  CAMPUS_CONFIG,
  getCampusConfig,
  updateCampusConfig,
  calculateDistanceMeters,
  validateGeofence,
  generateDynamicQRCode,
  verifyDynamicQRCode,
};
