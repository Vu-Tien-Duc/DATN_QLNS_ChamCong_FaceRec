// Gom các ca giảng dạy trong ngày thành các khối (block) chấm công liên tục.
// Hai ca thuộc cùng khối khi: cùng cơ sở và khoảng cách giữa giờ kết thúc ca trước với giờ bắt đầu ca sau không quá ngưỡng.
// Ca hành chính (loai = 'hanh_chinh') luôn là một khối riêng, không gộp với ca giảng dạy.
const { timeStringToMinutes } = require('./thoiGianChamCong.utils');

const LOAI_GIANG_DAY = 'giang_day';
const LOAI_HANH_CHINH = 'hanh_chinh';
const NGUONG_GOP_KHOI_MAC_DINH_PHUT = 15;

const chuanHoaCoSo = (value) => String(value || '').trim().toLowerCase();

// Gom danh sách đơn vị chấm công thành các khối.
// Mỗi đơn vị: { id, loai, ca_id, gio_bat_dau, gio_ket_thuc, co_so, phong_hoc, so_tiet }
const gomKhoiCaDay = (donViList = [], nguongPhut = NGUONG_GOP_KHOI_MAC_DINH_PHUT) => {
  const nguong = Number.isFinite(Number(nguongPhut)) ? Math.max(0, Number(nguongPhut)) : NGUONG_GOP_KHOI_MAC_DINH_PHUT;

  const donVi = (donViList || [])
    .filter((item) => item && item.gio_bat_dau && item.gio_ket_thuc)
    .map((item) => ({
      ...item,
      _batDau: timeStringToMinutes(item.gio_bat_dau),
      _ketThuc: timeStringToMinutes(item.gio_ket_thuc),
    }))
    .sort((a, b) => a._batDau - b._batDau || a._ketThuc - b._ketThuc);

  const khoiList = [];
  let hienTai = null;

  const dongKhoi = () => {
    if (!hienTai) return;
    khoiList.push({
      loai: hienTai.loai,
      ca_id: hienTai.items[0].ca_id || null,
      lich_trinh_id: hienTai.items[0].id || null,
      ds_lich_trinh_id: hienTai.items.map((it) => it.id).filter(Boolean),
      gio_bat_dau: hienTai.items[0].gio_bat_dau,
      gio_ket_thuc: hienTai.items.find((it) => it._ketThuc === hienTai.ketThuc).gio_ket_thuc,
      co_so: hienTai.items[0].co_so || '',
      phong_hoc: [...new Set(hienTai.items.map((it) => it.phong_hoc).filter(Boolean))],
      so_tiet: hienTai.items.reduce((sum, it) => sum + (Number(it.so_tiet) || 0), 0),
      so_ca: hienTai.items.length,
    });
    hienTai = null;
  };

  for (const item of donVi) {
    const loai = item.loai === LOAI_HANH_CHINH ? LOAI_HANH_CHINH : LOAI_GIANG_DAY;
    const coTheGop =
      hienTai &&
      loai === LOAI_GIANG_DAY &&
      hienTai.loai === LOAI_GIANG_DAY &&
      chuanHoaCoSo(item.co_so) === hienTai.coSo &&
      item._batDau - hienTai.ketThuc <= nguong;

    if (coTheGop) {
      hienTai.items.push(item);
      hienTai.ketThuc = Math.max(hienTai.ketThuc, item._ketThuc);
    } else {
      dongKhoi();
      hienTai = { loai, coSo: chuanHoaCoSo(item.co_so), items: [item], ketThuc: item._ketThuc };
    }
  }
  dongKhoi();

  return khoiList;
};

module.exports = {
  gomKhoiCaDay,
  NGUONG_GOP_KHOI_MAC_DINH_PHUT,
  LOAI_GIANG_DAY,
  LOAI_HANH_CHINH,
};
