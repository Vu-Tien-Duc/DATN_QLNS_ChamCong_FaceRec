// Kiểm tra lịch trình có hiệu lực trong ngày dựa theo tuần học và các ngoại lệ nghỉ, hủy, dạy bù, dạy thay.
const { getVietnamTime } = require('./thoiGianChamCong.utils');

const toVnDayTimestamp = (value) => {
  const vnDate = getVietnamTime(value);
  return Date.UTC(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate());
};

const extractEntityId = (val) => (val && typeof val === 'object' ? val.id : val);

// Kiểm tra lịch trình có hoạt động trong ngày dựa trên khoảng ngày, tuần học và ngoại lệ
const isScheduleActiveOnDate = (schedule, date = new Date()) => {
  const startDate = schedule?.ngay_bat_dau;
  if (!schedule || !startDate) return true;

  const checkTime = toVnDayTimestamp(date);

  // 1. Kiểm tra ngày ngoại lệ (nghỉ, hủy, dạy bù, đổi ca)
  const exceptions = schedule.ngoai_le || [];
  if (Array.isArray(exceptions) && exceptions.length > 0) {
    const isMakeupOrSubstituteToday = exceptions.some((ex) => {
      if (ex.trang_thai === 'day_bu') {
        const d = ex.ngay_day_bu || ex.ngay;
        return d ? toVnDayTimestamp(d) === checkTime : false;
      }
      if (ex.trang_thai === 'doi_ca' && schedule._isSubstituteOverride) {
        const d = ex.ngay_day_bu || ex.ngay;
        return d ? toVnDayTimestamp(d) === checkTime : false;
      }
      return false;
    });
    if (isMakeupOrSubstituteToday) return true;

    const ownerId = extractEntityId(schedule.nguoi_dung_id);
    const isExcluded = exceptions.some((ex) => {
      const d = ex.ngay;
      if (!d || toVnDayTimestamp(d) !== checkTime) return false;
      const st = ex.trang_thai;
      if (['nghi', 'huy'].includes(st)) return true;
      // Buổi gốc đã báo dạy bù sang một ngày khác thì không còn tính là lịch học ở ngày gốc
      if (st === 'day_bu' && ex.ngay_day_bu && String(ex.ngay_day_bu).slice(0, 10) !== String(d).slice(0, 10)) {
        return true;
      }
      // Nếu có giảng viên khác dạy thay hoặc đổi sang ngày khác (doi_ca), loại trừ khỏi lịch chính của giảng viên gốc
      if (st === 'doi_ca' && !schedule._isSubstituteOverride) {
        const subId = extractEntityId(ex.giang_vien_day_thay_id);
        if (subId && String(subId) !== String(ownerId)) {
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

  // 2. Kiểm tra khoảng ngày hiệu lực [ngay_bat_dau, ngay_ket_thuc]
  const startTime = toVnDayTimestamp(startDate);
  if (checkTime < startTime) return false;
  if (schedule.ngay_ket_thuc) {
    const endTime = toVnDayTimestamp(schedule.ngay_ket_thuc);
    if (checkTime > endTime) return false;
  }

  return true;
};

// Tổng hợp lịch dạy hiệu lực trong ngày cho một giảng viên (gộp dạy bù/đổi ca đúng người dạy thực tế và lọc ngày lễ/ngoại lệ)
const resolveActiveSchedulesForUserDate = ({
  rawSchedules = [],
  exceptionOverrides = [],
  userId,
  dateStr,
  now = new Date(),
  hasHoliday = false,
}) => {
  const seenScheduleIds = new Set();
  const candidateSchedules = [];

  for (const s of rawSchedules) {
    const plain = typeof s.toJSON === 'function' ? s.toJSON() : { ...s };
    seenScheduleIds.add(String(plain.id));
    candidateSchedules.push(plain);
  }

  for (const ex of exceptionOverrides) {
    const schedulePlain = ex.lich_trinh
      ? typeof ex.lich_trinh.toJSON === 'function'
        ? ex.lich_trinh.toJSON()
        : { ...ex.lich_trinh }
      : null;
    if (!schedulePlain) continue;

    const isOwner = String(schedulePlain.nguoi_dung_id) === String(userId);
    const isSubstitute = Boolean(
      ex.giang_vien_day_thay_id && String(ex.giang_vien_day_thay_id) === String(userId)
    );
    const hasOtherSubstitute =
      Boolean(ex.giang_vien_day_thay_id) &&
      String(ex.giang_vien_day_thay_id) !== String(schedulePlain.nguoi_dung_id);
    const isEffectiveTeacher = isSubstitute || (isOwner && !hasOtherSubstitute);
    const targetDate = String(ex.ngay_day_bu || ex.ngay || '').slice(0, 10);

    if (ex.trang_thai === 'day_bu' && targetDate === dateStr && isEffectiveTeacher) {
      const makeupKey = `${schedulePlain.id}:makeup`;
      if (!seenScheduleIds.has(String(schedulePlain.id)) || !seenScheduleIds.has(makeupKey)) {
        seenScheduleIds.add(String(schedulePlain.id));
        seenScheduleIds.add(makeupKey);
        if (ex.ca_thay_the) schedulePlain.ca = ex.ca_thay_the;
        schedulePlain._hasExplicitMakeupToday = true;
        candidateSchedules.push(schedulePlain);
      }
    } else if (ex.trang_thai === 'doi_ca' && targetDate === dateStr && isEffectiveTeacher) {
      const clone = {
        ...schedulePlain,
        ca: ex.ca_thay_the || schedulePlain.ca,
        _isSubstituteOverride: true,
      };
      const subKey = `${schedulePlain.id}:sub:${ex.id}`;
      if (!seenScheduleIds.has(subKey)) {
        seenScheduleIds.add(subKey);
        candidateSchedules.push(clone);
      }
    }
  }

  return candidateSchedules.filter((plain) => {
    if (hasHoliday && !plain._hasExplicitMakeupToday && !plain._isSubstituteOverride) {
      return false;
    }
    return isScheduleActiveOnDate(plain, now);
  });
};

module.exports = {
  isScheduleActiveOnDate,
  resolveActiveSchedulesForUserDate,
};
