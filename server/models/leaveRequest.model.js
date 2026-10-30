const mongoose = require('mongoose');
require('./user.model');
require('./schedule.model');

const leaveRequestSchema = new mongoose.Schema(
  {
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Người gửi đơn (userId / nguoi_dung_id) là bắt buộc'],
    },
    loai_don: {
      type: String,
      alias: 'type',
      enum: {
        values: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng'],
        message: 'Loại đơn không hợp lệ ({VALUE}).',
      },
      required: [true, 'Loại đơn là bắt buộc'],
    },
    ly_do: {
      type: String,
      alias: 'reason',
      required: [true, 'Lý do xin nghỉ/đổi ca là bắt buộc'],
      trim: true,
      minlength: [5, 'Lý do phải có ít nhất 5 ký tự'],
      maxlength: [500, 'Lý do không được vượt quá 500 ký tự'],
    },
    ngay_bat_dau: {
      type: Date,
      alias: 'startDate',
      required: [true, 'Ngày bắt đầu áp dụng là bắt buộc'],
    },
    ngay_ket_thuc: {
      type: Date,
      alias: 'endDate',
      required: [true, 'Ngày kết thúc áp dụng là bắt buộc'],
    },
    so_ngay: {
      type: Number,
      alias: 'totalDays',
      default: 1,
      min: [0.5, 'Số ngày nghỉ tối thiểu là 0.5 ngày'],
    },
    lich_trinh_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'scheduleId',
      ref: 'Schedule',
      default: null,
    },
    ngay_day_bu: {
      type: Date,
      alias: 'makeupDate',
      default: null,
    },
    tep_dinh_kem: {
      type: String,
      alias: 'attachmentUrl',
      default: null,
      trim: true,
    },
    trang_thai: {
      type: String,
      alias: 'status',
      enum: ['pending', 'pending_dean', 'pending_bgh', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      required: true,
      set: (v) => v ? String(v).toLowerCase() : v,
    },
    so_cap_duyet: {
      type: Number,
      alias: 'requiredLevels',
      default: 1,
      min: 1,
      max: 2,
    },
    cap_duyet_hien_tai: {
      type: Number,
      alias: 'currentLevel',
      default: 1,
      min: 1,
      max: 2,
    },
    phien_ban: {
      type: Number,
      alias: 'version',
      default: 1,
      min: 1,
    },
    lich_su_duyet: [
      {
        cap: { type: Number, required: true },
        nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        vai_tro: { type: String, default: '' },
        hanh_dong: { type: String, enum: ['approved', 'rejected'], required: true, set: (v) => v ? String(v).toLowerCase() : v },
        ghi_chu: { type: String, default: '' },
        thoi_gian: { type: Date, default: Date.now },
      },
    ],
    nguoi_duyet_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'approvedBy',
      ref: 'User',
      default: null,
    },
    ghi_chu_duyet: {
      type: String,
      alias: 'approvalNote',
      default: '',
      trim: true,
      maxlength: [500, 'Ghi chú duyệt không được vượt quá 500 ký tự'],
    },
    ly_do_tu_choi: {
      type: String,
      alias: 'rejectionReason',
      default: null,
      trim: true,
      maxlength: [500, 'Lý do từ chối không được vượt quá 500 ký tự'],
      validate: {
        validator: function (val) {
          if (this.trang_thai === 'rejected' && (!val || !val.trim())) return false;
          return true;
        },
        message: 'Lý do từ chối là bắt buộc khi đơn bị từ chối (REJECTED)',
      },
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'don_nghi_phep',
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (typeof ret.tep_dinh_kem === 'string') {
          let cleaned = ret.tep_dinh_kem.trim();
          if (cleaned.includes('undefined') || cleaned.includes('null') || !cleaned) {
            ret.tep_dinh_kem = null;
            ret.attachmentUrl = null;
            return ret;
          }
          if (cleaned.startsWith('http://chamcongdh.io.vn')) {
            cleaned = cleaned.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
          }
          if (cleaned.startsWith('/uploads/')) {
            cleaned = `/api${cleaned}`;
          } else if (cleaned.includes('chamcongdh.io.vn/uploads/')) {
            cleaned = cleaned.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/uploads/');
          }
          ret.tep_dinh_kem = cleaned;
          ret.attachmentUrl = cleaned;
        }
        if (ret.so_ngay !== undefined) {
          ret.totalDays = ret.so_ngay;
        }
        if (Array.isArray(ret.lich_su_duyet)) {
          ret.lich_su_duyet = ret.lich_su_duyet.map((item) => {
            const approver = item.nguoi_duyet_id || item.nguoi_duyet;
            return {
              ...item,
              nguoi_duyet: approver,
              nguoi_duyet_id: approver?._id || approver,
            };
          });
          ret.approvalHistory = ret.lich_su_duyet;
        }
        if (ret.nguoi_duyet_id !== undefined && !ret.approvedBy) {
          ret.approvedBy = ret.nguoi_duyet_id;
        }
        if (ret.ly_do_tu_choi !== undefined && !ret.rejectionReason) {
          ret.rejectionReason = ret.ly_do_tu_choi;
        }
        if (ret.ghi_chu_duyet !== undefined && !ret.approvalNote) {
          ret.approvalNote = ret.ghi_chu_duyet;
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (typeof ret.tep_dinh_kem === 'string') {
          let cleaned = ret.tep_dinh_kem.trim();
          if (cleaned.includes('undefined') || cleaned.includes('null') || !cleaned) {
            ret.tep_dinh_kem = null;
            ret.attachmentUrl = null;
            return ret;
          }
          if (cleaned.startsWith('http://chamcongdh.io.vn')) {
            cleaned = cleaned.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
          }
          if (cleaned.startsWith('/uploads/')) {
            cleaned = `/api${cleaned}`;
          } else if (cleaned.includes('chamcongdh.io.vn/uploads/')) {
            cleaned = cleaned.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/uploads/');
          }
          ret.tep_dinh_kem = cleaned;
          ret.attachmentUrl = cleaned;
        }
        if (ret.so_ngay !== undefined) {
          ret.totalDays = ret.so_ngay;
        }
        if (Array.isArray(ret.lich_su_duyet)) {
          ret.lich_su_duyet = ret.lich_su_duyet.map((item) => {
            const approver = item.nguoi_duyet_id || item.nguoi_duyet;
            return {
              ...item,
              nguoi_duyet: approver,
              nguoi_duyet_id: approver?._id || approver,
            };
          });
          ret.approvalHistory = ret.lich_su_duyet;
        }
        if (ret.nguoi_duyet_id !== undefined && !ret.approvedBy) {
          ret.approvedBy = ret.nguoi_duyet_id;
        }
        if (ret.ly_do_tu_choi !== undefined && !ret.rejectionReason) {
          ret.rejectionReason = ret.ly_do_tu_choi;
        }
        if (ret.ghi_chu_duyet !== undefined && !ret.approvalNote) {
          ret.approvalNote = ret.ghi_chu_duyet;
        }
        return ret;
      },
    },
  }
);

leaveRequestSchema.aliases = {
  userId: 'nguoi_dung_id',
  type: 'loai_don',
  reason: 'ly_do',
  startDate: 'ngay_bat_dau',
  endDate: 'ngay_ket_thuc',
  totalDays: 'so_ngay',
  scheduleId: 'lich_trinh_id',
  makeupDate: 'ngay_day_bu',
  attachmentUrl: 'tep_dinh_kem',
  status: 'trang_thai',
  approvedBy: 'nguoi_duyet_id',
  approvalNote: 'ghi_chu_duyet',
  rejectionReason: 'ly_do_tu_choi',
  version: 'phien_ban',
  requiredLevels: 'so_cap_duyet',
  currentLevel: 'cap_duyet_hien_tai',
  approvalHistory: 'lich_su_duyet',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

leaveRequestSchema.virtual('approvalHistory')
  .get(function () { return this.lich_su_duyet; })
  .set(function (val) { this.lich_su_duyet = val; });

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
leaveRequestSchema.plugin(schemaAliasPlugin);

leaveRequestSchema.pre('validate', function () {
  const start = this.ngay_bat_dau;
  const end = this.ngay_ket_thuc;
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    this.invalidate('ngay_ket_thuc', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
  }
});

leaveRequestSchema.index({ nguoi_dung_id: 1, ngay_bat_dau: -1 });
leaveRequestSchema.index({ trang_thai: 1, ngay_bat_dau: -1 });
leaveRequestSchema.index({ lich_trinh_id: 1 }, { sparse: true });

const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema, 'don_nghi_phep');

module.exports = LeaveRequest;
