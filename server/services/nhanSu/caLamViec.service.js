// Quản lý danh mục ca làm việc trong hệ thống.
const { Op } = require('sequelize');
const { CaLamViec, LichTrinh, NhatKyChamCong, DonNghiPhep, NgoaiLeLichTrinh, NhatKyKiemToan } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid } = require('../../utils/hoTroSequelize');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const recordShiftAudit = (currentUser, action, shiftId, detail) => {
  if (!currentUser?.id) return;
  NhatKyKiemToan.create({
    nguoi_thuc_hien_id: currentUser.id,
    loai_chu_the: 'user',
    hanh_dong: action,
    doi_tuong_id: String(shiftId),
    loai_doi_tuong: 'ca_lam_viec',
    chi_tiet: detail,
  }).catch((err) => console.error('[AuditLog Error]:', err.message));
};

// Kiểm tra chuỗi giờ đúng định dạng HH:mm (00:00 - 23:59)
const validateTime = (value, fieldName) => {
  if (typeof value !== 'string' || !TIME_REGEX.test(value.trim())) {
    throw new ServiceError(
      `Định dạng ${fieldName} không hợp lệ (yêu cầu định dạng HH:mm, từ 00:00 đến 23:59).`,
      400,
      'SHIFT_003'
    );
  }
};

// Lấy danh sách toàn bộ ca làm việc sắp xếp theo giờ bắt đầu
const getAllShiftConfigs = () => CaLamViec.findAll({ order: [['gio_bat_dau', 'ASC']] });

// Lấy chi tiết một ca làm việc theo ID
const getShiftConfigById = async (id) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400, 'SHIFT_003');
  }
  const shift = await CaLamViec.findByPk(id);
  if (!shift) throw new ServiceError('Không tìm thấy ca làm việc.', 404, 'SHIFT_001');
  return shift;
};

// Tạo mới một ca làm việc
const createShiftConfig = async (payload = {}, currentUser = null) => {
  const { ten_ca, gio_bat_dau, gio_ket_thuc, nguong_di_muon_phut } = payload;
  const kich_hoat = payload.kich_hoat !== undefined ? Boolean(payload.kich_hoat) : true;

  if (typeof ten_ca !== 'string' || !ten_ca.trim() || !gio_bat_dau || !gio_ket_thuc) {
    throw new ServiceError(
      'Vui lòng cung cấp đầy đủ tên ca (ten_ca), giờ bắt đầu (gio_bat_dau) và giờ kết thúc (gio_ket_thuc).',
      400,
      'SHIFT_003'
    );
  }
  validateTime(gio_bat_dau, 'giờ bắt đầu');
  validateTime(gio_ket_thuc, 'giờ kết thúc');
  if (gio_bat_dau.trim() === gio_ket_thuc.trim()) {
    throw new ServiceError('Giờ bắt đầu và giờ kết thúc ca làm việc không được trùng nhau.', 400, 'SHIFT_003');
  }

  const lateThreshold = nguong_di_muon_phut !== undefined ? Number(nguong_di_muon_phut) : 15;
  if (!Number.isFinite(lateThreshold) || lateThreshold < 0) {
    throw new ServiceError('Ngưỡng phút trễ (nguong_di_muon_phut) phải là số không âm.', 400, 'SHIFT_003');
  }

  const normalizedName = ten_ca.trim();
  const existing = await CaLamViec.findOne({ where: { ten_ca: normalizedName } });
  if (existing) {
    throw new ServiceError(`Ca làm việc có tên "${normalizedName}" đã tồn tại trên hệ thống.`, 409, 'SHIFT_004');
  }

  const created = await CaLamViec.create({
    ten_ca: normalizedName,
    gio_bat_dau: gio_bat_dau.trim(),
    gio_ket_thuc: gio_ket_thuc.trim(),
    nguong_di_muon_phut: Math.round(lateThreshold),
    kich_hoat,
  });
  recordShiftAudit(currentUser, 'CREATE_SHIFT', created.id, {
    ten_ca: created.ten_ca,
    gio_bat_dau: created.gio_bat_dau,
    gio_ket_thuc: created.gio_ket_thuc,
  });
  return created;
};

// Cập nhật thông tin ca làm việc
const updateShiftConfig = async (id, data = {}, currentUser = null) => {
  const shift = await getShiftConfigById(id);
  const { ten_ca, gio_bat_dau, gio_ket_thuc, nguong_di_muon_phut, kich_hoat } = data;

  if (gio_bat_dau !== undefined) validateTime(gio_bat_dau, 'giờ bắt đầu');
  if (gio_ket_thuc !== undefined) validateTime(gio_ket_thuc, 'giờ kết thúc');
  const nextStart = gio_bat_dau !== undefined ? gio_bat_dau.trim() : shift.gio_bat_dau;
  const nextEnd = gio_ket_thuc !== undefined ? gio_ket_thuc.trim() : shift.gio_ket_thuc;
  if (nextStart && nextEnd && nextStart === nextEnd) {
    throw new ServiceError('Giờ bắt đầu và giờ kết thúc ca làm việc không được trùng nhau.', 400, 'SHIFT_003');
  }

  if (
    nguong_di_muon_phut !== undefined &&
    (!Number.isFinite(Number(nguong_di_muon_phut)) || Number(nguong_di_muon_phut) < 0)
  ) {
    throw new ServiceError('Ngưỡng phút trễ (nguong_di_muon_phut) phải là số không âm.', 400, 'SHIFT_003');
  }

  if (ten_ca !== undefined) {
    if (typeof ten_ca !== 'string' || !ten_ca.trim()) {
      throw new ServiceError('Tên ca làm việc (ten_ca) không được để trống.', 400, 'SHIFT_003');
    }
    const normalizedName = ten_ca.trim();
    const duplicate = await CaLamViec.findOne({
      where: { id: { [Op.ne]: id }, ten_ca: normalizedName },
    });
    if (duplicate) {
      throw new ServiceError(`Tên ca "${normalizedName}" đã được sử dụng bởi ca làm việc khác.`, 409, 'SHIFT_004');
    }
    shift.ten_ca = normalizedName;
  }

  if (gio_bat_dau !== undefined) shift.gio_bat_dau = nextStart;
  if (gio_ket_thuc !== undefined) shift.gio_ket_thuc = nextEnd;
  if (nguong_di_muon_phut !== undefined) shift.nguong_di_muon_phut = Math.round(Number(nguong_di_muon_phut));
  if (kich_hoat !== undefined) shift.kich_hoat = Boolean(kich_hoat);

  await shift.save();
  recordShiftAudit(currentUser, 'UPDATE_SHIFT', shift.id, { updatedFields: Object.keys(data) });
  return shift;
};

// Xóa ca làm việc nếu chưa có lịch trình, chấm công hay đơn từ tham chiếu
const deleteShiftConfig = async (id, currentUser = null) => {
  const shift = await getShiftConfigById(id);
  const [scheduleCount, attendanceCount, leaveCount, exceptionCount] = await Promise.all([
    LichTrinh.count({ where: { ca_id: id } }),
    NhatKyChamCong.count({ where: { ca_id: id } }),
    DonNghiPhep.count({ where: { ca_thay_the_id: id } }),
    NgoaiLeLichTrinh.count({ where: { ca_thay_the_id: id } }),
  ]);

  if (scheduleCount > 0 || attendanceCount > 0 || leaveCount > 0 || exceptionCount > 0) {
    throw new ServiceError(
      'Không thể xóa ca làm việc vì đang được tham chiếu trong lịch trình, nhật ký chấm công hoặc đơn đổi ca. Hãy chuyển sang ngừng kích hoạt.',
      400,
      'SHIFT_002'
    );
  }
  await shift.destroy();
  recordShiftAudit(currentUser, 'DELETE_SHIFT', id, { ten_ca: shift.ten_ca });
  return shift;
};

module.exports = {
  ServiceError,
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
};
