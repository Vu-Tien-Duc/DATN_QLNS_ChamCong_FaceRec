// Quản lý tài khoản nhân sự, hồ sơ cán bộ, khóa mềm và đồng bộ Face ID theo người dùng
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

// Ánh xạ lỗi nghiệp vụ sang phản hồi HTTP chuẩn
const handleServiceError = (res, error, next) => {
  if (error instanceof ServiceError || error.statusCode) {
    return sendError(res, error.message, error.data || null, error.statusCode, error.errorCode || null);
  }
  return next(error);
};

// Lọc các trường thông tin nhân sự hợp lệ từ request body
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

// GET /api/nguoi-dung - Danh sách người dùng (lọc theo khoa, vai trò, trạng thái)
const getAllUsers = async (req, res, next) => {
  try {
    const vai_tro = req.query?.vai_tro;
    const don_vi_id = req.query?.don_vi_id;
    const kich_hoat = req.query?.kich_hoat;
    const tim_kiem = req.query?.tim_kiem;
    const trang = req.query?.trang || 1;
    const gioi_han = req.query?.gioi_han || 20;

    const result = await fetchUsers({
      vai_tro,
      don_vi_id,
      kich_hoat,
      tim_kiem,
      trang,
      gioi_han,
      currentUser: req.user,
    });
    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', result);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// GET /api/nguoi-dung/:id - Chi tiết người dùng
const getUserById = async (req, res, next) => {
  try {
    const user = await fetchUserById(req.params.id, req.user);
    return sendSuccess(res, 'Lấy chi tiết người dùng thành công.', user);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/nguoi-dung - Tạo mới tài khoản nhân sự
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

// PUT /api/nguoi-dung/:id - Cập nhật thông tin tài khoản/hồ sơ
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

// DELETE /api/nguoi-dung/:id - Vô hiệu hóa tài khoản (Soft delete)
const deleteUser = async (req, res, next) => {
  try {
    const dia_chi_ip = req.ip || req.connection?.remoteAddress || null;
    const result = await softDeleteUser(req.params.id, req.user, dia_chi_ip);
    return sendSuccess(res, result.message);
  } catch (error) {
    handleServiceError(res, error, next);
  }
};

// POST /api/nguoi-dung/:id/khuon-mat - Đăng ký khuôn mặt cho người dùng
const registerFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      khuon_mat_vector: faceDescriptor,
      ghi_de: force,
      cac_goc_mau: sampleAngles,
      mo_hinh_ai: aiModel,
      dong_y_thu_thap,
    } = req.body || {};

    const consentAgreed = dong_y_thu_thap === true || dong_y_thu_thap === 'true';
    if (!consentAgreed) {
      return sendError(
        res,
        'Yêu cầu xác nhận đồng thuận: Phải xác nhận đồng ý thu thập và mã hóa dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP trước khi đăng ký.',
        null,
        400,
        'BIOMETRIC_CONSENT_REQUIRED_ND13'
      );
    }

    const files = req.files || (req.file ? [req.file] : []);

    let result;
    if (files.length > 0) {
      result = await registerFaceImagesForUser({
        id,
        files,
        sampleAngles,
        force: force === 'true' || force === true,
        aiModel,
        currentUser: req.user,
        ip: req.ip,
      });
    } else {
      result = await registerFaceDescriptorForUser({
        id,
        faceDescriptor,
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

// DELETE /api/nguoi-dung/:id/khuon-mat - Xóa dữ liệu Face ID của người dùng
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
