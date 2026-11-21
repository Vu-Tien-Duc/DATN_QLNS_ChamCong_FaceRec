// Phê duyệt, từ chối và hủy đơn nghỉ phép đa cấp (Khoa -> BGH), chặn tự duyệt và đồng bộ/hoàn tác bảng công
const { Op } = require('sequelize');
const {
  DonNghiPhep,
  LichSuDuyetDon,
  NhatKyChamCong,
  LuotQuetChamCong,
  LichTrinh,
  LichTrinhTuan,
  NgoaiLeLichTrinh,
  CaLamViec,
  NguoiDung,
  HoSoCanBo,
  NhatKyKiemToan,
} = require('../../models');
const { isScheduleActiveOnDate } = require('../../utils/ngayLichTrinh.utils');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { normalizeRole, UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { getEffectivePermissions, PERMISSIONS } = require('../../config/permissions');
const {
  calculateCheckOutStatus,
  calculateActualTeachingPeriods,
  getVietnamTime,
  timeStringToMinutes,
} = require('../../utils/thoiGianChamCong.utils');
const { layKhoiTheoLichTrinh } = require('../chamCong/khoiCaDay.service');
const { sendLeaveApprovedEmail, sendLeaveRejectedEmail } = require('../heThong/guiEmail.service');
const {
  ServiceError,
  PENDING_LEAVE_STATUSES,
  getVietnamDateKey,
  getLeaveOccurrenceDates,
  calculateLeaveDays,
  getHolidayDateSet,
  getLeaveStatsByYear,
  formatLeaveRequestDoc,
  leaveInclude,
  validateLeaveScheduleConflict,
} = require('./tinhPhepNam.helper');

// Kiểm tra thẩm quyền duyệt đơn đa cấp (chặn tự duyệt, kiểm tra phạm vi đơn vị và ủy quyền phó khoa)
const validateLeaveApprovalPermission = async (currentUser, leaveRequest) => {
  const applicantId = String(leaveRequest.nguoi_dung_id);
  const currentUserId = String(currentUser.id);

  if (applicantId === currentUserId) {
    return {
      allowed: false,
      message: 'Bạn không thể tự xử lý đơn xin nghỉ của chính mình. Đơn của bạn phải do cấp trên phê duyệt.',
      status: 403,
      errorCode: 'CANNOT_APPROVE_OWN_REQUEST',
    };
  }

  const status = leaveRequest.trang_thai;
  const currentLevel = status === 'pending_bgh' ? 2 : 1;

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb'])) {
    const isAdminOrBgh = hasAnyActiveRole(currentUser, ['admin', 'bgh']);
    if (!isAdminOrBgh && hasAnyActiveRole(currentUser, ['tccb'])) {
      const applicant = await NguoiDung.findByPk(applicantId, { attributes: ['id', 'vai_tro_chinh'] });
      const applicantRole = normalizeRole(applicant?.vai_tro_chinh);
      if (['admin', 'bgh'].includes(applicantRole)) {
        return {
          allowed: false,
          message: 'Chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền duyệt đơn của Ban Giám Hiệu / Quản trị viên.',
          status: 403,
          errorCode: 'BGH_APPROVAL_REQUIRED',
        };
      }
    }
    return { allowed: true, approverLevel: currentLevel };
  }

  if (status === 'pending_bgh') {
    return {
      allowed: false,
      message: 'Đơn này đang ở Cấp 2, chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền phê duyệt.',
      status: 403,
      errorCode: 'BGH_APPROVAL_REQUIRED',
    };
  }

  if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    const applicant = await NguoiDung.findByPk(applicantId, {
      attributes: ['id', 'vai_tro_chinh', 'don_vi_chinh_id'],
    });
    if (!applicant) {
      return { allowed: false, message: 'Người nộp đơn không tồn tại trên hệ thống.', status: 404 };
    }

    const applicantRole = normalizeRole(applicant.vai_tro_chinh);
    if (['truong_khoa', 'admin', 'bgh'].includes(applicantRole)) {
      return {
        allowed: false,
        message: 'Chỉ Ban Giám Hiệu mới có quyền phê duyệt đơn của Trưởng khoa.',
        status: 403,
        errorCode: 'DEAN_LEAVE_REQUIRES_BGH',
      };
    }

    const effectivePerms = getEffectivePermissions(currentUser);
    const hasDelegation = effectivePerms.has(PERMISSIONS.DON_TU_DUYET_CAP_1);
    const actorRole = normalizeRole(currentUser.vai_tro_chinh);
    if (['pho_khoa', 'pho_bo_mon', 'pho_phong'].includes(actorRole) && !hasDelegation) {
      return {
        allowed: false,
        message: 'Phó đơn vị chưa được ủy quyền không có quyền phê duyệt đơn cấp đơn vị.',
        status: 403,
        errorCode: 'UNAUTHORIZED_VICE_DEAN',
      };
    }

    const inScope = await isUserInDeanScope(currentUser, applicant.id);
    if (!inScope) {
      return {
        allowed: false,
        message: 'Bạn chỉ có quyền phê duyệt đơn của nhân sự thuộc đơn vị của mình.',
        status: 403,
        errorCode: 'OUT_OF_DEPARTMENT_SCOPE',
      };
    }

    return { allowed: true, approverLevel: 1 };
  }

  return { allowed: false, message: 'Bạn không có quyền thực hiện hành động này.', status: 403 };
};

// Kiểm tra phiên bản bản ghi để chống ghi đè đồng thời (Optimistic Locking)
const assertExpectedVersion = (request, phien_ban_ky_vong) => {
  if (phien_ban_ky_vong !== undefined && phien_ban_ky_vong !== null && phien_ban_ky_vong !== '' && request.cap_nhat_luc) {
    const expectedMs = Number(phien_ban_ky_vong);
    const actualMs = new Date(request.cap_nhat_luc).getTime();
    if (!Number.isFinite(expectedMs) || expectedMs !== actualMs) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được cập nhật bởi phiên khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }
  }
};

// Chặn chỉnh sửa nếu bản ghi chấm công của ngày đó đã khóa sổ lương
const assertAttendanceLogUnlocked = (existingLog, dateLabel) => {
  if (existingLog && existingLog.da_chot) {
    throw new ServiceError(
      `Không thể cập nhật dữ liệu chấm công ngày ${dateLabel || existingLog.ngay_cong} vì kỳ công đã bị khóa sổ.`,
      409,
      'ATTENDANCE_LOCKED'
    );
  }
};

// Phê duyệt đơn (chuyển cấp Khoa -> BGH hoặc chốt duyệt và cập nhật bảng công/lịch)
const approveLeaveRequestDomain = async ({ id, ghi_chu_duyet, phien_ban_ky_vong, so_tiet_xac_nhan, currentUser, dia_chi_ip }) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await DonNghiPhep.findByPk(String(id));
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  assertExpectedVersion(request, phien_ban_ky_vong);

  const currentStatus = request.trang_thai;
  if (!PENDING_LEAVE_STATUSES.includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  const cleanNote = typeof ghi_chu_duyet === 'string' ? ghi_chu_duyet.trim() : '';
  const currentUserId = currentUser.id;
  const isBghOrHrActor = hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb']);
  const currentLevel = currentStatus === 'pending_bgh' ? 2 : 1;
  const approvalLevelLabel = isBghOrHrActor || currentLevel === 2 ? 'bgh' : 'khoa';
  const requiredLevels = Number(request.so_ngay ?? 1) > 3 ? 2 : 1;
  const isFinalApproval = isBghOrHrActor || currentLevel >= requiredLevels;
  const nextStatus = isFinalApproval ? 'approved' : 'pending_bgh';

  const updatedRequest = await runInTransaction(async (transaction) => {
    if (request.loai_don === 'nghi_phep') {
      const startDate = new Date(request.ngay_bat_dau);
      const endDate = new Date(request.ngay_ket_thuc);
      const startYear = Number(getVietnamDateKey(startDate).slice(0, 4));
      const endYear = Number(getVietnamDateKey(endDate).slice(0, 4));
      const isHalfDay = Number(request.so_ngay) === 0.5;
      const holidaySet = await getHolidayDateSet(startDate, endDate, { transaction });

      const applicantUser = await NguoiDung.findByPk(request.nguoi_dung_id, {
        include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['han_muc_phep_nam'] }],
        transaction,
      });
      const quota = applicantUser?.ho_so?.han_muc_phep_nam !== undefined ? Number(applicantUser.ho_so.han_muc_phep_nam) : 12;

      for (let targetYear = startYear; targetYear <= endYear; targetYear += 1) {
        const yearStart = new Date(`${targetYear}-01-01T00:00:00+07:00`);
        const yearEnd = new Date(`${targetYear}-12-31T23:59:59.999+07:00`);
        const targetYearLeavesStart = new Date(Math.max(startDate.getTime(), yearStart.getTime()));
        const targetYearLeavesEnd = new Date(Math.min(endDate.getTime(), yearEnd.getTime()));
        const requestedDays = isHalfDay
          ? 0.5
          : calculateLeaveDays(targetYearLeavesStart, targetYearLeavesEnd, false, holidaySet);
        if (requestedDays <= 0) continue;

        const { daysUsed } = await getLeaveStatsByYear(request.nguoi_dung_id, targetYear, { transaction });
        const remainingDays = Math.max(0, quota - daysUsed);
        if (requestedDays > remainingDays) {
          throw new ServiceError(
            `Không thể phê duyệt đơn: Cán bộ/giảng viên chỉ còn ${remainingDays} ngày phép khả dụng, đơn này xin nghỉ ${requestedDays} ngày trong năm ${targetYear}.`,
            400,
            'INSUFFICIENT_LEAVE_DAYS'
          );
        }
      }
    }

    const [affectedCount] = await DonNghiPhep.update(
      {
        trang_thai: nextStatus,
        nguoi_duyet_id: currentUserId,
        thoi_gian_duyet: new Date(),
        ly_do_tu_choi: null,
      },
      { where: { id: request.id, trang_thai: currentStatus }, transaction }
    );

    if (affectedCount !== 1) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    await LichSuDuyetDon.create(
      {
        don_nghi_phep_id: request.id,
        nguoi_duyet_id: currentUserId,
        cap_duyet: approvalLevelLabel,
        hanh_dong: 'approved',
        y_kien: cleanNote || null,
        thoi_diem: new Date(),
      },
      { transaction }
    );

    if (isFinalApproval) {
      // Giải trình thiếu check-out: điền giờ ra xác nhận, giữ lại trạng thái đi muộn nếu di_muon_phut > 0
      if (request.loai_don === 'giai_trinh_thieu_check_out' && request.nhat_ky_id) {
        const logRecord = await NhatKyChamCong.findByPk(request.nhat_ky_id, { transaction });
        if (!logRecord) {
          throw new ServiceError('Bản ghi nhật ký chấm công liên kết không còn tồn tại.', 404, 'LOG_NOT_FOUND');
        }
        assertAttendanceLogUnlocked(logRecord, String(logRecord.ngay_cong));
        if (logRecord.trang_thai !== 'thieu_check_out') {
          throw new ServiceError(
            `Bản ghi nhật ký này không còn ở trạng thái thiếu check-out (hiện: ${logRecord.trang_thai}).`,
            409,
            'LOG_STATUS_CHANGED'
          );
        }

        // Số tiết xác nhận: bắt buộc hợp lệ (>= 1) đối với bản ghi giảng dạy để tránh fallback sai lệch công
        const rawPeriods =
          so_tiet_xac_nhan !== undefined
            ? so_tiet_xac_nhan
            : (request.so_tiet_xac_nhan ?? (request.so_tiet_nghi > 0 ? request.so_tiet_nghi : null));
        const parsedPeriods = rawPeriods !== null && rawPeriods !== undefined ? Number(rawPeriods) : NaN;
        if (logRecord.lich_trinh_id && (!Number.isInteger(parsedPeriods) || parsedPeriods < 1 || parsedPeriods > 15)) {
          throw new ServiceError(
            'Vui lòng nhập số tiết xác nhận hợp lệ (số nguyên từ 1 đến 15) khi phê duyệt giải trình thiếu check-out.',
            400,
            'INVALID_CONFIRMED_PERIODS'
          );
        }
        const confirmedPeriods = Number.isInteger(parsedPeriods) && parsedPeriods >= 1 ? parsedPeriods : 1;
        // Giờ ra xác nhận: ước tính từ giờ vào + confirmedPeriods * 50 phút (tiết 50 phút)
        const checkInTime = logRecord.thoi_gian_vao ? new Date(logRecord.thoi_gian_vao) : null;
        let estimatedCheckOut = checkInTime
          ? new Date(checkInTime.getTime() + confirmedPeriods * 50 * 60 * 1000)
          : null;
        if (!logRecord.lich_trinh_id && rawPeriods === null && logRecord.ca_id && checkInTime) {
          const adminShift = await CaLamViec.findByPk(logRecord.ca_id, {
            attributes: ['gio_bat_dau', 'gio_ket_thuc'],
            transaction,
          });
          if (adminShift?.gio_ket_thuc) {
            const [endH, endM] = String(adminShift.gio_ket_thuc).split(':').map(Number);
            const candidateOut = new Date(
              `${String(logRecord.ngay_cong).slice(0, 10)}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00+07:00`
            );
            const isOvernightShift = Boolean(adminShift.gio_bat_dau && adminShift.gio_ket_thuc < adminShift.gio_bat_dau);
            if (!Number.isNaN(candidateOut.getTime()) && isOvernightShift && candidateOut <= checkInTime) {
              candidateOut.setTime(candidateOut.getTime() + 24 * 60 * 60 * 1000);
            }
            if (!Number.isNaN(candidateOut.getTime()) && candidateOut > checkInTime) {
              estimatedCheckOut = candidateOut;
            }
          }
        }
        const durationMinutes = estimatedCheckOut && checkInTime
          ? Math.round((estimatedCheckOut.getTime() - checkInTime.getTime()) / 60000)
          : 0;

        logRecord.trang_thai = Number(logRecord.di_muon_phut || 0) > 0 ? 'late' : 'on_time';
        logRecord.thoi_gian_ra = estimatedCheckOut;
        logRecord.thoi_luong_lam_viec_phut = durationMinutes;
        logRecord.so_tiet_thuc_day = logRecord.lich_trinh_id ? confirmedPeriods : 0;
        logRecord.don_tu_id = request.id;
        logRecord.nguoi_ghi_de_id = currentUserId;
        logRecord.ly_do_ghi_de = `Duyệt đơn giải trình thiếu check-out #${request.id}`;
        await logRecord.save({ transaction });

        // Cập nhật so_tiet_xac_nhan vào đơn nếu có giảng dạy
        if (logRecord.lich_trinh_id || (Number.isInteger(parsedPeriods) && parsedPeriods >= 1)) {
          await DonNghiPhep.update(
            { so_tiet_xac_nhan: confirmedPeriods },
            { where: { id: request.id }, transaction }
          );
        }
      }

      if ((request.loai_don === 'day_bu' || request.loai_don === 'doi_ca') && request.lich_trinh_id) {
        const targetSchedule = await LichTrinh.findByPk(request.lich_trinh_id, {
          include: [{ model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] }],
          transaction,
        });
        if (targetSchedule) {
          await validateLeaveScheduleConflict({
            targetSchedule,
            substituteShiftId: request.ca_thay_the_id,
            substituteLecturerId: request.giang_vien_day_thay_id,
            conflictDateStr: request.ngay_day_bu || getVietnamDateKey(request.ngay_bat_dau),
            applicantId: request.nguoi_dung_id,
          });
        }
      }

      const upsertLeaveException = async (lichTrinhId, ngay, payload) => {
        const [ex, created] = await NgoaiLeLichTrinh.findOrCreate({
          where: { lich_trinh_id: lichTrinhId, ngay },
          defaults: payload,
          transaction,
        });
        if (!created) {
          const existingReason = String(ex.ly_do || '');
          if (!existingReason.includes(`#${request.id}`)) {
            throw new ServiceError(
              `Ngày ${ngay} đã có ngoại lệ lịch trình khác tồn tại (${existingReason || ex.trang_thai}).`,
              409,
              'SCHEDULE_EXCEPTION_CONFLICT'
            );
          }
          await ex.update(payload, { transaction });
        }
      };

      if (request.loai_don === 'day_bu' && request.lich_trinh_id && request.ngay_day_bu) {
        await upsertLeaveException(request.lich_trinh_id, request.ngay_day_bu, {
          ly_do: `Dạy bù theo đơn nghỉ phép #${request.id}`,
          trang_thai: 'day_bu',
          ngay_day_bu: request.ngay_day_bu,
          giang_vien_day_thay_id: request.giang_vien_day_thay_id || null,
          ca_thay_the_id: request.ca_thay_the_id || null,
        });
      }

      if (request.loai_don === 'doi_ca' && request.lich_trinh_id) {
        const shiftDateKey = getVietnamDateKey(request.ngay_bat_dau);
        const hasSubstituteOrShiftSwap = Boolean(request.giang_vien_day_thay_id || request.ca_thay_the_id);
        await upsertLeaveException(request.lich_trinh_id, shiftDateKey, {
          ly_do: `Đổi ca theo đơn #${request.id}`,
          trang_thai: hasSubstituteOrShiftSwap ? 'doi_ca' : 'nghi',
          ngay_day_bu: request.ngay_day_bu || null,
          giang_vien_day_thay_id: request.giang_vien_day_thay_id || null,
          ca_thay_the_id: request.ca_thay_the_id || null,
        });
        if (request.ngay_day_bu && request.ngay_day_bu !== shiftDateKey) {
          await upsertLeaveException(request.lich_trinh_id, request.ngay_day_bu, {
            ly_do: `Lịch dạy thay thế (đổi ca) theo đơn #${request.id}`,
            trang_thai: 'day_bu',
            ngay_day_bu: request.ngay_day_bu,
            giang_vien_day_thay_id: request.giang_vien_day_thay_id || null,
            ca_thay_the_id: request.ca_thay_the_id || null,
          });
        }
      }

      const shouldRetroactiveAttendance = !['day_bu', 'doi_ca', 'giai_trinh_thieu_check_out'].includes(request.loai_don);
      const isHalfDayLeave = Number(request.so_ngay) === 0.5;
      const isExplanationReq = request.loai_don === 'giai_trinh_cong';
      const scheduleWhere = {
        nguoi_dung_id: request.nguoi_dung_id,
        ngay_bat_dau: { [Op.lte]: request.ngay_ket_thuc },
        ngay_ket_thuc: { [Op.gte]: request.ngay_bat_dau },
        ...(request.lich_trinh_id ? { id: request.lich_trinh_id } : {}),
      };
      const schedules = shouldRetroactiveAttendance
        ? await LichTrinh.findAll({
            where: scheduleWhere,
            include: [
              { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
              { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
            ],
            order: [['gio_bat_dau', 'ASC']],
            transaction,
          })
        : [];

      const holidayDates = shouldRetroactiveAttendance
        ? await getHolidayDateSet(request.ngay_bat_dau, request.ngay_ket_thuc, { transaction })
        : new Set();

      const calcShiftDurationMinutes = (startHm, endHm, fallbackMinutes = 480) => {
        if (!startHm || !endHm) return fallbackMinutes;
        const s = timeStringToMinutes(startHm);
        const e = timeStringToMinutes(endHm);
        const diff = e >= s ? e - s : e + 1440 - s;
        return diff > 0 ? diff : fallbackMinutes;
      };

      const handledTeachingDates = new Set();
      const halfDayHandledDates = new Set();

      for (const sch of schedules) {
        const plainSchedule = typeof sch.toJSON === 'function' ? sch.toJSON() : { ...sch };
        plainSchedule.danh_sach_tuan = (plainSchedule.tuan_hoc || []).map((w) => Number(w.tuan_thu));
        const occurrenceStart = new Date(Math.max(new Date(request.ngay_bat_dau).getTime(), new Date(sch.ngay_bat_dau).getTime()));
        const occurrenceEnd = new Date(Math.min(new Date(request.ngay_ket_thuc).getTime(), new Date(sch.ngay_ket_thuc).getTime()));
        const occurrenceDates = getLeaveOccurrenceDates(occurrenceStart, occurrenceEnd, sch.thu_trong_tuan);

        for (const workDateStr of occurrenceDates) {
          if (holidayDates.has(workDateStr)) continue;
          if (!isScheduleActiveOnDate(plainSchedule, workDateStr)) continue;
          handledTeachingDates.add(workDateStr);

          if (isHalfDayLeave && !request.lich_trinh_id && halfDayHandledDates.has(workDateStr)) {
            continue;
          }

          let existing = await NhatKyChamCong.findOne({
            where: { nguoi_dung_id: request.nguoi_dung_id, ngay_cong: workDateStr, lich_trinh_id: sch.id },
            transaction,
          });
          if (!existing) {
            existing = await NhatKyChamCong.findOne({
              where: {
                nguoi_dung_id: request.nguoi_dung_id,
                ngay_cong: workDateStr,
                ds_lich_trinh_id: { [Op.like]: `%${sch.id}%` },
              },
              transaction,
            });
          }

          if (isHalfDayLeave && !isExplanationReq && existing?.thoi_gian_vao) {
            // Đơn nghỉ nửa ngày không xóa công ca mà giảng viên thực tế đã đi dạy
            continue;
          }

          if (isExplanationReq) {
            const shiftPeriods = Number(sch.so_tiet || 3);
            const workDurationMins = calcShiftDurationMinutes(sch.gio_bat_dau, sch.gio_ket_thuc, shiftPeriods * 50);
            if (existing) {
              assertAttendanceLogUnlocked(existing, workDateStr);
              existing.trang_thai = 'on_time';
              existing.di_muon_phut = 0;
              existing.ve_som_phut = 0;
              existing.thoi_luong_lam_viec_phut = Math.max(Number(existing.thoi_luong_lam_viec_phut || 0), workDurationMins);
              existing.so_tiet_thuc_day = shiftPeriods;
              existing.don_tu_id = request.id;
              existing.nguoi_ghi_de_id = currentUserId;
              existing.ly_do_ghi_de = `Duyệt đơn giải trình công #${request.id}`;
              await existing.save({ transaction });
            } else {
              await NhatKyChamCong.create(
                {
                  nguoi_dung_id: request.nguoi_dung_id,
                  ca_id: sch.ca_id,
                  lich_trinh_id: sch.id,
                  ngay_cong: workDateStr,
                  trang_thai: 'on_time',
                  di_muon_phut: 0,
                  ve_som_phut: 0,
                  thoi_luong_lam_viec_phut: workDurationMins,
                  so_tiet_thuc_day: shiftPeriods,
                  don_tu_id: request.id,
                  nguoi_ghi_de_id: currentUserId,
                  ly_do_ghi_de: `Duyệt đơn giải trình công #${request.id}`,
                },
                { transaction }
              );
            }
          } else if (existing) {
            assertAttendanceLogUnlocked(existing, workDateStr);
            const wasAbsent = existing.trang_thai === 'absent' && !existing.thoi_gian_vao;
            existing.trang_thai = 'excused_absence';
            existing.don_tu_id = request.id;
            existing.thoi_gian_vao = null;
            existing.thoi_gian_ra = null;
            existing.thoi_luong_lam_viec_phut = 0;
            existing.di_muon_phut = 0;
            existing.ve_som_phut = 0;
            existing.so_tiet_thuc_day = 0;
            existing.ly_do_ghi_de = wasAbsent
              ? 'Nghỉ phép có đơn được duyệt (Hồi tố từ vắng)'
              : 'Nghỉ phép có đơn được duyệt (Hồi tố)';
            await existing.save({ transaction });
          } else {
            await NhatKyChamCong.create(
              {
                nguoi_dung_id: request.nguoi_dung_id,
                ca_id: sch.ca_id,
                lich_trinh_id: sch.id,
                ngay_cong: workDateStr,
                trang_thai: 'excused_absence',
                don_tu_id: request.id,
                ly_do_ghi_de: 'Nghỉ phép có đơn được duyệt (Tạo mới hồi tố)',
              },
              { transaction }
            );
          }

          if (isHalfDayLeave) {
            halfDayHandledDates.add(workDateStr);
          }
        }
      }

      // Hồi tố ca hành chính cho nhân viên hành chính hoặc ngày không có lịch giảng dạy của cán bộ kiêm nhiệm
      if (shouldRetroactiveAttendance) {
        const applicantRoleOwner = await NguoiDung.findByPk(request.nguoi_dung_id, {
          attributes: ['id', 'vai_tro_chinh'],
          include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['loai_nhan_su'] }],
          transaction,
        });
        const ownerRole = normalizeRole(applicantRoleOwner?.vai_tro_chinh);
        const loaiNhanSu = String(applicantRoleOwner?.ho_so?.loai_nhan_su || '').toLowerCase();
        const isPureLecturer = ownerRole === 'giang_vien' || (loaiNhanSu === 'giang_vien' && !UNIT_LEADER_ROLES.includes(ownerRole));
        const shouldRetroAdminDays = (!isPureLecturer || schedules.length === 0) && !(isExplanationReq && request.lich_trinh_id);

        if (shouldRetroAdminDays) {
          const fallbackShift =
            (request.ca_thay_the_id
              ? await CaLamViec.findByPk(request.ca_thay_the_id, { transaction })
              : null) || (await CaLamViec.findOne({ where: { kich_hoat: true }, transaction }));

          if (fallbackShift) {
            const targetStatus = isExplanationReq ? 'on_time' : 'excused_absence';
            const adminDurationMins = isExplanationReq
              ? calcShiftDurationMinutes(fallbackShift.gio_bat_dau, fallbackShift.gio_ket_thuc, 480)
              : 0;

            const cur = new Date(`${getVietnamDateKey(request.ngay_bat_dau)}T00:00:00Z`);
            const endCur = new Date(`${getVietnamDateKey(request.ngay_ket_thuc)}T00:00:00Z`);
            while (cur <= endCur) {
              const workDateStr = cur.toISOString().slice(0, 10);
              if (cur.getUTCDay() !== 0 && !holidayDates.has(workDateStr) && !handledTeachingDates.has(workDateStr)) {
                const existing = await NhatKyChamCong.findOne({
                  where: {
                    nguoi_dung_id: request.nguoi_dung_id,
                    ngay_cong: workDateStr,
                    ca_id: fallbackShift.id,
                    lich_trinh_id: null,
                  },
                  transaction,
                });
                if (isHalfDayLeave && !isExplanationReq && existing?.thoi_gian_vao) {
                  cur.setUTCDate(cur.getUTCDate() + 1);
                  continue;
                }
                if (existing) {
                  assertAttendanceLogUnlocked(existing, workDateStr);
                  const wasAbsent = existing.trang_thai === 'absent' && !existing.thoi_gian_vao;
                  existing.trang_thai = targetStatus;
                  existing.don_tu_id = request.id;
                  existing.di_muon_phut = 0;
                  existing.ve_som_phut = 0;
                  if (isExplanationReq) {
                    existing.nguoi_ghi_de_id = currentUserId;
                    existing.thoi_luong_lam_viec_phut = Math.max(Number(existing.thoi_luong_lam_viec_phut || 0), adminDurationMins);
                    existing.ly_do_ghi_de = `Duyệt đơn giải trình công #${request.id}`;
                  } else {
                    existing.thoi_gian_vao = null;
                    existing.thoi_gian_ra = null;
                    existing.thoi_luong_lam_viec_phut = 0;
                    existing.so_tiet_thuc_day = 0;
                    existing.ly_do_ghi_de = wasAbsent
                      ? 'Nghỉ phép có đơn được duyệt (Hồi tố từ vắng)'
                      : 'Nghỉ phép có đơn được duyệt (Hồi tố)';
                  }
                  await existing.save({ transaction });
                } else {
                  await NhatKyChamCong.create(
                    {
                      nguoi_dung_id: request.nguoi_dung_id,
                      ca_id: fallbackShift.id,
                      ngay_cong: workDateStr,
                      trang_thai: targetStatus,
                      don_tu_id: request.id,
                      di_muon_phut: 0,
                      ve_som_phut: 0,
                      thoi_luong_lam_viec_phut: adminDurationMins,
                      ...(isExplanationReq ? { nguoi_ghi_de_id: currentUserId } : {}),
                      ly_do_ghi_de: isExplanationReq
                        ? `Duyệt đơn giải trình công #${request.id}`
                        : 'Nghỉ phép có đơn được duyệt (Tạo mới hồi tố)',
                    },
                    { transaction }
                  );
                }
              }
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
          }
        }
      }
    }

    return DonNghiPhep.findByPk(request.id, { include: leaveInclude, transaction });
  });

  await NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUserId,
    loai_chu_the: 'user',
    hanh_dong: isFinalApproval ? 'APPROVE_LEAVE_FINAL' : `APPROVE_LEAVE_LEVEL_${currentLevel}`,
    doi_tuong_id: String(request.id),
    loai_doi_tuong: 'don_nghi_phep',
    dia_chi_ip: dia_chi_ip || null,
  });

  if (isFinalApproval && request.giang_vien_day_thay_id) {
    await NhatKyKiemToan.create({
      nguoi_thuc_hien_id: currentUserId,
      loai_chu_the: 'user',
      hanh_dong: 'ASSIGN_SUBSTITUTE_LECTURER',
      doi_tuong_id: String(request.giang_vien_day_thay_id),
      loai_doi_tuong: 'nguoi_dung',
      dia_chi_ip: dia_chi_ip || null,
      chi_tiet: {
        don_nghi_phep_id: request.id,
        giang_vien_goc_id: request.nguoi_dung_id,
        lich_trinh_id: request.lich_trinh_id,
        ca_thay_the_id: request.ca_thay_the_id,
        ngay_bat_dau: request.ngay_bat_dau,
        ngay_ket_thuc: request.ngay_ket_thuc,
      },
    }).catch(() => {});
  }

  const applicant = await NguoiDung.findByPk(request.nguoi_dung_id, { attributes: ['id', 'email', 'ho_ten'] });
  const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  if (applicant?.email && mailUser && mailPass && isFinalApproval) {
    sendLeaveApprovedEmail({
      to: applicant.email,
      fullName: applicant.ho_ten || 'Thầy/Cô',
      fromDate: request.ngay_bat_dau,
      toDate: request.ngay_ket_thuc,
      approvalNote: cleanNote,
    }).catch((mailError) => {
      console.error('Gửi email duyệt đơn thất bại:', mailError.message);
    });
  }

  const formattedApproved = formatLeaveRequestDoc(updatedRequest);
  try {
    const { emitLeaveRequestUpdate } = require('../../config/socket');
    emitLeaveRequestUpdate({
      ...formattedApproved,
      nguoi_dung_id: request.nguoi_dung_id,
      don_vi_chinh_id: updatedRequest?.nguoi_dung?.don_vi_chinh_id,
      ho_ten_nguoi_tao: updatedRequest?.nguoi_dung?.ho_ten,
    });
  } catch (_) {}

  return formattedApproved;
};

// Từ chối đơn xin phép và lưu lý do vào lịch sử duyệt
const rejectLeaveRequestDomain = async ({ id, ly_do_tu_choi, phien_ban_ky_vong, currentUser, dia_chi_ip }) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }
  if (!ly_do_tu_choi || typeof ly_do_tu_choi !== 'string' || !ly_do_tu_choi.trim()) {
    throw new ServiceError('Lý do từ chối (ly_do_tu_choi) là chuỗi bắt buộc khi từ chối đơn.', 400);
  }

  const request = await DonNghiPhep.findByPk(String(id));
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  assertExpectedVersion(request, phien_ban_ky_vong);

  const currentStatus = request.trang_thai;
  if (!PENDING_LEAVE_STATUSES.includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  const currentUserId = currentUser.id;
  const isBghOrHrActor = hasAnyActiveRole(currentUser, ['admin', 'bgh', 'tccb']);
  const currentLevel = currentStatus === 'pending_bgh' ? 2 : 1;
  const approvalLevelLabel = isBghOrHrActor || currentLevel === 2 ? 'bgh' : 'khoa';
  const cleanRejectReason = ly_do_tu_choi.trim();

  const updatedRequest = await runInTransaction(async (transaction) => {
    const [affectedCount] = await DonNghiPhep.update(
      {
        trang_thai: 'rejected',
        nguoi_duyet_id: currentUserId,
        thoi_gian_duyet: new Date(),
        ly_do_tu_choi: cleanRejectReason,
      },
      { where: { id: request.id, trang_thai: currentStatus }, transaction }
    );

    if (affectedCount !== 1) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được chỉnh sửa hoặc xử lý bởi phiên làm việc khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    await LichSuDuyetDon.create(
      {
        don_nghi_phep_id: request.id,
        nguoi_duyet_id: currentUserId,
        cap_duyet: approvalLevelLabel,
        hanh_dong: 'rejected',
        y_kien: cleanRejectReason,
        thoi_diem: new Date(),
      },
      { transaction }
    );

    return DonNghiPhep.findByPk(request.id, { include: leaveInclude, transaction });
  });

  await NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUserId,
    loai_chu_the: 'user',
    hanh_dong: `REJECT_LEAVE_LEVEL_${approvalLevelLabel === 'bgh' ? 2 : 1}`,
    doi_tuong_id: String(request.id),
    loai_doi_tuong: 'don_nghi_phep',
    dia_chi_ip: dia_chi_ip || null,
  });

  const applicant = await NguoiDung.findByPk(request.nguoi_dung_id, { attributes: ['id', 'email', 'ho_ten'] });
  const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  if (applicant?.email && mailUser && mailPass) {
    sendLeaveRejectedEmail({
      to: applicant.email,
      fullName: applicant.ho_ten || 'Thầy/Cô',
      fromDate: request.ngay_bat_dau,
      toDate: request.ngay_ket_thuc,
      rejectionReason: cleanRejectReason,
    }).catch((mailError) => {
      console.error('Gửi email từ chối đơn thất bại:', mailError.message);
    });
  }

  const formattedApproved = formatLeaveRequestDoc(updatedRequest);
  try {
    const { emitLeaveRequestUpdate } = require('../../config/socket');
    emitLeaveRequestUpdate({
      ...formattedApproved,
      nguoi_dung_id: request.nguoi_dung_id,
      don_vi_chinh_id: updatedRequest?.nguoi_dung?.don_vi_chinh_id,
      ho_ten_nguoi_tao: updatedRequest?.nguoi_dung?.ho_ten,
    });
  } catch (_) {}

  return formattedApproved;
};

// Hủy đơn xin phép (hoàn tác công hoặc ngoại lệ lịch nếu đơn đã duyệt trước đó)
const cancelLeaveRequestDomain = async ({ id, phien_ban_ky_vong, currentUser, dia_chi_ip }) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await DonNghiPhep.findByPk(String(id));
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  assertExpectedVersion(request, phien_ban_ky_vong);

  const currentUserId = String(currentUser.id);
  const applicantId = String(request.nguoi_dung_id);
  const isApplicant = applicantId === currentUserId;
  const isAdmin = hasAnyActiveRole(currentUser, ['admin', 'bgh']);

  if (!isApplicant && !isAdmin) {
    throw new ServiceError('Bạn chỉ có quyền hủy đơn của chính mình.', 403, 'CANCEL_UNAUTHORIZED');
  }

  const currentStatus = request.trang_thai;
  if (['cancelled', 'rejected'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã ở trạng thái ${currentStatus}, không thể hủy.`, 400);
  }

  if (currentStatus === 'approved') {
    const todayKey = getVietnamDateKey(new Date());
    const leaveStartKey = getVietnamDateKey(request.ngay_bat_dau);

    if (leaveStartKey <= todayKey && !isAdmin) {
      throw new ServiceError(
        'Không thể tự hủy đơn đã phê duyệt khi đã đến hoặc qua ngày nghỉ. Vui lòng liên hệ Admin.',
        400,
        'CANNOT_CANCEL_PAST_APPROVED_LEAVE'
      );
    }
  }

  const updatedRequest = await runInTransaction(async (transaction) => {
    const [affectedCount] = await DonNghiPhep.update(
      {
        trang_thai: 'cancelled',
        ...(request.loai_don === 'giai_trinh_thieu_check_out' ? { so_tiet_xac_nhan: null } : {}),
      },
      { where: { id: request.id, trang_thai: currentStatus }, transaction }
    );

    if (affectedCount !== 1) {
      throw new ServiceError(
        'Xung đột phiên bản: Đơn từ đã được xử lý bởi phiên khác.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }

    const affectedLogs = await NhatKyChamCong.findAll({
      where: { don_tu_id: request.id },
      transaction,
    });

    for (const log of affectedLogs) {
      assertAttendanceLogUnlocked(log, log.ngay_cong);

      if (request.loai_don === 'giai_trinh_thieu_check_out') {
        log.trang_thai = 'thieu_check_out';
        log.thoi_gian_ra = null;
        log.so_tiet_thuc_day = 0;
        log.thoi_luong_lam_viec_phut = 0;
        log.don_tu_id = null;
        log.ly_do_ghi_de = 'Đơn giải trình thiếu check-out đã bị hủy (Hoàn tác công)';
        await log.save({ transaction });
        continue;
      }

      const punches = await LuotQuetChamCong.findAll({
        where: { cham_cong_id: log.id },
        order: [['thoi_gian_quet', 'ASC']],
        transaction,
      });

      if (punches.length === 0) {
        const isCreatedSolelyByApproval =
          (log.ly_do_ghi_de === 'Nghỉ phép có đơn được duyệt (Tạo mới hồi tố)' ||
            (request.loai_don === 'giai_trinh_cong' &&
              String(log.ly_do_ghi_de || '').startsWith(`Duyệt đơn giải trình công #${request.id}`))) &&
          !log.thoi_gian_vao &&
          !log.thoi_gian_ra &&
          (request.loai_don === 'giai_trinh_cong' || !log.nguoi_ghi_de_id);
        if (isCreatedSolelyByApproval) {
          await log.destroy({ transaction });
        } else {
          log.trang_thai = 'absent';
          log.don_tu_id = null;
          log.nguoi_ghi_de_id = null;
          log.so_tiet_thuc_day = 0;
          log.thoi_luong_lam_viec_phut = 0;
          log.di_muon_phut = 0;
          log.ve_som_phut = 0;
          log.ly_do_ghi_de =
            request.loai_don === 'giai_trinh_cong'
              ? 'Đơn giải trình công đã bị hủy (Khôi phục trạng thái vắng)'
              : 'Đơn nghỉ phép đã bị hủy (Khôi phục trạng thái vắng)';
          await log.save({ transaction });
        }
      } else {
        const firstInPunch = punches.find((p) => p.loai_quet === 'check_in');
        const lastOutPunch = [...punches].reverse().find((p) => p.loai_quet === 'check_out');
        const restoredIn = log.thoi_gian_vao || firstInPunch?.thoi_gian_quet || null;
        const restoredOut = log.thoi_gian_ra || lastOutPunch?.thoi_gian_quet || null;

        log.thoi_gian_vao = restoredIn;
        log.thoi_gian_ra = restoredOut;

        const khoi = log.lich_trinh_id
          ? await layKhoiTheoLichTrinh(log.nguoi_dung_id, log.lich_trinh_id, log.ngay_cong).catch(() => null)
          : null;
        const shift = log.ca_id ? await CaLamViec.findByPk(log.ca_id, { transaction }) : null;
        const timeCfg = khoi
          ? { gio_bat_dau: khoi.gio_bat_dau, gio_ket_thuc: khoi.gio_ket_thuc }
          : shift
          ? { gio_bat_dau: shift.gio_bat_dau, gio_ket_thuc: shift.gio_ket_thuc }
          : null;

        let recalculatedLateMins = Number(log.di_muon_phut || 0);
        if (restoredIn && timeCfg?.gio_bat_dau) {
          const vnIn = getVietnamTime(restoredIn);
          const inMins = vnIn.getHours() * 60 + vnIn.getMinutes();
          recalculatedLateMins = Math.max(0, inMins - timeStringToMinutes(timeCfg.gio_bat_dau));
        }
        log.di_muon_phut = recalculatedLateMins;
        const baseStatus = recalculatedLateMins > 0 ? 'late' : 'on_time';

        if (restoredIn && restoredOut) {
          const workingMins = Math.max(0, Math.round((new Date(restoredOut).getTime() - new Date(restoredIn).getTime()) / 60000));
          log.thoi_luong_lam_viec_phut = workingMins;
          const outStatus = timeCfg
            ? calculateCheckOutStatus(restoredOut, timeCfg, baseStatus)
            : { finalStatus: baseStatus, earlyMinutes: 0 };
          log.trang_thai = outStatus.finalStatus;
          log.ve_som_phut = outStatus.earlyMinutes || 0;
          if (log.lich_trinh_id || (Array.isArray(log.ds_lich_trinh_id) && log.ds_lich_trinh_id.length > 0)) {
            log.so_tiet_thuc_day = await calculateActualTeachingPeriods(
              {
                lichTrinhId: log.lich_trinh_id,
                lichTrinhIds: log.ds_lich_trinh_id,
                workingMinutes: workingMins,
                earlyMinutes: log.ve_som_phut,
                lateMinutes: recalculatedLateMins,
              },
              LichTrinh
            );
          }
        } else {
          log.trang_thai = restoredIn ? 'thieu_check_out' : baseStatus;
          log.thoi_luong_lam_viec_phut = 0;
          log.so_tiet_thuc_day = 0;
          log.ve_som_phut = 0;
        }
        log.don_tu_id = null;
        log.nguoi_ghi_de_id = null;
        log.ly_do_ghi_de = 'Phục hồi tính công từ lượt quẹt thực tế sau khi hủy đơn';
        await log.save({ transaction });
      }
    }

    if (request.loai_don === 'day_bu' && request.lich_trinh_id && request.ngay_day_bu) {
      await NgoaiLeLichTrinh.destroy({
        where: {
          lich_trinh_id: request.lich_trinh_id,
          ngay: request.ngay_day_bu,
          trang_thai: 'day_bu',
          ly_do: { [Op.like]: `%#${request.id}%` },
        },
        transaction,
      });
    }

    if (request.loai_don === 'doi_ca' && request.lich_trinh_id) {
      const shiftDateKey = getVietnamDateKey(request.ngay_bat_dau);
      await NgoaiLeLichTrinh.destroy({
        where: {
          lich_trinh_id: request.lich_trinh_id,
          ngay: shiftDateKey,
          trang_thai: { [Op.in]: ['nghi', 'doi_ca'] },
          ly_do: { [Op.like]: `%#${request.id}%` },
        },
        transaction,
      });
      if (request.ngay_day_bu) {
        await NgoaiLeLichTrinh.destroy({
          where: {
            lich_trinh_id: request.lich_trinh_id,
            ngay: request.ngay_day_bu,
            trang_thai: 'day_bu',
            ly_do: { [Op.like]: `%#${request.id}%` },
          },
          transaction,
        });
      }
    }

    return DonNghiPhep.findByPk(request.id, { include: leaveInclude, transaction });
  });

  await NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUserId,
    loai_chu_the: 'user',
    hanh_dong: 'CANCEL_LEAVE_AND_ROLLBACK',
    doi_tuong_id: String(request.id),
    loai_doi_tuong: 'don_nghi_phep',
    dia_chi_ip: dia_chi_ip || null,
  });

  const formattedApproved = formatLeaveRequestDoc(updatedRequest);
  try {
    const { emitLeaveRequestUpdate } = require('../../config/socket');
    emitLeaveRequestUpdate({
      ...formattedApproved,
      nguoi_dung_id: request.nguoi_dung_id,
      don_vi_chinh_id: updatedRequest?.nguoi_dung?.don_vi_chinh_id,
      ho_ten_nguoi_tao: updatedRequest?.nguoi_dung?.ho_ten,
    });
  } catch (_) {}

  return formattedApproved;
};

module.exports = {
  assertExpectedVersion,
  validateLeaveApprovalPermission,
  approveLeaveRequestDomain,
  rejectLeaveRequestDomain,
  cancelLeaveRequestDomain,
};
