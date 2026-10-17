# Python Face Recognition Service (InsightFace Lightweight)

Dịch vụ AI FastAPI nhận diện khuôn mặt chấm công và xử lý thị giác máy tính - Đồ án tốt nghiệp Vũ Tiến Đức (2310900023).

## Cải tiến & Tối ưu Siêu nhẹ (High-Performance & Lightweight)

1. **Model Nhẹ:** Chuyển sang mô hình ArcFace `buffalo_s` (MobileFaceNet ~13MB, nhẹ hơn 10 lần so với ResNet50 ~170MB).
2. **Khởi Động Nhanh:** Chỉ nạp 2 module cốt lõi `allowed_modules=['detection', 'recognition']`, bỏ qua các mô hình landmark 3D (130MB) và gender/age không cần thiết, giảm >80% RAM.
3. **Inference Realtime:** `det_size=(320, 320)` tăng tốc độ khung hình từ 2-3 fps lên 15-25 fps trên CPU thông thường.
4. **Vector Store RAM Siêu Tốc:** Sử dụng Pure NumPy Inner Product L2-normalized vector search trong RAM, tìm kiếm trên 2.000 nhân sự chỉ mất < 1ms, không còn phụ thuộc thư viện C++ FAISS nặng nề.

---

## Danh Sách API Chấm Công Chuẩn (Chuẩn RESTful Face AI)

### 1. Nhận diện chấm công 1:N (Face Recognition)
- **POST `/v1/face/recognize`**
  - Form-data: `image` (File ảnh camera chấm công)
  - Query params: `threshold=0.45`, `check_liveness=true`, `check_quality=true`
  - Kết quả: Trả về `matched`, `employee_id`, `userId`, `full_name`, `similarity`, `liveness_passed`, `face_box`, danh sách `candidates`.

### 2. Đối soát khuôn mặt 1:1 (Face Verification)
- **POST `/v1/face/verify`**
  - Form-data: `image`, `employee_id`
  - Query params: `threshold=0.45`, `check_liveness=true`
  - Kết quả: Trả về `matched` (true/false), `similarity`, `liveness_passed`, `face_box`.

### 3. Nhận diện góc đầu 3D & Bounding Box realtime
- **POST `/v1/face/detect-pose`**
  - Form-data: `image` (Frame webcam liên tục từ client)
  - Kết quả: Trả về `face_detected`, `detectedPose` (`chinh_dien`, `nghieng_trai`, `nghieng_phai`, `ngua_len`, `cui_xuong`), các góc Euler `yaw_deg`, `pitch_deg`, `roll_deg`, cùng trạng thái chất lượng ánh sáng/độ nét.

### 4. Đăng ký khuôn mặt đa góc (5 góc)
- **POST `/v1/face/enroll-multi-angle`**
  - Form-data: `image_straight`, `image_left`, `image_right`, `image_up`, `image_down`, `employee_id`, `full_name`
  - Kết quả: Trích xuất vector 512D ArcFace cho từng góc và tự động nạp vào bộ nhớ RAM.

### 5. Đồng bộ Vector Store RAM từ MongoDB
- **POST `/v1/face/sync`**: Nhận danh sách vector nhân sự từ MongoDB để nạp vào bộ nhớ RAM ma trận `(N, 512)` sẵn sàng so khớp O(1).
- **GET `/health`**: Kiểm tra trạng thái sẵn sàng của service (`status: healthy`, `total_vectors`). Nếu `total_vectors === 0`, Backend Node.js sẽ tự động trigger sync lại.

*(Lưu ý: Hệ thống đã loại bỏ hoàn toàn các endpoint cũ `/v1/faces/extract`, `/v1/faces/identify` và tiền tố `/v1/faiss/*` để sử dụng duy nhất một bộ RESTful API chuẩn `/v1/face/*` đồng bộ với đặc tả v2.5).*

---

## Hướng Dẫn Cài Đặt & Chạy

Từ thư mục gốc dự án:
```powershell
# Cài đặt thư viện Python (nhẹ, không cần cài faiss-cpu)
pip install -r face-service/requirements.txt

# Khởi chạy toàn bộ hệ thống (Node.js + React + Python Face Service)
npm run dev
```

Hoặc chạy riêng lẻ Python Face Service:
```powershell
uvicorn app:app --app-dir face-service --host 127.0.0.1 --port 8001 --reload
```

Tài liệu Swagger UI tương tác trực quan: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)
