/**
 * Attendance History & Summary Service (server/services/attendance/attendanceHistory.service.js)
 * Chuẩn hóa Sequelize + SQL Server 3NF:
 * - Tra cứu lịch sử chấm công tổng hợp NhatKyChamCong (nhat_ky_cham_cong).
 * - Truy vết chi tiết các lượt quẹt thô LuotQuetChamCong (luot_quet_cham_cong) kèm GPS và độ tin cậy AI.
 * - Phân quyền chặt chẽ: Cán bộ chỉ xem bản thân; Trưởng khoa xem trong khoa; Admin/BGH xem toàn trường.
 */
const { Op } = require('sequelize');
const {
  NhatKyChamCong,
  LuotQuetChamCong,
  NguoiDung,
  PhongBan,
  CaLamViec,
  LichTrinh,
} = require('../../models');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../../utils/phamViTruongKhoa');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const { ServiceError, buildAttendanceDateFilter } = require('../../utils/thoiGianChamCong.utils');
const { normalizeRole, UNIT_LEADER_ROLES, GLOBAL_ADMIN_ROLES } = require('../../utils/vaiTro.utils');

/**
 * 1. Tổng hợp số liệu chấm công cá nhân theo kỳ / tháng
 */
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const where = { nguoi_dung_id: userId };
  if (startDate || endDate) {
    Object.assign(where, buildAttendanceDateFilter(startDate, endDate));
  }

  const records = await NhatKyChamCong.findAll({
    where,
    include: [
      { model: CaLamViec, as: 'ca', attributes: ['id', 'ten_ca', 'gio_bat_dau', 'gio_ket_thuc'] },
      { model: LichTrinh, as: 'lich_trinh', attributes: ['id', 'phong_hoc', 'thu_trong_tuan'] },
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

/**
 * 2. Lấy danh sách lịch sử chấm công (Phân quyền, lọc, phân trang)
 */
const getAttendanceHistory = async (params = {}) => {
  const vai_tro = params.vai_tro || params.role;
  const nguoi_dung_id = params.nguoi_dung_id || params.userId;
  const currentUserId = params.currentUserId;
  const don_vi_chinh_id = params.don_vi_chinh_id || params.departmentId || params.don_vi_id;
  const trang_thai = params.trang_thai || params.status;
  const phuong_thuc = params.phuong_thuc || params.method;
  const co_gian_lan = params.co_gian_lan !== undefined ? params.co_gian_lan : params.isFraud;
  const from = params.from || params.tu_ngay;
  const to = params.to || params.den_ngay;
  const { page, limit, offset } = normalizePagination(params.page || 1, params.limit || 20, 100);
  const currentUser = params.currentUser;

  const where = {};
  const userRole = normalizeRole(vai_tro || currentUser?.vai_tro_chinh || currentUser?.role);

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
      'vi_tri_gia_lap',
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
      { model: LichTrinh, as: 'lich_trinh', attributes: ['id', 'phong_hoc', 'mon_hoc_id'] },
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

/**
 * 3. Tra cứu lịch sử quẹt thẻ thô (LuotQuetChamCong)
 */
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

/**
 * 4. Lấy dữ liệu ảnh minh chứng điểm danh theo ID bản ghi (có kiểm tra RBAC)
 */
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

/**
 * 5. Lấy chi tiết một bản ghi chấm công theo ID (có kiểm tra RBAC)
 */
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
      { model: LichTrinh, as: 'lich_trinh', attributes: ['id', 'phong_hoc', 'mon_hoc_id', 'thu_trong_tuan', 'tiet_bat_dau', 'so_tiet'] },
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
          'vi_tri_gia_lap',
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
