/**
 * Truy vấn và tính toán số liệu chấm công, nghỉ phép, lịch dạy theo phạm vi phân quyền.
 */
const mongoose = require('mongoose');
const User = require('../../models/user.model');
const AttendanceLog = require('../../models/attendanceLog.model');
const LeaveRequest = require('../../models/leaveRequest.model');
const Schedule = require('../../models/schedule.model');
const Department = require('../../models/department.model');
const { buildAttendanceDateFilter } = require('../../utils/attendanceTime.utils');
const { getVietnamParts, createVietnamDate } = require('../../utils/aiDateParser');
const { normalizeRole } = require('../../utils/roleUtils');

/**
 * ============================================================================
 * 1. QUẢN LÝ PHÂN QUYỀN VÀ PHẠM VI TRUY VẤN (AUTHORIZATION SCOPE)
 * ============================================================================
 */

/**
 * Lấy danh sách departmentId mà Trưởng khoa có quyền quản lý (gồm khoa và các bộ môn con)
 * @param {string} departmentId
 * @returns {Promise<string[]>}
 */
const getDepartmentScopeIds = async (departmentId) => {
  if (!departmentId) return [];
  const children = await Department.find({ parentId: departmentId }).select('_id');
  const allIds = [departmentId.toString(), ...children.map((c) => c._id.toString())];
  return allIds;
};

const isCampusLevelAdmin = (role) => ['admin', 'bgh', 'kiem_toan'].includes(normalizeRole(role));
const isFacultyLevelLeader = (role) => ['truong_khoa', 'pho_khoa'].includes(normalizeRole(role));

/**
 * Kiểm tra xem currentUser có quyền truy cập dữ liệu của targetUserId hay không
 * @param {Object} currentUser
 * @param {string|Object} targetUserId
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
const checkUserPermission = async (currentUser, targetUserId) => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng.' };
  }

  const role = normalizeRole(currentUser.role || currentUser.primaryRole || currentUser.vai_tro_chinh);
  const tid = targetUserId ? (targetUserId._id ? targetUserId._id.toString() : targetUserId.toString()) : null;

  // 1. Quản trị viên (Admin) và Ban Giám Hiệu (Hiệu trưởng, Hiệu phó): Toàn quyền tra cứu
  if (isCampusLevelAdmin(role)) {
    return { allowed: true };
  }

  // 2. Tra cứu dữ liệu của chính mình: Luôn được phép
  const currentUserIdStr = (currentUser.id || currentUser._id || '').toString();
  if (tid && tid === currentUserIdStr) {
    return { allowed: true };
  }

  // 3. Giảng viên / Nhân viên: Chỉ được xem chính mình
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(role)) {
    return {
      allowed: false,
      reason: 'Bạn chỉ có quyền tra cứu thông tin của chính mình, không có quyền xem thông tin của cán bộ/giảng viên khác.',
    };
  }

  // 4. Trưởng khoa & Phó khoa: Được xem cán bộ/giảng viên thuộc khoa hoặc bộ môn trực thuộc
  if (isFacultyLevelLeader(role)) {
    if (!tid) return { allowed: true };
    const myDeptId = currentUser.departmentId;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Lãnh đạo Khoa chưa được gán mã khoa trực thuộc.' };
    }
    const scopedDeptIds = await getDepartmentScopeIds(myDeptId);
    const targetUser = await User.findById(tid).select('departmentId fullName email');
    if (!targetUser) {
      return { allowed: false, reason: 'Không tìm thấy người dùng được yêu cầu.' };
    }
    const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
    if (!targetDeptId || !scopedDeptIds.includes(targetDeptId)) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền xem dữ liệu của cán bộ/giảng viên thuộc khoa/bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true };
  }

  // 5. Trưởng bộ môn: Chỉ được xem cán bộ thuộc bộ môn trực tiếp của mình
  if (['truong_bo_mon', 'pho_bo_mon'].includes(role)) {
    if (!tid) return { allowed: true };
    const myDeptId = currentUser.departmentId ? currentUser.departmentId.toString() : null;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Trưởng bộ môn chưa được gán mã bộ môn trực thuộc.' };
    }
    const targetUser = await User.findById(tid).select('departmentId fullName email');
    if (!targetUser) {
      return { allowed: false, reason: 'Không tìm thấy người dùng được yêu cầu.' };
    }
    const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
    if (targetDeptId !== myDeptId) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền xem dữ liệu của cán bộ/giảng viên thuộc bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Bạn không có quyền thực hiện tra cứu này.' };
};

/**
 * Kiểm tra xem currentUser có quyền truy cập phạm vi departmentId hay không
 * @param {Object} currentUser
 * @param {string} departmentId
 * @returns {Promise<{ allowed: boolean, reason?: string, effectiveDeptIds?: string[] }>}
 */
const checkDepartmentPermission = async (currentUser, departmentId) => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng.' };
  }

  const role = normalizeRole(currentUser.role || currentUser.primaryRole || currentUser.vai_tro_chinh);

  // Admin và Ban Giám Hiệu có quyền tra cứu toàn trường
  if (isCampusLevelAdmin(role)) {
    if (departmentId) {
      const scoped = await getDepartmentScopeIds(departmentId);
      return { allowed: true, effectiveDeptIds: scoped };
    }
    return { allowed: true, effectiveDeptIds: null };
  }

  // Giảng viên / Nhân viên không có quyền xem thống kê toàn khoa
  if (['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(role)) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền xem thống kê cấp khoa hoặc toàn hệ thống. Bạn chỉ có thể tra cứu thông tin cá nhân.',
    };
  }

  // Trưởng khoa / Phó khoa chỉ xem được khoa của mình và các bộ môn trực thuộc
  if (isFacultyLevelLeader(role)) {
    const myDeptId = currentUser.departmentId;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Lãnh đạo Khoa chưa được gán mã khoa trực thuộc.' };
    }
    const allowedDepts = await getDepartmentScopeIds(myDeptId);
    if (departmentId && !allowedDepts.includes(departmentId.toString())) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền tra cứu thống kê thuộc khoa hoặc bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true, effectiveDeptIds: departmentId ? [departmentId.toString()] : allowedDepts };
  }

  // Trưởng bộ môn chỉ xem được bộ môn của mình
  if (['truong_bo_mon', 'pho_bo_mon'].includes(role)) {
    const myDeptId = currentUser.departmentId ? currentUser.departmentId.toString() : null;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Trưởng bộ môn chưa được gán mã bộ môn trực thuộc.' };
    }
    if (departmentId && departmentId.toString() !== myDeptId) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền tra cứu thống kê thuộc bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true, effectiveDeptIds: [myDeptId] };
  }

  return { allowed: false, reason: 'Không có quyền truy cập.' };
};

/**
 * ============================================================================
 * 2. PHÂN GIẢI THỰC THỂ (ENTITY RESOLUTION: USER & DEPARTMENT)
 * ============================================================================
 */

/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu và ký tự thừa để so khớp gần đúng
 * @param {string} str
 * @returns {string}
 */
const normalizeVietnameseString = (str = '') => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Bóc tách tên người từ câu hỏi và tìm kiếm trong CSDL
 * @param {string} text
 * @param {Object} currentUser
 * @returns {Promise<{ isSelf?: boolean, notFound?: boolean, isAmbiguous?: boolean, user?: Object, matches?: Array, queryName?: string, error?: string }>}
 */
const resolveUser = async (text = '', currentUser = null) => {
  const cleanText = text.trim();

  // 1. Nhận diện đại từ xưng hô chỉ chính người hỏi: "tôi", "mình", "bản thân tôi", "của tôi"
  const selfPatterns = [
    /\btôi\b/i,
    /\bmình\b/i,
    /\bbản thân\b/i,
    /\bcủa tôi\b/i,
    /\blịch dạy của tôi\b/i,
    /\bchấm công của tôi\b/i,
    /\bđơn của tôi\b/i,
  ];
  for (const pattern of selfPatterns) {
    if (pattern.test(cleanText)) {
      if (!currentUser) return { notFound: true, queryName: 'Tôi' };
      const selfUser = await User.findById(currentUser.id).populate('departmentId', 'name');
      return { isSelf: true, user: selfUser };
    }
  }

  // 2. Tìm tên riêng người dùng trong câu hỏi
  const allUsers = await User.find({ isActive: true }).populate('departmentId', 'name');
  const matches = [];
  const normalizedQuery = normalizeVietnameseString(cleanText);

  for (const u of allUsers) {
    const rawCoreName = u.fullName
      .replace(/\(.*?\)/g, '')
      .replace(/(?:pgs\.\s*ts\.|pgs\.|gs\.\s*ts\.|gs\.|ts\.|ths\.|cn\.)\s*/gi, '')
      .trim();

    const normCoreName = normalizeVietnameseString(rawCoreName);

    if (normCoreName && normalizedQuery.includes(normCoreName)) {
      matches.push(u);
      continue;
    }

    const nameWords = rawCoreName.split(' ');
    const firstName = nameWords[nameWords.length - 1];
    const normFirstName = normalizeVietnameseString(firstName);

    const titleRegex = new RegExp(`(?:thay|co|giang vien|ts|ths)\\s+${normFirstName}\\b`, 'i');
    if (normFirstName && titleRegex.test(normalizedQuery)) {
      if (!matches.some((m) => m._id.toString() === u._id.toString())) {
        matches.push(u);
      }
    }
  }

  if (matches.length === 0) {
    return { notFound: true, queryName: cleanText };
  }

  if (matches.length > 1) {
    const exactMatches = matches.filter((u) => {
      const rawCore = u.fullName.replace(/\(.*?\)/g, '').replace(/(?:pgs\.\s*ts\.|pgs\.|gs\.\s*ts\.|gs\.|ts\.|ths\.|cn\.)\s*/gi, '').trim();
      return normalizeVietnameseString(cleanText).includes(normalizeVietnameseString(rawCore));
    });

    if (exactMatches.length === 1) {
      return { user: exactMatches[0] };
    }

    return {
      isAmbiguous: true,
      matches: matches.map((m) => ({
        id: m._id,
        fullName: m.fullName,
        email: m.email,
        role: m.role,
        departmentName: m.departmentId?.name || 'Chưa gán',
      })),
    };
  }

  return { user: matches[0] };
};

/**
 * Phân giải Khoa / Phòng ban từ câu hỏi
 * @param {string} text
 * @param {Object} currentUser
 * @returns {Promise<Object|null>}
 */
const resolveDepartment = async (text = '', currentUser = null) => {
  const lower = (text || '').toLowerCase();
  const allDepts = await Department.find();

  const aliases = [
    { keys: ['cntt', 'công nghệ thông tin', 'chuyển đổi số', 'tin học'], deptMatch: (d) => d.name.toLowerCase().includes('cntt') || d.name.toLowerCase().includes('thông tin') },
    { keys: ['kinh tế', 'qtkd', 'quản trị kinh doanh'], deptMatch: (d) => d.name.toLowerCase().includes('kinh tế') },
    { keys: ['hàn', 'nhật', 'ngôn ngữ'], deptMatch: (d) => d.name.toLowerCase().includes('ngôn ngữ') || d.name.toLowerCase().includes('hàn') },
    { keys: ['mỹ thuật', 'đồ họa', 'thiết kế'], deptMatch: (d) => d.name.toLowerCase().includes('thiết kế') || d.name.toLowerCase().includes('mỹ thuật') },
    { keys: ['đào tạo', 'phòng đào tạo'], deptMatch: (d) => d.name.toLowerCase().includes('đào tạo') },
    { keys: ['hành chính', 'tổng hợp', 'hc-th'], deptMatch: (d) => d.name.toLowerCase().includes('hành chính') },
    { keys: ['công tác sinh viên', 'ctsv'], deptMatch: (d) => d.name.toLowerCase().includes('sinh viên') },
    { keys: ['khảo thí', 'đảm bảo chất lượng', 'đbcl'], deptMatch: (d) => d.name.toLowerCase().includes('khảo thí') },
  ];

  for (const alias of aliases) {
    if (alias.keys.some((k) => lower.includes(k))) {
      const match = allDepts.find(alias.deptMatch);
      if (match) return match;
    }
  }

  for (const d of allDepts) {
    if (lower.includes(d.name.toLowerCase())) {
      return d;
    }
  }

  if (
    lower.includes('khoa') ||
    lower.includes('bộ môn') ||
    lower.includes('bo mon') ||
    (currentUser && isFacultyLevelLeader(currentUser.role || currentUser.vai_tro_chinh))
  ) {
    if (currentUser?.departmentId) {
      const myDept = allDepts.find(
        (d) => d._id.toString() === currentUser.departmentId.toString()
      );
      if (myDept) return myDept;
    }
  }

  return null;
};

/**
 * ============================================================================
 * 3. ANALYTICS ENGINE: ATTENDANCE (CHẤM CÔNG)
 * ============================================================================
 */

/**
 * Lấy tổng hợp chấm công theo phạm vi
 * @param {Object} params { userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const getAttendanceSummary = async ({ userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;

  if (!userId && !effectiveDeptId && isFacultyLevelLeader(currentUser?.role || currentUser?.vai_tro_chinh) && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    if (currentUser && !isCampusLevelAdmin(currentUser.role)) {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) hoặc Ban Giám Hiệu mới có quyền xem số liệu chấm công toàn hệ thống.',
      };
    }
  }

  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  const dateFilter = buildAttendanceDateFilter(fromDate, toDate);
  Object.assign(query, dateFilter);

  const logs = await AttendanceLog.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime')
    .populate({
      path: 'scheduleId',
      select: 'roomId weekday subjectId latitude longitude',
      populate: { path: 'subjectId', select: 'name code' },
    })
    .sort({ checkInTime: -1, createdAt: -1 });

  const total = logs.length;
  const onTime = logs.filter((l) => l.status === 'on_time').length;
  const late = logs.filter((l) => l.status === 'late').length;
  const earlyLeave = logs.filter((l) => l.status === 'early_leave').length;
  const absent = logs.filter((l) => l.status === 'absent').length;
  const excusedAbsent = logs.filter((l) => l.status === 'excused_absence').length;

  const presentLogs = logs.filter((l) => ['on_time', 'late', 'early_leave'].includes(l.status));
  const distinctPresentUserIds = [...new Set(presentLogs.map((l) => l.userId?._id?.toString() || l.userId?.toString()))];

  return {
    total,
    onTime,
    late,
    earlyLeave,
    absent,
    excusedAbsent,
    presentUserCount: distinctPresentUserIds.length,
    logs,
  };
};

/**
 * Thống kê ai đi trễ nhiều nhất trong khoảng thời gian
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const getTopLateUsers = async ({ departmentId, fromDate, toDate, limit = 5, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!effectiveDeptId && isFacultyLevelLeader(currentUser?.role || currentUser?.vai_tro_chinh) && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
  if (!perm.allowed) {
    return { unauthorized: true, reason: perm.reason };
  }

  let userFilter = {};
  if (perm.effectiveDeptIds && perm.effectiveDeptIds.length > 0) {
    userFilter = { departmentId: { $in: perm.effectiveDeptIds } };
  }

  const deptUserIds = await User.find(userFilter).distinct('_id');
  const dateFilter = buildAttendanceDateFilter(fromDate, toDate);

  const lateLogs = await AttendanceLog.find({
    userId: { $in: deptUserIds },
    status: 'late',
    ...dateFilter,
  }).populate('userId', 'fullName email role departmentId');

  const userLateMap = {};
  for (const log of lateLogs) {
    const uid = log.userId?._id?.toString();
    if (!uid) continue;
    if (!userLateMap[uid]) {
      userLateMap[uid] = {
        userId: uid,
        fullName: log.userId?.fullName || 'Không rõ',
        email: log.userId?.email || '',
        count: 0,
      };
    }
    userLateMap[uid].count += 1;
  }

  const sorted = Object.values(userLateMap).sort((a, b) => b.count - a.count);
  return {
    totalLateLogs: lateLogs.length,
    topUsers: sorted.slice(0, limit),
  };
};

/**
 * ============================================================================
 * 4. ANALYTICS ENGINE: LEAVE REQUEST (ĐƠN XIN NGHỈ / DẠY BÙ / ĐỔI CA)
 * ============================================================================
 */

/**
 * Lấy tổng hợp đơn xin nghỉ / dạy bù / đổi ca
 * @param {Object} params { status, type, userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const getLeaveRequestSummary = async ({ status, type, userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!userId && !effectiveDeptId && isFacultyLevelLeader(currentUser?.role || currentUser?.vai_tro_chinh) && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    if (currentUser && currentUser.role !== 'admin') {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) mới có quyền xem toàn bộ đơn xin nghỉ trong toàn trường.',
      };
    }
  }

  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  if (status) {
    query.status = status.toLowerCase();
  }

  if (type) {
    query.type = type;
  }

  if (fromDate && toDate) {
    query.startDate = { $lte: new Date(toDate) };
    query.endDate = { $gte: new Date(fromDate) };
  } else if (fromDate) {
    query.endDate = { $gte: new Date(fromDate) };
  } else if (toDate) {
    query.startDate = { $lte: new Date(toDate) };
  }

  const requests = await LeaveRequest.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('approvedBy', 'fullName email')
    .sort({ createdAt: -1 });

  const total = requests.length;
  const pending = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;

  const leaveNormal = requests.filter((r) => r.type === 'nghi_phep').length;
  const makeUpTeaching = requests.filter((r) => r.type === 'day_bu').length;
  const shiftChange = requests.filter((r) => r.type === 'doi_ca').length;

  let totalApprovedDays = 0;
  requests
    .filter((r) => r.status === 'approved' && r.type === 'nghi_phep')
    .forEach((r) => {
      const diffTime = Math.abs(new Date(r.endDate) - new Date(r.startDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      totalApprovedDays += diffDays;
    });

  return {
    total,
    pending,
    approved,
    rejected,
    byType: {
      nghi_phep: leaveNormal,
      day_bu: makeUpTeaching,
      doi_ca: shiftChange,
    },
    totalApprovedDays,
    requests,
  };
};

/**
 * ============================================================================
 * 5. ANALYTICS ENGINE: SCHEDULE (LỊCH GIẢNG DẠY & LỊCH LẶP RECURRING)
 * ============================================================================
 */

/**
 * Đếm chính xác số buổi dạy thực tế trong khoảng thời gian
 * @param {Object} params { userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const countTeachingSessions = async ({ userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!userId && !effectiveDeptId && isFacultyLevelLeader(currentUser?.role || currentUser?.vai_tro_chinh) && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    if (currentUser && !isCampusLevelAdmin(currentUser.role)) {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) hoặc Ban Giám Hiệu mới có quyền xem toàn bộ lịch giảng dạy trong toàn trường.',
      };
    }
  }

  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  if (fromDate && toDate) {
    query.startDate = { $lte: new Date(toDate) };
    query.endDate = { $gte: new Date(fromDate) };
  }

  const schedules = await Schedule.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
    .populate('subjectId', 'name code credits departmentId')
    .sort({ weekday: 1, startTime: 1 });

  const startDayTime = fromDate ? new Date(fromDate).getTime() : Date.now();
  const endDayTime = toDate ? new Date(toDate).getTime() : Date.now();

  const sessions = [];

  for (const sch of schedules) {
    const schStart = new Date(sch.startDate).getTime();
    const schEnd = new Date(sch.endDate).getTime();

    const effectiveStart = Math.max(startDayTime, schStart);
    const effectiveEnd = Math.min(endDayTime, schEnd);

    if (effectiveStart > effectiveEnd) continue;

    let cursor = new Date(effectiveStart);
    while (cursor.getTime() <= effectiveEnd) {
      const parts = getVietnamParts(cursor);
      if (parts.weekday === sch.weekday) {
        sessions.push({
          dateStr: parts.dateStr,
          dateDisplay: `${parts.day}/${parts.month}/${parts.year}`,
          weekday: sch.weekday,
          subjectName: sch.subjectName || 'Không có tên môn',
          subjectCode: sch.subjectCode || '',
          roomId: sch.roomId || '',
          shiftName: sch.shiftId?.name || '',
          startTime: sch.startTime || sch.shiftId?.startTime || '',
          endTime: sch.endTime || sch.shiftId?.endTime || '',
          teacherName: sch.userId?.fullName || 'N/A',
          teacherId: sch.userId?._id?.toString(),
        });
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return {
    totalSchedulesConfigured: schedules.length,
    totalActualSessions: sessions.length,
    sessions,
  };
};

/**
 * Đếm số giảng viên có lịch dạy trong ngày cụ thể theo Khoa
 * @param {Object} params { departmentId, date, currentUser }
 * @returns {Promise<Object>}
 */
const countTeachersWithScheduleOnDate = async ({ departmentId, date = new Date(), currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!effectiveDeptId && isFacultyLevelLeader(currentUser?.role || currentUser?.vai_tro_chinh) && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
  if (!perm.allowed) {
    return { unauthorized: true, reason: perm.reason };
  }

  const { dateStr, weekday } = getVietnamParts(date);
  const startOfDay = createVietnamDate(dateStr, '00:00:00.000');
  const endOfDay = createVietnamDate(dateStr, '23:59:59.999');

  const query = {
    weekday,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  };

  if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  const schedules = await Schedule.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime');

  const distinctTeachers = {};
  for (const s of schedules) {
    const uid = s.userId?._id?.toString();
    if (uid && !distinctTeachers[uid]) {
      distinctTeachers[uid] = {
        id: uid,
        fullName: s.userId?.fullName || 'N/A',
        email: s.userId?.email || '',
        sessionsCount: 0,
      };
    }
    if (uid) {
      distinctTeachers[uid].sessionsCount += 1;
    }
  }

  const teachersList = Object.values(distinctTeachers);

  return {
    date: dateStr,
    totalTeachers: teachersList.length,
    totalSessions: schedules.length,
    teachers: teachersList,
    schedules,
  };
};

module.exports = {
  checkUserPermission,
  checkDepartmentPermission,
  resolveUser,
  resolveDepartment,
  getAttendanceSummary,
  getTopLateUsers,
  getLeaveRequestSummary,
  countTeachingSessions,
  countTeachersWithScheduleOnDate,
};
