// Xác định phạm vi đơn vị và danh sách nhân sự thuộc quyền quản lý của lãnh đạo khoa / đơn vị.
const { Op } = require('sequelize');
const { NguoiDung, PhongBan, VaiTroNguoiDung } = require('../models');
const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole, hasAnyActiveRole } = require('./vaiTro.utils');

const getTodayVietnamKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const isRoleRowActiveOnDate = (roleRow, todayKey) => {
  if (!roleRow) return false;
  const start = roleRow.tu_ngay ? String(roleRow.tu_ngay).slice(0, 10) : null;
  const end = roleRow.den_ngay ? String(roleRow.den_ngay).slice(0, 10) : null;
  if (start && start > todayKey) return false;
  if (end && end < todayKey) return false;
  return true;
};

// Kiểm tra người dùng có giữ vai trò lãnh đạo đơn vị (Trưởng/Phó khoa, bộ môn, phòng) còn hiệu lực
const isUnitLeader = (actor) => Boolean(actor && hasAnyActiveRole(actor, UNIT_LEADER_ROLES));

// Kiểm tra người dùng thuộc nhóm quản trị cấp trường còn hiệu lực
const isGlobalAdmin = (actor) => Boolean(actor && hasAnyActiveRole(actor, GLOBAL_ADMIN_ROLES));

// Lấy danh sách ID đơn vị thuộc quyền quản lý của trưởng đơn vị (gồm cả đơn vị kiêm nhiệm & bộ môn con)
const getDeanDepartmentIds = async (actor) => {
  if (!actor || !isUnitLeader(actor)) return [];

  const todayKey = getTodayVietnamKey();
  const rootDeptIds = new Set();
  const primaryRole = normalizeRole(actor.vai_tro_chinh);
  const actorRoles = Array.isArray(actor.danh_sach_vai_tro) ? actor.danh_sach_vai_tro : null;

  if (actor.don_vi_chinh_id && (UNIT_LEADER_ROLES.includes(primaryRole) || !actorRoles)) {
    rootDeptIds.add(String(actor.don_vi_chinh_id));
  }

  let effectiveRoleRows = actorRoles;
  if (!effectiveRoleRows || !actor.don_vi_chinh_id) {
    const userDoc = await NguoiDung.findByPk(actor.id, {
      attributes: ['id', 'vai_tro_chinh', 'don_vi_chinh_id'],
      include: [
        {
          model: VaiTroNguoiDung,
          as: 'danh_sach_vai_tro',
          attributes: ['ma_vai_tro', 'don_vi_id', 'tu_ngay', 'den_ngay'],
        },
      ],
    });
    if (
      userDoc?.don_vi_chinh_id &&
      (UNIT_LEADER_ROLES.includes(normalizeRole(userDoc.vai_tro_chinh)) || rootDeptIds.size === 0)
    ) {
      rootDeptIds.add(String(userDoc.don_vi_chinh_id));
    }
    if (!effectiveRoleRows && Array.isArray(userDoc?.danh_sach_vai_tro)) {
      effectiveRoleRows = userDoc.danh_sach_vai_tro;
    }
  }

  if (Array.isArray(effectiveRoleRows)) {
    for (const row of effectiveRoleRows) {
      if (!isRoleRowActiveOnDate(row, todayKey)) continue;
      if (!UNIT_LEADER_ROLES.includes(normalizeRole(row.ma_vai_tro || row.role))) continue;
      const scopedDeptId = row.don_vi_id || actor.don_vi_chinh_id;
      if (scopedDeptId) rootDeptIds.add(String(scopedDeptId));
    }
  }

  if (rootDeptIds.size === 0) return [];

  const allDeptIds = Array.from(rootDeptIds);
  let currentParentIds = Array.from(rootDeptIds);

  while (currentParentIds.length > 0) {
    const childDepts = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: currentParentIds } },
      attributes: ['id'],
      raw: true,
    });

    if (!childDepts || childDepts.length === 0) break;

    const newChildren = childDepts
      .map((d) => String(d.id))
      .filter((id) => !allDeptIds.includes(id));
    if (newChildren.length === 0) break;

    allDeptIds.push(...newChildren);
    currentParentIds = newChildren;
  }

  return allDeptIds;
};

// Lấy danh sách ID người dùng thuộc quyền quản lý của trưởng đơn vị
const getDeanScopedUserIds = async (actor) => {
  if (!actor || !isUnitLeader(actor)) return [];
  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return [];

  const todayKey = getTodayVietnamKey();
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

  const idSet = new Set([
    ...directUsers.map((u) => String(u.id)),
    ...roleUsers.map((r) => String(r.nguoi_dung_id)),
  ]);
  return Array.from(idSet);
};

// Kiểm tra người dùng mục tiêu có nằm trong phạm vi quản lý của trưởng đơn vị không
const isUserInDeanScope = async (actor, targetUserId) => {
  if (!actor) return false;
  if (isGlobalAdmin(actor)) return true;
  if (!isUnitLeader(actor) || !targetUserId) return false;

  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return false;

  const todayKey = getTodayVietnamKey();
  const targetUser = await NguoiDung.findByPk(targetUserId, {
    attributes: ['id', 'don_vi_chinh_id'],
    include: [
      {
        model: VaiTroNguoiDung,
        as: 'danh_sach_vai_tro',
        attributes: ['don_vi_id', 'tu_ngay', 'den_ngay'],
      },
    ],
  });
  if (!targetUser) return false;

  const userDepts = [];
  if (targetUser.don_vi_chinh_id) userDepts.push(String(targetUser.don_vi_chinh_id));
  if (Array.isArray(targetUser.danh_sach_vai_tro)) {
    targetUser.danh_sach_vai_tro.forEach((r) => {
      if (r.don_vi_id && isRoleRowActiveOnDate(r, todayKey)) {
        userDepts.push(String(r.don_vi_id));
      }
    });
  }

  return userDepts.some((id) => departmentIds.includes(id));
};

module.exports = {
  getDeanDepartmentIds,
  getDeanScopedUserIds,
  isUserInDeanScope,
};
