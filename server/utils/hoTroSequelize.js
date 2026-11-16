/**
 * Tiện ích dùng chung cho tầng Service khi làm việc với Sequelize & SQL Server.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kiểm tra chuỗi có phải UUID hợp lệ hay không. */
const isValidUuid = (val) => {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
};

/** Chuẩn hóa tham số phân trang (page, limit, offset). */
const normalizePagination = (page = 1, limit = 20, maxLimit = 100) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, offset };
};

module.exports = {
  UUID_REGEX,
  isValidUuid,
  normalizePagination,
};
