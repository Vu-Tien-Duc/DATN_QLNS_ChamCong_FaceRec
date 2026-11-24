// Kiểm thử trọng tâm Luồng 2 (Quản lý Nhân sự, Hồ sơ Cán bộ, Cơ cấu Phòng ban & Danh bạ Giảng viên Công khai).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'unit-test-refresh-secret-key';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

const { sequelize } = require('../config/db');
const models = require('../models');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const nguoiDungRoutes = require('../routes/nguoiDung.routes');
const phongBanRoutes = require('../routes/phongBan.routes');
const publicFacultyRoutes = require('../routes/public_giangvien/giangVien.routes');
const nguoiDungService = require('../services/nhanSu/nguoiDung.service');
const phongBanService = require('../services/nhanSu/phongBan.service');
const giangVienCongKhaiService = require('../services/nhanSu/giangVienCongKhai.service');
const authService = require('../services/heThong/xacThuc.service');
const aiConnector = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const hoTroChamCong = require('../utils/hoTroChamCong');

const ID_ADMIN = '11111111-1111-4111-8111-111111111111';
const ID_TCCB = '22222222-2222-4222-8222-222222222222';
const ID_TBM = '33333333-3333-4333-8333-333333333333';
const ID_GV = '44444444-4444-4444-8444-444444444444';
const ID_TARGET = '55555555-5555-4555-8555-555555555555';
const ID_KHOA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_BOMON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID_PHONG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

const signToken = (userId, extra = {}) =>
  jwt.sign(
    { id: userId, phien_ban_token: 1, tokenVersion: 1, ...extra },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/nguoi-dung', nguoiDungRoutes);
  app.use('/api/phong-ban', phongBanRoutes);
  app.use('/api/cong-khai/giang-vien', publicFacultyRoutes);
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

  return new Promise((resolve, reject) => {
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
      const raw = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      resolve({ status: res.statusCode, body: json, text: raw });
    };
    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
};

const stubTx = () => {
  stub(sequelize, 'transaction', async (arg1, arg2) => {
    const fn = typeof arg1 === 'function' ? arg1 : arg2;
    return fn({ LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} });
  });
};

const stubAuthUser = (actor) => {
  stub(models.NguoiDung, 'findByPk', async (id) => {
    if (String(id) === String(actor.id)) return actor;
    return null;
  });
};

describe('Luồng 2 - Cơ cấu Phòng ban & Cây tổ chức', () => {
  it('GET /api/phong-ban/cay trả về cây dùng danh_sach_con và giữ nguyên FK UUID', async () => {
    const actor = { id: ID_GV, vai_tro_chinh: 'giang_vien', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);
    stub(models.NguoiDung, 'findAll', async () => [{ don_vi_chinh_id: ID_BOMON, cnt: 5 }]);
    stub(models.MonHoc, 'findAll', async () => [{ phong_ban_id: ID_BOMON, cnt: 3 }]);
    stub(models.PhongBan, 'findAll', async () => [
      {
        id: ID_KHOA,
        ten_phong_ban: 'Khoa CNTT',
        loai_don_vi: 'khoa',
        don_vi_cha_id: null,
        truong_don_vi_id: ID_TBM,
        don_vi_cha: null,
        truong_don_vi: { id: ID_TBM, ho_ten: 'TS. Nguyễn Văn A', email: 'a@ntu.edu.vn', vai_tro_chinh: 'truong_khoa' },
        vi_do: 20.9752,
        kinh_do: 105.7628,
        ban_kinh_met: 200,
      },
      {
        id: ID_BOMON,
        ten_phong_ban: 'Bộ môn KTPM',
        loai_don_vi: 'bo_mon',
        don_vi_cha_id: ID_KHOA,
        truong_don_vi_id: null,
        don_vi_cha: { id: ID_KHOA, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa' },
        truong_don_vi: null,
        vi_do: 20.9752,
        kinh_do: 105.7628,
        ban_kinh_met: 200,
      },
    ]);

    const res = await dispatchExpress(createTestApp(), {
      method: 'GET',
      url: '/api/phong-ban/cay',
      headers: { authorization: `Bearer ${signToken(ID_GV)}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.data.length, 1);
    const root = res.body.data[0];
    assert.equal(root.id, ID_KHOA);
    assert.equal(root.truong_don_vi_id, ID_TBM);
    assert.equal(root.truong_don_vi.ho_ten, 'TS. Nguyễn Văn A');
    assert.equal(root.children, undefined);
    assert.equal(Array.isArray(root.danh_sach_con), true);
    assert.equal(root.danh_sach_con.length, 1);
    assert.equal(root.danh_sach_con[0].don_vi_cha_id, ID_KHOA);
    assert.equal(root.danh_sach_con[0].don_vi_cha.ten_phong_ban, 'Khoa CNTT');
    assert.equal(root.danh_sach_con[0].so_luong_thanh_vien, 5);
  });

  it('GET /api/phong-ban?trang=1&gioi_han=2 trả về đúng departments + pagination (không bị data: null)', async () => {
    const actor = { id: ID_GV, vai_tro_chinh: 'giang_vien', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);
    stub(models.NguoiDung, 'findAll', async () => []);
    stub(models.MonHoc, 'findAll', async () => []);
    stub(models.PhongBan, 'findAndCountAll', async () => ({
      count: 3,
      rows: [
        { id: ID_KHOA, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa', don_vi_cha_id: null, truong_don_vi_id: null },
        { id: ID_PHONG, ten_phong_ban: 'Phòng TCCB', loai_don_vi: 'phong_ban', don_vi_cha_id: null, truong_don_vi_id: null },
      ],
    }));

    const res = await dispatchExpress(createTestApp(), {
      method: 'GET',
      url: '/api/phong-ban?trang=1&gioi_han=2',
      headers: { authorization: `Bearer ${signToken(ID_GV)}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.departments.length, 2);
    assert.deepEqual(res.body.data.pagination, {
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
  });

  it('Từ chối tọa độ GPS ngoài biên / bán kính <= 0 và từ chối bổ nhiệm admin kiêm nhiệm làm trưởng đơn vị', async () => {
    const actor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);

    const badGps = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/phong-ban',
      headers: { authorization: `Bearer ${signToken(ID_ADMIN)}` },
      body: { ten_phong_ban: 'Phòng Mới', loai_don_vi: 'phong_ban', vi_do: 95, kinh_do: 105 },
    });
    assert.equal(badGps.status, 400);

    const badRadius = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/phong-ban',
      headers: { authorization: `Bearer ${signToken(ID_ADMIN)}` },
      body: { ten_phong_ban: 'Phòng Mới', loai_don_vi: 'phong_ban', ban_kinh_met: 0 },
    });
    assert.equal(badRadius.status, 400);

    stubTx();
    stub(models.PhongBan, 'findOne', async () => null);
    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === ID_ADMIN) return actor;
      if (id === ID_TARGET) {
        return {
          id: ID_TARGET,
          ho_ten: 'Kiêm Admin',
          kich_hoat: true,
          trang_thai_lam_viec: 'dang_lam_viec',
          vai_tro_chinh: 'giang_vien',
          danh_sach_vai_tro: [{ ma_vai_tro: 'admin' }],
        };
      }
      return null;
    });

    const errAdminMgr = await phongBanService.validateManagerEligibility(ID_TARGET, 'phong_ban');
    assert.match(errAdminMgr, /Quản trị viên/);
  });

  it('createDepartment đồng bộ vai trò truong_bo_mon cho trưởng đơn vị Bộ môn', async () => {
    stubTx();
    const createdRoles = [];
    let updatedUserFields = null;

    stub(models.PhongBan, 'findByPk', async (id) =>
      id === ID_KHOA ? { id: ID_KHOA, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa CNTT' } : null
    );
    stub(models.PhongBan, 'findOne', async () => null);
    stub(models.NguoiDung, 'findByPk', async (id) =>
      id === ID_TBM
        ? {
            id: ID_TBM,
            ho_ten: 'TS. Trưởng BM',
            kich_hoat: true,
            trang_thai_lam_viec: 'dang_lam_viec',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_KHOA,
            danh_sach_vai_tro: [],
            update: async (u) => {
              updatedUserFields = u;
            },
          }
        : null
    );
    stub(models.PhongBan, 'create', async (payload) => ({
      id: ID_BOMON,
      ...payload,
    }));
    stub(models.VaiTroNguoiDung, 'destroy', async () => 1);
    stub(models.VaiTroNguoiDung, 'findOne', async () => null);
    stub(models.VaiTroNguoiDung, 'create', async (r) => {
      createdRoles.push(r);
      return r;
    });
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NguoiDung, 'findAll', async () => []);
    stub(models.MonHoc, 'findAll', async () => []);
    // getDepartmentById after create
    let pbCall = 0;
    stub(models.PhongBan, 'findByPk', async () => {
      pbCall += 1;
      if (pbCall === 1) return { id: ID_KHOA, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa CNTT' };
      return { id: ID_BOMON, ten_phong_ban: 'Bộ môn AI', loai_don_vi: 'bo_mon', don_vi_cha_id: ID_KHOA, truong_don_vi_id: ID_TBM };
    });

    await phongBanService.createDepartment({
      ten_phong_ban: 'Bộ môn AI',
      loai_don_vi: 'bo_mon',
      don_vi_cha_id: ID_KHOA,
      truong_don_vi_id: ID_TBM,
      actorId: ID_ADMIN,
    });

    assert.equal(updatedUserFields.vai_tro_chinh, 'truong_bo_mon');
    assert.equal(updatedUserFields.don_vi_chinh_id, ID_BOMON);
    assert.equal(createdRoles.length, 1);
    assert.equal(createdRoles[0].ma_vai_tro, 'truong_bo_mon');
    assert.equal(createdRoles[0].pham_vi, 'bo_mon');
    assert.match(String(createdRoles[0].tu_ngay), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('Cách 2 bổ nhiệm Trưởng đơn vị: chặn bốc người đơn vị khác, chặn khác khối, chặn tạo mới Khoa gán sẵn TĐV và chặn kiêm nhiệm', async () => {
    const ID_KHOA_KHAC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    stubTx();
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.PhongBan, 'findOne', async () => null);

    // 1. Giảng viên Khoa CNTT không thể được bổ nhiệm làm Trưởng Khoa khác
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: ID_GV,
      ho_ten: 'GV Khoa CNTT',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      danh_sach_vai_tro: [],
    }));
    const errOtherDept = await phongBanService.validateManagerEligibility(ID_GV, 'khoa', ID_KHOA_KHAC);
    assert.match(errOtherDept, /đơn vị khác/);

    // 2. Giảng viên Khoa CNTT không thể được bổ nhiệm làm Trưởng Phòng ban (khác khối)
    const errCrossBlock = await phongBanService.validateManagerEligibility(ID_GV, 'phong_ban', ID_PHONG);
    assert.match(errCrossBlock, /khối phòng ban/);

    // 3. Tạo mới Khoa (currentDeptId = null) không được gán sẵn Trưởng khoa
    const errCreateKhoa = await phongBanService.validateManagerEligibility(ID_GV, 'khoa', null);
    assert.match(errCreateKhoa, /chưa có nhân sự trực thuộc/);

    // 4. Nhân sự nội bộ Khoa CNTT nhưng đang làm Trưởng Bộ môn khác -> chặn kiêm nhiệm
    stub(models.PhongBan, 'findOne', async () => ({
      id: ID_BOMON,
      ten_phong_ban: 'Bộ môn KTPM',
      loai_don_vi: 'bo_mon',
    }));
    const errDualLeader = await phongBanService.validateManagerEligibility(ID_GV, 'khoa', ID_KHOA);
    assert.match(errDualLeader, /Bộ môn KTPM/);

    // 5. Nhân sự nội bộ Khoa CNTT, đúng khối, chưa làm trưởng đơn vị khác -> hợp lệ (null)
    stub(models.PhongBan, 'findOne', async () => null);
    const okErr = await phongBanService.validateManagerEligibility(ID_GV, 'khoa', ID_KHOA);
    assert.equal(okErr, null);
  });

  it('updateDepartment chặn đổi chéo khối khi còn nhân sự hoặc môn học; validate cặp GPS sau merge & bán kính [10, 5000] và trả tong_so_thanh_vien', async () => {
    stubTx();
    let updatedPayload = null;
    const makeKhoaDoc = (overrides = {}) => ({
      id: ID_KHOA,
      ten_phong_ban: 'Khoa CNTT',
      loai_don_vi: 'khoa',
      don_vi_cha_id: null,
      truong_don_vi_id: null,
      vi_do: 20.965483,
      kinh_do: 105.729905,
      ban_kinh_met: 200,
      update: async (u) => {
        updatedPayload = u;
      },
      ...overrides,
    });

    stub(models.PhongBan, 'findByPk', async () => makeKhoaDoc());
    stub(models.PhongBan, 'count', async () => 0);
    stub(models.PhongBan, 'findOne', async () => null);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    // 1. Chặn đổi khoa -> phong_ban khi còn nhân sự (kể cả đã nghỉ việc)
    stub(models.NguoiDung, 'count', async () => 2);
    stub(models.MonHoc, 'count', async () => 0);
    await assert.rejects(
      () => phongBanService.updateDepartment({ id: ID_KHOA, body: { loai_don_vi: 'phong_ban' }, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && err.errorCode === 'DEPARTMENT_HAS_MEMBERS'
    );

    // 2. Chặn đổi khoa -> phong_ban khi 0 nhân sự nhưng còn môn học
    stub(models.NguoiDung, 'count', async () => 0);
    stub(models.MonHoc, 'count', async () => 3);
    await assert.rejects(
      () => phongBanService.updateDepartment({ id: ID_KHOA, body: { loai_don_vi: 'phong_ban' }, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && err.errorCode === 'DEPARTMENT_HAS_SUBJECTS'
    );

    // 2b. Chuyển Bộ môn sang Khoa cha mới phải kiểm tra lại Trưởng đơn vị hiện tại
    const ID_KHOA_MOI = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    stub(models.PhongBan, 'findByPk', async (id) => {
      if (id === ID_BOMON) {
        return makeKhoaDoc({
          id: ID_BOMON,
          ten_phong_ban: 'Bộ môn AI',
          loai_don_vi: 'bo_mon',
          don_vi_cha_id: ID_KHOA,
          truong_don_vi_id: ID_TBM,
        });
      }
      if (id === ID_KHOA_MOI) {
        return makeKhoaDoc({ id: ID_KHOA_MOI, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa Kinh tế' });
      }
      return null;
    });
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: ID_TBM,
      ho_ten: 'TS. Trưởng BM',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: 'truong_bo_mon',
      don_vi_chinh_id: ID_KHOA, // đang thuộc Khoa cũ, khác Bộ môn & khác Khoa mới
      danh_sach_vai_tro: [],
    }));
    await assert.rejects(
      () => phongBanService.updateDepartment({ id: ID_BOMON, body: { don_vi_cha_id: ID_KHOA_MOI }, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && /đơn vị khác/.test(err.message)
    );
    stub(models.PhongBan, 'findByPk', async () => makeKhoaDoc());

    // 3. Chặn tạo mới chỉ có vi_do mà thiếu kinh_do & chặn bán kính ngoài [10, 5000]
    await assert.rejects(
      () => phongBanService.createDepartment({ ten_phong_ban: 'Khoa Mới', loai_don_vi: 'khoa', vi_do: 21.0, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && /Vĩ độ.*Kinh độ/.test(err.message)
    );
    await assert.rejects(
      () => phongBanService.createDepartment({ ten_phong_ban: 'Khoa Mới', loai_don_vi: 'khoa', ban_kinh_met: 5, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && /10 đến 5000/.test(err.message)
    );

    // 4. Partial update chỉ gửi vi_do cho đơn vị đã có đủ tọa độ -> hợp lệ; gửi vi_do: null khi kinh_do vẫn còn -> chặn 400
    stub(models.NguoiDung, 'findAll', async (opts) => {
      // active query có kich_hoat: true -> 1; total query không có kich_hoat -> 3
      return opts?.where?.kich_hoat === true
        ? [{ don_vi_chinh_id: ID_KHOA, cnt: 1 }]
        : [{ don_vi_chinh_id: ID_KHOA, cnt: 3 }];
    });
    stub(models.MonHoc, 'findAll', async () => []);

    const partialRes = await phongBanService.updateDepartment({
      id: ID_KHOA,
      body: { vi_do: 20.97 },
      actorId: ID_ADMIN,
    });
    assert.equal(updatedPayload.vi_do, 20.97);
    assert.equal(partialRes.so_luong_thanh_vien, 1);
    assert.equal(partialRes.tong_so_thanh_vien, 3);

    await assert.rejects(
      () => phongBanService.updateDepartment({ id: ID_KHOA, body: { vi_do: null }, actorId: ID_ADMIN }),
      (err) => err.statusCode === 400 && /Vĩ độ.*Kinh độ/.test(err.message)
    );
  });
});

describe('Luồng 2 - Bảo mật, RBAC đa vai trò, Hồ sơ & Thu hồi phiên', () => {
  it('Route /api/nguoi-dung cho phép truong_bo_mon truy cập và lọc theo phạm vi đệ quy', async () => {
    const tbmActor = {
      id: ID_TBM,
      vai_tro_chinh: 'truong_bo_mon',
      don_vi_chinh_id: ID_BOMON,
      kich_hoat: true,
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    };
    stubAuthUser(tbmActor);
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAll', async () => [{ id: ID_GV }]);
    let capturedRoleWhere = null;
    stub(models.VaiTroNguoiDung, 'findAll', async (opts) => {
      capturedRoleWhere = opts?.where || null;
      return [];
    });
    stub(models.MauKhuonMat, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAndCountAll', async () => ({
      count: 1,
      rows: [
        {
          id: ID_GV,
          ho_ten: 'Giảng viên 1',
          email: 'gv1@ntu.edu.vn',
          vai_tro_chinh: 'giang_vien',
          don_vi_chinh_id: ID_BOMON,
          don_vi_chinh: { id: ID_BOMON, ten_phong_ban: 'Bộ môn KTPM', loai_don_vi: 'bo_mon' },
          ho_so: { loai_nhan_su: 'giang_vien', he_so_luong: 2.34 },
          danh_sach_vai_tro: [],
        },
      ],
    }));

    const res = await dispatchExpress(createTestApp(), {
      method: 'GET',
      url: '/api/nguoi-dung',
      headers: { authorization: `Bearer ${signToken(ID_TBM)}` },
    });

    assert.equal(res.status, 200);
    assert.equal(Boolean(capturedRoleWhere?.tu_ngay), true);
    assert.equal(res.body.data.users.length, 1);
    assert.equal(res.body.data.users[0].don_vi_chinh_id, ID_BOMON);
    assert.equal(res.body.data.users[0].don_vi_chinh.ten_phong_ban, 'Bộ môn KTPM');
  });

  it('Nhân viên tự sửa qua PUT /:ownId không thể gian lận so_nguoi_phu_thuoc, loai_nhan_su, loai_hop_dong, email, hoc_ham', async () => {
    let savedUserEmail = 'staff@ntu.edu.vn';
    let profileUpdatedWith = null;
    const selfDoc = {
      id: ID_GV,
      ho_ten: 'Cũ',
      email: 'staff@ntu.edu.vn',
      ma_can_bo: 'NV01',
      vai_tro_chinh: 'nhan_vien',
      don_vi_chinh_id: ID_PHONG,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
      ho_so: { loai_hop_dong: 'toan_thoi_gian', loai_nhan_su: 'nhan_vien', so_nguoi_phu_thuoc: 0 },
      save: async function () {
        savedUserEmail = this.email;
      },
      toJSON: function () {
        return { ...this };
      },
    };
    const mockScope = { findByPk: async () => selfDoc };

    stubTx();
    stub(models.NguoiDung, 'scope', () => mockScope);
    stub(models.NguoiDung, 'findByPk', async () => selfDoc);
    stub(models.HoSoCanBo, 'findOne', async () => ({
      update: async (u) => {
        profileUpdatedWith = u;
      },
    }));
    stub(models.MauKhuonMat, 'findOne', async () => null);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const res = await dispatchExpress(createTestApp(), {
      method: 'PUT',
      url: `/api/nguoi-dung/${ID_GV}`,
      headers: { authorization: `Bearer ${signToken(ID_GV)}` },
      body: {
        ho_ten: 'Tên Mới',
        so_dien_thoai: '0988777666',
        so_nguoi_phu_thuoc: 20,
        loai_nhan_su: 'giang_vien',
        loai_hop_dong: 'toan_thoi_gian',
        hoc_ham: 'giao_su',
        hoc_vi: 'tien_si',
        email: 'hacker@evil.com',
        he_so_luong: 9.9,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(savedUserEmail, 'staff@ntu.edu.vn');
    assert.equal(profileUpdatedWith, null);
    assert.equal(selfDoc.ho_ten, 'Tên Mới');
    assert.equal(selfDoc.so_dien_thoai, '0988777666');
  });

  it('Admin/BGH không thể tự khóa chính mình qua PUT /:ownId và TCCB bị chặn sửa người giữ vai trò bgh kiêm nhiệm', async () => {
    const adminDoc = {
      id: ID_ADMIN,
      vai_tro_chinh: 'admin',
      kich_hoat: true,
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
    };
    const mockScope = { findByPk: async () => adminDoc };
    stub(models.NguoiDung, 'scope', () => mockScope);
    stubAuthUser(adminDoc);

    const selfLockRes = await dispatchExpress(createTestApp(), {
      method: 'PUT',
      url: `/api/nguoi-dung/${ID_ADMIN}`,
      headers: { authorization: `Bearer ${signToken(ID_ADMIN)}` },
      body: { kich_hoat: false },
    });
    assert.equal(selfLockRes.status, 400);

    const tccbActor = { id: ID_TCCB, vai_tro_chinh: 'tccb', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const dualBghTarget = {
      id: ID_TARGET,
      vai_tro_chinh: 'giang_vien',
      kich_hoat: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'bgh' }],
    };
    stubAuthUser(tccbActor);
    stub(models.NguoiDung, 'scope', () => ({ findByPk: async () => dualBghTarget }));

    const tccbEditBgh = await dispatchExpress(createTestApp(), {
      method: 'PUT',
      url: `/api/nguoi-dung/${ID_TARGET}`,
      headers: { authorization: `Bearer ${signToken(ID_TCCB)}` },
      body: { trang_thai_lam_viec: 'da_nghi_viec' },
    });
    assert.equal(tccbEditBgh.status, 403);

    const tccbEditBghCode = await dispatchExpress(createTestApp(), {
      method: 'PUT',
      url: `/api/nguoi-dung/${ID_TARGET}`,
      headers: { authorization: `Bearer ${signToken(ID_TCCB)}` },
      body: { ma_can_bo: 'NEWCODE' },
    });
    assert.equal(tccbEditBghCode.status, 403);
  });

  it('Khóa/nghỉ việc/đổi mật khẩu xóa MaLamMoi trong Transaction, thu hồi grace token và gỡ vector khỏi AI RAM', async () => {
    let destroyedTokens = false;
    let updatedTokens = false;
    let revokedGraceFor = null;
    let removedFaissFor = null;
    let invalidatedCache = false;

    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'bgh', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const targetDoc = {
      id: ID_TARGET,
      email: 'target@ntu.edu.vn',
      vai_tro_chinh: 'giang_vien',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
      save: async () => {},
    };

    stubTx();
    stub(models.LichTrinh, 'count', async () => 0);
    stub(models.NgoaiLeLichTrinh, 'count', async () => 0);
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === ID_ADMIN) return adminActor;
      if (id === ID_TARGET) return targetDoc;
      return null;
    });
    stub(models.MaLamMoi, 'destroy', async () => {
      destroyedTokens = true;
      return 1;
    });
    stub(models.MaLamMoi, 'update', async () => {
      updatedTokens = true;
      return [0];
    });
    stub(authService, 'revokeUserGraceTokens', async (uid) => {
      revokedGraceFor = uid;
    });
    stub(aiConnector, 'removeFaissTemplate', async (uid) => {
      removedFaissFor = uid;
    });
    stub(hoTroChamCong, 'invalidateFaceCache', async () => {
      invalidatedCache = true;
    });
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const res = await nguoiDungService.softDeleteUser(ID_TARGET, adminActor);
    assert.match(res.message, /thành công/);
    assert.equal(targetDoc.kich_hoat, false);
    assert.equal(targetDoc.phien_ban_token, 2);
    assert.equal(destroyedTokens, true);
    assert.equal(updatedTokens, false);
    assert.equal(revokedGraceFor, ID_TARGET);
    assert.equal(removedFaissFor, ID_TARGET);
    assert.equal(invalidatedCache, true);

    // Kiểm tra updateExistingUser khi đổi sang da_nghi_viec cũng thu hồi phiên + gỡ RAM AI
    destroyedTokens = false;
    revokedGraceFor = null;
    removedFaissFor = null;
    invalidatedCache = false;
    const activeTargetDoc = {
      id: ID_TARGET,
      email: 'target2@ntu.edu.vn',
      ma_can_bo: 'GV99',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 3,
      danh_sach_vai_tro: [],
      ho_so: { loai_hop_dong: 'toan_thoi_gian' },
      save: async () => {},
      toJSON: function () {
        return { ...this };
      },
    };
    stub(models.NguoiDung, 'scope', () => ({ findByPk: async () => activeTargetDoc }));
    stub(models.NguoiDung, 'findByPk', async (id) => (id === ID_TARGET ? activeTargetDoc : adminActor));
    stub(models.MauKhuonMat, 'findOne', async () => null);

    await nguoiDungService.updateExistingUser(
      ID_TARGET,
      { trang_thai_lam_viec: 'da_nghi_viec' },
      adminActor
    );
    assert.equal(activeTargetDoc.kich_hoat, false);
    assert.equal(activeTargetDoc.phien_ban_token, 4);
    assert.equal(destroyedTokens, true);
    assert.equal(revokedGraceFor, ID_TARGET);
    assert.equal(removedFaissFor, ID_TARGET);
    assert.equal(invalidatedCache, true);
  });

  it('Chặn khóa tài khoản (409) khi giảng viên còn lịch giảng dạy/dạy thay hiệu lực hoặc đang làm Trưởng đơn vị', async () => {
    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const makeLecturerDoc = () => ({
      id: ID_TARGET,
      email: 'gv.schedule@ntu.edu.vn',
      ma_can_bo: 'GV101',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
      ho_so: { loai_hop_dong: 'toan_thoi_gian' },
      save: async () => {},
      toJSON: function () {
        return { ...this };
      },
    });

    stubTx();
    stub(models.NguoiDung, 'findByPk', async (id) => (id === ID_TARGET ? makeLecturerDoc() : adminActor));
    stub(models.NguoiDung, 'scope', () => ({ findByPk: async () => makeLecturerDoc() }));
    stub(models.LichTrinh, 'count', async () => 2);
    stub(models.NgoaiLeLichTrinh, 'count', async () => 0);
    stub(models.PhongBan, 'findAll', async () => []);

    // 1. softDeleteUser bị chặn 409 USER_HAS_ACTIVE_SCHEDULES khi còn lịch giảng dạy
    await assert.rejects(
      () => nguoiDungService.softDeleteUser(ID_TARGET, adminActor),
      (err) => err.statusCode === 409 && err.errorCode === 'USER_HAS_ACTIVE_SCHEDULES'
    );

    // 2. updateExistingUser chuyển da_nghi_viec hoặc kich_hoat: false cũng bị chặn 409
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { kich_hoat: false }, adminActor),
      (err) => err.statusCode === 409 && err.errorCode === 'USER_HAS_ACTIVE_SCHEDULES'
    );

    // 3. Có lịch phân công dạy thay tương lai cũng bị chặn 409
    stub(models.LichTrinh, 'count', async () => 0);
    stub(models.NgoaiLeLichTrinh, 'count', async () => 1);
    await assert.rejects(
      () => nguoiDungService.softDeleteUser(ID_TARGET, adminActor),
      (err) => err.statusCode === 409 && err.errorCode === 'USER_HAS_ACTIVE_SCHEDULES'
    );

    // 4. Hết lịch dạy nhưng đang giữ chức Trưởng đơn vị bị chặn 409 USER_IS_DEPARTMENT_MANAGER
    stub(models.NgoaiLeLichTrinh, 'count', async () => 0);
    stub(models.PhongBan, 'findAll', async () => [{ id: ID_KHOA, ten_phong_ban: 'Khoa CNTT' }]);
    await assert.rejects(
      () => nguoiDungService.softDeleteUser(ID_TARGET, adminActor),
      (err) => err.statusCode === 409 && err.errorCode === 'USER_IS_DEPARTMENT_MANAGER'
    );
  });

  it('Phương án B Avatar: tạo mới luôn để mặc định, cấm Admin gán ảnh hộ người khác nhưng cho đặt lại mặc định', async () => {
    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const deanActor = { id: ID_TBM, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: ID_KHOA, kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const targetDoc = {
      id: ID_TARGET,
      ho_ten: 'GV Test Avatar',
      email: 'gv.avatar@ntu.edu.vn',
      ma_can_bo: 'GV102',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      anh_dai_dien: '/api/tai-tep/tep/avatar-existing.png',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
      ho_so: { loai_hop_dong: 'toan_thoi_gian' },
      save: async () => {},
      toJSON: function () {
        return { ...this };
      },
    };

    stubTx();
    stub(models.PhongBan, 'findByPk', async () => ({ id: ID_KHOA, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa CNTT' }));
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findOne', async () => null);
    stub(models.NguoiDung, 'scope', () => ({ findByPk: async () => targetDoc }));
    stub(models.NguoiDung, 'findByPk', async (id) => (id === ID_TARGET ? targetDoc : adminActor));
    stub(models.MauKhuonMat, 'findOne', async () => null);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    // 1. Tạo mới không cho phép truyền anh_dai_dien khác rỗng
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ho_ten: 'GV Mới',
            email: 'gv.moi@ntu.edu.vn',
            mat_khau: '123456',
            ma_can_bo: 'GV900',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_KHOA,
            anh_dai_dien: '/api/tai-tep/tep/avatar-spoof.png',
          },
          adminActor
        ),
      (err) => err.statusCode === 403 && err.errorCode === 'AVATAR_SELF_MANAGE_ONLY'
    );

    // 2. Admin cố gán avatar mới cho người khác -> chặn 403 AVATAR_SELF_MANAGE_ONLY
    await assert.rejects(
      () =>
        nguoiDungService.updateExistingUser(
          ID_TARGET,
          { anh_dai_dien: '/api/tai-tep/tep/avatar-new-by-admin.png' },
          adminActor
        ),
      (err) => err.statusCode === 403 && err.errorCode === 'AVATAR_SELF_MANAGE_ONLY'
    );

    // 3. Trưởng khoa không thể reset hay sửa anh_dai_dien của giảng viên trong khoa (bị strip khỏi payload)
    await nguoiDungService.updateExistingUser(
      ID_TARGET,
      { ho_ten: 'GV Đã Sửa Tên', anh_dai_dien: null },
      deanActor
    );
    assert.equal(targetDoc.anh_dai_dien, '/api/tai-tep/tep/avatar-existing.png');

    // 4. Admin được phép đặt lại về ảnh mặc định (anh_dai_dien: null)
    await nguoiDungService.updateExistingUser(ID_TARGET, { anh_dai_dien: null }, adminActor);
    assert.equal(targetDoc.anh_dai_dien, null);
  });

  it('Kiểm tra ràng buộc ngày giảng dạy, hạn hợp đồng, MST, ngân hàng khi cập nhật và chuẩn hóa ngày YYYY-MM-DD', async () => {
    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const makeDoc = () => ({
      id: ID_TARGET,
      ho_ten: 'GV Kiểm Thử Ngày',
      email: 'gv.date@ntu.edu.vn',
      ma_can_bo: 'GV108',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      danh_sach_vai_tro: [],
      ho_so: {
        loai_hop_dong: 'toan_thoi_gian',
        ngay_sinh: new Date('1990-05-15T00:00:00.000Z'),
        ngay_vao_lam: new Date('2020-09-01T00:00:00.000Z'),
        ngay_bat_dau_giang_day: new Date('2018-09-01T00:00:00.000Z'),
        ngay_het_han_hop_dong: null,
        so_tai_khoan_ngan_hang: null,
        ten_ngan_hang: null,
      },
      save: async () => {},
      toJSON: function () {
        return { ...this };
      },
    });

    stubTx();
    stub(models.NguoiDung, 'scope', () => ({ findByPk: async () => makeDoc() }));
    stub(models.NguoiDung, 'findByPk', async () => makeDoc());
    stub(models.MauKhuonMat, 'findOne', async () => null);

    // 1. fetchUserById chuẩn hóa các cột DATEONLY từ Date -> YYYY-MM-DD
    const detail = await nguoiDungService.fetchUserById(ID_TARGET, adminActor);
    assert.equal(detail.ngay_sinh, '1990-05-15');
    assert.equal(detail.ngay_vao_lam, '2020-09-01');
    assert.equal(detail.ngay_bat_dau_giang_day, '2018-09-01');

    // 2. Chặn ngay_bat_dau_giang_day <= ngay_sinh
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { ngay_bat_dau_giang_day: '1989-01-01' }, adminActor),
      (err) => err.statusCode === 400 && /sau ngày sinh/i.test(err.message)
    );

    // 3. Chặn ngay_bat_dau_giang_day ở tương lai
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { ngay_bat_dau_giang_day: '2099-01-01' }, adminActor),
      (err) => err.statusCode === 400 && /không được lớn hơn ngày hiện tại/i.test(err.message)
    );

    // 4. Chặn ngay_het_han_hop_dong < ngay_vao_lam
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { ngay_het_han_hop_dong: '2019-12-31' }, adminActor),
      (err) => err.statusCode === 400 && /sau hoặc bằng ngày vào làm/i.test(err.message)
    );

    // 5. Chặn mã số thuế sai định dạng & nhập số tài khoản nhưng thiếu tên ngân hàng
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { ma_so_thue: '12345' }, adminActor),
      (err) => err.statusCode === 400 && /10 hoặc 13 chữ số/i.test(err.message)
    );
    await assert.rejects(
      () => nguoiDungService.updateExistingUser(ID_TARGET, { so_tai_khoan_ngan_hang: '190312345678' }, adminActor),
      (err) => err.statusCode === 400 && /tên ngân hàng/i.test(err.message)
    );
  });

  it('Cho phép thỉnh giảng he_so_luong = 0, chặn he_so_luong = NaN và chặn trùng danh_sach_vai_tro', async () => {
    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    let createdProfilePayload = null;

    stubTx();
    stub(models.PhongBan, 'findByPk', async () => ({ id: ID_KHOA, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa CNTT' }));
    stub(models.NguoiDung, 'findOne', async () => null);
    stub(models.NguoiDung, 'create', async (u) => ({ id: ID_TARGET, ...u }));
    stub(models.HoSoCanBo, 'create', async (p) => {
      createdProfilePayload = p;
      return p;
    });
    stub(models.VaiTroNguoiDung, 'bulkCreate', async (r) => r);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: ID_TARGET,
      ho_ten: 'GV Thỉnh Giảng',
      email: 'tg@ntu.edu.vn',
      ma_can_bo: 'TG01',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_KHOA,
      don_vi_chinh: { id: ID_KHOA, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa' },
      ho_so: createdProfilePayload,
      danh_sach_vai_tro: [],
      toJSON: function () {
        return { ...this };
      },
    }));
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const created = await nguoiDungService.createNewUser(
      {
        ho_ten: 'GV Thỉnh Giảng',
        email: 'tg@ntu.edu.vn',
        mat_khau: '123456',
        ma_can_bo: 'TG01',
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: ID_KHOA,
        loai_hop_dong: 'thinh_giang',
        he_so_luong: 0,
      },
      adminActor
    );
    assert.equal(createdProfilePayload.he_so_luong, 0);
    assert.equal(created.he_so_luong, 0);

    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ho_ten: 'Lỗi Số',
            email: 'nan@ntu.edu.vn',
            mat_khau: '123456',
            ma_can_bo: 'ERR01',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_KHOA,
            he_so_luong: 'abc',
          },
          adminActor
        ),
      (err) => err.statusCode === 400
    );

    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ho_ten: 'Trùng Vai Trò',
            email: 'dup@ntu.edu.vn',
            mat_khau: '123456',
            ma_can_bo: 'DUP01',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_KHOA,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'khoa', don_vi_id: ID_KHOA },
              { ma_vai_tro: 'giang_vien', pham_vi: 'khoa', don_vi_id: ID_KHOA },
            ],
          },
          adminActor
        ),
      (err) => err.statusCode === 400
    );
  });

  it('Siết chuẩn validate danh_sach_vai_tro (cấm toan_truong cho cấp đơn vị, khớp loai_don_vi, chặn kiêm nhiệm admin/trưởng, khóa ủy quyền cấp Phó & ngày YYYY-MM-DD)', async () => {
    const bghActor = { id: ID_ADMIN, vai_tro_chinh: 'bgh', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    let persistedRoles = [];

    const ID_KHOA_OTHER = '88888888-8888-4888-8888-888888888888';
    stubTx();
    stub(models.PhongBan, 'findByPk', async (id) => {
      if (id === ID_KHOA) return { id: ID_KHOA, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa CNTT', don_vi_cha_id: null };
      if (id === ID_BOMON) return { id: ID_BOMON, loai_don_vi: 'bo_mon', ten_phong_ban: 'Bộ môn KTPM', don_vi_cha_id: ID_KHOA };
      if (id === ID_KHOA_OTHER) return { id: ID_KHOA_OTHER, loai_don_vi: 'khoa', ten_phong_ban: 'Khoa Kinh tế', don_vi_cha_id: null };
      if (id === ID_PHONG) return { id: ID_PHONG, loai_don_vi: 'phong_ban', ten_phong_ban: 'Phòng TCCB', don_vi_cha_id: null };
      return null;
    });
    stub(models.NguoiDung, 'findOne', async () => null);
    stub(models.NguoiDung, 'create', async (u) => ({ id: ID_TARGET, ...u }));
    stub(models.HoSoCanBo, 'create', async (p) => p);
    stub(models.VaiTroNguoiDung, 'bulkCreate', async (rows) => {
      persistedRoles = rows;
      return rows;
    });
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: ID_TARGET,
      ho_ten: 'GV Bộ Môn',
      email: 'gvbm@ntu.edu.vn',
      ma_can_bo: 'GVBM01',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_BOMON,
      don_vi_chinh: { id: ID_BOMON, ten_phong_ban: 'Bộ môn KTPM', loai_don_vi: 'bo_mon' },
      ho_so: { loai_nhan_su: 'giang_vien' },
      danh_sach_vai_tro: persistedRoles,
      toJSON: function () {
        return { ...this };
      },
    }));
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const basePayload = {
      ho_ten: 'GV Bộ Môn',
      email: 'gvbm@ntu.edu.vn',
      mat_khau: '123456',
      ma_can_bo: 'GVBM01',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: ID_BOMON,
    };

    // 1. Chặn pho_khoa nhận pham_vi = 'toan_truong'
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'bo_mon', don_vi_id: ID_BOMON },
              { ma_vai_tro: 'pho_khoa', pham_vi: 'toan_truong', don_vi_id: null, duoc_uy_quyen: true },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );

    // 2. Chặn lệch pham_vi = 'khoa' khi don_vi_id là bo_mon
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [{ ma_vai_tro: 'giang_vien', pham_vi: 'khoa', don_vi_id: ID_BOMON }],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );

    // 3. Chặn gán admin và truong_khoa dưới dạng vai trò kiêm nhiệm
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'bo_mon', don_vi_id: ID_BOMON },
              { ma_vai_tro: 'admin', pham_vi: 'toan_truong', don_vi_id: null },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'bo_mon', don_vi_id: ID_BOMON },
              { ma_vai_tro: 'truong_khoa', pham_vi: 'khoa', don_vi_id: ID_KHOA },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );

    // 4. Chặn den_ngay < tu_ngay và sai định dạng ngày YYYY-MM-DD
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'bo_mon', don_vi_id: ID_BOMON, tu_ngay: '2026-06-01', den_ngay: '2026-05-01' },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', pham_vi: 'bo_mon', don_vi_id: ID_BOMON, tu_ngay: '2026-02-30' },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400
    );

    // 5. Hợp lệ: ép duoc_uy_quyen = false với giang_vien, giữ true với pho_khoa, suy đúng pham_vi = 'bo_mon' & don_vi_id = null với tccb
    await nguoiDungService.createNewUser(
      {
        ...basePayload,
        danh_sach_vai_tro: [
          { ma_vai_tro: 'giang_vien', don_vi_id: ID_BOMON, duoc_uy_quyen: true, tu_ngay: '2025-09-01' },
          { ma_vai_tro: 'pho_khoa', don_vi_id: ID_KHOA, duoc_uy_quyen: true, tu_ngay: '2026-01-01', den_ngay: '2026-12-31' },
          { ma_vai_tro: 'tccb', don_vi_id: ID_PHONG, duoc_uy_quyen: true },
        ],
      },
      bghActor
    );
    assert.equal(persistedRoles.length, 3);
    assert.equal(persistedRoles[0].pham_vi, 'bo_mon');
    assert.equal(persistedRoles[0].duoc_uy_quyen, false);
    assert.equal(persistedRoles[0].tu_ngay, '2025-09-01');
    assert.equal(persistedRoles[1].pham_vi, 'khoa');
    assert.equal(persistedRoles[1].duoc_uy_quyen, true);
    assert.equal(persistedRoles[2].pham_vi, 'toan_truong');
    assert.equal(persistedRoles[2].don_vi_id, null);
    assert.equal(persistedRoles[2].duoc_uy_quyen, false);

    // 6. Không gửi danh_sach_vai_tro: buildDefaultRolesArray tự suy 'bo_mon' cho giảng viên thuộc Bộ môn
    persistedRoles = [];
    await nguoiDungService.createNewUser(basePayload, bghActor);
    assert.equal(persistedRoles.length, 1);
    assert.equal(persistedRoles[0].pham_vi, 'bo_mon');
    assert.equal(persistedRoles[0].don_vi_id, ID_BOMON);

    // 7. Chặn gán trùng vai trò giang_vien giữa Khoa cha và Bộ môn con (cả 2 chiều), vẫn cho phép kiêm giảng sang Khoa khác
    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            don_vi_chinh_id: ID_KHOA,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', don_vi_id: ID_KHOA },
              { ma_vai_tro: 'giang_vien', don_vi_id: ID_BOMON },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400 && /Khoa và Bộ môn trực thuộc/.test(err.message)
    );

    await assert.rejects(
      () =>
        nguoiDungService.createNewUser(
          {
            ...basePayload,
            don_vi_chinh_id: ID_BOMON,
            danh_sach_vai_tro: [
              { ma_vai_tro: 'giang_vien', don_vi_id: ID_BOMON },
              { ma_vai_tro: 'giang_vien', don_vi_id: ID_KHOA },
            ],
          },
          bghActor
        ),
      (err) => err.statusCode === 400 && /Khoa và Bộ môn trực thuộc/.test(err.message)
    );

    persistedRoles = [];
    await nguoiDungService.createNewUser(
      {
        ...basePayload,
        don_vi_chinh_id: ID_BOMON,
        danh_sach_vai_tro: [
          { ma_vai_tro: 'giang_vien', don_vi_id: ID_BOMON },
          { ma_vai_tro: 'giang_vien', don_vi_id: ID_KHOA_OTHER, den_ngay: '2026-11-24' },
        ],
      },
      bghActor
    );
    assert.equal(persistedRoles.length, 2);
    assert.equal(persistedRoles[1].don_vi_id, ID_KHOA_OTHER);
  });

  it('fetchUserById bung phẳng đúng dữ liệu từ Sequelize HoSoCanBo instance (ngay_sinh, so_cccd, dia_chi, chuc_vu, he_so_luong) và không rò dataValues', async () => {
    const adminActor = { id: ID_ADMIN, vai_tro_chinh: 'admin', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    const fakeProfileInstance = {
      dataValues: { ngay_sinh: '2005-11-10', so_cccd: '015205003366' },
      get: ({ plain } = {}) =>
        plain
          ? {
              id: 'prof-id',
              nguoi_dung_id: ID_TARGET,
              gioi_tinh: 'nam',
              ngay_sinh: '2005-11-10',
              so_cccd: '015205003366',
              dia_chi: 'Hà Nội',
              chuc_vu: 'Giảng viên',
              loai_nhan_su: 'giang_vien',
              loai_hop_dong: 'toan_thoi_gian',
              ngay_vao_lam: '2026-11-22',
              ngay_bat_dau_giang_day: '2026-11-20',
              ngay_het_han_hop_dong: '2027-10-22',
              ngach_luong: 'V.07.01.03',
              he_so_luong: 2.34,
            }
          : null,
      toJSON() {
        return this.get({ plain: true });
      },
    };
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: ID_TARGET,
      ho_so: fakeProfileInstance,
      get: ({ plain } = {}) =>
        plain
          ? {
              id: ID_TARGET,
              ho_ten: 'ThS. Vũ Tiến Đức',
              email: 'ducvt.gv@ntu.edu.vn',
              ma_can_bo: 'GV_CNTT01',
              vai_tro_chinh: 'giang_vien',
              don_vi_chinh_id: ID_KHOA,
              don_vi_chinh: { id: ID_KHOA, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa' },
              ho_so: fakeProfileInstance.get({ plain: true }),
              danh_sach_vai_tro: [],
            }
          : null,
      toJSON() {
        return {
          id: ID_TARGET,
          ho_ten: 'ThS. Vũ Tiến Đức',
          vai_tro_chinh: 'giang_vien',
          ho_so: fakeProfileInstance,
        };
      },
    }));
    stub(models.MauKhuonMat, 'findOne', async () => null);

    const detail = await nguoiDungService.fetchUserById(ID_TARGET, adminActor);
    assert.equal(detail.ngay_sinh, '2005-11-10');
    assert.equal(detail.so_cccd, '015205003366');
    assert.equal(detail.dia_chi, 'Hà Nội');
    assert.equal(detail.chuc_vu, 'Giảng viên');
    assert.equal(detail.ngay_vao_lam, '2026-11-22');
    assert.equal(detail.ngay_bat_dau_giang_day, '2026-11-20');
    assert.equal(detail.ngay_het_han_hop_dong, '2027-10-22');
    assert.equal(detail.ngach_luong, 'V.07.01.03');
    assert.equal(detail.he_so_luong, 2.34);
    assert.equal('dataValues' in detail, false);
  });
});

describe('Luồng 2 - Cổng Giảng Viên Công Khai', () => {
  it('getPublicFacultyById chặn lộ hồ sơ nhân sự phi giảng viên (loai_nhan_su != giang_vien)', async () => {
    let queriedProfileWhere = null;
    stub(models.NguoiDung, 'findOne', async (opts) => {
      const profileInclude = opts.include.find((inc) => inc.as === 'ho_so');
      queriedProfileWhere = profileInclude?.where || null;
      return null;
    });

    await assert.rejects(
      () => giangVienCongKhaiService.getPublicFacultyById(ID_ADMIN),
      (err) => err.statusCode === 404
    );
    assert.deepEqual(queriedProfileWhere, { loai_nhan_su: 'giang_vien' });
  });

  it('getPublicFacultyList mở rộng bộ môn con khi lọc theo Khoa, từ chối phong_ban_id sai UUID và sort đúng học hàm/học vị', async () => {
    await assert.rejects(
      () => giangVienCongKhaiService.getPublicFacultyList({ phong_ban_id: 'not-a-uuid' }),
      (err) => err.statusCode === 400
    );

    let capturedOrder = null;
    let capturedWhere = null;
    let pbCall = 0;
    stub(models.PhongBan, 'findAll', async () => {
      pbCall += 1;
      if (pbCall === 1) return [{ id: ID_BOMON }];
      return [];
    });
    stub(models.NguoiDung, 'findAndCountAll', async (opts) => {
      capturedOrder = opts.order;
      capturedWhere = opts.where;
      return {
        count: 1,
        rows: [
          {
            id: ID_GV,
            ho_ten: 'GS.TS Nguyễn An',
            email: 'an@ntu.edu.vn',
            don_vi_chinh_id: ID_BOMON,
            don_vi_chinh: null,
            ho_so: { hoc_ham: 'giao_su', hoc_vi: 'tien_si', chuc_vu: '' },
          },
        ],
      };
    });

    const listRes = await giangVienCongKhaiService.getPublicFacultyList({ phong_ban_id: ID_KHOA });
    assert.equal(listRes.data.length, 1);
    assert.equal(listRes.data[0].khoa, 'Chưa phân đơn vị');
    assert.equal(listRes.data[0].phong_lam_viec, '');
    assert.equal(typeof capturedWhere.don_vi_chinh_id, 'object');
    assert.equal(String(capturedOrder[0][0].val || '').includes("WHEN 'giao_su' THEN 1"), true);
    assert.equal(String(capturedOrder[1][0].val || '').includes("WHEN 'tien_si' THEN 1"), true);
  });
});

describe('Luồng 2 - Nhập Nhanh Nhân Sự Từ Excel (POST /api/nguoi-dung/nhap-excel)', () => {
  it('chặn vai trò không đủ thẩm quyền (giang_vien bị trả 403)', async () => {
    const actor = { id: ID_GV, vai_tro_chinh: 'giang_vien', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);

    const res = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/nguoi-dung/nhap-excel',
      headers: { authorization: `Bearer ${signToken(ID_GV)}` },
      body: { danh_sach: [] },
    });
    assert.equal(res.status, 403);
  });

  it('từ chối nguyên tử khi trùng email trong file hoặc đã tồn tại trên hệ thống và không gọi transaction', async () => {
    const actor = { id: ID_TCCB, vai_tro_chinh: 'tccb', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);
    stub(models.PhongBan, 'findByPk', async (id) =>
      String(id) === ID_BOMON ? { id: ID_BOMON, ten_phong_ban: 'Bộ môn CNPM', loai_don_vi: 'bo_mon' } : null
    );
    stub(models.NguoiDung, 'findAll', async () => [
      { email: 'existing@ntu.edu.vn', ma_can_bo: 'GV_OLD' },
    ]);

    let txCalled = false;
    stub(sequelize, 'transaction', async () => {
      txCalled = true;
    });

    const res = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/nguoi-dung/nhap-excel',
      headers: { authorization: `Bearer ${signToken(ID_TCCB)}` },
      body: {
        danh_sach: [
          {
            ho_ten: 'Nguyễn A',
            ma_can_bo: 'GV101',
            email: 'dup@ntu.edu.vn',
            mat_khau: 'password123',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_BOMON,
          },
          {
            ho_ten: 'Nguyễn B',
            ma_can_bo: 'GV102',
            email: 'dup@ntu.edu.vn',
            mat_khau: 'password123',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_BOMON,
          },
          {
            ho_ten: 'Nguyễn C',
            ma_can_bo: 'GV103',
            email: 'existing@ntu.edu.vn',
            mat_khau: 'password123',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_BOMON,
          },
        ],
      },
    });

    assert.equal(res.status, 400);
    assert.equal(txCalled, false);
    assert.equal(Array.isArray(res.body?.errors), true);
    assert.equal(res.body.errors.length, 2);
  });

  it('TCCB nhập thành công danh sách 2 nhân sự hợp lệ trong 1 transaction và ghi audit log', async () => {
    const actor = { id: ID_TCCB, vai_tro_chinh: 'tccb', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);
    stubTx();

    stub(models.PhongBan, 'findByPk', async (id) => {
      if (String(id) === ID_BOMON) return { id: ID_BOMON, ten_phong_ban: 'Bộ môn CNPM', loai_don_vi: 'bo_mon' };
      if (String(id) === ID_PHONG) return { id: ID_PHONG, ten_phong_ban: 'Phòng TCCB', loai_don_vi: 'phong_ban' };
      return null;
    });

    const createdUsersList = [];
    let profileCreates = 0;
    let roleCreates = 0;
    let auditPayload = null;

    stub(models.NguoiDung, 'findAll', async (opts) => {
      if (opts?.where?.id) {
        return createdUsersList.map((u) => ({
          toJSON: () => ({ ...u, ho_so: { loai_nhan_su: 'giang_vien' }, don_vi_chinh: null, danh_sach_vai_tro: [] }),
        }));
      }
      return [];
    });
    stub(models.NguoiDung, 'create', async (payload) => {
      const id = `99999999-9999-4999-8999-00000000000${createdUsersList.length + 1}`;
      const row = { id, ...payload };
      createdUsersList.push(row);
      return row;
    });
    stub(models.HoSoCanBo, 'create', async () => {
      profileCreates += 1;
      return {};
    });
    stub(models.VaiTroNguoiDung, 'bulkCreate', async () => {
      roleCreates += 1;
      return [];
    });
    stub(models.NhatKyKiemToan, 'create', async (payload) => {
      auditPayload = payload;
      return {};
    });

    const res = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/nguoi-dung/nhap-excel',
      headers: { authorization: `Bearer ${signToken(ID_TCCB)}` },
      body: {
        danh_sach: [
          {
            ho_ten: 'Giảng viên Mới',
            ma_can_bo: 'GV201',
            email: 'gv201@ntu.edu.vn',
            mat_khau: 'password123',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_BOMON,
          },
          {
            ho_ten: 'Chuyên viên Mới',
            ma_can_bo: 'NV201',
            email: 'nv201@ntu.edu.vn',
            mat_khau: 'password123',
            vai_tro_chinh: 'nhan_vien',
            don_vi_chinh_id: ID_PHONG,
          },
        ],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body?.data?.totalCreated, 2);
    assert.equal(createdUsersList.length, 2);
    assert.equal(profileCreates, 2);
    assert.equal(roleCreates, 2);
    assert.equal(auditPayload?.hanh_dong, 'IMPORT_USERS_EXCEL');
  });

  it('tự sinh mã cán bộ theo chức vụ/vai trò và dùng mật khẩu mặc định 123456 khi bỏ trống trong Excel', async () => {
    const bcrypt = require('bcryptjs');
    const actor = { id: ID_TCCB, vai_tro_chinh: 'tccb', kich_hoat: true, phien_ban_token: 1, danh_sach_vai_tro: [] };
    stubAuthUser(actor);
    stubTx();

    stub(models.PhongBan, 'findByPk', async (id) => {
      if (String(id) === ID_BOMON) return { id: ID_BOMON, ten_phong_ban: 'Bộ môn CNPM', loai_don_vi: 'bo_mon' };
      if (String(id) === ID_PHONG) return { id: ID_PHONG, ten_phong_ban: 'Phòng TCCB', loai_don_vi: 'phong_ban' };
      if (String(id) === ID_KHOA) return { id: ID_KHOA, ten_phong_ban: 'Khoa CNTT', loai_don_vi: 'khoa' };
      return null;
    });

    const createdUsersList = [];
    stub(models.NguoiDung, 'findAll', async (opts) => {
      if (opts?.where?.id) {
        return createdUsersList.map((u) => ({
          toJSON: () => ({ ...u, ho_so: { loai_nhan_su: 'giang_vien' }, don_vi_chinh: null, danh_sach_vai_tro: [] }),
        }));
      }
      if (opts?.attributes?.length === 1 && opts.attributes[0] === 'ma_can_bo') {
        return [{ ma_can_bo: 'GV001' }];
      }
      return [];
    });
    stub(models.NguoiDung, 'create', async (payload) => {
      const id = `88888888-8888-4888-8888-00000000000${createdUsersList.length + 1}`;
      const row = { id, ...payload };
      createdUsersList.push(row);
      return row;
    });
    stub(models.HoSoCanBo, 'create', async () => ({}));
    stub(models.VaiTroNguoiDung, 'bulkCreate', async () => []);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const res = await dispatchExpress(createTestApp(), {
      method: 'POST',
      url: '/api/nguoi-dung/nhap-excel',
      headers: { authorization: `Bearer ${signToken(ID_TCCB)}` },
      body: {
        danh_sach: [
          {
            ho_ten: 'Giảng viên A',
            email: 'gva@ntu.edu.vn',
            chuc_vu: 'Giảng viên',
            vai_tro_chinh: 'giang_vien',
            don_vi_chinh_id: ID_BOMON,
          },
          {
            ho_ten: 'Chuyên viên B',
            email: 'cvb@ntu.edu.vn',
            chuc_vu: 'Chuyên viên',
            vai_tro_chinh: 'nhan_vien',
            don_vi_chinh_id: ID_PHONG,
          },
          {
            ho_ten: 'Trưởng khoa C',
            email: 'tkc@ntu.edu.vn',
            chuc_vu: 'Trưởng khoa CNTT',
            vai_tro_chinh: 'truong_khoa',
            don_vi_chinh_id: ID_KHOA,
          },
        ],
      },
    });

    assert.equal(res.status, 201);
    assert.deepEqual(
      createdUsersList.map((u) => u.ma_can_bo),
      ['GV002', 'CV001', 'TK001']
    );
    const pwdMatch = await bcrypt.compare('123456', createdUsersList[0].mat_khau_ma_hoa);
    assert.equal(pwdMatch, true);
  });
});
