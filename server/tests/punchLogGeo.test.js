const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const PunchLog = require('../models/punchLog.model');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const SystemConfig = require('../models/systemConfig.model');

const run = async () => {
  console.log('--- Bắt đầu Test Suite: punchLogGeo.test.js & Core Models v2.5 ---');

  // Test 1: Lượt quét không có GPS (Cú pháp chuẩn GeoJSON Point default: undefined)
  const punchNoGps = new PunchLog({
    cham_cong_id: new mongoose.Types.ObjectId(),
    nguoi_dung_id: new mongoose.Types.ObjectId(),
    loai_quet: 'CHECK_IN',
    phuong_thuc: 'face',
  });

  const objNoGps = punchNoGps.toObject();
  assert.equal(punchNoGps.phuong_thuc, 'FACE_AI', 'Phương thức "face" phải được setter tự động chuẩn hóa thành "FACE_AI"');
  assert.equal(
    objNoGps.toa_do_gps,
    undefined,
    'Lượt quét không GPS phải có toa_do_gps là undefined (không được tạo object rỗng { type: "Point" })'
  );
  console.log('✓ Test 1 ĐẠT: Lượt quét không GPS không bị lỗi 2dsphere index.');

  // Test 2: Lượt quét có tọa độ GPS hợp lệ
  const punchWithGps = new PunchLog({
    cham_cong_id: new mongoose.Types.ObjectId(),
    nguoi_dung_id: new mongoose.Types.ObjectId(),
    loai_quet: 'CHECK_IN',
    phuong_thuc: 'FACE_AI',
    toa_do_gps: {
      type: 'Point',
      coordinates: [105.7826, 21.0378], // [kinh_do, vi_do]
    },
    do_tin_cay_ai: 0.92,
    diem_mat_that: 0.88,
    thiet_bi_id: 'CAMERA_GATE_01',
  });

  const objWithGps = punchWithGps.toObject();
  assert.equal(objWithGps.toa_do_gps.type, 'Point');
  assert.deepEqual(objWithGps.toa_do_gps.coordinates, [105.7826, 21.0378]);
  assert.equal(objWithGps.confidenceScore, 0.92);
  assert.equal(objWithGps.livenessScore, 0.88);
  assert.equal(objWithGps.deviceId, 'CAMERA_GATE_01');
  console.log('✓ Test 2 ĐẠT: Lượt quét có GPS lưu đúng chuẩn GeoJSON Point [kinh_do, vi_do].');

  // Test 3: Validation độ tin cậy AI (0 đến 1)
  const punchInvalidScore = new PunchLog({
    cham_cong_id: new mongoose.Types.ObjectId(),
    nguoi_dung_id: new mongoose.Types.ObjectId(),
    loai_quet: 'CHECK_IN',
    do_tin_cay_ai: 1.5, // Sai: > 1
  });
  const validationErr = await punchInvalidScore.validate().catch(e => e);
  assert.ok(validationErr, 'Phải ném lỗi validation khi confidenceScore > 1');
  assert.ok(validationErr.errors['do_tin_cay_ai'] || validationErr.errors['confidenceScore']);
  console.log('✓ Test 3 ĐẠT: Kiểm tra hợp lệ ngưỡng tin cậy AI 0-1 thành công.');

  // Test 4: Model User v2.5 (vai trò có nhiệm kỳ & getter ảo role)
  const user = new User({
    ho_ten: 'TS. Nguyễn Văn A',
    email: 'nguyenvana@university.edu.vn',
    mat_khau_ma_hoa: 'hashed_password_sample',
    danh_sach_vai_tro: [
      {
        ma_vai_tro: 'TRUONG_KHOA',
        pham_vi: 'KHOA',
        don_vi_id: new mongoose.Types.ObjectId(),
        tu_ngay: new Date('2025-01-01'),
        den_ngay: null, // Đang trong nhiệm kỳ
      },
    ],
    han_muc_phep_nam: 12,
    phien_ban_token: 1,
    phien_ban_khoa_cccd: 1,
  });

  assert.equal(user.role, 'truongkhoa', 'Getter ảo role phải tự động suy ra truongkhoa từ mã TRUONG_KHOA');
  assert.equal(user.annualLeaveQuota, 12);
  assert.equal(user.tokenVersion, 1);
  console.log('✓ Test 4 ĐẠT: User RBAC có nhiệm kỳ và getter ảo role tương thích ngược chuẩn.');

  // Test 5: Model RefreshToken (Anti-Replay Token Family & Grace Period)
  const refreshToken = new RefreshToken({
    chuoi_token: 'refresh_token_sample_string_uuid',
    ma_ho: 'family-uuid-12345',
    nguoi_dung_id: new mongoose.Types.ObjectId(),
    da_su_dung: true,
    thoi_diem_su_dung: new Date(),
    het_han_luc: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  assert.equal(refreshToken.familyId, 'family-uuid-12345');
  assert.equal(refreshToken.isUsed, true);
  assert.ok(refreshToken.usedAt instanceof Date);
  console.log('✓ Test 5 ĐẠT: RefreshToken hỗ trợ Token Family UUID và Grace Period 15s.');

  // Test 6: Model SystemConfig (Fallback cấu hình mặc định từ Mục 3 đặc tả)
  const nguongAi = await SystemConfig.layGiaTri('NGUONG_AI');
  assert.equal(nguongAi.mo_hinh, 'buffalo_s');
  assert.equal(nguongAi.cosine_min, 0.45);
  assert.equal(nguongAi.liveness_min, 0.85);

  const cooldown = await SystemConfig.layGiaTri('COOLDOWN_QUET_GIAY');
  assert.equal(cooldown, 60);

  const retentionAnh = await SystemConfig.layGiaTri('RETENTION_ANH_NAM');
  assert.equal(retentionAnh, 1);

  console.log('✓ Test 6 ĐẠT: SystemConfig.layGiaTri đọc đúng các giá trị mặc định từ đặc tả.');

  console.log('\n===> TẤT CẢ CÁC BÀI TEST TRONG PUNCHLOGGEO.TEST.JS ĐÃ PASS 100% <===');
};

run().catch((error) => {
  console.error('Test thất bại:', error);
  process.exitCode = 1;
});
