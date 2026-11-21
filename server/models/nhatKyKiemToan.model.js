// Mô hình bảng nhat_ky_kiem_toan: lưu nhật ký kiểm toán an ninh liên kết chuỗi băm SHA-256.
const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, jsonText } = require('./modelHelpers');

const GENESIS_HASH = '0'.repeat(64);

// Băm SHA-256 bản ghi kiểm toán nối với mã băm liền trước (v2: bao gồm cả IP và lý do thất bại)
const computeLogHash = (log, previousHash) => {
  const prev = previousHash !== undefined ? previousHash : (log.ma_bam_truoc || GENESIS_HASH);
  const timeStr = log.thoi_diem ? new Date(log.thoi_diem).toISOString() : new Date().toISOString();
  const details = log.chi_tiet ? JSON.stringify(log.chi_tiet) : '';

  const rawString = [
    prev,
    timeStr,
    log.nguoi_thuc_hien_id ? String(log.nguoi_thuc_hien_id) : '',
    log.loai_chu_the || 'user',
    log.hanh_dong || '',
    log.loai_doi_tuong || '',
    log.doi_tuong_id ? String(log.doi_tuong_id) : '',
    log.ket_qua || 'success',
    log.dia_chi_ip ? String(log.dia_chi_ip) : '',
    log.ly_do_that_bai ? String(log.ly_do_that_bai) : '',
    details,
  ].join('|');

  return crypto.createHash('sha256').update(rawString).digest('hex');
};

// Công thức băm v1 cũ (tương thích ngược khi đối soát bản ghi lịch sử có sẵn trước nâng cấp v2)
const computeLogHashLegacyV1 = (log, previousHash) => {
  const prev = previousHash !== undefined ? previousHash : (log.ma_bam_truoc || GENESIS_HASH);
  const timeStr = log.thoi_diem ? new Date(log.thoi_diem).toISOString() : new Date().toISOString();
  const details = log.chi_tiet ? JSON.stringify(log.chi_tiet) : '';

  const rawString = [
    prev,
    timeStr,
    log.nguoi_thuc_hien_id ? String(log.nguoi_thuc_hien_id) : '',
    log.loai_chu_the || 'user',
    log.hanh_dong || '',
    log.loai_doi_tuong || '',
    log.doi_tuong_id ? String(log.doi_tuong_id) : '',
    log.ket_qua || 'success',
    details,
  ].join('|');

  return crypto.createHash('sha256').update(rawString).digest('hex');
};

// Tuần tự hóa việc ghi log trong tiến trình để chuỗi băm không bị phân nhánh.
let chainQueue = Promise.resolve();
const runExclusive = (task) => {
  const next = chainQueue.then(task, task);
  chainQueue = next.catch(() => {});
  return next;
};

const runWithAuditChainLock = async (task) =>
  runExclusive(async () => {
    let redisHelpers = null;
    try {
      redisHelpers = require('../config/redis');
    } catch (_) {
      return task();
    }

    if (!redisHelpers?.isRedisReady || !redisHelpers.isRedisReady()) {
      return task();
    }

    const lockKey = 'AUDIT_LOG_HASH_CHAIN';
    const workerId = `${process.pid}_${crypto.randomUUID()}`;
    let acquired = false;
    let redisUnavailable = false;
    for (let i = 0; i < 60; i += 1) {
      const ok = await redisHelpers.acquireRedisLock(lockKey, 5, workerId);
      if (ok === true) {
        acquired = true;
        break;
      }
      if (ok === null) {
        redisUnavailable = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!acquired && !redisUnavailable) {
      throw new Error('[AuditChainLock] Không thể chiếm khóa tuần tự chuỗi Hash SHA-256 sau thời gian chờ.');
    }

    try {
      return await task();
    } finally {
      if (acquired) {
        await redisHelpers.releaseRedisLock(lockKey, workerId).catch(() => {});
      }
    }
  });

class NhatKyKiemToan extends Model {
  // Giữ khóa tuần tự xuyên suốt thao tác INSERT để chuỗi Hash không bị phân nhánh khi ghi đồng thời
  async save(options = {}) {
    if (!this.isNewRecord || options?._insideAuditLock) {
      return super.save(options);
    }
    return runWithAuditChainLock(() =>
      super.save({
        ...options,
        _insideAuditLock: true,
      })
    );
  }

  static async bulkCreate(records, options = {}) {
    if (options?._insideAuditLock) {
      return super.bulkCreate(records, options);
    }
    return runWithAuditChainLock(() =>
      super.bulkCreate(records, {
        ...options,
        _insideAuditLock: true,
      })
    );
  }

  // Kiểm tra tính toàn vẹn chuỗi băm của các bản ghi gần nhất (trả đủ thống kê & chi tiết bản ghi lỗi)
  static async xacMinhChuoi({ limit = 1000 } = {}) {
    const [totalInDb, recentLogs] = await Promise.all([
      NhatKyKiemToan.count(),
      NhatKyKiemToan.findAll({ order: [['thoi_diem', 'DESC'], ['id', 'DESC']], limit }),
    ]);

    const logs = recentLogs.reverse();
    const tamperedMap = new Map();
    let brokenChainCount = 0;

    const recordViolation = (log, reason, expectedHash = undefined) => {
      const id = String(log.id);
      if (!tamperedMap.has(id)) {
        tamperedMap.set(id, {
          id,
          action: log.hanh_dong || '',
          timestamp: log.thoi_diem ? new Date(log.thoi_diem).toISOString() : new Date().toISOString(),
          storedHash: log.ma_bam_hien_tai || null,
          ...(expectedHash ? { expectedHash } : {}),
          reason,
        });
      }
    };

    // Khi quét toàn bộ bảng, bản ghi đầu tiên bắt buộc phải nối từ GENESIS_HASH (phát hiện xóa log đầu bảng)
    if (logs.length > 0 && logs.length === totalInDb && logs[0].ma_bam_truoc !== GENESIS_HASH) {
      brokenChainCount += 1;
      recordViolation(logs[0], 'Bản ghi đầu tiên không liên kết GENESIS_HASH (nghi xóa bản ghi đầu bảng)');
    }

    let prev = null;
    for (const log of logs) {
      if (prev !== null && log.ma_bam_truoc !== prev) {
        brokenChainCount += 1;
        recordViolation(log, 'Chuỗi ma_bam_truoc không khớp ma_bam_hien_tai của bản ghi liền trước');
      }
      const prevHash = log.ma_bam_truoc || GENESIS_HASH;
      const expectedHash = computeLogHash(log, prevHash);
      const expectedLegacyHash = computeLogHashLegacyV1(log, prevHash);
      if (expectedHash !== log.ma_bam_hien_tai && expectedLegacyHash !== log.ma_bam_hien_tai) {
        recordViolation(log, 'Mã băm SHA-256 không khớp nội dung bản ghi', expectedHash);
      }
      prev = log.ma_bam_hien_tai;
    }

    const tamperedLogs = Array.from(tamperedMap.values());
    const tamperedCount = tamperedLogs.length;
    const totalChecked = logs.length;
    const isValid = tamperedCount === 0;
    const firstTamperedId = tamperedLogs[0]?.id || null;

    return {
      isValid,
      hopLe: isValid,
      loiTaiId: firstTamperedId,
      totalChecked,
      checkedCount: totalChecked,
      validCount: Math.max(0, totalChecked - tamperedCount),
      tamperedCount,
      brokenChainCount,
      tamperedLogs,
      genesisHash: logs[0]?.ma_bam_truoc || GENESIS_HASH,
      latestHash: logs.length > 0 ? logs[logs.length - 1].ma_bam_hien_tai : GENESIS_HASH,
      checkedAt: new Date().toISOString(),
    };
  }
}

NhatKyKiemToan.init(
  {
    id: uuidPk(),
    nguoi_thuc_hien_id: uuidFk(true),
    loai_chu_the: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'user',
      validate: { isIn: { args: [['user', 'system']], msg: 'Loại chủ thể không hợp lệ' } },
    },
    hanh_dong: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { notEmpty: { msg: 'Hành động thao tác là bắt buộc' } },
    },
    loai_doi_tuong: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    doi_tuong_id: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    chi_tiet: jsonText('chi_tiet', null),
    ket_qua: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'success' },
    ly_do_that_bai: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    ma_bam_truoc: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    ma_bam_hien_tai: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    dia_chi_ip: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    user_agent: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    thoi_diem: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'NhatKyKiemToan',
    tableName: 'nhat_ky_kiem_toan',
    timestamps: false,
    hooks: {
      beforeCreate: async (log, options) => {
        const computeStep = async () => {
          if (!log.thoi_diem) {
            log.thoi_diem = new Date();
          }
          if (log.ma_bam_hien_tai) return;
          if (!log.ma_bam_truoc) {
            const last = await NhatKyKiemToan.findOne({
              order: [['thoi_diem', 'DESC'], ['id', 'DESC']],
              attributes: ['ma_bam_hien_tai', 'thoi_diem'],
              transaction: options && options.transaction,
              ...(options && options.transaction ? { lock: options.transaction.LOCK.UPDATE } : {}),
            });
            if (last?.thoi_diem && new Date(log.thoi_diem).getTime() <= new Date(last.thoi_diem).getTime()) {
              log.thoi_diem = new Date(new Date(last.thoi_diem).getTime() + 1);
            }
            log.ma_bam_truoc = (last && last.ma_bam_hien_tai) || GENESIS_HASH;
          }
          log.ma_bam_hien_tai = computeLogHash(log, log.ma_bam_truoc);
        };

        if (options?._insideAuditLock) {
          await computeStep();
        } else {
          await runWithAuditChainLock(computeStep);
        }
      },
      beforeBulkCreate: async (logs, options) => {
        if (!Array.isArray(logs) || logs.length === 0) return;
        const computeBulkStep = async () => {
          const last = await NhatKyKiemToan.findOne({
            order: [['thoi_diem', 'DESC'], ['id', 'DESC']],
            attributes: ['ma_bam_hien_tai', 'thoi_diem'],
            transaction: options && options.transaction,
            ...(options && options.transaction ? { lock: options.transaction.LOCK.UPDATE } : {}),
          });
          let prevHash = (last && last.ma_bam_hien_tai) || GENESIS_HASH;
          let prevTimeMs = last?.thoi_diem ? new Date(last.thoi_diem).getTime() : 0;
          for (const log of logs) {
            if (!log.thoi_diem) {
              log.thoi_diem = new Date();
            }
            const curTimeMs = new Date(log.thoi_diem).getTime();
            if (prevTimeMs && curTimeMs <= prevTimeMs) {
              log.thoi_diem = new Date(prevTimeMs + 1);
            }
            prevTimeMs = new Date(log.thoi_diem).getTime();
            if (!log.ma_bam_hien_tai) {
              log.ma_bam_truoc = log.ma_bam_truoc || prevHash;
              log.ma_bam_hien_tai = computeLogHash(log, log.ma_bam_truoc);
            }
            prevHash = log.ma_bam_hien_tai;
          }
        };

        if (options?._insideAuditLock) {
          await computeBulkStep();
        } else {
          await runWithAuditChainLock(computeBulkStep);
        }
      },
      beforeUpdate: () => {
        throw new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép chỉnh sửa.');
      },
      beforeDestroy: () => {
        throw new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép xóa.');
      },
      beforeBulkUpdate: () => {
        throw new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép cập nhật hàng loạt.');
      },
      beforeBulkDestroy: () => {
        throw new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép xóa hàng loạt.');
      },
    },
    indexes: [
      { fields: ['nguoi_thuc_hien_id'] },
      { fields: ['thoi_diem'] },
    ],
  }
);

module.exports = NhatKyKiemToan;
module.exports.computeLogHash = computeLogHash;
module.exports.computeLogHashLegacyV1 = computeLogHashLegacyV1;
module.exports.GENESIS_HASH = GENESIS_HASH;
