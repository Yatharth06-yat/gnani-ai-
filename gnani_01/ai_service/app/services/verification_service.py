from typing import Dict, Any, List
from .cnn_service import cnn_service
from .yolo_service import yolo_service

class VerificationService:
    def verify_resolution(
        self,
        complaint_id: str,
        before_bytes: bytes = None,
        after_bytes: bytes = None
    ) -> Dict[str, Any]:
        before_status = {}
        after_status = {}

        if before_bytes:
            before_cnn = cnn_service.classify_image(before_bytes)
            before_yolo = yolo_service.detect_objects(before_bytes)
            before_status = {
                "cnn_probability": before_cnn.get("probability", 0),
                "cnn_prediction": before_cnn.get("prediction", "unknown"),
                "yolo_count": before_yolo.get("total_objects", 0),
                "detections": before_yolo.get("detections", [])
            }

        if after_bytes:
            after_cnn = cnn_service.classify_image(after_bytes)
            after_yolo = yolo_service.detect_objects(after_bytes)
            after_status = {
                "cnn_probability": after_cnn.get("probability", 0),
                "cnn_prediction": after_cnn.get("prediction", "unknown"),
                "yolo_count": after_yolo.get("total_objects", 0),
                "detections": after_yolo.get("detections", []),
                "annotated_image_base64": after_yolo.get("annotated_image_base64")
            }

        residual_waste = False
        explanation = []
        recommendation = "Needs Manual Inspection"

        after_p = after_status.get("cnn_probability", 0.0)
        after_count = after_status.get("yolo_count", 0)

        if after_count > 0 or after_p >= 0.67:
            residual_waste = True
            recommendation = "Reject - Waste Still Present"
            explanation.append(f"After-image still contains {after_count} detected waste objects.")
            if after_p >= 0.67:
                explanation.append(f"CNN confidence remains above threshold ({after_p} >= 0.67).")
        else:
            residual_waste = False
            recommendation = "Approve Resolution"
            explanation.append("After-image shows zero detectable waste objects.")
            explanation.append(f"CNN indicates clean area (p={after_p} < 0.67).")

        if before_status:
            p_drop = round(before_status.get("cnn_probability", 0) - after_p, 3)
            count_drop = before_status.get("yolo_count", 0) - after_count
            explanation.append(f"Garbage probability dropped by {p_drop * 100:.1f}%; waste count decreased by {count_drop}.")

        return {
            "complaint_id": complaint_id,
            "before_status": before_status,
            "after_status": after_status,
            "residual_waste_detected": residual_waste,
            "recommendation": recommendation,
            "recommended_decision": recommendation,
            "explanation": explanation,
            "model_agreement": "supporting" if not residual_waste else "residual_waste_flagged"
        }

verification_service = VerificationService()

