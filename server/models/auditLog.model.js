const mongoose = require('mongoose');
const crypto = require('crypto');

const GENESIS_HASH = '0'.repeat(64);

/**
 * Tính mã băm SHA-256 chuẩn hóa cho bản ghi nhật ký kiểm toán
 */
const computeLogHash = (doc, previousHash) => {
  const prev = previousHash !== undefined ? previousHash : (doc.ma_bam_truoc || GENESIS_HASH);
  const timeStr = doc.thoi_diem ? new Date(doc.thoi_diem).toISOString() : new Date().toISOString();
  const actor = doc.nguoi_thuc_hien_id || doc.actor || doc.actorId || doc.userId;
  const actorStr = actor ? String(actor) : '';
  const actorTypeStr = doc.loai_chu_the || doc.actorType || 'USER';
  const actionStr = doc.hanh_dong || doc.action || '';
  const targetTypeStr = doc.loai_doi_tuong || doc.targetType || '';
  const targetId = doc.doi_tuong_id || doc.targetId;
  const targetIdStr = targetId ? String(targetId) : '';
  const statusStr = doc.ket_qua || doc.status || 'SUCCESS';
  const detailsStr = doc.chi_tiet || doc.details ? JSON.stringify(doc.chi_tiet || doc.details) : '';

  const rawString = [
    prev,
    timeStr,
    actorStr,
    actorTypeStr,
    actionStr,
    targetTypeStr,
    targetIdStr,
    statusStr,
    detailsStr,
  ].join('|');

  return crypto.createHash('sha256').update(rawString).digest('hex');
};

const auditLogSchema = new mongoose.Schema(
  {
    nguoi_thuc_hien_id: {
      type: mongoose.Schema.Types.ObjectId,
      alias: 'userId',
      ref: 'User',
      default: null,
    },
    loai_chu_the: {
      type: String,
      alias: 'actorType',
      enum: ['USER', 'SYSTEM'],
      default: 'USER',
    },
    hanh_dong: {
      type: String,
      alias: 'action',
      required: [true, 'Hành động thao tác (action / hanh_dong) là bắt buộc'],
      trim: true,
    },
    doi_tuong_id: {
      type: String,
      alias: 'targetId',
      required: [true, 'ID đối tượng bị tác động (targetId / doi_tuong_id) là bắt buộc'],
    },
    loai_doi_tuong: {
      type: String,
      alias: 'targetType',
      required: [true, 'Loại đối tượng (targetType / loai_doi_tuong) là bắt buộc'],
      trim: true,
    },
    dia_chi_ip: {
      type: String,
      alias: 'ipAddress',
      default: null,
    },
    thong_tin_trinh_duyet: {
      type: String,
      alias: 'userAgent',
      default: null,
    },
    ket_qua: {
      type: String,
      alias: 'status',
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    thoi_diem: {
      type: Date,
      alias: 'timestamp',
      required: true,
      default: Date.now,
    },
    chi_tiet: {
      type: mongoose.Schema.Types.Mixed,
      alias: 'details',
      default: null,
    },
    // Chuỗi băm mật mã SHA-256 bảo vệ tính toàn vẹn (Hash Chaining - Chống chối bỏ)
    ma_bam_truoc: {
      type: String,
      alias: 'previousHash',
      default: null,
      trim: true,
      index: true,
    },
    ma_bam_hien_tai: {
      type: String,
      alias: 'currentHash',
      default: null,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'tao_luc', updatedAt: false },
    collection: 'nhat_ky_kiem_toan',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const actorVirtual = auditLogSchema.virtual('actor', {
  ref: 'User',
  localField: 'nguoi_thuc_hien_id',
  foreignField: '_id',
  justOne: true,
});
actorVirtual.get(function (val) {
  return val || this.nguoi_thuc_hien_id;
});

auditLogSchema.aliases = {
  actor: 'nguoi_thuc_hien_id',
  actorId: 'nguoi_thuc_hien_id',
  userId: 'nguoi_thuc_hien_id',
  actorType: 'loai_chu_the',
  action: 'hanh_dong',
  targetId: 'doi_tuong_id',
  targetType: 'loai_doi_tuong',
  ipAddress: 'dia_chi_ip',
  userAgent: 'thong_tin_trinh_duyet',
  status: 'ket_qua',
  timestamp: 'thoi_diem',
  details: 'chi_tiet',
  previousHash: 'ma_bam_truoc',
  currentHash: 'ma_bam_hien_tai',
};

const { schemaAliasPlugin } = require('../utils/schemaAliasPlugin');
auditLogSchema.plugin(schemaAliasPlugin);

auditLogSchema.index({ nguoi_thuc_hien_id: 1, thoi_diem: -1 });
auditLogSchema.index({ loai_doi_tuong: 1, doi_tuong_id: 1 });
auditLogSchema.index({ hanh_dong: 1, thoi_diem: -1 });
auditLogSchema.index({ loai_doi_tuong: 1, thoi_diem: -1 });
auditLogSchema.index({ thoi_diem: -1 });

const blockMutation = function () {
  const err = new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép sửa hoặc xóa.');
  err.status = 403;
  throw err;
};

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('replaceOne', blockMutation);
auditLogSchema.pre('findOneAndReplace', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);

auditLogSchema.pre('save', async function () {
  if (!this.isNew) {
    const err = new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép sửa hoặc xóa.');
    err.status = 403;
    throw err;
  }

  // Tự động thiết lập chuỗi băm mật mã SHA-256 (Hash Chain)
  if (!this.ma_bam_hien_tai) {
    let prevHash = this.ma_bam_truoc;
    if (!prevHash) {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          const lastDoc = await this.constructor
            .findOne({ ma_bam_hien_tai: { $ne: null } })
            .sort({ thoi_diem: -1, _id: -1 })
            .select('ma_bam_hien_tai')
            .lean();
          prevHash = lastDoc?.ma_bam_hien_tai || GENESIS_HASH;
        } catch (_) {
          prevHash = GENESIS_HASH;
        }
      } else {
        prevHash = GENESIS_HASH;
      }
      this.ma_bam_truoc = prevHash;
    }
    this.ma_bam_hien_tai = computeLogHash(this, prevHash);
  }
});

/**
 * Đối soát tính toàn vẹn chuỗi Hash SHA-256 (Audit Log Hash Chain Integrity Verification)
 * Duyệt từ bản ghi đầu tiên đến bản ghi mới nhất để kiểm tra tính toàn vẹn của chuỗi băm.
 * @param {number} [limit=1000] Số bản ghi tối đa cần kiểm tra
 * @returns {Promise<Object>}
 */
auditLogSchema.statics.verifyChainIntegrity = async function (limit = 1000) {
  const logs = await this.find({ ma_bam_hien_tai: { $ne: null } })
    .sort({ thoi_diem: 1, _id: 1 })
    .limit(Math.min(limit, 5000))
    .lean();

  if (logs.length === 0) {
    return {
      isValid: true,
      totalChecked: 0,
      validCount: 0,
      tamperedCount: 0,
      brokenChainCount: 0,
      tamperedLogs: [],
      genesisHash: GENESIS_HASH,
      latestHash: null,
      checkedAt: new Date().toISOString(),
    };
  }

  let validCount = 0;
  let tamperedCount = 0;
  let brokenChainCount = 0;
  const tamperedLogs = [];

  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    let isLogTampered = false;
    let tamperReason = null;

    // 1. Kiểm tra tính liên kết với mắt xích trước
    if (i > 0) {
      const previous = logs[i - 1];
      if (current.ma_bam_truoc !== previous.ma_bam_hien_tai) {
        brokenChainCount++;
        isLogTampered = true;
        tamperReason = `Mắt xích bị đứt gãy: ma_bam_truoc (${current.ma_bam_truoc?.slice(0, 10)}...) không khớp với ma_bam_hien_tai của bản ghi trước (${previous.ma_bam_hien_tai?.slice(0, 10)}...).`;
      }
    }

    // 2. Tái tính toán hash từ nội dung bản ghi và so khớp
    const expectedHash = computeLogHash(current, current.ma_bam_truoc);
    if (current.ma_bam_hien_tai !== expectedHash) {
      tamperedCount++;
      isLogTampered = true;
      tamperReason = tamperReason
        ? `${tamperReason} Đồng thời nội dung bản ghi bị thay đổi (Hash không khớp).`
        : 'Nội dung bản ghi đã bị can thiệp trái phép (Mã băm lưu trữ không khớp với dữ liệu thực tế).';
    }

    if (isLogTampered) {
      tamperedLogs.push({
        id: current._id,
        action: current.hanh_dong,
        timestamp: current.thoi_diem,
        storedHash: current.ma_bam_hien_tai,
        expectedHash,
        reason: tamperReason,
      });
    } else {
      validCount++;
    }
  }

  const isValid = tamperedCount === 0 && brokenChainCount === 0;

  return {
    isValid,
    totalChecked: logs.length,
    validCount,
    tamperedCount,
    brokenChainCount,
    tamperedLogs,
    genesisHash: logs[0]?.ma_bam_truoc || GENESIS_HASH,
    latestHash: logs[logs.length - 1]?.ma_bam_hien_tai,
    checkedAt: new Date().toISOString(),
  };
};

auditLogSchema.statics.computeLogHash = computeLogHash;
auditLogSchema.statics.GENESIS_HASH = GENESIS_HASH;

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema, 'nhat_ky_kiem_toan');

if (!mongoose.models.NhatKyKiemToan) {
  mongoose.model('NhatKyKiemToan', auditLogSchema, 'nhat_ky_kiem_toan');
}

module.exports = AuditLog;
