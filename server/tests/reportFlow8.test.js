// Kiểm thử trọng tâm Luồng 8 (Báo cáo chuyên cần, Xu hướng tuần, Phân quyền, Xuất Excel 5 Sheets & Formula Injection).
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';

const models = require('../models');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const baoCaoRoutes = require('../routes/baoCao.routes');
const {
  getRoleLabel,
  getMethodLabel,
  getLeaveStatusLabel,
  sanitizeExcelRow,
} = require('../services/baoCao/dinhDangBaoCao.helper');
const {
  getAttendanceReportData,
  generateMonthlyReport,
  getMonthlyReportData,
} = require('../services/baoCao/baoCao.service');
const {
  generateExportReportData,
  getExportReportDataForUser,
} = require('../services/baoCao/xuatBaoCaoExcel.service');

const ID_ADMIN = '11111111-1111-4111-8111-111111111111';
const ID_TCCB = '22222222-2222-4222-8222-222222222222';
const ID_DEAN = '33333333-3333-4333-8333-333333333333';
const ID_GV_1 = '44444444-4444-4444-8444-444444444444';
const ID_GV_2 = '55555555-5555-4555-8555-555555555555';
const ID_KIEM_TOAN = '66666666-6666-4666-8666-666666666666';
const ID_DEPT_KHOA = '77777777-7777-4777-8777-777777777777';
const ID_DEPT_BO_MON = '88888888-8888-4888-8888-888888888888';
const ID_DEPT_OUTSIDE = '99999999-9999-4999-8999-999999999999';
const ID_REQ_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_REQ_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

const createReportApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/bao-cao', baoCaoRoutes);
  app.use(errorHandler);
  return app;
};

const dispatchExpress = (app, { method = 'GET', url, headers = {} }) => {
  const reqHeaders = {};
  for (const [k, v] of Object.entries(headers)) reqHeaders[k.toLowerCase()] = v;

  return new Promise((resolve) => {
    const socket = new Readable({ read() {} });
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.complete = true;
    req.headers = reqHeaders;
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
      } catch {
        json = text;
      }
      resolve({ status: res.statusCode, body: json });
    };
    app(req, res);
  });
};

const makeToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Luồng 8 — Helpers & Chống crash P0', () => {
  it('getRoleLabel không crash ReferenceError(normalizeRole) và nhận diện đủ nhãn chuẩn', () => {
    assert.equal(getRoleLabel('admin'), 'Quản trị viên');
    assert.equal(getRoleLabel('truong_khoa'), 'Trưởng Khoa');
    assert.equal(getRoleLabel('quan_ly_xe'), 'Quản lý xe');
    assert.equal(getMethodLabel('system_auto'), 'Hệ thống tự động');
    assert.equal(getLeaveStatusLabel('cancelled'), 'Đã hủy');
    assert.equal(getLeaveStatusLabel('pending_bgh'), 'Chờ duyệt');
  });

  it('sanitizeExcelRow chặn Formula Injection các ký tự đầu =, +, -, @, tab, CR', () => {
    const clean = sanitizeExcelRow({
      ho_ten: '=CMD("calc")',
      ly_do: '+SUM(A1:A2)',
      ghi_chu: '@HYPERLINK("x")',
      ngay: '-01',
      so_ca: 12,
    });
    assert.equal(clean.ho_ten, "'=CMD(\"calc\")");
    assert.equal(clean.ly_do, "'+SUM(A1:A2)");
    assert.equal(clean.ghi_chu, "'@HYPERLINK(\"x\")");
    assert.equal(clean.ngay, "'-01");
    assert.equal(clean.so_ca, 12);
  });
});

describe('Luồng 8 — Ngày công hồi tố, so_phut_lech, Phân trang & Đa tháng', () => {
  it('ưu tiên ngay_cong khi duyệt đơn hồi tố sang tháng sau và dùng di_muon_phut/ve_som_phut trong Sheet 3', async () => {
    stub(models.PhongBan, 'findAll', async () => [
      { id: ID_DEPT_KHOA, ten_phong_ban: 'Khoa CNTT', don_vi_cha_id: null },
    ]);
    stub(models.NguoiDung, 'findAll', async () => [
      {
        id: ID_GV_1,
        ho_ten: '=HYPERLINK("http://evil")',
        ma_can_bo: 'GV001',
        email: 'gv1@ntu.edu.vn',
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: ID_DEPT_KHOA,
        danh_sach_vai_tro: [],
      },
      {
        id: ID_GV_2,
        ho_ten: 'GV B (0 ca)',
        ma_can_bo: 'GV002',
        email: 'gv2@ntu.edu.vn',
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: ID_DEPT_KHOA,
        danh_sach_vai_tro: [],
      },
    ]);
    stub(models.NhatKyChamCong, 'findAll', async () => [
      {
        id: 'log-retro',
        nguoi_dung_id: ID_GV_1,
        ngay_cong: '2026-03-28',
        tao_luc: '2026-04-02T09:00:00.000Z',
        thoi_gian_vao: null,
        thoi_gian_ra: null,
        trang_thai: 'excused_absence',
        di_muon_phut: 0,
        ve_som_phut: 0,
        nguoi_dung: {
          id: ID_GV_1,
          ho_ten: '=HYPERLINK("http://evil")',
          ma_can_bo: 'GV001',
          don_vi_chinh_id: ID_DEPT_KHOA,
        },
        ca: { ten_ca: 'Ca Sáng', gio_bat_dau: '07:30', gio_ket_thuc: '11:30' },
        luot_quet: [],
      },
      {
        id: 'log-block',
        nguoi_dung_id: ID_GV_1,
        ngay_cong: '2026-03-10',
        tao_luc: '2026-03-10T07:48:00.000Z',
        thoi_gian_vao: '2026-03-10T00:48:00.000Z',
        thoi_gian_ra: '2026-03-10T04:00:00.000Z',
        trang_thai: 'late',
        di_muon_phut: 18,
        ve_som_phut: 0,
        nguoi_dung: {
          id: ID_GV_1,
          ho_ten: '=HYPERLINK("http://evil")',
          ma_can_bo: 'GV001',
          don_vi_chinh_id: ID_DEPT_KHOA,
        },
        ca: { ten_ca: 'Khối ca 1-2', gio_bat_dau: '07:30', gio_ket_thuc: '09:30' },
        luot_quet: [{ phuong_thuc: 'face_ai', do_tin_cay_ai: 0.92 }],
      },
      {
        id: 'log-missing',
        nguoi_dung_id: ID_GV_1,
        ngay_cong: '2026-03-11',
        tao_luc: '2026-03-11T00:30:00.000Z',
        thoi_gian_vao: '2026-03-11T00:30:00.000Z',
        thoi_gian_ra: null,
        trang_thai: 'thieu_check_out',
        di_muon_phut: 0,
        ve_som_phut: 0,
        nguoi_dung: {
          id: ID_GV_1,
          ho_ten: '=HYPERLINK("http://evil")',
          ma_can_bo: 'GV001',
          don_vi_chinh_id: ID_DEPT_KHOA,
        },
        ca: { ten_ca: 'Ca Sáng', gio_bat_dau: '07:30', gio_ket_thuc: '11:30' },
        luot_quet: [{ phuong_thuc: 'qr_code' }],
      },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => [
      {
        id: ID_REQ_1,
        nguoi_dung_id: ID_GV_1,
        loai_don: 'day_bu',
        ngay_bat_dau: '2026-03-29',
        ngay_ket_thuc: '2026-03-29',
        so_ngay: 0,
        ly_do: '+DayBu',
        trang_thai: 'cancelled',
        cap_nhat_luc: '2026-03-29T08:00:00.000Z',
        nguoi_dung: { id: ID_GV_1, ho_ten: 'GV 1', don_vi_chinh_id: ID_DEPT_KHOA },
        nguoi_duyet: null,
      },
      {
        id: ID_REQ_2,
        nguoi_dung_id: ID_GV_1,
        loai_don: 'nghi_phep',
        ngay_bat_dau: '2026-03-28',
        ngay_ket_thuc: '2026-03-28',
        so_ngay: 1,
        ly_do: 'Nghỉ phép',
        trang_thai: 'approved',
        thoi_gian_duyet: '2026-04-02T09:00:00.000Z',
        nguoi_dung: { id: ID_GV_1, ho_ten: 'GV 1', don_vi_chinh_id: ID_DEPT_KHOA },
        nguoi_duyet: { ho_ten: 'Trưởng khoa' },
      },
    ]);

    const res = await generateExportReportData({ month: 3, year: 2026 });

    // Sheet 1: không sinh ngày 02/04 vào thống kê tháng 3 & tính đúng thiếu check-out
    assert.equal(res.tong_quan.so_lan_thieu_check_out, 1);
    assert.equal(res.thong_ke_theo_ngay.some((d) => d.ngay === '02/04/2026'), false);
    const day28 = res.thong_ke_theo_ngay.find((d) => d.ngay === '28/03/2026');
    assert.equal(day28.so_lan_co_phep, 1);

    // Sheet 2: dùng ma_can_bo thật, sanitize công thức, và 0 ca => 0%
    assert.equal(res.thong_ke_nhan_su[0].ma_can_bo, 'GV001');
    assert.equal(res.thong_ke_nhan_su[0].ho_ten, "'=HYPERLINK(\"http://evil\")");
    assert.equal(res.thong_ke_nhan_su[0].so_lan_thieu_check_out, 1);
    assert.equal(res.thong_ke_nhan_su[1].ty_le_chuyen_can, 0);

    // Sheet 3: ưu tiên ngay_cong, lấy di_muon_phut=18 và xử lý thieu_check_out
    const retroRow = res.nhat_ky_cham_cong.find((r) => r.ngay === '28/03/2026');
    assert.ok(retroRow);
    assert.equal(retroRow.ma_can_bo, 'GV001');
    const lateRow = res.nhat_ky_cham_cong.find((r) => r.ma_trang_thai === 'late');
    assert.equal(lateRow.so_phut_lech, 'Muộn 18 phút');
    const missingRow = res.nhat_ky_cham_cong.find((r) => r.ma_trang_thai === 'thieu_check_out');
    assert.equal(missingRow.so_phut_lech, 'Thiếu check-out');

    // Sheet 4: giữ nguyên so_ngay = 0 cho day_bu, hiển thị Đã hủy cho cancelled & sanitize lý do
    const cancelledRow = res.don_nghi_phep.find((r) => r.ma_trang_thai === 'cancelled');
    assert.equal(cancelledRow.so_ngay, 0);
    assert.equal(cancelledRow.trang_thai, 'Đã hủy');
    assert.equal(cancelledRow.ly_do, "'+DayBu");
    assert.ok(cancelledRow.ghi_chu_duyet.startsWith('Đã hủy'));
  });

  it('generateMonthlyReport tính weeklyTrend trên toàn bộ eligibleUsers dù phân trang limit=1', async () => {
    stub(models.PhongBan, 'findAll', async () => [{ id: ID_DEPT_KHOA, ten_phong_ban: 'Khoa CNTT', don_vi_cha_id: null }]);
    stub(models.NguoiDung, 'findAll', async () => [
      { id: ID_GV_1, ho_ten: 'An', email: 'a@ntu.edu.vn', vai_tro_chinh: 'giang_vien', don_vi_chinh_id: ID_DEPT_KHOA, danh_sach_vai_tro: [] },
      { id: ID_GV_2, ho_ten: 'Bình', email: 'b@ntu.edu.vn', vai_tro_chinh: 'giang_vien', don_vi_chinh_id: ID_DEPT_KHOA, danh_sach_vai_tro: [] },
    ]);
    stub(models.NhatKyChamCong, 'findAll', async () => [
      { id: '1', nguoi_dung_id: ID_GV_1, ngay_cong: '2026-10-02', trang_thai: 'on_time' },
      { id: '2', nguoi_dung_id: ID_GV_2, ngay_cong: '2026-10-03', trang_thai: 'late' },
    ]);

    const res = await generateMonthlyReport(10, 2026, null, { page: 1, limit: 1 });
    assert.equal(res.totalUsers, 2);
    assert.equal(res.report.length, 1); // chỉ trang 1 (1 người)
    assert.equal(res.weeklyTrend[0].total, 2); // weeklyTrend vẫn đủ 2 lượt của cả 2 người
    assert.equal(res.weeklyTrend[0].onTime, 1);
    assert.equal(res.weeklyTrend[0].late, 1);
  });

  it('getAttendanceReportData hỗ trợ khoảng thời gian nhiều tháng trong weeklyTrend & holidaySet min/max', async () => {
    stub(models.NguoiDung, 'findAll', async () => [
      { id: ID_GV_1, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
    ]);
    stub(models.NhatKyChamCong, 'findAll', async () => [
      { ngay_cong: '2026-09-02', trang_thai: 'on_time' },
      { ngay_cong: '2026-10-05', trang_thai: 'late' },
    ]);
    let capturedHolidayRange = null;
    stub(models.NgayNghiLe, 'findAll', async (opts) => {
      capturedHolidayRange = opts?.where;
      return [];
    });
    stub(models.DonNghiPhep, 'findAll', async () => [
      { ngay_bat_dau: '2026-08-31', ngay_ket_thuc: '2026-09-02', so_ngay: 3 },
      { ngay_bat_dau: '2026-10-05', ngay_ket_thuc: '2026-10-10', so_ngay: 5 },
    ]);

    const res = await getAttendanceReportData({
      tu_ngay: '2026-09-01',
      den_ngay: '2026-10-10',
      currentUser: { id: ID_ADMIN, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
    });
    const totalTrendLogs = res.weeklyTrend.reduce((s, w) => s + w.total, 0);
    assert.equal(totalTrendLogs, 2); // không rơi mất bản ghi tháng 10
    assert.ok(capturedHolidayRange);
  });
});

describe('Luồng 8 — RBAC Routes & Phạm vi Trưởng khoa lọc đơn vị con', () => {
  it('RBAC routes khớp permissions.js (tccb, kiem_toan vào /hang-thang; chặn nhân viên thường) & validate UUID 400', async () => {
    const users = {
      [ID_TCCB]: { id: ID_TCCB, vai_tro_chinh: 'tccb', don_vi_chinh_id: null, kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec', danh_sach_vai_tro: [] },
      [ID_KIEM_TOAN]: { id: ID_KIEM_TOAN, vai_tro_chinh: 'kiem_toan', don_vi_chinh_id: null, kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec', danh_sach_vai_tro: [] },
      [ID_GV_1]: { id: ID_GV_1, vai_tro_chinh: 'giang_vien', don_vi_chinh_id: ID_DEPT_KHOA, kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec', danh_sach_vai_tro: [] },
    };
    stub(models.NguoiDung, 'findByPk', async (id) => users[String(id)] || null);
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'findAll', async () => []);

    const app = createReportApp();

    // 1. Giảng viên thường không có CONG_XEM_DON_VI/TOAN_TRUONG -> 403 trên /hang-thang
    const resGvMonthly = await dispatchExpress(app, {
      url: '/api/bao-cao/hang-thang?thang=10&nam=2026',
      headers: { authorization: `Bearer ${makeToken(ID_GV_1, 'giang_vien')}` },
    });
    assert.equal(resGvMonthly.status, 403);

    // 2. TCCB và Kiểm toán có CONG_XEM_TOAN_TRUONG -> 200 trên /hang-thang
    const resTccbMonthly = await dispatchExpress(app, {
      url: '/api/bao-cao/hang-thang?thang=10&nam=2026',
      headers: { authorization: `Bearer ${makeToken(ID_TCCB, 'tccb')}` },
    });
    assert.equal(resTccbMonthly.status, 200);

    const resAuditMonthly = await dispatchExpress(app, {
      url: '/api/bao-cao/hang-thang?thang=10&nam=2026',
      headers: { authorization: `Bearer ${makeToken(ID_KIEM_TOAN, 'kiem_toan')}` },
    });
    assert.equal(resAuditMonthly.status, 200);

    // 3. Truyền don_vi_id sai định dạng UUID -> trả 400 (không crash 500 SQL)
    const resBadUuid = await dispatchExpress(app, {
      url: '/api/bao-cao/du-lieu-xuat?don_vi_id=invalid-uuid',
      headers: { authorization: `Bearer ${makeToken(ID_TCCB, 'tccb')}` },
    });
    assert.equal(resBadUuid.status, 400);
  });

  it('Trưởng khoa lọc được theo bộ môn con trong khoa ở cả /cham-cong lẫn /du-lieu-xuat và bị chặn 403 ngoài khoa', async () => {
    const deanUser = {
      id: ID_DEAN,
      vai_tro_chinh: 'truong_khoa',
      don_vi_chinh_id: ID_DEPT_KHOA,
      danh_sach_vai_tro: [],
    };
    stub(models.PhongBan, 'findAll', async (opts) => {
      if (opts?.where?.don_vi_cha_id) {
        const parents = Array.isArray(opts.where.don_vi_cha_id[Object.getOwnPropertySymbols(opts.where.don_vi_cha_id)[0]])
          ? opts.where.don_vi_cha_id[Object.getOwnPropertySymbols(opts.where.don_vi_cha_id)[0]]
          : [opts.where.don_vi_cha_id];
        if (parents.map(String).includes(ID_DEPT_KHOA)) {
          return [{ id: ID_DEPT_BO_MON, ten_phong_ban: 'Bộ môn AI', don_vi_cha_id: ID_DEPT_KHOA }];
        }
        return [];
      }
      return [
        { id: ID_DEPT_KHOA, ten_phong_ban: 'Khoa CNTT', don_vi_cha_id: null },
        { id: ID_DEPT_BO_MON, ten_phong_ban: 'Bộ môn AI', don_vi_cha_id: ID_DEPT_KHOA },
      ];
    });

    const userWhereCaptured = [];
    stub(models.NguoiDung, 'findAll', async (opts) => {
      userWhereCaptured.push(opts.where);
      return [
        { id: ID_GV_2, ho_ten: 'GV Bộ môn AI', email: 'ai@ntu.edu.vn', vai_tro_chinh: 'giang_vien', don_vi_chinh_id: ID_DEPT_BO_MON, danh_sach_vai_tro: [] },
      ];
    });
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    // 1. Bộ môn AI nằm trong Khoa CNTT -> được phép xuất & userWhere phải có don_vi_chinh_id chỉ chứa Bộ môn AI
    const exportSub = await getExportReportDataForUser({
      query: { thang: 10, nam: 2026, don_vi_id: ID_DEPT_BO_MON },
      currentUser: deanUser,
    });
    assert.equal(exportSub.tong_quan.tong_so_nhan_su, 1);
    assert.equal(exportSub.tong_quan.don_vi, 'Bộ môn AI');
    const exportWhere = userWhereCaptured.find((w) => w?.don_vi_chinh_id && w?.trang_thai_lam_viec);
    assert.ok(exportWhere);
    const opInSym = Object.getOwnPropertySymbols(exportWhere.don_vi_chinh_id)[0];
    assert.deepEqual(exportWhere.don_vi_chinh_id[opInSym], [ID_DEPT_BO_MON]);

    // 2. Truy vấn ngoài khoa -> ném 403 ở cả 3 nhánh
    await assert.rejects(
      () => getAttendanceReportData({ don_vi_id: ID_DEPT_OUTSIDE, currentUser: deanUser }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => getMonthlyReportData({ thang: 10, nam: 2026, don_vi_id: ID_DEPT_OUTSIDE, currentUser: deanUser }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => getExportReportDataForUser({ query: { thang: 10, nam: 2026, don_vi_id: ID_DEPT_OUTSIDE }, currentUser: deanUser }),
      (e) => e.statusCode === 403
    );
  });
});
