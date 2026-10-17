const mongoose = require('mongoose');

/**
 * Quản lý kết nối đến cơ sở dữ liệu MongoDB thông qua Mongoose.
 */
const connectDB = async () => {
  const mongoURI =
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV === 'production' ? null : 'mongodb://localhost:27017/DATN_QLNS_ChamCong_FaceRec');

  if (!mongoURI) {
    throw new Error('MONGODB_URI chưa được cấu hình.');
  }

  const conn = await mongoose.connect(mongoURI);
  require('../models');
  console.log(`[Database] Kết nối MongoDB thành công: ${conn.connection.host}`);
};

module.exports = connectDB;
