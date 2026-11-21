// Định tuyến API quản lý danh mục môn học / học phần (/api/mon-hoc)
const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} = require('../controllers/monHoc.controller');
const { verifyToken, authorizeRoles, requireAnyPermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/admin đều có thể tra cứu danh mục môn học
router.get('/', getSubjects);
router.get('/:id', getSubjectById);

// Admin, BGH, Đào tạo, Trưởng khoa/bộ môn và Phó khoa/bộ môn được ủy quyền có quyền tạo và chỉnh sửa môn học
router.post('/', requireAnyPermission(PERMISSIONS.LICH_XEP_LICH, PERMISSIONS.HE_THONG_CAU_HINH), createSubject);
router.put('/:id', requireAnyPermission(PERMISSIONS.LICH_XEP_LICH, PERMISSIONS.HE_THONG_CAU_HINH), updateSubject);

// Admin và BGH có quyền xóa môn học
router.delete('/:id', authorizeRoles('admin', 'bgh'), deleteSubject);

module.exports = router;
