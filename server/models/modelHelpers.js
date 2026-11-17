// Các hàm dựng kiểu cột dùng chung (UUID, JSON, TIME, BIGINT, DECIMAL) cho mô hình Sequelize trên SQL Server.
const { DataTypes } = require('sequelize');
const { encryptBiometricJson, decryptBiometricJson } = require('../utils/maHoaSinhTrac');

// Khóa chính UUID
const uuidPk = () => ({
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true,
  allowNull: false,
});

// Khóa ngoại UUID
const uuidFk = (allowNull = false) => (allowNull
  ? { type: DataTypes.UUID, allowNull: true, defaultValue: null }
  : { type: DataTypes.UUID, allowNull: false });

// Cột chuỗi lưu JSON, tự động parse/stringify
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

// Cột TIME của SQL Server (ghi dạng 'HH:mm', đọc Date từ driver về 'HH:mm')
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

// Cột BIGINT tiền tệ (luôn ép kiểu về Number khi đọc)
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

// Cột DECIMAL (luôn ép kiểu về Number khi đọc)
const decimalColumn = (name, precision, scale, defaultValue = 0, allowNull = false) => ({
  type: DataTypes.DECIMAL(precision, scale),
  allowNull,
  defaultValue: allowNull ? null : defaultValue,
  get() {
    const v = this.getDataValue(name);
    return v === null || v === undefined ? v : Number(v);
  },
});

// Cột chuỗi tự động cắt khoảng trắng hai đầu
const trimmedString = (name, length, extra = {}) => ({
  type: DataTypes.STRING(length),
  ...extra,
  set(val) {
    this.setDataValue(name, typeof val === 'string' ? val.trim() : val);
  },
});

// Cột văn bản mã hóa AES-256-GCM khi lưu và tự giải mã khi đọc
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
