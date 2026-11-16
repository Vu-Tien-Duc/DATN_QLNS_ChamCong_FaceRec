const { getVietnamTime } = require('./thoiGianChamCong.utils');

/**
 * Kiểm tra xem một lịch trình có đang trong tuần học áp dụng và không rơi vào ngày nghỉ/hủy ngoại lệ không.
 * @param {Object} schedule Bản ghi Schedule
 * @param {Date|string|number} [date=new Date()] Ngày cần kiểm tra
 * @returns {boolean} true nếu lịch đang hoạt động trong ngày/tuần đó
 */
const isScheduleActiveOnDate = (schedule, date = new Date()) => {
  const startDate = schedule?.ngay_bat_dau || schedule?.startDate;
  if (!schedule || !startDate) return true;

  const vnDate = getVietnamTime(date);
  const checkTime = new Date(Date.UTC(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate())).getTime();

  // 1. Kiểm tra ngày ngoại lệ (exceptions / ngoai_le)
  const exceptions = schedule.ngoai_le || schedule.exceptions || [];
  if (Array.isArray(exceptions) && exceptions.length > 0) {
    const isMakeupToday = exceptions.some((ex) => {
      const status = ex.trang_thai || ex.status;
      if (status !== 'day_bu') return false;
      const d = ex.ngay_day_bu || ex.ngay || ex.date;
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
      return exTime === checkTime && ['nghi', 'huy'].includes(ex.trang_thai || ex.status);
    });
    if (isExcluded) return false;
  }

  // 2. Kiểm tra tuần học (tuan_hoc / danh_sach_tuan / weekNumbers)
  const rawWeeks =
    schedule.danh_sach_tuan ||
    schedule.weekNumbers ||
    (Array.isArray(schedule.tuan_hoc) ? schedule.tuan_hoc.map((w) => w.tuan_thu) : null);
  if (Array.isArray(rawWeeks) && rawWeeks.length > 0) {
    const startVn = getVietnamTime(startDate);
    const startTime = new Date(Date.UTC(startVn.getFullYear(), startVn.getMonth(), startVn.getDate())).getTime();
    const diffDays = Math.round((checkTime - startTime) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      const currentWeekNum = Math.floor(diffDays / 7) + 1;
      if (!rawWeeks.includes(currentWeekNum)) {
        return false;
      }
    }
  }

  return true;
};

module.exports = {
  isScheduleActiveOnDate,
};
