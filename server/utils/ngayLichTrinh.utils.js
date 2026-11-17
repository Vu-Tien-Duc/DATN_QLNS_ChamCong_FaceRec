// Kiểm tra lịch trình có hiệu lực trong ngày dựa theo tuần học và các ngoại lệ nghỉ, hủy, dạy thay.
const { getVietnamTime } = require('./thoiGianChamCong.utils');

// Kiểm tra lịch trình có hoạt động trong ngày dựa trên tuần học và ngoại lệ
const isScheduleActiveOnDate = (schedule, date = new Date()) => {
  const startDate = schedule?.ngay_bat_dau || schedule?.startDate;
  if (!schedule || !startDate) return true;

  const vnDate = getVietnamTime(date);
  const checkTime = new Date(Date.UTC(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate())).getTime();

  // Kiểm tra ngày ngoại lệ (nghỉ, hủy, dạy bù, đổi ca)
  const exceptions = schedule.ngoai_le || schedule.exceptions || [];
  if (Array.isArray(exceptions) && exceptions.length > 0) {
    const isMakeupToday = exceptions.some((ex) => {
      const status = ex.trang_thai || ex.status;
      if (status !== 'day_bu') return false;
      const d = ex.ngay_day_bu || (!ex.ngay_day_bu ? (ex.ngay || ex.date) : null);
      if (!d) return false;
      const exVn = getVietnamTime(d);
      const exTime = new Date(Date.UTC(exVn.getFullYear(), exVn.getMonth(), exVn.getDate())).getTime();
      return exTime === checkTime;
    });
    if (isMakeupToday) return true;

    const isExcluded = exceptions.some((ex) => {
      const d = ex.ngay || ex.date;
      if (!d) return false;
      const exVn = getVietnamTime(d);
      const exTime = new Date(Date.UTC(exVn.getFullYear(), exVn.getMonth(), exVn.getDate())).getTime();
      if (exTime !== checkTime) return false;
      const st = ex.trang_thai || ex.status;
      if (['nghi', 'huy'].includes(st)) return true;
      // Nếu có giảng viên khác dạy thay (doi_ca), bỏ qua khỏi lịch chính của giảng viên gốc (trừ khi đã gán đè sang người dạy thay)
      if (st === 'doi_ca' && !schedule._isSubstituteOverride) {
        if (ex.giang_vien_day_thay_id && String(ex.giang_vien_day_thay_id) !== String(schedule.nguoi_dung_id)) {
          return true;
        }
        if (ex.ngay_day_bu && String(ex.ngay_day_bu).slice(0, 10) !== String(d).slice(0, 10)) {
          return true;
        }
      }
      return false;
    });
    if (isExcluded) return false;
  }

  // Kiểm tra lịch có nằm trong danh sách tuần học áp dụng
  const rawWeeks =
    schedule.danh_sach_tuan ||
    schedule.weekNumbers ||
    (Array.isArray(schedule.tuan_hoc) ? schedule.tuan_hoc.map((w) => w.tuan_thu) : null);
  if (Array.isArray(rawWeeks) && rawWeeks.length > 0) {
    const startVn = getVietnamTime(startDate);
    const startTime = new Date(Date.UTC(startVn.getFullYear(), startVn.getMonth(), startVn.getDate())).getTime();
    const diffDays = Math.round((checkTime - startTime) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return false;
    const currentWeekNum = Math.floor(diffDays / 7) + 1;
    if (!rawWeeks.includes(currentWeekNum)) {
      return false;
    }
  }

  return true;
};

module.exports = {
  isScheduleActiveOnDate,
};
