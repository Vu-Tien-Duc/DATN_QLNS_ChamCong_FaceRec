const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/department.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên đã đăng nhập đều có quyền tra cứu danh sách và chi tiết đơn vị
router.get('/tree', (req, res, next) => {
  req.query.tree = 'true';
  return getAllDepartments(req, res, next);
});
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);

// Thao tác quản trị tổ chức (Chỉ Quản trị viên - Admin & BGH)
router.post('/', verifyRole(['admin', 'bgh']), createDepartment);
router.put('/:id', verifyRole(['admin', 'bgh']), updateDepartment);
router.delete('/:id', verifyRole(['admin', 'bgh']), deleteDepartment);

module.exports = router;
