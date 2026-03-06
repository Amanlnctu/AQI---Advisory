from fastapi import APIRouter, HTTPException, Query, Path, Body, Depends
from typing import List
from app.core.database import get_db

from app.models.domain import (
    DashboardResponse, LocationInfo, CurrentConditions, TomorrowPrediction,
    PersonalizedAdvisory, UserProfile, SymptomLog, RouteRequest, 
    RouteResponse, RouteOption, TrendDataPoint
)
from app.services.data_fetcher import ExternalDataFetcher
from app.services.predictor import AQIPredictor
from datetime import datetime, timedelta
import random

router = APIRouter()

# ### Screen 1: Dashboard
@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user_id: str = Query(...),
    lat: float = Query(...),
    lon: float = Query(...)
):
    db = get_db()
    
    # 1. Fetch User Profile
    user_doc = await db.users.find_one({"user_id": user_id})
    if not user_doc:
        profile = UserProfile(user_id=user_id)
    else:
        profile = UserProfile(**user_doc)
        
    # 2. Ingest real-time data (now coordinate-sensitive)
    weather_data = await ExternalDataFetcher.get_current_weather(lat, lon)
    aqi_data = await ExternalDataFetcher.get_current_aqi(lat, lon)
    current_aqi = aqi_data.get("aqi", 0)

    # 3. Get human-readable location name via Nominatim
    location_name = await ExternalDataFetcher.get_location_name(lat, lon)

    # 4. Prediction layer
    forecast_24h = AQIPredictor.generate_24h_forecast(current_aqi, weather_data)
    current_cat = AQIPredictor.categorize_aqi(current_aqi)

    tomorrow_aqi = forecast_24h[12].aqi
    tomorrow_cat = AQIPredictor.categorize_aqi(tomorrow_aqi)
    
    advisory_dict = AQIPredictor.get_personalized_advisory(tomorrow_aqi, profile)

    return DashboardResponse(
        location=LocationInfo(name=location_name, lat=lat, lon=lon),
        current_conditions=CurrentConditions(aqi=current_aqi, category=current_cat),
        tomorrow_prediction=TomorrowPrediction(
            aqi=tomorrow_aqi,
            category=tomorrow_cat,
            target_time=(datetime.now() + timedelta(hours=12)).strftime("%Y-%m-%d %H:00")
        ),
        personalized_advisory=PersonalizedAdvisory(**advisory_dict),
        trend_24h=forecast_24h
    )

# ### Screen 2: Safe Route Calculation
@router.post("/routes/safe-route", response_model=RouteResponse)
async def compare_safe_routes(req: RouteRequest = Body(...)):
    # Mock generation mimicking origin base AQI
    aqi_data = await ExternalDataFetcher.get_current_aqi(req.origin_lat, req.origin_lon)
    base_aqi = aqi_data.get("aqi", 100)
    
    fast_aqi = base_aqi + random.randint(20, 60)
    clean_aqi = max(50, fast_aqi - 80)
    
    route1 = RouteOption(
        route_type="Fastest",
        duration_mins=25,
        avg_aqi=fast_aqi,
        aqi_category=AQIPredictor.categorize_aqi(fast_aqi),
        polyline="fastest_polyline_mock"
    )
    
    route2 = RouteOption(
        route_type="Cleanest",
        duration_mins=32,
        avg_aqi=clean_aqi,
        aqi_category=AQIPredictor.categorize_aqi(clean_aqi),
        polyline="cleanest_polyline_mock"
    )
    
    return RouteResponse(routes=[route1, route2])

# ### Screen 3: User Profile Management Operations
@router.get("/users/{user_id}/profile", response_model=UserProfile)
async def get_user_profile(user_id: str = Path(...)):
    db = get_db()
    user_doc = await db.users.find_one({"user_id": user_id})
    if not user_doc:
        # Create default returning
        default_profile = UserProfile(user_id=user_id)
        return default_profile
        
    return UserProfile(**user_doc)

@router.put("/users/{user_id}/profile", response_model=UserProfile)
async def update_user_profile(user_id: str = Path(...), profile: UserProfile = Body(...)):
    if profile.user_id != user_id:
        raise HTTPException(status_code=400, detail="Mismatched user_id.")
        
    db = get_db()
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": profile.model_dump()},
        upsert=True
    )
    return profile

# ### Screen 3: User Symptom Logging
@router.post("/users/{user_id}/symptoms")
async def log_user_symptoms(user_id: str = Path(...), log: SymptomLog = Body(...)):
    if log.user_id != user_id:
        raise HTTPException(status_code=400, detail="Mismatched user_id.")
        
    if log.symptom_level not in ['Great', 'Coughing', 'Headache']:
        raise HTTPException(status_code=400, detail="Invalid symptom enum.")
        
    db = get_db()
    await db.symptoms.insert_one(log.model_dump())
    
    return {"status": "success", "message": "Successfully deposited symptom row."}
