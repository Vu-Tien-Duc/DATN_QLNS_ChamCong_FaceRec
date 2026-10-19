const mongoose = require('mongoose');

const shiftConfigSchema = new mongoose.Schema(
  {
    ten_ca: {
      type: String,
      alias: 'name',
      required: [true, 'Tên ca làm việc là bắt buộc'],
      trim: true,
    },
    gio_bat_dau: {
      type: String,
      alias: 'startTime',
      required: [true, 'Giờ bắt đầu ca (HH:mm) là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ bắt đầu phải là HH:mm'],
      trim: true,
    },
    gio_ket_thuc: {
      type: String,
      alias: 'endTime',
      required: [true, 'Giờ kết thúc ca (HH:mm) là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ kết thúc phải là HH:mm'],
      trim: true,
    },
    nguong_di_muon_phut: {
      type: Number,
      alias: 'lateThresholdMinutes',
      required: [true, 'Ngưỡng phút trễ cho phép là bắt buộc'],
      default: 15,
      min: [0, 'Ngưỡng phút trễ không thể là số âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Ngưỡng phút trễ phải là số nguyên',
      },
    },
    kich_hoat: {
      type: Boolean,
      alias: 'isActive',
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'ca_lam_viec',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

shiftConfigSchema.aliases = {
  name: 'ten_ca',
  startTime: 'gio_bat_dau',
  endTime: 'gio_ket_thuc',
  lateThresholdMinutes: 'nguong_di_muon_phut',
  isActive: 'kich_hoat',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};



const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
shiftConfigSchema.plugin(schemaAliasPlugin);

shiftConfigSchema.pre('validate', function () {
  const st = this.gio_bat_dau;
  const et = this.gio_ket_thuc;
  if (st && et && et <= st) {
    this.invalidate('gio_ket_thuc', 'Giờ kết thúc ca phải sau giờ bắt đầu; ca qua đêm chưa được hỗ trợ');
    this.invalidate('endTime', 'Giờ kết thúc ca phải sau giờ bắt đầu; ca qua đêm chưa được hỗ trợ');
  }
  const late = this.nguong_di_muon_phut;
  if (late !== undefined && late !== null && !Number.isInteger(late)) {
    this.invalidate('lateThresholdMinutes', 'Ngưỡng phút trễ phải là số nguyên');
    this.invalidate('nguong_di_muon_phut', 'Ngưỡng phút trễ phải là số nguyên');
  }
});

shiftConfigSchema.index({ ten_ca: 1 });
shiftConfigSchema.index({ gio_bat_dau: 1, gio_ket_thuc: 1 });

const ShiftConfig = mongoose.models.ShiftConfig || mongoose.model('ShiftConfig', shiftConfigSchema, 'ca_lam_viec');

if (!mongoose.models.CaLamViec) {
  mongoose.model('CaLamViec', shiftConfigSchema, 'ca_lam_viec');
}

if (!mongoose.models.CauHinhCa) {
  mongoose.model('CauHinhCa', shiftConfigSchema, 'ca_lam_viec');
}

module.exports = ShiftConfig;
