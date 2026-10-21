"""
Router Ước lượng tư thế khuôn mặt 3D Euler (Pose Detection)
"""
import asyncio
from typing import Annotated, Any, Dict
from fastapi import APIRouter, File, UploadFile
import numpy as np
from services.face_engine import face_engine
from services.pose_estimator import HeadPose3DEstimator

router = APIRouter(tags=["Head Pose"])


@router.post("/v1/face/detect-pose")
@router.post("/v1/faces/detect")
async def detect_face_pose(image: Annotated[UploadFile, File()]) -> Dict[str, Any]:
    """Phát hiện Bounding Box và 5 góc tư thế đầu thời gian thực siêu tốc (< 15ms) cho camera client."""
    decoded = await face_engine.read_image_file(image)
    faces = await asyncio.to_thread(face_engine.detect_faces_pose_fast, decoded)
    if not faces:
        return {"status": "no_face", "face_detected": False, "faceCount": 0, "detectedPose": None}

    # Chọn khuôn mặt lớn nhất / gần camera nhất
    faces_sorted = sorted(
        faces,
        key=lambda f: float((f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1])),
        reverse=True,
    )
    face = faces_sorted[0]
    box = [round(float(v), 2) for v in np.asarray(face["bbox"], dtype=np.float32).tolist()]
    kps = face.get("kps")
    pose_result = HeadPose3DEstimator.calculate_euler_angles(kps)

    landmarks_dict = None
    if kps is not None and len(kps) >= 5:
        landmarks_dict = {
            "right_eye": {"x": round(float(kps[0][0]), 2), "y": round(float(kps[0][1]), 2)},
            "left_eye": {"x": round(float(kps[1][0]), 2), "y": round(float(kps[1][1]), 2)},
            "nose_tip": {"x": round(float(kps[2][0]), 2), "y": round(float(kps[2][1]), 2)},
            "mouth_right": {"x": round(float(kps[3][0]), 2), "y": round(float(kps[3][1]), 2)},
            "mouth_left": {"x": round(float(kps[4][0]), 2), "y": round(float(kps[4][1]), 2)},
        }

    return {
        "status": "face_detected",
        "face_detected": True,
        "faceCount": len(faces),
        "box": box,
        "detectionScore": round(float(face.get("det_score", 0.99)), 4),
        "detectedPose": pose_result["pose_en"],
        "detectedPoseVi": pose_result["pose"],
        "pose": pose_result,
        "pitch": pose_result["pitch_deg"],
        "yaw": pose_result["yaw_deg"],
        "roll": pose_result["roll_deg"],
        "landmarks": landmarks_dict,
    }
