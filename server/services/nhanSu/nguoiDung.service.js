// Quản lý tài khoản nhân sự, hồ sơ cán bộ, vai trò theo khoa và khóa mềm tài khoản.
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  PhongBan,
  LichTrinh,
  NgoaiLeLichTrinh,
  MauKhuonMat,
  MaLamMoi,
  NhatKyKiemToan,
} = require('../../models');
const {
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
} = require('../khuonMat/mauKhuonMat.service');
const { getDeanDepartmentIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { ALL_ROLES, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole, hasAnyActiveRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const hoTroChamCong = require('../../utils/hoTroChamCong');
const ketNoiDichVuKhuonMat = require('../khuonMat/ketNoiDichVuKhuonMat');
const { normalizeSafeAvatarUrl } = require('../heThong/taiTep.service');
const ServiceError = require('../../utils/loiNghiepVu');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^(0|\+84)\d{9,10}$/;
const CCCD_REGEX = /^\d{9}$|^\d{12}$/;
const TAX_CODE_REGEX = /^\d{10}(\d{3})?$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VISITING_CONTRACT_TYPES = ['thinh_giang', 'hop_dong_vu_viec'];
const VALID_GENDERS = ['nam', 'nu', 'khac'];
const VALID_ACADEMIC_RANKS = ['khong', 'pho_giao_su', 'giao_su'];
const VALID_DEGREES = ['cu_nhan', 'ky_su', 'thac_si', 'tien_si', 'khac'];
const VALID_STAFF_TYPES = ['giang_vien', 'can_bo_quan_ly', 'chuyen_vien', 'nhan_vien'];
const VALID_CONTRACT_TYPES = ['toan_thoi_gian', 'ban_thoi_gian', 'thinh_giang', 'hop_dong_vu_viec'];
const VALID_EMPLOYMENT_STATUSES = ['dang_lam_viec', 'tam_nghi', 'da_nghi_viec'];
const VALID_ROLE_SCOPES = ['toan_truong', 'khoa', 'bo_mon', 'phong_ban'];
const GLOBAL_SCOPE_ROLES = new Set(['admin', 'bgh', 'tccb', 'dao_tao', 'ke_toan']);
const UNIT_SCOPED_ROLES = new Set([
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
  'giang_vien',
]);
const DEPUTY_DELEGATION_ROLES = new Set(['pho_khoa', 'pho_bo_mon', 'pho_phong']);
const UNIT_HEAD_ROLES = new Set(['truong_khoa', 'truong_bo_mon', 'truong_phong']);
const MAX_EXCEL_IMPORT_ROWS = 200;

// Chuẩn hóa giá trị DATEONLY / Date sang chuỗi YYYY-MM-DD an toàn cho client & <input type="date">
const formatDateOnlyOutput = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Kiểm tra định dạng và tính hợp lệ logic của các trường liên hệ, ngày tháng, thuế & ngân hàng
const validateProfileDatesAndContacts = ({
  so_dien_thoai,
  so_cccd,
  ma_so_thue,
  so_tai_khoan_ngan_hang,
  ten_ngan_hang,
  ngay_sinh,
  ngay_vao_lam,
  ngay_bat_dau_giang_day,
  ngay_het_han_hop_dong,
  todayVn,
}) => {
  if (so_dien_thoai !== undefined && so_dien_thoai !== null && String(so_dien_thoai).trim() !== '') {
    const cleanPhone = String(so_dien_thoai).replace(/[\s.-]/g, '').trim();
    if (!PHONE_REGEX.test(cleanPhone)) {
      throw new ServiceError('Số điện thoại không hợp lệ (cần 10–11 số bắt đầu bằng 0 hoặc +84).', 400);
    }
  }
  if (so_cccd !== undefined && so_cccd !== null && String(so_cccd).trim() !== '') {
    const cleanCccd = String(so_cccd).trim();
    if (!CCCD_REGEX.test(cleanCccd)) {
      throw new ServiceError('Số CCCD / CMND phải gồm đúng 9 hoặc 12 chữ số.', 400);
    }
  }
  if (ma_so_thue !== undefined && ma_so_thue !== null && String(ma_so_thue).trim() !== '') {
    const cleanTax = String(ma_so_thue).trim();
    if (!TAX_CODE_REGEX.test(cleanTax)) {
      throw new ServiceError('Mã số thuế cá nhân phải gồm đúng 10 hoặc 13 chữ số.', 400);
    }
  }

  const hasBankAccount = Boolean(so_tai_khoan_ngan_hang && String(so_tai_khoan_ngan_hang).trim() !== '');
  const hasBankName = Boolean(ten_ngan_hang && String(ten_ngan_hang).trim() !== '');
  if (hasBankAccount && !hasBankName) {
    throw new ServiceError('Vui lòng nhập tên ngân hàng tương ứng với số tài khoản.', 400);
  }
  if (hasBankName && !hasBankAccount) {
    throw new ServiceError('Vui lòng nhập số tài khoản ngân hàng khi đã điền tên ngân hàng.', 400);
  }

  const checkIso = (raw, label) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const str = String(raw).trim().slice(0, 10);
    if (!ISO_DATE_REGEX.test(str)) {
      throw new ServiceError(`${label} phải đúng định dạng YYYY-MM-DD.`, 400);
    }
    return str;
  };

  const normDob = checkIso(ngay_sinh, 'Ngày sinh');
  const normJoin = checkIso(ngay_vao_lam, 'Ngày vào làm');
  const normTeach = checkIso(ngay_bat_dau_giang_day, 'Ngày bắt đầu giảng dạy');
  const normExpiry = checkIso(ngay_het_han_hop_dong, 'Ngày hết hạn hợp đồng');

  if (normDob && normDob > todayVn) {
    throw new ServiceError('Ngày sinh không được lớn hơn ngày hiện tại.', 400);
  }
  if (normTeach && normTeach > todayVn) {
    throw new ServiceError('Ngày bắt đầu giảng dạy không được lớn hơn ngày hiện tại.', 400);
  }
  if (normTeach && normDob && normTeach <= normDob) {
    throw new ServiceError('Ngày bắt đầu giảng dạy phải sau ngày sinh.', 400);
  }
  if (normExpiry && normJoin && normExpiry < normJoin) {
    throw new ServiceError('Ngày hết hạn hợp đồng phải sau hoặc bằng ngày vào làm.', 400);
  }

  return { normDob, normJoin, normTeach, normExpiry };
};

// Lấy ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD)
const getTodayVietnamDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Mở rộng danh sách đơn vị gồm đơn vị gốc và các bộ môn con trực thuộc
const expandDepartmentIds = async (rootDeptId) => {
  const allIds = [String(rootDeptId)];
  let currentParents = [String(rootDeptId)];
  while (currentParents.length > 0) {
    const children = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: currentParents } },
      attributes: ['id'],
      raw: true,
    });
    const nextIds = children.map((c) => String(c.id)).filter((id) => !allIds.includes(id));
    if (nextIds.length === 0) break;
    allIds.push(...nextIds);
    currentParents = nextIds;
  }
  return allIds;
};

// Thu hồi grace tokens trên Redis sau khi vô hiệu hóa tài khoản / đổi mật khẩu
const revokeGraceTokensSafe = async (userId) => {
  const { revokeUserGraceTokens } = require('../heThong/xacThuc.service');
  await revokeUserGraceTokens(userId).catch(() => {});
};

// Gỡ vector sinh trắc học khỏi RAM AI Service và xóa cache bộ nhớ đệm
const purgeUserBiometricsCache = async (userId) => {
  await ketNoiDichVuKhuonMat.removeFaissTemplate(String(userId)).catch(() => {});
  await Promise.resolve(hoTroChamCong.invalidateFaceCache()).catch(() => {});
};

// Tạo mảng vai trò mặc định tương ứng với vai trò chính và đơn vị
const buildDefaultRolesArray = (roleStr, don_vi_id = null, deptType = null) => {
  const norm = normalizeRole(roleStr);
  if (GLOBAL_SCOPE_ROLES.has(norm)) {
    return [{ ma_vai_tro: norm, pham_vi: 'toan_truong', don_vi_id: null }];
  }

  let pham_vi;
  if (['truong_khoa', 'pho_khoa'].includes(norm)) {
    pham_vi = 'khoa';
  } else if (['truong_bo_mon', 'pho_bo_mon'].includes(norm)) {
    pham_vi = 'bo_mon';
  } else if (['truong_phong', 'pho_phong'].includes(norm)) {
    pham_vi = 'phong_ban';
  } else if (deptType && VALID_ROLE_SCOPES.includes(deptType) && deptType !== 'toan_truong') {
    pham_vi = deptType;
  } else if (norm === 'nhan_vien') {
    pham_vi = don_vi_id ? 'phong_ban' : 'toan_truong';
  } else {
    pham_vi = don_vi_id ? 'khoa' : 'toan_truong';
  }

  return [{ ma_vai_tro: norm, pham_vi, don_vi_id: pham_vi === 'toan_truong' ? null : (don_vi_id || null) }];
};

// Kiểm tra ràng buộc loại đơn vị (Khoa/Bộ môn/Phòng ban/Ban Giám Hiệu) phù hợp với vai trò
const validateDepartmentRoleRule = async (roleVal, deptId) => {
  if (!deptId) return null;
  if (!isValidUuid(deptId)) {
    throw new ServiceError('Mã đơn vị không đúng định dạng UUID.', 400);
  }
  const dept = await PhongBan.findByPk(deptId);
  if (!dept) throw new ServiceError('Khoa/Phòng ban không tồn tại trên hệ thống.', 400);

  const isBghDept = (dept.ten_phong_ban || '').toLowerCase().includes('giám hiệu');
  const deptType = dept.loai_don_vi;

  if (roleVal === 'bgh' && !isBghDept) {
    throw new ServiceError('Cán bộ có vai trò Ban Giám Hiệu (BGH) bắt buộc phải thuộc đơn vị Ban Giám Hiệu.', 400);
  }
  if (['truong_khoa', 'pho_khoa'].includes(roleVal) && deptType !== 'khoa') {
    throw new ServiceError('Trưởng Khoa / Phó Trưởng Khoa bắt buộc phải thuộc đơn vị cấp Khoa.', 400);
  }
  if (['truong_bo_mon', 'pho_bo_mon'].includes(roleVal) && deptType !== 'bo_mon') {
    throw new ServiceError('Trưởng Bộ Môn / Phó Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
  }
  if (['truong_phong', 'pho_phong', 'tccb', 'dao_tao', 'ke_toan'].includes(roleVal) && deptType !== 'phong_ban') {
    throw new ServiceError('Vai trò khối phòng ban / chức năng bắt buộc phải thuộc đơn vị cấp Phòng ban.', 400);
  }
  if (roleVal === 'giang_vien' && !['bo_mon', 'khoa'].includes(deptType)) {
    throw new ServiceError('Giảng viên bắt buộc phải trực thuộc một Khoa hoặc Bộ Môn đào tạo.', 400);
  }
  if (roleVal === 'admin' && (deptType === 'khoa' || deptType === 'bo_mon')) {
    throw new ServiceError('Quản trị viên hệ thống (Admin) phải thuộc Hội Đồng Trường hoặc các Ban chức năng NTU, không thuộc Khoa/Bộ môn đào tạo.', 400);
  }
  if (isBghDept && !['bgh', 'admin'].includes(roleVal)) {
    throw new ServiceError('Đơn vị Ban Giám Hiệu chỉ dành cho nhân sự thuộc Ban Giám Hiệu hoặc Quản trị viên.', 400);
  }
  return dept;
};

// Kiểm tra chuỗi ngày YYYY-MM-DD có tồn tại thực tế trên lịch dương hay không
const isValidIsoCalendarDate = (isoStr) => {
  if (!ISO_DATE_REGEX.test(isoStr)) return false;
  const [y, m, d] = isoStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// Kiểm tra và chuẩn hóa danh sách vai trò kiêm nhiệm (khử trùng lặp, khớp loại đơn vị, khóa ủy quyền & ngày hiệu lực)
const normalizeAndValidateRoleRows = async (roleList, fallbackRole, fallbackDeptId) => {
  const normPrimaryRole = normalizeRole(fallbackRole);
  const normalizedPrimaryDeptId = GLOBAL_SCOPE_ROLES.has(normPrimaryRole)
    ? null
    : (fallbackDeptId ? String(fallbackDeptId) : null);

  const seen = new Set();
  const normalizedRows = [];

  for (const r of roleList) {
    if (!r || typeof r !== 'object') {
      throw new ServiceError('Dữ liệu vai trò không hợp lệ.', 400);
    }
    const maVaiTro = normalizeRole(r.ma_vai_tro || fallbackRole);
    if (!maVaiTro || !ALL_ROLES.includes(maVaiTro)) {
      throw new ServiceError(`Mã vai trò "${r.ma_vai_tro || ''}" không hợp lệ.`, 400);
    }

    const rawScope = r.pham_vi !== undefined && r.pham_vi !== null && String(r.pham_vi).trim() !== ''
      ? String(r.pham_vi).trim().toLowerCase()
      : '';
    if (rawScope && !VALID_ROLE_SCOPES.includes(rawScope)) {
      throw new ServiceError(`Phạm vi vai trò "${r.pham_vi}" không hợp lệ.`, 400);
    }

    const isGlobalRole = GLOBAL_SCOPE_ROLES.has(maVaiTro);
    const isUnitScopedRole = UNIT_SCOPED_ROLES.has(maVaiTro);

    if (isUnitScopedRole && rawScope === 'toan_truong') {
      throw new ServiceError(
        `Vai trò "${maVaiTro}" thuộc cấp đơn vị, không được gán phạm vi toàn trường.`,
        400
      );
    }

    let phamVi;
    let donViId;

    if (isGlobalRole) {
      phamVi = 'toan_truong';
      donViId = null;
    } else {
      const rawDeptId = r.don_vi_id !== undefined ? r.don_vi_id : fallbackDeptId;
      const candidateDeptId = rawScope === 'toan_truong' ? null : (rawDeptId ? String(rawDeptId).trim() : null);

      if (isUnitScopedRole && !candidateDeptId) {
        throw new ServiceError(`Vai trò "${maVaiTro}" bắt buộc phải chọn đơn vị áp dụng.`, 400);
      }
      if (rawScope && rawScope !== 'toan_truong' && !candidateDeptId) {
        throw new ServiceError(`Vai trò có phạm vi "${rawScope}" bắt buộc phải chọn đơn vị áp dụng.`, 400);
      }

      if (candidateDeptId) {
        const dept = await validateDepartmentRoleRule(maVaiTro, candidateDeptId);
        const actualDeptScope = dept?.loai_don_vi || null;
        if (rawScope && actualDeptScope && rawScope !== actualDeptScope) {
          throw new ServiceError(
            `Phạm vi vai trò "${rawScope}" không khớp với loại đơn vị "${actualDeptScope}" của đơn vị đã chọn.`,
            400
          );
        }
        phamVi = actualDeptScope || rawScope || 'khoa';
        donViId = candidateDeptId;
      } else {
        phamVi = 'toan_truong';
        donViId = null;
      }
    }

    // Chặn gán admin và các chức danh Trưởng đơn vị dưới dạng vai trò kiêm nhiệm
    const isPrimaryRow =
      maVaiTro === normPrimaryRole &&
      String(donViId || '') === String(normalizedPrimaryDeptId || '');
    if (!isPrimaryRow) {
      if (maVaiTro === 'admin') {
        throw new ServiceError(
          'Không được phép gán vai trò Quản trị Hệ thống (admin) dưới dạng vai trò kiêm nhiệm.',
          400
        );
      }
      if (UNIT_HEAD_ROLES.has(maVaiTro)) {
        throw new ServiceError(
          'Không được gán vai trò Trưởng đơn vị tại mục kiêm nhiệm. Vui lòng bổ nhiệm tại trang Cơ cấu tổ chức / Phòng ban.',
          400
        );
      }
    }

    // Kiểm tra ngày hiệu lực (định dạng YYYY-MM-DD & den_ngay >= tu_ngay)
    let tuNgay = getTodayVietnamDate();
    if (r.tu_ngay !== undefined && r.tu_ngay !== null && String(r.tu_ngay).trim() !== '') {
      const rawTu = r.tu_ngay instanceof Date ? formatDateOnlyOutput(r.tu_ngay) : String(r.tu_ngay).trim();
      if (!rawTu || !isValidIsoCalendarDate(rawTu)) {
        throw new ServiceError('Ngày bắt đầu hiệu lực vai trò (tu_ngay) không đúng định dạng YYYY-MM-DD.', 400);
      }
      tuNgay = rawTu;
    }

    let denNgay = null;
    if (r.den_ngay !== undefined && r.den_ngay !== null && String(r.den_ngay).trim() !== '') {
      const rawDen = r.den_ngay instanceof Date ? formatDateOnlyOutput(r.den_ngay) : String(r.den_ngay).trim();
      if (!rawDen || !isValidIsoCalendarDate(rawDen)) {
        throw new ServiceError('Ngày kết thúc hiệu lực vai trò (den_ngay) không đúng định dạng YYYY-MM-DD.', 400);
      }
      if (rawDen < tuNgay) {
        throw new ServiceError('Ngày kết thúc hiệu lực vai trò phải lớn hơn hoặc bằng ngày bắt đầu.', 400);
      }
      denNgay = rawDen;
    }

    const dedupKey = `${maVaiTro}::${donViId || 'ALL'}`;
    if (seen.has(dedupKey)) {
      throw new ServiceError(`Danh sách vai trò bị trùng lặp vai trò "${maVaiTro}" trong cùng đơn vị.`, 400);
    }
    seen.add(dedupKey);

    normalizedRows.push({
      ma_vai_tro: maVaiTro,
      pham_vi: phamVi,
      don_vi_id: donViId,
      duoc_uy_quyen: DEPUTY_DELEGATION_ROLES.has(maVaiTro) ? Boolean(r.duoc_uy_quyen) : false,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
    });
  }

  return normalizedRows;
};

// Kiểm tra tính hợp lệ của các trường số trong hồ sơ cán bộ
const validateProfileNumericFields = ({ he_so_luong, so_nguoi_phu_thuoc, han_muc_phep_nam }, contractType) => {
  if (he_so_luong !== undefined) {
    const val = Number(he_so_luong);
    const isVisiting = VISITING_CONTRACT_TYPES.includes(contractType);
    if (!Number.isFinite(val) || val > 30 || (isVisiting ? val < 0 : val <= 0)) {
      throw new ServiceError(
        isVisiting
          ? 'Hệ số lương hợp đồng thỉnh giảng/vụ việc phải là số hợp lệ (>= 0 và <= 30).'
          : 'Hệ số lương phải là số dương hợp lệ (> 0 và <= 30).',
        400
      );
    }
  }
  if (so_nguoi_phu_thuoc !== undefined) {
    const val = Number(so_nguoi_phu_thuoc);
    if (!Number.isInteger(val) || val < 0 || val > 50) {
      throw new ServiceError('Số người phụ thuộc phải là số nguyên không âm (0 - 50).', 400);
    }
  }
  if (han_muc_phep_nam !== undefined) {
    const val = Number(han_muc_phep_nam);
    if (!Number.isInteger(val) || val < 0 || val > 365) {
      throw new ServiceError('Hạn mức phép năm phải là số nguyên hợp lệ (0 - 365).', 400);
    }
  }
};

const USER_INCLUDES = [
  { model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'don_vi_cha_id'] },
  { model: HoSoCanBo, as: 'ho_so' },
  {
    model: VaiTroNguoiDung,
    as: 'danh_sach_vai_tro',
    include: [{ model: PhongBan, as: 'don_vi', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] }],
  },
];

// Gộp dữ liệu tài khoản, hồ sơ cán bộ và trạng thái Face ID để trả về client
const formatUserDetail = (userInstance, faceTemplate = null) => {
  const raw =
    typeof userInstance.get === 'function'
      ? userInstance.get({ plain: true })
      : userInstance.toJSON
        ? userInstance.toJSON()
        : { ...userInstance };
  delete raw.mat_khau_ma_hoa;
  const rawProfile =
    raw.ho_so && typeof raw.ho_so === 'object'
      ? typeof raw.ho_so.get === 'function'
        ? raw.ho_so.get({ plain: true })
        : typeof raw.ho_so.toJSON === 'function'
          ? raw.ho_so.toJSON()
          : { ...raw.ho_so }
      : {};
  const profile = { ...rawProfile };
  delete profile.id;
  delete profile.nguoi_dung_id;
  delete profile.tao_luc;
  delete profile.cap_nhat_luc;
  const deptObj = raw.don_vi_chinh || null;
  const isRegistered = Boolean(faceTemplate);

  return {
    ...profile,
    ...raw,
    id: raw.id,
    ho_ten: raw.ho_ten || '',
    ma_can_bo: raw.ma_can_bo || '',
    so_dien_thoai: raw.so_dien_thoai || '',
    vai_tro_chinh: normalizeRole(raw.vai_tro_chinh),
    don_vi_chinh_id: raw.don_vi_chinh_id || deptObj?.id || null,
    don_vi_chinh: deptObj,
    ten_phong_ban: deptObj?.ten_phong_ban || '',
    hoc_ham: profile.hoc_ham || 'khong',
    hoc_vi: profile.hoc_vi || 'cu_nhan',
    loai_nhan_su: profile.loai_nhan_su || 'giang_vien',
    loai_hop_dong: profile.loai_hop_dong || 'toan_thoi_gian',
    gioi_tinh: profile.gioi_tinh || 'nam',
    ngay_sinh: formatDateOnlyOutput(profile.ngay_sinh),
    ngay_vao_lam: formatDateOnlyOutput(profile.ngay_vao_lam),
    ngay_bat_dau_giang_day: formatDateOnlyOutput(profile.ngay_bat_dau_giang_day),
    ngay_het_han_hop_dong: formatDateOnlyOutput(profile.ngay_het_han_hop_dong),
    trang_thai_lam_viec: raw.trang_thai_lam_viec || 'dang_lam_viec',
    anh_dai_dien: raw.anh_dai_dien || null,
    tham_nien_nam: userInstance.ho_so?.tham_nien_nam ?? 0,
    da_dang_ky_face: isRegistered,
    ngay_dang_ky_face: faceTemplate?.ngay_dang_ky || null,
    so_luong_mau: faceTemplate?.so_luong_mau || 0,
    mo_hinh_ai: isRegistered ? (faceTemplate?.mo_hinh_ai || 'buffalo_s') : null,
    so_chieu_vector: isRegistered ? (faceTemplate?.so_chieu_vector || 512) : null,
    mac_dinh: isRegistered ? Boolean(faceTemplate?.mac_dinh ?? true) : false,
    trang_thai_khuon_mat: isRegistered ? (faceTemplate?.trang_thai || 'da_kich_hoat') : null,
    anh_khuon_mat: isRegistered ? (faceTemplate?.anh_dai_dien || null) : null,
  };
};

// Lấy danh sách ID người dùng thuộc tập đơn vị (bao gồm đơn vị chính và vai trò kiêm nhiệm còn hiệu lực)
const resolveUserIdsInDepartments = async (departmentIds) => {
  const todayKey = getTodayVietnamDate();
  const [directUsers, roleUsers] = await Promise.all([
    NguoiDung.findAll({
      where: { don_vi_chinh_id: { [Op.in]: departmentIds } },
      attributes: ['id'],
      raw: true,
    }),
    VaiTroNguoiDung.findAll({
      where: {
        don_vi_id: { [Op.in]: departmentIds },
        tu_ngay: { [Op.lte]: todayKey },
        [Op.or]: [{ den_ngay: null }, { den_ngay: { [Op.gte]: todayKey } }],
      },
      attributes: ['nguoi_dung_id'],
      raw: true,
    }),
  ]);
  return new Set([
    ...directUsers.map((u) => String(u.id)),
    ...roleUsers.map((r) => String(r.nguoi_dung_id)),
  ]);
};

// Lấy danh sách người dùng có phân trang, tìm kiếm và lọc theo đơn vị (đệ quy), vai trò đa nhiệm
const fetchUsers = async ({ vai_tro, don_vi_id, kich_hoat, tim_kiem, page = 1, limit = 20, trang, gioi_han, currentUser }) => {
  const where = {};
  const isUnitLeaderOnly = hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES) && !hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);

  let scopedIdSet = null;

  if (isUnitLeaderOnly) {
    const departmentIds = await getDeanDepartmentIds(currentUser);
    if (!departmentIds.length) {
      throw new ServiceError('Tài khoản Lãnh đạo đơn vị chưa được gán mã khoa / phòng ban trực thuộc.', 403);
    }
    if (don_vi_id) {
      if (!isValidUuid(don_vi_id)) {
        throw new ServiceError('Mã đơn vị không hợp lệ.', 400);
      }
      const allowedSet = new Set(departmentIds.map(String));
      if (!allowedSet.has(String(don_vi_id))) {
        throw new ServiceError('Bạn không có quyền xem nhân sự ngoài đơn vị quản lý.', 403);
      }
      const expandedDeptIds = await expandDepartmentIds(don_vi_id);
      const scopedChildIds = expandedDeptIds.filter((deptId) => allowedSet.has(String(deptId)));
      scopedIdSet = await resolveUserIdsInDepartments(scopedChildIds.length > 0 ? scopedChildIds : [String(don_vi_id)]);
    } else {
      scopedIdSet = await resolveUserIdsInDepartments(departmentIds);
    }
  } else if (don_vi_id) {
    if (!isValidUuid(don_vi_id)) {
      throw new ServiceError('Mã đơn vị không hợp lệ.', 400);
    }
    const expandedDeptIds = await expandDepartmentIds(don_vi_id);
    scopedIdSet = await resolveUserIdsInDepartments(expandedDeptIds);
  }

  if (vai_tro) {
    const normRole = normalizeRole(vai_tro);
    const todayKey = getTodayVietnamDate();
    const [primaryRoleUsers, multiRoleUsers] = await Promise.all([
      NguoiDung.findAll({ where: { vai_tro_chinh: normRole }, attributes: ['id'], raw: true }),
      VaiTroNguoiDung.findAll({
        where: {
          ma_vai_tro: normRole,
          tu_ngay: { [Op.lte]: todayKey },
          [Op.or]: [{ den_ngay: null }, { den_ngay: { [Op.gte]: todayKey } }],
        },
        attributes: ['nguoi_dung_id'],
        raw: true,
      }),
    ]);
    const roleMatchSet = new Set([
      ...primaryRoleUsers.map((u) => String(u.id)),
      ...multiRoleUsers.map((r) => String(r.nguoi_dung_id)),
    ]);
    scopedIdSet = scopedIdSet
      ? new Set([...scopedIdSet].filter((uid) => roleMatchSet.has(uid)))
      : roleMatchSet;
  }

  if (scopedIdSet !== null) {
    where.id = { [Op.in]: Array.from(scopedIdSet) };
  }

  if (kich_hoat !== undefined && kich_hoat !== '') {
    where.kich_hoat = kich_hoat === 'true' || kich_hoat === true;
  }

  if (tim_kiem && tim_kiem.trim()) {
    const likePattern = `%${tim_kiem.trim()}%`;
    where[Op.or] = [
      { ho_ten: { [Op.like]: likePattern } },
      { email: { [Op.like]: likePattern } },
      { ma_can_bo: { [Op.like]: likePattern } },
    ];
  }

  const { page: pageNum, limit: limitNum, offset } = normalizePagination(trang ?? page, gioi_han ?? limit, 100);

  const { count: total, rows: users } = await NguoiDung.findAndCountAll({
    where,
    include: USER_INCLUDES,
    order: [['tao_luc', 'DESC']],
    offset,
    limit: limitNum,
    distinct: true,
  });

  const userIds = users.map((u) => u.id);
  const templates = userIds.length
    ? await MauKhuonMat.findAll({
        where: { nguoi_dung_id: { [Op.in]: userIds }, mac_dinh: true },
        attributes: ['nguoi_dung_id', 'ngay_dang_ky', 'so_luong_mau', 'anh_dai_dien', 'mo_hinh_ai', 'so_chieu_vector', 'mac_dinh', 'trang_thai'],
      })
    : [];

  const templateMap = new Map(templates.map((t) => [String(t.nguoi_dung_id), t]));
  const mappedUsers = users.map((u) => formatUserDetail(u, templateMap.get(String(u.id)) || null));

  return {
    users: mappedUsers,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

// Xem chi tiết một người dùng
const fetchUserById = async (id, currentUser) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  const user = await NguoiDung.findByPk(id, { include: USER_INCLUDES });
  if (!user) {
    throw new ServiceError('Không tìm thấy thông tin người dùng.', 404);
  }

  const isSelf = String(currentUser.id) === String(id);
  const isUnitLeaderOnly = hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES) && !hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);
  if (!isSelf && isUnitLeaderOnly) {
    const inScope = await isUserInDeanScope(currentUser, id);
    if (!inScope) {
      throw new ServiceError('Bạn không có quyền xem thông tin nhân sự ngoài phạm vi quản lý của đơn vị.', 403);
    }
  }

  const template = await MauKhuonMat.findOne({
    where: { nguoi_dung_id: user.id, mac_dinh: true },
    attributes: ['ngay_dang_ky', 'so_luong_mau', 'anh_dai_dien', 'mo_hinh_ai', 'so_chieu_vector', 'mac_dinh', 'trang_thai'],
  });

  return formatUserDetail(user, template);
};

// Trích xuất danh sách mã vai trò chuẩn hóa từ yêu cầu tạo/cập nhật tài khoản
const extractRequestedRoleCodes = (primaryRole, roleList) => {
  const roles = [];
  if (primaryRole !== undefined && primaryRole !== null) {
    const code = normalizeRole(primaryRole);
    if (code) roles.push(code);
  }
  if (Array.isArray(roleList)) {
    for (const item of roleList) {
      const rawCode = typeof item === 'object' && item !== null ? item.ma_vai_tro : item;
      const code = normalizeRole(rawCode);
      if (code) roles.push(code);
    }
  }
  return roles;
};

// Kiểm tra người thực hiện có đủ thẩm quyền gán các vai trò cấp cao (bgh, admin)
const assertRoleAssignmentAllowed = (currentUser, requestedRoles) => {
  const activeRoles = getActiveUserRoles(currentUser);
  const isTopAdmin = activeRoles.has('admin') || activeRoles.has('bgh');

  if (!activeRoles.has('bgh') && requestedRoles.includes('bgh')) {
    throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền gán vai trò Ban Giám Hiệu.', 403);
  }
  if (!isTopAdmin && requestedRoles.includes('admin')) {
    throw new ServiceError('Chỉ Quản trị viên hoặc Ban Giám Hiệu mới có quyền gán vai trò Quản trị viên.', 403);
  }
};

// Kiểm tra & chuẩn hóa dữ liệu tạo tài khoản nhân sự trước khi ghi DB
const prepareNewUserRecords = async (data, currentUser) => {
  const finalName = (data.ho_ten || '').trim();
  const finalEmail = (data.email || '').trim().toLowerCase();
  const finalStaffCode = (data.ma_can_bo || '').trim().toUpperCase();
  const finalRole = normalizeRole(data.vai_tro_chinh || 'giang_vien');
  const finalDeptId = data.don_vi_chinh_id || null;
  const password = data.mat_khau;
  const finalContractType = String(data.loai_hop_dong || 'toan_thoi_gian').toLowerCase().trim();
  const finalGender = String(data.gioi_tinh || 'nam').toLowerCase().trim();
  const finalAcademicRank = String(data.hoc_ham || 'khong').toLowerCase().trim();
  const finalDegree = String(data.hoc_vi || 'cu_nhan').toLowerCase().trim();
  const finalStaffType = String(
    data.loai_nhan_su || (finalRole === 'giang_vien' ? 'giang_vien' : 'nhan_vien')
  )
    .toLowerCase()
    .trim();
  const finalWorkStatus = String(data.trang_thai_lam_viec || 'dang_lam_viec').toLowerCase().trim();
  const cleanPhone = data.so_dien_thoai ? String(data.so_dien_thoai).replace(/[\s.-]/g, '').trim() : null;
  const cleanCccd = data.so_cccd ? String(data.so_cccd).trim() : null;

  const requestedRoles = extractRequestedRoleCodes(finalRole, data.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!finalName || finalName.length < 2) {
    throw new ServiceError('Họ tên phải có ít nhất 2 ký tự.', 400);
  }
  if (!finalEmail || !EMAIL_REGEX.test(finalEmail)) {
    throw new ServiceError('Địa chỉ email không hợp lệ.', 400);
  }
  if (!finalStaffCode) {
    throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
  }
  if (!password || String(password).length < 6) {
    throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
  }
  if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
    throw new ServiceError('Số điện thoại không hợp lệ (cần 10–11 số bắt đầu bằng 0 hoặc +84).', 400);
  }
  if (cleanCccd && !CCCD_REGEX.test(cleanCccd)) {
    throw new ServiceError('Số CCCD / CMND phải gồm đúng 9 hoặc 12 chữ số.', 400);
  }
  if (!VALID_GENDERS.includes(finalGender)) {
    throw new ServiceError('Giới tính phải là một trong: nam, nu, khac.', 400);
  }
  if (!VALID_ACADEMIC_RANKS.includes(finalAcademicRank)) {
    throw new ServiceError('Học hàm phải là một trong: khong, pho_giao_su, giao_su.', 400);
  }
  if (!VALID_DEGREES.includes(finalDegree)) {
    throw new ServiceError('Học vị phải là một trong: cu_nhan, ky_su, thac_si, tien_si, khac.', 400);
  }
  if (!VALID_STAFF_TYPES.includes(finalStaffType)) {
    throw new ServiceError('Loại nhân sự phải là một trong: giang_vien, can_bo_quan_ly, chuyen_vien, nhan_vien.', 400);
  }
  if (!VALID_CONTRACT_TYPES.includes(finalContractType)) {
    throw new ServiceError('Loại hợp đồng không hợp lệ.', 400);
  }
  if (!VALID_EMPLOYMENT_STATUSES.includes(finalWorkStatus)) {
    throw new ServiceError('Trạng thái làm việc không hợp lệ.', 400);
  }
  const todayVn = getTodayVietnamDate();
  const {
    normDob: finalNgaySinh,
    normJoin: parsedNgayVaoLam,
    normTeach: finalNgayGiangDay,
    normExpiry: finalNgayHetHan,
  } = validateProfileDatesAndContacts({
    so_dien_thoai: cleanPhone,
    so_cccd: cleanCccd,
    ma_so_thue: data.ma_so_thue,
    so_tai_khoan_ngan_hang: data.so_tai_khoan_ngan_hang,
    ten_ngan_hang: data.ten_ngan_hang,
    ngay_sinh: data.ngay_sinh,
    ngay_vao_lam: data.ngay_vao_lam || todayVn,
    ngay_bat_dau_giang_day: data.ngay_bat_dau_giang_day,
    ngay_het_han_hop_dong: data.ngay_het_han_hop_dong,
    todayVn,
  });
  const finalNgayVaoLam = parsedNgayVaoLam || todayVn;

  if (data.anh_dai_dien !== undefined && data.anh_dai_dien !== null && String(data.anh_dai_dien).trim() !== '') {
    throw new ServiceError(
      'Tài khoản tạo mới luôn sử dụng ảnh đại diện mặc định. Cán bộ sẽ tự cập nhật ảnh tại Hồ sơ cá nhân.',
      403,
      'AVATAR_SELF_MANAGE_ONLY'
    );
  }

  validateProfileNumericFields(
    {
      he_so_luong: data.he_so_luong,
      so_nguoi_phu_thuoc: data.so_nguoi_phu_thuoc,
      han_muc_phep_nam: data.han_muc_phep_nam,
    },
    finalContractType
  );

  const primaryDept = await validateDepartmentRoleRule(finalRole, finalDeptId);

  const rawRolesInput = Array.isArray(data.danh_sach_vai_tro) && data.danh_sach_vai_tro.length > 0
    ? data.danh_sach_vai_tro
    : buildDefaultRolesArray(finalRole, finalDeptId, primaryDept?.loai_don_vi || null);
  const validatedRoleRows = await normalizeAndValidateRoleRows(rawRolesInput, finalRole, finalDeptId);

  const defaultSalaryCoeff = VISITING_CONTRACT_TYPES.includes(finalContractType) ? 0 : 2.34;

  return {
    rawPassword: String(password),
    userRecord: {
      ho_ten: finalName,
      email: finalEmail,
      ma_can_bo: finalStaffCode,
      vai_tro_chinh: finalRole,
      don_vi_chinh_id: finalDeptId,
      so_dien_thoai: cleanPhone,
      trang_thai_lam_viec: finalWorkStatus,
      anh_dai_dien: null,
      kich_hoat: true,
      phien_ban_token: 1,
    },
    profileRecord: {
      gioi_tinh: finalGender,
      ngay_sinh: finalNgaySinh,
      dia_chi: data.dia_chi ? String(data.dia_chi).trim() : '',
      chuc_vu: data.chuc_vu ? String(data.chuc_vu).trim() : '',
      loai_nhan_su: finalStaffType,
      loai_hop_dong: finalContractType,
      ngay_vao_lam: finalNgayVaoLam,
      ngay_het_han_hop_dong: finalNgayHetHan,
      hoc_ham: finalAcademicRank,
      hoc_vi: finalDegree,
      ngach_luong: data.ngach_luong ? String(data.ngach_luong).trim() : 'V.07.01.03',
      he_so_luong: data.he_so_luong !== undefined ? Number(data.he_so_luong) : defaultSalaryCoeff,
      ngay_bat_dau_giang_day: finalNgayGiangDay,
      so_nguoi_phu_thuoc: data.so_nguoi_phu_thuoc !== undefined ? Number(data.so_nguoi_phu_thuoc) : 0,
      so_cccd: cleanCccd,
      ma_so_thue: data.ma_so_thue ? String(data.ma_so_thue).trim() : null,
      so_tai_khoan_ngan_hang: data.so_tai_khoan_ngan_hang ? String(data.so_tai_khoan_ngan_hang).trim() : null,
      ten_ngan_hang: data.ten_ngan_hang ? String(data.ten_ngan_hang).trim() : null,
      chi_nhanh_ngan_hang: data.chi_nhanh_ngan_hang ? String(data.chi_nhanh_ngan_hang).trim() : null,
      han_muc_phep_nam: data.han_muc_phep_nam !== undefined ? Number(data.han_muc_phep_nam) : 12,
    },
    validatedRoleRows,
  };
};

// Lưu 1 tài khoản nhân sự kèm hồ sơ & vai trò trong transaction
const persistPreparedUser = async (prepared, hashedPassword, transaction) => {
  const newUser = await NguoiDung.create(
    {
      ...prepared.userRecord,
      mat_khau_ma_hoa: hashedPassword,
    },
    { transaction }
  );

  await HoSoCanBo.create(
    {
      nguoi_dung_id: newUser.id,
      ...prepared.profileRecord,
    },
    { transaction }
  );

  const roleRows = prepared.validatedRoleRows.map((r) => ({
    nguoi_dung_id: newUser.id,
    ...r,
  }));
  await VaiTroNguoiDung.bulkCreate(roleRows, { transaction });

  return newUser;
};

// Tạo tài khoản nhân sự mới và đồng bộ hồ sơ cán bộ, vai trò
const createNewUser = async (data, currentUser, dia_chi_ip = null) => {
  const prepared = await prepareNewUserRecords(data, currentUser);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(prepared.rawPassword, salt);

  let createdId = null;
  await runInTransaction(async (transaction) => {
    if (await NguoiDung.findOne({ where: { email: prepared.userRecord.email }, transaction })) {
      throw new ServiceError('Email này đã được đăng ký trên hệ thống.', 409);
    }
    if (await NguoiDung.findOne({ where: { ma_can_bo: prepared.userRecord.ma_can_bo }, transaction })) {
      throw new ServiceError('Mã cán bộ này đã tồn tại trên hệ thống.', 409);
    }

    const newUser = await persistPreparedUser(prepared, hashedPassword, transaction);
    createdId = newUser.id;
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'CREATE_USER',
    doi_tuong_id: String(createdId),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip,
    chi_tiet: {
      ho_ten: prepared.userRecord.ho_ten,
      email: prepared.userRecord.email,
      vai_tro_chinh: prepared.userRecord.vai_tro_chinh,
      ma_can_bo: prepared.userRecord.ma_can_bo,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchUserById(createdId, currentUser);
};

const ROLE_STAFF_CODE_PREFIX = {
  bgh: 'BGH',
  admin: 'ADMIN',
  tccb: 'TCCB',
  dao_tao: 'DAOTAO',
  ke_toan: 'KT',
  truong_khoa: 'TK',
  pho_khoa: 'PK',
  truong_bo_mon: 'TBM',
  pho_bo_mon: 'PBM',
  truong_phong: 'TP',
  pho_phong: 'PP',
  giang_vien: 'GV',
  nhan_vien: 'NV',
};

const POSITION_STAFF_CODE_RULES = [
  ['hieu truong', 'BGH'],
  ['ban giam hieu', 'BGH'],
  ['quan tri', 'ADMIN'],
  ['to chuc can bo', 'TCCB'],
  ['tccb', 'TCCB'],
  ['dao tao', 'DAOTAO'],
  ['ke toan', 'KT'],
  ['pho truong khoa', 'PK'],
  ['pho khoa', 'PK'],
  ['truong khoa', 'TK'],
  ['pho truong bo mon', 'PBM'],
  ['pho bo mon', 'PBM'],
  ['truong bo mon', 'TBM'],
  ['pho truong phong', 'PP'],
  ['pho phong', 'PP'],
  ['truong phong', 'TP'],
  ['chuyen vien', 'CV'],
  ['giang vien', 'GV'],
  ['nhan vien', 'NV'],
];

const stripVietnameseAccents = (val = '') =>
  String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const resolveStaffCodePrefix = (role, position) => {
  const normPos = stripVietnameseAccents(position);
  if (normPos) {
    for (const [keyword, prefix] of POSITION_STAFF_CODE_RULES) {
      if (normPos.includes(keyword)) return prefix;
    }
  }
  const normRole = normalizeRole(role || 'giang_vien');
  return ROLE_STAFF_CODE_PREFIX[normRole] || 'CB';
};

const generateUniqueStaffCode = (role, position, usedCodesSet) => {
  const prefix = resolveStaffCodePrefix(role, position);
  let seq = 1;
  while (true) {
    const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    if (!usedCodesSet.has(candidate)) {
      usedCodesSet.add(candidate);
      return candidate;
    }
    seq += 1;
  }
};

// Nhập hàng loạt tài khoản nhân sự từ Excel trong 1 giao dịch nguyên tử (Atomic Transaction)
const importUsersFromExcel = async (rows, currentUser, dia_chi_ip = null) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ServiceError('Danh sách nhân sự nhập từ Excel không được để trống.', 400);
  }
  if (rows.length > MAX_EXCEL_IMPORT_ROWS) {
    throw new ServiceError(`Mỗi lần nhập Excel chỉ hỗ trợ tối đa ${MAX_EXCEL_IMPORT_ROWS} nhân sự.`, 400);
  }

  const existingCodeRows = await NguoiDung.findAll({
    attributes: ['ma_can_bo'],
    raw: true,
  });
  const usedCodesSet = new Set(
    existingCodeRows
      .map((u) => String(u.ma_can_bo || '').trim().toUpperCase())
      .filter(Boolean)
  );
  // Giữ trước các mã cán bộ người dùng đã nhập thủ công trong file để mã tự sinh không trùng
  for (const r of rows) {
    const explicitCode = String(r?.ma_can_bo || '').trim().toUpperCase();
    if (explicitCode) usedCodesSet.add(explicitCode);
  }

  const rowErrors = [];
  const preparedItems = [];
  const seenEmails = new Map();
  const seenStaffCodes = new Map();

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const rawRow = rows[i] || {};
    try {
      const explicitCode = String(rawRow.ma_can_bo || '').trim().toUpperCase();
      const effectiveRole = normalizeRole(rawRow.vai_tro_chinh || 'giang_vien');
      const normalizedRow = {
        ...rawRow,
        ma_can_bo:
          explicitCode ||
          generateUniqueStaffCode(effectiveRole, rawRow.chuc_vu, usedCodesSet),
        mat_khau:
          rawRow.mat_khau && String(rawRow.mat_khau).trim() !== ''
            ? String(rawRow.mat_khau).trim()
            : '123456',
      };
      const prepared = await prepareNewUserRecords(normalizedRow, currentUser);
      const { email, ma_can_bo } = prepared.userRecord;

      if (seenEmails.has(email)) {
        rowErrors.push({
          rowNumber,
          ma_can_bo,
          email,
          message: `Trùng email "${email}" với dòng #${seenEmails.get(email)} trong file Excel.`,
        });
        continue;
      }
      if (seenStaffCodes.has(ma_can_bo)) {
        rowErrors.push({
          rowNumber,
          ma_can_bo,
          email,
          message: `Trùng mã cán bộ "${ma_can_bo}" với dòng #${seenStaffCodes.get(ma_can_bo)} trong file Excel.`,
        });
        continue;
      }

      seenEmails.set(email, rowNumber);
      seenStaffCodes.set(ma_can_bo, rowNumber);
      preparedItems.push({ rowNumber, prepared });
    } catch (err) {
      rowErrors.push({
        rowNumber,
        ma_can_bo: String(rawRow.ma_can_bo || '').trim().toUpperCase(),
        email: String(rawRow.email || '').trim().toLowerCase(),
        message: err.message || 'Dữ liệu dòng không hợp lệ.',
      });
    }
  }

  // Kiểm tra trùng email / mã cán bộ với CSDL hiện tại để gom đủ báo lỗi trước khi ghi
  const candidateEmails = Array.from(seenEmails.keys());
  const candidateCodes = Array.from(seenStaffCodes.keys());
  if (candidateEmails.length > 0 || candidateCodes.length > 0) {
    const existingUsers = await NguoiDung.findAll({
      where: {
        [Op.or]: [
          ...(candidateEmails.length > 0 ? [{ email: { [Op.in]: candidateEmails } }] : []),
          ...(candidateCodes.length > 0 ? [{ ma_can_bo: { [Op.in]: candidateCodes } }] : []),
        ],
      },
      attributes: ['email', 'ma_can_bo'],
      raw: true,
    });

    const existingEmailSet = new Set(existingUsers.map((u) => String(u.email || '').toLowerCase()));
    const existingCodeSet = new Set(existingUsers.map((u) => String(u.ma_can_bo || '').toUpperCase()));

    for (const item of preparedItems) {
      const { email, ma_can_bo } = item.prepared.userRecord;
      if (existingEmailSet.has(email)) {
        rowErrors.push({
          rowNumber: item.rowNumber,
          ma_can_bo,
          email,
          message: `Email "${email}" đã tồn tại trên hệ thống.`,
        });
      } else if (existingCodeSet.has(ma_can_bo)) {
        rowErrors.push({
          rowNumber: item.rowNumber,
          ma_can_bo,
          email,
          message: `Mã cán bộ "${ma_can_bo}" đã tồn tại trên hệ thống.`,
        });
      }
    }
  }

  if (rowErrors.length > 0) {
    const firstErr = rowErrors[0];
    throw new ServiceError(
      `Có ${rowErrors.length} dòng dữ liệu chưa hợp lệ (VD dòng #${firstErr.rowNumber}: ${firstErr.message}).`,
      400,
      'EXCEL_IMPORT_VALIDATION_FAILED',
      rowErrors
    );
  }

  // Băm mật khẩu theo từng giá trị duy nhất để tối ưu thời gian khi dùng mật khẩu mặc định
  const hashCache = new Map();
  for (const item of preparedItems) {
    const pwd = item.prepared.rawPassword;
    if (!hashCache.has(pwd)) {
      const salt = await bcrypt.genSalt(10);
      hashCache.set(pwd, await bcrypt.hash(pwd, salt));
    }
  }

  const createdIds = [];
  await runInTransaction(async (transaction) => {
    for (const item of preparedItems) {
      const hashedPassword = hashCache.get(item.prepared.rawPassword);
      const created = await persistPreparedUser(item.prepared, hashedPassword, transaction);
      createdIds.push(String(created.id));
    }
  });

  const createdUsers = createdIds.length > 0
    ? await NguoiDung.findAll({
        where: { id: { [Op.in]: createdIds } },
        include: USER_INCLUDES,
      })
    : [];

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'IMPORT_USERS_EXCEL',
    doi_tuong_id: createdIds[0] || null,
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip,
    chi_tiet: {
      totalCreated: createdIds.length,
      staffCodes: preparedItems.map((p) => p.prepared.userRecord.ma_can_bo),
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return {
    totalCreated: createdIds.length,
    users: createdUsers.map((u) => formatUserDetail(u, null)),
  };
};

const SELF_EDIT_ALLOWED_FIELDS = new Set([
  'ho_ten', 'so_dien_thoai', 'anh_dai_dien', 'gioi_tinh', 'ngay_sinh',
  'dia_chi', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
]);

const UNIT_LEADER_EDIT_ALLOWED_FIELDS = new Set([
  'ho_ten', 'so_dien_thoai', 'gioi_tinh', 'ngay_sinh', 'dia_chi', 'chuc_vu',
]);

// Kiểm tra điều kiện trước khi khóa / vô hiệu hóa tài khoản nhân sự
const assertUserCanBeDeactivated = async (userId, transaction) => {
  const todayVn = getTodayVietnamDate();

  const [activeScheduleCount, activeSubstituteCount, managedDepartments] = await Promise.all([
    LichTrinh.count({
      where: {
        nguoi_dung_id: userId,
        ngay_ket_thuc: { [Op.gte]: todayVn },
      },
      transaction,
    }),
    NgoaiLeLichTrinh.count({
      where: {
        giang_vien_day_thay_id: userId,
        [Op.or]: [
          { ngay_day_bu: { [Op.gte]: todayVn } },
          { ngay: { [Op.gte]: todayVn } },
        ],
      },
      transaction,
    }),
    PhongBan.findAll({
      where: { truong_don_vi_id: userId },
      attributes: ['id', 'ten_phong_ban'],
      transaction,
    }),
  ]);

  const totalActiveSchedules = Number(activeScheduleCount || 0) + Number(activeSubstituteCount || 0);
  if (totalActiveSchedules > 0) {
    const detailParts = [];
    if (activeScheduleCount > 0) detailParts.push(`${activeScheduleCount} lịch giảng dạy`);
    if (activeSubstituteCount > 0) detailParts.push(`${activeSubstituteCount} lịch phân công dạy thay`);
    throw new ServiceError(
      `Không thể khóa tài khoản vì giảng viên đang có ${detailParts.join(' và ')} còn hiệu lực trên hệ thống. Vui lòng chuyển giao hoặc kết thúc lịch dạy trước khi khóa.`,
      409,
      'USER_HAS_ACTIVE_SCHEDULES',
      {
        so_lich_giang_day: Number(activeScheduleCount || 0),
        so_lich_day_thay: Number(activeSubstituteCount || 0),
        tong_lich_hieu_luc: totalActiveSchedules,
      }
    );
  }

  if (Array.isArray(managedDepartments) && managedDepartments.length > 0) {
    const deptNames = managedDepartments.map((d) => d.ten_phong_ban).filter(Boolean).join(', ');
    throw new ServiceError(
      `Không thể khóa tài khoản vì nhân sự đang giữ chức vụ Trưởng đơn vị (${deptNames}). Vui lòng bàn giao chức vụ trước khi khóa.`,
      409,
      'USER_IS_DEPARTMENT_MANAGER',
      {
        don_vi_dang_quan_ly: managedDepartments.map((d) => ({
          id: d.id,
          ten_phong_ban: d.ten_phong_ban,
        })),
      }
    );
  }
};

const pickAllowedFields = (source, allowedSet) => {
  const picked = {};
  for (const key of Object.keys(source)) {
    if (allowedSet.has(key)) picked[key] = source[key];
  }
  return picked;
};

// Lọc phạm vi trường được phép sửa theo vai trò (chính chủ / trưởng đơn vị / quản trị) và chặn sửa tài khoản cấp cao trái quyền
const resolveScopedUpdatePayload = async (id, data, currentUser, targetUser) => {
  const isSelf = String(currentUser.id) === String(id);
  const editorRoles = getActiveUserRoles(currentUser);
  const isTopAdmin = editorRoles.has('admin') || editorRoles.has('bgh');
  const isGlobalHrEditor = isTopAdmin || editorRoles.has('tccb');
  const isUnitLeaderOnly = hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES) && !isGlobalHrEditor;

  if (isSelf && (data.kich_hoat === false || data.trang_thai_lam_viec === 'da_nghi_viec')) {
    throw new ServiceError('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.', 400);
  }

  let payload = { ...data };
  if (isSelf && !isTopAdmin) {
    payload = pickAllowedFields(payload, SELF_EDIT_ALLOWED_FIELDS);
  } else if (!isSelf && isUnitLeaderOnly) {
    const inScope = await isUserInDeanScope(currentUser, id);
    if (!inScope) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài phạm vi quản lý của đơn vị.', 403);
    }
    payload = pickAllowedFields(payload, UNIT_LEADER_EDIT_ALLOWED_FIELDS);
  }

  const targetActiveRoles = getActiveUserRoles(targetUser);
  const requestedRoles = extractRequestedRoleCodes(payload.vai_tro_chinh, payload.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!isSelf) {
    const sensitiveKeys = [
      'kich_hoat', 'trang_thai_lam_viec', 'vai_tro_chinh', 'danh_sach_vai_tro',
      'don_vi_chinh_id', 'mat_khau', 'email', 'ma_can_bo', 'so_dien_thoai',
    ];
    const hasSensitiveMutation = sensitiveKeys.some((k) => payload[k] !== undefined);
    if (targetActiveRoles.has('bgh') && !editorRoles.has('bgh') && hasSensitiveMutation) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Ban Giám Hiệu.', 403);
    }
    if (targetActiveRoles.has('admin') && !editorRoles.has('bgh') && hasSensitiveMutation) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Quản trị viên.', 403);
    }
  }

  return { payload, isSelf, isGlobalHrEditor };
};

// Kiểm tra, chuẩn hóa và gán thay đổi lên bản ghi NguoiDung trước khi mở Transaction
const prepareUserUpdateMutations = async (user, payload, { isSelf, isGlobalHrEditor }) => {
  if (payload.ho_ten !== undefined) {
    const trimmedName = String(payload.ho_ten || '').trim();
    if (!trimmedName) throw new ServiceError('Họ tên không được để trống.', 400);
    user.ho_ten = trimmedName;
  }

  let pendingEmailCheck = null;
  if (payload.email !== undefined) {
    const normalizedEmail = String(payload.email || '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new ServiceError('Địa chỉ email không hợp lệ.', 400);
    }
    if (normalizedEmail !== user.email) pendingEmailCheck = normalizedEmail;
    user.email = normalizedEmail;
  }

  let pendingStaffCodeCheck = null;
  if (payload.ma_can_bo !== undefined) {
    const code = String(payload.ma_can_bo || '').trim().toUpperCase();
    if (!code) throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
    if (code !== user.ma_can_bo) pendingStaffCodeCheck = code;
    user.ma_can_bo = code;
  }

  if (payload.don_vi_chinh_id !== undefined) {
    if (payload.don_vi_chinh_id && !isValidUuid(payload.don_vi_chinh_id)) {
      throw new ServiceError('Mã đơn vị (don_vi_chinh_id) không đúng định dạng UUID.', 400);
    }
    user.don_vi_chinh_id = payload.don_vi_chinh_id || null;
  }
  if (payload.vai_tro_chinh !== undefined) {
    const normPrimary = normalizeRole(payload.vai_tro_chinh);
    if (!normPrimary) throw new ServiceError('Vai trò chính không hợp lệ.', 400);
    user.vai_tro_chinh = normPrimary;
  }
  let updatedPrimaryDept = null;
  if (payload.don_vi_chinh_id !== undefined || payload.vai_tro_chinh !== undefined) {
    updatedPrimaryDept = await validateDepartmentRoleRule(normalizeRole(user.vai_tro_chinh), user.don_vi_chinh_id);
  }

  const effectiveContractType = payload.loai_hop_dong || user.ho_so?.loai_hop_dong || 'toan_thoi_gian';
  validateProfileNumericFields(
    {
      he_so_luong: payload.he_so_luong,
      so_nguoi_phu_thuoc: payload.so_nguoi_phu_thuoc,
      han_muc_phep_nam: payload.han_muc_phep_nam,
    },
    effectiveContractType
  );

  const contactDateKeys = [
    'so_dien_thoai', 'so_cccd', 'ma_so_thue', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang',
    'ngay_sinh', 'ngay_vao_lam', 'ngay_bat_dau_giang_day', 'ngay_het_han_hop_dong',
  ];
  if (contactDateKeys.some((k) => payload[k] !== undefined)) {
    const mergeField = (k, fallback) => (payload[k] !== undefined ? payload[k] : fallback);
    const { normDob, normJoin, normTeach, normExpiry } = validateProfileDatesAndContacts({
      so_dien_thoai: payload.so_dien_thoai,
      so_cccd: payload.so_cccd,
      ma_so_thue: payload.ma_so_thue,
      so_tai_khoan_ngan_hang: mergeField('so_tai_khoan_ngan_hang', user.ho_so?.so_tai_khoan_ngan_hang),
      ten_ngan_hang: mergeField('ten_ngan_hang', user.ho_so?.ten_ngan_hang),
      ngay_sinh: mergeField('ngay_sinh', formatDateOnlyOutput(user.ho_so?.ngay_sinh)),
      ngay_vao_lam: mergeField('ngay_vao_lam', formatDateOnlyOutput(user.ho_so?.ngay_vao_lam)),
      ngay_bat_dau_giang_day: mergeField('ngay_bat_dau_giang_day', formatDateOnlyOutput(user.ho_so?.ngay_bat_dau_giang_day)),
      ngay_het_han_hop_dong: mergeField('ngay_het_han_hop_dong', formatDateOnlyOutput(user.ho_so?.ngay_het_han_hop_dong)),
      todayVn: getTodayVietnamDate(),
    });
    if (payload.ngay_sinh !== undefined) payload.ngay_sinh = normDob;
    if (payload.ngay_vao_lam !== undefined && normJoin) payload.ngay_vao_lam = normJoin;
    if (payload.ngay_bat_dau_giang_day !== undefined) payload.ngay_bat_dau_giang_day = normTeach;
    if (payload.ngay_het_han_hop_dong !== undefined) payload.ngay_het_han_hop_dong = normExpiry;
  }

  const validatedRoleRows = Array.isArray(payload.danh_sach_vai_tro)
    ? await normalizeAndValidateRoleRows(payload.danh_sach_vai_tro, user.vai_tro_chinh, user.don_vi_chinh_id)
    : null;

  const wasAlreadyDeactivated = user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec';
  if (payload.so_dien_thoai !== undefined) user.so_dien_thoai = payload.so_dien_thoai || null;
  if (payload.trang_thai_lam_viec !== undefined) user.trang_thai_lam_viec = payload.trang_thai_lam_viec;

  if (payload.anh_dai_dien !== undefined) {
    const nextAvatarUrl = normalizeSafeAvatarUrl(payload.anh_dai_dien);
    const currentAvatarUrl = user.anh_dai_dien || null;
    if (!isSelf && nextAvatarUrl !== null && nextAvatarUrl !== currentAvatarUrl) {
      throw new ServiceError(
        'Ảnh đại diện do từng cá nhân tự cập nhật tại Hồ sơ cá nhân. Quản trị viên chỉ có thể đặt lại về ảnh mặc định.',
        403,
        'AVATAR_SELF_MANAGE_ONLY'
      );
    }
    if (!isSelf && !isGlobalHrEditor && nextAvatarUrl !== currentAvatarUrl) {
      throw new ServiceError(
        'Chỉ Quản trị viên, Ban Giám Hiệu hoặc TCCB mới có quyền đặt lại ảnh đại diện mặc định cho nhân sự.',
        403,
        'AVATAR_RESET_FORBIDDEN'
      );
    }
    user.anh_dai_dien = nextAvatarUrl;
  }

  if (payload.kich_hoat !== undefined) user.kich_hoat = Boolean(payload.kich_hoat);
  if (user.trang_thai_lam_viec === 'da_nghi_viec') user.kich_hoat = false;

  let passwordChanged = false;
  if (payload.mat_khau) {
    if (String(payload.mat_khau).length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    user.mat_khau_ma_hoa = await bcrypt.hash(payload.mat_khau, salt);
    user.doi_mat_khau_luc = new Date();
    passwordChanged = true;
  }

  const isDeactivated = user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec';
  const isTransitioningToDeactivated = !wasAlreadyDeactivated && isDeactivated;
  const shouldRevokeSessions = isDeactivated || passwordChanged;
  if (shouldRevokeSessions) {
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  }

  return {
    pendingEmailCheck,
    pendingStaffCodeCheck,
    validatedRoleRows,
    updatedPrimaryDeptType: updatedPrimaryDept?.loai_don_vi || null,
    isTransitioningToDeactivated,
    shouldRevokeSessions,
    isDeactivated,
  };
};

// Đồng bộ thay đổi vào HoSoCanBo và bảng phân vai VaiTroNguoiDung trong transaction
const syncProfileAndRolesInTx = async (
  user,
  payload,
  { id, previousPrimaryRole, previousPrimaryDeptId, updatedPrimaryDeptType, validatedRoleRows, transaction }
) => {
  const profileUpdates = {};
  const profileFields = [
    'gioi_tinh', 'ngay_sinh', 'dia_chi', 'chuc_vu', 'loai_nhan_su',
    'loai_hop_dong', 'ngay_vao_lam', 'ngay_het_han_hop_dong', 'hoc_ham',
    'hoc_vi', 'ngach_luong', 'ngay_bat_dau_giang_day', 'so_cccd',
    'ma_so_thue', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
  ];
  for (const f of profileFields) {
    if (payload[f] !== undefined) {
      profileUpdates[f] =
        f === 'dia_chi' || f === 'chuc_vu'
          ? String(payload[f] ?? '')
          : payload[f] === ''
            ? null
            : payload[f];
    }
  }
  if (payload.he_so_luong !== undefined) profileUpdates.he_so_luong = Number(payload.he_so_luong);
  if (payload.so_nguoi_phu_thuoc !== undefined) profileUpdates.so_nguoi_phu_thuoc = Number(payload.so_nguoi_phu_thuoc);
  if (payload.han_muc_phep_nam !== undefined) profileUpdates.han_muc_phep_nam = Number(payload.han_muc_phep_nam);

  if (Object.keys(profileUpdates).length > 0) {
    const existingProfile = await HoSoCanBo.findOne({ where: { nguoi_dung_id: id }, transaction });
    if (existingProfile) {
      await existingProfile.update(profileUpdates, { transaction });
    } else {
      await HoSoCanBo.create({ nguoi_dung_id: id, ...profileUpdates }, { transaction });
    }
  }

  // Đồng bộ 2 chiều với PhongBan.truong_don_vi_id:
  // Nếu cán bộ bị chuyển sang đơn vị khác hoặc đổi sang vai trò không còn là Trưởng đơn vị -> gỡ truong_don_vi_id cũ để tránh dữ liệu mồ côi
  if (payload.vai_tro_chinh !== undefined || payload.don_vi_chinh_id !== undefined) {
    const nextPrimaryRole = normalizeRole(user.vai_tro_chinh);
    const nextPrimaryDeptId = user.don_vi_chinh_id || null;
    const deptChanged = String(previousPrimaryDeptId || '') !== String(nextPrimaryDeptId || '');
    const roleChanged = previousPrimaryRole !== nextPrimaryRole;
    const LEADER_ROLES = new Set(['truong_khoa', 'truong_bo_mon', 'truong_phong', 'bgh']);

    if ((deptChanged || roleChanged) && (deptChanged || !LEADER_ROLES.has(nextPrimaryRole))) {
      await PhongBan.update(
        { truong_don_vi_id: null },
        { where: { truong_don_vi_id: id }, transaction }
      );
    }
  }

  if (validatedRoleRows !== null) {
    await VaiTroNguoiDung.destroy({ where: { nguoi_dung_id: id }, transaction });
    if (validatedRoleRows.length > 0) {
      await VaiTroNguoiDung.bulkCreate(
        validatedRoleRows.map((r) => ({ nguoi_dung_id: id, ...r })),
        { transaction }
      );
    }
    return;
  }

  if (payload.vai_tro_chinh !== undefined || payload.don_vi_chinh_id !== undefined) {
    const nextPrimaryRole = normalizeRole(user.vai_tro_chinh);
    const nextPrimaryDeptId = user.don_vi_chinh_id || null;
    if (
      previousPrimaryRole &&
      (previousPrimaryRole !== nextPrimaryRole ||
        String(previousPrimaryDeptId || '') !== String(nextPrimaryDeptId || ''))
    ) {
      const oldDefaultRow = buildDefaultRolesArray(previousPrimaryRole, previousPrimaryDeptId)[0];
      await VaiTroNguoiDung.destroy({
        where: {
          nguoi_dung_id: id,
          ma_vai_tro: oldDefaultRow.ma_vai_tro,
          don_vi_id: oldDefaultRow.don_vi_id,
        },
        transaction,
      });
    }

    if (payload.vai_tro_chinh !== undefined || payload.don_vi_chinh_id !== undefined) {
      const defaultRoleRow = buildDefaultRolesArray(
        user.vai_tro_chinh,
        user.don_vi_chinh_id,
        updatedPrimaryDeptType
      )[0];
      const existingRoleRow = await VaiTroNguoiDung.findOne({
        where: {
          nguoi_dung_id: id,
          ma_vai_tro: defaultRoleRow.ma_vai_tro,
          don_vi_id: defaultRoleRow.don_vi_id,
        },
        transaction,
      });
      if (!existingRoleRow) {
        await VaiTroNguoiDung.create(
          {
            nguoi_dung_id: id,
            ma_vai_tro: defaultRoleRow.ma_vai_tro,
            pham_vi: defaultRoleRow.pham_vi,
            don_vi_id: defaultRoleRow.don_vi_id,
            tu_ngay: getTodayVietnamDate(),
          },
          { transaction }
        );
      }
    }
  }
};

// Cập nhật tài khoản, hồ sơ cán bộ và đồng bộ vai trò
const updateExistingUser = async (id, data, currentUser, dia_chi_ip = null) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }

  const user = await NguoiDung.scope('withPassword').findByPk(id, { include: USER_INCLUDES });
  if (!user) {
    throw new ServiceError('Không tìm thấy người dùng.', 404);
  }

  const previousPrimaryRole = normalizeRole(user.vai_tro_chinh);
  const previousPrimaryDeptId = user.don_vi_chinh_id || null;
  const { payload, isSelf, isGlobalHrEditor } = await resolveScopedUpdatePayload(id, data, currentUser, user);
  const meta = await prepareUserUpdateMutations(user, payload, { isSelf, isGlobalHrEditor });

  await runInTransaction(async (transaction) => {
    if (meta.isTransitioningToDeactivated) {
      await assertUserCanBeDeactivated(user.id, transaction);
    }
    if (meta.pendingEmailCheck) {
      const existing = await NguoiDung.findOne({ where: { email: meta.pendingEmailCheck, id: { [Op.ne]: id } }, transaction });
      if (existing) throw new ServiceError('Email này đã được tài khoản khác sử dụng.', 409);
    }
    if (meta.pendingStaffCodeCheck) {
      const existing = await NguoiDung.findOne({ where: { ma_can_bo: meta.pendingStaffCodeCheck, id: { [Op.ne]: id } }, transaction });
      if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    }

    await user.save({ transaction });
    if (meta.shouldRevokeSessions) {
      await MaLamMoi.destroy({ where: { nguoi_dung_id: user.id }, transaction });
    }

    await syncProfileAndRolesInTx(user, payload, {
      id,
      previousPrimaryRole,
      previousPrimaryDeptId,
      updatedPrimaryDeptType: meta.updatedPrimaryDeptType,
      validatedRoleRows: meta.validatedRoleRows,
      transaction,
    });
  });

  if (meta.shouldRevokeSessions) await revokeGraceTokensSafe(user.id);
  if (meta.isDeactivated) await purgeUserBiometricsCache(user.id);

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'UPDATE_USER',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip,
    chi_tiet: { updatedFields: Object.keys(payload) },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchUserById(user.id, currentUser);
};

// Khóa mềm tài khoản người dùng, thu hồi phiên và gỡ sinh trắc học khỏi RAM/cache
const softDeleteUser = async (id, currentUser, dia_chi_ip = null) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }
  if (String(id) === String(currentUser.id)) {
    throw new ServiceError('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.', 400);
  }

  const user = await NguoiDung.findByPk(id, {
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro' }],
  });
  if (!user) throw new ServiceError('Không tìm thấy người dùng.', 404);

  const targetActiveRoles = getActiveUserRoles(user);
  const editorRoles = getActiveUserRoles(currentUser);

  if (targetActiveRoles.has('bgh') && !editorRoles.has('bgh')) {
    throw new ServiceError('Chỉ Lãnh đạo Ban Giám Hiệu mới có quyền vô hiệu hóa tài khoản Ban Giám Hiệu.', 403);
  }
  if (targetActiveRoles.has('admin') && !editorRoles.has('bgh')) {
    throw new ServiceError('Chỉ Lãnh đạo Ban Giám Hiệu mới có quyền vô hiệu hóa tài khoản Quản trị viên.', 403);
  }

  await runInTransaction(async (transaction) => {
    await assertUserCanBeDeactivated(user.id, transaction);
    user.kich_hoat = false;
    user.trang_thai_lam_viec = 'da_nghi_viec';
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
    await user.save({ transaction });
    await MaLamMoi.destroy({ where: { nguoi_dung_id: user.id }, transaction });
  });

  await revokeGraceTokensSafe(user.id);
  await purgeUserBiometricsCache(user.id);

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'SOFT_DELETE_USER',
    doi_tuong_id: String(user.id),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip,
    chi_tiet: { message: `Vô hiệu hóa tài khoản: ${user.email}` },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Đã vô hiệu hóa tài khoản thành công.' };
};

module.exports = {
  ServiceError,
  fetchUsers,
  fetchUserById,
  createNewUser,
  importUsersFromExcel,
  updateExistingUser,
  softDeleteUser,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
};
