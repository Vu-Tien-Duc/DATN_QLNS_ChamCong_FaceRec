/**
 * Tiện ích tính lương, thuế TNCN 5 bậc & định dạng phiếu lương (server/services/phieuLuong/tinhThueVaLuong.helper.js)
 */
const { Op } = require('sequelize');
const {
  PhuCapLuong,
  GiamTruLuong,
  NguoiDung,
  HoSoCanBo,
  PhongBan,
  NhatKyChamCong,
  CauHinhHeThong,
} = require('../../models');
const { normalizeRole } = require('../../utils/vaiTro.utils');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

const isSystemAdminUser = (u) => {
  if (!u) return false;
  const r = normalizeRole(u.vai_tro_chinh);
  const code = String(u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || '').toLowerCase();
  const name = String(u.ho_ten || '').toLowerCase();
  const hasAdminOrBghRole =
    Array.isArray(u.danh_sach_vai_tro) &&
    u.danh_sach_vai_tro.some((item) => {
      const itemRole = normalizeRole(item.ma_vai_tro || item);
      return itemRole === 'admin' || itemRole === 'bgh';
    });
  return (
    r === 'admin' ||
    r === 'bgh' ||
    r.includes('quản trị') ||
    r.includes('giám hiệu') ||
    code.startsWith('ADMIN') ||
    code.startsWith('BGH') ||
    hasAdminOrBghRole ||
    email.startsWith('admin@') ||
    email.includes('daihocdtd@') ||
    email.startsWith('hieutruong@') ||
    name.includes('quản trị viên') ||
    name.includes('hiệu trưởng') ||
    name.includes('ban giám hiệu')
  );
};

const DEFAULT_TAX_BRACKETS = [
  { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05 },
  { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.1 },
  { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.2 },
  { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.28 },
  { bac: 5, tu: 100000000, den: Infinity, thue_suat: 0.35 },
];

const normalizeTaxBrackets = (rawBrackets) => {
  const source = Array.isArray(rawBrackets) && rawBrackets.length > 0 ? rawBrackets : DEFAULT_TAX_BRACKETS;
  const sorted = [...source].sort((a, b) => Number(a.tu || 0) - Number(b.tu || 0));
  let cumulativeDeduction = 0;
  return sorted.map((b, idx) => {
    const tu = Number(b.tu || 0);
    const den = b.den === null || b.den === undefined || b.den === Infinity ? Infinity : Number(b.den);
    const rate = Number(b.thue_suat || 0);
    if (idx > 0) {
      const prev = sorted[idx - 1];
      const prevRate = Number(prev.thue_suat || 0);
      cumulativeDeduction += tu * (rate - prevRate);
    }
    return {
      bac: Number(b.bac || idx + 1),
      tu,
      den,
      thue_suat: rate,
      tru_nhanh: b.tru_nhanh !== undefined ? Number(b.tru_nhanh) : Math.round(cumulativeDeduction),
    };
  });
};

const calculatePersonalIncomeTax5Brackets = (taxableIncome, customBrackets = null) => {
  const income = Math.max(0, Number(taxableIncome) || 0);
  if (income <= 0) {
    return { taxAmount: 0, bracket: 0, details: [] };
  }

  const brackets = normalizeTaxBrackets(customBrackets);

  let taxAmount = 0;
  let activeBracket = 1;

  for (const b of brackets) {
    if (income > b.tu) {
      activeBracket = b.bac;
      if (income <= b.den) {
        taxAmount = Math.round(income * b.thue_suat - b.tru_nhanh);
        break;
      }
    }
  }

  const details = [];
  let remaining = income;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const bracketSpan = b.den === Infinity ? remaining : b.den - b.tu;
    const taxableInBracket = Math.min(remaining, bracketSpan);
    const taxInBracket = Math.round(taxableInBracket * b.thue_suat);
    details.push({
      bac: b.bac,
      tu: b.tu,
      den: b.den === Infinity ? null : b.den,
      thue_suat: b.thue_suat,
      thu_nhap_tinh_thue_bac: taxableInBracket,
      tien_thue_bac: taxInBracket,
    });
    remaining -= taxableInBracket;
  }

  return {
    taxAmount: Math.max(0, taxAmount),
    bracket: activeBracket,
    details,
  };
};

const getPayrollConfigParams = async () => {
  const configs = await CauHinhHeThong.findAll({
    where: {
      khoa_cau_hinh: {
        [Op.in]: [
          'LUONG_CO_SO',
          'GIAM_TRU',
          'TY_LE_BAO_HIEM',
          'BIEU_THUE_5_BAC',
          'DON_GIA_GIO',
          'DON_GIA_GIO_VUOT',
          'DINH_MUC_GIO_CHUAN',
          'CHUC_VU',
          'TY_LE_UU_DAI',
          'PHU_CAP_CHUC_VU',
          'HE_SO_LUONG_CO_BAN',
        ],
      },
    },
  });

  const paramMap = {};
  for (const c of configs) {
    paramMap[c.khoa_cau_hinh] = c.gia_tri;
  }

  const tyLeBhxh = paramMap.TY_LE_BAO_HIEM?.bhxh !== undefined ? Number(paramMap.TY_LE_BAO_HIEM.bhxh) : 0.08;
  const tyLeBhyt = paramMap.TY_LE_BAO_HIEM?.bhyt !== undefined ? Number(paramMap.TY_LE_BAO_HIEM.bhyt) : 0.015;
  const tyLeBhtn = paramMap.TY_LE_BAO_HIEM?.bhtn !== undefined ? Number(paramMap.TY_LE_BAO_HIEM.bhtn) : 0.01;
  const tongTyLeBaoHiem = Number((tyLeBhxh + tyLeBhyt + tyLeBhtn).toFixed(4)) || 0.105;

  return {
    luong_co_so: Number(paramMap.LUONG_CO_SO) || 2530000,
    giam_tru_ban_than: Number(paramMap.GIAM_TRU?.ban_than) || 15500000,
    giam_tru_phu_thuoc: Number(paramMap.GIAM_TRU?.phu_thuoc) || 6200000,
    ty_le_bhxh: tyLeBhxh,
    ty_le_bhyt: tyLeBhyt,
    ty_le_bhtn: tyLeBhtn,
    tong_ty_le_bao_hiem: tongTyLeBaoHiem,
    bieu_thue_5_bac: Array.isArray(paramMap.BIEU_THUE_5_BAC) ? paramMap.BIEU_THUE_5_BAC : DEFAULT_TAX_BRACKETS,
    don_gia_gio_chuan: Number(paramMap.DON_GIA_GIO ?? paramMap.DON_GIA_GIO_VUOT) || 120000,
    dinh_muc_thang: Math.round((Number(paramMap.DINH_MUC_GIO_CHUAN) || 135) / 3),
    ty_le_uu_dai_map: paramMap.TY_LE_UU_DAI || { giang_vien: 0.3, hanh_chinh: 0.0 },
    chuc_vu_list: Array.isArray(paramMap.CHUC_VU)
      ? paramMap.CHUC_VU
      : [
          { ma_chuc_vu: 'hieu_truong', he_so_phu_cap: 1.0, ty_le_giam_dinh_muc: 0.8 },
          { ma_chuc_vu: 'truong_khoa', he_so_phu_cap: 0.7, ty_le_giam_dinh_muc: 0.3 },
          { ma_chuc_vu: 'truong_bo_mon', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.2 },
          { ma_chuc_vu: 'truong_phong', he_so_phu_cap: 0.6, ty_le_giam_dinh_muc: 0.0 },
          { ma_chuc_vu: 'pho_khoa', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.2 },
          { ma_chuc_vu: 'pho_phong', he_so_phu_cap: 0.4, ty_le_giam_dinh_muc: 0.0 },
        ],
    so_ngay_cong_chuan: 22,
    phu_cap_chuc_vu_map: paramMap.PHU_CAP_CHUC_VU || {
      hieu_truong: 1.3,
      hieu_pho: 1.1,
      truong_khoa: 0.9,
      pho_khoa: 0.7,
      truong_bo_mon: 0.5,
      pho_bo_mon: 0.4,
      truong_phong: 0.7,
      pho_phong: 0.5,
    },
  };
};

const normalizePositionCode = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const calculateUserPayroll = async ({ user, month, year, configParams, createdBy }) => {
  const userId = user.id;
  const userRole = normalizeRole(user.vai_tro_chinh);
  const profile = user.ho_so || {};

  const contractType = (profile.loai_hop_dong || '').toLowerCase();
  const isVisitingLecturer =
    (profile.loai_nhan_su || '').toLowerCase() === 'thinh_giang' || contractType === 'thinh_giang';
  const isCasualContract = contractType === 'hop_dong_vu_viec';
  const isExemptFromInsurance = isVisitingLecturer || isCasualContract;

  const heSoLuong = isVisitingLecturer ? 0 : Number(profile.he_so_luong || 2.34);
  const luongCoSo = configParams.luong_co_so;
  const luongChinh = isVisitingLecturer ? 0 : Math.round(heSoLuong * luongCoSo);

  const positionCode = normalizePositionCode(profile.chuc_vu || userRole);
  const positionConfig = (configParams.chuc_vu_list || []).find(
    (item) =>
      normalizePositionCode(item.ma_chuc_vu) === positionCode || normalizePositionCode(item.ma_chuc_vu) === userRole
  );
  const heSoChucVu = isVisitingLecturer
    ? 0
    : positionConfig?.he_so_phu_cap !== undefined
      ? Number(positionConfig.he_so_phu_cap)
      : configParams.phu_cap_chuc_vu_map[positionCode] || configParams.phu_cap_chuc_vu_map[userRole] || 0;
  const phuCapChucVu = Math.round(heSoChucVu * luongCoSo);

  let seniorityYears = Number(profile.tham_nien_nam || 0);
  if (seniorityYears <= 0 && profile.ngay_bat_dau_giang_day) {
    const startDate = new Date(profile.ngay_bat_dau_giang_day);
    const targetDate = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(startDate.getTime()) && targetDate > startDate) {
      seniorityYears = Math.max(0, Math.floor((targetDate - startDate) / (365.25 * 24 * 3600 * 1000)));
    }
  }

  const isFaculty =
    isVisitingLecturer ||
    ['giang_vien', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon'].includes(userRole);
  const uuDaiRate = isVisitingLecturer
    ? 0
    : isFaculty
      ? Number(configParams.ty_le_uu_dai_map?.giang_vien ?? 0.3)
      : Number(configParams.ty_le_uu_dai_map?.hanh_chinh ?? 0);
  const seniorityBase = luongChinh + phuCapChucVu;
  const phuCapThamNien =
    !isVisitingLecturer && isFaculty && seniorityYears >= 5 ? Math.round(seniorityBase * (seniorityYears / 100)) : 0;
  const phuCapUuDaiNghe = !isVisitingLecturer && uuDaiRate > 0 ? Math.round((luongChinh + phuCapChucVu) * uuDaiRate) : 0;
  const tongPhuCap = phuCapChucVu + phuCapThamNien + phuCapUuDaiNghe;

  const monthStr = String(month).padStart(2, '0');
  const startDateStr = `${year}-${monthStr}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDateStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const attendanceLogs = await NhatKyChamCong.findAll({
    where: {
      nguoi_dung_id: userId,
      ngay_cong: { [Op.between]: [startDateStr, endDateStr] },
    },
  });

  let totalActualTeachingHours = 0;
  const absentDateSet = new Set();
  const workedDateSet = new Set();

  for (const log of attendanceLogs) {
    const dateKey = String(log.ngay_cong || '').slice(0, 10);
    if (log.trang_thai === 'absent') {
      if (dateKey && !workedDateSet.has(dateKey)) absentDateSet.add(dateKey);
    } else if (dateKey) {
      workedDateSet.add(dateKey);
      absentDateSet.delete(dateKey);
    }
    if (isFaculty && log.trang_thai !== 'absent' && log.trang_thai !== 'excused_absence') {
      // Quy đổi so_tiet_thuc_day (45 phút/tiết = 0.75 giờ) sang giờ chuẩn để khớp với dinh_muc_thang
      const teachingHours =
        Number(log.so_tiet_thuc_day || 0) > 0
          ? Number(log.so_tiet_thuc_day) * 0.75
          : Number(log.so_gio_cong || 0);
      totalActualTeachingHours += teachingHours;
    }
  }

  const unexcusedAbsenceDays = absentDateSet.size;
  const actualWorkDays = workedDateSet.size;

  const quotaReductionRate = Math.min(0.95, Math.max(0, Number(positionConfig?.ty_le_giam_dinh_muc || 0)));
  const dinhMucGoc = isVisitingLecturer
    ? 0
    : isFaculty
      ? Math.max(0, Math.round(configParams.dinh_muc_thang * (1 - quotaReductionRate)))
      : 0;
  const gioVuot = isFaculty ? Math.max(0, Math.round(totalActualTeachingHours - dinhMucGoc)) : 0;
  const thuLaoVuotGio = isFaculty ? Math.round(gioVuot * configParams.don_gia_gio_chuan) : 0;

  const standardWorkingDays = configParams.so_ngay_cong_chuan || 22;
  const payRatio = isVisitingLecturer
    ? 0
    : unexcusedAbsenceDays > 0
      ? Math.max(0, (standardWorkingDays - unexcusedAbsenceDays) / standardWorkingDays)
      : 1;
  const adjustedLuongChinh = Math.round(luongChinh * payRatio);
  const grossIncome = adjustedLuongChinh + tongPhuCap + thuLaoVuotGio;

  const maxInsuranceBase = 20 * luongCoSo;
  const rawInsuranceBase = adjustedLuongChinh + phuCapChucVu + phuCapThamNien;
  const insuranceBase = isExemptFromInsurance ? 0 : Math.min(rawInsuranceBase, maxInsuranceBase);

  const bhxh = isExemptFromInsurance ? 0 : Math.round(insuranceBase * configParams.ty_le_bhxh);
  const bhyt = isExemptFromInsurance ? 0 : Math.round(insuranceBase * configParams.ty_le_bhyt);
  const bhtn = isExemptFromInsurance ? 0 : Math.round(insuranceBase * configParams.ty_le_bhtn);
  const tongBaoHiem = bhxh + bhyt + bhtn;

  const dependentsCount = Number(profile.so_nguoi_phu_thuoc || 0);
  const giamTruBanThan = configParams.giam_tru_ban_than;
  const giamTruPhuThuoc = dependentsCount * configParams.giam_tru_phu_thuoc;
  const tongGiamTru = giamTruBanThan + giamTruPhuThuoc;

  let tienThue = 0;
  if (isVisitingLecturer) {
    tienThue = grossIncome >= 2000000 ? Math.round(grossIncome * 0.1) : 0;
  } else {
    const thuNhapTinhThue = Math.max(0, grossIncome - tongBaoHiem - tongGiamTru);
    tienThue = calculatePersonalIncomeTax5Brackets(thuNhapTinhThue, configParams.bieu_thue_5_bac).taxAmount;
  }

  const absenceDeduction = Math.max(0, luongChinh - adjustedLuongChinh);
  const netSalary = Math.max(0, grossIncome - tongBaoHiem - tienThue);

  const allowances = [
    { loai_phu_cap: 'CHUC_VU', he_so_hoac_ty_le: heSoChucVu, so_tien: phuCapChucVu },
    { loai_phu_cap: 'THAM_NIEN', he_so_hoac_ty_le: seniorityYears, so_tien: phuCapThamNien },
    { loai_phu_cap: 'UU_DAI_NGHE', he_so_hoac_ty_le: uuDaiRate, so_tien: phuCapUuDaiNghe },
  ];

  const deductions = [];
  if (absenceDeduction > 0) {
    deductions.push({
      ly_do: `Khấu trừ ${unexcusedAbsenceDays} ngày vắng không phép`,
      so_tien: absenceDeduction,
    });
  }

  return {
    payrollFields: {
      nguoi_dung_id: userId,
      thang: Number(month),
      nam: Number(year),
      nguoi_lap_id: createdBy,
      luong_co_ban: luongCoSo,
      he_so_luong: heSoLuong,
      so_cong_chuan: standardWorkingDays,
      so_cong_thuc_te: actualWorkDays,
      so_tiet_nghia_vu: dinhMucGoc,
      so_tiet_thuc_day: Math.round(totalActualTeachingHours),
      so_tiet_vuot_gio: gioVuot,
      don_gia_tiet_vuot: configParams.don_gia_gio_chuan,
      tien_vuot_gio: thuLaoVuotGio,
      tong_phu_cap: tongPhuCap,
      tong_giam_tru: absenceDeduction,
      dong_bao_hiem: tongBaoHiem,
      thue_thu_nhap_ca_nhan: tienThue,
      thuc_linh: netSalary,
      trang_thai: 'nhap',
    },
    allowances,
    deductions,
  };
};

const payrollInclude = [
  {
    model: NguoiDung,
    as: 'nguoi_dung',
    attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien', 'ma_can_bo'],
    include: [
      { model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] },
      { model: HoSoCanBo, as: 'ho_so', attributes: ['hoc_ham', 'hoc_vi', 'chuc_vu', 'he_so_luong'] },
    ],
  },
  { model: NguoiDung, as: 'nguoi_lap', attributes: ['id', 'ho_ten', 'email'] },
  { model: NguoiDung, as: 'nguoi_duyet', attributes: ['id', 'ho_ten', 'email'] },
  { model: PhuCapLuong, as: 'danh_sach_phu_cap' },
  { model: GiamTruLuong, as: 'cac_khoan_giam_tru' },
];

const formatPayrollDoc = (doc, configParams = null) => {
  if (!doc) return null;
  const raw = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  const allowances = raw.danh_sach_phu_cap || [];
  const chucVu = Number(allowances.find((a) => a.loai_phu_cap === 'CHUC_VU')?.so_tien || 0);
  const thamNien = Number(allowances.find((a) => a.loai_phu_cap === 'THAM_NIEN')?.so_tien || 0);
  const uuDaiNghe = Number(allowances.find((a) => a.loai_phu_cap === 'UU_DAI_NGHE')?.so_tien || 0);

  const luongCoSo = Number(raw.luong_co_ban || 0);
  const heSoLuong = Number(raw.he_so_luong || 1);
  const luongChinh = Math.max(0, Math.round(luongCoSo * heSoLuong) - Number(raw.tong_giam_tru || 0));
  const tongBaoHiem = Number(raw.dong_bao_hiem || 0);
  const tienThue = Number(raw.thue_thu_nhap_ca_nhan || 0);
  const thucLinh = Number(raw.thuc_linh || 0);
  const gross = luongChinh + Number(raw.tong_phu_cap || 0) + Number(raw.tien_vuot_gio || 0);

  const bhxhRate = Number(configParams?.ty_le_bhxh ?? 0.08);
  const bhytRate = Number(configParams?.ty_le_bhyt ?? 0.015);
  const bhtnRate = Number(configParams?.ty_le_bhtn ?? 0.01);
  const totalInsuranceRate = Number(configParams?.tong_ty_le_bao_hiem ?? (bhxhRate + bhytRate + bhtnRate)) || 0.105;

  return {
    ...raw,
    luong_co_so: luongCoSo,
    luong_chinh: luongChinh,
    phu_cap_chuc_vu: chucVu,
    phu_cap_tham_nien: thamNien,
    phu_cap_uu_dai_nghe: uuDaiNghe,
    tong_thu_nhap_gross: gross,
    thuc_linh_net: thucLinh,
    da_khoa: ['da_duyet', 'da_chi_tra'].includes(raw.trang_thai),
    gio_giang: {
      dinh_muc_goc: raw.so_tiet_nghia_vu || 0,
      gio_quy_doi_tich_luy: raw.so_tiet_thuc_day || 0,
      gio_vuot_dinh_muc: raw.so_tiet_vuot_gio || 0,
      don_gia_gio_chuan: Number(raw.don_gia_tiet_vuot || 0),
      thu_lao_vuot_gio: Number(raw.tien_vuot_gio || 0),
    },
    bao_hiem: {
      bhxh: Math.round(tongBaoHiem * (bhxhRate / totalInsuranceRate)),
      bhyt: Math.round(tongBaoHiem * (bhytRate / totalInsuranceRate)),
      bhtn: Math.round(tongBaoHiem * (bhtnRate / totalInsuranceRate)),
      tong_bao_hiem: tongBaoHiem,
    },
    thue_tncn: { tien_thue: tienThue },
  };
};

module.exports = {
  ServiceError,
  isSystemAdminUser,
  calculatePersonalIncomeTax5Brackets,
  getPayrollConfigParams,
  calculateUserPayroll,
  payrollInclude,
  formatPayrollDoc,
};
