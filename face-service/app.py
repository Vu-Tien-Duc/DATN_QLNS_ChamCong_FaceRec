# pyright: reportMissingImports=false
# pyright: reportMissingModuleSource=false
"""
=============================================================================
HỆ THỐNG ĐIỂM DANH & QUẢN LÝ NHÂN SỰ - THỊ GIÁC MÁY TÍNH
Module AI: FastAPI InsightFace Microservice (Lightweight & High-Performance)
Tác giả đồ án: Vũ Tiến Đức - MSV: 2310900023
Kiến trúc: Chuẩn RESTful Face AI (Chấm công 1:N Recognize, Đối soát 1:1 Verify,
3D Head Pose 5 góc, Anti-Spoofing Liveness, In-Memory NumPy Vector Index)
=============================================================================
"""

import asyncio
import io
import json
import os
import sys
from contextlib import asynccontextmanager
from typing import Annotated, Any, Dict, List, Optional

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

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from insightface.app import FaceAnalysis
from pydantic import BaseModel, Field

# =====================================================================
# CẤU HÌNH HỆ THỐNG - TỐI ƯU NHẸ & TỐC ĐỘ CAO CHO CPU
# =====================================================================
# buffalo_s / buffalo_sc: Nhẹ hơn buffalo_l 10 lần (MobileFaceNet ~13MB vs ResNet50 ~170MB)
MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_s")
# 320x320 hoặc 480x480 giúp tăng FPS xử lý trên CPU từ 2-3 fps lên 15-25 fps
DETECTION_SIZE = int(os.getenv("FACE_DETECTION_SIZE", "320"))
MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.45"))
MAX_IMAGE_BYTES = int(os.getenv("FACE_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("FACE_MAX_IMAGE_PIXELS", "20000000"))
MAX_TEMPLATES = int(os.getenv("FACE_MAX_TEMPLATES", "2000"))
MAX_TEMPLATES_JSON_BYTES = int(os.getenv("FACE_MAX_TEMPLATES_JSON_BYTES", str(10 * 1024 * 1024)))

# Global model instance
model: Optional[FaceAnalysis] = None


# =====================================================================
# 1. BỘ NHỚ VECTOR TRONG RAM SIÊU NHẸ (IN-MEMORY NUMPY FLAT INDEX)
# =====================================================================
class MemoryVectorIndex:
    """
    Quản lý tập vector đặc trưng 512D ArcFace trong RAM bằng Pure NumPy.
    Tìm kiếm Cosine Similarity trên hàng nghìn nhân sự với tốc độ < 1ms,
    không cần nạp thư viện C++ FAISS nặng nề.
    """

    def __init__(self, dimension: int = 512):
        self.dimension = dimension
        self.reset()

    def reset(self):
        self.vectors_matrix: Optional[np.ndarray] = None  # Shape (N, 512) L2-normalized
        self.profiles: List[Dict[str, Any]] = []  # Danh sách metadata { userId, employee_id, full_name, angle }
        self.user_to_indices: Dict[str, List[int]] = {}

    def size(self) -> int:
        return len(self.profiles)

    def users_count(self) -> int:
        return len(self.user_to_indices)

    def stats(self) -> Dict[str, Any]:
        return {
            "engine": "NumPy-Vectorized-RAM",
            "total_vectors": self.size(),
            "total_users": self.users_count(),
            "dimension": self.dimension,
            "metric": "Cosine Similarity (Inner Product on L2-normalized)",
            "initialized": True,
        }

    def sync_templates(self, templates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Tái tạo toàn bộ chỉ mục vector từ danh sách template MongoDB."""
        self.reset()
        if not templates:
            return self.stats()

        vectors = []
        profiles = []
        user_to_idx: Dict[str, List[int]] = {}

        for item in templates:
            u_id = str(item.get("userId") or item.get("employee_id") or item.get("employeeId") or "").strip()
            full_name = item.get("fullName") or item.get("full_name") or u_id
            emp_id = item.get("employeeId") or item.get("employee_id") or u_id
            emb = item.get("embedding")
            if not u_id or emb is None:
                continue

            # Hỗ trợ cả 1 vector hoặc danh sách nhiều vector các góc
            items = emb if (isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list)) else [emb]

            for sub_emb in items:
                arr = np.asarray(sub_emb, dtype=np.float32)
                if arr.ndim == 1 and arr.size == self.dimension and np.isfinite(arr).all():
                    norm = np.linalg.norm(arr)
                    if norm > 0:
                        arr = arr / norm
                    idx = len(vectors)
                    vectors.append(arr)
                    profiles.append({
                        "userId": u_id,
                        "employee_id": emp_id,
                        "full_name": full_name,
                    })
                    if u_id not in user_to_idx:
                        user_to_idx[u_id] = []
                    user_to_idx[u_id].append(idx)

        if vectors:
            self.vectors_matrix = np.vstack(vectors).astype(np.float32)
            self.profiles = profiles
            self.user_to_indices = user_to_idx

        return self.stats()

    def add_user_template(self, user_id: str, embedding: Any, full_name: Optional[str] = None, employee_id: Optional[str] = None) -> Dict[str, Any]:
        """Thêm hoặc cập nhật vector của một nhân viên vào RAM trong O(1)."""
        u_id = str(user_id).strip()
        if not u_id:
            raise ValueError("userId không được để trống.")

        items = embedding if (isinstance(embedding, list) and len(embedding) > 0 and isinstance(embedding[0], list)) else [embedding]
        new_vecs = []
        for item in items:
            arr = np.asarray(item, dtype=np.float32)
            if arr.ndim == 1 and arr.size == self.dimension and np.isfinite(arr).all():
                norm = np.linalg.norm(arr)
                if norm > 0:
                    arr = arr / norm
                new_vecs.append(arr)

        if not new_vecs:
            return self.stats()

        if u_id not in self.user_to_indices:
            self.user_to_indices[u_id] = []

        for vec in new_vecs:
            idx = len(self.profiles)
            self.profiles.append({
                "userId": u_id,
                "employee_id": employee_id or u_id,
                "full_name": full_name or u_id,
            })
            self.user_to_indices[u_id].append(idx)
            if self.vectors_matrix is None or len(self.vectors_matrix) == 0:
                self.vectors_matrix = vec.reshape(1, -1)
            else:
                self.vectors_matrix = np.vstack([self.vectors_matrix, vec.reshape(1, -1)])

        return self.stats()

    def remove_user(self, user_id: str) -> Dict[str, Any]:
        """Gỡ bỏ vector của một nhân viên khỏi RAM."""
        u_id = str(user_id).strip()
        if u_id not in self.user_to_indices or self.vectors_matrix is None:
            return self.stats()

        keep_indices = [i for i, prof in enumerate(self.profiles) if prof["userId"] != u_id]
        if not keep_indices:
            self.reset()
            return self.stats()

        self.vectors_matrix = self.vectors_matrix[keep_indices]
        self.profiles = [self.profiles[i] for i in keep_indices]
        self.user_to_indices = {}
        for idx, prof in enumerate(self.profiles):
            uid = prof["userId"]
            if uid not in self.user_to_indices:
                self.user_to_indices[uid] = []
            self.user_to_indices[uid].append(idx)

        return self.stats()

    def search(self, query_vec: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Tìm kiếm K ứng viên tương đồng nhất trong RAM bằng Cosine Similarity Dot Product.
        Trả về danh sách [{ employee_id, userId, full_name, similarity }].
        """
        if self.vectors_matrix is None or len(self.profiles) == 0:
            return []

        q = np.asarray(query_vec, dtype=np.float32).flatten()
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm

        # Ma trận chấm vector: (N, 512) x (512,) -> (N,)
        scores = np.dot(self.vectors_matrix, q)

        # Lấy top K chỉ số có điểm số cao nhất
        k = min(top_k, len(scores))
        top_indices = np.argsort(scores)[::-1][:k]

        candidates = []
        seen_users = set()
        for idx in top_indices:
            score = float(scores[idx])
            prof = self.profiles[idx]
            uid = prof["userId"]
            # Chỉ lấy điểm cao nhất đối với mỗi nhân viên
            if uid in seen_users:
                continue
            seen_users.add(uid)
            candidates.append({
                "userId": uid,
                "employee_id": prof["employee_id"],
                "full_name": prof["full_name"],
                "similarity": round(score, 4),
            })

        return candidates


vector_index = MemoryVectorIndex(dimension=512)


# =====================================================================
# 2. ƯỚC LƯỢNG TƯ THẾ ĐẦU 3D EULER (YAW, PITCH, ROLL) CHO 5 GÓC CHỤP
# =====================================================================
class HeadPose3DEstimator:
    """Tính góc quay đầu 3D (Euler Angles) từ 5 điểm landmark khuôn mặt của InsightFace."""

    @staticmethod
    def calculate_euler_angles(kps: Optional[np.ndarray]) -> Dict[str, Any]:
        if kps is None or len(kps) < 5:
            return {
                "pose": "chinh_dien",
                "yaw_deg": 0.0,
                "pitch_deg": 0.0,
                "roll_deg": 0.0,
                "confidence": 0.0,
            }

        re = kps[0]  # Mắt phải
        le = kps[1]  # Mắt trái
        nose = kps[2]  # Đỉnh mũi
        mr = kps[3]  # Khóe miệng phải
        ml = kps[4]  # Khóe miệng trái

        # Roll: độ nghiêng mặt theo phương ngang
        dx_eyes = float(le[0] - re[0])
        dy_eyes = float(le[1] - re[1])
        roll_deg = float(np.degrees(np.arctan2(dy_eyes, dx_eyes)))

        # Điểm giữa hai mắt và hai khóe miệng
        mid_eye_x = float(re[0] + le[0]) / 2.0
        mid_eye_y = float(re[1] + le[1]) / 2.0
        mid_mouth_y = float(mr[1] + ml[1]) / 2.0
        eye_dist = max(np.sqrt(dx_eyes**2 + dy_eyes**2), 1.0)

        # Yaw: độ quay trái/phải (- trái, + phải)
        dx_nose = float(nose[0] - mid_eye_x)
        yaw_norm = float(np.clip(dx_nose / (eye_dist * 0.5), -1.0, 1.0))
        yaw_deg = float(yaw_norm * 45.0)

        # Pitch: độ ngửa lên/cúi xuống (+ ngửa, - cúi)
        eye_to_nose = max(0.1, float(nose[1] - mid_eye_y))
        nose_to_mouth = max(0.1, float(mid_mouth_y - nose[1]))
        vert_ratio = float(eye_to_nose / nose_to_mouth)
        if vert_ratio < 1.40:
            pitch_deg = float((1.40 - vert_ratio) / 1.40 * 45.0)
        else:
            pitch_deg = float(-min(1.0, (vert_ratio - 1.40) / 2.5) * 45.0)

        # Phân loại tư thế 5 góc
        if yaw_deg <= -8.0:
            pose = "nghieng_trai"
        elif yaw_deg >= 8.0:
            pose = "nghieng_phai"
        elif pitch_deg >= 7.0:
            pose = "ngua_len"
        elif pitch_deg <= -7.0:
            pose = "cui_xuong"
        else:
            pose = "chinh_dien"

        return {
            "pose": pose,
            "yaw_deg": round(yaw_deg, 1),
            "pitch_deg": round(pitch_deg, 1),
            "roll_deg": round(roll_deg, 1),
            "confidence": 0.95,
        }


# =====================================================================
# 3. KIỂM TRA CHẤT LƯỢNG ẢNH & CHỐNG GIẢ MẠO LIVENESS (ANTI-SPOOFING)
# =====================================================================
class LivenessChecker:
    """Kiểm tra ảnh in, màn hình điện thoại và tính sống của khuôn mặt."""

    @staticmethod
    def check_liveness(image_bgr: np.ndarray, bbox: List[float]) -> Dict[str, Any]:
        h, w = image_bgr.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        crop = image_bgr[max(0, y1) : min(h, y2), max(0, x1) : min(w, x2)]
        if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
            return {"is_live": True, "score": 1.0, "status": "bypass"}

        # 1. Độ sắc nét và moiré qua Laplacian
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        texture_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        norm_texture = min(1.0, texture_score / 300.0)

        # 2. Tỉ lệ sắc tố da người trong không gian màu YCrCb
        ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]
        skin_mask = (cr >= 130) & (cr <= 175) & (cb >= 75) & (cb <= 130)
        skin_ratio = float(np.sum(skin_mask)) / float(crop.shape[0] * crop.shape[1])
        chroma_score = min(1.0, skin_ratio / 0.35)

        # 3. Phản quang chói màn hình trong không gian HSV
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        val = hsv[:, :, 2]
        glare_ratio = float(np.sum(val > 250)) / float(crop.shape[0] * crop.shape[1])
        glare_penalty = max(0.0, 1.0 - (glare_ratio * 10.0))

        composite_score = float(np.clip(0.40 * norm_texture + 0.40 * chroma_score + 0.20 * glare_penalty, 0.0, 1.0))
        is_live = composite_score >= 0.40

        return {
            "is_live": is_live,
            "score": round(composite_score, 3),
            "texture_score": round(texture_score, 1),
            "chroma_score": round(chroma_score, 3),
        }


class FaceQualityChecker:
    """Kiểm tra độ sáng, độ mờ rung lắc và kích thước mặt."""

    @staticmethod
    def check_quality(image_bgr: np.ndarray, bbox: List[float]) -> Dict[str, Any]:
        h, w = image_bgr.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        crop = image_bgr[max(0, y1) : min(h, y2), max(0, x1) : min(w, x2)]
        if crop.size == 0 or crop.shape[0] < 5 or crop.shape[1] < 5:
            return {"valid": False, "brightness": 0.0, "blur_score": 0.0, "reasons": ["empty_crop"]}

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))

        # Đo độ nét chuẩn hóa 160x160
        crop_resized = cv2.resize(crop, (160, 160), interpolation=cv2.INTER_AREA if crop.shape[0] > 160 else cv2.INTER_LINEAR)
        gray_resized = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray_resized, cv2.CV_64F).var())

        reasons = []
        if brightness < 30.0:
            reasons.append("Ánh sáng quá tối (cần di chuyển đến nơi sáng hơn)")
        elif brightness > 240.0:
            reasons.append("Ánh sáng quá chói / lóa trực tiếp")
        if blur_score < 12.0:
            reasons.append("Ảnh bị mờ hoặc rung lắc camera")

        return {
            "valid": len(reasons) == 0,
            "brightness": round(brightness, 1),
            "blur_score": round(blur_score, 1),
            "reasons": reasons,
        }


# =====================================================================
# FASTAPI LIFESPAN & APPLICATION
# =====================================================================
@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        # TỐI ƯU CỰC NHẸ: Chỉ nạp 2 module 'detection' và 'recognition'
        # Bỏ qua hoàn toàn các module nặng: landmark 3D (130MB), 2D (5MB), gender/age (1.3MB)
        model = FaceAnalysis(
            name=MODEL_NAME,
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        model.prepare(ctx_id=-1, det_size=(DETECTION_SIZE, DETECTION_SIZE))
    finally:
        sys.stdout = old_stdout

    print(
        f"[Face AI] [OK] Ready! Model: {MODEL_NAME} ({DETECTION_SIZE}x{DETECTION_SIZE}) | RAM Vector Index | http://127.0.0.1:8001/docs",
        flush=True,
    )
    yield
    model = None


app = FastAPI(
    title="Face Recognition & Attendance Service (InsightFace)",
    description="Dịch vụ nhận diện khuôn mặt chấm công & thị giác máy tính - Đồ án tốt nghiệp Vũ Tiến Đức (2310900023)",
    version="2.0.0",
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


@app.get("/health")
@app.get("/v1/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "InsightFace Attendance Microservice",
        "model": MODEL_NAME,
        "detection_size": DETECTION_SIZE,
        "ready": model is not None,
        "index": vector_index.stats(),
    }


# =====================================================================
# CÁC HÀM XỬ LÝ ẢNH & INSIGHTFACE TRỢ GIÚP
# =====================================================================
async def read_image_file(image: UploadFile) -> np.ndarray:
    raw = await image.read(MAX_IMAGE_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="Ảnh tải lên đang trống.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá giới hạn dung lượng cho phép.")

    decoded = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise HTTPException(status_code=400, detail="Tệp tải lên không phải ảnh hợp lệ.")
    if decoded.shape[0] * decoded.shape[1] > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="Kích thước ảnh vượt quá giới hạn xử lý.")
    return decoded


def detect_faces(image: np.ndarray) -> List[Any]:
    if model is None:
        raise HTTPException(status_code=503, detail="Mô hình nhận diện chưa sẵn sàng.")
    return model.get(image)


def get_embedding(face: Any) -> np.ndarray:
    embedding = np.asarray(face.normed_embedding, dtype=np.float32)
    if embedding.ndim != 1 or embedding.size == 0 or not np.isfinite(embedding).all():
        raise HTTPException(status_code=500, detail="Mô hình trả về vector khuôn mặt không hợp lệ.")
    norm = float(np.linalg.norm(embedding))
    if norm == 0:
        raise HTTPException(status_code=500, detail="Mô hình trả về vector khuôn mặt rỗng.")
    return embedding / norm


def select_dominant_face(faces: List[Any]) -> Optional[Any]:
    """Chọn khuôn mặt chính diện / lớn nhất trong khung hình chấm công."""
    if not faces:
        return None
    if len(faces) == 1:
        return faces[0]

    faces_sorted = sorted(
        faces,
        key=lambda f: float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])),
        reverse=True,
    )
    largest_area = float((faces_sorted[0].bbox[2] - faces_sorted[0].bbox[0]) * (faces_sorted[0].bbox[3] - faces_sorted[0].bbox[1]))
    second_area = float((faces_sorted[1].bbox[2] - faces_sorted[1].bbox[0]) * (faces_sorted[1].bbox[3] - faces_sorted[1].bbox[1]))

    # Nếu khuôn mặt lớn nhất vượt trội (>= 2.0x diện tích khuôn mặt thứ 2)
    if largest_area >= 2.0 * second_area:
        return faces_sorted[0]
    return None


def build_face_metadata(image_bgr: np.ndarray, face: Any) -> Dict[str, Any]:
    box = [round(float(v), 2) for v in np.asarray(face.bbox, dtype=np.float32).tolist()]
    kps = getattr(face, "kps", None)

    pose_result = HeadPose3DEstimator.calculate_euler_angles(kps)
    quality_result = FaceQualityChecker.check_quality(image_bgr, box)
    liveness_result = LivenessChecker.check_liveness(image_bgr, box)

    return {
        "box": box,
        "detectionScore": round(float(getattr(face, "det_score", 0.99)), 4),
        "detectedPose": pose_result["pose"],
        "pose": pose_result,
        "pitch": pose_result["pitch_deg"],
        "yaw": pose_result["yaw_deg"],
        "roll": pose_result["roll_deg"],
        "quality": quality_result,
        "liveness": liveness_result,
    }


# =====================================================================
# PYDANTIC SCHEMAS CHUẨN THAM KHẢO FACE_AI
# =====================================================================
class BoundingBoxDict(BaseModel):
    x: int
    y: int
    width: int
    height: int


class CandidateItem(BaseModel):
    employee_id: str
    userId: Optional[str] = None
    full_name: Optional[str] = None
    similarity: float


class FaceRecognizeResponse(BaseModel):
    matched: bool
    employee_id: Optional[str] = None
    userId: Optional[str] = None
    full_name: Optional[str] = None
    similarity: float
    threshold: float
    liveness_passed: bool
    liveness_score: float
    candidates: List[CandidateItem] = []
    face_box: Optional[BoundingBoxDict] = None
    reasons: List[str] = []


class FaceVerifyResponse(BaseModel):
    matched: bool
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    similarity: float
    threshold: float
    liveness_passed: bool
    liveness_score: float
    face_box: Optional[BoundingBoxDict] = None
    reasons: List[str] = []


# =====================================================================
# API ENDPOINTS CHẤM CÔNG CHUẨN KIỂU THAM KHAO FACE_AI (DÙNG INSIGHTFACE)
# =====================================================================

@app.post("/v1/face/recognize", response_model=FaceRecognizeResponse, summary="Chấm công nhận diện 1:N (Face Recognition)")
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
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)

    if not faces:
        return FaceRecognizeResponse(
            matched=False,
            similarity=0.0,
            threshold=threshold,
            liveness_passed=False,
            liveness_score=0.0,
            reasons=["FACE_NOT_FOUND: Không tìm thấy khuôn mặt trong ảnh."],
        )

    primary_face = select_dominant_face(faces)
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
    meta = build_face_metadata(decoded, face)
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
    query_emb = get_embedding(face)

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
    MARGIN_TOP1_TOP2 = float(os.getenv("FACE_MARGIN_TOP1_TOP2", "0.05"))
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


@app.post("/v1/face/verify", response_model=FaceVerifyResponse, summary="Xác thực khuôn mặt 1:1 theo mã NV (Face Verification)")
async def verify_face(
    image: Annotated[UploadFile, File(description="Ảnh chụp")],
    employee_id: Annotated[str, Form(description="Mã nhân viên cần đối soát")],
    threshold: float = Query(MATCH_THRESHOLD, description="Ngưỡng tương đồng"),
    check_liveness: bool = Query(True, description="Kiểm tra liveness"),
) -> FaceVerifyResponse:
    """Xác thực 1:1 khuôn mặt người trong ảnh có đúng là nhân viên `employee_id` hay không."""
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)

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

    face = select_dominant_face(faces) or faces[0]
    meta = build_face_metadata(decoded, face)
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

    query_emb = get_embedding(face)

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


@app.post("/v1/face/detect-pose")
@app.post("/v1/faces/detect")
async def detect_face_pose(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Phát hiện Bounding Box và 5 góc tư thế đầu thời gian thực cho camera client."""
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "face_detected": False, "faceCount": 0, "detectedPose": None}

    primary_face = select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return {"status": "multiple_faces", "face_detected": True, "faceCount": len(faces), "detectedPose": None}

    face = primary_face or faces[0]
    meta = build_face_metadata(decoded, face)

    return {
        "status": "face_detected",
        "face_detected": True,
        "faceCount": 1,
        **meta,
    }


@app.post("/v1/face/enroll")
async def enroll_single_face(
    image: Annotated[UploadFile, File()],
    employee_id: Annotated[str, Form()],
    full_name: Annotated[Optional[str], Form()] = None,
) -> Dict[str, Any]:
    """Đăng ký khuôn mặt đơn lẻ và trích xuất vector ArcFace 512D."""
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        return {"success": False, "message": "Không tìm thấy khuôn mặt trong ảnh.", "face_detected": False}

    face = select_dominant_face(faces) or faces[0]
    emb = get_embedding(face)
    meta = build_face_metadata(decoded, face)

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


@app.post("/v1/face/enroll-multi-angle")
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
            decoded = await read_image_file(img_file)
            faces = await asyncio.to_thread(detect_faces, decoded)
            if not faces:
                results[pose_key] = {"status": "no_face", "embedding": None}
                continue
            face = select_dominant_face(faces) or faces[0]
            emb = get_embedding(face)
            meta = build_face_metadata(decoded, face)
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

    # Tự động nạp vào bộ nhớ RAM nếu có employee_id
    if employee_id and registered_vectors:
        vector_index.add_user_template(user_id=employee_id, embedding=registered_vectors, full_name=full_name, employee_id=employee_id)

    return {
        "status": "success",
        "processedAngles": list(results.keys()),
        "angles": results,
        "average_embedding": avg_embedding,
        "total_vectors": len(registered_vectors),
    }


@app.post("/v1/face/liveness")
async def check_face_liveness(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Kiểm tra độc lập liveness / chống giả mạo."""
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        raise HTTPException(status_code=400, detail="Không tìm thấy khuôn mặt trong ảnh.")

    face = select_dominant_face(faces) or faces[0]
    box = [round(float(v), 2) for v in np.asarray(face.bbox, dtype=np.float32).tolist()]
    return LivenessChecker.check_liveness(decoded, box)


# =====================================================================
# ENDPOINTS TƯƠNG THÍCH HOÀN TOÀN VỚI NODE.JS BACKEND HIỆN TẠI
# =====================================================================
class TemplateItem(BaseModel):
    userId: str
    embedding: Any
    fullName: Optional[str] = None
    employeeId: Optional[str] = None


class SyncRequest(BaseModel):
    templates: List[TemplateItem]


class AddTemplateRequest(BaseModel):
    userId: str
    embedding: Optional[Any] = None
    embeddings: Optional[Any] = None
    fullName: Optional[str] = None
    employeeId: Optional[str] = None


class RemoveRequest(BaseModel):
    userId: str


@app.get("/v1/faiss/stats")
def get_faiss_stats() -> Dict[str, Any]:
    return {"status": "ok", "data": vector_index.stats()}


@app.post("/v1/faiss/sync")
@app.post("/v1/face/sync")
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


@app.post("/v1/faiss/add")
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


@app.post("/v1/faiss/remove")
async def remove_faiss_user(payload: RemoveRequest) -> Dict[str, Any]:
    stats = await asyncio.to_thread(vector_index.remove_user, payload.userId)
    return {
        "status": "ok",
        "message": f"Đã gỡ bỏ dữ liệu khuôn mặt của nhân sự {payload.userId}.",
        "data": stats,
    }


@app.post("/v1/faces/identify-faiss")
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

    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "matched": False, "match": None}

    primary_face = select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return {"status": "multiple_faces", "faceCount": len(faces), "matched": False, "match": None}

    face = primary_face or faces[0]
    query_emb = get_embedding(face)
    meta = build_face_metadata(decoded, face)

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


@app.post("/v1/faces/extract")
async def extract_face(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Trích xuất vector ArcFace 512D kèm góc pose và chất lượng."""
    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "embedding": None}

    primary_face = select_dominant_face(faces)
    if primary_face is None and len(faces) > 1:
        return {"status": "multiple_faces", "faceCount": len(faces), "embedding": None}

    face = primary_face or faces[0]
    emb = get_embedding(face)
    meta = build_face_metadata(decoded, face)

    return {
        "status": "face_detected",
        "faceCount": 1,
        **meta,
        "embedding": emb.tolist(),
        "embeddingDimensions": int(emb.size),
    }


@app.post("/v1/faces/identify")
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

    decoded = await read_image_file(image)
    faces = await asyncio.to_thread(detect_faces, decoded)
    if not faces:
        return {"status": "no_face", "faceCount": 0, "matched": False, "match": None}

    face = select_dominant_face(faces) or faces[0]
    query_emb = get_embedding(face)

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

    meta = build_face_metadata(decoded, face)

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
