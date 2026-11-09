import os
from pathlib import Path

# Prevent permission issues in sandboxed or multi-user environments
os.environ.setdefault("KERAS_HOME", "/tmp/.keras")
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/.ultralytics")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/.matplotlib")

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "app" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

CNN_MODEL_PATH = MODELS_DIR / "swachhmap_cnn_v2.keras"
YOLO_MODEL_PATH = MODELS_DIR / "best.pt"
YOLO_LOCAL_BASE = MODELS_DIR / "yolo11n.pt"
YOLO_ROOT_BASE = BASE_DIR / "yolo11n.pt"
YOLO_BASE_MODEL = str(YOLO_LOCAL_BASE if YOLO_LOCAL_BASE.exists() else (YOLO_ROOT_BASE if YOLO_ROOT_BASE.exists() else "yolo11n.pt"))

# Model Hyperparameters
CNN_INPUT_SIZE = (224, 224)
CNN_CLASSIFICATION_THRESHOLD = 0.67
DEFAULT_YOLO_CONFIDENCE_THRESHOLD = 0.25

SUPPORTED_WASTE_CLASSES = [
    "plastic_bottle",
    "plastic_bag",
    "paper_cardboard",
    "food_waste",
    "mixed_garbage",
    "construction_debris"
]

PORT = int(os.getenv("AI_SERVICE_PORT", 8000))
HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")

