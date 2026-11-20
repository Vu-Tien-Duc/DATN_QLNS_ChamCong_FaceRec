/**
 * Normalization Utility for Backend CSDL v2.5
 * Đồng bộ hóa dữ liệu từ CSDL v2.5 (Tiếng Việt) sang Frontend đảm bảo
 * dữ liệu luôn đầy đủ cả trường chuẩn Tiếng Việt lẫn alias tiếng Anh tương thích.
 */

export function normalizeBackendData<T = any>(data: any): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Nếu là mảng, chuẩn hóa từng phần tử
  if (Array.isArray(data)) {
    return data.map((item) => normalizeBackendData(item)) as any;
  }

  // Nếu là object thông thường (không phải Date hay FormData)
  if (typeof data === 'object' && !(data instanceof Date) && !(data instanceof FormData) && !(data instanceof Blob)) {
    const copy: Record<string, any> = { ...data };

    // 0a. Đồng bộ khóa chính id <-> _id và dấu thời gian cho toàn bộ bản ghi SQL Server / Sequelize
    if ('id' in copy && copy.id !== undefined && copy.id !== null && !('_id' in copy)) {
      copy._id = copy.id;
    } else if ('_id' in copy && copy._id !== undefined && copy._id !== null && !('id' in copy)) {
      copy.id = copy._id;
    }
    if ('tao_luc' in copy && copy.tao_luc !== undefined && !('createdAt' in copy)) {
      copy.createdAt = copy.tao_luc;
    }
    if ('cap_nhat_luc' in copy && copy.cap_nhat_luc !== undefined && !('updatedAt' in copy)) {
      copy.updatedAt = copy.cap_nhat_luc;
    }

    // 0. Chuẩn hóa Auth, Face Registration, Upload, Payroll Summary (Pure Vietnamese -> Frontend compat)
    if ('nguoi_dung' in copy && !('user' in copy)) {
      copy.user = normalizeBackendData(copy.nguoi_dung);
    }
    if ('ma_lam_moi' in copy && !('refreshToken' in copy)) {
      copy.refreshToken = copy.ma_lam_moi;
    }
    if ('da_khoa' in copy && !('isLocked' in copy)) {
      copy.isLocked = Boolean(copy.da_khoa);
    }
    if ('tai_lieu' in copy && !('documents' in copy)) {
      copy.documents = copy.tai_lieu;
    }
    if ('duong_dan_tep' in copy && !('fileUrl' in copy)) {
      copy.fileUrl = copy.duong_dan_tep;
    }
    if ('duong_dan_day_du' in copy && !('fullUrl' in copy)) {
      copy.fullUrl = copy.duong_dan_day_du;
    }
    if ('ten_tep' in copy && !('filename' in copy)) {
      copy.filename = copy.ten_tep;
    }
    if ('ten_goc' in copy && !('originalName' in copy)) {
      copy.originalName = copy.ten_goc;
    }
    if ('tong_ban_ghi' in copy || 'tong_thuc_linh' in copy) {
      copy.month = copy.thang ?? copy.month;
      copy.year = copy.nam ?? copy.year;
      copy.totalRecords = copy.tong_ban_ghi ?? copy.totalRecords ?? 0;
      copy.totalNetSalary = copy.tong_thuc_linh ?? copy.totalNetSalary ?? 0;
      copy.totalGrossSalary = copy.tong_thu_nhap ?? copy.totalGrossSalary ?? 0;
      copy.totalTax = copy.tong_thue_tncn ?? copy.totalTax ?? 0;
      copy.totalInsurance = copy.tong_bao_hiem ?? copy.totalInsurance ?? 0;
      copy.totalOvertimePay = copy.tong_vuot_gio ?? copy.totalOvertimePay ?? 0;
    }
    if ('so_mau' in copy || 'cac_goc_mau' in copy || 'mau_khuon_mat_id' in copy) {
      copy.userId = copy.nguoi_dung_id ?? copy.userId;
      copy.fullName = copy.ho_ten ?? copy.fullName;
      copy.sampleCount = copy.so_mau ?? copy.sampleCount;
      copy.sampleAngles = copy.cac_goc_mau ?? copy.sampleAngles;
      copy.facePhoto = copy.anh_khuon_mat ?? copy.facePhoto;
      copy.templateId = copy.mau_khuon_mat_id ?? copy.templateId;
    }

    // 1. Chuẩn hóa Đối tượng Người dùng (User / Cán bộ)
    if ('ho_ten' in copy || 'ma_can_bo' in copy || 'vai_tro_chinh' in copy) {
      copy.fullName = copy.ho_ten || copy.fullName || '';
      copy.ho_ten = copy.ho_ten || copy.fullName || '';
      copy.staffCode = copy.ma_can_bo || copy.staffCode || '';
      copy.ma_can_bo = copy.ma_can_bo || copy.staffCode || '';
      copy.phoneNumber = copy.so_dien_thoai || copy.phoneNumber || '';
      copy.so_dien_thoai = copy.so_dien_thoai || copy.phoneNumber || '';
      copy.role = copy.vai_tro_chinh || copy.role || 'giang_vien';
      copy.vai_tro_chinh = copy.vai_tro_chinh || copy.role || 'giang_vien';
      copy.departmentId = copy.don_vi_chinh && typeof copy.don_vi_chinh === 'object'
        ? copy.don_vi_chinh
        : (copy.don_vi_chinh_id !== undefined ? copy.don_vi_chinh_id : copy.departmentId);
      copy.don_vi_chinh_id = copy.don_vi_chinh_id !== undefined ? copy.don_vi_chinh_id : copy.departmentId;
      copy.createdAt = copy.tao_luc || copy.createdAt || null;
      copy.updatedAt = copy.cap_nhat_luc || copy.updatedAt || null;
      copy.isActive = copy.kich_hoat !== undefined ? copy.kich_hoat : (copy.isActive !== undefined ? copy.isActive : true);
      copy.kich_hoat = copy.isActive;
      copy.isFaceRegistered = copy.da_dang_ky_face !== undefined ? copy.da_dang_ky_face : Boolean(copy.isFaceRegistered);
      copy.da_dang_ky_face = copy.isFaceRegistered;
      copy.faceRegisteredAt = copy.ngay_dang_ky_face || copy.faceRegisteredAt || null;
      copy.ngay_dang_ky_face = copy.faceRegisteredAt;
      copy.vectorDimension = copy.so_chieu_vector !== undefined ? copy.so_chieu_vector : copy.vectorDimension;
      copy.isDefaultFace = copy.mac_dinh !== undefined ? Boolean(copy.mac_dinh) : copy.isDefaultFace;
      copy.faceStatus = copy.trang_thai_khuon_mat || copy.faceStatus || null;
      if (copy.anh_khuon_mat !== undefined && !('facePhoto' in copy)) copy.facePhoto = copy.anh_khuon_mat;
      if (copy.so_luong_mau !== undefined && copy.sampleCount === undefined) copy.sampleCount = copy.so_luong_mau;
      copy.lastLoginAt = copy.lan_dang_nhap_cuoi || copy.lastLoginAt || null;
      copy.passwordChangedAt = copy.doi_mat_khau_luc || copy.passwordChangedAt || null;
      copy.avatar = copy.anh_dai_dien || copy.avatar || null;
      copy.anh_dai_dien = copy.avatar;
      copy.academicRank = copy.hoc_ham || copy.academicRank || 'khong';
      copy.hoc_ham = copy.academicRank;
      copy.position = copy.chuc_vu || copy.position || '';
      copy.degree = copy.hoc_vi || copy.degree || 'cu_nhan';
      copy.hoc_vi = copy.degree;
      copy.staffType = copy.loai_nhan_su || copy.staffType || 'giang_vien';
      copy.loai_nhan_su = copy.staffType;
      copy.contractType = copy.loai_hop_dong || copy.contractType || 'toan_thoi_gian';
      copy.loai_hop_dong = copy.contractType;
      copy.employmentStatus = copy.trang_thai_lam_viec || copy.employmentStatus || 'dang_lam_viec';
      copy.trang_thai_lam_viec = copy.employmentStatus;
      copy.gender = copy.gioi_tinh || copy.gender || 'nam';
      copy.gioi_tinh = copy.gender;
      copy.annualLeaveQuota = copy.han_muc_phep_nam !== undefined ? copy.han_muc_phep_nam : copy.annualLeaveQuota;
      copy.han_muc_phep_nam = copy.annualLeaveQuota;
      copy.salaryCoefficient = copy.he_so_luong !== undefined ? copy.he_so_luong : copy.salaryCoefficient;
      copy.he_so_luong = copy.salaryCoefficient;
      copy.salaryScale = copy.ngach_luong || copy.salaryScale || '';
      copy.ngach_luong = copy.salaryScale;
      copy.dependentsCount = copy.so_nguoi_phu_thuoc !== undefined ? copy.so_nguoi_phu_thuoc : copy.dependentsCount;
      copy.so_nguoi_phu_thuoc = copy.dependentsCount;
      copy.address = copy.dia_chi || copy.address || '';
      copy.dia_chi = copy.address;
      copy.startDate = copy.ngay_vao_lam || copy.startDate || '';
      copy.ngay_vao_lam = copy.startDate;
      copy.dateOfBirth = copy.ngay_sinh || copy.dateOfBirth || '';
      copy.ngay_sinh = copy.dateOfBirth;

      if (copy.don_vi_chinh && typeof copy.don_vi_chinh === 'object') {
        copy.department = copy.don_vi_chinh;
        const deptName = copy.don_vi_chinh.ten_phong_ban || copy.don_vi_chinh.name || '';
        copy.departmentName = copy.ten_phong_ban || deptName || copy.departmentName || '';
        copy.ten_phong_ban = copy.departmentName;
      } else if (copy.don_vi_chinh_id && typeof copy.don_vi_chinh_id === 'object') {
        const deptName = copy.don_vi_chinh_id.ten_phong_ban || copy.don_vi_chinh_id.name || '';
        copy.departmentName = copy.ten_phong_ban || deptName || copy.departmentName || '';
        copy.ten_phong_ban = copy.departmentName;
      }
      if (Array.isArray(copy.danh_sach_vai_tro) && !('roles' in copy)) {
        copy.roles = copy.danh_sach_vai_tro;
      }
      if (copy.ho_so && typeof copy.ho_so === 'object') {
        copy.profile = copy.ho_so;
      }
    }

    // 1.1. Chuẩn hóa Vai trò phân quyền (VaiTroNguoiDung)
    if ('ma_vai_tro' in copy && 'pham_vi' in copy) {
      copy.role = copy.ma_vai_tro || copy.role || '';
      copy.scope = copy.pham_vi || copy.scope || 'toan_truong';
      copy.isAuthorized = copy.duoc_uy_quyen !== undefined ? Boolean(copy.duoc_uy_quyen) : Boolean(copy.isAuthorized);
      copy.startDate = copy.tu_ngay || copy.startDate || null;
      copy.endDate = copy.den_ngay || copy.endDate || null;
      if (copy.don_vi && typeof copy.don_vi === 'object' && !('department' in copy)) {
        copy.department = copy.don_vi;
      }
      if (copy.don_vi_id !== undefined && copy.departmentId === undefined) {
        copy.departmentId = copy.don_vi_id;
      }
    }

    // 2. Chuẩn hóa Đối tượng Khoa / Phòng ban (Department)
    if ('ten_phong_ban' in copy || 'loai_don_vi' in copy || 'don_vi_cha_id' in copy) {
      copy.name = copy.ten_phong_ban || copy.name || '';
      copy.ten_phong_ban = copy.name;
      copy.type = copy.loai_don_vi || copy.type || 'phong_ban';
      copy.loai_don_vi = copy.type;
      copy.parentId = copy.don_vi_cha && typeof copy.don_vi_cha === 'object'
        ? copy.don_vi_cha
        : (copy.don_vi_cha_id !== undefined ? copy.don_vi_cha_id : copy.parentId);
      copy.don_vi_cha_id = copy.don_vi_cha_id !== undefined ? copy.don_vi_cha_id : copy.parentId;
      copy.managerId = copy.truong_don_vi && typeof copy.truong_don_vi === 'object'
        ? copy.truong_don_vi
        : (copy.truong_don_vi_id !== undefined ? copy.truong_don_vi_id : copy.managerId);
      copy.truong_don_vi_id = copy.truong_don_vi_id !== undefined ? copy.truong_don_vi_id : copy.managerId;
      copy.radiusMeters = copy.ban_kinh_met !== undefined ? copy.ban_kinh_met : copy.radiusMeters;
      copy.ban_kinh_met = copy.radiusMeters;

      if (copy.vi_do !== undefined && copy.latitude === undefined) copy.latitude = Number(copy.vi_do);
      if (copy.kinh_do !== undefined && copy.longitude === undefined) copy.longitude = Number(copy.kinh_do);
      if (copy.so_luong_thanh_vien !== undefined && copy.memberCount === undefined) copy.memberCount = copy.so_luong_thanh_vien;
      if (copy.so_luong_mon_hoc !== undefined && copy.subjectCount === undefined) copy.subjectCount = copy.so_luong_mon_hoc;
      if (copy.truong_don_vi && !('manager' in copy)) copy.manager = copy.truong_don_vi;
      if (copy.don_vi_cha && !('parent' in copy)) copy.parent = copy.don_vi_cha;

      if (copy.toa_do && typeof copy.toa_do === 'object') {
        copy.latitude = copy.toa_do.vi_do !== undefined ? copy.toa_do.vi_do : copy.latitude;
        copy.longitude = copy.toa_do.kinh_do !== undefined ? copy.toa_do.kinh_do : copy.longitude;
        copy.location = {
          lat: copy.latitude,
          lng: copy.longitude,
          latitude: copy.latitude,
          longitude: copy.longitude,
        };
      }
    }

    // 3. Chuẩn hóa Đối tượng Ca làm việc (Shift)
    if ('ten_ca' in copy || 'nguong_di_muon_phut' in copy) {
      copy.name = copy.ten_ca || copy.name || '';
      copy.ten_ca = copy.name;
      copy.startTime = copy.gio_bat_dau || copy.startTime || '';
      copy.gio_bat_dau = copy.startTime;
      copy.endTime = copy.gio_ket_thuc || copy.endTime || '';
      copy.gio_ket_thuc = copy.endTime;
      copy.lateThresholdMinutes = copy.nguong_di_muon_phut !== undefined ? copy.nguong_di_muon_phut : copy.lateThresholdMinutes;
      copy.nguong_di_muon_phut = copy.lateThresholdMinutes;
      copy.isActive = copy.kich_hoat !== undefined ? copy.kich_hoat : (copy.isActive !== undefined ? copy.isActive : true);
      copy.kich_hoat = copy.isActive;
    }

    // 4. Chuẩn hóa Đối tượng Môn học (Subject)
    if ('ten_mon' in copy || 'ma_mon' in copy) {
      copy.name = copy.ten_mon || copy.name || '';
      copy.ten_mon = copy.name;
      copy.code = copy.ma_mon || copy.code || '';
      copy.ma_mon = copy.code;
      copy.credits = copy.so_tin_chi !== undefined ? copy.so_tin_chi : copy.credits;
      copy.so_tin_chi = copy.credits;
      copy.departmentId = copy.phong_ban && typeof copy.phong_ban === 'object'
        ? copy.phong_ban
        : (copy.phong_ban_id !== undefined ? copy.phong_ban_id : copy.departmentId);
      copy.phong_ban_id = copy.phong_ban_id !== undefined ? copy.phong_ban_id : copy.departmentId;
      copy.description = copy.mo_ta || copy.description || '';
      copy.mo_ta = copy.description;
      copy.isActive = copy.kich_hoat !== undefined ? copy.kich_hoat : (copy.isActive !== undefined ? copy.isActive : true);
      copy.kich_hoat = copy.isActive;
    }

    // 5. Chuẩn hóa Đối tượng Thời khóa biểu (Schedule)
    if ('thu_trong_tuan' in copy || 'phong_hoc' in copy || 'tiet_bat_dau' in copy) {
      copy.roomId = copy.phong_hoc || copy.roomId || '';
      copy.phong_hoc = copy.roomId;
      copy.weekday = copy.thu_trong_tuan !== undefined ? copy.thu_trong_tuan : copy.weekday;
      copy.thu_trong_tuan = copy.weekday;
      copy.startTime = copy.gio_bat_dau || copy.startTime || '';
      copy.gio_bat_dau = copy.startTime;
      copy.endTime = copy.gio_ket_thuc || copy.endTime || '';
      copy.gio_ket_thuc = copy.endTime;
      copy.subjectId = copy.mon_hoc && typeof copy.mon_hoc === 'object'
        ? copy.mon_hoc
        : (copy.mon_hoc_id !== undefined ? copy.mon_hoc_id : copy.subjectId);
      copy.mon_hoc_id = copy.mon_hoc_id !== undefined ? copy.mon_hoc_id : copy.subjectId;
      copy.shiftId = copy.ca && typeof copy.ca === 'object'
        ? copy.ca
        : (copy.ca_id !== undefined ? copy.ca_id : copy.shiftId);
      copy.ca_id = copy.ca_id !== undefined ? copy.ca_id : copy.shiftId;
      if (copy.nguoi_dung && !('user' in copy)) copy.user = copy.nguoi_dung;
      if (copy.ca && !('shift' in copy)) copy.shift = copy.ca;
      if (copy.lich_trinh && !('schedule' in copy)) copy.schedule = copy.lich_trinh;
      if (copy.don_tu && !('leaveRequest' in copy)) copy.leaveRequest = copy.don_tu;
      if (Array.isArray(copy.luot_quet) && !('punches' in copy)) copy.punches = copy.luot_quet;
      copy.userId = copy.giang_vien && typeof copy.giang_vien === 'object'
        ? copy.giang_vien
        : copy.nguoi_dung && typeof copy.nguoi_dung === 'object'
          ? copy.nguoi_dung
          : (copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId);
      copy.nguoi_dung_id = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.startPeriod = copy.tiet_bat_dau !== undefined ? copy.tiet_bat_dau : copy.startPeriod;
      copy.tiet_bat_dau = copy.startPeriod;
      copy.periodCount = copy.so_tiet !== undefined ? copy.so_tiet : copy.periodCount;
      copy.so_tiet = copy.periodCount;
      copy.isRecurring = copy.lap_lai_hang_tuan !== undefined ? copy.lap_lai_hang_tuan : (copy.isRecurring !== undefined ? copy.isRecurring : true);
      copy.lap_lai_hang_tuan = copy.isRecurring;
      copy.startDate = copy.ngay_bat_dau || copy.startDate || '';
      copy.ngay_bat_dau = copy.startDate;
      copy.endDate = copy.ngay_ket_thuc || copy.endDate || '';
      copy.ngay_ket_thuc = copy.endDate;
      copy.exceptions = copy.ngoai_le || copy.exceptions || [];
      copy.ngoai_le = copy.exceptions;
      copy.scheduleType = copy.loai_lich || copy.scheduleType || 'chinh_khoa';
      copy.loai_lich = copy.scheduleType;
      copy.academicYear = copy.nam_hoc || copy.academicYear || '';
      copy.semester = copy.hoc_ky !== undefined ? Number(copy.hoc_ky) : copy.semester;
      if (copy.vi_do !== undefined && copy.vi_do !== null && copy.latitude === undefined) copy.latitude = Number(copy.vi_do);
      if (copy.kinh_do !== undefined && copy.kinh_do !== null && copy.longitude === undefined) copy.longitude = Number(copy.kinh_do);
      if (copy.ban_kinh_met !== undefined && copy.radiusMeters === undefined) copy.radiusMeters = Number(copy.ban_kinh_met);
      if (copy.giang_vien && !('user' in copy)) copy.user = copy.giang_vien;
      if (copy.ca && !('shift' in copy)) copy.shift = copy.ca;
      if (copy.mon_hoc && !('subject' in copy)) copy.subject = copy.mon_hoc;
      if (Array.isArray(copy.tuan_hoc) && !('weeks' in copy)) {
        copy.weeks = copy.tuan_hoc.map((w: any) => (typeof w === 'object' ? w.tuan_thu : w));
      }
      if (!Array.isArray(copy.weekNumbers)) {
        if (Array.isArray(copy.danh_sach_tuan)) {
          copy.weekNumbers = copy.danh_sach_tuan;
        } else if (Array.isArray(copy.weeks)) {
          copy.weekNumbers = copy.weeks;
        }
      }
    }

    // 5.1. Chuẩn hóa Ngoại lệ lịch trình (NgoaiLeLichTrinh)
    if ('lich_trinh_id' in copy && 'ngay' in copy) {
      copy.date = copy.ngay || copy.date || '';
      copy.status = copy.trang_thai || copy.status || 'nghi';
      copy.reason = copy.ly_do ?? copy.reason ?? '';
      copy.makeupDate = copy.ngay_day_bu || copy.makeupDate || null;
    }

    // 6. Chuẩn hóa Đối tượng Đơn nghỉ phép (LeaveRequest)
    if ('loai_don' in copy || 'ly_do' in copy || 'so_cap_duyet' in copy) {
      copy.type = copy.loai_don || copy.type || 'nghi_phep';
      copy.loai_don = copy.type;
      copy.reason = copy.ly_do || copy.reason || '';
      copy.ly_do = copy.reason;
      copy.status = copy.trang_thai || copy.status || 'pending';
      copy.trang_thai = copy.status;
      copy.startDate = copy.ngay_bat_dau || copy.startDate || '';
      copy.ngay_bat_dau = copy.startDate;
      copy.endDate = copy.ngay_ket_thuc || copy.endDate || '';
      copy.ngay_ket_thuc = copy.endDate;
      copy.isHalfDay = copy.nua_ngay !== undefined
        ? Boolean(copy.nua_ngay)
        : (Number(copy.so_ngay ?? copy.totalDays) === 0.5 ? true : copy.isHalfDay);
      copy.totalDays = copy.so_ngay !== undefined ? copy.so_ngay : copy.totalDays;
      copy.so_ngay = copy.totalDays;
      copy.userId = copy.nguoi_dung && typeof copy.nguoi_dung === 'object'
        ? copy.nguoi_dung
        : (copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId);
      copy.nguoi_dung_id = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.approverId = copy.nguoi_duyet && typeof copy.nguoi_duyet === 'object'
        ? copy.nguoi_duyet
        : (copy.nguoi_duyet_id !== undefined ? copy.nguoi_duyet_id : copy.approverId);
      copy.nguoi_duyet_id = copy.nguoi_duyet_id !== undefined ? copy.nguoi_duyet_id : copy.approverId;
      copy.approvedBy = copy.nguoi_duyet || copy.approvedBy || null;
      copy.approverComment = copy.ghi_chu_duyet || copy.approverComment || '';
      copy.approvalNote = copy.ghi_chu_duyet || copy.approvalNote || '';
      copy.ghi_chu_duyet = copy.approverComment;
      copy.rejectionReason = copy.ly_do_tu_choi || copy.rejectionReason || '';
      copy.scheduleId = copy.lich_trinh && typeof copy.lich_trinh === 'object'
        ? copy.lich_trinh
        : (copy.lich_trinh_id !== undefined ? copy.lich_trinh_id : copy.scheduleId);
      copy.makeupDate = copy.ngay_day_bu || copy.makeupDate || null;
      copy.attachmentUrl = copy.tep_dinh_kem || copy.attachmentUrl || null;
      copy.leavePeriods = copy.so_tiet_nghi !== undefined ? copy.so_tiet_nghi : copy.leavePeriods;
      copy.substituteShiftId = copy.ca_thay_the || copy.ca_thay_the_id || copy.substituteShiftId || null;
      copy.substituteTeacherId = copy.giang_vien_day_thay || copy.giang_vien_day_thay_id || copy.substituteTeacherId || null;
      copy.approvedAt = copy.thoi_gian_duyet || copy.approvedAt || null;
      copy.createdAt = copy.tao_luc || copy.createdAt || null;
      copy.updatedAt = copy.cap_nhat_luc || copy.updatedAt || null;
      if (copy.nguoi_dung && !('user' in copy)) copy.user = copy.nguoi_dung;
      if (copy.nguoi_duyet && !('approver' in copy)) copy.approver = copy.nguoi_duyet;
      if (copy.lich_trinh && !('schedule' in copy)) copy.schedule = copy.lich_trinh;
      if (Array.isArray(copy.lich_su_duyet) && !('approvalHistory' in copy)) copy.approvalHistory = copy.lich_su_duyet;
      if (copy.cap_duyet_hien_tai !== undefined && copy.currentApprovalLevel === undefined) copy.currentApprovalLevel = copy.cap_duyet_hien_tai;
      if (copy.so_cap_duyet !== undefined && copy.totalApprovalLevels === undefined) copy.totalApprovalLevels = copy.so_cap_duyet;
    }

    // 6.2. Chuẩn hóa Lịch sử duyệt đơn (LichSuDuyetDon)
    if ('cap_duyet' in copy && ('y_kien' in copy || 'thoi_diem' in copy || 'hanh_dong' in copy)) {
      copy.level = copy.cap_duyet;
      copy.action = copy.hanh_dong || copy.action || '';
      copy.comment = copy.y_kien || copy.comment || '';
      copy.timestamp = copy.thoi_diem || copy.timestamp || '';
      if (copy.nguoi_duyet && !('approver' in copy)) copy.approver = copy.nguoi_duyet;
    }

    // 6.1. Chuẩn hóa Đối tượng Số dư phép (LeaveBalance)
    if ('han_muc_phep_nam' in copy || 'so_ngay_da_nghi' in copy || 'so_ngay_kha_dung' in copy) {
      copy.annualLeaveQuota = copy.han_muc_phep_nam !== undefined ? copy.han_muc_phep_nam : copy.annualLeaveQuota;
      copy.han_muc_phep_nam = copy.annualLeaveQuota;
      copy.daysUsed = copy.so_ngay_da_nghi !== undefined ? copy.so_ngay_da_nghi : copy.daysUsed;
      copy.so_ngay_da_nghi = copy.daysUsed;
      copy.pendingAnnualLeaveDays = copy.so_ngay_cho_duyet !== undefined ? copy.so_ngay_cho_duyet : copy.pendingAnnualLeaveDays;
      copy.so_ngay_cho_duyet = copy.pendingAnnualLeaveDays;
      copy.remainingDays = copy.so_ngay_con_lai !== undefined ? copy.so_ngay_con_lai : copy.remainingDays;
      copy.so_ngay_con_lai = copy.remainingDays;
      copy.availableDays = copy.so_ngay_kha_dung !== undefined ? copy.so_ngay_kha_dung : (copy.availableDays !== undefined ? copy.availableDays : copy.remainingDays);
      copy.so_ngay_kha_dung = copy.availableDays;
      copy.year = copy.nam !== undefined ? copy.nam : copy.year;
      copy.nam = copy.year;
      copy.isAdmin = copy.is_admin !== undefined ? copy.is_admin : copy.isAdmin;
      copy.is_admin = copy.isAdmin;
    }

    // 7. Chuẩn hóa Đối tượng Chấm công (AttendanceLog)
    if ('ngay_cong' in copy || 'khoa_cong' in copy || 'thoi_luong_lam_viec_phut' in copy) {
      copy.workDate = copy.ngay_cong || copy.workDate || '';
      copy.date = copy.workDate;
      copy.ngay_cong = copy.workDate;
      copy.checkInTime = copy.thoi_gian_vao || copy.checkInTime || null;
      copy.thoi_gian_vao = copy.checkInTime;
      copy.checkOutTime = copy.thoi_gian_ra || copy.checkOutTime || null;
      copy.thoi_gian_ra = copy.checkOutTime;
      copy.status = copy.trang_thai || copy.status || 'on_time';
      copy.trang_thai = copy.status;
      copy.lateMinutes = copy.di_muon_phut !== undefined ? copy.di_muon_phut : copy.lateMinutes;
      copy.di_muon_phut = copy.lateMinutes;
      copy.earlyExitMinutes = copy.ve_som_phut !== undefined ? copy.ve_som_phut : copy.earlyExitMinutes;
      copy.earlyMinutes = copy.earlyExitMinutes;
      copy.ve_som_phut = copy.earlyExitMinutes;
      copy.workDurationMinutes = copy.thoi_luong_lam_viec_phut !== undefined
        ? Number(copy.thoi_luong_lam_viec_phut)
        : copy.workDurationMinutes;
      copy.workHours = copy.so_gio_cong !== undefined
        ? Number(copy.so_gio_cong)
        : (copy.workDurationMinutes !== undefined
          ? Number((Number(copy.workDurationMinutes) / 60).toFixed(2))
          : copy.workHours);
      copy.userId = copy.nguoi_dung && typeof copy.nguoi_dung === 'object'
        ? copy.nguoi_dung
        : (copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId);
      copy.nguoi_dung_id = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.shiftId = copy.ca && typeof copy.ca === 'object'
        ? copy.ca
        : (copy.ca_id !== undefined ? copy.ca_id : copy.shiftId);
      copy.ca_id = copy.ca_id !== undefined ? copy.ca_id : copy.shiftId;
      copy.scheduleId = copy.lich_trinh && typeof copy.lich_trinh === 'object'
        ? copy.lich_trinh
        : (copy.lich_trinh_id !== undefined ? copy.lich_trinh_id : copy.scheduleId);
      copy.actualTeachingPeriods = copy.so_tiet_thuc_day !== undefined ? copy.so_tiet_thuc_day : copy.actualTeachingPeriods;
      copy.isClosed = copy.da_chot !== undefined ? Boolean(copy.da_chot) : copy.isClosed;
      copy.overrideBy = copy.nguoi_ghi_de || copy.nguoi_ghi_de_id || copy.overrideBy || null;
      copy.isManualOverride = copy.isManualOverride !== undefined ? Boolean(copy.isManualOverride) : Boolean(copy.overrideBy);
      copy.fraudReason = copy.ly_do_ghi_de || copy.fraudReason || '';
      copy.isFraud = copy.co_gian_lan !== undefined ? Boolean(copy.co_gian_lan) : Boolean(copy.isFraud);
      copy.leaveRequestId = copy.don_tu && typeof copy.don_tu === 'object'
        ? copy.don_tu
        : (copy.don_tu_id !== undefined ? copy.don_tu_id : copy.leaveRequestId);
      if (copy.nguoi_dung && !('user' in copy)) copy.user = copy.nguoi_dung;
      if (copy.ca && !('shift' in copy)) copy.shift = copy.ca;
      if (copy.lich_trinh && !('schedule' in copy)) copy.schedule = copy.lich_trinh;
      if (copy.don_tu && !('leaveRequest' in copy)) copy.leaveRequest = copy.don_tu;
      if (Array.isArray(copy.luot_quet) && !('punches' in copy)) {
        copy.punches = copy.luot_quet;
      }
      if (Array.isArray(copy.luot_quet) && !('punchLogIds' in copy)) {
        copy.punchLogIds = copy.luot_quet;
      }
      if (!copy.method && Array.isArray(copy.luot_quet) && copy.luot_quet.length > 0) {
        const firstPunch = copy.luot_quet.find((p: any) => p?.phuong_thuc || p?.method) || copy.luot_quet[0];
        if (firstPunch?.phuong_thuc || firstPunch?.method) {
          copy.method = firstPunch.phuong_thuc || firstPunch.method;
        }
      }
      if (!copy.capturedImage && Array.isArray(copy.luot_quet)) {
        const photoPunch = copy.luot_quet.find((p: any) => p?.anh_minh_chung);
        if (photoPunch) copy.capturedImage = photoPunch.anh_minh_chung;
      }
    }

    // 7.1. Chuẩn hóa Đối tượng Lượt quét thô (LuotQuetChamCong)
    if ('loai_quet' in copy || 'thoi_gian_quet' in copy) {
      copy.punchType = copy.loai_quet || copy.punchType || 'check_in';
      copy.punchTime = copy.thoi_gian_quet || copy.punchTime || '';
      copy.method = copy.phuong_thuc || copy.method || 'face_ai';
      copy.confidenceScore = copy.do_tin_cay_ai !== undefined ? copy.do_tin_cay_ai : copy.confidenceScore;
      copy.livenessScore = copy.diem_mat_that !== undefined ? copy.diem_mat_that : copy.livenessScore;
      copy.recognizedAngle = copy.goc_mat_nhan_dien || copy.recognizedAngle || null;
      copy.latitude = copy.vi_do !== undefined && copy.vi_do !== null ? Number(copy.vi_do) : copy.latitude;
      copy.longitude = copy.kinh_do !== undefined && copy.kinh_do !== null ? Number(copy.kinh_do) : copy.longitude;
      copy.gpsAccuracy = copy.do_chinh_xac_gps !== undefined ? copy.do_chinh_xac_gps : copy.gpsAccuracy;
      copy.isMockLocation = copy.vi_tri_gia_lap !== undefined ? Boolean(copy.vi_tri_gia_lap) : copy.isMockLocation;
      copy.distanceMeters = copy.khoang_cach_met !== undefined ? copy.khoang_cach_met : copy.distanceMeters;
      copy.isValid = copy.hop_le !== undefined ? Boolean(copy.hop_le) : copy.isValid;
      copy.invalidReason = copy.ly_do_khong_hop_le || copy.invalidReason || null;
      copy.deviceId = copy.ma_thiet_bi || copy.deviceId || null;
      copy.evidencePhoto = copy.anh_minh_chung || copy.evidencePhoto || null;
    }

    // 8. Chuẩn hóa Đối tượng Phiếu lương (Payroll)
    if (!('tong_ban_ghi' in copy) && ('thuc_linh_net' in copy || 'tong_thu_nhap_gross' in copy || ('thang' in copy && 'nam' in copy))) {
      copy.month = copy.thang !== undefined ? copy.thang : copy.month;
      copy.thang = copy.month;
      copy.year = copy.nam !== undefined ? copy.nam : copy.year;
      copy.nam = copy.year;
      copy.salaryCoefficient = copy.he_so_luong !== undefined ? Number(copy.he_so_luong) : copy.salaryCoefficient;
      copy.baseSalary = copy.luong_co_ban !== undefined
        ? Number(copy.luong_co_ban)
        : (copy.luong_co_so !== undefined ? Number(copy.luong_co_so) : copy.baseSalary);
      copy.primarySalary = copy.luong_chinh !== undefined
        ? Number(copy.luong_chinh)
        : copy.primarySalary;
      copy.positionAllowance = copy.phu_cap_chuc_vu !== undefined ? Number(copy.phu_cap_chuc_vu) : copy.positionAllowance;
      copy.seniorityAllowance = copy.phu_cap_tham_nien !== undefined ? Number(copy.phu_cap_tham_nien) : copy.seniorityAllowance;
      copy.vocationalAllowance = copy.phu_cap_uu_dai_nghe !== undefined ? Number(copy.phu_cap_uu_dai_nghe) : copy.vocationalAllowance;
      copy.netSalary = copy.thuc_linh_net !== undefined
        ? Number(copy.thuc_linh_net)
        : (copy.thuc_linh !== undefined ? Number(copy.thuc_linh) : copy.netSalary);
      copy.thuc_linh_net = copy.netSalary;
      copy.grossIncome = copy.tong_thu_nhap_gross !== undefined
        ? Number(copy.tong_thu_nhap_gross)
        : (copy.grossIncome !== undefined ? copy.grossIncome : copy.grossSalary);
      copy.grossSalary = copy.grossIncome;
      copy.tong_thu_nhap_gross = copy.grossIncome;
      copy.luong_chinh = copy.primarySalary;
      copy.userId = copy.nguoi_dung && typeof copy.nguoi_dung === 'object'
        ? copy.nguoi_dung
        : (copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId);
      copy.nguoi_dung_id = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.status = copy.trang_thai || copy.status || 'nhap';
      copy.trang_thai = copy.status;
      copy.standardWorkDays = copy.so_cong_chuan !== undefined ? Number(copy.so_cong_chuan) : copy.standardWorkDays;
      copy.actualWorkDays = copy.so_cong_thuc_te !== undefined ? Number(copy.so_cong_thuc_te) : copy.actualWorkDays;
      copy.totalDeductions = copy.tong_giam_tru !== undefined ? Number(copy.tong_giam_tru) : copy.totalDeductions;
      copy.approvedAt = copy.thoi_gian_duyet || copy.approvedAt || null;
      copy.notes = copy.ghi_chu ?? copy.notes;
      copy.createdAt = copy.tao_luc || copy.createdAt || null;
      copy.updatedAt = copy.cap_nhat_luc || copy.updatedAt || null;
      if (copy.gio_giang && typeof copy.gio_giang === 'object' && !('teachingHours' in copy)) {
        copy.teachingHours = {
          baseQuota: Number(copy.gio_giang.dinh_muc_goc ?? 0),
          accumulatedStandardHours: Number(copy.gio_giang.gio_quy_doi_tich_luy ?? 0),
          overQuotaHours: Number(copy.gio_giang.gio_vuot_dinh_muc ?? 0),
          hourlyRate: Number(copy.gio_giang.don_gia_gio_chuan ?? 0),
          overQuotaRemuneration: Number(copy.gio_giang.thu_lao_vuot_gio ?? 0),
        };
      }
      if (copy.bao_hiem && !('insurance' in copy)) copy.insurance = copy.bao_hiem;
      if (copy.thue_tncn && !('personalIncomeTax' in copy)) copy.personalIncomeTax = copy.thue_tncn;
      if (copy.nguoi_dung && !('user' in copy)) copy.user = copy.nguoi_dung;
      if (copy.nguoi_lap && !('createdByUser' in copy)) copy.createdByUser = copy.nguoi_lap;
      if (copy.nguoi_duyet && !('approvedByUser' in copy)) copy.approvedByUser = copy.nguoi_duyet;
      if (Array.isArray(copy.danh_sach_phu_cap) && !('allowances' in copy)) copy.allowances = copy.danh_sach_phu_cap;
      if (Array.isArray(copy.cac_khoan_giam_tru) && !('deductions' in copy)) copy.deductions = copy.cac_khoan_giam_tru;
    }

    // 9. Chuẩn hóa Đối tượng Ngày nghỉ lễ (Holiday)
    if ('ten_ngay_le' in copy || 'huong_luong' in copy) {
      copy.name = copy.ten_ngay_le || copy.name || '';
      copy.ten_ngay_le = copy.name;
      copy.startDate = copy.ngay_bat_dau || copy.startDate || '';
      copy.ngay_bat_dau = copy.startDate;
      copy.endDate = copy.ngay_ket_thuc || copy.endDate || '';
      copy.ngay_ket_thuc = copy.endDate;
      copy.year = copy.nam !== undefined ? copy.nam : copy.year;
      copy.nam = copy.year;
      copy.isPaid = copy.huong_luong !== undefined ? copy.huong_luong : (copy.isPaid !== undefined ? copy.isPaid : true);
      copy.huong_luong = copy.isPaid;
      copy.description = copy.mo_ta !== undefined ? copy.mo_ta : copy.description;
      copy.mo_ta = copy.description;
      copy.createdBy = copy.nguoi_tao_id !== undefined ? copy.nguoi_tao_id : copy.createdBy;
      copy.nguoi_tao_id = copy.createdBy;
    }

    // 10. Chuẩn hóa Đối tượng Nhật ký kiểm toán (AuditLog)
    if (!('cap_duyet' in copy) && ('hanh_dong' in copy || 'loai_doi_tuong' in copy || 'ma_bam_hien_tai' in copy)) {
      copy.action = copy.hanh_dong || copy.action || '';
      copy.hanh_dong = copy.action;
      copy.targetType = copy.loai_doi_tuong || copy.targetType || '';
      copy.loai_doi_tuong = copy.targetType;
      copy.targetId = copy.doi_tuong_id || copy.targetId || '';
      copy.doi_tuong_id = copy.targetId;
      if (copy.nguoi_thuc_hien && typeof copy.nguoi_thuc_hien === 'object') {
        copy.actor = copy.nguoi_thuc_hien;
      } else if (copy.nguoi_thuc_hien_id && typeof copy.nguoi_thuc_hien_id === 'object') {
        copy.actor = copy.nguoi_thuc_hien_id;
      } else if (!copy.actor || typeof copy.actor !== 'object') {
        copy.actor = copy.nguoi_thuc_hien_id !== undefined ? copy.nguoi_thuc_hien_id : copy.actor;
      }
      copy.actorType = copy.loai_chu_the || copy.actorType || 'user';
      copy.loai_chu_the = copy.actorType;
      copy.ipAddress = copy.dia_chi_ip || copy.ipAddress || null;
      copy.dia_chi_ip = copy.ipAddress;
      copy.userAgent = copy.user_agent || copy.thong_tin_trinh_duyet || copy.userAgent || null;
      copy.thong_tin_trinh_duyet = copy.userAgent;
      copy.failureReason = copy.ly_do_that_bai || copy.failureReason || null;
      copy.status = copy.ket_qua || copy.status || 'success';
      copy.ket_qua = copy.status;
      copy.timestamp = copy.thoi_diem || copy.timestamp || copy.tao_luc || '';
      copy.thoi_diem = copy.timestamp;
      copy.details = copy.chi_tiet !== undefined ? copy.chi_tiet : copy.details;
      copy.chi_tiet = copy.details;
      copy.previousHash = copy.ma_bam_truoc || copy.previousHash || null;
      copy.ma_bam_truoc = copy.previousHash;
      copy.currentHash = copy.ma_bam_hien_tai || copy.currentHash || null;
      copy.ma_bam_hien_tai = copy.currentHash;
    }

    // 11. Chuẩn hóa Đối tượng Cấu hình hệ thống (SystemConfig)
    if ('khoa_cau_hinh' in copy || 'gia_tri' in copy) {
      copy.key = copy.khoa_cau_hinh || copy.key || '';
      copy.khoa_cau_hinh = copy.key;
      copy.value = copy.gia_tri !== undefined ? copy.gia_tri : copy.value;
      copy.gia_tri = copy.value;
      copy.group = copy.nhom || copy.group || '';
      copy.nhom = copy.group;
      copy.description = copy.mo_ta !== undefined ? copy.mo_ta : copy.description;
      copy.mo_ta = copy.description;
      copy.updatedBy = copy.nguoi_cap_nhat_id !== undefined ? copy.nguoi_cap_nhat_id : copy.updatedBy;
      copy.nguoi_cap_nhat_id = copy.updatedBy;
    }

    // Đệ quy chuẩn hóa các thuộc tính con
    for (const key of Object.keys(copy)) {
      if (typeof copy[key] === 'object' && copy[key] !== null) {
        copy[key] = normalizeBackendData(copy[key]);
      }
    }

    return copy as T;
  }

  return data;
}

/**
 * Chuẩn hóa Payload gửi từ Frontend lên Backend (Request Mapper)
 * Đảm bảo mọi key gửi đi HTTP chỉ sử dụng tên trường tiếng Việt chuẩn CSDL v2.5 (xóa các key tiếng Anh dư thừa)
 */
export function normalizeFrontendPayload(payload: any): any {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload instanceof FormData) {
    return payload;
  }

  const keyMap: Array<[string, string]> = [
    // Auth
    ['password', 'mat_khau'],
    ['currentPassword', 'mat_khau_hien_tai'],
    ['newPassword', 'mat_khau_moi'],
    ['refreshToken', 'ma_lam_moi'],
    ['otp', 'ma_otp'],
    ['avatarBase64', 'anh_dai_dien_base64'],
    // User
    ['fullName', 'ho_ten'],
    ['staffCode', 'ma_can_bo'],
    ['phoneNumber', 'so_dien_thoai'],
    ['departmentId', 'don_vi_chinh_id'],
    ['role', 'vai_tro_chinh'],
    ['primaryRole', 'vai_tro_chinh'],
    ['roles', 'danh_sach_vai_tro'],
    ['isActive', 'kich_hoat'],
    ['avatar', 'anh_dai_dien'],
    ['position', 'chuc_vu'],
    ['academicRank', 'hoc_ham'],
    ['degree', 'hoc_vi'],
    ['staffType', 'loai_nhan_su'],
    ['contractType', 'loai_hop_dong'],
    ['employmentStatus', 'trang_thai_lam_viec'],
    ['salaryScale', 'ngach_luong'],
    ['salaryCoefficient', 'he_so_luong'],
    ['annualLeaveQuota', 'han_muc_phep_nam'],
    ['dependentsCount', 'so_nguoi_phu_thuoc'],
    ['dateOfBirth', 'ngay_sinh'],
    ['startDate', 'ngay_vao_lam'],
    ['address', 'dia_chi'],
    ['gender', 'gioi_tinh'],
    ['bio', 'tieu_su'],
    ['researchInterests', 'huong_nghien_cuu'],
    ['officeRoom', 'phong_lam_viec'],
    ['taughtCourses', 'hoc_phan_giang_day'],
    // Face
    ['faceDescriptor', 'khuon_mat_vector'],
    ['force', 'ghi_de'],
    ['sampleAngles', 'cac_goc_mau'],
    ['aiModel', 'mo_hinh_ai'],
    ['consentAgreed', 'dong_y_thu_thap'],
    ['employeeId', 'ma_can_bo'],
    // Department & Geofence
    ['parentId', 'don_vi_cha_id'],
    ['managerId', 'truong_don_vi_id'],
    ['radiusMeters', 'ban_kinh_met'],
    ['latitude', 'vi_do'],
    ['longitude', 'kinh_do'],
    ['accuracy', 'do_chinh_xac'],
    // Shift / Schedule / Subject / Holiday
    ['startTime', 'gio_bat_dau'],
    ['endTime', 'gio_ket_thuc'],
    ['code', 'ma_mon'],
    ['credits', 'so_tin_chi'],
    ['roomId', 'phong_hoc'],
    ['weekday', 'thu_trong_tuan'],
    ['startPeriod', 'tiet_bat_dau'],
    ['periodCount', 'so_tiet'],
    ['subjectId', 'mon_hoc_id'],
    ['shiftId', 'ca_id'],
    ['userId', 'nguoi_dung_id'],
    ['academicYear', 'nam_hoc'],
    ['semester', 'hoc_ky'],
    ['weekNumbers', 'danh_sach_tuan'],
    ['scheduleType', 'loai_lich'],
    ['endDate', 'ngay_ket_thuc'],
    ['date', 'ngay'],
    ['year', 'nam'],
    ['isPaid', 'huong_luong'],
    ['description', 'mo_ta'],
    // LeaveRequest
    ['reason', 'ly_do'],
    ['totalDays', 'so_ngay'],
    ['approvalNote', 'ghi_chu_duyet'],
    ['rejectionReason', 'ly_do_tu_choi'],
    ['scheduleId', 'lich_trinh_id'],
    ['leavePeriods', 'so_tiet_nghi'],
    ['substituteShiftId', 'ca_thay_the_id'],
    ['substituteTeacherId', 'giang_vien_day_thay_id'],
    ['makeupDate', 'ngay_day_bu'],
    ['attachmentUrl', 'tep_dinh_kem'],
    ['isHalfDay', 'nua_ngay'],
    ['version', 'phien_ban'],
    ['expectedVersion', 'phien_ban'],
    ['status', 'trang_thai'],
    // Attendance / QR / AI
    ['checkInTime', 'thoi_gian_vao'],
    ['checkOutTime', 'thoi_gian_ra'],
    ['leaveRequestId', 'don_tu_id'],
    ['isFraud', 'co_gian_lan'],
    ['fraudReason', 'ly_do_ghi_de'],
    ['attendanceId', 'cham_cong_id'],
    ['deviceId', 'thiet_bi_id'],
    ['method', 'phuong_thuc'],
    ['qrToken', 'ma_qr'],
    ['useQueue', 'dung_hang_doi'],
    ['verifyOnly', 'xac_thuc_chi_xem'],
    ['actionType', 'loai_thao_tac'],
    ['month', 'thang'],
    ['message', 'tin_nhan'],
    ['mode', 'che_do'],
    ['history', 'lich_su'],
    ['provider', 'nha_cung_cap'],
    ['model', 'mo_hinh'],
    ['documentIds', 'danh_sach_tai_lieu_id'],
    ['useRag', 'dung_rag'],
    ['title', 'tieu_de'],
    ['scope', 'pham_vi'],
    // SystemConfig
    ['key', 'khoa_cau_hinh'],
    ['value', 'gia_tri'],
    ['group', 'nhom'],
    ['configs', 'danh_sach_cau_hinh'],
  ];

  const out: Record<string, any> = { ...payload };

  for (const [enKey, viKey] of keyMap) {
    if (enKey in out) {
      if (!(viKey in out)) {
        out[viKey] = out[enKey];
      }
      delete out[enKey];
    }
  }

  if ('location' in out && out.location && typeof out.location === 'object') {
    if (!('toa_do' in out)) {
      out.toa_do = {
        vi_do: out.location.vi_do ?? out.location.lat ?? out.location.latitude,
        kinh_do: out.location.kinh_do ?? out.location.lng ?? out.location.longitude,
      };
    }
    delete out.location;
  }

  if (Array.isArray(out.danh_sach_cau_hinh)) {
    out.danh_sach_cau_hinh = out.danh_sach_cau_hinh.map((item: any) =>
      item && typeof item === 'object' ? normalizeFrontendPayload(item) : item
    );
  }

  return out;
}

/**
 * Chuẩn hóa Query Params gửi từ Frontend lên Backend (Query Mapper)
 */
export function normalizeQueryParams(params: any): any {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return params;
  }

  const out: Record<string, any> = { ...params };
  const queryMap: Array<[string, string]> = [
    ['year', 'nam'],
    ['month', 'thang'],
    ['role', 'vai_tro'],
    ['departmentId', 'don_vi_id'],
    ['userId', 'nguoi_dung_id'],
    ['isActive', 'kich_hoat'],
    ['search', 'tim_kiem'],
    ['keyword', 'tim_kiem'],
    ['page', 'trang'],
    ['limit', 'gioi_han'],
    ['startDate', 'tu_ngay'],
    ['from', 'tu_ngay'],
    ['endDate', 'den_ngay'],
    ['to', 'den_ngay'],
    ['date', 'ngay'],
    ['shiftId', 'ca_id'],
    ['scheduleId', 'lich_trinh_id'],
    ['roomId', 'phong_hoc'],
    ['weekday', 'thu_trong_tuan'],
    ['academicYear', 'nam_hoc'],
    ['semester', 'hoc_ky'],
    ['isFraud', 'co_gian_lan'],
    ['method', 'phuong_thuc'],
    ['status', 'trang_thai'],
    ['action', 'hanh_dong'],
    ['targetType', 'loai_doi_tuong'],
    ['actor', 'nguoi_thuc_hien_id'],
    ['tree', 'cay'],
  ];

  for (const [enKey, viKey] of queryMap) {
    if (enKey in out) {
      if (!(viKey in out)) {
        out[viKey] = out[enKey];
      }
      delete out[enKey];
    }
  }

  return out;
}

