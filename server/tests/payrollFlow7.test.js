// Kiểm thử trọng tâm Luồng 7 (Tiền lương, Phụ cấp, Giảm trừ, Khóa/Mở sổ lương, Xuất Excel/PDF & RBAC).
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';

const models = require('../models');
const { sequelize } = require('../config/db');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const phieuLuongRoutes = require('../routes/phieuLuong.routes');
const { resetMemoryLocks } = require('../utils/khoaPhanTan');
const {
  calculatePersonalIncomeTax5Brackets,
  calculateUserPayroll,
  formatPayrollDoc,
} = require('../services/phieuLuong/tinhThueVaLuong.helper');
const {
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
} = require('../services/phieuLuong/phieuLuong.service');

const ID_ADMIN = '11111111-1111-4111-8111-111111111111';
const ID_KE_TOAN = '22222222-2222-4222-8222-222222222222';
const ID_BGH = '33333333-3333-4333-8333-333333333333';
const ID_DEAN = '44444444-4444-4444-8444-444444444444';
const ID_GV = '55555555-5555-4555-8555-555555555555';
const ID_KIEM_TOAN = '66666666-6666-4666-8666-666666666666';
const ID_DEPT_1 = '77777777-7777-4777-8777-777777777777';
const ID_DEPT_CHILD = '88888888-8888-4888-8888-888888888888';
const ID_PAYROLL_1 = '99999999-9999-4999-8999-999999999991';
const ID_PAYROLL_2 = '99999999-9999-4999-8999-999999999992';
const ID_SCH_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const BASE_CONFIG = {
  luong_co_so: 2530000,
  luong_toi_thieu_vung: 4960000,
  giam_tru_ban_than: 15500000,
  giam_tru_phu_thuoc: 6200000,
  ty_le_bhxh: 0.08,
  ty_le_bhyt: 0.015,
  ty_le_bhtn: 0.01,
  tong_ty_le_bao_hiem: 0.105,
  bieu_thue_5_bac: [
    { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05 },
    { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.1 },
    { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.2 },
    { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.3 },
    { bac: 5, tu: 100000000, den: 100000000, thue_suat: 0.35 },
  ],
  don_gia_gio_chuan: 120000,
  dinh_muc_thang: 45,
  ty_le_uu_dai_map: { giang_vien: 0.3, hanh_chinh: 0.0 },
  chuc_vu_list: [
    { ma_chuc_vu: 'truong_khoa', he_so_phu_cap: 0.7, ty_le_giam_dinh_muc: 0.3 },
    { ma_chuc_vu: 'pho_bo_mon', he_so_phu_cap: 0.4, ty_le_giam_dinh_muc: 0.1 },
  ],
  so_ngay_cong_chuan: 22,
  phu_cap_chuc_vu_map: { truong_khoa: 0.7, pho_bo_mon: 0.4 },
};

const restores = [];
const stub = (obj, prop, value) => {
  const original = obj[prop];
  obj[prop] = value;
  restores.push(() => {
    obj[prop] = original;
  });
};

afterEach(() => {
  resetMemoryLocks();
  while (restores.length > 0) {
    restores.pop()();
  }
});

const createPayrollApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/phieu-luong', phieuLuongRoutes);
  app.use(errorHandler);
  return app;
};

const injectRequest = (app, { method = 'GET', url, headers = {}, body = null }) => {
  const reqHeaders = {};
  for (const [k, v] of Object.entries(headers)) reqHeaders[k.toLowerCase()] = v;
  const rawBody = body !== null ? Buffer.from(JSON.stringify(body), 'utf8') : Buffer.alloc(0);
  if (body !== null) {
    reqHeaders['content-type'] = 'application/json';
    reqHeaders['content-length'] = String(rawBody.length);
  }

  return new Promise((resolve) => {
    const socket = new Readable({ read() {} });
    socket.remoteAddress = '127.0.0.1';
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
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      resolve({ status: res.statusCode, body: json });
    };
    app(req, res);
  });
};

const makeToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Luồng 7 — Payroll Calculation Engine (P0/P1)', () => {
  it('không cộng giờ hành chính của Trưởng khoa kiêm nhiệm thành tiền vượt giờ giảng', async () => {
    stub(models.NhatKyChamCong, 'findAll', async () => [
      // 2 ngày chấm công ca hành chính (lich_trinh_id = null, so_gio_cong = 8)
      { ngay_cong: '2026-10-01', trang_thai: 'on_time', lich_trinh_id: null, so_tiet_thuc_day: 0, so_gio_cong: 8, don_tu_id: null },
      { ngay_cong: '2026-10-02', trang_thai: 'on_time', lich_trinh_id: null, so_tiet_thuc_day: 0, so_gio_cong: 8, don_tu_id: null },
      // 1 ca giảng dạy có lich_trinh_id (4 tiết = 3 giờ chuẩn, dưới định mức 32 giờ)
      { ngay_cong: '2026-10-03', trang_thai: 'on_time', lich_trinh_id: ID_SCH_1, so_tiet_thuc_day: 4, so_gio_cong: 3, don_tu_id: null },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    const res = await calculateUserPayroll({
      user: {
        id: ID_DEAN,
        vai_tro_chinh: 'truong_khoa',
        ho_so: { he_so_luong: 4.4, chuc_vu: 'truong_khoa', loai_nhan_su: 'giang_vien', loai_hop_dong: 'toan_thoi_gian' },
      },
      month: 10,
      year: 2026,
      configParams: BASE_CONFIG,
      createdBy: ID_KE_TOAN,
    });

    assert.equal(res.payrollFields.so_tiet_thuc_day, 3);
    assert.equal(res.payrollFields.so_tiet_nghia_vu, 31); // Math.round(45 * (1 - 0.3)) = 31
    assert.equal(res.payrollFields.so_tiet_vuot_gio, 0);
    assert.equal(res.payrollFields.tien_vuot_gio, 0);
    assert.equal(res.payrollFields.so_cong_thuc_te, 3);
  });

  it('trừ công đối với thieu_check_out và trả 0 lương + 0 phụ cấp khi không đi làm ngày nào', async () => {
    // Trường hợp A: Có 1 ngày thiếu check-out (không được tính công và không tính giờ giảng)
    stub(models.NhatKyChamCong, 'findAll', async () => [
      { ngay_cong: '2026-10-05', trang_thai: 'thieu_check_out', lich_trinh_id: ID_SCH_1, so_tiet_thuc_day: 4, so_gio_cong: 0, don_tu_id: null },
      { ngay_cong: '2026-10-06', trang_thai: 'on_time', lich_trinh_id: ID_SCH_1, so_tiet_thuc_day: 4, so_gio_cong: 3, don_tu_id: null },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    const partial = await calculateUserPayroll({
      user: {
        id: ID_GV,
        vai_tro_chinh: 'giang_vien',
        ho_so: { he_so_luong: 2.34, chuc_vu: 'pho_bo_mon', loai_nhan_su: 'giang_vien', loai_hop_dong: 'toan_thoi_gian' },
      },
      month: 10,
      year: 2026,
      configParams: BASE_CONFIG,
      createdBy: ID_KE_TOAN,
    });
    assert.equal(partial.payrollFields.so_cong_thuc_te, 1);
    assert.equal(partial.payrollFields.so_tiet_thuc_day, 3);
    assert.ok(partial.payrollFields.tong_giam_tru > 0);
    assert.equal(partial.payrollFields.so_tiet_nghia_vu, 41); // pho_bo_mon giảm 10% -> round(45*0.9)=41

    // Trường hợp B: Không có bản ghi chấm công nào trong tháng -> 0đ lương & 0đ phụ cấp
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    const zeroDays = await calculateUserPayroll({
      user: {
        id: ID_GV,
        vai_tro_chinh: 'giang_vien',
        ho_so: {
          he_so_luong: 2.34,
          chuc_vu: 'truong_khoa',
          tham_nien_nam: 10,
          loai_nhan_su: 'giang_vien',
          loai_hop_dong: 'toan_thoi_gian',
        },
      },
      month: 10,
      year: 2026,
      configParams: BASE_CONFIG,
      createdBy: ID_KE_TOAN,
    });
    assert.equal(zeroDays.payrollFields.so_cong_thuc_te, 0);
    assert.equal(zeroDays.payrollFields.tong_phu_cap, 0);
    assert.equal(zeroDays.payrollFields.thuc_linh, 0);
    assert.equal(zeroDays.allowances.length, 0);
  });

  it('tính đúng thuế TNCN bậc cao nhất khi DB cấu hình den hữu hạn & nhận diện thỉnh giảng qua loai_nhan_su', async () => {
    // 1. Bậc thuế cuối trong BASE_CONFIG đặt den = 100000000 (hữu hạn): thu nhập 150M vẫn bị đánh 35%
    const pit = calculatePersonalIncomeTax5Brackets(150000000, BASE_CONFIG.bieu_thue_5_bac);
    assert.equal(pit.bracket, 5);
    assert.ok(pit.taxAmount > 0);

    // 2. Thỉnh giảng chỉ đánh dấu qua loai_nhan_su = 'thinh_giang'
    stub(models.NhatKyChamCong, 'findAll', async () => [
      { ngay_cong: '2026-10-08', trang_thai: 'on_time', lich_trinh_id: ID_SCH_1, so_tiet_thuc_day: 40, so_gio_cong: 30, don_tu_id: null },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    const visiting = await calculateUserPayroll({
      user: {
        id: ID_GV,
        vai_tro_chinh: 'giang_vien',
        ho_so: { he_so_luong: 2.34, loai_nhan_su: 'thinh_giang', loai_hop_dong: 'ban_thoi_gian' },
      },
      month: 10,
      year: 2026,
      configParams: BASE_CONFIG,
      createdBy: ID_KE_TOAN,
    });
    assert.equal(visiting.payrollFields.he_so_luong, 0);
    assert.equal(visiting.payrollFields.dong_bao_hiem, 0);
    assert.equal(visiting.payrollFields.tien_vuot_gio, 3600000); // 30h * 120k
    assert.equal(visiting.payrollFields.thue_thu_nhap_ca_nhan, 360000); // 10%
    assert.equal(visiting.payrollFields.thuc_linh, 3240000);

    const formatted = formatPayrollDoc(
      {
        ...visiting.payrollFields,
        nguoi_dung: { ho_so: { loai_nhan_su: 'thinh_giang', loai_hop_dong: 'ban_thoi_gian' } },
      },
      BASE_CONFIG
    );
    assert.equal(formatted.thue_tncn.giam_tru_ban_than, 0);
    assert.equal(formatted.thue_tncn.thu_nhap_tinh_thue, 3600000);
  });

  it('tách chính xác BHXH, BHYT (trần 20 × lương CS) và BHTN (trần 20 × lương tối thiểu vùng)', async () => {
    // Lương chính = 70,840,000 (hệ số 28 * 2,530,000) -> > 50,600,000 trần BHXH/BHYT, < 99,200,000 trần BHTN
    stub(models.NhatKyChamCong, 'findAll', async () => [
      { ngay_cong: '2026-10-10', trang_thai: 'on_time', lich_trinh_id: null, so_tiet_thuc_day: 0, so_gio_cong: 8, don_tu_id: null },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    const highEarn = await calculateUserPayroll({
      user: {
        id: ID_GV,
        vai_tro_chinh: 'nhan_vien',
        ho_so: { he_so_luong: 28, loai_nhan_su: 'nhan_vien', loai_hop_dong: 'toan_thoi_gian' },
      },
      month: 10,
      year: 2026,
      configParams: BASE_CONFIG,
      createdBy: ID_KE_TOAN,
    });

    // BHXH: 50.6M * 8% = 4,048,000 | BHYT: 50.6M * 1.5% = 759,000 | BHTN: 70.84M * 1% = 708,400
    assert.equal(highEarn.payrollFields.dong_bao_hiem, 5515400);

    const formatted = formatPayrollDoc(
      {
        ...highEarn.payrollFields,
        danh_sach_phu_cap: highEarn.allowances,
        nguoi_dung: { ho_so: { loai_nhan_su: 'nhan_vien', loai_hop_dong: 'toan_thoi_gian' } },
      },
      BASE_CONFIG
    );
    assert.equal(formatted.bao_hiem.bhxh, 4048000);
    assert.equal(formatted.bao_hiem.bhyt, 759000);
    assert.equal(formatted.bao_hiem.bhtn, 708400);
    assert.equal(formatted.bao_hiem.tong_bao_hiem, 5515400);
  });
});

describe('Luồng 7 — Generate, Lock/Unlock, Audit & Validation (Service)', () => {
  it('chặn concurrency bằng distributed lock và loại trừ nhân sự da_nghi_viec + validate input', async () => {
    await assert.rejects(
      () => generateMonthlyPayroll({ thang: 13, nam: 2026, currentUser: { id: ID_KE_TOAN, vai_tro_chinh: 'ke_toan' } }),
      (e) => e.statusCode === 400 && e.errorCode === 'INVALID_MONTH'
    );
    await assert.rejects(
      () => generateMonthlyPayroll({ thang: 10, nam: 2026, don_vi_id: 'bad-uuid', currentUser: { id: ID_KE_TOAN, vai_tro_chinh: 'ke_toan' } }),
      (e) => e.statusCode === 400 && e.errorCode === 'INVALID_DEPARTMENT_ID'
    );

    let capturedUserWhere = null;
    let releaseFirstRun;
    const waitFirstRun = new Promise((r) => {
      releaseFirstRun = r;
    });

    stub(models.PhieuLuong, 'count', async () => 0);
    stub(models.NguoiDung, 'findAll', async (opts) => {
      capturedUserWhere = opts?.where;
      await waitFirstRun;
      return [];
    });

    const p1 = generateMonthlyPayroll({ thang: 10, nam: 2026, currentUser: { id: ID_KE_TOAN, vai_tro_chinh: 'ke_toan' } });
    // Đợi microtask để p1 giành được khóa
    await new Promise((r) => setTimeout(r, 15));
    const p2 = generateMonthlyPayroll({ thang: 10, nam: 2026, currentUser: { id: ID_KE_TOAN, vai_tro_chinh: 'ke_toan' } });

    await assert.rejects(p2, (e) => e.statusCode === 409 && e.errorCode === 'PAYROLL_GENERATION_IN_PROGRESS');
    releaseFirstRun();
    await assert.rejects(p1, (e) => e.statusCode === 404);
    assert.ok(capturedUserWhere?.trang_thai_lam_viec);
  });

  it('bảo vệ phiếu da_chi_tra khi khóa và chặn 404 khi mở khóa kỳ chưa khóa', async () => {
    const updateCalls = [];
    const auditLogs = [];

    stub(sequelize, 'transaction', async (_opts, cb) => {
      const fn = typeof _opts === 'function' ? _opts : cb;
      return fn({});
    });
    stub(models.PhieuLuong, 'count', async (opts) => {
      // unlockMonthlyPayroll kiểm tra paidCount (0) -> lockedCount (0)
      if (opts?.where?.trang_thai === 'da_chi_tra') return 0;
      if (opts?.where?.trang_thai === 'da_duyet') return 0;
      return 2;
    });
    stub(models.PhieuLuong, 'update', async (values, opts) => {
      updateCalls.push({ values, where: opts.where });
      return [1];
    });
    stub(models.NhatKyChamCong, 'update', async () => [5]);
    stub(models.NhatKyKiemToan, 'create', async (doc) => {
      auditLogs.push(doc);
      return doc;
    });

    // 1. Khóa sổ không ghi đè phiếu da_chi_tra
    const lockRes = await lockMonthlyPayroll({
      month: 10,
      year: 2026,
      currentUser: { id: ID_BGH, vai_tro_chinh: 'bgh' },
    });
    assert.equal(lockRes.da_khoa, true);
    assert.equal(lockRes.so_phieu_da_khoa, 1);
    assert.ok(updateCalls[0].where.trang_thai);
    assert.equal(auditLogs[0].chi_tiet.don_vi_id, null);

    // 2. Mở khóa kỳ không có phiếu da_duyet -> ném 404 PAYROLL_NOT_LOCKED và không tạo thêm audit log
    await assert.rejects(
      () =>
        unlockMonthlyPayroll({
          month: 10,
          year: 2026,
          reason: 'Điều chỉnh lại phụ cấp',
          currentUser: { id: ID_BGH, vai_tro_chinh: 'bgh' },
        }),
      (e) => e.statusCode === 404 && e.errorCode === 'PAYROLL_NOT_LOCKED'
    );
    assert.equal(auditLogs.length, 1);
  });

  it('khóa đúng 1 phiếu lương theo payrollId mà không khóa lan toàn trường', async () => {
    const payrollWhereCalls = [];
    const attWhereCalls = [];

    stub(sequelize, 'transaction', async (_opts, cb) => {
      const fn = typeof _opts === 'function' ? _opts : cb;
      return fn({});
    });
    stub(models.PhieuLuong, 'findByPk', async (id) => ({
      id,
      nguoi_dung_id: ID_GV,
      thang: 10,
      nam: 2026,
      trang_thai: 'nhap',
    }));
    stub(models.PhieuLuong, 'count', async () => 1);
    stub(models.PhieuLuong, 'update', async (_vals, opts) => {
      payrollWhereCalls.push(opts.where);
      return [1];
    });
    stub(models.NhatKyChamCong, 'update', async (_vals, opts) => {
      attWhereCalls.push(opts.where);
      return [3];
    });
    stub(models.NhatKyKiemToan, 'create', async (doc) => doc);

    const res = await lockMonthlyPayroll({
      payrollId: ID_PAYROLL_1,
      currentUser: { id: ID_KE_TOAN, vai_tro_chinh: 'ke_toan' },
    });
    assert.equal(res.da_khoa, true);
    assert.equal(payrollWhereCalls[0].id, ID_PAYROLL_1);
    assert.deepEqual(attWhereCalls[0].nguoi_dung_id, { [Object.getOwnPropertySymbols(attWhereCalls[0].nguoi_dung_id)[0]]: [ID_GV] });
  });
});

describe('Luồng 7 — Express HTTP Routes, RBAC & Export (End-to-End)', () => {
  const buildUser = (id, role, deptId = ID_DEPT_1) => ({
    id,
    ho_ten: `User ${role}`,
    email: `${role}@ntu.edu.vn`,
    ma_can_bo: role.toUpperCase(),
    vai_tro_chinh: role,
    don_vi_chinh_id: deptId,
    kich_hoat: true,
    trang_thai_lam_viec: 'dang_lam_viec',
    danh_sach_vai_tro: [],
  });

  it('kiểm tra RBAC chặt trên routes (/khoi-tao, /tong-hop, /xuat-excel, /cua-toi)', async () => {
    const usersMap = {
      [ID_ADMIN]: buildUser(ID_ADMIN, 'admin'),
      [ID_KE_TOAN]: buildUser(ID_KE_TOAN, 'ke_toan'),
      [ID_BGH]: buildUser(ID_BGH, 'bgh'),
      [ID_DEAN]: buildUser(ID_DEAN, 'truong_khoa'),
      [ID_KIEM_TOAN]: buildUser(ID_KIEM_TOAN, 'kiem_toan'),
    };
    stub(models.NguoiDung, 'findByPk', async (id) => usersMap[String(id)] || null);

    const app = createPayrollApp();

    // 1. kiem_toan bị chặn 403 trên tất cả API bảng lương
    const resAuditList = await injectRequest(app, {
      method: 'GET',
      url: '/api/phieu-luong',
      headers: { authorization: `Bearer ${makeToken(ID_KIEM_TOAN, 'kiem_toan')}` },
    });
    assert.equal(resAuditList.status, 403);

    // 2. truong_khoa & bgh không có LUONG:LAP_BANG -> bị chặn 403 ở POST /khoi-tao
    const resDeanInit = await injectRequest(app, {
      method: 'POST',
      url: '/api/phieu-luong/khoi-tao',
      headers: { authorization: `Bearer ${makeToken(ID_DEAN, 'truong_khoa')}` },
      body: { thang: 10, nam: 2026 },
    });
    assert.equal(resDeanInit.status, 403);

    const resBghInit = await injectRequest(app, {
      method: 'POST',
      url: '/api/phieu-luong/khoi-tao',
      headers: { authorization: `Bearer ${makeToken(ID_BGH, 'bgh')}` },
      body: { thang: 10, nam: 2026 },
    });
    assert.equal(resBghInit.status, 403);

    // 3. GET /cua-toi với truong_khoa truyền đúng req.user.id (không lộ phiếu của người khác) & trả null khi chưa có phiếu
    const whereCaptured = [];
    stub(models.CauHinhHeThong, 'findAll', async () => []);
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAll', async () => []);
    stub(models.PhieuLuong, 'findAll', async (opts) => {
      whereCaptured.push(opts.where);
      return [];
    });

    const resMyDean = await injectRequest(app, {
      method: 'GET',
      url: '/api/phieu-luong/cua-toi?thang=10&nam=2026',
      headers: { authorization: `Bearer ${makeToken(ID_DEAN, 'truong_khoa')}` },
    });
    assert.equal(resMyDean.status, 200);
    assert.equal(resMyDean.body.data, null);
    assert.equal(whereCaptured[0].nguoi_dung_id, ID_DEAN);
  });

  it('trả về tổng hợp đúng trạng thái khóa một phần & xuất Excel chuẩn snake_case có sanitize', async () => {
    const usersMap = { [ID_KE_TOAN]: buildUser(ID_KE_TOAN, 'ke_toan') };
    stub(models.NguoiDung, 'findByPk', async (id) => usersMap[String(id)] || null);
    stub(models.NguoiDung, 'findAll', async () => [{ id: ID_GV }]);
    stub(models.PhongBan, 'findAll', async () => [{ id: ID_DEPT_CHILD }]);
    stub(models.CauHinhHeThong, 'findAll', async () => []);

    const sampleDocs = [
      {
        id: ID_PAYROLL_1,
        nguoi_dung_id: ID_GV,
        thang: 10,
        nam: 2026,
        luong_co_ban: 2530000,
        he_so_luong: 2.34,
        tong_phu_cap: 1776060,
        tong_giam_tru: 0,
        tien_vuot_gio: 0,
        dong_bao_hiem: 621621,
        thue_thu_nhap_ca_nhan: 0,
        thuc_linh: 7074639,
        trang_thai: 'da_duyet',
        danh_sach_phu_cap: [],
        nguoi_dung: {
          id: ID_GV,
          ho_ten: '=CMD("evil")',
          ma_can_bo: 'GV001',
          vai_tro_chinh: 'giang_vien',
          don_vi_chinh: { id: ID_DEPT_1, ten_phong_ban: 'Khoa CNTT' },
          ho_so: { loai_hop_dong: 'toan_thoi_gian', loai_nhan_su: 'giang_vien' },
        },
      },
      {
        id: ID_PAYROLL_2,
        nguoi_dung_id: ID_DEAN,
        thang: 10,
        nam: 2026,
        luong_co_ban: 2530000,
        he_so_luong: 4.4,
        tong_phu_cap: 0,
        tong_giam_tru: 0,
        tien_vuot_gio: 0,
        dong_bao_hiem: 1168860,
        thue_thu_nhap_ca_nhan: 0,
        thuc_linh: 9963140,
        trang_thai: 'nhap',
        danh_sach_phu_cap: [],
        nguoi_dung: {
          id: ID_DEAN,
          ho_ten: 'Trưởng khoa B',
          ma_can_bo: 'TK001',
          vai_tro_chinh: 'truong_khoa',
          don_vi_chinh: { id: ID_DEPT_CHILD, ten_phong_ban: 'Bộ môn AI' },
          ho_so: { loai_hop_dong: 'toan_thoi_gian', loai_nhan_su: 'giang_vien' },
        },
      },
    ];
    stub(models.PhieuLuong, 'findAll', async () => sampleDocs);

    const app = createPayrollApp();
    const token = makeToken(ID_KE_TOAN, 'ke_toan');

    const resSummary = await injectRequest(app, {
      method: 'GET',
      url: `/api/phieu-luong/tong-hop?thang=10&nam=2026&don_vi_id=${ID_DEPT_1}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resSummary.status, 200);
    assert.equal(resSummary.body.data.tong_ban_ghi, 2);
    assert.equal(resSummary.body.data.so_phieu_da_khoa, 1);
    assert.equal(resSummary.body.data.da_khoa, false);
    assert.equal(resSummary.body.data.da_khoa_mot_phan, true);

    const resExcel = await injectRequest(app, {
      method: 'GET',
      url: '/api/phieu-luong/xuat-excel?thang=10&nam=2026',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resExcel.status, 200);
    assert.equal(resExcel.body.data.tong_nhan_su, 2);
    assert.equal(resExcel.body.data.rows[0].ho_ten, "'=CMD(\"evil\")");
    assert.equal(resExcel.body.data.rows[0].thuc_linh_net, 7074639);
  });
});
