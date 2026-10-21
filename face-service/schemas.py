"""
Định nghĩa Pydantic Schemas cho Face Service
"""
from typing import Any, List, Optional
from pydantic import BaseModel


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
