/**
 * Truy vấn nhật ký kiểm toán với bộ lọc, phân trang và kiểm tra toàn vẹn chuỗi băm.
 */
const { Op } = require('sequelize');
const { NhatKyKiemToan, NguoiDung } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');

const getAuditLogs = async (params = {}) => {
  const {
    nguoi_thuc_hien_id,
    actor,
    hanh_dong,
    action,
    loai_doi_tuong,
    targetType,
    ket_qua,
    status,
    tim_kiem,
    keyword,
    tu_ngay,
    den_ngay,
    page,
    limit,
    trang,
    gioi_han,
  } = params;

  const where = {};
  const effectiveActor = nguoi_thuc_hien_id || actor;
  if (effectiveActor) {
    if (effectiveActor === 'null' || effectiveActor === 'system') {
      where.nguoi_thuc_hien_id = null;
    } else if (!isValidUuid(effectiveActor)) {
      throw new ServiceError('ID người thực hiện (nguoi_thuc_hien_id) không đúng định dạng UUID hợp lệ.', 400);
    } else {
      where.nguoi_thuc_hien_id = effectiveActor;
    }
  }

  const effectiveAction = hanh_dong || action;
  if (effectiveAction) where.hanh_dong = effectiveAction;

  const effectiveTargetType = loai_doi_tuong || targetType;
  if (effectiveTargetType) where.loai_doi_tuong = effectiveTargetType;

  const rawStatus = ket_qua || status;
  if (rawStatus) {
    const normalizedStatus = String(rawStatus).toLowerCase();
    if (['success', 'failed'].includes(normalizedStatus)) {
      where.ket_qua = normalizedStatus;
    }
  }

  const searchTerm = (tim_kiem || keyword || '').trim();
  if (searchTerm) {
    const likePattern = `%${searchTerm}%`;
    where[Op.or] = [
      { hanh_dong: { [Op.like]: likePattern } },
      { loai_doi_tuong: { [Op.like]: likePattern } },
      { doi_tuong_id: { [Op.like]: likePattern } },
    ];
  }

  let parsedStartDate = null;
  let parsedEndDate = null;
  if (tu_ngay) {
    parsedStartDate = new Date(tu_ngay);
    if (Number.isNaN(parsedStartDate.getTime())) {
      throw new ServiceError('Ngày bắt đầu không hợp lệ.', 400);
    }
  }
  if (den_ngay) {
    parsedEndDate = new Date(den_ngay);
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new ServiceError('Ngày kết thúc không hợp lệ.', 400);
    }
    if (typeof den_ngay === 'string' && !den_ngay.includes('T')) {
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
  if (parsedStartDate && parsedEndDate) {
    where.thoi_diem = { [Op.between]: [parsedStartDate, parsedEndDate] };
  } else if (parsedStartDate) {
    where.thoi_diem = { [Op.gte]: parsedStartDate };
  } else if (parsedEndDate) {
    where.thoi_diem = { [Op.lte]: parsedEndDate };
  }

  const isPaginated = page !== undefined || limit !== undefined || trang !== undefined || gioi_han !== undefined;
  const { page: pageNum, limit: limitNum, offset } = normalizePagination(
    page ?? trang,
    isPaginated ? (limit ?? gioi_han ?? 20) : 500,
    500
  );

  const { count: totalDocs, rows: logs } = await NhatKyKiemToan.findAndCountAll({
    where,
    include: [
      {
        model: NguoiDung,
        as: 'nguoi_thuc_hien',
        attributes: ['id', 'ho_ten', 'email', 'vai_tro_chinh'],
      },
    ],
    order: [['thoi_diem', 'DESC']],
    offset: isPaginated ? offset : 0,
    limit: limitNum,
  });

  const totalPages = Math.ceil(totalDocs / limitNum) || 1;
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

const verifyAuditLogIntegrity = async (limit = 1000) => {
  const parsedLimit = Math.max(10, Math.min(parseInt(limit, 10) || 1000, 5000));
  return NhatKyKiemToan.xacMinhChuoi({ limit: parsedLimit });
};

module.exports = {
  getAuditLogs,
  verifyAuditLogIntegrity,
};
