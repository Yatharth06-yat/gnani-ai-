from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class CNNPredictionResponse(BaseModel):
    model: str = "swachhmap_cnn_v2"
    prediction: str  # "garbage_present" | "garbage_absent"
    probability: float
    threshold: float = 0.67
    inference_time_ms: float
    model_loaded: bool

class DetectionItem(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]

class YOLODetectionResponse(BaseModel):
    model: str = "yolo11n"
    total_objects: int
    detections: List[DetectionItem]
    annotated_image_base64: Optional[str] = None
    inference_time_ms: float
    image_dimensions: Dict[str, int]
    model_loaded: bool

class EvidenceProfileResponse(BaseModel):
    complaint_id: str
    evidence: Dict[str, Any]
    cnn_result: CNNPredictionResponse
    yolo_result: YOLODetectionResponse
    agreement: str  # "supporting" | "conflicting" | "unclassified_waste_suspected" | "clean_confirmed"
    uncertainties: List[str]
    requires_human_review: bool
    summary: str

class VerificationResultResponse(BaseModel):
    complaint_id: str
    before_status: Dict[str, Any]
    after_status: Dict[str, Any]
    residual_waste_detected: bool
    recommendation: str  # "Approve Resolution" | "Reject - Waste Still Present" | "Needs Manual Inspection"
    explanation: List[str]
    model_agreement: str

class HealthResponse(BaseModel):
    status: str
    service: str = "SwachhMap AI Inference Engine"
    models: Dict[str, Any]

