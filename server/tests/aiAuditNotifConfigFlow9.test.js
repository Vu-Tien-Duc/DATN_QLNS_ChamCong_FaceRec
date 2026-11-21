// Kiểm thử trọng tâm Luồng 9: Trợ lý AI & RAG, Nhật ký kiểm toán SHA-256, Thông báo đa vai trò và Cấu hình hệ thống.
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';
process.env.TERMINAL_KEY = process.env.TERMINAL_KEY || 'unit-test-terminal-key';

const { sequelize } = require('../config/db');
const models = require('../models');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const nhaCungCapAi = require('../services/ai/nhaCungCapAi.service');
const { getLecturerContextData } = require('../services/ai/nguCanhAi.service');
const { searchRelevantChunks } = require('../services/ai/khoTriThucRag.service');
const systemConfigService = require('../services/heThong/cauHinhHeThong.service');
const { getAuditLogs } = require('../services/heThong/nhatKyKiemToan.service');
const { getNotifications } = require('../services/heThong/thongBao.service');
const { CAU_HINH_MAC_DINH } = require('../models/cauHinhHeThong.model');
const { GENESIS_HASH, computeLogHash, computeLogHashLegacyV1 } = models.NhatKyKiemToan;

const USER_GV = '11111111-1111-4111-8111-111111111111';
const USER_DEAN = '22222222-2222-4222-8222-222222222222';
const USER_ADMIN = '33333333-3333-4333-8333-333333333333';
const DEPT_1 = '88888888-8888-4888-8888-888888888888';

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

const signUser = (role, id = USER_GV, extra = {}) =>
  jwt.sign({ id, vai_tro_chinh: role, phien_ban_token: 1, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' });

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.cookies = req.cookies || {};
    if (req.headers.cookie) {
      for (const pair of String(req.headers.cookie).split(';')) {
        const [k, ...rest] = pair.trim().split('=');
        if (k) req.cookies[k] = decodeURIComponent(rest.join('='));
      }
    }
    next();
  });
  app.use('/api/tro-ly-ai', require('../routes/troLyAi.routes'));
  app.use('/api/nhat-ky-kiem-toan', require('../routes/nhatKyKiemToan.routes'));
  app.use('/api/he-thong/cau-hinh', require('../routes/cauHinhHeThong.routes'));
  app.use('/api/thong-bao', require('../routes/thongBao.routes'));
  app.use('/api/cham-cong', require('../routes/chamCong.routes'));
  app.use(errorHandler);
  return app;
};

const dispatchExpress = (app, { method = 'GET', url = '/', headers = {}, body = undefined } = {}) =>
  new Promise((resolve, reject) => {
    const rawBody = body === undefined ? Buffer.alloc(0) : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      reqHeaders[k.toLowerCase()] = v;
    }
    if (body !== undefined && !reqHeaders['content-type']) {
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
      let parsedBody = text;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        // non-json response
      }
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: parsedBody });
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });

const stubAuthUser = (role = 'giang_vien', id = USER_GV, extra = {}) => {
  stub(models.NguoiDung, 'findByPk', async (pk) => ({
    id: pk || id,
    ho_ten: 'Cán bộ kiểm thử',
    email: 'test@ntu.edu.vn',
    vai_tro_chinh: role,
    don_vi_chinh_id: DEPT_1,
    kich_hoat: true,
    trang_thai_lam_viec: 'dang_lam_viec',
    phien_ban_token: 1,
    danh_sach_vai_tro: [],
    ...extra,
  }));
};

describe('Luồng 9 - Trợ lý AI, RAG & Gateway', () => {
  it('Chặn URL Path Injection trên mo_hinh, giới hạn kích thước lich_su, failover đúng model & parse HTML an toàn', async () => {
    // 1. Validate tên model chống path traversal
    assert.throws(() => nhaCungCapAi.sanitizeModelName('../files?alt=media'), /không hợp lệ/);
    assert.throws(() => nhaCungCapAi.sanitizeModelName('gemini-2.5-flash/../../secret'), /không hợp lệ/);
    assert.equal(nhaCungCapAi.sanitizeModelName('gemini-2.5-flash'), 'gemini-2.5-flash');

    // 2. Danh sách model Gemini hợp lệ (không chứa gemini-3.5-flash-lite / gemini-3.8-flash)
    const chain = nhaCungCapAi.getGeminiChatModelChain();
    assert.equal(chain.includes('gemini-3.5-flash-lite'), false);
    assert.equal(chain.includes('gemini-3.8-flash'), false);
    assert.equal(chain.includes('gemini-2.5-flash'), true);

    // 3. Failover Gemini -> Groq không truyền chéo model gemini-2.5-flash sang Groq và xử lý HTML 502 không vỡ SyntaxError
    const origGem = process.env.GEMINI_API_KEY;
    const origGroq = process.env.GROQ_API_KEY;
    const origDeepSeek = process.env.DEEPSEEK_API_KEY;
    process.env.GEMINI_API_KEY = 'fake-gemini-key';
    process.env.GROQ_API_KEY = 'fake-groq-key';
    delete process.env.DEEPSEEK_API_KEY;
    restores.push(() => {
      if (origGem === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origGem;
      if (origGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = origGroq;
      if (origDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = origDeepSeek;
    });

    const calledModels = [];
    stub(global, 'fetch', async (url, init) => {
      const targetUrl = String(url);
      if (targetUrl.includes('generativelanguage.googleapis.com')) {
        return {
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          text: async () => '<html><body>502 Bad Gateway</body></html>',
        };
      }
      if (targetUrl.includes('api.groq.com')) {
        const parsed = JSON.parse(init.body);
        calledModels.push(parsed.model);
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              choices: [{ message: { content: 'Phản hồi từ Groq failover' } }],
              usage: { total_tokens: 42 },
            }),
        };
      }
      throw new Error(`Unexpected URL ${targetUrl}`);
    });

    const failoverRes = await nhaCungCapAi.generateAIResponse({
      prompt: 'Xin chào',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    assert.equal(failoverRes.provider, 'groq');
    assert.equal(failoverRes.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(calledModels, ['llama-3.3-70b-versatile']);

    // 4. Route POST /api/tro-ly-ai/tro-chuyen với key tiếng Việt, chặn path injection & ẩn fallbackErrors với user thường
    stub(models.CauHinhHeThong, 'findAll', async () => []);
    stub(models.CauHinhHeThong, 'findOne', async () => null);
    stub(models.CauHinhHeThong, 'create', async (d) => ({ ...d, id: 'cfg-1', cap_nhat_luc: new Date() }));
    stub(models.HoSoCanBo, 'findAll', async () => []);
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);
    stubAuthUser('giang_vien', USER_GV);

    const app = createTestApp();
    const gvToken = signUser('giang_vien', USER_GV);

    // Payload injection bị chặn 400
    const badModelRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/tro-ly-ai/tro-chuyen',
      headers: { Authorization: `Bearer ${gvToken}` },
      body: { tin_nhan: 'Xin chào', nha_cung_cap: 'gemini', mo_hinh: '../files?x=1' },
    });
    assert.equal(badModelRes.status, 400);

    // Oversized history bị cắt gọn & chat text-only JSON trả 200 (trước đây trả 400)
    const hugeHistory = Array.from({ length: 15 }, (_, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: 'X'.repeat(5000),
    }));
    const chatRes = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/tro-ly-ai/tro-chuyen',
      headers: { Authorization: `Bearer ${gvToken}` },
      body: {
        tin_nhan: 'Hôm nay tôi có lịch dạy không?',
        che_do: 'hr_work',
        lich_su: hugeHistory,
        nha_cung_cap: 'groq',
        dung_rag: false,
      },
    });
    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.body.success, true);
    assert.equal('fallbackErrors' in chatRes.body.data, false);
  });

  it('nguCanhAi không dịch +7h kép, tôn trọng NgayNghiLe và trả cac_vai_tro; searchRelevantChunks không gọi authenticate', async () => {
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_GV,
      ho_ten: 'Nguyễn Văn A',
      ma_can_bo: 'GV001',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh: { id: DEPT_1, ten_phong_ban: 'Khoa CNTT' },
      ho_so: { han_muc_phep_nam: 12, hoc_vi: 'Thạc sĩ' },
      danh_sach_vai_tro: [{ ma_vai_tro: 'truong_bo_mon', don_vi_id: DEPT_1, duoc_uy_quyen: false }],
    }));
    stub(models.NgayNghiLe, 'findOne', async () => ({ id: 'hol-1', ten_ngay_le: 'Nghỉ lễ kiểm thử' }));
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: 'sch-1',
        nguoi_dung_id: USER_GV,
        ngay_bat_dau: '2026-01-01',
        ngay_ket_thuc: '2026-12-31',
        phong_hoc: 'A101',
        ca: { ten_ca: 'Ca 1', gio_bat_dau: '07:00', gio_ket_thuc: '09:30' },
        mon_hoc: { ten_mon: 'CTDL', ma_mon: 'IT101' },
        tuan_hoc: [],
        ngoai_le: [],
      },
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'findAll', async () => []);

    const ctx = await getLecturerContextData(USER_GV);
    assert.ok(ctx.user.cac_vai_tro.includes('truong_bo_mon'));
    assert.equal(ctx.holidayName, 'Nghỉ lễ kiểm thử');
    assert.equal(ctx.todaySchedules.length, 0);

    let authCalled = false;
    stub(sequelize, 'authenticate', async () => {
      authCalled = true;
    });
    stub(models.TaiLieuRag, 'findAll', async () => [{ id: 'doc-1', tieu_de: 'Quy chế', ten_tep_goc: 'qc.pdf' }]);
    stub(models.PhanDoanTaiLieu, 'findAll', async () => [
      { id: 'c-1', tai_lieu_id: 'doc-1', thu_tu: 0, noi_dung_chunk: 'Quy định đi muộn tối đa 15 phút.', vector_embedding: null },
    ]);

    const chunks = await searchRelevantChunks({ query: 'đi muộn', userId: USER_GV });
    assert.equal(authCalled, false);
    assert.equal(chunks.length, 1);
  });
});

describe('Luồng 9 - Nhật ký kiểm toán SHA-256', () => {
  it('Giữ khóa tuần tự xuyên suốt INSERT để không phân nhánh chuỗi Hash khi ghi đồng thời', async () => {
    const inserted = [];
    stub(models.NhatKyKiemToan, 'findOne', async () =>
      inserted.length > 0 ? inserted[inserted.length - 1] : null
    );
    stub(models.NhatKyKiemToan.prototype, '_saveStubCheck', undefined);
    // Giả lập Sequelize Model.prototype.save cho trường hợp insert chậm (10ms)
    const { Model } = require('sequelize');
    stub(Model.prototype, 'save', async function fakeInsert(options) {
      await models.NhatKyKiemToan.runHooks('beforeCreate', this, options || {});
      await new Promise((r) => setTimeout(r, 10));
      const row = { ...this.dataValues, id: this.dataValues.id || `log-${inserted.length + 1}` };
      inserted.push(row);
      return this;
    });

    await Promise.all([
      models.NhatKyKiemToan.create({ hanh_dong: 'ACTION_1', loai_doi_tuong: 'nguoi_dung', doi_tuong_id: '1' }),
      models.NhatKyKiemToan.create({ hanh_dong: 'ACTION_2', loai_doi_tuong: 'nguoi_dung', doi_tuong_id: '2' }),
      models.NhatKyKiemToan.create({ hanh_dong: 'ACTION_3', loai_doi_tuong: 'nguoi_dung', doi_tuong_id: '3' }),
    ]);

    assert.equal(inserted.length, 3);
    assert.equal(inserted[0].ma_bam_truoc, GENESIS_HASH);
    assert.equal(inserted[1].ma_bam_truoc, inserted[0].ma_bam_hien_tai);
    assert.equal(inserted[2].ma_bam_truoc, inserted[1].ma_bam_hien_tai);
  });

  it('xacMinhChuoi phát hiện sửa IP/lý do thất bại và đồng bộ contract isValid/hopLe qua controller', async () => {
    const t1 = new Date('2026-11-21T08:00:00.000Z');
    const t2 = new Date('2026-11-21T08:01:00.000Z');
    const log1 = {
      id: 'log-1',
      nguoi_thuc_hien_id: USER_ADMIN,
      loai_chu_the: 'user',
      hanh_dong: 'USER_LOGIN',
      loai_doi_tuong: 'nguoi_dung',
      doi_tuong_id: USER_ADMIN,
      ket_qua: 'success',
      dia_chi_ip: '10.0.0.1',
      ly_do_that_bai: null,
      chi_tiet: { browser: 'Chrome' },
      thoi_diem: t1,
      ma_bam_truoc: GENESIS_HASH,
    };
    log1.ma_bam_hien_tai = computeLogHash(log1, GENESIS_HASH);

    const log2 = {
      id: 'log-2',
      nguoi_thuc_hien_id: USER_ADMIN,
      loai_chu_the: 'user',
      hanh_dong: 'FAILED_LOGIN',
      loai_doi_tuong: 'nguoi_dung',
      doi_tuong_id: USER_ADMIN,
      ket_qua: 'failed',
      dia_chi_ip: '10.0.0.2',
      ly_do_that_bai: 'Sai mật khẩu',
      chi_tiet: null,
      thoi_diem: t2,
      ma_bam_truoc: log1.ma_bam_hien_tai,
    };
    log2.ma_bam_hien_tai = computeLogHash(log2, log1.ma_bam_hien_tai);

    let dbRows = [log2, log1]; // DESC order as findAll returns
    stub(models.NhatKyKiemToan, 'count', async () => dbRows.length);
    stub(models.NhatKyKiemToan, 'findAll', async () => dbRows);

    stubAuthUser('admin', USER_ADMIN);
    const app = createTestApp();
    const adminToken = signUser('admin', USER_ADMIN);

    const okRes = await dispatchExpress(app, {
      url: '/api/nhat-ky-kiem-toan/xac-minh-toan-ven',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.isValid, true);
    assert.equal(okRes.body.data.hopLe, true);
    assert.equal(okRes.body.data.totalChecked, 2);
    assert.match(okRes.body.message, /an toàn 100%/);

    // Hỗ trợ tương thích ngược bản ghi lịch sử băm theo công thức v1 cũ (trước khi bổ sung dia_chi_ip/ly_do_that_bai)
    const legacyV1Log = {
      id: 'log-legacy-1',
      nguoi_thuc_hien_id: USER_ADMIN,
      loai_chu_the: 'user',
      hanh_dong: 'LEGACY_ACTION',
      loai_doi_tuong: 'nguoi_dung',
      doi_tuong_id: USER_ADMIN,
      ket_qua: 'success',
      dia_chi_ip: '10.0.0.5',
      ly_do_that_bai: null,
      chi_tiet: { note: 'old row' },
      thoi_diem: t1,
      ma_bam_truoc: GENESIS_HASH,
    };
    legacyV1Log.ma_bam_hien_tai = computeLogHashLegacyV1(legacyV1Log, GENESIS_HASH);
    const chainedV2Log = {
      ...log2,
      ma_bam_truoc: legacyV1Log.ma_bam_hien_tai,
    };
    chainedV2Log.ma_bam_hien_tai = computeLogHash(chainedV2Log, legacyV1Log.ma_bam_hien_tai);

    dbRows = [chainedV2Log, legacyV1Log];
    const mixedRes = await dispatchExpress(app, {
      url: '/api/nhat-ky-kiem-toan/xac-minh-toan-ven',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(mixedRes.status, 200);
    assert.equal(mixedRes.body.data.isValid, true);
    assert.equal(mixedRes.body.data.totalChecked, 2);

    // Giả mạo dia_chi_ip trong DB ở bản ghi v2 -> vẫn bị phát hiện bất thường
    dbRows = [{ ...chainedV2Log, dia_chi_ip: '192.168.1.99' }, legacyV1Log];
    const tamperedRes = await dispatchExpress(app, {
      url: '/api/nhat-ky-kiem-toan/xac-minh-toan-ven',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(tamperedRes.status, 200);
    assert.equal(tamperedRes.body.data.isValid, false);
    assert.equal(tamperedRes.body.data.hopLe, false);
    assert.equal(tamperedRes.body.data.totalChecked, 2);
    assert.equal(tamperedRes.body.data.tamperedCount, 1);
    assert.equal(tamperedRes.body.data.tamperedLogs[0].id, 'log-2');

    // Kiểm tra service getAuditLogs parse ngày theo +07:00 & trả summary counts
    let capturedWhere = null;
    stub(models.NhatKyKiemToan, 'findAndCountAll', async (opts) => {
      capturedWhere = opts.where;
      return { count: 2, rows: [log2, log1] };
    });
    stub(models.NhatKyKiemToan, 'count', async (opts) => (opts?.where?.ket_qua === 'success' ? 1 : 1));
    const listRes = await getAuditLogs({ tu_ngay: '2026-11-21', den_ngay: '2026-11-21', tim_kiem: '10.0.0' });
    assert.equal(listRes.summary.successCount, 1);
    assert.equal(listRes.summary.failedCount, 1);
    const bounds = capturedWhere.thoi_diem[Object.getOwnPropertySymbols(capturedWhere.thoi_diem)[0]];
    assert.equal(bounds[0].toISOString(), '2026-11-20T17:00:00.000Z');
    assert.equal(bounds[1].toISOString(), '2026-11-21T16:59:59.999Z');
  });
});

describe('Luồng 9 - Cấu hình hệ thống & Geofence', () => {
  it('Che dấu API Key qua API/AuditLog, chặn ghi đè chuỗi mask, validate 19 khóa chuẩn và bọc Transaction', async () => {
    const fakeStore = new Map([
      [
        'GEMINI_API_KEY',
        {
          id: 'cfg-gem',
          khoa_cau_hinh: 'GEMINI_API_KEY',
          gia_tri: 'AIzaSySecretKey9999',
          nhom: 'AI',
          mo_ta: 'Gemini Key',
          cap_nhat_luc: new Date(),
          toJSON() {
            return { ...this };
          },
          async save() {
            fakeStore.set(this.khoa_cau_hinh, this);
          },
        },
      ],
      [
        'LUONG_CO_SO',
        {
          id: 'cfg-sal',
          khoa_cau_hinh: 'LUONG_CO_SO',
          gia_tri: 2530000,
          nhom: 'TIEN_LUONG',
          mo_ta: 'Lương cơ sở',
          cap_nhat_luc: new Date(),
          toJSON() {
            return { ...this };
          },
          async save() {
            fakeStore.set(this.khoa_cau_hinh, this);
          },
        },
      ],
    ]);

    stub(models.CauHinhHeThong, 'findAll', async () => Array.from(fakeStore.values()));
    stub(models.CauHinhHeThong, 'findOne', async ({ where }) => fakeStore.get(where.khoa_cau_hinh) || null);
    stub(models.CauHinhHeThong, 'create', async (data) => {
      const row = {
        id: `cfg-${data.khoa_cau_hinh}`,
        ...data,
        cap_nhat_luc: new Date(),
        toJSON() {
          return { ...this };
        },
        async save() {
          fakeStore.set(this.khoa_cau_hinh, this);
        },
      };
      fakeStore.set(data.khoa_cau_hinh, row);
      return row;
    });

    const auditCreated = [];
    stub(models.NhatKyKiemToan, 'create', async (payload) => {
      auditCreated.push(payload);
      return payload;
    });

    stub(sequelize, 'transaction', async (cb) => {
      // Snapshot fakeStore để kiểm tra rollback thực tế
      const snapshot = new Map(
        Array.from(fakeStore.entries()).map(([k, v]) => [k, { ...v }])
      );
      try {
        return await cb({ LOCK: { UPDATE: 'UPDATE' } });
      } catch (err) {
        fakeStore.clear();
        for (const [k, v] of snapshot.entries()) fakeStore.set(k, v);
        throw err;
      }
    });

    // 1. getAllConfigs không trả plaintext GEMINI_API_KEY
    const allConfigs = await systemConfigService.getAllConfigs();
    const gemItem = allConfigs.find((c) => c.khoa_cau_hinh === 'GEMINI_API_KEY');
    assert.ok(gemItem);
    assert.equal(gemItem.gia_tri.includes('SecretKey'), false);
    assert.match(gemItem.gia_tri, /\*{4}/);

    // 2. Chặn lưu giá trị mask đè lên key thật
    await assert.rejects(
      () => systemConfigService.updateConfig('GEMINI_API_KEY', 'AIza****9999', { id: USER_ADMIN }),
      /che dấu/
    );

    // 3. Validate các khóa chuẩn tiếng Việt & rollback Transaction nếu mục #2 lỗi
    await assert.rejects(
      () =>
        systemConfigService.bulkUpdateConfigs(
          [
            { khoa_cau_hinh: 'LUONG_CO_SO', gia_tri: 3000000 },
            { khoa_cau_hinh: 'NGUONG_AI', gia_tri: { mo_hinh: 'buffalo_s', so_chieu: 512, cosine_min: 1.8, liveness_min: 0.8 } },
          ],
          { id: USER_ADMIN }
        ),
      /khoảng/
    );
    // Kiểm tra cả DB lẫn cache RAM đều KHÔNG bị ghi đè 3000000
    assert.equal(fakeStore.get('LUONG_CO_SO').gia_tri, 2530000);
    assert.equal(systemConfigService.getConfigSync('LUONG_CO_SO'), 2530000);

    // 4. Chặn khóa rác tùy ý
    await assert.rejects(
      () => systemConfigService.bulkUpdateConfigs([{ khoa_cau_hinh: 'GARBAGE_KEY_999', gia_tri: 'x' }], { id: USER_ADMIN }),
      /không hợp lệ|không nằm trong danh mục/
    );

    // 5. Cập nhật GEMINI_API_KEY ghi Audit Log đã che dấu
    await systemConfigService.updateConfig('GEMINI_API_KEY', 'AIzaSyNewRealKey5678', { id: USER_ADMIN });
    const latestAudit = auditCreated[auditCreated.length - 1];
    assert.equal(latestAudit.chi_tiet.gia_tri_cu.includes('SecretKey'), false);
    assert.equal(latestAudit.chi_tiet.gia_tri_moi.includes('NewRealKey'), false);

    // 6. GET /api/cham-cong/cau-hinh-khuon-vien chấp nhận Bearer JWT của Admin và trả về schema tiếng Việt chuẩn
    stubAuthUser('admin', USER_ADMIN);
    const app = createTestApp();
    const adminToken = signUser('admin', USER_ADMIN);
    const gpsRes = await dispatchExpress(app, {
      url: '/api/cham-cong/cau-hinh-khuon-vien',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gpsRes.status, 200);
    assert.equal('vi_do' in gpsRes.body.data, true);
    assert.equal('kinh_do' in gpsRes.body.data, true);
    assert.equal('ban_kinh_met' in gpsRes.body.data, true);
  });
});

describe('Luồng 9 - Thông báo đa vai trò & thẩm quyền duyệt', () => {
  it('Phân tách đúng đơn cá nhân cho mọi vai trò, cấp duyệt 1 (kèm duoc_uy_quyen) vs cấp 2 (BGH) và đếm đúng tổng count', async () => {
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);

    // Mock đơn cá nhân của user đang đăng nhập luôn trả 1 đơn đã duyệt
    stub(models.DonNghiPhep, 'findAll', async () => [
      {
        id: 'my-leave-1',
        nguoi_dung_id: USER_DEAN,
        ngay_bat_dau: '2026-11-25',
        ngay_ket_thuc: '2026-11-25',
        trang_thai: 'approved',
        tao_luc: new Date('2026-11-20T02:00:00Z'),
        cap_nhat_luc: new Date('2026-11-21T02:00:00Z'),
      },
    ]);

    let capturedPendingWhere = null;
    stub(models.DonNghiPhep, 'findAndCountAll', async (opts) => {
      capturedPendingWhere = opts.where;
      return {
        count: 12,
        rows: [
          { id: 'p-1', tao_luc: new Date(), nguoi_dung: { ho_ten: 'GV A' } },
          { id: 'p-2', tao_luc: new Date(), nguoi_dung: { ho_ten: 'GV B' } },
          { id: 'p-3', tao_luc: new Date(), nguoi_dung: { ho_ten: 'GV C' } },
        ],
      };
    });

    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAll', async () => [{ id: USER_GV }]);

    // Case A: Giảng viên kiêm nhiệm Trưởng khoa -> nhận cả đơn cá nhân VÀ hộp duyệt cấp 1 (chỉ pending/pending_dean) với tổng count = 12
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_DEAN,
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [{ ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_1, duoc_uy_quyen: false }],
    }));
    const deanNotifs = await getNotifications({ nguoi_dung_id: USER_DEAN });
    assert.ok(deanNotifs.danh_sach_thong_bao.some((n) => n.id === 'leave-my-leave-1'));
    const inboxDean = deanNotifs.danh_sach_thong_bao.find((n) => n.id === 'leave-pending-summary');
    assert.ok(inboxDean);
    assert.match(inboxDean.tieu_de, /12 đơn cần xử lý/);
    assert.deepEqual(
      capturedPendingWhere.trang_thai[Object.getOwnPropertySymbols(capturedPendingWhere.trang_thai)[0]],
      ['pending', 'pending_dean']
    );
    // Khi không truyền thoi_diem_doc_gan_nhat, so_chua_doc phải bằng tổng danh sách thay vì luôn = 1
    assert.equal(deanNotifs.so_chua_doc, 2);

    // Case B: Phó khoa KHÔNG có duoc_uy_quyen -> không nhận hộp duyệt đơn
    capturedPendingWhere = null;
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_DEAN,
      vai_tro_chinh: 'pho_khoa',
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [],
    }));
    const deputyNoAuthNotifs = await getNotifications({ nguoi_dung_id: USER_DEAN });
    assert.equal(capturedPendingWhere, null);
    assert.equal(deputyNoAuthNotifs.danh_sach_thong_bao.some((n) => n.id === 'leave-pending-summary'), false);

    // Case C: Kế toán & TCCB -> nhận đơn cá nhân của mình, KHÔNG nhận hộp duyệt đơn chờ
    for (const role of ['ke_toan', 'tccb']) {
      capturedPendingWhere = null;
      stub(models.NguoiDung, 'findByPk', async () => ({
        id: USER_DEAN,
        vai_tro_chinh: role,
        don_vi_chinh_id: DEPT_1,
        danh_sach_vai_tro: [],
      }));
      const res = await getNotifications({ nguoi_dung_id: USER_DEAN });
      assert.equal(capturedPendingWhere, null, `Vai trò ${role} không được nhận hộp duyệt đơn`);
      assert.ok(res.danh_sach_thong_bao.some((n) => n.id === 'leave-my-leave-1'));
    }

    // Case D: BGH -> chỉ nhận đơn pending_bgh
    capturedPendingWhere = null;
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_DEAN,
      vai_tro_chinh: 'bgh',
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [],
    }));
    await getNotifications({ nguoi_dung_id: USER_DEAN });
    assert.equal(capturedPendingWhere.trang_thai, 'pending_bgh');
  });

  it('Nhánh doi_ca có giảng viên dạy thay chỉ hiển thị lịch cho người dạy thay, không báo nhầm cho giảng viên gốc', async () => {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const handedOffException = {
      id: 'ex-sub-1',
      trang_thai: 'doi_ca',
      ngay: todayStr,
      ngay_day_bu: todayStr,
      giang_vien_day_thay_id: USER_DEAN,
      ca_thay_the: { id: 'ca-2', ten_ca: 'Ca thay thế', gio_bat_dau: '13:00', gio_ket_thuc: '15:30' },
      lich_trinh: {
        id: 'sch-sub-1',
        nguoi_dung_id: USER_GV,
        ngay_bat_dau: '2026-01-01',
        ngay_ket_thuc: '2026-12-31',
        phong_hoc: 'B202',
        ca: { id: 'ca-1', ten_ca: 'Ca 1', gio_bat_dau: '07:00', gio_ket_thuc: '09:30' },
        mon_hoc: { ten_mon: 'Mạng máy tính', ma_mon: 'IT202' },
        tuan_hoc: [],
        ngoai_le: [
          {
            id: 'ex-sub-1',
            trang_thai: 'doi_ca',
            ngay: todayStr,
            ngay_day_bu: todayStr,
            giang_vien_day_thay_id: USER_DEAN,
          },
        ],
      },
    };

    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => [handedOffException]);

    // 1. Giảng viên gốc (USER_GV) đã bàn giao cho USER_DEAN -> không có lịch hôm nay
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      ho_ten: id === USER_GV ? 'GV Gốc' : 'GV Dạy Thay',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh: { id: DEPT_1, ten_phong_ban: 'Khoa CNTT' },
      ho_so: { han_muc_phep_nam: 12 },
      danh_sach_vai_tro: [],
    }));
    stub(models.LichTrinh, 'findAll', async ({ where }) =>
      where.nguoi_dung_id === USER_GV ? [handedOffException.lich_trinh] : []
    );

    const ownerCtx = await getLecturerContextData(USER_GV);
    assert.equal(ownerCtx.todaySchedules.length, 0);
    const ownerNotifs = await getNotifications({ nguoi_dung_id: USER_GV });
    assert.equal(ownerNotifs.danh_sach_thong_bao.some((n) => n.id === 'schedule-today'), false);

    // 2. Giảng viên dạy thay (USER_DEAN) -> nhận đúng 1 buổi dạy thay hôm nay ở cả AI & Thông báo
    const subCtx = await getLecturerContextData(USER_DEAN);
    assert.equal(subCtx.todaySchedules.length, 1);
    assert.equal(subCtx.todaySchedules[0].ca, 'Ca thay thế');
    const subNotifs = await getNotifications({ nguoi_dung_id: USER_DEAN });
    const subSchedNotif = subNotifs.danh_sach_thong_bao.find((n) => n.id === 'schedule-today');
    assert.ok(subSchedNotif);
    assert.match(subSchedNotif.tieu_de, /1 ca/);
  });
});
