/**
 * Dịch vụ Phê duyệt, Từ chối & Hủy đơn nghỉ phép (server/services/donNghiPhep/pheDuyetDon.service.js)
 * Bao gồm: Chặn tự duyệt đơn, Khóa lạc quan, Duyệt đa cấp (Khoa -> BGH) và Hồi tố/Hoàn tác công.
 */
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
const { normalizeRole, UNIT_LEADER_ROLES } = require('../../utils/vaiTro.utils');
const { getEffectivePermissions, PERMISSIONS } = require('../../config/permissions');
const { calculateCheckOutStatus } = require('../../utils/thoiGianChamCong.utils');
const { sendLeaveApprovedEmail, sendLeaveRejectedEmail } = require('../heThong/guiEmail.service');
const {
  ServiceError,
  getVietnamDateKey,
  getLeaveOccurrenceDates,
  calculateLeaveDays,
  getHolidayDateSet,
  getLeaveStatsByYear,
  formatLeaveRequestDoc,
  leaveInclude,
} = require('./tinhPhepNam.helper');

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

  const role = normalizeRole(currentUser.vai_tro_chinh || currentUser.role);
  const status = leaveRequest.trang_thai;
  const currentLevel = status === 'pending_bgh' ? 2 : 1;

  if (['admin', 'bgh', 'tccb'].includes(role)) {
    if (role === 'tccb') {
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

  if (UNIT_LEADER_ROLES.includes(role)) {
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
    const hasDelegation =
      Boolean(currentUser.isAuthorized || currentUser.duoc_uy_quyen) ||
      effectivePerms.has(PERMISSIONS.DON_TU_DUYET_CAP_1);
    if (['pho_khoa', 'pho_bo_mon', 'pho_phong'].includes(role) && !hasDelegation) {
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

const assertExpectedVersion = (request, phien_ban_ky_vong) => {
  if (phien_ban_ky_vong !== undefined && phien_ban_ky_vong !== null && request.cap_nhat_luc) {
    const expectedMs = Number(phien_ban_ky_vong);
    const actualMs = new Date(request.cap_nhat_luc).getTime();
    if (Number.isFinite(expectedMs) && expectedMs > 1e12 && expectedMs !== actualMs) {
      throw new ServiceError(
        'Xung đột phiên bản (Optimistic Locking): Đơn từ đã được cập nhật bởi phiên khác. Vui lòng tải lại trang.',
        409,
        'OPTIMISTIC_LOCK_CONFLICT'
      );
    }
  }
};

const assertAttendanceLogUnlocked = (existingLog, dateLabel) => {
  if (existingLog && existingLog.da_chot) {
    throw new ServiceError(
      `Không thể cập nhật dữ liệu chấm công ngày ${dateLabel || existingLog.ngay_cong} vì kỳ công đã bị khóa sổ.`,
      409,
      'ATTENDANCE_LOCKED'
    );
  }
};

const approveLeaveRequestDomain = async ({ id, ghi_chu_duyet, phien_ban_ky_vong, currentUser, dia_chi_ip }) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã đơn (id) không hợp lệ.', 400);
  }

  const request = await DonNghiPhep.findByPk(String(id));
  if (!request) {
    throw new ServiceError('Không tìm thấy đơn xin.', 404);
  }

  assertExpectedVersion(request, phien_ban_ky_vong);

  const currentStatus = request.trang_thai;
  if (!['pending', 'pending_dean', 'pending_bgh'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  if (request.loai_don === 'nghi_phep') {
    const targetYear = new Date(request.ngay_bat_dau).getFullYear();
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    const targetYearLeavesStart = new Date(Math.max(new Date(request.ngay_bat_dau).getTime(), yearStart.getTime()));
    const targetYearLeavesEnd = new Date(Math.min(new Date(request.ngay_ket_thuc).getTime(), yearEnd.getTime()));
    const isHalfDay = Number(request.so_ngay) === 0.5;
    const holidaySet = await getHolidayDateSet(targetYearLeavesStart, targetYearLeavesEnd);
    const requestedDays = isHalfDay
      ? 0.5
      : calculateLeaveDays(targetYearLeavesStart, targetYearLeavesEnd, false, holidaySet);

    const applicantUser = await NguoiDung.findByPk(request.nguoi_dung_id, {
      include: [{ model: HoSoCanBo, as: 'ho_so', attributes: ['han_muc_phep_nam'] }],
    });
    const quota = applicantUser?.ho_so?.han_muc_phep_nam !== undefined ? Number(applicantUser.ho_so.han_muc_phep_nam) : 12;

    const { daysUsed } = await getLeaveStatsByYear(request.nguoi_dung_id, targetYear);
    const remainingDays = Math.max(0, quota - daysUsed);
    if (requestedDays > remainingDays) {
      throw new ServiceError(
        `Không thể phê duyệt đơn: Cán bộ/giảng viên chỉ còn ${remainingDays} ngày phép khả dụng, đơn này xin nghỉ ${requestedDays} ngày trong năm ${targetYear}.`,
        400,
        'INSUFFICIENT_LEAVE_DAYS'
      );
    }
  }

  const cleanNote = typeof ghi_chu_duyet === 'string' ? ghi_chu_duyet.trim() : '';
  const currentUserId = currentUser.id;
  const currentLevel = currentStatus === 'pending_bgh' ? 2 : 1;
  const requiredLevels = Number(request.so_ngay || 1) > 3 ? 2 : 1;
  const approverRole = normalizeRole(currentUser.vai_tro_chinh);
  const isFinalApproval = ['admin', 'bgh', 'tccb'].includes(approverRole) || currentLevel >= requiredLevels;
  const nextStatus = isFinalApproval ? 'approved' : 'pending_bgh';

  const updatedRequest = await runInTransaction(async (transaction) => {
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
        cap_duyet: currentLevel === 2 ? 'bgh' : 'khoa',
        hanh_dong: 'approved',
        y_kien: cleanNote || null,
        thoi_diem: new Date(),
      },
      { transaction }
    );

    if (isFinalApproval) {
      if (request.loai_don === 'day_bu' && request.lich_trinh_id && request.ngay_day_bu) {
        await NgoaiLeLichTrinh.findOrCreate({
          where: { lich_trinh_id: request.lich_trinh_id, ngay: request.ngay_day_bu },
          defaults: {
            ly_do: `Dạy bù theo đơn nghỉ phép #${request.id}`,
            trang_thai: 'day_bu',
            ngay_day_bu: request.ngay_day_bu,
          },
          transaction,
        });
      }

      if (request.loai_don === 'doi_ca' && request.lich_trinh_id) {
        const shiftDateKey = getVietnamDateKey(request.ngay_bat_dau);
        await NgoaiLeLichTrinh.findOrCreate({
          where: { lich_trinh_id: request.lich_trinh_id, ngay: shiftDateKey },
          defaults: {
            ly_do: `Đổi ca theo đơn #${request.id}`,
            trang_thai: 'nghi',
            ngay_day_bu: request.ngay_day_bu || null,
          },
          transaction,
        });
        if (request.ngay_day_bu) {
          await NgoaiLeLichTrinh.findOrCreate({
            where: { lich_trinh_id: request.lich_trinh_id, ngay: request.ngay_day_bu },
            defaults: {
              ly_do: `Lịch dạy thay thế (đổi ca) theo đơn #${request.id}`,
              trang_thai: 'day_bu',
              ngay_day_bu: request.ngay_day_bu,
            },
            transaction,
          });
        }
      }

      const shouldRetroactiveAttendance = !['day_bu', 'doi_ca'].includes(request.loai_don);
      const schedules = shouldRetroactiveAttendance
        ? await LichTrinh.findAll({
            where: {
              nguoi_dung_id: request.nguoi_dung_id,
              ngay_bat_dau: { [Op.lte]: request.ngay_ket_thuc },
              ngay_ket_thuc: { [Op.gte]: request.ngay_bat_dau },
            },
            include: [
              { model: LichTrinhTuan, as: 'tuan_hoc', attributes: ['tuan_thu'] },
              { model: NgoaiLeLichTrinh, as: 'ngoai_le' },
            ],
            transaction,
          })
        : [];

      const holidayDates = shouldRetroactiveAttendance
        ? await getHolidayDateSet(request.ngay_bat_dau, request.ngay_ket_thuc, { transaction })
        : new Set();

      // Fallback cho nhân viên hành chính / cán bộ không có LichTrinh khi duyệt giải trình công hoặc nghỉ phép
      if (shouldRetroactiveAttendance && schedules.length === 0) {
        const fallbackShift =
          (request.ca_thay_the_id
            ? await CaLamViec.findByPk(request.ca_thay_the_id, { transaction })
            : null) || (await CaLamViec.findOne({ where: { kich_hoat: true }, transaction }));

        if (fallbackShift) {
          const isExplanation = request.loai_don === 'giai_trinh_cong';
          const targetStatus = isExplanation ? 'on_time' : 'excused_absence';
          const targetReason = isExplanation
            ? `Duyệt đơn giải trình công #${request.id}`
            : 'Nghỉ phép có đơn được duyệt (Hồi tố)';

          const cur = new Date(`${getVietnamDateKey(request.ngay_bat_dau)}T00:00:00Z`);
          const endCur = new Date(`${getVietnamDateKey(request.ngay_ket_thuc)}T00:00:00Z`);
          while (cur <= endCur) {
            const workDateStr = cur.toISOString().slice(0, 10);
            if (cur.getUTCDay() !== 0 && !holidayDates.has(workDateStr)) {
              const existing = await NhatKyChamCong.findOne({
                where: { nguoi_dung_id: request.nguoi_dung_id, ngay_cong: workDateStr, ca_id: fallbackShift.id },
                transaction,
              });
              if (existing) {
                assertAttendanceLogUnlocked(existing, workDateStr);
                existing.trang_thai = targetStatus;
                existing.don_tu_id = request.id;
                if (isExplanation) {
                  existing.nguoi_ghi_de_id = currentUserId;
                } else {
                  existing.thoi_gian_vao = null;
                  existing.thoi_gian_ra = null;
                }
                existing.ly_do_ghi_de = targetReason;
                await existing.save({ transaction });
              } else {
                await NhatKyChamCong.create(
                  {
                    nguoi_dung_id: request.nguoi_dung_id,
                    ca_id: fallbackShift.id,
                    ngay_cong: workDateStr,
                    trang_thai: targetStatus,
                    don_tu_id: request.id,
                    ...(isExplanation ? { nguoi_ghi_de_id: currentUserId } : {}),
                    ly_do_ghi_de: targetReason,
                  },
                  { transaction }
                );
              }
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
      }

      for (const sch of schedules) {
        const plainSchedule = typeof sch.toJSON === 'function' ? sch.toJSON() : { ...sch };
        plainSchedule.danh_sach_tuan = (plainSchedule.tuan_hoc || []).map((w) => Number(w.tuan_thu));
        const occurrenceStart = new Date(Math.max(new Date(request.ngay_bat_dau).getTime(), new Date(sch.ngay_bat_dau).getTime()));
        const occurrenceEnd = new Date(Math.min(new Date(request.ngay_ket_thuc).getTime(), new Date(sch.ngay_ket_thuc).getTime()));
        const occurrenceDates = getLeaveOccurrenceDates(occurrenceStart, occurrenceEnd, sch.thu_trong_tuan);

        for (const workDateStr of occurrenceDates) {
          if (holidayDates.has(workDateStr)) continue;
          if (!isScheduleActiveOnDate(plainSchedule, workDateStr)) continue;
          const existing = await NhatKyChamCong.findOne({
            where: { nguoi_dung_id: request.nguoi_dung_id, ngay_cong: workDateStr, ca_id: sch.ca_id },
            transaction,
          });

          if (request.loai_don === 'giai_trinh_cong') {
            const shiftPeriods = Number(sch.so_tiet || 3);
            if (existing) {
              assertAttendanceLogUnlocked(existing, workDateStr);
              existing.trang_thai = 'on_time';
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
            existing.trang_thai = 'excused_absence';
            existing.don_tu_id = request.id;
            existing.thoi_gian_vao = null;
            existing.thoi_gian_ra = null;
            existing.ly_do_ghi_de = 'Nghỉ phép có đơn được duyệt (Hồi tố)';
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
                ly_do_ghi_de: 'Nghỉ phép có đơn được duyệt (Hồi tố)',
              },
              { transaction }
            );
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
        leaveRequestId: request.id,
        originalLecturerId: request.nguoi_dung_id,
        scheduleId: request.lich_trinh_id,
        substituteShiftId: request.ca_thay_the_id,
        fromDate: request.ngay_bat_dau,
        toDate: request.ngay_ket_thuc,
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

  return formatLeaveRequestDoc(updatedRequest);
};

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
  if (!['pending', 'pending_dean', 'pending_bgh'].includes(currentStatus)) {
    throw new ServiceError(`Đơn đã được xử lý với trạng thái ${currentStatus}.`, 400, 'LEAVE_ALREADY_PROCESSED');
  }

  const permCheck = await validateLeaveApprovalPermission(currentUser, request);
  if (!permCheck.allowed) {
    throw new ServiceError(permCheck.message, permCheck.status || 403, permCheck.errorCode || null);
  }

  const currentUserId = currentUser.id;
  const currentLevel = currentStatus === 'pending_bgh' ? 2 : 1;
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
        cap_duyet: currentLevel === 2 ? 'bgh' : 'khoa',
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
    hanh_dong: `REJECT_LEAVE_LEVEL_${currentLevel}`,
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

  return formatLeaveRequestDoc(updatedRequest);
};

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
  const role = normalizeRole(currentUser.vai_tro_chinh);
  const isAdmin = ['admin', 'bgh'].includes(role);

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
      { trang_thai: 'cancelled' },
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
      const punches = await LuotQuetChamCong.findAll({
        where: { cham_cong_id: log.id },
        transaction,
      });

      if (punches.length === 0) {
        if (!log.thoi_gian_vao && !log.thoi_gian_ra && !log.nguoi_ghi_de_id) {
          await log.destroy({ transaction });
        } else {
          log.trang_thai = 'absent';
          log.don_tu_id = null;
          log.ly_do_ghi_de = 'Đơn nghỉ phép đã bị hủy (Hoàn tác công)';
          await log.save({ transaction });
        }
      } else {
        const baseStatus = (log.di_muon_phut || 0) > 0 ? 'late' : 'on_time';
        if (log.thoi_gian_ra && log.ca_id) {
          const shift = await CaLamViec.findByPk(log.ca_id, { transaction });
          log.trang_thai = shift
            ? calculateCheckOutStatus(log.thoi_gian_ra, shift, baseStatus).finalStatus
            : baseStatus;
        } else {
          log.trang_thai = (log.ve_som_phut || 0) > 0 && baseStatus === 'on_time' ? 'early_leave' : baseStatus;
        }
        log.don_tu_id = null;
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
          trang_thai: 'nghi',
        },
        transaction,
      });
      if (request.ngay_day_bu) {
        await NgoaiLeLichTrinh.destroy({
          where: {
            lich_trinh_id: request.lich_trinh_id,
            ngay: request.ngay_day_bu,
            trang_thai: 'day_bu',
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

  return formatLeaveRequestDoc(updatedRequest);
};

module.exports = {
  validateLeaveApprovalPermission,
  approveLeaveRequestDomain,
  rejectLeaveRequestDomain,
  cancelLeaveRequestDomain,
};
