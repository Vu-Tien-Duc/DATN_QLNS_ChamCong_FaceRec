// Kiểm thử hồi quy khóa phân tán, ca qua đêm, tính tiết dạy, bảng lương thỉnh giảng và chống Excel Formula Injection.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { withDistributedLock, resetMemoryLocks } = require('../utils/khoaPhanTan');
const {
  calculateCheckOutStatus,
  calculateActualTeachingPeriods,
} = require('../utils/thoiGianChamCong.utils');
const { isScheduleActiveOnDate } = require('../utils/ngayLichTrinh.utils');
const { formatPayrollDoc, calculateUserPayroll, getPayrollConfigParams } = require('../services/phieuLuong/tinhThueVaLuong.helper');
const caLamViecService = require('../services/nhanSu/caLamViec.service');
const { PhieuLuong, DonNghiPhep, NhatKyChamCong } = require('../models');
const { sanitizeExcelCell, sanitizeExcelRow } = require('../services/baoCao/dinhDangBaoCao.helper');
const { isSystemAdminUser } = require('../utils/vaiTro.utils');
const { canManageSchoolDocuments } = require('../services/ai/khoTriThucRag.service');

describe('Regression: Concurrency Lock & Module Exports', () => {
  it('ngăn 2 coroutine trong cùng tiến trình Node giữ cùng khóa phân tán In-Memory', async () => {
    resetMemoryLocks();
    const lockKey = `test_lock_${Date.now()}`;
    let secondEntered = false;

    const firstTask = withDistributedLock(
      lockKey,
      5,
      async () => {
        const secondResult = await withDistributedLock(
          lockKey,
          5,
          async () => {
            secondEntered = true;
            return 'SECOND_OK';
          },
          { throwOnBusy: false }
        );
        assert.equal(secondResult, null);
        return 'FIRST_OK';
      },
      { throwOnBusy: false }
    );

    assert.equal(await firstTask, 'FIRST_OK');
    assert.equal(secondEntered, false);
  });

  it('caLamViecService luôn export ServiceError cho controller xử lý lỗi', () => {
    assert.equal(typeof caLamViecService.ServiceError, 'function');
  });
});

describe('Regression: Overnight Shift, Teaching Periods & Schedule Dates', () => {
  it('tính trạng thái check-out chính xác cho ca làm việc qua đêm (22:00 -> 06:00)', () => {
    const overnightShift = { gio_bat_dau: '22:00', gio_ket_thuc: '06:00' };

    const earlyCheckOut = calculateCheckOutStatus('2026-11-18T05:30:00+07:00', overnightShift, 'on_time');
    assert.equal(earlyCheckOut.isEarlyLeave, true);
    assert.equal(earlyCheckOut.earlyMinutes, 30);
    assert.equal(earlyCheckOut.finalStatus, 'early_leave');

    const beforeMidnightCheckOut = calculateCheckOutStatus('2026-11-17T23:30:00+07:00', overnightShift, 'on_time');
    assert.equal(beforeMidnightCheckOut.isEarlyLeave, true);
    assert.equal(beforeMidnightCheckOut.earlyMinutes, 390);

    const onTimeCheckOut = calculateCheckOutStatus('2026-11-18T06:05:00+07:00', overnightShift, 'on_time');
    assert.equal(onTimeCheckOut.isEarlyLeave, false);
    assert.equal(onTimeCheckOut.earlyMinutes, 0);
    assert.equal(onTimeCheckOut.finalStatus, 'on_time');
  });

  it('không ép sàn 0.5 tiết khi về quá sớm (> 45 phút)', async () => {
    const mockScheduleModel = {
      findByPk: async () => ({ so_tiet: 3 }),
    };
    const periodsWorked5Min = await calculateActualTeachingPeriods(
      { lichTrinhId: 'sched-1', workingMinutes: 5, earlyMinutes: 130 },
      mockScheduleModel
    );
    assert.equal(periodsWorked5Min, 0);
  });

  it('trả về false với ngày trước ngay_bat_dau và không đánh dấu nhầm ngày nghỉ là ngày dạy bù', () => {
    const schedule = {
      ngay_bat_dau: '2026-09-14',
      danh_sach_tuan: [1, 2],
      ngoai_le: [
        { trang_thai: 'day_bu', ngay: '2026-09-14', ngay_day_bu: '2026-09-20' },
      ],
    };

    assert.equal(isScheduleActiveOnDate(schedule, '2026-09-07T08:00:00+07:00'), false);
    assert.equal(isScheduleActiveOnDate(schedule, '2026-09-20T08:00:00+07:00'), true);
  });
});

describe('Regression: Payroll Visiting Lecturer, Leave 0 Days & Output Sanitization', () => {
  it('cho phép he_so_luong = 0 đối với giảng viên thỉnh giảng và giữ nguyên 0 khi format', async () => {
    const uid = crypto.randomUUID();
    const record = PhieuLuong.build({
      nguoi_dung_id: uid,
      thang: 11,
      nam: 2026,
      nguoi_lap_id: uid,
      luong_co_ban: 2530000,
      he_so_luong: 0,
    });
    await assert.doesNotReject(() => record.validate());

    const formatted = formatPayrollDoc({
      luong_co_ban: 2530000,
      he_so_luong: 0,
      dong_bao_hiem: 0,
      tong_phu_cap: 0,
      tong_giam_tru: 0,
      tien_vuot_gio: 0,
      thue_thu_nhap_ca_nhan: 0,
      thuc_linh: 0,
      trang_thai: 'nhap',
    });
    assert.equal(formatted.he_so_luong, 0);
    assert.equal(formatted.luong_chinh, 0);
  });

  it('cho phép DonNghiPhep.so_ngay = 0 cho đơn dạy bù hoặc giải trình vào ngày nghỉ', async () => {
    const uid = crypto.randomUUID();
    const reqDoc = DonNghiPhep.build({
      nguoi_dung_id: uid,
      loai_don: 'day_bu',
      ly_do: 'Đăng ký dạy bù cuối tuần',
      ngay_bat_dau: '2026-11-15',
      ngay_ket_thuc: '2026-11-15',
      so_ngay: 0,
    });
    await assert.doesNotReject(() => reqDoc.validate());
  });

  it('chống Excel Formula Injection cho các ô chuỗi bắt đầu bằng =, +, -, @', () => {
    assert.equal(sanitizeExcelCell('=CMD("calc")'), "'=CMD(\"calc\")");
    assert.equal(sanitizeExcelCell('+1+1'), "'+1+1");
    assert.equal(sanitizeExcelCell('-100'), "'-100");
    assert.equal(sanitizeExcelCell('@SUM(A1:A2)'), "'@SUM(A1:A2)");
    assert.equal(sanitizeExcelCell(-100), -100);

    const row = sanitizeExcelRow({ fullName: '=HYPERLINK("http://evil")', amount: 500000 });
    assert.equal(row.fullName, "'=HYPERLINK(\"http://evil\")");
    assert.equal(row.amount, 500000);
  });
});

describe('Regression: Multi-Role RBAC, Per-Shift Payroll & Late Period Deduction', () => {
  it('nhận diện đúng isSystemAdminUser và canManageSchoolDocuments theo vai trò đang hiệu lực', () => {
    const expiredLeader = {
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [{ ma_vai_tro: 'bgh', den_ngay: '2020-01-01' }],
    };
    const activeMultiRoleAdmin = {
      vai_tro_chinh: 'giang_vien',
      danh_sach_vai_tro: [{ ma_vai_tro: 'bgh', tu_ngay: '2025-01-01', den_ngay: '2099-12-31' }],
    };
    assert.equal(isSystemAdminUser(expiredLeader), false);
    assert.equal(isSystemAdminUser(activeMultiRoleAdmin), true);
    assert.equal(canManageSchoolDocuments(expiredLeader), false);
    assert.equal(canManageSchoolDocuments(activeMultiRoleAdmin), true);
  });

  it('khấu trừ số tiết giảng dạy khi đi muộn quá 45 phút', async () => {
    const mockScheduleModel = { findByPk: async () => ({ so_tiet: 3 }) };
    const periodsLate60Min = await calculateActualTeachingPeriods(
      { lichTrinhId: 'sched-2', workingMinutes: 75, earlyMinutes: 0, lateMinutes: 60 },
      mockScheduleModel
    );
    assert.equal(periodsLate60Min, 2);
  });

  it('tính vắng theo từng ca trong ngày và khấu trừ lương với đơn việc riêng không hưởng lương', async () => {
    const origAttFindAll = NhatKyChamCong.findAll;
    const origLeaveFindAll = DonNghiPhep.findAll;
    const leaveIdUnpaid = crypto.randomUUID();
    const leaveIdPaid = crypto.randomUUID();

    NhatKyChamCong.findAll = async () => [
      // Ngày 1: 2 ca (1 đi làm, 1 vắng không phép) -> 0.5 ngày vắng
      { ngay_cong: '2026-11-02', trang_thai: 'on_time', so_tiet_thuc_day: 3, don_tu_id: null },
      { ngay_cong: '2026-11-02', trang_thai: 'absent', so_tiet_thuc_day: 0, don_tu_id: null },
      // Ngày 2: 1 ca nghỉ việc riêng không lương -> 1.0 ngày vắng khấu trừ
      { ngay_cong: '2026-11-03', trang_thai: 'excused_absence', so_tiet_thuc_day: 0, don_tu_id: leaveIdUnpaid },
      // Ngày 3: 1 ca nghỉ phép năm có hưởng lương -> 0 ngày khấu trừ
      { ngay_cong: '2026-11-04', trang_thai: 'excused_absence', so_tiet_thuc_day: 0, don_tu_id: leaveIdPaid },
    ];
    DonNghiPhep.findAll = async () => [
      { id: leaveIdUnpaid, loai_don: 'viec_rieng' },
      { id: leaveIdPaid, loai_don: 'nghi_phep' },
    ];

    try {
      const configParams = await getPayrollConfigParams().catch(() => ({
        luong_co_so: 2340000,
        dinh_muc_thang: 27,
        don_gia_gio_chuan: 120000,
        so_ngay_cong_chuan: 22,
        luong_toi_thieu_vung: 4960000,
        ty_le_bhxh: 0.08,
        ty_le_bhyt: 0.015,
        ty_le_bhtn: 0.01,
        tong_ty_le_bao_hiem: 0.105,
        giam_tru_ban_than: 11000000,
        giam_tru_phu_thuoc: 4400000,
        ty_le_uu_dai_map: { giang_vien: 0.3, hanh_chinh: 0 },
        phu_cap_chuc_vu_map: {},
        chuc_vu_list: [],
        bieu_thue_5_bac: [],
      }));

      const result = await calculateUserPayroll({
        user: {
          id: crypto.randomUUID(),
          vai_tro_chinh: 'giang_vien',
          ho_so: { he_so_luong: 2.34, loai_nhan_su: 'giang_vien', loai_hop_dong: 'toan_thoi_gian' },
        },
        month: 11,
        year: 2026,
        configParams,
        createdBy: crypto.randomUUID(),
      });

      assert.equal(result.payrollFields.so_cong_thuc_te, 1.5);
      assert.ok(result.payrollFields.tong_giam_tru > 0);
    } finally {
      NhatKyChamCong.findAll = origAttFindAll;
      DonNghiPhep.findAll = origLeaveFindAll;
    }
  });
});
