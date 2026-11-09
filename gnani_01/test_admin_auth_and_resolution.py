import io
import time
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://localhost:8002/api"

def create_image(with_garbage=False):
    if with_garbage:
        # Create image with high visual clutter (refuse mound)
        img = Image.new("RGB", (400, 400), color=(60, 50, 40))
        d = ImageDraw.Draw(img)
        # Draw high-frequency visual clutter patches
        import random
        random.seed(42)
        for _ in range(80):
            x1 = random.randint(10, 350)
            y1 = random.randint(10, 350)
            x2 = x1 + random.randint(20, 60)
            y2 = y1 + random.randint(20, 60)
            color = (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))
            d.rectangle([x1, y1, x2, y2], fill=color, outline=(0, 0, 0))
    else:
        # Create smooth clean road / clean floor surface
        img = Image.new("RGB", (400, 400), color=(140, 140, 140))
        d = ImageDraw.Draw(img)
        d.line([(0, 200), (400, 200)], fill=(220, 220, 220), width=3) # road line

    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def run_all_tests():
    print("======================================================================")
    print("🧪 SWACHHMAP AI 2.0: RBAC, ADMIN AUTH & YOLO11n RESOLUTION VERIFICATION TEST")
    print("======================================================================")

    # 1. Register a Citizen
    citizen_email = f"citizen_test_{int(time.time())}@swachhmap.org"
    print(f"\n1. Registering citizen ({citizen_email})...")
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Citizen Ramesh",
        "email": citizen_email,
        "password": "password123",
        "role": "admin" # Client attempts to inject admin role
    }).json()
    assert reg_res["success"] is True
    citizen_token = reg_res["token"]
    citizen_role = reg_res["user"]["role"]
    print(f"   Registered successfully. Role assigned: '{citizen_role}' (Client injection ignored: {citizen_role == 'citizen'})")
    assert citizen_role == "citizen", "Security violation: client injected role"

    # 2. Citizen attempts to call Admin Login
    print("\n2. Citizen attempts to authenticate via Admin Login (/api/admin/login)...")
    admin_login_as_citizen = requests.post(f"{BASE_URL}/admin/login", json={
        "email": citizen_email,
        "password": "password123"
    })
    print(f"   Status Code: {admin_login_as_citizen.status_code}")
    print(f"   Response: {admin_login_as_citizen.json().get('message')}")
    assert admin_login_as_citizen.status_code == 403, "Citizen should be rejected with 403 from admin portal"

    # 3. Citizen attempts to call Admin Complaints API directly
    print("\n3. Citizen attempts to access Admin Complaints API (/api/admin/complaints)...")
    cit_admin_api = requests.get(f"{BASE_URL}/admin/complaints", headers={
        "Authorization": f"Bearer {citizen_token}"
    })
    print(f"   Status Code: {cit_admin_api.status_code}")
    print(f"   Response: {cit_admin_api.json().get('message')}")
    assert cit_admin_api.status_code == 403, "Citizen Bearer token must be rejected with 403"

    # 4. Authorized Admin Login
    admin_email = "admin@swachhmap.gov.in"
    print(f"\n4. Logging in as Administrator ({admin_email})...")
    admin_auth_res = requests.post(f"{BASE_URL}/admin/login", json={
        "email": admin_email,
        "password": "admin123"
    })
    print(f"   Status Code: {admin_auth_res.status_code}")
    admin_auth_json = admin_auth_res.json()
    assert admin_auth_res.status_code == 200
    assert admin_auth_json["success"] is True
    admin_token = admin_auth_json["token"]
    assert admin_auth_json["admin"]["role"] == "admin"
    print(f"   Admin authentication successful! Admin Name: {admin_auth_json['admin']['name']}")

    # 5. Admin calls /api/admin/me
    print("\n5. Testing /api/admin/me session endpoint...")
    me_res = requests.get(f"{BASE_URL}/admin/me", headers={
        "Authorization": f"Bearer {admin_token}"
    }).json()
    print(f"   Verified Session: {me_res.get('admin', {}).get('email')} (Role: {me_res.get('admin', {}).get('role')})")
    assert me_res["success"] is True

    # 6. Citizen creates a complaint with valid garbage image
    print("\n6. Citizen submits a garbage complaint with verified garbage image...")
    garbage_bytes = create_image(with_garbage=True)
    comp_res = requests.post(
        f"{BASE_URL}/issues",
        headers={"Authorization": f"Bearer {citizen_token}"},
        data={
            "title": "Severe Plastic Accumulation in Park",
            "description": "Scattered garbage and discarded packaging blocking walkway.",
            "category": "Garbage",
            "location": '{"lat": 28.6139, "lng": 77.2090}'
        },
        files={"image": ("garbage_dump.jpg", garbage_bytes, "image/jpeg")}
    )
    assert comp_res.status_code == 201, f"Complaint creation failed: {comp_res.text}"
    comp_json = comp_res.json()
    complaint_id = comp_json["data"]["complaintId"]
    target_id = comp_json["data"]["_id"] if "_id" in comp_json["data"] else complaint_id
    print(f"   Complaint registered: {complaint_id} (ID: {target_id})")

    # 7. Admin lists complaints and searches for the new complaint
    print("\n7. Admin queries /api/admin/complaints...")
    admin_list_res = requests.get(
        f"{BASE_URL}/admin/complaints?search={complaint_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    assert admin_list_res["success"] is True
    assert len(admin_list_res["data"]) > 0
    print(f"   Found complaint in Admin queue. Total complaints in system: {admin_list_res['stats']['total']}")

    # 8. DIRECT RESOLUTION LOCKOUT: Admin attempts to mark complaint 'Resolved' directly
    print("\n8. Testing Security Lockout: Attempting to mark as 'Resolved' directly without image verification...")
    direct_res = requests.patch(
        f"{BASE_URL}/admin/complaints/{target_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "Resolved"}
    )
    print(f"   Status Code: {direct_res.status_code}")
    print(f"   Response: {direct_res.json().get('error')} - {direct_res.json().get('message')}")
    assert direct_res.status_code == 400
    assert direct_res.json().get("error") == "RESOLUTION_VERIFICATION_REQUIRED"
    print("   ✅ Direct resolution strictly blocked!")

    # 9. Case A: Admin uploads an image where GARBAGE IS STILL DETECTED
    print("\n9. Case A: Admin uploads an after-cleaning photo that STILL CONTAINS GARBAGE...")
    dirty_after_bytes = create_image(with_garbage=True)
    dirty_verify_res = requests.post(
        f"{BASE_URL}/admin/complaints/{target_id}/verify-resolution",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"after_image": ("dirty_after.jpg", dirty_after_bytes, "image/jpeg")},
        data={"notes": "Crew swept the left side only."}
    ).json()
    print("   Verification Result:")
    print(f"   - verificationPassed: {dirty_verify_res.get('verificationPassed')}")
    print(f"   - garbageDetected: {dirty_verify_res.get('garbageDetected')}")
    print(f"   - totalObjects: {dirty_verify_res.get('totalObjects')}")
    print(f"   - message: {dirty_verify_res.get('message')}")
    print(f"   - verificationToken: {dirty_verify_res.get('verificationToken')}")
    assert dirty_verify_res.get("verificationPassed") is False
    assert dirty_verify_res.get("garbageDetected") is True
    assert dirty_verify_res.get("verificationToken") is None
    print("   ✅ Garbage detected -> Resolution token withheld, resolution remains blocked!")

    # 10. Admin attempts to confirm resolution with no token or invalid token
    print("\n10. Admin attempts to confirm resolution without valid verification token...")
    fraud_confirm = requests.post(
        f"{BASE_URL}/admin/complaints/{target_id}/confirm-resolution",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"verificationToken": "fraudulent_token_12345"}
    )
    print(f"   Status Code: {fraud_confirm.status_code}")
    print(f"   Response: {fraud_confirm.json().get('message')}")
    assert fraud_confirm.status_code in [400, 403]
    print("   ✅ Fraudulent resolution attempt successfully rejected!")

    # 11. Case B: Admin uploads a genuinely CLEAN after-cleaning photo (zero garbage)
    print("\n11. Case B: Admin uploads a CLEAN after-cleaning photo...")
    clean_after_bytes = create_image(with_garbage=False)
    clean_verify_res = requests.post(
        f"{BASE_URL}/admin/complaints/{target_id}/verify-resolution",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"after_image": ("clean_after.jpg", clean_after_bytes, "image/jpeg")},
        data={"notes": "Site completely sanitized and cleared by municipal crew."}
    ).json()
    print("   Clean Verification Result:")
    print(f"   - verificationPassed: {clean_verify_res.get('verificationPassed')}")
    print(f"   - garbageDetected: {clean_verify_res.get('garbageDetected')}")
    print(f"   - totalObjects: {clean_verify_res.get('totalObjects')}")
    print(f"   - message: {clean_verify_res.get('message')}")
    clean_token = clean_verify_res.get("verificationToken")
    print(f"   - Issued verificationToken: {clean_token[:16]}... (Valid for {clean_verify_res.get('expiresInSeconds')}s)")
    assert clean_verify_res.get("verificationPassed") is True
    assert clean_verify_res.get("garbageDetected") is False
    assert clean_token is not None

    # 12. Admin confirms resolution with the clean verification token
    print("\n12. Admin executes final resolution confirmation with valid token...")
    confirm_res = requests.post(
        f"{BASE_URL}/admin/complaints/{target_id}/confirm-resolution",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "verificationToken": clean_token,
            "resolutionNotes": "Municipal Team 4 completed waste removal. Site inspected and verified clean."
        }
    )
    print(f"   Status Code: {confirm_res.status_code}")
    confirm_json = confirm_res.json()
    print(f"   Response: {confirm_json.get('message')}")
    assert confirm_res.status_code == 200
    assert confirm_json["success"] is True
    assert confirm_json["data"]["status"] == "Resolved"
    print(f"   🎉 Complaint {complaint_id} marked as RESOLVED!")

    # 13. Replay Attack Prevention: Attempting to reuse the consumed token
    print("\n13. Testing Replay Protection: Attempting to reuse the consumed verification token...")
    replay_res = requests.post(
        f"{BASE_URL}/admin/complaints/{target_id}/confirm-resolution",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"verificationToken": clean_token}
    )
    print(f"   Status Code: {replay_res.status_code}")
    print(f"   Response: {replay_res.json().get('message')}")
    assert replay_res.status_code in [400, 403]
    print("   ✅ Replay attack prevented: Single-use verification token cannot be reused!")

    # 14. Citizen checks their report (/api/issues/my-reports)
    print("\n14. Citizen checks My Reports to inspect resolution evidence...")
    my_reports_res = requests.get(
        f"{BASE_URL}/issues/my-reports",
        headers={"Authorization": f"Bearer {citizen_token}"}
    ).json()
    assert my_reports_res["success"] is True
    my_comp = next((c for c in my_reports_res["data"] if c.get("complaintId") == complaint_id), None)
    assert my_comp is not None
    print(f"   Citizen View of Resolved Complaint:")
    print(f"   - Status: {my_comp.get('status')}")
    print(f"   - Resolved At: {my_comp.get('resolvedAt')}")
    print(f"   - Resolution Image Recorded: {bool(my_comp.get('resolutionImage'))}")
    print(f"   - Resolution Notes: {my_comp.get('resolutionNotes')}")
    print(f"   - AI Resolution Verification: {my_comp.get('resolutionVerification', {}).get('status')}")
    assert my_comp.get("status") == "Resolved"
    assert my_comp.get("resolutionImage") != ""

    print("\n======================================================================")
    print("🎉 ALL 14 RBAC, ADMIN SECURITY & YOLO11n RESOLUTION VERIFICATION TESTS PASSED 100%!")
    print("======================================================================")

if __name__ == "__main__":
    run_all_tests()
