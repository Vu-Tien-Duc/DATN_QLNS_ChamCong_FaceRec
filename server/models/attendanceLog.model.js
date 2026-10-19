const mongoose = require('mongoose');
require('./user.model');
require('./shiftConfig.model');
require('./schedule.model');
require('./leaveRequest.model');
require('./punchLog.model');

const attendanceLogSchema = new mongoose.Schema(
  {
    khoa_cong: {
      type: String,
      alias: 'workKey',
      trim: true,
    },
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Người chấm công (userId / nguoi_dung_id) là bắt buộc'],
    },
    ca_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'shiftId',
      ref: 'ShiftConfig',
      required: [true, 'Ca chấm công (shiftId / ca_id) là bắt buộc'],
    },
    lich_trinh_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'scheduleId',
      ref: 'Schedule',
      default: null,
    },
    ngay_cong: {
      type: String,
      alias: 'workDate',
      required: [true, 'Ngày công (workDate / ngay_cong) là bắt buộc định dạng YYYY-MM-DD'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Ngày công phải có định dạng YYYY-MM-DD'],
    },
    thoi_gian_vao: {
      type: Date,
      alias: 'checkInTime',
      default: null,
    },
    thoi_gian_ra: {
      type: Date,
      alias: 'checkOutTime',
      default: null,
    },
    thoi_luong_lam_viec_phut: {
      type: Number,
      alias: 'workDurationMinutes',
      default: 0,
      min: [0, 'Thời lượng làm việc không thể là số âm'],
    },
    di_muon_phut: {
      type: Number,
      alias: 'lateMinutes',
      default: 0,
      min: [0, 'Số phút đi muộn không thể là số âm'],
    },
    ve_som_phut: {
      type: Number,
      alias: 'earlyExitMinutes',
      default: 0,
      min: [0, 'Số phút về sớm không thể là số âm'],
    },
    quen_quet_ra: {
      type: Boolean,
      alias: 'isMissingCheckOut',
      default: false, // Cờ độc lập, không làm mất trạng thái đi muộn ban đầu
    },
    so_tiet_thuc_day: {
      type: Number,
      alias: 'actualTeachingPeriods',
      default: 0, // Chỉ được gán khi Check-Out hợp lệ
      min: [0, 'Số tiết thực dạy không thể âm'],
    },
    so_gio_cong: {
      type: Number,
      alias: 'workHours',
      default: 0,
      min: [0, 'Số giờ công không thể âm'],
    },
    trang_thai: {
      type: String,
      alias: 'status',
      enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'],
      default: 'ON_TIME',
      set: function (val) {
        if (!val) return val;
        const map = {
          DUNG_GIO: 'ON_TIME',
          DI_MUON: 'LATE',
          VE_SOM: 'EARLY_LEAVE',
          VANG_MAT: 'ABSENT',
          NGHI_PHEP: 'EXCUSED_ABSENCE',
          NGHI_LE: 'EXCUSED_ABSENCE',
          NGHI_KHONG_LUONG: 'EXCUSED_ABSENCE',
        };
        return map[val] || val;
      },
    },
    danh_sach_luot_quet_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      alias: 'punchIds',
      ref: 'PunchLog',
    }],
    don_tu_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'leaveRequestId',
      ref: 'LeaveRequest',
      default: null,
    },
    da_chot: {
      type: Boolean,
      alias: 'isLocked',
      default: false,
    },
    nguoi_sua_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'modifiedBy',
      ref: 'User',
      default: null,
    },
    ly_do_sua: {
      type: String,
      alias: 'modificationReason',
      default: null,
    },
    ghi_de_thu_cong: {
      type: Boolean,
      alias: 'isManualOverride',
      default: false,
    },
    nguoi_ghi_de_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'overriddenBy',
      ref: 'User',
      default: null,
    },
    ly_do_ghi_de: {
      type: String,
      alias: 'overrideReason',
      trim: true,
      default: null,
    },
    co_gian_lan: {
      type: Boolean,
      alias: 'isFraudulent',
      default: false,
    },
    co_di_muon: {
      type: Boolean,
      alias: 'isLate',
      default: false,
    },
    co_ve_som: {
      type: Boolean,
      alias: 'isEarlyLeave',
      default: false,
    },
    anh_minh_chung: {
      type: String,
      alias: 'capturedImage',
      default: null,
    },
    toa_do: {
      vi_do: { type: Number, default: null, alias: 'latitude' },
      kinh_do: { type: Number, default: null, alias: 'longitude' },
      do_chinh_xac: { type: Number, default: null, alias: 'accuracy' },
    },
    thiet_bi_id: {
      type: String,
      alias: 'deviceId',
      default: null,
    },
    phuong_thuc: {
      type: String,
      alias: 'method',
      enum: ['FACE_AI', 'QR_CODE', 'GPS_MOBILE', 'THU_CONG_ADMIN', 'SYSTEM_AUTO', 'FACE', 'QR', 'GPS', 'MANUAL', 'SYSTEM', 'ADMIN_OVERRIDE'],
      default: 'FACE_AI',
      set: function (val) {
        if (!val) return val;
        const v = String(val).toUpperCase();
        const map = {
          FACE: 'FACE_AI',
          QR: 'QR_CODE',
          GPS: 'GPS_MOBILE',
          MANUAL: 'THU_CONG_ADMIN',
          SYSTEM: 'SYSTEM_AUTO',
        };
        return map[v] || v;
      },
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'nhat_ky_cham_cong',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

attendanceLogSchema.virtual('location')
  .get(function () {
    if (!this.toa_do || this.toa_do.vi_do === null || this.toa_do.vi_do === undefined) return undefined;
    return {
      latitude: this.toa_do.vi_do,
      longitude: this.toa_do.kinh_do,
      lat: this.toa_do.vi_do,
      lng: this.toa_do.kinh_do,
      accuracy: this.toa_do.do_chinh_xac,
    };
  })
  .set(function (loc) {
    if (loc) {
      this.toa_do = {
        vi_do: loc.latitude !== undefined ? loc.latitude : (loc.lat !== undefined ? loc.lat : loc.vi_do),
        kinh_do: loc.longitude !== undefined ? loc.longitude : (loc.lng !== undefined ? loc.lng : loc.kinh_do),
        do_chinh_xac: loc.accuracy !== undefined ? loc.accuracy : loc.do_chinh_xac,
      };
    }
  });

attendanceLogSchema.virtual('punches', {
  ref: 'PunchLog',
  localField: '_id',
  foreignField: 'attendanceLogId',
});

attendanceLogSchema.virtual('luot_quet', {
  ref: 'LuotQuet',
  localField: '_id',
  foreignField: 'cham_cong_id',
});

attendanceLogSchema.aliases = {
  workKey: 'khoa_cong',
  userId: 'nguoi_dung_id',
  shiftId: 'ca_id',
  scheduleId: 'lich_trinh_id',
  date: 'ngay_cong',
  checkInTime: 'thoi_gian_vao',
  checkOutTime: 'thoi_gian_ra',
  workDurationMinutes: 'thoi_luong_lam_viec_phut',
  lateMinutes: 'di_muon_phut',
  earlyMinutes: 've_som_phut',
  isLate: 'co_di_muon',
  isEarlyLeave: 'co_ve_som',
  isMissingCheckOut: 'quen_quet_ra',
  actualTeachingPeriods: 'so_tiet_thuc_day',
  workHours: 'so_gio_cong',
  status: 'trang_thai',
  punchLogIds: 'danh_sach_luot_quet_ids',
  leaveRequestId: 'don_tu_id',
  isLocked: 'da_chot',
  modifiedBy: 'nguoi_sua_id',
  modificationReason: 'ly_do_sua',
  isManualOverride: 'ghi_de_thu_cong',
  overriddenBy: 'nguoi_ghi_de_id',
  overrideReason: 'ly_do_ghi_de',
  isFraudulent: 'co_gian_lan',
  capturedImage: 'anh_minh_chung',
  location: 'toa_do',
  latitude: 'toa_do.vi_do',
  longitude: 'toa_do.kinh_do',
  accuracy: 'toa_do.do_chinh_xac',
  deviceId: 'thiet_bi_id',
  method: 'phuong_thuc',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
attendanceLogSchema.plugin(schemaAliasPlugin);

attendanceLogSchema.pre('validate', function () {
  const vao = this.thoi_gian_vao;
  const ra = this.thoi_gian_ra;

  if (vao && ra) {
    if (new Date(ra).getTime() < new Date(vao).getTime()) {
      this.invalidate('checkOutTime', 'Thời gian ra không thể trước thời gian vào');
      this.invalidate('thoi_gian_ra', 'Thời gian ra không thể trước thời gian vào');
    } else if (this.isNew || this.isModified('thoi_gian_vao') || this.isModified('thoi_gian_ra')) {
      this.thoi_luong_lam_viec_phut = Math.round((new Date(ra).getTime() - new Date(vao).getTime()) / 60000);
    }
  }

  if (this.ghi_de_thu_cong) {
    if (!this.nguoi_ghi_de_id) {
      this.invalidate('overriddenBy', 'Ghi đè thủ công bắt buộc phải có người thực hiện');
      this.invalidate('nguoi_ghi_de_id', 'Ghi đè thủ công bắt buộc phải có người thực hiện');
    }
    if (!this.ly_do_ghi_de || !this.ly_do_ghi_de.trim()) {
      this.invalidate('overrideReason', 'Ghi đè thủ công bắt buộc phải có lý do giải trình');
      this.invalidate('ly_do_ghi_de', 'Ghi đè thủ công bắt buộc phải có lý do giải trình');
    }
  }

  if (!this.ghi_de_thu_cong) {
    if (this.don_tu_id) {
      this.trang_thai = 'EXCUSED_ABSENCE';
    } else if (this.thoi_gian_vao) {
      if (this.di_muon_phut > 0 && this.ve_som_phut > 0) {
        this.trang_thai = 'LATE';
      } else if (this.di_muon_phut > 0) {
        this.trang_thai = 'LATE';
      } else if (this.ve_som_phut > 0) {
        this.trang_thai = 'EARLY_LEAVE';
      } else if (this.trang_thai !== 'EXCUSED_ABSENCE') {
        this.trang_thai = 'ON_TIME';
      }
    }
  }

  // Tự động đồng bộ các cờ chi tiết
  if (this.di_muon_phut > 0 || this.trang_thai === 'LATE') {
    this.co_di_muon = true;
  }
  if (this.ve_som_phut > 0 || this.trang_thai === 'EARLY_LEAVE') {
    this.co_ve_som = true;
  }
});

attendanceLogSchema.index(
  { nguoi_dung_id: 1, lich_trinh_id: 1, ngay_cong: 1 },
  { unique: true, partialFilterExpression: { lich_trinh_id: { $type: 'objectId' } } }
);

attendanceLogSchema.index(
  { nguoi_dung_id: 1, ca_id: 1, ngay_cong: 1 },
  { unique: true, partialFilterExpression: { lich_trinh_id: { $type: 'null' } } }
);

attendanceLogSchema.index({ khoa_cong: 1 }, { unique: true, sparse: true });
attendanceLogSchema.index({ nguoi_dung_id: 1, ngay_cong: -1 });
attendanceLogSchema.index({ ngay_cong: 1, trang_thai: 1 });
attendanceLogSchema.index({ ngay_cong: 1, da_chot: 1 });
attendanceLogSchema.index({ don_tu_id: 1 }, { sparse: true });
attendanceLogSchema.index({ co_gian_lan: 1, ngay_cong: -1 });
attendanceLogSchema.index({ co_di_muon: 1, ngay_cong: -1 });
attendanceLogSchema.index({ co_ve_som: 1, ngay_cong: -1 });
attendanceLogSchema.index({ quen_quet_ra: 1, ngay_cong: -1 });

const AttendanceLog = mongoose.models.AttendanceLog || mongoose.model('AttendanceLog', attendanceLogSchema, 'nhat_ky_cham_cong');

if (!mongoose.models.NhatKyChamCong) {
  mongoose.model('NhatKyChamCong', attendanceLogSchema, 'nhat_ky_cham_cong');
}

if (!mongoose.models.CongTongHop) {
  mongoose.model('CongTongHop', attendanceLogSchema, 'nhat_ky_cham_cong');
}

module.exports = AttendanceLog;
