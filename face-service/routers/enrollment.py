"""
Router Đăng ký khuôn mặt đa góc và trích xuất vector ArcFace (Enrollment)
"""
import asyncio
from typing import Annotated, Any, Dict, Optional
from fastapi import APIRouter, File, Form, UploadFile
import numpy as np
from services.face_engine import face_engine
from services.vector_index import vector_index

router = APIRouter(tags=["Enrollment"])


@router.post("/v1/face/enroll")
async def enroll_single_face(
    image: Annotated[UploadFile, File()],
    employee_id: Annotated[str, Form()],
    full_name: Annotated[Optional[str], Form()] = None,
) -> Dict[str, Any]:
    """Đăng ký khuôn mặt đơn lẻ và trích xuất vector ArcFace 512D."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    if not faces:
        return {"success": False, "message": "Không tìm thấy khuôn mặt trong ảnh.", "face_detected": False}

    face = face_engine.select_dominant_face(faces) or faces[0]
    emb = face_engine.get_embedding(face)
    meta = face_engine.build_face_metadata(decoded, face)

    # Nạp ngay vào RAM Vector Index
    vector_index.add_user_template(user_id=employee_id, embedding=emb.tolist(), full_name=full_name, employee_id=employee_id)

    return {
        "success": True,
        "employee_id": employee_id,
        "full_name": full_name,
        "face_detected": True,
        "embedding": emb.tolist(),
        **meta,
    }


@router.post("/v1/face/enroll-multi-angle")
async def enroll_multi_angle(
    image_straight: Optional[UploadFile] = File(None),
    image_left: Optional[UploadFile] = File(None),
    image_right: Optional[UploadFile] = File(None),
    image_up: Optional[UploadFile] = File(None),
    image_down: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    employee_id: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """Đăng ký 5 góc khuôn mặt (Chính diện, Trái, Phải, Ngửa lên, Cúi xuống)."""
    angle_files = {
        "straight": image_straight or image,
        "left": image_left,
        "right": image_right,
        "up": image_up,
        "down": image_down,
    }

    results = {}
    registered_vectors = []

    for pose_key, img_file in angle_files.items():
        if img_file is None:
            continue
        try:
            decoded = await face_engine.read_image_file(img_file)
            faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
            if not faces:
                results[pose_key] = {"status": "no_face", "embedding": None}
                continue
            face = face_engine.select_dominant_face(faces) or faces[0]
            emb = face_engine.get_embedding(face)
            meta = face_engine.build_face_metadata(decoded, face)
            results[pose_key] = {
                "status": "success",
                "embedding": emb.tolist(),
                **meta,
            }
            registered_vectors.append(emb.tolist())
        except Exception as e:
            results[pose_key] = {"status": "error", "error": str(e)}

    # Tính vector trung bình chuẩn hóa L2 (ArcFace 512D)
    avg_embedding = None
    if registered_vectors:
        vecs_arr = np.asarray(registered_vectors, dtype=np.float32)
        mean_vec = np.mean(vecs_arr, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 0:
            mean_vec = mean_vec / norm
        avg_embedding = mean_vec.tolist()

    return {
        "status": "success",
        "processedAngles": list(results.keys()),
        "angles": results,
        "average_embedding": avg_embedding,
        "total_vectors": len(registered_vectors),
    }


@router.post("/v1/faces/extract")
async def extract_face(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Trích xuất vector ArcFace 512D kèm góc pose và chất lượng."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "embedding": None}

    primary_face = face_engine.select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return {"status": "multiple_faces", "faceCount": len(faces), "embedding": None}

    face = primary_face or faces[0]
    emb = face_engine.get_embedding(face)
    meta = face_engine.build_face_metadata(decoded, face)

    return {
        "status": "face_detected",
        "faceCount": 1,
        **meta,
        "embedding": emb.tolist(),
        "embeddingDimensions": int(emb.size),
    }
