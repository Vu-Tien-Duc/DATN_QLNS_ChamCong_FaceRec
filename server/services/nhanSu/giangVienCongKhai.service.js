// Truy vấn danh bạ, hồ sơ và thống kê công khai của giảng viên.
const { Op } = require('sequelize');
const { sequelize, NguoiDung, HoSoCanBo, PhongBan, LichTrinh, MonHoc } = require('../../models');
const { isValidUuid, normalizePagination } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');

// Quy đổi học hàm/học vị sang danh xưng viết tắt (GS.TS, PGS.TS, TS, ThS...)
const resolveAcademicTitle = (profile = {}) => {
  if (profile.hoc_ham === 'giao_su') return 'GS.TS';
  if (profile.hoc_ham === 'pho_giao_su') return 'PGS.TS';
  if (profile.hoc_vi === 'tien_si') return 'TS';
  if (profile.hoc_vi === 'thac_si') return 'ThS';
  if (profile.hoc_vi === 'ky_su') return 'KS';
  if (profile.hoc_vi === 'cu_nhan') return 'CN';
  return 'GV';
};

// Mở rộng danh sách đơn vị gồm đơn vị cha và các bộ môn trực thuộc
const expandDepartmentIds = async (rootDeptId) => {
  const allIds = [String(rootDeptId)];
  let currentParents = [String(rootDeptId)];
  while (currentParents.length > 0) {
    const children = await PhongBan.findAll({
      where: { don_vi_cha_id: { [Op.in]: currentParents } },
      attributes: ['id'],
      raw: true,
    });
    const nextIds = children.map((c) => String(c.id)).filter((id) => !allIds.includes(id));
    if (nextIds.length === 0) break;
    allIds.push(...nextIds);
    currentParents = nextIds;
  }
  return allIds;
};

// Lấy danh sách giảng viên công khai có lọc theo từ khóa, đơn vị, học hàm, học vị và phân trang
const getPublicFacultyList = async ({
  search = '',
  phong_ban_id,
  hoc_ham,
  hoc_vi,
  page = 1,
  limit = 12,
} = {}) => {
  const { page: pageNum, limit: limitNum, offset } = normalizePagination(page, limit, 50);

  const userWhere = {
    kich_hoat: true,
    trang_thai_lam_viec: 'dang_lam_viec',
  };

  if (phong_ban_id && phong_ban_id !== 'tat_ca') {
    if (!isValidUuid(phong_ban_id)) {
      throw new ServiceError('Mã đơn vị (phong_ban_id) không hợp lệ.', 400);
    }
    const scopedDeptIds = await expandDepartmentIds(phong_ban_id);
    userWhere.don_vi_chinh_id = scopedDeptIds.length === 1 ? scopedDeptIds[0] : { [Op.in]: scopedDeptIds };
  }

  if (search && search.trim()) {
    const likePattern = `%${search.trim()}%`;
    userWhere[Op.or] = [
      { ho_ten: { [Op.like]: likePattern } },
      { email: { [Op.like]: likePattern } },
    ];
  }

  const profileWhere = { loai_nhan_su: 'giang_vien' };
  if (hoc_ham && hoc_ham !== 'tat_ca') profileWhere.hoc_ham = hoc_ham.toLowerCase();
  if (hoc_vi && hoc_vi !== 'tat_ca') profileWhere.hoc_vi = hoc_vi.toLowerCase();

  const rankOrderExpr = sequelize.literal(
    "CASE [ho_so].[hoc_ham] WHEN 'giao_su' THEN 1 WHEN 'pho_giao_su' THEN 2 ELSE 3 END"
  );
  const degreeOrderExpr = sequelize.literal(
    "CASE [ho_so].[hoc_vi] WHEN 'tien_si' THEN 1 WHEN 'thac_si' THEN 2 WHEN 'ky_su' THEN 3 WHEN 'cu_nhan' THEN 4 ELSE 5 END"
  );

  const { count: total, rows: facultyList } = await NguoiDung.findAndCountAll({
    where: userWhere,
    attributes: ['id', 'ho_ten', 'email', 'don_vi_chinh_id', 'anh_dai_dien', 'vai_tro_chinh'],
    include: [
      { model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] },
      {
        model: HoSoCanBo,
        as: 'ho_so',
        where: profileWhere,
        required: true,
        attributes: ['hoc_ham', 'hoc_vi', 'chuc_vu', 'ngay_bat_dau_giang_day'],
      },
    ],
    order: [
      [rankOrderExpr, 'ASC'],
      [degreeOrderExpr, 'ASC'],
      ['ho_ten', 'ASC'],
    ],
    offset,
    limit: limitNum,
    distinct: true,
  });

  const data = facultyList.map((f) => {
    const profile = f.ho_so || {};
    const deptName = f.don_vi_chinh?.ten_phong_ban || 'Chưa phân đơn vị';
    return {
      id: f.id,
      ho_ten: f.ho_ten,
      email: f.email,
      danh_hieu: resolveAcademicTitle(profile),
      hoc_ham: profile.hoc_ham || 'khong',
      hoc_vi: profile.hoc_vi || 'thac_si',
      chuc_vu: profile.chuc_vu || 'Giảng viên',
      khoa: deptName,
      khoa_id: f.don_vi_chinh?.id || null,
      anh_dai_dien: f.anh_dai_dien || null,
      huong_nghien_cuu: [],
      phong_lam_viec: f.don_vi_chinh?.ten_phong_ban ? `Văn phòng ${f.don_vi_chinh.ten_phong_ban}` : '',
      hoc_phan_giang_day: [],
      tieu_su: '',
    };
  });

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

// Lấy hồ sơ tóm tắt và các môn giảng dạy của một giảng viên công khai
const getPublicFacultyById = async (id) => {
  if (!isValidUuid(id)) {
    throw new ServiceError('Mã định danh giảng viên không hợp lệ', 400);
  }

  const faculty = await NguoiDung.findOne({
    where: { id, kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec' },
    attributes: ['id', 'ho_ten', 'email', 'don_vi_chinh_id', 'anh_dai_dien'],
    include: [
      { model: PhongBan, as: 'don_vi_chinh', attributes: ['id', 'ten_phong_ban', 'loai_don_vi'] },
      {
        model: HoSoCanBo,
        as: 'ho_so',
        where: { loai_nhan_su: 'giang_vien' },
        required: true,
        attributes: ['hoc_ham', 'hoc_vi', 'chuc_vu', 'ngay_bat_dau_giang_day'],
      },
    ],
  });

  if (!faculty) {
    throw new ServiceError('Không tìm thấy hồ sơ giảng viên hoặc hồ sơ không còn khả dụng.', 404);
  }

  const schedules = await LichTrinh.findAll({
    where: { nguoi_dung_id: id },
    include: [{ model: MonHoc, as: 'mon_hoc', attributes: ['id', 'ma_mon', 'ten_mon', 'so_tin_chi', 'mo_ta'] }],
  });

  const distinctSubjects = [];
  const seenSubjects = new Set();
  for (const s of schedules) {
    if (s.mon_hoc && !seenSubjects.has(String(s.mon_hoc.id))) {
      seenSubjects.add(String(s.mon_hoc.id));
      distinctSubjects.push({
        id: s.mon_hoc.id,
        ma_mon: s.mon_hoc.ma_mon,
        ten_mon: s.mon_hoc.ten_mon,
        so_tin_chi: s.mon_hoc.so_tin_chi,
        mo_ta: s.mon_hoc.mo_ta || '',
      });
    }
  }

  const profile = faculty.ho_so || {};
  const deptName = faculty.don_vi_chinh?.ten_phong_ban || 'Chưa phân đơn vị';
  return {
    id: faculty.id,
    ho_ten: faculty.ho_ten,
    email: faculty.email,
    danh_hieu: resolveAcademicTitle(profile),
    hoc_ham: profile.hoc_ham || 'khong',
    hoc_vi: profile.hoc_vi || 'thac_si',
    chuc_vu: profile.chuc_vu || 'Giảng viên',
    khoa: deptName,
    khoa_id: faculty.don_vi_chinh?.id || null,
    anh_dai_dien: faculty.anh_dai_dien || null,
    huong_nghien_cuu: [],
    phong_lam_viec: faculty.don_vi_chinh?.ten_phong_ban ? `Văn phòng ${faculty.don_vi_chinh.ten_phong_ban}` : '',
    hoc_phan_giang_day: distinctSubjects.map((s) => s.ten_mon),
    cac_mon_chi_tiet: distinctSubjects,
    tieu_su: '',
    ngay_bat_dau_giang_day: profile.ngay_bat_dau_giang_day || null,
  };
};

// Thống kê số lượng giảng viên theo học hàm, học vị và đơn vị
const getPublicFacultyStats = async () => {
  const activeUserInclude = [
    {
      model: NguoiDung,
      as: 'nguoi_dung',
      where: { kich_hoat: true, trang_thai_lam_viec: 'dang_lam_viec' },
      attributes: [],
    },
  ];

  const [totalFaculty, countGS, countPGS, countTS, departments] = await Promise.all([
    HoSoCanBo.count({ where: { loai_nhan_su: 'giang_vien' }, include: activeUserInclude }),
    HoSoCanBo.count({ where: { loai_nhan_su: 'giang_vien', hoc_ham: 'giao_su' }, include: activeUserInclude }),
    HoSoCanBo.count({ where: { loai_nhan_su: 'giang_vien', hoc_ham: 'pho_giao_su' }, include: activeUserInclude }),
    HoSoCanBo.count({ where: { loai_nhan_su: 'giang_vien', hoc_vi: 'tien_si', hoc_ham: 'khong' }, include: activeUserInclude }),
    PhongBan.findAll({ where: { loai_don_vi: 'khoa' }, attributes: ['id', 'ten_phong_ban'] }),
  ]);

  return {
    tong_so_giang_vien: totalFaculty,
    so_luong_gs: countGS,
    so_luong_pgs: countPGS,
    so_luong_ts: countTS,
    so_luong_gs_pgs_ts: countGS + countPGS + countTS,
    ty_le_tien_si_tro_len:
      totalFaculty > 0 ? Math.round(((countGS + countPGS + countTS) / totalFaculty) * 100) : 0,
    danh_sach_khoa: departments.map((d) => ({
      id: d.id,
      ten_khoa: d.ten_phong_ban,
    })),
  };
};

module.exports = {
  getPublicFacultyList,
  getPublicFacultyById,
  getPublicFacultyStats,
};
