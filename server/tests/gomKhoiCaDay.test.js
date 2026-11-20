// Kiểm thử gom các ca giảng dạy trong ngày thành khối chấm công theo khoảng cách giờ và cơ sở.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gomKhoiCaDay } = require('../utils/gomKhoiCaDay.utils');
const { calculateActualTeachingPeriods } = require('../utils/thoiGianChamCong.utils');

const ca = (id, start, end, co_so = 'Gia Lâm', extra = {}) => ({
  id,
  ca_id: `ca-${id}`,
  loai: 'giang_day',
  gio_bat_dau: start,
  gio_ket_thuc: end,
  co_so,
  phong_hoc: `P${id}`,
  so_tiet: 3,
  ...extra,
});

describe('gomKhoiCaDay', () => {
  it('gộp hai ca liền nhau cùng cơ sở thành một khối', () => {
    const blocks = gomKhoiCaDay([ca('a', '07:00', '09:30'), ca('b', '09:30', '12:00')]);
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0].ds_lich_trinh_id, ['a', 'b']);
    assert.equal(blocks[0].gio_bat_dau, '07:00');
    assert.equal(blocks[0].gio_ket_thuc, '12:00');
    assert.equal(blocks[0].so_tiet, 6);
  });

  it('gộp khi có giờ nghỉ giải lao nhỏ hơn hoặc bằng ngưỡng', () => {
    const blocks = gomKhoiCaDay([ca('a', '07:00', '09:30'), ca('b', '09:45', '12:00')]);
    assert.equal(blocks.length, 1);
  });

  it('tách khối khi có khoảng trống lớn hơn ngưỡng', () => {
    const blocks = gomKhoiCaDay([ca('a', '07:00', '09:30'), ca('b', '10:30', '12:00')]);
    assert.equal(blocks.length, 2);
  });

  it('tách khối khi khác cơ sở dù giờ liền nhau', () => {
    const blocks = gomKhoiCaDay([ca('a', '07:00', '09:30', 'Gia Lâm'), ca('b', '09:30', '12:00', 'Láng')]);
    assert.equal(blocks.length, 2);
  });

  it('gộp khi đổi phòng nhưng cùng cơ sở', () => {
    const blocks = gomKhoiCaDay([ca('a', '07:00', '09:30'), ca('b', '09:30', '12:00')]);
    assert.deepEqual(blocks[0].phong_hoc, ['Pa', 'Pb']);
  });

  it('sắp xếp theo giờ trước khi gom và xử lý ví dụ ca 1,2 rồi ca 4', () => {
    const blocks = gomKhoiCaDay([
      ca('c', '14:00', '16:30'),
      ca('b', '09:30', '12:00'),
      ca('a', '07:00', '09:30'),
    ]);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0].ds_lich_trinh_id, ['a', 'b']);
    assert.deepEqual(blocks[1].ds_lich_trinh_id, ['c']);
  });

  it('ca hành chính luôn là khối riêng, không gộp với ca giảng dạy', () => {
    const blocks = gomKhoiCaDay([
      { id: 'hc', ca_id: 'hc', loai: 'hanh_chinh', gio_bat_dau: '07:30', gio_ket_thuc: '11:30', co_so: '' },
      ca('a', '11:30', '14:00', ''),
    ]);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].loai, 'hanh_chinh');
  });

  it('tôn trọng ngưỡng tùy chỉnh', () => {
    const items = [ca('a', '07:00', '09:30'), ca('b', '10:00', '12:00')];
    assert.equal(gomKhoiCaDay(items, 15).length, 2);
    assert.equal(gomKhoiCaDay(items, 30).length, 1);
  });

  it('trả mảng rỗng khi không có ca', () => {
    assert.deepEqual(gomKhoiCaDay([]), []);
  });
});

describe('calculateActualTeachingPeriods với khối nhiều ca', () => {
  const model = { findByPk: async () => ({ so_tiet: 3 }) };

  it('cộng số tiết của mọi ca trong khối', async () => {
    const periods = await calculateActualTeachingPeriods(
      { lichTrinhId: 'a', lichTrinhIds: ['a', 'b'], workingMinutes: 270 },
      model
    );
    assert.equal(periods, 6);
  });

  it('dạy quá giờ không cộng thêm tiết so với số ca đã xếp', async () => {
    const periods = await calculateActualTeachingPeriods(
      { lichTrinhId: 'a', lichTrinhIds: ['a', 'b'], workingMinutes: 400 },
      model
    );
    assert.equal(periods, 6);
  });

  it('vẫn dùng một lịch khi không có danh sách khối', async () => {
    const periods = await calculateActualTeachingPeriods({ lichTrinhId: 'a', workingMinutes: 135 }, model);
    assert.equal(periods, 3);
  });

  it('khấu trừ theo tỷ lệ trên tổng số tiết của khối khi muộn quá 45 phút', async () => {
    const periods = await calculateActualTeachingPeriods(
      { lichTrinhId: 'a', lichTrinhIds: ['a', 'b'], workingMinutes: 210, lateMinutes: 60 },
      model
    );
    assert.equal(periods, 5);
  });
});
