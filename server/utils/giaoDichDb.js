const { sequelize } = require('../config/db');

/**
 * Quản lý Giao dịch ACID trong Microsoft SQL Server thông qua Sequelize.
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 *
 * @param {Function} workFn - Hàm thực thi nhận `transaction` làm tham số
 * @returns {Promise<any>}
 */
const runInTransaction = async (workFn) => {
  return await sequelize.transaction(async (t) => {
    return await workFn(t);
  });
};

module.exports = {
  runInTransaction,
};
