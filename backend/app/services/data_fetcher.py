class ExternalDataFetcher:
    """
    Service responsible for fetching raw environmental data from external APIs.
    Uses Nominatim (free, no key) for geocoding and generates AQI based on location hash.
    """

    @staticmethod
    async def get_location_name(lat: float, lon: float) -> str:
        """
        Uses OpenStreetMap Nominatim reverse geocoding to get a human-readable location name.
        Falls back gracefully if the request fails.
        """
        import httpx
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                    headers={"User-Agent": "AeroGuard-AQI-App/1.0"}
                )
                data = resp.json()
                addr = data.get("address", {})
                # Build a short readable name
                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county", "")
                state = addr.get("state", "")
                country = addr.get("country_code", "").upper()
                parts = [p for p in [city, state, country] if p]
                return ", ".join(parts[:3]) if parts else f"{lat:.3f}, {lon:.3f}"
        except Exception:
            return f"{lat:.3f}, {lon:.3f}"

    @staticmethod
    async def get_current_weather(lat: float, lon: float) -> dict:
        """
        Returns mock weather data. Wind speed varies by coordinate to create
        different forecast shapes for different locations.
        """
        import math
        # Vary wind based on location so different cities feel different
        wind = 8.0 + abs(math.sin(lat * 0.5) * 15)
        return {
            "temperature_celsius": 25 + abs(math.cos(lon * 0.3) * 12),
            "humidity_percent": 50 + int(abs(math.sin(lat)) * 35),
            "wind_speed_kmh": round(wind, 1),
            "weather_condition": "Haze" if wind < 12 else "Windy"
        }

    @staticmethod
    async def get_current_aqi(lat: float, lon: float) -> dict:
        """
        AQI is no longer a fixed 145. It varies based on location so that
        changing lat/lon meaningfully changes the prediction.
        Delhi-like (28.6N, 77.2E) will be high; coastal or high-altitude will be lower.
        """
        import math
        # Base: urban pollution proxy. Higher latitude mid-range = more pollution (India/China corridor)
        urban_factor = max(0, 1 - abs(lat - 30) / 30)  # peaks around 30N
        lon_factor = max(0, 1 - abs(lon - 80) / 60)     # peaks around Indian subcontinent
        base_aqi = int(40 + (urban_factor * lon_factor * 320))
        # Add a location-specific hash offset for uniqueness
        offset = int((math.sin(lat * 12.9898 + lon * 78.233) + 1) * 30)
        aqi = max(15, min(450, base_aqi + offset))
        return {
            "aqi": aqi,
            "dominant_pollutant": "pm25"
        }
