// Tạo đơn nghỉ phép / dạy bù / đổi ca / giải trình công, tra cứu số dư phép năm và điều phối phê duyệt đơn
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const minioStorage = require('../../config/minio');
const { DonNghiPhep, NguoiDung, HoSoCanBo, LichTrinh, VaiTroNguoiDung, NhatKyKiemToan } = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { normalizeRole, UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const {
  ServiceError,
  PENDING_LEAVE_STATUSES,
  getVietnamDateKey,
  calculateLeaveDays,
  getHolidayDateSet,
  getLeaveStatsByYear,
  formatLeaveRequestDoc,
  leaveInclude,
  isValidAttachmentUrl,
  validateLeaveScheduleConflict,
} = require('./tinhPhepNam.helper');
const pheDuyetDonService = require('./pheDuyetDon.service');

// Tạo mới đơn nghỉ phép, dạy bù, đổi ca hoặc giải trình công
const createLeaveRequestDomain = async ({
  loai_don,
  ly_do,
  ngay_bat_dau,
  ngay_ket_thuc,
  so_tiet_nghi,
  ca_thay_the_id,
  giang_vien_day_thay_id,
  tep_dinh_kem,
  file,
  lich_trinh_id,
  ngay_day_bu,
  isHalfDay,
  nhat_ky_id,
  currentUser,
}) => {
  const userId = currentUser?.id;
  const lockKey = `leave_submit:${userId}`;

  try {
    return await withDistributedLock(
      lockKey,
      20,
      async () => {
    if (hasAnyActiveRole(currentUser, ['admin'])) {
      throw new ServiceError(
        'Quản trị viên (Admin) phụ trách quản trị và xét duyệt đơn toàn trường, không áp dụng nộp đơn xin nghỉ phép cá nhân.',
        403,
        'ADMIN_CANNOT_CREATE_LEAVE'
      );
    }

    if (!loai_don || typeof loai_don !== 'string' || !ly_do || typeof ly_do !== 'string' || !ngay_bat_dau || !ngay_ket_thuc) {
      throw new ServiceError('Vui lòng cung cấp loại đơn (loai_don), lý do (ly_do), ngày bắt đầu và kết thúc hợp lệ.', 400);
    }

    const canonicalType = loai_don.trim().toLowerCase();
    const validCanonicalTypes = ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng', 'giai_trinh_cong', 'giai_trinh_thieu_check_out'];
    if (!validCanonicalTypes.includes(canonicalType)) {
      throw new ServiceError(
        'Loại đơn không hợp lệ. Chỉ chấp nhận: nghi_phep, day_bu, doi_ca, nghi_om, viec_rieng, giai_trinh_cong, giai_trinh_thieu_check_out.',
        400
      );
    }

    const start = new Date(ngay_bat_dau);
    const end = Boolean(isHalfDay) ? new Date(ngay_bat_dau) : new Date(ngay_ket_thuc);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ServiceError('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.', 400);
    }
    if (end < start) {
      throw new ServiceError('Ngày kết thúc không thể trước ngày bắt đầu.', 400);
    }

    const startKey = getVietnamDateKey(start);
    const endKey = getVietnamDateKey(end);
    if (endKey < startKey) {
      throw new ServiceError('Ngày kết thúc không thể trước ngày bắt đầu.', 400);
    }

    const todayKey = getVietnamDateKey(new Date());
    const isGiaiTrinhLoai = canonicalType === 'giai_trinh_cong' || canonicalType === 'giai_trinh_thieu_check_out';
    if (!isGiaiTrinhLoai && startKey < todayKey) {
      throw new ServiceError('Không thể nộp đơn xin nghỉ lùi về các ngày trong quá khứ.', 400);
    }

    if (canonicalType === 'giai_trinh_cong') {
      const minPastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const minPastKey = getVietnamDateKey(minPastDate);
      if (startKey < minPastKey) {
        throw new ServiceError('Đơn giải trình chấm công chỉ được áp dụng cho các ca làm việc trong vòng 30 ngày gần nhất.', 400);
      }
      if (startKey > todayKey) {
        throw new ServiceError('Không thể giải trình chấm công cho ca làm việc trong tương lai.', 400);
      }
    }

    let matchedMissingCheckoutLog = null;
    if (canonicalType === 'giai_trinh_thieu_check_out') {
      const minPastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const minPastKey = getVietnamDateKey(minPastDate);
      if (startKey < minPastKey) {
        throw new ServiceError('Đơn giải trình thiếu check-out chỉ áp dụng cho bản ghi trong vòng 30 ngày gần nhất.', 400);
      }
      if (startKey > todayKey) {
        throw new ServiceError('Không thể giải trình thiếu check-out cho ca trong tương lai.', 400);
      }
      const validNhatKyId = nhat_ky_id && isValidUuid(String(nhat_ky_id)) ? String(nhat_ky_id) : null;
      if (!validNhatKyId) {
        throw new ServiceError('Đơn giải trình thiếu check-out bắt buộc phải chỉ định bản ghi nhật ký (nhat_ky_id).', 400, 'MISSING_LOG_ID');
      }
      const { NhatKyChamCong } = require('../../models');
      const logRecord = await NhatKyChamCong.findOne({
        where: { id: validNhatKyId, nguoi_dung_id: userId, trang_thai: 'thieu_check_out' },
      });
      if (!logRecord) {
        throw new ServiceError('Không tìm thấy bản ghi nhật ký thiếu check-out hợp lệ cho bạn.', 404, 'LOG_NOT_FOUND');
      }
      if (logRecord.da_chot) {
        throw new ServiceError(
          `Không thể gửi giải trình cho ngày ${String(logRecord.ngay_cong).slice(0, 10)} vì kỳ công đã bị khóa sổ.`,
          409,
          'ATTENDANCE_LOCKED'
        );
      }
      const logDateKey = String(logRecord.ngay_cong || '').slice(0, 10);
      if (!logDateKey || logDateKey < minPastKey || logDateKey > todayKey) {
        throw new ServiceError(
          'Bản ghi nhật ký thiếu check-out nằm ngoài phạm vi 30 ngày gần nhất.',
          400,
          'LOG_DATE_OUT_OF_RANGE'
        );
      }
      const existingExplanation = await DonNghiPhep.findOne({
        where: { nhat_ky_id: validNhatKyId, trang_thai: { [Op.in]: [...PENDING_LEAVE_STATUSES, 'approved'] } },
      });
      if (existingExplanation) {
        throw new ServiceError('Bản ghi nhật ký này đã có đơn giải trình đang xử lý hoặc đã được duyệt.', 409, 'EXPLANATION_ALREADY_EXISTS');
      }
      matchedMissingCheckoutLog = logRecord;
    }

    let makeupDateStr = null;
    if (ngay_day_bu && (canonicalType === 'day_bu' || canonicalType === 'doi_ca')) {
      const parsedMakeupDate = new Date(ngay_day_bu);
      if (Number.isNaN(parsedMakeupDate.getTime())) {
        throw new ServiceError('Ngày dạy bù không hợp lệ.', 400);
      }
      makeupDateStr = getVietnamDateKey(parsedMakeupDate);
      if (makeupDateStr < todayKey) {
        throw new ServiceError('Ngày dạy bù không thể nằm trong quá khứ.', 400, 'PAST_MAKEUP_DATE');
      }
      const [my, mm, md] = makeupDateStr.split('-').map(Number);
      const makeupUtc = new Date(Date.UTC(my, mm - 1, md));
      const makeupHolidays = await getHolidayDateSet(makeupDateStr, makeupDateStr);
      if (makeupUtc.getUTCDay() === 0 || makeupHolidays.has(makeupDateStr)) {
        throw new ServiceError(
          'Ngày dạy bù không thể rơi vào Chủ nhật hoặc ngày nghỉ lễ.',
          400,
          'INVALID_MAKEUP_DATE'
        );
      }
    }
    let validScheduleId = lich_trinh_id && isValidUuid(String(lich_trinh_id)) ? String(lich_trinh_id) : null;
    if (canonicalType === 'giai_trinh_thieu_check_out' && matchedMissingCheckoutLog?.lich_trinh_id && !validScheduleId) {
      validScheduleId = String(matchedMissingCheckoutLog.lich_trinh_id);
    }
    const validSubstituteShiftId =
      ca_thay_the_id && isValidUuid(String(ca_thay_the_id)) ? String(ca_thay_the_id) : null;
    const validSubstituteLecturerId =
      giang_vien_day_thay_id && isValidUuid(String(giang_vien_day_thay_id))
        ? String(giang_vien_day_thay_id)
        : null;
    const parsedLeavePeriods = Math.max(0, parseInt(so_tiet_nghi, 10) || 0);

    if (canonicalType === 'doi_ca' && !validScheduleId) {
      throw new ServiceError('Đơn xin đổi ca bắt buộc phải chọn lịch trình giảng dạy (lich_trinh_id).', 400);
    }

    if (canonicalType === 'day_bu' && (!validScheduleId || !ngay_day_bu || !makeupDateStr)) {
      throw new ServiceError(
        !validScheduleId
          ? 'Đơn đăng ký dạy bù bắt buộc phải chọn lịch trình giảng dạy (lich_trinh_id).'
          : 'Đơn đăng ký dạy bù bắt buộc phải chọn ngày dạy bù (ngay_day_bu).',
        400
      );
    }

    if (canonicalType === 'day_bu' || canonicalType === 'doi_ca') {
      // Kiểm tra sở hữu lịch trình trước khi tra cứu/kiểm tra trùng lịch của đồng nghiệp (chống lộ thông tin)
      const targetSchedule = await LichTrinh.findByPk(validScheduleId);
      if (!targetSchedule) {
        throw new ServiceError('Không tìm thấy lịch trình giảng dạy được chọn.', 404);
      }
      if (String(targetSchedule.nguoi_dung_id) !== String(userId)) {
        throw new ServiceError(
          'Bạn chỉ được phép tạo đơn dạy bù / đổi ca cho lịch giảng dạy của chính mình.',
          403,
          'SCHEDULE_NOT_OWNED'
        );
      }

      await validateLeaveScheduleConflict({
        targetSchedule,
        substituteShiftId: validSubstituteShiftId,
        substituteLecturerId: validSubstituteLecturerId,
        conflictDateStr: makeupDateStr || startKey,
        applicantId: userId,
      });
    } else if (validSubstituteLecturerId) {
      if (String(validSubstituteLecturerId) === String(userId)) {
        throw new ServiceError('Không thể tự chỉ định chính mình làm giảng viên dạy thay.', 400);
      }
      const subUser = await NguoiDung.findByPk(validSubstituteLecturerId, {
        attributes: ['id', 'ho_ten', 'kich_hoat'],
      });
      if (!subUser || subUser.kich_hoat === false) {
        throw new ServiceError('Giảng viên dạy thay không tồn tại hoặc đang bị khóa.', 404);
      }
    }

    const normalizedReason = ly_do.trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      throw new ServiceError('Lý do phải có từ 5 đến 500 ký tự.', 400);
    }

    let finalAttachmentUrl = null;
    if (file) {
      if (file.buffer && file.buffer.length > 0) {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        const filename = `leave-${crypto.randomUUID()}${ext}`;
        const objectKey = `attachments/${filename}`;
        await minioStorage.putObject(objectKey, file.buffer, file.mimetype || 'image/png', {
          originalName: encodeURIComponent(file.originalname || 'minh-chung'),
          uploadedBy: String(userId),
        });
        finalAttachmentUrl = `/api/tai-tep/tep/${filename}`;
      } else if (file.filename) {
        finalAttachmentUrl = `/api/tai-tep/tep/${file.filename}`;
      }
    } else if (typeof tep_dinh_kem === 'string' && tep_dinh_kem.trim()) {
      if (!isValidAttachmentUrl(tep_dinh_kem)) {
        throw new ServiceError(
          'Đường dẫn tệp đính kèm không hợp lệ (chỉ chấp nhận URL http/https hoặc tệp tải lên hệ thống).',
          400,
          'INVALID_ATTACHMENT_URL'
        );
      }
      finalAttachmentUrl = tep_dinh_kem.trim();
    }

    const holidaySet = await getHolidayDateSet(start, end);
    const serverCalculatedDays = calculateLeaveDays(start, end, Boolean(isHalfDay), holidaySet);

    const isTimeOffLeaveType = ['nghi_phep', 'nghi_om', 'viec_rieng'].includes(canonicalType);
    if (isTimeOffLeaveType && serverCalculatedDays <= 0) {
      throw new ServiceError(
        'Khoảng thời gian xin nghỉ chỉ rơi vào Chủ nhật hoặc ngày nghỉ lễ (0 ngày làm việc).',
        400,
        'ZERO_LEAVE_DAYS'
      );
    }

    const isLeadership = hasAnyActiveRole(currentUser, ['truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong']);
    const initialStatus = isLeadership ? 'pending_bgh' : 'pending';

    let applicantInfo = null;
    const leaveRequest = await runInTransaction(async (transaction) => {
      const user = await NguoiDung.findByPk(userId, {
        include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['han_muc_phep_nam'] }],
        transaction,
      });
      if (!user) {
        throw new ServiceError('Không tìm thấy người dùng gửi đơn.', 404);
      }
      applicantInfo = {
        don_vi_chinh_id: user.don_vi_chinh_id,
        ho_ten: user.ho_ten,
      };

      if (isTimeOffLeaveType) {
        const overlappingLeave = await DonNghiPhep.findOne({
          where: {
            nguoi_dung_id: userId,
            loai_don: { [Op.in]: ['nghi_phep', 'nghi_om', 'viec_rieng'] },
            trang_thai: { [Op.in]: [...PENDING_LEAVE_STATUSES, 'approved'] },
            ngay_bat_dau: { [Op.lte]: endKey },
            ngay_ket_thuc: { [Op.gte]: startKey },
          },
          transaction,
        });

        if (overlappingLeave) {
          const statusDesc = overlappingLeave.trang_thai === 'approved' ? 'đã được phê duyệt' : 'đang chờ xét duyệt';
          const startFormatted = new Date(overlappingLeave.ngay_bat_dau).toLocaleDateString('vi-VN');
          const endFormatted = new Date(overlappingLeave.ngay_ket_thuc).toLocaleDateString('vi-VN');
          throw new ServiceError(
            `Bạn đã có một đơn nghỉ (${statusDesc}) từ ngày ${startFormatted} đến ngày ${endFormatted} trùng với thời gian này.`,
            409,
            'OVERLAPPING_LEAVE_REQUEST'
          );
        }
      } else if (canonicalType === 'day_bu' || canonicalType === 'doi_ca') {
        // Cho phép nộp nhiều đơn dạy bù/đổi ca khác lịch trình trong cùng một ngày; chỉ chặn trùng cùng lớp
        const overlappingScheduleChange = await DonNghiPhep.findOne({
          where: {
            nguoi_dung_id: userId,
            loai_don: canonicalType,
            lich_trinh_id: validScheduleId,
            trang_thai: { [Op.in]: [...PENDING_LEAVE_STATUSES, 'approved'] },
            ngay_bat_dau: { [Op.lte]: endKey },
            ngay_ket_thuc: { [Op.gte]: startKey },
          },
          transaction,
        });

        if (overlappingScheduleChange) {
          const statusDesc = overlappingScheduleChange.trang_thai === 'approved' ? 'đã được phê duyệt' : 'đang chờ xét duyệt';
          throw new ServiceError(
            `Lớp học này đã có đơn ${canonicalType === 'day_bu' ? 'dạy bù' : 'đổi ca'} (${statusDesc}) trong khoảng thời gian này.`,
            409,
            'OVERLAPPING_LEAVE_REQUEST'
          );
        }
      }

      if (canonicalType === 'nghi_phep') {
        const quota = user.ho_so?.han_muc_phep_nam !== undefined ? Number(user.ho_so.han_muc_phep_nam) : 12;
        const startYear = Number(startKey.slice(0, 4));
        const endYear = Number(endKey.slice(0, 4));

        for (let targetYear = startYear; targetYear <= endYear; targetYear += 1) {
          const yearStart = new Date(`${targetYear}-01-01T00:00:00+07:00`);
          const yearEnd = new Date(`${targetYear}-12-31T23:59:59.999+07:00`);
          const targetYearLeavesStart = new Date(Math.max(start.getTime(), yearStart.getTime()));
          const targetYearLeavesEnd = new Date(Math.min(end.getTime(), yearEnd.getTime()));
          const requestedDaysInYear = calculateLeaveDays(targetYearLeavesStart, targetYearLeavesEnd, Boolean(isHalfDay), holidaySet);
          if (requestedDaysInYear <= 0) continue;

          const { daysUsed, pendingAnnualLeaveDays } = await getLeaveStatsByYear(userId, targetYear, { transaction });
          const availableDays = Math.max(0, quota - daysUsed - pendingAnnualLeaveDays);

          if (availableDays <= 0) {
            throw new ServiceError(
              `Bạn đã sử dụng hoặc đang có đơn chờ duyệt hết ${quota} ngày phép của năm ${targetYear}. Vui lòng chọn loại đơn "Đăng ký dạy bù" hoặc "Xin đổi ca dạy".`,
              400,
              'LEAVE_QUOTA_EXHAUSTED'
            );
          }
          if (requestedDaysInYear > availableDays) {
            throw new ServiceError(
              `Số ngày xin nghỉ thuộc năm ${targetYear} (${requestedDaysInYear} ngày) vượt quá số ngày phép khả dụng (${availableDays} ngày, đã bao gồm các đơn đang chờ duyệt).`,
              400,
              'LEAVE_QUOTA_EXCEEDED'
            );
          }
        }
      }

      return DonNghiPhep.create(
        {
          nguoi_dung_id: userId,
          loai_don: canonicalType,
          ly_do: normalizedReason,
          ngay_bat_dau: startKey,
          ngay_ket_thuc: endKey,
          so_ngay: serverCalculatedDays,
          so_tiet_nghi: parsedLeavePeriods,
          lich_trinh_id: validScheduleId,
          ca_thay_the_id: validSubstituteShiftId,
          giang_vien_day_thay_id: validSubstituteLecturerId,
          ngay_day_bu: makeupDateStr,
          tep_dinh_kem: finalAttachmentUrl,
          trang_thai: initialStatus,
          nhat_ky_id: canonicalType === 'giai_trinh_thieu_check_out' && nhat_ky_id && isValidUuid(String(nhat_ky_id))
            ? String(nhat_ky_id)
            : null,
        },
        { transaction }
      );
    });

    const createdDoc = formatLeaveRequestDoc(leaveRequest);
    NhatKyKiemToan?.create?.({
      nguoi_thuc_hien_id: userId,
      loai_chu_the: 'user',
      hanh_dong: 'CREATE_LEAVE_REQUEST',
      doi_tuong_id: String(leaveRequest.id),
      loai_doi_tuong: 'don_nghi_phep',
      chi_tiet: {
        loai_don: canonicalType,
        ngay_bat_dau: startKey,
        ngay_ket_thuc: endKey,
        so_ngay: serverCalculatedDays,
        trang_thai: initialStatus,
      },
    })?.catch?.((err) => console.error('[AuditLog Error CREATE_LEAVE_REQUEST]:', err.message));

    try {
      const { emitLeaveRequestUpdate } = require('../../config/socket');
      emitLeaveRequestUpdate({
        ...createdDoc,
        nguoi_dung_id: userId,
        don_vi_chinh_id: applicantInfo?.don_vi_chinh_id || null,
        ho_ten_nguoi_tao: applicantInfo?.ho_ten || null,
      });
    } catch (_) {}

    return createdDoc;
      },
      { throwOnBusy: true, logPrefix: '[LeaveSubmit]' }
    );
  } catch (error) {
    if (error?.code === 'DISTRIBUTED_LOCK_BUSY') {
      throw new ServiceError(
        'Yêu cầu nộp đơn xin nghỉ của bạn đang được xử lý. Vui lòng không nhấn nút gửi liên tục.',
        429,
        'CONCURRENT_SUBMISSION_BLOCKED'
      );
    }
    if (error instanceof ServiceError) throw error;
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error?.parent?.number === 2627 ||
      error?.parent?.number === 2601
    ) {
      throw new ServiceError(
        'Bạn đã có một đơn nghỉ trùng lặp thời gian đang chờ duyệt hoặc đã duyệt trong hệ thống.',
        409,
        'DUPLICATE_LEAVE_REQUEST'
      );
    }
    throw error;
  }
};

// Lấy danh sách đơn từ theo bộ lọc và phạm vi quyền hạn
const fetchLeaveRequests = async ({ trang_thai, loai_don, nguoi_dung_id, currentUser }) => {
  const where = {};

  if (trang_thai && typeof trang_thai === 'string') {
    if (trang_thai === 'pending') {
      where.trang_thai = { [Op.in]: PENDING_LEAVE_STATUSES };
    } else {
      where.trang_thai = trang_thai;
    }
  }
  if (loai_don && typeof loai_don === 'string' && loai_don.trim() && loai_don !== 'all') {
    where.loai_don = loai_don.trim().toLowerCase();
  }

  if (nguoi_dung_id) {
    if (typeof nguoi_dung_id !== 'string' || !isValidUuid(nguoi_dung_id)) {
      throw new ServiceError('Mã người dùng không hợp lệ.', 400);
    }
  }

  const currentUserId = String(currentUser.id);

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb'])) {
    if (nguoi_dung_id) where.nguoi_dung_id = nguoi_dung_id;
  } else if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    const facultyUserIds = await getDeanScopedUserIds(currentUser);
    if (nguoi_dung_id) {
      if (!facultyUserIds.map(String).includes(String(nguoi_dung_id))) {
        throw new ServiceError('Bạn không có quyền xem đơn của nhân sự ngoài khoa.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else {
      where.nguoi_dung_id = { [Op.in]: facultyUserIds.length ? facultyUserIds : ['00000000-0000-0000-0000-000000000000'] };
    }
  } else {
    where.nguoi_dung_id = currentUserId;
  }

  const requests = await DonNghiPhep.findAll({
    where,
    include: leaveInclude,
    order: [['tao_luc', 'DESC']],
  });

  return requests.map(formatLeaveRequestDoc);
};

// Xem chi tiết một đơn từ kèm kiểm tra quyền truy cập
const fetchLeaveRequestById = async (id, currentUser) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await DonNghiPhep.findByPk(String(id), { include: leaveInclude });
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  const currentUserId = String(currentUser.id);
  const applicantId = String(request.nguoi_dung_id);

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb'])) {
    // Quản trị viên / BGH / TCCB xem toàn trường
  } else if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    const inScope = await isUserInDeanScope(currentUser, applicantId);
    if (!inScope && applicantId !== currentUserId) {
      throw new ServiceError('Bạn không có quyền xem đơn của nhân sự ngoài đơn vị.', 403);
    }
  } else if (applicantId !== currentUserId) {
    throw new ServiceError('Bạn không có quyền xem đơn này.', 403);
  }

  return formatLeaveRequestDoc(request);
};

// Tính số dư phép năm còn lại theo từng nhân sự
const fetchLeaveBalance = async (nguoi_dung_id, currentUser, nam) => {
  const currentYear = Number(nam) || new Date().getFullYear();
  const currentUserId = String(currentUser.id);
  let targetUserId = currentUserId;

  if (nguoi_dung_id && String(nguoi_dung_id) !== currentUserId) {
    if (typeof nguoi_dung_id !== 'string' || !isValidUuid(nguoi_dung_id)) {
      throw new ServiceError('Mã người dùng không hợp lệ.', 400);
    }

    if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb'])) {
      targetUserId = nguoi_dung_id;
    } else if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
      const inScope = await isUserInDeanScope(currentUser, nguoi_dung_id);
      if (!inScope) {
        throw new ServiceError('Bạn không có quyền xem số dư ngày phép của nhân sự ngoài đơn vị.', 403);
      }
      targetUserId = nguoi_dung_id;
    } else {
      throw new ServiceError('Bạn chỉ có quyền tra cứu số dư ngày phép của chính mình.', 403);
    }
  }

  const user = await NguoiDung.findByPk(targetUserId, {
    include: [
      { model: HoSoCanBo, as: 'ho_so', attributes: ['han_muc_phep_nam'] },
      { model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro', 'tu_ngay', 'den_ngay'] },
    ],
  });
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  if (hasAnyActiveRole(user, ['admin'])) {
    return {
      nguoi_dung_id: targetUserId,
      nam: currentYear,
      han_muc_phep_nam: 0,
      so_ngay_da_nghi: 0,
      so_ngay_cho_duyet: 0,
      so_ngay_con_lai: 0,
      so_ngay_kha_dung: 0,
      is_admin: true,
      message: 'Tài khoản Quản trị viên (Admin) không áp dụng quản lý hạn mức ngày phép.',
    };
  }

  const quota = user.ho_so?.han_muc_phep_nam !== undefined ? Number(user.ho_so.han_muc_phep_nam) : 12;
  const { daysUsed, pendingDays, pendingAnnualLeaveDays } = await getLeaveStatsByYear(targetUserId, currentYear);
  const remainingDays = Math.max(0, quota - daysUsed);
  const availableDays = Math.max(0, quota - daysUsed - pendingAnnualLeaveDays);

  return {
    nguoi_dung_id: targetUserId,
    nam: currentYear,
    han_muc_phep_nam: quota,
    so_ngay_da_nghi: daysUsed,
    so_ngay_cho_duyet: pendingDays,
    so_ngay_con_lai: remainingDays,
    so_ngay_kha_dung: availableDays,
    is_admin: false,
    message: 'Tính số dư ngày phép thành công.',
  };
};

// Lấy danh sách giảng viên đang công tác phục vụ chọn người dạy thay khi đổi ca
const fetchSubstituteLecturers = async (currentUser) => {
  const currentUserId = currentUser?.id;
  return NguoiDung.findAll({
    where: {
      kich_hoat: true,
      trang_thai_lam_viec: 'dang_lam_viec',
      vai_tro_chinh: { [Op.notIn]: ['admin', 'ke_toan'] },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    },
    attributes: ['id', 'ho_ten', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id'],
    order: [['ho_ten', 'ASC']],
  });
};

module.exports = {
  ServiceError,
  calculateLeaveDays,
  getLeaveStatsByYear,
  createLeaveRequestDomain,
  fetchLeaveRequests,
  fetchLeaveRequestById,
  fetchLeaveBalance,
  fetchSubstituteLecturers,
  ...pheDuyetDonService,
};
