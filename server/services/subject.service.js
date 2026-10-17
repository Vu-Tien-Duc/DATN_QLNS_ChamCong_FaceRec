/**
 * Quản lý danh mục môn học và ngăn xóa/cập nhật gây ảnh hưởng đến lịch giảng dạy.
 */
const mongoose = require('mongoose');
const Subject = require('../models/subject.model');
const Schedule = require('../models/schedule.model');
const Department = require('../models/department.model');
const ServiceError = require('../utils/serviceError');

const POPULATE_DEPARTMENT = {
  path: 'departmentId',
  select: 'name type parentId',
  populate: { path: 'parentId', select: 'name type' },
};

const getSubjects = async ({ search, departmentId, isActive, page, limit }) => {
  const query = {};
  if (search && search.trim()) {
    const keyword = search.trim();
    query.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
    ];
  }
  if (departmentId) {
    const childDepartments = await Department.find({ parentId: departmentId }).select('_id');
    query.departmentId = childDepartments.length
      ? { $in: [departmentId, ...childDepartments.map((department) => department._id)] }
      : departmentId;
  }
  if (isActive !== undefined && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (page && limit) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const [total, subjects] = await Promise.all([
      Subject.countDocuments(query),
      Subject.find(query).populate(POPULATE_DEPARTMENT).sort({ code: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    ]);
    return { total, page: pageNum, totalPages: Math.ceil(total / limitNum), limit: limitNum, subjects };
  }

  return Subject.find(query).populate(POPULATE_DEPARTMENT).sort({ code: 1 });
};

const getSubjectById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID môn học không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
  }
  const subject = await Subject.findById(id).populate(POPULATE_DEPARTMENT);
  if (!subject) throw new ServiceError('Không tìm thấy môn học.', 404, 'SUBJECT_001');
  return subject;
};

const createSubject = async ({ code, name, credits, departmentId, description, isActive }) => {
  if (typeof code !== 'string' || !code.trim() || typeof name !== 'string' || !name.trim()) {
    throw new ServiceError(
      'Mã môn học (code) và tên môn học (name) là bắt buộc.',
      400,
      'SUBJECT_004'
    );
  }
  const normalizedCode = code.trim().toUpperCase();
  const existing = await Subject.findOne({ code: normalizedCode });
  if (existing) {
    throw new ServiceError(`Mã môn học "${normalizedCode}" đã tồn tại trên hệ thống.`, 409, 'SUBJECT_002');
  }

  const subject = await Subject.create({
    code: normalizedCode,
    name: name.trim(),
    credits: credits !== undefined ? Number(credits) : 3,
    departmentId: departmentId || null,
    description: typeof description === 'string' ? description.trim() : '',
    isActive: isActive !== undefined ? isActive : true,
  });
  return Subject.findById(subject._id).populate(POPULATE_DEPARTMENT);
};

const updateSubject = async (id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID môn học không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
  }
  const subject = await Subject.findById(id);
  if (!subject) throw new ServiceError('Không tìm thấy môn học để cập nhật.', 404, 'SUBJECT_001');

  const { code, name, credits, departmentId, description, isActive } = data;
  if (code) {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode !== subject.code) {
      const duplicate = await Subject.findOne({ code: normalizedCode, _id: { $ne: id } });
      if (duplicate) {
        throw new ServiceError(
          `Mã môn học "${normalizedCode}" đã được sử dụng bởi môn học khác.`,
          409,
          'SUBJECT_002'
        );
      }
      subject.code = normalizedCode;
    }
  }
  if (name) subject.name = name.trim();
  if (credits !== undefined) subject.credits = Number(credits);
  if (departmentId !== undefined) subject.departmentId = departmentId || null;
  if (description !== undefined) subject.description = description.trim();
  if (isActive !== undefined) subject.isActive = isActive;

  await subject.save();
  return Subject.findById(subject._id).populate(POPULATE_DEPARTMENT);
};

const deleteSubject = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID môn học không hợp lệ.', 400, 'SUBJECT_INVALID_DATA');
  }
  const subject = await Subject.findById(id);
  if (!subject) throw new ServiceError('Không tìm thấy môn học để xóa.', 404, 'SUBJECT_001');

  const assignedCount = await Schedule.countDocuments({ subjectId: id });
  if (assignedCount > 0) {
    throw new ServiceError(
      `Không thể xóa môn học "${subject.name}" vì đang được phân công trong ${assignedCount} lịch dạy/công tác. Hãy chuyển sang vô hiệu hóa (isActive = false).`,
      400,
      'SUBJECT_003'
    );
  }
  await Subject.findByIdAndDelete(id);
  return subject;
};

module.exports = { ServiceError, getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
