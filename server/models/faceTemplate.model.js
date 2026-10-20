const mongoose = require('mongoose');
require('./user.model');

const VALID_FACE_DIMENSIONS = new Set([512]);

const faceTemplateSchema = new mongoose.Schema(
  {
    nguoi_dung_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      required: [true, 'Người sở hữu mẫu khuôn mặt là bắt buộc'],
      unique: true,
    },
    vector_dac_trung: {
      type: [[Number]],
      alias: 'descriptors',
      required: [true, 'Mẫu khuôn mặt là bắt buộc'],
      select: false,
      validate: {
        validator: (descriptors) =>
          Array.isArray(descriptors) &&
          descriptors.length > 0 &&
          descriptors.every(
            (descriptor) =>
              Array.isArray(descriptor) &&
              VALID_FACE_DIMENSIONS.has(descriptor.length) &&
              descriptor.length === descriptors[0].length &&
              descriptor.every((value) => Number.isFinite(value))
          ),
        message: 'Mỗi mẫu khuôn mặt phải chứa đúng 512 số hữu hạn (InsightFace buffalo_s / buffalo_l)',
      },
    },
    vector_trung_binh: {
      type: [Number],
      alias: 'averageDescriptor',
      select: false,
      default: [],
      validate: {
        validator: (vector) =>
          !vector ||
          vector.length === 0 ||
          (Array.isArray(vector) &&
            VALID_FACE_DIMENSIONS.has(vector.length) &&
            vector.every((value) => Number.isFinite(value))),
        message: 'Vector trung bình phải chứa đúng 512 số hữu hạn chuẩn hóa L2',
      },
    },
    so_chieu_vector: {
      type: Number,
      alias: 'embeddingDimensions',
      enum: [512],
      default: 512,
    },
    mo_hinh_ai: {
      type: String,
      alias: 'embeddingModel',
      enum: ['buffalo_s', 'buffalo_l', 'insightface-buffalo_l'],
      default: 'buffalo_s',
    },
    cac_goc_chup: {
      type: [String],
      alias: 'sampleAngles',
      default: ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'],
    },
    so_luong_mau: {
      type: Number,
      alias: 'sampleCount',
      default: 1,
    },
    nguoi_dang_ky_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'registeredBy',
      ref: 'User',
      default: null,
    },
    ngay_dang_ky: {
      type: Date,
      alias: 'registeredAt',
      required: true,
      default: Date.now,
    },
    dieu_khoan_dong_y: {
      type: Boolean,
      alias: 'consentAgreed',
      default: true,
    },
    thoi_diem_dong_y: {
      type: Date,
      alias: 'consentAgreedAt',
      default: Date.now,
    },
    phien_ban_chinh_sach: {
      type: String,
      alias: 'policyVersion',
      default: 'ND13-2023-V1.0',
    },
    ip_dong_y: {
      type: String,
      alias: 'consentIp',
      default: null,
    },
    trang_thai_ma_hoa: {
      type: String,
      alias: 'encryptionStatus',
      enum: ['PLAINTEXT', 'AES_256_GCM'],
      default: 'AES_256_GCM',
    },
    du_lieu_ma_hoa: {
      type: String,
      alias: 'encryptedData',
      select: false,
      default: null,
    },
    vector_trung_binh_ma_hoa: {
      type: String,
      alias: 'encryptedAverageDescriptor',
      select: false,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' },
    collection: 'mau_khuon_mat',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

faceTemplateSchema.aliases = {
  // Alias chuẩn theo định nghĩa Schema
  userId: 'nguoi_dung_id',
  descriptors: 'vector_dac_trung',
  averageDescriptor: 'vector_trung_binh',
  embeddingDimensions: 'so_chieu_vector',
  embeddingModel: 'mo_hinh_ai',
  sampleAngles: 'cac_goc_chup',
  sampleCount: 'so_luong_mau',
  registeredBy: 'nguoi_dang_ky_id',
  registeredAt: 'ngay_dang_ky',
  consentAgreed: 'dieu_khoan_dong_y',
  consentAgreedAt: 'thoi_diem_dong_y',
  policyVersion: 'phien_ban_chinh_sach',
  consentIp: 'ip_dong_y',
  encryptionStatus: 'trang_thai_ma_hoa',
  encryptedData: 'du_lieu_ma_hoa',
  encryptedAverageDescriptor: 'vector_trung_binh_ma_hoa',
  createdAt: 'tao_luc',
  updatedAt: 'cap_nhat_luc',

  // Alias tương thích ngược cho các service AI & Controller (FaceServiceClient, WebSocket, FaceController)
  faceDescriptors: 'vector_dac_trung',
  averageEmbedding: 'vector_trung_binh',
  poses: 'cac_goc_chup',
};



const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
const { encryptBiometricVector, decryptBiometricVector } = require('../utils/biometricEncryption');
faceTemplateSchema.plugin(schemaAliasPlugin);

// Tự động mã hóa vector sinh trắc học khi lưu vào cơ sở dữ liệu
faceTemplateSchema.pre('save', function () {
  if (this.vector_dac_trung && Array.isArray(this.vector_dac_trung)) {
    this.du_lieu_ma_hoa = encryptBiometricVector(this.vector_dac_trung);
  }
  if (this.vector_trung_binh && Array.isArray(this.vector_trung_binh)) {
    this.vector_trung_binh_ma_hoa = encryptBiometricVector(this.vector_trung_binh);
  }
  this.trang_thai_ma_hoa = 'AES_256_GCM';
});

faceTemplateSchema.methods.getDecryptedDescriptors = function () {
  if (this.du_lieu_ma_hoa) {
    return decryptBiometricVector(this.du_lieu_ma_hoa);
  }
  return this.vector_dac_trung;
};

faceTemplateSchema.methods.getDecryptedAverageDescriptor = function () {
  if (this.vector_trung_binh_ma_hoa) {
    return decryptBiometricVector(this.vector_trung_binh_ma_hoa);
  }
  return this.vector_trung_binh;
};

faceTemplateSchema.pre('validate', function () {
  const desc = this.vector_dac_trung;
  if (!desc || !Array.isArray(desc) || desc.length === 0 || !desc.every(d => Array.isArray(d) && d.length === 512 && d.every(v => Number.isFinite(v)))) {
    this.invalidate('descriptors', 'Mỗi mẫu khuôn mặt phải chứa đúng 512 số hữu hạn (InsightFace buffalo_s / buffalo_l)');
    this.invalidate('vector_dac_trung', 'Mỗi mẫu khuôn mặt phải chứa đúng 512 số hữu hạn (InsightFace buffalo_s / buffalo_l)');
  }
  const validModels = ['buffalo_s', 'buffalo_l', 'insightface-buffalo_l'];
  if (this.mo_hinh_ai && !validModels.includes(this.mo_hinh_ai)) {
    this.invalidate('embeddingModel', 'Mô hình AI chỉ chấp nhận buffalo_s, buffalo_l hoặc insightface-buffalo_l');
    this.invalidate('mo_hinh_ai', 'Mô hình AI chỉ chấp nhận buffalo_s, buffalo_l hoặc insightface-buffalo_l');
  }

  // Tự động tính vector trung bình chuẩn hóa L2 nếu chưa có
  if (Array.isArray(desc) && desc.length > 0 && (!this.vector_trung_binh || this.vector_trung_binh.length === 0)) {
    const dim = 512;
    const centroid = new Array(dim).fill(0);
    for (const d of desc) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += d[i];
      }
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += centroid[i] * centroid[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) {
        centroid[i] /= norm;
      }
    }
    this.vector_trung_binh = centroid;
  }
});


const FaceTemplate = mongoose.models.FaceTemplate || mongoose.model('FaceTemplate', faceTemplateSchema, 'mau_khuon_mat');

if (!mongoose.models.MauKhuonMat) {
  mongoose.model('MauKhuonMat', faceTemplateSchema, 'mau_khuon_mat');
}

module.exports = FaceTemplate;
