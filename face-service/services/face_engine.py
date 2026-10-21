"""
Động cơ thị giác máy tính InsightFace: Phát hiện, căn chỉnh, trích xuất đặc trưng
"""
import io
import sys
from typing import Any, Dict, List, Optional
import cv2
from fastapi import HTTPException, UploadFile
from insightface.app import FaceAnalysis
import numpy as np

from config import DETECTION_SIZE, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, MODEL_NAME
from services.liveness import FaceQualityChecker, LivenessChecker
from services.pose_estimator import HeadPose3DEstimator


class FaceEngine:
    """Quản lý mô hình InsightFace và các tiện ích xử lý ảnh thị giác máy tính."""

    def __init__(self):
        self.model: Optional[FaceAnalysis] = None

    def initialize(self):
        """Khởi tạo mô hình InsightFace tối ưu cực nhẹ trên CPU."""
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            self.model = FaceAnalysis(
                name=MODEL_NAME,
                allowed_modules=["detection", "recognition"],
                providers=["CPUExecutionProvider"],
            )
            self.model.prepare(ctx_id=-1, det_size=(DETECTION_SIZE, DETECTION_SIZE))
        finally:
            sys.stdout = old_stdout

    def is_ready(self) -> bool:
        return self.model is not None

    def shutdown(self):
        self.model = None

    async def read_image_file(self, image: UploadFile) -> np.ndarray:
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

    def detect_faces(self, image: np.ndarray) -> List[Any]:
        if self.model is None:
            raise HTTPException(status_code=503, detail="Mô hình nhận diện chưa sẵn sàng.")
        return self.model.get(image)

    def detect_faces_pose_fast(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Phát hiện Bounding Box & 5 Landmark siêu tốc bằng SCRFD Detector (bỏ qua embedding model)."""
        if self.model is None:
            raise HTTPException(status_code=503, detail="Mô hình nhận diện chưa sẵn sàng.")

        det_model = getattr(self.model, "det_model", None)
        if det_model is not None:
            bboxes, kpss = det_model.detect(image, max_num=0, metric="default")
            if bboxes is None or len(bboxes) == 0:
                return []

            results = []
            for i in range(len(bboxes)):
                b = bboxes[i]
                k = kpss[i] if kpss is not None and i < len(kpss) else None
                results.append({
                    "bbox": b[:4],
                    "det_score": float(b[4]) if len(b) > 4 else 0.99,
                    "kps": k,
                })
            return results

        faces = self.model.get(image)
        return [
            {
                "bbox": f.bbox,
                "det_score": float(getattr(f, "det_score", 0.99)),
                "kps": getattr(f, "kps", None),
            }
            for f in faces
        ]

    def get_embedding(self, face: Any) -> np.ndarray:
        embedding = np.asarray(face.normed_embedding, dtype=np.float32)
        if embedding.ndim != 1 or embedding.size == 0 or not np.isfinite(embedding).all():
            raise HTTPException(status_code=500, detail="Mô hình trả về vector khuôn mặt không hợp lệ.")
        norm = float(np.linalg.norm(embedding))
        if norm == 0:
            raise HTTPException(status_code=500, detail="Mô hình trả về vector khuôn mặt rỗng.")
        return embedding / norm

    def select_dominant_face(self, faces: List[Any]) -> Optional[Any]:
        """Chọn khuôn mặt lớn nhất / chiếm ưu thế trong khung hình."""
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

        if largest_area >= 2.0 * second_area:
            return faces_sorted[0]
        return None

    def build_face_metadata(self, image_bgr: np.ndarray, face: Any) -> Dict[str, Any]:
        box = [round(float(v), 2) for v in np.asarray(face.bbox, dtype=np.float32).tolist()]
        kps = getattr(face, "kps", None)

        pose_result = HeadPose3DEstimator.calculate_euler_angles(kps)
        quality_result = FaceQualityChecker.check_quality(image_bgr, box)
        liveness_result = LivenessChecker.check_liveness(image_bgr, box)

        return {
            "box": box,
            "detectionScore": round(float(getattr(face, "det_score", 0.99)), 4),
            "detectedPose": pose_result["pose_en"], # Canonical English pose name
            "detectedPoseVi": pose_result["pose"],  # Vietnamese pose name
            "pose": pose_result,
            "pitch": pose_result["pitch_deg"],
            "yaw": pose_result["yaw_deg"],
            "roll": pose_result["roll_deg"],
            "quality": quality_result,
            "liveness": liveness_result,
        }


# Singleton FaceEngine
face_engine = FaceEngine()
