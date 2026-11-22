// Định tuyến API quản lý nhân sự, hồ sơ, khóa mềm và Face ID theo người dùng (/api/nguoi-dung)
const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  importUsersExcel,
  updateUser,
  deleteUser,
  registerFaceDescriptor,
  deleteFaceDescriptor,
} = require('../controllers/nguoiDung.controller');
const { verifyToken, verifyRole, requirePermission, requireAnyPermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { uploadFaceImages } = require('../middlewares/taiAnhKhuonMat.middleware');
const { UNIT_LEADER_ROLES } = require('../utils/vaiTro.utils');

// Toàn bộ các thao tác người dùng đều yêu cầu đăng nhập
router.use(verifyToken);

// 1. Xem danh sách người dùng (Admin, BGH, TCCB và Trưởng khoa - Trưởng khoa tự động lọc theo khoa)
router.get('/', verifyRole(['admin', 'bgh', 'tccb', 'dao_tao', ...UNIT_LEADER_ROLES]), getAllUsers);

// 2. Thêm người dùng mới (Chỉ Admin / BGH / TCCB)
router.post('/', verifyRole(['admin', 'bgh', 'tccb']), createUser);

// 2b. Thêm nhanh hàng loạt nhân sự từ Excel (Chỉ Admin / BGH / TCCB)
router.post('/nhap-excel', verifyRole(['admin', 'bgh', 'tccb']), importUsersExcel);

// Đăng ký và xóa dữ liệu Face ID theo người dùng
router.post('/:id/khuon-mat', verifyRole(['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]), uploadFaceImages, registerFaceDescriptor);
router.delete('/:id/khuon-mat', verifyRole(['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]), deleteFaceDescriptor);



// Trợ thủ phân quyền: Cho phép chính chủ người dùng xem/sửa hồ sơ cá nhân của mình, hoặc các vai trò quản trị
const allowSelfOrRoles = (allowedRoles = []) => {
  const roleMiddleware = verifyRole(allowedRoles);
  return (req, res, next) => {
    const currentUserId = req.user?.id?.toString();
    const targetUserId = req.params?.id?.toString();
    if (currentUserId && targetUserId && currentUserId === targetUserId) {
      return next();
    }
    return roleMiddleware(req, res, next);
  };
};

// 4. Xem chi tiết người dùng (Chính chủ, Admin, BGH, TCCB và Trưởng khoa của khoa đó)
router.get('/:id', allowSelfOrRoles(['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]), getUserById);

// 5. Cập nhật thông tin người dùng (Chính chủ, Admin, BGH, TCCB hoặc Trưởng khoa)
router.put('/:id', allowSelfOrRoles(['admin', 'bgh', 'tccb', ...UNIT_LEADER_ROLES]), updateUser);

// Vô hiệu hóa tài khoản (kich_hoat = false, chỉ Admin / BGH)
router.delete('/:id', verifyRole(['admin', 'bgh']), deleteUser);

module.exports = router;
