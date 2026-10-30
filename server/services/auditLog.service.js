/**
 * Truy vấn nhật ký kiểm toán với bộ lọc, phân trang và giới hạn dữ liệu trả về.
 */
const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog.model');
const ServiceError = require('../utils/serviceError');

const getAuditLogs = async ({ actor, action, targetType, status, search, keyword, startDate, endDate, page, limit }) => {
  const query = {};
  if (actor) {
    if (actor === 'null' || actor === 'system') {
      query.actor = null;
    } else if (!mongoose.Types.ObjectId.isValid(actor)) {
      throw new ServiceError('ID người thực hiện (actor) không đúng định dạng ObjectId hợp lệ.', 400);
    } else {
      query.actor = actor;
    }
  }
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;
  if (status) {
    const normalizedStatus = String(status).toLowerCase();
    if (['success', 'failed'].includes(normalizedStatus)) {
      query.status = normalizedStatus;
    }
  }

  const searchTerm = (keyword || search || '').trim();
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { action: searchRegex },
      { targetType: searchRegex },
      { targetId: searchRegex },
    ];
  }

  let parsedStartDate = null;
  let parsedEndDate = null;
  if (startDate) {
    parsedStartDate = new Date(startDate);
    if (Number.isNaN(parsedStartDate.getTime())) {
      throw new ServiceError('Ngày bắt đầu (startDate) không hợp lệ.', 400);
    }
  }
  if (endDate) {
    parsedEndDate = new Date(endDate);
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new ServiceError('Ngày kết thúc (endDate) không hợp lệ.', 400);
    }
    if (typeof endDate === 'string' && !endDate.includes('T')) {
      parsedEndDate.setHours(23, 59, 59, 999);
    } else if (
      parsedEndDate.getHours() === 0 &&
      parsedEndDate.getMinutes() === 0 &&
      parsedEndDate.getSeconds() === 0
    ) {
      parsedEndDate.setHours(23, 59, 59, 999);
    }
  }
  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    throw new ServiceError(
      'Khoảng thời gian không hợp lệ: Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
      400
    );
  }
  if (parsedStartDate || parsedEndDate) {
    query.timestamp = {};
    if (parsedStartDate) query.timestamp.$gte = parsedStartDate;
    if (parsedEndDate) query.timestamp.$lte = parsedEndDate;
  }

  const totalDocs = await AuditLog.countDocuments(query);
  const isPaginated = page !== undefined || limit !== undefined;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = isPaginated ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : 500;
  const totalPages = Math.ceil(totalDocs / limitNum) || 1;
  let auditQuery = AuditLog.find(query).populate('actor', 'fullName email role').sort({ timestamp: -1 });
  auditQuery = isPaginated
    ? auditQuery.skip((pageNum - 1) * limitNum).limit(limitNum)
    : auditQuery.limit(limitNum);

  const logs = await auditQuery;
  return {
    totalRecords: totalDocs,
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalPages,
      totalDocs,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
};

/**
 * Kiểm tra tính toàn vẹn chuỗi Hash SHA-256 của toàn bộ Audit Logs
 * @param {number} [limit=1000]
 */
const verifyAuditLogIntegrity = async (limit = 1000) => {
  const parsedLimit = Math.max(10, Math.min(parseInt(limit, 10) || 1000, 5000));
  return AuditLog.verifyChainIntegrity(parsedLimit);
};

module.exports = {
  getAuditLogs,
  verifyAuditLogIntegrity,
};
