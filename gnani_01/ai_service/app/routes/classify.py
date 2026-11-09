from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import base64
from ..services.cnn_service import cnn_service

router = APIRouter(tags=["Classification"])

@router.post("/classify")
async def classify(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None)
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

    result = cnn_service.classify_image(image_bytes)
    return result

