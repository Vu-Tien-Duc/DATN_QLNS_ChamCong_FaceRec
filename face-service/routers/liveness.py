"""
Router Kiểm tra tính sống Liveness độc lập (Anti-Spoofing)
"""
import asyncio
from typing import Annotated, Any, Dict
from fastapi import APIRouter, File, HTTPException, UploadFile
import numpy as np
from services.face_engine import face_engine
from services.liveness import LivenessChecker

router = APIRouter(tags=["Liveness"])


@router.post("/v1/face/liveness")
async def check_face_liveness(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Kiểm tra độc lập liveness / chống giả mạo."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    if not faces:
        raise HTTPException(status_code=400, detail="Không tìm thấy khuôn mặt trong ảnh.")

    face = face_engine.select_dominant_face(faces) or faces[0]
    box = [round(float(v), 2) for v in np.asarray(face.bbox, dtype=np.float32).tolist()]
    return LivenessChecker.check_liveness(decoded, box)
