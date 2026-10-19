const mongoose = require('mongoose');
require('./user.model');

const holidaySchema = new mongoose.Schema(
  {
    ten_ngay_le: {
      type: String,
      alias: 'name',
      required: [true, 'Tên ngày nghỉ lễ là bắt buộc'],
      trim: true,
      maxlength: [150, 'Tên ngày lễ không được vượt quá 150 ký tự'],
    },
    ngay_bat_dau: {
      type: String,
      alias: 'startDate',
      required: [true, 'Ngày bắt đầu nghỉ lễ (YYYY-MM-DD) là bắt buộc'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải có định dạng YYYY-MM-DD'],
    },
    ngay_ket_thuc: {
      type: String,
      alias: 'endDate',
      required: [true, 'Ngày kết thúc nghỉ lễ (YYYY-MM-DD) là bắt buộc'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải có định dạng YYYY-MM-DD'],
    },
    nam: {
      type: Number,
      alias: 'year',
      default: () => new Date().getFullYear(),
      index: true,
    },
    huong_luong: {
      type: Boolean,
      alias: 'isPaid',
      default: true,
    },
    mo_ta: {
      type: String,
      alias: 'description',
      trim: true,
      default: null,
    },
    nguoi_tao_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'createdBy',
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'ngay_nghi_le',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

holidaySchema.aliases = {
  name: 'ten_ngay_le',
  startDate: 'ngay_bat_dau',
  endDate: 'ngay_ket_thuc',
  year: 'nam',
  isPaid: 'huong_luong',
  description: 'mo_ta',
  createdBy: 'nguoi_tao_id',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};



const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
holidaySchema.plugin(schemaAliasPlugin);

holidaySchema.index({ ngay_bat_dau: 1, ngay_ket_thuc: 1 });

const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema, 'ngay_nghi_le');

if (!mongoose.models.NgayNghiLe) {
  mongoose.model('NgayNghiLe', holidaySchema, 'ngay_nghi_le');
}

module.exports = Holiday;
