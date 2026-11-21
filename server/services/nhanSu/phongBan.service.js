// Quản lý cơ cấu khoa, bộ môn, phòng ban và đồng bộ vai trò trưởng đơn vị.
const { Op } = require('sequelize');
const { sequelize, PhongBan, NguoiDung, VaiTroNguoiDung, MonHoc, NhatKyKiemToan } = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { normalizeRole, getActiveUserRoles } = require('../../utils/vaiTro.utils');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');

const INCLUDE_RELATIONS = [
  { model: PhongBan, as: 'don_vi_cha', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] },
  {
    model: NguoiDung,
    as: 'truong_don_vi',
    attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'anh_dai_dien', 'trang_thai_lam_viec'],
  },
];

const DEPT_LEADER_META = {
  khoa: { role: 'truong_khoa', scope: 'khoa', fallbackRole: 'giang_vien' },
  bo_mon: { role: 'truong_bo_mon', scope: 'bo_mon', fallbackRole: 'giang_vien' },
  phong_ban: { role: 'truong_phong', scope: 'phong_ban', fallbackRole: 'nhan_vien' },
};

const getTodayVietnamDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Đồng bộ vai trò người phụ trách khi bổ nhiệm hoặc miễn nhiệm (Khoa / Bộ môn / Phòng ban)
const syncDepartmentManager = async (deptId, newDeptType, newManagerId, oldManagerId = null, oldDeptType = null, transaction = null) => {
  const txOpts = transaction ? { transaction } : {};
  const prevType = oldDeptType || newDeptType;
  const prevMeta = DEPT_LEADER_META[prevType];
  const nextMeta = DEPT_LEADER_META[newDeptType];

  const managerChanged = oldManagerId && (!newManagerId || String(oldManagerId) !== String(newManagerId) || prevType !== newDeptType);
  if (managerChanged && prevMeta) {
    await VaiTroNguoiDung.destroy({
      where: { nguoi_dung_id: oldManagerId, ma_vai_tro: prevMeta.role, don_vi_id: deptId },
      ...txOpts,
    });

    const otherManagedCount = await PhongBan.count({
      where: { id: { [Op.ne]: deptId }, truong_don_vi_id: oldManagerId, loai_don_vi: prevType },
      ...txOpts,
    });

    if (otherManagedCount === 0) {
      await NguoiDung.update(
        { vai_tro_chinh: prevMeta.fallbackRole },
        { where: { id: oldManagerId, vai_tro_chinh: prevMeta.role }, ...txOpts }
      );
    }
  }

  if (newManagerId && nextMeta) {
    const userToUpdate = await NguoiDung.findByPk(newManagerId, {
      include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro' }],
      ...txOpts,
    });
    if (userToUpdate && !getActiveUserRoles(userToUpdate).has('admin')) {
      const currentPrimaryRole = normalizeRole(userToUpdate.vai_tro_chinh);
      const updates = {};
      if (currentPrimaryRole !== 'bgh') {
        updates.vai_tro_chinh = nextMeta.role;
      }
      if (!userToUpdate.don_vi_chinh_id || (currentPrimaryRole !== 'bgh' && String(userToUpdate.don_vi_chinh_id) !== String(deptId))) {
        updates.don_vi_chinh_id = deptId;
      }
      if (Object.keys(updates).length > 0) {
        await userToUpdate.update(updates, txOpts);
      }

      const existingRole = await VaiTroNguoiDung.findOne({
        where: { nguoi_dung_id: newManagerId, ma_vai_tro: nextMeta.role, don_vi_id: deptId },
        ...txOpts,
      });
      if (!existingRole) {
        await VaiTroNguoiDung.create(
          {
            nguoi_dung_id: newManagerId,
            ma_vai_tro: nextMeta.role,
            pham_vi: nextMeta.scope,
            don_vi_id: deptId,
            tu_ngay: getTodayVietnamDate(),
          },
          txOpts
        );
      }
    }
  }
};

// Kiểm tra một đơn vị có phải con cháu của đơn vị khác để tránh vòng lặp cây tổ chức
const isDescendantOf = async (potentialAncestorId, targetDeptId) => {
  let currentId = potentialAncestorId;
  while (currentId) {
    if (String(currentId) === String(targetDeptId)) return true;
    const current = await PhongBan.findByPk(currentId, { attributes: ['id', 'don_vi_cha_id'] });
    currentId = current?.don_vi_cha_id || null;
  }
  return false;
};

// Kiểm tra quy tắc phân cấp (Khoa/Phòng ban trực thuộc trường, Bộ môn trực thuộc Khoa)
const validateDepartmentHierarchy = async (loaiDonVi, donViChaId) => {
  if (loaiDonVi === 'khoa' || loaiDonVi === 'phong_ban') {
    if (donViChaId !== null && donViChaId !== undefined && donViChaId !== '') {
      return `${loaiDonVi === 'khoa' ? 'Khoa' : 'Phòng ban'} là đơn vị cấp trường, bắt buộc trực thuộc Ban Giám hiệu (don_vi_cha_id phải là null).`;
    }
    return null;
  }

  if (loaiDonVi === 'bo_mon') {
    if (!donViChaId) {
      return 'Đơn vị loại Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo (don_vi_cha_id không được để trống).';
    }
    if (!isValidUuid(donViChaId)) {
      return 'ID đơn vị cha (don_vi_cha_id) không đúng định dạng UUID.';
    }
    const parentDept = await PhongBan.findByPk(donViChaId);
    if (!parentDept) {
      return 'Khoa trực thuộc (don_vi_cha_id) không tồn tại trên hệ thống.';
    }
    if (parentDept.loai_don_vi !== 'khoa') {
      return 'Bộ môn chỉ có thể trực thuộc một Khoa đào tạo. Đơn vị cha được chọn không phải là Khoa.';
    }
    return null;
  }

  return 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bo_mon hoặc phong_ban.';
};

// Kiểm tra điều kiện bổ nhiệm người phụ trách đơn vị (không cho Admin hoặc kiêm nhiệm nhiều Khoa)
const validateManagerEligibility = async (truongDonViId, loaiDonVi, currentDeptId = null, transaction = null) => {
  if (!truongDonViId) return null;
  if (!isValidUuid(truongDonViId)) {
    return 'ID người quản lý (truong_don_vi_id) không đúng định dạng UUID.';
  }

  const txOpts = transaction ? { transaction } : {};
  const manager = await NguoiDung.findByPk(truongDonViId, {
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro' }],
    ...txOpts,
  });
  if (!manager) {
    return 'Người quản lý (truong_don_vi_id) không tồn tại trên hệ thống.';
  }
  if (manager.kich_hoat === false || manager.trang_thai_lam_viec !== 'dang_lam_viec') {
    return 'Tài khoản của người quản lý đã bị vô hiệu hóa hoặc chưa được kích hoạt.';
  }

  const managerActiveRoles = getActiveUserRoles(manager);
  const managerRole = normalizeRole(manager.vai_tro_chinh);
  if (managerActiveRoles.has('admin')) {
    return 'Tài khoản Quản trị viên (Admin) không thể được bổ nhiệm làm Trưởng khoa hay người phụ trách đơn vị.';
  }

  const managerName = manager.ho_ten || 'Cán bộ';
  if (loaiDonVi === 'khoa') {
    const count = await PhongBan.count({
      where: {
        truong_don_vi_id: truongDonViId,
        loai_don_vi: 'khoa',
        ...(currentDeptId ? { id: { [Op.ne]: currentDeptId } } : {}),
      },
      ...txOpts,
    });
    if (count > 0) {
      return `Giảng viên "${managerName}" hiện đã là Trưởng khoa của một Khoa khác. Một cán bộ không thể kiêm nhiệm Trưởng khoa của nhiều Khoa cùng lúc.`;
    }
  } else if (managerRole === 'truong_khoa' || managerActiveRoles.has('truong_khoa')) {
    const facultyCount = await PhongBan.count({
      where: {
        truong_don_vi_id: truongDonViId,
        loai_don_vi: 'khoa',
        ...(currentDeptId ? { id: { [Op.ne]: currentDeptId } } : {}),
      },
      ...txOpts,
    });
    if (facultyCount > 0) {
      return `Người dùng "${managerName}" đang là Trưởng khoa của một Khoa khác, không thể kiêm nhiệm phụ trách Phòng ban hoặc Bộ môn.`;
    }
  }

  return null;
};

// Định dạng thông tin đơn vị kèm số lượng nhân sự, môn học và đối tượng quan hệ
const formatDepartmentDoc = (d, countMaps = null) => {
  if (!d) return null;
  const raw = d.toJSON ? d.toJSON() : { ...d };

  const parentObj = raw.don_vi_cha
    ? {
        id: raw.don_vi_cha.id,
        ten_phong_ban: raw.don_vi_cha.ten_phong_ban,
        loai_don_vi: raw.don_vi_cha.loai_don_vi,
      }
    : null;

  let managerObj = null;
  if (raw.truong_don_vi) {
    const m = raw.truong_don_vi;
    const vaiTro = normalizeRole(m.vai_tro_chinh);
    managerObj = {
      id: m.id,
      ho_ten: m.ho_ten || '',
      email: m.email || '',
      ma_can_bo: m.ma_can_bo || '',
      vai_tro_chinh: vaiTro,
      anh_dai_dien: m.anh_dai_dien || null,
      trang_thai_lam_viec: m.trang_thai_lam_viec,
    };
  }

  const viDo = raw.vi_do !== null && raw.vi_do !== undefined ? Number(raw.vi_do) : null;
  const kinhDo = raw.kinh_do !== null && raw.kinh_do !== undefined ? Number(raw.kinh_do) : null;
  const banKinhMet = raw.ban_kinh_met ?? 200;

  const idStr = raw.id ? String(raw.id) : '';
  const memberCount = countMaps?.userCounts?.get(idStr) ?? 0;
  const subjectCount = countMaps?.subjectCounts?.get(idStr) ?? 0;

  return {
    id: raw.id,
    ten_phong_ban: raw.ten_phong_ban,
    loai_don_vi: raw.loai_don_vi,
    don_vi_cha_id: raw.don_vi_cha_id || null,
    don_vi_cha: parentObj,
    truong_don_vi_id: raw.truong_don_vi_id || null,
    truong_don_vi: managerObj,
    vi_do: viDo,
    kinh_do: kinhDo,
    toa_do: { vi_do: viDo, kinh_do: kinhDo },
    ban_kinh_met: banKinhMet,
    so_luong_thanh_vien: memberCount,
    so_luong_mon_hoc: subjectCount,
    tao_luc: raw.tao_luc,
    cap_nhat_luc: raw.cap_nhat_luc,
  };
};

// Thống kê số lượng nhân sự đang làm việc và môn học theo từng đơn vị
const fetchDepartmentStatsMaps = async () => {
  try {
    const [userAgg, subjectAgg] = await Promise.all([
      NguoiDung.findAll({
        attributes: ['don_vi_chinh_id', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
        where: {
          don_vi_chinh_id: { [Op.ne]: null },
          kich_hoat: true,
          trang_thai_lam_viec: { [Op.ne]: 'da_nghi_viec' },
        },
        group: ['don_vi_chinh_id'],
        raw: true,
      }),
      MonHoc.findAll({
        attributes: ['phong_ban_id', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
        where: { phong_ban_id: { [Op.ne]: null } },
        group: ['phong_ban_id'],
        raw: true,
      }),
    ]);

    const userCounts = new Map(userAgg.map((i) => [String(i.don_vi_chinh_id), Number(i.cnt)]));
    const subjectCounts = new Map(subjectAgg.map((i) => [String(i.phong_ban_id), Number(i.cnt)]));
    return { userCounts, subjectCounts };
  } catch (err) {
    console.error('[DepartmentService] fetchDepartmentStatsMaps error:', err.message);
    return { userCounts: new Map(), subjectCounts: new Map() };
  }
};

// Dựng cấu trúc cây phân cấp Khoa -> Bộ môn từ danh sách phẳng
const buildDepartmentTree = (departments, parentId = null, visited = new Set(), depth = 0, maxDepth = 10) => {
  if (depth > maxDepth) return [];

  const result = [];
  const targetParentId = parentId ? String(parentId) : null;

  for (const dept of departments) {
    const rawParent = dept.don_vi_cha_id;
    const deptParentId = rawParent && typeof rawParent === 'object'
      ? (rawParent.id ? String(rawParent.id) : null)
      : (rawParent ? String(rawParent) : null);

    if (deptParentId === targetParentId) {
      const deptIdStr = String(dept.id);
      if (visited.has(deptIdStr)) continue;

      visited.add(deptIdStr);
      const children = buildDepartmentTree(departments, dept.id, new Set(visited), depth + 1, maxDepth);
      result.push({ ...dept, danh_sach_con: children });
    }
  }
  return result;
};

// Lấy danh sách đơn vị dạng cây phân cấp, phân trang hoặc danh sách phẳng
const getAllDepartments = async ({ loai_don_vi, don_vi_cha_id, cay = 'false', trang, gioi_han } = {}) => {
  const where = {};

  if (loai_don_vi) {
    if (!['khoa', 'bo_mon', 'phong_ban'].includes(loai_don_vi)) {
      throw new ServiceError('Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bo_mon hoặc phong_ban.', 400);
    }
    where.loai_don_vi = loai_don_vi;
  }

  let rootParentForTree = null;
  if (don_vi_cha_id !== undefined && don_vi_cha_id !== '') {
    if (don_vi_cha_id === 'null' || don_vi_cha_id === null) {
      where.don_vi_cha_id = null;
    } else {
      if (!isValidUuid(don_vi_cha_id)) {
        throw new ServiceError('ID đơn vị cha (don_vi_cha_id) không đúng định dạng UUID.', 400);
      }
      where.don_vi_cha_id = don_vi_cha_id;
      rootParentForTree = don_vi_cha_id;
    }
  }

  const countMaps = await fetchDepartmentStatsMaps();
  const isTreeMode = cay === 'true' || cay === true;

  if (isTreeMode) {
    const departments = await PhongBan.findAll({
      where,
      include: INCLUDE_RELATIONS,
      order: [['ten_phong_ban', 'ASC']],
    });
    const formattedDepts = departments.map((d) => formatDepartmentDoc(d, countMaps));
    if (loai_don_vi === 'bo_mon' && rootParentForTree === null) {
      return { isTree: true, data: formattedDepts.map((d) => ({ ...d, danh_sach_con: [] })) };
    }
    return { isTree: true, data: buildDepartmentTree(formattedDepts, rootParentForTree) };
  }

  if (trang !== undefined || gioi_han !== undefined) {
    const { page: pageNum, limit: limitNum, offset } = normalizePagination(trang || 1, gioi_han || 20, 200);
    const { count: total, rows: departments } = await PhongBan.findAndCountAll({
      where,
      include: INCLUDE_RELATIONS,
      order: [['ten_phong_ban', 'ASC']],
      offset,
      limit: limitNum,
      distinct: true,
    });
    return {
      isPaginated: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
      departments: departments.map((d) => formatDepartmentDoc(d, countMaps)),
    };
  }

  const departments = await PhongBan.findAll({
    where,
    include: INCLUDE_RELATIONS,
    order: [['ten_phong_ban', 'ASC']],
  });
  return { isFlat: true, data: departments.map((d) => formatDepartmentDoc(d, countMaps)) };
};

// Lấy chi tiết một đơn vị theo ID
const getDepartmentById = async (id) => {
  if (!isValidUuid(id)) throw new ServiceError('ID đơn vị không hợp lệ.', 400);
  const [department, countMaps] = await Promise.all([
    PhongBan.findByPk(id, { include: INCLUDE_RELATIONS }),
    fetchDepartmentStatsMaps(),
  ]);
  if (!department) throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);
  return formatDepartmentDoc(department, countMaps);
};

// Chuẩn hóa và kiểm tra tọa độ GPS cùng bán kính điểm danh hợp lệ
const parseCoordinatesAndRadius = (body = {}, current = null) => {
  const result = {};
  const hasLat = body.toa_do?.vi_do !== undefined || body.vi_do !== undefined;
  const hasLng = body.toa_do?.kinh_do !== undefined || body.kinh_do !== undefined;
  const hasRadius = body.ban_kinh_met !== undefined;

  if (hasLat) {
    const rawLat = body.toa_do?.vi_do !== undefined ? body.toa_do.vi_do : body.vi_do;
    if (rawLat === '' || rawLat === null) {
      result.vi_do = null;
    } else {
      const latNum = Number(rawLat);
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        throw new ServiceError('Vĩ độ (vi_do) phải là số thực hợp lệ trong khoảng [-90, 90].', 400);
      }
      result.vi_do = latNum;
    }
  } else if (!current) {
    result.vi_do = null;
  }

  if (hasLng) {
    const rawLng = body.toa_do?.kinh_do !== undefined ? body.toa_do.kinh_do : body.kinh_do;
    if (rawLng === '' || rawLng === null) {
      result.kinh_do = null;
    } else {
      const lngNum = Number(rawLng);
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        throw new ServiceError('Kinh độ (kinh_do) phải là số thực hợp lệ trong khoảng [-180, 180].', 400);
      }
      result.kinh_do = lngNum;
    }
  } else if (!current) {
    result.kinh_do = null;
  }

  if (hasRadius) {
    const rawRadius = body.ban_kinh_met;
    if (rawRadius === '' || rawRadius === null) {
      result.ban_kinh_met = 200;
    } else {
      const radiusNum = Number(rawRadius);
      if (!Number.isFinite(radiusNum) || radiusNum <= 0) {
        throw new ServiceError('Bán kính geofence (ban_kinh_met) phải là số dương lớn hơn 0.', 400);
      }
      result.ban_kinh_met = Math.round(radiusNum);
    }
  } else if (!current) {
    result.ban_kinh_met = 200;
  }

  return result;
};

// Tạo mới Khoa, Bộ môn hoặc Phòng ban và đồng bộ vai trò người phụ trách
const createDepartment = async (payload) => {
  const { ten_phong_ban, loai_don_vi, don_vi_cha_id, truong_don_vi_id, actorId, ipAddress } = payload || {};

  if (!ten_phong_ban || !loai_don_vi) {
    throw new ServiceError('Tên và loại đơn vị (khoa, bo_mon, phong_ban) là bắt buộc.', 400);
  }
  if (typeof ten_phong_ban !== 'string' || !ten_phong_ban.trim()) {
    throw new ServiceError('Tên đơn vị phải là chuỗi ký tự hợp lệ và không được để trống.', 400);
  }
  const trimmedName = ten_phong_ban.trim();
  if (trimmedName.length > 150) {
    throw new ServiceError('Tên đơn vị không được vượt quá 150 ký tự.', 400);
  }
  if (!['khoa', 'bo_mon', 'phong_ban'].includes(loai_don_vi)) {
    throw new ServiceError('Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bo_mon hoặc phong_ban.', 400);
  }

  const normalizedParentId = don_vi_cha_id === 'null' || don_vi_cha_id === '' || !don_vi_cha_id ? null : don_vi_cha_id;
  const coords = parseCoordinatesAndRadius(payload);

  const hierarchyError = await validateDepartmentHierarchy(loai_don_vi, normalizedParentId);
  if (hierarchyError) throw new ServiceError(hierarchyError, 400);

  let newDept = null;
  await runInTransaction(async (transaction) => {
    const duplicateDept = await PhongBan.findOne({
      where: {
        don_vi_cha_id: normalizedParentId,
        [Op.and]: sequelize.where(sequelize.fn('LOWER', sequelize.col('ten_phong_ban')), trimmedName.toLowerCase()),
      },
      transaction,
    });
    if (duplicateDept) {
      throw new ServiceError(`Đơn vị mang tên "${trimmedName}" đã tồn tại trong cùng cấp phân cấp.`, 409);
    }

    const managerError = await validateManagerEligibility(truong_don_vi_id, loai_don_vi, null, transaction);
    if (managerError) throw new ServiceError(managerError, 400);

    newDept = await PhongBan.create(
      {
        ten_phong_ban: trimmedName,
        loai_don_vi,
        don_vi_cha_id: normalizedParentId,
        truong_don_vi_id: truong_don_vi_id || null,
        vi_do: coords.vi_do,
        kinh_do: coords.kinh_do,
        ban_kinh_met: coords.ban_kinh_met,
      },
      { transaction }
    );

    if (newDept.truong_don_vi_id) {
      await syncDepartmentManager(newDept.id, newDept.loai_don_vi, newDept.truong_don_vi_id, null, null, transaction);
    }
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: actorId || null,
    loai_chu_the: 'user',
    hanh_dong: 'CREATE_DEPARTMENT',
    doi_tuong_id: String(newDept.id),
    loai_doi_tuong: 'phong_ban',
    dia_chi_ip: ipAddress || null,
    chi_tiet: {
      ten_phong_ban: newDept.ten_phong_ban,
      loai_don_vi: newDept.loai_don_vi,
      don_vi_cha_id: newDept.don_vi_cha_id,
      truong_don_vi_id: newDept.truong_don_vi_id,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return getDepartmentById(newDept.id);
};

// Cập nhật thông tin đơn vị, tọa độ geofence và người phụ trách
const updateDepartment = async ({ id, body = {}, actorId, ipAddress }) => {
  if (!isValidUuid(id)) throw new ServiceError('ID đơn vị không hợp lệ.', 400);
  const existingDept = await PhongBan.findByPk(id);
  if (!existingDept) throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);

  const { ten_phong_ban, loai_don_vi, don_vi_cha_id, truong_don_vi_id } = body;

  const nextType = loai_don_vi !== undefined ? loai_don_vi : existingDept.loai_don_vi;
  if (!['khoa', 'bo_mon', 'phong_ban'].includes(nextType)) {
    throw new ServiceError('Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bo_mon hoặc phong_ban.', 400);
  }

  let nextParent = existingDept.don_vi_cha_id;
  if (don_vi_cha_id !== undefined) {
    nextParent = don_vi_cha_id === 'null' || don_vi_cha_id === '' || !don_vi_cha_id ? null : don_vi_cha_id;
  }

  if (nextParent && String(nextParent) === String(id)) {
    throw new ServiceError('Một đơn vị không thể làm đơn vị cha của chính nó.', 400);
  }
  if (nextParent && (await isDescendantOf(nextParent, id))) {
    throw new ServiceError('Lỗi vòng lặp: Không thể chọn đơn vị con/cháu làm đơn vị cha.', 400);
  }

  if (loai_don_vi !== undefined || don_vi_cha_id !== undefined) {
    const hierarchyError = await validateDepartmentHierarchy(nextType, nextParent);
    if (hierarchyError) throw new ServiceError(hierarchyError, 400);
  }

  if (nextType !== 'khoa') {
    const childCount = await PhongBan.count({ where: { don_vi_cha_id: id } });
    if (childCount > 0) {
      throw new ServiceError(
        `Không thể chuyển đổi loại đơn vị vì đang có ${childCount} đơn vị con trực thuộc.`,
        400
      );
    }
  }

  const nextName = ten_phong_ban !== undefined ? String(ten_phong_ban).trim() : existingDept.ten_phong_ban;
  if (!nextName || nextName.length > 150) {
    throw new ServiceError('Tên đơn vị không hợp lệ (1 - 150 ký tự).', 400);
  }

  const nextManager = truong_don_vi_id !== undefined ? (truong_don_vi_id || null) : existingDept.truong_don_vi_id;
  const coords = parseCoordinatesAndRadius(body, existingDept);

  const oldManagerId = existingDept.truong_don_vi_id;
  const oldDeptType = existingDept.loai_don_vi;

  await runInTransaction(async (transaction) => {
    if (ten_phong_ban !== undefined || don_vi_cha_id !== undefined) {
      const duplicate = await PhongBan.findOne({
        where: {
          id: { [Op.ne]: id },
          don_vi_cha_id: nextParent,
          [Op.and]: sequelize.where(sequelize.fn('LOWER', sequelize.col('ten_phong_ban')), nextName.toLowerCase()),
        },
        transaction,
      });
      if (duplicate) {
        throw new ServiceError(`Đơn vị mang tên "${nextName}" đã tồn tại trong cùng cấp phân cấp.`, 409);
      }
    }

    if (truong_don_vi_id !== undefined || loai_don_vi !== undefined) {
      const managerError = await validateManagerEligibility(nextManager, nextType, id, transaction);
      if (managerError) throw new ServiceError(managerError, 400);
    }

    const updates = {
      ten_phong_ban: nextName,
      loai_don_vi: nextType,
      don_vi_cha_id: nextParent,
      truong_don_vi_id: nextManager,
      ...coords,
    };

    await existingDept.update(updates, { transaction });
    await syncDepartmentManager(id, nextType, nextManager, oldManagerId, oldDeptType, transaction);
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: actorId || null,
    loai_chu_the: 'user',
    hanh_dong: 'UPDATE_DEPARTMENT',
    doi_tuong_id: String(id),
    loai_doi_tuong: 'phong_ban',
    dia_chi_ip: ipAddress || null,
    chi_tiet: {
      ten_phong_ban: nextName,
      loai_don_vi: nextType,
      don_vi_cha_id: nextParent,
      truong_don_vi_id: nextManager,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return getDepartmentById(id);
};

// Xóa đơn vị nếu chưa có nhân sự, môn học hay đơn vị con trực thuộc
const deleteDepartment = async ({ id, actorId, ipAddress }) => {
  if (!isValidUuid(id)) throw new ServiceError('ID đơn vị không hợp lệ.', 400);
  let deletedDept = null;

  await runInTransaction(async (transaction) => {
    const txOpts = { transaction };

    const userCount = await NguoiDung.count({ where: { don_vi_chinh_id: id }, ...txOpts });
    if (userCount > 0) {
      throw new ServiceError(`Không thể xóa đơn vị vì đang có ${userCount} cán bộ/giảng viên trực thuộc.`, 400);
    }

    const childDeptCount = await PhongBan.count({ where: { don_vi_cha_id: id }, ...txOpts });
    if (childDeptCount > 0) {
      throw new ServiceError(`Không thể xóa đơn vị vì đang có ${childDeptCount} bộ môn/đơn vị con trực thuộc.`, 400);
    }

    const subjectCount = await MonHoc.count({ where: { phong_ban_id: id }, ...txOpts });
    if (subjectCount > 0) {
      throw new ServiceError(`Không thể xóa đơn vị vì đang có ${subjectCount} môn học thuộc đơn vị này.`, 400);
    }

    await VaiTroNguoiDung.destroy({ where: { don_vi_id: id }, ...txOpts });

    deletedDept = await PhongBan.findByPk(id, txOpts);
    if (!deletedDept) {
      throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);
    }

    await deletedDept.destroy(txOpts);

    const leaderMeta = DEPT_LEADER_META[deletedDept.loai_don_vi];
    if (deletedDept.truong_don_vi_id && leaderMeta) {
      await VaiTroNguoiDung.destroy({
        where: { nguoi_dung_id: deletedDept.truong_don_vi_id, ma_vai_tro: leaderMeta.role, don_vi_id: id },
        ...txOpts,
      });

      const otherDeptCount = await PhongBan.count({
        where: { id: { [Op.ne]: id }, truong_don_vi_id: deletedDept.truong_don_vi_id, loai_don_vi: deletedDept.loai_don_vi },
        ...txOpts,
      });
      if (otherDeptCount === 0) {
        await NguoiDung.update(
          { vai_tro_chinh: leaderMeta.fallbackRole },
          { where: { id: deletedDept.truong_don_vi_id, vai_tro_chinh: leaderMeta.role }, ...txOpts }
        );
      }
    }
  });

  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: actorId || null,
    loai_chu_the: 'user',
    hanh_dong: 'DELETE_DEPARTMENT',
    doi_tuong_id: String(id),
    loai_doi_tuong: 'phong_ban',
    dia_chi_ip: ipAddress || null,
    chi_tiet: {
      ten_phong_ban: deletedDept.ten_phong_ban,
      loai_don_vi: deletedDept.loai_don_vi,
    },
  }).catch((err) => console.error('[AuditLog Error]:', err.message));

  return { message: 'Xóa Khoa / Phòng ban thành công.', department: deletedDept };
};

module.exports = {
  ServiceError,
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  validateDepartmentHierarchy,
  validateManagerEligibility,
};
