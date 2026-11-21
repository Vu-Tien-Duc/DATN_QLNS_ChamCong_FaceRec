// Quản lý tài khoản nhân sự, hồ sơ cán bộ, vai trò theo khoa và khóa mềm tài khoản.
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  NguoiDung,
  HoSoCanBo,
  VaiTroNguoiDung,
  PhongBan,
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
const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole, hasAnyActiveRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const hoTroChamCong = require('../../utils/hoTroChamCong');
const ketNoiDichVuKhuonMat = require('../khuonMat/ketNoiDichVuKhuonMat');
const { normalizeSafeAvatarUrl } = require('../heThong/taiTep.service');
const ServiceError = require('../../utils/loiNghiepVu');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const VISITING_CONTRACT_TYPES = ['thinh_giang', 'hop_dong_vu_viec'];

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
const buildDefaultRolesArray = (roleStr, don_vi_id = null) => {
  const norm = normalizeRole(roleStr);
  let pham_vi = don_vi_id ? 'khoa' : 'toan_truong';

  if (GLOBAL_ADMIN_ROLES.includes(norm) || ['dao_tao'].includes(norm)) {
    pham_vi = 'toan_truong';
  } else if (['truong_khoa', 'pho_khoa'].includes(norm)) {
    pham_vi = 'khoa';
  } else if (['truong_bo_mon', 'pho_bo_mon'].includes(norm)) {
    pham_vi = 'bo_mon';
  } else if (['truong_phong', 'pho_phong', 'nhan_vien'].includes(norm)) {
    pham_vi = don_vi_id ? 'phong_ban' : 'toan_truong';
  }

  return [{ ma_vai_tro: norm, pham_vi, don_vi_id: don_vi_id || null }];
};

// Kiểm tra ràng buộc loại đơn vị (Khoa/Bộ môn/Phòng ban/Ban Giám Hiệu) phù hợp với vai trò
const validateDepartmentRoleRule = async (roleVal, deptId) => {
  if (!deptId) return;
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
};

// Kiểm tra và chuẩn hóa danh sách vai trò kiêm nhiệm (khử trùng lặp & kiểm tra đơn vị)
const normalizeAndValidateRoleRows = async (roleList, fallbackRole, fallbackDeptId) => {
  const seen = new Set();
  const normalizedRows = [];

  for (const r of roleList) {
    if (!r || typeof r !== 'object') {
      throw new ServiceError('Dữ liệu vai trò không hợp lệ.', 400);
    }
    const maVaiTro = normalizeRole(r.ma_vai_tro || fallbackRole);
    if (!maVaiTro) {
      throw new ServiceError('Mã vai trò không được để trống.', 400);
    }
    const rawDeptId = r.don_vi_id !== undefined ? r.don_vi_id : fallbackDeptId;
    const phamVi = r.pham_vi || (rawDeptId ? 'khoa' : 'toan_truong');
    const donViId = phamVi === 'toan_truong' ? null : (rawDeptId || null);

    if (donViId) {
      await validateDepartmentRoleRule(maVaiTro, donViId);
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
      duoc_uy_quyen: Boolean(r.duoc_uy_quyen),
      tu_ngay: r.tu_ngay || getTodayVietnamDate(),
      den_ngay: r.den_ngay || null,
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
  const raw = userInstance.toJSON ? userInstance.toJSON() : { ...userInstance };
  delete raw.mat_khau_ma_hoa;
  const profile = raw.ho_so && typeof raw.ho_so === 'object' ? { ...raw.ho_so } : {};
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

// Tạo tài khoản nhân sự mới và đồng bộ hồ sơ cán bộ, vai trò
const createNewUser = async (data, currentUser, dia_chi_ip = null) => {
  const finalName = (data.ho_ten || '').trim();
  const finalEmail = (data.email || '').trim().toLowerCase();
  const finalStaffCode = (data.ma_can_bo || '').trim().toUpperCase();
  const finalRole = normalizeRole(data.vai_tro_chinh || 'giang_vien');
  const finalDeptId = data.don_vi_chinh_id || null;
  const password = data.mat_khau;
  const finalContractType = data.loai_hop_dong || 'toan_thoi_gian';

  const requestedRoles = extractRequestedRoleCodes(finalRole, data.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!finalName) throw new ServiceError('Họ tên không được để trống.', 400);
  if (!finalEmail || !EMAIL_REGEX.test(finalEmail)) throw new ServiceError('Địa chỉ email không hợp lệ.', 400);
  if (!finalStaffCode) throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
  if (!password || password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);

  validateProfileNumericFields(
    {
      he_so_luong: data.he_so_luong,
      so_nguoi_phu_thuoc: data.so_nguoi_phu_thuoc,
      han_muc_phep_nam: data.han_muc_phep_nam,
    },
    finalContractType
  );

  await validateDepartmentRoleRule(finalRole, finalDeptId);

  const rawRolesInput = Array.isArray(data.danh_sach_vai_tro) && data.danh_sach_vai_tro.length > 0
    ? data.danh_sach_vai_tro
    : buildDefaultRolesArray(finalRole, finalDeptId);
  const validatedRoleRows = await normalizeAndValidateRoleRows(rawRolesInput, finalRole, finalDeptId);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const defaultSalaryCoeff = VISITING_CONTRACT_TYPES.includes(finalContractType) ? 0 : 2.34;
  const todayVn = getTodayVietnamDate();

  let createdId = null;
  await runInTransaction(async (transaction) => {
    if (await NguoiDung.findOne({ where: { email: finalEmail }, transaction })) {
      throw new ServiceError('Email này đã được đăng ký trên hệ thống.', 409);
    }
    if (await NguoiDung.findOne({ where: { ma_can_bo: finalStaffCode }, transaction })) {
      throw new ServiceError('Mã cán bộ này đã tồn tại trên hệ thống.', 409);
    }

    const newUser = await NguoiDung.create(
      {
        ho_ten: finalName,
        email: finalEmail,
        mat_khau_ma_hoa: hashedPassword,
        ma_can_bo: finalStaffCode,
        vai_tro_chinh: finalRole,
        don_vi_chinh_id: finalDeptId,
        so_dien_thoai: data.so_dien_thoai || null,
        trang_thai_lam_viec: data.trang_thai_lam_viec || 'dang_lam_viec',
        anh_dai_dien: normalizeSafeAvatarUrl(data.anh_dai_dien),
        kich_hoat: true,
        phien_ban_token: 1,
      },
      { transaction }
    );
    createdId = newUser.id;

    await HoSoCanBo.create(
      {
        nguoi_dung_id: newUser.id,
        gioi_tinh: data.gioi_tinh || 'nam',
        ngay_sinh: data.ngay_sinh || null,
        dia_chi: data.dia_chi || '',
        chuc_vu: data.chuc_vu || '',
        loai_nhan_su: data.loai_nhan_su || (finalRole === 'giang_vien' ? 'giang_vien' : 'nhan_vien'),
        loai_hop_dong: finalContractType,
        ngay_vao_lam: data.ngay_vao_lam || todayVn,
        ngay_het_han_hop_dong: data.ngay_het_han_hop_dong || null,
        hoc_ham: data.hoc_ham || 'khong',
        hoc_vi: data.hoc_vi || 'cu_nhan',
        ngach_luong: data.ngach_luong || 'V.07.01.03',
        he_so_luong: data.he_so_luong !== undefined ? Number(data.he_so_luong) : defaultSalaryCoeff,
        ngay_bat_dau_giang_day: data.ngay_bat_dau_giang_day || null,
        so_nguoi_phu_thuoc: data.so_nguoi_phu_thuoc !== undefined ? Number(data.so_nguoi_phu_thuoc) : 0,
        so_cccd: data.so_cccd ? String(data.so_cccd).trim() : null,
        ma_so_thue: data.ma_so_thue ? String(data.ma_so_thue).trim() : null,
        so_tai_khoan_ngan_hang: data.so_tai_khoan_ngan_hang ? String(data.so_tai_khoan_ngan_hang).trim() : null,
        ten_ngan_hang: data.ten_ngan_hang ? String(data.ten_ngan_hang).trim() : null,
        chi_nhanh_ngan_hang: data.chi_nhanh_ngan_hang ? String(data.chi_nhanh_ngan_hang).trim() : null,
        han_muc_phep_nam: data.han_muc_phep_nam !== undefined ? Number(data.han_muc_phep_nam) : 12,
      },
      { transaction }
    );

    const roleRows = validatedRoleRows.map((r) => ({
      nguoi_dung_id: newUser.id,
      ...r,
    }));
    await VaiTroNguoiDung.bulkCreate(roleRows, { transaction });
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: 'CREATE_USER',
    doi_tuong_id: String(createdId),
    loai_doi_tuong: 'nguoi_dung',
    dia_chi_ip,
    chi_tiet: { ho_ten: finalName, email: finalEmail, vai_tro_chinh: finalRole, ma_can_bo: finalStaffCode },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return fetchUserById(createdId, currentUser);
};

const SELF_EDIT_ALLOWED_FIELDS = new Set([
  'ho_ten', 'so_dien_thoai', 'anh_dai_dien', 'gioi_tinh', 'ngay_sinh',
  'dia_chi', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
]);

const UNIT_LEADER_EDIT_ALLOWED_FIELDS = new Set([
  'ho_ten', 'so_dien_thoai', 'anh_dai_dien', 'gioi_tinh', 'ngay_sinh', 'dia_chi', 'chuc_vu',
]);

const pickAllowedFields = (source, allowedSet) => {
  const picked = {};
  for (const key of Object.keys(source)) {
    if (allowedSet.has(key)) picked[key] = source[key];
  }
  return picked;
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

  const targetActiveRoles = getActiveUserRoles(user);
  const requestedRoles = extractRequestedRoleCodes(payload.vai_tro_chinh, payload.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!isSelf) {
    const hasSensitiveMutation =
      payload.kich_hoat !== undefined ||
      payload.trang_thai_lam_viec !== undefined ||
      payload.vai_tro_chinh !== undefined ||
      payload.danh_sach_vai_tro !== undefined ||
      payload.don_vi_chinh_id !== undefined ||
      payload.mat_khau !== undefined ||
      payload.email !== undefined ||
      payload.ma_can_bo !== undefined ||
      payload.so_dien_thoai !== undefined;

    if (targetActiveRoles.has('bgh') && !editorRoles.has('bgh') && hasSensitiveMutation) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Ban Giám Hiệu.', 403);
    }
    if (targetActiveRoles.has('admin') && !editorRoles.has('bgh') && hasSensitiveMutation) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Quản trị viên.', 403);
    }
  }

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
    if (normalizedEmail !== user.email) {
      pendingEmailCheck = normalizedEmail;
      user.email = normalizedEmail;
    }
  }

  let pendingStaffCodeCheck = null;
  if (payload.ma_can_bo !== undefined) {
    const code = String(payload.ma_can_bo || '').trim().toUpperCase();
    if (!code) throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
    if (code !== user.ma_can_bo) {
      pendingStaffCodeCheck = code;
    }
    user.ma_can_bo = code;
  }

  const previousPrimaryRole = normalizeRole(user.vai_tro_chinh);
  const previousPrimaryDeptId = user.don_vi_chinh_id || null;

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

  if (payload.don_vi_chinh_id !== undefined || payload.vai_tro_chinh !== undefined) {
    await validateDepartmentRoleRule(normalizeRole(user.vai_tro_chinh), user.don_vi_chinh_id);
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

  let validatedRoleRows = null;
  if (Array.isArray(payload.danh_sach_vai_tro)) {
    validatedRoleRows = await normalizeAndValidateRoleRows(
      payload.danh_sach_vai_tro,
      user.vai_tro_chinh,
      user.don_vi_chinh_id
    );
  }

  if (payload.so_dien_thoai !== undefined) user.so_dien_thoai = payload.so_dien_thoai || null;
  if (payload.trang_thai_lam_viec !== undefined) user.trang_thai_lam_viec = payload.trang_thai_lam_viec;
  if (payload.anh_dai_dien !== undefined) user.anh_dai_dien = normalizeSafeAvatarUrl(payload.anh_dai_dien);

  if (payload.kich_hoat !== undefined) {
    user.kich_hoat = Boolean(payload.kich_hoat);
  }
  if (user.trang_thai_lam_viec === 'da_nghi_viec') {
    user.kich_hoat = false;
  }

  let passwordChanged = false;
  if (payload.mat_khau) {
    if (String(payload.mat_khau).length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    user.mat_khau_ma_hoa = await bcrypt.hash(payload.mat_khau, salt);
    user.doi_mat_khau_luc = new Date();
    passwordChanged = true;
  }

  const isDeactivated = user.kich_hoat === false || user.trang_thai_lam_viec === 'da_nghi_viec';
  const shouldRevokeSessions = isDeactivated || passwordChanged;
  if (shouldRevokeSessions) {
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  }

  await runInTransaction(async (transaction) => {
    if (pendingEmailCheck) {
      const existing = await NguoiDung.findOne({ where: { email: pendingEmailCheck, id: { [Op.ne]: id } }, transaction });
      if (existing) throw new ServiceError('Email này đã được tài khoản khác sử dụng.', 409);
    }
    if (pendingStaffCodeCheck) {
      const existing = await NguoiDung.findOne({ where: { ma_can_bo: pendingStaffCodeCheck, id: { [Op.ne]: id } }, transaction });
      if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    }

    await user.save({ transaction });

    if (shouldRevokeSessions) {
      await MaLamMoi.destroy({ where: { nguoi_dung_id: user.id }, transaction });
    }

    const profileUpdates = {};
    const profileFields = [
      'gioi_tinh', 'ngay_sinh', 'dia_chi', 'chuc_vu', 'loai_nhan_su',
      'loai_hop_dong', 'ngay_vao_lam', 'ngay_het_han_hop_dong', 'hoc_ham',
      'hoc_vi', 'ngach_luong', 'ngay_bat_dau_giang_day', 'so_cccd',
      'ma_so_thue', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
    ];
    for (const f of profileFields) {
      if (payload[f] !== undefined) {
        profileUpdates[f] = (f === 'dia_chi' || f === 'chuc_vu')
          ? String(payload[f] ?? '')
          : (payload[f] === '' ? null : payload[f]);
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

    if (validatedRoleRows !== null) {
      await VaiTroNguoiDung.destroy({ where: { nguoi_dung_id: id }, transaction });
      if (validatedRoleRows.length > 0) {
        await VaiTroNguoiDung.bulkCreate(
          validatedRoleRows.map((r) => ({ nguoi_dung_id: id, ...r })),
          { transaction }
        );
      }
    } else if (payload.vai_tro_chinh !== undefined || payload.don_vi_chinh_id !== undefined) {
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

      if (payload.vai_tro_chinh !== undefined) {
        const defaultRoleRow = buildDefaultRolesArray(user.vai_tro_chinh, user.don_vi_chinh_id)[0];
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
  });

  if (shouldRevokeSessions) {
    await revokeGraceTokensSafe(user.id);
  }
  if (isDeactivated) {
    await purgeUserBiometricsCache(user.id);
  }

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

  user.kich_hoat = false;
  user.trang_thai_lam_viec = 'da_nghi_viec';
  user.phien_ban_token = (user.phien_ban_token || 1) + 1;

  await runInTransaction(async (transaction) => {
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
  updateExistingUser,
  softDeleteUser,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
};
