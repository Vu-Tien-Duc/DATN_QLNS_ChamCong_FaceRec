"""
Các Routers nghiệp vụ của Face Service Microservice
"""
from .health import router as health_router
from .pose import router as pose_router
from .enrollment import router as enrollment_router
from .recognition import router as recognition_router
from .faiss import router as faiss_router
from .liveness import router as liveness_router

__all__ = [
    "health_router",
    "pose_router",
    "enrollment_router",
    "recognition_router",
    "faiss_router",
    "liveness_router",
]
