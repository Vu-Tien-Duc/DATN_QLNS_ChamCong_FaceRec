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
    const existingCols = await mongoose.connection.db.listCollections().toArray();
    for (const col of existingCols) {
      try {
        await mongoose.connection.collection(col.name).drop();
      } catch (err) {
        // Bỏ qua nếu lỗi
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
      roles: [{ role: 'BGH', scope: 'TOAN_TRUONG' }],
    });
    boardOfPresidents.managerId = presidentUser._id;
    await boardOfPresidents.save();

    // Admin 1: Chuyên viên IT quản lý server / hệ thống
    const adminUser = await User.create({
      fullName: 'Quản Trị Viên Hệ Thống (Admin IT)',
      email: 'admin@university.edu.vn',
      staffCode: 'ADMIN01',
      passwordHash,
      role: 'admin',
      departmentId: boardOfPresidents._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
      roles: [{ role: 'ADMIN', scope: 'TOAN_TRUONG' }],
    });

    // Admin 2: Tài khoản dự phòng đại học
    const adminBackup = await User.create({
      fullName: 'Quản Trị Viên Hệ Thống (Dự phòng)',
      email: 'daihocdtd@gmail.com',
      staffCode: 'ADMIN02',
      passwordHash,
      role: 'admin',
      departmentId: boardOfPresidents._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
      roles: [{ role: 'ADMIN', scope: 'TOAN_TRUONG' }],
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
      roles: [{ role: 'ADMIN', scope: 'TOAN_TRUONG' }],
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
      roles: [{ role: 'TRUONG_KHOA', scope: 'KHOA', departmentId: itFaculty._id }],
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
      roles: [
        {
          role: 'PHO_TRUONG_KHOA',
          scope: 'KHOA',
          departmentId: itFaculty._id,
          isDelegated: true,
          delegationExpiresAt: new Date('2028-12-31'),
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
      roles: [{ role: 'TRUONG_KHOA', scope: 'KHOA', departmentId: econFaculty._id }],
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
      roles: [{ role: 'TRUONG_BO_MON', scope: 'BO_MON', departmentId: seDept._id }],
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
      roles: [{ role: 'GIANG_VIEN', scope: 'KHOA', departmentId: itFaculty._id }],
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
      roles: [{ role: 'GIANG_VIEN', scope: 'KHOA', departmentId: itFaculty._id }],
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
      roles: [{ role: 'GIANG_VIEN', scope: 'KHOA', departmentId: econFaculty._id }],
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
      roles: [{ role: 'GIANG_VIEN', scope: 'KHOA', departmentId: designFaculty._id }],
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
      roles: [{ role: 'DAO_TAO', scope: 'TOAN_TRUONG' }],
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
      roles: [{ role: 'KIEM_TOAN', scope: 'TOAN_TRUONG' }],
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
        userId: u._id,
        descriptors,
        averageDescriptor: avgVec,
        sampleAngles: poses,
        sampleCount: poses.length,
        embeddingModel: 'buffalo_s',
        consentAgreed: true,
      });

      u.isFaceRegistered = true;
      u.faceRegisteredAt = new Date();
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

    await PunchLog.create([
      {
        attendanceLogId: seededLog._id,
        userId: lecturerBich._id,
        punchType: 'CHECK_IN',
        punchTime: yesterday,
        method: 'QR_CODE',
        coordinates: { latitude: 21.028511, longitude: 105.854167 },
        deviceId: 'MAY_CHAM_CONG_A2',
        isFraud: false,
      },
      {
        attendanceLogId: seededLog._id,
        userId: lecturerBich._id,
        punchType: 'CHECK_OUT',
        punchTime: yesterdayOut,
        method: 'QR_CODE',
        coordinates: { latitude: 21.028511, longitude: 105.854167 },
        deviceId: 'MAY_CHAM_CONG_A2',
        isFraud: false,
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
        name: 'Tết Dương Lịch 2026',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        year: 2026,
        isPaid: true,
        description: 'Nghỉ Tết Dương Lịch theo quy định Nhà nước',
        createdBy: adminUser._id,
      },
      {
        name: 'Tết Nguyên Đán Bính Ngọ 2026',
        startDate: '2026-02-15',
        endDate: '2026-02-23',
        year: 2026,
        isPaid: true,
        description: 'Kỳ nghỉ Tết Âm lịch Bính Ngọ (9 ngày)',
        createdBy: adminUser._id,
      },
      {
        name: 'Giỗ Tổ Hùng Vương 2026',
        startDate: '2026-04-26',
        endDate: '2026-04-26',
        year: 2026,
        isPaid: true,
        description: 'Nghỉ Lễ Giỗ Tổ Hùng Vương (mùng 10 tháng 3 Âm lịch)',
        createdBy: adminUser._id,
      },
      {
        name: 'Ngày Giải Phóng Miền Nam & Quốc Tế Lao Động',
        startDate: '2026-04-30',
        endDate: '2026-05-01',
        year: 2026,
        isPaid: true,
        description: 'Nghỉ Lễ 30/4 và 1/5 theo luật lao động',
        createdBy: adminUser._id,
      },
      {
        name: 'Lễ Quốc Khánh 2026',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        year: 2026,
        isPaid: true,
        description: 'Kỷ niệm ngày Quốc khánh 2/9',
        createdBy: adminUser._id,
      },
      {
        name: 'Ngày Nhà Giáo Việt Nam',
        startDate: '2026-11-20',
        endDate: '2026-11-20',
        year: 2026,
        isPaid: true,
        description: 'Nghỉ lễ truyền thống ngành giáo dục',
        createdBy: adminUser._id,
      },
    ]);
    console.log('✔ Đã khởi tạo 6 kỳ nghỉ lễ chuẩn năm 2026 (ngay_nghi_le).');

    console.log('\n--- 10. TẠO CẤU HÌNH HỆ THỐNG TẬP TRUNG (SYSTEM_CONFIG - MỤC 3 ĐẶC TẢ) ---');
    await SystemConfig.create([
      {
        key: 'HOC_KY',
        value: { academicYear: '2026-2027', semester: 1, startDate: '2026-09-07', totalWeeks: 18 },
        group: 'DAO_TAO',
        description: 'Thông tin học kỳ hiện tại, ngày bắt đầu và tổng số tuần học',
        updatedBy: adminUser._id,
      },
      {
        key: 'GEOFENCE_TRUONG',
        value: { facilityName: 'Trụ sở chính', coordinates: [105.7826, 21.0378], radiusMeters: 150 },
        group: 'GPS',
        description: 'Tọa độ GPS trụ sở chính trường và bán kính geofence cho phép chấm công',
        updatedBy: adminUser._id,
      },
      {
        key: 'DANH_SACH_PHONG_HOC',
        value: [
          { roomCode: 'A101', coordinates: [105.78261, 21.03781], radiusMeters: 30 },
          { roomCode: 'B202', coordinates: [105.7827, 21.0379], radiusMeters: 30 },
          { roomCode: 'C303', coordinates: [105.7828, 21.038], radiusMeters: 30 },
        ],
        group: 'DAO_TAO',
        description: 'Danh mục phòng học hợp lệ kèm tọa độ GPS phòng máy',
        updatedBy: adminUser._id,
      },
      {
        key: 'LUONG_CO_SO',
        value: 2530000,
        group: 'TIEN_LUONG',
        description: 'Mức lương cơ sở nội bộ quy định (đồng/tháng)',
        updatedBy: adminUser._id,
      },
      {
        key: 'GIAM_TRU',
        value: { personalDeduction: 15500000, dependentDeduction: 6200000 },
        group: 'THUE',
        description: 'Mức giảm trừ gia cảnh thuế TNCN cho bản thân và người phụ thuộc',
        updatedBy: adminUser._id,
      },
      {
        key: 'TY_LE_BAO_HIEM',
        value: { socialInsurance: 0.08, healthInsurance: 0.015, unemploymentInsurance: 0.01 },
        group: 'TIEN_LUONG',
        description: 'Tỷ lệ trích đóng bảo hiểm bắt buộc của người lao động',
        updatedBy: adminUser._id,
      },
      {
        key: 'BIEU_THUE_5_BAC',
        value: [
          { tier: 1, from: 0, to: 10000000, taxRate: 0.05 },
          { tier: 2, from: 10000000, to: 30000000, taxRate: 0.1 },
          { tier: 3, from: 30000000, to: 60000000, taxRate: 0.2 },
          { tier: 4, from: 60000000, to: 100000000, taxRate: 0.3 },
          { tier: 5, from: 100000000, to: null, taxRate: 0.35 },
        ],
        group: 'THUE',
        description: 'Biểu thuế lũy tiến từng phần thuế TNCN 5 bậc',
        updatedBy: adminUser._id,
      },
      {
        key: 'DON_GIA_GIO',
        value: 120000,
        group: 'TIEN_LUONG',
        description: 'Đơn giá thanh toán một giờ chuẩn giảng dạy vượt định mức (đồng/giờ)',
        updatedBy: adminUser._id,
      },
      {
        key: 'DINH_MUC_GIO_CHUAN',
        value: 135,
        group: 'TIEN_LUONG',
        description: 'Định mức giờ chuẩn giảng dạy tiêu chuẩn mỗi học kỳ của giảng viên',
        updatedBy: adminUser._id,
      },
      {
        key: 'TY_LE_UU_DAI',
        value: { GIANG_VIEN: 0.3, HANH_CHINH: 0.0 },
        group: 'TIEN_LUONG',
        description: 'Tỷ lệ phụ cấp ưu đãi đứng lớp nghề giáo',
        updatedBy: adminUser._id,
      },
      {
        key: 'CHUC_VU',
        value: [
          { positionCode: 'HIEU_TRUONG', allowanceCoefficient: 1.0, quotaReductionRate: 0.8 },
          { positionCode: 'TRUONG_KHOA', allowanceCoefficient: 0.7, quotaReductionRate: 0.3 },
          { positionCode: 'PHO_TRUONG_KHOA', allowanceCoefficient: 0.5, quotaReductionRate: 0.2 },
          { positionCode: 'TRUONG_BO_MON', allowanceCoefficient: 0.5, quotaReductionRate: 0.2 },
          { positionCode: 'TRUONG_PHONG', allowanceCoefficient: 0.6, quotaReductionRate: 0.0 },
          { positionCode: 'PHO_TRUONG_PHONG', allowanceCoefficient: 0.4, quotaReductionRate: 0.0 },
        ],
        group: 'CHUC_VU',
        description: 'Bảng hệ số phụ cấp chức vụ và tỷ lệ giảm trừ định mức giảng dạy',
        updatedBy: adminUser._id,
      },
      {
        key: 'HE_SO_QUY_DOI_GIO',
        value: {
          format: { THEORY: 1.0, PRACTICE: 0.7 },
          trainingType: { FORMAL: 1.0, HIGH_QUALITY: 1.2, IN_SERVICE: 1.1, POST_GRADUATE: 1.5 },
          classSize: [
            { upTo: 40, coefficient: 1.0 },
            { upTo: 80, coefficient: 1.1 },
            { upTo: 999, coefficient: 1.2 },
          ],
        },
        group: 'DAO_TAO',
        description: 'Hệ số quy đổi giờ chuẩn theo hình thức, hệ đào tạo và sĩ số lớp',
        updatedBy: adminUser._id,
      },
      {
        key: 'NGUONG_AI',
        value: { model: 'buffalo_s', dimensions: 512, minCosine: 0.45, minLiveness: 0.85 },
        group: 'AI',
        description: 'Ngưỡng khoảng cách Cosine và Liveness điểm danh khuôn mặt InsightFace',
        updatedBy: adminUser._id,
      },
      {
        key: 'MARGIN_TOP1_TOP2',
        value: 0.05,
        group: 'AI',
        description: 'Độ lệch khoảng cách tối thiểu giữa Top 1 và Top 2 chống nhận nhầm',
        updatedBy: adminUser._id,
      },
      {
        key: 'COOLDOWN_QUET_GIAY',
        value: 60,
        group: 'CHAM_CONG',
        description: 'Thời gian cooldown tối thiểu giữa 2 lần quét thành công chống lặp',
        updatedBy: adminUser._id,
      },
      {
        key: 'QUY_TAC_DIEM_DANH',
        value: { checkInWindowBeforeMinutes: 30, fullHourRatio: 0.8, halfHourRatio: 0.5, roundPeriod: 'FLOOR' },
        group: 'CHAM_CONG',
        description: 'Quy tắc tính giờ công và điều kiện ghi nhận tiết giảng dạy',
        updatedBy: adminUser._id,
      },
      {
        key: 'RETENTION_ANH_NAM',
        value: 1,
        group: 'HE_THONG',
        description: 'Thời gian lưu trữ ảnh minh chứng chấm công (năm)',
        updatedBy: adminUser._id,
      },
      {
        key: 'RETENTION_METADATA_NAM',
        value: 5,
        group: 'HE_THONG',
        description: 'Thời gian lưu trữ metadata chấm công phục vụ thanh tra (năm)',
        updatedBy: adminUser._id,
      },
      {
        key: 'CRON_LAST_RUN',
        value: '2026-10-15',
        group: 'HE_THONG',
        description: 'Ngày chạy thành công gần nhất của tiến trình cron phục vụ Catch-Up',
        updatedBy: adminUser._id,
      },
      // Các khóa cũ để đảm bảo tương thích 100%
      {
        key: 'FACE_MATCH_THRESHOLD',
        value: 0.45,
        group: 'AI',
        description: 'Ngưỡng khoảng cách cosine tối đa để chấp nhận khớp khuôn mặt Face ID',
        updatedBy: adminUser._id,
      },
      {
        key: 'LIVENESS_CONFIDENCE_THRESHOLD',
        value: 0.85,
        group: 'AI',
        description: 'Ngưỡng tin cậy tối thiểu của thuật toán chống giả mạo sinh trắc học',
        updatedBy: adminUser._id,
      },
      {
        key: 'CAMPUS_GPS_RADIUS_METERS',
        value: 100,
        group: 'GPS',
        description: 'Bán kính hợp lệ mặc định xung quanh khuôn viên đại học (mét)',
        updatedBy: adminUser._id,
      },
      {
        key: 'CAMERA_AUTO_RESET_SECONDS',
        value: 8,
        group: 'DEVICE',
        description: 'Thời gian chờ (giây) tự động đặt lại camera sau khi nhận diện thành công',
        updatedBy: adminUser._id,
      },
      {
        key: 'ATTENDANCE_LATE_THRESHOLD_DEFAULT',
        value: 15,
        group: 'ATTENDANCE',
        description: 'Số phút tối đa cho phép đi muộn trước khi tự động hủy lịch và đánh vắng',
        updatedBy: adminUser._id,
      },
    ]);
    console.log('✔ Đã khởi tạo đầy đủ 19 tham số cấu hình tập trung chuẩn đặc tả (cau_hinh_he_thong).');

    console.log('\n--- 11. TẠO PHIẾU LƯƠNG MẪU (PAYROLL - PHIEU_LUONG) ---');
    await Payroll.create([
      {
        userId: lecturerBich._id,
        month: 9,
        year: 2026,
        createdBy: adminUser._id,
        approvedBy: itDean._id,
        salaryCoefficient: 3.0,
        baseSalary: 2530000,
        primarySalary: 3.0 * 2530000,
        vocationalAllowance: 3.0 * 2530000 * 0.3,
        seniorityAllowance: 500000,
        grossIncome: 11000000,
        insurance: {
          socialInsurance: 607200,
          healthInsurance: 113850,
          unemploymentInsurance: 75900,
          totalInsurance: 796950,
        },
        personalIncomeTax: {
          personalDeduction: 15500000,
          dependentDeduction: 0,
          taxableIncome: 0,
          taxAmount: 0,
        },
        netSalary: 10203050,
        status: 'DA_DUYET',
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
