# NHẬT KÝ TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN TỐT NGHIỆP
**Hệ Thống Quản Lý Nhân Sự & Chấm Công Ứng Dụng Thị Giác Máy Tính (Face Recognition)**  
**Sinh viên thực hiện:** Vũ Tiến Đức - MSV: 2310900023  
**Bản đặc tả kiến trúc tham chiếu:** `THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md` (Phiên bản chốt v2.6)

---

## 📅 NGÀY 15/10/2026: HOÀN THIỆN CƠ SỞ DỮ LIỆU 14 COLLECTIONS & BẢO MẬT AUTH RBAC (TUẦN 1)

### 1. Rà soát & Chuẩn hóa CSDL 14 Collections Mongoose (Dual-Standard)
- Bổ sung Model `Payroll` (Collection 11), chuyển cơ chế thu hồi token sang In-Memory kết hợp `phien_ban_token` và đồng bộ barrel export 14 collections theo chuẩn song ngữ Anh - Việt.

### 2. Đồng bộ Chỉ mục MongoDB thật (syncIndexes.js)
- Viết và thực thi thành công script `server/scripts/syncIndexes.js` đồng bộ 100% các chỉ mục unique, compound, sparse và geospatial 2dsphere trên toàn bộ 14 collections thật.

### 3. Nạp 19 Tham Số Cấu Hình Hệ Thống Động (seeder.js)
- Khởi tạo và nạp thành công 19 tham số cấu hình hệ thống động (`SystemConfig`) cùng bản ghi mẫu bảng lương (`Payroll`) phục vụ vận hành nghiệp vụ đại học.

### 4. Hạt Nhân Phân Quyền RBAC & Token Rotation Grace Period 15s (Chuẩn Hóa Sạch 100% Mã Nguồn)
- Hoàn thiện luồng đăng nhập xác thực, cơ chế xoay vòng Refresh Token có bộ đệm Grace Period 15s chống Replay Attack, phân quyền ma trận 10 vai trò RBAC và xóa bỏ 5 file mã nguồn cũ.

---

## 📅 NGÀY 16/10/2026: THỊ GIÁC MÁY TÍNH FACE AI, ĐĂNG KÝ 5 GÓC, CHỐNG XUNG ĐỘT TKB & CAMERA REALTIME (TUẦN 2 ĐẾN TUẦN 8)

### 5. Chuẩn Hóa Sinh Trắc Học FaceTemplate & Microservice Python (Tuần 2)
- Xây dựng model `FaceTemplate` lưu trữ vector 512 chiều InsightFace buffalo_s, thuật toán trọng tâm L2, chống trùng lặp khuôn mặt (409 Conflict), đồng bộ RAM FAISS và dọn sạch 2 file cũ.

### 6. Thuật Toán Margin Top 1 - Top 2 & Cooldown Chống Quét Lặp 60s (Tuần 3)
- Triển khai bộ lọc Margin Top 1 - Top 2 $\ge 0.05$ trong Python Microservice chặn nhận diện mơ hồ và cơ chế Cooldown 60s ngăn chặn quẹt thẻ spam liên tiếp.

### 7. Thời Khóa Biểu Học Kỳ, Chống Xung Đột Lịch & Hoàn Thiện Camera Điểm Danh Realtime (Tuần 4)
- Nâng cấp model `Schedule` theo học kỳ, thuật toán chống xung đột lịch dạy 2 chiều (giảng viên & phòng học), tích hợp modal camera điểm danh thời gian thực và dọn sạch 2 file cũ.

### 8. Quy Trình Đối Chiếu File Cũ old_* & Hoàn Tất Xóa Bỏ Khỏi Ổ Đĩa
- Hoàn tất xóa bỏ sạch sẽ toàn bộ 22 file mã nguồn cũ (`old_*`) khỏi ổ đĩa theo đúng quy định Workspace Guidelines, đưa codebase đạt trạng thái thuần khiết 100% CSDL v2.5.

### 9. Hoàn Thiện Dữ Liệu Mẫu Đại Học & UI Đăng Ký Khuôn Mặt 5 Góc (Bước 1 & Bước 2)
- Nạp 13 tài khoản demo đại học kèm 19 tham số cấu hình, nâng cấp FastAPI trích xuất góc quay đầu 3D Euler và xây dựng giao diện đăng ký 5 góc chụp có hold-detection.

### 10. Động Cơ Nhận Diện 1:N RAM, Geofence GPS Haversine, Chống Quét Lặp 60s & Thực Nghiệm FAR/FRR (Tuần 3)
- Viết mới 5 service điểm danh 2 tầng (`PunchLog` & `AttendanceLog`), xác thực Geofence Haversine (150m trường / 30m phòng), cơ chế tự phục hồi RAM FAISS và đo đạc thực nghiệm đạt FAR = 0.00%, FRR = 0.00%.

### 11. Module Đơn Từ Nhiều Cấp (Khoa -> BGH), Chặn Tự Duyệt Đơn, Optimistic Locking & Hồi Tố Hoàn Tác Công (Tuần 5)
- Triển khai quy trình phê duyệt đơn 1-2 cấp tự động, chặn tự duyệt đơn (403 Forbidden), khóa lạc quan chống race condition (409 Conflict) và tự động hồi tố/hoàn tác dữ liệu công.

### 12. Bảng Lương Snapshot Năm 2026 (Payroll - Collection 11), Khóa Lương (isLocked), Tính Thuế TNCN Lũy Tiến 5 Bậc & Xuất Báo Cáo Excel/PDF (Tuần 6)
- Hoàn thiện tính lương đại học snapshot 2026, thuế TNCN 5 bậc, cơ chế khóa sổ lương (`isLocked` / `DA_KHOA`) đồng bộ khóa chấm công và xuất báo cáo bảng lương Excel/PDF.

### 13. AI Trợ Lý Chatbot (Gemini / Claude / Deepseek / Local LLM) Hỗ Trợ Tra Cứu Công & Giải Đáp Quy Chế Nhà Trường (Tuần 7)
- Tích hợp router đa mô hình LLM kèm bộ tri thức quy chế đại học 2026 cục bộ, phân tích câu hỏi tiếng Việt NLU, làm rõ danh tính trùng tên và kiểm soát phân quyền tra cứu công/lương.

### 14. Tổng Kiểm Tra Hệ Thống, Audit Log, Swagger OpenAPI 3.0 & Triển Khai Docker Container Hóa Toàn Diện (Tuần 8)
- Thiết lập tính bất biến (Append-Only) cho `AuditLog`, hoàn thiện tài liệu Swagger OpenAPI 3.0 cho 14 nhóm chức năng và đóng gói hệ thống bằng Docker Compose 3 dịch vụ (Web, Face-AI, Mongo RS).

### 15. Chuẩn Hóa Báo Cáo Theo RBAC v2.5, Dọn Dẹp File Cũ & Xây Dựng 3 Trang Frontend Còn Thiếu
- Nâng cấp `deanScope` và `report.service` theo ma trận phân quyền hạt nhân v2.5, đồng thời xây dựng hoàn chỉnh 3 trang giao diện `Payroll.tsx`, `AIChat.tsx` và `Holidays.tsx`.

### 16. Rà Soát Toàn Diện Backend, Dọn Dẹp File Thừa & Mã Nguồn Không Sử Dụng
- Xóa bỏ vĩnh viễn các file thừa `campus_config.json`, `aiAssistant.test.js` cùng mã nguồn xử lý OTP dư thừa, xác nhận 119/119 file backend hoạt động tích cực 100%.

---

## 📅 NGÀY 17/10/2026: ĐỒNG BỘ CSDL DANH MỤC, CRON IDEMPOTENT, MA TRẬN 17 TRANG & CÁC NÂNG CẤP BẢO MẬT GIAI ĐOẠN 1-4

### 17. Chi Tiết Các Module Danh Mục Nghiệp Vụ Cốt Lõi (Collections 7, 8, 9)
- Chuẩn hóa 3 module danh mục cốt lõi: Đơn vị/Khoa/Bộ môn (`Department`), Cấu hình ca làm việc & time buffers (`ShiftConfig`), và Danh mục môn học/học phần đào tạo (`Subject`).

### 18. Dịch Vụ Nền Cron Service Chốt Công Tự Động, Xử Lý Quên Quẹt Ra & Cơ Chế Catch-Up Idempotent (cron.service.js)
- Triển khai Cron quét vắng mặt tự động, xử lý quên quẹt ra, cơ chế Idempotent qua khóa tự nhiên unique (`YYYY-MM-DD_userId`), tự động bỏ qua ngày lễ và quét bù ca khi khởi động lại máy chủ.

### 19. Bức Tranh Toàn Cảnh 17 Trang Giao Diện Frontend (React + TypeScript + TailwindCSS + Vite)
- Thiết kế và hoàn thiện cấu trúc bản đồ 17 trang giao diện người dùng bao phủ toàn diện toàn bộ quy trình nghiệp vụ đào tạo và quản lý nhân sự đại học.

### 20. Chuẩn Hóa & Nâng Cấp Toàn Diện Bản Đặc Tả Kiến Trúc THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md Lên v2.6
- Khắc phục lỗi byte UTF-8, dọn sạch văn bản chắp nối rác, bổ sung tính bất biến cho `AuditLog` và cập nhật đầy đủ 5 quy trình nghiệp vụ mới cùng danh mục 14 test suites tự động.

### 21. Đồng Bộ Hóa Toàn Diện README.md Chuẩn Kiến Trúc v2.6 & Nghiệm Thu Hồi Quy
- Cập nhật `README.md` đồng bộ 14 Collections v2.6, 17 trang UI, hướng dẫn Docker Compose, bảng 14 test suites và dọn sạch 100% thuật ngữ "Kiosk" cũ sang Camera Web SPA.

### 22. Rà Soát Bộ Cấu Hình (server/config) & Tinh Chỉnh Import Thừa Tại Middleware Phân Quyền
- Thẩm định toàn diện 6 file cấu hình backend và loại bỏ import biến không tồn tại `ALL_PERMISSIONS` trong `auth.middleware.js`.

### 23. Kiểm Tra Toàn Diện Bộ Middleware (server/middlewares) & Khôi Phục Bộ Giới Hạn Đăng Nhập (loginLimiter)
- Khôi phục định nghĩa `loginLimiter` (5 lần/15 phút) trong `rateLimiter.middleware.js`, giải quyết triệt để lỗi ReferenceError khi nạp `auth.routes.js`.

### 24. Kiểm Tra Toàn Diện Bộ Tiện Ích (server/utils) & Bổ Sung Đồng Bộ Chỉ Mục PunchLog trong Seeder
- Rà soát 11 tiện ích và bổ sung `PunchLog` vào tiến trình `Promise.all(syncIndexes())` trong `seeder.js`, đảm bảo đủ 100% 14 collections được đồng bộ chỉ mục khi seed.

### 25. Kiểm Tra Toàn Diện Bộ Điều Khiển (server/controllers) & Khắc Phục Lỗi Export detectPose Trong attendance.controller.js
- Khắc phục lỗi thiếu import `detectPose` tại `attendance.controller.js`, đảm bảo tuyến `POST /api/attendance/detect-pose` vận hành ổn định 100%.

### 26. Tổng Kiểm Tra Toàn Diện Toàn Bộ Backend (119/119 Files) & Nghiệm Thu Tuyệt Đối Chuẩn CSDL v2.6
- Quét kiểm tra cú pháp và dynamic require toàn bộ 119 files backend: 0 lỗi cú pháp, 14/14 test suites PASS 100%, lệnh đóng gói `npm run build` thành công 100%.

### 27. Nâng Cấp Giai Đoạn 1: Mã Hóa Vector Sinh Trắc Học At-Rest (AES-256-GCM) & Tuân Thủ Nghị Định 13/2023/NĐ-CP
- Tích hợp mã hóa AES-256-GCM at-rest cho vector 512D, theo dõi điều khoản đồng thuận thu thập sinh trắc học và cung cấp quyền được xóa dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.

### 28. Nâng Cấp Giai Đoạn 2: Cơ Chế Đối Soát Chéo Campus IP & Chống Giả Mạo Vị Trí (Fake GPS) Kết Hợp Chuỗi Băm Mật Mã SHA-256 (Audit Log Hash Chaining)
- Xây dựng đối soát chéo tọa độ GPS với dải IP mạng nội bộ trường chống Fake GPS, đồng thời triển khai chuỗi băm mật mã SHA-256 liên kết (Hash Chaining) chống sửa xóa nhật ký kiểm toán.

### 29. Nâng Cấp Giai Đoạn 3: Bảo Mật AI Assistant (Guardrails & Chống Prompt Injection), Lọc Dữ Liệu Tầng Truy Vấn (DLP Whitelist) & Chuẩn Hóa Giờ Việt Nam (UTC+7)
- Xây dựng rào chắn AI Guardrails chặn đứng Prompt Injection/Jailbreak, DLP Whitelist lọc sạch dữ liệu nhạy cảm tầng truy vấn và đồng bộ múi giờ UTC+7 toàn hệ thống.

### 30. Nâng Cấp Giai Đoạn 4: Khóa Phân Tán (Distributed Cron Job Lock), Adaptive Rate Limiter Hỗ Trợ Redis & Graceful Fallback
- Xây dựng khóa phân tán Idempotent Atomic CAS qua MongoDB chống chạy trùng cron khi mở rộng đa container và Adaptive Rate Limiter hỗ trợ Redis kèm fallback In-Memory an toàn.

### 31. Rà Soát & Chuẩn Hóa Toàn Diện 100% Dual-Standard Aliases Trên Cả 14 Collections CSDL v2.6
- Bổ sung đầy đủ thuộc tính và từ điển ánh xạ truy vấn song ngữ Anh - Việt cho cả 14 Mongoose models, đạt 0 trường thiếu sót trên toàn bộ cơ sở dữ liệu.

### 32. Khắc Phục Lỗi Seeder & Khởi Tạo Thành Công 100% Dữ Liệu Mẫu Lên MongoDB Atlas
- Khắc phục lỗi TDZ PunchLog, enum vai_tro_chinh, pre-save hook đồng bộ FaceTemplate và enum SystemConfig, nạp thành công 14 collections mẫu lên MongoDB Atlas.

### 33. Tinh Gọn CSDL: Dọn Dẹp Toàn Diện Các Trường Thừa, Trùng Lặp Trên Toàn Bộ 14 Models & Cơ Sở Dữ Liệu
- Xóa bỏ hoàn toàn 8 trường thừa vật lý trong MongoDB (`ca_lam_viec_id`, `don_nghi_id`, `anh_bang_chung_url`, `ma_thiet_bi`, `so_cccd` thô, `hoc_ham_hoc_vi`, `token_hash`), thay bằng virtuals/aliases.

### 34. Chuẩn Hóa Đồng Bộ Toàn Bộ 14 Models: Quy Ước Khóa Ngoại Tham Chiếu *_id, CSDL Tiếng Việt Chuẩn & Alias Tiếng Anh Sạch 1-đối-1
- Quy chuẩn 100% khóa ngoại tham chiếu sang đuôi `*_id`, chuẩn hóa enum trạng thái chấm công quốc tế (`ON_TIME`, `LATE`...) và phương thức quét chữ hoa thống nhất.

### 35. Đồng Bộ Toàn Diện Tầng Backend (Services, Controllers, Utils, Tests) Khớp 100% Với Model Chuẩn v2.5 & Enum Phương Án A
- Cập nhật toàn bộ services, controllers, utils và tests sang các trường khóa ngoại `*_id` và enum chuẩn, loại bỏ triệt để các tham chiếu mã cũ.

### 36. Rà Soát Chuyên Sâu, Loại Bỏ Triệt Để Dữ Liệu Thừa, Sai & Chuẩn Hóa Toàn Diện Backend
- Loại bỏ các trường thừa `phuong_thuc_vao`/`ra`, đồng bộ enum `loai_quet` (`CHECK_IN`/`CHECK_OUT`) và chuẩn hóa phân quyền vai trò/đơn vị theo `don_vi_chinh_id`.

### 37. Nâng Cấp Kiến Trúc Bộ Nhớ Đệm Phân Tán (Redis Distributed Cache & Redlock) Với Cơ Chế Hybrid Fallback Zero-Downtime
- Triển khai Redis Redlock phân tán cho khóa công việc, Grace Period RTR 15s, Cooldown quẹt thẻ 60s và cache vector 512D với fallback In-Memory an toàn.

### 38. Chuyển Đổi Hệ Thống Lưu Trữ Tệp Minh Chứng Sang Object Storage (MinIO S3-Compatible) Kèm Signed URL Bảo Mật & Local Fallback
- Thay thế lưu trữ đĩa cục bộ bằng MinIO Object Storage cho ảnh minh chứng, đơn từ và ảnh Face ID, hỗ trợ Signed URL 15 phút và Local Storage Fallback.

### 39. Xây Dựng Hàng Đợi Điểm Danh Giờ Cao Điểm (BullMQ Trên Nền Redis) Với Cơ Chế Fast Ingestion & Worker Pipeline
- Tích hợp BullMQ trên Redis với cơ chế Fast Ingestion phản hồi Web SPA < 50ms và đội ngũ Worker ngầm đa luồng xử lý đối soát ca, GPS và AuditLog.

### 40. Xây Dựng Kiến Trúc Truyền Thông Thời Gian Thực Realtime WebSockets (Socket.IO) Cho Admin Dashboard & Giao Diện Giám Sát
- Tích hợp Socket.IO xác thực JWT phát sự kiện điểm danh, cảnh báo Fake GPS và cập nhật KPI tức thì (< 10ms) về Dashboard không cần tải lại trang.

### 41. Chuẩn Hóa Triệt Để 100% Thuộc Tính Tiếng Anh (English CamelCase) Cho Toàn Bộ Các Tầng Mã Nguồn Ngoài Models
- Chuẩn hóa 100% mã nguồn ngoài Models (Services, Controllers, Queues, Middlewares, Frontend) sang thuộc tính tiếng Anh camelCase chuẩn công nghiệp (0 trường tiếng Việt sót lại).

---

## 📅 NGÀY 18/10/2026: QUY TRÌNH QUÊN MẬT KHẨU OTP, CHUẨN HÓA THUẦN VIỆT CSDL & CLEAN CODE SINGLE SOURCE OF TRUTH

### 42. Hiện Thực Hóa Quy Trình Quên Mật Khẩu Chuẩn Qua Email OTP & Kích Hoạt 100% Cả 5 Trường OTP Của Schema nguoi_dung
- Xây dựng hoàn chỉnh luồng quên mật khẩu qua Email OTP 6 số (SHA-256, hạn 10 phút, chống brute-force 5 lần, cooldown 60s) và Modal thao tác 2 bước trên Frontend.

### 43. Chuẩn Hóa Thuần Việt 100% CSDL v2.5: Chuyển Đổi is_mock_location -> vi_tri_gia_lap Và user_agent -> thong_tin_trinh_duyet
- Đổi tên 2 trường vật lý trong DB sang tiếng Việt thuần túy `vi_tri_gia_lap` (`PunchLog`) và `thong_tin_trinh_duyet` (`AuditLog`), đồng bộ tài liệu và test suite.

### 44. Tinh Gọn Mã Nguồn Clean Code: Loại Bỏ Từ Đồng Nghĩa Thừa & Chuẩn Hóa 1 Tên Tiếng Anh Duy Nhất (Single Source of Truth) Cho Các Model CSDL v2.5
- Xóa bỏ toàn bộ từ đồng nghĩa và virtual getters thừa trong 14 models, thiết lập đúng 1 alias tiếng Anh chuẩn duy nhất cho mỗi trường CSDL (0 duplicate aliases).

### 45. Chuẩn Hóa Tên Collection Vật Lý Từ cong_tong_hop Sang nhat_ky_cham_cong
- Đổi tên collection Mongoose và MongoDB từ `cong_tong_hop` sang `nhat_ky_cham_cong`, đồng bộ syncIndexes, tài liệu thiết kế và các luồng kiểm thử.

### 46. Chuẩn Hóa Tên Collection Vật Lý Từ cau_hinh_ca Sang ca_lam_viec
- Đổi tên collection từ `cau_hinh_ca` sang `ca_lam_viec` khớp đúng 100% bản chất nghiệp vụ ca làm việc và tên khóa ngoại `ca_id` trên toàn hệ thống.

### 47. Cập Nhật & Bổ Sung Toàn Diện Tài Liệu Swagger OpenAPI 3.0 Phục Vụ Kiểm Thử Từng Phân Hệ
- Chuẩn hóa endpoint `/health`, bổ sung schemas `Holiday`, `PunchLog` và tags `Subjects`, `Holidays` nâng tổng số lên 73 endpoints RESTful trên Swagger UI.

---

## 📅 NGÀY 19/10/2026: TÁI CẤU TRÚC SWAGGER UI 17 TAGS, FIX LỖI API CHẤM CÔNG, NỀN TẢNG THIẾT KẾ SRC & TRẠM ĐIỂM DANH AI REALTIME

### 48. Tái Cấu Trúc Toàn Diện Swagger UI OpenAPI 3.0 & Đồng Bộ Tuyến Đường Kiểm Thử
- Cấu trúc lại 17 Tags Swagger theo trình tự kiểm thử thực tế, chuẩn hóa routes Payroll (khóa/mở khóa/xuất PDF) và bật `persistAuthorization: true` lưu token trên trình duyệt.

### 49. Khắc Phục Triệt Để Lỗi Đăng Nhập 401 & Loại Bỏ Tuyến GET /login Thừa Trên Swagger UI
- Xóa route `GET /login` thừa, đồng bộ email demo `admin@university.edu.vn` và bổ sung alias `tokenHash`/`tokenFamily` cho RefreshToken giải quyết dứt điểm lỗi 401.

### 50. Khắc Phục Triệt Để 3 Lỗi Nghiệp Vụ Trên Swagger: Check-in, Đơn Nghỉ Phép & Nhật Ký Kiểm Toán
- Bỏ bắt buộc `cham_cong_id` trong PunchLog khi check-in, xử lý fallback retryable writes standalone cho đơn phép và sửa virtual populate `actor` cho AuditLog.

### 51. Rà Soát & Tinh Gọn Schema Aliases, Loại Bỏ Thuộc Tính Trùng Lặp Trong FaceTemplate & Seeder
- Tinh gọn `seeder.js` chỉ truyền 1 bộ alias chuẩn của FaceTemplate và dọn dẹp các alias rác trong model.

### 52. Thiết Lập Hệ Thống Thiết Kế (Design System & Theme) Mới Trong Thư Mục src
- Xây dựng nền tảng Frontend trong thư mục `src`: Dark/Light theme, Tailwind tokens, Zustand stores, atomic UI components (Button, Badge, Card) và Layout shell (Sidebar, Navbar, Footer).

### 53. Hoàn Thiện Trang Đăng Nhập (Login Page) & Kết Nối Toàn Diện API Auth RBAC, Axios Interceptor Tự Động Xoay Vòng Refresh Token
- Xây dựng trang Login split-screen glassmorphism, 1-click demo accounts, Axios interceptor tự động refresh token khi gặp 401 và ProtectedRoute phân quyền RBAC.

### 54. Chuẩn Hóa Duy Nhất Nguồn Dữ Liệu Từ MongoDB: Loại Bỏ Hoàn Toàn Bảng Ánh Xạ Phụ, Đồng Bộ 100% Thông Tin Cán Bộ Giảng Viên
- Xóa bỏ bảng ánh xạ `emailAliases`, đồng bộ 100% danh sách tài khoản demo trên trang Login với dữ liệu thực tế trong collection `nguoi_dung`.

### 55. Xây Dựng Hoàn Chỉnh Giao Diện Trạm Điểm Danh Sinh Trắc Học AI (InsightFace 512D) Đa Góc Chụp, HUD Realtime 60 FPS & Tích Hợp API Chấm Công Toàn Diện
- Xây dựng trang `FaceAttendance.tsx`, BiometricHUDCanvas radar quét laser 60 FPS, Web Audio chime phản hồi và AttendanceResultModal hiển thị đối sánh ảnh chân dung.

### 56. Tinh Gọn Giao Diện Điểm Danh AI (Basic UI), Khắc Phục Triệt Để Hiện Tượng Delay Khung Hình, Bổ Sung Tự Động Quét & Nút Tắt Camera Rõ Ràng
- Tối ưu khung camera gọn gàng `max-w-[440px]`, nạp 36 vector lên RAM FAISS khi khởi động, bổ sung chế độ tự động quét mỗi 2s và nút tắt camera phần cứng tức thì.

### 57. Khắc Phục Triệt Để Lỗi 404 & 429 Khi Quét Điểm Danh Face ID, Tinh Chỉnh Rate Limiter & Bổ Sung Nút Đăng Ký Khuôn Mặt Nhanh
- Chuyển kết quả chưa khớp từ mã lỗi 404 sang HTTP 200 `matched: false`, nới lỏng rate limit môi trường dev lên 200 req/phút và thêm nút đăng ký nhanh cho cán bộ.

### 58. Bổ Sung Phản Hồi Trạng Thái Trực Quan Toàn Diện Khi Tự Động Quét Điểm Danh AI
- Bổ sung Live Feedback Card hiển thị rõ ràng 4 trạng thái quét (idle, scanning, success, error) cùng toast thông minh và âm thanh cảnh báo trực quan.

---

## 📅 NGÀY 20/10/2026: HOÀN THIỆN ĐĂNG KÝ KHUÔN MẶT 5 GÓC, TRIỆT TIÊU TÊN TRÙNG LẶP & KHẮC PHỤC TRẠNG THÁI SINH TRẮC HỌC

### 59. Tích Hợp Toàn Diện Đăng Ký Khuôn Mặt 5 Góc & Trình Quét AI HUD Laser Realtime
- Xây dựng `face.api.ts`, Modal đăng ký khuôn mặt 5 góc tuần tự có Euler Telemetry 3D và trang quản trị `FaceRegistrationPage.tsx` theo chuẩn CSDL v2.5.

### 60. Khắc Phục Lỗi Hiển Thị Trạng Thái Đăng Ký Face ID & Chuẩn Hóa Phân Quyền Quản Trị Viên
- Bổ sung chính thức `da_dang_ky_face`/`anh_khuon_mat` vào `user.model.js`, đồng bộ `auth.service` và phân quyền chỉ Admin/BGH mới được đăng ký Face ID cho nhân sự khác.

### 61. Tổng Rà Soát Toàn Diện Backend, Khắc Phục Lỗi Alias Shadowing & Đồng Bộ 100% 14 Collections CSDL v2.6
- Sửa lỗi Mongoose virtual shadowing alias trong `FaceTemplate`, bổ sung alias `workDate` cho `AttendanceLog`, sửa projection `auth.middleware` và chạy pass trọn vẹn 18/18 test suites.

### 62. Xóa Bỏ Hoàn Toàn Tên Trùng Lặp (Duplicate Aliases), Thiết Lập Chuẩn Ánh Xạ 1-to-1 (Canonical Aliases) & Đưa Vào Skill
- Loại bỏ triệt để các alias trùng lặp (`sampleCount`/`samplesCount`, `workDate`/`date`, `punchTime`/`scanTime`...), thiết lập chuẩn ánh xạ 1-1 và đưa quy tắc vào Clean-and-Build Skill cùng `AGENTS.md`.

### 63. Hoàn Thiện & Nâng Cấp Giao Diện Đăng Ký Khuôn Mặt Sinh Trắc Học (Face ID 5 Góc) Dựa Trên src_nhap & src_old
- Kết hợp thiết kế studio Face ID từ `src_nhap` và `src_old`: 5 thẻ hướng dẫn góc quay trực quan (12°-25°), Euler HUD 3D, warmup 2s, 5 dropzones tải ảnh thủ công và modal kiểm thử điểm danh.

### 64. Khắc Phục Triệt Để Lỗi Báo "Đã Đăng Ký" Khi Chưa Quét Khuôn Mặt & Loại Bỏ FaceTemplate Giả Lập
- Xóa bỏ 100% FaceTemplate ngẫu nhiên từ seeder, chuẩn hóa điều kiện xác thực bắt buộc tồn tại vector 512D hợp lệ thay vì kiểm tra avatar tĩnh, cập nhật giao diện hiển thị đúng "Chưa có mẫu khuôn mặt".

### 65. Tách Module Hóa Toàn Diện Microservice Python Face AI & Tối Ưu Tốc Độ, Độ Nhạy Camera Đăng Ký
- Tách file Python nguyên khối thành 6 module nghiệp vụ và 6 routers chuyên biệt (config, schemas, face_engine, pose_estimator, liveness, vector_index), đồng thời tối ưu sampling 320x240, giảm hold frame xuống 2 và rút ngắn chuyển góc còn 450ms giúp camera đăng ký đạt độ nhạy tức thì.

### 66. Tối Giản Bố Cục Trang Đăng Ký Face ID, Tương Thích Mobile/Web & Hoàn Thiện Modal Kiểm Thử Nhận Diện
- Loại bỏ các khối hướng dẫn 5 góc cồng kềnh giúp giao diện tối giản basic, xóa bỏ nút trùng lặp ở header, tinh chỉnh khung hồ sơ cá nhân cân đối, khắc phục triệt để lỗi rớt dòng chữ 'Chụp lại' và tiêu đề cột bảng danh sách nhân sự, đồng thời xây dựng `FaceTestModal` và endpoint `POST /api/face/test-recognition` kiểm thử nhận diện AI 1:N FAISS chính xác tức thì không phụ thuộc geofence hay ca trực.

### 67. Bỏ Khung Hồ Sơ Trùng Lặp, Làm Đẹp Bảng Nhân Sự Toàn Trường & Nâng Cấp Khung Đo Vector 3D Sinh Trắc Học Thay Cho Vòng Tròn
- Xóa bỏ hoàn toàn khung hồ sơ cá nhân đơn lẻ trên đầu trang, bổ sung 4 thẻ KPI thống kê tổng quan (Tổng nhân sự, Đã có Face ID, Chưa có, Tỷ lệ bao phủ), làm đẹp toàn diện bảng danh sách nhân sự (hiển thị trọn vẹn tên và chức danh, không bị cắt cụt, avatar gradient sắc nét), đồng thời xóa bỏ vòng elip tròn trên webcam và thay thế bằng khung ngắm 4 góc Sci-Fi, lưới liên kết vector 3D 5 điểm mốc Landmark, tia quét laser và thanh đo vector 512D ArcFace chuẩn sinh trắc học.

### 68. Khắc Phục Dữ Liệu Mã CB/Đơn Vị, Thiết Kế Lại Danh Sách Toàn Màn Hình Tự Động Căn Chỉnh & Triệt Tiêu Thanh Lướt Ngang
- Đồng bộ trường `staffCode` / `ma_can_bo` và `departmentName` trong MongoDB và `user.service.js`, triệt tiêu hoàn toàn lỗi hiển thị thiếu mã cán bộ (`—`) và sai phòng ban.
- Thiết kế lại cột Thao tác (Action Column) với nút bấm soft-brand `Đăng ký Face ID` thanh lịch, nhóm nút `Chụp lại` và `Xóa` mẫu Face ID (NĐ 13/2023) gọn gàng, đồng bộ kích thước và hiệu ứng tương tác.
- Chuyển đổi toàn bộ layout trang và danh sách nhân sự sang chuẩn Full-Width hiển thị toàn màn hình (`w-full`, gỡ bỏ `max-w-6xl` và `max-w-7xl`), cấu trúc theo dạng Responsive 5 Cột Độc Lập (`1.5fr | 1fr | 1.2fr | 135px | 140px`) triệt tiêu hoàn toàn tình trạng đè chữ hay chồng lấn giữa Khoa/Đơn vị và Trạng thái Face ID.
- Tự động co giãn và căn chỉnh mượt mà theo tỷ lệ khi phóng to / thu nhỏ (zoom in/out từ 50% đến 200%), khóa `overflow-x: hidden` trên `html`, `body` và `main`, triệt tiêu 100% thanh cuộn ngang (horizontal scrollbar).

### 69. Đa Dạng Hóa Bố Cục Hiển Thị (4 View Modes: Bảng, Thẻ Lưới, Tinh Gọn, Phân Nhóm Theo Khoa) & Bộ Chuyển Đổi Trạng Thái
- Bổ sung bộ điều khiển chuyển đổi bố cục (Segmented View Mode Switcher) lưu trạng thái thông minh vào `localStorage` (`face_reg_view_mode`), cho phép chuyển đổi tức thì giữa 4 dạng hiển thị chuyên nghiệp:
  1. **Bố cục 1 - Dạng Bảng Chi Tiết (Table View)**: Cấu trúc 5 cột responsive độc lập (`1.5fr | 1fr | 1.2fr | 135px | 140px`) hiển thị chi tiết thông số cán bộ, mã CB, email, phòng ban, badge Face ID và cụm nút thao tác.
  2. **Bố cục 2 - Dạng Thẻ Lưới Trực Quan (Card Grid View)**: Lưới responsive 1-4 cột với thẻ nhân sự sinh trắc học hiện đại, avatar 44px sắc nét, badge trạng thái bo góc, chip thông tin và nút bấm to rõ trực quan.
  3. **Bố cục 3 - Dạng Tinh Gọn Siêu Tốc (Compact View)**: Hàng đơn mỏng nhẹ (chiều cao tối ưu), avatar 28px, nút icon tinh gọn giúp duyệt nhanh hàng chục/hàng trăm nhân sự mà không phải cuộn trang nhiều.
  4. **Bố cục 4 - Dạng Phân Nhóm Theo Khoa / Đơn Vị (Department Groups View)**: Tự động gom nhóm nhân sự theo từng Khoa/Phòng ban kèm Accordion đóng/mở và thanh mini progress bar trực quan đo tỷ lệ bao phủ Face ID từng đơn vị đại học.
- Đảm bảo 100% tự động co giãn toàn màn hình, không phát sinh thanh cuộn ngang, kiểm tra biên dịch `npm run build` thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói).

### 70. Hợp Nhất Chức Năng Kiểm Thử Nhận Diện Vào Modal Đăng Ký & Tối Giản Toàn Diện Header Quản Trị
- **Gỡ bỏ hoàn toàn nút đăng ký cá nhân & nút kiểm thử riêng trên Header**: Xóa triệt để nút "Kiểm Thử Nhận Diện" và nút "Đăng Ký Face ID Của Tôi" khỏi thanh tiêu đề `FaceRegistrationPage.tsx`. Vì Quản trị viên/Admin có thẩm quyền đăng ký và cập nhật sinh trắc học cho toàn bộ nhân sự nhà trường trực tiếp tại danh sách bảng/thẻ bên dưới (từng cán bộ đều có nút "Đăng Ký Face ID" / "Chụp Lại" riêng biệt), nên việc đặt nút đăng ký cho bản thân ở header là dư thừa. Header giờ đây chỉ giữ duy nhất nút "Làm Mới" dữ liệu cực kỳ tinh gọn và sạch sẽ.
- **Tích hợp kiểm thử trực tiếp vào Modal Đăng ký Face ID (`FaceRegistrationModal.tsx`)**:
  1. **Segmented Switcher 2 chế độ**: Cho phép chuyển đổi mượt mà giữa chế độ **[📸 Đăng Ký Face ID]** (thu thập 5 góc khuôn mặt chuẩn sinh trắc học) và **[🎯 Kiểm Thử AI]** (đối soát vector ArcFace 512D trực tiếp trong CSDL).
  2. **Dùng chung luồng Camera Stream (Zero-Flicker)**: Khung webcam live và HUD sinh trắc học được giữ cố định, không bị unmount khi chuyển đổi tab, đảm bảo không bị gián đoạn hay phải tải lại camera.
  3. **Tự động đối soát nhận diện sau khi lưu 5 góc**: Sau khi người dùng hoàn thành đăng ký và bấm "Lưu 5 Góc Mẫu Khuôn Mặt" thành công, hệ thống tự động chuyển sang chế độ Kiểm Thử AI sau 1.2s để cán bộ có thể kiểm tra ngay lập tức độ khớp khuôn mặt của mình vừa đăng ký.
  4. **Kiểm thử tự động & thủ công**: Tự động nhận diện khi khuôn mặt giữ ổn định trong 1 giây trước ống kính, đồng thời cung cấp nút "Quét Nhận Diện Ngay" thủ công.
  5. **Thẻ kết quả đối soát trực quan**: Hiển thị đầy đủ thông tin nhân sự nhận diện được (Họ tên, Mã CB, Phòng ban, Avatar), thanh đo độ tương đồng Cosine Similarity % trực quan, xác thực Anti-Spoofing (Sống thực) và độ trễ nhận diện thời gian thực (latency ms).
- **Dọn dẹp mã nguồn**: Xóa bỏ hoàn toàn component dư thừa `FaceTestModal.tsx`, gỡ bỏ các state và props liên quan, đảm bảo mã nguồn gọn gàng.
### 71. Bổ Sung Bộ Phân Trang (Pagination) Đồng Bộ 4 Bố Cục & Tối Giản Toàn Diện Giao Diện Đăng Ký Khuôn Mặt
- **Thêm Bộ Phân Trang (Pagination Bar) Chuẩn Chỉnh**:
  1. Hỗ trợ tùy chọn kích thước trang linh hoạt (`10`, `20`, `50` nhân sự/trang), hiển thị thông tin phạm vi: *"Hiển thị X - Y trên tổng Z nhân sự"*.
  2. Cung cấp cụm nút điều hướng đầy đủ: Trang đầu (`<<`), Trang trước (`<`), Danh sách số trang tương tác thông minh, Trang tiếp (`>`), Trang cuối (`>>`).
  3. Hoạt động đồng bộ 100% trên cả 4 chế độ hiển thị danh sách (Bảng chi tiết, Thẻ lưới, Tinh gọn siêu tốc, Phân nhóm theo Khoa/Phòng ban).
  4. Tự động reset về trang 1 khi người dùng tìm kiếm nhân sự, thay đổi bộ lọc trạng thái (`all`, `registered`, `not_registered`) hoặc thay đổi số mục trên trang.
- **Tối Giản Hóa Toàn Diện Giao Diện Modal Đăng Ký Face ID (`FaceRegistrationModal.tsx`)**:
  1. **Thanh 5 bước góc tối giản (Minimal Stepper)**: Thay thế hàng nút cồng kềnh bằng thanh stepper viên thuốc (pills) mỏng nhẹ (~36px), có nhãn góc và dấu tick xanh ngọc khi đã chụp, tiết kiệm không gian màn hình tối đa.
  2. **Loại bỏ khối 3D Telemetry (Yaw/Pitch/Roll) rườm rà**: Xóa bỏ các ô số liệu đo độ góc khô khan, thay bằng Card Hướng Dẫn Góc Chụp Hiện Tại trực quan (icon to rõ, 1 câu chỉ dẫn súc tích và thanh đo giữ mặt ổn định mượt mà).
  3. **Bộ sưu tập 5 góc chụp Mini Gallery**: Hiển thị 5 ô xem trước ảnh chụp thật nhỏ xinh (50x50px), cho phép cán bộ click xem lại hoặc xóa nhanh góc bất kỳ để chụp lại tức thì.
  4. **Thông tin hồ sơ cán bộ tóm tắt**: Hiển thị ngắn gọn họ tên, mã CB, phòng ban và tiến độ hoàn thành (ví dụ: `Đã có 5/5 góc mẫu`).
- **Kiểm tra biên dịch**: Chạy `npm run build` thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói Vite bundle trong 5.09s).

### 72. Hoàn Thiện Cơ Chế Tự Động Dừng Chụp Khi Đủ 5 Góc & Tùy Chọn Chụp Lại Thông Minh Trong Đăng Ký Khuôn Mặt
- **Cơ Chế Chặn Tự Động Chụp (Auto-Capture Lock)**:
  1. **Dừng chụp khi đủ 5 góc**: Khi hệ thống đã thu thập đủ 5/5 góc khuôn mặt (`straight`, `left`, `right`, `up`, `down`), vòng lặp camera sẽ **dừng hoàn toàn** việc tự động chụp (`allDone`). Hệ thống phát âm thanh thành công, bắn hiệu ứng pháo hoa chúc mừng và thông báo hoàn tất thu thập sinh trắc học.
  2. **Khóa chụp đè từng góc**: Đối với từng góc cụ thể, nếu góc đó đã có ảnh chụp thì vòng lặp camera sẽ tự động khóa không chụp đè lên góc đó nữa, trừ khi người dùng chủ động yêu cầu chụp lại.
  3. **Cập nhật hiển thị HUD và Floating Badge**: Trên khung ngắm camera, khi đã đủ 5 góc sẽ hiển thị `🎉 ĐÃ ĐỦ 5/5 GÓC (DỪNG CHỤP)` màu xanh ngọc bích. Khi góc hiện tại đã có ảnh sẽ hiển thị `✓ ĐÃ CHỤP XONG GÓC [TÊN GÓC]`, ẩn thanh đếm giữ mặt và thông báo cho người dùng biết góc này đã hoàn thành.
- **Tính Năng Chụp Lại Góc Hiện Tại & Chụp Lại Tất Cả (Retake Controls)**:
  1. **Nút "Chụp Lại Góc Này"**: Khi góc hiện tại đã có ảnh, nút chính dưới camera tự động chuyển sang `[🔄 Chụp Lại Góc Này]` (màu vàng hổ phách). Khi người dùng nhấn nút, ảnh góc đó sẽ được giải phóng, reset bộ đếm và mở khóa để camera tự động bắt lại góc đó.
  2. **Nút "Chụp Lại Tất Cả"**: Bổ sung nút `[🔄 Chụp lại tất cả]` ở cả thanh điều khiển dưới camera và tiêu đề Mini Gallery. Cho phép làm mới/xóa toàn bộ 5 góc và đưa con trỏ về góc 1 (Chính diện) để chụp lại từ đầu một cách nhanh chóng.
  3. **Hành động nhanh trên từng thumbnail Mini Gallery**: Mỗi ô ảnh xem trước trong Mini Gallery khi hover sẽ cung cấp 2 nút thao tác nhanh: `[🔄 Chụp lại góc này]` và `[🗑️ Xóa góc này]`.
  4. **Chuyển bước thông minh sau khi chụp**: Khi chụp xong một góc, nếu chưa đủ 5 góc, hệ thống sẽ tự động tìm góc tiếp theo **chưa có ảnh** để chuyển bước, giúp trải nghiệm mượt mà không bị lặp lại các góc đã có sẵn.
- **Kiểm tra biên dịch**: Chạy `npm run build` thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói Vite bundle trong 3.21s).

### 73. Khắc Phục Triệt Để Lỗi Đăng Ký Khuôn Mặt Trùng Lặp Giữa Nhiều Người Dùng (Anti-Duplicate Face Biometrics)
- **Bối Cảnh Lỗi & Nguyên Nhân Gốc Rễ**:
  1. Frontend modal `FaceRegistrationModal.tsx` trước đây tự động gửi cờ `force: 'true'` trong form data khi lưu, dẫn đến việc backend bỏ qua bước kiểm tra trùng lặp sinh trắc học (`if (!isForce)`).
  2. Thuật toán `checkDuplicateFace` cũ đặt ngưỡng Euclidean quá khắt khe (`dupThreshold = 0.65`, tương đương Cosine $> 0.79$) và có điều kiện ngắt sớm `diffThreshold = 0.85` khiến hai lần chụp của cùng 1 người nếu bị lệch góc hoặc thay đổi ánh sáng sẽ bị nhận nhầm là 2 người khác nhau.
  3. Hàm `getCachedUsersWithFace` trước đây có điều kiện `isActive: true` và tra cứu trường alias có thể làm sót hồ sơ khuôn mặt đã đăng ký trong CSDL.
- **Giải Pháp Xử Lý Toàn Diện Chuẩn Sinh Trắc Học**:
  1. **Loại bỏ hoàn toàn cờ `force: true` ở Frontend**: Khi đăng ký khuôn mặt, hệ thống luôn bắt buộc thực thi kiểm tra trùng lặp sinh trắc học với toàn bộ cơ sở dữ liệu.
  2. **Khóa cứng tính năng chống trùng lặp ở Backend (`faceTemplate.service.js`)**: Một khuôn mặt tuyệt đối chỉ thuộc về một nhân sự duy nhất. Nếu phát hiện khuôn mặt đã tồn tại ở tài khoản khác, hệ thống lập tức chặn lại và ném lỗi 409 (`USER_FACE_ALREADY_REGISTERED`) kèm đầy đủ thông tin nhân sự bị trùng (Họ tên, Mã CB, Email), không bao giờ cho phép ghi đè hay chia sẻ mặt. Việc cập nhật lại cho chính mình vẫn diễn ra bình thường do hệ thống tự động lọc bỏ ID của chính mình khi so khớp.
  3. **Nâng cấp thuật toán `checkDuplicateFace` (`attendanceHelpers.js`)**:
     - Bổ sung hàm tính `cosineSimilarity` chuẩn xác cho vector ArcFace 512D.
     - Phát hiện trùng lặp đa chiều: So khớp Cosine góc chính diện $\ge 0.58$, Cosine Centroid $\ge 0.58$, hoặc khoảng cách Euclidean $\le 0.88$ (đảm bảo 100% bắt được cùng 1 người dù chụp ở các thời điểm khác nhau, trong khi người khác biệt chỉ có Cosine $< 0.35$).
  4. **Tối ưu hóa `getCachedUsersWithFace`**: Load đầy đủ cả trường tiếng Việt (`vector_dac_trung`, `nguoi_dung_id`) và alias tiếng Anh, dùng `.lean()` siêu tốc, không lọc `isActive` để bảo vệ toàn vẹn toàn bộ kho sinh trắc học.
- **Kiểm tra nghiệm thu**:
  1. `faceEnrollment.test.js`: Đạt 8/8 test PASS 100%.
  2. Script kiểm thử kịch bản 3 người dùng cùng 1 khuôn mặt: Người 1 đăng ký thành công $\rightarrow$ Người 2 bị phát hiện trùng lặp 98.09% $\rightarrow$ Người 3 bị phát hiện trùng lặp 99.44% $\rightarrow$ Người 4 (mặt khác biệt) đăng ký hợp lệ.
  3. Toàn bộ 18 Test Suites tự động (`npm test`) đạt 100% PASS.
  4. Biên dịch frontend `npm run build` thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói).

### 74. Khắc Phục Triệt Để Lỗi Sai Chiều Khi Chụp Lại Góc (Quay Trái / Quay Phải) Và Lỗi Vòng Lặp Spam Toast Trong Chế Độ Kiểm Thử Nhận Diện AI
- **Bối Cảnh Lỗi & Nguyên Nhân Gốc Rễ**:
  1. **Lỗi đảo ngược chiều quay đầu Euler Yaw trong Python Face Service**:
     - Trong `pose_estimator.py`, tọa độ camera webcam chuẩn chưa lật quy ước: khi người dùng quay mặt sang bên trái của mình, đỉnh mũi di chuyển về phía bên phải khung hình ($X$ tăng $\implies dx_{nose} > 0 \implies yaw_{deg} > 0$).
     - Tuy nhiên trước đây trong code `pose_estimator.py`, `yaw_deg <= -7.0` lại bị gán nhầm là `TURN_LEFT` (`nghieng_trai`) và `yaw_deg >= 7.0` bị gán là `TURN_RIGHT` (`nghieng_phai`).
     - Đồng thời, hàm `checkAngleTargetMet` ở frontend chấp nhận cả hai điều kiện (`yawDeg >= 6` hoặc `p === 'TURN_LEFT'`), dẫn tới việc người dùng quay sang bên phải nhưng hệ thống vẫn nhận diện là đạt yêu cầu "Quay trái".
  2. **Lỗi hiển thị HUD trong chế độ Kiểm Thử AI (`mainMode === 'test'`)**:
     - `drawFaceIDHUD` không kiểm tra `isTestMode`, dẫn đến khi mở chế độ Kiểm thử AI trên khuôn mặt đã đăng ký, thanh floating badge trên trán vẫn hiện thông báo đăng ký: `🎉 ĐÃ ĐỦ 5/5 GÓC (DỪNG CHỤP)`.
  3. **Lỗi vòng lặp vô hạn spam Toast báo lỗi ("Không tìm thấy khuôn mặt trùng khớp trong hệ thống")**:
     - Vòng lặp camera `requestAnimationFrame` liên tục kích hoạt `executeTestRecognition` do biến `isExecutingTestRef` bị reset ngay trong `finally`, kèm theo state closure không chặn kịp thời, khiến hệ thống bắn 4-5 toast lỗi liên tiếp và làm nghẽn server.
  4. **Lỗi không nhận diện được do RAM FAISS Vector Index rỗng**:
     - Trong `faceServiceClient.js`, hàm `ensureRamCacheWarm` kiểm tra `stats.total_vectors === 0`, nhưng Python endpoint `/v1/faiss/stats` trả về `{ status: 'ok', data: { total_vectors: ... } }`. Việc truy cập `stats.total_vectors` bị `undefined`, khiến cơ chế tự phục hồi vector từ MongoDB lên RAM Index không được kích hoạt.
     - Hàm `addFaissTemplate` bỏ quên trường `fullName` và `employeeId` khi gọi API `/v1/faiss/add`.
- **Giải Pháp Xử Lý Toàn Diện**:
  1. **Chuẩn hóa góc Euler 3D Yaw trong Python (`pose_estimator.py`)**:
     - `yaw_deg >= 7.0` $\implies$ `nghieng_trai` / `TURN_LEFT`.
     - `yaw_deg <= -7.0` $\implies$ `nghieng_phai` / `TURN_RIGHT`.
  2. **Ràng buộc chiều hướng nghiêm ngặt 1 chiều trong `checkAngleTargetMet` (`FaceRegistrationModal.tsx`)**:
     - Góc quay trái: Bắt buộc `yawDeg >= 3.0` và không được chứa bất kỳ nhãn `RIGHT` / `PHAI` nào. Tuyệt đối chặn không cho quay phải lọt qua.
     - Góc quay phải: Bắt buộc `yawDeg <= -3.0` và không được chứa bất kỳ nhãn `LEFT` / `TRAI` nào. Tuyệt đối chặn không cho quay trái lọt qua.
     - Tương tự cho Ngước lên và Cúi xuống.
  3. **Khắc phục triệt để chế độ Kiểm thử AI (`mainMode === 'test'`)**:
     - Camera HUD floating badge hiển thị chuẩn xác trạng thái kiểm thử: `⚡ ĐANG ĐỐI SOÁT AI...`, `✓ KHỚP: [TÊN CÁN BỘ]`, `✕ KHÔNG TRÙNG KHỚP`, hoặc `🎯 HƯỚNG MẶT ĐỂ KIỂM THỬ`. Tuyệt đối không hiển thị badge của luồng đăng ký.
     - Khung ngắm laser 4 góc tự động đổi màu tương ứng: Xanh ngọc khi sẵn sàng, Hổ phách khi đang quét, Xanh lục khi khớp, Đỏ khi chưa khớp.
     - Ẩn thanh đo tiến trình đăng ký (holdProgress) khi ở chế độ kiểm thử.
  4. **Chống spam Toast và chặn đứng vòng lặp kiểm thử lặp vô hạn**:
     - Bổ sung `hasAutoTestedRef`, `testResultRef`, `isTestingRecognitionRef`.
     - Chế độ tự động chỉ quét 1 lần duy nhất khi khuôn mặt ổn định. Sau khi có kết quả, dừng hoàn toàn và chờ người dùng bấm `[Quét Thử Lại]` hoặc `[Quét Nhận Diện Ngay]`.
  5. **Sửa lỗi đồng bộ RAM Vector Store (`faceServiceClient.js` & `faceRecognition.service.js`)**:
     - Sửa `ensureRamCacheWarm` trích xuất chuẩn `raw?.data || raw`, tự động phục hồi nạp toàn bộ vector từ MongoDB lên RAM Index khi khởi động.
     - Bổ sung `fullName`, `employeeId` trong `addFaissTemplate`.
     - Bổ sung tra cứu `email` và `ma_can_bo` khi resolve tài khoản sau đối soát AI.
- **Kiểm tra nghiệm thu**:
  - Chạy `npm test`: 18/18 Test Suites đạt 100% PASS.
  - Chạy `npm run build`: Thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói Vite bundle trong 4.60s).

### 75. Nâng Chuẩn Ngưỡng Góc Quay 3D Face ID Chống Nhích Nhẹ Tự Chụp & Sửa Lỗi 'mongoose is not defined' Trong Kiểm Thử AI
- **Bối Cảnh Lỗi & Nguyên Nhân Gốc Rễ**:
  1. **Ngưỡng góc Euler Yaw/Pitch quá nhạy**:
     - Trước đây, `pose_estimator.py` chỉ yêu cầu `yaw_deg >= 7.0` và frontend `checkAngleTargetMet` cho phép `yawDeg >= 3.0` để kích hoạt góc quay trái/phải.
     - Đồng thời `REQUIRED_HOLD_FRAMES` chỉ đặt bằng 2 frames (~0.15s).
     - Điều này khiến người dùng chỉ cần nhích nhẹ đầu 3°-7° (hoặc chớp mắt, cử động miệng khi thở) là hệ thống đã nhận diện đạt góc và tự động chụp ngay, dẫn đến ảnh chụp không đủ độ nghiêng chuẩn sinh trắc học đa chiều (ảnh các góc 2, 3, 4, 5 gần như giống góc chính diện).
  2. **Lỗi `ReferenceError: mongoose is not defined` trong kiểm thử nhận diện**:
     - Khi kiểm thử nhận diện thành công qua RAM FAISS Index, hệ thống gọi hàm `processFaceAttendance` trong `faceRecognition.service.js`.
     - Tại dòng 85: `if (mongoose.Types.ObjectId.isValid(rawUserId))` bị crash do file `faceRecognition.service.js` chưa `require('mongoose')`.
     - Controller bắt ngoại lệ và trả về màn hình: `Chưa Trùng Khớp` kèm thông báo lỗi `mongoose is not defined`.
- **Giải Pháp Xử Lý Toàn Diện**:
  1. **Nâng chuẩn ngưỡng góc quay 3D chuẩn xác cao (`pose_estimator.py`)**:
     - Quay trái (`TURN_LEFT`): Bắt buộc $yaw_{\text{deg}} \ge 12.0^\circ$.
     - Quay phải (`TURN_RIGHT`): Bắt buộc $yaw_{\text{deg}} \le -12.0^\circ$.
     - Ngước lên (`LOOK_UP`): Bắt buộc $pitch_{\text{deg}} \ge 7.0^\circ$.
     - Cúi xuống (`LOOK_DOWN`): Bắt buộc $pitch_{\text{deg}} \le -6.0^\circ$.
  2. **Tăng cường kiểm định góc và thời gian giữ ổn định (`FaceRegistrationModal.tsx`)**:
     - Tăng `REQUIRED_HOLD_FRAMES` từ `2` lên `4` (yêu cầu giữ yên ~0.5 giây, chống rung lắc và nhích nhẹ thoáng qua).
     - Góc quay trái: Yêu cầu $yaw_{\text{deg}} \ge 11.5^\circ$, từ chối nếu $< 11.0^\circ$.
     - Góc quay phải: Yêu cầu $yaw_{\text{deg}} \le -11.5^\circ$, từ chối nếu $> -11.0^\circ$.
     - Ngước lên: Yêu cầu $pitch_{\text{deg}} \ge 6.5^\circ$, từ chối nếu $< 5.5^\circ$.
     - Cúi xuống: Yêu cầu $pitch_{\text{deg}} \le -5.5^\circ$, từ chối nếu $> -4.5^\circ$.
     - Cập nhật chỉ dẫn (guidance text) chi tiết cho người dùng: quay rõ ràng khoảng 15° - 25° sang trái/phải, nâng cằm 8° - 20° và cúi 7° - 18°.
  3. **Khắc phục triệt để lỗi `mongoose is not defined` (`faceRecognition.service.js`)**:
     - Bổ sung `const mongoose = require('mongoose');` ở đầu file.
     - Đảm bảo tra cứu hồ sơ người dùng theo `ObjectId`, `staffCode`, `employeeCode`, `ma_can_bo`, `email` hoạt động trơn tru 100%.
- **Kiểm tra nghiệm thu**:
  - Chạy `npm test`: 18/18 Test Suites đạt 100% PASS.
  - Chạy `npm run build`: Thành công 100% (0 lỗi TypeScript, 0 lỗi đóng gói Vite bundle trong 3.11s).

### 76. Khắc Phục Lỗi "Không Thể Xóa Dữ Liệu Khuôn Mặt" & Chuẩn Hóa Phân Quyền Hủy Bỏ Sinh Trắc Học (20/10/2026)
- **Bối cảnh & Hiện tượng lỗi**:
  - Người dùng bấm biểu tượng thùng rác (xóa mẫu khuôn mặt Face ID) của cán bộ / nhân viên trên trang `FaceRegistrationPage.tsx` thì hệ thống hiển thị thông báo lỗi `❌ Không thể xóa dữ liệu khuôn mặt.`.
- **Phân Tích Nguyên Nhân Gốc (Root Cause Analysis)**:
  1. **Lệch cấu hình Middleware phân quyền (Route RBAC Mismatch)**:
     - Tại `server/routes/face.routes.js`, endpoint `DELETE /faces/:userId` khai báo: `verifyRole(['admin', 'bgh', 'admin_it', 'it_admin'])`.
     - Phân quyền này vô tình chặn các tài khoản cán bộ phòng Tổ chức Cán bộ (`tccb`), Trưởng khoa (`truong_khoa`/`truongkhoa`) và chặn cả trường hợp người dùng tự xóa dữ liệu sinh trắc học của chính mình (`isSelf`) theo Nghị định 13/2023/NĐ-CP.
     - Trong khi đó, Controller `deleteFaceData` (`face.controller.js`) đã có sẵn logic kiểm tra phân quyền chi tiết: `isSelf || isAuthorizedManager` (bao gồm cả `tccb`, `truong_khoa`). Middleware ở tầng route chặn trước khi đến controller và trả về HTTP 403.
  2. **Truy vấn định danh User chưa an toàn**:
     - `removeFaceDescriptorForUser` (`server/services/faceTemplate.service.js`) gọi trực tiếp `User.findById(id)` mà chưa kiểm tra `mongoose.isValidObjectId(id)`. Nếu `id` truyền vào là mã cán bộ (`staffCode`) hoặc chuỗi không phải ObjectId hợp lệ sẽ gây lỗi `CastError`.
     - Đồng thời, hàm xóa trước đây gán `$set` chứa các trường cũ `faceDescriptor` và `faceAngles` không còn trong User Schema v2.5.
  3. **Truyền định danh từ giao diện và cơ chế bắt lỗi**:
     - Các nút bấm xóa trên 4 chế độ hiển thị (Table, Grid, Compact, Department) chỉ truyền `emp._id`, thiếu fallback `emp._id || emp.id`.
     - Hàm bắt lỗi `handleDeleteEmployeeFace` chỉ đọc `err.response?.data?.message`, thiếu bóc tách `err.response?.data?.error` hoặc `err.message`, dẫn đến hiển thị câu fallback chung chung.
- **Giải Pháp Xử Lý Toàn Diện**:
  1. **Tái cấu trúc Middleware `canDeleteFace` (`server/routes/face.routes.js`)**:
     - Cho phép xóa nếu: `currentUserId === targetUserId` (tự xóa) HOẶC tài khoản quản lý thuộc nhóm `['admin', 'bgh', 'truong_khoa', 'truongkhoa', 'admin_it', 'it_admin', 'tccb']`.
     - Bổ sung alias route `DELETE /users/:userId` tại `face.routes.js`.
  2. **Tăng cường an toàn dữ liệu trong Service (`faceTemplate.service.js`)**:
     - Kiểm tra `mongoose.isValidObjectId(id)`, nếu không phải ObjectId thì tự động tìm kiếm dự phòng qua `{ staffCode, ma_can_bo, employeeCode, email }`.
     - Chuẩn hóa trường `$set` cập nhật User theo đúng 100% CSDL v2.5: reset `da_dang_ky_face`, `isFaceRegistered`, `anh_khuon_mat`, `facePhoto`, `ngay_dang_ky_face`, `faceRegisteredAt`, `ngay_dong_y_sinh_trac`, `biometricConsentDate` về `false`/`null`.
  3. **Cơ chế Fallback Route tự động (`src/api/face.api.ts`)**:
     - Trong `faceApi.deleteFaceData(userId)`, nếu gọi `/face/faces/:userId` gặp lỗi 404 thì tự động chuyển hướng fallback sang `/users/:userId/face`.
  4. **Nâng cấp UI Client (`FaceRegistrationPage.tsx` & `FaceRegistrationModal.tsx`)**:
     - Áp dụng `emp._id || emp.id` cho toàn bộ 5 vị trí nút xóa (Table Mobile, Table Desktop, Card Grid, Compact List, Department Group) và Modal đăng ký.
     - Xử lý thông báo toast lỗi chi tiết, bóc tách đầy đủ `data.message`, `data.error`, `err.message`.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).

### 77. Nâng Cấp Trải Nghiệm Camera Sinh Trắc Học: Hoạt Ảnh 60 FPS Mượt Mà, Nội Suy Lerp, Tách Luồng Worker Ngầm, Độ Nét HD 720p & Đếm Tiến Trình Giữ Góc Liên Tục (20/10/2026)
- **Bối cảnh & Đánh giá từ thực nghiệm người dùng**:
  - Đăng ký 5 góc và kiểm thử nhận diện AI nhận diện chuẩn xác.
  - Tuy nhiên, tồn tại 4 vấn đề ảnh hưởng đến trải nghiệm người dùng:
    1. *Đoạn chạy số phần trăm quét các góc bị khựng, không mượt*: Tiến trình phần trăm nhảy bậc gián đoạn thô (mỗi bậc 25%: `0% -> 25% -> 50% -> 75% -> 100%`).
    2. *Khởi động camera lúc đầu hơi lâu*: Modal mở lên bị trễ phần cứng do gọi lặp `getUserMedia` và re-render khi chuyển `mainMode`.
    3. *Bắt nét kém, hình ảnh mờ*: Ràng buộc camera trước đây đặt mặc định ở độ phân giải thấp VGA 640x480 (0.3 MP) khiến webcam trên màn hình hiện đại bị nhòe hạt, thiếu nét và không kích hoạt autofocus tối ưu.
    4. *Khi di chuyển đầu bị delay có thể thấy rõ ràng*: Khung ngắm HUD, tia laser và tọa độ mốc bị trễ (lag) rõ rệt theo cử động người dùng.
- **Phân Tích Nguyên Nhân Gốc (Root Cause Analysis)**:
  1. **Khựng số phần trăm**: `holdProgress` trước đây tính theo tỷ lệ khung hình rời rạc: `(holdCounter / REQUIRED_HOLD_FRAMES) * 100` với `REQUIRED_HOLD_FRAMES = 4`. Biến đếm nguyên tăng từng đơn vị dẫn đến số nhảy theo 4 bước gián đoạn lớn.
  2. **Trễ camera khi mở**: `useEffect` theo dõi `[isOpen, mainMode, tabMode]` khiến mỗi khi modal thiết lập `initialMode` vào state `mainMode`, hiệu ứng phụ kích hoạt lại `stopCamera()` rồi `startCamera()`, gọi `getUserMedia()` 2 lần liên tiếp làm webcam phần cứng DirectShow/MediaFoundation trên Windows bị đơ 1-2 giây.
  3. **Độ phân giải thấp & nhòe nét**: Ràng buộc video đặt `{ ideal: 640, height: ideal: 480 }`. Cảm biến camera bị giới hạn băng thông, không kích hoạt cơ chế tự động lấy nét (autofocus) và ảnh chụp sinh trắc học bị mờ viền.
  4. **Delay cử động đầu do lồng ghép Render với HTTP Network Request**: Hàm `startProcessingLoop` đặt lệnh vẽ canvas `drawFaceIDHUD` bên trong callback bất đồng bộ của `toBlob` và `await faceApi.detectPose(blob)`. Trong thời gian chờ phản hồi mạng từ Node.js và Python microservice (50 - 150ms), canvas overlay hoàn toàn bị đóng băng, không vẽ khung ngắm, khiến cử động đầu bị khựng giật rõ rệt.
- **Giải Pháp Kỹ Thuật Toàn Diện Đã Thực Hiện**:
  1. **Tách biệt hoàn toàn luồng vẽ 60 FPS khỏi luồng phân tích AI ngầm (Decoupled 60 FPS Architecture)**:
     - `start60FpsRenderLoop`: Vòng lặp `requestAnimationFrame` độc lập chạy liên tục ở tốc độ 60 FPS (16.6ms/khung hình).
     - `startFastDetectionWorker`: Worker ngầm lấy mẫu ảnh 320x240 và gửi yêu cầu phân tích tư thế đầu (`detectPose`) tới backend mà không chặn luồng vẽ canvas.
  2. **Thuật toán Nội suy tuyến tính mượt mà (Linear Interpolation - Lerp)**:
     - Áp dụng công thức `lerp(smooth, target, factor)` với hệ số $\alpha = 0.35$ cho toàn bộ các thành phần:
       - Tọa độ Bounding Box (`x, y, width, height`).
       - 5 điểm mốc Landmark sinh trắc học (`right_eye, left_eye, nose_tip, mouth_right, mouth_left`).
       - 3 góc xoay đầu 3D Euler (`yaw, pitch, roll`).
       - Tia quét Laser Vector chạy dọc khuôn mặt.
     - Giúp khung ngắm và các đường vector bám sát gương mặt tức thì, chuyển động êm ái, xóa bỏ 100% cảm giác delay khi quay đầu.
  3. **Đếm tiến trình giữ góc liên tục theo mili-giây (Continuous Time-Based Smooth Progress)**:
     - Bổ sung hằng số `HOLD_DURATION_MS = 500` (giữ góc ổn định liên tục 500ms).
     - Khi thỏa mãn điều kiện góc, đo đếm thời gian thực `performance.now() - holdStartTimeRef.current` và nội suy giá trị phần trăm `smoothProgressRef.current` ở 60 FPS.
     - Số phần trăm và thanh tiến trình tăng dần mượt mà liên tục (`0% -> 6% -> 18% -> 35% -> 54% -> 72% -> 88% -> 100%`), tạo cảm giác quét sinh trắc học công nghệ cao như Face ID.
  4. **Nâng cấp Camera HD 720p & Tối ưu hóa khởi động tức thì**:
     - Cấu hình lại ràng buộc `getUserMedia`: `{ width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, min: 20 } }`. Camera sắc nét, chi tiết cao, màu sắc trung thực và kích hoạt autofocus phần cứng.
     - Ảnh chụp góc lưu trữ snapshot với độ nét cao 1280x720 và chất lượng JPEG 0.95.
     - Thêm cờ kiểm tra `streamRef.current?.active && isCameraActiveRef.current` chặn gọi lặp `getUserMedia`.
     - Tách bỏ sự phụ thuộc `mainMode` trong `useEffect` camera, giúp việc chuyển đổi qua lại giữa Đăng ký và Kiểm thử nhận diện không làm khởi động lại webcam phần cứng.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).

### 78. Khắc Phục Lỗi Bất Đồng Bộ RAM FAISS Khi Đăng Ký Trùng Mặt & Nâng Cấp Tự Động Tái Đồng Bộ (Self-Healing Sync) RAM - MongoDB (20/10/2026)
- **Bối cảnh & Hiện tượng lỗi**:
  - Khi đăng ký khuôn mặt cho ThS. Nguyễn Trọng An, hệ thống trích xuất vector và lưu thành công vào CSDL MongoDB.
  - Khi sau đó tiến hành đăng ký cho nhân sự khác bằng cùng khuôn mặt đó (ví dụ: Đỗ Thu Hà), Node.js backend đã phát hiện trùng khớp sinh trắc học và chặn lại với mã lỗi 409 `USER_FACE_ALREADY_REGISTERED` (đúng theo nghiệp vụ). CSDL MongoDB hoàn toàn không lưu hồ sơ khuôn mặt của Đỗ Thu Hà.
  - Tuy nhiên, khi mở màn hình kiểm thử nhận diện AI cho Đỗ Thu Hà, camera lại nhận diện ra Đỗ Thu Hà với độ tương đồng 84% thay vì nhận diện ra ThS. Nguyễn Trọng An.
- **Phân Tích Nguyên Nhân Gốc (Root Cause Analysis)**:
  1. **Nạp RAM sớm trước khi Commit Database**: Trong `face-service/routers/enrollment.py` (hàm `enroll_multi_angle`), sau khi tính toán vector centroid 512D, Python microservice đã tự động gọi `vector_index.add_user_template(user_id=employee_id, ...)` nạp ngay vector vào RAM FAISS *trước khi* gửi về cho Node.js backend.
  2. **Rác bộ nhớ khi giao dịch bị từ chối**: Khi Node.js kiểm tra trùng lặp và từ chối đăng ký (bắn lỗi 409), hồ sơ không vào MongoDB nhưng vector và thông tin của Đỗ Thu Hà đã bị kẹt vĩnh viễn trên RAM FAISS của Python microservice. Do đó, FAISS chứa 2 người dùng cho cùng 1 khuôn mặt, dẫn đến nhận diện sai lệch.
- **Giải Pháp Kỹ Thuật Đã Triển Khai**:
  1. **Xóa bỏ triệt để việc nạp RAM sớm tại endpoint trích xuất (`enroll_multi_angle`)**:
     - Loại bỏ việc gọi `vector_index.add_user_template` trong router trích xuất. Python extraction endpoint chỉ làm nhiệm vụ toán học thuần túy (trích xuất đặc trưng sinh trắc học).
     - Việc ghi vào RAM FAISS chỉ được thực hiện thông qua endpoint `/v1/faiss/add` hoặc `/v1/faiss/sync` sau khi Node.js backend đã hoàn thành xác thực nghiệp vụ, kiểm tra chống trùng lặp và lưu thành công vào MongoDB.
  2. **Cơ chế Tự Động Chữa Lành & Đối Soát Số Lượng Bản Ghi (`ensureRamCacheWarm`)**:
     - Nâng cấp `ensureRamCacheWarm` trong `server/services/faceServiceClient.js`: So sánh đối chiếu số lượng người dùng trong RAM FAISS (`totalUsers`) với số bản ghi thực tế trong MongoDB `FaceTemplate.countDocuments()`.
     - Bất cứ khi nào phát hiện sai lệch số lượng (ví dụ RAM thừa profile mồ côi), hệ thống lập tức tự động kích hoạt `syncFaissTemplates` để làm sạch và nạp lại 100% RAM khớp hoàn toàn với CSDL MongoDB.
  3. **Chống trùng lặp / rác vector trong `vector_index.py`**:
     - Bổ sung kiểm tra `if u_id in self.user_to_indices: self.remove_user(u_id)` trong `add_user_template` để triệt tiêu mọi nguy cơ cộng dồn vector cũ khi cập nhật.
  4. **Nâng cấp UI Client (`FaceRegistrationModal.tsx`)**:
     - Bổ sung logic so sánh `isMatchedTargetUser` giữa ID người được nhận diện và ID nhân sự trong hồ sơ đang mở.
     - Phân định rõ ràng: Nếu khớp đúng nhân sự đang mở modal $\rightarrow$ Huy hiệu xanh Emerald (`Khớp Đúng Nhân Sự (Matched)`). Nếu nhận diện ra nhân sự khác $\rightarrow$ Huy hiệu cảnh báo hổ phách Amber (`Phát Hiện Khuôn Mặt Nhân Sự Khác`) kèm giải thích chi tiết: *Bạn đang kiểm thử trong hồ sơ của X nhưng hệ thống AI nhận diện chính xác người đang đứng trước camera là Y*.
     - Hiển thị HUD cảnh báo trực quan trên khung ngắm Canvas camera.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).

### 79. Chuẩn Hóa CSDL v2.5: Loại Bỏ 2 Bảng Tiếng Anh Rác (facetemplates & users) Và Đồng Bộ 100% 14 Collections Thuần Việt (20/10/2026)
- **Bối cảnh & Hiện tượng phát hiện**:
  - Khi người dùng kiểm tra MongoDB qua công cụ quản trị (MongoDB Compass), phát hiện database `DATN_QLNS_ChamCong_FaceRec` tồn tại 2 bảng tiếng Anh thừa: `facetemplates` và `users`.
- **Phân Tích & Xác Minh (Root Cause & Verification)**:
  - Kiểm tra số lượng bản ghi: Cả 2 collection `facetemplates` và `users` đều có số lượng bằng **0** và chỉ chứa chỉ mục mặc định `_id_`.
  - Đây là 2 collection rỗng còn sót lại từ các đợt chạy script khởi tạo ban đầu trước khi dự án đồng bộ sang đặc tả CSDL v2.5 thuần Việt (`mau_khuon_mat` và `nguoi_dung`).
  - Trong toàn bộ mã nguồn nghiệp vụ và 14 Mongoose Schema hiện tại, tất cả đều được định danh tường minh với tham số thứ 3 trỏ về collection tiếng Việt tương ứng (`mau_khuon_mat`, `nguoi_dung`, v.v.).
- **Các Hành Động Kỹ Thuật Đã Triển Khai**:
  1. **Drop triệt để 2 collection tiếng Anh rác khỏi MongoDB**:
     - Thực thi lệnh drop hoàn toàn `facetemplates` và `users`.
     - Số lượng collection trong MongoDB Database đưa về chuẩn xác đúng **14 collections** thuần Việt 100%:
       `ca_lam_viec`, `cau_hinh_he_thong`, `don_nghi_phep`, `lich_trinh`, `luot_quet_cham_cong`, `ma_lam_moi`, `mau_khuon_mat`, `mon_hoc`, `ngay_nghi_le`, `nguoi_dung`, `nhat_ky_cham_cong`, `nhat_ky_kiem_toan`, `phieu_luong`, `phong_ban`.
  2. **Chuẩn hóa script đồng bộ chỉ mục (`server/scripts/syncIndexes.js`)**:
     - Cập nhật ánh xạ nhãn hiển thị trong `collectionsList` khớp tuyệt đối với CSDL v2.5 (`FaceTemplate` $\rightarrow$ `mau_khuon_mat`, `Department` $\rightarrow$ `phong_ban`, `Schedule` $\rightarrow$ `lich_trinh`, `LeaveRequest` $\rightarrow$ `don_nghi_phep`).
     - Chạy kiểm tra `npm run db:sync-indexes`: Đạt thành công 14/14 collections, không phát sinh bất kỳ collection tiếng Anh nào.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).
  - Trạng thái MongoDB: Duy nhất 14 collections tiếng Việt chuẩn v2.5.

### 80. Tối Ưu Quản Lý Lưu Trữ Ảnh Sinh Trắc Học & Đồng Bộ Tự Động Xóa Tệp: Kích Hoạt MinIO Bucket, Tách Thư Mục Ngoài Project & Xóa Sạch File Rác (20/10/2026)
- **Bối cảnh & Thắc mắc người dùng**:
  - Thư mục `uploads/faces` tích tụ nhiều file `face-*.jpg` phát sinh khi đăng ký.
  - Người dùng yêu cầu: Khi dữ liệu khuôn mặt trên hệ thống bị xóa thì file ảnh cũng phải mất theo; ảnh kiểm thử không được lưu; chuyển lưu trữ sang MinIO hoặc thư mục bên ngoài project tránh làm nặng git repository.
- **Phân Tích Nguyên Nhân Gốc (Root Cause)**:
  1. *Phân định loại ảnh*: `uploads/faces` là ảnh chụp góc thẳng được lưu khi **Đăng ký Face ID** để làm ảnh đại diện sinh trắc học trên hồ sơ, **hoàn toàn không phải ảnh kiểm thử**. Khi kiểm thử nhận diện AI (`testFaceRecognition`), hệ thống truyền thẳng buffer vào RAM đối soát rồi giải phóng tức thì, không lưu bất kỳ file nào.
  2. *Lệch mật khẩu MinIO trong `.env`*: File `.env` đặt `MINIO_SECRET_KEY=minioadmin` trong khi MinIO server đang chạy với `minioadminpassword`. Khi kết nối MinIO xác thực thất bại, hệ thống kích hoạt cơ chế fallback ghi trực tiếp vào ổ cứng cục bộ `uploads/faces` bên trong project.
  3. *Lưu ảnh trước khi xác thực nghiệp vụ*: Trong `enrollMultiAngleFace`, lệnh lưu ảnh vào storage chạy *trước* khi kiểm tra trùng mặt `registerFaceDescriptorForUser`. Khi đăng ký bị chặn (ví dụ lỗi 409 Conflict trùng mặt), file ảnh đã lỡ ghi vào thư mục và biến thành tệp mồ côi (orphan file).
  4. *Chưa có hook xóa tệp khi hủy sinh trắc học*: Khi người dùng hoặc quản trị viên bấm xóa khuôn mặt (`removeFaceDescriptorForUser`), hệ thống mới chỉ xóa trong MongoDB và FAISS RAM mà chưa gọi lệnh xóa file trên MinIO / Local storage.
- **Các Giải Pháp Kỹ Thuật Đã Triển Khai**:
  1. **Khắc phục kết nối MinIO Object Storage**:
     - Cập nhật đúng `MINIO_SECRET_KEY=minioadminpassword` trong `.env`.
     - Tự động tạo và kết nối thành công bucket `datn-qlns-storage` trên MinIO (Port 9000). Toàn bộ ảnh sinh trắc học và minh chứng điểm danh giờ đây được đẩy trực tiếp lên MinIO bucket.
  2. **Cách ly thư mục fallback bên ngoài Project (`STORAGE_LOCAL_DIR`)**:
     - Cấu hình `STORAGE_LOCAL_DIR=D:\DATN_VuTienDuc_2310900023\storage-uploads` và `ATTENDANCE_EVIDENCE_DIR=D:\DATN_VuTienDuc_2310900023\attendance-evidence` hoàn toàn nằm ngoài repository.
     - Bổ sung `uploads/` vào `.gitignore` để triệt tiêu mọi nguy cơ file media làm nặng git.
  3. **Đảo ngược quy trình Đăng ký (Post-Commit File Storage)**:
     - Đặt `registerFaceDescriptorForUser` chạy trước. Chỉ khi xác thực hợp lệ và ghi thành công vào database mới tiến hành lưu ảnh đại diện. Nếu bị từ chối (409) thì không lưu bất kỳ file nào.
     - Trước khi lưu ảnh mới, tự động dọn dẹp các tệp ảnh cũ của người dùng.
  4. **Cơ chế tự động dọn dẹp tệp đồng bộ (`deleteUserFaceFiles`)**:
     - Bổ sung hàm `deleteUserFaceFiles(userId)` trong `server/config/minio.js`.
     - Khi gọi xóa khuôn mặt (`removeFaceDescriptorForUser`), hệ thống tự động quét và xóa sạch 100% các file ảnh liên quan của nhân sự đó cả trên MinIO bucket và ổ cứng fallback.
  5. **Dọn dẹp triệt để thư mục `uploads/faces`**:
     - Đã di chuyển ảnh đại diện hợp lệ của ThS. Nguyễn Trọng An lên MinIO bucket `datn-qlns-storage`.
     - Xóa sạch 100% các file rác trong `uploads/faces` và gỡ bỏ tracking khỏi git index.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).
  - Trạng thái Storage: MinIO `datn-qlns-storage` bucket online; `uploads/faces` sạch sẽ 0 file rác.

### 81. Định Danh Ảnh MinIO Chuẩn Enterprise: face-<MãCánBộ>-<TênKhôngDấu>.jpg & Xóa Sạch File Khi Hủy Đăng Ký (20/10/2026)
- **Bối cảnh & Đề xuất**:
  - Thay vì đặt tên ảnh bằng chuỗi hash MongoDB khó đọc (`face-6ad5b083...jpg`), người dùng yêu cầu đặt tên ảnh trực quan theo Mã nhân viên hoặc Tên cán bộ, đồng thời giữ nguyên cơ chế tự động xóa sạch ảnh trên MinIO khi hủy đăng ký khuôn mặt.
- **Giải Pháp Triển Khai (Chuẩn Hóa Enterprise)**:
  1. **Công thức đặt tên file trực quan & duy nhất**:
     - `face-${cleanStaffCode}-${cleanSlugName}.jpg` (Ví dụ: `face-GV004-nguyen-trong-an.jpg`).
     - Tên file bao gồm **Mã Cán Bộ** (đảm bảo tính duy nhất 100% không trùng lặp) kết hợp với **Họ Tên không dấu** (chuẩn URL RFC 3986, loại bỏ dấu cách và ký tự đặc biệt).
     - Mở MinIO Console (`http://localhost:9001`) trong bucket `datn-qlns-storage` là nhận diện ngay lập tức ảnh thuộc về nhân sự nào.
  2. **Chuẩn hóa Metadata Header MinIO (Mã hóa US-ASCII)**:
     - Xử lý mã hóa `encodeURIComponent` cho các metadata đi kèm tệp (như `fullName`), ngăn chặn lỗi `Invalid character in header content` của giao thức S3/HTTP khi gặp tiếng Việt có dấu.
  3. **Nâng cấp cơ chế xóa đồng bộ (`deleteUserFaceFiles`)**:
     - Hàm `deleteUserFaceFiles(userId, staffCode, photoPath)` mở rộng quét và xóa sạch theo cả 3 tiêu chí: Mã cán bộ `faces/face-${staffCode}-*`, ID người dùng `faces/face-${userId}-*` và đường dẫn ảnh cụ thể trên MinIO bucket lẫn ổ cứng fallback.
     - Khi thực hiện hủy/xóa dữ liệu khuôn mặt trên Web, toàn bộ file ảnh tương ứng trên MinIO biến mất ngay lập tức.
  4. **Đồng bộ thực tế**:
     - Cập nhật ảnh đại diện của ThS. Nguyễn Trọng An trên MinIO thành `faces/face-GV004-nguyen-trong-an.jpg`.
     - Cập nhật trường `anh_khuon_mat` và `facePhoto` trong MongoDB collection `nguoi_dung`.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).
  - MinIO Bucket: `datn-qlns-storage/faces/face-GV004-nguyen-trong-an.jpg` online 100%.

### 82. Khắc Phục Lỗi Hiển Thị "Đã Có Face ID" Sau Khi Xóa & Tối Ưu Hóa Bộ Thu Thập Vector (Xóa Bỏ Lỗi Tụt % Ở 85%) (20/10/2026)
- **Bối cảnh & Đánh giá của Người Dùng**:
  1. *Lỗi hiển thị trạng thái Face ID*: Dữ liệu mẫu khuôn mặt đã xóa nhưng trên danh sách quản trị nhân sự vẫn hiển thị huy hiệu xanh `ĐÃ CÓ FACE ID`.
  2. *Lỗi khựng quét & tụt tiến trình*: Trong quá trình quét góc, khi người dùng giữ yên tư thế, tiến trình chạy đến khoảng 85% thì hay bị tụt xuống rồi lại nhảy lên, lặp lại nhiều lần mới hoàn tất chụp.
- **Phân Tích Nguyên Nhân Gốc (Root Cause Analysis)**:
  1. **Nguyên nhân lỗi hiển thị Face ID**:
     - Trong `server/services/user.service.js` (hàm `getUsers`), logic ánh xạ `isFaceReg` kiểm tra cả trường chuỗi ảnh: `Boolean(u.anh_khuon_mat) || Boolean(u.facePhoto)`.
     - Khi một nhân sự từng có đường dẫn ảnh lưu trữ trong document (ngay cả khi template trong `mau_khuon_mat` đã bị xóa sạch và `da_dang_ky_face = false`), biểu thức `Boolean(u.facePhoto)` vẫn trả về `true`, dẫn đến việc API gửi cờ `isFaceRegistered: true` về trình duyệt.
  2. **Nguyên nhân lỗi tụt % ở 85%**:
     - *Nhiễu dữ liệu thô (Raw Worker Jitter)*: Hàm `render60FpsHUD` truyền trực tiếp tọa độ thô chưa qua lọc `tYaw, tPitch` vào `checkAngleTargetMet` thay vì dùng giá trị nội suy mượt `yawDeg, pitchDeg`.
     - *Thuật toán Jitter Guard sai lệch điểm mốc*: Biến `lastStableYawRef` chỉ lưu mốc góc tại thời điểm bắt đầu (0ms). Trong suốt 1.2s, đầu người dùng tự nhiên dịch chuyển 3-4° (do nhịp thở/chớp mắt), thuật toán phát hiện $\Delta > 3.8^\circ$ so với mốc xuất phát và tự động reset mốc thời gian về 0, làm tụt tiến trình đúng lúc đạt ~80% - 85%.
     - *Thiếu vùng trễ (Hysteresis)*: Ranh giới góc quá khắt khe, chỉ cần 1 khung hình bị lệch 0.1° là tiến trình bị ngắt đột ngột.
- **Giải Pháp Kỹ Thuật Đã Triển Khai Toàn Diện**:
  1. **Chuẩn Hóa Nhận Diện Đăng Ký Sinh Trắc Học Tầng Backend**:
     - Sửa hàm `getUsers` trong `server/services/user.service.js`: Chỉ xác nhận `isFaceReg = true` khi thực sự có bản ghi FaceTemplate (`Boolean(t)`) hoặc cờ dữ liệu (`da_dang_ky_face / isFaceRegistered = true`). Tuyệt đối không dùng đường dẫn ảnh tĩnh để suy diễn trạng thái Face ID.
     - Nâng cấp `removeFaceDescriptorForUser` (`faceTemplate.service.js`): Bổ sung lệnh `$unset: { facePhoto: 1 }` để dọn sạch hoàn toàn các trường legacy trong MongoDB document khi hủy Face ID.
     - Chạy script làm sạch CSDL MongoDB: Xóa bỏ triệt để các trường ảnh mồ côi trên toàn bộ 14 tài khoản nhân sự chưa có FaceTemplate.
  2. **Giải Thuật Thu Thập Vector Mượt Mà & Cơ Chế Giữ Nhịp Trễ (Grace Buffer)**:
     - **Chuyển sang dùng góc nội suy**: Sử dụng `yawDeg, pitchDeg` (đã lọc qua Lerp $\alpha=0.35$) để triệt tiêu 100% rung giật frame.
     - **Vùng trễ Hysteresis (`isHolding`)**: Khi đang trong tiến trình giữ góc, hệ thống tự động nới rộng biên dung sai thêm $\pm 2.0^\circ$ (Ví dụ: Góc nghiêng trái giữ ở mức $\ge 9.0^\circ$ thay vì $\ge 11.0^\circ$), giúp người dùng không bao giờ bị rớt góc giữa chừng.
     - **Bộ đệm giữ nhịp 220ms (Grace Loss Buffer)**: Nếu người dùng chớp mắt hoặc rung nhẹ, hệ thống bảo lưu tiến trình hiện tại trong 220ms thay vì dập tắt ngay về 0%.
     - **Chốt Chặn Kiểm Định Tại Frame Bấm Máy 100% (Strict Shutter Gatekeeper)**:
       - Tại thời điểm chạm 100%, trước khi gọi lệnh chụp frame, hệ thống bắt buộc kiểm tra 2 điều kiện:
         1. *Đúng góc thực tế*: `checkAngleTargetMet(currentStepIndex, pose, yawDeg, pitchDeg, true) === true`.
         2. *Độ tĩnh khuôn mặt*: Vận tốc góc tức thời $\le 3.0^\circ/\text{frame}$ (đầu phải đứng yên).
       - Nếu người dùng đột ngột quay đầu đi nơi khác ở thời điểm 90-99%, hệ thống phát hiện vận tốc góc tăng cao ($> 4.5^\circ/\text{frame}$) và sai góc $\rightarrow$ **HỦY BỎ NGAY LẬP TỨC**, dập tắt tiến trình về 0% và từ chối chụp ảnh. Tuyệt đối không để lọt ảnh sai góc hoặc nhòe chuyển động vào CSDL.
- **Kiểm tra nghiệm thu**:
  - `npm test`: 18/18 Test Suites đạt 100% PASS.
  - `npm run build`: Biên dịch thành công 100% (0 lỗi TypeScript, 0 lỗi Vite bundle).
  - Trạng thái DB: GV004 ThS. Nguyễn Trọng An hiển thị chính xác "Chưa Đăng Ký" (isFaceRegistered: false).

---

### 83. Khắc Phục Lỗi Xung Đột Xóa Face ID MongoDB & Thiết Lập 4 Lớp Chốt Chặn Bắt Buộc Không Thể Xuyên Thủng (Quadruple Shutter Gatekeeper) (20/10/2026)
- **Vấn đề phát sinh thực tế**:
  1. *Lỗi không xóa được Face ID*: Khi người dùng bấm xóa dữ liệu khuôn mặt đã đăng ký, hệ thống hiển thị thông báo lỗi màu đỏ: `Updating the path 'anh_khuon_mat' would create a conflict at 'anh_khuon_mat'`.
  2. *Hiện tượng quét khó bắt & tụt tiến trình tại 85%*: Khi giữ nguyên tư thế, tiến trình chạy đến khoảng 85% lại tụt xuống rồi lại nhảy lên nhiều lần mới hoàn thành được một góc.
  3. *Hiện tượng chụp sai khi quay đầu ở 90% (ảnh chụp cả 5 góc bị biến thành mặt nhìn thẳng hoặc cúi đầu)*: Khi người dùng cố tình quay mặt về chính diện hoặc cúi/ngước đầu ở 90%, hệ thống vẫn chấp nhận và bấm chụp khung hình sai góc đó.
- **Phân tích nguyên nhân gốc rễ (Root Cause Analysis)**:
  1. *Nguyên nhân lỗi xung đột MongoDB*:
     - Trong `server/services/faceTemplate.service.js`, hàm `removeFaceDescriptorForUser` gọi `findByIdAndUpdate` với đồng thời `$set: { anh_khuon_mat: null, ... }` và `$unset: { facePhoto: 1 }`.
     - Do `facePhoto` là alias của `anh_khuon_mat` trong `user.model.js`, Mongoose dịch thành cả `$set` lẫn `$unset` trên cùng đường dẫn `anh_khuon_mat`, gây lỗi xung đột của MongoDB.
  2. *Nguyên nhân chụp sai góc khi người dùng quay mặt về chính diện*:
     - Trong hàm `checkAngleTargetMet`, tại các góc Nghiêng Trái, Nghiêng Phải, Ngước Lên, Cúi Xuống: Mã nguồn chỉ kiểm tra điều kiện loại trừ góc đối diện (`!p.includes('RIGHT')`), nhưng **quên không loại trừ tư thế chính diện (`CHINH_DIEN` / `STRAIGHT`)**.
     - Khi người dùng quay mặt về chính diện, `yawDeg` vẫn có thể dao động nhẹ $\approx 8.0^\circ$ do sai số webcam/landmark. Do không loại trừ `CHINH_DIEN`, hệ thống nhận định mặt chính diện là đạt chuẩn Nghiêng Trái/Phải và bấm máy chụp.
     - Trong nhánh `else` của hàm đếm 60 FPS, mã nguồn liên tục gán `lastTargetMetTimeRef.current = now`, dẫn tới bộ đếm thời gian mất góc luôn bằng 0, tạo vòng lặp vô tận giữ tiến trình ở 99% mà không chịu dập tắt về 0%.
- **Giải pháp kỹ thuật 4 lớp chốt chặn an toàn (Quadruple Shutter Gatekeeper)**:
  1. *Khắc phục triệt để lỗi xóa Face ID*:
     - Chuẩn hóa theo quy tắc **Canonical 1-to-1 Mapping** trong `faceTemplate.service.js` và `face.controller.js`: Chỉ cập nhật duy nhất các trường CSDL chuẩn tiếng Việt trong `$set: { da_dang_ky_face: false, anh_khuon_mat: null, ngay_dang_ky_face: null, ngay_dong_y_sinh_trac: null }`. Loại bỏ 100% `$unset` conflict.
  2. *Lớp 1 - Kiểm tra Pose Type Độc Quyền (Exclusive Pose Guard)*:
     - Góc Nghiêng Trái/Phải: Bắt buộc từ chối ngay lập tức nếu pose là `STRAIGHT` / `CHINH_DIEN` hoặc chứa hướng đối diện. Yêu cầu `yawDeg` thực tế phải đạt $\ge 10.5^\circ$ (Trái) hoặc $\le -10.5^\circ$ (Phải).
     - Góc Ngước Lên/Cúi Xuống: Bắt buộc từ chối ngay lập tức nếu pose là `STRAIGHT` / `CHINH_DIEN` hoặc sai hướng. Yêu cầu `pitchDeg` thực tế phải đạt $\ge 6.0^\circ$ (Ngước) hoặc $\le -6.0^\circ$ (Cúi).
  3. *Lớp 2 - Cơ chế Active Turn-Away Abort tức thời*:
     - Trong vòng lặp 60 FPS, nếu phát hiện người dùng đang ở góc nghiêng/ngước/cúi mà quay mặt về `STRAIGHT` / `CHINH_DIEN` hoặc hướng ngược lại $\rightarrow$ Hủy tiến trình về 0% ngay trong 1 frame duy nhất, khóa cửa trập tức thì.
     - Loại bỏ việc gán lại mốc thời gian trong nhánh `else`, đảm bảo sau 220ms không ổn định lại góc thì tiến trình bị reset sạch sẽ về 0%.
  4. *Lớp 3 - Khóa Cửa Trập Xác Minh AI Tươi (Active Shutter Interceptor)*:
     - Khi đạt 100%, client chuyển sang chờ frame AI mới nhất từ Python microservice. Cửa trập chỉ mở nếu frame AI tươi xác nhận vẫn giữ đúng góc theo tiêu chuẩn khắt khe (`isHolding = false`). Nếu frame mới nhất cho thấy đã quay đầu $\rightarrow$ Hủy lệnh chụp ngay lập tức.
  5. *Lớp 4 - Chốt Chặn Cuối Cùng Tại Hàm Bấm Máy (Final Shutter Gatekeeper)*:
     - Ngay tại hàm `triggerCaptureCurrentAngle`, trước khi vẽ canvas và trích xuất blob ảnh, hệ thống đọc trực tiếp dữ liệu nhận diện gần nhất. Nếu góc mặt không thỏa mãn điều kiện khắt khe, lệnh chụp bị hủy bỏ tức thì (`return`), phát tiếng Bíp cảnh báo và toast thông báo người dùng đã quay đầu trước khi chụp.
- **Tệp mã nguồn đã chỉnh sửa**:
  - `server/services/faceTemplate.service.js`: Chuẩn hóa $set Canonical, xóa bỏ $unset conflict.
  - `server/controllers/face.controller.js`: Chuẩn hóa Canonical 1-to-1 Mapping.
  - `src/components/biometrics/FaceRegistrationModal.tsx`: Tinh chỉnh logic gatekeeper và giải quyết triệt để lỗi MongoDB conflict.
  - `word.md`: Cập nhật chi tiết toàn bộ giải pháp kỹ thuật mục 83.

---

### 84. Tối Ưu Hóa Trải Nghiệm Thu Thập 5 Góc Khuôn Mặt: Bắt Đúng Vector, Ảnh HD Sắc Nét, Thời Gian Thực Tế Hợp Lệ & Triệt Tiêu Lỗi Tụt % Ở 85% (20/10/2026)
- **Bối cảnh & Yêu cầu tối ưu từ Người Dùng**:
  - *"chỉ cần tối ưu nhất thôi. không cần fix hẳn. chụp đúng vector, ảnh rõ nét, thời gian đăng ký thực tế hợp lệ"*:
  - Cần tinh giản tối đa các chốt chặn ngắt đột ngột (harsh abort) gây ức chế khi người dùng đang giữ yên góc; đảm bảo bắt đúng góc đặc trưng (Chính diện, Trái, Phải, Ngước, Cúi); ảnh lưu trữ đạt chuẩn HD sắc nét và tiến trình chạy 0% $\rightarrow$ 100% tự nhiên, mượt mà.
- **Phân Tích & Khắc Phục Triệt Để 3 Vấn Đề Gốc Rễ**:
  1. *Nguyên nhân tụt % ở 85% & khó bắt góc*:
     - Grace buffer cũ chỉ đặt 150ms, trong khi một chu kỳ request phân tích góc mặt qua mạng HTTP từ worker mất khoảng 80-160ms. Chỉ cần 1 frame mạng bị trễ nhẹ hoặc người dùng chớp mắt là hệ thống tự reset `holdStartTimeRef` về 0.
     - Hàm `checkAngleTargetMet` trước đây kiểm tra cứng điều kiện `p === 'CHINH_DIEN'`. Trong khi đó, Python `pose_estimator.py` quy ước bất kỳ góc nào $< 12^\circ$ đều là `chinh_dien`. Khi người dùng giữ góc ở dải dung sai Hysteresis ($10.0^\circ - 11.9^\circ$), chuỗi `CHINH_DIEN` lập tức phủ định và đánh rớt tiến trình.
     - **Giải pháp**:
       - Mở rộng Grace Buffer lên **400ms**: Chống hoàn toàn hiện tượng tụt tiến trình khi có frame trễ hoặc người dùng chớp mắt/thở nhẹ.
       - Tách độc lập `checkAngleTargetMet` dựa trên độ góc Euler liên tục (Continuous Degrees): Nghiêng Trái ($yaw \ge 10.5^\circ$, giữ ở $\ge 8.0^\circ$), Nghiêng Phải ($yaw \le -10.5^\circ$, giữ ở $\le -8.0^\circ$), Ngước Lên ($pitch \ge 6.2^\circ$, giữ ở $\ge 4.8^\circ$), Cúi Xuống ($pitch \le -6.2^\circ$, giữ ở $\le -4.8^\circ$), Chính diện ($|yaw| \le 7.5^\circ, |pitch| \le 7.5^\circ$). Không còn tình trạng chuỗi `CHINH_DIEN` phủ định sai.
  2. *Triệt tiêu chốt chặn hủy chụp đột ngột tại Frame 100%*:
     - Trước đây, khi người dùng đã giữ yên 1.0s và đạt 100%, hệ thống lại gọi thêm một lần kiểm tra thô từ `targetDataRef.current` với cờ khắt khe `isHolding = false`. Nếu góc thô của worker trễ 0.1° là hệ thống dập tắt và bắn toast: "Đã hủy chụp: Bạn đã quay mặt đi".
     - **Giải pháp**: Xóa bỏ hoàn toàn lớp ngắt đột ngột này. Khi người dùng đã giữ vững ổn định suốt 1.0 giây (100%), hệ thống lập tức bấm máy chụp và lưu ngay frame sắc nét.
  3. *Đảm bảo ảnh HD rõ nét & thời gian chuyển góc hợp lệ*:
     - Ảnh chụp từ luồng video canvas được lấy đúng độ phân giải phần cứng **1280x720 HD** với chất lượng nén JPEG **0.95**, hoàn toàn không bị nhòe mờ chuyển động do người dùng đã giữ yên 1.0s.
     - Tăng thời gian đệm chuyển góc lên **1300ms** (1.3s) kèm flash thành công và chỉ dẫn: người dùng có đủ thời gian đọc thông báo và thong thả chuyển tư thế sang góc tiếp theo, hoàn toàn không bị quét vội hay bắt nhầm ảnh góc trước.
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Biên dịch TypeScript và Vite bundle thành công **100% (0 lỗi TypeScript, 0 lỗi đóng gói)**.
  - `npm test`: Toàn bộ **18/18 Test Suites tự động đạt 100% PASS**.
  - Trải nghiệm đăng ký: Tiến trình 0% $\rightarrow$ 100% chạy êm ru, giữ góc thoải mái, không tụt phần trăm, tự động chuyển góc mượt mà.

---

## 📅 NGÀY 21/10/2026: XÂY DỰNG HOÀN CHỈNH TRANG THỜI KHÓA BIỂU & LỊCH CÔNG TÁC (SCHEDULES.TSX) CHUẨN CSDL v2.5

### 85. Hoàn Thiện Module Thời Khóa Biểu & Phân Công Giảng Dạy (Collection 6 - Schedule / lich_trinh)
- **Bối cảnh & Mục tiêu**:
  - Xây dựng hoàn chỉnh trang giao diện `src/pages/Schedules.tsx` thay thế `PlaceholderPage` tại route `/schedules`, đáp ứng đầy đủ nghiệp vụ giảng dạy đại học theo CSDL v2.5.
- **Các tính năng cốt lõi đã triển khai**:
  1. *3 Chế độ hiển thị trực quan (View Modes)*:
     - **Thời Khóa Biểu Tuần (Weekly Timetable Grid)**: Lưới 7 cột (Thứ 2 $\rightarrow$ Chủ Nhật), chia theo tiết học/ca dạy, thẻ lớp học hiển thị rõ tên môn, mã môn, giảng viên, phòng học, tiết (1-3, 4-6...), giờ bắt đầu - kết thúc, badge phân loại Chính khóa / Dạy bù và số lượng ngoại lệ.
     - **Lịch Tháng (Monthly Calendar View)**: Xem toàn bộ các buổi học diễn ra trong từng ngày của tháng theo khoảng hiệu lực `[startDate, endDate]` và thứ trong tuần, chuyển tháng trước / tháng sau / hôm nay linh hoạt.
     - **Bảng Danh Sách Phân Công (Table List View)**: Hiển thị dạng bảng quản trị đầy đủ cột thông tin: Thứ & Ca học, Môn học, Giảng viên, Phòng học, Tuần áp dụng, Thời gian hiệu lực, Loại lịch, kèm các nút thao tác nhanh (Xem chi tiết, Báo nghỉ/bù, Chỉnh sửa, Xóa).
  2. *Bộ chỉ số KPI Dashboard nhanh*:
     - Thống kê Tổng số lịch phân công, Lịch dạy hôm nay (tự động lọc theo ngày hiện tại), Buổi dạy bù (Make-up), và Số lượng ngoại lệ / báo nghỉ.
  3. *Bộ lọc & Tìm kiếm đa năng*:
     - Tìm kiếm từ khóa theo tên môn, mã môn, phòng học, tên giảng viên hoặc mã cán bộ.
     - Lọc theo Năm học (2025-2026, 2026-2027), Học kỳ (HK1, HK2, HK Hè), Giảng viên phụ trách (phân quyền Admin / Trưởng khoa) và Thứ trong tuần.
  4. *Modal Thêm / Chỉnh Sửa Lịch Phân Công Giảng Dạy*:
     - Điền đầy đủ dữ liệu theo schema CSDL v2.5: Giảng viên phụ trách, Môn học, Phòng học, Thứ trong tuần, Tiết bắt đầu (1-12) & Số tiết (1-6) (tự động tính giờ bắt đầu - kết thúc theo chuẩn tiết học đại học), Ca làm việc liên kết, Khoảng ngày hiệu lực, Loại lịch (`CHINH_KHOA` / `DAY_BU`), Ngày dạy bù.
     - Bộ nút chọn nhanh 15 tuần học (Tất cả, Tuần lẻ, Tuần chẵn, Xóa).
     - Xử lý và hiển thị thông báo lỗi trực quan khi gặp xung đột lịch 2 chiều từ backend (`SCHEDULE_ROOM_CONFLICT`, `SCHEDULE_LECTURER_CONFLICT`).
  5. *Modal Ghi Nhận Ngoại Lệ Buổi Học (Exception Modal)*:
     - Hỗ trợ giảng viên / quản trị viên báo nghỉ dạy (`NGHI`), hủy buổi (`HUY`), hoặc chuyển sang dạy bù (`DAY_BU`) kèm ngày dạy bù dự kiến, lý do chi tiết và lịch sử các ngoại lệ trước đó.
  6. *Modal Chi Tiết Lịch Phân Công (Detail Modal)*:
     - Hiển thị đầy đủ thông tin học phần, giảng viên, phòng học, ca học, tuần áp dụng và danh sách ngoại lệ.
  7. *Hoàn thiện API & Kiểu dữ liệu TypeScript*:
     - Bổ sung định tuyến `POST /api/schedules/:id/exceptions` vào `server/routes/schedule.routes.js`.
     - Xây dựng service `src/api/schedule.api.ts` bao bọc đầy đủ các hàm CRUD và ngoại lệ lịch.
     - Định nghĩa các interface chuẩn `ScheduleItem`, `ScheduleExceptionItem`, `CreateSchedulePayload`, `ScheduleQueryParams` trong `src/types/index.ts`.
     - Kết nối router `/schedules` trong `src/App.tsx`.
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Biên dịch TypeScript và đóng gói Vite thành công **100% (0 lỗi TypeScript, 0 lỗi cú pháp)**.
  - Toàn bộ codebase tuân thủ quy tắc Canonical 1-to-1 Mapping và sạch 100% file rác.

### 86. Cập Nhật Nhận Diện Thương Hiệu: Tích Hợp Logo Chính Thức Trường Đại Học Nguyễn Trãi (NTU)
- **Bối cảnh & Yêu cầu từ Người Dùng**:
  - Tích hợp hình ảnh logo chính thức của Trường Đại học Nguyễn Trãi (NTU) làm biểu tượng trường xuyên suốt toàn bộ ứng dụng web.
- **Các bước triển khai**:
  1. *Lưu trữ tài nguyên đồ họa*:
     - Sao chép và lưu trữ file ảnh logo gốc vào thư mục tài nguyên tĩnh `public/logo.png` và `public/ntu-logo.png`.
  2. *Cập nhật Favicon & Meta Tags*:
     - Thay thế icon favicon sang `/logo.png` và cập nhật tiêu đề trang `index.html`: *"NTU - Hệ Thống Quản Lý Nhân Sự & Chấm Công FaceID | Đại Học Nguyễn Trãi"*.
  3. *Tích hợp vào Thanh điều hướng chính (Sidebar)*:
     - Thay thế icon trừu tượng cũ bằng logo NTU sắc nét với khung viền bo góc nhẹ nhàng, cập nhật tên trường *"ĐH NGUYỄN TRÃI"* và slogan *"NTU Smart HR"*.
  4. *Tích hợp vào Trang Đăng Nhập (Login Page)*:
     - Hiển thị logo NTU trên thanh Topbar kèm tên *"TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU)"* và bổ sung banner logo NTU trang trọng trên đầu Form Đăng Nhập Cán Bộ / Giảng Viên.
  5. *Đồng bộ hóa Chân trang (Footer) & Bảng điều khiển (Dashboard)*:
     - Chân trang hiển thị icon logo NTU kèm *"Đại Học Nguyễn Trãi (NTU)"*; Hero banner trên Dashboard bổ sung huy hiệu nhận diện NTU.
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Đóng gói thành công **100% (0 lỗi TypeScript, 0 lỗi cú pháp Vite)**.

### 87. Thiết Kế Chuẩn Hóa Trang Danh Sách Cán Bộ & Giảng Viên (Users.tsx), Bổ Sung Phân Trang Đầy Đủ & Khắc Phục Hiển Thị / Tải Lên Avatar
- **Bối cảnh & Mục tiêu**:
  - Xây dựng và chuẩn hóa trang quản lý nhân sự `src/pages/Users.tsx` đồng bộ 100% phong cách thiết kế chuẩn của hệ thống (`FaceRegistrationPage.tsx`), tích hợp thanh phân trang đầy đủ và khắc phục triệt để việc hiển thị / tải lên ảnh đại diện (Avatar & FacePhoto).
- **Phân tích & Khắc phục gốc rễ lỗi không hiển thị Avatar**:
  1. *Nguyên nhân 1 (Chặn 401 trên thẻ `<img>`)*: Trong `server/controllers/upload.controller.js`, khi trình duyệt tải `<img src="/uploads/faces/face-..." />`, thẻ `<img>` mặc định không đính kèm header `Authorization: Bearer <token>`. Logic cũ chỉ cho phép công khai khi khớp trường `avatar`, còn `facePhoto` (`anh_khuon_mat`) bị đẩy vào `verifyToken` dẫn tới lỗi `401 Unauthorized`.
     - **Giải pháp**: Cập nhật `upload.controller.js` cho phép stream ảnh đại diện khi khớp bất kỳ trường nào trong `avatar`, `anh_dai_dien`, `facePhoto`, `anh_khuon_mat` của `User`.
  2. *Nguyên nhân 2 (Chưa đồng bộ `anh_dai_dien` khi đăng ký Face ID)*: Trong `server/controllers/face.controller.js` và `server/services/user.service.js`, khi đăng ký khuôn mặt 5 góc thành công, hệ thống lưu `anh_khuon_mat` lên MinIO nhưng chưa tự động gán vào `avatar` (`anh_dai_dien`) nếu nhân sự chưa có ảnh đại diện.
     - **Giải pháp**: Tự động đồng bộ `anh_dai_dien` từ ảnh chính diện `facePhotoUrl` khi đăng ký Face ID và dọn dẹp đồng bộ khi xóa dữ liệu sinh trắc học trong `faceTemplate.service.js`. Cập nhật `fetchUsers` trong `user.service.js` trả về đầy đủ `avatar` và `facePhoto`.
- **Các tính năng cốt lõi đã triển khai trên `src/pages/Users.tsx`**:
  1. *Chuẩn hóa giao diện đồng bộ 100% với `FaceRegistrationPage.tsx`*:
     - **Executive KPI Bar (4 thẻ chỉ số)**: Tổng cán bộ & giảng viên, Giảng viên & học hàm GS/PGS/TS, Đã đăng ký Face ID 512D (số lượng & %), Đơn vị Khoa / Phòng ban.
     - **Tách tên và chức danh thông minh (`formatNameAndTitle`)**: Tách chuỗi `"PGS. TS. Lê Hoàng Nam (Trưởng Khoa CNTT & CĐS)"` thành 2 dòng rõ ràng, chống tràn chữ.
     - **4 Chế độ hiển thị linh hoạt (Segmented View Switcher)**: `Bảng` (Table View 6 cột chuẩn), `Thẻ lưới` (Card Grid View), `Tinh gọn` (Compact List View) và `Theo Khoa` (Department Accordion Groups kèm thanh tiến độ % Face ID).
  2. *Thanh điều hướng Phân trang đầy đủ (Full Pagination Bar)*:
     - Hiển thị phạm vi bản ghi trực quan: *"Hiển thị X - Y trên tổng số Z cán bộ, giảng viên"*.
     - Bộ chọn số dòng mỗi trang (`5 / trang`, `10 / trang`, `20 / trang`, `50 / trang`).
     - Đầy đủ các nút điều hướng: Trang đầu (`ChevronsLeft`), Trang trước (`ChevronLeft`), Số trang thông minh có dấu rút gọn (`...`), Trang tiếp (`ChevronRight`), Trang cuối (`ChevronsRight`).
  3. *Component `StaffAvatar` thông minh & Tải ảnh đại diện trực tiếp*:
     - Hiển thị sắc nét ảnh thật từ MinIO (`/uploads/faces/...` hoặc `/api/uploads/...`), tự động fallback sang Avatar SVG chân dung + chữ cái viết tắt nếu nhân sự chưa có ảnh hoặc ảnh lỗi.
     - Hỗ trợ Quản trị viên **nhấn trực tiếp vào Avatar trên danh sách** hoặc trong **Modal Thêm/Sửa Cán Bộ** để tải ảnh đại diện mới từ máy tính (`POST /api/upload` qua `userApi.uploadAvatar`).
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Biên dịch TypeScript và đóng gói Vite thành công **100% (0 lỗi TypeScript, 0 lỗi cú pháp)**.

### 28. Nâng Cấp Toàn Diện Giao Diện Thời Khóa Biểu & Lịch Công Tác (`src/pages/Schedules.tsx` - Ba chế độ Tuần, Tháng, Bảng)
- **Thời gian thực hiện**: 21/10/2026
- **Mục tiêu**: Thiết kế lại và nâng cấp toàn bộ 3 chế độ hiển thị của trang Quản lý Thời Khóa Biểu (`src/pages/Schedules.tsx`) gồm **Thời Khóa Biểu Tuần**, **Lịch Tháng** và **Dạng Bảng** tham khảo tinh hoa từ `src_old/pages/Schedules.tsx` và `src_nhap/pages/TeamSchedule.tsx`, đồng bộ chuẩn CSDL v2.5.
- **Các hạng mục đã triển khai**:
  1. **Chế độ Thời Khóa Biểu Tuần (Weekly 2D Matrix View)**:
     - Bổ sung thanh điều hướng tuần (`Tuần trước`, `Tuần hiện tại`, `Tuần sau`), hiển thị khoảng ngày thực tế `DD/MM/YYYY — DD/MM/YYYY`, đánh dấu cột `Hôm nay` và nút chuyển đổi linh hoạt giữa **Hiển thị chuẩn toàn học kỳ** và **Lọc theo ngày tuần này**.
     - Hỗ trợ 2 chế độ ma trận con:
       - **Theo Ca Học (Sáng / Chiều / Tối)**: Ma trận 2 chiều gồm 3 dòng ca chuẩn đại học (`Ca Sáng: Tiết 1-5 • 07:00 - 11:30`, `Ca Chiều: Tiết 6-10 • 12:30 - 17:00`, `Ca Tối: Tiết 11-12 • 17:30 - 21:00`) $\times$ 7 cột ngày trong tuần (`Thứ Hai` $\rightarrow$ `Chủ Nhật`). Mỗi thẻ ca học có viền nhấn `border-l-4` phân màu theo loại lịch (`Chính khóa`, `Dạy bù`, `Ngoại lệ`), hiển thị tiết học, phòng học, tên & mã học phần, ảnh đại diện (`avatarUrl`) của giảng viên và nút thêm nhanh lịch trực tiếp tại ô trống.
       - **Theo Giảng Viên (Ma trận điều phối nhân sự)**: Ma trận 2 chiều hiển thị từng Giảng viên kèm ảnh đại diện, mã cán bộ, tổng số buổi/tuần, tổng số tiết/tuần và lịch chi tiết từng ngày từ Thứ Hai đến Chủ Nhật.
  2. **Chế độ Lịch Tháng (Monthly Calendar Matrix View)**:
     - Thiết kế lưới `grid-cols-7 gap-px` sắc nét, tích hợp bộ chọn nhanh Tháng / Năm, nút `Tháng trước | Tháng này | Tháng sau`, bộ đếm tổng số buổi trong tháng và chú giải màu sắc trực quan.
     - Mỗi ô ngày hiển thị huy hiệu ngày (nổi bật vòng sáng cho ngày Hôm nay, chữ đỏ cho Chủ Nhật), số lượng ca trong ngày (`X ca`), nút `+` thêm nhanh lịch vào ngày tương ứng và danh sách thẻ lịch thu gọn có phân biệt ngày phát sinh ngoại lệ (`NGHI`, `HUY`, `DAY_BU`).
  3. **Chế độ Dạng Bảng (Enterprise Table List View + Pagination)**:
     - Hiển thị bảng dữ liệu chuyên nghiệp gồm: Thứ & Ca giảng dạy (kèm nhãn `Ca Sáng / Ca Chiều / Ca Tối`), Học phần & số tín chỉ, Giảng viên phụ trách (kèm ảnh đại diện `avatarUrl` hoặc chữ viết tắt), Phòng học, Tuần áp dụng, Thời gian hiệu lực và Phân loại lịch.
     - Tích hợp **Thanh phân trang đầy đủ (Full Pagination Bar)**: Hiển thị phạm vi bản ghi (`Hiển thị X - Y trên tổng số Z lịch phân công`), bộ chọn kích thước trang (`10 / 20 / 50`) và nút chuyển trang thông minh.
     - Cập nhật `server/services/scheduleManagement.service.js` populate thêm `avatarUrl` (`anh_dai_dien`) và đồng bộ kiểu dữ liệu `ScheduleItem` trong `src/types/index.ts` theo đúng quy tắc Canonical 1-to-1 Mapping.
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Biên dịch TypeScript và đóng gói Vite thành công **100% (0 lỗi TypeScript, 0 lỗi cú pháp)**.

### 29. Xây Dựng Phân Hệ Quản Lý Cơ Cấu Tổ Chức: Khoa & Phòng Ban (`src/pages/Departments.tsx` & `server/services/department.service.js`)
- **Thời gian thực hiện**: 21/10/2026
- **Mục tiêu**: Xây dựng trang Quản lý Khoa, Bộ môn chuyên môn và Phòng ban chức năng chuẩn CSDL v2.5 (`phong_ban`: `khoa`, `bomon`, `phongban`), tích hợp sơ đồ phân cấp tổ chức đại học, tự động đồng bộ vai trò Trưởng khoa (`truongkhoa`) và thiết lập tọa độ Geofence chấm công.
- **Các hạng mục đã triển khai**:
  1. **Nâng cấp Backend Service & Controller (`server/services/department.service.js`, `server/controllers/department.controller.js`)**:
     - Bổ sung hàm `fetchDepartmentStatsMaps` sử dụng MongoDB Aggregation để thống kê tức thì số lượng cán bộ (`memberCount`) và số lượng học phần (`subjectCount`) theo từng đơn vị.
     - Cập nhật `formatDepartmentDoc`, `createDepartment` và `updateDepartment` hỗ trợ đầy đủ tọa độ Geofence (`latitude`, `longitude`, `radiusMeters` / `ban_kinh_met`) và populate thông tin Trưởng đơn vị (`fullName`, `email`, `staffCode`, `role`, `avatarUrl`, `isActive`).
  2. **Tạo tầng API & Types Frontend (`src/api/department.api.ts`, `src/types/index.ts`)**:
     - Định nghĩa `DepartmentItem`, `CreateDepartmentPayload`, `UpdateDepartmentPayload` và bộ client `departmentApi` kết nối chuẩn với `/api/v1/departments`.
  3. **Thiết kế giao diện `src/pages/Departments.tsx` & Tích hợp định tuyến `src/App.tsx`**:
     - **Executive KPI Cards**: Thống kê Tổng đơn vị tổ chức (kèm tỷ lệ đã bổ nhiệm Trưởng ĐV), Khoa đào tạo cấp 1, Bộ môn chuyên môn cấp 2, và Phòng ban chức năng.
     - **3 Chế độ hiển thị trực quan**:
       - **Sơ Đồ Phân Cấp (`tree`)**: Hiển thị khối Khoa đào tạo dạng Accordion mở rộng (gồm tổng nhân sự toàn Khoa, tổng học phần, bán kính GPS, Trưởng khoa và lưới các Bộ môn chuyên môn trực thuộc kèm nút `+ Thêm Bộ môn`), tách biệt rõ với khối Phòng ban chức năng trực thuộc Ban Giám Hiệu.
       - **Thẻ Lưới (`grid`)**: Thẻ đơn vị phân màu theo loại (`Khoa` xanh brand, `Bộ môn` tím indigo, `Phòng ban` xanh emerald) kèm thông tin người phụ trách và quy mô.
       - **Dạng Bảng (`table`)**: Bảng danh sách đầy đủ thông tin kèm **Thanh phân trang đầy đủ (Full Pagination Bar)**.
     - **3 Modal nghiệp vụ**:
       - *Modal Thêm / Chỉnh sửa đơn vị*: Tự động ràng buộc phân cấp CSDL v2.5 (`Khoa` và `Phòng ban` trực thuộc BGH `parentId = null`; `Bộ môn` bắt buộc chọn `Khoa` chủ quản), chọn Trưởng đơn vị và lấy tọa độ GPS Geofence trực tiếp từ trình duyệt.
       - *Modal Chi tiết đơn vị & Nhân sự trực thuộc*: Xem danh sách các Bộ môn con và danh sách toàn bộ Cán bộ, Giảng viên thuộc đơn vị kèm trạng thái đăng ký Face ID.
       - *Modal Xác nhận xóa an toàn*: Kiểm tra ràng buộc toàn vẹn nhân sự và đơn vị con trước khi xóa.
- **Kiểm tra nghiệm thu**:
  - `npm run build`: Biên dịch TypeScript và đóng gói Vite thành công **100% (0 lỗi TypeScript, 0 lỗi cú pháp)**.

---

## 📊 TỔNG HỢP TRẠNG THÁI KIỂM THỬ & NGHIỆM THU TOÀN DIỆN (TUẦN 1 -> TUẦN 8)

### Danh mục 18 Test Suites tự động (`npm test`) - Đạt 100% PASS:
1. `punchLogGeo.test.js`: Kiểm thử tọa độ GPS GeoJSON, index 2dsphere và SystemConfig $\rightarrow$ **PASS**.
2. `rbacAndTokenRotation.test.js`: Kiểm thử phân quyền RBAC 10 vai trò, nhiệm kỳ, ủy quyền và Token Rotation Grace Period 15s $\rightarrow$ **PASS**.
3. `payrollAndRevocation.test.js`: Kiểm thử Model Payroll và cơ chế Token Revocation in-memory $\rightarrow$ **PASS**.
4. `faceEnrollment.test.js`: Kiểm thử FaceTemplate 5 góc, $L_2$ Centroid, chống trùng lặp khuôn mặt và mã hóa AES-256-GCM $\rightarrow$ **PASS**.
5. `scheduleConflictAndRealtime.test.js`: Kiểm thử TKB học kỳ, chống xung đột giảng viên/phòng học, Margin Top 1-2 và Cooldown 60s $\rightarrow$ **PASS**.
6. `modelValidation.test.js`: Kiểm thử tính hợp lệ của các schema core (14 collections) $\rightarrow$ **PASS**.
7. `attendanceEvidence.test.js`: Kiểm thử xử lý và bảo mật ảnh minh chứng điểm danh $\rightarrow$ **PASS**.
8. `config.test.js`: Kiểm thử nạp biến môi trường và cấu hình hệ thống $\rightarrow$ **PASS**.
9. `leaveValidation.test.js`: Kiểm thử nghiệp vụ đơn nghỉ phép $\rightarrow$ **PASS**.
10. `farFrrBiometrics.test.js`: Thực nghiệm đo đạc FAR/FRR sinh trắc học, Margin Top 1-2, Geofence GPS Haversine và Auto Self-Healing RAM $\rightarrow$ **PASS**.
11. `leaveMultiLevelAndRetroactive.test.js`: Kiểm thử duyệt đơn đa cấp Khoa -> BGH, Chặn tự duyệt đơn (403), Optimistic Locking (409) và Hồi tố/Hoàn tác công $\rightarrow$ **PASS**.
12. `payrollSnapshotAndLock.test.js`: Kiểm thử Thuế TNCN lũy tiến 5 bậc, Snapshot tham số 2026, Khóa lương (isLocked / DA_KHOA) và xuất báo cáo Excel/PDF $\rightarrow$ **PASS**.
13. `aiAssistantMultiModelAndPolicy.test.js`: Kiểm thử AI Chatbot đa LLM (Gemini/Claude/DeepSeek/Local), Cơ sở tri thức Quy chế đại học 2026 và phân quyền tra cứu công $\rightarrow$ **PASS**.
14. `systemHealthAndAudit.test.js`: Kiểm thử AuditLog bất biến (Append-Only), SHA-256 Hash Chaining, Swagger OpenAPI 3.0 specs và cấu trúc Docker Containerization $\rightarrow$ **PASS**.
15. `redisAndDistributedCache.test.js`: Kiểm thử Redis Redlock phân tán, Grace Period Cache 15s và Cooldown quẹt thẻ 60s $\rightarrow$ **PASS**.
16. `minioObjectStorage.test.js`: Kiểm thử MinIO Object Storage, Presigned URL và lưu trữ minh chứng điểm danh $\rightarrow$ **PASS**.
17. `bullmqPunchQueue.test.js`: Kiểm thử BullMQ Queue, Fast Ingestion (< 50ms) và Worker Pipeline $\rightarrow$ **PASS**.
18. `socketRealtime.test.js`: Kiểm thử Socket.IO Realtime WebSocket, xác thực JWT Handshake và phát sự kiện điểm danh tức thì (< 10ms) $\rightarrow$ **PASS**.

### Kết quả kiểm tra biên dịch (`npm run build`):
- Toàn bộ mã nguồn TypeScript và Vite bundle biên dịch thành công **100% (0 lỗi TypeScript, 0 lỗi đóng gói)**.
