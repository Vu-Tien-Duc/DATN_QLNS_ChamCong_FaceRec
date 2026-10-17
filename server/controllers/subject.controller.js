/**
 * Xử lý API tra cứu, tạo, cập nhật và xóa danh mục môn học.
 */
const subjectService = require('../services/subject.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const handleError = (res, error, next) => {
  if (error instanceof subjectService.ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const getSubjects = async (req, res, next) => {
  try {
    const result = await subjectService.getSubjects(req.query);
    return sendSuccess(res, 'Lấy danh sách môn học thành công.', result);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const getSubjectById = async (req, res, next) => {
  try {
    const subject = await subjectService.getSubjectById(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết môn học thành công.', subject);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const createSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.createSubject(req.body);
    return sendSuccess(res, 'Tạo mới môn học thành công.', subject, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const updateSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.updateSubject(req.params.id, req.body);
    return sendSuccess(res, 'Cập nhật môn học thành công.', subject);
  } catch (error) {
    return handleError(res, error, next);
  }
};

const deleteSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.deleteSubject(req.params.id);
    return sendSuccess(res, `Đã xóa môn học "${subject.name}" thành công.`);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = { getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
