// Kết nối SQL Server qua Sequelize (mặc định dùng cột snake_case và giữ nguyên tên bảng tiếng Việt).
const { Sequelize } = require('sequelize');

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
    requestTimeout: 30000,
    connectTimeout: 15000,
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
  logging: process.env.NODE_ENV === 'development' ? false : false,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    createdAt: 'tao_luc',
    updatedAt: 'cap_nhat_luc',
  },
});

// Kiểm tra và mở kết nối tới SQL Server
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
