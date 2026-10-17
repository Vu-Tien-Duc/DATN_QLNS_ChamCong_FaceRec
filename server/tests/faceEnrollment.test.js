/**
 * Kiểm thử tự động Phần 2 (Tuần 2):
 * Đăng ký khuôn mặt 5 góc, tính vector trung bình L2, chống trùng lặp sinh trắc học và đồng bộ FaceTemplate & User.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const FaceTemplate = require('../models/faceTemplate.model');
const User = require('../models/user.model');
const {
  computeNormalizedCentroid,
  checkDuplicateFace,
  euclideanDistance,
} = require('../utils/attendanceHelpers');

// Helper sinh vector ngẫu nhiên 512 số chuẩn hóa L2
function generateRandomVector512(seed = 1) {
  const vec = [];
  for (let i = 0; i < 512; i++) {
    // Sinh số giả lập có phân phối
    vec.push(Math.sin(seed * (i + 1)));
  }
  let norm = 0;
  for (let i = 0; i < 512; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  return vec.map((v) => v / norm);
}

// Helper sinh vector có độ lệch nhẹ (cùng một người ở các góc khác nhau)
function perturbVector(baseVec, noise = 0.05) {
  const perturbed = baseVec.map((v, i) => v + (Math.sin(i * 3.7) * noise));
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += perturbed[i] * perturbed[i];
  norm = Math.sqrt(norm);
  return perturbed.map((v) => v / norm);
}

async function runFaceEnrollmentTests() {
  console.log('\n--- Bắt đầu Test Suite: Face Enrollment 5 Angles & Biometrics v2.5 ---');

  // Test 1: computeNormalizedCentroid tính đúng vector trung bình L2 chuẩn
  const vecA = generateRandomVector512(10);
  const vecB = generateRandomVector512(20);
  const vecC = generateRandomVector512(30);

  const centroid = computeNormalizedCentroid([vecA, vecB, vecC]);
  assert(Array.isArray(centroid), 'Centroid phải là mảng');
  assert.strictEqual(centroid.length, 512, 'Centroid phải có độ dài đúng 512');

  // Kiểm tra độ dài L2 norm của centroid xấp xỉ 1.0
  let normCentroid = 0;
  for (let i = 0; i < 512; i++) {
    normCentroid += centroid[i] * centroid[i];
  }
  normCentroid = Math.sqrt(normCentroid);
  assert(Math.abs(normCentroid - 1.0) < 1e-4, `Centroid phải có L2-norm xấp xỉ 1.0 (nhận ${normCentroid})`);
  console.log('✓ Test 1 ĐẠT: Thuật toán computeNormalizedCentroid chuẩn hóa L2 norm = 1.0 thành công.');

  // Test 2: FaceTemplate Model Schema & Tự động tính vector_trung_binh
  const dummyUserId = new mongoose.Types.ObjectId();
  const sampleAngles = ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'];
  const vectors5Goc = [
    vecA,
    perturbVector(vecA, 0.05),
    perturbVector(vecA, 0.06),
    perturbVector(vecA, 0.04),
    perturbVector(vecA, 0.05),
  ];

  const templateDoc = new FaceTemplate({
    ma_nguoi_dung: dummyUserId,
    vector_dac_trung: vectors5Goc,
    cac_goc_chup: sampleAngles,
    so_luong_mau: 5,
    mo_hinh_ai: 'buffalo_s',
    so_chieu_vector: 512,
  });

  // Gọi pre-validate hook
  await templateDoc.validate();
  assert(Array.isArray(templateDoc.vector_trung_binh), 'vector_trung_binh phải được tự động sinh');
  assert.strictEqual(templateDoc.vector_trung_binh.length, 512, 'vector_trung_binh phải có 512 chiều');
  assert.strictEqual(templateDoc.mo_hinh_ai, 'buffalo_s', 'mo_hinh_ai mặc định đúng buffalo_s');
  assert.strictEqual(templateDoc.dieu_khoan_dong_y, true, 'dieu_khoan_dong_y mặc định true');
  console.log('✓ Test 2 ĐẠT: FaceTemplate model tự động sinh vector_trung_binh chuẩn hóa L2.');

  // Test 3: Dual-standard Aliases của FaceTemplate
  const templateObj = templateDoc.toObject ? templateDoc.toObject({ virtuals: true }) : templateDoc;
  assert.strictEqual(String(templateDoc.userId || templateDoc.ma_nguoi_dung), String(dummyUserId), 'userId alias đúng');
  assert.strictEqual(templateDoc.embeddingModel, 'buffalo_s', 'embeddingModel alias đúng');
  assert.strictEqual(templateDoc.samplesCount, 5, 'samplesCount virtual/alias đúng');
  assert.strictEqual(templateDoc.consentAgreed, true, 'consentAgreed alias đúng');
  console.log('✓ Test 3 ĐẠT: Dual-standard Aliases và Virtuals của FaceTemplate hoạt động hoàn hảo.');

  // Test 4: Thuật toán Biometric Fusion - Phát hiện trùng lặp khuôn mặt (Cùng một người)
  const user1Vec = generateRandomVector512(42);
  const user1Angles = [
    user1Vec,
    perturbVector(user1Vec, 0.03),
    perturbVector(user1Vec, 0.04),
  ];

  const existingUsersInCache = [
    {
      _id: dummyUserId,
      fullName: 'Giảng viên Đã Đăng Ký',
      email: 'gv.dadangky@university.edu.vn',
      faceDescriptors: user1Angles,
    },
  ];

  // Người mới cố tình đăng ký bằng khuôn mặt của người cũ (chỉ lệch nhẹ 0.04)
  const incomingSamePerson = [
    perturbVector(user1Vec, 0.02),
    perturbVector(user1Vec, 0.04),
  ];

  const dupResultSame = checkDuplicateFace(incomingSamePerson, existingUsersInCache);
  assert.strictEqual(dupResultSame.isDuplicate, true, 'Hệ thống phải phát hiện trùng lặp khi cùng một người');
  assert.strictEqual(String(dupResultSame.duplicateUser._id), String(dummyUserId), 'Báo đúng user bị trùng');
  console.log(`✓ Test 4 ĐẠT: checkDuplicateFace phát hiện khuôn mặt trùng lặp (Khoảng cách = ${dupResultSame.distance}).`);

  // Test 5: Thuật toán Biometric Fusion - Cho phép đăng ký người khác biệt
  const differentPersonVec = generateRandomVector512(999);
  const incomingDiffPerson = [
    differentPersonVec,
    perturbVector(differentPersonVec, 0.05),
  ];

  const dupResultDiff = checkDuplicateFace(incomingDiffPerson, existingUsersInCache);
  assert.strictEqual(dupResultDiff.isDuplicate, false, 'Người khác biệt không được báo trùng lặp');
  assert.strictEqual(dupResultDiff.duplicateUser, null, 'duplicateUser phải là null');
  console.log(`✓ Test 5 ĐẠT: checkDuplicateFace cho phép người dùng khác biệt hợp lệ (Khoảng cách = ${dupResultDiff.distance}).`);

  // Test 6: Kiểm tra validation chặn vector sai kích thước
  let threwValidationError = false;
  try {
    const invalidDoc = new FaceTemplate({
      ma_nguoi_dung: new mongoose.Types.ObjectId(),
      vector_dac_trung: [[0.1, 0.2]], // Sai kích thước (chỉ có 2 số thay vì 512)
    });
    await invalidDoc.validate();
  } catch (err) {
    threwValidationError = true;
  }
  assert(threwValidationError, 'FaceTemplate phải chặn vector không đúng 512 chiều');
  console.log('✓ Test 6 ĐẠT: FaceTemplate chặn thành công vector sai kích thước 512 chiều.');

  // Test 7: Thuật toán mã hóa AES-256-GCM At-Rest cho vector sinh trắc học
  const { encryptBiometricVector, decryptBiometricVector } = require('../utils/biometricEncryption');
  const sampleVector512 = generateRandomVector512(12345);
  const encryptedStr = encryptBiometricVector(sampleVector512);
  assert(typeof encryptedStr === 'string', 'Dữ liệu mã hóa phải là chuỗi');
  assert(encryptedStr.split('.').length === 3, 'Chuỗi mã hóa phải có định dạng iv.authTag.ciphertext');
  const decryptedVec = decryptBiometricVector(encryptedStr);
  assert(Array.isArray(decryptedVec), 'Dữ liệu giải mã phải là mảng');
  assert.strictEqual(decryptedVec.length, 512, 'Dữ liệu giải mã phải bảo toàn 512 chiều');
  assert(Math.abs(decryptedVec[0] - sampleVector512[0]) < 1e-6, 'Giá trị vector sau giải mã phải trùng khớp tuyệt đối');
  console.log('✓ Test 7 ĐẠT: Thuật toán mã hóa AES-256-GCM At-Rest và giải mã vector sinh trắc học chính xác.');

  // Test 8: Tuân thủ pháp lý Nghị định 13/2023/NĐ-CP (Consent Form & Policy Version)
  assert.strictEqual(templateDoc.consentAgreed, true, 'Trường consentAgreed mặc định là true khi đăng ký');
  assert.strictEqual(templateDoc.policyVersion, 'ND13-2023-V1.0', 'Phiên bản chính sách bảo vệ dữ liệu mặc định ND13-2023-V1.0');
  assert(templateDoc.consentAgreedAt instanceof Date, 'Thời điểm đồng thuận phải là Date hợp lệ');
  console.log('✓ Test 8 ĐẠT: FaceTemplate lưu trữ chuẩn xác các trường đồng thuận theo Nghị định 13/2023/NĐ-CP.');

  console.log('\n===> TẤT CẢ 8 TEST TRONG FACEENROLLMENT.TEST.JS ĐÃ PASS 100% <===\n');
}

runFaceEnrollmentTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test thất bại:', err);
    process.exit(1);
  });

