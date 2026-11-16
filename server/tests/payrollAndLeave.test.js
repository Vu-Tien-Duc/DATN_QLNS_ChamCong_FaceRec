const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePersonalIncomeTax5Brackets,
  formatPayrollDoc,
} = require('../services/phieuLuong/tinhThueVaLuong.helper');
const { calculateLeaveDays } = require('../services/donNghiPhep/tinhPhepNam.helper');
const { normalizeAttendanceMethod } = require('../utils/thoiGianChamCong.utils');

describe('Payroll Tax & Formatting Helpers', () => {
  it('tính thuế TNCN lũy tiến 5 bậc chính xác theo mặc định và biểu thuế tùy biến từ DB', () => {
    const taxZero = calculatePersonalIncomeTax5Brackets(0);
    assert.equal(taxZero.taxAmount, 0);

    // 15,000,000 -> bậc 2: 15M * 10% - 500k = 1,000,000
    const taxDefault = calculatePersonalIncomeTax5Brackets(15000000);
    assert.equal(taxDefault.bracket, 2);
    assert.equal(taxDefault.taxAmount, 1000000);

    // Biểu thuế tùy biến (tính tự động tru_nhanh): bậc 1: 0-5M (5%), bậc 2: >5M (20%)
    const customBrackets = [
      { bac: 1, tu: 0, den: 5000000, thue_suat: 0.05 },
      { bac: 2, tu: 5000000, den: null, thue_suat: 0.2 },
    ];
    // 10M -> 5M*5% + 5M*20% = 250k + 1M = 1,250,000
    const taxCustom = calculatePersonalIncomeTax5Brackets(10000000, customBrackets);
    assert.equal(taxCustom.taxAmount, 1250000);
  });

  it('tách tỷ lệ bảo hiểm theo cấu hình động trong formatPayrollDoc', () => {
    const formatted = formatPayrollDoc(
      {
        luong_co_ban: 2530000,
        he_so_luong: 2.34,
        dong_bao_hiem: 1000000,
        tong_phu_cap: 0,
        tong_giam_tru: 0,
        tien_vuot_gio: 0,
        thue_thu_nhap_ca_nhan: 0,
        thuc_linh: 4920200,
        trang_thai: 'nhap',
      },
      { ty_le_bhxh: 0.08, ty_le_bhyt: 0.015, ty_le_bhtn: 0.005, tong_ty_le_bao_hiem: 0.1 }
    );

    assert.equal(formatted.bao_hiem.bhxh, 800000);
    assert.equal(formatted.bao_hiem.bhyt, 150000);
    assert.equal(formatted.bao_hiem.bhtn, 50000);
  });
});

describe('Leave Days & Attendance Method Normalization', () => {
  it('loại trừ Chủ nhật và ngày lễ khi tính số ngày nghỉ', () => {
    // 2026-09-07 (Thứ 2) -> 2026-09-13 (Chủ nhật): 7 ngày gồm 1 CN và 1 ngày lễ -> 5 ngày
    const holidays = new Set(['2026-09-09']);
    const days = calculateLeaveDays('2026-09-07', '2026-09-13', false, holidays);
    assert.equal(days, 5);
    assert.equal(calculateLeaveDays('2026-09-07', '2026-09-07', true), 0.5);
  });

  it('chuẩn hóa đầy đủ alias phương thức chấm công sang enum DB', () => {
    assert.equal(normalizeAttendanceMethod('qr'), 'qr_code');
    assert.equal(normalizeAttendanceMethod('gps'), 'gps_mobile');
    assert.equal(normalizeAttendanceMethod('face'), 'face_ai');
    assert.equal(normalizeAttendanceMethod('manual'), 'thu_cong_admin');
    assert.equal(normalizeAttendanceMethod('qr_code'), 'qr_code');
  });
});
