# =============================================================================
# Dockerfile cho Python FastAPI Face Service (InsightFace Microservice)
# Đồ án tốt nghiệp: Vũ Tiến Đức - MSV: 2310900023
# Base: Python 3.10 slim tối ưu tài nguyên CPU, ArcFace 512D & FAISS RAM Index
# =============================================================================

FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001 \
    FACE_MODEL_NAME=buffalo_s \
    FACE_DETECTION_SIZE=320 \
    FACE_MATCH_THRESHOLD=0.45

# Cài đặt thư viện hệ thống cần thiết cho OpenCV, ONNXRuntime và build InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài đặt các thư viện Python trước để tận dụng Docker cache layer
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Sao chép mã nguồn dịch vụ
COPY . .

# Mở cổng dịch vụ
EXPOSE 8001

# Kiểm tra tình trạng dịch vụ (Healthcheck)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Khởi chạy dịch vụ FastAPI bằng Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
