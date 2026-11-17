// Mô hình bảng nhat_ky_kiem_toan: lưu nhật ký kiểm toán an ninh liên kết chuỗi băm SHA-256.
const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, jsonText } = require('./modelHelpers');

const GENESIS_HASH = '0'.repeat(64);

// Băm SHA-256 bản ghi kiểm toán nối với mã băm liền trước
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
    for (let i = 0; i < 20; i += 1) {
      const ok = await redisHelpers.acquireRedisLock(lockKey, 5, workerId);
      if (ok === true) {
        acquired = true;
        break;
      }
      if (ok === null) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
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
  // Kiểm tra tính toàn vẹn chuỗi băm của các bản ghi gần nhất
  static async xacMinhChuoi({ limit = 1000 } = {}) {
    const recentLogs = await NhatKyKiemToan.findAll({ order: [['thoi_diem', 'DESC']], limit });
    const logs = recentLogs.reverse();
    let prev = null;
    for (const log of logs) {
      if (prev !== null && log.ma_bam_truoc !== prev) return { hopLe: false, loiTaiId: log.id };
      if (computeLogHash(log, log.ma_bam_truoc || GENESIS_HASH) !== log.ma_bam_hien_tai) {
        return { hopLe: false, loiTaiId: log.id };
      }
      prev = log.ma_bam_hien_tai;
    }
    return { hopLe: true, loiTaiId: null, checkedCount: logs.length };
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
        if (!log.thoi_diem) {
          log.thoi_diem = new Date();
        }
        if (log.ma_bam_hien_tai) return;
        await runWithAuditChainLock(async () => {
          if (!log.ma_bam_truoc) {
            const last = await NhatKyKiemToan.findOne({
              order: [['thoi_diem', 'DESC']],
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
        });
      },
      beforeBulkCreate: async (logs, options) => {
        if (!Array.isArray(logs) || logs.length === 0) return;
        await runWithAuditChainLock(async () => {
          const last = await NhatKyKiemToan.findOne({
            order: [['thoi_diem', 'DESC']],
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
        });
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
module.exports.GENESIS_HASH = GENESIS_HASH;
