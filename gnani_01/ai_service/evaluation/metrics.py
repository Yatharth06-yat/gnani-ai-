import numpy as np
from typing import Dict, List, Tuple

def calculate_classification_metrics(y_true: List[int], y_pred: List[int], y_prob: List[float] = None) -> Dict[str, float]:
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    
    total = len(y_true)
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "total_samples": total
    }

def print_evaluation_report(title: str, metrics: Dict[str, float]):
    print(f"\n=================== {title} ===================")
    for k, v in metrics.items():
        print(f"  {k.replace('_', ' ').capitalize():<20}: {v}")
    print("==================================================\n")

