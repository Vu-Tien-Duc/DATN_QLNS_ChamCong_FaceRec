"""
Ước lượng tư thế đầu 3D Euler (Yaw, Pitch, Roll) từ 5 điểm Landmark
"""
from typing import Any, Dict, Optional
import numpy as np


class HeadPose3DEstimator:
    """Tính góc quay đầu 3D (Euler Angles) từ 5 điểm landmark khuôn mặt của InsightFace."""

    @staticmethod
    def calculate_euler_angles(kps: Optional[np.ndarray]) -> Dict[str, Any]:
        if kps is None or len(kps) < 5:
            return {
                "pose": "chinh_dien",
                "pose_en": "STRAIGHT",
                "yaw_deg": 0.0,
                "pitch_deg": 0.0,
                "roll_deg": 0.0,
                "confidence": 0.0,
            }

        re = kps[0]   # Mắt phải
        le = kps[1]   # Mắt trái
        nose = kps[2] # Đỉnh mũi
        mr = kps[3]   # Khóe miệng phải
        ml = kps[4]   # Khóe miệng trái

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

        # Phân loại tư thế 5 góc theo hướng người dùng (trên ảnh webcam chuẩn chưa lật: + quay trái, - quay phải)
        # Tăng ngưỡng lên >= 12.0 độ để yêu cầu quay góc rõ ràng, chống nhích nhẹ bị chụp nhầm
        if yaw_deg >= 12.0:
            pose = "nghieng_trai"
            pose_en = "TURN_LEFT"
        elif yaw_deg <= -12.0:
            pose = "nghieng_phai"
            pose_en = "TURN_RIGHT"
        elif pitch_deg >= 7.0:
            pose = "ngua_len"
            pose_en = "LOOK_UP"
        elif pitch_deg <= -6.0:
            pose = "cui_xuong"
            pose_en = "LOOK_DOWN"
        else:
            pose = "chinh_dien"
            pose_en = "STRAIGHT"

        return {
            "pose": pose,
            "pose_en": pose_en,
            "yaw_deg": round(yaw_deg, 1),
            "pitch_deg": round(pitch_deg, 1),
            "roll_deg": round(roll_deg, 1),
            "confidence": 0.95,
        }
