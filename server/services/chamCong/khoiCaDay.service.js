// Xác định khối ca dạy liên tục (block) chứa một lịch trình của giảng viên trong một ngày công
const { Op } = require('sequelize');
const { LichTrinh, LichTrinhTuan, NgoaiLeLichTrinh, CaLamViec, NhatKyChamCong } = require('../../models');
const { getConfigSync } = require('../heThong/cauHinhHeThong.service');
const { getVietnamTime, ServiceError, calculateCheckOutStatus } = require('../../utils/thoiGianChamCong.utils');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const {
  gomKhoiCaDay,
  NGUONG_GOP_KHOI_MAC_DINH_PHUT,
  LOAI_GIANG_DAY,
} = require('../../utils/gomKhoiCaDay.utils');

// Lấy khối ca dạy chứa lịch trình lichTrinhId vào ngày ngayCong (YYYY-MM-DD); trả về null nếu không xác định được
const layKhoiTheoLichTrinh = async (nguoiDungId, lichTrinhId, ngayCong) => {
  if (!nguoiDungId || !lichTrinhId || !ngayCong) return null;

  const dateStr = String(ngayCong).slice(0, 10);
  const refDate = new Date(`${dateStr}T12:00:00+07:00`);
  const weekday = getVietnamTime(refDate).getDay();

  const scheduleIncludes = [
    { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
    { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
  ];

  const [rows, exceptionRows] = await Promise.all([
    LichTrinh.findAll({
      where: {
        nguoi_dung_id: nguoiDungId,
        thu_trong_tuan: weekday,
        ngay_bat_dau: { [Op.lte]: dateStr },
        ngay_ket_thuc: { [Op.gte]: dateStr },
      },
      include: scheduleIncludes,
    }),
    NgoaiLeLichTrinh.findAll({
      where: {
        trang_thai: { [Op.in]: ['day_bu', 'doi_ca'] },
        [Op.or]: [{ ngay_day_bu: dateStr }, { ngay: dateStr }],
      },
      include: [
        { model: LichTrinh, as: 'lich_trinh', required: true, include: scheduleIncludes },
        { model: CaLamViec, as: 'ca_thay_the' },
      ],
    }),
  ]);

  const scheduleMap = new Map();
  for (const row of rows) {
    const plain = row.toJSON();
    if (isScheduleActiveOnDate(plain, refDate)) {
      scheduleMap.set(String(plain.id), plain);
    }
  }
  for (const ex of exceptionRows || []) {
    if (!ex.lich_trinh) continue;
    const isForUser =
      ex.trang_thai === 'day_bu'
        ? String(ex.giang_vien_day_thay_id || ex.lich_trinh.nguoi_dung_id) === String(nguoiDungId)
        : (ex.giang_vien_day_thay_id && String(ex.giang_vien_day_thay_id) === String(nguoiDungId)) ||
          (!ex.giang_vien_day_thay_id && ex.ca_thay_the && String(ex.lich_trinh.nguoi_dung_id) === String(nguoiDungId) &&
            String(ex.ngay_day_bu || ex.ngay).slice(0, 10) === dateStr);
    if (!isForUser) continue;

    const plain = ex.lich_trinh.toJSON();
    plain._isSubstituteOverride = true;
    if (ex.ca_thay_the) {
      plain.ca_id = ex.ca_thay_the.id;
      plain.gio_bat_dau = ex.ca_thay_the.gio_bat_dau;
      plain.gio_ket_thuc = ex.ca_thay_the.gio_ket_thuc;
    }
    if (isScheduleActiveOnDate(plain, refDate)) {
      scheduleMap.set(String(plain.id), plain);
    }
  }

  const donViList = Array.from(scheduleMap.values()).map((row) => ({
    id: String(row.id),
    loai: LOAI_GIANG_DAY,
    ca_id: row.ca_id,
    gio_bat_dau: row.gio_bat_dau,
    gio_ket_thuc: row.gio_ket_thuc,
    co_so: row.co_so,
    phong_hoc: row.phong_hoc,
    so_tiet: row.so_tiet,
  }));

  const rules = getConfigSync('QUY_TAC_DIEM_DANH', {});
  const nguong = Number(rules?.nguong_gop_khoi_phut);
  const khoiList = gomKhoiCaDay(donViList, Number.isFinite(nguong) ? nguong : NGUONG_GOP_KHOI_MAC_DINH_PHUT);

  return khoiList.find((khoi) => khoi.ds_lich_trinh_id.includes(String(lichTrinhId))) || null;
};

// Kiểm tra bản ghi đang mở có được check-out lúc này không. Trả về khối ca và giờ chuẩn dùng để tính về sớm.
// Chỉ cho check-out sau khi ca cuối của khối kết thúc (không có mốc trên) và trước khi check-in khối giảng dạy sau.
const kiemTraChoPhepCheckOut = async ({ nguoiDungId, openLog, now = new Date(), allowManual = false }) => {
  const khoi = await layKhoiTheoLichTrinh(nguoiDungId, openLog.lich_trinh_id, openLog.ngay_cong);
  const khoiConfig = {
    gio_bat_dau: khoi?.gio_bat_dau || openLog.ca?.gio_bat_dau,
    gio_ket_thuc: khoi?.gio_ket_thuc || openLog.ca?.gio_ket_thuc,
  };

  if (allowManual) return { khoi, khoiConfig };

  // Khối sau đã check-in thì check-out của khối trước không còn hợp lệ, chuyển sang thiếu check-out
  const laterLog = openLog.lich_trinh_id
    ? await NhatKyChamCong.findOne({
        where: {
          nguoi_dung_id: nguoiDungId,
          ngay_cong: openLog.ngay_cong,
          id: { [Op.ne]: openLog.id },
          lich_trinh_id: { [Op.ne]: null },
          thoi_gian_vao: { [Op.gt]: openLog.thoi_gian_vao },
        },
      })
    : null;
  const laterInSameBlock = Boolean(
    laterLog && khoi && khoi.ds_lich_trinh_id.includes(String(laterLog.lich_trinh_id))
  );
  if (laterLog && !laterInSameBlock) {
    if (openLog.trang_thai !== 'thieu_check_out') {
      openLog.trang_thai = 'thieu_check_out';
      await openLog.save();
    }
    throw new ServiceError(
      'Khối ca này đã quá hạn check-out vì bạn đã check-in khối ca sau. Vui lòng gửi đơn giải trình để được duyệt công.',
      409,
      'CHECKOUT_BLOCK_SUPERSEDED'
    );
  }

  if (calculateCheckOutStatus(now, khoiConfig, openLog.trang_thai).isEarlyLeave) {
    throw new ServiceError(
      `Chưa hết ca (kết thúc lúc ${String(khoiConfig.gio_ket_thuc).slice(0, 5)}), chưa thể check-out. Nếu cần về sớm, vui lòng gửi đơn giải trình.`,
      409,
      'CHECKOUT_BEFORE_SHIFT_END'
    );
  }

  return { khoi, khoiConfig };
};

module.exports = { layKhoiTheoLichTrinh, kiemTraChoPhepCheckOut };
