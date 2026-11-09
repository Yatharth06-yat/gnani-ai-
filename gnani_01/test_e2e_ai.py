import sys
import io
from PIL import Image, ImageDraw
import requests

def create_synthetic_image(draw_garbage=True):
    img = Image.new("RGB", (300, 300), color=(220, 220, 220) if not draw_garbage else (70, 70, 70))
    d = ImageDraw.Draw(img)
    if draw_garbage:
        # Draw recognizable contrast features
        d.rectangle([50, 50, 150, 200], fill=(20, 80, 180), outline=(255, 255, 255))
        d.ellipse([160, 60, 240, 140], fill=(200, 50, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_ai_service_direct():
    print("\n--- Testing FastAPI AI Service Directly (Port 8000) ---")
    base_url = "http://127.0.0.1:8000"
    
    # 1. Health
    h = requests.get(f"{base_url}/health").json()
    print("Health:", h)
    assert h["status"] in ["healthy", "ok"]
    
    # 2. Classify
    test_img = create_synthetic_image(True)
    c = requests.post(f"{base_url}/classify", files={"file": ("test.jpg", test_img, "image/jpeg")}).json()
    print("Classify response:", c)
    assert "prediction" in c
    assert "probability" in c
    
    # 3. Detect
    d = requests.post(f"{base_url}/detect?threshold=0.25", files={"file": ("test.jpg", test_img, "image/jpeg")}).json()
    print("Detect response: success =", d.get("success"), ", model =", d.get("model"))
    assert d.get("success") is True
    
    # 4. Multimodal Analysis
    a = requests.post(f"{base_url}/analyze", files={"file": ("test.jpg", test_img, "image/jpeg")}).json()
    print("Analyze agreement:", a.get("model_agreement"), "priority factor:", a.get("recommended_priority"))
    assert "model_agreement" in a
    
    # 5. Verify before/after
    clean_img = create_synthetic_image(False)
    v = requests.post(
        f"{base_url}/verify",
        files={
            "before_image": ("before.jpg", test_img, "image/jpeg"),
            "after_image": ("after.jpg", clean_img, "image/jpeg")
        }
    ).json()
    print("Full verify JSON:", v)
    assert "recommended_decision" in v
    print("✅ All FastAPI AI direct endpoints passed!")

def test_node_backend_proxy():
    print("\n--- Testing Node.js Express Backend (Port 8002) ---")
    base_url = "http://localhost:8002/api"
    
    # 1. Health
    h = requests.get(f"{base_url}/health").json()
    print("Backend Health:", h)
    assert h["status"] == "OK"
    
    # 2. Hotspots Analytics
    hotspots = requests.get(f"{base_url}/analytics/hotspots").json()
    hdata = hotspots.get("data", {})
    print(f"Hotspots: {len(hdata.get('clusters', []))} clusters found, {len(hdata.get('heatmapPoints', []))} heatmap points")
    assert hotspots.get("success") is True

    # 3. Recurrence Analytics
    rec = requests.get(f"{base_url}/analytics/recurrence?lat=28.6139&lng=77.2090").json()
    rdata = rec.get("data", {})
    risk = rdata.get("recurrenceRisk") or rdata.get("recurrence_risk")
    print("Recurrence Analytics Status:", rdata.get("status"), "| Risk:", risk, "| Msg:", rdata.get("message"))
    assert rec.get("success") is True
    assert "status" in rdata

    # 4. Gnani NLU extraction (civic parser fallback when offline)
    dialogue_res = requests.post(f"{base_url}/gnani/analyze", json={
        "sessionId": "test-session-123",
        "citizenText": "Bohat sara plastic aur kachra pada hai market ke paas road block ho gaya hai"
    }).json()
    print("Gnani NLU Extracted Data:", dialogue_res.get("data"))
    assert dialogue_res.get("success") is True

    # 5. Issue Submission with Clean Image (Should be REJECTED by YOLO11n image validation)
    print("\nVerifying mandatory server-side YOLO rejection on non-garbage image...")
    clean_img = create_synthetic_image(False)
    files = {"image": ("clean.jpg", clean_img, "image/jpeg")}
    data = {
        "title": "Clean empty road test",
        "description": "Nothing here but trying to submit",
        "category": "Garbage",
        "location": '{"lat": 28.6139, "lng": 77.2090}'
    }
    rej_res = requests.post(f"{base_url}/issues", data=data, files=files)
    print("Rejected status code:", rej_res.status_code)
    rej_json = rej_res.json()
    print("Rejected response:", rej_json.get("error"), "-", rej_json.get("message"))
    assert rej_res.status_code == 400
    assert rej_json.get("error") == "NO_GARBAGE_DETECTED"
    print("✅ Mandatory server-side YOLO rejection correctly enforced!")

if __name__ == "__main__":
    try:
        test_ai_service_direct()
        test_node_backend_proxy()
        print("\n🎉 ALL TESTS AND VALIDATIONS PASSED PERFECTLY!\n")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
