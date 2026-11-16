const { Sequelize } = require('sequelize');

/**
 * Cấu hình kết nối cơ sở dữ liệu Microsoft SQL Server (MSSQL) thông qua Sequelize & Tedious.
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 */

const dbName = process.env.DB_NAME || 'DATN_QLNS_ChamCong_FaceRec';
const dbUser = process.env.DB_USER || 'sa';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '1433', 10);
const dbInstance = process.env.DB_INSTANCE || undefined;
const dbEncrypt = process.env.DB_ENCRYPT === 'true';
const dbTrustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false';

const dialectOptions = {
  options: {
    encrypt: dbEncrypt,
    trustServerCertificate: dbTrustServerCertificate,
    enableArithAbort: true,
  },
};

if (dbInstance) {
  dialectOptions.instanceName = dbInstance;
}

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbInstance ? undefined : dbPort,
  dialect: 'mssql',
  dialectOptions,
  logging: process.env.NODE_ENV === 'development' ? false : false, // Bật console.log nếu cần debug SQL
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true, // Tự động chuyển camelCase sang snake_case cho cột hệ thống
    freezeTableName: true, // Giữ nguyên tên bảng thuần Việt theo CSDL v2.5
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
  },
});

/**
 * Quản lý kết nối đến cơ sở dữ liệu SQL Server.
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      `[Database] Kết nối Microsoft SQL Server thành công: ${dbHost}${dbInstance ? '\\' + dbInstance : ':' + dbPort}/${dbName}`
    );
    return sequelize;
  } catch (error) {
    console.error(`[Database Error] Không thể kết nối tới Microsoft SQL Server:`, error.message);
    throw error;
  }
};

module.exports = connectDB;
module.exports.sequelize = sequelize;
module.exports.Sequelize = Sequelize;
module.exports.connectDB = connectDB;
