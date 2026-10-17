/**
 * Facade cho các nghiệp vụ chấm công, giữ API service ổn định trong khi logic nằm ở module chuyên biệt.
 */
const shared = require('../../utils/attendanceTime.utils');
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
} = require('../../utils/attendanceHelpers');
const schedule = require('./attendanceScheduleEligibility.service');
const checkIn = require('./checkIn.service');
const checkOut = require('./checkOut.service');
const face = require('./faceRecognition.service');
const qr = require('./qrAttendance.service');
const history = require('./attendanceHistory.service');
const admin = require('./attendanceAdmin.service');

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
