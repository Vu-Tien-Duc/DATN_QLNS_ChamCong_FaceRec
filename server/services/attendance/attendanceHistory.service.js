/**
 * Attendance History & Summary Service (server/services/attendance/attendanceHistory.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Tra cứu lịch sử chấm công tổng hợp AttendanceLog (Collection 3).
 * - Truy vết chi tiết các lượt quẹt thô PunchLog (Collection 4) kèm tọa độ GPS và độ tin cậy AI.
 * - Phân quyền chặt chẽ: Cán bộ chỉ xem bản thân; Trưởng khoa xem trong khoa; Admin/BGH xem toàn trường.
 * - Hỗ trợ lọc theo trạng thái, gian lận (isFraud), phương thức và khoảng thời gian.
 */
const mongoose = require('mongoose');
const AttendanceLog = require('../../models/attendanceLog.model');
const PunchLog = require('../../models/punchLog.model');
const User = require('../../models/user.model');
const { getDeanScopedUserIds } = require('../../utils/deanScope');
const { ServiceError, buildAttendanceDateFilter } = require('../../utils/attendanceTime.utils');

/**
 * 1. Tổng hợp số liệu chấm công cá nhân theo kỳ / tháng
 */
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const query = { userId };
  if (startDate || endDate) {
    const dateQuery = buildAttendanceDateFilter(startDate, endDate);
    Object.assign(query, dateQuery);
  }

  const records = await AttendanceLog.find(query)
    .populate('shiftId', 'name startTime endTime')
    .populate('scheduleId', 'roomId weekday')
    .sort({ checkInTime: -1, date: -1 });

  const summary = {
    totalRecords: records.length,
    onTimeCount: records.filter((r) => r.status === 'ON_TIME').length,
    lateCount: records.filter((r) => r.status === 'LATE').length,
    earlyLeaveCount: records.filter((r) => r.status === 'EARLY_LEAVE').length,
    absentCount: records.filter((r) => r.status === 'ABSENT').length,
    excusedCount: records.filter((r) => r.status === 'EXCUSED_ABSENCE').length,
    fraudCount: records.filter((r) => r.isFraud === true).length,
    records,
  };

  return summary;
};

/**
 * 2. Lấy danh sách lịch sử chấm công (Phân quyền, lọc, phân trang)
 */
const getAttendanceHistory = async ({
  role,
  userId,
  currentUserId,
  departmentId,
  status,
  method,
  isFraud,
  from,
  to,
  page = 1,
  limit = 20,
  currentUser,
}) => {
  const query = {};
  const userRole = (role || currentUser?.role || currentUser?.vai_tro || '').toLowerCase();

  // 1. Phân quyền truy cập
  if (userRole === 'giangvien' || userRole === 'nhanvien') {
    query.userId = currentUserId || currentUser?._id;
  } else if (userRole === 'truongkhoa') {
    const facultyUserIds = await getDeanScopedUserIds(currentUser);
    if (!facultyUserIds.length) {
      throw new ServiceError('Tài khoản Trưởng khoa chưa được gán khoa quản lý hoặc khoa chưa có nhân sự.', 400);
    }
    if (userId) {
      if (!facultyUserIds.map(String).includes(String(userId))) {
        throw new ServiceError('Bạn không có quyền xem dữ liệu của nhân sự ngoài khoa.', 403);
      }
      query.userId = userId;
    } else {
      query.userId = { $in: facultyUserIds };
    }
  } else {
    // Admin, BGH, HR
    if (userId) query.userId = userId;
    if (departmentId) {
      const usersInDept = await User.find({
        $or: [{ departmentId }, { ma_don_vi: departmentId }],
      }).distinct('_id');
      query.userId = { $in: usersInDept };
    }
  }

  // 2. Bộ lọc trạng thái & điều kiện
  if (status) query.status = status;
  if (method) {
    query.$or = [{ method: method.toUpperCase() }, { phuong_thuc_vao: method.toUpperCase() }];
  }
  if (isFraud !== undefined) {
    query.isFraud = isFraud === 'true' || isFraud === true;
  }
  if (from || to) {
    const dateQuery = buildAttendanceDateFilter(from, to);
    Object.assign(query, dateQuery);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [records, total] = await Promise.all([
    AttendanceLog.find(query)
      .populate('userId', 'fullName ho_ten email staffCode ma_can_bo role vai_tro departmentId')
      .populate('shiftId', 'name startTime endTime')
      .populate('scheduleId', 'roomId subjectId')
      .populate({
        path: 'punchLogIds',
        select: 'thoi_diem_quet loai_quet phuong_thuc do_tin_cay_ai diem_mat_that co_gian_lan ly_do_gian_lan dia_diem toa_do_gps',
      })
      .sort({ date: -1, checkInTime: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AttendanceLog.countDocuments(query),
  ]);

  return {
    records,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * 3. Tra cứu lịch sử quẹt thẻ thô (PunchLog - Collection 4)
 */
const getRawPunchLogs = async ({ userId, from, to, page = 1, limit = 50 }) => {
  const query = {};
  if (userId) query.ma_nguoi_dung = userId;
  if (from || to) {
    query.thoi_diem_quet = {};
    if (from) query.thoi_diem_quet.$gte = new Date(from);
    if (to) query.thoi_diem_quet.$lte = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [punches, total] = await Promise.all([
    PunchLog.find(query)
      .populate('ma_nguoi_dung', 'fullName ho_ten email staffCode')
      .sort({ thoi_diem_quet: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    PunchLog.countDocuments(query),
  ]);

  return {
    punches,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

module.exports = {
  getAttendanceSummaryByUser,
  getAttendanceHistory,
  getRawPunchLogs,
};
