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
      copy.departmentId = copy.don_vi_chinh_id !== undefined ? copy.don_vi_chinh_id : copy.departmentId;
      copy.don_vi_chinh_id = copy.don_vi_chinh_id !== undefined ? copy.don_vi_chinh_id : copy.departmentId;
      copy.isActive = copy.kich_hoat !== undefined ? copy.kich_hoat : (copy.isActive !== undefined ? copy.isActive : true);
      copy.kich_hoat = copy.isActive;
      copy.isFaceRegistered = copy.da_dang_ky_face !== undefined ? copy.da_dang_ky_face : Boolean(copy.isFaceRegistered);
      copy.da_dang_ky_face = copy.isFaceRegistered;
      copy.faceRegisteredAt = copy.ngay_dang_ky_face || copy.faceRegisteredAt || null;
      copy.ngay_dang_ky_face = copy.faceRegisteredAt;
      copy.avatar = copy.anh_dai_dien || copy.avatar || null;
      copy.anh_dai_dien = copy.avatar;
      copy.academicRank = copy.hoc_ham || copy.academicRank || 'khong';
      copy.hoc_ham = copy.academicRank;
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

      if (copy.don_vi_chinh_id && typeof copy.don_vi_chinh_id === 'object') {
        const deptName = copy.don_vi_chinh_id.ten_phong_ban || copy.don_vi_chinh_id.name || '';
        copy.departmentName = copy.ten_phong_ban || deptName || copy.departmentName || '';
        copy.ten_phong_ban = copy.departmentName;
      }
    }

    // 2. Chuẩn hóa Đối tượng Khoa / Phòng ban (Department)
    if ('ten_phong_ban' in copy || 'loai_don_vi' in copy || 'don_vi_cha_id' in copy) {
      copy.name = copy.ten_phong_ban || copy.name || '';
      copy.ten_phong_ban = copy.name;
      copy.type = copy.loai_don_vi || copy.type || 'phong_ban';
      copy.loai_don_vi = copy.type;
      copy.parentId = copy.don_vi_cha_id !== undefined ? copy.don_vi_cha_id : copy.parentId;
      copy.don_vi_cha_id = copy.parentId;
      copy.managerId = copy.truong_don_vi_id !== undefined ? copy.truong_don_vi_id : copy.managerId;
      copy.truong_don_vi_id = copy.managerId;
      copy.radiusMeters = copy.ban_kinh_met !== undefined ? copy.ban_kinh_met : copy.radiusMeters;
      copy.ban_kinh_met = copy.radiusMeters;

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
      copy.departmentId = copy.phong_ban_id !== undefined ? copy.phong_ban_id : copy.departmentId;
      copy.phong_ban_id = copy.departmentId;
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
      copy.subjectId = copy.mon_hoc_id !== undefined ? copy.mon_hoc_id : copy.subjectId;
      copy.mon_hoc_id = copy.subjectId;
      copy.shiftId = copy.ca_id !== undefined ? copy.ca_id : copy.shiftId;
      copy.ca_id = copy.shiftId;
      copy.userId = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.nguoi_dung_id = copy.userId;
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
      copy.totalDays = copy.so_ngay !== undefined ? copy.so_ngay : copy.totalDays;
      copy.so_ngay = copy.totalDays;
      copy.userId = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.nguoi_dung_id = copy.userId;
      copy.approverId = copy.nguoi_duyet_id !== undefined ? copy.nguoi_duyet_id : copy.approverId;
      copy.nguoi_duyet_id = copy.approverId;
      copy.approverComment = copy.ghi_chu_duyet || copy.approverComment || '';
      copy.ghi_chu_duyet = copy.approverComment;
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
      copy.earlyMinutes = copy.ve_som_phut !== undefined ? copy.ve_som_phut : copy.earlyMinutes;
      copy.ve_som_phut = copy.earlyMinutes;
      copy.userId = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.nguoi_dung_id = copy.userId;
      copy.shiftId = copy.ca_id !== undefined ? copy.ca_id : copy.shiftId;
      copy.ca_id = copy.shiftId;
    }

    // 8. Chuẩn hóa Đối tượng Phiếu lương (Payroll)
    if ('thuc_linh_net' in copy || 'tong_thu_nhap_gross' in copy || ('thang' in copy && 'nam' in copy)) {
      copy.month = copy.thang !== undefined ? copy.thang : copy.month;
      copy.thang = copy.month;
      copy.year = copy.nam !== undefined ? copy.nam : copy.year;
      copy.nam = copy.year;
      copy.netSalary = copy.thuc_linh_net !== undefined ? copy.thuc_linh_net : copy.netSalary;
      copy.thuc_linh_net = copy.netSalary;
      copy.grossSalary = copy.tong_thu_nhap_gross !== undefined ? copy.tong_thu_nhap_gross : copy.grossSalary;
      copy.tong_thu_nhap_gross = copy.grossSalary;
      copy.baseSalary = copy.luong_chinh !== undefined ? copy.luong_chinh : copy.baseSalary;
      copy.luong_chinh = copy.baseSalary;
      copy.userId = copy.nguoi_dung_id !== undefined ? copy.nguoi_dung_id : copy.userId;
      copy.nguoi_dung_id = copy.userId;
      copy.status = copy.trang_thai || copy.status || 'draft';
      copy.trang_thai = copy.status;
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
    if ('hanh_dong' in copy || 'loai_doi_tuong' in copy || 'ma_bam_hien_tai' in copy) {
      copy.action = copy.hanh_dong || copy.action || '';
      copy.hanh_dong = copy.action;
      copy.targetType = copy.loai_doi_tuong || copy.targetType || '';
      copy.loai_doi_tuong = copy.targetType;
      copy.targetId = copy.doi_tuong_id || copy.targetId || '';
      copy.doi_tuong_id = copy.targetId;
      copy.actor = copy.nguoi_thuc_hien_id !== undefined ? copy.nguoi_thuc_hien_id : copy.actor;
      copy.nguoi_thuc_hien_id = copy.actor;
      copy.actorType = copy.loai_chu_the || copy.actorType || 'user';
      copy.loai_chu_the = copy.actorType;
      copy.ipAddress = copy.dia_chi_ip || copy.ipAddress || null;
      copy.dia_chi_ip = copy.ipAddress;
      copy.userAgent = copy.thong_tin_trinh_duyet || copy.userAgent || null;
      copy.thong_tin_trinh_duyet = copy.userAgent;
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

