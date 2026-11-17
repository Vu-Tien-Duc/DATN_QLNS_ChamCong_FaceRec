// Quản lý giao dịch ACID với SQL Server qua Sequelize.
const { sequelize } = require('../config/db');

// Thực thi hàm nghiệp vụ bên trong một transaction ACID của Sequelize
const runInTransaction = async (workFn) => {
  return await sequelize.transaction(async (t) => {
    return await workFn(t);
  });
};

module.exports = {
  runInTransaction,
};
