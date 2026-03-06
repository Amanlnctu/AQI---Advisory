"""
Self-contained Vercel serverless API for AeroGuard AQI Platform.
No MongoDB dependency — all logic is stateless/computed.
In-memory profile store is used for the demo (resets per function cold-start, which is fine for PoC).
"""
import math
import random
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import httpx

# ── Mangum wraps FastAPI ASGI → Vercel/Lambda handler ──────────────────────────
from mangum import Mangum

app = FastAPI(title="AeroGuard API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory profile store (keyed by user_id) ──────────────────────────────────
_profiles: dict = {}

# ── Pydantic models ─────────────────────────────────────────────────────────────
class UserProfile(BaseModel):
    user_id: str
    asthma_respiratory: bool = False
    elderly: bool = False
    children: bool = False

class SymptomLog(BaseModel):
    user_id: str
    timestamp: datetime
    symptom_level: str
    notes: Optional[str] = ""

class TrendDataPoint(BaseModel):
    time: str
    aqi: int

class LocationInfo(BaseModel):
    name: str = "Unknown"
    lat: float
    lon: float

class CurrentConditions(BaseModel):
    aqi: int
    category: str

class TomorrowPrediction(BaseModel):
    aqi: int
    category: str
    target_time: str

class PersonalizedAdvisory(BaseModel):
    is_alert: bool
    headline: str
    message: str

class DashboardResponse(BaseModel):
    location: LocationInfo
    current_conditions: CurrentConditions
    tomorrow_prediction: TomorrowPrediction
    personalized_advisory: PersonalizedAdvisory
    trend_24h: List[TrendDataPoint]

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float

class RouteOption(BaseModel):
    route_type: str
    duration_mins: int
    avg_aqi: int
    aqi_category: str
    polyline: str

class RouteResponse(BaseModel):
    routes: List[RouteOption]

# ── Core logic ───────────────────────────────────────────────────────────────────
def categorize_aqi(aqi: int) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"

def compute_aqi(lat: float, lon: float) -> int:
    """Location-based AQI — varies meaningfully between cities."""
    urban = max(0.0, 1 - abs(lat - 30) / 30)
    lon_f = max(0.0, 1 - abs(lon - 80) / 60)
    base  = int(40 + urban * lon_f * 320)
    noise = int((math.sin(lat * 12.9898 + lon * 78.233) + 1) * 30)
    return max(15, min(450, base + noise))

def generate_forecast(current_aqi: int) -> List[TrendDataPoint]:
    """Diurnal cosine wave + per-hour random noise — NOT a straight line."""
    forecast = []
    base     = datetime.now()
    amp      = max(25, current_aqi * 0.22)
    for i in range(24):
        t    = base + timedelta(hours=i)
        hour = t.hour
        # Peaks ~6 AM (cos 0 = 1), troughs ~18:00 (cos π = -1)
        wave  = math.cos((hour - 6) * math.pi / 12)
        noise = random.uniform(-12, 12)
        val   = int(max(10, min(500, current_aqi + amp * wave + noise)))
        forecast.append(TrendDataPoint(time=t.strftime("%Y-%m-%d %H:00"), aqi=val))
    return forecast

def get_advisory(predicted_aqi: int, profile: UserProfile) -> dict:
    is_alert = False
    headline = "Air Quality is Stable"
    message  = "Conditions are safe for normal outdoor activities."

    if predicted_aqi > 100 and profile.asthma_respiratory:
        is_alert = True
        headline = "Asthma / Respiratory Alert"
        message  = "AQI is Moderate or higher. Minimise strenuous outdoor exposure."

    if predicted_aqi > 200 and (profile.elderly or profile.children):
        is_alert = True
        headline = "Vulnerable Group Alert"
        message  = "Poor air quality. Elderly and children should stay indoors."

    if predicted_aqi > 200 and profile.asthma_respiratory:
        is_alert = True
        headline = "Severe Respiratory Warning"
        message  = "Poor AQI heavily impacts asthma. Wear N95 mask or remain indoors."

    if predicted_aqi > 400:
        is_alert = True
        headline = "🚨 HAZARDOUS ENVIRONMENT"
        message  = "Extremely severe air quality. Do NOT go outside."

    if predicted_aqi <= 50:
        headline = "✅ Air Quality: Good"
        message  = "Excellent air quality. Great day for outdoor activities."

    return {"is_alert": is_alert, "headline": headline, "message": message}

async def reverse_geocode(lat: float, lon: float) -> str:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "AeroGuard-AQI-App/1.0"},
            )
            d = r.json()
            a = d.get("address", {})
            city    = a.get("city") or a.get("town") or a.get("village") or a.get("county", "")
            state   = a.get("state", "")
            country = a.get("country_code", "").upper()
            parts   = [p for p in [city, state, country] if p]
            return ", ".join(parts[:3]) if parts else f"{lat:.3f}, {lon:.3f}"
    except Exception:
        return f"{lat:.3f}, {lon:.3f}"

# ── Routes ───────────────────────────────────────────────────────────────────────
@app.get("/api/v1/dashboard", response_model=DashboardResponse)
async def dashboard(user_id: str, lat: float, lon: float):
    profile_data = _profiles.get(user_id, {})
    profile      = UserProfile(user_id=user_id, **profile_data)
    current_aqi  = compute_aqi(lat, lon)
    forecast     = generate_forecast(current_aqi)
    tomorrow_aqi = forecast[12].aqi
    location_name = await reverse_geocode(lat, lon)

    return DashboardResponse(
        location         = LocationInfo(name=location_name, lat=lat, lon=lon),
        current_conditions = CurrentConditions(aqi=current_aqi, category=categorize_aqi(current_aqi)),
        tomorrow_prediction = TomorrowPrediction(
            aqi         = tomorrow_aqi,
            category    = categorize_aqi(tomorrow_aqi),
            target_time = (datetime.now() + timedelta(hours=12)).strftime("%Y-%m-%d %H:00"),
        ),
        personalized_advisory = PersonalizedAdvisory(**get_advisory(tomorrow_aqi, profile)),
        trend_24h = forecast,
    )

@app.post("/api/v1/routes/safe-route", response_model=RouteResponse)
async def safe_route(req: RouteRequest):
    base_aqi  = compute_aqi(req.origin_lat, req.origin_lon)
    fast_aqi  = min(500, base_aqi + random.randint(15, 60))
    clean_aqi = max(15,  base_aqi - random.randint(20, 60))
    return RouteResponse(routes=[
        RouteOption(route_type="Fastest",  duration_mins=random.randint(20, 40), avg_aqi=fast_aqi,
                    aqi_category=categorize_aqi(fast_aqi),  polyline="fast_mock"),
        RouteOption(route_type="Cleanest", duration_mins=random.randint(30, 50), avg_aqi=clean_aqi,
                    aqi_category=categorize_aqi(clean_aqi), polyline="clean_mock"),
    ])

@app.get("/api/v1/users/{user_id}/profile", response_model=UserProfile)
async def get_profile(user_id: str):
    data = _profiles.get(user_id, {})
    return UserProfile(user_id=user_id, **data)

@app.put("/api/v1/users/{user_id}/profile", response_model=UserProfile)
async def update_profile(user_id: str, profile: UserProfile):
    _profiles[user_id] = {
        "asthma_respiratory": profile.asthma_respiratory,
        "elderly":            profile.elderly,
        "children":           profile.children,
    }
    return profile

@app.post("/api/v1/users/{user_id}/symptoms")
async def log_symptom(user_id: str, log: SymptomLog):
    if log.symptom_level not in ["Great", "Coughing", "Headache"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid symptom_level.")
    return {"status": "success", "message": "Symptom logged."}

@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "runtime": "vercel-serverless"}

# ── Vercel handler ───────────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
