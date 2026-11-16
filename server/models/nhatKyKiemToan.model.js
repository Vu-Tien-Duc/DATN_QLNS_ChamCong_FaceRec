const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, jsonText } = require('./modelHelpers');

const GENESIS_HASH = '0'.repeat(64);

/** Băm SHA-256 một bản ghi kiểm toán kèm mã băm của bản ghi liền trước (Hash Chain). */
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

/** Bảng nhat_ky_kiem_toan: nhật ký kiểm toán an ninh dạng chuỗi băm (chỉ có thoi_diem, không có tao_luc/cap_nhat_luc). */
class NhatKyKiemToan extends Model {
  /** Xác minh toàn vẹn chuỗi băm của `limit` bản ghi gần nhất theo thứ tự thời gian. */
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
        await runExclusive(async () => {
          if (!log.ma_bam_truoc) {
            const last = await NhatKyKiemToan.findOne({
              order: [['thoi_diem', 'DESC']],
              attributes: ['ma_bam_hien_tai'],
              transaction: options && options.transaction,
            });
            log.ma_bam_truoc = (last && last.ma_bam_hien_tai) || GENESIS_HASH;
          }
          log.ma_bam_hien_tai = computeLogHash(log, log.ma_bam_truoc);
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
