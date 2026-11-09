from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import json
import base64
from ..services.evidence_service import evidence_service

router = APIRouter(tags=["Multimodal Evidence Analysis"])

@router.post("/analyze")
async def analyze(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    complaint_id: str = Form("SWM-TEMP"),
    transcript: Optional[str] = Form(""),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    timestamp: Optional[str] = Form(None),
    category: Optional[str] = Form("Garbage")
):
    image_bytes = None

    if file:
        image_bytes = await file.read()
    elif image_base64:
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 encoding: {e}")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Either file or image_base64 must be provided")

    metadata = {
        "transcript": transcript,
        "coordinates": {"lat": latitude, "lng": longitude} if latitude and longitude else None,
        "timestamp": timestamp,
        "category": category
    }

    result = evidence_service.analyze_evidence(
        image_bytes=image_bytes,
        complaint_id=complaint_id,
        metadata=metadata
    )
    return result

