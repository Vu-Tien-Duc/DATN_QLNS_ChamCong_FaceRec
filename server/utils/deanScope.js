const User = require('../models/user.model');
const Department = require('../models/department.model');

const { UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES, normalizeRole } = require('./roleUtils');

const isUnitLeader = (actor) => {
  if (!actor) return false;
  const role = normalizeRole(actor.role || actor.primaryRole || actor.vai_tro_chinh);
  if (UNIT_LEADER_ROLES.includes(role)) return true;
  const roles = actor.roles || actor.danh_sach_vai_tro || [];
  return (
    Array.isArray(roles) &&
    roles.some((r) => {
      const rName = normalizeRole(r.role || r.ma_vai_tro);
      return UNIT_LEADER_ROLES.includes(rName);
    })
  );
};

const isGlobalAdmin = (actor) => {
  if (!actor) return false;
  const role = normalizeRole(actor.role || actor.primaryRole || actor.vai_tro_chinh);
  if (GLOBAL_ADMIN_ROLES.includes(role)) return true;
  const roles = actor.roles || actor.danh_sach_vai_tro || [];
  return (
    Array.isArray(roles) &&
    roles.some((r) => {
      const rName = normalizeRole(r.role || r.ma_vai_tro);
      return GLOBAL_ADMIN_ROLES.includes(rName);
    })
  );
};

/**
 * Lấy danh sách ID phòng ban thuộc phạm vi quản lý của Trưởng khoa / Trưởng đơn vị (gồm Khoa và các Bộ môn con)
 * @param {Object} actor - User object (req.user hoặc instance User)
 * @returns {Promise<Array<string|ObjectId>>} Danh sách departmentId
 */
const getDeanDepartmentIds = async (actor) => {
  if (!actor) return [];
  if (!isUnitLeader(actor)) return [];

  let myDeptId = actor.departmentId || actor.don_vi_chinh_id;
  if (!myDeptId) {
    const userDoc = await User.findById(actor.id || actor._id).select('don_vi_chinh_id departmentId danh_sach_vai_tro');
    myDeptId = userDoc?.don_vi_chinh_id || userDoc?.departmentId;
    if (!myDeptId && userDoc?.danh_sach_vai_tro?.length) {
      const unitRole = userDoc.danh_sach_vai_tro.find((r) => r.don_vi_id || r.departmentId);
      if (unitRole) myDeptId = unitRole.don_vi_id || unitRole.departmentId;
    }
  }
  if (!myDeptId) return [];

  // Đệ quy đa cấp (BFS) tìm toàn bộ phòng ban con, cháu trong cây phân cấp
  // Hỗ trợ cả trường CSDL v2.5 'don_vi_cha_id' lẫn alias 'parentId'
  const allDeptIds = [myDeptId];
  let currentParentIds = [myDeptId];

  while (currentParentIds.length > 0) {
    const childDepts = await Department.find({
      parentId: { $in: currentParentIds },
    }).distinct('_id');

    if (!childDepts || childDepts.length === 0) break;

    // Lọc các đơn vị mới chưa có trong allDeptIds để chống chu trình vô hạn
    const newChildren = childDepts.filter(
      (id) => !allDeptIds.some((existing) => existing.toString() === id.toString())
    );
    if (newChildren.length === 0) break;

    allDeptIds.push(...newChildren);
    currentParentIds = newChildren;
  }

  return allDeptIds;
};

/**
 * Lấy danh sách User ID thuộc phạm vi quản lý của Trưởng khoa / Trưởng đơn vị (toàn bộ nhân sự trong Khoa & Bộ môn con)
 * @param {Object} actor - User object (req.user hoặc instance User)
 * @returns {Promise<Array<string>>} Mảng chuỗi ID người dùng
 */
const getDeanScopedUserIds = async (actor) => {
  if (!actor || !isUnitLeader(actor)) return [];
  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return [];

  const users = await User.find({
    $or: [
      { departmentId: { $in: departmentIds } },
      { 'danh_sach_vai_tro.don_vi_id': { $in: departmentIds } },
    ],
  }).select('_id');

  return users.map((u) => u._id.toString());
};

/**
 * Kiểm tra xem một user mục tiêu có nằm trong phạm vi quản lý của Trưởng đơn vị hay không
 * @param {Object} actor - User thực hiện (req.user)
 * @param {string|ObjectId} targetUserId - ID của user cần kiểm tra
 * @returns {Promise<boolean>} true nếu hợp lệ hoặc actor là admin
 */
const isUserInDeanScope = async (actor, targetUserId) => {
  if (!actor) return false;
  if (isGlobalAdmin(actor)) return true;
  if (!isUnitLeader(actor)) return false;
  if (!targetUserId) return false;

  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return false;

  const targetUser = await User.findById(targetUserId).select('don_vi_chinh_id departmentId danh_sach_vai_tro');
  if (!targetUser) return false;

  const userDepts = [];
  if (targetUser.don_vi_chinh_id) userDepts.push(targetUser.don_vi_chinh_id.toString());
  if (targetUser.departmentId) userDepts.push(targetUser.departmentId.toString());
  if (Array.isArray(targetUser.danh_sach_vai_tro)) {
    targetUser.danh_sach_vai_tro.forEach((r) => {
      if (r.don_vi_id) userDepts.push(r.don_vi_id.toString());
      if (r.departmentId) userDepts.push(r.departmentId.toString());
    });
  }

  const deptIdStrings = departmentIds.map((id) => id.toString());
  return userDepts.some((id) => deptIdStrings.includes(id));
};

module.exports = {
  getDeanDepartmentIds,
  getDeanScopedUserIds,
  isUserInDeanScope,
};
