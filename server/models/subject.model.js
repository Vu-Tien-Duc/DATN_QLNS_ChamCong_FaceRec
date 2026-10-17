const mongoose = require('mongoose');
require('./department.model');

const subjectSchema = new mongoose.Schema(
  {
    ma_mon: {
      type: String,
      alias: 'code',
      required: [true, 'Mã môn học là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    ten_mon: {
      type: String,
      alias: 'name',
      required: [true, 'Tên môn học là bắt buộc'],
      trim: true,
    },
    so_tin_chi: {
      type: Number,
      alias: 'credits',
      min: [1, 'Số tín chỉ tối thiểu là 1'],
      default: 3,
    },
    ma_phong_ban: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'departmentId',
      ref: 'Department',
      default: null,
    },
    mo_ta: {
      type: String,
      alias: 'description',
      trim: true,
      default: '',
    },
    kich_hoat: {
      type: Boolean,
      alias: 'isActive',
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'mon_hoc',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

subjectSchema.aliases = {
  code: 'ma_mon',
  name: 'ten_mon',
  credits: 'so_tin_chi',
  departmentId: 'ma_phong_ban',
  phong_ban_id: 'ma_phong_ban',
  description: 'mo_ta',
  isActive: 'kich_hoat',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

subjectSchema.virtual('createdAt').get(function () { return this.tao_luc; });
subjectSchema.virtual('updatedAt').get(function () { return this.cap_nhat_luc; });
subjectSchema.virtual('phong_ban_id').get(function () { return this.ma_phong_ban; });

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
subjectSchema.plugin(schemaAliasPlugin);

subjectSchema.index({ ten_mon: 1 });
subjectSchema.index({ ma_phong_ban: 1 });
subjectSchema.index({ kich_hoat: 1 });

const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema, 'mon_hoc');

if (!mongoose.models.MonHoc) {
  mongoose.model('MonHoc', subjectSchema, 'mon_hoc');
}

module.exports = Subject;
