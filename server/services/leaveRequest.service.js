/**
 * LeaveRequest Service (server/services/leaveRequest.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Quy trình phê duyệt đơn từ nhiều cấp (Khoa -> Ban Giám Hiệu).
 * - Chặn tự phê duyệt đơn (Anti Self-Approval).
 * - Khóa lạc quan chống xung đột phiên bản đồng thời (Optimistic Locking).
 * - Hồi tố & Hoàn tác công tự động với ACID Transaction (Attendance Retroactive Sync & Rollback).
 */
const mongoose = require('mongoose');
const LeaveRequest = require('../models/leaveRequest.model');
const AttendanceLog = require('../models/attendanceLog.model');
const Schedule = require('../models/schedule.model');
const User = require('../models/user.model');
const PunchLog = require('../models/punchLog.model');
const AuditLog = require('../models/auditLog.model');
const { sendLeaveApprovedEmail, sendLeaveRejectedEmail } = require('./email.service');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../utils/deanScope');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * Định dạng ngày theo chuẩn Việt Nam (YYYY-MM-DD)
 */
const getVietnamDateKey = (date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Danh sách các ngày diễn ra lịch dạy trong khoảng thời gian nghỉ
 */
const getLeaveOccurrenceDates = (startDate, endDate, weekday) => {
  const startKey = getVietnamDateKey(startDate);
  const endKey = getVietnamDateKey(endDate);
  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const occurrences = [];

  while (cursor <= end) {
    if (cursor.getUTCDay() === Number(weekday)) {
      const dateKey = cursor.toISOString().slice(0, 10);
      occurrences.push(new Date(`${dateKey}T00:00:00.000+07:00`));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

/**
 * Tính chính xác số ngày nghỉ làm việc thực tế do Server kiểm soát (bỏ qua Chủ nhật, hỗ trợ 0.5 ngày)
 */
const calculateLeaveDays = (startDate, endDate, isHalfDay = false) => {
  if (isHalfDay) return 0.5;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return 0;
  }
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay(); // 0 là Chủ nhật
    if (day !== 0) {
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(0.5, count || 1);
};

/**
 * Thống kê số ngày phép năm bằng MongoDB Aggregation Pipeline
 */
const getLeaveStatsByYear = async (userId, year, { session } = {}) => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  let aggregation = LeaveRequest.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['APPROVED', 'PENDING', 'PENDING_DEAN', 'PENDING_BGH'] },
        startDate: { $lte: yearEnd },
        endDate: { $gte: yearStart },
      },
    },
    {
      $project: {
        type: '$type',
        status: '$status',
        effectiveStart: { $max: [{ $ifNull: ['$startDate', '$ngay_bat_dau'] }, yearStart] },
        effectiveEnd: { $min: [{ $ifNull: ['$endDate', '$ngay_ket_thuc'] }, yearEnd] },
      },
    },
    {
      $project: {
        type: 1,
        status: 1,
        leaveDays: {
          $add: [
            {
              $round: [
                {
                  $divide: [{ $subtract: ['$effectiveEnd', '$effectiveStart'] }, 86400000],
                },
                0,
              ],
            },
            1,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        daysUsed: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'APPROVED'] }, { $eq: ['$type', 'nghi_phep'] }] },
              '$leaveDays',
              0,
            ],
          },
        },
        pendingDays: {
          $sum: {
            $cond: [
              { $in: ['$status', ['PENDING', 'PENDING_DEAN', 'PENDING_BGH']] },
              '$leaveDays',
              0,
            ],
          },
        },
        pendingAnnualLeaveDays: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['PENDING', 'PENDING_DEAN', 'PENDING_BGH']] },
                  { $eq: ['$type', 'nghi_phep'] },
                ],
              },
              '$leaveDays',
              0,
            ],
          },
        },
        pendingRequestsCount: {
          $sum: {
            $cond: [
              { $in: ['$status', ['PENDING', 'PENDING_DEAN', 'PENDING_BGH']] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  if (session) aggregation = aggregation.session(session);
  const [stats] = await aggregation;

  return {
    daysUsed: stats?.daysUsed || 0,
    pendingDays: stats?.pendingDays || 0,
    pendingAnnualLeaveDays: stats?.pendingAnnualLeaveDays || 0,
    pendingRequestsCount: stats?.pendingRequestsCount || 0,
  };
};

/**
 * Thực thi transaction an toàn (với fallback khi MongoDB chạy ở chế độ standalone không Replica Set)
 */
const runLeaveRequestTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
    } catch (txError) {
      const message = txError?.message || '';
      if (
        txError?.code === 20 ||
        txError?.codeName === 'IllegalOperation' ||
        message.includes('Transaction numbers are only allowed') ||
        message.includes('does not support transactions') ||
        message.includes('replica set')
      ) {
        // Fallback: thực thi tuần tự không transaction trên môi trường standalone/local test
        result = await work(null);
      } else {
        throw txError;
      }
    }
    return result;
  } finally {
    await session.endSession();
  }
};

const activeLeaveSubmissions = new Set();

/**
 * 1. Tạo đơn xin nghỉ phép / dạy bù / đổi ca (Xác định số cấp duyệt tự động)
 */
const createLeaveRequestDomain = async ({
  type,
  reason,
  startDate,
  endDate,
  attachmentUrl,
  file,
  scheduleId,
  makeupDate,
  isHalfDay,
  currentUser,
}) => {
  const userId = currentUser?.id || currentUser?._id;
  const lockKey = `leave_lock:${userId}`;

  if (activeLeaveSubmissions.has(lockKey)) {
    throw new ServiceError(
      'Yêu cầu nộp đơn xin nghỉ của bạn đang được xử lý. Vui lòng không nhấn nút gửi liên tục.',
      429,
      'CONCURRENT_SUBMISSION_BLOCKED'
    );
  }

  activeLeaveSubmissions.add(lockKey);

  try {
    const userRole = (currentUser.role || '').toUpperCase();
    if (userRole === 'ADMIN') {
      throw new ServiceError(
        'Quản trị viên (Admin) giữ quyền phê duyệt cao nhất hệ thống, không áp dụng tạo đơn xin nghỉ cá nhân; chỉ có thẩm quyền phê duyệt hoặc từ chối đơn của cán bộ, giảng viên.',
        403,
        'ADMIN_CANNOT_CREATE_LEAVE'
      );
    }

    if (!type || typeof type !== 'string' || !reason || typeof reason !== 'string' || !startDate || !endDate) {
      throw new ServiceError('Vui lòng cung cấp loại đơn (type), lý do (reason), ngày bắt đầu và kết thúc hợp lệ.', 400);
    }

    const validTypes = ['nghi_phep', 'day_bu', 'doi_ca', 'ANNUAL', 'COMPENSATORY', 'SHIFT_CHANGE', 'SICK', 'UNPAID'];
    if (!validTypes.includes(type)) {
      throw new ServiceError('Loại đơn không hợp lệ. Chỉ chấp nhận: nghi_phep, day_bu, doi_ca.', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ServiceError('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.', 400);
    }

    if (end < start) {
      throw new ServiceError('Ngày kết thúc không thể trước ngày bắt đầu.', 400);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (start < todayStart) {
      throw new ServiceError('Không thể nộp đơn xin nghỉ lùi về các ngày trong quá khứ.', 400);
    }

    let parsedMakeupDate = null;
    let validScheduleId = null;
    if (type === 'day_bu') {
      if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
        throw new ServiceError('Đơn đăng ký dạy bù bắt buộc phải chọn lịch trình giảng dạy (scheduleId).', 400);
      }
      validScheduleId = scheduleId;

      if (!makeupDate) {
        throw new ServiceError('Đơn đăng ký dạy bù bắt buộc phải chọn ngày dạy bù (makeupDate).', 400);
      }
      parsedMakeupDate = new Date(makeupDate);
      if (Number.isNaN(parsedMakeupDate.getTime())) {
        throw new ServiceError('Ngày dạy bù không hợp lệ.', 400);
      }
    }

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      throw new ServiceError('Lý do phải có từ 5 đến 500 ký tự.', 400);
    }

    let finalAttachmentUrl = typeof attachmentUrl === 'string' ? attachmentUrl.trim() : null;
    if (file) {
      finalAttachmentUrl = `/uploads/${file.filename}`;
    }

    const serverCalculatedDays = calculateLeaveDays(start, end, Boolean(isHalfDay));

    // Xác định số cấp duyệt theo quy chế đại học:
    // - Trưởng khoa / Phó khoa nộp đơn: Chuyển thẳng lên Ban Giám Hiệu duyệt (1 cấp duyệt BGH).
    // - Giảng viên / Nhân viên nộp đơn:
    //   + Nghỉ > 3 ngày: Bắt buộc duyệt 2 cấp (Cấp 1: Khoa -> Cấp 2: BGH).
    //   + Nghỉ <= 3 ngày: Duyệt 1 cấp tại Khoa.
    const isLeadership = ['TRUONG_KHOA', 'PHO_TRUONG_KHOA', 'TRUONGKHOA', 'PHOKHOA'].includes(userRole);
    let requiredLevels = 1;
    let currentLevel = 1;
    let initialStatus = 'PENDING';

    if (isLeadership) {
      requiredLevels = 1;
      currentLevel = 2; // Cấp BGH
      initialStatus = 'PENDING_BGH';
    } else if (serverCalculatedDays > 3) {
      requiredLevels = 2;
      currentLevel = 1; // Bắt đầu từ Cấp 1 (Khoa)
      initialStatus = 'PENDING';
    } else {
      requiredLevels = 1;
      currentLevel = 1;
      initialStatus = 'PENDING';
    }

    const leaveRequest = await runLeaveRequestTransaction(async (session) => {
      const userUpdateQuery = User.updateOne(
        { _id: userId },
        { $inc: { leaveRequestRevision: 1 } }
      );
      if (session) userUpdateQuery.session(session);
      const userWrite = await userUpdateQuery;

      if (userWrite.matchedCount !== 1) {
        throw new ServiceError('Không tìm thấy người dùng gửi đơn.', 404);
      }

      const overlapQuery = LeaveRequest.findOne({
        userId,
        status: { $in: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH', 'APPROVED'] },
        startDate: { $lte: end },
        endDate: { $gte: start },
      });
      if (session) overlapQuery.session(session);
      const overlappingLeave = await overlapQuery;

      if (overlappingLeave) {
        const statusDesc = overlappingLeave.status === 'APPROVED' ? 'đã được phê duyệt' : 'đang chờ xét duyệt';
        const startFormatted = new Date(overlappingLeave.startDate).toLocaleDateString('vi-VN');
        const endFormatted = new Date(overlappingLeave.endDate).toLocaleDateString('vi-VN');
        throw new ServiceError(
          `Bạn đã có một đơn nghỉ (${statusDesc}) từ ngày ${startFormatted} đến ngày ${endFormatted} trùng với thời gian này.`,
          409,
          'OVERLAPPING_LEAVE_REQUEST'
        );
      }

      if (type === 'nghi_phep') {
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        const currentYearLeavesStart = new Date(Math.max(start.getTime(), yearStart.getTime()));
        const currentYearLeavesEnd = new Date(Math.min(end.getTime(), yearEnd.getTime()));
        const requestedDaysInYear = calculateLeaveDays(currentYearLeavesStart, currentYearLeavesEnd, Boolean(isHalfDay));

        const userFindQuery = User.findById(userId);
        if (session) userFindQuery.session(session);
        const user = await userFindQuery;
        const quota = user?.annualLeaveQuota !== undefined ? user.annualLeaveQuota : 12;

        const { daysUsed, pendingAnnualLeaveDays } = await getLeaveStatsByYear(userId, currentYear, { session });
        const availableDays = Math.max(0, quota - daysUsed - pendingAnnualLeaveDays);

        if (availableDays <= 0) {
          throw new ServiceError(
            `Bạn đã sử dụng hoặc đang có đơn chờ duyệt hết ${quota} ngày phép năm. Vui lòng chọn loại đơn "Đăng ký dạy bù" hoặc "Xin đổi ca dạy".`,
            400,
            'LEAVE_QUOTA_EXHAUSTED'
          );
        }
        if (requestedDaysInYear > availableDays) {
          throw new ServiceError(
            `Số ngày xin nghỉ thuộc năm ${currentYear} (${requestedDaysInYear} ngày) vượt quá số ngày phép khả dụng (${availableDays} ngày, đã bao gồm các đơn đang chờ duyệt).`,
            400,
            'LEAVE_QUOTA_EXCEEDED'
          );
        }
      }

      const createOptions = session ? { session } : undefined;
      const [createdRequest] = await LeaveRequest.create(
        [
          {
            userId,
            type,
            reason: normalizedReason,
            startDate: start,
            endDate: end,
            totalDays: serverCalculatedDays,
            scheduleId: validScheduleId,
            makeupDate: parsedMakeupDate,
            attachmentUrl: finalAttachmentUrl,
            status: initialStatus,
            so_cap_duyet: requiredLevels,
            cap_duyet_hien_tai: currentLevel,
            phien_ban: 1,
            lich_su_duyet: [],
          },
        ],
        createOptions
      );

      return createdRequest;
    });

    return leaveRequest;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error.code === 11000) {
      throw new ServiceError(
        'Bạn đã có một đơn nghỉ trùng lặp thời gian đang chờ duyệt hoặc đã duyệt trong hệ thống.',
        409,
        'DUPLICATE_LEAVE_REQUEST'
      );
    }
    throw error;
  } finally {
    activeLeaveSubmissions.delete(lockKey);
  }
};

/**
 * 2. Lấy danh sách đơn xin nghỉ phép/dạy bù
 */
const fetchLeaveRequests = async ({ status, type, userId, currentUser }) => {
  const query = {};

  if (status && typeof status === 'string') {
    if (status === 'PENDING') {
      query.status = { $in: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'] };
    } else {
      query.status = status;
    }
  }
  if (type && typeof type === 'string') query.type = type;

  if (userId) {
    if (typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new ServiceError('Mã người dùng (userId) không hợp lệ.', 400);
    }
  }

  const role = (currentUser.role || '').toUpperCase();
  const currentUserId = currentUser.id || currentUser._id;

  if (['GIANGVIEN', 'GIANG_VIEN', 'NHANVIEN', 'NHAN_VIEN', 'CHUYEN_VIEN'].includes(role)) {
    query.userId = currentUserId;
  } else if (['TRUONGKHOA', 'TRUONG_KHOA', 'PHOKHOA', 'PHO_TRUONG_KHOA'].includes(role)) {
    const facultyUserIds = await getDeanScopedUserIds(currentUser);
    if (userId) {
      if (!facultyUserIds.includes(userId.toString())) {
        throw new ServiceError('Bạn không có quyền xem đơn của nhân sự ngoài khoa.', 403);
      }
      query.userId = userId;
    } else {
      query.userId = { $in: facultyUserIds };
    }
  } else if (['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG', 'HIEU_PHO', 'HIEUPHO'].includes(role)) {
    if (userId) query.userId = userId;
  }

  const requests = await LeaveRequest.find(query)
    .populate('userId', 'fullName email role departmentId avatar')
    .populate('approvedBy', 'fullName email role avatar')
    .populate('lich_su_duyet.nguoi_duyet', 'fullName email role avatar')
    .sort({ createdAt: -1 });

  return requests;
};

/**
 * 3. Lấy chi tiết đơn theo ID
 */
const fetchLeaveRequestById = async (id, currentUser) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await LeaveRequest.findById(id)
    .populate('userId', 'fullName email role departmentId avatar')
    .populate('approvedBy', 'fullName email role avatar')
    .populate('lich_su_duyet.nguoi_duyet', 'fullName email role avatar');

  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  const role = (currentUser.role || '').toUpperCase();
  const currentUserId = (currentUser.id || currentUser._id).toString();
  const applicantId = (request.userId?._id || request.userId).toString();

  if (['GIANGVIEN', 'GIANG_VIEN', 'NHANVIEN', 'NHAN_VIEN'].includes(role)) {
    if (applicantId !== currentUserId) {
      throw new ServiceError('Bạn không có quyền xem đơn này.', 403);
    }
  } else if (['TRUONGKHOA', 'TRUONG_KHOA', 'PHOKHOA', 'PHO_TRUONG_KHOA'].includes(role)) {
    const inScope = await isUserInDeanScope(currentUser, request.userId._id || request.userId);
    if (!inScope && applicantId !== currentUserId) {
      throw new ServiceError('Bạn không có quyền xem đơn của nhân sự ngoài khoa.', 403);
    }
  }

  return request;
};

/**
 * 4. Xem số dư ngày phép
 */
const fetchLeaveBalance = async (queryUserId, currentUser) => {
  const currentUserId = (currentUser.id || currentUser._id).toString();
  let targetUserId = currentUserId;

  if (queryUserId && queryUserId !== currentUserId) {
    if (typeof queryUserId !== 'string' || !mongoose.Types.ObjectId.isValid(queryUserId)) {
      throw new ServiceError('Mã người dùng (userId) không hợp lệ.', 400);
    }

    const role = (currentUser.role || '').toUpperCase();
    if (['GIANGVIEN', 'GIANG_VIEN', 'NHANVIEN', 'NHAN_VIEN'].includes(role)) {
      throw new ServiceError('Bạn chỉ có quyền tra cứu số dư ngày phép của chính mình.', 403);
    }
    if (['TRUONGKHOA', 'TRUONG_KHOA', 'PHOKHOA', 'PHO_TRUONG_KHOA'].includes(role)) {
      const inScope = await isUserInDeanScope(currentUser, queryUserId);
      if (!inScope) {
        throw new ServiceError('Bạn không có quyền xem số dư ngày phép của nhân sự ngoài khoa.', 403);
      }
      targetUserId = queryUserId;
    } else if (['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG', 'HIEU_PHO', 'HIEUPHO'].includes(role)) {
      targetUserId = queryUserId;
    }
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const currentYear = new Date().getFullYear();
  const userRole = (user.role || '').toUpperCase();

  if (userRole === 'ADMIN') {
    return {
      userId: targetUserId,
      year: currentYear,
      annualLeaveQuota: 0,
      daysUsed: 0,
      pendingDays: 0,
      pendingAnnualLeaveDays: 0,
      pendingRequestsCount: 0,
      remainingDays: 0,
      availableDays: 0,
      isAdmin: true,
      message: 'Tài khoản Quản trị viên (Admin) không áp dụng quản lý hạn mức ngày phép.',
    };
  }

  const quota = user.annualLeaveQuota !== undefined ? user.annualLeaveQuota : 12;
  const { daysUsed, pendingDays, pendingAnnualLeaveDays, pendingRequestsCount } =
    await getLeaveStatsByYear(targetUserId, currentYear);
  const remainingDays = Math.max(0, quota - daysUsed);
  const availableDays = Math.max(0, quota - daysUsed - pendingAnnualLeaveDays);

  return {
    userId: targetUserId,
    year: currentYear,
    annualLeaveQuota: quota,
    daysUsed,
    pendingDays,
    pendingAnnualLeaveDays,
    pendingRequestsCount,
    remainingDays,
    availableDays,
    isAdmin: false,
    message: 'Tính số dư ngày phép thành công.',
  };
};

/**
 * 5. Xác thực quyền phê duyệt đơn (Chặn tự duyệt đơn & kiểm tra cấp duyệt)
 */
const validateLeaveApprovalPermission = async (currentUser, leaveRequest) => {
  const applicantId = (leaveRequest.userId?._id || leaveRequest.userId).toString();
  const currentUserId = (currentUser.id || currentUser._id).toString();

  // BẮT BUỘC: CHẶN TỰ DUYỆT ĐƠN (ANTI SELF-APPROVAL)
  if (applicantId === currentUserId) {
    return {
      allowed: false,
      message: 'Bạn không thể tự xử lý đơn xin nghỉ của chính mình. Đơn của bạn phải do cấp trên phê duyệt.',
      status: 403,
      errorCode: 'CANNOT_APPROVE_OWN_REQUEST',
    };
  }

  const role = (currentUser.role || '').toUpperCase();
  const currentLevel = leaveRequest.currentLevel || 1;
  const status = leaveRequest.status;

  // Ban Giám Hiệu & Admin có quyền duyệt toàn quyền mọi cấp
  const isBGH = ['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG', 'HIEU_PHO', 'HIEUPHO'].includes(role);
  if (isBGH) {
    return { allowed: true, approverLevel: currentLevel };
  }

  // Đang ở cấp 2 (PENDING_BGH): Chỉ BGH và Admin được duyệt
  if (status === 'PENDING_BGH' || currentLevel === 2) {
    return {
      allowed: false,
      message: 'Đơn này đang ở Cấp 2, chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền phê duyệt.',
      status: 403,
      errorCode: 'BGH_APPROVAL_REQUIRED',
    };
  }

  // Cấp 1 (Khoa): Trưởng khoa hoặc Phó trưởng khoa được ủy quyền
  if (['TRUONGKHOA', 'TRUONG_KHOA', 'PHOKHOA', 'PHO_TRUONG_KHOA'].includes(role)) {
    const applicant = await User.findById(applicantId).select('role departmentId');
    if (!applicant) {
      return { allowed: false, message: 'Người nộp đơn không tồn tại trên hệ thống.', status: 404 };
    }

    const applicantRole = (applicant.role || '').toUpperCase();
    if (['TRUONGKHOA', 'TRUONG_KHOA', 'ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG'].includes(applicantRole)) {
      return {
        allowed: false,
        message: 'Chỉ Ban Giám Hiệu mới có quyền phê duyệt đơn của Trưởng khoa.',
        status: 403,
        errorCode: 'DEAN_LEAVE_REQUIRES_BGH',
      };
    }

    if (['PHOKHOA', 'PHO_TRUONG_KHOA'].includes(role)) {
      if (!currentUser.isAuthorized && !currentUser.duoc_uy_quyen) {
        return {
          allowed: false,
          message: 'Phó trưởng khoa chưa được ủy quyền không có quyền phê duyệt đơn từ cấp khoa.',
          status: 403,
          errorCode: 'UNAUTHORIZED_VICE_DEAN',
        };
      }
    }

    const inScope = await isUserInDeanScope(currentUser, applicant._id);
    if (!inScope) {
      return {
        allowed: false,
        message: 'Bạn chỉ có quyền phê duyệt đơn của nhân sự thuộc khoa của mình.',
        status: 403,
        errorCode: 'OUT_OF_DEPARTMENT_SCOPE',
      };
    }

    return { allowed: true, approverLevel: 1 };
  }

  return { allowed: false, message: 'Bạn không có quyền thực hiện hành động này.', status: 403 };
};

/**
 * 6. Phê duyệt đơn (Quy trình nhiều cấp Khoa -> BGH, Optimistic Locking, Hồi tố công)
 */
const approveLeaveRequestDomain = async ({ id, approvalNote, expectedVersion, currentUser, ip }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await LeaveRequest.findById(id);
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  const currentStatus = request.status;
  if (!['PENDING', 'PENDING_DEAN', 'PENDING_BGH'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  // Khóa lạc quan (Optimistic Locking): Kiểm tra version
  const currentVersion = Number(request.phien_ban || request.version || 1);
  const targetVersion = expectedVersion !== undefined ? Number(expectedVersion) : currentVersion;

  if (expectedVersion !== undefined && targetVersion !== currentVersion) {
    throw new ServiceError(
      'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
      409,
      'OPTIMISTIC_LOCK_CONFLICT'
    );
  }

  // Kiểm tra hạn mức phép nếu là đơn nghỉ phép năm
  if (request.type === 'nghi_phep') {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const currentYearLeavesStart = new Date(Math.max(request.startDate.getTime(), yearStart.getTime()));
    const currentYearLeavesEnd = new Date(Math.min(request.endDate.getTime(), yearEnd.getTime()));
    const requestedDays = calculateLeaveDays(currentYearLeavesStart, currentYearLeavesEnd);

    const applicantUser = await User.findById(request.userId);
    const quota = applicantUser?.annualLeaveQuota !== undefined ? applicantUser.annualLeaveQuota : 12;

    const { daysUsed } = await getLeaveStatsByYear(request.userId, currentYear);
    const remainingDays = Math.max(0, quota - daysUsed);
    if (requestedDays > remainingDays) {
      throw new ServiceError(
        `Không thể phê duyệt đơn: Cán bộ/giảng viên chỉ còn ${remainingDays} ngày phép khả dụng, đơn này xin nghỉ ${requestedDays} ngày trong năm ${currentYear}.`,
        400,
        'INSUFFICIENT_LEAVE_DAYS'
      );
    }
  }

  const cleanNote = typeof approvalNote === 'string' ? approvalNote.trim() : '';
  const currentUserId = currentUser.id || currentUser._id;
  const currentLevel = Number(request.cap_duyet_hien_tai || request.currentLevel || 1);
  const requiredLevels = Number(request.so_cap_duyet || request.requiredLevels || 1);

  // Xác định trạng thái tiếp theo:
  // - Nếu đơn yêu cầu 2 cấp và đang ở cấp 1 -> Chuyển sang PENDING_BGH, cap_duyet_hien_tai = 2
  // - Nếu đơn ở cấp cuối (cấp 1/1 hoặc cấp 2/2) -> Chuyển sang APPROVED
  let nextStatus = 'APPROVED';
  let nextLevel = currentLevel;
  const isFinalApproval = currentLevel >= requiredLevels;

  if (!isFinalApproval) {
    nextStatus = 'PENDING_BGH';
    nextLevel = currentLevel + 1;
  } else {
    nextStatus = 'APPROVED';
  }

  const approvalStep = {
    step: currentLevel,
    approverId: currentUserId,
    role: currentUser.role || '',
    action: 'APPROVED',
    note: cleanNote,
    timestamp: new Date(),
  };

  const updatedRequest = await runLeaveRequestTransaction(async (session) => {
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    // Cập nhật nguyên tử có kiểm tra version
    const updated = await LeaveRequest.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'] },
        version: targetVersion,
      },
      {
        $set: {
          status: nextStatus,
          currentLevel: nextLevel,
          approverId: currentUserId,
          approvalNote: cleanNote,
          rejectReason: null,
        },
        $inc: { version: 1 },
        $push: { approvalHistory: approvalStep },
      },
      updateOptions
    );

    if (!updated) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    // NẾU LÀ PHÊ DUYỆT HOÀN TẤT (FINAL APPROVAL): KÍCH HOẠT HỒI TỐ CÔNG (RETROACTIVE SYNC)
    if (isFinalApproval) {
      // 1. Đồng bộ lịch trình giảng dạy Schedule
      if (updated.type === 'day_bu' && updated.scheduleId && updated.makeupDate) {
        await Schedule.updateOne(
          { _id: updated.scheduleId },
          {
            $push: {
              exceptions: {
                date: updated.makeupDate,
                reason: `Dạy bù theo đơn nghỉ phép #${updated._id}`,
                status: 'DAY_BU',
              },
            },
          },
          session ? { session } : undefined
        );
      }

      // 2. Hồi tố điểm danh: Cập nhật hoặc tạo AttendanceLog với trạng thái có phép (EXCUSED_ABSENCE)
      const schedules = await Schedule.find({
        userId: updated.userId,
        startDate: { $lte: updated.endDate },
        endDate: { $gte: updated.startDate },
      });

      const bulkOps = [];
      for (const sch of schedules) {
        const occurrenceStart = new Date(Math.max(updated.startDate.getTime(), sch.startDate.getTime()));
        const occurrenceEnd = new Date(Math.min(updated.endDate.getTime(), sch.endDate.getTime()));
        const occurrenceDates = getLeaveOccurrenceDates(occurrenceStart, occurrenceEnd, sch.weekday);

        for (const occurrenceDate of occurrenceDates) {
          const workDateStr = getVietnamDateKey(occurrenceDate);
          bulkOps.push({
            updateOne: {
              filter: {
                userId: updated.userId,
                scheduleId: sch._id,
                workDate: workDateStr,
              },
              update: {
                $set: {
                  status: 'EXCUSED_ABSENCE',
                  leaveRequestId: updated._id,
                  isExcused: true,
                  note: 'Nghỉ phép có đơn được duyệt (Hồi tố)',
                  checkInTime: null,
                  checkOutTime: null,
                },
                $setOnInsert: {
                  shiftId: sch.shiftId,
                  method: 'SYSTEM_AUTO',
                  deviceId: 'SYSTEM_LEAVE_RETROACTIVE',
                },
              },
              upsert: true,
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        await AttendanceLog.bulkWrite(bulkOps, { ordered: false });
      }
    }

    return updated;
  });

  await AuditLog.create({
    actor: currentUserId,
    action: isFinalApproval ? 'APPROVE_LEAVE_FINAL' : `APPROVE_LEAVE_LEVEL_${currentLevel}`,
    targetId: request._id.toString(),
    targetType: 'LeaveRequest',
    ipAddress: ip || null,
    timestamp: new Date(),
  });

  const applicant = await User.findById(request.userId).select('email fullName');
  const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  if (applicant?.email && mailUser && mailPass && isFinalApproval) {
    sendLeaveApprovedEmail({
      to: applicant.email,
      fullName: applicant.fullName,
      fromDate: request.startDate,
      toDate: request.endDate,
      approvalNote: cleanNote,
    }).catch((mailError) => {
      console.error('Gửi email duyệt đơn thất bại:', mailError.message);
    });
  }

  return updatedRequest;
};

/**
 * 7. Từ chối đơn xin nghỉ phép/dạy bù
 */
const rejectLeaveRequestDomain = async ({ id, rejectionReason, expectedVersion, currentUser, ip }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
    throw new ServiceError('Lý do từ chối (rejectionReason) là chuỗi bắt buộc khi từ chối đơn.', 400);
  }

  const request = await LeaveRequest.findById(id);
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  const currentStatus = request.status;
  if (!['PENDING', 'PENDING_DEAN', 'PENDING_BGH'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  const currentVersion = Number(request.version || 1);
  const targetVersion = expectedVersion !== undefined ? Number(expectedVersion) : currentVersion;

  if (expectedVersion !== undefined && targetVersion !== currentVersion) {
    throw new ServiceError(
      'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
      409,
      'OPTIMISTIC_LOCK_CONFLICT'
    );
  }

  const currentUserId = currentUser.id || currentUser._id;
  const currentLevel = Number(request.currentLevel || 1);
  const rejectionStep = {
    step: currentLevel,
    approverId: currentUserId,
    role: currentUser.role || '',
    action: 'REJECTED',
    note: rejectionReason.trim(),
    timestamp: new Date(),
  };

  const updatedRequest = await runLeaveRequestTransaction(async (session) => {
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    const updated = await LeaveRequest.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH'] },
        version: targetVersion,
      },
      {
        $set: {
          status: 'REJECTED',
          approverId: currentUserId,
          rejectReason: rejectionReason.trim(),
        },
        $inc: { version: 1 },
        $push: { approvalHistory: rejectionStep },
      },
      updateOptions
    );

    if (!updated) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    return updated;
  });

  await AuditLog.create({
    actor: currentUserId,
    action: `REJECT_LEAVE_LEVEL_${currentLevel}`,
    targetId: request._id.toString(),
    targetType: 'LeaveRequest',
    ipAddress: ip || null,
    timestamp: new Date(),
  });

  const applicant = await User.findById(request.userId).select('email fullName');
  const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  if (applicant?.email && mailUser && mailPass) {
    sendLeaveRejectedEmail({
      to: applicant.email,
      fullName: applicant.fullName,
      fromDate: request.startDate,
      toDate: request.endDate,
      rejectionReason: rejectionReason.trim(),
    }).catch((mailError) => {
      console.error('Gửi email từ chối đơn thất bại:', mailError.message);
    });
  }

  return updatedRequest;
};

/**
 * 8. Hủy đơn xin nghỉ phép/dạy bù & Hoàn tác công tự động (Rollback Attendance)
 */
const cancelLeaveRequestDomain = async ({ id, expectedVersion, currentUser, ip }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await LeaveRequest.findById(id);
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  const currentUserId = (currentUser.id || currentUser._id).toString();
  const applicantId = (request.userId?._id || request.userId).toString();
  const isApplicant = applicantId === currentUserId;
  const role = (currentUser.role || '').toUpperCase();
  const isAdmin = ['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG'].includes(role);

  if (!isApplicant && !isAdmin) {
    throw new ServiceError('Bạn chỉ có quyền hủy đơn của chính mình.', 403, 'CANCEL_UNAUTHORIZED');
  }

  const currentStatus = request.status;
  if (['CANCELLED', 'REJECTED'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã ở trạng thái ${currentStatus}, không thể hủy.`, 400);
  }

  if (currentStatus === 'APPROVED') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leaveStart = new Date(request.startDate);
    leaveStart.setHours(0, 0, 0, 0);

    if (leaveStart <= today && !isAdmin) {
      throw new ServiceError(
        'Không thể tự hủy đơn đã phê duyệt khi đã đến hoặc qua ngày nghỉ. Vui lòng liên hệ Admin.',
        400,
        'CANNOT_CANCEL_PAST_APPROVED_LEAVE'
      );
    }
  }

  const currentVersion = Number(request.version || 1);
  const targetVersion = expectedVersion !== undefined ? Number(expectedVersion) : currentVersion;

  if (expectedVersion !== undefined && targetVersion !== currentVersion) {
    throw new ServiceError(
      'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác.',
      409,
      'OPTIMISTIC_LOCK_CONFLICT'
    );
  }

  const updatedRequest = await runLeaveRequestTransaction(async (session) => {
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    const updated = await LeaveRequest.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH', 'APPROVED'] },
        version: targetVersion,
      },
      {
        $set: { status: 'CANCELLED' },
        $inc: { version: 1 },
      },
      updateOptions
    );

    if (!updated) {
      throw new ServiceError(
        'Xung đột phiên bản: Đơn từ đã được xử lý bởi phiên khác.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    // HOÀN TÁC CÔNG (ROLLBACK ATTENDANCE):
    // Đối soát các bản ghi điểm danh đã được cập nhật từ đơn này
    const affectedLogs = await AttendanceLog.find({ leaveRequestId: request._id });

    for (const log of affectedLogs) {
      // Kiểm tra xem nhân viên có lượt quẹt PunchLog thực tế nào trong ngày này không
      const punches = await PunchLog.find({
        userId: log.userId,
        punchTime: {
          $gte: new Date(`${log.workDate}T00:00:00.000+07:00`),
          $lte: new Date(`${log.workDate}T23:59:59.999+07:00`),
        },
      });

      if (punches.length === 0) {
        // Không có quẹt thực tế: Đưa về trạng thái Vắng mặt (hoặc xóa nếu là bản ghi tạo tự động)
        if (log.deviceId === 'SYSTEM_LEAVE' || log.deviceId === 'SYSTEM_LEAVE_RETROACTIVE') {
          await AttendanceLog.deleteOne({ _id: log._id }, session ? { session } : undefined);
        } else {
          await AttendanceLog.updateOne(
            { _id: log._id },
            {
              $set: {
                status: 'ABSENT',
                isExcused: false,
                leaveRequestId: null,
                note: 'Đơn nghỉ phép đã bị hủy (Hoàn tác công)',
              },
            },
            session ? { session } : undefined
          );
        }
      } else {
        // Có quẹt thực tế: Phục hồi lại trạng thái tính công từ quẹt thẻ
        await AttendanceLog.updateOne(
          { _id: log._id },
          {
            $set: {
              status: log.lateMinutes > 0 ? 'LATE' : 'ON_TIME',
              isExcused: false,
              leaveRequestId: null,
              note: 'Phục hồi tính công từ lượt quẹt thực tế sau khi hủy đơn',
            },
          },
          session ? { session } : undefined
        );
      }
    }

    // Hoàn tác lịch dạy bù nếu có
    if (request.type === 'day_bu' && request.scheduleId && request.makeupDate) {
      await Schedule.updateOne(
        { _id: request.scheduleId },
        {
          $pull: {
            exceptions: { date: request.makeupDate },
          },
        },
        session ? { session } : undefined
      );
    }

    return updated;
  });

  await AuditLog.create({
    actor: currentUserId,
    action: 'CANCEL_LEAVE_AND_ROLLBACK',
    targetId: request._id.toString(),
    targetType: 'LeaveRequest',
    ipAddress: ip || null,
    timestamp: new Date(),
  });

  return updatedRequest;
};

module.exports = {
  ServiceError,
  calculateLeaveDays,
  getLeaveStatsByYear,
  validateLeaveApprovalPermission,
  createLeaveRequestDomain,
  fetchLeaveRequests,
  fetchLeaveRequestById,
  fetchLeaveBalance,
  approveLeaveRequestDomain,
  rejectLeaveRequestDomain,
  cancelLeaveRequestDomain,
};
