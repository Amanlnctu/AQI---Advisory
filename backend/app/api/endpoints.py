from fastapi import APIRouter, HTTPException, Query, Path, Body
from app.core.database import get_db
from app.models.domain import (
    DashboardResponse, LocationInfo, CurrentConditions, TomorrowPrediction,
    PersonalizedAdvisory, UserProfileDB, UserProfileUpdate, SymptomLogEntry,
    SymptomLogResponse, SymptomLogDB, RouteRequest, SafeRouteResponse, RouteOption
)
from app.services.data_fetcher import DataFetcherService
from app.services.predictor import PredictorService
from datetime import datetime, timedelta
import random

router = APIRouter()

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user_id: str = Query(...),
    lat: float = Query(...),
    lon: float = Query(...)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")

    # 1. Fetch User Profile
    user_doc = await db.users.find_one({"user_id": user_id})
    if not user_doc:
        profile = UserProfileDB(user_id=user_id) # Default empty profile
    else:
        profile = UserProfileDB(**user_doc)
        
    # 2. Ingest real-time data
    try:
        current_aqi = await DataFetcherService.fetch_realtime_aqi(lat, lon)
        weather_data = await DataFetcherService.fetch_current_weather(lat, lon)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch external weather/AQI data")
        
    current_cat = PredictorService.categorize_aqi(current_aqi)

    # 3. Use Predicting ML layer
    forecast_24h = PredictorService.get_24h_forecast(lat, lon, current_aqi, weather_data)
    
    tomorrow_prediction_point = forecast_24h[12] if len(forecast_24h) > 12 else forecast_24h[-1]
    tomorrow_aqi = tomorrow_prediction_point.aqi
    tomorrow_cat = PredictorService.categorize_aqi(tomorrow_aqi)
    
    # 4. Generate Advisory
    triggered_by = []
    is_alert = False
    if current_aqi > 100:
        if profile.asthma_respiratory:
            triggered_by.append("asthma_respiratory")
            is_alert = True
        if profile.elderly:
            triggered_by.append("elderly")
            is_alert = True
        if profile.children_in_household and current_aqi > 150:
            triggered_by.append("children_in_household")
            is_alert = True

    if is_alert:
        headline = "Health Warning"
        message = "AQI levels are unsafe given your specific health profile. Minimize outdoor activities."
    else:
        headline = "All Clear"
        message = "AQI is acceptable. Enjoy your day outdoors."

    return DashboardResponse(
        location=LocationInfo(name="Predicted Location", lat=lat, lon=lon),
        current_conditions=CurrentConditions(aqi=current_aqi, category=current_cat),
        tomorrow_prediction=TomorrowPrediction(
            aqi=tomorrow_aqi, 
            category=tomorrow_cat, 
            target_time=(datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d 12:00")
        ),
        personalized_advisory=PersonalizedAdvisory(
            is_alert=is_alert,
            headline=headline,
            message=message,
            triggered_by=triggered_by
        ),
        trend_24h=forecast_24h
    )

@router.post("/routes/safe-route", response_model=SafeRouteResponse)
async def get_safe_route(req: RouteRequest):
    # Determine mock AQI dynamically from origins for the specific routes
    try:
        base_aqi = await DataFetcherService.fetch_realtime_aqi(req.origin_lat, req.origin_lon)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to calculate safe routes due to system error")
        
    fastest_aqi = base_aqi + random.randint(10, 50)  # slightly higher for "fast" busy roads
    cleanest_aqi = max(50, fastest_aqi - 80)
    
    route1 = RouteOption(
        route_type="fastest",
        duration_mins=20,
        avg_aqi=fastest_aqi,
        aqi_category=PredictorService.categorize_aqi(fastest_aqi),
        polyline="mock_polyline_fastest",
        is_recommended=False
    )
    
    route2 = RouteOption(
        route_type="cleanest",
        duration_mins=28,
        avg_aqi=cleanest_aqi,
        aqi_category=PredictorService.categorize_aqi(cleanest_aqi),
        polyline="mock_polyline_cleanest",
        is_recommended=True
    )
    
    advisory = f"Taking the cleanest route adds just 8 minutes but reduces your AQI exposure by {fastest_aqi - cleanest_aqi} points."
    
    return SafeRouteResponse(
        routes=[route1, route2],
        route_advisory=advisory
    )

@router.get("/users/{user_id}/profile", response_model=UserProfileUpdate)
async def get_user_profile(user_id: str = Path(...)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")
        
    user_doc = await db.users.find_one({"user_id": user_id})
    if not user_doc:
        # Default placeholder returning if not existing yet
        return UserProfileUpdate(asthma_respiratory=False, elderly=False, children_in_household=False)
        
    return UserProfileUpdate(**user_doc)

@router.put("/users/{user_id}/profile", response_model=UserProfileUpdate)
async def update_user_profile(user_id: str = Path(...), profile: UserProfileUpdate = Body(...)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")
        
    # Upsert user record into MongoDB
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": profile.model_dump()},
        upsert=True
    )
    return profile

@router.post("/users/{user_id}/symptoms", response_model=SymptomLogResponse)
async def log_symptoms(user_id: str = Path(...), log: SymptomLogEntry = Body(...)):
    if log.symptom_level not in ['great', 'cough_wheezing', 'headache_fatigue']:
        raise HTTPException(status_code=400, detail="Invalid symptom_level.")
        
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")
        
    db_entry = SymptomLogDB(user_id=user_id, **log.model_dump())
    await db.symptoms.insert_one(db_entry.model_dump())
    
    return SymptomLogResponse(status="success", message="Symptom logged successfully.")
