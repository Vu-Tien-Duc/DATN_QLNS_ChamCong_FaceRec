/**
 * User Management Controller (server/controllers/user.controller.js)
 * Mã nguồn sạch 100% chuẩn CSDL v2.5 cho môi trường Đại Học:
 * - Lấy danh sách nhân sự (getAllUsers).
 * - Lấy chi tiết thông tin cá nhân (getUserById).
 * - Thêm mới cán bộ / giảng viên (createUser).
 * - Cập nhật hồ sơ nhân sự (updateUser).
 * - Vô hiệu hóa tài khoản (deleteUser - Soft delete).
 * - Đăng ký / Xóa Face ID đồng bộ FAISS RAM (registerFaceDescriptor, deleteFaceDescriptor).
 */
const {
  ServiceError,
  fetchUsers,
  fetchUserById,
  createNewUser,
  updateExistingUser,
  softDeleteUser,
  registerFaceDescriptorForUser,
  registerFaceImagesForUser,
  removeFaceDescriptorForUser,
} = require('../services/nhanSu/nguoiDung.service');
const { sendSuccess, sendError } = require('../utils/phanHoiHttp');

const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

const mapUserBodyToCanonical = (body) => {
  if (!body || typeof body !== 'object') return {};
  const allowedFields = [
    'ho_ten', 'email', 'mat_khau', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id',
    'so_dien_thoai', 'chuc_vu', 'hoc_ham', 'hoc_vi', 'loai_nhan_su', 'loai_hop_dong',
    'ngach_luong', 'he_so_luong', 'so_nguoi_phu_thuoc', 'han_muc_phep_nam',
    'gioi_tinh', 'ngay_sinh', 'ngay_vao_lam', 'dia_chi', 'trang_thai_lam_viec',
    'anh_dai_dien', 'danh_sach_vai_tro', 'kich_hoat',
    'ngay_het_han_hop_dong', 'ngay_bat_dau_giang_day',
    'so_cccd', 'ma_so_thue', 'so_tai_khoan_ngan_hang', 'ten_ngan_hang', 'chi_nhanh_ngan_hang',
  ];
  const res = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      res[field] = body[field];
    }
  }
  return res;
};

/**
 * 1. Lấy danh sách người dùng
 * @route GET /api/nguoi-dung
 */
const getAllUsers = async (req, res, next) => {
  try {
    const vai_tro = req.query?.vai_tro;
    const don_vi_id = req.query?.don_vi_id;
    const dang_hoat_dong = req.query?.kich_hoat;
    const tim_kiem = req.query?.tim_kiem;
    const page = req.query?.trang || 1;
    const limit = req.query?.gioi_han || 20;

    const result = await fetchUsers({
      vai_tro,
      don_vi_id,
      dang_hoat_dong,
      kich_hoat: dang_hoat_dong,
      tim_kiem,
      page,
      limit,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 2. Lấy chi tiết người dùng
 * @route GET /api/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await fetchUserById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết người dùng thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 3. Tạo mới tài khoản
 * @route POST /api/users
 */
const createUser = async (req, res, next) => {
  try {
    const dia_chi_ip = req.ip || req.connection?.remoteAddress || null;
    const canonicalBody = mapUserBodyToCanonical(req.body);
    const newUser = await createNewUser(canonicalBody, req.user, dia_chi_ip);
    return sendSuccess(res, 'Thêm mới tài khoản người dùng thành công.', newUser, 201);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 4. Cập nhật tài khoản
 * @route PUT /api/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const dia_chi_ip = req.ip || req.connection?.remoteAddress || null;
    const canonicalBody = mapUserBodyToCanonical(req.body);
    const updatedUser = await updateExistingUser(req.params.id, canonicalBody, req.user, dia_chi_ip);
    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', updatedUser);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 5. Khóa / Vô hiệu hóa tài khoản (Soft delete)
 * @route DELETE /api/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const dia_chi_ip = req.ip || req.connection?.remoteAddress || null;
    const result = await softDeleteUser(req.params.id, req.user, dia_chi_ip);
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 6. Đăng ký vector Face ID cho người dùng
 * @route POST /api/nguoi-dung/:id/khuon-mat
 */
const registerFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      khuon_mat_vector: faceDescriptor,
      ghi_de: force,
      cac_goc_mau: sampleAngles,
      mo_hinh_ai: aiModel,
    } = req.body;
    const files = req.files || (req.file ? [req.file] : []);

    let result;
    if (files.length > 0) {
      result = await registerFaceImagesForUser({
        id,
        files,
        sampleAngles,
        force: force === 'true' || force === true,
        currentUser: req.user,
        ip: req.ip,
      });
    } else {
      result = await registerFaceDescriptorForUser({
        id,
        descriptor: faceDescriptor,
        force,
        sampleAngles,
        aiModel,
        currentUser: req.user,
        ip: req.ip,
      });
    }

    return sendSuccess(res, 'Đăng ký nhận diện khuôn mặt thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

/**
 * 7. Xóa dữ liệu Face ID của người dùng
 * @route DELETE /api/users/:id/face-descriptor hoặc DELETE /api/users/:id/face
 */
const deleteFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await removeFaceDescriptorForUser({
      id,
      currentUser: req.user,
      ip: req.ip,
    });
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  registerFaceDescriptor,
  deleteFaceDescriptor,
};
