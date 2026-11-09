from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class MultimodalAnalyzeRequest(BaseModel):
    complaint_id: Optional[str] = "SWM-TEMP"
    transcript: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = "Garbage"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: Optional[str] = None
    image_base64: Optional[str] = None

class VerificationRequest(BaseModel):
    complaint_id: str
    before_image_base64: Optional[str] = None
    after_image_base64: Optional[str] = None
    notes: Optional[str] = ""

