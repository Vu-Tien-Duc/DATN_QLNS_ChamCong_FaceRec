// Truy vấn nhật ký kiểm toán và kiểm tra tính toàn vẹn chuỗi băm.
const { Op } = require('sequelize');
const { NhatKyKiemToan, NguoiDung } = require('../../models');
const ServiceError = require('../../utils/loiNghiepVu');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');

// Parse ngày lọc YYYY-MM-DD theo múi giờ Việt Nam (UTC+7)
const parseAuditDateBound = (dateInput, isEnd = false) => {
  if (!dateInput) return null;
  const raw = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T${isEnd ? '23:59:59.999' : '00:00:00.000'}+07:00`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError(isEnd ? 'Ngày kết thúc không hợp lệ.' : 'Ngày bắt đầu không hợp lệ.', 400);
  }
  return parsed;
};

// Truy vấn nhật ký kiểm toán có lọc theo người thực hiện, hành động, ngày và phân trang
const getAuditLogs = async (params = {}) => {
  const {
    nguoi_thuc_hien_id,
    hanh_dong,
    loai_doi_tuong,
    ket_qua,
    tim_kiem,
    tu_ngay,
    den_ngay,
    trang,
    gioi_han,
  } = params;

  const where = {};
  if (nguoi_thuc_hien_id) {
    if (nguoi_thuc_hien_id === 'null' || nguoi_thuc_hien_id === 'system') {
      where.nguoi_thuc_hien_id = null;
    } else if (!isValidUuid(nguoi_thuc_hien_id)) {
      throw new ServiceError('ID người thực hiện (nguoi_thuc_hien_id) không đúng định dạng UUID hợp lệ.', 400);
    } else {
      where.nguoi_thuc_hien_id = nguoi_thuc_hien_id;
    }
  }

  if (hanh_dong) where.hanh_dong = hanh_dong;
  if (loai_doi_tuong) where.loai_doi_tuong = loai_doi_tuong;

  if (ket_qua) {
    const normalizedStatus = String(ket_qua).toLowerCase();
    if (['success', 'failed'].includes(normalizedStatus)) {
      where.ket_qua = normalizedStatus;
    }
  }

  const searchTerm = (tim_kiem || '').trim();
  if (searchTerm) {
    const likePattern = `%${searchTerm}%`;
    where[Op.or] = [
      { hanh_dong: { [Op.like]: likePattern } },
      { loai_doi_tuong: { [Op.like]: likePattern } },
      { doi_tuong_id: { [Op.like]: likePattern } },
      { dia_chi_ip: { [Op.like]: likePattern } },
      { chi_tiet: { [Op.like]: likePattern } },
      { '$nguoi_thuc_hien.ho_ten$': { [Op.like]: likePattern } },
      { '$nguoi_thuc_hien.email$': { [Op.like]: likePattern } },
      { '$nguoi_thuc_hien.ma_can_bo$': { [Op.like]: likePattern } },
    ];
  }

  const parsedStartDate = parseAuditDateBound(tu_ngay, false);
  const parsedEndDate = parseAuditDateBound(den_ngay, true);

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

  const isPaginated = trang !== undefined || gioi_han !== undefined;
  const { page: pageNum, limit: limitNum, offset } = normalizePagination(
    trang,
    isPaginated ? (gioi_han ?? 20) : 500,
    1000
  );

  const actorInclude = {
    model: NguoiDung,
    as: 'nguoi_thuc_hien',
    attributes: ['id', 'ho_ten', 'ma_can_bo', 'email', 'vai_tro_chinh', 'anh_dai_dien'],
    required: false,
  };

  const countInclude = searchTerm ? [actorInclude] : [];

  const [{ count: totalDocs, rows: logs }, totalSuccessCount, totalFailedCount] = await Promise.all([
    NhatKyKiemToan.findAndCountAll({
      where,
      include: [actorInclude],
      order: [['thoi_diem', 'DESC'], ['id', 'DESC']],
      offset: isPaginated ? offset : 0,
      limit: limitNum,
      subQuery: false,
      distinct: true,
    }),
    NhatKyKiemToan.count({
      where: { ...where, ket_qua: 'success' },
      include: countInclude,
      distinct: true,
    }),
    NhatKyKiemToan.count({
      where: { ...where, ket_qua: 'failed' },
      include: countInclude,
      distinct: true,
    }),
  ]);

  const totalPages = Math.ceil(totalDocs / limitNum) || 1;
  return {
    totalRecords: totalDocs,
    logs,
    summary: {
      totalRecords: totalDocs,
      successCount: totalSuccessCount,
      failedCount: totalFailedCount,
    },
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

// Kiểm tra tính toàn vẹn chuỗi băm SHA-256 của nhật ký kiểm toán gần nhất
const verifyAuditLogIntegrity = async (limit = 1000) => {
  const parsedLimit = Math.max(10, Math.min(parseInt(limit, 10) || 1000, 5000));
  return NhatKyKiemToan.xacMinhChuoi({ limit: parsedLimit });
};

module.exports = {
  getAuditLogs,
  verifyAuditLogIntegrity,
};
