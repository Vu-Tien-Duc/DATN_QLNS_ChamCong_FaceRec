"""
Cấu hình hệ thống Face AI Microservice
"""
import os

MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_s")
DETECTION_SIZE = int(os.getenv("FACE_DETECTION_SIZE", "320"))
MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.45"))
MARGIN_TOP1_TOP2 = float(os.getenv("FACE_MARGIN_TOP1_TOP2", "0.05"))
MAX_IMAGE_BYTES = int(os.getenv("FACE_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("FACE_MAX_IMAGE_PIXELS", "20000000"))
MAX_TEMPLATES = int(os.getenv("FACE_MAX_TEMPLATES", "2000"))
MAX_TEMPLATES_JSON_BYTES = int(os.getenv("FACE_MAX_TEMPLATES_JSON_BYTES", str(10 * 1024 * 1024)))
