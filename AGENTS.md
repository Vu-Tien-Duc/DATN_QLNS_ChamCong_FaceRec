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

