/**
 * Dịch vụ Tra cứu & Xuất dữ liệu Phiếu lương Excel/PDF (server/services/phieuLuong/xuatPhieuLuong.service.js)
 */
const { Op } = require('sequelize');
const { PhieuLuong, NguoiDung } = require('../../models');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { normalizeRole, UNIT_LEADER_ROLES } = require('../../utils/vaiTro.utils');
const {
  ServiceError,
  isSystemAdminUser,
  getPayrollConfigParams,
  payrollInclude,
  formatPayrollDoc,
} = require('./tinhThueVaLuong.helper');

const fetchPayrolls = async ({ thang, nam, don_vi_id, trang_thai, nguoi_dung_id, currentUser }) => {
  const currentUserId = String(currentUser.id);
  const role = normalizeRole(currentUser.vai_tro_chinh);
  const where = {};

  if (thang) where.thang = Number(thang);
  if (nam) where.nam = Number(nam);
  if (trang_thai) where.trang_thai = trang_thai;

  if (['admin', 'bgh', 'ke_toan'].includes(role)) {
    if (nguoi_dung_id) {
      where.nguoi_dung_id = nguoi_dung_id;
    } else if (don_vi_id) {
      const deptUsers = await NguoiDung.findAll({
        where: { don_vi_chinh_id: don_vi_id },
        attributes: ['id'],
        raw: true,
      });
      const ids = deptUsers.map((u) => u.id);
      where.nguoi_dung_id = { [Op.in]: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] };
    }
  } else if (UNIT_LEADER_ROLES.includes(role)) {
    const deanUserIds = await getDeanScopedUserIds(currentUser);
    if (nguoi_dung_id) {
      if (!deanUserIds.map(String).includes(String(nguoi_dung_id))) {
        throw new ServiceError('Bạn không có quyền xem bảng lương của nhân sự ngoài đơn vị.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else {
      where.nguoi_dung_id = { [Op.in]: deanUserIds.length ? deanUserIds : ['00000000-0000-0000-0000-000000000000'] };
    }
  } else {
    where.nguoi_dung_id = currentUserId;
  }

  const [payrolls, configParams] = await Promise.all([
    PhieuLuong.findAll({
      where,
      include: payrollInclude,
      order: [
        ['thang', 'DESC'],
        ['nam', 'DESC'],
        ['tao_luc', 'DESC'],
      ],
    }),
    getPayrollConfigParams(),
  ]);

  return payrolls
    .filter((p) => !isSystemAdminUser(p.nguoi_dung))
    .map((doc) => formatPayrollDoc(doc, configParams));
};

const fetchPayrollById = async (id, currentUser) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã phiếu lương (id) không hợp lệ.', 400);
  }

  const payroll = await PhieuLuong.findByPk(String(id), { include: payrollInclude });
  if (!payroll) {
    throw new ServiceError('Không tìm thấy phiếu lương.', 404);
  }

  const currentUserId = String(currentUser.id);
  const role = normalizeRole(currentUser.vai_tro_chinh);
  const ownerId = String(payroll.nguoi_dung_id);

  if (['admin', 'bgh', 'ke_toan'].includes(role)) {
    // Quản trị viên / BGH / Kế toán được quyền tra cứu chi tiết phiếu lương toàn trường
  } else if (UNIT_LEADER_ROLES.includes(role)) {
    if (ownerId !== currentUserId) {
      const deanUserIds = await getDeanScopedUserIds(currentUser);
      if (!deanUserIds.map(String).includes(ownerId)) {
        throw new ServiceError('Bạn không có quyền xem phiếu lương của nhân sự ngoài đơn vị.', 403);
      }
    }
  } else if (ownerId !== currentUserId) {
    throw new ServiceError('Bạn chỉ có quyền xem phiếu lương của chính mình.', 403);
  }

  const configParams = await getPayrollConfigParams();
  return formatPayrollDoc(payroll, configParams);
};

const exportPayrollExcelData = async ({ thang, nam, don_vi_id, currentUser }) => {
  const month = Number(thang);
  const year = Number(nam);
  const payrolls = await fetchPayrolls({ thang, nam, don_vi_id, currentUser });

  const headers = [
    { key: 'stt', label: 'STT' },
    { key: 'code', label: 'Mã Cán Bộ' },
    { key: 'fullName', label: 'Họ và Tên' },
    { key: 'role', label: 'Chức Danh' },
    { key: 'salaryCoefficient', label: 'Hệ Số Lương' },
    { key: 'baseSalary', label: 'Lương Cơ Sở' },
    { key: 'primarySalary', label: 'Lương Chính' },
    { key: 'positionAllowance', label: 'Phụ Cấp Chức Vụ' },
    { key: 'seniorityAllowance', label: 'Phụ Cấp Thâm Niên' },
    { key: 'vocationalAllowance', label: 'Ưu Đãi Nghề (30%)' },
    { key: 'overtimeTeachingFee', label: 'Thù Lao Vượt Giờ' },
    { key: 'grossIncome', label: 'Tổng Thu Nhập Gross' },
    { key: 'bhxh', label: 'BHXH (8%)' },
    { key: 'bhyt', label: 'BHYT (1.5%)' },
    { key: 'bhtn', label: 'BHTN (1%)' },
    { key: 'totalInsurance', label: 'Tổng Bảo Hiểm (10.5%)' },
    { key: 'pitTax', label: 'Thuế TNCN Lũy Tiến' },
    { key: 'netSalary', label: 'Thực Lĩnh (Net)' },
    { key: 'status', label: 'Trạng Thái' },
  ];

  const rows = payrolls.map((p, idx) => ({
    stt: idx + 1,
    code: p.nguoi_dung?.ma_can_bo || '',
    fullName: p.nguoi_dung?.ho_ten || '',
    role: p.nguoi_dung?.vai_tro_chinh || '',
    salaryCoefficient: p.he_so_luong,
    baseSalary: p.luong_co_so,
    primarySalary: p.luong_chinh,
    positionAllowance: p.phu_cap_chuc_vu,
    seniorityAllowance: p.phu_cap_tham_nien,
    vocationalAllowance: p.phu_cap_uu_dai_nghe,
    overtimeTeachingFee: p.gio_giang?.thu_lao_vuot_gio || 0,
    grossIncome: p.tong_thu_nhap_gross,
    bhxh: p.bao_hiem?.bhxh || 0,
    bhyt: p.bao_hiem?.bhyt || 0,
    bhtn: p.bao_hiem?.bhtn || 0,
    totalInsurance: p.bao_hiem?.tong_bao_hiem || 0,
    pitTax: p.thue_tncn?.tien_thue || 0,
    netSalary: p.thuc_linh_net,
    status: p.trang_thai,
  }));

  return {
    title: `BẢNG THANH TOÁN TIỀN LƯƠNG THÁNG ${month}/${year}`,
    month,
    year,
    totalEmployees: rows.length,
    headers,
    rows,
  };
};

const exportPayrollPdfData = async (id, currentUser) => {
  const payroll = await fetchPayrollById(id, currentUser);

  return {
    template: 'PAYROLL_SLIP_2026',
    schoolName: 'TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU)',
    title: `PHIẾU LƯƠNG CÁ NHÂN THÁNG ${payroll.thang}/${payroll.nam}`,
    employee: {
      fullName: payroll.nguoi_dung?.ho_ten || '',
      email: payroll.nguoi_dung?.email || '',
      code: payroll.nguoi_dung?.ma_can_bo || '',
      role: payroll.nguoi_dung?.vai_tro_chinh || '',
    },
    salaryInfo: {
      salaryCoefficient: payroll.he_so_luong,
      baseSalary: payroll.luong_co_so,
      primarySalary: payroll.luong_chinh,
      positionAllowance: payroll.phu_cap_chuc_vu,
      seniorityAllowance: payroll.phu_cap_tham_nien,
      vocationalAllowance: payroll.phu_cap_uu_dai_nghe,
      overtimeHours: payroll.gio_giang?.gio_vuot_dinh_muc || 0,
      overtimePayment: payroll.gio_giang?.thu_lao_vuot_gio || 0,
      grossIncome: payroll.tong_thu_nhap_gross,
    },
    deductions: {
      bhxh: payroll.bao_hiem?.bhxh || 0,
      bhyt: payroll.bao_hiem?.bhyt || 0,
      bhtn: payroll.bao_hiem?.bhtn || 0,
      totalInsurance: payroll.bao_hiem?.tong_bao_hiem || 0,
      incomeTax: payroll.thue_tncn?.tien_thue || 0,
    },
    netSalary: payroll.thuc_linh_net,
    isLocked: Boolean(payroll.da_khoa),
    lockedAt: payroll.thoi_gian_duyet,
    approvedBy: payroll.nguoi_duyet?.ho_ten || 'BAN GIÁM HIỆU',
    generatedAt: new Date(),
  };
};

module.exports = {
  fetchPayrolls,
  fetchPayrollById,
  exportPayrollExcelData,
  exportPayrollPdfData,
};
