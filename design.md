# BẢN ĐẶC TẢ THIẾT KẾ TOÀN DIỆN HỆ THỐNG (DESIGN SPECIFICATION)
## HỆ THỐNG QUẢN LÝ NHÂN SỰ & CHẤM CÔNG SINH TRẮC HỌC AI (FACE ID 512D)
### TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU SMART HR & ATTENDANCE)

---

## MỤC LỤC
1. [Tổng Quan Dự Án & Kiến Trúc Công Nghệ](#1-tổng-quan-dự-án--kiến-trúc-công-nghệ)
2. [Hệ Thống Design System & Bảng Màu Nhận Diện](#2-hệ-thống-design-system--bảng-màu-nhận-diện)
3. [Quy Chuẩn Bố Cục Toàn Cục & Điều Hướng (Global Navigation & Layout)](#3-quy-chuẩn-bố-cục-toàn-cục--điều-hướng-global-navigation--layout)
4. [Đặc Tả Thiết Kế Chi Tiết Từng Phân Hệ](#4-đặc-tả-thiết-kế-chi-tiết-từng-phân-hệ)
   - [4.1. Bảng Điều Khiển Trung Tâm (Dashboard)](#41-bảng-điều-khiển-trung-tâm-dashboard)
   - [4.2. Trạm Điểm Danh AI Trực Tiếp (Face Attendance Kiosk)](#42-trạm-điểm-danh-ai-trực-tiếp-face-attendance-kiosk)
   - [4.3. Thu Thập & Đăng Ký Sinh Trắc Học 5 Góc (Face Registration)](#43-thu-thập--đăng-ký-sinh-trắc-học-5-góc-face-registration)
   - [4.4. Cơ Cấu Tổ Chức & Cây Phân Cấp Phòng Ban (Departments HRM Tree)](#44-cơ-cấu-tổ-chức--cây-phân-cấp-phòng-ban-departments-hrm-tree)
   - [4.5. Quản Lý Hồ Sơ Cán Bộ & Giảng Viên (Users Management)](#45-quản-lý-hồ-sơ-cán-bộ--giảng-viên-users-management)
   - [4.6. Quản Lý Chấm Công Toàn Trường & Cá Nhân (Attendance Manage & Me)](#46-quản-lý-chấm-công-toàn-trường--cá-nhân-attendance-manage--me)
   - [4.7. Lịch Giảng Dạy & Thời Khóa Biểu (Schedules & Timetable)](#47-lịch-giảng-dạy--thời-khóa-biểu-schedules--timetable)
   - [4.8. Quản Lý Đơn Xin Nghỉ Phép (Leave Requests Workflow)](#48-quản-lý-đơn-xin-nghỉ-phép-leave-requests-workflow)
   - [4.9. Quản Lý Ca Làm Việc, Ngày Lễ & Cấu Hình (Shifts, Holidays, Settings)](#49-quản-lý-ca-làm-việc-ngày-lễ--cấu-hình-shifts-holidays-settings)
   - [4.10. Hồ Sơ Cá Nhân & Quản Trị Bảo Mật Sinh Trắc Học (Profile & Security)](#410-hồ-sơ-cá-nhân--quản-trị-bảo-mật-sinh-trắc-học-profile--security)
5. [Quy Chuẩn CSDL v2.5 Thuần Việt & Ánh Xạ Alias (Canonical 1-to-1 Mapping)](#5-quy-chuẩn-csdl-v25-thuần-việt--ánh-xạ-alias-canonical-1-to-1-mapping)
6. [Ma Trận Phân Quyền Vai Trò (RBAC Matrix)](#6-ma-trận-phân-quyền-vai-trò-rbac-matrix)

---

## 1. TỔNG QUAN DỰ ÁN & KIẾN TRÚC CÔNG NGHỆ

### 1.1. Mục Tiêu Dự Án
Xây dựng nền tảng Quản trị Nhân sự (HRM) và Điểm danh thông minh thế hệ mới dành riêng cho môi trường Giáo dục Đại học (Đại học Nguyễn Trãi). Hệ thống số hóa toàn diện quy trình quản lý giảng viên, phòng ban, thời khóa biểu và ứng dụng thị giác máy tính AI nhận diện khuôn mặt đa góc (512-dimension vector) kết hợp định vị GPS Geofence để chống gian lận chấm công.

### 1.2. Tech Stack 3 Lớp (Three-Tier Enterprise Architecture)
```
[ Client / Web Browser ]
      │ (React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons)
      ▼
[ Node.js Backend Gateway - Port 5000 ]
      │ (Express + Mongoose + JWT Rotation + MinIO S3 SDK + Redis Fallback)
      ├───────────────────────────────┬───────────────────────────────┐
      ▼                               ▼                               ▼
[ MongoDB Database ]        [ MinIO Object Storage ]      [ Python AI Microservice ]
(14 Collections v2.5)       (Bucket: datn-qlns-storage)   (FastAPI - Port 8000)
                            - /faces/ (Ảnh sinh trắc)      - InsightFace 512D
                            - /evidence/ (Minh chứng)      - FAISS Vector Index (RAM)
                                                          - MediaPipe 3D Pose
```

---

## 2. HỆ THỐNG DESIGN SYSTEM & BẢNG MÀU NHẬN DIỆN

### 2.1. Brand Palette & Semantic Colors (Bảng Màu Nhận Diện)
| Token | Màu / HEX Code | Ứng Dụng Trong Hệ Thống |
| :--- | :--- | :--- |
| **Brand Primary (Blue)** | `#0284c7` (brand-600) / `#0369a1` (brand-700) | Nhận diện thương hiệu ĐH Nguyễn Trãi, nút hành động chính (Primary Button), Active Sidebar, Tab tuyển chọn. |
| **Accent Indigo (Neon)** | `#6366f1` (indigo-500) / `#4f46e5` (indigo-600) | Nhận diện Khối Bộ môn, Tia quét AI Laser, Khung ngắm HUD camera đang phân tích, tính năng cao cấp. |
| **Success Emerald** | `#10b981` (emerald-500) / `#059669` (emerald-600) | Nhận diện Khối Phòng ban, Trạng thái "Đúng giờ", "Điểm danh thành công", "Đã có Face ID", "Đã duyệt đơn". |
| **Warning Amber** | `#f59e0b` (amber-500) / `#d97706` (amber-600) | Trạng thái "Đi muộn", "Về sớm", "Chờ duyệt giải trình", Thời gian giãn cách quét Cooldown (3s). |
| **Danger Rose** | `#f43f5e` (rose-500) / `#e11d48` (rose-600) | Trạng thái "Nghỉ không phép", "Từ chối duyệt", "Lỗi Face ID / Ngoài GPS", Nút Xóa dữ liệu nguy hiểm. |
| **Dark Slate (Background)**| `#0f172a` (slate-900) / `#020617` (slate-950) | Nền Dark Mode chuyên nghiệp, Kiosk Terminal toàn cảnh, bề mặt Card bóng kính. |
| **Surface Neutral** | `#f8fafc` (slate-50) / `#ffffff` (white) | Nền Light Mode, viền bo thẻ card, đường phân chia ngăn cách. |

### 2.2. Typography (Quy Chuẩn Chữ)
- **Font Gia Đình**: `Inter`, `Roboto`, `system-ui`, `-apple-system`, `sans-serif`.
- **Cấp Độ Tiêu Đề**:
  - `H1 (Page Title)`: `text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100` (24px).
  - `H2 (Section Title)`: `text-lg font-bold text-slate-900 dark:text-slate-100` (18px).
  - `H3 (Card Title)`: `text-base font-bold text-slate-800 dark:text-slate-200` (16px).
  - `Body / Cell Text`: `text-xs text-slate-600 dark:text-slate-300` (12px).
  - `Meta / Badge`: `text-[10px] - text-[11px] font-semibold uppercase tracking-wider` (10-11px).
  - `Mã Cán Bộ & Timestamp`: `font-mono tracking-tight` (chữ số cố định độ rộng, không nhảy rung layout).

### 2.3. Quy Chuẩn Bo Góc & Bóng Đổ (Elevation & Radius Tokens)
- `rounded-xl` (12px): Áp dụng cho các ô input, button nhỏ, dropdown menu, icon container.
- `rounded-2xl` (16px): Áp dụng cho các Thẻ Card KPI, Hộp thoại xác nhận nhỏ, Thẻ nhân sự.
- `rounded-3xl` (24px): Áp dụng cho Khung hình Kiosk Camera, Modal nghiệp vụ lớn, Banner Header.
- `shadow-xs` / `shadow-sm`: Bóng đổ nhẹ nhàng cho trạng thái bình thường.
- `shadow-md` / `shadow-lg`: Nổi bật khi rê chuột (`hover:shadow-md`) hoặc trạng thái Modal nổi.
- `shadow-[0_0_20px_rgba(...)]`: Phát sáng ánh hào quang Neon (Glow effect) cho HUD Camera.

---

## 3. QUY CHUẨN BỐ CỤC TOÀN CỤC & ĐIỀU HƯỚNG (GLOBAL NAVIGATION & LAYOUT)

### 3.1. Sidebar Điều Hướng Kép (Desktop Sticky vs Mobile Overlay)
- **Desktop (`lg:block`)**:
  - `lg:sticky lg:top-0 lg:h-screen lg:shrink-0`: Cố định 100% bên trái khi trang cuộn chuột.
  - Chế độ Mở rộng (`w-64`) & Thu gọn (`w-20`) mượt mà qua CSS `transition-[width] 300ms`.
  - Lưu trạng thái thu gọn vào `localStorage` (`ntu_sidebar_collapsed`).
  - Danh mục menu cuộn độc lập bên trong với lớp tiện ích `.no-scrollbar` (ẩn hoàn toàn vạch cuộn thô xám).
  - Logo chính thức NTU ở đỉnh thanh, khối định danh tài khoản và nút Đăng xuất ở chân thanh.
- **Mobile (`< lg`)**:
  - `fixed inset-y-0 left-0 z-50`: Menu trượt dạng ngăn kéo (Drawer) kèm lớp phủ mờ `bg-slate-900/60 backdrop-blur-sm`.
  - Khóa cuộn trang `body.overflow-hidden` khi menu mở trên điện thoại/máy tính bảng.

### 3.2. Quy Tắc Triệt Tiêu Thanh Lướt Ngang Bảng Dữ Liệu (Zero Horizontal Scrollbar Rule)
- Toàn bộ các bảng danh sách dữ liệu (Dashboard, Users, LeaveRequests, Schedules, Attendance) bắt buộc áp dụng cấu trúc:
  - `table-fixed w-full`: Khóa cố định chiều rộng bảng 100% bằng màn hình cha.
  - Phân bổ tỷ lệ cột bằng thẻ `<colgroup><col className="w-[...%]" />...</colgroup>`.
  - Tinh gọn cột Cán bộ/Giảng viên xuống mức **15% - 18%** với Avatar kích thước 28px - 32px.
  - Tách tên và chức danh thành 2 dòng rõ ràng: Họ tên in đậm dòng trên, chức danh trong ngoặc đặt cạnh mã cán bộ dòng dưới.
  - Cắt chữ an toàn với `truncate` kết hợp tooltip khi rê chuột.
  - Tuyệt đối không để phát sinh thanh cuộn ngang (`overflow-x-auto` thô thiển) trên các màn hình làm việc thông dụng.

---

## 4. ĐẶC TẢ THIẾT KẾ CHI TIẾT TỪNG PHÂN HỆ

### 4.1. BẢNG ĐIỀU KHIỂN TRUNG TÂM (DASHBOARD)
- **Mục tiêu**: Trung tâm chỉ huy thông tin hiển thị tình hình quân số, tiến độ giảng dạy và nhật ký chấm công thời gian thực.
- **Thành phần giao diện**:
  1. *Hero Executive Banner*: Huy hiệu nhận diện ĐH Nguyễn Trãi, lời chào cá nhân hóa theo chức vụ, hiển thị thời gian số thực tế.
  2. *Bộ 4 Thẻ KPI Thời Gian Thực*:
     - Tổng quân số cán bộ / giảng viên.
     - Số nhân sự đang có mặt trong ca.
     - Số trường hợp đi muộn / về sớm.
     - Số lượt xin nghỉ phép trong ngày.
  3. *Biểu Đồ Donut SVG Tỉ Lệ Đi Làm*:
     - Vẽ bằng đường tròn SVG chuẩn xác (`stroke-dasharray`, `stroke-dashoffset`), hiển thị trực quan % Đúng giờ (Xanh lá), % Đi muộn (Vàng hổ phách), % Vắng mặt (Đỏ).
  4. *Bảng Điểm Danh Realtime Trực Tiếp*:
     - `table-fixed w-full`, tích hợp cột Thời gian (Vào - Ra) 2 dòng mono, hiển thị ảnh bằng chứng sinh trắc học và vị trí GPS.

---

### 4.2. TRẠM ĐIỂM DANH AI TRỰC TIẾP (FACE ATTENDANCE KIOSK)
- **Mục tiêu**: Màn hình dành cho máy trạm (Kiosk / iPad / Webcam) đặt tại cổng trường, văn phòng khoa để cán bộ/giảng viên tự động quét mặt chấm công trong 0.5 giây.
- **Đặc tả màu sắc & HUD Camera**:
  - **Khung hình 16:9 bo góc `rounded-3xl`**: Lật gương `transform -scale-x-100`.
  - **4 Góc HUD Kim Loại**: Tự động đổi màu theo 5 trạng thái:
    - *Chờ (Idle)*: Viền trắng mờ `border-white/50`, radar xanh cyan.
    - *Đang nhận diện (Scanning)*: Tím Neon `border-indigo-400 shadow-[0_0_15px_#6366f1]`, tia laser chạy quét dọc khuôn mặt.
    - *Thành công (Success)*: Xanh lá Emerald `border-emerald-400 shadow-[0_0_25px_#10b981]`, hiệu ứng pháo hoa giấy confetti.
    - *Từ chối / Lỗi (Error)*: Đỏ Rose `border-rose-400 shadow-[0_0_20px_#f43f5e]`, camera rung giật nhẹ cảnh báo.
    - *Giãn cách (Cooldown)*: Vàng Hổ Phách `border-amber-400` đếm ngược 3 giây chống quét đúp.
  - **Pill Trạng Thái Nổi (Frosted Glass Pill)**: Nằm giữa phía dưới camera, kính mờ `backdrop-blur-md` hiển thị thông điệp tức thời.
- **Bảng Kết Quả Thẻ Nhân Sự (Realtime Punch Card)**:
  - Avatar HD, Họ tên, Mã cán bộ, Khoa/Bộ môn, Khung giờ ca dạy, Độ tin cậy AI (Ví dụ: `99.2% khớp`), Bán kính GPS Geofence hợp lệ.
- **Dải Băng Chuyền Lượt Quét Gần Nhất (Live Attendance Ticker)**:
  - Liệt kê 8 lượt chấm công mới nhất trôi mượt mà từ trên xuống.

---

### 4.3. THU THẬP & ĐĂNG KÝ SINH TRẮC HỌC 5 GÓC (FACE REGISTRATION)
- **Mục tiêu**: Hướng dẫn cán bộ/giảng viên đăng ký hồ sơ khuôn mặt chuẩn 512D với độ chính xác cao nhất.
- **Quy trình 5 Góc Nhìn**:
  1. *Chính Diện (Straight)*: Bắt chuẩn điểm mốc mắt, mũi, miệng.
  2. *Nghiêng Trái (Turn Left)*: Độ quay Euler Yaw $\ge 10.5^\circ$.
  3. *Nghiêng Phải (Turn Right)*: Độ quay Euler Yaw $\le -10.5^\circ$.
  4. *Ngước Lên (Look Up)*: Độ ngửa Euler Pitch $\ge 6.2^\circ$.
  5. *Cúi Xuống (Look Down)*: Độ cúi Euler Pitch $\le -6.2^\circ$.
- **Kỹ thuật Decoupled 60 FPS & Lerp Smoothing**:
  - Tách luồng vẽ Canvas 60 FPS khỏi worker phân tích AI ngầm.
  - Nội suy tuyến tính Lerp ($\alpha = 0.35$) chống giật lắc khung ngắm.
  - Tiến trình giữ góc mượt mà theo mili-giây (0% $\rightarrow$ 100%), vùng trễ Hysteresis chống tụt % giữa chừng.
  - Chụp ảnh chất lượng cao 1280x720 HD, lưu trữ định danh chuẩn Enterprise: `face-<MãCánBộ>-<TênKhôngDấu>.jpg` trên MinIO.

---

### 4.4. CƠ CẤU TỔ CHỨC & CÂY PHÂN CẤP PHÒNG BAN (DEPARTMENTS HRM TREE)
- **Mục tiêu**: Mô phỏng cơ cấu tổ chức phân cấp đại học chuẩn quốc tế (MISA / Base HRM).
- **Kiến trúc Split-View 2 Cột**:
  - **Cột Trái (35% - Cây Thư Mục Tổ Chức)**:
    - Ô tìm kiếm nhanh đơn vị, nút Mở hết / Thu lại.
    - *Gốc (Root)*: Ban Giám Hiệu • ĐH Nguyễn Trãi.
    - *Nhánh 1*: Khối Khoa Đào Tạo ➔ Các Khoa Cấp 1 ➔ Các Bộ Môn Cấp 2 nối cành chữ L (`└──`).
    - *Nhánh 2*: Khối Phòng Ban Chức Năng ➔ Các Phòng ban hành chính trực thuộc BGH.
    - Hiển thị đầy đủ số lượng nhân sự: Khoa (`X CB/GV`), Bộ môn (`Y GV`), Phòng ban (`Z CB`).
  - **Cột Phải (65% - Bảng Điều Khiển Động Đơn Vị Đang Chọn)**:
    - Hồ sơ Trưởng đơn vị phụ trách (Avatar, học hàm, học vị, nút bổ nhiệm).
    - Cấu hình Geofence GPS: Vĩ độ, Kinh độ, Bán kính hợp lệ (mét) cho chấm công di động.
    - Danh sách các Bộ môn trực thuộc (kèm số lượng giảng viên).
    - Bảng danh sách Cán bộ, Giảng viên trực thuộc kèm trạng thái Face ID.

---

### 4.5. QUẢN LÝ HỒ SƠ CÁN BỘ & GIẢNG VIÊN (USERS MANAGEMENT)
- **Mục tiêu**: Quản lý toàn diện hồ sơ nhân sự, học hàm GS/PGS, học vị TS/ThS, ngạch lương và vai trò.
- **Tính năng nổi bật**:
  - 4 Chế độ hiển thị: Dạng Bảng chuẩn, Dạng Lưới Thẻ, Dạng Danh sách tinh gọn, Dạng Nhóm theo Khoa.
  - Avatar thông minh `StaffAvatar`: Hiển thị ảnh thật từ MinIO, tự động fallback chữ cái viết tắt, hỗ trợ tải ảnh trực tiếp khi nhấn vào avatar.
  - Thanh phân trang đầy đủ: Số dòng mỗi trang (5, 10, 20, 50), nút chuyển trang đầu, trước, số trang rút gọn `...`, tiếp, cuối.

---

### 4.6. QUẢN LÝ CHẤM CÔNG TOÀN TRƯỜNG & CÁ NHÂN (ATTENDANCE MANAGE & ME)
- **AttendanceManage (Dành cho Quản trị viên & Trưởng khoa)**:
  - Bảng tổng hợp công tháng theo nhân sự: Tổng ngày công, Giờ làm việc, Số lần đi muộn, Về sớm, Vắng mặt.
  - Bộ lọc thông minh theo Khoa, Bộ môn, Tháng/Năm, Loại nhân sự (Giảng viên / Hành chính).
  - Phê duyệt giải trình chấm công quên check-in/check-out.
  - Xuất báo cáo bảng chấm công định dạng Excel / PDF.
- **AttendanceMe (Dành cho Cá nhân Cán bộ / Giảng viên)**:
  - Thẻ chấm công cá nhân hôm nay: Nút bấm Điểm danh nhanh (kèm kiểm tra GPS và chụp camera selfie).
  - Lịch tháng chấm công trực quan: Ngày công hợp lệ (Xanh), Muộn/Về sớm (Vàng), Vắng (Đỏ), Nghỉ lễ (Tím).
  - Đơn giải trình chấm công khi quên điểm danh.

---

### 4.7. LỊCH GIẢNG DẠY & THỜI KHÓA BIỂU (SCHEDULES & TIMETABLE)
- **Mục tiêu**: Quản lý lịch phân công giảng dạy các môn học theo tiết (1-12), phòng học, ca học và giảng viên.
- **3 Chế độ hiển thị trực quan**:
  - *Thời Khóa Biểu Tuần (Weekly Timetable Grid)*: Lưới 7 cột (Thứ 2 $\rightarrow$ Chủ Nhật), thẻ học phần hiển thị phòng học, số tiết, giờ học.
  - *Lịch Tháng 7 Cột (Month Calendar View)*: Xem toàn bộ các ca học trong tháng, popup xem chi tiết ngày có nhiều ca học.
  - *Bảng Danh Sách Phân Công (Table List View)*: Quản trị tìm kiếm, thêm mới, sửa, xóa và báo nghỉ bù buổi học.
- **Cơ chế chống xung đột lịch 2 chiều**: Cảnh báo tức thì nếu giảng viên bị trùng giờ hoặc phòng học đã có lớp khác đăng ký.

---

### 4.8. QUẢN LÝ ĐƠN XIN NGHỈ PHÉP (LEAVE REQUESTS WORKFLOW)
- **Mục tiêu**: Số hóa quy trình gửi đơn, duyệt phép của Cán bộ / Giảng viên.
- **Quy trình duyệt 2 cấp chuẩn đại học**:
  - *Cấp 1*: Trưởng Bộ Môn / Trưởng Khoa / Trưởng Phòng Ban xem xét, duyệt sơ bộ.
  - *Cấp 2*: Ban Giám Hiệu / Phòng Tổ Chức Cán Bộ duyệt chính thức và trừ hạn ngạch phép năm.
- **Giao diện bảng đơn nghỉ phép**:
  - `table-fixed w-full`, không thanh cuộn ngang.
  - Badge trạng thái dáng ngang sang trọng: Chờ duyệt (Vàng), Đã duyệt (Xanh), Từ chối (Đỏ), Đã hủy (Xám).
  - Tách dòng thời gian nghỉ rõ ràng (Từ ngày ➔ Đến ngày).

---

### 4.9. CA LÀM VIỆC, NGÀY LỄ & CẤU HÌNH (SHIFTS, HOLIDAYS, SETTINGS)
- **Ca Làm Việc (Shifts)**: Cấu hình giờ bắt đầu, giờ kết thúc, thời gian cho phép đi muộn (phút), thời gian bắt đầu tính làm thêm giờ.
- **Ngày Nghỉ Lễ (Holidays)**: Quản lý danh mục ngày lễ quốc gia, ngày nghỉ truyền thống của trường (hưởng nguyên lương).
- **Cài Đặt Hệ Thống (Settings - Chỉ Admin IT)**: Quản lý tọa độ Geofence trường, cấu hình ngưỡng nhận diện AI Cosine Similarity (mặc định 0.68), cấu hình MinIO, thông tin máy chủ.

---

### 4.10. HỒ SƠ CÁ NHÂN & QUẢN TRỊ BẢO MẬT SINH TRẮC HỌC (PROFILE & SECURITY)
- **Mục tiêu**: Cung cấp trung tâm quản lý tự phục vụ (Self-Service Center) cho toàn bộ cán bộ, giảng viên và nhân viên nhà trường để tra cứu hồ sơ lý lịch, cập nhật thông tin liên lạc, theo dõi trạng thái dữ liệu sinh trắc học Face ID và quản lý bảo mật tài khoản.
- **Tuyến đường (Route)**: `/profile` (truy cập từ Header User Menu hoặc Sidebar User Block).
- **Cấu trúc 3 Tab nghiệp vụ chuyên biệt**:
  1. **Tab 1: Thông Tin Cá Nhân & Công Tác (HRM Info)**:
     - *Hồ sơ công tác cố định (Read-only HRM)*: Mã số cán bộ (`staffCode`), Khoa/Phòng ban trực thuộc (`departmentName`), Chức danh/Học hàm học vị, Email trường cấp (`@ntu.edu.vn`), Vai trò hệ thống (RBAC Role badge).
     - *Thông tin cá nhân được phép chỉnh sửa*: Họ và tên (`fullName`), Số điện thoại di động (`phoneNumber`), Ngày sinh (`dateOfBirth`), Giới tính (`gender`: NAM / NU / KHAC), Địa chỉ thường trú (`address`).
     - *Luồng dữ liệu (Data Flow)*: Nhấn "Chỉnh Sửa Hồ Sơ" $\rightarrow$ Mở khóa các input $\rightarrow$ Nhấn "Lưu Thay Đổi" $\rightarrow$ Gửi payload `PUT /api/users/:id` $\rightarrow$ Tự động đồng bộ `fetchMe()` nạp dữ liệu mới vào `useAuthStore` toàn cục $\rightarrow$ Cập nhật tức thì trên Header và Sidebar.
  2. **Tab 2: Sinh Trắc Học Face ID (Biometric Face Data)**:
     - *Chân dung nhận diện*: Hiển thị ảnh chụp trực diện mới nhất (`avatar` / `anh_khuon_mat`) được trích xuất từ bộ mẫu 5 góc.
     - *Trạng thái vector AI*: Badge trạng thái xanh "Face ID Sẵn Sàng" hoặc vàng "Chưa Có Face ID".
     - *Đặc tả mô hình AI*: InsightFace ArcFace (512D Vector) đối soát với FAISS index trên RAM.
     - *Tuân thủ pháp lý*: Hiển thị trạng thái cam kết bảo vệ dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP của Chính phủ.
     - *Hành động nhanh*: Nút "Kiểm Thử Điểm Danh" chuyển hướng tức thì sang `/face-attendance` để cán bộ tự kiểm tra độ nhạy nhận diện.
  3. **Tab 3: Bảo Mật & Đổi Mật Khẩu (Security & Password)**:
     - *Biểu mẫu đổi mật khẩu*: Trường "Mật khẩu hiện tại", "Mật khẩu mới" (bắt buộc $\ge 6$ ký tự), "Xác nhận mật khẩu mới".
     - *Bảo vệ giao diện*: Nút toggle Ẩn/Hiện mật khẩu (`Eye`/`EyeOff`), kiểm tra validation khớp mật khẩu ở Client trước khi gửi API.
     - *Luồng backend*: Gửi `POST /api/auth/change-password` $\rightarrow$ Xác thực hash bcrypt của mật khẩu cũ $\rightarrow$ Hash mật khẩu mới với Salt rounds $\rightarrow$ Thu hồi và cấp phát lại token mới (Token Rotation).
- **Quy chuẩn thiết kế giao diện**: Header phẳng tối giản (~56px), Avatar 44px sắc nét, triệt tiêu 100% banner gradient màu mè, chuẩn responsive trên cả Desktop và Mobile.

---

## 5. QUY CHUẨN CSDL v2.5 THUẦN VIỆT & ÁNH XẠ ALIAS (CANONICAL 1-TO-1 MAPPING)

Hệ thống tuân thủ nghiêm ngặt nguyên tắc **duy nhất 14 collections tiếng Việt**, chuẩn hóa trường dữ liệu:

| STT | Tên Collection MongoDB | Tên Model Mongoose | Mô Tả Nghiệp Vụ Cốt Lõi |
| :---: | :--- | :--- | :--- |
| **1** | `nguoi_dung` | `User` | Hồ sơ cán bộ giảng viên, tài khoản, ngạch bậc, `don_vi_chinh_id`. |
| **2** | `phong_ban` | `Department` | Cây tổ chức: Khoa, Bộ môn, Phòng ban, `don_vi_cha_id`, Geofence GPS. |
| **3** | `mau_khuon_mat` | `FaceTemplate` | Vector đặc trưng 512D, centroid vector, chất lượng ảnh sinh trắc. |
| **4** | `luot_quet_cham_cong` | `AttendancePunch` | Dữ liệu chấm công thô: giờ quét, ảnh bằng chứng, tọa độ GPS, Face AI. |
| **5** | `nhat_ky_cham_cong` | `AttendanceDaily` | Bảng công ngày tổng hợp: giờ vào, giờ ra, số công, đi muộn, về sớm. |
| **6** | `ca_lam_viec` | `Shift` | Khung ca làm việc hành chính & ca giảng dạy tiết học đại học. |
| **7** | `lich_trinh` | `Schedule` | Thời khóa biểu phân công giảng dạy môn học, phòng học, tuần học. |
| **8** | `mon_hoc` | `Subject` | Danh mục học phần đào tạo, số tín chỉ, `phong_ban_id` bộ môn quản lý. |
| **9** | `don_nghi_phep` | `LeaveRequest` | Đơn xin nghỉ phép, nghỉ ốm, công tác, quy trình phê duyệt. |
| **10** | `ngay_nghi_le` | `Holiday` | Lịch nghỉ lễ, tết, sự kiện trường học. |
| **11** | `phieu_luong` | `Payroll` | Bảng tính lương, hệ số lương, phụ cấp, giảm trừ gia cảnh, bảo hiểm. |
| **12** | `nhat_ky_kiem_toan` | `AuditLog` | Nhật ký bảo mật ghi vết toàn bộ hành vi CRUD trên hệ thống. |
| **13** | `ma_lam_moi` | `RefreshToken` | Quản lý phiên đăng nhập an toàn, cơ chế luân phiên Refresh Token (RTR). |
| **14** | `cau_hinh_he_thong` | `SystemConfig` | Cấu hình tham số AI, bán kính Geofence, chính sách chấm công. |

---

## 6. MA TRẬN PHÂN QUYỀN VAI TRÒ (RBAC MATRIX)

| Chức Năng / Phân Hệ | Admin IT | Ban Giám Hiệu (BGH) | Trưởng Khoa (Dean) | Trưởng Bộ Môn | Giảng Viên / Cán Bộ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Xem Dashboard Tổng Quan** | Toàn trường | Toàn trường | Trong Khoa | Trong Bộ môn | Cá nhân |
| **Điểm Danh AI Kiosk (/face-attendance)** | Quản trị | Sử dụng | Sử dụng | Sử dụng | Sử dụng |
| **Chấm Công Của Tôi (/attendance-me)** | Có | Có | Có | Có | Có |
| **Quản Lý Bảng Chấm Công (/attendance-manage)**| Toàn quyền | Toàn quyền | Trong Khoa | Trong Bộ môn | Không |
| **Quản Lý Cơ Cấu Cây Phòng Ban (/departments)**| Toàn quyền | Xem / Bổ nhiệm | Trong Khoa | Xem | Xem |
| **Quản Lý Hồ Sơ Cán Bộ (/users)** | Toàn quyền | Toàn quyền | Trong Khoa | Xem | Xem hồ sơ mình |
| **Đăng Ký Sinh Trắc Học Face ID (/face-registration)**| Toàn quyền | Quản lý | Trong Khoa | Tự đăng ký | Tự đăng ký |
| **Thời Khóa Biểu & Lịch Dạy (/schedules)** | Toàn quyền | Toàn trường | Trong Khoa | Trong Bộ môn | Lịch cá nhân |
| **Duyệt Đơn Nghỉ Phép (/leave-requests)** | Toàn quyền | Duyệt cấp 2 | Duyệt cấp 1 | Duyệt cấp 1 | Tạo đơn cá nhân |
| **Cấu Hình Hệ Thống (/settings)** | Duy nhất | Không truy cập | Không | Không | Không |

---

> **Ghi chú nghiệm thu**: Bản đặc tả thiết kế này là kim chỉ nam duy nhất cho toàn bộ kiến trúc giao diện, màu sắc, bố cục màn hình và quy chuẩn mã nguồn của dự án `DATN_QLNS_ChamCong_FaceRec`. Mọi cập nhật về tính năng phải tuân thủ nghiêm ngặt tài liệu này.
