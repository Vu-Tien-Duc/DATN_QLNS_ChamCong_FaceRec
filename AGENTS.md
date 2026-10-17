# Hướng Dẫn Hoạt Động (Workspace Guidelines)

## Quy Tắc Nghiệm Thu & Hoàn Tất Tác Vụ (Post-Task Rule)
Mỗi khi hoàn thành một nhiệm vụ lập trình hoặc sửa lỗi:
1. **Dọn dẹp file:** Tự động kiểm tra và xóa bỏ tất cả các file thử nghiệm tạm thời, file nháp, file trùng lặp hoặc không còn sử dụng.
2. **Kiểm tra biên dịch:** Luôn luôn chạy `npm run build` để kiểm tra toàn bộ mã nguồn.
3. **Tự sửa lỗi:** Nếu `npm run build` phát hiện bất kỳ lỗi TypeScript, cú pháp hoặc đóng gói nào, lập tức sửa lỗi và chạy lại build cho đến khi thành công 100%.
4. **Cập nhật nhật ký tiến độ (`word.md`):** File `word.md` tại thư mục gốc là nơi duy nhất để ghi lại tất cả các công việc đã làm từ lúc chốt CSDL v2.5 đến nay. Phải ghi đúng tiến độ theo ngày tháng thực hiện. Nếu có bất kỳ thay đổi nào về kiến trúc, mã nguồn hay quy trình, lập tức xóa bỏ phần cũ và cập nhật lại file `word.md` cho chuẩn xác 100%.
5. **Quy trình thay thế & xóa file cũ (services, controllers, utils, routes, middlewares, config):**
   - Khi viết lại một module mới theo CSDL v2.5 mà trùng tên file cũ: Hãy đổi tên file cũ bằng cách thêm hậu tố `.old.js` (hoặc `_old.js`) vào cuối tên file để tham khảo logic cũ khi cần.
   - Ngay sau khi file mới đã hoàn thành, kế thừa và tích hợp đủ tài nguyên cần thiết: **Bắt buộc xóa bỏ hoàn toàn file cũ (`*.old.*`) khỏi dự án**. Tuyệt đối không giữ lại file rác, file mã nguồn cũ để tránh rối loạn cấu trúc, thừa dữ liệu và phát sinh lỗi sai lệch sau này.
