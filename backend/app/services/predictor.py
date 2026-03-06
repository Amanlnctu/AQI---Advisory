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
        Since there is no external API providing true historical/forecast data 
        in this PoC, we simulate a realistic diurnal curve (sine wave) for PM2.5 
        where pollution peaks in the late night/early morning and dips in the afternoon, 
        plus some random noise.
        """
        import math
        import random
        
        forecast = []
        base_time = datetime.now()
        
        # Start the curve near the current_aqi
        base_level = current_aqi
        amplitude = max(20, current_aqi * 0.2) # Fluctuate by ~20% of current AQI
        
        for i in range(24):
            forecast_time = base_time + timedelta(hours=i)
            hour = forecast_time.hour
            
            # Diurnal curve: peaks around 6 AM, lowest around 2-4 PM
            # Cosine wave offset by 6 hours. cos((hour - 6) * pi / 12)
            # 6 AM = cos(0) = 1 (peak)
            # 6 PM = cos(pi) = -1 (trough)
            time_factor = math.cos((hour - 6) * math.pi / 12)
            
            # Add random noise
            noise = random.uniform(-10, 10)
            
            predicted_val = base_level + (amplitude * time_factor) + noise
            predicted_val = max(10, min(500, int(predicted_val))) # clamp between 10 and 500
            
            t_str = forecast_time.strftime("%Y-%m-%d %H:00")
            forecast.append(TrendDataPoint(time=t_str, aqi=predicted_val))

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
