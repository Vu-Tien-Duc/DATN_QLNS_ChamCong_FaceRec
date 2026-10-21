"""
Router Chấm công nhận diện 1:N và Xác thực 1:1 (Recognition & Verification)
"""
import asyncio
import json
from typing import Annotated, Any, Dict, List
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
import numpy as np

from config import MARGIN_TOP1_TOP2, MATCH_THRESHOLD
from schemas import BoundingBoxDict, CandidateItem, FaceRecognizeResponse, FaceVerifyResponse
from services.face_engine import face_engine
from services.vector_index import vector_index

router = APIRouter(tags=["Recognition"])


@router.post("/v1/face/recognize", response_model=FaceRecognizeResponse, summary="Chấm công nhận diện 1:N (Face Recognition)")
async def recognize_face(
    image: Annotated[UploadFile, File(description="Ảnh chụp camera chấm công")],
    threshold: float = Query(MATCH_THRESHOLD, description="Ngưỡng tương đồng cosine"),
    check_liveness: bool = Query(True, description="Kiểm tra chống giả mạo liveness"),
    check_quality: bool = Query(True, description="Kiểm tra chất lượng ảnh"),
) -> FaceRecognizeResponse:
    """
    Nhận diện khuôn mặt chấm công 1:N:
    1. Phát hiện khuôn mặt InsightFace
    2. Kiểm tra chất lượng & liveness chống giả mạo
    3. Trích xuất vector 512D ArcFace
    4. So khớp cực nhanh với kho vector nhân sự trong RAM
    """
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)

    if not faces:
        return FaceRecognizeResponse(
            matched=False,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=False,
            liveness_score=0.0,
            reasons=["FACE_NOT_FOUND: Không tìm thấy khuôn mặt trong ảnh."],
        )

    primary_face = face_engine.select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return FaceRecognizeResponse(
            matched=False,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=False,
            liveness_score=0.0,
            reasons=["MULTIPLE_FACES: Phát hiện nhiều người trong khung hình chấm công."],
        )

    face = primary_face or faces[0]
    meta = face_engine.build_face_metadata(decoded, face)
    box = meta["box"]
    bbox_dict = BoundingBoxDict(
        x=int(box[0]),
        y=int(box[1]),
        width=int(box[2] - box[0]),
        height=int(box[3] - box[1]),
    )

    reasons: List[str] = []

    # 1. Kiểm tra Liveness
    liveness_passed = True
    liveness_score = float(meta["liveness"].get("score", 1.0))
    if check_liveness and not meta["liveness"].get("is_live", True):
        liveness_passed = False
        reasons.append(f"SPOOF_DETECTED: Phát hiện ảnh giả mạo hoặc màn hình (Score: {liveness_score})")

    # 2. Kiểm tra chất lượng (cảnh báo)
    if check_quality and not meta["quality"].get("valid", True):
        reasons.extend(meta["quality"].get("reasons", []))

    # 3. Trích xuất đặc trưng ArcFace 512D
    query_emb = face_engine.get_embedding(face)

    # 4. Tìm kiếm trong RAM Vector Store
    candidates_raw = vector_index.search(query_emb, top_k=5)
    candidates = [CandidateItem(**c) for c in candidates_raw]

    if not candidates:
        return FaceRecognizeResponse(
            matched=False,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=liveness_passed,
            liveness_score=liveness_score,
            face_box=bbox_dict,
            candidates=[],
            reasons=reasons or ["NO_MATCH: Chưa có dữ liệu nhân sự trong hệ thống."],
        )

    best_match = candidates[0]
    is_matched = bool(best_match.similarity >= threshold and liveness_passed)

    # Kiểm tra Margin Top 1 - Top 2 (Chống nhận diện nhầm người khi 2 hồ sơ có độ tương đồng quá sát nhau)
    if is_matched and len(candidates) > 1:
        second_match = candidates[1]
        if second_match.userId != best_match.userId and second_match.employee_id != best_match.employee_id:
            margin = best_match.similarity - second_match.similarity
            if margin < MARGIN_TOP1_TOP2:
                is_matched = False
                reasons.append(
                    f"AMBIGUOUS_MATCH: Độ chênh lệch giữa Top 1 ({best_match.similarity:.3f}) và Top 2 ({second_match.similarity:.3f}) là {margin:.3f} < ngưỡng {MARGIN_TOP1_TOP2}. Hệ thống từ chối để chống nhận diện nhầm người."
                )

    if not is_matched and best_match.similarity < threshold:
        reasons.append("Khuôn mặt không khớp với hồ sơ nhân sự nào.")

    return FaceRecognizeResponse(
        matched=is_matched,
        employee_id=best_match.employee_id if is_matched else None,
        userId=best_match.userId if is_matched else None,
        full_name=best_match.full_name if is_matched else None,
        similarity=best_match.similarity,
        threshold=threshold,
        liveness_passed=liveness_passed,
        liveness_score=liveness_score,
        candidates=candidates,
        face_box=bbox_dict,
        reasons=reasons,
    )


@router.post("/v1/face/verify", response_model=FaceVerifyResponse, summary="Xác thực khuôn mặt 1:1 theo mã NV (Face Verification)")
async def verify_face(
    image: Annotated[UploadFile, File(description="Ảnh chụp")],
    employee_id: Annotated[str, Form(description="Mã nhân viên cần đối soát")],
    threshold: float = Query(MATCH_THRESHOLD, description="Ngưỡng tương đồng"),
    check_liveness: bool = Query(True, description="Kiểm tra liveness"),
) -> FaceVerifyResponse:
    """Xác thực 1:1 khuôn mặt người trong ảnh có đúng là nhân viên `employee_id` hay không."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)

    if not faces:
        return FaceVerifyResponse(
            matched=False,
            employee_id=employee_id,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=False,
            liveness_score=0.0,
            reasons=["FACE_NOT_FOUND: Không tìm thấy khuôn mặt trong ảnh."],
        )

    face = face_engine.select_dominant_face(faces) or faces[0]
    meta = face_engine.build_face_metadata(decoded, face)
    box = meta["box"]
    bbox_dict = BoundingBoxDict(
        x=int(box[0]),
        y=int(box[1]),
        width=int(box[2] - box[0]),
        height=int(box[3] - box[1]),
    )

    reasons: List[str] = []
    liveness_passed = True
    liveness_score = float(meta["liveness"].get("score", 1.0))
    if check_liveness and not meta["liveness"].get("is_live", True):
        liveness_passed = False
        reasons.append("SPOOF_DETECTED: Phát hiện ảnh giả mạo.")

    query_emb = face_engine.get_embedding(face)

    # Tìm kiếm đối chiếu với vector trong RAM
    candidates = vector_index.search(query_emb, top_k=10)
    matched_candidate = next((c for c in candidates if c["employee_id"] == employee_id or c["userId"] == employee_id), None)

    if not matched_candidate:
        return FaceVerifyResponse(
            matched=False,
            employee_id=employee_id,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=liveness_passed,
            liveness_score=liveness_score,
            face_box=bbox_dict,
            reasons=reasons or ["EMPLOYEE_NOT_MATCH: Không khớp với mã nhân viên yêu cầu."],
        )

    similarity = matched_candidate["similarity"]
    is_matched = bool(similarity >= threshold and liveness_passed)

    return FaceVerifyResponse(
        matched=is_matched,
        employee_id=employee_id,
        full_name=matched_candidate.get("full_name"),
        similarity=similarity,
        threshold=threshold,
        liveness_passed=liveness_passed,
        liveness_score=liveness_score,
        face_box=bbox_dict,
        reasons=reasons,
    )


@router.post("/v1/faces/identify")
async def identify_face(
    image: Annotated[UploadFile, File()],
    templates_json: Annotated[str, Form(alias="templates")],
) -> Dict[str, Any]:
    """So khớp khuôn mặt trực tiếp với danh sách templates gửi kèm."""
    try:
        raw_templates = json.loads(templates_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail="templates phải là chuỗi JSON hợp lệ.") from e

    if not isinstance(raw_templates, list) or not raw_templates:
        raise HTTPException(status_code=400, detail="templates không được rỗng.")

    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "matched": False, "match": None}

    face = face_engine.select_dominant_face(faces) or faces[0]
    query_emb = face_engine.get_embedding(face)

    user_ids = []
    matrix_rows = []
    for t in raw_templates:
        uid = str(t.get("userId", "")).strip()
        emb = t.get("embedding")
        if uid and emb:
            user_ids.append(uid)
            matrix_rows.append(emb)

    candidates = np.asarray(matrix_rows, dtype=np.float32)
    norms = np.linalg.norm(candidates, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized_candidates = candidates / norms

    scores = np.dot(normalized_candidates, query_emb)
    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])
    matched = best_score >= MATCH_THRESHOLD

    meta = face_engine.build_face_metadata(decoded, face)

    return {
        "status": "matched" if matched else "no_match",
        "faceCount": 1,
        **meta,
        "matched": matched,
        "match": {
            "userId": user_ids[best_idx] if matched else None,
            "score": round(best_score, 4),
            "threshold": MATCH_THRESHOLD,
        },
    }
