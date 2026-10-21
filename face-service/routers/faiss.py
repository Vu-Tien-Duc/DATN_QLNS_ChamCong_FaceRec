"""
Router Quản lý chỉ mục Vector trong RAM và Đồng bộ với MongoDB (In-Memory Index)
"""
import asyncio
from typing import Annotated, Any, Dict
from fastapi import APIRouter, File, HTTPException, UploadFile
from config import MATCH_THRESHOLD
from schemas import AddTemplateRequest, RemoveRequest, SyncRequest
from services.face_engine import face_engine
from services.vector_index import vector_index

router = APIRouter(tags=["RAM Vector Index"])


@router.get("/v1/faiss/stats")
def get_faiss_stats() -> Dict[str, Any]:
    return {"status": "ok", "data": vector_index.stats()}


@router.get("/v1/faiss/users")
def get_faiss_users() -> Dict[str, Any]:
    return {"users": list(vector_index.user_to_indices.keys()), "profiles": vector_index.profiles}


@router.post("/v1/faiss/sync")
@router.post("/v1/face/sync")
async def sync_faiss_index(payload: SyncRequest) -> Dict[str, Any]:
    """Đồng bộ template vector từ Node.js/MongoDB vào RAM index."""
    raw = [
        {
            "userId": item.userId,
            "embedding": item.embedding,
            "fullName": item.fullName,
            "employeeId": item.employeeId,
        }
        for item in payload.templates
    ]
    stats = await asyncio.to_thread(vector_index.sync_templates, raw)
    return {
        "status": "ok",
        "message": f"Đã đồng bộ {stats['total_vectors']} vector cho {stats['total_users']} nhân sự vào RAM.",
        "data": stats,
    }


@router.post("/v1/faiss/add")
async def add_faiss_template(payload: AddTemplateRequest) -> Dict[str, Any]:
    emb = payload.embeddings or payload.embedding
    if emb is None:
        raise HTTPException(status_code=400, detail="Cần cung cấp vector khuôn mặt (embedding).")

    stats = await asyncio.to_thread(
        vector_index.add_user_template,
        payload.userId,
        emb,
        payload.fullName,
        payload.employeeId,
    )
    return {
        "status": "ok",
        "message": f"Đã nạp vector của nhân sự {payload.userId} vào bộ nhớ RAM.",
        "data": stats,
    }


@router.post("/v1/faiss/remove")
async def remove_faiss_user(payload: RemoveRequest) -> Dict[str, Any]:
    stats = await asyncio.to_thread(vector_index.remove_user, payload.userId)
    return {
        "status": "ok",
        "message": f"Đã gỡ bỏ dữ liệu khuôn mặt của nhân sự {payload.userId}.",
        "data": stats,
    }


@router.post("/v1/faces/identify-faiss")
async def identify_face_faiss(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """
    Endpoint nhận diện nhanh qua RAM cho backend Node.js:
    Trả về cấu trúc { matched: bool, match: { userId, score, threshold } }
    """
    if vector_index.size() == 0:
        return {
            "status": "no_index",
            "message": "Bộ nhớ RAM chưa có vector nào. Cần đồng bộ dữ liệu trước.",
            "matched": False,
            "match": None,
        }

    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "matched": False, "match": None}

    primary_face = face_engine.select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return {"status": "multiple_faces", "faceCount": len(faces), "matched": False, "match": None}

    face = primary_face or faces[0]
    query_emb = face_engine.get_embedding(face)
    meta = face_engine.build_face_metadata(decoded, face)

    candidates = vector_index.search(query_emb, top_k=1)
    if not candidates:
        return {
            "status": "no_match",
            "faceCount": 1,
            **meta,
            "matched": False,
            "match": None,
        }

    best = candidates[0]
    matched = bool(best["similarity"] >= MATCH_THRESHOLD and meta["liveness"].get("is_live", True))

    return {
        "status": "matched" if matched else "no_match",
        "faceCount": 1,
        **meta,
        "matched": matched,
        "match": {
            "userId": best["userId"] if matched else None,
            "employee_id": best["employee_id"] if matched else None,
            "score": best["similarity"],
            "threshold": MATCH_THRESHOLD,
        },
        "searchEngine": "NumPy_Vectorized_RAM",
    }
