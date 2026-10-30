# Hướng Dẫn Hoạt Động (Workspace Guidelines)

## Quy Tắc Nghiệm Thu & Hoàn Tất Tác Vụ (Post-Task Rule)
Mỗi khi hoàn thành một nhiệm vụ lập trình hoặc sửa lỗi:
1. **Dọn dẹp file:** Tự động kiểm tra và xóa bỏ tất cả các file thử nghiệm tạm thời, file nháp, file trùng lặp hoặc không còn sử dụng.
2. **Kiểm tra biên dịch:** Luôn luôn chạy `npm run build` để kiểm tra toàn bộ mã nguồn.
3. **Tự sửa lỗi:** Nếu `npm run build` phát hiện bất kỳ lỗi TypeScript, cú pháp hoặc đóng gói nào, lập tức sửa lỗi và chạy lại build cho đến khi thành công 100%.
4. **Quy trình thay thế & xóa file cũ (services, controllers, utils, routes, middlewares, config):**
   - Khi viết lại một module mới theo CSDL v2.5 mà trùng tên file cũ: Hãy đổi tên file cũ bằng cách thêm hậu tố `.old.js` (hoặc `_old.js`) vào cuối tên file để tham khảo logic cũ khi cần.
   - Ngay sau khi file mới đã hoàn thành, kế thừa và tích hợp đủ tài nguyên cần thiết: **Bắt buộc xóa bỏ hoàn toàn file cũ (`*.old.*`) khỏi dự án**. Tuyệt đối không giữ lại file rác, file mã nguồn cũ để tránh rối loạn cấu trúc, thừa dữ liệu và phát sinh lỗi sai lệch sau này.
5. **Chuẩn hóa trường dữ liệu & ánh xạ Alias (Canonical 1-to-1 Mapping):** Tuyệt đối không khai báo nhiều alias tiếng Anh cùng trỏ về một trường CSDL tiếng Việt. Chỉ dùng duy nhất 1 alias chuẩn cho 1 cột CSDL, loại bỏ hoàn toàn các tên trùng lặp / bí danh kép trong schema và model (ví dụ: cấm dùng song song `sampleCount` và `samplesCount`, `date` và `workDate`, `poses` và `sampleAngles`, `punchTime` và `scanTime`, `isFraud` và `isFraudulent`, `department` và `departmentId`).
6. **Giới hạn phạm vi Workspace duy nhất (`DATN_QLNS_ChamCong_FaceRec`):** Tuyệt đối chỉ tập trung làm việc, đọc file và thực thi lệnh trong thư mục dự án `d:\DATN_VuTienDuc_2310900023\DATN_QLNS_ChamCong_FaceRec`. Không can thiệp hay chạy lệnh ở các workspace bên ngoài.
7. **Quy tắc Đọc File Liên Quan & Tiết Kiệm Quota (File Scoping & Slicing):** CHỈ ĐƯỢC PHÉP đọc các file có liên quan trực tiếp đến tính năng hoặc lỗi đang làm. TUYỆT ĐỐI KHÔNG đọc lan man các file ngoài lề hoặc quét các file không liên quan. Đối với file lớn (>150 dòng), bắt buộc sử dụng `StartLine` và `EndLine` (phạm vi từ 30–80 dòng) hoặc `grep_search` để nhắm trúng đoạn mã cần sửa, bảo vệ Context Window và tiết kiệm tối đa Quota.
8. **Chiến lược Kiểm Thử Trọng Tâm (Targeted Testing - Không Test Hết):** TUYỆT ĐỐI KHÔNG tự ý chạy toàn bộ 18 test suites (`npm test`). CHỈ chạy duy nhất file test liên quan trực tiếp đến module vừa sửa (ví dụ: `node server/tests/rbacAndTokenRotation.test.js`). Khi sửa chi tiết nhỏ hoặc UI/Frontend, CHỈ chạy `npm run build` để xác thực TypeScript và cú pháp. Chỉ chạy toàn bộ `npm test` khi người dùng có yêu cầu rõ ràng hoặc khi nghiệm thu mốc lớn (Milestone).
9. **Chuẩn Hóa Giá Trị Định Danh & Enum Duy Nhất (Canonical Exact Values - Không Dùng Nhiều Biến Thể):** Chỉ dùng duy nhất 1 định dạng chuẩn chữ thường snake_case cho mỗi loại giá trị hoặc vai trò trong toàn hệ thống. Tuyệt đối cấm viết mảng chứa nhiều biến thể hoa/thường hay tiếng Anh lẫn lộn. Ví dụ:
   - Loại đơn dạy bù: **Chỉ dùng duy nhất `day_bu`** (tuyệt đối KHÔNG dùng `daybu`, `DAYBU`, `DAY_BU`, `COMPENSATORY`).
   - Vai trò: **Chỉ dùng duy nhất `truong_khoa`** (tuyệt đối KHÔNG dùng `truongkhoa`, `TRUONGKHOA`, `TRUONG_KHOA`).
   - Loại đơn nghỉ phép: **Chỉ dùng duy nhất `nghi_phep`**.
   - Loại đơn đổi ca: **Chỉ dùng duy nhất `doi_ca`**.
10. **Quy Tắc Khi Yêu Cầu Kiểm Tra ("Khi bảo check là chỉ check không sửa" - Check-Only Mode):** Khi người dùng đưa ra yêu cầu có từ khóa "check", "kiểm tra", "rà soát", "soát lại": Agent **CHỈ ĐƯỢC PHÉP đọc, phân tích, đối chiếu logic và báo cáo kết quả** cho người dùng; **TUYỆT ĐỐI KHÔNG tự ý sửa code, không gọi bất kỳ tool chỉnh sửa file nào** (`replace_file_content`, `multi_replace_file_content`, `write_to_file`) trừ khi người dùng có lệnh rõ ràng yêu cầu sửa lỗi ("sửa đi", "fix đi", "cập nhật ngay").
11. **Quy Tắc Chống Trùng Lặp Cú Pháp & Truy Vấn (Anti-Redundancy & Single Canonical Identifier):**
   - **Cấm mảng ánh xạ 2 chiều tự trỏ chính nó:** Không viết các mảng cặp `[['name', 'name'], ...]` khi cả hai phía đã là cùng một ngôn ngữ. Phải dùng mảng 1 chiều phẳng `['name1', 'name2']`.
   - **Cấm cập nhật kép trong `$set`:** Tuyệt đối không truyền cùng lúc cả trường CSDL tiếng Việt và alias tiếng Anh của nó vào `$set` (ví dụ cấm: `{ da_dang_ky_face: true, isFaceRegistered: true }`). Chỉ dùng duy nhất 1 trường chuẩn.
   - **Cấm truy vấn `$or` gom bí danh:** Mongoose Schema Alias đã tự động ánh xạ alias sang cột CSDL. Tuyệt đối không viết `$or` gom tất cả bí danh (như `$or: [{ avatar }, { anh_dai_dien }, { facePhoto }, { anh_khuon_mat }]` hoặc `$or: [{ staffCode }, { employeeCode }, { ma_nhan_vien }, { ma_can_bo }, { email }]`). Chỉ query duy nhất các trường độc lập (như `staffCode` hoặc `email`).
   - **Cấm chuỗi fallback `||` đa tầng rườm rà:** Tuyệt đối không viết các chuỗi `u.fullName || u.ho_ten || ''`, `u.staffCode || u.ma_can_bo || ''`, `dept.name || dept.ten_phong_ban || ''`. Chỉ dùng một thuộc tính chuẩn duy nhất (`u.fullName || ''`, `u.staffCode || ''`).
   - **Không gọi `save()` tài liệu rồi ngay lập tức lại gọi `findByIdAndUpdate()` cho cùng những trường đó.**

