# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC CƠ SỞ DỮ LIỆU & QUY TRÌNH NGHIỆP VỤ HỆ THỐNG
**Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính**  
*Môi trường triển khai: Cơ sở Giáo dục Đại học tại Việt Nam*  
*Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023*  
*Phiên bản tài liệu: 2.6 (Bản Chốt Nghiệm Thu Toàn Diện & Đồng Bộ 100% Hệ Thống)*

---

## MỤC LỤC
1. [Nguyên Tắc Thiết Kế & Danh Pháp Dual-Standard](#1-nguyên-tắc-thiết-kế--danh-pháp-dual-standard)
2. [Chi Tiết 14 Collections Mongoose Schema & Indexes](#2-chi-tiết-14-collections-mongoose-schema--indexes)
3. [Danh Mục Khóa Cấu Hình Hệ Thống (cau_hinh_he_thong)](#3-danh-mục-khóa-cấu-hình-hệ-thống-cau_hinh_he_thong)
4. [Các Quy Trình & Thuật Toán Nghiệp Vụ Cốt Lõi](#4-các-quy-trình--thuật-toán-nghiệp-vụ-cốt-lõi)
   - 4.1. Token Rotation có Grace Period Cache 15s & Thu Hồi Phiên
   - 4.2. Luồng Check-In Thời Gian Thực & Cron 02:05 Sáng qua `khoa_cong`
   - 4.3. Cơ Chế Catch-Up Khi Máy Chủ Khởi Động (Không Đánh Vắng Oan)
   - 4.4. Phân Quyền Duyệt Đơn Đa Cấp & Chặn Tự Duyệt (deanScope)
   - 4.5. Hồi Tố Công Khi Duyệt Đơn & Hoàn Tác Khi Hủy Đơn (ACID Transaction)
   - 4.6. Tính Số Ngày Nghỉ Thực Tế & Quản Lý Quota Phép Năm Bằng Aggregation
   - 4.7. Chống Xung Đột Lịch Giảng Dạy Theo Khoảng Tiết
   - 4.8. Quy Đổi Giờ Chuẩn Giảng Dạy, Thuế Snapshot 2026 & Xoay Khóa CCCD
   - 4.9. Sinh Trắc Học Face AI, Động Cơ Nhận Diện 1:N RAM & Đồng Bộ Hai Nguồn Sự Thật
   - 4.10. Trợ Lý AI Chatbot Đa Mô Hình (Gemini/Claude/DeepSeek/Local) & Tri Thức Quy Chế 2026
   - 4.11. Kiến Trúc Container Hóa Docker & Docker Compose Toàn Diện
   - 4.12. Tài Liệu Chuẩn Swagger OpenAPI 3.0 & 26 RESTful Endpoints
   - 4.13. Sơ Đồ Kiến Trúc & Ma Trận 17 Phân Hệ Giao Diện Frontend
5. [Mục Hạn Chế Của Đồ Án & Phiếu Đồng Ý Thu Thập Sinh Trắc](#5-mục-hạn-chế-của-đồ-án--phiếu-đồng-ý-thu-thập-sinh-trắc)
6. [Lộ Trình Triển Khai 8 Tuần & Danh Mục 14 Test Suites Tự Động](#6-lộ-trình-triển-khai-8-tuần--danh-mục-14-test-suites-tự-động)

---

## 1. NGUYÊN TẮC THIẾT KẾ & DANH PHÁP DUAL-STANDARD

### 1.1. Chuẩn Ánh Xạ Model (Dual-Standard)
Để đảm bảo mã nguồn trong sáng, dễ đọc và tương thích tuyệt đối với các thư viện Mongoose ODM:
- **Tên Model Code (Tiếng Anh PascalCase):** `User`, `FaceTemplate`, `Department`, `ShiftConfig`, `Subject`, `Schedule`, `Holiday`, `PunchLog`, `AttendanceLog`, `LeaveRequest`, `Payroll`, `RefreshToken`, `SystemConfig`, `AuditLog`.
- **Tên Collection Vật Lý (Tiếng Việt snake_case):** `nguoi_dung`, `du_lieu_khuon_mat`, `don_vi`, `ca_lam_viec`, `mon_hoc`, `lich_giang_day`, `ngay_nghi_le`, `luot_quet_cham_cong`, `nhat_ky_cham_cong`, `don_tu`, `phieu_luong`, `ma_lam_moi`, `cau_hinh_he_thong`, `nhat_ky_kiem_toan`.
- **Tên Trường (Field Names):** Lưu trữ gốc bằng tiếng Việt snake_case (`khoa_cong`, `nguoi_dung_id`, `ngay_cham_cong_str`...). Tích hợp qua `schemaAliasPlugin` để hỗ trợ gọi alias tiếng Anh (`userId`, `workDate`...).

### 1.2. Các Ràng Buộc Kỹ Thuật Bắt Buộc
- **Múi giờ hệ thống:** Toàn bộ chuỗi ngày công (`YYYY-MM-DD`) và giờ giấc quy về múi giờ chuẩn **`Asia/Ho_Chi_Minh` (UTC+7)**.
- **MongoDB Transaction:** Yêu cầu CSDL chạy chế độ **Replica Set** để hỗ trợ `session.startTransaction()`.
- **Tách biệt dữ liệu chấm công:**
  - `luot_quet_cham_cong`: Lưu vết điểm danh vật lý thô (raw punches) từ Camera Face Service, GPS, QR.
  - `nhat_ky_cham_cong`: Dữ liệu ngày công nghiệp vụ đã tổng hợp, là nguồn sự thật cho tính lương.

---

## 2. CHI TIẾT 14 COLLECTIONS MONGOOSE SCHEMA & INDEXES

### Collection 1: `nguoi_dung` (Hồ sơ Nhân sự & Tài khoản)
```javascript
const vaiTroSchema = new mongoose.Schema({
  ma_vai_tro: {
    type: String,
    enum: [
      'ADMIN', 'BGH', 'TCCB', 'DAO_TAO', 'KE_TOAN', 'KIEM_TOAN',
      'TRUONG_KHOA', 'PHO_TRUONG_KHOA',
      'TRUONG_BO_MON', 'PHO_TRUONG_BO_MON',
      'TRUONG_PHONG', 'PHO_TRUONG_PHONG',
      'GIANG_VIEN', 'CHUYEN_VIEN'
    ],
    required: true
  },
  pham_vi: { type: String, enum: ['TOAN_TRUONG', 'KHOA', 'BO_MON', 'PHONG_BAN'], required: true },
  don_vi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_vi', default: null },
  duoc_uy_quyen: { type: Boolean, default: false }, // Cho phép phó trưởng duyệt thay khi được ủy quyền
  tu_ngay: { type: Date, default: Date.now },
  den_ngay: { type: Date, default: null } // null: Đang trong nhiệm kỳ; có giá trị: Nhiệm kỳ đã đóng
}, { _id: false });

const nguoiDungSchema = new mongoose.Schema({
  ma_dinh_danh: { type: String, required: true, unique: true, trim: true }, // Mã GV / MSNV
  ho_ten: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  mat_khau_hash: { type: String, required: true, select: false },
  anh_dai_dien_url: { type: String, default: null },
  so_dien_thoai: { type: String, default: null },
  ngay_sinh: { type: Date, required: true },
  gioi_tinh: { type: String, enum: ['NAM', 'NU', 'KHAC'], required: true },
  so_cccd_ma_hoa: { type: String, select: false, default: null }, // AES-256-GCM
  phien_ban_khoa_cccd: { type: Number, default: 1 },
  don_vi_chinh_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_vi', required: true },
  loai_nhan_su: { type: String, enum: ['GIANG_VIEN', 'HANH_CHINH'], required: true },
  hoc_ham: { type: String, enum: ['GIAO_SU', 'PHO_GIAO_SU', 'KHONG'], default: 'KHONG' },
  hoc_vi: { type: String, enum: ['TIEN_SI', 'THAC_SI', 'CU_NHAN', 'KY_SU'], required: true },
  ngach_luong: { type: String, default: 'V.07.01.03' },
  he_so_luong: { type: Number, required: true },
  so_nguoi_phu_thuoc: { type: Number, default: 0 },
  han_muc_phep_nam: { type: Number, default: 12 }, // Hạn mức cố định, không dùng biến đếm giảm dần
  ngay_vao_truong: { type: Date, required: true },
  ngay_bat_dau_giang_day: { type: Date, default: null }, // Căn cứ tính phụ cấp thâm niên nghề giáo
  chuc_vu: [{ type: String }], // Chức vụ bổ nhiệm hành chính (nguồn gốc dữ liệu)
  vai_tro: [vaiTroSchema],    // Mảng vai trò RBAC có nhiệm kỳ
  quen_mat_khau: {
    ma_otp_hash: { type: String, default: null }, // HMAC-SHA256 với OTP_SECRET
    het_han_luc: { type: Date, default: null },
    so_lan_thu: { type: Number, default: 0 }
  },
  ngay_dong_y_sinh_trac: { type: Date, default: null },
  so_lan_sai_mk: { type: Number, default: 0 },
  khoa_den_luc: { type: Date, default: null },
  phien_ban_token: { type: Number, default: 1 }, // Tăng lên khi logout/đổi mật khẩu để hủy JWT tức thì
  trang_thai: { type: String, enum: ['HOAT_DONG', 'TAM_KHOA', 'DA_NGHI_VIEC'], default: 'HOAT_DONG' }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

nguoiDungSchema.index({ don_vi_chinh_id: 1, loai_nhan_su: 1 });
nguoiDungSchema.index({ trang_thai: 1 });
```

---

### Collection 2: `du_lieu_khuon_mat` (Mẫu Sinh Trắc ArcFace 512D)
```javascript
const duLieuKhuonMatSchema = new mongoose.Schema({
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true, unique: true },
  mo_hinh: { type: String, default: 'buffalo_s' }, // InsightFace buffalo_s (MobileFaceNet ArcFace)
  so_chieu: { type: Number, default: 512 },
  vectors_5_goc: { type: [[Number]], select: false, default: [] }, // Thẳng, trái, phải, ngước, cúi
  vector_trung_binh: { type: [Number], select: false, required: true } // Chuẩn hóa L2 dùng so khớp 1:N
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });
```

---

### Collection 3: `don_vi` (Khoa, Viện, Bộ môn, Phòng ban)
```javascript
const donViSchema = new mongoose.Schema({
  ma_don_vi: { type: String, required: true, unique: true, trim: true },
  ten_don_vi: { type: String, required: true, trim: true },
  loai_don_vi: { type: String, enum: ['KHOA', 'BO_MON', 'PHONG_BAN', 'BAN_GIAM_HIEU'], required: true },
  don_vi_cha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_vi', default: null },
  truong_don_vi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

donViSchema.index({ don_vi_cha_id: 1 });
```

---

### Collection 4: `ca_lam_viec` (Ca Làm Việc & Ca Tiết Học)
```javascript
const caLamViecSchema = new mongoose.Schema({
  ma_ca: { type: String, required: true, unique: true, trim: true }, // CA_SANG, CA_CHIEU, TIET_1_3...
  ten_ca: { type: String, required: true },
  loai_ca: { type: String, enum: ['HANH_CHINH', 'TIET_DAY'], required: true },
  gio_bat_dau: { type: String, required: true }, // '07:30'
  gio_ket_thuc: { type: String, required: true }, // '11:30'
  phut_cho_phep_tre: { type: Number, default: 15 },
  phut_cho_phep_ve_som: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });
```

---

### Collection 5: `mon_hoc` (Học Phần Đào Tạo)
```javascript
const monHocSchema = new mongoose.Schema({
  ma_mon_hoc: { type: String, required: true, unique: true, trim: true },
  ten_mon_hoc: { type: String, required: true },
  so_tin_chi: { type: Number, required: true },
  so_tiet_ly_thuyet: { type: Number, default: 0 },
  so_tiet_thuc_hanh: { type: Number, default: 0 },
  don_vi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_vi', required: true }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });
```

---

### Collection 6: `lich_giang_day` (Thời Khóa Biểu & Ngoại Lệ)
```javascript
const ngoaiLeSchema = new mongoose.Schema({
  ngay: { type: String, required: true }, // YYYY-MM-DD
  trang_thai: { type: String, enum: ['HUY', 'NGHI_CO_PHEP'], required: true },
  don_tu_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_tu', default: null },
  ly_do: { type: String, default: null }
}, { _id: false });

const lichGiangDaySchema = new mongoose.Schema({
  nam_hoc: { type: String, required: true },
  hoc_ky: { type: Number, required: true },
  mon_hoc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'mon_hoc', required: true },
  giang_vien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  ca_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ca_lam_viec', required: true },
  ten_lop_hoc_phan: { type: String, required: true },
  phong_hoc: { type: String, required: true, uppercase: true, trim: true },
  hinh_thuc: { type: String, enum: ['LY_THUYET', 'THUC_HANH'], required: true },
  si_so_lop: { type: Number, required: true },
  he_dao_tao: { 
    type: String, 
    enum: ['CHINH_QUY', 'CHAT_LUONG_CAO', 'VUA_LAM_VUA_HOC', 'SAU_DAI_HOC'], 
    default: 'CHINH_QUY' 
  },
  tiet_bat_dau: { type: Number, required: true },
  so_tiet: { type: Number, required: true },
  loai_lich: { type: String, enum: ['CHINH_KHOA', 'DAY_BU'], default: 'CHINH_KHOA' },
  thu_trong_tuan: { type: Number, default: null }, // 2..8 (Chỉ áp dụng với CHINH_KHOA)
  danh_sach_tuan: [{ type: Number }],             // [1..18]
  ngay_day_bu: { type: Date, default: null },      // Chỉ áp dụng khi loai_lich === 'DAY_BU'
  ngoai_le: [ngoaiLeSchema]
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

// Ràng buộc nghiệp vụ xếp lịch:
// 1. phong_hoc: Bắt buộc thuộc mảng cau_hinh_he_thong['DANH_SACH_PHONG_HOC'].
// 2. ca_id: Bắt buộc khớp với khung giờ của [tiet_bat_dau, tiet_bat_dau + so_tiet - 1].
// 3. Composite Index phục vụ tra cứu và kiểm tra xung đột thời khóa biểu:
lichGiangDaySchema.index({ nam_hoc: 1, hoc_ky: 1, giang_vien_id: 1, thu_trong_tuan: 1 });
lichGiangDaySchema.index({ nam_hoc: 1, hoc_ky: 1, phong_hoc: 1, thu_trong_tuan: 1, ca_id: 1 });
```

---

### Collection 7: `ngay_nghi_le` (Lịch Nghỉ Toàn Trường)
```javascript
const ngayNghiLeSchema = new mongoose.Schema({
  ten_ngay_le: { type: String, required: true },
  ngay_bat_dau: { type: Date, required: true },
  ngay_ket_thuc: { type: Date, required: true },
  huong_luong: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

ngayNghiLeSchema.index({ ngay_bat_dau: 1, ngay_ket_thuc: 1 });
```

---

### Collection 8: `luot_quet_cham_cong` (Lưu Vết Điểm Danh Thô)
```javascript
const luotQuetChamCongSchema = new mongoose.Schema({
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null },
  thoi_diem: { type: Date, default: Date.now, required: true },
  loai_quet: { type: String, enum: ['CHECK_IN', 'CHECK_OUT'], required: true },
  anh_minh_chung: { type: String, default: null },
  // Cú pháp chuẩn chống lỗi 2dsphere khi không có GPS:
  toa_do_gps: {
    type: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] } // [kinh_do, vi_do]
    },
    default: undefined
  },
  do_chinh_xac_gps: { type: Number, default: null },
  vi_tri_gia_lap: { type: Boolean, default: false },
  thiet_bi_id: { 
    type: String, 
    required: function() { return this.phuong_thuc === 'FACE_AI'; },
    default: 'CAMERA_DEFAULT' 
  },
  phuong_thuc: { 
    type: String, 
    enum: ['FACE_AI', 'QR_CODE', 'GPS_MOBILE', 'THU_CONG_ADMIN', 'SYSTEM_AUTO'], 
    default: 'FACE_AI' 
  },
  do_tuong_dong: { type: Number, default: null },
  diem_liveness: { type: Number, default: null },
  co_gian_lan: { type: Boolean, default: false },
  ly_do_gian_lan: { type: String, default: null },
  trang_thai: { type: String, enum: ['THANH_CONG', 'THAT_BAI'], required: true },
  ly_do_that_bai: { type: String, default: null }
});

luotQuetChamCongSchema.index({ toa_do_gps: '2dsphere' }, { sparse: true });
luotQuetChamCongSchema.index({ nguoi_dung_id: 1, thoi_diem: -1 });
```

---

### Collection 9: `nhat_ky_cham_cong` (Dữ Liệu Ngày Công Nghiệp Vụ)
```javascript
const nhatKyChamCongSchema = new mongoose.Schema({
  khoa_cong: { type: String, required: true, unique: true }, // Format: `${userId}_${dateStr}_${caId}_${lichId || 'HANH_CHINH'}`
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  ngay_cong: { type: String, required: true }, // YYYY-MM-DD
  ca_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ca_lam_viec', required: true },
  lich_trinh_id: { type: mongoose.Schema.Types.ObjectId, ref: 'lich_giang_day', default: null },
  thoi_gian_vao: { type: Date, default: null },
  thoi_gian_ra: { type: Date, default: null },
  di_muon_phut: { type: Number, default: 0 },
  ve_som_phut: { type: Number, default: 0 },
  quen_quet_ra: { type: Boolean, default: false }, // Cờ độc lập, không làm mất trạng thái đi muộn ban đầu
  so_tiet_thuc_day: { type: Number, default: 0 },   // Chỉ được gán khi Check-Out hợp lệ
  so_gio_cong: { type: Number, default: 0 },
  trang_thai: { 
    type: String, 
    enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'], 
    required: true 
  },
  don_tu_id: { type: mongoose.Schema.Types.ObjectId, ref: 'don_tu', default: null },
  thiet_bi_id: { type: String, default: 'CAMERA_DEFAULT' },
  anh_minh_chung: { type: String, default: null },
  da_chot: { type: Boolean, default: false },
  nguoi_sua_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null },
  ly_do_sua: { type: String, default: null }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

nhatKyChamCongSchema.index({ nguoi_dung_id: 1, ngay_cong: 1 });
nhatKyChamCongSchema.index({ ngay_cong: 1, da_chot: 1 });
```

---

### Collection 10: `don_tu` (Đơn Từ & Lịch Sử Duyệt)
```javascript
const lichSuDuyetSchema = new mongoose.Schema({
  cap: { type: Number, required: true },
  nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  vai_tro: { type: String, default: '' },
  hanh_dong: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
  ghi_chu: { type: String, default: '' },
  thoi_gian: { type: Date, default: Date.now }
}, { _id: false });

const donTuSchema = new mongoose.Schema({
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  loai_don: { 
    type: String, 
    enum: ['nghi_phep', 'day_bu', 'doi_ca', 'ANNUAL', 'COMPENSATORY', 'SHIFT_CHANGE', 'SICK', 'UNPAID'], 
    required: true 
  },
  ngay_bat_dau: { type: Date, required: true },
  ngay_ket_thuc: { type: Date, required: true },
  so_ngay: { type: Number, default: 1 }, // Do server tính toán trừ T7/CN/Lễ
  lich_trinh_id: { type: mongoose.Schema.Types.ObjectId, ref: 'lich_giang_day', default: null },
  ngay_day_bu: { type: Date, default: null },
  ly_do: { type: String, required: true },
  tep_dinh_kem: { type: String, default: null },
  trang_thai: { 
    type: String, 
    enum: ['PENDING', 'PENDING_DEAN', 'PENDING_BGH', 'APPROVED', 'REJECTED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  so_cap_duyet: { type: Number, default: 1 },
  cap_duyet_hien_tai: { type: Number, default: 1 },
  phien_ban: { type: Number, default: 1 }, // Khóa lạc quan chống race condition
  nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null },
  ghi_chu_duyet: { type: String, default: '' },
  ly_do_tu_choi: { type: String, default: null },
  lich_su_duyet: [lichSuDuyetSchema]
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

donTuSchema.index({ nguoi_dung_id: 1, trang_thai: 1 });
donTuSchema.index({ ngay_bat_dau: 1, ngay_ket_thuc: 1 });
```

---

### Collection 11: `phieu_luong` (Bảng Lương Snapshot 2026)
```javascript
const phieuLuongSchema = new mongoose.Schema({
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  thang: { type: Number, required: true },
  nam: { type: Number, required: true },
  nguoi_lap_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null },
  
  he_so_luong: { type: Number, required: true },
  luong_co_so: { type: Number, required: true },
  luong_chinh: { type: Number, required: true },
  phu_cap_chuc_vu: { type: Number, default: 0 },
  phu_cap_tham_nien: { type: Number, default: 0 },
  phu_cap_uu_dai_nghe: { type: Number, default: 0 },
  phu_cap: [{ loai_phu_cap: String, he_so_hoac_ty_le: Number, so_tien: Number }],
  khoan_thuong: [{ ly_do: String, so_tien: Number }],
  khau_tru: [{ ly_do: String, so_tien: Number }],
  
  gio_giang: {
    dinh_muc_goc: { type: Number, default: 135 },
    ty_le_giam_dinh_muc: { type: Number, default: 0 },
    dinh_muc_sau_giam: { type: Number, default: 135 },
    gio_quy_doi_tich_luy: { type: Number, default: 0 },
    gio_vuot_dinh_muc: { type: Number, default: 0 },
    don_gia_gio_chuan: { type: Number, default: 120000 },
    thu_lao_vuot_gio: { type: Number, default: 0 },
    da_tam_ung: { type: Number, default: 0 }
  },
  
  tong_thu_nhap_gross: { type: Number, required: true },
  bao_hiem: {
    bhxh: { type: Number, required: true },
    bhyt: { type: Number, required: true },
    bhtn: { type: Number, required: true },
    tong_bao_hiem: { type: Number, required: true }
  },
  thue_tncn: {
    giam_tru_ban_than: { type: Number, required: true },
    giam_tru_phu_thuoc: { type: Number, required: true },
    thu_nhap_tinh_thue: { type: Number, required: true },
    tien_thue: { type: Number, required: true }
  },
  thuc_linh_net: { type: Number, required: true },
  
  snapshot_tham_so: {
    luong_co_so: Number,
    giam_tru_ban_than: Number,
    giam_tru_phu_thuoc: Number,
    ty_le_bhxh: Number,
    ty_le_bhyt: Number,
    ty_le_bhtn: Number,
    bieu_thue_5_bac: [{ bac: Number, tu: Number, den: Number, thue_suat: Number }]
  },
  
  trang_thai: { 
    type: String, 
    enum: ['DU_THAO', 'CHO_DUYET', 'DA_DUYET', 'DA_KHOA', 'DA_THANH_TOAN'], 
    default: 'DU_THAO' 
  },
  khoa_luc: { type: Date, default: null }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

phieuLuongSchema.index({ nguoi_dung_id: 1, thang: 1, nam: 1 }, { unique: true });
```

---

### Collection 12: `ma_lam_moi` (Token Rotation & Anti-Replay)
```javascript
const maLamMoiSchema = new mongoose.Schema({
  nguoi_dung_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', required: true },
  chuoi_token: { type: String, required: true, unique: true },
  ma_ho: { type: String, required: true }, // Token Family UUID
  da_su_dung: { type: Boolean, default: false },
  thoi_diem_su_dung: { type: Date, default: null }, // Hỗ trợ Grace Period 15s
  thiet_bi: { type: String, default: null },
  dia_chi_ip: { type: String, default: null },
  het_han_luc: { type: Date, required: true }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });

maLamMoiSchema.index({ het_han_luc: 1 }, { expireAfterSeconds: 0 }); // TTL index tự hủy
maLamMoiSchema.index({ ma_ho: 1 });
```

---

### Collection 13: `cau_hinh_he_thong` (Bảng Tham Số Động)
```javascript
const cauHinhHeThongSchema = new mongoose.Schema({
  khoa_cau_hinh: { type: String, required: true, unique: true, trim: true, uppercase: true },
  gia_tri: { type: mongoose.Schema.Types.Mixed, required: true },
  nhom: { 
    type: String, 
    enum: ['AI', 'GPS', 'DEVICE', 'ATTENDANCE', 'SYSTEM', 'HE_THONG', 'DAO_TAO', 'TIEN_LUONG', 'THUE', 'CHUC_VU', 'CHAM_CONG', 'RETENTION'],
    default: 'SYSTEM'
  },
  mo_ta: { type: String, default: null },
  nguoi_cap_nhat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null }
}, { timestamps: { createdAt: 'tao_luc', updatedAt: 'cap_nhat_luc' } });
```

---

### Collection 14: `nhat_ky_kiem_toan` (Audit Trail Hệ Thống)
```javascript
const nhatKyKiemToanSchema = new mongoose.Schema({
  nguoi_thuc_hien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'nguoi_dung', default: null }, // Null khi login fail
  loai_chu_the: { type: String, enum: ['USER', 'SYSTEM'], default: 'USER' },
  hanh_dong: { type: String, required: true },
  loai_doi_tuong: { type: String, required: true },
  doi_tuong_id: { type: String, default: null },
  ket_qua: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  chi_tiet: { type: mongoose.Schema.Types.Mixed, default: {} },
  dia_chi_ip: { type: String, default: null },
  thong_tin_trinh_duyet: { type: String, default: null },
  ma_bam_truoc: { type: String, default: null },
  ma_bam_hien_tai: { type: String, default: null },
  thoi_diem: { type: Date, default: Date.now }
});

nhatKyKiemToanSchema.index({ thoi_diem: -1 });
nhatKyKiemToanSchema.index({ hanh_dong: 1, thoi_diem: -1 });
nhatKyKiemToanSchema.index({ nguoi_thuc_hien_id: 1, thoi_diem: -1 });

// Ràng buộc Tính Bất Biến Tuyệt Đối (Immutability / Append-Only) ở tầng Schema:
// Chặn đứng hoàn toàn mọi hành vi sửa đổi hoặc xóa bỏ bản ghi nhằm bảo toàn bằng chứng pháp lý
['save', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((method) => {
  nhatKyKiemToanSchema.pre(method, function (next) {
    if (!this.isNew && method === 'save') {
      const err = new Error('BẢO VỆ PHÁP LÝ: Bản ghi nhật ký kiểm toán (AuditLog) có tính chất bất biến (Immutable), nghiêm cấm chỉnh sửa!');
      err.status = 403;
      return next(err);
    }
    if (method !== 'save') {
      const err = new Error(`BẢO VỆ PHÁP LÝ: Nghiêm cấm thực hiện thao tác '${method}' trên bảng nhật ký kiểm toán (AuditLog)!`);
      err.status = 403;
      return next(err);
    }
    next();
  });
});
```

---

## 3. DANH MỤC KHÓA CẤU HÌNH HỆ THỐNG (`cau_hinh_he_thong`)

| STT | Khóa cấu hình | Giá trị mặc định (Mô phỏng quy chế nội bộ) |
|:--:|:---|:---|
| 1 | `HOC_KY` | `{"nam_hoc": "2026-2027", "hoc_ky": 1, "ngay_bat_dau": "2026-09-07", "so_tuan": 18}` *(thứ Hai tuần 1)* |
| 2 | `GEOFENCE_TRUONG` | `{"ten_co_so": "Trụ sở chính", "toa_do": [105.7826, 21.0378], "ban_kinh_met": 150}` |
| 3 | `DANH_SACH_PHONG_HOC` | `[{"ma_phong": "A101", "toa_do": [105.78261, 21.03781], "ban_kinh_met": 30}, {"ma_phong": "B202", "toa_do": [105.78270, 21.03790], "ban_kinh_met": 30}]` |
| 4 | `LUONG_CO_SO` | `2530000` *(Giả định cấu hình nội bộ)* |
| 5 | `GIAM_TRU` | `{"ban_than": 15500000, "phu_thuoc": 6200000}` |
| 6 | `TY_LE_BAO_HIEM` | `{"bhxh": 0.08, "bhyt": 0.015, "bhtn": 0.01}` |
| 7 | `BIEU_THUE_5_BAC` | `[{"bac":1,"tu":0,"den":10000000,"thue_suat":0.05},{"bac":2,"tu":10000000,"den":30000000,"thue_suat":0.10},{"bac":3,"tu":30000000,"den":60000000,"thue_suat":0.20},{"bac":4,"tu":60000000,"den":100000000,"thue_suat":0.30},{"bac":5,"tu":100000000,"den":null,"thue_suat":0.35}]` |
| 8 | `DON_GIA_GIO` | `120000` *(đồng/giờ chuẩn)* |
| 9 | `DINH_MUC_GIO_CHUAN` | `135` *(giờ chuẩn/học kỳ cho giảng viên tiêu chuẩn)* |
| 10 | `TY_LE_UU_DAI` | `{"GIANG_VIEN": 0.30, "HANH_CHINH": 0.00}` *(30% phụ cấp ưu đãi nghề giáo)* |
| 11 | `CHUC_VU` | `[{"ma_chuc_vu":"HIEU_TRUONG","he_so_phu_cap":1.0,"ty_le_giam_dinh_muc":0.80},{"ma_chuc_vu":"TRUONG_KHOA","he_so_phu_cap":0.7,"ty_le_giam_dinh_muc":0.30},{"ma_chuc_vu":"TRUONG_BO_MON","he_so_phu_cap":0.5,"ty_le_giam_dinh_muc":0.20},{"ma_chuc_vu":"TRUONG_PHONG","he_so_phu_cap":0.6,"ty_le_giam_dinh_muc":0.00},{"ma_chuc_vu":"PHO_TRUONG_KHOA","he_so_phu_cap":0.5,"ty_le_giam_dinh_muc":0.20},{"ma_chuc_vu":"PHO_TRUONG_PHONG","he_so_phu_cap":0.4,"ty_le_giam_dinh_muc":0.00}]` |
| 12 | `HE_SO_QUY_DOI_GIO`| `{"hinh_thuc":{"LY_THUYET":1.0,"THUC_HANH":0.7},"he_dao_tao":{"CHINH_QUY":1.0,"CHAT_LUONG_CAO":1.2,"VUA_LAM_VUA_HOC":1.1,"SAU_DAI_HOC":1.5},"si_so":[{"den":40,"he_so":1.0},{"den":80,"he_so":1.1},{"den":999,"he_so":1.2}]}` |
| 13 | `NGUONG_AI` | `{"mo_hinh": "buffalo_s", "so_chieu": 512, "cosine_min": 0.45, "liveness_min": 0.85}` *(Giá trị khởi đầu tham chiếu. Được cập nhật sau thực nghiệm Tuần 3; truyền động theo request, thay đổi tức thì mà KHÔNG cần build/restart server)* |
| 14 | `MARGIN_TOP1_TOP2` | `0.05` *(Độ lệch tối thiểu giữa Cosine Top 1 và Top 2; dưới ngưỡng này bị coi là không chắc chắn và từ chối nhận diện)* |
| 15 | `COOLDOWN_QUET_GIAY` | `60` *(Khoảng thời gian tối thiểu giữa 2 lần nhận diện thành công của cùng 1 người, chống ghi nhận lặp)* |
| 16 | `QUY_TAC_DIEM_DANH` | `{"cua_so_checkin_truoc_phut": 30, "ty_le_du_gio": 0.80, "ty_le_nua_gio": 0.50, "lam_tron_tiet": "FLOOR"}` |
| 17 | `RETENTION_ANH_NAM` | `1` *(Thời hạn lưu file ảnh bằng chứng điểm danh; tự động gỡ sau 1 năm)* |
| 18 | `RETENTION_METADATA_NAM` | `5` *(Thời hạn lưu metadata lượt quét và công tổng hợp phục vụ thanh tra, kiểm toán trước khi ẩn danh/kho lạnh)* |
| 19 | `CRON_LAST_RUN` | Lưu chuỗi `YYYY-MM-DD` ngày chạy thành công gần nhất phục vụ Catch-Up |

---

## 4. CÁC QUY TRÌNH & THUẬT TOÁN NGHIỆP VỤ CỐT LÕI

### 4.1. Token Rotation có Grace Period Cache 15s & Thu Hồi Phiên
- **Grace Period (15s):** Bộ nhớ đệm Node.js lưu `tokenRotationCache = new Map()`. Khi một Refresh Token cũ được gửi lại trong vòng 15 giây (do các request đồng thời từ frontend), hệ thống trả về ngay cặp token đã cấp trong cache mà không coi là tấn công. Sau 15 giây, hành vi gửi lại token cũ sẽ bị xem là Replay Attack $\rightarrow$ Hủy toàn bộ chuỗi token trong cùng `ma_ho`.
- **Thu hồi JWT tức thì:** Payload JWT chứa `tokenVersion`. Khi người dùng đổi mật khẩu hoặc đăng xuất, hệ thống tăng `user.phien_ban_token++`. Middleware xác thực đối chiếu `jwt.tokenVersion === user.phien_ban_token` để từ chối ngay lập tức.
- **Bảo mật OTP:** Mã OTP được băm bằng **HMAC-SHA256** với secret key bí mật và so sánh qua `crypto.timingSafeEqual`.

### 4.2. Luồng Check-In Thời Gian Thực & Cron 02:05 Sáng qua `khoa_cong`
- **Ban ngày (08:00 AM) - Check-In:**
  - Sinh khóa duy nhất: `khoa_cong = ${userId}_${todayStr}_${caId}_${schedId}`.
  - Thực hiện Upsert vào `nhat_ky_cham_cong`: Ghi nhận `thoi_gian_vao`, tính `phut_di_muon`, gán `trang_thai = 'DUNG_GIO'` hoặc `'DI_MUON'`. **`so_tiet_thuc_day = 0`**.
- **Khi Check-Out (11:30 AM):**
  - Ghi nhận `thoi_gian_ra`, tính `phut_ve_som`.
  - **Tính tỷ lệ có mặt thực tế (Đọc từ cấu hình `QUY_TAC_DIEM_DANH`):**
    + Khoảng thời gian có mặt hợp lệ được giới hạn (clamped) trong khung giờ chính thức của ca học:
      $$\text{start} = \max(\text{thoi\_gian\_vao}, \text{gio\_bat\_dau\_ca}), \quad \text{end} = \min(\text{thoi\_gian\_ra}, \text{gio\_ket\_thuc\_ca})$$
      $$\text{thoi\_gian\_co\_mat\_phut} = \max\left(0, \frac{\text{end} - \text{start}}{60000}\right)$$
      $$\text{ty\_le\_co\_mat} = \frac{\text{thoi\_gian\_co\_mat\_phut}}{\text{thoi\_luong\_ca\_phut}}$$
    + Nếu $\text{ty\_le\_co\_mat} \ge \text{ty\_le\_du\_gio}$ (mặc định 0.80): Gán $100\%$ số tiết quy định của ca (`so_tiet_thuc_day = lich.so_tiet`).
    + Nếu $\text{ty\_le\_nua\_gio} \le \text{ty\_le\_co\_mat} < \text{ty\_le\_du\_gio}$ (mặc định $0.50 \le \text{tỷ lệ} < 0.80$): Gán $50\%$ số tiết quy định.
    + Nếu $\text{ty\_le\_co\_mat} < \text{ty\_le\_nua\_gio}$ ($< 0.50$): Gán $0$ tiết (`so_tiet_thuc_day = 0`). Reset cờ `quen_quet_ra = false`.
- **Ban đêm (02:05 AM hôm sau) - Cron `sinhCongNgay`:**
  - Chạy quét toàn bộ lịch của ngày hôm trước với `$setOnInsert`.
  - Với những ca đã check-in ban ngày: Bản ghi đã tồn tại $\rightarrow$ Bỏ qua hoàn toàn, không đè `VANG_MAT`.
  - Với ca chưa có giờ ra $\rightarrow$ Cập nhật cờ `quen_quet_ra = true`.
  - Với người không có lượt quét nào $\rightarrow$ Sinh bản ghi `VANG_MAT` (hoặc `NGHI_PHEP` / `NGHI_LE`).

### 4.3. Cơ Chế Catch-Up Khi Máy Chủ Khởi Động
- Đọc `CRON_LAST_RUN`.
- Nếu server khởi động trước 02:05 sáng thì chỉ bù đến ngày $T-2$ (tránh kết luận quên quẹt ra sớm cho các ca tối muộn).
- Nếu server khởi động sau 02:05 sáng thì bù đến $T-1$. Bù tối đa không quá 31 ngày.

### 4.4. Phân Quyền Duyệt Đơn Đa Cấp & Chặn Tự Duyệt (`deanScope`)
- **Chặn tự duyệt:** Người làm đơn tuyệt đối không được phép tự phê duyệt đơn của chính mình.
- **Duyệt Cấp 1 khối Giảng viên:** Do Trưởng khoa (`TRUONG_KHOA`) hoặc Trưởng bộ môn (`TRUONG_BO_MON`) phụ trách duyệt (Phó trưởng duyệt khi có `duoc_uy_quyen: true`).
- **Duyệt Cấp 1 khối Hành chính:** Do Trưởng phòng (`TRUONG_PHONG`) phụ trách duyệt cho chuyên viên/nhân viên thuộc phòng ban đó (Phó phòng duyệt khi có `duoc_uy_quyen: true`).
- **Kiểm tra phạm vi (`deanScope`):** Hàm `kiemTraThuocPhamViDonVi` đệ quy lên cây đơn vị tối đa 5 cấp để xác thực đơn vị người duyệt là cấp cha/ông của người làm đơn.
- **Đơn của Trưởng đơn vị:** Nếu người làm đơn là Trưởng khoa hoặc Trưởng phòng, do bị chặn tự duyệt cấp 1, đơn tự động nhảy thẳng lên **Cấp 2** (`CHO_BGH_DUYET`) để Ban Giám Hiệu hoặc Phòng TCCB phê duyệt.
- **Chống Race Condition duyệt đồng thời:** Áp dụng cơ chế Optimistic Locking khi cập nhật trạng thái đơn:
  `LeaveRequest.findOneAndUpdate({ _id: donTuId, trang_thai: trangThaiHienTai }, { ... }, { session, new: true })`. Nếu kết quả trả về `null` nghĩa là đơn đã bị người khác duyệt hoặc thay đổi trạng thái trước đó, hệ thống lập tức rollback transaction và thông báo lỗi.

### 4.5. Hồi Tố Công Khi Duyệt Đơn & Hoàn Tác Khi Hủy Đơn (ACID)
- **Đảm bảo tính toàn vẹn (ACID):** Toàn bộ thao tác duyệt đơn, cập nhật `lich_su_duyet`, đổi trạng thái, cập nhật ngoại lệ TKB, và hồi tố công đều nhận và thực thi qua cùng một **MongoDB Transaction Session**:
  `capNhatHoiToCongKhiDuyetDon(userId, tuNgay, denNgay, loaiDon, donTuId, session)`.
- **Nguồn sự thật:** Nguồn dữ liệu chính xác nhất về nghỉ phép là `don_tu` (đơn đã ở trạng thái `CHAP_THUAN`). Mảng `ngoai_le[]` trên `lich_giang_day` chỉ là bản ghi phản chiếu (projection) cho buổi học cụ thể để hiển thị trên TKB.
- **Bảo toàn ca đã check-in:** Chỉ hồi tố tác động lên các ca thực tế không đi làm (`thoi_gian_vao: null`). Ca thực tế đã đi dạy/quét thẻ không bao giờ bị đè thành vắng.
- **Khi hủy đơn đã duyệt:** Gỡ bỏ mục ngoại lệ trong `lich_giang_day.ngoai_le[]` có `don_tu_id: donTuId`. Gom truy vấn ngày lễ trong khoảng trước vòng lặp (tránh N+1 query) để hoàn tác bản ghi công về `NGHI_LE` (nếu trùng ngày lễ) hoặc `VANG_MAT`.

### 4.6. Tính Ngày Nghỉ Thực Tế & Quản Lý Quota Phép Bằng Aggregation
- **Quota phép tính bằng Aggregation Pipeline (Chuẩn múi giờ VN `Asia/Ho_Chi_Minh`, tính cả đơn chờ duyệt):**
  ```javascript
  const tz = 'Asia/Ho_Chi_Minh';
  const dauNam = moment().tz(tz).startOf('year').toDate();
  const cuoiNam = moment().tz(tz).endOf('year').toDate();

  const aggregateResult = await LeaveRequest.aggregate([
    {
      $match: {
        nguoi_tao_id: userId,
        loai_don: 'PHEP_NAM',
        // Tính cả đơn đang chờ để chống nộp đồng thời vượt hạn mức (chống race condition):
        trang_thai: { $in: ['CHO_DUYET', 'CHO_BGH_DUYET', 'CHAP_THUAN'] },
        tu_ngay: { $gte: dauNam, $lte: cuoiNam }
      }
    },
    { $group: { _id: null, tongSoNgay: { $sum: '$so_ngay_nghi' } } }
  ]);
  const tongNgayDaDungHoacCho = aggregateResult[0]?.tongSoNgay || 0;
  ```
- **Chặn nộp vượt hạn mức:** Kiểm tra `tongNgayDaDungHoacCho + soNgayXinMoi > user.han_muc_phep_nam` ngay khi tạo đơn.
- **Xử lý đơn vắt qua 2 năm (vd: từ 30/12 đến 03/01 năm sau):**
  + Hệ thống chia tách số ngày nghỉ thực tế thuộc năm $N$ và năm $N+1$ theo múi giờ `Asia/Ho_Chi_Minh`.
  + Số ngày nghỉ rơi vào năm $N$ sẽ được đối soát với quota năm $N$; số ngày rơi vào năm $N+1$ đối soát với quota năm $N+1$. Giao diện tự động cảnh báo hoặc đề xuất tách thành 2 đơn nếu chính sách trường yêu cầu quyết toán phép dứt điểm theo năm tài chính.
- **Quy trình chuyển trạng thái `DA_HUY` khi đơn đã duyệt:**
  + Người tạo đơn (hoặc Admin/Trưởng đơn vị) gửi yêu cầu hủy đơn với lý do cụ thể.
  + Chạy qua MongoDB Transaction Session: Chuyển `trang_thai = 'DA_HUY'`, ghi nhận `lich_su_duyet`, kích hoạt `hoanTacCongKhiHuyDon`: Gỡ bản ghi trong `lich_giang_day.ngoai_le[]` và hoàn tác bản ghi `nhat_ky_cham_cong` về `VANG_MAT` hoặc `NGHI_LE`.
  + Vì `DA_HUY` không nằm trong danh sách `['CHO_DUYET', 'CHO_BGH_DUYET', 'CHAP_THUAN']`, pipeline Aggregation tự động giải phóng quota phép ngay lập tức mà không cần cộng tay.

### 4.7. Chống Xung Đột Lịch Giảng Dạy & Race Condition Xếp Lịch
- **Nguyên tắc chống Race Condition khi xếp lịch đồng thời:**
  + Mọi thao tác thêm mới hoặc sửa đổi thời khóa biểu phải thực thi trong **MongoDB Transaction** với mức cô lập cao.
  + Trước khi ghi, hệ thống thực hiện truy vấn khóa bi quan/lạc quan kiểm tra xung đột trên cả 2 chiều:
    1. **Xung đột Giảng viên:** Cùng `nam_hoc`, `hoc_ky`, `giang_vien_id`, có ít nhất một tuần chung trong `danh_sach_tuan`, cùng `thu_trong_tuan` (hoặc cùng ngày bù với `DAY_BU`), và có khoảng tiết chồng lấn:
       $$\max(Start_1, Start_2) \le \min(End_1, End_2)$$
    2. **Xung đột Phòng học:** Cùng `nam_hoc`, `hoc_ky`, `phong_hoc`, có tuần chung, cùng thứ, và khoảng tiết chồng lấn.
- **Ràng buộc toàn vẹn danh mục:**
  + `phong_hoc` bắt buộc phải tồn tại trong cấu hình `DANH_SACH_PHONG_HOC`.
  + `ca_id` bắt buộc phải khớp với khung giờ của `tiet_bat_dau` và `so_tiet` (ví dụ: Tiết 1-3 thuộc Ca sáng 1; Tiết 4-6 thuộc Ca sáng 2). Ném lỗi `VALIDATION_ERROR` nếu giáo vụ chọn lệch ca và tiết.
- Lịch `DAY_BU` được so sánh trực tiếp ngày bù với các lịch chính khóa và lịch bù khác. Bỏ qua các buổi đã có trạng thái `HUY` trong mảng `ngoai_le[]`.

### 4.8. Quy Đổi Giờ Chuẩn Giảng Dạy, Thuế Snapshot 2026 & Xoay Khóa CCCD
- **Công thức Quy Đổi Giờ Chuẩn Giảng Dạy Đại Học:**
  $$\text{Giờ chuẩn} = \text{Số tiết thực dạy} \times H_{\text{hình thức}} \times H_{\text{hệ đào tạo}} \times H_{\text{sĩ số}}$$
  Trong đó:
  - $H_{\text{hình thức}}$: Lý thuyết = 1.0, Thực hành/Thí nghiệm = 0.7.
  - $H_{\text{hệ đào tạo}}$: Chính quy = 1.0, Chất lượng cao = 1.2, Vừa làm vừa học = 1.1, Sau đại học = 1.5.
  - $H_{\text{sĩ số}}$: Lớp đến 40 SV = 1.0, đến 80 SV = 1.1, trên 80 SV = 1.2.
  - Định mức giờ chuẩn: Giảng viên tiêu chuẩn = 135 giờ chuẩn/kỳ (45 giờ/tháng). Tỷ lệ giảm trừ chức vụ: Trưởng khoa giảm 30%, Phó khoa giảm 20%, Trưởng bộ môn giảm 20%.
  - Thù lao vượt giờ: $\max(0, \text{Giờ chuẩn thực dạy} - \text{Định mức}) \times 120.000$đ/giờ chuẩn.
- **Thuật toán Tính Thuế TNCN Lũy Tiến 5 Bậc (Luật Thuế TNCN sửa đổi 2026):**
  - Giảm trừ bản thân: 15.500.000đ/tháng, Giảm trừ người phụ thuộc: 6.200.000đ/người/tháng.
  - Bảo hiểm bắt buộc 10.5% (8% BHXH, 1.5% BHYT, 1% BHTN).
  - Biểu thuế lũy tiến 5 bậc năm 2026:
    * Bậc 1: $\le 10$ triệu: $5\%$
    * Bậc 2: $> 10$ đến $30$ triệu: $10\% - 500.000$đ
    * Bậc 3: $> 30$ đến $60$ triệu: $20\% - 3.500.000$đ
    * Bậc 4: $> 60$ đến $100$ triệu: $28\% - 8.300.000$đ
    * Bậc 5: $> 100$ triệu: $35\% - 15.300.000$đ
- **Cơ chế Snapshot Tham Số & Khóa Lương (`isLocked` / `DA_KHOA`):**
  - Toàn bộ tham số cấu hình tại thời điểm tính lương (`luong_co_so`, `giam_tru_ban_than`, `giam_tru_phu_thuoc`, `ty_le_bhxh`, `ty_le_bhyt`, `ty_le_bhtn`, `bieu_thue_5_bac`) được chụp lại nguyên trạng vào trường `snapshot_tham_so` của `Payroll`.
  - Khóa sổ bảng lương: Khi Admin/BGH khóa lương (`POST /api/payrolls/lock`), hệ thống chuyển trạng thái sang `DA_KHOA`, cấm mọi hành vi chỉnh sửa hoặc tính toán lại (lỗi 403 `PAYROLL_LOCKED`), đồng thời tự động khóa đồng bộ các bản ghi `AttendanceLog` (`da_chot = true`, `isLocked = true`) trong tháng.
- **Xoay Khóa Bảo Mật Mã Hóa CCCD (AES-256-GCM):**
  - Số căn cước công dân của cán bộ được mã hóa đối xứng AES-256-GCM với IV ngẫu nhiên 12 bytes và Auth Tag 16 bytes trước khi lưu vào `so_cccd_ma_hoa`.
  - Quản lý phiên bản khóa bảo mật qua trường `phien_ban_khoa_cccd`. Script `scripts/rotateCccdKey.js` hỗ trợ tự động giải mã bằng khóa phiên bản cũ và tái mã hóa bằng khóa phiên bản mới mà không làm gián đoạn hệ thống.

### 4.9. Sinh Trắc Học Face AI, Động Cơ Nhận Diện 1:N RAM & Đồng Bộ Hai Nguồn Sự Thật
- **Mô hình Trích Xuất Vector Đặc Trưng 512 Chiều:**
  - Vi dịch vụ Python FastAPI sử dụng InsightFace `buffalo_s` (MobileFaceNet backbone).
  - Đăng ký đa góc 5 ảnh (`POST /v1/face/enroll-multi-angle`): Chụp 5 tư thế tuần tự (Chính diện, Trái, Phải, Ngước, Cúi). Hệ thống trích xuất 5 vector 512D, chuẩn hóa $L_2$ norm và tính vector trọng tâm trung bình (`computeNormalizedCentroid`).
  - Chống trùng lặp sinh trắc học (`checkDuplicateFace`): So khớp với toàn bộ vector hiện có, nếu khoảng cách Euclidean $L_2 < 0.35$ (hoặc Cosine Similarity > 0.85) với người khác thì chặn đứng với lỗi 409 Conflict nhằm chống hành vi đăng ký mạo danh.
- **Động Cơ Nhận Diện 1:N Tốc Độ Cao Trên RAM:**
  - So khớp Cosine Similarity cực nhanh trong RAM bằng Pure NumPy Dot Product (`np.dot(matrix, query_vec)` trên CPU, độ trễ ~2ms cho 5.000 nhân sự; không dùng thư viện ngoài cồng kềnh để giữ vi dịch vụ siêu nhẹ).
  - **Quy tắc Margin Top 1 - Top 2 ($\ge 0.05$):** Nếu $\text{Sim}_{\text{top1}} - \text{Sim}_{\text{top2}} < 0.05$ (độ lệch giữa 2 ứng viên cao điểm nhất quá hẹp): Hệ thống đánh giá là không chắc chắn (`AMBIGUOUS_MATCH`) $\rightarrow$ từ chối nhận diện tự động để triệt tiêu nguy cơ nhận diện nhầm lẫn giữa các khuôn mặt tiệm cận nhau.
  - **Chống quét lặp (Cooldown 60s):** Bộ nhớ đệm in-memory kiểm tra thời điểm quẹt thẻ gần nhất của từng nhân viên. Nếu cùng một người quẹt lại trong vòng 60 giây, hệ thống trả về `RECENTLY_SCANNED` kèm `retryAfterSeconds` để chống spam bản ghi.
  - **Bảo vệ quyền riêng tư (Privacy-by-Design):** Ở chế độ Production, trường `candidates` bị ẩn hoàn toàn trong response trả về Camera Client / Web Modal, chỉ trả về thông tin của nhân sự khớp duy nhất.
- **Quy Tắc Đồng Bộ Hai Nguồn Sự Thật (Node.js MongoDB $\leftrightarrow$ Python RAM):**
  - *Nguồn Sự Thật Duy Nhất (Ground Truth):* MongoDB Collection `du_lieu_khuon_mat`.
  - *Bộ Nhớ Đệm Tạm Thời (In-Memory Cache):* Ma trận RAM của Python `MemoryVectorIndex`.
  - *Cơ Chế Tự Phục Hồi (Auto Self-Healing on Service Restart):* Node.js duy trì hàm `ensureRamCacheWarm()` trong `faceServiceClient.js`. Khi phát hiện Python service khởi động lại hoặc RAM Index rỗng (`total_vectors == 0`), hệ thống tự động truy vấn MongoDB đọc toàn bộ `FaceTemplate` và kích hoạt `POST /v1/face/sync` nạp lại toàn bộ vector lên RAM, đảm bảo hệ thống tự phục hồi 100% không cần can thiệp thủ công.

### 4.10. Trợ Lý AI Chatbot Đa Mô Hình (Gemini/Claude/DeepSeek/Local) & Tri Thức Quy Chế 2026
- **Bộ Định Tuyến Đa Nhà Cung Cấp LLM (Multi-Provider Router):**
  - Hỗ trợ linh hoạt 4 nền tảng LLM hàng đầu: **Google Gemini** (`gemini-1.5-flash`, `gemini-2.0-flash`), **Anthropic Claude** (`claude-3-5-sonnet`), **DeepSeek** (`deepseek-chat`, `deepseek-r1`), và **Local LLM / Ollama** (`http://localhost:11434/v1`).
  - Tự động nhận diện API key từ môi trường hệ thống (`.env`) hoặc chuyển đổi tức thì thông qua trường `provider` trong request body.
- **Cơ Sở Tri Thức Quy Chế Nhà Trường Năm 2026 (University Regulations Knowledge Engine):**
  - Tích hợp sẵn bộ tri thức 5 chuyên đề đào tạo & nhân sự đại học chuẩn hóa năm 2026:
    1. *Chấm công & Ca làm việc:* Khung giờ ca sáng/chiều, buffer check-in/out, Geofence trường 150m, phòng học 30m.
    2. *Nghỉ phép & Phê duyệt:* Phân luồng duyệt 1 cấp (Khoa $\le 3$ ngày) và 2 cấp (BGH $> 3$ ngày), hạn mức phép năm, dạy bù bắt buộc.
    3. *Định mức giờ giảng:* 135 giờ chuẩn/kỳ (45 giờ/tháng), thù lao vượt giờ 120.000đ/giờ chuẩn, tỷ lệ giảm trừ chức vụ lãnh đạo.
    4. *Tiền lương & Thuế TNCN 2026:* Lương cơ sở 2.530.000đ, phụ cấp ưu đãi nghề 30%, bảo hiểm 10.5%, giảm trừ gia cảnh 15.5tr/6.2tr, biểu thuế lũy tiến 5 bậc.
    5. *Sinh trắc học Face AI:* ArcFace 512D, đăng ký 5 góc, Margin Top 1-2 $\ge 0.05$, Cooldown 60s, kiểm tra Liveness Euler 3D.
  - **Local Rule-Based Knowledge Engine:** Khi ngoại tuyến hoặc không có kết nối ra ngoài Internet, hệ thống tự động kích hoạt bộ máy phản xạ nội bộ để trích xuất số liệu quy chế chuẩn xác 100%.
- **Tra Cứu Dữ Liệu Chấm Công & Thù Lao Thông Minh (Mode `attendance`):**
  - Xử lý ngôn ngữ tự nhiên (NLU / Intent Parsing) từ câu hỏi tiếng Việt của người dùng.
  - **Cơ chế Làm rõ danh tính (Disambiguation):** Khi câu hỏi chứa tên nhân sự mà hệ thống tìm thấy nhiều cán bộ trùng tên (vd: "Thầy An", "Cô Linh"), AI tự động trả về danh sách phân biệt kèm mã cán bộ, học vị, đơn vị công tác để người dùng chọn chính xác.
  - **Thực thi phân quyền RBAC nghiêm ngặt:** Giảng viên chỉ được tra cứu công và phiếu lương của chính mình; Trưởng khoa chỉ được xem nhân sự trong khoa trực thuộc; chỉ Ban Giám Hiệu và Phòng TCCB mới có quyền tra cứu toàn trường. Mọi hành vi vượt quyền đều bị AI lịch sự từ chối.

### 4.11. Kiến Trúc Container Hóa Docker & Docker Compose Toàn Diện
- **Mô hình Multi-Container Orchestration (`docker-compose.yml`):**
  - `mongo`: Chạy MongoDB 7.0 Community Edition với cấu hình Replica Set `--replSet rs0` thông qua container phụ `mongo-init` tự động khởi tạo `rs.initiate()`, đáp ứng yêu cầu bắt buộc của MongoDB Multi-Document ACID Transactions.
  - `face-service`: Đóng gói Python 3.10 slim, cài đặt các thư viện C++ và OpenGL cần thiết (`build-essential`, `cmake`, `libgl1`, `libglib2.0-0`), gắn volume lưu trữ models (`insightface_models`) và thư mục ảnh minh chứng (`./uploads`), lắng nghe trên cổng 8001.
  - `web`: Đóng gói ứng dụng tích hợp Node.js Express Backend và React Frontend qua Multi-stage Dockerfile:
    * *Stage 1 (Builder):* `node:20-alpine`, cài đặt dependencies, biên dịch mã nguồn React TypeScript với Vite sang thư mục tĩnh `/app/dist`.
    * *Stage 2 (Runner):* `node:20-alpine`, chỉ cài đặt production dependencies (`npm ci --omit=dev`), sao chép backend `server/` và static bundle `dist/`, tích hợp cơ chế `HEALTHCHECK` kiểm tra định kỳ endpoint `/api/health`.
  - Mạng nội bộ biệt lập `app_network` đảm bảo kết nối bảo mật giữa các container và khởi chạy tuần tự theo trạng thái `service_healthy`.

### 4.12. Tài Liệu Chuẩn Swagger OpenAPI 3.0 & 26 RESTful Endpoints
- **Cấu hình OpenAPI 3.0 Tập Trung (`server/config/swagger.js` & `server/config/swaggerPaths.js`):**
  - Giao diện tài liệu tương tác trực quan Swagger UI tại đường dẫn `http://localhost:5000/api-docs`.
  - Bổ sung Schemas dữ liệu chuẩn: `Payroll`, `FaceTemplate`, `SystemConfig`, `AuditLog`.
  - Chuẩn hóa 14 nhóm `swaggerTags` chức năng và 26 Endpoints RESTful cốt lõi:
    * *Authentication:* `/api/auth/login`, `/api/auth/refresh-token`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password`, `/api/auth/avatar`.
    * *Face Biometrics:* `/api/face/detect-pose`, `/api/face/enroll-multi-angle`, `/api/face/registration-status/{userId}`, `/api/face/faces/{userId}`, `/api/face/health`.
    * *Attendance:* `/api/attendance/check-in`, `/api/attendance/check-out`, `/api/attendance/qr-code`, `/api/attendance/history`, `/api/attendance/my-history`.
    * *Leave Management:* `/api/leave-requests`, `/api/leave-requests/{id}/approve`, `/api/leave-requests/{id}/reject`, `/api/leave-requests/{id}/cancel`.
    * *Payroll Management:* `/api/payrolls/generate`, `/api/payrolls`, `/api/payrolls/my-payroll`, `/api/payrolls/{id}/lock`, `/api/payrolls/{id}/unlock`, `/api/payrolls/export/excel`, `/api/payrolls/{id}/export/pdf`.
    * *System & Audit:* `/api/audit-logs`, `/api/system/configs`, `/api/health`.

### 4.13. Sơ Đồ Kiến Trúc & Ma Trận 17 Phân Hệ Giao Diện Frontend
Hệ thống Frontend được xây dựng hoàn chỉnh với React 19, TypeScript, Vite và TailwindCSS, gồm 17 phân hệ chức năng:
1. `Dashboard.tsx`: Bảng điều khiển trung tâm hiển thị biểu đồ tỷ lệ chuyên cần, thẻ chỉ số nhân sự, danh sách ca dạy hôm nay.
2. `AttendanceMe.tsx`: Trang chấm công cá nhân, theo dõi lịch sử quẹt thô (PunchLog) và trạng thái công tổng hợp.
3. `AttendanceManage.tsx`: Quản lý điểm danh đơn vị/toàn trường theo phạm vi `deanScope`, điều chỉnh công có lưu vết Audit Log.
4. `FaceRegistrationPage.tsx`: Trang đăng ký khuôn mặt 5 góc thời gian thực kèm HUD đo góc Euler 3D và tự động chụp.
5. `Schedules.tsx`: Quản lý thời khóa biểu học kỳ, thêm lịch chính khóa/dạy bù, kiểm tra xung đột phòng và giảng viên.
6. `LeaveRequests.tsx`: Nộp đơn và phê duyệt đơn nghỉ phép đa cấp (Khoa $\rightarrow$ BGH), chặn tự duyệt, khóa lạc quan 409.
7. `Payroll.tsx`: Quản lý bảng lương năm 2026, thuế lũy tiến 5 bậc, phiếu thu nhập cá nhân, khóa lương, xuất Excel/PDF.
8. `AIChat.tsx`: Trợ lý AI chatbot hỏi đáp quy chế nhà trường 2026, tra cứu công thông minh, hỗ trợ đa mô hình LLM.
9. `Users.tsx`: Quản lý hồ sơ cán bộ, cấp phát tài khoản, phân quyền 10 chức danh đại học, quản lý nhiệm kỳ.
10. `Departments.tsx`: Quản lý cây cơ cấu tổ chức Khoa, Bộ môn, Phòng ban chức năng.
11. `Shifts.tsx`: Quản lý cấu hình ca làm việc, buffer quẹt thẻ và hệ số công.
12. `Subjects.tsx`: Quản lý danh mục học phần, mã môn học, số tín chỉ và số tiết đào tạo.
13. `Holidays.tsx`: Quản lý ngày nghỉ lễ toàn trường theo năm dương lịch, loại trừ ngày công chuẩn.
14. `Reports.tsx`: Báo cáo chuyên sâu tỷ lệ chuyên cần theo đơn vị, phân tích vi phạm Geofence GPS.
15. `AuditLogs.tsx`: Tra cứu nhật ký kiểm toán an toàn bất biến (Append-Only) cho Admin & BGH.
16. `Settings.tsx`: Bảng điều khiển 19 tham số cấu hình động toàn trường (`SystemConfig`).
17. `Login.tsx`: Cổng đăng nhập xác thực JWT an toàn, tích hợp bảng chọn tài khoản demo nhanh cho 13 chức danh mẫu.

---

## 5. MỤC HẠN CHẾ CỦA ĐỒ ÁN & PHIẾU ĐỒNG Ý THU THẬP SINH TRẮC

### 5.1. Định Vị Bản Kiến Trúc Nâng Cấp v2.5+ & Bảng Ánh Xạ Chuyển Tiếp (Legacy to Canonical)
Bản đặc tả v2.5+ này là **Bản Kiến Trúc CSDL Nâng Cấp Chuẩn (Super-set Canonical Architecture)**, bảo toàn và nâng cấp các Module ứng dụng hiện có trong codebase mà không làm gãy logic vận hành:

#### Bảng Ánh Xạ Chuyển Tiếp (Legacy to Canonical Migration Map)
| Phân hệ / Module | Mã nguồn hiện có | Cấu trúc Cũ (Legacy) | Cấu trúc Mới v2.5+ (Canonical) | Cơ chế tương thích ngược (Backward Compatibility) |
|:---|:---|:---|:---|:---|
| **Trợ lý AI Gemini** | `server/services/aiAssistant.service.js` | Đọc `AttendanceLog` (fields: `userId`, `date`, `status`, `checkIn`, `checkOut`) | Đọc `nhat_ky_cham_cong` (fields: `nguoi_dung_id`, `ngay_cham_cong_str`, `trang_thai`, `thoi_gian_vao`, `thoi_gian_ra`) | Cung cấp Mongoose Virtuals & Schema Aliases (`date` $\leftrightarrow$ `ngay_cham_cong_str`, `status` $\leftrightarrow$ `trang_thai`) giúp Gemini query không lỗi. |
| **Báo cáo Xuất Excel** | `server/services/report.service.js` | Xuất bảng công từ `attendance_logs`, phòng ban từ `department` | Kết xuất từ `nhat_ky_cham_cong`, liên kết `don_vi` và `ca_lam_viec` | Mapper hàm `formatAttendanceRow()` tự động bóc tách `so_tiet_thuc_day`, `phut_di_muon`, `quen_quet_ra` ra các cột báo cáo chuẩn. |
| **Quản lý Thông báo** | `server/services/notification.service.js` | Gửi email cảnh báo vắng khi cron ghi log vắng | Lắng nghe sự kiện Cron 02:05 hoặc duyệt đơn từ `don_tu` | Giữ nguyên EventEmitter và giao diện hàm `sendAttendanceAlert()`, nhận payload ánh xạ từ `congTongHop`. |
| **Xác thực & Vai trò** | `server/models/user.model.js` | Role phẳng chuỗi string (`admin`, `teacher`, `truongkhoa`) | Mảng đối tượng `vai_tro[]` có nhiệm kỳ và phạm vi đơn vị | Thêm getter ảo `user.role`: Tự động trả về mã vai trò cao nhất đang còn hạn (`den_ngay === null`) cho các middleware cũ. |
| **Camera Điểm Danh** | `src/components/FaceAttendanceScannerModal.tsx` | Gửi request điểm danh nhận diện khuôn mặt | Gọi API Face Service `/v1/face/recognize` qua Node.js Backend Proxy | Client nhận response ẩn `candidates`, chỉ hiển thị thông báo chào mừng nhân sự khớp duy nhất. |

### 5.2. Tuyên Bố Hạn Chế Kỹ Thuật & Chính Sách Lưu Trữ Dữ Liệu (Retention)
1. **Liveness Detection:** Thuật toán phát hiện giả mạo khuôn mặt được xây dựng dựa trên phân tích kết cấu và quang phổ màu ở mức cơ bản phục vụ môi trường thực nghiệm học thuật, chưa qua kiểm định định lượng theo chuẩn quốc tế APCER/BPCER.
2. **Lưu trữ Vector nhúng:** Vector đặc trưng 512D được lưu dạng số thực trong CSDL phục vụ nạp thẳng vào RAM Cache (`np.dot` trên CPU). Chưa áp dụng mã hóa mức cột (Column-level encryption) nhằm ưu tiên độ trễ thời gian thực.
3. **Môi trường Grace Period Cache:** Triển khai dạng In-memory LRU Cache đơn máy chủ (Single-Instance Node.js).
4. **Tham số Lương/Thuế:** Các con số (Lương cơ sở 2.530.000 đ, giảm trừ gia cảnh, biểu thuế 5 bậc) là các tham số giả định mô phỏng quy chế chi tiêu nội bộ của cơ sở giáo dục, dễ dàng cấu hình lại khi chính sách thay đổi.
5. **Chính sách phân tầng lưu trữ (Data Retention Policy):**
   - **Tệp ảnh vật lý (`anh_bang_chung_url`):** Tự động gỡ bỏ sau **1 năm** (`RETENTION_ANH_NAM: 1`) để tiết kiệm không gian lưu trữ và giảm thiểu rủi ro lộ lọt hình ảnh.
   - **Dữ liệu số (Metadata) lượt quét & Ngày công:** Được bảo lưu an toàn **5 năm** (`RETENTION_METADATA_NAM: 5`) trong `luot_quet_cham_cong` và `nhat_ky_cham_cong` phục vụ thanh tra giáo dục, kiểm toán tài chính và giải quyết khiếu nại lao động. Sau 5 năm, dữ liệu được chuyển vào kho lạnh (Cold Storage) hoặc ẩn danh hóa (Anonymization) thông tin định danh cá nhân chứ không xóa thô, đảm bảo tính toàn vẹn tham chiếu.
   - **Dữ liệu thực nghiệm của Đồ án Tốt nghiệp:** Toàn bộ ảnh mẫu và vector 512D phục vụ bài đo FAR/FRR của sinh viên sẽ được tiêu hủy hoàn toàn trước ngày 31/12/2026.

### 5.3. Phụ Lục: Phiếu Đồng Ý Thu Thập Dữ Liệu Sinh Trắc Học Đầy Đủ

```
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---o0o---

PHIẾU ĐỒNG Ý THAM GIA THỬ NGHIỆM VÀ XỬ LÝ DỮ LIỆU SINH TRẮC HỌC
(Phục vụ Đề tài Đồ án Tốt nghiệp Đại học)

Kính gửi: Tình nguyện viên tham gia thử nghiệm

Tên đề tài: "Xây dựng hệ thống quản lý nhân sự và chấm công ứng dụng thị giác máy tính"
Sinh viên thực hiện: Vũ Tiến Đức - Mã sinh viên: 2310900023
Email liên hệ: [Điền email trường của Sinh viên: vd: 2310900023@sv.daihoc.edu.vn]
Số điện thoại: [Điền số điện thoại liên hệ của Sinh viên / Đại diện nhóm nghiên cứu]
Người giám sát / Hướng dẫn: TS. [Điền họ tên GVHD] - Giảng viên Hướng dẫn Đồ án Tốt nghiệp, Khoa CNTT

1. Mục đích và Quy trình thu thập:
- Phục vụ nghiên cứu thực nghiệm đo lường độ chính xác (FAR - Tỷ lệ chấp nhận sai, FRR - Tỷ lệ từ chối sai) của mô hình nhận diện khuôn mặt InsightFace (MobileFaceNet buffalo_s - ArcFace 512 chiều).
- Tình nguyện viên đồng ý tham gia các điều kiện chụp ảnh thực nghiệm sau (tự tay đánh dấu chọn vào ô):
  [ ] Chụp 5 góc độ cơ bản (thẳng, nghiêng trái, nghiêng phải, ngước lên, cúi xuống).
  [ ] Chụp trong các điều kiện ánh sáng thay đổi (ánh sáng tự nhiên, ngược sáng, thiếu sáng).
  [ ] Chụp ở các khoảng cách khác nhau (0.5m, 1.0m, 1.5m).
  [ ] Chụp khi có phụ kiện (đeo kính cận, không đeo kính).

2. Lưu trữ và Cam kết hủy dữ liệu:
- Dữ liệu ảnh sau khi trích xuất vector đặc trưng 512D sẽ được gỡ bỏ khỏi bộ nhớ tạm.
- Vector đặc trưng 512D được lưu trữ trong CSDL nội bộ được bảo vệ mật khẩu của đề tài và do sinh viên thực hiện trực tiếp quản lý.
- Toàn bộ dữ liệu sinh trắc học thử nghiệm sẽ được xóa hoàn toàn và vĩnh viễn khỏi hệ thống ngay sau khi bảo vệ đồ án tốt nghiệp thành công (trước ngày 31/12/2026) bằng script dọn dẹp chuyên dụng `scripts/purgeBiometricData.js` và có Biên bản bàn giao/tiêu hủy dữ liệu.
- Báo cáo đồ án chỉ công bố các chỉ số thống kê tổng hợp (FAR, FRR, ROC curve), tuyệt đối không công khai danh tính hay hình ảnh cá nhân.

3. Tính Tự nguyện và Quyền của Tình nguyện viên:
- Việc tham gia là hoàn toàn tự nguyện, không kèm bất kỳ áp lực học tập hay ảnh hưởng nào đến điểm số/đánh giá kết quả của tình nguyện viên tại Trường.
- Tình nguyện viên có quyền rút lại sự đồng ý và yêu cầu xóa bỏ toàn bộ dữ liệu của mình bất kỳ lúc nào bằng cách liên hệ với sinh viên thực hiện qua email hoặc số điện thoại nêu trên.

Tôi xác nhận đã đủ 18 tuổi, đã đọc, hiểu rõ toàn bộ nội dung và tự nguyện đồng ý tham gia thử nghiệm.

                                       Hà Nội, ngày ..... tháng ..... năm 2026
                                                NGƯỜI TÌNH NGUYỆN
                                              (Ký và ghi rõ họ tên)
```
*(Khuyến nghị pháp lý: Phiếu đồng ý này là mẫu thiết kế phục vụ nghiên cứu học thuật. Trước khi triển khai thu thập trên thực tế, đề tài cần trình Thầy/Cô Hướng dẫn và Phòng Hành chính - Pháp chế của Nhà trường xem xét rà soát theo đúng tinh thần Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân).*

---

## 6. LỘ TRÌNH TRIỂN KHAI 8 TUẦN & DANH MỤC 14 TEST SUITES TỰ ĐỘNG

Quy trình phát triển áp dụng mô hình **Shift-Left Testing**: Mỗi tính năng được kiểm thử tự động (Unit/Integration Test) ngay trong tuần hoàn thành, không dồn kiểm thử tích hợp vào tuần cuối. Toàn bộ 14 test suites đều được tích hợp vào lệnh `npm test` và đạt tỷ lệ vượt qua 100%.

### 6.1. Bảng Kế Hoạch & Tiến Độ Triển Khai 8 Tuần

| Tuần | Trọng tâm phát triển | Kiểm thử tích hợp & Nghiệm thu từng tuần (Shift-Left) | Đầu ra nghiệm thu |
|:---:|:---|:---|:---|
| **Tuần 1** | CSDL 14 Collections + Migration Index + Auth (JWT & Refresh Token Rotation có Grace Period Cache 15s) + Mongoose Aliases tương thích ngược | Test Suites: `punchLogGeo.test.js`, `rbacAndTokenRotation.test.js`, `payrollAndRevocation.test.js` | Đăng nhập/đăng xuất, Token Rotation, Migration Index sạch, 10 chức danh đại học |
| **Tuần 2** | Dựng Face Service (FastAPI + `buffalo_s`), Bộ API RESTful (`/v1/face/...`), UI Đăng ký khuôn mặt 5 góc | Test Suite: `faceEnrollment.test.js` (kiểm tra trích xuất 5 vector, tính L2 norm vector trung bình, góc quay 3D Euler, chống trùng lặp khuôn mặt) | Đăng ký gương mặt 5 góc, lưu MongoDB và sync RAM |
| **Tuần 3** | Nhận diện 1:N bằng RAM Cache (NumPy `dot`), Margin Top1-Top2 $\ge 0.05$, Geofence GPS Haversine, Cooldown chống quét lặp 60s | Test Suite: `farFrrBiometrics.test.js` (đo đạc thực nghiệm FRR = 0.00%, FAR = 0.00%, bộ lọc Margin, Cooldown 60s, Auto Self-Healing) | Báo cáo chỉ số FAR/FRR, chốt ngưỡng nhận diện |
| **Tuần 4** | Lập TKB học kỳ, Xử lý ngoại lệ `ngoai_le[]`, Xếp lịch dạy bù `DAY_BU` + Tích hợp điểm danh Camera thời gian thực | Test Suite: `scheduleConflictAndRealtime.test.js` (chống xung đột TKB giảng viên & phòng học, chuẩn hóa tên phòng, Margin và Cooldown) | Điểm danh Camera thời gian thực tích hợp Face Service |
| **Tuần 5** | Module Đơn từ nhiều cấp (Khoa $\rightarrow$ BGH), Chặn tự duyệt đơn, Optimistic Locking, Hồi tố & Hoàn tác công (ACID) | Test Suite: `leaveMultiLevelAndRetroactive.test.js` (phân luồng duyệt $\le 3$ ngày / $> 3$ ngày, chặn tự duyệt 403, khóa lạc quan 409, hồi tố và hoàn tác công) | Đơn từ hoạt động trơn tru trong Transaction |
| **Tuần 6** | Bảng lương Snapshot 2026 (Payroll - Collection 11), Thuế TNCN lũy tiến 5 bậc, Khóa lương (`isLocked`), Xuất báo cáo Excel/PDF | Test Suite: `payrollSnapshotAndLock.test.js` (kiểm tra tính thuế 5 bậc, snapshot tham số 2026, khóa đồng bộ attendance, xuất báo cáo) | Bảng lương snapshot 2026, phiếu lương cá nhân, khóa lương |
| **Tuần 7** | Trợ lý AI Chatbot Đa Mô Hình (Gemini/Claude/DeepSeek/Local), Bộ tri thức Quy chế 2026, Động cơ NLU & Disambiguation | Test Suite: `aiAssistantMultiModelAndPolicy.test.js` (kiểm tra Lookup Engine, giải đáp quy chế, chặn vượt quyền RBAC, làm rõ danh tính) | Trợ lý AI hỏi đáp quy chế và tra cứu công thông minh |
| **Tuần 8** | Nhật ký kiểm toán bất biến (AuditLog Append-Only), Bộ tài liệu chuẩn Swagger OpenAPI 3.0 & Container hóa Docker toàn diện | Test Suite: `systemHealthAndAudit.test.js` (kiểm tra tính bất biến AuditLog, Swagger specs 26 endpoints, Docker Compose multi-container) | Hệ thống hoàn chỉnh 100%, sẵn sàng bảo vệ hội đồng |

### 6.2. Danh Mục 14 Test Suites Tự Động Toàn Diện (`npm test` - Đạt 100% PASS)

1. `server/tests/punchLogGeo.test.js`: Kiểm thử tọa độ GPS GeoJSON, index `2dsphere` và cấu hình động `SystemConfig`.
2. `server/tests/rbacAndTokenRotation.test.js`: Kiểm thử phân quyền RBAC 10 vai trò đại học, nhiệm kỳ, ủy quyền và Token Rotation Grace Period 15s.
3. `server/tests/payrollAndRevocation.test.js`: Kiểm thử Schema Model Payroll (Collection 11) và cơ chế Token Revocation in-memory.
4. `server/tests/faceEnrollment.test.js`: Kiểm thử FaceTemplate 5 góc, tính vector trọng tâm $L_2$ Centroid và chống trùng lặp khuôn mặt (409 Conflict).
5. `server/tests/scheduleConflictAndRealtime.test.js`: Kiểm thử TKB học kỳ, chống xung đột giảng viên/phòng học, Margin Top 1-2 và Cooldown 60s.
6. `server/tests/modelValidation.test.js`: Kiểm thử tính hợp lệ và toàn vẹn của 14 collections Mongoose.
7. `server/tests/attendanceEvidence.test.js`: Kiểm thử xử lý và bảo mật ảnh minh chứng điểm danh.
8. `server/tests/config.test.js`: Kiểm thử nạp biến môi trường và cấu hình hệ thống.
9. `server/tests/leaveValidation.test.js`: Kiểm thử nghiệp vụ đơn nghỉ phép và ràng buộc dữ liệu.
10. `server/tests/farFrrBiometrics.test.js`: Thực nghiệm đo đạc FAR/FRR sinh trắc học, Margin Top 1-2, Geofence GPS Haversine và Auto Self-Healing RAM.
11. `server/tests/leaveMultiLevelAndRetroactive.test.js`: Kiểm thử duyệt đơn đa cấp Khoa $\rightarrow$ BGH, Chặn tự duyệt đơn (403), Optimistic Locking (409) và Hồi tố/Hoàn tác công.
12. `server/tests/payrollSnapshotAndLock.test.js`: Kiểm thử Thuế TNCN lũy tiến 5 bậc, Snapshot tham số 2026, Khóa lương (`isLocked` / `DA_KHOA`) và xuất báo cáo Excel/PDF.
13. `server/tests/aiAssistantMultiModelAndPolicy.test.js`: Kiểm thử AI Chatbot đa LLM (Gemini/Claude/DeepSeek/Local), Cơ sở tri thức Quy chế đại học 2026 và phân quyền tra cứu công.
14. `server/tests/systemHealthAndAudit.test.js`: Kiểm thử AuditLog bất biến (Append-Only), Swagger OpenAPI 3.0 specs và cấu trúc Docker Containerization toàn diện.

