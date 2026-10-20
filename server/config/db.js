const mongoose = require('mongoose');

/**
 * Quản lý kết nối đến cơ sở dữ liệu MongoDB thông qua Mongoose.
 */
const connectDB = async () => {
  let mongoURI =
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV === 'production' ? null : 'mongodb://localhost:27017/DATN_QLNS_ChamCong_FaceRec?retryWrites=false');

  if (!mongoURI) {
    throw new Error('MONGODB_URI chưa được cấu hình.');
  }

  // Tự động tắt retryWrites khi kết nối MongoDB standalone (localhost) để tránh lỗi MongoServerError
  if (!mongoURI.includes('retryWrites') && (mongoURI.includes('localhost') || mongoURI.includes('127.0.0.1'))) {
    mongoURI += mongoURI.includes('?') ? '&retryWrites=false' : '?retryWrites=false';
  }

  const conn = await mongoose.connect(mongoURI);
  require('../models');
  console.log(`[Database] Kết nối MongoDB thành công: ${conn.connection.host}`);
};

module.exports = connectDB;
