from datetime import datetime, timedelta
from app.models.domain import TrendDataPoint

class PredictorService:
    @staticmethod
    def get_24h_forecast(lat: float, lon: float, current_aqi: int, weather_data: dict) -> list[TrendDataPoint]:
        """
        Mocks a predictive ML pipeline. Takes real-time AQI and weather constraints 
        to output an hourly variance prediction using a basic heuristic model.
        """
        wind_speed = weather_data.get("wind_speed", 0)
        
        forecast = []
        base_time = datetime.now()
        
        # Simple heuristic: higher wind speed usually decreases AQI over time
        hourly_modifier = -2 if wind_speed > 10 else 2 
        
        current_val = current_aqi
        for i in range(24):
            t = base_time + timedelta(hours=i)
            # apply heuristics constraint
            predicted_aqi = max(0, int(current_val + (i * hourly_modifier)))
            forecast.append(TrendDataPoint(
                time=t.strftime("%Y-%m-%d %H:00"),
                aqi=predicted_aqi
            ))
            
        return forecast

    @staticmethod
    def categorize_aqi(aqi: int) -> str:
        """Standard Indian AQI brackets."""
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
        else:
            return "Severe / Hazardous"
