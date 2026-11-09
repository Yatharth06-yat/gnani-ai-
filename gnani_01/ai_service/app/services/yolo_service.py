import os
import io
import time
import base64
import numpy as np
import cv2
from PIL import Image
from ..config import YOLO_MODEL_PATH, YOLO_BASE_MODEL, SUPPORTED_WASTE_CLASSES

# Configure environment before importing ultralytics
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/.ultralytics")

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except Exception as e:
    ULTRALYTICS_AVAILABLE = False
    print(f"⚠️ Ultralytics import error: {e}")

# COCO to waste proxy mapping for base pretrained models
COCO_WASTE_MAP = {
    # Direct containers, bottles, tableware, cutlery
    "bottle": "plastic_bottle",
    "cup": "plastic_bottle",
    "wine glass": "glass_waste",
    "bowl": "plastic_container",
    "fork": "plastic_waste",
    "knife": "plastic_waste",
    "spoon": "plastic_waste",
    # Food waste and organic matter
    "banana": "food_waste",
    "apple": "food_waste",
    "sandwich": "food_waste",
    "orange": "food_waste",
    "broccoli": "food_waste",
    "carrot": "food_waste",
    "pizza": "food_waste",
    "donut": "food_waste",
    "cake": "food_waste",
    "hot dog": "food_waste",
    "potted plant": "organic_waste",
    # Paper and cardboard
    "book": "paper_cardboard",
    # Bags, luggage, sacks
    "handbag": "plastic_bag",
    "backpack": "mixed_garbage",
    "suitcase": "construction_debris",
    # Tarps, sheets, textiles
    "umbrella": "plastic_sheet",
    "tie": "textile_waste",
    # Furniture, debris, fixtures
    "chair": "discarded_furniture",
    "couch": "discarded_furniture",
    "bed": "discarded_furniture",
    "dining table": "discarded_furniture",
    "toilet": "sanitary_waste",
    "sink": "construction_debris",
    # E-waste and electronics
    "tv": "e_waste",
    "laptop": "e_waste",
    "mouse": "e_waste",
    "remote": "e_waste",
    "keyboard": "e_waste",
    "cell phone": "e_waste",
    "microwave": "e_waste",
    "oven": "e_waste",
    "toaster": "e_waste",
    "refrigerator": "e_waste",
    "clock": "e_waste",
    "hair drier": "e_waste",
    # Scrap and miscellaneous
    "vase": "ceramic_waste",
    "scissors": "metal_scrap",
    "toothbrush": "plastic_waste",
    "sports ball": "plastic_waste",
    "frisbee": "plastic_waste"
}

class YOLOService:
    def __init__(self):
        self.model = None
        self.is_custom_weights_loaded = False
        self._load_model()

    def _load_model(self):
        if not ULTRALYTICS_AVAILABLE:
            print("⚠️ Ultralytics YOLO is unavailable.")
            return

        if YOLO_MODEL_PATH.exists():
            try:
                print(f"📦 Loading fine-tuned YOLO11n weights from {YOLO_MODEL_PATH}...")
                self.model = YOLO(str(YOLO_MODEL_PATH))
                self.is_custom_weights_loaded = True
                print("✅ Fine-tuned YOLO11n model loaded successfully!")
                return
            except Exception as e:
                print(f"⚠️ Failed to load custom YOLO weights: {e}")

        # Fallback to base YOLO11n model
        try:
            print(f"⚙️ Initializing base Ultralytics YOLO model ({YOLO_BASE_MODEL})...")
            # Check if model exists locally or can be loaded
            if os.path.exists(YOLO_BASE_MODEL):
                self.model = YOLO(YOLO_BASE_MODEL)
                print("✅ Base YOLO11n initialized from local file.")
            else:
                try:
                    self.model = YOLO(YOLO_BASE_MODEL)
                    print("✅ Base YOLO11n initialized.")
                except Exception as dl_err:
                    print(f"ℹ️ Base YOLO weight download skipped/offline: {dl_err}. YOLO detector ready for local weights.")
                    self.model = None
        except Exception as e:
            print(f"⚠️ Base YOLO loading error: {e}")

    def detect_objects(self, image_bytes: bytes, conf_threshold: float = 0.25) -> dict:
        t0 = time.time()
        
        if self.model is None:
            self._load_model()

        if self.model is None:
            return {
                "success": False,
                "garbage_detected": False,
                "model": "yolo11n",
                "total_objects": 0,
                "detections": [],
                "annotated_image_base64": None,
                "confidence_threshold": conf_threshold,
                "inference_time_ms": 0.0,
                "image_dimensions": {"width": 0, "height": 0},
                "model_loaded": False,
                "error": "YOLO11n model weights not yet loaded"
            }

        try:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            width, height = pil_img.size
            img_np = np.array(pil_img)
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

            # Use sensitive confidence threshold (0.15) for discrete objects in waste scenes
            effective_conf = min(0.15, conf_threshold) if not self.is_custom_weights_loaded else conf_threshold
            results = self.model.predict(
                source=img_np,
                conf=effective_conf,
                verbose=False
            )
            
            result = results[0]
            detections = []

            for box in result.boxes:
                cls_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                orig_name = result.names.get(cls_id, f"class_{cls_id}").lower()
                
                # If custom model, verify supported classes. If base model, map only valid waste proxies.
                if self.is_custom_weights_loaded:
                    if orig_name in SUPPORTED_WASTE_CLASSES:
                        mapped_class = orig_name
                    else:
                        continue  # Skip unrelated class
                else:
                    if orig_name in COCO_WASTE_MAP:
                        mapped_class = COCO_WASTE_MAP[orig_name]
                    else:
                        continue  # Skip unrelated object (e.g. person, dog, car)

                xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]
                detections.append({
                    "class": mapped_class,
                    "class_name": mapped_class,
                    "original_label": orig_name,
                    "confidence": round(confidence, 3),
                    "bbox": xyxy
                })

            # Diffuse / bulk waste mound detection for landfills, garbage piles, and open dumps
            mound_detections = self._detect_diffuse_waste_mounds(img_bgr, width, height, len(detections))
            for m in mound_detections:
                detections.append(m)

            # If no discrete objects or mounds found yet, cross-check with SwachhMap CNN classifier
            if len(detections) == 0:
                try:
                    from .cnn_service import cnn_service
                    cnn_res = cnn_service.classify_image(image_bytes)
                    if cnn_res.get("prediction") == "garbage_present" and cnn_res.get("probability", 0) >= 0.55:
                        conf = cnn_res.get("probability", 0.85)
                        mound = {
                            "class": "mixed_garbage",
                            "class_name": "mixed_garbage",
                            "original_label": "diffuse_waste_accumulation",
                            "confidence": round(conf, 3),
                            "bbox": [float(int(width * 0.05)), float(int(height * 0.15)), float(int(width * 0.95)), float(int(height * 0.95))]
                        }
                        detections.append(mound)
                except Exception as cnn_err:
                    print(f"⚠️ CNN cross-check warning: {cnn_err}")

            # Draw clean bounding boxes ONLY for confirmed garbage detections
            annotated_bgr = img_bgr.copy()
            for d in detections:
                bx1, by1, bx2, by2 = [int(v) for v in d["bbox"]]
                # Color code per class
                c_name = d["class"].lower()
                if "plastic" in c_name:
                    box_color = (255, 140, 0) # Deep Sky Blue (BGR)
                elif "food" in c_name or "organic" in c_name:
                    box_color = (0, 165, 255) # Orange (BGR)
                elif "paper" in c_name or "cardboard" in c_name:
                    box_color = (0, 215, 255) # Gold/Yellow (BGR)
                elif "debris" in c_name or "construction" in c_name:
                    box_color = (50, 50, 220) # Crimson / Red (BGR)
                else:
                    box_color = (0, 204, 0) # Vibrant Green (BGR)

                cv2.rectangle(annotated_bgr, (bx1, by1), (bx2, by2), box_color, 3)
                label = f"{d['class']}: {int(d['confidence'] * 100)}%"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
                cv2.rectangle(annotated_bgr, (bx1, max(0, by1 - 25)), (bx1 + tw + 8, max(25, by1)), box_color, -1)
                cv2.putText(annotated_bgr, label, (bx1 + 4, max(18, by1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 0, 0), 2)

            # Generate annotated image
            annotated_rgb = annotated_bgr[..., ::-1] # BGR to RGB
            annotated_pil = Image.fromarray(annotated_rgb)
            buffered = io.BytesIO()
            annotated_pil.save(buffered, format="JPEG", quality=85)
            annotated_base64 = f"data:image/jpeg;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"

            inference_time_ms = round((time.time() - t0) * 1000, 2)

            return {
                "success": True,
                "garbage_detected": len(detections) > 0,
                "model": "yolo11n",
                "total_objects": len(detections),
                "detections": detections,
                "annotated_image_base64": annotated_base64,
                "confidence_threshold": conf_threshold,
                "inference_time_ms": inference_time_ms,
                "image_dimensions": {"width": width, "height": height},
                "model_loaded": True,
                "custom_weights_loaded": self.is_custom_weights_loaded
            }
        except Exception as e:
            print(f"❌ YOLO detection error: {e}")
            return {
                "success": False,
                "garbage_detected": False,
                "model": "yolo11n",
                "total_objects": 0,
                "detections": [],
                "annotated_image_base64": None,
                "inference_time_ms": round((time.time() - t0) * 1000, 2),
                "image_dimensions": {"width": 0, "height": 0},
                "model_loaded": False,
                "error": str(e)
            }

    def _detect_diffuse_waste_mounds(self, img_bgr: np.ndarray, orig_w: int, orig_h: int, existing_count: int) -> list:
        """
        Robust Computer Vision detector for diffuse garbage heaps, landfills, and open dumps.
        Normalizes to 640px scale to make texture and roughness evaluation resolution-independent.
        """
        try:
            h, w = img_bgr.shape[:2]
            
            # Normalize to 640px analysis dimension for scale-invariant texture & clutter detection
            scale = 640.0 / max(h, w)
            target_w = max(32, int(w * scale))
            target_h = max(32, int(h * scale))
            img_scaled = cv2.resize(img_bgr, (target_w, target_h), interpolation=cv2.INTER_AREA)

            gray = cv2.cvtColor(img_scaled, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(img_scaled, cv2.COLOR_BGR2HSV)
            
            # 1. Analyze foliage/greenery to avoid false positives on clean lawns or tree canopies
            h_channel = hsv[:, :, 0]
            s_channel = hsv[:, :, 1]
            green_mask = (h_channel >= 35) & (h_channel <= 85) & (s_channel >= 40)
            green_ratio = float(np.mean(green_mask))
            if green_ratio > 0.65:
                # Scene is predominantly clean green lawn / park / forest
                return []
            
            # 2. Texture and edge roughness
            lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            edge_mag = np.sqrt(sobelx**2 + sobely**2)
            edge_density = float(np.mean(edge_mag > 20))
            
            # Waste mounds / dumps have high local roughness and heterogeneous entropy
            is_waste_clutter = (lap_var > 30 and edge_density > 0.05) or (edge_density > 0.10)
            if not is_waste_clutter:
                return []
            
            blur_edges = cv2.GaussianBlur(edge_mag, (21, 21), 0)
            thresh_val = np.percentile(blur_edges, 40)
            clutter_mask = (blur_edges > thresh_val).astype(np.uint8) * 255
            
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
            closed_mask = cv2.morphologyEx(clutter_mask, cv2.MORPH_CLOSE, kernel)
            
            contours, _ = cv2.findContours(closed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            mound_detections = []
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            
            inv_scale_x = orig_w / float(target_w)
            inv_scale_y = orig_h / float(target_h)

            for c in contours:
                x, y, cw, ch = cv2.boundingRect(c)
                area_ratio = (cw * ch) / float(target_w * target_h)
                # Filter out small noise spots, require at least 3% of scaled image area
                if area_ratio >= 0.03:
                    conf = min(0.96, max(0.80, 0.72 + (edge_density * 0.35) + (area_ratio * 0.15)))
                    orig_x1 = max(0, min(orig_w, float(x * inv_scale_x)))
                    orig_y1 = max(0, min(orig_h, float(y * inv_scale_y)))
                    orig_x2 = max(0, min(orig_w, float((x + cw) * inv_scale_x)))
                    orig_y2 = max(0, min(orig_h, float((y + ch) * inv_scale_y)))
                    mound_detections.append({
                        "class": "mixed_garbage",
                        "class_name": "mixed_garbage",
                        "original_label": "diffuse_waste_mound",
                        "confidence": round(conf, 3),
                        "bbox": [round(orig_x1, 1), round(orig_y1, 1), round(orig_x2, 1), round(orig_y2, 1)]
                    })
                    if len(mound_detections) >= 3:
                        break
                        
            # Fallback: If edge density is high but contours fragmented, generate full mound bbox
            if not mound_detections and edge_density > 0.08:
                conf = min(0.95, max(0.80, 0.75 + (edge_density * 0.3)))
                mound_detections.append({
                    "class": "mixed_garbage",
                    "class_name": "mixed_garbage",
                    "original_label": "diffuse_waste_heap",
                    "confidence": round(conf, 3),
                    "bbox": [float(int(orig_w * 0.05)), float(int(orig_h * 0.15)), float(int(orig_w * 0.95)), float(int(orig_h * 0.95))]
                })
                
            return mound_detections
        except Exception as err:
            print(f"⚠️ Mound detection error: {err}")
            return []

yolo_service = YOLOService()

