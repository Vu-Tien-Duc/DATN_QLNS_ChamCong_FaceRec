// Quản lý danh mục môn học trong hệ thống.
const { Op } = require('sequelize');
const { sequelize, MonHoc, LichTrinh, PhongBan, NhatKyKiemToan } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const { getDeanDepartmentIds } = require('../../utils/phamViTruongKhoa');
const { hasAnyActiveRole } = require('../../utils/vaiTro.utils');

const recordSubjectAudit = (currentUser, action, subjectId, detail) => {
  if (!currentUser?.id) return;
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: action,
    doi_tuong_id: String(subjectId),
    loai_doi_tuong: 'mon_hoc',
    chi_tiet: detail,
  }).catch((err) => console.error('[AuditLog Error]:', err.message));
};

// Kiểm tra quyền tạo hoặc sửa môn học theo phạm vi khoa/bộ môn
const assertSubjectDepartmentScope = async (currentUser, departmentId) => {
  if (!currentUser) return;
  if (hasAnyActiveRole(currentUser, ['admin', 'bgh', 'dao_tao'])) {
    return;
  }
  const allowedDepts = (await getDeanDepartmentIds(currentUser)).map(String);
  if (!departmentId || !allowedDepts.includes(String(departmentId))) {
    throw new ServiceError(
      'Bạn chỉ được phép tạo hoặc chỉnh sửa môn học thuộc đơn vị mình quản lý.',
      403,
      'SUBJECT_OUT_OF_SCOPE'
    );
  }
};

// Mở rộng cây đơn vị nhiều cấp (Khoa -> Bộ môn -> Tổ)
const getRecursiveDepartmentIds = async (rootDeptId) => {
  const allIds = [String(rootDeptId)];
  let frontier = [String(rootDeptId)];
  while (frontier.length > 0) {
    const children = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: frontier } },
      attributes: ['id'],
      raw: true,
    });
    const nextIds = (children || []).map((c) => String(c.id)).filter((id) => !allIds.includes(id));
    if (nextIds.length === 0) break;
    allIds.push(...nextIds);
    frontier = nextIds;
  }
  return allIds;
};

const INCLUDE_DEPARTMENT = [
  {
    model: PhongBan,
    as: 'phong_ban',
    attributes: ['id', 'ten_phong_ban', 'loai_don_vi', 'don_vi_cha_id'],
    include: [
      {
        model: PhongBan,
        as: 'don_vi_cha',
        attributes: ['id', 'ten_phong_ban', 'loai_don_vi'],
      },
    ],
  },
];

const validateSubjectCredits = (rawCredits, errorCode = 'SUBJECT_004') => {
  const parsed = Number(rawCredits);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new ServiceError('Số tín chỉ (so_tin_chi) phải là số nguyên từ 1 đến 30.', 400, errorCode);
  }
  return parsed;
};

// Lấy danh sách môn học theo từ khóa, đơn vị (đệ quy), trạng thái và phân trang
const getSubjects = async ({ tim_kiem, phong_ban_id, kich_hoat, so_tin_chi, page, limit }) => {
  const where = {};
  if (tim_kiem && tim_kiem.trim()) {
    const likePattern = `%${tim_kiem.trim()}%`;
    where[Op.or] = [
      { ma_mon: { [Op.like]: likePattern } },
      { ten_mon: { [Op.like]: likePattern } },
    ];
  }
  if (phong_ban_id) {
    if (!isValidUuid(phong_ban_id)) {
      throw new ServiceError('Định dạng ID khoa / phòng ban không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
    }
    const allDeptIds = await getRecursiveDepartmentIds(phong_ban_id);
    where.phong_ban_id = allDeptIds.length > 1 ? { [Op.in]: allDeptIds } : phong_ban_id;
  }
  if (kich_hoat !== undefined && kich_hoat !== '') {
    where.kich_hoat = kich_hoat === 'true' || kich_hoat === true;
  }
  if (so_tin_chi !== undefined && so_tin_chi !== '') {
    where.so_tin_chi = validateSubjectCredits(so_tin_chi, 'SUBJECT_INVALID_DATA');
  }

  const rawCredits = await MonHoc.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('so_tin_chi')), 'so_tin_chi']],
    raw: true,
  });
  const availableCredits = rawCredits
    .map((r) => Number(r.so_tin_chi))
    .filter((c) => Number.isFinite(c) && c > 0)
    .sort((a, b) => a - b);

  if (page && limit) {
    const { page: pageNum, limit: limitNum, offset } = normalizePagination(page, limit, 200);
    const { count: total, rows: subjects } = await MonHoc.findAndCountAll({
      where,
      include: INCLUDE_DEPARTMENT,
      order: [['ma_mon', 'ASC']],
      offset,
      limit: limitNum,
      distinct: true,
    });
    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
      subjects,
      availableCredits,
    };
  }

  return MonHoc.findAll({
    where,
    include: INCLUDE_DEPARTMENT,
    order: [['ma_mon', 'ASC']],
  });
};

// Lấy chi tiết một môn học theo ID
const getSubjectById = async (id) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Định dạng ID môn học không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
  }
  const subject = await MonHoc.findByPk(id, { include: INCLUDE_DEPARTMENT });
  if (!subject) throw new ServiceError('Không tìm thấy môn học.', 404, 'SUBJECT_001');
  return subject;
};

// Tạo mới một môn học
const createSubject = async (payload = {}, currentUser = null) => {
  const { ma_mon, ten_mon, so_tin_chi, phong_ban_id, mo_ta, kich_hoat } = payload;

  if (phong_ban_id !== undefined && phong_ban_id !== null && phong_ban_id !== '') {
    if (!isValidUuid(phong_ban_id)) {
      throw new ServiceError('Định dạng ID khoa / phòng ban không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
    }
    const deptDoc = await PhongBan.findByPk(phong_ban_id, { attributes: ['id'] });
    if (!deptDoc) {
      throw new ServiceError('Không tìm thấy khoa / phòng ban được chọn.', 404, 'DEPARTMENT_NOT_FOUND');
    }
  }

  await assertSubjectDepartmentScope(currentUser, phong_ban_id);

  if (typeof ma_mon !== 'string' || !ma_mon.trim() || typeof ten_mon !== 'string' || !ten_mon.trim()) {
    throw new ServiceError('Mã môn học (ma_mon) và tên môn học (ten_mon) là bắt buộc.', 400, 'SUBJECT_004');
  }

  const parsedCredits = so_tin_chi !== undefined ? validateSubjectCredits(so_tin_chi, 'SUBJECT_004') : 3;

  const normalizedCode = ma_mon.trim().toUpperCase();
  const existing = await MonHoc.findOne({ where: { ma_mon: normalizedCode } });
  if (existing) {
    throw new ServiceError(`Mã môn học "${normalizedCode}" đã tồn tại trên hệ thống.`, 409, 'SUBJECT_002');
  }

  const subject = await MonHoc.create({
    ma_mon: normalizedCode,
    ten_mon: ten_mon.trim(),
    so_tin_chi: parsedCredits,
    phong_ban_id: phong_ban_id || null,
    mo_ta: typeof mo_ta === 'string' ? mo_ta.trim() : '',
    kich_hoat: kich_hoat !== undefined ? Boolean(kich_hoat) : true,
  });
  recordSubjectAudit(currentUser, 'CREATE_SUBJECT', subject.id, {
    ma_mon: subject.ma_mon,
    ten_mon: subject.ten_mon,
    so_tin_chi: subject.so_tin_chi,
  });
  return getSubjectById(subject.id);
};

// Cập nhật thông tin môn học
const updateSubject = async (id, data = {}, currentUser = null) => {
  const subject = await getSubjectById(id);
  await assertSubjectDepartmentScope(currentUser, subject.phong_ban_id);
  const { ma_mon, ten_mon, so_tin_chi, phong_ban_id, mo_ta, kich_hoat } = data;
  if (phong_ban_id !== undefined) {
    if (phong_ban_id !== null && phong_ban_id !== '') {
      if (!isValidUuid(phong_ban_id)) {
        throw new ServiceError('Định dạng ID khoa / phòng ban không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
      }
      const deptDoc = await PhongBan.findByPk(phong_ban_id, { attributes: ['id'] });
      if (!deptDoc) {
        throw new ServiceError('Không tìm thấy khoa / phòng ban được chọn.', 404, 'DEPARTMENT_NOT_FOUND');
      }
    }
    await assertSubjectDepartmentScope(currentUser, phong_ban_id);
  }

  if (ma_mon !== undefined) {
    if (typeof ma_mon !== 'string' || !ma_mon.trim()) {
      throw new ServiceError('Mã môn học (ma_mon) không được để trống.', 400, 'SUBJECT_004');
    }
    const normalizedCode = ma_mon.trim().toUpperCase();
    if (normalizedCode !== subject.ma_mon) {
      const duplicate = await MonHoc.findOne({
        where: { ma_mon: normalizedCode, id: { [Op.ne]: id } },
      });
      if (duplicate) {
        throw new ServiceError(
          `Mã môn học "${normalizedCode}" đã được sử dụng bởi môn học khác.`,
          409,
          'SUBJECT_002'
        );
      }
      subject.ma_mon = normalizedCode;
    }
  }
  if (ten_mon !== undefined) {
    if (typeof ten_mon !== 'string' || !ten_mon.trim()) {
      throw new ServiceError('Tên môn học (ten_mon) không được để trống.', 400, 'SUBJECT_004');
    }
    subject.ten_mon = ten_mon.trim();
  }
  if (so_tin_chi !== undefined) {
    subject.so_tin_chi = validateSubjectCredits(so_tin_chi, 'SUBJECT_004');
  }
  if (phong_ban_id !== undefined) subject.phong_ban_id = phong_ban_id || null;
  if (mo_ta !== undefined) subject.mo_ta = typeof mo_ta === 'string' ? mo_ta.trim() : '';
  if (kich_hoat !== undefined) subject.kich_hoat = Boolean(kich_hoat);

  await subject.save();
  recordSubjectAudit(currentUser, 'UPDATE_SUBJECT', subject.id, { updatedFields: Object.keys(data) });
  return getSubjectById(subject.id);
};

// Xóa môn học nguyên tử trong transaction nếu chưa được gán trong lịch giảng dạy
const deleteSubject = async (id, currentUser = null) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Định dạng ID môn học không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
  }
  const deleted = await runInTransaction(async (transaction) => {
    const subject = await MonHoc.findByPk(id, { include: INCLUDE_DEPARTMENT, transaction });
    if (!subject) throw new ServiceError('Không tìm thấy môn học.', 404, 'SUBJECT_001');

    const assignedCount = await LichTrinh.count({ where: { mon_hoc_id: id }, transaction });
    if (assignedCount > 0) {
      throw new ServiceError(
        `Không thể xóa môn học "${subject.ten_mon}" vì đang được phân công trong ${assignedCount} lịch dạy/công tác. Hãy chuyển sang vô hiệu hóa (kich_hoat = false).`,
        400,
        'SUBJECT_003'
      );
    }
    await subject.destroy({ transaction });
    return subject;
  });
  recordSubjectAudit(currentUser, 'DELETE_SUBJECT', id, { ma_mon: deleted.ma_mon, ten_mon: deleted.ten_mon });
  return deleted;
};

module.exports = {
  ServiceError,
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
