// Khởi tạo bảng lương tháng hàng loạt, khóa/mở sổ lương và điều phối xuất phiếu lương Excel/PDF
const { Op } = require('sequelize');
const {
  PhieuLuong,
  PhuCapLuong,
  GiamTruLuong,
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  NhatKyChamCong,
  NhatKyKiemToan,
} = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { withDistributedLock } = require('../../utils/khoaPhanTan');
const { hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const tinhThueVaLuongHelper = require('./tinhThueVaLuong.helper');
const xuatPhieuLuongService = require('./xuatPhieuLuong.service');

const {
  ServiceError,
  isSystemAdminUser,
  validatePayrollScopeParams,
  resolveDepartmentUserIdsFilter,
  getPayrollConfigParams,
  calculateUserPayroll,
  payrollInclude,
  formatPayrollDoc,
} = tinhThueVaLuongHelper;

// Tính và tạo bảng lương tháng hàng loạt cho nhân sự thuộc phạm vi quản lý
const generateMonthlyPayroll = async ({ thang, nam, don_vi_id, currentUser }) => {
  const currentUserId = currentUser.id;
  if (!hasAnyActiveRole(currentUser, ['admin', 'ke_toan'])) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Phòng Kế toán mới có quyền khởi tạo bảng lương.', 403);
  }

  const { month: m, year: y, departmentId } = validatePayrollScopeParams({ thang, nam, don_vi_id });

  const lockKey = departmentId ? `PAYROLL_GEN_${y}_${m}_${departmentId}` : `PAYROLL_GEN_${y}_${m}`;
  try {
    return await withDistributedLock(
      lockKey,
      120,
      async () => {
        const userWhere = {
          kich_hoat: true,
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
          vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
        };
        if (departmentId) {
          const deptUserIds = await resolveDepartmentUserIdsFilter(departmentId);
          userWhere.id = { [Op.in]: deptUserIds.length ? deptUserIds : ['00000000-0000-0000-0000-000000000000'] };
        }

        const lockedCount = await PhieuLuong.count({
          where: {
            thang: m,
            nam: y,
            trang_thai: { [Op.in]: ['da_duyet', 'da_chi_tra'] },
          },
          include: [{ model: NguoiDung, as: 'nguoi_dung', where: userWhere, required: true }],
        });

        if (lockedCount > 0) {
          throw new ServiceError(
            `Bảng lương tháng ${m}/${y} trong phạm vi được chọn đã được khóa sổ, không thể tính toán lại. Vui lòng mở khóa nếu cần điều chỉnh.`,
            403,
            'PAYROLL_LOCKED'
          );
        }

        const rawUsers = await NguoiDung.findAll({
          where: userWhere,
          include: [
            { model: HoSoCanBo, as: 'ho_so' },
            { model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['ma_vai_tro'] },
          ],
        });
        const users = rawUsers.filter((u) => !isSystemAdminUser(u));
        if (users.length === 0) {
          throw new ServiceError('Không tìm thấy cán bộ, giảng viên nào đang công tác trong phạm vi được chọn.', 404);
        }

        const configParams = await getPayrollConfigParams();
        const createdIds = [];

        await runInTransaction(async (transaction) => {
          for (const user of users) {
            const { payrollFields, allowances, deductions } = await calculateUserPayroll({
              user,
              month: m,
              year: y,
              configParams,
              createdBy: currentUserId,
            });

            let payroll = await PhieuLuong.findOne({
              where: { nguoi_dung_id: user.id, thang: m, nam: y },
              transaction,
            });

            if (payroll) {
              await payroll.update(payrollFields, { transaction });
              await PhuCapLuong.destroy({ where: { phieu_luong_id: payroll.id }, transaction });
              await GiamTruLuong.destroy({ where: { phieu_luong_id: payroll.id }, transaction });
            } else {
              payroll = await PhieuLuong.create(payrollFields, { transaction });
            }

            if (allowances.length > 0) {
              await PhuCapLuong.bulkCreate(
                allowances.map((a) => ({ ...a, phieu_luong_id: payroll.id })),
                { transaction }
              );
            }
            if (deductions.length > 0) {
              await GiamTruLuong.bulkCreate(
                deductions.map((d) => ({ ...d, phieu_luong_id: payroll.id })),
                { transaction }
              );
            }

            createdIds.push(payroll.id);
          }
        });

        const createdPayrolls = await PhieuLuong.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: payrollInclude,
        });

        await NhatKyKiemToan.create({
          nguoi_thuc_hien_id: currentUserId,
          loai_chu_the: 'user',
          hanh_dong: 'GENERATE_PAYROLL',
          doi_tuong_id: `${y}-${m}`,
          loai_doi_tuong: 'phieu_luong',
          chi_tiet: {
            don_vi_id: departmentId,
            tong_so_phieu: createdPayrolls.length,
            thong_bao: `Tạo bảng lương tháng ${m}/${y} cho ${createdPayrolls.length} nhân sự.`,
          },
        });

        return {
          thang: m,
          nam: y,
          tong_da_tinh: createdPayrolls.length,
          phieu_luong: createdPayrolls.map((doc) => formatPayrollDoc(doc, configParams)),
        };
      },
      { throwOnBusy: true, logPrefix: '[PayrollGen]' }
    );
  } catch (err) {
    if (err?.code === 'DISTRIBUTED_LOCK_BUSY') {
      throw new ServiceError(
        'Hệ thống đang khởi tạo bảng lương cho kỳ này, vui lòng thử lại sau ít giây.',
        409,
        'PAYROLL_GENERATION_IN_PROGRESS'
      );
    }
    throw err;
  }
};

// Khóa sổ bảng lương tháng (hoặc một phiếu lương cụ thể) và chốt công liên quan
const lockMonthlyPayroll = async ({ month, year, departmentId = null, payrollId = null, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  if (!hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    throw new ServiceError('Chỉ Quản trị viên, Ban Giám Hiệu hoặc Kế toán mới có quyền khóa bảng lương.', 403);
  }

  let m;
  let y;
  let scopedDeptId = departmentId || null;
  let targetPayroll = null;

  if (payrollId) {
    if (!isValidUuid(String(payrollId))) {
      throw new ServiceError('Mã phiếu lương (id) không hợp lệ.', 400);
    }
    targetPayroll = await PhieuLuong.findByPk(String(payrollId));
    if (!targetPayroll) {
      throw new ServiceError('Không tìm thấy phiếu lương để khóa.', 404);
    }
    if (targetPayroll.trang_thai === 'da_chi_tra') {
      throw new ServiceError(
        'Phiếu lương này đang ở trạng thái đã chi trả (da_chi_tra), không thể khóa lại.',
        403,
        'PAYROLL_ALREADY_PAID'
      );
    }
    m = Number(targetPayroll.thang);
    y = Number(targetPayroll.nam);
    scopedDeptId = null;
  } else {
    const validated = validatePayrollScopeParams({ thang: month, nam: year, don_vi_id: departmentId });
    m = validated.month;
    y = validated.year;
    scopedDeptId = validated.departmentId;
  }

  const scopedUserIds = targetPayroll
    ? [targetPayroll.nguoi_dung_id]
    : await resolveDepartmentUserIdsFilter(scopedDeptId);
  const userFilter = scopedUserIds
    ? { nguoi_dung_id: { [Op.in]: scopedUserIds.length ? scopedUserIds : ['00000000-0000-0000-0000-000000000000'] } }
    : {};
  const payrollWhere = targetPayroll
    ? { id: targetPayroll.id, trang_thai: { [Op.ne]: 'da_chi_tra' } }
    : { thang: m, nam: y, trang_thai: { [Op.ne]: 'da_chi_tra' }, ...userFilter };

  const existingCount = targetPayroll
    ? 1
    : await PhieuLuong.count({ where: { thang: m, nam: y, ...userFilter } });
  if (existingCount === 0) {
    throw new ServiceError(`Không tìm thấy bảng lương tháng ${m}/${y} để khóa.`, 404);
  }

  const lockableCount = await PhieuLuong.count({ where: payrollWhere });
  if (lockableCount === 0) {
    throw new ServiceError(
      `Toàn bộ phiếu lương tháng ${m}/${y} trong phạm vi đã ở trạng thái đã chi trả (da_chi_tra).`,
      403,
      'PAYROLL_ALREADY_PAID'
    );
  }

  const lockTime = new Date();
  const monthStr = String(m).padStart(2, '0');
  const startDateStr = `${y}-${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const { lockedPayrollsCount, lockedAttendanceLogsCount } = await runInTransaction(async (transaction) => {
    const [pCount] = await PhieuLuong.update(
      {
        trang_thai: 'da_duyet',
        thoi_gian_duyet: lockTime,
        nguoi_duyet_id: currentUserId,
      },
      { where: payrollWhere, transaction }
    );

    const [aCount] = await NhatKyChamCong.update(
      { da_chot: true },
      { where: { ngay_cong: { [Op.between]: [startDateStr, endDateStr] }, ...userFilter }, transaction }
    );

    return { lockedPayrollsCount: pCount, lockedAttendanceLogsCount: aCount };
  });

  await NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUserId,
    loai_chu_the: 'user',
    hanh_dong: 'LOCK_PAYROLL',
    doi_tuong_id: targetPayroll ? String(targetPayroll.id) : `${y}-${m}`,
    loai_doi_tuong: 'phieu_luong',
    chi_tiet: {
      phieu_luong_id: targetPayroll ? targetPayroll.id : null,
      don_vi_id: scopedDeptId,
      thong_bao: `Khóa sổ bảng lương tháng ${m}/${y} (${lockedPayrollsCount} phiếu lương) và chốt công (${lockedAttendanceLogsCount} ngày công).`,
    },
    dia_chi_ip: ip || null,
  });

  return {
    thang: m,
    nam: y,
    da_khoa: true,
    thoi_gian_khoa: lockTime,
    so_phieu_da_khoa: lockedPayrollsCount,
    so_cong_da_chot: lockedAttendanceLogsCount,
    thong_bao: `Đã khóa sổ thành công bảng lương tháng ${m}/${y}.`,
  };
};

// Mở khóa bảng lương tháng (hoặc một phiếu lương cụ thể) có kiểm tra điều kiện và ghi nhận kiểm toán
const unlockMonthlyPayroll = async ({ month, year, departmentId = null, payrollId = null, reason, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  if (!hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    throw new ServiceError('Chỉ Quản trị viên, Ban Giám Hiệu hoặc Kế toán mới có quyền mở khóa bảng lương.', 403);
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new ServiceError('Lý do mở khóa bảng lương là bắt buộc (tối thiểu 5 ký tự).', 400);
  }

  let m;
  let y;
  let scopedDeptId = departmentId || null;
  let targetPayroll = null;

  if (payrollId) {
    if (!isValidUuid(String(payrollId))) {
      throw new ServiceError('Mã phiếu lương (id) không hợp lệ.', 400);
    }
    targetPayroll = await PhieuLuong.findByPk(String(payrollId));
    if (!targetPayroll) {
      throw new ServiceError('Không tìm thấy phiếu lương để mở khóa.', 404);
    }
    if (targetPayroll.trang_thai === 'da_chi_tra') {
      throw new ServiceError(
        `Không thể mở khóa phiếu lương tháng ${targetPayroll.thang}/${targetPayroll.nam} vì đã ở trạng thái đã chi trả (da_chi_tra).`,
        403,
        'PAYROLL_ALREADY_PAID'
      );
    }
    m = Number(targetPayroll.thang);
    y = Number(targetPayroll.nam);
    scopedDeptId = null;
  } else {
    const validated = validatePayrollScopeParams({ thang: month, nam: year, don_vi_id: departmentId });
    m = validated.month;
    y = validated.year;
    scopedDeptId = validated.departmentId;
  }

  const scopedUserIds = targetPayroll
    ? [targetPayroll.nguoi_dung_id]
    : await resolveDepartmentUserIdsFilter(scopedDeptId);
  const userFilter = scopedUserIds
    ? { nguoi_dung_id: { [Op.in]: scopedUserIds.length ? scopedUserIds : ['00000000-0000-0000-0000-000000000000'] } }
    : {};

  if (!targetPayroll) {
    const paidCount = await PhieuLuong.count({
      where: { thang: m, nam: y, trang_thai: 'da_chi_tra', ...userFilter },
    });
    if (paidCount > 0) {
      throw new ServiceError(
        `Không thể mở khóa bảng lương tháng ${m}/${y} vì đã có ${paidCount} phiếu lương ở trạng thái đã chi trả (da_chi_tra).`,
        403,
        'PAYROLL_ALREADY_PAID'
      );
    }
  }

  const unlockWhere = targetPayroll
    ? { id: targetPayroll.id, trang_thai: 'da_duyet' }
    : { thang: m, nam: y, trang_thai: 'da_duyet', ...userFilter };

  const lockedCount = await PhieuLuong.count({ where: unlockWhere });
  if (lockedCount === 0) {
    throw new ServiceError(
      `Không có phiếu lương nào ở trạng thái đã khóa (da_duyet) trong tháng ${m}/${y} để mở khóa.`,
      404,
      'PAYROLL_NOT_LOCKED'
    );
  }

  const monthStr = String(m).padStart(2, '0');
  const startDateStr = `${y}-${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const unlockedPayrollsCount = await runInTransaction(async (transaction) => {
    const [pCount] = await PhieuLuong.update(
      { trang_thai: 'nhap', thoi_gian_duyet: null, ghi_chu: `Mở khóa: ${reason.trim()}` },
      { where: unlockWhere, transaction }
    );

    await NhatKyChamCong.update(
      { da_chot: false },
      { where: { ngay_cong: { [Op.between]: [startDateStr, endDateStr] }, ...userFilter }, transaction }
    );

    return pCount;
  });

  await NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUserId,
    loai_chu_the: 'user',
    hanh_dong: 'UNLOCK_PAYROLL',
    doi_tuong_id: targetPayroll ? String(targetPayroll.id) : `${y}-${m}`,
    loai_doi_tuong: 'phieu_luong',
    chi_tiet: {
      phieu_luong_id: targetPayroll ? targetPayroll.id : null,
      don_vi_id: scopedDeptId,
      thong_bao: `Mở khóa bảng lương tháng ${m}/${y}. Lý do: ${reason.trim()}`,
    },
    dia_chi_ip: ip || null,
  });

  return {
    thang: m,
    nam: y,
    da_khoa: false,
    so_phieu_da_mo_khoa: unlockedPayrollsCount,
    thong_bao: `Đã mở khóa thành công bảng lương tháng ${m}/${y}.`,
  };
};

module.exports = {
  ...tinhThueVaLuongHelper,
  ...xuatPhieuLuongService,
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
};
