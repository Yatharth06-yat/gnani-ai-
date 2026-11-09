from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import Optional
import base64
from ..services.yolo_service import yolo_service

router = APIRouter(tags=["Detection"])

@router.post("/detect")
async def detect(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    confidence_threshold: float = Query(0.25, ge=0.05, le=1.0)
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

    result = yolo_service.detect_objects(image_bytes, conf_threshold=confidence_threshold)
    return result

