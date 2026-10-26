const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} = require('../controllers/subject.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/admin đều có thể tra cứu danh mục môn học
router.get('/', getSubjects);
router.get('/:id', getSubjectById);

// Admin, BGH, Đào tạo và Trưởng khoa có quyền tạo và chỉnh sửa môn học
router.post('/', authorizeRoles('admin', 'bgh', 'daotao', 'truongkhoa'), createSubject);
router.put('/:id', authorizeRoles('admin', 'bgh', 'daotao', 'truongkhoa'), updateSubject);

// Admin và BGH có quyền xóa môn học
router.delete('/:id', authorizeRoles('admin', 'bgh'), deleteSubject);

module.exports = router;
