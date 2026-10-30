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
3. **Quy tắc Chuẩn Hóa Giá Trị Định Danh & Enum Duy Nhất (Canonical Exact Values):**
   - Chỉ dùng duy nhất 1 định dạng chuẩn chữ thường snake_case cho mỗi loại giá trị hoặc vai trò trong toàn hệ thống.
   - **Tuyệt đối cấm** viết mảng chứa nhiều biến thể hoa/thường hay lẫn lộn tiếng Anh / tiếng Việt.
   - Ví dụ chuẩn hóa:
     * Loại đơn dạy bù: **Chỉ dùng duy nhất `day_bu`** (tuyệt đối KHÔNG dùng `daybu`, `DAYBU`, `DAY_BU`, `COMPENSATORY`).
     * Vai trò lãnh đạo khoa: **Chỉ dùng duy nhất `truong_khoa`** (tuyệt đối KHÔNG dùng `truongkhoa`, `TRUONGKHOA`, `TRUONG_KHOA`).
     * Loại đơn phép năm: **Chỉ dùng duy nhất `nghi_phep`**.
     * Loại đơn đổi ca: **Chỉ dùng duy nhất `doi_ca`**.
4. **Quy tắc rà soát:**
   - Kiểm tra toàn bộ các đối tượng `.aliases` trong `server/models/*.model.js` để đảm bảo không có bất kỳ trường CSDL nào có nhiều hơn 1 alias trỏ tới.

---

### Bước 2.2: Quy Tắc Chống Trùng Lặp Cú Pháp, Mảng Ánh Xạ & Truy Vấn (Anti-Redundancy Rules)
1. **Cấm mảng ánh xạ 2 chiều tự trỏ chính nó:**
   - Khi cả hai phía (client và service) đã cùng dùng chung một chuẩn tên tiếng Anh hoặc tiếng Việt, **tuyệt đối không** tạo mảng 2 chiều chứa các cặp trùng lặp như `[['image_straight', 'image_straight'], ['image_left', 'image_left'], ...]`.
   - Phải sử dụng mảng 1 chiều chứa danh sách tên chuẩn: `const angleFields = ['image_straight', 'image_left', ...];`.
2. **Cấm cập nhật kép trong `$set`:**
   - Khi cập nhật vào MongoDB (Mongoose), **tuyệt đối không** truyền cùng lúc cả tên trường CSDL tiếng Việt và alias tiếng Anh của nó trong cùng một `$set` (như `{ da_dang_ky_face: true, isFaceRegistered: true, ngay_dang_ky_face: now, faceRegisteredAt: now }`).
   - Mongoose Schema Alias đã tự động ánh xạ. Chỉ dùng duy nhất 1 tên trường hoặc alias chuẩn.
3. **Cấm gọi lưu trùng lặp (`save()` kèm `findByIdAndUpdate()`):**
   - Không được gọi `targetUser.save()` rồi ngay lập tức lại gọi `User.findByIdAndUpdate(targetUser._id, ...)` để cập nhật cùng những trường vừa lưu.
4. **Cấm truy vấn `$or` gom tất cả các bí danh:**
   - Mongoose Schema Alias đã tự động ánh xạ alias sang cột CSDL vật lý.
   - **Tuyệt đối cấm** viết `$or` gom tất cả biến thể tên (như `$or: [{ avatar }, { anh_dai_dien }, { facePhoto }, { anh_khuon_mat }]` hoặc `$or: [{ staffCode }, { employeeCode }, { ma_nhan_vien }, { ma_can_bo }, { email }]`).
   - Chỉ query duy nhất các trường độc lập (như `{ staffCode }` hoặc `{ email }`).
5. **Cấm chuỗi fallback `||` đa tầng rườm rà (Multi-Tier Fallbacks):**
   - **Tuyệt đối không** viết các chuỗi fallback nối đuôi 3-4 tên (như `u.fullName || u.ho_ten || ''`, `u.staffCode || u.ma_can_bo || ''`, `dept.name || dept.ten_phong_ban || ''`, `u.phoneNumber || u.so_dien_thoai || ''`).
   - Luôn sử dụng duy nhất một thuộc tính chuẩn hóa thống nhất theo Canonical Schema (`u.fullName || ''`, `u.staffCode || ''`, `dept.name || ''`).

---

### Bước 2.1: Quy Tắc Khi Yêu Cầu Kiểm Tra ("Khi bảo check là chỉ check không sửa" - Check-Only Mode)
- Khi người dùng đưa ra câu lệnh có từ khóa "check", "kiểm tra", "rà soát", "soát lại":
  1. Agent **CHỈ ĐƯỢC PHÉP đọc, đối chiếu, phân tích logic và lập báo cáo chi tiết**.
  2. **TUYỆT ĐỐI KHÔNG tự ý chỉnh sửa bất kỳ file mã nguồn nào** (không gọi `replace_file_content`, `multi_replace_file_content`, `write_to_file`).
  3. Chỉ thực hiện chỉnh sửa khi người dùng có lệnh rõ ràng như "sửa đi", "fix đi", "cập nhật ngay".

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

### Bước 5: Chiến Lược Phạm Vi Đọc & Kiểm Thử Tiết Kiệm Quota (Bắt Buộc)
1. **Chỉ đọc các file liên quan trực tiếp (Strict File Reading Scope):**
   - CHỈ ĐƯỢC PHÉP đọc các file nằm trong phạm vi của module hoặc tính năng đang thực hiện.
   - TUYỆT ĐỐI KHÔNG đọc các file ngoài lề, không đọc lan man toàn bộ thư mục hoặc các file không liên quan.
   - Khi đọc file, bắt buộc áp dụng **File Slicing** (`StartLine`, `EndLine` từ 30–80 dòng) hoặc `grep_search`, cấm đọc toàn bộ file dài (>150 dòng).

2. **Chỉ test file liên quan trực tiếp (Strict Test Scope - Không Test Hết):**
   - **Khi sửa logic Backend:** CHỈ chạy duy nhất file test của module đó (ví dụ: sửa auth/token -> chạy `node server/tests/rbacAndTokenRotation.test.js`; sửa khuôn mặt -> chạy `node server/tests/faceEnrollment.test.js`).
   - **Khi sửa UI / Frontend:** CHỈ chạy `npm run build` để kiểm tra TypeScript/cú pháp, TUYỆT ĐỐI KHÔNG chạy test backend.
   - **Cấm tự ý chạy toàn bộ test (`npm test`):** Không được tự ý chạy 18 test suites cùng lúc trừ khi người dùng ra lệnh rõ ràng hoặc nghiệm thu milestone lớn.

---

### Bước 6: Báo cáo ngắn gọn cho người dùng
- Liệt kê các file thừa đã được dọn dẹp.
- Thông báo kết quả build thành công (thời gian build và trạng thái bundle).
