// Kiểm thử trọng tâm Luồng 5 (Chấm công đa phương thức & Khối ca liên tục): Service, Cron/Queue/Socket và Route/Middleware.
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';
process.env.QR_SECRET = process.env.QR_SECRET || 'unit-test-qr-secret-key';
process.env.TERMINAL_KEY = process.env.TERMINAL_KEY || 'unit-test-terminal-key';
process.env.DISABLE_BULLMQ = 'true';
process.env.ATTENDANCE_EVIDENCE_DIR = os.tmpdir();

const { Op } = require('sequelize');
const models = require('../models');
const socketConfig = require('../config/socket');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const { generateDynamicQRCode } = require('../utils/hoTroChamCong');
const { removeAttendanceEvidence } = require('../utils/anhMinhChungChamCong');
const { getVietnamDayRange } = require('../utils/thoiGianChamCong.utils');
const chamCongController = require('../controllers/chamCong.controller');
const { evaluateUserScheduleForCheckIn } = require('../services/chamCong/dieuKienLichChamCong.service');
const { performCheckIn } = require('../services/chamCong/vaoCa.service');
const { performCheckOut } = require('../services/chamCong/tanCa.service');
const { processScanQRCode } = require('../services/chamCong/chamCongQr.service');
const { processFaceAttendance, scanCooldownMap } = require('../services/chamCong/nhanDienKhuonMat.service');
const { updateAttendanceByAdmin } = require('../services/chamCong/quanTriChamCong.service');
const { getTodayActiveSchedules, danhDauThieuCheckOut } = require('../services/heThong/tacVuDinhKy.service');
const { kiemTraChoPhepCheckOut } = require('../services/chamCong/khoiCaDay.service');
const { processPunchJobData } = require('../queues/hangDoiChamCong');

const USER_1 = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';
const SHIFT_1 = '33333333-3333-4333-8333-333333333333';
const SHIFT_HC = '44444444-4444-4444-8444-444444444444';
const SCH_1 = '55555555-5555-4555-8555-555555555555';
const SCH_2 = '66666666-6666-4666-8666-666666666666';
const LOG_1 = '77777777-7777-4777-8777-777777777777';
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
    const fn = restores.pop();
    fn();
  }
  scanCooldownMap.clear();
});

const wrapSchedule = (plain) => ({
  ...plain,
  toJSON: () => ({ ...plain }),
});

describe('Luồng 5 - Service & Nghiệp vụ đa phương thức', () => {
  it('B4: cho phép check-out lịch trực tuyến (la_truc_tuyen = true) khi không có GPS, nhưng chặn lịch offline', async () => {
    const pastEnd = new Date(Date.now() - 10 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const endHm = `${pad(pastEnd.getHours())}:${pad(pastEnd.getMinutes())}`;

    const onlineLog = {
      id: LOG_1,
      nguoi_dung_id: USER_1,
      ca_id: SHIFT_1,
      lich_trinh_id: SCH_1,
      ds_lich_trinh_id: [SCH_1],
      ngay_cong: getVietnamDayRange().dateStr,
      thoi_gian_vao: new Date(Date.now() - 2 * 3600 * 1000),
      thoi_gian_ra: null,
      trang_thai: 'on_time',
      da_chot: false,
      ca: { id: SHIFT_1, gio_bat_dau: '07:00', gio_ket_thuc: '07:05' },
      save: async () => onlineLog,
      toJSON: () => ({ ...onlineLog }),
    };

    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NhatKyChamCong, 'findOne', async (opts) => {
      if (opts?.where?.id?.[Op.ne]) return null;
      return onlineLog;
    });
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: true, so_tiet: 3 }));
    stub(models.LuotQuetChamCong, 'create', async (data) => ({ id: 'punch-1', ...data }));
    stub(models.NguoiDung, 'findByPk', async () => ({ email: null, ho_ten: 'GV Online', don_vi_chinh_id: DEPT_1 }));

    const outOk = await performCheckOut({
      nguoi_dung_id: USER_1,
      phuong_thuc: 'gps_mobile',
      vi_do: null,
      kinh_do: null,
    });
    assert.equal(outOk.success, true);
    assert.equal(outOk.co_gian_lan, false);

    // Chuyển lịch sang offline và bỏ GPS -> phải ném ATTENDANCE_GPS_REQUIRED
    onlineLog.thoi_gian_ra = null;
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: false, so_tiet: 3 }));
    await assert.rejects(
      () =>
        performCheckOut({
          nguoi_dung_id: USER_1,
          phuong_thuc: 'gps_mobile',
          vi_do: null,
          kinh_do: null,
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'ATTENDANCE_GPS_REQUIRED'
    );
    assert.ok(endHm);
  });

  it('C1-C3: quét QR cho phép lịch trực tuyến không cần GPS, trả key chuẩn co_gian_lan và chống replay', async () => {
    const { qrToken } = generateDynamicQRCode({ roomId: 'ONLINE_01' });

    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'create', async (data) => ({ id: LOG_1, ...data, toJSON: () => ({ id: LOG_1, ...data }) }));
    stub(models.LuotQuetChamCong, 'create', async (data) => ({ id: 'punch-qr-1', ...data }));
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_1,
      ho_ten: 'GV QR',
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: DEPT_1,
      ho_so: { loai_nhan_su: 'giang_vien' },
    }));

    const nowVN = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startDate = new Date(nowVN.getTime() - 2 * 60 * 1000);
    const endDate = new Date(nowVN.getTime() + 120 * 60 * 1000);
    const startHm = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
    const endHm = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    const { dateStr } = getVietnamDayRange(nowVN);

    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_1,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        thu_trong_tuan: nowVN.getDay(),
        ngay_bat_dau: dateStr,
        ngay_ket_thuc: dateStr,
        gio_bat_dau: startHm,
        gio_ket_thuc: endHm,
        co_so: 'Gia Lâm',
        la_truc_tuyen: true,
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: startHm, gio_ket_thuc: endHm, nguong_di_muon_phut: 30 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: true }));

    const qrRes = await processScanQRCode({
      nguoi_dung_id: USER_1,
      qrToken,
      vi_do: null,
      kinh_do: null,
    });
    assert.equal(qrRes.loai_quet, 'check_in');
    assert.equal(qrRes.co_gian_lan, false);
    assert.equal('gian_lan' in qrRes, false);

    // Quét lại cùng QR trong 45s -> chống replay
    await assert.rejects(
      () => processScanQRCode({ nguoi_dung_id: USER_1, qrToken, vi_do: null, kinh_do: null }),
      (err) => err.statusCode === 409 && err.errorCode === 'QR_REPLAY_DETECTED'
    );

    // QR mới nhưng quét lỗi (thiếu GPS cho lịch offline) không được đốt nonce replay
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: false }));
    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_1,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        thu_trong_tuan: nowVN.getDay(),
        ngay_bat_dau: dateStr,
        ngay_ket_thuc: dateStr,
        gio_bat_dau: startHm,
        gio_ket_thuc: endHm,
        co_so: 'Gia Lâm',
        la_truc_tuyen: false,
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: startHm, gio_ket_thuc: endHm, nguong_di_muon_phut: 30 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    const { qrToken: offlineQrToken } = generateDynamicQRCode({ roomId: 'OFFLINE_01' });
    await assert.rejects(
      () => processScanQRCode({ nguoi_dung_id: USER_1, qrToken: offlineQrToken, vi_do: null, kinh_do: null }),
      (err) => err.statusCode === 400 && err.errorCode === 'ATTENDANCE_GPS_REQUIRED'
    );
    const qrRetryWithGps = await processScanQRCode({
      nguoi_dung_id: USER_1,
      qrToken: offlineQrToken,
      vi_do: 20.9752,
      kinh_do: 105.7628,
      do_chinh_xac: 15,
    });
    assert.equal(qrRetryWithGps.loai_quet, 'check_in');
  });

  it('B8 + Song song: check-in khối dạy 2 chỉ đóng khối dạy 1 sang thieu_check_out và giữ ca hành chính mở', async () => {
    const savedRecords = [];
    const adminOpenLog = {
      id: 'log-hc',
      nguoi_dung_id: USER_1,
      ca_id: SHIFT_HC,
      lich_trinh_id: null,
      trang_thai: 'on_time',
      thoi_gian_vao: new Date(Date.now() - 3 * 3600 * 1000),
      thoi_gian_ra: null,
      save: async () => {
        savedRecords.push('log-hc');
      },
    };
    const block1OpenLog = {
      id: 'log-teach-1',
      nguoi_dung_id: USER_1,
      ca_id: SHIFT_1,
      lich_trinh_id: SCH_1,
      trang_thai: 'on_time',
      thoi_gian_vao: new Date(Date.now() - 2 * 3600 * 1000),
      thoi_gian_ra: null,
      save: async () => {
        savedRecords.push('log-teach-1');
      },
    };

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endDate = new Date(now.getTime() + 90 * 60 * 1000);
    const endHm = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    const { dateStr } = getVietnamDayRange(now);

    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_1,
      ho_ten: 'Trưởng khoa A',
      vai_tro_chinh: 'truong_khoa',
      don_vi_chinh_id: DEPT_1,
      ho_so: { loai_nhan_su: 'giang_vien' },
    }));
    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_2,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        thu_trong_tuan: now.getDay(),
        ngay_bat_dau: dateStr,
        ngay_ket_thuc: dateStr,
        gio_bat_dau: startHm,
        gio_ket_thuc: endHm,
        co_so: 'Gia Lâm',
        la_truc_tuyen: true,
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 2', gio_bat_dau: startHm, gio_ket_thuc: endHm, nguong_di_muon_phut: 30 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_2, la_truc_tuyen: true }));
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'findAll', async () => [adminOpenLog, block1OpenLog]);
    stub(models.NhatKyChamCong, 'create', async (data) => ({
      id: 'log-teach-2',
      ...data,
      toJSON: () => ({ id: 'log-teach-2', ...data }),
    }));
    stub(models.LuotQuetChamCong, 'create', async (data) => ({ id: 'punch-2', ...data }));

    const res = await performCheckIn({
      nguoi_dung_id: USER_1,
      phuong_thuc: 'gps_mobile',
    });

    assert.equal(res.success, true);
    assert.equal(block1OpenLog.trang_thai, 'thieu_check_out');
    assert.equal(adminOpenLog.trang_thai, 'on_time');
    assert.deepEqual(savedRecords, ['log-teach-1']);
  });

  it('A5-A7: cán bộ kiêm nhiệm fallback ca hành chính khi hết ca dạy; giảng viên thuần túy không lịch bị từ chối; quá hạn ngày lễ không đánh vắng', async () => {
    const refDate = new Date('2026-11-20T09:00:00+07:00');

    // Giảng viên thuần túy không có lịch -> NO_SCHEDULE
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    const pureLecRes = await evaluateUserScheduleForCheckIn(
      USER_1,
      null,
      { id: USER_1, ho_ten: 'GV B', vai_tro_chinh: 'giang_vien', ho_so: { loai_nhan_su: 'giang_vien' } },
      refDate
    );
    assert.equal(pureLecRes.canCheckIn, false);
    assert.equal(pureLecRes.status, 'NO_SCHEDULE');

    // Trưởng khoa không lịch dạy -> fallback ca hành chính đang mở
    stub(models.CaLamViec, 'findAll', async () => [
      { id: SHIFT_HC, ten_ca: 'Hành chính sáng', gio_bat_dau: '08:00', gio_ket_thuc: '12:00' },
    ]);
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    const deanRes = await evaluateUserScheduleForCheckIn(
      USER_1,
      null,
      { id: USER_1, ho_ten: 'Trưởng khoa', vai_tro_chinh: 'truong_khoa', ho_so: { loai_nhan_su: 'giang_vien' } },
      refDate
    );
    assert.equal(deanRes.canCheckIn, true);
    assert.equal(deanRes.selectedSchedule.id, null);
    assert.equal(deanRes.shift.id, SHIFT_HC);

    // Giảng viên quá giờ check-in vào ngày lễ -> không tự đánh vắng
    let absentCreated = false;
    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_1,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        ngay_bat_dau: '2026-11-01',
        ngay_ket_thuc: '2026-11-30',
        gio_bat_dau: '07:00',
        gio_ket_thuc: '09:30',
        co_so: 'Gia Lâm',
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: '07:00', gio_ket_thuc: '09:30', nguong_di_muon_phut: 15 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    stub(models.NgayNghiLe, 'findOne', async () => ({ id: 'hol-1', ten_ngay_le: '20/11' }));
    stub(models.NhatKyChamCong, 'create', async () => {
      absentCreated = true;
    });
    const holidayEval = await evaluateUserScheduleForCheckIn(
      USER_1,
      null,
      { id: USER_1, ho_ten: 'GV B', vai_tro_chinh: 'giang_vien', ho_so: { loai_nhan_su: 'giang_vien' } },
      refDate
    );
    assert.equal(holidayEval.canCheckIn, false);
    assert.equal(absentCreated, false);
  });

  it('B3 & B7: kiểm tra ca qua đêm 22:00->06:00 và chặn check-out trước giờ hoặc đã bị khối sau thay thế', async () => {
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);

    // Chưa hết ca -> CHECKOUT_BEFORE_SHIFT_END
    await assert.rejects(
      () =>
        kiemTraChoPhepCheckOut({
          nguoiDungId: USER_1,
          openLog: {
            id: LOG_1,
            ngay_cong: '2026-11-20',
            lich_trinh_id: null,
            ca: { gio_bat_dau: '08:00', gio_ket_thuc: '17:00' },
          },
          now: new Date('2026-11-20T15:00:00+07:00'),
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'CHECKOUT_BEFORE_SHIFT_END'
    );

    // Đã check-in khối sau -> chuyển khối trước sang thieu_check_out & báo CHECKOUT_BLOCK_SUPERSEDED
    const oldBlockLog = {
      id: LOG_1,
      ngay_cong: '2026-11-20',
      lich_trinh_id: SCH_1,
      thoi_gian_vao: new Date('2026-11-20T07:00:00+07:00'),
      trang_thai: 'on_time',
      ca: { gio_bat_dau: '07:00', gio_ket_thuc: '09:30' },
      save: async () => oldBlockLog,
    };
    stub(models.NhatKyChamCong, 'findOne', async () => ({ id: 'log-2', lich_trinh_id: SCH_2 }));
    await assert.rejects(
      () =>
        kiemTraChoPhepCheckOut({
          nguoiDungId: USER_1,
          openLog: oldBlockLog,
          now: new Date('2026-11-20T13:00:00+07:00'),
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'CHECKOUT_BLOCK_SUPERSEDED'
    );
    assert.equal(oldBlockLog.trang_thai, 'thieu_check_out');
  });

  it('D2, D5 & D8: verifyOnly khớp contract ModalQuetChamCong, FACE_USER_MISMATCH và worker hàng đợi giữ ca HC song song', async () => {
    // 1. Mock AI Sidecar + cache vector thông qua fetch
    stub(global, 'fetch', async (url) => {
      const u = String(url);
      if (u.includes('/v1/face/stats')) {
        return { ok: true, text: async () => JSON.stringify({ total_vectors: 1, total_users: 1 }) };
      }
      if (u.includes('/v1/face/recognize')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ matched: true, userId: USER_1, similarity: 0.91, liveness_score: 0.96 }),
        };
      }
      return { ok: true, text: async () => '{}' };
    });

    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_1,
      ho_ten: 'Nguyễn Văn A',
      email: 'a@uni.edu.vn',
      vai_tro_chinh: 'giang_vien',
      anh_dai_dien: null,
      ma_can_bo: 'GV01',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      don_vi_chinh: { id: DEPT_1, ten_phong_ban: 'Khoa CNTT' },
    }));

    let dbWriteCalled = false;
    stub(models.NhatKyChamCong, 'create', async () => {
      dbWriteCalled = true;
    });

    // D8: verifyOnly trả user + diem_tin_cay, không ghi DB, không đặt cooldown
    const verifyRes = await processFaceAttendance({
      imageBuffer: Buffer.from('fake-jpg'),
      verifyOnly: true,
      expectedUserId: USER_1,
    });
    assert.equal(verifyRes.success, true);
    assert.equal(verifyRes.khop_khuon_mat, true);
    assert.equal(verifyRes.user.id, USER_1);
    assert.equal(verifyRes.user.don_vi_chinh.ten_phong_ban, 'Khoa CNTT');
    assert.equal(verifyRes.diem_tin_cay, 0.91);
    assert.equal(verifyRes.diem_nguoi_that, 0.96);
    assert.equal(dbWriteCalled, false);
    assert.equal(scanCooldownMap.has(USER_1), false);

    // D2: Khuôn mặt không khớp tài khoản đăng nhập
    const mismatchRes = await processFaceAttendance({
      imageBuffer: Buffer.from('fake-jpg'),
      verifyOnly: false,
      expectedUserId: USER_2,
    });
    assert.equal(mismatchRes.success, false);
    assert.equal(mismatchRes.matched, false);
    assert.equal(mismatchRes.errorCode, 'FACE_USER_MISMATCH');

    // D5: Worker processPunchJobData lưu do_chinh_xac_gps & ghi audit log snake_case
    let capturedPunch = null;
    let capturedAudit = null;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endDate = new Date(now.getTime() + 90 * 60 * 1000);
    const endHm = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    const { dateStr } = getVietnamDayRange(now);

    stub(models.sequelize, 'authenticate', async () => {});
    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'create', async (d) => ({ id: LOG_1, ...d, toJSON: () => ({ id: LOG_1, ...d }) }));
    stub(models.LuotQuetChamCong, 'create', async (d) => {
      capturedPunch = d;
      return d;
    });
    stub(models.NhatKyKiemToan, 'create', async (d) => {
      capturedAudit = d;
      return d;
    });
    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_1,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        thu_trong_tuan: now.getDay(),
        ngay_bat_dau: dateStr,
        ngay_ket_thuc: dateStr,
        gio_bat_dau: startHm,
        gio_ket_thuc: endHm,
        co_so: 'Gia Lâm',
        la_truc_tuyen: true,
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: startHm, gio_ket_thuc: endHm, nguong_di_muon_phut: 30 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: true }));

    await processPunchJobData({
      type: 'face_ai',
      userId: USER_1,
      requestedAction: 'check_in',
      punchTime: now,
      location: { lat: 20.9752, lng: 105.7628, accuracy: 18 },
      reqIp: '127.0.0.1',
      deviceId: 'CAM_01',
      aiResult: { similarity: 0.92, liveness_score: 0.95 },
    });
    assert.equal(capturedPunch.do_chinh_xac_gps, 18);
    assert.equal(capturedAudit.chi_tiet.phuong_thuc, 'face_ai');
    assert.equal(capturedAudit.chi_tiet.co_gian_lan, false);
  });

  it('E2 & E3: cron getTodayActiveSchedules include giang_vien_day_thay/ca_thay_the, và updateAttendanceByAdmin tính lại phút muộn/về sớm + validate enum', async () => {
    let capturedExceptionOpts = null;
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async (opts) => {
      capturedExceptionOpts = opts;
      return [
        {
          trang_thai: 'doi_ca',
          ngay: '2026-11-20',
          ngay_day_bu: '2026-11-20',
          lich_trinh: {
            id: SCH_1,
            nguoi_dung_id: USER_1,
            ngay_bat_dau: '2026-11-01',
            toJSON: () => ({ id: SCH_1, nguoi_dung_id: USER_1, ngay_bat_dau: '2026-11-01', tuan_hoc: [], ngoai_le: [] }),
          },
          giang_vien_day_thay: { id: USER_2, ho_ten: 'GV Dạy Thay', email: 'sub@uni.edu.vn' },
          ca_thay_the: { id: SHIFT_1, gio_bat_dau: '13:00', gio_ket_thuc: '15:30' },
        },
      ];
    });

    const activeList = await getTodayActiveSchedules(new Date('2026-11-20T09:00:00+07:00'));
    const includedAliases = (capturedExceptionOpts?.include || []).map((i) => i.as);
    assert.equal(includedAliases.includes('giang_vien_day_thay'), true);
    assert.equal(includedAliases.includes('ca_thay_the'), true);
    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].nguoi_dung_id, USER_2);
    assert.equal(activeList[0].ca_id, SHIFT_1);

    // danhDauThieuCheckOut bỏ qua ca qua đêm hôm nay nhưng đánh dấu ca thường
    const { dateStr: todayStr } = getVietnamDayRange();
    const regularLog = {
      id: LOG_1,
      ngay_cong: todayStr,
      ca: { gio_bat_dau: '07:00', gio_ket_thuc: '11:30' },
      trang_thai: 'on_time',
      ly_do_ghi_de: null,
      save: async () => regularLog,
    };
    const overnightLog = {
      id: 'log-night',
      ngay_cong: todayStr,
      ca: { gio_bat_dau: '22:00', gio_ket_thuc: '06:00' },
      trang_thai: 'on_time',
      save: async () => overnightLog,
    };
    stub(models.NhatKyChamCong, 'findAll', async () => [regularLog, overnightLog]);
    const flagRes = await danhDauThieuCheckOut(new Date());
    assert.equal(flagRes.flaggedCount, 1);
    assert.equal(regularLog.trang_thai, 'thieu_check_out');
    assert.equal(overnightLog.trang_thai, 'on_time');

    // updateAttendanceByAdmin tính lại di_muon_phut & ve_som_phut khi admin sửa giờ vào/ra
    const mockLog = {
      id: LOG_1,
      nguoi_dung_id: USER_1,
      ca_id: SHIFT_1,
      lich_trinh_id: null,
      ngay_cong: '2026-11-20',
      trang_thai: 'late',
      di_muon_phut: 25,
      ve_som_phut: 30,
      thoi_gian_vao: new Date('2026-11-20T08:25:00+07:00'),
      thoi_gian_ra: new Date('2026-11-20T11:30:00+07:00'),
      da_chot: false,
      save: async () => mockLog,
      toJSON: () => ({ ...mockLog }),
    };
    stub(models.NhatKyChamCong, 'findByPk', async () => mockLog);
    stub(models.CaLamViec, 'findByPk', async () => ({ gio_bat_dau: '08:00', gio_ket_thuc: '12:00' }));
    stub(models.NguoiDung, 'findByPk', async () => ({ don_vi_chinh_id: DEPT_1 }));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const adjusted = await updateAttendanceByAdmin({
      id: LOG_1,
      nguoi_thuc_hien_id: USER_2,
      currentUser: { id: USER_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
      trang_thai: 'on_time',
      thoi_gian_vao: '2026-11-20T07:55:00+07:00',
      thoi_gian_ra: '2026-11-20T12:05:00+07:00',
      ly_do_ghi_de: 'Sửa giờ chấm công hợp lệ',
    });
    // updateAttendanceByAdmin validate enum trang_thai (chặn giá trị sai bằng ValidationError thay vì để lọt)
    await assert.rejects(
      () =>
        models.NhatKyChamCong.build({
          nguoi_dung_id: USER_1,
          ca_id: SHIFT_1,
          ngay_cong: '2026-11-20',
          trang_thai: 'invalid_status',
        }).validate(),
      (err) => err.name === 'SequelizeValidationError'
    );
    assert.equal(adjusted.di_muon_phut, 0);
    assert.equal(adjusted.ve_som_phut, 0);
    assert.equal(adjusted.thoi_luong_lam_viec_phut, 250);
  });
});

describe('Luồng 5 - Integration Express Routes, RBAC, Multer & Liveness', () => {
  const createTestApp = () => {
    const chamCongRoutes = require('../routes/chamCong.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/cham-cong', chamCongRoutes);
    app.use(errorHandler);
    return app;
  };

  // Gửi HTTP request qua Express app thật (verifyToken -> RBAC -> Multer -> Controller -> errorHandler) không cần mở TCP port
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
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.getHeaders() });
      };

      app(req, res);
    });
  };

  const ADMIN_UUID = 'aaaaaaaa-0000-4000-8000-000000000001';
  const BGH_UUID = 'aaaaaaaa-0000-4000-8000-000000000002';
  const signUser = (role, id = USER_1) =>
    jwt.sign({ id, vai_tro_chinh: role, phien_ban_token: 1 }, process.env.JWT_SECRET, { expiresIn: '10m' });

  it('B9 & D7: kiểm tra tách quyền middleware/controller và parse toa_do JSON string ở /khuon-mat', async () => {
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      ho_ten: 'Test User',
      email: 'test@uni.edu.vn',
      vai_tro_chinh: id === ADMIN_UUID ? 'admin' : id === BGH_UUID ? 'bgh' : 'giang_vien',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      phien_ban_token: 1,
      don_vi_chinh_id: DEPT_1,
      danh_sach_vai_tro: [],
    }));
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);

    // Stub fetch AI để /khuon-mat đi qua controller -> processFaceAttendance
    let capturedPunchPayload = null;
    stub(global, 'fetch', async (url) => {
      const u = String(url);
      if (u.includes('/v1/face/stats')) {
        return { ok: true, text: async () => JSON.stringify({ total_vectors: 1, total_users: 1 }) };
      }
      if (u.includes('/v1/face/recognize')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ matched: true, userId: USER_1, similarity: 0.9, liveness_score: 0.95 }),
        };
      }
      return { ok: true, text: async () => '{}' };
    });
    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'create', async (d) => ({ id: LOG_1, ...d, toJSON: () => ({ id: LOG_1, ...d }) }));
    stub(models.LuotQuetChamCong, 'create', async (d) => {
      capturedPunchPayload = d;
      return d;
    });
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endDate = new Date(now.getTime() + 90 * 60 * 1000);
    const endHm = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    const { dateStr } = getVietnamDayRange(now);
    stub(models.LichTrinh, 'findAll', async () => [
      wrapSchedule({
        id: SCH_1,
        nguoi_dung_id: USER_1,
        ca_id: SHIFT_1,
        thu_trong_tuan: now.getDay(),
        ngay_bat_dau: dateStr,
        ngay_ket_thuc: dateStr,
        gio_bat_dau: startHm,
        gio_ket_thuc: endHm,
        co_so: 'Gia Lâm',
        la_truc_tuyen: false,
        so_tiet: 3,
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: startHm, gio_ket_thuc: endHm, nguong_di_muon_phut: 30 },
        tuan_hoc: [],
        ngoai_le: [],
      }),
    ]);
    stub(models.LichTrinh, 'findByPk', async () => ({ id: SCH_1, la_truc_tuyen: false }));

    const app = createTestApp();

    // 1. admin bị controller chặn 403 ATTENDANCE_ROLE_FORBIDDEN trên /vao-ca và /khuon-mat
    const adminToken = signUser('admin', ADMIN_UUID);
    const rAdminVaoCa = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/vao-ca',
      headers: { Authorization: `Bearer ${adminToken}` },
      jsonBody: { phuong_thuc: 'gps_mobile' },
    });
    assert.equal(rAdminVaoCa.status, 403);
    assert.equal(rAdminVaoCa.body.errorCode, 'ATTENDANCE_ROLE_FORBIDDEN');

    const fdAdmin = new FormData();
    fdAdmin.append('image', new Blob([Buffer.from('jpg')], { type: 'image/jpeg' }), 'face.jpg');
    const rAdminFace = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/khuon-mat',
      headers: { Authorization: `Bearer ${adminToken}` },
      formData: fdAdmin,
    });
    assert.equal(rAdminFace.status, 403);
    assert.equal(rAdminFace.body.errorCode, 'ATTENDANCE_ROLE_FORBIDDEN');

    // 2. bgh bị middleware requirePermission(CONG_QUET_MAT) chặn 403 tại /khuon-mat
    const bghToken = signUser('bgh', BGH_UUID);
    const rBghFace = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/khuon-mat',
      headers: { Authorization: `Bearer ${bghToken}` },
      formData: new FormData(),
    });
    assert.equal(rBghFace.status, 403);

    // 3. uploadFaceImage từ chối file sai MIME
    const gvToken = signUser('giang_vien', USER_1);
    const fdBad = new FormData();
    fdBad.append('image', new Blob([Buffer.from('txt')], { type: 'text/plain' }), 'bad.txt');
    const rBadMime = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/khuon-mat',
      headers: { Authorization: `Bearer ${gvToken}` },
      formData: fdBad,
    });
    assert.equal(rBadMime.status, 400);
    assert.equal(rBadMime.body.errorCode, 'UNSUPPORTED_FACE_IMAGE_TYPE');

    // 4. D7: parse toa_do JSON string từ multipart/form-data qua HTTP route thật và lưu đúng vi_do/kinh_do/do_chinh_xac_gps
    const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const fdToaDo = new FormData();
    fdToaDo.append('image', new Blob([validJpgHeader], { type: 'image/jpeg' }), 'face.jpg');
    fdToaDo.append('toa_do', JSON.stringify({ vi_do: 20.9752, kinh_do: 105.7628, do_chinh_xac: 12 }));
    const rToaDo = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/khuon-mat',
      headers: { Authorization: `Bearer ${gvToken}` },
      formData: fdToaDo,
    });
    try {
      assert.equal(rToaDo.status, 200, `Unexpected status ${rToaDo.status}: ${JSON.stringify(rToaDo.body)}`);
      assert.equal(capturedPunchPayload.vi_do, 20.9752);
      assert.equal(capturedPunchPayload.kinh_do, 105.7628);
      assert.equal(capturedPunchPayload.do_chinh_xac_gps, 12);
    } finally {
      if (capturedPunchPayload?.anh_minh_chung) {
        await removeAttendanceEvidence(capturedPunchPayload.anh_minh_chung).catch(() => {});
      }
    }
  });

  it('Liveness Challenge, /cau-hinh-khuon-vien và /khoi-hom-nay qua HTTP route thật', async () => {
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      ho_ten: 'GV Test',
      vai_tro_chinh: 'giang_vien',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      danh_sach_vai_tro: [],
    }));
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);

    let detectedPoseToReturn = 'TURN_LEFT';
    stub(global, 'fetch', async (url) => {
      if (String(url).includes('/v1/face/detect-pose')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ status: 'face_detected', pose: { pose_en: detectedPoseToReturn } }),
        };
      }
      return { ok: true, text: async () => '{}' };
    });

    const app = createTestApp();
    const gvToken = signUser('giang_vien', USER_1);

    // /cau-hinh-khuon-vien từ chối khi thiếu auth, chấp nhận x-terminal-key
    const rNoAuth = await dispatchExpress(app, { url: '/api/cham-cong/cau-hinh-khuon-vien' });
    assert.equal(rNoAuth.status, 401);
    const rTerm = await dispatchExpress(app, {
      url: '/api/cham-cong/cau-hinh-khuon-vien',
      headers: { 'x-terminal-key': process.env.TERMINAL_KEY },
    });
    assert.equal(rTerm.status, 200);

    // /khoi-hom-nay trả 200 cho giảng viên
    const rBlock = await dispatchExpress(app, {
      url: '/api/cham-cong/khoi-hom-nay',
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(rBlock.status, 200);

    // Liveness challenge + verify + chống replay
    const rChal = await dispatchExpress(app, {
      url: '/api/cham-cong/thu-thach-mat-that',
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(rChal.status, 200);
    const { challenge, challengeToken } = rChal.body.data;
    detectedPoseToReturn = challenge;

    const fdLive = new FormData();
    fdLive.append('challengeToken', challengeToken);
    fdLive.append('image', new Blob([Buffer.from('jpg')], { type: 'image/jpeg' }), 'live.jpg');
    const rVerify = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/xac-thuc-mat-that',
      headers: { Authorization: `Bearer ${gvToken}` },
      formData: fdLive,
    });
    assert.equal(rVerify.status, 200);
    assert.equal(rVerify.body.data.passed, true);

    // Dùng lại challengeToken vừa dùng -> 409 chống replay
    const fdReplay = new FormData();
    fdReplay.append('challengeToken', challengeToken);
    fdReplay.append('image', new Blob([Buffer.from('jpg')], { type: 'image/jpeg' }), 'live.jpg');
    const rReplay = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/cham-cong/xac-thuc-mat-that',
      headers: { Authorization: `Bearer ${gvToken}` },
      formData: fdReplay,
    });
    assert.equal(rReplay.status, 409);

    // Bắt buộc livenessTicket khi ENFORCE_LIVENESS_TICKET=true (trừ verifyOnly) và chống replay vé
    const { consumeLivenessTicket } = require('../services/khuonMat/thuThachLiveness.service');
    process.env.ENFORCE_LIVENESS_TICKET = 'true';
    try {
      await assert.rejects(
        () => consumeLivenessTicket('', USER_1),
        (err) => err.statusCode === 400 && err.errorCode === 'LIVENESS_TICKET_REQUIRED'
      );
      assert.ok(rVerify.body.data.livenessTicket);
      await consumeLivenessTicket(rVerify.body.data.livenessTicket, USER_1);
      await assert.rejects(
        () => consumeLivenessTicket(rVerify.body.data.livenessTicket, USER_1),
        (err) => err.statusCode === 409 && err.errorCode === 'LIVENESS_TICKET_REPLAY'
      );
    } finally {
      delete process.env.ENFORCE_LIVENESS_TICKET;
    }
  });
});
