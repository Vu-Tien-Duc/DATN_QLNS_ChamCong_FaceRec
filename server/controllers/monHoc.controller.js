// Quản lý danh mục môn học / học phần phục vụ xếp lịch giảng dạy
const subjectService = require('../services/nhanSu/monHoc.service');
const { sendSuccess } = require('../utils/phanHoiHttp');

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
const getSubjects = async (req, res) => {
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
};

// Lấy chi tiết một môn học theo ID
const getSubjectById = async (req, res) => {
  const subject = await subjectService.getSubjectById(req.params.id);
  return sendSuccess(res, 'Lấy chi tiết môn học thành công.', subject);
};

// Tạo môn học mới
const createSubject = async (req, res) => {
  const subject = await subjectService.createSubject(mapSubjectBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Tạo mới môn học thành công.', subject, 201);
};

// Cập nhật thông tin môn học
const updateSubject = async (req, res) => {
  const subject = await subjectService.updateSubject(req.params.id, mapSubjectBodyToCanonical(req.body), req.user);
  return sendSuccess(res, 'Cập nhật môn học thành công.', subject);
};

// Xóa môn học
const deleteSubject = async (req, res) => {
  const subject = await subjectService.deleteSubject(req.params.id, req.user);
  return sendSuccess(res, `Đã xóa môn học "${subject.ten_mon}" thành công.`);
};

module.exports = { getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
