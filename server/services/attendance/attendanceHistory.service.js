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
  const userRole = (role || currentUser?.role || '').toLowerCase();

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
        departmentId,
      }).distinct('_id');
      query.userId = { $in: usersInDept };
    }
  }

  // 2. Bộ lọc trạng thái & điều kiện
  if (status) query.status = status;
  if (method) {
    query.method = method.toUpperCase();
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
      .populate({
        path: 'userId',
        select: 'fullName email staffCode role primaryRole roles departmentId don_vi_chinh_id avatar position',
        populate: {
          path: 'don_vi_chinh_id',
          select: 'ten_phong_ban name loai_don_vi',
        },
      })
      .populate('shiftId', 'name startTime endTime')
      .populate('scheduleId', 'roomId subjectId')
      .populate({
        path: 'punchLogIds',
        select: 'punchTime punchType method confidenceScore livenessScore isFraudulent fraudReason deviceId location clientIp',
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
  if (userId) query.userId = userId;
  if (from || to) {
    query.punchTime = {};
    if (from) query.punchTime.$gte = new Date(from);
    if (to) query.punchTime.$lte = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [punches, total] = await Promise.all([
    PunchLog.find(query)
      .populate('userId', 'fullName email staffCode')
      .sort({ punchTime: -1 })
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

/**
 * 4. Lấy dữ liệu ảnh minh chứng điểm danh theo ID bản ghi (có kiểm tra RBAC)
 */
const getAttendanceEvidence = async ({ id, currentUser }) => {
  const { readAttendanceEvidence } = require('../../utils/attendanceEvidence');
  const { isUserInDeanScope } = require('../../utils/deanScope');

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã bản ghi chấm công không hợp lệ.', 400);
  }

  const log = await AttendanceLog.findById(id).select('userId capturedImage');
  if (!log) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công.', 404);
  }

  // Phân quyền: Admin xem mọi bản ghi, Trưởng khoa xem trong khoa, Cán bộ xem chính mình
  const ownerId = log.userId?.toString() || log.userId;
  if (currentUser) {
    if (currentUser.role !== 'admin') {
      if (currentUser.role === 'truongkhoa') {
        const inScope = await isUserInDeanScope(currentUser, ownerId);
        if (!inScope) {
          throw new ServiceError('Bạn không có quyền xem ảnh minh chứng điểm danh của cán bộ ngoài khoa.', 403);
        }
      } else if (ownerId !== currentUser.id) {
        throw new ServiceError('Bạn không có quyền xem ảnh minh chứng điểm danh của người khác.', 403);
      }
    }
  }

  const reference = log.capturedImage;
  if (!reference) {
    throw new ServiceError('Bản ghi điểm danh này không có ảnh minh chứng.', 404);
  }

  const evidence = await readAttendanceEvidence(reference);
  if (!evidence) {
    throw new ServiceError('Không tìm thấy tệp ảnh minh chứng trên hệ thống lưu trữ.', 404);
  }

  return evidence;
};

module.exports = {
  getAttendanceSummaryByUser,
  getAttendanceHistory,
  getRawPunchLogs,
  getAttendanceEvidence,
};

