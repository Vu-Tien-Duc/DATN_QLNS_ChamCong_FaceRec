const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  registerFaceDescriptor,
  deleteFaceDescriptor,
} = require('../controllers/user.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { uploadFaceImages } = require('../middlewares/faceImageUpload.middleware');

// Toàn bộ các thao tác người dùng đều yêu cầu đăng nhập
router.use(verifyToken);

// 1. Xem danh sách người dùng (Admin, BGH, TCCB và Trưởng khoa - Trưởng khoa tự động lọc theo khoa)
router.get('/', verifyRole(['admin', 'bgh', 'tccb', 'truongkhoa']), getAllUsers);

// 2. Thêm người dùng mới (Chỉ Admin / BGH / TCCB)
router.post('/', verifyRole(['admin', 'bgh', 'tccb']), createUser);

// 3. Đăng ký & Xóa vector khuôn mặt Face ID (Admin / BGH / TCCB)
router.post('/:id/face-descriptor', verifyRole(['admin', 'bgh', 'tccb']), uploadFaceImages, registerFaceDescriptor);
router.delete('/:id/face-descriptor', verifyRole(['admin', 'bgh', 'tccb']), deleteFaceDescriptor);
// Alias: xóa FaceID thông qua face.controller (dùng bởi FaceRegistrationModal)
router.delete('/:id/face', verifyRole(['admin', 'bgh', 'tccb', 'truongkhoa']), deleteFaceDescriptor);

// Trợ thủ phân quyền: Cho phép chính chủ người dùng xem/sửa hồ sơ cá nhân của mình, hoặc các vai trò quản trị
const allowSelfOrRoles = (allowedRoles = []) => {
  const roleMiddleware = verifyRole(allowedRoles);
  return (req, res, next) => {
    const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const targetUserId = req.params?.id?.toString();
    if (currentUserId && targetUserId && currentUserId === targetUserId) {
      return next();
    }
    return roleMiddleware(req, res, next);
  };
};

// 4. Xem chi tiết người dùng (Chính chủ, Admin, BGH, TCCB và Trưởng khoa của khoa đó)
router.get('/:id', allowSelfOrRoles(['admin', 'bgh', 'tccb', 'truongkhoa']), getUserById);

// 5. Cập nhật thông tin người dùng (Chính chủ, Admin, BGH, TCCB hoặc Trưởng khoa)
router.put('/:id', allowSelfOrRoles(['admin', 'bgh', 'tccb', 'truongkhoa']), updateUser);

// 6. Vô hiệu hóa người dùng (Soft Delete: isActive = false) (Chỉ Admin / BGH)
router.delete('/:id', verifyRole(['admin', 'bgh']), deleteUser);

module.exports = router;
