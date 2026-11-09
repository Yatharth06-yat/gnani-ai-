from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import base64
from ..services.verification_service import verification_service

router = APIRouter(tags=["Resolution Verification"])

@router.post("/verify")
async def verify(
    complaint_id: str = Form("SWM-TEMP"),
    before_file: Optional[UploadFile] = File(None),
    after_file: Optional[UploadFile] = File(None),
    before_image: Optional[UploadFile] = File(None),
    after_image: Optional[UploadFile] = File(None),
    before_base64: Optional[str] = Form(None),
    after_base64: Optional[str] = Form(None)
):
    before_bytes = None
    after_bytes = None

    bf = before_file or before_image
    af = after_file or after_image

    if bf:
        before_bytes = await bf.read()
    elif before_base64:
        try:
            if "," in before_base64:
                before_base64 = before_base64.split(",")[1]
            before_bytes = base64.b64decode(before_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid before_base64: {e}")

    if af:
        after_bytes = await af.read()
    elif after_base64:
        try:
            if "," in after_base64:
                after_base64 = after_base64.split(",")[1]
            after_bytes = base64.b64decode(after_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid after_base64: {e}")

    if not after_bytes:
        raise HTTPException(status_code=400, detail="After-cleaning image is required for resolution verification")

    result = verification_service.verify_resolution(
        complaint_id=complaint_id,
        before_bytes=before_bytes,
        after_bytes=after_bytes
    )
    return result

