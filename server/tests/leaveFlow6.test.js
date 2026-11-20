// Kiểm thử trọng tâm Luồng 6 (Đơn từ hành chính & Phê duyệt đa cấp): Tạo đơn, Quỹ phép, Duyệt đa cấp, Hồi tố/Hoàn tác công & HTTP Routes.
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key';

const models = require('../models');
const { errorHandler } = require('../middlewares/xuLyLoi.middleware');
const { calculateLeaveDays } = require('../services/donNghiPhep/tinhPhepNam.helper');
const {
  createLeaveRequestDomain,
  fetchSubstituteLecturers,
  validateLeaveApprovalPermission,
  approveLeaveRequestDomain,
  cancelLeaveRequestDomain,
} = require('../services/donNghiPhep/donNghiPhep.service');

const USER_GV = '11111111-1111-4111-8111-111111111111';
const USER_SUB = '22222222-2222-4222-8222-222222222222';
const USER_DEAN = '33333333-3333-4333-8333-333333333333';
const USER_VICE = '44444444-4444-4444-8444-444444444444';
const USER_BGH = '55555555-5555-4555-8555-555555555555';
const SCH_1 = '66666666-6666-4666-8666-666666666666';
const SCH_2 = '77777777-7777-4777-8777-777777777777';
const SHIFT_HC = '88888888-8888-4888-8888-888888888888';
const SHIFT_NIGHT = '99999999-9999-4999-8999-999999999999';
const REQ_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LOG_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEPT_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DEPT_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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

describe('Luồng 6 - Tạo đơn, Quỹ phép năm & Bảo mật tạo đơn', () => {
  it('calculateLeaveDays loại trừ Chủ nhật và Ngày lễ cho cả nghỉ nửa ngày (isHalfDay = true)', () => {
    const holidays = new Set(['2099-09-02']);
    // 2099-09-06 là Chủ nhật, 2099-09-07 là Thứ 2
    assert.equal(calculateLeaveDays('2099-09-06', '2099-09-06', true, holidays), 0);
    assert.equal(calculateLeaveDays('2099-09-02', '2099-09-02', true, holidays), 0);
    assert.equal(calculateLeaveDays('2099-09-07', '2099-09-07', true, holidays), 0.5);
  });

  it('chặn đơn nghỉ 0 ngày, chặn URL tep_dinh_kem độc hại và chặn admin tạo đơn', async () => {
    stub(models.NgayNghiLe, 'findAll', async () => []);

    // Admin không được tạo đơn
    await assert.rejects(
      () =>
        createLeaveRequestDomain({
          loai_don: 'nghi_phep',
          ly_do: 'Xin nghỉ phép cá nhân',
          ngay_bat_dau: '2099-09-07',
          ngay_ket_thuc: '2099-09-07',
          currentUser: { id: USER_GV, vai_tro_chinh: 'admin', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 403 && err.errorCode === 'ADMIN_CANNOT_CREATE_LEAVE'
    );

    // Chặn javascript: trong tep_dinh_kem
    await assert.rejects(
      () =>
        createLeaveRequestDomain({
          loai_don: 'nghi_phep',
          ly_do: 'Xin nghỉ phép cá nhân',
          ngay_bat_dau: '2099-09-07',
          ngay_ket_thuc: '2099-09-07',
          tep_dinh_kem: 'javascript:alert(1)',
          currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'INVALID_ATTACHMENT_URL'
    );

    // Chặn đơn nghỉ chỉ rơi vào Chủ nhật (0 ngày làm việc)
    await assert.rejects(
      () =>
        createLeaveRequestDomain({
          loai_don: 'nghi_phep',
          ly_do: 'Xin nghỉ phép vào Chủ nhật',
          ngay_bat_dau: '2099-09-06',
          ngay_ket_thuc: '2099-09-06',
          currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'ZERO_LEAVE_DAYS'
    );
  });

  it('kiểm tra quỹ phép vắt qua năm mới và cho phép nhiều đơn day_bu/doi_ca khác lịch trong cùng ngày', async () => {
    stub(models.NgayNghiLe, 'findAll', async () => []);
    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_GV,
      ho_ten: 'GV Test',
      don_vi_chinh_id: DEPT_1,
      ho_so: { han_muc_phep_nam: 12 },
    }));
    stub(models.DonNghiPhep, 'findOne', async () => null);

    // Năm 2098 đã dùng 11 ngày, năm 2099 còn 12 ngày -> xin nghỉ 2098-12-30 (T6) đến 2099-01-01 (CN):
    // năm 2098 = 2 ngày (T6, T7) > 1 ngày còn lại -> LEAVE_QUOTA_EXCEEDED
    stub(models.DonNghiPhep, 'findAll', async ({ where }) => {
      if (String(where.ngay_bat_dau?.[Symbol.for('lte')] || '').startsWith('2098')) {
        return [{ loai_don: 'nghi_phep', trang_thai: 'approved', ngay_bat_dau: '2098-03-02', ngay_ket_thuc: '2098-03-13', so_ngay: 11 }];
      }
      return [];
    });

    await assert.rejects(
      () =>
        createLeaveRequestDomain({
          loai_don: 'nghi_phep',
          ly_do: 'Nghỉ phép vắt sang năm mới',
          ngay_bat_dau: '2098-12-30',
          ngay_ket_thuc: '2099-01-01',
          currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 400 && err.errorCode === 'LEAVE_QUOTA_EXCEEDED'
    );

    // Tạo đơn doi_ca cho SCH_2 khi đã có đơn doi_ca khác cho SCH_1 cùng ngày -> phải cho phép và lọc theo lich_trinh_id
    let overlapWhere = null;
    stub(models.LichTrinh, 'findByPk', async (id) => ({
      id,
      nguoi_dung_id: USER_GV,
      phong_hoc: 'A101',
      thu_trong_tuan: 1,
      tiet_bat_dau: 1,
      so_tiet: 3,
      gio_bat_dau: '07:00',
      gio_ket_thuc: '09:30',
      nam_hoc: '2098-2099',
      hoc_ky: 1,
      tuan_hoc: [],
    }));
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findOne', async ({ where }) => {
      overlapWhere = where;
      return null;
    });
    stub(models.DonNghiPhep, 'create', async (data) => ({ id: REQ_1, ...data, toJSON: () => ({ id: REQ_1, ...data }) }));

    const createdSwap = await createLeaveRequestDomain({
      loai_don: 'doi_ca',
      ly_do: 'Đổi lịch dạy lớp thứ 2 trong ngày',
      ngay_bat_dau: '2099-09-07',
      ngay_ket_thuc: '2099-09-07',
      lich_trinh_id: SCH_2,
      ngay_day_bu: '2099-09-08',
      currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
    });
    assert.equal(createdSwap.id, REQ_1);
    assert.equal(overlapWhere.loai_don, 'doi_ca');
    assert.equal(overlapWhere.lich_trinh_id, SCH_2);
  });

  it('kiểm tra sở hữu lich_trinh_id (SCHEDULE_NOT_OWNED) trước khi truy vấn lịch giảng viên dạy thay', async () => {
    let subQueried = false;
    stub(models.LichTrinh, 'findByPk', async () => ({
      id: SCH_1,
      nguoi_dung_id: USER_DEAN, // Không thuộc USER_GV
      tuan_hoc: [],
    }));
    stub(models.NguoiDung, 'findByPk', async () => {
      subQueried = true;
      return { id: USER_SUB, ho_ten: 'Đồng nghiệp', kich_hoat: true };
    });

    await assert.rejects(
      () =>
        createLeaveRequestDomain({
          loai_don: 'doi_ca',
          ly_do: 'Thử truyền lịch của người khác',
          ngay_bat_dau: '2099-09-07',
          ngay_ket_thuc: '2099-09-07',
          lich_trinh_id: SCH_1,
          giang_vien_day_thay_id: USER_SUB,
          currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
        }),
      (err) => err.statusCode === 403 && err.errorCode === 'SCHEDULE_NOT_OWNED'
    );
    assert.equal(subQueried, false);
  });
});

describe('Luồng 6 - Duyệt đa cấp, Hồi tố & Hoàn tác bảng công', () => {
  it('validateLeaveApprovalPermission chặn tự duyệt, phó chưa ủy quyền, ngoài khoa và đơn trưởng khoa', async () => {
    // Tự duyệt
    const selfRes = await validateLeaveApprovalPermission(
      { id: USER_GV, vai_tro_chinh: 'truong_khoa', danh_sach_vai_tro: [] },
      { nguoi_dung_id: USER_GV, trang_thai: 'pending' }
    );
    assert.equal(selfRes.allowed, false);
    assert.equal(selfRes.errorCode, 'CANNOT_APPROVE_OWN_REQUEST');

    // Phó khoa chưa ủy quyền
    stub(models.NguoiDung, 'findByPk', async () => ({ id: USER_GV, vai_tro_chinh: 'giang_vien', don_vi_chinh_id: DEPT_1 }));
    const viceUnauth = await validateLeaveApprovalPermission(
      { id: USER_VICE, vai_tro_chinh: 'pho_khoa', don_vi_chinh_id: DEPT_1, danh_sach_vai_tro: [{ ma_vai_tro: 'pho_khoa', duoc_uy_quyen: false }] },
      { nguoi_dung_id: USER_GV, trang_thai: 'pending' }
    );
    assert.equal(viceUnauth.allowed, false);
    assert.equal(viceUnauth.errorCode, 'UNAUTHORIZED_VICE_DEAN');

    // Trưởng khoa duyệt đơn của Trưởng khoa -> DEAN_LEAVE_REQUIRES_BGH
    stub(models.NguoiDung, 'findByPk', async () => ({ id: USER_DEAN, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: DEPT_1 }));
    const deanLeave = await validateLeaveApprovalPermission(
      { id: USER_VICE, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: DEPT_1, danh_sach_vai_tro: [] },
      { nguoi_dung_id: USER_DEAN, trang_thai: 'pending' }
    );
    assert.equal(deanLeave.allowed, false);
    assert.equal(deanLeave.errorCode, 'DEAN_LEAVE_REQUIRES_BGH');

    // Ngoài khoa -> OUT_OF_DEPARTMENT_SCOPE
    stub(models.NguoiDung, 'findByPk', async () => ({ id: USER_GV, vai_tro_chinh: 'giang_vien', don_vi_chinh_id: DEPT_2 }));
    stub(models.PhongBan, 'findAll', async () => [{ id: DEPT_1, don_vi_cha_id: null }]);
    const outScope = await validateLeaveApprovalPermission(
      { id: USER_DEAN, vai_tro_chinh: 'truong_khoa', don_vi_chinh_id: DEPT_1, danh_sach_vai_tro: [] },
      { nguoi_dung_id: USER_GV, trang_thai: 'pending' }
    );
    assert.equal(outScope.allowed, false);
    assert.equal(outScope.errorCode, 'OUT_OF_DEPARTMENT_SCOPE');
  });

  it('cán bộ kiêm nhiệm nghỉ nhiều ngày: hồi tố cả lịch giảng dạy lẫn ngày hành chính, đồng thời nghỉ nửa ngày không xóa ca đã dạy', async () => {
    // Trưởng khoa nghỉ 2099-09-07 (T2, có lịch dạy SCH_1) đến 2099-09-09 (T4, không có lịch dạy -> phải tạo excused_absence hành chính)
    const createdLogs = [];
    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.NgayNghiLe, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'findAll', async () => []);
    stub(models.DonNghiPhep, 'update', async () => [1]);
    stub(models.LichSuDuyetDon, 'create', async () => ({}));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.CaLamViec, 'findOne', async () => ({ id: SHIFT_HC, gio_bat_dau: '08:00', gio_ket_thuc: '17:00' }));
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: SCH_1,
        nguoi_dung_id: USER_DEAN,
        ca_id: SHIFT_HC,
        thu_trong_tuan: 1, // Thứ 2 (2099-09-07)
        ngay_bat_dau: '2099-09-01',
        ngay_ket_thuc: '2099-09-30',
        gio_bat_dau: '07:00',
        gio_ket_thuc: '09:30',
        so_tiet: 3,
        tuan_hoc: [],
        ngoai_le: [],
        toJSON() {
          return { ...this };
        },
      },
    ]);
    stub(models.NhatKyChamCong, 'findOne', async () => null);
    stub(models.NhatKyChamCong, 'create', async (d) => {
      createdLogs.push(d);
      return d;
    });
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_DEAN,
      ho_ten: 'Trưởng khoa',
      vai_tro_chinh: 'truong_khoa',
      ho_so: { han_muc_phep_nam: 12, loai_nhan_su: 'giang_vien' },
    }));

    const fullReq = {
      id: REQ_1,
      nguoi_dung_id: USER_DEAN,
      loai_don: 'nghi_phep',
      ngay_bat_dau: '2099-09-07',
      ngay_ket_thuc: '2099-09-09',
      so_ngay: 3,
      trang_thai: 'pending_bgh',
      cap_nhat_luc: '2099-09-01T00:00:00.000Z',
    };
    stub(models.DonNghiPhep, 'findByPk', async (id, opts) =>
      opts?.include ? { ...fullReq, trang_thai: 'approved', lich_su_duyet: [{ cap_duyet: 'bgh', thoi_diem: new Date() }] } : fullReq
    );

    await approveLeaveRequestDomain({
      id: REQ_1,
      ghi_chu_duyet: 'BGH đồng ý',
      currentUser: { id: USER_BGH, vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] },
    });

    assert.equal(createdLogs.length, 3);
    assert.deepEqual(
      createdLogs.map((l) => [l.ngay_cong, l.lich_trinh_id || null]),
      [
        ['2099-09-07', SCH_1],
        ['2099-09-08', null],
        ['2099-09-09', null],
      ]
    );

    // Kiểm tra nghỉ nửa ngày (0.5): chỉ hồi tố 1 ca chưa có giờ vào, bỏ qua ca đã đi dạy
    const halfLogs = [];
    stub(models.LichTrinh, 'findAll', async () => [
      {
        id: SCH_1,
        nguoi_dung_id: USER_GV,
        ca_id: SHIFT_HC,
        thu_trong_tuan: 1,
        ngay_bat_dau: '2099-09-01',
        ngay_ket_thuc: '2099-09-30',
        tuan_hoc: [],
        ngoai_le: [],
        toJSON() {
          return { ...this };
        },
      },
      {
        id: SCH_2,
        nguoi_dung_id: USER_GV,
        ca_id: SHIFT_HC,
        thu_trong_tuan: 1,
        ngay_bat_dau: '2099-09-01',
        ngay_ket_thuc: '2099-09-30',
        tuan_hoc: [],
        ngoai_le: [],
        toJSON() {
          return { ...this };
        },
      },
    ]);
    stub(models.NhatKyChamCong, 'findOne', async ({ where }) => {
      if (where.lich_trinh_id === SCH_1) {
        return {
          id: 'taught-morning',
          thoi_gian_vao: new Date('2099-09-07T07:00:00+07:00'),
          trang_thai: 'on_time',
          save: async () => {
            throw new Error('Không được ghi đè ca sáng đã đi dạy!');
          },
        };
      }
      return null;
    });
    stub(models.NhatKyChamCong, 'create', async (d) => {
      halfLogs.push(d);
      return d;
    });

    const halfReq = {
      id: REQ_1,
      nguoi_dung_id: USER_GV,
      loai_don: 'nghi_phep',
      ngay_bat_dau: '2099-09-07',
      ngay_ket_thuc: '2099-09-07',
      so_ngay: 0.5,
      trang_thai: 'pending',
    };
    stub(models.NguoiDung, 'findByPk', async () => ({
      id: USER_GV,
      ho_ten: 'GV',
      vai_tro_chinh: 'giang_vien',
      ho_so: { han_muc_phep_nam: 12, loai_nhan_su: 'giang_vien' },
    }));
    stub(models.DonNghiPhep, 'findByPk', async (_id, opts) =>
      opts?.include ? { ...halfReq, trang_thai: 'approved', lich_su_duyet: [] } : halfReq
    );

    await approveLeaveRequestDomain({
      id: REQ_1,
      ghi_chu_duyet: 'Duyệt nghỉ nửa buổi chiều',
      currentUser: { id: USER_BGH, vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] },
    });
    assert.equal(halfLogs.length, 1);
    assert.equal(halfLogs[0].lich_trinh_id, SCH_2);
  });

  it('giai_trinh_thieu_check_out ca hành chính qua đêm cộng +1 ngày cho giờ tan ca và giữ trạng thái late', async () => {
    const missingLog = {
      id: LOG_1,
      nguoi_dung_id: USER_GV,
      ca_id: SHIFT_NIGHT,
      lich_trinh_id: null,
      ngay_cong: '2026-11-18',
      thoi_gian_vao: new Date('2026-11-18T22:15:00+07:00'),
      thoi_gian_ra: null,
      di_muon_phut: 15,
      trang_thai: 'thieu_check_out',
      da_chot: false,
      save: async () => missingLog,
    };
    const reqDoc = {
      id: REQ_1,
      nguoi_dung_id: USER_GV,
      loai_don: 'giai_trinh_thieu_check_out',
      nhat_ky_id: LOG_1,
      ngay_bat_dau: '2026-11-18',
      ngay_ket_thuc: '2026-11-18',
      so_ngay: 1,
      so_tiet_nghi: 0,
      trang_thai: 'pending',
    };

    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.DonNghiPhep, 'findByPk', async (_id, opts) =>
      opts?.include ? { ...reqDoc, trang_thai: 'approved', lich_su_duyet: [] } : reqDoc
    );
    stub(models.DonNghiPhep, 'update', async () => [1]);
    stub(models.LichSuDuyetDon, 'create', async () => ({}));
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NhatKyChamCong, 'findByPk', async () => missingLog);
    stub(models.CaLamViec, 'findByPk', async () => ({ gio_bat_dau: '22:00', gio_ket_thuc: '06:00' }));
    stub(models.NguoiDung, 'findByPk', async () => ({ id: USER_GV, ho_ten: 'Bảo vệ' }));

    await approveLeaveRequestDomain({
      id: REQ_1,
      ghi_chu_duyet: 'Xác nhận ca đêm',
      currentUser: { id: USER_BGH, vai_tro_chinh: 'bgh', danh_sach_vai_tro: [] },
    });

    assert.equal(missingLog.trang_thai, 'late');
    assert.equal(missingLog.thoi_gian_ra.toISOString(), new Date('2026-11-19T06:00:00+07:00').toISOString());
    assert.equal(missingLog.thoi_luong_lam_viec_phut, 465);
  });

  it('hủy đơn nghi_phep khôi phục bản ghi absent gốc (không xóa mất) và khôi phục giờ vào/ra từ LuotQuetChamCong', async () => {
    let destroyedAbsent = false;
    const absentOriginLog = {
      id: 'log-absent',
      nguoi_dung_id: USER_GV,
      ca_id: SHIFT_HC,
      lich_trinh_id: null,
      ngay_cong: '2099-09-07',
      thoi_gian_vao: null,
      thoi_gian_ra: null,
      nguoi_ghi_de_id: null,
      ly_do_ghi_de: 'Nghỉ phép có đơn được duyệt (Hồi tố từ vắng)',
      trang_thai: 'excused_absence',
      don_tu_id: REQ_1,
      da_chot: false,
      destroy: async () => {
        destroyedAbsent = true;
      },
      save: async () => absentOriginLog,
    };

    const punchedLog = {
      id: 'log-punched',
      nguoi_dung_id: USER_GV,
      ca_id: SHIFT_HC,
      lich_trinh_id: SCH_1,
      ngay_cong: '2099-09-08',
      thoi_gian_vao: null,
      thoi_gian_ra: null,
      trang_thai: 'excused_absence',
      don_tu_id: REQ_1,
      da_chot: false,
      save: async () => punchedLog,
    };

    const approvedReq = {
      id: REQ_1,
      nguoi_dung_id: USER_GV,
      loai_don: 'nghi_phep',
      ngay_bat_dau: '2099-09-07',
      ngay_ket_thuc: '2099-09-08',
      trang_thai: 'approved',
      cap_nhat_luc: '2099-09-01T00:00:00.000Z',
    };

    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.DonNghiPhep, 'findByPk', async (_id, opts) =>
      opts?.include ? { ...approvedReq, trang_thai: 'cancelled', lich_su_duyet: [] } : approvedReq
    );
    stub(models.DonNghiPhep, 'update', async () => [1]);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NhatKyChamCong, 'findAll', async () => [absentOriginLog, punchedLog]);
    stub(models.LuotQuetChamCong, 'findAll', async ({ where }) => {
      if (where.cham_cong_id === 'log-absent') return [];
      return [
        { loai_quet: 'check_in', thoi_gian_quet: new Date('2099-09-08T07:10:00+07:00') },
        { loai_quet: 'check_out', thoi_gian_quet: new Date('2099-09-08T09:35:00+07:00') },
      ];
    });
    stub(models.LichTrinh, 'findAll', async () => []);
    stub(models.NgoaiLeLichTrinh, 'findAll', async () => []);
    stub(models.CaLamViec, 'findByPk', async () => ({ gio_bat_dau: '07:00', gio_ket_thuc: '09:30' }));
    stub(models.LichTrinh, 'findByPk', async () => ({ so_tiet: 3 }));

    await cancelLeaveRequestDomain({
      id: REQ_1,
      currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
    });

    assert.equal(destroyedAbsent, false);
    assert.equal(absentOriginLog.trang_thai, 'absent');
    assert.equal(absentOriginLog.don_tu_id, null);

    assert.equal(punchedLog.trang_thai, 'late');
    assert.equal(punchedLog.di_muon_phut, 10);
    assert.equal(punchedLog.ve_som_phut, 0);
    assert.equal(punchedLog.so_tiet_thuc_day, 3);
    assert.equal(punchedLog.don_tu_id, null);
    assert.ok(punchedLog.thoi_gian_vao);
    assert.ok(punchedLog.thoi_gian_ra);
  });

  it('hủy đơn doi_ca chỉ xóa đúng ngoại lệ gắn với đơn (#id), không xóa nhầm ngoại lệ khác', async () => {
    let destroyWheres = [];
    const swapReq = {
      id: REQ_1,
      nguoi_dung_id: USER_GV,
      loai_don: 'doi_ca',
      lich_trinh_id: SCH_1,
      ngay_bat_dau: '2099-09-07',
      ngay_ket_thuc: '2099-09-07',
      ngay_day_bu: '2099-09-09',
      trang_thai: 'approved',
    };
    stub(models.sequelize, 'transaction', async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
    stub(models.DonNghiPhep, 'findByPk', async (_id, opts) =>
      opts?.include ? { ...swapReq, trang_thai: 'cancelled', lich_su_duyet: [] } : swapReq
    );
    stub(models.DonNghiPhep, 'update', async () => [1]);
    stub(models.NhatKyChamCong, 'findAll', async () => []);
    stub(models.NhatKyKiemToan, 'create', async () => ({}));
    stub(models.NgoaiLeLichTrinh, 'destroy', async ({ where }) => {
      destroyWheres.push(where);
      return 1;
    });

    await cancelLeaveRequestDomain({
      id: REQ_1,
      currentUser: { id: USER_GV, vai_tro_chinh: 'giang_vien', danh_sach_vai_tro: [] },
    });

    assert.equal(destroyWheres.length, 2);
    for (const w of destroyWheres) {
      assert.ok(w.ly_do);
    }
  });
});

describe('Luồng 6 - Integration Express Routes, RBAC, Optimistic Locking & Giảng viên dạy thay', () => {
  const createTestApp = () => {
    const leaveRoutes = require('../routes/donNghiPhep.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/don-nghi-phep', leaveRoutes);
    app.use(errorHandler);
    return app;
  };

  const dispatchExpress = async (app, { method = 'GET', url, headers = {}, jsonBody = null }) => {
    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) reqHeaders[k.toLowerCase()] = v;
    const rawBody = jsonBody !== null ? Buffer.from(JSON.stringify(jsonBody), 'utf8') : Buffer.alloc(0);
    if (jsonBody !== null) {
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
        let body = text;
        try {
          body = JSON.parse(text);
        } catch {}
        resolve({ status: res.statusCode, body });
      };
      app(req, res);
    });
  };

  const signUser = (role, id = USER_GV) =>
    jwt.sign({ id, vai_tro_chinh: role }, process.env.JWT_SECRET, { expiresIn: '10m' });

  it('RBAC tạo đơn, route GET /giang-vien-day-thay cho giảng viên và Optimistic Locking 409', async () => {
    stub(models.NguoiDung, 'findByPk', async (id) => ({
      id,
      ho_ten: 'Test User',
      vai_tro_chinh: id === 'bgh-id' ? 'bgh' : 'giang_vien',
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      danh_sach_vai_tro: [],
    }));
    stub(models.NguoiDung, 'findAll', async () => [{ id: USER_SUB, ho_ten: 'GV B', ma_can_bo: 'GV02' }]);
    stub(models.DonNghiPhep, 'findByPk', async () => ({
      id: REQ_1,
      nguoi_dung_id: USER_GV,
      trang_thai: 'pending',
      cap_nhat_luc: '2099-09-01T10:00:00.000Z',
    }));

    const app = createTestApp();
    const bghToken = signUser('bgh', 'bgh-id');
    const gvToken = signUser('giang_vien', USER_GV);

    // 1. BGH không có DON_TU:TAO -> bị middleware chặn 403
    const rBghCreate = await dispatchExpress(app, {
      method: 'POST',
      url: '/api/don-nghi-phep',
      headers: { Authorization: `Bearer ${bghToken}` },
      jsonBody: { loai_don: 'nghi_phep', ly_do: 'Xin nghỉ phép', ngay_bat_dau: '2099-09-07', ngay_ket_thuc: '2099-09-07' },
    });
    assert.equal(rBghCreate.status, 403);

    // 2. Giảng viên lấy danh sách giảng viên dạy thay -> 200
    const rSubs = await dispatchExpress(app, {
      url: '/api/don-nghi-phep/giang-vien-day-thay',
      headers: { Authorization: `Bearer ${gvToken}` },
    });
    assert.equal(rSubs.status, 200);
    assert.equal(rSubs.body.data.length, 1);
    assert.equal(rSubs.body.data[0].id, USER_SUB);

    // 3. Optimistic Locking Conflict (409) khi truyền sai phien_ban
    const rConflict = await dispatchExpress(app, {
      method: 'PUT',
      url: `/api/don-nghi-phep/${REQ_1}/phe-duyet`,
      headers: { Authorization: `Bearer ${bghToken}` },
      jsonBody: { ghi_chu_duyet: 'OK', phien_ban: 12345 },
    });
    assert.equal(rConflict.status, 409);
    assert.equal(rConflict.body.errorCode, 'OPTIMISTIC_LOCK_CONFLICT');
  });
});
