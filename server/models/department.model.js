const mongoose = require('mongoose');
require('./user.model');

const departmentSchema = new mongoose.Schema(
  {
    ten_phong_ban: {
      type: String,
      alias: 'name',
      required: [true, 'Tên khoa/bộ môn/phòng ban là bắt buộc'],
      trim: true,
    },
    loai_don_vi: {
      type: String,
      alias: 'type',
      enum: {
        values: ['khoa', 'bomon', 'phongban'],
        message: 'Loại đơn vị không hợp lệ ({VALUE}). Chấp nhận: khoa, bomon, phongban',
      },
      required: [true, 'Loại đơn vị (khoa, bomon, phongban) là bắt buộc'],
    },
    don_vi_cha_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'parentId',
      ref: 'Department',
      default: null,
    },
    truong_don_vi_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'managerId',
      ref: 'User',
      default: null,
    },
    toa_do: {
      vi_do: {
        type: Number,
        alias: 'latitude',
        min: [-90, 'Vĩ độ phải nằm trong khoảng -90 đến 90'],
        max: [90, 'Vĩ độ phải nằm trong khoảng -90 đến 90'],
        default: null,
      },
      kinh_do: {
        type: Number,
        alias: 'longitude',
        min: [-180, 'Kinh độ phải nằm trong khoảng -180 đến 180'],
        max: [180, 'Kinh độ phải nằm trong khoảng -180 đến 180'],
        default: null,
      },
    },
    ban_kinh_met: {
      type: Number,
      alias: 'radiusMeters',
      default: 200,
      min: [10, 'Bán kính hợp lệ tối thiểu là 10 mét'],
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'phong_ban',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

departmentSchema.virtual('location')
  .get(function () {
    if (!this.toa_do || this.toa_do.vi_do === null || this.toa_do.vi_do === undefined) return undefined;
    return {
      latitude: this.toa_do.vi_do,
      longitude: this.toa_do.kinh_do,
      lat: this.toa_do.vi_do,
      lng: this.toa_do.kinh_do,
    };
  })
  .set(function (coords) {
    if (coords) {
      this.toa_do = {
        vi_do: coords.latitude !== undefined ? coords.latitude : (coords.lat !== undefined ? coords.lat : coords.vi_do),
        kinh_do: coords.longitude !== undefined ? coords.longitude : (coords.lng !== undefined ? coords.lng : coords.kinh_do),
      };
    }
  });

departmentSchema.aliases = {
  name: 'ten_phong_ban',
  type: 'loai_don_vi',
  parentId: 'don_vi_cha_id',
  managerId: 'truong_don_vi_id',
  location: 'toa_do',
  latitude: 'toa_do.vi_do',
  longitude: 'toa_do.kinh_do',
  radiusMeters: 'ban_kinh_met',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};



const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
departmentSchema.plugin(schemaAliasPlugin);

departmentSchema.index(
  { don_vi_cha_id: 1, ten_phong_ban: 1 },
  { unique: true, collation: { locale: 'vi', strength: 2 } }
);
departmentSchema.index({ truong_don_vi_id: 1 });
departmentSchema.index({ loai_don_vi: 1 });

const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema, 'phong_ban');

if (!mongoose.models.PhongBan) {
  mongoose.model('PhongBan', departmentSchema, 'phong_ban');
}

module.exports = Department;
