from typing import Dict, Any, List
from .cnn_service import cnn_service
from .yolo_service import yolo_service

class EvidenceService:
    def analyze_evidence(
        self,
        image_bytes: bytes,
        complaint_id: str = "SWM-TEMP",
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        metadata = metadata or {}
        
        # 1. Run CNN classification
        cnn_result = cnn_service.classify_image(image_bytes)

        # 2. Run YOLO detection
        yolo_result = yolo_service.detect_objects(image_bytes)

        # 3. Model Agreement Analysis
        cnn_present = cnn_result.get("prediction") == "garbage_present"
        yolo_count = yolo_result.get("total_objects", 0)

        uncertainties = []
        evidence_summary = []
        requires_human_review = False

        if cnn_present and yolo_count > 0:
            agreement = "supporting"
            summary = f"Mutually supporting visual evidence: CNN confirms garbage presence (p={cnn_result.get('probability')}) and YOLO detected {yolo_count} waste object(s)."
            evidence_summary.append("CNN: High probability of waste accumulation.")
            evidence_summary.append(f"YOLO: Localized {yolo_count} distinct object(s).")
        elif cnn_present and yolo_count == 0:
            agreement = "unclassified_waste_suspected"
            summary = f"CNN detects diffuse garbage accumulation (p={cnn_result.get('probability')}), but YOLO localized 0 discrete objects. Area may contain unclassified or scattered waste."
            evidence_summary.append("CNN: Waste accumulation detected.")
            uncertainties.append("YOLO detected no discrete target classes (potential unsegmented waste or low contrast).")
            requires_human_review = True
        elif not cnn_present and yolo_count > 0:
            agreement = "conflicting"
            summary = f"Model disagreement: CNN classified clean (p={cnn_result.get('probability')}) while YOLO identified {yolo_count} object(s). Manual verification required."
            evidence_summary.append(f"YOLO detected {yolo_count} object(s).")
            uncertainties.append("CNN binary score below garbage threshold despite YOLO object candidate.")
            requires_human_review = True
        else:
            agreement = "clean_confirmed"
            summary = "Both CNN and YOLO models agree that no visible waste accumulation was detected in the photograph."
            evidence_summary.append("Both models indicate clean environment.")

        # Incorporate citizen context if provided
        transcript = metadata.get("transcript", "")
        if transcript:
            evidence_summary.append(f"Citizen voice report: \"{transcript[:80]}...\"")

        coords = metadata.get("coordinates")
        if coords and coords.get("lat") and coords.get("lng"):
            evidence_summary.append(f"GPS tagged at ({coords.get('lat')}, {coords.get('lng')})")
        else:
            uncertainties.append("No GPS coordinates tagged with image submission.")

        return {
            "complaint_id": complaint_id,
            "evidence": {
                "voice_transcript": transcript,
                "location_available": bool(coords and coords.get("lat")),
                "timestamp_available": bool(metadata.get("timestamp")),
                "cnn_probability": cnn_result.get("probability"),
                "yolo_object_count": yolo_count
            },
            "cnn_result": cnn_result,
            "yolo_result": yolo_result,
            "agreement": agreement,
            "model_agreement": agreement,
            "uncertainties": uncertainties,
            "requires_human_review": requires_human_review,
            "evidence_summary": evidence_summary,
            "summary": summary
        }

evidence_service = EvidenceService()

