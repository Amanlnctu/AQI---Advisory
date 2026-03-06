from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Screen 3: User Profile Models
class UserProfile(BaseModel):
    user_id: str
    asthma_respiratory: bool = False
    elderly: bool = False
    children: bool = False

# Screen 3: Symptom Models 
class SymptomLog(BaseModel):
    user_id: str
    timestamp: datetime
    symptom_level: str = Field(..., description="Enum: 'Great', 'Coughing', 'Headache'")
    notes: Optional[str] = ""

# Screen 1: Dashboard Models
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

class TrendDataPoint(BaseModel):
    time: str
    aqi: int

class DashboardResponse(BaseModel):
    location: LocationInfo
    current_conditions: CurrentConditions
    tomorrow_prediction: TomorrowPrediction
    personalized_advisory: PersonalizedAdvisory
    trend_24h: List[TrendDataPoint]

# Screen 2: Safe Route Models
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
