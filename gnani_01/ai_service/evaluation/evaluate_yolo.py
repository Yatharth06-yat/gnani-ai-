import os
import sys
import time
import glob
from pathlib import Path
from PIL import Image
import numpy as np

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.services.yolo_service import yolo_service
from ai_service.app.config import SUPPORTED_WASTE_CLASSES
from ai_service.evaluation.metrics import calculate_classification_metrics, print_evaluation_report

def run_yolo_evaluation(images_dir: str = None, threshold: float = 0.25):
    """
    Evaluates YOLO11n object detector latency, detection rate, and category distribution.
    Can run on an image directory or benchmark synthetic sample inputs.
    """
    print("🔬 Starting SwachhMap YOLO11n Evaluation & Benchmark Suite...")
    print(f"⚙️ Confidence Threshold: {threshold}")
    
    if not images_dir or not os.path.exists(images_dir):
        print("ℹ️ No test images directory provided. Running latency and stability benchmarks on synthetic test frame...")
        # Create sample test frame
        dummy = Image.new("RGB", (640, 640), color=(120, 140, 130))
        import io
        buf = io.BytesIO()
        dummy.save(buf, format="JPEG")
        test_bytes = buf.getvalue()

        latencies = []
        for i in range(5):
            t0 = time.perf_counter()
            res = yolo_service.detect_objects(test_bytes, conf_threshold=threshold)
            elapsed = (time.perf_counter() - t0) * 1000
            latencies.append(elapsed)

        avg_latency = float(np.mean(latencies))
        p95_latency = float(np.percentile(latencies, 95))

        bench_metrics = {
            "model": "YOLO11n (Ultralytics)",
            "iterations": 5,
            "avg_latency_ms": round(avg_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "status": "Healthy & Functional",
            "supported_classes": len(SUPPORTED_WASTE_CLASSES)
        }
        print_evaluation_report("YOLO11n Latency & Stability Benchmark", bench_metrics)
        return bench_metrics

    # Directory provided:
    image_paths = glob.glob(os.path.join(images_dir, "*.*"))
    print(f"📊 Found {len(image_paths)} images for YOLO evaluation.")

    detections_count = 0
    total_waste_objects = 0
    latencies = []
    category_counts = {}

    for path in image_paths:
        try:
            with open(path, "rb") as f:
                img_bytes = f.read()
            t0 = time.perf_counter()
            res = yolo_service.detect_objects(img_bytes, conf_threshold=threshold)
            latencies.append((time.perf_counter() - t0) * 1000)

            if res.get("garbage_detected"):
                detections_count += 1

            objects = res.get("detections", [])
            total_waste_objects += len(objects)

            for obj in objects:
                c = obj["class_name"]
                category_counts[c] = category_counts.get(c, 0) + 1
        except Exception as e:
            print(f"⚠️ Error evaluating {path}: {e}")

    n = len(image_paths)
    eval_metrics = {
        "total_images": n,
        "images_with_garbage_detected": detections_count,
        "detection_rate_pct": round((detections_count / n) * 100, 2) if n > 0 else 0,
        "total_garbage_objects_found": total_waste_objects,
        "avg_objects_per_image": round(total_waste_objects / n, 2) if n > 0 else 0,
        "avg_inference_latency_ms": round(float(np.mean(latencies)), 2) if latencies else 0,
        "category_distribution": category_counts
    }
    print_evaluation_report("YOLO11n Dataset Evaluation", eval_metrics)
    return eval_metrics

if __name__ == "__main__":
    test_path = sys.argv[1] if len(sys.argv) > 1 else None
    run_yolo_evaluation(test_path)
