require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import các models chuẩn
const User = require('../models/user.model');
const Department = require('../models/department.model');
const ShiftConfig = require('../models/shiftConfig.model');
const Subject = require('../models/subject.model');
const Schedule = require('../models/schedule.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const AuditLog = require('../models/auditLog.model');
const RefreshToken = require('../models/refreshToken.model');
const FaceTemplate = require('../models/faceTemplate.model');
const Payroll = require('../models/payroll.model');
const Holiday = require('../models/holiday.model');
const SystemConfig = require('../models/systemConfig.model');
const PunchLog = require('../models/punchLog.model');

const connectDB = async () => {
  try {
    const uri = (process.env.SEED_TEST ? process.env.TEST_MONGODB_URI : process.env.MONGODB_URI) || 'mongodb://localhost:27017/DATN_QLNS_ChamCong_FaceRec';
    await mongoose.connect(uri);
    console.log(`[Database] Đã kết nối MongoDB thành công: ${uri}`);
  } catch (error) {
    console.error(`[Lỗi kết nối MongoDB] ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    await connectDB();

    console.log('\n--- 1. BẮT ĐẦU XÓA COLLECTIONS VÀ INDEX CŨ ---');
    const collections = [
      'nguoi_dung',
      'phong_ban',
      'cau_hinh_ca',
      'mon_hoc',
      'lich_trinh',
      'mau_khuon_mat',
      'nhat_ky_cham_cong',
      'luot_quet',
      'don_nghi_phep',
      'nhat_ky_kiem_toan',
      'ma_lam_moi',
      'danh_sach_den_token',
      'ngay_nghi_le',
      'cau_hinh_he_thong',
      'phieu_luong',
      'payrolls',
      'users',
      'departments',
      'shift_configs',
      'subjects',
      'schedules',
      'face_templates',
      'attendance_logs',
      'punch_logs',
      'leave_requests',
      'audit_logs',
      'refresh_tokens',
      'holidays',
      'system_configs',
    ];

    for (const col of collections) {
      try {
        await mongoose.connection.collection(col).drop();
      } catch (err) {
        // Bỏ qua nếu collection chưa tồn tại
      }
    }

    // Đồng bộ lại các index mới chuẩn của models
    await Promise.all([
      User.syncIndexes(),
      Department.syncIndexes(),
      ShiftConfig.syncIndexes(),
      Subject.syncIndexes(),
      Schedule.syncIndexes(),
      AttendanceLog.syncIndexes(),
      LeaveRequest.syncIndexes(),
      AuditLog.syncIndexes(),
      RefreshToken.syncIndexes(),
      FaceTemplate.syncIndexes(),
      Holiday.syncIndexes(),
      SystemConfig.syncIndexes(),
      Payroll.syncIndexes(),
      PunchLog.syncIndexes(),
    ]);

    console.log('✔ Đã làm sạch toàn bộ dữ liệu và đồng bộ lại Indexes chuẩn!');

    console.log('\n--- 2. TẠO CƠ CẤU TỔ CHỨC THEO CHUẨN ĐẠI HỌC (DEPARTMENTS) ---');
    // =========================================================================
    // CẤP CAO NHẤT: Ban Giám Hiệu (Toàn trường)
    // =========================================================================
    const boardOfPresidents = await Department.create({
      name: 'Ban Giám Hiệu',
      type: 'phongban',
      parentId: null,
      location: { lat: 21.028511, lng: 105.854167 },
    });

    // =========================================================================
    // KHỐI QUẢN LÝ & PHÒNG BAN CHỨC NĂNG (type: phongban, parentId: Ban Giám Hiệu)
    // =========================================================================
    const trainingDept = await Department.create({
      name: 'Phòng Đào Tạo',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028612, lng: 105.854278 },
    });

    const hrDept = await Department.create({
      name: 'Phòng Hành Chính - Tổng Hợp',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028713, lng: 105.854389 },
    });

    const studentAffairsDept = await Department.create({
      name: 'Phòng Công Tác Sinh Viên',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028814, lng: 105.854499 },
    });

    const qaTestingDept = await Department.create({
      name: 'Phòng Khảo Thí & Đảm Bảo Chất Lượng',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028915, lng: 105.854501 },
    });

    // =========================================================================
    // KHỐI ĐÀO TẠO: KHOA & BỘ MÔN (type: khoa & bomon)
    // =========================================================================

    // 1. Khoa Công Nghệ Thông Tin & Chuyển Đổi Số
    const itFaculty = await Department.create({
      name: 'Khoa Công Nghệ Thông Tin & Chuyển Đổi Số',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028615, lng: 105.85428 },
    });
    const seDept = await Department.create({
      name: 'Bộ Môn Kỹ Thuật Phần Mềm',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028615, lng: 105.85428 },
    });
    const isDept = await Department.create({
      name: 'Bộ Môn Hệ Thống Thông Tin',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028618, lng: 105.854285 },
    });

    // 2. Khoa Kinh Tế - Quản Trị Kinh Doanh
    const econFaculty = await Department.create({
      name: 'Khoa Kinh Tế - Quản Trị Kinh Doanh',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028715, lng: 105.85439 },
    });
    const accDept = await Department.create({
      name: 'Bộ Môn Kế Toán',
      type: 'bomon',
      parentId: econFaculty._id,
      location: { lat: 21.028715, lng: 105.85439 },
    });
    const baDept = await Department.create({
      name: 'Bộ Môn Quản Trị Kinh Doanh',
      type: 'bomon',
      parentId: econFaculty._id,
      location: { lat: 21.028718, lng: 105.854395 },
    });

    // 3. Khoa Ngôn Ngữ và Văn Hóa Hàn Quốc / Nhật Bản
    const langFaculty = await Department.create({
      name: 'Khoa Ngôn Ngữ và Văn Hóa Hàn Quốc / Nhật Bản',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.02882, lng: 105.85445 },
    });
    const koreanDept = await Department.create({
      name: 'Bộ Môn Ngôn Ngữ & Văn Hóa Hàn Quốc',
      type: 'bomon',
      parentId: langFaculty._id,
      location: { lat: 21.02882, lng: 105.85445 },
    });
    const japaneseDept = await Department.create({
      name: 'Bộ Môn Ngôn Ngữ & Văn Hóa Nhật Bản',
      type: 'bomon',
      parentId: langFaculty._id,
      location: { lat: 21.028825, lng: 105.854455 },
    });

    // 4. Khoa Thiết Kế Mỹ Thuật Ứng Dụng
    const designFaculty = await Department.create({
      name: 'Khoa Thiết Kế Mỹ Thuật Ứng Dụng',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.02893, lng: 105.85455 },
    });
    const graphicDept = await Department.create({
      name: 'Bộ Môn Thiết Kế Đồ Họa',
      type: 'bomon',
      parentId: designFaculty._id,
      location: { lat: 21.02893, lng: 105.85455 },
    });
    const archDept = await Department.create({
      name: 'Bộ Môn Kiến Trúc',
      type: 'bomon',
      parentId: designFaculty._id,
      location: { lat: 21.028935, lng: 105.854555 },
    });

    console.log('✔ Đã tạo đầy đủ 14 đơn vị tổ chức:');
    console.log('  - 1 Ban Giám Hiệu');
    console.log('  - 4 Phòng ban chức năng: Đào tạo, Hành chính - Tổng hợp, Công tác sinh viên, Khảo thí & ĐBCL');
    console.log('  - 4 Khoa đào tạo: CNTT & CĐS, Kinh tế - QTKD, Ngôn ngữ Hàn/Nhật, Thiết kế Mỹ thuật ứng dụng');
    console.log('  - 8 Bộ môn chuyên môn trực thuộc 4 Khoa.');

    console.log('\n--- 3. TẠO TÀI KHOẢN NGƯỜI DÙNG ÁNH XẠ CHỨC DANH (USERS) ---');
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // Hàm tạo vector 512D chuẩn hóa L2 (norm = 1.0) cho InsightFace
    const generateNormalized512Vector = (seed = 1) => {
      const vec = Array.from({ length: 512 }, (_, i) => Math.sin(seed + i * 0.1));
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return vec.map((v) => Number((v / norm).toFixed(6)));
    };

    // =========================================================================
    // 1. NHÓM BAN GIÁM HIỆU & ADMIN QUẢN TRỊ
    // =========================================================================
    // Hiệu Trưởng (Ban Giám Hiệu - Toàn trường)
    const presidentUser = await User.create({
      fullName: 'GS. TS. Nguyễn Văn An (Hiệu Trưởng - BGH)',
      email: 'hieutruong@university.edu.vn',
      passwordHash,
      role: 'bgh',
      departmentId: boardOfPresidents._id,
      annualLeaveQuota: 18,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'BGH', pham_vi: 'TOAN_TRUONG' }],
    });
    boardOfPresidents.managerId = presidentUser._id;
    await boardOfPresidents.save();

    // Admin 1: Chuyên viên IT quản lý server / hệ thống
    const adminUser = await User.create({
      fullName: 'Quản Trị Viên Hệ Thống (Admin IT)',
      email: 'daihocdtd@gmail.com',
      passwordHash,
      role: 'admin',
      departmentId: boardOfPresidents._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'ADMIN', pham_vi: 'TOAN_TRUONG' }],
    });

    // Admin 2: Trưởng phòng Hành chính - Tổng hợp (HR quản lý nhân sự & báo cáo)
    const hrManager = await User.create({
      fullName: 'ThS. Nguyễn Thị Mai (Trưởng Phòng HC-TH)',
      email: 'admin.hr@university.edu.vn',
      passwordHash,
      role: 'admin',
      departmentId: hrDept._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'ADMIN', pham_vi: 'TOAN_TRUONG' }],
    });
    hrDept.managerId = hrManager._id;
    await hrDept.save();

    // =========================================================================
    // 2. NHÓM TRƯỞNG KHOA & PHÓ KHOA ĐƯỢC ỦY QUYỀN
    // =========================================================================
    // Trưởng Khoa CNTT & Chuyển đổi số
    const itDean = await User.create({
      fullName: 'PGS. TS. Lê Hoàng Nam (Trưởng Khoa CNTT & CĐS)',
      email: 'truongkhoa.cntt@university.edu.vn',
      passwordHash,
      role: 'truongkhoa',
      departmentId: itFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'TRUONG_KHOA', pham_vi: 'KHOA', ma_don_vi: itFaculty._id }],
    });
    itFaculty.managerId = itDean._id;
    await itFaculty.save();

    // Phó Trưởng Khoa CNTT (Được ủy quyền duyệt đơn cấp 1)
    const viceDeanIt = await User.create({
      fullName: 'TS. Đặng Tiến Hưng (Phó Trưởng Khoa CNTT - Được Ủy Quyền)',
      email: 'phokhoa.cntt@university.edu.vn',
      passwordHash,
      role: 'phokhoa',
      departmentId: itFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [
        {
          ma_vai_tro: 'PHO_TRUONG_KHOA',
          pham_vi: 'KHOA',
          ma_don_vi: itFaculty._id,
          duoc_uy_quyen: true,
          uy_quyen_den: new Date('2028-12-31'),
        },
      ],
    });

    // Trưởng Khoa Kinh tế - Quản trị kinh doanh
    const econDean = await User.create({
      fullName: 'TS. Phạm Hải Đăng (Trưởng Khoa Kinh Tế - QTKD)',
      email: 'truongkhoa.kinhte@university.edu.vn',
      passwordHash,
      role: 'truongkhoa',
      departmentId: econFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'TRUONG_KHOA', pham_vi: 'KHOA', ma_don_vi: econFaculty._id }],
    });
    econFaculty.managerId = econDean._id;
    await econFaculty.save();

    // =========================================================================
    // 3. NHÓM TRƯỞNG BỘ MÔN
    // =========================================================================
    const headSeDept = await User.create({
      fullName: 'TS. Hoàng Văn Minh (Trưởng Bộ Môn KTPM)',
      email: 'truongbomon.ktpm@university.edu.vn',
      passwordHash,
      role: 'truongbomon',
      departmentId: seDept._id,
      annualLeaveQuota: 13,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'TRUONG_BO_MON', pham_vi: 'BO_MON', ma_don_vi: seDept._id }],
    });
    seDept.managerId = headSeDept._id;
    await seDept.save();

    // =========================================================================
    // 4. NHÓM GIẢNG VIÊN (Chấm công theo Lịch giảng dạy)
    // =========================================================================
    // GV 1: Giảng viên Bộ môn Kỹ thuật phần mềm (Khoa CNTT)
    const lecturerBich = await User.create({
      fullName: 'TS. Trần Thị Bích (Giảng viên KTPM)',
      email: 'giangvien.bich@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: seDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA', ma_don_vi: itFaculty._id }],
    });

    // GV 2: Giảng viên Bộ môn Hệ thống thông tin (Khoa CNTT)
    const lecturerCuong = await User.create({
      fullName: 'ThS. Phạm Văn Cường (Giảng viên HTTT)',
      email: 'giangvien.cuong@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: isDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA', ma_don_vi: itFaculty._id }],
    });

    // GV 3: Giảng viên Bộ môn Kế toán (Khoa Kinh tế)
    const lecturerLinh = await User.create({
      fullName: 'ThS. Hoàng Diệu Linh (Giảng viên Kế Toán)',
      email: 'giangvien.linh@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: accDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA', ma_don_vi: econFaculty._id }],
    });

    // GV 4: Giảng viên Bộ môn Thiết kế đồ họa (Khoa MTUD)
    const lecturerAn = await User.create({
      fullName: 'ThS. Nguyễn Trọng An (Giảng viên Đồ Họa)',
      email: 'giangvien.an@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: graphicDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'GIANG_VIEN', pham_vi: 'KHOA', ma_don_vi: designFaculty._id }],
    });

    // =========================================================================
    // 5. NHÓM CHUYÊN VIÊN HÀNH CHÍNH (Chấm công ca cố định)
    // =========================================================================
    // Chuyên viên Phòng Đào tạo
    const staffHa = await User.create({
      fullName: 'Đỗ Thu Hà (Chuyên viên Phòng Đào Tạo)',
      email: 'nhanvien.ha@university.edu.vn',
      passwordHash,
      role: 'nhanvien',
      departmentId: trainingDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'DAO_TAO', pham_vi: 'TOAN_TRUONG' }],
    });

    // Chuyên viên Phòng Khảo thí
    const staffThanh = await User.create({
      fullName: 'Lê Quang Thành (Chuyên viên Phòng Khảo Thí)',
      email: 'nhanvien.thanh@university.edu.vn',
      passwordHash,
      role: 'nhanvien',
      departmentId: qaTestingDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
      danh_sach_vai_tro: [{ ma_vai_tro: 'KIEM_TOAN', pham_vi: 'TOAN_TRUONG' }],
    });

    // =========================================================================
    // 6. KHỞI TẠO MẪU KHUÔN MẶT ĐA GÓC 512D (FACETEMPLATE - COLLECTION 2)
    // =========================================================================
    const faceUsers = [adminUser, presidentUser, itDean, viceDeanIt, lecturerBich, staffHa];
    const poses = ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'];

    for (let uIdx = 0; uIdx < faceUsers.length; uIdx++) {
      const u = faceUsers[uIdx];
      const descriptors = poses.map((_, pIdx) => generateNormalized512Vector(uIdx * 10 + pIdx + 1));
      const avgVec = generateNormalized512Vector(uIdx * 10 + 99);

      await FaceTemplate.create({
        ma_nguoi_dung: u._id,
        userId: u._id,
        vector_dac_trung: descriptors,
        faceDescriptors: descriptors,
        goc_chup: poses,
        poses: poses,
        vector_trung_binh: avgVec,
        averageEmbedding: avgVec,
        so_luong_anh: 5,
        mo_hinh_ai: 'buffalo_s',
        dieu_khoan_dong_y: true,
        phi_chuan_hoa_l2: true,
      });

      u.isFaceRegistered = true;
      u.da_dang_ky_khuon_mat = true;
      u.faceRegisteredAt = new Date();
      u.ngay_dang_ky_khuon_mat = new Date();
      await u.save();
    }

    console.log('✔ Đã tạo 13 tài khoản người dùng đầy đủ các vai trò đại học:');
    console.log('  - 1 Ban Giám Hiệu (Hiệu trưởng: GS. TS. Nguyễn Văn An)');
    console.log('  - 2 Admin Quản trị (Admin IT & Trưởng phòng HC-TH)');
    console.log('  - 2 Trưởng khoa (CNTT & Kinh tế)');
    console.log('  - 1 Phó trưởng khoa được ủy quyền (TS. Đặng Tiến Hưng)');
    console.log('  - 1 Trưởng bộ môn (TS. Hoàng Văn Minh)');
    console.log('  - 4 Giảng viên (TS. Bích, ThS. Cường, ThS. Linh, ThS. An)');
    console.log('  - 2 Chuyên viên hành chính (Đào tạo & Khảo thí)');
    console.log('  - ✔ Đã nạp dữ liệu sinh trắc học FaceTemplate 512D InsightFace chuẩn 5 góc cho 6 tài khoản nòng cốt.');

    console.log('\n--- 4. TẠO CÁC CA LÀM VIỆC CHUẨN (SHIFT_CONFIGS) ---');
    const shiftMorning = await ShiftConfig.create({
      name: 'Ca Sáng (Tiết 1 - 4)',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftAfternoon = await ShiftConfig.create({
      name: 'Ca Chiều (Tiết 5 - 8)',
      startTime: '12:30',
      endTime: '17:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftEvening = await ShiftConfig.create({
      name: 'Ca Tối (Tiết 9 - 12)',
      startTime: '17:30',
      endTime: '21:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftOffice = await ShiftConfig.create({
      name: 'Ca Hành Chính Cố Định (8h - 17h)',
      startTime: '08:00',
      endTime: '17:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });
    console.log('✔ Đã tạo 4 ca làm việc chuẩn: Sáng (7h-11h30), Chiều (12h30-17h), Tối (17h30-21h), Hành chính (8h-17h).');

    console.log('\n--- 4.1. TẠO DANH MỤC MÔN HỌC CHUẨN (SUBJECTS) ---');
    const subjectWeb = await Subject.create({
      code: 'INT3105',
      name: 'Lập trình Web nâng cao',
      credits: 3,
      departmentId: itFaculty._id,
      description: 'Học phần Lập trình Web chuyên sâu: Node.js, Express, React, TypeScript',
      isActive: true,
    });

    const subjectDB = await Subject.create({
      code: 'INT2204',
      name: 'Cơ sở dữ liệu & Phân tích',
      credits: 3,
      departmentId: isDept._id,
      description: 'Môn học về thiết kế CSDL quan hệ và NoSQL MongoDB',
      isActive: true,
    });

    const subjectArch = await Subject.create({
      code: 'INT2207',
      name: 'Kiến trúc máy tính & Hệ thống',
      credits: 3,
      departmentId: seDept._id,
      description: 'Môn học về kiến trúc máy tính và tổ chức hệ điều hành',
      isActive: true,
    });

    const subjectMicroEco = await Subject.create({
      code: 'ECO1001',
      name: 'Kinh tế vi mô',
      credits: 3,
      departmentId: econFaculty._id,
      description: 'Lý thuyết kinh tế vi mô và phân tích thị trường',
      isActive: true,
    });

    const subjectAccounting = await Subject.create({
      code: 'ACC2001',
      name: 'Nguyên lý kế toán',
      credits: 3,
      departmentId: accDept._id,
      description: 'Khái niệm và phương pháp kế toán tài chính doanh nghiệp',
      isActive: true,
    });

    const subjectGraphicDesign = await Subject.create({
      code: 'DES1001',
      name: 'Thiết kế đồ họa & Giao diện số',
      credits: 3,
      departmentId: itFaculty._id,
      description: 'Môn học UI/UX Design, Figma và đồ họa đa phương tiện',
      isActive: true,
    });

    console.log('✔ Đã tạo 6 môn học chuẩn (INT3105, INT2204, INT2207, ECO1001, ACC2001, DES1001).');

    console.log('\n--- 5. TẠO LỊCH GIẢNG DẠY & LỊCH HÀNH CHÍNH (SCHEDULES) ---');
    const now = new Date();
    const currentWeekday = now.getDay(); // Thứ hôm nay theo giờ máy tính
    const semesterStart = new Date(now.getFullYear(), 0, 15);
    const semesterEnd = new Date(now.getFullYear(), 11, 31);

    // Lịch 1: GV Bích dạy Ca Sáng vào đúng thứ của hôm nay (phục vụ test check-in tức thì)
    const scheduleToday = await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftMorning._id,
      subjectId: subjectWeb._id,
      roomId: 'Giảng đường CNTT A2-301',
      latitude: 21.028511,
      longitude: 105.854167,
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 2: GV Bích dạy thêm Ca Chiều vào hôm nay
    await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftAfternoon._id,
      subjectId: subjectDB._id,
      roomId: 'Phòng máy Lab-02',
      latitude: 21.028612,
      longitude: 105.854278,
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 3: GV Cường dạy Ca Chiều vào Thứ 2 (weekday: 1)
    await Schedule.create({
      userId: lecturerCuong._id,
      shiftId: shiftAfternoon._id,
      subjectId: subjectArch._id,
      roomId: 'Phòng máy Lab-01',
      latitude: 21.028713,
      longitude: 105.854389,
      weekday: 1,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 4: GV Linh dạy Ca Sáng vào Thứ 4 (weekday: 3)
    await Schedule.create({
      userId: lecturerLinh._id,
      shiftId: shiftMorning._id,
      subjectId: subjectMicroEco._id,
      roomId: 'Giảng đường Kinh Tế B1-204',
      latitude: 21.028814,
      longitude: 105.854499,
      weekday: 3,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 5: Chuyên viên Hà (Phòng Đào tạo) làm việc ca Hành chính từ Thứ 2 đến Thứ 6
    for (let wd = 1; wd <= 5; wd++) {
      await Schedule.create({
        userId: staffHa._id,
        shiftId: shiftOffice._id,
        subjectId: null,
        roomId: 'Văn phòng Phòng Đào Tạo A1-102',
        latitude: 21.028612,
        longitude: 105.854278,
        weekday: wd,
        isRecurring: true,
        startDate: semesterStart,
        endDate: semesterEnd,
      });
    }

    // Lịch 6: Chuyên viên Thành (Phòng Khảo thí) làm việc ca Hành chính từ Thứ 2 đến Thứ 6
    for (let wd = 1; wd <= 5; wd++) {
      await Schedule.create({
        userId: staffThanh._id,
        shiftId: shiftOffice._id,
        subjectId: null,
        roomId: 'Văn phòng Khảo Thí & ĐBCL A1-205',
        latitude: 21.028915,
        longitude: 105.854611,
        weekday: wd,
        isRecurring: true,
        startDate: semesterStart,
        endDate: semesterEnd,
      });
    }
    console.log('✔ Đã phân công lịch giảng dạy cho Giảng viên & Lịch ca hành chính cho Chuyên viên.');

    console.log('\n--- 6. TẠO ĐƠN NGHỈ PHÉP MẪU (LEAVE_REQUESTS) ---');
    // Đơn 1: Đã duyệt (APPROVED) 3 ngày của GV Bích (12 - 3 = 9 ngày còn lại)
    const leaveApproved = await LeaveRequest.create({
      userId: lecturerBich._id,
      type: 'nghi_phep',
      reason: 'Đi công tác hội thảo khoa học quốc tế về Công nghệ phần mềm',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 3),
      attachmentUrl: 'https://storage.university.edu.vn/attachments/quyet-dinh-hoi-thao.pdf',
      status: 'APPROVED',
      approvedBy: itDean._id,
    });

    // Đơn 2: Đang chờ duyệt (PENDING) của GV Cường
    await LeaveRequest.create({
      userId: lecturerCuong._id,
      type: 'nghi_phep',
      reason: 'Xin nghỉ phép việc gia đình có việc hiếu',
      startDate: new Date(now.getFullYear(), now.getMonth(), 20),
      endDate: new Date(now.getFullYear(), now.getMonth(), 21),
      attachmentUrl: null,
      status: 'PENDING',
    });

    // Đơn 2: Đang chờ duyệt (PENDING) của Trưởng khoa Nam (để Admin Ban Giám Hiệu kiểm thử duyệt)
    await LeaveRequest.create({
      userId: itDean._id,
      type: 'nghi_phep',
      reason: 'Trưởng khoa tham gia Hội nghị Hiệp hội CNTT Quốc tế',
      startDate: new Date(now.getFullYear(), now.getMonth(), 25),
      endDate: new Date(now.getFullYear(), now.getMonth(), 27),
      attachmentUrl: null,
      status: 'PENDING',
    });
    console.log('✔ Đã tạo 2 đơn nghỉ phép mẫu PENDING (1 của GV Cường cho Trưởng khoa duyệt, 1 của Trưởng khoa cho Admin duyệt). GV Bích nguyên vẹn 12 ngày phép (0 ngày đã dùng).');

    console.log('\n--- 7. TẠO BẢN GHI CHẤM CÔNG MẪU (ATTENDANCE_LOGS) ---');
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(7, 5, 0, 0);

    const yesterdayOut = new Date(yesterday);
    yesterdayOut.setHours(11, 30, 0, 0);

    const yesterdayDateStr = yesterday.toISOString().slice(0, 10);
    const seededLog = await AttendanceLog.create({
      userId: lecturerBich._id,
      shiftId: shiftMorning._id,
      scheduleId: scheduleToday._id,
      workDate: yesterdayDateStr,
      checkInTime: yesterday,
      checkOutTime: yesterdayOut,
      status: 'ON_TIME',
      isManualOverride: false,
    });

    const PunchLog = require('../models/punchLog.model');
    await PunchLog.create([
      {
        cham_cong_id: seededLog._id,
        nguoi_dung_id: lecturerBich._id,
        loai_quet: 'CHECK_IN',
        thoi_gian_quet: yesterday,
        phuong_thuc: 'qr',
        toa_do: { vi_do: 21.028511, kinh_do: 105.854167 },
        ma_thiet_bi: 'MAY_CHAM_CONG_A2',
        co_gian_lan: false,
      },
      {
        cham_cong_id: seededLog._id,
        nguoi_dung_id: lecturerBich._id,
        loai_quet: 'CHECK_OUT',
        thoi_gian_quet: yesterdayOut,
        phuong_thuc: 'qr',
        toa_do: { vi_do: 21.028511, kinh_do: 105.854167 },
        ma_thiet_bi: 'MAY_CHAM_CONG_A2',
        co_gian_lan: false,
      },
    ]);
    console.log('✔ Đã tạo bản ghi chấm công mẫu hôm qua (ĐÚNG GIỜ) và 2 lượt quét luot_quet.');

    console.log('\n--- 8. TẠO NHẬT KÝ KIỂM TOÁN MẪU (AUDIT_LOGS) ---');
    await AuditLog.create({
      actor: itDean._id,
      action: 'APPROVE_LEAVE',
      targetId: leaveApproved._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: '127.0.0.1',
      timestamp: new Date(),
      details: {
        reason: 'Trưởng khoa CNTT duyệt đơn nghỉ phép của GV Bích',
      },
    });
    console.log('✔ Đã tạo bản ghi kiểm toán mẫu cho thao tác của Trưởng Khoa.');

    console.log('\n--- 9. TẠO DANH MỤC NGÀY NGHỈ LỄ NĂM 2026 (HOLIDAYS) ---');
    await Holiday.create([
      {
        ten_ngay_le: 'Tết Dương Lịch 2026',
        ngay_bat_dau: '2026-01-01',
        ngay_ket_thuc: '2026-01-01',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Nghỉ Tết Dương Lịch theo quy định Nhà nước',
        nguoi_tao_id: adminUser._id,
      },
      {
        ten_ngay_le: 'Tết Nguyên Đán Bính Ngọ 2026',
        ngay_bat_dau: '2026-02-15',
        ngay_ket_thuc: '2026-02-23',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Kỳ nghỉ Tết Âm lịch Bính Ngọ (9 ngày)',
        nguoi_tao_id: adminUser._id,
      },
      {
        ten_ngay_le: 'Giỗ Tổ Hùng Vương 2026',
        ngay_bat_dau: '2026-04-26',
        ngay_ket_thuc: '2026-04-26',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Nghỉ Lễ Giỗ Tổ Hùng Vương (mùng 10 tháng 3 Âm lịch)',
        nguoi_tao_id: adminUser._id,
      },
      {
        ten_ngay_le: 'Ngày Giải Phóng Miền Nam & Quốc Tế Lao Động',
        ngay_bat_dau: '2026-04-30',
        ngay_ket_thuc: '2026-05-01',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Nghỉ Lễ 30/4 và 1/5 theo luật lao động',
        nguoi_tao_id: adminUser._id,
      },
      {
        ten_ngay_le: 'Lễ Quốc Khánh 2026',
        ngay_bat_dau: '2026-09-01',
        ngay_ket_thuc: '2026-09-02',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Kỷ niệm ngày Quốc khánh 2/9',
        nguoi_tao_id: adminUser._id,
      },
      {
        ten_ngay_le: 'Ngày Nhà Giáo Việt Nam',
        ngay_bat_dau: '2026-11-20',
        ngay_ket_thuc: '2026-11-20',
        nam: 2026,
        huong_luong: true,
        mo_ta: 'Nghỉ lễ truyền thống ngành giáo dục',
        nguoi_tao_id: adminUser._id,
      },
    ]);
    console.log('✔ Đã khởi tạo 6 kỳ nghỉ lễ chuẩn năm 2026 (ngay_nghi_le).');

    console.log('\n--- 10. TẠO CẤU HÌNH HỆ THỐNG TẬP TRUNG (SYSTEM_CONFIG - MỤC 3 ĐẶC TẢ) ---');
    await SystemConfig.create([
      {
        khoa_cau_hinh: 'HOC_KY',
        gia_tri: { nam_hoc: '2026-2027', hoc_ky: 1, ngay_bat_dau: '2026-09-07', so_tuan: 18 },
        nhom: 'DAO_TAO',
        mo_ta: 'Thông tin học kỳ hiện tại, ngày bắt đầu và tổng số tuần học',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'GEOFENCE_TRUONG',
        gia_tri: { ten_co_so: 'Trụ sở chính', toa_do: [105.7826, 21.0378], ban_kinh_met: 150 },
        nhom: 'GPS',
        mo_ta: 'Tọa độ GPS trụ sở chính trường và bán kính geofence cho phép chấm công',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'DANH_SACH_PHONG_HOC',
        gia_tri: [
          { ma_phong: 'A101', toa_do: [105.78261, 21.03781], ban_kinh_met: 30 },
          { ma_phong: 'B202', toa_do: [105.7827, 21.0379], ban_kinh_met: 30 },
          { ma_phong: 'C303', toa_do: [105.7828, 21.038], ban_kinh_met: 30 },
        ],
        nhom: 'DAO_TAO',
        mo_ta: 'Danh mục phòng học hợp lệ kèm tọa độ GPS phòng máy',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'LUONG_CO_SO',
        gia_tri: 2530000,
        nhom: 'TIEN_LUONG',
        mo_ta: 'Mức lương cơ sở nội bộ quy định (đồng/tháng)',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'GIAM_TRU',
        gia_tri: { ban_than: 15500000, phu_thuoc: 6200000 },
        nhom: 'THUE',
        mo_ta: 'Mức giảm trừ gia cảnh thuế TNCN cho bản thân và người phụ thuộc',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'TY_LE_BAO_HIEM',
        gia_tri: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
        nhom: 'TIEN_LUONG',
        mo_ta: 'Tỷ lệ trích đóng bảo hiểm bắt buộc của người lao động',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'BIEU_THUE_5_BAC',
        gia_tri: [
          { bac: 1, tu: 0, den: 10000000, thue_suat: 0.05 },
          { bac: 2, tu: 10000000, den: 30000000, thue_suat: 0.1 },
          { bac: 3, tu: 30000000, den: 60000000, thue_suat: 0.2 },
          { bac: 4, tu: 60000000, den: 100000000, thue_suat: 0.3 },
          { bac: 5, tu: 100000000, den: null, thue_suat: 0.35 },
        ],
        nhom: 'THUE',
        mo_ta: 'Biểu thuế lũy tiến từng phần thuế TNCN 5 bậc',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'DON_GIA_GIO',
        gia_tri: 120000,
        nhom: 'TIEN_LUONG',
        mo_ta: 'Đơn giá thanh toán một giờ chuẩn giảng dạy vượt định mức (đồng/giờ)',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'DINH_MUC_GIO_CHUAN',
        gia_tri: 135,
        nhom: 'TIEN_LUONG',
        mo_ta: 'Định mức giờ chuẩn giảng dạy tiêu chuẩn mỗi học kỳ của giảng viên',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'TY_LE_UU_DAI',
        gia_tri: { GIANG_VIEN: 0.3, HANH_CHINH: 0.0 },
        nhom: 'TIEN_LUONG',
        mo_ta: 'Tỷ lệ phụ cấp ưu đãi đứng lớp nghề giáo',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'CHUC_VU',
        gia_tri: [
          { ma_chuc_vu: 'HIEU_TRUONG', he_so_phu_cap: 1.0, ty_le_giam_dinh_muc: 0.8 },
          { ma_chuc_vu: 'TRUONG_KHOA', he_so_phu_cap: 0.7, ty_le_giam_dinh_muc: 0.3 },
          { ma_chuc_vu: 'PHO_TRUONG_KHOA', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.2 },
          { ma_chuc_vu: 'TRUONG_BO_MON', he_so_phu_cap: 0.5, ty_le_giam_dinh_muc: 0.2 },
          { ma_chuc_vu: 'TRUONG_PHONG', he_so_phu_cap: 0.6, ty_le_giam_dinh_muc: 0.0 },
          { ma_chuc_vu: 'PHO_TRUONG_PHONG', he_so_phu_cap: 0.4, ty_le_giam_dinh_muc: 0.0 },
        ],
        nhom: 'CHUC_VU',
        mo_ta: 'Bảng hệ số phụ cấp chức vụ và tỷ lệ giảm trừ định mức giảng dạy',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'HE_SO_QUY_DOI_GIO',
        gia_tri: {
          hinh_thuc: { LY_THUYET: 1.0, THUC_HANH: 0.7 },
          he_dao_tao: { CHINH_QUY: 1.0, CHAT_LUONG_CAO: 1.2, VUA_LAM_VUA_HOC: 1.1, SAU_DAI_HOC: 1.5 },
          si_so: [
            { den: 40, he_so: 1.0 },
            { den: 80, he_so: 1.1 },
            { den: 999, he_so: 1.2 },
          ],
        },
        nhom: 'DAO_TAO',
        mo_ta: 'Hệ số quy đổi giờ chuẩn theo hình thức, hệ đào tạo và sĩ số lớp',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'NGUONG_AI',
        gia_tri: { mo_hinh: 'buffalo_s', so_chieu: 512, cosine_min: 0.45, liveness_min: 0.85 },
        nhom: 'AI',
        mo_ta: 'Ngưỡng khoảng cách Cosine và Liveness điểm danh khuôn mặt InsightFace',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'MARGIN_TOP1_TOP2',
        gia_tri: 0.05,
        nhom: 'AI',
        mo_ta: 'Độ lệch khoảng cách tối thiểu giữa Top 1 và Top 2 chống nhận nhầm',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'COOLDOWN_QUET_GIAY',
        gia_tri: 60,
        nhom: 'CHAM_CONG',
        mo_ta: 'Thời gian cooldown tối thiểu giữa 2 lần quét thành công chống lặp',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'QUY_TAC_DIEM_DANH',
        gia_tri: { cua_so_checkin_truoc_phut: 30, ty_le_du_gio: 0.8, ty_le_nua_gio: 0.5, lam_tron_tiet: 'FLOOR' },
        nhom: 'CHAM_CONG',
        mo_ta: 'Quy tắc tính giờ công và điều kiện ghi nhận tiết giảng dạy',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'RETENTION_ANH_NAM',
        gia_tri: 1,
        nhom: 'HE_THONG',
        mo_ta: 'Thời gian lưu trữ ảnh minh chứng chấm công (năm)',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'RETENTION_METADATA_NAM',
        gia_tri: 5,
        nhom: 'HE_THONG',
        mo_ta: 'Thời gian lưu trữ metadata chấm công phục vụ thanh tra (năm)',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'CRON_LAST_RUN',
        gia_tri: '2026-10-15',
        nhom: 'HE_THONG',
        mo_ta: 'Ngày chạy thành công gần nhất của tiến trình cron phục vụ Catch-Up',
        nguoi_cap_nhat_id: adminUser._id,
      },
      // Các khóa cũ để đảm bảo tương thích 100%
      {
        khoa_cau_hinh: 'FACE_MATCH_THRESHOLD',
        gia_tri: 0.45,
        nhom: 'AI',
        mo_ta: 'Ngưỡng khoảng cách cosine tối đa để chấp nhận khớp khuôn mặt Face ID',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'LIVENESS_CONFIDENCE_THRESHOLD',
        gia_tri: 0.85,
        nhom: 'AI',
        mo_ta: 'Ngưỡng tin cậy tối thiểu của thuật toán chống giả mạo sinh trắc học',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'CAMPUS_GPS_RADIUS_METERS',
        gia_tri: 100,
        nhom: 'GPS',
        mo_ta: 'Bán kính hợp lệ mặc định xung quanh khuôn viên đại học (mét)',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'CAMERA_AUTO_RESET_SECONDS',
        gia_tri: 8,
        nhom: 'DEVICE',
        mo_ta: 'Thời gian chờ (giây) tự động đặt lại camera sau khi nhận diện thành công',
        nguoi_cap_nhat_id: adminUser._id,
      },
      {
        khoa_cau_hinh: 'ATTENDANCE_LATE_THRESHOLD_DEFAULT',
        gia_tri: 15,
        nhom: 'ATTENDANCE',
        mo_ta: 'Số phút tối đa cho phép đi muộn trước khi tự động hủy lịch và đánh vắng',
        nguoi_cap_nhat_id: adminUser._id,
      },
    ]);
    console.log('✔ Đã khởi tạo đầy đủ 19 tham số cấu hình tập trung chuẩn đặc tả (cau_hinh_he_thong).');

    console.log('\n--- 11. TẠO PHIẾU LƯƠNG MẪU (PAYROLL - PHIEU_LUONG) ---');
    await Payroll.create([
      {
        nguoi_dung_id: lecturerBich._id,
        thang: 9,
        nam: 2026,
        nguoi_lap_id: adminUser._id,
        nguoi_duyet_id: itDean._id,
        he_so_luong: 3.0,
        luong_co_so: 2530000,
        luong_chinh: 3.0 * 2530000,
        phu_cap_uu_dai_nghe: 3.0 * 2530000 * 0.3,
        phu_cap_tham_nien: 500000,
        tong_thu_nhap_gross: 11000000,
        bao_hiem: {
          bhxh: 607200,
          bhyt: 113850,
          bhtn: 75900,
          tong_bao_hiem: 796950,
        },
        thue_tncn: {
          giam_tru_ban_than: 15500000,
          giam_tru_phu_thuoc: 0,
          thu_nhap_tinh_thue: 0,
          tien_thue: 0,
        },
        thuc_linh_net: 10203050,
        trang_thai: 'DA_DUYET',
      },
    ]);
    console.log('✔ Đã khởi tạo phiếu lương mẫu tháng 9/2026 (phieu_luong).');

    console.log('\n================================================================');
    console.log('🎉 KHỞI TẠO CƠ SỞ DỮ LIỆU CHUẨN ĐẠI HỌC HOÀN TẤT!');
    console.log('================================================================');
    console.log('Danh sách tài khoản đăng nhập mẫu (Mật khẩu chung: password123):');
    console.log('1. Admin IT:          daihocdtd@gmail.com');
    console.log('2. Admin HR:          admin.hr@university.edu.vn');
    console.log('3. Trưởng Khoa CNTT:  truongkhoa.cntt@university.edu.vn');
    console.log('4. Trưởng Khoa KinhTế:truongkhoa.kinhte@university.edu.vn');
    console.log('5. Giảng viên KTPM:   giangvien.bich@university.edu.vn (Quỹ phép còn 9/12)');
    console.log('6. Giảng viên HTTT:   giangvien.cuong@university.edu.vn (Đang có đơn chờ duyệt)');
    console.log('7. Chuyên viên ĐàoTạo:nhanvien.ha@university.edu.vn (Ca hành chính)');
    console.log('8. Chuyên viên KhảoThí:nhanvien.thanh@university.edu.vn (Ca hành chính)');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;
