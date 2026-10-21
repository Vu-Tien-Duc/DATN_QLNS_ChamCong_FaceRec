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
router.get('/', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb', 'truong_khoa', 'truongkhoa']), getAllUsers);

// 2. Thêm người dùng mới (Chỉ Admin / BGH / TCCB)
router.post('/', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb']), createUser);

// 3. Đăng ký & Xóa vector khuôn mặt Face ID (Admin / BGH / TCCB)
router.post('/:id/face-descriptor', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb']), uploadFaceImages, registerFaceDescriptor);
router.delete('/:id/face-descriptor', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb']), deleteFaceDescriptor);
// Alias: xóa FaceID thông qua face.controller (dùng bởi FaceRegistrationModal)
router.delete('/:id/face', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb', 'truong_khoa', 'truongkhoa']), deleteFaceDescriptor);

// 4. Xem chi tiết người dùng (Admin, BGH, TCCB và Trưởng khoa của khoa đó)
router.get('/:id', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb', 'truong_khoa', 'truongkhoa']), getUserById);

// 5. Cập nhật thông tin người dùng (Admin, BGH, TCCB hoặc Trưởng khoa)
router.put('/:id', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin', 'tccb', 'truong_khoa', 'truongkhoa']), updateUser);

// 6. Vô hiệu hóa người dùng (Soft Delete: isActive = false) (Chỉ Admin / BGH)
router.delete('/:id', verifyRole(['admin', 'bgh', 'admin_it', 'it_admin']), deleteUser);

module.exports = router;
