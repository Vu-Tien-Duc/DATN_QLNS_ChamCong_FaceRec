const mongoose = require('mongoose');
require('./user.model');
require('./shiftConfig.model');
require('./subject.model');

const scheduleSchema = new mongoose.Schema(
  {
    ma_nguoi_dung: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Người được phân lịch (userId / ma_nguoi_dung) là bắt buộc'],
    },
    ma_ca: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'shiftId',
      ref: 'ShiftConfig',
      required: [true, 'Ca áp dụng (shiftId / ma_ca) là bắt buộc'],
    },
    gio_bat_dau: {
      type: String,
      alias: 'startTime',
      required: [true, 'Giờ bắt đầu lịch là bắt buộc'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ bắt đầu phải là HH:mm'],
      default: '',
    },
    gio_ket_thuc: {
      type: String,
      alias: 'endTime',
      required: [true, 'Giờ kết thúc lịch là bắt buộc'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ kết thúc phải là HH:mm'],
      default: '',
    },
    phong_hoc: {
      type: String,
      alias: 'roomId',
      trim: true,
      default: '',
    },
    ma_mon: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'subjectId',
      ref: 'Subject',
      default: null,
    },
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
    ban_kinh_met: {
      type: Number,
      alias: 'radiusMeters',
      default: 100,
      min: [10, 'Bán kính hợp lệ tối thiểu là 10 mét'],
    },
    thu_trong_tuan: {
      type: Number,
      alias: 'weekday',
      required: [true, 'Thứ trong tuần (0-6) là bắt buộc'],
      min: [0, 'Thứ trong tuần từ 0 (Chủ nhật) đến 6 (Thứ bảy)'],
      max: [6, 'Thứ trong tuần từ 0 (Chủ nhật) đến 6 (Thứ bảy)'],
    },
    lap_lai_hang_tuan: {
      type: Boolean,
      alias: 'isRecurring',
      required: [true, 'Trạng thái lặp hàng tuần là bắt buộc'],
      default: true,
    },
    ngay_bat_dau: {
      type: Date,
      alias: 'startDate',
      required: [true, 'Ngày bắt đầu hiệu lực là bắt buộc'],
    },
    ngay_ket_thuc: {
      type: Date,
      alias: 'endDate',
      required: [true, 'Ngày kết thúc hiệu lực là bắt buộc'],
    },
    tiet_bat_dau: {
      type: Number,
      alias: 'startPeriod',
      min: [1, 'Tiết bắt đầu tối thiểu là tiết 1'],
      max: [12, 'Tiết bắt đầu tối đa là tiết 12'],
      default: 1,
    },
    so_tiet: {
      type: Number,
      alias: 'periodCount',
      min: [1, 'Số tiết tối thiểu là 1'],
      max: [6, 'Số tiết tối đa là 6'],
      default: 3,
    },
    loai_lich: {
      type: String,
      alias: 'scheduleType',
      enum: ['CHINH_KHOA', 'DAY_BU'],
      default: 'CHINH_KHOA',
    },
    ngay_day_bu: {
      type: Date,
      alias: 'makeupDate',
      default: null,
    },
    ngoai_le: {
      type: [
        {
          ngay: { type: Date, required: true },
          ly_do: { type: String, default: '' },
          trang_thai: {
            type: String,
            enum: ['NGHI', 'HUY', 'DAY_BU'],
            default: 'NGHI',
          },
        },
      ],
      alias: 'exceptions',
      default: [],
    },
    danh_sach_tuan: {
      type: [Number],
      alias: 'weekNumbers',
      default: () => Array.from({ length: 15 }, (_, i) => i + 1),
    },
    nam_hoc: {
      type: String,
      alias: 'academicYear',
      default: '2025-2026',
    },
    hoc_ky: {
      type: Number,
      alias: 'semester',
      enum: [1, 2, 3],
      default: 1,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'lich_trinh',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

scheduleSchema.virtual('location')
  .get(function () {
    if (this.vi_do === null || this.vi_do === undefined || this.kinh_do === null || this.kinh_do === undefined) return undefined;
    return {
      latitude: this.vi_do,
      longitude: this.kinh_do,
      lat: this.vi_do,
      lng: this.kinh_do,
    };
  })
  .set(function (coords) {
    if (coords) {
      this.vi_do = coords.latitude !== undefined ? coords.latitude : (coords.lat !== undefined ? coords.lat : coords.vi_do);
      this.kinh_do = coords.longitude !== undefined ? coords.longitude : (coords.lng !== undefined ? coords.lng : coords.kinh_do);
    }
  });

scheduleSchema.aliases = {
  userId: 'ma_nguoi_dung',
  nguoi_dung_id: 'ma_nguoi_dung',
  shiftId: 'ma_ca',
  ca_id: 'ma_ca',
  startTime: 'gio_bat_dau',
  endTime: 'gio_ket_thuc',
  roomId: 'phong_hoc',
  subjectId: 'ma_mon',
  mon_hoc_id: 'ma_mon',
  latitude: 'vi_do',
  longitude: 'kinh_do',
  radiusMeters: 'ban_kinh_met',
  weekday: 'thu_trong_tuan',
  isRecurring: 'lap_lai_hang_tuan',
  startDate: 'ngay_bat_dau',
  endDate: 'ngay_ket_thuc',
  startPeriod: 'tiet_bat_dau',
  periodCount: 'so_tiet',
  scheduleType: 'loai_lich',
  makeupDate: 'ngay_day_bu',
  exceptions: 'ngoai_le',
  weekNumbers: 'danh_sach_tuan',
  academicYear: 'nam_hoc',
  semester: 'hoc_ky',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

scheduleSchema.virtual('createdAt').get(function () { return this.tao_luc; });
scheduleSchema.virtual('updatedAt').get(function () { return this.cap_nhat_luc; });
scheduleSchema.virtual('nguoi_dung_id').get(function () { return this.ma_nguoi_dung; });
scheduleSchema.virtual('ca_id').get(function () { return this.ma_ca; });
scheduleSchema.virtual('mon_hoc_id').get(function () { return this.ma_mon; });

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
scheduleSchema.plugin(schemaAliasPlugin);

scheduleSchema.pre('validate', async function () {
  const ShiftConfig = mongoose.models.ShiftConfig || mongoose.models.CaLamViec || require('./shiftConfig.model');
  if ((!this.gio_bat_dau || !this.gio_ket_thuc) && this.ma_ca) {
    const shift = await ShiftConfig.findById(this.ma_ca);
    if (!shift) {
      this.invalidate('shiftId', 'Không tìm thấy ca làm việc được gán cho lịch');
      this.invalidate('ma_ca', 'Không tìm thấy ca làm việc được gán cho lịch');
    } else {
      if (!this.gio_bat_dau) this.gio_bat_dau = shift.gio_bat_dau || shift.startTime;
      if (!this.gio_ket_thuc) this.gio_ket_thuc = shift.gio_ket_thuc || shift.endTime;
    }
  }

  if (this.ngay_bat_dau && this.ngay_ket_thuc && new Date(this.ngay_ket_thuc).getTime() < new Date(this.ngay_bat_dau).getTime()) {
    this.invalidate('endDate', 'Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu');
    this.invalidate('ngay_ket_thuc', 'Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu');
  }

  if (this.gio_bat_dau && this.gio_ket_thuc && this.gio_ket_thuc <= this.gio_bat_dau) {
    this.invalidate('endTime', 'Giờ kết thúc lịch phải sau giờ bắt đầu; lịch qua đêm chưa được hỗ trợ');
    this.invalidate('gio_ket_thuc', 'Giờ kết thúc lịch phải sau giờ bắt đầu; lịch qua đêm chưa được hỗ trợ');
  }
});

scheduleSchema.index({ ma_nguoi_dung: 1, thu_trong_tuan: 1 });
scheduleSchema.index({ ma_ca: 1 });
scheduleSchema.index({ ma_mon: 1 }, { sparse: true });
scheduleSchema.index({ ngay_bat_dau: 1, ngay_ket_thuc: 1 });
scheduleSchema.index({ nam_hoc: 1, hoc_ky: 1, ma_nguoi_dung: 1 });
scheduleSchema.index({ nam_hoc: 1, hoc_ky: 1, phong_hoc: 1 });

const Schedule = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema, 'lich_trinh');

if (!mongoose.models.LichTrinh) {
  mongoose.model('LichTrinh', scheduleSchema, 'lich_trinh');
}

module.exports = Schedule;
