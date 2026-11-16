# BỘ QUY CHUẨN PHÂN TÍCH THIẾT KẾ HỆ THỐNG & PROMPT CHUYÊN GIA THẨM ĐỊNH
**Đề tài:** Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính  
**Sinh viên thực hiện:** Vũ Tiến Đức | **MSSV:** 2310900023 | **Đại học Nguyễn Trãi**  

---

## MỤC LỤC
1. [Prompt Chuyên Gia Thẩm Định (Senior System Analyst & Technical Lead)](#1-prompt-chuyên-gia-thẩm-định)
2. [Từ Điển Tác Nhân Chuẩn Hóa Toàn Hệ Thống (Canonical Actor Dictionary)](#2-từ-điển-tác-nhân-chuẩn-hóa-toàn-hệ-thống)
3. [Quy Chuẩn Thiết Kế & Nguyên Tắc Phân Rã Use Case (UML Standards)](#3-quy-chuẩn-thiết-kế--nguyên-tắc-phân-rã-use-case)
4. [Biểu Mẫu Bảng Đặc Tả Use Case Chuẩn Của Trường (Specification Template)](#4-biểu-mẫu-bảng-đặc-tả-use-case-chuẩn-của-trường)
5. [Bảng Đặc Tả Duy Nhất Cho Phân Hệ: UC_BIO_01 - Đăng Ký Mẫu Khuôn Mặt 5 Góc](#5-bảng-đặc-tả-duy-nhất-cho-phân-hệ-uc_bio_01---đăng-ký-mẫu-khuôn-mặt-5-góc)

---

## 1. PROMPT CHUYÊN GIA THẨM ĐỊNH

> **Hướng dẫn sử dụng:** Sao chép nguyên văn đoạn prompt dưới đây vào bất kỳ phiên làm việc nào mới (hoặc gửi cho AI) để kích hoạt vai trò chuyên gia phân tích thiết kế hệ thống cấp cao.

```markdown
Đóng vai là một Chuyên gia Cấp cao về Phân tích và Thiết kế Hệ thống (Senior System Analyst & Software Architect) với hơn 15 năm kinh nghiệm thực chiến. Bạn đã từng chủ trì thiết kế, kiến trúc và thẩm định hàng trăm dự án phần mềm quy mô lớn (Enterprise, SaaS, Microservices) cũng như các hệ thống có tính chuyên môn sâu tích hợp AI, Machine Learning và Thị giác máy tính (Computer Vision). Bạn nắm vững mọi quy chuẩn của UML, các design pattern, kiến trúc hệ thống và các nguyên lý thiết kế phần mềm khắt khe nhất.

Nhiệm vụ của bạn là đóng vai trò như một Chủ tịch Hội đồng bảo vệ đồ án hoặc một Technical Lead khó tính nhưng mang tư duy xây dựng (constructive). Bạn sẽ tiếp nhận và thẩm định các tài liệu phân tích, biểu đồ thiết kế (Use Case, Activity, Sequence, Class, ERD...) hoặc đặc tả yêu cầu (SRS) do tôi cung cấp.

Khi đánh giá, bạn bắt buộc phải tuân thủ các nguyên tắc sau:
1. Kiểm tra chuẩn mực: Soi xét nghiêm ngặt tính đúng đắn về mặt cú pháp và ngữ nghĩa của các loại biểu đồ, đảm bảo tuân thủ tuyệt đối chuẩn UML hiện hành.
2. Đánh giá logic và kiến trúc: Phân tích xem luồng nghiệp vụ, cách phân rã chức năng, định nghĩa Actor, và sự tương tác giữa các module đã hợp lý, mạch lạc và sát với nghiệp vụ thực tế hay chưa.
3. Phát hiện điểm mù: Chỉ ra các lỗ hổng thiết kế, luồng dữ liệu bị đứt gãy, các trường hợp ngoại lệ (edge cases) chưa được xử lý, hoặc các rủi ro liên quan đến trải nghiệm người dùng và khả năng vận hành của hệ thống.
4. Cung cấp giải pháp thực chiến: Với mỗi điểm yếu hoặc lỗi sai được tìm thấy, không chỉ đưa ra nhận xét mà bắt buộc phải giải thích "Tại sao không hợp lý" và đề xuất "Cách chỉnh sửa cụ thể, trực tiếp" để tối ưu hóa tài liệu.
5. Văn phong: Kỹ thuật, trực diện, chuyên nghiệp. Không dùng từ ngữ hoa mỹ dài dòng. Sử dụng chính xác và linh hoạt các thuật ngữ chuyên ngành.

Nếu bạn đã nắm rõ vai trò, nền tảng kinh nghiệm và nguyên tắc làm việc của mình, hãy phản hồi bằng một câu xác nhận ngắn gọn mang phong cách của một Technical Lead, sau đó chờ tôi cung cấp tài liệu đầu tiên để bắt đầu quá trình thẩm định.
```

---

## 2. TỪ ĐIỂN TÁC NHÂN CHUẨN HÓA TOÀN HỆ THỐNG
*(Áp dụng đồng bộ 100% cho mọi sơ đồ Use Case, Activity, Sequence và Báo cáo thuyết minh)*

| STT | Tên chuẩn trên sơ đồ | Mã vai trò Backend | Trách nhiệm và Phạm vi nghiệp vụ | Ghi chú chuẩn hóa UML |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Quản trị viên** | `admin` | Quản trị tài khoản, phân quyền, cấu hình thông số kỹ thuật AI, kiểm toán toàn hệ thống. | Kế thừa toàn bộ thẩm quyền từ Cán bộ TCCB. |
| **2** | **Cán bộ TCCB** | `tccb` | Quản lý nhân sự toàn trường, duyệt đơn cấp 2, quản lý dữ liệu Face ID, tính lương, xếp ca. | **BẮT BUỘC** dùng tên vai trò người dùng này; **CẤM** dùng tên phòng ốc `Phòng Tổ chức Cán bộ`. |
| **3** | **Trưởng đơn vị** | `truong_khoa`<br>`truong_phong`<br>`truong_bo_mon` | Duyệt đơn cấp 1, xếp/đổi lịch giảng dạy, theo dõi chấm công nội bộ đơn vị phụ trách. | Đại diện chung cho cấp lãnh đạo Khoa, Phòng ban, Bộ môn. |
| **4** | **Giảng viên / Nhân viên** | `giang_vien`<br>`nhan_vien` | Điểm danh nhận diện khuôn mặt, tạo đơn từ, xem lịch dạy, xem bảng lương cá nhân. | Người dùng cuối thông thường trong toàn trường. |
| **5** | **Thiết bị điểm danh Face AI** | `camera_terminal` | Trạm Kiosk hoặc Camera nhận diện gửi frame ảnh/video thời gian thực về máy chủ. | **System Actor** (Tác nhân phần cứng / Hệ thống ngoài). |
| **6** | **Dịch vụ AI ngoài** | `llm_gateway` | Cổng đa mô hình (Google Gemini, Groq Llama, DeepSeek) xử lý phản hồi cho Box Chat AI. | **System Actor** (Dịch vụ bên thứ ba). |

---

## 3. QUY CHUẨN THIẾT KẾ & NGUYÊN TẮC PHÂN RÃ USE CASE

### 3.1. Các lỗi Anti-patterns tuyệt đối cấm mắc phải:
1. **Lỗi biến Use Case thành Lưu đồ giải thuật (Functional Decomposition / Flowcharting):**
   * *Không vẽ:* Các bước giải thuật con (`Tính L2-norm`, `Ước lượng góc 3D`, `Đo độ nét Laplacian`).
   * *Không vẽ:* Các lệnh thao tác database (`Ghi CSDL`, `UPDATE trạng thái da_dang_ky_face`).
   * *Giải pháp:* Đóng gói thành các **Use Case Dịch vụ Hệ thống (System Services)**: `Kiểm định chất lượng ảnh sinh trắc`, `Trích xuất vector đặc trưng AI`.
2. **Quy tắc đặc tả 1 Use Case cốt lõi:**
   * Mỗi sơ đồ phân rã chỉ lập **ĐÚNG 1 BẢNG ĐẶC TẢ** cho Use Case hạt nhân quan trọng nhất của sơ đồ đó. Luồng sự kiện chính và Luồng thay thế phải là một chu trình nghiệp vụ khép kín, không pha tạp các nghiệp vụ quản lý khác vào.
3. **Quy tắc đánh số và sắp xếp tuần tự trong Luồng thay thế (Chronological Branching):**
   * Luồng thay thế rẽ nhánh tại **Bước nào** thì bắt buộc phải đánh số theo bước đó (ví dụ: rẽ nhánh tại Bước 3 thì đánh số `3.1, 3.2`; tại Bước 6 thì đánh số `6.1, 6.2`; tại Bước 7 thì đánh số `7.1, 7.2`; tại Bước 8 thì đánh số `8.1, 8.2`).
   * **Bắt buộc sắp xếp theo thứ tự thời gian tăng dần** ($3 \rightarrow 6 \rightarrow 7 \rightarrow 8$), không được nhảy cóc số bước lộn xộn.
   * Hành vi xuất phát từ ai thì viết ở đúng cột của đối tượng đó (hành vi của Người dùng ở cột Người dùng, hành vi kiểm tra/cảnh báo của Hệ thống ở cột Hệ thống).
4. **Lỗi dùng thuật ngữ code trong văn bản đặc tả:**
   * Không viết tên trường dữ liệu CSDL (`da_dang_ky_face = true`), không viết cú pháp lệnh `[Include: ...]`, không viết mã lỗi backend (`DUPLICATE_FACE_DETECTED`). Toàn bộ phải diễn đạt bằng ngôn ngữ nghiệp vụ trong sáng, chuẩn mực học thuật.
5. **Lỗi dùng `<<Extend>>` cho thông báo lỗi và Pop-up cảnh báo:**
   * Các tình huống lỗi (*Cảnh báo trùng lặp khuôn mặt*, *Mất kết nối mạng*) là **Luồng ngoại lệ (Exception Flows)**, phải viết bằng lời trong Bảng đặc tả, không vẽ thành elip `<<Extend>>`.
6. **Lỗi dùng `<<Extend>>` cho tác vụ Quản trị (CRUD Action):**
   * Hành động *Xóa / Thu hồi mẫu* là quyền hạn độc lập của Admin/TCCB. Bắt buộc vẽ liên kết trực tiếp từ Actor, không vẽ `<<Extend>>` từ Use Case *Xem danh sách*.
7. **Quy tắc Kế thừa Tác nhân (Actor Generalization):**
   * Khi `Quản trị viên` kế thừa `Cán bộ TCCB`, Quản trị viên **bắt buộc phải có ít nhất 1 Use Case riêng biệt** (ví dụ: `Cấu hình ngưỡng nhận diện sinh trắc`) để tránh lỗi *Kế thừa rỗng (Empty Generalization)*.

### 3.2. Tiêu chuẩn đặt tên Khung hệ thống (System Boundary):
* Khung chữ nhật bao quanh biểu đồ phải đặt tên theo **Phân hệ chức năng tổng quát** (ví dụ: `Quản lý dữ liệu sinh trắc học`, `Quản lý đơn từ`), bao quát toàn bộ các Use Case bên trong.

---

## 4. BIỂU MẪU BẢNG ĐẶC TẢ USE CASE CHUẨN CỦA TRƯỜNG
*(Định dạng chuẩn 1 bảng duy nhất liền mạch 2 cột)*

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã use case** | UC_[MÃ_PHÂN_HỆ] |
| **Tên use case:** | [Tên hình elip Use Case cốt lõi cần đặc tả] |
| **Mô tả sơ lược:** | [Mô tả tóm tắt mục tiêu và giá trị nghiệp vụ của Use Case] |
| **Actor chính:** | [Tác nhân người dùng trực tiếp] |
| **Actor phụ:** | [Hệ thống ngoài, AI Service, hoặc Actor hỗ trợ] |
| **Tiền điều kiện:** | [Các điều kiện bắt buộc phải thỏa mãn trước khi bắt đầu] |
| **Hậu điều kiện:** | [Trạng thái của hệ thống và CSDL sau khi hoàn thành] |
| **Luồng sự kiện chính** | |
| **Người dùng / Cán bộ** | **Hệ thống** |
| 1. [Hành động kích hoạt của Actor] | 2. [Phản hồi đầu tiên của hệ thống] |
| 3. [Actor nhập liệu / tương tác] | 4. [Hệ thống xử lý nghiệp vụ] |
| | 5. [Hệ thống lưu trữ CSDL / gọi dịch vụ liên quan] |
| | 6. [Hệ thống thông báo hoàn tất] |
| **Luồng thay thế** | |
| **Người dùng / Cán bộ** | **Hệ thống** |
| [Số_bước.1] [Hành động của Actor nếu phát sinh nhánh rẽ] | [Số_bước.1] [Phản hồi/kiểm tra của hệ thống tại bước tương ứng] |
| | [Số_bước.2] [Cảnh báo lỗi hoặc hành vi xử lý tiếp theo của hệ thống] |

---

## 5. BẢNG ĐẶC TẢ DUY NHẤT CHO PHÂN HỆ: UC_BIO_01 - ĐĂNG KÝ MẪU KHUÔN MẶT 5 GÓC

### Bảng 2.x: Bảng đặc tả use case Đăng ký mẫu khuôn mặt 5 góc

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã use case** | UC_BIO_01 |
| **Tên use case:** | Đăng ký mẫu khuôn mặt 5 góc |
| **Mô tả sơ lược:** | Cho phép Người dùng, Cán bộ TCCB hoặc Quản trị viên thu nhận 5 góc khuôn mặt qua camera, hệ thống tự động kiểm tra chất lượng ảnh, trích xuất dữ liệu đặc trưng sinh trắc học, mã hóa an toàn và lưu trữ làm cơ sở dữ liệu phục vụ điểm danh Face AI. |
| **Actor chính:** | Người dùng, Cán bộ TCCB, Quản trị viên |
| **Actor phụ:** | Hệ thống AI Microservice |
| **Tiền điều kiện:** | Tài khoản đã đăng nhập vào hệ thống; thiết bị có camera hoạt động tốt và đã cấp quyền truy cập; nhân sự chưa có dữ liệu khuôn mặt trên hệ thống (hoặc được cấp quyền quét lại). |
| **Hậu điều kiện:** | Dữ liệu đặc trưng khuôn mặt được mã hóa và lưu trữ an toàn trong cơ sở dữ liệu; đồng bộ lên bộ nhớ tìm kiếm nhận diện nhanh; kích hoạt trạng thái "Đã có Face ID" trên hồ sơ nhân sự; ghi nhận nhật ký kiểm toán hệ thống. |
| **Luồng sự kiện chính** | |
| **Người dùng / Cán bộ TCCB / Quản trị viên** | **Hệ thống** |
| 1. Chọn chức năng **Đăng ký Face ID mới**. | 2. Hiển thị màn hình thu nhận, kích hoạt camera và yêu cầu đồng thuận bảo mật dữ liệu sinh trắc học theo quy định bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). |
| 3. Tích chọn đồng ý điều khoản và nhấn **Bắt đầu quét**. | 4. Hiển thị khung định vị và hướng dẫn lần lượt 5 góc chụp (Chính diện, Trái, Phải, Ngửa, Cúi). |
| 5. Lần lượt xoay mặt theo chỉ dẫn trực quan và âm thanh. | 6. Hệ thống thực hiện kiểm định chất lượng ảnh sinh trắc: Đo độ sắc nét và góc nghiêng đầu của từng khung hình. Khi ảnh đạt chuẩn, tự động chụp và lưu vào 5 vị trí mẫu tạm thời. |
| 7. Kiểm tra lại 5 ảnh trên màn hình xem trước và chọn **Xác nhận lưu Face ID**. | 8. Hệ thống thực hiện trích xuất vector đặc trưng AI: Tính toán vector đại diện khuôn mặt 512 chiều, tính vector trọng tâm và đối soát chống trùng lặp khuôn mặt trên toàn trường. |
| | 9. Mã hóa dữ liệu bảo mật (chuẩn AES-256), lưu trữ vào cơ sở dữ liệu và đồng bộ vào bộ nhớ đệm nhận diện khuôn mặt. |
| | 10. Hệ thống ghi nhật ký kiểm toán sinh trắc học và hiển thị thông báo "Đăng ký thành công". |
| **Luồng thay thế** | |
| **Người dùng / Cán bộ TCCB / Quản trị viên** | **Hệ thống** |
| **3.1.** Người dùng bấm nút **Hủy** hoặc đóng trình duyệt bất kỳ lúc nào trước Bước 7. | **3.2.** Xóa toàn bộ ảnh tạm trong bộ nhớ, giải phóng kết nối camera, hủy tiến trình và quay về màn hình trước đó. |
| | **6.1.** Ảnh không đạt chất lượng (quá mờ, thiếu sáng hoặc sai góc mặt). |
| | **6.2.** Hiển thị cảnh báo viền đỏ, phát âm thanh hướng dẫn điều chỉnh tư thế và tạm dừng chụp tự động. |
| **7.1.** Phát hiện có một góc chụp chưa ưng ý, chọn **Chụp lại** tại đúng góc ảnh đó (Thu nhận lại góc mặt đơn lẻ). | **7.2.** Kích hoạt lại camera cho riêng góc ảnh đã chọn, kiểm tra đạt chuẩn và ghi đè ảnh mới vào vị trí tương ứng. Quay lại Bước 7. |
| | **8.1.** Phát hiện dữ liệu khuôn mặt trùng khớp với nhân sự khác đã có trong hệ thống (> 80%). |
| | **8.2.** Hiển thị cảnh báo lỗi trùng lặp dữ liệu, từ chối lưu và ghi nhận cảnh báo an ninh. |
