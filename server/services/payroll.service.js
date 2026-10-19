/**
 * Payroll Service (server/services/payroll.service.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Bảng lương Snapshot năm 2026 (Payroll - Collection 11).
 * - Khóa lương (isLocked / DA_KHOA) & tự động khóa bảng chấm công (Attendance Lock).
 * - Tính toán thuế TNCN lũy tiến 5 bậc theo Luật Thuế TNCN sửa đổi năm 2026.
 * - Xuất báo cáo bảng lương Excel & trích xuất phiếu lương cá nhân in ấn PDF.
 */
const mongoose = require('mongoose');
const Payroll = require('../models/payroll.model');
const User = require('../models/user.model');
const AttendanceLog = require('../models/attendanceLog.model');
const Schedule = require('../models/schedule.model');
const SystemConfig = require('../models/systemConfig.model');
const AuditLog = require('../models/auditLog.model');
const { getDeanScopedUserIds } = require('../utils/deanScope');

class ServiceError extends Error {
  constructor(message, statusCode = 400, errorCode = null, data = null) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * Thuật toán tính thuế TNCN lũy tiến 5 bậc (Luật Thuế TNCN sửa đổi áp dụng năm 2026)
 * - Bậc 1: Đến 10 triệu: 5%
 * - Bậc 2: Trên 10 triệu đến 30 triệu: 10% (trừ 500.000đ)
 * - Bậc 3: Trên 30 triệu đến 60 triệu: 20% (trừ 3.500.000đ)
 * - Bậc 4: Trên 60 triệu đến 100 triệu: 28% (trừ 8.300.000đ)
 * - Bậc 5: Trên 100 triệu: 35% (trừ 15.300.000đ)
 */
const calculatePersonalIncomeTax5Brackets = (taxableIncome) => {
  const income = Math.max(0, Number(taxableIncome) || 0);
  if (income <= 0) {
    return { taxAmount: 0, bracket: 0, details: [] };
  }

  const brackets = [
    { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05, tru_nhanh: 0 },
    { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.1, tru_nhanh: 500000 },
    { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.2, tru_nhanh: 3500000 },
    { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.28, tru_nhanh: 8300000 },
    { bac: 5, tu: 100000000, den: Infinity, thue_suat: 0.35, tru_nhanh: 15300000 },
  ];

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

  // Chi tiết từng bậc tính lũy tiến
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

/**
 * Đọc tham số cấu hình tính lương động từ SystemConfig (hoặc giá trị mặc định năm 2026)
 */
const getPayrollConfigParams = async () => {
  const configs = await SystemConfig.find({
    key: {
      $in: [
        'LUONG_CO_SO',
        'GIAM_TRU',
        'TY_LE_BAO_HIEM',
        'DON_GIA_GIO_VUOT',
        'DINH_MUC_GIO_CHUAN',
        'PHU_CAP_CHUC_VU',
        'HE_SO_LUONG_CO_BAN',
      ],
    },
  });

  const paramMap = {};
  for (const c of configs) {
    paramMap[c.key] = c.value;
  }

  return {
    luong_co_so: Number(paramMap.LUONG_CO_SO) || 2530000,
    giam_tru_ban_than: Number(paramMap.GIAM_TRU?.ban_than) || 15500000,
    giam_tru_phu_thuoc: Number(paramMap.GIAM_TRU?.phu_thuoc) || 6200000,
    ty_le_bhxh: Number(paramMap.TY_LE_BAO_HIEM?.bhxh) || 0.08,
    ty_le_bhyt: Number(paramMap.TY_LE_BAO_HIEM?.bhyt) || 0.015,
    ty_le_bhtn: Number(paramMap.TY_LE_BAO_HIEM?.bhtn) || 0.01,
    tong_ty_le_bao_hiem: 0.105,
    don_gia_gio_chuan: Number(paramMap.DON_GIA_GIO_VUOT) || 120000,
    dinh_muc_thang: Math.round((Number(paramMap.DINH_MUC_GIO_CHUAN) || 135) / 3), // 45 giờ/tháng
    phu_cap_chuc_vu_map: paramMap.PHU_CAP_CHUC_VU || {
      HIEU_TRUONG: 1.3,
      HIEU_PHO: 1.1,
      TRUONG_KHOA: 0.9,
      PHO_TRUONG_KHOA: 0.7,
      TRUONG_BO_MON: 0.5,
    },
  };
};

/**
 * Tính toán phiếu lương cho 1 cán bộ/giảng viên cụ thể
 */
const calculateUserPayroll = async ({ user, month, year, configParams, createdBy }) => {
  const userId = user._id || user.id;
  const userRole = (user.role || '').toUpperCase();

  // 1. Hệ số lương và lương cơ sở
  const heSoLuong = Number(user.he_so_luong || user.salaryCoefficient || 2.34);
  const luongCoSo = configParams.luong_co_so;
  const luongChinh = Math.round(heSoLuong * luongCoSo);

  // 2. Các khoản phụ cấp
  const heSoChucVu = configParams.phu_cap_chuc_vu_map[userRole] || 0;
  const phuCapChucVu = Math.round(heSoChucVu * luongCoSo);

  // Phụ cấp thâm niên (giả định 1%/năm sau 5 năm công tác, hoặc theo trường thâm niên)
  const seniorityYears = Number(user.seniorityYears || user.tham_nien_nam || 0);
  const phuCapThamNien = seniorityYears >= 5 ? Math.round(luongChinh * (seniorityYears / 100)) : 0;

  // Phụ cấp ưu đãi nghề ngành giáo dục (30% tổng lương chính + phụ cấp chức vụ)
  const isFaculty = ['GIANG_VIEN', 'GIANGVIEN', 'TRUONG_KHOA', 'TRUONGKHOA', 'PHO_TRUONG_KHOA', 'PHOKHOA', 'TRUONG_BO_MON'].includes(userRole);
  const phuCapUuDaiNghe = isFaculty ? Math.round((luongChinh + phuCapChucVu) * 0.3) : 0;

  // 3. Giờ giảng dạy thực tế và thù lao vượt giờ
  const monthStr = String(month).padStart(2, '0');
  const startDateStr = `${year}-${monthStr}-01`;
  const endDateStr = `${year}-${monthStr}-31`;

  const attendanceLogs = await AttendanceLog.find({
    userId,
    workDate: { $gte: startDateStr, $lte: endDateStr },
  });

  let totalActualTeachingHours = 0;
  for (const log of attendanceLogs) {
    totalActualTeachingHours += Number(log.actualTeachingPeriods || 0);
  }

  const dinhMucGoc = configParams.dinh_muc_thang;
  const gioVuot = Math.max(0, totalActualTeachingHours - dinhMucGoc);
  const thuLaoVuotGio = Math.round(gioVuot * configParams.don_gia_gio_chuan);

  // 4. Tổng thu nhập Gross
  const grossIncome = luongChinh + phuCapChucVu + phuCapThamNien + phuCapUuDaiNghe + thuLaoVuotGio;

  // 5. Bảo hiểm bắt buộc (Đóng trên lương chính + phụ cấp chức vụ + phụ cấp thâm niên)
  const insuranceBase = luongChinh + phuCapChucVu + phuCapThamNien;
  const bhxh = Math.round(insuranceBase * configParams.ty_le_bhxh);
  const bhyt = Math.round(insuranceBase * configParams.ty_le_bhyt);
  const bhtn = Math.round(insuranceBase * configParams.ty_le_bhtn);
  const tongBaoHiem = bhxh + bhyt + bhtn;

  // 6. Giảm trừ gia cảnh & Thuế TNCN lũy tiến 5 bậc
  const dependentsCount = Number(user.dependentsCount || 0);
  const giamTruBanThan = configParams.giam_tru_ban_than;
  const giamTruPhuThuoc = dependentsCount * configParams.giam_tru_phu_thuoc;
  const tongGiamTru = giamTruBanThan + giamTruPhuThuoc;

  const thuNhapTinhThue = Math.max(0, grossIncome - tongBaoHiem - tongGiamTru);
  const taxCalc = calculatePersonalIncomeTax5Brackets(thuNhapTinhThue);
  const tienThue = taxCalc.taxAmount;

  // 7. Thực lĩnh Net
  const netSalary = Math.max(0, grossIncome - tongBaoHiem - tienThue);

  // 8. Snapshot tham số năm 2026
  const snapshotThamSo = {
    baseSalarySnapshot: luongCoSo,
    personalDeductionSnapshot: giamTruBanThan,
    dependentDeductionSnapshot: configParams.giam_tru_phu_thuoc,
    socialInsuranceRatioSnapshot: configParams.ty_le_bhxh,
    healthInsuranceRatioSnapshot: configParams.ty_le_bhyt,
    unemploymentInsuranceRatioSnapshot: configParams.ty_le_bhtn,
    taxBracketsSnapshot: [
      { level: 1, from: 0, to: 10000000, taxRate: 0.05 },
      { level: 2, from: 10000000, to: 30000000, taxRate: 0.1 },
      { level: 3, from: 30000000, to: 60000000, taxRate: 0.2 },
      { level: 4, from: 60000000, to: 100000000, taxRate: 0.28 },
      { level: 5, from: 100000000, to: null, taxRate: 0.35 },
    ],
  };

  return {
    userId,
    month: Number(month),
    year: Number(year),
    createdBy,
    salaryCoefficient: heSoLuong,
    baseSalary: luongCoSo,
    primarySalary: luongChinh,
    positionAllowance: phuCapChucVu,
    seniorityAllowance: phuCapThamNien,
    vocationalAllowance: phuCapUuDaiNghe,
    allowances: [
      { type: 'CHUC_VU', rate: heSoChucVu, amount: phuCapChucVu },
      { type: 'THAM_NIEN', rate: seniorityYears, amount: phuCapThamNien },
      { type: 'UU_DAI_NGHE', rate: 0.3, amount: phuCapUuDaiNghe },
    ],
    bonusItems: [],
    deductionItems: [],
    teachingHours: {
      baseQuota: dinhMucGoc,
      reductionRatio: 0,
      adjustedQuota: dinhMucGoc,
      accumulatedStandardHours: totalActualTeachingHours,
      overQuotaHours: gioVuot,
      hourlyRate: configParams.don_gia_gio_chuan,
      overQuotaRemuneration: thuLaoVuotGio,
      advancedPayment: 0,
    },
    grossIncome,
    insurance: {
      socialInsurance: bhxh,
      healthInsurance: bhyt,
      unemploymentInsurance: bhtn,
      totalInsurance: tongBaoHiem,
    },
    personalIncomeTax: {
      personalDeduction: giamTruBanThan,
      dependentDeduction: giamTruPhuThuoc,
      taxableIncome: thuNhapTinhThue,
      taxAmount: tienThue,
    },
    netSalary,
    parameterSnapshot: snapshotThamSo,
    status: 'DU_THAO',
    lockedAt: null,
  };
};

/**
 * 1. Khởi tạo/Tính toán bảng lương tháng hàng loạt (Lập bảng lương dự thảo)
 */
const generateMonthlyPayroll = async ({ month, year, departmentId, currentUser }) => {
  const currentUserId = currentUser.id || currentUser._id;
  const role = (currentUser.role || '').toUpperCase();
  const isAdminOrHR = ['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG', 'HR'].includes(role);

  if (!isAdminOrHR && role !== 'TRUONG_KHOA' && role !== 'TRUONGKHOA') {
    throw new ServiceError('Bạn không có quyền khởi tạo bảng lương.', 403);
  }

  // Kiểm tra xem bảng lương tháng này đã bị khóa chưa
  const lockedCount = await Payroll.countDocuments({
    month: Number(month),
    year: Number(year),
    status: 'DA_KHOA',
  });

  if (lockedCount > 0) {
    throw new ServiceError(
      `Bảng lương tháng ${month}/${year} đã được khóa sổ, không thể tính toán lại. Vui lòng liên hệ Quản trị viên để mở khóa nếu cần điều chỉnh.`,
      403,
      'PAYROLL_LOCKED'
    );
  }

  // Xác định phạm vi người dùng cần tính lương
  let userQuery = { isActive: true };
  if (!isAdminOrHR) {
    const deanUserIds = await getDeanScopedUserIds(currentUser);
    userQuery._id = { $in: deanUserIds };
  } else if (departmentId) {
    userQuery.departmentId = departmentId;
  }

  const users = await User.find(userQuery);
  if (users.length === 0) {
    throw new ServiceError('Không tìm thấy cán bộ, giảng viên nào trong phạm vi được chọn.', 404);
  }

  const configParams = await getPayrollConfigParams();
  const createdPayrolls = [];

  for (const user of users) {
    const payrollData = await calculateUserPayroll({
      user,
      month,
      year,
      configParams,
      createdBy: currentUserId,
    });

    const payroll = await Payroll.findOneAndUpdate(
      { userId: user._id, month: Number(month), year: Number(year) },
      { $set: payrollData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    createdPayrolls.push(payroll);
  }

  await AuditLog.create({
    actor: currentUserId,
    action: 'GENERATE_PAYROLL',
    targetType: 'Payroll',
    targetId: `${year}-${month}`,
    details: `Tạo bảng lương tháng ${month}/${year} cho ${createdPayrolls.length} nhân sự.`,
    timestamp: new Date(),
  });

  return {
    month: Number(month),
    year: Number(year),
    totalCalculated: createdPayrolls.length,
    payrolls: createdPayrolls,
  };
};

/**
 * 2. Khóa lương tháng (Lock Payroll & Khóa Bảng Chấm Công)
 */
const lockMonthlyPayroll = async ({ month, year, currentUser, ip }) => {
  const currentUserId = currentUser.id || currentUser._id;
  const role = (currentUser.role || '').toUpperCase();
  const isAuthorized = ['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG'].includes(role);

  if (!isAuthorized) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Ban Giám Hiệu mới có quyền khóa bảng lương.', 403);
  }

  const m = Number(month);
  const y = Number(year);

  const existingCount = await Payroll.countDocuments({ month: m, year: y });
  if (existingCount === 0) {
    throw new ServiceError(`Không tìm thấy bảng lương tháng ${m}/${y} để khóa.`, 404);
  }

  const lockTime = new Date();

  // 1. Khóa toàn bộ phiếu lương
  const updatePayrollRes = await Payroll.updateMany(
    { month: m, year: y },
    {
      $set: {
        status: 'DA_KHOA',
        lockedAt: lockTime,
        approvedBy: currentUserId,
      },
    }
  );

  // 2. Tự động khóa toàn bộ các bản ghi AttendanceLog của tháng đó
  const monthStr = String(m).padStart(2, '0');
  const startDateStr = `${y}-${monthStr}-01`;
  const endDateStr = `${y}-${monthStr}-31`;

  const updateAttendanceRes = await AttendanceLog.updateMany(
    { workDate: { $gte: startDateStr, $lte: endDateStr } },
    { $set: { isLocked: true } }
  );

  await AuditLog.create({
    actor: currentUserId,
    action: 'LOCK_PAYROLL',
    targetType: 'Payroll',
    targetId: `${y}-${m}`,
    details: `Khóa sổ bảng lương tháng ${m}/${y} (${updatePayrollRes.modifiedCount} phiếu lương) và chốt công (${updateAttendanceRes.modifiedCount} ngày công).`,
    ipAddress: ip || null,
    timestamp: lockTime,
  });

  return {
    month: m,
    year: y,
    isLocked: true,
    lockedAt: lockTime,
    lockedPayrollsCount: updatePayrollRes.modifiedCount,
    lockedAttendanceLogsCount: updateAttendanceRes.modifiedCount,
    message: `Đã khóa sổ thành công bảng lương tháng ${m}/${y}.`,
  };
};

/**
 * 3. Mở khóa lương tháng (Unlock Payroll)
 */
const unlockMonthlyPayroll = async ({ month, year, reason, currentUser, ip }) => {
  const currentUserId = currentUser.id || currentUser._id;
  const role = (currentUser.role || '').toUpperCase();
  const isAuthorized = ['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG'].includes(role);

  if (!isAuthorized) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Ban Giám Hiệu mới có quyền mở khóa bảng lương.', 403);
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new ServiceError('Lý do mở khóa bảng lương là bắt buộc (tối thiểu 5 ký tự).', 400);
  }

  const m = Number(month);
  const y = Number(year);

  const updatePayrollRes = await Payroll.updateMany(
    { month: m, year: y },
    {
      $set: {
        status: 'DA_DUYET',
        lockedAt: null,
      },
    }
  );

  await AuditLog.create({
    actor: currentUserId,
    action: 'UNLOCK_PAYROLL',
    targetType: 'Payroll',
    targetId: `${y}-${m}`,
    details: `Mở khóa bảng lương tháng ${m}/${y}. Lý do: ${reason.trim()}`,
    ipAddress: ip || null,
    timestamp: new Date(),
  });

  return {
    month: m,
    year: y,
    isLocked: false,
    unlockedPayrollsCount: updatePayrollRes.modifiedCount,
    message: `Đã mở khóa thành công bảng lương tháng ${m}/${y}.`,
  };
};

/**
 * 4. Lấy danh sách bảng lương (Phân quyền: Cá nhân / Khoa / Toàn trường)
 */
const fetchPayrolls = async ({ month, year, departmentId, status, userId, currentUser }) => {
  const currentUserId = (currentUser.id || currentUser._id).toString();
  const role = (currentUser.role || '').toUpperCase();
  const query = {};

  if (month) query.month = Number(month);
  if (year) query.year = Number(year);
  if (status) query.status = status;

  if (['GIANG_VIEN', 'GIANGVIEN', 'NHAN_VIEN', 'NHANVIEN', 'CHUYEN_VIEN'].includes(role)) {
    query.userId = currentUserId;
  } else if (['TRUONG_KHOA', 'TRUONGKHOA', 'PHO_TRUONG_KHOA', 'PHOKHOA'].includes(role)) {
    const deanUserIds = await getDeanScopedUserIds(currentUser);
    if (userId) {
      if (!deanUserIds.includes(userId.toString())) {
        throw new ServiceError('Bạn không có quyền xem bảng lương của nhân sự ngoài khoa.', 403);
      }
      query.userId = userId;
    } else {
      query.userId = { $in: deanUserIds };
    }
  } else if (['ADMIN', 'HIEU_TRUONG', 'HIEUTRUONG', 'HR'].includes(role)) {
    if (userId) {
      query.userId = userId;
    } else if (departmentId) {
      const deptUsers = await User.find({ departmentId }).select('_id');
      query.userId = { $in: deptUsers.map((u) => u._id) };
    }
  }

  const payrolls = await Payroll.find(query)
    .populate('userId', 'fullName email role departmentId avatar staffCode')
    .populate('createdBy', 'fullName email')
    .populate('approvedBy', 'fullName email')
    .sort({ month: -1, year: -1, createdAt: -1 });

  return payrolls;
};

/**
 * 5. Lấy chi tiết phiếu lương cá nhân theo ID
 */
const fetchPayrollById = async (id, currentUser) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Mã phiếu lương (id) không hợp lệ.', 400);
  }

  const payroll = await Payroll.findById(id)
    .populate('userId', 'fullName email role departmentId avatar staffCode')
    .populate('createdBy', 'fullName email')
    .populate('approvedBy', 'fullName email');

  if (!payroll) {
    throw new ServiceError('Không tìm thấy phiếu lương.', 404);
  }

  const currentUserId = (currentUser.id || currentUser._id).toString();
  const role = (currentUser.role || '').toUpperCase();
  const ownerId = (payroll.userId?._id || payroll.userId).toString();

  if (['GIANG_VIEN', 'GIANGVIEN', 'NHAN_VIEN', 'NHANVIEN'].includes(role)) {
    if (ownerId !== currentUserId) {
      throw new ServiceError('Bạn chỉ có quyền xem phiếu lương của chính mình.', 403);
    }
  }

  return payroll;
};

/**
 * 6. Trích xuất cấu trúc dữ liệu xuất bảng lương Excel (Đầy đủ các cột)
 */
const exportPayrollExcelData = async ({ month, year, departmentId, currentUser }) => {
  const payrolls = await fetchPayrolls({ month, year, departmentId, currentUser });

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
    { key: 'taxableIncome', label: 'Thu Nhập Tính Thuế' },
    { key: 'pitTax', label: 'Thuế TNCN Lũy Tiến' },
    { key: 'netSalary', label: 'Thực Lĩnh (Net)' },
    { key: 'status', label: 'Trạng Thái' },
  ];

  const rows = payrolls.map((p, idx) => ({
    stt: idx + 1,
    code: p.userId?.staffCode || p.userId?.code || '',
    fullName: p.userId?.fullName || '',
    role: p.userId?.role || '',
    salaryCoefficient: p.salaryCoefficient,
    baseSalary: p.baseSalary,
    primarySalary: p.primarySalary,
    positionAllowance: p.positionAllowance,
    seniorityAllowance: p.seniorityAllowance,
    vocationalAllowance: p.vocationalAllowance,
    overtimeTeachingFee: p.teachingHours?.overQuotaRemuneration || 0,
    grossIncome: p.grossIncome,
    bhxh: p.insurance?.socialInsurance || 0,
    bhyt: p.insurance?.healthInsurance || 0,
    bhtn: p.insurance?.unemploymentInsurance || 0,
    totalInsurance: p.insurance?.totalInsurance || 0,
    taxableIncome: p.personalIncomeTax?.taxableIncome || 0,
    pitTax: p.personalIncomeTax?.taxAmount || 0,
    netSalary: p.netSalary,
    status: p.status,
  }));

  return {
    title: `BẢNG THANH TOÁN TIỀN LƯƠNG THÁNG ${month}/${year}`,
    month: Number(month),
    year: Number(year),
    totalEmployees: rows.length,
    headers,
    rows,
  };
};

/**
 * 7. Trích xuất dữ liệu phiếu lương cá nhân định dạng in ấn PDF
 */
const exportPayrollPdfData = async (id, currentUser) => {
  const payroll = await fetchPayrollById(id, currentUser);

  return {
    template: 'PAYROLL_SLIP_2026',
    schoolName: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG',
    title: `PHIẾU LƯƠNG CÁ NHÂN THÁNG ${payroll.month}/${payroll.year}`,
    employee: {
      fullName: payroll.userId?.fullName || '',
      email: payroll.userId?.email || '',
      code: payroll.userId?.staffCode || payroll.userId?.code || '',
      role: payroll.userId?.role || '',
    },
    salaryInfo: {
      salaryCoefficient: payroll.salaryCoefficient,
      baseSalary: payroll.baseSalary,
      primarySalary: payroll.primarySalary,
      positionAllowance: payroll.positionAllowance,
      seniorityAllowance: payroll.seniorityAllowance,
      vocationalAllowance: payroll.vocationalAllowance,
      overtimeHours: payroll.teachingHours?.overQuotaHours || 0,
      overtimePayment: payroll.teachingHours?.overQuotaRemuneration || 0,
      grossIncome: payroll.grossIncome,
    },
    deductions: {
      bhxh: payroll.insurance?.socialInsurance || 0,
      bhyt: payroll.insurance?.healthInsurance || 0,
      bhtn: payroll.insurance?.unemploymentInsurance || 0,
      totalInsurance: payroll.insurance?.totalInsurance || 0,
      taxableIncome: payroll.personalIncomeTax?.taxableIncome || 0,
      incomeTax: payroll.personalIncomeTax?.taxAmount || 0,
    },
    netSalary: payroll.netSalary,
    isLocked: payroll.status === 'DA_KHOA',
    lockedAt: payroll.lockedAt,
    approvedBy: payroll.approvedBy?.fullName || 'BAN GIÁM HIỆU',
    generatedAt: new Date(),
  };
};

module.exports = {
  ServiceError,
  calculatePersonalIncomeTax5Brackets,
  getPayrollConfigParams,
  calculateUserPayroll,
  generateMonthlyPayroll,
  lockMonthlyPayroll,
  unlockMonthlyPayroll,
  fetchPayrolls,
  fetchPayrollById,
  exportPayrollExcelData,
  exportPayrollPdfData,
};
