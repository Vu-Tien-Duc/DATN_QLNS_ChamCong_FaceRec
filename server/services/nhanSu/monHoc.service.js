// Quản lý danh mục môn học trong hệ thống.
const { Op } = require('sequelize');
const { sequelize, MonHoc, LichTrinh, PhongBan } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const { getDeanDepartmentIds } = require('../../utils/phamViTruongKhoa');
const { GLOBAL_ADMIN_ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');

// Kiểm tra quyền tạo hoặc sửa môn học theo phạm vi khoa/bộ môn
const assertSubjectDepartmentScope = async (currentUser, departmentId) => {
  if (!currentUser) return;
  if (hasAnyActiveRole(currentUser, [...GLOBAL_ADMIN_ROLES, 'dao_tao'])) {
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

// Lấy danh sách môn học theo từ khóa, đơn vị, trạng thái và phân trang
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
    const childDepts = await PhongBan.findAll({
      where: { don_vi_cha_id: phong_ban_id },
      attributes: ['id'],
      raw: true,
    });
    where.phong_ban_id = childDepts.length
      ? { [Op.in]: [phong_ban_id, ...childDepts.map((d) => d.id)] }
      : phong_ban_id;
  }
  if (kich_hoat !== undefined && kich_hoat !== '') {
    where.kich_hoat = kich_hoat === 'true' || kich_hoat === true;
  }
  if (so_tin_chi !== undefined && so_tin_chi !== '') {
    where.so_tin_chi = Number(so_tin_chi);
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

  await assertSubjectDepartmentScope(currentUser, phong_ban_id);

  if (typeof ma_mon !== 'string' || !ma_mon.trim() || typeof ten_mon !== 'string' || !ten_mon.trim()) {
    throw new ServiceError('Mã môn học (ma_mon) và tên môn học (ten_mon) là bắt buộc.', 400, 'SUBJECT_004');
  }
  const normalizedCode = ma_mon.trim().toUpperCase();
  const existing = await MonHoc.findOne({ where: { ma_mon: normalizedCode } });
  if (existing) {
    throw new ServiceError(`Mã môn học "${normalizedCode}" đã tồn tại trên hệ thống.`, 409, 'SUBJECT_002');
  }

  const subject = await MonHoc.create({
    ma_mon: normalizedCode,
    ten_mon: ten_mon.trim(),
    so_tin_chi: so_tin_chi !== undefined ? Number(so_tin_chi) : 3,
    phong_ban_id: phong_ban_id || null,
    mo_ta: typeof mo_ta === 'string' ? mo_ta.trim() : '',
    kich_hoat: kich_hoat !== undefined ? Boolean(kich_hoat) : true,
  });
  return getSubjectById(subject.id);
};

// Cập nhật thông tin môn học
const updateSubject = async (id, data = {}, currentUser = null) => {
  const subject = await getSubjectById(id);
  await assertSubjectDepartmentScope(currentUser, subject.phong_ban_id);
  const { ma_mon, ten_mon, so_tin_chi, phong_ban_id, mo_ta, kich_hoat } = data;
  if (phong_ban_id !== undefined) {
    await assertSubjectDepartmentScope(currentUser, phong_ban_id);
  }

  if (ma_mon) {
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
  if (ten_mon) subject.ten_mon = ten_mon.trim();
  if (so_tin_chi !== undefined) subject.so_tin_chi = Number(so_tin_chi);
  if (phong_ban_id !== undefined) subject.phong_ban_id = phong_ban_id || null;
  if (mo_ta !== undefined) subject.mo_ta = typeof mo_ta === 'string' ? mo_ta.trim() : '';
  if (kich_hoat !== undefined) subject.kich_hoat = Boolean(kich_hoat);

  await subject.save();
  return getSubjectById(subject.id);
};

// Xóa môn học nếu chưa được gán trong lịch giảng dạy
const deleteSubject = async (id) => {
  const subject = await getSubjectById(id);
  const assignedCount = await LichTrinh.count({ where: { mon_hoc_id: id } });
  if (assignedCount > 0) {
    throw new ServiceError(
      `Không thể xóa môn học "${subject.ten_mon}" vì đang được phân công trong ${assignedCount} lịch dạy/công tác. Hãy chuyển sang vô hiệu hóa (kich_hoat = false).`,
      400,
      'SUBJECT_003'
    );
  }
  await subject.destroy();
  return subject;
};

module.exports = {
  ServiceError,
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
