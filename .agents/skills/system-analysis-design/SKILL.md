---
name: system-analysis-design
description: >-
  Kích hoạt quy chuẩn kiểm tra bắt buộc trước khi thực hiện phân tích thiết kế hệ thống (vẽ biểu đồ Use Case UML,
  thiết kế kiến trúc, viết bảng đặc tả Use Case). Bắt buộc vượt qua 3 điều kiện thẩm định: (1) Đúng với đồ án hiện tại
  (đối soát CSDL và Codebase thực tế), (2) Chuẩn phân tích hướng chức năng (UML chuẩn quốc tế, tránh bẫy CRUD và Business Rule),
  (3) Có căn cứ rõ ràng (truy vết từ Model, Controller, Service hoặc Quy chế đào tạo).
---

# Quy Chuẩn Phân Tích & Thiết Kế Hệ Thống (System Analysis & Design Standards)

> **Mục đích:** Đảm bảo mọi bản vẽ biểu đồ Use Case, tài liệu kiến trúc và bảng đặc tả Use Case trong Đề tài tốt nghiệp của sinh viên **Vũ Tiến Đức (MSSV: 2310900023 - ĐH Nguyễn Trãi)** đạt chuẩn mực học thuật cao cấp nhất, bảo vệ an toàn 100% trước mọi câu hỏi phản biện của Hội đồng chấm điểm.

---

## 3 ĐIỀU KIỆN KIỂM TRA BẮT BUỘC TRƯỚC KHI THỰC HIỆN

Trước khi đề xuất bất kỳ Use Case nào, chỉnh sửa biểu đồ UML hoặc viết bảng đặc tả, Agent **BẮT BUỘC PHẢI TỰ KIỂM TRA ĐỦ 3 ĐIỀU KIỆN SAU**:

```
 1. ĐÚNG VỚI ĐỒ ÁN HIỆN TẠI   ──────► Đối soát trực tiếp CSDL MongoDB & Code Backend
 2. CHUẨN HƯỚNG CHỨC NĂNG     ──────► Đúng tầm mức User Goal, C-R-U-D, tránh bẫy Business Rule
 3. CÓ CĂN CỨ RÕ RÀNG         ──────► Trích dẫn đích danh Model, API, Controller & Quy chuẩn UML
```

---

### ĐIỀU KIỆN 1: ĐÚNG VỚI ĐỒ ÁN HIỆN TẠI (GROUND TRUTH AUDIT)

1. **Tuyệt đối không suy diễn viển vông:**
   - Mọi Use Case đưa vào thiết kế phải có thực trong hệ thống.
   - Trước khi vẽ hoặc đặc tả phân hệ nào, **bắt buộc phải đọc trực tiếp**:
     * Model CSDL tương ứng trong `server/models/*.model.js`.
     * Controller & Service xử lý trong `server/controllers/*.controller.js` và `server/services/*.service.js`.
     * API Routes tương ứng trong `server/routes/*.routes.js`.
2. **Tuân thủ nghiêm ngặt Từ điển Tác nhân Chuẩn hóa (6 Canonical Actors):**
   * `Quản trị viên` (`admin`): Quản trị toàn hệ thống, cấu hình tham số, phân quyền.
   * `Cán bộ TCCB` (`tccb`): Quản lý hồ sơ nhân sự, dữ liệu sinh trắc học khuôn mặt, phòng ban, ca làm việc. *(Lưu ý: Không dùng "Phòng Tổ chức Cán bộ")*.
   * `Trưởng đơn vị` (`truong_khoa`, `truong_phong`, `truong_bo_mon`): Quản lý công nội bộ khoa/phòng, phê duyệt đơn từ cấp 1. Kế thừa quyền từ Giảng viên / Nhân viên.
   * `Giảng viên / Nhân viên` (`giang_vien`, `nhan_vien`): Tác nhân người dùng cơ sở thực hiện điểm danh, gửi đơn từ, xem lịch làm việc.
   * `Hệ thống`: Tác nhân tự động chạy ngầm (Cron Service) thực hiện quét chốt công cuối ngày, đánh vắng, gửi email thông báo. *(Tuyệt đối không tự ý đổi tên tác nhân này)*.
   * `Dịch vụ AI ngoài`: Hệ thống Gateway đa mô hình (Gemini, Claude, DeepSeek, Local Ollama).

---

### ĐIỀU KIỆN 2: CHUẨN PHÂN TÍCH HƯỚNG CHỨC NĂNG (STRICT UML STANDARDS)

1. **Chuẩn tầm mức Use Case (Correct Granularity - User Goal Oriented):**
   * Use Case phải đại diện cho một **Mục tiêu hoàn chỉnh mang lại giá trị cho người dùng (User Goal)**.
   * **CẤM 3 bẫy kinh điển trong đồ án:**
     * **Bẫy 1 - Biến ô nhập liệu trên Form thành Use Case:** Tuyệt đối không vẽ các oval cấp độ trường dữ liệu như `Nhập tên ca`, `Cấu hình giờ bắt đầu`, `Cấu hình thời gian đi muộn`, `Xem khung giờ quẹt thẻ`. Mọi chi tiết này phải gom vào Use Case lớn (`Thêm mới ca làm việc`, `Cập nhật ca làm việc`) và mô tả trong Luồng sự kiện của Bảng đặc tả.
     * **Bẫy 2 - Biến Cảnh báo / Popup lỗi thành Use Case:** Không bao giờ vẽ các oval `Cảnh báo quét lặp`, `Cảnh báo không có ca`, `Cảnh báo giả mạo`. Thông báo lỗi là **Luồng ngoại lệ (Exception Flow)** trong văn bản, không phải mục tiêu của người dùng.
     * **Bẫy 3 - Biến Quy tắc kiểm tra ngầm (Business Rule) thành Use Case:** Không vẽ các câu lệnh lọc hay kiểm tra toàn vẹn như `Giới hạn phạm vi khoa` (là mệnh đề WHERE của SQL/Mongo), `Kiểm tra khung giờ hợp lệ` (là form validation), `Kiểm tra ràng buộc lịch dạy` (là foreign key check).
2. **Quy tắc mô hình C-R-U-D đầy đủ cho phân hệ quản trị danh mục:**
   * Khi quản lý một danh mục dữ liệu (như Ca làm việc, Phòng ban, Môn học, Ngày nghỉ lễ), phải đảm bảo đủ 4 hành động:
     * **Create:** `Thêm mới [Tên thực thể]`
     * **Read:** `Xem danh mục [Tên thực thể]` *(có thể mở rộng `<<Extend>>` lọc/tra cứu)*
     * **Update:** `Cập nhật [Tên thực thể]` *(có thể mở rộng `<<Extend>>` bật/tắt trạng thái)*
     * **Delete:** `Xóa [Tên thực thể]`
3. **Cú pháp quan hệ UML chuẩn xác:**
   * **Generalization (Kế thừa - mũi tên nét liền, đầu tam giác rỗng trỏ về cha):** Dùng khi các Use Case con là các phương thức thực thi cụ thể của Use Case cha (ví dụ: `Điểm danh bằng khuôn mặt`, `Điểm danh trực tuyến`, `Điểm danh bằng quét mã QR` $\longrightarrow$ trỏ về `Điểm danh`).
   * **`<<Include>>` (Bắt buộc chạy - mũi tên nét đứt trỏ từ Chính $\rightarrow$ Phụ):** Chỉ dùng cho các chức năng con bắt buộc phải thực thi mỗi khi Use Case chính chạy.
   * **`<<Extend>>` (Mở rộng tùy chọn - mũi tên nét đứt trỏ từ Phụ $\rightarrow$ Chính):** Dùng cho các hành vi tùy chọn, có điều kiện kích hoạt tại `extension points` của Use Case cơ sở.

---

### ĐIỀU KIỆN 3: CÓ CĂN CỨ RÕ RÀNG (TRACEABILITY & JUSTIFICATION)

Mọi đề xuất hoặc phản hồi cho người dùng đều phải có **Căn cứ chứng minh cụ thể**:
1. **Căn cứ Codebase & Dữ liệu:**
   * Trích dẫn rõ: File model nào (`*.model.js`), trường dữ liệu nào, hàm controller nào (`*.controller.js`) đang thực hiện nghiệp vụ đó.
2. **Căn cứ Nghiệp vụ & Pháp lý:**
   * Điểm danh khuôn mặt: Trích dẫn Nghị định 13/2023/NĐ-CP (Bảo vệ dữ liệu cá nhân), chuẩn mã hóa AES-256, vector ArcFace 512 chiều, kiểm tra thực thể sống Liveness.
   * Điểm danh GPS: Cơ chế Geofencing bán kính tọa độ trường ĐH Nguyễn Trãi.
   * Quản lý công & Phân ca: Khớp nối với quy chế đào tạo tín chỉ và quản lý lao động trường học.
3. **Căn cứ Lý thuyết Công nghệ Phần mềm:**
   * Dẫn chiếu đúng chuẩn UML quốc tế (Ivar Jacobson, Martin Fowler, Craig Larman) để người dùng có đầy đủ luận điểm tự tin bảo vệ trước Hội đồng chấm điểm.

---

## BIỂU MẪU BẢNG ĐẶC TẢ USE CASE CHUẨN CỦA ĐỒ ÁN (BẢNG 2.X)

Khi viết bảng đặc tả chi tiết cho Use Case hạt nhân, **BẮT BUỘC TUÂN THỦ FORM MẪU SAU**:
* **Đúng 1 bảng duy nhất 2 cột liền mạch từ trên xuống dưới** (chuẩn để paste thẳng vào Word).
* **Không chèn bất kỳ biến code, cú pháp lập trình hay ngoặc kỹ thuật** (`da_dang_ky_face = true`, `[Include: ...]`).
* **Đánh số luồng thay thế liên kết logic theo bước luồng chính** ($2 \rightarrow 2.1; 3 \rightarrow 3.1; ...$).
* **Hành vi do ai thực hiện thì ghi đúng bên cột của đối tượng đó** (Người dùng hoặc Hệ thống).

```markdown
### Bảng 2.x: Bảng đặc tả use case [Tên Use Case Khớp 100% Với Biểu Đồ]

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã use case** | UC_[MÃ] |
| **Tên use case:** | **[Tên Use Case Khớp Với Biểu Đồ]** |
| **Mô tả sơ lược:** | [Mô tả mục tiêu và giá trị nghiệp vụ của Use Case] |
| **Actor chính:** | [Tác nhân người dùng chính] |
| **Actor phụ:** | Hệ thống |
| **Tiền điều kiện:** | [Điều kiện cần có trước khi bắt đầu] |
| **Hậu điều kiện:** | [Kết quả đạt được sau khi thực hiện thành công] |
| **Luồng sự kiện chính** | |
| **[Tên Actor Người dùng]** | **Hệ thống** |
| 1. [Hành động người dùng] | 2. [Hệ thống phản hồi / kiểm tra] |
| ... | ... |
| **Luồng thay thế** | |
| **[Tên Actor Người dùng]** | **Hệ thống** |
| | **X.1.** [Tình huống phát sinh tại bước X] |
| | **X.2.** [Hệ thống xử lý ngoại lệ và thông báo] |
| **Y.1.** [Người dùng hủy thao tác tại bước Y] | **Y.2.** [Hệ thống dọn dẹp và hủy phiên] |
```
