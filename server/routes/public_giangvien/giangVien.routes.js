const express = require('express');
const router = express.Router();
const facultyController = require('../../controllers/public_giangvien/giangVien.controller');

/**
 * Public Faculty Routes - Cổng thông tin công khai Phenikaa
 * Phân lập trong folder: server/routes/public_giangvien/
 * Không yêu cầu middleware verifyToken (Public Access an toàn)
 */

// Lấy số liệu thống kê tổng quan (dành cho Hero Section & Tab filter)
router.get('/thong-ke', facultyController.getPublicFacultyStats);

// Lấy danh sách giảng viên (phân trang, tìm kiếm, lọc theo khoa & học vị)
router.get('/', facultyController.getPublicFacultyList);

// Lấy chi tiết hồ sơ khoa học của 1 giảng viên theo id
router.get('/:id', facultyController.getPublicFacultyById);

module.exports = router;
