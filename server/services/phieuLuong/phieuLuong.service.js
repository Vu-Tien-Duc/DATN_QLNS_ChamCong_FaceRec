/**
 * Dịch vụ Quản lý Bảng lương & Khóa sổ (server/services/phieuLuong.service.js)
 * Khởi tạo bảng lương hàng loạt, khóa/mở khóa sổ lương và re-export các module tính lương & xuất phiếu lương.
 */
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
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { normalizeRole } = require('../../utils/vaiTro.utils');
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

const generateMonthlyPayroll = async ({ thang, nam, don_vi_id, currentUser }) => {
  const currentUserId = currentUser.id;
  const role = normalizeRole(currentUser.vai_tro_chinh);
  const isAdminOrHR = ['admin', 'bgh', 'ke_toan'].includes(role);

  if (!isAdminOrHR && !['truong_khoa', 'pho_khoa'].includes(role)) {
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

const resolveDepartmentUserIdsFilter = async (departmentId) => {
  if (!departmentId || !isValidUuid(String(departmentId))) return null;
  const users = await NguoiDung.findAll({
    where: { don_vi_chinh_id: String(departmentId) },
    attributes: ['id'],
    raw: true,
  });
  return users.map((u) => u.id);
};

const lockMonthlyPayroll = async ({ month, year, departmentId = null, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  const role = normalizeRole(currentUser.vai_tro_chinh);
  if (!['admin', 'bgh', 'ke_toan'].includes(role)) {
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

const unlockMonthlyPayroll = async ({ month, year, departmentId = null, reason, currentUser, ip }) => {
  const currentUserId = currentUser.id;
  const role = normalizeRole(currentUser.vai_tro_chinh);
  if (!['admin', 'bgh', 'ke_toan'].includes(role)) {
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

  const monthStr = String(m).padStart(2, '0');
  const startDateStr = `${y}-${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDateStr = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const unlockedPayrollsCount = await runInTransaction(async (transaction) => {
    const [pCount] = await PhieuLuong.update(
      { trang_thai: 'nhap', thoi_gian_duyet: null, ghi_chu: `Mở khóa: ${reason.trim()}` },
      { where: { thang: m, nam: y, ...userFilter }, transaction }
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
