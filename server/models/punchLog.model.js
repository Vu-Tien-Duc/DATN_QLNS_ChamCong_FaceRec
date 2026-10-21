const mongoose = require('mongoose');
require('./user.model');
require('./attendanceLog.model');

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [kinh_do, vi_do]
      required: true,
    },
  },
  { _id: false }
);

const punchLogSchema = new mongoose.Schema(
  {
    cham_cong_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'attendanceLogId',
      ref: 'AttendanceLog',
      default: null,
      index: true,
    },
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Người thực hiện quét (userId / nguoi_dung_id) là bắt buộc'],
      index: true,
    },
    loai_quet: {
      type: String,
      alias: 'punchType',
      enum: ['CHECK_IN', 'CHECK_OUT'],
      required: [true, 'Loại lượt quét (punchType / loai_quet) là bắt buộc'],
      index: true,
      set: function (val) {
        if (!val) return val;
        const v = String(val).toUpperCase();
        if (v === 'VAO' || v === 'IN' || v === 'CHECKIN') return 'CHECK_IN';
        if (v === 'RA' || v === 'OUT' || v === 'CHECKOUT') return 'CHECK_OUT';
        return v;
      },
    },
    thoi_gian_quet: {
      type: Date,
      alias: 'punchTime',
      default: Date.now,
      index: true,
    },
    phuong_thuc: {
      type: String,
      alias: 'method',
      enum: ['FACE_AI', 'QR_CODE', 'GPS_MOBILE', 'THU_CONG_ADMIN', 'SYSTEM_AUTO', 'FACE', 'QR', 'GPS', 'MANUAL', 'SYSTEM', 'ADMIN_OVERRIDE'],
      required: [true, 'Phương thức quét (method / phuong_thuc) là bắt buộc'],
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
    do_tin_cay_ai: {
      type: Number,
      alias: 'confidenceScore',
      default: null,
      min: [0, 'Độ tin cậy AI không thể nhỏ hơn 0'],
      max: [1, 'Độ tin cậy AI không thể lớn hơn 1'],
    },
    diem_mat_that: {
      type: Number,
      alias: 'livenessScore',
      default: null,
      min: [0, 'Điểm chống giả mạo không thể nhỏ hơn 0'],
      max: [1, 'Điểm chống giả mạo không thể lớn hơn 1'],
    },
    goc_mat_nhan_dien: {
      type: String,
      alias: 'faceAngle',
      enum: ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong', null],
      default: null,
    },
    goc_dau_3d: {
      pitch: { type: Number, default: null, alias: 'pitch' },
      yaw: { type: Number, default: null, alias: 'yaw' },
      roll: { type: Number, default: null, alias: 'roll' },
    },
    anh_minh_chung: {
      type: String,
      alias: 'evidenceImage',
      default: null,
    },
    // GeoJSON Point chuẩn với default: undefined chống lỗi 2dsphere:
    toa_do_gps: {
      type: pointSchema,
      alias: 'gpsPoint',
      default: undefined,
    },
    do_chinh_xac_gps: {
      type: Number,
      alias: 'gpsAccuracy',
      default: null,
    },
    vi_tri_gia_lap: {
      type: Boolean,
      alias: 'isMockLocation',
      default: false,
    },
    toa_do: {
      vi_do: {
        type: Number,
        alias: 'latitude',
        default: null,
      },
      kinh_do: {
        type: Number,
        alias: 'longitude',
        default: null,
      },
    },
    khoang_cach_met: {
      type: Number,
      alias: 'distanceMeters',
      default: null,
      min: [0, 'Khoảng cách không thể là số âm'],
    },
    thiet_bi_id: {
      type: String,
      alias: 'deviceId',
      default: 'CAMERA_DEFAULT',
    },
    co_gian_lan: {
      type: Boolean,
      alias: 'isFraudulent',
      default: false,
      index: true,
    },
    ly_do_gian_lan: {
      type: String,
      alias: 'fraudReason',
      trim: true,
      default: null,
    },
    dia_chi_ip: {
      type: String,
      alias: 'clientIp',
      default: null,
      trim: true,
    },
    mang_noi_bo_truong: {
      type: Boolean,
      alias: 'isCampusNetwork',
      default: null,
    },
    nghi_van_gia_mao: {
      type: Boolean,
      alias: 'isSuspicious',
      default: false,
      index: true,
    },
    ly_do_nghi_van: {
      type: String,
      alias: 'suspiciousReason',
      trim: true,
      default: null,
    },
    phuong_thuc_xac_thuc_vi_tri: {
      type: String,
      alias: 'verificationMethod',
      default: null,
      trim: true,
    },
    trang_thai: {
      type: String,
      alias: 'status',
      enum: ['THANH_CONG', 'THAT_BAI'],
      default: 'THANH_CONG',
    },
    ly_do_that_bai: {
      type: String,
      alias: 'failureReason',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: false },
    collection: 'luot_quet_cham_cong',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

punchLogSchema.virtual('coordinates')
  .get(function () {
    return this.toa_do ? { latitude: this.toa_do.vi_do, longitude: this.toa_do.kinh_do } : undefined;
  })
  .set(function (coords) {
    if (coords) {
      this.toa_do = {
        vi_do: coords.latitude !== undefined ? coords.latitude : coords.vi_do,
        kinh_do: coords.longitude !== undefined ? coords.longitude : coords.kinh_do,
      };
    }
  });

punchLogSchema.virtual('location')
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

// Bảng ánh xạ định danh tiếng Anh chuẩn duy nhất (Canonical English Aliases)
punchLogSchema.aliases = {
  attendanceLogId: 'cham_cong_id',
  userId: 'nguoi_dung_id',
  punchType: 'loai_quet',
  punchTime: 'thoi_gian_quet',
  method: 'phuong_thuc',
  confidenceScore: 'do_tin_cay_ai',
  livenessScore: 'diem_mat_that',
  faceAngle: 'goc_mat_nhan_dien',
  evidenceImage: 'anh_minh_chung',
  coordinates: 'toa_do',
  latitude: 'toa_do.vi_do',
  longitude: 'toa_do.kinh_do',
  gpsPoint: 'toa_do_gps',
  gpsAccuracy: 'do_chinh_xac_gps',
  isMockLocation: 'vi_tri_gia_lap',
  distanceMeters: 'khoang_cach_met',
  deviceId: 'thiet_bi_id',
  isFraudulent: 'co_gian_lan',
  fraudReason: 'ly_do_gian_lan',
  clientIp: 'dia_chi_ip',
  isCampusNetwork: 'mang_noi_bo_truong',
  isSuspicious: 'nghi_van_gia_mao',
  suspiciousReason: 'ly_do_nghi_van',
  verificationMethod: 'phuong_thuc_xac_thuc_vi_tri',
  headPose3D: 'goc_dau_3d',
  status: 'trang_thai',
  failureReason: 'ly_do_that_bai',
  createdAt: 'tao_luc',
};

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
punchLogSchema.plugin(schemaAliasPlugin);

punchLogSchema.pre('validate', function () {
  const score = this.do_tin_cay_ai;
  if (score !== undefined && score !== null && (score < 0 || score > 1)) {
    this.invalidate('confidenceScore', 'Độ tin cậy AI phải nằm trong khoảng từ 0 đến 1');
    this.invalidate('do_tin_cay_ai', 'Độ tin cậy AI phải nằm trong khoảng từ 0 đến 1');
  }
});

punchLogSchema.index({ toa_do_gps: '2dsphere' }, { sparse: true });
punchLogSchema.index({ cham_cong_id: 1, loai_quet: 1 });
punchLogSchema.index({ nguoi_dung_id: 1, thoi_gian_quet: -1 });

const PunchLog = mongoose.models.PunchLog || mongoose.model('PunchLog', punchLogSchema, 'luot_quet_cham_cong');

if (!mongoose.models.LuotQuet) {
  mongoose.model('LuotQuet', punchLogSchema, 'luot_quet_cham_cong');
}

if (!mongoose.models.LuotQuetChamCong) {
  mongoose.model('LuotQuetChamCong', punchLogSchema, 'luot_quet_cham_cong');
}

module.exports = PunchLog;

