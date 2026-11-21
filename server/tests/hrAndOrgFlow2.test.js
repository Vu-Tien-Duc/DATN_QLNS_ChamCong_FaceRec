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
