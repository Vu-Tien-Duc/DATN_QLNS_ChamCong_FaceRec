/**
 * Model Quản lý Bảng Lương & Phiếu Lương (Payroll)
 * Collection vật lý: phieu_luong
 * Dual-Standard: Tiếng Việt gốc trong CSDL + Alias tiếng Anh trong mã nguồn
 */
const mongoose = require('mongoose');

const phuCapItemSchema = new mongoose.Schema(
  {
    loai_phu_cap: { type: String, trim: true, alias: 'type' },
    he_so_hoac_ty_le: { type: Number, default: 0, alias: 'rate' },
    so_tien: { type: Number, default: 0, alias: 'amount' },
  },
  { _id: false }
);

const khoanDieuChinhSchema = new mongoose.Schema(
  {
    ly_do: { type: String, trim: true, alias: 'reason' },
    so_tien: { type: Number, default: 0, alias: 'amount' },
  },
  { _id: false }
);

const bieuThueBacSchema = new mongoose.Schema(
  {
    bac: { type: Number, alias: 'level' },
    tu: { type: Number, alias: 'from' },
    den: { type: Number, alias: 'to' },
    thue_suat: { type: Number, alias: 'taxRate' },
  },
  { _id: false }
);

const phieuLuongSchema = new mongoose.Schema(
  {
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Nhân viên nhận lương (nguoi_dung_id / userId) là bắt buộc'],
    },
    thang: {
      type: Number,
      alias: 'month',
      required: [true, 'Tháng tính lương là bắt buộc'],
      min: [1, 'Tháng phải từ 1 đến 12'],
      max: [12, 'Tháng phải từ 1 đến 12'],
    },
    nam: {
      type: Number,
      alias: 'year',
      required: [true, 'Năm tính lương là bắt buộc'],
      min: [2000, 'Năm không hợp lệ'],
    },
    nguoi_lap_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'createdBy',
      ref: 'User',
      required: [true, 'Người lập bảng lương là bắt buộc'],
    },
    nguoi_duyet_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'approvedBy',
      ref: 'User',
      default: null,
    },

    he_so_luong: {
      type: Number,
      alias: 'salaryCoefficient',
      required: [true, 'Hệ số lương là bắt buộc'],
      min: [0, 'Hệ số lương không thể âm'],
    },
    luong_co_so: {
      type: Number,
      alias: 'baseSalary',
      required: [true, 'Lương cơ sở là bắt buộc'],
      min: [0, 'Lương cơ sở không thể âm'],
    },
    luong_chinh: {
      type: Number,
      alias: 'primarySalary',
      required: [true, 'Lương chính là bắt buộc'],
      min: [0, 'Lương chính không thể âm'],
    },
    phu_cap_chuc_vu: {
      type: Number,
      alias: 'positionAllowance',
      default: 0,
    },
    phu_cap_tham_nien: {
      type: Number,
      alias: 'seniorityAllowance',
      default: 0,
    },
    phu_cap_uu_dai_nghe: {
      type: Number,
      alias: 'vocationalAllowance',
      default: 0,
    },
    phu_cap: [phuCapItemSchema],
    khoan_thuong: [khoanDieuChinhSchema],
    khau_tru: [khoanDieuChinhSchema],

    gio_giang: {
      dinh_muc_goc: { type: Number, default: 135, alias: 'baseQuota' },
      ty_le_giam_dinh_muc: { type: Number, default: 0, alias: 'reductionRatio' },
      dinh_muc_sau_giam: { type: Number, default: 135, alias: 'adjustedQuota' },
      gio_quy_doi_tich_luy: { type: Number, default: 0, alias: 'accumulatedStandardHours' },
      gio_vuot_dinh_muc: { type: Number, default: 0, alias: 'overQuotaHours' },
      don_gia_gio_chuan: { type: Number, default: 120000, alias: 'hourlyRate' },
      thu_lao_vuot_gio: { type: Number, default: 0, alias: 'overQuotaRemuneration' },
      da_tam_ung: { type: Number, default: 0, alias: 'advancedPayment' },
    },

    tong_thu_nhap_gross: {
      type: Number,
      alias: 'grossIncome',
      required: [true, 'Tổng thu nhập gross là bắt buộc'],
    },
    bao_hiem: {
      bhxh: { type: Number, default: 0, alias: 'socialInsurance' },
      bhyt: { type: Number, default: 0, alias: 'healthInsurance' },
      bhtn: { type: Number, default: 0, alias: 'unemploymentInsurance' },
      tong_bao_hiem: { type: Number, default: 0, alias: 'totalInsurance' },
    },
    thue_tncn: {
      giam_tru_ban_than: { type: Number, default: 11000000, alias: 'personalDeduction' },
      giam_tru_phu_thuoc: { type: Number, default: 0, alias: 'dependentDeduction' },
      thu_nhap_tinh_thue: { type: Number, default: 0, alias: 'taxableIncome' },
      tien_thue: { type: Number, default: 0, alias: 'taxAmount' },
    },
    thuc_linh_net: {
      type: Number,
      alias: 'netSalary',
      required: [true, 'Thực lĩnh net là bắt buộc'],
    },

    snapshot_tham_so: {
      luong_co_so: { type: Number, alias: 'baseSalarySnapshot' },
      giam_tru_ban_than: { type: Number, alias: 'personalDeductionSnapshot' },
      giam_tru_phu_thuoc: { type: Number, alias: 'dependentDeductionSnapshot' },
      ty_le_bhxh: { type: Number, alias: 'socialInsuranceRatioSnapshot' },
      ty_le_bhyt: { type: Number, alias: 'healthInsuranceRatioSnapshot' },
      ty_le_bhtn: { type: Number, alias: 'unemploymentInsuranceRatioSnapshot' },
      bieu_thue_5_bac: { type: [bieuThueBacSchema], alias: 'taxBracketsSnapshot' },
    },

    trang_thai: {
      type: String,
      alias: 'status',
      enum: ['du_thao', 'cho_duyet', 'da_duyet', 'da_khoa', 'da_thanh_toan'],
      default: 'du_thao',
      set: (v) => v ? String(v).toLowerCase() : v,
    },
    khoa_luc: {
      type: Date,
      alias: 'lockedAt',
      default: null,
    },
  },
  {
    collection: 'phieu_luong',
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


phieuLuongSchema.virtual('isLocked').get(function () {
  return this.trang_thai === 'da_khoa' || Boolean(this.khoa_luc);
});

phieuLuongSchema.virtual('allowances')
  .get(function () { return this.phu_cap; })
  .set(function (v) { this.phu_cap = v; });

phieuLuongSchema.virtual('bonusItems')
  .get(function () { return this.khoan_thuong; })
  .set(function (v) { this.khoan_thuong = v; });

phieuLuongSchema.virtual('deductionItems')
  .get(function () { return this.khau_tru; })
  .set(function (v) { this.khau_tru = v; });

phieuLuongSchema.virtual('teachingHours')
  .get(function () { return this.gio_giang; })
  .set(function (v) {
    if (!v) return;
    this.gio_giang = this.gio_giang || {};
    if (v.baseQuota !== undefined) this.gio_giang.dinh_muc_goc = v.baseQuota;
    if (v.dinh_muc_goc !== undefined) this.gio_giang.dinh_muc_goc = v.dinh_muc_goc;
    if (v.reductionRatio !== undefined) this.gio_giang.ty_le_giam_dinh_muc = v.reductionRatio;
    if (v.ty_le_giam_dinh_muc !== undefined) this.gio_giang.ty_le_giam_dinh_muc = v.ty_le_giam_dinh_muc;
    if (v.adjustedQuota !== undefined) this.gio_giang.dinh_muc_sau_giam = v.adjustedQuota;
    if (v.dinh_muc_sau_giam !== undefined) this.gio_giang.dinh_muc_sau_giam = v.dinh_muc_sau_giam;
    if (v.accumulatedStandardHours !== undefined) this.gio_giang.gio_quy_doi_tich_luy = v.accumulatedStandardHours;
    if (v.gio_quy_doi_tich_luy !== undefined) this.gio_giang.gio_quy_doi_tich_luy = v.gio_quy_doi_tich_luy;
    if (v.overQuotaHours !== undefined) this.gio_giang.gio_vuot_dinh_muc = v.overQuotaHours;
    if (v.gio_vuot_dinh_muc !== undefined) this.gio_giang.gio_vuot_dinh_muc = v.gio_vuot_dinh_muc;
    if (v.hourlyRate !== undefined) this.gio_giang.don_gia_gio_chuan = v.hourlyRate;
    if (v.don_gia_gio_chuan !== undefined) this.gio_giang.don_gia_gio_chuan = v.don_gia_gio_chuan;
    if (v.overQuotaRemuneration !== undefined) this.gio_giang.thu_lao_vuot_gio = v.overQuotaRemuneration;
    if (v.thu_lao_vuot_gio !== undefined) this.gio_giang.thu_lao_vuot_gio = v.thu_lao_vuot_gio;
    if (v.advancedPayment !== undefined) this.gio_giang.da_tam_ung = v.advancedPayment;
    if (v.da_tam_ung !== undefined) this.gio_giang.da_tam_ung = v.da_tam_ung;
  });

phieuLuongSchema.virtual('insurance')
  .get(function () {
    if (!this.bao_hiem) return null;
    const b = this.bao_hiem;
    return {
      socialInsurance: b.bhxh ?? 0,
      healthInsurance: b.bhyt ?? 0,
      unemploymentInsurance: b.bhtn ?? 0,
      totalInsurance: b.tong_bao_hiem ?? 0,
      bhxh: b.bhxh ?? 0,
      bhyt: b.bhyt ?? 0,
      bhtn: b.bhtn ?? 0,
      tong_bao_hiem: b.tong_bao_hiem ?? 0,
    };
  })
  .set(function (v) {
    if (!v) return;
    this.bao_hiem = this.bao_hiem || {};
    if (v.socialInsurance !== undefined) this.bao_hiem.bhxh = v.socialInsurance;
    if (v.bhxh !== undefined) this.bao_hiem.bhxh = v.bhxh;
    if (v.healthInsurance !== undefined) this.bao_hiem.bhyt = v.healthInsurance;
    if (v.bhyt !== undefined) this.bao_hiem.bhyt = v.bhyt;
    if (v.unemploymentInsurance !== undefined) this.bao_hiem.bhtn = v.unemploymentInsurance;
    if (v.bhtn !== undefined) this.bao_hiem.bhtn = v.bhtn;
    if (v.totalInsurance !== undefined) this.bao_hiem.tong_bao_hiem = v.totalInsurance;
    if (v.tong_bao_hiem !== undefined) this.bao_hiem.tong_bao_hiem = v.tong_bao_hiem;
  });

phieuLuongSchema.virtual('personalIncomeTax')
  .get(function () {
    if (!this.thue_tncn) return null;
    const t = this.thue_tncn;
    return {
      personalDeduction: t.giam_tru_ban_than ?? 0,
      dependentDeduction: t.giam_tru_phu_thuoc ?? 0,
      taxableIncome: t.thu_nhap_tinh_thue ?? 0,
      taxAmount: t.tien_thue ?? 0,
      giam_tru_ban_than: t.giam_tru_ban_than ?? 0,
      giam_tru_phu_thuoc: t.giam_tru_phu_thuoc ?? 0,
      thu_nhap_tinh_thue: t.thu_nhap_tinh_thue ?? 0,
      tien_thue: t.tien_thue ?? 0,
    };
  })
  .set(function (v) {
    if (!v) return;
    this.thue_tncn = this.thue_tncn || {};
    if (v.personalDeduction !== undefined) this.thue_tncn.giam_tru_ban_than = v.personalDeduction;
    if (v.giam_tru_ban_than !== undefined) this.thue_tncn.giam_tru_ban_than = v.giam_tru_ban_than;
    if (v.dependentDeduction !== undefined) this.thue_tncn.giam_tru_phu_thuoc = v.dependentDeduction;
    if (v.giam_tru_phu_thuoc !== undefined) this.thue_tncn.giam_tru_phu_thuoc = v.giam_tru_phu_thuoc;
    if (v.taxableIncome !== undefined) this.thue_tncn.thu_nhap_tinh_thue = v.taxableIncome;
    if (v.thu_nhap_tinh_thue !== undefined) this.thue_tncn.thu_nhap_tinh_thue = v.thu_nhap_tinh_thue;
    if (v.taxAmount !== undefined) this.thue_tncn.tien_thue = v.taxAmount;
    if (v.tien_thue !== undefined) this.thue_tncn.tien_thue = v.tien_thue;
  });

phieuLuongSchema.virtual('parameterSnapshot')
  .get(function () { return this.snapshot_tham_so; })
  .set(function (v) { this.snapshot_tham_so = v; });

phieuLuongSchema.aliases = {
  userId: 'nguoi_dung_id',
  month: 'thang',
  year: 'nam',
  createdBy: 'nguoi_lap_id',
  approvedBy: 'nguoi_duyet_id',
  salaryCoefficient: 'he_so_luong',
  baseSalary: 'luong_co_so',
  primarySalary: 'luong_chinh',
  positionAllowance: 'phu_cap_chuc_vu',
  seniorityAllowance: 'phu_cap_tham_nien',
  vocationalAllowance: 'phu_cap_uu_dai_nghe',
  allowances: 'phu_cap',
  bonusItems: 'khoan_thuong',
  deductionItems: 'khau_tru',
  teachingHours: 'gio_giang',
  baseQuota: 'gio_giang.dinh_muc_goc',
  reductionRatio: 'gio_giang.ty_le_giam_dinh_muc',
  adjustedQuota: 'gio_giang.dinh_muc_sau_giam',
  accumulatedStandardHours: 'gio_giang.gio_quy_doi_tich_luy',
  overQuotaHours: 'gio_giang.gio_vuot_dinh_muc',
  hourlyRate: 'gio_giang.don_gia_gio_chuan',
  overQuotaRemuneration: 'gio_giang.thu_lao_vuot_gio',
  advancedPayment: 'gio_giang.da_tam_ung',
  grossIncome: 'tong_thu_nhap_gross',
  insurance: 'bao_hiem',
  socialInsurance: 'bao_hiem.bhxh',
  healthInsurance: 'bao_hiem.bhyt',
  unemploymentInsurance: 'bao_hiem.bhtn',
  totalInsurance: 'bao_hiem.tong_bao_hiem',
  personalIncomeTax: 'thue_tncn',
  personalDeduction: 'thue_tncn.giam_tru_ban_than',
  dependentDeduction: 'thue_tncn.giam_tru_phu_thuoc',
  taxableIncome: 'thue_tncn.thu_nhap_tinh_thue',
  taxAmount: 'thue_tncn.tien_thue',
  netSalary: 'thuc_linh_net',
  parameterSnapshot: 'snapshot_tham_so',
  baseSalarySnapshot: 'snapshot_tham_so.luong_co_so',
  personalDeductionSnapshot: 'snapshot_tham_so.giam_tru_ban_than',
  dependentDeductionSnapshot: 'snapshot_tham_so.giam_tru_phu_thuoc',
  socialInsuranceRatioSnapshot: 'snapshot_tham_so.ty_le_bhxh',
  healthInsuranceRatioSnapshot: 'snapshot_tham_so.ty_le_bhyt',
  unemploymentInsuranceRatioSnapshot: 'snapshot_tham_so.ty_le_bhtn',
  taxBracketsSnapshot: 'snapshot_tham_so.bieu_thue_5_bac',
  status: 'trang_thai',
  lockedAt: 'khoa_luc',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',
};

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
phieuLuongSchema.plugin(schemaAliasPlugin);

// Unique index: Mỗi nhân sự chỉ có 1 phiếu lương duy nhất trong mỗi tháng/năm
phieuLuongSchema.index({ nguoi_dung_id: 1, thang: 1, nam: 1 }, { unique: true });
phieuLuongSchema.index({ thang: 1, nam: 1, trang_thai: 1 });
phieuLuongSchema.index({ nguoi_dung_id: 1, trang_thai: 1 });

const Payroll = mongoose.models.Payroll || mongoose.model('Payroll', phieuLuongSchema, 'phieu_luong');

module.exports = Payroll;
