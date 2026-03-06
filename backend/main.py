from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import random

app = FastAPI(
    title="Predictive AQI & Health Advisory Platform",
    description="API for forecasting Air Quality Index (AQI) and providing personalized health advisories.",
    version="1.0.0"
)

# CORS middleware MUST be enabled for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database (Mock in-memory dictionaries)
users_db = {
    "user_1": {
        "asthma_respiratory": True,
        "elderly": False,
        "children_in_household": True
    }
}
symptoms_db = []

# AQI Business Logic & Categories
def get_aqi_category(aqi: int) -> str:
    if 0 <= aqi <= 50:
        return "Good"
    elif 51 <= aqi <= 100:
        return "Satisfactory"
    elif 101 <= aqi <= 200:
        return "Moderate"
    elif 201 <= aqi <= 300:
        return "Poor"
    elif 301 <= aqi <= 400:
        return "Very Poor"
    else:  # 401+
        return "Severe / Hazardous"

# Pydantic Models

# 1. Dashboard Models
class LocationInfo(BaseModel):
    name: str
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
    triggered_by: List[str]

class TrendDataPoint(BaseModel):
    time: str
    aqi: int

class DashboardResponse(BaseModel):
    location: LocationInfo
    current_conditions: CurrentConditions
    tomorrow_prediction: TomorrowPrediction
    personalized_advisory: PersonalizedAdvisory
    trend_24h: List[TrendDataPoint]

# 2. Safe Route Models
class RouteRequest(BaseModel):
    user_id: str
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
    is_recommended: bool

class SafeRouteResponse(BaseModel):
    routes: List[RouteOption]
    route_advisory: str

# 3. User Profile Models
class UserProfile(BaseModel):
    asthma_respiratory: bool
    elderly: bool
    children_in_household: bool

# 4. Symptom Log Models
class SymptomLogEntry(BaseModel):
    timestamp: datetime
    symptom_level: str = Field(..., description="Must be 'great', 'cough_wheezing', or 'headache_fatigue'")
    notes: Optional[str] = ""

class SymptomLogResponse(BaseModel):
    status: str
    message: str

# Endpoints

@app.get("/api/v1/dashboard", response_model=DashboardResponse)
def get_dashboard(
    user_id: str = Query(...),
    lat: float = Query(...),
    lon: float = Query(...)
):
    profile = users_db.get(user_id, {
        "asthma_respiratory": False,
        "elderly": False,
        "children_in_household": False
    })
    
    current_aqi = random.randint(30, 450)
    current_cat = get_aqi_category(current_aqi)
    
    tomorrow_aqi = random.randint(30, 450)
    tomorrow_cat = get_aqi_category(tomorrow_aqi)
    
    # Generate advisory based on user profile
    triggered_by = []
    is_alert = False
    if current_aqi > 100:
        if profile.get("asthma_respiratory"):
            triggered_by.append("asthma_respiratory")
            is_alert = True
        if profile.get("elderly"):
            triggered_by.append("elderly")
            is_alert = True
        if profile.get("children_in_household") and current_aqi > 150:
            triggered_by.append("children_in_household")
            is_alert = True

    if is_alert:
        headline = "Health Warning"
        message = "AQI levels are unsafe given your specific health profile. Minimize outdoor activities."
    else:
        headline = "All Clear"
        message = "AQI is acceptable. Enjoy your day outdoors."

    # Generate mock 24-hour trend
    trend_24h = []
    base_time = datetime.now()
    for i in range(24):
        t = base_time + timedelta(hours=i)
        trend_24h.append(TrendDataPoint(
            time=t.strftime("%Y-%m-%d %H:00"),
            aqi=max(0, current_aqi + random.randint(-50, 50))
        ))

    return DashboardResponse(
        location=LocationInfo(name="Mock Location", lat=lat, lon=lon),
        current_conditions=CurrentConditions(aqi=current_aqi, category=current_cat),
        tomorrow_prediction=TomorrowPrediction(aqi=tomorrow_aqi, category=tomorrow_cat, target_time=(datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d 12:00")),
        personalized_advisory=PersonalizedAdvisory(
            is_alert=is_alert,
            headline=headline,
            message=message,
            triggered_by=triggered_by
        ),
        trend_24h=trend_24h
    )

@app.post("/api/v1/routes/safe-route", response_model=SafeRouteResponse)
def get_safe_route(req: RouteRequest):
    fastest_aqi = random.randint(150, 300)
    cleanest_aqi = max(50, fastest_aqi - 80)
    
    route1 = RouteOption(
        route_type="fastest",
        duration_mins=20,
        avg_aqi=fastest_aqi,
        aqi_category=get_aqi_category(fastest_aqi),
        polyline="mock_polyline_fastest",
        is_recommended=False
    )
    
    route2 = RouteOption(
        route_type="cleanest",
        duration_mins=28,
        avg_aqi=cleanest_aqi,
        aqi_category=get_aqi_category(cleanest_aqi),
        polyline="mock_polyline_cleanest",
        is_recommended=True
    )
    
    advisory = f"Taking the cleanest route adds just 8 minutes but reduces your AQI exposure by {fastest_aqi - cleanest_aqi} points."
    
    return SafeRouteResponse(
        routes=[route1, route2],
        route_advisory=advisory
    )

@app.get("/api/v1/users/{user_id}/profile", response_model=UserProfile)
def get_user_profile(user_id: str):
    if user_id not in users_db:
        # Auto-create empty profile for mocking or raise 404
        users_db[user_id] = {
            "asthma_respiratory": False,
            "elderly": False,
            "children_in_household": False
        }
    return UserProfile(**users_db[user_id])

@app.put("/api/v1/users/{user_id}/profile", response_model=UserProfile)
def update_user_profile(user_id: str, profile: UserProfile):
    # pydantic v2 has model_dump(), but dict() works up into v2 via warnings typically. We'll use dict()
    users_db[user_id] = profile.dict()
    return profile

@app.post("/api/v1/users/{user_id}/symptoms", response_model=SymptomLogResponse)
def log_symptoms(user_id: str, log: SymptomLogEntry):
    if log.symptom_level not in ['great', 'cough_wheezing', 'headache_fatigue']:
        raise HTTPException(status_code=400, detail="Invalid symptom_level.")
    
    record = log.dict()
    record['user_id'] = user_id
    symptoms_db.append(record)
    
    return SymptomLogResponse(status="success", message="Symptom logged successfully.")
