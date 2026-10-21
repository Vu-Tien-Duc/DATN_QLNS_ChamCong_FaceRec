"""
Kiểm tra độ sống Liveness (Anti-Spoofing) và Chất lượng ảnh khuôn mặt
"""
from typing import Any, Dict, List
import cv2
import numpy as np


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
