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
const { getDeanDepartmentIds } = require('../../utils/phamViTruongKhoa');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole, hasAnyActiveRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
  } else if (['truong_phong', 'pho_phong', 'chuyen_vien', 'nhan_vien'].includes(norm)) {
    pham_vi = don_vi_id ? 'phong_ban' : 'toan_truong';
  }

  return [{ ma_vai_tro: norm, pham_vi, don_vi_id: don_vi_id || null }];
};

// Kiểm tra ràng buộc loại đơn vị (Khoa/Bộ môn/Ban Giám Hiệu) phù hợp với vai trò
const validateDepartmentRoleRule = async (roleVal, deptId) => {
  if (!deptId) return;
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
    throw new ServiceError('Trưởng Bộ Môn bắt buộc phải thuộc đơn vị cấp Bộ Môn.', 400);
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

const USER_INCLUDES = [
  { model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'don_vi_cha_id'] },
  { model: HoSoCanBo, as: 'ho_so' },
  { model: VaiTroNguoiDung, as: 'danh_sach_vai_tro' },
];

// Gộp dữ liệu tài khoản, hồ sơ cán bộ và trạng thái Face ID để trả về client
const formatUserDetail = (userInstance, faceTemplate = null) => {
  const raw = userInstance.toJSON ? userInstance.toJSON() : { ...userInstance };
  delete raw.mat_khau_ma_hoa;
  const profile = raw.ho_so || {};
  const deptObj = raw.don_vi_chinh || null;

  return {
    ...profile,
    ...raw,
    id: raw.id,
    _id: raw.id,
    ho_ten: raw.ho_ten || '',
    ma_can_bo: raw.ma_can_bo || '',
    so_dien_thoai: raw.so_dien_thoai || '',
    vai_tro_chinh: normalizeRole(raw.vai_tro_chinh),
    don_vi_chinh_id: deptObj || raw.don_vi_chinh_id || null,
    ten_phong_ban: deptObj?.ten_phong_ban || '',
    hoc_ham: profile.hoc_ham || 'khong',
    hoc_vi: profile.hoc_vi || 'cu_nhan',
    loai_nhan_su: profile.loai_nhan_su || 'giang_vien',
    loai_hop_dong: profile.loai_hop_dong || 'toan_thoi_gian',
    gioi_tinh: profile.gioi_tinh || 'nam',
    trang_thai_lam_viec: raw.trang_thai_lam_viec || 'dang_lam_viec',
    anh_dai_dien: raw.anh_dai_dien || null,
    tham_nien_nam: userInstance.ho_so?.tham_nien_nam ?? 0,
    da_dang_ky_face: Boolean(faceTemplate),
    ngay_dang_ky_face: faceTemplate?.ngay_dang_ky || null,
    so_luong_mau: faceTemplate?.so_luong_mau || 0,
  };
};

// Lấy danh sách người dùng có phân trang, tìm kiếm và lọc theo khoa, vai trò
const fetchUsers = async ({ vai_tro, don_vi_id, dang_hoat_dong, kich_hoat, tim_kiem, page = 1, limit = 20, trang, gioi_han, currentUser }) => {
  const where = {};
  const isUnitLeaderOnly = hasAnyActiveRole(currentUser, UNIT_LEADER_ROLES) && !hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao']);

  if (isUnitLeaderOnly) {
    const departmentIds = await getDeanDepartmentIds(currentUser);
    if (!departmentIds.length) {
      throw new ServiceError('Tài khoản Lãnh đạo đơn vị chưa được gán mã khoa / phòng ban trực thuộc.', 403);
    }
    where.don_vi_chinh_id = { [Op.in]: departmentIds };
  } else if (don_vi_id) {
    if (!isValidUuid(don_vi_id)) {
      throw new ServiceError('Mã đơn vị không hợp lệ.', 400);
    }
    where.don_vi_chinh_id = don_vi_id;
  }

  if (vai_tro) {
    where.vai_tro_chinh = normalizeRole(vai_tro);
  }

  const activeFilter = kich_hoat !== undefined ? kich_hoat : dang_hoat_dong;
  if (activeFilter !== undefined && activeFilter !== '') {
    where.kich_hoat = activeFilter === 'true' || activeFilter === true;
  }

  if (tim_kiem && tim_kiem.trim()) {
    const likePattern = `%${tim_kiem.trim()}%`;
    where[Op.or] = [
      { ho_ten: { [Op.like]: likePattern } },
      { email: { [Op.like]: likePattern } },
      { ma_can_bo: { [Op.like]: likePattern } },
    ];
  }

  const { page: pageNum, limit: limitNum, offset } = normalizePagination(page ?? trang, limit ?? gioi_han, 100);

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
        attributes: ['nguoi_dung_id', 'ngay_dang_ky', 'so_luong_mau'],
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
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map(String);
    const userDeptId = String(user.don_vi_chinh_id || '');
    if (!allowedDeptIds.includes(userDeptId)) {
      throw new ServiceError('Bạn không có quyền xem thông tin nhân sự ngoài phạm vi quản lý của khoa.', 403);
    }
  }

  const template = await MauKhuonMat.findOne({
    where: { nguoi_dung_id: user.id, mac_dinh: true },
    attributes: ['ngay_dang_ky', 'so_luong_mau'],
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

  const requestedRoles = extractRequestedRoleCodes(finalRole, data.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!finalName) throw new ServiceError('Họ tên không được để trống.', 400);
  if (!finalEmail || !EMAIL_REGEX.test(finalEmail)) throw new ServiceError('Địa chỉ email không hợp lệ.', 400);
  if (!finalStaffCode) throw new ServiceError('Mã cán bộ / giảng viên không được để trống.', 400);
  if (!password || password.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);

  if (await NguoiDung.findOne({ where: { email: finalEmail } })) {
    throw new ServiceError('Email này đã được đăng ký trên hệ thống.', 409);
  }
  if (await NguoiDung.findOne({ where: { ma_can_bo: finalStaffCode } })) {
    throw new ServiceError('Mã cán bộ này đã tồn tại trên hệ thống.', 409);
  }

  await validateDepartmentRoleRule(finalRole, finalDeptId);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const rolesInput = Array.isArray(data.danh_sach_vai_tro) && data.danh_sach_vai_tro.length > 0
    ? data.danh_sach_vai_tro
    : buildDefaultRolesArray(finalRole, finalDeptId);

  let createdId = null;
  await runInTransaction(async (transaction) => {
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
        anh_dai_dien: data.anh_dai_dien || null,
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
        loai_hop_dong: data.loai_hop_dong || 'toan_thoi_gian',
        ngay_vao_lam: data.ngay_vao_lam || new Date().toISOString().slice(0, 10),
        ngay_het_han_hop_dong: data.ngay_het_han_hop_dong || null,
        hoc_ham: data.hoc_ham || 'khong',
        hoc_vi: data.hoc_vi || 'cu_nhan',
        ngach_luong: data.ngach_luong || 'V.07.01.03',
        he_so_luong: data.he_so_luong !== undefined ? Number(data.he_so_luong) : 2.34,
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

    const roleRows = rolesInput.map((r) => ({
      nguoi_dung_id: newUser.id,
      ma_vai_tro: normalizeRole(r.ma_vai_tro || finalRole),
      pham_vi: r.pham_vi || (finalDeptId ? 'khoa' : 'toan_truong'),
      don_vi_id: r.don_vi_id !== undefined ? r.don_vi_id : finalDeptId,
      duoc_uy_quyen: Boolean(r.duoc_uy_quyen),
      tu_ngay: r.tu_ngay || new Date().toISOString().slice(0, 10),
      den_ngay: r.den_ngay || null,
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

// Cập nhật tài khoản và hồ sơ cán bộ
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

  const payload = { ...data };
  if (isSelf && !isTopAdmin) {
    delete payload.vai_tro_chinh;
    delete payload.don_vi_chinh_id;
    delete payload.ma_can_bo;
    delete payload.he_so_luong;
    delete payload.ngach_luong;
    delete payload.han_muc_phep_nam;
    delete payload.kich_hoat;
    delete payload.dang_hoat_dong;
    delete payload.danh_sach_vai_tro;
    delete payload.trang_thai_lam_viec;
    delete payload.ngay_vao_lam;
    delete payload.mat_khau;
    delete payload.password;
  } else if (isUnitLeaderOnly) {
    const allowedDeptIds = (await getDeanDepartmentIds(currentUser)).map(String);
    if (!allowedDeptIds.includes(String(user.don_vi_chinh_id || ''))) {
      throw new ServiceError('Bạn không có quyền sửa thông tin nhân sự ngoài khoa của mình.', 403);
    }
    delete payload.vai_tro_chinh;
    delete payload.danh_sach_vai_tro;
    delete payload.don_vi_chinh_id;
    delete payload.ma_can_bo;
    delete payload.he_so_luong;
    delete payload.ngach_luong;
    delete payload.han_muc_phep_nam;
    delete payload.trang_thai_lam_viec;
    delete payload.ngay_vao_lam;
    delete payload.so_cccd;
    delete payload.ma_so_thue;
    delete payload.so_tai_khoan_ngan_hang;
    delete payload.ngay_het_han_hop_dong;
    delete payload.kich_hoat;
    delete payload.dang_hoat_dong;
    delete payload.mat_khau;
    delete payload.password;
  }

  const targetRole = normalizeRole(user.vai_tro_chinh);
  const requestedRoles = extractRequestedRoleCodes(payload.vai_tro_chinh, payload.danh_sach_vai_tro);
  assertRoleAssignmentAllowed(currentUser, requestedRoles);

  if (!isSelf) {
    if (targetRole === 'bgh' && !editorRoles.has('bgh') && (payload.kich_hoat !== undefined || payload.dang_hoat_dong !== undefined || payload.vai_tro_chinh !== undefined || payload.danh_sach_vai_tro !== undefined || payload.mat_khau !== undefined || payload.email !== undefined)) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Ban Giám Hiệu.', 403);
    }
    if (targetRole === 'admin' && !editorRoles.has('bgh') && (payload.kich_hoat !== undefined || payload.dang_hoat_dong !== undefined || payload.vai_tro_chinh !== undefined || payload.danh_sach_vai_tro !== undefined || payload.mat_khau !== undefined || payload.email !== undefined)) {
      throw new ServiceError('Chỉ Ban Giám Hiệu mới có quyền thay đổi thông tin nhạy cảm, trạng thái hoặc vai trò của tài khoản Quản trị viên.', 403);
    }
  }

  if (payload.ho_ten) user.ho_ten = payload.ho_ten.trim();

  if (payload.email && payload.email.trim().toLowerCase() !== user.email) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = await NguoiDung.findOne({ where: { email: normalizedEmail, id: { [Op.ne]: id } } });
    if (existing) throw new ServiceError('Email này đã được tài khoản khác sử dụng.', 409);
    user.email = normalizedEmail;
  }

  if (payload.ma_can_bo) {
    const code = payload.ma_can_bo.trim().toUpperCase();
    const existing = await NguoiDung.findOne({ where: { ma_can_bo: code, id: { [Op.ne]: id } } });
    if (existing) throw new ServiceError('Mã cán bộ này đã được tài khoản khác sử dụng.', 409);
    user.ma_can_bo = code;
  }

  if (payload.don_vi_chinh_id !== undefined) {
    user.don_vi_chinh_id = payload.don_vi_chinh_id || null;
  }
  if (payload.vai_tro_chinh) {
    user.vai_tro_chinh = normalizeRole(payload.vai_tro_chinh);
  }

  await validateDepartmentRoleRule(normalizeRole(user.vai_tro_chinh), user.don_vi_chinh_id);

  if (payload.so_dien_thoai !== undefined) user.so_dien_thoai = payload.so_dien_thoai || null;
  if (payload.trang_thai_lam_viec !== undefined) user.trang_thai_lam_viec = payload.trang_thai_lam_viec;
  if (payload.anh_dai_dien !== undefined) user.anh_dai_dien = payload.anh_dai_dien || null;

  const activeVal = payload.kich_hoat !== undefined ? payload.kich_hoat : payload.dang_hoat_dong;
  if (activeVal !== undefined) {
    user.kich_hoat = Boolean(activeVal);
    if (!user.kich_hoat) user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  }

  if (payload.mat_khau) {
    if (payload.mat_khau.length < 6) throw new ServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    const salt = await bcrypt.genSalt(10);
    user.mat_khau_ma_hoa = await bcrypt.hash(payload.mat_khau, salt);
    user.doi_mat_khau_luc = new Date();
    user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  }

  await runInTransaction(async (transaction) => {
    await user.save({ transaction });

    const profileUpdates = {};
    const profileFields = [
      'gioi_tinh', 'ngay_sinh', 'dia_chi', 'chuc_vu', 'loai_nhan_su',
      'loai_hop_dong', 'ngay_vao_lam', 'ngay_het_han_hop_dong', 'hoc_ham',
      'hoc_vi', 'ngach_luong', 'ngay_bat_dau_giang_day', 'so_cccd',
      'ma_so_thue', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
    ];
    for (const f of profileFields) {
      if (payload[f] !== undefined) profileUpdates[f] = payload[f] === '' ? null : payload[f];
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

    if (Array.isArray(payload.danh_sach_vai_tro)) {
      const nextRoles = payload.danh_sach_vai_tro;
      await VaiTroNguoiDung.destroy({ where: { nguoi_dung_id: id }, transaction });
      if (nextRoles.length > 0) {
        await VaiTroNguoiDung.bulkCreate(
          nextRoles.map((r) => ({
            nguoi_dung_id: id,
            ma_vai_tro: normalizeRole(r.ma_vai_tro || user.vai_tro_chinh),
            pham_vi: r.pham_vi || (user.don_vi_chinh_id ? 'khoa' : 'toan_truong'),
            don_vi_id: r.don_vi_id !== undefined ? r.don_vi_id : user.don_vi_chinh_id,
            duoc_uy_quyen: Boolean(r.duoc_uy_quyen),
            tu_ngay: r.tu_ngay || new Date().toISOString().slice(0, 10),
            den_ngay: r.den_ngay || null,
          })),
          { transaction }
        );
      }
    } else if (payload.vai_tro_chinh !== undefined) {
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
            tu_ngay: new Date().toISOString().slice(0, 10),
          },
          { transaction }
        );
      }
    }
  });

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

// Khóa mềm tài khoản người dùng
const softDeleteUser = async (id, currentUser, dia_chi_ip = null) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Mã người dùng không hợp lệ.', 400);
  }
  if (String(id) === String(currentUser.id)) {
    throw new ServiceError('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.', 400);
  }

  const user = await NguoiDung.findByPk(id);
  if (!user) throw new ServiceError('Không tìm thấy người dùng.', 404);

  const targetRole = normalizeRole(user.vai_tro_chinh);
  const editorRoles = getActiveUserRoles(currentUser);

  if (targetRole === 'bgh' && !editorRoles.has('bgh')) {
    throw new ServiceError('Chỉ Lãnh đạo Ban Giám Hiệu mới có quyền vô hiệu hóa tài khoản Ban Giám Hiệu.', 403);
  }
  if (targetRole === 'admin' && !editorRoles.has('bgh')) {
    throw new ServiceError('Chỉ Lãnh đạo Ban Giám Hiệu mới có quyền vô hiệu hóa tài khoản Quản trị viên.', 403);
  }

  user.kich_hoat = false;
  user.trang_thai_lam_viec = 'da_nghi_viec';
  user.phien_ban_token = (user.phien_ban_token || 1) + 1;
  await user.save();

  const { revokeUserGraceTokens } = require('../heThong/xacThuc.service');
  await revokeUserGraceTokens(user.id).catch(() => {});

  await MaLamMoi.update(
    { da_su_dung: true, thoi_diem_su_dung: new Date() },
    { where: { nguoi_dung_id: user.id, da_su_dung: false } }
  );

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
