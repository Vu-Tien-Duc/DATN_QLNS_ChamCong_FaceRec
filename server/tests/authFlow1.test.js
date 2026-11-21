// Kiểm thử trọng tâm Luồng 1 (Xác thực, Phiên đăng nhập, Blacklist Logout, Refresh Race Condition, OTP, Socket.IO & RBAC).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'unit-test-refresh-secret-key';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const models = require('../models');
const { deleteGraceToken } = require('../config/redis');
const { PERMISSIONS } = require('../config/permissions');
const { transporter } = require('../config/mailer');
const minioStorage = require('../config/minio');
const { initSocketServer, closeSocketServer } = require('../config/socket');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const { getActiveRoles, getUserPermissions } = require('../middlewares/xacThuc.middleware');
const xacThucRoutes = require('../routes/xacThuc.routes');
const authService = require('../services/heThong/xacThuc.service');

const ID_USER = '11111111-1111-4111-8111-111111111111';
const ID_USER_2 = '22222222-2222-4222-8222-222222222222';
const ID_DEPT = '33333333-3333-4333-8333-333333333333';

const hashStr = (v) => crypto.createHash('sha256').update(String(v).trim()).digest('hex');

const restores = [];
const stub = (obj, prop, value) => {
  const original = obj[prop];
  obj[prop] = value;
  restores.push(() => {
    obj[prop] = original;
  });
};

afterEach(async () => {
  while (restores.length > 0) {
    restores.pop()();
  }
  authService.rotationGraceCache.clear();
  authService.loginFailureMap.clear();
  authService.otpCooldownMap.clear();
  await closeSocketServer();
});

const createAuthApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/xac-thuc', xacThucRoutes);
  app.use(errorHandler);
  return app;
};

const dispatchExpress = (app, { method = 'GET', url, headers = {}, body = null }) => {
  const reqHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    reqHeaders[k.toLowerCase()] = v;
  }

  let bodyBuf = null;
  if (body !== null && body !== undefined) {
    bodyBuf = Buffer.from(JSON.stringify(body), 'utf8');
    reqHeaders['content-type'] = reqHeaders['content-type'] || 'application/json';
    reqHeaders['content-length'] = String(bodyBuf.length);
  }

  return new Promise((resolve) => {
    const socket = new Readable({ read() {} });
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = reqHeaders;
    if (bodyBuf) req.push(bodyBuf);
    req.push(null);

    const chunks = [];
    const res = new http.ServerResponse(req);
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (_) {}
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        json,
        text,
      });
    };
    app.handle(req, res);
  });
};

const stubFakeTx = () => {
  const fakeTx = { LOCK: { UPDATE: 'UPDATE' } };
  let txChain = Promise.resolve();
  stub(sequelize, 'transaction', (fn) => {
    const run = txChain.then(() => fn(fakeTx));
    txChain = run.catch(() => {});
    return run;
  });
  return fakeTx;
};

describe('Luồng 1 - Đăng xuất Blacklist, Refresh Token Rotation & Grace Race Condition', () => {
  it('logout đưa Access Token vào Blacklist thật sự (request tiếp theo bị 401 ngay lập tức) và vẫn cho phép logout khi Access Token vừa hết hạn', async () => {
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    const destroyedQueries = [];
    stub(models.MaLamMoi, 'findOne', async () => ({
      id: 'rt-1',
      nguoi_dung_id: ID_USER,
      ma_nhom_token: 'fam-1',
    }));
    stub(models.MaLamMoi, 'destroy', async (q) => {
      destroyedQueries.push(q);
      return 1;
    });

    const userRecord = {
      id: ID_USER,
      email: 'ducvt.gv@ntu.edu.vn',
      ho_ten: 'ThS. Vũ Tiến Đức',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_DEPT,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      doi_mat_khau_luc: null,
      danh_sach_vai_tro: [],
    };
    stub(models.NguoiDung, 'findByPk', async (id) => (id === ID_USER ? { ...userRecord } : null));
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const accessToken = authService.generateAccessToken(userRecord);
    const { tokenString: refreshToken } = authService.generateRefreshToken(userRecord, 'fam-1');
    const app = createAuthApp();

    // Trước khi logout: /ho-so trả 200 và giữ nguyên don_vi_chinh_id là chuỗi UUID
    const meBefore = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/xac-thuc/ho-so',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(meBefore.status, 200);

    // Gọi logout
    const logoutRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/xac-thuc/dang-xuat',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { ma_lam_moi: refreshToken },
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(destroyedQueries.length, 1);
    assert.deepEqual(destroyedQueries[0], { where: { ma_nhom_token: 'fam-1' } });

    // Ngay sau logout: Access Token cũ phải bị chặn 401 lập tức
    const meAfter = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/xac-thuc/ho-so',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(meAfter.status, 401);
    assert.match(meAfter.json.message, /vô hiệu hóa/i);

    // Access Token đã hết hạn gọi /dang-xuat vẫn trả 200, xóa Refresh Token & clear Cookie
    const expiredToken = jwt.sign(
      { id: ID_USER, phien_ban_token: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '-5s' }
    );
    const expiredLogoutRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/xac-thuc/dang-xuat',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { ma_lam_moi: refreshToken },
    });
    assert.equal(expiredLogoutRes.status, 200);
    assert.ok(String(expiredLogoutRes.headers['set-cookie']).includes('refreshToken=;'));
  });

  it('2 request /lam-moi-token chạy song song dùng Grace Period không kích hoạt nhầm Replay Attack; replay sau 15s mới bị thu hồi toàn bộ họ token', async () => {
    stubFakeTx();
    const auditLogs = [];
    const incremented = [];
    stub(models.NhatKyKiemToan, 'create', async (entry) => {
      auditLogs.push(entry);
      return entry;
    });
    stub(models.NguoiDung, 'increment', async (...args) => {
      incremented.push(args);
      return [1];
    });

    const userRow = {
      id: ID_USER,
      email: 'ducvt.gv@ntu.edu.vn',
      ho_ten: 'ThS. Vũ Tiến Đức',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_DEPT,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    };
    stub(models.NguoiDung, 'findByPk', async () => userRow);

    const { tokenString: rt1, tokenFamily } = authService.generateRefreshToken(userRow, 'fam-race');
    const rtStore = new Map();
    rtStore.set(hashStr(rt1), {
      chuoi_token: hashStr(rt1),
      ma_nhom_token: tokenFamily,
      nguoi_dung_id: ID_USER,
      da_su_dung: false,
      thoi_diem_su_dung: null,
      het_han_luc: new Date(Date.now() + 86400000),
      async save() {
        return this;
      },
    });

    stub(models.MaLamMoi, 'findOne', async ({ where }) => rtStore.get(where.chuoi_token) || null);
    stub(models.MaLamMoi, 'create', async (data) => {
      const doc = {
        ...data,
        da_su_dung: false,
        thoi_diem_su_dung: null,
        async save() {
          return this;
        },
      };
      rtStore.set(data.chuoi_token, doc);
      return doc;
    });
    stub(models.MaLamMoi, 'destroy', async ({ where }) => {
      for (const [k, v] of rtStore.entries()) {
        if (where.ma_nhom_token && v.ma_nhom_token === where.ma_nhom_token) rtStore.delete(k);
        if (where.nguoi_dung_id && v.nguoi_dung_id === where.nguoi_dung_id) rtStore.delete(k);
      }
      return 1;
    });

    // Giả lập 2 request đồng thời cùng giữ rt1 khi grace cache đang trống
    const [resA, resB] = await Promise.all([
      authService.refreshToken({ refreshTokenString: rt1, ipAddress: '127.0.0.1' }),
      authService.refreshToken({ refreshTokenString: rt1, ipAddress: '127.0.0.1' }),
    ]);

    assert.ok(resA.accessToken);
    assert.equal(resA.accessToken, resB.accessToken);
    assert.equal(resA.refreshToken, resB.refreshToken);
    assert.equal(incremented.length, 0);
    assert.equal(auditLogs.some((l) => l.hanh_dong === 'REPLAY_ATTACK_DETECTED'), false);

    // Giả lập replay sau hơn 15 giây (hết grace period)
    authService.rotationGraceCache.clear();
    await deleteGraceToken(hashStr(rt1));
    const usedDoc = rtStore.get(hashStr(rt1));
    usedDoc.thoi_diem_su_dung = new Date(Date.now() - 20000);

    await assert.rejects(
      () => authService.refreshToken({ refreshTokenString: rt1, ipAddress: '127.0.0.1' }),
      (err) => err.statusCode === 403 && err.errorCode === 'REFRESH_TOKEN_REUSE_DETECTED'
    );
    assert.equal(incremented.length, 1);
    assert.equal(rtStore.size, 0);
    assert.equal(auditLogs.some((l) => l.hanh_dong === 'REPLAY_ATTACK_DETECTED'), true);
  });

  it('refresh token bị thu hồi do logout/changePassword không gây Replay Attack giả lên phiên mới', async () => {
    stubFakeTx();
    const auditLogs = [];
    const incremented = [];
    stub(models.NhatKyKiemToan, 'create', async (entry) => {
      auditLogs.push(entry);
      return entry;
    });
    stub(models.NguoiDung, 'increment', async (...args) => {
      incremented.push(args);
      return [1];
    });

    const hashedOld = await bcrypt.hash('oldpass123', 6);
    const userRow = {
      id: ID_USER,
      email: 'ducvt.gv@ntu.edu.vn',
      mat_khau_ma_hoa: hashedOld,
      phien_ban_token: 1,
      async save() {
        return this;
      },
    };
    stub(models.NguoiDung, 'scope', () => ({
      findByPk: async () => userRow,
    }));

    const rtStore = new Map();
    const { tokenString: oldRt } = authService.generateRefreshToken(userRow, 'fam-old');
    rtStore.set(hashStr(oldRt), {
      chuoi_token: hashStr(oldRt),
      ma_nhom_token: 'fam-old',
      nguoi_dung_id: ID_USER,
      da_su_dung: false,
    });

    stub(models.MaLamMoi, 'findOne', async ({ where }) => rtStore.get(where.chuoi_token) || null);
    stub(models.MaLamMoi, 'destroy', async ({ where }) => {
      for (const [k, v] of rtStore.entries()) {
        if (where.nguoi_dung_id && v.nguoi_dung_id === where.nguoi_dung_id) rtStore.delete(k);
      }
      return 1;
    });

    await authService.changePassword({
      userId: ID_USER,
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });

    assert.equal(userRow.phien_ban_token, 2);
    assert.equal(rtStore.size, 0);

    // Tab cũ dùng oldRt gọi refresh -> chỉ nhận 403 invalid/cancelled, KHÔNG tăng phien_ban_token lần nữa và KHÔNG log replay
    await assert.rejects(
      () => authService.refreshToken({ refreshTokenString: oldRt }),
      (err) => err.statusCode === 403 && err.errorCode !== 'REFRESH_TOKEN_REUSE_DETECTED'
    );
    assert.equal(userRow.phien_ban_token, 2);
    assert.equal(incremented.length, 0);
    assert.equal(auditLogs.some((l) => l.hanh_dong === 'REPLAY_ATTACK_DETECTED'), false);
  });
});

describe('Luồng 1 - Bảo vệ verifyToken, formatUserResponse & Upload Avatar', () => {
  it('verifyToken chặn JWT thiếu tokenVersion (401 SESSION_REVOKED), chặn UUID sai định dạng (401 không 500) và formatUserResponse giữ don_vi_chinh_id là chuỗi UUID', async () => {
    const app = createAuthApp();

    const tokenMissingVersion = jwt.sign({ id: ID_USER }, process.env.JWT_SECRET, { expiresIn: '5m' });
    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id !== ID_USER) {
        throw new Error('Conversion failed when converting from a character string to uniqueidentifier.');
      }
      return {
        id: ID_USER,
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: ID_DEPT,
        don_vi_chinh: { id: ID_DEPT, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa' },
        kich_hoat: true,
        trang_thai_lam_viec: 'dang_lam_viec',
        phien_ban_token: 1,
        doi_mat_khau_luc: null,
        ho_ten: 'ThS. Vũ Tiến Đức',
        email: 'ducvt.gv@ntu.edu.vn',
        ma_can_bo: 'GV0001',
        anh_dai_dien: null,
        danh_sach_vai_tro: [],
        toJSON() {
          return { ...this };
        },
      };
    });
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const missingVerRes = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/xac-thuc/ho-so',
      headers: { Authorization: `Bearer ${tokenMissingVersion}` },
    });
    assert.equal(missingVerRes.status, 401);
    assert.equal(missingVerRes.json.errorCode, 'SESSION_REVOKED');

    const badUuidToken = jwt.sign({ id: 'not-a-valid-uuid', phien_ban_token: 1 }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const badUuidRes = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/xac-thuc/ho-so',
      headers: { Authorization: `Bearer ${badUuidToken}` },
    });
    assert.equal(badUuidRes.status, 401);
    assert.doesNotMatch(badUuidRes.text, /uniqueidentifier/i);

    const validToken = authService.generateAccessToken({
      id: ID_USER,
      email: 'ducvt.gv@ntu.edu.vn',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_DEPT,
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    });
    const validRes = await dispatchExpress(app, {
      method: 'GET',
      url: '/api/xac-thuc/ho-so',
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(validRes.status, 200);
    assert.equal(validRes.json.data.don_vi_chinh_id, ID_DEPT);
    assert.equal(validRes.json.data.don_vi_chinh.ten_phong_ban, 'Khoa CNTT');
  });

  it('updateAvatar kiểm tra magic bytes thực tế (chặn giả mạo HTML/script) và URL HTTPS hợp lệ', async () => {
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    const userDoc = {
      id: ID_USER,
      anh_dai_dien: null,
      async save() {
        return this;
      },
    };
    stub(models.NguoiDung, 'findByPk', async () => userDoc);
    const storedObjects = [];
    stub(minioStorage, 'putObject', async (key, buf, mime) => {
      storedObjects.push({ key, size: buf.length, mime });
      return true;
    });

    // Giả mạo payload HTML/script dưới danh nghĩa ảnh
    await assert.rejects(
      () =>
        authService.updateAvatar({
          userId: ID_USER,
          imageBuffer: Buffer.from('<script>alert(1)</script>padding-bytes'),
        }),
      (err) => err.statusCode === 400
    );

    // Chặn URL không phải https / internal path
    await assert.rejects(
      () =>
        authService.updateAvatar({
          userId: ID_USER,
          avatarUrl: 'http://insecure.example.com/a.png',
        }),
      (err) => err.statusCode === 400
    );

    // Chấp nhận header PNG hợp lệ
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const okRes = await authService.updateAvatar({
      userId: ID_USER,
      imageBuffer: pngHeader,
    });
    assert.match(okRes.anh_dai_dien, /^\/api\/tai-tep\/tep\/avatar-.*\.png$/);
    assert.equal(storedObjects[0].mime, 'image/png');
  });
});

describe('Luồng 1 - Chống Account Enumeration, Khóa Brute-force & Quy trình OTP', () => {
  it('login chống dò tài khoản bị khóa khi sai mật khẩu (trả 401 thay vì 403), chỉ trả 403 khi đúng mật khẩu, và khóa 429 khi thử sai gộp email + ma_can_bo', async () => {
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.MaLamMoi, 'create', async () => ({}));
    stub(models.NguoiDung, 'update', async () => [1]);
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const passwordHash = await bcrypt.hash('secret123', 6);
    const lockedUser = {
      id: ID_USER,
      email: 'locked@ntu.edu.vn',
      ma_can_bo: 'GV9999',
      mat_khau_ma_hoa: passwordHash,
      kich_hoat: false,
      trang_thai_lam_viec: 'tam_nghi',
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [],
    };
    const activeUser = {
      id: ID_USER_2,
      email: 'active@ntu.edu.vn',
      ma_can_bo: 'GV0002',
      mat_khau_ma_hoa: passwordHash,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [],
    };

    stub(models.NguoiDung, 'scope', () => ({
      findOne: async ({ where }) => {
        const clauses = Array.isArray(where?.[Op.or]) ? where[Op.or] : [where];
        const values = clauses.flatMap((c) => Object.values(c || {}));
        if (values.includes('locked@ntu.edu.vn') || values.includes('GV9999')) return lockedUser;
        if (values.includes('active@ntu.edu.vn') || values.includes('GV0002')) return activeUser;
        return null;
      },
    }));

    // Tài khoản bị khóa nhưng nhập sai mật khẩu -> phải trả 401 giống tài khoản không tồn tại
    await assert.rejects(
      () => authService.login({ email: 'locked@ntu.edu.vn', password: 'wrong' }),
      (err) => err.statusCode === 401
    );
    // Đúng mật khẩu -> mới báo 403 bị vô hiệu hóa
    await assert.rejects(
      () => authService.login({ email: 'locked@ntu.edu.vn', password: 'secret123' }),
      (err) => err.statusCode === 403
    );

    // Thử sai 5 lần xen kẽ email và ma_can_bo -> lần thứ 6 bị khóa 429 dù đổi sang ma_can_bo hay nhập đúng
    for (let i = 0; i < 5; i++) {
      const identifier = i % 2 === 0 ? 'active@ntu.edu.vn' : 'GV0002';
      await assert.rejects(
        () => authService.login({ email: identifier, password: 'wrong' }),
        (err) => err.statusCode === 401
      );
    }
    await assert.rejects(
      () => authService.login({ email: 'GV0002', password: 'secret123' }),
      (err) => err.statusCode === 429 && err.errorCode === 'AUTH_RATE_LIMIT_EXCEEDED'
    );
  });

  it('forgotPassword áp dụng cooldown 429 cho cả email không tồn tại (chống dò email), escape HTML tên người dùng, và resetPassword khóa OTP ngay ở lần sai thứ 5', async () => {
    stubFakeTx();
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const sentEmails = [];
    stub(transporter, 'sendMail', async (mail) => {
      sentEmails.push(mail);
      return { messageId: 'msg-1' };
    });

    const passwordHash = await bcrypt.hash('oldpass123', 6);
    const activeUser = {
      id: ID_USER,
      email: 'gv.test@ntu.edu.vn',
      ho_ten: '<script>alert("xss")</script> Đức',
      mat_khau_ma_hoa: passwordHash,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      async save() {
        return this;
      },
    };

    stub(models.NguoiDung, 'findOne', async ({ where }) =>
      where.email === 'gv.test@ntu.edu.vn' ? activeUser : null
    );
    stub(models.NguoiDung, 'scope', () => ({
      findOne: async ({ where }) => (where.email === 'gv.test@ntu.edu.vn' ? activeUser : null),
    }));

    const otpStore = [];
    stub(models.XacThucOtp, 'update', async () => [1]);
    stub(models.XacThucOtp, 'create', async (data) => {
      const row = {
        ...data,
        async save() {
          return this;
        },
      };
      otpStore.push(row);
      return row;
    });
    stub(models.XacThucOtp, 'findOne', async ({ where }) => {
      return otpStore.find((o) => o.nguoi_dung_id === where.nguoi_dung_id && o.da_su_dung === false) || null;
    });
    stub(models.MaLamMoi, 'destroy', async () => 1);

    // Email không tồn tại: lần 1 -> 200, lần 2 trong 60s -> 429 (giống hệt email thật)
    const missing1 = await authService.forgotPassword({ email: 'khongtontai@ntu.edu.vn' });
    assert.equal(missing1.success, true);
    await assert.rejects(
      () => authService.forgotPassword({ email: 'khongtontai@ntu.edu.vn' }),
      (err) => err.statusCode === 429
    );

    // Email thật: gửi mail có escape HTML XSS
    const real1 = await authService.forgotPassword({ email: 'gv.test@ntu.edu.vn' });
    assert.equal(real1.success, true);
    assert.equal(sentEmails.length, 1);
    assert.doesNotMatch(sentEmails[0].html, /<script>alert/);
    assert.match(sentEmails[0].html, /&lt;script&gt;alert/);

    // Reset với email không tồn tại hay OTP sai đều trả cùng một thông báo đồng nhất
    let errUnknownMsg = '';
    try {
      await authService.resetPassword({
        email: 'nobody@ntu.edu.vn',
        otp: '000000',
        newPassword: 'newpassword123',
      });
    } catch (e) {
      errUnknownMsg = e.message;
    }

    // Nhập sai 5 lần liên tiếp -> khóa ngay da_su_dung = true ở lần thứ 5
    for (let i = 1; i <= 5; i++) {
      try {
        await authService.resetPassword({
          email: 'gv.test@ntu.edu.vn',
          otp: '000000',
          newPassword: 'newpassword123',
        });
        assert.fail('Phải ném lỗi khi OTP sai');
      } catch (e) {
        assert.equal(e.statusCode, 400);
        assert.equal(e.message, errUnknownMsg);
      }
    }
    assert.equal(otpStore[0].so_lan_thu, 5);
    assert.equal(otpStore[0].da_su_dung, true);
  });
});

describe('Luồng 1 - Socket.IO Handshake & RBAC theo múi giờ Việt Nam', () => {
  it('Socket.IO chặn Access Token đã logout, đã đổi mật khẩu, tokenVersion cũ hoặc tài khoản đã bị khóa', async () => {
    const httpServer = http.createServer();
    const io = initSocketServer(httpServer);
    const middleware = io._nsps.get('/')._fns[0];

    const runHandshake = (token) =>
      new Promise((resolve) => {
        const fakeSocket = {
          handshake: { auth: { token }, headers: {} },
        };
        middleware(fakeSocket, (err) => resolve({ err, socket: fakeSocket }));
      });

    const userRow = {
      id: ID_USER,
      email: 'ducvt.gv@ntu.edu.vn',
      ho_ten: 'ThS. Vũ Tiến Đức',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_DEPT,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 2,
      doi_mat_khau_luc: null,
      danh_sach_vai_tro: [],
    };
    stub(models.NguoiDung, 'findByPk', async () => userRow);

    // 1. Token có tokenVersion cũ (1 < 2) -> bị từ chối
    const staleVerToken = authService.generateAccessToken({ ...userRow, phien_ban_token: 1 });
    const resStale = await runHandshake(staleVerToken);
    assert.ok(resStale.err);
    assert.match(resStale.err.message, /thu hồi/i);

    // 2. Token hợp lệ bị thu hồi qua logout (revoke) -> bị từ chối ngay cả khi tokenVersion khớp
    const validToken = authService.generateAccessToken(userRow);
    await authService.logout({ accessTokenString: validToken, userId: ID_USER });
    const resRevoked = await runHandshake(validToken);
    assert.ok(resRevoked.err);
    assert.match(resRevoked.err.message, /vô hiệu hóa/i);

    // 3. Tài khoản bị khóa kich_hoat = false -> bị từ chối
    userRow.kich_hoat = false;
    const freshToken = authService.generateAccessToken(userRow);
    const resLocked = await runHandshake(freshToken);
    assert.ok(resLocked.err);
    assert.match(resLocked.err.message, /vô hiệu hóa|nghỉ việc/i);

    // 4. Tài khoản hoạt động + token mới -> kết nối thành công với vai trò mới nhất từ CSDL
    userRow.kich_hoat = true;
    userRow.vai_tro_chinh = 'truong_khoa';
    const okRes = await runHandshake(freshToken);
    assert.equal(okRes.err, undefined);
    assert.equal(okRes.socket.user.vai_tro_chinh, 'truong_khoa');
  });

  it('VaiTroNguoiDung.conHieuLuc sử dụng đúng múi giờ Asia/Ho_Chi_Minh và getUserPermissions đồng nhất RBAC', () => {
    // 2026-11-20T18:00:00Z = 2026-11-21 01:00:00 giờ Việt Nam (lệch ngày so với UTC!)
    const vnMorningUtcPreviousDay = new Date('2026-11-20T18:00:00.000Z');
    const roleEntry = models.VaiTroNguoiDung.build({
      nguoi_dung_id: ID_USER,
      ma_vai_tro: 'truong_khoa',
      pham_vi: 'khoa',
      don_vi_id: ID_DEPT,
      tu_ngay: '2026-11-21',
      den_ngay: '2026-11-21',
    });
    assert.equal(roleEntry.conHieuLuc(vnMorningUtcPreviousDay), true);

    const user = {
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: true, tu_ngay: '2020-01-01', den_ngay: '2099-12-31' }],
    };
    const roles = getActiveRoles(user);
    const perms = getUserPermissions(user);
    assert.equal(roles.has('giang_vien'), true);
    assert.equal(roles.has('pho_khoa'), true);
    assert.equal(perms.has(PERMISSIONS.DON_TU_DUYET_CAP_1), true);
  });
});
