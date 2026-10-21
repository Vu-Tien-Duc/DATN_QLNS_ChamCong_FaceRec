"""
=============================================================================
HỆ THỐNG ĐIỂM DANH & QUẢN LÝ NHÂN SỰ - THỊ GIÁC MÁY TÍNH
Module AI: FastAPI InsightFace Microservice (Lightweight & High-Performance)
Tác giả đồ án: Vũ Tiến Đức - MSV: 2310900023
Kiến trúc: Chuẩn RESTful Face AI Đa Nhiệm Vụ (Tách module routers & services:
Health, 3D Pose, Enrollment, Recognition 1:N, Verify 1:1, In-Memory RAM Index, Anti-Spoofing)
=============================================================================
"""
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from config import DETECTION_SIZE, MODEL_NAME
from routers import (
    enrollment_router,
    faiss_router,
    health_router,
    liveness_router,
    pose_router,
    recognition_router,
)
from services.face_engine import face_engine
from services.vector_index import vector_index

# Thiết lập encoding utf-8 cho terminal
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Khởi tạo mô hình InsightFace tối ưu cực nhẹ trên CPU
    face_engine.initialize()
    print(
        f"[Face AI] [OK] Ready! Model: {MODEL_NAME} ({DETECTION_SIZE}x{DETECTION_SIZE}) | Modular Microservice | http://127.0.0.1:8001/docs",
        flush=True,
    )
    yield
    face_engine.shutdown()


app = FastAPI(
    title="Face Recognition & Attendance Service (InsightFace)",
    description="Dịch vụ nhận diện khuôn mặt chấm công & thị giác máy tính - Đồ án tốt nghiệp Vũ Tiến Đức (2310900023)",
    version="2.5.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root_redirect():
    return RedirectResponse(url="/docs")


# Đăng ký các Router nghiệp vụ chuyên biệt
app.include_router(health_router)
app.include_router(pose_router)
app.include_router(enrollment_router)
app.include_router(recognition_router)
app.include_router(faiss_router)
app.include_router(liveness_router)

# Biến tương thích ngược cho các module bên ngoài
model = face_engine.model
