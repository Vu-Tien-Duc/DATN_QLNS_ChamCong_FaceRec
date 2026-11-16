const { DataTypes } = require('sequelize');
const { encryptBiometricJson, decryptBiometricJson } = require('../utils/maHoaSinhTrac');

/**
 * Hàm dựng cột dùng chung cho 24 mô hình SQL Server (chuẩn CSDL 3NF - docs/schema_3nf_sqlserver.sql).
 */

/** Khóa chính UNIQUEIDENTIFIER (ứng dụng sinh UUID v4; DB có DEFAULT NEWSEQUENTIALID()). */
const uuidPk = () => ({
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true,
  allowNull: false,
});

/** Khóa ngoại UNIQUEIDENTIFIER. */
const uuidFk = (allowNull = false) => (allowNull
  ? { type: DataTypes.UUID, allowNull: true, defaultValue: null }
  : { type: DataTypes.UUID, allowNull: false });

/** Cột NVARCHAR(MAX) lưu JSON, tự (de)serialize. */
const jsonText = (name, fallback = null) => ({
  type: DataTypes.TEXT,
  allowNull: fallback === null,
  get() {
    const raw = this.getDataValue(name);
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },
  set(val) {
    if (val === null || val === undefined) {
      this.setDataValue(name, fallback === null ? null : JSON.stringify(fallback));
    } else {
      this.setDataValue(name, typeof val === 'string' ? val : JSON.stringify(val));
    }
  },
});

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Cột kiểu TIME của SQL Server. Khai báo STRING ở tầng ORM để bind tham số dạng chuỗi 'HH:mm'
 * (SQL Server tự chuyển ngầm sang TIME), còn khi đọc tedious trả về Date => chuẩn hóa về 'HH:mm'.
 */
const timeColumn = (name, defaultValue) => {
  const col = {
    type: DataTypes.STRING(8),
    allowNull: false,
    validate: {
      is: { args: [/^\d{2}:\d{2}(:\d{2})?$/], msg: `${name} phải có định dạng HH:mm` },
    },
    get() {
      const v = this.getDataValue(name);
      if (v instanceof Date) return `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
      if (typeof v === 'string') return v.slice(0, 5);
      return v;
    },
    set(val) {
      this.setDataValue(name, val ? String(val).trim() : val);
    },
  };
  if (defaultValue !== undefined) col.defaultValue = defaultValue;
  return col;
};

/** Cột BIGINT (tedious trả về chuỗi) => luôn đọc ra Number. */
const moneyColumn = (name) => ({
  type: DataTypes.BIGINT,
  allowNull: false,
  defaultValue: 0,
  validate: { min: 0 },
  get() {
    const v = this.getDataValue(name);
    return v === null || v === undefined ? 0 : Number(v);
  },
});

/** Cột DECIMAL (tedious trả về chuỗi) => luôn đọc ra Number. */
const decimalColumn = (name, precision, scale, defaultValue = 0, allowNull = false) => ({
  type: DataTypes.DECIMAL(precision, scale),
  allowNull,
  defaultValue: allowNull ? null : defaultValue,
  get() {
    const v = this.getDataValue(name);
    return v === null || v === undefined ? v : Number(v);
  },
});

const trimmedString = (name, length, extra = {}) => ({
  type: DataTypes.STRING(length),
  ...extra,
  set(val) {
    this.setDataValue(name, typeof val === 'string' ? val.trim() : val);
  },
});

const encryptedJsonText = (name, fallback = null) => ({
  type: DataTypes.TEXT,
  allowNull: fallback === null,
  get() {
    const raw = this.getDataValue(name);
    if (raw === null || raw === undefined || raw === '') return fallback;
    return decryptBiometricJson(raw, fallback);
  },
  set(val) {
    if (val === null || val === undefined) {
      this.setDataValue(name, fallback === null ? null : encryptBiometricJson(fallback));
    } else {
      this.setDataValue(name, encryptBiometricJson(val));
    }
  },
});

module.exports = {
  uuidPk,
  uuidFk,
  jsonText,
  encryptedJsonText,
  timeColumn,
  moneyColumn,
  decimalColumn,
  trimmedString,
};
