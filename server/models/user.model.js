const mongoose = require('mongoose');
const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
require('./department.model');

const GENDER_MAP = {
  NAM: 'MALE',
  NU: 'FEMALE',
  KHAC: 'OTHER',
  MALE: 'NAM',
  FEMALE: 'NU',
  OTHER: 'KHAC',
};

const CONTRACT_MAP = {
  TOAN_THOI_GIAN: 'FULL_TIME',
  BAN_THOI_GIAN: 'PART_TIME',
  THU_VIEC: 'PROBATION',
  KHONG_XAC_DINH_THOI_HAN: 'INDEFINITE',
  XAC_DINH_THOI_HAN: 'DEFINITE',
  FULL_TIME: 'TOAN_THOI_GIAN',
  PART_TIME: 'BAN_THOI_GIAN',
  PROBATION: 'THU_VIEC',
  INDEFINITE: 'KHONG_XAC_DINH_THOI_HAN',
  DEFINITE: 'XAC_DINH_THOI_HAN',
};

const vaiTroSchema = new mongoose.Schema(
  {
    ma_vai_tro: {
      type: String,
      alias: 'role',
      enum: [
        'ADMIN', 'BGH', 'TCCB', 'DAO_TAO', 'KE_TOAN', 'KIEM_TOAN',
        'TRUONG_KHOA', 'PHO_TRUONG_KHOA',
        'TRUONG_BO_MON', 'PHO_TRUONG_BO_MON',
        'TRUONG_PHONG', 'PHO_TRUONG_PHONG',
        'GIANG_VIEN', 'CHUYEN_VIEN'
      ],
      required: true,
    },
    pham_vi: {
      type: String,
      alias: 'scope',
      enum: ['TOAN_TRUONG', 'KHOA', 'BO_MON', 'PHONG_BAN'],
      required: true,
    },
    don_vi_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'departmentId',
      ref: 'Department',
      default: null,
    },
    duoc_uy_quyen: {
      type: Boolean,
      default: false,
    },
    tu_ngay: {
      type: Date,
      default: Date.now,
    },
    den_ngay: {
      type: Date,
      default: null, // null: Đang trong nhiệm kỳ; có giá trị: Đã đóng nhiệm kỳ
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

vaiTroSchema.virtual('ma_don_vi')
  .get(function () { return this.don_vi_id; })
  .set(function (v) { this.don_vi_id = v; });

vaiTroSchema.aliases = {
  role: 'ma_vai_tro',
  scope: 'pham_vi',
  departmentId: 'don_vi_id',
};
vaiTroSchema.plugin(schemaAliasPlugin);

const userSchema = new mongoose.Schema(
  {
    ho_ten: {
      type: String,
      alias: 'fullName',
      required: [true, 'Họ tên hiển thị là bắt buộc'],
      trim: true,
      minlength: [2, 'Họ tên phải có độ dài tối thiểu 2 ký tự'],
      maxlength: [100, 'Họ tên không được vượt quá 100 ký tự'],
      validate: {
        validator: (v) => typeof v === 'string' && v.trim().length >= 2,
        message: 'Họ tên không được để trống hoặc chỉ chứa khoảng trắng',
      },
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Định dạng email không hợp lệ'],
    },
    ma_can_bo: {
      type: String,
      alias: 'staffCode',
      trim: true,
      uppercase: true,
      minlength: [2, 'Mã cán bộ phải có ít nhất 2 ký tự'],
      maxlength: [30, 'Mã cán bộ không được vượt quá 30 ký tự'],
      match: [/^[A-Z0-9][A-Z0-9_-]*$/, 'Mã cán bộ chỉ được chứa chữ in hoa, số, dấu gạch ngang hoặc gạch dưới'],
    },
    so_dien_thoai: {
      type: String,
      alias: 'phoneNumber',
      trim: true,
      minlength: [7, 'Số điện thoại phải có ít nhất 7 ký tự'],
      maxlength: [20, 'Số điện thoại không được vượt quá 20 ký tự'],
    },
    hoc_ham: {
      type: String,
      alias: 'academicRank',
      enum: ['GIAO_SU', 'PHO_GIAO_SU', 'KHONG'],
      default: 'KHONG',
    },
    hoc_vi: {
      type: String,
      alias: 'degree',
      enum: ['TIEN_SI', 'THAC_SI', 'CU_NHAN', 'KY_SU', 'KHAC'],
      default: 'CU_NHAN',
    },
    ngach_luong: {
      type: String,
      alias: 'salaryScale',
      default: 'V.07.01.03',
    },
    he_so_luong: {
      type: Number,
      alias: 'salaryCoefficient',
      default: 2.34,
    },
    so_nguoi_phu_thuoc: {
      type: Number,
      alias: 'dependentsCount',
      default: 0,
      min: [0, 'Số người phụ thuộc không thể âm'],
    },
    ngay_bat_dau_giang_day: {
      type: Date,
      alias: 'teachingStartDate',
      default: null,
    },
    so_cccd_ma_hoa: {
      type: String,
      alias: 'encryptedCccd',
      select: false,
      default: null,
    },
    phien_ban_khoa_cccd: {
      type: Number,
      alias: 'cccdKeyVersion',
      default: 1,
    },
    gioi_tinh: {
      type: String,
      alias: 'gender',
      enum: ['NAM', 'NU', 'KHAC', 'MALE', 'FEMALE', 'OTHER'],
      default: 'NAM',
    },
    chuc_vu: {
      type: mongoose.Schema.Types.Mixed,
      alias: 'position',
      default: '',
    },
    loai_nhan_su: {
      type: String,
      alias: 'staffType',
      enum: ['GIANG_VIEN', 'HANH_CHINH'],
      default: 'GIANG_VIEN',
    },
    loai_hop_dong: {
      type: String,
      alias: 'contractType',
      enum: [
        'TOAN_THOI_GIAN', 'BAN_THOI_GIAN', 'THU_VIEC', 'KHONG_XAC_DINH_THOI_HAN', 'XAC_DINH_THOI_HAN',
        'FULL_TIME', 'PART_TIME', 'PROBATION', 'INDEFINITE', 'DEFINITE', 'FIXED_TERM'
      ],
      default: 'TOAN_THOI_GIAN',
    },
    ngay_sinh: {
      type: Date,
      alias: 'dateOfBirth',
      default: null,
    },
    ngay_vao_lam: {
      type: Date,
      alias: 'startDate',
      default: Date.now,
    },
    dia_chi: {
      type: String,
      alias: 'address',
      trim: true,
      maxlength: [255, 'Địa chỉ không được vượt quá 255 ký tự'],
      default: '',
    },
    mat_khau_ma_hoa: {
      type: String,
      alias: 'passwordHash',
      required: [true, 'Mật khẩu là bắt buộc'],
      select: false,
    },
    // Vai trò phẳng cũ (tương thích ngược)
    vai_tro_chinh: {
      type: String,
      alias: 'primaryRole',
      enum: [
        'admin', 'truongkhoa', 'phokhoa', 'truongbomon', 'phobomon', 'giangvien', 'nhanvien',
        'ADMIN', 'BGH', 'bgh', 'TCCB', 'tccb', 'DAO_TAO', 'dao_tao', 'KE_TOAN', 'ke_toan', 'KIEM_TOAN', 'kiem_toan'
      ],
      default: 'giangvien',
    },
    // Mảng vai trò RBAC chuẩn v2.5 có nhiệm kỳ
    danh_sach_vai_tro: {
      type: [vaiTroSchema],
      alias: 'roles',
      default: [],
    },
    don_vi_chinh_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'mainDepartmentId',
      ref: 'Department',
      default: null,
    },
    anh_dai_dien: {
      type: String,
      alias: 'avatar',
      default: null,
      trim: true,
    },
    kich_hoat: {
      type: Boolean,
      alias: 'isActive',
      default: true,
      required: true,
    },
    trang_thai_lam_viec: {
      type: String,
      alias: 'employmentStatus',
      enum: ['DANG_LAM_VIEC', 'DA_NGHI_VIEC', 'TAM_HOAN', 'ACTIVE', 'RESIGNED', 'SUSPENDED', 'PROBATION', 'ON_LEAVE'],
      default: 'DANG_LAM_VIEC',
    },
    han_muc_phep_nam: {
      type: Number,
      alias: 'annualLeaveQuota',
      default: 12,
    },
    phien_ban_don_nghi: {
      type: Number,
      alias: 'leaveVersion',
      default: 0,
      select: false,
    },
    phien_ban_token: {
      type: Number,
      alias: 'tokenVersion',
      default: 1, // Tăng lên khi logout/đổi mật khẩu để hủy JWT tức thì
    },
    ngay_dong_y_sinh_trac: {
      type: Date,
      alias: 'biometricConsentDate',
      default: null,
    },
    da_xac_thuc: {
      type: Boolean,
      alias: 'isVerified',
      required: true,
      default: false,
    },
    doi_mat_khau_luc: {
      type: Date,
      alias: 'passwordChangedAt',
      default: null,
    },
    ma_otp: {
      type: String,
      alias: 'otpCode',
      default: null,
      select: false,
    },
    otp_het_han_luc: {
      type: Date,
      alias: 'otpExpiresAt',
      default: null,
      select: false,
    },
    loai_otp: {
      type: String,
      alias: 'otpType',
      enum: ['VERIFY_ACCOUNT', 'FORGOT_PASSWORD'],
      default: null,
      select: false,
    },
    so_lan_thu_otp: {
      type: Number,
      alias: 'otpAttempts',
      default: 0,
      select: false,
    },
    otp_gui_luc: {
      type: Date,
      alias: 'otpSentAt',
      default: null,
      select: false,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'nguoi_dung',
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.mat_khau_ma_hoa;
        delete ret.passwordHash;
        delete ret.so_cccd;
        delete ret.identityCard;
        delete ret.ma_otp;
        delete ret.otpCode;
        delete ret.otp_het_han_luc;
        delete ret.otpExpiresAt;
        delete ret.loai_otp;
        delete ret.otpType;
        delete ret.so_lan_thu_otp;
        delete ret.otpAttempts;
        delete ret.otp_gui_luc;
        delete ret.otpSentAt;
        delete ret.phien_ban_don_nghi;

        if (typeof ret.anh_dai_dien === 'string') {
          let cleaned = ret.anh_dai_dien;
          if (cleaned.startsWith('http://chamcongdh.io.vn')) {
            cleaned = cleaned.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
          }
          if (cleaned.startsWith('/uploads/')) {
            cleaned = `/api${cleaned}`;
          } else if (cleaned.includes('chamcongdh.io.vn/uploads/')) {
            cleaned = cleaned.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/uploads/');
          }
          ret.anh_dai_dien = cleaned;
          ret.avatar = cleaned;
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.mat_khau_ma_hoa;
        delete ret.passwordHash;
        delete ret.so_cccd;
        delete ret.identityCard;
        delete ret.ma_otp;
        delete ret.otpCode;
        delete ret.otp_het_han_luc;
        delete ret.otpExpiresAt;
        delete ret.loai_otp;
        delete ret.otpType;
        delete ret.so_lan_thu_otp;
        delete ret.otpAttempts;
        delete ret.otp_gui_luc;
        delete ret.otpSentAt;
        delete ret.phien_ban_don_nghi;

        if (typeof ret.anh_dai_dien === 'string') {
          let cleaned = ret.anh_dai_dien;
          if (cleaned.startsWith('http://chamcongdh.io.vn')) {
            cleaned = cleaned.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
          }
          if (cleaned.startsWith('/uploads/')) {
            cleaned = `/api${cleaned}`;
          } else if (cleaned.includes('chamcongdh.io.vn/uploads/')) {
            cleaned = cleaned.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/uploads/');
          }
          ret.anh_dai_dien = cleaned;
          ret.avatar = cleaned;
        }
        return ret;
      },
    },
  }
);

userSchema.aliases = {
  fullName: 'ho_ten',
  staffCode: 'ma_can_bo',
  phoneNumber: 'so_dien_thoai',
  academicRank: 'hoc_ham',
  degree: 'hoc_vi',
  salaryScale: 'ngach_luong',
  salaryCoefficient: 'he_so_luong',
  dependentsCount: 'so_nguoi_phu_thuoc',
  teachingStartDate: 'ngay_bat_dau_giang_day',
  encryptedCccd: 'so_cccd_ma_hoa',
  cccdKeyVersion: 'phien_ban_khoa_cccd',
  gender: 'gioi_tinh',
  position: 'chuc_vu',
  staffType: 'loai_nhan_su',
  contractType: 'loai_hop_dong',
  dateOfBirth: 'ngay_sinh',
  startDate: 'ngay_vao_lam',
  address: 'dia_chi',
  passwordHash: 'mat_khau_ma_hoa',
  primaryRole: 'vai_tro_chinh',
  roles: 'danh_sach_vai_tro',
  departmentId: 'don_vi_chinh_id',
  avatar: 'anh_dai_dien',
  isActive: 'kich_hoat',
  employmentStatus: 'trang_thai_lam_viec',
  annualLeaveQuota: 'han_muc_phep_nam',
  leaveVersion: 'phien_ban_don_nghi',
  tokenVersion: 'phien_ban_token',
  biometricConsentDate: 'ngay_dong_y_sinh_trac',
  isVerified: 'da_xac_thuc',
  passwordChangedAt: 'doi_mat_khau_luc',
  otpCode: 'ma_otp',
  otpExpiresAt: 'otp_het_han_luc',
  otpType: 'loai_otp',
  otpAttempts: 'so_lan_thu_otp',
  otpSentAt: 'otp_gui_luc',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

userSchema.virtual('academicTitle').get(function () {
  const parts = [];
  if (this.hoc_ham && this.hoc_ham !== 'KHONG') parts.push(this.hoc_ham);
  if (this.hoc_vi) parts.push(this.hoc_vi);
  return parts.join(' ');
});

userSchema.virtual('identityCard')
  .get(function () {
    return this._raw_so_cccd || this.so_cccd_ma_hoa;
  })
  .set(function (v) {
    this._raw_so_cccd = v;
    this.so_cccd_ma_hoa = v;
  });

// Getter/Setter ảo cho `role` / `vai_tro` tương thích ngược 100% với middleware và UI cũ:
userSchema.virtual('role')
  .get(function () {
    if (this.danh_sach_vai_tro && this.danh_sach_vai_tro.length > 0) {
      const now = new Date();
      // Tìm vai trò còn hiệu lực (den_ngay === null hoặc den_ngay >= now)
      const activeRole = this.danh_sach_vai_tro.find(r => !r.den_ngay || new Date(r.den_ngay) >= now);
      if (activeRole) {
        const map = {
          ADMIN: 'admin',
          BGH: 'admin',
          TRUONG_KHOA: 'truongkhoa',
          PHO_TRUONG_KHOA: 'truongkhoa',
          TRUONG_BO_MON: 'truongkhoa',
          PHO_TRUONG_BO_MON: 'truongkhoa',
          TRUONG_PHONG: 'truongkhoa',
          PHO_TRUONG_PHONG: 'truongkhoa',
          GIANG_VIEN: 'giangvien',
          CHUYEN_VIEN: 'nhanvien',
        };
        return map[activeRole.ma_vai_tro] || activeRole.ma_vai_tro.toLowerCase();
      }
    }
    return this.vai_tro_chinh || 'giangvien';
  })
  .set(function (val) {
    this.vai_tro_chinh = val;
  });

userSchema.virtual('vai_tro')
  .get(function () {
    return this.role;
  })
  .set(function (val) {
    this.role = val;
  });


userSchema.virtual('departmentId')
  .get(function () { return this.don_vi_chinh_id; })
  .set(function (v) { this.don_vi_chinh_id = v; });

const { hasPermission, getEffectivePermissions } = require('../config/permissions');

userSchema.methods.hasPermission = function (permission) {
  return hasPermission(this, permission);
};

userSchema.methods.getPermissions = function () {
  return Array.from(getEffectivePermissions(this));
};

userSchema.methods.revokeAllSessions = async function () {
  this.phien_ban_token = (this.phien_ban_token || 1) + 1;
  return this.save();
};

userSchema.plugin(schemaAliasPlugin);

userSchema.pre('validate', function () {
  if (this.han_muc_phep_nam !== undefined && this.han_muc_phep_nam !== null && !Number.isInteger(this.han_muc_phep_nam)) {
    this.invalidate('annualLeaveQuota', 'Hạn mức ngày phép phải là số nguyên');
  }
  const cccd = this._raw_so_cccd || this.identityCard || this.so_cccd_ma_hoa;
  if (cccd && !/^(\d{9}|\d{12})$/.test(cccd)) {
    this.invalidate('identityCard', 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số');
  }
  if (this.ma_can_bo && !/^[A-Z0-9][A-Z0-9_-]*$/.test(this.ma_can_bo)) {
    this.invalidate('staffCode', 'Mã cán bộ chỉ được chứa chữ in hoa, số, dấu gạch ngang hoặc gạch dưới');
    this.invalidate('ma_can_bo', 'Mã cán bộ chỉ được chứa chữ in hoa, số, dấu gạch ngang hoặc gạch dưới');
  }
});

userSchema.index(
  { ma_can_bo: 1 },
  { unique: true, partialFilterExpression: { ma_can_bo: { $type: 'string' } } }
);
userSchema.index(
  { so_cccd_ma_hoa: 1 },
  { unique: true, partialFilterExpression: { so_cccd_ma_hoa: { $type: 'string' } } }
);
userSchema.index({ trang_thai_lam_viec: 1 });
userSchema.index({ don_vi_chinh_id: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema, 'nguoi_dung');

if (!mongoose.models.NguoiDung) {
  mongoose.model('NguoiDung', userSchema, 'nguoi_dung');
}

module.exports = User;
