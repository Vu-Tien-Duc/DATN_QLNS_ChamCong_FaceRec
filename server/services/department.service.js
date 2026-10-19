/**
 * Quản lý cây khoa/phòng ban, người phụ trách, phạm vi tổ chức và nhật ký thay đổi.
 */
const mongoose = require('mongoose');
const Department = require('../models/department.model');
const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');
const { runInTransaction } = require('../utils/transaction');

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
 * Tự động đồng bộ vai trò (role) và khoa (departmentId) của người dùng khi được bổ nhiệm hoặc thôi chức
 * Chỉ can thiệp vào vai trò 'truongkhoa' khi đơn vị liên quan là 'khoa'.
 */
const syncDepartmentManager = async (deptId, newDeptType, newManagerId, oldManagerId = null, oldDeptType = null, session = null) => {
  // 1. Xử lý Trưởng đơn vị cũ (nếu có và đơn vị cũ là 'khoa' hoặc nay bị đổi khỏi 'khoa')
  const shouldCheckOldDean = (oldDeptType || newDeptType) === 'khoa';
  if (oldManagerId && shouldCheckOldDean && (!newManagerId || oldManagerId.toString() !== newManagerId.toString() || newDeptType !== 'khoa')) {
    const countQuery = Department.countDocuments({
      _id: { $ne: deptId },
      managerId: oldManagerId,
      type: 'khoa',
    });
    if (session) countQuery.session(session);
    const otherFacultyCount = await countQuery;

    if (otherFacultyCount === 0) {
      await User.findOneAndUpdate(
        { _id: oldManagerId, role: 'truongkhoa' },
        { role: 'giangvien' },
        session ? { session } : {}
      );
    }
  }

  // 2. Xử lý Trưởng đơn vị mới được chỉ định (chỉ nâng 'truongkhoa' nếu đơn vị là 'khoa')
  if (newManagerId) {
    const userQuery = User.findById(newManagerId);
    if (session) userQuery.session(session);
    const userToUpdate = await userQuery;

    if (userToUpdate) {
      const updates = {};
      if (newDeptType === 'khoa' && userToUpdate.role !== 'admin') {
        updates.role = 'truongkhoa';
        if (!userToUpdate.departmentId || userToUpdate.departmentId.toString() !== deptId.toString()) {
          updates.departmentId = deptId;
        }
      }
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(newManagerId, updates, session ? { session } : {});
      }
    }
  }
};

/**
 * Kiểm tra xem potentialAncestorId có phải là con/cháu của targetDeptId không (chống vòng lặp tham chiếu)
 */
const isDescendantOf = async (potentialAncestorId, targetDeptId) => {
  let currentId = potentialAncestorId;
  while (currentId) {
    if (currentId.toString() === targetDeptId.toString()) {
      return true;
    }
    const current = await Department.findById(currentId).select('parentId');
    currentId = current && current.parentId ? current.parentId : null;
  }
  return false;
};

/**
 * Kiểm tra ràng buộc phân cấp cây tổ chức theo quy chuẩn đại học:
 * - Bộ môn ('bomon'): Bắt buộc trực thuộc một Khoa đào tạo ('khoa'). Không được có con.
 * - Khoa ('khoa'): Trực thuộc Trường/BGH (bắt buộc parentId = null).
 * - Phòng ban ('phongban'): Trực thuộc Trường/BGH (bắt buộc parentId = null).
 */
const validateDepartmentHierarchy = async (type, parentId) => {
  if (type === 'khoa' || type === 'phongban') {
    if (parentId !== null && parentId !== undefined && parentId !== '') {
      return `${type === 'khoa' ? 'Khoa' : 'Phòng ban'} là đơn vị cấp trường, bắt buộc trực thuộc Ban Giám hiệu (parentId phải là null).`;
    }
    return null;
  }

  if (type === 'bomon') {
    if (!parentId) {
      return 'Đơn vị loại Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo (parentId không được để trống).';
    }
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.';
    }
    const parentDept = await Department.findById(parentId);
    if (!parentDept) {
      return 'Khoa trực thuộc (parentId) không tồn tại trên hệ thống.';
    }
    if (parentDept.type !== 'khoa') {
      return 'Bộ môn chỉ có thể trực thuộc một Khoa đào tạo. Đơn vị cha được chọn không phải là Khoa.';
    }
    return null;
  }

  return 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.';
};

/**
 * Kiểm tra tính hợp lệ và điều kiện bổ nhiệm của người quản lý (managerId)
 */
const validateManagerEligibility = async (managerId, deptType, currentDeptId = null, session = null) => {
  if (!managerId) return null;

  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    return 'ID người quản lý (managerId) không đúng định dạng ObjectId.';
  }

  const userQuery = User.findById(managerId);
  if (session) userQuery.session(session);
  const manager = await userQuery;

  if (!manager) {
    return 'Người quản lý (managerId) không tồn tại trên hệ thống.';
  }

  if (!manager.isActive) {
    return 'Tài khoản của người quản lý đã bị vô hiệu hóa hoặc chưa được kích hoạt.';
  }

  if (manager.role === 'admin') {
    return 'Tài khoản Quản trị viên (Admin) không thể được bổ nhiệm làm Trưởng khoa hay người phụ trách đơn vị.';
  }

  if (deptType === 'khoa') {
    const filter = {
      managerId,
      type: 'khoa',
    };
    if (currentDeptId) {
      filter._id = { $ne: currentDeptId };
    }
    const checkOtherFaculty = Department.countDocuments(filter);
    if (session) checkOtherFaculty.session(session);
    const count = await checkOtherFaculty;
    if (count > 0) {
      return `Giảng viên "${manager.fullName}" hiện đã là Trưởng khoa của một Khoa khác. Một cán bộ không thể kiêm nhiệm Trưởng khoa của nhiều Khoa cùng lúc.`;
    }
  } else {
    if (manager.role === 'truongkhoa') {
      const checkFaculty = Department.countDocuments({
        managerId,
        type: 'khoa',
        ...(currentDeptId ? { _id: { $ne: currentDeptId } } : {}),
      });
      if (session) checkFaculty.session(session);
      const facultyCount = await checkFaculty;
      if (facultyCount > 0) {
        return `Người dùng "${manager.fullName}" đang là Trưởng khoa của một Khoa khác, không thể kiêm nhiệm phụ trách Phòng ban hoặc Bộ môn.`;
      }
    }
  }

  return null;
};

/**
 * Chuẩn hóa đối tượng phòng ban tương thích 2 chiều tiếng Anh & tiếng Việt
 */
const formatDepartmentDoc = (d) => {
  if (!d) return null;
  const raw = d.toObject ? d.toObject({ virtuals: true }) : { ...d };

  const rawParent = raw.parentId;
  let parentObj = null;
  if (rawParent && typeof rawParent === 'object') {
    parentObj = {
      _id: rawParent._id,
      name: rawParent.name || '',
      type: rawParent.type || 'khoa',
    };
  } else if (rawParent) {
    parentObj = rawParent;
  }

  const rawManager = raw.managerId;
  let managerObj = null;
  if (rawManager && typeof rawManager === 'object') {
    managerObj = {
      _id: rawManager._id,
      fullName: rawManager.fullName || '',
      email: rawManager.email || '',
      role: rawManager.role || 'giangvien',
      avatar: rawManager.avatar || null,
      isActive: rawManager.isActive !== undefined ? rawManager.isActive : true,
    };
  } else if (rawManager) {
    managerObj = rawManager;
  }

  const lat = raw.location?.lat ?? null;
  const lng = raw.location?.lng ?? null;

  return {
    ...raw,
    name: raw.name || '',
    type: raw.type || 'khoa',
    parentId: parentObj,
    managerId: managerObj,
    location: { lat, lng },
  };
};

/**
 * Xây dựng cây tổ chức phân cấp
 */
const buildDepartmentTree = (departments, parentId = null, visited = new Set(), depth = 0, maxDepth = 10) => {
  if (depth > maxDepth) {
    console.warn(
      `⚠️ [BUILD TREE WARNING]: Đã vượt quá độ sâu tối đa cho phép (${maxDepth}) tại nhánh parentId=${parentId}.`
    );
    return [];
  }
  const tree = [];
  for (const dept of departments) {
    const deptIdStr = dept._id ? dept._id.toString() : null;
    if (!deptIdStr || visited.has(deptIdStr)) continue;

    const rawParent = dept.parentId;
    const currentParentId = rawParent
      ? (rawParent._id ? rawParent._id.toString() : rawParent.toString())
      : null;
    const targetParentId = parentId ? parentId.toString() : null;

    if (currentParentId === targetParentId) {
      visited.add(deptIdStr);
      const children = buildDepartmentTree(departments, dept._id, new Set(visited), depth + 1, maxDepth);
      const deptObj = formatDepartmentDoc(dept);
      if (children.length > 0) {
        deptObj.children = children;
      }
      tree.push(deptObj);
    }
  }
  return tree;
};

/**
 * Lấy danh sách Khoa / Phòng ban
 */
const getAllDepartments = async ({ type, parentId, tree = 'true', page, limit }) => {
  const query = {};

  if (type) query.type = type;
  if (parentId !== undefined) query.parentId = parentId === 'null' ? null : parentId;

  // Cấu trúc cây phân cấp
  if (tree === 'true' && !type && parentId === undefined) {
    const departments = await Department.find(query)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role avatar isActive')
      .sort({ name: 1 });

    const formattedDepts = departments.map(formatDepartmentDoc);
    const treeData = buildDepartmentTree(formattedDepts);
    return { isTree: true, data: treeData };
  }

  // Danh sách phẳng có phân trang
  if (page && limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [departments, total] = await Promise.all([
      Department.find(query)
        .populate('parentId', 'name type')
        .populate('managerId', 'fullName email role avatar isActive')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
      Department.countDocuments(query),
    ]);

    const formattedDepts = departments.map(formatDepartmentDoc);
    return {
      isPaginated: true,
      data: {
        departments: formattedDepts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    };
  }

  // Danh sách phẳng không phân trang
  const departments = await Department.find(query)
    .populate('parentId', 'name type')
    .populate('managerId', 'fullName email role avatar isActive')
    .sort({ name: 1 });

  const formattedDepts = departments.map(formatDepartmentDoc);
  return { isFlat: true, data: formattedDepts };
};

/**
 * Lấy chi tiết Khoa / Phòng ban theo ID
 */
const getDepartmentById = async (id) => {
  const department = await Department.findById(id)
    .populate('parentId', 'name type')
    .populate('managerId', 'fullName email role avatar isActive');

  if (!department) {
    throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);
  }
  return formatDepartmentDoc(department);
};

/**
 * Tạo mới Khoa / Phòng ban
 */
const createDepartment = async ({ name, type, parentId, managerId, location, actorId, ipAddress }) => {
  if (!name || !type) {
    throw new ServiceError('Tên và loại đơn vị (khoa, bomon, phongban) là bắt buộc.', 400);
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new ServiceError('Tên đơn vị phải là chuỗi ký tự hợp lệ và không được để trống.', 400);
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 150) {
    throw new ServiceError('Tên đơn vị không được vượt quá 150 ký tự.', 400);
  }

  if (!['khoa', 'bomon', 'phongban'].includes(type)) {
    throw new ServiceError('Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.', 400);
  }

  const normalizedParentId = parentId === 'null' || parentId === '' || !parentId ? null : parentId;

  // 1. Kiểm tra trùng lặp tên đơn vị trong cùng cấp phân cấp
  const duplicateDept = await Department.findOne({
    name: { $regex: new RegExp(`^${trimmedName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
    parentId: normalizedParentId,
  });
  if (duplicateDept) {
    throw new ServiceError(`Đơn vị mang tên "${trimmedName}" đã tồn tại trong cùng cấp phân cấp.`, 409);
  }

  // 2. Kiểm tra ràng buộc phân cấp cây tổ chức
  const hierarchyError = await validateDepartmentHierarchy(type, normalizedParentId);
  if (hierarchyError) {
    throw new ServiceError(hierarchyError, 400);
  }

  // 3. Kiểm tra tính hợp lệ của người quản lý
  const managerError = await validateManagerEligibility(managerId, type);
  if (managerError) {
    throw new ServiceError(managerError, 400);
  }

  let newDept = null;
  await runInTransaction(async (session) => {
    const createOptions = session ? { session } : {};
    const [created] = await Department.create(
      [
        {
          name: trimmedName,
          type,
          parentId: normalizedParentId,
          managerId: managerId || null,
          location: location || { lat: null, lng: null },
        },
      ],
      createOptions
    );
    newDept = created;

    if (newDept.managerId) {
      await syncDepartmentManager(newDept._id, newDept.type, newDept.managerId, null, null, session);
    }
  });

  await AuditLog.create({
    actor: actorId,
    action: 'CREATE_DEPARTMENT',
    targetId: newDept._id.toString(),
    targetType: 'Department',
    ipAddress: ipAddress || null,
    timestamp: new Date(),
    details: {
      name: newDept.name,
      type: newDept.type,
      parentId: newDept.parentId,
      managerId: newDept.managerId,
    },
  });

  const populatedDept = await Department.findById(newDept._id)
    .populate('parentId', 'name type')
    .populate('managerId', 'fullName email role avatar');

  return populatedDept;
};

/**
 * Cập nhật Khoa / Phòng ban
 */
const updateDepartment = async ({ id, body, actorId, ipAddress }) => {
  const existingDept = await Department.findById(id);
  if (!existingDept) {
    throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);
  }

  const newType = body.type !== undefined ? body.type : existingDept.type;
  const newParentId = body.parentId !== undefined
    ? (body.parentId === 'null' || body.parentId === '' ? null : body.parentId)
    : existingDept.parentId;

  // 1. Kiểm tra tính hợp lệ của tên đơn vị
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw new ServiceError('Tên đơn vị phải là chuỗi ký tự hợp lệ và không được để trống.', 400);
    }
    if (body.name.trim().length > 150) {
      throw new ServiceError('Tên đơn vị không được vượt quá 150 ký tự.', 400);
    }
  }

  const targetName = body.name !== undefined ? body.name.trim() : existingDept.name;

  // 2. Chặn đổi loại làm hỏng các đơn vị con hiện tại
  if (newType !== existingDept.type) {
    if (!['khoa', 'bomon', 'phongban'].includes(newType)) {
      throw new ServiceError('Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.', 400);
    }
    const childCount = await Department.countDocuments({ parentId: id });
    if (existingDept.type === 'khoa' && newType !== 'khoa' && childCount > 0) {
      throw new ServiceError(
        `Không thể đổi loại Khoa này thành ${newType === 'bomon' ? 'Bộ môn' : 'Phòng ban'} vì đang có ${childCount} đơn vị con trực thuộc. Vui lòng di chuyển hoặc xử lý các đơn vị con trước.`,
        400
      );
    }
    if (newType === 'bomon' && childCount > 0) {
      throw new ServiceError('Đơn vị loại Bộ môn không được phép chứa đơn vị con.', 400);
    }
  }

  // 3. Kiểm tra trùng lặp tên đơn vị
  if (body.name !== undefined || body.parentId !== undefined) {
    const duplicateDept = await Department.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${targetName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
      parentId: newParentId !== undefined ? newParentId : existingDept.parentId,
    });
    if (duplicateDept) {
      throw new ServiceError(`Đơn vị mang tên "${targetName}" đã tồn tại trong cùng cấp phân cấp.`, 409);
    }
  }

  // 4. Kiểm tra vòng lặp tham chiếu
  if (newParentId) {
    if (!mongoose.Types.ObjectId.isValid(newParentId)) {
      throw new ServiceError('ID đơn vị cha (parentId) không đúng định dạng ObjectId.', 400);
    }
    if (newParentId.toString() === id) {
      throw new ServiceError('Đơn vị không thể nhận chính mình làm đơn vị cha.', 400);
    }
    const isCircular = await isDescendantOf(newParentId, id);
    if (isCircular) {
      throw new ServiceError('Không thể chọn đơn vị con/cháu làm đơn vị cha (lỗi lặp vòng tham chiếu).', 400);
    }
  }

  // 5. Kiểm tra ràng buộc phân cấp
  const hierarchyError = await validateDepartmentHierarchy(newType, newParentId);
  if (hierarchyError) {
    throw new ServiceError(hierarchyError, 400);
  }

  // 6. Xử lý managerId
  let targetManagerId;
  if (body.managerId !== undefined) {
    targetManagerId = body.managerId === 'null' || body.managerId === '' ? null : body.managerId;
  } else if (existingDept.type === 'khoa' && newType !== 'khoa') {
    targetManagerId = null;
  } else {
    targetManagerId = existingDept.managerId?._id || existingDept.managerId;
  }

  // 7. Kiểm tra tính hợp lệ của managerId
  if (targetManagerId) {
    const managerError = await validateManagerEligibility(targetManagerId, newType, id);
    if (managerError) {
      throw new ServiceError(managerError, 400);
    }
  }

  const updatePayload = { ...body };
  if (body.name !== undefined) updatePayload.name = targetName;
  updatePayload.type = newType;
  updatePayload.parentId = newParentId;
  updatePayload.managerId = targetManagerId;

  const needsManagerSync =
    targetManagerId !== (existingDept.managerId?._id?.toString() || existingDept.managerId?.toString()) ||
    newType !== existingDept.type;

  let updatedDept = null;
  await runInTransaction(async (session) => {
    const updateOptions = { new: true, runValidators: true };
    if (session) updateOptions.session = session;

    updatedDept = await Department.findByIdAndUpdate(id, updatePayload, updateOptions)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role avatar');

    if (needsManagerSync) {
      await syncDepartmentManager(
        updatedDept._id,
        updatedDept.type,
        targetManagerId,
        existingDept.managerId?._id || existingDept.managerId,
        existingDept.type,
        session
      );
    }
  });

  await AuditLog.create({
    actor: actorId,
    action: 'UPDATE_DEPARTMENT',
    targetId: updatedDept._id.toString(),
    targetType: 'Department',
    ipAddress: ipAddress || null,
    timestamp: new Date(),
    details: {
      name: updatedDept.name,
      type: updatedDept.type,
      parentId: updatedDept.parentId,
      managerId: updatedDept.managerId,
    },
  });

  return updatedDept;
};

/**
 * Xóa Khoa / Phòng ban
 */
const deleteDepartment = async ({ id, actorId, ipAddress }) => {
  let deletedDept = null;

  await runInTransaction(async (session) => {
    const queryOptions = session ? { session } : {};

    const userCount = await User.countDocuments({ departmentId: id }, queryOptions);
    if (userCount > 0) {
      throw new ServiceError(`Không thể xóa đơn vị vì đang có ${userCount} cán bộ/giảng viên trực thuộc.`, 400);
    }

    const childDeptCount = await Department.countDocuments({ parentId: id }, queryOptions);
    if (childDeptCount > 0) {
      throw new ServiceError(`Không thể xóa đơn vị vì đang có ${childDeptCount} bộ môn/đơn vị con trực thuộc.`, 400);
    }

    deletedDept = await Department.findByIdAndDelete(id, queryOptions);
    if (!deletedDept) {
      throw new ServiceError('Không tìm thấy Khoa / Phòng ban.', 404);
    }

    if (deletedDept.managerId && deletedDept.type === 'khoa') {
      const otherDeptCount = await Department.countDocuments(
        {
          _id: { $ne: deletedDept._id },
          managerId: deletedDept.managerId,
          type: 'khoa',
        },
        queryOptions
      );
      if (otherDeptCount === 0) {
        await User.findOneAndUpdate(
          { _id: deletedDept.managerId, role: 'truongkhoa' },
          { role: 'giangvien' },
          queryOptions
        );
      }
    }
  });

  await AuditLog.create({
    actor: actorId,
    action: 'DELETE_DEPARTMENT',
    targetId: deletedDept._id.toString(),
    targetType: 'Department',
    ipAddress: ipAddress || null,
    timestamp: new Date(),
    details: {
      name: deletedDept.name,
      type: deletedDept.type,
    },
  });

  return { message: 'Xóa Khoa / Phòng ban thành công.' };
};

module.exports = {
  ServiceError,
  syncDepartmentManager,
  isDescendantOf,
  validateDepartmentHierarchy,
  validateManagerEligibility,
  buildDepartmentTree,
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
