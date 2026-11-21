"""
Router Đăng ký khuôn mặt đa góc và trích xuất vector ArcFace (Enrollment)
"""
import asyncio
from typing import Annotated, Any, Dict, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import numpy as np
from config import CROSS_ANGLE_MIN_SIMILARITY
from services.face_engine import face_engine
from services.vector_index import vector_index

router = APIRouter(tags=["Enrollment"])


def _validate_enrollment_face(decoded: np.ndarray, faces: list, label: str = "ảnh"):
    """Kiểm tra chặt chẽ 1 khuôn mặt duy nhất, liveness và chất lượng ảnh trước khi trích xuất vector đăng ký."""
    if not faces:
        raise HTTPException(status_code=400, detail=f"FACE_NOT_FOUND: Không tìm thấy khuôn mặt trong {label}.")

    primary = face_engine.select_dominant_face(faces)
    if primary is None and len(faces) > 1:
        raise HTTPException(
            status_code=400,
            detail=f"MULTIPLE_FACES: Phát hiện nhiều khuôn mặt cùng kích thước trong {label}. Vui lòng chỉ để 1 người trong khung hình.",
        )

    face = primary or faces[0]
    meta = face_engine.build_face_metadata(decoded, face)

    if not meta["liveness"].get("is_live", False):
        raise HTTPException(
            status_code=400,
            detail=f"SPOOF_DETECTED: {label.capitalize()} có dấu hiệu ảnh in / màn hình hoặc không phải người thật.",
        )

    if not meta["quality"].get("valid", True):
        reasons = "; ".join(meta["quality"].get("reasons", [])) or "chất lượng ảnh kém"
        raise HTTPException(
            status_code=400,
            detail=f"POOR_QUALITY: {label.capitalize()} không đạt chuẩn ({reasons}).",
        )

    emb = face_engine.get_embedding(face)
    return emb, meta


@router.post("/v1/face/enroll")
async def enroll_single_face(
    image: Annotated[UploadFile, File()],
    employee_id: Annotated[str, Form()],
    full_name: Annotated[Optional[str], Form()] = None,
) -> Dict[str, Any]:
    """Đăng ký khuôn mặt đơn lẻ và trích xuất vector ArcFace 512D."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    emb, meta = _validate_enrollment_face(decoded, faces, "ảnh đăng ký")

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
    """Đăng ký 5 góc khuôn mặt (Chính diện, Trái, Phải, Ngửa lên, Cúi xuống) kèm kiểm tra đồng nhất danh tính chéo."""
    angle_files = {
        "straight": image_straight or image,
        "left": image_left,
        "right": image_right,
        "up": image_up,
        "down": image_down,
    }

    pose_labels = {
        "straight": "góc chính diện",
        "left": "góc nghiêng trái",
        "right": "góc nghiêng phải",
        "up": "góc ngửa lên",
        "down": "góc cúi xuống",
    }

    submitted = {k: v for k, v in angle_files.items() if v is not None}
    if not submitted:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên ít nhất một ảnh khuôn mặt.")

    results = {}
    embeddings_by_pose: Dict[str, np.ndarray] = {}

    for pose_key, img_file in submitted.items():
        decoded = await face_engine.read_image_file(img_file)
        faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
        emb, meta = _validate_enrollment_face(decoded, faces, pose_labels.get(pose_key, pose_key))
        embeddings_by_pose[pose_key] = emb
        results[pose_key] = {
            "status": "success",
            "embedding": emb.tolist(),
            **meta,
        }

    # Kiểm tra Cross-Angle Consistency: mọi góc phụ phải khớp cùng 1 người với góc chuẩn (straight hoặc góc đầu tiên)
    ref_pose = "straight" if "straight" in embeddings_by_pose else next(iter(embeddings_by_pose))
    ref_vec = embeddings_by_pose[ref_pose]
    for pose_key, emb in embeddings_by_pose.items():
        if pose_key == ref_pose:
            continue
        cross_sim = float(np.dot(ref_vec, emb))
        results[pose_key]["cross_angle_similarity"] = round(cross_sim, 4)
        if cross_sim < CROSS_ANGLE_MIN_SIMILARITY:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"CROSS_ANGLE_IDENTITY_MISMATCH: Ảnh {pose_labels.get(pose_key, pose_key)} không cùng một người với {pose_labels.get(ref_pose, ref_pose)} "
                    f"(độ tương đồng {cross_sim:.3f} < {CROSS_ANGLE_MIN_SIMILARITY})."
                ),
            )

    registered_vectors = [emb.tolist() for emb in embeddings_by_pose.values()]

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
