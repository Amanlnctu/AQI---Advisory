from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Database Models
class UserProfileDB(BaseModel):
    user_id: str
    asthma_respiratory: bool = False
    elderly: bool = False
    children_in_household: bool = False

class SymptomLogDB(BaseModel):
    user_id: str
    timestamp: datetime
    symptom_level: str
    notes: Optional[str] = ""

# API Models - Dashboard
class LocationInfo(BaseModel):
    name: str = "Unknown Location"
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

# API Models - Safe Route
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

# API Models - Profile & Symptoms
class UserProfileUpdate(BaseModel):
    asthma_respiratory: bool
    elderly: bool
    children_in_household: bool

class SymptomLogEntry(BaseModel):
    timestamp: datetime
    symptom_level: str = Field(..., description="Must be 'great', 'cough_wheezing', or 'headache_fatigue'")
    notes: Optional[str] = ""

class SymptomLogResponse(BaseModel):
    status: str
    message: str
