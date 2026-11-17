// Quản lý danh mục môn học / học phần phục vụ xếp lịch giảng dạy
const subjectService = require('../services/nhanSu/monHoc.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleError = (res, error, next) => {
  if (error instanceof subjectService.ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

// Lọc các trường hợp lệ của môn học từ request body
const mapSubjectBodyToCanonical = (body) => {
  if (!body || typeof body !== 'object') return {};
  const { ma_mon, ten_mon, so_tin_chi, phong_ban_id, mo_ta, kich_hoat } = body;
  const res = {};
  if (ma_mon !== undefined) res.ma_mon = ma_mon;
  if (ten_mon !== undefined) res.ten_mon = ten_mon;
  if (so_tin_chi !== undefined) res.so_tin_chi = so_tin_chi;
  if (phong_ban_id !== undefined) res.phong_ban_id = phong_ban_id;
  if (mo_ta !== undefined) res.mo_ta = mo_ta;
  if (kich_hoat !== undefined) res.kich_hoat = kich_hoat;
  return res;
};

// Lấy danh sách môn học theo bộ lọc và phân trang
const getSubjects = async (req, res, next) => {
  try {
    const { tim_kiem, phong_ban_id, kich_hoat, so_tin_chi, trang, gioi_han, page, limit } = req.query;

    const result = await subjectService.getSubjects({
      tim_kiem,
      phong_ban_id,
      kich_hoat,
      so_tin_chi,
      page: trang ?? page,
      limit: gioi_han ?? limit,
    });
    return sendSuccess(res, 'Lấy danh sách môn học thành công.', result);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Lấy chi tiết một môn học theo ID
const getSubjectById = async (req, res, next) => {
  try {
    const subject = await subjectService.getSubjectById(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết môn học thành công.', subject);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Tạo môn học mới
const createSubject = async (req, res, next) => {
  try {
    const canonicalBody = mapSubjectBodyToCanonical(req.body);
    const subject = await subjectService.createSubject(canonicalBody, req.user);
    return sendSuccess(res, 'Tạo mới môn học thành công.', subject, 201);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Cập nhật thông tin môn học
const updateSubject = async (req, res, next) => {
  try {
    const canonicalBody = mapSubjectBodyToCanonical(req.body);
    const subject = await subjectService.updateSubject(req.params.id, canonicalBody, req.user);
    return sendSuccess(res, 'Cập nhật môn học thành công.', subject);
  } catch (error) {
    return handleError(res, error, next);
  }
};

// Xóa môn học
const deleteSubject = async (req, res, next) => {
  try {
    const subject = await subjectService.deleteSubject(req.params.id);
    return sendSuccess(res, `Đã xóa môn học "${subject.ten_mon}" thành công.`);
  } catch (error) {
    return handleError(res, error, next);
  }
};

module.exports = { getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
