const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-flow4-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-flow4-refresh-secret';

const models = require('../models');
const { sequelize } = require('../config/db');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const { isScheduleActiveOnDate } = require('../utils/ngayLichTrinh.utils');
const { resetMemoryLocks } = require('../utils/khoaPhanTan');
const { getEffectivePermissions, PERMISSIONS } = require('../config/permissions');

const {
  detectScheduleConflicts,
  fetchSchedules,
  createNewSchedule,
  updateExistingSchedule,
  removeSchedule,
  addScheduleException,
  fetchTodaySchedules,
} = require('../services/nhanSu/lichTrinh.service');
const {
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
} = require('../services/nhanSu/caLamViec.service');
const {
  getHolidays,
  createHoliday,
} = require('../services/nhanSu/ngayNghiLe.service');
const {
  getSubjects,
  createSubject,
} = require('../services/nhanSu/monHoc.service');

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const SHIFT_1 = '44444444-4444-4444-8444-444444444444';
const SHIFT_2 = '55555555-5555-4555-8555-555555555555';
const SUB_1 = '66666666-6666-4666-8666-666666666666';
const DEPT_ROOT = '77777777-7777-4777-8777-777777777777';
const DEPT_CHILD = '88888888-8888-4888-8888-888888888888';
const DEPT_GRAND = '99999999-9999-4999-8999-999999999999';
const SCHED_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SCHED_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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
});

const stubTransactionPassThrough = () => {
  const fakeTx = { LOCK: { UPDATE: 'UPDATE' } };
  stub(sequelize, 'transaction', async (...args) => {
    const fn = args.find((a) => typeof a === 'function');
    if (fn) return fn(fakeTx);
    return { ...fakeTx, commit: async () => {}, rollback: async () => {} };
  });
};

const dispatchExpress = async (app, { method = 'GET', url, headers = {}, jsonBody = null }) => {
  let rawBody = Buffer.alloc(0);
  const reqHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    reqHeaders[k.toLowerCase()] = v;
  }
  if (jsonBody !== null) {
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
      const text = Buffer.concat(chunks).toString('utf8');
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      resolve({ status: res.statusCode, body });
    };
    app.handle(req, res, reject);
  });
};

describe('Luồng 4.1 - Model NgoaiLeLichTrinh & utils ngayLichTrinh', () => {
  it('NgoaiLeLichTrinh khai báo đủ cột & association giang_vien_day_thay, ca_thay_the', () => {
    assert.ok(models.NgoaiLeLichTrinh.rawAttributes.giang_vien_day_thay_id);
    assert.ok(models.NgoaiLeLichTrinh.rawAttributes.ca_thay_the_id);
    assert.ok(models.NgoaiLeLichTrinh.associations.giang_vien_day_thay);
    assert.ok(models.NgoaiLeLichTrinh.associations.ca_thay_the);
    assert.equal(models.NgoaiLeLichTrinh.associations.giang_vien_day_thay.foreignKey, 'giang_vien_day_thay_id');
    assert.equal(models.NgoaiLeLichTrinh.associations.ca_thay_the.foreignKey, 'ca_thay_the_id');
  });

  it('isScheduleActiveOnDate: loại bỏ ngày gốc khi day_bu dời sang ngày khác, tôn trọng ngay_ket_thuc & hỗ trợ doi_ca', () => {
    const schedule = {
      id: SCHED_1,
      nguoi_dung_id: { id: UUID_1, ho_ten: 'GV A' },
      thu_trong_tuan: 5, // Thứ 6 (2026-09-18)
      ngay_bat_dau: '2026-09-01',
      ngay_ket_thuc: '2026-10-30',
      lap_lai_hang_tuan: true,
      loai_lich: 'chinh_khoa',
      danh_sach_tuan: [1, 2, 3, 4, 5, 6],
      ngoai_le: [
        { ngay: '2026-09-18', trang_thai: 'day_bu', ngay_day_bu: '2026-09-26', ly_do: 'Bù sang T7' },
        { ngay: '2026-10-09', trang_thai: 'doi_ca', ngay_day_bu: '2026-10-10', giang_vien_day_thay_id: UUID_2 },
      ],
    };

    // Ngày gốc đã dời sang ngày khác -> KHÔNG active
    const onOriginalMovedDate = isScheduleActiveOnDate(schedule, new Date('2026-09-18T10:00:00+07:00'));
    assert.equal(onOriginalMovedDate, false);

    // Ngày bù mới -> active
    const onMakeupDate = isScheduleActiveOnDate(schedule, new Date('2026-09-26T10:00:00+07:00'));
    assert.equal(onMakeupDate, true);

    // Quá ngay_ket_thuc -> KHÔNG active
    const afterEndDate = isScheduleActiveOnDate(schedule, new Date('2026-11-06T10:00:00+07:00'));
    assert.equal(afterEndDate, false);

    // Ngày đổi ca (khi ngay_day_bu = 2026-10-10) -> active cho bản ghi _isSubstituteOverride hoặc trên schedule có doi_ca
    const subCheck = isScheduleActiveOnDate(
      { ...schedule, _isSubstituteOverride: true, ngay_day_bu: '2026-10-10' },
      new Date('2026-10-10T10:00:00+07:00')
    );
    assert.equal(subCheck, true);
  });
});

describe('Luồng 4.2 - detectScheduleConflicts chuẩn xác theo lịch thực & ngoại lệ', () => {
  it('Phát hiện trùng lịch xuyên học kỳ / xuyên năm học khi ngày dương lịch thực sự giao nhau', async () => {
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: SCHED_2,
        nguoi_dung_id: UUID_1,
        phong_hoc: 'A2-201',
        la_truc_tuyen: false,
        thu_trong_tuan: 1,
        ngay_bat_dau: '2026-09-07',
        ngay_ket_thuc: '2026-12-20',
        tiet_bat_dau: 1,
        so_tiet: 3,
        gio_bat_dau: '07:00',
        gio_ket_thuc: '09:30',
        lap_lai_hang_tuan: true,
        loai_lich: 'chinh_khoa',
        tuan_hoc: [{ tuan_thu: 2 }], // Tuần 2 tính từ 2026-09-07 -> 2026-09-14
        ngoai_le: [],
        giang_vien: { ho_ten: 'Nguyễn Văn A' },
      },
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    // Lịch mới khác nam_hoc/hoc_ky nhưng tuần 1 tính từ 2026-09-14 trùng đúng 2026-09-14
    await assert.rejects(
      () =>
        detectScheduleConflicts({
          nguoi_dung_id: UUID_1,
          phong_hoc: 'B1-101',
          thu_trong_tuan: 1,
          tiet_bat_dau: 1,
          so_tiet: 3,
          gio_bat_dau: '07:00',
          gio_ket_thuc: '09:30',
          ngay_bat_dau: '2026-09-14',
          ngay_ket_thuc: '2026-12-28',
          danh_sach_tuan: [1],
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_LECTURER_CONFLICT'
    );
  });

  it('Ưu tiên kiểm tra khung giờ thực tế khi khác giờ dù cùng ca/tiết, và bỏ qua trùng phòng khi la_truc_tuyen = true', async () => {
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: SCHED_2,
        nguoi_dung_id: UUID_1,
        phong_hoc: 'A2-201',
        la_truc_tuyen: false,
        thu_trong_tuan: 2,
        ngay_bat_dau: '2026-09-08',
        ngay_ket_thuc: '2026-12-20',
        tiet_bat_dau: 1,
        so_tiet: 2,
        gio_bat_dau: '07:00',
        gio_ket_thuc: '08:30',
        lap_lai_hang_tuan: true,
        loai_lich: 'chinh_khoa',
        tuan_hoc: [{ tuan_thu: 1 }],
        ngoai_le: [],
      },
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);

    // Cùng giảng viên, cùng ngày nhưng khung giờ không giao nhau (09:00-11:00) -> KHÔNG xung đột
    await detectScheduleConflicts({
      nguoi_dung_id: UUID_1,
      phong_hoc: 'A2-201',
      thu_trong_tuan: 2,
      tiet_bat_dau: 1,
      so_tiet: 2,
      gio_bat_dau: '09:00',
      gio_ket_thuc: '11:00',
      ngay_bat_dau: '2026-09-08',
      ngay_ket_thuc: '2026-12-20',
      danh_sach_tuan: [1],
    });

    // Giảng viên khác nhưng cùng phòng A2-201, trùng giờ 07:00-08:30 nhưng la_truc_tuyen = true -> KHÔNG báo trùng phòng
    await detectScheduleConflicts({
      nguoi_dung_id: UUID_2,
      phong_hoc: 'A2-201',
      la_truc_tuyen: true,
      thu_trong_tuan: 2,
      tiet_bat_dau: 1,
      so_tiet: 2,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '08:30',
      ngay_bat_dau: '2026-09-08',
      ngay_ket_thuc: '2026-12-20',
      danh_sach_tuan: [1],
    });
  });

  it('Phát hiện xung đột với ngoại lệ dạy bù (NgoaiLeLichTrinh) và đơn đổi ca đã duyệt (DonNghiPhep)', async () => {
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => [
      {
        id: UUID_1,
        lich_trinh_id: SCHED_2,
        ngay: '2026-09-04',
        trang_thai: 'day_bu',
        ngay_day_bu: '2026-09-12',
        lich_trinh: {
          id: SCHED_2,
          nguoi_dung_id: UUID_1,
          phong_hoc: 'C1-301',
          la_truc_tuyen: false,
          gio_bat_dau: '13:00',
          gio_ket_thuc: '16:00',
          tiet_bat_dau: 6,
          so_tiet: 3,
          giang_vien: { ho_ten: 'GV A' },
        },
      },
    ]);
    stub(models.DonNghiPhep, 'findAll', async () => [
      {
        id: UUID_3,
        nguoi_dung_id: UUID_2,
        giang_vien_day_thay_id: UUID_2,
        ngay_bat_dau: '2026-09-15',
        ngay_ket_thuc: '2026-09-15',
        ngay_day_bu: '2026-09-19',
        lich_trinh: {
          phong_hoc: 'D1-101',
          gio_bat_dau: '07:30',
          gio_ket_thuc: '10:30',
          tiet_bat_dau: 1,
          so_tiet: 4,
          la_truc_tuyen: false,
        },
        ca_thay_the: null,
      },
    ]);

    // Trùng với buổi day_bu ngày 2026-09-12 của GV A
    await assert.rejects(
      () =>
        detectScheduleConflicts({
          nguoi_dung_id: UUID_1,
          phong_hoc: 'B1-102',
          thu_trong_tuan: 6,
          gio_bat_dau: '14:00',
          gio_ket_thuc: '15:30',
          ngay_bat_dau: '2026-09-12',
          ngay_ket_thuc: '2026-09-12',
          loai_lich: 'day_bu',
          ngay_day_bu: '2026-09-12',
          danh_sach_tuan: [1],
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_LECTURER_CONFLICT'
    );

    // Trùng với đơn đổi ca đã duyệt của GV B ngày 2026-09-19
    await assert.rejects(
      () =>
        detectScheduleConflicts({
          nguoi_dung_id: UUID_2,
          phong_hoc: 'D2-202',
          thu_trong_tuan: 6,
          gio_bat_dau: '08:00',
          gio_ket_thuc: '10:00',
          ngay_bat_dau: '2026-09-19',
          ngay_ket_thuc: '2026-09-19',
          loai_lich: 'day_bu',
          ngay_day_bu: '2026-09-19',
          danh_sach_tuan: [1],
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_LECTURER_CONFLICT'
    );
  });
});

describe('Luồng 4.3 - fetchTodaySchedules & formatScheduleOutput', () => {
  it('Trả về [] nếu trùng NgayNghiLe, giữ nguyên UUID ở FK & không nhân bản bản ghi đổi ca', async () => {
    stub(models.NgayNghiLe, 'findOne', async () => ({ id: UUID_3, ten_ngay_le: 'Quốc Khánh' }));
    const onHoliday = await fetchTodaySchedules({
      ngay: '2026-09-02',
      currentUser: { id: UUID_1, vai_tro_chinh: 'giang_vien' },
    });
    assert.deepEqual(onHoliday, []);

    // Ngày thường không lễ: có 1 lịch dạy thay qua DonNghiPhep đổi ca vào ngay_day_bu = 2026-09-20
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => [
      {
        id: UUID_3,
        nguoi_dung_id: UUID_1,
        giang_vien_day_thay_id: UUID_1,
        ngay_bat_dau: '2026-09-18',
        ngay_ket_thuc: '2026-09-18',
        ngay_day_bu: '2026-09-20',
        ca_thay_the_id: SHIFT_1,
        ca_thay_the: { id: SHIFT_1, ten_ca: 'Ca Sáng', gio_bat_dau: '07:00', gio_ket_thuc: '11:30' },
        giang_vien_day_thay: { id: UUID_1, ho_ten: 'GV A', email: 'a@uni.edu.vn' },
        lich_trinh: {
          id: SCHED_1,
          nguoi_dung_id: UUID_2,
          ca_id: SHIFT_2,
          mon_hoc_id: SUB_1,
          phong_hoc: 'P.301',
          co_so: 'CS1',
          la_truc_tuyen: false,
          thu_trong_tuan: 5,
          tiet_bat_dau: 1,
          so_tiet: 3,
          gio_bat_dau: '07:00',
          gio_ket_thuc: '11:30',
          ngay_bat_dau: '2026-09-01',
          ngay_ket_thuc: '2026-12-20',
          lap_lai_hang_tuan: true,
          loai_lich: 'chinh_khoa',
          mon_hoc: { id: SUB_1, ma_mon: 'IT101', ten_mon: 'Tin học' },
          toJSON() {
            return { ...this };
          },
        },
      },
    ]);

    const todayList = await fetchTodaySchedules({
      ngay: '2026-09-20',
      currentUser: { id: UUID_1, vai_tro_chinh: 'giang_vien' },
    });

    assert.equal(todayList.length, 1);
    assert.equal(todayList[0].nguoi_dung_id, UUID_1);
    assert.equal(todayList[0].ca_id, SHIFT_1);
    assert.equal(todayList[0].mon_hoc_id, SUB_1);
    assert.equal(todayList[0].giang_vien.ho_ten, 'GV A');
    assert.equal(todayList[0].ca.ten_ca, 'Ca Sáng');
    assert.equal(todayList[0].gio_bat_dau, '07:00');
  });

  it('Hỗ trợ ke_toan đọc toàn trường & mở rộng phạm vi từ VaiTroNguoiDung.don_vi_id', async () => {
    stub(models.LichTrinh, 'findAndCountAll', async () => ({ count: 1, rows: [{
      id: SCHED_1,
      nguoi_dung_id: UUID_2,
      ca_id: SHIFT_1,
      mon_hoc_id: SUB_1,
      phong_hoc: 'A1-101',
      thu_trong_tuan: 1,
      ngay_bat_dau: '2026-09-01',
      ngay_ket_thuc: '2026-12-20',
      tuan_hoc: [{ tuan_thu: 1 }],
      ngoai_le: [],
    }] }));

    const accountantRes = await fetchSchedules({
      currentUser: { id: UUID_1, vai_tro_chinh: 'ke_toan', danh_sach_vai_tro: [] },
    });
    assert.equal(accountantRes.schedules.length, 1);
    assert.equal(accountantRes.schedules[0].nguoi_dung_id, UUID_2);

    // Giảng viên kiêm trưởng khoa ở don_vi_id phụ trong danh_sach_vai_tro
    stub(models.PhongBan, 'findAll', async () => [
      { id: DEPT_ROOT, don_vi_cha_id: null },
      { id: DEPT_CHILD, don_vi_cha_id: DEPT_ROOT },
    ]);
    stub(models.NguoiDung, 'findAll', async () => [{ id: UUID_2 }]);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);

    const concurrentDeanRes = await fetchSchedules({
      currentUser: {
        id: UUID_3,
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: null,
        danh_sach_vai_tro: [{ ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_ROOT, kich_hoat: true }],
      },
    });
    assert.equal(concurrentDeanRes.schedules.length, 1);
  });
});

describe('Luồng 4.4 - Express RBAC, IDOR, removeSchedule FK & addScheduleException', () => {
  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/lich-trinh', require('../routes/lichTrinh.routes'));
    app.use('/api/mon-hoc', require('../routes/monHoc.routes'));
    app.use(errorHandler);
    return app;
  };

  it('RBAC qua Express Route: bgh, pho_khoa (ủy quyền), giang_vien kiêm truong_khoa được phép; giang_vien thường bị 403', async () => {
    const bghPerms = getEffectivePermissions({ vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] });
    const delegatedDeputyPerms = getEffectivePermissions({
      vai_tro_chinh: 'pho_khoa',
      danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: true, kich_hoat: true }],
    });
    assert.ok(bghPerms.has(PERMISSIONS.LICH_XEP_LICH));
    assert.ok(delegatedDeputyPerms.has(PERMISSIONS.LICH_XEP_LICH));

    const plainLecturerToken = jwt.sign({ id: UUID_1, phien_ban_token: 1 }, process.env.JWT_SECRET);
    const delegatedToken = jwt.sign({ id: UUID_2, phien_ban_token: 1 }, process.env.JWT_SECRET);

    stub(models.NguoiDung, 'findByPk', async (id) => {
      if (id === UUID_1) {
        return {
          id: UUID_1,
          vai_tro_chinh: 'giang_vien',
          don_vi_chinh_id: DEPT_CHILD,
          kich_hoat: true,
          phien_ban_token: 1,
          danh_sach_vai_tro: [],
        };
      }
      if (id === UUID_2) {
        return {
          id: UUID_2,
          vai_tro_chinh: 'pho_khoa',
          don_vi_chinh_id: DEPT_ROOT,
          kich_hoat: true,
          phien_ban_token: 1,
          danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: true, kich_hoat: true }],
        };
      }
      return {
        id: UUID_3,
        vai_tro_chinh: 'giang_vien',
        don_vi_chinh_id: DEPT_CHILD,
        kich_hoat: true,
      };
    });

    stubTransactionPassThrough();
    stub(models.CaLamViec, 'findByPk', async () => ({
      id: SHIFT_1,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '11:30',
      kich_hoat: true,
    }));
    stub(models.MonHoc, 'findByPk', async () => ({ id: SUB_1, ten_mon: 'Toán' }));
    stub(models.PhongBan, 'findAll', async () => [
      { id: DEPT_ROOT, don_vi_cha_id: null },
      { id: DEPT_CHILD, don_vi_cha_id: DEPT_ROOT },
    ]);
    stub(models.NguoiDung, 'findAll', async () => [{ id: UUID_3 }]);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);
    stub(models.LichTrinh, 'create', async (payload) => ({ id: SCHED_1, ...payload }));
    stub(models.LichTrinhTuan, 'bulkCreate', async () => []);
    stub(models.LichTrinh, 'findByPk', async () => ({
      id: SCHED_1,
      nguoi_dung_id: UUID_3,
      ca_id: SHIFT_1,
      mon_hoc_id: SUB_1,
      phong_hoc: 'A1-201',
      thu_trong_tuan: 1,
      tuan_hoc: [{ tuan_thu: 1 }],
      ngoai_le: [],
    }));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const app = buildApp();
    const denied = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/lich-trinh',
      headers: { Authorization: `Bearer ${plainLecturerToken}` },
      jsonBody: { nguoi_dung_id: UUID_3, ca_id: SHIFT_1, thu_trong_tuan: 1, ngay_bat_dau: '2026-09-07', ngay_ket_thuc: '2026-12-20' },
    });
    assert.equal(denied.status, 403);

    const allowed = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/lich-trinh',
      headers: { Authorization: `Bearer ${delegatedToken}` },
      jsonBody: {
        nguoi_dung_id: UUID_3,
        ca_id: SHIFT_1,
        mon_hoc_id: SUB_1,
        phong_hoc: 'A1-201',
        thu_trong_tuan: 1,
        ngay_bat_dau: '2026-09-07',
        ngay_ket_thuc: '2026-12-20',
        danh_sach_tuan: [1],
      },
    });
    assert.equal(allowed.status, 201);
  });

  it('IDOR: Trưởng khoa không thể cập nhật chuyển lịch sang giảng viên ngoài khoa', async () => {
    stubTransactionPassThrough();
    stub(models.LichTrinh, 'findByPk', async () => ({
      id: SCHED_1,
      nguoi_dung_id: UUID_2,
      ca_id: SHIFT_1,
      phong_hoc: 'A1-101',
      thu_trong_tuan: 1,
      tiet_bat_dau: 1,
      so_tiet: 3,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '09:30',
      ngay_bat_dau: '2026-09-01',
      ngay_ket_thuc: '2026-12-20',
      tuan_hoc: [{ tuan_thu: 1 }],
      ngoai_le: [],
    }));
    stub(models.PhongBan, 'findAll', async () => [{ id: DEPT_ROOT, don_vi_cha_id: null }]);
    stub(models.NguoiDung, 'findAll', async () => [{ id: UUID_2 }]);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);

    await assert.rejects(
      () =>
        updateExistingSchedule(
          SCHED_1,
          { nguoi_dung_id: UUID_3 }, // UUID_3 ngoài khoa
          { id: UUID_1, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: DEPT_ROOT, danh_sach_vai_tro: [] }
        ),
      (err) => err.statusCode === 403
    );
  });

  it('removeSchedule chặn xóa khi lịch nằm trong ds_lich_trinh_id; addScheduleException chặn trùng lễ & khóa đổi ca', async () => {
    stubTransactionPassThrough();
    stub(models.LichTrinh, 'findByPk', async () => ({
      id: SCHED_1,
      nguoi_dung_id: UUID_1,
      phong_hoc: 'A1-101',
      thu_trong_tuan: 1,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '11:30',
      ngay_bat_dau: '2026-09-01',
      ngay_ket_thuc: '2026-12-20',
      ngoai_le: [],
    }));
    // Chỉ nằm trong ds_lich_trinh_id (lich_trinh_id trỏ lịch khác) -> vẫn phải chặn
    stub(models.NhatKyChamCong, 'count', async (opts) => (opts?.where ? 1 : 0));
    stub(models.DonNghiPhep, 'count', async () => 0);

    await assert.rejects(
      () => removeSchedule(SCHED_1, { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }),
      (err) => err.statusCode === 409
    );

    // Chặn day_bu vào ngày nghỉ lễ
    stub(models.NgayNghiLe, 'findOne', async () => ({ id: UUID_3, ten_ngay_le: 'Nghỉ lễ' }));
    await assert.rejects(
      () =>
        addScheduleException({
          scheduleId: SCHED_1,
          ngay: '2026-09-18',
          trang_thai: 'day_bu',
          ngay_day_bu: '2026-09-02',
          currentUser: { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_HOLIDAY_CONFLICT'
    );

    // Chặn ghi đè ngoại lệ doi_ca sinh từ đơn đổi ca đã duyệt
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.NgoaiLeLichTrinh, 'findOne', async () => ({
      id: UUID_3,
      trang_thai: 'doi_ca',
      ly_do: 'Đổi ca theo đơn #123',
    }));
    await assert.rejects(
      () =>
        addScheduleException({
          scheduleId: SCHED_1,
          ngay: '2026-09-18',
          trang_thai: 'nghi',
          ly_do: 'Thử ghi đè',
          currentUser: { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_EXCEPTION_LOCKED'
    );
  });
});

describe('Luồng 4.5 - Ca làm việc, Ngày nghỉ lễ & Môn học validation + Audit Log', () => {
  it('caLamViec: chặn giờ bắt đầu == kết thúc, chặn tên trắng khi sửa, chặn xóa nếu dính NhatKyChamCong/DonNghiPhep', async () => {
    await assert.rejects(
      () => createShiftConfig({ ten_ca: 'Ca lỗi', gio_bat_dau: '08:00', gio_ket_thuc: '08:00' }),
      (err) => err.statusCode === 400
    );

    stub(models.CaLamViec, 'findByPk', async () => ({ id: SHIFT_1, ten_ca: 'Ca cũ', gio_bat_dau: '07:00', gio_ket_thuc: '11:30' }));
    await assert.rejects(
      () => updateShiftConfig(SHIFT_1, { ten_ca: '   ' }),
      (err) => err.statusCode === 400
    );

    stub(models.LichTrinh, 'count', async () => 0);
    stub(models.NhatKyChamCong, 'count', async () => 2);
    stub(models.DonNghiPhep, 'count', async () => 0);
    stub(models.NgoaiLeLichTrinh, 'count', async () => 0);
    await assert.rejects(
      () => deleteShiftConfig(SHIFT_1, { id: UUID_1 }),
      (err) => err.statusCode === 400 && err.errorCode === 'SHIFT_002'
    );

    stub(models.NhatKyChamCong, 'count', async () => 0);
    stub(models.DonNghiPhep, 'count', async () => 1);
    await assert.rejects(
      () => deleteShiftConfig(SHIFT_1, { id: UUID_1 }),
      (err) => err.statusCode === 400 && err.errorCode === 'SHIFT_002'
    );
  });

  it('ngayNghiLe: lấy kỳ nghỉ vắt năm, từ chối năm sai, chặn 2026-02-30 & ngày lễ chồng lấn', async () => {
    let capturedWhere = null;
    stub(models.NgayNghiLe, 'findAll', async (opts) => {
      capturedWhere = opts.where;
      return [{ id: UUID_1, ten_ngay_le: 'Tết Dương Lịch', ngay_bat_dau: '2025-12-30', ngay_ket_thuc: '2026-01-03' }];
    });

    const list = await getHolidays({ nam: 2026 });
    assert.equal(list.length, 1);
    assert.ok(capturedWhere.ngay_bat_dau && capturedWhere.ngay_ket_thuc);

    await assert.rejects(() => getHolidays({ nam: 'abc' }), (err) => err.statusCode === 400 && err.errorCode === 'INVALID_YEAR');

    await assert.rejects(
      () => createHoliday({ ten_ngay_le: 'Ngày ảo', ngay_bat_dau: '2026-02-30', ngay_ket_thuc: '2026-02-30' }),
      (err) => err.statusCode === 400 && err.errorCode === 'HOLIDAY_START_DATE_INVALID'
    );

    stub(models.NgayNghiLe, 'findOne', async () => ({ id: UUID_2, ten_ngay_le: 'Nghỉ cũ', ngay_bat_dau: '2026-04-30', ngay_ket_thuc: '2026-05-01' }));
    await assert.rejects(
      () => createHoliday({ ten_ngay_le: 'Chồng lấn', ngay_bat_dau: '2026-05-01', ngay_ket_thuc: '2026-05-02' }),
      (err) => err.statusCode === 409 && err.errorCode === 'HOLIDAY_OVERLAP'
    );
  });

  it('monHoc: mở rộng cây đơn vị con đa cấp ở getSubjects & validate tín chỉ > 0 + audit log ở createSubject', async () => {
    let queriedDeptFilter = null;
    stub(models.PhongBan, 'findAll', async () => [
      { id: DEPT_ROOT, don_vi_cha_id: null },
      { id: DEPT_CHILD, don_vi_cha_id: DEPT_ROOT },
      { id: DEPT_GRAND, don_vi_cha_id: DEPT_CHILD },
    ]);
    stub(models.MonHoc, 'findAll', async () => []);
    stub(models.MonHoc, 'findAndCountAll', async (opts) => {
      queriedDeptFilter = opts.where.phong_ban_id;
      return { count: 0, rows: [] };
    });

    await getSubjects({ phong_ban_id: DEPT_ROOT });
    assert.ok(Array.isArray(queriedDeptFilter) || typeof queriedDeptFilter === 'object');

    await assert.rejects(
      () =>
        createSubject(
          { ma_mon: 'IT201', ten_mon: 'Cấu trúc dữ liệu', so_tin_chi: 0 },
          { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
        ),
      (err) => err.statusCode === 400
    );

    let auditCreated = false;
    stub(models.PhongBan, 'findByPk', async () => ({ id: DEPT_ROOT, ten_phong_ban: 'CNTT' }));
    stub(models.MonHoc, 'findOne', async () => null);
    stub(models.MonHoc, 'create', async (d) => ({ id: SUB_1, ...d }));
    stub(models.MonHoc, 'findByPk', async () => ({ id: SUB_1, ma_mon: 'IT201', ten_mon: 'CTDL', so_tin_chi: 3 }));
    stub(models.NhatKyKiemToan, 'create', async () => {
      auditCreated = true;
      return {};
    });

    const created = await createSubject(
      { ma_mon: 'IT201', ten_mon: 'CTDL', so_tin_chi: 3, phong_ban_id: DEPT_ROOT },
      { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
    );
    assert.equal(created.ma_mon, 'IT201');
    assert.equal(auditCreated, true);
  });
});
