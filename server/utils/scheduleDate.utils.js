const { getVietnamTime } = require('./attendanceTime.utils');

/**
 * Kiểm tra xem một lịch trình có đang trong tuần học áp dụng và không rơi vào ngày nghỉ/hủy ngoại lệ không.
 * @param {Object} schedule Bản ghi Schedule
 * @param {Date|string|number} [date=new Date()] Ngày cần kiểm tra
 * @returns {boolean} true nếu lịch đang hoạt động trong ngày/tuần đó
 */
const isScheduleActiveOnDate = (schedule, date = new Date()) => {
  if (!schedule || !schedule.startDate) return true;

  const vnDate = getVietnamTime(date);
  const checkTime = new Date(Date.UTC(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate())).getTime();

  // 1. Kiểm tra ngày ngoại lệ (exceptions / ngoai_le)
  const exceptions = schedule.exceptions || schedule.ngoai_le || [];
  if (Array.isArray(exceptions) && exceptions.length > 0) {
    const isExcluded = exceptions.some((ex) => {
      const d = ex.ngay || ex.date;
      if (!d) return false;
      const exVn = getVietnamTime(d);
      const exTime = new Date(Date.UTC(exVn.getFullYear(), exVn.getMonth(), exVn.getDate())).getTime();
      return exTime === checkTime && ['NGHI', 'HUY'].includes(ex.trang_thai || ex.status);
    });
    if (isExcluded) return false;
  }

  // 2. Kiểm tra tuần học (weekNumbers / danh_sach_tuan)
  const weeks = schedule.weekNumbers || schedule.danh_sach_tuan;
  if (Array.isArray(weeks) && weeks.length > 0 && weeks.length < 15) {
    const startVn = getVietnamTime(schedule.startDate);
    const startTime = new Date(Date.UTC(startVn.getFullYear(), startVn.getMonth(), startVn.getDate())).getTime();
    const diffDays = Math.round((checkTime - startTime) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      const currentWeekNum = Math.floor(diffDays / 7) + 1;
      if (!weeks.includes(currentWeekNum)) {
        return false;
      }
    }
  }

  return true;
};

module.exports = {
  isScheduleActiveOnDate,
};
