---
name: clean-and-build
description: >-
  Kích hoạt quy trình hoàn tất công việc: Dọn dẹp các file rác, file tạm thời hoặc file không còn dùng đến,
  chạy lệnh npm run build và tự động sửa mọi lỗi biên dịch nếu có.
---

# Quy Trình Hoàn Tất Công Việc: Dọn Dẹp & Build Kiểm Tra

Sử dụng quy trình này sau khi hoàn tất các tác vụ chỉnh sửa mã nguồn hoặc khi người dùng yêu cầu kiểm tra, dọn dẹp và nghiệm thu code.

---

## Các Bước Thực Hiện Chuẩn

### Bước 1: Dọn dẹp các file thừa và file không dùng đến
1. **Kiểm tra trạng thái Git và thư mục làm việc:**
   - Rà soát các file tạm, script nháp, file test thử nghiệm một lần phát sinh trong quá trình sửa lỗi (ví dụ: `scratch_*.js`, `test_temp_*.js`, file duplicate, file chuyển đổi cũ).
   - Xóa các file không còn mục đích sử dụng.
   - *Lưu ý:* Giữ lại các bộ test tích hợp chính thức của hệ thống trừ khi người dùng chỉ định xóa.

2. **Kiểm tra tính toàn vẹn của các import:**
   - Dùng `grep_search` rà soát nhanh để đảm bảo trong dự án không còn file nào đang `import` hoặc `require` đến file vừa bị xóa.

3. **Xử lý file cũ khi nâng cấp module (services, controllers, utils, routes, middlewares, config):**
   - Khi tạo file mới thay thế code cũ, nếu trùng tên thì đổi tên file cũ thêm đuôi `.old.js` (hoặc `_old.js`) để tham khảo tài nguyên logic.
   - Khi file mới đã kế thừa xong đầy đủ code và hoạt động trơn tru: **Xóa vĩnh viễn toàn bộ các file `*.old.*`** để giữ codebase tinh gọn, sạch sẽ 100%.

---

### Bước 2: Chuẩn Hóa Tên Thuộc Tính & Ánh Xạ Alias (Canonical 1-to-1 Mapping - Không Trùng Lặp)
1. **Quy tắc 1 Cột CSDL = 1 Alias duy nhất:**
   - Mỗi trường dữ liệu vật lý tiếng Việt trong CSDL MongoDB (schema) **CHỈ ĐƯỢC PHÉP có duy nhất 1 alias tiếng Anh chuẩn hóa** (Canonical English Alias).
   - **Tuyệt đối cấm** khai báo 2 hay nhiều alias cùng trỏ về 1 trường CSDL trong bảng `.aliases` hoặc schema (ví dụ sai: `sampleCount` và `samplesCount` cùng trỏ `so_luong_mau`, `date` và `workDate` cùng trỏ `ngay_cong`, `poses` và `sampleAngles` cùng trỏ `cac_goc_chup`, `punchTime` và `scanTime` cùng trỏ `thoi_gian_quet`, `isFraud` và `isFraudulent` cùng trỏ `co_gian_lan`, `department` và `departmentId` cùng trỏ `don_vi_chinh_id`).
2. **Quy tắc JSON Response và Service:**
   - Khi trả dữ liệu từ Controller hoặc xử lý trong Service: chỉ dùng duy nhất 1 thuộc tính chuẩn hóa, không trả về cùng lúc cả 2 tên đồng nghĩa (như `sampleCount` & `samplesCount`, `poses` & `sampleAngles`, `embeddingModel` & `aiModel`) làm rối loạn kiểu dữ liệu và phát sinh lỗi sai lệch.
3. **Quy tắc rà soát:**
   - Kiểm tra toàn bộ các đối tượng `.aliases` trong `server/models/*.model.js` để đảm bảo không có bất kỳ trường CSDL nào có nhiều hơn 1 alias trỏ tới.

---

### Bước 3: Chạy Build Kiểm Tra Dự Án (`npm run build`)
1. **Thực thi lệnh build:**
   ```powershell
   npm run build
   ```
   *(Chạy với `BypassSandbox: true` để tsc và Vite truy cập đầy đủ môi trường node).*

2. **Đánh giá kết quả:**
   - Nếu lệnh trả về `exited with code 0`: Mã nguồn đã chuẩn chỉ, không có lỗi cú pháp hoặc TypeScript. Tiến tới Bước 5.
   - Nếu lệnh build thất bại (lỗi TypeScript `tsc` hoặc Vite transform): Tiến hành Bước 4.

---

### Bước 4: Tự động phân tích và khắc phục lỗi
1. Đọc kỹ thông báo lỗi chi tiết từ log (file, dòng lỗi, mã lỗi TS...).
2. Phân loại lỗi thường gặp:
   - Sai lệch kiểu dữ liệu hoặc thiếu trường trong interface / type.
   - Lỗi import sai đường dẫn do file bị di dời / đổi tên.
   - Cú pháp không tương thích giữa CommonJS và ES Module.
3. Chỉnh sửa ngay file bị lỗi bằng công cụ `replace_file_content`.
4. Chạy lại `npm run build` để kiểm tra. Lặp lại cho đến khi build hoàn toàn thành công.

---

### Bước 5: Báo cáo ngắn gọn cho người dùng
- Liệt kê các file thừa đã được dọn dẹp.
- Thông báo kết quả build thành công (thời gian build và trạng thái bundle).
