import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class DataFetcherService:
    @staticmethod
    async def fetch_realtime_aqi(lat: float, lon: float) -> int:
        """
        Fetch real-time AQI using a placeholder API URL. 
        Swap the URL and parse logic when using the real WAQI/CPCB APIs.
        """
        api_url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={settings.aqi_api_key}"
        try:
            # Uncomment and use httpx for real data fetching
            # async with httpx.AsyncClient() as client:
            #     response = await client.get(api_url)
            #     response.raise_for_status()
            #     data = response.json()
            #     return data.get("data", {}).get("aqi", 0)
            
            # Using placeholder fallback mock values for now
            logger.info(f"Mock fetching AQI data for lat: {lat}, lon: {lon}")
            return 110 # Mock realistic moderate AQI
        except Exception as e:
            logger.error(f"Error fetching AQI: {e}")
            raise

    @staticmethod
    async def fetch_current_weather(lat: float, lon: float) -> dict:
        """
        Fetch current weather (temperature, humidity, wind) using OpenWeatherMap.
        """
        api_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.openweather_api_key}&units=metric"
        try:
            # Uncomment and use httpx for real data fetching
            # async with httpx.AsyncClient() as client:
            #     response = await client.get(api_url)
            #     response.raise_for_status()
            #     data = response.json()
            #     return {
            #         "temperature": data.get("main", {}).get("temp"),
            #         "humidity": data.get("main", {}).get("humidity"),
            #         "wind_speed": data.get("wind", {}).get("speed")
            #     }
            
            # Using placeholder fallback mock values for now
            logger.info(f"Mock fetching Weather data for lat: {lat}, lon: {lon}")
            return {"temperature": 32.5, "humidity": 65, "wind_speed": 12.0}
        except Exception as e:
            logger.error(f"Error fetching Weather: {e}")
            raise
