// Tra cứu tổng hợp công, lịch sử chấm công (NhatKyChamCong), lượt quẹt (LuotQuetChamCong) và ảnh minh chứng theo phân quyền
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  NguoiDung,
  PhongBan,
  CaLamViec,
  LichTrinh,
  MonHoc,
  DonNghiPhep,
} = require('../../models');

const SCHEDULE_WITH_SUBJECT_INCLUDE = {
  model: LichTrinh,
  as: 'lich_trinh',
  attributes: ['id', 'phong_hoc', 'mon_hoc_id', 'thu_trong_tuan', 'tiet_bat_dau', 'so_tiet', 'gio_bat_dau', 'gio_ket_thuc'],
  include: [{ model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ten_mon', 'ma_mon'] }],
};
const { getDeanScopedUserIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const { ServiceError, buildAttendanceDateFilter } = require('../../utils/thoiGianChamCong.utils');
const { normalizeRole, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES } = require('../../utils/vaiTro.utils');

// Thống kê tổng hợp chấm công của một nhân sự trong khoảng thời gian
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const where = { nguoi_dung_id: userId };
  if (startDate || endDate) {
    Object.assign(where, buildAttendanceDateFilter(startDate, endDate));
  }

  const records = await NhatKyChamCong.findAll({
    where,
    include: [
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
      SCHEDULE_WITH_SUBJECT_INCLUDE,
    ],
    order: [
      ['thoi_gian_vao', 'DESC'],
      ['ngay_cong', 'DESC'],
    ],
  });

  return {
    totalRecords: records.length,
    onTimeCount: records.filter((r) => r.trang_thai === 'on_time').length,
    lateCount: records.filter((r) => r.trang_thai === 'late').length,
    earlyLeaveCount: records.filter((r) => r.trang_thai === 'early_leave').length,
    absentCount: records.filter((r) => r.trang_thai === 'absent').length,
    excusedCount: records.filter((r) => r.trang_thai === 'excused_absence').length,
    fraudCount: records.filter((r) => r.co_gian_lan === true).length,
    records,
  };
};

// Tra cứu lịch sử chấm công có lọc theo đơn vị, ngày, trạng thái và phân trang
const getAttendanceHistory = async (params = {}) => {
  const {
    vai_tro,
    nguoi_dung_id,
    currentUserId,
    don_vi_chinh_id,
    trang_thai,
    phuong_thuc,
    co_gian_lan,
    tu_ngay: from,
    den_ngay: to,
    currentUser,
  } = params;
  const { page, limit, offset } = normalizePagination(params.page || 1, params.limit || 20, 100);

  const where = {};
  const userRole = normalizeRole(vai_tro || currentUser?.vai_tro_chinh);

  // 1. Phân quyền truy cập (Fail-closed: chỉ GLOBAL_ADMIN_ROLES được xem toàn trường)
  if (GLOBAL_ADMIN_ROLES.includes(userRole)) {
    if (nguoi_dung_id) where.nguoi_dung_id = nguoi_dung_id;
    if (don_vi_chinh_id) {
      const usersInDept = await NguoiDung.findAll({
        where: { don_vi_chinh_id },
        attributes: ['id'],
        raw: true,
      });
      const deptUserIds = usersInDept.map((u) => u.id);
      if (!deptUserIds.length) {
        return {
          records: [],
          pagination: { total: 0, page, limit, totalPages: 1 },
        };
      }
      where.nguoi_dung_id = where.nguoi_dung_id
        ? { [Op.and]: [where.nguoi_dung_id, { [Op.in]: deptUserIds }] }
        : { [Op.in]: deptUserIds };
    }
  } else if (UNIT_LEADER_ROLES.includes(userRole)) {
    const facultyUserIds = await getDeanScopedUserIds(currentUser);
    if (!facultyUserIds.length) {
      throw new ServiceError('Tài khoản Trưởng đơn vị chưa được gán đơn vị quản lý hoặc đơn vị chưa có nhân sự.', 400);
    }
    if (nguoi_dung_id) {
      if (!facultyUserIds.map(String).includes(String(nguoi_dung_id))) {
        throw new ServiceError('Bạn không có quyền xem dữ liệu của nhân sự ngoài đơn vị.', 403);
      }
      where.nguoi_dung_id = nguoi_dung_id;
    } else {
      where.nguoi_dung_id = { [Op.in]: facultyUserIds };
    }
  } else {
    where.nguoi_dung_id = currentUserId || currentUser?.id;
  }

  // 2. Bộ lọc trạng thái & điều kiện
  if (trang_thai) where.trang_thai = trang_thai;
  if (co_gian_lan !== undefined) {
    where.co_gian_lan = co_gian_lan === 'true' || co_gian_lan === true;
  }
  if (from || to) {
    Object.assign(where, buildAttendanceDateFilter(from, to));
  }

  const punchInclude = {
    model: LuotQuetChamCong,
    as: 'luot_quet',
    attributes: [
      'id',
      'thoi_gian_quet',
      'loai_quet',
      'phuong_thuc',
      'do_tin_cay_ai',
      'diem_mat_that',
      'goc_mat_nhan_dien',
      'do_chinh_xac_gps',
      'vi_tri_gia_lap',
      'khoang_cach_met',
      'hop_le',
      'ly_do_khong_hop_le',
      'ma_thiet_bi',
      'vi_do',
      'kinh_do',
      'anh_minh_chung',
    ],
  };
  if (phuong_thuc) {
    punchInclude.where = { phuong_thuc: String(phuong_thuc).toLowerCase() };
    punchInclude.required = true;
  }

  const { rows: records, count: total } = await NhatKyChamCong.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: NguoiDung,
        as: 'nguoi_dung',
        attributes: ['id', 'ho_ten', 'email', 'ma_can_bo', 'vai_tro_chinh', 'don_vi_chinh_id', 'anh_dai_dien'],
        include: [
          {
            model: PhongBan,
            as: 'don_vi_chinh',
            attributes: ['id', 'ten_phong_ban', 'loai_don_vi'],
          },
        ],
      },
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
      SCHEDULE_WITH_SUBJECT_INCLUDE,
      { model: NguoiDung, as: 'nguoi_ghi_de', attributes: ['id', 'ho_ten', 'ma_can_bo'] },
      { model: DonNghiPhep, as: 'don_tu', attributes: ['id', 'loai_don', 'ngay_bat_dau', 'ngay_ket_thuc', 'trang_thai'] },
      punchInclude,
    ],
    order: [
      ['ngay_cong', 'DESC'],
      ['thoi_gian_vao', 'DESC'],
    ],
    offset,
    limit,
  });

  return {
    records,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// Lấy danh sách lượt quét chấm công thô (LuotQuetChamCong) theo bộ lọc thời gian
const getRawPunchLogs = async ({ nguoi_dung_id, from, to, page = 1, limit = 50 }) => {
  const where = {};
  if (nguoi_dung_id) where.nguoi_dung_id = nguoi_dung_id;
  if (from || to) {
    where.thoi_gian_quet = {};
    if (from) where.thoi_gian_quet[Op.gte] = new Date(from);
    if (to) where.thoi_gian_quet[Op.lte] = new Date(to);
  }

  const { page: pageNum, limit: limitNum, offset } = normalizePagination(page, limit, 200);

  const { rows: punches, count: total } = await LuotQuetChamCong.findAndCountAll({
    where,
    include: [
      {
        model: NguoiDung,
        as: 'nguoi_dung',
        attributes: ['id', 'ho_ten', 'email', 'ma_can_bo'],
      },
    ],
    order: [['thoi_gian_quet', 'DESC']],
    offset,
    limit: limitNum,
  });

  return {
    punches,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

// Lấy ảnh minh chứng điểm danh của bản ghi kèm kiểm tra quyền truy cập
const getAttendanceEvidence = async ({ id, currentUser }) => {
  const { readAttendanceEvidence } = require('../../utils/anhMinhChungChamCong');

  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã bản ghi chấm công không hợp lệ.', 400);
  }

  const log = await NhatKyChamCong.findByPk(String(id), {
    attributes: ['id', 'nguoi_dung_id'],
    include: [
      {
        model: LuotQuetChamCong,
        as: 'luot_quet',
        attributes: ['id', 'anh_minh_chung', 'thoi_gian_quet'],
      },
    ],
  });

  let ownerId = null;
  let reference = null;

  if (log) {
    ownerId = String(log.nguoi_dung_id);
    const withPhoto = (log.luot_quet || [])
      .filter((p) => p.anh_minh_chung)
      .sort((a, b) => new Date(b.thoi_gian_quet) - new Date(a.thoi_gian_quet));
    reference = withPhoto[0]?.anh_minh_chung || null;
  } else {
    const punch = await LuotQuetChamCong.findByPk(String(id), {
      attributes: ['id', 'nguoi_dung_id', 'anh_minh_chung'],
    });
    if (!punch) {
      throw new ServiceError('Không tìm thấy bản ghi chấm công.', 404);
    }
    ownerId = String(punch.nguoi_dung_id);
    reference = punch.anh_minh_chung;
  }

  // Phân quyền: Admin xem mọi bản ghi, Trưởng khoa xem trong khoa, Cán bộ xem chính mình
  if (currentUser) {
    const curRole = normalizeRole(currentUser.role || currentUser.vai_tro_chinh);
    if (!GLOBAL_ADMIN_ROLES.includes(curRole)) {
      if (UNIT_LEADER_ROLES.includes(curRole)) {
        const inScope = await isUserInDeanScope(currentUser, ownerId);
        if (!inScope) {
          throw new ServiceError('Bạn không có quyền xem ảnh minh chứng điểm danh của cán bộ ngoài khoa.', 403);
        }
      } else if (ownerId !== String(currentUser.id)) {
        throw new ServiceError('Bạn không có quyền xem ảnh minh chứng điểm danh của người khác.', 403);
      }
    }
  }

  if (!reference) {
    throw new ServiceError('Bản ghi điểm danh này không có ảnh minh chứng.', 404);
  }

  const evidence = await readAttendanceEvidence(reference);
  if (!evidence) {
    throw new ServiceError('Không tìm thấy tệp ảnh minh chứng trên hệ thống lưu trữ.', 404);
  }

  return evidence;
};

// Lấy chi tiết một bản ghi chấm công theo ID (kiểm tra quyền xem theo phạm vi)
const getAttendanceById = async ({ id, currentUser }) => {
  if (!id || !isValidUuid(String(id))) {
    throw new ServiceError('Mã bản ghi chấm công không hợp lệ.', 400);
  }

  const log = await NhatKyChamCong.findByPk(String(id), {
    include: [
      {
        model: NguoiDung,
        as: 'nguoi_dung',
        attributes: ['id', 'ho_ten', 'ma_can_bo', 'email', 'vai_tro_chinh', 'anh_dai_dien', 'don_vi_chinh_id'],
        include: [
          {
            model: PhongBan,
            as: 'don_vi_chinh',
            attributes: ['id', 'ten_phong_ban', 'loai_don_vi'],
          },
        ],
      },
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_di_muon_phut'] },
      SCHEDULE_WITH_SUBJECT_INCLUDE,
      { model: NguoiDung, as: 'nguoi_ghi_de', attributes: ['id', 'ho_ten', 'ma_can_bo'] },
      { model: DonNghiPhep, as: 'don_tu', attributes: ['id', 'loai_don', 'ngay_bat_dau', 'ngay_ket_thuc', 'trang_thai'] },
      {
        model: LuotQuetChamCong,
        as: 'luot_quet',
        attributes: [
          'id',
          'thoi_gian_quet',
          'loai_quet',
          'phuong_thuc',
          'do_tin_cay_ai',
          'diem_mat_that',
          'goc_mat_nhan_dien',
          'do_chinh_xac_gps',
          'vi_tri_gia_lap',
          'khoang_cach_met',
          'hop_le',
          'ly_do_khong_hop_le',
          'ma_thiet_bi',
          'vi_do',
          'kinh_do',
          'anh_minh_chung',
        ],
      },
    ],
  });

  if (!log) {
    throw new ServiceError('Không tìm thấy bản ghi chấm công.', 404);
  }

  // Phân quyền: Admin xem mọi bản ghi, Trưởng khoa xem trong khoa, Cán bộ xem chính mình
  const ownerId = String(log.nguoi_dung_id);
  if (currentUser) {
    const curRole = normalizeRole(currentUser.role || currentUser.vai_tro_chinh);
    if (!GLOBAL_ADMIN_ROLES.includes(curRole)) {
      if (UNIT_LEADER_ROLES.includes(curRole)) {
        const inScope = await isUserInDeanScope(currentUser, ownerId);
        if (!inScope) {
          throw new ServiceError('Bạn không có quyền xem bản ghi chấm công của cán bộ ngoài khoa.', 403);
        }
      } else if (ownerId !== String(currentUser.id)) {
        throw new ServiceError('Bạn không có quyền xem bản ghi chấm công của người khác.', 403);
      }
    }
  }

  return log;
};

module.exports = {
  getAttendanceSummaryByUser,
  getAttendanceHistory,
  getRawPunchLogs,
  getAttendanceEvidence,
  getAttendanceById,
};
