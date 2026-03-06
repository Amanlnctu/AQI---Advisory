class ExternalDataFetcher:
    """
    Service responsible for fetching raw environmental data from external APIs.
    Currently returns mock realistic dictionaries to ensure PoC operations locally
    without needing required external keys.
    """

    @staticmethod
    async def get_current_weather(lat: float, lon: float) -> dict:
        """
        Mocks reaching out to OpenWeatherMap for current data.
        Returns a dictionary of relevant properties.
        """
        return {
            "temperature_celsius": 32.5,
            "humidity_percent": 65,
            "wind_speed_kmh": 12.0,
            "weather_condition": "Haze"
        }

    @staticmethod
    async def get_current_aqi(lat: float, lon: float) -> dict:
        """
        Mocks reaching out to WAQI or CPCB to get real-time pollution metrics.
        Returns a dictionary containing the AQI integer.
        """
        return {
            "aqi": 145, # Simulated moderate/poor baseline
            "dominant_pollutant": "pm25"
        }
