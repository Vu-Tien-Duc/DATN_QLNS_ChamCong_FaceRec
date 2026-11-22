const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-flow3-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-flow3-refresh-secret';

const models = require('../models');
const { sequelize } = require('../config/db');
const minioStorage = require('../config/minio');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const { resetMemoryLocks } = require('../utils/khoaPhanTan');
const { encryptBiometricJson, decryptBiometricJson, isEncryptedEnvelope } = require('../utils/maHoaSinhTrac');
const { getCachedUsersWithFace, invalidateFaceCache } = require('../utils/hoTroChamCong');
const { loadConfigsIntoCache } = require('../services/heThong/cauHinhHeThong.service');
const {
  getEffectiveThreshold,
  getEffectiveMarginTop1Top2,
  recognizeFace,
  ensureRamCacheWarm,
} = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const {
  assertCanManageFace,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
} = require('../services/khuonMat/mauKhuonMat.service');

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const DEAN_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_IN_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_OUT_ID = '44444444-4444-4444-8444-444444444444';
const DEPT_ROOT = '55555555-5555-4555-8555-555555555555';
const DEPT_OTHER = '66666666-6666-4666-8666-666666666666';
const TPL_NEW_ID = '77777777-7777-4777-8777-777777777777';

const makeUnitVec = (seedIdx = 0) =>
  Array.from({ length: 512 }, (_, idx) => (idx === seedIdx ? 1 : 0));

const PNG_MAGIC_BUF = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const JPEG_MAGIC_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
]);

const restorerList = [];
const stub = (obj, method, fn) => {
  const original = obj[method];
  obj[method] = fn;
  restorerList.push(() => {
    obj[method] = original;
  });
};

afterEach(() => {
  while (restorerList.length) {
    restorerList.pop()();
  }
  resetMemoryLocks();
  invalidateFaceCache();
  delete process.env.BIOMETRIC_ENCRYPTION_KEY;
  process.env.NODE_ENV = 'test';
});

const stubTransactionPassThrough = () => {
  const fakeTx = { LOCK: { UPDATE: 'UPDATE' } };
  stub(sequelize, 'transaction', async (...args) => {
    const fn = args.find((a) => typeof a === 'function');
    if (fn) return fn(fakeTx);
    return { ...fakeTx, commit: async () => {}, rollback: async () => {} };
  });
};

const dispatchExpress = async (app, { method = 'GET', url, headers = {}, jsonBody = null, formData = null }) => {
  let rawBody = Buffer.alloc(0);
  const reqHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    reqHeaders[k.toLowerCase()] = v;
  }

  if (formData) {
    const tmpReq = new Request('http://localhost/tmp', { method, body: formData });
    reqHeaders['content-type'] = tmpReq.headers.get('content-type');
    rawBody = Buffer.from(await tmpReq.arrayBuffer());
    reqHeaders['content-length'] = String(rawBody.length);
  } else if (jsonBody !== null) {
    rawBody = Buffer.from(JSON.stringify(jsonBody), 'utf8');
    reqHeaders['content-type'] = 'application/json';
    reqHeaders['content-length'] = String(rawBody.length);
  }

  return new Promise((resolve, reject) => {
    const socket = new Readable({ read() {} });
    socket.remoteAddress = '127.0.0.1';
    socket.writable = true;
    socket.destroyed = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.complete = true;
    req.headers = reqHeaders;
    req.push(rawBody.length ? rawBody : null);
    if (rawBody.length) req.push(null);

    const chunks = [];
    const res = new http.ServerResponse(req);
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      res.finished = true;
      const rawBuf = Buffer.concat(chunks);
      const text = rawBuf.toString('utf8');
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      resolve({ status: res.statusCode, body, rawBuf, headers: res.getHeaders() });
    };
    app.handle(req, res, reject);
  });
};

describe('Luồng 3.1 - Mã hóa AES-256-GCM & fail-closed production key', () => {
  it('mã hóa/giải mã đúng vector 512D, từ chối authTag bị sửa, và fail-fast khi production thiếu BIOMETRIC_ENCRYPTION_KEY', () => {
    process.env.BIOMETRIC_ENCRYPTION_KEY = 'unit-test-biometric-key-32bytes!';
    const vec512 = makeUnitVec(3);
    const cipherJson = encryptBiometricJson([vec512]);
    const parsed = JSON.parse(cipherJson);

    assert.equal(isEncryptedEnvelope(parsed), true);
    assert.equal(parsed.alg, 'aes-256-gcm');

    const decoded = decryptBiometricJson(cipherJson, null);
    assert.deepEqual(decoded, [vec512]);

    // Làm hỏng tag xác thực -> giải mã thất bại và trả fallback an toàn
    const tampered = JSON.stringify({ ...parsed, tag: Buffer.alloc(16, 1).toString('base64') });
    assert.equal(decryptBiometricJson(tampered, null), null);

    // Tương thích ngược dữ liệu JSON thuần cũ
    assert.deepEqual(decryptBiometricJson(JSON.stringify([vec512]), null), [vec512]);

    // Fail-closed trong production khi thiếu BIOMETRIC_ENCRYPTION_KEY
    delete process.env.BIOMETRIC_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => encryptBiometricJson([vec512]),
      (err) => err.message.includes('BIOMETRIC_ENCRYPTION_KEY')
    );
  });
});

describe('Luồng 3.2 - Đa vai trò assertCanManageFace & tải tệp sinh trắc / nội bộ', () => {
  it('cho phép giảng viên kiêm trưởng khoa quản lý cấp dưới cùng khoa, chặn ngoài khoa & tự thao tác', async () => {
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === STAFF_IN_ID) return { id: STAFF_IN_ID, don_vi_chinh_id: DEPT_ROOT, danh_sach_vai_tro: [] };
      if (id === STAFF_OUT_ID) return { id: STAFF_OUT_ID, don_vi_chinh_id: DEPT_OTHER, danh_sach_vai_tro: [] };
      return null;
    });
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);

    const concurrentDean = {
      id: DEAN_ID,
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: DEPT_ROOT,
      danh_sach_vai_tro: [{ ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_ROOT, trang_thai: 'active' }],
    };

    await assert.doesNotReject(assertCanManageFace(concurrentDean, { id: STAFF_IN_ID }, 'đăng ký'));

    await assert.rejects(
      assertCanManageFace(concurrentDean, { id: STAFF_OUT_ID }, 'xóa'),
      (err) => err.statusCode === 403 && err.errorCode === 'FACE_OUT_OF_SCOPE'
    );

    await assert.rejects(
      assertCanManageFace(concurrentDean, { id: DEAN_ID }, 'đăng ký'),
      (err) => err.statusCode === 403 && err.errorCode === 'FACE_SELF_MANAGE_FORBIDDEN'
    );
  });

  it('taiTep.controller.js kiểm tra đa vai trò cho ảnh sinh trắc (face) và tệp nội bộ (restricted_admin)', async () => {
    const { downloadFile } = require('../controllers/taiTep.controller');
    const app = express();
    app.get('/api/tai-tep/tep/:filename', downloadFile);
    app.use(errorHandler);

    const tccbConcurrentToken = jwt.sign({ id: DEAN_ID, phien_ban_token: 1 }, process.env.JWT_SECRET);
    const plainStaffToken = jwt.sign({ id: STAFF_OUT_ID, phien_ban_token: 1 }, process.env.JWT_SECRET);

    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === DEAN_ID) {
        return {
          id: DEAN_ID,
          vai_tro_chinh: 'giang_vien',
          kich_hoat: true,
          phien_ban_token: 1,
          danh_sach_vai_tro: [{ ma_vai_tro: 'tccb', trang_thai: 'active' }],
        };
      }
      return {
        id: STAFF_OUT_ID,
        vai_tro_chinh: 'giang_vien',
        kich_hoat: true,
        phien_ban_token: 1,
        danh_sach_vai_tro: [],
      };
    });
    stub(models.LuotQuetChamCong, 'findOne', async () => null);
    stub(models.NguoiDung, 'findOne', async () => null);
    stub(models.MauKhuonMat, 'findOne', async () => ({ id: TPL_NEW_ID, nguoi_dung_id: STAFF_IN_ID }));
    stub(models.DonNghiPhep, 'findOne', async () => null);
    stub(minioStorage, 'getObjectStream', async () => ({
      stream: Readable.from(PNG_MAGIC_BUF),
      contentType: 'image/png',
    }));

    // Giảng viên kiêm TCCB xem được ảnh sinh trắc face-... của nhân sự khác
    const allowedFace = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/tai-tep/tep/face-cb01-nguyen-a.png',
      headers: { Authorization: `Bearer ${tccbConcurrentToken}` },
    });
    assert.equal(allowedFace.status, 200);

    // Giảng viên thường bị 403 trên ảnh sinh trắc người khác và tệp restricted_admin
    const deniedFace = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/tai-tep/tep/face-cb01-nguyen-a.png',
      headers: { Authorization: `Bearer ${plainStaffToken}` },
    });
    assert.equal(deniedFace.status, 403);

    const deniedRestricted = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/tai-tep/tep/orphan-internal-report.pdf',
      headers: { Authorization: `Bearer ${plainStaffToken}` },
    });
    assert.equal(deniedRestricted.status, 403);
  });
});

describe('Luồng 3.3 - Chống trùng 409, Khóa phân tán, NĐ 13/2023 & Rollback ảnh', () => {
  it('chặn trùng khuôn mặt 409 USER_FACE_ALREADY_REGISTERED, xóa mẫu cũ khi lưu mới, rollback ảnh khi DB lỗi', async () => {
    const v0 = makeUnitVec(0);
    const v1 = makeUnitVec(5);
    const deletedUrls = [];

    stub(models.NguoiDung, 'findByPk', async () => ({
      id: STAFF_IN_ID,
      ho_ten: 'Nguyễn Văn B',
      ma_can_bo: 'CB02',
      email: 'b@uni.edu.vn',
    }));
    stub(models.MauKhuonMat, 'findAll', async () => [
      { nguoi_dung_id: STAFF_OUT_ID, vector_dac_trung: [v0], anh_dai_dien: '/api/tai-tep/tep/old.jpg' },
    ]);
    stub(models.NguoiDung, 'findAll', async () => [
      { id: STAFF_OUT_ID, ho_ten: 'Trần Văn C', email: 'c@uni.edu.vn', ma_can_bo: 'CB03', vai_tro_chinh: 'giang_vien' },
    ]);

    // 1. Trùng mặt với STAFF_OUT_ID -> 409 USER_FACE_ALREADY_REGISTERED
    await assert.rejects(
      () =>
        registerFaceDescriptorForUser({
          id: STAFF_IN_ID,
          descriptors: [v0],
          currentUser: { id: ADMIN_ID, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'USER_FACE_ALREADY_REGISTERED'
    );

    // 2. Rollback ảnh mới nếu DB transaction fail sau khi upload MinIO
    invalidateFaceCache();
    stubTransactionPassThrough();
    stub(minioStorage, 'putObject', async () => ({ storage: 'local' }));
    stub(minioStorage, 'deleteObject', async (key) => {
      deletedUrls.push(key);
    });
    stub(models.MauKhuonMat, 'destroy', async () => {
      throw new Error('SQL_TX_FAILED');
    });

    await assert.rejects(
      () =>
        registerFaceDescriptorForUser({
          id: STAFF_IN_ID,
          descriptors: [v1],
          primaryPhotoFile: { buffer: PNG_MAGIC_BUF, mimetype: 'image/png' },
          currentUser: { id: ADMIN_ID, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.message === 'SQL_TX_FAILED'
    );
    assert.equal(deletedUrls.length, 1);
    assert.ok(deletedUrls[0].endsWith('.png'));

    // 3. Cửa phụ /api/nguoi-dung/:id/khuon-mat bắt buộc dong_y_thu_thap theo NĐ 13/2023
    const nguoiDungRoutes = require('../routes/nguoiDung.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/nguoi-dung', nguoiDungRoutes);
    app.use(errorHandler);

    const adminToken = jwt.sign({ id: ADMIN_ID, phien_ban_token: 1 }, process.env.JWT_SECRET);
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      vai_tro_chinh: 'admin',
      kich_hoat: true,
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    }));

    const noConsentRes = await dispatchExpress(app, {
      method: 'POST',
      url: `/api/nguoi-dung/${STAFF_IN_ID}/khuon-mat`,
      headers: { Authorization: `Bearer ${adminToken}` },
      jsonBody: { khuon_mat_vector: v1, dong_y_thu_thap: false },
    });
    assert.equal(noConsentRes.status, 400);
    assert.equal(noConsentRes.body.errorCode, 'BIOMETRIC_CONSENT_REQUIRED_ND13');
  });
});

describe('Luồng 3.4 - Đọc cấu hình động NGUONG_AI & MARGIN_TOP1_TOP2', () => {
  it('đọc ngưỡng cosine_min từ NGUONG_AI và MARGIN_TOP1_TOP2 truyền tới AI /v1/face/recognize', async () => {
    stub(models.CauHinhHeThong, 'findAll', async () => [
      { khoa_cau_hinh: 'NGUONG_AI', gia_tri: { mo_hinh: 'buffalo_s', cosine_min: 0.62, liveness_min: 0.85 } },
      { khoa_cau_hinh: 'MARGIN_TOP1_TOP2', gia_tri: 0.09 },
    ]);
    stub(models.CauHinhHeThong, 'create', async () => ({}));

    await loadConfigsIntoCache(true);

    assert.equal(getEffectiveThreshold(), 0.62);
    assert.equal(getEffectiveMarginTop1Top2(), 0.09);

    let calledUrl = '';
    stub(global, 'fetch', async (url) => {
      calledUrl = String(url);
      return { ok: true, text: async () => JSON.stringify({ matched: false, reasons: [] }) };
    });

    await recognizeFace({ imageBuffer: JPEG_MAGIC_BUF });
    assert.ok(calledUrl.includes('threshold=0.62'));
    assert.ok(calledUrl.includes('margin=0.09'));
  });
});

describe('Luồng 3.5 - Hợp đồng Express enrollMultiAngleFace & testFaceRecognition', () => {
  const buildFaceApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/khuon-mat', require('../routes/khuonMat.routes'));
    app.use(errorHandler);
    return app;
  };

  it('enrollMultiAngleFace trả mau_khuon_mat_id chuẩn, MIME thật (.png), errorCode và chặn tệp giả chữ ký', async () => {
    const app = buildFaceApp();
    const adminToken = jwt.sign({ id: ADMIN_ID, phien_ban_token: 1 }, process.env.JWT_SECRET);

    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === ADMIN_ID) {
        return { id: ADMIN_ID, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
      }
      return { id: STAFF_IN_ID, ho_ten: 'Lê Thị D', ma_can_bo: 'CB04', email: 'd@uni.edu.vn' };
    });
    stub(models.MauKhuonMat, 'findAll', async () => []);
    stub(models.MauKhuonMat, 'destroy', async () => 0);
    stub(models.MauKhuonMat, 'create', async (payload) => ({ id: TPL_NEW_ID, ...payload }));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stubTransactionPassThrough();

    let savedObjectKey = '';
    let savedMime = '';
    stub(minioStorage, 'putObject', async (key, _buf, mime) => {
      savedObjectKey = key;
      savedMime = mime;
      return { storage: 'local' };
    });
    stub(minioStorage, 'deleteObject', async () => {});
    stub(global, 'fetch', async (url) => {
      if (String(url).includes('/v1/face/enroll-multi-angle')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              status: 'success',
              angles: { straight: { status: 'success', embedding: makeUnitVec(7) } },
            }),
        };
      }
      return { ok: true, text: async () => '{}' };
    });

    // 1. Giả chữ ký nhị phân (.png nhưng chứa text) -> 400 INVALID_IMAGE_SIGNATURE
    const spoofForm = new FormData();
    spoofForm.append('ma_can_bo', STAFF_IN_ID);
    spoofForm.append('dong_y_thu_thap', 'true');
    spoofForm.append('image_straight', new Blob([Buffer.from('not-a-real-image')], { type: 'image/png' }), 'fake.png');

    const spoofRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/khuon-mat/dang-ky-da-goc',
      headers: { Authorization: `Bearer ${adminToken}` },
      formData: spoofForm,
    });
    assert.equal(spoofRes.status, 400);
    assert.equal(spoofRes.body.errorCode, 'INVALID_IMAGE_SIGNATURE');

    // 2. Upload PNG hợp lệ -> trả đúng mau_khuon_mat_id, cac_goc_chup, so_luong_mau & MIME image/png
    const okForm = new FormData();
    okForm.append('ma_can_bo', STAFF_IN_ID);
    okForm.append('dong_y_thu_thap', 'true');
    okForm.append('image_straight', new Blob([PNG_MAGIC_BUF], { type: 'image/png' }), 'straight.png');

    const okRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/khuon-mat/dang-ky-da-goc',
      headers: { Authorization: `Bearer ${adminToken}` },
      formData: okForm,
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.mau_khuon_mat_id, TPL_NEW_ID);
    assert.deepEqual(okRes.body.data.cac_goc_chup, ['chinh_dien']);
    assert.equal(okRes.body.data.so_luong_mau, 1);
    assert.ok(savedObjectKey.endsWith('.png'));
    assert.equal(savedMime, 'image/png');
  });

  it('testFaceRecognition trả đúng nguoi_dung, do_tuong_dong, do_tin_cay và chặn base64 giả', async () => {
    const app = buildFaceApp();
    const adminToken = jwt.sign({ id: ADMIN_ID, phien_ban_token: 1 }, process.env.JWT_SECRET);

    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === ADMIN_ID) {
        return { id: ADMIN_ID, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
      }
      return {
        id: STAFF_IN_ID,
        ho_ten: 'Lê Thị D',
        email: 'd@uni.edu.vn',
        vai_tro_chinh: 'giang_vien',
        ma_can_bo: 'CB04',
        anh_dai_dien: '/api/tai-tep/tep/avatar.jpg',
        kich_hoat: true,
        trang_thai_lam_viec: 'dang_lam_viec',
        don_vi_chinh: { id: DEPT_ROOT, ten_phong_ban: 'Khoa CNTT' },
      };
    });
    stub(models.MauKhuonMat, 'count', async () => 1);
    stub(global, 'fetch', async (url) => {
      const u = String(url);
      if (u.includes('/v1/faiss/stats')) {
        return { ok: true, text: async () => JSON.stringify({ data: { total_vectors: 1, total_users: 1 } }) };
      }
      if (u.includes('/v1/face/recognize')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ matched: true, userId: STAFF_IN_ID, similarity: 0.92, liveness_score: 0.97 }),
        };
      }
      return { ok: true, text: async () => '{}' };
    });

    // Chặn base64 không phải ảnh
    const badBase64Res = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/khuon-mat/kiem-thu-nhan-dien',
      headers: { Authorization: `Bearer ${adminToken}` },
      jsonBody: { image: `data:image/jpeg;base64,${Buffer.from('not-jpeg').toString('base64')}` },
    });
    assert.equal(badBase64Res.status, 400);
    assert.equal(badBase64Res.body.errorCode, 'INVALID_IMAGE_SIGNATURE');

    // Ảnh JPEG hợp lệ -> trả đúng contract frontend
    const okTestForm = new FormData();
    okTestForm.append('image', new Blob([JPEG_MAGIC_BUF], { type: 'image/jpeg' }), 'test.jpg');
    const okRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/khuon-mat/kiem-thu-nhan-dien',
      headers: { Authorization: `Bearer ${adminToken}` },
      formData: okTestForm,
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.khop_khuon_mat, true);
    assert.equal(okRes.body.nguoi_dung.id, STAFF_IN_ID);
    assert.equal(okRes.body.nguoi_dung.ten_phong_ban, 'Khoa CNTT');
    assert.equal(okRes.body.do_tuong_dong, 0.92);
    assert.equal(okRes.body.do_tin_cay, 0.92);
  });
});

describe('Luồng 3.6 - Xóa NĐ 13/2023 dọn sạch MauKhuonMat.anh_dai_dien & lọc trạng thái active', () => {
  it('removeFaceDescriptorForUser thu thập MauKhuonMat.anh_dai_dien trước khi destroy & ensureRamCacheWarm / cache lọc bi_khoa', async () => {
    const cleanedPaths = [];
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: STAFF_IN_ID,
      ho_ten: 'Nguyễn Văn E',
      ma_can_bo: 'CB05',
      email: 'e@uni.edu.vn',
      anh_dai_dien: null, // Avatar hồ sơ null, nhưng MauKhuonMat có ảnh riêng!
    }));
    stub(models.MauKhuonMat, 'findAll', async () => [
      { id: TPL_NEW_ID, anh_dai_dien: '/api/tai-tep/tep/face-CB05-secret.png' },
    ]);
    stub(models.MauKhuonMat, 'destroy', async () => 1);
    stub(minioStorage, 'deleteUserFaceFiles', async (_id, _code, photoPath) => {
      if (photoPath) cleanedPaths.push(photoPath);
    });
    stub(minioStorage, 'deleteObject', async () => {});
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(global, 'fetch', async () => ({ ok: true, text: async () => '{}' }));

    const removed = await removeFaceDescriptorForUser({
      id: STAFF_IN_ID,
      currentUser: { id: ADMIN_ID, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
    });
    assert.equal(removed.so_luong_da_xoa, 1);
    assert.ok(cleanedPaths.includes('/api/tai-tep/tep/face-CB05-secret.png'));

    // Kiểm tra ensureRamCacheWarm & getCachedUsersWithFace lọc bi_khoa & da_nghi_viec
    let ramWhere = null;
    stub(global, 'fetch', async (url) => {
      if (String(url).includes('/v1/faiss/stats')) {
        return { ok: true, text: async () => JSON.stringify({ data: { total_vectors: 5, total_users: 2 } }) };
      }
      return { ok: true, text: async () => '{}' };
    });
    stub(models.MauKhuonMat, 'count', async (opts) => {
      ramWhere = opts.where;
      return 2;
    });
    await ensureRamCacheWarm();
    assert.ok(ramWhere.trang_thai);

    let cacheTplWhere = null;
    let cacheUserWhere = null;
    stub(models.MauKhuonMat, 'findAll', async (opts) => {
      cacheTplWhere = opts.where;
      return [{ nguoi_dung_id: STAFF_IN_ID, vector_dac_trung: [makeUnitVec(1)] }];
    });
    stub(models.NguoiDung, 'findAll', async (opts) => {
      cacheUserWhere = opts.where;
      return [];
    });
    await getCachedUsersWithFace();
    assert.ok(cacheTplWhere.trang_thai);
    assert.equal(cacheUserWhere.kich_hoat, true);
    assert.ok(cacheUserWhere.trang_thai_lam_viec);

    // Chặn ảnh giả mạo (liveness.is_live === false) và ảnh kém chất lượng (quality.valid === false) ở /nguoi-dung/:id/khuon-mat
    let spoofOrQualityPayload = {
      status: 'face_detected',
      embeddingDimensions: 512,
      embedding: makeUnitVec(1),
      liveness: { is_live: false, score: 0.12 },
      quality: { valid: true, reasons: [] },
    };
    stub(global, 'fetch', async () => ({
      ok: true,
      text: async () => JSON.stringify(spoofOrQualityPayload),
    }));
    const validFile = { buffer: JPEG_MAGIC_BUF, mimetype: 'image/jpeg', originalname: 'front.jpg' };
    await assert.rejects(
      () =>
        registerFaceImagesForUser({
          id: STAFF_IN_ID,
          files: [validFile],
          sampleAngles: ['straight'],
          currentUser: { id: ADMIN_ID, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'SPOOF_DETECTED'
    );

    spoofOrQualityPayload = {
      status: 'face_detected',
      embeddingDimensions: 512,
      embedding: makeUnitVec(1),
      liveness: { is_live: true, score: 0.95 },
      quality: { valid: false, reasons: ['BLURRY_IMAGE'] },
    };
    await assert.rejects(
      () =>
        registerFaceImagesForUser({
          id: STAFF_IN_ID,
          files: [validFile],
          sampleAngles: ['straight'],
          currentUser: { id: ADMIN_ID, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'LOW_FACE_QUALITY'
    );
  });
});
