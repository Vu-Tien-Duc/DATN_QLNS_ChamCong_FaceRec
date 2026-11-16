/**
 * Quản lý cấu hình ca làm việc (CaLamViec) trên SQL Server (Sequelize).
 */
const { Op } = require('sequelize');
const { CaLamViec, LichTrinh } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid } = require('../../utils/hoTroSequelize');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateTime = (value, fieldName) => {
  if (typeof value !== 'string' || !TIME_REGEX.test(value.trim())) {
    throw new ServiceError(
      `Định dạng ${fieldName} không hợp lệ (yêu cầu định dạng HH:mm, từ 00:00 đến 23:59).`,
      400,
      'SHIFT_003'
    );
  }
};

const getAllShiftConfigs = () => CaLamViec.findAll({ order: [['gio_bat_dau', 'ASC']] });

const getShiftConfigById = async (id) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400, 'SHIFT_003');
  }
  const shift = await CaLamViec.findByPk(id);
  if (!shift) throw new ServiceError('Không tìm thấy ca làm việc.', 404, 'SHIFT_001');
  return shift;
};

const createShiftConfig = async (payload = {}) => {
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

  const lateThreshold = nguong_di_muon_phut !== undefined ? Number(nguong_di_muon_phut) : 15;
  if (!Number.isFinite(lateThreshold) || lateThreshold < 0) {
    throw new ServiceError('Ngưỡng phút trễ (nguong_di_muon_phut) phải là số không âm.', 400, 'SHIFT_003');
  }

  const normalizedName = ten_ca.trim();
  const existing = await CaLamViec.findOne({ where: { ten_ca: normalizedName } });
  if (existing) {
    throw new ServiceError(`Ca làm việc có tên "${ten_ca}" đã tồn tại trên hệ thống.`, 409, 'SHIFT_004');
  }

  return CaLamViec.create({
    ten_ca: normalizedName,
    gio_bat_dau: gio_bat_dau.trim(),
    gio_ket_thuc: gio_ket_thuc.trim(),
    nguong_di_muon_phut: Math.round(lateThreshold),
    kich_hoat,
  });
};

const updateShiftConfig = async (id, data = {}) => {
  const shift = await getShiftConfigById(id);
  const { ten_ca, gio_bat_dau, gio_ket_thuc, nguong_di_muon_phut, kich_hoat } = data;

  if (gio_bat_dau !== undefined) validateTime(gio_bat_dau, 'giờ bắt đầu');
  if (gio_ket_thuc !== undefined) validateTime(gio_ket_thuc, 'giờ kết thúc');
  if (
    nguong_di_muon_phut !== undefined &&
    (!Number.isFinite(Number(nguong_di_muon_phut)) || Number(nguong_di_muon_phut) < 0)
  ) {
    throw new ServiceError('Ngưỡng phút trễ (nguong_di_muon_phut) phải là số không âm.', 400, 'SHIFT_003');
  }

  if (ten_ca) {
    const normalizedName = ten_ca.trim();
    const duplicate = await CaLamViec.findOne({
      where: { id: { [Op.ne]: id }, ten_ca: normalizedName },
    });
    if (duplicate) {
      throw new ServiceError(`Tên ca "${ten_ca}" đã được sử dụng bởi ca làm việc khác.`, 409, 'SHIFT_004');
    }
    shift.ten_ca = normalizedName;
  }

  if (gio_bat_dau !== undefined) shift.gio_bat_dau = gio_bat_dau.trim();
  if (gio_ket_thuc !== undefined) shift.gio_ket_thuc = gio_ket_thuc.trim();
  if (nguong_di_muon_phut !== undefined) shift.nguong_di_muon_phut = Math.round(Number(nguong_di_muon_phut));
  if (kich_hoat !== undefined) shift.kich_hoat = Boolean(kich_hoat);

  await shift.save();
  return shift;
};

const deleteShiftConfig = async (id) => {
  const shift = await getShiftConfigById(id);
  const scheduleCount = await LichTrinh.count({ where: { ca_id: id } });
  if (scheduleCount > 0) {
    throw new ServiceError(
      `Không thể xóa ca làm việc vì đang được ${scheduleCount} lịch giảng dạy/công tác tham chiếu.`,
      400,
      'SHIFT_002'
    );
  }
  await shift.destroy();
  return shift;
};

module.exports = {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
};
