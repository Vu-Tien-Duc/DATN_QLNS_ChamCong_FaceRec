// Kiểm thử trọng tâm Luồng 10: Hạ tầng Express/Rate Limit/Env, Upload & MinIO, Môn học, Cron Jobs, BullMQ và Email.
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key-32-chars-minimum!';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'unit-test-refresh-secret-32-chars-min!';
process.env.TERMINAL_KEY = process.env.TERMINAL_KEY || 'unit-test-terminal-key-32-chars-minimum!';
process.env.DISABLE_BULLMQ = 'true';

const { sequelize } = require('../config/db');
const models = require('../models');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const minioStorage = require('../config/minio');
const { validateFileMagicBytes } = require('../middlewares/taiTep.middleware');
const taiTepService = require('../services/heThong/taiTep.service');
const subjectService = require('../services/nhanSu/monHoc.service');
const {
  getTodayActiveSchedules,
  scanAndMarkExpiredShiftsAbsent,
  processAdminStaffDailyAttendance,
} = require('../services/heThong/tacVuDinhKy.service');
const { processPunchJobData } = require('../queues/hangDoiChamCong');
const { validateEnvironment } = require('../config/env');
const guiEmailService = require('../services/heThong/guiEmail.service');
const { transporter } = require('../config/mailer');

const USER_1 = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';
const DEPT_1 = '88888888-8888-4888-8888-888888888888';
const SUBJ_1 = '99999999-9999-4999-8999-999999999999';

const restores = [];
const stub = (obj, prop, value) => {
  const original = obj[prop];
  obj[prop] = value;
  restores.push(() => {
    obj[prop] = original;
  });
};

afterEach(() => {
  while (restores.length > 0) {
    restores.pop()();
  }
});

const signUser = (role, id = USER_1) =>
  jwt.sign({ id, vai_tro_chinh: role, phien_ban_token: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

const dispatchExpress = (app, { method = 'GET', url = '/', headers = {}, jsonBody = null, formData = null } = {}) =>
  new Promise((resolve, reject) => {
    let rawBody = Buffer.alloc(0);
    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      reqHeaders[k.toLowerCase()] = v;
    }

    const run = async () => {
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
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try {
          parsed = JSON.parse(text);
        } catch {}
        resolve({ status: res.statusCode, body: parsed, headers: res.getHeaders() });
      };
      app(req, res);
    };
    run().catch(reject);
  });

describe('Luồng 10 - Express, Rate Limit, Health & Env', () => {
  it('Không mount trùng apiRoutes ngoài /api, ẩn schema/bảng tại /suc-khoe và tách prefix RateLimiter riêng biệt', async () => {
    stub(sequelize, 'authenticate', async () => {});
    const app = require('../app');

    // Đường dẫn không có /api phải trả 404 (không vượt rào apiGeneralLimiter)
    const bypassRes = await dispatchExpress(app, { url: '/nguoi-dung' });
    assert.equal(bypassRes.status, 404);

    // /suc-khoe và /api/suc-khoe không lộ tên 24 bảng CSDL hay môi trường
    const health1 = await dispatchExpress(app, { url: '/suc-khoe' });
    const health2 = await dispatchExpress(app, { url: '/api/suc-khoe' });
    assert.equal(health1.status, 200);
    assert.equal(health2.status, 200);
    assert.equal('tables' in health1.body, false);
    assert.equal('tablesCount' in health1.body, false);
    assert.equal('environment' in health2.body, false);
    assert.equal(health1.body.database, 'CONNECTED');

    // Rate Limiter tạo store & prefix riêng cho từng phân hệ khi bật REDIS_URL
    const prevRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const Module = require('module');
    const origLoad = Module._load;
    const createdPrefixes = [];
    Module._load = function mockLoad(request, parent, isMain) {
      if (request === 'rate-limit-redis') {
        return {
          RedisStore: class FakeRedisStore {
            constructor(opts) {
              this.prefix = opts.prefix;
              createdPrefixes.push(opts.prefix);
            }
            async increment() {
              return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
            }
            async decrement() {}
            async resetKey() {}
          },
        };
      }
      if (request === 'redis') {
        return {
          createClient: () => ({
            connect: async () => {},
            sendCommand: async () => {},
          }),
        };
      }
      return origLoad.apply(this, arguments);
    };
    try {
      const rateLimitPath = require.resolve('../middlewares/gioiHanTruyCap.middleware');
      delete require.cache[rateLimitPath];
      require('../middlewares/gioiHanTruyCap.middleware');
      assert.equal(new Set(createdPrefixes).size, createdPrefixes.length);
      assert.ok(createdPrefixes.includes('rl:login:'));
      assert.ok(createdPrefixes.includes('rl:password_reset:'));
      assert.ok(createdPrefixes.includes('rl:api_general:'));
      assert.ok(createdPrefixes.includes('rl:file_upload:'));
    } finally {
      Module._load = origLoad;
      const rateLimitPath = require.resolve('../middlewares/gioiHanTruyCap.middleware');
      delete require.cache[rateLimitPath];
      if (prevRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prevRedisUrl;
    }
  });

  it('env.js bắt lỗi production khi thiếu DB_HOST hoặc DB_PASSWORD (OR thay vì AND)', () => {
    const snapshot = { ...process.env };
    restores.push(() => {
      for (const k of ['NODE_ENV', 'DB_HOST', 'DB_PASSWORD', 'ATTENDANCE_EVIDENCE_DIR', 'FACE_SERVICE_API_KEY', 'BIOMETRIC_ENCRYPTION_KEY', 'CORS_WHITELIST']) {
        if (snapshot[k] === undefined) delete process.env[k];
        else process.env[k] = snapshot[k];
      }
    });

    process.env.NODE_ENV = 'production';
    process.env.DB_HOST = 'sql.internal';
    delete process.env.DB_PASSWORD;
    process.env.ATTENDANCE_EVIDENCE_DIR = '/var/data/evidence';
    process.env.FACE_SERVICE_API_KEY = 'prod-face-key-1234567890';
    process.env.BIOMETRIC_ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.CORS_WHITELIST = 'https://chamcongdh.io.vn';

    assert.throws(() => validateEnvironment(), /DB_HOST, DB_PASSWORD/);
  });
});

describe('Luồng 10 - Upload, Magic Bytes, Path Traversal & Quyền xem tệp', () => {
  it('Chặn Path Traversal ở resolveLocalPath & kiểm tra Magic Bytes thật khi upload', async () => {
    assert.throws(() => minioStorage.resolveLocalPath('../../etc/passwd'), /traversal|vượt quá phạm vi|không hợp lệ/);
    assert.throws(() => minioStorage.resolveLocalPath('attachments/../../secret.txt'), /traversal|vượt quá phạm vi/);
    assert.throws(() => minioStorage.resolveLocalPath('C:\\Windows\\win.ini'), /không hợp lệ|traversal/);

    const safeResolved = minioStorage.resolveLocalPath('attachments/test-ok.pdf');
    assert.ok(safeResolved.startsWith(path.resolve(minioStorage.LOCAL_STORAGE_ROOT) + path.sep) || safeResolved.includes('uploads'));

    assert.equal(validateFileMagicBytes(Buffer.from('<script>alert(1)</script>'), 'image/jpeg'), false);
    assert.equal(validateFileMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
    assert.equal(validateFileMagicBytes(Buffer.from('%PDF-1.7\n'), 'application/pdf'), true);

    stub(minioStorage, 'putObject', async (key, buf) => ({ objectKey: key, size: buf.length, storage: 'local' }));
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      vai_tro_chinh: 'giang_vien',
      kich_hoat: true,
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    }));

    const app = express();
    app.use('/api/tai-tep', require('../routes/taiTep.routes'));
    app.use(errorHandler);

    const token = signUser('giang_vien', USER_1);
    const spoofedForm = new FormData();
    spoofedForm.append('file', new Blob(['<html>bad</html>'], { type: 'image/png' }), 'evil.png');

    const badUpload = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/tai-tep',
      headers: { Authorization: `Bearer ${token}` },
      formData: spoofedForm,
    });
    assert.equal(badUpload.status, 400);
    assert.equal(badUpload.body.errorCode, 'INVALID_FILE_MAGIC_BYTES');

    // Upload hợp lệ -> không lộ presignedUrl, cho phép chính chủ preview tạm, chặn người khác
    stub(minioStorage, 'getPresignedUrl', async () => 'https://minio.local/presigned-leak?sig=1');
    const validForm = new FormData();
    validForm.append('file', new Blob([Buffer.from('%PDF-1.7\nhello')], { type: 'application/pdf' }), 'giay-kham.pdf');
    const okUpload = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/tai-tep',
      headers: { Authorization: `Bearer ${token}` },
      formData: validForm,
    });
    assert.equal(okUpload.status, 201);
    assert.match(okUpload.body.data.url, /\/api\/tai-tep\/tep\/attachment-.*\.pdf$/);
    assert.equal(okUpload.body.data.url.includes('presigned-leak'), false);

    stub(models.DonNghiPhep, 'findOne', async () => null);
    stub(models.LuotQuetChamCong, 'findOne', async () => null);
    stub(models.NguoiDung, 'findOne', async () => null);
    stub(models.MauKhuonMat, 'findOne', async () => null);
    const policyOwner = await taiTepService.resolveDownloadPolicy(okUpload.body.data.ten_tep);
    assert.equal(policyOwner.access, 'pending_attachment');
    assert.equal(policyOwner.ownerId, USER_1);

    // Phó khoa chưa ủy quyền bị chặn xem tệp đính kèm đơn nghỉ phép của người khác
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [],
    }));
    const unauthDeputy = { id: USER_1, vai_tro_chinh: 'pho_khoa', don_vi_chinh_id: DEPT_1, danh_sach_vai_tro: [] };
    const deniedDeputy = await taiTepService.canAccessLeaveAttachment(unauthDeputy, USER_2);
    assert.equal(deniedDeputy.allowed, false);

    const authDeputy = {
      id: USER_1,
      vai_tro_chinh: 'pho_khoa',
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', don_vi_id: DEPT_1, duoc_uy_quyen: true }],
    };
    const allowedDeputy = await taiTepService.canAccessLeaveAttachment(authDeputy, USER_2);
    assert.equal(allowedDeputy.allowed, true);
  });
});

describe('Luồng 10 - Danh mục Môn học', () => {
  it('Chặn so_tin_chi không phải số nguyên (NaN/2.5/99 -> 400) và bọc deleteSubject trong Transaction', async () => {
    await assert.rejects(() => subjectService.getSubjects({ so_tin_chi: 'abc' }), (err) => err.statusCode === 400);
    await assert.rejects(
      () => subjectService.createSubject({ ma_mon: 'IT999', ten_mon: 'Test', so_tin_chi: 2.5 }, { id: USER_1, vai_tro_chinh: 'admin' }),
      (err) => err.statusCode === 400
    );

    let txUsed = false;
    stub(sequelize, 'transaction', async (cb) => {
      txUsed = true;
      return cb({});
    });
    stub(models.MonHoc, 'findByPk', async () => ({
      id: SUBJ_1,
      ma_mon: 'IT101',
      ten_mon: 'Tin học',
      destroy: async () => {},
    }));
    stub(models.LichTrinh, 'count', async () => 0);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    await subjectService.deleteSubject(SUBJ_1, { id: USER_1, vai_tro_chinh: 'admin' });
    assert.equal(txUsed, true);
  });
});

describe('Luồng 10 - Cron Jobs, BullMQ & Email', () => {
  it('getTodayActiveSchedules không dịch +14h vào tối 22:00 VN & scanAndMarkExpiredShiftsAbsent không đánh vắng giữa ca', async () => {
    // 22:00 ngày 20/11/2026 giờ VN = 15:00Z ngày 20/11 (nếu cộng +7h kép sẽ thành 05:00 ngày 21/11!)
    const lateEveningVn = new Date('2026-11-20T22:00:00+07:00');
    const excludedForToday = {
      id: 'sch-evening',
      nguoi_dung_id: USER_1,
      ngay_bat_dau: '2026-11-01',
      ngay_ket_thuc: '2026-12-31',
      tuan_hoc: [],
      ngoai_le: [{ trang_thai: 'nghi', ngay: '2026-11-20' }],
    };
    stub(models.LichTrinh, 'findAll', async () => [excludedForToday]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);

    const listAt22h = await getTodayActiveSchedules(lateEveningVn);
    assert.equal(listAt22h.length, 0);

    // Ca 07:00 - 09:30, quét lúc 07:30 (đã qua 30p nhưng ca CHƯA kết thúc) -> không đánh vắng
    let absentCreated = false;
    stub(models.CauHinhHeThong, 'findAll', async () => []);
    stub(models.CauHinhHeThong, 'findOne', async () => null);
    stub(models.CauHinhHeThong, 'create', async (d) => d);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: 'sch-morning',
        nguoi_dung_id: USER_1,
        ngay_bat_dau: '2026-11-01',
        ngay_ket_thuc: '2026-12-31',
        gio_bat_dau: '07:00',
        gio_ket_thuc: '09:30',
        ca: { id: 'ca-1', ten_ca: 'Ca 1', gio_bat_dau: '07:00', gio_ket_thuc: '09:30', nguong_di_muon_phut: 15 },
        tuan_hoc: [],
        ngoai_le: [],
      },
    ]);
    stub(models.NhatKyChamCong, 'create', async () => {
      absentCreated = true;
      return {};
    });

    await scanAndMarkExpiredShiftsAbsent(new Date('2026-11-20T07:30:00+07:00'));
    assert.equal(absentCreated, false);
  });

  it('processAdminStaffDailyAttendance lọc bỏ đa vai trò bgh/giang_vien và chọn đúng ca Hành chính', async () => {
    const createdPayloads = [];
    stub(models.CaLamViec, 'findAll', async () => [
      { id: 'ca-1', ten_ca: 'Ca 1 (Tiết 1-3)', gio_bat_dau: '07:00' },
      { id: 'ca-hc', ten_ca: 'Ca Hành Chính', gio_bat_dau: '08:00' },
    ]);
    stub(models.NguoiDung, 'findAll', async () => [
      {
        id: 'nv-kiembgh',
        ho_ten: 'NV kiêm BGH',
        vai_tro_chinh: 'nhan_vien',
        danh_sach_vai_tro: [{ ma_vai_tro: 'bgh' }],
        ho_so: { loai_nhan_su: 'hanh_chinh' },
      },
      {
        id: 'nv-chuan',
        ho_ten: 'NV Hành Chính',
        vai_tro_chinh: 'nhan_vien',
        danh_sach_vai_tro: [],
        ho_so: { loai_nhan_su: 'hanh_chinh' },
      },
    ]);
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.DonNghiPhep, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'create', async (p) => {
      createdPayloads.push(p);
      return { id: 'log-hc-1', ...p };
    });

    await processAdminStaffDailyAttendance(new Date('2026-11-20T23:59:00+07:00'), {
      dateStr: '2026-11-20',
      startOfDay: new Date('2026-11-20T00:00:00+07:00'),
      endOfDay: new Date('2026-11-20T23:59:59+07:00'),
    });
    assert.equal(createdPayloads.length, 1);
    assert.equal(createdPayloads[0].nguoi_dung_id, 'nv-chuan');
    assert.equal(createdPayloads[0].ca_id, 'ca-hc');
  });

  it('processPunchJobData không nuốt lỗi DB (rethrow để BullMQ retry) & guiEmail guard + Asia/Ho_Chi_Minh', async () => {
    stub(models.NhatKyChamCong, 'findOne', async () => {
      throw new Error('ECONNRESET SQL Server');
    });
    await assert.rejects(
      () => processPunchJobData({ nguoi_dung_id: USER_1, type: 'face_ai' }),
      /ECONNRESET SQL Server/
    );

    let sentMail = null;
    stub(transporter, 'sendMail', async (opts) => {
      sentMail = opts;
      return { messageId: 'ok' };
    });
    const noEmail = await guiEmailService.sendAbsentWarningEmail({ to: '', fullName: 'A', date: '2026-11-21' });
    assert.equal(noEmail, null);
    assert.equal(sentMail, null);

    // 2026-11-21T18:00:00Z = 01:00 sáng 22/11/2026 giờ VN
    await guiEmailService.sendAbsentWarningEmail({
      to: 'gv@ntu.edu.vn',
      fullName: 'GV',
      shiftName: 'Ca 1',
      date: '2026-11-21T18:00:00.000Z',
    });
    assert.match(sentMail.subject, /22\/11\/2026/);

    // Kiểm tra idempotency của getVietnamTime (ngăn dịch +14h trong khung 17:00-23:59 giờ VN)
    const { getVietnamTime } = require('../utils/thoiGianChamCong.utils');
    const { isScheduleActiveOnDate } = require('../utils/ngayLichTrinh.utils');
    const eveningVn = new Date('2026-11-21T17:15:00+07:00');
    const onceVn = getVietnamTime(eveningVn);
    const twiceVn = getVietnamTime(onceVn);
    assert.equal(twiceVn, onceVn);
    assert.equal(
      isScheduleActiveOnDate(
        { id: 'sch-last-day', ngay_bat_dau: '2026-11-01', ngay_ket_thuc: '2026-11-21', tuan_hoc: [], ngoai_le: [] },
        twiceVn
      ),
      true
    );
  });
});
