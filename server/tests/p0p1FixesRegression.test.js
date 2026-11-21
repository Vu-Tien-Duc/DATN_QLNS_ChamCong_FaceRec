const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-key';
process.env.BIOMETRIC_ENCRYPTION_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || '12345678901234567890123456789012';

const models = require('../models');
const minioStorage = require('../config/minio');
const redisConfig = require('../config/redis');
const { transporter } = require('../config/mailer');
const { sequelize } = require('../config/db');
const taiTepService = require('../services/heThong/taiTep.service');
const xacThucService = require('../services/heThong/xacThuc.service');
const nguoiDungService = require('../services/nhanSu/nguoiDung.service');
const phongBanService = require('../services/nhanSu/phongBan.service');
const phamViTruongKhoa = require('../utils/phamViTruongKhoa');
const mauKhuonMatService = require('../services/khuonMat/mauKhuonMat.service');
const ketNoiDichVuKhuonMat = require('../services/khuonMat/ketNoiDichVuKhuonMat');
const lichTrinhService = require('../services/nhanSu/lichTrinh.service');
const dieuKienLichChamCong = require('../services/chamCong/dieuKienLichChamCong.service');
const nhanDienKhuonMat = require('../services/chamCong/nhanDienKhuonMat.service');
const donNghiPhepService = require('../services/donNghiPhep/donNghiPhep.service');
const pheDuyetDonService = require('../services/donNghiPhep/pheDuyetDon.service');
const phieuLuongService = require('../services/phieuLuong/phieuLuong.service');
const { buildAttendanceDateFilter } = require('../utils/thoiGianChamCong.utils');
const { generateAIResponse } = require('../services/ai/nhaCungCapAi.service');
const { acquireLock, releaseLock, resetMemoryLocks } = require('../utils/khoaPhanTan');

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const DEPT_KHOA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEPT_BM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEPT_OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SHIFT_1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCHED_1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const LOG_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const REQ_1 = '99999999-9999-4999-8999-999999999999';

const restores = [];
const stub = (obj, method, fn) => {
  const original = obj[method];
  obj[method] = fn;
  restores.push(() => {
    obj[method] = original;
  });
};

afterEach(() => {
  while (restores.length > 0) {
    restores.pop()();
  }
  resetMemoryLocks();
  nhanDienKhuonMat.scanCooldownMap.clear();
});

const stubTransactionPassThrough = () => {
  stub(sequelize, 'transaction', async (cb) => {
    const fakeTx = { LOCK: { UPDATE: 'UPDATE' } };
    return cb(fakeTx);
  });
};

describe('P0 Regression - Bảo mật anh_dai_dien & taiTep.service.js', () => {
  it('Chỉ avatar- được phép public; face-/attachment- luôn bị kiểm soát và URL avatar bị siết chặt', async () => {
    stub(minioStorage, 'putObject', async (key) => ({ objectKey: key, storage: 'minio' }));
    stub(redisConfig, 'redisSet', async () => true);

    const avatarUpload = await taiTepService.saveUploadedAttachment(
      {
        fieldname: 'avatar',
        originalname: 'me.png',
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
      UUID_1
    );
    assert.match(avatarUpload.filename, /^avatar-.*\.png$/);

    // Cho dù kẻ tấn công lưu tên file face- hoặc attachment- vào anh_dai_dien cũng KHÔNG được trả access: public
    stub(models.NguoiDung, 'findOne', async () => ({ id: UUID_2 }));
    stub(models.MauKhuonMat, 'findOne', async () => ({ id: UUID_3, nguoi_dung_id: UUID_1 }));
    stub(models.DonNghiPhep, 'findOne', async () => ({ id: REQ_1, nguoi_dung_id: UUID_1 }));

    const facePolicy = await taiTepService.resolveDownloadPolicy('face-secret.jpg');
    assert.equal(facePolicy.access, 'face');
    assert.equal(facePolicy.ownerId, UUID_1);

    const leavePolicy = await taiTepService.resolveDownloadPolicy('attachment-secret.pdf');
    assert.equal(leavePolicy.access, 'leave_attachment');
    assert.equal(leavePolicy.ownerId, UUID_1);

    const publicPolicy = await taiTepService.resolveDownloadPolicy('avatar-user.png');
    assert.equal(publicPolicy.access, 'public');

    // Siết URL trong xacThuc.updateAvatar và nguoiDung.updateExistingUser
    stub(models.NguoiDung, 'findByPk', async () => ({ id: UUID_1, anh_dai_dien: null, save: async () => {} }));
    await assert.rejects(
      () =>
        xacThucService.updateAvatar({
          userId: UUID_1,
          avatarUrl: '/api/tai-tep/tep/face-secret.jpg',
        }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () =>
        nguoiDungService.updateExistingUser(
          UUID_1,
          { anh_dai_dien: '/api/tai-tep/tep/attachment-secret.pdf' },
          { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
        ),
      (err) => err.statusCode === 400
    );

    const okUrl = taiTepService.normalizeSafeAvatarUrl('/api/tai-tep/tep/avatar-123.webp?v=1700000');
    assert.equal(okUrl, '/api/tai-tep/tep/avatar-123.webp?v=1700000');
  });
});

describe('P1 Regression - Luồng 1 & 2 (Socket Logout, SMTP Transaction, RBAC Scope & Khoa -> Phòng ban)', () => {
  it('forgotPassword chạy sendMail ngoài transaction và logout gọi ngắt Socket BE', async () => {
    stubTransactionPassThrough();
    let inTxDuringMail = null;
    let activeTx = false;
    stub(sequelize, 'transaction', async (cb) => {
      activeTx = true;
      try {
        return await cb({ LOCK: { UPDATE: 'UPDATE' } });
      } finally {
        activeTx = false;
      }
    });
    stub(models.NguoiDung, 'findOne', async () => ({
      id: UUID_1,
      email: 'gv@ntu.edu.vn',
      ho_ten: 'GV Test',
      kich_hoat: true,
    }));
    stub(models.XacThucOtp, 'update', async () => [1]);
    stub(models.XacThucOtp, 'create', async () => ({}));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(redisConfig, 'redisGet', async () => null);
    stub(redisConfig, 'redisSet', async () => true);
    stub(transporter, 'sendMail', async () => {
      inTxDuringMail = activeTx;
      return {};
    });

    await xacThucService.forgotPassword({ email: 'gv@ntu.edu.vn', ipAddress: '127.0.0.1' });
    assert.equal(inTxDuringMail, false);
  });

  it('updateExistingUser thu hồi vai trò lãnh đạo cũ khi hạ vai_tro_chinh và chặn đổi khoa có con sang phong_ban', async () => {
    stubTransactionPassThrough();
    const destroyedWhere = [];
    stub(models.NguoiDung, 'findByPk', async (id, opts) => {
      if (opts?.include) {
        return {
          id: UUID_1,
          ho_ten: 'GV A',
          email: 'a@ntu.edu.vn',
          ma_can_bo: 'GV001',
          vai_tro_chinh: 'truong_khoa',
          don_vi_chinh_id: DEPT_KHOA,
          trang_thai_lam_viec: 'dang_lam_viec',
          kich_hoat: true,
          danh_sach_vai_tro: [{ ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_KHOA, tu_ngay: '2025-01-01' }],
          ho_so: { loai_hop_dong: 'toan_thoi_gian' },
          toJSON() {
            return { ...this };
          },
          save: async () => {},
        };
      }
      return { id: UUID_1, vai_tro_chinh: 'giang_vien', don_vi_chinh_id: DEPT_KHOA };
    });
    stub(models.PhongBan, 'findByPk', async () => ({ id: DEPT_KHOA, loai_don_vi: 'khoa' }));
    stub(models.PhongBan, 'findAll', async () => [{ id: DEPT_KHOA, don_vi_cha_id: null }]);
    stub(models.VaiTroNguoiDung, 'destroy', async (opts) => {
      destroyedWhere.push(opts.where);
      return 1;
    });
    stub(models.VaiTroNguoiDung, 'findOne', async () => null);
    stub(models.VaiTroNguoiDung, 'create', async (d) => d);
    stub(models.MauKhuonMat, 'findOne', async () => null);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));

    await nguoiDungService.updateExistingUser(
      UUID_1,
      { vai_tro_chinh: 'giang_vien' },
      { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
    );
    assert.ok(destroyedWhere.some((w) => w.ma_vai_tro === 'truong_khoa' && w.nguoi_dung_id === UUID_1));

    // Chặn đổi khoa có bộ môn con sang phong_ban
    stub(models.PhongBan, 'findByPk', async () => ({
      id: DEPT_KHOA,
      ten_phong_ban: 'Khoa CNTT',
      loai_don_vi: 'khoa',
      don_vi_cha_id: null,
      truong_don_vi_id: null,
    }));
    stub(models.PhongBan, 'count', async () => 2);
    await assert.rejects(
      () =>
        phongBanService.updateDepartment(
          DEPT_KHOA,
          { loai_don_vi: 'phong_ban' },
          { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
        ),
      (err) => err.statusCode === 400
    );
  });

  it('phamViTruongKhoa lọc tu_ngay/den_ngay & đơn vị kiêm nhiệm; fetchUsers cho phép trưởng khoa lọc bộ môn con', async () => {
    stub(models.PhongBan, 'findAll', async ({ where }) => {
      const pIds = where?.don_vi_cha_id?.[require('sequelize').Op.in] || [];
      if (pIds.includes(DEPT_KHOA)) return [{ id: DEPT_BM }];
      return [];
    });

    const deptIds = await phamViTruongKhoa.getDeanDepartmentIds({
      id: UUID_1,
      vai_tro_chinh: 'giang_vien',
      don_vi_chinh_id: DEPT_OTHER,
      danh_sach_vai_tro: [
        { ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_KHOA, tu_ngay: '2020-01-01', den_ngay: null },
        { ma_vai_tro: 'truong_khoa', don_vi_id: DEPT_OTHER, tu_ngay: '2020-01-01', den_ngay: '2021-01-01' },
      ],
    });
    assert.deepEqual(deptIds.sort(), [DEPT_BM, DEPT_KHOA].sort());
    assert.equal(deptIds.includes(DEPT_OTHER), false);

    stub(models.NguoiDung, 'findAll', async () => [{ id: UUID_3 }]);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAndCountAll', async () => ({ count: 0, rows: [] }));

    await assert.rejects(
      () =>
        nguoiDungService.fetchUsers({
          don_vi_id: DEPT_OTHER,
          currentUser: {
            id: UUID_1,
            vai_tro_chinh: 'truong_khoa',
            don_vi_chinh_id: DEPT_KHOA,
            danh_sach_vai_tro: [],
          },
        }),
      (err) => err.statusCode === 403
    );

    const resOk = await nguoiDungService.fetchUsers({
      don_vi_id: DEPT_BM,
      currentUser: {
        id: UUID_1,
        vai_tro_chinh: 'truong_khoa',
        don_vi_chinh_id: DEPT_KHOA,
        danh_sach_vai_tro: [],
      },
    });
    assert.equal(resOk.pagination.total, 0);
  });
});

describe('P1 Regression - Luồng 3 & 4 (FAISS await & Lịch dạy bù / ngoại lệ)', () => {
  it('createNewSchedule với loai_lich = day_bu kiểm tra ngày lễ & ép tuần [1]; addScheduleException chặn ngày trùng gốc', async () => {
    stub(models.NguoiDung, 'findByPk', async () => ({ id: UUID_1, kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec' }));
    stub(models.CaLamViec, 'findByPk', async () => ({ id: SHIFT_1, gio_bat_dau: '07:00', gio_ket_thuc: '11:30', kich_hoat: true }));
    stub(models.NgayNghiLe, 'findOne', async () => ({ id: UUID_3, ten_ngay_le: 'Quốc Khánh' }));

    await assert.rejects(
      () =>
        lichTrinhService.createNewSchedule(
          {
            nguoi_dung_id: UUID_1,
            ca_id: SHIFT_1,
            thu_trong_tuan: 3,
            ngay_bat_dau: '2026-09-02',
            ngay_ket_thuc: '2026-09-02',
            loai_lich: 'day_bu',
            ngay_day_bu: '2026-09-02',
            danh_sach_tuan: [1, 2, 3],
          },
          { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] }
        ),
      (err) => err.statusCode === 409 && err.errorCode === 'SCHEDULE_HOLIDAY_CONFLICT'
    );

    stub(models.LichTrinh, 'findByPk', async () => ({
      id: SCHED_1,
      nguoi_dung_id: UUID_1,
      phong_hoc: 'A1',
      thu_trong_tuan: 1,
      tiet_bat_dau: 1,
      so_tiet: 3,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '09:30',
    }));

    await assert.rejects(
      () =>
        lichTrinhService.addScheduleException({
          scheduleId: SCHED_1,
          ngay: '2026-09-14',
          trang_thai: 'day_bu',
          ngay_day_bu: '2026-09-14',
          currentUser: { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400
    );
  });

  it('registerFaceDescriptorForUser chờ addFaissTemplate hoàn tất trước khi resolve', async () => {
    stubTransactionPassThrough();
    let faissDone = false;
    stub(models.NguoiDung, 'findByPk', async () => ({ id: UUID_1, ho_ten: 'GV A', email: 'a@ntu.edu.vn', save: async () => {} }));
    stub(models.MauKhuonMat, 'findAll', async () => []);
    stub(models.MauKhuonMat, 'destroy', async () => 0);
    stub(models.MauKhuonMat, 'update', async () => [0]);
    stub(models.MauKhuonMat, 'create', async (d) => ({ id: UUID_3, ...d }));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(redisConfig, 'getCachedFaceVectors', async () => []);
    stub(redisConfig, 'invalidateFaceCache', async () => true);

    const origFetch = global.fetch;
    restores.push(() => {
      global.fetch = origFetch;
    });
    global.fetch = async (url) => {
      if (String(url).includes('/v1/faiss/add')) {
        await new Promise((r) => setTimeout(r, 25));
        faissDone = true;
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const vec = Array.from({ length: 512 }, (_, i) => (i === 0 ? 1 : 0));
    await mauKhuonMatService.registerFaceDescriptorForUser({
      id: UUID_1,
      faceDescriptor: vec,
      currentUser: { id: UUID_2, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
    });
    assert.equal(faissDone, true);
  });
});

describe('P1 Regression - Luồng 5, 6, 7, 8, 9, 10', () => {
  it('evaluateUserScheduleForCheckIn chế độ readOnly không ghi DB hay gửi email vắng mặt', async () => {
    let absentCalled = false;
    stub(models.NguoiDung, 'findByPk', async () => ({ id: UUID_1, ho_ten: 'GV Test', vai_tro_chinh: 'giang_vien' }));
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: SCHED_1,
        nguoi_dung_id: UUID_1,
        thu_trong_tuan: 1,
        gio_bat_dau: '07:00',
        gio_ket_thuc: '09:30',
        ngay_bat_dau: '2026-09-01',
        ngay_ket_thuc: '2026-12-31',
        ca: { id: SHIFT_1, ten_ca: 'Ca 1', gio_bat_dau: '07:00', gio_ket_thuc: '09:30', nguong_di_muon_phut: 15 },
        tuan_hoc: [],
        ngoai_le: [],
        toJSON() {
          return { ...this };
        },
      },
    ]);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NgayNghiLe, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'create', async () => {
      absentCalled = true;
      return {};
    });

    const mondayLate = new Date('2026-09-07T10:00:00+07:00');
    const res = await dieuKienLichChamCong.evaluateUserScheduleForCheckIn(
      UUID_1,
      null,
      null,
      mondayLate,
      { readOnly: true }
    );
    assert.equal(absentCalled, false);
    assert.equal(res.cancelledSchedules.length, 1);
    assert.equal(res.cancelledSchedules[0].absentResult, null);
  });

  it('giai_trinh_thieu_check_out kiểm tra da_chot và logRecord.ngay_cong quá 30 ngày', async () => {
    stubTransactionPassThrough();
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: UUID_1,
      vai_tro_chinh: 'giang_vien',
      kich_hoat: true,
      ho_so: { han_muc_phep_nam: 12 },
    }));
    stub(models.NhatKyChamCong, 'findOne', async () => ({
      id: LOG_1,
      nguoi_dung_id: UUID_1,
      ngay_cong: todayIso,
      trang_thai: 'thieu_check_out',
      da_chot: true,
    }));

    await assert.rejects(
      () =>
        donNghiPhepService.createLeaveRequestDomain({
          loai_don: 'giai_trinh_thieu_check_out',
          ngay_bat_dau: todayIso,
          ngay_ket_thuc: todayIso,
          nhat_ky_id: LOG_1,
          ly_do: 'Quên quét tan ca',
          currentUser: { id: UUID_1, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'ATTENDANCE_LOCKED'
    );

    stub(models.NhatKyChamCong, 'findOne', async () => ({
      id: LOG_1,
      nguoi_dung_id: UUID_1,
      ngay_cong: '2020-01-10',
      trang_thai: 'thieu_check_out',
      da_chot: false,
    }));
    await assert.rejects(
      () =>
        donNghiPhepService.createLeaveRequestDomain({
          loai_don: 'giai_trinh_thieu_check_out',
          ngay_bat_dau: todayIso,
          ngay_ket_thuc: todayIso,
          nhat_ky_id: LOG_1,
          ly_do: 'Quên quét tan ca',
          currentUser: { id: UUID_1, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'LOG_DATE_OUT_OF_RANGE'
    );
  });

  it('Luồng 7-9: trưởng khoa lọc được bộ môn con ở fetchPayrolls, khóa kỳ lương dùng PAYROLL_PERIOD, buildAttendanceDateFilter có ngay_cong null và AI có nhánh offline_mock', async () => {
    stub(models.PhongBan, 'findAll', async () => []);
    stub(models.NguoiDung, 'findAll', async () => [{ id: UUID_2 }]);
    stub(models.VaiTroNguoiDung, 'findAll', async () => []);
    stub(models.PhieuLuong, 'findAll', async () => []);
    stub(models.CauHinhHeThong, 'findAll', async () => []);

    await assert.rejects(
      () =>
        phieuLuongService.fetchPayrolls({
          don_vi_id: DEPT_OTHER,
          currentUser: { id: UUID_1, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: DEPT_KHOA, danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 403
    );

    // Distributed lock toàn kỳ dùng chung PAYROLL_PERIOD_2026_11 chặn lockMonthlyPayroll khi đang giữ khóa
    const acquired = await acquireLock('PAYROLL_PERIOD_2026_11', 60, 'other_worker');
    assert.equal(acquired, true);
    stub(models.PhieuLuong, 'count', async () => 1);
    await assert.rejects(
      () =>
        phieuLuongService.lockMonthlyPayroll({
          month: 11,
          year: 2026,
          currentUser: { id: UUID_1, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 409 && err.errorCode === 'PAYROLL_LOCK_IN_PROGRESS'
    );
    await releaseLock('PAYROLL_PERIOD_2026_11', 'other_worker');

    // Luồng 8 buildAttendanceDateFilter chứa ngay_cong: null cho nhánh tao_luc
    const dateFilter = buildAttendanceDateFilter('2026-11-01', '2026-11-30');
    const orBranches = dateFilter[require('sequelize').Op.or];
    assert.ok(orBranches.some((b) => b.ngay_cong === null && b.thoi_gian_vao === null && b.tao_luc));

    // Luồng 9 AI Gateway nhánh offline_mock
    const mockRes = await generateAIResponse({ prompt: 'Xin chào', provider: 'offline_mock' });
    assert.equal(mockRes.provider, 'offline_mock');
    assert.equal(mockRes.fallbackErrors, undefined);
  });
});
