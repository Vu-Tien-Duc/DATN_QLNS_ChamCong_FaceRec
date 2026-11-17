// Định tuyến cổng thông tin công khai Giảng viên, không yêu cầu đăng nhập (/api/cong-khai/giang-vien)
const express = require('express');
const router = express.Router();
const facultyController = require('../../controllers/public_giangvien/giangVien.controller');

// Thống kê tổng quan giảng viên
router.get('/thong-ke', facultyController.getPublicFacultyStats);

// Danh sách giảng viên (phân trang, tìm kiếm, lọc theo khoa & học vị)
router.get('/', facultyController.getPublicFacultyList);

// Chi tiết hồ sơ khoa học của giảng viên theo id
router.get('/:id', facultyController.getPublicFacultyById);

module.exports = router;
