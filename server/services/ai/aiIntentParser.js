/**
 * Phân tích câu hỏi tiếng Việt thành ý định, khoảng thời gian và đối tượng cần tra cứu.
 */
const { parseVietnameseDateRange } = require('../../utils/aiDateParser');
const { resolveUser, resolveDepartment } = require('./aiAnalytics.service');
const { normalizeRole, UNIT_LEADER_ROLES } = require('../../utils/roleUtils');

/**
 * Danh sách toàn bộ các Intent chuẩn tắc của hệ thống
 */
const INTENTS = {
  // Nhóm chấm công tổng quan
  ATTENDANCE_PRESENT_COUNT: 'ATTENDANCE_PRESENT_COUNT',
  ATTENDANCE_LATE_COUNT: 'ATTENDANCE_LATE_COUNT',
  ATTENDANCE_ABSENT_COUNT: 'ATTENDANCE_ABSENT_COUNT',
  ATTENDANCE_TOP_LATE: 'ATTENDANCE_TOP_LATE',
  ATTENDANCE_DEPT_SUMMARY: 'ATTENDANCE_DEPT_SUMMARY',

  // Nhóm chấm công cá nhân
  ATTENDANCE_USER_SUMMARY: 'ATTENDANCE_USER_SUMMARY',
  ATTENDANCE_USER_ON_TIME: 'ATTENDANCE_USER_ON_TIME',
  ATTENDANCE_USER_LATE: 'ATTENDANCE_USER_LATE',
  ATTENDANCE_USER_ABSENT: 'ATTENDANCE_USER_ABSENT',
  ATTENDANCE_USER_TOTAL: 'ATTENDANCE_USER_TOTAL',

  // Nhóm đơn nghỉ / dạy bù / đổi ca
  LEAVE_REQUEST_COUNT: 'LEAVE_REQUEST_COUNT',
  LEAVE_REQUEST_USER_DAYS: 'LEAVE_REQUEST_USER_DAYS',
  LEAVE_REQUEST_TYPE_COUNT: 'LEAVE_REQUEST_TYPE_COUNT',

  // Nhóm lịch giảng dạy
  SCHEDULE_USER_CHECK: 'SCHEDULE_USER_CHECK',
  SCHEDULE_USER_COUNT: 'SCHEDULE_USER_COUNT',
  SCHEDULE_USER_DETAILS: 'SCHEDULE_USER_DETAILS',
  SCHEDULE_DEPT_TEACHERS_TODAY: 'SCHEDULE_DEPT_TEACHERS_TODAY',

  // Báo cáo chung
  GENERAL_REPORT: 'GENERAL_REPORT',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Phân tích ý định (Intent Parser) từ câu hỏi tiếng Việt tự nhiên
 * @param {string} questionText
 * @param {Object} currentUser
 * @returns {Promise<Object>}
 */
const parseIntent = async (questionText = '', currentUser = null) => {
  const cleanQuestion = (questionText || '').trim();
  const lower = cleanQuestion.toLowerCase();

  // 1. Phân tích khoảng thời gian tiếng Việt
  const dateRange = parseVietnameseDateRange(cleanQuestion);

  // 2. Tìm kiếm đối tượng người dùng nếu có trong câu hỏi
  const userResolution = await resolveUser(cleanQuestion, currentUser);

  // 3. Tìm kiếm Khoa / Phòng ban nếu có trong câu hỏi
  const deptMatch = await resolveDepartment(cleanQuestion, currentUser);
  const curRole = normalizeRole(currentUser?.role || currentUser?.vai_tro_chinh);
  const defaultTruongKhoaDept = UNIT_LEADER_ROLES.includes(curRole) && currentUser?.departmentId ? { _id: currentUser.departmentId } : null;

  // --------------------------------------------------------------------------
  // BẮT Ý ĐỊNH DỰA TRÊN TỪ KHÓA & MẪU CÂU (RULE-BASED INTENT CLASSIFIER)
  // --------------------------------------------------------------------------

  // A. LỊCH GIẢNG DẠY
  const isScheduleQuestion =
    lower.includes('lịch dạy') ||
    lower.includes('lịch giảng dạy') ||
    lower.includes('lịch học') ||
    lower.includes('buổi dạy') ||
    lower.includes('tiết dạy') ||
    lower.includes('có lịch') ||
    lower.includes('có tiết') ||
    lower.includes('dạy bao nhiêu') ||
    lower.includes('giảng viên dạy') ||
    lower.includes('gv dạy') ||
    lower.includes('người dạy') ||
    lower.includes('bao nhiêu giảng viên') ||
    lower.includes('bao nhiêu gv');

  if (isScheduleQuestion) {
    if (
      lower.includes('bao nhiêu giảng viên') ||
      lower.includes('bao nhiêu gv') ||
      lower.includes('có bao nhiêu người dạy') ||
      lower.includes('giảng viên dạy')
    ) {
      return {
        intent: INTENTS.SCHEDULE_DEPT_TEACHERS_TODAY,
        dateRange,
        department: deptMatch || defaultTruongKhoaDept,
        rawQuestion: cleanQuestion,
      };
    }

    if (userResolution && !userResolution.notFound) {
      if (userResolution.isAmbiguous) {
        return {
          intent: INTENTS.SCHEDULE_USER_DETAILS,
          isAmbiguousUser: true,
          matches: userResolution.matches,
          rawQuestion: cleanQuestion,
        };
      }

      if (lower.includes('bao nhiêu buổi') || lower.includes('mấy buổi') || lower.includes('bao nhiêu tiết')) {
        return {
          intent: INTENTS.SCHEDULE_USER_COUNT,
          targetUser: userResolution.user,
          dateRange,
          rawQuestion: cleanQuestion,
        };
      }

      if (lower.includes('có lịch') || lower.includes('có dạy không')) {
        return {
          intent: INTENTS.SCHEDULE_USER_CHECK,
          targetUser: userResolution.user,
          dateRange,
          rawQuestion: cleanQuestion,
        };
      }

      return {
        intent: INTENTS.SCHEDULE_USER_DETAILS,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (currentUser && ['giang_vien', 'nhan_vien', 'chuyen_vien'].includes(curRole)) {
      const selfResolution = await resolveUser('tôi', currentUser);
      return {
        intent: INTENTS.SCHEDULE_USER_DETAILS,
        targetUser: selfResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }
  }

  // B. ĐƠN TỪ (NGHỈ PHÉP, DẠY BÙ, ĐỔI CA)
  const isLeaveQuestion =
    lower.includes('đơn xin nghỉ') ||
    lower.includes('đơn nghỉ') ||
    lower.includes('nghỉ phép') ||
    lower.includes('dạy bù') ||
    lower.includes('đổi ca') ||
    lower.includes('ngày nghỉ') ||
    lower.includes('bao nhiêu đơn') ||
    lower.includes('có bao nhiêu đơn') ||
    lower.includes('đơn bị từ chối');

  if (isLeaveQuestion) {
    if (lower.includes('dạy bù')) {
      return {
        intent: INTENTS.LEAVE_REQUEST_TYPE_COUNT,
        leaveType: 'day_bu',
        status: lower.includes('chờ') ? 'pending' : lower.includes('duyệt') ? 'approved' : null,
        department: deptMatch || defaultTruongKhoaDept,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (lower.includes('đổi ca')) {
      return {
        intent: INTENTS.LEAVE_REQUEST_TYPE_COUNT,
        leaveType: 'doi_ca',
        status: lower.includes('chờ') ? 'pending' : lower.includes('duyệt') ? 'approved' : null,
        department: deptMatch || defaultTruongKhoaDept,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (userResolution && !userResolution.notFound) {
      if (userResolution.isAmbiguous) {
        return {
          intent: INTENTS.LEAVE_REQUEST_USER_DAYS,
          isAmbiguousUser: true,
          matches: userResolution.matches,
          rawQuestion: cleanQuestion,
        };
      }
      return {
        intent: INTENTS.LEAVE_REQUEST_USER_DAYS,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    let statusFilter = null;
    if (lower.includes('được duyệt') || lower.includes('đã duyệt')) {
      statusFilter = 'approved';
    } else if (lower.includes('chờ duyệt') || lower.includes('đang chờ')) {
      statusFilter = 'pending';
    } else if (lower.includes('từ chối') || lower.includes('bị từ chối')) {
      statusFilter = 'rejected';
    }

    return {
      intent: INTENTS.LEAVE_REQUEST_COUNT,
      status: statusFilter,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  // C. CHUYÊN CẦN / CHẤM CÔNG CỦA NGƯỜI DÙNG CỤ THỂ
  if (userResolution && !userResolution.notFound) {
    if (userResolution.isAmbiguous) {
      return {
        intent: INTENTS.ATTENDANCE_USER_SUMMARY,
        isAmbiguousUser: true,
        matches: userResolution.matches,
        rawQuestion: cleanQuestion,
      };
    }

    if (
      (lower.includes('đúng giờ') || lower.includes('on time')) &&
      (lower.includes('trễ') || lower.includes('muộn'))
    ) {
      return {
        intent: INTENTS.ATTENDANCE_USER_SUMMARY,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (lower.includes('trễ') || lower.includes('muộn')) {
      return {
        intent: INTENTS.ATTENDANCE_USER_LATE,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (lower.includes('đúng giờ') || lower.includes('on time')) {
      return {
        intent: INTENTS.ATTENDANCE_USER_ON_TIME,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (lower.includes('vắng') || lower.includes('nghỉ không phép')) {
      return {
        intent: INTENTS.ATTENDANCE_USER_ABSENT,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    if (lower.includes('tổng cộng') || lower.includes('tổng số ngày chấm công') || lower.includes('bao nhiêu ngày chấm công')) {
      return {
        intent: INTENTS.ATTENDANCE_USER_TOTAL,
        targetUser: userResolution.user,
        dateRange,
        rawQuestion: cleanQuestion,
      };
    }

    return {
      intent: INTENTS.ATTENDANCE_USER_SUMMARY,
      targetUser: userResolution.user,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  // D. AI ĐI TRỄ NHIỀU NHẤT
  if (
    (lower.includes('ai đi trễ') || lower.includes('ai muộn') || lower.includes('đi trễ nhiều nhất') || lower.includes('muộn nhiều nhất'))
  ) {
    return {
      intent: INTENTS.ATTENDANCE_TOP_LATE,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  // E. ĐI LÀM / ĐI TRỄ / VẮNG TOÀN TRƯỜNG HOẶC THEO KHOA
  if (lower.includes('đi làm') || lower.includes('có mặt')) {
    return {
      intent: INTENTS.ATTENDANCE_PRESENT_COUNT,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  if (lower.includes('đi trễ') || lower.includes('đi muộn') || lower.includes('bao nhiêu người trễ')) {
    return {
      intent: INTENTS.ATTENDANCE_LATE_COUNT,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  if (lower.includes('vắng') || lower.includes('nghỉ')) {
    return {
      intent: INTENTS.ATTENDANCE_ABSENT_COUNT,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  // F. BÁO CÁO TỔNG HỢP / KPI
  if (lower.includes('báo cáo') || lower.includes('tổng hợp') || lower.includes('tóm tắt')) {
    return {
      intent: INTENTS.GENERAL_REPORT,
      department: deptMatch || defaultTruongKhoaDept,
      dateRange,
      rawQuestion: cleanQuestion,
    };
  }

  // G. Không nhận diện được intent rõ ràng
  return {
    intent: INTENTS.UNKNOWN,
    department: deptMatch || defaultTruongKhoaDept,
    dateRange,
    rawQuestion: cleanQuestion,
  };
};

module.exports = {
  INTENTS,
  parseIntent,
};
