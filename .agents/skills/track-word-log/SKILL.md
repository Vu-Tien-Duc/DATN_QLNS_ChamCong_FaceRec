---
name: track-word-log
description: >-
  Quy tắc bắt buộc: Duy trì và cập nhật liên tục file word.md tại thư mục gốc của dự án.
  File word.md là nơi duy nhất để ghi nhận toàn bộ tiến độ công việc đã thực hiện, thay đổi kiến trúc và trạng thái kiểm thử theo đúng ngày tháng thực tế.
---

# Quy Tắc Cập Nhật & Quản Lý File `word.md`

File [word.md](file:///d:/DATN_VuTienDuc_2310900023/DATN_QLNS_ChamCong_FaceRec/word.md) tại thư mục gốc của dự án là tài liệu duy nhất và chính thức ghi lại toàn bộ tiến độ công việc thực tế kể từ mốc chốt cơ sở dữ liệu v2.5.

---

## 📌 Các Nguyên Tắc Bắt Buộc

1. **Ghi Đúng Tiến Độ Theo Ngày Tháng Thực Tế:**
   - Mỗi hạng mục công việc hoàn thành phải được gắn đúng với mốc thời gian thực hiện (ví dụ: `Ngày 15/10/2026`, `Ngày 16/10/2026`...).
   - Không được ghi lùi ngày hoặc ghi sai lệch mốc thời gian thực hiện.

2. **Cập Nhật Khi Có Thay Đổi:**
   - Khi có bất kỳ thay đổi nào trong mã nguồn (sửa model, đổi quy trình, thêm nghiệp vụ, refactor code, thêm test suite), AI **bắt buộc phải xóa bỏ các nội dung cũ lỗi thời và viết lại/cập nhật bổ sung vào file `word.md` ngay lập tức**.
   - Nội dung trong `word.md` phải luôn luôn phản ánh đúng 100% hiện trạng thực tế của codebase.

3. **Cấu Trúc Bắt Buộc Của File `word.md`:**
   - **Phần đầu:** Tiêu đề đồ án, người thực hiện, mã sinh viên, tài liệu tham chiếu (`THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md`).
   - **Các phần theo ngày:**
     - Mô tả chi tiết những gì đã làm, lý do kỹ thuật, các file đã tạo hoặc chỉnh sửa.
     - Các quy trình nghiệp vụ và thuật toán lõi đã triển khai (ví dụ: Token Rotation, L2 Centroid, Chống trùng lặp sinh trắc học, Chống xung đột TKB, Margin Top 1-2, Cooldown 60s...).
   - **Phần tổng hợp kiểm thử & nghiệm thu:**
     - Danh mục các test suite tự động (`npm test`) và kết quả chạy.
     - Trạng thái biên dịch (`npm run build`).

---

## 🚀 Quy Trình Thực Hiện Sau Mỗi Lượt Tác Vụ

1. Hoàn tất mã nguồn & viết test tương ứng.
2. Chạy `npm test` để đảm bảo toàn bộ test suites đều PASS 100%.
3. Chạy `npm run build` để đảm bảo không có lỗi TypeScript hoặc đóng gói.
4. **Mở và cập nhật file `word.md`:**
   - Thêm nội dung công việc mới làm vào đúng ngày hiện tại.
   - Nếu có logic cũ bị thay thế hoặc xóa bỏ, sửa lại nội dung tương ứng trong `word.md`.
