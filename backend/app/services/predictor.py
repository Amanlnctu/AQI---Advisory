from datetime import datetime, timedelta
from app.models.domain import UserProfile, TrendDataPoint

class AQIPredictor:
    """
    Houses the mock heuristic algorithmic functions substituting ML layers,
    and calculates advisories mapped to the Indian AQI categorization standards.
    """

    @staticmethod
    def categorize_aqi(aqi: int) -> str:
        """Categorize into strict Indian Standards."""
        if aqi <= 50:
            return "Good"
        elif aqi <= 100:
            return "Satisfactory"
        elif aqi <= 200:
            return "Moderate"
        elif aqi <= 300:
            return "Poor"
        elif aqi <= 400:
            return "Very Poor"
        else:
            return "Severe"

    @staticmethod
    def generate_24h_forecast(current_aqi: int, weather_data: dict) -> list[TrendDataPoint]:
        """
        Mocks predictive ML layer using wind_speed as a heuristic factor.
        Calculates 24-hours of future AQI variances.
        """
        wind_speed = weather_data.get("wind_speed_kmh", 10.0)
        
        # Simple Logic: A higher wind speed drops the AQI more rapidly overnight
        modifier = -3 if wind_speed > 10.0 else 2 
        
        forecast = []
        base_time = datetime.now()
        tracked_aqi = current_aqi
        
        for i in range(24):
            tracked_aqi = max(10, tracked_aqi + modifier)
            t_str = (base_time + timedelta(hours=i)).strftime("%Y-%m-%d %H:00")
            forecast.append(TrendDataPoint(time=t_str, aqi=round(tracked_aqi)))

        return forecast

    @staticmethod
    def get_personalized_advisory(predicted_aqi: int, profile: UserProfile) -> dict:
        """
        Evaluates health risks using strict Indian brackets dynamically mapped against
        the user's registered vulnerabilities to return advisory configurations.
        """
        is_alert = False
        headline = "Conditions are Stable"
        message = "It is safe to continue normal activities outside."

        # Trigger logic mapped structurally across brackets and user's profile
        if predicted_aqi > 50:
            if profile.asthma_respiratory and predicted_aqi > 100:
                is_alert = True
                headline = "Asthma/Respiratory Alert"
                message = "The AQI is currently Moderate/High. Please minimize outdoor time."
        
        if predicted_aqi > 200:
            if profile.elderly or profile.children:
                is_alert = True
                headline = "Vulnerable Group Alert"
                message = "The AQI implies a Poor environment for the young and elderly today."

            if profile.asthma_respiratory:
                is_alert = True
                headline = "Severe Warning"
                message = "Poor Air Quality heavily affects asthma. Wear N95 masks or stay indoors."
        
        # Always alert anyone if severe
        if predicted_aqi > 400:
            is_alert = True
            headline = "HAZARDOUS ENVIRONMENT"
            message = "Extremely Severe Air levels recorded. Do not go outside."

        return {
            "is_alert": is_alert,
            "headline": headline,
            "message": message
        }
