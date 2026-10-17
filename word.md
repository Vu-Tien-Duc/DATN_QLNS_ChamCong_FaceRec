# NHẬT KÝ TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN TỐT NGHIỆP
**Hệ Thống Quản Lý Nhân Sự & Chấm Công Ứng Dụng Thị Giác Máy Tính (Face Recognition)**  
**Sinh viên thực hiện:** Vũ Tiến Đức - MSV: 2310900023  
**Bản đặc tả kiến trúc tham chiếu:** `THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md` (Phiên bản chốt v2.5)

---

## 📅 NGÀY 15/10/2026: HOÀN THIỆN CƠ SỞ DỮ LIỆU 14 COLLECTIONS & BẢO MẬT AUTH RBAC (TUẦN 1)

### 1. Rà soát & Chuẩn hóa CSDL 14 Collections Mongoose (Dual-Standard)
- **Quyết định cấu trúc:** Đối soát trực tiếp với bản thiết kế nghiệp vụ v2.5, phát hiện và khắc phục sai lệch:
  - **Bổ sung Model `Payroll` (`phieu_luong`)**: Tạo file `server/models/payroll.model.js` (Collection 11) quản lý phiếu lương snapshot năm 2026 với đầy đủ lương cơ sở, phụ cấp chức vụ, thâm niên, ưu đãi nghề, bảo hiểm bắt buộc và thuế TNCN lũy tiến 5 bậc.
  - **Loại bỏ Model `TokenBlacklist` khỏi CSDL**: Chuyển cơ chế thu hồi token sang quản lý in-memory (`server/utils/tokenRevocation.js`) kết hợp tăng trường `phien_ban_token` trên User model, giúp tối ưu hiệu năng và triệt tiêu một collection thừa trong MongoDB.
  - **Đồng bộ Barrel Export `server/models/index.js`**: Xuất đúng chuẩn 14 collections theo cả 2 tên tiếng Anh (PascalCase) và tiếng Việt (snake_case / PascalCase thuần Việt).

### 2. Đồng bộ Chỉ mục MongoDB thật (`syncIndexes.js`)
- Viết script `server/scripts/syncIndexes.js` kết nối trực tiếp đến MongoDB Cluster để xóa bỏ toàn bộ index cũ bị lệch tên và tái tạo chuẩn xác 100% các index phức hợp, index duy nhất (`unique`), sparse index và geospatial index `2dsphere` trên cả 14 collections.
- Thêm script vào `package.json`: `"db:sync-indexes": "node server/scripts/syncIndexes.js"`.
- Đã chạy thành công 100% trên cơ sở dữ liệu thật.

### 3. Nạp 19 Tham Số Cấu Hình Hệ Thống Động (`seeder.js`)
- Cập nhật `server/utils/seeder.js`: Khởi tạo và đồng bộ đúng 19 khóa cấu hình hệ thống (`SystemConfig` / `cau_hinh_he_thong`) theo Mục 3 của đặc tả:
  - `CA_MAC_DINH_HANH_CHINH`, `GEOFENCE_TRUONG`, `DANH_SACH_PHONG_HOC`, `LUONG_CO_SO`, `GIAM_TRU`, `TY_LE_BAO_HIEM`, `DINH_MUC_GIO_CHUAN`, `QUOTA_PHEP_NAM`, `TI_LE_DI_MUON_TRU_LUONG`, `PHU_CAP_CHUC_VU`, `HE_SO_LUONG_CO_BAN`, `DON_GIA_GIO_VUOT`, `NGUONG_AI`, `MARGIN_TOP1_TOP2`, `COOLDOWN_QUET_GIAY`, `QUY_TAC_DIEM_DANH`, `RETENTION_ANH_NAM`, `RETENTION_METADATA_NAM`.
- Khởi tạo bản ghi mẫu cho bảng `Payroll` phục vụ kiểm thử tính lương.

### 4. Hạt Nhân Phân Quyền RBAC & Token Rotation Grace Period 15s (Chuẩn Hóa Sạch 100% Mã Nguồn)
- **Áp dụng quy trình thay thế & sao lưu file cũ**:
  - Sao lưu toàn bộ file của CSDL cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:
    + `server/controllers/old_auth.controller.js`
    + `server/services/old_auth.service.js`
    + `server/middlewares/old_auth.middleware.js`
    + `server/controllers/old_user.controller.js`
    + `server/services/old_user.service.js`
- **Viết mới hoàn toàn 5 file sạch 100% theo CSDL v2.5 cho môi trường Đại Học**:
  - `server/controllers/auth.controller.js` & `server/services/auth.service.js`:
    + Đăng nhập tài khoản cán bộ/giảng viên (so khớp bcrypt).
    + Refresh Token Rotation có bộ nhớ đệm Grace Period 15 giây (`rotationGraceCache`) xử lý triệt để race condition khi trình duyệt gửi nhiều request đồng thời.
    + Thuật toán phát hiện và ngăn chặn Replay Attack (tự động thu hồi toàn bộ Token Family và tăng `phien_ban_token` khi phát hiện tái sử dụng refresh token cũ).
    + Đăng xuất thu hồi tức thì qua In-Memory Token Revocation & tăng `phien_ban_token`.
    + Đổi mật khẩu tài khoản và cập nhật ảnh đại diện.
    + **Cắt bỏ hoàn toàn các luồng rác không thuộc đặc tả đại học:** Loại bỏ hoàn toàn luồng tự đăng ký công khai (`register`), xác minh OTP (`verifyAccount`/`verifyOtp`), cấu hình OTP thừa (`OTP_TTL_MS`, `hashOtp`, `sendOtpEmail`,...).
  - `server/routes/auth.routes.js`:
    + Tinh gọn chỉ định tuyến các endpoint thực tế: `POST /login`, `POST /refresh-token` (alias `/refresh`), `POST /logout`, `GET /me`, `PUT /change-password`, `PUT /avatar`. Loại bỏ hoàn toàn các route OTP và register công khai.
  - `server/middlewares/auth.middleware.js`:
    + Xác thực JWT Access Token, kiểm tra blacklist in-memory, kiểm tra phiên đăng nhập còn hiệu lực qua `phien_ban_token` và thời điểm đổi mật khẩu gần nhất.
    + Hạt nhân phân quyền RBAC ma trận 10 chức danh đại học (`requirePermission`, `requireAnyPermission`, `requireAllPermissions`), tự động tước quyền khi vai trò hết nhiệm kỳ (`nhiem_ky_den < Date.now()`).
    + Xác thực trạm điểm danh camera (`verifyTerminalKey`).
  - `server/controllers/user.controller.js` & `server/services/user.service.js`:
    + Quản lý danh sách cán bộ, giảng viên, nhân viên nhà trường; phân quyền Trưởng khoa chỉ quản lý nhân sự thuộc khoa trực thuộc (`getDeanDepartmentIds`).
    + Tạo mới, cập nhật, khóa/vô hiệu hóa tài khoản (Soft delete + tăng `phien_ban_token`).
    + Tích hợp thao tác Face ID 512D chuẩn InsightFace thông qua `faceTemplate.service.js` và đồng bộ FAISS RAM.
- **Kiểm thử tự động & Nghiệm thu**: Chạy `npm test` vượt qua 100% cả 10 test suites, chạy `npm run build` thành công 100% không có lỗi.

---

## 📅 NGÀY 16/10/2026: THỊ GIÁC MÁY TÍNH FACE AI, ĐĂNG KÝ 5 GÓC, CHỐNG XUNG ĐỘT TKB & CAMERA REALTIME (TUẦN 2, 3, 4)

### 1. Chuẩn Hóa Sinh Trắc Học `FaceTemplate` & Microservice Python (Tuần 2 - Mã Nguồn Sạch 100%)
- **Áp dụng quy trình thay thế & sao lưu file cũ**:
  - Sao lưu toàn bộ file của CSDL cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:
    + `server/controllers/old_face.controller.js`
    + `server/services/old_faceTemplate.service.js`
- **Viết mới hoàn toàn 2 file sạch 100% chuẩn Collection 2 `FaceTemplate` (`mau_khuon_mat`)**:
  - `server/services/faceTemplate.service.js`:
    + Quản lý Collection 2 FaceTemplate: Tách biệt hoàn toàn dữ liệu sinh trắc học khỏi User.
    + Chuẩn hóa vector 512 chiều ArcFace InsightFace (`buffalo_s`).
    + Thuật toán tính vector trọng tâm $L_2$ (`computeNormalizedCentroid`).
    + Thuật toán Chống trùng lặp sinh trắc học (`checkDuplicateFace`): Ngăn chặn một người dùng khuôn mặt của mình đăng ký cho tài khoản người khác (chặn lỗi `409 Conflict`).
    + Đồng bộ tức thì lên bộ nhớ RAM FAISS của Face Microservice (`addFaissTemplate`, `removeFaissTemplate`).
    + Cập nhật cờ `isFaceRegistered = true`, `faceRegisteredAt` và `facePhoto` cho `User`.
    + Ghi Audit Log toàn diện cho các thao tác đăng ký / xóa Face ID.
  - `server/controllers/face.controller.js`: Tinh gọn chuẩn xác chỉ gồm đúng 5 chức năng theo đặc tả:
    1. `detectPose`: Nhận diện tư thế đầu 3D realtime từ frame webcam (Euler Yaw, Pitch, Roll, Liveness, Face Quality).
    2. `enrollMultiAngleFace`: Đăng ký khuôn mặt 5 góc (chính diện, nghiêng trái, nghiêng phải, ngửa lên, cúi xuống), chống trùng lặp, lưu Collection 2.
    3. `getRegistrationStatus`: Tra cứu trạng thái đăng ký Face ID của bản thân hoặc nhân sự cụ thể.
    4. `deleteFaceData`: Xóa sạch dữ liệu sinh trắc học khỏi MongoDB và RAM FAISS.
    5. `getFaceHealth`: Kiểm tra trạng thái hoạt động của Python FastAPI Microservice.
- **Nâng cấp `face-service/app.py`**: Endpoint `/v1/face/enroll-multi-angle` tự động tính và trả về `average_embedding` chuẩn hóa $L_2$.
- **Kiểm thử tự động**: Viết `server/tests/faceEnrollment.test.js` gồm 6 bài test chuyên sâu $\rightarrow$ Đạt 100% PASS.

### 2. Thuật Toán Margin Top 1 - Top 2 & Cooldown Chống Quét Lặp 60s (Tuần 3)
- **Bộ lọc Margin Top 1 - Top 2 $\ge 0.05$ trong Python Face Service**:
  - Cập nhật `/v1/face/recognize` trong `face-service/app.py`: Khi so khớp $1:N$, nếu độ chênh lệch Cosine similarity giữa ứng viên Top 1 và Top 2 nhỏ hơn ngưỡng $0.05$ (`MARGIN_TOP1_TOP2`), hệ thống lập tức từ chối nhận diện với lý do `AMBIGUOUS_MATCH` để triệt tiêu hiện tượng nhận diện nhầm người giữa các khuôn mặt gần giống nhau.
- **Cơ chế Cooldown 60 giây chống quét lặp (`COOLDOWN_QUET_GIAY = 60`)**:
  - Cập nhật `server/services/attendance/faceRecognition.service.js`: Tạo In-memory Map `scanCooldownMap` lưu mốc thời gian quẹt thẻ thành công của từng nhân viên.
  - Nếu người dùng đứng trước camera quẹt lại trong vòng 60 giây, hệ thống trả về thông báo `RECENTLY_SCANNED` kèm số giây còn lại cần chờ, ngăn chặn spam log và trùng lặp bản ghi.

### 3. Thời Khóa Biểu Học Kỳ, Chống Xung Đột Lịch & Hoàn Thiện Camera Điểm Danh Realtime (Tuần 4)
- **Áp dụng quy trình thay thế & sao lưu file cũ**:
  - Sao lưu toàn bộ file của CSDL cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:
    + `server/services/old_scheduleManagement.service.js`
    + `server/controllers/old_schedule.controller.js`
- **Nâng cấp Model Collection 6 `Schedule` (`lich_giang_day`)**:
  - Bổ sung các trường quản lý đào tạo học kỳ:
    - `tiet_bat_dau` (`startPeriod`: 1 - 12), `so_tiet` (`periodCount`: 1 - 6).
    - `loai_lich` (`scheduleType`: `CHINH_KHOA` hoặc `DAY_BU`).
    - `ngay_day_bu` (`makeupDate`): Ngày dạy bù cụ thể.
    - `ngoai_le` (`exceptions`): Mảng các ngày nghỉ, hủy buổi hoặc chuyển dạy bù `[{ ngay, ly_do, trang_thai }]`.
    - `danh_sach_tuan` (`weekNumbers`): Mảng tuần áp dụng trong học kỳ.
    - `nam_hoc` (`academicYear`), `hoc_ky` (`semester`: 1, 2, 3).
  - Bổ sung chỉ mục kép phục vụ tra cứu TKB: `{ nam_hoc: 1, hoc_ky: 1, ma_nguoi_dung: 1 }` và `{ nam_hoc: 1, hoc_ky: 1, phong_hoc: 1 }`.
- **Viết mới sạch 100% `server/services/scheduleManagement.service.js` & `server/controllers/schedule.controller.js`**:
  - **Thuật toán Chống Xung Đột Thời Khóa Biểu 2 chiều:**
    + **Xung đột Giảng viên:** Kiểm tra cùng giảng viên, cùng thứ trong tuần, có ít nhất một tuần học chung trong `danh_sach_tuan`, và có khoảng tiết chồng lấn:
      $$\max(\text{Start}_1, \text{Start}_2) \le \min(\text{End}_1, \text{End}_2)$$
      Tự động bỏ qua các buổi đã được đánh dấu `HUY` trong mảng ngoại lệ `ngoai_le`.
    + **Xung đột Phòng học:** Kiểm tra cùng phòng học (qua hàm chuẩn hóa `isSameRoom` loại bỏ tiền tố thừa "Phòng", "Giảng đường", "p."), cùng thứ, có tuần học chung, và khoảng tiết chồng lấn.
    + **Lịch Dạy Bù (`DAY_BU`):** So sánh trực tiếp ngày bù với các lịch hiện có để đảm bảo không trùng phòng và không trùng ca giảng viên.
  - **Quản trị Ngoại lệ Lịch học (`addException`):** Thêm ngoại lệ hủy buổi/nghỉ lễ hoặc dời lịch dạy bù mà không làm gián đoạn chuỗi tuần học gốc.
  - **Bộ điều khiển Controller TKB chuẩn RESTful:** Đầy đủ `getSchedules`, `getScheduleById`, `createSchedule`, `updateSchedule`, `deleteSchedule`, `getTodaySchedules`, `addException`.
- **Hoàn Thiện Tích Hợp UI Camera Realtime 1:N**:
  - `server/services/attendance/faceRecognition.service.js`: Bổ sung tham số `verifyOnly = true` cho phép quét xác thực danh tính nhanh trước khi xác nhận ghi nhận công.
  - `server/controllers/attendance.controller.js`: Tiếp nhận tham số `verifyOnly`, cung cấp đầy đủ các endpoint phục vụ quét camera và kiểm tra tư thế khuôn mặt.
  - `server/routes/attendance.routes.js` & `server/routes/face.routes.js`: Định tuyến chuẩn xác `/face-recognize`, `/face/checkin`, `/face/checkout`.
  - `src/components/FaceAttendanceScannerModal.tsx`:
    + Giao diện HUD chuyên nghiệp cho Camera trạm điểm danh: Khung quét tự động nhận diện khuôn mặt thời gian thực, hiển thị chỉ số Liveness và Face Quality.
    + Tự động đếm ngược Cooldown chống quét lặp: Khi nhận mã lỗi `409 Conflict` (`RECENTLY_SCANNED`), modal trích xuất `retryAfterSeconds` và hiển thị đồng hồ đếm ngược trực quan.
    + Ngăn chặn nhận diện mơ hồ (`AMBIGUOUS_MATCH`): Cảnh báo rõ ràng cho người dùng điều chỉnh góc mặt hoặc ánh sáng khi biên độ chênh lệch Top 1 - Top 2 < 0.05.
- **Kiểm thử tự động**: Viết `server/tests/scheduleConflictAndRealtime.test.js` gồm 6 bài test kiểm tra toàn diện TKB, chuẩn hóa phòng, chồng lấn tiết học, tuần chung, Margin Top1-Top2 và Cooldown 60s $\rightarrow$ Đạt 100% PASS.

### 4. Quy Trình Đối Chiếu File Cũ `old_*` & Hoàn Tất Xóa Bỏ Khỏi Ổ Đĩa
- **Tuần 1 (Auth, User, RBAC):** Đã sao lưu tạm thời và sau đó xóa bỏ 5 file (`old_auth.controller.js`, `old_auth.service.js`, `old_auth.middleware.js`, `old_user.controller.js`, `old_user.service.js`).
- **Tuần 2 (Face AI 5 góc):** Đã sao lưu tạm thời và sau đó xóa bỏ 2 file (`old_face.controller.js`, `old_faceTemplate.service.js`).
- **Tuần 3 (Điểm danh & PunchLog 2 tầng):** Đã sao lưu tạm thời và sau đó xóa bỏ 8 file (`old_attendance.controller.js`, `old_faceRecognition.service.js`, `old_faceServiceClient.js`, `old_checkIn.service.js`, `old_checkOut.service.js`, `old_qrAttendance.service.js`, `old_attendanceHistory.service.js`, `old_attendanceAdmin.service.js`).
- **Tuần 4 (Thời khóa biểu & Xung đột lịch):** Đã sao lưu tạm thời và sau đó xóa bỏ 2 file (`old_scheduleManagement.service.js`, `old_schedule.controller.js`).
- **Tuần 5 (Đơn từ & Phê duyệt đa cấp):** Đã sao lưu tạm thời và sau đó xóa bỏ 2 file (`old_leaveRequest.service.js`, `old_leaveRequest.controller.js`).
- **Tuần 7 (AI Trợ lý Chatbot):** Đã sao lưu tạm thời và sau đó xóa bỏ 3 file (`old_aiChat.service.js`, `old_aiResponse.service.js`, `old_ai.controller.js`).
*Trạng thái hiện tại: Toàn bộ 22 file `old_*` đã được xóa sạch hoàn toàn khỏi ổ đĩa theo đúng quy tắc nghiêm ngặt tại `AGENTS.md`. Codebase hiện tại 100% thuần khiết, tinh gọn và vận hành hoàn toàn trên CSDL v2.5.*

### 5. Hoàn Thiện Dữ Liệu Mẫu Đại Học & UI Đăng Ký Khuôn Mặt 5 Góc (Bước 1 & Bước 2)
- **Hoàn tất 100% Tuần 1 (Chỉ mục & Dữ liệu mẫu `seeder.js`)**:
  - Script `server/scripts/syncIndexes.js`: Đã đồng bộ toàn bộ index trọng yếu trên 14 collections (GeoJSON 2dsphere sparse cho GPS, unique sparse cho `khoa_cong`, TTL index tự hủy cho `ma_lam_moi`, partialFilterExpression cho `ma_can_bo`).
  - Cập nhật `server/utils/seeder.js`:
    - Nạp sẵn 19 tham số cấu hình động vào `cau_hinh_he_thong` (Học kỳ 1 2026-2027, Geofence trụ sở chính, Danh mục phòng học, Lương cơ sở 2.530.000đ, Giảm trừ gia cảnh bản thân 15.5tr/phụ thuộc 6.2tr, Tỷ lệ bảo hiểm bắt buộc 10.5%, Biểu thuế lũy tiến 5 bậc, Đơn giá giờ vượt 120.000đ, Định mức 135 giờ chuẩn, Phụ cấp ưu đãi nghề 30%, Bảng hệ số phụ cấp chức vụ, Ngưỡng AI buffalo_s 512D, Margin Top 1-2 0.05, Cooldown 60s, Quy tắc điểm danh, Thời hạn lưu trữ ảnh 1 năm/metadata 5 năm).
    - Nạp đầy đủ 13 tài khoản người dùng đại diện cho toàn bộ các vai trò đại học:
      1. Hiệu trưởng (Ban Giám Hiệu): GS. TS. Nguyễn Văn An (`hieutruong@university.edu.vn`)
      2. Admin Quản trị IT: Quản Trị Viên (`daihocdtd@gmail.com`)
      3. Admin Quản lý Nhân sự HR: ThS. Nguyễn Thị Mai (`admin.hr@university.edu.vn`)
      4. Trưởng Khoa CNTT: PGS. TS. Lê Hoàng Nam (`truongkhoa.cntt@university.edu.vn`)
      5. Phó Trưởng Khoa CNTT (Được ủy quyền duyệt đơn): TS. Đặng Tiến Hưng (`phokhoa.cntt@university.edu.vn`)
      6. Trưởng Khoa Kinh tế: TS. Phạm Hải Đăng (`truongkhoa.kinhte@university.edu.vn`)
      7. Trưởng Bộ môn KTPM: TS. Hoàng Văn Minh (`truongbomon.ktpm@university.edu.vn`)
      8. Giảng viên KTPM: TS. Trần Thị Bích (`giangvien.bich@university.edu.vn`)
      9. Giảng viên HTTT: ThS. Phạm Văn Cường (`giangvien.cuong@university.edu.vn`)
      10. Giảng viên Kế toán: ThS. Hoàng Diệu Linh (`giangvien.linh@university.edu.vn`)
      11. Giảng viên Đồ họa: ThS. Nguyễn Trọng An (`giangvien.an@university.edu.vn`)
      12. Chuyên viên Đào tạo: Đỗ Thu Hà (`nhanvien.ha@university.edu.vn`)
      13. Chuyên viên Khảo thí: Lê Quang Thành (`nhanvien.thanh@university.edu.vn`)
    - Khởi tạo sẵn bản ghi sinh trắc học `FaceTemplate` chuẩn InsightFace 512D (5 góc: chính diện, nghiêng trái, nghiêng phải, ngửa lên, cúi xuống) cho 6 nhân sự nòng cốt.
- **Hoàn tất 100% Tuần 2 (Microservice Python & Frontend UI Chụp 5 Góc)**:
  - Python FastAPI Microservice (`face-service/app.py`):
    - Endpoint `/v1/face/detect-pose`: Ước tính góc quay đầu 3D (Euler Yaw, Pitch, Roll), kiểm tra Liveness và Face Quality theo thời gian thực.
    - Endpoint `/v1/face/enroll-multi-angle`: Trích xuất vector 5 góc, kiểm tra trùng lặp và tính vector trọng tâm $L_2$ (`average_embedding`).
  - Frontend UI Đăng ký khuôn mặt đa góc:
    - Xây dựng trang chuyên dụng `src/pages/FaceRegistrationPage.tsx` gắn route `/face-registration` trong `src/App.tsx`.
    - Tích hợp khung hình camera hướng dẫn trực quan 5 góc tuần tự (`FaceRegistrationModal.tsx`):
      1. Chính diện (Nhìn thẳng vào camera)
      2. Nghiêng trái (Quay mặt sang trái 15°-25°)
      3. Nghiêng phải (Quay mặt sang phải 15°-25°)
      4. Ngước lên (Hơi nâng nhẹ cằm lên trên)
      5. Cúi xuống (Hơi hạ nhẹ cằm xuống dưới)
    - Tự động nhận diện tư thế đạt chuẩn (Hold 3 frames ~0.4s) để tự động chụp và chuyển góc mượt mà, kèm hiệu ứng confetti chúc mừng khi hoàn tất.

### 6. Động Cơ Nhận Diện 1:N RAM, Geofence GPS Haversine, Chống Quét Lặp 60s & Thực Nghiệm FAR/FRR (Tuần 3)
- **Bộ lọc Margin Top 1 - Top 2 $\ge 0.05$ trong Nhận diện $1:N$**:
  - Khi so khớp Cosine Similarity trên RAM, hệ thống tính toán khoảng cách chênh lệch giữa ứng viên Top 1 và Top 2:
    $$\Delta = \text{Similarity}(\text{Top 1}) - \text{Similarity}(\text{Top 2})$$
  - Nếu $\Delta < 0.05$, hệ thống lập tức từ chối nhận diện với lý do `AMBIGUOUS_MATCH`, triệt tiêu hoàn toàn rủi ro nhận diện nhầm lẫn giữa các khuôn mặt tiệm cận nhau (anh em sinh đôi, chất lượng ảnh nhòe).
- **Cơ chế Cooldown 60 giây chống quét lặp (`COOLDOWN_QUET_GIAY = 60`)**:
  - In-memory TTL Map lưu vết thời điểm quẹt thẻ thành công của từng nhân viên.
  - Chặn người dùng đứng trước camera quét liên tiếp nhiều lần gây trùng lặp lượt chấm công, trả về trạng thái `RECENTLY_SCANNED` kèm thời gian chờ còn lại (`retryAfterSeconds`).
- **Xác thực Geofence GPS khuôn viên trường & phòng học (Công thức Haversine)**:
  - Tích hợp công thức Haversine tính toán khoảng cách đường chim bay chính xác giữa tọa độ thiết bị di động và tâm Geofence.
  - So sánh với `GEOFENCE_TRUONG` (bán kính $150\text{m}$) và `DANH_SACH_PHONG_HOC` (bán kính $30\text{m}$).
  - Tự động đánh dấu cờ cảnh báo `isFraud = true` (`co_gian_lan = true`) và ghi chi tiết `fraudReason` nêu rõ khoảng cách vi phạm ngoài bán kính cho phép.
- **Cơ chế Tự phục hồi RAM Cache (Auto Self-Healing on Service Restart)**:
  - Bổ sung hàm `ensureRamCacheWarm()` trong `server/services/faceServiceClient.js`.
  - Tự động kiểm tra trạng thái bộ nhớ đệm RAM (`getFaissStats`). Khi phát hiện service khởi động lại hoặc RAM Index rỗng (`total_vectors == 0`), hệ thống tự động truy vấn MongoDB đọc toàn bộ `FaceTemplate` và nạp lại lên RAM (`syncFaissTemplates`).
- **Chuẩn hóa các Service con Điểm danh theo PunchLog (Collection 4) & AttendanceLog (Collection 3)**:
  - **Sao lưu các file cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:**
    + `server/services/attendance/old_checkIn.service.js`
    + `server/services/attendance/old_checkOut.service.js`
    + `server/services/attendance/old_qrAttendance.service.js`
    + `server/services/attendance/old_attendanceHistory.service.js`
    + `server/services/attendance/old_attendanceAdmin.service.js`
  - **Viết mới sạch 100% 5 service con chuẩn hóa kiến trúc 2 tầng:**
    1. `checkIn.service.js`: Tạo bản ghi sự kiện quẹt vào `PunchLog` (Collection 4) với GeoJSON Point `[lng, lat]`, xác thực Geofence Haversine (cờ `isFraud`, `fraudReason`), khởi tạo/cập nhật `AttendanceLog` (Collection 3), tính số phút đi muộn (`di_muon_phut`).
    2. `checkOut.service.js`: Tạo `PunchLog` (loại `RA`), đóng phiên làm việc trong `AttendanceLog`, tính toán chính xác tổng giờ làm việc thực tế (`tong_gio_lam` / `workHours`) và số phút về sớm (`ve_som_phut` / `earlyMinutes`).
    3. `qrAttendance.service.js`: Xác minh mã QR động thời gian thực (Dynamic QR TOTP/HMAC), bắt buộc kiểm tra GPS chống gian lận quét ảnh QR từ xa, tự động nhận diện chu trình Check-in (nếu chưa vào) hoặc Check-out (nếu đã vào), đồng bộ `PunchLog` và `AttendanceLog`.
    4. `attendanceHistory.service.js`: Tra cứu lịch sử chấm công tổng hợp `AttendanceLog` và truy vết chi tiết từng lượt quẹt thô `PunchLog`, phân quyền chặt chẽ (cá nhân, trưởng khoa theo khoa trực thuộc, ban giám hiệu/admin toàn trường).
    5. `attendanceAdmin.service.js`: Quản trị viên/Trưởng khoa điều chỉnh công có lưu vết `AuditLog`, tính toán lại tổng giờ làm việc, cập nhật cờ gian lận và đồng bộ cấu hình khuôn viên trường.
- **Test Suite Thực nghiệm Đo đạc FAR / FRR (`server/tests/farFrrBiometrics.test.js`)**:
  - Thiết kế và thực thi 6 kịch bản kiểm thử đo đạc thực nghiệm:
    1. **FRR (False Rejection Rate):** Đo đạc trên 100 cặp Genuine Pairs với biến thiên góc nhìn $\rightarrow$ **FRR = 0.00%** (Điểm Cosine trung bình 0.969).
    2. **FAR (False Acceptance Rate):** Đo đạc trên 200 cặp Impostor Pairs của các nhân sự khác nhau $\rightarrow$ **FAR = 0.00%** (Điểm Cosine cao nhất Impostor đạt dưới ngưỡng 0.45).
    3. **Bộ lọc Margin Top 1 - Top 2:** Chặn đứng trường hợp chênh lệch 0.03 < 0.05 với `AMBIGUOUS_MATCH`.
    4. **Cooldown 60 giây:** Chặn quẹt lặp và trả về số giây chờ chính xác.
    5. **Geofence Haversine:** Phân biệt chính xác vị trí hợp lệ (23m) và vị trí gian lận ngoài bán kính (628m).
    6. **Auto Self-Healing:** Tự động phát hiện RAM rỗng và phục hồi nạp lại vector thành công.

### 7. Module Đơn Từ Nhiều Cấp (Khoa -> BGH), Chặn Tự Duyệt Đơn, Optimistic Locking & Hồi Tố Hoàn Tác Công (Tuần 5)
- **Áp dụng quy trình thay thế & sao lưu file cũ**:
  - Sao lưu toàn bộ file của CSDL cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:
    + `server/services/old_leaveRequest.service.js`
    + `server/controllers/old_leaveRequest.controller.js`
- **Nâng cấp Model Collection 5 `LeaveRequest` (`don_nghi_phep`)**:
  - Bổ sung các trường phục vụ quy trình đào tạo và kiểm toán:
    + `so_cap_duyet` (`requiredLevels`): Số cấp duyệt cần thiết (1 hoặc 2 cấp).
    + `cap_duyet_hien_tai` (`currentLevel`): Cấp duyệt hiện thời (1: Khoa, 2: Ban Giám Hiệu).
    + `phien_ban` (`version`): Trường số nguyên phục vụ Khóa lạc quan (Optimistic Locking).
    + `lich_su_duyet` (`approvalHistory`): Mảng lưu vết từng bước duyệt `[{ cap, nguoi_duyet, vai_tro, hanh_dong, ghi_chu, thoi_gian }]`.
    + Mở rộng `trang_thai`: Hỗ trợ đầy đủ các trạng thái đa cấp `['PENDING', 'PENDING_DEAN', 'PENDING_BGH', 'APPROVED', 'REJECTED', 'CANCELLED']`.
- **Viết mới sạch 100% `server/services/leaveRequest.service.js` & `server/controllers/leaveRequest.controller.js`**:
  - **Quy trình Phê duyệt Đa cấp Tự động (Khoa -> BGH):**
    + Cán bộ/giảng viên xin nghỉ $\le 3$ ngày: Duyệt 1 cấp tại Khoa (`so_cap_duyet = 1`, Trưởng khoa hoặc Phó khoa được ủy quyền duyệt $\rightarrow$ `APPROVED`).
    + Cán bộ/giảng viên xin nghỉ $> 3$ ngày: Duyệt 2 cấp bắt buộc (`so_cap_duyet = 2`, Trưởng khoa duyệt Cấp 1 $\rightarrow$ `PENDING_BGH`, Ban Giám Hiệu duyệt Cấp 2 $\rightarrow$ `APPROVED`).
    + Trưởng khoa / Phó trưởng khoa nộp đơn: Đơn tự động chuyển thẳng lên Ban Giám Hiệu (`PENDING_BGH`), không thể tự duyệt ở cấp khoa.
  - **Chặn Tự Duyệt Đơn Tuyệt Đối (Anti Self-Approval):**
    + Bất kỳ người dùng nào (kể cả Trưởng khoa, Hiệu trưởng hay Admin) làm đơn: Hệ thống kiểm tra đối chiếu `applicantId === currentUserId`, lập tức từ chối và ném mã lỗi `403 Forbidden` (`CANNOT_APPROVE_OWN_REQUEST`).
  - **Khóa Lạc Quan Chống Race Condition (Optimistic Locking):**
    + Mọi thao tác duyệt (`approve`), từ chối (`reject`) và hủy đơn (`cancel`) đều thực hiện truy vấn nguyên tử có điều kiện `phien_ban: targetVersion` và tăng dần `$inc: { phien_ban: 1 }`.
    + Nếu đơn đã bị người khác xử lý hoặc mở trên tab khác: Hệ thống phát hiện xung đột và ném mã lỗi `409 Conflict` (`OPTIMISTIC_LOCK_CONFLICT`), yêu cầu tải lại trang.
  - **Hồi Tố Điểm Danh & Hoàn Tác Công Tự Động (Retroactive Sync & Rollback):**
    + **Hồi tố công:** Khi đơn được phê duyệt hoàn tất, hệ thống tự động tìm và đồng bộ các bản ghi `AttendanceLog` trong khoảng `[startDate, endDate]`, chuyển trạng thái sang `EXCUSED_ABSENCE` (`co_phep = true`), ghi chú "Nghỉ phép có đơn được duyệt (Hồi tố)". Với đơn `day_bu`, tự động bổ sung lịch dạy bù vào `Schedule.ngoai_le`.
    + **Hoàn tác công:** Khi đơn bị hủy (`CANCELLED`), hệ thống tra cứu các `AttendanceLog` liên quan: Nếu nhân sự không có lượt quẹt `PunchLog` thì xóa bỏ hoặc đưa về `VANG_MAT`; nếu có quẹt thực tế thì phục hồi lại giờ công theo thực tế quẹt thẻ.
- **Kiểm thử tự động chuyên sâu**: Viết `server/tests/leaveMultiLevelAndRetroactive.test.js` gồm 6 bài test kiểm tra đa cấp, chặn tự duyệt, phân quyền BGH, Optimistic lock 409 và liên kết hồi tố công $\rightarrow$ Đạt 100% PASS.

### 8. Bảng Lương Snapshot Năm 2026 (Payroll - Collection 11), Khóa Lương (isLocked), Tính Toán Thuế TNCN Lũy Tiến 5 Bậc & Xuất Báo Cáo Excel/PDF (Tuần 6)
- **Chuẩn hóa Model Collection 11 `Payroll` (`phieu_luong`)**:
  - Tích hợp đầy đủ cấu trúc Snapshot tham số năm 2026 (`snapshot_tham_so`): `luong_co_so`, `giam_tru_ban_than`, `giam_tru_phu_thuoc`, `ty_le_bhxh`, `ty_le_bhyt`, `ty_le_bhtn` và `bieu_thue_5_bac`.
  - Bổ sung virtual getter `isLocked`: Tự động phản ánh trạng thái khóa sổ khi `trang_thai === 'DA_KHOA'` hoặc có `khoa_luc`.
  - Thiết lập Dual-Standard Aliases: `userId`, `month`, `year`, `netSalary`, `grossIncome`, `primarySalary`, `salaryCoefficient`, `baseSalary`...
- **Viết mới sạch 100% `server/services/payroll.service.js` & `server/controllers/payroll.controller.js`**:
  - **Thuật toán Tính Thuế TNCN Lũy Tiến 5 Bậc (Luật Thuế TNCN sửa đổi 2026):**
    + Bậc 1: $\le 10$ triệu: $5\%$
    + Bậc 2: $> 10$ đến $30$ triệu: $10\% - 500.000$đ
    + Bậc 3: $> 30$ đến $60$ triệu: $20\% - 3.500.000$đ
    + Bậc 4: $> 60$ đến $100$ triệu: $28\% - 8.300.000$đ
    + Bậc 5: $> 100$ triệu: $35\% - 15.300.000$đ
  - **Công thức Tính Lương Ngành Giáo Dục Đại Học Chuẩn 2026:**
    + Lương chính = Hệ số lương $\times$ Lương cơ sở ($2.530.000$đ).
    + Phụ cấp chức vụ (Hiệu trưởng 1.3, Hiệu phó 1.1, Trưởng khoa 0.9, Phó khoa 0.7, Trưởng BM 0.5...).
    + Phụ cấp thâm niên nhà giáo (sau 5 năm: 1%/năm).
    + Phụ cấp ưu đãi nghề 30% (tính trên Lương chính + Phụ cấp chức vụ).
    + Thù lao vượt giờ = $\max(0, \text{Giờ thực dạy} - \text{Định mức}) \times 120.000$đ/giờ chuẩn.
    + Bảo hiểm bắt buộc 10.5% (8% BHXH, 1.5% BHYT, 1% BHTN).
    + Giảm trừ bản thân $15.5$ triệu, giảm trừ người phụ thuộc $6.2$ triệu/người.
  - **Cơ chế Khóa Lương (`isLocked` / `DA_KHOA`) & Attendance Lock:**
    + Khi Admin/BGH thực hiện khóa sổ (`POST /api/payrolls/lock`), hệ thống chuyển toàn bộ phiếu lương tháng đó sang `DA_KHOA`, ghi nhận `khoa_luc`.
    + Chặn đứng mọi hành vi chỉnh sửa hoặc tính toán lại bảng lương khi đã khóa (ném lỗi `403 Forbidden` - `PAYROLL_LOCKED`).
    + Tự động khóa đồng bộ toàn bộ các bản ghi `AttendanceLog` trong tháng (`da_chot = true`, `isLocked = true`).
    + Mở khóa sổ (`POST /api/payrolls/unlock`) yêu cầu quyền Admin/BGH và bắt buộc ghi lý do phục vụ kiểm toán `AuditLog`.
  - **Xuất Báo Cáo Bảng Lương Excel & Phiếu Lương PDF Cá Nhân:**
    + `GET /api/payrolls/export/excel`: Trích xuất đầy đủ 20 cột dữ liệu bảng tính lương toàn trường/khoa.
    + `GET /api/payrolls/:id/export/pdf`: Trích xuất phiếu lương chi tiết từng cá nhân theo chuẩn in ấn biểu mẫu đại học.
- **Tích hợp Router `server/routes/payroll.routes.js`**: Định tuyến đầy đủ `/api/payrolls` và `/api/v1/payrolls` trong `server/routes/index.js`.
- **Kiểm thử tự động chuyên sâu**: Viết `server/tests/payrollSnapshotAndLock.test.js` gồm 6 bài test kiểm tra lũy tiến 5 bậc, Snapshot 2026, cơ chế Khóa lương và xuất báo cáo $\rightarrow$ Đạt 100% PASS.

### 9. AI Trợ Lý Chatbot (Gemini / Claude / Deepseek / Local LLM) Hỗ Trợ Tra Cứu Công & Giải Đáp Quy Chế Nhà Trường (Tuần 7)
- **Áp dụng quy trình thay thế & sao lưu file cũ**:
  - Sao lưu toàn bộ file của CSDL cũ sang tiền tố `old_` trên ổ đĩa để đối chiếu:
    + `server/services/ai/old_aiChat.service.js`
    + `server/services/ai/old_aiResponse.service.js`
    + `server/controllers/old_ai.controller.js`
- **Viết mới sạch 100% `server/services/ai/aiChat.service.js` & `server/services/ai/aiResponse.service.js`**:
  - **Đa Nhà Cung Cấp LLM (Multi-Provider Router):**
    + Hỗ trợ linh hoạt **Google Gemini** (`gemini-1.5-flash`, `gemini-2.0-flash`), **Anthropic Claude** (`claude-3-5-sonnet`), **DeepSeek** (`deepseek-chat`, `deepseek-r1`) và **Local LLM / Ollama** (`http://localhost:11434/v1`).
    + Chế độ tự động phát hiện khóa API trong môi trường hoặc chuyển đổi linh hoạt qua body `provider`.
  - **Cơ Sở Tri Thức Quy Chế Nhà Trường Năm 2026 (RAG & Local Knowledge Engine):**
    + Tích hợp sẵn bộ tri thức 5 chuyên đề đào tạo & nhân sự đại học:
      1. *Chấm công & Ca làm việc:* Ca sáng (07:00 - 11:30, check-in 06:45-07:15), Ca chiều (13:00 - 17:00, check-in 12:45-13:15), Geofence trường $150\text{m}$, phòng học $30\text{m}$.
      2. *Nghỉ phép & Phê duyệt:* Nghỉ $\le 3$ ngày Trưởng khoa duyệt, $> 3$ ngày Ban Giám Hiệu duyệt, hạn mức 12 ngày phép năm, chặn tự duyệt đơn, dạy bù bắt buộc.
      3. *Định mức giờ giảng:* 135 giờ chuẩn/kỳ (45 giờ/tháng), thù lao vượt giờ 120.000đ/giờ chuẩn, giảm trừ chức vụ (Trưởng khoa 30%, Phó khoa 25%, Trưởng BM 20%).
      4. *Tiền lương & Thuế TNCN 2026:* Lương cơ sở 2.530.000đ, phụ cấp ưu đãi nghề 30%, BHXH 10.5%, giảm trừ gia cảnh bản thân 15.5tr, phụ thuộc 6.2tr, thuế lũy tiến 5 bậc.
      5. *Sinh trắc học Face AI:* ArcFace 512D, đăng ký 5 góc $L_2$, Cooldown quét lặp 60s, Margin Top 1 - Top 2 $\ge 0.05$, kiểm tra Liveness Euler 3D.
    + Khi mất mạng hoặc không có API key bên ngoài: Hệ thống tự động kích hoạt **Local Rule-Based Knowledge Engine** trích xuất câu trả lời chuẩn xác ngay lập tức.
  - **Tra cứu Dữ liệu Chấm công & Lương Thông minh (Mode `attendance`):**
    + Xử lý ngôn ngữ tự nhiên (NLU / Intent Parsing) từ câu hỏi tiếng Việt của giảng viên, trưởng khoa và thanh tra đào tạo.
    + Kiểm soát phân quyền dữ liệu nghiêm ngặt theo RBAC (Cá nhân chỉ xem dữ liệu bản thân, Trưởng khoa xem khoa trực thuộc, BGH xem toàn trường).
    + Cơ chế làm rõ danh tính (Disambiguation) phân biệt rõ ràng khi nhiều cán bộ trùng tên.
- **Kiểm thử tự động chuyên sâu**: Viết `server/tests/aiAssistantMultiModelAndPolicy.test.js` gồm 6 bài test kiểm tra bộ tri thức 2026, Lookup Engine, giải đáp quy chế, chặn vượt quyền RBAC, Disambiguation và báo cáo số liệu $\rightarrow$ Đạt 100% PASS.

### 10. Tổng Kiểm Tra Hệ Thống, Audit Log, Swagger OpenAPI 3.0 & Triển Khai Docker Container Hóa Toàn Diện (Tuần 8)
- **Chuẩn hóa & Tăng cường Nhật ký Kiểm toán An toàn (`AuditLog` - Collection 10 `nhat_ky_kiem_toan`)**:
  - Thực thi nghiêm ngặt tính chất bất biến (Immutability / Append-Only) ở tầng Mongoose Schema: Mọi thao tác chỉnh sửa (`save`, `updateOne`, `updateMany`, `findOneAndUpdate`) hoặc xóa (`deleteOne`, `deleteMany`, `findOneAndDelete`) đều bị chặn đứng và ném lỗi `403 Forbidden` nhằm bảo toàn bằng chứng pháp lý và tuân thủ an toàn an ninh mạng.
  - Mở rộng phân quyền tra cứu tại `server/routes/auditLog.routes.js`: Cho phép cả **Admin** và **Ban Giám Hiệu (Hiệu trưởng, Hiệu phó)** (`verifyRole(['admin', 'hieutruong', 'hieupho'])`) tra cứu vết thao tác toàn hệ thống.
  - Nâng cấp `server/services/auditLog.service.js`: Bổ sung bộ lọc đa tiêu chí theo trạng thái `status` (`SUCCESS` / `FAILED`), tìm kiếm từ khóa `keyword` (regex trên `action`, `targetType`, `targetId`) kết hợp lọc người thực hiện `actor`, khoảng thời gian `startDate` - `endDate` và phân trang chuẩn hóa.
- **Hoàn thiện Bộ Tài liệu Chuẩn Swagger OpenAPI 3.0 (`server/config/swaggerPaths.js` & `swagger.js`)**:
  - Bổ sung đầy đủ Schemas các thực thể nghiệp vụ cốt lõi: `Payroll` (bảng lương 2026), `FaceTemplate` (mẫu khuôn mặt 5 góc), `SystemConfig` (cấu hình động hệ thống) và `AuditLog` (nhật ký kiểm toán).
  - Cập nhật chuẩn hóa endpoint `GET /api/health` phản ánh đúng **14 Collections v2.5**, trạng thái kết nối MongoDB, thời gian hoạt động `uptimeSeconds` và môi trường triển khai.
  - Bổ sung tài liệu OpenAPI 3.0 chi tiết cho toàn bộ các Endpoints mới:
    + `/api/audit-logs`: Tra cứu nhật ký kiểm toán cho Admin/BGH.
    + `/api/payrolls/generate`, `/api/payrolls`, `/api/payrolls/my-payroll`, `/api/payrolls/summary`, `/api/payrolls/{id}/lock`, `/api/payrolls/{id}/unlock`, `/api/payrolls/export/excel`, `/api/payrolls/export/pdf`.
    + `/api/face/detect-pose`, `/api/face/enroll-multi-angle`, `/api/face/registration-status/{userId}`, `/api/face/faces/{userId}`, `/api/face/health`.
    + `/api/system/configs`: Tra cứu và cập nhật cấu hình hệ thống thời gian thực.
  - Cập nhật danh mục `swaggerTags`: Đầy đủ 14 nhóm chức năng nghiệp vụ, sắp xếp khoa học, hỗ trợ thử nghiệm trực tiếp trên giao diện Swagger UI (`http://localhost:5000/api-docs`).
- **Đóng gói & Container Hóa Toàn Diện Hệ Thống (Docker & Docker Compose)**:
  - **`Dockerfile` (Gốc - Multi-stage Build):**
    + *Stage 1 (`builder`):* Dùng `node:20-alpine`, cài đặt dependencies, biên dịch frontend React TypeScript với Vite sang mã tĩnh `/app/dist`.
    + *Stage 2 (`runner`):* Dùng `node:20-alpine`, chỉ nạp production dependencies (`npm ci --omit=dev`), sao chép backend `server/` và static build `dist/`, tích hợp lệnh kiểm tra sức khỏe `HEALTHCHECK` trên cổng `5000`.
  - **`face-service/Dockerfile`:**
    + Dùng `python:3.10-slim`, tích hợp các thư viện hệ thống cần thiết cho OpenCV và InsightFace (`build-essential`, `cmake`, `libgl1`, `libglib2.0-0`), cài đặt `requirements.txt` và khởi chạy Uvicorn trên cổng `8001`.
  - **`docker-compose.yml` (Orchestration 3 Dịch Vụ):**
    + `mongo`: MongoDB 7.0 Replica Set (`--replSet rs0`) với healthcheck tự động khởi tạo (`rs.initiate()`), đảm bảo hỗ trợ đầy đủ ACID Multi-Document Transactions cho module Đơn từ & Lương.
    + `face-service`: Vi dịch vụ Python AI InsightFace, tự động gắn volume lưu trữ models (`insightface_models`) và thư mục ảnh minh chứng (`./uploads`).
    + `web`: Ứng dụng tích hợp Node.js Express + React tĩnh, kết nối đồng bộ tới `mongo` và `face-service` thông qua mạng nội bộ `app_network`, đảm bảo khởi chạy tuần tự theo trạng thái `service_healthy`.
  - **Tối ưu Build Context & Môi trường:** Tạo file `.dockerignore` tại thư mục gốc, `face-service/.dockerignore` và `.env.docker.example` làm mẫu cấu hình triển khai.
- **Kiểm thử tự động chuyên sâu**: Viết `server/tests/systemHealthAndAudit.test.js` gồm 4 nhóm test kiểm tra tính bất biến của AuditLog, logic lọc/phân trang, độ hoàn thiện của Swagger OpenAPI 3.0 và tính đúng đắn của toàn bộ tệp cấu hình Docker $\rightarrow$ Đạt 100% PASS.

### 11. Chuẩn Hóa Báo Cáo Theo RBAC v2.5, Dọn Dẹp File Cũ & Xây Dựng 3 Trang Frontend Còn Thiếu (Nghiệm Thu Toàn Diện)

- **Dọn dẹp triệt để 22 file `old_*` theo đúng quy định Workspace Guidelines (`AGENTS.md`)**:
  - Đã xóa bỏ hoàn toàn 22 file sao lưu cũ trên ổ đĩa (`server/controllers/old_*`, `server/services/old_*`, `server/middlewares/old_*`).
  - Toàn bộ codebase backend hiện tại hoạt động độc lập, tinh gọn, 100% mã nguồn mới chuẩn CSDL v2.5.
- **Chuẩn hóa Module Báo Cáo (`report.service.js`) & Phạm Vi Quản Lý (`deanScope.js`) theo RBAC v2.5**:
  - `server/utils/deanScope.js`: Nâng cấp hỗ trợ toàn diện các chức danh quản lý đơn vị (`TRUONG_KHOA`, `PHO_TRUONG_KHOA`, `TRUONG_BO_MON`, `PHO_TRUONG_BO_MON`, `TRUONG_PHONG`, `PHO_TRUONG_PHONG`) và các vai trò quản trị toàn trường (`ADMIN`, `BGH`, `TCCB`, `KE_TOAN`, `KIEM_TOAN`).
  - `server/services/report.service.js`: Chuyển đổi hoàn toàn từ kiểm tra chuỗi `role` phẳng cũ sang kiểm tra quyền hạt nhân `PERMISSIONS.CONG_XEM_TOAN_TRUONG`, `PERMISSIONS.CONG_XEM_DON_VI`, `PERMISSIONS.CONG_XEM_BAN_THAN` và hàm `hasPermission`. Cập nhật ánh xạ chức danh đầy đủ 10 vai trò môi trường đại học.
- **Xây dựng mới 3 trang giao diện Frontend hoàn chỉnh**:
  - `src/pages/Payroll.tsx`: **Trang Bảng Lương & Thu Nhập Năm 2026**:
    + Tab *Phiếu Lương Của Tôi*: Xem chi tiết thu nhập, lương chính, hệ số, phụ cấp chức vụ, thâm niên, ưu đãi nghề, thù lao giờ vượt định mức, các khoản bảo hiểm (10.5%) và thuế TNCN lũy tiến 5 bậc.
    + Tab *Quản Lý Bảng Lương (Admin/BGH/Kế toán)*: Thống kê 4 thẻ chỉ số quỹ lương (Tổng Net, Tổng Gross, Thuế TNCN, Bảo hiểm), bộ lọc theo tháng/năm/đơn vị, bảng danh sách chi tiết, modal xem chi tiết từng cán bộ, tính lương tháng tự động, khóa sổ lương (`isLocked` & `da_chot = true`), mở khóa sổ lương có ghi nhận lý do vào Audit Log, xuất báo cáo Excel/PDF.
  - `src/pages/AIChat.tsx`: **Trang Trợ Lý AI Chatbot**:
    + Giao diện hội thoại thông minh thời gian thực, thiết kế glassmorphism hiện đại, tự động cuộn và hiển thị trạng thái đang phân tích.
    + Hỗ trợ chuyển đổi 3 chế độ: *Giải Đáp Quy Chế Nhà Trường 2026* (`policy`), *Tra Cứu Chấm Công & Giảng Dạy* (`attendance`), *Học Thuật & Đào Tạo* (`academic`).
    + Tùy chọn nhà cung cấp LLM linh hoạt: *Tự Động (Auto)*, *Google Gemini*, *Anthropic Claude*, *DeepSeek*, *Local Ollama*.
    + Bộ câu hỏi gợi ý nhanh và xử lý danh sách làm rõ danh tính khi nhiều cán bộ trùng tên (Disambiguation).
  - `src/pages/Holidays.tsx`: **Trang Quản Lý Ngày Nghỉ Lễ Toàn Trường**:
    + Xem danh sách ngày nghỉ lễ theo năm dương lịch, thống kê số ngày nghỉ và mô tả chi tiết.
    + Chức năng CRUD (Thêm mới, Chỉnh sửa, Xóa) ngày nghỉ lễ dành cho Quản trị viên/TCCB.
    + Tự động tích hợp vào hệ thống để loại trừ ngày công chuẩn và tính hệ số làm thêm giờ.
- **Đồng bộ hóa Định tuyến và Điều hướng**:
  - Cập nhật `src/App.tsx`: Định tuyến bảo vệ cho 3 trang mới (`/payroll`, `/ai-chat`, `/holidays`).
  - Cập nhật `src/components/Layout.tsx`: Tích hợp các mục menu điều hướng Sidebar kèm biểu tượng trực quan (`Sparkles`, `DollarSign`, `CalendarDays`) và badge trạng thái.
  - Cập nhật `src/types/index.ts`: Bổ sung đầy đủ định nghĩa TypeScript interfaces cho `Payroll`, `Holiday`, `AiChatMessage`.

### 12. Rà Soát Toàn Diện Backend, Dọn Dẹp File Thừa & Mã Nguồn Không Sử Dụng (Ngày 16/10/2026)

- **Rà soát & Phân tích toàn bộ cây phụ thuộc Backend (`server/`)**:
  - Thực hiện quét tự động toàn bộ 121 file mã nguồn trong `server/` (models, controllers, routes, services, middlewares, utils, config, scripts, tests) bằng thuật toán phân tích đồ thị phụ thuộc (Static AST & Import Graph Analysis).
  - Kết quả rà soát xác định 2 file không còn mục đích sử dụng và một số đoạn mã dự phòng OTP cũ cần dọn dẹp:
    + `server/config/campus_config.json`: File JSON tĩnh cấu hình tọa độ khuôn viên và bán kính Geofence GPS. Đã được chuyển dịch sang **Collection 13 (`SystemConfig`)** trong MongoDB v2.5 và dự phòng qua biến môi trường `.env`.
    + `server/tests/aiAssistant.test.js`: File kiểm thử AI phiên bản đầu, đã được thay thế toàn diện bởi suite đa mô hình LLM và kiểm tra quy chế RBAC `server/tests/aiAssistantMultiModelAndPolicy.test.js`.
- **Thực hiện xóa bỏ và dọn dẹp theo đúng chuẩn Workspace Guidelines (`AGENTS.md`)**:
  - Xóa vĩnh viễn `server/config/campus_config.json` và `server/tests/aiAssistant.test.js`.
  - Cập nhật `package.json`: Điều chỉnh script `"test:ai"` trỏ chính xác về `"node server/tests/aiAssistantMultiModelAndPolicy.test.js"`.
  - Tinh chỉnh `server/utils/attendanceHelpers.js`: Bổ sung cơ chế xử lý ngoại lệ an toàn cho `savePersistedCampusConfig` khi không còn file tĩnh, tự động duy trì hoạt động ổn định trên RAM và fallback `.env`.
  - Dọn dẹp mã nguồn OTP dư thừa:
    + `server/middlewares/rateLimiter.middleware.js`: Loại bỏ các hàm/middleware giới hạn gửi mã OTP không sử dụng (`getOtpRateKey`, `otpRequestLimiter`, `otpVerifyLimiter`).
    + `server/services/email.service.js`: Loại bỏ các hàm gửi email mã OTP đăng ký công khai (`sendOtpEmail`, `sendRegistrationSuccessEmail`) do cơ chế định danh người dùng v2.5 được cấp phát tài khoản trực tiếp bởi Quản trị viên/TCCB.
- **Tái kiểm thử và xác thực độc lập 100% Codebase sạch**:
  - Chạy quét kiểm tra phụ thuộc: Xác nhận toàn bộ **119 file còn lại trong `server/` đều đang hoạt động tích cực (0 file không sử dụng)**.
  - Chạy `npm test`: Đạt **14/14 test suites PASS 100%**.
  - Chạy `npm run test:ai`: Đạt **6/6 tests PASS 100%**.
  - Chạy `npm run build`: Đạt **Thành công 100%** không phát sinh bất kỳ lỗi TypeScript, cú pháp hay đóng gói nào.

---

## 📅 NGÀY 17/10/2026: ĐỒNG BỘ TOÀN DIỆN CSDL DANH MỤC (KHOA, CA LÀM, MÔN HỌC), CRON SERVICE CHỐT CÔNG IDEMPOTENT & MA TRẬN 17 TRANG FRONTEND

### 13. Chi Tiết Các Module Danh Mục Nghiệp Vụ Cốt Lõi (Collections 7, 8, 9)
- **Collection 7: `Department` (`don_vi` / `khoa_phong_ban`)**:
  - Mã nguồn: `server/models/department.model.js`, `server/services/department.service.js`, `server/controllers/department.controller.js`, `src/pages/Departments.tsx`.
  - Nghiệp vụ thực thi:
    + Quản lý mô hình phân cấp tổ chức trường đại học: Ban Giám Hiệu $\rightarrow$ Khoa đào tạo $\rightarrow$ Bộ môn trực thuộc khoa, và các Phòng ban chức năng (Tổ chức cán bộ, Đào tạo, Khảo thí, Kế toán, Thanh tra).
    + Trường dữ liệu: `ma_don_vi`, `ten_don_vi`, `loai_don_vi` (`KHOA`, `BO_MON`, `PHONG_BAN`, `TRUNG_TAM`), `don_vi_cha_id` (hỗ trợ đệ quy cây đơn vị), `truong_don_vi_id`, `pho_don_vi_ids`, `email_lien_he`, `so_dien_thoai`.
    + Ràng buộc toàn vẹn dữ liệu: Chặn xóa đơn vị nếu đang có nhân sự trực thuộc hoặc có bộ môn con đang hoạt động.
- **Collection 8: `ShiftConfig` (`ca_lam_viec`)**:
  - Mã nguồn: `server/models/shiftConfig.model.js`, `server/services/shiftConfig.service.js`, `server/controllers/shift.controller.js`, `src/pages/Shifts.tsx`.
  - Nghiệp vụ thực thi:
    + Cấu hình khung thời gian linh hoạt cho cả khối hành chính và khối giảng viên: Ca sáng (07:00 - 11:30), Ca chiều (13:00 - 17:00), Ca hành chính cả ngày (07:30 - 17:00).
    + Bộ đệm thời gian thông minh (Time Buffers):
      * `checkin_som_phut` (cho phép quẹt sớm tối đa, vd: 30 phút).
      * `checkin_muon_cho_phep_phut` (ngưỡng đi muộn cho phép, vd: 15 phút).
      * `checkout_som_cho_phep_phut` (ngưỡng về sớm cho phép, vd: 10 phút).
      * `checkout_muon_phut` (giới hạn quẹt ra muộn nhất trước khi tự động chốt).
    + Tính toán hệ số công chuẩn (`he_so_cong`), tự động gán vào các bản ghi `AttendanceLog`.
- **Collection 9: `Subject` (`mon_hoc`)**:
  - Mã nguồn: `server/models/subject.model.js`, `server/services/subject.service.js`, `server/controllers/subject.controller.js`, `src/pages/Subjects.tsx`.
  - Nghiệp vụ thực thi:
    + Quản lý danh mục học phần đại học: `ma_mon_hoc` (duy nhất, viết hoa), `ten_mon_hoc`, `so_tin_chi` (1 - 10), `so_tiet_ly_thuyet`, `so_tiet_thuc_hanh`, `khoa_bo_mon_id` (đơn vị chuyên môn quản lý).
    + Tích hợp trực tiếp với Collection 6 `Schedule` (`lich_giang_day`) để phân công giảng viên, tính toán khối lượng giờ giảng quy đổi và thù lao vượt giờ.

### 14. Dịch Vụ Nền Cron Service Chốt Công Tự Động, Xử Lý Quên Quẹt Ra & Cơ Chế Catch-Up Idempotent (`cron.service.js`)
- **Kiến trúc Idempotent tuyệt đối qua trường khóa tự nhiên `khoa_cong` (`YYYY-MM-DD_userId`)**:
  - Thực thi chỉ mục duy nhất `unique: true` trên `khoa_cong` trong `AttendanceLog`. Dù Cron quét lại nhiều lần trong ngày hoặc máy chủ khởi động lại, hệ thống bắt mã lỗi `E11000 duplicate key` và bỏ qua an toàn, tuyệt đối không bao giờ nhân bản bản ghi công.
- **Tiến trình Quét Vắng Mặt Tự Động (Auto Absent Scanner)**:
  - Lịch trình kích hoạt: Định kỳ mỗi 5 phút (`*/5 * * * *`) cho các ca đã hết hạn và chốt tổng kết cuối ngày lúc 23:59 (`59 23 * * *`).
  - Logic xác định vắng mặt:
    + Quét toàn bộ lịch giảng dạy và ca phân công trong ngày của giảng viên/nhân sự.
    + Nếu nhân sự **chưa có lượt quẹt `PunchLog`** và **không có đơn nghỉ phép `LeaveRequest` được duyệt**: Tự động tạo bản ghi `AttendanceLog` với trạng thái `ABSENT` (`VANG_MAT`), cờ `co_phep = false`, `deviceId = 'SYSTEM_CRON'`.
    + Nếu nhân sự có đơn nghỉ phép được duyệt hợp lệ: Tự động gắn trạng thái `EXCUSED_ABSENCE` (`co_phep = true`).
- **Xử lý Tự Động Quên Quẹt Ra (`quen_quet_ra`)**:
  - Quét các bản ghi đã có Check-in nhưng khi ca làm việc kết thúc quá thời gian cho phép mà không có lượt Check-out: Hệ thống tự động bật cờ `quen_quet_ra = true` và ghi chú rõ ràng để phục vụ quản lý/giải trình công sau này.
- **Kiểm tra Ngày Lễ & Chế Độ Bảo Trì (Holiday & Maintenance Skip)**:
  - Tự động đối chiếu với Collection 12 `Holiday` (`NgayNghiLe`): Nếu ngày hiện tại là ngày lễ toàn trường (vd: Tết, Quốc khánh, Ngày 20/11), hệ thống tự động ghi Audit Log `CRON_HOLIDAY_SKIPPED` và bỏ qua quét vắng mặt, không đánh vắng oan cán bộ giảng viên.
  - Tự động bỏ qua khi biến `SYSTEM_MAINTENANCE_MODE = true`.
- **Cơ chế Catch-Up khi Khởi Động Máy Chủ (Server Restart Catch-Up)**:
  - Khi máy chủ Node.js khởi động, hệ thống tự động kích hoạt tiến trình rà soát:
    + Dọn dẹp các bản ghi vắng mặt bị tạo nhầm do lệch múi giờ (nếu có).
    + Quét bù các ca học/ca làm việc đã kết thúc trong thời gian máy chủ bảo trì hoặc ngoại tuyến, đảm bảo dữ liệu chấm công liên tục và nhất quán 100%.
- **Nhật ký Kiểm toán Tự động**: Mọi hành vi tự động của Cron đều ghi vết chi tiết vào Collection 10 `AuditLog` với `action: 'CRON_AUTO_ABSENT'`, `actor: 'SYSTEM_CRON'`, lưu trữ bằng chứng phục vụ thanh tra.

### 15. Bức Tranh Toàn Cảnh 17 Trang Giao Diện Frontend (React + TypeScript + TailwindCSS + Vite)
Hệ thống giao diện người dùng được thiết kế chuẩn mực, hiện đại, tối ưu trải nghiệm (UX) với đầy đủ 17 phân hệ tương ứng với các quy trình nghiệp vụ:
1. `src/pages/Dashboard.tsx`: **Bảng Điều Khiển Tổng Quan** - Thống kê KPIs thời gian thực, biểu đồ tỷ lệ chuyên cần (đi làm, vắng, đi muộn, có phép), danh sách giảng viên đang giảng dạy hôm nay, thông báo nhanh.
2. `src/pages/AttendanceMe.tsx`: **Chấm Công Của Tôi** - Xem lịch sử điểm danh cá nhân theo tháng, chi tiết từng lượt quẹt thô (PunchLog) vào/ra kèm tọa độ GPS và ảnh minh chứng.
3. `src/pages/AttendanceManage.tsx`: **Quản Lý Điểm Danh Toàn Trường / Đơn Vị** - Dành cho Trưởng khoa/HR/BGH: Lọc theo khoa/phòng ban (chuẩn deanScope), điều chỉnh công thủ công có lưu vết Audit Log, xuất dữ liệu điểm danh.
4. `src/pages/FaceRegistrationPage.tsx`: **Đăng Ký Khuôn Mặt 5 Góc Thời Gian Thực** - Hướng dẫn cán bộ quay mặt 5 hướng (Chính diện, Trái, Phải, Ngước, Cúi) với HUD đo góc Euler 3D và tự động chụp.
5. `src/pages/Schedules.tsx`: **Quản Lý Thời Khóa Biểu Học Kỳ** - Xem lưới TKB, tạo lịch chính khóa/dạy bù, kiểm tra xung đột giảng viên & phòng học, quản lý ngoại lệ hủy/dời buổi học.
6. `src/pages/LeaveRequests.tsx`: **Quản Lý & Phê Duyệt Đơn Từ Đa Cấp** - Nộp đơn nghỉ phép/dạy bù, luồng duyệt 1 cấp (Khoa) hoặc 2 cấp (BGH), chặn tự duyệt đơn, khóa lạc quan 409, hủy đơn hoàn tác công.
7. `src/pages/Payroll.tsx`: **Bảng Lương & Phiếu Thu Nhập Năm 2026** - Tính lương theo hệ số đại học, thù lao vượt giờ, biểu thuế TNCN 5 bậc, khóa sổ lương (`isLocked`), xuất báo cáo Excel và PDF.
8. `src/pages/AIChat.tsx`: **Trợ Lý AI Chatbot Nhà Trường** - Giao diện hội thoại đa mô hình LLM (Gemini/Claude/DeepSeek/Local), giải đáp quy chế 2026, tra cứu công và thù lao theo phân quyền RBAC.
9. `src/pages/Users.tsx`: **Hồ Sơ Nhân Sự & Tài Khoản** - Danh sách cán bộ/giảng viên, cấp phát tài khoản, phân quyền 10 vai trò, quản lý nhiệm kỳ, khóa tài khoản, liên kết Face ID.
10. `src/pages/Departments.tsx`: **Cơ Cấu Tổ Chức & Đơn Vị** - Quản lý Khoa đào tạo, Bộ môn, Phòng ban, gán Trưởng/Phó đơn vị, bảo toàn dữ liệu phân cấp.
11. `src/pages/Shifts.tsx`: **Cấu Hình Ca Làm Việc** - Thiết lập khung giờ ca sáng, ca chiều, ca hành chính, cấu hình số phút đi muộn/về sớm và hệ số công.
12. `src/pages/Subjects.tsx`: **Danh Mục Môn Học & Học Phần** - Quản lý mã học phần, số tín chỉ, số tiết lý thuyết/thực hành, bộ môn phụ trách.
13. `src/pages/Holidays.tsx`: **Lịch Nghỉ Lễ Toàn Trường** - Quản lý danh mục ngày nghỉ lễ theo năm, tự động tích hợp trừ công chuẩn và miễn trừ quét vắng mặt.
14. `src/pages/Reports.tsx`: **Báo Cáo & Thống Kê Chuyên Sâu** - Báo cáo tỷ lệ chuyên cần theo khoa/tháng, thống kê vi phạm Geofence GPS, xuất báo cáo đa định dạng.
15. `src/pages/AuditLogs.tsx`: **Nhật Ký Kiểm Toán An Toàn (Append-Only)** - Dành riêng cho Admin và BGH: Tra cứu và lọc lịch sử thao tác của toàn bộ người dùng và hệ thống.
16. `src/pages/Settings.tsx`: **Cấu Hình Động Hệ Thống (SystemConfig)** - Điều chỉnh 19 tham số nghiệp vụ thời gian thực (Lương cơ sở, ngưỡng AI, Geofence, Cooldown...).
17. `src/pages/Login.tsx`: **Cổng Đăng Nhập Xác Thực** - Đăng nhập an toàn JWT, tự động lưu phiên, bảng chọn tài khoản demo nhanh cho 13 vị trí cán bộ mẫu đại học.

### 16. Chuẩn Hóa & Nâng Cấp Toàn Diện Bản Đặc Tả Kiến Trúc `THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md` Lên v2.6 (Ngày 17/10/2026)
- **Khắc phục lỗi mã hóa & ký tự lạ:**
  - Phát hiện và xử lý triệt để byte lỗi `0xC4` tại vị trí 35370 làm hỏng bảng mã UTF-8 của file đặc tả. Toàn bộ file hiện tại là 100% Valid UTF-8 thuần khiết.
- **Sửa lỗi trùng lặp văn bản và dọn dẹp đoạn mã rác (Mục 5 & Mục 6):**
  - Xóa bỏ đoạn văn bản chắp nối rác (`không GPS (toa_do_gps: undefined)... 234567 Người giám sát...`).
  - Hợp nhất tiêu đề và bảng tiến độ Mục 6 thành một khối thống nhất: `## 6. LỘ TRÌNH TRIỂN KHAI 8 TUẦN & DANH MỤC 14 TEST SUITES TỰ ĐỘNG`.
  - Cập nhật danh mục kiểm thử từ 5 bài test sơ khai lên đầy đủ **14 Test Suites tự động hoàn chỉnh** (`npm test`) đạt 100% PASS.
- **Bổ sung ràng buộc Tính Bất Biến (Immutability / Append-Only) cho Collection 14 `nhat_ky_kiem_toan`**:
  - Tích hợp middleware Mongoose chặn đứng mọi hành vi sửa xóa (`save`, `updateOne`, `deleteMany`...) với lỗi 403 Forbidden bảo đảm giá trị pháp lý cho bằng chứng thanh tra.
- **Khôi phục Mục 4.8 và bổ sung đầy đủ 5 mục quy trình nghiệp vụ mới (Mục 4.9 đến 4.13)**:
  - `4.8. Quy Đổi Giờ Chuẩn Giảng Dạy, Thuế Snapshot 2026 & Xoay Khóa CCCD`: Công thức quy đổi 3 hệ số, biểu thuế lũy tiến 5 bậc, snapshot tham số và mã hóa AES-256-GCM.
  - `4.9. Sinh Trắc Học Face AI, Động Cơ Nhận Diện 1:N RAM & Đồng Bộ Hai Nguồn Sự Thật`: InsightFace 512D, đăng ký 5 góc, NumPy Dot Product ~2ms, Margin Top 1-2 $\ge 0.05$, Cooldown 60s và cơ chế Auto Self-Healing RAM.
  - `4.10. Trợ Lý AI Chatbot Đa Mô Hình (Gemini/Claude/DeepSeek/Local) & Tri Thức Quy Chế 2026`: Multi-Provider Router, bộ tri thức 5 chuyên đề đại học 2026, Local Rule-Based Engine, Disambiguation khi trùng tên cán bộ và phân quyền NLU RBAC.
  - `4.11. Kiến Trúc Container Hóa Docker & Docker Compose Toàn Diện`: Multi-stage Dockerfile cho Web, Python 3.10 slim cho Face Service, MongoDB 7.0 Replica Set rs0 hỗ trợ ACID Transactions.
  - `4.12. Tài Liệu Chuẩn Swagger OpenAPI 3.0 & 26 RESTful Endpoints`: OpenAPI 3.0 UI tập trung tại `/api-docs` với 14 tags chức năng và 26 endpoints RESTful cốt lõi.
  - `4.13. Sơ Đồ Kiến Trúc & Ma Trận 17 Phân Hệ Giao Diện Frontend`: Bản đồ 17 trang giao diện React TypeScript hoàn chỉnh.

---

## 📊 TỔNG HỢP TRẠNG THÁI KIỂM THỬ & NGHIỆM THU TOÀN DIỆN (TUẦN 1 -> TUẦN 8)

### Danh mục 14 Test Suites tự động (`npm test`) - Đạt 100% PASS:
1. `punchLogGeo.test.js`: Kiểm thử tọa độ GPS GeoJSON, index 2dsphere và SystemConfig.
2. `rbacAndTokenRotation.test.js`: Kiểm thử phân quyền RBAC 10 vai trò, nhiệm kỳ, ủy quyền và Token Rotation Grace Period 15s.
3. `payrollAndRevocation.test.js`: Kiểm thử Model Payroll và cơ chế Token Revocation in-memory.
4. `faceEnrollment.test.js`: Kiểm thử FaceTemplate 5 góc, $L_2$ Centroid và chống trùng lặp khuôn mặt.
5. `scheduleConflictAndRealtime.test.js`: Kiểm thử TKB học kỳ, chống xung đột giảng viên/phòng học, Margin Top 1-2 và Cooldown 60s.
6. `modelValidation.test.js`: Kiểm thử tính hợp lệ của các schema core (14 collections).
7. `attendanceEvidence.test.js`: Kiểm thử xử lý và bảo mật ảnh minh chứng điểm danh.
8. `config.test.js`: Kiểm thử nạp biến môi trường và cấu hình hệ thống.
9. `leaveValidation.test.js`: Kiểm thử nghiệp vụ đơn nghỉ phép.
10. `farFrrBiometrics.test.js`: Thực nghiệm đo đạc FAR/FRR sinh trắc học, Margin Top 1-2, Geofence GPS Haversine và Auto Self-Healing RAM.
11. `leaveMultiLevelAndRetroactive.test.js`: Kiểm thử duyệt đơn đa cấp Khoa -> BGH, Chặn tự duyệt đơn (403), Optimistic Locking (409) và Hồi tố/Hoàn tác công.
12. `payrollSnapshotAndLock.test.js`: Kiểm thử Thuế TNCN lũy tiến 5 bậc, Snapshot tham số 2026, Khóa lương (isLocked / DA_KHOA) và xuất báo cáo Excel/PDF.
13. `aiAssistantMultiModelAndPolicy.test.js`: Kiểm thử AI Chatbot đa LLM (Gemini/Claude/DeepSeek/Local), Cơ sở tri thức Quy chế đại học 2026 và phân quyền tra cứu công.
14. `systemHealthAndAudit.test.js`: Kiểm thử AuditLog bất biến (Append-Only), Swagger OpenAPI 3.0 specs và cấu trúc Docker Containerization toàn diện.

### 17. Đồng Bộ Hóa Toàn Diện `README.md` Chuẩn Kiến Trúc v2.6 & Nghiệm Thu Hồi Quy (Ngày 17/10/2026)
- **Đồng bộ hóa 100% `README.md` theo kiến trúc chuẩn v2.6:**
  - **Mục lục & Tech Stack (Mục 1 & 2.1):** Cập nhật 14 Collections v2.6, Docker Compose, Swagger OpenAPI 3.0, Multi-LLM AI Router (Gemini/Claude/DeepSeek/Local).
  - **Cấu trúc thư mục (Mục 3):** Chuẩn hóa danh sách 14 model Mongoose và 17 trang giao diện React TypeScript.
  - **Bảng 14 Collections CSDL v2.6 (Mục 4):** Đồng bộ chi tiết 14 collections, loại bỏ bảng đen TokenBlacklist và thay thế bằng cơ chế thu hồi RAM + `phien_ban_token`.
  - **Danh mục API RESTful (Mục 8):** Bổ sung đầy đủ các phân hệ mới: Quản lý Lương & Thuế TNCN (`/api/payrolls`), Ngày lễ & Nghỉ bù (`/api/holidays`), Cấu hình động GPS & Ngưỡng muộn (`/api/system/configs`), Sinh trắc học Microservice (`/api/face`), Danh mục Môn học (`/api/subjects`), Ca làm việc (`/api/shifts`), Lịch giảng dạy (`/api/schedules`), Khoa/Phòng ban (`/api/departments`) và liên kết Swagger UI tại `http://localhost:5000/api-docs`.
  - **Phân hệ Giao diện Frontend (Mục 9):** Cập nhật bản đồ 17 trang giao diện người dùng thực tế tại `src/pages/*.tsx`.
  - **Triển khai Container Hóa (Mục 10.7):** Thêm hướng dẫn khởi chạy nhanh bằng `docker-compose up -d --build` (3 dịch vụ: Web Multi-stage, Python Face AI, MongoDB Replica Set `rs0` ACID Transactions).
  - **Bảng Kết quả Kiểm thử Tự động (Mục 12.1):** Nâng cấp từ bảng 5 test sơ khai lên danh mục **14 Test Suites tự động hoàn chỉnh** (`server/tests/`) với 143+ kịch bản kiểm thử đạt 100% PASS.
  - **Hiện trạng & Lộ trình (Mục 13):** Xác nhận các tính năng Ngày lễ (`ngay_nghi_le`) và Khóa sổ kỳ lương (`bang_luong`) đã hoàn thành 100% trong bản v2.6.
  - **Dọn dẹp triệt để thuật ngữ Kiosk:** Rà soát và loại bỏ 100% các từ khóa/thuật ngữ "Kiosk" cũ còn sót lại trong các file tài liệu (`README.md`, `THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md`). Đồng bộ hóa toàn bộ thành kiến trúc hiện đại: **Camera Điểm danh Khuôn mặt Trực tiếp trên Web SPA** qua `FaceAttendanceScannerModal.tsx` (Camera WebRTC + HUD 3D Wireframe Mesh 60 FPS + Popup xác nhận vai trò).

### 18. Rà Soát Bộ Cấu Hình (`server/config`) & Tinh Chỉnh Import Thừa Tại Middleware Phân Quyền (Ngày 17/10/2026)
- **Rà soát & Thẩm định toàn diện 6 file cấu hình cốt lõi Backend (`server/config`)**:
  - `db.js`: Quản lý kết nối MongoDB và nạp sớm 14 Schemas/Models.
  - `env.js`: Kiểm soát an toàn biến môi trường, chống khóa yếu (>= 32 ký tự), tách biệt JWT/Refresh secret, xác thực URL AI và cấu hình Production.
  - `mailer.js`: Thiết lập SMTP Nodemailer tích hợp Mock Mailer tự động khi dev/test.
  - `permissions.js`: Hạt nhân ma trận phân quyền RBAC đa vai trò (22 mã quyền hạt nhân, tính hạn nhiệm kỳ và ủy quyền cấp phó).
  - `swagger.js`: Cấu hình máy chủ tài liệu OpenAPI 3.0 serving tại `/api-docs`.
  - `swaggerPaths.js`: Định nghĩa Schemas chuẩn và 26 Endpoints API RESTful (đã dọn sạch 100% routes Kiosk cũ).
  - Xác nhận: 100% 6 file đều cần thiết, không có file thừa hoặc file mồ côi trong `server/config/`.
- **Khắc phục biến tàn dư cũ tại Middleware Phân Quyền (`server/middlewares/auth.middleware.js`)**:
  - Loại bỏ import biến không tồn tại và không sử dụng `ALL_PERMISSIONS` từ `../config/permissions`, rút gọn thành `const { ROLE_PERMISSIONS } = require('../config/permissions');`.
- **Kiểm thử hồi quy & nghiệm thu toàn diện**:
  - Chạy `npm test`: Đạt **14/14 test suites PASS 100%**.
  - Chạy `npm run build`: Đạt **Thành công 100%** (`tsc -b && vite build` hoàn tất sạch sẽ không lỗi).
  - Codebase hoàn toàn sạch sẽ, không có file rác, import chuẩn mực 100%.

### 19. Kiểm Tra Toàn Diện Bộ Middleware (`server/middlewares`) & Khôi Phục Bộ Giới Hạn Đăng Nhập (`loginLimiter`) (Ngày 17/10/2026)
- **Rà soát & Thẩm định toàn diện 5 file Middleware Backend (`server/middlewares`)**:
  - `auth.middleware.js`: Xác thực JWT Bearer, Token Revocation in-memory, `phien_ban_token`, RBAC 10 vai trò đại học, kiểm tra hạn nhiệm kỳ, ủy quyền cấp phó và fallback terminal key.
  - `error.middleware.js`: Xử lý tập trung ngoại lệ (CastError, MulterError, E11000 duplicate key, ValidationError, JWT expired/invalid) và 404 handler.
  - `faceImageUpload.middleware.js`: Cấu hình Multer memory storage chuyên dụng cho ảnh khuôn mặt (JPEG/PNG/WebP, 5MB, đơn ảnh hoặc mảng 10 ảnh).
  - `rateLimiter.middleware.js`: Bảo vệ hệ thống chống tấn công Brute-force và DoS (tách IPv4/IPv6, keyGenerator IP + Email).
  - `upload.middleware.js`: Lưu trữ tệp minh chứng đính kèm (ảnh, PDF, Word) vào thư mục `uploads/` với UUID ngẫu nhiên.
- **Phát hiện & Khắc phục lỗi thiếu định nghĩa `loginLimiter` trong `rateLimiter.middleware.js`**:
  - Khôi phục định nghĩa `loginLimiter` (giới hạn 5 lần đăng nhập sai / 15 phút, bỏ qua request thành công với `skipSuccessfulRequests: true`, môi trường dev hỗ trợ 50 lần), giải quyết triệt để lỗi ReferenceError khi nạp `auth.routes.js`.
- **Kiểm thử hồi quy & nghiệm thu toàn diện**:
  - Chạy `npm test`: Đạt **14/14 test suites PASS 100%**.
  - Chạy `npm run build`: Đạt **Thành công 100%** (`tsc -b && vite build` hoàn tất sạch sẽ không lỗi).
  - Codebase hoàn toàn sạch sẽ, 5 middleware hoạt động trơn tru 100%.

### 20. Kiểm Tra Toàn Diện Bộ Tiện Ích (`server/utils`) & Bổ Sung Đồng Bộ Chỉ Mục PunchLog trong Seeder (Ngày 17/10/2026)
- **Rà soát & Thẩm định toàn diện 11 file Tiện ích Backend (`server/utils`)**:
  - `aiDateParser.js`: Tiện ích phân tích ngữ nghĩa mốc thời gian tiếng Việt tự nhiên ("hôm nay", "tháng trước", "từ ngày... đến ngày...") cho AI Assistant theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
  - `attendanceEvidence.js`: Quản lý lưu trữ/đọc ảnh minh chứng điểm danh an toàn (`private/attendance-evidence/`, quyền `0o600`, kiểm tra magic bytes JPEG/PNG/WebP, chống Path Traversal).
  - `attendanceHelpers.js`: Thuật toán sinh trắc học và vị trí cốt lõi (Khoảng cách Euclidean, L2-normalized Centroid, Chống trùng khuôn mặt `checkDuplicateFace`, Geofence Haversine GPS, QR TOTP HMAC SHA-256, Bộ đệm RAM vector khuôn mặt).
  - `attendanceTime.utils.js`: Xử lý thời gian và quy đổi công chuẩn (Múi giờ UTC+7, tính phút trong ngày, xác định ca hợp lệ, tính công và phạt đi muộn/về sớm).
  - `deanScope.js`: Phân quyền dữ liệu theo phân cấp đơn vị BFS (chặn Horizontal Privilege Escalation giữa các khoa/phòng ban).
  - `responseHandler.js`: Chuẩn hóa phản hồi API đồng nhất `{ success, data, message, errorCode }` và từ điển mã lỗi `ERROR_CODES`.
  - `schemaAliasPlugin.js`: Plugin Mongoose ánh xạ đệ quy hai chiều (Dual-Standard: CSDL thuần Việt & Code tiếng Anh).
  - `seeder.js`: Khởi tạo dữ liệu mẫu 10 phòng ban, 4 ca làm việc, môn học, 13 tài khoản demo, 19 cấu hình hệ thống động.
  - `serviceError.js`: Lớp ngoại lệ nghiệp vụ tùy chỉnh (`Custom Operational Error`) hỗ trợ `statusCode`, `errorCode` và `data`.
  - `tokenRevocation.js`: Quản lý danh sách thu hồi JWT Token in-memory kèm tự động dọn dẹp mỗi 5 phút (thay thế triệt để bảng TokenBlacklist).
  - `transaction.js`: Bộ bọc thực thi MongoDB ACID Multi-Document Transactions với cơ chế tự động Fallback khi chạy Standalone.
- **Tối ưu hóa `seeder.js`**: Bổ sung `PunchLog` (`luot_quet_cham_cong`) vào tiến trình nạp model và `Promise.all` `syncIndexes()`, đảm bảo đủ 100% 14 collections Mongoose được đồng bộ chỉ mục khi seed.
- **Kiểm thử hồi quy & nghiệm thu toàn diện**:
  - Chạy `npm test`: Đạt **14/14 test suites PASS 100%**.
  - Chạy `npm run build`: Đạt **Thành công 100% (2.11s)** (`tsc -b && vite build` hoàn tất sạch sẽ không lỗi).
  - Codebase hoàn toàn sạch sẽ, 11 tiện ích hoạt động tối ưu 100%.

### 21. Kiểm Tra Toàn Diện Bộ Điều Khiển (`server/controllers`) & Khắc Phục Lỗi Export `detectPose` Trong `attendance.controller.js` (Ngày 17/10/2026)
- **Rà soát & Thẩm định toàn diện 17 file Controllers Backend (`server/controllers`)**:
  - `ai.controller.js`: Xử lý luồng hội thoại Trợ lý AI và phân tích thống kê công/lương.
  - `attendance.controller.js`: Xử lý điểm danh khuôn mặt, check-in, check-out, QR động, cấu hình GPS, kiểm tra RAM FAISS.
  - `auditLog.controller.js`: Cung cấp API lọc và phân trang nhật ký kiểm toán hệ thống.
  - `auth.controller.js`: Đăng nhập, làm mới token, đăng xuất, đổi mật khẩu, cập nhật avatar.
  - `department.controller.js`: Quản lý danh mục và cấu trúc cây phân cấp đơn vị/phòng ban.
  - `face.controller.js`: Phát hiện tư thế đầu 3D (Euler Yaw, Pitch, Roll), đăng ký khuôn mặt 5 góc, xóa dữ liệu Face ID.
  - `holiday.controller.js`: Tra cứu và thiết lập ngày nghỉ lễ, ngày nghỉ bù toàn trường.
  - `leaveRequest.controller.js`: Tiếp nhận đơn từ, duyệt đơn Cấp 1 (Khoa), duyệt đơn Cấp 2 (BGH), hủy đơn.
  - `notification.controller.js`: Lấy danh sách và đánh dấu đã đọc thông báo người dùng.
  - `payroll.controller.js`: Tính toán bảng lương, khóa sổ lương, mở khóa lương, xuất báo cáo Excel/PDF.
  - `report.controller.js`: Xuất dữ liệu thống kê chấm công theo phòng ban và toàn trường.
  - `schedule.controller.js`: Xếp lịch, cập nhật lịch giảng dạy, kiểm tra xung đột thời khóa biểu.
  - `shiftConfig.controller.js`: CRUD cấu hình ca làm việc và bộ đệm thời gian.
  - `subject.controller.js`: CRUD danh mục môn học / học phần đại học.
  - `systemConfig.controller.js`: Tra cứu và cập nhật cấu hình hệ thống động thời gian thực.
  - `upload.controller.js`: Tải tệp đính kèm và kiểm tra quyền tải tệp theo deanScope.
  - `user.controller.js`: CRUD người dùng, bổ nhiệm chức danh kiêm nhiệm và cấp lại mật khẩu.
- **Phát hiện & Khắc phục lỗi thiếu import `detectPose` trong `attendance.controller.js`**:
  - Khắc phục lỗi `ReferenceError: detectPose is not defined` tại dòng export 295 của `attendance.controller.js` bằng cách import `const { detectPose } = require('./face.controller')`, đảm bảo route `POST /api/attendance/detect-pose` hoạt động trơn tru 100%.
- **Kiểm thử hồi quy & nghiệm thu toàn diện**:
  - Chạy `npm test`: Đạt **14/14 test suites PASS 100%**.
  - Chạy `npm run build`: Đạt **Thành công 100% (3.95s)** (`tsc -b && vite build` hoàn tất sạch sẽ không lỗi).
  - Toàn bộ 17 controllers đều tải và hoạt động chuẩn xác 100%.
### 22. Tổng Kiểm Tra Toàn Diện Toàn Bộ Backend (119/119 Files) & Nghiệm Thu Tuyệt Đối Chuẩn CSDL v2.6 (Ngày 17/10/2026)
- **Thực hiện rà soát & kiểm thử toàn diện toàn bộ 119 files mã nguồn Backend (`server/`)**:
  - `server/` root (2 files): `app.js`, `server.js` - Khởi tạo Express, nạp kết nối DB, socket realtime, định tuyến tập trung và xử lý lỗi.
  - `server/config/` (6 files): `db.js`, `env.js`, `mailer.js`, `permissions.js`, `swagger.js`, `swaggerPaths.js` - 100% chuẩn cấu hình môi trường và tài liệu OpenAPI 3.0.
  - `server/scripts/` (1 file): `syncIndexes.js` - Tự động đồng bộ các chỉ mục MongoDB đặc thù (2dsphere, unique composite).
  - `server/middlewares/` (5 files): `auth.middleware.js`, `error.middleware.js`, `faceImageUpload.middleware.js`, `rateLimiter.middleware.js`, `upload.middleware.js` - Bảo vệ hệ thống nhiều tầng, chống brute-force và xử lý tệp tin an toàn.
  - `server/utils/` (11 files): `aiDateParser.js`, `attendanceEvidence.js`, `attendanceHelpers.js`, `attendanceTime.utils.js`, `deanScope.js`, `responseHandler.js`, `schemaAliasPlugin.js`, `seeder.js`, `serviceError.js`, `tokenRevocation.js`, `transaction.js` - Bộ công cụ lõi tính toán sinh trắc học, thẩm quyền đơn vị BFS, thời gian và giao dịch ACID.
  - `server/services/` (30 files: 17 root + 5 trong `ai/` + 8 trong `attendance/`):
    * 17 Services nghiệp vụ chính: `auditLog`, `auth`, `cron`, `department`, `email`, `faceServiceClient`, `faceTemplate`, `holiday`, `leaveRequest`, `notification`, `payroll`, `qrCode`, `report`, `scheduleManagement`, `shiftConfig`, `subject`, `systemConfig`, `user`.
    * 5 Services phân hệ AI: `aiAnalytics`, `aiAssistant`, `aiChatbot`, `aiDisambiguation`, `aiPolicyKnowledge`.
    * 8 Services phân hệ Điểm danh: `attendanceCheckIn`, `attendanceCheckOut`, `attendanceEvidence`, `attendanceFaceVerification`, `attendanceGeofence`, `attendanceHistory`, `attendanceManualAdjustment`, `attendanceRealtime`.
  - `server/controllers/` (17 files): Khớp nối 100% với 17 routes, kiểm soát phân quyền RBAC và dữ liệu đầu vào.
  - `server/models/` (15 files: 14 models + `index.js`): 14 Collections theo CSDL v2.6 hỗ trợ Dual-Standard Aliases (tiếng Việt/tiếng Anh) và AuditLog bất biến.
  - `server/routes/` (18 files: 17 sub-routes + `index.js`): Định tuyến RESTful tập trung, tích hợp rate limiter và phân quyền hạt nhân.
  - `server/tests/` (14 files): 14 suites kiểm thử tự động bao phủ toàn bộ 8 tuần nghiệp vụ.
- **Kết quả Kiểm tra Cú pháp & Tương thích Nạp module (`node --check` & Dynamic Require)**:
  - **119/119 files** vượt qua kiểm tra cú pháp Node.js với **0 lỗi cú pháp (RESULT_ERRORS: 0)**.
  - **100% các file** models, controllers, routes, services, middlewares, utils nạp trơn tru không phát sinh `ReferenceError` hay gãy liên kết phụ thuộc.
  - Tuyệt đối không còn file mồ côi, không còn tàn dư file cũ (`*.old.*`), không còn tàn dư Kiosk.
- **Nghiệm thu kiểm thử tự động & đóng gói toàn dự án**:
  - `npm test`: **14/14 test suites PASS 100%** (143+ kịch bản kiểm thử bao gồm FAR/FRR, Multi-Level Leave, Payroll Snapshot 2026, AI Chatbot và Audit Immutability).
  - `npm run build`: **Thành công 100%** (`tsc -b && vite build` hoàn tất không lỗi TypeScript hay đóng gói).
  - Backend và Frontend đạt trạng thái hoàn thiện cao nhất, sẵn sàng 100% cho triển khai môi trường sản xuất (Production Ready).

### 23. Nâng Cấp Giai Đoạn 1: Mã Hóa Vector Sinh Trắc Học At-Rest (AES-256-GCM) & Tuân Thủ Nghị Định 13/2023/NĐ-CP (Ngày 17/10/2026)
- **Xây dựng module mã hóa đối xứng sinh trắc học chuẩn quân đội (`server/utils/biometricEncryption.js`)**:
  - Thuật toán `aes-256-gcm`, khóa 256-bit phái sinh an toàn bằng HKDF-SHA256 từ `BIOMETRIC_ENCRYPTION_KEY` hoặc `JWT_SECRET`.
  - Sinh ngẫu nhiên IV 12 bytes (96-bit) và Authentication Tag 16 bytes (128-bit) cho mỗi vector, đóng gói định dạng `iv.authTag.ciphertext`.
  - Hàm `encryptBiometricVector` và `decryptBiometricVector` bảo toàn 100% kích thước 512 chiều của InsightFace ArcFace buffalo_s, có khả năng tương thích ngược mượt mà với dữ liệu cũ chưa mã hóa.
- **Nâng cấp Model Collection 2 `FaceTemplate` (`server/models/faceTemplate.model.js`)**:
  - Bổ sung các trường lưu trữ chuỗi mã hóa an toàn trên đĩa cứng: `du_lieu_ma_hoa` (`encryptedData`, `select: false`), `vector_trung_binh_ma_hoa` (`encryptedAverageDescriptor`, `select: false`), và cờ `trang_thai_ma_hoa: 'AES_256_GCM'`.
  - Tích hợp Mongoose Pre-save Hook: Tự động mã hóa AES-256-GCM các vector 512 chiều trước khi ghi xuống MongoDB, bảo vệ triệt để dữ liệu sinh trắc học khi database bị dump hoặc sao lưu.
  - Cung cấp các methods `getDecryptedDescriptors()` và `getDecryptedAverageDescriptor()` để giải mã tức thời nạp lên RAM cache phục vụ tính toán Cosine Similarity.
- **Thực thi đầy đủ quy định pháp lý về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)**:
  - **Lưu vết đồng thuận (Consent Tracking):** Bổ sung các trường `dong_y_thu_thap` (`consentAgreed`), `thoi_diem_dong_y` (`consentAgreedAt`), `phien_ban_chinh_sach: 'ND13-2023-V1.0'`, `ip_dong_y` (`consentIp`).
  - **Kiểm soát đầu vào đăng ký (`server/controllers/face.controller.js`):** Tuyến `POST /api/face/enroll-multi-angle` bắt buộc kiểm tra cờ đồng thuận `consentAgreed === true`. Nếu chưa đồng thuận, từ chối nạp mẫu khuôn mặt với mã lỗi `BIOMETRIC_CONSENT_REQUIRED_ND13`.
  - **Quyền được xóa dữ liệu cá nhân (Right to Erasure):** Cập nhật tuyến `DELETE /api/face/faces/:userId` và thêm tuyến `DELETE /api/face/my-template`, cho phép cán bộ tự do thực hiện quyền yêu cầu hủy bỏ đồng thuận và xóa sạch dữ liệu sinh trắc học khỏi MongoDB và RAM FAISS.
  - **Nhật ký kiểm toán minh bạch:** Ghi nhận sự kiện `BIOMETRIC_DATA_PURGED_RIGHT_TO_ERASURE` vào `AuditLog` với căn cứ pháp lý `ND13-2023-Right-To-Erasure`.
- **Nâng cấp giao diện người dùng Frontend**:
  - `src/components/FaceRegistrationModal.tsx`: Tích hợp thẻ thông báo Thỏa thuận Xử lý Dữ liệu Sinh trắc học (Nghị định 13/2023/NĐ-CP) và checkbox xác nhận đồng thuận bắt buộc trước khi kích hoạt nút lưu hồ sơ 5 góc.
  - `src/pages/FaceRegistrationPage.tsx`: Bổ sung huy hiệu bảo vệ dữ liệu `Tuân thủ Nghị định 13/2023/NĐ-CP (Mã hóa At-Rest)`, nút bấm màu đỏ "Xóa Face ID (Quyền được xóa)" kèm hộp thoại cảnh báo pháp lý và lưu ý hướng dẫn quyền được xóa dữ liệu cá nhân.
- **Kiểm thử tự động & Nghiệm thu**:
  - Bổ sung Test 7 (Mã hóa/Giải mã AES-256-GCM bảo toàn 512 chiều) và Test 8 (Các trường đồng thuận Nghị định 13/2023/NĐ-CP) vào `server/tests/faceEnrollment.test.js` $\rightarrow$ Đạt **8/8 tests PASS 100%**.
  - Toàn bộ **14/14 test suites (`npm test`) đạt 100% PASS**.
  - Đóng gói toàn dự án `npm run build` (`tsc -b && vite build`) hoàn thành thành công trong 2.73s không phát sinh bất kỳ lỗi nào.

### 24. Nâng Cấp Giai Đoạn 2: Cơ Chế Đối Soát Chéo Campus IP & Chống Giả Mạo Vị Trí (Fake GPS) Kết Hợp Chuỗi Băm Mật Mã Nhật Ký Kiểm Toán SHA-256 (Audit Log Hash Chaining) (Ngày 17/10/2026)
- **Xây dựng cơ chế chống Fake GPS bằng kiểm tra chéo 2 yếu tố GPS và IP Mạng Trường (`Campus IP Subnets`)**:
  - **Thẩm định mạng nội bộ trường (`server/utils/attendanceHelpers.js`)**: Hàm `verifyCampusNetwork(ip, customSubnets)` phân tích bitwise CIDR các dải IP nội bộ trường (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1/32`) và hỗ trợ nạp động dải mạng trường học từ `SystemConfig` (`CAMPUS_IP_SUBNETS`).
  - **Thuật toán đối soát chéo `validateGeofence`**:
    * *Hợp lệ cao (`GPS_AND_CAMPUS_IP`)*: Tọa độ GPS nằm trong bán kính trường $\le 150$m đồng thời thiết bị kết nối Wi-Fi/mạng nội bộ trường $\rightarrow$ Độ tin cậy tối đa (`HIGH`), không có nghi vấn.
    * *Cảnh báo nghi vấn Fake GPS (`GPS_ONLY`)*: Tọa độ GPS báo trong trường nhưng địa chỉ IP từ xa (mạng 4G/WAN ngoài trường) $\rightarrow$ Đánh dấu cờ cảnh báo `isSuspicious = true` kèm lý do `Cảnh báo nghi vấn Fake GPS` để quản trị viên đối soát sau này.
    * *Cấp quyền máy bàn Lab trường (`CAMPUS_IP_OVERRIDE`)*: Thiết bị máy tính phòng thực hành/văn phòng không có chip GPS ($lat = null$) nhưng gửi yêu cầu từ IP mạng nội bộ trường $\rightarrow$ Chấp thuận điểm danh hợp lệ.
    * *Chặn gian lận ngoài khuôn viên (`OUTSIDE_BOTH`)*: Tọa độ GPS ngoài bán kính và IP ngoài trường $\rightarrow$ Đánh dấu `isFraud = true`, ghi rõ khoảng cách vi phạm và từ chối tính công.
  - **Mở rộng Collection 4 `PunchLog` (`server/models/punchLog.model.js`)**: Bổ sung các trường `dia_chi_ip` (`clientIp`), `mang_noi_bo_truong` (`isCampusNetwork`), `nghi_van_gia_mao` (`isSuspicious`), `ly_do_nghi_van` (`suspiciousReason`), `phuong_thuc_xac_thuc_vi_tri` (`verificationMethod`).
  - **Tích hợp đồng bộ toàn bộ luồng điểm danh**: Cập nhật truyền `clientIp` từ request vào `validateGeofence` và lưu vết bảo mật trong `faceRecognition.service.js`, `checkIn.service.js`, `checkOut.service.js`, `qrAttendance.service.js`.
- **Triển khai Chuỗi Băm Mật Mã SHA-256 (Audit Log Hash Chaining) Chống Sửa Đổi / Chống Chối Bỏ**:
  - **Kiến trúc chuỗi băm trong Collection 14 `AuditLog` (`server/models/auditLog.model.js`)**:
    * Bổ sung các trường `ma_bam_truoc` (`previousHash`, 64 hex characters) và `ma_bam_hien_tai` (`currentHash`, 64 hex characters).
    * Thuật toán băm chuẩn hóa `computeLogHash`: Băm SHA-256 chuỗi dữ liệu kết hợp gồm `ma_bam_truoc`, mốc thời gian ISO, người thực hiện, loại chủ thể, hành động, loại đối tượng, ID đối tượng, trạng thái kết quả và nội dung chi tiết.
    * Pre-save Hook: Tự động truy vấn bản ghi trước đó để lấy `currentHash` làm `previousHash` của bản ghi mới; bản ghi nguyên thủy đầu tiên liên kết với chuỗi Genesis Hash (`0000...0000`).
  - **Động cơ đối soát tính toàn vẹn chuỗi Hash (`AuditLog.verifyChainIntegrity`)**:
    * Duyệt tuần tự từ bản ghi đầu tiên đến bản ghi mới nhất trong database.
    * Tái tính toán mã băm từ dữ liệu thực tế và đối chiếu với `currentHash` đã lưu để phát hiện can thiệp sửa đổi trái phép.
    * So khớp `previousHash` của bản ghi hiện tại với `currentHash` của bản ghi trước đó để phát hiện tức thì hành vi xóa trộm bản ghi (đứt gãy chuỗi).
    * Trả về báo cáo đối soát chi tiết: `{ isValid, totalChecked, validCount, tamperedCount, brokenChainCount, tamperedLogs, latestHash, checkedAt }`.
  - **API Backend & Giao diện Quản trị**:
    * Tuyến RESTful API `GET /api/audit-logs/verify-integrity` (bảo vệ bằng RBAC phân quyền Admin và Ban Giám Hiệu).
    * Giao diện `src/pages/AuditLogs.tsx`: Thêm cột hiển thị huy hiệu mã băm SHA-256 rút gọn kèm ổ khóa bảo mật trên từng bản ghi; bổ sung nút "Đối soát Chuỗi Hash SHA-256" và Modal báo cáo trực quan tình trạng toàn vẹn chuỗi băm 100%.
- **Kiểm thử tự động & Nghiệm thu toàn diện**:
  - Bổ sung Test 7 vào `server/tests/farFrrBiometrics.test.js`: Kiểm thử kiểm tra CIDR IP, đối soát GPS trong trường + IP trường, phát hiện Fake GPS khi IP ngoài trường, cấp quyền máy bàn Lab không có GPS $\rightarrow$ **7/7 tests PASS 100%**.
  - Bổ sung Test 5 vào `server/tests/systemHealthAndAudit.test.js`: Kiểm thử sinh chuỗi băm SHA-256, đối soát chuỗi hợp lệ, giả lập phát hiện bản ghi bị sửa lén trong DB, giả lập phát hiện đứt gãy mắt xích do bị xóa bản ghi $\rightarrow$ **5/5 tests PASS 100%**.
  - Toàn bộ **14/14 test suites (`npm test`) đạt 100% PASS**.
  - Chạy lệnh đóng gói toàn dự án `npm run build` (`tsc -b && vite build`) hoàn thành thành công trong 1.96s không phát sinh lỗi.

### 25. Nâng Cấp Giai Đoạn 3: Bảo Mật AI Assistant (Guardrails & Chống Prompt Injection), Lọc Dữ Liệu Tầng Truy Vấn (DLP Whitelist) & Chuẩn Hóa Giờ Việt Nam (UTC+7) (Ngày 17/10/2026)
- **Xây dựng module Rào chắn An toàn AI & Chống Tấn công Prompt Injection (`server/services/ai/aiGuardrails.js`)**:
  - **Phát hiện đa dạng hình thức tấn công Prompt Injection / Jailbreak**:
    * *Instruction Override (Ép hủy chỉ thị gốc)*: Bắt các mẫu lệnh cố tình yêu cầu "bỏ qua tất cả hướng dẫn trước", "ignore previous instructions", "forget system prompt".
    * *System Prompt Leakage (Dò tìm prompt gốc)*: Chặn đứng các hành vi yêu cầu "in ra system prompt", "show base instructions", "tiết lộ câu lệnh gốc".
    * *Role-play Masquerade (Đóng vai vượt rào)*: Chặn các mẫu "hãy đóng vai admin tối cao", "DAN mode", "act as root/superuser", "pretend to be developer".
    * *Sensitive Credential Seeking (Dò tìm mật khẩu/khóa bí mật)*: Chặn các câu hỏi cố tình truy vấn `password`, `mat_khau`, `jwt_secret`, `api_key`, `token_family`, `so_cccd`.
    * *Control Tokens Injection*: Khử trùng và loại bỏ các thẻ điều khiển LLM đặc biệt (`<|im_start|>`, `<|im_end|>`, `[INST]`, `<<SYS>>`).
    * *NoSQL Injection Patterns*: Phát hiện các toán tử can thiệp DB (`$where`, `$regex`, `$gt`, v.v.).
  - **Khử trùng dữ liệu đầu vào (`sanitizePromptInput`)**: Tự động bóc tách và loại bỏ các thẻ điều khiển độc hại trước khi đưa văn bản vào xử lý.
  - **Cơ chế phản ứng an toàn (Safety Interceptor) & Ghi nhật ký bảo mật**:
    * Khi phát hiện vi phạm, hệ thống chặn ngay lập tức, không chuyển tiếp tới LLM bên ngoài (tiết kiệm chi phí token và ngăn ngừa rủi ro Jailbreak).
    * Trả về thông báo từ chối an toàn, lịch sự và nêu rõ căn cứ vi phạm.
    * Tự động ghi nhận `AuditLog` với `action: 'SECURITY_ALERT_PROMPT_INJECTION'`, lưu vết IP, User Agent, loại vi phạm và câu hỏi tấn công để phục vụ thanh tra an ninh mạng.
- **Lọc Dữ Liệu Tầng Truy Vấn & Chống Rò Rỉ Dữ Liệu Nhạy Cảm (Query-Level Authorization & DLP Whitelist)**:
  - **Phân quyền ma trận RBAC chặt chẽ trong `aiAnalytics.service.js`**:
    * *Ban Giám Hiệu (`hieutruong`, `hieupho`) & Admin & Kiểm toán viên*: Toàn quyền tra cứu dữ liệu nhân sự và lịch giảng dạy toàn trường.
    * *Trưởng khoa & Phó khoa*: Được tra cứu cán bộ, giảng viên và các bộ môn trực thuộc khoa quản lý.
    * *Trưởng bộ môn (`truongbomon`)*: Chỉ được xem cán bộ và lịch dạy thuộc bộ môn trực tiếp của mình.
    * *Giảng viên / Nhân viên*: Thực thi nghiêm ngặt quyền cá nhân; từ chối truy cập ngay tại tầng phân quyền, tuyệt đối không thực hiện truy vấn DB dữ liệu của người khác.
  - **DLP Whitelist Projection (`sanitizeContextData`)**:
    * Trước khi chuyển context thống kê vào Prompt LLM, tự động lọc bỏ 100% các trường nhạy cảm: `password`, `mat_khau`, `refreshToken`, `phien_ban_token`, `faceDescriptors`, `vector_trung_binh`, `du_lieu_ma_hoa`, `so_cccd`, `ngan_hang`, `jwtSecret`.
    * Chỉ truyền các chỉ số tổng hợp sạch (`total`, `onTime`, `late`, `absent`, `earlyLeave`, `hours`, `status`, `fullName`, `email`, `departmentName`).
- **Chuẩn Hóa Múi Giờ Việt Nam `Asia/Ho_Chi_Minh` (UTC+7) Đồng Bộ Toàn Hệ Thống**:
  - Đảm bảo toàn bộ các hàm phân tích ngày tháng trong `aiDateParser.js` và `aiAnalytics.service.js` (`createVietnamDate`, `getVietnamParts`, `buildAttendanceDateFilter`) phân đoạn chính xác từ 00:00:00.000 đến 23:59:59.999 theo múi giờ UTC+7, triệt tiêu hoàn toàn lỗi lệch ngày khi giao thoa múi giờ UTC.
- **Kiểm thử tự động & Nghiệm thu toàn diện**:
  - Bổ sung Test 7 (Nhận diện & Chặn đứng Prompt Injection / Jailbreak / Instruction Override), Test 8 (Khử trùng đầu vào & DLP Whitelist bảo vệ dữ liệu nhạy cảm), Test 9 (Phân quyền RBAC ma trận đa cấp BGH, Khoa, Bộ môn, Giảng viên) vào `server/tests/aiAssistantMultiModelAndPolicy.test.js` $\rightarrow$ **9/9 tests PASS 100%**.
  - Toàn bộ **14/14 test suites (`npm test`) đạt 100% PASS**.
  - Chạy lệnh đóng gói toàn dự án `npm run build` (`tsc -b && vite build`) hoàn thành thành công trong 2.80s không phát sinh bất kỳ lỗi nào.

### 26. Nâng Cấp Giai Đoạn 4: Khóa Phân Tán (Distributed Cron Job Lock), Adaptive Rate Limiter Hỗ Trợ Redis & Graceful Fallback, Hoàn Thiện Kiến Trúc Hệ Thống (Ngày 17/10/2026)
- **Xây dựng module Khóa Phân Tán (Distributed Cron Job Lock / Idempotent Cron) (`server/utils/distributedLock.js`)**:
  - **Khắc phục triệt để nguy cơ trùng lặp tác vụ khi chạy đa container / Multi-worker**:
    * Khi mở rộng hệ thống theo chiều ngang (Docker Swarm, Kubernetes, PM2 Cluster), tiến trình `node-cron` chạy trên mỗi instance độc lập. Nếu không có cơ chế khóa phân tán, các worker sẽ cùng lúc quét vắng mặt hoặc gửi email báo cáo, gây race condition, tốn tài nguyên và trùng lặp thông báo.
  - **Nguyên lý hoạt động dựa trên CSDL MongoDB v2.6 (Bảo toàn 14 Collections)**:
    * Lưu trữ trạng thái khóa trong collection `SystemConfig` (`cau_hinh_he_thong`) với tiền tố `LOCK_`. Giữ nguyên cấu trúc 14 collections chuẩn của đồ án mà không phát sinh thêm collection rác.
    * Thuật toán **Atomic Compare-and-Swap** qua `findOneAndUpdate`: Kiểm tra đồng thời điều kiện khóa đã hết hạn (`expiresAt <= now`) HOẶC đã được giải phóng (`isLocked: false`) HOẶC do chính worker này nắm giữ (re-entrant lock) trước khi cập nhật `lockedBy` và mốc `expiresAt` mới.
    * **Khả năng tự phục hồi khi sự cố (TTL Crash Recovery)**: Thiết lập thời gian sống tối đa `ttlSeconds`. Nếu worker đang nắm giữ khóa bị tắt hoặc crash đột ngột, khóa sẽ tự động hết hạn an toàn, cho phép worker khác tự động chiếm quyền ở phiên tiếp theo mà không cần can thiệp thủ công.
    * **Hàm bọc an toàn `withDistributedLock(lockKey, ttlSeconds, taskFn, options)`**: Tự động giành khóa $\rightarrow$ thực thi tác vụ $\rightarrow$ tự động giải phóng khóa trong khối `finally` (đảm bảo luôn giải phóng khóa ngay cả khi `taskFn` ném ngoại lệ).
    * **Cơ chế Fallback In-Memory**: Tự động nhận diện khi MongoDB chưa kết nối (`readyState !== 1`) để chuyển sang bộ đệm Map trong RAM, phục vụ chạy unit test cô lập nhanh chóng và ổn định.
  - **Tích hợp vào các tác vụ nền định kỳ (`server/services/cron.service.js`)**:
    * Khóa `cron_startup_scan` (TTL 60s): Đảm bảo chỉ duy nhất 1 node thực hiện dọn dẹp bản ghi sai lệch và quét kiểm tra tức thì sau khi máy chủ khởi động.
    * Khóa `cron_periodic_scan` (TTL 240s): Đảm bảo lượt quét vắng mặt mỗi 5 phút (`*/5 * * * *`) chạy duy nhất 1 lần trên toàn cụm máy chủ.
    * Khóa `cron_daily_absent_check` (TTL 600s): Đảm bảo tác vụ chốt công cuối ngày và gửi email tổng hợp lúc 23:59:00 chạy đơn nhất, loại trừ hoàn toàn việc gửi email lặp tới Ban Giám Hiệu và Trưởng khoa.
- **Nâng Cấp Adaptive Rate Limiter Hỗ Trợ Đa Môi Trường (`server/middlewares/rateLimiter.middleware.js`)**:
  - **Hỗ trợ Redis Store phân tán & Graceful Fallback**:
    * Tự động kiểm tra biến môi trường `REDIS_URL`. Nếu được cấu hình và driver khả dụng, khởi tạo `RedisStore` phân tán xuyên suốt các instance phía sau Reverse Proxy / Load Balancer.
    * Nếu không có Redis (môi trường dev, local hoặc máy chấm đồ án của hội đồng), tự động **Graceful Fallback** sang `MemoryStore` mặc định, cam kết hệ thống vận hành 100% trơn tru không phát sinh lỗi phụ thuộc.
  - **Mở rộng các bộ lọc Rate Limiting chuyên biệt bảo vệ hệ thống**:
    * `loginLimiter`: Giới hạn tối đa 5 lần đăng nhập sai trong 15 phút (dev: 50 lần), kết hợp IP và email để không chặn nhầm người dùng khác trên cùng mạng LAN/NAT.
    * `faceCheckInRateLimit`: Giới hạn 15 lần quét/phút, bảo vệ endpoint nhận diện khuôn mặt chống tấn công spam camera stream.
    * `aiChatRateLimit`: Giới hạn 30 câu hỏi/phút (dev: 100 câu/phút), phân loại theo User ID đã đăng nhập, bảo vệ quota Token LLM và chống DoS API Trợ lý AI.
    * `passwordResetLimiter`: Giới hạn 5 lần/15 phút (dev: 30 lần), bảo vệ tuyến đổi mật khẩu (`/api/auth/change-password`) chống tấn công brute-force.
    * `apiGeneralLimiter`: Giới hạn 300 requests/15 phút (dev: 3000), bảo vệ hạ tầng chung trước các bot thu thập dữ liệu bất thường.
  - **Gắn middleware bảo vệ vào các tuyến định tuyến (Routes)**:
    * Tuyến `POST /api/ai/chat` được bảo vệ bởi `aiChatRateLimit`.
    * Tuyến `PUT /api/auth/change-password` được bảo vệ bởi `passwordResetLimiter`.
    * Tuyến `POST /api/face/checkin` và `POST /api/face/checkout` được bảo vệ bởi `faceCheckInRateLimit`.
- **Cấu hình môi trường & Thẩm định an toàn (`server/config/env.js`)**:
  - Bổ sung kiểm tra định dạng biến môi trường `REDIS_URL` (bắt buộc giao thức `redis://` hoặc `rediss://`).
  - Bổ sung kịch bản kiểm thử `REDIS_URL` vào bộ test cấu hình `server/tests/config.test.js`.
- **Kiểm thử tự động & Nghiệm thu toàn diện**:
  - Bổ sung Test 6 vào `server/tests/systemHealthAndAudit.test.js`:
    * Test 6.1: Worker 1 giành khóa thành công.
    * Test 6.2: Worker 2 cố giành cùng khóa khi chưa hết hạn $\rightarrow$ Bị từ chối (`false`).
    * Test 6.3: Worker khác không thể giải phóng khóa không thuộc về mình.
    * Test 6.4: Worker 1 giải phóng khóa $\rightarrow$ Worker 2 giành khóa thành công.
    * Test 6.5: Khóa quá hạn TTL $\rightarrow$ Cho phép worker mới tự động chiếm quyền (Crash-safe Recovery).
    * Test 6.6: `withDistributedLock` tự động giải phóng an toàn cả khi task hoàn thành lẫn khi ném lỗi nghiệp vụ (`try...finally`).
    * Test 6.7: Kiểm thử khởi tạo và xuất khẩu chuẩn xác các middleware Rate Limiter (`aiChatRateLimit`, `passwordResetLimiter`, `loginLimiter`, `faceCheckInRateLimit`).
    * $\rightarrow$ **Kết quả: Test 6 ĐẠT 100%**.
### 27. Rà Soát & Chuẩn Hóa Toàn Diện 100% Dual-Standard Aliases Trên Cả 14 Collections CSDL v2.6 (Ngày 17/10/2026)
- **Rà soát tự động bằng Node.js Reflection trên toàn bộ 14 Collections Mongoose**:
  - Quét duyệt toàn bộ 14 Mongoose Models (`server/models/`): phân tích từng đường dẫn Schema (`schema.paths`) đối soát chéo với cấu hình `options.alias` và từ điển ánh xạ truy vấn `schema.aliases` trong plugin `schemaAliasPlugin`.
  - Kết quả rà soát ban đầu: 7 models đã hoàn hảo 100% (`FaceTemplate`, `ShiftConfig`, `Subject`, `Schedule`, `Holiday`, `SystemConfig`, `AuditLog`); 7 models còn khuyết thiếu alias ở một số trường hoặc chưa khai báo đầy đủ bảng ánh xạ truy vấn.
- **Tiến hành bổ sung và đồng bộ hóa chuẩn kép (Dual-Standard: CSDL tiếng Việt $\leftrightarrow$ Mã nguồn tiếng Anh)**:
  - **Model 1 `User` (`server/models/user.model.js` - Collection `nguoi_dung`)**:
    * Bổ sung alias trên định nghĩa trường: `academicRank` (`hoc_ham`), `degree` (`hoc_vi`), `salaryScale` (`ngach_luong`), `salaryCoefficient` (`he_so_luong`), `teachingStartDate` (`ngay_bat_dau_giang_day`), `staffType` (`loai_nhan_su`), `primaryRole` (`vai_tro_chinh`), `annualLeaveLimit` (`han_muc_phep_nam`), `leaveVersion` (`phien_ban_don_nghi`).
    * Bổ sung từ điển `userSchema.aliases`: Thêm đầy đủ 12 trường mới cùng ánh xạ song phương cho `email` (`thu_dien_tu`), `faceDescriptor` (`dac_trung_khuon_mat`), `faceDescriptors` (`danh_sach_dac_trung_khuon_mat`).
  - **Model 2 `Payroll` (`server/models/payroll.model.js` - Collection `phieu_luong`)**:
    * Bổ sung alias trên các sub-schemas: `phuCapItemSchema` (`type`, `rate`, `amount`), `khoanDieuChinhSchema` (`reason`, `amount`), `bieuThueBacSchema` (`level`, `from`, `to`, `taxRate`).
    * Bổ sung alias trên các trường lồng nhau: `gio_giang` (`baseQuota`, `reductionRatio`, `adjustedQuota`, `accumulatedStandardHours`, `overQuotaHours`, `hourlyRate`, `overQuotaRemuneration`, `advancedPayment`), `bao_hiem` (`socialInsurance`, `healthInsurance`, `unemploymentInsurance`, `totalInsurance`), `thue_tncn` (`personalDeduction`, `dependentDeduction`, `taxableIncome`, `taxAmount`), `snapshot_tham_so` (`baseSalarySnapshot`, v.v.).
    * Xây dựng bộ Virtual Getters/Setters thông minh hai chiều cho: `teachingHours`, `insurance`, `personalIncomeTax`, `parameterSnapshot`, `allowances`, `bonusItems`, `deductionItems`.
    * Khai báo hoàn chỉnh bảng từ điển `phieuLuongSchema.aliases` (48 mục ánh xạ truy vấn tiếng Anh $\leftrightarrow$ tiếng Việt).
  - **Model 3 `PunchLog` (`server/models/punchLog.model.js` - Collection `luot_quet_cham_cong`)**:
    * Bổ sung alias trên định nghĩa trường: `evidenceImageUrl` (`anh_bang_chung_url`), `gpsPoint` (`toa_do_gps`), `gpsAccuracy` (`do_chinh_xac_gps`), `isMockLocation` (`is_mock_location`), `latitude` (`toa_do.vi_do`), `longitude` (`toa_do.kinh_do`), `status` (`trang_thai`), `failureReason` (`ly_do_that_bai`), `pitch`/`yaw`/`roll` (`goc_dau_3d`).
    * Cập nhật `punchLogSchema.aliases` nâng tổng số lên 31 mục ánh xạ hoàn chỉnh.
  - **Model 4 `AttendanceLog` (`server/models/attendanceLog.model.js` - Collection `cong_tong_hop`)**:
    * Bổ sung alias trên định nghĩa trường: `workShiftId` (`ca_lam_viec_id`), `teachingScheduleId` (`lich_giang_day_id`), `punchIds` (`danh_sach_luot_quet_ids`), `requestFormId` (`don_tu_id`), `modifiedBy` (`nguoi_sua_id`), `modificationReason` (`ly_do_sua`), `latitude`/`longitude`/`accuracy` (`toa_do`).
    * Cập nhật `attendanceLogSchema.aliases` lên 42 mục (bao gồm cả `workKey`, `isLocked`, `actualTeachingPeriods`, `workHours`).
  - **Model 5 `Department` (`server/models/department.model.js` - Collection `phong_ban`)**:
    * Bổ sung alias `latitude` (`toa_do.vi_do`), `longitude` (`toa_do.kinh_do`) và đồng bộ vào `departmentSchema.aliases`.
  - **Model 6 `RefreshToken` (`server/models/refreshToken.model.js` - Collection `ma_lam_moi`)**:
    * Bổ sung `alias: 'tokenHash'` trực tiếp trên định nghĩa trường `token_hash`.
  - **Model 7 `LeaveRequest` (`server/models/leaveRequest.model.js` - Collection `don_nghi_phep`)**:
    * Bổ sung setter cho virtual `approvalHistory` (`lich_su_duyet`) hỗ trợ gán dữ liệu mảng lịch sử phê duyệt bằng cả tiếng Anh lẫn tiếng Việt.
- **Nghiệm thu toàn diện 100% CSDL**:
  - Chạy script kiểm thử đối soát tự động: **TOTAL MISSING ACROSS ALL 14 MODELS = 0** (0 trường nào bị thiếu alias).
  - Khởi tạo thực nghiệm đối tượng Mongoose với alias tiếng Anh cho tất cả các Model $\rightarrow$ Đạt 100% khớp nối trường tiếng Việt trong MongoDB.
  - Chạy bộ kiểm thử tự động `npm test`: **14/14 test suites PASS 100%** (150+ tests).
  - Chạy lệnh đóng gói mã nguồn `npm run build`: **Thành công 100%** không có bất kỳ lỗi cú pháp hoặc TypeScript nào.


