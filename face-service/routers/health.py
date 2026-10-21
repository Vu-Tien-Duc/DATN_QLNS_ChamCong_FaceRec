"""
Router Kiểm tra tình trạng sức khỏe dịch vụ (Health Check)
"""
from typing import Any, Dict
from fastapi import APIRouter
from config import DETECTION_SIZE, MODEL_NAME
from services.face_engine import face_engine
from services.vector_index import vector_index

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/v1/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "InsightFace Attendance Microservice",
        "model": MODEL_NAME,
        "detection_size": DETECTION_SIZE,
        "ready": face_engine.is_ready(),
        "index": vector_index.stats(),
    }
