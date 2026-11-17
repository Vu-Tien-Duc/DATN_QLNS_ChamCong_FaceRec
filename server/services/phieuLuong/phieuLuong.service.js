// Khởi tạo bảng lương tháng hàng loạt, khóa/mở sổ lương và điều phối xuất phiếu lương Excel/PDF
const { Op } = require('sequelize');
const {
  PhieuLuong,
  PhuCapLuong,
  GiamTruLuong,
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  PhongBan,
  NhatKyChamCong,
  NhatKyKiemToan,
} = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const tinhThueVaLuongHelper = require('./tinhThueVaLuong.helper');
const xuatPhieuLuongService = require('./xuatPhieuLuong.service');

const {
  ServiceError,
  isSystemAdminUser,
  getPayrollConfigParams,
  calculateUserPayroll,
  payrollInclude,
  formatPayrollDoc,
} = tinhThueVaLuongHelper;

// Tính và tạo bảng lương tháng hàng loạt cho nhân sự thuộc phạm vi quản lý
const generateMonthlyPayroll = async ({ thang, nam, don_vi_id, currentUser }) => {
  const currentUserId = currentUser.id;
  const isAdminOrHR = hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan']);

  if (!isAdminOrHR && !hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    throw new ServiceError('Bạn không có quyền khởi tạo bảng lương.', 403);
  }

  const m = Number(thang);
  const y = Number(nam);

  const userWhere = {
    kich_hoat: true,
    vai_tro_chinh: { [Op.notIn]: ['admin', 'bgh'] },
  };
  if (!isAdminOrHR) {
    const deanUserIds = await getDeanScopedUserIds(currentUser);
    userWhere.id = { [Op.in]: deanUserIds.length ? deanUserIds : ['00000000-0000-0000-0000-000000000000'] };
  } else if (don_vi_id) {
    const childDepts = await PhongBan.findAll({
      where: { don_vi_cha_id: don_vi_id },
      attributes: ['id'],
      raw: true,
    });
    const allDeptIds = [don_vi_id, ...childDepts.map((d) => d.id)];
    userWhere.don_vi_chinh_id = { [Op.in]: allDeptIds };
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
      `Bảng lương tháng ${m}/${y} trong phạm vi được chọn đã được khóa sổ, không thể tính toán lại. Vui lòng liên hệ Quản trị viên để mở khóa nếu cần điều chỉnh.`,
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
    throw new ServiceError('Không tìm thấy cán bộ, giảng viên nào trong phạm vi được chọn.', 404);
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
    chi_tiet: { message: `Tạo bảng lương tháng ${m}/${y} cho ${createdPayrolls.length} nhân sự.` },
  });

  return {
    month: m,
    year: y,
    totalCalculated: createdPayrolls.length,
    payrolls: createdPayrolls.map((doc) => formatPayrollDoc(doc, configParams)),
  };
};

// Lấy danh sách ID nhân sự thuộc đơn vị và các đơn vị con để lọc bảng lương
const resolveDepartmentUserIdsFilter = async (departmentId) => {
  if (!departmentId || !isValidUuid(String(departmentId))) return null;
  const allDeptIds = [String(departmentId)];
  let parentIds = [String(departmentId)];
  while (parentIds.length > 0) {
    const childDepts = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: parentIds } },
      attributes: ['id'],
      raw: true,
    });
    const newChildren = childDepts.map((d) => String(d.id)).filter((id) => !allDeptIds.includes(id));
    if (newChildren.length === 0) break;
    allDeptIds.push(...newChildren);
    parentIds = newChildren;
  }

  const users = await NguoiDung.findAll({
    where: { don_vi_chinh_id: { [Op.in]: allDeptIds } },
    attributes: ['id'],
    raw: true,
  });
  return users.map((u) => u.id);
};

// Khóa sổ bảng lương tháng và khóa đồng thời nhật ký chấm công liên quan
const lockMonthlyPayroll = async ({ month, year, departmentId = null, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  if (!hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Ban Giám Hiệu mới có quyền khóa bảng lương.', 403);
  }

  const m = Number(month);
  const y = Number(year);
  const scopedUserIds = await resolveDepartmentUserIdsFilter(departmentId);
  const userFilter = scopedUserIds
    ? { nguoi_dung_id: { [Op.in]: scopedUserIds.length ? scopedUserIds : ['00000000-0000-0000-0000-000000000000'] } }
    : {};

  const existingCount = await PhieuLuong.count({ where: { thang: m, nam: y, ...userFilter } });
  if (existingCount === 0) {
    throw new ServiceError(`Không tìm thấy bảng lương tháng ${m}/${y} để khóa.`, 404);
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
      { where: { thang: m, nam: y, ...userFilter }, transaction }
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
    doi_tuong_id: `${y}-${m}`,
    loai_doi_tuong: 'phieu_luong',
    chi_tiet: {
      departmentId: departmentId || null,
      message: `Khóa sổ bảng lương tháng ${m}/${y} (${lockedPayrollsCount} phiếu lương) và chốt công (${lockedAttendanceLogsCount} ngày công).`,
    },
    dia_chi_ip: ip || null,
  });

  return {
    month: m,
    year: y,
    isLocked: true,
    lockedAt: lockTime,
    lockedPayrollsCount,
    lockedAttendanceLogsCount,
    message: `Đã khóa sổ thành công bảng lương tháng ${m}/${y}.`,
  };
};

// Mở khóa bảng lương tháng có ghi nhận lý do và nhật ký kiểm toán
const unlockMonthlyPayroll = async ({ month, year, departmentId = null, reason, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  if (!hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Ban Giám Hiệu mới có quyền mở khóa bảng lương.', 403);
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new ServiceError('Lý do mở khóa bảng lương là bắt buộc (tối thiểu 5 ký tự).', 400);
  }

  const m = Number(month);
  const y = Number(year);
  const scopedUserIds = await resolveDepartmentUserIdsFilter(departmentId);
  const userFilter = scopedUserIds
    ? { nguoi_dung_id: { [Op.in]: scopedUserIds.length ? scopedUserIds : ['00000000-0000-0000-0000-000000000000'] } }
    : {};

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

  const monthStr = String(m).padStart(2, '0');
  const startDateStr = `${y}-${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const unlockedPayrollsCount = await runInTransaction(async (transaction) => {
    const [pCount] = await PhieuLuong.update(
      { trang_thai: 'nhap', thoi_gian_duyet: null, ghi_chu: `Mở khóa: ${reason.trim()}` },
      { where: { thang: m, nam: y, trang_thai: 'da_duyet', ...userFilter }, transaction }
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
    doi_tuong_id: `${y}-${m}`,
    loai_doi_tuong: 'phieu_luong',
    chi_tiet: {
      departmentId: departmentId || null,
      message: `Mở khóa bảng lương tháng ${m}/${y}. Lý do: ${reason.trim()}`,
    },
    dia_chi_ip: ip || null,
  });

  return {
    month: m,
    year: y,
    isLocked: false,
    unlockedPayrollsCount,
    message: `Đã mở khóa thành công bảng lương tháng ${m}/${y}.`,
  };
};

module.exports = {
  ...tinhThueVaLuongHelper,
  ...xuatPhieuLuongService,
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
};
