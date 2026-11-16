const { Op } = require('sequelize');
const { NguoiDung, PhongBan, VaiTroNguoiDung } = require('../models');
const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole } = require('./vaiTro.utils');

const isUnitLeader = (actor) => {
  if (!actor) return false;
  const role = normalizeRole(actor.vai_tro_chinh);
  if (UNIT_LEADER_ROLES.includes(role)) return true;
  const roles = actor.danh_sach_vai_tro || [];
  return Array.isArray(roles) && roles.some((r) => UNIT_LEADER_ROLES.includes(normalizeRole(r.ma_vai_tro)));
};

const isGlobalAdmin = (actor) => {
  if (!actor) return false;
  const role = normalizeRole(actor.vai_tro_chinh);
  if (GLOBAL_ADMIN_ROLES.includes(role)) return true;
  const roles = actor.danh_sach_vai_tro || [];
  return Array.isArray(roles) && roles.some((r) => GLOBAL_ADMIN_ROLES.includes(normalizeRole(r.ma_vai_tro)));
};

/**
 * Lấy danh sách ID đơn vị thuộc phạm vi quản lý của Trưởng khoa / Trưởng đơn vị (gồm Khoa và các Bộ môn con)
 */
const getDeanDepartmentIds = async (actor) => {
  if (!actor || !isUnitLeader(actor)) return [];

  let myDeptId = actor.don_vi_chinh_id;
  if (!myDeptId) {
    const userDoc = await NguoiDung.findByPk(actor.id, {
      attributes: ['id', 'don_vi_chinh_id'],
      include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['don_vi_id'] }],
    });
    myDeptId = userDoc?.don_vi_chinh_id;
    if (!myDeptId && userDoc?.danh_sach_vai_tro?.length) {
      const unitRole = userDoc.danh_sach_vai_tro.find((r) => r.don_vi_id);
      if (unitRole) myDeptId = unitRole.don_vi_id;
    }
  }
  if (!myDeptId) return [];

  const allDeptIds = [String(myDeptId)];
  let currentParentIds = [String(myDeptId)];

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

/**
 * Lấy danh sách ID người dùng thuộc phạm vi quản lý của Trưởng khoa / Trưởng đơn vị
 */
const getDeanScopedUserIds = async (actor) => {
  if (!actor || !isUnitLeader(actor)) return [];
  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return [];

  const [directUsers, roleUsers] = await Promise.all([
    NguoiDung.findAll({
      where: { don_vi_chinh_id: { [Op.in]: departmentIds } },
      attributes: ['id'],
      raw: true,
    }),
    VaiTroNguoiDung.findAll({
      where: { don_vi_id: { [Op.in]: departmentIds } },
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

/**
 * Kiểm tra xem một user mục tiêu có nằm trong phạm vi quản lý của Trưởng đơn vị hay không
 */
const isUserInDeanScope = async (actor, targetUserId) => {
  if (!actor) return false;
  if (isGlobalAdmin(actor)) return true;
  if (!isUnitLeader(actor) || !targetUserId) return false;

  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return false;

  const targetUser = await NguoiDung.findByPk(targetUserId, {
    attributes: ['id', 'don_vi_chinh_id'],
    include: [{ model: VaiTroNguoiDung, as: 'danh_sach_vai_tro', attributes: ['don_vi_id'] }],
  });
  if (!targetUser) return false;

  const userDepts = [];
  if (targetUser.don_vi_chinh_id) userDepts.push(String(targetUser.don_vi_chinh_id));
  if (Array.isArray(targetUser.danh_sach_vai_tro)) {
    targetUser.danh_sach_vai_tro.forEach((r) => {
      if (r.don_vi_id) userDepts.push(String(r.don_vi_id));
    });
  }

  return userDepts.some((id) => departmentIds.includes(id));
};

module.exports = {
  getDeanDepartmentIds,
  getDeanScopedUserIds,
  isUserInDeanScope,
};
