/**
 * Quản lý cấu hình ca làm việc và kiểm tra liên kết ca với các lịch hiện có.
 */
const mongoose = require('mongoose');
const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const ServiceError = require('../utils/serviceError');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateTime = (value, fieldName) => {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    throw new ServiceError(
      `Định dạng ${fieldName} không hợp lệ (yêu cầu định dạng HH:mm, từ 00:00 đến 23:59).`,
      400,
      'SHIFT_003'
    );
  }
};

const getAllShiftConfigs = () => ShiftConfig.find().sort({ startTime: 1 });

const getShiftConfigById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400, 'SHIFT_003');
  }
  const shift = await ShiftConfig.findById(id);
  if (!shift) throw new ServiceError('Không tìm thấy ca làm việc.', 404, 'SHIFT_001');
  return shift;
};

const createShiftConfig = async (payload = {}) => {
  const name = payload.name;
  const startTime = payload.startTime;
  const endTime = payload.endTime;
  const lateThresholdMinutes = payload.lateThresholdMinutes;

  if (typeof name !== 'string' || !name.trim() || !startTime || !endTime) {
    throw new ServiceError(
      'Vui lòng cung cấp đầy đủ tên ca (name), giờ bắt đầu (startTime) và giờ kết thúc (endTime).',
      400,
      'SHIFT_003'
    );
  }
  validateTime(startTime, 'giờ bắt đầu hoặc giờ kết thúc');
  validateTime(endTime, 'giờ bắt đầu hoặc giờ kết thúc');

  const lateThreshold = lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : 15;
  if (!Number.isFinite(lateThreshold) || lateThreshold < 0) {
    throw new ServiceError('Ngưỡng phút trễ (lateThresholdMinutes) phải là số không âm.', 400, 'SHIFT_003');
  }

  const normalizedName = name.trim();
  if (await ShiftConfig.findOne({ name: normalizedName })) {
    throw new ServiceError(`Ca làm việc có tên "${name}" đã tồn tại trên hệ thống.`, 409, 'SHIFT_004');
  }
  return ShiftConfig.create({
    name: normalizedName,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    lateThresholdMinutes: lateThreshold,
  });
};

const updateShiftConfig = async (id, data = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400, 'SHIFT_003');
  }
  const name = data.name;
  const startTime = data.startTime;
  const endTime = data.endTime;
  const lateThresholdMinutes = data.lateThresholdMinutes;

  if (startTime !== undefined) validateTime(startTime, 'giờ bắt đầu');
  if (endTime !== undefined) validateTime(endTime, 'giờ kết thúc');
  if (
    lateThresholdMinutes !== undefined &&
    (!Number.isFinite(Number(lateThresholdMinutes)) || Number(lateThresholdMinutes) < 0)
  ) {
    throw new ServiceError('Ngưỡng phút trễ (lateThresholdMinutes) phải là số không âm.', 400, 'SHIFT_003');
  }
  if (name) {
    const normalizedName = name.trim();
    const duplicate = await ShiftConfig.findOne({ _id: { $ne: id }, name: normalizedName });
    if (duplicate) {
      throw new ServiceError(`Tên ca "${name}" đã được sử dụng bởi ca làm việc khác.`, 409, 'SHIFT_004');
    }
  }

  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (startTime !== undefined) update.startTime = startTime.trim();
  if (endTime !== undefined) update.endTime = endTime.trim();
  if (lateThresholdMinutes !== undefined) update.lateThresholdMinutes = Number(lateThresholdMinutes);

  const shift = await ShiftConfig.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!shift) throw new ServiceError('Không tìm thấy ca làm việc để cập nhật.', 404, 'SHIFT_001');
  return shift;
};

const deleteShiftConfig = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError('Định dạng ID ca làm việc không hợp lệ.', 400, 'SHIFT_003');
  }
  const scheduleCount = await Schedule.countDocuments({ shiftId: id });
  if (scheduleCount > 0) {
    throw new ServiceError(
      `Không thể xóa ca làm việc vì đang được ${scheduleCount} lịch giảng dạy/công tác tham chiếu.`,
      400,
      'SHIFT_002'
    );
  }
  const deleted = await ShiftConfig.findByIdAndDelete(id);
  if (!deleted) throw new ServiceError('Không tìm thấy ca làm việc để xóa.', 404, 'SHIFT_001');
  return deleted;
};

module.exports = {
  ServiceError,
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
};
