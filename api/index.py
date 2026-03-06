"""
AeroGuard — Vercel Serverless API
Fully self-contained: no MongoDB, no httpx, no external dependencies beyond fastapi + mangum.
Uses stdlib urllib for optional reverse-geocoding (falls back silently).
"""
import math
import random
import json
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.request import urlopen, Request as URLRequest
from urllib.parse import urlencode
from urllib.error import URLError

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mangum import Mangum

app = FastAPI(title="AeroGuard API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── In-memory profile store (resets on cold start — fine for demo) ───────────────
_profiles: dict = {}

# ── Pydantic models ──────────────────────────────────────────────────────────────
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

# ── Core AQI logic ───────────────────────────────────────────────────────────────
def categorize(aqi: int) -> str:
    if aqi <= 50:  return "Good"
    if aqi <= 100: return "Satisfactory"
    if aqi <= 200: return "Moderate"
    if aqi <= 300: return "Poor"
    if aqi <= 400: return "Very Poor"
    return "Severe"

def compute_aqi(lat: float, lon: float) -> int:
    urban = max(0.0, 1 - abs(lat - 30) / 30)
    lon_f = max(0.0, 1 - abs(lon - 80) / 60)
    base  = int(40 + urban * lon_f * 320)
    noise = int((math.sin(lat * 12.9898 + lon * 78.233) + 1) * 30)
    return max(15, min(450, base + noise))

def make_forecast(current_aqi: int) -> List[TrendDataPoint]:
    now = datetime.now()
    amp = max(25, current_aqi * 0.22)
    pts = []
    for i in range(24):
        t    = now + timedelta(hours=i)
        wave = math.cos((t.hour - 6) * math.pi / 12)
        val  = int(max(10, min(500, current_aqi + amp * wave + random.uniform(-12, 12))))
        pts.append(TrendDataPoint(time=t.strftime("%Y-%m-%d %H:00"), aqi=val))
    return pts

def advisory(aqi: int, p: UserProfile) -> dict:
    headline = "Air Quality is Stable"
    message  = "Safe for normal outdoor activities."
    alert    = False
    if aqi <= 50:
        headline, message = "✅ Air Quality: Good", "Excellent conditions — great day to go outside!"
    if aqi > 100 and p.asthma_respiratory:
        alert    = True
        headline = "Asthma / Respiratory Alert"
        message  = "Moderate+ AQI detected. Minimise strenuous outdoor activity."
    if aqi > 200 and (p.elderly or p.children):
        alert    = True
        headline = "Vulnerable Group Alert"
        message  = "Poor AQI. Elderly and children should stay indoors."
    if aqi > 200 and p.asthma_respiratory:
        alert    = True
        headline = "Severe Respiratory Warning"
        message  = "Poor AQI — wear N95 or remain indoors."
    if aqi > 400:
        alert    = True
        headline = "🚨 HAZARDOUS ENVIRONMENT"
        message  = "Do NOT go outside under any circumstances."
    return {"is_alert": alert, "headline": headline, "message": message}

def reverse_geocode(lat: float, lon: float) -> str:
    """Uses stdlib urllib — no httpx/aiohttp required."""
    try:
        params  = urlencode({"lat": lat, "lon": lon, "format": "json"})
        req     = URLRequest(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": "AeroGuard-AQI-App/1.0"},
        )
        with urlopen(req, timeout=4) as r:
            data = json.loads(r.read())
        addr    = data.get("address", {})
        city    = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county", "")
        state   = addr.get("state", "")
        country = addr.get("country_code", "").upper()
        parts   = [x for x in [city, state, country] if x]
        return ", ".join(parts[:3]) if parts else f"{lat:.3f}, {lon:.3f}"
    except Exception:
        return f"{lat:.3f}, {lon:.3f}"

# ── Routes ───────────────────────────────────────────────────────────────────────
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "runtime": "vercel"}

@app.get("/api/v1/dashboard", response_model=DashboardResponse)
def dashboard(user_id: str, lat: float, lon: float):
    saved   = _profiles.get(user_id, {})
    profile = UserProfile(user_id=user_id, **saved)
    aqi     = compute_aqi(lat, lon)
    fc      = make_forecast(aqi)
    tom_aqi = fc[12].aqi
    name    = reverse_geocode(lat, lon)

    return DashboardResponse(
        location             = LocationInfo(name=name, lat=lat, lon=lon),
        current_conditions   = CurrentConditions(aqi=aqi, category=categorize(aqi)),
        tomorrow_prediction  = TomorrowPrediction(
            aqi=tom_aqi, category=categorize(tom_aqi),
            target_time=(datetime.now() + timedelta(hours=12)).strftime("%Y-%m-%d %H:00"),
        ),
        personalized_advisory = PersonalizedAdvisory(**advisory(tom_aqi, profile)),
        trend_24h = fc,
    )

@app.post("/api/v1/routes/safe-route", response_model=RouteResponse)
def safe_route(req: RouteRequest):
    base  = compute_aqi(req.origin_lat, req.origin_lon)
    fast  = min(500, base + random.randint(15, 55))
    clean = max(15,  base - random.randint(20, 55))
    return RouteResponse(routes=[
        RouteOption(route_type="Fastest",  duration_mins=random.randint(20, 40),
                    avg_aqi=fast,  aqi_category=categorize(fast),  polyline="fast"),
        RouteOption(route_type="Cleanest", duration_mins=random.randint(30, 50),
                    avg_aqi=clean, aqi_category=categorize(clean), polyline="clean"),
    ])

@app.get("/api/v1/users/{user_id}/profile", response_model=UserProfile)
def get_profile(user_id: str):
    return UserProfile(user_id=user_id, **_profiles.get(user_id, {}))

@app.put("/api/v1/users/{user_id}/profile", response_model=UserProfile)
def update_profile(user_id: str, profile: UserProfile):
    _profiles[user_id] = {
        "asthma_respiratory": profile.asthma_respiratory,
        "elderly":            profile.elderly,
        "children":           profile.children,
    }
    return profile

@app.post("/api/v1/users/{user_id}/symptoms")
def log_symptom(user_id: str, log: SymptomLog):
    if log.symptom_level not in ["Great", "Coughing", "Headache"]:
        raise HTTPException(status_code=400, detail="Invalid symptom_level.")
    return {"status": "success"}

# ── Vercel ASGI handler ──────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
