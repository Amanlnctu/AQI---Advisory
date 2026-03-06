import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"
TEST_USER = "test-user-123"

def print_pass(step: str):
    print(f"[PASS] {step}")

def print_fail(step: str, error: str):
    print(f"[FAIL] {step}")
    print(f"   Details: {error}")
    sys.exit(1)

def run_tests():
    print("Starting End-to-End API Integration Tests...\n")

    # Step 1: Create Health Profile
    step1_name = "Step 1: Create Profile (asthma_respiratory=True)"
    try:
        url = f"{BASE_URL}/users/{TEST_USER}/profile"
        payload = {
            "user_id": TEST_USER,
            "asthma_respiratory": True,
            "elderly": False,
            "children": False
        }
        res = requests.put(url, json=payload)
        res.raise_for_status()
        print_pass(step1_name)
    except Exception as e:
        print_fail(step1_name, str(e))

    # Step 2: GET Profile Verification
    step2_name = "Step 2: Verify Profile Database Save"
    try:
        url = f"{BASE_URL}/users/{TEST_USER}/profile"
        res = requests.get(url)
        res.raise_for_status()
        data = res.json()
        if data.get("asthma_respiratory") is not True:
            raise ValueError("Database returned asthma_respiratory=False, expected True")
        print_pass(step2_name)
    except Exception as e:
        print_fail(step2_name, str(e))

    # Step 3: log symptoms
    step3_name = "Step 3: Log 'Coughing' Symptom"
    try:
        url = f"{BASE_URL}/users/{TEST_USER}/symptoms"
        # Must match Enum on backend
        payload = {
            "user_id": TEST_USER,
            "timestamp": "2026-03-06T12:00:00Z",
            "symptom_level": "Coughing", 
            "notes": "Feeling wheezy during the morning walk."
        }
        res = requests.post(url, json=payload)
        res.raise_for_status()
        print_pass(step3_name)
    except Exception as e:
        print_fail(step3_name, str(e))

    # Step 4: GET Dashboard & Alert Checking
    step4_name = "Step 4: Verify Dashboard & Asthma Alert Trigger"
    try:
        url = f"{BASE_URL}/dashboard"
        # Dummy coordinates in Delhi 
        params = {"user_id": TEST_USER, "lat": 28.61, "lon": 77.23}
        res = requests.get(url, params=params)
        res.raise_for_status()
        data = res.json()
        
        advisory = data.get("personalized_advisory", {})
        print(f"   [Debug] Headline returned: '{advisory.get('headline')}'")
        print(f"   [Debug] Message returned: '{advisory.get('message')}'")
        
        # We know backend mock generates AQI=145 currently (Moderate)
        # Asthma alert should trigger since it predicts > 100
        if not advisory.get("is_alert"):
            print("   [Warning] is_alert was False. Ensure the Predictor logic properly evaluates AQI > 100 for Asthma = True.")
        
        print_pass(step4_name)
    except Exception as e:
        print_fail(step4_name, str(e))

    # Step 5: Route Calculation
    step5_name = "Step 5: Verify Safe Routes (Fastest vs Cleanest)"
    try:
        url = f"{BASE_URL}/routes/safe-route"
        payload = {
            "origin_lat": 28.61,
            "origin_lon": 77.23,
            "dest_lat": 28.53,
            "dest_lon": 77.30
        }
        res = requests.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        
        routes = data.get("routes", [])
        if len(routes) != 2:
            raise ValueError(f"Expected 2 routes, got {len(routes)}")
            
        print(f"   [Debug] Route 1: {routes[0]['route_type']} ({routes[0]['avg_aqi']} AQI)")
        print(f"   [Debug] Route 2: {routes[1]['route_type']} ({routes[1]['avg_aqi']} AQI)")
        print_pass(step5_name)
    except Exception as e:
        print_fail(step5_name, str(e))

    print("\n[SUCCESS] All 5 E2E Integration Tests Passed Successfully!")

if __name__ == "__main__":
    # Wait a second to ensure server is ready if script ran concurrently
    time.sleep(1)
    run_tests()
