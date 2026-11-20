// Tra cứu phiếu lương theo phân quyền và trích xuất dữ liệu xuất Excel / in PDF
const { Op } = require('sequelize');
const { PhieuLuong } = require('../../models');
const { TRANG_THAI_LUONG } = require('../../models/phieuLuong.model');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const { getDeanScopedUserIds } = require('../../utils/phamViTruongKhoa');
const { UNIT_LEADER_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const { sanitizeExcelRow } = require('../baoCao/dinhDangBaoCao.helper');
const {
  ServiceError,
  isSystemAdminUser,
  validatePayrollScopeParams,
  resolveDepartmentUserIdsFilter,
  getPayrollConfigParams,
  payrollInclude,
  formatPayrollDoc,
} = require('./tinhThueVaLuong.helper');

// Lấy danh sách phiếu lương theo tháng/năm/đơn vị và phạm vi phân quyền
const fetchPayrolls = async ({ thang, nam, don_vi_id, trang_thai, nguoi_dung_id, currentUser }) => {
  const currentUserId = String(currentUser.id);
  const where = {};

  if (thang !== undefined && thang !== null && String(thang).trim() !== '') {
    const m = Number(thang);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new ServiceError('Tháng (thang) phải là số nguyên từ 1 đến 12.', 400, 'INVALID_MONTH');
    }
    where.thang = m;
  }
  if (nam !== undefined && nam !== null && String(nam).trim() !== '') {
    const y = Number(nam);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      throw new ServiceError('Năm (nam) phải là số nguyên từ 2000 đến 2100.', 400, 'INVALID_YEAR');
    }
    where.nam = y;
  }
  if (trang_thai !== undefined && trang_thai !== null && String(trang_thai).trim() !== '') {
    const statusVal = String(trang_thai).trim();
    if (!TRANG_THAI_LUONG.includes(statusVal)) {
      throw new ServiceError('Trạng thái phiếu lương (trang_thai) không hợp lệ.', 400, 'INVALID_PAYROLL_STATUS');
    }
    where.trang_thai = statusVal;
  }
  if (nguoi_dung_id !== undefined && nguoi_dung_id !== null && !isValidUuid(String(nguoi_dung_id))) {
    throw new ServiceError('Mã người dùng (nguoi_dung_id) không đúng định dạng UUID.', 400, 'INVALID_USER_ID');
  }

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    if (nguoi_dung_id) {
      where.nguoi_dung_id = nguoi_dung_id;
    } else if (don_vi_id) {
      const ids = await resolveDepartmentUserIdsFilter(don_vi_id);
      where.nguoi_dung_id = { [Op.in]: ids && ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] };
    }
  } else if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
    if (nguoi_dung_id && String(nguoi_dung_id) === currentUserId) {
      where.nguoi_dung_id = currentUserId;
    } else {
      const deanUserIds = await getDeanScopedUserIds(currentUser);
      if (nguoi_dung_id) {
        if (!deanUserIds.map(String).includes(String(nguoi_dung_id))) {
          throw new ServiceError('Bạn không có quyền xem bảng lương của nhân sự ngoài đơn vị.', 403);
        }
        where.nguoi_dung_id = nguoi_dung_id;
      } else {
        where.nguoi_dung_id = { [Op.in]: deanUserIds.length ? deanUserIds : ['00000000-0000-0000-0000-000000000000'] };
      }
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

// Xem chi tiết một phiếu lương kèm kiểm tra quyền truy cập
const fetchPayrollById = async (id, currentUser) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã phiếu lương (id) không hợp lệ.', 400);
  }

  const payroll = await PhieuLuong.findByPk(String(id), { include: payrollInclude });
  if (!payroll) {
    throw new ServiceError('Không tìm thấy phiếu lương.', 404);
  }

  const currentUserId = String(currentUser.id);
  const ownerId = String(payroll.nguoi_dung_id);

  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'ke_toan'])) {
    // Quản trị viên / BGH / Kế toán được quyền tra cứu chi tiết phiếu lương toàn trường
  } else if (hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES)) {
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

// Chuẩn bị cấu trúc cột và các dòng dữ liệu phục vụ xuất bảng lương Excel
const exportPayrollExcelData = async ({ thang, nam, don_vi_id, currentUser }) => {
  const { month, year, departmentId } = validatePayrollScopeParams({ thang, nam, don_vi_id });
  const payrolls = await fetchPayrolls({ thang: month, nam: year, don_vi_id: departmentId, currentUser });

  const headers = [
    { key: 'stt', label: 'STT' },
    { key: 'ma_can_bo', label: 'Mã Cán Bộ' },
    { key: 'ho_ten', label: 'Họ Và Tên' },
    { key: 'ten_phong_ban', label: 'Khoa / Đơn Vị' },
    { key: 'vai_tro_chinh', label: 'Chức Danh' },
    { key: 'he_so_luong', label: 'Hệ Số Lương' },
    { key: 'luong_co_so', label: 'Lương Cơ Sở' },
    { key: 'luong_chinh', label: 'Lương Chính' },
    { key: 'phu_cap_chuc_vu', label: 'Phụ Cấp Chức Vụ' },
    { key: 'phu_cap_tham_nien', label: 'Phụ Cấp Thâm Niên' },
    { key: 'phu_cap_uu_dai_nghe', label: 'Ưu Đãi Nghề' },
    { key: 'thu_lao_vuot_gio', label: 'Thù Lao Vượt Giờ' },
    { key: 'tong_thu_nhap_gross', label: 'Tổng Thu Nhập Gross' },
    { key: 'bhxh', label: 'BHXH' },
    { key: 'bhyt', label: 'BHYT' },
    { key: 'bhtn', label: 'BHTN' },
    { key: 'tong_bao_hiem', label: 'Tổng Bảo Hiểm' },
    { key: 'tien_thue', label: 'Thuế TNCN Lũy Tiến' },
    { key: 'thuc_linh_net', label: 'Thực Lĩnh (Net)' },
    { key: 'trang_thai', label: 'Trạng Thái' },
  ];

  const rows = payrolls.map((p, idx) =>
    sanitizeExcelRow({
      stt: idx + 1,
      ma_can_bo: p.nguoi_dung?.ma_can_bo || '',
      ho_ten: p.nguoi_dung?.ho_ten || '',
      ten_phong_ban: p.nguoi_dung?.don_vi_chinh?.ten_phong_ban || '',
      vai_tro_chinh: p.nguoi_dung?.vai_tro_chinh || '',
      he_so_luong: p.he_so_luong,
      luong_co_so: p.luong_co_so,
      luong_chinh: p.luong_chinh,
      phu_cap_chuc_vu: p.phu_cap_chuc_vu,
      phu_cap_tham_nien: p.phu_cap_tham_nien,
      phu_cap_uu_dai_nghe: p.phu_cap_uu_dai_nghe,
      thu_lao_vuot_gio: p.gio_giang?.thu_lao_vuot_gio || 0,
      tong_thu_nhap_gross: p.tong_thu_nhap_gross,
      bhxh: p.bao_hiem?.bhxh || 0,
      bhyt: p.bao_hiem?.bhyt || 0,
      bhtn: p.bao_hiem?.bhtn || 0,
      tong_bao_hiem: p.bao_hiem?.tong_bao_hiem || 0,
      tien_thue: p.thue_tncn?.tien_thue || 0,
      thuc_linh_net: p.thuc_linh_net,
      trang_thai: p.trang_thai,
    })
  );

  return {
    tieu_de: `BẢNG THANH TOÁN TIỀN LƯƠNG THÁNG ${month}/${year}`,
    thang: month,
    nam: year,
    tong_nhan_su: rows.length,
    headers,
    rows,
  };
};

// Lấy dữ liệu chi tiết một phiếu lương phục vụ in PDF
const exportPayrollPdfData = async (id, currentUser) => {
  const payroll = await fetchPayrollById(id, currentUser);

  return {
    mau_phieu: 'PAYROLL_SLIP_2026',
    ten_truong: 'TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU)',
    tieu_de: `PHIẾU LƯƠNG CÁ NHÂN THÁNG ${payroll.thang}/${payroll.nam}`,
    nhan_su: {
      ho_ten: payroll.nguoi_dung?.ho_ten || '',
      email: payroll.nguoi_dung?.email || '',
      ma_can_bo: payroll.nguoi_dung?.ma_can_bo || '',
      vai_tro_chinh: payroll.nguoi_dung?.vai_tro_chinh || '',
    },
    thong_tin_luong: {
      he_so_luong: payroll.he_so_luong,
      luong_co_so: payroll.luong_co_so,
      luong_chinh: payroll.luong_chinh,
      phu_cap_chuc_vu: payroll.phu_cap_chuc_vu,
      phu_cap_tham_nien: payroll.phu_cap_tham_nien,
      phu_cap_uu_dai_nghe: payroll.phu_cap_uu_dai_nghe,
      gio_vuot_dinh_muc: payroll.gio_giang?.gio_vuot_dinh_muc || 0,
      thu_lao_vuot_gio: payroll.gio_giang?.thu_lao_vuot_gio || 0,
      tong_thu_nhap_gross: payroll.tong_thu_nhap_gross,
    },
    khau_tru: {
      bhxh: payroll.bao_hiem?.bhxh || 0,
      bhyt: payroll.bao_hiem?.bhyt || 0,
      bhtn: payroll.bao_hiem?.bhtn || 0,
      tong_bao_hiem: payroll.bao_hiem?.tong_bao_hiem || 0,
      tien_thue: payroll.thue_tncn?.tien_thue || 0,
    },
    thuc_linh_net: payroll.thuc_linh_net,
    da_khoa: Boolean(payroll.da_khoa),
    thoi_gian_duyet: payroll.thoi_gian_duyet,
    nguoi_duyet: payroll.nguoi_duyet?.ho_ten || 'BAN GIÁM HIỆU',
    thoi_gian_tao: new Date(),
  };
};

module.exports = {
  fetchPayrolls,
  fetchPayrollById,
  exportPayrollExcelData,
  exportPayrollPdfData,
};
