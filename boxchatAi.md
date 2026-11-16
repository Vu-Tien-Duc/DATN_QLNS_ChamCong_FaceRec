# Tài Liệu Thiết Kế & Hướng Dẫn: Trợ Lý AI Đa Năng (AI Chatbox Hub & RAG)
### Đề tài: Hệ Thống Quản Lý Nhân Sự & Chấm Công Khuôn Mặt — Đại Học Nguyễn Trãi
**Sinh viên thực hiện:** Vũ Tiến Đức — **MSV:** 2310900023

---

## 1. Mục Tiêu & Kiến Trúc Tổng Quan
Module **Trợ lý AI Đa Năng (`AiChatBox`)** được tích hợp trực tiếp vào hệ thống quản lý dưới dạng widget nổi đi kèm nhân vật tương tác **Pug (`page-mascot`)**, hỗ trợ Giảng viên và Cán bộ Nhà trường qua **5 chế độ chuyên biệt**:
1. **`hr_work` (Việc trường):** Tự động đối soát CSDL MongoDB v2.5 theo thời gian Việt Nam (UTC+7): lịch dạy trong ngày (lọc ngoại lệ `nghi`/`huy`), số ngày phép năm còn lại (`trang_thai: 'approved'`, `loai_don: 'nghi_phep'`), toàn bộ các ca chấm công trong ngày và quy chế Đại học Nguyễn Trãi.
2. **`research` (Học thuật):** Gợi ý ý tưởng NCKH, xây dựng tổng quan tài liệu, soạn đề cương chi tiết học phần và ngân hàng câu hỏi theo 6 bậc thang Bloom, trích dẫn APA 7th / IEEE.
3. **`survey` (Khảo sát):** Thiết kế bảng hỏi khảo sát ý kiến sinh viên, form đánh giá chất lượng đào tạo theo thang đo Likert 5 mức độ.
4. **`rag_doc` (Tài liệu RAG & Đa phương thức):**
   * **Kho tri thức RAG lâu dài:** Tải lên tài liệu `.pdf`, `.docx`, `.doc`, `.txt`, `.md` để AI đọc, chia đoạn, vector hóa và trả lời kèm trích dẫn nguồn (`Tên tài liệu`, `Trang`). Hỗ trợ 2 phạm vi thực tế: `ca_nhan` (riêng giảng viên) và `toan_truong` (Admin/BGH/TCCB/Đào tạo chia sẻ chung quy chế).
   * **Phân tích & rút gọn nhanh PDF/Word trong ô chat:** Kẹp ghim tệp trực tiếp để nhờ AI tóm tắt ý chính, lập dàn ý, lọc mốc thời gian.
   * **Đọc ảnh (Multimodal Vision OCR & Dịch Tiếng Việt):** Gửi file ảnh (`PNG`, `JPG`, `WEBP`) hoặc dán ảnh từ clipboard (`Ctrl+V`) để AI trích xuất chữ, bảng biểu và dịch sang Tiếng Việt; tự động phát hiện PDF scan dạng ảnh để gửi thẳng cho Gemini Vision đọc.
5. **`general` (Mở rộng):** Giải đáp mọi kiến thức công nghệ, lập trình, đời sống và kỹ năng mềm.

---

## 2. Kết Nối Đa Mô Hình AI (Multi-Model AI Gateway)
Hệ thống sử dụng bộ điều phối [`server/services/ai/aiProvider.service.js`](server/services/ai/aiProvider.service.js) với cơ chế tự động chuyển đổi dự phòng (**Automatic Failover**):

| Nhà cung cấp | Mô hình cấu hình mặc định | Biến `.env` tùy biến | Vai trò & Khả năng |
| :--- | :--- | :--- | :--- |
| **Google Gemini (Chat & Vision)** | `gemini-2.5-flash` $\rightarrow$ `gemini-3.5-flash-lite` $\rightarrow$ `gemini-3.8-flash` | `GEMINI_MODEL`, `GEMINI_API_KEY` | Đa phương thức (Text, Ảnh `inline_data`, PDF Scan OCR), hiểu tiếng Việt tự nhiên. |
| **Google Gemini (Embedding RAG)** | `gemini-embedding-001` | `GEMINI_EMBEDDING_MODEL` | Vector hóa các phân đoạn tài liệu phục vụ tìm kiếm ngữ nghĩa Cosine Similarity. |
| **Groq Cloud** | `llama-3.3-70b-versatile` | `GROQ_API_KEY` | Suy luận tốc độ cao cho tác vụ văn bản và tổng hợp tài liệu thuần text. |
| **DeepSeek** | `deepseek-chat` | `DEEPSEEK_API_KEY` | Tối ưu cho câu hỏi lập trình, kỹ thuật và suy luận chi phí thấp. |
| **Offline Mock Engine** | `rule-based-v1` | *(Tích hợp sẵn)* | Dự phòng khi ngoại tuyến/chưa cấu hình API Key: vẫn đối soát CSDL v2.5, trích lục RAG bằng từ khóa và rút gọn sơ bộ văn bản PDF/Word. |

---

## 3. Cấu Trúc Dữ Liệu MongoDB Cho RAG (Chuẩn CSDL v2.5 Tiếng Việt)
Tách biệt 2 collection nhằm đảm bảo truy vấn danh sách tài liệu nhẹ, không vướng giới hạn 16MB/document và hỗ trợ tìm kiếm Hybrid Search:

1. **`tai_lieu_rag` ([`server/models/taiLieuRag.model.js`](server/models/taiLieuRag.model.js)):**
   * Lưu metadata tệp: `tieu_de`, `ten_tep_goc`, `loai_tep` (`pdf`, `docx`, `doc`, `txt`, `md`), `mime_type`, `kich_thuoc_byte`, `ma_bam_sha256` (chống tải trùng lặp).
   * Phân quyền & trạng thái: `nguoi_tai_id` (`ref: 'nguoi_dung'`), `pham_vi` (`ca_nhan` | `toan_truong`), `tom_tat`, `tong_ky_tu`, `tong_so_doan`, `phuong_thuc_trich_xuat` (`text_parser` | `gemini_ocr`), `mo_hinh_embedding`, `trang_thai` (`dang_xu_ly` | `san_sang` | `loi`).
2. **`phan_doan_tai_lieu` ([`server/models/phanDoanTaiLieu.model.js`](server/models/phanDoanTaiLieu.model.js)):**
   * Lưu các phân đoạn ~900 ký tự (chồng lấn 150 ký tự): `tai_lieu_id` (`ref: 'tai_lieu_rag'`), `thu_tu`, `noi_dung`, `do_dai`, `so_trang_uoc_luong`, `vector_nhung` (`[Number]`, `select: false`), `tu_khoa` (`[String]`, indexed).

---

## 4. Cấu Hình Biến Môi Trường (`.env`)
```env
# Nhà cung cấp mặc định: gemini | groq | deepseek
AI_DEFAULT_PROVIDER=gemini

# Khóa API & Model Google Gemini (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Khóa API Groq Cloud & DeepSeek (Dự phòng văn bản)
GROQ_API_KEY=your_groq_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

---

## 5. Kiến Trúc Triển Khai & Tệp Mã Nguồn Thực Tế

### Backend (`server/`)
* **Models:** `server/models/taiLieuRag.model.js`, `server/models/phanDoanTaiLieu.model.js`.
* **Services (`server/services/ai/`):**
  * `aiDocumentParser.service.js`: Đọc Buffer trên RAM bằng `pdf-parse` v2 (`PDFParse`), `mammoth` (`.docx`), `word-extractor` (`.doc`), nhận diện PDF scan ít chữ (`isLikelyScanned`), tách từ khóa tiếng Việt không dấu và chunking theo ranh giới đoạn/câu.
  * `aiRag.service.js`: Nạp nguyên tử (`dang_xu_ly` $\rightarrow$ `san_sang`), chống trùng SHA-256, tìm kiếm lai **Hybrid Search** (65% Cosine Similarity + 35% đối khớp từ khóa/cụm từ), tự nhận diện câu hỏi tóm tắt tài liệu đang chọn, CRUD theo phân quyền.
  * `aiProvider.service.js`: AI Gateway đa mô hình, Gemini Vision (`inline_data` ảnh/PDF scan) và `embedBatchWithGemini`.
  * `aiContext.service.js`: Trích xuất dữ liệu giảng viên từ CSDL v2.5 (`User`, `Schedule`, `Subject`, `LeaveRequest`, `AttendanceLog`), chèn thẻ phân tách chống Prompt Injection (`<tai_lieu_tham_khao>`, `<tai_lieu_dinh_kem>`).
* **Controller & Routes:**
  * [`server/controllers/ai.controller.js`](server/controllers/ai.controller.js) & [`server/routes/ai.routes.js`](server/routes/ai.routes.js) (dùng `multer.memoryStorage()` riêng cho AI, tối đa 10MB, bảo vệ bởi `verifyToken` & `aiChatRateLimit`):
    * `GET /api/ai/modes`, `GET /api/ai/providers`
    * `POST /api/ai/chat` (hỗ trợ cả JSON thuần và `multipart/form-data` kèm file)
    * `GET /api/ai/documents`, `POST /api/ai/documents`, `GET /api/ai/documents/:id`, `DELETE /api/ai/documents/:id`

### Frontend (`src/`)
* [`src/api/ai.api.ts`](src/api/ai.api.ts): API client hỗ trợ `FormData` upload và CRUD kho tài liệu RAG.
* [`src/components/AiChatBox/AiChatBox.tsx`](src/components/AiChatBox/AiChatBox.tsx):
  * Tích hợp **Mascot Pug** (`page-mascot`: `pug-directions.webp`, `pug-reactions.webp`) dõi mắt theo con trỏ chuột khi đóng và ngồi trên đỉnh hộp thoại khi mở.
  * Giao diện phẳng chuẩn hệ thống: thanh 5 chế độ, khay **Kho Tài Liệu RAG** (tải lên, chọn tài liệu nguồn, xóa), nút kẹp ghim (`📎`) & dán ảnh (`Ctrl+V`), preview ảnh/file kèm nút gợi ý thao tác nhanh và nút `+ Lưu Kho RAG`, hiển thị thẻ nguồn trích dẫn dưới câu trả lời.

### Kiểm Thử Tự Động (`server/tests/`)
* `server/tests/aiDocumentParser.test.js`: Kiểm thử Schema `AiDocument`/`AiDocumentChunk`, nhận diện tệp, tách từ khóa tiếng Việt, đọc PDF/TXT buffer và chunking theo trang (**5/5 PASS**).
* `server/tests/aiRagAndVision.test.js`: Kiểm thử phân quyền phạm vi toàn trường, Cosine Similarity, Hybrid Search, thẻ chống Prompt Injection, model chain và Offline Fallback (**5/5 PASS**).
* `server/tests/aiChatBoxComprehensive.test.js`: Kiểm thử 5 chế độ, Context Injector CSDL v2.5, Smart Mock, AI Gateway Failover và Controller validation kể cả gửi ảnh, file đính kèm và PDF hỏng trả mã `400` (**100% PASS**).

---

## 6. Kịch Bản Trình Diễn Trước Hội Đồng (Demo Script)

1. **Tra cứu việc trường (`hr_work`):** Hỏi *"Hôm nay tôi có lịch dạy những ca nào?"* hoặc *"Tôi còn bao nhiêu ngày phép năm?"* $\rightarrow$ AI đối soát đúng `ten_mon`, `ma_mon`, `trang_thai: 'approved'` trong CSDL v2.5.
2. **Đọc ảnh & Dịch sang Tiếng Việt:** Chụp ảnh một đoạn văn bản hoặc slide tiếng Anh, bấm `Ctrl+V` dán thẳng vào ô chat AI Box $\rightarrow$ bấm gợi ý *"Đọc chữ trong ảnh và dịch sang Tiếng Việt"* $\rightarrow$ Gemini Vision OCR và dịch chuẩn xác.
3. **Phân tích nhanh & Lưu Kho RAG:** Đính kèm file PDF/Word đề cương hoặc quy chế nhà trường $\rightarrow$ bấm *"Phân tích & rút gọn 5 ý chính"* hoặc bấm **`+ Lưu Kho RAG`** để hỏi đáp chi tiết có trích dẫn số trang.
4. **Chứng minh Tự phục hồi lỗi (Failover):** Khi ngắt API Key bên ngoài, hệ thống tự chuyển về `offline_mock` vẫn trích xuất được văn bản PDF/Word và tra cứu các đoạn RAG khớp từ khóa mà không bị lỗi 500.
