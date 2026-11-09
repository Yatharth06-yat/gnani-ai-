from fastapi import APIRouter
from ..services.cnn_service import cnn_service
from ..services.yolo_service import yolo_service
from ..config import SUPPORTED_WASTE_CLASSES, CNN_INPUT_SIZE, CNN_CLASSIFICATION_THRESHOLD

router = APIRouter(tags=["Health & Model Info"])

@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": "SwachhMap AI 2.0 Inference Engine",
        "models": {
            "cnn": {
                "loaded": cnn_service.model is not None,
                "custom_weights": cnn_service.is_custom_weights_loaded,
                "threshold": CNN_CLASSIFICATION_THRESHOLD
            },
            "yolo": {
                "loaded": yolo_service.model is not None,
                "custom_weights": yolo_service.is_custom_weights_loaded,
                "classes": SUPPORTED_WASTE_CLASSES
            }
        }
    }

@router.get("/model-info")
def get_model_info():
    return {
        "cnn": {
            "name": "swachhmap_cnn_v2",
            "task": "binary_garbage_classification",
            "input_shape": list(CNN_INPUT_SIZE) + [3],
            "threshold": CNN_CLASSIFICATION_THRESHOLD,
            "classes": ["no (garbage absent)", "yes (garbage present)"],
            "custom_weights_loaded": cnn_service.is_custom_weights_loaded
        },
        "yolo": {
            "name": "YOLO11n",
            "task": "waste_object_detection",
            "supported_classes": SUPPORTED_WASTE_CLASSES,
            "custom_weights_loaded": yolo_service.is_custom_weights_loaded
        }
    }

